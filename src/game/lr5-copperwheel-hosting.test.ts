/**
 * LR-5 Arthur / Copperwheel Hosting battery (doc 24 §6, red-test-first).
 *
 * Milestone of record: docs/architecture/living-relationships/
 * 24-lr5-arthur-copperwheel-specification.md — `share_workbench_hour`
 * (host arthur, venue Copperwheel Cottage), occupant anchor, enter/exit
 * graft, invitation quartet, parameterized occupant rig, and the schedule
 * matrix pinned by §4 with the D-5A..D-5E decisions of record:
 *   - D-5A: story gate `copperwheelVisited` sideFlag (discoverability rides
 *     Arthur's own authored first-visit arc — the Nora-postcard precedent).
 *   - D-5B (a): `offerPhases: ['morning', 'dusk']` — the golden Gazebo Steps
 *     slot (5.69 m) passes the generic 6 m gate but would host Arthur AWAY
 *     from the bench.
 *   - D-5C: availability stays the raw `RESIDENTS[id].schedule` reader (a
 *     reconciled override is a reconciliation state, not a hosting state).
 *   - D-5D: reuse `cw_bench` as the station anchor + dedicated occupant seat
 *     beside it; the solo bench ritual gets the LR2-06 suppression treatment.
 *   - D-5E: tier floors only — no new mechanics.
 *
 * Run: npm test (tsx --test src/game/*.test.ts src/scene/*.test.ts)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceToNextDay,
  createFreshWorldState,
  deserializeWorldState,
  serializeWorldState,
} from './storage';
import {
  acceptInvitation,
  canOfferInvitation,
  isHostAvailableForActivity,
  offerInvitation,
} from './invitations';
import {
  completeSharedActivity,
  getSharedActivityDef,
  SHARED_ACTIVITIES,
} from './activities';
import {
  CW_BENCH_STATION_ID,
  CW_OCCUPANT_APPROACH_POS,
  CW_OCCUPANT_FACING,
  CW_OCCUPANT_POS,
} from './occupancy';
import { enterCopperwheelAction, exitCopperwheelAction, checkWorkbenchProjectAction } from './actions';
import { isCopperwheelInteriorWalkable, COPPERWHEEL_INTERIOR_OBSTACLES } from './copperwheel';
import { getProjectForDay } from './copperwheel';
import {
  PLAYER_CANCELLED_REASON,
  cancelActiveInvitation,
  describeInvitationCapabilities,
  getInvitationReasonLabel,
} from './invitationFramework';
import { ARTHUR_INVITATION_TOPICS } from './dialogue/invitations/arthur';
import { evaluateDialogueCondition } from './dialogueEngine';
import goldenJson from '../../scripts/dialogue-topics-golden.json';
import type { WorldState } from './types';

// Day 1 → cycle index 0 = orchard_pendulum (a working bench day).
const WORK_DAY = 1;
// Day 4 → cycle index 3 = bench_rest (the felt is rolled; hosting still works).
const REST_DAY = 4;

/** Arthur staged friendly with the as-built eligibility floor (affinity 45+). */
function stageArthurWorld(
  day: number,
  minuteOfDay = 495,
  affinity = 60,
  opts: { visited?: boolean } = {},
): WorldState {
  const base = createFreshWorldState();
  const visited = opts.visited ?? true;
  return {
    ...base,
    day,
    minuteOfDay,
    sideFlags: visited ? { ...(base.sideFlags ?? {}), copperwheelVisited: true } : {},
    residents: {
      ...base.residents,
      arthur: { ...base.residents.arthur, met: true },
    },
    playerRelations: {
      ...base.playerRelations,
      arthur: {
        ...base.playerRelations.arthur,
        affinity,
        reliability: 40,
        negativeCount: 0,
      },
    },
  };
}

/** Offer + accept a live workbench-hour invite in one step. */
function stageAcceptedVisit(world: WorldState): WorldState {
  const offered = offerInvitation(world, 'arthur', 'share_workbench_hour');
  assert.equal(offered.ok, true, `offer failed: ${offered.reason ?? ''}`);
  const accepted = acceptInvitation(offered.world);
  assert.equal(accepted.ok, true, `accept failed: ${accepted.reason ?? ''}`);
  return accepted.world;
}

test('LR5-01: enter-with-live-invite places Arthur at the bench station', () => {
  const world = stageArthurWorld(WORK_DAY);
  const staged = stageAcceptedVisit(world);
  const entered = enterCopperwheelAction(staged);

  assert.equal(entered.nextWorld.playerLocation, 'copperwheel_interior');
  const occ = entered.nextWorld.occupancy;
  assert.ok(occ, 'occupancy missing after enter with live accepted invite');
  assert.equal(occ.residentId, 'arthur');
  assert.equal(occ.location, 'copperwheel_interior');
  assert.equal(occ.stationId, CW_BENCH_STATION_ID);
  assert.deepEqual(occ.localPos, CW_OCCUPANT_POS);
  assert.equal(occ.facing, CW_OCCUPANT_FACING);
  assert.equal(entered.nextWorld.activeActivity?.activityId, 'share_workbench_hour');
  assert.equal(entered.nextWorld.activeActivity?.invitationId, occ.invitationId);
  assert.match(entered.toast, /Arthur/);
  assert.match(entered.toast, /second stool/);
  // D-5A: first entry also opens the story gate for future runs.
  assert.equal(entered.nextWorld.sideFlags?.copperwheelVisited, true);
});

test('LR5-02: enter after the away-afternoon window expires archives with no occupant', () => {
  const world = stageArthurWorld(WORK_DAY, 500);
  const staged = stageAcceptedVisit(world);
  // Morning offer with Arthur's away afternoon slot caps the window at 719.
  const active = staged.invitations?.active;
  assert.ok(active);
  assert.equal(active.windowEndMinute, 719);
  const later = { ...staged, minuteOfDay: 725 };
  const entered = enterCopperwheelAction(later);
  assert.equal(entered.nextWorld.occupancy, null);
  assert.equal(entered.nextWorld.invitations?.active, null);
  assert.equal(entered.nextWorld.activeActivity, null);
  assert.equal(entered.nextWorld.invitations?.history.length, 1);
  assert.match(entered.toast, /passed|expired|quietly/);
});

test('LR5-02b: entering inside the inherited [690,719] dead zone archives host_unavailable with no phantom occupant', () => {
  // Inherited cross-venue quirk (NOT introduced by LR-5): a morning offer's
  // anchored window caps at 719 (away-afternoon rule) while the phase table
  // switches to afternoon at 690, and the enter reconcile re-checks
  // availability against the CURRENT phase slot. Clara (8.9 m) and Nora
  // (7.1 m) share the identical span; computeOfferWindow is chassis code
  // outside LR-5 scope. Pin: entry inside the dead zone takes the live-window
  // host-unavailable archive branch (not the expiry branch) — visible line,
  // no phantom occupant, nothing granted.
  const world = stageArthurWorld(WORK_DAY, 500);
  const staged = stageAcceptedVisit(world);
  assert.equal(staged.invitations?.active?.windowEndMinute, 719);
  const deadZone = { ...staged, minuteOfDay: 700 };
  const entered = enterCopperwheelAction(deadZone);
  assert.equal(entered.nextWorld.playerLocation, 'copperwheel_interior');
  assert.equal(entered.nextWorld.occupancy, null);
  assert.equal(entered.nextWorld.invitations?.active, null);
  assert.equal(entered.nextWorld.activeActivity, null);
  const historyRow = entered.nextWorld.invitations?.history.at(-1);
  assert.ok(historyRow);
  assert.equal(historyRow.outcome, 'expired');
  assert.equal(historyRow.reason, 'host_unavailable');
  assert.match(entered.toast, /step out|passed|quietly/);
});

test('LR5-03: shared completion leaves every Copperwheel counter byte-identical', () => {
  const world = stageArthurWorld(WORK_DAY);
  const staged = stageAcceptedVisit(world);
  const entered = enterCopperwheelAction(staged);
  const before = JSON.stringify(entered.nextWorld.copperwheelState);
  const result = completeSharedActivity(entered.nextWorld, 'share_workbench_hour');
  assert.equal(result.ok, true, `completion failed: ${result.reason ?? ''}`);
  assert.equal(JSON.stringify(result.world.copperwheelState), before);
});

test('LR5-04: the solo bench ritual refuses with a visible card and zero mutation while the bench is claimed', () => {
  const world = stageArthurWorld(WORK_DAY);
  const staged = stageAcceptedVisit(world);
  const entered = enterCopperwheelAction(staged);
  const snapshot = JSON.stringify(entered.nextWorld);
  const refused = checkWorkbenchProjectAction(entered.nextWorld);
  assert.equal(JSON.stringify(refused.nextWorld), snapshot, 'refusal must not mutate');
  assert.match(refused.body, /workbench hour/i);
  assert.ok(refused.title.length > 0);
});

test('LR5-05: day-advance clears occupancy and archives the overnight invite', () => {
  const world = stageArthurWorld(WORK_DAY);
  const staged = stageAcceptedVisit(world);
  const entered = enterCopperwheelAction(staged);
  assert.ok(entered.nextWorld.occupancy);
  const advanced = advanceToNextDay(entered.nextWorld);
  assert.equal(advanced.occupancy, null);
  assert.equal(advanced.invitations?.active, null);
  assert.equal(advanced.activeActivity, null);
});

test('LR5-06: mid-visit save round-trip restores occupancy and completion still works', () => {
  const world = stageArthurWorld(WORK_DAY);
  const staged = stageAcceptedVisit(world);
  const entered = enterCopperwheelAction(staged);
  const raw = serializeWorldState(entered.nextWorld);
  const loaded = deserializeWorldState(raw);
  assert.equal(loaded.warnings.length, 0);
  const occ = loaded.state.occupancy;
  assert.ok(occ, 'sanitizer dropped copperwheel occupancy');
  assert.equal(occ.residentId, 'arthur');
  assert.equal(occ.stationId, CW_BENCH_STATION_ID);
  assert.equal(occ.invitationId, entered.nextWorld.occupancy?.invitationId);
  assert.deepEqual(occ.localPos, CW_OCCUPANT_POS);
  const result = completeSharedActivity(loaded.state, 'share_workbench_hour');
  assert.equal(result.ok, true, `completion on loaded world failed: ${result.reason ?? ''}`);
});

test('LR5-07: completion writes a host-only firsthand npc memory for Arthur', () => {
  const world = stageArthurWorld(WORK_DAY);
  const staged = stageAcceptedVisit(world);
  const entered = enterCopperwheelAction(staged);
  const beforeOthers = JSON.stringify({
    nora: entered.nextWorld.npcMemories.nora ?? [],
    clara: entered.nextWorld.npcMemories.clara ?? [],
  });
  const result = completeSharedActivity(entered.nextWorld, 'share_workbench_hour');
  assert.equal(result.ok, true);
  const arthurMem = result.world.npcMemories.arthur ?? [];
  const entry = arthurMem.find((m) => m.tag === 'shared_workbench_hour');
  assert.ok(entry, 'arthur npc memory missing');
  assert.equal(entry.provenance, 'firsthand');
  assert.equal(entry.detail?.placeName, 'Copperwheel Cottage');
  assert.equal(
    JSON.stringify({ nora: result.world.npcMemories.nora ?? [], clara: result.world.npcMemories.clara ?? [] }),
    beforeOthers,
    'non-host memory lanes must be untouched',
  );
});

test('LR5-08: schedule matrix — morning/dusk eligible, afternoon auto-blocked, golden phase-closed (D-5B), raw reader (D-5C)', () => {
  // Morning (yard, 0.22 m) — eligible.
  const morning = stageArthurWorld(WORK_DAY, 495);
  assert.deepEqual(canOfferInvitation(morning, 'arthur', 'share_workbench_hour'), { eligible: true });
  assert.equal(isHostAvailableForActivity(morning, 'arthur'), true);

  // Afternoon (East Bench, 11.6 m) — the away-slot rule makes Arthur
  // genuinely unavailable (availability pin below), and with D-5B(a) the
  // offerPhases gate (['morning','dusk']) refuses the offer BEFORE the
  // availability gate in the normative order.
  const afternoon = stageArthurWorld(WORK_DAY, 800);
  assert.equal(canOfferInvitation(afternoon, 'arthur', 'share_workbench_hour').reason, 'offer_phase_closed');
  assert.equal(isHostAvailableForActivity(afternoon, 'arthur'), false);

  // Golden (Gazebo Steps, 5.69 m) — availability PASSES the generic 6 m gate
  // (which is exactly why D-5B(a) requires the offerPhases def field), but
  // the offer gate refuses with offer_phase_closed.
  const golden = stageArthurWorld(WORK_DAY, 1000);
  assert.equal(isHostAvailableForActivity(golden, 'arthur'), true);
  assert.equal(canOfferInvitation(golden, 'arthur', 'share_workbench_hour').reason, 'offer_phase_closed');

  // Dusk (porch, 0.0 m) — eligible.
  const dusk = stageArthurWorld(WORK_DAY, 1150);
  assert.deepEqual(canOfferInvitation(dusk, 'arthur', 'share_workbench_hour'), { eligible: true });

  // D-5C: availability consults the RAW `RESIDENTS[id].schedule` reader — a
  // reconciled override is a reconciliation state, not a hosting state.
  // Discriminating scenario of record: with `claraArthurReconciled` set at
  // golden, the override-aware reader (`getResidentScheduleSlot`) would place
  // Arthur at the reconciled Gazebo slot {1.1,-6.1} = 7.84 m from home (FAILS
  // the 6 m gate) while the raw reader keeps the authored Gazebo Steps slot
  // {3.4,-5.8} = 5.69 m (passes). Asserting availability === true here binds
  // the raw-reader decision: swap the reader to override-aware and this pin
  // fails.
  const reconciledGolden = {
    ...stageArthurWorld(WORK_DAY, 1000),
    flags: { ...createFreshWorldState().flags, claraArthurReconciled: true },
  };
  assert.equal(isHostAvailableForActivity(reconciledGolden, 'arthur'), true, 'D-5C: raw reader ignores the reconciled override slot');

  // A runtime position far from the yard slot likewise does not flip
  // morning eligibility (the reader never consults npcRuntime).
  const base = stageArthurWorld(WORK_DAY, 495);
  const rawReader = {
    ...base,
    npcRuntime: {
      ...base.npcRuntime,
      arthur: { ...base.npcRuntime.arthur, position: { x: -40, z: 40 } },
    },
  };
  assert.equal(isHostAvailableForActivity(rawReader, 'arthur'), true);
  assert.deepEqual(canOfferInvitation(rawReader, 'arthur', 'share_workbench_hour'), { eligible: true });
});

test('LR5-09: completion grants +6/+2 outside the smalltalk cap, memory, and knowledge exactly once', () => {
  const world = stageArthurWorld(WORK_DAY);
  const staged = stageAcceptedVisit(world);
  const entered = enterCopperwheelAction(staged);
  const result = completeSharedActivity(entered.nextWorld, 'share_workbench_hour');
  assert.equal(result.ok, true);

  const rel = result.world.playerRelations?.arthur;
  assert.equal(rel.affinity, 66);
  assert.equal(rel.reliability, 42);
  assert.equal(rel.lastEmotion, 'happy');

  const memory = result.world.memories.find((m) => m.id === 'mem_lr_arthur_workbench_hour');
  assert.ok(memory, 'journal memory missing');
  assert.equal(memory.title, 'Brass Dust and Chamomile');
  assert.match(memory.summary, /Copperwheel Cottage/);
  assert.match(memory.summary, /orchard pendulum/i);
  assert.equal(
    result.world.worldEvents?.some(
      (e) => e.summary === 'Shared the workbench hour with Arthur at Copperwheel Cottage.',
    ),
    true,
    'world event summary must be venue-true',
  );

  assert.deepEqual(result.world.teaching?.known, ['arthur_escapement_basics']);
  // Idempotency: completion archived the active invite, so a second call
  // refuses without re-granting and the knowledge stays exactly-once.
  const again = completeSharedActivity(result.world, 'share_workbench_hour');
  assert.equal(again.ok, false);
  assert.equal(again.reason, 'no_matching_accepted_invitation');
  assert.deepEqual(again.world.teaching?.known, ['arthur_escapement_basics']);
});

test('LR5-09b: rest-day bench composes venue-true rest wording', () => {
  const world = stageArthurWorld(REST_DAY);
  const staged = stageAcceptedVisit(world);
  const entered = enterCopperwheelAction(staged);
  const result = completeSharedActivity(entered.nextWorld, 'share_workbench_hour');
  assert.equal(result.ok, true, `rest-day completion failed: ${result.reason ?? ''}`);
  const memory = result.world.memories.find((m) => m.id === 'mem_lr_arthur_workbench_hour');
  assert.ok(memory);
  assert.match(memory.summary, /bench-rest|resting/);
});

test('LR5-10: solo ritual counters byte-identical across shared-completion paths', () => {
  const world = stageArthurWorld(WORK_DAY);
  const staged = stageAcceptedVisit(world);
  const entered = enterCopperwheelAction(staged);
  const exited = exitCopperwheelAction(entered.nextWorld);
  // Exit releases the claim but the invite stays accepted+live.
  assert.equal(exited.nextWorld.occupancy, null);
  assert.equal(exited.nextWorld.activeActivity, null);
  assert.equal(exited.nextWorld.invitations?.active?.status, 'accepted');
  const reentered = enterCopperwheelAction(exited.nextWorld);
  assert.ok(reentered.nextWorld.occupancy, 're-entry must re-place the occupant idempotently');
  const result = completeSharedActivity(reentered.nextWorld, 'share_workbench_hour');
  assert.equal(result.ok, true);
  const cw = result.world.copperwheelState;
  assert.equal(cw.benchCheckedDay, 0);
  assert.equal(cw.projectsAdmired, 0);
  assert.equal(cw.windingSessions, 0);
  assert.equal(cw.benchCheckedDay, entered.nextWorld.copperwheelState.benchCheckedDay);
  assert.equal(cw.projectsAdmired, entered.nextWorld.copperwheelState.projectsAdmired);
  assert.equal(cw.windingSessions, entered.nextWorld.copperwheelState.windingSessions);
});

test('LR5-11: quartet surfaces with gating — story gate closed pre-visit (D-5A), declined copy interval-accurate', () => {
  assert.equal(ARTHUR_INVITATION_TOPICS.length, 4);
  const ids = ARTHUR_INVITATION_TOPICS.map((t) => t.id);
  assert.deepEqual(ids, [
    'inv_arthur_indoor_workbench',
    'inv_arthur_pending_offer',
    'inv_arthur_offer_workbench',
    'inv_arthur_accepted_reminder',
  ]);

  const offerTopic = ARTHUR_INVITATION_TOPICS.find((t) => t.id === 'inv_arthur_offer_workbench');
  assert.ok(offerTopic);

  // Pre-visit: canOfferInvitation refuses with the story gate reason and the
  // fresh-offer topic is structurally silent.
  const unvisited = stageArthurWorld(WORK_DAY, 495, 60, { visited: false });
  const gate = canOfferInvitation(unvisited, 'arthur', 'share_workbench_hour');
  assert.equal(gate.eligible, false);
  assert.equal(gate.reason, 'story_gate_closed');
  assert.equal(getInvitationReasonLabel('story_gate_closed').length > 0, true);
  assert.equal(
    evaluateDialogueCondition(offerTopic.condition, 'arthur', unvisited, 'morning', offerTopic.id),
    false,
    'offer topic must not surface before the workshop has been visited',
  );

  // Visited + eligible: the topic surfaces.
  const visited = stageArthurWorld(WORK_DAY, 495);
  assert.equal(
    evaluateDialogueCondition(offerTopic.condition, 'arthur', visited, 'morning', offerTopic.id),
    true,
    'offer topic must surface once eligible',
  );

  // B-07 copy-class hygiene: no declined text may promise "tomorrow" (the
  // per-host spacing is day+2; WSB-F2 in actions.ts is the tracked sibling).
  for (const topic of ARTHUR_INVITATION_TOPICS) {
    const spec = topic.build('arthur', visited, 'morning');
    for (const node of Object.values(spec.nodes)) {
      if (!node.text) continue;
      assert.equal(
        /tomorrow/i.test(node.text),
        false,
        `${topic.id} node text must not promise "tomorrow": ${node.text}`,
      );
    }
  }
  const pending = ARTHUR_INVITATION_TOPICS.find((t) => t.id === 'inv_arthur_pending_offer');
  assert.ok(pending);
  const pendingSpec = pending.build('arthur', visited, 'morning');
  assert.match(pendingSpec.nodes.declined_end.text, /a few days on/);
});

test('LR5-11b: golden snapshot regenerated 96 → 100 with the quartet in registry order', () => {
  const golden = goldenJson as { count: number; topics: Array<{ index: number; id: string }> };
  assert.equal(golden.count, 100);
  assert.equal(golden.topics.length, 100);
  const ids = golden.topics.map((t) => t.id);
  // The quartet sits inside the invitation aggregator block, after Clara's.
  const arthurStart = ids.indexOf('inv_arthur_indoor_workbench');
  assert.equal(arthurStart, 89);
  assert.deepEqual(ids.slice(89, 93), [
    'inv_arthur_indoor_workbench',
    'inv_arthur_pending_offer',
    'inv_arthur_offer_workbench',
    'inv_arthur_accepted_reminder',
  ]);
  // Tail-append order is contractual: every pre-existing topic keeps its
  // relative order and the LR-4 teaching topic stays last.
  assert.equal(ids[88], 'inv_clara_accepted_reminder');
  assert.equal(ids[ids.length - 1], 'teaching_nora_featured_reading');
});

test('LR5-12: sideFlags round-trip and sanitizer keeps the story gate across saves', () => {
  const world = stageArthurWorld(WORK_DAY);
  assert.equal(world.sideFlags?.copperwheelVisited, true);
  const loaded = deserializeWorldState(serializeWorldState(world));
  assert.equal(loaded.warnings.length, 0);
  assert.equal(loaded.state.sideFlags?.copperwheelVisited, true);
  // And the gate still evaluates on the loaded world.
  assert.deepEqual(canOfferInvitation(loaded.state, 'arthur', 'share_workbench_hour'), { eligible: true });
});

test('LR5-13: SF integration picks Arthur up automatically — capability rows, ledger label, cancellation', () => {
  const world = stageArthurWorld(WORK_DAY, 495);
  const rows = describeInvitationCapabilities(world, 'arthur');
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.activityId, 'share_workbench_hour');
  assert.equal(row.activityTitle, 'Shared Workbench Hour');
  assert.equal(row.venueLabel, 'Copperwheel Cottage');
  assert.equal(row.eligibility.eligible, true);

  // Pre-visit rows render the story gate through the legible label map.
  const unvisited = stageArthurWorld(WORK_DAY, 495, 60, { visited: false });
  const unvisitedRows = describeInvitationCapabilities(unvisited, 'arthur');
  assert.equal(unvisitedRows[0].eligibility.eligible, false);
  assert.equal(unvisitedRows[0].eligibility.reason, 'story_gate_closed');
  assert.match(getInvitationReasonLabel('story_gate_closed'), /door/);

  // The shared offer_phase_closed label must stay phase-neutral: Arthur's def
  // offers morning AND dusk, so the historic morning-only copy would state a
  // falsehood about his own ledger row (QA-04 label-slot obligation class).
  const phaseLabel = getInvitationReasonLabel('offer_phase_closed');
  assert.equal(/morning/i.test(phaseLabel), false, 'label must not claim morning-only');
  assert.match(phaseLabel, /hours|time of day/);

  // Cancellation: the framework path archives with the machine reason.
  const staged = stageAcceptedVisit(world);
  const cancelled = cancelActiveInvitation(staged);
  assert.equal(cancelled.ok, true);
  const historyRow = cancelled.world.invitations?.history.at(-1);
  assert.ok(historyRow);
  assert.equal(historyRow.outcome, 'expired');
  assert.equal(historyRow.reason, PLAYER_CANCELLED_REASON);
  assert.match(getInvitationReasonLabel(historyRow.reason), /stepped back/);
});

test('LR5-14: copperwheel contract regression — occupant anchor clearance, station reuse, def invariants', () => {
  // L5-S2 clearance evidence: the approach spot is walkable inside the room,
  // distinct from the occupant seat, and not inside any obstacle box.
  assert.equal(isCopperwheelInteriorWalkable(CW_OCCUPANT_APPROACH_POS.x, CW_OCCUPANT_APPROACH_POS.z), true);
  for (const box of COPPERWHEEL_INTERIOR_OBSTACLES) {
    const insideBox =
      CW_OCCUPANT_APPROACH_POS.x > box.minX &&
      CW_OCCUPANT_APPROACH_POS.x < box.maxX &&
      CW_OCCUPANT_APPROACH_POS.z > box.minZ &&
      CW_OCCUPANT_APPROACH_POS.z < box.maxZ;
    assert.equal(insideBox, false, `approach pos must clear obstacle ${box.id}`);
  }
  assert.notDeepEqual(CW_OCCUPANT_APPROACH_POS, CW_OCCUPANT_POS);

  // D-5D: the station reuses the existing cw_bench interactable id.
  assert.equal(CW_BENCH_STATION_ID, 'cw_bench');

  // Def invariants: registry grows to exactly 3; chassis defaults 6/2;
  // knowledge id registered; prior hosts' defs keep their byte-identity.
  const ids = Object.keys(SHARED_ACTIVITIES);
  assert.deepEqual(ids.sort(), ['share_featured_reading', 'share_morning_pastry', 'share_workbench_hour']);
  const def = getSharedActivityDef('share_workbench_hour');
  assert.ok(def);
  assert.equal(def.affinityDelta, 6);
  assert.equal(def.reliabilityDelta, 2);
  assert.equal(def.knowledgeGranted, 'arthur_escapement_basics');
  assert.deepEqual(def.offerPhases, ['morning', 'dusk']);
  assert.equal(def.requiresSideFlag, 'copperwheelVisited');
  assert.equal(def.minTier, 'friendly');
  assert.equal(def.minAffinity, 45);

  const nora = getSharedActivityDef('share_featured_reading');
  assert.ok(nora);
  assert.equal(nora.offerPhases, undefined);
  assert.equal(nora.requiresSideFlag, undefined);
  assert.equal(nora.requiresShareableBake, undefined);
  const clara = getSharedActivityDef('share_morning_pastry');
  assert.ok(clara);
  assert.equal(clara.requiresSideFlag, undefined);
  assert.deepEqual(clara.offerPhases, ['morning']);
  assert.equal(clara.requiresShareableBake, true);

  // Occupant seat sits at the bench front (inside/near the bench footprint),
  // matching the nook precedent of a seated occupant anchored in furniture.
  const bench = COPPERWHEEL_INTERIOR_OBSTACLES.find((b) => b.id === 'cw_bench');
  assert.ok(bench);
  const seatNearBench =
    CW_OCCUPANT_POS.x >= bench.minX - 0.5 &&
    CW_OCCUPANT_POS.x <= bench.maxX + 0.5 &&
    CW_OCCUPANT_POS.z >= bench.minZ - 0.5 &&
    CW_OCCUPANT_POS.z <= bench.maxZ + 0.6;
  assert.equal(seatNearBench, true);
});
