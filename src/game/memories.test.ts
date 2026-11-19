import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACOUSTIC_BELL_RADIUS,
  EPHEMERAL_RUMOR_TTL_DAYS,
  LOCAL_WITNESS_RADIUS,
  MAX_GOSSIP_HOPS,
  MAX_NPC_MEMORIES_PER_RESIDENT,
  MAX_SECONDHAND_CONFIDENCE,
  collectWitnessesForPosition,
  createInitialNpcMemories,
  createNpcMemoryEntry,
  formatNpcMemorySummary,
  markNpcMemoriesMentionedInPlace,
  propagateEncounterGossipInPlace,
  pruneExpiredNpcMemoriesInPlace,
  recordNpcMemoryInPlace,
} from './memories';
import { createFreshWorldState } from './storage';
import {
  applyDialogueChoice,
  deliverHeldItemAction,
  interactWithProp,
  performRingBellAction,
  pickupWorldPropAction,
} from './actions';
import { RESIDENT_ORDER } from './residents';
import { DialogueChoice, DialogueSession, WorldState } from './types';

function withInitializedMemories(world: WorldState, reconciled = world.flags.claraArthurReconciled): WorldState {
  return {
    ...world,
    npcMemories: createInitialNpcMemories(reconciled, world.day, world.minuteOfDay),
  };
}

test('Step 3.2: baseline npcMemories initialize dynamically across RESIDENT_ORDER with lore separation', () => {
  const unreconciled = createInitialNpcMemories(false, 1, 480);
  for (const id of RESIDENT_ORDER) {
    assert.ok(Array.isArray(unreconciled[id]), `Expected initialized memory array for ${id}`);
  }
  assert.equal(unreconciled.clara.some((m) => m.tag === 'gazebo_rift' && m.retention === 'permanent'), true);
  assert.equal(unreconciled.arthur.some((m) => m.tag === 'gazebo_rift' && m.retention === 'permanent'), true);
  assert.equal(unreconciled.pip.length, 0);

  const reconciled = createInitialNpcMemories(true, 4, 960);
  assert.equal(
    reconciled.clara.some((m) => m.tag === 'clara_arthur_reconciled' && m.provenance === 'firsthand'),
    true,
  );
  assert.equal(reconciled.clara.some((m) => m.tag === 'gazebo_rift'), false);
});

test('Step 3.2: spatial & acoustic witness rules respect radius and rain sheltering', () => {
  let world = createFreshWorldState();
  // Position Pip right beside fountain plaza (0, 2.5), Clara sheltered at Bakery Porch (-8, -6.4) during rain
  world = {
    ...world,
    weather: 'light_rain',
    npcRuntime: {
      ...world.npcRuntime,
      pip: {
        ...world.npcRuntime.pip,
        position: { x: 1.5, z: 2.5 },
        currentActivityId: 'afternoon_stroll',
        currentPlaceName: 'Fountain Plaza',
      },
      toby: {
        ...world.npcRuntime.toby,
        position: { x: 3.5, z: 4.0 },
        currentActivityId: 'morning_sketch',
        currentPlaceName: 'Mirror Pond Bank',
      },
      clara: {
        ...world.npcRuntime.clara,
        position: { x: -4.0, z: 2.0 }, // close in meters, but explicitly in sheltered rain activity
        currentActivityId: 'clara_rain_oven',
        currentPlaceName: 'Bakery Porch',
      },
      arthur: {
        ...world.npcRuntime.arthur,
        position: { x: 14.0, z: 14.0 }, // far away (> 8.5m)
        currentActivityId: 'morning_yard',
        currentPlaceName: 'Copperwheel Yard',
      },
    },
  };

  const visualWitnesses = collectWitnessesForPosition(world, { x: 0, z: 2.5 }, LOCAL_WITNESS_RADIUS);
  assert.ok(visualWitnesses.includes('pip'));
  assert.ok(visualWitnesses.includes('toby'));
  assert.equal(visualWitnesses.includes('clara'), false, 'Sheltered NPC must not witness outdoor event in rain');
  assert.equal(visualWitnesses.includes('arthur'), false, 'Distant NPC beyond LOCAL_WITNESS_RADIUS must not witness');

  // Wide acoustic Gazebo Bell chime with allowSheltered reaches across town within ACOUSTIC_BELL_RADIUS
  const acousticWitnesses = collectWitnessesForPosition(
    world,
    { x: 0, z: -6.8 },
    ACOUSTIC_BELL_RADIUS,
    { allowSheltered: true },
  );
  assert.ok(acousticWitnesses.includes('clara'));
  assert.ok(acousticWitnesses.includes('pip'));
  assert.ok(acousticWitnesses.includes('arthur'));
});

test('Step 3.2: provenance never downgrades, upgrades on direct observation, and corroborates cleanly', () => {
  const mems = createInitialNpcMemories(false, 1, 480);

  // 1. Pip hears a secondhand rumor from Jun
  const rumorCopy = createNpcMemoryEntry({
    id: 'ev_fountain_fixed',
    eventId: 'ev_fountain_fixed',
    tag: 'fountain_fixed',
    category: 'event',
    subjectPlayer: true,
    subjectResidents: ['barnaby'],
    provenance: 'rumor',
    sourceKind: 'gossip',
    originResidentId: 'barnaby',
    fromResidentId: 'jun',
    hopCount: 2,
    confidence: 52,
    distorted: true,
    distortionFlavor: 'uncertain',
    createdDay: 1,
    createdMinute: 500,
    learnedDay: 1,
    learnedMinute: 540,
    importance: 3,
    retention: 'ephemeral',
    valence: 'warm',
  });
  recordNpcMemoryInPlace(mems, 'pip', rumorCopy, 1);
  assert.equal(mems.pip.length, 1);
  assert.equal(mems.pip[0].provenance, 'rumor');

  // 2. Corroborating from Nora boosts confidence without duplicating entry
  const corroboration = createNpcMemoryEntry({
    id: 'ev_fountain_fixed',
    eventId: 'ev_fountain_fixed',
    tag: 'fountain_fixed',
    category: 'event',
    subjectPlayer: true,
    subjectResidents: ['barnaby'],
    provenance: 'secondhand',
    sourceKind: 'gossip',
    originResidentId: 'barnaby',
    fromResidentId: 'nora',
    hopCount: 1,
    confidence: 78,
    createdDay: 1,
    createdMinute: 500,
    learnedDay: 2,
    learnedMinute: 600,
    importance: 3,
    retention: 'durable',
    valence: 'warm',
  });
  recordNpcMemoryInPlace(mems, 'pip', corroboration, 2);
  assert.equal(mems.pip.length, 1);
  assert.equal(mems.pip[0].confidence, MAX_SECONDHAND_CONFIDENCE > 88 ? 88 : 85); // upgraded cleanly from rumor->secondhand
  assert.equal(mems.pip[0].provenance, 'secondhand');

  // 3. Direct observation upgrades Pip's memory cleanly to firsthand
  const direct = createNpcMemoryEntry({
    id: 'ev_fountain_fixed',
    eventId: 'ev_fountain_fixed',
    tag: 'fountain_fixed',
    category: 'event',
    subjectPlayer: true,
    subjectResidents: ['barnaby'],
    provenance: 'firsthand',
    sourceKind: 'witness',
    createdDay: 1,
    createdMinute: 500,
    learnedDay: 2,
    learnedMinute: 720,
    importance: 4,
    retention: 'durable',
    valence: 'warm',
  });
  recordNpcMemoryInPlace(mems, 'pip', direct, 2);
  assert.equal(mems.pip.length, 1);
  assert.equal(mems.pip[0].provenance, 'firsthand');
  assert.equal(mems.pip[0].confidence, 100);
  assert.equal(mems.pip[0].hopCount, 0);
  assert.equal(mems.pip[0].distorted, false);

  // 4. Attempting to overwrite firsthand with a rumor must NEVER downgrade
  recordNpcMemoryInPlace(mems, 'pip', rumorCopy, 3);
  assert.equal(mems.pip[0].provenance, 'firsthand');
  assert.equal(mems.pip[0].confidence, 100);
});

test('Step 3.2: bounded memory capacity preserves permanent memories and expires ephemeral rumors by in-game day', () => {
  const mems = createInitialNpcMemories(false, 1, 480); // Clara starts with 1 permanent lore memory

  // Mark Clara's initial memory already mentioned or keep it permanent
  for (let i = 0; i < 24; i++) {
    recordNpcMemoryInPlace(
      mems,
      'clara',
      createNpcMemoryEntry({
        id: `rumor_${i}`,
        eventId: `rumor_${i}`,
        tag: `rumor_tag_${i}`,
        category: 'interaction',
        provenance: 'rumor',
        sourceKind: 'gossip',
        fromResidentId: 'jun',
        hopCount: 2,
        confidence: 45,
        createdDay: 1,
        createdMinute: 480 + i,
        learnedDay: 1,
        learnedMinute: 480 + i,
        importance: (i % 3) + 1,
        retention: 'ephemeral',
        valence: 'neutral',
        mentionedToPlayer: i < 10,
      }),
      1,
    );
  }

  assert.equal(mems.clara.length, MAX_NPC_MEMORIES_PER_RESIDENT);
  assert.equal(
    mems.clara.some((m) => m.id === 'lore_gazebo_rift' && m.retention === 'permanent'),
    true,
    'Permanent lore memory must survive flood of 24 ephemeral rumors',
  );

  // Prune past EPHEMERAL_RUMOR_TTL_DAYS
  const expiryCheckDay = 1 + EPHEMERAL_RUMOR_TTL_DAYS + 1;
  pruneExpiredNpcMemoriesInPlace(mems, expiryCheckDay);
  assert.equal(mems.clara.some((m) => m.retention === 'ephemeral'), false);
  assert.equal(
    mems.clara.some((m) => m.id === 'lore_gazebo_rift'),
    true,
    'Permanent memories must never expire over in-game days',
  );
});

test('Step 3.3: gossip respects estrangement, pair cooldown, hop caps, sensitivity gates, and determinism', () => {
  // 1. Estranged Clara & Arthur must NEVER exchange gossip
  let world = withInitializedMemories(createFreshWorldState(), false);
  recordNpcMemoryInPlace(
    world.npcMemories!,
    'clara',
    createNpcMemoryEntry({
      id: 'ev_gift_clara',
      eventId: 'ev_gift_clara',
      tag: 'player_gift',
      category: 'interaction',
      subjectPlayer: true,
      subjectResidents: ['clara'],
      provenance: 'firsthand',
      sourceKind: 'participant',
      createdDay: 1,
      createdMinute: 500,
      importance: 4,
      retention: 'durable',
      valence: 'warm',
    }),
    1,
  );

  const estrangedAttempt = propagateEncounterGossipInPlace(world, ['clara', 'arthur'], 'enc_estranged');
  assert.equal(estrangedAttempt, null);
  assert.equal(world.npcMemories!.arthur.some((m) => m.eventId === 'ev_gift_clara'), false);

  // 2. Warm confidant pair (Clara & Mina, affinity 65) shares deterministically across seeds
  let transferredCount = 0;
  let simCloneA = structuredClone(world);
  let simCloneB = structuredClone(world);
  for (let slot = 0; slot < 8; slot++) {
    const outA = propagateEncounterGossipInPlace(simCloneA, ['clara', 'mina'], `enc_test_${slot}`);
    const outB = propagateEncounterGossipInPlace(simCloneB, ['clara', 'mina'], `enc_test_${slot}`);
    assert.deepEqual(outA, outB, 'Identical simSeed must produce identical gossip transfer');
    if (outA) transferredCount++;
  }
  assert.equal(transferredCount, 1, 'Same pair must gossip at most once on the same in-game day');
  assert.equal(simCloneA.npcRelations['clara:mina'].lastGossipDay, 1);

  const minaCopy = simCloneA.npcMemories!.mina.find((m) => m.eventId === 'ev_gift_clara');
  assert.ok(minaCopy);
  assert.equal(minaCopy.hopCount, 1);
  assert.equal(minaCopy.fromResidentId, 'clara');
  assert.equal(minaCopy.originResidentId, 'clara');
  assert.ok(minaCopy.confidence < 100);
  assert.ok(formatNpcMemorySummary(minaCopy).includes('Clara'));

  // 3. Hop cap prevents propagation beyond MAX_GOSSIP_HOPS (2)
  const hopWorld = withInitializedMemories(createFreshWorldState(), true);
  recordNpcMemoryInPlace(
    hopWorld.npcMemories!,
    'nora',
    createNpcMemoryEntry({
      id: 'ev_max_hop',
      eventId: 'ev_max_hop',
      tag: 'player_help_observed',
      category: 'interaction',
      subjectPlayer: true,
      subjectResidents: ['jun'],
      provenance: 'rumor',
      sourceKind: 'gossip',
      originResidentId: 'jun',
      fromResidentId: 'mina',
      hopCount: MAX_GOSSIP_HOPS,
      confidence: 45,
      createdDay: 1,
      createdMinute: 480,
      importance: 2,
      retention: 'ephemeral',
      valence: 'warm',
    }),
    1,
  );
  for (let s = 0; s < 12; s++) {
    // Even across 12 encounter IDs, hop >= MAX_GOSSIP_HOPS never transfers to confidant Sora
    const res = propagateEncounterGossipInPlace(hopWorld, ['nora', 'sora'], `enc_cap_${s}`);
    assert.equal(res, null);
  }
  assert.equal(hopWorld.npcMemories!.sora.some((m) => m.eventId === 'ev_max_hop'), false);

  // 4. Sensitivity gate blocks sharing friction with low-affinity pair (< 38) and prevents gossiping to target about self
  const frictionWorld = withInitializedMemories(createFreshWorldState(), true);
  // Make sora:toby merely acquainted (affinity 25 < 38) while nora:sora are warm (58 >= 38)
  frictionWorld.npcRelations['sora:toby'] = {
    pair: 'sora:toby',
    affinity: 25,
    tension: 0,
    sharedTags: [],
    lastInteractionDay: null,
  };
  recordNpcMemoryInPlace(
    frictionWorld.npcMemories!,
    'sora',
    createNpcMemoryEntry({
      id: 'ev_friction_jun',
      eventId: 'ev_friction_jun',
      tag: 'player_blunt',
      category: 'friction',
      subjectPlayer: true,
      subjectResidents: ['jun'],
      provenance: 'firsthand',
      sourceKind: 'witness',
      createdDay: 1,
      createdMinute: 510,
      importance: 4,
      retention: 'durable',
      valence: 'tense',
    }),
    1,
  );
  for (let s = 0; s < 10; s++) {
    const blocked = propagateEncounterGossipInPlace(frictionWorld, ['sora', 'toby'], `enc_fric_low_${s}`);
    assert.equal(blocked, null);
  }
  // Ensure StoryFlags & player Journal remain 100% untouched by gossip
  assert.deepEqual(frictionWorld.flags, world.flags);
  assert.deepEqual(frictionWorld.memories, world.memories);

  // Mark mentioned helper works cleanly
  markNpcMemoriesMentionedInPlace(simCloneA.npcMemories!, 'mina', { eventIds: ['ev_gift_clara'] });
  assert.equal(simCloneA.npcMemories!.mina.find((m) => m.eventId === 'ev_gift_clara')?.mentionedToPlayer, true);
});

test('Step 3.5: deliverHeldItemAction emits a single event (DUP-03), records gift + witness memories, and stays immutable', () => {
  let world = createFreshWorldState();
  world = pickupWorldPropAction(world, 'chalk_bundle').nextWorld;
  // Place Pip and Toby within LOCAL_WITNESS_RADIUS around (-4, -2), Mina far away
  world = {
    ...world,
    npcRuntime: {
      ...world.npcRuntime,
      pip: { ...world.npcRuntime.pip, position: { x: -4.0, z: -2.0 } },
      toby: { ...world.npcRuntime.toby, position: { x: -1.0, z: -2.0 } },
      mina: { ...world.npcRuntime.mina, position: { x: 14.0, z: 3.0 } },
    },
  };
  const beforeLenPip = world.npcMemories.pip.length;
  const { nextWorld } = deliverHeldItemAction(world, 'pip');

  // Input world untouched (pure/immutable)
  assert.equal(world.npcMemories.pip.length, beforeLenPip);

  // Single canonical player_help event (no duplicate help_ + story_ emission)
  const giftEvents = nextWorld.worldEvents.filter((e) => e.kind === 'player_help');
  assert.equal(giftEvents.length, 1);

  const pipGift = nextWorld.npcMemories.pip.find((m) => m.tag === 'player_gift');
  assert.ok(pipGift);
  assert.equal(pipGift.provenance, 'firsthand');
  assert.equal(pipGift.detail?.itemId, 'chalk_bundle');

  const tobyObserved = nextWorld.npcMemories.toby.find((m) => m.tag === 'player_help_observed');
  assert.ok(tobyObserved);
  assert.equal(tobyObserved.eventId, pipGift.eventId);

  assert.equal(nextWorld.npcMemories.mina.some((m) => m.eventId === pipGift.eventId), false);
});

test('Step 3.5: gazebo_bell inspect stays pure and performRingBellAction attributes dynamic visual vs acoustic witnesses (BUG-01)', () => {
  let world = createFreshWorldState();
  world = {
    ...world,
    weather: 'light_rain',
    flags: { ...world.flags, bellRestored: true, claraArthurReconciled: true },
    npcRuntime: {
      ...world.npcRuntime,
      // Pip outdoors right at Gazebo (0, -7) -> visual bell_ring witness
      pip: {
        ...world.npcRuntime.pip,
        position: { x: 0.5, z: -7.5 },
        currentActivityId: 'afternoon_gazebo',
        currentPlaceName: 'Old Bell Gazebo',
      },
      // Clara sheltered on Bakery Porch (-11, -6.8) -> acoustic bell_chime listener
      clara: {
        ...world.npcRuntime.clara,
        position: { x: -11.0, z: -6.8 },
        currentActivityId: 'clara_rain_oven',
        currentPlaceName: 'Bakery Porch',
      },
      // Arthur far away > 30m synthetic edge test (bell is at (0, -9.5), place at (22, 22) dist > 38m)
      arthur: {
        ...world.npcRuntime.arthur,
        position: { x: 22.0, z: 22.0 },
        currentActivityId: 'arthur_rain_bench',
        currentPlaceName: 'Copperwheel Cottage',
      },
    },
  };

  const inspectRes = interactWithProp(world, 'gazebo_bell');
  assert.equal(inspectRes.actionType, 'ring_bell');
  assert.equal(inspectRes.nextWorld.bellRungCount, 0);
  assert.equal(inspectRes.nextWorld.worldEvents.length, 0);

  const ringRes = performRingBellAction(world);
  assert.equal(ringRes.nextWorld.bellRungCount, 1);
  assert.equal(ringRes.nextWorld.worldEvents.length, 1);
  assert.equal(ringRes.nextWorld.worldEvents[0].kind, 'bell_ring');
  assert.ok(ringRes.nextWorld.worldEvents[0].actors.includes('pip'));
  assert.ok(ringRes.nextWorld.worldEvents[0].actors.includes('clara'));
  assert.equal(ringRes.nextWorld.worldEvents[0].actors.includes('arthur'), false);

  const pipMem = ringRes.nextWorld.npcMemories.pip.find((m) => m.tag === 'bell_ring');
  assert.ok(pipMem);
  assert.equal(pipMem.detail?.acousticOnly, false);

  const claraMem = ringRes.nextWorld.npcMemories.clara.find((m) => m.tag === 'bell_chime');
  assert.ok(claraMem);
  assert.equal(claraMem.detail?.acousticOnly, true);
  assert.equal(claraMem.subjectPlayer, false);
});

test('Step 3.5: applyDialogueChoice records friction, tier breakthroughs, and surfaced mentionedToPlayer immutably', () => {
  let world = createFreshWorldState();
  recordNpcMemoryInPlace(
    world.npcMemories,
    'jun',
    createNpcMemoryEntry({
      id: 'ev_surfaced_test',
      eventId: 'ev_surfaced_test',
      tag: 'fountain_fixed',
      category: 'event',
      subjectPlayer: true,
      subjectResidents: ['barnaby'],
      provenance: 'secondhand',
      sourceKind: 'gossip',
      fromResidentId: 'clara',
      createdDay: 1,
      createdMinute: 500,
    }),
    1,
  );

  const session: DialogueSession = {
    residentId: 'jun',
    currentNodeId: 'root',
    nodes: {},
    surfacedMemoryEventIds: [{ residentId: 'jun', eventId: 'ev_surfaced_test' }],
  };
  const choice: DialogueChoice = {
    id: 'test_blunt_and_mention',
    label: 'Hurry up.',
    nextNodeId: 'end',
    isNegative: true,
    setEmotion: 'frustrated',
  };

  const { nextWorld } = applyDialogueChoice(world, session, choice);
  assert.equal(
    world.npcMemories.jun.find((m) => m.eventId === 'ev_surfaced_test')?.mentionedToPlayer,
    false,
    'Input world npcMemories must remain unmutated',
  );
  assert.equal(
    nextWorld.npcMemories.jun.find((m) => m.eventId === 'ev_surfaced_test')?.mentionedToPlayer,
    true,
  );
  assert.equal(
    nextWorld.npcMemories.jun.some((m) => m.tag === 'player_blunt' && m.category === 'friction'),
    true,
  );
});

