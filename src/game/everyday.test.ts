import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EVERYDAY_PRACTICE_ORDER,
  deriveEverydayPracticeProfile,
  formatTouchedTodayLine,
  type EverydayPracticeId,
} from './everyday';
import { buildPocketJournalView } from './journal';
import { createFreshWorldState } from './storage';
import type { WorldState } from './types';

// --- helpers ---------------------------------------------------------------------------

function freshWorld(): WorldState {
  return createFreshWorldState();
}

/** EP-02 staging: lifetime counters only — nothing touched today. */
function stagedWorld(): WorldState {
  const world = freshWorld();
  world.greenhouseState = { ...world.greenhouseState, totalHarvests: 6 };
  world.nookState = { ...world.nookState, booksRead: 2, teasShared: 3 };
  world.copperwheelState = { ...world.copperwheelState, teasShared: 3 };
  // Duplicate entry pins the dedupe: two distinct neighbors, three list rows.
  world.neighborGiftsReceived = ['clara', 'mina', 'clara'];
  world.invitations = {
    ...world.invitations,
    history: [
      {
        invitationId: 'inv_hist_1',
        hostId: 'nora',
        activityId: 'tea_reading_circle',
        day: 3,
        outcome: 'completed',
      },
      {
        invitationId: 'inv_hist_2',
        hostId: 'toby',
        activityId: 'pond_mosaic_evening',
        day: 4,
        outcome: 'expired',
      },
    ],
  };
  world.communityProjects = {
    marigold_garland: { contributed: { meadow_posy: 3 }, completedDay: 0 },
  };
  return world;
}

function practiceOf(
  profile: ReturnType<typeof deriveEverydayPracticeProfile>,
  id: EverydayPracticeId,
) {
  const practice = profile.practices.find((p) => p.id === id);
  assert.ok(practice, `practice ${id} must exist in the profile`);
  return practice;
}

/** First `n` exploration side flags (wilds lifetime count = discovered zones). */
const WILD_FLAGS = [
  'explored_marigold_lane',
  'explored_foxglove_rise',
  'explored_sorrel_hollow',
  'explored_bee_line',
] as const;

function withWilds(n: number): (world: WorldState) => void {
  return (world) => {
    const flags: Record<string, boolean> = {};
    for (let i = 0; i < n; i++) flags[WILD_FLAGS[i]] = true;
    world.sideFlags = { ...world.sideFlags, ...flags };
  };
}

/**
 * Stage a world whose eight tier indices sum exactly to `target` by only
 * mutating the greenhouse/bakery/nook/copperwheel counters and wilds flags.
 * Per-practice index costs used below:
 *   gardening (0/1/3/6/10), kitchen (0/1/3/6/12), reading (0/1/2/3/4),
 *   tea_tables (0/2/5/9/14), mending (0/1/3/6/10), wilds (0/1/2/3/4).
 */
function worldWithTierSum(gardening: number, kitchen: number, reading: number, teas: number, mending: number, wilds: number): WorldState {
  const world = freshWorld();
  world.greenhouseState = { ...world.greenhouseState, totalHarvests: gardening };
  world.bakeryState = { ...world.bakeryState, kneadingSessions: kitchen };
  world.nookState = { ...world.nookState, booksRead: reading, teasShared: teas };
  world.copperwheelState = { ...world.copperwheelState, projectsAdmired: mending };
  withWilds(wilds)(world);
  return world;
}

// Test-side pin of every ladder's bottom rung and first step (spec of record).
const BOTTOM_TIERS: Record<EverydayPracticeId, { tier: string; next: string; nextAt: number }> = {
  gardening: { tier: 'Quiet Soil', next: 'First Sprouts', nextAt: 1 },
  kitchen: { tier: 'Cold Hearth', next: 'First Bakes', nextAt: 1 },
  reading: { tier: 'Unopened Pages', next: 'First Chapters', nextAt: 1 },
  tea_tables: { tier: 'Empty Cup', next: 'Casual Sips', nextAt: 2 },
  mending: { tier: 'Untouched Bench', next: 'First Watches', nextAt: 1 },
  fishing: { tier: 'Untried Water', next: 'First Catch', nextAt: 1 },
  wilds: { tier: 'Homebody Steps', next: 'First Paths', nextAt: 1 },
  friendship: { tier: 'Shy Waves', next: 'First Hellos', nextAt: 1 },
  community: { tier: 'Unmarked Shelf', next: 'First Helping Hand', nextAt: 1 },
};

// --- EP-01 -------------------------------------------------------------------------------

test('EP-01: fresh world — all counts 0, bottom tiers, A Quiet Start, nothing touched today', () => {
  const profile = deriveEverydayPracticeProfile(freshWorld());

  assert.equal(profile.practices.length, 9);
  assert.deepEqual(
    profile.practices.map((p) => p.id),
    [...EVERYDAY_PRACTICE_ORDER],
    'practices follow the canonical order',
  );

  for (const practice of profile.practices) {
    const bottom = BOTTOM_TIERS[practice.id];
    assert.equal(practice.count, 0, `${practice.id} lifetime count on a fresh world`);
    assert.equal(practice.tierLabel, bottom.tier, `${practice.id} bottom tier label`);
    assert.equal(practice.tierNote.length > 0, true, `${practice.id} bottom tier note present`);
    assert.ok(practice.blurb.length > 0, `${practice.id} blurb present`);
    assert.equal(practice.nextTierLabel, bottom.next, `${practice.id} next tier label`);
    assert.equal(practice.nextAt, bottom.nextAt, `${practice.id} next tier threshold`);
  }

  assert.equal(profile.keeperTitle, 'A Quiet Start');
  assert.deepEqual(profile.touchedToday, []);
});

// --- EP-02 -------------------------------------------------------------------------------

test('EP-02: staged counters derive correct counts, tier labels, and nextAt', () => {
  const profile = deriveEverydayPracticeProfile(stagedWorld());

  const expected: Record<
    EverydayPracticeId,
    { count: number; tierLabel: string; nextTierLabel: string; nextAt: number }
  > = {
    gardening: { count: 6, tierLabel: 'Green Thumb', nextTierLabel: 'Keeper of the Beds', nextAt: 10 },
    fishing: { count: 0, tierLabel: 'Untried Water', nextTierLabel: 'First Catch', nextAt: 1 },
    kitchen: { count: 0, tierLabel: 'Cold Hearth', nextTierLabel: 'First Bakes', nextAt: 1 },
    reading: { count: 2, tierLabel: 'Regular Reader', nextTierLabel: 'Nook Regular', nextAt: 3 },
    tea_tables: { count: 6, tierLabel: 'Warm Rituals', nextTierLabel: 'Tea Table Friend', nextAt: 9 },
    mending: { count: 0, tierLabel: 'Untouched Bench', nextTierLabel: 'First Watches', nextAt: 1 },
    wilds: { count: 0, tierLabel: 'Homebody Steps', nextTierLabel: 'First Paths', nextAt: 1 },
    friendship: { count: 3, tierLabel: 'Familiar Face', nextTierLabel: 'Fast Friend', nextAt: 6 },
    community: { count: 3, tierLabel: 'First Helping Hand', nextTierLabel: 'Shelf Contributor', nextAt: 4 },
  };

  for (const id of EVERYDAY_PRACTICE_ORDER) {
    const practice = practiceOf(profile, id);
    const want = expected[id];
    assert.equal(practice.count, want.count, `${id} count`);
    assert.equal(practice.tierLabel, want.tierLabel, `${id} tier label`);
    assert.equal(practice.nextTierLabel, want.nextTierLabel, `${id} next tier label`);
    assert.equal(practice.nextAt, want.nextAt, `${id} next tier threshold`);
  }

  // Tier indices: 3 + 0 + 2 + 2 + 0 + 0 + 2 + 1 = 10 → 6–11 bucket.
  assert.equal(profile.keeperTitle, 'A Regular Around the Lane');
  // Staging touched no day-stamps or daily booleans → nothing touched today.
  assert.deepEqual(profile.touchedToday, []);
});

// --- EP-03 -------------------------------------------------------------------------------

test('EP-03: tier boundary math — count exactly at a min reaches the tier, one below stays behind', () => {
  const atTier = (mutate: (world: WorldState) => void, id: EverydayPracticeId) => {
    const world = freshWorld();
    mutate(world);
    return practiceOf(deriveEverydayPracticeProfile(world), id);
  };

  // gardening ladder mins: 0 / 1 / 3 / 6 / 10
  const five = atTier((w) => {
    w.greenhouseState = { ...w.greenhouseState, totalHarvests: 5 };
  }, 'gardening');
  assert.equal(five.tierLabel, 'Steady Grower');
  assert.equal(five.nextTierLabel, 'Green Thumb');
  assert.equal(five.nextAt, 6);

  const six = atTier((w) => {
    w.greenhouseState = { ...w.greenhouseState, totalHarvests: 6 };
  }, 'gardening');
  assert.equal(six.tierLabel, 'Green Thumb');
  assert.equal(six.nextTierLabel, 'Keeper of the Beds');
  assert.equal(six.nextAt, 10);

  const ten = atTier((w) => {
    w.greenhouseState = { ...w.greenhouseState, totalHarvests: 10 };
  }, 'gardening');
  assert.equal(ten.tierLabel, 'Keeper of the Beds');
  assert.equal(ten.nextTierLabel, null, 'top tier has no next label');
  assert.equal(ten.nextAt, null, 'top tier has no next threshold');

  // tea_tables ladder mins: 0 / 2 / 5 / 9 / 14
  const four = atTier((w) => {
    w.nookState = { ...w.nookState, teasShared: 4 };
  }, 'tea_tables');
  assert.equal(four.tierLabel, 'Casual Sips');
  assert.equal(four.nextTierLabel, 'Warm Rituals');
  assert.equal(four.nextAt, 5);

  const fiveTeas = atTier((w) => {
    w.nookState = { ...w.nookState, teasShared: 5 };
  }, 'tea_tables');
  assert.equal(fiveTeas.tierLabel, 'Warm Rituals');
  assert.equal(fiveTeas.nextTierLabel, 'Tea Table Friend');
  assert.equal(fiveTeas.nextAt, 9);
});

// --- EP-04 -------------------------------------------------------------------------------

test('EP-04: touchedToday reads dailyActivities booleans and day-stamps at day 5, not day 4', () => {
  // Day 5, stamps 5 — every channel fires (kitchen fires twice and must dedupe).
  const touchedWorld = freshWorld();
  touchedWorld.day = 5;
  touchedWorld.dailyActivities = {
    ...touchedWorld.dailyActivities,
    cottagePlanterTendedToday: true,
    greenhousePlantersTendedToday: false,
    orchardHarvestedToday: false,
    pondCombedToday: true,
    bakedCountToday: 2,
    giftedResidentsToday: ['clara'],
  };
  touchedWorld.bakeryState = { ...touchedWorld.bakeryState, kneadedDay: 5, loafSharedDay: 4 };
  touchedWorld.nookState = { ...touchedWorld.nookState, shelfBrowsedDay: 5, teaSharedDay: 3 };
  touchedWorld.copperwheelState = {
    ...touchedWorld.copperwheelState,
    teaSharedDay: 5,
    benchCheckedDay: 5,
  };

  const touched = deriveEverydayPracticeProfile(touchedWorld).touchedToday;
  assert.deepEqual(
    touched,
    ['gardening', 'kitchen', 'reading', 'tea_tables', 'mending', 'wilds', 'friendship'],
    'canonical order, deduplicated (kitchen via bakedCountToday AND kneadedDay appears once)',
  );
  assert.equal(touched.filter((id) => id === 'kitchen').length, 1);
  assert.equal(touched.includes('community'), false, 'community has no today-channel yet');

  // Same day 5 but every stamp 4 and every boolean false → nothing touched.
  const staleWorld = freshWorld();
  staleWorld.day = 5;
  staleWorld.bakeryState = { ...staleWorld.bakeryState, kneadedDay: 4, loafSharedDay: 4 };
  staleWorld.nookState = { ...staleWorld.nookState, shelfBrowsedDay: 4, teaSharedDay: 4 };
  staleWorld.copperwheelState = {
    ...staleWorld.copperwheelState,
    teaSharedDay: 4,
    benchCheckedDay: 4,
  };

  assert.deepEqual(deriveEverydayPracticeProfile(staleWorld).touchedToday, []);
});

// --- EP-05 -------------------------------------------------------------------------------

test('EP-05: determinism — repeated derivations are deep-equal and never mutate the world', () => {
  const world = stagedWorld();
  world.day = 5;
  world.dailyActivities = {
    ...world.dailyActivities,
    pondCombedToday: true,
    bakedCountToday: 1,
  };
  world.nookState = { ...world.nookState, shelfBrowsedDay: 5 };

  const snapshot = JSON.stringify(world);
  const first = deriveEverydayPracticeProfile(world);
  const second = deriveEverydayPracticeProfile(world);

  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(JSON.stringify(world), snapshot, 'derivation writes nothing back into the world');
});

// --- EP-06 -------------------------------------------------------------------------------

test('EP-06: missing/undefined world slices degrade to 0 without throwing', () => {
  const world: WorldState = {
    ...freshWorld(),
    greenhouseState: undefined as any,
    bakeryState: undefined as any,
    nookState: undefined as any,
    copperwheelState: undefined as any,
    dailyActivities: undefined as any,
    neighborGiftsReceived: undefined as any,
    invitations: undefined as any,
    communityProjects: undefined as any,
    sideFlags: undefined as any,
  };

  const profile = deriveEverydayPracticeProfile(world); // must not throw

  for (const practice of profile.practices) {
    assert.equal(practice.count, 0, `${practice.id} count with missing slice`);
    assert.equal(practice.tierLabel, BOTTOM_TIERS[practice.id].tier);
  }
  assert.equal(profile.keeperTitle, 'A Quiet Start');
  assert.deepEqual(profile.touchedToday, []);

  // Garbage counter values degrade to 0 the same way.
  const garbageWorld: WorldState = {
    ...freshWorld(),
    greenhouseState: { totalHarvests: Number.NaN } as any,
    bakeryState: { kneadingSessions: 'seven', loavesShared: -3 } as any,
  };
  const garbageProfile = deriveEverydayPracticeProfile(garbageWorld);
  assert.equal(practiceOf(garbageProfile, 'gardening').count, 0);
  assert.equal(practiceOf(garbageProfile, 'kitchen').count, 0);
});

// --- EP-07 -------------------------------------------------------------------------------

test('EP-07: keeperTitle ladder follows the tier-index sum thresholds 0 / 6 / 12 / 18', () => {
  // 0 → A Quiet Start
  assert.equal(deriveEverydayPracticeProfile(freshWorld()).keeperTitle, 'A Quiet Start');

  // 5 → still the second bucket; 6 (2+1+1+1+1 wilds) → third bucket
  assert.equal(
    deriveEverydayPracticeProfile(worldWithTierSum(3, 1, 1, 2, 0, 0)).keeperTitle,
    'A Neighbor of Little Somewhere',
    'sum 5 stays in 1–5',
  );
  assert.equal(
    deriveEverydayPracticeProfile(worldWithTierSum(3, 1, 1, 2, 0, 1)).keeperTitle,
    'A Regular Around the Lane',
    'sum 6 enters 6–11',
  );

  // 11 (3+2+2+2+1+1) → third bucket; 12 (3+2+2+2+2+1) → fourth bucket
  assert.equal(
    deriveEverydayPracticeProfile(worldWithTierSum(6, 3, 2, 5, 1, 1)).keeperTitle,
    'A Regular Around the Lane',
    'sum 11 stays in 6–11',
  );
  assert.equal(
    deriveEverydayPracticeProfile(worldWithTierSum(6, 3, 2, 5, 3, 1)).keeperTitle,
    'A Keeper of Small Rituals',
    'sum 12 enters 12–17',
  );

  // 17 (4+3+3+3+1+3) → fourth bucket; 18 (4+3+3+3+2+3) → top bucket
  assert.equal(
    deriveEverydayPracticeProfile(worldWithTierSum(10, 6, 3, 9, 1, 3)).keeperTitle,
    'A Keeper of Small Rituals',
    'sum 17 stays in 12–17',
  );
  assert.equal(
    deriveEverydayPracticeProfile(worldWithTierSum(10, 6, 3, 9, 3, 3)).keeperTitle,
    'The Heart of Little Somewhere',
    'sum 18 enters the top bucket',
  );

  // Everything maxed (sum 32, open-ended top bucket) still reads the top title.
  const maxed = freshWorld();
  maxed.greenhouseState = { ...maxed.greenhouseState, totalHarvests: 10 };
  maxed.bakeryState = { ...maxed.bakeryState, kneadingSessions: 12 };
  maxed.nookState = { ...maxed.nookState, booksRead: 4, teasShared: 14 };
  maxed.copperwheelState = { ...maxed.copperwheelState, projectsAdmired: 10, windingSessions: 10 };
  maxed.neighborGiftsReceived = ['clara', 'mina', 'jun', 'barnaby', 'sora', 'toby', 'nora', 'pip', 'rowan', 'arthur'];
  maxed.invitations = {
    ...maxed.invitations,
    history: Array.from({ length: 10 }, (_, i) => ({
      invitationId: `inv_max_${i}`,
      hostId: 'nora',
      activityId: 'tea_reading_circle',
      day: i + 1,
      outcome: 'completed' as const,
    })),
  };
  maxed.communityProjects = {
    marigold_garland: { contributed: { meadow_posy: 3, chamomile_blossom: 3, lavender_sprig: 2 }, completedDay: 2 },
    orchard_lanterns: { contributed: { crabapple: 4, wild_honey: 2 }, completedDay: 0 },
  };
  withWilds(4)(maxed);
  assert.equal(deriveEverydayPracticeProfile(maxed).keeperTitle, 'The Heart of Little Somewhere');
});

// --- EP-08 -------------------------------------------------------------------------------

test('EP-08: journal Daily Practices card exists for staged worlds and stays quiet for fresh ones', () => {
  // Fresh world — card present, all-quiet, patient closing line.
  const freshView = buildPocketJournalView(freshWorld());
  const freshCard = freshView.dailyPractices;
  assert.ok(freshCard, 'the Daily Practices card must exist in the built view');
  assert.equal(freshCard.keeperTitle, 'A Quiet Start');
  assert.equal(freshCard.practices.length, 9);
  assert.equal(
    freshCard.practices.every((line) => line.count === 0),
    true,
    'every practice line reads 0 on a fresh world',
  );
  assert.deepEqual(freshCard.touchedToday, []);
  assert.equal(freshCard.touchedTodayLine, 'Nothing tended yet today — the porch is patient.');

  // Staged world — headline, per-practice lines, and tier labels flow through.
  const stagedView = buildPocketJournalView(stagedWorld());
  const stagedCard = stagedView.dailyPractices;
  assert.equal(stagedCard.keeperTitle, 'A Regular Around the Lane');
  const gardeningLine = stagedCard.practices.find((line) => line.id === 'gardening');
  assert.ok(gardeningLine);
  assert.equal(gardeningLine.label, 'Quiet Hours in the Beds');
  assert.equal(gardeningLine.count, 6);
  assert.equal(gardeningLine.tierLabel, 'Green Thumb');
  const communityLine = stagedCard.practices.find((line) => line.id === 'community');
  assert.ok(communityLine);
  assert.equal(communityLine.count, 3);
  assert.equal(communityLine.tierLabel, 'First Helping Hand');
  assert.equal(stagedCard.touchedTodayLine, 'Nothing tended yet today — the porch is patient.');

  // Touched today — the closing line names the practices in canonical order.
  const touchedWorld = stagedWorld();
  touchedWorld.day = 5;
  touchedWorld.dailyActivities = {
    ...touchedWorld.dailyActivities,
    greenhousePlantersTendedToday: true,
  };
  touchedWorld.nookState = { ...touchedWorld.nookState, teaSharedDay: 5 };
  const touchedView = buildPocketJournalView(touchedWorld);
  assert.deepEqual(touchedView.dailyPractices.touchedToday, ['gardening', 'tea_tables']);
  assert.equal(touchedView.dailyPractices.touchedTodayLine, 'Touched today: gardening, tea tables');

  // The line formatter itself is quiet for an empty day.
  assert.equal(formatTouchedTodayLine([]), 'Nothing tended yet today — the porch is patient.');
});
