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
    ownerId: 'player',
    anchorPropId: 'bakery_herb_bed',
    plotCount: 2,
    allowedCropIds: ['sage', 'thyme', 'lavender'],
  },
  {
    id: 'nook_lavender_bed',
    label: "Nora's Lavender Bed",
    blurb: 'A calming lavender and chamomile border outside the Book Nook — the scent drifts over paperback displays.',
    ownerId: 'player',
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
    ownerId: 'player',
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
