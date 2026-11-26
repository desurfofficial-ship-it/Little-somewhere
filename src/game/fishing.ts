/**
 * Quiet rod fishing — Willow Jetty & West Brook Bank (Stage 3 vertical slice, v1.1).
 *
 * Design contract (docs/architecture/stage3-everyday-activities/01-stage3-design.md):
 * - Currency-free, anti-grind, no-fail: every cast is a quiet moment; most days
 *   yield a catch, some days the water is simply quiet — and that is fine. No
 *   rarity tiers beyond a signature carp, no quotas, no bait economy, no timers,
 *   nothing missable-forever (seasons rotate the pool, never remove access).
 * - One unhurried cast per day TOTAL across both spots (v1.1): the day stamp is
 *   shared (`FISHING_LAST_DAY_KEY`), so casting at the jetty rests the line at the
 *   brook too. This is the neighborhood's existing "soft circuit" cadence (pond
 *   combing, greenhouse trays, orchard, window box) — and it makes spot-hopping
 *   reroll farming structurally impossible.
 * - Zero schema bump (D7 registry policy): all persistence rides EXISTING
 *   WorldState containers — `sideFlags` counters (sanctioned free-extension
 *   container, preserved by `sanitizeSideFlags`), `world.memories` journal rows
 *   (dedupe by id, cap 96 at load) and the single satchel via `applyItemGrants`
 *   (the honest-grant path — overflow is reported, never silently destroyed).
 * - Deterministic: per-catch derived RNG streams (`mulberry32(hashSeed(...))`)
 *   exactly like `simulation.ts` block streams. no wall-clock reads of any kind
 *   anywhere — replaying the same save reproduces the same water. v1.1 note: the
 *   stream stays SPOT-INDEPENDENT — the day's luck is the day's luck; where you
 *   cast decides who answers, never whether the water is kind.
 * - Interconnection (Workstream B patterns P1/P2/P4): catches are giftable
 *   satchel items → the existing gift chain writes player-gift memories that
 *   dialogue echoes; catches within witness radius write firsthand NPC memories
 *   (same discipline as pond stone-skips) that feed gossip and place affinity.
 *
 * This module is pure and headless (zero DOM/three imports) — fully testable via
 * `tsx --test` per AGENTS.md layer boundaries. Scene presentation for the two
 * bank rigs lives in environmentRenderer.ts (static merged rigs, no canvas edits).
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

// --- spot registry --------------------------------------------------------------------

export interface FishingSpotDef {
  id: string;
  name: string;
  /** Shore standing point (outside every water walkability exclusion box). */
  x: number;
  z: number;
  /** Interaction radius — matches the worldMap registry row. */
  interactRadius: number;
}

/**
 * The quiet waters of the neighborhood (v1.1: two spots, one module table).
 * The willow_jetty entry is byte-identical to the v1 slice — its worldMap row,
 * guard geometry and prose are pinned by regression tests (FISH-02/06/22).
 */
export const FISHING_SPOTS = {
  willow_jetty: {
    id: 'willow_jetty',
    name: 'Willow Jetty',
    x: -0.8,
    z: 17.6,
    interactRadius: 2.4,
  },
  west_brook_bank: {
    id: 'west_brook_bank',
    name: 'West Brook Bank',
    // Slice W1: the stand moved to the stream's NORTH bank — the old south-bank
    // lane (-4.45, 13.9) is now the running brook (west_brook_run). The new
    // stand keeps the bridge to the east, the brook to the south and the oak's
    // east lawn behind; rig + worldMap row + nav mirror stay in lockstep.
    x: -5.5,
    z: 12.35,
    interactRadius: 2.4,
  },
} as const satisfies Record<string, FishingSpotDef>;

export type FishingSpotId = keyof typeof FISHING_SPOTS;

/** Back-compat alias: the original Willow Jetty spot (v1 slice consumers/tests). */
export const FISHING_SPOT: FishingSpotDef = FISHING_SPOTS.willow_jetty;

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
 * The quiet waters' residents — one shared pool for both spots (v1.1 "reuses
 * the module table"): pond and brook are one watershed, and the fish agree.
 * New PersonalItemId rows added additively in types.ts + inventory.ts (different
 * union region than the LR-3 PR cluster).
 */
const FISH_ITEM_IDS = {
  common: 'silver_dace',
  evening: 'sun_perch',
  rain: 'rain_trout',
  signature: 'mirror_carp',
  winter: 'ice_perch',
} as const;

/** Pond- and brook-adjacent treasures that already exist in the satchel registry. */
const TREASURE_POOL: readonly PersonalItemId[] = [
  'smooth_river_glass',
  'heron_feather',
  'pressed_fern',
];

/** Deterministic quiet-day chance: some days the water just rests. */
const QUIET_ROLL = 0.14;
const TREASURE_ROLL = 0.34;
const SIGNATURE_ROLL = 0.44;

export interface FishingFirstCatchCopy {
  journalTitle: string;
  journalSummary: string;
}

/**
 * First-of-species journal copy, per spot (v1.1): the Willow Jetty table is
 * byte-identical to the v1 slice; the West Brook table retells the same
 * discoveries where the water differs. Memory ids stay item-keyed
 * (`mem_fish_first_<itemId>`) — first-of-species is global across the watershed.
 */
const FIRST_CATCH_COPY: Record<FishingSpotId, Record<string, FishingFirstCatchCopy>> = {
  willow_jetty: {
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
  },
  west_brook_bank: {
    [FISH_ITEM_IDS.common]: {
      journalTitle: 'A Silver Dart',
      journalSummary:
        'Caught my first silver dace where the brook slips under the cedar bridge — a quick bright flicker that fit in my palm and swam home again in my memory of it.',
    },
    [FISH_ITEM_IDS.evening]: {
      journalTitle: 'Evening Colors',
      journalSummary:
        'A sun perch took the line just as the bridge lantern came on, its scales holding the last of the golden light.',
    },
    [FISH_ITEM_IDS.rain]: {
      journalTitle: 'Rain’s Quiet Company',
      journalSummary:
        'Fished through a soft rain at the brook’s culvert mouth; a speckled trout rose to meet the running ripples like it had been waiting for company.',
    },
    [FISH_ITEM_IDS.signature]: {
      journalTitle: 'The Mirror Carp',
      journalSummary:
        'The pond’s broad namesake, wandered up the brook to the culvert mouth — calm as a held breath, photographed by memory and returned to the deep.',
    },
    [FISH_ITEM_IDS.winter]: {
      journalTitle: 'Beneath the Ice Sheen',
      journalSummary:
        'An ice perch held in the slow eddy by the culvert wing wall, bright as a chip of winter sky.',
    },
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
 * One unhurried cast at a quiet water (v1.1: Willow Jetty or West Brook Bank).
 * Pure: never mutates the input world. Guards mirror the interior reducers
 * (QA F6): location, distance, active activity, and the once-per-day day-stamp
 * gate (`isDoneToday` idiom) — the day stamp is shared across both spots, so a
 * cast at the jetty rests the line at the brook (and vice versa).
 *
 * `spotId` is the worldMap prop id the cast was made from; it defaults to the
 * v1 Willow Jetty spot. Unknown ids fail closed with the unchanged world.
 */
export function performFishingAction(world: WorldState, spotId: string = 'willow_jetty'): FishingActionResult {
  const spotEntry = (Object.entries(FISHING_SPOTS) as [FishingSpotId, FishingSpotDef][]).find(
    ([key]) => key === spotId,
  );
  if (!spotEntry) {
    // Fail closed (defense-in-depth): an unknown spot never resolves a cast.
    return {
      nextWorld: world,
      title: 'Quiet Waters',
      body: 'That stretch of water is not one of the neighborhood’s quiet fishing places — the jetty and the west brook bank are.',
    };
  }
  const [spotKey, spot] = spotEntry;

  const title = spot.name;

  // Guard 1 — exterior only (both spots are outdoor shore places).
  if (world.playerLocation !== 'exterior') {
    return {
      nextWorld: world,
      title,
      body: `${spot.name} waits by the water’s edge outdoors — finish up inside first, then wander down.`,
    };
  }

  // Guard 2 — distance self-check (defense-in-depth; the walk-approach selector
  // normally guarantees this, reducers like plantSeedAtPlotAction double-check).
  const pos = world.playerPos;
  if (
    !pos ||
    Math.sqrt(
      (pos.x - spot.x) ** 2 + (pos.z - spot.z) ** 2,
    ) > spot.interactRadius + 0.35
  ) {
    // Fail closed (defense-in-depth discipline): a partially-built world must
    // never silently bypass the distance guard.
    return {
      nextWorld: world,
      title,
      body: 'The line needs you closer to the water — step to the bank and try again.',
    };
  }

  // Guard 3 — one unhurried thing at a time (no dual-activity claim; occupancy
  // and active invitations are never touched by this module).
  if (world.activeActivity) {
    return {
      nextWorld: world,
      title,
      body: 'Something else already holds this hour — finish it, then the water will wait for you.',
    };
  }

  const sideFlags = { ...(world.sideFlags ?? {}) };
  const lastDay = readCounter(sideFlags[FISHING_LAST_DAY_KEY]);

  // Guard 4 — once per day TOTAL across both spots (the neighborhood's
  // soft-circuit cadence; also makes spot-hopping reroll farming impossible).
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
  // v1.1: the stream is spot-INDEPENDENT — the day's luck is the day's luck;
  // the spot decides who answers, never whether the water is kind.
  const prevCatches = readCounter(sideFlags[FISHING_CATCHES_KEY]);
  const castIndex = prevCatches; // 0-based index of this attempt's resolution
  const rand = mulberry32(hashSeed(world.simSeed, world.day, 'fishing_v1', castIndex));
  const roll = rand();

  const bankSpend = spendMinutes(world, FISHING_MINUTES);
  const eveningNote = bankSpend.eveningSlippedAway ? ` ${EVENING_SLIPPED_NOTE}` : '';

  // Quiet day — no item, no counter, no loss. The water rests; so does the player.
  if (roll < QUIET_ROLL) {
    return {
      nextWorld: {
        ...bankSpend.nextWorld,
        sideFlags: { ...sideFlags, [FISHING_LAST_DAY_KEY]: world.day },
      },
      title,
      body: `${quietWaterLine(spot, season, weatherEffective)} Today the water keeps its quiet — and quiet is its own kind of catch. (+${FISHING_MINUTES}m)${eveningNote}`,
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
  // automatically. Dedupe by id (item-keyed, global across both spots); append-
  // only, cap enforced by the sanitizer.
  const memId = `mem_fish_first_${foundId}`;
  const hasMemory = world.memories.some((m) => m.id === memId);
  const copy = FIRST_CATCH_COPY[spotKey][foundId];
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

  // Witness memories — both banks are lived-in (same discipline as pond
  // stone-skips): nearby residents remember seeing you land the catch.
  const nextNpcMemories = cloneNpcMemories(world.npcMemories);
  const witnesses = collectWitnessesForPosition(
    world,
    { x: spot.x, z: spot.z },
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
        detail: { personalItemId: foundId, placeName: spot.name },
      }),
      world.day,
    );
  }

  const satchelNote = grantRes.gainedItems.length
    ? `tucked it into your satchel`
    : `satchel already full, so the ${foundDef.label.toLowerCase()} slipped back to the water — it will swim by again another day`;

  return {
    nextWorld: {
      ...bankSpend.nextWorld,
      inventory: grantRes.inventory,
      discoveredItemIds: grantRes.discoveredItemIds,
      sideFlags: nextSideFlags,
      memories: nextMemories,
      npcMemories: nextNpcMemories,
    },
    title,
    body: `${castLine(spot, season, weatherEffective, phase)} ${foundDef.label} — ${satchelNote}. (+${FISHING_MINUTES}m)${eveningNote}`,
    // Honest chips only: an empty array would promise a gain the satchel refused.
    gainedItems: grantRes.gainedItems.length
      ? grantRes.gainedItems.map((chip) => ({ ...chip }))
      : undefined,
    memoryUnlockedTitle,
  };
}

function quietWaterLine(spot: FishingSpotDef, season: string, weatherEffective: string): string {
  if (spot.id === 'west_brook_bank') {
    if (season === 'winter') {
      return 'Frost lace holds the culvert’s eddy still; the perch keep to their deep winter channels under the bridge.';
    }
    if (weatherEffective === 'light_rain') {
      return 'Rain rings drift down the brook toward the culvert mouth, and the trout leave the line alone today.';
    }
    return 'Fern shadows sway on the brook’s far bank and the dace hold in the slow eddy beneath the bridge arch.';
  }
  if (season === 'winter') {
    return 'Frost lace holds the shallows still; the ice perch keep to their deep winter channels.';
  }
  if (weatherEffective === 'light_rain') {
    return 'Rain rings drift across the jetty’s ripples, and the trout leave the line alone today.';
  }
  return 'Dragonflies patrol the reeds and the carp drift unhurried beneath the lily pads.';
}

function castLine(spot: FishingSpotDef, season: string, weatherEffective: string, phase: string): string {
  if (spot.id === 'west_brook_bank') {
    if (season === 'winter') {
      return 'Through the kept-open channel under the bridge arch, the line dips into the dark green deep —';
    }
    if (weatherEffective === 'light_rain') {
      return 'A soft rain patters on the running water as the line settles by the culvert mouth —';
    }
    if (phase === 'golden' || phase === 'dusk') {
      return 'Bridge-lantern light shivers along the brook as the line sinks through gold —';
    }
    return 'The culvert’s clear outflow curls past the wing wall as the line settles —';
  }
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
