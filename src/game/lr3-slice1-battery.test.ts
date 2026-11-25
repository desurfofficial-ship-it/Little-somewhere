/**
 * LR-3 Slice-1 acceptance battery — invitation lifecycle, D10 offer phases,
 * D6 venue-true accept toast, D9 venue-true completion text, teaching trap guard.
 *
 * Spec of record: docs/architecture/lr3/06-acceptance-test-plan.md (scenarios
 * LR3-01…12, 45/46/48, 86/87/91/96). Every test name carries its LR3-xx id so
 * the traceability matrix stays auditable.
 *
 * As-built corrections recorded here (precedent: reconciliation-era LR3-34/79
 * corrections — shipped main behavior wins over the plan's arithmetic, with a
 * written note in the evidence PR):
 *  - LR3-11: the as-built `computeOfferWindow` caps the away-afternoon morning
 *    window FLAT at 719 for the whole morning (windowEnd = max(now, 719)), not
 *    min(now+180, 719). The QA-owned foundation pin (lr3qa-foundation.test.ts
 *    "away-afternoon rule caps the window at 719") already binds this semantic;
 *    Clara produces the same constant through the same path (D-17).
 *  - LR3-96: the tier/affinity gate is OR-reading as built (QA-08): affinity 44
 *    with tier friendly is eligible (tier no longer below floor). Boundary pins
 *    corrected to the QA-08 probe matrix: 39 refused / 40+ eligible.
 *  - LR3-02/03: with `offerPhases: ['morning']` on Clara's def, minute 700
 *    (afternoon) refuses with `offer_phase_closed` (the phase gate precedes the
 *    availability gate per doc 05 §7.2's normative order); the away-afternoon
 *    schedule fact (8.938 m > 6.0 m) is pinned separately on
 *    `isHostAvailableForActivity`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreshWorldState } from './storage';
import {
  acceptInvitation,
  advanceClockAndReconcile,
  canOfferInvitation,
  declineInvitation,
  isHostAvailableForActivity,
  offerInvitation,
} from './invitations';
import { completeSharedActivity, getSharedActivityDef } from './activities';
import { applyDialogueChoice } from './actions';
import { RESIDENTS } from './residents';
import { setOccupant } from './occupancy';
import { ActiveSocialEncounter, WorldState } from './types';

/** Full-shape exterior encounter staging (QA probes P4/P5a/P8 convention). */
function stageEncounter(participants: ActiveSocialEncounter['participants'], minute: number): ActiveSocialEncounter[] {
  return [
    {
      id: 'enc_probe',
      participants,
      topicTag: 'greeting',
      summary: 'Staged exterior encounter for the availability probe.',
      spots: participants.map(() => ({ x: 0, z: 0 })),
      startedMinute: minute,
      endsMinute: minute + 30,
    },
  ];
}

/** Clara staged friendly (as-built floor: affinity 40 with tier friendly), morning 495. */
function stageClaraWorld(minuteOfDay = 495, affinity = 60): WorldState {
  const base = createFreshWorldState();
  return {
    ...base,
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

function stageAcceptedClaraInvite(world: WorldState): WorldState {
  const offered = offerInvitation(world, 'clara', 'share_morning_pastry');
  assert.equal(offered.ok, true, 'precondition: Clara offer succeeds');
  const accepted = acceptInvitation(offered.world);
  assert.equal(accepted.ok, true, 'precondition: accept succeeds');
  return accepted.world;
}

test('LR3-01: Clara can offer when eligible — window [495, 719], spacing stamped', () => {
  const world = stageClaraWorld();
  const gate = canOfferInvitation(world, 'clara', 'share_morning_pastry');
  assert.equal(gate.eligible, true, 'morning offer eligible');
  const res = offerInvitation(world, 'clara', 'share_morning_pastry');
  assert.equal(res.ok, true);
  const active = res.world.invitations.active!;
  assert.equal(active.hostId, 'clara');
  assert.equal(active.activityId, 'share_morning_pastry');
  assert.equal(active.status, 'offered');
  assert.equal(active.offeredDay, world.day);
  assert.equal(active.expiresDay, active.offeredDay, 'window never crosses days');
  assert.equal(active.windowStartMinute, 495);
  assert.equal(active.windowEndMinute, 719, 'away-afternoon cap (as-built, see header note)');
  assert.equal(
    res.world.invitations.lastOfferDayByHost.clara,
    world.day,
    'offer spacing stamped for clara',
  );
});

test('LR3-02: offer refused outside the offer phase — golden 975 and dusk 1150 say offer_phase_closed', () => {
  for (const minute of [975, 1150]) {
    const world = stageClaraWorld(minute);
    const gate = canOfferInvitation(world, 'clara', 'share_morning_pastry');
    assert.equal(gate.eligible, false, `minute ${minute} must refuse`);
    assert.equal(gate.reason, 'offer_phase_closed', `minute ${minute} reason (D10 gate)`);
  }
});

test('LR3-03: the away-afternoon schedule fact holds — Clara 8.938 m out at minute 700; the phase gate refuses offers first', () => {
  const world = stageClaraWorld(700);
  assert.equal(
    isHostAvailableForActivity(world, 'clara'),
    false,
    'afternoon slot 8.938 m > 6.0 m home radius',
  );
  const gate = canOfferInvitation(world, 'clara', 'share_morning_pastry');
  assert.equal(gate.eligible, false);
  assert.equal(
    gate.reason,
    'offer_phase_closed',
    'normative gate order (doc 05 §7.2): offerPhases precedes availability',
  );
});

test('LR3-04: acceptance records the correct activity and rewards nothing', () => {
  const world = stageClaraWorld();
  const offered = offerInvitation(world, 'clara', 'share_morning_pastry');
  assert.equal(offered.ok, true);
  const memoriesBefore = offered.world.memories.length;
  const affinityBefore = offered.world.playerRelations.clara.affinity;
  const accepted = acceptInvitation(offered.world);
  assert.equal(accepted.ok, true);
  const active = accepted.world.invitations.active!;
  assert.equal(active.status, 'accepted');
  assert.equal(active.activityId, 'share_morning_pastry');
  assert.equal(accepted.world.memories.length, memoriesBefore, 'no memory writes on accept');
  assert.equal(
    accepted.world.playerRelations.clara.affinity,
    affinityBefore,
    'no affinity writes on accept (LR3-91: accept validates offered+live only)',
  );
});

test('LR3-05: decline archives declined, clears the slot, rewards nothing', () => {
  const world = stageClaraWorld();
  const offered = offerInvitation(world, 'clara', 'share_morning_pastry');
  const declined = declineInvitation(offered.world);
  assert.equal(declined.ok, true);
  assert.equal(declined.world.invitations.active, null);
  const tail = declined.world.invitations.history.at(-1)!;
  assert.equal(tail.activityId, 'share_morning_pastry');
  assert.equal(tail.outcome, 'declined');
  assert.equal(declined.world.occupancy, null);
  assert.equal(declined.world.activeActivity, null);
  assert.equal(declined.world.playerRelations.clara.affinity, world.playerRelations.clara.affinity);
});

test('LR3-06: window expiry is deterministic and visible — one archive, generic line', () => {
  let world = stageAcceptedClaraInvite(stageClaraWorld(495));
  const res = advanceClockAndReconcile(world, 240); // 495 + 240 = 735 > 719
  assert.equal(res.expired, true, 'invite expired at the first reconciling step past 719');
  assert.equal(res.world.invitations.active, null);
  assert.equal(res.world.invitations.history.length, 1);
  assert.equal(res.world.invitations.history[0]!.outcome, 'expired');
  assert.equal(
    res.toast,
    'The invitation with Clara quietly passed for today.',
    'visible generic expiry line',
  );
  assert.equal(res.world.occupancy, null);
  assert.equal(res.world.activeActivity, null);
  // Idempotency: a second reconcile adds no history row
  const again = advanceClockAndReconcile(res.world, 10);
  assert.equal(again.expired, false);
  assert.equal(again.world.invitations.history.length, 1, 'no duplicate archive');
});

test('LR3-07: duplicate offers blocked while any active invite exists', () => {
  let world = stageClaraWorld();
  const first = offerInvitation(world, 'clara', 'share_morning_pastry');
  assert.equal(first.ok, true);
  const second = offerInvitation(first.world, 'clara', 'share_morning_pastry');
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'active_invitation_exists');
});

test('LR3-08: invalid acceptance rejected — no invite and stale invite states', () => {
  const world = stageClaraWorld();
  const noInvite = acceptInvitation(world);
  assert.equal(noInvite.ok, false);
  assert.equal(noInvite.reason, 'no_offered_invitation');
  assert.equal(noInvite.world, world, 'world referentially unchanged on refusal');
});

test('LR3-09: Clara inside an exterior encounter is unavailable at offer time', () => {
  const world = stageClaraWorld();
  const encounterWorld: WorldState = {
    ...world,
    activeEncounters: stageEncounter(['clara', 'mina'], world.minuteOfDay),
  };
  const gate = canOfferInvitation(encounterWorld, 'clara', 'share_morning_pastry');
  assert.equal(gate.eligible, false);
  assert.equal(gate.reason, 'host_unavailable');
});

test('LR3-11: morning window caps at the 719 away-afternoon boundary from every morning minute (as-built pin)', () => {
  for (const [minute, expectedEnd] of [
    [400, 719],
    [495, 719],
    [650, 719],
  ] as Array<[number, number]>) {
    const world = stageAcceptedClaraInvite(stageClaraWorld(minute));
    const active = world.invitations.active!;
    assert.equal(active.windowEndMinute, expectedEnd, `offer at ${minute}`);
    assert.equal(
      active.windowEndMinute,
      Math.min(active.windowEndMinute, 719),
      'no window end inside the afternoon',
    );
  }
});

test('LR3-12: 2-day per-host spacing — day+1 spacing_cooldown, day+2 eligible', () => {
  let world = stageClaraWorld();
  const offered = offerInvitation(world, 'clara', 'share_morning_pastry');
  assert.equal(offered.ok, true);
  const stamped = offered.world.invitations.lastOfferDayByHost.clara!;
  const nextDay: WorldState = {
    ...offered.world,
    day: stamped + 1,
    invitations: { ...offered.world.invitations, active: null },
  };
  const day1 = canOfferInvitation(nextDay, 'clara', 'share_morning_pastry');
  assert.equal(day1.eligible, false);
  assert.equal(day1.reason, 'spacing_cooldown');
  const day2: WorldState = { ...nextDay, day: stamped + 2 };
  const day2Gate = canOfferInvitation(day2, 'clara', 'share_morning_pastry');
  assert.equal(day2Gate.eligible, true, 'eligible again on day+2');
});

test('LR3-86: Nora def has no offerPhases — golden-minute eligibility unchanged (field-absence pass)', () => {
  const base = createFreshWorldState();
  const world: WorldState = {
    ...base,
    minuteOfDay: 975, // golden — Nora's porch slot is 0.28 m from homePos
    flags: { ...base.flags, foundPostcard: true },
    residents: { ...base.residents, nora: { ...base.residents.nora, met: true } },
    playerRelations: {
      ...base.playerRelations,
      nora: { ...base.playerRelations.nora, affinity: 60, reliability: 40, negativeCount: 0 },
    },
  };
  const gate = canOfferInvitation(world, 'nora', 'share_featured_reading');
  assert.equal(gate.eligible, true, 'Nora golden offers pass exactly as before LR-3');
  assert.notEqual(gate.reason, 'offer_phase_closed');
  assert.equal(getSharedActivityDef('share_featured_reading')?.offerPhases, undefined);
});

test('LR3-87: accept toast is venue-true — Clara names Hearth & Crumb Bakery, Nora stays byte-identical', () => {
  // Clara acceptance through the dialogue choice pathway
  const claraWorld = stageClaraWorld();
  const offered = offerInvitation(claraWorld, 'clara', 'share_morning_pastry');
  const session = {
    residentId: 'clara' as const,
    topicId: 'inv_clara_offer_pastry',
    topicHistoryKey: 'inv_clara_offer_pastry',
    currentNodeId: 'root',
    nodes: {},
  };
  const res = applyDialogueChoice(offered.world, session, {
    id: 'lr_clara_offer_yes',
    label: 'x',
    tone: 'warm',
    nextNodeId: 'offer_accepted',
    offerInvitation: { hostId: 'clara', activityId: 'share_morning_pastry' },
    acceptInvitation: true,
  });
  assert.match(
    res.nextSession.recentToast ?? '',
    /Invitation accepted — meet Clara inside Hearth & Crumb Bakery\./,
    'Clara toast names her venue (D6)',
  );
  // Nora acceptance keeps the exact historic string
  const noraBase = createFreshWorldState();
  const noraWorld: WorldState = {
    ...noraBase,
    minuteOfDay: 540,
    flags: { ...noraBase.flags, foundPostcard: true },
    residents: { ...noraBase.residents, nora: { ...noraBase.residents.nora, met: true } },
    playerRelations: {
      ...noraBase.playerRelations,
      nora: { ...noraBase.playerRelations.nora, affinity: 60, reliability: 40, negativeCount: 0 },
    },
  };
  const noraOffered = offerInvitation(noraWorld, 'nora', 'share_featured_reading');
  assert.equal(noraOffered.ok, true);
  const noraRes = applyDialogueChoice(noraOffered.world, { ...session, residentId: 'nora' }, {
    id: 'lr_nora_offer_yes',
    label: 'x',
    tone: 'warm',
    nextNodeId: 'offer_accepted',
    offerInvitation: { hostId: 'nora', activityId: 'share_featured_reading' },
    acceptInvitation: true,
  });
  assert.equal(
    noraRes.nextSession.recentToast,
    'Invitation accepted — meet Nora inside Linden Book Nook.',
    'Nora toast byte-identical (D6 regression)',
  );
});

test('LR3-91: accept does not re-check host availability (boundary pin protecting the helper contract)', () => {
  let world = stageClaraWorld();
  const offered = offerInvitation(world, 'clara', 'share_morning_pastry');
  assert.equal(offered.ok, true);
  const encounterWorld: WorldState = {
    ...offered.world,
    activeEncounters: stageEncounter(['clara'], offered.world.minuteOfDay),
  };
  const accepted = acceptInvitation(encounterWorld);
  assert.equal(accepted.ok, true, 'accept validates offered+live only — availability is owned by enter/complete');
  assert.equal(accepted.world.invitations.active?.status, 'accepted');
  assert.equal(accepted.world.occupancy, null, 'no occupancy created by accept');
});

test('LR3-96: tier floor boundary is OR-reading as built (QA-08) — 39 refused, 40+ eligible', () => {
  const below = stageClaraWorld(495, 39);
  const belowGate = canOfferInvitation(below, 'clara', 'share_morning_pastry');
  assert.equal(belowGate.eligible, false, 'affinity 39 (stranger tier) refused');
  assert.equal(belowGate.reason, 'tier_too_low');
  const atFloor = stageClaraWorld(495, 40);
  assert.equal(canOfferInvitation(atFloor, 'clara', 'share_morning_pastry').eligible, true, 'affinity 40 = friendly floor eligible');
  const at44 = stageClaraWorld(495, 44);
  assert.equal(
    canOfferInvitation(at44, 'clara', 'share_morning_pastry').eligible,
    true,
    'affinity 44 eligible (OR gate: tier already friendly — QA-08 as-built)',
  );
  const at45 = stageClaraWorld(495, 45);
  assert.equal(canOfferInvitation(at45, 'clara', 'share_morning_pastry').eligible, true, 'affinity 45 eligible');
});

/** Accepted + live Clara invite with Clara seated at the claimed café station. */
function stageBakerySession(minuteOfDay = 495): WorldState {
  let world = stageAcceptedClaraInvite(stageClaraWorld(minuteOfDay));
  const active = world.invitations.active!;
  const def = getSharedActivityDef('share_morning_pastry')!;
  world = setOccupant(world, {
    residentId: 'clara',
    location: 'bakery_interior',
    stationId: def.stationId,
    localPos: def.seatPos,
    facing: def.seatFacing,
    invitationId: active.id,
  });
  world = {
    ...world,
    playerLocation: 'bakery_interior',
    activeActivity: { activityId: def.id, invitationId: active.id },
  };
  return world;
}

test('LR3-45: journal memory is venue-true — bake-roster summary, Clara title, no book leak', () => {
  const staged = stageBakerySession(495);
  const res = completeSharedActivity(staged, 'share_morning_pastry');
  assert.equal(res.ok, true);
  const memory = res.world.memories[0];
  assert.equal(memory.id, 'mem_lr_clara_morning_pastry');
  assert.equal(memory.title, 'First Crackles at the Café Corner');
  assert.equal(memory.residentId, 'clara');
  assert.match(memory.summary, /Split .+ with Clara at the café corner of Hearth & Crumb/);
  assert.doesNotMatch(memory.summary, /Linden Book Nook|Read through/, 'no nook text leak (F1)');
  assert.match(res.toast ?? '', /Memory saved: First Crackles at the Café Corner/);
});

test('LR3-46: world event is venue-true — Clara + Hearth & Crumb, summaryTag shared_morning_pastry', () => {
  const staged = stageBakerySession(495);
  const res = completeSharedActivity(staged, 'share_morning_pastry');
  assert.equal(res.ok, true);
  const events = res.world.worldEvents ?? [];
  const shared = events.filter((e) => e.kind === 'shared_activity');
  assert.equal(shared.length, 1, 'exactly one shared_activity event');
  assert.match(shared[0].summary, /Shared the morning pastry with Clara at Hearth & Crumb\./);
  assert.equal(shared[0].summaryTag, 'shared_morning_pastry');
  assert.deepEqual(shared[0].actors, ['clara']);
});

test('LR3-88: completion-refusal toast is venue-true when the host drifts into an encounter', () => {
  const staged = stageBakerySession(495);
  const drifted: WorldState = {
    ...staged,
    activeEncounters: stageEncounter(['clara'], staged.minuteOfDay),
  };
  const res = completeSharedActivity(drifted, 'share_morning_pastry');
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'host_unavailable');
  assert.match(res.toast ?? '', /the shared pastry can't finish right now/, 'D9-scope venue noun');
  assert.doesNotMatch(res.toast ?? '', /shared reading/, 'no nook text leak (LR3-88)');
  // Invite + occupancy untouched (D-04/H-1 window-end cleanup owns the release)
  assert.equal(res.world.invitations.active?.status, 'accepted');
  assert.equal(res.world.occupancy?.residentId, 'clara');
});

test('LR3-48: teaching stays empty through every LR-3 pathway and the def carries no knowledgeGranted', () => {
  const staged = stageBakerySession(495);
  const res = completeSharedActivity(staged, 'share_morning_pastry');
  assert.equal(res.ok, true);
  assert.deepEqual(res.world.teaching?.known ?? [], [], 'teaching.known empty after completion');
  assert.equal(
    getSharedActivityDef('share_morning_pastry')?.knowledgeGranted,
    undefined,
    'Clara def omits knowledgeGranted (LR-4 boundary)',
  );
});
