import { cloneNpcMemories, createNpcMemoryEntry, recordNpcMemoryInPlace } from './memories';
import { getRelationshipTier, pushWorldEventInPlace } from './relationships';
import { RESIDENTS, getTimePhase } from './residents';
import { getFeaturedBookForDay } from './bookNook';
import { BAKERY_SEAT_SPOTS, getBakeForDay } from './bakery';
import {
  InteriorLocation,
  JournalMemory,
  PlayerNpcRelation,
  RelationshipTier,
  ResidentId,
  TeachingState,
  TimePhase,
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
  /**
   * [LR-3, D10 — USER APPROVED 2026-11-21] Optional offer-phase constraint:
   * when present, `canOfferInvitation` refuses with `offer_phase_closed` outside
   * these phases. Absence (Nora) leaves the generic gates untouched (LR3-86).
   */
  offerPhases?: readonly TimePhase[];
  /**
   * [LR-3 integration remediation, B-03] Optional bake-roster constraint:
   * when present, `canOfferInvitation` refuses with `host_unavailable` on days
   * when the host's venue roster has nothing to share (Hearth & Crumb oven-rest
   * days, where `getBakeForDay(day).shareItemId === null` every 4th day).
   * Without this gate the offer text, the completion journal line, and the
   * capability rows all advertise a pastry that does not exist on rest days.
   * Absence (Nora) leaves the generic gates untouched. Checked after the D10
   * phase gate, before schedule availability.
   */
  requiresShareableBake?: boolean;
  /**
   * [LR-3, doc 05 §5.1] Optional venue-voiced arrival line, composed by the
   * enter reducer when the helper places the occupant. Absent = generic line.
   */
  arrivalLine?: (hostName: string) => string;
  /**
   * [LR-3, D9 / F1] Optional venue-aware completion text. When present, the
   * completion transaction uses these instead of the book-nook composition so
   * a second venue cannot lie in the journal or world events. Absent = the
   * historic composition (byte-identical for Nora).
   */
  summaryCompose?: (world: WorldState) => { memorySummary: string; eventSummary: string };
  /**
   * [LR-3, D9 scope] Venue noun for the host-unavailable completion refusal
   * ("the shared <noun> can't finish right now"). Absent = the historic nook
   * noun (byte-identical for Nora).
   */
  activityNoun?: string;
  /**
   * [LR-3, doc 05 §8.3; integration review E-1 fix] Formal designation used by
   * ledger/journal projections (invitation capability rows, active/history
   * entries, social-profile completed visits, journal active card). The
   * scene's occupant-click label composes from `title` (strip the "Shared "
   * prefix) — Nora's `title` is the short "Shared Reading" so that composition
   * reproduces the shipped historic "Share Reading with Nora" byte-exactly,
   * while every ledger/journal surface keeps the longer historic designation
   * "Shared Featured Reading". Absent = `title`.
   */
  ledgerTitle?: string;
}

export const SHARED_ACTIVITIES: Readonly<Record<string, SharedActivityDef>> = {
  share_featured_reading: {
    id: 'share_featured_reading',
    hostId: 'nora',
    // E-1 byte-identity: the occupant-click label composes "Share <title minus
    // 'Shared '> with <host>" — the short title makes that composition equal
    // the shipped historic "Share Reading with Nora". The longer formal
    // designation is preserved for ledger/journal surfaces via ledgerTitle
    // (pinned by the slice-2 battery LR3-D8 and the SF2/social-profile pins).
    title: 'Shared Reading',
    ledgerTitle: 'Shared Featured Reading',
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
    activityNoun: 'reading',
    // D5 byte-identity: the helper composes the enter toast from the def's
    // arrival line; Nora carries the historic nook sentence verbatim so the
    // enterNookAction refactor cannot shift a single character (LR2 suite).
    arrivalLine: (hostName) => `${hostName} looks up from the reading chair.`,
    summaryCompose: (world) => {
      const book = getFeaturedBookForDay(world.day);
      return {
        memorySummary: `Read through ${book.title} together with ${RESIDENTS.nora.name} inside Linden Book Nook — quiet pages, shared marginal notes, and easy company.`,
        eventSummary: `Shared ${book.title} with ${RESIDENTS.nora.name} at Linden Book Nook.`,
      };
    },
  },
  // LR-3 (doc 05 §6.1): Clara's morning pastry invitation at Hearth & Crumb.
  // Seat data is IMPORTED from the pinned seat spot (no re-typed literals),
  // the offer window resolves through computeOfferWindow (morning cap 719 by
  // the away-afternoon rule — Clara's afternoon slot sits 8.938 m out), and
  // NO knowledgeGranted is present: teaching is LR-4 (doc 14 §10; LR3-48).
  share_morning_pastry: {
    id: 'share_morning_pastry',
    hostId: 'clara',
    title: 'Shared Morning Pastry',
    location: 'bakery_interior',
    stationId: BAKERY_SEAT_SPOTS[0].id,
    seatPos: { ...BAKERY_SEAT_SPOTS[0].seatPos },
    seatFacing: BAKERY_SEAT_SPOTS[0].facingAngle,
    minTier: 'friendly',
    minAffinity: 45,
    defaultDurationMinutes: 180,
    minutesSpent: 15,
    affinityDelta: 6,
    reliabilityDelta: 2,
    memoryId: 'mem_lr_clara_morning_pastry',
    memoryTitle: 'First Crackles at the Café Corner',
    npcMemoryTag: 'shared_morning_pastry',
    activityNoun: 'pastry',
    offerPhases: ['morning'],
    // [LR-3 integration remediation, B-03] A "morning pastry" requires a bake:
    // on oven-rest days the roster has nothing to share, so Clara does not
    // offer (pinned by the lr3-restday-gate battery REST-01…08).
    requiresShareableBake: true,
    arrivalLine: (hostName) =>
      `${hostName} has set today’s bake on the café corner and saved you the seat across from her.`,
    summaryCompose: (world) => ({
      memorySummary: `Split ${getBakeForDay(world.day).label.toLowerCase()} with ${RESIDENTS.clara.name} at the café corner of Hearth & Crumb — first crackles, two cups, and a slow morning kept going.`,
      eventSummary: `Shared the morning pastry with ${RESIDENTS.clara.name} at Hearth & Crumb.`,
    }),
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
      toast: `${RESIDENTS[def.hostId].name} had to step out — the shared ${def.activityNoun ?? 'reading'} can't finish right now.`,
    };
  }

  // Idempotency guard (LR2-07 & LR2-07b): pre-seeded or already-unlocked memory blocks writes.
  if (world.memories.some((m) => m.id === def.memoryId)) {
    return { ok: false, world, reason: 'already_completed' };
  }

  const featuredBook = getFeaturedBookForDay(world.day);
  const phase = getTimePhase(world.minuteOfDay);

  // D9/F1 (doc 05 §6.2): venue-aware completion text. The def composition wins
  // when present (Clara, grounded in the day's bake roster); the historic nook
  // composition is the fallback so Nora's visible strings stay byte-identical.
  const composed = def.summaryCompose
    ? def.summaryCompose(world)
    : {
        memorySummary: `Read through ${featuredBook.title} together with ${RESIDENTS[def.hostId].name} inside Linden Book Nook — quiet pages, shared marginal notes, and easy company.`,
        eventSummary: `Shared ${featuredBook.title} with ${RESIDENTS[def.hostId].name} at Linden Book Nook.`,
      };

  const memoryRecord: JournalMemory = {
    id: def.memoryId,
    day: world.day,
    phase,
    title: def.memoryTitle,
    summary: composed.memorySummary,
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
    summary: composed.eventSummary,
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
