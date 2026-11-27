/**
 * LR-3 integration remediation battery — B-03 (oven-rest-day eligibility)
 * and B-08 (offer-window boundary pins).
 *
 * Findings of record (LR-3 integration adversarial review, Teams A/B/E):
 *  - B-03 (P2): Clara's "morning pastry" offer was eligible on Hearth & Crumb
 *    oven-rest days (`getBakeForDay(day).shareItemId === null`, every 4th
 *    day), so the offer text, the completion journal line, and the capability
 *    rows all advertised a pastry that did not exist. Fix: def-level
 *    `requiresShareableBake` gate in `canOfferInvitation`, mirroring the D10
 *    `offerPhases` pattern (field absence = untouched gates; Nora's
 *    eligibility stays byte-identical). The gate reuses the existing
 *    `host_unavailable` reason so no new player-legible label is introduced.
 *  - B-08 (P3): the morning/afternoon phase boundary (689/690) and the
 *    offer-window end boundary (live at 719, expired at 720) are pinned here.
 *
 * Run: npm test (tsx --test src/game/*.test.ts src/scene/*.test.ts)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreshWorldState } from './storage';
import {
  acceptInvitation,
  canOfferInvitation,
  isInvitationExpired,
  isInvitationLive,
  offerInvitation,
  reconcileInvitedInteriorEntry,
} from './invitations';
import { completeSharedActivity, getSharedActivityDef } from './activities';
import { setOccupant } from './occupancy';
import { getBakeForDay } from './bakery';
import { describeInvitationCapabilities } from './invitationFramework';
import type { WorldState } from './types';

const BAKE_DAY = 1; // (1-1) % 4 = 0 → sunflower sourdough (shareItemId herb_loaf)
const REST_DAY = 4; // (4-1) % 4 = 3 → oven_rest (shareItemId null)

/** Clara staged friendly with the as-built eligibility floor (affinity 40+). */
function stageClaraWorld(day: number, minuteOfDay = 495, affinity = 60): WorldState {
  const base = createFreshWorldState();
  return {
    ...base,
    day,
    minuteOfDay,
    residents: {
      ...base.residents,
      clara: { ...base.residents.clara, met: true },
    },
    playerRelations: {
      ...base.playerRelations,
      clara: {
        ...base.playerRelations.clara,
        affinity,
        reliability: 40,
        negativeCount: 0,
      },
    },
  };
}

test('REST-01 roster facts: day 1 bakes a shareable loaf, day 4 is the oven rest', () => {
  assert.equal(getBakeForDay(BAKE_DAY).shareItemId, 'herb_loaf');
  assert.equal(getBakeForDay(REST_DAY).id, 'oven_rest');
  assert.equal(getBakeForDay(REST_DAY).shareItemId, null);
});

test('REST-02 B-03: Clara is refused with host_unavailable on the oven-rest morning', () => {
  const world = stageClaraWorld(REST_DAY);
  const gate = canOfferInvitation(world, 'clara', 'share_morning_pastry');
  assert.equal(gate.eligible, false);
  assert.equal(gate.reason, 'host_unavailable');
  assert.equal(getSharedActivityDef('share_morning_pastry')?.requiresShareableBake, true);
});

test('REST-03 B-03: the same morning on a bake day stays eligible — the gate only bites on rest days', () => {
  const world = stageClaraWorld(BAKE_DAY);
  const gate = canOfferInvitation(world, 'clara', 'share_morning_pastry');
  assert.equal(gate.eligible, true, 'bake-day morning offer eligible');
  assert.equal(gate.reason, undefined);
});

test('REST-04 B-03: gate ordering — the D10 phase gate precedes the bake-roster gate', () => {
  // Golden hour (975) of a REST day must still report offer_phase_closed (the
  // phase gate fires first), not host_unavailable, per the D10 normative order.
  const world = stageClaraWorld(REST_DAY, 975);
  const gate = canOfferInvitation(world, 'clara', 'share_morning_pastry');
  assert.equal(gate.eligible, false);
  assert.equal(gate.reason, 'offer_phase_closed');
});

test('REST-05 B-03: capability rows stop advertising Clara on rest-day mornings', () => {
  const restWorld = stageClaraWorld(REST_DAY);
  const claraRow = describeInvitationCapabilities(restWorld, 'clara')[0];
  assert.ok(claraRow, 'Clara capability row exists');
  assert.equal(claraRow.activityId, 'share_morning_pastry');
  assert.equal(claraRow.eligibility.eligible, false);
  assert.equal(claraRow.eligibility.reason, 'host_unavailable');
});

test('REST-06 B-03: Nora byte-identity — field absence leaves her gates untouched', () => {
  const noraDef = getSharedActivityDef('share_featured_reading');
  assert.equal(noraDef?.requiresShareableBake, undefined, 'Nora carries no bake-roster field');
  // Clara's bake-day eligibility is untouched when all rows are derived.
  const world = stageClaraWorld(BAKE_DAY);
  const rows = describeInvitationCapabilities(world);
  const clara = rows.find((row) => row.activityId === 'share_morning_pastry');
  assert.equal(clara?.eligibility.eligible, true);
  // Nora's OWN eligibility is untouched on a rest-day morning (WSA-F1 pin:
  // the roster gate must never bite a def without the field).
  const noraBase = createFreshWorldState();
  const noraWorld: WorldState = {
    ...noraBase,
    day: REST_DAY,
    minuteOfDay: 495,
    flags: { ...noraBase.flags, foundPostcard: true },
    residents: { ...noraBase.residents, nora: { ...noraBase.residents.nora, met: true } },
    playerRelations: {
      ...noraBase.playerRelations,
      nora: { ...noraBase.playerRelations.nora, affinity: 60, reliability: 40, negativeCount: 0 },
    },
  };
  const noraGate = canOfferInvitation(noraWorld, 'nora', 'share_featured_reading');
  assert.equal(noraGate.eligible, true, 'Nora stays eligible on an oven-rest morning');
});

test('REST-07 B-08: phase boundary — minute 689 is morning-eligible, 690 refuses offer_phase_closed', () => {
  const at689 = canOfferInvitation(stageClaraWorld(BAKE_DAY, 689), 'clara', 'share_morning_pastry');
  assert.equal(at689.eligible, true, '689 is still morning');
  const at690 = canOfferInvitation(stageClaraWorld(BAKE_DAY, 690), 'clara', 'share_morning_pastry');
  assert.equal(at690.eligible, false);
  assert.equal(at690.reason, 'offer_phase_closed', '690 is afternoon — the D10 gate fires');
});

test('REST-08 B-08: window-end boundary — live at 719, expired at 720', () => {
  const world = stageClaraWorld(BAKE_DAY);
  const offered = offerInvitation(world, 'clara', 'share_morning_pastry');
  assert.equal(offered.ok, true, 'precondition: bake-day offer succeeds');
  const active = offered.world.invitations.active!;
  assert.equal(active.windowEndMinute, 719, 'away-afternoon morning cap (as-built)');
  assert.equal(isInvitationLive(active, world.day, 719), true, 'window end is inclusive');
  assert.equal(isInvitationExpired(active, world.day, 720), true, 'one minute past the window is expired');
});

/**
 * Hand-staged corrupt-save vector (B-03 completion-side, WSB-F1): a live
 * accepted pastry invite re-pinned onto an oven-rest day — unreachable via
 * every production writer, reachable via a hand-edited save.
 */
function stageRestDayAcceptedInvite(): WorldState {
  const bakeDayWorld = stageClaraWorld(BAKE_DAY);
  const offered = offerInvitation(bakeDayWorld, 'clara', 'share_morning_pastry');
  assert.equal(offered.ok, true, 'precondition: bake-day offer succeeds');
  const accepted = acceptInvitation(offered.world);
  assert.equal(accepted.ok, true, 'precondition: accept succeeds');
  const staged: WorldState = {
    ...accepted.world,
    day: REST_DAY,
    invitations: {
      ...accepted.world.invitations,
      active: {
        ...accepted.world.invitations.active!,
        offeredDay: REST_DAY,
        expiresDay: REST_DAY,
      },
    },
  };
  assert.equal(
    isInvitationLive(staged.invitations.active!, staged.day, staged.minuteOfDay),
    true,
    'precondition: the hand-staged invite is live on the rest day',
  );
  return staged;
}

test('REST-09 B-03 completion-side: a hand-staged rest-day invite is archived at entry — no phantom occupant', () => {
  const staged = stageRestDayAcceptedInvite();
  const entered = reconcileInvitedInteriorEntry(staged, 'bakery_interior');
  assert.equal(entered.occupantSet, false, 'no phantom Clara on a rest day');
  assert.equal(entered.arrivalToast, undefined, 'no “today’s bake” arrival line');
  assert.ok(entered.expiryToast, 'the roster-false invite is archived visibly');
  assert.equal(entered.world.invitations.active, null, 'invite is not left live');
});

test('REST-10 B-03 completion-side: a hand-staged rest-day session cannot complete — grants nothing, zero mutation', () => {
  const def = getSharedActivityDef('share_morning_pastry')!;
  const staged = stageRestDayAcceptedInvite();
  const session = {
    ...setOccupant(staged, {
      residentId: 'clara',
      location: 'bakery_interior',
      stationId: def.stationId,
      localPos: def.seatPos,
      facing: def.seatFacing,
      invitationId: staged.invitations.active!.id,
    }),
    playerLocation: 'bakery_interior',
    activeActivity: { activityId: def.id, invitationId: staged.invitations.active!.id },
  } as WorldState;
  const before = JSON.stringify(session);
  const result = completeSharedActivity(session, 'share_morning_pastry');
  assert.equal(result.ok, false, 'rest-day completion refused');
  assert.equal(result.reason, 'host_unavailable');
  assert.equal(result.toast, undefined, 'grants nothing');
  assert.equal(result.memoryUnlockedTitle, undefined);
  assert.equal(JSON.stringify(result.world), before, 'zero mutation — expiry cleans up');
});
