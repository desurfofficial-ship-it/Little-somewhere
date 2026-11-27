/**
 * Everyday Gameplay GA-3 — Everyday Practice Profile (Workstream D).
 *
 * Derive-only "participation & discovery" progression (zero new persisted state),
 * following the progressionVisuals doctrine: this module READS existing
 * authoritative counters and emits presentation views. No mutation, no schema
 * impact, no reducers, no new persisted fields — an identical saved world
 * reconstructs an identical profile after load (idempotent by construction).
 *
 * Every count reads ONLY existing persisted counters (GA-0/GA-1/GA-2/interior
 * slices). All world slices are read defensively: missing/undefined/garbage
 * slices degrade to 0 and the profile NEVER throws (EP-06 contract).
 *
 * Spec of record: docs/architecture/everyday-gameplay/00-improvement-plan.md §GA-3.
 */

import { countExploredDiscoveries } from './exploration';
import { countCommunityContributions } from './community';
import { isDoneToday } from './time';
import type { WorldState } from './types';

export type EverydayPracticeId =
  | 'gardening'
  | 'kitchen'
  | 'reading'
  | 'tea_tables'
  | 'mending'
  | 'wilds'
  | 'fishing'
  | 'friendship'
  | 'community'
  | 'photography';

export interface EverydayPracticeTier {
  minCount: number;
  label: string;
  note: string;
}

export interface EverydayPracticeView {
  id: EverydayPracticeId;
  label: string;
  blurb: string;
  count: number;
  tierLabel: string;
  tierNote: string;
  nextTierLabel: string | null;
  nextAt: number | null;
}

export interface EverydayPracticeProfile {
  practices: EverydayPracticeView[];
  touchedToday: EverydayPracticeId[];
  keeperTitle: string;
}

/** Canonical practice order — every derived list follows this exact sequence. */
export const EVERYDAY_PRACTICE_ORDER: readonly EverydayPracticeId[] = [
  'gardening',
  'kitchen',
  'reading',
  'tea_tables',
  'mending',
  'wilds',
  'fishing',
  'friendship',
  'community',
  'photography',
];

// --- practice catalog -----------------------------------------------------------------

interface EverydayPracticeDef {
  id: EverydayPracticeId;
  label: string;
  blurb: string;
  /** Lifetime count, derived from existing persisted counters only. Never throws. */
  readCount: (world: WorldState) => number;
  /** Ascending tier ladder starting at minCount 0. */
  tiers: readonly EverydayPracticeTier[];
}

const GARDENING_TIERS: readonly EverydayPracticeTier[] = [
  { minCount: 0, label: 'Quiet Soil', note: 'The beds rest easy; a seed only asks to be planted.' },
  { minCount: 1, label: 'First Sprouts', note: 'Green tips are nudging through the soil where you watered.' },
  { minCount: 3, label: 'Steady Grower', note: 'Mina says the shared pots perk up when your shadow passes.' },
  { minCount: 6, label: 'Green Thumb', note: 'The greenhouse shelf has taken on your rhythm — sow, water, harvest, repeat.' },
  { minCount: 10, label: 'Keeper of the Beds', note: 'The beds bloom on schedule now; the lane calls them yours.' },
];

const KITCHEN_TIERS: readonly EverydayPracticeTier[] = [
  { minCount: 0, label: 'Cold Hearth', note: 'The dome sleeps; flour and patience are all it asks for.' },
  { minCount: 1, label: 'First Bakes', note: 'A warm loaf has crossed the bakery counter with your name on it.' },
  { minCount: 3, label: 'Weekend Baker', note: 'Clara starts saving you the corner spot at the prep table.' },
  { minCount: 6, label: 'Hearth Keeper', note: 'The oven’s rhythm knows you; the paper wraps come easier each time.' },
  { minCount: 12, label: 'Baker of the Lane', note: 'Neighbors set their evenings by the loaves you knead.' },
];

const READING_TIERS: readonly EverydayPracticeTier[] = [
  { minCount: 0, label: 'Unopened Pages', note: 'The shelf waits with four spines and a lamp turned low.' },
  { minCount: 1, label: 'First Chapters', note: 'One story has tucked itself into your pocket for later.' },
  { minCount: 2, label: 'Regular Reader', note: 'The armchair has learned the shape of you.' },
  { minCount: 3, label: 'Nook Regular', note: 'Nora pours your reader’s cup before you even ask.' },
  { minCount: 4, label: 'Keeper of Stories', note: 'Every book on the shelf has kept you company once.' },
];

const TEA_TABLES_TIERS: readonly EverydayPracticeTier[] = [
  { minCount: 0, label: 'Empty Cup', note: 'The kettles are warm and waiting; no cup is owed.' },
  { minCount: 2, label: 'Casual Sips', note: 'A few quiet cups have steamed between errands.' },
  { minCount: 5, label: 'Warm Rituals', note: 'Tea has become a small ceremony you keep with friends.' },
  { minCount: 9, label: 'Tea Table Friend', note: 'The trays are set with you in mind at both tables.' },
  { minCount: 14, label: 'Pourer of Cups', note: 'When neighbors gather, you are the reason the kettle sings.' },
];

const MENDING_TIERS: readonly EverydayPracticeTier[] = [
  { minCount: 0, label: 'Untouched Bench', note: 'The felt is rolled and the tools sleep in their oiled drawer.' },
  { minCount: 1, label: 'First Watches', note: 'Arthur let you linger over a project on the green felt.' },
  { minCount: 3, label: 'Steady Hands', note: 'Your turns at the bench come steadier each week.' },
  { minCount: 6, label: 'Workbench Friend', note: 'The mending ledger keeps a page with your initials.' },
  { minCount: 10, label: 'Mender of Small Things', note: 'Half the lane’s ticking owes you a quiet afternoon.' },
];

const WILDS_TIERS: readonly EverydayPracticeTier[] = [
  { minCount: 0, label: 'Homebody Steps', note: 'The lane’s cobblestones are enough for now; the wilds keep still.' },
  { minCount: 1, label: 'First Paths', note: 'One trail has folded you into its map.' },
  { minCount: 2, label: 'Trail Walker', note: 'You have begun to know where the meadow keeps its secrets.' },
  { minCount: 3, label: 'Hollow Wanderer', note: 'The hollows feel less like places and more like acquaintances.' },
  { minCount: 4, label: 'Mapper of the Wilds', note: 'Every wild corner of the valley knows your boots.' },
];

const FRIENDSHIP_TIERS: readonly EverydayPracticeTier[] = [
  { minCount: 0, label: 'Shy Waves', note: 'Waves from the porch count too; the lane is patient.' },
  { minCount: 1, label: 'First Hellos', note: 'A first gift or a first finished invitation — the ice is melting.' },
  { minCount: 3, label: 'Familiar Face', note: 'Neighbors smile a beat sooner when you come up the lane.' },
  { minCount: 6, label: 'Fast Friend', note: 'Your name comes up warmly at the tea tables.' },
  { minCount: 10, label: 'Heart of the Lane', note: 'The neighborhood has quietly rearranged itself around you.' },
];

const COMMUNITY_TIERS: readonly EverydayPracticeTier[] = [
  { minCount: 0, label: 'Unmarked Shelf', note: 'The plaza basket sits open; nothing is owed to it.' },
  { minCount: 1, label: 'First Helping Hand', note: 'One small find tucked into the basket started it all.' },
  { minCount: 4, label: 'Shelf Contributor', note: 'The shelves fill a little faster with your pocket finds.' },
  { minCount: 8, label: 'Community Regular', note: 'Neighbors check the basket and think of you.' },
  { minCount: 12, label: 'Pillar of the Plaza', note: 'The town’s shelves hold a little of everything you gathered.' },
];

const FISHING_TIERS: readonly EverydayPracticeTier[] = [
  { minCount: 0, label: 'Untried Water', note: 'The jetty boards are dry; the pond keeps its own counsel.' },
  { minCount: 1, label: 'First Catch', note: 'The willow jetty knows your footsteps now.' },
  { minCount: 4, label: 'Patient Angler', note: 'You and the pond have settled into a quiet rhythm.' },
  { minCount: 9, label: 'Reader of Ripples', note: 'Seasons change the pond, and the pond changes you back.' },
];

const PHOTOGRAPHY_TIERS: readonly EverydayPracticeTier[] = [
  { minCount: 0, label: 'Unframed', note: 'The camera waits in its case; the lane has not yet been noticed.' },
  { minCount: 1, label: 'First Frame', note: 'One view held still — your first photograph sits on the cottage shelf.' },
  { minCount: 3, label: 'Quiet Observer', note: 'Neighbors notice you carrying the camera; the lane looks back.' },
  { minCount: 6, label: 'Noticer of Small Things', note: 'You see the views the rest of the lane walks right past.' },
  { minCount: 10, label: `Keeper of the Lane's Light`, note: 'The neighborhood’s quiet views add up to a portrait only you have framed.' },
];

const PRACTICE_DEFS: Record<EverydayPracticeId, EverydayPracticeDef> = {
  gardening: {
    id: 'gardening',
    label: 'Quiet Hours in the Beds',
    blurb:
      'Watering the shared pots and tending the window boxes keeps the whole lane in blooms and herbs.',
    readCount: (world) => {
      let total = safeCounter(world.greenhouseState?.totalHarvests);
      const gardens = world.gardens;
      if (gardens && typeof gardens === 'object') {
        for (const g of Object.values(gardens)) {
          if (g) total += safeCounter(g.totalHarvests);
        }
      }
      return total;
    },
    tiers: GARDENING_TIERS,
  },
  kitchen: {
    id: 'kitchen',
    label: 'The Warm Hearth',
    blurb:
      'Kneading dough beside Clara and carrying a warm share home turns any afternoon into a small celebration.',
    readCount: (world) =>
      safeCounter(world.bakeryState?.kneadingSessions) +
      safeCounter(world.bakeryState?.loavesShared),
    tiers: KITCHEN_TIERS,
  },
  reading: {
    id: 'reading',
    label: 'Lamp-lit Pages',
    blurb:
      'A reader’s cup and a slow chapter in the armchair are the quietest kind of holiday.',
    readCount: (world) => safeCounter(world.nookState?.booksRead),
    tiers: READING_TIERS,
  },
  tea_tables: {
    id: 'tea_tables',
    label: 'Tea & Small Tables',
    blurb:
      'Every cup poured at a neighbor’s kettle steeps a little friendship into the day.',
    readCount: (world) =>
      safeCounter(world.nookState?.teasShared) +
      safeCounter(world.copperwheelState?.teasShared),
    tiers: TEA_TABLES_TIERS,
  },
  mending: {
    id: 'mending',
    label: 'The Copper Bench',
    blurb:
      'Watching Arthur’s fine work and lending steady hands keeps the lane’s little clocks ticking.',
    readCount: (world) =>
      safeCounter(world.copperwheelState?.projectsAdmired) +
      safeCounter(world.copperwheelState?.windingSessions),
    tiers: MENDING_TIERS,
  },
  wilds: {
    id: 'wilds',
    label: 'The Wild Hollows',
    blurb:
      'The wild hollows reward slow steps — every path found is a small discovery to keep.',
    readCount: (world) => safeCounter(countExploredDiscoveries(world)),
    tiers: WILDS_TIERS,
  },
  fishing: {
    id: 'fishing',
    label: 'Quiet Waters',
    blurb:
      'One unhurried cast a day at the willow jetty — the pond offers whatever the season keeps.',
    readCount: (world) => safeCounter(world.sideFlags?.fishingCatchesCount),
    tiers: FISHING_TIERS,
  },
  friendship: {
    id: 'friendship',
    label: 'Neighborhood Ties',
    blurb:
      'Small hellos, shared tables, and finished invitations weave the lane’s warmest ties.',
    readCount: (world) =>
      countUniqueGiftRecipients(world) + countCompletedInvitations(world),
    tiers: FRIENDSHIP_TIERS,
  },
  community: {
    id: 'community',
    label: 'Community Shelves',
    blurb:
      'Leaving a bloom or a field find in the plaza basket helps build something the whole town keeps.',
    readCount: (world) => safeCounter(countCommunityContributions(world)),
    tiers: COMMUNITY_TIERS,
  },
  photography: {
    id: 'photography',
    label: `The Camera's Eye`,
    blurb:
      'Carrying the camera outdoors and framing the lane’s small views turns noticing into a quiet habit.',
    readCount: (world) => safeCounter(world.sideFlags?.photoCount),
    tiers: PHOTOGRAPHY_TIERS,
  },
};

// --- defensive read helpers ------------------------------------------------------------

/**
 * Clamp any counter read to an honest non-negative integer. Missing, undefined,
 * NaN, negative, or non-finite values all degrade to 0 — the profile NEVER throws
 * on hand-edited or partially hydrated saves.
 */
function safeCounter(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  return raw > 0 ? Math.floor(raw) : 0;
}

function countUniqueGiftRecipients(world: WorldState): number {
  const gifts = world.neighborGiftsReceived;
  if (!Array.isArray(gifts)) return 0;
  return new Set(gifts).size;
}

function countCompletedInvitations(world: WorldState): number {
  const history = world.invitations?.history;
  if (!Array.isArray(history)) return 0;
  let completed = 0;
  for (const entry of history) {
    if (entry && typeof entry === 'object' && entry.outcome === 'completed') completed += 1;
  }
  return completed;
}

// --- tier math ------------------------------------------------------------------------

interface ResolvedTier {
  index: number;
  tier: EverydayPracticeTier;
  next: EverydayPracticeTier | null;
}

/**
 * Tier = the highest ladder rung whose minCount <= count.
 * Ladders are authored ascending starting at 0, so a plain scan suffices.
 */
function resolveTier(ladder: readonly EverydayPracticeTier[], count: number): ResolvedTier {
  let index = 0;
  for (let i = 0; i < ladder.length; i++) {
    if (count >= ladder[i].minCount) index = i;
    else break;
  }
  return {
    index,
    tier: ladder[index],
    next: index + 1 < ladder.length ? ladder[index + 1] : null,
  };
}

// --- touchedToday ----------------------------------------------------------------------

/**
 * Which practices the player touched today, from `dailyActivities` booleans/counters
 * and the interior day-stamps (via the canonical `isDoneToday` idiom). Deduplicated,
 * ordered by the canonical practice order. Missing slices simply stay untouched.
 */
function deriveTouchedToday(world: WorldState, day: number): EverydayPracticeId[] {
  const touched = new Set<EverydayPracticeId>();

  const daily = world.dailyActivities;
  if (daily && typeof daily === 'object') {
    if (
      daily.cottagePlanterTendedToday ||
      daily.greenhousePlantersTendedToday ||
      daily.orchardHarvestedToday
    ) {
      touched.add('gardening');
    }
    if (daily.pondCombedToday) touched.add('wilds');
    if (safeCounter(daily.bakedCountToday) > 0) touched.add('kitchen');
    if (Array.isArray(daily.giftedResidentsToday) && daily.giftedResidentsToday.length > 0) {
      touched.add('friendship');
    }
  }

  // Gardening Expansion — outdoor garden tending counts as gardening practice.
  // Any garden with lastTendedDay === today was tended (planted, watered, or
  // harvested) by the player. Uses the garden's own lastTendedDay stamp, not
  // a separate daily boolean — so no new dailyActivities field is needed.
  const gardens = world.gardens;
  if (gardens && typeof gardens === 'object') {
    for (const gardenId of Object.keys(gardens)) {
      const g = gardens[gardenId];
      if (g && g.lastTendedDay === day) {
        touched.add('gardening');
        break;
      }
    }
  }

  const bakery = world.bakeryState;
  if (bakery && typeof bakery === 'object') {
    if (isDoneToday(bakery.kneadedDay, day) || isDoneToday(bakery.loafSharedDay, day)) {
      touched.add('kitchen');
    }
  }

  const nook = world.nookState;
  if (nook && typeof nook === 'object') {
    if (isDoneToday(nook.shelfBrowsedDay, day)) touched.add('reading');
    if (isDoneToday(nook.teaSharedDay, day)) touched.add('tea_tables');
  }

  const copperwheel = world.copperwheelState;
  if (copperwheel && typeof copperwheel === 'object') {
    if (isDoneToday(copperwheel.teaSharedDay, day)) touched.add('tea_tables');
    if (isDoneToday(copperwheel.benchCheckedDay, day)) touched.add('mending');
  }

  // Stage 3: the Willow Jetty day-stamp (sideFlags) gates fishing, same
  // canonical isDoneToday idiom as the interior stamps above.
  if (isDoneToday(Number(world.sideFlags?.fishingLastDay), day)) {
    touched.add('fishing');
  }

  // Stage 3 Continuation: the photography day-stamp (sideFlags) gates the
  // camera practice. Photography has no day-gate (multiple captures per day
  // are allowed) but the day-stamp records that the practice was touched
  // today, mirroring the fishing idiom.
  if (isDoneToday(Number(world.sideFlags?.photoLastDay), day)) {
    touched.add('photography');
  }

  // Stage 2 Community Projects: the communityLastDay sideFlag (stamped by
  // contributeToCommunityProject) gates the 'community' touched-today signal
  // (R-2 fix — previously the community practice had no today-channel).
  if (isDoneToday(Number(world.sideFlags?.communityLastDay), day)) {
    touched.add('community');
  }

  // Stable canonical order, deduplicated by the Set above.
  return EVERYDAY_PRACTICE_ORDER.filter((id) => touched.has(id));
}

// --- keeper title ----------------------------------------------------------------------

/**
 * One gentle overall title derived from the sum of tier indices across all nine
 * practices (tiers run 0..4 except fishing's 0..3). Buckets: 0 · 1–5 · 6–11 · 12–17 · 18+.
 */
export function deriveKeeperTitle(tierIndexSum: number): string {
  if (tierIndexSum <= 0) return 'A Quiet Start';
  if (tierIndexSum <= 5) return 'A Neighbor of Little Somewhere';
  if (tierIndexSum <= 11) return 'A Regular Around the Lane';
  if (tierIndexSum <= 17) return 'A Keeper of Small Rituals';
  return 'The Heart of Little Somewhere';
}

// --- public derivation -------------------------------------------------------------------

/**
 * Derive the everyday practice profile from authoritative world state.
 * Pure; deterministic; identical world → identical output; persists nothing.
 */
export function deriveEverydayPracticeProfile(world: WorldState): EverydayPracticeProfile {
  const day = Number.isFinite(world.day) ? world.day : 1;

  const practices: EverydayPracticeView[] = [];
  let tierIndexSum = 0;

  for (const id of EVERYDAY_PRACTICE_ORDER) {
    const def = PRACTICE_DEFS[id];
    const count = def.readCount(world);
    const { index, tier, next } = resolveTier(def.tiers, count);
    tierIndexSum += index;
    practices.push({
      id,
      label: def.label,
      blurb: def.blurb,
      count,
      tierLabel: tier.label,
      tierNote: tier.note,
      nextTierLabel: next ? next.label : null,
      nextAt: next ? next.minCount : null,
    });
  }

  return {
    practices,
    touchedToday: deriveTouchedToday(world, day),
    keeperTitle: deriveKeeperTitle(tierIndexSum),
  };
}

// --- journal/UI presentation helper -------------------------------------------------------

/**
 * Player-legible closing line for the practice card: lists today's touched
 * practices (ids rendered as gentle words: 'tea_tables' → 'tea tables'), or the
 * patient no-news line when the day is still unshaped.
 */
export function formatTouchedTodayLine(touched: readonly EverydayPracticeId[]): string {
  if (touched.length === 0) {
    return 'Nothing tended yet today — the porch is patient.';
  }
  const touchedWords = touched.map((id) => id.replace(/_/g, ' '));
  return `Touched today: ${touchedWords.join(', ')}`;
}
