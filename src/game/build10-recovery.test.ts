/**
 * ============================================================================
 * BUILD-10 RECOVERY REGRESSION TESTS (D-01 + D-02) — landed from the surviving
 * adversarial red-test draft (Agent 4, corrective engineering initiative).
 * ============================================================================
 *
 * Provenance: the corrective branch fix/build10-lr-reconciliation (six commits,
 * head 86ecb92) was lost with its worktree before it could be pushed; these
 * tests are the surviving behavioral contract, re-landed against the
 * re-executed restoration on top of origin/main eb95d77. Derivation policy is
 * unchanged: expected values come from (a) the Build-10 design as committed at
 * 9cde87d/6e78c8c (step-0 block + WILDS_TOPICS conditions quoted verbatim) and
 * (b) the game's own persistence semantics (sanitizeSideFlags preserves
 * arbitrary keys — see exploration.ts header). No implementation assumption
 * beyond those sources.
 *
 * Confirmed regressions this file keeps dead:
 *   D-01: stepSimulationInPlace lost the discoverExplorationInPlace step-0
 *         block when 4ad2e5f swapped the exploration import for invitations
 *         (git diff 9cde87d 4ad2e5f -- src/game/simulation.ts). The direct-call
 *         unit tests in exploration.test.ts pass either way because they bypass
 *         the tick — every gameplay expectation here is driven through
 *         stepSimulationInPlace (the production tick) ONLY.
 *   D-02: WILDS_TOPICS (src/game/dialogue/interiors/wilds.ts, topics
 *         'daily_mina_foxglove' + 'daily_rowan_beeline_checkin') were dropped
 *         from DIALOGUE_TOPICS (src/game/dialogue/index.ts) and replaced by
 *         INVITATION_TOPICS; scripts/dialogue-topics-golden.json was
 *         regenerated in the same commit, hiding the loss from
 *         dialogueRegistry.test.ts. This file pins the registry from hardcoded
 *         Build-10 expectations so regenerating the snapshot again cannot hide
 *         a registry loss, while BD10-10's second half guards the restoration
 *         against a naive full revert that would drop the LR topics.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createFreshWorldState, advanceToNextDay, serializeWorldState, deserializeWorldState, computeWorldSaveRevision } from './storage';
import { stepSimulationInPlace } from './simulation';
import type { WorldState } from './types';
import { DIALOGUE_TOPICS } from './dialogue/index';
import { WILDS_TOPICS } from './dialogue/interiors/wilds';
import { evaluateDialogueCondition, getTopicHistoryKey, isChoiceAvailable } from './dialogueEngine';
import { buildResidentDialogue } from './narrative';
import { applyDialogueChoice } from './actions';
import { getTimePhase } from './time';

// ── structural views (test-side only; mirrors invitations.test.ts style) ────
interface Vec2Like {
  x: number;
  z: number;
}
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
  simSeed: number;
  day: number;
  minuteOfDay: number;
  season: string;
  weather: string;
  playerLocation: string;
  playerPos: Vec2Like;
  exteriorPlayerPos: Vec2Like;
  sideFlags: Record<string, boolean | number | string>;
  flags: Record<string, unknown>;
  memories: Array<{ id: string; day: number; phase: string; title: string; summary: string }>;
  topicHistory: Record<
    string,
    { seenCount: number; lastSeenDay: number; lastSeenPhase: string; chosenChoiceIds: string[] }
  >;
  lastTopicByResident: Record<string, string>;
  residents: Record<
    string,
    { met: boolean; trust: number; mood: string; talkedToday: boolean; lastDialogueId: string | null }
  >;
  playerRelations: Record<string, Record<string, unknown>>;
  npcRuntime: Record<string, { position: Vec2Like; [k: string]: unknown }>;
  activeEncounters: Array<Record<string, unknown>>;
  invitations: {
    active: InvitationLike | null;
    history: Array<{ invitationId: string; outcome: string; day: number; reason?: string }>;
    lastOfferDayByHost: Record<string, number>;
  };
  occupancy: Record<string, unknown> | null;
  activeActivity: { activityId: string; invitationId: string } | null;
  storylines: Record<string, { id: string; stage: number; status: string }>;
  [k: string]: unknown;
}

// ── Build-10 fixture data (hardcoded from 9cde87d — the regression target) ──
// Coordinates quoted from EXPLORATION_DISCOVERIES at 9cde87d/4ad2e5f
// (src/game/exploration.ts). Hardcoding keeps these tests independent of the
// module that the regression broke.
const SITES = {
  marigold_lane: { sideFlag: 'explored_marigold_lane', memoryId: 'mem_explored_marigold_lane', x: 20.3, z: 5.5 },
  foxglove_rise: { sideFlag: 'explored_foxglove_rise', memoryId: 'mem_explored_foxglove_rise', x: 21.6, z: 18.5 },
  sorrel_hollow: { sideFlag: 'explored_sorrel_hollow', memoryId: 'mem_explored_sorrel_hollow', x: -20.4, z: 18.3 },
  bee_line: { sideFlag: 'explored_bee_line', memoryId: 'mem_explored_bee_line', x: 10.4, z: -18.8 },
} as const;

const EXPECTED_WILDS_TOPICS = [
  {
    id: 'daily_mina_foxglove',
    residentId: 'mina',
    category: 'daily_slice',
    priority: 14,
    condition: { requiresMet: true, sideFlagsTrue: ['explored_sorrel_hollow'], notSeenToday: true },
  },
  {
    id: 'daily_rowan_beeline_checkin',
    residentId: 'rowan',
    category: 'daily_slice',
    priority: 14,
    condition: { requiresMet: true, sideFlagsTrue: ['explored_bee_line'], notSeenToday: true },
  },
] as const;

// Nora invitation topics that 4ad2e5f introduced — a correct restoration must
// KEEP these registered while re-adding the wilds topics (guards against a
// naive full revert of src/game/dialogue/index.ts to 9cde87d).
const EXPECTED_INVITATION_TOPICS = [
  {
    id: 'inv_nora_indoor_reading',
    residentId: 'nora',
    category: 'invitation',
    priority: 40,
    condition: {
      requiresActiveInvitation: {
        hostId: 'nora',
        activityId: 'share_featured_reading',
        status: 'accepted',
        requireLive: true,
        requireIndoors: true,
      },
    },
  },
  {
    id: 'inv_nora_pending_offer',
    residentId: 'nora',
    category: 'invitation',
    priority: 10,
    condition: {
      requiresActiveInvitation: {
        hostId: 'nora',
        activityId: 'share_featured_reading',
        status: 'offered',
        requireLive: true,
      },
    },
  },
  {
    id: 'inv_nora_offer_reading',
    residentId: 'nora',
    category: 'invitation',
    priority: 8,
    condition: {
      requiresMet: true,
      requiresInvitationEligible: { hostId: 'nora', activityId: 'share_featured_reading' },
    },
  },
  {
    id: 'inv_nora_accepted_reminder',
    residentId: 'nora',
    category: 'invitation',
    priority: 6,
    condition: {
      requiresActiveInvitation: {
        hostId: 'nora',
        activityId: 'share_featured_reading',
        status: 'accepted',
        requireLive: true,
      },
    },
  },
] as const;

// ── helpers ──────────────────────────────────────────────────────────────────
function freshWorld(): WorldLike {
  return createFreshWorldState() as unknown as WorldLike;
}

/** Production tick. Default: dt 0.2s × clockRate 10 = +2 in-game minutes. */
function tick(world: WorldLike, dtSeconds = 0.2, opts: Record<string, unknown> = {}): void {
  stepSimulationInPlace(world as unknown as WorldState, dtSeconds, { clockRateMinutesPerSec: 10, ...opts } as never);
}

function exploredFlagCount(world: WorldLike): number {
  return Object.values(SITES).filter((s) => Boolean(world.sideFlags[s.sideFlag])).length;
}

function exploredMemoryIds(world: WorldLike): string[] {
  return world.memories.map((m) => m.id).filter((id) => id.startsWith('mem_explored_'));
}

function phaseOf(world: WorldLike): string {
  return getTimePhase(world.minuteOfDay);
}

/** Deterministic, order-stable JSON (sorted keys, recursively). */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
    .join(',')}}`;
}

function sha(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

/** Diagnostic-only: mirrors the documented selection formula
 *  (dialogueEngine.ts CATEGORY_PRIORITY + topic.priority + history penalties).
 *  Never used as an assertion source — failure reports only. */
const CATEGORY_PRIORITY_MIRROR: Record<string, number> = {
  quest_milestone: 100,
  invitation: 86,
  conflict_reconciliation: 84,
  personal_story: 76,
  event_reaction: 68,
  relationship_tier: 60,
  emotion_reaction: 54,
  npc_gossip: 48,
  weather_season: 42,
  daily_slice: 34,
};

function describeCandidates(
  world: WorldLike,
  residentId: string,
  topics: Array<Record<string, unknown>>,
): string {
  const evaluate = evaluateDialogueCondition as (
    cond: unknown,
    rid: string,
    w: unknown,
    phase: string,
    topicId: string,
  ) => boolean;
  const lines: string[] = [];
  for (const t of topics) {
    const id = String(t.id);
    const rid = String(t.residentId);
    if (rid !== 'any' && rid !== residentId) continue;
    const eligible = evaluate(t.condition, residentId as never, world, phaseOf(world), id);
    if (!eligible) continue;
    const cat = String(t.category);
    const score =
      (CATEGORY_PRIORITY_MIRROR[cat] ?? 0) +
      (typeof t.priority === 'number' ? t.priority : 0);
    const hist = world.topicHistory[`${residentId}:${id}`] ?? world.topicHistory[id];
    const penalty = hist
      ? hist.lastSeenDay === world.day
        ? -28
        : -Math.min(20, hist.seenCount * 5)
      : 0;
    lines.push(`${id} score=${score + penalty}`);
  }
  return lines.join('; ');
}

/** Fixture precondition: "the player has already covered everything else with
 *  this resident today". Two layers, both gameplay-reachable ordinary states:
 *  1. same-day topicHistory for every other registered topic of this resident
 *     (the engine's documented −28 same-day penalty applies), and
 *  2. the measured blocking preconditions flipped through their ordinary-play
 *     resolutions. Measured at a fresh world (probe-competitors.ts, preserved
 *     in the corrective engineering record):
 *        mina : side_mina_greenhouse_corner personal_story p16 → 92 blocks the
 *               wilds check-in (48) until sideFlags.greenhousePlanted is set —
 *               the topic's own condition is sideFlagsFalse: ['greenhousePlanted'];
 *        rowan: side_rowan_orchard_1 personal_story p8 → 84 blocks until
 *               storyline side_orchard_gathering leaves stage 0/available;
 *        nora : quest_nora_postcard quest_milestone p45 → 145 blocks until
 *               flags.foundPostcard (the intro postcard beat).
 *  Uses the production history-key rule (getTopicHistoryKey). Never an
 *  expectation source — a fixture only. */
function suppressCompetingTopics(
  world: WorldLike,
  residentId: string,
  exceptId: string,
): void {
  const topics = (DIALOGUE_TOPICS as unknown as Array<{
    id: string;
    residentId: string;
    historyScope?: string | null;
    condition?: Record<string, unknown> | null;
  }>) ?? [];
  for (const t of topics) {
    if (t.residentId !== 'any' && t.residentId !== residentId) continue;
    if (t.id === exceptId) continue;
    world.topicHistory[getTopicHistoryKey(t as never, residentId as never)] = {
      seenCount: 1,
      lastSeenDay: world.day,
      lastSeenPhase: phaseOf(world),
      chosenChoiceIds: [],
    };
    const cond = (t.condition ?? {}) as {
      requiresStoryline?: { id?: string };
      sideFlagsFalse?: string[];
      flagsFalse?: string[];
    };
    if (cond.requiresStoryline?.id) {
      world.storylines[cond.requiresStoryline.id] = {
        id: cond.requiresStoryline.id,
        stage: 9,
        status: 'completed',
      };
    }
    for (const k of cond.sideFlagsFalse ?? []) world.sideFlags[k] = true;
    for (const k of cond.flagsFalse ?? []) (world.flags as Record<string, boolean>)[k] = true;
  }
  delete world.lastTopicByResident[residentId];
}

// ============================================================================
// §1 — D-01: exploration discovery through the production tick ONLY
// ============================================================================

test('BD10-01 tick grants first-visit discovery: sideFlag + journal memory', () => {
  const world = freshWorld();
  const site = SITES.marigold_lane;
  assert.equal(exploredFlagCount(world), 0, 'precondition: nothing discovered yet');

  world.playerLocation = 'exterior';
  world.playerPos = { x: site.x, z: site.z };
  tick(world); // one ordinary unpaused tick; player never "interacts"

  assert.equal(
    world.sideFlags[site.sideFlag],
    true,
    'D-01: one tick standing in Marigold Lane must grant explored_marigold_lane ' +
      '(the 9cde87d step-0 block runs discoverExplorationInPlace inside the tick)',
  );
  const mem = world.memories.find((m) => m.id === site.memoryId);
  assert.ok(mem, 'journal memory granted');
  assert.equal(mem?.day, world.day, 'memory stamped with the current day');
  assert.equal(mem?.phase, phaseOf(world), 'memory stamped with the current phase');
  assert.equal(exploredFlagCount(world), 1, 'exactly one discovery');
  assert.deepEqual(exploredMemoryIds(world), [site.memoryId]);
});

test('BD10-02 discovery is idempotent across many ticks at the same spot', () => {
  const world = freshWorld();
  const site = SITES.sorrel_hollow;
  world.playerPos = { x: site.x, z: site.z };
  for (let i = 0; i < 60; i++) tick(world);
  assert.equal(world.sideFlags[site.sideFlag], true, 'granted within the run');
  assert.equal(
    world.memories.filter((m) => m.id === site.memoryId).length,
    1,
    'exactly one memory row — repeated ticks never duplicate',
  );
  assert.equal(exploredFlagCount(world), 1);
  assert.equal(exploredMemoryIds(world).length, 1);
});

test('BD10-03 tick reads exteriorPlayerPos while the player is indoors', () => {
  const world = freshWorld();
  const site = SITES.foxglove_rise;
  // Player went inside; their last outdoor position was on Foxglove Rise.
  world.playerLocation = 'cottage_interior';
  world.playerPos = { x: 1.5, z: 0.5 }; // interior-local coords, never a discovery site
  world.exteriorPlayerPos = { x: site.x, z: site.z };
  tick(world);
  assert.equal(
    world.sideFlags[site.sideFlag],
    true,
    'the step-0 block uses exteriorPlayerPos when playerLocation !== exterior',
  );
  assert.ok(world.memories.some((m) => m.id === site.memoryId));
});

test('BD10-04 leave/return does not re-grant; multiple sites grant independently', () => {
  const world = freshWorld();
  const a = SITES.marigold_lane;
  const b = SITES.bee_line;

  world.playerPos = { x: a.x, z: a.z };
  tick(world);
  assert.equal(world.sideFlags[a.sideFlag], true, 'site A granted on arrival');

  world.playerPos = { x: 0, z: 1.5 }; // plaza fountain — outside every zone
  for (let i = 0; i < 5; i++) tick(world);
  assert.equal(exploredFlagCount(world), 1, 'no grant while away from zones');

  world.playerPos = { x: b.x, z: b.z };
  tick(world);
  assert.equal(world.sideFlags[b.sideFlag], true, 'site B granted independently');

  world.playerPos = { x: a.x, z: a.z };
  for (let i = 0; i < 5; i++) tick(world);
  assert.equal(exploredFlagCount(world), 2, 'returning to A never re-grants');
  const ids = exploredMemoryIds(world);
  assert.equal(new Set(ids).size, 2, 'two distinct memory ids');
  assert.deepEqual(ids.sort(), [a.memoryId, b.memoryId].sort());
});

test('BD10-05 [PIN] no discovery away from zones or with prerequisites unmet', () => {
  const world = freshWorld();
  for (const [x, z] of [
    [-8.5, 9.5], // spawn
    [0, 1.5], // plaza fountain
    [0, -10], // south meadow, >5 from every zone
  ] as const) {
    world.playerPos = { x, z };
    for (let i = 0; i < 5; i++) tick(world);
  }
  assert.equal(exploredFlagCount(world), 0, 'no explored_* sideFlags set');
  assert.deepEqual(exploredMemoryIds(world), [], 'no mem_explored_* journal rows');

  // Indoors with a far outdoor position must not grant either.
  world.playerLocation = 'nook_interior';
  world.playerPos = { x: 0, z: 0 };
  world.exteriorPlayerPos = { x: 0, z: 1.5 };
  for (let i = 0; i < 5; i++) tick(world);
  assert.equal(exploredFlagCount(world), 0, 'no grant from indoor local coords');
});

test('BD10-06 discovery across phase crossing and a day rollover', () => {
  // (a) grant while the clock crosses the morning→afternoon boundary (690)
  const world = freshWorld();
  world.minuteOfDay = 680;
  world.playerPos = { x: SITES.sorrel_hollow.x, z: SITES.sorrel_hollow.z };
  tick(world); // → 682, still morning
  assert.equal(world.sideFlags[SITES.sorrel_hollow.sideFlag], true, 'granted before boundary');
  const mem = world.memories.find((m) => m.id === SITES.sorrel_hollow.memoryId);
  assert.equal(mem?.phase, 'morning', 'memory phase reflects the granting tick');
  for (let i = 0; i < 8; i++) tick(world); // cross 690
  assert.equal(
    world.memories.filter((m) => m.id === SITES.sorrel_hollow.memoryId).length,
    1,
    'phase crossing never duplicates the memory',
  );

  // (b) day rollover: grant happens fresh on day 2 with memory.day === 2
  const w2 = freshWorld();
  w2.playerPos = { x: 0, z: 1.5 };
  for (let i = 0; i < 3; i++) tick(w2);
  assert.equal(exploredFlagCount(w2), 0, 'day 1 away from zones: nothing');
  const rolled = advanceToNextDay(w2 as unknown as WorldState) as unknown as WorldLike;
  assert.equal(rolled.day, 2, 'production day roll');
  rolled.playerPos = { x: SITES.bee_line.x, z: SITES.bee_line.z };
  tick(rolled);
  assert.equal(rolled.sideFlags[SITES.bee_line.sideFlag], true, 'day-2 grant');
  const mem2 = rolled.memories.find((m) => m.id === SITES.bee_line.memoryId);
  assert.ok(mem2, 'day-2 memory row');
  assert.equal(mem2?.day, 2, 'memory stamped with day 2');

  // (c) clock clamp: at DAY_END the tick still grants (step-0 runs regardless
  //     of the clamped clock) and never duplicates.
  const w3 = freshWorld();
  w3.minuteOfDay = 1289;
  w3.playerPos = { x: SITES.marigold_lane.x, z: SITES.marigold_lane.z };
  tick(w3);
  assert.ok(w3.minuteOfDay <= 1290, 'clock clamped at DAY_END_MINUTE');
  assert.equal(w3.sideFlags[SITES.marigold_lane.sideFlag], true, 'grant at clamp boundary');
  for (let i = 0; i < 10; i++) tick(w3);
  assert.equal(
    w3.memories.filter((m) => m.id === SITES.marigold_lane.memoryId).length,
    1,
    'no duplication at the clamp',
  );
});

test('BD10-07 save→load preserves discovery; loaded world never re-grants', () => {
  const world = freshWorld();
  world.sideFlags = { fountainWishesCount: 3 } as never; // unrelated key must survive sanitizeSideFlags
  world.playerPos = { x: SITES.marigold_lane.x, z: SITES.marigold_lane.z };
  tick(world);
  assert.equal(world.sideFlags[SITES.marigold_lane.sideFlag], true);

  const raw = serializeWorldState(world as never);
  const res = deserializeWorldState(raw);
  const loaded = res.state as unknown as WorldLike;

  assert.equal(loaded.sideFlags[SITES.marigold_lane.sideFlag], true, 'sideFlag survives load');
  assert.equal(loaded.sideFlags.fountainWishesCount, 3, 'unrelated sideFlags preserved');
  assert.equal(
    loaded.memories.filter((m) => m.id === SITES.marigold_lane.memoryId).length,
    1,
    'memory survives load',
  );

  loaded.playerPos = { x: SITES.marigold_lane.x, z: SITES.marigold_lane.z };
  for (let i = 0; i < 5; i++) tick(loaded);
  assert.equal(
    loaded.memories.filter((m) => m.id === SITES.marigold_lane.memoryId).length,
    1,
    'no re-grant after load',
  );
  assert.equal(exploredFlagCount(loaded), 1);
});

test('BD10-08 2000-tick stability: deterministic hash, single grant, no drift', () => {
  const run = (): WorldLike => {
    const world = freshWorld();
    world.playerPos = { x: SITES.marigold_lane.x, z: SITES.marigold_lane.z };
    for (let i = 0; i < 2000; i++) tick(world, 0.05, { clockRateMinutesPerSec: 2.2 });
    return world;
  };
  const a = run();
  const b = run();

  const revA = computeWorldSaveRevision(a as never);
  const revB = computeWorldSaveRevision(b as never);
  assert.equal(revA, revB, 'production save-revision fingerprint identical across runs');
  assert.equal(sha(a), sha(b), 'stable JSON hash identical across runs (no sim drift)');

  assert.equal(a.sideFlags[SITES.marigold_lane.sideFlag], true, 'discovery granted in a long run');
  assert.equal(
    a.memories.filter((m) => m.id === SITES.marigold_lane.memoryId).length,
    1,
    'exactly one memory row across 2000 ticks',
  );
  assert.equal(exploredFlagCount(a), 1);

  const finite = (p: unknown): boolean =>
    typeof p === 'object' && p !== null &&
    Number.isFinite((p as Vec2Like).x) && Number.isFinite((p as Vec2Like).z);
  assert.ok(finite(a.playerPos), 'player position stays finite');
  for (const [id, rt] of Object.entries(a.npcRuntime)) {
    assert.ok(finite(rt.position), `npcRuntime[${id}].position stays finite`);
  }
  assert.ok(a.minuteOfDay <= 1290, 'minuteOfDay clamped to DAY_END_MINUTE');
});

test('BD10-09 [PIN] double-run determinism: identical seed + tick & dialogue input → identical hashes', () => {
  const run = (): WorldLike => {
    let world = freshWorld();
    world.playerPos = { x: SITES.marigold_lane.x, z: SITES.marigold_lane.z };
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
    const isAvailable = isChoiceAvailable as (
      choice: unknown,
      w: unknown,
      rid?: string,
    ) => boolean;
    const speakers = ['mina', 'rowan', 'nora'] as const;
    for (let i = 0; i < 800; i++) {
      tick(world, 0.05);
      if (i === 100 || i === 300 || i === 600) {
        const speaker = i === 100 ? speakers[0] : i === 300 ? speakers[1] : speakers[2];
        const session = build(speaker, world, phaseOf(world));
        const root = session.nodes['root'];
        const choice = (root?.choices ?? []).find((c) => isAvailable(c, world, speaker));
        if (choice) {
          world = apply(world, session, choice).nextWorld as unknown as WorldLike;
          world.playerPos = { x: SITES.marigold_lane.x, z: SITES.marigold_lane.z };
        }
      }
    }
    return world;
  };
  const a = run();
  const b = run();
  assert.equal(sha(a), sha(b), 'exploration + dialogue interleaved run is fully deterministic');
  assert.equal(
    computeWorldSaveRevision(a as never),
    computeWorldSaveRevision(b as never),
    'save-revision fingerprints match',
  );
});

// ============================================================================
// §2 — D-02: wilds dialogue topics registry, golden integrity, selection
// ============================================================================

test('BD10-10 DIALOGUE_TOPICS registers wilds check-ins with Build-10 conditions (anti-snapshot-fraud)', () => {
  const topics = (DIALOGUE_TOPICS as unknown as Array<Record<string, unknown>>) ?? [];
  const byId = new Map(topics.map((t) => [String(t.id), t]));

  // Hardcoded expectations (from 9cde87d wilds.ts) — deliberately NOT read
  // from the golden snapshot, so regenerating the snapshot cannot hide a
  // registry loss (that is exactly how D-02 slipped past dialogueRegistry.test.ts).
  for (const expected of EXPECTED_WILDS_TOPICS) {
    const t = byId.get(expected.id);
    assert.ok(
      t,
      `D-02: topic '${expected.id}' missing from DIALOGUE_TOPICS ` +
        `(WILDS_TOPICS was replaced by INVITATION_TOPICS in dialogue/index.ts)`,
    );
    assert.equal(t?.residentId, expected.residentId, `${expected.id}.residentId`);
    assert.equal(t?.category, expected.category, `${expected.id}.category`);
    assert.equal(t?.priority, expected.priority, `${expected.id}.priority`);
    assert.deepEqual(t?.condition, expected.condition, `${expected.id}.condition`);
    assert.equal(typeof t?.build, 'function', `${expected.id}.build`);
  }

  // The fix must not over-revert: the LR invitation topics stay registered too.
  for (const expected of EXPECTED_INVITATION_TOPICS) {
    const t = byId.get(expected.id);
    assert.ok(t, `invitation topic '${expected.id}' must remain registered after restoration`);
    assert.equal(t?.residentId, expected.residentId, `${expected.id}.residentId`);
    assert.equal(t?.priority, expected.priority, `${expected.id}.priority`);
    assert.deepEqual(t?.condition, expected.condition, `${expected.id}.condition`);
  }
});

test('BD10-11 golden snapshot contains the wilds topic ids (snapshot integrity)', () => {
  const goldenPath = new URL('../../scripts/dialogue-topics-golden.json', import.meta.url);
  const raw = JSON.parse(readFileSync(goldenPath, 'utf8')) as {
    count: number;
    topics: Array<{ id: string; residentId: string; category: string; priority: number; condition: unknown }>;
  };
  assert.equal(raw.count, raw.topics.length, 'golden file internally consistent');
  const byId = new Map(raw.topics.map((t) => [t.id, t]));
  for (const expected of EXPECTED_WILDS_TOPICS) {
    const g = byId.get(expected.id);
    assert.ok(
      g,
      `D-02: golden snapshot was regenerated without '${expected.id}' — ` +
        `the golden must contain the Build-10 wilds topics`,
    );
    assert.equal(g?.residentId, expected.residentId, `${expected.id} golden residentId`);
    assert.equal(g?.category, expected.category, `${expected.id} golden category`);
    assert.equal(g?.priority, expected.priority, `${expected.id} golden priority`);
    assert.deepEqual(g?.condition, expected.condition, `${expected.id} golden condition`);
  }
});

test('BD10-12 selection surfaces daily_mina_foxglove for Mina once the hollow is explored', () => {
  const wildsTopics = (WILDS_TOPICS as unknown as Array<Record<string, unknown>>) ?? [];

  const world = freshWorld();
  world.residents.mina.met = true; // after the ordinary introduction
  world.sideFlags[SITES.sorrel_hollow.sideFlag] = true; // exploration prerequisite

  // (a) Content alive, wiring dead discriminator: the orphan module's topic
  // passes the condition evaluator even when the registry is broken — the loss
  // is in the registry, not the content.
  const minaTopic = wildsTopics.find((t) => t.id === 'daily_mina_foxglove');
  assert.ok(minaTopic, 'wilds module still exports daily_mina_foxglove');
  assert.equal(
    (evaluateDialogueCondition as (
      cond: unknown, rid: string, w: unknown, phase: string, topicId: string,
    ) => boolean)(minaTopic?.condition, 'mina', world, phaseOf(world), 'daily_mina_foxglove'),
    true,
    'condition {requiresMet, sideFlagsTrue[explored_sorrel_hollow], notSeenToday} evaluates true',
  );

  // (b) Natural ordinary-play probe: the check-in surfaces through ordinary
  // interactions alone, with no QA staging beyond {met, explored_sorrel_hollow}.
  // MEASURED on this build (probe recorded in build10-lr-recovery doc 07):
  // greenhouse_corner (92) → herbloaf_1 (84) → tier_friendly_confide (95) →
  // … → daily_mina_foxglove at interaction 7 — the competing personal_story /
  // tier topics drain through the engine's same-day history penalty before the
  // daily_slice check-in wins. The bound pins ordinary-play reachability (the
  // D-02 failure mode was "never surfaces at all"); the deterministic starvation
  // pin is (c) below. Production scoring is intentionally untouched.
  const build = buildResidentDialogue as unknown as (
    id: string, w: unknown, phase: string,
  ) => { topicId: string; nodes: Record<string, { choices: Array<Record<string, unknown>> }> };
  const apply = applyDialogueChoice as (
    w: unknown, session: unknown, choice: unknown,
  ) => { nextWorld: unknown };
  const isAvailable = isChoiceAvailable as (c: unknown, w: unknown, rid?: string) => boolean;

  let probe = world;
  const surfaced: string[] = [];
  for (let i = 0; i < 8 && !surfaced.includes('daily_mina_foxglove'); i++) {
    const session = build('mina', probe, phaseOf(probe));
    surfaced.push(session.topicId);
    const root = session.nodes['root'];
    const choice = (root?.choices ?? []).find((c) => isAvailable(c, probe, 'mina'));
    if (choice) probe = apply(probe, session, choice).nextWorld as unknown as WorldLike;
  }
  assert.ok(
    surfaced.includes('daily_mina_foxglove'),
    `D-02: daily_mina_foxglove never surfaced for Mina within 8 ordinary interactions ` +
      `(got: ${surfaced.join(' → ')}). Candidates at failure: ` +
      `${describeCandidates(probe, 'mina', ((DIALOGUE_TOPICS ?? []) as unknown as Array<Record<string, unknown>>).concat(wildsTopics))}`,
  );

  // (c) Deterministic staged probe: the ordinary-play end-state where the
  // measured blocking preconditions are resolved (greenhouse corner planted,
  // herb arc started) and everything else was talked about today. The check-in
  // must then be the selected topic — pins the restored registry against
  // starvation.
  const staged = freshWorld();
  staged.residents.mina.met = true;
  staged.sideFlags[SITES.sorrel_hollow.sideFlag] = true;
  suppressCompetingTopics(staged, 'mina', 'daily_mina_foxglove');
  const session = build('mina', staged, phaseOf(staged));
  assert.equal(
    session.topicId,
    'daily_mina_foxglove',
    `staged selection must pick the wilds check-in (got: ${session.topicId})`,
  );
});

test('BD10-13 selection surfaces daily_rowan_beeline_checkin for Rowan once the Bee Line is explored', () => {
  const world = freshWorld();
  world.residents.rowan.met = true;
  world.sideFlags[SITES.bee_line.sideFlag] = true;
  suppressCompetingTopics(world, 'rowan', 'daily_rowan_beeline_checkin');

  const session = (buildResidentDialogue as (
    id: string, w: unknown, phase: string,
  ) => { topicId: string })('rowan', world, phaseOf(world));
  assert.equal(
    session.topicId,
    'daily_rowan_beeline_checkin',
    `D-02: Rowan's Bee Line check-in must surface when eligible (got: ${session.topicId}). ` +
      `Candidates: ${describeCandidates(world, 'rowan', (DIALOGUE_TOPICS ?? []) as unknown as Array<Record<string, unknown>>)}`,
  );
});
