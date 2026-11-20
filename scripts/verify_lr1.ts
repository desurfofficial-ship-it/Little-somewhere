/**
 * LR-1 post-implementation verification (Phase 7 of the assignment).
 * Run with: npx tsx scripts/verify_lr1.ts
 *
 * Covers: fresh + migrated saves, round-trip persistence, repeated clock
 * advancement, repeated sleep transitions, and determinism across equivalent
 * seeded scenarios. Pure node — no localStorage needed.
 */
import {
  advanceClockAndReconcile,
  declineInvitation,
  expireInvitationsAt,
  isInvitationLive,
  offerInvitation,
  acceptInvitation,
  INVITATION_HISTORY_CAP,
} from '../src/game/invitations';
import { advanceToNextDay, deserializeWorldState, serializeWorldState } from '../src/game/storage';
import { migrateWorldState, CURRENT_SCHEMA_VERSION } from '../src/game/migrations';
import { stepSimulationInPlace } from '../src/game/simulation';
import { createFreshWorldState } from '../src/game/storage';
import type { WorldState } from '../src/game/types';

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}`);
  }
}

function friendlyNora(w: WorldState): WorldState {
  const rel = w.playerRelations.nora;
  rel.affinity = 60;
  rel.reliability = 25;
  rel.negativeCount = 0;
  w.residents.nora.met = true;
  return w;
}

/** Stage an accepted invite directly (as doc 16 path-case fixtures do) — bypasses
 * offer gates, which is correct: these scenarios exercise the reconcile paths. */
function stageAcceptedInvite(w: WorldState, windowStart = 600, windowEnd = 780): void {
  w.invitations = {
    active: {
      id: 'lr_verify_invite',
      status: 'accepted',
      hostId: 'nora',
      activityId: 'share_featured_reading',
      offeredDay: w.day,
      expiresDay: w.day,
      windowStartMinute: windowStart,
      windowEndMinute: windowEnd,
    },
    history: [],
    lastOfferDayByHost: { nora: w.day },
  };
}

console.log(`runtime CURRENT_SCHEMA_VERSION = ${CURRENT_SCHEMA_VERSION}`);

// --- 1. Fresh world shape -------------------------------------------------
{
  const fresh = createFreshWorldState();
  check('fresh world carries all four LR slices', Boolean(
    fresh.invitations && 'occupancy' in fresh && 'teaching' in fresh && 'activeActivity' in fresh,
  ));
  check('fresh world schemaVersion is current', fresh.schemaVersion === CURRENT_SCHEMA_VERSION);
}

// --- 2. Fresh save round-trip ----------------------------------------------
{
  const w = friendlyNora(createFreshWorldState());
  const res = offerInvitation(w, 'nora', 'share_featured_reading');
  check('offer succeeds on a fresh world', res.ok === true);
  const roundTrip = deserializeWorldState(serializeWorldState(w)).state;
  check('active invite survives a fresh save round-trip',
    roundTrip.invitations?.active?.id === res.invitation?.id &&
    roundTrip.invitations?.active?.status === 'offered');
}

// --- 3. v10 save migrates and keeps progress --------------------------------
{
  const base = createFreshWorldState();
  const v10Payload = {
    ...JSON.parse(serializeWorldState(base)),
    schemaVersion: 10,
    day: 4,
    nookState: { ...base.nookState, shelfBrowsedDay: 3, booksRead: 2, teasShared: 1 },
  } as Record<string, unknown>;
  delete v10Payload.invitations;
  delete v10Payload.occupancy;
  delete v10Payload.teaching;
  delete v10Payload.activeActivity;
  const res = migrateWorldState(v10Payload);
  check('v10 save lands on the current schema', res.state.schemaVersion === CURRENT_SCHEMA_VERSION);
  check('migratedFromVersion records the v10 entry point', res.migratedFromVersion === 10);
  check('v10 save receives seeded LR slices', Boolean(
    res.state.invitations?.active === null &&
    res.state.invitations?.history?.length === 0 &&
    res.state.occupancy === null &&
    res.state.teaching?.known?.length === 0 &&
    res.state.activeActivity === null,
  ));
  check('v10 nook progress preserved', res.state.nookState.booksRead === 2 && res.state.nookState.shelfBrowsedDay === 3);
  check('v10 day preserved', res.state.day === 4);
}

// --- 4. Repeated clock advancement through the shared entry ------------------
{
  const w = friendlyNora(createFreshWorldState());
  w.minuteOfDay = 500;
  offerInvitation(w, 'nora', 'share_featured_reading');
  acceptInvitation(w);
  const historyBefore = w.invitations!.history.length;
  for (let i = 0; i < 6; i++) {
    advanceClockAndReconcile(w, 120);
  }
  check('repeated +2h advancement expires the invite exactly once',
    w.invitations!.active === null &&
    w.invitations!.history.length === historyBefore + 1 &&
    w.invitations!.history[w.invitations!.history.length - 1].outcome === 'expired');
  check('clock clamps at day end without rolling over', w.minuteOfDay === 1220);
}

// --- 5. Sim tick expiry then sleep (interrupted session, repeated) -----------
{
  const w = friendlyNora(createFreshWorldState());
  w.minuteOfDay = 779;
  stageAcceptedInvite(w);
  stepSimulationInPlace(w, 0.2, { clockRateMinutesPerSec: 10 });
  check('sim tick expires across the window', w.invitations!.active === null);
  const nextDay = advanceToNextDay(w);
  const expiredRows = nextDay.invitations!.history.filter((e) => e.outcome === 'expired').length;
  check('sleep after tick expiry does not double-archive', expiredRows === 1);
  check('sleep clears occupancy and activeActivity', nextDay.occupancy === null && nextDay.activeActivity === null);
}

// --- 6. Repeated sleep transitions with steady state -------------------------
{
  let w = friendlyNora(createFreshWorldState());
  let stable = true;
  for (let i = 0; i < 5; i++) {
    const next = advanceToNextDay(w);
    stable = stable && next.invitations!.active === null && next.invitations!.history.length === 0;
    w = next;
  }
  check('five consecutive sleeps with no invites leave history empty', stable);
}

// --- 7. Determinism: equivalent seeded scenarios produce identical saves -----
{
  function scenario(): string {
    const w = friendlyNora(createFreshWorldState());
    offerInvitation(w, 'nora', 'share_featured_reading');
    declineInvitation(w);
    offerInvitation(w, 'nora', 'share_featured_reading');
    acceptInvitation(w);
    advanceClockAndReconcile(w, 120);
    advanceClockAndReconcile(w, 120);
    const next = advanceToNextDay(w);
    stepSimulationInPlace(next, 0.5, { clockRateMinutesPerSec: 10 });
    return serializeWorldState(next);
  }
  const a = scenario();
  const b = scenario();
  check('two identical scenarios serialize byte-identically', a === b);
}

// --- 8. History cap on write via exported constant ---------------------------
{
  const w = friendlyNora(createFreshWorldState());
  const cap = INVITATION_HISTORY_CAP;
  for (let i = 0; i < cap + 3; i++) {
    w.invitations!.lastOfferDayByHost.nora = w.day - 2;
    offerInvitation(w, 'nora', 'share_featured_reading');
    declineInvitation(w);
    w.day += 2;
  }
  check(`history capped at ${cap} after ${cap + 3} terminal paths`,
    w.invitations!.history.length === cap);
  check('newest kept / oldest dropped',
    w.invitations!.history[w.invitations!.history.length - 1].day > w.invitations!.history[0].day);
}

// --- 9. Spacing survives decline (lastOfferDay not moved) --------------------
{
  const w = friendlyNora(createFreshWorldState());
  offerInvitation(w, 'nora', 'share_featured_reading');
  declineInvitation(w);
  const retry = offerInvitation(w, 'nora', 'share_featured_reading');
  check('re-offer same day after decline is rejected by spacing', retry.ok === false && retry.reason === 'host_spacing');
}

// --- 10. Liveness predicate edge: inclusive bounds + conjunctive day ---------
{
  const w = createFreshWorldState();
  const inv = {
    id: 'x', status: 'accepted' as const, hostId: 'nora' as const, activityId: 'share_featured_reading',
    offeredDay: w.day, expiresDay: w.day, windowStartMinute: 600, windowEndMinute: 780,
  };
  check('live at window start (inclusive)', isInvitationLive(inv, w.day, 600) === true);
  check('live at window end (inclusive)', isInvitationLive(inv, w.day, 780) === true);
  check('dead at window end + 1', isInvitationLive(inv, w.day, 781) === false);
  check('dead past expiresDay even inside window', isInvitationLive({ ...inv, expiresDay: w.day - 1 }, w.day, 700) === false);
  expireInvitationsAt(w, w.day, 781);
  check('expire no-ops without an active invite', w.invitations!.history.length === 0);
}

// --- 11. An offer is live at creation (survives the next tick) ---------------
{
  const w = friendlyNora(createFreshWorldState());
  w.minuteOfDay = 495; // before the canonical 600 window start
  const res = offerInvitation(w, 'nora', 'share_featured_reading');
  check('offer before the canonical window start succeeds', res.ok === true);
  check('created window includes the offer minute',
    res.invitation?.windowStartMinute === 495 && res.invitation?.windowEndMinute === 780);
  check('offer is live at creation', isInvitationLive(res.invitation ?? null, w.day, 495) === true);
  stepSimulationInPlace(w, 0.2, { clockRateMinutesPerSec: 10 });
  check('pending offer survives the next sim tick', w.invitations?.active?.id === res.invitation?.id);
}

// --- 12. Offers after the window has passed are rejected ----------------------
{
  const w = friendlyNora(createFreshWorldState());
  w.minuteOfDay = 900; // past the 780 window end
  const res = offerInvitation(w, 'nora', 'share_featured_reading');
  check('offer past the window end is rejected', res.ok === false && res.reason === 'host_unavailable');
}

console.log(failures === 0 ? '\nALL VERIFICATION CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
