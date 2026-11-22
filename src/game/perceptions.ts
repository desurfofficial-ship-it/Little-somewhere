/**
 * Directional perception overlay (S4) + emergent social groups (S6).
 *
 * The bilateral `NpcNpcRelation` (in `relationships.ts`) remains the shared
 * observable truth about a pair. This module layers per-resident SUBJECTIVE
 * perception on top — A's attitude toward B may diverge from B's attitude
 * toward A — and derives emergent social groups from perceived-confidant
 * closure.
 *
 * All readers are pure; all writers are in-place. No new RNG (deterministic
 * derivation from existing state). Reads only the perceiver's own overlay
 * (omniscience-safe).
 */
import type {
  NpcNpcRelation,
  NpcPerception,
  NpcRelationTier,
  ResidentId,
  SocialGroup,
  SocialGroupMembership,
  TimePhase,
  Vec2,
  WorldState,
} from './types';
import { RESIDENTS, RESIDENT_ORDER } from './residents';
import { getNpcPairKey, getNpcRelation, getNpcRelationTier } from './relationships';

/** Empty perception map (for createFreshWorldState / sanitizer default). */
export function createEmptyNpcPerceptions(): Partial<
  Record<ResidentId, Partial<Record<ResidentId, NpcPerception>>>
> {
  return {};
}

/** Deep-clone the perception map (for the pure stepSimulation path). */
export function cloneNpcPerceptions(
  src?: Partial<Record<ResidentId, Partial<Record<ResidentId, NpcPerception>>>>,
): Partial<Record<ResidentId, Partial<Record<ResidentId, NpcPerception>>>> {
  const out: Partial<Record<ResidentId, Partial<Record<ResidentId, NpcPerception>>>> = {};
  if (!src) return out;
  for (const perceiver of RESIDENT_ORDER) {
    const inner = src[perceiver];
    if (!inner) continue;
    const cloned: Partial<Record<ResidentId, NpcPerception>> = {};
    for (const target of RESIDENT_ORDER) {
      const p = inner[target];
      if (p) {
        cloned[target] = {
          ...p,
          perceptionTags: p.perceptionTags ? [...p.perceptionTags] : undefined,
        };
      }
    }
    out[perceiver] = cloned;
  }
  return out;
}

/**
 * The effective affinity A perceives between A and B.
 * = bilateral.affinity + (A→B overlay.affinityDelta ?? 0).
 */
export function getPerceivedAffinity(
  world: WorldState,
  perceiver: ResidentId,
  target: ResidentId,
): number {
  const bilateral = getNpcRelation(world.npcRelations, perceiver, target).affinity;
  const overlay = world.npcPerceptions?.[perceiver]?.[target]?.affinityDelta ?? 0;
  return Math.max(-50, Math.min(100, bilateral + overlay));
}

/**
 * The effective tier A perceives for the A↔B pair (directional).
 * Mirrors `getNpcRelationTier` math but with overlaid affinity/tension.
 */
export function getPerceivedTier(
  world: WorldState,
  perceiver: ResidentId,
  target: ResidentId,
): NpcRelationTier {
  const rel = getNpcRelation(world.npcRelations, perceiver, target);
  const overlay = world.npcPerceptions?.[perceiver]?.[target];
  if (!overlay) return getNpcRelationTier(rel);
  const aff = Math.max(-50, Math.min(100, rel.affinity + (overlay.affinityDelta ?? 0)));
  const tens = Math.max(0, Math.min(100, rel.tension + (overlay.tensionDelta ?? 0)));
  const fam = rel.familiarity ?? 0;
  if (aff < 0 || tens >= 55) return 'estranged';
  if (tens >= 25 || aff < 15) return 'guarded';
  if (aff >= 65 && tens < 10 && fam >= 2) return 'confidant';
  if (aff >= 40 && tens < 20) return 'warm';
  return 'acquainted';
}

/**
 * Zero-GC fast path (mirrors getNpcRelationTierFast but with overlay).
 * Reads the persisted relation + the perceiver's overlay without allocating
 * a default object for lazy pairs.
 */
export function getPerceivedTierFast(
  npcRelations: Record<string, NpcNpcRelation>,
  npcPerceptions: Partial<Record<ResidentId, Partial<Record<ResidentId, NpcPerception>>>> | undefined,
  perceiver: ResidentId,
  target: ResidentId,
): NpcRelationTier {
  const key = getNpcPairKey(perceiver, target);
  const rel = npcRelations[key];
  const overlay = npcPerceptions?.[perceiver]?.[target];
  if (rel) {
    if (overlay) {
      const aff = Math.max(-50, Math.min(100, rel.affinity + (overlay.affinityDelta ?? 0)));
      const tens = Math.max(0, Math.min(100, rel.tension + (overlay.tensionDelta ?? 0)));
      const fam = rel.familiarity ?? 0;
      if (aff < 0 || tens >= 55) return 'estranged';
      if (tens >= 25 || aff < 15) return 'guarded';
      if (aff >= 65 && tens < 10 && fam >= 2) return 'confidant';
      if (aff >= 40 && tens < 20) return 'warm';
      return 'acquainted';
    }
    return getNpcRelationTier(rel);
  }
  // Lazy default (no overlay possible — lazy pairs have no overlay entry).
  const isArthurPair = perceiver === 'arthur' || target === 'arthur';
  const affinity = isArthurPair ? 10 : 24;
  const tension = isArthurPair ? 10 : 0;
  if (affinity < 0 || tension >= 55) return 'estranged';
  if (tension >= 25 || affinity < 15) return 'guarded';
  if (affinity >= 40 && tension < 20) return 'warm';
  return 'acquainted';
}

/**
 * Adjusts A's perception of B (directional). Does NOT touch the bilateral
 * ledger. Called when A experiences something subjective (witnessed gossip,
 * received a favor, observed friction).
 */
export function adjustNpcPerceptionInPlace(
  world: WorldState,
  perceiver: ResidentId,
  target: ResidentId,
  day: number,
  deltaAffinity: number,
  deltaTension: number,
  tag?: string,
): void {
  if (!world.npcPerceptions) world.npcPerceptions = createEmptyNpcPerceptions();
  const inner = world.npcPerceptions[perceiver] ?? (world.npcPerceptions[perceiver] = {});
  const cur = inner[target] ?? {
    perceiverId: perceiver,
    targetId: target,
    affinityDelta: 0,
    tensionDelta: 0,
    lastShiftDay: null,
  };
  const tags =
    tag && !(cur.perceptionTags ?? []).includes(tag)
      ? [...(cur.perceptionTags ?? []).slice(-3), tag]
      : cur.perceptionTags;
  inner[target] = {
    ...cur,
    affinityDelta: Math.max(-30, Math.min(30, cur.affinityDelta + deltaAffinity)),
    tensionDelta: Math.max(-20, Math.min(20, cur.tensionDelta + deltaTension)),
    perceptionTags: tags,
    lastShiftDay: day,
  };
}

/**
 * S5 (relationship atrophy): if A hasn't had a perception-shifting interaction
 * with B for ≥ 7 days, nudge affinityDelta toward 0 by 1. Only the overlay
 * drifts — the bilateral record is preserved ("they knew each other" stays).
 * Called from advanceToNextDay.
 */
export function driftNpcPerceptionsInPlace(
  world: WorldState,
  currentDay: number,
): void {
  const perceptions = world.npcPerceptions;
  if (!perceptions) return;
  for (const perceiver of RESIDENT_ORDER) {
    const inner = perceptions[perceiver];
    if (!inner) continue;
    for (const target of RESIDENT_ORDER) {
      const p = inner[target];
      if (!p) continue;
      if (p.lastShiftDay === null || p.lastShiftDay === undefined) continue;
      const daysSince = currentDay - p.lastShiftDay;
      if (daysSince < 7) continue;
      // Nudge affinityDelta toward 0 by 1; tensionDelta toward 0 by 1.
      const nextAffinity =
        p.affinityDelta > 0 ? Math.max(0, p.affinityDelta - 1) : Math.min(0, p.affinityDelta + 1);
      const nextTension =
        p.tensionDelta > 0 ? Math.max(0, p.tensionDelta - 1) : Math.min(0, p.tensionDelta + 1);
      if (nextAffinity === 0 && nextTension === 0 && (!p.perceptionTags || p.perceptionTags.length === 0)) {
        // Fully decayed — drop the entry to keep the map compact.
        delete inner[target];
      } else {
        inner[target] = { ...p, affinityDelta: nextAffinity, tensionDelta: nextTension };
      }
    }
  }
}

// ── S6: Social groups ──

/**
 * Derives emergent friend-circles from perceived-confidant closure.
 * A group forms when ≥ 3 residents are pairwise perceived-confidant (via
 * getPerceivedTierFast — so directional perception feeds group membership).
 * Pure; idempotent for the same world state.
 *
 * O(N³) at N=10 (trivial). Called once per day in advanceToNextDay.
 */
export function deriveEmergentSocialGroups(world: WorldState): SocialGroup[] {
  const groups: SocialGroup[] = [];
  const N = RESIDENT_ORDER.length;
  // Build adjacency: A→B edge if getPerceivedTierFast(A,B) === 'confidant'.
  // For group membership we require MUTUAL confidant (both directions) so a
  // one-sided crush doesn't form a group.
  const adj = new Map<ResidentId, Set<ResidentId>>();
  for (let i = 0; i < N; i++) {
    const a = RESIDENT_ORDER[i];
    adj.set(a, new Set());
  }
  for (let i = 0; i < N; i++) {
    const a = RESIDENT_ORDER[i];
    for (let j = i + 1; j < N; j++) {
      const b = RESIDENT_ORDER[j];
      const ab = getPerceivedTierFast(world.npcRelations, world.npcPerceptions, a, b);
      const ba = getPerceivedTierFast(world.npcRelations, world.npcPerceptions, b, a);
      if (ab === 'confidant' && ba === 'confidant') {
        adj.get(a)!.add(b);
        adj.get(b)!.add(a);
      }
    }
  }
  // Find cliques of size ≥ 3 (simple greedy: for each resident, their confidant
  // set; if ≥ 2 confidants share mutual confidant with each other, it's a group).
  const seen = new Set<string>();
  for (let i = 0; i < N; i++) {
    const seed = RESIDENT_ORDER[i];
    const friends = [...(adj.get(seed) ?? [])];
    if (friends.length < 2) continue;
    // Check which friends are also mutual-confidant with each other.
    const circle: ResidentId[] = [seed];
    for (const f of friends) {
      let mutuallyKnown = true;
      for (const c of circle) {
        if (c === seed) continue;
        if (!adj.get(f)!.has(c)) {
          mutuallyKnown = false;
          break;
        }
      }
      if (mutuallyKnown) circle.push(f);
    }
    if (circle.length < 3) continue;
    circle.sort();
    const key = circle.join(':');
    if (seen.has(key)) continue;
    seen.add(key);
    // Cohesion = mean pairwise perceived affinity / 100.
    let affSum = 0;
    let pairCount = 0;
    for (let x = 0; x < circle.length; x++) {
      for (let y = x + 1; y < circle.length; y++) {
        affSum += getPerceivedAffinity(world, circle[x], circle[y]);
        pairCount++;
      }
    }
    const cohesion = pairCount > 0 ? Math.max(0, Math.min(1, affSum / pairCount / 100)) : 0;
    groups.push({
      id: `circle_${key}`,
      label: `${RESIDENTS[circle[0]].name}'s Circle`,
      kind: 'friend_circle',
      members: circle.map((m) => ({
        residentId: m,
        joinedDay: world.day,
        cohesion,
      })),
      authored: false,
      recognizedDay: world.day,
    });
  }
  return groups;
}

/** Returns the group ids a resident currently belongs to. */
export function getResidentGroupIds(world: WorldState, residentId: ResidentId): string[] {
  const groups = world.npcSocialGroups ?? [];
  const out: string[] = [];
  for (const g of groups) {
    if (g.members.some((m) => m.residentId === residentId)) out.push(g.id);
  }
  return out;
}

/** True if A and B share at least one social group. */
export function areInSameSocialGroup(
  world: WorldState,
  a: ResidentId,
  b: ResidentId,
): boolean {
  const groups = world.npcSocialGroups ?? [];
  for (const g of groups) {
    const hasA = g.members.some((m) => m.residentId === a);
    const hasB = g.members.some((m) => m.residentId === b);
    if (hasA && hasB) return true;
  }
  return false;
}

/**
 * Reconciles derived social groups on day-advance: re-derives friend-circles
 * and merges with any authored groups. Idempotent.
 */
export function reconcileSocialGroupsInPlace(world: WorldState): void {
  const authored = (world.npcSocialGroups ?? []).filter((g) => g.authored);
  const derived = deriveEmergentSocialGroups(world);
  world.npcSocialGroups = [...authored, ...derived];
}
