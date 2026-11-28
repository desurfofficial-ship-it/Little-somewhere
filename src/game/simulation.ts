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
  ActivityGoalKind,
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
  getNpcRelationTierFast,
  getRelationshipTier,
  isResidentGuarded,
  pushNpcActivityHistoryInPlace,
  pushWorldEventInPlace,
  shouldSuppressNpcSocial,
} from './relationships';
import {
  adjustNpcPerceptionInPlace,
  cloneNpcPerceptions,
  getPerceivedTierFast,
} from './perceptions';
import { cloneGardens, getGardenState, tendResidentGardenInPlace } from './gardens';
import {
  computeSeparationVector,
  computeWaypointPath,
  stepAlongWaypoints,
} from './navigation';
import {
  cloneNpcMemories,
  collectWitnessesForPosition,
  computePlaceAffinityBias,
  createNpcMemoryEntry,
  LOCAL_WITNESS_RADIUS,
  propagateEncounterGossipInPlace,
  recordNpcMemoryInPlace,
} from './memories';
import { cloneStorylines } from './storylines';
import { expireInvitationsInPlace } from './invitations';
import { discoverExplorationInPlace } from './exploration';
import { distance2D, getLandmarkAt, getSeatById, isPointWalkable } from './worldMap';

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

/** Bounded append: returns a new array keeping at most `cap` most-recent entries. */
function pushBounded<T>(arr: T[] | undefined, value: T, cap: number): T[] {
  const next = arr ? [...arr, value] : [value];
  if (next.length > cap) next.splice(0, next.length - cap);
  return next;
}

function getDefaultPoseForSlot(id: ResidentId, phase: TimePhase): NpcAnimationState {
  if (id === 'sora' && (phase === 'afternoon' || phase === 'dusk')) return 'music';
  if (id === 'toby') return 'sketch_read';
  if (id === 'nora' && phase === 'afternoon') return 'sketch_read';
  if (id === 'clara' && (phase === 'morning' || phase === 'dusk')) return 'work';
  if (id === 'arthur' && (phase === 'morning' || phase === 'dusk')) return 'work';
  if (id === 'mina' && (phase === 'morning' || phase === 'dusk')) return 'work';
  if (id === 'barnaby' && phase !== 'dusk') return 'work';
  if (id === 'rowan') {
    return phase === 'golden' || phase === 'dusk' ? 'sketch_read' : 'work';
  }
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

/**
 * B6: derive an effective goal kind for the current activity so need
 * satisfaction (rest→energy, eat→hunger, …) is read from declared semantics
 * rather than the fragile `isEating` substring heuristic on activityId.
 */
function effectiveGoalKindForActivity(
  id: ResidentId,
  phase: TimePhase,
  activityId: string,
  animState: NpcAnimationState,
): ActivityGoalKind | null {
  const extra = findMatchingExtraActivity(id, phase, activityId);
  if (extra?.goalKind) return extra.goalKind;
  // Anchor / override: infer a lightweight kind from the resolved anim state.
  if (animState === 'rest' || animState === 'sit') return 'rest';
  if (animState === 'work') return 'work';
  if (animState === 'sketch_read' || animState === 'music' || animState === 'admire') return 'leisure';
  return null;
}

/**
 * B3: graded need urgency (0..1), only fires below a threshold. Replaces the
 * old binary fatigueBoost/hungerBoost so all four needs — including social and
 * fulfillment — can actually drive activity selection.
 */
function needUrgency(value: number, threshold: number): number {
  return value < threshold ? (threshold - value) / threshold : 0;
}

function needUtilityForGoal(
  goalKind: ActivityGoalKind | null,
  uEnergy: number,
  uHunger: number,
  uSocial: number,
  uFulfillment: number,
): number {
  let u = 1.0;
  if (goalKind === 'rest') u += uEnergy * 1.6;
  else if (goalKind === 'eat') u += uHunger * 1.6;
  else if (goalKind === 'social') u += uSocial * 1.4;
  else if (goalKind === 'leisure') u += uFulfillment * 1.0;
  else if (goalKind === 'work') u += uFulfillment * 0.6;
  return u;
}

/**
 * B4: emotion feedback. The NPC's current emotion biases which goal kinds feel
 * appealing — closing the open loop where emotion was computed every tick but
 * never fed back into activity selection. A frustrated NPC avoids social
 * candidates; a tired NPC favors rest; a curious NPC gravitates to leisure.
 */
function emotionBiasForGoal(emotion: CharacterEmotion, goalKind: ActivityGoalKind | null): number {
  if (!goalKind) return 1.0;
  switch (emotion) {
    case 'tired':
      return goalKind === 'rest'
        ? 1.30
        : goalKind === 'work'
        ? 0.85
        : goalKind === 'social'
        ? 0.88
        : 1.0;
    case 'frustrated':
    case 'angry':
      return goalKind === 'social'
        ? 0.70
        : goalKind === 'rest'
        ? 1.20
        : goalKind === 'eat'
        ? 1.15
        : goalKind === 'work'
        ? 1.05
        : 1.0;
    case 'sad':
      return goalKind === 'rest'
        ? 1.15
        : goalKind === 'social'
        ? 0.90
        : goalKind === 'leisure'
        ? 1.05
        : 1.0;
    case 'happy':
    case 'excited':
      return goalKind === 'social'
        ? 1.18
        : goalKind === 'leisure'
        ? 1.10
        : goalKind === 'work'
        ? 0.97
        : goalKind === 'rest'
        ? 0.92
        : 1.0;
    case 'curious':
      return goalKind === 'leisure' ? 1.20 : goalKind === 'work' ? 0.97 : 1.0;
    default:
      return 1.0;
  }
}

/** B5: deterministic goalKind tiebreak so genuine score ties resolve by intent. */
function tiebreakForGoal(goalKind: ActivityGoalKind | null): number {
  if (goalKind === 'rest') return 0.001;
  if (goalKind === 'eat') return 0.0005;
  return 0;
}

/** A3: activity-kind-varied dwell durations (in-game minutes). */
function dwellRangeForGoal(goalKind: ActivityGoalKind | null): [number, number] {
  switch (goalKind) {
    case 'work':
      return [55, 90];
    case 'eat':
      return [18, 32];
    case 'rest':
      return [30, 48];
    case 'social':
      return [38, 58];
    case 'leisure':
      return [30, 52];
    default:
      return [44, 72];
  }
}

/** B2: preferred-zone affinity multiplier derived from the landmark at a target. */
function zoneAffinityForTarget(preferredZones: readonly string[], target: Vec2): number {
  const zoneId = getLandmarkAt(target).id;
  return preferredZones.includes(zoneId) ? 1.20 : 0.95;
}

/** C5: companion bias — a candidate near a confidant's current position is gently favoured. */
function companionBiasForTarget(confidantPositions: readonly Vec2[], target: Vec2): number {
  for (let k = 0; k < confidantPositions.length; k++) {
    if (distance2D(confidantPositions[k], target) < 3.0) return 1.12;
  }
  return 1.0;
}

/**
 * S2 (commitment hysteresis): a continuation bonus for the resident's current
 * activity so near-equal scores resolve to "stay" rather than flip-flopping every
 * dwell window. Applied ONLY when the candidate id === rt.currentActivityId.
 * The A5 repeat-suppressor (history, last-2) and S2 (current) operate on different
 * sets, so they never conflict.
 */
const CONTINUATION_BONUS = 1.12;

/**
 * S3 (short-term intention): a deterministic, derived forward-looking signal
 * from the resident's own needs + memories + nearest confidant. No new RNG, no
 * persistence — recomputed at every re-selection. Returns a multiplicative bias
 * for matching/violating candidates.
 */
interface ShortTermIntention {
  kind: 'seek_zone' | 'avoid_zone' | 'seek_resident' | 'rest' | 'none';
  target?: string; // zoneId or residentId
  strength: number; // 0..1
}

function deriveShortTermIntention(
  world: WorldState,
  id: ResidentId,
  rt: NpcRuntimeState,
  memories: readonly import('./types').NpcMemoryEntry[],
): ShortTermIntention {
  const day = world.day;
  // (a) Strongest unmet need → rest intention.
  if (rt.needs.energy < 30) return { kind: 'rest', strength: 0.6 };
  // (b) Top emotionalWeight non-expired memory with placeZoneId → seek/avoid zone.
  let topWarm: { zoneId: string; weight: number } | null = null;
  let topTense: { zoneId: string; weight: number } | null = null;
  for (let i = 0; i < memories.length; i++) {
    const m = memories[i];
    const zone = m.detail?.placeZoneId;
    if (!zone) continue;
    // Expired check (inline, no import churn).
    if (m.retention !== 'permanent' && m.expiresDay !== undefined && day > m.expiresDay) continue;
    if (m.valence === 'warm' && (!topWarm || m.emotionalWeight > topWarm.weight)) {
      topWarm = { zoneId: zone, weight: m.emotionalWeight };
    } else if (m.valence === 'tense' && (!topTense || m.emotionalWeight > topTense.weight)) {
      topTense = { zoneId: zone, weight: m.emotionalWeight };
    }
  }
  // A tense memory outweighs a warm one of equal weight (avoidance is stronger).
  if (topTense && topTense.weight >= 50) {
    return { kind: 'avoid_zone', target: topTense.zoneId, strength: Math.min(0.5, topTense.weight / 100) };
  }
  if (topWarm && topWarm.weight >= 50) {
    return { kind: 'seek_zone', target: topWarm.zoneId, strength: Math.min(0.4, topWarm.weight / 100) };
  }
  return { kind: 'none', strength: 0 };
}

/** S3: apply the intention as a multiplicative bias for a candidate zone. */
function intentionBiasForCandidate(
  intention: ShortTermIntention,
  candidateZoneId: string,
  candidateGoalKind: ActivityGoalKind | null,
): number {
  if (intention.kind === 'rest') {
    return candidateGoalKind === 'rest' ? 1 + intention.strength * 0.3 : 1.0;
  }
  if (intention.kind === 'seek_zone' && intention.target === candidateZoneId) {
    return 1 + intention.strength * 0.25;
  }
  if (intention.kind === 'avoid_zone' && intention.target === candidateZoneId) {
    return 1 - intention.strength * 0.35;
  }
  return 1.0;
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

  // B3: graded need urgency (0..1, only below threshold). Replaces the old
  // binary fatigueBoost/hungerBoost so social & fulfillment also drive choice.
  const isMealWindow = minuteOfDay >= 690 && minuteOfDay <= 820;
  const uEnergy = needUrgency(rt.needs.energy, 42);
  const uHunger = Math.max(needUrgency(rt.needs.hunger, 48), isMealWindow ? 0.4 : 0);
  const uSocial = needUrgency(rt.needs.social, 40);
  const uFulfillment = needUrgency(rt.needs.fulfillment, 35);

  const anchorAnimState = getDefaultPoseForSlot(id, phase);
  const anchorGoalKind: ActivityGoalKind | null = effectiveGoalKindForActivity(
    id,
    phase,
    `${phase}:anchor`,
    anchorAnimState,
  );

  // S1+S3 (memory→behavior bridge): derive the resident's place-affinity and
  // short-term intention from their OWN memories. This is the central ask —
  // memories now drive activity selection, not just dialogue. O(14) at re-
  // selection only; zero per-tick cost; no new RNG.
  const ownMemories = world.npcMemories[id] ?? [];
  const intention = deriveShortTermIntention(world, id, rt, ownMemories);
  const anchorZoneId = getLandmarkAt(anchor.target).id;
  const anchorPlaceBias = computePlaceAffinityBias(ownMemories, anchorZoneId, world.day);
  const anchorIntentionBias = intentionBiasForCandidate(intention, anchorZoneId, anchorGoalKind);
  // S2: continuation bonus if the resident is already on the anchor.
  const anchorContinuation = rt.currentActivityId === `${phase}:anchor` ? CONTINUATION_BONUS : 1.0;

  // B5: tightened RNG jitter (±10% vs old ±25%) so trait/need/emotion signal
  // dominates noise. RNG call COUNT and ORDER are preserved (1 call for the
  // anchor, 1 per evaluated extra, 1 for duration) so the seeded stream and
  // twin-determinism invariant are unchanged.
  const anchorJitter = rand() * 0.20; // 0..0.20 (single draw, mirrors old count)
  const isRainShy =
    weather === 'light_rain' && def.traits.rainBehavior !== 'umbrella_stroll';
  const anchorBase = isRainShy ? 0.55 + anchorJitter : 0.95 + anchorJitter;

  let bestOption: {
    id: string;
    target: Vec2;
    placeName: string;
    activity: string;
    facingAngle: number;
    animState: NpcAnimationState;
    score: number;
    seatId: string | null;
    goalKind: ActivityGoalKind | null;
  } = {
    id: `${phase}:anchor`,
    target: anchor.target,
    placeName: anchor.placeName,
    activity: anchor.activity,
    facingAngle: anchor.facingAngle,
    animState: anchorAnimState,
    score:
      anchorBase *
        zoneAffinityForTarget(def.traits.preferredZones, anchor.target) *
        needUtilityForGoal(anchorGoalKind, uEnergy, uHunger, uSocial, uFulfillment) *
        emotionBiasForGoal(rt.emotion, anchorGoalKind) *
        (1 + anchorPlaceBias) *
        anchorIntentionBias *
        anchorContinuation +
      tiebreakForGoal(anchorGoalKind),
    seatId: null,
    goalKind: anchorGoalKind,
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
      goalKind: 'rest',
    };
  }

  // A5: activity-history repeat suppression — penalise candidates re-picked
  // within the last couple of recorded entries so residents don't loop the same
  // micro-activity block after block. `npcActivityHistory[id][0..1]` are the
  // two most recent transitions.
  const recentActivityIds = (world.npcActivityHistory?.[id] ?? [])
    .slice(0, 2)
    .map((e) => e.activityId);

  // C5: companion bias — collect current positions of confidant-tier partners
  // so candidates near a close friend get a small gravitation bonus (residents
  // drift toward friends rather than only repelling via the crowding penalty).
  // Uses getPerceivedTierFast (S4 directional, zero-GC) so A gravitates toward
  // B based on A's OWN perception of B, not just the bilateral ledger.
  const confidantPositions: Vec2[] = [];
  for (let k = 0; k < RESIDENT_ORDER.length; k++) {
    const oid = RESIDENT_ORDER[k];
    if (oid === id) continue;
    if (getPerceivedTierFast(world.npcRelations, world.npcPerceptions, id, oid) === 'confidant') {
      confidantPositions.push(world.npcRuntime[oid].position);
    }
  }

  const extras = RESIDENT_EXTRA_ACTIVITIES[id];
  for (let i = 0; i < extras.length; i++) {
    const cand = extras[i];
    if (!cand.phases.includes(phase)) continue;
    if (cand.requiresFlag && !flags[cand.requiresFlag]) continue;
    if (cand.requiresSideFlag && !world.sideFlags?.[cand.requiresSideFlag]) continue;
    if (cand.onlyWeathers && !cand.onlyWeathers.includes(weather)) continue;
    if (cand.seatId && isSeatClaimed(world, cand.seatId, id)) continue;
    // A1: skip activities recently found unreachable via stuck-recovery.
    const candActivityId = `${phase}:${cand.id}`;
    if (rt.blockedActivityIds?.includes(candActivityId)) continue;

    // Resident-garden eligibility: the garden-tend candidate fires at most once
    // per in-game day. Skip it entirely when the garden was already tended today
    // (lastTendedDay === world.day). When it IS eligible, apply a strong "my
    // garden needs me" urgency boost (below) so the candidate reliably overcomes
    // the anchor's continuation bonus — without this, baseWeight 1.0 never wins
    // and the autonomous-tending feature stays inert (verified: 0 selections
    // across 30k ticks pre-fix). After tending, lastTendedDay is set and this
    // branch skips the candidate for the rest of the day, preventing repeat visits.
    const gardenNeedsTend =
      cand.gardenId &&
      !(getGardenState(world, cand.gardenId)?.lastTendedDay === world.day);
    if (cand.gardenId && !gardenNeedsTend) continue;

    const candGoalKind = cand.goalKind ?? null;

    let weight = cand.baseWeight;
    if (gardenNeedsTend) {
      weight *= 1.8;
    }
    if (weather === 'light_rain') {
      if (cand.preferredWeathers?.includes('light_rain') || cand.sheltered) {
        weight *= def.traits.rainBehavior === 'umbrella_stroll' ? 1.15 : 2.1;
      } else {
        weight *= def.traits.rainBehavior === 'umbrella_stroll' ? 0.9 : 0.35;
      }
    } else if (cand.preferredWeathers && !cand.preferredWeathers.includes(weather)) {
      weight *= 0.6;
    }

    // A5: dampen recently-repeated activities so routines stay varied.
    if (recentActivityIds.includes(candActivityId)) {
      weight *= 0.45;
    }

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

    // S1+S2+S3: place-affinity bias from memories, continuation hysteresis,
    // and short-term intention. All deterministic, no new RNG.
    const candZoneId = getLandmarkAt(cand.target).id;
    const candPlaceBias = computePlaceAffinityBias(ownMemories, candZoneId, world.day);
    const candIntentionBias = intentionBiasForCandidate(intention, candZoneId, candGoalKind);
    const candContinuation = rt.currentActivityId === candActivityId ? CONTINUATION_BONUS : 1.0;

    const score =
      weight *
        traitModifier *
        zoneAffinityForTarget(def.traits.preferredZones, cand.target) *
        needUtilityForGoal(candGoalKind, uEnergy, uHunger, uSocial, uFulfillment) *
        emotionBiasForGoal(rt.emotion, candGoalKind) *
        companionBiasForTarget(confidantPositions, cand.target) *
        (1 + candPlaceBias) *
        candIntentionBias *
        candContinuation *
        (0.90 + rand() * 0.20) +
      tiebreakForGoal(candGoalKind);
    if (score > bestOption.score) {
      bestOption = {
        id: candActivityId,
        target: cand.target,
        placeName: cand.placeName,
        activity: cand.activity,
        facingAngle: cand.facingAngle,
        animState: cand.animState,
        score,
        seatId: cand.seatId ?? null,
        goalKind: candGoalKind,
      };
    }
  }

  // A3: activity-kind-varied dwell durations instead of a uniform 44–72 window.
  const [dwellMin, dwellMax] = dwellRangeForGoal(bestOption.goalKind);
  return {
    id: bestOption.id,
    target: bestOption.target,
    placeName: bestOption.placeName,
    activity: bestOption.activity,
    facingAngle: bestOption.facingAngle,
    animState: bestOption.animState,
    durationMinutes: seededInt(rand, dwellMin, dwellMax),
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

  // B6: derive need satisfaction from the activity's declared goalKind instead
  // of the fragile `isEating` substring heuristic (which false-positive matched
  // anchor labels containing "loaf"/"bakery"). Anchors now only count as eating
  // when their resolved goal kind is 'eat'.
  const emotionPhase = getTimePhase(world.minuteOfDay);
  const currentGoalKind = effectiveGoalKindForActivity(id, emotionPhase, rt.currentActivityId, rt.animState);
  const isResting = rt.animState === 'rest' || rt.animState === 'sit' || rt.posture === 'sitting';
  const isWorking = rt.animState === 'work' || rt.animState === 'walk';
  const isEating = currentGoalKind === 'eat';

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

  // B1: the emotion cascade now computes the natural emotion FIRST (driven by
  // needs, social partner, weather, affinity, curiosity), then applies the
  // restored-bell as a gentle mood BOOST rather than a short-circuit override.
  // Previously `bellRestored` flattened every NPC to permanently "happy",
  // erasing tired/frustrated/sad states even when their needs warranted them.
  let nextEmotion: CharacterEmotion = getInitialEmotionForResident(id, world.flags.claraArthurReconciled);
  let nextIntensity = 0.55;

  if (needs.energy < 28) {
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

  // B1: a restored bell lifts the neighborhood's spirits — but as a modifier,
  // not an override. A bone-tired or hungry resident still reads as such; a
  // content resident just feels a little warmer about the bell.
  if (world.flags.bellRestored) {
    if (nextEmotion === 'sad' || nextEmotion === 'frustrated' || nextEmotion === 'angry') {
      // The bell softens, but doesn't erase, a low mood.
      nextIntensity = Math.min(0.8, nextIntensity + 0.1);
    } else {
      nextIntensity = Math.min(0.9, nextIntensity + 0.15);
      if (nextEmotion === 'relaxed' || nextEmotion === 'curious') {
        nextEmotion = 'happy';
      }
    }
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
      blockedActivityIds: [],
      unstuckSeconds: 0,
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
      blockedActivityIds: r.blockedActivityIds ? [...r.blockedActivityIds] : [],
      // QA-SIM D1: clone the ephemeral unstuckSeconds so the pure stepSimulation
      // path and the in-place path share the same view of free-movement time
      // (twin-determinism when blockedActivityIds is non-empty).
      unstuckSeconds: r.unstuckSeconds ?? 0,
    };
  }
  return out;
}

function buildSocialTopic(
  a: ResidentId,
  b: ResidentId,
  flags: StoryFlags,
  sideFlags?: Record<string, boolean | number | string>,
  inOrchard = false,
): { tag: string; label: string } {
  const pair = getNpcPairKey(a, b);
  if (inOrchard || (sideFlags?.orchardGatheringComplete && (a === 'rowan' || b === 'rowan'))) {
    if (sideFlags?.orchardGatheringOutcome === 'blossom_honey_picnic') {
      return {
        tag: 'orchard_tea_talk',
        label: 'Trading honeyed chamomile notes beneath Fern Hollow’s lantern garlands',
      };
    }
    if (sideFlags?.orchardGatheringComplete) {
      return {
        tag: 'orchard_tart_talk',
        label: 'Savoring spiced crabapple recipes beside the orchard tasting table',
      };
    }
    if (pair === 'clara:rowan' || pair === 'mina:rowan' || pair === 'barnaby:rowan') {
      return {
        tag: 'orchard_blossoms',
        label: 'Checking crabapple blossoms and bee skep clover beneath the boughs',
      };
    }
  }
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
    expireInvitationsInPlace(world);
  }

  if (paused) return;

  if (!world.activeEncounters) world.activeEncounters = [];
  if (!world.worldEvents) world.worldEvents = [];
  if (!world.npcActivityHistory) world.npcActivityHistory = createInitialNpcActivityHistory();

  const phase = getTimePhase(world.minuteOfDay);

  // 0. Wild Hollows exploration discoveries (Build 10): deterministic, exterior-only,
  // pure in-place sideFlag + journal memory grant — same discipline as encounters.
  {
    const outside = world.playerLocation === 'exterior';
    const ex = outside ? world.playerPos.x : world.exteriorPlayerPos.x;
    const ez = outside ? world.playerPos.z : world.exteriorPlayerPos.z;
    discoverExplorationInPlace(world, ex, ez);
  }

  // 1. Expire finished social encounters and greetings cleanly
  for (let k = world.activeEncounters.length - 1; k >= 0; k--) {
    const enc = world.activeEncounters[k];
    if (world.minuteOfDay >= enc.endsMinute) {
      clearEncounterForActors(world, enc);
      world.activeEncounters.splice(k, 1);
    }
  }

  // 2. Evaluate autonomous activity transitions, seat reservation, pathfinding & emotions per resident
  const indoorResidentId = world.occupancy?.residentId ?? null;
  for (let i = 0; i < RESIDENT_ORDER.length; i++) {
    const id = RESIDENT_ORDER[i];
    if (indoorResidentId === id) continue;
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

      // A2: event-driven re-evaluation — an urgent need (exhaustion or hunger)
      // past the goal-commit window lets a resident abandon a non-addressing
      // activity before its full dwell expires, so an NPC doesn't keep "admiring
      // the fountain" while starving. Bounded by goalCommittedUntilMinute so it
      // can't thrash; currentGoalKind derived from the live anim state.
      const currentGk = effectiveGoalKindForActivity(id, phase, rt.currentActivityId, rt.animState);
      const urgentNeedUnmet =
        world.minuteOfDay >= rt.goalCommittedUntilMinute &&
        ((rt.needs.energy < 30 && currentGk !== 'rest') ||
          (rt.needs.hunger < 30 && currentGk !== 'eat'));

      if (phaseChanged || needsReconciledOverride || seatStolenByPlayer || dwellExpired || urgentNeedUnmet) {
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

        // Character-quality program (Workstream C): the player stole this resident's
        // reserved seat — an organic frustrated huff plus a one-shot bubble. Fires
        // exactly once per steal: this re-selection reassigns reservedSeatId away
        // from the player-occupied seat (isSeatClaimed excludes it), so the trigger
        // cannot re-fire while the emotion window is live.
        if (seatStolenByPlayer && rt.emotion !== 'angry' && world.minuteOfDay >= rt.emotionUntilMinute) {
          rt.emotion = 'frustrated';
          rt.emotionIntensity = 0.7;
          rt.emotionUntilMinute = Math.min(DAY_END_MINUTE, world.minuteOfDay + 12);
          rt.activeBubbleText = 'Oh — I was just resting there.';
          rt.activeBubbleUntilMinute = Math.min(DAY_END_MINUTE, world.minuteOfDay + 6);
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
          rt.waypoints = computeWaypointPath(rt.position, rt.targetPos, 0.38) ?? [];
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
      // Overhaul G-4: the player is a physical body too — residents separate
      // from the player instead of walking straight through them.
      _otherPositions.push(world.playerPos);
      const sep = computeSeparationVector(rt.position, _otherPositions, 0.95);
      // A4: per-resident walk speed scaled by morning-lark energy — energetic
      // residents (Pip, Jun) stride a little quicker, contemplative ones
      // (Arthur, Toby) amble. Deterministic; bounded to +/-~10%.
      const residentSpeed = npcSpeed * (0.9 + def.traits.morningLark * 0.2);
      const step = stepAlongWaypoints(rt.position, rt.waypoints, residentSpeed, dt, sep, 0.38);

      rt.position.x = step.nextPos.x;
      rt.position.z = step.nextPos.z;
      rt.currentSpeed = step.movedDist / dt;

      if (step.arrived) {
        rt.waypoints.length = 0;
        rt.stuckSeconds = 0;
        rt.currentSpeed = 0;
        // Resident-owned garden arrival hook: if the NPC arrived at a garden-tend
        // activity, fire tendResidentGardenInPlace once (idempotent via
        // GardenState.lastTendedDay). This is the only place NPC gardening
        // actually happens — the candidate routes them here, the arrival fires
        // the reducer, and the lastTendedDay gate prevents re-tending.
        if (rt.socialPartnerId === null) {
          const extra = findMatchingExtraActivity(id, phase, rt.currentActivityId);
          if (extra?.gardenId) {
            tendResidentGardenInPlace(world, extra.gardenId, id);
          }
        }
        if (rt.reservedSeatId && !rt.socialPartnerId) {
          const seat = getSeatById(rt.reservedSeatId);
          // Overhaul G-7: never teleport a resident onto a seat the player is
          // currently sitting on — the 1-tick overlap window is closed and the
          // next tick's steal reconciliation re-seats the resident elsewhere.
          const seatHeldByPlayer =
            world.playerSeatId === rt.reservedSeatId && world.playerPosture === 'sitting';
          if (seat && !seatHeldByPlayer) {
            rt.position.x = seat.seatPos.x;
            rt.position.z = seat.seatPos.z;
            // Character-quality program (Workstream B): no instant facing snap on
            // arrival — targetFacing glides the body into the chair via the
            // settled-branch facing ease below.
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

        const expectedMin = residentSpeed * dt * 0.12;
        if (step.movedDist < expectedMin) {
          rt.stuckSeconds += dt;
          if (rt.stuckSeconds > 2.8) {
            // A1: hard recovery used to drop waypoints but leave the NPC frozen
            // for up to ~33 real seconds holding a stale activity label (the
            // next re-selection only fired on dwell-expiry). Now force an
            // immediate re-selection by expiring both timers, and suppress the
            // unreachable target so the resident picks a reachable alternative.
            rt.stuckSeconds = 0;
            rt.waypoints.length = 0;
            rt.currentSpeed = 0;
            rt.animState = getDefaultPoseForSlot(id, phase);
            rt.activityUntilMinute = world.minuteOfDay;
            rt.goalCommittedUntilMinute = world.minuteOfDay;
            rt.unstuckSeconds = 0;
            if (rt.currentActivityId && !rt.currentActivityId.endsWith(':anchor')) {
              rt.blockedActivityIds = pushBounded(
                rt.blockedActivityIds,
                rt.currentActivityId,
                4,
              );
            }
          } else if (rt.stuckSeconds > 1.2) {
            rt.waypoints = computeWaypointPath(rt.position, rt.targetPos, 0.38) ?? [];
          }
        } else {
          // A1 (Finding 7): the NPC is moving freely. Once it has been unstuck
          // for a few seconds, clear the blocked-activity list so a transient
          // obstruction (another NPC walking through) doesn't blacklist a now-
          // reachable activity for the rest of the day. Tracked on the runtime
          // record (ephemeral — sanitizer strips it, never persisted) and cloned
          // by cloneNpcRuntime so the pure stepSimulation path and the in-place
          // path stay in lockstep (QA-SIM D1 twin-determinism fix).
          rt.stuckSeconds = 0;
          if (rt.blockedActivityIds && rt.blockedActivityIds.length > 0) {
            rt.unstuckSeconds = (rt.unstuckSeconds ?? 0) + dt;
            if (rt.unstuckSeconds > 8) {
              rt.blockedActivityIds = [];
              rt.unstuckSeconds = 0;
            }
          } else {
            rt.unstuckSeconds = 0;
          }
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
        if (extra) {
          rt.animState = extra.animState;
        } else if (rt.currentActivityId.endsWith(':evening_home') || rt.currentActivityId.endsWith(':morning_wake')) {
          // QA-GAME D1 fix: the evening_home wind-down and morning_wake stoop
          // overrides return animState:'rest' from selectActivityForResident,
          // but they are NOT in RESIDENT_EXTRA_ACTIVITIES, so the old
          // `getDefaultPoseForSlot` fallback silently clobbered them with
          // 'work'/'idle' — draining energy instead of restoring it during the
          // 65-min dusk wind-down. Honor the chosen rest pose.
          rt.animState = 'rest';
        } else {
          rt.animState = getDefaultPoseForSlot(id, phase);
        }
      }

      const isIndoors =
        world.playerLocation === 'cottage_interior' ||
        world.playerLocation === 'greenhouse_interior' ||
        world.playerLocation === 'bakery_interior' ||
        world.playerLocation === 'nook_interior' ||
        world.playerLocation === 'copperwheel_interior';
      const outdoorPlayerPos = isIndoors ? world.exteriorPlayerPos : world.playerPos;
      const pDist = isIndoors ? Infinity : distance2D(world.playerPos, rt.position);
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
        if (rt.posture === 'sitting' && rt.reservedSeatId) {
          // Character-quality program (Workstream B): the body settles into the
          // chair's facing while the head look-at handles the player gaze.
          const seatedSeat = getSeatById(rt.reservedSeatId);
          if (seatedSeat) {
            const diff = normalizeAngleDiff(seatedSeat.facingAngle, rt.facing);
            rt.facing += diff * Math.min(1, dt * 6);
          }
        } else if (!rt.reservedSeatId) {
          const playerYaw = Math.atan2(world.playerPos.x - rt.position.x, world.playerPos.z - rt.position.z);
          const diff = normalizeAngleDiff(playerYaw, rt.facing);
          rt.facing += diff * Math.min(1, dt * 4);
        }

        if (dtMinutes > 0 && !guarded && (tier === 'close' || tier === 'kindred')) {
          rt.needs.social = clampNeed(rt.needs.social + 0.35 * dtMinutes);
        }

        // NPC-initiated spontaneous greeting micro-bubble when player strolls close outdoors
        if (
          !dialogueOpen &&
          !isIndoors &&
          rt.emotion !== 'angry' &&
          rt.socialPartnerId === null &&
          world.minuteOfDay - rt.lastGreetedPlayerMinute >= GREETING_COOLDOWN_MINUTES
        ) {
          const met = world.residents[id]?.met ?? true;
          rt.lastGreetedPlayerMinute = world.minuteOfDay;
          rt.activeBubbleText = getGreetingBubbleText(id, rt.emotion, affinity, reliability, met);
          rt.activeBubbleUntilMinute = world.minuteOfDay + 8;
          // Character-quality program (Workstream C): a first-ever meeting flashes an
          // organic surprised reaction alongside the greeting bubble.
          if (!met && world.minuteOfDay >= rt.emotionUntilMinute) {
            rt.emotion = 'surprised';
            rt.emotionIntensity = 0.72;
            rt.emotionUntilMinute = Math.min(DAY_END_MINUTE, world.minuteOfDay + 20);
          }
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
  const outdoorPlayerRef =
    world.playerLocation === 'cottage_interior' ||
      world.playerLocation === 'greenhouse_interior' ||
      world.playerLocation === 'bakery_interior' ||
      world.playerLocation === 'nook_interior' ||
      world.playerLocation === 'copperwheel_interior'
      ? world.exteriorPlayerPos
      : world.playerPos;
  if (!dialogueOpen && world.activeEncounters.length < maxConcurrentEncounters) {
    const socialSlot = Math.floor(world.minuteOfDay / 15);
    // F1: build a per-tick Set of recorded world-event ids so the encounter
    // dedup scan is O(N) overall rather than O(N * |worldEvents|) inside the
    // O(N^2) pairing loop.
    const recordedEventIds = new Set<string>();
    for (let e = 0; e < world.worldEvents.length; e++) {
      recordedEventIds.add(world.worldEvents[e].id);
    }
    for (let i = 0; i < RESIDENT_ORDER.length; i++) {
      if (world.activeEncounters.length >= maxConcurrentEncounters) break;
      const a = RESIDENT_ORDER[i];
      if (indoorResidentId === a) continue;
      const rtA = world.npcRuntime[a];
      if (rtA.socialPartnerId !== null || rtA.waypoints.length > 0 || rtA.posture === 'sitting') continue;
      if (world.minuteOfDay < rtA.socialCooldownUntilMinute) continue;
      if (distance2D(outdoorPlayerRef, rtA.position) < 2.2) continue;

      for (let j = i + 1; j < RESIDENT_ORDER.length; j++) {
        const b = RESIDENT_ORDER[j];
        if (indoorResidentId === b) continue;
        const rtB = world.npcRuntime[b];
        if (rtB.socialPartnerId !== null || rtB.waypoints.length > 0 || rtB.posture === 'sitting') continue;
        if (world.minuteOfDay < rtB.socialCooldownUntilMinute) continue;
        if (distance2D(outdoorPlayerRef, rtB.position) < 2.2) continue;
        if (distance2D(rtA.position, rtB.position) > 7.5) continue;

        const relAB = getNpcRelation(world.npcRelations, a, b);
        if (shouldSuppressNpcSocial(relAB)) continue;
        const npcTierAB = getNpcRelationTier(relAB);

        const encId = `enc_${world.day}_${socialSlot}_${a}_${b}`;
        if (recordedEventIds.has(encId)) continue;

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

        // C4: occasional autonomous friction — a guarded-tier pair has a small
        // deterministic chance per encounter slot to rub each other the wrong
        // way, so NPC relationships can drift apart without player intervention
        // (creating mediation opportunities). Seeded independently of pairRand.
        const frictionRoll = mulberry32(
          hashSeed(world.simSeed, world.day, socialSlot, a, b, 'friction'),
        )();
        const isFriction = npcTierAB === 'guarded' && frictionRoll < 0.08;

        // Check for optional 3rd resident nearby for a 3-person cozy circle
        let thirdId: ResidentId | null = null;
        for (let k = j + 1; k < RESIDENT_ORDER.length; k++) {
          const c = RESIDENT_ORDER[k];
          if (indoorResidentId === c) continue;
          const rtC = world.npcRuntime[c];
          if (rtC.socialPartnerId !== null || rtC.waypoints.length > 0 || rtC.posture === 'sitting') continue;
          if (world.minuteOfDay < rtC.socialCooldownUntilMinute) continue;
          if (distance2D(outdoorPlayerRef, rtC.position) < 2.2) continue;
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
        const inOrchard = rtA.position.z < -13.5 && rtB.position.z < -13.5;
        const baseTopic = buildSocialTopic(a, b, world.flags, world.sideFlags, inOrchard);
        // C4: friction overrides the topic so the encounter reads as a prickly
        // exchange rather than a warm chat.
        const topic = isFriction
          ? { tag: 'neighbor_friction', label: 'A brief, prickly exchange over a lingering difference' }
          : baseTopic;
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
          rt.waypoints = computeWaypointPath(rt.position, spot, 0.38) ?? [];
          rt.currentActivityLabel = `Chatting with ${RESIDENTS[nextPartner].name}`;
          // C4: a friction encounter leaves participants frustrated, not happy.
          rt.emotion = isFriction ? 'frustrated' : 'happy';
          rt.emotionIntensity = isFriction ? 0.6 : 0.72;
          rt.emotionUntilMinute = endsMinute + 20;
          if (topic.tag === 'helped_chore') {
            rt.needs.fulfillment = clampNeed(rt.needs.fulfillment + 8);
          }
          // S4: friction writes a directional perception — this participant now
          // subjectively distrusts the other (independent of the bilateral
          // tension delta). Enables "A avoids B even after B forgives A."
          // F2 fix: only write for the actual friction pair (a↔b), NOT the
          // round-robin nextPartner (which misattributes friction to an innocent
          // third participant in 3-person encounters). The bilateral write loop
          // below handles all pairs; the perception overlay is written here only
          // for the friction pair, symmetrically in both directions.
          if (isFriction && (pid === a || pid === b)) {
            const other = pid === a ? b : a;
            adjustNpcPerceptionInPlace(world, pid, other, world.day, -3, +4, 'friction_encounter');
          }
        }

        // C4: friction inverts the affinity/tension deltas so the pair drifts
        // apart; otherwise the encounter warms them as before.
        const affinityGain = isFriction
          ? -2
          : topic.tag === 'helped_chore' || npcTierAB === 'confidant'
          ? 4
          : npcTierAB === 'guarded'
          ? 2
          : 3;
        const tensionDelta = isFriction ? 4 : npcTierAB === 'guarded' ? -3 : -2;
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
          summaryTag: isFriction ? `friction_${getNpcPairKey(a, b)}` : `chat_${getNpcPairKey(a, b)}`,
        });
        recordedEventIds.add(encId);

        // C1: each participant records a firsthand memory of the conversation
        // itself (previously encounters created no participant memory — only
        // pre-existing gossip propagated). This lets future dialogue reference
        // "the chat we had by the gazebo" via requiresNpcMemory conditions.
        const encounterPlace = rtA.currentPlaceName;
        const encounterZoneId = getLandmarkAt(rtA.position).id;
        for (let pIdx = 0; pIdx < participants.length; pIdx++) {
          const pid = participants[pIdx];
          const others = participants.filter((p) => p !== pid);
          recordNpcMemoryInPlace(
            world.npcMemories,
            pid,
            createNpcMemoryEntry({
              id: `${encId}_mem_${pid}`,
              eventId: encId,
              tag: isFriction ? 'encounter_friction' : `encounter_${topic.tag}`,
              category: isFriction ? 'friction' : 'interaction',
              subjectPlayer: false,
              subjectResidents: others,
              provenance: 'firsthand',
              sourceKind: 'participant',
              createdDay: world.day,
              createdMinute: Math.round(world.minuteOfDay),
              importance: isFriction ? 3 : 2,
              retention: 'durable',
              valence: isFriction ? 'tense' : 'warm',
              emotionalWeight: isFriction ? 55 : 40,
              detail: { placeName: encounterPlace, placeZoneId: encounterZoneId },
            }),
            world.day,
          );
        }

        // C2: nearby non-participants form witness firsthand memories — organic
        // "I saw Clara and Mina talking by the gazebo" recall that can surface
        // in later dialogue. Bounded by LOCAL_WITNESS_RADIUS; sheltered NPCs
        // are excluded during rain via collectWitnessesForPosition.
        const witnesses = collectWitnessesForPosition(world, rtA.position, LOCAL_WITNESS_RADIUS, {
          excludeIds: participants,
        });
        for (let w = 0; w < witnesses.length; w++) {
          const wid = witnesses[w];
          recordNpcMemoryInPlace(
            world.npcMemories,
            wid,
            createNpcMemoryEntry({
              id: `${encId}_wit_${wid}`,
              eventId: encId,
              tag: isFriction ? 'witnessed_friction' : 'witnessed_chat',
              category: isFriction ? 'friction' : 'interaction',
              subjectPlayer: false,
              subjectResidents: participants.slice(),
              provenance: 'firsthand',
              sourceKind: 'witness',
              createdDay: world.day,
              createdMinute: Math.round(world.minuteOfDay),
              importance: isFriction ? 2 : 1,
              retention: 'durable',
              valence: isFriction ? 'tense' : 'neutral',
              emotionalWeight: isFriction ? 35 : 25,
              detail: { placeName: encounterPlace, placeZoneId: encounterZoneId },
            }),
            world.day,
          );
        }

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
    // SR-10 / register F-SIM-1 (systemic-reliability doc 03 §3): the pure
    // wrapper must not alias the input's resident records — in-place writers
    // like updateResidentEmotionInPlace (residents[id].mood) cross every other
    // clone boundary otherwise. Per-record shallow clone: cheap (~0.4 µs at
    // the default population), value-preserving, and confined to the pure
    // path — stepSimulationInPlace (production) keeps its owned mutation.
    // R1-S-02 (integration review round 1): a missing resident record is
    // mirrored as missing, never fabricated as an empty {} the input lacked
    // (which would diverge from the in-place path on malformed fixtures).
    residents: RESIDENT_ORDER.reduce((acc, id) => {
      const record = world.residents[id];
      if (record) acc[id] = { ...record };
      return acc;
    }, {} as WorldState['residents']),
    npcRuntime: cloneNpcRuntime(world.npcRuntime),
    npcRelations: { ...world.npcRelations },
    // S4/S6: clone the directional perception overlay and social groups so the
    // pure stepSimulation path and the in-place path share the same view
    // (twin-determinism when perceptions/groups are non-empty).
    npcPerceptions: cloneNpcPerceptions(world.npcPerceptions),
    npcSocialGroups: world.npcSocialGroups
      ? world.npcSocialGroups.map((g) => ({
          ...g,
          members: g.members.map((m) => ({ ...m })),
        }))
      : world.npcSocialGroups,
    // Gardening Expansion (v13): clone gardens so the pure stepSimulation path
    // and the in-place path share the same view (twin-determinism).
    gardens: cloneGardens(world.gardens),
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
    exteriorPlayerPos: world.exteriorPlayerPos ? { ...world.exteriorPlayerPos } : { ...world.playerPos },
    inventory: { ...(world.inventory ?? {}) },
    discoveredItemIds: [...(world.discoveredItemIds ?? [])],
    cottageState: world.cottageState
      ? {
          ...world.cottageState,
          displayedKeepsakeIds: [...(world.cottageState.displayedKeepsakeIds ?? [])],
        }
      : world.cottageState,
    dailyActivities: world.dailyActivities
      ? {
          ...world.dailyActivities,
          giftedResidentsToday: [...(world.dailyActivities.giftedResidentsToday ?? [])],
        }
      : world.dailyActivities,
    neighborGiftsReceived: [...(world.neighborGiftsReceived ?? [])],
    invitations: world.invitations
      ? {
          active: world.invitations.active ? { ...world.invitations.active } : null,
          history: world.invitations.history.map((h) => ({ ...h })),
          lastOfferDayByHost: { ...(world.invitations.lastOfferDayByHost ?? {}) },
        }
      : world.invitations,
    occupancy: world.occupancy
      ? { ...world.occupancy, localPos: { ...world.occupancy.localPos } }
      : null,
    teaching: world.teaching ? { known: [...world.teaching.known] } : world.teaching,
    activeActivity: world.activeActivity ? { ...world.activeActivity } : null,
    // Everyday Gameplay GA-1 — Community Projects (WorldState v12)
    communityProjects: Object.fromEntries(
      Object.entries(world.communityProjects ?? {}).map(([projectId, progress]) => [
        projectId,
        { contributed: { ...(progress.contributed ?? {}) }, completedDay: progress.completedDay },
      ]),
    ),
  };
  stepSimulationInPlace(next, dtSeconds, options);
  return next;
}
