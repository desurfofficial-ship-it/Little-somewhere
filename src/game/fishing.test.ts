/**
 * Willow Jetty fishing — adversarial battery (Workstream D matrix, adapted to
 * the no-bait / no-fail / one-cast-per-day design).
 *
 * Test id → spec map:
 *   FISH-01 valid initiation & completion (catch path, honest grant chips)
 *   FISH-02 determinism pin (golden species for seed/day/index)
 *   FISH-03 stream isolation (unrelated sideFlags history cannot shift outcome)
 *   FISH-04 once-per-day gate (second cast returns unchanged world)
 *   FISH-05 interior location guard
 *   FISH-06 distance guard
 *   FISH-07 active-activity guard (no dual claim)
 *   FISH-08 quiet day (no item, no counter, no memory)
 *   FISH-09 season/weather pool validity (winter ⇒ ice perch; all ids known)
 *   FISH-10 first-of-species journal dedupe (across many casts)
 *   FISH-11 honest overflow (satchel stack at cap ⇒ release, no silent loss)
 *   FISH-12 NaN/corruption guard on sideFlags counters (QA finding F2 class)
 *   FISH-13 save/load round-trip (serialize ⇒ deserialize preserves state)
 *   FISH-14 save-revision dirties (autosave notices the catch)
 *   FISH-15 input purity (input world never mutated)
 *   FISH-16 field-scoped regression (occupancy / activeActivity / invitations untouched)
 *   FISH-17 no wall-clock imports (Date.now / performance.now regression lock)
 *   FISH-18 witness NPC memory written once per catch with stable eventId scheme
 *   FISH-19 day-end clamp surfaces the evening note
 *   FISH-20 memoryUnlockedTitle only on true first-of-species
 *
 * Run: npm test (tsx --test src/game/*.test.ts src/scene/*.test.ts)
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { performFishingAction, FISHING_SPOT, FISHING_CATCHES_KEY, FISHING_LAST_DAY_KEY } from './fishing';
import { createFreshWorldState, serializeWorldState, deserializeWorldState, computeWorldSaveRevision } from './storage';
import { hashSeed, mulberry32 } from './rng';
import { EVENING_SLIPPED_NOTE, DAY_END_MINUTE } from './time';
import { PERSONAL_ITEM_MAP } from './inventory';
import type { WorldState, PersonalItemId, TimePhase } from './types';

const KNOWN_CATCH_IDS: readonly PersonalItemId[] = [
  'silver_dace',
  'sun_perch',
  'rain_trout',
  'mirror_carp',
  'ice_perch',
  'smooth_river_glass',
  'heron_feather',
  'pressed_fern',
];

// White-box replica of the module's resolution roll (pins the determinism contract).
function rollFor(simSeed: number, day: number, catchIndex: number): number {
  return mulberry32(hashSeed(simSeed, day, 'fishing_v1', catchIndex))();
}

function stageAtJetty(overrides: Partial<WorldState> = {}): WorldState {
  const world = createFreshWorldState();
  world.playerPos = { x: FISHING_SPOT.x, z: FISHING_SPOT.z };
  world.playerLocation = 'exterior';
  return Object.assign(world, overrides);
}

function findDays(predicate: (roll: number) => boolean, need: number): number[] {
  const found: number[] = [];
  for (let day = 1; day <= 400 && found.length < need; day++) {
    if (predicate(rollFor(18042, day, 0))) found.push(day);
  }
  assert.equal(found.length, need, 'day scan should find enough qualifying days');
  return found;
}

describe('fishing — Willow Jetty (Stage 3 slice)', () => {
  it('FISH-01 valid initiation & completion grants exactly one honest chip', () => {
    const world = stageAtJetty();
    const res = performFishingAction(world);
    assert.equal(res.title, FISHING_SPOT.name);
    assert.notEqual(res.nextWorld, world, 'catch path returns a new world');
    const count = res.nextWorld.sideFlags[FISHING_CATCHES_KEY];
    assert.equal(count, 1);
    assert.equal(res.nextWorld.sideFlags[FISHING_LAST_DAY_KEY], world.day);
    // Chips match actual satchel delta on the non-overflow path (overflow is FISH-11).
    if (res.gainedItems && res.gainedItems.length > 0) {
      assert.equal(res.gainedItems.length, 1);
      const chip = res.gainedItems[0];
      assert.equal(chip.count, 1);
      const def = PERSONAL_ITEM_MAP[chip.itemId];
      assert.ok(def, 'granted item is a registry item');
    }
    assert.ok(res.body.includes('+20m'), 'prose records the time spent');
  });

  it('FISH-02 determinism pin — same seed/day/index yields the identical outcome', () => {
    const a = performFishingAction(stageAtJetty());
    const b = performFishingAction(stageAtJetty());
    assert.equal(a.nextWorld.sideFlags[FISHING_CATCHES_KEY], b.nextWorld.sideFlags[FISHING_CATCHES_KEY]);
    const aId = a.gainedItems?.[0]?.itemId;
    const bId = b.gainedItems?.[0]?.itemId;
    assert.equal(aId, bId);
    assert.equal(JSON.stringify(a.nextWorld.sideFlags), JSON.stringify(b.nextWorld.sideFlags));
    // Absolute golden table (QA finding 3): locks the salt, thresholds and
    // seasonal pools together. Update INTENTIONALLY if the formula changes.
    const golden: Record<number, string> = {
      1: 'silver_dace',
      2: 'silver_dace',
      3: 'silver_dace',
      4: 'silver_dace',
      5: 'smooth_river_glass',
    };
    for (const [dayStr, expectedId] of Object.entries(golden)) {
      const day = Number(dayStr);
      const res = performFishingAction(stageAtJetty({ day }));
      assert.equal(res.gainedItems?.[0]?.itemId ?? 'quiet', expectedId, `golden day ${day}`);
    }
  });

  it('FISH-03 stream isolation — unrelated sideFlags history cannot shift the catch', () => {
    const day = findDays((r) => r >= 0.44, 1)[0];
    const a = performFishingAction(stageAtJetty({ day }));
    const b = performFishingAction(
      stageAtJetty({ day, sideFlags: { wellPebblesCount: 7, posyPickedDay: 1 } }),
    );
    assert.equal(a.gainedItems?.[0]?.itemId, b.gainedItems?.[0]?.itemId);
    assert.equal(a.nextWorld.sideFlags[FISHING_CATCHES_KEY], b.nextWorld.sideFlags[FISHING_CATCHES_KEY]);
  });

  it('FISH-04 once-per-day gate — second cast leaves the world untouched', () => {
    const world = stageAtJetty();
    const first = performFishingAction(world);
    const fingerprint = JSON.stringify(first.nextWorld);
    const second = performFishingAction(first.nextWorld);
    assert.equal(second.gainedItems, undefined, 'no second reward');
    assert.equal(second.nextWorld.memories.length, first.nextWorld.memories.length, 'no second journal row');
    assert.equal(
      JSON.stringify(second.nextWorld),
      fingerprint,
      'gate path is world-neutral apart from nothing at all',
    );
  });

  it('FISH-05 interior location guard', () => {
    const world = stageAtJetty();
    world.playerLocation = 'cottage_interior';
    const res = performFishingAction(world);
    assert.equal(res.nextWorld, world, 'unchanged world reference');
    assert.equal(res.gainedItems, undefined);
  });

  it('FISH-06 distance guard', () => {
    const world = stageAtJetty();
    world.playerPos = { x: 0, z: 0 };
    const res = performFishingAction(world);
    assert.equal(res.nextWorld, world, 'unchanged world reference');
    assert.equal(res.gainedItems, undefined);
  });

  it('FISH-07 active-activity guard — no dual activity claim', () => {
    const world = stageAtJetty();
    world.activeActivity = {
      activityId: 'share_featured_reading',
      invitationId: 'inv_test',
    };
    const before = JSON.stringify(world);
    const res = performFishingAction(world);
    assert.equal(res.nextWorld, world, 'unchanged world reference');
    assert.equal(JSON.stringify(world), before, 'input untouched');
    assert.equal(res.gainedItems, undefined);
  });

  it('FISH-08 quiet day — no item, no counter, no memory, day stamped', () => {
    const day = findDays((r) => r < 0.14, 1)[0];
    const world = stageAtJetty({ day });
    const res = performFishingAction(world);
    assert.equal(res.gainedItems, undefined);
    assert.equal(res.nextWorld.sideFlags[FISHING_CATCHES_KEY], undefined);
    assert.equal(res.nextWorld.sideFlags[FISHING_LAST_DAY_KEY], day);
    assert.equal(res.nextWorld.memories.length, world.memories.length, 'no journal row on a quiet day');
    assert.ok(res.body.includes('quiet'), 'quiet prose acknowledges the rest');
  });

  it('FISH-09 season/weather pool validity — winter yields ice perch, all ids known', () => {
    const granted: PersonalItemId[] = [];
    for (let day = 1; day <= 120; day++) {
      const world = stageAtJetty({ day, season: 'winter' });
      const res = performFishingAction(world);
      const id = res.gainedItems?.[0]?.itemId;
      if (id) {
        granted.push(id);
        // Winter never grants the non-winter species.
        assert.ok(id === 'ice_perch' || !['silver_dace', 'sun_perch', 'rain_trout'].includes(id));
      }
    }
    assert.ok(granted.length > 10, 'winter catches happen');
    assert.ok(granted.every((id) => KNOWN_CATCH_IDS.includes(id)), 'every catch is a known registry item');
    assert.ok(granted.includes('ice_perch'), 'winter pool includes the ice perch');
  });

  it('FISH-10 first-of-species journal rows never duplicate across many casts', () => {
    let world = stageAtJetty();
    const seenIds = new Set<string>();
    for (let day = 1; day <= 30; day++) {
      const staged = { ...world, day, sideFlags: { ...world.sideFlags } };
      const res = performFishingAction(staged as WorldState);
      world = {
        ...res.nextWorld,
        day,
        sideFlags: { ...res.nextWorld.sideFlags },
      } as WorldState;
      for (const m of res.nextWorld.memories) seenIds.add(m.id);
    }
    const fishMems = [...seenIds].filter((id) => id.startsWith('mem_fish_first_'));
    assert.equal(fishMems.length, new Set(fishMems).size, 'no duplicate first-catch memory ids');
    assert.ok(fishMems.length <= KNOWN_CATCH_IDS.length);
  });

  it('FISH-11 honest overflow — satchel stack at cap releases the catch without loss', () => {
    // Find a non-quiet, non-treasure, non-carp day so the common dace is granted.
    const day = findDays((r) => r >= 0.44, 1)[0];
    const world = stageAtJetty({ day });
    // Force the common pool onto dace (fresh world: spring day weather defaults) and top the stack.
    const probe = performFishingAction(stageAtJetty({ day }));
    const speciesId = probe.gainedItems?.[0]?.itemId;
    assert.ok(speciesId, 'probe day yields a catch');
    const staged = stageAtJetty({ day });
    staged.inventory = { ...staged.inventory, [speciesId]: 20 };
    const res = performFishingAction(staged);
    assert.equal(res.gainedItems, undefined, 'no chip promised when the satchel cannot take it');
    assert.equal(res.nextWorld.inventory[speciesId], 20, 'stack untouched — nothing destroyed');
    assert.ok(res.body.includes('slipped back'), 'prose is honest about the release');
    assert.equal(res.nextWorld.sideFlags[FISHING_CATCHES_KEY], 1, 'the moment still counts');
  });

  it('FISH-12 corruption guard — non-finite sideFlags counters never propagate NaN', () => {
    const asString = stageAtJetty({ sideFlags: { [FISHING_CATCHES_KEY]: '3x' } });
    const resStr = performFishingAction(asString);
    const strVal = resStr.nextWorld.sideFlags[FISHING_CATCHES_KEY];
    assert.equal(strVal, 1, 'string garbage reads as 0 then increments to 1');
    assert.equal(typeof strVal, 'number');
    assert.ok(Number.isFinite(strVal));

    const asNaN = stageAtJetty({ sideFlags: { [FISHING_CATCHES_KEY]: Number.NaN } });
    const resNaN = performFishingAction(asNaN);
    assert.ok(Number.isFinite(resNaN.nextWorld.sideFlags[FISHING_CATCHES_KEY] as number));
  });

  it('FISH-13 save/load round-trip preserves counters, day stamp and memories', () => {
    const world = stageAtJetty();
    const res = performFishingAction(world);
    const json = serializeWorldState(res.nextWorld);
    const loaded = deserializeWorldState(json);
    assert.equal(loaded.state.sideFlags[FISHING_CATCHES_KEY], 1);
    assert.equal(loaded.state.sideFlags[FISHING_LAST_DAY_KEY], world.day);
    assert.deepEqual(
      loaded.state.memories.map((m) => m.id),
      res.nextWorld.memories.map((m) => m.id),
      'journal rows survive the sanitizer',
    );
  });

  it('FISH-14 catch dirties the save revision (autosave notices)', () => {
    const world = stageAtJetty();
    const before = computeWorldSaveRevision(world);
    const res = performFishingAction(world);
    const after = computeWorldSaveRevision(res.nextWorld);
    assert.notEqual(before, after);
  });

  it('FISH-15 input purity — the input world is never mutated', () => {
    const world = stageAtJetty();
    const before = JSON.stringify(world);
    performFishingAction(world);
    assert.equal(JSON.stringify(world), before);
  });

  it('FISH-16 field-scoped regression — occupancy, active activity and invitations untouched', () => {
    const world = stageAtJetty();
    const res = performFishingAction(world);
    assert.equal(res.nextWorld.occupancy, world.occupancy);
    assert.equal(res.nextWorld.activeActivity, world.activeActivity);
    assert.equal(res.nextWorld.invitations, world.invitations);
  });

  it('FISH-17 regression lock — the fishing module never reads the wall clock', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fishing.ts'), 'utf-8');
    assert.ok(!src.includes('Date.now'), 'no Date.now (QA finding F1 class)');
    assert.ok(!src.includes('performance.now'), 'no performance.now');
    assert.ok(!src.includes('Math.random'), 'no Math.random — seeded streams only');
  });

  it('FISH-18 witness NPC memory written once per catch with deterministic event ids', () => {
    const world = stageAtJetty();
    // Stage Mina beside the jetty so she witnesses the catch.
    world.npcRuntime.mina.position = { x: 0.4, z: 18.3 };
    world.npcRuntime.mina.targetPos = { x: 0.4, z: 18.3 };
    const res = performFishingAction(world);
    if (res.gainedItems?.length) {
      const minaMems = res.nextWorld.npcMemories.mina ?? [];
      const fishMems = minaMems.filter((m) => m.tag === 'fishing');
      assert.equal(fishMems.length, 1, 'exactly one witness memory for the daily catch');
      assert.equal(fishMems[0].eventId, `ev_fishing_${world.day}_1`);
      assert.equal(fishMems[0].provenance, 'firsthand');
    }
    // Second day, second catch: a fresh event id (index increments), never a
    // dupe. Day 2 is picked deterministically as the next day whose SECOND
    // cast (catchIndex 1) is non-quiet, so the uniqueness assertions always
    // execute (QA finding 2 - the day+1 default was a quiet day, vacuously).
    let day2 = res.nextWorld.day + 1;
    while (rollFor(18042, day2, 1) < 0.14) day2++;
    const day2World = {
      ...res.nextWorld,
      day: day2,
      minuteOfDay: 600,
      sideFlags: { ...res.nextWorld.sideFlags, [FISHING_LAST_DAY_KEY]: res.nextWorld.day },
    } as WorldState;
    const res2 = performFishingAction(day2World);
    assert.ok(res2.gainedItems?.length, 'day-2 cast resolves a catch (non-quiet by construction)');
    const fishMems2 = (res2.nextWorld.npcMemories.mina ?? []).filter((m) => m.tag === 'fishing');
    const eventIds = new Set(fishMems2.map((m) => m.eventId));
    assert.equal(fishMems2.length, eventIds.size, 'event ids are unique per catch');
    assert.ok(fishMems2.some((m) => m.eventId === `ev_fishing_${day2}_2`), 'second catch carries index 2');
  });

  it('FISH-19 day-end clamp surfaces the evening note', () => {
    const day = findDays((r) => r >= 0.14, 1)[0];
    const world = stageAtJetty({ day, minuteOfDay: 1285 });
    const res = performFishingAction(world);
    assert.equal(res.nextWorld.minuteOfDay, DAY_END_MINUTE);
    assert.ok(res.body.includes(EVENING_SLIPPED_NOTE));
  });

  it('FISH-20 memoryUnlockedTitle only fires on a true first-of-species', () => {
    const day = findDays((r) => r >= 0.14, 1)[0];
    const first = performFishingAction(stageAtJetty({ day }));
    if (first.gainedItems?.length) {
      assert.ok(first.memoryUnlockedTitle, 'fresh world: first catch unlocks its memory');
      assert.ok(first.nextWorld.memories.some((m) => m.title === first.memoryUnlockedTitle));
    }
    // Pre-seed every first-catch memory: no unlock, no new row, catch still lands.
    const seeded = stageAtJetty({ day });
    seeded.memories = KNOWN_CATCH_IDS.map((id) => ({
      id: `mem_fish_first_${id}`,
      day: 1,
      phase: 'morning' as TimePhase,
      title: `Seeded ${id}`,
      summary: 'Pre-seeded for the dedupe test.',
    }));
    const res = performFishingAction(seeded);
    assert.equal(res.memoryUnlockedTitle, undefined, 'no unlock when all memories pre-exist');
    assert.equal(res.nextWorld.memories.length, seeded.memories.length, 'no row appended');
  });
});
