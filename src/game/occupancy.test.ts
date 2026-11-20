/**
 * LR-1 acceptance test — load invariant (doc 16 §3 LR1-15; doc 14 §4.3).
 *
 * Spec of record: docs/architecture/living-relationships/14-revised-architecture.md
 * Test plan:      docs/architecture/living-relationships/16-lr1-lr2-acceptance-test-plan.md
 *
 * Scope of this change (LR-1 test authoring only):
 *  - This file hosts the LR-1 load-invariant case assigned here by doc 16 §5. The
 *    LR-2 occupancy cases (LR2-01 – LR2-04b, LR2-15, LR2-16) are out of scope for
 *    this change and are intentionally NOT implemented here.
 *  - The case exercises ONLY the existing production load path
 *    (deserializeWorldState → migrateWorldState → sanitizeWorldState). No proposed
 *    helper is called, and no production code is implemented in this change.
 *  - The proposed occupancy/invitations slices (doc 14 §4.1, doc 16 §0.1) are staged
 *    through raw save payloads; no WorldState schema or migration code is modified.
 *
 * Why Step A exists (failure attribution): sanitizeWorldState today silently drops
 * every unknown field, so the negative case alone ("inconsistent occupancy is
 * cleared") would pass trivially before production implements the invariant — the
 * occupant would be "cleared" for the wrong reason. Step A therefore first requires
 * the sanitizer to PRESERVE a consistent (location, occupant, live invite) triple —
 * the same observable doc 16 LR2-15 checks — so that LR1-15 fails for the expected
 * missing LR-1 production behavior instead of passing vacuously. Once production
 * lands, both steps run and the invariant is discriminated properly.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreshWorldState, deserializeWorldState } from './storage';
import { advanceClockAndReconcile, acceptInvitation, offerInvitation } from './invitations';
import { enterNookAction, exitNookAction } from './actions';
import { NOOK_CHAIR_STATION_ID } from './occupancy';
import { NOOK_PORCH_EXIT_POS } from './bookNook';
import { stepSimulationInPlace } from './simulation';

const LR_INVITE_ID = 'lr_test_invite_1';
const LR_ACTIVITY_ID = 'share_featured_reading';

/** Tolerant to the plausible doc 14 §4.1 container shapes (null, single record,
 *  { occupant }, or a list) — the doc-16 observable is "no occupant record". */
function occupancyIsEmpty(occupancy: unknown): boolean {
  if (occupancy === null || occupancy === undefined) return true;
  if (Array.isArray(occupancy)) return occupancy.length === 0;
  if (typeof occupancy === 'object') {
    const o = occupancy as Record<string, unknown>;
    if ('occupant' in o) return o.occupant === null || o.occupant === undefined;
    return o.residentId === null || o.residentId === undefined;
  }
  return false;
}

function occupancyIsPresent(occupancy: unknown): boolean {
  return !occupancyIsEmpty(occupancy);
}

test('LR1-15: load clears occupancy inconsistent with playerLocation (doc 14 §4.3)', () => {
  const base = createFreshWorldState();
  const day = base.day;
  const liveAccepted = {
    id: LR_INVITE_ID,
    status: 'accepted',
    hostId: 'nora',
    activityId: LR_ACTIVITY_ID,
    offeredDay: day,
    expiresDay: day,
    windowStartMinute: 600,
    windowEndMinute: 780,
  };
  const occupant = {
    residentId: 'nora',
    location: 'nook_interior',
    stationId: 'nook_chair',
    localPos: { x: -10.8, z: -0.6 },
    facing: 0,
    invitationId: LR_INVITE_ID,
  };

  // Step A — discriminating gate: the sanitizer must PRESERVE the consistent triple
  // (playerLocation, occupant, live accepted invite). Fails today with the expected
  // missing-production report; see the file header for the rationale.
  const consistent = deserializeWorldState(
    JSON.stringify({
      ...base,
      minuteOfDay: 700, // inside [600, 780]
      playerLocation: 'nook_interior',
      invitations: { active: liveAccepted, history: [], lastOfferDayByHost: { nora: day } },
      occupancy: occupant,
    }),
  );
  const restored = (consistent.state as unknown as { occupancy?: unknown }).occupancy;
  assert.ok(
    occupancyIsPresent(restored),
    'MISSING LR-1 PRODUCTION: the load sanitizer drops the proposed occupancy slice ' +
      'entirely (doc 14 §4.3 load invariant not implemented), so LR1-15 fails by design ' +
      'until the invariant lands — a consistent occupant must survive load first',
  );
  const restoredRecord = restored as { residentId?: string; invitationId?: string };
  assert.equal(restoredRecord.residentId, 'nora', 'occupant resident restored');
  assert.equal(restoredRecord.invitationId, LR_INVITE_ID, 'occupant invite link restored');

  // Step B — the case itself: occupancy set for nook_interior while playerLocation is
  // 'exterior' → the invariant must clear the occupant without throwing.
  const inconsistent = deserializeWorldState(
    JSON.stringify({
      ...base,
      minuteOfDay: 700,
      playerLocation: 'exterior',
      invitations: { active: liveAccepted, history: [], lastOfferDayByHost: { nora: day } },
      occupancy: occupant,
    }),
  );
  const cleared = (inconsistent.state as unknown as { occupancy?: unknown }).occupancy;
  assert.ok(occupancyIsEmpty(cleared), 'no occupant while the player is outside (doc 16 LR1-15)');
  // Rest of world intact apart from the invariant:
  assert.equal(inconsistent.state.day, base.day, 'day intact');
  assert.ok(inconsistent.state.nookState, 'nook slice intact');
  assert.equal(
    inconsistent.state.playerRelations.nora.affinity,
    base.playerRelations.nora.affinity,
    'relations intact',
  );
});

function stageFriendlyMorningWorld() {
  const base = createFreshWorldState();
  return {
    ...base,
    minuteOfDay: 540, // morning — Nora near Linden Book Nook
    playerPos: { ...NOOK_PORCH_EXIT_POS },
    residents: {
      ...base.residents,
      nora: { ...base.residents.nora, met: true, trust: 3 },
    },
    playerRelations: {
      ...base.playerRelations,
      nora: { ...base.playerRelations.nora, affinity: 60, reliability: 30, negativeCount: 0 },
    },
  };
}

test('LR2-01: entering Nook during a live accepted invite places Nora seated at nook_chair; offered-only does not', () => {
  const base = stageFriendlyMorningWorld();
  const offered = offerInvitation(base, 'nora', 'share_featured_reading');
  assert.equal(offered.ok, true);

  // Offered (not accepted) must NOT place Nora inside
  const enterWhileOffered = enterNookAction(offered.world);
  assert.equal(enterWhileOffered.nextWorld.playerLocation, 'nook_interior');
  assert.equal(enterWhileOffered.nextWorld.occupancy, null, 'offered invite never spawns indoor host');

  const accepted = acceptInvitation(offered.world);
  assert.equal(accepted.ok, true);
  const enterWhileAccepted = enterNookAction(accepted.world);
  assert.equal(enterWhileAccepted.nextWorld.playerLocation, 'nook_interior');
  assert.ok(enterWhileAccepted.nextWorld.occupancy, 'occupant created on enter');
  assert.equal(enterWhileAccepted.nextWorld.occupancy.residentId, 'nora');
  assert.equal(enterWhileAccepted.nextWorld.occupancy.location, 'nook_interior');
  assert.equal(enterWhileAccepted.nextWorld.occupancy.stationId, NOOK_CHAIR_STATION_ID);
  assert.equal(
    enterWhileAccepted.nextWorld.occupancy.invitationId,
    accepted.world.invitations.active?.id,
  );
  assert.equal(enterWhileAccepted.nextWorld.activeActivity?.activityId, 'share_featured_reading');
});

test('LR2-02: entering Nook after invitation window passes leaves room empty and archives invite expired', () => {
  const base = stageFriendlyMorningWorld();
  const offered = offerInvitation(base, 'nora', 'share_featured_reading');
  const accepted = acceptInvitation(offered.world);
  const expiredTimeWorld = {
    ...accepted.world,
    minuteOfDay: (accepted.world.invitations.active?.windowEndMinute ?? 719) + 15,
  };

  const entered = enterNookAction(expiredTimeWorld);
  assert.equal(entered.nextWorld.playerLocation, 'nook_interior', 'door still opens normally');
  assert.equal(entered.nextWorld.occupancy, null, 'no occupant after expiry');
  assert.equal(entered.nextWorld.invitations.active, null, 'stale accepted invite archived');
  assert.ok(entered.nextWorld.invitations.history.some((h) => h.outcome === 'expired'));
});

test('LR2-03: entering Nook when Nora is unavailable expires invite with host_unavailable and visible toast', () => {
  const base = stageFriendlyMorningWorld();
  const offered = offerInvitation(base, 'nora', 'share_featured_reading');
  const accepted = acceptInvitation(offered.world);
  const memBefore = accepted.world.memories.length;
  const affBefore = accepted.world.playerRelations.nora.affinity;

  // Stage Nora inside an exterior social encounter so host availability fails
  const busyWorld = {
    ...accepted.world,
    activeEncounters: [
      {
        id: 'enc_nora_busy',
        participants: ['nora' as const, 'clara' as const],
        topicTag: 'book_chat',
        summary: 'Nora & Clara: Morning books',
        spots: [{ x: 0, z: 0 }, { x: 1, z: 0 }],
        startedMinute: 540,
        endsMinute: 560,
      },
    ],
  };

  const entered = enterNookAction(busyWorld);
  assert.equal(entered.nextWorld.playerLocation, 'nook_interior');
  assert.equal(entered.nextWorld.occupancy, null, 'no silent/fake occupant');
  assert.equal(entered.nextWorld.invitations.active, null, 'invite expired cleanly');
  const lastHist = entered.nextWorld.invitations.history.at(-1);
  assert.equal(lastHist?.outcome, 'expired');
  assert.equal(lastHist?.reason, 'host_unavailable');
  assert.ok(entered.toast.includes('Nora'), 'player-visible explanation shown in toast');
  assert.equal(entered.nextWorld.memories.length, memBefore);
  assert.equal(entered.nextWorld.playerRelations.nora.affinity, affBefore);
});

test('LR2-04: exiting Nook clears occupancy while keeping accepted live invitation alive', () => {
  const base = stageFriendlyMorningWorld();
  const offered = offerInvitation(base, 'nora', 'share_featured_reading');
  const accepted = acceptInvitation(offered.world);
  const inside = enterNookAction(accepted.world).nextWorld;
  assert.ok(inside.occupancy);

  const outside = exitNookAction(inside).nextWorld;
  assert.equal(outside.playerLocation, 'exterior');
  assert.equal(outside.occupancy, null, 'occupancy cleared on exit');
  assert.equal(outside.activeActivity, null);
  assert.equal(outside.invitations.active?.status, 'accepted', 'invite remains accepted for re-entry');

  const reEntered = enterNookAction(outside).nextWorld;
  assert.equal(reEntered.occupancy?.residentId, 'nora', 're-entering while live restores host');
});

test('LR2-04b: entering before window opens then advancing clock does not spawn Nora retroactively', () => {
  const base = stageFriendlyMorningWorld();
  const offered = offerInvitation(base, 'nora', 'share_featured_reading');
  const accepted = acceptInvitation(offered.world);
  const active = accepted.world.invitations.active!;
  const futureWindowWorld = {
    ...accepted.world,
    minuteOfDay: 500,
    invitations: {
      ...accepted.world.invitations,
      active: {
        ...active,
        windowStartMinute: 560,
        windowEndMinute: 700,
      },
    },
  };

  const insideEarly = enterNookAction(futureWindowWorld).nextWorld;
  assert.equal(insideEarly.playerLocation, 'nook_interior');
  assert.equal(insideEarly.occupancy, null, 'no occupant before window opens');

  // Advance clock across window start via +2h path AND sim tick — still no retroactive spawn
  const advanced = advanceClockAndReconcile(insideEarly, 80).world; // 500 -> 580
  stepSimulationInPlace(advanced, 0.2, { clockRateMinutesPerSec: 10 });
  assert.equal(advanced.occupancy, null, 'never spawns Nora retroactively while player stays inside');

  // Exit and re-enter inside the open window -> Nora now sits inside
  const exited = exitNookAction(advanced).nextWorld;
  const reEntered = enterNookAction(exited).nextWorld;
  assert.equal(reEntered.occupancy?.residentId, 'nora', 'fresh entry during open window spawns Nora');
});

test('LR2-15 & LR2-16: load restores valid mid-visit triple and clears non-live occupant cleanly', () => {
  const base = stageFriendlyMorningWorld();
  const offered = offerInvitation(base, 'nora', 'share_featured_reading');
  const accepted = acceptInvitation(offered.world);
  const inside = enterNookAction(accepted.world).nextWorld;

  // LR2-15: live mid-visit round-trip
  const liveLoaded = deserializeWorldState(JSON.stringify(inside));
  assert.equal(liveLoaded.state.playerLocation, 'nook_interior');
  assert.equal(liveLoaded.state.invitations.active?.status, 'accepted');
  assert.equal(liveLoaded.state.occupancy?.residentId, 'nora');
  assert.equal(
    liveLoaded.state.occupancy?.invitationId,
    liveLoaded.state.invitations.active?.id,
  );

  // LR2-16: window passed -> load clears occupant without teleporting player out of room
  const deadWindowSave = {
    ...inside,
    minuteOfDay: (inside.invitations.active?.windowEndMinute ?? 719) + 30,
  };
  const deadLoaded = deserializeWorldState(JSON.stringify(deadWindowSave));
  assert.equal(deadLoaded.state.playerLocation, 'nook_interior', 'player not teleported on load');
  assert.equal(deadLoaded.state.occupancy, null, 'expired visit occupancy cleared on load');
  assert.equal(deadLoaded.state.invitations.active, null, 'expired visit invite cleared on load');
});

