/**
 * Social Foundation SF-2 — Invitation Framework tests.
 *
 * Spec of record: docs/architecture/social-foundation/02-design-decision-register.md
 * Contracts:      docs/architecture/living-relationships/22-social-foundation-contracts.md
 *
 * Scope:
 *  - Capability evaluation is a pure composition of `canOfferInvitation`;
 *    adding hosts via the registry requires no framework change.
 *  - Player-initiated cancellation covers BOTH offered (decline contract)
 *    and accepted (forced-expiry writer, reason `player_cancelled`), never
 *    rewards anything, always clears occupancy/activeActivity, and survives
 *    the persistence sanitizer with its reason intact.
 *  - The derived ledger never mutates state.
 *  - Every mutation composes the canonical writers — asserted by observing
 *    the exact chassis outcomes (history outcomes, cooldown stamps).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreshWorldState, serializeWorldState, deserializeWorldState } from './storage';
import { offerInvitation, acceptInvitation, isInvitationLive, expireInvitationsAt } from './invitations';
import { SHARED_ACTIVITIES } from './activities';
import type { ResidentId, WorldState } from './types';
import {
  cancelActiveInvitation,
  describeHostReadiness,
  describeInvitationCapabilities,
  getInvitationLedger,
  getInvitationReasonLabel,
  INVITATION_REASON_LABELS,
  PLAYER_CANCELLED_REASON,
} from './invitationFramework';

const ACTIVITY_ID = 'share_featured_reading';
const HOST: ResidentId = 'nora';

function invitedWorld(minute = 560): { world: WorldState; invitationId: string } {
  const world = createFreshWorldState() as WorldState;
  world.day = 4;
  world.minuteOfDay = minute;
  const rel = world.playerRelations[HOST];
  rel.affinity = 60;
  rel.familiarity = 40;
  rel.talkedCount = 4;
  rel.reliability = 40;
  world.residents[HOST].met = true;
  world.residents[HOST].trust = 3;
  const offer = offerInvitation(world, HOST, ACTIVITY_ID);
  assert.equal(offer.ok, true);
  return { world: offer.world, invitationId: offer.world.invitations.active!.id };
}

function acceptedWorld(): { world: WorldState; invitationId: string } {
  const staged = invitedWorld();
  const accept = acceptInvitation(staged.world);
  assert.equal(accept.ok, true);
  return { world: accept.world, invitationId: staged.invitationId };
}

// ---------------------------------------------------------------------------
// Reason labels
// ---------------------------------------------------------------------------

test('SF2-01: every chassis reason string has player-legible copy', () => {
  const reasons = [
    'active_invitation_exists',
    'invalid_activity',
    'spacing_cooldown',
    'host_guarded',
    'tier_too_low',
    'offer_phase_closed',
    'host_unavailable',
    'no_offered_invitation',
    'invitation_expired',
    'cannot_decline_state',
    'unknown_activity',
    'no_matching_accepted_invitation',
    'host_mismatch',
    'wrong_location',
    'occupant_not_present',
    'already_completed',
    'no_active_invitation',
    PLAYER_CANCELLED_REASON,
  ];
  for (const reason of reasons) {
    assert.ok(
      INVITATION_REASON_LABELS[reason],
      `missing label for ${reason}`,
    );
    assert.ok(getInvitationReasonLabel(reason).length > 0);
  }
  assert.equal(getInvitationReasonLabel(undefined), '');
  assert.ok(getInvitationReasonLabel('mystery_reason').length > 0); // graceful fallback
});

// ---------------------------------------------------------------------------
// Capability evaluation
// ---------------------------------------------------------------------------

test('SF2-02: capability rows cover the whole registry with honest standing', () => {
  const world = createFreshWorldState() as WorldState;
  world.day = 4;
  world.minuteOfDay = 560;
  const rows = describeInvitationCapabilities(world);
  assert.equal(rows.length, Object.keys(SHARED_ACTIVITIES).length);
  const noraRow = rows.find((r) => r.hostId === 'nora');
  assert.ok(noraRow);
  assert.equal(noraRow.activityId, ACTIVITY_ID);
  assert.equal(noraRow.eligibility.eligible, false);
  assert.equal(noraRow.eligibility.reason, 'tier_too_low');
  assert.equal(noraRow.reasonLabel, 'You are still getting to know each other.');
  assert.equal(noraRow.tierStanding.unlockMet, false);
  assert.equal(noraRow.tierStanding.affinityMet, false);
  assert.equal(noraRow.cooldownDaysRemaining, 0);
  // The decomposition must agree with the chassis verdict.
  assert.equal(noraRow.tierStanding.unlockMet, noraRow.eligibility.reason !== 'tier_too_low');
});

test('SF2-03: a fully eligible host produces an eligible row (registry-driven reuse)', () => {
  const { world } = invitedWorld(560);
  // With the single active slot occupied, capability evaluation reports the
  // slot constraint for every host — the registry-level truth.
  const rows = describeInvitationCapabilities(world);
  for (const row of rows) {
    assert.equal(row.eligibility.eligible, false);
    assert.equal(row.eligibility.reason, 'active_invitation_exists');
  }
});

test('SF2-04: spacing cooldown surfaces as days remaining in rows and ledger', () => {
  const { world } = invitedWorld(560);
  // Cancel (clears active) — spacing was stamped at offer time (day 4).
  const cancel = cancelActiveInvitation(world);
  assert.equal(cancel.ok, true);

  // Re-offer on the same day is spacing-blocked: 2-day spacing, day - 4 = 0 < 2.
  const rows = describeInvitationCapabilities(cancel.world, HOST);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].eligibility.eligible, false);
  assert.equal(rows[0].eligibility.reason, 'spacing_cooldown');
  assert.equal(rows[0].cooldownDaysRemaining, 2);
});

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

test('SF2-05: cancelling an OFFERED invitation composes the decline contract', () => {
  const { world, invitationId } = invitedWorld(560);
  const before = JSON.stringify({
    affinity: world.playerRelations[HOST].affinity,
    reliability: world.playerRelations[HOST].reliability,
    memories: world.memories.length,
  });

  const cancel = cancelActiveInvitation(world);
  assert.equal(cancel.ok, true);
  assert.equal(cancel.cancelled, true);
  assert.equal(cancel.previousStatus, 'offered');
  assert.ok(cancel.toast);
  const next = cancel.world;

  assert.equal(next.invitations.active, null);
  const entry = next.invitations.history.at(-1)!;
  assert.equal(entry.invitationId, invitationId);
  assert.equal(entry.outcome, 'declined');
  assert.equal(entry.reason, undefined); // decline contract: no reason, no rewards

  const after = JSON.stringify({
    affinity: next.playerRelations[HOST].affinity,
    reliability: next.playerRelations[HOST].reliability,
    memories: next.memories.length,
  });
  assert.equal(after, before); // zero-reward guarantee
});

test('SF2-06: cancelling an ACCEPTED invitation archives the machine reason and clears visit state', () => {
  const { world, invitationId } = acceptedWorld();
  // Simulate an indoor mid-visit state that cancellation must also clear.
  world.occupancy = {
    residentId: HOST,
    location: 'nook_interior',
    stationId: SHARED_ACTIVITIES[ACTIVITY_ID].stationId,
    invitationId,
  } as WorldState['occupancy'];
  world.activeActivity = {
    activityId: ACTIVITY_ID,
    invitationId,
  } as WorldState['activeActivity'];

  const relBefore = {
    affinity: world.playerRelations[HOST].affinity,
    reliability: world.playerRelations[HOST].reliability,
    favorsCompleted: world.playerRelations[HOST].favorsCompleted,
  };

  const cancel = cancelActiveInvitation(world);
  assert.equal(cancel.ok, true);
  assert.equal(cancel.cancelled, true);
  assert.equal(cancel.previousStatus, 'accepted');
  const next = cancel.world;

  assert.equal(next.invitations.active, null);
  assert.equal(next.occupancy, null);
  assert.equal(next.activeActivity, null);
  const entry = next.invitations.history.at(-1)!;
  assert.equal(entry.invitationId, invitationId);
  assert.equal(entry.outcome, 'expired');
  assert.equal(entry.reason, PLAYER_CANCELLED_REASON);

  // Zero-reward guarantee on the withdrawal path.
  assert.equal(next.playerRelations[HOST].affinity, relBefore.affinity);
  assert.equal(next.playerRelations[HOST].reliability, relBefore.reliability);
  assert.equal(next.playerRelations[HOST].favorsCompleted, relBefore.favorsCompleted);
  assert.equal(next.memories.length, 1); // starter memory only
});

test('SF2-07: cancelling with no active invitation fails gracefully', () => {
  const world = createFreshWorldState() as WorldState;
  const cancel = cancelActiveInvitation(world);
  assert.equal(cancel.ok, false);
  assert.equal(cancel.reason, 'no_active_invitation');
  assert.equal(world.invitations.active, null);
});

test('SF2-08: the cancelled history entry survives the persistence round-trip', () => {
  const { world, invitationId } = acceptedWorld();
  const cancel = cancelActiveInvitation(world);
  assert.equal(cancel.ok, true);

  const serialized = serializeWorldState(cancel.world);
  const restored = deserializeWorldState(serialized);
  assert.ok(restored.state);

  const restoredEntry = restored.state!.invitations.history.find(
    (e) => e.invitationId === invitationId,
  );
  assert.ok(restoredEntry);
  assert.equal(restoredEntry.outcome, 'expired');
  assert.equal(restoredEntry.reason, PLAYER_CANCELLED_REASON);
  assert.equal(restored.state!.invitations.active, null);
  assert.equal(restored.warnings?.length ?? 0, 0);
});

test('SF2-09: cancellation preserves the spacing stamp (re-offer still cooldown-blocked)', () => {
  const { world } = acceptedWorld();
  const cancel = cancelActiveInvitation(world);
  assert.equal(cancel.ok, true);
  assert.equal(cancel.world.invitations.lastOfferDayByHost[HOST], world.day);

  const gate = offerInvitation(cancel.world, HOST, ACTIVITY_ID);
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, 'spacing_cooldown');
});

test('SF2-10: cancel → accept-of-expired recovery path stays fail-closed', () => {
  const { world } = acceptedWorld();
  // Push past the window without touching the record (clock only).
  world.minuteOfDay = SHARED_ACTIVITIES[ACTIVITY_ID].defaultDurationMinutes + 1200;
  assert.equal(isInvitationLive(world.invitations.active, world.day, world.minuteOfDay), false);

  // Cancel still archives (forced reason), and never revives the record.
  const cancel = cancelActiveInvitation(world);
  assert.equal(cancel.ok, true);
  assert.equal(cancel.world.invitations.active, null);
  assert.equal(cancel.world.invitations.history.at(-1)!.reason, PLAYER_CANCELLED_REASON);
});

// ---------------------------------------------------------------------------
// Ledger and readiness
// ---------------------------------------------------------------------------

test('SF2-11: the ledger derives active, history and cooldowns without mutation', () => {
  const { world, invitationId } = acceptedWorld();
  const before = JSON.stringify(world);
  const ledger = getInvitationLedger(world);
  assert.equal(JSON.stringify(world), before);

  assert.ok(ledger.active);
  assert.equal(ledger.active.invitationId, invitationId);
  assert.equal(ledger.active.hostName, 'Nora');
  assert.equal(ledger.active.activityTitle, 'Shared Featured Reading');
  assert.equal(ledger.active.live, true);
  assert.equal(ledger.history.length, 0);
  assert.equal(ledger.historyCap, 12);
  assert.equal(ledger.spacingDays, 2);
});

test('SF2-12: ledger history labels cancellation honestly', () => {
  const { world } = acceptedWorld();
  const cancel = cancelActiveInvitation(world);
  assert.equal(cancel.ok, true);

  const ledger = getInvitationLedger(cancel.world);
  assert.equal(ledger.history.length, 1);
  assert.equal(ledger.history[0].outcomeLabel, 'Stepped back');
  assert.equal(ledger.history[0].reason, PLAYER_CANCELLED_REASON);

  // A natural expiry archived by the chassis writer (no forced reason) reads differently.
  const { world: expiredWorld } = invitedWorld(560);
  const accept = acceptInvitation(expiredWorld);
  assert.equal(accept.ok, true);
  const pushed = { ...accept.world, minuteOfDay: 1250 };
  const natural = expireInvitationsAt(pushed, pushed.day, pushed.minuteOfDay);
  assert.equal(natural.ok, true);
  assert.equal(natural.world.invitations.history.at(-1)!.outcome, 'expired');
  assert.equal(natural.world.invitations.history.at(-1)!.reason, undefined);
  const naturalLedger = getInvitationLedger(natural.world);
  assert.equal(naturalLedger.history[0].outcomeLabel, 'Quietly passed');
});

test('SF2-13: host readiness summarizes the actionable social state', () => {
  const world = createFreshWorldState() as WorldState;
  world.day = 4;
  world.minuteOfDay = 560; // morning, Nora at the Book Nook
  const readiness = describeHostReadiness(world, HOST);
  assert.equal(readiness.hostName, 'Nora');
  assert.equal(readiness.homeName, 'Linden Book Nook');
  assert.equal(readiness.met, false);
  assert.equal(readiness.tier, 'stranger');
  assert.equal(readiness.guarded, false);
  assert.equal(readiness.hostAvailable, true);
  assert.equal(readiness.hasRegistryActivity, true);
  assert.equal(readiness.currentPhase, 'morning');

  // An off-schedule phase makes the host unavailable.
  world.minuteOfDay = 800; // afternoon — Nora at the plaza bench
  assert.equal(describeHostReadiness(world, HOST).hostAvailable, false);
});
