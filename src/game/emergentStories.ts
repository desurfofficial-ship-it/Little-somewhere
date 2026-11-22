import {
  ResidentId,
  WorldState,
} from './types';
import {
  getEmotionLabel,
  getNpcRelation,
  getNpcRelationTier,
  getRelationshipTier,
  TIER_RANK,
} from './relationships';
import { RESIDENTS, RESIDENT_ORDER } from './residents';
import { isInvitationLive } from './invitations';
import {
  deriveSharedHistory,
  getEffectivePlayerAffinity,
  getSuppressedNpcPairs,
  isMemoryPlayerKnown,
} from './socialProfile';
import { isMemoryExpired } from './memories';

/**
 * Emergent Stories Layer (Living Relationships — Social Foundation, SF-3).
 *
 * Derives personal story seeds from the INTERCONNECTION of the systems that
 * already exist — memories, NPC-to-NPC bonds, shared experiences, social
 * friction, player decisions and community life — instead of relying
 * exclusively on scripted quests. Nothing here writes state, spawns quests,
 * starts timers or applies pressure: every seed is a quiet, truthful
 * observation of what already happened, in the spirit of the design
 * constitution ("a little world filled with thousands of little stories";
 * zero-FOMO, currency-free, no obligation mechanics).
 *
 * Binding rules:
 *  - Zero schema: pure derivation over WorldState v11 (derive-only doctrine,
 *    same as journal.ts / progressionVisuals.ts).
 *  - Knowledge boundary: a seed may only use facts the PLAYER knows — NPC
 *    private memories pass through `isMemoryPlayerKnown`; NPC-to-NPC social
 *    events (`npc_social` world records, private by journal contract) are
 *    never quoted; pair-level facts are surfaced only when the player has
 *    player-visible evidence of the tie.
 *  - Deterministic: same WorldState, same seeds, same order. No RNG, no
 *    wall clock.
 *  - Graceful degradation: every seed degrades silently when its inputs are
 *    evicted (capped ledgers, memory TTLs) — a seed can never dangle.
 *
 * Pure TypeScript — zero DOM, React, or Three.js dependencies.
 */

export type EmergentStoryKind =
  | 'open_visit'
  | 'rift_bridging'
  | 'shared_tradition'
  | 'quiet_feeling'
  | 'thank_you_owed'
  | 'first_steps'
  | 'community_pulse';

export interface EmergentStorySeed {
  /** Stable id — safe for UI keys and read-markers. */
  id: string;
  kind: EmergentStoryKind;
  title: string;
  summary: string;
  residentIds: ResidentId[];
  /** Higher = surfaced first. Bands are wide; only order matters. */
  priority: number;
  /** How much evidence stands behind the seed (bounded, informational). */
  evidenceCount: number;
}

export const MAX_SEEDS = 6;

/** Minimum player tier with BOTH sides before a bridging seed may appear. */
const BRIDGING_MIN_TIER_RANK = TIER_RANK['friendly'];

// ---------------------------------------------------------------------------
// Knowledge gates
// ---------------------------------------------------------------------------

/**
 * Player-visible evidence that the player knows a tie between two residents:
 * the bell mystery discovery, or a player-known NPC memory naming both.
 * (`heardBellMystery` is the canonical journal gate for the Clara–Arthur
 * connection; a known memory mentioning both covers future pairs.)
 */
function playerKnowsTie(
  world: WorldState,
  a: ResidentId,
  b: ResidentId,
): boolean {
  if (world.flags.heardBellMystery) return true;
  for (const id of [a, b]) {
    const mems = world.npcMemories?.[id] ?? [];
    for (const mem of mems) {
      if (isMemoryExpired(mem, world.day)) continue;
      if (!isMemoryPlayerKnown(mem)) continue;
      const subjects = mem.subjectResidents ?? [];
      if (subjects.includes(a) && subjects.includes(b)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Seed derivation
// ---------------------------------------------------------------------------

/**
 * Derives the current emergent story seeds for the whole lane, capped to the
 * most significant `MAX_SEEDS` by priority (ties broken by id for stability).
 */
export function deriveEmergentStorySeeds(world: WorldState): EmergentStorySeed[] {
  const seeds: EmergentStorySeed[] = [];

  seeds.push(...deriveOpenVisitSeeds(world));
  seeds.push(...deriveRiftBridgingSeeds(world));
  seeds.push(...deriveSharedTraditionSeeds(world));
  seeds.push(...deriveQuietFeelingSeeds(world));
  seeds.push(...deriveThankYouOwedSeeds(world));
  seeds.push(...deriveFirstStepsSeeds(world));
  seeds.push(...deriveCommunityPulseSeeds(world));

  return seeds
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .slice(0, MAX_SEEDS);
}

/** An accepted, still-live visit waiting to happen — a gentle, zero-FOMO note. */
function deriveOpenVisitSeeds(world: WorldState): EmergentStorySeed[] {
  const active = world.invitations?.active ?? null;
  if (!active || active.status !== 'accepted') return [];
  if (!isInvitationLive(active, world.day, world.minuteOfDay)) return [];
  if (world.playerLocation !== 'exterior') return [];

  const host = active.hostId;
  const hostDef = RESIDENTS[host];
  if (!hostDef) return []; // corrupted/hand-edited save: degrade silently

  return [
    {
      id: `seed_open_visit_${host}`,
      kind: 'open_visit',
      title: `Your visit with ${hostDef.name} is still open`,
      summary: `The door of ${hostDef.homeName} stays warm while the window lasts — no rush, though.`,
      residentIds: [host],
      priority: 80,
      evidenceCount: 1,
    },
  ];
}

/**
 * The bridging seed: a suppressed NPC pair whose BOTH sides are friendly with
 * the player, and whose tie the player actually knows about. The quintessential
 * emergent story of a cozy lane — the player is the one person positioned to
 * let a kind word travel.
 */
function deriveRiftBridgingSeeds(world: WorldState): EmergentStorySeed[] {
  const out: EmergentStorySeed[] = [];
  for (const pair of getSuppressedNpcPairs(world)) {
    const tierA = TIER_RANK[getRelationshipTier(getEffectivePlayerAffinity(world, pair.a))];
    const tierB = TIER_RANK[getRelationshipTier(getEffectivePlayerAffinity(world, pair.b))];
    if (tierA < BRIDGING_MIN_TIER_RANK || tierB < BRIDGING_MIN_TIER_RANK) continue;
    if (!playerKnowsTie(world, pair.a, pair.b)) continue;

    out.push({
      id: `seed_rift_bridging_${pair.pairKey.replace(':', '_')}`,
      kind: 'rift_bridging',
      title: `You know both sides of the quiet rift`,
      summary: `${RESIDENTS[pair.a].name} and ${RESIDENTS[pair.b].name} haven't truly spoken in a while — and you're on warm terms with each of them. A kind word could travel between them someday.`,
      residentIds: [pair.a, pair.b],
      priority: 70,
      evidenceCount: 2,
    });
  }
  return out;
}

/** Repeated shared visits with one host — a tradition quietly forming. */
function deriveSharedTraditionSeeds(world: WorldState): EmergentStorySeed[] {
  const out: EmergentStorySeed[] = [];
  for (const id of RESIDENT_ORDER) {
    const history = deriveSharedHistory(world, id);
    if (history.completedVisits.length < 2) continue;
    const last = history.completedVisits[history.completedVisits.length - 1];
    out.push({
      id: `seed_shared_tradition_${id}`,
      kind: 'shared_tradition',
      title: `A little tradition with ${RESIDENTS[id].name}`,
      summary: `You and ${RESIDENTS[id].name} have shared ${history.completedVisits.length} visits now — the latest, “${last.activityTitle}”, on day ${last.day}. Some company becomes a habit in the best way.`,
      residentIds: [id],
      priority: 60,
      evidenceCount: history.completedVisits.length,
    });
  }
  return out;
}

/**
 * Observable feeling — one seed for the most significant resident whose
 * current feeling (the same chain the dialogue engine and journal read) is
 * wistful or low, among residents the player actually knows. Player-observable
 * only: mood/feeling is exactly what a face-to-face greeting shows.
 */
function deriveQuietFeelingSeeds(world: WorldState): EmergentStorySeed[] {
  let best: { id: ResidentId; affinity: number; label: string } | null = null;
  for (const id of RESIDENT_ORDER) {
    if (!world.residents[id]?.met) continue;
    const affinity = getEffectivePlayerAffinity(world, id);
    if (TIER_RANK[getRelationshipTier(affinity)] < TIER_RANK['acquaintance']) continue;
    const rel = world.playerRelations?.[id];
    const feeling = world.npcRuntime?.[id]?.emotion ?? rel?.lastEmotion ?? undefined;
    const mood = world.residents[id].mood;
    const lowFeeling = feeling === 'sad' || feeling === 'frustrated' || mood === 'wistful';
    if (!lowFeeling) continue;
    if (!best || affinity > best.affinity) {
      best = { id, affinity, label: getEmotionLabel(feeling ?? 'sad') };
    }
  }
  if (!best) return [];
  return [
    {
      id: `seed_quiet_feeling_${best.id}`,
      kind: 'quiet_feeling',
      title: `${RESIDENTS[best.id].name} has seemed ${best.label.toLowerCase()} lately`,
      summary: `Perhaps a gentle check-in by the lane would land well — no errand, just company.`,
      residentIds: [best.id],
      priority: 50,
      evidenceCount: 1,
    },
  ];
}

/** A keepsake received but never yet acknowledged in kind. */
function deriveThankYouOwedSeeds(world: WorldState): EmergentStorySeed[] {
  for (const id of RESIDENT_ORDER) {
    if (!(world.neighborGiftsReceived ?? []).includes(id)) continue;
    if ((world.playerRelations?.[id]?.giftsGiven ?? 0) > 0) continue;
    const affinity = getEffectivePlayerAffinity(world, id);
    if (TIER_RANK[getRelationshipTier(affinity)] < TIER_RANK['acquaintance']) continue;
    return [
      {
        id: `seed_thank_you_owed_${id}`,
        kind: 'thank_you_owed',
        title: `${RESIDENTS[id].name}'s keepsake deserves a kind word`,
        summary: `They once left you something handmade. A small thank-you — a chat, a story, a gift of your own — would close that little circle.`,
        residentIds: [id],
        priority: 40,
        evidenceCount: 1,
      },
    ];
  }
  return [];
}

/** A met-but-barely-known resident — the beginning of a story, not a task. */
function deriveFirstStepsSeeds(world: WorldState): EmergentStorySeed[] {
  for (const id of RESIDENT_ORDER) {
    if (!world.residents[id]?.met) continue;
    const rel = world.playerRelations?.[id];
    if ((rel?.talkedCount ?? 0) >= 3) continue;
    return [
      {
        id: `seed_first_steps_${id}`,
        kind: 'first_steps',
        title: `You're still getting to know ${RESIDENTS[id].name}`,
        summary: `A few more conversations and ${RESIDENTS[id].name} might stop being a face on the lane and start being a friend.`,
        residentIds: [id],
        priority: 30,
        evidenceCount: rel?.talkedCount ?? 0,
      },
    ];
  }
  return [];
}

/**
 * Community pulse — the sum of quiet shared doings across the lane
 * (books read together, harvests, bench projects, remembered moments).
 * Derived, never persisted; crosses its threshold only through play.
 */
function deriveCommunityPulseSeeds(world: WorldState): EmergentStorySeed[] {
  const booksRead = world.nookState?.booksRead ?? 0;
  const harvests = world.greenhouseState?.totalHarvests ?? 0;
  const projects = world.copperwheelState?.projectsAdmired ?? 0;
  const loavesShared = world.bakeryState?.loavesShared ?? 0;
  const remembered = world.memories?.length ?? 0;
  const pulse = booksRead + harvests + projects + loavesShared + remembered;
  if (pulse < 8) return [];
  return [
    {
      id: 'seed_community_pulse',
      kind: 'community_pulse',
      title: 'The lane hums with shared doings',
      summary: `Books read, plots tended, benches admired, loaves shared, moments remembered — Willow Square is quietly becoming a place of small traditions.`,
      residentIds: [],
      priority: 20,
      evidenceCount: pulse,
    },
  ];
}

// ---------------------------------------------------------------------------
// Resident chapter — the People-card line
// ---------------------------------------------------------------------------

/**
 * One lived-experience line for a resident's Pocket Journal People card, or
 * `undefined` when nothing has been lived worth recording yet. Deterministic;
 * degrades to `undefined` whenever the underlying evidence is gone.
 *
 * Composition order (most story first): bridging awareness → shared
 * tradition → unacknowledged keepsake → observable feeling → early
 * acquaintance. A card shows at most one chapter line — the People card is a
 * whisper, not a log.
 */
export function deriveResidentChapter(
  world: WorldState,
  residentId: ResidentId,
): string | undefined {
  if (!world.residents[residentId]?.met) return undefined;
  const name = RESIDENTS[residentId].name;

  // Bridging awareness: this resident is one suppressed side the player knows.
  for (const pair of getSuppressedNpcPairs(world)) {
    const other = pair.a === residentId ? pair.b : pair.b === residentId ? pair.a : null;
    if (!other) continue;
    const myTier = TIER_RANK[getRelationshipTier(getEffectivePlayerAffinity(world, residentId))];
    const otherTier = TIER_RANK[getRelationshipTier(getEffectivePlayerAffinity(world, other))];
    if (myTier < BRIDGING_MIN_TIER_RANK || otherTier < BRIDGING_MIN_TIER_RANK) continue;
    if (!playerKnowsTie(world, pair.a, pair.b)) continue;
    return `You're on warm terms with both sides of the quiet rift between ${RESIDENTS[pair.a].name} and ${RESIDENTS[pair.b].name}.`;
  }

  const history = deriveSharedHistory(world, residentId);
  if (history.completedVisits.length >= 2) {
    const last = history.completedVisits[history.completedVisits.length - 1];
    return `You and ${name} have shared ${history.completedVisits.length} quiet visits — the latest, “${last.activityTitle}”, on day ${last.day}.`;
  }

  if (
    history.hasLeftKeepsake &&
    (world.playerRelations?.[residentId]?.giftsGiven ?? 0) === 0 &&
    TIER_RANK[getRelationshipTier(getEffectivePlayerAffinity(world, residentId))] >=
      TIER_RANK['acquaintance']
  ) {
    return `${name} once left you a keepsake — a kind word is still owed.`;
  }

  const rel = world.playerRelations?.[residentId];
  const feeling = world.npcRuntime?.[residentId]?.emotion ?? rel?.lastEmotion ?? undefined;
  const lowFeeling =
    feeling === 'sad' ||
    feeling === 'frustrated' ||
    world.residents[residentId].mood === 'wistful';
  if (
    lowFeeling &&
    TIER_RANK[getRelationshipTier(getEffectivePlayerAffinity(world, residentId))] >=
      TIER_RANK['acquaintance']
  ) {
    const label = getEmotionLabel(feeling ?? 'sad').toLowerCase();
    return `${name} has seemed ${label} lately; a gentle check-in might land well.`;
  }

  if ((rel?.talkedCount ?? 0) < 3) {
    return `A face becoming a name — a few more conversations and ${name} won't be a stranger.`;
  }

  return undefined;
}
