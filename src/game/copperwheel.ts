import {
  CopperwheelInteractableId,
  CopperwheelProjectId,
  CopperwheelState,
  InteractiveTarget,
  PersonalItemId,
  Vec2,
  WorldState,
} from './types';
import { computeFacingAlignment, distance2D } from './worldMap';

/**
 * Copperwheel Cottage enterable interior (Milestone 3 Build 9).
 *
 * Arthur's home uses the same local-coordinate cutaway pattern as Willow Step Cottage,
 * Sunbeam Greenhouse, Hearth & Crumb Bakery, and Linden Book Nook: a small room centered
 * on the origin with its own obstacle table, walkability grid, hub-routed waypoints, and
 * station registry. `COPPERWHEEL_BOUNDS` and `COPPERWHEEL_INTERIOR_OBSTACLES` must stay
 * mirrored by `src/scene/builders/copperwheelInterior.ts` (enforced by tests on both sides).
 *
 * Design intent (GAME_DESIGN.md): Arthur is a gentle clockmaker perfectionist who locked
 * away his tools after an old rift — the rituals here are watching his patient work,
 * helping with one small mend, and sharing his beloved chamomile tea. No currency, no
 * management loop: one bench project rests on the felt each day, and the mending ledger
 * remembers every piece that came back to ticking.
 */
export const COPPERWHEEL_BOUNDS = {
  minX: -3.0,
  maxX: 3.0,
  minZ: -2.5,
  maxZ: 2.5,
} as const;

/** Exterior door approach spot (world coordinates) just south of Copperwheel's south door. */
export const COPPERWHEEL_DOOR_POS: Vec2 = { x: 13.1, z: -7.85 };
export const COPPERWHEEL_PORCH_EXIT_POS: Vec2 = { x: 13.1, z: -7.6 };
export const COPPERWHEEL_PORCH_EXIT_FACING = Math.PI; // Facing north back toward the brass-lettered door

export const COPPERWHEEL_DOOR_SPAWN: Vec2 = { x: 1.0, z: 1.75 };
export const COPPERWHEEL_DOOR_DEFAULT_FACING = Math.PI; // Facing inward north into the workshop room

export interface CopperwheelInteriorBoxObstacle {
  id: CopperwheelInteractableId;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const COPPERWHEEL_INTERIOR_OBSTACLES: readonly CopperwheelInteriorBoxObstacle[] = [
  // Clockmaker's workbench with vise, gear trays and felt mat along the north-west wall
  { id: 'cw_bench', minX: -2.92, maxX: -0.25, minZ: -2.42, maxZ: -1.52 },
  // Arthur's bed alcove with quilt and nightstand pocket watch in the north-east corner
  { id: 'cw_bed', minX: 1.35, maxX: 2.92, minZ: -2.42, maxZ: -0.95 },
  // Mended-pieces shelf and drawer cabinet along the west wall
  { id: 'cw_shelf', minX: -2.96, maxX: -2.18, minZ: -0.85, maxZ: 1.4 },
  // Copper kettle stove against the east wall
  { id: 'cw_stove', minX: 2.18, maxX: 2.96, minZ: -0.35, maxZ: 1.55 },
  // Deep window armchair with footstool in the south-west corner
  { id: 'cw_chair', minX: -1.95, maxX: -0.8, minZ: 0.95, maxZ: 2.15 },
];

export interface CopperwheelInteractable {
  id: CopperwheelInteractableId;
  name: string;
  x: number;
  z: number;
  focusX: number;
  focusZ: number;
  interactRadius: number;
  actionLabel: string;
}

export const COPPERWHEEL_INTERACTABLES: readonly CopperwheelInteractable[] = [
  {
    id: 'cw_door',
    name: 'Copperwheel Cottage Door',
    x: 1.0,
    z: 2.0,
    focusX: 1.0,
    focusZ: 2.55,
    interactRadius: 1.9,
    actionLabel: 'Step Outside',
  },
  {
    id: 'cw_bench',
    name: 'Clockmaker’s Workbench',
    x: -1.5,
    z: -1.0,
    focusX: -1.6,
    focusZ: -2.4,
    interactRadius: 1.9,
    actionLabel: 'Check the Workbench',
  },
  {
    id: 'cw_bed',
    name: 'Arthur’s Nightstand',
    x: 0.85,
    z: -1.85,
    focusX: 2.75,
    focusZ: -2.2,
    interactRadius: 1.8,
    actionLabel: 'Peek at the Nightstand',
  },
  {
    id: 'cw_shelf',
    name: 'Mended Pieces Shelf',
    x: -1.5,
    z: 0.25,
    focusX: -2.9,
    focusZ: 0.25,
    interactRadius: 1.8,
    actionLabel: 'Read the Mending Ledger',
  },
  {
    id: 'cw_stove',
    name: 'Copper Kettle Stove',
    x: 1.45,
    z: 0.6,
    focusX: 2.9,
    focusZ: 0.6,
    interactRadius: 1.8,
    actionLabel: 'Pour a Chamomile Cup',
  },
];

// ---------------------------------------------------------------------------
// Deterministic workbench project cycle
// ---------------------------------------------------------------------------

export interface CopperwheelProjectDef {
  id: CopperwheelProjectId;
  label: string;
  /** Short sensory line for the bench card. */
  blurb: string;
  /** What "helping with the fine work" means today (flavor for the help ritual). */
  fineWork: string;
  /** One-time memory saved the first time this project is admired. */
  memoryId: string;
  memoryTitle: string;
  memorySummary: string;
}

export const COPPERWHEEL_PROJECTS: readonly CopperwheelProjectDef[] = [
  {
    id: 'orchard_pendulum',
    label: 'The Orchard Pendulum',
    blurb:
      'A long-case pendulum clock half-built of crabwood for the Fern Hollow gate — Rowan asked for something that keeps orchard time, slow as sap.',
    fineWork: 'holding the crabwood case steady while the last pendulum link is trued',
    memoryId: 'mem_cw_project_pendulum',
    memoryTitle: 'The Orchard Pendulum',
    memorySummary:
      'Watched Arthur true the pendulum of a crabwood clock for Fern Hollow’s gate — orchard time, he called it, slow as sap and twice as sweet.',
  },
  {
    id: 'music_box_comb',
    label: 'A Music Box Comb',
    blurb:
      'The brass comb of a beeswax-rubbed cedar music box lies under the loupe — Barnaby sent it over after one of its teeth went quiet mid-lullaby.',
    fineWork: 'damping the bench while each comb tooth is coaxed back into tune',
    memoryId: 'mem_cw_project_comb',
    memoryTitle: 'A Music Box Comb',
    memorySummary:
      'Helped damp the bench while Arthur coaxed a cedar music box’s comb back into tune — one quiet tooth at a time, like teaching a cricket to sing again.',
  },
  {
    id: 'watch_escapement',
    label: 'The Watch Escapement',
    blurb:
      'A courier’s pocket watch ticks unevenly under the lamp — the escapement needs a steadier hand than Jun’s routes allow, so it rests here between deliveries.',
    fineWork: 'passing the oil pinion at exactly the right breath of the escapement',
    memoryId: 'mem_cw_project_escapement',
    memoryTitle: 'The Watch Escapement',
    memorySummary:
      'Watched Arthur calm a courier’s pocket watch with one breath of oil on the escapement — Jun’s routes will run steady again by morning.',
  },
  {
    id: 'bench_rest',
    label: 'Bench Resting',
    blurb:
      'Today the felt is rolled and the tools sleep in their oiled drawer — only the regulator’s tick and the kettle’s whisper keep the room company.',
    fineWork: '',
    memoryId: 'mem_cw_project_rest',
    memoryTitle: 'The Bench at Rest',
    memorySummary:
      'Found Arthur’s workbench rolled and resting, the regulator ticking alone — even clocks take their sabbath, and so does the clockmaker.',
  },
];

const COPPERWHEEL_PROJECT_MAP: Record<CopperwheelProjectId, CopperwheelProjectDef> =
  COPPERWHEEL_PROJECTS.reduce(
    (acc, project) => {
      acc[project.id] = project;
      return acc;
    },
    {} as Record<CopperwheelProjectId, CopperwheelProjectDef>,
  );

/** Deterministic project cycle: one bench project per day, rotating. Pure & unit-testable. */
export function getProjectForDay(day: number): CopperwheelProjectDef {
  const cycleIndex = ((Math.max(1, Math.floor(day)) - 1) % 4 + 4) % 4;
  return COPPERWHEEL_PROJECTS[cycleIndex];
}

/** In-game minutes spent at each Copperwheel ritual. */
export const COPPERWHEEL_BENCH_MINUTES = 10;
export const COPPERWHEEL_TEA_MINUTES = 6;
export const COPPERWHEEL_NOTES_MINUTES = 8;
export const COPPERWHEEL_NIGHTSTAND_MINUTES = 4;

/** The chamomile Arthur keeps warm on his copper kettle (his favorite thing, after escapements). */
export const COPPERWHEEL_TEA_ITEM_ID: PersonalItemId = 'chamomile_pear_tea';

export function createInitialCopperwheelState(): CopperwheelState {
  return {
    benchCheckedDay: 0,
    helpedDay: 0,
    teaSharedDay: 0,
    notesReadDay: 0,
    starterTeaDay: 0,
    projectsAdmired: 0,
    windingSessions: 0,
    teasShared: 0,
  };
}

// ---------------------------------------------------------------------------
// Interior walkability & routing (mirrors the cottage / greenhouse / bakery / nook contract)
// ---------------------------------------------------------------------------

export function isCopperwheelInteriorWalkable(x: number, z: number, actorRadius = 0.42): boolean {
  if (
    x < COPPERWHEEL_BOUNDS.minX + actorRadius ||
    x > COPPERWHEEL_BOUNDS.maxX - actorRadius ||
    z < COPPERWHEEL_BOUNDS.minZ + actorRadius ||
    z > COPPERWHEEL_BOUNDS.maxZ - actorRadius
  ) {
    return false;
  }
  for (const box of COPPERWHEEL_INTERIOR_OBSTACLES) {
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

export function resolveCopperwheelInteriorMovement(
  current: Vec2,
  desired: Vec2,
  actorRadius = 0.42,
): Vec2 {
  if (isCopperwheelInteriorWalkable(desired.x, desired.z, actorRadius)) {
    return desired;
  }
  if (isCopperwheelInteriorWalkable(desired.x, current.z, actorRadius)) {
    return { x: desired.x, z: current.z };
  }
  if (isCopperwheelInteriorWalkable(current.x, desired.z, actorRadius)) {
    return { x: current.x, z: desired.z };
  }
  return current;
}

const COPPERWHEEL_INTERIOR_HUBS: readonly Vec2[] = [
  { x: 0.6, z: 0.0 }, // Central aisle between the armchair corner and the stove
  { x: -1.0, z: -0.35 }, // West aisle between the shelf end and the bench front
  { x: 1.35, z: -0.4 }, // East aisle between the bed foot and the stove
  { x: 0.55, z: -1.7 }, // North passage between the workbench and the bed alcove
  { x: 0.6, z: 1.5 }, // South passage above the door mat
  { x: -0.2, z: 1.5 }, // South-west pocket by the armchair approach
];

function isCopperwheelSegmentWalkable(a: Vec2, b: Vec2, actorRadius = 0.42): boolean {
  const dist = distance2D(a, b);
  const steps = Math.max(4, Math.ceil(dist / 0.2));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (
      !isCopperwheelInteriorWalkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, actorRadius)
    ) {
      return false;
    }
  }
  return true;
}

export function computeCopperwheelWaypoints(from: Vec2, to: Vec2, actorRadius = 0.42): Vec2[] {
  if (isCopperwheelSegmentWalkable(from, to, actorRadius)) {
    return [to];
  }

  let bestSingle: Vec2[] | null = null;
  let bestSingleCost = Infinity;
  for (const hub of COPPERWHEEL_INTERIOR_HUBS) {
    if (!isCopperwheelInteriorWalkable(hub.x, hub.z, actorRadius)) continue;
    if (
      isCopperwheelSegmentWalkable(from, hub, actorRadius) &&
      isCopperwheelSegmentWalkable(hub, to, actorRadius)
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
  for (const h1 of COPPERWHEEL_INTERIOR_HUBS) {
    if (!isCopperwheelInteriorWalkable(h1.x, h1.z, actorRadius)) continue;
    if (!isCopperwheelSegmentWalkable(from, h1, actorRadius)) continue;
    for (const h2 of COPPERWHEEL_INTERIOR_HUBS) {
      if (h1 === h2) continue;
      if (!isCopperwheelInteriorWalkable(h2.x, h2.z, actorRadius)) continue;
      if (
        isCopperwheelSegmentWalkable(h1, h2, actorRadius) &&
        isCopperwheelSegmentWalkable(h2, to, actorRadius)
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

/** One deep window armchair (indoor seat; visual mesh lives in the rig at the same spot). */
export const COPPERWHEEL_SEAT_SPOTS = [
  {
    id: 'cw_seat_armchair',
    label: 'Window Armchair',
    seatPos: { x: -1.4, z: 1.55 },
    approachPos: { x: -0.25, z: 1.5 },
    facingAngle: Math.atan2(1.45 - -1.4, 0.6 - 1.55), // Facing north-east across the room toward the kettle corner
    seatHeight: 0.48,
    zoneId: 'copperwheel_interior',
    indoor: true,
  },
] as const;

export function selectBestCopperwheelTarget(world: WorldState): InteractiveTarget | null {
  let bestTarget: InteractiveTarget | null = null;
  let bestScore = Infinity;

  const evaluateCandidate = (target: InteractiveTarget, score: number) => {
    if (score < bestScore) {
      bestScore = score;
      bestTarget = target;
    }
  };

  for (const prop of COPPERWHEEL_INTERACTABLES) {
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
        kind: 'copperwheel_prop',
        id: prop.id,
        copperwheelPropId: prop.id,
        label: prop.name,
        actionLabel: prop.actionLabel,
        distance: effDist,
        worldPos: { x: prop.focusX, z: prop.focusZ },
      },
      effDist + facingPenalty,
    );
  }

  // Window armchair seat: offered like the cottage stools and café chair, weighted
  // slightly behind props so aiming at the bench/stove is never stolen by the chair.
  for (const seat of COPPERWHEEL_SEAT_SPOTS) {
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
