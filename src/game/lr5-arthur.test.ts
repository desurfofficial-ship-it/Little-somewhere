/**
 * LR-5 acceptance & adversarial battery — Arthur · Copperwheel Workshop Shared
 * Workbench Hour & `arthur_escapement_basics` Teaching Milestone.
 *
 * Spec of record:
 *   - docs/architecture/living-relationships/24-lr5-arthur-copperwheel-specification.md
 *   - docs/architecture/living-relationships/26-lr5-implementation-proposal.md
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  advanceToNextDay,
  createFreshWorldState,
  deserializeWorldState,
  serializeWorldState,
} from './storage';
import { CURRENT_SCHEMA_VERSION } from './migrations';
import {
  acceptInvitation,
  advanceClockAndReconcile,
  canOfferInvitation,
  declineInvitation,
  expireInvitationsAt,
  isHostAvailableForActivity,
  offerInvitation,
} from './invitations';
import {
  KNOWLEDGE_IDS,
  KNOWN_KNOWLEDGE_IDS,
  completeSharedActivity,
  getSharedActivityDef,
} from './activities';
import {
  applyDialogueChoice,
  checkWorkbenchProjectAction,
  enterBakeryAction,
  enterCopperwheelAction,
  enterNookAction,
  exitCopperwheelAction,
  exitNookAction,
  interactWithCopperwheelProp,
  pourKettleCupAction,
  togglePlayerSitAction,
} from './actions';
import {
  CW_BENCH_STATION_ID,
  CW_OCCUPANT_APPROACH_POS,
  CW_OCCUPANT_FACING,
  CW_OCCUPANT_POS,
  COPPERWHEEL_SEAT_SPOTS,
  getProjectForDay,
  isCopperwheelInteriorWalkable,
  selectBestCopperwheelTarget,
} from './copperwheel';
import { isStationOccupied } from './occupancy';
import { occupantApproachPos } from './walkability';
import { stepSimulation } from './simulation';
import { RESIDENTS } from './residents';
import { DIALOGUE_TOPICS } from './dialogue';
import { computeContextBoosts } from './dialogueContext';
import { selectDialogueSession } from './dialogueEngine';
import { buildResidentDialogue } from './narrative';
import { ActiveSocialEncounter, WorldState } from './types';

const noChoices = () => ({ choices: [], extraNodes: {} });

function stageEncounter(participants: ActiveSocialEncounter['participants'], minute: number): ActiveSocialEncounter[] {
  return [
    {
      id: 'enc_lr5_probe',
      participants,
      topicTag: 'greeting',
      summary: 'Staged exterior encounter.',
      spots: participants.map(() => ({ x: 0, z: 0 })),
      startedMinute: minute,
      endsMinute: minute + 30,
    },
  ];
}

function stageArthurWorld(options?: {
  day?: number;
  minuteOfDay?: number;
  affinity?: number;
  copperwheelVisited?: boolean;
  bellRestored?: boolean;
  claraArthurReconciled?: boolean;
  met?: boolean;
  reliability?: number;
  negativeCount?: number;
  dailyAffinityGained?: number;
}): WorldState {
  const base = createFreshWorldState();
  const affinity = options?.affinity ?? 60;
  return {
    ...base,
    day: options?.day ?? 3, // day 3 = watch_escapement; day 4 = bench_rest
    minuteOfDay: options?.minuteOfDay ?? 540, // morning: Arthur at Copperwheel Yard (0.22m from homePos)
    flags: {
      ...base.flags,
      bellRestored: options?.bellRestored ?? true,
      claraArthurReconciled: options?.claraArthurReconciled ?? true,
    },
    sideFlags: {
      ...base.sideFlags,
      copperwheelVisited: options?.copperwheelVisited ?? true,
    },
    residents: {
      ...base.residents,
      arthur: {
        ...base.residents.arthur,
        met: options?.met ?? true,
        trust: Math.min(5, Math.floor(affinity / 20)),
      },
      nora: { ...base.residents.nora, met: true, trust: 3 },
      clara: { ...base.residents.clara, met: true, trust: 3 },
    },
    playerRelations: {
      ...base.playerRelations,
      arthur: {
        ...base.playerRelations.arthur,
        affinity,
        reliability: options?.reliability ?? 40,
        negativeCount: options?.negativeCount ?? 0,
        dailyAffinityGained: options?.dailyAffinityGained ?? 0,
      },
      nora: {
        ...base.playerRelations.nora,
        affinity: 60,
        reliability: 40,
        negativeCount: 0,
      },
      clara: {
        ...base.playerRelations.clara,
        affinity: 60,
        reliability: 40,
        negativeCount: 0,
      },
    },
  };
}

function stageAcceptedArthurInvite(options?: Parameters<typeof stageArthurWorld>[0]): WorldState {
  const world = stageArthurWorld(options);
  const offered = offerInvitation(world, 'arthur', 'share_workbench_hour');
  assert.equal(offered.ok, true, `precondition offer should succeed (reason: ${offered.reason})`);
  const accepted = acceptInvitation(offered.world);
  assert.equal(accepted.ok, true, 'precondition accept succeeds');
  return accepted.world;
}

function stageCopperwheelSession(options?: Parameters<typeof stageArthurWorld>[0]): WorldState {
  const invited = stageAcceptedArthurInvite(options);
  const entered = enterCopperwheelAction(invited);
  assert.equal(entered.nextWorld.playerLocation, 'copperwheel_interior');
  assert.equal(entered.nextWorld.occupancy?.residentId, 'arthur');
  return entered.nextWorld;
}

// ---------------------------------------------------------------------------
// LR5-01..07: Offer gates, D-5A..E, entry/exit reconciliation, station guards
// ---------------------------------------------------------------------------

test('LR5-01: registry entry share_workbench_hour matches canonical LR-5 spec & spatial anchors are walkable/clear', () => {
  const def = getSharedActivityDef('share_workbench_hour');
  assert.ok(def, 'share_workbench_hour is registered');
  assert.equal(def.hostId, 'arthur');
  assert.equal(def.location, 'copperwheel_interior');
  assert.equal(def.stationId, CW_BENCH_STATION_ID);
  assert.equal(CW_BENCH_STATION_ID, 'cw_bench');
  assert.equal(def.minTier, 'friendly');
  assert.equal(def.minAffinity, 45);
  assert.deepEqual(def.offerPhases, ['morning', 'dusk']);
  assert.equal(def.knowledgeGranted, 'arthur_escapement_basics');
  assert.equal(def.memoryId, 'mem_lr_arthur_workbench_hour');
  assert.equal(def.npcMemoryTag, 'shared_workbench_hour');
  assert.equal(def.activityNoun, 'workbench hour');
  assert.deepEqual(def.seatPos, CW_OCCUPANT_POS);
  assert.equal(def.seatFacing, CW_OCCUPANT_FACING);

  // Spatial walkability & seating invariant (D-5D)
  assert.equal(COPPERWHEEL_SEAT_SPOTS.length, 1, 'D-5D: armchair stays the sole copperwheel seat');
  assert.equal(
    isCopperwheelInteriorWalkable(CW_OCCUPANT_APPROACH_POS.x, CW_OCCUPANT_APPROACH_POS.z, 0.42),
    true,
    'occupant approach spot must be walkable inside copperwheel_interior',
  );
  assert.deepEqual(occupantApproachPos('copperwheel_interior'), CW_OCCUPANT_APPROACH_POS);
  assert.equal(KNOWN_KNOWLEDGE_IDS.includes('arthur_escapement_basics'), true);
  assert.equal(KNOWLEDGE_IDS.has('arthur_escapement_basics'), true);
});

test('LR5-02: phase & story gates enforce D-5A and D-5B cleanly', () => {
  // Morning (540) and Dusk (1140) pass offer eligibility
  assert.equal(canOfferInvitation(stageArthurWorld({ minuteOfDay: 540 }), 'arthur', 'share_workbench_hour').eligible, true);
  assert.equal(canOfferInvitation(stageArthurWorld({ minuteOfDay: 1140 }), 'arthur', 'share_workbench_hour').eligible, true);

  // Afternoon (780) and Golden (975 — Gazebo Steps within 6m) fail with offer_phase_closed (D-5B)
  const aft = canOfferInvitation(stageArthurWorld({ minuteOfDay: 780 }), 'arthur', 'share_workbench_hour');
  assert.equal(aft.eligible, false);
  assert.equal(aft.reason, 'offer_phase_closed');

  const goldenWorld = stageArthurWorld({ minuteOfDay: 975 });
  assert.equal(
    isHostAvailableForActivity(goldenWorld, 'arthur'),
    true,
    'raw Gazebo distance stays <= 6m without schedule change (D-5C)',
  );
  const goldenGate = canOfferInvitation(goldenWorld, 'arthur', 'share_workbench_hour');
  assert.equal(goldenGate.eligible, false);
  assert.equal(goldenGate.reason, 'offer_phase_closed');

  // Unvisited workshop blocks inv_arthur_offer_workbench via sideFlagsTrue (D-5A)
  const unvisited = stageArthurWorld({ minuteOfDay: 540, copperwheelVisited: false });
  const unvisitedDialogue = buildResidentDialogue('arthur', unvisited, 'morning');
  assert.notEqual(
    unvisitedDialogue.topicId,
    'inv_arthur_offer_workbench',
    'offer dialogue stays locked while sideFlags.copperwheelVisited is false (D-5A)',
  );

  // Bell quest & conflict reconciliation keep authored band priority over invitations
  const bellPending = stageArthurWorld({ minuteOfDay: 540, copperwheelVisited: true, bellRestored: false });
  assert.equal(buildResidentDialogue('arthur', bellPending, 'morning').topicId, 'quest_arthur_bell');
  const conflictPending = stageArthurWorld({ minuteOfDay: 540, copperwheelVisited: true, claraArthurReconciled: false });
  assert.equal(buildResidentDialogue('arthur', conflictPending, 'morning').topicId, 'conflict_arthur_clara_tension');

  // Once copperwheelVisited === true and quests resolved, outdoor morning Arthur leads with inv_arthur_offer_workbench
  const visited = stageArthurWorld({ minuteOfDay: 540, copperwheelVisited: true });
  const visitedDialogue = buildResidentDialogue('arthur', visited, 'morning');
  assert.equal(visitedDialogue.topicId, 'inv_arthur_offer_workbench');
});

test('LR5-03: affinity/tier floor & encounter availability & spacing follow shared framework', () => {
  const lowAff = canOfferInvitation(stageArthurWorld({ affinity: 39 }), 'arthur', 'share_workbench_hour');
  assert.equal(lowAff.eligible, false);
  assert.equal(lowAff.reason, 'tier_too_low');

  const guarded = canOfferInvitation(stageArthurWorld({ reliability: 15 }), 'arthur', 'share_workbench_hour');
  assert.equal(guarded.eligible, false);
  assert.equal(guarded.reason, 'host_guarded');

  const inEnc = stageArthurWorld({ minuteOfDay: 540 });
  inEnc.activeEncounters = stageEncounter(['arthur', 'barnaby'], 540);
  const encGate = canOfferInvitation(inEnc, 'arthur', 'share_workbench_hour');
  assert.equal(encGate.eligible, false);
  assert.equal(encGate.reason, 'host_unavailable');

  // Morning window caps cleanly at 719 before afternoon away slot (4.15, 3.0)
  const acceptedMorning = stageAcceptedArthurInvite({ minuteOfDay: 540 });
  assert.equal(acceptedMorning.invitations.active?.windowEndMinute, 719);

  // Dusk window spans cleanly up to 1260
  const acceptedDusk = stageAcceptedArthurInvite({ minuteOfDay: 1140 });
  assert.equal(acceptedDusk.invitations.active?.windowEndMinute, 1260);

  // 2-day spacing check after decline
  const declined = declineInvitation(offerInvitation(stageArthurWorld(), 'arthur', 'share_workbench_hour').world);
  assert.equal(declined.ok, true);
  const nextDay = { ...declined.world, day: declined.world.day + 1 };
  assert.equal(canOfferInvitation(nextDay, 'arthur', 'share_workbench_hour').reason, 'spacing_cooldown');
  const twoDaysLater = { ...declined.world, day: declined.world.day + 2 };
  assert.equal(canOfferInvitation(twoDaysLater, 'arthur', 'share_workbench_hour').eligible, true);
});

test('LR5-04: entering & exiting Copperwheel reconciles occupancy, activeActivity, and dead-zone expiry cleanly', () => {
  const invited = stageAcceptedArthurInvite({ minuteOfDay: 540 });
  const entered = enterCopperwheelAction(invited);
  assert.equal(entered.nextWorld.playerLocation, 'copperwheel_interior');
  assert.equal(entered.nextWorld.occupancy?.residentId, 'arthur');
  assert.equal(entered.nextWorld.occupancy?.location, 'copperwheel_interior');
  assert.equal(entered.nextWorld.occupancy?.stationId, CW_BENCH_STATION_ID);
  assert.deepEqual(entered.nextWorld.activeActivity, {
    activityId: 'share_workbench_hour',
    invitationId: entered.nextWorld.invitations.active!.id,
  });
  assert.match(entered.toast, /Stepped inside Copperwheel Cottage — Arthur/);

  // Exit releases occupancy & activeActivity while keeping accepted invite intact
  const exited = exitCopperwheelAction(entered.nextWorld);
  assert.equal(exited.nextWorld.playerLocation, 'exterior');
  assert.equal(exited.nextWorld.occupancy, null);
  assert.equal(exited.nextWorld.activeActivity, null);
  assert.equal(exited.nextWorld.invitations.active?.status, 'accepted');

  // Re-entry restores occupant cleanly
  const reentered = enterCopperwheelAction(exited.nextWorld);
  assert.equal(reentered.nextWorld.occupancy?.residentId, 'arthur');

  // 690–719 dead-zone entry archives host_unavailable with zero phantom occupant
  const deadZone = advanceClockAndReconcile(invited, 160).world; // 540 + 160 = 700
  const deadEnter = enterCopperwheelAction(deadZone);
  assert.equal(deadEnter.nextWorld.playerLocation, 'copperwheel_interior');
  assert.equal(deadEnter.nextWorld.occupancy, null);
  assert.equal(deadEnter.nextWorld.invitations.active, null);
  const hist = deadEnter.nextWorld.invitations.history.at(-1)!;
  assert.equal(hist.outcome, 'expired');
  assert.equal(hist.reason, 'host_unavailable');
  assert.match(deadEnter.toast, /had to step out/);
});

test('LR5-05: cross-venue isolation prevents phantom occupants in Nook/Bakery and protects LR-3/LR-4', () => {
  const arthurAccepted = stageAcceptedArthurInvite({ minuteOfDay: 540 });
  const inNook = enterNookAction(arthurAccepted);
  assert.equal(inNook.nextWorld.occupancy, null, 'Arthur invite never places Nora in Nook');
  assert.equal(inNook.nextWorld.invitations.active?.hostId, 'arthur');

  const outNook = exitNookAction(inNook.nextWorld).nextWorld;
  const inBakery = enterBakeryAction(outNook);
  assert.equal(inBakery.nextWorld.occupancy, null, 'Arthur invite never places Clara in Bakery');
  assert.equal(inBakery.nextWorld.invitations.active?.hostId, 'arthur');
});

test('LR5-06: cw_bench PropCard delegates during live session while solo bench check & armchair sit refuse cleanly', () => {
  const session = stageCopperwheelSession({ day: 3, minuteOfDay: 540 });
  assert.equal(isStationOccupied(session, 'copperwheel_interior', CW_BENCH_STATION_ID), true);

  // cw_bench prop interaction offers Share a Workbench Hour
  const card = interactWithCopperwheelProp(session, 'cw_bench');
  assert.equal(card.actionType, 'share_workbench_hour');
  assert.equal(card.actionLabel, 'Share a Workbench Hour');
  assert.equal(card.nextWorld, session, 'PropCard preview makes zero state writes');

  // Direct call to checkWorkbenchProjectAction refuses with zero mutation
  const benchBefore = JSON.stringify(session.copperwheelState);
  const directCheck = checkWorkbenchProjectAction(session);
  assert.equal(directCheck.nextWorld, session);
  assert.equal(directCheck.nextWorld.minuteOfDay, 540);
  assert.equal(JSON.stringify(directCheck.nextWorld.copperwheelState), benchBefore);

  // Window armchair sit refuses during live workbench hour with zero mutation
  const sitRes = togglePlayerSitAction(session, 'cw_seat_armchair');
  assert.equal(sitRes.sat, false);
  assert.equal(sitRes.nextWorld, session);
  assert.match(sitRes.toast ?? '', /Arthur/);

  // Copper kettle remains independently usable during session (negative guard check)
  const kettleRes = pourKettleCupAction(session);
  assert.notEqual(kettleRes.nextWorld, session);
  assert.equal(kettleRes.nextWorld.copperwheelState?.teaSharedDay, session.day);

  // selectBestCopperwheelTarget surfaces Arthur occupant when standing near approach spot
  const nearArthur: WorldState = {
    ...session,
    playerPos: { ...CW_OCCUPANT_APPROACH_POS },
    playerFacing: Math.atan2(
      CW_OCCUPANT_POS.x - CW_OCCUPANT_APPROACH_POS.x,
      CW_OCCUPANT_POS.z - CW_OCCUPANT_APPROACH_POS.z,
    ),
  };
  const best = selectBestCopperwheelTarget(nearArthur);
  assert.ok(best);
  assert.equal(best.kind, 'resident');
  assert.equal(best.id, 'arthur');
  assert.equal(best.actionLabel, 'Share Workbench Hour with Arthur');

  // Day 4 bench_rest variant produces graceful non-glitchy PropCard prose
  const restSession = stageCopperwheelSession({ day: 4, minuteOfDay: 540 });
  assert.equal(getProjectForDay(4).id, 'bench_rest');
  const restCard = interactWithCopperwheelProp(restSession, 'cw_bench');
  assert.equal(restCard.actionType, 'share_workbench_hour');
  assert.match(restCard.body, /felt|drawer|bench/i);
});

// ---------------------------------------------------------------------------
// LR5-08..14: Completion, teaching grant, narrative reflection, simulation & persistence
// ---------------------------------------------------------------------------

test('LR5-08: completeSharedActivity rewards affinity (+6 outside daily cap), reliability (+2), memory, worldEvent, and teaching grant', () => {
  const session = stageCopperwheelSession({
    day: 3,
    minuteOfDay: 540,
    affinity: 60,
    reliability: 40,
    dailyAffinityGained: 12, // already at daily smalltalk cap
  });
  const res = completeSharedActivity(session, 'share_workbench_hour');
  assert.equal(res.ok, true);
  assert.equal(res.world.playerRelations.arthur.affinity, 66);
  assert.equal(res.world.playerRelations.arthur.dailyAffinityGained, 12, 'smalltalk cap untouched');
  assert.equal(res.world.playerRelations.arthur.reliability, 42);
  assert.equal(res.world.memories[0].id, 'mem_lr_arthur_workbench_hour');
  assert.equal(res.world.memories[0].residentId, 'arthur');
  assert.match(res.world.memories[0].summary, /Arthur/);
  assert.match(res.world.memories[0].summary, /Copperwheel/);
  assert.doesNotMatch(res.world.memories[0].summary, /Book Nook|Hearth & Crumb/);
  assert.equal(res.world.npcMemories.arthur[0]?.tag, 'shared_workbench_hour');
  assert.equal(res.world.npcMemories.nora.length, 0, 'host-only firsthand write');
  assert.equal(res.world.worldEvents?.at(0)?.summaryTag, 'shared_workbench_hour');
  assert.equal(res.world.worldEvents?.at(0)?.kind, 'shared_activity');
  assert.equal(res.world.invitations.active, null);
  assert.equal(res.world.invitations.history.at(-1)?.outcome, 'completed');
  assert.equal(res.world.occupancy, null);
  assert.equal(res.world.activeActivity, null);
  assert.equal(res.world.teaching.known.includes('arthur_escapement_basics'), true);
  assert.equal(res.world.npcRuntime.arthur.emotion, 'happy');
});

test('LR5-09: duplicate completion fails cleanly & never touches copperwheelState counters', () => {
  const session = stageCopperwheelSession({ day: 4, minuteOfDay: 540 });
  const cwsBefore = JSON.stringify(session.copperwheelState);
  const first = completeSharedActivity(session, 'share_workbench_hour');
  assert.equal(first.ok, true);
  assert.equal(JSON.stringify(first.world.copperwheelState), cwsBefore, 'solo copperwheel counters untouched');
  // Day 4 bench_rest summary still mentions Copperwheel Cottage truthfully
  assert.match(first.world.memories[0].summary, /Copperwheel/);

  const second = completeSharedActivity(first.world, 'share_workbench_hour');
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'no_matching_accepted_invitation');
});

test('LR5-10: indoor & outdoor Arthur invitation dialogue quartet works end-to-end and teaches arthur_escapement_basics', () => {
  // 1. Fresh offer outdoors -> accept -> indoor completion choice
  const outdoor = stageArthurWorld({ minuteOfDay: 540, copperwheelVisited: true });
  const offerDlg = buildResidentDialogue('arthur', outdoor, 'morning');
  assert.equal(offerDlg.topicId, 'inv_arthur_offer_workbench');
  const acceptChoice = offerDlg.nodes[offerDlg.currentNodeId].choices.find((c) => c.acceptInvitation);
  assert.ok(acceptChoice);
  const afterAccept = applyDialogueChoice(outdoor, offerDlg, acceptChoice);
  assert.equal(afterAccept.nextWorld.invitations.active?.status, 'accepted');
  assert.match(afterAccept.nextSession.recentToast ?? '', /Copperwheel Cottage/);

  // Outdoor reminder while accepted
  const reminderDlg = buildResidentDialogue('arthur', afterAccept.nextWorld, 'morning');
  assert.equal(reminderDlg.topicId, 'inv_arthur_accepted_reminder');

  // Offered-pending path (offerInvitation only, then dialogue picks inv_arthur_pending_offer)
  const pendingOffered = offerInvitation(outdoor, 'arthur', 'share_workbench_hour').world;
  const pendingDlg = buildResidentDialogue('arthur', pendingOffered, 'morning');
  assert.equal(pendingDlg.topicId, 'inv_arthur_pending_offer');

  // Indoor Copperwheel completion choice -> exact same rewards + arthur_escapement_basics
  const entered = enterCopperwheelAction(afterAccept.nextWorld).nextWorld;
  const indoorDlg = buildResidentDialogue('arthur', entered, 'morning');
  assert.equal(indoorDlg.topicId, 'inv_arthur_indoor_workbench');
  const completeChoice = indoorDlg.nodes[indoorDlg.currentNodeId].choices.find(
    (c) => c.completeSharedActivityId === 'share_workbench_hour',
  );
  assert.ok(completeChoice);
  const afterComplete = applyDialogueChoice(entered, indoorDlg, completeChoice);
  assert.equal(afterComplete.nextWorld.teaching.known.includes('arthur_escapement_basics'), true);
  assert.equal(afterComplete.nextWorld.occupancy, null);
  assert.equal(afterComplete.nextWorld.invitations.active, null);
});

test('LR5-11: teaching_arthur_escapement_basics surfaces after completion, gets 0 context boost, and retires after 1 mention', () => {
  const session = stageCopperwheelSession({ day: 3, minuteOfDay: 540 });
  const done = completeSharedActivity(session, 'share_workbench_hour').world;
  const exited = exitCopperwheelAction({ ...done, playerLocation: 'copperwheel_interior' }).nextWorld;

  // Next day morning outdoors so notSeenToday passes cleanly and copperwheelVisited is true
  const nextMorning: WorldState = {
    ...exited,
    day: exited.day + 1,
    minuteOfDay: 540,
  };

  // Context boost check: singular tag -> 0 context boost (D-5/LR4 parity)
  const topic = DIALOGUE_TOPICS.find((t) => t.id === 'teaching_arthur_escapement_basics');
  assert.ok(topic, 'teaching_arthur_escapement_basics exported in DIALOGUE_TOPICS');
  const boosts = computeContextBoosts(nextMorning, 'arthur', 'morning', [topic]);
  assert.equal(boosts.teaching_arthur_escapement_basics ?? 0, 0);

  // Selected naturally over daily checkin / generic chatter
  const selection = selectDialogueSession(
    'arthur',
    nextMorning,
    'morning',
    DIALOGUE_TOPICS,
    noChoices,
    computeContextBoosts(nextMorning, 'arthur', 'morning', DIALOGUE_TOPICS),
  );
  assert.equal(selection.topicId, 'teaching_arthur_escapement_basics');

  // Choosing warm response marks shared_workbench_hour mentioned and increments seenCount -> retires
  const afterTalk = applyDialogueChoice(
    nextMorning,
    selection,
    selection.nodes[selection.currentNodeId].choices[0]!,
  ).nextWorld;
  const arthurMem = afterTalk.npcMemories.arthur.find((m) => m.tag === 'shared_workbench_hour');
  assert.equal(arthurMem?.mentionedToPlayer, true);

  const dayAfterTalk: WorldState = { ...afterTalk, day: afterTalk.day + 1, minuteOfDay: 540 };
  const secondPick = selectDialogueSession(
    'arthur',
    dayAfterTalk,
    'morning',
    DIALOGUE_TOPICS,
    noChoices,
    computeContextBoosts(dayAfterTalk, 'arthur', 'morning', DIALOGUE_TOPICS),
  );
  assert.notEqual(secondPick.topicId, 'teaching_arthur_escapement_basics');
});

test('LR5-12: active occupancy exempts Arthur from exterior wandering & encounters in simulation', () => {
  const session = stageCopperwheelSession({ day: 3, minuteOfDay: 540 });
  const beforePos = { ...session.npcRuntime.arthur.position };
  const stepped = stepSimulation(session, 10);
  assert.deepEqual(
    stepped.npcRuntime.arthur.position,
    beforePos,
    'occupied indoor Arthur does not teleport or wander outdoors',
  );
  assert.equal(
    (stepped.activeEncounters ?? []).some((e) => e.participants.includes('arthur')),
    false,
    'occupied Arthur excluded from exterior encounters',
  );
});

test('LR5-13: save/load round-trip preserves active session, teaching grant, and catches stale cross-venue occupancy at schema v13', () => {
  assert.equal(CURRENT_SCHEMA_VERSION, 13, 'LR-5 keeps WorldState at schema v13');
  const session = stageCopperwheelSession({ day: 3, minuteOfDay: 540 });
  const saved = deserializeWorldState(serializeWorldState(session));
  assert.equal(saved.warnings?.length ?? 0, 0);
  assert.equal(saved.state.occupancy?.residentId, 'arthur');
  assert.equal(saved.state.occupancy?.stationId, CW_BENCH_STATION_ID);
  assert.equal(saved.state.activeActivity?.activityId, 'share_workbench_hour');

  // Corrupt stationId -> sanitizer clears occupancy safely
  const raw = JSON.parse(serializeWorldState(session)) as Record<string, unknown>;
  raw.occupancy = { ...(session.occupancy!), stationId: 'nook_chair' };
  const corrupted = deserializeWorldState(JSON.stringify(raw));
  assert.equal(corrupted.state.occupancy, null);
  assert.ok(corrupted.warnings?.some((w) => w.includes('inconsistent interior occupancy')));

  // After completion, teaching grant persists through save/load
  const done = completeSharedActivity(session, 'share_workbench_hour').world;
  const loadedDone = deserializeWorldState(serializeWorldState(done));
  assert.equal(loadedDone.state.teaching.known.includes('arthur_escapement_basics'), true);
});

test('LR5-14: dawn sleep clears active Copperwheel session cleanly + both LR-3 & LR-4 remain fully operational', () => {
  const session = stageCopperwheelSession({ day: 3, minuteOfDay: 540 });
  const slept = advanceToNextDay(session);
  assert.equal(slept.playerLocation, 'exterior');
  assert.equal(slept.occupancy, null);
  assert.equal(slept.activeActivity, null);
  assert.equal(slept.invitations.active, null);
  assert.equal(slept.invitations.history.at(-1)?.outcome, 'expired');

  // Fresh Clara & Nora sessions still complete identically
  const golden = JSON.parse(readFileSync('scripts/dialogue-topics-golden.json', 'utf8')) as {
    count: number;
    topics: Array<{ id: string }>;
  };
  assert.equal(golden.count, DIALOGUE_TOPICS.length);
  assert.equal(golden.topics.at(-1)?.id, 'teaching_arthur_escapement_basics');
});
