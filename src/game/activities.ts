import { cloneNpcMemories, createNpcMemoryEntry, recordNpcMemoryInPlace } from './memories';
import { getRelationshipTier, pushWorldEventInPlace } from './relationships';
import { RESIDENTS, getTimePhase } from './residents';
import { getFeaturedBookForDay } from './bookNook';
import {
  InteriorLocation,
  JournalMemory,
  PlayerNpcRelation,
  RelationshipTier,
  ResidentId,
  TeachingState,
  Vec2,
  WorldState,
} from './types';
import {
  NOOK_CHAIR_STATION_ID,
  NOOK_OCCUPANT_FACING,
  NOOK_OCCUPANT_POS,
} from './occupancy';

/**
 * Shared Activity Registry & Completion Transactions (Living Relationships — LR-2).
 *
 * Owns shared activity definitions, direct +6/+2 affinity/reliability application
 * (completely outside recordPlayerTalkAffinity's smalltalk cap), and idempotent
 * completion that unlocks the activity's memory once without touching nookState counters.
 *
 * Pure TypeScript — zero DOM, React, or Three.js dependencies.
 */

export interface SharedActivityDef {
  id: string;
  hostId: ResidentId;
  title: string;
  location: InteriorLocation;
  stationId: string;
  seatPos: Vec2;
  seatFacing: number;
  minTier: RelationshipTier;
  minAffinity: number;
  defaultDurationMinutes: number;
  minutesSpent: number;
  affinityDelta: number;
  reliabilityDelta: number;
  memoryId: string;
  memoryTitle: string;
  npcMemoryTag: string;
  /** Stored for future LR-4 teaching milestone; LR-2 does not grant knowledge. */
  knowledgeGranted?: string;
}

export const SHARED_ACTIVITIES: Readonly<Record<string, SharedActivityDef>> = {
  share_featured_reading: {
    id: 'share_featured_reading',
    hostId: 'nora',
    title: 'Shared Featured Reading',
    location: 'nook_interior',
    stationId: NOOK_CHAIR_STATION_ID,
    seatPos: { ...NOOK_OCCUPANT_POS },
    seatFacing: NOOK_OCCUPANT_FACING,
    minTier: 'friendly',
    minAffinity: 45,
    defaultDurationMinutes: 180,
    minutesSpent: 15,
    affinityDelta: 6,
    reliabilityDelta: 2,
    memoryId: 'mem_lr_nora_featured_reading',
    memoryTitle: 'Shared Pages by Lamplight',
    npcMemoryTag: 'shared_featured_reading',
    knowledgeGranted: 'nora_featured_reading',
  },
};

export function createInitialTeachingState(): TeachingState {
  return { known: [] };
}

export function getSharedActivityDef(activityId: string | undefined): SharedActivityDef | undefined {
  if (!activityId) return undefined;
  return SHARED_ACTIVITIES[activityId];
}

/**
 * Directly reward shared-activity affinity (+6) and reliability (+2) without reading
 * or incrementing `dailyAffinityGained` (doc 14 §5.2; doc 16 LR2-09 / LR2-10).
 */
export function applySharedActivityAffinity(
  world: WorldState,
  residentId: ResidentId,
  affinityDelta = 6,
  reliabilityDelta = 2,
): { nextWorld: WorldState; affinity: number; reliability: number } {
  const existingRel: PlayerNpcRelation = world.playerRelations?.[residentId] ?? {
    residentId,
    affinity: (world.residents[residentId]?.trust ?? 0) * 20,
    familiarity: world.residents[residentId]?.met ? 10 : 0,
    dailyAffinityGained: 0,
    talkedCount: world.residents[residentId]?.met ? 1 : 0,
    lastTalkDay: null,
    lastTalkPhase: null,
    mood: world.residents[residentId]?.mood ?? 'peaceful',
    moodUntilMinute: 0,
    reliability: 25,
    negativeCount: 0,
    favorsCompleted: 0,
    giftsGiven: 0,
    lastEmotion: 'relaxed',
  };

  const nextAffinity = Math.max(0, Math.min(100, existingRel.affinity + affinityDelta));
  const nextReliability = Math.max(
    0,
    Math.min(100, (existingRel.reliability ?? 25) + reliabilityDelta),
  );
  const nextRel: PlayerNpcRelation = {
    ...existingRel,
    affinity: nextAffinity,
    reliability: nextReliability,
    favorsCompleted: (existingRel.favorsCompleted ?? 0) + 1,
    lastEmotion: 'happy',
  };

  const currentRes = world.residents[residentId];
  const derivedHearts = Math.max(currentRes.trust, Math.min(5, Math.floor(nextAffinity / 20)));
  const nextResidents = {
    ...world.residents,
    [residentId]: {
      ...currentRes,
      trust: derivedHearts,
      mood: getRelationshipTier(nextAffinity) === 'stranger' ? currentRes.mood : ('warm' as const),
    },
  };

  return {
    nextWorld: {
      ...world,
      residents: nextResidents,
      playerRelations: {
        ...(world.playerRelations ?? {}),
        [residentId]: nextRel,
      },
    },
    affinity: nextAffinity,
    reliability: nextReliability,
  };
}

export interface CompleteSharedActivityResult {
  ok: boolean;
  world: WorldState;
  reason?: string;
  toast?: string;
  memoryUnlockedTitle?: string;
}

/**
 * Single transactional owner for completing an invited shared activity.
 * Idempotent on duplicate completion AND pre-seeded memory id (LR2-07 / LR2-07b).
 * Never calls solo Nook browse/tea reducers or modifies nookState counters (LR2-05).
 */
export function completeSharedActivity(
  world: WorldState,
  activityId: string,
): CompleteSharedActivityResult {
  const def = getSharedActivityDef(activityId);
  if (!def) {
    return { ok: false, world, reason: 'unknown_activity' };
  }

  const active = world.invitations?.active ?? null;
  if (!active || active.status !== 'accepted' || active.activityId !== def.id) {
    return { ok: false, world, reason: 'no_matching_accepted_invitation' };
  }

  if (active.hostId !== def.hostId) {
    return { ok: false, world, reason: 'host_mismatch' };
  }

  // Day/window live check (inline to avoid circular import with invitations.ts)
  const isLive =
    world.day <= active.expiresDay &&
    world.minuteOfDay >= active.windowStartMinute &&
    world.minuteOfDay <= active.windowEndMinute;
  if (!isLive) {
    return { ok: false, world, reason: 'invitation_expired' };
  }

  if (world.playerLocation !== def.location) {
    return { ok: false, world, reason: 'wrong_location' };
  }

  const occ = world.occupancy;
  if (!occ || occ.residentId !== def.hostId || occ.location !== def.location || occ.invitationId !== active.id) {
    return { ok: false, world, reason: 'occupant_not_present' };
  }

  // D-04/H-1 completion re-check (build10-lr-recovery doc 05 §4): the enter
  // reducer owns schedule drift at entry (doc 21 §1.4 Decision A); completion
  // owns the one remaining unowned window — a host pulled away mid-visit. In
  // normal play the occupant skip in stepSimulationInPlace keeps the seated
  // host out of encounter candidacy, so this can only trigger for corrupted or
  // hand-edited saves that restore occupancy while the host is in an exterior
  // encounter. The refusal is player-visible, grants nothing, and leaves the
  // accepted invite + occupancy untouched for the window-end tick expiry (or a
  // manual exit) to clean up. Static-schedule drift is deliberately NOT
  // re-checked here: a morning enter (window [540, 719]) may legitimately
  // complete after the 690 phase boundary with the host visibly seated as the
  // occupant — refusal there would contradict the on-screen state.
  if ((world.activeEncounters ?? []).some((enc) => enc.participants.includes(def.hostId))) {
    return {
      ok: false,
      world,
      reason: 'host_unavailable',
      toast: `${RESIDENTS[def.hostId].name} had to step out — the shared reading can't finish right now.`,
    };
  }

  // Idempotency guard (LR2-07 & LR2-07b): pre-seeded or already-unlocked memory blocks writes.
  if (world.memories.some((m) => m.id === def.memoryId)) {
    return { ok: false, world, reason: 'already_completed' };
  }

  const featuredBook = getFeaturedBookForDay(world.day);
  const phase = getTimePhase(world.minuteOfDay);

  const memoryRecord: JournalMemory = {
    id: def.memoryId,
    day: world.day,
    phase,
    title: def.memoryTitle,
    summary: `Read through ${featuredBook.title} together with ${RESIDENTS[def.hostId].name} inside Linden Book Nook — quiet pages, shared marginal notes, and easy company.`,
    residentId: def.hostId,
  };

  // Reward affinity & reliability (+6 / +2, clamped 0..100, zero smalltalk cap interaction)
  const affinityRes = applySharedActivityAffinity(
    world,
    def.hostId,
    def.affinityDelta,
    def.reliabilityDelta,
  );
  let nextWorld = affinityRes.nextWorld;

  // Host-only firsthand NPC memory (LR2-13: no direct write onto any other resident)
  const nextNpcMemories = cloneNpcMemories(nextWorld.npcMemories);
  const evId = `ev_shared_${def.id}_d${world.day}_${Math.round(world.minuteOfDay)}`;
  recordNpcMemoryInPlace(
    nextNpcMemories,
    def.hostId,
    createNpcMemoryEntry({
      id: evId,
      eventId: evId,
      tag: def.npcMemoryTag,
      category: 'interaction',
      subjectPlayer: true,
      subjectResidents: [def.hostId],
      provenance: 'firsthand',
      sourceKind: 'participant',
      createdDay: world.day,
      createdMinute: Math.round(world.minuteOfDay),
      importance: 4,
      retention: 'durable',
      valence: 'warm',
      emotionalWeight: 82,
      detail: {
        placeName: RESIDENTS[def.hostId].homeName,
      },
    }),
    world.day,
  );

  // Append single shared_activity world event (non-gossip player moment)
  const nextEvents = [...(nextWorld.worldEvents ?? [])];
  pushWorldEventInPlace(nextEvents, {
    id: evId,
    day: world.day,
    phase,
    minuteOfDay: Math.round(world.minuteOfDay),
    kind: 'shared_activity',
    actors: [def.hostId],
    summary: `Shared ${featuredBook.title} with ${RESIDENTS[def.hostId].name} at Linden Book Nook.`,
    summaryTag: def.npcMemoryTag,
  });

  // Archive invitation as completed, clear occupancy & activeActivity (capped history)
  const prevInvState = nextWorld.invitations ?? {
    active: null,
    history: [],
    lastOfferDayByHost: {},
  };
  const nextHistory = [
    ...prevInvState.history,
    {
      invitationId: active.id,
      hostId: active.hostId,
      activityId: active.activityId,
      day: world.day,
      outcome: 'completed' as const,
    },
  ].slice(-12);

  // Update host runtime emotion warmly so facial expression matches upon exiting
  const nextNpcRuntime = nextWorld.npcRuntime?.[def.hostId]
    ? {
        ...nextWorld.npcRuntime,
        [def.hostId]: {
          ...nextWorld.npcRuntime[def.hostId],
          emotion: 'happy' as const,
          emotionIntensity: 0.85,
          emotionUntilMinute: world.minuteOfDay + 90,
        },
      }
    : nextWorld.npcRuntime;

  nextWorld = {
    ...nextWorld,
    memories: [memoryRecord, ...nextWorld.memories],
    npcMemories: nextNpcMemories,
    worldEvents: nextEvents,
    npcRuntime: nextNpcRuntime,
    invitations: {
      ...prevInvState,
      active: null,
      history: nextHistory,
    },
    occupancy: null,
    activeActivity: null,
  };

  return {
    ok: true,
    world: nextWorld,
    toast: `Memory saved: ${def.memoryTitle}`,
    memoryUnlockedTitle: def.memoryTitle,
  };
}
