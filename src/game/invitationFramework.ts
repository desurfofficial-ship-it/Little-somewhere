import {
  declineInvitation,
  expireInvitationsAt,
  isHostAvailableForActivity,
  isInvitationLive,
  INVITATION_HISTORY_CAP,
  INVITATION_MIN_SPACING_DAYS,
  InvitationMutationResult,
  canOfferInvitation,
  InvitationEligibilityResult,
} from './invitations';
import { SHARED_ACTIVITIES } from './activities';
import { RESIDENTS, RESIDENT_ORDER } from './residents';
import { getRelationshipTier, getRelationshipTierLabel, isResidentGuarded } from './relationships';
import {
  InvitationRecord,
  ResidentId,
  TimePhase,
  WorldState,
} from './types';
import { getEffectivePlayerAffinity, meetsRelationshipUnlock } from './socialProfile';
import { getTimePhase } from './time';

/**
 * Invitation Framework (Living Relationships — Social Foundation, SF-2).
 *
 * A pure COMPOSITION layer over the LR-1/LR-2 invitation chassis
 * (`invitations.ts` + `activities.ts`). It adds the reusable, host-agnostic
 * capabilities the chassis deliberately does not own:
 *
 *   1. machine-reason → player-legible copy (`INVITATION_REASON_LABELS`);
 *   2. a single capability query over the whole `SHARED_ACTIVITIES` registry
 *      (`describeInvitationCapabilities` / `describeHostReadiness`);
 *   3. player-initiated cancellation of an active invitation, including the
 *      post-acceptance withdrawal that previously had no player-facing path
 *      (`cancelActiveInvitation`);
 *   4. a derived ledger view for UI/journal/tests (`getInvitationLedger`).
 *
 * Binding rules of engagement (docs/architecture/living-relationships/22 §3):
 *   - This module NEVER writes `world.invitations.active`,
 *     `world.occupancy`, or `world.activeActivity` directly. Every mutation
 *     composes one of the canonical writers (`offerInvitation`,
 *     `acceptInvitation`, `declineInvitation`, `expireInvitationsAt`,
 *     `completeSharedActivity`).
 *   - Zero new persisted state: cancellation rides the existing `expired`
 *     history outcome with a machine `reason` string; WorldState stays v11.
 *   - LR-3 (Clara / bakery) reserves its own seams — `share_morning_pastry`,
 *     the `dialogue/invitations/clara.ts` quartet, `reconcileInvitedInteriorEntry`
 *     and the `offer_phase_closed` eligibility reason. This module neither
 *     defines nor shadows any of them.
 *   - Deterministic and pure over `WorldState`; no wall clock, no RNG.
 *
 * Pure TypeScript — zero DOM, React, or Three.js dependencies.
 */

/** Machine reason stamped on history when the player withdraws. */
export const PLAYER_CANCELLED_REASON = 'player_cancelled';

/**
 * Player-legible copy for every machine reason the chassis can emit
 * (`invitations.ts` eligibility/transition reasons + `activities.ts`
 * completion-refusal reasons + this module's own). UI layers must render
 * through this map instead of hand-writing strings, so new reasons and new
 * hosts stay legible for free.
 */
export const INVITATION_REASON_LABELS: Readonly<Record<string, string>> = {
  // canOfferInvitation (invitations.ts)
  active_invitation_exists: 'You already have a plan brewing with someone.',
  invalid_activity: 'That activity does not exist for this host.',
  spacing_cooldown: 'You shared a moment recently — let it breathe for a day or two.',
  host_guarded: 'They seem guarded today; maybe a kind word first.',
  tier_too_low: 'You are still getting to know each other.',
  host_unavailable: 'They are away from home right now.',
  // accept / decline / expiry transitions (invitations.ts)
  no_offered_invitation: 'There is no open invitation to answer.',
  invitation_expired: 'That invitation has quietly passed.',
  cannot_decline_state: 'The moment to decline has passed.',
  // shared-activity completion refusals (activities.ts)
  unknown_activity: 'That activity does not exist.',
  no_matching_accepted_invitation: 'No accepted visit matches that activity.',
  host_mismatch: 'That visit belongs to someone else.',
  wrong_location: 'You are not in the right place for this visit.',
  occupant_not_present: 'Your host is not here yet.',
  already_completed: 'That moment has already been shared and remembered.',
  // this framework
  no_active_invitation: 'There is no open plan to step back from.',
  [PLAYER_CANCELLED_REASON]: 'You quietly stepped back from the plan.',
};

export function getInvitationReasonLabel(reason: string | undefined): string {
  if (!reason) return '';
  return INVITATION_REASON_LABELS[reason] ?? 'For reasons the lane keeps to itself.';
}

// ---------------------------------------------------------------------------
// Player-initiated cancellation
// ---------------------------------------------------------------------------

export interface CancelInvitationResult extends InvitationMutationResult {
  cancelled?: boolean;
  previousStatus?: InvitationRecord['status'];
}

/**
 * Player-initiated cancellation of the ACTIVE invitation, for BOTH statuses:
 *
 * - `offered`  → composes `declineInvitation` (the chassis' contract-true
 *   refusal writer; outcome 'declined', rewards nothing — invitations.ts
 *   contract "Decline ONLY an offered invitation … never rewards").
 * - `accepted` → composes `expireInvitationsAt` with the machine reason
 *   `player_cancelled` (the chassis' forced-expiry writer; archives a capped
 *   history entry, clears occupancy and activeActivity, idempotent). The
 *   history outcome stays 'expired' — deliberately NO new outcome enum, per
 *   the v11 registry-only persistence policy (D7 stop-rule).
 *
 * Zero-reward guarantee: neither writer touches affinity, reliability,
 * memories, or teaching — the zero-FOMO rule ("no penalty for changing
 * plans") holds by construction, and is pinned by test.
 */
export function cancelActiveInvitation(world: WorldState): CancelInvitationResult {
  const active = world.invitations?.active ?? null;
  if (!active) {
    return { ok: false, world, reason: 'no_active_invitation' };
  }

  const hostName = RESIDENTS[active.hostId]?.name ?? 'your host';

  if (active.status === 'offered') {
    const res = declineInvitation(world);
    if (!res.ok) {
      return { ...res, cancelled: false };
    }
    return {
      ok: true,
      cancelled: true,
      previousStatus: 'offered',
      toast: `You let ${hostName}'s invitation drift past for now — no hard feelings.`,
      world: res.world,
    };
  }

  const res = expireInvitationsAt(world, world.day, world.minuteOfDay, PLAYER_CANCELLED_REASON);
  if (!res.ok) {
    return { ...res, cancelled: false };
  }
  return {
    ok: true,
    cancelled: true,
    // Only the two machine statuses exist in production; a corrupted record
    // must not be reported as 'accepted' (cosmetic truth, QA finding F6).
    previousStatus: active.status === 'accepted' ? 'accepted' : undefined,
    toast: `You quietly stepped back from your visit with ${hostName}. Another day will come.`,
    world: res.world,
  };
}

// ---------------------------------------------------------------------------
// Capability evaluation over the registry
// ---------------------------------------------------------------------------

export interface InvitationTierStanding {
  affinity: number;
  tier: ReturnType<typeof getRelationshipTier>;
  tierLabel: string;
  minTier: string;
  minAffinity: number;
  /** OR-reading of the chassis gate (`meetsRelationshipUnlock`). */
  unlockMet: boolean;
  tierMet: boolean;
  affinityMet: boolean;
}

export interface InvitationCapabilityRow {
  activityId: string;
  activityTitle: string;
  hostId: ResidentId;
  hostName: string;
  venueLabel: string;
  /** Chassis verdict (`canOfferInvitation`) — the machine truth. */
  eligibility: InvitationEligibilityResult;
  reasonLabel?: string;
  /** Decomposed standing so UI can explain WHAT to grow (never a new gate). */
  tierStanding: InvitationTierStanding;
  guarded: boolean;
  hostAvailable: boolean;
  /** Days left before this host's 2-day offer spacing clears (0 = clear). */
  cooldownDaysRemaining: number;
}

/**
 * One row per registry activity (optionally filtered to one host), evaluated
 * purely through `canOfferInvitation` + decomposed standing. Adding a future
 * host = adding a `SHARED_ACTIVITIES` def; this query picks it up with no
 * code change — that is the reusability contract.
 */
export function describeInvitationCapabilities(
  world: WorldState,
  hostId?: ResidentId,
): InvitationCapabilityRow[] {
  const invState = world.invitations;
  const rows: InvitationCapabilityRow[] = [];

  for (const activityId of Object.keys(SHARED_ACTIVITIES)) {
    const def = SHARED_ACTIVITIES[activityId];
    if (hostId && def.hostId !== hostId) continue;
    const host = def.hostId;

    const eligibility = canOfferInvitation(world, host, activityId);
    const affinity = getEffectivePlayerAffinity(world, host);
    const tier = getRelationshipTier(affinity);
    const tierMet = tiersAtLeast(tier, def.minTier);
    const affinityMet = affinity >= def.minAffinity;

    const lastOfferDay = invState?.lastOfferDayByHost?.[host];
    const cooldownDaysRemaining =
      typeof lastOfferDay === 'number'
        ? Math.max(0, INVITATION_MIN_SPACING_DAYS - (world.day - lastOfferDay))
        : 0;

    rows.push({
      activityId,
      activityTitle: def.title,
      hostId: host,
      hostName: RESIDENTS[host].name,
      venueLabel: RESIDENTS[host].homeName,
      eligibility,
      reasonLabel: eligibility.eligible ? undefined : getInvitationReasonLabel(eligibility.reason),
      tierStanding: {
        affinity,
        tier,
        tierLabel: getRelationshipTierLabel(tier),
        minTier: def.minTier,
        minAffinity: def.minAffinity,
        unlockMet: meetsRelationshipUnlock(affinity, {
          minTier: def.minTier,
          minAffinity: def.minAffinity,
        }),
        tierMet,
        affinityMet,
      },
      guarded: isResidentGuarded(world.playerRelations?.[host], world.npcRuntime?.[host]?.emotion),
      hostAvailable: isHostAvailableForActivity(world, host),
      cooldownDaysRemaining,
    });
  }

  return rows;
}

function tiersAtLeast(
  current: ReturnType<typeof getRelationshipTier>,
  min: string,
): boolean {
  const ORDER = { stranger: 0, acquaintance: 1, friendly: 2, close: 3, kindred: 4 } as const;
  return ORDER[current] >= ORDER[min as keyof typeof ORDER];
}

export interface HostReadinessSummary {
  hostId: ResidentId;
  hostName: string;
  homeName: string;
  met: boolean;
  affinity: number;
  tier: ReturnType<typeof getRelationshipTier>;
  tierLabel: string;
  guarded: boolean;
  hostAvailable: boolean;
  currentPhase: TimePhase;
  hasRegistryActivity: boolean;
}

/**
 * Compact readiness view for one host — what a UI/dialogue layer needs to
 * explain why an invitation can or cannot happen right now.
 */
export function describeHostReadiness(world: WorldState, hostId: ResidentId): HostReadinessSummary {
  const affinity = getEffectivePlayerAffinity(world, hostId);
  const tier = getRelationshipTier(affinity);
  const rel = world.playerRelations?.[hostId];
  return {
    hostId,
    hostName: RESIDENTS[hostId].name,
    homeName: RESIDENTS[hostId].homeName,
    met: world.residents[hostId]?.met ?? false,
    affinity,
    tier,
    tierLabel: getRelationshipTierLabel(tier),
    guarded: isResidentGuarded(rel, world.npcRuntime?.[hostId]?.emotion),
    hostAvailable: isHostAvailableForActivity(world, hostId),
    currentPhase: getTimePhase(world.minuteOfDay),
    hasRegistryActivity: Object.values(SHARED_ACTIVITIES).some((d) => d.hostId === hostId),
  };
}

// ---------------------------------------------------------------------------
// Derived ledger
// ---------------------------------------------------------------------------

export interface InvitationLedgerActive {
  invitationId: string;
  status: InvitationRecord['status'];
  hostId: ResidentId;
  hostName: string;
  venueLabel: string;
  activityId: string;
  activityTitle: string;
  live: boolean;
  offeredDay: number;
  windowStartMinute: number;
  windowEndMinute: number;
}

export interface InvitationLedgerHistoryRow {
  invitationId: string;
  hostId: ResidentId;
  hostName: string;
  activityId: string;
  activityTitle: string;
  day: number;
  outcome: 'completed' | 'declined' | 'expired';
  outcomeLabel: string;
  reason?: string;
}

export interface InvitationLedger {
  active: InvitationLedgerActive | null;
  history: InvitationLedgerHistoryRow[];
  historyCap: number;
  spacingDays: number;
  cooldownDaysRemainingByHost: Record<ResidentId, number>;
}

function outcomeLabelFor(outcome: InvitationLedgerHistoryRow['outcome'], reason?: string): string {
  if (outcome === 'completed') return 'Completed';
  if (outcome === 'declined') return 'Declined';
  return reason === PLAYER_CANCELLED_REASON ? 'Stepped back' : 'Quietly passed';
}

/**
 * The full invitation story of a save — active plan, capped history with
 * legible outcomes, and per-host spacing cooldowns — derived from the
 * chassis state without owning any of it.
 */
export function getInvitationLedger(world: WorldState): InvitationLedger {
  const invState = world.invitations;
  const active = invState?.active ?? null;

  const activeView: InvitationLedgerActive | null = active
    ? {
        invitationId: active.id,
        status: active.status,
        hostId: active.hostId,
        hostName: RESIDENTS[active.hostId]?.name ?? active.hostId,
        venueLabel: RESIDENTS[active.hostId]?.homeName ?? '',
        activityId: active.activityId,
        activityTitle: SHARED_ACTIVITIES[active.activityId]?.title ?? active.activityId,
        live: isInvitationLive(active, world.day, world.minuteOfDay),
        offeredDay: active.offeredDay,
        windowStartMinute: active.windowStartMinute,
        windowEndMinute: active.windowEndMinute,
      }
    : null;

  const history: InvitationLedgerHistoryRow[] = (invState?.history ?? []).map((entry) => ({
    invitationId: entry.invitationId,
    hostId: entry.hostId,
    hostName: RESIDENTS[entry.hostId]?.name ?? entry.hostId,
    activityId: entry.activityId,
    activityTitle: SHARED_ACTIVITIES[entry.activityId]?.title ?? entry.activityId,
    day: entry.day,
    outcome: entry.outcome,
    outcomeLabel: outcomeLabelFor(entry.outcome, entry.reason),
    ...(entry.reason ? { reason: entry.reason } : {}),
  }));

  const cooldownDaysRemainingByHost = {} as Record<ResidentId, number>;
  for (const id of RESIDENT_ORDER) {
    const lastOfferDay = invState?.lastOfferDayByHost?.[id];
    cooldownDaysRemainingByHost[id] =
      typeof lastOfferDay === 'number'
        ? Math.max(0, INVITATION_MIN_SPACING_DAYS - (world.day - lastOfferDay))
        : 0;
  }

  return {
    active: activeView,
    history,
    historyCap: INVITATION_HISTORY_CAP,
    spacingDays: INVITATION_MIN_SPACING_DAYS,
    cooldownDaysRemainingByHost,
  };
}
