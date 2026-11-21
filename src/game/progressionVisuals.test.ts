/**
 * BUILD 03 — tests for the pure progression-to-visual derivation
 * (src/game/progressionVisuals.ts). Contract under test:
 * - fresh-save parity: a brand-new world derives every signal "nothing earned"
 *   (Doc 07 §7.3, game-layer half; the scene-layer half lives in
 *   progressionPresentation.test.ts)
 * - each trigger flips exactly its own signal (collision-freedom of the revision)
 * - outcome-enum clamps match the hydrate fallbacks
 * - threshold semantics (60/90) and reachable tier thresholds
 * - determinism: identical world → identical revision
 * - reversal: thresholds re-derive downward correctly
 * - 2^53 headroom claim for the radix-sum packing
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { createFreshWorldState, serializeWorldState, deserializeWorldState } from './storage';
import {
  composeProgressionVisualState,
  PROGRESSION_REVISION_MAX,
  CANOPY_DRIFT_TARGETS,
  FRIEND_CHARM_AFFINITY,
  KINDRED_RIBBON_AFFINITY,
  BOOK_STACK_TIER_2_BOOKS,
  BOOK_STACK_TIER_3_BOOKS,
  HONEY_DIPPER_HARVESTS,
  RECIPE_CARD_TIER_2_KNEADS,
  type ProgressionWorldInput,
} from './progressionVisuals';

function freshInput(overrides: Partial<ProgressionWorldInput> = {}): ProgressionWorldInput {
  const world = createFreshWorldState();
  const input: ProgressionWorldInput = {
    day: world.day,
    season: world.season,
    sideFlags: world.sideFlags,
    storylines: world.storylines,
    playerRelations: world.playerRelations,
    neighborGiftsReceived: world.neighborGiftsReceived,
    greenhouseState: world.greenhouseState,
    bakeryState: world.bakeryState,
    nookState: world.nookState,
  };
  return { ...input, ...overrides };
}

test('fresh-save parity: every signal derives "nothing earned" on a brand-new world', () => {
  const s = composeProgressionVisualState(freshInput());
  assert.equal(s.storylineProps.zineChalkboard, false);
  assert.equal(s.storylineProps.zineTheme, null);
  assert.equal(s.storylineProps.herbWindowCrate, false);
  assert.equal(s.storylineProps.musicStand, false);
  assert.equal(s.storylineProps.watchCharm, false);
  assert.equal(s.storylineProps.pierSconces, false);
  assert.equal(s.residentTokens.length, 0);
  assert.equal(s.keepsakeEchoes.length, 0);
  assert.equal(s.seasonDrift.canopyProgress, 0); // dayOfSeason 1 = parity anchor
  assert.equal(s.seasonDrift.meadowProgress, 0);
  assert.equal(s.seasonDrift.posyStage, 0); // posy group fully hidden days 1-2
  assert.deepEqual(s.explorationMarks, {
    wellRibbon: false,
    riseCairn: false,
    laneArrow: false,
    hiveWreath: false,
  });
  assert.deepEqual(s.mementoTiers, { bookStackTier: 1, honeyDipper: false, recipeCardTier: 1 });
  assert.equal(s.housekeeping.noticeboardGlint, false);
});

test('each storyline flag flips exactly its own prop and nothing else', () => {
  const cases: Array<[string, string]> = [
    ['pipZinePrinted', 'zineChalkboard'],
    ['herbLoafShared', 'herbWindowCrate'],
    ['pondStandBuilt', 'musicStand'],
    ['watchTuneFinished', 'watchCharm'],
    ['lanternConflictResolved', 'pierSconces'],
  ];
  for (const [flag, prop] of cases) {
    const base = composeProgressionVisualState(freshInput());
    const sideFlags = { ...(freshInput().sideFlags ?? {}), [flag]: true };
    const withFlag = composeProgressionVisualState(freshInput({ sideFlags }));
    assert.equal((withFlag.storylineProps as unknown as Record<string, unknown>)[prop], true, flag);
    // collision-freedom: exactly one boolean changed
    const boolKeys = [
      'zineChalkboard',
      'herbWindowCrate',
      'musicStand',
      'watchCharm',
      'pierSconces',
    ] as const;
    const changed = boolKeys.filter(
      (k) => withFlag.storylineProps[k] !== base.storylineProps[k],
    );
    assert.deepEqual(changed, [prop]);
    assert.notEqual(withFlag.revision, base.revision);
  }
});

test('storyline-status OR-fallback lights props for hand-built saves without sideFlags (review L1)', () => {
  const input = freshInput({
    sideFlags: {},
    storylines: {
      side_pip_zine: { id: 'side_pip_zine', stage: 3, status: 'completed', outcome: 'art_edition' },
    },
  });
  const s = composeProgressionVisualState(input);
  assert.equal(s.storylineProps.zineChalkboard, true);
  assert.equal(s.storylineProps.zineTheme, 'art_edition');
});

test('outcome enums clamp to the hydrate fallbacks (review M8)', () => {
  const flags = (extra: Record<string, boolean | number | string>) => ({
    ...(freshInput().sideFlags ?? {}),
    ...extra,
  });
  const zine = composeProgressionVisualState(
    freshInput({ sideFlags: flags({ pipZinePrinted: true, pipZineTheme: 'garbage_value' }) }),
  );
  assert.equal(zine.storylineProps.zineTheme, 'classic_edition');

  const lantern = composeProgressionVisualState(
    freshInput({
      sideFlags: flags({ lanternConflictResolved: true, lanternConflictOutcome: 42 }),
    }),
  );
  assert.equal(lantern.storylineProps.sconceOutcome, 'bridge_compromise');

  const herb = composeProgressionVisualState(
    freshInput({ sideFlags: flags({ herbLoafShared: true }) }),
  );
  assert.equal(herb.storylineProps.herbStyle, 'plaza_table');
});

test('friend charm at affinity >= 60, kindred ribbon at >= 90, reversal below (review L4/A6)', () => {
  const rel = (affinity: number) =>
    ({ clara: { affinity } }) as unknown as ProgressionWorldInput['playerRelations'];
  const at59 = composeProgressionVisualState(freshInput({ playerRelations: rel(59) }));
  assert.equal(at59.residentTokens.length, 0);
  const at60 = composeProgressionVisualState(freshInput({ playerRelations: rel(60) }));
  assert.equal(at60.residentTokens.length, 1);
  assert.deepEqual(at60.residentTokens[0], { residentId: 'clara', kind: 'friend_charm' });
  const at89 = composeProgressionVisualState(freshInput({ playerRelations: rel(89) }));
  assert.equal(at89.residentTokens[0].kind, 'friend_charm');
  const at90 = composeProgressionVisualState(freshInput({ playerRelations: rel(90) }));
  assert.equal(at90.residentTokens[0].kind, 'kindred_ribbon');
  const backDown = composeProgressionVisualState(freshInput({ playerRelations: rel(50) }));
  assert.equal(backDown.residentTokens.length, 0);
  assert.equal(FRIEND_CHARM_AFFINITY, 60);
  assert.equal(KINDRED_RIBBON_AFFINITY, 90);
});

test('ten-resident token packing is collision-free (review H1)', () => {
  // clara kindred (state 2 at index 0) vs pip kindred (index 8) must differ
  const clara = composeProgressionVisualState(
    freshInput({
      playerRelations: { clara: { affinity: 95 } } as unknown as ProgressionWorldInput['playerRelations'],
    }),
  );
  const pip = composeProgressionVisualState(
    freshInput({
      playerRelations: { pip: { affinity: 95 } } as unknown as ProgressionWorldInput['playerRelations'],
    }),
  );
  assert.notEqual(clara.revision, pip.revision);
  assert.equal(clara.residentTokens[0].residentId, 'clara');
  assert.equal(pip.residentTokens[0].residentId, 'pip');
  // friend for one + kindred for another keeps both entries
  const both = composeProgressionVisualState(
    freshInput({
      playerRelations: {
        clara: { affinity: 65 },
        pip: { affinity: 95 },
      } as unknown as ProgressionWorldInput['playerRelations'],
    }),
  );
  assert.equal(both.residentTokens.length, 2);
});

test('keepsake echoes derive exactly the granted rewards (review L3)', () => {
  const base = composeProgressionVisualState(freshInput());
  assert.equal(base.keepsakeEchoes.length, 0);
  const withGifts = composeProgressionVisualState(
    freshInput({ neighborGiftsReceived: ['pip', 'barnaby'] }),
  );
  assert.deepEqual(
    withGifts.keepsakeEchoes.map((e) => e.residentId).sort(),
    ['barnaby', 'pip'],
  );
  assert.equal(withGifts.keepsakeEchoes.find((e) => e.residentId === 'pip')?.itemId, 'willow_zine_copy');
  assert.equal(withGifts.keepsakeEchoes.find((e) => e.residentId === 'barnaby')?.itemId, 'cedar_music_box');
  const removed = composeProgressionVisualState(freshInput({ neighborGiftsReceived: [] }));
  assert.equal(removed.keepsakeEchoes.length, 0);
});

test('memento tiers use reachable monotonic thresholds (deviations A2/A3)', () => {
  assert.equal(BOOK_STACK_TIER_3_BOOKS, 4); // booksRead caps at 4 — tiers must be reachable
  const t1 = composeProgressionVisualState(freshInput({ nookState: { booksRead: 1 } as never }));
  assert.equal(t1.mementoTiers.bookStackTier, 1);
  const t2 = composeProgressionVisualState(freshInput({ nookState: { booksRead: 2 } as never }));
  assert.equal(t2.mementoTiers.bookStackTier, 2);
  const t3 = composeProgressionVisualState(freshInput({ nookState: { booksRead: 4 } as never }));
  assert.equal(t3.mementoTiers.bookStackTier, 3);

  const h2 = composeProgressionVisualState(
    freshInput({ greenhouseState: { totalHarvests: 2 } as never }),
  );
  assert.equal(h2.mementoTiers.honeyDipper, false);
  const h3 = composeProgressionVisualState(
    freshInput({ greenhouseState: { totalHarvests: 3 } as never }),
  );
  assert.equal(h3.mementoTiers.honeyDipper, true);
  assert.equal(HONEY_DIPPER_HARVESTS, 3);

  const c4 = composeProgressionVisualState(freshInput({ bakeryState: { kneadingSessions: 4 } as never }));
  assert.equal(c4.mementoTiers.recipeCardTier, 1);
  const c5 = composeProgressionVisualState(freshInput({ bakeryState: { kneadingSessions: 5 } as never }));
  assert.equal(c5.mementoTiers.recipeCardTier, 2);
  assert.equal(RECIPE_CARD_TIER_2_KNEADS, 5);
});

test('season drift: day 1 is the parity anchor in all seasons; winter never drifts (review C1)', () => {
  // dayOfSeason = ((day - 1) % 10) + 1 (time.ts:44-45): day 11 = summer dayOfSeason 1,
  // day 19 = summer dayOfSeason 9 (drifted).
  const day11 = composeProgressionVisualState(freshInput({ day: 11, season: 'summer' }));
  assert.equal(day11.seasonDrift.dayOfSeason, 1);
  assert.equal(day11.seasonDrift.canopyProgress, 0);
  const day19 = composeProgressionVisualState(freshInput({ day: 19, season: 'summer' }));
  assert.equal(day19.seasonDrift.dayOfSeason, 9);
  assert.ok(Math.abs(day19.seasonDrift.canopyProgress - 8 / 9) < 1e-9);
  // winter identity at any day of winter (day 33 = winter dayOfSeason 3)
  const winterLate = composeProgressionVisualState(freshInput({ day: 33, season: 'winter' }));
  assert.equal(winterLate.seasonDrift.dayOfSeason, 3);
  assert.equal(winterLate.seasonDrift.canopyProgress, 0);
  assert.equal(winterLate.seasonDrift.meadowProgress, 0);
  assert.equal(winterLate.seasonDrift.posyStage, 0);
  // drift targets exist for the three drifting seasons only
  assert.ok(CANOPY_DRIFT_TARGETS.spring && CANOPY_DRIFT_TARGETS.summer && CANOPY_DRIFT_TARGETS.autumn);
});

test('sill posies: hidden days 1-2, stems at 3, full at 7 (parity convention)', () => {
  const d2 = composeProgressionVisualState(freshInput({ day: 2, season: 'spring' }));
  assert.equal(d2.seasonDrift.posyStage, 0);
  const d3 = composeProgressionVisualState(freshInput({ day: 3, season: 'spring' }));
  assert.equal(d3.seasonDrift.posyStage, 1);
  const d7 = composeProgressionVisualState(freshInput({ day: 7, season: 'spring' }));
  assert.equal(d7.seasonDrift.posyStage, 2);
});

test('exploration marks derive from the explored_* sideFlags', () => {
  const all = composeProgressionVisualState(
    freshInput({
      sideFlags: {
        ...(freshInput().sideFlags ?? {}),
        explored_sorrel_hollow: true,
        explored_foxglove_rise: true,
        explored_marigold_lane: true,
        explored_bee_line: true,
      },
    }),
  );
  assert.deepEqual(all.explorationMarks, {
    wellRibbon: true,
    riseCairn: true,
    laneArrow: true,
    hiveWreath: true,
  });
  const one = composeProgressionVisualState(
    freshInput({ sideFlags: { ...(freshInput().sideFlags ?? {}), explored_bee_line: true } }),
  );
  assert.deepEqual(one.explorationMarks, {
    wellRibbon: false,
    riseCairn: false,
    laneArrow: false,
    hiveWreath: true,
  });
});

test('noticeboard glint rides the pre-computed playerChanges signal', () => {
  const on = composeProgressionVisualState(freshInput({ noticeboardUpdated: true }));
  assert.equal(on.housekeeping.noticeboardGlint, true);
  const off = composeProgressionVisualState(freshInput({ noticeboardUpdated: false }));
  assert.equal(off.housekeeping.noticeboardGlint, false);
  const absent = composeProgressionVisualState(freshInput());
  assert.equal(absent.housekeeping.noticeboardGlint, false);
});

test('determinism: identical world derives an identical revision (test-pinned)', () => {
  const input = freshInput({
    sideFlags: {
      ...(freshInput().sideFlags ?? {}),
      pipZinePrinted: true,
      explored_bee_line: true,
    },
    playerRelations: {
      clara: { affinity: 65 },
      arthur: { affinity: 92 },
    } as unknown as ProgressionWorldInput['playerRelations'],
    neighborGiftsReceived: ['mina'],
    day: 24,
    season: 'autumn',
  });
  const a = composeProgressionVisualState(input);
  const b = composeProgressionVisualState(freshInput(JSON.parse(JSON.stringify(input))));
  assert.equal(a.revision, b.revision);
});

test('save/load round trip: derived signals reconstruct identically from the persisted world (Doc 07 §7.5)', () => {
  const veteran = freshInput({
    sideFlags: {
      ...(freshInput().sideFlags ?? {}),
      pipZinePrinted: true,
      pipZineTheme: 'art_edition',
      herbLoafShared: true,
      pondStandBuilt: true,
      lanternConflictResolved: true,
      explored_sorrel_hollow: true,
      explored_bee_line: true,
    },
    playerRelations: {
      clara: { affinity: 65 },
      mina: { affinity: 92 },
    } as unknown as ProgressionWorldInput['playerRelations'],
    neighborGiftsReceived: ['pip', 'barnaby'],
    nookState: { booksRead: 4 } as never,
    greenhouseState: { totalHarvests: 5 } as never,
    bakeryState: { kneadingSessions: 6 } as never,
    day: 24,
    season: 'autumn',
  });
  const before = composeProgressionVisualState(veteran);

  // full persistence loop: serialize -> deserialize -> migrate/sanitize
  const world = createFreshWorldState();
  world.sideFlags = veteran.sideFlags as typeof world.sideFlags;
  world.playerRelations = veteran.playerRelations as typeof world.playerRelations;
  world.neighborGiftsReceived = ['pip', 'barnaby'];
  world.nookState = { ...world.nookState, booksRead: 4 };
  world.greenhouseState = { ...world.greenhouseState, totalHarvests: 5 };
  world.bakeryState = { ...world.bakeryState, kneadingSessions: 6 };
  world.day = 24;
  world.season = 'autumn';
  const serialized = serializeWorldState(world);
  const reloaded = deserializeWorldState(serialized).state;
  assert.ok(reloaded, 'veteran save loads');
  assert.equal(reloaded.day, 24);
  assert.equal(reloaded.season, 'autumn');
  const after = composeProgressionVisualState(reloaded);

  assert.equal(after.revision, before.revision, 'revision identical after save/load');
  assert.deepEqual(after.storylineProps, before.storylineProps);
  assert.deepEqual(after.residentTokens, before.residentTokens);
  assert.deepEqual(after.keepsakeEchoes, before.keepsakeEchoes);
  assert.deepEqual(after.explorationMarks, before.explorationMarks);
  assert.deepEqual(after.mementoTiers, before.mementoTiers);
  assert.deepEqual(after.seasonDrift, before.seasonDrift);
});

test('revision packing stays far below the 2^53 unsafe boundary (review H1)', () => {
  const maximal = composeProgressionVisualState(
    freshInput({
      sideFlags: {
        ...(freshInput().sideFlags ?? {}),
        pipZinePrinted: true,
        herbLoafShared: true,
        pondStandBuilt: true,
        watchTuneFinished: true,
        lanternConflictResolved: true,
        explored_sorrel_hollow: true,
        explored_foxglove_rise: true,
        explored_marigold_lane: true,
        explored_bee_line: true,
      },
      storylines: {
        side_pip_zine: { id: 'side_pip_zine', stage: 3, status: 'completed' },
        side_herb_loaf: { id: 'side_herb_loaf', stage: 3, status: 'completed' },
        side_pond_stand: { id: 'side_pond_stand', stage: 3, status: 'completed' },
        side_jun_watch: { id: 'side_jun_watch', stage: 3, status: 'completed' },
        conflict_plaza_lanterns: { id: 'conflict_plaza_lanterns', stage: 3, status: 'completed' },
      },
      playerRelations: {
        clara: { affinity: 100 },
        arthur: { affinity: 100 },
        mina: { affinity: 100 },
        jun: { affinity: 100 },
        barnaby: { affinity: 100 },
        sora: { affinity: 100 },
        toby: { affinity: 100 },
        nora: { affinity: 100 },
        pip: { affinity: 100 },
        rowan: { affinity: 100 },
      } as unknown as ProgressionWorldInput['playerRelations'],
      neighborGiftsReceived: ['pip', 'toby', 'arthur', 'mina', 'barnaby'],
      greenhouseState: { totalHarvests: 99 } as never,
      bakeryState: { kneadingSessions: 99 } as never,
      nookState: { booksRead: 4 } as never,
      noticeboardUpdated: true,
      day: 40,
      season: 'summer',
    }),
  );
  assert.ok(Number.isSafeInteger(maximal.revision), 'revision must be a safe integer');
  assert.ok(maximal.revision < PROGRESSION_REVISION_MAX);
  assert.ok(PROGRESSION_REVISION_MAX < Number.MAX_SAFE_INTEGER);
});
