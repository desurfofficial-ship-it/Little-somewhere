import {
  NpcNpcRelation,
  NpcPairKey,
  PlayerNpcRelation,
  RelationshipTier,
  ResidentActivityEntry,
  ResidentId,
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
  for (let i = 0; i < RESIDENT_ORDER.length; i++) {
    for (let j = i + 1; j < RESIDENT_ORDER.length; j++) {
      const a = RESIDENT_ORDER[i];
      const b = RESIDENT_ORDER[j];
      const key = getNpcPairKey(a, b);
      const isArthurPair = a === 'arthur' || b === 'arthur';
      out[key] = {
        pair: key,
        affinity: isArthurPair ? 10 : 24,
        tension: isArthurPair ? 10 : 0,
        sharedTags: [],
        lastInteractionDay: null,
      };
    }
  }

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
  return (
    npcRelations[key] ?? {
      pair: key,
      affinity: 20,
      tension: 0,
      sharedTags: [],
      lastInteractionDay: null,
    }
  );
}

export function recordPlayerTalkAffinity(
  currentRel: PlayerNpcRelation,
  currentProg: ResidentProgress,
  params: {
    day: number;
    phase: TimePhase;
    minuteOfDay: number;
    requestedTrustDelta: number;
    isStoryMilestone: boolean;
    nextNodeId: string;
    forcedMood?: ResidentProgress['mood'];
  },
): {
  relation: PlayerNpcRelation;
  progress: ResidentProgress;
  affinityAdded: number;
} {
  let affinityDelta = 0;
  let familiarityDelta = 2;

  if (params.isStoryMilestone) {
    affinityDelta = Math.max(0, params.requestedTrustDelta) * 20;
    familiarityDelta = 8;
  } else if (params.requestedTrustDelta > 0) {
    // Prevent same-day repeated small-talk trust farming
    const alreadyRewardedSmallTalkToday =
      currentRel.lastTalkDay === params.day && currentRel.dailyAffinityGained > 0;
    if (!alreadyRewardedSmallTalkToday && currentRel.dailyAffinityGained < DAILY_SMALLTALK_AFFINITY_CAP) {
      const remaining = DAILY_SMALLTALK_AFFINITY_CAP - currentRel.dailyAffinityGained;
      affinityDelta = Math.min(remaining, SMALLTALK_FIRST_DAILY_AFFINITY);
      familiarityDelta = 4;
    }
  }

  const nextAffinity = Math.max(0, Math.min(100, currentRel.affinity + affinityDelta));
  const nextDaily = params.isStoryMilestone
    ? currentRel.dailyAffinityGained
    : Math.min(DAILY_SMALLTALK_AFFINITY_CAP, currentRel.dailyAffinityGained + affinityDelta);
  const derivedHearts = Math.max(currentProg.trust, getHeartLevel(nextAffinity));

  const nextMood: ResidentProgress['mood'] = params.forcedMood
    ? params.forcedMood
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
    moodUntilMinute: params.forcedMood ? params.minuteOfDay + 180 : currentRel.moodUntilMinute,
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
): void {
  const key = getNpcPairKey(a, b);
  const cur = getNpcRelation(npcRelations, a, b);
  const tags = cur.sharedTags.includes(topicTag)
    ? cur.sharedTags
    : [...cur.sharedTags.slice(-5), topicTag];
  npcRelations[key] = {
    pair: key,
    affinity: Math.min(100, cur.affinity + 3),
    tension: Math.max(0, cur.tension - 2),
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
