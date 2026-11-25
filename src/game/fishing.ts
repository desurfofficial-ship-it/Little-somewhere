/**
 * Willow Jetty — quiet rod fishing at Mirror Pond (Stage 3 vertical slice).
 *
 * Design contract (docs/architecture/stage3-everyday-activities/01-stage3-design.md):
 * - Currency-free, anti-grind, no-fail: every cast is a quiet moment; most days
 *   yield a catch, some days the pond is simply quiet — and that is fine. No
 *   rarity tiers beyond a signature carp, no quotas, no bait economy, no timers,
 *   nothing missable-forever (seasons rotate the pool, never remove access).
 * - One unhurried cast per day (the neighborhood's existing "soft circuit"
 *   cadence — pond combing, greenhouse trays, orchard, window box).
 * - Zero schema bump (D7 registry policy): all persistence rides EXISTING
 *   WorldState containers — `sideFlags` counters (sanctioned free-extension
 *   container, preserved by `sanitizeSideFlags`), `world.memories` journal rows
 *   (dedupe by id, cap 96 at load) and the single satchel via `applyItemGrants`
 *   (the honest-grant path — overflow is reported, never silently destroyed).
 * - Deterministic: per-catch derived RNG streams (`mulberry32(hashSeed(...))`)
 *   exactly like `simulation.ts` block streams. no wall-clock reads of any kind
 *   anywhere — replaying the same save reproduces the same pond.
 * - Interconnection (Workstream B patterns P1/P2/P4): catches are giftable
 *   satchel items → the existing gift chain writes player-gift memories that
 *   dialogue echoes; catches within witness radius write firsthand NPC memories
 *   (same discipline as pond stone-skips) that feed gossip and place affinity.
 *
 * This module is pure and headless (zero DOM/three imports) — fully testable via
 * `tsx --test` per AGENTS.md layer boundaries. Scene presentation for the jetty
 * prop lives in environmentRenderer.ts (static merged rig, no canvas edits).
 */

import { composeEnvironmentState } from './environment';
import { PERSONAL_ITEM_MAP, applyItemGrants } from './inventory';
import {
  LOCAL_WITNESS_RADIUS,
  cloneNpcMemories,
  collectWitnessesForPosition,
  createNpcMemoryEntry,
  recordNpcMemoryInPlace,
} from './memories';
import { getTimePhase } from './residents';
import { hashSeed, mulberry32, seededPick } from './rng';
import { EVENING_SLIPPED_NOTE, isDoneToday, spendMinutes } from './time';
import type { PersonalItemId, WorldState } from './types';

// --- spot definition ------------------------------------------------------------------

export interface FishingSpotDef {
  id: string;
  name: string;
  /** Shore standing point (outside the pond_water walkability exclusion box). */
  x: number;
  z: number;
  /** Interaction radius — matches the worldMap registry row. */
  interactRadius: number;
}

export const FISHING_SPOT: FishingSpotDef = {
  id: 'willow_jetty',
  name: 'Willow Jetty',
  x: -0.8,
  z: 17.6,
  interactRadius: 2.4,
};

const FISHING_MINUTES = 20;

// --- sideFlags keys (the sanctioned zero-migration persistence channel) ---------------

export const FISHING_CATCHES_KEY = 'fishingCatchesCount';
export const FISHING_LAST_DAY_KEY = 'fishingLastDay';

/**
 * NaN/corruption-safe counter read (adversarial QA finding F2 class: bare
 * `Number(sideFlags[key])` can inject NaN into world state). Invalid or
 * non-finite values read as 0; the reducer only ever writes finite integers.
 */
function readCounter(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0
    ? Math.min(Math.floor(raw), Number.MAX_SAFE_INTEGER)
    : 0;
}

// --- catch pools ----------------------------------------------------------------------

/**
 * The pond's quiet residents. New PersonalItemId rows added additively in
 * types.ts + inventory.ts (different union region than the LR-3 PR cluster).
 */
const FISH_ITEM_IDS = {
  common: 'silver_dace',
  evening: 'sun_perch',
  rain: 'rain_trout',
  signature: 'mirror_carp',
  winter: 'ice_perch',
} as const;

/** Pond-adjacent treasures that already exist in the satchel registry. */
const TREASURE_POOL: readonly PersonalItemId[] = [
  'smooth_river_glass',
  'heron_feather',
  'pressed_fern',
];

/** Deterministic quiet-day chance: some days the pond just rests. */
const QUIET_ROLL = 0.14;
const TREASURE_ROLL = 0.34;
const SIGNATURE_ROLL = 0.44;

export interface FishingFirstCatchCopy {
  journalTitle: string;
  journalSummary: string;
}

const FIRST_CATCH_COPY: Record<string, FishingFirstCatchCopy> = {
  [FISH_ITEM_IDS.common]: {
    journalTitle: 'A Silver Dart',
    journalSummary:
      'Caught my first silver dace off the willow jetty — a quick bright flicker that fit in my palm and swam home again in my memory of it.',
  },
  [FISH_ITEM_IDS.evening]: {
    journalTitle: 'Evening Colors',
    journalSummary:
      'A sun perch took the line just as the lanterns came on, its scales holding the last of the golden light.',
  },
  [FISH_ITEM_IDS.rain]: {
    journalTitle: 'Rain’s Quiet Company',
    journalSummary:
      'Fished through a soft rain at the jetty; a speckled trout rose to meet the ripples like it had been waiting for company.',
  },
  [FISH_ITEM_IDS.signature]: {
    journalTitle: 'The Mirror Carp',
    journalSummary:
      'The pond’s namesake at last — a broad mirror carp, calm as a held breath, photographed by memory and returned to the deep.',
  },
  [FISH_ITEM_IDS.winter]: {
    journalTitle: 'Beneath the Ice Sheen',
    journalSummary:
      'An ice perch nosed up to the kept-open gap beside the jetty, bright as a chip of winter sky.',
  },
};

// --- resolution -----------------------------------------------------------------------

function pickSeasonalCatch(
  season: string,
  weatherEffective: string,
  phase: string,
): PersonalItemId {
  if (season === 'winter') return FISH_ITEM_IDS.winter;
  if (weatherEffective === 'light_rain') return FISH_ITEM_IDS.rain;
  if (phase === 'golden' || phase === 'dusk') return FISH_ITEM_IDS.evening;
  return FISH_ITEM_IDS.common;
}

export interface FishingActionResult {
  /** Structurally compatible with actions.ts `PropInteractionResult`. */
  nextWorld: WorldState;
  title: string;
  body: string;
  memoryUnlockedTitle?: string;
  gainedItems?: { itemId: PersonalItemId; count: number }[];
}

/**
 * One unhurried cast at the Willow Jetty. Pure: never mutates the input world.
 * Guards mirror the interior reducers (QA F6): location, distance, active
 * activity, and the once-per-day day-stamp gate (`isDoneToday` idiom).
 */
export function performFishingAction(world: WorldState): FishingActionResult {
  const title = FISHING_SPOT.name;

  // Guard 1 — exterior only (the jetty is an outdoor shore spot).
  if (world.playerLocation !== 'exterior') {
    return {
      nextWorld: world,
      title,
      body: 'The jetty waits by the water’s edge outdoors — finish up inside first, then wander down.',
    };
  }

  // Guard 2 — distance self-check (defense-in-depth; the walk-approach selector
  // normally guarantees this, reducers like plantSeedAtPlotAction double-check).
  const pos = world.playerPos;
  if (
    !pos ||
    Math.sqrt(
      (pos.x - FISHING_SPOT.x) ** 2 + (pos.z - FISHING_SPOT.z) ** 2,
    ) > FISHING_SPOT.interactRadius + 0.35
  ) {
    // Fail closed (defense-in-depth discipline): a partially-built world must
    // never silently bypass the distance guard.
    return {
      nextWorld: world,
      title,
      body: 'The line needs you closer to the water — step to the jetty’s edge and try again.',
    };
  }

  // Guard 3 — one unhurried thing at a time (no dual-activity claim; occupancy
  // and active invitations are never touched by this module).
  if (world.activeActivity) {
    return {
      nextWorld: world,
      title,
      body: 'Something else already holds this hour — finish it, then the pond will wait for you.',
    };
  }

  const sideFlags = { ...(world.sideFlags ?? {}) };
  const lastDay = readCounter(sideFlags[FISHING_LAST_DAY_KEY]);

  // Guard 4 — once per day, the neighborhood's soft-circuit cadence.
  if (isDoneToday(lastDay, world.day)) {
    return {
      nextWorld: world,
      title,
      body:
        'The line is already rested on its reel — one quiet cast a day feels right. Come back tomorrow when the water has had time to change its mind.',
    };
  }

  const composed = composeEnvironmentState(world);
  const season = composed.season.season;
  const weatherEffective = composed.weather.effective;
  const phase = composed.timeOfDay.phase;

  // Deterministic per-catch stream: fresh stream per (seed, day, catch index) so
  // interleaved actions can never shift a pending outcome (stream isolation).
  const prevCatches = readCounter(sideFlags[FISHING_CATCHES_KEY]);
  const castIndex = prevCatches; // 0-based index of this attempt's resolution
  const rand = mulberry32(hashSeed(world.simSeed, world.day, 'fishing_v1', castIndex));
  const roll = rand();

  const pondSpend = spendMinutes(world, FISHING_MINUTES);
  const eveningNote = pondSpend.eveningSlippedAway ? ` ${EVENING_SLIPPED_NOTE}` : '';

  // Quiet day — no item, no counter, no loss. The pond rests; so does the player.
  if (roll < QUIET_ROLL) {
    return {
      nextWorld: {
        ...pondSpend.nextWorld,
        sideFlags: { ...sideFlags, [FISHING_LAST_DAY_KEY]: world.day },
      },
      title,
      body: `${quietWaterLine(season, weatherEffective)} Today the pond keeps its quiet — and quiet is its own kind of catch. (+${FISHING_MINUTES}m)${eveningNote}`,
    };
  }

  let foundId: PersonalItemId;
  if (roll < TREASURE_ROLL) {
    foundId = seededPick(rand, TREASURE_POOL);
  } else if (roll < SIGNATURE_ROLL) {
    foundId = FISH_ITEM_IDS.signature;
  } else {
    foundId = pickSeasonalCatch(season, weatherEffective, phase);
  }

  const foundDef = PERSONAL_ITEM_MAP[foundId];
  const grantRes = applyItemGrants(world.inventory, world.discoveredItemIds, [
    { itemId: foundId, amount: 1 },
  ]);

  const nextCatches = prevCatches + 1;
  const nextSideFlags: Record<string, boolean | number | string> = {
    ...sideFlags,
    [FISHING_CATCHES_KEY]: nextCatches,
    [FISHING_LAST_DAY_KEY]: world.day,
  };

  // First-of-species journal row — the Pocket Journal Memories tab renders it
  // automatically. Dedupe by id; append-only, cap enforced by the sanitizer.
  const memId = `mem_fish_first_${foundId}`;
  const hasMemory = world.memories.some((m) => m.id === memId);
  const copy = FIRST_CATCH_COPY[foundId];
  let memoryUnlockedTitle: string | undefined;
  const nextMemories = hasMemory
    ? world.memories
    : copy
      ? [
          {
            id: memId,
            day: world.day,
            phase: getTimePhase(world.minuteOfDay),
            title: copy.journalTitle,
            summary: copy.journalSummary,
          },
          ...world.memories,
        ]
      : world.memories;
  if (!hasMemory && copy) {
    memoryUnlockedTitle = copy.journalTitle;
  }

  // Witness memories — the pond bank is lived-in (same discipline as pond
  // stone-skips): nearby residents remember seeing you land the catch.
  const nextNpcMemories = cloneNpcMemories(world.npcMemories);
  const witnesses = collectWitnessesForPosition(
    world,
    { x: FISHING_SPOT.x, z: FISHING_SPOT.z },
    LOCAL_WITNESS_RADIUS,
  );
  const fishingEvId = `ev_fishing_${world.day}_${nextCatches}`;
  const roundedMinute = Math.round(world.minuteOfDay);
  for (const wid of witnesses) {
    recordNpcMemoryInPlace(
      nextNpcMemories,
      wid,
      createNpcMemoryEntry({
        id: fishingEvId,
        eventId: fishingEvId,
        tag: 'fishing',
        category: 'event',
        subjectPlayer: true,
        subjectResidents: [wid],
        provenance: 'firsthand',
        sourceKind: 'witness',
        createdDay: world.day,
        createdMinute: roundedMinute,
        importance: 2,
        retention: 'ephemeral',
        valence: 'warm',
        emotionalWeight: 52,
        detail: { personalItemId: foundId, placeName: 'Willow Jetty' },
      }),
      world.day,
    );
  }

  const satchelNote = grantRes.gainedItems.length
    ? `tucked it into your satchel`
    : `satchel already full, so the ${foundDef.label.toLowerCase()} slipped back to the pond — it will swim by again another day`;

  return {
    nextWorld: {
      ...pondSpend.nextWorld,
      inventory: grantRes.inventory,
      discoveredItemIds: grantRes.discoveredItemIds,
      sideFlags: nextSideFlags,
      memories: nextMemories,
      npcMemories: nextNpcMemories,
    },
    title,
    body: `${castLine(season, weatherEffective, phase)} ${foundDef.label} — ${satchelNote}. (+${FISHING_MINUTES}m)${eveningNote}`,
    // Honest chips only: an empty array would promise a gain the satchel refused.
    gainedItems: grantRes.gainedItems.length
      ? grantRes.gainedItems.map((chip) => ({ ...chip }))
      : undefined,
    memoryUnlockedTitle,
  };
}

function quietWaterLine(season: string, weatherEffective: string): string {
  if (season === 'winter') {
    return 'Frost lace holds the shallows still; the ice perch keep to their deep winter channels.';
  }
  if (weatherEffective === 'light_rain') {
    return 'Rain rings drift across the jetty’s ripples, and the trout leave the line alone today.';
  }
  return 'Dragonflies patrol the reeds and the carp drift unhurried beneath the lily pads.';
}

function castLine(season: string, weatherEffective: string, phase: string): string {
  if (season === 'winter') {
    return 'Through the kept-open gap beside the jetty, the line dips into the dark green deep —';
  }
  if (weatherEffective === 'light_rain') {
    return 'A soft rain patters on the water as the line settles under the jetty —';
  }
  if (phase === 'golden' || phase === 'dusk') {
    return 'Lantern light shivers across the pond as the line sinks through gold —';
  }
  return 'The willow’s shade dapples the jetty boards as the line settles —';
}
