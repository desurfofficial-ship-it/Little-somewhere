/**
 * Living Relationships LR-1 — occupancy owner (doc 14 §1, §4).
 *
 * Single owner of every occupancy write. `stepSimulationInPlace` may only READ
 * occupancy (doc 14 §4.2: "It does not create or move occupants"); door enter/exit
 * reducers (LR-2) and the invitation terminal paths call these writers.
 *
 * Spec of record: docs/architecture/living-relationships/14-revised-architecture.md
 */

import { InteriorOccupant, PlayerLocation, ResidentId, WorldState } from './types';
import { RESIDENT_ORDER } from './residents';

// Runtime mirrors of the string unions, shared with the sanitizer. RESIDENT_ORDER
// is the single source of truth for resident ids (no duplicated list here).
const VALID_RESIDENTS = new Set<string>(RESIDENT_ORDER as readonly string[]);

const VALID_LOCATIONS = new Set<string>([
  'exterior',
  'cottage_interior',
  'greenhouse_interior',
  'bakery_interior',
  'nook_interior',
  'copperwheel_interior',
]);

/**
 * Place (or replace) the occupant of a visitable interior. Callers must have
 * verified the doc 14 §4.2 preconditions first: a live accepted invitation whose
 * location equals `world.playerLocation`. Validates the location binding so an
 * inconsistent occupant can never be written through the owner.
 */
export function setOccupant(world: WorldState, occupant: InteriorOccupant): boolean {
  if (occupant.location !== world.playerLocation) {
    return false;
  }
  world.occupancy = occupant;
  return true;
}

/** Remove the occupant when it matches the given invitation id (or unconditionally
 * when no id is passed). Idempotent; safe to call from any clear site in doc 14 §4.2. */
export function clearOccupant(world: WorldState, invitationId?: string): void {
  if (!invitationId || world.occupancy?.invitationId === invitationId) {
    world.occupancy = null;
  }
}

/** Remove any occupant record. Used by expiry, day-advance reconciliation, and the
 * load sanitizer (doc 14 §4.2 clear sites; §3 day-transition contract step 2). */
export function clearAllOccupancy(world: WorldState): void {
  world.occupancy = null;
}

/** Structural sanitize for the persisted occupancy slice (doc 14 §4.3): a malformed
 * record, an unknown resident, or an invalid location is dropped (null). The
 * consistency part of the invariant (location/invite binding) is composed in the
 * sanitizer against the live world, because it needs `playerLocation` and the
 * sanitized invitation slice, not just the raw record. */
export function sanitizeOccupancySlice(
  raw: unknown,
  warnings: string[],
): InteriorOccupant | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const residentId = typeof o.residentId === 'string' ? o.residentId : '';
  const location = typeof o.location === 'string' ? o.location : '';
  const stationId = typeof o.stationId === 'string' ? o.stationId : '';
  const invitationId = typeof o.invitationId === 'string' ? o.invitationId : '';
  const localX = typeof o.localPos === 'object' && o.localPos !== null
    ? (o.localPos as Record<string, unknown>).x
    : undefined;
  const localZ = typeof o.localPos === 'object' && o.localPos !== null
    ? (o.localPos as Record<string, unknown>).z
    : undefined;
  const shapeValid =
    VALID_RESIDENTS.has(residentId) &&
    VALID_LOCATIONS.has(location) &&
    location !== 'exterior' &&
    stationId !== '' &&
    invitationId !== '' &&
    typeof localX === 'number' &&
    Number.isFinite(localX) &&
    typeof localZ === 'number' &&
    Number.isFinite(localZ) &&
    typeof o.facing === 'number' &&
    Number.isFinite(o.facing);
  if (!shapeValid) {
    warnings.push('occupancy repaired: malformed occupant record cleared');
    return null;
  }
  return {
    residentId: residentId as ResidentId,
    location: location as PlayerLocation,
    stationId,
    localPos: { x: localX as number, z: localZ as number },
    facing: o.facing as number,
    invitationId,
  };
}
