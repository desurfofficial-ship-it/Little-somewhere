import {
  ActiveSocialEncounter,
  JournalMemory,
  NpcNpcRelation,
  NpcRuntimeState,
  PlayerNpcRelation,
  ResidentActivityEntry,
  ResidentId,
  ResidentProgress,
  SeasonType,
  StoryFlags,
  WeatherType,
  WorldEventRecord,
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
  isPointWalkable,
} from './worldMap';
import { createInitialNpcRuntime } from './simulation';

export const CURRENT_SCHEMA_VERSION = 2;
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
  'work',
  'sketch_read',
  'music',
  'converse',
  'admire',
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
    residents,
    npcRuntime: createInitialNpcRuntime(minuteOfDay, flags.claraArthurReconciled),
    playerRelations: createInitialPlayerRelations(residents),
    npcRelations: createInitialNpcRelations(flags.claraArthurReconciled),
    activeEncounters: [],
    worldEvents: [],
    npcActivityHistory: createInitialNpcActivityHistory(),
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
    let posX = def.position.x;
    let posZ = def.position.z;
    if (isRecord(entry.position)) {
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
    const affinity = Math.max(
      residents[id].trust * 20,
      Math.min(100, Math.round(asFiniteNumber(entry.affinity, def.affinity))),
    );
    const mood =
      typeof entry.mood === 'string' && VALID_MOODS.has(entry.mood as ResidentProgress['mood'])
        ? (entry.mood as ResidentProgress['mood'])
        : residents[id].mood;
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
    };
    residents[id].trust = Math.min(5, Math.max(residents[id].trust, getHeartLevel(affinity)));
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
      item.participants.length !== 2 ||
      !Array.isArray(item.spots) ||
      item.spots.length !== 2
    ) {
      continue;
    }
    const [pA, pB] = item.participants;
    if (
      typeof pA !== 'string' ||
      typeof pB !== 'string' ||
      !(RESIDENT_ORDER as readonly string[]).includes(pA) ||
      !(RESIDENT_ORDER as readonly string[]).includes(pB)
    ) {
      continue;
    }
    const s0 = item.spots[0];
    const s1 = item.spots[1];
    if (!isRecord(s0) || !isRecord(s1)) continue;
    const x0 = asFiniteNumber(s0.x, 0);
    const z0 = asFiniteNumber(s0.z, 0);
    const x1 = asFiniteNumber(s1.x, 0);
    const z1 = asFiniteNumber(s1.z, 0);
    if (!isPointWalkable(x0, z0, 0.35) || !isPointWalkable(x1, z1, 0.35)) continue;
    out.push({
      id: item.id,
      participants: [pA as ResidentId, pB as ResidentId],
      topicTag: typeof item.topicTag === 'string' ? item.topicTag : 'neighbor_chat',
      summary: typeof item.summary === 'string' ? item.summary : 'Sharing a quiet chat in the lane',
      spots: [{ x: x0, z: z0 }, { x: x1, z: z1 }],
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

  let playerX = PLAYER_SPAWN.x;
  let playerZ = PLAYER_SPAWN.z;
  if (isRecord(candidate.playerPos)) {
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
    playerFacing: asFiniteNumber(candidate.playerFacing, PLAYER_DEFAULT_FACING),
    residents,
    npcRuntime,
    playerRelations,
    npcRelations,
    activeEncounters,
    worldEvents,
    npcActivityHistory,
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

  // Align phase field on any starter memory if needed
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

export function migrateWorldState(raw: unknown): MigrationResult {
  const warnings: string[] = [];
  const detected = detectSchemaVersion(raw);
  if (detected === null) {
    warnings.push('unrecognized or corrupt save payload; created fresh WorldState v2');
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
