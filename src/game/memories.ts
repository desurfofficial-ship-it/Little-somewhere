import {
  NpcMemoryCategory,
  NpcMemoryDetail,
  NpcMemoryDistortionFlavor,
  NpcMemoryEntry,
  NpcMemoryProvenance,
  NpcMemoryRetention,
  NpcMemorySourceKind,
  NpcMemoryValence,
  NpcNpcRelation,
  ResidentId,
  Vec2,
  WorldState,
} from './types';
import {
  RESIDENTS,
  RESIDENT_EXTRA_ACTIVITIES,
  RESIDENT_ORDER,
} from './residents';
import {
  getNpcRelation,
  getNpcRelationTier,
  shouldSuppressNpcSocial,
  stampNpcGossipInPlace,
} from './relationships';
import { hashSeed, mulberry32 } from './rng';
import { clampMinuteOfDay, DEFAULT_START_MINUTE } from './time';
import { distance2D } from './worldMap';

// Initial tunable constants for Phase 3 (bounded memory & controlled gossip)
export const MAX_NPC_MEMORIES_PER_RESIDENT = 14;
export const MAX_PERMANENT_MEMORIES_PER_RESIDENT = 6;
export const EPHEMERAL_RUMOR_TTL_DAYS = 5;
export const DURABLE_MEMORY_TTL_DAYS = 18;
export const LOCAL_WITNESS_RADIUS = 8.5;
export const ACOUSTIC_BELL_RADIUS = 30;

export const MAX_GOSSIP_PER_ENCOUNTER = 1;
export const MAX_GOSSIP_HOPS = 2;
export const MAX_FRICTION_GOSSIP_HOPS = 1;
export const MAX_SHARES_PER_ENTRY = 3;
export const GOSSIP_MIN_AFFINITY = 20;
export const GOSSIP_MAX_TENSION = 30;
export const GOSSIP_SENSITIVE_MIN_AFFINITY = 38;
export const GOSSIP_SENSITIVE_MAX_TENSION = 20;
export const GOSSIP_CONFIDENCE_STEP_HOP1 = 22;
export const GOSSIP_CONFIDENCE_STEP_HOP2 = 30;
export const GOSSIP_MIN_CONFIDENCE = 25;
export const CORROBORATION_CONFIDENCE_BONUS = 10;
export const MAX_SECONDHAND_CONFIDENCE = 85;

export const VALID_MEMORY_PROVENANCES = new Set<NpcMemoryProvenance>([
  'firsthand',
  'secondhand',
  'rumor',
]);

export const VALID_MEMORY_SOURCE_KINDS = new Set<NpcMemorySourceKind>([
  'participant',
  'witness',
  'player_told',
  'gossip',
]);

export const VALID_MEMORY_CATEGORIES = new Set<NpcMemoryCategory>([
  'event',
  'interaction',
  'friction',
  'social_impression',
  'town_lore',
]);

export const VALID_MEMORY_RETENTIONS = new Set<NpcMemoryRetention>([
  'permanent',
  'durable',
  'ephemeral',
]);

export const VALID_MEMORY_VALENCES = new Set<NpcMemoryValence>([
  'warm',
  'neutral',
  'tense',
]);

export const VALID_MEMORY_DISTORTIONS = new Set<NpcMemoryDistortionFlavor>([
  'none',
  'uncertain',
  'exaggerated',
  'softened',
  'misattributed_motive',
]);

export function getProvenanceRank(provenance: NpcMemoryProvenance): number {
  switch (provenance) {
    case 'firsthand':
      return 3;
    case 'secondhand':
      return 2;
    case 'rumor':
      return 1;
  }
}

export function getDefaultExpiryDay(
  retention: NpcMemoryRetention,
  learnedDay: number,
): number | undefined {
  if (retention === 'permanent') return undefined;
  if (retention === 'durable') return learnedDay + DURABLE_MEMORY_TTL_DAYS;
  return learnedDay + EPHEMERAL_RUMOR_TTL_DAYS;
}

export function createEmptyNpcMemories(): Record<ResidentId, NpcMemoryEntry[]> {
  const out = {} as Record<ResidentId, NpcMemoryEntry[]>;
  for (const id of RESIDENT_ORDER) {
    out[id] = [];
  }
  return out;
}

export function cloneNpcMemoryEntry(entry: NpcMemoryEntry): NpcMemoryEntry {
  return {
    ...entry,
    subjectResidents: [...entry.subjectResidents],
    ...(entry.detail ? { detail: { ...entry.detail } } : {}),
  };
}

export function cloneNpcMemories(
  src?: Record<ResidentId, NpcMemoryEntry[]>,
): Record<ResidentId, NpcMemoryEntry[]> {
  const out = createEmptyNpcMemories();
  if (!src) return out;
  for (const id of RESIDENT_ORDER) {
    const list = src[id];
    if (Array.isArray(list)) {
      out[id] = list.map(cloneNpcMemoryEntry);
    }
  }
  return out;
}

export interface CreateNpcMemoryParams {
  id: string;
  eventId?: string;
  tag: string;
  category: NpcMemoryCategory;
  subjectPlayer?: boolean;
  subjectResidents?: ResidentId[];
  provenance?: NpcMemoryProvenance;
  sourceKind?: NpcMemorySourceKind;
  originResidentId?: ResidentId;
  fromResidentId?: ResidentId;
  hopCount?: number;
  confidence?: number;
  distorted?: boolean;
  distortionFlavor?: NpcMemoryDistortionFlavor;
  createdDay: number;
  createdMinute: number;
  learnedDay?: number;
  learnedMinute?: number;
  expiresDay?: number;
  importance?: number;
  retention?: NpcMemoryRetention;
  valence?: NpcMemoryValence;
  emotionalWeight?: number;
  mentionedToPlayer?: boolean;
  sharedCount?: number;
  detail?: NpcMemoryDetail;
}

export function createNpcMemoryEntry(params: CreateNpcMemoryParams): NpcMemoryEntry {
  const provenance = params.provenance ?? 'firsthand';
  const sourceKind =
    params.sourceKind ??
    (provenance === 'firsthand' ? 'participant' : 'gossip');
  const retention = params.retention ?? (provenance === 'rumor' ? 'ephemeral' : 'durable');
  const createdDay = Math.max(1, Math.floor(params.createdDay));
  const learnedDay = Math.max(createdDay, Math.floor(params.learnedDay ?? createdDay));
  const createdMinute = clampMinuteOfDay(params.createdMinute);
  const learnedMinute = clampMinuteOfDay(params.learnedMinute ?? createdMinute);
  const hopCount = provenance === 'firsthand' ? 0 : Math.max(1, Math.min(MAX_GOSSIP_HOPS, Math.floor(params.hopCount ?? 1)));
  const confidence =
    provenance === 'firsthand'
      ? 100
      : Math.max(GOSSIP_MIN_CONFIDENCE, Math.min(95, Math.round(params.confidence ?? 75)));
  const distorted = provenance === 'firsthand' ? false : Boolean(params.distorted);
  const distortionFlavor: NpcMemoryDistortionFlavor =
    distorted && params.distortionFlavor ? params.distortionFlavor : 'none';
  const expiresDay =
    retention === 'permanent'
      ? undefined
      : Math.max(learnedDay, Math.floor(params.expiresDay ?? getDefaultExpiryDay(retention, learnedDay)!));

  const subjectResidents = Array.from(
    new Set(
      (params.subjectResidents ?? []).filter((r) =>
        (RESIDENT_ORDER as readonly string[]).includes(r),
      ),
    ),
  );

  return {
    id: params.id,
    eventId: params.eventId ?? params.id,
    tag: params.tag,
    category: params.category,
    subjectPlayer: Boolean(params.subjectPlayer),
    subjectResidents,
    provenance,
    sourceKind,
    ...(params.originResidentId ? { originResidentId: params.originResidentId } : {}),
    ...(params.fromResidentId ? { fromResidentId: params.fromResidentId } : {}),
    hopCount,
    confidence,
    distorted,
    distortionFlavor,
    createdDay,
    createdMinute,
    learnedDay,
    learnedMinute,
    ...(expiresDay !== undefined ? { expiresDay } : {}),
    importance: Math.max(1, Math.min(5, Math.round(params.importance ?? 3))),
    retention,
    valence: params.valence ?? 'neutral',
    emotionalWeight: Math.max(0, Math.min(100, Math.round(params.emotionalWeight ?? 55))),
    mentionedToPlayer: Boolean(params.mentionedToPlayer),
    sharedCount: Math.max(0, Math.floor(params.sharedCount ?? 0)),
    ...(params.detail && Object.keys(params.detail).length > 0 ? { detail: { ...params.detail } } : {}),
  };
}

export function createInitialNpcMemories(
  reconciled: boolean,
  day = 1,
  minuteOfDay = DEFAULT_START_MINUTE,
): Record<ResidentId, NpcMemoryEntry[]> {
  const out = createEmptyNpcMemories();
  const hasClara = Boolean(RESIDENTS.clara);
  const hasArthur = Boolean(RESIDENTS.arthur);

  if (!reconciled) {
    if (hasClara) {
      out.clara.push(
        createNpcMemoryEntry({
          id: 'lore_gazebo_rift',
          eventId: 'lore_gazebo_rift',
          tag: 'gazebo_rift',
          category: 'town_lore',
          subjectPlayer: false,
          subjectResidents: ['arthur', 'clara'],
          provenance: 'firsthand',
          sourceKind: 'participant',
          createdDay: day,
          createdMinute: minuteOfDay,
          importance: 4,
          retention: 'permanent',
          valence: 'tense',
          emotionalWeight: 72,
          detail: { placeName: 'Old Bell Gazebo' },
        }),
      );
    }
    if (hasArthur) {
      out.arthur.push(
        createNpcMemoryEntry({
          id: 'lore_gazebo_rift',
          eventId: 'lore_gazebo_rift',
          tag: 'gazebo_rift',
          category: 'town_lore',
          subjectPlayer: false,
          subjectResidents: ['arthur', 'clara'],
          provenance: 'firsthand',
          sourceKind: 'participant',
          createdDay: day,
          createdMinute: minuteOfDay,
          importance: 4,
          retention: 'permanent',
          valence: 'tense',
          emotionalWeight: 72,
          detail: { placeName: 'Old Bell Gazebo' },
        }),
      );
    }
  } else {
    const actors: ResidentId[] = ['clara', 'arthur'];
    for (const actor of actors) {
      if (!RESIDENTS[actor]) continue;
      out[actor].push(
        createNpcMemoryEntry({
          id: 'ev_clara_arthur_reconciled',
          eventId: 'ev_clara_arthur_reconciled',
          tag: 'clara_arthur_reconciled',
          category: 'town_lore',
          subjectPlayer: true,
          subjectResidents: ['arthur', 'clara'],
          provenance: 'firsthand',
          sourceKind: 'participant',
          createdDay: day,
          createdMinute: minuteOfDay,
          importance: 5,
          retention: 'permanent',
          valence: 'warm',
          emotionalWeight: 90,
          detail: { placeName: 'Old Bell Gazebo' },
        }),
      );
    }
  }

  return out;
}

export function computeRetentionScore(entry: NpcMemoryEntry, currentDay: number): number {
  const rank = getProvenanceRank(entry.provenance);
  const provBonus = rank === 3 ? 2.5 : rank === 2 ? 1.0 : 0;
  const unmentionedBonus = entry.mentionedToPlayer ? 0 : 1.25;
  const agePenalty = Math.max(0, currentDay - entry.learnedDay) * 0.45;
  return (
    entry.importance * 3.0 +
    provBonus +
    entry.emotionalWeight / 40 +
    unmentionedBonus -
    agePenalty
  );
}

export function isMemoryExpired(entry: NpcMemoryEntry, currentDay: number): boolean {
  return (
    entry.retention !== 'permanent' &&
    entry.expiresDay !== undefined &&
    currentDay > entry.expiresDay
  );
}

export function enforceResidentMemoryCapInPlace(
  list: NpcMemoryEntry[],
  currentDay: number,
): void {
  // Remove expired entries first
  for (let i = list.length - 1; i >= 0; i--) {
    if (isMemoryExpired(list[i], currentDay)) {
      list.splice(i, 1);
    }
  }

  while (list.length > MAX_NPC_MEMORIES_PER_RESIDENT) {
    let permanentCount = 0;
    for (let i = 0; i < list.length; i++) {
      if (list[i].retention === 'permanent') permanentCount++;
    }

    let evictIdx = -1;
    let lowestScore = Infinity;

    // Prefer evicting non-permanent memories while permanent memories fit within quota
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      if (m.retention === 'permanent') continue;
      const s = computeRetentionScore(m, currentDay);
      if (s < lowestScore) {
        lowestScore = s;
        evictIdx = i;
      }
    }

    // If permanent memories exceed MAX_PERMANENT_MEMORIES_PER_RESIDENT or no non-permanent exist
    if (evictIdx === -1 || permanentCount > MAX_PERMANENT_MEMORIES_PER_RESIDENT) {
      if (permanentCount > MAX_PERMANENT_MEMORIES_PER_RESIDENT || evictIdx === -1) {
        let permIdx = -1;
        let lowestPerm = Infinity;
        for (let i = 0; i < list.length; i++) {
          const m = list[i];
          if (m.retention !== 'permanent') continue;
          const pScore = m.importance * 100 + m.createdDay;
          if (pScore < lowestPerm) {
            lowestPerm = pScore;
            permIdx = i;
          }
        }
        if (evictIdx === -1 || permanentCount > MAX_PERMANENT_MEMORIES_PER_RESIDENT) {
          if (permIdx !== -1) evictIdx = permIdx;
        }
      }
    }

    if (evictIdx === -1) break;
    list.splice(evictIdx, 1);
  }
}

export function recordNpcMemoryInPlace(
  npcMemories: Record<ResidentId, NpcMemoryEntry[]>,
  residentId: ResidentId,
  incomingRaw: NpcMemoryEntry,
  currentDay: number,
): NpcMemoryEntry {
  const list = npcMemories[residentId] ?? (npcMemories[residentId] = []);
  const incoming = cloneNpcMemoryEntry(incomingRaw);

  const existingIdx = list.findIndex(
    (m) => m.eventId === incoming.eventId || m.id === incoming.id,
  );

  if (existingIdx === -1) {
    list.unshift(incoming);
    enforceResidentMemoryCapInPlace(list, currentDay);
    return incoming;
  }

  const existing = list[existingIdx];
  const existingRank = getProvenanceRank(existing.provenance);
  const incomingRank = getProvenanceRank(incoming.provenance);

  // Never downgrade higher provenance (e.g. firsthand cannot be overwritten by gossip rumor)
  if (incomingRank < existingRank) {
    return existing;
  }

  // Upgrade non-firsthand -> firsthand upon direct experience/witnessing
  if (incomingRank > existingRank && incoming.provenance === 'firsthand') {
    const upgraded: NpcMemoryEntry = {
      ...incoming,
      retention:
        existing.retention === 'permanent' || incoming.retention === 'permanent'
          ? 'permanent'
          : incoming.retention === 'durable' || existing.retention === 'durable'
          ? 'durable'
          : 'ephemeral',
      importance: Math.max(existing.importance, incoming.importance),
      emotionalWeight: Math.max(existing.emotionalWeight, incoming.emotionalWeight),
      sharedCount: existing.sharedCount,
      mentionedToPlayer:
        existing.distorted || existing.provenance === 'rumor'
          ? false
          : existing.mentionedToPlayer,
    };
    if (upgraded.retention === 'permanent') {
      delete upgraded.expiresDay;
    }
    list[existingIdx] = upgraded;
    enforceResidentMemoryCapInPlace(list, currentDay);
    return upgraded;
  }

  // Same provenance rank
  if (existing.provenance === 'firsthand') {
    const clearerVisual =
      Boolean(existing.detail?.acousticOnly) && !incoming.detail?.acousticOnly;
    const merged: NpcMemoryEntry = {
      ...existing,
      learnedDay: Math.max(existing.learnedDay, incoming.learnedDay),
      learnedMinute: incoming.learnedMinute,
      ...(incoming.expiresDay !== undefined && existing.retention !== 'permanent'
        ? { expiresDay: Math.max(existing.expiresDay ?? 0, incoming.expiresDay) }
        : {}),
      importance: Math.max(existing.importance, incoming.importance),
      emotionalWeight: Math.max(existing.emotionalWeight, incoming.emotionalWeight),
      ...(clearerVisual
        ? {
            sourceKind: incoming.sourceKind,
            detail: incoming.detail ? { ...incoming.detail } : undefined,
            mentionedToPlayer: false,
          }
        : {}),
    };
    list[existingIdx] = merged;
    return merged;
  }

  // Secondhand/rumor corroboration (including rumor upgraded to secondhand by distinct neighbor)
  if (
    incoming.fromResidentId &&
    incoming.fromResidentId !== existing.fromResidentId
  ) {
    const bestBaseConf = Math.max(existing.confidence, incoming.confidence);
    const boostedConfidence = Math.min(
      MAX_SECONDHAND_CONFIDENCE,
      bestBaseConf + CORROBORATION_CONFIDENCE_BONUS,
    );
    const bestHop = Math.min(existing.hopCount, incoming.hopCount);
    const clearedUncertain =
      existing.distortionFlavor === 'uncertain' && boostedConfidence >= 70;
    const nextDistorted = clearedUncertain
      ? false
      : incomingRank > existingRank
      ? incoming.distorted
      : existing.distorted;
    const nextFlavor = clearedUncertain
      ? 'none'
      : incomingRank > existingRank
      ? incoming.distortionFlavor
      : existing.distortionFlavor;
    const corroborated: NpcMemoryEntry = {
      ...existing,
      confidence: boostedConfidence,
      hopCount: bestHop,
      fromResidentId:
        incomingRank > existingRank ? incoming.fromResidentId : existing.fromResidentId,
      provenance:
        bestHop <= 1 && !nextDistorted
          ? 'secondhand'
          : incomingRank > existingRank
          ? incoming.provenance
          : existing.provenance,
      distorted: nextDistorted,
      distortionFlavor: nextFlavor,
      retention:
        existing.retention === 'durable' || incoming.retention === 'durable'
          ? 'durable'
          : existing.retention,
      learnedDay: Math.max(existing.learnedDay, incoming.learnedDay),
      learnedMinute: incoming.learnedMinute,
      ...(existing.retention !== 'permanent'
        ? {
            expiresDay: Math.max(
              existing.expiresDay ?? 0,
              getDefaultExpiryDay(
                existing.retention === 'durable' || incoming.retention === 'durable'
                  ? 'durable'
                  : existing.retention,
                incoming.learnedDay,
              ) ?? 0,
            ),
          }
        : {}),
    };
    list[existingIdx] = corroborated;
    return corroborated;
  }

  return existing;
}

export function pruneExpiredNpcMemoriesInPlace(
  npcMemories: Record<ResidentId, NpcMemoryEntry[]>,
  currentDay: number,
): void {
  for (const id of RESIDENT_ORDER) {
    const list = npcMemories[id];
    if (!list) continue;
    for (let i = list.length - 1; i >= 0; i--) {
      if (isMemoryExpired(list[i], currentDay)) {
        list.splice(i, 1);
      }
    }
  }
}

export function markNpcMemoriesMentionedInPlace(
  npcMemories: Record<ResidentId, NpcMemoryEntry[]>,
  residentId: ResidentId,
  matcher: { eventIds?: readonly string[]; tags?: readonly string[] },
): void {
  const list = npcMemories[residentId];
  if (!list || list.length === 0) return;
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    if (
      (matcher.eventIds && matcher.eventIds.includes(m.eventId)) ||
      (matcher.tags && (matcher.tags.includes(m.tag) || matcher.tags.includes(m.id)))
    ) {
      if (!m.mentionedToPlayer) {
        list[i] = { ...m, mentionedToPlayer: true };
      }
    }
  }
}

export function isResidentShelteredForEvent(
  world: Pick<WorldState, 'weather' | 'npcRuntime'>,
  residentId: ResidentId,
): boolean {
  if (world.weather !== 'light_rain') return false;
  const rt = world.npcRuntime?.[residentId];
  if (!rt) return false;
  const extra = RESIDENT_EXTRA_ACTIVITIES[residentId];
  if (extra?.some((a) => a.id === rt.currentActivityId && Boolean(a.sheltered))) {
    return true;
  }
  const def = RESIDENTS[residentId];
  if (def.traits.rainBehavior === 'shelter_home') {
    if (
      rt.currentActivityId.includes('rain') ||
      rt.currentPlaceName.includes('Porch') ||
      rt.currentPlaceName.includes('Woodshop') ||
      rt.currentPlaceName.includes('Book Nook') ||
      rt.currentPlaceName.includes('Cottage')
    ) {
      return true;
    }
  }
  return false;
}

export function collectWitnessesForPosition(
  world: Pick<WorldState, 'weather' | 'npcRuntime'>,
  pos: Vec2,
  radius: number,
  options: {
    excludeIds?: readonly ResidentId[];
    allowSheltered?: boolean;
  } = {},
): ResidentId[] {
  const excluded = new Set(options.excludeIds ?? []);
  const allowSheltered = Boolean(options.allowSheltered);
  const witnesses: ResidentId[] = [];

  for (const id of RESIDENT_ORDER) {
    if (excluded.has(id)) continue;
    const rt = world.npcRuntime?.[id];
    if (!rt) continue;
    if (!allowSheltered && isResidentShelteredForEvent(world, id)) continue;
    if (distance2D(rt.position, pos) <= radius) {
      witnesses.push(id);
    }
  }

  return witnesses;
}

function canShareMemoryWith(
  speakerId: ResidentId,
  listenerId: ResidentId,
  rel: NpcNpcRelation,
  entry: NpcMemoryEntry,
  listenerList: readonly NpcMemoryEntry[],
): boolean {
  const maxHops =
    entry.category === 'friction' ? MAX_FRICTION_GOSSIP_HOPS : MAX_GOSSIP_HOPS;
  if (entry.hopCount >= maxHops) return false;
  if (entry.sharedCount >= MAX_SHARES_PER_ENTRY) return false;

  // Relationship & sensitivity gate
  if (shouldSuppressNpcSocial(rel)) return false;
  if (rel.affinity < GOSSIP_MIN_AFFINITY || rel.tension >= GOSSIP_MAX_TENSION) {
    return false;
  }

  if (entry.category === 'friction' || entry.category === 'social_impression') {
    const highTrust =
      rel.affinity >= GOSSIP_SENSITIVE_MIN_AFFINITY &&
      rel.tension < GOSSIP_SENSITIVE_MAX_TENSION;
    const mildCuriousPublic =
      entry.category === 'social_impression' &&
      entry.valence !== 'tense' &&
      RESIDENTS[speakerId].traits.curiosity >= 0.72;
    if (!highTrust && !mildCuriousPublic) {
      return false;
    }
  }

  // Never gossip awkwardly to a resident about their own tense friction/mistake
  if (
    (entry.category === 'friction' || entry.valence === 'tense') &&
    entry.subjectResidents.includes(listenerId)
  ) {
    return false;
  }

  // Never echo a memory right back to its immediate sender or origin if listener already holds equal/better
  if (entry.fromResidentId === listenerId || entry.originResidentId === listenerId) {
    return false;
  }

  const existing = listenerList.find(
    (m) => m.eventId === entry.eventId || m.id === entry.id,
  );
  if (existing) {
    if (existing.provenance === 'firsthand') return false;
    // Allow corroboration only if existing was heard from a different neighbor
    if (existing.fromResidentId === speakerId) return false;
    if (existing.confidence >= MAX_SECONDHAND_CONFIDENCE) return false;
  }

  return true;
}

function scoreGossipCandidate(
  speakerId: ResidentId,
  entry: NpcMemoryEntry,
  currentDay: number,
  alreadyKnownForCorroboration: boolean,
): number {
  const traits = RESIDENTS[speakerId].traits;
  const age = Math.max(0, currentDay - entry.createdDay);
  const novelty = entry.sharedCount === 0 ? 4.5 : 0;
  const recency = age <= 1 ? 3.5 : age <= 3 ? 2.0 : 0;
  const provenanceBonus = entry.provenance === 'firsthand' ? 2.2 : 0.4;
  const curiosityBonus = traits.curiosity >= 0.7 && entry.subjectPlayer ? 1.6 : 0;
  const gentleBonus =
    traits.temperament === 'gentle' && entry.valence === 'warm' ? 1.2 : 0;
  const lorePenalty = entry.category === 'town_lore' ? -4.0 : 0;
  const corroborationPenalty = alreadyKnownForCorroboration ? -2.0 : 0;

  return (
    novelty +
    recency +
    provenanceBonus +
    curiosityBonus +
    gentleBonus +
    entry.importance * 1.4 +
    entry.emotionalWeight / 45 +
    lorePenalty +
    corroborationPenalty -
    age * 0.4
  );
}

function chooseDistortion(
  world: Pick<WorldState, 'simSeed' | 'day'>,
  encounterId: string,
  speakerId: ResidentId,
  rel: NpcNpcRelation,
  sourceMem: NpcMemoryEntry,
): { distorted: boolean; flavor: NpcMemoryDistortionFlavor } {
  // Canonical town lore and permanent milestones keep factual distortion off (only minor uncertainty allowed at hop >= 2)
  const speaker = RESIDENTS[speakerId];
  const nextHop = sourceMem.hopCount + 1;

  if (sourceMem.category === 'town_lore' || sourceMem.retention === 'permanent') {
    if (nextHop >= 2) {
      const r = mulberry32(
        hashSeed(world.simSeed, world.day, encounterId, sourceMem.eventId, 'lore_distort'),
      )();
      if (r < 0.28) return { distorted: true, flavor: 'uncertain' };
    }
    return { distorted: false, flavor: 'none' };
  }

  const rng = mulberry32(
    hashSeed(world.simSeed, world.day, encounterId, speakerId, sourceMem.eventId, 'distort'),
  );
  const roll = rng();

  const curiosityBoost = speaker.traits.curiosity >= 0.72 ? 0.16 : 0;
  const distancePenalty = rel.affinity < 35 || rel.tension >= 15 ? 0.14 : 0;
  const hopBoost = nextHop >= 2 ? 0.28 : 0;
  const distortChance = Math.min(0.68, 0.10 + hopBoost + curiosityBoost + distancePenalty);

  if (roll >= distortChance) {
    return { distorted: false, flavor: 'none' };
  }

  const styleRoll = rng();
  if (
    sourceMem.valence === 'tense' &&
    (rel.tension >= 15 || rel.affinity < 35) &&
    styleRoll < 0.25
  ) {
    return { distorted: true, flavor: 'misattributed_motive' };
  }
  if (sourceMem.valence === 'tense' && speaker.traits.temperament === 'gentle') {
    return { distorted: true, flavor: 'softened' };
  }
  if (
    sourceMem.valence === 'warm' &&
    (speaker.traits.temperament === 'spirited' || speaker.traits.curiosity >= 0.75)
  ) {
    return { distorted: true, flavor: 'exaggerated' };
  }
  return { distorted: true, flavor: 'uncertain' };
}

export interface GossipTransferOutcome {
  speakerId: ResidentId;
  listenerId: ResidentId;
  eventId: string;
  provenance: NpcMemoryProvenance;
  distortionFlavor: NpcMemoryDistortionFlavor;
}

/**
 * Controlled, deterministic NPC-to-NPC gossip transfer invoked ONLY when an
 * ActiveSocialEncounter forms (or directly in unit tests). Zero per-frame scans.
 */
export function propagateEncounterGossipInPlace(
  world: WorldState,
  participants: readonly ResidentId[],
  encounterId: string,
): GossipTransferOutcome | null {
  if (!world.npcMemories) return null;
  if (participants.length < 2) return null;

  const npcMemories = world.npcMemories;

  // Enumerate all directed speaker -> listener pairs inside this encounter in deterministic order
  const candidatePairs: Array<{ speakerId: ResidentId; listenerId: ResidentId }> = [];
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const a = participants[i];
      const b = participants[j];
      const dirRoll = mulberry32(
        hashSeed(world.simSeed, world.day, encounterId, a, b, 'dir'),
      )();
      if (dirRoll < 0.5) {
        candidatePairs.push({ speakerId: a, listenerId: b });
        candidatePairs.push({ speakerId: b, listenerId: a });
      } else {
        candidatePairs.push({ speakerId: b, listenerId: a });
        candidatePairs.push({ speakerId: a, listenerId: b });
      }
    }
  }

  let transferred = 0;
  for (const { speakerId, listenerId } of candidatePairs) {
    if (transferred >= MAX_GOSSIP_PER_ENCOUNTER) break;

    const rel = getNpcRelation(world.npcRelations, speakerId, listenerId);
    if (shouldSuppressNpcSocial(rel)) continue;
    if (rel.affinity < GOSSIP_MIN_AFFINITY || rel.tension >= GOSSIP_MAX_TENSION) continue;
    if (rel.lastGossipDay === world.day) continue; // Strictly 1 gossip exchange per pair per in-game day

    const speakerList = npcMemories[speakerId] ?? [];
    const listenerList = npcMemories[listenerId] ?? [];
    if (speakerList.length === 0) continue;

    // Speaker willingness roll
    const tier = getNpcRelationTier(rel);
    const speakerTraits = RESIDENTS[speakerId].traits;
    const talkChance = Math.min(
      0.88,
      Math.max(
        0.35,
        0.45 +
          speakerTraits.sociability * 0.2 +
          speakerTraits.curiosity * 0.1 +
          (tier === 'confidant' ? 0.12 : tier === 'warm' ? 0.06 : 0),
      ),
    );
    const talkRoll = mulberry32(
      hashSeed(world.simSeed, world.day, encounterId, speakerId, listenerId, 'talk'),
    )();
    if (talkRoll > talkChance) continue;

    // Rank eligible candidate memories
    const ranked: Array<{ entry: NpcMemoryEntry; score: number }> = [];
    for (let k = 0; k < speakerList.length; k++) {
      const entry = speakerList[k];
      if (isMemoryExpired(entry, world.day)) continue;
      if (!canShareMemoryWith(speakerId, listenerId, rel, entry, listenerList)) continue;
      const alreadyKnown = listenerList.some(
        (m) => m.eventId === entry.eventId || m.id === entry.id,
      );
      ranked.push({
        entry,
        score: scoreGossipCandidate(speakerId, entry, world.day, alreadyKnown),
      });
    }

    if (ranked.length === 0) continue;
    ranked.sort((x, y) => y.score - x.score);

    // Deterministic weighted pick among near-tied top candidates so townspeople feel varied without ignoring fresh news
    let chosen = ranked[0].entry;
    if (ranked.length > 1 && ranked[1].score >= ranked[0].score - 1.5) {
      const pickRoll = mulberry32(
        hashSeed(world.simSeed, world.day, encounterId, speakerId, 'pick'),
      )();
      if (pickRoll > 0.72) {
        chosen = ranked[1].entry;
      }
    }

    const nextHop = chosen.hopCount + 1;
    const { distorted, flavor } = chooseDistortion(
      world,
      encounterId,
      speakerId,
      rel,
      chosen,
    );
    const nextDistorted = chosen.distorted || distorted;
    const nextFlavor: NpcMemoryDistortionFlavor =
      flavor !== 'none' ? flavor : chosen.distortionFlavor;
    const nextProvenance: NpcMemoryProvenance =
      nextHop === 1 && !nextDistorted ? 'secondhand' : 'rumor';
    const step =
      nextHop === 1 ? GOSSIP_CONFIDENCE_STEP_HOP1 : GOSSIP_CONFIDENCE_STEP_HOP2;
    const nextConfidence = Math.max(
      GOSSIP_MIN_CONFIDENCE,
      chosen.confidence - step,
    );

    const transferredEntry = createNpcMemoryEntry({
      id: chosen.id,
      eventId: chosen.eventId,
      tag: chosen.tag,
      category: chosen.category,
      subjectPlayer: chosen.subjectPlayer,
      subjectResidents: chosen.subjectResidents,
      provenance: nextProvenance,
      sourceKind: 'gossip',
      originResidentId:
        chosen.originResidentId ?? (chosen.hopCount === 0 ? speakerId : undefined),
      fromResidentId: speakerId,
      hopCount: nextHop,
      confidence: nextConfidence,
      distorted: nextDistorted,
      distortionFlavor: nextFlavor,
      createdDay: chosen.createdDay,
      createdMinute: chosen.createdMinute,
      learnedDay: world.day,
      learnedMinute: world.minuteOfDay,
      importance: Math.max(1, chosen.importance - (nextHop >= 2 ? 1 : 0)),
      retention: nextProvenance === 'rumor' ? 'ephemeral' : 'durable',
      valence: chosen.valence,
      emotionalWeight: Math.max(20, chosen.emotionalWeight - 10),
      mentionedToPlayer: false,
      sharedCount: 0,
      detail: chosen.detail
        ? { ...chosen.detail, acousticOnly: undefined }
        : undefined,
    });

    recordNpcMemoryInPlace(npcMemories, listenerId, transferredEntry, world.day);

    // Increment sharedCount on speaker's entry cleanly
    const speakerIdx = speakerList.findIndex(
      (m) => m.eventId === chosen.eventId && m.id === chosen.id,
    );
    if (speakerIdx !== -1) {
      speakerList[speakerIdx] = {
        ...speakerList[speakerIdx],
        sharedCount: speakerList[speakerIdx].sharedCount + 1,
      };
    }

    // Stamp pair gossip cooldown
    stampNpcGossipInPlace(
      world.npcRelations,
      speakerId,
      listenerId,
      world.day,
      world.minuteOfDay,
      chosen.eventId,
    );

    transferred++;
    return {
      speakerId,
      listenerId,
      eventId: chosen.eventId,
      provenance: nextProvenance,
      distortionFlavor: nextFlavor,
    };
  }

  return null;
}

export function formatNpcMemorySummary(entry: NpcMemoryEntry): string {
  const fromName = entry.fromResidentId ? RESIDENTS[entry.fromResidentId]?.name : undefined;
  const subjects = entry.subjectResidents
    .map((id) => RESIDENTS[id]?.name ?? id)
    .join(' & ');

  if (entry.provenance === 'firsthand') {
    if (entry.tag === 'bell_chime' && entry.detail?.acousticOnly) {
      return 'Heard the Gazebo Bell chime clear across the neighborhood.';
    }
    if (entry.tag === 'bell_ring' || entry.tag === 'bell_restored') {
      return 'Saw the restored brass Gazebo Bell swing and echo over the square.';
    }
    if (entry.tag === 'player_gift') {
      return `Received ${entry.detail?.itemId ? entry.detail.itemId.replace('_', ' ') : 'a thoughtful gift'} directly from the newcomer.`;
    }
    if (entry.tag === 'player_help_observed') {
      return `Saw the newcomer carrying helpful parcels for ${subjects || 'a neighbor'}.`;
    }
    if (entry.tag === 'gazebo_rift') {
      return 'Carries an old ache from the quiet Gazebo Bell rift.';
    }
    return `Directly experienced ${entry.tag.replace(/_/g, ' ')}.`;
  }

  const prefix = fromName ? `Heard from ${fromName}` : 'Heard along the lane';
  if (entry.distortionFlavor === 'exaggerated') {
    return `${prefix} (vividly retold) about ${entry.tag.replace(/_/g, ' ')}.`;
  }
  if (entry.distortionFlavor === 'misattributed_motive') {
    return `${prefix} a tense impression regarding ${subjects || 'someone nearby'}.`;
  }
  if (entry.distortionFlavor === 'softened') {
    return `${prefix} a gentle account of ${entry.tag.replace(/_/g, ' ')}.`;
  }
  return `${prefix} about ${entry.tag.replace(/_/g, ' ')}.`;
}
