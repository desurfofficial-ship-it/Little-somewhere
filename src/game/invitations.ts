/**
 * Living Relationships LR-1 — invitation owner (doc 14 §1/§2, doc 16 §0.1).
 *
 * SINGLE OWNER of the invitation lifecycle. No other module may write
 * `world.invitations` or apply invitation validity rules (doc 14 §1: dialogue,
 * scene tick, station reducers must not write this slice).
 *
 * Spec of record: docs/architecture/living-relationships/14-revised-architecture.md
 *   §2.1 states + atomic archive      §2.3 generation gates (1-6)
 *   §2.4 single liveness predicate    §3  day-transition reconciliation
 * Acceptance plan: docs/architecture/living-relationships/16-lr1-lr2-acceptance-test-plan.md
 *
 * State machine (doc 14 §2.2):
 *   (none) --offerInvitation--> offered --acceptInvitation--> accepted --(LR-2 complete)--> (none)
 *      offered  --declineInvitation / expireInvitationsAt--> (none)
 *      accepted --expireInvitationsAt / day-advance reconcile--> (none)
 *   Every terminal path archives exactly one history entry, then nulls `active`.
 */

import {
  ActiveActivityState,
  InvitationHistoryEntry,
  InvitationOutcome,
  InvitationRecord,
  InvitationState,
  PlayerLocation,
  RelationshipTier,
  ResidentId,
  TeachingState,
  WorldState,
} from './types';
import { DAY_START_MINUTE, advanceSimulationClock, getTimePhase } from './time';
import { isResidentGuarded, getRelationshipTier, TIER_RANK } from './relationships';
import { getResidentScheduleSlot, RESIDENT_ORDER, RESIDENTS } from './residents';
import { clearAllOccupancy } from './occupancy';

// ---------------------------------------------------------------------------
// Exported policy constants (doc 19 #1: the cap must be an exported production
// constant the tests bind to — the literal 12 from superseded doc 03 is not law;
// 12 is the documented default bound of doc 16 LR1-23).
// ---------------------------------------------------------------------------

/** Bounded invitation history; oldest entries drop first on write (doc 14 §2.1). */
export const INVITATION_HISTORY_CAP = 12;
/** Minimum days between offers to the same host, inclusive at the boundary (doc 14 §2.3 gate 2). */
export const INVITATION_MIN_OFFER_SPACING_DAYS = 2;
/** A host is only invitable while their current phase slot sits within this radius
 * of their `homePos`, so the visit window can actually be honored (doc 14 §2.3 gate 4). */
export const INVITATION_HOST_HOME_RADIUS = 6;

/** Activities a resident can be invited to share (doc 14 §6.2 fixes the first one). */
export interface InvitableActivityDef {
  id: string;
  label: string;
  /** Visitable interior the shared moment happens in (occupancy wiring is LR-2). */
  location: PlayerLocation;
  /** Canonical same-day visit window; inclusive bounds (doc 16 LR1-06/07).
   * `windowEndMinute` bounds every created invite; the created `windowStartMinute`
   * is pulled down to the offer minute when the offer happens earlier, so the
   * invite is live at creation under the strict doc 14 §2.4 predicate (an offer
   * that is not yet inside its window would be expired by the very next minute
   * mutation — see offerInvitation). */
  windowStartMinute: number;
  windowEndMinute: number;
  /** Minimum player<->host relationship tier for the offer (doc 14 §2.3 gate 3). */
  minTier: RelationshipTier;
}

export const INVITABLE_ACTIVITIES: Record<string, InvitableActivityDef> = {
  // Doc 14 §6.2: the Linden Book Nook shared reading is the first milestone;
  // doc 16 LR1-05/06/07 fix its canonical window at 600-780 (10:00 AM-1:00 PM).
  share_featured_reading: {
    id: 'share_featured_reading',
    label: 'Share a featured reading at the Linden Book Nook',
    location: 'nook_interior',
    windowStartMinute: 600,
    windowEndMinute: 780,
    minTier: 'friendly',
  },
};

const VALID_INVITATION_STATUSES = new Set<string>(['offered', 'accepted']);
const VALID_INVITATION_OUTCOMES = new Set<string>(['completed', 'expired', 'declined']);

// ---------------------------------------------------------------------------
// Slice factories (used by WorldState defaults, migration v11, and the sanitizer)
// ---------------------------------------------------------------------------

export function createEmptyInvitationState(): InvitationState {
  return { active: null, history: [], lastOfferDayByHost: {} };
}

export function createInitialTeachingState(): TeachingState {
  return { known: [] };
}

/** Lazily guarantee the slice exists on worlds that predate LR-1 (defensive for
 * raw in-memory states; persisted saves always pass through the sanitizer). */
function ensureInvitationState(world: WorldState): InvitationState {
  if (!world.invitations) {
    world.invitations = createEmptyInvitationState();
  }
  return world.invitations;
}

// ---------------------------------------------------------------------------
// Sole validity predicate (doc 14 §2.4)
// ---------------------------------------------------------------------------

/**
 * `inv` is live iff day <= expiresDay AND windowStartMinute <= minute <= windowEndMinute
 * AND status is offered or accepted. `expiresDay` and the minute window are
 * conjunctive, not alternative (doc 14 §2.4; doc 16 LR1-06/07/20 fix the inclusive
 * boundaries). Anything else is expired.
 */
export function isInvitationLive(
  inv: InvitationRecord | null | undefined,
  day: number,
  minute: number,
): boolean {
  if (!inv || typeof inv !== 'object') return false;
  if (!VALID_INVITATION_STATUSES.has(inv.status)) return false;
  if (day > inv.expiresDay) return false;
  if (minute < inv.windowStartMinute) return false;
  if (minute > inv.windowEndMinute) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Atomic archive (doc 14 §2.1) — the only terminal-transition writer
// ---------------------------------------------------------------------------

/** Append one terminal entry, cap the history keeping the newest, then clear the
 * active slot plus its dependent slices (occupancy, activeActivity) in one atomic
 * step. `lastOfferDayByHost` is intentionally untouched: it was stamped at offer
 * time and must keep enforcing spacing after decline/expire (doc 14 §2.1). */
function archiveActiveInvitation(
  world: WorldState,
  outcome: InvitationOutcome,
  reason?: string,
): void {
  const state = ensureInvitationState(world);
  const active = state.active;
  if (!active) return;
  const entry: InvitationHistoryEntry = {
    outcome,
    hostId: active.hostId,
    day: world.day,
    invitationId: active.id,
  };
  if (reason) entry.reason = reason;
  state.history.push(entry);
  if (state.history.length > INVITATION_HISTORY_CAP) {
    state.history.splice(0, state.history.length - INVITATION_HISTORY_CAP);
  }
  state.active = null;
  // Doc 14 §4.2 lists expire/decline terminal paths among the occupancy clear
  // sites; activeActivity may never outlive a live accepted invite (doc 14 §4.3).
  clearAllOccupancy(world);
  world.activeActivity = null;
}

// ---------------------------------------------------------------------------
// Lifecycle operations
// ---------------------------------------------------------------------------

export type InvitationRejectionReason =
  | 'unknown_host'
  | 'unknown_activity'
  | 'invite_active'
  | 'host_spacing'
  | 'tier_too_low'
  | 'host_guarded'
  | 'host_unavailable'
  | 'no_offered_invite';

export interface InvitationMutationResult {
  ok: boolean;
  world: WorldState;
  reason?: InvitationRejectionReason;
  invitation?: InvitationRecord;
}

/**
 * Create a single `offered` invitation, or reject with a machine reason.
 * Gates in doc 14 §2.3 order; gate 6 (weather/personality) is a soft filter and
 * imposes no hard block in LR-1.
 */
export function offerInvitation(
  world: WorldState,
  hostId: ResidentId,
  activityId: string,
): InvitationMutationResult {
  const state = ensureInvitationState(world);

  // Gate 1 — at most one active invitation (doc 14 §2.3.1)
  if (state.active) {
    return { ok: false, world, reason: 'invite_active' };
  }
  if (!(RESIDENT_ORDER as readonly string[]).includes(hostId)) {
    return { ok: false, world, reason: 'unknown_host' };
  }
  const activity = INVITABLE_ACTIVITIES[activityId];
  if (!activity) {
    return { ok: false, world, reason: 'unknown_activity' };
  }

  // Gate 2 — per-host spacing, inclusive at the boundary (doc 14 §2.3.2)
  const lastOfferDay = state.lastOfferDayByHost[hostId] ?? -99;
  if (world.day - lastOfferDay < INVITATION_MIN_OFFER_SPACING_DAYS) {
    return { ok: false, world, reason: 'host_spacing' };
  }

  // Gate 3 — relationship tier and guard status (doc 14 §2.3.3)
  const rel = world.playerRelations[hostId];
  const tier = getRelationshipTier(rel?.affinity ?? 0);
  if (TIER_RANK[tier] < TIER_RANK[activity.minTier]) {
    return { ok: false, world, reason: 'tier_too_low' };
  }
  if (isResidentGuarded(rel)) {
    return { ok: false, world, reason: 'host_guarded' };
  }

  // Gate 4 — schedule compatibility: the host's current phase slot must sit within
  // the home radius so the visit window can be honored (doc 14 §2.3.4)
  const def = RESIDENTS[hostId];
  if (!def) {
    return { ok: false, world, reason: 'unknown_host' };
  }
  // Gate 4 (window half) — the visit window must still be open today. An offer
  // whose window has already passed cannot be honored (doc 14 §2.3.4: do not offer
  // a window that cannot be honored). Inclusive at windowEndMinute.
  if (world.minuteOfDay > activity.windowEndMinute) {
    return { ok: false, world, reason: 'host_unavailable' };
  }
  const phase = getTimePhase(world.minuteOfDay);
  const slot = getResidentScheduleSlot(hostId, phase, world.flags.claraArthurReconciled);
  // homePos is optional on the definition type but present for every resident;
  // defensively fall back to the slot target itself (distance 0 → eligible).
  const homePos = def.homePos ?? slot.target;
  const distFromHome = Math.hypot(slot.target.x - homePos.x, slot.target.z - homePos.z);
  if (distFromHome > INVITATION_HOST_HOME_RADIUS) {
    return { ok: false, world, reason: 'host_unavailable' };
  }

  // Gate 5 — no active exterior encounter for the host (doc 14 §2.3.5)
  if ((world.activeEncounters ?? []).some((enc) => enc.participants.includes(hostId))) {
    return { ok: false, world, reason: 'host_unavailable' };
  }

  // Deterministic id: unique under the invariants above (one active invite at a
  // time; per-host spacing >= 2 days), no RNG anywhere (doc 14 §determinism).
  // The created window always includes the offer minute (pulled down from the
  // canonical start when the offer happens earlier), so the invite is live at
  // creation and survives the strict §2.4 reconcile on the very next tick.
  const invitation: InvitationRecord = {
    id: `inv_d${world.day}m${Math.floor(world.minuteOfDay)}_${hostId}`,
    status: 'offered',
    hostId,
    activityId,
    offeredDay: world.day,
    expiresDay: world.day,
    windowStartMinute: Math.min(
      activity.windowStartMinute,
      Math.max(DAY_START_MINUTE, Math.floor(world.minuteOfDay)),
    ),
    windowEndMinute: activity.windowEndMinute,
  };
  state.active = invitation;
  state.lastOfferDayByHost[hostId] = world.day;
  return { ok: true, world, invitation };
}

/** `offered -> accepted`. Keeps the slot non-terminal (doc 14 §2.2; doc 16 LR1-03):
 * no history write, no affinity change, no other slice touched. */
export function acceptInvitation(world: WorldState): InvitationMutationResult {
  const state = ensureInvitationState(world);
  if (!state.active || state.active.status !== 'offered') {
    return { ok: false, world, reason: 'no_offered_invite' };
  }
  state.active.status = 'accepted';
  return { ok: true, world, invitation: state.active };
}

/** Archive an `offered` invite as `declined` and clear the slot. Declining is not
 * offered to an `accepted` invite (doc 16 LR2-11) and grants nothing (doc 14 §7:
 * "Decline/expire: no affinity change, no memory, no knowledge"). */
export function declineInvitation(world: WorldState): InvitationMutationResult {
  const state = ensureInvitationState(world);
  if (!state.active || state.active.status !== 'offered') {
    return { ok: false, world, reason: 'no_offered_invite' };
  }
  archiveActiveInvitation(world, 'declined');
  return { ok: true, world };
}

/**
 * Reconcile expiry at `(day, minute)`: archive the active invite as `expired`
 * when it is no longer live. This is the reconciliation primitive every
 * minute-mutation path must reach (doc 14 §2.4 call sites; doc 19 #2/#4). It
 * mutates in place and returns the same world reference (zero-GC tick path).
 */
export function expireInvitationsAt(world: WorldState, day: number, minute: number): WorldState {
  const state = ensureInvitationState(world);
  if (state.active && !isInvitationLive(state.active, day, minute)) {
    archiveActiveInvitation(world, 'expired');
  }
  return world;
}

/**
 * Shared minute-advance entry (doc 16 §0.1, illustrative name accepted by doc 19 #2):
 * advances the real simulation clock via `advanceSimulationClock`, then reconciles
 * invitation expiry in the same call. The +2h handler (`handleAdvanceTwoHours`) and
 * any future minute-mutation reducer must route through this entry — calling
 * `expireInvitationsAt` directly from an interaction layer is a bypass (doc 16 §0).
 */
export function advanceClockAndReconcile(
  world: WorldState,
  deltaMinutes: number,
): { ok: true; world: WorldState } {
  world.minuteOfDay = advanceSimulationClock(world.minuteOfDay, deltaMinutes);
  expireInvitationsAt(world, world.day, world.minuteOfDay);
  return { ok: true, world };
}

/**
 * Day-boundary reconciliation (doc 14 §3). Called from `advanceToNextDay`
 * BEFORE it returns — never as a follow-up tick:
 *   1. any active invite is archived as `expired` (a new day always ends a v1
 *      invite; no overnight invitations),
 *   2. occupancy is cleared,
 *   3. `activeActivity` is nulled,
 *   4. `teaching.known` and the rest of history are untouched.
 * Sleeping applies no relationship penalty and no reward (doc 16 LR1-12).
 */
export function reconcileLivingRelationshipsOnDayAdvance(world: WorldState): void {
  const state = ensureInvitationState(world);
  if (state.active) {
    archiveActiveInvitation(world, 'expired');
  }
  clearAllOccupancy(world);
  world.activeActivity = null;
}

// ---------------------------------------------------------------------------
// Sanitizer helpers — persistence-side validation for the LR-1 slices.
// The composition of the doc 14 §4.3 load invariant lives in the sanitizer
// (migrations.ts); these helpers own the per-slice rules.
// ---------------------------------------------------------------------------

/** Structural sanitize + §4.3 expiry rule for the invitations slice. A malformed
 * active invite is cleared (doc 16 LR1-16); a non-live active invite is archived
 * as `expired` on load (doc 14 §4.3 "expire active if present"). Unknown resident
 * ids are stripped (doc 15 §2.5). History is capped keeping the newest entries. */
export function sanitizeInvitationsSlice(
  raw: unknown,
  day: number,
  minuteOfDay: number,
  warnings: string[],
): InvitationState {
  const state = createEmptyInvitationState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return state;
  }
  const rawState = raw as Record<string, unknown>;

  if (Array.isArray(rawState.history)) {
    for (const entry of rawState.history) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const e = entry as Record<string, unknown>;
      if (
        typeof e.outcome !== 'string' ||
        !VALID_INVITATION_OUTCOMES.has(e.outcome) ||
        typeof e.hostId !== 'string' ||
        !(RESIDENT_ORDER as readonly string[]).includes(e.hostId) ||
        typeof e.invitationId !== 'string' ||
        !e.invitationId
      ) {
        continue; // drop malformed history rows
      }
      const normalized: InvitationHistoryEntry = {
        outcome: e.outcome as InvitationOutcome,
        hostId: e.hostId as ResidentId,
        day: Math.max(1, Math.floor(Number(e.day) || 1)),
        invitationId: e.invitationId,
      };
      if (typeof e.reason === 'string' && e.reason) normalized.reason = e.reason;
      state.history.push(normalized);
    }
    if (state.history.length > INVITATION_HISTORY_CAP) {
      state.history.splice(0, state.history.length - INVITATION_HISTORY_CAP);
    }
  }

  if (rawState.lastOfferDayByHost && typeof rawState.lastOfferDayByHost === 'object') {
    for (const [hostId, value] of Object.entries(
      rawState.lastOfferDayByHost as Record<string, unknown>,
    )) {
      if (!(RESIDENT_ORDER as readonly string[]).includes(hostId)) continue; // strip unknown ids
      if (typeof value === 'number' && Number.isFinite(value) && value >= 1) {
        state.lastOfferDayByHost[hostId as ResidentId] = Math.floor(value);
      }
    }
  }

  if (rawState.active && typeof rawState.active === 'object' && !Array.isArray(rawState.active)) {
    const a = rawState.active as Record<string, unknown>;
    const hostId = typeof a.hostId === 'string' ? a.hostId : '';
    const status = typeof a.status === 'string' ? a.status : '';
    const id = typeof a.id === 'string' ? a.id : '';
    const activityId = typeof a.activityId === 'string' ? a.activityId : '';
    const windowStart = typeof a.windowStartMinute === 'number' && Number.isFinite(a.windowStartMinute)
      ? a.windowStartMinute
      : NaN;
    const windowEnd = typeof a.windowEndMinute === 'number' && Number.isFinite(a.windowEndMinute)
      ? a.windowEndMinute
      : NaN;
    const offeredDay = typeof a.offeredDay === 'number' && Number.isFinite(a.offeredDay)
      ? Math.floor(a.offeredDay)
      : NaN;
    const expiresDay = typeof a.expiresDay === 'number' && Number.isFinite(a.expiresDay)
      ? Math.floor(a.expiresDay)
      : NaN;
    const shapeValid =
      id !== '' &&
      activityId !== '' &&
      (RESIDENT_ORDER as readonly string[]).includes(hostId) &&
      VALID_INVITATION_STATUSES.has(status) &&
      Number.isFinite(windowStart) &&
      Number.isFinite(windowEnd) &&
      Number.isFinite(offeredDay) &&
      Number.isFinite(expiresDay);
    if (!shapeValid) {
      warnings.push('invitations.active repaired: malformed or unknown-host invite cleared');
    } else {
      const record: InvitationRecord = {
        id,
        status: status as InvitationRecord['status'],
        hostId: hostId as ResidentId,
        activityId,
        offeredDay,
        expiresDay,
        windowStartMinute: windowStart,
        windowEndMinute: windowEnd,
      };
      // Doc 14 §4.3: an active invite that is no longer live at (day, minute) is
      // expired on load — never silently kept, never kept as a stale status.
      if (!isInvitationLive(record, day, minuteOfDay)) {
        state.history.push({
          outcome: 'expired',
          hostId: record.hostId,
          day,
          invitationId: record.id,
        });
        if (state.history.length > INVITATION_HISTORY_CAP) {
          state.history.splice(0, state.history.length - INVITATION_HISTORY_CAP);
        }
      } else {
        state.active = record;
      }
    }
  }

  return state;
}

/** Structural sanitize for the shared-activity slice. The orphan rule (clear when
 * `invitations.active === null`, doc 14 §4.3) is applied here against the already
 * sanitized invitation state. Unknown activity-id validation arrives with the
 * LR-2 activity registry; LR-1 validates structure only. */
export function sanitizeActiveActivitySlice(
  raw: unknown,
  invitations: InvitationState,
): ActiveActivityState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const a = raw as Record<string, unknown>;
  if (typeof a.activityId !== 'string' || !a.activityId) return null;
  if (!invitations.active) return null; // orphan — cleared on load (doc 16 LR1-15b)
  const out: ActiveActivityState = { activityId: a.activityId };
  if (typeof a.invitationId === 'string' && a.invitationId) out.invitationId = a.invitationId;
  return out;
}
