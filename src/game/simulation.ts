import {
  ActiveSocialEncounter,
  CharacterEmotion,
  NpcAnimationState,
  NpcNeeds,
  NpcRuntimeState,
  ResidentId,
  StoryFlags,
  TimePhase,
  Vec2,
  WeatherType,
  WorldState,
} from './types';
import {
  ActivityCandidate,
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
  emotionToMood,
  getNpcPairKey,
  getNpcRelation,
  getNpcRelationTier,
  getRelationshipTier,
  isResidentGuarded,
  pushNpcActivityHistoryInPlace,
  pushWorldEventInPlace,
  shouldSuppressNpcSocial,
} from './relationships';
import {
  computeSeparationVector,
  computeWaypointPath,
  stepAlongWaypoints,
} from './navigation';
import {
  cloneNpcMemories,
  propagateEncounterGossipInPlace,
} from './memories';
import { cloneStorylines } from './storylines';
import { distance2D, getSeatById, isPointWalkable } from './worldMap';

export interface SimulationStepOptions {
  paused?: boolean;
  dialogueOpen?: boolean;
  activeDialogueResidentId?: ResidentId | null;
  clockRateMinutesPerSec?: number;
  npcSpeedPerSec?: number;
}

const DEFAULT_CLOCK_RATE = 2.2;
const DEFAULT_NPC_SPEED = 2.3;
const SOCIAL_COOLDOWN_MINUTES = 95;
const SOCIAL_ENCOUNTER_DURATION_MINUTES = 16;
const GREETING_COOLDOWN_MINUTES = 65;

// Pre-allocated scratch buffer so stepSimulationInPlace stays zero-GC in browser tick()
const _otherPositions: Vec2[] = [];

function normalizeAngleDiff(target: number, current: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function clampNeed(v: number): number {
  return Math.max(0, Math.min(100, v));
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

function getInitialEmotionForResident(id: ResidentId, reconciled: boolean): CharacterEmotion {
  if (!reconciled && (id === 'clara' || id === 'arthur')) return 'sad';
  if (id === 'pip') return 'excited';
  if (id === 'jun') return 'happy';
  if (id === 'toby' || id === 'nora') return 'curious';
  return 'relaxed';
}

function getGreetingBubbleText(
  id: ResidentId,
  emotion: CharacterEmotion,
  affinity: number,
  reliability = 25,
  met = true,
): string {
  const def = RESIDENTS[id];
  const tier = getRelationshipTier(affinity);

  if (reliability < 20 || emotion === 'frustrated' || emotion === 'angry') {
    return def.traits.temperament === 'industrious'
      ? `Busy right now—let’s talk later.`
      : `Still catching my breath from earlier.`;
  }
  if (!met) {
    return def.traits.temperament === 'spirited'
      ? `Oh! You’re new to Willow Lane!`
      : `Welcome to the neighborhood.`;
  }
  if (emotion === 'tired') return `Whew… taking a breather.`;
  if (emotion === 'sad') return `Oh… hello there.`;
  if (tier === 'kindred') {
    return def.traits.temperament === 'contemplative'
      ? `Always glad when your path crosses mine.`
      : `Favorite neighbor! Stop by anytime!`;
  }
  if (tier === 'close') {
    return `Good to see you, friend!`;
  }
  if (tier === 'friendly') {
    return emotion === 'excited' || emotion === 'happy'
      ? `Hey there! Lovely day on the lane!`
      : `Glad we crossed paths today!`;
  }
  if (tier === 'acquaintance') {
    return def.traits.temperament === 'whimsical'
      ? `Hear the breeze today?`
      : `Morning, neighbor—good seeing you.`;
  }
  // Stranger tier keeps polite formal warmth based on temperament
  if (def.traits.temperament === 'spirited') return `Hey neighbor!`;
  if (def.traits.temperament === 'contemplative') return `Good day to you.`;
  return `Hello there.`;
}

function isSeatClaimed(world: WorldState, seatId: string, selfId: ResidentId): boolean {
  if (world.playerPosture === 'sitting' && world.playerSeatId === seatId) {
    return true;
  }
  for (let i = 0; i < RESIDENT_ORDER.length; i++) {
    const otherId = RESIDENT_ORDER[i];
    if (otherId === selfId) continue;
    const other = world.npcRuntime[otherId];
    if (!other) continue;
    if (other.reservedSeatId === seatId) return true;
  }
  return false;
}

function findMatchingExtraActivity(
  id: ResidentId,
  phase: TimePhase,
  activityId: string,
): ActivityCandidate | undefined {
  const extras = RESIDENT_EXTRA_ACTIVITIES[id];
  for (let i = 0; i < extras.length; i++) {
    if (`${phase}:${extras[i].id}` === activityId) return extras[i];
  }
  return undefined;
}

function selectActivityForResident(
  world: WorldState,
  id: ResidentId,
  phase: TimePhase,
  rt: NpcRuntimeState,
): {
  id: string;
  target: Vec2;
  placeName: string;
  activity: string;
  facingAngle: number;
  animState: NpcAnimationState;
  durationMinutes: number;
  seatId: string | null;
  utility: number;
} {
  const def = RESIDENTS[id];
  const flags = world.flags;
  const weather = world.weather;
  const minuteOfDay = world.minuteOfDay;
  const anchor = getResidentScheduleSlot(id, phase, flags.claraArthurReconciled);

  // Special Golden Hour reconciliation beats hold top priority
  if (flags.claraArthurReconciled && phase === 'golden' && (id === 'clara' || id === 'arthur')) {
    return {
      id: `${phase}:reconciled_gazebo`,
      target: anchor.target,
      placeName: anchor.placeName,
      activity: anchor.activity,
      facingAngle: anchor.facingAngle,
      animState: 'admire',
      durationMinutes: 90,
      seatId: null,
      utility: 2.5,
    };
  }

  // Late dusk wind-down toward each resident's home porch when tired
  if (minuteOfDay >= 1225 && def.homePos && isPointWalkable(def.homePos.x, def.homePos.z, 0.38)) {
    return {
      id: `${phase}:evening_home`,
      target: def.homePos,
      placeName: def.homeName,
      activity: 'Winding down on the porch before lantern curfew',
      facingAngle: anchor.facingAngle,
      animState: 'rest',
      durationMinutes: 65,
      seatId: null,
      utility: 1.55,
    };
  }

  const blockIndex = Math.floor(minuteOfDay / 45);
  const rand = mulberry32(hashSeed(world.simSeed, world.day, blockIndex, id));

  // Midday meal window boosts eat goals gently
  const isMealWindow = minuteOfDay >= 690 && minuteOfDay <= 820;
  const fatigueBoost = rt.needs.energy < 42 ? 0.45 : 0;
  const hungerBoost = rt.needs.hunger < 48 || isMealWindow ? 0.38 : 0;

  let bestOption: {
    id: string;
    target: Vec2;
    placeName: string;
    activity: string;
    facingAngle: number;
    animState: NpcAnimationState;
    score: number;
    seatId: string | null;
  } = {
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
    seatId: null,
  };

  // Early morning waking hour (< 430): morning larks step out briskly; night owls linger near home
  if (minuteOfDay < 430 && def.traits.morningLark < 0.55 && def.homePos && isPointWalkable(def.homePos.x, def.homePos.z, 0.38)) {
    bestOption = {
      id: `${phase}:morning_wake`,
      target: def.homePos,
      placeName: def.homeName,
      activity: 'Drinking a quiet morning mug on the stoop',
      facingAngle: anchor.facingAngle,
      animState: 'rest',
      score: 1.32,
      seatId: null,
    };
  }

  const extras = RESIDENT_EXTRA_ACTIVITIES[id];
  for (let i = 0; i < extras.length; i++) {
    const cand = extras[i];
    if (!cand.phases.includes(phase)) continue;
    if (cand.requiresFlag && !flags[cand.requiresFlag]) continue;
    if (cand.onlyWeathers && !cand.onlyWeathers.includes(weather)) continue;
    if (cand.seatId && isSeatClaimed(world, cand.seatId, id)) continue;

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

    if (cand.goalKind === 'rest') weight += fatigueBoost;
    if (cand.goalKind === 'eat') weight += hungerBoost;

    // Slight crowding penalty if >= 2 other NPCs already settled right on this spot
    let crowdedNeighbors = 0;
    for (let k = 0; k < RESIDENT_ORDER.length; k++) {
      const oid = RESIDENT_ORDER[k];
      if (oid === id) continue;
      const other = world.npcRuntime[oid];
      if (other && distance2D(other.targetPos, cand.target) < 0.95) {
        crowdedNeighbors += 1;
      }
    }
    if (crowdedNeighbors >= 2 && !cand.sheltered) {
      weight *= 0.55;
    }

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
        seatId: cand.seatId ?? null,
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
    seatId: bestOption.seatId,
    utility: bestOption.score,
  };
}

function updateResidentEmotionInPlace(
  world: WorldState,
  id: ResidentId,
  rt: NpcRuntimeState,
  dtMinutes: number,
): void {
  const rel = world.playerRelations?.[id];
  const needs = rt.needs;

  // Step continuous physiological/social needs cleanly
  const isResting = rt.animState === 'rest' || rt.animState === 'sit' || rt.posture === 'sitting';
  const isWorking = rt.animState === 'work' || rt.animState === 'walk';
  const isEating = rt.currentActivityId.includes('tea') || rt.currentActivityId.includes('bakery') || rt.currentActivityId.includes('loaf') || rt.currentActivityId.includes('bun');

  needs.energy = clampNeed(needs.energy + (isResting ? 0.55 : isWorking ? -0.18 : -0.07) * dtMinutes);
  needs.hunger = clampNeed(needs.hunger + (isEating ? 1.4 : -0.14) * dtMinutes);
  needs.social = clampNeed(needs.social + (rt.socialPartnerId ? 0.95 : -0.11) * dtMinutes);
  needs.fulfillment = clampNeed(
    needs.fulfillment +
      (rt.animState === 'work' || rt.animState === 'music' || rt.animState === 'sketch_read' || rt.animState === 'admire'
        ? 0.28
        : -0.04) *
        dtMinutes,
  );

  // Hysteresis lock keeps current emotion steady until emotionUntilMinute expires
  if (world.minuteOfDay < rt.emotionUntilMinute) return;

  let nextEmotion: CharacterEmotion = getInitialEmotionForResident(id, world.flags.claraArthurReconciled);
  let nextIntensity = 0.55;

  if (world.flags.bellRestored) {
    nextEmotion = 'happy';
    nextIntensity = 0.85;
  } else if (needs.energy < 28) {
    nextEmotion = 'tired';
    nextIntensity = 0.72;
  } else if (needs.hunger < 26) {
    nextEmotion = 'frustrated';
    nextIntensity = 0.65;
  } else if (rt.socialPartnerId) {
    nextEmotion = 'happy';
    nextIntensity = 0.78;
  } else if (world.weather === 'light_rain' && RESIDENTS[id].traits.rainBehavior === 'shelter_home') {
    nextEmotion = RESIDENTS[id].traits.outdoorsiness > 0.65 ? 'sad' : 'relaxed';
    nextIntensity = 0.6;
  } else if (rel && rel.affinity >= 65) {
    nextEmotion = 'happy';
    nextIntensity = 0.7;
  } else if (RESIDENTS[id].traits.curiosity >= 0.75) {
    nextEmotion = 'curious';
    nextIntensity = 0.62;
  }

  rt.emotion = nextEmotion;
  rt.emotionIntensity = nextIntensity;
  rt.emotionUntilMinute = world.minuteOfDay + 35;

  if (world.residents[id] && (!rel || world.minuteOfDay >= rel.moodUntilMinute)) {
    world.residents[id].mood = emotionToMood(nextEmotion);
  }
}

export function createInitialNpcRuntime(
  minuteOfDay: number,
  reconciled: boolean,
): Record<ResidentId, NpcRuntimeState> {
  const phase = getTimePhase(minuteOfDay);
  const out = {} as Record<ResidentId, NpcRuntimeState>;
  for (const id of RESIDENT_ORDER) {
    const slot = getResidentScheduleSlot(id, phase, reconciled);
    const baseEmotion = getInitialEmotionForResident(id, reconciled);
    const needs: NpcNeeds = {
      energy: id === 'pip' || id === 'jun' ? 88 : 82,
      social: RESIDENTS[id].traits.sociability > 0.65 ? 74 : 62,
      hunger: 80,
      fulfillment: 68,
    };
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
      emotion: baseEmotion,
      emotionIntensity: 0.6,
      emotionUntilMinute: minuteOfDay + 25,
      needs,
      posture: 'standing',
      reservedSeatId: null,
      goalUtility: 1.0,
      goalCommittedUntilMinute: minuteOfDay + 30,
      lastGreetedPlayerMinute: -999,
      activeBubbleText: null,
      activeBubbleUntilMinute: 0,
      targetLookPos: null,
      currentSpeed: 0,
    };
  }
  return out;
}

export function cloneNpcRuntime(
  runtime: Record<ResidentId, NpcRuntimeState>,
): Record<ResidentId, NpcRuntimeState> {
  const out = {} as Record<ResidentId, NpcRuntimeState>;
  for (const id of RESIDENT_ORDER) {
    const r = runtime[id];
    out[id] = {
      ...r,
      position: { x: r.position.x, z: r.position.z },
      targetPos: { x: r.targetPos.x, z: r.targetPos.z },
      waypoints: r.waypoints.map((w) => ({ x: w.x, z: w.z })),
      needs: { ...r.needs },
      targetLookPos: r.targetLookPos ? { x: r.targetLookPos.x, z: r.targetLookPos.z } : null,
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
    return { tag: 'helped_chore', label: 'Trading fresh rosemary sprigs and bakery garden tips' };
  }
  if (pair === 'arthur:barnaby') {
    return { tag: 'helped_chore', label: 'Comparing cedar joinery and pocket watch springs' };
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

function tryComputeEncounterSpots(
  posA: Vec2,
  posB: Vec2,
  includeThirdSpot: boolean,
): Vec2[] | null {
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
      if (includeThirdSpot) {
        const s2 = { x: midX - dz * 0.95, z: midZ + dx * 0.95 };
        if (isPointWalkable(s2.x, s2.z, 0.38)) {
          return [s0, s1, s2];
        }
      }
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
      rt.goalCommittedUntilMinute = world.minuteOfDay;
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
      nextRuntime[pid].goalCommittedUntilMinute = world.minuteOfDay;
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
 * Advances unified simulation clock, continuous NPC needs/emotions, utility goals,
 * seat reservation, autonomous greetings, and 2-3 NPC social encounters.
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
  const activeDialogueId = options.activeDialogueResidentId ?? null;
  const clockRate = options.clockRateMinutesPerSec ?? DEFAULT_CLOCK_RATE;
  const npcSpeed = options.npcSpeedPerSec ?? DEFAULT_NPC_SPEED;

  const dtMinutes = !paused && !dialogueOpen ? dt * clockRate : 0;
  if (dtMinutes > 0) {
    world.minuteOfDay = advanceSimulationClock(world.minuteOfDay, dtMinutes);
  }

  if (paused) return;

  if (!world.activeEncounters) world.activeEncounters = [];
  if (!world.worldEvents) world.worldEvents = [];
  if (!world.npcActivityHistory) world.npcActivityHistory = createInitialNpcActivityHistory();

  const phase = getTimePhase(world.minuteOfDay);

  // 1. Expire finished social encounters and greetings cleanly
  for (let k = world.activeEncounters.length - 1; k >= 0; k--) {
    const enc = world.activeEncounters[k];
    if (world.minuteOfDay >= enc.endsMinute) {
      clearEncounterForActors(world, enc);
      world.activeEncounters.splice(k, 1);
    }
  }

  // 2. Evaluate autonomous activity transitions, seat reservation, pathfinding & emotions per resident
  for (let i = 0; i < RESIDENT_ORDER.length; i++) {
    const id = RESIDENT_ORDER[i];
    const rt = world.npcRuntime[id];
    const def = RESIDENTS[id];

    // Hold and animate the resident currently speaking with the player
    if (dialogueOpen && activeDialogueId === id) {
      rt.currentSpeed = 0;
      rt.targetLookPos = world.playerPos;
      if (rt.posture !== 'sitting') {
        const playerYaw = Math.atan2(world.playerPos.x - rt.position.x, world.playerPos.z - rt.position.z);
        const diff = normalizeAngleDiff(playerYaw, rt.facing);
        rt.facing += diff * Math.min(1, dt * 8);
        rt.animState = 'talk';
      } else {
        rt.animState = 'sit';
      }
      continue;
    }

    if (rt.activeBubbleText && world.minuteOfDay >= rt.activeBubbleUntilMinute) {
      rt.activeBubbleText = null;
    }

    if (dtMinutes > 0) {
      updateResidentEmotionInPlace(world, id, rt, dtMinutes);
    }

    // If participating in an active social encounter, skip routine re-selection
    if (rt.socialPartnerId === null) {
      const activityPhasePrefix = `${phase}:`;
      const phaseChanged = !rt.currentActivityId.startsWith(activityPhasePrefix);
      const needsReconciledOverride =
        world.flags.claraArthurReconciled &&
        phase === 'golden' &&
        (id === 'clara' || id === 'arthur') &&
        rt.currentActivityId !== 'golden:reconciled_gazebo';
      const seatStolenByPlayer =
        rt.reservedSeatId !== null &&
        world.playerPosture === 'sitting' &&
        world.playerSeatId === rt.reservedSeatId;
      const dwellExpired =
        world.minuteOfDay >= rt.activityUntilMinute && world.minuteOfDay >= rt.goalCommittedUntilMinute;

      if (phaseChanged || needsReconciledOverride || seatStolenByPlayer || dwellExpired) {
        const chosen = selectActivityForResident(world, id, phase, rt);
        const goalChanged =
          chosen.id !== rt.currentActivityId ||
          Math.abs(rt.targetPos.x - chosen.target.x) > 0.05 ||
          Math.abs(rt.targetPos.z - chosen.target.z) > 0.05;

        if (goalChanged && rt.posture === 'sitting' && rt.reservedSeatId) {
          const prevSeat = getSeatById(rt.reservedSeatId);
          if (prevSeat && isPointWalkable(prevSeat.approachPos.x, prevSeat.approachPos.z, 0.38)) {
            rt.position.x = prevSeat.approachPos.x;
            rt.position.z = prevSeat.approachPos.z;
          }
          rt.posture = 'standing';
        }

        rt.currentActivityId = chosen.id;
        rt.currentPlaceName = chosen.placeName;
        rt.currentActivityLabel = chosen.activity;
        rt.targetFacing = chosen.facingAngle;
        rt.reservedSeatId = chosen.seatId;
        rt.goalUtility = chosen.utility;
        rt.activityUntilMinute = Math.min(DAY_END_MINUTE, world.minuteOfDay + chosen.durationMinutes);
        rt.goalCommittedUntilMinute = Math.min(DAY_END_MINUTE, world.minuteOfDay + 26);

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
      rt.posture = 'standing';
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
      rt.currentSpeed = step.movedDist / dt;

      if (step.arrived) {
        rt.waypoints.length = 0;
        rt.stuckSeconds = 0;
        rt.currentSpeed = 0;
        if (rt.reservedSeatId && !rt.socialPartnerId) {
          const seat = getSeatById(rt.reservedSeatId);
          if (seat) {
            rt.position.x = seat.seatPos.x;
            rt.position.z = seat.seatPos.z;
            rt.facing = seat.facingAngle;
            rt.targetFacing = seat.facingAngle;
            rt.posture = 'sitting';
            rt.animState = 'sit';
          } else {
            rt.animState = getDefaultPoseForSlot(id, phase);
          }
        } else {
          rt.animState = rt.socialPartnerId ? 'converse' : getDefaultPoseForSlot(id, phase);
        }
      } else {
        rt.animState = 'walk';
        rt.walkPhase += step.movedDist * 5.2;
        if (step.moveDirX !== 0 || step.moveDirZ !== 0) {
          const targetAngle = Math.atan2(step.moveDirX, step.moveDirZ);
          const diff = normalizeAngleDiff(targetAngle, rt.facing);
          rt.facing += diff * Math.min(1, dt * 10);
        }
        rt.targetLookPos = null;

        const expectedMin = npcSpeed * dt * 0.12;
        if (step.movedDist < expectedMin) {
          rt.stuckSeconds += dt;
          if (rt.stuckSeconds > 2.8) {
            // Hard recovery: drop stale waypoints so NPC never jitters indefinitely
            rt.stuckSeconds = 0;
            rt.waypoints.length = 0;
            rt.currentSpeed = 0;
            rt.animState = getDefaultPoseForSlot(id, phase);
          } else if (rt.stuckSeconds > 1.2) {
            rt.waypoints = computeWaypointPath(rt.position, rt.targetPos, 0.38);
          }
        } else {
          rt.stuckSeconds = 0;
        }
      }
    } else {
      rt.currentSpeed = 0;
      const isFreshGreeting =
        Boolean(rt.activeBubbleText) &&
        world.minuteOfDay < rt.activeBubbleUntilMinute - 5.4 &&
        rt.posture !== 'sitting' &&
        !rt.socialPartnerId;

      if (rt.socialPartnerId) {
        rt.animState = 'converse';
        const partnerPos = world.npcRuntime[rt.socialPartnerId].position;
        rt.targetFacing = Math.atan2(partnerPos.x - rt.position.x, partnerPos.z - rt.position.z);
        rt.targetLookPos = partnerPos;
      } else if (isFreshGreeting) {
        rt.animState = 'wave';
      } else if (rt.reservedSeatId) {
        const seat = getSeatById(rt.reservedSeatId);
        if (seat && distance2D(rt.position, seat.seatPos) < 0.35) {
          rt.posture = 'sitting';
          rt.animState = 'sit';
        }
      } else {
        const extra = findMatchingExtraActivity(id, phase, rt.currentActivityId);
        rt.animState = extra ? extra.animState : getDefaultPoseForSlot(id, phase);
      }

      const pDist = distance2D(world.playerPos, rt.position);
      const rel = world.playerRelations?.[id];
      const affinity = rel?.affinity ?? 0;
      const reliability = rel?.reliability ?? 25;
      const tier = getRelationshipTier(affinity);
      const guarded = isResidentGuarded(rel, rt.emotion);
      const baseGreetDist = def.traits.greetingDistance ?? 3.3;
      const greetDist = guarded
        ? baseGreetDist * 0.72
        : tier === 'close' || tier === 'kindred'
        ? baseGreetDist * 1.28
        : tier === 'friendly'
        ? baseGreetDist * 1.12
        : tier === 'stranger' && def.traits.sociability < 0.55
        ? baseGreetDist * 0.8
        : baseGreetDist;

      if (pDist < greetDist) {
        rt.targetLookPos = world.playerPos;
        if (!rt.reservedSeatId) {
          const playerYaw = Math.atan2(world.playerPos.x - rt.position.x, world.playerPos.z - rt.position.z);
          const diff = normalizeAngleDiff(playerYaw, rt.facing);
          rt.facing += diff * Math.min(1, dt * 4);
        }

        if (dtMinutes > 0 && !guarded && (tier === 'close' || tier === 'kindred')) {
          rt.needs.social = clampNeed(rt.needs.social + 0.35 * dtMinutes);
        }

        // NPC-initiated spontaneous greeting micro-bubble when player strolls close
        if (
          !dialogueOpen &&
          rt.emotion !== 'angry' &&
          rt.socialPartnerId === null &&
          world.minuteOfDay - rt.lastGreetedPlayerMinute >= GREETING_COOLDOWN_MINUTES
        ) {
          const met = world.residents[id]?.met ?? true;
          rt.lastGreetedPlayerMinute = world.minuteOfDay;
          rt.activeBubbleText = getGreetingBubbleText(id, rt.emotion, affinity, reliability, met);
          rt.activeBubbleUntilMinute = world.minuteOfDay + 8;
          if (rt.posture !== 'sitting' && rt.socialPartnerId === null && !guarded) {
            rt.animState = 'wave';
          }
        }
      } else {
        if (!rt.socialPartnerId) rt.targetLookPos = null;
        const diff = normalizeAngleDiff(rt.targetFacing, rt.facing);
        rt.facing += diff * Math.min(1, dt * 4);
      }
    }
  }

  // 3. Evaluate NPC-to-NPC social encounter pairing (bounded, supports 2-3 participants + mutual helping)
  const maxConcurrentEncounters = Math.max(2, Math.floor(RESIDENT_ORDER.length / 4));
  if (!dialogueOpen && world.activeEncounters.length < maxConcurrentEncounters) {
    const socialSlot = Math.floor(world.minuteOfDay / 15);
    for (let i = 0; i < RESIDENT_ORDER.length; i++) {
      if (world.activeEncounters.length >= maxConcurrentEncounters) break;
      const a = RESIDENT_ORDER[i];
      const rtA = world.npcRuntime[a];
      if (rtA.socialPartnerId !== null || rtA.waypoints.length > 0 || rtA.posture === 'sitting') continue;
      if (world.minuteOfDay < rtA.socialCooldownUntilMinute) continue;
      if (distance2D(world.playerPos, rtA.position) < 2.2) continue;

      for (let j = i + 1; j < RESIDENT_ORDER.length; j++) {
        const b = RESIDENT_ORDER[j];
        const rtB = world.npcRuntime[b];
        if (rtB.socialPartnerId !== null || rtB.waypoints.length > 0 || rtB.posture === 'sitting') continue;
        if (world.minuteOfDay < rtB.socialCooldownUntilMinute) continue;
        if (distance2D(world.playerPos, rtB.position) < 2.2) continue;
        if (distance2D(rtA.position, rtB.position) > 7.5) continue;

        const relAB = getNpcRelation(world.npcRelations, a, b);
        if (shouldSuppressNpcSocial(relAB)) continue;
        const npcTierAB = getNpcRelationTier(relAB);

        const encId = `enc_${world.day}_${socialSlot}_${a}_${b}`;
        if (world.worldEvents.some((e) => e.id === encId)) continue;

        const pairRand = mulberry32(hashSeed(world.simSeed, world.day, socialSlot, a, b))();
        const tierBonus =
          npcTierAB === 'confidant'
            ? 0.2
            : npcTierAB === 'warm'
            ? 0.1
            : npcTierAB === 'guarded'
            ? -0.18
            : 0;
        const pairChance = Math.max(
          0.12,
          0.32 + (RESIDENTS[a].traits.sociability + RESIDENTS[b].traits.sociability) * 0.25 + tierBonus,
        );
        if (pairRand > pairChance) continue;

        // Check for optional 3rd resident nearby for a 3-person cozy circle
        let thirdId: ResidentId | null = null;
        for (let k = j + 1; k < RESIDENT_ORDER.length; k++) {
          const c = RESIDENT_ORDER[k];
          const rtC = world.npcRuntime[c];
          if (rtC.socialPartnerId !== null || rtC.waypoints.length > 0 || rtC.posture === 'sitting') continue;
          if (world.minuteOfDay < rtC.socialCooldownUntilMinute) continue;
          if (distance2D(world.playerPos, rtC.position) < 2.2) continue;
          if (distance2D(rtA.position, rtC.position) > 5.8) continue;
          if (
            shouldSuppressNpcSocial(getNpcRelation(world.npcRelations, a, c)) ||
            shouldSuppressNpcSocial(getNpcRelation(world.npcRelations, b, c))
          ) {
            continue;
          }
          thirdId = c;
          break;
        }

        const spots = tryComputeEncounterSpots(rtA.position, rtB.position, thirdId !== null);
        if (!spots) continue;
        if (spots.length < 3) thirdId = null;

        const participants: ResidentId[] = thirdId ? [a, b, thirdId] : [a, b];
        const topic = buildSocialTopic(a, b, world.flags);
        const endsMinute = Math.min(DAY_END_MINUTE, world.minuteOfDay + SOCIAL_ENCOUNTER_DURATION_MINUTES);
        const cooldownUntil = endsMinute + SOCIAL_COOLDOWN_MINUTES;

        const summaryActors = thirdId
          ? `${RESIDENTS[a].name}, ${RESIDENTS[b].name} & ${RESIDENTS[thirdId].name}`
          : `${RESIDENTS[a].name} & ${RESIDENTS[b].name}`;

        const encounter: ActiveSocialEncounter = {
          id: encId,
          participants,
          topicTag: topic.tag,
          summary: `${summaryActors}: ${topic.label}`,
          spots: spots.slice(0, participants.length),
          startedMinute: world.minuteOfDay,
          endsMinute,
        };
        world.activeEncounters.push(encounter);

        // Configure each participant cleanly
        for (let pIdx = 0; pIdx < participants.length; pIdx++) {
          const pid = participants[pIdx];
          const nextPartner = participants[(pIdx + 1) % participants.length];
          const rt = world.npcRuntime[pid];
          const spot = spots[pIdx];
          const faceSpot = spots[(pIdx + 1) % participants.length];

          rt.socialPartnerId = nextPartner;
          rt.socialCooldownUntilMinute = cooldownUntil;
          rt.reservedSeatId = null;
          rt.targetPos.x = spot.x;
          rt.targetPos.z = spot.z;
          rt.targetFacing = Math.atan2(faceSpot.x - spot.x, faceSpot.z - spot.z);
          rt.waypoints = computeWaypointPath(rt.position, spot, 0.38);
          rt.currentActivityLabel = `Chatting with ${RESIDENTS[nextPartner].name}`;
          rt.emotion = 'happy';
          rt.emotionIntensity = 0.72;
          rt.emotionUntilMinute = endsMinute + 20;
          if (topic.tag === 'helped_chore') {
            rt.needs.fulfillment = clampNeed(rt.needs.fulfillment + 8);
          }
        }

        const affinityGain =
          topic.tag === 'helped_chore' || npcTierAB === 'confidant'
            ? 4
            : npcTierAB === 'guarded'
            ? 2
            : 3;
        const tensionDelta = npcTierAB === 'guarded' ? -3 : -2;
        for (let p1 = 0; p1 < participants.length; p1++) {
          for (let p2 = p1 + 1; p2 < participants.length; p2++) {
            applyNpcSocialRelationInPlace(
              world.npcRelations,
              participants[p1],
              participants[p2],
              world.day,
              topic.tag,
              affinityGain,
              tensionDelta,
            );
          }
        }

        pushWorldEventInPlace(world.worldEvents, {
          id: encId,
          day: world.day,
          phase,
          minuteOfDay: Math.round(world.minuteOfDay),
          kind: 'npc_social',
          actors: participants,
          summary: `${summaryActors} paused near ${rtA.currentPlaceName} — ${topic.label.toLowerCase()}.`,
          summaryTag: `chat_${getNpcPairKey(a, b)}`,
        });

        propagateEncounterGossipInPlace(world, participants, encId);
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
    worldProps: world.worldProps ? { ...world.worldProps } : world.worldProps,
    npcRuntime: cloneNpcRuntime(world.npcRuntime),
    npcRelations: { ...world.npcRelations },
    activeEncounters: world.activeEncounters.map((e) => ({
      ...e,
      participants: [...e.participants],
      spots: e.spots.map((s) => ({ ...s })),
    })),
    worldEvents: [...world.worldEvents],
    npcActivityHistory: RESIDENT_ORDER.reduce((acc, id) => {
      acc[id] = [...(world.npcActivityHistory[id] ?? [])];
      return acc;
    }, {} as Record<ResidentId, import('./types').ResidentActivityEntry[]>),
    topicHistory: { ...(world.topicHistory ?? {}) },
    lastTopicByResident: { ...(world.lastTopicByResident ?? {}) },
    sideFlags: { ...(world.sideFlags ?? {}) },
    storylines: cloneStorylines(world.storylines),
    npcMemories: cloneNpcMemories(world.npcMemories),
  };
  stepSimulationInPlace(next, dtSeconds, options);
  return next;
}
