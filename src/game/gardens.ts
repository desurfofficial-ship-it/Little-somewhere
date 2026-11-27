/**
 * Gardening Expansion — the Neighborhood Garden Ecosystem.
 *
 * A reusable gardening foundation that extends the greenhouse plot model to
 * multiple garden locations across the neighborhood. The Sunbeam greenhouse
 * stays on `world.greenhouseState` (grandfathered v7); new gardens persist on
 * `world.gardens[id]` (v13). Both share the same plot lifecycle algorithm
 * (nightly growth, care streaks, winter rest, no death).
 *
 * Architecture: registry-first (mirrors GREENHOUSE_CROPS, COMMUNITY_PROJECTS).
 * Each garden is a `GardenDef` entry; its state is a `GardenState` with
 * `GreenhousePlotState[]` plots. Generic reducers dispatch by `gardenId`.
 *
 * Future NPC ownership: `ownerId` field on `GardenDef` supports
 * `'player' | ResidentId | 'community'`. No NPC gardening autonomy is
 * implemented — only the data contract and integration points.
 */
import {
  GardenState,
  GreenhouseCropId,
  GreenhousePlotState,
  PersonalItemId,
  ResidentId,
  SeasonType,
  WorldState,
} from './types';
import {
  GREENHOUSE_CROPS,
  GreenhouseCropDef,
  createInitialGreenhousePlot,
  getGreenhouseCropBySeed,
  isLushStreak,
  stageForNights,
} from './greenhouse';

// ─── Garden definition registry ──────────────────────────────────────────────

export interface GardenDef {
  /** Stable garden id (e.g., 'clara_herb_garden'). */
  id: string;
  /** Display label (e.g., "Clara's Herb Garden"). */
  label: string;
  /** Short description for journal/UI. */
  blurb: string;
  /** Ownership: player now; future NPC gardens use ResidentId. */
  ownerId: 'player' | ResidentId | 'community';
  /** The PropInteractableId that opens this garden's panel. */
  anchorPropId: string;
  /** Number of planting plots (1-4). */
  plotCount: number;
  /** Subset of crops allowed; undefined = all registered crops. */
  allowedCropIds?: readonly GreenhouseCropId[];
  /** Per-garden growth-night overrides; undefined = use crop default. */
  growthNightOverride?: Partial<Record<GreenhouseCropId, number>>;
}

/**
 * The garden registry. Each entry is a garden location in the neighborhood.
 * Add new gardens by appending to this array — no other files need editing
 * for the data model (scene builders and interactables are separate concerns).
 */
export const GARDENS: readonly GardenDef[] = [
  {
    id: 'clara_herb_garden',
    label: "Clara's Herb Garden",
    blurb: 'A culinary herb border along the bakery south wall — sage, thyme, and rosemary for warm sourdough.',
    ownerId: 'clara',
    anchorPropId: 'bakery_herb_bed',
    plotCount: 2,
    allowedCropIds: ['sage', 'thyme', 'lavender'],
  },
  {
    id: 'nook_lavender_bed',
    label: "Nora's Lavender Bed",
    blurb: 'A calming lavender and chamomile border outside the Book Nook — the scent drifts over paperback displays.',
    ownerId: 'nora',
    anchorPropId: 'nook_lavender_bed',
    plotCount: 2,
    allowedCropIds: ['lavender', 'chamomile'],
  },
  {
    id: 'pond_iris_border',
    label: 'Mirror Pond Iris Border',
    blurb: 'A waterside ornamental bed along the pond north shore — foxglove and marigold reflected in still water.',
    ownerId: 'community',
    anchorPropId: 'pond_iris_bed',
    plotCount: 2,
    allowedCropIds: ['foxglove', 'marigold'],
  },
  {
    id: 'beeline_pollinator_bed',
    label: 'Bee Line Pollinator Bed',
    blurb: 'A bee-friendly strip bridging the orchard skep and the wild bee log — marigold and sage for the pollinators.',
    ownerId: 'community',
    anchorPropId: 'beeline_pollinator_bed',
    plotCount: 2,
    allowedCropIds: ['marigold', 'sage', 'lavender'],
  },
  {
    id: 'barnaby_compost_garden',
    label: "Barnaby's Compost Garden",
    blurb: 'A working garden east of the woodshop — fed by cedar-shaving compost, bright with marigold and chamomile.',
    ownerId: 'barnaby',
    anchorPropId: 'barnaby_compost_bed',
    plotCount: 2,
    allowedCropIds: ['marigold', 'chamomile', 'thyme'],
  },
];

const GARDEN_MAP: Record<string, GardenDef> = GARDENS.reduce(
  (acc, g) => {
    acc[g.id] = g;
    return acc;
  },
  {} as Record<string, GardenDef>,
);

export function getGardenDef(id: string): GardenDef | null {
  return GARDEN_MAP[id] ?? null;
}

// ─── Garden state factory ────────────────────────────────────────────────────

export function createInitialGardenState(def: GardenDef): GardenState {
  return {
    plots: Array.from({ length: def.plotCount }, () => createInitialGreenhousePlot()),
    totalHarvests: 0,
    totalPlanted: 0,
    lastTendedDay: 0,
  };
}

/**
 * Reads the garden state from `world.gardens[id]`, creating it lazily if missing.
 * Returns a mutable reference (the caller writes through `world.gardens`).
 */
export function getOrCreateGardenState(world: WorldState, gardenId: string): GardenState | null {
  const def = getGardenDef(gardenId);
  if (!def) return null;
  if (!world.gardens) world.gardens = {};
  if (!world.gardens[gardenId]) {
    world.gardens[gardenId] = createInitialGardenState(def);
  }
  return world.gardens[gardenId]!;
}

/** Read-only garden state reader (returns null if garden doesn't exist). */
export function getGardenState(world: WorldState, gardenId: string): GardenState | null {
  return world.gardens?.[gardenId] ?? null;
}

// ─── Plot-level primitives (pure, shared with greenhouse) ────────────────────

/** Sow a plot in place. */
export function sowPlotInPlace(
  plot: GreenhousePlotState,
  cropId: GreenhouseCropId,
  day: number,
): void {
  plot.cropId = cropId;
  plot.plantedDay = day;
  plot.nightsGrown = 0;
  plot.stage = 0;
  plot.wateredToday = true;
  plot.waterStreak = 0;
}

/** Water a plot in place (sets wateredToday: true). */
export function waterPlotInPlace(plot: GreenhousePlotState): void {
  plot.wateredToday = true;
}

/** Harvest a plot in place: resets to empty, returns yield info. */
export function harvestPlotInPlace(
  plot: GreenhousePlotState,
  cropHarvestCount: number,
  lush: boolean,
): { yieldCount: number } {
  const yieldCount = cropHarvestCount + (lush ? 1 : 0);
  plot.cropId = null;
  plot.plantedDay = 0;
  plot.nightsGrown = 0;
  plot.stage = 0;
  plot.wateredToday = false;
  plot.waterStreak = 0;
  return { yieldCount };
}

/**
 * Nightly growth for one plot in place (extracted from advanceGreenhouseNightlyGrowthInPlace).
 * Same algorithm, same winter rules, same care-streak semantics.
 */
export function advancePlotNightlyGrowthInPlace(
  plot: GreenhousePlotState,
  nextSeason: SeasonType,
  cropGrowthNights: number,
): void {
  if (!plot.cropId) return;
  if (nextSeason === 'winter') {
    plot.waterStreak = 0;
  } else if (plot.stage < 3 && plot.wateredToday) {
    plot.nightsGrown += 1;
    plot.stage = stageForNights(plot.nightsGrown, cropGrowthNights);
    plot.waterStreak += 1;
  } else if (plot.stage < 3 && !plot.wateredToday) {
    plot.waterStreak = 0;
  }
  plot.wateredToday = false;
}

/**
 * Nightly growth for all gardens. Called from advanceToNextDay after the
 * existing greenhouse nightly growth. Same algorithm; different state slice.
 */
export function advanceAllGardensNightlyGrowthInPlace(
  world: WorldState,
  nextSeason: SeasonType,
): void {
  if (!world.gardens) return;
  for (const gardenId of Object.keys(world.gardens)) {
    const state = world.gardens[gardenId];
    if (!state) continue;
    const def = getGardenDef(gardenId);
    for (const plot of state.plots) {
      if (!plot.cropId) continue;
      const cropDef = GREENHOUSE_CROPS.find((c) => c.id === plot.cropId);
      if (!cropDef) continue;
      const growthNights =
        def?.growthNightOverride?.[plot.cropId] ?? cropDef.growthNights;
      advancePlotNightlyGrowthInPlace(plot, nextSeason, growthNights);
    }
  }
}

// ─── Summary (for UI/journal) ────────────────────────────────────────────────

export interface GardenSummary {
  emptyPlots: number;
  growingPlots: number;
  thirstyPlots: number;
  readyPlots: number;
  totalPlots: number;
}

export function summarizeGarden(state: GardenState | null | undefined): GardenSummary {
  const plots = state?.plots ?? [];
  let emptyPlots = 0;
  let growingPlots = 0;
  let thirstyPlots = 0;
  let readyPlots = 0;
  for (const plot of plots) {
    if (!plot.cropId) {
      emptyPlots += 1;
    } else if (plot.stage >= 3) {
      readyPlots += 1;
    } else {
      growingPlots += 1;
      if (!plot.wateredToday) thirstyPlots += 1;
    }
  }
  return { emptyPlots, growingPlots, thirstyPlots, readyPlots, totalPlots: plots.length };
}

// ─── Clone (for pure stepSimulation path) ────────────────────────────────────

export function cloneGardens(
  src?: Partial<Record<string, GardenState>>,
): Partial<Record<string, GardenState>> {
  const out: Partial<Record<string, GardenState>> = {};
  if (!src) return out;
  for (const [id, state] of Object.entries(src)) {
    if (!state) continue;
    out[id] = {
      plots: state.plots.map((p) => ({ ...p })),
      totalHarvests: state.totalHarvests,
      totalPlanted: state.totalPlanted,
      lastTendedDay: state.lastTendedDay,
    };
  }
  return out;
}

// ─── Resident-owned garden autonomous tending ────────────────────────────────

/**
 * NPC-tender variant: reuses plot primitives, skips player-location/inventory
 * guards, grants no items to player inventory. Idempotent per (garden, day)
 * via GardenState.lastTendedDay — fires once when the NPC arrives at their
 * garden bed, then the candidate is de-prioritised for the rest of the day.
 *
 * The NPC "virtually" sources seeds from their allowedCropIds (no inventory
 * needed) and composts harvested crops silently (no item grants). This makes
 * the garden visibly progress without creating an NPC economy.
 *
 * Determinism: no RNG — the crop choice is deterministic (first allowed crop),
 * the action is purely state-driven, and the lastTendedDay gate ensures
 * exactly one tend per in-game day per garden.
 */
export function tendResidentGardenInPlace(
  world: WorldState,
  gardenId: string,
  residentId: ResidentId,
): void {
  const def = getGardenDef(gardenId);
  if (!def) return;
  // Ownership guard: only the owner tends their garden.
  if (def.ownerId !== residentId) return;
  const state = getOrCreateGardenState(world, gardenId);
  if (!state) return;
  // Once-per-day gate: lastTendedDay prevents re-tending within the same day.
  if (state.lastTendedDay === world.day) return;

  let didSomething = false;
  for (const plot of state.plots) {
    if (!plot.cropId) {
      // NPC sows a crop from their garden's allowed list (virtual seed source).
      const cropId = def.allowedCropIds?.[0] ?? 'sage';
      sowPlotInPlace(plot, cropId, world.day);
      state.totalPlanted += 1;
      didSomething = true;
    } else if (plot.stage >= 3) {
      // NPC harvests — crops are composted silently (no inventory grant).
      harvestPlotInPlace(plot, 2, isLushStreak(plot.waterStreak ?? 0));
      state.totalHarvests += 1;
      didSomething = true;
    } else {
      // NPC waters growing plots.
      if (!plot.wateredToday) {
        waterPlotInPlace(plot);
        didSomething = true;
      }
    }
  }
  // D1 fix (adversarial review): stamp lastTendedDay UNCONDITIONALLY after the
  // loop, not only when didSomething. The gate's semantic is "the NPC tended
  // (visited) the garden today" — even if all plots were already watered/growing,
  // the NPC showed up and found nothing to do. Without the unconditional stamp,
  // a no-op tend (all plots growing+watered) would leave the gate open, causing
  // the NPC to re-navigate and re-arrive repeatedly until a plot state changes.
  // Nightly growth resets wateredToday=false, so in normal play didSomething is
  // always true — but the unconditional stamp is defense-in-depth against
  // corrupt saves, future features (e.g. rain waters outdoor beds), and
  // test fixtures that set wateredToday=true without stamping the gate.
  state.lastTendedDay = world.day;
}

/**
 * Returns the garden id the resident should tend next, or null if all their
 * gardens are already tended today.
 *
 * D2 note (adversarial review): this function is currently called only from
 * tests — the production autonomy system (selectActivityForResident in
 * simulation.ts) does NOT consult it before selecting a gardening candidate.
 * The gardening candidate is always in the scoring pool (baseWeight 1.0).
 * The lastTendedDay gate inside tendResidentGardenInPlace prevents actual
 * re-tending, but the NPC may still walk to an already-tended garden and
 * dwell there (a no-op arrival). This is characterful (a resident visiting
 * their garden) but not a resource waste. If future work wants to suppress
 * redundant garden commutes, wire this into selectActivityForResident as a
 * downweight or hard skip — but that is out of scope for this review.
 */
export function residentNeedsToTend(
  world: WorldState,
  residentId: ResidentId,
): string | null {
  for (const def of GARDENS) {
    if (def.ownerId !== residentId) continue;
    const state = getGardenState(world, def.id);
    // Eligible if no state yet (first tend) or lastTendedDay !== today.
    if (!state || state.lastTendedDay !== world.day) {
      return def.id;
    }
  }
  return null;
}
