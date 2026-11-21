/**
 * Visual Identity Evolution — BUILD 03 full-progress veteran-save generator
 * (Doc 07 §7.4; design lock rev 2 review H2c).
 *
 * A "veteran" WorldState in which every Doc 07 §5 progression signal has been
 * genuinely earned through existing gameplay state (no new fields, no schema
 * impact — every value below is an existing, schema-stable field):
 * - all five scene-silent storylines completed (sideFlags AND storyline records,
 *   with one valid outcome variant each)
 * - neighbor keepsake rewards granted for all five reward residents
 * - relationship thresholds crossed: 2 kindred (>= 90), 3 friends (>= 60)
 * - all four Wild Hollows discoveries explored
 * - reachable memento counters: booksRead 4 (cap), totalHarvests 5, kneadingSessions 6
 * - noticeboard has news (heardBellMystery) so the 5.6a glint shows
 * - summer dayOfSeason 7 (day 17) so the within-season drift and the full sill
 *   posies are visible in captures
 *
 * Usage: npx tsx scripts/make_build03_veteran_save.ts > /tmp/build03_veteran.json
 */
import { createFreshWorldState, serializeWorldState } from '../src/game/storage';
import type { WorldState } from '../src/game/types';

const world = createFreshWorldState();

// Golden hour on a mid-summer day — dayOfSeason 7 (drift 6/9, posy stage 2).
world.day = 17;
world.season = 'summer';
world.weather = 'sunlit';
world.minuteOfDay = 1080; // 6:00 PM — golden phase

// The neighborhood's stories have been lived (same identity-frozen flags as the
// BUILD 01/02 veteran base — continuity of the established capture doctrine).
world.flags = {
  ...world.flags,
  heardBellMystery: true, // board has news → 5.6a glint
  bellRestored: true,
  claraArthurReconciled: true,
  lanternsLit: true,
  foundBrassClapper: true,
  repairedFountain: true,
  plantedMoonPetals: true,
  clearedGazeboIvy: true,
};

// BUILD 03 5.1 — the five storylines completed with valid outcome variants
// (sideFlags are what the production writer syncs; the storyline records mirror
// them exactly the way advanceStorylineInPlace leaves them).
world.sideFlags = {
  ...world.sideFlags,
  // side_pip_zine
  pipZineStarted: true,
  pipZinePrinted: true,
  pipZineTheme: 'art_edition',
  // side_herb_loaf
  herbLoafStarted: true,
  herbLoafShared: true,
  herbLoafStyle: 'tea_basket',
  // side_pond_stand
  pondStandStarted: true,
  pondStandBuilt: true,
  pondStandStyle: 'carved_clef',
  // side_jun_watch
  watchTuneStarted: true,
  watchTuneFinished: true,
  watchTuneStyle: 'patient_repair',
  // conflict_plaza_lanterns
  lanternConflictStarted: true,
  lanternConflictResolved: true,
  lanternConflictOutcome: 'bridge_compromise',
  // side_orchard_gathering (BUILD 02 baseline continuity)
  orchardGatheringStarted: true,
  orchardGatheringComplete: true,
  orchardGatheringOutcome: 'spiced_tart_table',
  // BUILD 03 5.4 — all four Wild Hollows discoveries
  explored_marigold_lane: true,
  explored_foxglove_rise: true,
  explored_sorrel_hollow: true,
  explored_bee_line: true,
};

// Storyline records mirrored from the sideFlags (same shape the sanitizer
// re-hydrates; status/outcome only — stage/day fields kept minimal and valid).
world.storylines = {
  ...world.storylines,
  side_pip_zine: { id: 'side_pip_zine', stage: 3, status: 'completed', outcome: 'art_edition', completedDay: 12 },
  side_herb_loaf: { id: 'side_herb_loaf', stage: 3, status: 'completed', outcome: 'tea_basket', completedDay: 13 },
  side_pond_stand: { id: 'side_pond_stand', stage: 3, status: 'completed', outcome: 'carved_clef', completedDay: 14 },
  side_jun_watch: { id: 'side_jun_watch', stage: 3, status: 'completed', outcome: 'patient_repair', completedDay: 15 },
  conflict_plaza_lanterns: { id: 'conflict_plaza_lanterns', stage: 3, status: 'completed', outcome: 'bridge_compromise', completedDay: 16 },
  side_orchard_gathering: { id: 'side_orchard_gathering', stage: 3, status: 'completed', outcome: 'spiced_tart_table', completedDay: 11 },
};

// BUILD 03 5.2a/b — relationship thresholds crossed (affinity 0..100):
// kindred (>= 90): Mina, Arthur · friends (>= 60): Clara, Barnaby, Nora
for (const id of Object.keys(world.residents) as Array<keyof typeof world.residents>) {
  world.residents[id].met = true;
}
const affinity: Record<string, number> = {
  mina: 92,
  arthur: 95,
  clara: 65,
  barnaby: 68,
  nora: 62,
  pip: 48,
  sora: 44,
  toby: 52,
  jun: 40,
  rowan: 55,
};
for (const [id, value] of Object.entries(affinity)) {
  const rel = world.playerRelations[id as keyof typeof world.playerRelations];
  if (rel) {
    rel.affinity = value;
    rel.familiarity = Math.max(rel.familiarity, Math.min(30, Math.floor(value / 3)));
  }
}

// BUILD 03 5.2c — neighbor keepsake rewards granted (each exactly once)
world.neighborGiftsReceived = ['pip', 'toby', 'arthur', 'mina', 'barnaby'];

// BUILD 03 5.5 — reachable monotonic counters (booksRead caps at 4 per cycle)
world.nookState = { ...world.nookState, booksRead: 4, teasShared: 3 };
world.greenhouseState = { ...world.greenhouseState, totalHarvests: 5, totalPlanted: 8 };
world.bakeryState = { ...world.bakeryState, kneadingSessions: 6, loavesShared: 4 };
world.copperwheelState = { ...world.copperwheelState, projectsAdmired: 3, teasShared: 2 };

// Home comfort + cottage keepsake shelf (BUILD 01 veteran continuity)
world.cottageState = {
  placedFlowerId: 'chamomile_blossom',
  displayedKeepsakeIds: ['willow_zine_copy', 'pond_watercolor_card', 'cedar_music_box'],
  hearthLit: true,
  kettleWarmUntilMinute: 1110,
  almanacReadToday: false,
  cottageRestCount: 11,
};

// Player at the plaza fountain, the golden-hour hero spot, facing the fountain.
world.playerLocation = 'exterior';
world.playerPos = { x: 2.0, z: 4.6 };
world.playerFacing = -2.1;
world.exteriorPlayerPos = { ...world.playerPos };
world.exteriorPlayerFacing = world.playerFacing;
world.mailboxUnread = false;

// Sanity: the derived presentation must show every BUILD 03 signal earned.
const derived = world as WorldState;
if (!derived.sideFlags.pipZinePrinted || derived.neighborGiftsReceived.length !== 5) {
  throw new Error('BUILD 03 veteran save invariant failed');
}

process.stdout.write(serializeWorldState(world));
