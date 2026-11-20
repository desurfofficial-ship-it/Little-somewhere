import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SIM_SEED,
  migrateWorldState,
  sanitizeWorldState,
} from './migrations';
import {
  STORAGE_BACKUP_KEY,
  STORAGE_KEY,
  advanceToNextDay,
  computeWorldSaveRevision,
  createFreshWorldState,
  deserializeWorldState,
  loadWorldState,
  saveWorldState,
  serializeWorldState,
} from './storage';
import {
  MAX_NPC_MEMORIES_PER_RESIDENT,
  createNpcMemoryEntry,
} from './memories';
import { RESIDENT_ORDER } from './residents';
import { MAX_WORLD_EVENTS } from './relationships';
import { stepSimulation } from './simulation';
import { DAY_END_MINUTE, DAY_START_MINUTE, NEXT_DAY_WAKE_MINUTE } from './time';
import { PLAYER_SPAWN, isPointWalkable } from './worldMap';

function withMockLocalStorage(fn: (store: Map<string, string>) => void): void {
  const prevWindow = (globalThis as { window?: unknown }).window;
  const store = new Map<string, string>();
  const mockWindow = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => {
        store.set(key, String(val));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  };
  (globalThis as { window?: unknown }).window = mockWindow;
  try {
    fn(store);
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = prevWindow;
    }
  }
}

test('legacy v1 save migrates sequentially to v2 preserving progress, memories, flags, and trust', () => {
  const legacyV1Save = {
    day: 4,
    minuteOfDay: 1035,
    playerPos: { x: -1.5, z: -2.0 },
    playerFacing: 0.4,
    residents: {
      clara: { trust: 4, met: true, talkedToday: true, mood: 'warm', lastDialogueId: 'clara_thanks' },
      arthur: { trust: 3, met: true, talkedToday: false, mood: 'peaceful', lastDialogueId: null },
      mina: { trust: 2, met: true, talkedToday: false, mood: 'warm', lastDialogueId: null },
      jun: { trust: 2, met: true, talkedToday: true, mood: 'warm', lastDialogueId: null },
      barnaby: { trust: 1, met: true, talkedToday: false, mood: 'peaceful', lastDialogueId: null },
      sora: { trust: 1, met: false, talkedToday: false, mood: 'peaceful', lastDialogueId: null },
      toby: { trust: 1, met: false, talkedToday: false, mood: 'peaceful', lastDialogueId: null },
      nora: { trust: 2, met: true, talkedToday: false, mood: 'peaceful', lastDialogueId: null },
      pip: { trust: 1, met: true, talkedToday: true, mood: 'peaceful', lastDialogueId: null },
    },
    flags: {
      heardBellMystery: true,
      foundPostcard: true,
      deliveredPostcard: true,
      brewedChamomileTea: false,
      borrowedBarnabyLadder: true,
      clearedGazeboIvy: true,
      foundBrassClapper: true,
      repairedFountain: true,
      plantedMoonPetals: true,
      mediationStyle: 'gentle_truth',
      bellRestored: true,
      claraArthurReconciled: true,
      lanternsLit: true,
    },
    memories: [
      {
        id: 'mem_bell_restored',
        day: 4,
        phase: 'golden',
        title: 'The Gazebo Bell Sings Again',
        summary: 'Clara and Arthur watched the brass bell swing above the ivy-free spire.',
        residentId: 'arthur',
      },
    ],
    mailboxUnread: false,
    dailyLettersRead: [1, 2, 4],
    bellRungCount: 3,
  };

  const result = deserializeWorldState(JSON.stringify(legacyV1Save));
  assert.equal(result.migratedFromVersion, 1);
  assert.equal(result.state.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(result.state.simSeed, DEFAULT_SIM_SEED);
  assert.equal(result.state.day, 4);
  assert.equal(result.state.minuteOfDay, 1035);
  assert.equal(result.state.season, 'spring');
  assert.equal(result.state.weather, 'sunlit');
  assert.equal(result.state.flags.bellRestored, true);
  assert.equal(result.state.flags.mediationStyle, 'gentle_truth');
  assert.equal(result.state.residents.clara.trust, 4);
  assert.equal(result.state.memories.length, 1);
  assert.equal(result.state.bellRungCount, 3);
  assert.deepEqual(result.state.dailyLettersRead, [1, 2, 4]);

  // Reconciled Clara & Arthur Golden Hour slots should initialize in npcRuntime
  assert.equal(result.state.npcRuntime.clara.currentPlaceName, 'Gazebo Steps');
  assert.equal(result.state.npcRuntime.arthur.currentPlaceName, 'Gazebo Steps');
});

test('per-field sanitization clamps bad day/clock/trust and resets non-walkable positions', () => {
  const warnings: string[] = [];
  const sanitized = sanitizeWorldState(
    {
      schemaVersion: 2,
      day: -3,
      minuteOfDay: 2000,
      playerPos: { x: 2.0, z: 14.0 }, // Inside Mirror Pond!
      residents: {
        clara: { trust: 99, met: true, talkedToday: false, mood: 'unknown_mood', lastDialogueId: 123 },
      },
      npcRuntime: {
        pip: {
          position: { x: -14.0, z: 10.0 }, // Inside player cottage!
          animState: 'invalid_anim',
        },
      },
      flags: { mediationStyle: 'invalid_style', bellRestored: 'not_a_bool' },
    },
    warnings,
  );

  assert.equal(sanitized.day, 1);
  assert.equal(sanitized.minuteOfDay, DAY_END_MINUTE);
  assert.deepEqual(sanitized.playerPos, PLAYER_SPAWN);
  assert.equal(isPointWalkable(sanitized.npcRuntime.pip.position.x, sanitized.npcRuntime.pip.position.z), true);
  assert.equal(sanitized.npcRuntime.pip.animState, 'idle');
  assert.equal(sanitized.residents.clara.trust, 5);
  assert.equal(sanitized.residents.clara.mood, 'wistful');
  assert.equal(sanitized.flags.mediationStyle, 'none');
  assert.equal(sanitized.flags.bellRestored, false);
  assert.ok(warnings.length >= 2);

  // Lower bound clock check
  const early = sanitizeWorldState({ day: 1, minuteOfDay: 10 });
  assert.equal(early.minuteOfDay, DAY_START_MINUTE);
});

test('corrupt JSON falls back cleanly and v5 round-trip preserves state', () => {
  const corrupt = deserializeWorldState('{not valid json!!!');
  assert.equal(corrupt.migratedFromVersion, null);
  assert.equal(corrupt.state.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(corrupt.state.day, 1);

  const nonObject = migrateWorldState('hello');
  assert.equal(nonObject.migratedFromVersion, null);

  const fresh = createFreshWorldState();
  const roundTrip = deserializeWorldState(serializeWorldState(fresh));
  assert.equal(roundTrip.migratedFromVersion, CURRENT_SCHEMA_VERSION);
  assert.deepEqual(roundTrip.state, fresh);
});

test('legacy v2 save migrates sequentially to v3 with props, posture, needs, and sideFlags', () => {
  const v2Save = {
    schemaVersion: 2,
    simSeed: DEFAULT_SIM_SEED,
    regionId: 'willow_square',
    day: 3,
    minuteOfDay: 720,
    season: 'spring',
    weather: 'breezy',
    playerPos: { x: 0, z: 4.5 },
    playerFacing: 0.2,
    residents: {
      pip: { trust: 3, met: true, talkedToday: false, mood: 'joyful', lastDialogueId: null },
    },
    flags: { heardBellMystery: true },
  };
  const res = deserializeWorldState(JSON.stringify(v2Save));
  assert.equal(res.migratedFromVersion, 2);
  assert.equal(res.state.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(res.state.playerPosture, 'standing');
  assert.equal(res.state.playerHeldItem, null);
  assert.ok(res.state.worldProps.water_pail);
  assert.equal(res.state.residents.pip.trust, 3);
  assert.equal(typeof res.state.npcRuntime.pip.needs.energy, 'number');
  assert.equal(typeof res.state.playerRelations.pip.reliability, 'number');
});

test('advanceToNextDay advances season at day 11, resets npcRuntime to 8:00 AM, and returns gifted props to homePos', () => {
  let state = createFreshWorldState();
  state = {
    ...state,
    day: 10,
    minuteOfDay: 1220,
    worldProps: {
      ...state.worldProps,
      water_pail: {
        ...state.worldProps.water_pail,
        holder: 'mina',
        pos: { x: 8.6, z: 2.0 },
      },
    },
  };
  const day11 = advanceToNextDay(state);

  assert.equal(day11.day, 11);
  assert.equal(day11.minuteOfDay, NEXT_DAY_WAKE_MINUTE);
  assert.equal(day11.season, 'summer');
  assert.equal(day11.npcRuntime.pip.currentPlaceName, 'Fountain Plaza');
  assert.equal(day11.mailboxUnread, true);
  assert.equal(day11.worldProps.water_pail.holder, 'world');
  assert.deepEqual(day11.worldProps.water_pail.pos, day11.worldProps.water_pail.homePos);
});

test('regionId defaults cleanly and sparse non-baseline npcRelations survive sanitization', () => {
  const sanitized = sanitizeWorldState({
    schemaVersion: 2,
    regionId: 'unknown_future_region',
    npcRelations: {
      'barnaby:sora': {
        pair: 'barnaby:sora',
        affinity: 44,
        tension: 2,
        sharedTags: ['bench_repair'],
        lastInteractionDay: 5,
      },
    },
  });

  assert.equal(sanitized.regionId, 'willow_square');
  assert.equal(sanitized.npcRelations['barnaby:sora']?.affinity, 44);
  assert.deepEqual(sanitized.npcRelations['barnaby:sora']?.sharedTags, ['bench_repair']);
});

test('computeWorldSaveRevision detects every meaningful persisted mutation while ignoring walkPhase jitter', () => {
  const base = createFreshWorldState();
  const rev0 = computeWorldSaveRevision(base);

  // Ephemeral walkPhase / stuckSeconds must NOT change save revision
  const jitter = structuredClone(base);
  jitter.npcRuntime.pip.walkPhase = 4.123;
  jitter.npcRuntime.pip.stuckSeconds = 0.04;
  assert.equal(computeWorldSaveRevision(jitter), rev0);

  // 1. NPC runtime position & activity change (even within same integer minute)
  const npcMoved = structuredClone(base);
  npcMoved.npcRuntime.pip.position.x += 0.35;
  assert.notEqual(computeWorldSaveRevision(npcMoved), rev0);

  const npcActivity = structuredClone(base);
  npcActivity.npcRuntime.pip.currentActivityId = 'morning:custom_chore';
  assert.notEqual(computeWorldSaveRevision(npcActivity), rev0);

  // 2. Story flags change
  const flagChanged = structuredClone(base);
  flagChanged.flags.heardBellMystery = true;
  assert.notEqual(computeWorldSaveRevision(flagChanged), rev0);

  // 3. Resident met / trust / mood / talkedToday change
  const residentChanged = structuredClone(base);
  residentChanged.residents.clara.met = true;
  assert.notEqual(computeWorldSaveRevision(residentChanged), rev0);

  // 4. Player & NPC relationship metrics change
  const relChanged = structuredClone(base);
  relChanged.playerRelations.jun.affinity += 10;
  assert.notEqual(computeWorldSaveRevision(relChanged), rev0);

  const npcRelChanged = structuredClone(base);
  npcRelChanged.npcRelations['clara:mina'].affinity += 3;
  assert.notEqual(computeWorldSaveRevision(npcRelChanged), rev0);

  // 5. Mailbox & daily letters read change
  const mailboxChanged = structuredClone(base);
  mailboxChanged.mailboxUnread = false;
  mailboxChanged.dailyLettersRead = [1];
  assert.notEqual(computeWorldSaveRevision(mailboxChanged), rev0);

  // 6. Capped worldEvents replacement still bumps revision
  const cappedA = structuredClone(base);
  cappedA.worldEvents = Array.from({ length: MAX_WORLD_EVENTS }, (_, idx) => ({
    id: `ev_${idx}`,
    day: 1,
    phase: 'morning',
    minuteOfDay: 480,
    kind: 'npc_social',
    actors: ['pip', 'jun'],
    summary: 'Chat',
    summaryTag: 'chat',
  }));
  const cappedB = structuredClone(cappedA);
  cappedB.worldEvents.pop();
  cappedB.worldEvents.unshift({
    id: 'ev_brand_new',
    day: 1,
    phase: 'morning',
    minuteOfDay: 495,
    kind: 'npc_social',
    actors: ['clara', 'mina'],
    summary: 'New chat',
    summaryTag: 'new_chat',
  });
  assert.notEqual(computeWorldSaveRevision(cappedA), computeWorldSaveRevision(cappedB));
});

test('saveWorldState normalizes through serializeWorldState and loadWorldState preserves full simulation & v1 backup migration', () => {
  withMockLocalStorage((store) => {
    // 1. Mid-simulation state with active movement, relations, mailbox, and story flags round-trips faithfully
    let sim = createFreshWorldState();
    sim = {
      ...sim,
      day: 3,
      season: 'spring',
      weather: 'breezy',
      minuteOfDay: 700,
      mailboxUnread: false,
      dailyLettersRead: [1, 3],
      bellRungCount: 2,
      flags: { ...sim.flags, heardBellMystery: true, repairedFountain: true },
      residents: {
        ...sim.residents,
        pip: { ...sim.residents.pip, met: true, trust: 2, talkedToday: true, mood: 'joyful' },
      },
      playerRelations: {
        ...sim.playerRelations,
        pip: { ...sim.playerRelations.pip, affinity: 40, familiarity: 14, talkedCount: 3, lastTalkDay: 3 },
      },
    };
    for (let i = 0; i < 40; i++) {
      sim = stepSimulation(sim, 0.25);
    }

    const res = saveWorldState(sim);
    assert.equal(res.ok, true);
    const loaded = loadWorldState();
    assert.deepEqual(loaded, sim);

    // 2. saveWorldState sanitizes out-of-range fields cleanly on write
    const dirty = structuredClone(sim);
    dirty.residents.clara.trust = 99;
    dirty.playerPos = { x: 2.0, z: 14.0 }; // Pond water
    saveWorldState(dirty);
    const cleanedLoaded = loadWorldState();
    assert.equal(cleanedLoaded.residents.clara.trust, 5);
    assert.deepEqual(cleanedLoaded.playerPos, PLAYER_SPAWN);

    // 3. Legacy v1 payload creates backup and upgrades STORAGE_KEY to schemaVersion 4
    const legacyV1 = {
      day: 2,
      minuteOfDay: 540,
      playerPos: { x: -8.5, z: 9.5 },
      residents: {
        pip: { trust: 2, met: true, talkedToday: true, mood: 'warm', lastDialogueId: 'pip_hint' },
      },
      flags: { heardBellMystery: true },
      memories: [
        {
          id: 'mem_arrival',
          day: 1,
          phase: 'morning',
          title: 'Arrival',
          summary: 'Arrived in Willow Lane.',
        },
      ],
    };
    store.set(STORAGE_KEY, JSON.stringify(legacyV1));
    const upgraded = loadWorldState();
    assert.equal(upgraded.schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.equal(upgraded.day, 2);
    assert.equal(upgraded.flags.heardBellMystery, true);
    assert.equal(upgraded.residents.pip.trust, 2);
    assert.equal(store.get(STORAGE_BACKUP_KEY), JSON.stringify(legacyV1));
    const storedUpgraded = JSON.parse(store.get(STORAGE_KEY) ?? '{}');
    assert.equal(storedUpgraded.schemaVersion, CURRENT_SCHEMA_VERSION);
  });
});

test('v3->v4 migration hydrates strictly save-backed evidence without manufacturing firsthand memories for uninvolved residents', () => {
  const v3Save = {
    schemaVersion: 3,
    day: 5,
    minuteOfDay: 780,
    residents: {
      barnaby: { trust: 3, met: true, talkedToday: false, mood: 'warm', lastDialogueId: null },
      arthur: { trust: 3, met: true, talkedToday: false, mood: 'peaceful', lastDialogueId: null },
      pip: { trust: 2, met: true, talkedToday: false, mood: 'joyful', lastDialogueId: null },
      toby: { trust: 1, met: true, talkedToday: false, mood: 'peaceful', lastDialogueId: null },
    },
    flags: {
      repairedFountain: true,
      bellRestored: true,
      foundBrassClapper: true,
      claraArthurReconciled: false,
    },
    // No mem_brass_clapper residentId -> must NOT manufacture firsthand clapper memory on Toby
    memories: [
      {
        id: 'mem_arrival',
        day: 1,
        phase: 'morning',
        title: 'Arrival',
        summary: 'Arrived.',
      },
    ],
    // Buggy v3 bell_ring with hardcoded actors must NOT manufacture bell memories
    worldEvents: [
      {
        id: 'bell_5_1',
        day: 5,
        phase: 'afternoon',
        minuteOfDay: 760,
        kind: 'bell_ring',
        actors: ['clara', 'arthur', 'pip'],
        summary: 'Bell rang',
        summaryTag: 'bell_chime',
      },
    ],
  };

  const res = deserializeWorldState(JSON.stringify(v3Save));
  assert.equal(res.migratedFromVersion, 3);
  assert.equal(res.state.schemaVersion, CURRENT_SCHEMA_VERSION);

  // Sole-author evidence present
  assert.ok(res.state.npcMemories.barnaby.some((m) => m.tag === 'fountain_fixed' && m.provenance === 'firsthand'));
  assert.ok(res.state.npcMemories.arthur.some((m) => m.tag === 'bell_restored' && m.provenance === 'firsthand'));

  // Zero manufactured firsthand memories on Pip or Toby without save evidence
  assert.equal(res.state.npcMemories.pip.length, 0);
  assert.equal(res.state.npcMemories.toby.length, 0);
  assert.equal(res.state.npcMemories.clara.some((m) => m.tag === 'bell_chime'), false);

  // Backup also written when loaded through localStorage
  withMockLocalStorage((store) => {
    const rawV3 = JSON.stringify(v3Save);
    store.set(STORAGE_KEY, rawV3);
    const loaded = loadWorldState();
    assert.equal(loaded.schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.equal(store.get(STORAGE_BACKUP_KEY), rawV3);
  });
});

test('sanitizeWorldState cleans malformed npcMemories and gossip relation fields safely', () => {
  const warnings: string[] = [];
  const sanitized = sanitizeWorldState(
    {
      schemaVersion: 4,
      day: 8,
      minuteOfDay: 600,
      npcRelations: {
        'clara:mina': {
          pair: 'clara:mina',
          affinity: 45,
          tension: 4,
          sharedTags: [],
          lastInteractionDay: 7,
          lastGossipDay: 7,
          lastGossipMinute: 9999,
          lastGossipEventId: 'ev_1',
        },
      },
      npcMemories: {
        unknown_neighbor: [{ id: 'x', eventId: 'x', tag: 'x' }],
        mina: [
          { id: '', eventId: 'bad', tag: 'bad' },
          {
            id: 'ev_a',
            eventId: 'ev_a',
            tag: 'tea',
            category: 'invalid_cat',
            provenance: 'secondhand',
            fromResidentId: 'mina', // self-sender stripped
            hopCount: 99,
            confidence: 999,
            createdDay: 6,
            createdMinute: 500,
            learnedDay: 7,
            retention: 'ephemeral',
            expiresDay: 20,
          },
          {
            id: 'ev_a', // duplicate id dropped
            eventId: 'ev_a',
            tag: 'tea',
            createdDay: 6,
            createdMinute: 500,
          },
          {
            id: 'ev_expired',
            eventId: 'ev_expired',
            tag: 'old_rumor',
            provenance: 'rumor',
            retention: 'ephemeral',
            createdDay: 1,
            createdMinute: 500,
            learnedDay: 1,
            expiresDay: 5, // current day 8 > 5 -> dropped
          },
        ],
      },
    },
    warnings,
  );

  assert.equal((sanitized.npcMemories as Record<string, unknown>).unknown_neighbor, undefined);
  assert.equal(sanitized.npcMemories.mina.length, 1);
  assert.equal(sanitized.npcMemories.mina[0].fromResidentId, undefined);
  assert.equal(sanitized.npcMemories.mina[0].hopCount, 2);
  assert.equal(sanitized.npcMemories.mina[0].confidence, 95);
  assert.equal(sanitized.npcMemories.mina[0].category, 'event');
  assert.equal(sanitized.npcRelations['clara:mina'].lastGossipDay, 7);
  assert.equal(sanitized.npcRelations['clara:mina'].lastGossipMinute, DAY_END_MINUTE);
  assert.ok(warnings.length >= 2);
});

test('computeWorldSaveRevision tracks npcMemories & gossip cooldowns, and advanceToNextDay prunes strictly by in-game day', () => {
  const base = createFreshWorldState();
  const rev0 = computeWorldSaveRevision(base);

  const memAdded = structuredClone(base);
  memAdded.npcMemories.mina.push(
    createNpcMemoryEntry({
      id: 'ev_temp_rumor',
      eventId: 'ev_temp_rumor',
      tag: 'temp_rumor',
      category: 'event',
      provenance: 'rumor',
      sourceKind: 'gossip',
      fromResidentId: 'clara',
      createdDay: 1,
      createdMinute: 540,
      learnedDay: 1,
      expiresDay: 2,
      retention: 'ephemeral',
    }),
  );
  const revMem = computeWorldSaveRevision(memAdded);
  assert.notEqual(revMem, rev0);

  const memMentioned = structuredClone(memAdded);
  memMentioned.npcMemories.mina[0].mentionedToPlayer = true;
  assert.notEqual(computeWorldSaveRevision(memMentioned), revMem);

  const relGossiped = structuredClone(base);
  relGossiped.npcRelations['clara:mina'].lastGossipDay = 1;
  assert.notEqual(computeWorldSaveRevision(relGossiped), rev0);

  // Advance day 1 -> day 2 (still <= expiresDay 2) keeps rumor; day 2 -> day 3 prunes it, preserves permanent & Journal memories
  const day2 = advanceToNextDay(memAdded);
  assert.equal(day2.day, 2);
  assert.ok(day2.npcMemories.mina.some((m) => m.id === 'ev_temp_rumor'));
  const day3 = advanceToNextDay(day2);
  assert.equal(day3.day, 3);
  assert.equal(day3.npcMemories.mina.some((m) => m.id === 'ev_temp_rumor'), false);
  assert.ok(day3.npcMemories.clara.some((m) => m.retention === 'permanent'));
  assert.equal(day3.memories.length, base.memories.length);
});

test('bounded npcMemories keeps a full-resident save compact and scales safely to 25 residents', () => {
  const full = createFreshWorldState();
  for (const id of RESIDENT_ORDER) {
    full.npcMemories[id] = [];
    for (let i = 0; i < MAX_NPC_MEMORIES_PER_RESIDENT; i++) {
      full.npcMemories[id].push(
        createNpcMemoryEntry({
          id: `ev_${id}_${i}`,
          eventId: `ev_${id}_${i}`,
          tag: 'player_gift',
          category: 'interaction',
          subjectPlayer: true,
          subjectResidents: [id],
          provenance: 'secondhand',
          sourceKind: 'gossip',
          fromResidentId: id === 'clara' ? 'mina' : 'clara',
          createdDay: 1 + i,
          createdMinute: 540 + i * 5,
          detail: { itemId: 'chalk_bundle', placeName: 'Fountain Plaza' },
        }),
      );
    }
  }

  const baseBytes = serializeWorldState(createFreshWorldState()).length;
  const serializedBytes = serializeWorldState(full).length;
  const memDeltaBytes = serializedBytes - baseBytes;
  const residentCount = RESIDENT_ORDER.length;
  // Bound scales with the registry so a growing population stays honest:
  // 9 residents measured ~68.5KB, 10 residents measured ~76.5KB (~8.5KB/resident).
  const memBudgetBytes = Math.ceil(residentCount * 8_500 * 1.1);
  const saveBudgetBytes = Math.ceil(memBudgetBytes + 25_000);
  assert.ok(
    memDeltaBytes < memBudgetBytes,
    `Expected ${residentCount}-resident npcMemories payload < ${(memBudgetBytes / 1000).toFixed(0)}KB, got ${memDeltaBytes}`,
  );
  assert.ok(
    serializedBytes < saveBudgetBytes,
    `Expected full ${residentCount}-resident v5 save < ${(saveBudgetBytes / 1000).toFixed(0)}KB, got ${serializedBytes}`,
  );

  // Synthetic 25-resident extrapolation check (same per-resident memory payload)
  const memJsonBytes = JSON.stringify(full.npcMemories).length;
  const scaled25Bytes = serializedBytes + Math.ceil((memJsonBytes / residentCount) * 16);
  assert.ok(scaled25Bytes < 220_000, `Expected 25-resident extrapolated save < 220KB, got ${scaled25Bytes}`);
});

test('v4->v5 migration hydrates storyline progress from legacy sideFlags without manufacturing npcMemories', () => {
  const v4Save = {
    schemaVersion: 4,
    day: 6,
    minuteOfDay: 720,
    flags: {
      heardBellMystery: true,
      lanternsLit: true,
    },
    sideFlags: {
      pipZineStarted: true,
      herbLoafStarted: true,
      herbLoafShared: true,
      herbLoafStyle: 'tea_basket',
    },
    npcMemories: {
      mina: [
        {
          id: 'ev_v4_mina',
          eventId: 'ev_v4_mina',
          tag: 'moon_petals',
          category: 'event',
          provenance: 'firsthand',
          sourceKind: 'participant',
          createdDay: 4,
          createdMinute: 600,
          learnedDay: 4,
          learnedMinute: 600,
          retention: 'durable',
        },
      ],
    },
  };

  const res = deserializeWorldState(JSON.stringify(v4Save));
  assert.equal(res.migratedFromVersion, 4);
  assert.equal(res.state.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(res.state.storylines.side_pip_zine.status, 'active');
  assert.equal(res.state.storylines.side_pip_zine.stage, 1);
  assert.equal(res.state.storylines.side_herb_loaf.status, 'completed');
  assert.equal(res.state.storylines.side_herb_loaf.stage, 3);
  assert.equal(res.state.storylines.side_herb_loaf.outcome, 'tea_basket');
  assert.equal(res.state.storylines.conflict_plaza_lanterns.status, 'available');
  assert.equal(res.state.storylines.conflict_plaza_lanterns.stage, 0);

  // V4 npcMemories preserved cleanly without fabricating memories for uninvolved residents
  assert.ok(res.state.npcMemories.mina.some((m) => m.id === 'ev_v4_mina'));
  assert.equal(res.state.npcMemories.nora.length, 0);

  // Backup written during v4 -> v5 localStorage upgrade
  withMockLocalStorage((store) => {
    const rawV4 = JSON.stringify(v4Save);
    store.set(STORAGE_KEY, rawV4);
    const loaded = loadWorldState();
    assert.equal(loaded.schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.equal(store.get(STORAGE_BACKUP_KEY), rawV4);
  });
});

test('sanitizeStorylines clamps bad entries, preserves cooldowns, and computeWorldSaveRevision tracks storyline edits', () => {
  const warnings: string[] = [];
  const sanitized = sanitizeWorldState(
    {
      schemaVersion: 5,
      day: 4,
      minuteOfDay: 600,
      storylines: {
        bad_entry: 'not_an_object',
        conflict_plaza_lanterns: {
          id: 'conflict_plaza_lanterns',
          stage: 99, // clamped to 3
          status: 'active',
          outcome: 'bridge_compromise',
          cooldownUntilDay: 6,
          notes: ['a', '', 'b', 'c', 'd', 'e', 'f', 'g'],
        },
      },
    },
    warnings,
  );

  assert.equal(sanitized.storylines.conflict_plaza_lanterns.stage, 3);
  assert.equal(sanitized.storylines.conflict_plaza_lanterns.cooldownUntilDay, 6);
  assert.equal(sanitized.storylines.conflict_plaza_lanterns.notes?.length, 6);
  assert.ok(warnings.some((w) => w.includes('bad_entry')));

  const base = createFreshWorldState();
  const rev0 = computeWorldSaveRevision(base);
  const edited = structuredClone(base);
  edited.storylines.conflict_plaza_lanterns.stage = 2;
  edited.storylines.conflict_plaza_lanterns.status = 'active';
  edited.storylines.conflict_plaza_lanterns.cooldownUntilDay = 5;
  assert.notEqual(computeWorldSaveRevision(edited), rev0);

  const roundTrip = deserializeWorldState(serializeWorldState(edited));
  assert.equal(roundTrip.state.storylines.conflict_plaza_lanterns.cooldownUntilDay, 5);
});

test('v5->v6 migration upgrades cleanly with backup and computeWorldSaveRevision tracks v6 cottage & satchel edits', () => {
  const v5Save = {
    schemaVersion: 5,
    day: 4,
    minuteOfDay: 840,
    playerPos: { x: 0, z: 4.5 },
    flags: { heardBellMystery: true, bellRestored: true },
    storylines: {
      side_pip_zine: { id: 'side_pip_zine', stage: 2, status: 'active' },
    },
    residents: {
      rowan: { trust: 2, met: true, talkedToday: false, mood: 'warm', lastDialogueId: null },
    },
  };

  const res = deserializeWorldState(JSON.stringify(v5Save));
  assert.equal(res.migratedFromVersion, 5);
  assert.equal(res.state.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(res.state.playerLocation, 'exterior');
  assert.equal(res.state.inventory.chamomile_blossom, 1);
  assert.equal(res.state.inventory.lemon_thyme, 1);
  assert.ok(res.state.discoveredItemIds.includes('chamomile_blossom'));
  assert.equal(res.state.cottageState.placedFlowerId, null);
  assert.equal(res.state.dailyActivities.bakedCountToday, 0);
  assert.equal(res.state.storylines.side_pip_zine.stage, 2);
  assert.equal(res.state.residents.rowan.trust, 2);

  withMockLocalStorage((store) => {
    const rawV5 = JSON.stringify(v5Save);
    store.set(STORAGE_KEY, rawV5);
    const loaded = loadWorldState();
    assert.equal(loaded.schemaVersion, CURRENT_SCHEMA_VERSION);
    assert.equal(store.get(STORAGE_BACKUP_KEY), rawV5);
  });

  // Save revision tracks Milestone 2C mutations
  const base = createFreshWorldState();
  const rev0 = computeWorldSaveRevision(base);

  const invEdited = structuredClone(base);
  invEdited.inventory.crabapple = 2;
  invEdited.discoveredItemIds.push('crabapple');
  assert.notEqual(computeWorldSaveRevision(invEdited), rev0);

  const vaseEdited = structuredClone(base);
  vaseEdited.cottageState.placedFlowerId = 'chamomile_blossom';
  assert.notEqual(computeWorldSaveRevision(vaseEdited), rev0);

  const keepsakeEdited = structuredClone(base);
  keepsakeEdited.cottageState.displayedKeepsakeIds = ['willow_zine_copy'];
  assert.notEqual(computeWorldSaveRevision(keepsakeEdited), rev0);

  const locationEdited = structuredClone(base);
  locationEdited.playerLocation = 'cottage_interior';
  assert.notEqual(computeWorldSaveRevision(locationEdited), rev0);

  const activityEdited = structuredClone(base);
  activityEdited.dailyActivities.giftedResidentsToday = ['clara'];
  assert.notEqual(computeWorldSaveRevision(activityEdited), rev0);

  // Rolling over a day preserves home decor and satchel while resetting daily activities
  const decorated = {
    ...vaseEdited,
    inventory: { ...vaseEdited.inventory, willow_zine_copy: 1 },
    cottageState: {
      ...vaseEdited.cottageState,
      displayedKeepsakeIds: ['willow_zine_copy' as const],
      almanacReadToday: true,
    },
    dailyActivities: {
      ...vaseEdited.dailyActivities,
      bakedCountToday: 2,
      orchardHarvestedToday: true,
      giftedResidentsToday: ['clara' as const],
    },
  };
  const nextDay = advanceToNextDay(decorated);
  assert.equal(nextDay.cottageState.placedFlowerId, 'chamomile_blossom');
  assert.deepEqual(nextDay.cottageState.displayedKeepsakeIds, ['willow_zine_copy']);
  assert.equal(nextDay.inventory.willow_zine_copy, 1);
  assert.equal(nextDay.cottageState.almanacReadToday, false);
  assert.equal(nextDay.dailyActivities.bakedCountToday, 0);
  assert.equal(nextDay.dailyActivities.orchardHarvestedToday, false);
  assert.deepEqual(nextDay.dailyActivities.giftedResidentsToday, []);
});

// ---------------------------------------------------------------------------
// LR-1 acceptance tests — save/load reconciliation & migration (test-first).
//
// Spec of record: docs/architecture/living-relationships/14-revised-architecture.md
// Test plan:      docs/architecture/living-relationships/16-lr1-lr2-acceptance-test-plan.md (§3, §5)
//
// Scope of this change (LR-1 test authoring only):
//  - NO production code is implemented here. Every case below drives ONLY the
//    existing production load path (saveWorldState/loadWorldState/deserializeWorldState).
//  - The proposed LR state slices (world.invitations / world.occupancy / world.teaching /
//    world.activeActivity — doc 16 §0.1) are staged through raw save payloads; no
//    WorldState schema, migration, or sanitizer code is modified by this change.
//  - Failure attribution: sanitizeWorldState currently drops every unknown top-level
//    field, so positive-restoration cases (LR1-14, LR1-15b step A) fail with an explicit
//    "MISSING LR-1 PRODUCTION" report until the slices persist, while clear-cases
//    (LR1-15b step B, LR1-16) are gated behind that preservation check so they cannot
//    pass vacuously through field dropping.
//  - Version policy (doc 14 §9; doc 16 §6): no test hardcodes a future schema version.
//    The pre-LR fixture version is derived from CURRENT_SCHEMA_VERSION plus a probe
//    that detects whether the LR slices have landed, so these cases stay correct both
//    before the LR merge (red, by design) and after it (green).
// ---------------------------------------------------------------------------

const LR_INVITE_ID = 'lr_test_invite_1';
const LR_ACTIVITY_ID = 'share_featured_reading';

type LrSavePayload = Record<string, unknown>;

interface LrActiveInviteView {
  id?: string;
  status?: string;
  hostId?: string;
  activityId?: string;
  offeredDay?: number;
  expiresDay?: number;
  windowStartMinute?: number;
  windowEndMinute?: number;
}

interface LrInvitationStateView {
  active?: LrActiveInviteView | null;
  history?: Array<Record<string, unknown>>;
  lastOfferDayByHost?: Record<string, number>;
}

/** The proposed LR-1 slice names (doc 16 §0.1) as they appear in raw save payloads. */
const LR_SLICE_KEYS = ['invitations', 'occupancy', 'teaching', 'activeActivity'] as const;

/** True once the runtime world carries the proposed LR slices (i.e. after the LR
 *  merge has landed). Used only to derive the pre-LR fixture version dynamically. */
function worldHasLrSlices(state: Record<string, unknown>): boolean {
  return 'invitations' in state;
}

function craftLiveAcceptedInvite(day: number): LrActiveInviteView {
  return {
    id: LR_INVITE_ID,
    status: 'accepted',
    hostId: 'nora',
    activityId: LR_ACTIVITY_ID,
    offeredDay: day,
    expiresDay: day,
    windowStartMinute: 600,
    windowEndMinute: 780,
  };
}

test('LR1-14: save/load round-trip restores a live offered invitation intact', () => {
  withMockLocalStorage(() => {
    const base = createFreshWorldState();
    const day = base.day;
    const offered = {
      id: LR_INVITE_ID,
      status: 'offered',
      hostId: 'nora',
      activityId: LR_ACTIVITY_ID,
      offeredDay: day,
      expiresDay: day,
      windowStartMinute: 600,
      windowEndMinute: 780,
    };
    const staged = {
      ...structuredClone(base),
      minuteOfDay: 700, // inside [600, 780]
      playerLocation: 'exterior' as const, // doc 16 LR1-14 precondition
      invitations: { active: offered, history: [], lastOfferDayByHost: { nora: day } },
    } as unknown as LrSavePayload;

    const saved = saveWorldState(staged as unknown as ReturnType<typeof createFreshWorldState>);
    assert.equal(saved.ok, true, 'save accepts the staged LR-1 state');
    const loaded = loadWorldState();

    // The loaded schemaVersion must be the runtime's current (post-LR at merge) —
    // expressed via the imported constant, never a hardcoded future number (doc 16 §6).
    assert.equal(loaded.schemaVersion, CURRENT_SCHEMA_VERSION, 'load lands on the runtime version');

    const slices = loaded as unknown as { invitations?: LrInvitationStateView };
    const active = slices.invitations?.active;
    assert.ok(
      active,
      'MISSING LR-1 PRODUCTION: the proposed invitations slice does not survive the ' +
        'save/load round-trip (sanitizeWorldState drops it today), so a live offered ' +
        'invite is lost on reload — doc 14 §9 policy 4 + doc 16 LR1-14. Do not satisfy ' +
        'this from the test side.',
    );
    assert.equal(active?.id, LR_INVITE_ID, 'active restored with the same id');
    assert.equal(active?.status, 'offered', 'status not flipped by load (doc 16 LR1-14 fail line)');
    assert.equal(active?.hostId, 'nora', 'active restored with the same host');
    assert.equal(active?.windowStartMinute, 600, 'window start restored');
    assert.equal(active?.windowEndMinute, 780, 'window end restored');
    assert.equal(
      slices.invitations?.lastOfferDayByHost?.nora,
      day,
      'lastOfferDayByHost survives reload so spacing enforcement persists (doc 14 §2.1)',
    );
  });
});

test('LR1-15b: load clears an orphan activeActivity (doc 16 §3)', () => {
  withMockLocalStorage(() => {
    const base = createFreshWorldState();
    const day = base.day;

    // Step A — discriminating gate: activeActivity is set alongside a live accepted
    // invite (non-orphan). Doc 14 §4.3 clears activeActivity only when active is null,
    // so a faithful invariant must PRESERVE the field here. Fails today because the
    // sanitizer drops the slice entirely — the same positive-restoration gate LR1-15 uses.
    const consistent = deserializeWorldState(
      JSON.stringify({
        ...structuredClone(base),
        minuteOfDay: 700,
        playerLocation: 'nook_interior',
        invitations: {
          active: craftLiveAcceptedInvite(day),
          history: [],
          lastOfferDayByHost: { nora: day },
        },
        activeActivity: { activityId: LR_ACTIVITY_ID, invitationId: LR_INVITE_ID },
      }),
    );
    const preserved = (
      consistent.state as unknown as { activeActivity?: { activityId?: string } | null }
    ).activeActivity;
    assert.ok(
      preserved && preserved.activityId === LR_ACTIVITY_ID,
      'MISSING LR-1 PRODUCTION: the load sanitizer drops the proposed activeActivity slice ' +
        'entirely, so the doc 14 §4.3 orphan rule cannot be discriminated from field dropping ' +
        '— a mid-visit activeActivity must survive load first (doc 16 LR1-15b)',
    );

    // Step B — the case itself: activeActivity set while invitations.active is null.
    const orphaned = deserializeWorldState(
      JSON.stringify({
        ...structuredClone(base),
        minuteOfDay: 700,
        playerLocation: 'nook_interior',
        invitations: { active: null, history: [], lastOfferDayByHost: { nora: day } },
        activeActivity: { activityId: LR_ACTIVITY_ID, invitationId: LR_INVITE_ID },
      }),
    );
    const cleared = (
      orphaned.state as unknown as { activeActivity?: { activityId?: string } | null }
    ).activeActivity;
    assert.ok(
      cleared === null || cleared === undefined,
      'orphan activeActivity must be cleared when active is null (doc 14 §4.3)',
    );
    // Other slices intact (doc 16 LR1-15b: "Other slices intact"):
    assert.ok(orphaned.state.nookState, 'nook slice intact');
    assert.equal(
      orphaned.state.playerRelations.nora.affinity,
      base.playerRelations.nora.affinity,
      'relations intact',
    );
    assert.equal(orphaned.state.memories.length, base.memories.length, 'journal intact');
  });
});

test('LR1-16: load sanitizes an invitation with an unknown host id without crashing', () => {
  withMockLocalStorage(() => {
    const base = createFreshWorldState();
    const day = base.day;
    const corrupted = deserializeWorldState(
      JSON.stringify({
        ...structuredClone(base),
        minuteOfDay: 700,
        playerLocation: 'exterior',
        invitations: {
          active: {
            ...craftLiveAcceptedInvite(day),
            id: 'corrupt_invite_unknown',
            hostId: 'definitely_not_a_resident',
          },
          history: [],
          lastOfferDayByHost: {},
        },
      }),
    );

    // Discriminator: the runtime must actually model the invitations slice (key present)
    // — otherwise "active cleared" would pass vacuously through field dropping.
    const slices = corrupted.state as unknown as { invitations?: LrInvitationStateView };
    assert.ok(
      'invitations' in (corrupted.state as unknown as Record<string, unknown>),
      'MISSING LR-1 PRODUCTION: the WorldState does not model the invitations slice yet, so ' +
        'a corrupted invite cannot be recognized and cleared by the sanitizer (doc 14 §4.3; ' +
        'doc 16 LR1-16)',
    );
    const active = slices.invitations?.active;
    assert.ok(
      active === null || active === undefined,
      `corrupted invite (unknown host id) must be cleared on load, got ${JSON.stringify(active)}`,
    );
    // Rest of world intact (doc 16 LR1-16: "nookState, relations, memories"):
    assert.ok(corrupted.state.nookState, 'nookState intact');
    assert.equal(
      corrupted.state.playerRelations.nora.affinity,
      base.playerRelations.nora.affinity,
      'relations intact',
    );
    assert.equal(corrupted.state.memories.length, base.memories.length, 'memories intact');
  });
});

test('LR1-17: migration from the current canonical save seeds empty LR slices and preserves interiors', () => {
  const base = createFreshWorldState();
  const baseRecord = base as unknown as LrSavePayload;
  // Pre-LR version: today the chain still ends at CURRENT_SCHEMA_VERSION, so the fixture
  // is at CURRENT; once the LR merge lands (and bumps CURRENT), the pre-LR version is
  // CURRENT - 1. The probe keeps the expectation "one greater than the fixture's pre-LR
  // version" without hardcoding a future number (doc 16 LR1-17; doc 14 §9).
  const preLrVersion = worldHasLrSlices(baseRecord) ? CURRENT_SCHEMA_VERSION - 1 : CURRENT_SCHEMA_VERSION;

  // A genuine pre-LR payload: strip any LR slices (present post-merge) and pin the version.
  const payload: LrSavePayload = {
    ...structuredClone(base),
    minuteOfDay: 700,
    nookState: { ...base.nookState, shelfBrowsedDay: 5, booksRead: 2, teasShared: 1 },
    bakeryState: { ...base.bakeryState, kneadedDay: 4, loavesShared: 2 },
    greenhouseState: { ...base.greenhouseState, noteReadDay: 3, totalHarvests: 7 },
    playerRelations: {
      ...base.playerRelations,
      nora: { ...base.playerRelations.nora, affinity: 55 },
    },
    schemaVersion: preLrVersion,
  };
  for (const key of LR_SLICE_KEYS) delete payload[key];

  const res = deserializeWorldState(JSON.stringify(payload));
  const state = res.state;
  const slices = state as unknown as LrSavePayload;

  assert.equal(
    res.migratedFromVersion,
    preLrVersion,
    'fixture genuinely entered the chain at the pre-LR version',
  );
  assert.equal(
    state.schemaVersion,
    preLrVersion + 1,
    'MISSING LR-1 PRODUCTION: the Living Relationships migration step (vN -> vN+1 per doc 14 ' +
      '§9 policy) does not exist yet — the chain still ends at the pre-LR version, so canonical ' +
      'saves never receive the seeded LR slices (doc 16 LR1-17)',
  );

  // Seeded LR defaults (doc 14 §9 policy 4; doc 16 LR1-17 expected list):
  const invitations = slices.invitations as LrInvitationStateView | undefined;
  assert.ok(invitations, 'LR migration seeds the invitations slice');
  assert.ok(
    invitations?.active === null || invitations?.active === undefined,
    'seeded invitations.active === null',
  );
  assert.equal(invitations?.history?.length ?? 0, 0, 'seeded history is empty');
  assert.ok('occupancy' in slices, 'LR migration seeds the occupancy slice');
  assert.ok(
    slices.occupancy === null ||
      slices.occupancy === undefined ||
      (typeof slices.occupancy === 'object' &&
        !Array.isArray(slices.occupancy) &&
        (slices.occupancy as Record<string, unknown>).residentId === undefined),
    'seeded occupancy is empty',
  );
  assert.ok('teaching' in slices, 'LR migration seeds the teaching slice');
  assert.equal(
    (slices.teaching as { known?: unknown[] } | undefined)?.known?.length ?? 0,
    0,
    'seeded teaching.known is empty',
  );
  assert.ok('activeActivity' in slices, 'LR migration seeds activeActivity');
  assert.ok(
    slices.activeActivity === null || slices.activeActivity === undefined,
    'seeded activeActivity === null',
  );

  // Prior slices unchanged (doc 16 LR1-17 fail line: "nook/bakery fields reset"):
  assert.equal(state.nookState.shelfBrowsedDay, 5, 'nookState stamp preserved');
  assert.equal(state.nookState.booksRead, 2, 'nookState counter preserved');
  assert.equal(state.nookState.teasShared, 1, 'nookState tea counter preserved');
  assert.equal(state.bakeryState.kneadedDay, 4, 'bakeryState stamp preserved');
  assert.equal(state.bakeryState.loavesShared, 2, 'bakeryState counter preserved');
  assert.equal(state.greenhouseState.noteReadDay, 3, 'greenhouseState stamp preserved');
  assert.equal(state.greenhouseState.totalHarvests, 7, 'greenhouseState counter preserved');
  assert.equal(state.playerRelations.nora.affinity, 55, 'player relations preserved');
  assert.equal(state.memories.length, base.memories.length, 'journal preserved');
  assert.equal(state.day, base.day, 'day preserved');
});

test('LR1-18: a pre-LR era save chains through every intermediate step and receives LR defaults', () => {
  const base = createFreshWorldState();
  const baseRecord = base as unknown as LrSavePayload;
  const hasLr = worldHasLrSlices(baseRecord);
  // Fixture version: two steps below the current runtime version. Today that is exactly
  // v8, the version doc 16 LR1-18 names ("fixture that currently enters at v8"); after the
  // LR merge bumps CURRENT it stays two steps below the LR target so the case keeps
  // exercising a multi-step chain ending in the LR step. Historical introducing versions
  // (v9 nook, v10 copperwheel) are fixed facts and may be referenced.
  const fixtureVersion = CURRENT_SCHEMA_VERSION - 2;

  const payload: LrSavePayload = {
    ...structuredClone(base),
    day: 6,
    minuteOfDay: 640,
    residents: {
      ...base.residents,
      clara: { ...base.residents.clara, trust: 4, met: true },
    },
    schemaVersion: fixtureVersion,
  };
  // Strip slices the fixture's era genuinely lacked: nookState arrived in v9,
  // copperwheelState in v10, and the LR slices at the LR version.
  if (fixtureVersion < 9) delete payload.nookState;
  if (fixtureVersion < 10) delete payload.copperwheelState;
  const lrVersion = hasLr ? CURRENT_SCHEMA_VERSION : CURRENT_SCHEMA_VERSION + 1;
  if (fixtureVersion < lrVersion) {
    for (const key of LR_SLICE_KEYS) delete payload[key];
  }

  const res = deserializeWorldState(JSON.stringify(payload));
  const state = res.state;
  const slices = state as unknown as LrSavePayload;

  assert.equal(res.migratedFromVersion, fixtureVersion, 'fixture entered at the intended era');
  assert.equal(
    state.schemaVersion,
    CURRENT_SCHEMA_VERSION,
    'no skipped step: the chain still reaches the runtime version (doc 16 LR1-18)',
  );
  // Intermediate steps still applied (doc 16 LR1-18: "v9 nook defaults applied by
  // existing migration ... LR defaults applied after that"):
  assert.ok(state.nookState, 'v9-era nook defaults present after the chain');
  assert.ok(state.copperwheelState, 'v10-era copperwheel defaults present after the chain');
  assert.equal(state.day, 6, 'save progress carried through the chain');
  assert.equal(state.residents.clara.trust, 4, 'resident progress carried through the chain');

  // LR defaults applied after the existing steps — the discriminating assertion:
  assert.ok(
    'invitations' in slices,
    'MISSING LR-1 PRODUCTION: the chain reaches the runtime version but no LR step seeds the ' +
      'invitations slice, so a pre-LR-era save loads without the LR defaults (doc 14 §9 policy 4; ' +
      'doc 16 LR1-18 fail line)',
  );
  const invitations = slices.invitations as LrInvitationStateView | undefined;
  assert.ok(
    invitations?.active === null || invitations?.active === undefined,
    'LR default seeds an empty active slot on an era save',
  );
  assert.ok('occupancy' in slices && 'teaching' in slices && 'activeActivity' in slices,
    'all LR slices seeded on a pre-LR-era save');
});
