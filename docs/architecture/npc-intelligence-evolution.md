# NPC Intelligence Evolution — Implementation Plan

**Branch**: `feat/npc-intelligence-evolution` (off main `51c6d5a`, schema v12)
**Baseline**: 686/686 tests, tsc clean, build green, stress A–G clean
**Lead**: NPC Simulation & Emergent Behavior Engineer

This document distinguishes existing capability from genuine gaps per directive §10, then specifies the additive implementation.

---

## 1. Existing capabilities (REUSED — do not rebuild)

| Capability | Location | Status |
|---|---|---|
| Bilateral `NpcNpcRelation` ledger (affinity/tension/familiarity/encounterCount/sharedTags) | `relationships.ts`, `types.ts:513-529` | Mature |
| 5-tier relation math + suppression gates + friction + baseline bonds + reconciliation | `relationships.ts:62-297` | Mature |
| Directional *knowledge* (`npcMemories`) with provenance/distortion/decay/corroboration/gossip | `memories.ts` (1024 lines) | Mature |
| Multiplicative utility scorer (zone × need × emotion × companion × trait × weather × crowding × ±10% jitter + tiebreak) | `simulation.ts:323-555` | Mature |
| Zero-GC tier reader + twin-determinism RNG discipline | `relationships.ts:271-290`, `simulation.ts:375` | Mature |
| Encounter engine: 2-3 person circles, firsthand/witness memories, friction, gossip propagation | `simulation.ts:1227-1475` | Mature |
| Stuck-recovery + blockedActivityIds + urgent-need re-eval | `simulation.ts:1066-1107` | Mature |
| Schema v12 + sanitizer + migration chain + fingerprint | `migrations.ts`, `storage.ts` | Mature |
| Public facade (`npcAutonomy.ts`) | `npcAutonomy.ts` | Mature |
| Performance: 0.087% of 60Hz frame at N=10; scales to N=50 without LOD | measured by EV-E | Fine |

---

## 2. Genuine gaps (what's actually missing)

| Gap | Source | Severity |
|---|---|---|
| **G1. Memories don't drive activity selection** — `selectActivityForResident` never reads `world.npcMemories[id]` | EV-B B.1 | CRITICAL — directive's central ask |
| **G2. No commitment hysteresis** — `goalCommittedUntilMinute` is re-roll delay, not stickiness; near-equal activities flip-flop | EV-B B.2 | CRITICAL |
| **G3. No directional perception** — bilateral ledger can't express "A likes B but B is neutral to A" | EV-A Gap 1 | HIGH |
| **G4. No relationship atrophy** — confidant pairs stay confidant forever; no drift-apart | EV-A Gap 4 | HIGH |
| **G5. No social groups** — no 3+ resident group/friend-circle concept | EV-A Gap 3 | HIGH |
| **G6. No reinforcement** — Nth encounter = 1st for memory strength | EV-B B.3 | MEDIUM (partially closed by G1) |
| **G7. No personal goals/intentions** — decisions purely reactive | EV-B B.4 | MEDIUM |
| **G8. `temperament` decorative** — doesn't enter scorer | EV-B B.5 | LOW |
| **G9. `encounterCount`/`sharedCount` write-only** | EV-B B.8 | LOW (telemetry) |

---

## 3. Proposed implementation (additive, no rebuilds)

### Tier 1 — Memory→Behavior Bridge (closes G1, G2, G7)

**S1. Place-association memory bias** (closes G1, G6)
- Extend `NpcMemoryDetail` with optional `placeZoneId?: string` (the landmark id where the memory formed).
- Record `placeZoneId` on encounter/witness/participant memories.
- New pure helper `computePlaceAffinityBias(memories, targetZoneId, day)` — sums warm/tense valence × emotionalWeight × recency × importance, clamped ±30%.
- Integrate as a multiplicative term in `selectActivityForResident` (anchor + candidates). O(14) per candidate, only at re-selection (not per tick). No new RNG.
- **Effect**: a resident with warm gazebo memories gravitates to the gazebo; one with a tense pond memory avoids the pond.

**S2. Commitment hysteresis** (closes G2)
- When re-selecting, give the *current* activity a continuation bonus (×1.12) so near-ties resolve to "stay."
- The A5 repeat-suppressor (history) and S2 continuation bonus (current) operate on different sets — no conflict.
- No new state, no new RNG.

**S3. Short-term intention layer** (closes G7) — derived view, zero schema change
- New helper `deriveShortTermIntention(world, id, rt)` — deterministic derivation from (a) strongest unmet need, (b) top emotionalWeight non-expired memory with placeZoneId → seek/avoid zone, (c) nearest confidant position → seek_resident.
- Returns `{ kind: 'seek_zone'|'avoid_zone'|'seek_resident'|'rest'; target?: string; strength: number }`.
- Applied in scorer as a multiplicative bias for matching/violating candidates. No new RNG, no persistence.

### Tier 2 — Social Network Depth (closes G3, G4, G5)

**S4. Directional perception overlay** (closes G3)
- New `NpcPerception` type: `{ perceiverId, targetId, affinityDelta[-30..30], tensionDelta[-20..20], perceptionTags?, lastShiftDay? }`.
- Persisted as `world.npcPerceptions?: Record<ResidentId, Record<ResidentId, NpcPerception>>` (optional, additive).
- New readers: `getPerceivedAffinity`, `getPerceivedTier`, `getPerceivedTierFast` (zero-GC, mirrors existing fast path).
- New writer: `adjustNpcPerceptionInPlace` — called when A experiences something subjective (witnessed B gossiping, received a favor, observed friction).
- Companion bias + encounter willingness read perceived tier (directional). Bilateral ledger stays the shared observable truth.
- Schema stays v12 (optional field, sanitizer defaults empty for old saves — no migration needed).

**S5. Relationship atrophy** (closes G4)
- New `driftNpcPerceptionsInPlace(npcPerceptions, currentDay)` — if A hasn't had a perception-shifting interaction with B for ≥7 days, nudge `affinityDelta` toward 0 by 1.
- Called from `advanceToNextDay`. Only affects the overlay (bilateral record preserved — "they knew each other" history stays).
- **Effect**: A's subjective extra warmth cools; the bilateral "they were close" remains. Enables drift-apart stories.

**S6. Social groups (derived)** (closes G5)
- New `SocialGroup` type: `{ id, label, kind: 'friend_circle'|'shared_interest'|'regular_gathering', members[], anchorPlace?, anchorPhase?, authored }`.
- Pure derivation `deriveEmergentSocialGroups(world)` — finds cliques of ≥3 residents pairwise perceived-confidant. Idempotent, O(N³) at N=10 (trivial).
- Called once per day in `advanceToNextDay`; result cached on `world.npcSocialGroups?`.
- New facade queries: `getResidentGroupIds`, `areInSameSocialGroup`, `getGroupGatheringTarget`.
- Encounter pairing gets a small in-group bias (×1.05 pairChance); activity selection gets a group-anchor bias.
- **Effect**: 3+ close friends form a recognizable circle; the circle's regular gathering place attracts members.

---

## 4. Systems deliberately left unchanged

- `NpcNpcRelation` shape (no field added/renamed).
- `getNpcRelation`/`getNpcRelationTier`/`getNpcRelationTierFast`/`shouldSuppressNpcSocial` signatures.
- `applyNpcSocialRelationInPlace`/`stampNpcGossipInPlace` signatures.
- The encounter engine's core loop (pairing, spots, friction roll) — only the tier-read call sites swap to perceived variants.
- `npcMemories` model (provenance/retention/decay/gossip) — only `NpcMemoryDetail.placeZoneId` added.
- Schema version (stays v12 — all new fields optional, sanitizer-defaulted).
- LR-3 invitation system (untouched — directive §8).
- The production tick path's zero-GC discipline (new work is at re-selection, not per-tick).

---

## 5. Dependencies
- None new. All systems read existing `WorldState`/`npcMemories`/`npcRelations`/`npcRuntime`/`RESIDENTS`/`getLandmarkAt`.

## 6. Risks
- **Twin-determinism**: S1/S2/S3 use NO new RNG (pure derivation). S4/S5/S6 use seeded draws only at encounter time (already in the documented sequence). Pinned by existing `simulation.test.ts:55-98,259-282`.
- **Zero-GC**: all new scorer terms evaluate at re-selection (every 26-90 min), not per tick. O(14 memories) per candidate.
- **Save-compat**: optional fields default through existing sanitizers; no migration.
- **Omniscience**: S1 reads only `world.npcMemories[id]` (own). S4 reads bilateral + own overlay. S6 derives from perceived tiers (directional, not global).

## 7. Implementation order
1. **S1** (place-affinity) + **S2** (hysteresis) + **S3** (intentions) — Tier 1, the memory→behavior bridge. Pin with tests.
2. **S4** (perception overlay) + **S5** (atrophy) — Tier 2a, directional + drift. Pin with tests.
3. **S6** (social groups) — Tier 2b, emergent circles. Pin with tests.
4. Adversarial QA. Fix. Final verify. Push.
