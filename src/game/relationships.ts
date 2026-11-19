import {
  CharacterEmotion,
  NpcNpcRelation,
  NpcPairKey,
  PlayerNpcRelation,
  RelationshipTier,
  ResidentActivityEntry,
  ResidentId,
  ResidentMood,
  ResidentProgress,
  TimePhase,
  WorldEventRecord,
} from './types';
import { RESIDENT_ORDER } from './residents';

export const DAILY_SMALLTALK_AFFINITY_CAP = 20;
export const SMALLTALK_FIRST_DAILY_AFFINITY = 10;
export const MAX_WORLD_EVENTS = 40;
export const MAX_ACTIVITY_HISTORY_PER_RESIDENT = 8;

export function getNpcPairKey(a: ResidentId, b: ResidentId): NpcPairKey {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function getHeartLevel(affinity: number): number {
  return Math.max(0, Math.min(5, Math.floor(affinity / 20)));
}

export function getRelationshipTier(affinity: number): RelationshipTier {
  const hearts = affinity / 20;
  if (hearts < 1) return 'stranger';
  if (hearts < 2) return 'acquaintance';
  if (hearts < 3.5) return 'friendly';
  if (hearts < 4.5) return 'close';
  return 'kindred';
}

export function getRelationshipTierLabel(tier: RelationshipTier): string {
  switch (tier) {
    case 'stranger':
      return 'Stranger';
    case 'acquaintance':
      return 'Acquaintance';
    case 'friendly':
      return 'Friend';
    case 'close':
      return 'Close Friend';
    case 'kindred':
      return 'Kindred Spirit';
  }
}

export function emotionToMood(emotion: CharacterEmotion): ResidentMood {
  switch (emotion) {
    case 'happy':
    case 'excited':
      return 'joyful';
    case 'relaxed':
      return 'peaceful';
    case 'curious':
    case 'surprised':
    case 'embarrassed':
      return 'warm';
    case 'sad':
      return 'wistful';
    case 'tired':
    case 'frustrated':
    case 'angry':
      return 'busy';
  }
}

export function moodToEmotion(mood: ResidentMood): CharacterEmotion {
  switch (mood) {
    case 'joyful':
      return 'happy';
    case 'peaceful':
      return 'relaxed';
    case 'warm':
      return 'curious';
    case 'wistful':
      return 'sad';
    case 'busy':
      return 'tired';
  }
}

export function getEmotionLabel(emotion: CharacterEmotion): string {
  switch (emotion) {
    case 'happy':
      return 'Cheerful';
    case 'sad':
      return 'Wistful';
    case 'excited':
      return 'Eager';
    case 'tired':
      return 'Tired';
    case 'frustrated':
      return 'Restless';
    case 'angry':
      return 'Prickly';
    case 'relaxed':
      return 'Peaceful';
    case 'embarrassed':
      return 'Bashful';
    case 'curious':
      return 'Curious';
    case 'surprised':
      return 'Startled';
  }
}

export function createInitialPlayerRelations(
  residents: Record<ResidentId, ResidentProgress>,
): Record<ResidentId, PlayerNpcRelation> {
  const out = {} as Record<ResidentId, PlayerNpcRelation>;
  for (const id of RESIDENT_ORDER) {
    const prog = residents[id];
    out[id] = {
      residentId: id,
      affinity: Math.max(0, Math.min(100, prog.trust * 20)),
      familiarity: prog.met ? 10 : 0,
      dailyAffinityGained: 0,
      talkedCount: prog.met ? 1 : 0,
      lastTalkDay: null,
      lastTalkPhase: null,
      mood: prog.mood,
      moodUntilMinute: 0,
      reliability: 25,
      negativeCount: 0,
      favorsCompleted: 0,
      giftsGiven: 0,
      lastEmotion: moodToEmotion(prog.mood),
    };
  }
  return out;
}

const BASELINE_NPC_BONDS: ReadonlyArray<{
  a: ResidentId;
  b: ResidentId;
  affinity: number;
  tension: number;
  sharedTags: string[];
}> = [
  { a: 'arthur', b: 'clara', affinity: -20, tension: 75, sharedTags: ['gazebo_rift'] },
  { a: 'clara', b: 'mina', affinity: 65, tension: 0, sharedTags: ['lavender_loaves'] },
  { a: 'arthur', b: 'barnaby', affinity: 55, tension: 5, sharedTags: ['timber_and_brass'] },
  { a: 'nora', b: 'sora', affinity: 58, tension: 0, sharedTags: ['evening_almanac'] },
  { a: 'nora', b: 'pip', affinity: 52, tension: 0, sharedTags: ['chalk_stories'] },
  { a: 'pip', b: 'toby', affinity: 48, tension: 0, sharedTags: ['pond_skippers'] },
  { a: 'jun', b: 'clara', affinity: 54, tension: 0, sharedTags: ['morning_post_loaf'] },
  { a: 'mina', b: 'sora', affinity: 50, tension: 0, sharedTags: ['chamomile_harvest'] },
  { a: 'barnaby', b: 'pip', affinity: 42, tension: 0, sharedTags: ['cedar_scraps'] },
  { a: 'jun', b: 'nora', affinity: 40, tension: 5, sharedTags: ['misplaced_postcard'] },
];

export function createInitialNpcRelations(reconciled: boolean): Record<string, NpcNpcRelation> {
  const out: Record<string, NpcNpcRelation> = {};

  for (const bond of BASELINE_NPC_BONDS) {
    const key = getNpcPairKey(bond.a, bond.b);
    out[key] = {
      pair: key,
      affinity: bond.affinity,
      tension: bond.tension,
      sharedTags: [...bond.sharedTags],
      lastInteractionDay: null,
    };
  }

  if (reconciled) {
    out['arthur:clara'] = {
      pair: 'arthur:clara',
      affinity: 55,
      tension: 5,
      sharedTags: ['reconciled_bell'],
      lastInteractionDay: null,
    };
  }

  return out;
}

export function getNpcRelation(
  npcRelations: Record<string, NpcNpcRelation>,
  a: ResidentId,
  b: ResidentId,
): NpcNpcRelation {
  const key = getNpcPairKey(a, b);
  if (npcRelations[key]) {
    return npcRelations[key];
  }
  const isArthurPair = a === 'arthur' || b === 'arthur';
  return {
    pair: key,
    affinity: isArthurPair ? 10 : 24,
    tension: isArthurPair ? 10 : 0,
    sharedTags: [],
    lastInteractionDay: null,
  };
}

/**
 * Generalized rule checking whether tension or estrangement prevents autonomous socializing.
 */
export function shouldSuppressNpcSocial(relation: NpcNpcRelation): boolean {
  return relation.affinity < 0 || relation.tension >= 45;
}

export function adjustNpcRelationPair(
  npcRelations: Record<string, NpcNpcRelation>,
  a: ResidentId,
  b: ResidentId,
  day: number,
  deltaAffinity: number,
  deltaTension: number,
  tag?: string,
): Record<string, NpcNpcRelation> {
  const key = getNpcPairKey(a, b);
  const cur = getNpcRelation(npcRelations, a, b);
  const tags =
    tag && !cur.sharedTags.includes(tag)
      ? [...cur.sharedTags.slice(-5), tag]
      : cur.sharedTags;
  return {
    ...npcRelations,
    [key]: {
      pair: key,
      affinity: Math.max(-50, Math.min(100, Math.round(cur.affinity + deltaAffinity))),
      tension: Math.max(0, Math.min(100, Math.round(cur.tension + deltaTension))),
      sharedTags: tags,
      lastInteractionDay: day,
    },
  };
}

export function recordPlayerTalkAffinity(
  currentRel: PlayerNpcRelation,
  currentProg: ResidentProgress,
  params: {
    day: number;
    phase: TimePhase;
    minuteOfDay: number;
    requestedTrustDelta: number;
    requestedReliabilityDelta?: number;
    isStoryMilestone: boolean;
    isNegative?: boolean;
    isGift?: boolean;
    nextNodeId: string;
    forcedMood?: ResidentProgress['mood'];
    forcedEmotion?: CharacterEmotion;
  },
): {
  relation: PlayerNpcRelation;
  progress: ResidentProgress;
  affinityAdded: number;
} {
  let affinityDelta = 0;
  let familiarityDelta = 2;
  let reliabilityDelta = params.requestedReliabilityDelta ?? 0;

  if (params.isNegative) {
    // Tactless/unhelpful replies sting slightly and hurt reliability without corrupting hard story progress
    const penalty = Math.min(-4, params.requestedTrustDelta * 8);
    affinityDelta = penalty;
    reliabilityDelta = params.requestedReliabilityDelta ?? -5;
    familiarityDelta = 1;
  } else if (params.isGift) {
    affinityDelta = Math.max(8, params.requestedTrustDelta * 12);
    reliabilityDelta = params.requestedReliabilityDelta ?? 6;
    familiarityDelta = 6;
  } else if (params.isStoryMilestone) {
    affinityDelta = Math.max(0, params.requestedTrustDelta) * 20;
    reliabilityDelta = params.requestedReliabilityDelta ?? 10;
    familiarityDelta = 8;
  } else if (params.requestedTrustDelta > 0) {
    // Prevent same-day repeated small-talk trust farming while allowing natural warmth
    const alreadyRewardedSmallTalkToday =
      currentRel.lastTalkDay === params.day && currentRel.dailyAffinityGained > 0;
    if (!alreadyRewardedSmallTalkToday && currentRel.dailyAffinityGained < DAILY_SMALLTALK_AFFINITY_CAP) {
      const remaining = DAILY_SMALLTALK_AFFINITY_CAP - currentRel.dailyAffinityGained;
      affinityDelta = Math.min(remaining, SMALLTALK_FIRST_DAILY_AFFINITY);
      familiarityDelta = 4;
      reliabilityDelta = params.requestedReliabilityDelta ?? 2;
    }
  }

  const nextAffinity = Math.max(0, Math.min(100, currentRel.affinity + affinityDelta));
  const nextDaily =
    params.isStoryMilestone || params.isNegative || params.isGift
      ? currentRel.dailyAffinityGained
      : Math.min(DAILY_SMALLTALK_AFFINITY_CAP, currentRel.dailyAffinityGained + Math.max(0, affinityDelta));

  // Derive heart rating cleanly, never lowering an already-earned story heart except keeping sync
  const derivedHearts = params.isNegative
    ? currentProg.trust
    : Math.max(currentProg.trust, getHeartLevel(nextAffinity));

  const resolvedEmotion: CharacterEmotion =
    params.forcedEmotion ??
    (params.isNegative
      ? 'frustrated'
      : params.forcedMood
      ? moodToEmotion(params.forcedMood)
      : derivedHearts >= 3
      ? 'happy'
      : currentRel.lastEmotion ?? moodToEmotion(currentProg.mood));

  const nextMood: ResidentMood = params.forcedMood
    ? params.forcedMood
    : params.forcedEmotion
    ? emotionToMood(params.forcedEmotion)
    : derivedHearts >= 3
    ? 'warm'
    : currentProg.mood;

  const relation: PlayerNpcRelation = {
    ...currentRel,
    affinity: nextAffinity,
    familiarity: currentRel.familiarity + familiarityDelta,
    dailyAffinityGained: nextDaily,
    talkedCount: currentRel.talkedCount + 1,
    lastTalkDay: params.day,
    lastTalkPhase: params.phase,
    mood: nextMood,
    moodUntilMinute:
      params.forcedMood || params.forcedEmotion || params.isNegative
        ? params.minuteOfDay + 180
        : currentRel.moodUntilMinute,
    reliability: Math.max(0, Math.min(100, (currentRel.reliability ?? 25) + reliabilityDelta)),
    negativeCount: (currentRel.negativeCount ?? 0) + (params.isNegative ? 1 : 0),
    favorsCompleted: (currentRel.favorsCompleted ?? 0) + (params.isStoryMilestone ? 1 : 0),
    giftsGiven: (currentRel.giftsGiven ?? 0) + (params.isGift ? 1 : 0),
    lastEmotion: resolvedEmotion,
  };

  const progress: ResidentProgress = {
    ...currentProg,
    met: true,
    talkedToday: true,
    trust: Math.min(5, derivedHearts),
    mood: nextMood,
    lastDialogueId: params.nextNodeId,
  };

  return {
    relation,
    progress,
    affinityAdded: affinityDelta,
  };
}

export function reconcileClaraAndArthurRelation(
  npcRelations: Record<string, NpcNpcRelation>,
  day: number,
): Record<string, NpcNpcRelation> {
  const existing = getNpcRelation(npcRelations, 'clara', 'arthur');
  const nextAffinity = Math.max(55, existing.affinity);
  return {
    ...npcRelations,
    'arthur:clara': {
      pair: 'arthur:clara',
      affinity: nextAffinity,
      tension: 5,
      sharedTags: Array.from(new Set([...existing.sharedTags, 'reconciled_bell'])),
      lastInteractionDay: day,
    },
  };
}

export function applyNpcSocialRelationInPlace(
  npcRelations: Record<string, NpcNpcRelation>,
  a: ResidentId,
  b: ResidentId,
  day: number,
  topicTag: string,
  deltaAffinity = 3,
  deltaTension = -2,
): void {
  const key = getNpcPairKey(a, b);
  const cur = getNpcRelation(npcRelations, a, b);
  const tags = cur.sharedTags.includes(topicTag)
    ? cur.sharedTags
    : [...cur.sharedTags.slice(-5), topicTag];
  npcRelations[key] = {
    pair: key,
    affinity: Math.max(-50, Math.min(100, cur.affinity + deltaAffinity)),
    tension: Math.max(0, Math.min(100, cur.tension + deltaTension)),
    sharedTags: tags,
    lastInteractionDay: day,
  };
}

export function createInitialNpcActivityHistory(): Record<ResidentId, ResidentActivityEntry[]> {
  const out = {} as Record<ResidentId, ResidentActivityEntry[]>;
  for (const id of RESIDENT_ORDER) {
    out[id] = [];
  }
  return out;
}

export function pushNpcActivityHistoryInPlace(
  history: Record<ResidentId, ResidentActivityEntry[]>,
  id: ResidentId,
  entry: ResidentActivityEntry,
): void {
  const list = history[id] ?? (history[id] = []);
  const last = list[0];
  if (last && last.day === entry.day && last.activityId === entry.activityId) {
    return;
  }
  list.unshift(entry);
  if (list.length > MAX_ACTIVITY_HISTORY_PER_RESIDENT) {
    list.length = MAX_ACTIVITY_HISTORY_PER_RESIDENT;
  }
}

export function pushWorldEventInPlace(
  events: WorldEventRecord[],
  record: WorldEventRecord,
): void {
  if (events.some((e) => e.id === record.id)) return;
  events.unshift(record);
  if (events.length > MAX_WORLD_EVENTS) {
    events.length = MAX_WORLD_EVENTS;
  }
}
