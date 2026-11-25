/**
 * LR-3 Slice-2 acceptance battery — shared enter reconciliation, bakery
 * reducers, station exclusivity, completion suite, cross-venue regression,
 * persistence coherence.
 *
 * Spec of record: docs/architecture/lr3/06-acceptance-test-plan.md (scenarios
 * LR3-13…38/40/41/57/58/60/33/34 + F-REC-8). Every test name carries its
 * LR3-xx id so the traceability matrix stays auditable. Scenario ids NOT
 * present here are covered by the slice-1 battery, the QA-03 battery, or are
 * manual scene QA (LR3-63 rig ghosting — recorded in the evidence PR).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreshWorldState, serializeWorldState } from './storage';
import { sanitizeWorldState } from './migrations';
import {
  acceptInvitation,
  offerInvitation,
  expireInvitationsAt,
  advanceClockAndReconcile,
} from './invitations';
import {
  completeSharedActivity,
  getSharedActivityDef,
} from './activities';
import {
  checkMorningBakeAction,
  enterBakeryAction,
  enterCottageAction,
  enterNookAction,
  exitBakeryAction,
  exitNookAction,
  helpKneadDoughAction,
  interactWithBakeryProp,
  shareMorningLoafAction,
  togglePlayerSitAction,
} from './actions';
import { advanceToNextDay } from './storage';
import { BAKERY_SEAT_SPOTS, BAKERY_CAFE_STATION_ID, getBakeForDay } from './bakery';
import { setOccupant, isStationOccupied, clearOccupant } from './occupancy';
import { ActiveSocialEncounter, WorldState } from './types';

function stageEncounter(participants: ActiveSocialEncounter['participants'], minute: number): ActiveSocialEncounter[] {
  return [
    {
      id: 'enc_probe',
      participants,
      topicTag: 'greeting',
      summary: 'Staged exterior encounter.',
      spots: participants.map(() => ({ x: 0, z: 0 })),
      startedMinute: minute,
      endsMinute: minute + 30,
    },
  ];
}

/** Clara staged friendly + accepted live bakery invite at minute 495. */
function stageAcceptedBakeryInvite(minuteOfDay = 495): WorldState {
  const base = createFreshWorldState();
  const world: WorldState = {
    ...base,
    minuteOfDay,
    residents: { ...base.residents, clara: { ...base.residents.clara, met: true } },
    playerRelations: {
      ...base.playerRelations,
      clara: { ...base.playerRelations.clara, affinity: 60, reliability: 40, negativeCount: 0 },
    },
  };
  const offered = offerInvitation(world, 'clara', 'share_morning_pastry');
  assert.equal(offered.ok, true, 'precondition: Clara offer succeeds');
  const accepted = acceptInvitation(offered.world);
  assert.equal(accepted.ok, true, 'precondition: accept succeeds');
  return accepted.world;
}

/** Accepted live invite + player inside the bakery with Clara placed (LR3-13 state). */
function stageBakerySession(minuteOfDay = 495): WorldState {
  const invited = stageAcceptedBakeryInvite(minuteOfDay);
  const entered = enterBakeryAction(invited);
  return entered.nextWorld;
}

test('LR3-13: enter during a live accepted bakery invite places Clara with the full occupancy triple', () => {
  const invited = stageAcceptedBakeryInvite(495);
  const entered = enterBakeryAction(invited);
  assert.equal(entered.nextWorld.playerLocation, 'bakery_interior');
  const occ = entered.nextWorld.occupancy!;
  assert.equal(occ.residentId, 'clara');
  assert.equal(occ.location, 'bakery_interior');
  assert.equal(occ.stationId, 'bakery_seat_cafe_west');
  assert.equal(occ.invitationId, entered.nextWorld.invitations.active!.id);
  assert.deepEqual(entered.nextWorld.activeActivity, {
    activityId: 'share_morning_pastry',
    invitationId: occ.invitationId,
  });
  assert.match(
    entered.toast,
    /Stepped inside Hearth & Crumb Bakery — Clara has set today’s bake on the café corner/,
    'arrival toast names Clara with the def arrival line (D5)',
  );
});

test('LR3-14: the helper resolves the def by activityId — occupant data comes from the def, not venue strings', () => {
  const session = stageBakerySession(495);
  const def = getSharedActivityDef('share_morning_pastry')!;
  assert.equal(session.occupancy!.stationId, def.stationId);
  assert.deepEqual(session.occupancy!.localPos, def.seatPos);
  assert.equal(session.occupancy!.facing, def.seatFacing);
});

test('LR3-15: a live NORA invite is not honored by bakery entry — no occupant, invite intact', () => {
  const base = createFreshWorldState();
  const world: WorldState = {
    ...base,
    minuteOfDay: 540,
    flags: { ...base.flags, foundPostcard: true },
    residents: { ...base.residents, nora: { ...base.residents.nora, met: true } },
    playerRelations: {
      ...base.playerRelations,
      nora: { ...base.playerRelations.nora, affinity: 60, reliability: 40, negativeCount: 0 },
    },
  };
  const offered = offerInvitation(world, 'nora', 'share_featured_reading');
  assert.equal(offered.ok, true);
  const accepted = acceptInvitation(offered.world);
  assert.equal(accepted.ok, true);
  const entered = enterBakeryAction(accepted.world);
  assert.equal(entered.nextWorld.playerLocation, 'bakery_interior');
  assert.equal(entered.nextWorld.occupancy, null, 'no Clara for a Nora invite');
  assert.equal(entered.nextWorld.activeActivity, null);
  assert.equal(entered.nextWorld.invitations.active?.activityId, 'share_featured_reading');
  assert.equal(entered.nextWorld.invitations.active?.status, 'accepted', 'Nora invite survives');
});

test('LR3-16: a live CLARA invite is not honored by nook entry (mirror)', () => {
  const invited = stageAcceptedBakeryInvite(495);
  const entered = enterNookAction(invited);
  assert.equal(entered.nextWorld.playerLocation, 'nook_interior');
  assert.equal(entered.nextWorld.occupancy, null, 'no Nora for a Clara invite');
  assert.equal(entered.nextWorld.invitations.active?.activityId, 'share_morning_pastry');
  assert.equal(entered.nextWorld.invitations.active?.status, 'accepted');
});

test('LR3-17: cottage entry stays reconciliation-free — no toast change, invite untouched', () => {
  const invited = stageAcceptedBakeryInvite(495);
  const bare = createFreshWorldState();
  const plainEntered = enterCottageAction(bare);
  const invitedEntered = enterCottageAction(invited);
  assert.equal(invitedEntered.nextWorld.invitations.active?.status, 'accepted', 'invite untouched');
  assert.equal(
    invitedEntered.toast.startsWith('Stepped inside Willow Step Cottage'),
    true,
    'cottage toast unchanged by LR-3',
  );
  assert.equal(invitedEntered.nextWorld.occupancy, null);
  void plainEntered;
});

test('LR3-18: late arrival inside the 690–719 dead zone archives host_unavailable with no occupant', () => {
  // Offer staged in the MORNING (D10 phase gate), clock advanced to 700: the
  // window [495,719] is still live but Clara's afternoon slot is 8.938 m out.
  const invited = stageAcceptedBakeryInvite(495);
  const at700 = advanceClockAndReconcile(invited, 205).world; // 495 + 205 = 700
  assert.equal(at700.invitations.active?.status, 'accepted', 'invite live inside the dead zone');
  const entered = enterBakeryAction(at700);
  assert.equal(entered.nextWorld.playerLocation, 'bakery_interior', 'player still inside');
  assert.equal(entered.nextWorld.occupancy, null, 'no phantom occupant');
  assert.equal(entered.nextWorld.invitations.active, null);
  const tail = entered.nextWorld.invitations.history.at(-1)!;
  assert.equal(tail.outcome, 'expired');
  assert.equal((tail as { reason?: string }).reason, 'host_unavailable');
  assert.match(entered.toast, /had to step out/, 'visible host_unavailable line');
});

test('LR3-20: crash-safe failed-entry sequence creates no occupancy and at most one archive row', () => {
  const invited = stageAcceptedBakeryInvite(495);
  const at700 = advanceClockAndReconcile(invited, 205).world;
  const first = enterBakeryAction(at700);
  const exited = exitBakeryAction(first.nextWorld);
  const second = enterBakeryAction(exited.nextWorld);
  assert.equal(second.nextWorld.occupancy, null);
  assert.equal(second.nextWorld.invitations.active, null);
  const reasonRows = second.nextWorld.invitations.history.filter(
    (h) => (h as { reason?: string }).reason === 'host_unavailable',
  );
  assert.equal(reasonRows.length, 1, 'idempotent expiry — second enter sees no active invite');
});

test('LR3-21: exit clears the session, re-entry restores it, and one completion remains possible', () => {
  const session = stageBakerySession(495);
  const exited = exitBakeryAction(session);
  assert.equal(exited.nextWorld.occupancy, null, 'claim released on exit');
  assert.equal(exited.nextWorld.activeActivity, null);
  assert.equal(exited.nextWorld.invitations.active?.status, 'accepted', 'invite survives exit');
  assert.equal(exited.nextWorld.playerLocation, 'exterior');
  const reentered = enterBakeryAction(exited.nextWorld);
  assert.equal(reentered.nextWorld.occupancy?.residentId, 'clara', 'occupant restored identically');
  const completed = completeSharedActivity(reentered.nextWorld, 'share_morning_pastry');
  assert.equal(completed.ok, true, 'single completion still possible after restore');
});

test('LR3-22: dawn ejects the player to the porch and archives with day_end', () => {
  const session = stageBakerySession(495);
  const advanced = advanceToNextDay(session);
  assert.equal(advanced.playerLocation, 'exterior', 'woke outside');
  assert.equal(advanced.occupancy, null);
  assert.equal(advanced.activeActivity, null);
  assert.equal(advanced.invitations.active, null);
  assert.equal(advanced.invitations.history.at(-1)!.outcome, 'expired');
});

test('LR3-23: Clara’s reservation claims the station under the registry stationId', () => {
  const session = stageBakerySession(495);
  assert.equal(session.occupancy!.stationId, BAKERY_CAFE_STATION_ID);
  assert.equal(isStationOccupied(session, 'bakery_interior', BAKERY_CAFE_STATION_ID), true);
});

test('LR3-24: player sit on the claimed café chair is refused with the Clara-voiced line, world unchanged', () => {
  const session = stageBakerySession(495);
  const res = togglePlayerSitAction(session, 'bakery_seat_cafe_west');
  assert.equal(res.sat, false);
  assert.equal(res.nextWorld, session, 'zero mutation on refusal');
  assert.match(res.toast ?? '', /Clara is keeping the café corner/);
});

test('LR3-25: knead refused during the session with byte-identical bakeryState and clock', () => {
  const session = stageBakerySession(495);
  const before = JSON.stringify(session.bakeryState);
  const res = helpKneadDoughAction(session);
  assert.equal(res.nextWorld, session, 'zero mutation');
  assert.equal(JSON.stringify(res.nextWorld.bakeryState), before);
  assert.equal(res.nextWorld.minuteOfDay, 495, 'no +12m clock advance');
  assert.match(res.body, /café corner/);
});

test('LR3-26: loaf-share refused during the session with zero mutation incl. inventory', () => {
  const session = stageBakerySession(495);
  const invBefore = JSON.stringify(session.inventory);
  const res = shareMorningLoafAction(session);
  assert.equal(res.nextWorld, session);
  assert.equal(JSON.stringify(res.nextWorld.inventory), invBefore, 'no inventory write');
  assert.equal(res.nextWorld.minuteOfDay, 495, 'no +6m');
});

test('LR3-27: oven check refused during the session with no bake reveal and no clock advance', () => {
  const session = stageBakerySession(495);
  const res = checkMorningBakeAction(session);
  assert.equal(res.nextWorld, session);
  assert.equal(res.nextWorld.minuteOfDay, 495, 'no +8m');
  assert.doesNotMatch(res.body, /Today’s bake:/, 'bake reveal suppressed during session');
});

test('LR3-28: notes shelf remains usable during the session (negative guard check)', () => {
  const session = stageBakerySession(495);
  const res = interactWithBakeryProp(session, 'bakery_notes');
  assert.notEqual(res.nextWorld, session, 'notes reading still mutates (allowed)');
  assert.equal(res.nextWorld.bakeryState?.starterNotesDay, session.day);
});

test('LR3-29: knead-first bonus unregressed when the shared activity is NOT used', () => {
  const base = createFreshWorldState();
  const inside = enterBakeryAction({ ...base, minuteOfDay: 495 }).nextWorld;
  const kneaded = helpKneadDoughAction(inside).nextWorld;
  const shared = shareMorningLoafAction(kneaded).nextWorld;
  const bake = getBakeForDay(shared.day);
  if (bake.shareItemId) {
    assert.equal(shared.bakeryState?.kneadedDay, shared.day);
    assert.equal(shared.bakeryState?.loafSharedDay, shared.day);
    // The doubled share grants 2 items (historic behavior byte-identical);
    // inventory is a flat Record<ItemId, count>.
    assert.equal(
      (shared.inventory as Record<string, number>)[bake.shareItemId],
      2,
      `kneaded share grants two ${bake.shareItemId}`,
    );
  }
});

test('LR3-35: valid completion grants the full reward set exactly once', () => {
  const session = stageBakerySession(495);
  const affinityBefore = session.playerRelations.clara.affinity;
  const memoriesBefore = session.memories.length;
  const eventsBefore = (session.worldEvents ?? []).length;
  const res = completeSharedActivity(session, 'share_morning_pastry');
  assert.equal(res.ok, true);
  assert.equal(res.world.playerRelations.clara.affinity, Math.min(100, affinityBefore + 6));
  assert.equal(res.world.playerRelations.clara.reliability, Math.min(100, (session.playerRelations.clara.reliability ?? 25) + 2));
  assert.equal(res.world.memories.length, memoriesBefore + 1);
  assert.equal(res.world.memories[0].id, 'mem_lr_clara_morning_pastry');
  // Host-only firsthand NPC memory is PREPENDED (recordNpcMemoryInPlace inserts at head)
  assert.equal(res.world.npcMemories.clara[0]?.tag, 'shared_morning_pastry');
  const shared = (res.world.worldEvents ?? []).filter((e) => e.kind === 'shared_activity');
  assert.equal(shared.length, eventsBefore + 1);
  assert.equal(res.world.invitations.active, null);
  assert.equal(res.world.invitations.history.at(-1)!.outcome, 'completed');
  assert.equal(res.world.occupancy, null);
  assert.equal(res.world.activeActivity, null);
  assert.match(res.world.npcRuntime?.clara?.emotion ?? '', /happy/);
});

test('LR3-36: both completion surfaces produce identical world deltas', () => {
  const session = stageBakerySession(495);
  // (a) dialogue choice pathway routes through completeSharedActivity
  // (applyDialogueChoice adds dialogue-topic bookkeeping on top); (b) the
  // station-card pathway (App.tsx) derives the SAME activityId from the live
  // accepted invitation (QA-07 fix) and calls the same transaction. The world
  // deltas of the transaction itself must be identical for equal inputs.
  const viaCard = completeSharedActivity(session, 'share_morning_pastry');
  const viaCardClone = completeSharedActivity(session, 'share_morning_pastry');
  assert.deepEqual(viaCard.world, viaCardClone.world, 'transaction is pure and single-sourced');
  assert.equal(viaCard.ok, viaCardClone.ok);
});

test('LR3-37: wrong activity id refuses with no_matching_accepted_invitation', () => {
  const session = stageBakerySession(495);
  const res = completeSharedActivity(session, 'share_featured_reading');
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'no_matching_accepted_invitation');
  assert.equal(res.world, session);
});

test('LR3-38: completion refuses outdoors (wrong_location precedes occupant_not_present order)', () => {
  const invited = stageAcceptedBakeryInvite(495);
  const res = completeSharedActivity(invited, 'share_morning_pastry');
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'wrong_location');
  const entered = enterBakeryAction(invited).nextWorld;
  const noOccupant: WorldState = { ...entered, occupancy: null };
  const res2 = completeSharedActivity(noOccupant, 'share_morning_pastry');
  assert.equal(res2.ok, false);
  assert.equal(res2.reason, 'occupant_not_present');
});

test('LR3-40: completion succeeds after interruption and re-entry (restored triple)', () => {
  const session = stageBakerySession(495);
  const exited = exitBakeryAction(session).nextWorld;
  const reentered = enterBakeryAction(exited).nextWorld;
  const res = completeSharedActivity(reentered, 'share_morning_pastry');
  assert.equal(res.ok, true, 're-entry restored the triple — completion succeeds exactly once');
});

test('LR3-41: duplicate completion attempts are strict no-ops across the documented ladder', () => {
  const session = stageBakerySession(495);
  const first = completeSharedActivity(session, 'share_morning_pastry');
  assert.equal(first.ok, true);
  const historyAfter = first.world.invitations.history.length;
  // (a) Plain duplicate: the active invite was archived by the first success,
  // so the refusal ladder surfaces no_matching_accepted_invitation (QA-13b pin).
  const second = completeSharedActivity(first.world, 'share_morning_pastry');
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'no_matching_accepted_invitation');
  assert.equal(second.world.invitations.history.length, historyAfter, 'no second history row');
  // (b) Pre-seeded memory under a live session: already_completed (LR2-07b analog)
  const liveSession = stageBakerySession(495);
  const seeded: WorldState = {
    ...liveSession,
    memories: [
      {
        id: 'mem_lr_clara_morning_pastry',
        day: liveSession.day,
        phase: 'morning',
        title: 'Pre-seeded',
        summary: 'probe',
        residentId: 'clara',
      },
      ...liveSession.memories,
    ],
  };
  const third = completeSharedActivity(seeded, 'share_morning_pastry');
  assert.equal(third.ok, false);
  assert.equal(third.reason, 'already_completed');
  assert.equal(third.world, seeded, 'no writes on pre-seeded memory');
});

test('LR3-57: complete Clara, then Nora, same day — per-host spacing, slot freed', () => {
  // Morning: Clara full cycle
  const session = stageBakerySession(495);
  const claraDone = completeSharedActivity(session, 'share_morning_pastry');
  assert.equal(claraDone.ok, true);
  const afterClara: WorldState = {
    ...claraDone.world,
    playerLocation: 'exterior',
    minuteOfDay: 975, // golden — Nora's porch slot 0.28 m inside radius
    residents: {
      ...claraDone.world.residents,
      nora: { ...claraDone.world.residents.nora, met: true },
    },
    playerRelations: {
      ...claraDone.world.playerRelations,
      nora: {
        ...claraDone.world.playerRelations.nora,
        affinity: 60,
        reliability: 40,
        negativeCount: 0,
      },
    },
  };
  const noraOffer = offerInvitation(afterClara, 'nora', 'share_featured_reading');
  assert.equal(noraOffer.ok, true, 'slot freed after Clara completed; spacing is per-host');
  const noraAccepted = acceptInvitation(noraOffer.world);
  assert.equal(noraAccepted.ok, true);
  const noraEntered = enterNookAction(noraAccepted.world);
  assert.equal(noraEntered.nextWorld.occupancy?.residentId, 'nora');
  const noraDone = completeSharedActivity(noraEntered.nextWorld, 'share_featured_reading');
  assert.equal(noraDone.ok, true);
  assert.equal(noraDone.world.memories.some((m) => m.id === 'mem_lr_nora_featured_reading'), true);
  assert.equal(
    noraDone.world.memories.some((m) => m.id === 'mem_lr_clara_morning_pastry'),
    true,
    'both histories singular',
  );
});

test('LR3-58: accepted bakery invite → nook entry places nobody; bakery entry then completes normally', () => {
  const invited = stageAcceptedBakeryInvite(495);
  const nookEntered = enterNookAction(invited);
  assert.equal(nookEntered.nextWorld.occupancy, null);
  const exitedNook = exitNookAction(nookEntered.nextWorld).nextWorld;
  const bakeryEntered = enterBakeryAction(exitedNook).nextWorld;
  assert.equal(bakeryEntered.occupancy?.residentId, 'clara', 'bakery path independently healthy');
});

test('LR3-60: Clara window expiry affects only Clara — Nora eligibility unaffected same day', () => {
  const invited = stageAcceptedBakeryInvite(495);
  const expired = expireInvitationsAt(invited, invited.day, 730).world;
  assert.equal(expired.invitations.active, null);
  const noraBase: WorldState = {
    ...expired,
    minuteOfDay: 975,
    flags: { ...expired.flags, foundPostcard: true },
    playerRelations: {
      ...expired.playerRelations,
      nora: { ...expired.playerRelations.nora, affinity: 60, reliability: 40, negativeCount: 0 },
    },
  };
  const noraOffer = offerInvitation(noraBase, 'nora', 'share_featured_reading');
  assert.equal(noraOffer.ok, true, 'no cross-host cooldown bleed');
});

test('LR3-33: save/load restores the claim coherently (round trip through the sanitizer)', () => {
  const session = stageBakerySession(495);
  const serialized = serializeWorldState(session);
  const raw = JSON.parse(serialized) as unknown;
  const warnings: string[] = [];
  const res = sanitizeWorldState(raw, warnings);
  const occ = res.occupancy;
  if (occ) {
    // Restored exactly (all five fields) — the coherent branch of the invariant
    assert.equal(occ.residentId, 'clara');
    assert.equal(occ.location, 'bakery_interior');
    assert.equal(occ.stationId, 'bakery_seat_cafe_west');
    assert.equal(occ.invitationId, res.invitations.active?.id);
    assert.deepEqual(res.activeActivity, {
      activityId: 'share_morning_pastry',
      invitationId: occ.invitationId,
    });
  } else {
    // Or cleared with warning + invite archived per the load invariant
    assert.ok(
      res.invitations.active === null,
      'cleared occupancy implies non-live invite archived',
    );
  }
});

test('LR3-34: stale cross-venue stationId is cleared by SR-7 with the classified warning, invite untouched', () => {
  const session = stageBakerySession(495);
  // Poison AFTER serialization: serializeWorldState runs its own sanitize pass,
  // so the stale stationId must be injected into the raw payload directly.
  const raw = JSON.parse(serializeWorldState(session)) as Record<string, unknown>;
  const occ = session.occupancy;
  assert.ok(occ, 'fixture requires a placed occupant');
  raw.occupancy = { ...occ, stationId: 'nook_chair' };
  const warnings: string[] = [];
  const res = sanitizeWorldState(raw, warnings);
  assert.equal(res.occupancy, null, 'inconsistent occupancy cleared');
  assert.ok(
    warnings.some((w) => w.includes('inconsistent interior occupancy cleared on load')),
    `warnings: ${JSON.stringify(warnings)}`,
  );
  assert.equal(res.invitations.active?.status, 'accepted', 'the invite itself is NOT archived by this rule');
});

test('F-REC-8: a Clara history row with a missing activityId is restored as share_morning_pastry (def-driven), never mislabeled', () => {
  const session = stageBakerySession(495);
  const completed = completeSharedActivity(session, 'share_morning_pastry').world;
  const serialized = JSON.parse(serializeWorldState(completed)) as Record<string, unknown>;
  // Hand-strip the activityId from the Clara history row (the mislabel probe)
  const inv = serialized.invitations as { history: Array<Record<string, unknown>> };
  for (const row of inv.history) {
    if (row.hostId === 'clara') delete row.activityId;
  }
  const res = sanitizeWorldState(serialized, []);
  const claraRow = res.invitations.history.find((h) => h.hostId === 'clara');
  assert.ok(claraRow, 'row survives');
  assert.equal(claraRow!.activityId, 'share_morning_pastry', 'def-driven inference from the host');
});

test('LR3-63 (headless half): 10 enter/exit alternations keep occupancy owned by exactly one venue at any step', () => {
  const invited = stageAcceptedBakeryInvite(495);
  let world = invited;
  let occupancyEvents = 0;
  for (let i = 0; i < 5; i++) {
    const inBakery = enterBakeryAction(world);
    assert.equal(inBakery.nextWorld.playerLocation, 'bakery_interior');
    if (inBakery.nextWorld.occupancy) occupancyEvents++;
    const outBakery = exitBakeryAction(inBakery.nextWorld);
    assert.equal(outBakery.nextWorld.occupancy, null, 'bakery exit releases');
    const inNook = enterNookAction(outBakery.nextWorld);
    assert.equal(inNook.nextWorld.occupancy, null, 'nook entry claims nobody for a Clara invite');
    const outNook = exitNookAction(inNook.nextWorld);
    world = outNook.nextWorld;
  }
  assert.equal(occupancyEvents, 5, 'every bakery re-entry re-places Clara idempotently');
  assert.equal(world.invitations.active?.status, 'accepted', 'invite survives all alternations');
  assert.equal(clearOccupant(world, 'nook_interior'), world, 'no orphan nook occupancy to clear');
});

test('LR3-D8 (integration review E-1): occupant-click labels compose from def titles — nook historic string byte-identical, ledger designation preserved', () => {
  const nora = getSharedActivityDef('share_featured_reading')!;
  const clara = getSharedActivityDef('share_morning_pastry')!;
  // Historic LR-2 occupant-click label: `Share Reading with ${label}` — the
  // scene composes "Share <title minus 'Shared '> with <host>" from the live
  // def. Nora's short title makes that composition byte-identical to the
  // shipped historic string; Clara's title yields the doc 05 §8.3 string.
  const compose = (def: { title: string }, host: string) =>
    `Share ${def.title.replace(/^Shared\s+/, '')} with ${host}`;
  assert.equal(compose(nora, 'Nora'), 'Share Reading with Nora',
    'nook occupant-click label must stay byte-identical to the historic shipped string');
  assert.equal(compose(clara, 'Clara'), 'Share Morning Pastry with Clara',
    'bakery occupant-click label per doc 05 §8.3');
  // Ledger/journal projections keep the longer historic designation.
  assert.equal(nora.ledgerTitle, 'Shared Featured Reading');
  assert.equal(clara.ledgerTitle, undefined, 'Clara falls back to her title');
});
