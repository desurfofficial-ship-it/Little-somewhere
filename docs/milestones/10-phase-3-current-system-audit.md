# 10 — Milestone 2B Phase 3: Current System Audit (Memories, Events & Gossip)

**Status**: Architecture & Investigation Complete (No Implementation Changes)  
**Target Milestone**: Milestone 2B — Phase 3: NPC Memories & Gossip  
**Baseline Verified**: `WorldState` `schemaVersion: 3` (`src/game/migrations.ts:53`), `66/66` tests passing (`npm test`), `0` TypeScript errors (`npm run lint`), `vite build` clean, `33`-node A* navigation, `9` founding residents (`RESIDENT_ORDER`).

---

## 1. Executive Audit Summary

The current codebase already contains rich simulation, relationship, dialogue, and event foundations from Milestone 2A and Milestone 2B Phases 1–2, plus explicit forward-compatibility stubs (`ForwardWorldHooks` in `src/game/dialogueEngine.ts:40-43`). However, **NPCs still share an omniscient global view of world events and third-party player relationships**:

- Every memory stored today (`world.memories: JournalMemory[]`) belongs strictly to the **player's Pocket Journal**.
- `world.worldEvents: WorldEventRecord[]` acts as an un-scoped global log read identically by every resident in town (`evaluateDialogueCondition` in `src/game/dialogueEngine.ts:298-319`).
- Third-party gossip (`selectThirdPartyGossipSubject` in `src/game/dialogueEngine.ts:73-127`) reads player affinity and resident emotion directly from global state without checking whether the speaker witnessed an event or heard it from another resident.
- Autonomous `ActiveSocialEncounter` sessions (`src/game/simulation.ts:830-973`) adjust `NpcNpcRelation` affinity/tension and emit `npc_social` events, but participants do not exchange memories, impressions, or rumors.

---

## 2. Inventory & Classification of Existing Memory-Related Mechanisms

To prevent conceptual conflation in Phase 3, every existing mechanism in `WorldState` (`src/game/types.ts:313-342`) is audited and classified below into one of five distinct system categories.

### 2.1 Existing Mechanisms in the Codebase

| Mechanism | Source Definition | Bounded? | Current Consumer(s) | Semantic Classification |
| :--- | :--- | :--- | :--- | :--- |
| **`world.flags: StoryFlags`** | `types.ts:119-133` (12 booleans + `mediationStyle`) | Fixed (13 fields) | `computeEnvironmentState`, `narrative.ts`, `actions.ts`, `simulation.ts`, `JournalDrawer.tsx` | **Permanent Narrative Milestone** (canonical world & story state) |
| **`world.sideFlags`** | `types.ts:336` (`Record<string, boolean \| number \| string>`) | Unbounded key map; currently 10 keys (8 arc booleans + `fountainWishesCount`, `pondPebblesSkipped`) | `narrative.ts`, `actions.ts`, `JournalDrawer.tsx` | **Permanent Narrative Milestone / Activity Counter** (prototype side arcs + landmark counts) |
| **`world.memories: JournalMemory[]`** | `types.ts:146-153` (`id`, `day`, `phase`, `title`, `summary`, `residentId?`) | Unbounded array; currently 18 canonical `mem_*` IDs | `actions.ts`, `JournalDrawer.tsx`, `App.tsx` (toast/save check) | **Player Journal Scrapbook** (permanent player-facing narrative keepsake — **not** per-NPC memory) |
| **`world.worldEvents: WorldEventRecord[]`** | `types.ts:257-266` (`kind`, `actors`, `summary`, `summaryTag`, `day`, `phase`, `minuteOfDay`) | Capped ring buffer (`MAX_WORLD_EVENTS = 40`, `relationships.ts:19, 469-478`) | `dialogueEngine.ts`, `simulation.ts`, `actions.ts`, `environment.ts`, `JournalDrawer.tsx` | **Global Town Event Chronicle** (currently misused as omniscient NPC awareness) |
| **`world.topicHistory` & `lastTopicByResident`** | `types.ts:286-291, 334-335` | Keyed per topic or `${residentId}:${topicId}`; `chosenChoiceIds` capped at 8 (`actions.ts:181`) | `dialogueEngine.ts`, `actions.ts` | **Conversation Anti-Repeat State** (UI/dialogue pacing metadata) |
| **`world.npcActivityHistory`** | `types.ts:268-274, 333` | Ring buffer (`MAX_ACTIVITY_HISTORY_PER_RESIDENT = 8`, `relationships.ts:20`) | `simulation.ts`, `migrations.ts` | **Schedule Audit Log** (recent places/activities per NPC; unused by dialogue) |
| **`world.npcRelations`** | `types.ts:249-255` (`pair`, `affinity`, `tension`, `sharedTags`, `lastInteractionDay`) | Sparse map; `sharedTags` capped at 6 (`relationships.ts:271, 435`) | `relationships.ts`, `simulation.ts`, `dialogueEngine.ts`, `actions.ts` | **Pairwise Relationship State** (`sharedTags` acts as coarse long-term bond memory) |
| **`world.playerRelations`** | `types.ts:230-245` (`affinity`, `familiarity`, `reliability`, `negativeCount`, `favorsCompleted`, `giftsGiven`, `mood`, `moodUntilMinute`, `lastEmotion`) | Fixed per resident in `RESIDENT_ORDER` | `relationships.ts`, `dialogueEngine.ts`, `simulation.ts`, `JournalDrawer.tsx` | **Player-to-NPC Relationship + Short-Term Mood Timer** |
| **`npcRuntime[id]` social/emotion fields** | `types.ts:185-214` (`emotion`, `emotionUntilMinute`, `activeBubbleText`, `activeBubbleUntilMinute`, `lastGreetedPlayerMinute`, `socialCooldownUntilMinute`) | Fixed per resident; ephemeral/day-reset in `advanceToNextDay()` | `simulation.ts`, `dialogueEngine.ts`, `NeighborhoodCanvas.tsx` | **Temporary Social Impression / Live Affect** (35–90 min hysteresis locks; resets overnight) |
| **`ForwardWorldHooks.npcMemories`** | `dialogueEngine.ts:40-43, 321-339` (`Array<{ id: string; tag: string }>`) | Stub only (not in `WorldState v3`) | `dialogueEngine.ts` + synthetic unit test in `dialogue.test.ts:489-528` | **Forward Hook** for `requiresNpcMemoriesAny` / `excludesNpcMemories` |

### 2.2 Conceptual Separation Matrix (Non-Negotiable Boundaries)

Phase 3 must keep these five concepts strictly separate:

1. **Permanent Narrative Milestone** (`StoryFlags`, `JournalMemory`, future Phase 4 `StorylineProgress`): Authoritative truth of the neighborhood's story state (e.g., whether the Gazebo Bell is restored or Clarissa/Arthur reconciled). Never decays, never distorts, and drives `computeEnvironmentState()`.
2. **Personal NPC Memory (`provenance: 'firsthand'`)**: An individual resident's subjective record of an event they participated in, witnessed within sight/hearing range, or heard directly from the player. Durable or permanent based on personal importance; immune to gossip-distortion corruption.
3. **Knowledge About Another Character / Bond**: What an NPC understands about the player or a third party (e.g., observing friction, warmth, or shared interests). Must be backed by direct experience or received social information—never global `world.playerRelations` reads.
4. **Secondhand Information / Rumor (`provenance: 'secondhand' | 'rumor'`)**: Social information learned from another resident during an encounter. Carries explicit source attribution (`fromResidentId`, `originResidentId`, `hopCount`), lower confidence, potential restrained distortion, and bounded expiration.
5. **Temporary Social Impression / Mood**: Short-lived emotional reaction (`CharacterEmotion` + `emotionUntilMinute`, `isResidentGuarded`, `moodUntilMinute`) that colors immediate greetings and body language without rewriting long-term memory or story truth.

---

## 3. Audit of Existing Gossip & Event-Reaction Systems

### 3.1 `npc_gossip` Topics (`src/game/narrative.ts:1126-1481`)

There are currently **7** topics in the `npc_gossip` category (`CATEGORY_PRIORITY.npc_gossip = 48`):

1. **2 NPC-to-NPC Bond Gossip Topics** (`narrative.ts:1127-1182`):
   - `gossip_clara_mina_loaves` (`clara`): Requires `minNpcAffinity: { a: 'clara', b: 'mina', min: 55 }`.
   - `gossip_pip_toby_pond` (`toby`): Requires `minNpcAffinity: { a: 'pip', b: 'toby', min: 45 }`.
   - *Assessment*: Grounded in each speaker's own direct relationship (`clara` talking about `mina`, `toby` talking about `pip`). **Non-omniscient and worth preserving.**
2. **4 Hardcoded Player-Relation Gossip Topics** (`narrative.ts:1185-1304`):
   - `gossip_jun_clara_bond` (`jun`): Requires `playerRelationWith: { residentId: 'clara', minTier: 'friendly' }`.
   - `gossip_sora_mina_bond` (`sora`): Requires `playerRelationWith: { residentId: 'mina', minTier: 'friendly' }`.
   - `gossip_nora_arthur_bond` (`nora`): Requires `playerRelationWith: { residentId: 'arthur', minTier: 'close' }`.
   - `gossip_barnaby_pip_acquaintance` (`barnaby`): Requires `playerRelationWith: { residentId: 'pip', minTier: 'acquaintance', maxTier: 'friendly' }`.
   - *Assessment*: Narrative framing explicitly references direct observation or close-friend sharing (*"Mina tucked two extra sprigs... she says..."*, *"Pip hopped right up to my sawhorse earlier..."*), yet condition evaluation (`dialogueEngine.ts:234-252`) only checks global `playerRelationWith` and never verifies whether the speaker actually learned about it or spoke with the subject.
3. **1 Dynamic Third-Party Player Gossip Topic** (`gossip_third_party_relation`, `narrative.ts:1306-1481`, powered by `selectThirdPartyGossipSubject` in `dialogueEngine.ts:73-127`):
   - Triggered when `{ requiresThirdPartyGossip: true, notSeenToday: true }`.
   - *How it works today*: Iterates `RESIDENT_ORDER`, skips `speakerId`, skips un-met strangers with `affinity < 40`, scores candidates by guardedness (`120`) or tier (`100` kindred -> `30` stranger), adds `+12` if `npcRel.affinity >= 45` between speaker and `otherId`, plus a deterministic day/index tiebreaker (`0.25` step).
   - *Why it is currently omniscient*: Every resident in town—including an isolated resident who has never had an `ActiveSocialEncounter`, never stood near the player and `otherId`, and holds `npcRel.affinity` at neutral—immediately knows when the player was blunt to `otherId` or reached `kindred` with `otherId`. Furthermore, `gossip_third_party_relation` has `historyScope` defaulting to `'resident'` (`${residentId}:gossip_third_party_relation`), so the speaker does not distinguish *which* neighbor they already discussed or whether they heard it secondhand vs saw it directly.

### 3.2 `event_reaction` Topics (`src/game/narrative.ts:1038-1124`)

There are **3** topics in `event_reaction` (`CATEGORY_PRIORITY.event_reaction = 68`):

1. `event_bell_celebration` (`residentId: 'any'`): Checks `{ requiresRecentEventKind: { kind: 'bell_ring', maxDaysAgo: 2 }, notSeenToday: true }`.
2. `event_fountain_repair` (`residentId: 'any'`): Checks `{ flagsTrue: ['repairedFountain'], notSeenToday: true, maxSeenCount: 1 }`.
3. `event_gift_thanks` (`residentId: 'any'`): Checks `{ requiresRecentEventKind: { kind: 'player_help', maxDaysAgo: 1 }, notSeenToday: true }`.

- *Audit finding*: `event_gift_thanks` (`"Word travels fast along Willow Step Lane—folks noticed you carrying helpful bundles across the square..."`) fires instantaneously for **all 9 residents** the very second the player delivers one item to one neighbor, even if no encounter or witness event happened. `event_bell_celebration` is acoustically plausible outdoors in a small square, whereas `event_fountain_repair` uses global `flagsTrue` rather than whether that neighbor walked past the fountain or heard the news.

### 3.3 Actor-Local Context (`resolveContextFlavorRemark`, `dialogueEngine.ts:602-618`)

- On `daily_slice` topics (or fallback dialogue), `resolveContextFlavorRemark` checks:
  1. Whether the speaker is currently sitting on a bench (`rt.posture === 'sitting' && rt.reservedSeatId`).
  2. Whether `world.worldEvents` contains a same-day `npc_social` record with `e.actors.includes(id)`.
- *Assessment*: This is the **only** actor-scoped event read in the dialogue engine today. It already proves the pattern of filtering by actor participation, though it is limited to same-day `npc_social` records inside a 40-slot global ring buffer.

---

## 4. Audit of Simulation Loop, Time, Determinism & Persistence

### 4.1 Simulation Tick & Social Encounters (`src/game/simulation.ts`)

- `stepSimulationInPlace(world, dtSeconds, options)` executes at render cadence (~60 Hz in `NeighborhoodCanvas.tsx`, ~4 Hz in headless tests).
- Strictly zero-GC in the movement path using pre-allocated `_otherPositions` (`simulation.ts:58`).
- **Autonomous Social Encounters (`simulation.ts:830-973`)**:
  - Bounded concurrency: `maxConcurrentEncounters = Math.max(2, Math.floor(RESIDENT_ORDER.length / 4))` (currently `2` for 9 residents; scales dynamically).
  - Time-slotted determinism: `socialSlot = Math.floor(world.minuteOfDay / 15)`, paired with `mulberry32(hashSeed(world.simSeed, world.day, socialSlot, a, b))`.
  - Proximity & state gates: `distance <= 7.5 m` (3rd participant `<= 5.8 m`), neither busy (`socialPartnerId === null`, `waypoints.length === 0`, `posture !== 'sitting'`), off `socialCooldownUntilMinute` (`SOCIAL_COOLDOWN_MINUTES = 95`), player `> 2.2 m` away, and `!shouldSuppressNpcSocial(relAB)` (`affinity < 0 || tension >= 45`).
  - Side effects on formation: assigns `spots` (`1.28 m` apart), sets `SOCIAL_ENCOUNTER_DURATION_MINUTES = 16`, calls `applyNpcSocialRelationInPlace` (`+2..+4` affinity, `-2..-3` tension), and appends an `npc_social` `WorldEventRecord`.
  - *Crucial architectural opportunity*: Pairing happens at most `maxConcurrentEncounters` times per 15-minute slot—**not** every frame. Hooking Phase 3 gossip exchange into encounter formation (or completion) avoids any per-frame $O(N^2)$ scan.

### 4.2 Time & Calendar (`src/game/time.ts`, `src/game/storage.ts:276-324`)

- Simulation day spans `DAY_START_MINUTE = 360` (6:00 AM) to `DAY_END_MINUTE = 1290` (9:30 PM); new days wake at `NEXT_DAY_WAKE_MINUTE = 480` (8:00 AM).
- **Zero real-world calendar usage**: No `Date.now()` in `src/game/`. All ages, cooldowns, and expiration checks can be expressed cleanly using in-game `world.day` and `world.minuteOfDay`.
- `advanceToNextDay(state)` (`storage.ts:276-324`) increments `day`, resets `talkedToday`, `dailyAffinityGained`, `moodUntilMinute`, `npcRuntime`, `activeEncounters`, returns resident-held props to `homePos`, and preserves `flags`, `memories`, `worldEvents`, `playerRelations`, and `npcRelations`.

### 4.3 Persistence & Serialization (`src/game/migrations.ts`, `src/game/storage.ts`)

- `CURRENT_SCHEMA_VERSION = 3` with pure sequential upgraders `migrateV1ToV2` and `migrateV2ToV3`, per-field `sanitizeWorldState`, and corrupt JSON recovery.
- `storage.ts` saves to `little_somewhere_world_v1` (with pre-upgrade backup in `little_somewhere_world_v1_backup`) only when `computeWorldSaveRevision(state)` changes (`App.tsx:446-455`).
- `computeWorldSaveRevision` (`storage.ts:87-253`) hashes every persisted field without allocating arrays on steady-state fields; any new `WorldState` field in Phase 3 **must** be added both to `sanitizeWorldState` and `computeWorldSaveRevision`.

---

## 5. Confirmed Defects, Duplications & Gaps Discovered in Audit

| ID | Location | Finding | Impact on Phase 3 |
| :--- | :--- | :--- | :--- |
| **OMN-01** | `dialogueEngine.ts:298-319`, `narrative.ts:1038-1124` | `event_bell_celebration` and `event_gift_thanks` read global `worldEvents`; `event_fountain_repair` reads global `flagsTrue`. | Must migrate to per-NPC `npcMemories` predicates so residents only react if they witnessed or heard the event. |
| **OMN-02** | `dialogueEngine.ts:73-127`, `narrative.ts:1306-1481` | `selectThirdPartyGossipSubject` reads global `playerRelations` and `npcRuntime.emotion` for any speaker-subject pair. | Must be scoped/backed by speaker knowledge & gossip propagation (see Doc 11 & Doc 15 Decision D2). |
| **DUP-03** | `actions.ts:209-226` vs `actions.ts:426-441` | `deliverHeldItemAction` calls `applyDialogueChoice` (emitting `story_${day}_gift_${heldId}_${residentId}`, `kind: 'player_help'`) **and** pushes a second `WorldEventRecord` (`help_${day}_${heldId}_${residentId}`, `kind: 'player_help'`). | Creates duplicate `player_help` events and would create duplicate `npcMemories` unless consolidated or deduplicated by `eventId`. |
| **BUG-01** | `actions.ts:522-541` vs `App.tsx:253-269, 319-331` | `interactWithProp('gazebo_bell')` increments `bellRungCount` and pushes `bell_ring` `WorldEventRecord` with hardcoded `actors: ['clara', 'arthur', 'pip']` **before** the user clicks `"Ring the Brass Bell"`, and `handlePropAction('ring_bell')` increments `bellRungCount` again without emitting a `WorldEventRecord`. Also hardcodes 3 resident IDs (`actors`). | Must be considered when attaching acoustic witness memories to bell chimes (see Doc 15 Decision D3). |
| **GAP-01** | `types.ts:415-444`, `actions.ts:191-226` | `DialogueChoice` has `unlockMemory` (player Journal) and `setEmotion`, but no declarative hook to record per-NPC memories or mark a gossip memory as shared (`mentionedToPlayer`). | Needed cleanly on `DialogueChoice` / `DialogueSession` for Phase 3. |
| **GAP-02** | `types.ts:249-255` (`NpcNpcRelation`) | Lacks gossip cooldown fields (`lastGossipDay`, `lastGossipEventId`), so two close residents encountering twice on the same day have no pair-level anti-spam tracker. | Additive optional fields on `NpcNpcRelation` solve this cleanly. |
| **GAP-03** | `JournalDrawer.tsx:399-420` | Displays `world.worldEvents.slice(0, 5)` directly as *Recent Lane Moments* and renders `Reliability %` telemetry. | Phase 3 must keep `worldEvents` intact as a clean town chronicle while deferring Journal UI redesign to Phase 5. |

---

## 6. Summary of Reuse Opportunities

1. **`ForwardWorldHooks` (`dialogueEngine.ts:40-43`)**: Already supports `requiresNpcMemoriesAny` and `excludesNpcMemories` reading `m.tag` and `m.id`. Keeping `id` and `tag` on `NpcMemoryEntry` immediately activates these tested predicates.
2. **Existing PRNG & Clock (`rng.ts`, `time.ts`)**: `hashSeed`, `mulberry32`, `world.day`, and `world.minuteOfDay` provide deterministic, calendar-free math ready for gossip rolls and retention decay.
3. **Dynamic Population Pattern (`RESIDENT_ORDER`)**: `simulation.ts`, `relationships.ts`, and `migrations.ts` already iterate `RESIDENT_ORDER` dynamically, making per-resident memory storage naturally extensible beyond 9 residents.
4. **Sequential Migration Pipeline (`migrations.ts`)**: `migrateV1ToV2` -> `migrateV2ToV3` establishes the exact pattern for `migrateV3ToV4` with rolling backup protection.
