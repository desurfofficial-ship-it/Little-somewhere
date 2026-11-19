import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDialogueChoice } from './actions';
import { evaluateDialogueCondition, isChoiceAvailable } from './dialogueEngine';
import { createNpcMemoryEntry, propagateEncounterGossipInPlace, recordNpcMemoryInPlace } from './memories';
import { buildResidentDialogue } from './narrative';
import { getNpcRelation } from './relationships';
import { advanceToNextDay, createFreshWorldState } from './storage';
import {
  STORYLINES,
  STORYLINE_MAP,
  getActiveStorylineCue,
  getStorylineProgress,
  projectStorylineForJournal,
} from './storylines';
import { ResidentId, WorldState } from './types';

function pickChoice(world: WorldState, residentId: ResidentId, choiceId: string, phase: 'morning' | 'afternoon' | 'golden' | 'dusk' = 'afternoon') {
  const session = buildResidentDialogue(residentId, world, phase);
  const choice = session.nodes[session.currentNodeId].choices.find((c) => c.id === choiceId);
  assert.ok(choice, `Expected choice "${choiceId}" on ${residentId} (topic: ${session.topicId})`);
  assert.equal(isChoiceAvailable(choice, world, residentId), true, `Choice "${choiceId}" should be available`);
  return { session, ...applyDialogueChoice(world, session, choice) };
}

test('STORYLINES registry defines unique IDs, valid multi-stage definitions, and outcome labels', () => {
  assert.equal(STORYLINES.length, 6);
  const ids = new Set<string>();
  for (const def of STORYLINES) {
    assert.equal(ids.has(def.id), false, `Duplicate storyline id: ${def.id}`);
    ids.add(def.id);
    assert.ok(def.stages.length >= 3, `Expected >=3 stages for ${def.id}`);
    assert.ok(Object.keys(def.outcomes).length >= 2, `Expected >=2 outcomes for ${def.id}`);
    assert.ok(def.leadResidents.length >= 2);
  }
  assert.equal(STORYLINE_MAP.conflict_plaza_lanterns.category, 'interconnected_conflict');
});

test('all four personal storylines support full 3-stage branching, alternative outcomes, relations, and friction awareness', () => {
  const base = createFreshWorldState();
  let w: WorldState = {
    ...base,
    flags: {
      ...base.flags,
      heardBellMystery: true,
      foundPostcard: true,
      deliveredPostcard: true,
      brewedChamomileTea: true,
      borrowedBarnabyLadder: true,
      clearedGazeboIvy: true,
      foundBrassClapper: true,
      repairedFountain: true,
      plantedMoonPetals: true,
      bellRestored: true,
      claraArthurReconciled: true,
    },
    residents: {
      ...base.residents,
      pip: { ...base.residents.pip, trust: 2 },
      mina: { ...base.residents.mina, trust: 2 },
      sora: { ...base.residents.sora, trust: 2 },
      jun: { ...base.residents.jun, trust: 2 },
    },
  };

  // Snapshot original input references to verify immutability later
  const origStorylinesJson = JSON.stringify(w.storylines);
  const origSideFlagsJson = JSON.stringify(w.sideFlags);

  // 1. Willow Lane Zine — Art Edition (Pip -> Toby -> Nora)
  const pip1 = pickChoice(w, 'pip', 'pip_zine_start_choice');
  w = pip1.nextWorld;
  assert.equal(w.storylines.side_pip_zine.stage, 1);
  assert.equal(w.storylines.side_pip_zine.status, 'active');
  assert.equal(w.sideFlags.pipZineStarted, true);
  assert.equal(getActiveStorylineCue('toby', w)?.storylineId, 'side_pip_zine');

  const toby2 = pickChoice(w, 'toby', 'toby_zine_watercolor');
  w = toby2.nextWorld;
  assert.equal(w.storylines.side_pip_zine.stage, 2);
  assert.equal(w.storylines.side_pip_zine.outcome, 'art_edition');

  const nora3 = pickChoice(w, 'nora', 'nora_print_zine');
  w = nora3.nextWorld;
  assert.equal(w.storylines.side_pip_zine.stage, 3);
  assert.equal(w.storylines.side_pip_zine.status, 'completed');
  assert.equal(w.storylines.side_pip_zine.outcome, 'art_edition');
  assert.equal(w.sideFlags.pipZinePrinted, true);
  assert.equal(w.sideFlags.pipZineTheme, 'art_edition');
  assert.ok(w.memories.some((m) => m.id === 'mem_side_chalk_zine'));
  assert.ok(w.npcMemories.nora.some((m) => m.tag === 'zine_published'));
  assert.ok(w.npcMemories.pip.some((m) => m.tag === 'zine_published'));

  // 2. Seasonal Herb & Hearth — Tea Basket (Mina -> Sora -> Clara)
  const minaRelBefore = getNpcRelation(w.npcRelations, 'clara', 'mina').affinity;
  w = pickChoice(w, 'mina', 'mina_herb_pass').nextWorld;
  assert.equal(w.storylines.side_herb_loaf.stage, 1);
  w = pickChoice(w, 'sora', 'sora_plan_tea_basket').nextWorld;
  assert.equal(w.storylines.side_herb_loaf.stage, 2);
  assert.equal(w.storylines.side_herb_loaf.outcome, 'tea_basket');
  w = pickChoice(w, 'clara', 'clara_share_herb_loaf').nextWorld;
  assert.equal(w.storylines.side_herb_loaf.status, 'completed');
  assert.equal(w.storylines.side_herb_loaf.outcome, 'tea_basket');
  assert.equal(w.sideFlags.herbLoafShared, true);
  assert.ok(getNpcRelation(w.npcRelations, 'clara', 'mina').affinity > minaRelBefore);

  // 3. Cedar Music Stand — Storm-Braced Oak (Sora -> Toby -> Barnaby)
  w = pickChoice(w, 'sora', 'sora_ask_barnaby').nextWorld;
  // Note: side_pip_zine is already completed, so Toby triggers side_toby_stand_sketch at Stage 1
  w = pickChoice(w, 'toby', 'toby_sketch_oak_brace').nextWorld;
  assert.equal(w.storylines.side_pond_stand.stage, 2);
  assert.equal(w.storylines.side_pond_stand.outcome, 'weatherproof_oak');
  w = pickChoice(w, 'barnaby', 'barnaby_carve_stand').nextWorld;
  assert.equal(w.storylines.side_pond_stand.status, 'completed');
  assert.equal(w.storylines.side_pond_stand.outcome, 'weatherproof_oak');
  assert.equal(w.sideFlags.pondStandBuilt, true);

  // 4. True on the Route — Patient Repair (Jun friction memory awareness -> Nora -> Arthur)
  recordNpcMemoryInPlace(
    w.npcMemories,
    'jun',
    createNpcMemoryEntry({
      id: 'ev_blunt_test_jun',
      eventId: 'ev_blunt_test_jun',
      tag: 'player_blunt',
      category: 'friction',
      subjectPlayer: true,
      subjectResidents: ['jun'],
      provenance: 'firsthand',
      sourceKind: 'participant',
      createdDay: w.day,
      createdMinute: 540,
      importance: 3,
      retention: 'durable',
      valence: 'tense',
    }),
    w.day,
  );
  const junStage1 = pickChoice(w, 'jun', 'jun_watch_arthur');
  assert.ok(
    junStage1.session.nodes.root.text.includes('triple-checking every mail strap'),
    'Jun should reference prior bluntness memory when opening up about his drifting watch',
  );
  w = junStage1.nextWorld;
  w = pickChoice(w, 'nora', 'nora_teach_gentle_pace').nextWorld;
  assert.equal(w.storylines.side_jun_watch.stage, 2);
  assert.equal(w.storylines.side_jun_watch.outcome, 'patient_repair');
  w = pickChoice(w, 'arthur', 'arthur_fix_watch').nextWorld;
  assert.equal(w.storylines.side_jun_watch.status, 'completed');
  assert.equal(w.storylines.side_jun_watch.outcome, 'patient_repair');
  assert.equal(w.sideFlags.watchTuneFinished, true);

  // Original input state remained untouched
  assert.equal(JSON.stringify(base.storylines), origStorylinesJson);
  assert.equal(JSON.stringify(base.sideFlags), origSideFlagsJson);

  // Alternate Kitchen Edition branch on Willow Lane Zine
  const altStart = pickChoice(
    {
      ...base,
      flags: w.flags,
      residents: { ...base.residents, pip: { ...base.residents.pip, trust: 2 } },
    },
    'pip',
    'pip_zine_start_choice',
  ).nextWorld;
  const altClara = pickChoice(altStart, 'clara', 'clara_zine_recipe').nextWorld;
  assert.equal(altClara.storylines.side_pip_zine.outcome, 'kitchen_edition');
  const altNora = pickChoice(altClara, 'nora', 'nora_print_zine').nextWorld;
  assert.equal(altNora.storylines.side_pip_zine.outcome, 'kitchen_edition');
  assert.equal(altNora.sideFlags.pipZineTheme, 'kitchen_edition');
});

test('Arc 5 interconnected conflict (conflict_plaza_lanterns) enforces non-omniscience, in-game day cooldown, relationship gating, and gossip epilogues', () => {
  const base = createFreshWorldState();
  // Keep lanternsLit=false initially -> conflict must stay dormant
  const preLanterns: WorldState = {
    ...base,
    flags: {
      ...base.flags,
      heardBellMystery: true,
      foundPostcard: true,
      deliveredPostcard: true,
      brewedChamomileTea: true,
      borrowedBarnabyLadder: true,
      clearedGazeboIvy: true,
      foundBrassClapper: true,
      bellRestored: true,
      claraArthurReconciled: true,
      lanternsLit: false,
    },
  };
  assert.notEqual(
    buildResidentDialogue('toby', preLanterns, 'dusk').topicId,
    'conflict_lanterns_1_spark',
  );

  // Once lanternsLit is true, conflict triggers on Toby cleanly
  let world: WorldState = {
    ...preLanterns,
    flags: { ...preLanterns.flags, lanternsLit: true },
  };
  const worldSnapshot = JSON.stringify(world);

  // Stage 1 (Blunt path raises tension strongly)
  const bluntPath = pickChoice(world, 'toby', 'lanterns_side_barnaby_blunt', 'dusk');
  const btAfterBlunt = getNpcRelation(bluntPath.nextWorld.npcRelations, 'barnaby', 'toby');
  assert.ok(btAfterBlunt.tension > getNpcRelation(world.npcRelations, 'barnaby', 'toby').tension);
  assert.equal(
    bluntPath.nextWorld.worldEvents[0]?.kind,
    'conflict_shift',
  );

  // Input immutability verified
  assert.equal(JSON.stringify(world), worldSnapshot);

  // Stage 1 (Gentle path for full resolution test)
  const gentlePath = pickChoice(world, 'toby', 'lanterns_hear_toby_gentle', 'dusk');
  world = gentlePath.nextWorld;
  assert.equal(world.storylines.conflict_plaza_lanterns.stage, 1);
  assert.equal(world.storylines.conflict_plaza_lanterns.status, 'active');

  // Non-omniscience check on Barnaby BEFORE any gossip reached him
  const barnabySession = buildResidentDialogue('barnaby', world, 'afternoon');
  assert.equal(barnabySession.topicId, 'conflict_lanterns_2_barnaby');
  assert.ok(
    barnabySession.nodes.root.text.includes('Nobody mentioned a word to me yet'),
    `Barnaby should not assume Toby told him before gossip arrives: "${barnabySession.nodes.root.text}"`,
  );

  // If Toby gossiped the lantern debate to Barnaby first, Barnaby cites Toby explicitly
  const gossipedBarnabyWorld = structuredClone(world);
  recordNpcMemoryInPlace(
    gossipedBarnabyWorld.npcMemories,
    'barnaby',
    createNpcMemoryEntry({
      id: 'ev_gossip_debate',
      eventId: 'ev_gossip_debate',
      tag: 'lantern_debate',
      category: 'interaction',
      provenance: 'secondhand',
      sourceKind: 'gossip',
      fromResidentId: 'toby',
      hopCount: 1,
      confidence: 80,
      createdDay: world.day,
      createdMinute: 540,
      retention: 'durable',
    }),
    world.day,
  );
  const barnabyInformed = buildResidentDialogue('barnaby', gossipedBarnabyWorld, 'afternoon');
  assert.ok(barnabyInformed.nodes.root.text.includes('Toby already told me'));

  // Stage 2: Barnaby accepts downward brass hoods -> Stage 2 + cooldownDays: 1
  const stage2Res = pickChoice(world, 'barnaby', 'lanterns_suggest_hooded_brass', 'afternoon');
  world = stage2Res.nextWorld;
  assert.equal(world.storylines.conflict_plaza_lanterns.stage, 2);
  assert.equal(world.storylines.conflict_plaza_lanterns.cooldownUntilDay, world.day + 1);

  // Stage 3 on Nora MUST stay locked on the same day due to cooldown!
  const noraSameDay = buildResidentDialogue('nora', world, 'golden');
  assert.notEqual(
    noraSameDay.topicId,
    'conflict_lanterns_3_resolve',
    'Stage 3 resolution must wait until in-game cooldown day clears',
  );

  // Advance to next in-game day -> cooldown clears automatically and Nora unlocks Stage 3
  world = advanceToNextDay(world);
  assert.equal(world.day, 2);
  const noraDay2Stranger = buildResidentDialogue('nora', world, 'morning');
  assert.equal(noraDay2Stranger.topicId, 'conflict_lanterns_3_resolve');

  // Public harmony choice MUST be gated out when Nora is still below friendly/trust 2/reliability 30
  const harmonyChoice = noraDay2Stranger.nodes.root.choices.find(
    (c) => c.id === 'lanterns_resolve_public_harmony',
  )!;
  assert.ok(harmonyChoice);
  assert.equal(isChoiceAvailable(harmonyChoice, world, 'nora'), false);

  // Once Nora is friendly (affinity >= 45, trust >= 2, reliability >= 30), public_harmony unlocks!
  const friendlyNoraWorld: WorldState = {
    ...world,
    residents: {
      ...world.residents,
      nora: { ...world.residents.nora, trust: 2, met: true },
    },
    playerRelations: {
      ...world.playerRelations,
      nora: { ...world.playerRelations.nora, affinity: 52, reliability: 42 },
    },
  };
  assert.equal(isChoiceAvailable(harmonyChoice, friendlyNoraWorld, 'nora'), true);

  // Complete with public_harmony and verify cross-cast relationships + non-omniscient epilogues
  const resolved = pickChoice(friendlyNoraWorld, 'nora', 'lanterns_resolve_public_harmony', 'golden').nextWorld;
  assert.equal(resolved.storylines.conflict_plaza_lanterns.stage, 3);
  assert.equal(resolved.storylines.conflict_plaza_lanterns.status, 'completed');
  assert.equal(resolved.storylines.conflict_plaza_lanterns.outcome, 'public_harmony');
  assert.equal(resolved.sideFlags.lanternConflictResolved, true);
  assert.ok(resolved.memories.some((m) => m.id === 'mem_side_lantern_compromise'));
  assert.equal(getNpcRelation(resolved.npcRelations, 'barnaby', 'toby').tension, 0);
  assert.ok(getNpcRelation(resolved.npcRelations, 'nora', 'sora').affinity > getNpcRelation(friendlyNoraWorld.npcRelations, 'nora', 'sora').affinity);

  // Involved participants hold firsthand memory; uninvolved Mina does NOT!
  assert.ok(resolved.npcMemories.sora.some((m) => m.tag === 'lanterns_resolved_harmony'));
  assert.equal(
    resolved.npcMemories.mina.some((m) => m.tag === 'lanterns_resolved_harmony'),
    false,
  );
  assert.notEqual(
    buildResidentDialogue('mina', resolved, 'afternoon').topicId,
    'storyline_epilogue_lanterns',
    'Uninformed Mina must not react to Mirror Pond lantern settlement before learning of it',
  );

  // Propagate gossip deterministically from Nora -> Mina across in-game days
  // (Respecting 1 gossip exchange per pair per day, Nora may first share her kindred impression before the town-lore settlement)
  let gossipWorld = structuredClone(resolved);
  let learnedByMina = false;
  for (let s = 0; s < 16 && !learnedByMina; s++) {
    const out = propagateEncounterGossipInPlace(gossipWorld, ['nora', 'mina'], `enc_lantern_epi_${s}`);
    if (out && out.listenerId === 'mina' && out.eventId === 'ev_lanterns_resolved_harmony') {
      learnedByMina = true;
      break;
    }
    if (out || s % 3 === 2) {
      gossipWorld = advanceToNextDay(gossipWorld);
    }
  }
  assert.equal(learnedByMina, true, 'Expected Nora->Mina gossip of Mirror Pond settlement');
  assert.ok(gossipWorld.npcMemories.mina.some((m) => m.tag === 'lanterns_resolved_harmony'));
  const minaEpi = buildResidentDialogue('mina', gossipWorld, 'afternoon');
  assert.equal(minaEpi.topicId, 'storyline_epilogue_lanterns');
  assert.ok(minaEpi.nodes.root.text.includes('Nora'));

  const epiReply = minaEpi.nodes.root.choices.find((c) => c.id === 'epilogue_lanterns_warm')!;
  const afterMinaEpi = applyDialogueChoice(gossipWorld, minaEpi, epiReply).nextWorld;
  assert.equal(
    afterMinaEpi.npcMemories.mina.find((m) => m.tag === 'lanterns_resolved_harmony')?.mentionedToPlayer,
    true,
  );

  // Also test alternate compromise & gentle_space paths + journal projection helper
  const compResolved = pickChoice(world, 'nora', 'lanterns_resolve_compromise', 'golden').nextWorld;
  assert.equal(compResolved.storylines.conflict_plaza_lanterns.outcome, 'bridge_compromise');

  const spaceResolved = pickChoice(world, 'nora', 'lanterns_resolve_gentle_space', 'golden').nextWorld;
  assert.equal(spaceResolved.storylines.conflict_plaza_lanterns.outcome, 'gentle_space');

  const proj = projectStorylineForJournal(
    STORYLINE_MAP.conflict_plaza_lanterns,
    getStorylineProgress(resolved, 'conflict_plaza_lanterns'),
  );
  assert.equal(proj.status, 'completed');
  assert.equal(proj.outcomeLabel, 'Shared Dusk Candle Walk');
});

test('Phase 4 storylines execute deterministically across identical replays', () => {
  const runSequence = (): WorldState => {
    let w = createFreshWorldState();
    w = {
      ...w,
      flags: {
        ...w.flags,
        heardBellMystery: true,
        foundPostcard: true,
        deliveredPostcard: true,
        lanternsLit: true,
      },
      residents: {
        ...w.residents,
        pip: { ...w.residents.pip, trust: 2 },
      },
    };
    w = pickChoice(w, 'pip', 'pip_zine_start_choice').nextWorld;
    w = pickChoice(w, 'toby', 'toby_zine_watercolor').nextWorld;
    w = pickChoice(w, 'nora', 'nora_print_zine').nextWorld;
    w = pickChoice(w, 'toby', 'lanterns_hear_toby_gentle', 'dusk').nextWorld;
    w = pickChoice(w, 'barnaby', 'lanterns_suggest_cool_off', 'afternoon').nextWorld;
    w = advanceToNextDay(w);
    w = pickChoice(w, 'nora', 'lanterns_resolve_gentle_space', 'golden').nextWorld;
    return w;
  };

  const a = runSequence();
  const b = runSequence();
  assert.deepEqual(a.storylines, b.storylines);
  assert.deepEqual(a.npcRelations, b.npcRelations);
  assert.deepEqual(a.npcMemories, b.npcMemories);
  assert.equal(
    evaluateDialogueCondition(
      { requiresStoryline: { id: 'conflict_plaza_lanterns', status: ['completed'], outcome: 'gentle_space' } },
      'nora',
      a,
      'golden',
      'check',
    ),
    true,
  );
});

test('Arc 6 Fern Hollow Orchard Gathering executes both 3-stage branches, grants items, updates relations, and enforces non-omniscience', () => {
  const base = createFreshWorldState();
  const baseReady: WorldState = {
    ...base,
    flags: {
      ...base.flags,
      heardBellMystery: true,
      foundPostcard: true,
      deliveredPostcard: true,
      claraArthurReconciled: true,
    },
    residents: {
      ...base.residents,
      rowan: { ...base.residents.rowan, met: true, trust: 2 },
      clara: { ...base.residents.clara, met: true, trust: 2 },
      mina: { ...base.residents.mina, met: true, trust: 2 },
    },
  };

  // Branch A: Spiced Crabapple Tart Table (exploratory bee question -> Clara -> Rowan)
  const rowanSession = buildResidentDialogue('rowan', baseReady, 'afternoon');
  assert.equal(rowanSession.topicId, 'side_rowan_orchard_1');
  const skepChoice = rowanSession.nodes.root.choices.find((c) => c.id === 'rowan_orchard_skep_ask')!;
  assert.ok(skepChoice);
  const startChoice = rowanSession.nodes.rowan_orchard_skep_info.choices.find(
    (c) => c.id === 'rowan_orchard_start_after_bees',
  )!;
  let worldTart = applyDialogueChoice(baseReady, rowanSession, startChoice).nextWorld;
  assert.equal(worldTart.storylines.side_orchard_gathering.stage, 1);
  assert.equal(worldTart.storylines.side_orchard_gathering.status, 'active');
  assert.equal(worldTart.sideFlags.orchardGatheringStarted, true);

  const relBefore = getNpcRelation(worldTart.npcRelations, 'rowan', 'clara').affinity;
  const tartPick = pickChoice(worldTart, 'clara', 'clara_orchard_tart_choice', 'afternoon');
  worldTart = tartPick.nextWorld;
  assert.equal(worldTart.storylines.side_orchard_gathering.stage, 2);
  assert.equal(worldTart.storylines.side_orchard_gathering.outcome, 'spiced_tart_table');
  assert.ok(getNpcRelation(worldTart.npcRelations, 'rowan', 'clara').affinity > relBefore);

  const hostTart = pickChoice(worldTart, 'rowan', 'rowan_orchard_host_finish', 'golden');
  worldTart = hostTart.nextWorld;
  assert.equal(worldTart.storylines.side_orchard_gathering.stage, 3);
  assert.equal(worldTart.storylines.side_orchard_gathering.status, 'completed');
  assert.equal(worldTart.storylines.side_orchard_gathering.outcome, 'spiced_tart_table');
  assert.equal(worldTart.sideFlags.orchardGatheringComplete, true);
  assert.equal(worldTart.sideFlags.orchardGatheringOutcome, 'spiced_tart_table');
  assert.equal(worldTart.inventory.crabapple_tart, (baseReady.inventory.crabapple_tart ?? 0) + 1);
  assert.ok(worldTart.memories.some((m) => m.id === 'mem_side_orchard_gathering'));
  assert.ok(worldTart.npcMemories.rowan.some((m) => m.tag === 'orchard_gathering_hosted'));
  assert.ok(worldTart.npcMemories.clara.some((m) => m.tag === 'orchard_gathering_hosted'));
  assert.ok(worldTart.npcMemories.mina.some((m) => m.tag === 'orchard_gathering_hosted'));
  assert.equal(worldTart.npcMemories.toby.some((m) => m.tag === 'orchard_gathering_hosted'), false);

  // Uninformed Toby must NOT see orchard epilogue before gossip reaches him
  assert.notEqual(
    buildResidentDialogue('toby', worldTart, 'afternoon').topicId,
    'storyline_epilogue_orchard',
  );

  // Propagate gossip from Rowan -> Toby deterministically
  let gossipWorld = structuredClone(worldTart);
  let learned = false;
  for (let s = 0; s < 16 && !learned; s++) {
    const out = propagateEncounterGossipInPlace(gossipWorld, ['rowan', 'toby'], `enc_orch_${s}`);
    if (out && out.listenerId === 'toby' && out.eventId === 'ev_orchard_gathering_hosted') {
      learned = true;
      break;
    }
    if (out || s % 3 === 2) gossipWorld = advanceToNextDay(gossipWorld);
  }
  assert.equal(learned, true, 'Rowan should share Fern Hollow Gathering gossip with Toby');
  const tobyEpi = buildResidentDialogue('toby', gossipWorld, 'afternoon');
  assert.equal(tobyEpi.topicId, 'storyline_epilogue_orchard');
  assert.ok(tobyEpi.nodes.root.text.includes('Rowan'));

  // Branch B: Chamomile-Honey Picnic (Rowan -> Mina -> Rowan)
  let worldPicnic = pickChoice(baseReady, 'rowan', 'rowan_orchard_start', 'morning').nextWorld;
  worldPicnic = pickChoice(worldPicnic, 'mina', 'mina_orchard_picnic_choice', 'afternoon').nextWorld;
  assert.equal(worldPicnic.storylines.side_orchard_gathering.outcome, 'blossom_honey_picnic');
  worldPicnic = pickChoice(worldPicnic, 'rowan', 'rowan_orchard_host_finish', 'golden').nextWorld;
  assert.equal(worldPicnic.storylines.side_orchard_gathering.status, 'completed');
  assert.equal(worldPicnic.sideFlags.orchardGatheringOutcome, 'blossom_honey_picnic');
  assert.equal(worldPicnic.inventory.chamomile_pear_tea, (baseReady.inventory.chamomile_pear_tea ?? 0) + 1);
});
