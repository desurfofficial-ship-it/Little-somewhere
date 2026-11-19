# 09 — Milestone 2B Audit & Target Architecture Design

**Status**: Audit & Design Complete — **Awaiting Explicit User Approval Before Implementation**  
**Scope**: Deeper Social & Narrative Systems (Phases 1–5) for **LITTLE SOMEWHERE**  
**Repository Layer Discipline**: Strict preservation of `src/game/` (zero React / zero Three.js / zero unguarded DOM) | `src/scene/` | `src/components/` + `src/App.tsx`.

---

## 1. Executive Summary & Baseline Reconciliation

### 1.1 Prompt Baseline (`WorldState v2`) vs. Actual Repository State (`WorldState v3`)
Inspection of the live codebase reveals an important discrepancy between the Milestone 2B prompt's assumed baseline (`WorldState v2`, pre-`dialogueEngine.ts`) and what is already committed in the repository:

- During the **Player & Character Excellence Upgrade** (`WORKLOG.md` Entry 013) and subsequent water/bench polish (`WORKLOG.md` Entry 014), several structural Milestone 2B foundations were partially introduced alongside locomotion/rig upgrades:
  - `WorldState` is already at **`schemaVersion: 3`** (`src/game/migrations.ts`, `CURRENT_SCHEMA_VERSION = 3`), with sequential **`v1 -> v2 -> v3`** migration and `computeWorldSaveRevision()` dirty tracking (`src/game/storage.ts`).
  - `src/game/dialogueEngine.ts` already exists (`434` lines) and drives `DIALOGUE_TOPICS` in `src/game/narrative.ts` (`1,647` lines).
  - `src/game/relationships.ts` already defines `RelationshipTier` (`stranger`, `acquaintance`, `friendly`, `close`, `kindred`), `PlayerNpcRelation`, `NpcNpcRelation`, `reliability`, `negativeCount`, and `BASELINE_NPC_BONDS`.
  - Four prototype personal side stories (`pipZine`, `herbLoaf`, `pondStand`, `watchTune`) and two conflict mediation topics (`conflict_arthur_clara_tension`, `conflict_barnaby_arthur_rafters`) already exist in `narrative.ts` backed by `sideFlags`.
- **Why `HANDOVER.md`'s "Milestone 2B Complete" Label Is Premature**:
  Although surface scaffolding exists, deep architectural inspection shows that **true Milestone 2B depth is incomplete or shallow across all five core pillars**:
  1. **Dialogue Engine** still mixes declarative topics with duplicated imperative quest injection (`arthur_restore_bell` exists twice) and lacks memory-aware / storyline-aware predicates.
  2. **Relationship Tiers** exist mostly as labels—negative/positive feedback diverges between `affinity` and `trust` hearts, NPC-to-NPC tiers are untyped, and tiers barely alter autonomous behavior, shared activities, or conversational agency.
  3. **NPC Memories & Gossip Do Not Exist Per-Resident**: `world.memories` is strictly the player's Journal memory list, and `world.worldEvents` is a flat omniscient town log read identically by every NPC. NPCs have no personal memory store, no source/hearsay distinction, no controlled gossip spread during social encounters, and no differentiated social reactions.
  4. **Personal Storylines & Conflicts Are Ad-Hoc Booleans**: The 4 side stories are hardcoded 2-step `sideFlags` checks inside `narrative.ts` and duplicated as hardcoded lists inside `JournalDrawer.tsx`—with no reusable storyline engine supporting stages, alternative paths/outcomes, NPC knowledge ripple effects, or multi-step interconnected conflicts.
  5. **Journal & Narrative History** renders hardcoded thread checklists and a raw `worldEvents.slice(0, 5)` list rather than rich per-neighbor social context, storyline progression/outcomes, and curated narrative history.

Milestone 2B will **extend and unify** these existing foundations cleanly rather than rewriting or breaking any existing `WorldState` save, choice ID, memory ID, routine, or test.

---

## 2. Codebase Audit Inventory

### 2.1 Authoritative Files & Current Responsibilities

| Layer | File | Status | Current Role & Audit Notes |
| :--- | :--- | :--- | :--- |
| **Pure Sim** | `src/game/types.ts` | **Authoritative** | Core domain types (`WorldState` v3, `StoryFlags`, `DialogueCondition`, `DialogueChoice`, `DialogueTopic`, `WorldEventRecord`, `JournalMemory`, `PlayerNpcRelation`, `NpcNpcRelation`). Missing per-NPC memory & storyline progress types. |
| **Pure Sim** | `src/game/dialogueEngine.ts` | **Authoritative (Needs Extension)** | Evaluates `DialogueCondition`, scores/selects `DialogueTopic`s, prevents back-to-back topic repetition, injects concurrent quest choices, dynamic held gifts, and `make_amends_<id>`. Missing memory/gossip/storyline predicates, choice-level memory/storyline hooks, and per-NPC event awareness. |
| **Pure Sim** | `src/game/narrative.ts` | **Authoritative (Needs Consolidation)** | Holds `DIALOGUE_TOPICS`, `buildConcurrentQuestChoices()`, `computeEnvironmentState()`, and `getResidentAvailableQuestCue()`. Contains duplication (`arthur_restore_bell`) and ad-hoc 2-step `sideFlags` side stories. |
| **Pure Sim** | `src/game/relationships.ts` | **Authoritative (Needs Extension)** | Holds `RelationshipTier`, heart mapping, daily small-talk cap (`20`), `recordPlayerTalkAffinity()`, `NpcNpcRelation` helpers, `shouldSuppressNpcSocial()`, and `worldEvents` / `npcActivityHistory` ring buffers. Needs bidirectional `trust`/`affinity` consistency, NPC-NPC tier descriptors, and deeper social/tier modifiers. |
| **Pure Sim** | `src/game/actions.ts` | **Authoritative (Needs Extension)** | Pure reducers `applyDialogueChoice()`, `interactWithProp()`, `deliverHeldItemAction()`, `markResidentMet()`, `performFountainWishAction()`, `performPondStoneSkipAction()`, `performNextDayRest()`. Needs clean hooks into NPC memory recording, storyline stage transitions, and richer event emission. |
| **Pure Sim** | `src/game/simulation.ts` | **Authoritative (Needs Extension)** | Zero-GC `stepSimulationInPlace()` & immutable `stepSimulation()`, utility-scored activities, `NpcNeeds` + `CharacterEmotion`, spontaneous greeting bubbles, and 2–3 participant `ActiveSocialEncounter`s. Needs controlled gossip propagation during encounters and tier/relationship-aware encounter scoring. |
| **Pure Sim** | `src/game/residents.ts` | **Authoritative** | Dynamic `RESIDENT_ORDER`, `RESIDENTS` definitions, traits, liked items, 4-phase schedules, and `RESIDENT_EXTRA_ACTIVITIES`. No hardcoded 9-resident cap in exports. |
| **Pure Sim** | `src/game/migrations.ts` | **Authoritative** | `CURRENT_SCHEMA_VERSION = 3`, `migrateV1ToV2`, `migrateV2ToV3`, per-field `sanitizeWorldState()`. Solid safety net for additive migration. |
| **Pure Sim** | `src/game/storage.ts` | **Authoritative** | `localStorage` persistence (`little_somewhere_world_v1` + backup), `computeWorldSaveRevision()`, `advanceToNextDay()`. |
| **Pure Sim** | `src/game/environment.ts`, `time.ts`, `rng.ts`, `worldMap.ts`, `navigation.ts`, `playerController.ts`, `audio.ts` | **Authoritative (Stable)** | Deterministic PRNG, unified clock (`360..1290`), 5-layer environment, A* navigation, locomotion/sitting/carrying. Preserve untouched except read-only consumption. |
| **React UI** | `src/components/JournalDrawer.tsx` | **Authoritative (Needs Extension)** | Displays `Neighbors`, `Story & Memories`, and `World & Time` tabs. Currently hardcodes `storyThreads` (5) and `personalThreads` (4) and lacks per-NPC relationship depth, known rumors/memories, and storyline outcomes. |
| **React UI** | `src/components/DialogueSheet.tsx` | **Authoritative (Minor Polish)** | Defensive node lookup fallback, displays heart pips + tier + emotion + tone badges (`Gift` / `Blunt` / `Reply`). Choice filter calls `isChoiceAvailable(c, flags, trust, sideFlags)` without passing full `WorldState` (or memory/tier/storyline state). |
| **React UI** | `src/components/PauseModal.tsx`, `TitleOverlay.tsx`, `VirtualJoystick.tsx`, `src/App.tsx` | **Authoritative (Stable)** | Properly dynamic (`RESIDENT_ORDER.length`). `App.tsx` wires `commitWorld()`, `buildResidentDialogue()`, and `applyDialogueChoice()`. |
| **3D Scene** | `src/scene/NeighborhoodCanvas.tsx` | **Consumer Only** | Reads `worldRef` (`npcRuntime`, `activeEncounters`, `flags`, `worldProps`, `getResidentAvailableQuestCue()`), never owns narrative or relationship rules. Zero structural coupling problems. |
| **Tests** | `src/game/*.test.ts` + `src/scene/environmentRenderer.test.ts` | **Authoritative (49/49 passing)** | Covers collision, schedules, nav, simulation, relationships, dialogue topics/side stories/gifts/amends, environment, player motion, v1/v2/v3 migrations, and bench/fountain geometry. *(Note: current `npm test` already runs cleanly; verified 51/51 prior to compaction.)* |

### 2.2 Detailed Gap & Duplication Findings

#### A. What Already Exists and Works
- Deterministic seeded simulation (`mulberry32` + `hashSeed`), zero-GC `stepSimulationInPlace`, and 28-node A* pathfinding.
- Sequential save migration (`v1 -> v2 -> v3`), corrupt JSON fallback, and `computeWorldSaveRevision()`.
- Daily small-talk affinity cap (`DAILY_SMALLTALK_AFFINITY_CAP = 20`) blocking Day 1 heart-farming exploits while allowing story milestones to award hearts cleanly.
- Anti-repeat topic tracking (`topicHistory` + `lastTopicByResident`), dynamic held-item gift delivery choices, and `make_amends_<residentId>` recovery choices after blunt replies.
- Generalized social suppression (`shouldSuppressNpcSocial`: `affinity < 0 || tension >= 45`).

#### B. What Is Incomplete
1. **Declarative Dialogue Engine (`dialogueEngine.ts` + `narrative.ts`)**:
   - `DialogueCondition` cannot query **NPC memories** (whether this resident witnessed or heard an event/rumor), **storyline state/stage/outcome**, **NPC current activity/posture/location**, or **RelationshipTier** cleanly by name.
   - `DialogueChoice` cannot directly emit structured **NPC memories** (`recordNpcMemory` / `spreadNpcKnowledge`), advance/branch a **Storyline** (`advanceStoryline`), or adjust **NPC-NPC relationships** dynamically across generalized pairs beyond a single fixed `adjustNpcTension` object.
   - `resolveContextFlavorRemark()` only checks `world.worldEvents` on the exact same `world.day` and treats all events as globally known to every NPC.
2. **Relationship Tiers & Progression (`relationships.ts` + `simulation.ts`)**:
   - **Heart / Affinity Divergence on Negative Actions**: `recordPlayerTalkAffinity()` (`relationships.ts:296-298`) keeps `derivedHearts = currentProg.trust` when `isNegative === true`, while subtracting from `affinity`. Meanwhile `sanitizePlayerRelations()` (`migrations.ts:450`) clamps `affinity = Math.max(residents[id].trust * 20, ...)`. If a player has `affinity = 20` (`trust = 1`), triggers a negative reply (`affinity -> 12`), and saves/reloads, sanitization snaps `affinity` right back up to `20`! This silently erases relationship setbacks across reloads.
   - **Shallow Tier Differentiation**: Outside of `tier_close_kindred_bond` (`minAffinity: 60`) and greeting phrasing at `>= 60`, `stranger` (`0-19`), `acquaintance` (`20-39`), `friendly` (`40-59`), `close` (`60-79`), and `kindred` (`80-100`) do not meaningfully modulate NPC willingness to share rumors/secrets, accept favors, initiate friendly proximity chats, or unlock tier-gated topics per resident.
   - **NPC-NPC Relationship Depth**: `NpcNpcRelation` has no tier helper (`estranged`, `guarded`, `acquainted`, `warm`, `close`), minimal organic change from world events (bell restoration, fountain repair, side storyline outcomes only update `clara:arthur` or a single pair), and no shared gossip trust threshold.
3. **NPC Memories, Gossip Propagation & Social Reactions (Core Missing Pillar)**:
   - **Global Omniscience vs. Personal Knowledge**: `world.worldEvents` is treated as shared public knowledge, so `event_bell_celebration` or `event_gift_thanks` (`residentId: 'any'`) causes an isolated NPC who never witnessed the event or spoke with anyone to immediately remark on it.
   - **No Per-NPC Memory Store**: Individual NPCs do not track what *they* personally experienced (`witness` / `player` / `gossip`), with whom, how reliable the source was (`firsthand` vs `secondhand` vs `rumor`), whether it caused a slight misunderstanding, or whether they already told the player about it.
   - **No Gossip Mechanics During `npc_social`**: `stepSimulationInPlace()` (`simulation.ts:776-902`) creates encounters and increments `npcRelations` affinity, but participants never exchange memories/news with **trust gating, cooldowns, hop/spread limits, and deduplication**.
4. **Personal Storylines & Interconnected Conflicts**:
   - The 4 side stories (`pipZine`, `herbLoaf`, `pondStand`, `watchTune`) are just two hardcoded `makeSimpleTopic` objects flipping two booleans in `sideFlags` (`*Started` -> `*Printed`/`*Shared`/`*Built`/`*Finished`). They have **zero branching, zero alternative outcomes, zero conflict/friction points, zero connection to other residents' reactions, and zero cooldown/stage model**.
   - Interconnected conflicts only cover 2 standalone choices (`conflict_arthur_clara_tension`, `conflict_barnaby_arthur_rafters`) with no multi-beat escalation/resolution or connection to town gossip/NPC memories.
5. **Journal & Narrative History (`JournalDrawer.tsx`, `DialogueSheet.tsx`)**:
   - `JournalDrawer.tsx` hardcodes `storyThreads` and `personalThreads` inside the React component (`lines 35–107`).
   - Resident cards show `tierLabel`, `emotionLabel`, and `Reliability %` (the latter reads slightly technical/telemetry-like!), but show **nothing about what that neighbor remembers, values, or recently shared**, nor their notable bonds with other neighbors.
   - Story & Memories tab mixes raw `worldEvents.slice(0, 5)` without grouping, storyline outcome text, or neighbor reactions/gossip context.

#### C. Confirmed Duplications & Mismatches
1. **Duplicate `arthur_restore_bell` Choice (`narrative.ts:346-375` vs `682-730`)**: Both `buildConcurrentQuestChoices('arthur', world)` and `quest_arthur_bell.build()` construct `arthur_restore_bell` + `arthur_restores` independently. Because `selectDialogueSession()` deduplicates by `id` with `unshift()`, the concurrent copy masks the topic copy—creating a maintenance trap if one is edited without the other.
2. **Choice Availability Signature Drift**: `isChoiceAvailable(choice, flags, trust, sideFlags)` in `DialogueSheet.tsx:114` and `actions.ts:46` takes fragmented arguments rather than evaluating full context (`WorldState` / `residentId`), meaning choices cannot cleanly check `memories`, `playerRelations.affinity`, `storylines`, or `npcMemories`.
3. **Premature Completion Claim (`HANDOVER.md:4`)**: States *"Milestone 2B + Player & Character Excellence Upgrade Complete"*, whereas `docs/audits/08-milestone-2b-readiness.md` Workstreams 4–8 (relationship-gated per-resident depth, generalized gossip propagation, multi-beat branching personal storylines, and rich Journal history) remain partially implemented.

---

## 3. System Dependencies & Data-Flow Architecture

### 3.1 Dependency Graph (Unidirectional)
```
types.ts  <── rng.ts / time.ts / worldMap.ts / residents.ts
   ▲
   ├── relationships.ts   (Player<->NPC & NPC<->NPC tiers, affinity/trust sync, reliability)
   ├── memories.ts [NEW]  (Per-NPC personal/witnessed/gossip memories, spread & distortion rules)
   ├── storylines.ts [NEW] (Declarative Storyline definitions, stages, outcomes & journal projections)
   │
   ├── simulation.ts      (Autonomous routines, ActiveSocialEncounters, controlled gossip exchange)
   ├── dialogueEngine.ts  (Condition evaluator, topic scoring, choice availability, dynamic hooks)
   ├── narrative.ts       (Topic pools: Main Bell Arc, Storylines, Conflicts, Gossip, Tier/Trait slices)
   └── actions.ts         (Pure state reducers: applyDialogueChoice -> flags, relations, npcMemories, storylines, memories)
         ▲
         │
   migrations.ts & storage.ts (Sanitization, v1->v2->v3->v4 migration, save revision hash)
         ▲
         │
   App.tsx / DialogueSheet.tsx / JournalDrawer.tsx / NeighborhoodCanvas.tsx (UI & 3D projection)
```

### 3.2 Target Runtime Data Flow
```
  [Simulation Tick / Player Action]
           │
           ├──▶ NPC-to-NPC Encounter (simulation.ts)
           │      └─ checks NPC<->NPC tier/affinity + gossip cooldown + hop limit
           │      └─ propagates 0–1 eligible NpcMemory (with source, day, possible flavor distortion)
           │      └─ updates NpcNpcRelation + emits bounded WorldEventRecord
           │
           ├──▶ Player Talks to Resident (App.tsx -> narrative.ts -> dialogueEngine.ts)
           │      └─ evaluates DialogueCondition (flags, tier, reliability, npcMemories, storyline stage, weather/phase)
           │      └─ selects highest-priority non-repeating topic + injects concurrent storyline/quest/gift/amends choices
           │
           └──▶ Player Picks Choice (actions.ts: applyDialogueChoice)
                  ├─ updates PlayerNpcRelation + synchronized trust hearts
                  ├─ updates NpcNpcRelation (mediation / taking sides / shared warmth)
                  ├─ advances Storyline progress (stage / alternative outcome) & syncs legacy sideFlags
                  ├─ records NpcMemory for speaker (and close nearby witness if applicable)
                  └─ unlocks player JournalMemory + WorldEventRecord -> persisted via storage.ts
```

---

## 4. Save Compatibility & Schema Assessment

### 4.1 Current Migration Pipeline (`src/game/migrations.ts`)
- `CURRENT_SCHEMA_VERSION = 3` supports `v1 -> v2 -> v3` cleanly with per-field sanitization (`sanitizeWorldState`), non-walkable coordinate clamping, and rolling backup (`little_somewhere_world_v1_backup`).
- `computeWorldSaveRevision()` hashes every persisted field in `WorldState` cleanly for dirty autosave detection.

### 4.2 Can Milestone 2B Fit Inside Existing `v3` Fields vs. Additive Schema Evolution?
**Honest Assessment**:
- `DialogueTopic` improvements (Phase 1) and bidirectional Relationship Tier progression logic (Phase 2) require **zero new top-level `WorldState` fields** (aside from fixing the `affinity` vs `trust * 20` clamp in `sanitizePlayerRelations` so legitimate negative affinity setbacks persist across reloads).
- However, **Phase 3 (Per-NPC Memories & Gossip)** and **Phase 4 (Multi-Stage Personal Storylines with Alternative Outcomes)** **cannot cleanly fit inside existing `v3` structures without abuse**:
  - Packing structured per-NPC memories (`source`, `learnedDay`, `accuracy`, `sharedWithPlayer`, `subjectResidents`) into `sideFlags: Record<string, boolean | number | string>` would require string-encoded JSON blobs—fragile, untyped, and hard to sanitize.
  - Using `sideFlags` alone for multi-stage, multi-outcome storylines makes declarative stage queries, alternative outcome tracking, and dynamic Journal projection brittle.

### 4.3 Proposed Backward-Compatible Schema Extension (Requires Explicit User Approval)
We propose advancing cleanly to **`CURRENT_SCHEMA_VERSION = 4`** (`migrateV3ToV4`), while preserving **100% of `v1`, `v2`, and `v3` fields** (including `sideFlags`, `flags`, `memories`, `topicHistory`, `playerRelations`, `npcRelations`):

1. **New Bounded Top-Level Field on `WorldState` — `npcMemories`**:
   ```ts
   export type NpcMemorySource = 'witness' | 'player' | 'gossip';
   export type NpcMemoryAccuracy = 'firsthand' | 'secondhand' | 'rumor';
   export type NpcMemoryValence = 'warm' | 'neutral' | 'tense';

   export interface NpcMemoryEntry {
     id: string;                      // canonical memory key e.g. 'ev_bell_restored' or 'gossip_craft_dispute'
     tag: string;                     // semantic topic tag e.g. 'bell_restored', 'herb_loaf', 'blunt_remark'
     summary: string;                 // concise neighbor-perspective phrasing
     day: number;                     // day event occurred or memory originated
     learnedDay: number;              // day this NPC learned it
     source: NpcMemorySource;
     accuracy: NpcMemoryAccuracy;     // 'rumor' allows mild personality-tinted distortion
     valence: NpcMemoryValence;
     subjectResidents: ResidentId[];  // residents involved in the memory
     fromResidentId?: ResidentId;     // who shared it (if source === 'gossip')
     hopCount: number;                // 0 = direct witness/player, 1..2 = gossip hops (capped)
     importance: number;              // 1..5 (decays/evicts lowest importance oldest entries)
     mentionedToPlayer: boolean;      // prevents repeating the exact same rumor to player endlessly
   }
   // Added to WorldState:
   npcMemories: Record<ResidentId, NpcMemoryEntry[]>; // bounded <= 12 entries per resident
   ```

2. **New Bounded Top-Level Field on `WorldState` — `storylines`**:
   ```ts
   export type StorylineStatus = 'locked' | 'available' | 'active' | 'completed';

   export interface StorylineProgress {
     id: string;
     stage: number;                   // 0..N
     status: StorylineStatus;
     outcome?: string;                // e.g. 'shared_plaza', 'nora_archive', 'compromise', 'cooled_off'
     startedDay?: number;
     updatedDay?: number;
     completedDay?: number;
     cooldownUntilDay?: number;
     notes?: string[];                // bounded milestone log tags (<= 6) for Journal projection
   }
   // Added to WorldState:
   storylines: Record<string, StorylineProgress>;
   ```

3. **Minor Additive Optional Fields on `NpcNpcRelation` (Safe Defaulted)**:
   - `lastGossipDay?: number | null;` (prevents the same pair from swapping gossip every single encounter on the same day).
   - `gossipTopicTag?: string;` (lightweight memory of last shared rumor context).

4. **Migration & Backward Compatibility Rules (`v1 -> v2 -> v3 -> v4`)**:
   - **Existing `v1`, `v2`, and `v3` saves** migrate sequentially to `v4`:
     - `migrateV3ToV4()` preserves every existing field untouched.
     - `npcMemories` initializes cleanly per `RESIDENT_ORDER` (`createInitialNpcMemories()`), optionally seeding 1–2 lore-consistent baseline memories from existing `flags` (e.g., if `bellRestored` is already `true` in a v3 save, participants remember it; if `claraArthurReconciled` is `false`, Clara & Arthur hold the `'gazebo_rift'` memory).
     - `storylines` hydrates seamlessly from existing `sideFlags` (`pipZineStarted`/`pipZinePrinted`, `herbLoafStarted`/`herbLoafShared`, `pondStandStarted`/`pondStandBuilt`, `watchTuneStarted`/`watchTuneFinished`) so **no mid-storyline player loses progress**.
     - `sideFlags` continues to be synced bidirectionally on storyline transitions so **all existing Milestone 2A/Character Excellence tests and external assumptions pass unchanged**.
   - **Sanitization Fix (`sanitizePlayerRelations`)**:
     - Allow `affinity` (`0..100`) to remain faithful when negative choices lowered it slightly below `trust * 20` (still deriving `trust` or allowing gentle downward trust sync cleanly as defined in Phase 2), rather than silently snapping `affinity` upward on reload.
   - **`computeWorldSaveRevision()`**: Updated to hash `npcMemories` and `storylines` deterministically.

> **Approval Gate Notice**: Schema changes (`CURRENT_SCHEMA_VERSION = 4`, `npcMemories`, `storylines`, and `sanitizePlayerRelations` affinity preservation) will **not** be implemented until you explicitly approve this design.

---

## 5. Phase-by-Phase Target Architecture (Phases 1–5)

### Phase 1 — Declarative Dialogue Engine Audit & Consolidation
- **Files**: `src/game/types.ts`, `src/game/dialogueEngine.ts`, `src/game/narrative.ts`, `src/components/DialogueSheet.tsx`, `src/game/actions.ts`, `src/game/dialogue.test.ts`.
- **Upgrades**:
  1. **Eliminate Duplication**: Remove duplicate `arthur_restore_bell` / `arthur_restores` logic between `buildConcurrentQuestChoices()` and `quest_arthur_bell` by sourcing concurrent quest options cleanly or keeping a single authoritative definition.
  2. **Richer Declarative `DialogueCondition` & Choice Evaluation**:
     - Extend `DialogueCondition` with `minTier?: RelationshipTier`, `maxTier?: RelationshipTier`, `requiresNpcMemoriesAny?: string[]` (tags), `excludesNpcMemories?: string[]`, `requiresStoryline?: { id: string; status?: StorylineStatus[]; minStage?: number; maxStage?: number; outcome?: string }`, `requiresPosture?: PlayerPosture[]`, `requiresWeatherNot?: WeatherType[]`.
     - Upgrade `isChoiceAvailable()` to accept optional `WorldState` + `residentId` (keeping backward compatibility with existing `(choice, flags, trust, sideFlags)` callers/tests!) so choices can also check `minAffinity`, `requiresStorylineStage`, or `requiresNpcMemoryTag`.
  3. **Author Context Without Omniscience**:
     - Remove global `world.worldEvents` inspection from `resolveContextFlavorRemark()` (or scope it only to events where `actors.includes(id)` until Phase 3 wires `npcMemories`).
  4. **Dynamic Spoken-Name / Personality Helpers**: Ensure `DialogueTopic` definitions scale for any resident registered in `RESIDENTS` / `RESIDENT_ORDER` without hardcoding resident count 9.

### Phase 2 — Relationship Tiers, Progression & Meaningful Consequences
- **Files**: `src/game/relationships.ts`, `src/game/simulation.ts`, `src/game/dialogueEngine.ts`, `src/game/narrative.ts`, `src/game/migrations.ts`, `src/game/relationships.test.ts`.
- **Upgrades**:
  1. **Coherent Bidirectional Progression (`Player <-> NPC`)**:
     - Keep `affinity` (`0..100`) as the authoritative continuous score and define clean **Tier Thresholds**:
       - `stranger` (`0–19`, 0 hearts)
       - `acquaintance` (`20–39`, 1 heart)
       - `friendly` (`40–59`, 2 hearts)
       - `close` (`60–79`, 3 hearts)
       - `kindred` (`80–100`, 4–5 hearts)
     - Fix the negative-reply reload mismatch: negative replies reduce `affinity` and `reliability` realistically, and if `affinity` drops below a tier floor (while protecting hard story-completed milestones from softlock), `trust` / `tier` reflects that setback accurately and can be repaired sincerely via `make_amends` or thoughtful gifts/kindness.
     - Keep daily non-milestone small-talk capping (`DAILY_SMALLTALK_AFFINITY_CAP = 20`) intact.
  2. **NPC-to-NPC Relationship Tiers & Dynamics**:
     - Add `NpcRelationTier = 'estranged' | 'guarded' | 'acquainted' | 'warm' | 'confidant'` (`getNpcRelationTier(rel)`), factoring both `affinity` and `tension`.
     - Deepen social encounter affinity/tension shifts based on compatibility and recent shared context.
  3. **Concrete Gameplay & Behavioral Consequences of Tiers**:
     - **Autonomous Greetings & Bubble Warmth (`simulation.ts`)**: `stranger`s keep polite distance/formal greeting (especially low-sociability residents like Arthur/Toby); `friendly`+ neighbors greet sooner and warmly; `close`/`kindred` neighbors express personal warmth and share vulnerable thoughts.
     - **Social Willingness & Guardedness**: At low `reliability` (`< 20`) or post-negative emotion (`frustrated`/`angry`), neighbors give terse dialogue until amends or time cools tension; at `friendly` (`>= 40`) and `close` (`>= 60`), deeper personal topics, gossip sharing, and personal storyline beats unlock cleanly.
     - **Per-Resident Tier Topics (`narrative.ts`)**: Add tier-reflective dialogue pools (`acquaintance` -> `friendly` -> `close`/`kindred`) tailored to resident temperaments (`gentle`, `spirited`, `contemplative`, `industrious`, `whimsical`).

### Phase 3 — NPC Memories, Controlled Gossip Propagation & Social Reactions
- **Files**: `src/game/memories.ts` [NEW], `src/game/types.ts`, `src/game/migrations.ts`, `src/game/simulation.ts`, `src/game/actions.ts`, `src/game/dialogueEngine.ts`, `src/game/narrative.ts`, `src/game/storage.ts`, `src/game/memories.test.ts` [NEW].
- **Core Design Rules**:
  1. **Per-NPC Bounded Memory Store (`npcMemories[id]`, max 12)**:
     - Recorded when:
       - An NPC directly participates in or is nearby (`<= 8.5m`) during a notable event (`story_flag`, `bell_ring`, `player_help`, `storyline_beat`, `conflict_shift`).
       - The player tells them something in dialogue (choice effect `recordMemories`).
       - Another NPC gossips with them during an `ActiveSocialEncounter`.
     - Bounded eviction: keeps highest `importance` and most recent `learnedDay`, preventing unbounded save growth.
  2. **Controlled Gossip Propagation (`propagateGossipDuringEncounter`)**:
     - Runs deterministically (seeded via `simSeed`, `day`, encounter ID) inside `simulation.ts` when an `ActiveSocialEncounter` forms between eligible residents `A` and `B` (and optional `C`):
       - **Relationship Gate**: Requires `relAB.affinity >= 22` and `relAB.tension < 30` (guards/estranged neighbors don't swap intimate gossip).
       - **Cooldown Gate**: Pair cooldown (`lastGossipDay !== world.day`, or >= 1 day / min encounter gap) prevents spamming.
       - **Hop & Spread Cap**: Only memories with `hopCount < 2` (or `hopCount < 1` for private/sensitive items) can spread; max **1 memory transferred per encounter** so news ripples naturally across days rather than exploding globally in 10 minutes.
       - **Deduplication**: Never re-add a memory `id` the listener already holds.
       - **Personality Coloring & Mild Misunderstandings**: When `accuracy` shifts from `firsthand` -> `secondhand` -> `rumor` (e.g., high-curiosity / spirited residents like Pip or Jun embellish slightly, or low-affinity listeners misread motive when tension exists), a subtle rumor variant/summary is stored—allowing the player to notice or clarify misunderstandings!
  3. **Differentiated Social Reactions in Dialogue**:
     - Replace omniscient `'any'` event triggers (`event_gift_thanks`, `event_bell_celebration` checking `world.worldEvents`) with **NPC-memory-driven reactions** (`requiresNpcMemoriesAny` / `unmentionedNpcMemory`):
       - Neighbors who **witnessed** or **learned** an event via gossip react differently based on `source` (`"I saw..."` vs `"Jun mentioned earlier..."`), `accuracy` (`rumor` uncertainty), their `traits.temperament`, and their `NpcNpcRelation` / `PlayerNpcRelation` to the actors involved.
       - Once an NPC mentions a memory to the player (`mentionedToPlayer: true`), they won't repeat the same rumor again.

### Phase 4 — Declarative Personal Storylines & Interconnected Conflicts
- **Files**: `src/game/storylines.ts` [NEW], `src/game/narrative.ts`, `src/game/actions.ts`, `src/game/types.ts`, `src/game/migrations.ts`, `src/game/storylines.test.ts` [NEW].
- **Core Design Rules**:
  1. **Reusable Declarative `StorylineDefinition` Schema**:
     ```ts
     export interface StorylineStageDef {
       stage: number;
       title: string;
       journalHint: string;
       involvedResidents: ResidentId[];
       unlockCondition?: DialogueCondition;
     }

     export interface StorylineDefinition {
       id: string;
       title: string;
       subtitle: string;
       leadResidents: ResidentId[];
       category: 'personal_story' | 'interconnected_conflict';
       stages: StorylineStageDef[];
       outcomes: Record<string, { label: string; journalSummary: string }>;
     }
     ```
  2. **Upgrade the 4 Existing Personal Storylines + Expand Into Multi-Stage Interconnected Arcs** (preserving existing `sideFlags` & `JournalMemory` IDs):
     - **Arc 1 — Pip & Nora's *Willow Lane Zine*** (`side_pip_zine`): Expand to support Stage 1 (Pip's idea, unlocks with `friendly`/trust 1), Stage 2 (collecting a sketch/story contribution from **Toby** *or* recipe lore from **Clara** — player choice shapes the zine's theme!), Stage 3 (Nora prints Issue #1 with chosen theme outcome `'art_edition'` vs `'kitchen_edition'`, rippling into NPC memories and `clara:pip` or `toby:pip` affinity).
     - **Arc 2 — Mina & Clara's *Seasonal Herb & Hearth*** (`side_herb_loaf`): Multi-stage collaboration with alternative outcome (baking **plaza sharing table** vs **cozy greenhouse tea basket**), affecting `clara:mina` and town memories.
     - **Arc 3 — Barnaby & Sora's *Pond Acoustic Stand*** (`side_pond_stand`): Multi-stage craft & acoustic testing with Barnaby/Sora (and optional Toby/Pip sketch/music reaction), with outcome differences (`'carved_clef'` vs `'weatherproof_oak'`).
     - **Arc 4 — Jun & Arthur's *Courier Pocket Watch & Route Tension*** (`side_jun_watch`): Multi-stage arc connecting Jun's missed postcard guilt (`jun:nora` & `jun:arthur` tension if the player earlier scolded Jun vs reassured him!) to Arthur calibrating the escapement and restoring Jun's confidence.
  3. **Interconnected Social Conflict Arc (`conflict_square_lanterns` or expanded `arthur:barnaby` / `clara:arthur` / `jun:nora`)**:
     - Structured multi-stage conflict resolution using `storylines` + `NpcNpcRelation.tension` + `npcMemories`:
       - Tension rises or cools based on player choices (empathy/compromise vs blunt taking-sides vs quiet mediation).
       - Alternative resolution outcomes (`'bridge_compromise'`, `'gentle_space'`, `'public_harmony'`) lock cleanly, update `NpcNpcRelation`, record differentiated `npcMemories` across involved residents, and alter how participants speak about each other afterward.

### Phase 5 — Journal & Narrative History Integration
- **Files**: `src/components/JournalDrawer.tsx`, `src/components/DialogueSheet.tsx`, `src/App.tsx`, `src/game/storylines.ts`.
- **Upgrades (Respecting Storybook Design & Mobile `390×844` Ergonomics)**:
  1. **Neighbors Tab (`JournalDrawer.tsx`)**:
     - Replace telemetry-sounding `"Reliability 25%"` with natural cozy storybook trust phrasing (e.g., `"Steady friend"` / `"Warming up"` / `"Still hesitant"` via `getReliabilityLabel(reliability)`).
     - Display concise **Relationship Tier**, **Current Mood/Activity**, **Closest Neighbor Bonds** (derived dynamically from `npcRelations`), and **"What They Remember / Latest Impression"** (top 1–2 `npcMemories[id]` entries, or `"Still getting to know the lane"` if none yet).
     - Dynamic story waiting cue derived from `getResidentAvailableQuestCue()` + active storyline stages.
  2. **Story & Memories Tab (`JournalDrawer.tsx`)**:
     - Derive **Personal Stories & Conflicts** dynamically from `STORYLINES` + `world.storylines` (eliminating hardcoded `personalThreads` inside React!), showing active stage hints, branching outcomes once completed, and involved residents dynamically.
     - Organize **Recorded Memories & Narrative History** cleanly (Story Milestones, Personal Memories, and Curated Neighborhood Chronicle filtered/grouped meaningfully rather than an ungrouped raw slice).
  3. **World & Time Tab (`JournalDrawer.tsx`)**:
     - Keep Season, Sky, Forecast, Flyer/Greenhouse progress, and expand *Recent Lane Moments* with readable phase/day formatting and actor context.
  4. **DialogueSheet Context (`DialogueSheet.tsx`)**:
     - Pass full `(choice, world, residentId)` to `isChoiceAvailable()` so memory/tier/storyline-gated replies evaluate accurately.
     - Keep clean unboxed metadata (`Role · Emotion · Tier`) with zero SaaS pills and >= 44px mobile touch targets.

---

## 6. Extensibility & Population Rules Compliance

- **No Fixed 9-Resident Assumptions**:
  - `npcMemories`, `storylines`, `playerRelations`, `npcRelations`, `DIALOGUE_TOPICS`, gossip pairing, and Journal cards iterate `RESIDENT_ORDER` / `RESIDENTS` dynamically.
  - Adding a 10th or 20th resident in Milestone 3+ will automatically initialize `npcMemories[newId] = []`, participate in gossip when eligible, and render in `JournalDrawer` without UI or engine rewrites.
- **No Population Expansion During Milestone 2B**: Cast remains strictly the 9 prototype residents (`clara`, `arthur`, `mina`, `jun`, `barnaby`, `sora`, `toby`, `nora`, `pip`).

---

## 7. Risks, Mitigations & Testing Strategy

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **Regression on *The Silent Gazebo Bell* or existing v3 features** | Could break main storyline, `make_amends`, gifts, or existing 49 tests | Preserve every existing `StoryFlags` field, choice ID, `JournalMemory` ID, and `sideFlags` key; run golden backward-compatibility assertions inside `dialogue.test.ts` & `engine.test.ts` after every phase. |
| **Save Corruption / Reload Divergence (`v1/v2/v3 -> v4`)** | Players lose progress or `affinity`/`trust` resets on reload | Implement pure sequential `migrateV3ToV4()`, hydrate `storylines` from existing `sideFlags`, preserve `affinity` accurately in `sanitizePlayerRelations()`, and test `v1`, `v2`, `v3`, and corrupt JSON round-trips in `storage.test.ts`. |
| **Gossip Explosion / Spammy Repetitive Rumors** | All 9 NPCs repeat the exact same rumor within 30 seconds | Enforce affinity/tension gate, per-pair daily gossip cooldown, max `hopCount < 2`, max 1 rumor per encounter, and `mentionedToPlayer` flag locking once shared. |
| **Software WebGL / Tick Allocation Stutters** | Frame drops during `stepSimulationInPlace` or React Journal opens | Keep `stepSimulationInPlace()` allocation-light inside hot paths (only allocate on discrete encounter/gossip edges), never add `backdrop-blur` in UI, and test live Chromium at `1440×900` and `390×844`. |

### Automated Verification Per Phase
1. **`npm test`**: Expand `node:test` (`tsx --test src/game/*.test.ts src/scene/*.test.ts`) at each phase:
   - Phase 1: Condition evaluator, memory/storyline predicates, zero broken `nextNodeId`, zero duplicate quest choices.
   - Phase 2: Bidirectional tier progression, negative/amends reload preservation, NPC-NPC tier helpers, behavioral differences by tier.
   - Phase 3: Per-NPC memory bounds/eviction, deterministic gossip propagation respecting trust/cooldown/hop limits, rumor distortion, non-omniscient reactions.
   - Phase 4: Declarative storyline stage advancement, alternative outcomes, `sideFlags` backward sync, multi-stage conflict resolution.
   - Phase 5: Dynamic Journal projection helpers + `v1/v2/v3 -> v4` migration coverage + full `computeWorldSaveRevision()` coverage.
2. **`npm run lint`** (`tsc --noEmit`) and **`npm run build`** (`vite build`) after every phase.
3. **Headless Chromium Verification** (`1440×900` desktop + `390×844` mobile, `0` console errors/warnings) on UI/integration phases (Phase 1/5) and final sign-off.

---

## 8. Approval Request

Before editing any implementation files or starting **Phase 1**, please confirm approval of:
1. **Audit findings & phased plan** (Phases 1 -> 2 -> 3 -> 4 -> 5, executed sequentially with verification and stop-for-approval after each phase).
2. **Proposed `WorldState` schema evolution (`v3 -> v4`)**:
   - Adding bounded `npcMemories: Record<ResidentId, NpcMemoryEntry[]>` and `storylines: Record<string, StorylineProgress>` (plus optional `lastGossipDay` / `gossipTopicTag` on `NpcNpcRelation`), migrated cleanly from `v1`/`v2`/`v3` with bidirectional `sideFlags` preservation and accurate `affinity` persistence across reloads.
