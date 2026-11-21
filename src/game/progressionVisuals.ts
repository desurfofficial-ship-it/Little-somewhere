/**
 * BUILD 03 — Progression-to-Visual derivation (Doc 07 "Visual Progression Specification",
 * roadmap Phase 5; design lock: docs/art-direction/visual-identity-evolution/
 * implementation/build03-02-progression-visual-specification.md rev 2).
 *
 * PURE derivation layer: reads existing authoritative simulation state, emits the
 * presentation signals the renderer consumes. No mutation, no schema impact, no
 * reducers, no new persisted fields (Doc 07 §7.1 derive-only law; HANDOVER.md
 * "never persist a memento flag — the signals must stay derived").
 *
 * Everything here is derivable, therefore persistence is automatic: an identical
 * saved world reconstructs an identical presentation after load (idempotent).
 *
 * Gates and thresholds (adversarial-review-verified against the code):
 * - Storyline props: sideFlags.<completed> === true OR storylines[id].status === 'completed'
 *   (OR-fallback, review L1 — real saves always sync, hand-built QA saves may not).
 * - Outcome enums clamp to the same fallbacks hydrateStorylinesFromLegacyState uses
 *   (review M8): classic_edition / plaza_table / carved_clef / steady_route /
 *   bridge_compromise.
 * - Friend charm: affinity ≥ 60 (heart level ≥ 3 via getHeartLevel floor(affinity/20)).
 *   Kindred ribbon: affinity ≥ 90 (tier 'kindred', relationships.ts:38-45). (A6/L4)
 * - Keepsake echoes: neighborGiftsReceived ∩ NEIGHBOR_KEEPSAKE_REWARDS — membership
 *   is exactly "reward granted" (actions.ts:3879-3891; review L3 verified).
 * - Memento tiers use reachable monotonic counters (deviations A2/A3):
 *   booksRead ≥2/≥4 (cap 4), greenhouseState.totalHarvests ≥ 3, kneadingSessions ≥ 5.
 * - Season drift convention (review C1, binding): dayOfSeason 1 is byte-equal to the
 *   current authored look in every season; drift departs from that anchor (peak = day
 *   10). Winter never drifts (identity). Posy stage 0 = the new posy group hidden.
 * - revision packing is radix-sum Number arithmetic — NEVER bitwise shifts, which
 *   silently truncate at 32 bits (review H1). Max value stays < 2^53.
 */

import { NEIGHBOR_KEEPSAKE_REWARDS } from './inventory';
import { getHeartLevel } from './relationships';
import { getSeasonForDay } from './time';
import type {
  PersonalItemId,
  ResidentId,
  SeasonType,
  WorldState,
} from './types';

/** 5.2a/b relationship-token thresholds (heart level 3 / kindred tier). */
export const FRIEND_CHARM_AFFINITY = 60;
export const KINDRED_RIBBON_AFFINITY = 90;

/** 5.5 tier thresholds — reachable monotonic counters (deviations A2/A3). */
export const BOOK_STACK_TIER_2_BOOKS = 2;
export const BOOK_STACK_TIER_3_BOOKS = 4;
export const HONEY_DIPPER_HARVESTS = 3;
export const RECIPE_CARD_TIER_2_KNEADS = 5;

/** 5.3c sill-posy day thresholds (non-winter); stage 0 = hidden (parity convention). */
export const POSY_STAGE_1_DAY = 3;
export const POSY_STAGE_2_DAY = 7;

export type ZineTheme = 'art_edition' | 'kitchen_edition' | 'classic_edition';
export type HerbStyle = 'plaza_table' | 'tea_basket';
export type StandStyle = 'carved_clef' | 'weatherproof_oak';
export type WatchStyle = 'steady_route' | 'patient_repair';
export type LanternOutcome = 'bridge_compromise' | 'gentle_space' | 'public_harmony';

export interface ResidentToken {
  residentId: ResidentId;
  kind: 'friend_charm' | 'kindred_ribbon';
}

export interface KeepsakeEcho {
  residentId: ResidentId;
  itemId: PersonalItemId;
}

export interface ProgressionVisualState {
  revision: number;
  storylineProps: {
    zineChalkboard: boolean;
    zineTheme: ZineTheme | null;
    herbWindowCrate: boolean;
    herbStyle: HerbStyle | null;
    musicStand: boolean;
    standStyle: StandStyle | null;
    watchCharm: boolean;
    watchStyle: WatchStyle | null;
    pierSconces: boolean;
    sconceOutcome: LanternOutcome | null;
  };
  residentTokens: readonly ResidentToken[];
  keepsakeEchoes: readonly KeepsakeEcho[];
  seasonDrift: {
    season: SeasonType;
    dayOfSeason: number;
    /** (dayOfSeason - 1) / 9, clamped 0..1; 0 in winter (identity). */
    canopyProgress: number;
    meadowProgress: number;
    posyStage: 0 | 1 | 2;
  };
  explorationMarks: {
    wellRibbon: boolean;
    riseCairn: boolean;
    laneArrow: boolean;
    hiveWreath: boolean;
  };
  mementoTiers: {
    bookStackTier: 1 | 2 | 3;
    honeyDipper: boolean;
    recipeCardTier: 1 | 2;
  };
  housekeeping: {
    noticeboardGlint: boolean;
  };
}

/**
 * Input is a wide Partial of WorldState (same style as composeEnvironmentState) so
 * every existing call site and minimal test fixture keeps compiling. All gates
 * default safely to "nothing earned" when a field is absent.
 */
export type ProgressionWorldInput = Partial<
  Pick<
    WorldState,
    | 'day'
    | 'season'
    | 'sideFlags'
    | 'storylines'
    | 'playerRelations'
    | 'neighborGiftsReceived'
    | 'greenhouseState'
    | 'bakeryState'
    | 'nookState'
  >
> & {
  /** Pre-computed playerChanges.noticeboardUpdated (narrative.ts:66-67) — passed in to avoid logic duplication. */
  noticeboardUpdated?: boolean;
};

// --- outcome clamps (review M8: hydrate fallbacks) ---------------------------------

function clampZineTheme(raw: unknown): ZineTheme {
  return raw === 'art_edition' || raw === 'kitchen_edition' ? raw : 'classic_edition';
}
function clampHerbStyle(raw: unknown): HerbStyle {
  return raw === 'tea_basket' ? 'tea_basket' : 'plaza_table';
}
function clampStandStyle(raw: unknown): StandStyle {
  return raw === 'weatherproof_oak' ? 'weatherproof_oak' : 'carved_clef';
}
function clampWatchStyle(raw: unknown): WatchStyle {
  return raw === 'patient_repair' ? 'patient_repair' : 'steady_route';
}
function clampLanternOutcome(raw: unknown): LanternOutcome {
  return raw === 'gentle_space' || raw === 'public_harmony' ? raw : 'bridge_compromise';
}

function flagTrue(flags: Record<string, boolean | number | string> | undefined, key: string): boolean {
  return flags?.[key] === true;
}

function storylineCompleted(
  storylines: Record<string, { status?: string }> | undefined,
  id: string,
): boolean {
  return storylines?.[id]?.status === 'completed';
}

// --- allocation cheap path (review M5) ---------------------------------------------

const EMPTY_TOKENS: readonly ResidentToken[] = Object.freeze([]);
const EMPTY_ECHOES: readonly KeepsakeEcho[] = Object.freeze([]);

let _lastTokenSignature = -1;
let _cachedTokens: readonly ResidentToken[] = EMPTY_TOKENS;
let _lastEchoSignature = -1;
let _cachedEchoes: readonly KeepsakeEcho[] = EMPTY_ECHOES;

const TOKEN_RESIDENTS: readonly ResidentId[] = [
  'clara',
  'arthur',
  'mina',
  'jun',
  'barnaby',
  'sora',
  'toby',
  'nora',
  'pip',
  'rowan',
];

// --- radix-sum packing (review H1: 2^53-safe, no bitwise) ---------------------------
// Each factor exceeds the maximum value of everything below it.
const R = {
  zineVis: 1, // ×2
  zineTheme: 2, // ×4 (0 + 3 themes)
  herbVis: 8, // ×2
  herbStyle: 16, // ×3
  standVis: 48, // ×2
  standStyle: 96, // ×3
  charmVis: 288, // ×2
  charmStyle: 576, // ×3
  sconceVis: 1728, // ×2
  sconceOutcome: 3456, // ×4
  exploration: 13824, // ×16 (4 marks)
  bookTier: 221184, // ×3
  honeyDipper: 663552, // ×2
  cardTier: 1327104, // ×2
  glint: 2654208, // ×2
  posyStage: 5308416, // ×3
  dayOfSeason: 15925248, // ×10
  tokens: 159252480, // ×59049 (3^10 per-resident states)
  echoes: 9404303761920, // ×32 (5 reward residents)
} as const;
const REVISION_MAX = R.echoes * 32; // ≈ 3.0e14 < 2^53 — safe Number arithmetic.

/**
 * 5.3 drift targets — authored once, cited in the design lock §3.3 (review C1).
 * Progress 0 must render byte-equal to the current look, so the ANCHOR of every
 * lerp is the existing season palette hex (environment.ts SEASON_VISUAL_PALETTES)
 * and these targets are the departures. Winter: identity (no drift).
 */
export const CANOPY_DRIFT_TARGETS: Record<
  Exclude<SeasonType, 'winter'>,
  { base: string; top: string }
> = {
  // Capture-verified revision: the first-authored targets sat too close to the
  // near-white spring/summer anchors to read at gameplay distance (the drift
  // math was proven by tests but the delta was ~invisible). These are the
  // strengthened, capture-checked departures — still within the season's value
  // band, never a palette switch.
  spring: { base: '#ddf0c8', top: '#ffedb0' }, // bud → first-leaf deepening
  summer: { base: '#d2eab8', top: '#ffe49e' }, // fuller warm green
  autumn: { base: '#d08b48', top: '#c86e34' }, // deeper turn
};

/**
 * Derive the full BUILD 03 progression presentation state from authoritative world
 * state. Pure; deterministic; identical world → identical output incl. revision.
 */
export function composeProgressionVisualState(
  world: ProgressionWorldInput,
  /** Override for playerChanges.noticeboardUpdated (environment.ts delegation — avoids a per-frame object spread).
   * When absent, the input's own noticeboardUpdated field is honored. */
  noticeboardUpdatedOverride?: boolean,
): ProgressionVisualState {
  const sideFlags = world.sideFlags;
  const storylines = world.storylines;

  // 5.1 — storyline world props (sideFlags OR storyline-status fallback, review L1).
  // Outcome strings prefer the sideFlags copy (the production writer syncs both) and
  // fall back to the storyline record so hand-built QA saves still tint correctly.
  const zineChalkboard =
    flagTrue(sideFlags, 'pipZinePrinted') || storylineCompleted(storylines, 'side_pip_zine');
  const zineTheme = zineChalkboard
    ? clampZineTheme(
        (sideFlags?.pipZineTheme as string | undefined) ??
          (storylines?.side_pip_zine?.outcome as string | undefined),
      )
    : null;
  const herbWindowCrate =
    flagTrue(sideFlags, 'herbLoafShared') || storylineCompleted(storylines, 'side_herb_loaf');
  const herbStyle = herbWindowCrate
    ? clampHerbStyle(
        (sideFlags?.herbLoafStyle as string | undefined) ??
          (storylines?.side_herb_loaf?.outcome as string | undefined),
      )
    : null;
  const musicStand =
    flagTrue(sideFlags, 'pondStandBuilt') || storylineCompleted(storylines, 'side_pond_stand');
  const standStyle = musicStand
    ? clampStandStyle(
        (sideFlags?.pondStandStyle as string | undefined) ??
          (storylines?.side_pond_stand?.outcome as string | undefined),
      )
    : null;
  const watchCharm =
    flagTrue(sideFlags, 'watchTuneFinished') || storylineCompleted(storylines, 'side_jun_watch');
  const watchStyle = watchCharm
    ? clampWatchStyle(
        (sideFlags?.watchTuneStyle as string | undefined) ??
          (storylines?.side_jun_watch?.outcome as string | undefined),
      )
    : null;
  const pierSconces =
    flagTrue(sideFlags, 'lanternConflictResolved') ||
    storylineCompleted(storylines, 'conflict_plaza_lanterns');
  const sconceOutcome = pierSconces
    ? clampLanternOutcome(
        (sideFlags?.lanternConflictOutcome as string | undefined) ??
          (storylines?.conflict_plaza_lanterns?.outcome as string | undefined),
      )
    : null;

  // 5.2a/b — relationship tokens (affinity thresholds; affinity clamped 0..100 by sanitize)
  const relations = world.playerRelations;
  let tokenSignature = 0;
  let tokens: readonly ResidentToken[] = EMPTY_TOKENS;
  let hasTokens = false;
  for (let i = 0; i < TOKEN_RESIDENTS.length; i++) {
    const affinity = relations?.[TOKEN_RESIDENTS[i]]?.affinity ?? 0;
    const state = affinity >= KINDRED_RIBBON_AFFINITY ? 2 : affinity >= FRIEND_CHARM_AFFINITY ? 1 : 0;
    tokenSignature = tokenSignature + state * Math.pow(3, i);
    if (state > 0) hasTokens = true;
  }
  if (hasTokens) {
    if (tokenSignature !== _lastTokenSignature) {
      const built: ResidentToken[] = [];
      for (const id of TOKEN_RESIDENTS) {
        const affinity = relations?.[id]?.affinity ?? 0;
        if (affinity >= KINDRED_RIBBON_AFFINITY) {
          built.push({ residentId: id, kind: 'kindred_ribbon' });
        } else if (affinity >= FRIEND_CHARM_AFFINITY) {
          built.push({ residentId: id, kind: 'friend_charm' });
        }
      }
      _cachedTokens = Object.freeze(built);
      _lastTokenSignature = tokenSignature;
    }
    tokens = _cachedTokens;
  } else {
    _lastTokenSignature = tokenSignature; // 0
    _cachedTokens = EMPTY_TOKENS;
  }

  // 5.2c — keepsake echoes (neighborGiftsReceived ∩ NEIGHBOR_KEEPSAKE_REWARDS, review L3)
  const received = world.neighborGiftsReceived;
  let echoSignature = 0;
  let echoes: readonly KeepsakeEcho[] = EMPTY_ECHOES;
  if (received && received.length > 0) {
    let hasEchoes = false;
    for (let i = 0; i < NEIGHBOR_KEEPSAKE_REWARDS.length; i++) {
      if (received.indexOf(NEIGHBOR_KEEPSAKE_REWARDS[i].residentId) !== -1) {
        echoSignature = echoSignature + (1 << i);
        hasEchoes = true;
      }
    }
    if (hasEchoes) {
      if (echoSignature !== _lastEchoSignature) {
        const built: KeepsakeEcho[] = [];
        for (const reward of NEIGHBOR_KEEPSAKE_REWARDS) {
          if (received.indexOf(reward.residentId) !== -1) {
            built.push({ residentId: reward.residentId, itemId: reward.itemId });
          }
        }
        _cachedEchoes = Object.freeze(built);
        _lastEchoSignature = echoSignature;
      }
      echoes = _cachedEchoes;
    } else {
      _lastEchoSignature = echoSignature;
      _cachedEchoes = EMPTY_ECHOES;
    }
  } else {
    _lastEchoSignature = 0;
    _cachedEchoes = EMPTY_ECHOES;
  }

  // 5.3 — within-season drift (day-1 parity convention, review C1)
  const season: SeasonType = world.season ?? getSeasonForDay(world.day ?? 1).season;
  const dayOfSeason = Math.max(1, Math.min(10, getSeasonForDay(world.day ?? 1).dayOfSeason));
  const progress = season === 'winter' ? 0 : (dayOfSeason - 1) / 9;
  const posyStage: 0 | 1 | 2 =
    season === 'winter'
      ? 0
      : dayOfSeason >= POSY_STAGE_2_DAY
      ? 2
      : dayOfSeason >= POSY_STAGE_1_DAY
      ? 1
      : 0;

  // 5.4 — exploration marks
  const wellRibbon = flagTrue(sideFlags, 'explored_sorrel_hollow');
  const riseCairn = flagTrue(sideFlags, 'explored_foxglove_rise');
  const laneArrow = flagTrue(sideFlags, 'explored_marigold_lane');
  const hiveWreath = flagTrue(sideFlags, 'explored_bee_line');
  const explorationCode =
    (wellRibbon ? 1 : 0) + (riseCairn ? 2 : 0) + (laneArrow ? 4 : 0) + (hiveWreath ? 8 : 0);

  // 5.5 — tiered mementos (reachable monotonic counters)
  const booksRead = world.nookState?.booksRead ?? 0;
  const bookStackTier: 1 | 2 | 3 =
    booksRead >= BOOK_STACK_TIER_3_BOOKS ? 3 : booksRead >= BOOK_STACK_TIER_2_BOOKS ? 2 : 1;
  const honeyDipper = (world.greenhouseState?.totalHarvests ?? 0) >= HONEY_DIPPER_HARVESTS;
  const kneadingSessions = world.bakeryState?.kneadingSessions ?? 0;
  const recipeCardTier: 1 | 2 = kneadingSessions >= RECIPE_CARD_TIER_2_KNEADS ? 2 : 1;

  // 5.6a — noticeboard glint (passed in from the existing playerChanges derivation)
  const noticeboardGlint = (noticeboardUpdatedOverride ?? world.noticeboardUpdated) === true;

  const revision =
    (zineChalkboard ? 1 : 0) * R.zineVis +
    (zineChalkboard ? clampZineCode(zineTheme) : 0) * R.zineTheme +
    (herbWindowCrate ? 1 : 0) * R.herbVis +
    (herbWindowCrate ? clampHerbCode(herbStyle) : 0) * R.herbStyle +
    (musicStand ? 1 : 0) * R.standVis +
    (musicStand ? clampStandCode(standStyle) : 0) * R.standStyle +
    (watchCharm ? 1 : 0) * R.charmVis +
    (watchCharm ? clampWatchCode(watchStyle) : 0) * R.charmStyle +
    (pierSconces ? 1 : 0) * R.sconceVis +
    (pierSconces ? clampSconceCode(sconceOutcome) : 0) * R.sconceOutcome +
    explorationCode * R.exploration +
    (bookStackTier - 1) * R.bookTier +
    (honeyDipper ? 1 : 0) * R.honeyDipper +
    (recipeCardTier - 1) * R.cardTier +
    (noticeboardGlint ? 1 : 0) * R.glint +
    posyStage * R.posyStage +
    (dayOfSeason - 1) * R.dayOfSeason +
    tokenSignature * R.tokens +
    echoSignature * R.echoes;

  return {
    revision,
    storylineProps: {
      zineChalkboard,
      zineTheme,
      herbWindowCrate,
      herbStyle,
      musicStand,
      standStyle,
      watchCharm,
      watchStyle,
      pierSconces,
      sconceOutcome,
    },
    residentTokens: tokens,
    keepsakeEchoes: echoes,
    seasonDrift: {
      season,
      dayOfSeason,
      canopyProgress: progress,
      meadowProgress: progress,
      posyStage,
    },
    explorationMarks: { wellRibbon, riseCairn, laneArrow, hiveWreath },
    mementoTiers: { bookStackTier, honeyDipper, recipeCardTier },
    housekeeping: { noticeboardGlint },
  };
}

function clampZineCode(v: ZineTheme | null): number {
  return v === 'art_edition' ? 1 : v === 'kitchen_edition' ? 2 : 3;
}
function clampHerbCode(v: HerbStyle | null): number {
  return v === 'tea_basket' ? 2 : 1;
}
function clampStandCode(v: StandStyle | null): number {
  return v === 'weatherproof_oak' ? 2 : 1;
}
function clampWatchCode(v: WatchStyle | null): number {
  return v === 'patient_repair' ? 2 : 1;
}
function clampSconceCode(v: LanternOutcome | null): number {
  return v === 'gentle_space' ? 2 : v === 'public_harmony' ? 3 : 1;
}

/** Test-only guard: the packing headroom claim (review H1). */
export const PROGRESSION_REVISION_MAX = REVISION_MAX;
