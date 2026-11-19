# 08 — Milestone 2B Readiness & Implementation Plan

**Target Phase**: Milestone 2B — Declarative Dialogue Engine, Deeper Social & Relationship Dynamics, Multi-Beat Personal Storylines, and Journal History  
**Prerequisite**: Milestone 2A (validated in `07-milestone-2a-final-validation.md`) + Wave 0 Milestone 2A bug fixes below.  
**Reference Blueprints**: `docs/audits/03-relationship-and-dialogue-blueprint.md`, `docs/audits/06-milestone-2-implementation-roadmap.md`.

---

## 1. Architectural Scope & Prototype-Expansion Principles

Milestone 2B completes the narrative, relational, and memory layers built atop Milestone 2A's deterministic simulation (`WorldState v2`, `relationships.ts`, `simulation.ts`, `environment.ts`):

- **Strictly Preserve `src/game/` Purity**: Zero React, zero Three.js, zero unguarded DOM imports inside `src/game/`. All new dialogue selection, condition checks, cooldowns, relationship tier lookups, and conflict resolution must run and pass under `tsx --test`.
- **Prototype Cast Is Not a Hard Ceiling**: Design `DialogueTopic` schemas, topic registries, relationship tier resolvers, and conflict states around `ResidentId` strings, trait predicates, and pair keys (`NpcPairKey`) rather than hardcoding 9 residents or `willow_square`-only assumptions, so new neighbors, regions, and multi-beat arcs can register additively in future milestones.
- **Backward Save Compatibility**: Existing Milestone 1 (`v1`) and Milestone 2A (`v2`) `localStorage` saves must migrate or hydrate cleanly without losing *The Silent Gazebo Bell* flags, memories, trust levels, or `npcRuntime`.

---

## 2. Wave 0 — Mandatory Milestone 2A Defect Fixes (Execute First)

Before adding Milestone 2B systems, resolve the 4 confirmed defects from `07-milestone-2a-final-validation.md`:

1. **Frame-0 Environment Sync (`src/scene/NeighborhoodCanvas.tsx`)**: Run `envController.update(composeEnvironmentState(worldRef.current), ...)` and position `residentRigs` + `oakGlint` + `fountainRig` + `gazeboRig` *before* the synchronous Frame 0 `renderer.render(scene, camera)` on software WebGL mount, eliminating the ~2s wrong-season/unrestored-plaza flash.
2. **Fountain Basin Water Geometry (`src/scene/builders/landmarks.ts`)**: Replace the solid `CylinderGeometry` `outerWall` (`top = 0.70`) with a hollow lathe profile (or recessed basin floor `y = 0.56` + `waterMesh` at `y = 0.68` inside an open ring wall rising to `0.78`) so restored fountain water clearly shimmers in-world.
3. **Mobile `JournalDrawer` Tab Ergonomics (`src/components/JournalDrawer.tsx`)**: Make tab labels wrap cleanly or use compact mobile sizing (`grid-cols-3` or `flex-wrap`) at `390px` so `"Neighbors"`, `"Story & Memories"`, and `"World & Time"` are all visible without horizontal clipping.
4. **Dynamic Resident Count (`src/components/PauseModal.tsx`)**: Replace hardcoded `/9` with `/{RESIDENT_ORDER.length}` (and generalize `engine.test.ts:44` assertion to `>= 9` or structural validation).

*(Optional polish during Wave 0/2B: wire `puddlesActive` cobble roughness/sheen, `claraPastryBasketVisible`, `minaGreenhouseStage`, `arthurEarlyPorchLamp`, and seasonal leaf tinting on `willowLaneDiorama.ts` hero trees.)*

---

## 3. Milestone 2B Core Workstreams

### Workstream 1 — Declarative Dialogue Engine (`src/game/dialogueEngine.ts`)
Replace the 934-line imperative `buildResidentDialogue()` in `src/game/narrative.ts` with a pure data-driven engine:
- **Topic Registry & Schema**:
  - `DialogueCategory`: `'quest_milestone' | 'personal_story' | 'conflict_reconciliation' | 'event_reaction' | 'npc_gossip' | 'relationship_tier' | 'weather_season' | 'daily_slice'`.
  - `DialogueCondition`: `flagsTrue`, `flagsFalse`, `minTrust`, `maxTrust`, `minAffinity`, `minNpcAffinity`, `maxNpcAffinity`, `minNpcTension`, `requiresTraits` (e.g., `outdoorsiness >= 0.7`), `phases`, `weathers`, `seasons`, `requiresRecentEventKind` / `requiresRecentEventTag` (`maxDaysAgo`), `notSeenToday`, `minDaysSinceSeen`, `maxSeenCount`, `requiresMet`, `talkedCountMin`.
  - `DialogueTopic`: `{ id, residentId: ResidentId | 'any', category, priority, cooldownDays, repeatableDaily?: boolean, condition, buildNodes(ctx) }`.
- **Selection & Safety Pipeline (`selectDialogueSession`)**:
  1. Collect all topics matching `residentId` or `'any'`.
  2. Filter via pure `evaluateDialogueCondition(topic.condition, ctx)`.
  3. Rank by `(priority DESC, neverSeenBonus DESC, leastRecentlySeen ASC, deterministicSeededTieBreak)`.
  4. **Concurrent Story Beat Injection**: If a higher-priority `weather_season` or `event_reaction` topic wins the root greeting, optionally append up to 1 unlocked `quest_milestone` or `personal_story` reply option onto the root node so players are never blocked from advancing quests by daily chatter.
  5. **Zero-Condition Fallback Pool**: Guarantee at least 3–4 phase/trait-flavored `daily_slice` topics per resident (cycled deterministically via `(day + talkCount) % pool.length`) so no resident ever dead-ends or repeats the exact same small-talk line twice in one day.

### Workstream 2 — Extract *The Silent Gazebo Bell* Verbatim (`src/game/narrative.ts`)
- Move all 9 residents' existing branching beats into `quest_milestone` `DialogueTopic[]` entries while **preserving 100% of existing choice IDs, `StoryFlags` mutations, and `JournalMemory` IDs** (`mem_bell_mystery` through `mem_bell_restored`).
- Remove `lastDialogueId` dead writes (or deprecate cleanly in migrations) and route all dialogue openings through `dialogueEngine.ts` + `DialogueSession.topicId` metadata.

### Workstream 3 — Dialogue & Topic History Schema (`src/game/types.ts`, `migrations.ts`, `storage.ts`)
- Add persistent topic memory to `WorldState`:
  - `topicHistory: Record<string, TopicHistoryEntry>` (`seenCount`, `lastSeenDay`, `lastSeenPhase`, `chosenChoiceIds` bounded per topic).
  - `lastTopicByResident: Partial<Record<ResidentId, string>>` (to enforce immediate back-to-back non-repeat even within the same day).
- **Schema Migration Strategy (`v2 -> v3` or additive `v2` defaults)**:
  - Preferred: bump `CURRENT_SCHEMA_VERSION` to `3` with pure `migrateV2ToV3()` initializing empty `topicHistory: {}` and `lastTopicByResident: {}` (plus updating `saveWorldState()` to use `serializeWorldState(state)` and expanding `App.tsx`'s `getSaveStamp` to hash `flags`, `residents`, `topicHistory` count, and `npcRuntime` milestones or a monotonic `stateRevision`).

### Workstream 4 — Relationship-Dependent & Trait-Dependent Dialogue (`src/game/relationships.ts`, `dialogueEngine.ts`)
- Surface named **Relationship Tiers** derived cleanly from `PlayerNpcRelation.affinity` (`0..100`):
  - `stranger` (`0..19` / 0 hearts), `acquaintance` (`20..39` / 1 heart), `friendly` (`40..59` / 2 hearts), `close` (`60..79` / 3 hearts), `kindred` (`80..100` / 4–5 hearts).
- Add tier-gated conversational tone shifts, personal secrets, and daily reactions for every resident, plus trait-matched shared-pool commentary (`rainBehavior`, `outdoorsiness`, `morningLark`, `curiosity`).
- Enforce cooldowns & daily small-talk variety: first daily conversation with a neighbor grants familiarity + small-talk affinity (up to `DAILY_SMALLTALK_AFFINITY_CAP`), whereas same-day follow-up chats select a distinct fallback/gossip/follow-up topic rather than repeating the root line verbatim.

### Workstream 5 — Shared NPC-to-NPC & World-Event Memories
- Generalize `recentSocial` awareness (currently `nora` and `jun` only) into shared `npc_gossip` and `event_reaction` topics available to all residents:
  - Residents reference same-day or yesterday's `npc_social` encounters they participated in or observed nearby (`"Clara and Mina were trading rosemary recipes by the patio earlier..."`).
  - Residents react to player-triggered `WorldEventRecord` tags (`bell_ring`, `fountain_fixed`, `weather_shift` e.g. first `light_rain` or season turnover on Days `11`, `21`, `31`).

### Workstream 6 — Multi-Beat Personal Storylines (Beyond *The Silent Gazebo Bell*)
Author at least **3–4 multi-beat optional personal side stories** unlocked by Relationship Tiers (`>= 2` hearts) or post-bell plaza warmth, tracked via additive optional `sideFlags: Record<string, boolean | number | string>` on `WorldState` (avoiding brittle monolithic boolean proliferation on `StoryFlags`):
- **Nora & Pip — *The Willow Lane Sketchbook Zine***: Gather local sketches from Toby and favorite recipes/notes from Clara to bind a small chapbook at Linden Book Nook.
- **Mina & Clara — *Seasonal Herb & Hearth Pairing***: Help Mina test moon-petal & thyme cuttings in Sunbeam Greenhouse for Clara's seasonal loaves.
- **Barnaby & Sora — *Dusk Bench & Acoustic Tuning***: Barnaby crafts a cedar music stand beside Mirror Pond for Sora's golden-hour violin practice.
- **Arthur & Jun — *Postcard & Pocket-Watch Keepsake***: Repair an old coastal courier timepiece once `claraArthurReconciled` or `bellRestored` is true.

### Workstream 7 — Generalized Social Conflicts & Reconciliation Mechanics (`relationships.ts`, `simulation.ts`, `dialogueEngine.ts`)
- Generalize the Milestone 2A `arthur:clara` estrangement rule (`affinity < 0 || tension >= 50`) into a reusable relationship/simulation mechanic:
  - `NpcNpcRelation` exposes `tension` (`0..100`) and conflict/cooling tags (`'gazebo_rift'`, `'quiet_misunderstanding'`, etc.).
  - `simulation.ts` skips autonomous social pairing whenever `relation.affinity < 0 || relation.tension >= 45`, while enabling **tension-aware dialogue topics** for involved NPCs and mutual friends.
  - Player mediation choices or shared positive world events decrement `tension`, boost `affinity`, record a `WorldEventRecord` (`kind: 'player_help'`), and re-enable autonomous social encounters cleanly.

### Workstream 8 — Pocket Journal & History Improvements (`src/components/JournalDrawer.tsx`, `DialogueSheet.tsx`)
- **Neighbors Tab**: Show Relationship Tier badge/label (`Friendly`, `Close`, `Kindred`) alongside hearts, live `npcRuntime` activity + place, and recent conversation/story cue.
- **Story & Memories Tab**: Group *The Silent Gazebo Bell* main arc cleanly alongside unlocked Personal Side Stories and chronological `memories` cards.
- **World & Time Tab**: Expand *Recent Lane Moments* with filter/time labels (`Day N · Phase`) showing `npc_social`, `bell_ring`, `weather_shift`, and `player_help` events, plus tomorrow's forecast and greenhouse/flyer progress.
- **DialogueSheet**: Display current Relationship Tier subtly next to the speaker's heart meter and current topic category context (no SaaS pills or telemetry clutter).

---

## 4. Dependency Order & Affected Files

1. **Step 1 — Wave 0 Bug Fixes**: `NeighborhoodCanvas.tsx`, `landmarks.ts`, `JournalDrawer.tsx`, `PauseModal.tsx`, `engine.test.ts`.
2. **Step 2 — Types, Migrations & Serialization**: `src/game/types.ts` (`TopicHistoryEntry`, `RelationshipTier`, `sideFlags`, `schemaVersion: 3`), `src/game/migrations.ts` (`migrateV2ToV3`, sanitization), `src/game/storage.ts` (`saveWorldState` via `serializeWorldState`), `src/App.tsx` (complete `getSaveStamp` / revision dirty tracking).
3. **Step 3 — Relationship Tiers & Generalized Conflict Logic**: `src/game/relationships.ts`, `src/game/simulation.ts` (tension threshold helper).
4. **Step 4 — Declarative `dialogueEngine.ts` + Migrated `narrative.ts` + `actions.ts`**: Create `src/game/dialogueEngine.ts`, refactor `src/game/narrative.ts` into declarative topic pools (Bell questline + gossip + weather/season + tier flavor + 3–4 personal storylines + conflict/mediation), update `applyDialogueChoice()` in `src/game/actions.ts` to record `topicHistory`, `lastTopicByResident`, `sideFlags`, and `WorldEventRecord`s.
5. **Step 5 — UI & Journal Upgrades**: `src/components/JournalDrawer.tsx`, `src/components/DialogueSheet.tsx`, `src/App.tsx`.
6. **Step 6 — Automated Tests & Live Verification**: `src/game/dialogue.test.ts`, expanded `relationships.test.ts` & `storage.test.ts`, plus desktop & mobile browser QA.

---

## 5. Verification Plan, Acceptance Criteria & Completion Gates

### Automated Tests (`npm test` under `node:test`)
- **`dialogue.test.ts` (New)**:
  - Graph integrity check across every resident × every quest stage × every time phase/weather/season: every `choice.nextNodeId` resolves inside `session.nodes` and no node traps the player.
  - Preservation check: all original *Silent Gazebo Bell* choice IDs, `StoryFlags`, and `JournalMemory` IDs (`nora_read_together` included) resolve and unlock identically.
  - Cooldown & repeat protection: talking to the same resident 3+ times on the same day rotates fallback/tier/gossip topics and never repeats the exact same non-quest root line back-to-back.
  - Event & gossip reaction: after a simulated `npc_social` or `bell_ring` event, participants/neighbors prioritize `npc_gossip` / `event_reaction` topics while keeping unlocked `quest_milestone` replies reachable.
  - Generalized conflict/mediation: raising/lowering `tension` on any `NpcNpcRelation` toggles `simulation.ts` social pairing and mediation dialogue availability.
- **`storage.test.ts` & `relationships.test.ts` (Expanded)**:
  - Sequential `v1 -> v2 -> v3` and `v2 -> v3` migrations preserve all Milestone 1 & 2A progress and sanitize corrupt `topicHistory` / `sideFlags`.
  - Relationship tier thresholds (`stranger`..`kindred`) and tension decay/reconciliation invariants hold.

### Key Risks & Mitigations
- **Regression risk migrating 934 lines of `narrative.ts`**: Migrate one resident at a time behind a golden snapshot test verifying all existing choice IDs and memory unlocks before writing new side stories.
- **Save bloat risk**: Bound `topicHistory[id].chosenChoiceIds` (e.g., last 12 entries), keep `worldEvents` capped at `MAX_WORLD_EVENTS`, and keep `npcActivityHistory` capped cleanly.
- **Scope creep into Milestone 3+**: Strictly defer cutaway cottage interiors, physical item inventory/UI gifting, multi-region travel, and >9 new resident builds to Milestone 3+.

### Explicitly Deferred to Milestone 3+
- Walkable/cutaway cottage interiors (`player_door` interior scene).
- Carryable item inventory & physical gifting loop.
- Additional neighborhoods/regions beyond `willow_square` & >9 residents (beyond keeping data structures extensible).
- Weekly plaza market stalls & festival calendar events.

### Milestone 2B Completion Gates
1. `npm test` — 100% pass across all pure simulation, migration, relationship, environment, navigation, and dialogue test suites.
2. `npm run lint` (`tsc --noEmit`) — `0` errors.
3. `npm run build` (`vite build`) — clean build.
4. Live Chromium verification (`1440×900` & `390×844`) with `0` console errors/warnings: Frame 0 renders true season/flags immediately, Fountain basin water shimmers visibly, mobile Journal shows all 3 tabs without clipping, same-day repeat chats rotate cleanly, a new personal storyline progresses, and `v1 -> v3` & `v2 -> v3` save migrations succeed cleanly.
