import {
  ActiveSocialEncounter,
  NpcAnimationState,
  ResidentId,
  StoryFlags,
  TimePhase,
  Vec2,
  WeatherType,
  WorldState,
} from './types';
import {
  RESIDENTS,
  RESIDENT_EXTRA_ACTIVITIES,
  RESIDENT_ORDER,
  getResidentScheduleSlot,
} from './residents';
import { DAY_END_MINUTE, advanceSimulationClock, getTimePhase } from './time';
import { hashSeed, mulberry32, seededInt } from './rng';
import {
  applyNpcSocialRelationInPlace,
  createInitialNpcActivityHistory,
  getNpcPairKey,
  getNpcRelation,
  pushNpcActivityHistoryInPlace,
  pushWorldEventInPlace,
} from './relationships';
import {
  computeSeparationVector,
  computeWaypointPath,
  stepAlongWaypoints,
} from './navigation';
import { distance2D, isPointWalkable } from './worldMap';

export interface SimulationStepOptions {
  paused?: boolean;
  dialogueOpen?: boolean;
  clockRateMinutesPerSec?: number;
  npcSpeedPerSec?: number;
}

const DEFAULT_CLOCK_RATE = 2.2;
const DEFAULT_NPC_SPEED = 2.3;
const SOCIAL_COOLDOWN_MINUTES = 95;
const SOCIAL_ENCOUNTER_DURATION_MINUTES = 16;

// Pre-allocated scratch buffers so stepSimulationInPlace stays zero-GC in browser tick()
const _otherPositions: Vec2[] = [];

function normalizeAngleDiff(target: number, current: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function getDefaultPoseForSlot(id: ResidentId, phase: TimePhase): NpcAnimationState {
  if (id === 'sora' && (phase === 'afternoon' || phase === 'dusk')) return 'music';
  if (id === 'toby') return 'sketch_read';
  if (id === 'nora' && phase === 'afternoon') return 'sketch_read';
  if (id === 'clara' && (phase === 'morning' || phase === 'dusk')) return 'work';
  if (id === 'arthur' && (phase === 'morning' || phase === 'dusk')) return 'work';
  if (id === 'mina' && (phase === 'morning' || phase === 'dusk')) return 'work';
  if (id === 'barnaby' && phase !== 'dusk') return 'work';
  return 'idle';
}

function selectActivityForResident(
  id: ResidentId,
  phase: TimePhase,
  minuteOfDay: number,
  day: number,
  simSeed: number,
  weather: WeatherType,
  flags: StoryFlags,
): {
  id: string;
  target: Vec2;
  placeName: string;
  activity: string;
  facingAngle: number;
  animState: NpcAnimationState;
  durationMinutes: number;
} {
  const def = RESIDENTS[id];
  const anchor = getResidentScheduleSlot(id, phase, flags.claraArthurReconciled);

  // Special Golden Hour reconciliation beats always hold top priority
  if (flags.claraArthurReconciled && phase === 'golden' && (id === 'clara' || id === 'arthur')) {
    return {
      id: `${phase}:reconciled_gazebo`,
      target: anchor.target,
      placeName: anchor.placeName,
      activity: anchor.activity,
      facingAngle: anchor.facingAngle,
      animState: 'admire',
      durationMinutes: 90,
    };
  }

  const blockIndex = Math.floor(minuteOfDay / 45);
  const rand = mulberry32(hashSeed(simSeed, day, blockIndex, id));

  let bestOption = {
    id: `${phase}:anchor`,
    target: anchor.target,
    placeName: anchor.placeName,
    activity: anchor.activity,
    facingAngle: anchor.facingAngle,
    animState: getDefaultPoseForSlot(id, phase),
    score:
      weather === 'light_rain' && def.traits.rainBehavior !== 'umbrella_stroll'
        ? 0.55 + rand() * 0.25
        : 0.95 + rand() * 0.35,
  };

  const extras = RESIDENT_EXTRA_ACTIVITIES[id];
  for (let i = 0; i < extras.length; i++) {
    const cand = extras[i];
    if (!cand.phases.includes(phase)) continue;
    if (cand.requiresFlag && !flags[cand.requiresFlag]) continue;
    if (cand.onlyWeathers && !cand.onlyWeathers.includes(weather)) continue;

    let weight = cand.baseWeight;
    if (weather === 'light_rain') {
      if (cand.preferredWeathers?.includes('light_rain') || cand.sheltered) {
        weight *= def.traits.rainBehavior === 'umbrella_stroll' ? 1.15 : 2.1;
      } else {
        weight *= def.traits.rainBehavior === 'umbrella_stroll' ? 0.9 : 0.35;
      }
    } else if (cand.preferredWeathers && !cand.preferredWeathers.includes(weather)) {
      weight *= 0.6;
    }

    // Factor in curiosity / outdoorsiness traits for distinctive resident tendencies
    const traitModifier =
      cand.animState === 'admire'
        ? 0.8 + def.traits.curiosity * 0.45
        : cand.sheltered
        ? 0.85 + (1 - def.traits.outdoorsiness) * 0.4
        : 0.85 + def.traits.outdoorsiness * 0.35;

    const score = weight * traitModifier * (0.75 + rand() * 0.5);
    if (score > bestOption.score) {
      bestOption = {
        id: `${phase}:${cand.id}`,
        target: cand.target,
        placeName: cand.placeName,
        activity: cand.activity,
        facingAngle: cand.facingAngle,
        animState: cand.animState,
        score,
      };
    }
  }

  return {
    id: bestOption.id,
    target: bestOption.target,
    placeName: bestOption.placeName,
    activity: bestOption.activity,
    facingAngle: bestOption.facingAngle,
    animState: bestOption.animState,
    durationMinutes: seededInt(rand, 44, 72),
  };
}

export function createInitialNpcRuntime(
  minuteOfDay: number,
  reconciled: boolean,
): Record<ResidentId, import('./types').NpcRuntimeState> {
  const phase = getTimePhase(minuteOfDay);
  const out = {} as Record<ResidentId, import('./types').NpcRuntimeState>;
  for (const id of RESIDENT_ORDER) {
    const slot = getResidentScheduleSlot(id, phase, reconciled);
    out[id] = {
      position: { x: slot.target.x, z: slot.target.z },
      facing: slot.facingAngle,
      animState: getDefaultPoseForSlot(id, phase),
      walkPhase: 0,
      currentActivityId: `${phase}:anchor`,
      currentPlaceName: slot.placeName,
      currentActivityLabel: slot.activity,
      targetPos: { x: slot.target.x, z: slot.target.z },
      targetFacing: slot.facingAngle,
      waypoints: [],
      activityUntilMinute: Math.min(DAY_END_MINUTE, minuteOfDay + 55),
      stuckSeconds: 0,
      socialPartnerId: null,
      socialCooldownUntilMinute: 0,
    };
  }
  return out;
}

export function cloneNpcRuntime(
  runtime: Record<ResidentId, import('./types').NpcRuntimeState>,
): Record<ResidentId, import('./types').NpcRuntimeState> {
  const out = {} as Record<ResidentId, import('./types').NpcRuntimeState>;
  for (const id of RESIDENT_ORDER) {
    const r = runtime[id];
    out[id] = {
      ...r,
      position: { x: r.position.x, z: r.position.z },
      targetPos: { x: r.targetPos.x, z: r.targetPos.z },
      waypoints: r.waypoints.map((w) => ({ x: w.x, z: w.z })),
    };
  }
  return out;
}

function buildSocialTopic(a: ResidentId, b: ResidentId, flags: StoryFlags): { tag: string; label: string } {
  const pair = getNpcPairKey(a, b);
  if (pair === 'arthur:clara') {
    return { tag: 'reconciled_chat', label: 'Sharing gentle memories together in the sunlit square' };
  }
  if (pair === 'clara:mina') {
    return { tag: 'lavender_loaves', label: 'Trading rosemary and moon-petal gardening notes' };
  }
  if (pair === 'arthur:barnaby') {
    return { tag: 'timber_and_brass', label: 'Comparing cedar joinery and pocket watch springs' };
  }
  if (pair === 'nora:sora') {
    return { tag: 'evening_almanac', label: 'Discussing old festival songs and town almanacs' };
  }
  if (pair === 'nora:pip' || pair === 'pip:toby') {
    return { tag: 'pond_stories', label: 'Swapping mirror-pond carp sightings and chalk ideas' };
  }
  if (flags.bellRestored) {
    return { tag: 'bell_chimes', label: 'Reminiscing about the restored brass bell’s warm chime' };
  }
  return { tag: 'neighbor_chat', label: 'Catching up over neighborhood news on the cobbles' };
}

function tryComputeEncounterSpots(posA: Vec2, posB: Vec2): [Vec2, Vec2] | null {
  let midX = (posA.x + posB.x) * 0.5;
  let midZ = (posA.z + posB.z) * 0.5;
  if (!isPointWalkable(midX, midZ, 0.38)) {
    midX = posA.x;
    midZ = posA.z;
    if (!isPointWalkable(midX, midZ, 0.38)) return null;
  }

  let dx = posB.x - posA.x;
  let dz = posB.z - posA.z;
  const len = Math.hypot(dx, dz);
  if (len > 0.05) {
    dx /= len;
    dz /= len;
  } else {
    dx = 1;
    dz = 0;
  }

  const halfSep = 0.64;
  const candidates: Array<[Vec2, Vec2]> = [
    [
      { x: midX - dx * halfSep, z: midZ - dz * halfSep },
      { x: midX + dx * halfSep, z: midZ + dz * halfSep },
    ],
    [
      { x: midX - dz * halfSep, z: midZ + dx * halfSep },
      { x: midX + dz * halfSep, z: midZ - dx * halfSep },
    ],
  ];

  for (const [s0, s1] of candidates) {
    if (isPointWalkable(s0.x, s0.z, 0.38) && isPointWalkable(s1.x, s1.z, 0.38)) {
      return [s0, s1];
    }
  }
  return null;
}

function clearEncounterForActors(world: WorldState, enc: ActiveSocialEncounter): void {
  for (const pid of enc.participants) {
    const rt = world.npcRuntime[pid];
    if (rt && rt.socialPartnerId !== null) {
      rt.socialPartnerId = null;
      rt.activityUntilMinute = Math.min(rt.activityUntilMinute, world.minuteOfDay);
    }
  }
}

export function interruptSocialEncounter(world: WorldState, residentId: ResidentId): WorldState {
  if (!world.activeEncounters || world.activeEncounters.length === 0) return world;
  const matching = world.activeEncounters.filter((e) => e.participants.includes(residentId));
  if (matching.length === 0) return world;

  const nextRuntime = cloneNpcRuntime(world.npcRuntime);
  const nextEncounters = world.activeEncounters.filter((e) => !e.participants.includes(residentId));
  for (const enc of matching) {
    for (const pid of enc.participants) {
      nextRuntime[pid].socialPartnerId = null;
      nextRuntime[pid].activityUntilMinute = world.minuteOfDay;
    }
  }
  return {
    ...world,
    npcRuntime: nextRuntime,
    activeEncounters: nextEncounters,
  };
}

/**
 * Zero-GC in-place simulation stepper suitable for 60Hz render loops.
 * Advances unified simulation clock, autonomous resident routines, and NPC-to-NPC social encounters.
 */
export function stepSimulationInPlace(
  world: WorldState,
  dtSeconds: number,
  options: SimulationStepOptions = {},
): void {
  const dt = Math.max(0, Math.min(dtSeconds, 0.25));
  if (dt <= 0) return;

  const paused = options.paused ?? false;
  const dialogueOpen = options.dialogueOpen ?? false;
  const clockRate = options.clockRateMinutesPerSec ?? DEFAULT_CLOCK_RATE;
  const npcSpeed = options.npcSpeedPerSec ?? DEFAULT_NPC_SPEED;

  if (!paused && !dialogueOpen) {
    world.minuteOfDay = advanceSimulationClock(world.minuteOfDay, dt * clockRate);
  }

  if (paused) return;

  if (!world.activeEncounters) world.activeEncounters = [];
  if (!world.worldEvents) world.worldEvents = [];
  if (!world.npcActivityHistory) world.npcActivityHistory = createInitialNpcActivityHistory();

  const phase = getTimePhase(world.minuteOfDay);

  // 1. Expire finished social encounters cleanly
  for (let k = world.activeEncounters.length - 1; k >= 0; k--) {
    const enc = world.activeEncounters[k];
    if (world.minuteOfDay >= enc.endsMinute) {
      clearEncounterForActors(world, enc);
      world.activeEncounters.splice(k, 1);
    }
  }

  // 2. Evaluate autonomous activity transitions & pathfinding per resident
  for (let i = 0; i < RESIDENT_ORDER.length; i++) {
    const id = RESIDENT_ORDER[i];
    const rt = world.npcRuntime[id];

    // If participating in an active social encounter, skip routine re-selection
    if (rt.socialPartnerId === null) {
      const activityPhasePrefix = `${phase}:`;
      const phaseChanged = !rt.currentActivityId.startsWith(activityPhasePrefix);
      const needsReconciledOverride =
        world.flags.claraArthurReconciled &&
        phase === 'golden' &&
        (id === 'clara' || id === 'arthur') &&
        rt.currentActivityId !== 'golden:reconciled_gazebo';
      const dwellExpired = world.minuteOfDay >= rt.activityUntilMinute;

      if (phaseChanged || needsReconciledOverride || dwellExpired) {
        const chosen = selectActivityForResident(
          id,
          phase,
          world.minuteOfDay,
          world.day,
          world.simSeed,
          world.weather,
          world.flags,
        );
        const goalChanged =
          chosen.id !== rt.currentActivityId ||
          Math.abs(rt.targetPos.x - chosen.target.x) > 0.05 ||
          Math.abs(rt.targetPos.z - chosen.target.z) > 0.05;

        rt.currentActivityId = chosen.id;
        rt.currentPlaceName = chosen.placeName;
        rt.currentActivityLabel = chosen.activity;
        rt.targetFacing = chosen.facingAngle;
        rt.activityUntilMinute = Math.min(DAY_END_MINUTE, world.minuteOfDay + chosen.durationMinutes);

        if (goalChanged) {
          rt.targetPos.x = chosen.target.x;
          rt.targetPos.z = chosen.target.z;
          rt.waypoints = computeWaypointPath(rt.position, rt.targetPos, 0.38);
          rt.stuckSeconds = 0;
          pushNpcActivityHistoryInPlace(world.npcActivityHistory, id, {
            day: world.day,
            minuteOfDay: Math.round(world.minuteOfDay),
            activityId: chosen.id,
            placeName: chosen.placeName,
            label: chosen.activity,
          });
        }
      }
    }

    if (rt.waypoints.length > 0) {
      _otherPositions.length = 0;
      for (let j = 0; j < RESIDENT_ORDER.length; j++) {
        if (j === i) continue;
        const otherId = RESIDENT_ORDER[j];
        if (rt.socialPartnerId === otherId) continue;
        _otherPositions.push(world.npcRuntime[otherId].position);
      }
      const sep = computeSeparationVector(rt.position, _otherPositions, 0.95);
      const step = stepAlongWaypoints(rt.position, rt.waypoints, npcSpeed, dt, sep, 0.38);

      rt.position.x = step.nextPos.x;
      rt.position.z = step.nextPos.z;

      if (step.arrived) {
        rt.waypoints.length = 0;
        rt.stuckSeconds = 0;
        rt.animState = rt.socialPartnerId ? 'converse' : getDefaultPoseForSlot(id, phase);
      } else {
        rt.animState = 'walk';
        rt.walkPhase += step.movedDist * 5.2;
        if (step.moveDirX !== 0 || step.moveDirZ !== 0) {
          const targetAngle = Math.atan2(step.moveDirX, step.moveDirZ);
          const diff = normalizeAngleDiff(targetAngle, rt.facing);
          rt.facing += diff * Math.min(1, dt * 10);
        }

        const expectedMin = npcSpeed * dt * 0.12;
        if (step.movedDist < expectedMin) {
          rt.stuckSeconds += dt;
          if (rt.stuckSeconds > 1.2) {
            rt.stuckSeconds = 0;
            rt.waypoints = computeWaypointPath(rt.position, rt.targetPos, 0.38);
          }
        } else {
          rt.stuckSeconds = 0;
        }
      }
    } else {
      if (rt.socialPartnerId) {
        rt.animState = 'converse';
        const partnerPos = world.npcRuntime[rt.socialPartnerId].position;
        rt.targetFacing = Math.atan2(partnerPos.x - rt.position.x, partnerPos.z - rt.position.z);
      } else {
        // Reflect current activity's expressive pose when settled
        const extra = RESIDENT_EXTRA_ACTIVITIES[id].find((a) => `${phase}:${a.id}` === rt.currentActivityId);
        rt.animState = extra ? extra.animState : getDefaultPoseForSlot(id, phase);
      }

      const pDist = distance2D(world.playerPos, rt.position);
      const goalRot =
        pDist < 3.2
          ? Math.atan2(world.playerPos.x - rt.position.x, world.playerPos.z - rt.position.z)
          : rt.targetFacing;
      const diff = normalizeAngleDiff(goalRot, rt.facing);
      rt.facing += diff * Math.min(1, dt * 4);
    }
  }

  // 3. Evaluate NPC-to-NPC social encounter pairing (bounded, deterministic per 15m slot)
  const maxConcurrentEncounters = Math.max(2, Math.floor(RESIDENT_ORDER.length / 4));
  if (!dialogueOpen && world.activeEncounters.length < maxConcurrentEncounters) {
    const socialSlot = Math.floor(world.minuteOfDay / 15);
    for (let i = 0; i < RESIDENT_ORDER.length; i++) {
      if (world.activeEncounters.length >= maxConcurrentEncounters) break;
      const a = RESIDENT_ORDER[i];
      const rtA = world.npcRuntime[a];
      if (rtA.socialPartnerId !== null || rtA.waypoints.length > 0) continue;
      if (world.minuteOfDay < rtA.socialCooldownUntilMinute) continue;
      if (distance2D(world.playerPos, rtA.position) < 2.2) continue;

      for (let j = i + 1; j < RESIDENT_ORDER.length; j++) {
        const b = RESIDENT_ORDER[j];
        const rtB = world.npcRuntime[b];
        if (rtB.socialPartnerId !== null || rtB.waypoints.length > 0) continue;
        if (world.minuteOfDay < rtB.socialCooldownUntilMinute) continue;
        if (distance2D(world.playerPos, rtB.position) < 2.2) continue;
        if (distance2D(rtA.position, rtB.position) > 7.5) continue;

        const rel = getNpcRelation(world.npcRelations, a, b);
        if (rel.affinity < -1) continue; // Keep estranged neighbors apart until reconciled

        const encId = `enc_${world.day}_${socialSlot}_${a}_${b}`;
        if (world.worldEvents.some((e) => e.id === encId)) continue;

        const pairRand = mulberry32(hashSeed(world.simSeed, world.day, socialSlot, a, b))();
        const pairChance =
          0.32 + ((RESIDENTS[a].traits.sociability + RESIDENTS[b].traits.sociability) * 0.25);
        if (pairRand > pairChance) continue;

        const spots = tryComputeEncounterSpots(rtA.position, rtB.position);
        if (!spots) continue;

        const topic = buildSocialTopic(a, b, world.flags);
        const endsMinute = Math.min(DAY_END_MINUTE, world.minuteOfDay + SOCIAL_ENCOUNTER_DURATION_MINUTES);
        const cooldownUntil = endsMinute + SOCIAL_COOLDOWN_MINUTES;

        const encounter: ActiveSocialEncounter = {
          id: encId,
          participants: [a, b],
          topicTag: topic.tag,
          summary: `${RESIDENTS[a].name} & ${RESIDENTS[b].name}: ${topic.label}`,
          spots,
          startedMinute: world.minuteOfDay,
          endsMinute,
        };
        world.activeEncounters.push(encounter);

        // Configure both actors to step smoothly into conversation spots
        rtA.socialPartnerId = b;
        rtA.socialCooldownUntilMinute = cooldownUntil;
        rtA.targetPos.x = spots[0].x;
        rtA.targetPos.z = spots[0].z;
        rtA.targetFacing = Math.atan2(spots[1].x - spots[0].x, spots[1].z - spots[0].z);
        rtA.waypoints = computeWaypointPath(rtA.position, spots[0], 0.38);
        rtA.currentActivityLabel = `Chatting with ${RESIDENTS[b].name}`;

        rtB.socialPartnerId = a;
        rtB.socialCooldownUntilMinute = cooldownUntil;
        rtB.targetPos.x = spots[1].x;
        rtB.targetPos.z = spots[1].z;
        rtB.targetFacing = Math.atan2(spots[0].x - spots[1].x, spots[0].z - spots[1].z);
        rtB.waypoints = computeWaypointPath(rtB.position, spots[1], 0.38);
        rtB.currentActivityLabel = `Chatting with ${RESIDENTS[a].name}`;

        applyNpcSocialRelationInPlace(world.npcRelations, a, b, world.day, topic.tag);
        pushWorldEventInPlace(world.worldEvents, {
          id: encId,
          day: world.day,
          phase,
          minuteOfDay: Math.round(world.minuteOfDay),
          kind: 'npc_social',
          actors: [a, b],
          summary: `${RESIDENTS[a].name} and ${RESIDENTS[b].name} paused near ${rtA.currentPlaceName} — ${topic.label.toLowerCase()}.`,
          summaryTag: `chat_${getNpcPairKey(a, b)}`,
        });
        break;
      }
    }
  }
}

/**
 * Pure immutable headless simulation step for deterministic Node unit testing.
 */
export function stepSimulation(
  world: WorldState,
  dtSeconds: number,
  options: SimulationStepOptions = {},
): WorldState {
  const next: WorldState = {
    ...world,
    playerPos: { x: world.playerPos.x, z: world.playerPos.z },
    npcRuntime: cloneNpcRuntime(world.npcRuntime),
    npcRelations: { ...world.npcRelations },
    activeEncounters: world.activeEncounters.map((e) => ({
      ...e,
      participants: [e.participants[0], e.participants[1]],
      spots: [{ ...e.spots[0] }, { ...e.spots[1] }],
    })),
    worldEvents: [...world.worldEvents],
    npcActivityHistory: RESIDENT_ORDER.reduce((acc, id) => {
      acc[id] = [...(world.npcActivityHistory[id] ?? [])];
      return acc;
    }, {} as Record<ResidentId, import('./types').ResidentActivityEntry[]>),
  };
  stepSimulationInPlace(next, dtSeconds, options);
  return next;
}
