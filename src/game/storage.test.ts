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

test('corrupt JSON falls back cleanly and v2 round-trip preserves state', () => {
  const corrupt = deserializeWorldState('{not valid json!!!');
  assert.equal(corrupt.migratedFromVersion, null);
  assert.equal(corrupt.state.schemaVersion, 2);
  assert.equal(corrupt.state.day, 1);

  const nonObject = migrateWorldState('hello');
  assert.equal(nonObject.migratedFromVersion, null);

  const fresh = createFreshWorldState();
  const roundTrip = deserializeWorldState(serializeWorldState(fresh));
  assert.equal(roundTrip.migratedFromVersion, 2);
  assert.deepEqual(roundTrip.state, fresh);
});

test('advanceToNextDay advances season at day 11 and resets npcRuntime to 8:00 AM', () => {
  let state = createFreshWorldState();
  state = { ...state, day: 10, minuteOfDay: 1220 };
  const day11 = advanceToNextDay(state);

  assert.equal(day11.day, 11);
  assert.equal(day11.minuteOfDay, NEXT_DAY_WAKE_MINUTE);
  assert.equal(day11.season, 'summer');
  assert.equal(day11.npcRuntime.pip.currentPlaceName, 'Fountain Plaza');
  assert.equal(day11.mailboxUnread, true);
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

    // 3. Legacy v1 payload creates backup and upgrades STORAGE_KEY to schemaVersion 2
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
    assert.equal(upgraded.schemaVersion, 2);
    assert.equal(upgraded.day, 2);
    assert.equal(upgraded.flags.heardBellMystery, true);
    assert.equal(upgraded.residents.pip.trust, 2);
    assert.equal(store.get(STORAGE_BACKUP_KEY), JSON.stringify(legacyV1));
    const storedUpgraded = JSON.parse(store.get(STORAGE_KEY) ?? '{}');
    assert.equal(storedUpgraded.schemaVersion, 2);
  });
});


