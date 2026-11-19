# 13 — Milestone 2B Phase 3: Dependency-Ordered Implementation Roadmap

**Status**: Implemented & Verified (2026-11-19 — Steps `3.1`–`3.9` Completed; `WorldState v4`; Phase 4 & Phase 5 Not Started)  
**Sequence**: 9 small, dependency-ordered steps (`3.1` -> `3.9`). Each step compiles (`tsc --noEmit`) and passes automated tests (`npm test`) before advancing.

---

## Step Overview

1. **Step 3.1** — Domain Types & Declarative Dialogue Hook Contracts (`src/game/types.ts`)
2. **Step 3.2** — Core NPC Memory Engine: Creation, Provenance, Witness Rules & Bounded Retention (`src/game/memories.ts`)
3. **Step 3.3** — Controlled Deterministic Gossip & Restrained Distortion Engine (`src/game/memories.ts`, `src/game/relationships.ts`)
4. **Step 3.4** — `WorldState v3 -> v4` Migration, Sanitization, Next-Day Expiration & Save Revision (`src/game/migrations.ts`, `src/game/storage.ts`)
5. **Step 3.5** — Event-to-Memory Capture in Player Actions & Event Hygiene Fixes (`src/game/actions.ts`, `src/App.tsx`)
6. **Step 3.6** — Discrete Encounter Gossip Hook in Simulation (`src/game/simulation.ts`)
7. **Step 3.7** — Dialogue Engine & Non-Omniscient Reaction / Third-Party Gossip Integration (`src/game/dialogueEngine.ts`, `src/game/narrative.ts`)
8. **Step 3.8** — Minimal UI Choice Context & Phase Boundary Check (`src/components/DialogueSheet.tsx`)
9. **Step 3.9** — Full Verification Gate, Regression Fixes, Performance/Size Audit & Documentation Sync

---

## Step 3.1 — Domain Types & Declarative Dialogue Hook Contracts

- **Objective**: Define canonical TypeScript types for `NpcMemoryEntry`, provenance, retention, distortion, `WorldState.npcMemories`, `NpcNpcRelation` gossip cooldown metadata, and declarative `DialogueCondition` / `DialogueChoice` memory hooks.
- **Files / modules affected**: `src/game/types.ts`.
- **Dependencies**: None (pure type additions; existing `ForwardWorldHooks` interface shape `{ id: string; tag: string }` remains satisfied).
- **Expected behavior**:
  - `NpcMemoryEntry`, `NpcMemoryProvenance`, `NpcMemorySourceKind`, `NpcMemoryCategory`, `NpcMemoryValence`, `NpcMemoryRetention`, `NpcMemoryDistortionFlavor`, and `NpcMemoryDetail` exported cleanly.
  - `WorldState` adds `npcMemories: Record<ResidentId, NpcMemoryEntry[]>`.
  - `NpcNpcRelation` adds optional `lastGossipDay?: number | null`, `lastGossipMinute?: number | null`, and `lastGossipEventId?: string`.
  - `DialogueCondition` adds `requiresNpcMemory?: { tag?: string; id?: string; provenance?: NpcMemoryProvenance[]; maxDaysOld?: number; unmentionedOnly?: boolean }`; `DialogueChoice` adds optional `recordNpcMemories` / `markMemoryTagsMentioned`.
  - Temporary optional compatibility cast removed only once `migrations.ts` populates `npcMemories` in Step 3.4 (or keep `npcMemories` required once `createDefaultWorldState` is updated atomically with Step 3.4). *Note*: To keep `npm run lint` green on every step, either update `migrations.ts` skeleton defaults in Step 3.1/3.4 together or make `npcMemories` required in Step 3.4 alongside `migrations.ts` while exporting `NpcMemoryEntry` in Step 3.1.
- **Tests**: `npm run lint` (`tsc --noEmit`) + existing `npm test` (`66/66`).
- **Acceptance criteria**: Zero type errors; zero breaking changes to existing `v3` callers.
- **Risks**: Circular imports if `types.ts` imports helpers—keep `types.ts` type-only.

---

## Step 3.2 — Core NPC Memory Engine: Creation, Witness Rules & Retention

- **Objective**: Implement `src/game/memories.ts` with pure, deterministic memory lifecycle operations: creation, spatial/acoustic witness discovery, deduplication/reinforcement, provenance upgrade/non-downgrade, priority eviction, and in-game day expiration.
- **Files / modules affected**: `src/game/memories.ts` [NEW].
- **Dependencies**: Step 3.1 (`types.ts`), `residents.ts`, `worldMap.ts` (`distance2D`), `rng.ts`.
- **Expected behavior**:
  - Export proposed tuning constants (`MAX_NPC_MEMORIES_PER_RESIDENT`, `MAX_PERMANENT_MEMORIES_PER_RESIDENT`, `LOCAL_WITNESS_RADIUS`, `ACOUSTIC_BELL_RADIUS`, `EPHEMERAL_RUMOR_TTL_DAYS`, `DURABLE_MEMORY_TTL_DAYS`).
  - `createInitialNpcMemories(reconciled, flags?)` initializes `Record<ResidentId, NpcMemoryEntry[]>` dynamically over `RESIDENT_ORDER` (with baseline `gazebo_rift` lore when unreconciled).
  - `recordNpcMemoryInPlace(npcMemories, residentId, entry, currentDay)` enforces deduplication by `eventId`/`id`, never downgrades higher provenance, upgrades `secondhand`/`rumor` to `firsthand` on direct witness, corroborates multi-source rumors without duplicating, and prunes to `MAX_NPC_MEMORIES_PER_RESIDENT` using deterministic eviction scoring.
  - `collectWitnessesForPosition(world, pos, radius, options)` selects eligible outdoor/unsheltered observers dynamically from `RESIDENT_ORDER`.
  - `pruneExpiredNpcMemories(npcMemories, currentDay)` clears expired non-permanent memories using in-game `world.day`.
  - `formatNpcMemorySummary(entry, ownerId)` generates deterministic human-readable text from structured fields + `distortionFlavor`.
- **Tests**: New unit tests in `src/game/memories.test.ts` covering creation, witness radius/sheltered exclusion, deduplication, provenance non-downgrade/upgrade, corroboration, retention bounds, permanent protection, and day-based expiration.
- **Acceptance criteria**: Pure zero-DOM module; all memory invariant tests pass deterministically; scales with arbitrary `RESIDENT_ORDER` sizes.
- **Risks**: Eviction removing a permanent lore memory if permanent cap is too tight—mitigated by reserving permanent quota separately inside eviction logic.

---

## Step 3.3 — Controlled Deterministic Gossip & Restrained Distortion Engine

- **Objective**: Implement deterministic NPC-to-NPC gossip eligibility, cooldowns, hop limits, spread caps, and personality-colored restrained distortion inside `src/game/memories.ts` (plus pair cooldown helpers in `relationships.ts` if needed).
- **Files / modules affected**: `src/game/memories.ts`, `src/game/relationships.ts`.
- **Dependencies**: Step 3.2, `relationships.ts` (`getNpcRelation`, `getNpcRelationTier`, `shouldSuppressNpcSocial`), `rng.ts`.
- **Expected behavior**:
  - `propagateEncounterGossipInPlace(world, participants, encounterId)` selects at most `1` (`MAX_GOSSIP_PER_ENCOUNTER`) eligible memory across encounter participants when:
    - Pair is not suppressed and meets `GOSSIP_MIN_AFFINITY` / `GOSSIP_MAX_TENSION` (higher bar for `friction`/`social_impression`).
    - Pair cooldown satisfied (`rel.lastGossipDay !== world.day`).
    - Candidate memory satisfies `hopCount < MAX_GOSSIP_HOPS`, `sharedCount < MAX_SHARES_PER_ENTRY`, and deduplication against listener's existing `eventId`s.
  - Transfers a `secondhand` or `rumor` copy with decremented `confidence`, incremented `hopCount`, preserved `originResidentId`, updated `fromResidentId`, and deterministic seeded `distortionFlavor` (`none` | `uncertain` | `exaggerated` | `softened` | `misattributed_motive`).
  - Stamps `lastGossipDay`, `lastGossipMinute`, and `lastGossipEventId` on the pair's `NpcNpcRelation`.
- **Tests**: `src/game/memories.test.ts` — relationship gating, estranged suppression, same-day cooldown enforcement, hop cap blocking (`hop >= 2`), max-1-per-encounter cap, deterministic distortion stability across runs with identical `simSeed`, divergence with different seeds, and no self-referential loops.
- **Acceptance criteria**: 100% deterministic given identical `WorldState` and `simSeed`; zero global flood across residents in a single encounter.
- **Risks**: Over-aggressive distortion making NPCs sound broken or contradicting player's story flags—mitigated by keeping distortion strictly to flavor/certainty/motive and preserving `eventId` & `subjectResidents`.

---

## Step 3.4 — `WorldState v3 -> v4` Migration, Sanitization & Revision Hash

- **Objective**: Upgrade persistence schema cleanly to `CURRENT_SCHEMA_VERSION = 4` with backward-compatible `v1 -> v2 -> v3 -> v4` migration, defensive sanitization, next-day memory pruning, and save revision hashing.
- **Files / modules affected**: `src/game/types.ts` (make `WorldState.npcMemories` required), `src/game/migrations.ts`, `src/game/storage.ts`.
- **Dependencies**: Steps 3.1, 3.2.
- **Expected behavior**:
  - `CURRENT_SCHEMA_VERSION = 4`.
  - `createDefaultWorldState()` initializes `npcMemories` via `createInitialNpcMemories()`.
  - `migrateV3ToV4(v3Raw)` preserves every v3 field untouched and hydrates `npcMemories` coherently from `flags`, `playerRelations` (`negativeCount`), and recent `worldEvents`.
  - `sanitizeWorldState()` validates/clamps `npcMemories` and `NpcNpcRelation` gossip cooldown fields (`lastGossipDay`, `lastGossipMinute`, `lastGossipEventId`).
  - `advanceToNextDay(state)` calls `pruneExpiredNpcMemories(state.npcMemories, nextDay)` so stale ephemeral rumors expire cleanly at morning rollover.
  - `computeWorldSaveRevision(state)` includes `npcMemories` and pair gossip fields without steady-state allocations.
- **Tests**: Expand `src/game/storage.test.ts` to test `v1 -> v4`, `v2 -> v4`, `v3 -> v4` migrations, corrupt/malformed `npcMemories` clamping (bad provenance, invalid resident IDs, `hopCount > cap`, self-`fromResidentId`, duplicate IDs), `computeWorldSaveRevision` dirty detection on memory/gossip edits, and JSON payload size budget tests (9 and 25 residents).
- **Acceptance criteria**: Round-trip `deserializeWorldState(serializeWorldState(state))` equals original state; existing `v1`/`v2`/`v3` test fixtures upgrade cleanly without losing `flags`, `memories`, or `trust`/`affinity`.
- **Risks**: Breaking existing `storage.test.ts:159, 377` assertions that explicitly assert `schemaVersion === 3`—must update those assertions explicitly to `CURRENT_SCHEMA_VERSION` (`4`) as part of Step 3.4.

---

## Step 3.5 — Event-to-Memory Capture in Player Actions & Event Hygiene Fixes

- **Objective**: Wire direct participant and proximity/acoustic witness memory creation into `applyDialogueChoice`, `deliverHeldItemAction`, and landmark prop actions (`gazebo_bell`, `hollow_oak`, `fountain_plaza`, `mirror_pond`). Resolve identified v3 event hygiene issues (if approved in Doc 15 Decision D3).
- **Files / modules affected**: `src/game/actions.ts`, `src/App.tsx` (only if fixing `gazebo_bell` double count).
- **Dependencies**: Steps 3.2, 3.4.
- **Expected behavior**:
  - Dialogue milestones (`setFlags`, `setSideFlags`, `isStoryMilestone`), blunt/negative remarks (`isNegative`), and `make_amends_<id>` record appropriate `firsthand` `npcMemories` onto the speaker and eligible nearby witnesses (`LOCAL_WITNESS_RADIUS`).
  - Delivered props (`deliverHeldItemAction` / `deliverHeldItem`) record `player_gift` onto recipient and `player_help_observed` onto nearby witnesses—without emitting duplicate `WorldEventRecord`s (`DUP-03`).
  - `gazebo_bell` ring emits acoustic `bell_chime` (`detail: { acousticOnly: true }`) vs close visual `bell_ring` witnesses cleanly upon actual bell ring (fixing `BUG-01` if approved).
  - `applyDialogueChoice` processes declarative `choice.recordNpcMemories` and marks `session.mentionedMemoryEventIds` / `choice.markMemoryTagsMentioned` as `mentionedToPlayer = true`.
- **Tests**: `src/game/memories.test.ts` + `src/game/engine.test.ts` — verify nearby witness captures event while distant/sheltered resident does not; verify bell chime records `acousticOnly` across town; verify duplicate gift event resolved.
- **Acceptance criteria**: Zero omniscient global memory recording; every player action produces bounded, provenance-accurate memories.
- **Risks**: `engine.test.ts:131-133` checks `interactWithProp(world, 'gazebo_bell').nextWorld.bellRungCount === 1`—if changing `gazebo_bell` pre-click behavior, synchronize `App.tsx`, `actions.ts`, and `engine.test.ts` cleanly (or preserve `bellRungCount` contract explicitly per Decision D3).

---

## Step 3.6 — Discrete Encounter Gossip Hook in Simulation

- **Objective**: Call `propagateEncounterGossipInPlace` inside `stepSimulationInPlace()` cleanly when an `ActiveSocialEncounter` is formed, without introducing per-frame allocations or breaking 60 Hz frame pacing.
- **Files / modules affected**: `src/game/simulation.ts`.
- **Dependencies**: Steps 3.3, 3.4.
- **Expected behavior**:
  - Only runs inside the `world.activeEncounters.push(encounter)` creation branch (`simulation.ts:913`).
  - `stepSimulation()` clones `npcMemories` shallow-safely (copying resident arrays on mutation) so pure headless `stepSimulation` calls never mutate caller inputs!
  - Keeps Clara & Arthur estranged suppression intact and respects all encounter/gossip cooldowns.
- **Tests**: `src/game/simulation.test.ts` + `src/game/memories.test.ts` — step two fresh simulations across a day and verify identical `npcMemories` (strict determinism), gradual multi-hop spread only through actual encounters, and immutability of `stepSimulation(input)`'s input object.
- **Acceptance criteria**: `stepSimulation` remains strictly deterministic and immutable; `stepSimulationInPlace` performs zero extra work on frames with no new encounter.
- **Risks**: Mutating `world.npcMemories` arrays in `stepSimulation()` without cloning them first—mitigated by cloning `npcMemories` in `stepSimulation()` (`simulation.ts:984-1003`).

---

## Step 3.7 — Dialogue Engine & Non-Omniscient Reaction / Third-Party Gossip Integration

- **Objective**: Connect `world.npcMemories` to `dialogueEngine.ts` and `narrative.ts` so `event_reaction` topics, `gossip_third_party_relation`, and context remarks reflect each speaker's actual subjective knowledge, provenance, and possible rumor distortion.
- **Files / modules affected**: `src/game/dialogueEngine.ts`, `src/game/narrative.ts`.
- **Dependencies**: Steps 3.5, 3.6.
- **Expected behavior**:
  - `evaluateDialogueCondition` reads `world.npcMemories?.[residentId]` natively (removing the `ForwardWorldHooks` cast) and evaluates `requiresNpcMemoriesAny`, `excludesNpcMemories`, and `requiresNpcMemory`.
  - `event_bell_celebration`, `event_gift_thanks`, and `event_fountain_repair` require matching `npcMemories` and vary dialogue text by `provenance` (`firsthand` vs `secondhand` naming `fromResidentId` vs `rumor` with `distortionFlavor`), marking the referenced memory `mentionedToPlayer` upon selection/reply.
  - `selectThirdPartyGossipSubject` respects speaker knowledge & social proximity (exact transition/hybrid behavior per Doc 15 Decision D2) and exposes provenance metadata so `gossip_third_party_relation` adapts phrasing (*"I saw..."* vs *"Pip mentioned..."* vs *"Heard a rumor on the cobbles..."*).
  - Optional clarification dialogue branch when a resident holds a `distorted` rumor about a player action/friction.
- **Tests**: `src/game/dialogue.test.ts` + `src/game/relationships.test.ts` — test isolated resident does NOT trigger `event_gift_thanks` before witnessing or gossiping; test resident who hears gossip triggers `secondhand` reaction naming source; test `mentionedToPlayer` prevents repeating same rumor; full `RESIDENT_ORDER × 4 phases` dialogue link sweep passes with zero broken `nextNodeId`.
- **Acceptance criteria**: No omniscient event reactions; provenance and distortion visibly change spoken dialogue; 100% valid dialogue node graphs across all residents & phases.
- **Risks**: Existing `relationships.test.ts:214-304` passes an un-gossiped fresh world to test `gossip_third_party_relation`—must align with Decision D2 (either seed knowledge in test fixture or retain bounded close-friend inference rule).

---

## Step 3.8 — Minimal Dialogue Sheet Context & Boundary Audit

- **Objective**: Ensure `DialogueSheet.tsx` / `App.tsx` surfaces any necessary Phase 3 dialogue metadata cleanly (already passes `world={worldSnapshot}` to `isChoiceAvailable`), without adding Phase 5 Pocket Journal redesign or HUD bloat.
- **Files / modules affected**: `src/components/DialogueSheet.tsx` (verify/minor check only; `JournalDrawer.tsx` remains untouched until Phase 5).
- **Dependencies**: Step 3.7.
- **Expected behavior**:
  - All Phase 3 condition-gated clarification or memory choices evaluate cleanly in `DialogueSheet`.
  - Zero `backdrop-blur`, zero marketing/telemetry UI, `>= 44px` touch targets preserved.
- **Tests**: `npm run lint`, `npm run build`, and spot check in `dialogue.test.ts`.
- **Acceptance criteria**: Dialogue UI compiles and respects every Phase 3 choice availability predicate.
- **Risks**: Accidental scope creep into `JournalDrawer.tsx` (belongs to Phase 5)—explicitly keep `JournalDrawer.tsx` unchanged in Phase 3 unless a safety guard is needed.

---

## Step 3.9 — Full Verification Gate, Regression Audit & Handover Docs

- **Objective**: Run full automated verification suite (`npm test`, `npm run lint`, `npm run build`), verify JSON payload budgets and zero-GC behavior, and update `WORKLOG.md` / `HANDOVER.md` / `ARCHITECTURE.md` cleanly upon Phase 3 completion.
- **Files / modules affected**: Test files + docs (`WORKLOG.md`, `HANDOVER.md`, `ARCHITECTURE.md`) after code verification.
- **Dependencies**: Steps 3.1–3.8.
- **Expected behavior**:
  - All unit tests (66 existing + new Phase 3 suites) pass 100%.
  - Zero TypeScript or Vite build errors.
  - Optional headless Chromium smoke check confirming no console errors on `title` / `playing` / dialogue interaction.
- **Tests**: Full `npm test && npm run lint && npm run build`.
- **Acceptance criteria**: Clean build, all acceptance checks green, zero leftover debug code.
- **Risks**: Regression in legacy `v1`/`v2`/`v3` saves or Gazebo Bell quest order—caught by full suite in Step 3.9.
