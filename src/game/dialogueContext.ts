import {
  CharacterEmotion,
  DialogueCategory,
  DialogueTopic,
  ResidentId,
  TimePhase,
  WorldState,
} from './types';
import {
  getEmotionLabel,
  getRelationshipTier,
  getRelationshipTierLabel,
  isResidentGuarded,
  TIER_RANK,
} from './relationships';
import { RESIDENTS } from './residents';
import { getTopicHistoryEntry } from './dialogueEngine';
import { isMemoryExpired } from './memories';
import { isInvitationLive } from './invitations';
import {
  getEffectivePlayerAffinity,
  getFamiliarityBand,
  isMemoryPlayerKnown,
  resolveCurrentFeeling,
} from './socialProfile';

/**
 * Dialogue Context Assembly (Living Relationships — Social Foundation, SF-4).
 *
 * A pure ADDITIVE layer between the conversation opener (`buildResidentDialogue`)
 * and the selection engine (`selectDialogueSession`). It does not replace,
 * filter, or re-derive any engine semantics — condition gating, category
 * priorities, history penalties and rotation stay 100% owned by
 * `dialogueEngine.ts` ("no second selector" rule). What it adds:
 *
 *   1. `buildDialogueContext` — one deterministic snapshot of everything a
 *      conversation should account for: relationship standing, guardedness,
 *      recency, pending plans, recent shared experiences, today's social
 *      company, and the speaker's own player-knowledge. QA/debug surface:
 *      it is NOT a player-facing projection — anything surfaced to the
 *      player must additionally pass its own knowledge gate (see SF-3).
 *   2. `computeContextBoosts` — small additive score boosts (≤ 5) that let
 *      relationship/memory context break ties WITHIN a category priority
 *      band. The minimum gap between boost-eligible adjacent bands is 6
 *      (the engine ALSO clamps to ±5 as an invariant), so a clamped boost
 *      can reorder inside
 *      a band but can never smuggle a topic across bands — cross-category
 *      semantics remain the engine's alone.
 *   3. `describeDialogueContext` — a human-legible one-liner for
 *      debugging/QA.
 *
 * Conversations thereby account for: player relationships (tier, guardedness,
 * familiarity), recent interactions (talk recency), memories (unmentioned
 * shared experiences get their echo first), time (phase via the caller),
 * current activities/plans (pending visits), and speaker knowledge (never
 * omniscient — boosts only ever reference the speaker's own memories).
 *
 * Determinism: pure function of `(world, phase, residentId, topics)` — no
 * RNG, no wall clock (BD10-09 determinism pin). Boost-free parity is pinned
 * by test: passing `undefined` yields byte-identical legacy selection.
 *
 * Pure TypeScript — zero DOM, React, or Three.js dependencies.
 */

/** Hard clamp — must stay below the minimum gap between boost-eligible
 *  adjacent category bands (6; the two protected bands above it sit 2 apart
 *  but are never boosted — see dialogueEngine CATEGORY_PRIORITY). */
export const MAX_CONTEXT_BOOST = 5;

/** Reunion warmth boost for tier-band topics after a quiet spell. */
export const REUNION_BOOST = 3;
/** Days without a talk before the reunion warmth applies. */
export const REUNION_AFTER_DAYS = 3;
/** Window (days) in which an unmentioned shared experience may echo. */
export const SHARED_ECHO_WINDOW_DAYS = 6;

/**
 * Categories whose topics are never context-boosted: story milestones,
 * invitation flow, reconciliation arcs and personal stories have authored
 * priorities and must win exactly as designed.
 */
const PROTECTED_CATEGORIES: ReadonlySet<DialogueCategory> = new Set([
  'quest_milestone',
  'invitation',
  'conflict_reconciliation',
  'personal_story',
]);

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

export interface DialogueContextSnapshot {
  residentId: ResidentId;
  residentName: string;
  phase: TimePhase;
  met: boolean;
  affinity: number;
  tier: ReturnType<typeof getRelationshipTier>;
  tierLabel: string;
  guarded: boolean;
  familiarityBand: ReturnType<typeof getFamiliarityBand>;
  feeling: CharacterEmotion;
  feelingLabel: string;
  lastTalkDay: number | null;
  daysSinceLastTalk: number | null;
  /** An accepted, live visit with this host is pending right now. */
  pendingLiveVisit: boolean;
  /** Days since the last completed shared visit with this host (null = never). */
  daysSinceSharedVisit: number | null;
  /** Unmentioned shared-experience tags the speaker still holds (bounded). */
  unmentionedSharedTags: string[];
  /** Residents this NPC socially met today (player-visible only as a fact count). */
  companionsToday: ResidentId[];
  /** The player's own open friction with this resident. */
  openFriction: boolean;
  /** How much player-known knowledge the speaker carries. */
  knownMemoryCount: number;
}

const SHARED_TAG_PREFIX = 'shared_';

function collectUnmentionedSharedTags(world: WorldState, residentId: ResidentId): string[] {
  const mems = world.npcMemories?.[residentId] ?? [];
  const tags = new Set<string>();
  for (const mem of mems) {
    if (isMemoryExpired(mem, world.day)) continue;
    if (mem.mentionedToPlayer) continue;
    if (!mem.tag.startsWith(SHARED_TAG_PREFIX)) continue;
    if (world.day - mem.createdDay > SHARED_ECHO_WINDOW_DAYS) continue;
    tags.add(mem.tag);
  }
  return [...tags].sort();
}

function collectCompanionsToday(world: WorldState, residentId: ResidentId): ResidentId[] {
  const companions = new Set<ResidentId>();
  for (const ev of world.worldEvents ?? []) {
    if (ev.day !== world.day) continue;
    if (ev.kind !== 'npc_social') continue;
    if (!ev.actors.includes(residentId)) continue;
    for (const actor of ev.actors) {
      if (actor !== residentId) companions.add(actor);
    }
  }
  return [...companions].sort();
}

export function buildDialogueContext(
  world: WorldState,
  residentId: ResidentId,
  phase: TimePhase,
): DialogueContextSnapshot {
  const def = RESIDENTS[residentId];
  const rel = world.playerRelations?.[residentId];
  const affinity = getEffectivePlayerAffinity(world, residentId);
  const tier = getRelationshipTier(affinity);
  const feeling = resolveCurrentFeeling(world, residentId);

  const active = world.invitations?.active ?? null;
  // Strict-predicate reuse (D-03 duality): the pending-visit check IS
  // isInvitationLive — never a re-implementation that can drift from the
  // tick/save/load predicate. Scoped to THIS resident as host.
  const pendingLiveVisit =
    !!active &&
    active.status === 'accepted' &&
    active.hostId === residentId &&
    isInvitationLive(active, world.day, world.minuteOfDay);

  const history = world.invitations?.history ?? [];
  const lastVisitDay = history
    .filter((e) => e.hostId === residentId && e.outcome === 'completed')
    .reduce((max, e) => (e.day > max ? e.day : max), 0);

  const knownMems = (world.npcMemories?.[residentId] ?? []).filter(
    (m) => !isMemoryExpired(m, world.day) && isMemoryPlayerKnown(m),
  );

  return {
    residentId,
    residentName: def.name,
    phase,
    met: world.residents[residentId]?.met ?? false,
    affinity,
    tier,
    tierLabel: getRelationshipTierLabel(tier),
    guarded: isResidentGuarded(rel, feeling),
    familiarityBand: getFamiliarityBand(rel?.familiarity ?? 0),
    feeling,
    feelingLabel: getEmotionLabel(feeling),
    lastTalkDay: rel?.lastTalkDay ?? null,
    daysSinceLastTalk:
      typeof rel?.lastTalkDay === 'number' ? world.day - rel.lastTalkDay : null,
    pendingLiveVisit,
    daysSinceSharedVisit: lastVisitDay > 0 ? world.day - lastVisitDay : null,
    unmentionedSharedTags: collectUnmentionedSharedTags(world, residentId),
    companionsToday: collectCompanionsToday(world, residentId),
    openFriction:
      (rel?.negativeCount ?? 0) > 0 && (rel?.reliability ?? 25) < 40,
    knownMemoryCount: knownMems.length,
  };
}

// ---------------------------------------------------------------------------
// Boosts
// ---------------------------------------------------------------------------

function topicRequiresTagOverlap(
  topic: DialogueTopic,
  tags: readonly string[],
): boolean {
  if (tags.length === 0) return false;
  const req = topic.condition?.requiresNpcMemory?.tags;
  if (!req) return false;
  return req.some((t) => tags.includes(t));
}

/**
 * Computes the context boosts for one conversation opener. Rules (each
 * deterministic, each evidence-bound to the speaker's own knowledge):
 *
 *   R1 shared-experience echo — the speaker holds an unmentioned memory of a
 *      recent shared visit and the topic's condition targets exactly that
 *      tag → the memory-callback reflection outranks same-band peers.
 *   R2 reunion warmth — after REUNION_AFTER_DAYS quiet days, tier-band
 *      reconnection topics rise within their band.
 *
 * Everything else boosts 0. Protected categories are never boosted, and the
 * total is clamped to [0, MAX_CONTEXT_BOOST] so band boundaries hold.
 */
export function computeContextBoosts(
  world: WorldState,
  residentId: ResidentId,
  phase: TimePhase,
  topics: readonly DialogueTopic[],
): Record<string, number> {
  const ctx = buildDialogueContext(world, residentId, phase);
  const boosts: Record<string, number> = {};

  if (!ctx.met) {
    return boosts;
  }

  for (const topic of topics) {
    if (topic.residentId !== 'any' && topic.residentId !== residentId) continue;
    if (PROTECTED_CATEGORIES.has(topic.category)) continue;

    let boost = 0;

    if (topicRequiresTagOverlap(topic, ctx.unmentionedSharedTags)) {
      boost = Math.max(boost, MAX_CONTEXT_BOOST);
    }

    if (
      ctx.daysSinceLastTalk !== null &&
      ctx.daysSinceLastTalk >= REUNION_AFTER_DAYS &&
      topic.category === 'relationship_tier'
    ) {
      boost = Math.max(boost, REUNION_BOOST);
    }

    if (boost > 0) {
      boosts[topic.id] = Math.max(0, Math.min(MAX_CONTEXT_BOOST, boost));
    }
  }

  return boosts;
}

// ---------------------------------------------------------------------------
// Debug description
// ---------------------------------------------------------------------------

/** One human-legible line summarizing the conversation context (QA tool). */
export function describeDialogueContext(ctx: DialogueContextSnapshot): string {
  const bits: string[] = [];
  bits.push(`${ctx.residentName} (${ctx.tierLabel}, ${ctx.familiarityBand.replace('_', ' ')})`);
  if (ctx.guarded) bits.push('guarded');
  bits.push(`seems ${ctx.feelingLabel.toLowerCase()}`);
  if (ctx.daysSinceLastTalk !== null) {
    bits.push(
      ctx.daysSinceLastTalk === 0
        ? 'talked today'
        : `last talked ${ctx.daysSinceLastTalk}d ago`,
    );
  }
  if (ctx.pendingLiveVisit) bits.push('visit pending');
  if (ctx.daysSinceSharedVisit !== null) {
    bits.push(`last shared visit ${ctx.daysSinceSharedVisit}d ago`);
  }
  if (ctx.unmentionedSharedTags.length > 0) {
    bits.push(`${ctx.unmentionedSharedTags.length} unmentioned shared memory`);
  }
  if (ctx.companionsToday.length > 0) {
    bits.push(`chatted today with ${ctx.companionsToday.map((id) => RESIDENTS[id].name).join(', ')}`);
  }
  if (ctx.openFriction) bits.push('open friction');
  return bits.join(' · ');
}

/** Tier-rank helper re-exported for tests of band semantics. */
export function tierRank(tier: ReturnType<typeof getRelationshipTier>): number {
  return TIER_RANK[tier];
}
