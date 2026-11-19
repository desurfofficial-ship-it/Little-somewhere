import {
  ActiveSocialEncounter,
  CarryableItemId,
  CharacterEmotion,
  JournalMemory,
  NpcNpcRelation,
  NpcRuntimeState,
  PlayerNpcRelation,
  ResidentActivityEntry,
  ResidentId,
  ResidentProgress,
  SeasonType,
  StoryFlags,
  TimePhase,
  TopicHistoryEntry,
  WeatherType,
  WorldEventRecord,
  WorldPropPlacement,
  WorldState,
} from './types';
import {
  RESIDENT_ORDER,
  createInitialResidentsProgress,
} from './residents';
import { createInitialStoryFlags } from './narrative';
import {
  MAX_ACTIVITY_HISTORY_PER_RESIDENT,
  MAX_WORLD_EVENTS,
  createInitialNpcActivityHistory,
  createInitialNpcRelations,
  createInitialPlayerRelations,
  getHeartLevel,
} from './relationships';
import {
  DAY_START_MINUTE,
  DEFAULT_START_MINUTE,
  SEASON_ORDER,
  clampMinuteOfDay,
  getSeasonForDay,
  getTimePhase,
} from './time';
import {
  DEFAULT_REGION_ID,
  PLAYER_DEFAULT_FACING,
  PLAYER_SPAWN,
  REGIONS,
  createInitialWorldProps,
  getSeatById,
  isPointWalkable,
} from './worldMap';
import { createInitialNpcRuntime } from './simulation';

export const CURRENT_SCHEMA_VERSION = 3;
export const DEFAULT_SIM_SEED = 18042;

export interface MigrationResult {
  state: WorldState;
  migratedFromVersion: number | null;
  warnings: string[];
}

const VALID_MOODS = new Set<ResidentProgress['mood']>([
  'peaceful',
  'wistful',
  'busy',
  'warm',
  'joyful',
]);
const VALID_EMOTIONS = new Set<CharacterEmotion>([
  'happy',
  'sad',
  'excited',
  'tired',
  'frustrated',
  'angry',
  'relaxed',
  'embarrassed',
  'curious',
  'surprised',
]);
const VALID_MEDIATION = new Set<StoryFlags['mediationStyle']>([
  'none',
  'gentle_truth',
  'shared_baking',
  'festival_ring',
]);
const VALID_WEATHERS = new Set<WeatherType>([
  'sunlit',
  'breezy',
  'misty_morning',
  'light_rain',
]);
const VALID_SEASONS = new Set<SeasonType>(SEASON_ORDER);
const VALID_ANIM_STATES = new Set<NpcRuntimeState['animState']>([
  'idle',
  'walk',
  'run',
  'sprint',
  'turn',
  'sit',
  'interact',
  'carry',
  'talk',
  'listen',
  'wave',
  'rest',
  'work',
  'sketch_read',
  'music',
  'converse',
  'admire',
]);
const VALID_CARRYABLE_IDS = new Set<CarryableItemId>([
  'water_pail',
  'rosemary_basket',
  'chalk_bundle',
  'tea_tray',
  'lost_parcel',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function clampNeed(value: unknown, fallback: number): number {
  return Math.max(0, Math.min(100, asFiniteNumber(value, fallback)));
}

export function createStarterMemories(): JournalMemory[] {
  return [
    {
      id: 'mem_arrival',
      day: 1,
      phase: 'morning',
      title: 'Moving Into Willow Step Cottage',
      summary:
        'Morning sunlight spilled across the cobblestone lane as I stepped onto my new porch.',
    },
  ];
}

export function createDefaultWorldState(): WorldState {
  const day = 1;
  const minuteOfDay = DEFAULT_START_MINUTE;
  const flags = createInitialStoryFlags();
  const residents = createInitialResidentsProgress();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    simSeed: DEFAULT_SIM_SEED,
    regionId: DEFAULT_REGION_ID,
    day,
    minuteOfDay,
    season: getSeasonForDay(day).season,
    weather: 'sunlit',
    playerPos: { ...PLAYER_SPAWN },
    playerFacing: PLAYER_DEFAULT_FACING,
    playerPosture: 'standing',
    playerSeatId: null,
    playerHeldItem: null,
    worldProps: createInitialWorldProps(),
    residents,
    npcRuntime: createInitialNpcRuntime(minuteOfDay, flags.claraArthurReconciled),
    playerRelations: createInitialPlayerRelations(residents),
    npcRelations: createInitialNpcRelations(flags.claraArthurReconciled),
    activeEncounters: [],
    worldEvents: [],
    npcActivityHistory: createInitialNpcActivityHistory(),
    topicHistory: {},
    lastTopicByResident: {},
    sideFlags: {},
    flags,
    memories: createStarterMemories(),
    mailboxUnread: true,
    dailyLettersRead: [],
    bellRungCount: 0,
  };
}

export function detectSchemaVersion(raw: unknown): number | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.schemaVersion === 'number' && Number.isFinite(raw.schemaVersion)) {
    return Math.floor(raw.schemaVersion);
  }
  // Legacy v1 saves had no schemaVersion field, but carried day + residents + flags
  if (typeof raw.day === 'number' && isRecord(raw.residents) && isRecord(raw.flags)) {
    return 1;
  }
  return null;
}

function sanitizeFlags(rawFlags: unknown, warnings: string[]): StoryFlags {
  const defaults = createInitialStoryFlags();
  if (!isRecord(rawFlags)) {
    warnings.push('flags missing or invalid; restored defaults');
    return defaults;
  }
  const mediation =
    typeof rawFlags.mediationStyle === 'string' &&
    VALID_MEDIATION.has(rawFlags.mediationStyle as StoryFlags['mediationStyle'])
      ? (rawFlags.mediationStyle as StoryFlags['mediationStyle'])
      : defaults.mediationStyle;

  return {
    heardBellMystery: asBoolean(rawFlags.heardBellMystery, defaults.heardBellMystery),
    foundPostcard: asBoolean(rawFlags.foundPostcard, defaults.foundPostcard),
    deliveredPostcard: asBoolean(rawFlags.deliveredPostcard, defaults.deliveredPostcard),
    brewedChamomileTea: asBoolean(rawFlags.brewedChamomileTea, defaults.brewedChamomileTea),
    borrowedBarnabyLadder: asBoolean(rawFlags.borrowedBarnabyLadder, defaults.borrowedBarnabyLadder),
    clearedGazeboIvy: asBoolean(rawFlags.clearedGazeboIvy, defaults.clearedGazeboIvy),
    foundBrassClapper: asBoolean(rawFlags.foundBrassClapper, defaults.foundBrassClapper),
    repairedFountain: asBoolean(rawFlags.repairedFountain, defaults.repairedFountain),
    plantedMoonPetals: asBoolean(rawFlags.plantedMoonPetals, defaults.plantedMoonPetals),
    mediationStyle: mediation,
    bellRestored: asBoolean(rawFlags.bellRestored, defaults.bellRestored),
    claraArthurReconciled: asBoolean(rawFlags.claraArthurReconciled, defaults.claraArthurReconciled),
    lanternsLit: asBoolean(rawFlags.lanternsLit, defaults.lanternsLit),
  };
}

function sanitizeResidents(rawResidents: unknown, warnings: string[]): Record<ResidentId, ResidentProgress> {
  const defaults = createInitialResidentsProgress();
  if (!isRecord(rawResidents)) {
    warnings.push('residents missing or invalid; restored defaults');
    return defaults;
  }
  const out = {} as Record<ResidentId, ResidentProgress>;
  for (const id of RESIDENT_ORDER) {
    const def = defaults[id];
    const entry = rawResidents[id];
    if (!isRecord(entry)) {
      out[id] = def;
      continue;
    }
    const rawTrust = asFiniteNumber(entry.trust, def.trust);
    const mood =
      typeof entry.mood === 'string' && VALID_MOODS.has(entry.mood as ResidentProgress['mood'])
        ? (entry.mood as ResidentProgress['mood'])
        : def.mood;
    out[id] = {
      trust: Math.max(0, Math.min(5, Math.round(rawTrust))),
      met: asBoolean(entry.met, def.met),
      talkedToday: asBoolean(entry.talkedToday, def.talkedToday),
      mood,
      lastDialogueId: typeof entry.lastDialogueId === 'string' ? entry.lastDialogueId : null,
    };
  }
  return out;
}

function sanitizeMemories(rawMemories: unknown): JournalMemory[] {
  const fallback = createStarterMemories();
  if (!Array.isArray(rawMemories)) return fallback;
  const out: JournalMemory[] = [];
  const seenIds = new Set<string>();
  for (const item of rawMemories) {
    if (!isRecord(item)) continue;
    if (typeof item.id !== 'string' || typeof item.title !== 'string' || typeof item.summary !== 'string') {
      continue;
    }
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    const day = Math.max(1, Math.floor(asFiniteNumber(item.day, 1)));
    const phase =
      item.phase === 'morning' || item.phase === 'afternoon' || item.phase === 'golden' || item.phase === 'dusk'
        ? item.phase
        : 'morning';
    const resId =
      typeof item.residentId === 'string' && (RESIDENT_ORDER as readonly string[]).includes(item.residentId)
        ? (item.residentId as ResidentId)
        : undefined;
    out.push({
      id: item.id,
      day,
      phase,
      title: item.title,
      summary: item.summary,
      ...(resId ? { residentId: resId } : {}),
    });
  }
  return out.length > 0 ? out : fallback;
}

function sanitizeNpcRuntime(
  rawRuntime: unknown,
  minuteOfDay: number,
  reconciled: boolean,
  warnings: string[],
): Record<ResidentId, NpcRuntimeState> {
  const defaults = createInitialNpcRuntime(minuteOfDay, reconciled);
  if (!isRecord(rawRuntime)) {
    return defaults;
  }
  const out = {} as Record<ResidentId, NpcRuntimeState>;
  for (const id of RESIDENT_ORDER) {
    const def = defaults[id];
    const entry = rawRuntime[id];
    if (!isRecord(entry)) {
      out[id] = def;
      continue;
    }

    const reservedSeatId =
      typeof entry.reservedSeatId === 'string' && getSeatById(entry.reservedSeatId)
        ? entry.reservedSeatId
        : null;
    const posture =
      entry.posture === 'sitting' && reservedSeatId ? 'sitting' : 'standing';

    let posX = def.position.x;
    let posZ = def.position.z;
    if (posture === 'sitting' && reservedSeatId) {
      const seat = getSeatById(reservedSeatId);
      if (seat) {
        posX = seat.seatPos.x;
        posZ = seat.seatPos.z;
      }
    } else if (isRecord(entry.position)) {
      const cx = asFiniteNumber(entry.position.x, def.position.x);
      const cz = asFiniteNumber(entry.position.z, def.position.z);
      if (isPointWalkable(cx, cz, 0.35)) {
        posX = cx;
        posZ = cz;
      } else {
        warnings.push(`npcRuntime.${id}.position clamped back to schedule slot`);
      }
    }

    const animState =
      typeof entry.animState === 'string' && VALID_ANIM_STATES.has(entry.animState as NpcRuntimeState['animState'])
        ? (entry.animState as NpcRuntimeState['animState'])
        : def.animState;

    const waypoints = Array.isArray(entry.waypoints)
      ? entry.waypoints
          .filter((wp): wp is Record<string, unknown> => isRecord(wp))
          .map((wp) => ({
            x: asFiniteNumber(wp.x, posX),
            z: asFiniteNumber(wp.z, posZ),
          }))
          .filter((wp) => isPointWalkable(wp.x, wp.z, 0.35))
      : [];

    let targetX = def.targetPos.x;
    let targetZ = def.targetPos.z;
    if (isRecord(entry.targetPos)) {
      const tx = asFiniteNumber(entry.targetPos.x, def.targetPos.x);
      const tz = asFiniteNumber(entry.targetPos.z, def.targetPos.z);
      if (isPointWalkable(tx, tz, 0.35)) {
        targetX = tx;
        targetZ = tz;
      }
    }

    const partner =
      typeof entry.socialPartnerId === 'string' &&
      (RESIDENT_ORDER as readonly string[]).includes(entry.socialPartnerId) &&
      entry.socialPartnerId !== id
        ? (entry.socialPartnerId as ResidentId)
        : null;

    const emotion =
      typeof entry.emotion === 'string' && VALID_EMOTIONS.has(entry.emotion as CharacterEmotion)
        ? (entry.emotion as CharacterEmotion)
        : def.emotion;

    const rawNeeds = isRecord(entry.needs) ? entry.needs : {};

    out[id] = {
      position: { x: posX, z: posZ },
      facing: asFiniteNumber(entry.facing, def.facing),
      animState,
      walkPhase: Math.max(0, asFiniteNumber(entry.walkPhase, 0)),
      currentActivityId:
        typeof entry.currentActivityId === 'string' ? entry.currentActivityId : def.currentActivityId,
      currentPlaceName:
        typeof entry.currentPlaceName === 'string' ? entry.currentPlaceName : def.currentPlaceName,
      currentActivityLabel:
        typeof entry.currentActivityLabel === 'string'
          ? entry.currentActivityLabel
          : def.currentActivityLabel,
      targetPos: { x: targetX, z: targetZ },
      targetFacing: asFiniteNumber(entry.targetFacing, def.targetFacing),
      waypoints,
      activityUntilMinute: clampMinuteOfDay(
        asFiniteNumber(entry.activityUntilMinute, def.activityUntilMinute),
      ),
      stuckSeconds: Math.max(0, asFiniteNumber(entry.stuckSeconds, 0)),
      socialPartnerId: partner,
      socialCooldownUntilMinute: Math.max(
        0,
        asFiniteNumber(entry.socialCooldownUntilMinute, def.socialCooldownUntilMinute),
      ),
      emotion,
      emotionIntensity: Math.max(0, Math.min(1, asFiniteNumber(entry.emotionIntensity, def.emotionIntensity))),
      emotionUntilMinute: Math.max(0, asFiniteNumber(entry.emotionUntilMinute, def.emotionUntilMinute)),
      needs: {
        energy: clampNeed(rawNeeds.energy, def.needs.energy),
        social: clampNeed(rawNeeds.social, def.needs.social),
        hunger: clampNeed(rawNeeds.hunger, def.needs.hunger),
        fulfillment: clampNeed(rawNeeds.fulfillment, def.needs.fulfillment),
      },
      posture,
      reservedSeatId,
      goalUtility: Math.max(0, asFiniteNumber(entry.goalUtility, def.goalUtility)),
      goalCommittedUntilMinute: Math.max(
        0,
        asFiniteNumber(entry.goalCommittedUntilMinute, def.goalCommittedUntilMinute),
      ),
      lastGreetedPlayerMinute: asFiniteNumber(entry.lastGreetedPlayerMinute, def.lastGreetedPlayerMinute),
      activeBubbleText: typeof entry.activeBubbleText === 'string' ? entry.activeBubbleText : null,
      activeBubbleUntilMinute: Math.max(0, asFiniteNumber(entry.activeBubbleUntilMinute, 0)),
      targetLookPos:
        isRecord(entry.targetLookPos) &&
        typeof entry.targetLookPos.x === 'number' &&
        typeof entry.targetLookPos.z === 'number' &&
        Number.isFinite(entry.targetLookPos.x) &&
        Number.isFinite(entry.targetLookPos.z)
          ? { x: entry.targetLookPos.x, z: entry.targetLookPos.z }
          : null,
      currentSpeed: Math.max(0, asFiniteNumber(entry.currentSpeed, 0)),
    };
  }
  return out;
}

function sanitizePlayerRelations(
  raw: unknown,
  residents: Record<ResidentId, ResidentProgress>,
): Record<ResidentId, PlayerNpcRelation> {
  const defaults = createInitialPlayerRelations(residents);
  if (!isRecord(raw)) return defaults;

  const out = {} as Record<ResidentId, PlayerNpcRelation>;
  for (const id of RESIDENT_ORDER) {
    const def = defaults[id];
    const entry = raw[id];
    if (!isRecord(entry)) {
      out[id] = def;
      continue;
    }
    const negativeCount = Math.max(0, Math.floor(asFiniteNumber(entry.negativeCount, 0)));
    const rawAffinity = Math.max(0, Math.min(100, Math.round(asFiniteNumber(entry.affinity, def.affinity))));
    const affinity =
      negativeCount > 0 || rawAffinity > 0
        ? rawAffinity
        : Math.max(residents[id].trust * 20, rawAffinity);
    const mood =
      typeof entry.mood === 'string' && VALID_MOODS.has(entry.mood as ResidentProgress['mood'])
        ? (entry.mood as ResidentProgress['mood'])
        : residents[id].mood;
    const lastEmotion =
      typeof entry.lastEmotion === 'string' && VALID_EMOTIONS.has(entry.lastEmotion as CharacterEmotion)
        ? (entry.lastEmotion as CharacterEmotion)
        : def.lastEmotion;

    out[id] = {
      residentId: id,
      affinity,
      familiarity: Math.max(0, Math.floor(asFiniteNumber(entry.familiarity, def.familiarity))),
      dailyAffinityGained: Math.max(
        0,
        Math.min(20, Math.floor(asFiniteNumber(entry.dailyAffinityGained, 0))),
      ),
      talkedCount: Math.max(0, Math.floor(asFiniteNumber(entry.talkedCount, def.talkedCount))),
      lastTalkDay:
        typeof entry.lastTalkDay === 'number' && Number.isFinite(entry.lastTalkDay) && entry.lastTalkDay >= 1
          ? Math.floor(entry.lastTalkDay)
          : null,
      lastTalkPhase:
        entry.lastTalkPhase === 'morning' ||
        entry.lastTalkPhase === 'afternoon' ||
        entry.lastTalkPhase === 'golden' ||
        entry.lastTalkPhase === 'dusk'
          ? entry.lastTalkPhase
          : null,
      mood,
      moodUntilMinute: Math.max(0, asFiniteNumber(entry.moodUntilMinute, 0)),
      reliability: Math.max(0, Math.min(100, Math.round(asFiniteNumber(entry.reliability, def.reliability)))),
      negativeCount,
      favorsCompleted: Math.max(0, Math.floor(asFiniteNumber(entry.favorsCompleted, 0))),
      giftsGiven: Math.max(0, Math.floor(asFiniteNumber(entry.giftsGiven, 0))),
      lastEmotion,
    };
    residents[id].trust =
      negativeCount > 0
        ? Math.min(5, getHeartLevel(affinity))
        : Math.min(5, Math.max(residents[id].trust, getHeartLevel(affinity)));
  }
  return out;
}

function sanitizeNpcRelations(
  raw: unknown,
  reconciled: boolean,
): Record<string, NpcNpcRelation> {
  const defaults = createInitialNpcRelations(reconciled);
  if (!isRecord(raw)) return defaults;

  const out: Record<string, NpcNpcRelation> = { ...defaults };
  const allKeys = new Set([...Object.keys(defaults), ...Object.keys(raw)]);
  for (const key of allKeys) {
    const entry = raw[key];
    if (!isRecord(entry)) continue;
    const parts = key.split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1] || parts[0] === parts[1]) continue;
    const def = defaults[key];
    const fallbackAffinity = def ? def.affinity : 24;
    const fallbackTension = def ? def.tension : 0;
    const fallbackTags = def ? def.sharedTags : [];
    const affinity = Math.max(-50, Math.min(100, Math.round(asFiniteNumber(entry.affinity, fallbackAffinity))));
    const tension = Math.max(0, Math.min(100, Math.round(asFiniteNumber(entry.tension, fallbackTension))));
    const sharedTags = Array.isArray(entry.sharedTags)
      ? entry.sharedTags.filter((t): t is string => typeof t === 'string').slice(-6)
      : fallbackTags;
    out[key] = {
      pair: def ? def.pair : (key as NpcNpcRelation['pair']),
      affinity: key === 'arthur:clara' && reconciled ? Math.max(55, affinity) : affinity,
      tension: key === 'arthur:clara' && reconciled ? Math.min(5, tension) : tension,
      sharedTags,
      lastInteractionDay:
        typeof entry.lastInteractionDay === 'number' && Number.isFinite(entry.lastInteractionDay)
          ? Math.floor(entry.lastInteractionDay)
          : null,
    };
  }
  return out;
}

function sanitizeWorldEvents(raw: unknown): WorldEventRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: WorldEventRecord[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    if (typeof item.id !== 'string' || typeof item.summary !== 'string' || typeof item.summaryTag !== 'string') {
      continue;
    }
    const kind =
      item.kind === 'story_flag' ||
      item.kind === 'npc_social' ||
      item.kind === 'bell_ring' ||
      item.kind === 'weather_shift' ||
      item.kind === 'player_help'
        ? item.kind
        : 'npc_social';
    const phase =
      item.phase === 'morning' || item.phase === 'afternoon' || item.phase === 'golden' || item.phase === 'dusk'
        ? item.phase
        : 'morning';
    const actors = Array.isArray(item.actors)
      ? item.actors.filter((a): a is ResidentId => typeof a === 'string' && (RESIDENT_ORDER as readonly string[]).includes(a))
      : [];
    out.push({
      id: item.id,
      day: Math.max(1, Math.floor(asFiniteNumber(item.day, 1))),
      phase,
      minuteOfDay: clampMinuteOfDay(asFiniteNumber(item.minuteOfDay, DEFAULT_START_MINUTE)),
      kind,
      actors,
      summary: item.summary,
      summaryTag: item.summaryTag,
    });
    if (out.length >= MAX_WORLD_EVENTS) break;
  }
  return out;
}

function sanitizeActiveEncounters(raw: unknown): ActiveSocialEncounter[] {
  if (!Array.isArray(raw)) return [];
  const out: ActiveSocialEncounter[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    if (
      typeof item.id !== 'string' ||
      !Array.isArray(item.participants) ||
      item.participants.length < 2 ||
      item.participants.length > 3 ||
      !Array.isArray(item.spots) ||
      item.spots.length < item.participants.length
    ) {
      continue;
    }
    const participants: ResidentId[] = [];
    let validActors = true;
    for (const p of item.participants) {
      if (typeof p !== 'string' || !(RESIDENT_ORDER as readonly string[]).includes(p)) {
        validActors = false;
        break;
      }
      participants.push(p as ResidentId);
    }
    if (!validActors) continue;

    const spots: Array<{ x: number; z: number }> = [];
    let validSpots = true;
    for (let i = 0; i < participants.length; i++) {
      const s = item.spots[i];
      if (!isRecord(s)) {
        validSpots = false;
        break;
      }
      const x = asFiniteNumber(s.x, 0);
      const z = asFiniteNumber(s.z, 0);
      if (!isPointWalkable(x, z, 0.35)) {
        validSpots = false;
        break;
      }
      spots.push({ x, z });
    }
    if (!validSpots) continue;

    out.push({
      id: item.id,
      participants,
      topicTag: typeof item.topicTag === 'string' ? item.topicTag : 'neighbor_chat',
      summary: typeof item.summary === 'string' ? item.summary : 'Sharing a quiet chat in the lane',
      spots,
      startedMinute: clampMinuteOfDay(asFiniteNumber(item.startedMinute, DEFAULT_START_MINUTE)),
      endsMinute: clampMinuteOfDay(asFiniteNumber(item.endsMinute, DEFAULT_START_MINUTE + 15)),
    });
  }
  return out;
}

function sanitizeNpcActivityHistory(raw: unknown): Record<ResidentId, ResidentActivityEntry[]> {
  const out = createInitialNpcActivityHistory();
  if (!isRecord(raw)) return out;
  for (const id of RESIDENT_ORDER) {
    const arr = raw[id];
    if (!Array.isArray(arr)) continue;
    out[id] = arr
      .filter((e): e is Record<string, unknown> => isRecord(e))
      .map((e) => ({
        day: Math.max(1, Math.floor(asFiniteNumber(e.day, 1))),
        minuteOfDay: clampMinuteOfDay(asFiniteNumber(e.minuteOfDay, DEFAULT_START_MINUTE)),
        activityId: typeof e.activityId === 'string' ? e.activityId : 'schedule',
        placeName: typeof e.placeName === 'string' ? e.placeName : 'Neighborhood',
        label: typeof e.label === 'string' ? e.label : 'Strolling the lane',
      }))
      .slice(0, MAX_ACTIVITY_HISTORY_PER_RESIDENT);
  }
  return out;
}

function sanitizeWorldProps(
  rawProps: unknown,
  rawHeldItem: unknown,
): {
  worldProps: Record<CarryableItemId, WorldPropPlacement>;
  playerHeldItem: CarryableItemId | null;
} {
  const defaults = createInitialWorldProps();
  const heldItem =
    typeof rawHeldItem === 'string' && VALID_CARRYABLE_IDS.has(rawHeldItem as CarryableItemId)
      ? (rawHeldItem as CarryableItemId)
      : null;

  if (!isRecord(rawProps)) {
    return { worldProps: defaults, playerHeldItem: heldItem };
  }

  const out = { ...defaults };
  for (const id of VALID_CARRYABLE_IDS) {
    const def = defaults[id];
    const entry = rawProps[id];
    if (!isRecord(entry)) continue;
    let pos = { ...def.pos };
    if (isRecord(entry.pos)) {
      const px = asFiniteNumber(entry.pos.x, def.pos.x);
      const pz = asFiniteNumber(entry.pos.z, def.pos.z);
      if (isPointWalkable(px, pz, 0.3)) {
        pos = { x: px, z: pz };
      }
    }
    const holder =
      entry.holder === 'player' ||
      entry.holder === 'world' ||
      (typeof entry.holder === 'string' && (RESIDENT_ORDER as readonly string[]).includes(entry.holder))
        ? (entry.holder as WorldPropPlacement['holder'])
        : 'world';
    out[id] = {
      ...def,
      pos,
      holder: heldItem === id ? 'player' : holder === 'player' && heldItem !== id ? 'world' : holder,
    };
  }
  return { worldProps: out, playerHeldItem: heldItem };
}

function sanitizeTopicHistory(raw: unknown): Record<string, TopicHistoryEntry> {
  const out: Record<string, TopicHistoryEntry> = {};
  if (!isRecord(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (!isRecord(v)) continue;
    const phase: TimePhase =
      v.lastSeenPhase === 'morning' ||
      v.lastSeenPhase === 'afternoon' ||
      v.lastSeenPhase === 'golden' ||
      v.lastSeenPhase === 'dusk'
        ? v.lastSeenPhase
        : 'morning';
    const chosenChoiceIds = Array.isArray(v.chosenChoiceIds)
      ? v.chosenChoiceIds.filter((c): c is string => typeof c === 'string').slice(-8)
      : [];
    out[k] = {
      seenCount: Math.max(0, Math.floor(asFiniteNumber(v.seenCount, 0))),
      lastSeenDay: Math.max(1, Math.floor(asFiniteNumber(v.lastSeenDay, 1))),
      lastSeenPhase: phase,
      chosenChoiceIds,
    };
  }
  return out;
}

function sanitizeLastTopicByResident(raw: unknown): Partial<Record<ResidentId, string>> {
  const out: Partial<Record<ResidentId, string>> = {};
  if (!isRecord(raw)) return out;
  for (const id of RESIDENT_ORDER) {
    if (typeof raw[id] === 'string') {
      out[id] = raw[id] as string;
    }
  }
  return out;
}

function sanitizeSideFlags(raw: unknown): Record<string, boolean | number | string> {
  const out: Record<string, boolean | number | string> = {};
  if (!isRecord(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || typeof v === 'string') {
      out[k] = v;
    }
  }
  return out;
}

export function sanitizeWorldState(candidate: unknown, externalWarnings: string[] = []): WorldState {
  if (!isRecord(candidate)) {
    return createDefaultWorldState();
  }

  const warnings = externalWarnings;
  const rawDay = asFiniteNumber(candidate.day, 1);
  const day = rawDay >= 1 ? Math.floor(rawDay) : 1;
  if (rawDay < 1 || !Number.isFinite(rawDay)) {
    warnings.push('invalid day clamped to 1');
  }

  const rawMin = asFiniteNumber(candidate.minuteOfDay, DEFAULT_START_MINUTE);
  const minuteOfDay = clampMinuteOfDay(Math.max(DAY_START_MINUTE, rawMin));

  const rawSeed = asFiniteNumber(candidate.simSeed, DEFAULT_SIM_SEED);
  const simSeed = (Math.floor(rawSeed) >>> 0) || DEFAULT_SIM_SEED;

  const rawSeatId =
    typeof candidate.playerSeatId === 'string' && getSeatById(candidate.playerSeatId)
      ? candidate.playerSeatId
      : null;
  const playerPosture =
    candidate.playerPosture === 'sitting' && rawSeatId ? 'sitting' : 'standing';
  const playerSeatId = playerPosture === 'sitting' ? rawSeatId : null;

  let playerX = PLAYER_SPAWN.x;
  let playerZ = PLAYER_SPAWN.z;
  let playerFacing = asFiniteNumber(candidate.playerFacing, PLAYER_DEFAULT_FACING);
  if (playerPosture === 'sitting' && playerSeatId) {
    const seat = getSeatById(playerSeatId)!;
    playerX = seat.seatPos.x;
    playerZ = seat.seatPos.z;
    playerFacing = seat.facingAngle;
  } else if (isRecord(candidate.playerPos)) {
    const cx = asFiniteNumber(candidate.playerPos.x, PLAYER_SPAWN.x);
    const cz = asFiniteNumber(candidate.playerPos.z, PLAYER_SPAWN.z);
    if (isPointWalkable(cx, cz, 0.48)) {
      playerX = cx;
      playerZ = cz;
    } else {
      warnings.push('non-walkable playerPos reset to PLAYER_SPAWN');
    }
  }

  const flags = sanitizeFlags(candidate.flags, warnings);
  const residents = sanitizeResidents(candidate.residents, warnings);
  const npcRuntime = sanitizeNpcRuntime(
    candidate.npcRuntime,
    minuteOfDay,
    flags.claraArthurReconciled,
    warnings,
  );
  const playerRelations = sanitizePlayerRelations(candidate.playerRelations, residents);
  const npcRelations = sanitizeNpcRelations(candidate.npcRelations, flags.claraArthurReconciled);
  const activeEncounters = sanitizeActiveEncounters(candidate.activeEncounters);
  const worldEvents = sanitizeWorldEvents(candidate.worldEvents);
  const npcActivityHistory = sanitizeNpcActivityHistory(candidate.npcActivityHistory);
  const { worldProps, playerHeldItem } = sanitizeWorldProps(
    candidate.worldProps,
    candidate.playerHeldItem,
  );
  const topicHistory = sanitizeTopicHistory(candidate.topicHistory);
  const lastTopicByResident = sanitizeLastTopicByResident(candidate.lastTopicByResident);
  const sideFlags = sanitizeSideFlags(candidate.sideFlags);

  const derivedSeason = getSeasonForDay(day).season;
  const season =
    typeof candidate.season === 'string' && VALID_SEASONS.has(candidate.season as SeasonType)
      ? derivedSeason
      : derivedSeason;

  const weather =
    typeof candidate.weather === 'string' && VALID_WEATHERS.has(candidate.weather as WeatherType)
      ? (candidate.weather as WeatherType)
      : 'sunlit';

  const dailyLettersRead = Array.isArray(candidate.dailyLettersRead)
    ? Array.from(
        new Set(
          candidate.dailyLettersRead
            .filter((d): d is number => typeof d === 'number' && Number.isFinite(d) && d >= 1)
            .map((d) => Math.floor(d)),
        ),
      )
    : [];

  const regionId =
    typeof candidate.regionId === 'string' && REGIONS[candidate.regionId]
      ? candidate.regionId
      : DEFAULT_REGION_ID;

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    simSeed,
    regionId,
    day,
    minuteOfDay,
    season,
    weather,
    playerPos: { x: playerX, z: playerZ },
    playerFacing,
    playerPosture,
    playerSeatId,
    playerHeldItem,
    worldProps,
    residents,
    npcRuntime,
    playerRelations,
    npcRelations,
    activeEncounters,
    worldEvents,
    npcActivityHistory,
    topicHistory,
    lastTopicByResident,
    sideFlags,
    flags,
    memories: sanitizeMemories(candidate.memories),
    mailboxUnread: asBoolean(candidate.mailboxUnread, true),
    dailyLettersRead,
    bellRungCount: Math.max(0, Math.floor(asFiniteNumber(candidate.bellRungCount, 0))),
  };
}

/**
 * Pure sequential v1 -> v2 save upgrader.
 */
export function migrateV1ToV2(v1Raw: Record<string, unknown>): Record<string, unknown> {
  const warnings: string[] = [];
  const day = Math.max(1, Math.floor(asFiniteNumber(v1Raw.day, 1)));
  const minuteOfDay = clampMinuteOfDay(asFiniteNumber(v1Raw.minuteOfDay, DEFAULT_START_MINUTE));
  const flags = sanitizeFlags(v1Raw.flags, warnings);
  const residents = sanitizeResidents(v1Raw.residents, warnings);
  const season = getSeasonForDay(day).season;
  const npcRuntime = createInitialNpcRuntime(minuteOfDay, flags.claraArthurReconciled);
  const playerRelations = createInitialPlayerRelations(residents);
  const npcRelations = createInitialNpcRelations(flags.claraArthurReconciled);

  const memories = sanitizeMemories(v1Raw.memories).map((m) => ({
    ...m,
    phase: m.phase || getTimePhase(minuteOfDay),
  }));

  return {
    ...v1Raw,
    schemaVersion: 2,
    simSeed: DEFAULT_SIM_SEED,
    regionId: DEFAULT_REGION_ID,
    day,
    minuteOfDay,
    season,
    weather: 'sunlit',
    residents,
    npcRuntime,
    playerRelations,
    npcRelations,
    activeEncounters: [],
    worldEvents: [],
    npcActivityHistory: createInitialNpcActivityHistory(),
    flags,
    memories,
  };
}

/**
 * Pure sequential v2 -> v3 save upgrader adding Character Excellence fields
 * (posture, seats, carryable props, dialogue topic history, side stories, needs & 10 emotions).
 */
export function migrateV2ToV3(v2Raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...v2Raw,
    schemaVersion: 3,
    playerPosture: 'standing',
    playerSeatId: null,
    playerHeldItem: null,
    worldProps: createInitialWorldProps(),
    topicHistory: {},
    lastTopicByResident: {},
    sideFlags: {},
  };
}

export function migrateWorldState(raw: unknown): MigrationResult {
  const warnings: string[] = [];
  const detected = detectSchemaVersion(raw);
  if (detected === null) {
    warnings.push('unrecognized or corrupt save payload; created fresh WorldState v3');
    return {
      state: createDefaultWorldState(),
      migratedFromVersion: null,
      warnings,
    };
  }

  let working: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  let version = detected;

  if (version === 1) {
    working = migrateV1ToV2(working);
    version = 2;
  }

  if (version === 2) {
    working = migrateV2ToV3(working);
    version = 3;
  }

  if (version > CURRENT_SCHEMA_VERSION) {
    warnings.push(`save version ${version} newer than runtime ${CURRENT_SCHEMA_VERSION}; sanitized conservatively`);
  }

  const sanitized = sanitizeWorldState(working, warnings);
  return {
    state: sanitized,
    migratedFromVersion: detected,
    warnings,
  };
}
