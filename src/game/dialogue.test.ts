import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDialogueChoice, pickupWorldPropAction } from './actions';
import { DIALOGUE_TOPICS, buildResidentDialogue } from './narrative';
import { getNpcRelation } from './relationships';
import { createFreshWorldState } from './storage';
import { ResidentId, WorldState } from './types';

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
  const giftChoice = pipSession.nodes.root.choices.find((c) => c.id === 'deliver_chalk_bundle_to_pip');
  assert.ok(giftChoice, 'Expected dynamic gift choice for held chalk_bundle');
  assert.equal(giftChoice.deliverHeldItem, 'chalk_bundle');

  const res = applyDialogueChoice(world, pipSession, giftChoice);
  assert.equal(res.nextWorld.playerHeldItem, null);
  assert.equal(res.nextWorld.worldProps.chalk_bundle.holder, 'pip');
  assert.equal(res.nextWorld.playerRelations.pip.giftsGiven, 1);
  assert.ok(res.nextSession.recentToast?.includes('Shared'));
});
