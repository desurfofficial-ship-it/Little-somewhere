import {
  CharacterEmotion,
  InvitationHistoryEntry,
  JournalMemory,
  NpcMemoryEntry,
  NpcRelationTier,
  PlayerNpcRelation,
  RelationshipTier,
  ResidentId,
  TimePhase,
  WorldState,
} from './types';
import {
  getEmotionLabel,
  getHeartLevel,
  getNpcRelation,
  getNpcRelationTier,
  getNpcRelationTierLabel,
  getRelationshipTier,
  getRelationshipTierLabel,
  isResidentGuarded,
  moodToEmotion,
  shouldSuppressNpcSocial,
  TIER_RANK,
} from './relationships';
import { RESIDENTS, RESIDENT_ORDER } from './residents';
import { SHARED_ACTIVITIES } from './activities';
import { isMemoryExpired } from './memories';

/**
 * Social Profile Layer (Living Relationships — Social Foundation, SF-1).
 *
 * A pure, additive DERIVATION layer over the persisted relationship state.
 * It owns no WorldState field and no reducers — everything here is computed
 * from `WorldState` on demand, following the same derive-only doctrine as
 * `progressionVisuals.ts` and `journal.ts` ("never persist a derived flag").
 *
 * Purpose: the relationship dimensions — familiarity, trust/friendship depth,
 * reliability, current feeling, shared history and the NPC social web — are
 * NOT one number. `PlayerNpcRelation.affinity` remains the single
 * authoritative scalar that existing writers maintain; this layer derives the
 * multi-dimensional view and the evidence behind it so dialogue, journal,
 * story and UI systems can reason about relationships without re-deriving
 * (or silently re-reducing) them.
 *
 * Knowledge-boundary rule: every derived fact that originates in an NPC's
 * private memory is filtered through `isMemoryPlayerKnown`, mirroring
 * `journal.isNpcMemoryKnownToPlayer` exactly (lockstep-pinned by
 * `socialProfile.test.ts`). Never widen it.
 *
 * Pure TypeScript — zero DOM, React, or Three.js dependencies.
 */

// ---------------------------------------------------------------------------
// Canonical accessors
// ---------------------------------------------------------------------------

/**
 * The one canonical read of a resident's player-affinity.
 *
 * Five historical call sites duplicated `rel?.affinity ?? prog.trust * 20`
 * (dialogueEngine, journal, invitations, activities). New systems must read
 * through this accessor; existing call sites are contract-pinned and stay
 * byte-identical. The fallback reconstructs the pre-LR seed value
 * (relationships.ts `createInitialPlayerRelations`), never invents one.
 */
export function getEffectivePlayerAffinity(
  world: WorldState,
  residentId: ResidentId,
): number {
  const rel = world.playerRelations?.[residentId];
  if (rel && typeof rel.affinity === 'number' && Number.isFinite(rel.affinity)) {
    return rel.affinity;
  }
  return (world.residents[residentId]?.trust ?? 0) * 20;
}

/**
 * Mirror of `journal.isNpcMemoryKnownToPlayer` (journal.ts, identical
 * predicate). Two copies exist because `journal.ts` consumes the emergent
 * layer downstream; this keeps the social layer import-cycle-free. The
 * lockstep test asserts both predicates agree on a full case matrix — if one
 * side changes without the other, that test fails loudly.
 */
export function isMemoryPlayerKnown(entry: NpcMemoryEntry): boolean {
  return (
    entry.mentionedToPlayer ||
    entry.sourceKind === 'player_told' ||
    (entry.sourceKind === 'participant' && entry.subjectPlayer)
  );
}

// ---------------------------------------------------------------------------
// Familiarity — the "how well do we actually know each other" dimension
// ---------------------------------------------------------------------------

export type FamiliarityBand =
  | 'unfamiliar'
  | 'passing'
  | 'recognized'
  | 'familiar'
  | 'well_known';

/**
 * Familiarity accumulates through lived contact (+1 negative / +2 plain talk /
 * +4 rewarded small talk / +6 gift / +8 story milestone, seeded 10 on `met`).
 * Unlike affinity it is unbounded and never decays — it answers "how long
 * have we known each other", not "how warm is it right now".
 */
export function getFamiliarityBand(familiarity: number): FamiliarityBand {
  if (familiarity < 10) return 'unfamiliar';
  if (familiarity < 40) return 'passing';
  if (familiarity < 90) return 'recognized';
  if (familiarity < 160) return 'familiar';
  return 'well_known';
}

export function getFamiliarityBandLabel(band: FamiliarityBand): string {
  switch (band) {
    case 'unfamiliar':
      return 'Barely met';
    case 'passing':
      return 'Passing acquaintance';
    case 'recognized':
      return 'Recognizable face';
    case 'familiar':
      return 'Familiar presence';
    case 'well_known':
      return 'Well known to each other';
  }
}

// ---------------------------------------------------------------------------
// Feeling — the consolidated "how do they seem right now" resolution
// ---------------------------------------------------------------------------

/**
 * The one canonical resolution of the mood/emotion field family
 * (`npcRuntime.emotion` → `rel.lastEmotion` → `moodToEmotion(prog.mood)`),
 * identical to the chains already used by the dialogue engine and journal.
 * Extracted so new systems stop re-implementing (and re-diverging) it.
 */
export function resolveCurrentFeeling(
  world: WorldState,
  residentId: ResidentId,
): CharacterEmotion {
  const rt = world.npcRuntime?.[residentId];
  if (rt?.emotion) return rt.emotion;
  const rel = world.playerRelations?.[residentId];
  if (rel?.lastEmotion) return rel.lastEmotion;
  return moodToEmotion(world.residents[residentId]?.mood ?? 'peaceful');
}

// ---------------------------------------------------------------------------
// Shared history — the evidence ledger of lived experiences
// ---------------------------------------------------------------------------

export interface SharedVisitFact {
  invitationId: string;
  activityId: string;
  activityTitle: string;
  day: number;
}

export interface SharedHistorySummary {
  /** Accepted invitations completed with this host (from the capped ledger). */
  completedVisits: SharedVisitFact[];
  declinedCount: number;
  expiredCount: number;
  lastCompletedVisitDay: number | null;
  /** Player journal memories attributed to this resident (newest first, cap 6). */
  playerMemories: Array<Pick<JournalMemory, 'id' | 'title' | 'day'>>;
  /** Player-visible `player_help` world events this resident took part in. */
  witnessedHelpEventCount: number;
  /** This resident has ever left the player a keepsake. */
  hasLeftKeepsake: boolean;
  /** Speaker-knowledge counts under the player knowledge boundary. */
  knownNpcMemoryCount: number;
  unmentionedKnownNpcMemoryCount: number;
}

const PLAYER_MEMORY_SAMPLE_CAP = 6;
const PLAYER_VISIBLE_HELP_KIND = 'player_help';

/**
 * Derives the shared-history ledger for one resident from the four bounded
 * ledgers that already exist (`invitations.history`, `world.memories`,
 * `world.worldEvents`, `world.npcMemories`) plus the keepsake record. No new
 * persistence: everything is already written by the canonical owners
 * (`invitations.ts` / `activities.ts` / `actions.ts`).
 */
export function deriveSharedHistory(
  world: WorldState,
  residentId: ResidentId,
): SharedHistorySummary {
  const history: InvitationHistoryEntry[] = world.invitations?.history ?? [];
  const withHost = history.filter((entry) => entry.hostId === residentId);

  const completedVisits = withHost
    .filter((entry) => entry.outcome === 'completed')
    .map((entry) => ({
      invitationId: entry.invitationId,
      activityId: entry.activityId,
      activityTitle: SHARED_ACTIVITIES[entry.activityId]?.title ?? entry.activityId,
      day: entry.day,
    }));

  const playerMemories = (world.memories ?? [])
    .filter((m) => m.residentId === residentId)
    .slice(0, PLAYER_MEMORY_SAMPLE_CAP)
    .map((m) => ({ id: m.id, title: m.title, day: m.day }));

  const witnessedHelpEventCount = (world.worldEvents ?? []).filter(
    (e) => e.kind === PLAYER_VISIBLE_HELP_KIND && e.actors.includes(residentId),
  ).length;

  const npcMems = world.npcMemories?.[residentId] ?? [];
  let knownNpcMemoryCount = 0;
  let unmentionedKnownNpcMemoryCount = 0;
  for (const mem of npcMems) {
    if (isMemoryExpired(mem, world.day)) continue;
    if (!isMemoryPlayerKnown(mem)) continue;
    knownNpcMemoryCount += 1;
    if (!mem.mentionedToPlayer) unmentionedKnownNpcMemoryCount += 1;
  }

  return {
    completedVisits,
    declinedCount: withHost.filter((e) => e.outcome === 'declined').length,
    expiredCount: withHost.filter((e) => e.outcome === 'expired').length,
    lastCompletedVisitDay:
      completedVisits.length > 0
        ? Math.max(...completedVisits.map((v) => v.day))
        : null,
    playerMemories,
    witnessedHelpEventCount,
    hasLeftKeepsake: (world.neighborGiftsReceived ?? []).includes(residentId),
    knownNpcMemoryCount,
    unmentionedKnownNpcMemoryCount,
  };
}

// ---------------------------------------------------------------------------
// NPC-to-NPC bond queries — the visible social web
// ---------------------------------------------------------------------------

export interface NpcBondSummary {
  otherId: ResidentId;
  otherName: string;
  tier: NpcRelationTier;
  tierLabel: string;
  affinity: number;
  tension: number;
  sharedTags: string[];
  /** True when tension/estrangement suppresses autonomous socializing. */
  suppressed: boolean;
}

const NOTABLE_BOND_TIERS: ReadonlySet<NpcRelationTier> = new Set([
  'confidant',
  'warm',
  'guarded',
  'estranged',
]);

/**
 * The socially *legible* bonds of one resident: confidant/warm friendships and
 * guarded/estranged rifts. Plain 'acquainted' pairs are omitted — they are the
 * neutral background, not story material. Sorted deterministically
 * (affinity desc, then resident id) so UI/story layers are stable.
 */
export function getNotableNpcBonds(
  world: WorldState,
  residentId: ResidentId,
): NpcBondSummary[] {
  const relations = world.npcRelations ?? {};
  const out: NpcBondSummary[] = [];
  for (const other of RESIDENT_ORDER) {
    if (other === residentId) continue;
    const relation = getNpcRelation(relations, residentId, other);
    const tier = getNpcRelationTier(relation);
    if (!NOTABLE_BOND_TIERS.has(tier)) continue;
    out.push({
      otherId: other,
      otherName: RESIDENTS[other].name,
      tier,
      tierLabel: getNpcRelationTierLabel(tier),
      affinity: relation.affinity,
      tension: relation.tension,
      sharedTags: [...relation.sharedTags],
      suppressed: shouldSuppressNpcSocial(relation),
    });
  }
  out.sort((a, b) => {
    if (b.affinity !== a.affinity) return b.affinity - a.affinity;
    return a.otherId < b.otherId ? -1 : a.otherId > b.otherId ? 1 : 0;
  });
  return out;
}

/**
 * Every resident pair whose bond is currently suppressed (affinity < 0 or
 * tension ≥ 45 — `shouldSuppressNpcSocial`). This is the "stuck social
 * energy" of the lane: the raw material of emergent bridging stories.
 * Canonical-keyed, deduped, sorted by pair key.
 */
export function getSuppressedNpcPairs(world: WorldState): Array<{
  pairKey: string;
  a: ResidentId;
  b: ResidentId;
  affinity: number;
  tension: number;
}> {
  const relations = world.npcRelations ?? {};
  const out: Array<{ pairKey: string; a: ResidentId; b: ResidentId; affinity: number; tension: number }> = [];
  for (const key of Object.keys(relations).sort()) {
    const relation = relations[key];
    if (!relation || !shouldSuppressNpcSocial(relation)) continue;
    const [a, b] = key.split(':') as [ResidentId, ResidentId];
    if (!RESIDENTS[a] || !RESIDENTS[b] || a === b) continue;
    out.push({ pairKey: key, a, b, affinity: relation.affinity, tension: relation.tension });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Unlock semantics — the two contract-true readings, named once
// ---------------------------------------------------------------------------

export interface RelationshipUnlockRequirement {
  minTier?: RelationshipTier;
  minAffinity?: number;
}

/**
 * The invitation-contract reading (invitations.ts `canOfferInvitation`):
 * the gate opens when the tier OR the affinity floor is satisfied.
 * Kept as an exported, documented predicate so UI/dialogue can explain
 * standing without re-deriving (and possibly diverging from) the chassis.
 */
export function meetsRelationshipUnlock(
  affinity: number,
  req: RelationshipUnlockRequirement,
): boolean {
  const tier = getRelationshipTier(affinity);
  const tierOk = req.minTier === undefined || TIER_RANK[tier] >= TIER_RANK[req.minTier];
  const affinityOk = req.minAffinity === undefined || affinity >= req.minAffinity;
  return tierOk || affinityOk;
}

/**
 * The dialogue-contract reading (`minTier`/`minAffinity` are independent AND
 * gates in `evaluateDialogueCondition`). Exported for the same reason.
 */
export function meetsStrictRelationshipUnlock(
  affinity: number,
  req: RelationshipUnlockRequirement,
): boolean {
  const tier = getRelationshipTier(affinity);
  const tierOk = req.minTier === undefined || TIER_RANK[tier] >= TIER_RANK[req.minTier];
  const affinityOk = req.minAffinity === undefined || affinity >= req.minAffinity;
  return tierOk && affinityOk;
}

// ---------------------------------------------------------------------------
// Composite profile
// ---------------------------------------------------------------------------

export interface RelationshipProfile {
  residentId: ResidentId;
  name: string;
  met: boolean;
  /** Authoritative scalar (never re-derived here; read via the accessor). */
  affinity: number;
  tier: RelationshipTier;
  tierLabel: string;
  familiarity: number;
  familiarityBand: FamiliarityBand;
  familiarityBandLabel: string;
  reliability: number;
  guarded: boolean;
  feeling: CharacterEmotion;
  feelingLabel: string;
  talkedCount: number;
  lastTalkDay: number | null;
  lastTalkPhase: TimePhase | null;
  daysSinceLastTalk: number | null;
  negativeCount: number;
  favorsCompleted: number;
  giftsGiven: number;
  sharedHistory: SharedHistorySummary;
  notableBonds: NpcBondSummary[];
}

/**
 * Builds the full derived profile for one resident. Composition only —
 * every field resolves through an exported helper above or an existing
 * canonical module, so a change to any underlying writer is reflected here
 * automatically (and only here).
 */
export function buildRelationshipProfile(
  world: WorldState,
  residentId: ResidentId,
): RelationshipProfile {
  const def = RESIDENTS[residentId];
  const prog = world.residents[residentId];
  const rel: PlayerNpcRelation | undefined = world.playerRelations?.[residentId];
  const affinity = getEffectivePlayerAffinity(world, residentId);
  const tier = getRelationshipTier(affinity);
  const familiarity = rel?.familiarity ?? (prog?.met ? 10 : 0);
  const band = getFamiliarityBand(familiarity);
  const feeling = resolveCurrentFeeling(world, residentId);
  const daysSinceLastTalk =
    typeof rel?.lastTalkDay === 'number' ? world.day - rel.lastTalkDay : null;

  return {
    residentId,
    name: def.name,
    met: prog?.met ?? false,
    affinity,
    tier,
    tierLabel: getRelationshipTierLabel(tier),
    familiarity,
    familiarityBand: band,
    familiarityBandLabel: getFamiliarityBandLabel(band),
    reliability: rel?.reliability ?? 25,
    guarded: isResidentGuarded(rel, feeling),
    feeling,
    feelingLabel: getEmotionLabel(feeling),
    talkedCount: rel?.talkedCount ?? 0,
    lastTalkDay: rel?.lastTalkDay ?? null,
    lastTalkPhase: rel?.lastTalkPhase ?? null,
    daysSinceLastTalk,
    negativeCount: rel?.negativeCount ?? 0,
    favorsCompleted: rel?.favorsCompleted ?? 0,
    giftsGiven: rel?.giftsGiven ?? 0,
    sharedHistory: deriveSharedHistory(world, residentId),
    notableBonds: getNotableNpcBonds(world, residentId),
  };
}

// ---------------------------------------------------------------------------
// Coherence probes — adversarial QA for contradictory relationship states
// ---------------------------------------------------------------------------

export type RelationshipIncoherenceKind =
  | 'trust_heart_drift'
  | 'affinity_out_of_range'
  | 'kindred_but_guarded'
  | 'met_without_familiarity'
  | 'noncanonical_pair_key'
  | 'pair_resident_unknown';

export interface RelationshipIncoherence {
  kind: RelationshipIncoherenceKind;
  residentId?: ResidentId;
  pairKey?: string;
  detail: string;
}

/**
 * Scans the whole social state for *contradictory* relationship states —
 * the exact scenarios Workstream F (adversarial QA) targets. Pure and
 * read-only: it never repairs; it reports, so tests and tooling can assert
 * on the contradictions directly.
 *
 * Probes (each traceable to a writer contract):
 * - trust_heart_drift: `prog.trust` disagrees with the derived heart level of
 *   the authoritative affinity (the ratchet contract — relationships.ts
 *   `recordPlayerTalkAffinity` / activities.ts `applySharedActivityAffinity`).
 * - affinity_out_of_range: affinity outside [0, 100] (every writer clamps).
 * - kindred_but_guarded: tier 'kindred' while `isResidentGuarded` holds —
 *   possible only through hand-edited/corrupted saves.
 * - met_without_familiarity: `met` residents always carry ≥ 10 familiarity.
 * - noncanonical_pair_key / pair_resident_unknown: `npcRelations` keys must be
 *   canonical `a:b` pairs over known residents (`getNpcPairKey` contract).
 */
export function findRelationshipIncoherencies(
  world: WorldState,
): RelationshipIncoherence[] {
  const out: RelationshipIncoherence[] = [];

  for (const id of RESIDENT_ORDER) {
    const prog = world.residents[id];
    const rel = world.playerRelations?.[id];
    if (!prog || !rel) continue;

    const affinity = rel.affinity;
    if (affinity < 0 || affinity > 100 || !Number.isFinite(affinity)) {
      out.push({
        kind: 'affinity_out_of_range',
        residentId: id,
        detail: `affinity ${affinity} outside [0, 100]`,
      });
    }

    const hearts = getHeartLevel(Math.max(0, Math.min(100, affinity)));
    if (prog.trust !== hearts) {
      out.push({
        kind: 'trust_heart_drift',
        residentId: id,
        detail: `prog.trust=${prog.trust} but affinity ${affinity} derives hearts=${hearts}`,
      });
    }

    const tier = getRelationshipTier(Math.max(0, Math.min(100, affinity)));
    if (tier === 'kindred' && isResidentGuarded(rel, resolveCurrentFeeling(world, id))) {
      out.push({
        kind: 'kindred_but_guarded',
        residentId: id,
        detail: `tier kindred with affinity ${affinity} while reliability ${rel.reliability} and negativeCount ${rel.negativeCount} keep the resident guarded`,
      });
    }

    if (prog.met && (rel.familiarity ?? 0) < 10) {
      out.push({
        kind: 'met_without_familiarity',
        residentId: id,
        detail: `met=true but familiarity ${rel.familiarity} < seeded 10`,
      });
    }
  }

  const relations = world.npcRelations ?? {};
  for (const key of Object.keys(relations).sort()) {
    const [a, b] = key.split(':') as [ResidentId, ResidentId];
    const canonical = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (canonical !== key) {
      out.push({
        kind: 'noncanonical_pair_key',
        pairKey: key,
        detail: `expected canonical key ${canonical}`,
      });
      continue;
    }
    if (!RESIDENTS[a] || !RESIDENTS[b]) {
      out.push({
        kind: 'pair_resident_unknown',
        pairKey: key,
        detail: `pair references unknown resident(s): ${a}, ${b}`,
      });
    }
  }

  return out;
}
