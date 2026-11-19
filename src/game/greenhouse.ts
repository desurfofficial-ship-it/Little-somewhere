import {
  GreenhouseCropId,
  GreenhouseGrowthStage,
  GreenhouseInteractableId,
  GreenhousePlotState,
  GreenhouseState,
  InteractiveTarget,
  SeasonType,
  Vec2,
  WorldState,
} from './types';
import { PERSONAL_ITEM_MAP } from './inventory';
import { computeFacingAlignment, distance2D } from './worldMap';

/**
 * Sunbeam Greenhouse enterable interior (Milestone 3 Build 6).
 *
 * The greenhouse uses the same local-coordinate cutaway pattern as Willow Step Cottage:
 * the interior is its own small room centered on the origin, with its own obstacle table,
 * walkability grid, hub-routed waypoints, and station registry. `GREENHOUSE_BOUNDS` and
 * `GREENHOUSE_INTERIOR_OBSTACLES` must stay mirrored by `src/scene/builders/greenhouseInterior.ts`
 * (enforced by tests on both sides).
 */
export const GREENHOUSE_BOUNDS = {
  minX: -3.02,
  maxX: 3.02,
  minZ: -2.62,
  maxZ: 2.62,
} as const;

/** Exterior door approach spot (world coordinates) just outside the greenhouse west wall. */
export const GREENHOUSE_DOOR_POS: Vec2 = { x: 10.15, z: 3.2 };
export const GREENHOUSE_PORCH_EXIT_POS: Vec2 = { x: 9.9, z: 3.2 };
export const GREENHOUSE_PORCH_EXIT_FACING = Math.PI * 0.5; // Facing east toward the glasshouse door

export const GREENHOUSE_DOOR_SPAWN: Vec2 = { x: 2.3, z: -0.4 };
export const GREENHOUSE_DOOR_DEFAULT_FACING = -Math.PI * 0.5; // Facing inward west into the room

export interface GreenhouseInteriorBoxObstacle {
  id: GreenhouseInteractableId;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const GREENHOUSE_INTERIOR_OBSTACLES: readonly GreenhouseInteriorBoxObstacle[] = [
  // Cedar potting bench along the north-west wall
  { id: 'greenhouse_potting', minX: -2.9, maxX: -0.95, minZ: -2.58, maxZ: -1.72 },
  // Long growing shelf with the four shared plots along the west wall
  { id: 'greenhouse_shelf', minX: -2.98, maxX: -2.28, minZ: -1.25, maxZ: 1.35 },
  // Rain barrel + copper watering can station in the north-east corner
  { id: 'greenhouse_water', minX: 1.6, maxX: 2.55, minZ: -2.58, maxZ: -1.78 },
  // Mina's oak worktable against the south wall
  { id: 'greenhouse_table', minX: -0.95, maxX: 1.15, minZ: 1.72, maxZ: 2.58 },
];

export interface GreenhouseInteractable {
  id: GreenhouseInteractableId;
  name: string;
  x: number;
  z: number;
  focusX: number;
  focusZ: number;
  interactRadius: number;
  actionLabel: string;
}

export const GREENHOUSE_INTERACTABLES: readonly GreenhouseInteractable[] = [
  {
    id: 'greenhouse_door',
    name: 'Glasshouse Door',
    x: 2.5,
    z: -0.4,
    focusX: 3.1,
    focusZ: -0.4,
    interactRadius: 1.9,
    actionLabel: 'Step Outside',
  },
  {
    id: 'greenhouse_potting',
    name: 'Potting Bench & Seed Drawers',
    x: -1.5,
    z: -1.1,
    focusX: -1.9,
    focusZ: -2.45,
    interactRadius: 1.85,
    actionLabel: 'Sow Seeds in a Pot',
  },
  {
    id: 'greenhouse_shelf',
    name: 'Growing Shelf',
    x: -1.7,
    z: 0.1,
    focusX: -2.85,
    focusZ: 0.1,
    interactRadius: 1.9,
    actionLabel: 'Check Growing Pots',
  },
  {
    id: 'greenhouse_water',
    name: 'Rain Barrel & Watering Can',
    x: 2.05,
    z: -1.15,
    focusX: 2.05,
    focusZ: -2.4,
    interactRadius: 1.8,
    actionLabel: 'Water the Pots',
  },
  {
    id: 'greenhouse_table',
    name: 'Mina’s Worktable & Field Notes',
    x: 0.1,
    z: 1.1,
    focusX: 0.1,
    focusZ: 2.4,
    interactRadius: 1.85,
    actionLabel: 'Read Mina’s Planting Notes',
  },
];

// ---------------------------------------------------------------------------
// Crops & plots
// ---------------------------------------------------------------------------

export const GREENHOUSE_PLOT_COUNT = 4;

export interface GreenhouseCropDef {
  id: GreenhouseCropId;
  label: string;
  seedItemId: 'chamomile_seeds' | 'lavender_seeds' | 'thyme_seeds';
  cropItemId: 'chamomile_blossom' | 'lavender_sprig' | 'lemon_thyme';
  /** Watered in-game nights needed from sowing until the pot is ready to harvest. */
  growthNights: number;
  /** Harvest yield of the crop item (a seed of the same crop is always returned). */
  harvestCount: number;
  blurb: string;
}

export const GREENHOUSE_CROPS: readonly GreenhouseCropDef[] = [
  {
    id: 'chamomile',
    label: 'Chamomile',
    seedItemId: 'chamomile_seeds',
    cropItemId: 'chamomile_blossom',
    growthNights: 2,
    harvestCount: 2,
    blurb: 'Honey-scented white blossoms that love a sunny sill — ready after two gentle nights.',
  },
  {
    id: 'lavender',
    label: 'Sweet Lavender',
    seedItemId: 'lavender_seeds',
    cropItemId: 'lavender_sprig',
    growthNights: 2,
    harvestCount: 2,
    blurb: 'Fragrant violet stalks for biscuits, vases, and quiet drawers — ready after two nights.',
  },
  {
    id: 'thyme',
    label: 'Lemon Thyme',
    seedItemId: 'thyme_seeds',
    cropItemId: 'lemon_thyme',
    growthNights: 3,
    harvestCount: 2,
    blurb: 'A patient kitchen herb that sings in warm sourdough — ready after three nights.',
  },
];

const GREENHOUSE_CROP_MAP: Record<GreenhouseCropId, GreenhouseCropDef> = GREENHOUSE_CROPS.reduce(
  (acc, crop) => {
    acc[crop.id] = crop;
    return acc;
  },
  {} as Record<GreenhouseCropId, GreenhouseCropDef>,
);

export function getGreenhouseCrop(cropId: GreenhouseCropId | null | undefined): GreenhouseCropDef | null {
  if (!cropId) return null;
  return GREENHOUSE_CROP_MAP[cropId] ?? null;
}

export function getGreenhouseCropBySeed(
  seedItemId: 'chamomile_seeds' | 'lavender_seeds' | 'thyme_seeds',
): GreenhouseCropDef | null {
  return GREENHOUSE_CROPS.find((c) => c.seedItemId === seedItemId) ?? null;
}

/** Field-note planting time and watering time in in-game minutes. */
export const GREENHOUSE_PLANT_MINUTES = 10;
export const GREENHOUSE_WATER_MINUTES = 8;
export const GREENHOUSE_HARVEST_MINUTES = 12;
export const GREENHOUSE_NOTE_READ_MINUTES = 8;

export function createInitialGreenhousePlot(): GreenhousePlotState {
  return {
    cropId: null,
    plantedDay: 0,
    nightsGrown: 0,
    stage: 0,
    wateredToday: false,
  };
}

export function createInitialGreenhouseState(): GreenhouseState {
  return {
    plots: Array.from({ length: GREENHOUSE_PLOT_COUNT }, () => createInitialGreenhousePlot()),
    noteReadDay: 0,
    totalHarvests: 0,
    totalPlanted: 0,
  };
}

/**
 * Nightly growth advance applied inside `advanceToNextDay`.
 * A watered pot grows one stage-step per night (see `stageForNights`); an unwatered pot
 * simply waits — nothing ever withers. In winter all growth rests until spring.
 */
export function advanceGreenhouseNightlyGrowthInPlace(
  state: GreenhouseState,
  nextSeason: SeasonType,
): GreenhouseState {
  for (const plot of state.plots) {
    if (!plot.cropId) continue;
    if (plot.stage < 3) {
      if (nextSeason !== 'winter' && plot.wateredToday) {
        plot.nightsGrown += 1;
        plot.stage = stageForNights(plot.nightsGrown, GREENHOUSE_CROP_MAP[plot.cropId].growthNights);
      }
    }
    plot.wateredToday = false;
  }
  return state;
}

/** Deterministic stage mapping: sprout → leafy → ready, paced by the crop's growth nights. */
export function stageForNights(nightsGrown: number, growthNights: number): GreenhouseGrowthStage {
  if (nightsGrown >= growthNights) return 3;
  return Math.min(2, Math.max(0, nightsGrown)) as GreenhouseGrowthStage;
}

export interface GreenhouseSummary {
  emptyPlots: number;
  growingPlots: number;
  thirstyPlots: number;
  readyPlots: number;
  totalPlots: number;
}

export function summarizeGreenhousePlots(state: GreenhouseState | null | undefined): GreenhouseSummary {
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
  return {
    emptyPlots,
    growingPlots,
    thirstyPlots,
    readyPlots,
    totalPlots: plots.length || GREENHOUSE_PLOT_COUNT,
  };
}

export function describeGreenhouseStage(stage: GreenhouseGrowthStage, cropId: GreenhouseCropId | null): string {
  if (!cropId) return 'An empty terracotta pot with fresh potting soil.';
  const crop = getGreenhouseCrop(cropId);
  const label = crop?.label ?? 'seedling';
  switch (stage) {
    case 0:
      return `Newly sown ${label} seeds tucked under a fine layer of soil.`;
    case 1:
      return `A brave little ${label} sprout has pushed up its first leaves.`;
    case 2:
      return `Leafy young ${label} fills its pot, growing stronger every day.`;
    case 3:
      return `The ${label} is thriving — ready for a gentle harvest.`;
  }
}

// ---------------------------------------------------------------------------
// Interior walkability & routing (mirrors the cottage interior contract)
// ---------------------------------------------------------------------------

export function isGreenhouseInteriorWalkable(x: number, z: number, actorRadius = 0.42): boolean {
  if (
    x < GREENHOUSE_BOUNDS.minX + actorRadius ||
    x > GREENHOUSE_BOUNDS.maxX - actorRadius ||
    z < GREENHOUSE_BOUNDS.minZ + actorRadius ||
    z > GREENHOUSE_BOUNDS.maxZ - actorRadius
  ) {
    return false;
  }
  for (const box of GREENHOUSE_INTERIOR_OBSTACLES) {
    if (
      x > box.minX - actorRadius &&
      x < box.maxX + actorRadius &&
      z > box.minZ - actorRadius &&
      z < box.maxZ + actorRadius
    ) {
      return false;
    }
  }
  return true;
}

export function resolveGreenhouseInteriorMovement(
  current: Vec2,
  desired: Vec2,
  actorRadius = 0.42,
): Vec2 {
  if (isGreenhouseInteriorWalkable(desired.x, desired.z, actorRadius)) {
    return desired;
  }
  if (isGreenhouseInteriorWalkable(desired.x, current.z, actorRadius)) {
    return { x: desired.x, z: current.z };
  }
  if (isGreenhouseInteriorWalkable(current.x, desired.z, actorRadius)) {
    return { x: current.x, z: desired.z };
  }
  return current;
}

const GREENHOUSE_INTERIOR_HUBS: readonly Vec2[] = [
  { x: 0.2, z: 0.0 }, // Central open aisle between shelf, bench, and table
  { x: -1.15, z: -0.75 }, // West aisle between growing shelf and potting bench
  { x: 1.35, z: -0.5 }, // East aisle near the door and barrel corner
  { x: 0.35, z: -1.6 }, // North passage between bench and barrel
  { x: 0.5, z: 1.05 }, // South passage above the worktable
  { x: -1.5, z: 1.35 }, // South-west pocket by the shelf end
];

function isGreenhouseSegmentWalkable(a: Vec2, b: Vec2, actorRadius = 0.42): boolean {
  const dist = distance2D(a, b);
  const steps = Math.max(4, Math.ceil(dist / 0.2));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (!isGreenhouseInteriorWalkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, actorRadius)) {
      return false;
    }
  }
  return true;
}

export function computeGreenhouseWaypoints(from: Vec2, to: Vec2, actorRadius = 0.42): Vec2[] {
  if (isGreenhouseSegmentWalkable(from, to, actorRadius)) {
    return [to];
  }

  let bestSingle: Vec2[] | null = null;
  let bestSingleCost = Infinity;
  for (const hub of GREENHOUSE_INTERIOR_HUBS) {
    if (!isGreenhouseInteriorWalkable(hub.x, hub.z, actorRadius)) continue;
    if (
      isGreenhouseSegmentWalkable(from, hub, actorRadius) &&
      isGreenhouseSegmentWalkable(hub, to, actorRadius)
    ) {
      const cost = distance2D(from, hub) + distance2D(hub, to);
      if (cost < bestSingleCost) {
        bestSingleCost = cost;
        bestSingle = [hub, to];
      }
    }
  }
  if (bestSingle) return bestSingle;

  let bestPair: Vec2[] | null = null;
  let bestPairCost = Infinity;
  for (const h1 of GREENHOUSE_INTERIOR_HUBS) {
    if (!isGreenhouseInteriorWalkable(h1.x, h1.z, actorRadius)) continue;
    if (!isGreenhouseSegmentWalkable(from, h1, actorRadius)) continue;
    for (const h2 of GREENHOUSE_INTERIOR_HUBS) {
      if (h1 === h2) continue;
      if (!isGreenhouseInteriorWalkable(h2.x, h2.z, actorRadius)) continue;
      if (
        isGreenhouseSegmentWalkable(h1, h2, actorRadius) &&
        isGreenhouseSegmentWalkable(h2, to, actorRadius)
      ) {
        const cost = distance2D(from, h1) + distance2D(h1, h2) + distance2D(h2, to);
        if (cost < bestPairCost) {
          bestPairCost = cost;
          bestPair = [h1, h2, to];
        }
      }
    }
  }

  return bestPair ?? [to];
}

/** In-room stand positions for each plot pot on the growing shelf (visual positions live in the rig). */
export const GREENHOUSE_PLOT_SHELF_Z: readonly number[] = [-0.9, -0.3, 0.5, 1.1];

export function selectBestGreenhouseTarget(world: WorldState): InteractiveTarget | null {
  let bestTarget: InteractiveTarget | null = null;
  let bestScore = Infinity;

  for (const prop of GREENHOUSE_INTERACTABLES) {
    const dist = distance2D(world.playerPos, { x: prop.x, z: prop.z });
    const focusDist = distance2D(world.playerPos, { x: prop.focusX, z: prop.focusZ });
    const effDist = Math.min(dist, focusDist);
    if (effDist > prop.interactRadius) continue;

    const align = computeFacingAlignment(world.playerPos, world.playerFacing, {
      x: prop.focusX,
      z: prop.focusZ,
    });
    const facingPenalty = (1 - align) * 0.45;
    const score = effDist + facingPenalty;
    if (score < bestScore) {
      bestScore = score;
      bestTarget = {
        kind: 'greenhouse_prop',
        id: prop.id,
        greenhousePropId: prop.id,
        label: prop.name,
        actionLabel: prop.actionLabel,
        distance: effDist,
        worldPos: { x: prop.focusX, z: prop.focusZ },
      };
    }
  }

  return bestTarget;
}
