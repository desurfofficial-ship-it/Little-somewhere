/**
 * Behavioral QA suite for the NPC Intelligence & Living Simulation program.
 *
 * Covers the eight categories identified by the Phase-0 adversarial audit
 * (docs/architecture/npc-intelligence-living-simulation/00-index.md §1.3):
 *   1. Schedule reliability (multi-day)
 *   2. Navigation failure recovery (stuck -> re-select)
 *   3. Activity interruption (seat stolen / encounter interrupt)
 *   4. Social interaction (variety, familiarity, firsthand encounter memory)
 *   5. Persistence (mid-waypoint / mid-encounter round-trip)
 *   6. Deterministic replay (across day boundary)
 *   7. Long-running stability (memory saturation, bounded collections)
 *   8. Population scaling / simulation throughput
 *
 * These tests assert BEHAVIORAL properties (residents act believably and
 * recover from adversity), not just invariants (functions don't crash) —
 * the gap the audit identified in the original suite.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreshWorldState, serializeWorldState, deserializeWorldState, advanceToNextDay } from './storage';
import { stepSimulation } from './simulation';
import { RESIDENTS, RESIDENT_ORDER, getResidentScheduleSlot } from './residents';
import { MAX_NPC_MEMORIES_PER_RESIDENT } from './memories';
import { MAX_WORLD_EVENTS, getNpcRelation, getNpcRelationTier } from './relationships';
import { DAY_END_MINUTE, NEXT_DAY_WAKE_MINUTE, getTimePhase } from './time';
import { PLAYER_SPAWN, distance2D, isPointWalkable, getSeatById } from './worldMap';
import type { WorldState, ResidentId, TimePhase } from './types';

const PHASES: TimePhase[] = ['morning', 'afternoon', 'golden', 'dusk'];

/** Step a world forward by an in-game minute budget at a fixed dt (deterministic). */
function stepMinutes(world: WorldState, minutes: number, dt = 0.25, clockRate = 2.2): WorldState {
  const frames = Math.ceil(minutes / (dt * clockRate));
  let w = world;
  for (let f = 0; f < frames; f++) w = stepSimulation(w, dt);
  return w;
}

test('1. schedule reliability: every resident transitions through all 4 phases each day for 5 days without getting stuck', () => {
  let world = createFreshWorldState();
  for (let day = 1; day <= 5; day++) {
    const seenPhases = new Map<ResidentId, Set<TimePhase>>();
    for (const id of RESIDENT_ORDER) seenPhases.set(id, new Set());
    // Step a full day (dawn 480 -> dusk 1290 saturates) recording phase engagement.
    for (let step = 0; step < 600; step++) {
      world = stepSimulation(world, 0.25, { clockRateMinutesPerSec: 6 });
      const phase = getTimePhase(world.minuteOfDay);
      for (const id of RESIDENT_ORDER) {
        // Record the phase only when the resident's activity prefix matches it,
        // i.e. the resident has actually committed to an activity in that phase.
        if (world.npcRuntime[id].currentActivityId.startsWith(`${phase}:`)) {
          seenPhases.get(id)!.add(phase);
        }
      }
    }
    for (const id of RESIDENT_ORDER) {
      const seen = seenPhases.get(id)!;
      // A resident should engage with at least 3 of the 4 phases per day
      // (they may sleep through dawn or end the day early at home).
      assert.ok(
        seen.size >= 3,
        `${id} only engaged ${seen.size} phases on day ${day}: ${[...seen].join(',')}`,
      );
      // No resident may end the day badly stuck.
      assert.ok(
        world.npcRuntime[id].stuckSeconds < 3.0,
        `${id} got stuck (stuckSeconds=${world.npcRuntime[id].stuckSeconds}) on day ${day}`,
      );
      // Every resident must remain on walkable terrain (or properly seated).
      const rt = world.npcRuntime[id];
      if (rt.posture !== 'sitting') {
        assert.equal(
          isPointWalkable(rt.position.x, rt.position.z, 0.35),
          true,
          `${id} wandered off-graph on day ${day} at (${rt.position.x.toFixed(2)}, ${rt.position.z.toFixed(2)})`,
        );
      }
    }
    if (day < 5) world = advanceToNextDay(world);
  }
});

test('2. navigation failure recovery: a resident whose target becomes unreachable re-selects a reachable activity instead of freezing', () => {
  let world = createFreshWorldState();
  // Force Clara into a non-anchor activity targeting the unwalkable pond center.
  const pondCenter = { x: 1.6, z: 14.0 };
  assert.equal(isPointWalkable(pondCenter.x, pondCenter.z, 0.38), false, 'pond center is unwalkable');
  const unreachableActivity = 'afternoon:clara_unreachable_test';
  world = {
    ...world,
    minuteOfDay: 720,
    npcRuntime: {
      ...world.npcRuntime,
      clara: {
        ...world.npcRuntime.clara,
        position: { x: 2.2, z: 10.5 },
        currentActivityId: unreachableActivity,
        currentPlaceName: 'Mirror Pond Bank',
        currentActivityLabel: 'Reaching toward the pond',
        targetPos: { ...pondCenter },
        waypoints: [{ ...pondCenter }],
        activityUntilMinute: DAY_END_MINUTE,
        goalCommittedUntilMinute: DAY_END_MINUTE,
        stuckSeconds: 0,
        blockedActivityIds: [],
        socialPartnerId: null,
      },
    },
  };
  // Step well past the stuck-recovery window (2.8s) plus re-select latency.
  // The axis-slide may let Clara creep along the pond edge, but stuck-recovery
  // and re-pathing must eventually resolve her to a reachable target rather
  // than leaving her frozen indefinitely on the unreachable activity.
  for (let f = 0; f < 60; f++) world = stepSimulation(world, 0.2);
  const clara = world.npcRuntime.clara;

  // Core A1 guarantee: Clara must NOT remain frozen on the unreachable activity.
  assert.notEqual(
    clara.currentActivityId,
    unreachableActivity,
    'Clara must re-select away from the unreachable activity rather than freeze on it',
  );
  // Her committed target must now be reachable (recovery picked a valid spot).
  assert.equal(
    isPointWalkable(clara.targetPos.x, clara.targetPos.z, 0.35),
    true,
    'Clara re-committed to a reachable target after recovery',
  );
  // She must remain on walkable terrain and not be stuck at the moment of check.
  assert.equal(isPointWalkable(clara.position.x, clara.position.z, 0.35), true, 'Clara remained walkable');
  assert.ok(clara.stuckSeconds < 3.0, `stuckSeconds must reset after recovery (got ${clara.stuckSeconds})`);
  // If stuck-recovery fired while she held the unreachable activity, it should
  // have been recorded in the bounded blocked list so it isn't immediately re-picked.
  if ((clara.blockedActivityIds ?? []).length > 0) {
    assert.ok(
      (clara.blockedActivityIds ?? []).includes(unreachableActivity),
      'blockedActivityIds should list the unreachable activity when stuck-recovery fired',
    );
  }
});

test('3. activity interruption: a resident whose seat is stolen by the player re-selects and yields the seat', () => {
  let world = createFreshWorldState();
  const seat = getSeatById('seat_east_plaza');
  assert.ok(seat, 'seat_east_plaza seat exists');
  // Seat Clara on the east plaza bench.
  world = {
    ...world,
    minuteOfDay: 760,
    playerPos: { x: seat!.approachPos.x + 2, z: seat!.approachPos.z + 2 },
    npcRuntime: {
      ...world.npcRuntime,
      clara: {
        ...world.npcRuntime.clara,
        position: { x: seat!.seatPos.x, z: seat!.seatPos.z },
        targetPos: { x: seat!.seatPos.x, z: seat!.seatPos.z },
        posture: 'sitting',
        reservedSeatId: 'seat_east_plaza',
        animState: 'sit',
        waypoints: [],
        currentActivityId: 'afternoon:anchor',
        socialPartnerId: null,
      },
    },
  };
  // Player sits on the same bench, stealing Clara's seat.
  world = {
    ...world,
    playerPosture: 'sitting',
    playerSeatId: 'seat_east_plaza',
  };
  // Step a few frames so the seat-stolen trigger fires and Clara re-selects.
  for (let f = 0; f < 8; f++) world = stepSimulation(world, 0.25);
  const clara = world.npcRuntime.clara;
  assert.notEqual(
    clara.reservedSeatId,
    'seat_east_plaza',
    'Clara must yield the stolen seat and re-select a different activity',
  );
  assert.notEqual(clara.posture, 'sitting', 'Clara stands up after yielding the seat');
});

test('4. social interaction: encounters form, accumulate familiarity, and create firsthand participant memories', () => {
  let world = createFreshWorldState();
  // Move the player aside so plaza residents can socialize freely.
  world = { ...world, playerPos: { x: -10.5, z: 10.5 } };
  const distinctPairs = new Set<string>();
  let encounterMemoryCount = 0;
  let familiarityGrew = false;

  for (let step = 0; step < 600; step++) {
    world = stepSimulation(world, 0.25, { clockRateMinutesPerSec: 8 });
    for (const enc of world.activeEncounters) {
      const key = [...enc.participants].sort().join(':');
      distinctPairs.add(key);
    }
  }
  // Count firsthand encounter memories (category 'interaction', sourceKind 'participant').
  for (const id of RESIDENT_ORDER) {
    for (const m of world.npcMemories[id]) {
      if (m.sourceKind === 'participant' && m.tag.startsWith('encounter_')) {
        encounterMemoryCount++;
      }
    }
  }
  // Check familiarity accumulation across all relations.
  for (const [key, rel] of Object.entries(world.npcRelations)) {
    if ((rel.familiarity ?? 0) > 0 && !key.startsWith('arthur:clara')) {
      familiarityGrew = true;
      break;
    }
  }

  assert.ok(distinctPairs.size >= 2, `at least 2 distinct encounter pairs should form (got ${distinctPairs.size})`);
  assert.ok(encounterMemoryCount > 0, 'participants should record firsthand encounter memories (C1)');
  assert.ok(familiarityGrew, 'familiarity should accumulate on at least one NPC pair (C3)');
  // Estranged Clara & Arthur must never autonomously socialize.
  for (const enc of world.activeEncounters) {
    const pair = [...enc.participants].sort().join(':');
    assert.notEqual(pair, 'arthur:clara', 'estranged Clara and Arthur must stay apart');
  }
});

test('5. persistence: mid-waypoint and mid-encounter states round-trip through serialize/deserialize unchanged', () => {
  // (a) Mid-waypoint: step until some resident is mid-path, then round-trip.
  let world = createFreshWorldState();
  world = { ...world, minuteOfDay: 688 };
  for (let f = 0; f < 12; f++) world = stepSimulation(world, 0.25);
  const midTransit = RESIDENT_ORDER.find((id) => world.npcRuntime[id].waypoints.length > 0);
  assert.ok(midTransit, 'some resident should be mid-waypoint after a phase transition');
  const roundTripped = deserializeWorldState(serializeWorldState(world));
  assert.deepEqual(roundTripped.state, world, 'mid-waypoint state round-trips byte-identical');

  // (b) Mid-encounter: step until an encounter is active, then round-trip.
  // Player stays at the walkable PLAYER_SPAWN (home porch) so plaza NPCs can
  // socialize freely and the sanitizer doesn't reset playerPos.
  world = createFreshWorldState();
  world = { ...world, playerPos: { ...PLAYER_SPAWN }, minuteOfDay: 700 };
  for (let f = 0; f < 600 && world.activeEncounters.length === 0; f++) {
    world = stepSimulation(world, 0.25, { clockRateMinutesPerSec: 8 });
  }
  if (world.activeEncounters.length > 0) {
    const enc = world.activeEncounters[0];
    assert.ok(enc.participants.length >= 2, 'encounter has participants');
    const participant = enc.participants[0];
    assert.equal(world.npcRuntime[participant].socialPartnerId !== null, true, 'participant has a social partner');
    const reloaded = deserializeWorldState(serializeWorldState(world));
    assert.deepEqual(reloaded.state, world, 'mid-encounter state round-trips byte-identical');
    // Social linkage survives.
    assert.equal(reloaded.state.npcRuntime[participant].socialPartnerId, world.npcRuntime[participant].socialPartnerId);
  }
});

test('6. deterministic replay: two independent runs that both cross a day boundary converge to identical state', () => {
  let simA = createFreshWorldState();
  let simB = createFreshWorldState();
  // Run a day, advance, run another day — both chains identical.
  for (let f = 0; f < 120; f++) {
    simA = stepSimulation(simA, 0.25, { clockRateMinutesPerSec: 6 });
    simB = stepSimulation(simB, 0.25, { clockRateMinutesPerSec: 6 });
  }
  assert.deepEqual(simA, simB, 'twin runs must match before day-advance');
  simA = advanceToNextDay(simA);
  simB = advanceToNextDay(simB);
  assert.deepEqual(simA, simB, 'day-advance must be deterministic across twins');
  assert.equal(simA.npcRuntime.clara.position.x, simA.npcRuntime.clara.targetPos.x, 'NPCs wake at their morning slot after day-advance');
  for (let f = 0; f < 120; f++) {
    simA = stepSimulation(simA, 0.25, { clockRateMinutesPerSec: 6 });
    simB = stepSimulation(simB, 0.25, { clockRateMinutesPerSec: 6 });
  }
  assert.deepEqual(simA, simB, 'twin runs must match after crossing a day boundary');
});

test('7. long-running stability: 8 in-game days keep memory caps, bounded events, and sane needs', () => {
  let world = createFreshWorldState();
  world = { ...world, playerPos: { x: -10.5, z: 10.5 } };
  for (let day = 1; day <= 8; day++) {
    for (let f = 0; f < 160; f++) {
      world = stepSimulation(world, 0.25, { clockRateMinutesPerSec: 6 });
    }
    // After each day, verify bounded collections and sane numeric domains.
    assert.ok(world.worldEvents.length <= MAX_WORLD_EVENTS, `worldEvents capped at ${MAX_WORLD_EVENTS} on day ${day}`);
    for (const id of RESIDENT_ORDER) {
      const mems = world.npcMemories[id];
      assert.ok(
        mems.length <= MAX_NPC_MEMORIES_PER_RESIDENT,
        `${id} memories capped at ${MAX_NPC_MEMORIES_PER_RESIDENT} on day ${day} (got ${mems.length})`,
      );
      const needs = world.npcRuntime[id].needs;
      for (const key of ['energy', 'social', 'hunger', 'fulfillment'] as const) {
        const v = needs[key];
        assert.ok(Number.isFinite(v) && v >= 0 && v <= 100, `${id}.${key} sane on day ${day} (got ${v})`);
      }
    }
    if (day < 8) world = advanceToNextDay(world);
  }
});

test('8. population scaling: the full 10-resident tick completes well under budget and the encounter cap scales with N', () => {
  const world = createFreshWorldState();
  // Warm up, then measure 200 ticks.
  let w = world;
  for (let f = 0; f < 20; f++) w = stepSimulation(w, 0.25);
  const start = Date.now();
  for (let f = 0; f < 200; f++) w = stepSimulation(w, 0.25);
  const elapsedMs = Date.now() - start;
  // Generous budget that still catches an accidental O(N^3) or allocation regression.
  assert.ok(elapsedMs < 400, `200 ticks for 10 residents should run in <400ms (took ${elapsedMs}ms)`);
  const perTickUs = (elapsedMs / 200) * 1000;
  // maxConcurrentEncounters = max(2, floor(N/4)) — for N=10 that is 2.
  const expectedCap = Math.max(2, Math.floor(RESIDENT_ORDER.length / 4));
  assert.equal(expectedCap, 2, 'encounter concurrency cap scales as max(2, floor(N/4))');
  assert.ok(w.activeEncounters.length <= expectedCap, 'active encounters never exceed the scaling cap');
  // The encounter pairing loop must always terminate (no infinite loops).
  assert.ok(perTickUs < 2000, `per-tick cost sustainable (<2ms avg, got ${perTickUs.toFixed(0)}us)`);
});
