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
