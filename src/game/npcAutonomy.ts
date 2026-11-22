/**
 * NPC Autonomy public facade.
 *
 * A thin read-only interface over `WorldState` that lets other systems
 * (LR-3 invitations, LR-4 teaching, LR-5 Arthur/Copperwheel, community
 * activities, future milestones, UI) query what a resident is currently
 * doing, where they are headed, who they are with, and whether they are
 * available for a proposed activity — WITHOUT coupling to simulation
 * internals (`selectActivityForResident`, `stepSimulationInPlace`,
 * `NpcRuntimeState` field shapes, relationship-tier math, etc.).
 *
 * Contracts:
 * - All functions are pure reads; none mutate `WorldState`.
 * - None import simulation-internal helpers; they read only the public
 *   `WorldState` shape and the relationship/resident registries.
 * - Return values are stable snapshots; callers must not retain references
 *   into mutable arrays and expect them to track live state.
 *
 * Usage:
 *   import { getResidentActivity, isResidentAvailableForActivity } from './npcAutonomy';
 */

import type {
  NpcNeeds,
  ResidentId,
  Vec2,
  WorldState,
} from './types';
import { RESIDENTS, RESIDENT_ORDER } from './residents';
import {
  getNpcRelation,
  getNpcRelationTierFast,
  getRelationshipTier,
} from './relationships';

/** A stable snapshot of a resident's current autonomy state. */
export interface ResidentActivitySnapshot {
  residentId: ResidentId;
  /** Current activity id, e.g. `'morning:anchor'` or `'afternoon:clara_herb_errand'`. */
  activityId: string;
  /** Human-readable place name, e.g. `'Hearth & Crumb Bakery'`. */
  placeName: string;
  /** Human-readable activity label, e.g. `'Cooling fresh rosemary loaves'`. */
  activityLabel: string;
  /** Current world position. */
  position: Vec2;
  /** Current movement target (may equal position when dwelling). */
  destination: Vec2;
  /** True while the resident is walking between locations. */
  isTraveling: boolean;
  /** True while the resident is seated on a bench. */
  isSeated: boolean;
  /** Current animation pose, e.g. `'walk'`, `'work'`, `'sit'`, `'converse'`. */
  animState: string;
  /** The resident this one is currently in a social encounter with, if any. */
  socialPartnerId: ResidentId | null;
  /** Current emotional label. */
  emotion: string;
  /** Current needs (energy/hunger/social/fulfillment, 0..100). */
  needs: NpcNeeds;
}

/**
 * Returns a stable snapshot of a resident's current autonomy state.
 * Returns `null` if the resident id is unknown or has no runtime record.
 */
export function getResidentActivity(
  residentId: ResidentId,
  world: WorldState,
): ResidentActivitySnapshot | null {
  const rt = world.npcRuntime?.[residentId];
  if (!rt) return null;
  return {
    residentId,
    activityId: rt.currentActivityId,
    placeName: rt.currentPlaceName,
    activityLabel: rt.currentActivityLabel,
    position: { x: rt.position.x, z: rt.position.z },
    destination: { x: rt.targetPos.x, z: rt.targetPos.z },
    isTraveling: rt.waypoints.length > 0,
    isSeated: rt.posture === 'sitting',
    animState: rt.animState,
    socialPartnerId: rt.socialPartnerId,
    emotion: rt.emotion,
    needs: { ...rt.needs },
  };
}

/**
 * Returns the resident's current movement destination (targetPos), or its
 * current position if it is dwelling. Useful for activity-proximity checks.
 */
export function getResidentDestination(residentId: ResidentId, world: WorldState): Vec2 | null {
  const rt = world.npcRuntime?.[residentId];
  if (!rt) return null;
  return { x: rt.targetPos.x, z: rt.targetPos.z };
}

/**
 * Returns the resident this one is currently in a social encounter with,
 * or null. For 2-person encounters the pair is symmetric (A↔B); for 3-person
 * encounters the assignment is round-robin (A→B, B→C, C→A), so callers that
 * need the full participant group should read `world.activeEncounters[*]`
 * rather than relying on pairwise symmetry.
 */
export function getResidentSocialPartner(
  residentId: ResidentId,
  world: WorldState,
): ResidentId | null {
  return world.npcRuntime?.[residentId]?.socialPartnerId ?? null;
}

/**
 * Returns a copy of the resident's current needs (0..100 each).
 * Returns null if the resident has no runtime record.
 */
export function getResidentNeeds(residentId: ResidentId, world: WorldState): NpcNeeds | null {
  const rt = world.npcRuntime?.[residentId];
  if (!rt) return null;
  return { ...rt.needs };
}

/**
 * Determines whether a resident is available for a proposed activity right now.
 * A resident is unavailable if any of:
 *  - they are the indoor occupant of another venue (LR-2/LR-3 occupancy)
 *  - they are mid-social-encounter (`socialPartnerId !== null`)
 *  - they are mid-travel (`waypoints.length > 0`)
 *  - they are seated (claimed a bench)
 *  - they are on social cooldown (`minuteOfDay < socialCooldownUntilMinute`)
 *  - they are currently in dialogue with the player (caller knows this; not
 *    checked here — the caller gates on `dialogueOpen`/`activeDialogueResidentId`)
 *
 * This is the query LR-3/LR-4/LR-5 invitation + shared-activity code should
 * use to decide whether a host can receive the player, and whether a neighbor
 * can join a community activity, instead of reading `NpcRuntimeState` fields
 * directly (which couples them to the runtime shape).
 */
export function isResidentAvailableForActivity(
  residentId: ResidentId,
  world: WorldState,
): boolean {
  const rt = world.npcRuntime?.[residentId];
  if (!rt) return false;
  if (world.occupancy?.residentId === residentId) return false;
  if (rt.socialPartnerId !== null) return false;
  if (rt.waypoints.length > 0) return false;
  if (rt.posture === 'sitting') return false;
  if (world.minuteOfDay < rt.socialCooldownUntilMinute) return false;
  return true;
}

/**
 * Returns the resident's nearest confidant-tier neighbor by Euclidean
 * distance, or null if they have none in proximity. Useful for companion-
 * bias queries and for "who would this resident naturally gravitate to"
 * social-activity matchmaking.
 */
export function getNearestConfidant(
  residentId: ResidentId,
  world: WorldState,
): ResidentId | null {
  const rt = world.npcRuntime?.[residentId];
  if (!rt) return null;
  let nearest: ResidentId | null = null;
  let nearestDist = Infinity;
  for (const otherId of RESIDENT_ORDER) {
    if (otherId === residentId) continue;
    const otherRt = world.npcRuntime?.[otherId];
    if (!otherRt) continue;
    if (getNpcRelationTierFast(world.npcRelations, residentId, otherId) !== 'confidant') continue;
    const dx = otherRt.position.x - rt.position.x;
    const dz = otherRt.position.z - rt.position.z;
    const d = dx * dx + dz * dz;
    if (d < nearestDist) {
      nearestDist = d;
      nearest = otherId;
    }
  }
  return nearest;
}

/**
 * Returns the player's relationship tier with a resident
 * (stranger/acquaintance/friendly/close/kindred), derived from the
 * authoritative `playerRelations` affinity. Provided here so callers don't
 * need to import the relationship math directly.
 */
export function getPlayerRelationshipTier(
  residentId: ResidentId,
  world: WorldState,
): 'stranger' | 'acquaintance' | 'friendly' | 'close' | 'kindred' {
  const rel = world.playerRelations?.[residentId];
  return getRelationshipTier(rel?.affinity ?? 0);
}

/**
 * Enumerates every resident currently available for an activity (per
 * `isResidentAvailableForActivity`). Useful for community-activity
 * matchmaking and for "who can the player invite right now" UI.
 */
export function getAvailableResidents(world: WorldState): ResidentId[] {
  const out: ResidentId[] = [];
  for (const id of RESIDENT_ORDER) {
    if (isResidentAvailableForActivity(id, world)) out.push(id);
  }
  return out;
}

/**
 * Returns the bilateral NPC↔NPC relationship tier between two residents
 * (estranged/guarded/acquainted/warm/confidant). Read-only convenience
 * over `getNpcRelation`/`getNpcRelationTierFast` so callers don't couple
 * to the relation-record shape.
 */
export function getNpcRelationTierForPair(
  a: ResidentId,
  b: ResidentId,
  world: WorldState,
): 'estranged' | 'guarded' | 'acquainted' | 'warm' | 'confidant' {
  return getNpcRelationTierFast(world.npcRelations, a, b);
}

/**
 * Returns the bilateral NPC↔NPC familiarity (accumulated encounter count
 * proxy). Read-only convenience for social-proximity queries.
 */
export function getNpcFamiliarity(
  a: ResidentId,
  b: ResidentId,
  world: WorldState,
): number {
  return getNpcRelation(world.npcRelations, a, b).familiarity ?? 0;
}

/** Re-export the resident roster for callers that need trait/definition lookups. */
export { RESIDENTS, RESIDENT_ORDER };
