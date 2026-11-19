import {
  CottageHomeState,
  CottageInteractableId,
  DailyActivitiesState,
  InteractiveTarget,
  PersonalItemId,
  SeasonType,
  SeatSpot,
  Vec2,
  WorldState,
} from './types';
import { PERSONAL_ITEM_MAP } from './inventory';
import { computeFacingAlignment, distance2D, getSeatById } from './worldMap';

export const COTTAGE_BOUNDS = {
  minX: -3.5,
  maxX: 3.5,
  minZ: -2.7,
  maxZ: 2.7,
} as const;

export const COTTAGE_DOOR_SPAWN: Vec2 = { x: 2.25, z: 0.0 };
export const COTTAGE_DOOR_DEFAULT_FACING = -Math.PI * 0.5; // Facing inward west into room
export const COTTAGE_WAKE_SPAWN: Vec2 = { x: -1.35, z: -0.75 };
export const COTTAGE_WAKE_FACING = Math.PI * 0.25;
export const COTTAGE_PORCH_EXIT_POS: Vec2 = { x: -9.8, z: 10.0 };
export const COTTAGE_PORCH_EXIT_FACING = Math.PI * 0.5;

export interface InteriorBoxObstacle {
  id: CottageInteractableId | 'wall_rug_corner';
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const COTTAGE_INTERIOR_OBSTACLES: readonly InteriorBoxObstacle[] = [
  // Hearth & kitchen stone stove along north-west wall
  { id: 'cottage_hearth', minX: -3.45, maxX: -0.95, minZ: -2.68, maxZ: -1.68 },
  // Carved timber bed along south-west corner
  { id: 'cottage_bed', minX: -3.42, maxX: -1.55, minZ: 0.85, maxZ: 2.55 },
  // Round oak dining & vase table near center-south
  { id: 'cottage_table', minX: -0.45, maxX: 0.95, minZ: 0.35, maxZ: 1.65 },
  // Keepsake wall shelf & sideboard along north-east wall
  { id: 'cottage_shelf', minX: 0.25, maxX: 2.35, minZ: -2.68, maxZ: -1.88 },
  // Almanac writing desk against south wall east of bed
  { id: 'cottage_desk', minX: 1.35, maxX: 2.95, minZ: 1.8, maxZ: 2.66 },
];

export interface CottageInteractable {
  id: CottageInteractableId;
  name: string;
  x: number;
  z: number;
  focusX: number;
  focusZ: number;
  interactRadius: number;
  actionLabel: string;
}

export const COTTAGE_INTERACTABLES: readonly CottageInteractable[] = [
  {
    id: 'interior_door',
    name: 'Front Porch Door',
    x: 2.85,
    z: 0.0,
    focusX: 3.45,
    focusZ: 0.0,
    interactRadius: 1.9,
    actionLabel: 'Step Outside',
  },
  {
    id: 'cottage_hearth',
    name: 'Kettle & Stone Hearth',
    x: -2.1,
    z: -1.1,
    focusX: -2.15,
    focusZ: -2.2,
    interactRadius: 1.85,
    actionLabel: 'Brew & Bake at Hearth',
  },
  {
    id: 'cottage_table',
    name: 'Oak Table & Vase',
    x: 0.25,
    z: -0.18,
    focusX: 0.25,
    focusZ: 1.0,
    interactRadius: 1.8,
    actionLabel: 'Arrange Table Vase',
  },
  {
    id: 'cottage_shelf',
    name: 'Keepsake Display Shelf',
    x: 1.3,
    z: -1.3,
    focusX: 1.3,
    focusZ: -2.25,
    interactRadius: 1.85,
    actionLabel: 'Arrange Keepsake Shelf',
  },
  {
    id: 'cottage_desk',
    name: 'Window Almanac Desk',
    x: 2.1,
    z: 1.25,
    focusX: 2.15,
    focusZ: 2.2,
    interactRadius: 1.8,
    actionLabel: 'Read Morning Almanac',
  },
  {
    id: 'cottage_planter',
    name: 'Sunlit Sill Planter',
    x: -3.0,
    z: 0.0,
    focusX: -3.5,
    focusZ: 0.0,
    interactRadius: 1.65,
    actionLabel: 'Tend Sill Planter',
  },
  {
    id: 'cottage_bed',
    name: 'Patchwork Quilt Bed',
    x: -1.25,
    z: 0.35,
    focusX: -2.4,
    focusZ: 1.7,
    interactRadius: 1.95,
    actionLabel: 'Rest Until Morning',
  },
];

export const COTTAGE_VASE_ITEMS = new Set<NonNullable<CottageHomeState['placedFlowerId']>>([
  'chamomile_blossom',
  'lavender_sprig',
  'crabapple',
]);

export function createInitialCottageState(): CottageHomeState {
  return {
    placedFlowerId: null,
    displayedKeepsakeIds: [],
    hearthLit: true,
    kettleWarmUntilMinute: 0,
    almanacReadToday: false,
    cottageRestCount: 0,
  };
}

export function createInitialDailyActivities(): DailyActivitiesState {
  return {
    cottagePlanterTendedToday: false,
    greenhousePlantersTendedToday: false,
    orchardHarvestedToday: false,
    pondCombedToday: false,
    bakedCountToday: 0,
    giftedResidentsToday: [],
  };
}

/**
 * Indoor dining seats on the two carved stools tucked under the oak table (Pass 5, everyday-life polish).
 * Seat positions sit exactly on the stool meshes built in `cottageInterior.ts` (table group origin (0.25, 1.0),
 * stool offsets (-0.62, 0.04) / (0.62, -0.06)); approach positions are verified interior-walkable standing spots.
 * Indoor seats are never claimed by NPCs (residents never enter the cottage) and never touch the outdoor
 * `SEAT_SPOTS` registry used by the Milestone 3 autonomous-simulation seat machinery.
 */
export const COTTAGE_SEAT_SPOTS: readonly SeatSpot[] = [
  {
    id: 'cottage_seat_table_west',
    label: 'Oak Table Stool',
    seatPos: { x: -0.37, z: 1.04 },
    approachPos: { x: -1.05, z: 1.0 },
    facingAngle: Math.atan2(0.25 - -0.37, 1.0 - 1.04), // Facing east across the table toward the vase
    seatHeight: 0.46,
    zoneId: 'cottage_interior',
    indoor: true,
  },
  {
    id: 'cottage_seat_table_east',
    label: 'Oak Table Stool',
    seatPos: { x: 0.87, z: 0.94 },
    approachPos: { x: 1.5, z: 0.9 },
    facingAngle: Math.atan2(0.25 - 0.87, 1.0 - 0.94), // Facing west across the table toward the hearth side
    seatHeight: 0.46,
    zoneId: 'cottage_interior',
    indoor: true,
  },
];

/** Resolve a seat by id across both registries — indoor cottage seats first, outdoor benches fallback. */
export function resolveAnySeatById(seatId: string | null | undefined): SeatSpot | undefined {
  if (!seatId) return undefined;
  return COTTAGE_SEAT_SPOTS.find((s) => s.id === seatId) ?? getSeatById(seatId);
}

export function isInteriorPointWalkable(x: number, z: number, actorRadius = 0.42): boolean {
  if (
    x < COTTAGE_BOUNDS.minX + actorRadius ||
    x > COTTAGE_BOUNDS.maxX - actorRadius ||
    z < COTTAGE_BOUNDS.minZ + actorRadius ||
    z > COTTAGE_BOUNDS.maxZ - actorRadius
  ) {
    return false;
  }
  for (const box of COTTAGE_INTERIOR_OBSTACLES) {
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

export function resolveInteriorMovement(current: Vec2, desired: Vec2, actorRadius = 0.42): Vec2 {
  if (isInteriorPointWalkable(desired.x, desired.z, actorRadius)) {
    return desired;
  }
  if (isInteriorPointWalkable(desired.x, current.z, actorRadius)) {
    return { x: desired.x, z: current.z };
  }
  if (isInteriorPointWalkable(current.x, desired.z, actorRadius)) {
    return { x: current.x, z: desired.z };
  }
  return current;
}

const INTERIOR_HUBS: readonly Vec2[] = [
  { x: 0.25, z: -0.45 }, // Center-north open rug space above oak dining table
  { x: -1.15, z: -0.35 }, // West hearth / planter corridor north of bed
  { x: 1.65, z: -0.35 }, // North-east doorway vestibule corner clear of table
  { x: 1.65, z: 0.95 }, // East doorway / desk corridor
  { x: 0.25, z: 2.22 }, // South passage below table
];

function isInteriorSegmentWalkable(a: Vec2, b: Vec2, actorRadius = 0.42): boolean {
  const dist = distance2D(a, b);
  const steps = Math.max(4, Math.ceil(dist / 0.2));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (
      !isInteriorPointWalkable(
        a.x + (b.x - a.x) * t,
        a.z + (b.z - a.z) * t,
        actorRadius,
      )
    ) {
      return false;
    }
  }
  return true;
}

export function computeInteriorWaypoints(
  from: Vec2,
  to: Vec2,
  actorRadius = 0.42,
): Vec2[] {
  if (isInteriorSegmentWalkable(from, to, actorRadius)) {
    return [to];
  }

  let bestSingle: Vec2[] | null = null;
  let bestSingleCost = Infinity;
  for (const hub of INTERIOR_HUBS) {
    if (!isInteriorPointWalkable(hub.x, hub.z, actorRadius)) continue;
    if (
      isInteriorSegmentWalkable(from, hub, actorRadius) &&
      isInteriorSegmentWalkable(hub, to, actorRadius)
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
  for (const h1 of INTERIOR_HUBS) {
    if (!isInteriorPointWalkable(h1.x, h1.z, actorRadius)) continue;
    if (!isInteriorSegmentWalkable(from, h1, actorRadius)) continue;
    for (const h2 of INTERIOR_HUBS) {
      if (h1 === h2) continue;
      if (!isInteriorPointWalkable(h2.x, h2.z, actorRadius)) continue;
      if (
        isInteriorSegmentWalkable(h1, h2, actorRadius) &&
        isInteriorSegmentWalkable(h2, to, actorRadius)
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

export function selectBestInteriorTarget(world: WorldState): InteractiveTarget | null {
  let bestTarget: InteractiveTarget | null = null;
  let bestScore = Infinity;

  const evaluateCandidate = (target: InteractiveTarget, score: number) => {
    if (score < bestScore) {
      bestScore = score;
      bestTarget = target;
    }
  };

  for (const prop of COTTAGE_INTERACTABLES) {
    const dist = distance2D(world.playerPos, { x: prop.x, z: prop.z });
    const focusDist = distance2D(world.playerPos, { x: prop.focusX, z: prop.focusZ });
    const effDist = Math.min(dist, focusDist);
    if (effDist > prop.interactRadius) continue;

    const align = computeFacingAlignment(world.playerPos, world.playerFacing, {
      x: prop.focusX,
      z: prop.focusZ,
    });
    const facingPenalty = (1 - align) * 0.45;
    evaluateCandidate(
      {
        kind: 'cottage_prop',
        id: prop.id,
        cottagePropId: prop.id,
        label: prop.name,
        actionLabel: prop.actionLabel,
        distance: effDist,
        worldPos: { x: prop.focusX, z: prop.focusZ },
      },
      effDist + facingPenalty,
    );
  }

  // Indoor dining seats (Pass 5): offered like outdoor benches, weight slightly behind props
  // so aiming at the hearth/table is never stolen by an adjacent stool.
  for (const seat of COTTAGE_SEAT_SPOTS) {
    const dist = Math.min(
      distance2D(world.playerPos, seat.seatPos),
      distance2D(world.playerPos, seat.approachPos) + 0.35,
    );
    if (dist > 2.0) continue;
    const align = computeFacingAlignment(world.playerPos, world.playerFacing, seat.seatPos);
    const facingPenalty = (1 - align) * 0.45;
    evaluateCandidate(
      {
        kind: 'seat',
        id: seat.id,
        seatId: seat.id,
        label: seat.label,
        actionLabel: `Sit on ${seat.label}`,
        distance: dist,
        worldPos: { ...seat.seatPos },
      },
      dist + facingPenalty + 0.22,
    );
  }

  return bestTarget;
}

export function getSeasonalAlmanacReading(season: SeasonType, day: number): {
  title: string;
  body: string;
} {
  const tips: Record<SeasonType, string[]> = {
    spring: [
      'Chamomile blossoms open fastest on sunny window sills—steep a cup for Arthur or Sora when rain settles in.',
      'Fern Hollow’s first crabapples drop lightly near the northern crates; Clara’s tart glaze loves wild honey.',
      'Toby walks near Mirror Pond’s reed bank most afternoons, collecting smooth pond glass for his sketches.',
    ],
    summer: [
      'Long golden evenings bring neighbors out past Sunbeam Greenhouse; sweet lavender sprigs stay fragrant for days.',
      'Warm sourdough loaves and lavender shortbread travel well along the cobblestone square after mid-afternoon.',
    ],
    autumn: [
      'Autumn fills Fern Hollow Orchard with crisp fruit and deep amber honey—keep your cottage kettle humming.',
      'Pressed fern fronds tucked in Nora’s favorite novels make thoughtful pocket keepsakes as dusk arrives early.',
    ],
    winter: [
      'Frost slows Mirror Pond’s edge, yet hearth bread and chamomile tea lift every neighbor’s afternoon spirits.',
      'Keep your favorite bloom or keepsake displayed on the oak shelf—warm corners anchor quiet winter mornings.',
    ],
  };
  const pool = tips[season] ?? tips.spring;
  return {
    title: `Willow Lane Almanac — Day ${day}`,
    body: pool[(Math.max(1, day) - 1) % pool.length],
  };
}

export function describePlacedFlower(flowerId: CottageHomeState['placedFlowerId']): string {
  if (!flowerId) return 'An empty stoneware pitcher waiting for a fresh bloom or orchard bough.';
  const def = PERSONAL_ITEM_MAP[flowerId as PersonalItemId];
  return def ? `A bright sprig of ${def.label.toLowerCase()} fills the cottage table with quiet color.` : '';
}

/**
 * Pass 10 (Everyday Life polish round 3, EL-18): pure mapping from home state to the
 * exterior chimney's smoke strength. The chimney advertises the hearth — it stays
 * clean while the fire is out and breathes harder while the kettle is still warm.
 * Deterministic, allocation-free, unit-testable.
 */
export function computeChimneySmokeStrength(
  world: Pick<WorldState, 'minuteOfDay' | 'cottageState'>,
): number {
  const cs = world.cottageState;
  if (!cs || !cs.hearthLit) return 0;
  const kettleWarm =
    (cs.kettleWarmUntilMinute ?? 0) > 0 && world.minuteOfDay <= cs.kettleWarmUntilMinute;
  return kettleWarm ? 1.3 : 1;
}
