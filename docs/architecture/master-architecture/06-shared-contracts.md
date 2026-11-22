# 06 — Shared Contracts

**Recorded:** 2026-11-22, atop `origin/main` @ `a80a220`.
**Purpose:** make the implicit contracts explicit. The `WorldState` v11 field→owner table is the single most important contract in the project. The cross-subsystem derived-read map binds the implicit contracts teams can silently break. The interface-extraction plan and typed-registry plan turn the smeared mutable surfaces (`sideFlags`, `StoryFlags`) into owned, typed access surfaces.

---

## 1. The `WorldState` v11 contract — field → owning subsystem

Every top-level field on `WorldState` (`src/game/types.ts:737-790`), with the version it was introduced and the **single owning subsystem** that defines/creates it. "Mutating subsystems" lists the modules that write it (verified by grep). **A field's owning subsystem is the only team that may change its shape.**

| Field | Since | Owning subsystem (defines) | Mutating subsystems (grep) | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `schemaVersion` | v1 | persistence (`migrations.ts`) | migrations, storage | `CURRENT_SCHEMA_VERSION = 11` |
| `simSeed` | v2 | persistence (`migrations.ts:DEFAULT_SIM_SEED`) | migrations | Determinism seed |
| `regionId` | v2 | world (`worldMap.ts:DEFAULT_REGION_ID`) | — | Region scope |
| `day`, `minuteOfDay`, `season`, `weather` | v1/v2 | core (`time.ts`), env (`environment.ts:rollWeatherForDay`) | simulation (clock), storage (day rollover) | Season is derived (calendar-locked) |
| `playerPos`, `playerFacing`, `playerPosture`, `playerSeatId`, `playerHeldItem` | v1/v3 | world (`playerController.ts`) | actions (intent), playerController (locomotion) | Locomotion mutates in-place 60Hz |
| `worldProps` | v3 | world (`worldMap.ts`) | actions (`pickupWorldPropAction`/`placeWorldPropAction`) | Carryable placements |
| `residents` (`Record<ResidentId, ResidentProgress>`) | v1 | sim (`residents.ts:createInitialResidentsProgress`) | actions, simulation, dialogueEngine, memories | `mood` dual-owned (sim in-place, actions spread) — see doc 02 W7/W4 |
| `npcRuntime` | v2 | sim (`simulation.ts`/`npcRuntime.ts` after B6) | simulation only (sole writer) | Reset by `advanceToNextDay` |
| `playerRelations` | v2 | sim (`relationships.ts`) | relationships, actions | Daily caps reset on day rollover |
| `npcRelations` | v2 | sim (`relationships.ts`) | relationships (in-place) | Sparse canonical-pair map; no explicit count cap (W24) |
| `activeEncounters` | v2 | sim (`simulation.ts`) | simulation (in-place) | Reset by day rollover |
| `worldEvents` | v2 | sim (`relationships.ts:pushWorldEventInPlace`) | relationships, actions, invitations | Cap `MAX_WORLD_EVENTS = 40` |
| `npcActivityHistory` | v2 | sim (`simulation.ts`) | simulation | Cap 8/resident |
| `topicHistory`, `lastTopicByResident` | v3 | narrative (`dialogueEngine.ts`) | dialogueEngine | Dialogue selector state |
| **`sideFlags`** (`Record<string, boolean\|number\|string>`) | v3 | **NONE (un-owned)** | **9 files: actions, narrative, storylines, simulation, environment, dialogueEngine, exploration, journal, storage** | **CRITICAL — W1.** Untyped string bag. Target: `SideFlagKey` union + `SIDE_FLAG_DEFINITIONS` registry (C1). |
| **`flags`** (`StoryFlags`) | v1 | narrative (`narrative.ts:createInitialStoryFlags`) | **10 files: actions, narrative, simulation, dialogue/everyday, dialogue/interiors/copperwheel, environment, journal, playerController, migrations, storage** | **W7.** Target: `StoryFlagOwnerMap` + `setStoryFlag` helper (C2). |
| `memories` (`JournalMemory[]`) | v1 | narrative (`actions.ts`/`journal.ts` append) | actions, exploration, migrations, journal, activities | Cap 96; dual-writer hazard (actions spread vs exploration in-place) — doc 02 W1/L-1 |
| `npcMemories` | v4 | sim (`memories.ts`) | memories, actions, simulation, dialogueEngine, journal | Cap 14/resident, 6 permanent; single funnel `recordNpcMemoryInPlace` |
| `storylines` (`Record<string, StorylineProgress>`) | v5 | narrative (`storylines.ts:STORYLINE_MAP`) | storylines, actions, dialogueEngine, simulation, narrative, 5 `dialogue/personal/*`, 2 `dialogue/events/*` | Registry exists; content modules touch inline (W8) |
| `mailboxUnread`, `dailyLettersRead`, `bellRungCount` | v1-v2 | narrative (`actions.ts`) | actions | `dailyLettersRead` not count-capped (W23) |
| `playerLocation`, `exteriorPlayerPos`, `exteriorPlayerFacing` | **v6** | world (`actions.ts` enter/exit) | actions | Interior/exterior state |
| `inventory`, `discoveredItemIds` | **v6** | items (`inventory.ts:createStarterInventory`) | actions, inventory | Cap `MAX_ITEM_STACK=20` |
| `cottageState` | **v6** | interiors/cottage (`cottage.ts`) | actions | Mementos derived (read by cottageInterior builder) |
| `dailyActivities` | **v6** | interiors/cottage (`cottage.ts`) | actions, simulation | Reset on day rollover |
| `neighborGiftsReceived` | **v6** | lr (`activities.ts`) | actions | |
| `greenhouseState` | **v7** | interiors/greenhouse (`greenhouse.ts`) | actions | `totalHarvests` read by cottageInterior + progressionVisuals + journal (W15) |
| `bakeryState` | **v8** | interiors/bakery (`bakery.ts`) | actions | `kneadingSessions` read cross-subsystem (W15) |
| `nookState` | **v9** | interiors/bookNook (`bookNook.ts`) | actions | `booksRead` read cross-subsystem (W15) |
| `copperwheelState` | **v10** | interiors/copperwheel (`copperwheel.ts`) | actions | `windingSessions` read by journal + progressionVisuals (NOT cottageInterior — HANDOVER claim inaccurate, doc 09 §1-c) |
| `invitations`, `occupancy`, `teaching`, `activeActivity` | **v11** | lr (`invitations.ts`, `occupancy.ts`, `activities.ts`) | invitations, occupancy, activities, actions, simulation | LR-1/LR-2 foundation |

**`DialogueSession`** (`types.ts:972-985`) is runtime-only — **not persisted**. Verified by absence in `computeWorldSaveRevision` (`storage.ts:145-498`).

---

## 2. The four merge-points for schema evolution (W2 — the parallel-dev blocker)

A parallel feature adding a persisted field collides in **four** places, even for disjoint data slices:

| # | Merge-point | File:line | Conflict scenario |
| :--- | :--- | :--- | :--- |
| 1 | `CURRENT_SCHEMA_VERSION` integer | `migrations.ts:137` | Two teams both bump to v12 → literal conflict |
| 2 | `migrateV{N}ToV{N+1}` function name + ladder slot | `migrations.ts:2472-2475` | Two `migrateV11ToV12` functions / two `if (version === 11)` blocks |
| 3 | `sanitizeWorldState` monolithic return literal | `migrations.ts:1482-1529` (~330 lines) | Git flags conflicting edits even for unrelated fields |
| 4 | `computeWorldSaveRevision` hash | `storage.ts:145-498` | New field not added → autosave never fires on its changes (silent data loss) |

**Target (Phase D):** per-version migration files behind an explicit re-export chain (D1); per-subsystem sanitizer dispatch table (D2); per-subsystem hash fragments registered alongside sanitizers, combined with XOR (D3). All additive; byte-identical save output is the gate. **The duplicate-migration-version guard test (A4) prevents collision at merge-point #2.**

---

## 3. Cross-subsystem derived-read contract map (the implicit contracts)

These are read-only derived reads where subsystem X reads subsystem Y's persisted state. **There is no interface type binding them today** — renaming `totalHarvests` or changing its reset semantics would silently break cottage mementos, progression tiers, and journal summaries. Target: a `ProgressionReadModel` interface (C3) co-owned by the source subsystems, with a test asserting every reader's field exists in the interface.

| Reader (file:line) | Read field | Owner | Used for |
| :--- | :--- | :--- | :--- |
| `scene/builders/cottageInterior.ts:1906` | `greenhouseState.totalHarvests` | greenhouse | memento visibility (`homeMementos.greenhouseCutting`) |
| `scene/builders/cottageInterior.ts:1907` | `bakeryState.kneadingSessions` | bakery | memento visibility (`homeMementos.bakeryCard`) |
| `scene/builders/cottageInterior.ts:1908` | `nookState.booksRead` | bookNook | memento visibility (`homeMementos.nookBook`) |
| `scene/builders/cottageInterior.ts:1909` | `memories` id `mem_orchard_harvest` | journal | memento visibility (`homeMementos.orchardHoney`) |
| `scene/builders/cottageInterior.ts:1910` | `memories` id prefix `mem_teatable_` | journal | memento visibility (`homeMementos.teaCaddy`) |
| `game/progressionVisuals.ts:379-381` | `nookState.booksRead` (≥2/≥4) | bookNook | `bookStackTier` 1/2/3 |
| `game/progressionVisuals.ts:382` | `greenhouseState.totalHarvests` (≥3) | greenhouse | `honeyDipper` tier |
| `game/progressionVisuals.ts:383-384` | `bakeryState.kneadingSessions` (≥5) | bakery | `recipeCardTier` 1/2 |
| `game/journal.ts:917-1008` | `greenhouseState.totalHarvests`, `bakeryState.{kneadingSessions,loavesShared,bakeCheckedDay}`, `nookState.{booksRead,teasShared,shelfBrowsedDay}`, `copperwheelState.windingSessions` | greenhouse/bakery/nook/copperwheel | daily journal summary text |
| `game/storage.ts:145-498` | every persisted field | all | autosave dirty detection (the revision hash) |
| `game/journal.ts` (SF-3 chapter derivation, commit `8b715fc`) | `emergentStories.deriveResidentChapter` → reads `invitations.history`, `memories`, `relationships`, `sideFlags` | LR / journal / relationships | People-card chapter line (`JournalPersonCard.chapter?`) — derive-only, zero persisted state |
| `game/narrative.ts` + `game/dialogueEngine.ts` (SF-4 context boosts, commit `8b715fc`) | `dialogueContext.computeContextBoosts` → reads `relationships`, `memories`, `npcRuntime`, `topicHistory` | relationships / sim / narrative | optional `contextBoosts?` 6th param on `selectDialogueSession` (undefined = byte-identical legacy; engine-side ±5 clamp) |
| `game/socialProfile.ts` ↔ `game/journal.ts` (SF-D4 mirror, commit `8b715fc`) | `socialProfile.isMemoryPlayerKnown` mirrors `journal.isNpcMemoryKnownToPlayer` | Social foundation / narrative | **Lockstep contract:** if journal's predicate changes, socialProfile's mirror MUST change in the same PR. Co-owned derived-read constraint (SF-D4, SF1-03). |

**`ProgressionReadModel` target interface (C3):**
```ts
// src/game/persistence/progressionReadModel.ts (target, Phase C3)
export interface ProgressionReadModel {
  // greenhouse
  greenhouseTotalHarvests: number;
  // bakery
  bakeryKneadingSessions: number;
  bakeryLoavesShared: number;
  bakeryBakeCheckedDay: number | null;
  // bookNook
  nookBooksRead: number;
  nookTeasShared: number;
  nookShelfBrowsedDay: number | null;
  // copperwheel
  copperwheelWindingSessions: number;
  // journal (memory-id presence)
  hasMemoryId(id: string): boolean;
  hasMemoryIdPrefix(prefix: string): boolean;
}
```
Each source subsystem publishes a projection into this interface; readers consume only the interface. A test asserts every reader's field access compiles against the interface.

---

## 4. Interface-extraction plan (small, surgical)

| Interface | Current location | Target location | Consumers | Phase |
| :--- | :--- | :--- | :--- | :--- |
| `PropInteractionResult` | `actions.ts:162` | `types.ts` (cross-layer) | `DialogueSheet.tsx:59`, `actions.ts` | B3 |
| `GameAction` / `ActionResult` (if formalized) | implicit in `actions.ts` signatures | `actions/contracts.ts` | `actions/*`, tests | E2 prerequisite |
| `ProgressionReadModel` | (does not exist) | `persistence/progressionReadModel.ts` | `cottageInterior.ts`, `progressionVisuals.ts`, `journal.ts` | C3 |
| `JournalReadStoragePort` | (does not exist) | `persistence/storage.ts` | `journal.ts` (injected by `App.tsx`) | E5 |
| `Scheduler` (audio timer port) | (does not exist) | `audio.ts` constructor param | `audio.ts` | W6 remediation |

---

## 5. Typed-registry plan for smeared flags

### `SideFlagKey` + `SIDE_FLAG_DEFINITIONS` (C1 — addresses W1)

**Current:** `world.sideFlags: Record<string, boolean | number | string>` — 9 mutators, no owner, no types.

**Target:** the storage representation stays a `Record`, but access goes through a typed registry:

```ts
// src/game/narrative/sideFlags.ts (target, Phase C1)
export type SideFlagKey =
  | 'orchardGatheringOutcome'
  | 'pipZineTheme'
  | 'herbLoafStyle'
  | 'pondStandStyle'
  | 'watchTuneStyle'
  | 'lanternConflictOutcome'
  // ... exhaustive union of every sideFlag key in use
  ;

export interface SideFlagDefinition {
  key: SideFlagKey;
  owner: 'narrative' | 'storylines' | 'exploration' | 'activities'; // owning subsystem
  valueType: 'boolean' | 'number' | 'string';
  validValues?: readonly (string | number)[]; // for string/number enum flags
  migrate?: (raw: unknown) => unknown; // optional normalizer for migration
}

export const SIDE_FLAG_DEFINITIONS: Record<SideFlagKey, SideFlagDefinition> = { /* ... */ };

export function setSideFlag(world: WorldState, key: SideFlagKey, value: boolean | number | string): void {
  // dev-mode assert: key is registered, value matches valueType, value in validValues if defined
  world.sideFlags = { ...world.sideFlags, [key]: value };
}

export function getSideFlag<T extends SideFlagKey>(world: WorldState, key: T): SideFlagValueType<T> {
  return world.sideFlags[key] as SideFlagValueType<T>;
}
```

**Migration validation:** `sanitizeWorldState` warns on (and optionally drops) keys not in `SIDE_FLAG_DEFINITIONS` — closes the "orphaned flags" gap. The `EXPLORATION_FLAG_KEYS` set (`exploration.ts:81`) is the existing partial pattern; `SIDE_FLAG_DEFINITIONS` generalizes it.

### `StoryFlagOwnerMap` + `setStoryFlag` (C2 — addresses W7)

**Current:** `StoryFlags` is a fixed typed object (compile-time catches key typos), but 10 modules set flags with no ownership map. `DialogueChoice.setFlags?: Partial<StoryFlags>` (`types.ts:895`) allows any dialogue node to set any flag.

**Target:** a dev-mode ownership assertion chokepoint:

```ts
// src/game/narrative/storyFlags.ts (target, Phase C2)
export const STORY_FLAG_OWNER_MAP: Record<keyof StoryFlags, StoryFlagOwner> = {
  clearedGazeboIvy: 'narrative',
  foundBrassClapper: 'narrative',
  bellRestored: 'narrative',
  plantersBloomed: 'narrative',
  // ... exhaustive
};

export function setStoryFlag(world: WorldState, key: keyof StoryFlags, value: StoryFlags[typeof key], setter: StoryFlagOwner): void {
  if (import.meta.env.DEV && STORY_FLAG_OWNER_MAP[key] !== setter) {
    console.warn(`[storyFlags] ${setter} set ${key} owned by ${STORY_FLAG_OWNER_MAP[key]}`);
  }
  world.flags = { ...world.flags, [key]: value };
}
```

**Lower-risk than C1** because `StoryFlags` is already typed — the gap is ownership, not typing. The dev-mode assert is non-breaking.

---

## 6. Registry patterns already in the codebase (the templates to follow)

These are the canonical data-driven patterns the new registries (C1, C2) should mimic:

| Registry | Location | Pattern |
| :--- | :--- | :--- |
| `EXPLORATION_DISCOVERIES` | `exploration.ts:30` | readonly array of typed discovery specs; `EXPLORATION_FLAG_KEYS` derived Set. **The template for `SIDE_FLAG_DEFINITIONS` (C1).** |
| `PERSONAL_ITEMS` / `HEARTH_RECIPES` / `RESIDENT_GIFT_PREFS` / `NEIGHBOR_KEEPSAKE_REWARDS` | `inventory.ts:19,247,344,397` | readonly arrays/maps with `.reduce()` index builders. **The canonical content-registry pattern.** |
| `RESIDENT_EXTRA_ACTIVITIES` | `residents.ts:679` | utility-scored activity candidates. Extend for LR shared-activity candidates. |
| `DIALOGUE_TOPICS` | `dialogue/index.ts:41` | 23-module spread aggregator with "do not reorder" contract. Best-organized content surface. |
| `STORYLINES` / `STORYLINE_MAP` | `storylines.ts:290` | registry + progress sanitize + legacy hydrate. |
| `GREENHOUSE_CROP_MAP` / `COPPERWHEEL_PROJECT_MAP` / `NOOK_BOOK_MAP` | per-interior modules | per-interior content registries. |
| Migration chain | `migrations.ts:1978-2412` | 10 staircased `migrateVNToVN+1` functions. **Target: per-version files (D1), NOT a dynamic registry.** |

---

## 7. Contract change protocol

| Contract | Change rule |
| :--- | :--- |
| `WorldState` field shape (doc 06 §1) | Owning subsystem proposes; schema-bump protocol (doc 07 §2). |
| Cross-subsystem derived read (doc 06 §3) | Source subsystem publishes a `ProgressionReadModel` projection (C3); readers consume only the interface. Renaming a projected field = compile error in readers. |
| `SideFlagKey` / `SIDE_FLAG_DEFINITIONS` (C1) | Narrative lead owns the registry; adding a key is additive; removing requires a migration + consumer sweep. |
| `StoryFlagOwnerMap` (C2) | Narrative lead owns; reassigning ownership is an architect decision. |
| `PropInteractionResult` (B3) | Contract lead owns; lives in `types.ts`. |
| Reducer signatures (`actions/*`) | Action team owns; signature changes require updating `App.tsx` dispatchers + tests in the same PR. |
| Rig type contracts (`models.ts`) | Scene team owns; changes ripple to all builders. |
| `MaterialPalette` API | Scene team owns; changes ripple to 43 importers. |

---

These contracts are the load-bearing interfaces of the project. Making them explicit and typed is the difference between "parallel teams guess at boundaries" and "parallel teams compile against a contract." The protocol in doc 07 governs how these contracts evolve.
