import {
  ActiveSharedActivity,
  ActiveSocialEncounter,
  CarryableItemId,
  CharacterEmotion,
  CottageHomeState,
  DailyActivitiesState,
  GreenhouseCropId,
  GreenhouseGrowthStage,
  GreenhousePlotState,
  BakeryState,
  GreenhouseState,
  InteriorLocation,
  InteriorOccupant,
  InvitationHistoryEntry,
  InvitationRecord,
  InvitationState,
  JournalMemory,
  NpcMemoryDetail,
  NpcMemoryEntry,
  NpcNpcRelation,
  NpcRuntimeState,
  PersonalItemId,
  PlayerLocation,
  PlayerNpcRelation,
  RelationshipTier,
  ResidentActivityEntry,
  ResidentId,
  ResidentProgress,
  SeasonType,
  StoryFlags,
  TeachingState,
  TimePhase,
  TopicHistoryEntry,
  WeatherType,
  NookState,
  CopperwheelState,
  WorldEventRecord,
  WorldPropPlacement,
  WorldState,
} from './types';
import {
  INVITATION_HISTORY_CAP,
  createInitialInvitationState,
  isInvitationLive,
} from './invitations';
import { SHARED_ACTIVITIES, createInitialTeachingState } from './activities';
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
  getNpcPairKey,
} from './relationships';
import {
  DURABLE_MEMORY_TTL_DAYS,
  GOSSIP_MIN_CONFIDENCE,
  MAX_GOSSIP_HOPS,
  VALID_MEMORY_CATEGORIES,
  VALID_MEMORY_DISTORTIONS,
  VALID_MEMORY_PROVENANCES,
  VALID_MEMORY_RETENTIONS,
  VALID_MEMORY_SOURCE_KINDS,
  VALID_MEMORY_VALENCES,
  createEmptyNpcMemories,
  createInitialNpcMemories,
  createNpcMemoryEntry,
  enforceResidentMemoryCapInPlace,
  isMemoryExpired,
  recordNpcMemoryInPlace,
} from './memories';
import {
  DAY_END_MINUTE,
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
import { resolveAnySeatById } from './cottage';
import { createInitialNpcRuntime } from './simulation';
import {
  createInitialStorylines,
  hydrateStorylinesFromLegacyState,
  sanitizeStorylines,
} from './storylines';
import {
  MAX_ITEM_STACK,
  PERSONAL_ITEM_MAP,
  VALID_PERSONAL_ITEM_IDS,
  createStarterInventory,
} from './inventory';
import {
  COTTAGE_DOOR_SPAWN,
  COTTAGE_VASE_ITEMS,
  createInitialCottageState,
  createInitialDailyActivities,
  isInteriorPointWalkable,
} from './cottage';
import {
  GREENHOUSE_CROPS,
  GREENHOUSE_PLOT_COUNT,
  GREENHOUSE_DOOR_SPAWN,
  createInitialGreenhousePlot,
  createInitialGreenhouseState,
  isGreenhouseInteriorWalkable,
} from './greenhouse';
import { BAKERY_DOOR_SPAWN, createInitialBakeryState, isBakeryInteriorWalkable } from './bakery';
import {
  NOOK_DOOR_SPAWN,
  createInitialNookState,
  isNookInteriorWalkable,
} from './bookNook';
import {
  COPPERWHEEL_DOOR_SPAWN,
  createInitialCopperwheelState,
  isCopperwheelInteriorWalkable,
} from './copperwheel';

export const CURRENT_SCHEMA_VERSION = 11;
export const DEFAULT_SIM_SEED = 18042;

/**
 * Bounded-retention cap for the user-facing journal-memory projection
 * (systemic-reliability doc 03 §1 J-1/J-2).
 *
 * `world.memories` is a projection, not authoritative simulation state; every
 * other persisted collection is capped at append time, and this was the only
 * uncapped one (register F-SAVE-3 / SR-1). The headroom is deliberately
 * generous: the production content ceiling is ≈58 static `mem_*` ids, so the
 * cap can never trim a state the simulation itself produces — it only bounds
 * hand-edited or future-content states, deterministically (newest-first
 * slice at the sanitize choke point every save and load already flows
 * through). No schema bump: old saves converge at the next save.
 */
export const JOURNAL_MEMORY_CAP = 96;

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
  const starterInv = createStarterInventory();
  const starterDiscovered = Object.keys(starterInv) as PersonalItemId[];
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
    storylines: createInitialStorylines(),
    flags,
    memories: createStarterMemories(),
    npcMemories: createInitialNpcMemories(flags.claraArthurReconciled, day, minuteOfDay),
    mailboxUnread: true,
    dailyLettersRead: [],
    bellRungCount: 0,
    playerLocation: 'exterior',
    exteriorPlayerPos: { ...PLAYER_SPAWN },
    exteriorPlayerFacing: PLAYER_DEFAULT_FACING,
    inventory: starterInv,
    discoveredItemIds: starterDiscovered,
    cottageState: createInitialCottageState(),
    dailyActivities: createInitialDailyActivities(),
    neighborGiftsReceived: [],
    greenhouseState: createInitialGreenhouseState(),
    bakeryState: createInitialBakeryState(),
    nookState: createInitialNookState(),
    copperwheelState: createInitialCopperwheelState(),
    invitations: createInitialInvitationState(),
    occupancy: null,
    teaching: createInitialTeachingState(),
    activeActivity: null,
  };
}

export function detectSchemaVersion(raw: unknown): number | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.schemaVersion === 'number' && Number.isFinite(raw.schemaVersion)) {
    // The field exists, so the version claim is authoritative: an integer in
    // [1, ∞) is a real schema version (values above CURRENT_SCHEMA_VERSION
    // are handled by the migration chain's conservative path); garbage values
    // (negative, fractional) are NOT guessed into the legacy heuristic —
    // they are rejected as unrecognized (SR-9b).
    const v = Math.floor(raw.schemaVersion);
    return v >= 1 && v === raw.schemaVersion ? v : null;
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

function sanitizeMemories(rawMemories: unknown, warnings?: string[]): JournalMemory[] {
  const fallback = createStarterMemories();
  if (!Array.isArray(rawMemories)) return fallback;
  const out: JournalMemory[] = [];
  const seenIds = new Set<string>();
  let droppedRows = 0;
  for (const item of rawMemories) {
    if (!isRecord(item)) continue;
    if (
      typeof item.id !== 'string' ||
      item.id.trim().length === 0 ||
      typeof item.title !== 'string' ||
      typeof item.summary !== 'string'
    ) {
      droppedRows++;
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
  if (out.length > JOURNAL_MEMORY_CAP) {
    const dropped = out.length - JOURNAL_MEMORY_CAP;
    out.length = JOURNAL_MEMORY_CAP;
    warnings?.push(
      `world.memories trimmed to JOURNAL_MEMORY_CAP on load (${dropped} rows dropped, newest kept)`,
    );
  }
  if (droppedRows > 0) {
    warnings?.push(`journal memory rows with empty or malformed ids dropped on load (${droppedRows})`);
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
  warnings?: string[],
): Record<string, NpcNpcRelation> {
  const defaults = createInitialNpcRelations(reconciled);
  if (!isRecord(raw)) return defaults;

  const out: Record<string, NpcNpcRelation> = { ...defaults };
  // Reference-resolution rule (doc 03 §2 / SR-3): a persisted relation pair
  // must resolve to two REGISTERED residents. Pairs the baseline registry
  // does not seed are still legitimate — the tick engine creates them through
  // autonomous socialization (applyNpcSocialRelationInPlace / stampNpcGossip
  // InPlace) — so they are accepted. Pairs naming unregistered ids are
  // impossible for the simulation to produce and are dropped with a warning.
  // Non-canonical key spellings are re-keyed deterministically (the production
  // writer getNpcPairKey canonicalizes lexicographically).
  const residentSet = new Set<string>(RESIDENT_ORDER);
  let droppedUnknownPairs = 0;
  let normalizedNonCanonical = 0;
  for (const [rawKey, entry] of Object.entries(raw)) {
    if (!isRecord(entry)) continue;
    const parts = rawKey.split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1] || parts[0] === parts[1]) continue;
    if (!residentSet.has(parts[0]) || !residentSet.has(parts[1])) {
      droppedUnknownPairs++;
      continue;
    }
    const key = getNpcPairKey(parts[0] as ResidentId, parts[1] as ResidentId);
    if (key !== rawKey) normalizedNonCanonical++;
    const def = defaults[key];
    const isArthurPair = parts[0] === 'arthur' || parts[1] === 'arthur';
    const fallbackAffinity = def ? def.affinity : isArthurPair ? 10 : 24;
    const fallbackTension = def ? def.tension : isArthurPair ? 10 : 0;
    const fallbackTags = def ? def.sharedTags : [];
    const affinity = Math.max(-50, Math.min(100, Math.round(asFiniteNumber(entry.affinity, fallbackAffinity))));
    const tension = Math.max(0, Math.min(100, Math.round(asFiniteNumber(entry.tension, fallbackTension))));
    const sharedTags = Array.isArray(entry.sharedTags)
      ? entry.sharedTags.filter((t): t is string => typeof t === 'string').slice(-6)
      : fallbackTags;
    const sanitizedRel: NpcNpcRelation = {
      pair: key as NpcNpcRelation['pair'],
      affinity: key === 'arthur:clara' && reconciled ? Math.max(55, affinity) : affinity,
      tension: key === 'arthur:clara' && reconciled ? Math.min(5, tension) : tension,
      sharedTags,
      lastInteractionDay:
        typeof entry.lastInteractionDay === 'number' && Number.isFinite(entry.lastInteractionDay)
          ? Math.floor(entry.lastInteractionDay)
          : null,
    };
    if (
      typeof entry.lastGossipDay === 'number' &&
      Number.isFinite(entry.lastGossipDay) &&
      entry.lastGossipDay >= 1
    ) {
      sanitizedRel.lastGossipDay = Math.floor(entry.lastGossipDay);
    } else if (entry.lastGossipDay === null) {
      sanitizedRel.lastGossipDay = null;
    }
    if (typeof entry.lastGossipMinute === 'number' && Number.isFinite(entry.lastGossipMinute)) {
      sanitizedRel.lastGossipMinute = clampMinuteOfDay(entry.lastGossipMinute);
    } else if (entry.lastGossipMinute === null) {
      sanitizedRel.lastGossipMinute = null;
    }
    if (typeof entry.lastGossipEventId === 'string' && entry.lastGossipEventId.length > 0) {
      sanitizedRel.lastGossipEventId = entry.lastGossipEventId;
    }
    out[key] = sanitizedRel;
  }
  if (droppedUnknownPairs > 0) {
    warnings?.push(`npcRelations pairs naming unregistered residents dropped on load (${droppedUnknownPairs})`);
  }
  if (normalizedNonCanonical > 0) {
    warnings?.push(`non-canonical npcRelations pair keys normalized on load (${normalizedNonCanonical})`);
  }
  return out;
}

function sanitizeWorldEvents(raw: unknown, warnings?: string[]): WorldEventRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: WorldEventRecord[] = [];
  const seenIds = new Set<string>();
  let droppedDuplicates = 0;
  for (const item of raw) {
    if (!isRecord(item)) continue;
    if (typeof item.id !== 'string' || typeof item.summary !== 'string' || typeof item.summaryTag !== 'string') {
      continue;
    }
    if (seenIds.has(item.id)) {
      droppedDuplicates++;
      continue;
    }
    seenIds.add(item.id);
    const kind =
      item.kind === 'story_flag' ||
      item.kind === 'npc_social' ||
      item.kind === 'bell_ring' ||
      item.kind === 'weather_shift' ||
      item.kind === 'player_help' ||
      item.kind === 'storyline_beat' ||
      item.kind === 'conflict_shift' ||
      item.kind === 'shared_activity'
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
  if (droppedDuplicates > 0) {
    warnings?.push(`duplicate worldEvents ids dropped on load (${droppedDuplicates})`);
  }
  return out;
}

function sanitizeActiveEncounters(raw: unknown, warnings?: string[]): ActiveSocialEncounter[] {
  if (!Array.isArray(raw)) return [];
  const out: ActiveSocialEncounter[] = [];
  const seenIds = new Set<string>();
  let droppedDuplicates = 0;
  let droppedBackwards = 0;
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

    const startedMinute = clampMinuteOfDay(asFiniteNumber(item.startedMinute, DEFAULT_START_MINUTE));
    const endsMinute = clampMinuteOfDay(asFiniteNumber(item.endsMinute, DEFAULT_START_MINUTE + 15));
    if (endsMinute < startedMinute) {
      // Temporal sanity (doc 03 §2): an encounter cannot end before it starts.
      droppedBackwards++;
      continue;
    }
    if (seenIds.has(item.id)) {
      droppedDuplicates++;
      continue;
    }
    seenIds.add(item.id);

    out.push({
      id: item.id,
      participants,
      topicTag: typeof item.topicTag === 'string' ? item.topicTag : 'neighbor_chat',
      summary: typeof item.summary === 'string' ? item.summary : 'Sharing a quiet chat in the lane',
      spots,
      startedMinute,
      endsMinute,
    });
  }
  if (droppedDuplicates > 0) {
    warnings?.push(`duplicate activeEncounters ids dropped on load (${droppedDuplicates})`);
  }
  if (droppedBackwards > 0) {
    warnings?.push(`activeEncounters with endsMinute before startedMinute dropped on load (${droppedBackwards})`);
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

const VALID_TIERS = new Set<RelationshipTier>([
  'stranger',
  'acquaintance',
  'friendly',
  'close',
  'kindred',
]);

function sanitizeMemoryDetail(raw: unknown): NpcMemoryDetail | undefined {
  if (!isRecord(raw)) return undefined;
  const detail: NpcMemoryDetail = {};
  if (typeof raw.itemId === 'string' && VALID_CARRYABLE_IDS.has(raw.itemId as CarryableItemId)) {
    detail.itemId = raw.itemId as CarryableItemId;
  }
  if (typeof raw.personalItemId === 'string' && VALID_PERSONAL_ITEM_IDS.has(raw.personalItemId as PersonalItemId)) {
    detail.personalItemId = raw.personalItemId as PersonalItemId;
  }
  if (typeof raw.placeName === 'string' && raw.placeName.length > 0) {
    detail.placeName = raw.placeName;
  }
  if (typeof raw.targetTier === 'string' && VALID_TIERS.has(raw.targetTier as RelationshipTier)) {
    detail.targetTier = raw.targetTier as RelationshipTier;
  }
  if (typeof raw.acousticOnly === 'boolean') {
    detail.acousticOnly = raw.acousticOnly;
  }
  return Object.keys(detail).length > 0 ? detail : undefined;
}

function sanitizeNpcMemories(
  rawNpcMemories: unknown,
  reconciled: boolean,
  currentDay: number,
  minuteOfDay: number,
  warnings: string[],
): Record<ResidentId, NpcMemoryEntry[]> {
  if (!isRecord(rawNpcMemories)) {
    return createInitialNpcMemories(reconciled, currentDay, minuteOfDay);
  }

  const out = createEmptyNpcMemories();
  for (const rawKey of Object.keys(rawNpcMemories)) {
    if (!(RESIDENT_ORDER as readonly string[]).includes(rawKey)) {
      warnings.push(`ignored unknown resident key in npcMemories: ${rawKey}`);
    }
  }

  for (const id of RESIDENT_ORDER) {
    const rawList = rawNpcMemories[id];
    if (!Array.isArray(rawList)) continue;
    for (const item of rawList) {
      if (!isRecord(item)) continue;
      if (
        typeof item.id !== 'string' ||
        item.id.length === 0 ||
        typeof item.eventId !== 'string' ||
        item.eventId.length === 0 ||
        typeof item.tag !== 'string' ||
        item.tag.length === 0
      ) {
        warnings.push(`discarded malformed npcMemory entry on ${id}`);
        continue;
      }

      const provenance =
        typeof item.provenance === 'string' &&
        VALID_MEMORY_PROVENANCES.has(item.provenance as NpcMemoryEntry['provenance'])
          ? (item.provenance as NpcMemoryEntry['provenance'])
          : 'secondhand';
      const sourceKind =
        typeof item.sourceKind === 'string' &&
        VALID_MEMORY_SOURCE_KINDS.has(item.sourceKind as NpcMemoryEntry['sourceKind'])
          ? (item.sourceKind as NpcMemoryEntry['sourceKind'])
          : provenance === 'firsthand'
          ? 'participant'
          : 'gossip';
      const category =
        typeof item.category === 'string' &&
        VALID_MEMORY_CATEGORIES.has(item.category as NpcMemoryEntry['category'])
          ? (item.category as NpcMemoryEntry['category'])
          : 'event';
      const retention =
        typeof item.retention === 'string' &&
        VALID_MEMORY_RETENTIONS.has(item.retention as NpcMemoryEntry['retention'])
          ? (item.retention as NpcMemoryEntry['retention'])
          : provenance === 'rumor'
          ? 'ephemeral'
          : 'durable';
      const valence =
        typeof item.valence === 'string' &&
        VALID_MEMORY_VALENCES.has(item.valence as NpcMemoryEntry['valence'])
          ? (item.valence as NpcMemoryEntry['valence'])
          : 'neutral';
      const distortionFlavor =
        typeof item.distortionFlavor === 'string' &&
        VALID_MEMORY_DISTORTIONS.has(item.distortionFlavor as NpcMemoryEntry['distortionFlavor'])
          ? (item.distortionFlavor as NpcMemoryEntry['distortionFlavor'])
          : 'none';

      const createdDay = Math.max(1, Math.floor(asFiniteNumber(item.createdDay, currentDay)));
      const learnedDay = Math.max(
        createdDay,
        Math.floor(asFiniteNumber(item.learnedDay, createdDay)),
      );
      const createdMinute = clampMinuteOfDay(asFiniteNumber(item.createdMinute, minuteOfDay));
      const learnedMinute = clampMinuteOfDay(asFiniteNumber(item.learnedMinute, createdMinute));

      const hopCount =
        provenance === 'firsthand'
          ? 0
          : Math.max(
              1,
              Math.min(MAX_GOSSIP_HOPS, Math.floor(asFiniteNumber(item.hopCount, 1))),
            );
      const confidence =
        provenance === 'firsthand'
          ? 100
          : Math.max(
              GOSSIP_MIN_CONFIDENCE,
              Math.min(95, Math.round(asFiniteNumber(item.confidence, 70))),
            );

      const fromResidentId =
        typeof item.fromResidentId === 'string' &&
        (RESIDENT_ORDER as readonly string[]).includes(item.fromResidentId) &&
        item.fromResidentId !== id
          ? (item.fromResidentId as ResidentId)
          : undefined;
      const originResidentId =
        typeof item.originResidentId === 'string' &&
        (RESIDENT_ORDER as readonly string[]).includes(item.originResidentId)
          ? (item.originResidentId as ResidentId)
          : undefined;

      const subjectResidents = Array.isArray(item.subjectResidents)
        ? item.subjectResidents.filter(
            (r): r is ResidentId =>
              typeof r === 'string' && (RESIDENT_ORDER as readonly string[]).includes(r),
          )
        : [];

      const rawExpiresDay =
        retention !== 'permanent' &&
        typeof item.expiresDay === 'number' &&
        Number.isFinite(item.expiresDay)
          ? Math.max(learnedDay, Math.floor(item.expiresDay))
          : undefined;

      const entry = createNpcMemoryEntry({
        id: item.id,
        eventId: item.eventId,
        tag: item.tag,
        category,
        subjectPlayer: asBoolean(item.subjectPlayer, false),
        subjectResidents,
        provenance,
        sourceKind,
        originResidentId,
        fromResidentId,
        hopCount,
        confidence,
        distorted: provenance === 'firsthand' ? false : asBoolean(item.distorted, false),
        distortionFlavor:
          provenance === 'firsthand' || !asBoolean(item.distorted, false)
            ? 'none'
            : distortionFlavor,
        createdDay,
        createdMinute,
        learnedDay,
        learnedMinute,
        expiresDay: rawExpiresDay,
        importance: Math.max(1, Math.min(5, Math.round(asFiniteNumber(item.importance, 3)))),
        retention,
        valence,
        emotionalWeight: Math.max(
          0,
          Math.min(100, Math.round(asFiniteNumber(item.emotionalWeight, 50))),
        ),
        mentionedToPlayer: asBoolean(item.mentionedToPlayer, false),
        sharedCount: Math.max(0, Math.floor(asFiniteNumber(item.sharedCount, 0))),
        detail: sanitizeMemoryDetail(item.detail),
      });

      if (isMemoryExpired(entry, currentDay)) {
        continue;
      }
      recordNpcMemoryInPlace(out, id, entry, currentDay);
    }
    enforceResidentMemoryCapInPlace(out[id], currentDay);
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

  const playerLocation: PlayerLocation =
    candidate.playerLocation === 'cottage_interior' ||
    candidate.playerLocation === 'greenhouse_interior' ||
    candidate.playerLocation === 'bakery_interior' ||
    candidate.playerLocation === 'nook_interior' ||
    candidate.playerLocation === 'copperwheel_interior'
      ? (candidate.playerLocation as PlayerLocation)
      : 'exterior';
  const isInteriorLocation = playerLocation !== 'exterior';

  // Seats resolve across ALL registries (M3 Build 9 fix): indoor seats (cottage stools,
  // café chair, reading armchair, window armchair) previously fell through getSeatById's
  // outdoor-only lookup, so sitting at any indoor seat silently degraded to standing on save.
  const resolvedSeat =
    typeof candidate.playerSeatId === 'string' ? resolveAnySeatById(candidate.playerSeatId) : undefined;
  const rawSeatId =
    playerLocation === 'exterior'
      ? resolvedSeat && !resolvedSeat.indoor
        ? candidate.playerSeatId as string
        : null
      : resolvedSeat?.indoor
      ? candidate.playerSeatId as string
      : null;
  const playerPosture = rawSeatId && candidate.playerPosture === 'sitting' ? 'sitting' : 'standing';
  const playerSeatId = playerPosture === 'sitting' ? rawSeatId : null;

  let playerX =
    playerLocation === 'cottage_interior'
      ? COTTAGE_DOOR_SPAWN.x
      : playerLocation === 'greenhouse_interior'
      ? GREENHOUSE_DOOR_SPAWN.x
      : playerLocation === 'bakery_interior'
      ? BAKERY_DOOR_SPAWN.x
      : playerLocation === 'nook_interior'
      ? NOOK_DOOR_SPAWN.x
      : playerLocation === 'copperwheel_interior'
      ? COPPERWHEEL_DOOR_SPAWN.x
      : PLAYER_SPAWN.x;
  let playerZ =
    playerLocation === 'cottage_interior'
      ? COTTAGE_DOOR_SPAWN.z
      : playerLocation === 'greenhouse_interior'
      ? GREENHOUSE_DOOR_SPAWN.z
      : playerLocation === 'bakery_interior'
      ? BAKERY_DOOR_SPAWN.z
      : playerLocation === 'nook_interior'
      ? NOOK_DOOR_SPAWN.z
      : playerLocation === 'copperwheel_interior'
      ? COPPERWHEEL_DOOR_SPAWN.z
      : PLAYER_SPAWN.z;
  let playerFacing = asFiniteNumber(candidate.playerFacing, PLAYER_DEFAULT_FACING);
  if (playerPosture === 'sitting' && playerSeatId) {
    const seat = resolveAnySeatById(playerSeatId)!;
    playerX = seat.seatPos.x;
    playerZ = seat.seatPos.z;
    playerFacing = seat.facingAngle;
  } else if (isRecord(candidate.playerPos)) {
    const cx = asFiniteNumber(candidate.playerPos.x, playerX);
    const cz = asFiniteNumber(candidate.playerPos.z, playerZ);
    const walkable =
      playerLocation === 'cottage_interior'
        ? isInteriorPointWalkable(cx, cz, 0.42)
        : playerLocation === 'greenhouse_interior'
        ? isGreenhouseInteriorWalkable(cx, cz, 0.42)
        : playerLocation === 'bakery_interior'
        ? isBakeryInteriorWalkable(cx, cz, 0.42)
        : playerLocation === 'nook_interior'
        ? isNookInteriorWalkable(cx, cz, 0.42)
        : playerLocation === 'copperwheel_interior'
        ? isCopperwheelInteriorWalkable(cx, cz, 0.42)
        : isPointWalkable(cx, cz, 0.48);
    if (walkable) {
      playerX = cx;
      playerZ = cz;
    } else {
      warnings.push('non-walkable playerPos reset to safe spawn');
    }
  }

  let extX = !isInteriorLocation ? playerX : PLAYER_SPAWN.x;
  let extZ = !isInteriorLocation ? playerZ : PLAYER_SPAWN.z;
  if (isInteriorLocation && isRecord(candidate.exteriorPlayerPos)) {
    const cx = asFiniteNumber(candidate.exteriorPlayerPos.x, PLAYER_SPAWN.x);
    const cz = asFiniteNumber(candidate.exteriorPlayerPos.z, PLAYER_SPAWN.z);
    if (isPointWalkable(cx, cz, 0.48)) {
      extX = cx;
      extZ = cz;
    }
  }
  const exteriorPlayerFacing = asFiniteNumber(
    candidate.exteriorPlayerFacing,
    playerLocation === 'exterior' ? playerFacing : PLAYER_DEFAULT_FACING,
  );

  const flags = sanitizeFlags(candidate.flags, warnings);
  const residents = sanitizeResidents(candidate.residents, warnings);
  const npcRuntime = sanitizeNpcRuntime(
    candidate.npcRuntime,
    minuteOfDay,
    flags.claraArthurReconciled,
    warnings,
  );
  const playerRelations = sanitizePlayerRelations(candidate.playerRelations, residents);
  const npcRelations = sanitizeNpcRelations(candidate.npcRelations, flags.claraArthurReconciled, warnings);
  const activeEncounters = sanitizeActiveEncounters(candidate.activeEncounters, warnings);
  const worldEvents = sanitizeWorldEvents(candidate.worldEvents, warnings);
  const npcActivityHistory = sanitizeNpcActivityHistory(candidate.npcActivityHistory);
  const { worldProps, playerHeldItem } = sanitizeWorldProps(
    candidate.worldProps,
    candidate.playerHeldItem,
  );
  const topicHistory = sanitizeTopicHistory(candidate.topicHistory);
  const lastTopicByResident = sanitizeLastTopicByResident(candidate.lastTopicByResident);
  const sideFlags = sanitizeSideFlags(candidate.sideFlags);
  const storylines = sanitizeStorylines(
    candidate.storylines,
    { flags, sideFlags, day },
    warnings,
  );
  const npcMemories = sanitizeNpcMemories(
    candidate.npcMemories,
    flags.claraArthurReconciled,
    day,
    minuteOfDay,
    warnings,
  );

  const derivedSeason = getSeasonForDay(day).season;
  // Season is derived from the day (day-based season clock). A saved season
  // that disagrees is re-derived; make the normalization observable (SR-9).
  if (
    typeof candidate.season === 'string' &&
    VALID_SEASONS.has(candidate.season as SeasonType) &&
    candidate.season !== derivedSeason
  ) {
    warnings.push(
      `saved season '${String(candidate.season)}' re-derived from day ${day} as '${derivedSeason}'`,
    );
  }
  const season = derivedSeason;

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

  // Sanitize Milestone 2C v6 fields (inventory, discovered items, cottage home state, daily activities)
  const inventory: Partial<Record<PersonalItemId, number>> = {};
  if (isRecord(candidate.inventory)) {
    for (const [key, val] of Object.entries(candidate.inventory)) {
      if (!VALID_PERSONAL_ITEM_IDS.has(key as PersonalItemId)) continue;
      if (typeof val === 'number' && Number.isFinite(val) && val >= 1) {
        inventory[key as PersonalItemId] = Math.min(MAX_ITEM_STACK, Math.floor(val));
      }
    }
  } else if (candidate.inventory === undefined || candidate.inventory === null) {
    // Stable default: a missing OR null inventory gets the starter kit
    // (null previously yielded an empty inventory — asymmetry, SR-9c).
    Object.assign(inventory, createStarterInventory());
    warnings.push('inventory missing or null; restored starter kit');
  }

  const discoveredSet = new Set<PersonalItemId>();
  if (Array.isArray(candidate.discoveredItemIds)) {
    for (const item of candidate.discoveredItemIds) {
      if (typeof item === 'string' && VALID_PERSONAL_ITEM_IDS.has(item as PersonalItemId)) {
        discoveredSet.add(item as PersonalItemId);
      }
    }
  }
  for (const ownedId of Object.keys(inventory) as PersonalItemId[]) {
    discoveredSet.add(ownedId);
  }
  const discoveredItemIds = Array.from(discoveredSet);

  const defCottage = createInitialCottageState();
  const rawCottage = isRecord(candidate.cottageState) ? candidate.cottageState : {};
  const placedFlowerId =
    typeof rawCottage.placedFlowerId === 'string' &&
    COTTAGE_VASE_ITEMS.has(rawCottage.placedFlowerId as NonNullable<CottageHomeState['placedFlowerId']>)
      ? (rawCottage.placedFlowerId as CottageHomeState['placedFlowerId'])
      : null;
  const displayedKeepsakeIds = Array.isArray(rawCottage.displayedKeepsakeIds)
    ? Array.from(
        new Set(
          rawCottage.displayedKeepsakeIds.filter(
            (id): id is PersonalItemId =>
              typeof id === 'string' &&
              VALID_PERSONAL_ITEM_IDS.has(id as PersonalItemId) &&
              PERSONAL_ITEM_MAP[id as PersonalItemId]?.homeDisplayable === 'shelf' &&
              (inventory[id as PersonalItemId] ?? 0) > 0,
          ),
        ),
      ).slice(0, 5)
    : [];
  const cottageState: CottageHomeState = {
    placedFlowerId,
    displayedKeepsakeIds,
    hearthLit: asBoolean(rawCottage.hearthLit, defCottage.hearthLit),
    kettleWarmUntilMinute: Math.max(0, asFiniteNumber(rawCottage.kettleWarmUntilMinute, 0)),
    almanacReadToday: asBoolean(rawCottage.almanacReadToday, false),
    cottageRestCount: Math.max(0, Math.floor(asFiniteNumber(rawCottage.cottageRestCount, 0))),
  };

  const rawDaily = isRecord(candidate.dailyActivities) ? candidate.dailyActivities : {};
  const dailyActivities: DailyActivitiesState = {
    cottagePlanterTendedToday: asBoolean(rawDaily.cottagePlanterTendedToday, false),
    greenhousePlantersTendedToday: asBoolean(rawDaily.greenhousePlantersTendedToday, false),
    orchardHarvestedToday: asBoolean(rawDaily.orchardHarvestedToday, false),
    pondCombedToday: asBoolean(rawDaily.pondCombedToday, false),
    bakedCountToday: Math.max(0, Math.floor(asFiniteNumber(rawDaily.bakedCountToday, 0))),
    giftedResidentsToday: Array.isArray(rawDaily.giftedResidentsToday)
      ? Array.from(
          new Set(
            rawDaily.giftedResidentsToday.filter(
              (r): r is ResidentId =>
                typeof r === 'string' && (RESIDENT_ORDER as readonly string[]).includes(r),
            ),
          ),
        )
      : [],
  };

  const neighborGiftsReceived = Array.isArray(candidate.neighborGiftsReceived)
    ? Array.from(
        new Set(
          candidate.neighborGiftsReceived.filter(
            (r): r is ResidentId =>
              typeof r === 'string' && (RESIDENT_ORDER as readonly string[]).includes(r),
          ),
        ),
      )
    : [];

  const greenhouseState = sanitizeGreenhouseState(candidate.greenhouseState, warnings);
  const bakeryState = sanitizeBakeryState(candidate.bakeryState, warnings);
  const nookState = sanitizeNookState(candidate.nookState, warnings);
  const copperwheelState = sanitizeCopperwheelState(candidate.copperwheelState, warnings);
  const { invitations, occupancy, teaching, activeActivity } = sanitizeLivingRelationships(
    candidate,
    day,
    minuteOfDay,
    playerLocation,
    warnings,
  );

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
    playerHeldItem: isInteriorLocation ? null : playerHeldItem,
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
    storylines,
    flags,
    memories: sanitizeMemories(candidate.memories, warnings),
    npcMemories,
    mailboxUnread: asBoolean(candidate.mailboxUnread, true),
    dailyLettersRead,
    bellRungCount: Math.max(0, Math.floor(asFiniteNumber(candidate.bellRungCount, 0))),
    playerLocation,
    exteriorPlayerPos: { x: extX, z: extZ },
    exteriorPlayerFacing,
    inventory,
    discoveredItemIds,
    cottageState,
    dailyActivities,
    neighborGiftsReceived,
    greenhouseState,
    bakeryState,
    nookState,
    copperwheelState,
    invitations,
    occupancy,
    teaching,
    activeActivity,
  };
}

function sanitizeLivingRelationships(
  candidate: Record<string, unknown>,
  day: number,
  minuteOfDay: number,
  playerLocation: PlayerLocation,
  warnings: string[],
): {
  invitations: InvitationState;
  occupancy: InteriorOccupant | null;
  teaching: TeachingState;
  activeActivity: ActiveSharedActivity | null;
} {
  const validHosts = new Set<string>(RESIDENT_ORDER);
  const rawInv = isRecord(candidate.invitations) ? candidate.invitations : {};

  let active: InvitationRecord | null = null;
  if (rawInv.active !== null && rawInv.active !== undefined) {
    if (isRecord(rawInv.active)) {
      const a = rawInv.active;
      const id = typeof a.id === 'string' && a.id.trim().length > 0 ? a.id : null;
      const status = a.status === 'offered' || a.status === 'accepted' ? a.status : null;
      const hostId =
        typeof a.hostId === 'string' && validHosts.has(a.hostId)
          ? (a.hostId as ResidentId)
          : null;
      const activityId =
        typeof a.activityId === 'string' && Boolean(SHARED_ACTIVITIES[a.activityId])
          ? a.activityId
          : null;
      const offeredDay =
        typeof a.offeredDay === 'number' && Number.isFinite(a.offeredDay) && a.offeredDay >= 1
          ? Math.floor(a.offeredDay)
          : null;
      const expiresDay =
        typeof a.expiresDay === 'number' && Number.isFinite(a.expiresDay) && a.expiresDay >= 1
          ? Math.floor(a.expiresDay)
          : null;
      // Window domain (doc 03 §2 / SR-6): production windows are written by
      // computeOfferWindow within [360, DAY_END_MINUTE]; out-of-domain values
      // from hand-edited saves are clamped into that domain, never accepted.
      const rawWindowStart =
        typeof a.windowStartMinute === 'number' && Number.isFinite(a.windowStartMinute)
          ? a.windowStartMinute
          : null;
      const rawWindowEnd =
        typeof a.windowEndMinute === 'number' && Number.isFinite(a.windowEndMinute)
          ? a.windowEndMinute
          : null;
      const windowStartMinute =
        rawWindowStart !== null
          ? Math.max(360, Math.min(DAY_END_MINUTE, Math.floor(rawWindowStart)))
          : null;
      const windowEndMinute =
        rawWindowEnd !== null
          ? Math.max(360, Math.min(DAY_END_MINUTE, Math.floor(rawWindowEnd)))
          : null;
      if (
        (rawWindowStart !== null && rawWindowStart !== windowStartMinute) ||
        (rawWindowEnd !== null && rawWindowEnd !== windowEndMinute)
      ) {
        warnings.push('invitation window minutes clamped to the daily offer domain on load');
      }

      if (
        id &&
        status &&
        hostId &&
        activityId &&
        offeredDay !== null &&
        expiresDay !== null &&
        windowStartMinute !== null &&
        windowEndMinute !== null &&
        windowStartMinute <= windowEndMinute &&
        offeredDay <= day &&
        SHARED_ACTIVITIES[activityId].hostId === hostId
      ) {
        // expiresDay invariant (SR-5): the production writer (offerInvitation)
        // always sets expiresDay === offeredDay; re-pin mismatches so a
        // hand-edited "immortal" invite decays like every other offer.
        const pinnedExpiresDay = offeredDay;
        if (pinnedExpiresDay !== expiresDay) {
          warnings.push('invitation expiresDay re-pinned to offeredDay on load');
        }
        active = {
          id,
          status,
          hostId,
          activityId,
          offeredDay,
          expiresDay: pinnedExpiresDay,
          windowStartMinute,
          windowEndMinute,
        };
      } else {
        warnings.push('corrupted active invitation cleared during sanitization');
      }
    } else {
      warnings.push('invalid active invitation slot cleared during sanitization');
    }
  }

  const history: InvitationHistoryEntry[] = [];
  if (Array.isArray(rawInv.history)) {
    for (const item of rawInv.history) {
      if (!isRecord(item)) continue;
      const outcome =
        item.outcome === 'completed' || item.outcome === 'declined' || item.outcome === 'expired'
          ? item.outcome
          : null;
      const hostId =
        typeof item.hostId === 'string' && validHosts.has(item.hostId)
          ? (item.hostId as ResidentId)
          : null;
      const invitationId = typeof item.invitationId === 'string' ? item.invitationId : null;
      const activityId =
        typeof item.activityId === 'string' && item.activityId.length > 0
          ? item.activityId
          : 'share_featured_reading';
      const entryDay =
        typeof item.day === 'number' && Number.isFinite(item.day) && item.day >= 1
          ? Math.floor(item.day)
          : null;
      if (!outcome || !hostId || !invitationId || entryDay === null) continue;
      history.push({
        invitationId,
        hostId,
        activityId,
        day: entryDay,
        outcome,
        ...(typeof item.reason === 'string' && item.reason.length > 0
          ? { reason: item.reason }
          : {}),
      });
    }
  }
  const dedupedHistory: InvitationHistoryEntry[] = [];
  const seenInvitationIds = new Set<string>();
  let droppedHistoryDuplicates = 0;
  for (const entry of history) {
    if (seenInvitationIds.has(entry.invitationId)) {
      droppedHistoryDuplicates++;
      continue;
    }
    seenInvitationIds.add(entry.invitationId);
    dedupedHistory.push(entry);
  }
  if (droppedHistoryDuplicates > 0) {
    warnings.push(`duplicate invitation history rows dropped on load (${droppedHistoryDuplicates})`);
  }
  const cappedHistory =
    dedupedHistory.length > INVITATION_HISTORY_CAP
      ? dedupedHistory.slice(dedupedHistory.length - INVITATION_HISTORY_CAP)
      : dedupedHistory;

  const lastOfferDayByHost: Partial<Record<ResidentId, number>> = {};
  if (isRecord(rawInv.lastOfferDayByHost)) {
    for (const [k, v] of Object.entries(rawInv.lastOfferDayByHost)) {
      if (!validHosts.has(k)) continue;
      if (typeof v === 'number' && Number.isFinite(v) && v >= 1) {
        lastOfferDayByHost[k as ResidentId] = Math.floor(v);
      }
    }
  }

  // Load invariant step 1: archive non-live active invitations cleanly on load (LR2-16).
  let finalHistory = cappedHistory;
  if (active && !isInvitationLive(active, day, minuteOfDay)) {
    finalHistory = [
      ...cappedHistory,
      {
        invitationId: active.id,
        hostId: active.hostId,
        activityId: active.activityId,
        day,
        outcome: 'expired' as const,
      },
    ];
    if (finalHistory.length > INVITATION_HISTORY_CAP) {
      finalHistory = finalHistory.slice(finalHistory.length - INVITATION_HISTORY_CAP);
    }
    active = null;
    warnings.push('non-live active invitation archived on load');
  }

  // Load invariant step 2: activeActivity requires matching live active invite (LR1-15b).
  let activeActivity: ActiveSharedActivity | null = null;
  if (active && isRecord(candidate.activeActivity)) {
    const rawAct = candidate.activeActivity;
    if (
      typeof rawAct.activityId === 'string' &&
      rawAct.activityId === active.activityId &&
      Boolean(SHARED_ACTIVITIES[rawAct.activityId]) &&
      (rawAct.invitationId === undefined || rawAct.invitationId === active.id)
    ) {
      activeActivity = {
        activityId: active.activityId,
        invitationId: active.id,
      };
    }
  } else if (!active && isRecord(candidate.activeActivity)) {
    // Make the doc 14 §4.3 orphan rule observable (SR-9): an activeActivity
    // with no live active invitation is cleared, warned, every time.
    warnings.push('orphan activeActivity cleared on load (no live active invitation — doc 14 §4.3)');
  }

  // Load invariant step 3: occupancy requires interior location matching playerLocation,
  // accepted live invite for hostId, and matching invitationId (LR1-15, LR2-15, LR2-16).
  let occupancy: InteriorOccupant | null = null;
  if (
    active &&
    active.status === 'accepted' &&
    playerLocation !== 'exterior' &&
    isRecord(candidate.occupancy)
  ) {
    const occ = candidate.occupancy;
    const occPos = isRecord(occ.localPos) ? occ.localPos : null;
    if (
      typeof occ.residentId === 'string' &&
      occ.residentId === active.hostId &&
      occ.location === playerLocation &&
      typeof occ.stationId === 'string' &&
      occ.stationId === SHARED_ACTIVITIES[active.activityId].stationId &&
      occ.invitationId === active.id &&
      occPos &&
      typeof occPos.x === 'number' &&
      Number.isFinite(occPos.x) &&
      typeof occPos.z === 'number' &&
      Number.isFinite(occPos.z) &&
      typeof occ.facing === 'number' &&
      Number.isFinite(occ.facing)
    ) {
      occupancy = {
        residentId: occ.residentId as ResidentId,
        location: playerLocation as InteriorLocation,
        stationId: occ.stationId,
        localPos: { x: occPos.x, z: occPos.z },
        facing: occ.facing,
        invitationId: active.id,
      };
    } else {
      warnings.push('inconsistent interior occupancy cleared on load');
    }
  }

  // Load invariant step 4 (SR-2b): an occupancy without its activeActivity
  // slice is completed exactly the way the production writer would have
  // written it. The OPPOSITE direction (activeActivity without occupancy)
  // is deliberately NOT cleared here: doc 14 §4.3 / doc 16 §3 (LR1-15b)
  // anchor activeActivity to the LIVE ACTIVE INVITATION, not to occupancy —
  // a mid-visit activeActivity must survive load (the recovery contract of
  // record). Step 2 above already enforces the invitation anchor.
  if (occupancy && !activeActivity && active && active.status === 'accepted') {
    activeActivity = {
      activityId: active.activityId,
      invitationId: active.id,
    };
    warnings.push('activeActivity restored from accepted invitation occupancy on load');
  }

  const rawTeach = isRecord(candidate.teaching) ? candidate.teaching : {};
  const teachingKnown = Array.isArray(rawTeach.known)
    ? Array.from(
        new Set(
          rawTeach.known.filter((k): k is string => typeof k === 'string' && k.length > 0),
        ),
      )
    : [];

  return {
    invitations: {
      active,
      history: finalHistory,
      lastOfferDayByHost,
    },
    occupancy,
    teaching: { known: teachingKnown },
    activeActivity,
  };
}

/**
 * Defensive sanitizer for the Hearth & Crumb Bakery interior state (WorldState v8).
 * Day stamps stay >= 0; lifetime counters never go negative; unknown fields fall back to defaults.
 */
function sanitizeBakeryState(raw: unknown, warnings: string[]): BakeryState {
  const defaults = createInitialBakeryState();
  if (!isRecord(raw)) {
    return defaults;
  }
  const stamp = (value: unknown, fallback: number): number =>
    Math.max(0, Math.floor(asFiniteNumber(value, fallback)));
  const sanitized: BakeryState = {
    bakeCheckedDay: stamp(raw.bakeCheckedDay, defaults.bakeCheckedDay),
    kneadedDay: stamp(raw.kneadedDay, defaults.kneadedDay),
    loafSharedDay: stamp(raw.loafSharedDay, defaults.loafSharedDay),
    notesReadDay: stamp(raw.notesReadDay, defaults.notesReadDay),
    starterNotesDay: stamp(raw.starterNotesDay, defaults.starterNotesDay),
    kneadingSessions: Math.max(
      0,
      Math.floor(asFiniteNumber(raw.kneadingSessions, defaults.kneadingSessions)),
    ),
    loavesShared: Math.max(0, Math.floor(asFiniteNumber(raw.loavesShared, defaults.loavesShared))),
  };
  // Cross-consistency: the starter-loaf day can never precede the notes day it came with.
  if (sanitized.starterNotesDay > 0 && sanitized.notesReadDay === 0) {
    warnings.push('bakeryState starter day repaired against missing notes day');
    sanitized.notesReadDay = sanitized.starterNotesDay;
  }
  return sanitized;
}

/**
 * Defensive sanitizer for the Linden Book Nook interior state (WorldState v9).
 * Day stamps stay >= 0; lifetime counters never go negative; booksRead clamps to the shelf cycle.
 */
function sanitizeNookState(raw: unknown, warnings: string[]): NookState {
  const defaults = createInitialNookState();
  if (!isRecord(raw)) {
    return defaults;
  }
  const stamp = (value: unknown, fallback: number): number =>
    Math.max(0, Math.floor(asFiniteNumber(value, fallback)));
  return {
    shelfBrowsedDay: stamp(raw.shelfBrowsedDay, defaults.shelfBrowsedDay),
    teaSharedDay: stamp(raw.teaSharedDay, defaults.teaSharedDay),
    notesReadDay: stamp(raw.notesReadDay, defaults.notesReadDay),
    starterTeaDay: stamp(raw.starterTeaDay, defaults.starterTeaDay),
    booksRead: Math.min(4, Math.max(0, Math.floor(asFiniteNumber(raw.booksRead, defaults.booksRead)))),
    teasShared: Math.max(0, Math.floor(asFiniteNumber(raw.teasShared, defaults.teasShared))),
  };
}

/**
 * Defensive sanitizer for the Copperwheel Cottage interior state (WorldState v10).
 * Day stamps stay >= 0; lifetime counters never go negative; projectsAdmired clamps to the bench cycle.
 */
function sanitizeCopperwheelState(raw: unknown, warnings: string[]): CopperwheelState {
  const defaults = createInitialCopperwheelState();
  if (!isRecord(raw)) {
    return defaults;
  }
  const stamp = (value: unknown, fallback: number): number =>
    Math.max(0, Math.floor(asFiniteNumber(value, fallback)));
  return {
    benchCheckedDay: stamp(raw.benchCheckedDay, defaults.benchCheckedDay),
    helpedDay: stamp(raw.helpedDay, defaults.helpedDay),
    teaSharedDay: stamp(raw.teaSharedDay, defaults.teaSharedDay),
    notesReadDay: stamp(raw.notesReadDay, defaults.notesReadDay),
    starterTeaDay: stamp(raw.starterTeaDay, defaults.starterTeaDay),
    projectsAdmired: Math.min(
      4,
      Math.max(0, Math.floor(asFiniteNumber(raw.projectsAdmired, defaults.projectsAdmired))),
    ),
    windingSessions: Math.max(
      0,
      Math.floor(asFiniteNumber(raw.windingSessions, defaults.windingSessions)),
    ),
    teasShared: Math.max(0, Math.floor(asFiniteNumber(raw.teasShared, defaults.teasShared))),
  };
}

/**
 * Defensive sanitizer for the Sunbeam Greenhouse shared growing-corner state (WorldState v7).
 * Plot invariants: empty pots carry no progress; crops never exceed stage 3; counters never go negative.
 */
function sanitizeGreenhouseState(raw: unknown, warnings: string[]): GreenhouseState {
  const defaults = createInitialGreenhouseState();
  if (!isRecord(raw)) {
    return defaults;
  }
  const validCropIds = new Set(GREENHOUSE_CROPS.map((c) => c.id));
  const rawPlots = Array.isArray(raw.plots) ? raw.plots : [];
  const plots: GreenhousePlotState[] = [];
  for (let i = 0; i < GREENHOUSE_PLOT_COUNT; i++) {
    const entry = rawPlots[i];
    if (!isRecord(entry)) {
      plots.push(createInitialGreenhousePlot());
      continue;
    }
    const cropId =
      typeof entry.cropId === 'string' && validCropIds.has(entry.cropId as GreenhouseCropId)
        ? (entry.cropId as GreenhouseCropId)
        : null;
    if (!cropId) {
      plots.push(createInitialGreenhousePlot());
      continue;
    }
    const stageRaw = Math.floor(asFiniteNumber(entry.stage, 0));
    const stage = Math.max(0, Math.min(3, stageRaw)) as GreenhouseGrowthStage;
    const nightsGrown = Math.max(0, Math.floor(asFiniteNumber(entry.nightsGrown, 0)));
    plots.push({
      cropId,
      plantedDay: Math.max(1, Math.floor(asFiniteNumber(entry.plantedDay, 1))),
      nightsGrown: Math.max(nightsGrown, stage === 3 ? 1 : 0),
      stage,
      wateredToday: asBoolean(entry.wateredToday, false),
    });
  }
  if (rawPlots.length !== GREENHOUSE_PLOT_COUNT) {
    warnings.push('greenhouseState plots repaired to the fixed four-pot shelf');
  }
  return {
    plots,
    noteReadDay: Math.max(0, Math.floor(asFiniteNumber(raw.noteReadDay, 0))),
    totalHarvests: Math.max(0, Math.floor(asFiniteNumber(raw.totalHarvests, 0))),
    totalPlanted: Math.max(0, Math.floor(asFiniteNumber(raw.totalPlanted, 0))),
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

/**
 * Pure sequential v3 -> v4 save upgrader adding bounded per-NPC subjective memories.
 * Strictly avoids manufacturing firsthand memories without save-backed participant/witness evidence.
 */
export function migrateV3ToV4(v3Raw: Record<string, unknown>): Record<string, unknown> {
  const warnings: string[] = [];
  const day = Math.max(1, Math.floor(asFiniteNumber(v3Raw.day, 1)));
  const minuteOfDay = clampMinuteOfDay(asFiniteNumber(v3Raw.minuteOfDay, DEFAULT_START_MINUTE));
  const flags = sanitizeFlags(v3Raw.flags, warnings);
  const residents = sanitizeResidents(v3Raw.residents, warnings);
  const memories = sanitizeMemories(v3Raw.memories);
  const playerRelations = sanitizePlayerRelations(v3Raw.playerRelations, residents);
  const worldEvents = sanitizeWorldEvents(v3Raw.worldEvents);

  const npcMemories = createInitialNpcMemories(
    flags.claraArthurReconciled,
    day,
    minuteOfDay,
  );

  // Sole-author canonical story flags (each flag can only be triggered by that specific resident)
  if (flags.repairedFountain && RESIDENTS_HAS('barnaby')) {
    recordNpcMemoryInPlace(
      npcMemories,
      'barnaby',
      createNpcMemoryEntry({
        id: 'ev_fountain_fixed',
        eventId: 'ev_fountain_fixed',
        tag: 'fountain_fixed',
        category: 'event',
        subjectPlayer: true,
        subjectResidents: ['barnaby'],
        provenance: 'firsthand',
        sourceKind: 'participant',
        createdDay: day,
        createdMinute: minuteOfDay,
        importance: 4,
        retention: 'durable',
        valence: 'warm',
        emotionalWeight: 78,
        detail: { placeName: 'Fountain Plaza' },
      }),
      day,
    );
  }
  if (flags.plantedMoonPetals && RESIDENTS_HAS('mina')) {
    recordNpcMemoryInPlace(
      npcMemories,
      'mina',
      createNpcMemoryEntry({
        id: 'ev_moon_petals',
        eventId: 'ev_moon_petals',
        tag: 'moon_petals',
        category: 'event',
        subjectPlayer: true,
        subjectResidents: ['mina'],
        provenance: 'firsthand',
        sourceKind: 'participant',
        createdDay: day,
        createdMinute: minuteOfDay,
        importance: 4,
        retention: 'durable',
        valence: 'warm',
        emotionalWeight: 78,
        detail: { placeName: 'Willow Step Planters' },
      }),
      day,
    );
  }
  if (flags.deliveredPostcard && RESIDENTS_HAS('jun')) {
    recordNpcMemoryInPlace(
      npcMemories,
      'jun',
      createNpcMemoryEntry({
        id: 'ev_postcard_delivered',
        eventId: 'ev_postcard_delivered',
        tag: 'postcard_delivered',
        category: 'interaction',
        subjectPlayer: true,
        subjectResidents: ['jun'],
        provenance: 'firsthand',
        sourceKind: 'participant',
        createdDay: day,
        createdMinute: minuteOfDay,
        importance: 3,
        retention: 'durable',
        valence: 'warm',
        emotionalWeight: 72,
      }),
      day,
    );
  }
  if (flags.brewedChamomileTea && RESIDENTS_HAS('sora')) {
    recordNpcMemoryInPlace(
      npcMemories,
      'sora',
      createNpcMemoryEntry({
        id: 'ev_chamomile_tea',
        eventId: 'ev_chamomile_tea',
        tag: 'chamomile_tea',
        category: 'interaction',
        subjectPlayer: true,
        subjectResidents: ['sora'],
        provenance: 'firsthand',
        sourceKind: 'participant',
        createdDay: day,
        createdMinute: minuteOfDay,
        importance: 3,
        retention: 'durable',
        valence: 'warm',
        emotionalWeight: 70,
      }),
      day,
    );
  }
  if (flags.bellRestored && RESIDENTS_HAS('arthur')) {
    recordNpcMemoryInPlace(
      npcMemories,
      'arthur',
      createNpcMemoryEntry({
        id: 'ev_bell_restored',
        eventId: 'ev_bell_restored',
        tag: 'bell_restored',
        category: 'event',
        subjectPlayer: true,
        subjectResidents: ['arthur'],
        provenance: 'firsthand',
        sourceKind: 'participant',
        createdDay: day,
        createdMinute: minuteOfDay,
        importance: 5,
        retention: 'permanent',
        valence: 'warm',
        emotionalWeight: 95,
        detail: { placeName: 'Old Bell Gazebo' },
      }),
      day,
    );
  }

  // Player Journal memories with explicit resident attribution provide verified participation evidence
  for (const jm of memories) {
    if (!jm.residentId || !RESIDENTS_HAS(jm.residentId)) continue;
    if (jm.id === 'mem_brass_clapper') {
      recordNpcMemoryInPlace(
        npcMemories,
        jm.residentId,
        createNpcMemoryEntry({
          id: 'ev_brass_clapper',
          eventId: 'ev_brass_clapper',
          tag: 'brass_clapper',
          category: 'interaction',
          subjectPlayer: true,
          subjectResidents: [jm.residentId],
          provenance: 'firsthand',
          sourceKind: 'participant',
          createdDay: jm.day,
          createdMinute: minuteOfDay,
          importance: 4,
          retention: 'durable',
          valence: 'warm',
          emotionalWeight: 75,
        }),
        day,
      );
    } else if (jm.id === 'mem_bell_mystery') {
      recordNpcMemoryInPlace(
        npcMemories,
        jm.residentId,
        createNpcMemoryEntry({
          id: 'ev_bell_mystery',
          eventId: 'ev_bell_mystery',
          tag: 'bell_mystery',
          category: 'interaction',
          subjectPlayer: true,
          subjectResidents: [jm.residentId],
          provenance: 'firsthand',
          sourceKind: 'participant',
          createdDay: jm.day,
          createdMinute: minuteOfDay,
          importance: 3,
          retention: 'durable',
          valence: 'neutral',
          emotionalWeight: 60,
        }),
        day,
      );
    }
  }

  // Recorded player friction per resident
  for (const id of RESIDENT_ORDER) {
    const prel = playerRelations[id];
    if (prel && prel.negativeCount > 0) {
      const fDay = prel.lastTalkDay ?? day;
      recordNpcMemoryInPlace(
        npcMemories,
        id,
        createNpcMemoryEntry({
          id: `ev_player_blunt_${id}`,
          eventId: `ev_player_blunt_${id}`,
          tag: 'player_blunt',
          category: 'friction',
          subjectPlayer: true,
          subjectResidents: [id],
          provenance: 'firsthand',
          sourceKind: 'participant',
          createdDay: Math.min(day, fDay),
          createdMinute: minuteOfDay,
          importance: 3,
          retention: 'durable',
          valence: 'tense',
          emotionalWeight: 70,
        }),
        day,
      );
    }
  }

  // Recent single-actor player_help worldEvents provide verified recipient evidence
  for (const ev of worldEvents) {
    if (day - ev.day > DURABLE_MEMORY_TTL_DAYS || ev.day > day) continue;
    if (ev.kind === 'player_help' && ev.actors.length === 1) {
      const targetId = ev.actors[0];
      recordNpcMemoryInPlace(
        npcMemories,
        targetId,
        createNpcMemoryEntry({
          id: ev.id,
          eventId: ev.id,
          tag: 'player_gift',
          category: 'interaction',
          subjectPlayer: true,
          subjectResidents: [targetId],
          provenance: 'firsthand',
          sourceKind: 'participant',
          createdDay: ev.day,
          createdMinute: ev.minuteOfDay,
          importance: 3,
          retention: 'durable',
          valence: 'warm',
          emotionalWeight: 70,
        }),
        day,
      );
    }
  }

  return {
    ...v3Raw,
    schemaVersion: 4,
    npcMemories,
  };
}

function RESIDENTS_HAS(id: ResidentId): boolean {
  return (RESIDENT_ORDER as readonly string[]).includes(id);
}

/**
 * Pure sequential v4 -> v5 save upgrader adding structured multi-stage storyline progress
 * hydrated cleanly from existing v4 story flags and sideFlags while leaving v4 npcMemories intact.
 */
export function migrateV4ToV5(v4Raw: Record<string, unknown>): Record<string, unknown> {
  const warnings: string[] = [];
  const day = Math.max(1, Math.floor(asFiniteNumber(v4Raw.day, 1)));
  const flags = sanitizeFlags(v4Raw.flags, warnings);
  const sideFlags = sanitizeSideFlags(v4Raw.sideFlags);
  const storylines = hydrateStorylinesFromLegacyState({ flags, sideFlags, day });

  return {
    ...v4Raw,
    schemaVersion: 5,
    storylines,
  };
}

/**
 * Pure sequential v5 -> v6 save upgrader adding Milestone 2C Everyday Life fields:
 * cottage interior location/state, personal satchel inventory, daily activities, and keepsake tracking.
 */
export function migrateV5ToV6(v5Raw: Record<string, unknown>): Record<string, unknown> {
  const starterInv = createStarterInventory();
  const discovered = Object.keys(starterInv) as PersonalItemId[];

  // Grant keepsake editions for already-completed storylines in legacy saves
  const storylines = isRecord(v5Raw.storylines) ? v5Raw.storylines : {};
  const zine = isRecord(storylines.side_pip_zine) ? storylines.side_pip_zine : null;
  if (zine && zine.status === 'completed') {
    starterInv.willow_zine_copy = 1;
    discovered.push('willow_zine_copy');
  }

  const extPos = isRecord(v5Raw.playerPos)
    ? {
        x: asFiniteNumber(v5Raw.playerPos.x, PLAYER_SPAWN.x),
        z: asFiniteNumber(v5Raw.playerPos.z, PLAYER_SPAWN.z),
      }
    : { ...PLAYER_SPAWN };

  return {
    ...v5Raw,
    schemaVersion: 6,
    playerLocation: 'exterior',
    exteriorPlayerPos: extPos,
    exteriorPlayerFacing: asFiniteNumber(v5Raw.playerFacing, PLAYER_DEFAULT_FACING),
    inventory: starterInv,
    discoveredItemIds: discovered,
    cottageState: createInitialCottageState(),
    dailyActivities: createInitialDailyActivities(),
    neighborGiftsReceived: [],
  };
}

/**
 * Pure sequential v6 -> v7 save upgrader adding Milestone 3 Build 6 fields:
 * the Sunbeam Greenhouse shared growing-corner state. Existing interior locations are preserved.
 */
export function migrateV6ToV7(v6Raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...v6Raw,
    schemaVersion: 7,
    greenhouseState: createInitialGreenhouseState(),
  };
}

/**
 * Pure sequential v7 -> v8 save upgrader adding Milestone 3 Build 7 fields:
 * the Hearth & Crumb Bakery visitable-interior state. Existing interior locations are preserved.
 */
export function migrateV7ToV8(v7Raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...v7Raw,
    schemaVersion: 8,
    bakeryState: createInitialBakeryState(),
  };
}

/**
 * Pure sequential v8 -> v9 save upgrader adding Milestone 3 Build 8 fields:
 * the Linden Book Nook visitable-interior state. Existing interior locations are preserved.
 */
export function migrateV8ToV9(v8Raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...v8Raw,
    schemaVersion: 9,
    nookState: createInitialNookState(),
  };
}

/**
 * Pure sequential v9 -> v10 save upgrader adding Milestone 3 Build 9 fields:
 * the Copperwheel Cottage visitable-interior state. Existing interior locations are preserved.
 */
export function migrateV9ToV10(v9Raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...v9Raw,
    schemaVersion: 10,
    copperwheelState: createInitialCopperwheelState(),
  };
}

/**
 * Pure sequential v10 -> v11 save upgrader adding Living Relationships slices
 * (invitations, interior occupancy, teaching, active shared activity) while leaving
 * all prior interior and progress slices untouched.
 */
export function migrateV10ToV11(v10Raw: Record<string, unknown>): Record<string, unknown> {
  return {
    ...v10Raw,
    schemaVersion: 11,
    invitations: v10Raw.invitations ?? createInitialInvitationState(),
    occupancy: v10Raw.occupancy ?? null,
    teaching: v10Raw.teaching ?? createInitialTeachingState(),
    activeActivity: v10Raw.activeActivity ?? null,
  };
}

export function migrateWorldState(raw: unknown): MigrationResult {
  const warnings: string[] = [];
  const detected = detectSchemaVersion(raw);
  if (detected === null) {
    warnings.push(`unrecognized or corrupt save payload; created fresh WorldState v${CURRENT_SCHEMA_VERSION}`);
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

  if (version === 3) {
    working = migrateV3ToV4(working);
    version = 4;
  }

  if (version === 4) {
    working = migrateV4ToV5(working);
    version = 5;
  }

  if (version === 5) {
    working = migrateV5ToV6(working);
    version = 6;
  }

  if (version === 6) {
    working = migrateV6ToV7(working);
    version = 7;
  }

  if (version === 7) {
    working = migrateV7ToV8(working);
    version = 8;
  }

  if (version === 8) {
    working = migrateV8ToV9(working);
    version = 9;
  }

  if (version === 9) {
    working = migrateV9ToV10(working);
    version = 10;
  }

  if (version === 10) {
    working = migrateV10ToV11(working);
    version = 11;
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
