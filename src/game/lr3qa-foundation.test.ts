/**
 * LR-3 Independent QA Campaign — foundation regression pins (Task 2-a/2-b/2-c/2-d evidence).
 *
 * QA-owned file: pins CURRENT chassis contracts that the LR-3 implementation
 * (share_morning_pastry, Clara quartet, F-ENTER-1 helper, bakery station guards)
 * must preserve. Every pin here was adversarially derived during the campaign
 * (see docs/architecture/lr3-qa/). Deliberately pins only design-stable contracts:
 * phase boundaries, the away-afternoon window cap, the completion refusal ladder,
 * single-slot occupancy semantics, day-advance reconciliation, and the pinned
 * bakery seat data (doc 07 D3). It does NOT assert LR-3 absence (the reservation
 * is expected to be filled by the implementation initiative).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { createFreshWorldState, advanceToNextDay } from './storage';
import { getTimePhase } from './time';
import { offerInvitation, acceptInvitation } from './invitations';
import { completeSharedActivity } from './activities';
import {
  setOccupant,
  clearOccupant,
  getOccupantAt,
  isStationOccupied,
} from './occupancy';
import { enterNookAction } from './actions';
import { BAKERY_SEAT_SPOTS } from './bakery';
import type { WorldState } from './types';

/** Mirror of activities.test.ts stageLiveNookReadingVisit (preconditions per LR1/LR2). */
function stageLiveNookReadingVisit(): WorldState {
  let world = createFreshWorldState();
  world = {
    ...world,
    minuteOfDay: 540, // morning — Nora schedule slot within INVITATION_HOME_RADIUS of homePos
    flags: { ...world.flags, foundPostcard: true },
    residents: {
      ...world.residents,
      nora: { ...world.residents.nora, met: true, trust: 3 },
    },
    playerRelations: {
      ...world.playerRelations,
      nora: {
        ...world.playerRelations.nora,
        affinity: 60,
        reliability: 40,
        dailyAffinityGained: 0,
        negativeCount: 0,
      },
    },
  };
  const offered = offerInvitation(world, 'nora', 'share_featured_reading');
  assert.equal(offered.ok, true, 'precondition offer succeeds');
  const accepted = acceptInvitation(offered.world);
  assert.equal(accepted.ok, true, 'precondition accept succeeds');
  return accepted.world;
}

test('QA-F-01: time phases hold the documented minute boundaries (360/689/690/959/960/1109/1110/1290)', () => {
  assert.equal(getTimePhase(360), 'morning');
  assert.equal(getTimePhase(689), 'morning');
  assert.equal(getTimePhase(690), 'afternoon');
  assert.equal(getTimePhase(959), 'afternoon');
  assert.equal(getTimePhase(960), 'golden');
  assert.equal(getTimePhase(1109), 'golden');
  assert.equal(getTimePhase(1110), 'dusk');
  assert.equal(getTimePhase(1290), 'dusk');
});

test('QA-F-02: away-afternoon rule caps the morning offer window at 719 (offer-time stamp)', () => {
  // offerInvitation computes the window from the CURRENT minute; the cap is the
  // away-afternoon rule (invitations.ts computeOfferWindow): afternoon target is
  // > INVITATION_HOME_RADIUS from homePos, so a morning window ends at 719.
  let world = createFreshWorldState();
  world = {
    ...world,
    minuteOfDay: 540,
    flags: { ...world.flags, foundPostcard: true },
    residents: { ...world.residents, nora: { ...world.residents.nora, met: true, trust: 3 } },
    playerRelations: {
      ...world.playerRelations,
      nora: { ...world.playerRelations.nora, affinity: 60, reliability: 40, dailyAffinityGained: 0, negativeCount: 0 },
    },
  };
  const offered = offerInvitation(world, 'nora', 'share_featured_reading');
  assert.equal(offered.ok, true, 'morning offer at minute 540 is eligible');
  const active = offered.world.invitations?.active ?? null;
  assert.ok(active, 'active invitation recorded');
  assert.equal(active?.windowStartMinute, 540, 'window starts at the offer minute');
  assert.equal(active?.windowEndMinute, 719, 'away-afternoon rule caps the window at 719');
  assert.equal(active?.offeredDay, offered.world.day, 'window never spans days');

  // A second offer — even cross-host — is refused while the global slot is held.
  const second = offerInvitation(offered.world, 'nora', 'share_featured_reading');
  assert.equal(second.ok, false, 'single global invitation slot rejects a second offer');
  assert.equal(second.reason, 'active_invitation_exists');
});

test('QA-F-03: completion refusal ladder — unknown activity and no accepted invitation', () => {
  const fresh = createFreshWorldState();
  const unknown = completeSharedActivity(fresh, 'definitely_not_an_activity');
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reason, 'unknown_activity');
  assert.equal(unknown.world, fresh, 'refusal returns the input world unchanged (referentially)');

  const noInvite = completeSharedActivity(fresh, 'share_featured_reading');
  assert.equal(noInvite.ok, false);
  assert.equal(noInvite.reason, 'no_matching_accepted_invitation');
  assert.equal(noInvite.world, fresh, 'refusal returns the input world unchanged (referentially)');
});

test('QA-F-04: completion transaction is pure and atomic — input world is never mutated', () => {
  const staged = stageLiveNookReadingVisit();
  const entered = enterNookAction(staged);
  assert.equal(entered.nextWorld.playerLocation, 'nook_interior', 'precondition interior entry succeeds');
  const live = entered.nextWorld;
  const before = JSON.stringify(live);

  const res = completeSharedActivity(live, 'share_featured_reading');
  assert.equal(res.ok, true, 'staged live visit completes');
  assert.equal(JSON.stringify(live), before, 'input world byte-identical after completion (pure)');

  const after = res.world;
  assert.equal(after.invitations?.active ?? null, null, 'completed invitation archived from the active slot');
  assert.equal(after.occupancy ?? null, null, 'occupancy released by the transaction');
  assert.equal(after.activeActivity ?? null, null, 'activeActivity cleared by the transaction');
  assert.equal(after.memories[0]?.id, 'mem_lr_nora_featured_reading', 'journal memory inserted at head');
});

test('QA-F-05: duplicate completion after commit refuses and grants nothing', () => {
  const staged = stageLiveNookReadingVisit();
  const entered = enterNookAction(staged);
  assert.equal(entered.nextWorld.playerLocation, 'nook_interior');
  const first = completeSharedActivity(entered.nextWorld, 'share_featured_reading');
  assert.equal(first.ok, true);
  const memoryCount = first.world.memories.length;

  // The active slot is empty after the commit, so the duplicate is refused.
  const second = completeSharedActivity(first.world, 'share_featured_reading');
  assert.equal(second.ok, false, 'duplicate completion is refused');
  assert.equal(second.reason, 'no_matching_accepted_invitation');
  assert.equal(second.world.memories.length, memoryCount, 'no duplicate journal memory');
});

test('QA-F-06: single global occupancy slot — last write wins, lookups are location-scoped', () => {
  let world = createFreshWorldState();
  world = setOccupant(world, {
    residentId: 'nora',
    location: 'nook_interior',
    stationId: 'nook_seat_armchair',
    localPos: { x: 0, z: 0 },
    facing: 0,
    invitationId: 'inv-test-1',
  });
  world = setOccupant(world, {
    residentId: 'clara',
    location: 'bakery_interior',
    stationId: 'bakery_seat_cafe_west',
    localPos: { x: 0.73, z: 1.45 },
    facing: 1.5708,
    invitationId: 'inv-test-2',
  });
  // Documented single-slot semantics: the second set replaces the first wholesale.
  assert.equal(world.occupancy?.residentId, 'clara');
  assert.ok(getOccupantAt(world, 'nook_interior') === null, 'previous occupant no longer resolvable at its location');
  assert.ok(getOccupantAt(world, 'bakery_interior') !== null, 'new occupant resolvable at its location');
  assert.equal(isStationOccupied(world, 'bakery_interior', 'bakery_seat_cafe_west'), true, 'station lookup scoped by location');
  assert.equal(isStationOccupied(world, 'nook_interior', 'nook_seat_armchair'), false, 'stale location/station pair reads false');
  assert.equal(isStationOccupied(world, 'bakery_interior', 'nook_chair'), false, 'wrong station at the occupied location reads false');

  // Location-guarded clear is a no-op for a mismatched interior.
  const wrongClear = clearOccupant(world, 'nook_interior');
  assert.equal(wrongClear.occupancy?.residentId, 'clara', 'mismatched-location clear does nothing');
  const rightClear = clearOccupant(world, 'bakery_interior');
  assert.equal(rightClear.occupancy ?? null, null, 'matching-location clear releases the slot');
});

test('QA-F-07: day-advance reconciles the living-relationship slice atomically (expired/day_end sweep)', () => {
  const staged = stageLiveNookReadingVisit();
  const entered = enterNookAction(staged);
  assert.equal(entered.nextWorld.playerLocation, 'nook_interior');
  const live = entered.nextWorld;
  assert.ok(live.occupancy, 'precondition: interior occupied');
  assert.ok(live.invitations?.active, 'precondition: invitation live');

  const next = advanceToNextDay(live);
  assert.equal(next.occupancy ?? null, null, 'occupancy cleared on day advance');
  assert.equal(next.activeActivity ?? null, null, 'activeActivity cleared on day advance');
  assert.equal(next.invitations?.active ?? null, null, 'live invitation force-archived on day advance');
  const history = next.invitations?.history ?? [];
  const top = history[history.length - 1];
  assert.ok(top, 'history row recorded');
  assert.equal(top?.outcome, 'expired');
  assert.equal(top?.reason, 'day_end');
});

test('QA-F-08: bakery seat data contract (doc 07 D3 anchor) — exactly one as-built record', () => {
  assert.equal(BAKERY_SEAT_SPOTS.length, 1, 'bakery ships exactly one registered seat');
  const seat = BAKERY_SEAT_SPOTS[0];
  assert.equal(seat.id, 'bakery_seat_cafe_west');
  assert.equal(seat.zoneId, 'bakery_interior');
  assert.equal(seat.indoor, true);
  assert.deepEqual(seat.seatPos, { x: 0.73, z: 1.45 });
  assert.deepEqual(seat.approachPos, { x: -0.2, z: 1.4 });
  assert.ok(Math.abs(seat.facingAngle - Math.PI / 2) < 1e-6, 'facing east across the table (atan2 east = π/2)');
  assert.equal(seat.seatHeight, 0.46);
});
