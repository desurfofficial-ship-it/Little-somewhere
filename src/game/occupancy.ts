import {
  InteriorLocation,
  InteriorOccupant,
  ResidentId,
  Vec2,
  WorldState,
} from './types';

/**
 * Interior Occupancy Owner (Living Relationships — LR-2).
 *
 * Keeps indoor NPC presence cleanly separated from `world.npcRuntime`, which owns
 * exterior walking/simulation. Only one interior host occupies a room at a time,
 * tied to an accepted, live invitation ID.
 *
 * Pure TypeScript — zero DOM, React, or Three.js dependencies.
 */

export const NOOK_CHAIR_STATION_ID = 'nook_chair';
export const NOOK_OCCUPANT_POS: Vec2 = { x: -0.9, z: 1.65 };
export const NOOK_OCCUPANT_APPROACH_POS: Vec2 = { x: -0.9, z: 0.55 };
/** Seated facing forward (+Z out of the nook armchair toward the center of the room). */
export const NOOK_OCCUPANT_FACING = 0.15;

/**
 * Living Relationships (LR-5, doc 24 §2.1 L5-S2): Arthur's bench occupant
 * anchor, mirroring the nook pattern (seated occupant anchored in furniture).
 *
 * - The station REUSES the existing `cw_bench` interactable id (D-5D) — no
 *   second station registry entry.
 * - `CW_OCCUPANT_POS` sits on the bench front where the workbench stool lives
 *   in the interior rig (`src/scene/builders/copperwheelInterior.ts`); like
 *   the nook armchair, a seated occupant anchored in furniture is
 *   intentionally not walkable.
 * - `CW_OCCUPANT_APPROACH_POS` is the player-facing "watch the bench" aisle
 *   spot south of the bench; validated walkable (clears the cw_bench obstacle
 *   expansion) and pinned by the LR5-14 clearance assertions.
 * - Facing is computed with the room's `atan2(deltaX, deltaZ)` convention,
 *   aimed at the bench work surface.
 */
export const CW_BENCH_STATION_ID = 'cw_bench';
export const CW_OCCUPANT_POS: Vec2 = { x: -1.5, z: -1.22 };
export const CW_OCCUPANT_APPROACH_POS: Vec2 = { x: -1.15, z: -0.55 };
export const CW_OCCUPANT_FACING = Math.atan2(-1.6 - CW_OCCUPANT_POS.x, -2.4 - CW_OCCUPANT_POS.z);

export function createInitialOccupancy(): InteriorOccupant | null {
  return null;
}

export function setOccupant(
  world: WorldState,
  occupant: {
    residentId: ResidentId;
    location: InteriorLocation;
    stationId: string;
    localPos: Vec2;
    facing: number;
    invitationId: string;
  },
): WorldState {
  return {
    ...world,
    occupancy: {
      residentId: occupant.residentId,
      location: occupant.location,
      stationId: occupant.stationId,
      localPos: { x: occupant.localPos.x, z: occupant.localPos.z },
      facing: occupant.facing,
      invitationId: occupant.invitationId,
    },
  };
}

export function clearOccupant(world: WorldState, location?: InteriorLocation): WorldState {
  if (!world.occupancy) return world;
  if (location && world.occupancy.location !== location) return world;
  return {
    ...world,
    occupancy: null,
  };
}

export function clearAllOccupancy(world: WorldState): WorldState {
  if (!world.occupancy) return world;
  return {
    ...world,
    occupancy: null,
  };
}

export function getOccupantAt(
  world: WorldState,
  location: InteriorLocation,
): InteriorOccupant | null {
  const occ = world.occupancy ?? null;
  if (!occ || occ.location !== location) return null;
  return occ;
}

export function isStationOccupied(
  world: WorldState,
  location: InteriorLocation,
  stationId: string,
): boolean {
  const occ = getOccupantAt(world, location);
  return Boolean(occ && occ.stationId === stationId);
}
