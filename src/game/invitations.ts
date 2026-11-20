import { getRelationshipTier, isResidentGuarded } from './relationships';
import { RESIDENTS, getTimePhase } from './residents';
import { DAY_END_MINUTE, advanceSimulationClock } from './time';
import { distance2D } from './worldMap';
import { getSharedActivityDef } from './activities';
import {
  InvitationHistoryEntry,
  InvitationRecord,
  InvitationState,
  ResidentId,
  WorldState,
} from './types';

/**
 * Invitation Foundation (Living Relationships — LR-1).
 *
 * Owns single-active-slot invitation lifecycle (`offered` -> `accepted` -> terminal),
 * bounded terminal history (`INVITATION_HISTORY_CAP = 12`), 2-day per-host cooldown,
 * schedule/encounter availability checks, inclusive window checks, and clock/sleep
 * reconciliation.
 *
 * Pure TypeScript — zero DOM, React, or Three.js dependencies.
 */

export const INVITATION_HISTORY_CAP = 12;
export const INVITATION_MIN_SPACING_DAYS = 2;
export const INVITATION_HOME_RADIUS = 6.0;

const TIER_ORDER: Record<ReturnType<typeof getRelationshipTier>, number> = {
  stranger: 0,
  acquaintance: 1,
  friendly: 2,
  close: 3,
  kindred: 4,
};

export function createInitialInvitationState(): InvitationState {
  return {
    active: null,
    history: [],
    lastOfferDayByHost: {},
  };
}

function appendHistoryCapped(
  history: readonly InvitationHistoryEntry[] | undefined,
  entry: InvitationHistoryEntry,
): InvitationHistoryEntry[] {
  const next = [...(history ?? []), entry];
  if (next.length <= INVITATION_HISTORY_CAP) return next;
  return next.slice(next.length - INVITATION_HISTORY_CAP);
}

/**
 * Checks whether a resident is currently available to host an indoor shared activity:
 * 1. Schedule slot for current phase targets within INVITATION_HOME_RADIUS of `homePos`.
 * 2. Not currently participating in any exterior active social encounter.
 */
export function isHostAvailableForActivity(
  world: WorldState,
  hostId: ResidentId,
): boolean {
  const resDef = RESIDENTS[hostId];
  if (!resDef || !resDef.homePos) return false;

  const phase = getTimePhase(world.minuteOfDay);
  const slot = resDef.schedule[phase];
  if (!slot) return false;

  if (distance2D(slot.target, resDef.homePos) > INVITATION_HOME_RADIUS) {
    return false;
  }

  if ((world.activeEncounters ?? []).some((enc) => enc.participants.includes(hostId))) {
    return false;
  }

  return true;
}

/**
 * Inclusive window + day check (doc 14 §2.4):
 * returns true iff invitation is valid and current day/minute fall within its bounds.
 */
export function isInvitationLive(
  invitation: unknown,
  day: number,
  minuteOfDay: number,
): boolean {
  if (!invitation || typeof invitation !== 'object') return false;
  const inv = invitation as Partial<InvitationRecord>;
  if (typeof inv.id !== 'string' || inv.id.length === 0) return false;
  if (inv.status !== 'offered' && inv.status !== 'accepted') return false;
  if (typeof inv.expiresDay !== 'number' || !Number.isFinite(inv.expiresDay)) return false;
  if (typeof inv.windowStartMinute !== 'number' || !Number.isFinite(inv.windowStartMinute)) return false;
  if (typeof inv.windowEndMinute !== 'number' || !Number.isFinite(inv.windowEndMinute)) return false;
  if (typeof day !== 'number' || !Number.isFinite(day)) return false;
  if (typeof minuteOfDay !== 'number' || !Number.isFinite(minuteOfDay)) return false;

  if (day > inv.expiresDay) return false;
  if (minuteOfDay < inv.windowStartMinute || minuteOfDay > inv.windowEndMinute) return false;
  return true;
}

/**
 * Returns true iff an invitation has passed its expiry day or window end (or is malformed).
 * Unlike `!isInvitationLive`, returns false for valid invitations whose window has not opened yet
 * (`day <= expiresDay && minuteOfDay < windowStartMinute`), allowing LR2-04b pre-window stays.
 */
export function isInvitationExpired(
  invitation: unknown,
  day: number,
  minuteOfDay: number,
): boolean {
  if (!invitation || typeof invitation !== 'object') return true;
  const inv = invitation as Partial<InvitationRecord>;
  if (typeof inv.id !== 'string' || inv.id.length === 0) return true;
  if (inv.status !== 'offered' && inv.status !== 'accepted') return true;
  if (typeof inv.expiresDay !== 'number' || !Number.isFinite(inv.expiresDay)) return true;
  if (typeof inv.windowStartMinute !== 'number' || !Number.isFinite(inv.windowStartMinute)) return true;
  if (typeof inv.windowEndMinute !== 'number' || !Number.isFinite(inv.windowEndMinute)) return true;
  if (typeof day !== 'number' || !Number.isFinite(day)) return true;
  if (typeof minuteOfDay !== 'number' || !Number.isFinite(minuteOfDay)) return true;

  if (day > inv.expiresDay) return true;
  if (day === inv.expiresDay && minuteOfDay > inv.windowEndMinute) return true;
  return false;
}

function computeOfferWindow(
  world: WorldState,
  hostId: ResidentId,
  durationMinutes: number,
): { windowStartMinute: number; windowEndMinute: number } {
  const resDef = RESIDENTS[hostId];
  const nowMin = Math.max(360, Math.min(DAY_END_MINUTE, Math.floor(world.minuteOfDay)));
  const phase = getTimePhase(nowMin);

  // Align upper bound with contiguous home-available phases starting at `nowMin`
  // so offered windows don't stretch over an exterior bench slot like Nora's afternoon.
  let maxContiguousEnd = Math.min(DAY_END_MINUTE, nowMin + durationMinutes);
  if (resDef?.homePos) {
    if (phase === 'morning') {
      const aftDist = distance2D(resDef.schedule.afternoon.target, resDef.homePos);
      maxContiguousEnd = aftDist > INVITATION_HOME_RADIUS ? 719 : Math.min(DAY_END_MINUTE, nowMin + durationMinutes);
    } else if (phase === 'golden' || phase === 'dusk') {
      maxContiguousEnd = Math.min(DAY_END_MINUTE, Math.max(nowMin + 90, 1260));
    }
  }

  return {
    windowStartMinute: nowMin,
    windowEndMinute: Math.max(nowMin, maxContiguousEnd),
  };
}

export interface InvitationEligibilityResult {
  eligible: boolean;
  reason?: string;
}

export function canOfferInvitation(
  world: WorldState,
  hostId: ResidentId,
  activityId: string,
): InvitationEligibilityResult {
  const invState = world.invitations ?? createInitialInvitationState();
  if (invState.active !== null) {
    return { eligible: false, reason: 'active_invitation_exists' };
  }

  const activity = getSharedActivityDef(activityId);
  if (!activity || activity.hostId !== hostId) {
    return { eligible: false, reason: 'invalid_activity' };
  }

  const lastOfferDay = invState.lastOfferDayByHost?.[hostId];
  if (
    typeof lastOfferDay === 'number' &&
    world.day - lastOfferDay < INVITATION_MIN_SPACING_DAYS
  ) {
    return { eligible: false, reason: 'spacing_cooldown' };
  }

  const rel = world.playerRelations?.[hostId];
  const emo = world.npcRuntime?.[hostId]?.emotion;
  if (isResidentGuarded(rel, emo)) {
    return { eligible: false, reason: 'host_guarded' };
  }

  const affinity = rel?.affinity ?? (world.residents?.[hostId]?.trust ?? 0) * 20;
  const tier = getRelationshipTier(affinity);
  if (TIER_ORDER[tier] < TIER_ORDER[activity.minTier] && affinity < activity.minAffinity) {
    return { eligible: false, reason: 'tier_too_low' };
  }

  if (!isHostAvailableForActivity(world, hostId)) {
    return { eligible: false, reason: 'host_unavailable' };
  }

  return { eligible: true };
}

export interface InvitationMutationResult {
  ok: boolean;
  world: WorldState;
  reason?: string;
  toast?: string;
  expired?: boolean;
}

export function offerInvitation(
  world: WorldState,
  hostId: ResidentId,
  activityId: string,
): InvitationMutationResult {
  const gate = canOfferInvitation(world, hostId, activityId);
  if (!gate.eligible) {
    return { ok: false, world, reason: gate.reason };
  }

  const activity = getSharedActivityDef(activityId)!;
  const invState = world.invitations ?? createInitialInvitationState();
  const { windowStartMinute, windowEndMinute } = computeOfferWindow(
    world,
    hostId,
    activity.defaultDurationMinutes,
  );

  const id = `inv_${hostId}_${activity.id}_d${world.day}_m${Math.floor(world.minuteOfDay)}`;
  const record: InvitationRecord = {
    id,
    status: 'offered',
    hostId,
    activityId: activity.id,
    offeredDay: world.day,
    expiresDay: world.day,
    windowStartMinute,
    windowEndMinute,
  };

  return {
    ok: true,
    world: {
      ...world,
      invitations: {
        active: record,
        history: [...(invState.history ?? [])],
        lastOfferDayByHost: {
          ...(invState.lastOfferDayByHost ?? {}),
          [hostId]: world.day,
        },
      },
    },
  };
}

export function acceptInvitation(world: WorldState): InvitationMutationResult {
  const invState = world.invitations ?? createInitialInvitationState();
  const active = invState.active;
  if (!active || active.status !== 'offered') {
    return { ok: false, world, reason: 'no_offered_invitation' };
  }
  if (!isInvitationLive(active, world.day, world.minuteOfDay)) {
    return { ok: false, world, reason: 'invitation_expired' };
  }

  return {
    ok: true,
    world: {
      ...world,
      invitations: {
        ...invState,
        active: {
          ...active,
          status: 'accepted',
        },
      },
    },
  };
}

/**
 * Decline ONLY an offered (not yet accepted) invitation (doc 16 LR1-04 / LR2-11).
 * Never rewards or modifies affinity, reliability, memories, or teaching.
 */
export function declineInvitation(world: WorldState): InvitationMutationResult {
  const invState = world.invitations ?? createInitialInvitationState();
  const active = invState.active;
  if (!active || active.status !== 'offered') {
    return { ok: false, world, reason: 'cannot_decline_state' };
  }

  const entry: InvitationHistoryEntry = {
    invitationId: active.id,
    hostId: active.hostId,
    activityId: active.activityId,
    day: world.day,
    outcome: 'declined',
  };

  return {
    ok: true,
    world: {
      ...world,
      invitations: {
        ...invState,
        active: null,
        history: appendHistoryCapped(invState.history, entry),
      },
      occupancy: null,
      activeActivity: null,
    },
  };
}

/**
 * Pure expiry reconciliation at `(day, minuteOfDay)`.
 * Archives active invitation as `expired` if no longer live (or forcedReason given),
 * clears `occupancy` and `activeActivity`, and idempotently avoids duplicate history rows.
 */
export function expireInvitationsAt(
  world: WorldState,
  day: number,
  minuteOfDay: number,
  forcedReason?: string,
): InvitationMutationResult {
  const invState = world.invitations ?? createInitialInvitationState();
  const active = invState.active;

  if (!active) {
    if (!world.occupancy && !world.activeActivity) {
      return { ok: true, world, expired: false };
    }
    return {
      ok: true,
      expired: false,
      world: {
        ...world,
        occupancy: null,
        activeActivity: null,
      },
    };
  }

  const expired = isInvitationExpired(active, day, minuteOfDay);
  if (!expired && !forcedReason) {
    return { ok: true, world, expired: false };
  }

  const entry: InvitationHistoryEntry = {
    invitationId: active.id,
    hostId: active.hostId,
    activityId: active.activityId,
    day,
    outcome: 'expired',
    ...(forcedReason ? { reason: forcedReason } : {}),
  };

  const hostName = RESIDENTS[active.hostId]?.name ?? 'Your host';
  const toast =
    forcedReason === 'host_unavailable'
      ? `${hostName} had to step out — your invitation window closed.`
      : `The invitation with ${hostName} quietly passed for today.`;

  return {
    ok: true,
    expired: true,
    toast,
    world: {
      ...world,
      invitations: {
        ...invState,
        active: null,
        history: appendHistoryCapped(invState.history, entry),
      },
      occupancy: null,
      activeActivity: null,
    },
  };
}

/**
 * Zero-GC in-place expiry reconciler used by `stepSimulationInPlace` when the
 * live simulation clock crosses an invitation boundary.
 */
export function expireInvitationsInPlace(world: WorldState, forcedReason?: string): boolean {
  if (!world.invitations) {
    world.invitations = createInitialInvitationState();
  }
  const active = world.invitations.active;
  if (!active) {
    if (world.occupancy !== null) world.occupancy = null;
    if (world.activeActivity !== null) world.activeActivity = null;
    return false;
  }

  const expired = isInvitationExpired(active, world.day, world.minuteOfDay);
  if (!expired && !forcedReason) {
    return false;
  }

  const entry: InvitationHistoryEntry = {
    invitationId: active.id,
    hostId: active.hostId,
    activityId: active.activityId,
    day: world.day,
    outcome: 'expired',
    ...(forcedReason ? { reason: forcedReason } : {}),
  };
  world.invitations.history = appendHistoryCapped(world.invitations.history, entry);
  world.invitations.active = null;
  world.occupancy = null;
  world.activeActivity = null;
  return true;
}

/**
 * Called synchronously inside `advanceToNextDay` (doc 14 §3).
 * Expires any leftover offered/accepted invitation, clears occupancy, and nulls activeActivity.
 */
export function reconcileLivingRelationshipsOnDayAdvance(world: WorldState): WorldState {
  const res = expireInvitationsAt(world, world.day, world.minuteOfDay, 'day_end');
  return res.world;
}

/**
 * Shared minute-advance entry point for the `+2h` button (`App.tsx`) and tests
 * (`LR1-05`, `LR1-13`): advances `minuteOfDay` via `advanceSimulationClock` and
 * reconciles invitation expiry in one atomic transition.
 */
export function advanceClockAndReconcile(
  world: WorldState,
  deltaMinutes: number,
): InvitationMutationResult {
  const nextMin = advanceSimulationClock(world.minuteOfDay, deltaMinutes);
  const movedWorld: WorldState = {
    ...world,
    minuteOfDay: nextMin,
  };
  return expireInvitationsAt(movedWorld, movedWorld.day, nextMin);
}
