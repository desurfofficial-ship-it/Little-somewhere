import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDialogueChoice, interactWithProp, performRingBellAction, pickupWorldPropAction } from './actions';
import { evaluateDialogueCondition, isChoiceAvailable } from './dialogueEngine';
import { createNpcMemoryEntry, propagateEncounterGossipInPlace, recordNpcMemoryInPlace } from './memories';
import { DIALOGUE_TOPICS, buildResidentDialogue, getResidentAvailableQuestCue } from './narrative';
import { getNpcRelation } from './relationships';
import { RESIDENT_ORDER } from './residents';
import { createFreshWorldState } from './storage';
import { ResidentId, TimePhase, WorldState } from './types';

test('every topic in DIALOGUE_TOPICS builds valid node graphs with zero broken nextNodeId links', () => {
  const baseWorld = createFreshWorldState();
  const sampleWorld: WorldState = {
    ...baseWorld,
    flags: {
      ...baseWorld.flags,
      heardBellMystery: true,
      foundPostcard: true,
      deliveredPostcard: true,
      brewedChamomileTea: true,
      borrowedBarnabyLadder: true,
      clearedGazeboIvy: true,
      foundBrassClapper: true,
      repairedFountain: true,
      plantedMoonPetals: true,
    },
  };

  for (const topic of DIALOGUE_TOPICS) {
    const resId: ResidentId = topic.residentId === 'any' ? 'pip' : topic.residentId;
    const built = topic.build(resId, sampleWorld, 'afternoon');
    assert.ok(built.nodes[built.rootId], `Topic ${topic.id} missing rootId ${built.rootId}`);
    for (const [nodeId, node] of Object.entries(built.nodes)) {
      for (const choice of node.choices) {
        assert.ok(
          built.nodes[choice.nextNodeId],
          `Topic ${topic.id} node "${nodeId}" choice "${choice.id}" references missing nextNodeId "${choice.nextNodeId}"`,
        );
      }
    }
  }
});

test('topic rotation prevents back-to-back repetition on daily conversations', () => {
  let world = createFreshWorldState();
  // Complete Clara's intro state so daily_slice rotation runs cleanly
  world = {
    ...world,
    flags: {
      ...world.flags,
      heardBellMystery: true,
      claraArthurReconciled: true,
    },
  };

  const session1 = buildResidentDialogue('clara', world, 'afternoon');
  const root1 = session1.nodes[session1.currentNodeId];
  assert.ok(root1.choices.length > 0);

  const after1 = applyDialogueChoice(world, session1, root1.choices[0]).nextWorld;
  assert.equal(after1.lastTopicByResident.clara, session1.topicId);

  const session2 = buildResidentDialogue('clara', after1, 'afternoon');
  assert.notEqual(
    session2.topicId,
    session1.topicId,
    `Expected topic rotation away from ${session1.topicId} on consecutive conversation`,
  );
});

test('all four multi-resident personal storylines advance cleanly via sideFlags and unlock memories', () => {
  let world = createFreshWorldState();
  // Establish trust >= 1 and postcard delivered so all four personal storylines trigger reliably
  world = {
    ...world,
    flags: {
      ...world.flags,
      heardBellMystery: true,
      foundPostcard: true,
      deliveredPostcard: true,
      repairedFountain: true,
      plantedMoonPetals: true,
      brewedChamomileTea: true,
      borrowedBarnabyLadder: true,
      clearedGazeboIvy: true,
      foundBrassClapper: true,
      bellRestored: true,
      claraArthurReconciled: true,
    },
    residents: {
      ...world.residents,
      pip: { ...world.residents.pip, trust: 2 },
      mina: { ...world.residents.mina, trust: 2 },
      sora: { ...world.residents.sora, trust: 2 },
      jun: { ...world.residents.jun, trust: 2 },
    },
  };

  const pickStoryChoice = (resId: ResidentId, expectedChoiceId: string) => {
    const s = buildResidentDialogue(resId, world, 'afternoon');
    const c = s.nodes[s.currentNodeId].choices.find((item) => item.id === expectedChoiceId);
    assert.ok(c, `Expected choice "${expectedChoiceId}" for ${resId} (topic: ${s.topicId})`);
    world = applyDialogueChoice(world, s, c).nextWorld;
  };

  // 1. Pip & Nora Chalk Zine
  pickStoryChoice('pip', 'pip_zine_start_choice');
  assert.equal(world.sideFlags.pipZineStarted, true);
  pickStoryChoice('nora', 'nora_print_zine');
  assert.equal(world.sideFlags.pipZinePrinted, true);

  // 2. Mina & Clara Herb Loaf
  pickStoryChoice('mina', 'mina_herb_pass');
  assert.equal(world.sideFlags.herbLoafStarted, true);
  pickStoryChoice('clara', 'clara_share_herb_loaf');
  assert.equal(world.sideFlags.herbLoafShared, true);

  // 3. Sora & Barnaby Cedar Music Stand
  pickStoryChoice('sora', 'sora_ask_barnaby');
  assert.equal(world.sideFlags.pondStandStarted, true);
  pickStoryChoice('barnaby', 'barnaby_carve_stand');
  assert.equal(world.sideFlags.pondStandBuilt, true);

  // 4. Jun & Arthur Pocket Watch
  pickStoryChoice('jun', 'jun_watch_arthur');
  assert.equal(world.sideFlags.watchTuneStarted, true);
  pickStoryChoice('arthur', 'arthur_fix_watch');
  assert.equal(world.sideFlags.watchTuneFinished, true);

  // All 4 storyline memories recorded
  const memIds = new Set(world.memories.map((m) => m.id));
  assert.ok(memIds.has('mem_side_chalk_zine'));
  assert.ok(memIds.has('mem_side_herb_loaf'));
  assert.ok(memIds.has('mem_side_music_stand'));
  assert.ok(memIds.has('mem_side_jun_watch'));
});

test('negative blunt replies penalize affinity/reliability while conflict mediation eases NPC tension', () => {
  // Negative choice on Jun's postcard milestone
  let world = createFreshWorldState();
  world = {
    ...world,
    flags: { ...world.flags, heardBellMystery: true, foundPostcard: true },
    playerRelations: {
      ...world.playerRelations,
      jun: { ...world.playerRelations.jun, affinity: 30, reliability: 40 },
    },
  };
  const junSession = buildResidentDialogue('jun', world, 'morning');
  const bluntChoice = junSession.nodes.root.choices.find((c) => c.id === 'jun_scold_blunt');
  assert.ok(bluntChoice);

  const afterBlunt = applyDialogueChoice(world, junSession, bluntChoice).nextWorld;
  assert.equal(afterBlunt.playerRelations.jun.negativeCount, 1);
  assert.ok(afterBlunt.playerRelations.jun.affinity < 30);
  assert.ok(afterBlunt.playerRelations.jun.reliability < 40);
  assert.equal(afterBlunt.npcRuntime.jun.emotion, 'embarrassed');

  // Conflict mediation topic on Arthur eases Arthur-Clara tension
  let conflictWorld = createFreshWorldState();
  conflictWorld = {
    ...conflictWorld,
    flags: {
      ...conflictWorld.flags,
      bellRestored: true, // suppress quest_arthur_bell so conflict topic surfaces cleanly
      claraArthurReconciled: false,
    },
  };
  const beforeTension = getNpcRelation(conflictWorld.npcRelations, 'arthur', 'clara').tension;
  const arthurSession = buildResidentDialogue('arthur', conflictWorld, 'golden');
  assert.equal(arthurSession.topicId, 'conflict_arthur_clara_tension');
  const easeChoice = arthurSession.nodes.root.choices.find((c) => c.id === 'arthur_ease_pride');
  assert.ok(easeChoice);

  const afterEase = applyDialogueChoice(conflictWorld, arthurSession, easeChoice).nextWorld;
  const afterTension = getNpcRelation(afterEase.npcRelations, 'arthur', 'clara').tension;
  assert.ok(afterTension < beforeTension, `Expected tension ${afterTension} < ${beforeTension}`);
});

test('holding a carryable item injects a live gift choice into dialogue and delivers cleanly', () => {
  let world = createFreshWorldState();
  world = pickupWorldPropAction(world, 'chalk_bundle').nextWorld;

  const pipSession = buildResidentDialogue('pip', world, 'afternoon');
  assert.ok(pipSession.nodes.root.text.includes('Chalk') || pipSession.nodes.root.choices.some((c) => c.id === 'deliver_chalk_bundle_to_pip'));
  const giftChoice = pipSession.nodes.root.choices.find((c) => c.id === 'deliver_chalk_bundle_to_pip');
  assert.ok(giftChoice, 'Expected dynamic gift choice for held chalk_bundle');
  assert.equal(giftChoice.deliverHeldItem, 'chalk_bundle');

  const res = applyDialogueChoice(world, pipSession, giftChoice);
  assert.equal(res.nextWorld.playerHeldItem, null);
  assert.equal(res.nextWorld.worldProps.chalk_bundle.holder, 'pip');
  assert.equal(res.nextWorld.playerRelations.pip.giftsGiven, 1);
  assert.ok(res.nextSession.recentToast?.includes('Shared'));

  // Non-omniscience: distant Clara has no knowledge of Pip's gift yet
  const gossipReadyWorld: WorldState = {
    ...res.nextWorld,
    flags: { ...res.nextWorld.flags, heardBellMystery: true, claraArthurReconciled: true },
  };
  const claraUninformed = buildResidentDialogue('clara', gossipReadyWorld, 'afternoon');
  assert.notEqual(
    claraUninformed.topicId,
    'event_gift_thanks',
    'Distant resident without witness or gossip knowledge must not react to Pip gift',
  );

  // Once Pip shares the gift with Clara via encounter gossip, Clara reacts cleanly with source attribution
  let transferredToClara = false;
  for (let s = 0; s < 16 && !transferredToClara; s++) {
    const out = propagateEncounterGossipInPlace(gossipReadyWorld, ['pip', 'clara'], `enc_gift_share_${s}`);
    if (out && out.listenerId === 'clara') {
      transferredToClara = true;
    }
  }
  assert.equal(transferredToClara, true, 'Expected Pip->Clara gossip transfer within deterministic encounters');
  const claraThanks = buildResidentDialogue('clara', gossipReadyWorld, 'afternoon');
  assert.equal(claraThanks.topicId, 'event_gift_thanks');
  assert.ok(claraThanks.nodes.root.text.includes('Pip'));
});

test('negative encounter unlocks sincere amends choice and Barnaby-Arthur craft conflict mediates cleanly', () => {
  let world = createFreshWorldState();
  world = {
    ...world,
    flags: { ...world.flags, heardBellMystery: true, foundPostcard: true },
    playerRelations: {
      ...world.playerRelations,
      jun: { ...world.playerRelations.jun, affinity: 30, reliability: 35 },
    },
  };
  const junSession = buildResidentDialogue('jun', world, 'morning');
  const bluntChoice = junSession.nodes.root.choices.find((c) => c.id === 'jun_scold_blunt')!;
  const afterBlunt = applyDialogueChoice(world, junSession, bluntChoice).nextWorld;

  // Next conversation surfaces make_amends_jun recovery option on non-quest topic
  const afterDelivered = {
    ...afterBlunt,
    flags: { ...afterBlunt.flags, deliveredPostcard: true },
  };
  const repairSession = buildResidentDialogue('jun', afterDelivered, 'afternoon');
  const amendsChoice = repairSession.nodes.root.choices.find((c) => c.id === 'make_amends_jun');
  assert.ok(amendsChoice, 'Expected make_amends_jun recovery choice after blunt reply');
  const repaired = applyDialogueChoice(afterDelivered, repairSession, amendsChoice);
  assert.ok(repaired.nextWorld.playerRelations.jun.reliability > afterBlunt.playerRelations.jun.reliability);
  assert.equal(repaired.nextWorld.npcRuntime.jun.emotion, 'relaxed');

  // Barnaby-Arthur craft mediation
  const barnabyWorld = {
    ...createFreshWorldState(),
    flags: {
      ...createFreshWorldState().flags,
      heardBellMystery: true,
      borrowedBarnabyLadder: true,
      repairedFountain: true,
    },
  };
  const barnabyBefore = getNpcRelation(barnabyWorld.npcRelations, 'arthur', 'barnaby').affinity;
  const barnabySession = buildResidentDialogue('barnaby', barnabyWorld, 'afternoon');
  assert.equal(barnabySession.topicId, 'conflict_barnaby_arthur_rafters');
  const bridgeChoice = barnabySession.nodes.root.choices.find((c) => c.id === 'barnaby_bridge_craft')!;
  const mediated = applyDialogueChoice(barnabyWorld, barnabySession, bridgeChoice).nextWorld;
  assert.ok(getNpcRelation(mediated.npcRelations, 'arthur', 'barnaby').affinity > barnabyBefore);
});

test('Phase 1 migration regression: zero duplicate choice IDs per session and all quest/concurrent branches preserved', () => {
  // 1. Arthur ready session has exactly one unique arthur_restore_bell choice (DUP-01 resolved)
  const readyWorld: WorldState = {
    ...createFreshWorldState(),
    flags: {
      ...createFreshWorldState().flags,
      heardBellMystery: true,
      foundPostcard: true,
      deliveredPostcard: true,
      brewedChamomileTea: true,
      borrowedBarnabyLadder: true,
      clearedGazeboIvy: true,
      foundBrassClapper: true,
    },
  };
  const arthurReadySession = buildResidentDialogue('arthur', readyWorld, 'afternoon');
  assert.equal(arthurReadySession.topicId, 'quest_arthur_bell');
  const restoreChoices = arthurReadySession.nodes.root.choices.filter((c) => c.id === 'arthur_restore_bell');
  assert.equal(restoreChoices.length, 1, 'arthur_restore_bell must appear exactly once');
  for (const node of Object.values(arthurReadySession.nodes)) {
    const ids = node.choices.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, `Duplicate choice IDs in node ${node.id}`);
  }

  // Verify arthur_postcard, arthur_tea, arthur_smalltalk, and arthur_restore_bell preserve outcomes
  const postcardChoice = arthurReadySession.nodes.root.choices.find((c) => c.id === 'arthur_postcard')!;
  const teaChoice = arthurReadySession.nodes.root.choices.find((c) => c.id === 'arthur_tea')!;
  const smalltalkChoice = arthurReadySession.nodes.root.choices.find((c) => c.id === 'arthur_smalltalk')!;
  assert.ok(postcardChoice && teaChoice && smalltalkChoice);
  assert.equal(applyDialogueChoice(readyWorld, arthurReadySession, postcardChoice).nextWorld.npcRuntime.arthur.emotion, 'surprised');
  assert.equal(applyDialogueChoice(readyWorld, arthurReadySession, teaChoice).nextWorld.npcRuntime.arthur.emotion, 'relaxed');

  const restored = applyDialogueChoice(readyWorld, arthurReadySession, restoreChoices[0]).nextWorld;
  assert.equal(restored.flags.bellRestored, true);
  assert.equal(restored.flags.claraArthurReconciled, true);
  assert.equal(restored.flags.lanternsLit, true);
  assert.equal(restored.flags.mediationStyle, 'festival_ring');
  assert.ok(restored.memories.some((m) => m.id === 'mem_bell_restored'));

  // 2. Pip alternate branch (pip_chalk)
  const fresh = createFreshWorldState();
  const pipSession = buildResidentDialogue('pip', fresh, 'morning');
  const pipChalk = pipSession.nodes.root.choices.find((c) => c.id === 'pip_chalk')!;
  const afterPipChalk = applyDialogueChoice(fresh, pipSession, pipChalk).nextWorld;
  assert.equal(afterPipChalk.flags.heardBellMystery, true);
  const pipMem = afterPipChalk.memories.find((m) => m.id === 'mem_bell_mystery');
  assert.ok(pipMem?.summary.includes('chalk star-maps'));

  // 3. Nora branches: nora_books preserves foundPostcard=false; nora_take_card unlocks mem_lost_postcard
  const noraSession = buildResidentDialogue('nora', afterPipChalk, 'morning');
  const noraBooks = noraSession.nodes.root.choices.find((c) => c.id === 'nora_books')!;
  const afterBooks = applyDialogueChoice(afterPipChalk, noraSession, noraBooks).nextWorld;
  assert.equal(afterBooks.flags.foundPostcard, false);

  const noraBell = noraSession.nodes.root.choices.find((c) => c.id === 'nora_bell')!;
  const noraStep1 = applyDialogueChoice(afterPipChalk, noraSession, noraBell);
  const noraTake = noraStep1.nextSession.nodes.nora_story.choices.find((c) => c.id === 'nora_take_card')!;
  const afterTake = applyDialogueChoice(noraStep1.nextWorld, noraStep1.nextSession, noraTake).nextWorld;
  assert.equal(afterTake.flags.foundPostcard, true);
  assert.ok(afterTake.memories.some((m) => m.id === 'mem_lost_postcard'));

  // 4. Jun branches: both jun_reassure and jun_advice deliver postcard & unlock mem_postcard_sent with distinct tones
  const junSession = buildResidentDialogue('jun', afterTake, 'morning');
  const junReassure = junSession.nodes.root.choices.find((c) => c.id === 'jun_reassure')!;
  const junAdvice = junSession.nodes.root.choices.find((c) => c.id === 'jun_advice')!;
  assert.equal(junReassure.tone, 'warm');
  assert.equal(junAdvice.tone, 'gentle');
  assert.notEqual(junReassure.label, junAdvice.label);
  const afterReassureRes = applyDialogueChoice(afterTake, junSession, junReassure);
  const afterReassure = afterReassureRes.nextWorld;
  assert.equal(afterReassure.flags.deliveredPostcard, true);
  assert.equal(afterReassureRes.memoryUnlockedTitle, 'Delayed Delivery');
  assert.ok(afterReassure.memories.some((m) => m.id === 'mem_postcard_sent'));
  const afterAdviceRes = applyDialogueChoice(afterTake, junSession, junAdvice);
  const afterAdvice = afterAdviceRes.nextWorld;
  assert.equal(afterAdvice.flags.deliveredPostcard, true);
  assert.equal(afterAdviceRes.memoryUnlockedTitle, 'Delayed Delivery');
  assert.equal(afterAdvice.residents.jun.trust, afterReassure.residents.jun.trust);
  assert.ok(afterAdvice.memories.some((m) => m.id === 'mem_postcard_sent'));

  // 5. Sora tea, Toby clapper, Clara baking bridge
  const soraSession = buildResidentDialogue('sora', afterReassure, 'afternoon');
  const soraTea = soraSession.nodes.root.choices.find((c) => c.id === 'sora_tea')!;
  const afterSora = applyDialogueChoice(afterReassure, soraSession, soraTea).nextWorld;
  assert.equal(afterSora.flags.brewedChamomileTea, true);
  assert.ok(afterSora.memories.some((m) => m.id === 'mem_chamomile_tea'));

  const tobySession = buildResidentDialogue('toby', afterSora, 'afternoon');
  const tobyClapper = tobySession.nodes.root.choices.find((c) => c.id === 'toby_clapper')!;
  const afterToby = applyDialogueChoice(afterSora, tobySession, tobyClapper).nextWorld;
  assert.equal(afterToby.flags.foundBrassClapper, true);
  assert.ok(afterToby.memories.some((m) => m.id === 'mem_brass_clapper'));

  const claraBridgeSession = buildResidentDialogue('clara', afterToby, 'afternoon');
  const claraBaking = claraBridgeSession.nodes.root.choices.find((c) => c.id === 'clara_bridge_baking')!;
  const afterBaking = applyDialogueChoice(afterToby, claraBridgeSession, claraBaking).nextWorld;
  assert.equal(afterBaking.flags.mediationStyle, 'shared_baking');
  assert.equal(afterBaking.flags.claraArthurReconciled, true);
  assert.equal(afterBaking.flags.lanternsLit, true);
  assert.ok(afterBaking.memories.some((m) => m.id === 'mem_reconciliation_bread'));
});

test('Phase 1 migration regression: quest_clara_rift gating, conflict negative paths, ambient/gossip/tier topics, and daily_jun_route lanterns', () => {
  // Clara blunt nudge available when no mediation evidence exists, gated out once foundBrassClapper=true, and capped at maxSeenCount=2
  let world = createFreshWorldState();
  const clara1 = buildResidentDialogue('clara', world, 'morning');
  assert.equal(clara1.topicId, 'quest_clara_rift');
  const bluntNudge = clara1.nodes.root.choices.find((c) => c.id === 'clara_blunt_nudge')!;
  assert.equal(isChoiceAvailable(bluntNudge, world, 'clara'), true);
  const withClapper: WorldState = { ...world, flags: { ...world.flags, foundBrassClapper: true } };
  assert.equal(isChoiceAvailable(bluntNudge, withClapper, 'clara'), false);

  world = applyDialogueChoice(world, clara1, clara1.nodes.root.choices.find((c) => c.id === 'clara_listen')!).nextWorld;
  // Re-surface quest_clara_rift after a second daily topic or directly verify maxSeenCount=2 cutoff
  world = {
    ...world,
    topicHistory: {
      ...world.topicHistory,
      quest_clara_rift: { seenCount: 2, lastSeenDay: world.day, lastSeenPhase: 'morning', chosenChoiceIds: ['clara_listen'] },
    },
  };
  const claraAfterCap = buildResidentDialogue('clara', world, 'afternoon');
  assert.notEqual(claraAfterCap.topicId, 'quest_clara_rift');

  // Conflict negative paths raise NPC tension
  const conflictWorld: WorldState = {
    ...createFreshWorldState(),
    flags: { ...createFreshWorldState().flags, bellRestored: true, claraArthurReconciled: false },
  };
  const arthurConflict = buildResidentDialogue('arthur', conflictWorld, 'golden');
  const brushOff = arthurConflict.nodes.root.choices.find((c) => c.id === 'arthur_brush_off')!;
  const afterBrush = applyDialogueChoice(conflictWorld, arthurConflict, brushOff).nextWorld;
  assert.ok(
    getNpcRelation(afterBrush.npcRelations, 'arthur', 'clara').tension >
      getNpcRelation(conflictWorld.npcRelations, 'arthur', 'clara').tension,
  );

  const barnabyConflictWorld: WorldState = {
    ...createFreshWorldState(),
    flags: { ...createFreshWorldState().flags, borrowedBarnabyLadder: true, repairedFountain: true },
  };
  const barnabyConflict = buildResidentDialogue('barnaby', barnabyConflictWorld, 'afternoon');
  const stewBlunt = barnabyConflict.nodes.root.choices.find((c) => c.id === 'barnaby_stew_blunt')!;
  const afterStew = applyDialogueChoice(barnabyConflictWorld, barnabyConflict, stewBlunt).nextWorld;
  assert.ok(
    getNpcRelation(afterStew.npcRelations, 'arthur', 'barnaby').tension >
      getNpcRelation(barnabyConflictWorld.npcRelations, 'arthur', 'barnaby').tension,
  );

  // Per-resident topicHistory scoping & non-omniscience for 'any' topics (event_fountain_repair)
  const bareFountainWorld: WorldState = {
    ...createFreshWorldState(),
    flags: {
      ...createFreshWorldState().flags,
      heardBellMystery: true,
      repairedFountain: true,
      claraArthurReconciled: true,
    },
  };
  assert.notEqual(
    buildResidentDialogue('clara', bareFountainWorld, 'afternoon').topicId,
    'event_fountain_repair',
    'Bare repairedFountain flag without npcMemories must not trigger reaction',
  );

  const fountainWorld = structuredClone(bareFountainWorld);
  recordNpcMemoryInPlace(
    fountainWorld.npcMemories,
    'clara',
    createNpcMemoryEntry({
      id: 'ev_fountain_fixed',
      eventId: 'ev_fountain_fixed',
      tag: 'fountain_fixed',
      category: 'event',
      subjectPlayer: true,
      subjectResidents: ['barnaby'],
      provenance: 'secondhand',
      sourceKind: 'gossip',
      fromResidentId: 'barnaby',
      createdDay: 1,
      createdMinute: 540,
      importance: 4,
      retention: 'durable',
      valence: 'warm',
    }),
    1,
  );
  recordNpcMemoryInPlace(
    fountainWorld.npcMemories,
    'pip',
    createNpcMemoryEntry({
      id: 'ev_fountain_fixed',
      eventId: 'ev_fountain_fixed',
      tag: 'fountain_fixed',
      category: 'event',
      subjectPlayer: true,
      subjectResidents: ['barnaby'],
      provenance: 'firsthand',
      sourceKind: 'witness',
      createdDay: 1,
      createdMinute: 540,
      importance: 4,
      retention: 'durable',
      valence: 'warm',
    }),
    1,
  );

  const claraFountain = buildResidentDialogue('clara', fountainWorld, 'afternoon');
  assert.equal(claraFountain.topicId, 'event_fountain_repair');
  assert.ok(claraFountain.nodes.root.text.includes('Barnaby'));
  const afterClaraFountain = applyDialogueChoice(
    fountainWorld,
    claraFountain,
    claraFountain.nodes.root.choices.find((c) => c.id === 'ev_fountain_cheer')!,
  ).nextWorld;
  assert.equal(
    afterClaraFountain.npcMemories.clara.find((m) => m.tag === 'fountain_fixed')?.mentionedToPlayer,
    true,
  );

  // Pip must STILL be able to see event_fountain_repair (not starved by Clara!)
  const pipFountain = buildResidentDialogue('pip', afterClaraFountain, 'afternoon');
  assert.equal(pipFountain.topicId, 'event_fountain_repair');

  // Jun lantern milestone in daily_jun_route sets lanternsLit (with fountain_fixed memory absent -> goes straight or after reaction)
  const junDailyWorld: WorldState = {
    ...createFreshWorldState(),
    flags: { ...createFreshWorldState().flags, heardBellMystery: true, repairedFountain: true },
  };
  const junDaily = buildResidentDialogue('jun', junDailyWorld, 'afternoon');
  assert.equal(junDaily.topicId, 'daily_jun_route');
  const lanternsChoice = junDaily.nodes.root.choices.find((c) => c.id === 'jun_lanterns')!;
  const jw = applyDialogueChoice(junDailyWorld, junDaily, lanternsChoice).nextWorld;
  assert.equal(jw.flags.lanternsLit, true);
});

test('Phase 1 engine scalability: new DialogueCondition predicates and reachable context flavor remarks work cleanly', () => {
  const world = createFreshWorldState();
  const sittingWorld: WorldState = {
    ...world,
    weather: 'light_rain',
    flags: { ...world.flags, claraArthurReconciled: true },
    npcRuntime: {
      ...world.npcRuntime,
      clara: {
        ...world.npcRuntime.clara,
        posture: 'sitting',
        reservedSeatId: 'seat_west_plaza',
      },
    },
    playerRelations: {
      ...world.playerRelations,
      clara: { ...world.playerRelations.clara, affinity: 75 },
    },
  };

  assert.equal(evaluateDialogueCondition({ minTier: 'close' }, 'clara', sittingWorld, 'afternoon', 't1'), true);
  assert.equal(evaluateDialogueCondition({ minTier: 'kindred' }, 'clara', sittingWorld, 'afternoon', 't1'), false);
  assert.equal(evaluateDialogueCondition({ maxTier: 'friendly' }, 'clara', sittingWorld, 'afternoon', 't1'), false);
  assert.equal(evaluateDialogueCondition({ requiresPosture: ['sitting'] }, 'clara', sittingWorld, 'afternoon', 't1'), true);
  assert.equal(evaluateDialogueCondition({ requiresWeatherNot: ['light_rain'] }, 'clara', sittingWorld, 'afternoon', 't1'), false);
  assert.equal(evaluateDialogueCondition({ requiresWeatherNot: ['sunlit'] }, 'clara', sittingWorld, 'afternoon', 't1'), true);

  // Legacy 3/4-arg vs full-context isChoiceAvailable
  const gatedChoice = {
    id: 'test_gated',
    label: 'Close friend choice',
    nextNodeId: 'end',
    minTier: 'close' as const,
    requiresCondition: { requiresPosture: ['sitting' as const] },
  };
  assert.equal(isChoiceAvailable(gatedChoice, sittingWorld, 'clara'), true);
  assert.equal(isChoiceAvailable(gatedChoice, world, 'clara'), false);
  assert.equal(isChoiceAvailable(gatedChoice, world.flags, world.residents.clara.trust, world.sideFlags), true);

  // Reachable sitting context remark on daily_slice topic (suppress higher-priority gossip for today)
  const dailyClaraWorld: WorldState = {
    ...sittingWorld,
    weather: 'sunlit',
    topicHistory: {
      'clara:tier_close_kindred_bond': { seenCount: 1, lastSeenDay: sittingWorld.day, lastSeenPhase: 'afternoon', chosenChoiceIds: [] },
      gossip_clara_mina_loaves: { seenCount: 1, lastSeenDay: sittingWorld.day, lastSeenPhase: 'afternoon', chosenChoiceIds: [] },
    },
  };
  const claraDaily = buildResidentDialogue('clara', dailyClaraWorld, 'afternoon');
  assert.equal(claraDaily.category, 'daily_slice');
  assert.ok(
    claraDaily.nodes.root.text.includes('catches the best breeze in town'),
    `Expected sitting context flavor remark in daily_slice text: "${claraDaily.nodes.root.text}"`,
  );

  // Native Phase 3/4 predicates on evaluateDialogueCondition (npcMemories & storylines + cooldown)
  const hookedWorld: WorldState = {
    ...world,
    day: 3,
    npcMemories: {
      ...world.npcMemories,
      clara: [
        createNpcMemoryEntry({
          id: 'm1',
          eventId: 'm1',
          tag: 'shared_bread',
          category: 'interaction',
          createdDay: 3,
          createdMinute: 600,
        }),
      ],
    },
    storylines: {
      ...world.storylines,
      bakery_revival: {
        id: 'bakery_revival',
        stage: 2,
        status: 'active',
        outcome: 'warm',
        cooldownUntilDay: 5,
      },
    },
  };

  assert.equal(
    evaluateDialogueCondition({ requiresNpcMemoriesAny: ['shared_bread'] }, 'clara', hookedWorld, 'afternoon', 'h1'),
    true,
  );
  assert.equal(
    evaluateDialogueCondition({ excludesNpcMemories: ['shared_bread'] }, 'clara', hookedWorld, 'afternoon', 'h1'),
    false,
  );
  assert.equal(
    evaluateDialogueCondition(
      { requiresStoryline: { id: 'bakery_revival', minStage: 2, status: ['active'], outcome: 'warm' } },
      'clara',
      hookedWorld,
      'afternoon',
      'h1',
    ),
    true,
  );
  assert.equal(
    evaluateDialogueCondition(
      { requiresStoryline: { id: 'bakery_revival', minStage: 2, requireCooldownCleared: true } },
      'clara',
      hookedWorld,
      'afternoon',
      'h1',
    ),
    false,
  );
  assert.equal(
    evaluateDialogueCondition(
      { requiresStoryline: { id: 'bakery_revival', minStage: 2, requireCooldownCleared: true } },
      'clara',
      { ...hookedWorld, day: 5 },
      'afternoon',
      'h1',
    ),
    true,
  );
  assert.equal(
    evaluateDialogueCondition(
      { requiresStoryline: { id: 'bakery_revival', minStage: 3 } },
      'clara',
      hookedWorld,
      'afternoon',
      'h1',
    ),
    false,
  );
});

test('Phase 1 migration regression: remaining concurrent milestones, gossip/tier/emotion/weather topics, and full cast x 4 phase sweep', () => {
  const base = createFreshWorldState();

  // 1. barnaby_ladder, barnaby_fountain, mina_plant, clara_bridge_truth
  const midWorld: WorldState = {
    ...base,
    flags: {
      ...base.flags,
      heardBellMystery: true,
      foundPostcard: true,
      deliveredPostcard: true,
      brewedChamomileTea: true,
      foundBrassClapper: true,
    },
  };

  const barnabyS = buildResidentDialogue('barnaby', midWorld, 'morning');
  const bLadder = barnabyS.nodes.root.choices.find((c) => c.id === 'barnaby_ladder')!;
  const bFountain = barnabyS.nodes.root.choices.find((c) => c.id === 'barnaby_fountain')!;
  assert.ok(bLadder && bFountain);
  const afterLadder = applyDialogueChoice(midWorld, barnabyS, bLadder).nextWorld;
  assert.equal(afterLadder.flags.borrowedBarnabyLadder, true);
  assert.equal(afterLadder.flags.clearedGazeboIvy, true);
  assert.ok(afterLadder.memories.some((m) => m.id === 'mem_gazebo_cleared'));

  const afterFountain = applyDialogueChoice(afterLadder, barnabyS, bFountain).nextWorld;
  assert.equal(afterFountain.flags.repairedFountain, true);
  assert.ok(afterFountain.memories.some((m) => m.id === 'mem_fountain_fixed'));

  const minaS = buildResidentDialogue('mina', afterFountain, 'morning');
  const minaPlant = minaS.nodes.root.choices.find((c) => c.id === 'mina_plant')!;
  const afterMina = applyDialogueChoice(afterFountain, minaS, minaPlant).nextWorld;
  assert.equal(afterMina.flags.plantedMoonPetals, true);
  assert.ok(afterMina.memories.some((m) => m.id === 'mem_moon_petals'));

  const claraTruthS = buildResidentDialogue('clara', afterMina, 'afternoon');
  const claraTruth = claraTruthS.nodes.root.choices.find((c) => c.id === 'clara_bridge_truth')!;
  const afterTruth = applyDialogueChoice(afterMina, claraTruthS, claraTruth).nextWorld;
  assert.equal(afterTruth.flags.mediationStyle, 'gentle_truth');
  assert.equal(afterTruth.flags.claraArthurReconciled, true);
  assert.ok(afterTruth.memories.some((m) => m.id === 'mem_reconciliation_truth'));

  // 2. Gossip topics: gossip_clara_mina_loaves & gossip_pip_toby_pond
  const gossipWorld: WorldState = {
    ...base,
    flags: { ...base.flags, heardBellMystery: true, claraArthurReconciled: true },
  };
  const claraGossip = buildResidentDialogue('clara', gossipWorld, 'afternoon');
  assert.equal(claraGossip.topicId, 'gossip_clara_mina_loaves');
  const tobyGossip = buildResidentDialogue('toby', gossipWorld, 'afternoon');
  assert.equal(tobyGossip.topicId, 'gossip_pip_toby_pond');

  // 3. Tier topic per-resident scoping: Clara seeing tier_close_kindred_bond does not block Mina same day
  const tierWorld: WorldState = {
    ...gossipWorld,
    playerRelations: {
      ...gossipWorld.playerRelations,
      clara: { ...gossipWorld.playerRelations.clara, affinity: 75 },
      mina: { ...gossipWorld.playerRelations.mina, affinity: 75 },
    },
  };
  const claraTier = buildResidentDialogue('clara', tierWorld, 'afternoon');
  assert.equal(claraTier.topicId, 'tier_close_kindred_bond');
  const afterClaraTier = applyDialogueChoice(tierWorld, claraTier, claraTier.nodes.root.choices[0]).nextWorld;
  const minaTier = buildResidentDialogue('mina', afterClaraTier, 'afternoon');
  assert.equal(minaTier.topicId, 'tier_close_kindred_bond');

  // 4. Emotion tired positive & blunt outcomes
  const tiredWorld: WorldState = {
    ...gossipWorld,
    npcRuntime: {
      ...gossipWorld.npcRuntime,
      barnaby: { ...gossipWorld.npcRuntime.barnaby, emotion: 'tired' },
    },
  };
  const tiredSession = buildResidentDialogue('barnaby', tiredWorld, 'afternoon');
  assert.equal(tiredSession.topicId, 'emotion_tired_check');
  const tiredKind = tiredSession.nodes.root.choices.find((c) => c.id === 'em_tired_kind')!;
  const tiredBlunt = tiredSession.nodes.root.choices.find((c) => c.id === 'em_tired_blunt')!;
  assert.equal(applyDialogueChoice(tiredWorld, tiredSession, tiredKind).nextWorld.npcRuntime.barnaby.emotion, 'relaxed');
  const afterTiredBlunt = applyDialogueChoice(tiredWorld, tiredSession, tiredBlunt).nextWorld;
  assert.equal(afterTiredBlunt.npcRuntime.barnaby.emotion, 'frustrated');
  assert.equal(afterTiredBlunt.playerRelations.barnaby.negativeCount, 1);

  // 5. Weather topics: light_rain & misty_morning/breezy
  const rainSession = buildResidentDialogue('mina', { ...gossipWorld, weather: 'light_rain' }, 'afternoon');
  assert.equal(rainSession.topicId, 'weather_rain_reflection');
  const mistySession = buildResidentDialogue('mina', { ...gossipWorld, weather: 'misty_morning' }, 'morning');
  assert.equal(mistySession.topicId, 'weather_misty_breezy_note');
  const breezySession = buildResidentDialogue('mina', { ...gossipWorld, weather: 'breezy' }, 'afternoon');
  assert.equal(breezySession.topicId, 'weather_misty_breezy_note');

  // 6. Full cast x 4 phases sweep in both fresh and late-story states: zero broken nextNodeId or duplicate choice IDs
  const lateWorld: WorldState = {
    ...afterTruth,
    flags: { ...afterTruth.flags, bellRestored: true, lanternsLit: true },
  };
  const phases: TimePhase[] = ['morning', 'afternoon', 'golden', 'dusk'];
  for (const state of [base, lateWorld]) {
    for (const resId of RESIDENT_ORDER) {
      for (const phase of phases) {
        const s = buildResidentDialogue(resId, state, phase);
        assert.ok(s.nodes[s.currentNodeId], `Missing root node for ${resId}/${phase}`);
        for (const node of Object.values(s.nodes)) {
          const ids = node.choices.map((c) => c.id);
          assert.equal(new Set(ids).size, ids.length, `Duplicate choice ID in ${resId}/${phase}/${s.topicId}/${node.id}`);
          for (const choice of node.choices) {
            assert.ok(s.nodes[choice.nextNodeId], `Broken link ${choice.nextNodeId} in ${resId}/${phase}/${s.topicId}`);
          }
        }
      }
    }
  }
});

test('both direct Hollow Oak discovery and Toby-assisted recovery unlock mem_brass_clapper consistently', () => {
  const fresh = createFreshWorldState();
  // Before heardBellMystery, Hollow Oak gives a hint without setting flag or unlocking memory
  const earlyOak = interactWithProp(fresh, 'hollow_oak');
  assert.equal(earlyOak.nextWorld.flags.foundBrassClapper, false);
  assert.equal(earlyOak.nextWorld.memories.some((m) => m.id === 'mem_brass_clapper'), false);

  const heardWorld: WorldState = {
    ...fresh,
    flags: { ...fresh.flags, heardBellMystery: true, clearedGazeboIvy: true },
  };
  assert.equal(getResidentAvailableQuestCue('toby', heardWorld), 'ready');

  // Route A: Direct Hollow Oak discovery awards mem_brass_clapper independently without changing Toby trust
  const soloPickup = interactWithProp(heardWorld, 'hollow_oak');
  assert.equal(soloPickup.nextWorld.flags.foundBrassClapper, true);
  assert.equal(soloPickup.memoryUnlockedTitle, 'The Hidden Brass Clapper');
  assert.equal(soloPickup.nextWorld.residents.toby.trust, heardWorld.residents.toby.trust);
  const soloMem = soloPickup.nextWorld.memories.find((m) => m.id === 'mem_brass_clapper');
  assert.ok(soloMem);
  assert.equal(soloMem.residentId, undefined);
  assert.equal(soloMem.summary.includes('Toby'), false);

  // Subsequent oak inspection reflects independent discovery rather than claiming Toby helped
  const soloReinspect = interactWithProp(soloPickup.nextWorld, 'hollow_oak');
  assert.equal(soloReinspect.body.includes('Toby'), false);
  assert.equal(soloReinspect.memoryUnlockedTitle, undefined);

  // Downstream progression and Toby's non-clapper dialogue remain valid after independent discovery
  assert.equal(getResidentAvailableQuestCue('toby', soloPickup.nextWorld), 'none');
  const tobyAfterSolo = buildResidentDialogue('toby', soloPickup.nextWorld, 'afternoon');
  assert.equal(tobyAfterSolo.nodes.root.choices.some((c) => c.id === 'toby_clapper'), false);
  assert.ok(tobyAfterSolo.nodes.root.choices.length >= 1);
  const claraAfterSolo = buildResidentDialogue('clara', soloPickup.nextWorld, 'afternoon');
  assert.ok(claraAfterSolo.nodes.root.choices.some((c) => c.id === 'clara_bridge_truth'));
  const arthurAfterSolo = buildResidentDialogue('arthur', soloPickup.nextWorld, 'afternoon');
  assert.ok(arthurAfterSolo.nodes.root.choices.some((c) => c.id === 'arthur_restore_bell'));

  // Route B: Toby-assisted recovery awards Toby +1 trust, Toby-attributed mem_brass_clapper, and avoids duplicate memory on oak reinspect
  const tobySession = buildResidentDialogue('toby', heardWorld, 'afternoon');
  const tobyChoice = tobySession.nodes.root.choices.find((c) => c.id === 'toby_clapper')!;
  const afterToby = applyDialogueChoice(heardWorld, tobySession, tobyChoice);
  assert.equal(afterToby.nextWorld.flags.foundBrassClapper, true);
  assert.equal(afterToby.memoryUnlockedTitle, 'The Hidden Brass Clapper');
  assert.equal(afterToby.nextWorld.residents.toby.trust, heardWorld.residents.toby.trust + 1);
  const tobyMem = afterToby.nextWorld.memories.find((m) => m.id === 'mem_brass_clapper');
  assert.ok(tobyMem);
  assert.equal(tobyMem.residentId, 'toby');

  const oakAfterToby = interactWithProp(afterToby.nextWorld, 'hollow_oak');
  assert.ok(oakAfterToby.body.includes('Toby'));
  assert.equal(
    oakAfterToby.nextWorld.memories.filter((m) => m.id === 'mem_brass_clapper').length,
    1,
  );
});

test('Step 3.7: bell reaction phrasing adapts to visual vs acoustic vs exaggerated gossip and flips mentionedToPlayer', () => {
  let world = createFreshWorldState();
  world = {
    ...world,
    weather: 'light_rain',
    flags: { ...world.flags, heardBellMystery: true, bellRestored: true, claraArthurReconciled: true },
    npcRuntime: {
      ...world.npcRuntime,
      // Pip outdoors right beside Gazebo -> visual firsthand bell_ring
      pip: {
        ...world.npcRuntime.pip,
        position: { x: 0.5, z: -7.5 },
        currentActivityId: 'afternoon_gazebo',
        currentPlaceName: 'Old Bell Gazebo',
      },
      // Clara sheltered on Bakery Porch -> acoustic firsthand bell_chime
      clara: {
        ...world.npcRuntime.clara,
        position: { x: -11.0, z: -6.8 },
        currentActivityId: 'clara_rain_oven',
        currentPlaceName: 'Bakery Porch',
      },
      // Toby far away beyond ACOUSTIC_BELL_RADIUS
      toby: {
        ...world.npcRuntime.toby,
        position: { x: 24.0, z: 24.0 },
        currentActivityId: 'toby_rain_shelter',
        currentPlaceName: 'Far Orchard Edge',
      },
    },
  };

  const afterRing = performRingBellAction(world).nextWorld;

  const pipSession = buildResidentDialogue('pip', afterRing, 'afternoon');
  assert.equal(pipSession.topicId, 'event_bell_celebration');
  assert.ok(pipSession.nodes.root.text.includes('cedar eaves'));

  const claraSession = buildResidentDialogue('clara', afterRing, 'afternoon');
  assert.equal(claraSession.topicId, 'event_bell_celebration');
  assert.ok(claraSession.nodes.root.text.includes('where I was working'));

  // Toby missed it initially -> does not trigger bell celebration
  assert.notEqual(
    buildResidentDialogue('toby', afterRing, 'afternoon').topicId,
    'event_bell_celebration',
  );

  // Give Toby an exaggerated secondhand rumor from Pip -> descriptive exaggerated phrasing + mentionedToPlayer cleanup
  recordNpcMemoryInPlace(
    afterRing.npcMemories,
    'toby',
    createNpcMemoryEntry({
      id: 'ev_bell_rumor_toby',
      eventId: 'ev_bell_rumor_toby',
      tag: 'bell_ring',
      category: 'event',
      subjectPlayer: false,
      subjectResidents: ['pip'],
      provenance: 'rumor',
      sourceKind: 'gossip',
      fromResidentId: 'pip',
      hopCount: 2,
      confidence: 50,
      distorted: true,
      distortionFlavor: 'exaggerated',
      createdDay: afterRing.day,
      createdMinute: afterRing.minuteOfDay,
      importance: 4,
      retention: 'ephemeral',
      valence: 'warm',
    }),
    afterRing.day,
  );
  const tobyRumorSession = buildResidentDialogue('toby', afterRing, 'afternoon');
  assert.equal(tobyRumorSession.topicId, 'event_bell_celebration');
  assert.ok(tobyRumorSession.nodes.root.text.includes('Pip'));
  assert.ok(tobyRumorSession.nodes.root.text.includes('the way it’s told'));
  assert.equal(tobyRumorSession.surfacedMemoryEventIds?.[0]?.eventId, 'ev_bell_rumor_toby');

  const bellChoice = tobyRumorSession.nodes.root.choices.find((c) => c.id === 'ev_bell_warm')!;
  const afterTobyMentioned = applyDialogueChoice(afterRing, tobyRumorSession, bellChoice).nextWorld;
  assert.equal(
    afterTobyMentioned.npcMemories.toby.find((m) => m.eventId === 'ev_bell_rumor_toby')?.mentionedToPlayer,
    true,
  );

  // Advancing to next day must NOT re-trigger event_bell_celebration for Toby once mentioned
  const nextDayToby = { ...afterTobyMentioned, day: afterTobyMentioned.day + 1 };
  assert.notEqual(
    buildResidentDialogue('toby', nextDayToby, 'afternoon').topicId,
    'event_bell_celebration',
  );
});

test('Step 3.7: descriptive rumor distortion appears in third-party gossip with zero clarification choices', () => {
  const base = createFreshWorldState();
  const rumorWorld: WorldState = {
    ...base,
    flags: {
      ...base.flags,
      heardBellMystery: true,
      foundPostcard: true,
      deliveredPostcard: true,
      brewedChamomileTea: true,
      foundBrassClapper: true,
      borrowedBarnabyLadder: true,
      clearedGazeboIvy: true,
      plantedMoonPetals: true,
      claraArthurReconciled: true,
      bellRestored: true,
    },
  };

  recordNpcMemoryInPlace(
    rumorWorld.npcMemories,
    'sora',
    createNpcMemoryEntry({
      id: 'ev_rumor_toby_kindred',
      eventId: 'ev_rumor_toby_kindred',
      tag: 'player_bond_kindred',
      category: 'social_impression',
      subjectPlayer: true,
      subjectResidents: ['toby'],
      provenance: 'rumor',
      sourceKind: 'gossip',
      fromResidentId: 'pip',
      hopCount: 2,
      confidence: 52,
      distorted: true,
      distortionFlavor: 'exaggerated',
      createdDay: 1,
      createdMinute: 540,
      importance: 4,
      retention: 'ephemeral',
      valence: 'warm',
      detail: { targetTier: 'kindred' },
    }),
    1,
  );

  const session = buildResidentDialogue('sora', rumorWorld, 'afternoon');
  assert.equal(session.topicId, 'gossip_third_party_relation');
  assert.ok(session.nodes.root.text.includes('Heard from Pip'));
  assert.ok(session.nodes.root.text.includes('stories swell along the lane'));
  // Strictly descriptive — no player clarification / correction choices injected
  assert.equal(session.nodes.root.choices.length, 1);
  assert.equal(session.nodes.root.choices[0].id, 'gossip_tp_kindred_warm');
});


