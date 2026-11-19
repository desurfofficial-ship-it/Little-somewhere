import {
  InteractiveTarget,
  NookBookId,
  NookInteractableId,
  NookState,
  PersonalItemId,
  Vec2,
  WorldState,
} from './types';
import { computeFacingAlignment, distance2D } from './worldMap';

/**
 * Linden Book Nook enterable interior (Milestone 3 Build 8).
 *
 * The book nook uses the same local-coordinate cutaway pattern as Willow Step Cottage,
 * Sunbeam Greenhouse, and Hearth & Crumb Bakery: a small room centered on the origin with
 * its own obstacle table, walkability grid, hub-routed waypoints, and station registry.
 * `NOOK_BOUNDS` and `NOOK_INTERIOR_OBSTACLES` must stay mirrored by
 * `src/scene/builders/bookNookInterior.ts` (enforced by tests on both sides).
 *
 * Design intent (GAME_DESIGN.md): Nora's paperbacks & tea — the rituals here are browsing,
 * settling in, and reading. No currency, no collection pressure: four shelf books cycle
 * gently, and each first read saves a quiet memory.
 */
export const NOOK_BOUNDS = {
  minX: -2.5,
  maxX: 2.5,
  minZ: -2.4,
  maxZ: 2.4,
} as const;

/** Exterior door approach spot (world coordinates) just east of the Book Nook's east door. */
export const NOOK_DOOR_POS: Vec2 = { x: -11.8, z: -1.0 };
export const NOOK_PORCH_EXIT_POS: Vec2 = { x: -11.55, z: -1.0 };
export const NOOK_PORCH_EXIT_FACING = Math.PI * 0.5; // Facing east back toward the door

export const NOOK_DOOR_SPAWN: Vec2 = { x: 1.5, z: 0.0 };
export const NOOK_DOOR_DEFAULT_FACING = -Math.PI * 0.5; // Facing inward west into the reading room

export interface NookInteriorBoxObstacle {
  id: NookInteractableId;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const NOOK_INTERIOR_OBSTACLES: readonly NookInteriorBoxObstacle[] = [
  // Floor-to-ceiling bookshelf wall along the north side
  { id: 'nook_shelf', minX: -2.46, maxX: 1.1, minZ: -2.36, maxZ: -1.6 },
  // Nora's lending desk against the south wall
  { id: 'nook_desk', minX: -0.35, maxX: 1.45, minZ: 1.7, maxZ: 2.36 },
  // Tea tray console along the west wall
  { id: 'nook_tea', minX: -2.46, maxX: -1.7, minZ: -0.55, maxZ: 1.25 },
  // Deep reading armchair in the south-west corner
  { id: 'nook_chair', minX: -1.45, maxX: -0.35, minZ: 1.05, maxZ: 2.15 },
];

export interface NookInteractable {
  id: NookInteractableId;
  name: string;
  x: number;
  z: number;
  focusX: number;
  focusZ: number;
  interactRadius: number;
  actionLabel: string;
}

export const NOOK_INTERACTABLES: readonly NookInteractable[] = [
  {
    id: 'nook_door',
    name: 'Book Nook Door',
    x: 1.9,
    z: 0.0,
    focusX: 2.55,
    focusZ: 0.0,
    interactRadius: 1.8,
    actionLabel: 'Step Outside',
  },
  {
    id: 'nook_shelf',
    name: 'Linden Bookshelf Wall',
    x: -0.6,
    z: -1.0,
    focusX: -0.6,
    focusZ: -2.35,
    interactRadius: 1.9,
    actionLabel: 'Browse the Bookshelf',
  },
  {
    id: 'nook_desk',
    name: 'Nora’s Lending Desk',
    x: 0.55,
    z: 1.1,
    focusX: 0.55,
    focusZ: 2.35,
    interactRadius: 1.8,
    actionLabel: 'Read the Lending Notes',
  },
  {
    id: 'nook_tea',
    name: 'Reader’s Tea Tray',
    x: -1.25,
    z: -0.35,
    focusX: -2.45,
    focusZ: 0.3,
    interactRadius: 1.7,
    actionLabel: 'Pour a Reader’s Cup',
  },
];

// ---------------------------------------------------------------------------
// Deterministic shelf book cycle
// ---------------------------------------------------------------------------

export interface NookBookDef {
  id: NookBookId;
  title: string;
  /** Shelf-card flavor line shown when browsing. */
  blurb: string;
  /** One-time memory saved the first time this book is settled into. */
  memoryId: string;
  memoryTitle: string;
  memorySummary: string;
}

export const NOOK_BOOKS: readonly NookBookDef[] = [
  {
    id: 'ivy_letters',
    title: 'The Ivy Letters',
    blurb:
      'A slim volume of letters exchanged across the gazebo railings decades ago — the ivy was younger then, and so were the writers.',
    memoryId: 'mem_book_ivy_letters',
    memoryTitle: 'The Ivy Letters',
    memorySummary:
      'Settled into the reading chair with The Ivy Letters from Nora’s shelf — old gazebo letters that made the quiet bell feel less lonely.',
  },
  {
    id: 'pond_sketches',
    title: 'Sketches of Mirror Pond',
    blurb:
      'Ink-and-wash studies of carp, reeds, and the cedar bridge through every season — someone clearly loved that water for years.',
    memoryId: 'mem_book_pond_sketches',
    memoryTitle: 'Sketches of Mirror Pond',
    memorySummary:
      'Turned through Sketches of Mirror Pond in Nora’s reading chair — the winter sketches of the cedar bridge look just like Toby’s.',
  },
  {
    id: 'bread_hymns',
    title: 'Bread & Bell: A Bakery Year',
    blurb:
      'Twelve months of Hearth & Crumb mornings — sourdough schedules, oven songs, and a chapter that only talks about rosemary.',
    memoryId: 'mem_book_bread_hymns',
    memoryTitle: 'Bread & Bell: A Bakery Year',
    memorySummary:
      'Read Bread & Bell: A Bakery Year at the book nook — Clara’s sourdough mornings, set down in print like they deserved.',
  },
  {
    id: 'night_orchard',
    title: 'The Night Orchard',
    blurb:
      'Essays on crabapples after dusk: moth lanterns, slow sap, and why the keeper walks the rows when nobody else does.',
    memoryId: 'mem_book_night_orchard',
    memoryTitle: 'The Night Orchard',
    memorySummary:
      'Finished The Night Orchard in the book nook — suddenly Rowan’s dusk walks through Fern Hollow make perfect sense.',
  },
];

const NOOK_BOOK_MAP: Record<NookBookId, NookBookDef> = NOOK_BOOKS.reduce(
  (acc, book) => {
    acc[book.id] = book;
    return acc;
  },
  {} as Record<NookBookId, NookBookDef>,
);

/** Deterministic featured-book cycle: one book per day, rotating. Pure & unit-testable. */
export function getFeaturedBookForDay(day: number): NookBookDef {
  const cycleIndex = ((Math.max(1, Math.floor(day)) - 1) % 4 + 4) % 4;
  return NOOK_BOOKS[cycleIndex];
}

/** In-game minutes spent at each book-nook ritual. */
export const NOOK_BROWSE_MINUTES = 12;
export const NOOK_TEA_MINUTES = 6;
export const NOOK_NOTES_MINUTES = 8;

/** The tea Nora pours for readers (from the kettle she keeps warm beside the desk). */
export const NOOK_TEA_ITEM_ID: PersonalItemId = 'chamomile_pear_tea';

export function createInitialNookState(): NookState {
  return {
    shelfBrowsedDay: 0,
    teaSharedDay: 0,
    notesReadDay: 0,
    starterTeaDay: 0,
    booksRead: 0,
    teasShared: 0,
  };
}

// ---------------------------------------------------------------------------
// Interior walkability & routing (mirrors the cottage / greenhouse / bakery contract)
// ---------------------------------------------------------------------------

export function isNookInteriorWalkable(x: number, z: number, actorRadius = 0.42): boolean {
  if (
    x < NOOK_BOUNDS.minX + actorRadius ||
    x > NOOK_BOUNDS.maxX - actorRadius ||
    z < NOOK_BOUNDS.minZ + actorRadius ||
    z > NOOK_BOUNDS.maxZ - actorRadius
  ) {
    return false;
  }
  for (const box of NOOK_INTERIOR_OBSTACLES) {
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

export function resolveNookInteriorMovement(
  current: Vec2,
  desired: Vec2,
  actorRadius = 0.42,
): Vec2 {
  if (isNookInteriorWalkable(desired.x, desired.z, actorRadius)) {
    return desired;
  }
  if (isNookInteriorWalkable(desired.x, current.z, actorRadius)) {
    return { x: desired.x, z: current.z };
  }
  if (isNookInteriorWalkable(current.x, desired.z, actorRadius)) {
    return { x: current.x, z: desired.z };
  }
  return current;
}

const NOOK_INTERIOR_HUBS: readonly Vec2[] = [
  { x: 0.6, z: 0.0 }, // Central aisle between shelf and desk
  { x: -0.75, z: 0.2 }, // West aisle between shelf end and tea console
  { x: 1.5, z: -0.9 }, // East pocket by the door
  { x: 0.4, z: -1.85 }, // North passage in front of the shelf
  { x: 0.6, z: 1.15 }, // South passage above the desk
  { x: -1.75, z: 1.7 }, // South-west pocket by the armchair
];

function isNookSegmentWalkable(a: Vec2, b: Vec2, actorRadius = 0.42): boolean {
  const dist = distance2D(a, b);
  const steps = Math.max(4, Math.ceil(dist / 0.2));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (!isNookInteriorWalkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, actorRadius)) {
      return false;
    }
  }
  return true;
}

export function computeNookWaypoints(from: Vec2, to: Vec2, actorRadius = 0.42): Vec2[] {
  if (isNookSegmentWalkable(from, to, actorRadius)) {
    return [to];
  }

  let bestSingle: Vec2[] | null = null;
  let bestSingleCost = Infinity;
  for (const hub of NOOK_INTERIOR_HUBS) {
    if (!isNookInteriorWalkable(hub.x, hub.z, actorRadius)) continue;
    if (
      isNookSegmentWalkable(from, hub, actorRadius) &&
      isNookSegmentWalkable(hub, to, actorRadius)
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
  for (const h1 of NOOK_INTERIOR_HUBS) {
    if (!isNookInteriorWalkable(h1.x, h1.z, actorRadius)) continue;
    if (!isNookSegmentWalkable(from, h1, actorRadius)) continue;
    for (const h2 of NOOK_INTERIOR_HUBS) {
      if (h1 === h2) continue;
      if (!isNookInteriorWalkable(h2.x, h2.z, actorRadius)) continue;
      if (
        isNookSegmentWalkable(h1, h2, actorRadius) &&
        isNookSegmentWalkable(h2, to, actorRadius)
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

/** One deep reading armchair (indoor seat; visual mesh lives in the rig at the same spot). */
export const NOOK_SEAT_SPOTS = [
  {
    id: 'nook_seat_armchair',
    label: 'Reading Armchair',
    seatPos: { x: -0.9, z: 1.6 },
    approachPos: { x: -0.9, z: 0.55 },
    facingAngle: Math.atan2(-0.9 - -0.9, -1.5 - 1.6), // Facing west toward the tea console
    seatHeight: 0.5,
    zoneId: 'nook_interior',
    indoor: true,
  },
] as const;

export function selectBestNookTarget(world: WorldState): InteractiveTarget | null {
  let bestTarget: InteractiveTarget | null = null;
  let bestScore = Infinity;

  const evaluateCandidate = (target: InteractiveTarget, score: number) => {
    if (score < bestScore) {
      bestScore = score;
      bestTarget = target;
    }
  };

  for (const prop of NOOK_INTERACTABLES) {
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
        kind: 'nook_prop',
        id: prop.id,
        nookPropId: prop.id,
        label: prop.name,
        actionLabel: prop.actionLabel,
        distance: effDist,
        worldPos: { x: prop.focusX, z: prop.focusZ },
      },
      effDist + facingPenalty,
    );
  }

  // Reading armchair seat: offered like the cottage stools and café chair, weighted
  // slightly behind props so aiming at the shelf/desk is never stolen by the chair.
  for (const seat of NOOK_SEAT_SPOTS) {
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
