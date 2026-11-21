/**
 * ============================================================================
 * LR TICK/LOAD CONSISTENCY + NORA DISCOVERABILITY — landed from the surviving
 * adversarial red-test draft (Agent 4, corrective engineering initiative).
 * ============================================================================
 *
 * Provenance: the corrective branch fix/build10-lr-reconciliation (six commits,
 * head 86ecb92) was lost with its worktree before it could be pushed; these
 * tests are the surviving behavioral contract, re-landed against the
 * re-executed work on top of origin/main eb95d77.
 *
 * Scope:
 *   §1 — LR tick/load matrix around the invitation lifecycle: within-window /
 *        post-window / accepted-no-occupancy / host-unavailable / orphan-
 *        occupancy / load-then-tick cases, and the pre-window case whose tick
 *        half was resolved by the D-03 strict-predicate decision.
 *   §2 — Nora invitation discoverability probe (measured post-gate policy).
 *
 * DOC BASIS (the expected values rely on):
 *   doc 14 §2.4 (14-revised-architecture.md):
 *     "Decision — single predicate isInvitationLive(inv, day, minute): inv is
 *      live iff ... AND minute >= inv.windowStartMinute AND minute <=
 *      inv.windowEndMinute ... Anything else is expired."
 *   doc 14 §4.3 (load invariant):
 *     "if occupancy.location !== world.playerLocation → clear occupancy
 *      if occupancy.invitationId !== active?.id → clear occupancy
 *      if active is null or not live at (day, minute) → clear occupancy and
 *      expire active if present
 *      if activeActivity is set but active is null → clear activeActivity"
 *   doc 16 (16-lr1-lr2-acceptance-test-plan.md):
 *     LR1-14 "Round-trip of a live offered invite ... active restored with same
 *     id, host, window"; LR1-19 "Live sim clock expires across the window ...
 *     active === null; history outcome: 'expired'"; LR2-03 "enter must archive
 *     expired with reason host_unavailable and a player-visible line";
 *     LR2-15 "Load mid-visit, window still live ... Occupant restored. Invite
 *     still accepted"; LR2-16 "Load mid-visit, window no longer live ...
 *     Occupancy cleared; invite archived or cleared".
 *   doc 21 (21-lr1-design-decision-record.md, branch d615a8e):
 *     §1.4 Decision A — gate 4 is an offer-moment check; schedule drift inside
 *     an otherwise live window is owned by the enter-time host_unavailable
 *     backstop. §2.4 Decision B — LR2-04b staging must be re-anchored to
 *     invites that are live at creation (the anchoring policy makes pre-window
 *     actives unreachable by production offers).
 *
 * D-03 RESOLUTION PINNED HERE (build10-lr-recovery doc 05 §3):
 *   isInvitationExpired is now exactly !isInvitationLive — ONE strict
 *   predicate for the tick reconciler, the save sanitizer and the load
 *   sanitizer. The draft's LRTL-01 offered two explicit candidates:
 *     Candidate A (tolerant tick): pre-window actives survive the tick but are
 *       silently archived by serializeWorldState on the next autosave — a
 *       measured save-compatibility hazard (the archive happens at SAVE with
 *       the diagnostic warning dropped, before load ever runs).
 *     Candidate B (strict tick): the first reconciling path expires a
 *       pre-window active exactly once. ADOPTED — production offers are always
 *       live at creation (anchored window start, doc 20 §4), so the change is
 *       unreachable through ordinary play and makes tick/save/load agree.
 *   LRTL-01 below pins candidate B; occupancy.test.ts LR2-04b(-bis) carries the
 *   re-anchored and adversarial-companion stagings sanctioned by doc 21 §2.4/2.5.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreshWorldState, serializeWorldState, deserializeWorldState } from './storage';
import { stepSimulationInPlace } from './simulation';
import type { WorldState } from './types';
import { offerInvitation, acceptInvitation, advanceClockAndReconcile } from './invitations';
import { enterNookAction } from './actions';
import { NOOK_PORCH_EXIT_POS } from './bookNook';
import { canOfferInvitation } from './invitations';
import { buildResidentDialogue } from './narrative';
import { applyDialogueChoice } from './actions';
import { isChoiceAvailable } from './dialogueEngine';
import { getTimePhase } from './time';
import { advanceToNextDay } from './storage';

// ── structural views ─────────────────────────────────────────────────────────
interface InvitationLike {
  id: string;
  status: 'offered' | 'accepted';
  hostId: string;
  activityId: string;
  offeredDay: number;
  expiresDay: number;
  windowStartMinute: number;
  windowEndMinute: number;
}
interface WorldLike {
  schemaVersion: number;
  day: number;
  minuteOfDay: number;
  simSeed: number;
  playerLocation: string;
  playerPos: { x: number; z: number };
  exteriorPlayerPos: { x: number; z: number };
  residents: Record<string, { met: boolean; trust: number; mood: string; talkedToday: boolean }>;
  playerRelations: Record<string, Record<string, unknown>>;
  activeEncounters: Array<Record<string, unknown>>;
  memories: Array<{ id: string }>;
  flags: Record<string, unknown>;
  invitations: {
    active: InvitationLike | null;
    history: Array<{ invitationId: string; outcome: string; day: number; reason?: string }>;
    lastOfferDayByHost: Record<string, number>;
  };
  occupancy: Record<string, unknown> | null;
  activeActivity: { activityId: string; invitationId: string } | null;
  [k: string]: unknown;
}

const ACTIVITY = 'share_featured_reading';

function freshWorld(): WorldLike {
  return createFreshWorldState() as unknown as WorldLike;
}

function tick(world: WorldLike, dtSeconds = 0.2, opts: Record<string, unknown> = {}): void {
  stepSimulationInPlace(world as unknown as WorldState, dtSeconds, { clockRateMinutesPerSec: 10, ...opts } as never);
}

function serialize(world: WorldLike): string {
  return serializeWorldState(world as never);
}

function deserialize(raw: string): { state: WorldLike; warnings: string[] } {
  return deserializeWorldState(raw) as unknown as { state: WorldLike; warnings: string[] };
}

/**
 * Production offer + accept at 540 (Nora's morning slot is at her homePos, so
 * the offer gate passes per doc 14 §2.3 gates 1-5), then hand-stage overrides —
 * exactly the "adversarial staged variant" doc 21 §2.5 (LR2-04b-bis) sanctions:
 * "in-memory fixture" overrides applied to a production-created invitation.
 */
function stageInvitation(
  world: WorldLike,
  overrides: Partial<InvitationLike> = {},
): InvitationLike {
  world.minuteOfDay = 540; // morning; Nora near home
  world.residents.nora = { ...world.residents.nora, met: true, trust: 3 };
  world.playerRelations.nora = {
    ...world.playerRelations.nora,
    affinity: 60,
    reliability: 30,
    negativeCount: 0,
  };
  const offered = (offerInvitation as (w: unknown, h: string, a: string) => {
    ok: boolean;
    world: unknown;
  })(world, 'nora', ACTIVITY);
  assert.equal(offered.ok, true, 'precondition: production offer succeeds at 540');
  const accepted = (acceptInvitation as (w: unknown) => { ok: boolean; world: unknown })(
    offered.world,
  );
  assert.equal(accepted.ok, true, 'precondition: accept succeeds while live');
  const w = accepted.world as unknown as WorldLike;
  const active = w.invitations.active;
  assert.ok(active, 'precondition: active invite exists');
  // Copy the production result into the caller's world object, applying overrides.
  Object.assign(world, w);
  world.invitations = {
    active: { ...(active as InvitationLike), ...overrides },
    history: w.invitations.history,
    lastOfferDayByHost: { ...w.invitations.lastOfferDayByHost },
  };
  return world.invitations.active as InvitationLike;
}

function expiredRows(world: WorldLike): Array<{ invitationId: string; outcome: string }> {
  return world.invitations.history.filter((h) => h.outcome === 'expired');
}

// ============================================================================
// §1 — LR tick/load matrix (D-03: ONE strict predicate everywhere)
// ============================================================================

test('LRTL-01 [D-03 strict pin, candidate B] pre-window invite: the FIRST reconciling path archives it exactly once; tick and save/load agree', () => {
  const world = freshWorld();
  // Hand-staged pre-window: window [600, 780], clock at 495 (before start).
  // Only reachable by hand-staging — production offers are anchored live at
  // creation (doc 20 §4; doc 21 §2.4 Decision B).
  const active = stageInvitation(world, { windowStartMinute: 600, windowEndMinute: 780 });
  world.minuteOfDay = 495;
  world.playerLocation = 'exterior';

  // (i) ONE production tick (+2 minutes → 497, still pre-window). The strict
  // predicate archives it exactly once — the same outcome the save/load
  // sanitizer produces, so no path can keep a state another path destroys.
  tick(world);
  assert.ok(world.minuteOfDay === 497, `clock advanced (got ${world.minuteOfDay})`);
  assert.equal(world.invitations.active, null, 'strict tick: pre-window invite archived');
  const rows = expiredRows(world);
  assert.equal(rows.length, 1, 'exactly one expired history row');
  assert.equal(rows[0]?.invitationId, active.id);

  // (ii) Save via serialize (sanitize) + load — the archive survives the
  // round trip and is never duplicated (tick/load agreement, not divergence).
  const res = deserialize(serialize(world));
  assert.equal(res.state.invitations.active, null, 'load: still archived (agrees with tick)');
  const rowsAfterLoad = res.state.invitations.history.filter((h) => h.outcome === 'expired');
  assert.equal(rowsAfterLoad.length, 1, 'exactly one expired row after load — no duplicate');
  assert.equal(rowsAfterLoad[0]?.invitationId, active.id);

  // (iii) A raw hand-crafted save that BYPASSES serialize (legacy/hand-edited
  // JSON) is archived by the load sanitizer with the documented warning.
  const rawCraft = JSON.stringify({ ...world, invitations: { active, history: [], lastOfferDayByHost: {} }, minuteOfDay: 495 });
  const res2 = deserialize(rawCraft);
  assert.equal(res2.state.invitations.active, null, 'load: raw pre-window active archived');
  assert.ok(
    res2.warnings.includes('non-live active invitation archived on load'),
    `sanitizer reports the archive (warnings: ${res2.warnings.join(' | ')})`,
  );
});

test('LRTL-02 [PIN] within-window offered invite survives tick and round-trips load (doc 16 LR1-14)', () => {
  const world = freshWorld();
  const active = stageInvitation(world, { status: 'offered' });
  world.minuteOfDay = 650; // inside [540, 719]
  world.playerLocation = 'exterior';

  tick(world);
  assert.ok(world.invitations.active, 'within-window invite survives the tick');
  assert.equal(world.invitations.active?.status, 'offered');
  assert.deepEqual(expiredRows(world), [], 'no history rows from a live tick');

  const res = deserialize(serialize(world));
  const loaded = res.state.invitations.active;
  assert.ok(loaded, 'live offered invite restored on load (doc 16 LR1-14)');
  assert.equal(loaded?.id, active.id);
  assert.equal(loaded?.hostId, 'nora');
  assert.equal(loaded?.status, 'offered');
  assert.equal(loaded?.windowStartMinute, active.windowStartMinute);
  assert.equal(loaded?.windowEndMinute, active.windowEndMinute);
  assert.equal(loaded?.expiresDay, active.expiresDay);
});

test('LRTL-03 [PIN] post-window invite: tick expires once (LR1-19); load clears without teleport (LR2-16)', () => {
  const world = freshWorld();
  const active = stageInvitation(world);
  world.minuteOfDay = 800; // > windowEnd 719
  world.playerLocation = 'nook_interior';
  world.occupancy = {
    residentId: 'nora',
    location: 'nook_interior',
    stationId: 'nook_chair',
    localPos: { x: -10.8, z: -0.6 },
    facing: 0,
    invitationId: active.id,
  };

  tick(world); // 802 — past the end
  assert.ok(world.minuteOfDay > 719, 'clock crossed the window end');
  assert.equal(world.invitations.active, null, 'tick expired the dead-window invite');
  assert.equal(expiredRows(world).length, 1, 'archived exactly once by the tick');
  assert.equal(world.occupancy, null, 'tick cleared stale occupancy');

  // Load path with a dead-window save (fresh craft: occupancy + accepted invite at 810).
  const save = freshWorld();
  const deadActive = stageInvitation(save);
  save.minuteOfDay = (deadActive.windowEndMinute ?? 719) + 30;
  save.playerLocation = 'nook_interior';
  save.occupancy = {
    residentId: 'nora',
    location: 'nook_interior',
    stationId: 'nook_chair',
    localPos: { x: -10.8, z: -0.6 },
    facing: 0,
    invitationId: deadActive.id,
  };
  const res = deserialize(serialize(save));
  assert.equal(res.state.invitations.active, null, 'load cleared the dead invite');
  assert.equal(res.state.occupancy, null, 'load cleared the dead occupant');
  assert.equal(
    res.state.playerLocation,
    'nook_interior',
    'player not teleported on load (doc 16 LR2-16)',
  );
});

test('LRTL-04 [PIN] accepted live invite outdoors: tick never creates occupancy; load keeps it (doc 14 §4.2)', () => {
  const world = freshWorld();
  stageInvitation(world); // accepted, live, player outdoors, no occupancy
  world.playerLocation = 'exterior';
  world.playerPos = { x: 0, z: 1.5 };

  for (let i = 0; i < 5; i++) tick(world);
  assert.ok(world.invitations.active, 'live accepted invite survives ticks outdoors');
  assert.equal(world.invitations.active?.status, 'accepted');
  assert.equal(world.occupancy, null, 'stepSimulationInPlace never creates occupants');
  assert.equal(world.activeActivity, null, 'no phantom active activity from the tick');

  const res = deserialize(serialize(world));
  assert.equal(res.state.invitations.active?.status, 'accepted', 'restored accepted');
  assert.equal(res.state.occupancy, null, 'still no occupant outdoors');
});

test('LRTL-05 [PIN] host drift is NOT owned by the tick; the enter reducer expires with host_unavailable (doc 21 §1.4 Decision A, doc 16 LR2-03)', () => {
  const world = freshWorld();
  stageInvitation(world); // accepted + live
  const porch = (NOOK_PORCH_EXIT_POS as { x: number; z: number }) ?? { x: -10.8, z: 2.4 };
  world.playerPos = { ...porch };

  // Pull Nora into an exterior encounter AFTER accept (dynamic drift).
  world.activeEncounters = [
    {
      id: 'enc_nora_busy',
      participants: ['nora', 'clara'],
      topicTag: 'book_chat',
      summary: 'Nora & Clara: Morning books',
      spots: [
        { x: 0, z: 0 },
        { x: 1, z: 0 },
      ],
      startedMinute: 540,
      endsMinute: 560,
    },
  ];

  // The TICK does not check host availability — it only enforces window/day
  // expiry (expireInvitationsInPlace has no schedule/encounter input).
  tick(world);
  assert.ok(
    world.invitations.active,
    'tick leaves a live invite alone even when the host is busy (enter path owns drift)',
  );

  // The ENTER reducer owns the visible expiry (doc 16 LR2-03).
  const entered = (enterNookAction as (w: unknown) => {
    nextWorld: unknown;
    toast?: string;
  })(world);
  const nw = entered.nextWorld as unknown as WorldLike;
  assert.equal(nw.playerLocation, 'nook_interior', 'door still opens');
  assert.equal(nw.occupancy, null, 'no occupant for a busy host');
  assert.equal(nw.invitations.active, null, 'invite expired on enter');
  const last = nw.invitations.history.at(-1);
  assert.equal(last?.outcome, 'expired');
  assert.equal(last?.reason, 'host_unavailable');
  assert.ok(
    typeof entered.toast === 'string' && entered.toast.includes('Nora'),
    'player-visible line (doc 14 §2.3 empty-visit prevention)',
  );
  assert.equal(nw.memories.length, (world.memories as Array<unknown>).length, 'no memory reward');
});

test('LRTL-06 [PIN] orphan occupancy / orphan activeActivity: cleared by tick AND by load (doc 14 §4.3, doc 16 LR1-15/15b)', () => {
  const occId = 'nook_chair';
  // (a) load path: crafted save with active === null but occupancy + activeActivity set.
  const base = freshWorld();
  const raw = JSON.stringify({
    ...base,
    minuteOfDay: 700,
    playerLocation: 'nook_interior',
    invitations: { active: null, history: [], lastOfferDayByHost: {} },
    occupancy: {
      residentId: 'nora',
      location: 'nook_interior',
      stationId: occId,
      localPos: { x: -10.8, z: -0.6 },
      facing: 0,
      invitationId: 'ghost_invite',
    },
    activeActivity: { activityId: ACTIVITY, invitationId: 'ghost_invite' },
  });
  const res = deserialize(raw);
  assert.equal(res.state.occupancy, null, 'load: orphan occupancy cleared (LR1-15)');
  assert.equal(res.state.activeActivity, null, 'load: orphan activeActivity cleared (LR1-15b)');

  // (b) tick path: same orphans in memory, no active invite.
  const world = freshWorld();
  world.minuteOfDay = 700;
  world.invitations = { active: null, history: [], lastOfferDayByHost: {} };
  world.occupancy = {
    residentId: 'nora',
    location: 'nook_interior',
    stationId: occId,
    localPos: { x: -10.8, z: -0.6 },
    facing: 0,
    invitationId: 'ghost_invite',
  };
  world.activeActivity = { activityId: ACTIVITY, invitationId: 'ghost_invite' };
  tick(world);
  assert.equal(world.occupancy, null, 'tick: orphan occupancy cleared');
  assert.equal(world.activeActivity, null, 'tick: orphan activeActivity cleared');
});

test('LRTL-07 [PIN] load-then-tick archives exactly once across the window end (LR1-13 analog)', () => {
  const world = freshWorld();
  const active = stageInvitation(world); // accepted, window [540, 719]
  const res = deserialize(serialize(world)); // mid-visit round-trip
  assert.equal(res.state.invitations.active?.id, active.id, 'live invite restored');

  const loaded = res.state;
  loaded.minuteOfDay = 717; // minutes before the end
  loaded.playerLocation = 'nook_interior';
  loaded.occupancy = {
    residentId: 'nora',
    location: 'nook_interior',
    stationId: 'nook_chair',
    localPos: { x: -10.8, z: -0.6 },
    facing: 0,
    invitationId: active.id,
  };

  tick(loaded); // 719 — window end is INCLUSIVE (doc 14 §2.4)
  assert.equal(loaded.invitations.active?.id, active.id, 'still live at the inclusive window end');
  assert.ok(loaded.occupancy, 'mid-visit occupancy restored across load at the boundary');

  tick(loaded); // 721 — past the end
  assert.equal(loaded.invitations.active, null, 'expired by the tick after load');
  const rows = loaded.invitations.history.filter((h) => h.outcome === 'expired');
  assert.equal(rows.length, 1, 'exactly one expired row — no duplicate from load+tick');
  assert.equal(loaded.occupancy, null, 'occupancy cleared');
  assert.equal(loaded.activeActivity, null, 'activeActivity cleared');
});

// ============================================================================
// §2 — Nora invitation discoverability (measured post-gate policy)
// ============================================================================

test('NR-01 once eligible, the Nora invitation offer surfaces within 2 ordinary interactions (guards the restoration)', () => {
  const build = buildResidentDialogue as unknown as (
    id: string,
    w: unknown,
    phase: string,
  ) => { topicId: string; nodes: Record<string, { choices: Array<Record<string, unknown>> }> };
  const apply = applyDialogueChoice as (
    w: unknown,
    session: unknown,
    choice: unknown,
  ) => { nextWorld: unknown };
  const isAvailable = isChoiceAvailable as (c: unknown, w: unknown, rid?: string) => boolean;
  const eligible = (w: WorldLike): boolean =>
    (canOfferInvitation as (w: unknown, h: string, a: string) => { eligible: boolean })(
      w,
      'nora',
      ACTIVITY,
    ).eligible;
  const phase = (w: WorldLike): string => getTimePhase(w.minuteOfDay);

  // Ordinary play: fresh game, no QA staging beyond the intro postcard beat.
  // flags.foundPostcard = true is required staging because the MEASURED fresh
  // behavior (probe-competitors.ts, preserved in build10-lr-recovery doc 07) is
  // that quest_nora_postcard (quest_milestone, p45 → score 145, condition
  // {flagsFalse:['foundPostcard']}) dominates every Nora conversation until the
  // postcard beat resolves — the invitation topic (86+8=94) can never beat it.
  // That is the designed story gate, not a defect; the desired policy under test
  // is the post-gate ramp: two warm chats per day, sleep via the production day
  // roll; once canOfferInvitation flips true (affinity 40 → tier friendly on day
  // 4 with SMALLTALK_FIRST_DAILY_AFFINITY=10/day), the offer must surface within
  // 2 interactions, and within 10 interactions overall.
  let world = freshWorld();
  (world.flags as Record<string, boolean>).foundPostcard = true;
  let interactions = 0;
  let surfacedAt = -1;
  let eligibilityAt = -1;
  const trace: string[] = [];

  outer: for (let day = 1; day <= 8; day++) {
    for (let talk = 0; talk < 2; talk++) {
      interactions += 1;
      if (eligibilityAt < 0 && eligible(world)) eligibilityAt = interactions;
      const session = build('nora', world, phase(world));
      trace.push(`d${day}i${talk + 1}:${session.topicId}`);
      if (session.topicId === 'inv_nora_offer_reading') {
        surfacedAt = interactions;
        break outer;
      }
      const root = session.nodes['root'];
      // An ordinary player picks a warm reply: prefer the first available
      // choice with a positive trust delta (drives the +10/day affinity ramp),
      // falling back to the first available choice.
      const choices = root?.choices ?? [];
      const choice =
        choices.find((c) => isAvailable(c, world, 'nora') && ((c as { trustDelta?: number }).trustDelta ?? 0) > 0) ??
        choices.find((c) => isAvailable(c, world, 'nora'));
      if (!choice) break outer;
      world = apply(world, session, choice).nextWorld as unknown as WorldLike;
    }
    world = advanceToNextDay(world as never) as unknown as WorldLike;
  }

  assert.ok(
    surfacedAt > 0,
    `DESIRED POLICY: inv_nora_offer_reading must be reachable by ordinary dialogue; ` +
      `measured trace: ${trace.join(' ')}`,
  );
  assert.ok(interactions <= 10, `reachable within 10 ordinary interactions (took ${surfacedAt})`);
  assert.ok(
    eligibilityAt > 0 && surfacedAt - eligibilityAt <= 2,
    `surfaces within 2 interactions of eligibility (eligible@${eligibilityAt}, surfaced@${surfacedAt})`,
  );
});
