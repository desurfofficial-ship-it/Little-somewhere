# NPC Intelligence & Living Simulation — Audit & Implementation Program

**Lead**: NPC Intelligence and Simulation Lead
**Branch**: `feat/npc-intelligence-living-simulation`
**Scope**: Evolve LITTLE SOMEWHERE's residents from functioning characters into
convincing residents with independent lives, routines, priorities, personalities,
relationships, memories, and evolving behavior — without sacrificing the existing
deterministic, persistable, zero-GC simulation foundation.

---

## 0. Program Summary

A coordinated six-subagent investigation audited the existing NPC runtime across
architecture, schedules, decision-making, social behavior, memory/gossip, and
adversarial QA. The verdict was unanimous:

> **The architecture is sound. The behavior is shallow.**

The codebase already has a mature, deterministic, headless, persistable
simulation (`stepSimulationInPlace`, `simulation.ts:606`) backed by a 528-test
suite and an 11-version migration chain. Its weakness is **illusion-of-intelligence
gaps** — declared data that nothing reads, computed state that feeds back into
nothing, and encounters that leave no consequential trace.

This program closes those gaps with a cohesive set of additive, deterministic,
backward-compatible improvements organized into six workstreams (A–F). No
expensive AI architecture is introduced (no LLM, no GOAP, no behavior tree).
Every change is pure-TypeScript, seeded, testable in Node, and persists cleanly.

---

## 1. Audit Findings (Phase 0)

### 1.1 What already works well
- **Three-layer separation** (`src/game/` pure-TS engine / `src/scene/` renderer /
  `src/components/` HUD) with `worldRef` + throttled snapshots.
- **Deterministic headless tick** (`stepSimulationInPlace`, zero-GC in steady
  state) plus a pure immutable twin (`stepSimulation`) for tests. Determinism is
  test-pinned (`simulation.test.ts:55-98`, `259-282`).
- **RNG foundation** (`rng.ts`): FNV-1a `hashSeed` + `mulberry32`, threaded
  through activity selection, encounter rolls, and weather.
- **Persistence**: `schemaVersion: 11`, 18 sanitizers, tombstone-before-rewrite,
  dirty-flagged autosave via a fingerprint (`computeWorldSaveRevision`).
  `NpcRuntimeState` is fully persistable (reload restores positions, waypoints,
  dwell timers).
- **A* pathfinding** (`navigation.ts`): 51-node lane graph + LOS smoothing +
  soft separation + stuck recovery.
- **Non-omniscient memory+gossip** (`memories.ts`, 998 lines): provenance
  lattice (firsthand/secondhand/rumor), hop limits, distortion flavors,
  retention tiers with smart eviction, gossip gated by affinity/tension,
  knowledge-gated `playerRelationWith` dialogue conditions.
- **Bilateral NPC↔NPC relations** with affinity/tension/sharedTags; estranged
  Clara↔Arthur enforced via `shouldSuppressNpcSocial`.

### 1.2 Where behavior is shallow / illusion-of-intelligence (with file:line)
| Gap | Evidence |
|---|---|
| `bellRestored` short-circuits the emotion cascade → every NPC permanently "happy" after the main quest | `simulation.ts:372-393` |
| `preferredZones` declared for all 10 residents, never read by any decision | `types.ts:332`, `residents.ts` (×10) |
| `needs.social` and `needs.fulfillment` decay but never drive decisions (only energy/hunger get binary boosts) | `simulation.ts:228-230,355-364` |
| `emotion` is computed every tick but never fed back into activity selection (open loop) | `simulation.ts:172-339` never reads `rt.emotion` |
| `isEating` is a fragile substring match on `currentActivityId` | `simulation.ts:353` |
| RNG jitter ±25% often dominates the trait signal; no deterministic tiebreak | `simulation.ts:313` |
| `findSpeakerMemory` has an **inverted recency** term (`m.learnedDay * 2` up-weights stale news) | `dialogueEngine.ts:157` |
| NPC↔NPC encounters create **no firsthand memory** of the conversation; participants only exchange pre-existing gossip | `simulation.ts:1029-1040` |
| NPC↔NPC encounters can **only warm** (always +affinity / −tension); no autonomous friction path | `simulation.ts:1008-1014` |
| `familiarity` (player↔NPC) is **write-only** — accrues but no consumer reads it | grep-verified |
| Synchronized phase transitions — all 10 NPCs re-evaluate at 690/960/1110 simultaneously | `simulation.ts:685-686` |
| Uniform dwell durations (44–72 min regardless of activity kind) | `simulation.ts:335` |
| Stuck-recovery drops waypoints but does **not** re-select activity → NPC frozen up to 33 real seconds holding a stale label | `simulation.ts:786-799` |
| `world.worldEvents` globally readable with no speaker-witness/memory gate (soft omniscience) | `dialogueEngine.ts:401-422` |
| O(N) `worldEvents.some` dedup inside the O(N²) encounter loop | `simulation.ts:922` |

### 1.3 Adversarial QA gaps
- No multi-day schedule-reliability test; no behavioral-variety assertion;
  no stuck-recovery test; no population-scaling test; no mid-activity-interruption
  persistence test. A regression where NPCs never socialize or never change
  emotion would pass the entire existing suite.

---

## 2. Implementation Plan (Workstreams A–F)

All changes are **additive, seeded, deterministic, and backward-compatible**
(new state is optional and defaulted by sanitizers, so v11 saves load cleanly).

### Workstream A — Autonomous Daily Life
- **A1** Stuck-recovery re-selects activity (set `activityUntilMinute`/`goalCommittedUntilMinute` to now; suppress the failed candidate) — fixes the 33s frozen-NPC defect.
- **A2** Event-driven re-evaluation triggers: needs crossing urgency thresholds; encounter end releases both participants to re-plan.
- **A3** Activity-kind-varied dwell durations (work 55–90, eat 18–32, rest 30–48, social 38–58, leisure 30–52).
- **A4** Per-resident walk-speed scaling from `morningLark`/`sociability` (Pip skips, Arthur saunters).
- **A5** Activity-history repeat suppression (penalize candidates re-picked within the last 2 history entries) — Mina stops picking the same planter three blocks running.

### Workstream B — Personality & Decision-Making
- **B1** Emotion cascade fix: `bellRestored` becomes a +0.15 intensity boost, not a short-circuit override. NPCs stay tired/frustrated/sad when their state warrants it, even post-bell.
- **B2** Wire `preferredZones`: derive `zoneId` from `getLandmarkAt(cand.target).id`; boost candidates in a resident's preferred zones. (Resurrects dead data.)
- **B3** Graded need utility: replace binary `fatigueBoost`/`hungerBoost` with graded urgency curves over all four needs (energy, hunger, social, fulfillment), applied multiplicatively via the candidate's `goalKind`. (Closes the social/fulfillment loop.)
- **B4** Emotion feedback: `emotionBias` lookup (emotion × goalKind) multiplies candidate score — a frustrated NPC avoids social candidates; a tired NPC favors rest. (Closes the emotion open loop.)
- **B5** Tighten RNG jitter to ±10% (`0.90 + rand()*0.20`) and add a goalKind-based deterministic tiebreak epsilon. (Traits dominate noise; ties resolve by intent, not evaluation order.)
- **B6** Replace the `isEating` substring heuristic with `goalKind`-derived need satisfaction.

### Workstream C — Social Behavior
- **C1** NPC↔NPC firsthand memory of the encounter: each participant records an `interaction`-category firsthand memory tagged with the topic, so future dialogue can reference "the chat we had by the gazebo."
- **C2** Witness propagation: non-participant residents within `LOCAL_WITNESS_RADIUS` form `witness` firsthand memories — organic "I saw Clara and Mina talking" recall.
- **C3** NPC↔NPC `familiarity` + `encounterCount` fields; `getNpcRelationTier` factors familiarity into `confidant`. Repeated encounters now accumulate a distinct "how well they know each other" axis beyond affinity.
- **C4** Occasional autonomous friction: a small deterministic roll (guarded tier) produces `+tension` instead of `−tension`, so NPC relationships can drift apart without player intervention — creating mediation opportunities.
- **C5** Companion-bias in activity selection: candidates near a confidant partner's current position get a small boost (gravitate toward friends).

### Workstream D — Memory & Gossip
- **D1** Fix the inverted recency bug in `findSpeakerMemory` (`-recency` instead of `+learnedDay*2`). Fresh news surfaces before stale lore.
- **D2** Knowledge-gate `requiresRecentEventKind/Tag`: the speaker must have participated in, witnessed, or hold a memory of the event. (Defensive; eliminates future omniscience leaks.)
- **D3** Gentle `emotionalWeight` decay on non-permanent memories during day-advance pruning — memories "matter less" over time without being forgotten, lowering their retention score so fresher memories win eviction.

### Workstream E — World Simulation
- **E1** Event-driven re-eval on weather change (already partially handled via weather weight; formalized as a trigger).

### Workstream F — Performance
- **F1** Replace `world.worldEvents.some(e => e.id === encId)` with a per-tick `Set<string>` of active/world event ids — O(N²)→O(N) for the dedup scan.

### Testing — Behavioral QA Suite
New test file `src/game/npcBehavior.test.ts` covering the eight required categories:
schedule reliability (multi-day), navigation-failure recovery, activity
interruption, social interaction (variety + friction), persistence
(mid-waypoint/mid-encounter), deterministic replay, long-running stability
(memory saturation), and population scaling.

---

## 3. Coordination Notes

- **Shared interfaces**: new optional fields on `NpcRuntimeState`
  (`lastEmotionReason`, `targetUnreachableUntilMinute`, `blockedActivityIds`)
  and `NpcNpcRelation` (`familiarity`, `encounterCount`) are coordinated with
  the migration/sanitizer layer (`migrations.ts`) so persistence stays robust.
- **Determinism contract**: every new RNG draw (friction roll, witness
  distortion) uses `hashSeed(simSeed, day, encounterId, …)` to preserve the
  twin-replay invariant.
- **No schema bump required**: new fields are optional and defaulted by the
  existing sanitizers, so v11 saves load and run without migration.

Detailed per-workstream evidence and insertion points were captured by the six
parallel subagent audits performed during Phase 0.
