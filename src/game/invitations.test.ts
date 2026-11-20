/**
 * LR-1 acceptance tests — Invitation foundation (test-first).
 *
 * Spec of record: docs/architecture/living-relationships/14-revised-architecture.md
 * Test plan:      docs/architecture/living-relationships/16-lr1-lr2-acceptance-test-plan.md
 * Binding notes:  15-implementation-readiness-checklist.md §3; 19-final-acceptance-readiness-review.md
 *
 * Scope of this change (LR-1 test authoring only):
 *  - NO production code is implemented here. The proposed invitation owner module
 *    `src/game/invitations.ts` (doc 14 §1/§2) does not exist yet, so lifecycle cases
 *    (LR1-01..10, 13, 20, 23) fail at module resolution with an explicit
 *    "MISSING LR-1 PRODUCTION" report naming the required exports.
 *  - Path cases (LR1-05, LR1-19) deliberately do NOT call `expireInvitationsAt` from
 *    the test (doc 16 §0: "Calling expireInvitationsAt from a test does not satisfy
 *    LR1-05 or LR1-19"). They target the shared minute-advance entries named in
 *    doc 16 §0.1 that the +2h handler (App.tsx handleAdvanceTwoHours) and the sim
 *    tick must use after LR wiring.
 *  - Cases driven entirely by existing production paths (LR1-11, 11b, 12 via
 *    advanceToNextDay; LR1-19 via stepSimulationInPlace) fail at assertion level
 *    until the LR wiring lands inside those paths (doc 14 §3: "This call is part of
 *    the function, not a follow-up tick").
 *  - No WorldState schema or migration code is modified: the proposed LR state
 *    slices (world.invitations / world.occupancy / world.teaching / world.activeActivity,
 *    doc 16 §0.1) are handled through loose test-local interfaces and fixture helpers
 *    that only stage doc-16 preconditions — they never emulate production behavior.
 *  - LR2-11 is listed in doc 16 §5 for this file but is an LR-2 gate; it is out of
 *    scope for this LR-1-only change.
 *
 * Result-shape adapters (asOk / asWorld) are intentionally tolerant between the two
 * plausible production conventions ({ok, world?} reducer returns vs. in-place
 * mutation) until the implementation fixes a shape. The assertions themselves bind
 * to the doc-16 observables, not to either convention.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreshWorldState, advanceToNextDay } from './storage';
import { isResidentGuarded } from './relationships';
import { stepSimulationInPlace } from './simulation';
import { NEXT_DAY_WAKE_MINUTE } from './time';
import { NOOK_PORCH_EXIT_POS } from './bookNook';
import type { WorldState } from './types';

// ---------------------------------------------------------------------------
// Loose test-side views of the PROPOSED LR-1 slices (doc 14 §2/§4, doc 16 §0.1).
// These interfaces are test fixtures only — they do not modify WorldState.
// ---------------------------------------------------------------------------

interface LrInvitation {
  id?: string;
  status?: string;
  hostId?: string;
  activityId?: string;
  offeredDay?: number;
  expiresDay?: number;
  windowStartMinute?: number;
  windowEndMinute?: number;
}

interface LrHistoryEntry {
  outcome?: string;
  hostId?: string;
  day?: number;
  invitationId?: string;
  reason?: string;
}

interface LrInvitationState {
  active?: LrInvitation | null;
  history?: LrHistoryEntry[];
  lastOfferDayByHost?: Record<string, number>;
}

interface LrWorld extends WorldState {
  invitations?: LrInvitationState;
  occupancy?: unknown;
  teaching?: { known?: unknown[] };
  activeActivity?: { activityId?: string } | null;
}

// ---------------------------------------------------------------------------
// Fixture helpers (deterministic; stage doc-16 preconditions only)
// ---------------------------------------------------------------------------

const LR_INVITE_ID = 'lr_test_invite_1';
const LR_ACTIVITY_ID = 'share_featured_reading';

/** Nora at 'friendly' (affinity 60 → hearts 3.0 per getRelationshipTier), reliable
 *  enough that the existing isResidentGuarded gate is open (doc 16 LR1-01 preconditions). */
function makeFriendlyNora(world: LrWorld): void {
  const rel = world.playerRelations.nora;
  rel.affinity = 60;
  rel.reliability = 25;
  rel.negativeCount = 0;
  world.residents.nora.met = true;
}

function craftInvitation(world: LrWorld, overrides: Partial<LrInvitation> = {}): LrInvitation {
  return {
    id: LR_INVITE_ID,
    status: 'offered',
    hostId: 'nora',
    activityId: LR_ACTIVITY_ID,
    offeredDay: world.day,
    expiresDay: world.day,
    windowStartMinute: 600,
    windowEndMinute: 780,
    ...overrides,
  };
}

/** Attach the proposed invitations slice in the doc 14 §2.1 shape: the active slot
 *  plus (capped later by production) history, with lastOfferDayByHost stamped at
 *  offer time when an active invite exists. */
function attachInvitationState(
  world: LrWorld,
  active: LrInvitation | null,
  history: LrHistoryEntry[] = [],
): LrInvitationState {
  const lastOfferDayByHost: Record<string, number> = {};
  if (active && active.hostId) lastOfferDayByHost[active.hostId] = world.day;
  const state: LrInvitationState = { active, history, lastOfferDayByHost };
  world.invitations = state;
  return state;
}

// ---------------------------------------------------------------------------
// Tolerant result/emptiness adapters (see file header note)
// ---------------------------------------------------------------------------

type LrModule = Record<string, unknown>;

/** Call signatures the doc-16 cases exercise, in doc 14 §1/§2 order. Result types stay
 *  `unknown` on purpose: doc 16 leaves the return convention open between a
 *  `{ ok, world }` reducer return and in-place mutation, and the asOk/asWorld adapters
 *  bind the assertions to doc-16 observables instead of either convention. The world
 *  parameter is the test-side LrWorld view (WorldState plus the proposed LR slices);
 *  the production entry points themselves receive the plain WorldState. */
interface LrInvitationsApi {
  offerInvitation(world: LrWorld, hostId: string, activityId: string): unknown;
  acceptInvitation(world: LrWorld): unknown;
  declineInvitation(world: LrWorld): unknown;
  expireInvitationsAt(world: LrWorld, day: number, minute: number): unknown;
  isInvitationLive(invitation: unknown, day: number, minute: number): unknown;
  /** Doc 16 §0.1 (illustrative name): the single minute-advance entry the +2h handler
   *  and the sim tick must route through after LR wiring. */
  advanceClockAndReconcile(world: LrWorld, deltaMinutes: number): unknown;
}

function asOk(result: unknown): boolean | undefined {
  if (typeof result === 'boolean') return result;
  if (result && typeof result === 'object' && 'ok' in (result as Record<string, unknown>)) {
    return Boolean((result as Record<string, unknown>).ok);
  }
  return undefined;
}

function asWorld(result: unknown, fallback: LrWorld): LrWorld {
  if (result && typeof result === 'object') {
    const r = result as Record<string, unknown>;
    if ('world' in r && r.world && typeof r.world === 'object') return r.world as LrWorld;
    if ('minuteOfDay' in r) return result as LrWorld;
  }
  return fallback;
}

function activeIsNull(state: LrInvitationState | undefined): boolean {
  return !state || state.active === null || state.active === undefined;
}

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

function activeActivityIsEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'object') {
    const a = value as Record<string, unknown>;
    return a.activityId === null || a.activityId === undefined;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Proposed-module loader (doc 16 §0.1)
// ---------------------------------------------------------------------------

const INVITATIONS_MODULE_SPECIFIER = './invitations';

/** Doc 14 §1/§2 owner exports the lifecycle cases call. `advanceClockAndReconcile` is
 *  doc 16 §0.1's (illustrative) name for the single minute-advance entry that both the
 *  +2h handler and the sim tick must reach expiry through; doc 19 §"Remaining
 *  Contradictions" #2 accepts "any equivalent shared entry". If the implementation
 *  exports a different name, update this list to the implementation's exports — the
 *  assertions stay bound to doc-16 observables. */
const REQUIRED_INVITATION_EXPORTS = [
  'offerInvitation',
  'acceptInvitation',
  'declineInvitation',
  'expireInvitationsAt',
  'isInvitationLive',
  'advanceClockAndReconcile',
] as const;

async function loadInvitationsModule(): Promise<LrInvitationsApi> {
  let mod: LrModule | undefined;
  try {
    mod = (await import(INVITATIONS_MODULE_SPECIFIER)) as LrModule;
  } catch {
    // Module absent — the expected test-first state until LR-1 production lands.
  }
  if (!mod) {
    assert.fail(
      'MISSING LR-1 PRODUCTION: src/game/invitations.ts does not exist yet ' +
        '(doc 14 §1 ownership table, §2 lifecycle; doc 16 §0.1). The LR-1 invitation ' +
        'lifecycle is not implemented, so these acceptance tests fail by design. ' +
        'Do not satisfy this from the test side.',
    );
  }
  const m: LrModule = mod;
  const missing = REQUIRED_INVITATION_EXPORTS.filter((name) => typeof m[name] !== 'function');
  if (missing.length > 0) {
    assert.fail(
      'MISSING LR-1 PRODUCTION EXPORTS in src/game/invitations.ts: ' +
        missing.join(', ') +
        ' (doc 14 §1; doc 16 §0.1).',
    );
  }
  // Every required export has just been validated to be a function, so the loose
  // record view is narrowed to the callable API the cases below rely on.
  return mod as unknown as LrInvitationsApi;
}

/** LR1-23 binds the history cap to the implementation's EXPORTED constant (doc 19:
 *  "it must be bound to the implementation's exported cap before that test is
 *  written"). The literal 12 from superseded doc 03 is NOT architectural law. */
function resolveInvitationHistoryCap(mod: LrInvitationsApi | LrModule): number {
  const entries = Object.entries(mod as LrModule);
  const preferred = ['INVITATION_HISTORY_CAP', 'MAX_INVITATION_HISTORY', 'INVITATION_HISTORY_LIMIT'];
  for (const name of preferred) {
    const v = (mod as LrModule)[name];
    if (typeof v === 'number' && Number.isInteger(v) && v >= 1) return v;
  }
  for (const [name, v] of entries) {
    if (
      /HISTORY/i.test(name) &&
      /(CAP|LIMIT|MAX)/i.test(name) &&
      typeof v === 'number' &&
      Number.isInteger(v) &&
      v >= 1
    ) {
      return v;
    }
  }
  assert.fail(
    'MISSING LR-1 PRODUCTION CONTRACT: src/game/invitations.ts must export its history ' +
      'cap constant (e.g. INVITATION_HISTORY_CAP) so LR1-23 can bind to it — ' +
      'doc 19 "Remaining Contradictions and Unsupported Assumptions" #1.',
  );
}

// ---------------------------------------------------------------------------
// §1 — Invitation lifecycle (doc 16)
// ---------------------------------------------------------------------------

test('LR1-01: offer creates a single active invitation', async () => {
  const mod = await loadInvitationsModule();
  const world = createFreshWorldState() as unknown as LrWorld;
  makeFriendlyNora(world);

  const result = mod.offerInvitation(world, 'nora', LR_ACTIVITY_ID);
  const next = asWorld(result, world);
  const state = next.invitations;
  assert.ok(state, 'proposed invitations slice must exist after a successful offer');
  assert.equal(state?.active?.status, 'offered', 'active.status === offered');
  assert.equal(state?.active?.hostId, 'nora', 'active invite is the Nora offer');
  assert.equal(
    state?.lastOfferDayByHost?.nora,
    world.day,
    'lastOfferDayByHost stamped at offer time (doc 14 §2.1)',
  );
  assert.equal(state?.history?.length ?? 0, 0, 'history unchanged by a fresh offer');
});

test('LR1-02: second offer is rejected while one is active', async () => {
  const mod = await loadInvitationsModule();
  const world = createFreshWorldState() as unknown as LrWorld;
  makeFriendlyNora(world);

  const first = asWorld(mod.offerInvitation(world, 'nora', LR_ACTIVITY_ID), world);
  const firstActive = first.invitations?.active;
  assert.ok(firstActive, 'LR1-01 precondition: first offer exists');

  const result = mod.offerInvitation(first, 'clara', LR_ACTIVITY_ID);
  assert.equal(asOk(result), false, 'second offer must be rejected (ok: false)');
  const after = asWorld(result, first);
  assert.equal(
    after.invitations?.active?.id,
    firstActive?.id,
    'active slot still holds the Nora invite (not replaced)',
  );
  assert.equal(after.invitations?.active?.hostId, 'nora', 'still exactly one active invite');
  assert.equal(
    after.invitations?.lastOfferDayByHost?.clara,
    undefined,
    'Clara lastOfferDayByHost untouched by the rejected offer',
  );
});

test('LR1-03: accept keeps the slot non-terminal', async () => {
  const mod = await loadInvitationsModule();
  const world = createFreshWorldState() as unknown as LrWorld;
  makeFriendlyNora(world);

  const offered = asWorld(mod.offerInvitation(world, 'nora', LR_ACTIVITY_ID), world);
  const affinityBefore = offered.playerRelations.nora.affinity;
  const historyLenBefore = offered.invitations?.history?.length ?? 0;

  const result = mod.acceptInvitation(offered);
  const accepted = asWorld(result, offered);
  assert.equal(accepted.invitations?.active?.status, 'accepted', 'status is accepted');
  assert.ok(!activeIsNull(accepted.invitations), 'active slot still occupied (doc 14 §2.2)');
  assert.equal(
    accepted.invitations?.history?.length ?? 0,
    historyLenBefore,
    'accept is not a terminal path: history unchanged',
  );
  assert.equal(
    accepted.playerRelations.nora.affinity,
    affinityBefore,
    'accept grants no affinity (doc 14 §5.2)',
  );
});

test('LR1-04: decline archives, clears, and rewards nothing', async () => {
  const mod = await loadInvitationsModule();
  const world = createFreshWorldState() as unknown as LrWorld;
  makeFriendlyNora(world);

  const offered = asWorld(mod.offerInvitation(world, 'nora', LR_ACTIVITY_ID), world);
  const affinityBefore = offered.playerRelations.nora.affinity;
  const dailyBefore = offered.playerRelations.nora.dailyAffinityGained;
  const memoriesBefore = offered.memories.length;
  const noraMemoriesBefore = offered.npcMemories.nora?.length ?? 0;
  const teachingBefore = offered.teaching?.known?.length ?? 0;
  const historyLenBefore = offered.invitations?.history?.length ?? 0;

  const result = mod.declineInvitation(offered);
  const after = asWorld(result, offered);
  assert.ok(activeIsNull(after.invitations), 'active === null after decline (atomic archive)');
  const hist = after.invitations?.history ?? [];
  assert.equal(hist.length, historyLenBefore + 1, 'terminal path archives exactly one entry');
  assert.equal(hist[hist.length - 1]?.outcome, 'declined', 'history outcome is declined');
  assert.equal(after.playerRelations.nora.affinity, affinityBefore, 'decline grants no affinity');
  assert.equal(
    after.playerRelations.nora.dailyAffinityGained,
    dailyBefore,
    'dailyAffinityGained untouched (recordPlayerTalkAffinity not fed a positive delta)',
  );
  assert.equal(after.memories.length, memoriesBefore, 'no journal memory on decline');
  assert.equal(after.npcMemories.nora?.length ?? 0, noraMemoriesBefore, 'no host NPC memory on decline');
  assert.equal(after.teaching?.known?.length ?? 0, teachingBefore, 'no knowledge grant on decline');
});

test('LR1-05: +2h path expires across the window (fail-closed: no direct helper bypass)', async () => {
  const mod = await loadInvitationsModule();
  const world = createFreshWorldState() as unknown as LrWorld;
  makeFriendlyNora(world);
  attachInvitationState(world, craftInvitation(world, { status: 'accepted' }));
  world.minuteOfDay = 779;
  const affinityBefore = world.playerRelations.nora.affinity;

  // The entry handleAdvanceTwoHours (App.tsx) must call after LR wiring (doc 16 §0.1).
  // The test must NOT call expireInvitationsAt itself (doc 16 §0).
  const result = mod.advanceClockAndReconcile(world, 120);
  const after = asWorld(result, world);

  assert.equal(after.minuteOfDay, 899, 'minuteOfDay advanced by 120 via advanceSimulationClock');
  const live = asOk(
    mod.isInvitationLive(after.invitations?.active ?? {}, after.day, after.minuteOfDay),
  );
  assert.equal(live, false, 'invite is no longer live past windowEndMinute (doc 14 §2.4)');
  assert.ok(
    activeIsNull(after.invitations),
    'MISSING LR-1 WIRING: the +2h minute-advance entry must reconcile invitation expiry',
  );
  const hist = after.invitations?.history ?? [];
  assert.equal(hist[hist.length - 1]?.outcome, 'expired', 'terminal path archived expired');
  assert.ok(occupancyIsEmpty(after.occupancy), 'occupancy empty after expiry');
  assert.equal(after.playerRelations.nora.affinity, affinityBefore, 'no affinity change on expiry');
});

test('LR1-06: minute equal to window end is live (inclusive end)', async () => {
  const mod = await loadInvitationsModule();
  const world = createFreshWorldState() as unknown as LrWorld;
  const inv = craftInvitation(world, { status: 'accepted' }); // window 600..780, expiresDay = world.day
  const live = asOk(mod.isInvitationLive(inv, world.day, 780));
  assert.equal(live, true, 'inclusive window end (doc 16 LR1-06)');
});

test('LR1-07: minute equal to window start is live (inclusive start)', async () => {
  const mod = await loadInvitationsModule();
  const world = createFreshWorldState() as unknown as LrWorld;
  const inv = craftInvitation(world, { status: 'accepted' });
  const live = asOk(mod.isInvitationLive(inv, world.day, 600));
  assert.equal(live, true, 'inclusive window start (doc 16 LR1-07)');
});

test('LR1-08: offer rejected when host is guarded', async () => {
  const mod = await loadInvitationsModule();
  const world = createFreshWorldState() as unknown as LrWorld;
  makeFriendlyNora(world);
  world.playerRelations.nora.reliability = 19; // < 20 → guarded per isResidentGuarded
  // Precondition self-check against the existing production gate:
  assert.equal(
    isResidentGuarded(world.playerRelations.nora),
    true,
    'fixture must genuinely trip isResidentGuarded (doc 16 LR1-08 preconditions)',
  );

  const result = mod.offerInvitation(world, 'nora', LR_ACTIVITY_ID);
  assert.equal(asOk(result), false, 'guarded host must not be offered (doc 14 §2.3 gate 3)');
  assert.ok(activeIsNull(asWorld(result, world).invitations), 'no invite created');
});

test('LR1-09: offer rejected inside the 2-day spacing window', async () => {
  const mod = await loadInvitationsModule();
  const world = createFreshWorldState() as unknown as LrWorld;
  makeFriendlyNora(world);
  attachInvitationState(world, null);
  world.invitations!.lastOfferDayByHost = { nora: world.day - 1 }; // min days = 2 (doc 14 §2.3 gate 2)

  const result = mod.offerInvitation(world, 'nora', LR_ACTIVITY_ID);
  assert.equal(asOk(result), false, 'day - 1 is inside the 2-day spacing window');
  assert.ok(activeIsNull(asWorld(result, world).invitations), 'no invite created');
});

test('LR1-09b: spacing boundary (exactly min days) is allowed', async () => {
  const mod = await loadInvitationsModule();
  const world = createFreshWorldState() as unknown as LrWorld;
  makeFriendlyNora(world);
  attachInvitationState(world, null);
  world.invitations!.lastOfferDayByHost = { nora: world.day - 2 };

  const result = mod.offerInvitation(world, 'nora', LR_ACTIVITY_ID);
  assert.equal(asOk(result), true, 'equal to min days succeeds (doc 16 LR1-09b)');
  const after = asWorld(result, world);
  assert.equal(after.invitations?.active?.status, 'offered', 'one offered invite at the boundary');
});

test('LR1-10: unavailable NPC cannot be invited (distant slot or active encounter)', async () => {
  const mod = await loadInvitationsModule();

  // Variant A — Nora's afternoon schedule slot (West Bench, residents.ts) sits ~7.6 m
  // from her homePos (-10.8, -0.6): outside the proposed 6 m home radius (doc 14 §2.3 gate 4).
  const worldA = createFreshWorldState() as unknown as LrWorld;
  makeFriendlyNora(worldA);
  worldA.minuteOfDay = 800; // afternoon → West Bench target
  const resultA = mod.offerInvitation(worldA, 'nora', LR_ACTIVITY_ID);
  assert.equal(asOk(resultA), false, 'distant schedule slot must reject the offer');
  const afterA = asWorld(resultA, worldA);
  assert.ok(activeIsNull(afterA.invitations), 'no invite whose window cannot be honored');
  const reasonA = (resultA as { reason?: string } | undefined)?.reason;
  if (reasonA !== undefined) {
    assert.match(String(reasonA), /host_unavailable/i, 'reason names host_unavailable (or equivalent)');
  }

  // Variant B — host inside an active exterior social encounter (doc 14 §2.3 gate 5).
  // Morning slot (minute 400) targets her homePos, so the schedule gate alone passes.
  const worldB = createFreshWorldState() as unknown as LrWorld;
  makeFriendlyNora(worldB);
  worldB.minuteOfDay = 400;
  worldB.activeEncounters = [
    {
      id: 'lr10_test_encounter',
      participants: ['nora', 'clara'],
      topicTag: 'almanac',
      summary: 'Nora and Clara compare festival notes by the fountain.',
      spots: [
        { x: 0, z: 0 },
        { x: 0.8, z: 0 },
      ],
      startedMinute: 380,
      endsMinute: 420,
    },
  ];
  const resultB = mod.offerInvitation(worldB, 'nora', LR_ACTIVITY_ID);
  assert.equal(asOk(resultB), false, 'host inside an active encounter must reject the offer');
  assert.ok(activeIsNull(asWorld(resultB, worldB).invitations), 'no invite created');
});

// ---------------------------------------------------------------------------
// §2 — Day advancement and sleep (existing production path: advanceToNextDay)
// ---------------------------------------------------------------------------

test('LR1-11: sleep archives an accepted invite and clears occupancy (nook variant)', () => {
  const world = createFreshWorldState() as unknown as LrWorld;
  makeFriendlyNora(world);
  attachInvitationState(world, craftInvitation(world, { status: 'accepted' }));
  // Player inside the nook during the visit (doc 16 LR1-11: "may be ... inside the nook")
  world.playerLocation = 'nook_interior';
  world.exteriorPlayerPos = { ...NOOK_PORCH_EXIT_POS };
  world.occupancy = {
    residentId: 'nora',
    location: 'nook_interior',
    stationId: 'nook_chair',
    localPos: { x: -10.8, z: -0.6 },
    facing: 0,
    invitationId: LR_INVITE_ID,
  };
  world.activeActivity = { activityId: LR_ACTIVITY_ID };
  world.nookState = { ...world.nookState!, shelfBrowsedDay: 3, booksRead: 2 };
  const runtimeBefore = world.npcRuntime;
  const dayBefore = world.day;

  const next = advanceToNextDay(world as WorldState) as unknown as LrWorld;

  assert.equal(next.day, dayBefore + 1, 'day rolled');
  assert.equal(next.minuteOfDay, NEXT_DAY_WAKE_MINUTE, 'wake at NEXT_DAY_WAKE_MINUTE (existing)');
  // doc 14 §3: reconcile runs inside advanceToNextDay. The following assertions fail
  // until that wiring exists — the invite currently survives the day roll untouched.
  assert.ok(next.invitations, 'invitations slice survives the day roll');
  assert.ok(
    activeIsNull(next.invitations),
    'MISSING LR-1 WIRING: advanceToNextDay must archive the active invite via ' +
      'reconcileLivingRelationshipsOnDayAdvance (doc 14 §3; doc 16 LR1-11)',
  );
  assert.ok(
    (next.invitations?.history ?? []).some((e) => e.outcome === 'expired'),
    'history contains an expired entry from the day roll',
  );
  assert.ok(occupancyIsEmpty(next.occupancy), 'day advance clears occupancy (doc 14 §3 step 2)');
  assert.ok(
    activeActivityIsEmpty(next.activeActivity),
    'day advance nulls activeActivity (doc 14 §3 step 3)',
  );
  // Existing behaviors stay intact:
  assert.equal(next.playerLocation, 'exterior', 'existing nook ejection');
  assert.deepEqual(next.playerPos, NOOK_PORCH_EXIT_POS, 'player lands on the nook porch');
  assert.notEqual(next.npcRuntime, runtimeBefore, 'npcRuntime replaced (existing)');
  assert.equal(next.nookState?.shelfBrowsedDay, 3, 'nookState day stamps unchanged (existing)');
  assert.equal(next.nookState?.booksRead, 2, 'nookState counters unchanged (existing)');
});

test('LR1-11b: sleep archives an offered (not accepted) invite without reward', () => {
  const world = createFreshWorldState() as unknown as LrWorld;
  makeFriendlyNora(world);
  attachInvitationState(world, craftInvitation(world, { status: 'offered' }));
  const affinityBefore = world.playerRelations.nora.affinity;
  const memoriesBefore = world.memories.length;
  const noraMemoriesBefore = world.npcMemories.nora?.length ?? 0;

  const next = advanceToNextDay(world as WorldState) as unknown as LrWorld;

  assert.ok(
    activeIsNull(next.invitations),
    'MISSING LR-1 WIRING: offered invites do not survive sleep (doc 16 LR1-11b)',
  );
  assert.ok(
    (next.invitations?.history ?? []).some((e) => e.outcome === 'expired'),
    'archived expired by the day roll',
  );
  assert.equal(next.playerRelations.nora.affinity, affinityBefore, 'no affinity change');
  assert.equal(next.memories.length, memoriesBefore, 'no journal memory');
  assert.equal(next.npcMemories.nora?.length ?? 0, noraMemoriesBefore, 'no host memory');
});

test('LR1-12: sleep does not punish an expiring invite', () => {
  const world = createFreshWorldState() as unknown as LrWorld;
  makeFriendlyNora(world);
  attachInvitationState(world, craftInvitation(world, { status: 'accepted' }));
  world.playerRelations.nora.affinity = 60;
  world.playerRelations.nora.reliability = 40;
  world.playerRelations.nora.dailyAffinityGained = 12;

  const next = advanceToNextDay(world as WorldState) as unknown as LrWorld;

  // The no-punish check is only meaningful once the expire actually happened:
  assert.ok(
    activeIsNull(next.invitations) &&
      (next.invitations?.history ?? []).some((e) => e.outcome === 'expired'),
    'MISSING LR-1 WIRING: the invite must actually expire during the day roll first',
  );
  assert.equal(next.playerRelations.nora.affinity, 60, 'affinity unchanged by the expire path');
  assert.equal(next.playerRelations.nora.reliability, 40, 'reliability unchanged');
  assert.equal(
    next.playerRelations.nora.dailyAffinityGained,
    0,
    'dailyAffinityGained reset to 0 only by the existing daily reset',
  );
});

test('LR1-13: interrupted session — +2h expiry then sleep must not double-archive', async () => {
  const mod = await loadInvitationsModule();
  const world = createFreshWorldState() as unknown as LrWorld;
  makeFriendlyNora(world);
  attachInvitationState(world, craftInvitation(world, { status: 'accepted' }));
  world.minuteOfDay = 779;

  const afterClock = asWorld(mod.advanceClockAndReconcile(world, 120), world);
  assert.ok(activeIsNull(afterClock.invitations), 'first terminal step archives the invite');
  assert.ok(
    (afterClock.invitations?.history ?? []).filter((e) => e.outcome === 'expired').length === 1,
    'first step archives exactly once',
  );

  const afterSleep = advanceToNextDay(afterClock as WorldState) as unknown as LrWorld;
  const expiredRows = (afterSleep.invitations?.history ?? []).filter(
    (e) => e.outcome === 'expired',
  ).length;
  assert.equal(expiredRows, 1, 'exactly one expired row total — no duplicate from the day roll');
  assert.ok(activeIsNull(afterSleep.invitations), 'slot stays clear after sleep');
});

// ---------------------------------------------------------------------------
// §1 — Live sim clock (existing production path: stepSimulationInPlace)
// ---------------------------------------------------------------------------

test('LR1-19: live sim clock (stepSimulationInPlace) expires across the window', () => {
  const world = createFreshWorldState() as unknown as LrWorld;
  makeFriendlyNora(world);
  attachInvitationState(world, craftInvitation(world, { status: 'accepted' }));
  world.minuteOfDay = 779;
  world.playerLocation = 'nook_interior';
  world.exteriorPlayerPos = { ...NOOK_PORCH_EXIT_POS };
  world.occupancy = {
    residentId: 'nora',
    location: 'nook_interior',
    stationId: 'nook_chair',
    localPos: { x: -10.8, z: -0.6 },
    facing: 0,
    invitationId: LR_INVITE_ID,
  };

  // Existing production tick; the test must NOT call expireInvitationsAt (doc 16 LR1-19).
  // clockRateMinutesPerSec=10 over dt=0.2s advances exactly 2 in-game minutes through the
  // existing advanceSimulationClock write (simulation.ts ~620): 779 → 781, past windowEnd 780.
  stepSimulationInPlace(world as WorldState, 0.2, { clockRateMinutesPerSec: 10 });

  assert.ok(world.minuteOfDay > 780, `sim clock crossed the window end (got ${world.minuteOfDay})`);
  assert.ok(
    activeIsNull(world.invitations),
    'MISSING LR-1 WIRING: stepSimulationInPlace minute mutation must reconcile invitation ' +
      'expiry (doc 14 §2.4 call sites; doc 16 LR1-19 fail-closed)',
  );
  assert.ok(
    (world.invitations?.history ?? []).some((e) => e.outcome === 'expired'),
    'archived expired by the tick',
  );
  assert.ok(occupancyIsEmpty(world.occupancy), 'occupancy cleared by the tick reconcile');
});

// ---------------------------------------------------------------------------
// §1 — expiresDay independence + history cap
// ---------------------------------------------------------------------------

test('LR1-20: day past expiresDay is not live even inside the minute window', async () => {
  const mod = await loadInvitationsModule();
  const world = createFreshWorldState() as unknown as LrWorld;
  makeFriendlyNora(world);
  const inv = craftInvitation(world, {
    status: 'accepted',
    offeredDay: world.day - 1,
    expiresDay: world.day - 1, // day bound wins over the valid minute (doc 14 §2.4 conjunctive)
  });
  attachInvitationState(world, inv);
  world.minuteOfDay = 700; // inside [600, 780]

  const live = asOk(mod.isInvitationLive(inv, world.day, world.minuteOfDay));
  assert.equal(live, false, 'expired day wins over a valid minute (doc 16 LR1-20)');

  // Following archive call (doc 16 LR1-20: "A following expireInvitationsAt archives
  // expired and nulls active"). Predicate-arg order per doc 14 §2.4 (inv, day, minute);
  // adjust the call if the implementation names its parameters differently.
  const result = mod.expireInvitationsAt(world, world.day, world.minuteOfDay);
  const after = asWorld(result, world);
  assert.ok(activeIsNull(after.invitations), 'expiry archived and nulled the active slot');
  assert.ok(
    (after.invitations?.history ?? []).some((e) => e.outcome === 'expired'),
    'history gained the expired entry',
  );
});

test('LR1-23: history cap holds on write — oldest dropped, newest kept', async () => {
  const mod = await loadInvitationsModule();
  const cap = resolveInvitationHistoryCap(mod);

  const world = createFreshWorldState() as unknown as LrWorld;
  makeFriendlyNora(world);
  const seeded: LrHistoryEntry[] = Array.from({ length: cap }, (_, i) => ({
    outcome: 'expired',
    hostId: 'nora',
    day: i + 1,
    invitationId: `lr_hist_seed_${i}`,
  }));
  attachInvitationState(world, craftInvitation(world, { status: 'offered' }), seeded);
  assert.equal(world.invitations?.history?.length, cap, 'fixture seeded exactly to the exported cap');

  // One more terminal entry via the owner (doc 16 LR1-23: "Decline or expire one more invite").
  const result = mod.declineInvitation(world);
  const after = asWorld(result, world);
  const hist = after.invitations?.history ?? [];
  assert.equal(hist.length, cap, 'history length stays at the cap');
  assert.ok(
    !hist.some((e) => e.invitationId === 'lr_hist_seed_0'),
    'oldest entry dropped',
  );
  assert.ok(hist.some((e) => e.invitationId === 'lr_hist_seed_1'), 'next-oldest retained');
  assert.ok(hist.some((e) => e.outcome === 'declined'), 'new terminal entry present');
  assert.ok(activeIsNull(after.invitations), 'active cleared by the terminal path');
});
