import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_SIM_SEED,
  migrateWorldState,
  sanitizeWorldState,
} from './migrations';
import {
  advanceToNextDay,
  createFreshWorldState,
  deserializeWorldState,
  serializeWorldState,
} from './storage';
import { DAY_END_MINUTE, DAY_START_MINUTE, NEXT_DAY_WAKE_MINUTE } from './time';
import { PLAYER_SPAWN, isPointWalkable } from './worldMap';

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
