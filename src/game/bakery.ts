import {
  BakeryBakeId,
  BakeryInteractableId,
  BakeryState,
  InteractiveTarget,
  PersonalItemId,
  Vec2,
  WorldState,
} from './types';
import { computeFacingAlignment, distance2D } from './worldMap';

/**
 * Hearth & Crumb Bakery enterable interior (Milestone 3 Build 7).
 *
 * The bakery uses the same local-coordinate cutaway pattern as Willow Step Cottage and
 * Sunbeam Greenhouse: the interior is its own small room centered on the origin, with its
 * own obstacle table, walkability grid, hub-routed waypoints, and station registry.
 * `BAKERY_BOUNDS` and `BAKERY_INTERIOR_OBSTACLES` must stay mirrored by
 * `src/scene/builders/bakeryInterior.ts` (enforced by tests on both sides).
 *
 * Design intent (GAME_DESIGN.md): the player is a *neighbor*, never a shopkeeper — the
 * rituals here are helping, tasting, and sharing. No currency, no management loop.
 */
export const BAKERY_BOUNDS = {
  minX: -3.0,
  maxX: 3.0,
  minZ: -2.4,
  maxZ: 2.4,
} as const;

/** Exterior door approach spot (world coordinates) just south of the bakery's porch door. */
export const BAKERY_DOOR_POS: Vec2 = { x: -12.4, z: -7.05 };
export const BAKERY_PORCH_EXIT_POS: Vec2 = { x: -12.4, z: -6.8 };
export const BAKERY_PORCH_EXIT_FACING = Math.PI; // Facing north back toward the warm doorway

export const BAKERY_DOOR_SPAWN: Vec2 = { x: 0.0, z: 1.5 };
export const BAKERY_DOOR_DEFAULT_FACING = Math.PI; // Facing inward north into the kitchen

export interface BakeryInteriorBoxObstacle {
  id: BakeryInteractableId;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const BAKERY_INTERIOR_OBSTACLES: readonly BakeryInteriorBoxObstacle[] = [
  // Brick dome bake oven with hearthstone ledge along the north-west wall.
  // East edge pulled back to -1.15 so the north passage keeps a 1.36 m clear
  // walk band at z=-1.7 (spatial-comfort contract: secondary paths ≥ 1.2 m).
  { id: 'bakery_oven', minX: -2.92, maxX: -1.15, minZ: -2.36, maxZ: -1.5 },
  // Cedar service counter with loaf display along the west wall, now running
  // through to the south wall (maxZ 2.4) — seals the counter-end scrape slot.
  { id: 'bakery_counter', minX: -2.96, maxX: -2.2, minZ: -0.85, maxZ: 2.4 },
  // Flour-dusted prep table along the north-east wall; west edge pulled to 1.05
  // to share the widened north passage with the oven.
  { id: 'bakery_prep', minX: 1.05, maxX: 2.6, minZ: -2.36, maxZ: -1.55 },
  // Round café table with two bentwood chairs near the south-east corner, with
  // the window-settle nook filling the corner to the east wall (maxX 3.0) —
  // seals the table-east sliver and keeps the host seat ≥ 0.95 m from any
  // walkable floor. West edge at 0.9 keeps the 0.8 m turning disc at the
  // central aisle clear of the inflated edge.
  { id: 'bakery_table', minX: 0.9, maxX: 3.0, minZ: 0.85, maxZ: 2.05 },
];

export interface BakeryInteractable {
  id: BakeryInteractableId;
  name: string;
  x: number;
  z: number;
  focusX: number;
  focusZ: number;
  interactRadius: number;
  actionLabel: string;
}

export const BAKERY_INTERACTABLES: readonly BakeryInteractable[] = [
  {
    id: 'bakery_door',
    name: 'Bakery Porch Door',
    x: 0.0,
    z: 1.95,
    focusX: 0.0,
    focusZ: 2.5,
    interactRadius: 1.9,
    actionLabel: 'Step Outside',
  },
  {
    id: 'bakery_oven',
    name: 'Brick Dome Bake Oven',
    x: -1.5,
    z: -0.85,
    focusX: -1.9,
    focusZ: -2.3,
    interactRadius: 1.85,
    actionLabel: 'Check the Morning Bake',
  },
  {
    id: 'bakery_counter',
    name: 'Service Counter & Loaf Shelf',
    x: -1.5,
    z: 0.2,
    focusX: -2.9,
    focusZ: 0.2,
    interactRadius: 1.9,
    actionLabel: 'Share the Morning Loaf',
  },
  {
    id: 'bakery_prep',
    name: 'Flour-Dusted Prep Table',
    x: 1.5,
    z: -0.9,
    focusX: 1.7,
    focusZ: -2.3,
    interactRadius: 1.85,
    actionLabel: 'Help Knead Dough',
  },
  {
    id: 'bakery_notes',
    name: 'Clara’s Recipe Notes Shelf',
    x: 2.2,
    z: 0.2,
    focusX: 2.95,
    focusZ: 0.2,
    interactRadius: 1.7,
    actionLabel: 'Read Clara’s Recipe Notes',
  },
];

// ---------------------------------------------------------------------------
// Deterministic daily bake roster
// ---------------------------------------------------------------------------

export interface BakeryBakeDef {
  id: BakeryBakeId;
  label: string;
  /** Short sensory line for the oven card. */
  blurb: string;
  /** Item Clara sets aside at the counter for a neighbor (null on oven-rest days). */
  shareItemId: PersonalItemId | null;
}

export const BAKERY_BAKES: readonly BakeryBakeDef[] = [
  {
    id: 'sunflower_sourdough',
    label: 'Sunflower Sourdough',
    blurb: 'A crackling golden sourdough studded with toasted sunflower seeds, still singing softly as it cools.',
    shareItemId: 'herb_loaf',
  },
  {
    id: 'crabapple_galette',
    label: 'Orchard Crabapple Galette',
    blurb: 'Rustic folded pastry glazed with spiced Fern Hollow crabapple — the plaza smells like autumn no matter the season.',
    shareItemId: 'crabapple_tart',
  },
  {
    id: 'lavender_butter_batch',
    label: 'Lavender Butter Batch',
    blurb: 'Crisp shortbread biscuits flecked with sweet lavender, lined up in butter-paper rows.',
    shareItemId: 'lavender_shortbread',
  },
  {
    id: 'oven_rest',
    label: 'Oven Resting',
    blurb: 'Today Clara lets the old brick dome rest — embers only, a low warm glow, and the smell of yesterday’s bread.',
    shareItemId: null,
  },
];

/** Deterministic roster: days cycle bake → bake → bake → rest. Pure & unit-testable. */
export function getBakeForDay(day: number): BakeryBakeDef {
  const cycleIndex = ((Math.max(1, Math.floor(day)) - 1) % 4 + 4) % 4;
  return BAKERY_BAKES[cycleIndex];
}

/** In-game minutes spent at each bakery ritual. */
export const BAKERY_CHECK_MINUTES = 8;
export const BAKERY_KNEAD_MINUTES = 12;
export const BAKERY_SHARE_MINUTES = 6;
export const BAKERY_NOTES_MINUTES = 8;

export function createInitialBakeryState(): BakeryState {
  return {
    bakeCheckedDay: 0,
    kneadedDay: 0,
    loafSharedDay: 0,
    notesReadDay: 0,
    starterNotesDay: 0,
    kneadingSessions: 0,
    loavesShared: 0,
  };
}

// ---------------------------------------------------------------------------
// Interior walkability & routing (mirrors the cottage / greenhouse contract)
// ---------------------------------------------------------------------------

export function isBakeryInteriorWalkable(x: number, z: number, actorRadius = 0.42): boolean {
  if (
    x < BAKERY_BOUNDS.minX + actorRadius ||
    x > BAKERY_BOUNDS.maxX - actorRadius ||
    z < BAKERY_BOUNDS.minZ + actorRadius ||
    z > BAKERY_BOUNDS.maxZ - actorRadius
  ) {
    return false;
  }
  for (const box of BAKERY_INTERIOR_OBSTACLES) {
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

export function resolveBakeryInteriorMovement(
  current: Vec2,
  desired: Vec2,
  actorRadius = 0.42,
): Vec2 {
  if (isBakeryInteriorWalkable(desired.x, desired.z, actorRadius)) {
    return desired;
  }
  if (isBakeryInteriorWalkable(desired.x, current.z, actorRadius)) {
    return { x: desired.x, z: current.z };
  }
  if (isBakeryInteriorWalkable(current.x, desired.z, actorRadius)) {
    return { x: current.x, z: desired.z };
  }
  return current;
}

const BAKERY_INTERIOR_HUBS: readonly Vec2[] = [
  { x: -0.35, z: 0.35 }, // Central aisle between counter and café table (turning-disc center)
  { x: -1.5, z: -0.6 }, // West aisle between counter and oven corner
  { x: 1.5, z: -0.75 }, // East aisle between prep table and notes shelf
  { x: 0.0, z: -1.35 }, // North passage below the oven / prep gap
  { x: -0.45, z: 1.6 }, // South passage beside the door mat
  { x: 2.1, z: -0.2 }, // East-aisle pocket by the notes shelf (below the café corner)
  { x: -0.5, z: -1.0 }, // North-passage west mouth, where the oven z-range ends
];

function isBakerySegmentWalkable(a: Vec2, b: Vec2, actorRadius = 0.42): boolean {
  const dist = distance2D(a, b);
  const steps = Math.max(4, Math.ceil(dist / 0.2));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (!isBakeryInteriorWalkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, actorRadius)) {
      return false;
    }
  }
  return true;
}

export function computeBakeryWaypoints(from: Vec2, to: Vec2, actorRadius = 0.42): Vec2[] {
  if (isBakerySegmentWalkable(from, to, actorRadius)) {
    return [to];
  }

  let bestSingle: Vec2[] | null = null;
  let bestSingleCost = Infinity;
  for (const hub of BAKERY_INTERIOR_HUBS) {
    if (!isBakeryInteriorWalkable(hub.x, hub.z, actorRadius)) continue;
    if (
      isBakerySegmentWalkable(from, hub, actorRadius) &&
      isBakerySegmentWalkable(hub, to, actorRadius)
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
  for (const h1 of BAKERY_INTERIOR_HUBS) {
    if (!isBakeryInteriorWalkable(h1.x, h1.z, actorRadius)) continue;
    if (!isBakerySegmentWalkable(from, h1, actorRadius)) continue;
    for (const h2 of BAKERY_INTERIOR_HUBS) {
      if (h1 === h2) continue;
      if (!isBakeryInteriorWalkable(h2.x, h2.z, actorRadius)) continue;
      if (
        isBakerySegmentWalkable(h1, h2, actorRadius) &&
        isBakerySegmentWalkable(h2, to, actorRadius)
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

/** One indoor café-chair seat tucked at the round table's west side (visual mesh lives in the rig at the same spot). */
export const BAKERY_SEAT_SPOTS = [
  {
    id: 'bakery_seat_cafe_west',
    label: 'Café Corner Chair',
    seatPos: { x: 0.73, z: 1.45 },
    approachPos: { x: -0.2, z: 1.4 },
    facingAngle: Math.atan2(1.35 - 0.73, 1.45 - 1.45), // Facing east across the café table
    seatHeight: 0.46,
    zoneId: 'bakery_interior',
    indoor: true,
  },
] as const;

export function selectBestBakeryTarget(world: WorldState): InteractiveTarget | null {
  let bestTarget: InteractiveTarget | null = null;
  let bestScore = Infinity;

  const evaluateCandidate = (target: InteractiveTarget, score: number) => {
    if (score < bestScore) {
      bestScore = score;
      bestTarget = target;
    }
  };

  for (const prop of BAKERY_INTERACTABLES) {
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
        kind: 'bakery_prop',
        id: prop.id,
        bakeryPropId: prop.id,
        label: prop.name,
        actionLabel: prop.actionLabel,
        distance: effDist,
        worldPos: { x: prop.focusX, z: prop.focusZ },
      },
      effDist + facingPenalty,
    );
  }

  // Indoor café-chair seat (M3 Build 7): offered like the cottage stools, weighted
  // slightly behind props so aiming at the counter/oven is never stolen by the chair.
  for (const seat of BAKERY_SEAT_SPOTS) {
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
