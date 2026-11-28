import { PlayerLocation, SeatSpot, Vec2 } from './types';
import { isInteriorPointWalkable } from './cottage';
import { BAKERY_SEAT_SPOTS, isBakeryInteriorWalkable } from './bakery';
import { isNookInteriorWalkable } from './bookNook';
import { isCopperwheelInteriorWalkable } from './copperwheel';
import { isGreenhouseInteriorWalkable } from './greenhouse';
import { isPointWalkable } from './worldMap';
import { CW_OCCUPANT_APPROACH_POS, NOOK_OCCUPANT_APPROACH_POS } from './occupancy';

/**
 * Location-aware walkability dispatch.
 *
 * Every interior (cottage, greenhouse, bakery, nook, copperwheel) owns its own bounds +
 * obstacle table, so a point is only meaningful against the grid of the room it lies in.
 * The historic stand-up path validated *every* indoor seat with the cottage-only
 * `isInteriorPointWalkable`, which permanently trapped the player at the bakery café
 * chair and the Copperwheel armchair (approach rejected → player left inside the chair
 * collision volume → 0 free movement directions). This dispatcher is the single routing
 * point shared by the movement stand-up path and the explicit sit/stand toggle action.
 *
 * The outdoor (`exterior`) default defers to the overworld map exactly as before.
 */
export function isLocationPointWalkable(
  location: PlayerLocation,
  x: number,
  z: number,
  actorRadius = 0.42,
): boolean {
  switch (location) {
    case 'cottage_interior':
      return isInteriorPointWalkable(x, z, actorRadius);
    case 'bakery_interior':
      return isBakeryInteriorWalkable(x, z, actorRadius);
    case 'nook_interior':
      return isNookInteriorWalkable(x, z, actorRadius);
    case 'copperwheel_interior':
      return isCopperwheelInteriorWalkable(x, z, actorRadius);
    case 'greenhouse_interior':
      return isGreenhouseInteriorWalkable(x, z, actorRadius);
    default:
      return isPointWalkable(x, z, actorRadius);
  }
}

/**
 * The simulation location a seat belongs to. Indoor seats carry their zone id in
 * `zoneId` (values mirror `PlayerLocation`); outdoor benches map to the overworld.
 */
export function seatLocation(seat: SeatSpot): PlayerLocation {
  switch (seat.zoneId) {
    case 'cottage_interior':
    case 'bakery_interior':
    case 'nook_interior':
    case 'copperwheel_interior':
    case 'greenhouse_interior':
      return seat.zoneId;
    default:
      return 'exterior';
  }
}

/**
 * Walk destination when the player clicks a seated interior occupant (D8,
 * doc 05 §8.3): their venue seat's approach position, resolved per location
 * instead of a hardcoded module constant. Nook returns the historic
 * `NOOK_OCCUPANT_APPROACH_POS` (byte-identical routing); bakery returns the
 * café seat's authored approach. `null` for venues without hosted activities.
 */
export function occupantApproachPos(location: PlayerLocation): Vec2 | null {
  switch (location) {
    case 'nook_interior':
      return { ...NOOK_OCCUPANT_APPROACH_POS };
    case 'bakery_interior':
      return { ...BAKERY_SEAT_SPOTS[0].approachPos };
    case 'copperwheel_interior':
      // LR-5 D8 (doc 24 §2.1 L5-S6): the workbench-hour approach aisle.
      return { ...CW_OCCUPANT_APPROACH_POS };
    default:
      return null;
  }
}

/**
 * Deterministic radial recovery search: 8 fixed directions (4 cardinal, then 4
 * diagonal) × 2 radii (0.35, 0.55). Returns the first walkable point in scan order,
 * or `null` when the whole shell is blocked. Fixed ordering keeps every call site
 * bit-for-bit deterministic (same inputs → same recovered position).
 */
const RADIAL_RECOVERY_RADII = [0.35, 0.55] as const;
const RADIAL_DIRECTIONS: readonly Vec2[] = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
  { x: Math.SQRT1_2, z: Math.SQRT1_2 },
  { x: Math.SQRT1_2, z: -Math.SQRT1_2 },
  { x: -Math.SQRT1_2, z: Math.SQRT1_2 },
  { x: -Math.SQRT1_2, z: -Math.SQRT1_2 },
];

export function findNearestWalkableSpot(
  location: PlayerLocation,
  x: number,
  z: number,
  actorRadius = 0.42,
): Vec2 | null {
  for (const dist of RADIAL_RECOVERY_RADII) {
    for (const dir of RADIAL_DIRECTIONS) {
      const px = x + dir.x * dist;
      const pz = z + dir.z * dist;
      if (isLocationPointWalkable(location, px, pz, actorRadius)) {
        return { x: px, z: pz };
      }
    }
  }
  return null;
}

/**
 * Resolves the position a player lands on when standing up from `seat`.
 *
 * 1. Prefer the authored `approachPos` when it is walkable under the seat's OWN
 *    interior grid (radius 0.42 indoors, 0.48 outdoors — matching the historic calls).
 * 2. Otherwise run the deterministic radial recovery around the seat position, then
 *    around the approach position, so a future seat squeezed by new obstacles still
 *    finds open floor instead of trapping the player inside the furniture's collision
 *    volume. Two anchors are needed: the Copperwheel window armchair sits in a deep
 *    corner pocket where the shell around `seatPos` alone is fully blocked.
 * 3. Final fallback: the authored `approachPos` itself. The historic `null`
 *    contract left callers keeping the sitter INSIDE the furniture collision
 *    volume with zero exit directions (C-2); a slightly crowded approach
 *    anchor is always preferable and movement resolvers slide as usual.
 */
export function resolveSeatStandPos(seat: SeatSpot): Vec2 | null {
  const location = seatLocation(seat);
  const radius = seat.indoor ? 0.42 : 0.48;
  if (
    isLocationPointWalkable(location, seat.approachPos.x, seat.approachPos.z, radius)
  ) {
    return { x: seat.approachPos.x, z: seat.approachPos.z };
  }
  return (
    findNearestWalkableSpot(location, seat.seatPos.x, seat.seatPos.z, radius) ??
    findNearestWalkableSpot(location, seat.approachPos.x, seat.approachPos.z, radius) ?? {
      x: seat.approachPos.x,
      z: seat.approachPos.z,
    }
  );
}
