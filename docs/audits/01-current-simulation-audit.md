# 01 — Current Simulation Architecture Audit (`LITTLE SOMEWHERE`)

**Audit Scope**: Complete inspection of `src/game/`, `src/scene/`, `src/components/`, `src/App.tsx`, and test coverage (`src/game/engine.test.ts`) against the **Sunlit Diorama & Clay Storybook** baseline.  
**Constraint Posture**: Read-only architecture audit. No runtime gameplay behavior was modified.

---

## Executive Snapshot

**LITTLE SOMEWHERE** currently implements a clean three-layer split (`src/game/` pure TypeScript engine, `src/scene/` Three.js diorama renderer, `src/components/` + `src/App.tsx` React HUD shell) backed by `worldRef` + throttled `~6 Hz` React snapshots (`src/App.tsx:54-64`, `src/scene/NeighborhoodCanvas.tsx:1154-1166`). That structural separation is healthy and mobile-resilient.

However, the **simulation itself is currently split across layers**:
- Discrete narrative state (`WorldState`, `StoryFlags`, `ResidentProgress`) lives in `src/game/`, while **continuous time progression, NPC spatial state, NPC movement/steering, and schedule-arrival state** live transiently inside the Three.js `tick()` loop (`src/scene/NeighborhoodCanvas.tsx:894-1109`).
- As a result, NPCs have **deterministic 4-slot destinations** rather than autonomous daily lives, **linear trust scalar (`0–5`)** rather than bilateral relationships, **monolithic procedural dialogue construction** (`buildResidentDialogue`) rather than reusable topic selection, and **flag-coupled environmental reactivity** (`computeEnvironmentState`) with no weather, seasonal calendar, or NPC-driven world mutations.

---

## 1. NPC Architecture Audit

### 1.1 Resident Definitions & Schedules
- **Confirmed implementation**:
  - Nine residents (`clara`, `arthur`, `mina`, `jun`, `barnaby`, `sora`, `toby`, `nora`, `pip`) are statically defined in `RESIDENTS` (`src/game/residents.ts:15-448`) with role, personality blurb, `ResidentAppearance`, and a fixed 4-entry `schedule: Record<TimePhase, ScheduleSlot>` (`morning`, `afternoon`, `golden`, `dusk`).
  - `getTimePhase(minuteOfDay)` (`src/game/residents.ts:450-455`) partitions the day into 4 bands (`< 690`, `< 960`, `< 1110`, `>= 1110`).
  - `getResidentScheduleSlot(id, phase, reconciled)` (`src/game/residents.ts:466-492`) provides one conditional schedule override: when `claraArthurReconciled === true` and `phase === 'golden'`, Clara and Arthur converge on `Gazebo Steps` (`(-1.1, -6.1)` and `(1.1, -6.1)`).
- **Confirmed limitation**:
  - Schedule slots are static coordinate records with zero support for weather overrides, day-of-week routines (e.g., market mornings), multi-waypoint patrol/errand loops, personal preferences, needs/energy, or interruptible autonomous micro-activities.
  - Resident `personality` (`src/game/types.ts:58`) and `favoriteThing` (`src/game/types.ts:59`) are purely decorative display strings—no simulation rule reads them.
- **Potential risk**:
  - Adding conditional schedule logic via `if (flag && phase === ...)` inside `getResidentScheduleSlot()` will create combinatorial branching across 9+ NPCs once weather, seasons, and social encounters are introduced.
- **Proposed improvement**:
  - Introduce a pure `src/game/` schedule/activity evaluator using declarative `ScheduleRule[]` + deterministic utility scoring weighted by resident trait vectors, weather, season, and active story state.

### 1.2 NPC State Ownership, Movement, Collision & Navigation
- **Confirmed implementation**:
  - World collision uses `BOX_OBSTACLES` (6 cottages + `pond_water`) and `CIRCLE_OBSTACLES` (fountain, gazebo plinth, hollow oak, tea cart, noticeboard) inside `WORLD_BOUNDS` (`src/game/worldMap.ts:35-68`).
  - `resolveMovement(current, desired, actorRadius)` (`src/game/worldMap.ts:130-142`) tests `(desired.x, desired.z)`, falling back to single-axis slides `(desired.x, current.z)` or `(current.x, desired.z)`.
  - Inside `NeighborhoodCanvas.tsx:633-663`, transient `residentPositions` and `residentWalkPhase` are initialized directly at the current phase's `slot.target`. Each frame (`NeighborhoodCanvas.tsx:1046-1086`), each resident walks straight toward `slot.target` at `2.3 m/s` using `resolveMovement(pos, nextPos, 0.38)` when `distToGoal > 0.18`.
- **Confirmed limitation**:
  - **NPC spatial state is not in `WorldState` (`src/game/types.ts:108-119`)**: `residentPositions`, velocities, current activity timers, and idle states live only in closures inside `NeighborhoodCanvas.tsx`. Reloading the page or mounting the canvas snaps every NPC straight to their current slot target, and headless unit tests (`src/game/engine.test.ts`) cannot simulate or verify NPC movement, travel times, or social encounters.
  - **No pathfinding / waypoint graph**: Direct vector steering (`dx / distToGoal`) combined with single-step axis sliding (`resolveMovement`) cannot navigate around concave or wide obstacles such as `pond_water` (`minX: -2.4, maxX: 5.6, minZ: 11.4, maxZ: 16.6`) or `greenhouse` + `workshop_barnaby`. For example, Toby transitioning from `afternoon` (`(8.6, 4.8)`, east lane) to `golden` (`(-4.8, 13.4)`, west of Mirror Pond) travels along a diagonal that intersects `pond_water` or `fountain_basin`, relying purely on axis-slide luck; any future target across the bridge (`(-2.9, 14.0)`) would pin an NPC permanently against the pond edge.
  - **No actor-to-actor separation or collision**: Residents can walk directly through the player and through each other, and `Clara` / `Arthur` rely on hardcoded ±1.1 X offsets at the gazebo rather than dynamic personal-space separation.
  - **No activity animation states**: `NeighborhoodCanvas.tsx:1062-1085` only supports two visual states—walking (sinusoidal leg/arm swing) and idle (vertical breathing + facing `slot.facingAngle` or turning toward the player within `3.2 m`).
- **Potential risk**:
  - Adding autonomous roaming, errands, or NPC-to-NPC meetups without waypoint pathfinding will produce visible NPC wall-snagging on mobile/desktop playtesting.
- **Proposed improvement**:
  - Extract a headless `stepNeighborhoodSimulation(world, dt)` reducer/stepper in `src/game/` that owns `NpcRuntimeState` (`position`, `facing`, `activityId`, `pathWaypoints`, `interactionCooldowns`, `seedCursor`), backed by a lightweight 18–25 node walkable lane waypoint graph (`A*` / Dijkstra on static neighborhood lanes) plus soft actor-separation steering.
- **Architectural consequence**: `NeighborhoodCanvas.tsx` becomes a pure visual projection of `WorldState` / `NpcRuntimeState` instead of the hidden owner of simulation time and NPC coordinates.

---

## 2. Relationship Architecture Audit

### 2.1 Trust Scalar, Mood & Cross-NPC Flags
- **Confirmed implementation**:
  - Each resident has `ResidentProgress` (`src/game/types.ts:64-70`): `{ trust: number, met: boolean, talkedToday: boolean, mood: 'peaceful' | 'wistful' | 'busy' | 'warm' | 'joyful', lastDialogueId: string | null }`.
  - `applyDialogueChoice()` (`src/game/actions.ts:39-58`) clamps `trust` to `0..5`, sets `met: true`, `talkedToday: true`, writes `lastDialogueId: choice.nextNodeId`, and computes `mood` via:
    `claraArthurReconciled && (clara|arthur) ? 'joyful' : nextTrust >= 3 ? 'warm' : currentRes.mood`.
  - Inter-NPC conflict/reconciliation is represented only as global booleans/enums in `StoryFlags` (`claraArthurReconciled`, `mediationStyle` in `src/game/types.ts:82-84`).
- **Confirmed limitation**:
  - **Trust farming exploit**: `applyDialogueChoice()` (`src/game/actions.ts:39-40`) applies `choice.trustDelta` unconditionally without checking `currentRes.talkedToday` or whether a repeatable small-talk choice was already chosen today. Specifically, `pip_skip` (`narrative.ts:191`), `nora_tea_chat` (`307`), `jun_gossip` (`379`), `mina_ivy` (`443`), `mina_tea` (`451`), `barnaby_craft` (`531`), `sora_song` (`593`), `toby_sketch` (`648`), `clara_listen` (`716`), `clara_hug` (`690`), and `arthur_ring_note` (`807`) all award `+1` trust every single time the player opens dialogue. Only `arthur_smalltalk` (`883`) checks `progress.met ? 0 : 1`. A player can max out 5/5 hearts with any NPC in 5 consecutive clicks on Day 1 Morning.
  - **No NPC-to-NPC relationship model**: Mina dropping off lavender at Clara's bakery, Nora mentoring Pip, Barnaby checking on the player's cottage, or Clara & Arthur's estrangement cannot be queried, evolved, or generalized across characters.
  - **Mood overwrites lose nuance**: Once `trust >= 3`, `mood` locks to `'warm'` (`actions.ts:45`) regardless of dialogue tone, weather, or daily events; `'busy'` is never assigned anywhere in the codebase.
- **Potential risk**:
  - Expanding to 2–3 new neighborhood storylines using global `StoryFlags` booleans per NPC pair (`minaTobyClose`, `barnabyArthurRivalry`, etc.) will bloat `StoryFlags` and duplicate special-case checks across `narrative.ts`, `residents.ts`, and `actions.ts`.
- **Proposed improvement**:
  - Replace/augment scalar `trust` with a unified relationship graph: `playerRelations[residentId]` (affinity, familiarity, daily trust cap, mood history) and `npcRelations[pairKey]` (affinity, tension, shared history tags, last-met day/minute), while deriving a backward-compatible `trust` (`0–5` hearts) for existing HUD hearts and Milestone 1 quest checks.
- **Architectural consequence**: Dialogue conditions, schedule co-location, and ambient banter can query a single pure `getRelationship()` API instead of scattering bespoke story flags.

---

## 3. Dialogue Architecture Audit

### 3.1 Narrative Tree Construction & Reducers
- **Confirmed implementation**:
  - `buildResidentDialogue(id, world, phase)` (`src/game/narrative.ts:79-917`) builds a localized `Record<string, DialogueNode>` on demand whenever the player initiates talk (`src/App.tsx:137`).
  - Choice availability is checked identically in UI filtering (`src/components/DialogueSheet.tsx:90`) and state reduction (`src/game/actions.ts:31`) via `isChoiceAvailable(choice, flags, trust)` (`src/game/narrative.ts:49-58`).
  - Quest indicator diamonds above NPCs are computed via `getResidentAvailableQuestCue(id, world)` (`src/game/narrative.ts:60-77`) and projected onto `rig.questPip` (`NeighborhoodCanvas.tsx:1089-1094`).
- **Confirmed limitation**:
  - **Monolithic imperative builder**: At 839 lines for 9 NPCs and 1 storyline, `buildResidentDialogue()` hardcodes all prose, conditions, and branch trees in nested `if/else` blocks. Adding 3+ stories or seasonal/weather small talk here will make `narrative.ts` unmaintainable.
  - **Dead `lastDialogueId` state**: `applyDialogueChoice()` writes `lastDialogueId: choice.nextNodeId` (`src/game/actions.ts:57`), and `DialogueSheet` / `buildResidentDialogue` **never read it**. Residents repeat identical greetings and small-talk topics indefinitely even within the same phase or immediately after closing dialogue.
  - **Verified narrative & quest-cue inconsistencies**:
    1. `nora_read_together` (`src/game/narrative.ts:260-266`) sets `foundPostcard: true` so the player receives the postcard, **but omits `unlockMemory` (`mem_lost_postcard`)**, whereas `nora_take_card` (`L246-258`) unlocks `mem_lost_postcard`. Choosing the festival ribbon branch silently skips the journal memory.
    2. `toby_clapper` (`src/game/narrative.ts:633-646`) only gates on `requiresFalseFlag: 'foundBrassClapper'`—not `heardBellMystery`. Thus a player talking to Toby before meeting Pip or Nora can prematurely recover the clapper, whereas `getResidentAvailableQuestCue('toby', world)` (`L70`) and `interactWithProp(world, 'hollow_oak')` (`src/game/actions.ts:211`) both require `heardBellMystery`.
    3. `DialogueSheet.tsx:86` indexes `session.nodes[session.currentNodeId]` with no guard if a node ID were mis-referenced.
    4. `isChoiceAvailable()` only understands `requiresFlag`, `requiresFalseFlag`, and `minTrust`; it cannot check personality compatibility, `talkedToday`, time phase, weather, season, NPC-to-NPC affinity, or whether a topic was already seen.
- **Potential risk**:
  - As soon as repeatable daily conversations, mood/weather greetings, and NPC-specific side stories are added, imperative `if/else` trees will suffer from combinatorial greeting staleness, missing memories, and mismatched quest cues.
- **Proposed improvement**:
  - Split `narrative.ts` into a **Story Registry + Topic Selector** (`DialogueTopic[]` declarative records with typed `ConditionPredicate`s, cooldowns, priority tiers, and reusable template slots) alongside a compatibility adapter that preserves 100% of *The Silent Gazebo Bell* beats and memory IDs.
- **Architectural consequence**: New stories, weather comments, and relationship-gated conversations become testable data modules rather than edits to a 1,000-line switch tree.

---

## 4. Environmental Architecture Audit

### 4.1 Environment State Derivation & 3D Scene Reactivity
- **Confirmed implementation**:
  - `computeEnvironmentState(flags)` (`src/game/narrative.ts:31-47`) maps `StoryFlags` to 8 visual properties (`plantersBloomed`, `fountainFlowing`, `ivyCleared`, `bellGleaming`, `festoonLanterns`, `bakeryTablesOpen`, `reconciledTogether`, `noticeboardUpdated`).
  - `NeighborhoodCanvas.tsx:903-936` linearly interpolates sky background, fog, sun color/angle/intensity, hemisphere fill, window emissive intensity, and lantern emissive intensity from `world.minuteOfDay` (`420..1260`), then calls `updateEnvironmentVisuals(env, phase, elapsed)` (`L828-876`).
- **Confirmed limitation**:
  - **Conflation of concerns**: `EnvironmentalState` only tracks story-driven static props; there is no model for **Weather**, **Seasons**, **NPC-driven environmental changes**, or **automated day rollover / late-night state**.
  - **Time clamps at 9:00 PM**: `tick()` (`NeighborhoodCanvas.tsx:895`) clamps `world.minuteOfDay` at `1260` (9:00 PM), while `App.tsx:206` (`+2h` button) clamps at `1230` (8:30 PM)—an inconsistency, and neither prompts or handles day completion automatically.
  - **Minor 3D state sync bugs verified in `src/scene/`**:
    1. `buildOldBellGazebo()` (`src/scene/models.ts:380-382`) renders the brass `clapper` mesh inside the bell at all times—even before `foundBrassClapper` or `bellRestored` is true.
    2. `updateEnvironmentVisuals()` (`NeighborhoodCanvas.tsx:865-875`) integrates the bell swing using a hardcoded `dtClamped = 0.016` instead of frame `dt`, meaning under `isSoftwareGl` (~8–10 FPS) the bell swings in ~5× slow motion relative to wall time, and `spawnChimeBurst()` triggers repeatedly across consecutive frames while `Math.abs(bellSwingVelRef.current) > 3.6`, resetting active chime particles mid-flight.
    3. `noticeboardUpdated` is computed in `computeEnvironmentState()` (`narrative.ts:45`) and used in `actions.ts`, while `noticeBoard` in `NeighborhoodCanvas.tsx:460-480` has static geometry (`nbFlyer`) that does not visually reflect updates.
- **Potential risk**:
  - Bolting weather particles, seasonal foliage recolors, and NPC prop changes onto `StoryFlags` and per-frame `updateEnvironmentVisuals()` will couple unrelated subsystems and cause continuous material/mesh thrashing.
- **Proposed improvement**:
  - Decompose environment simulation into 5 explicit orthogonal layers in `src/game/environment.ts`: (1) Time of Day, (2) Weather State, (3) Season Calendar, (4) Player-Driven World Changes, and (5) NPC-Driven World Changes, emitting a unified, revision-stamped `EnvironmentSnapshot` consumed via dirty-checks in Three.js.

---

## 5. Persistence Architecture Audit

### 5.1 Serialization, Loading & Compatibility
- **Confirmed implementation**:
  - `src/game/storage.ts` persists JSON under `STORAGE_KEY = 'little_somewhere_world_v1'` (`L6`).
  - `loadWorldState()` (`L31-52`) checks `!parsed || typeof parsed.day !== 'number' || !parsed.residents || !parsed.flags`, then shallow-spreads `fresh` and `parsed`, plus `residents: { ...fresh.residents, ...parsed.residents }` (`L44`) and `flags: { ...fresh.flags, ...parsed.flags }` (`L45`).
  - `App.tsx` saves on every discrete commit (`commitWorld` `L97`) and via a `5000 ms` `setInterval` (`L278-285`) while `screenState === 'playing'`.
- **Confirmed limitation**:
  - **No `schemaVersion` field**: `WorldState` has no version marker.
  - **Unsafe shallow object merge on nested records (`storage.ts:44`)**: `{ ...fresh.residents, ...parsed.residents }` preserves old `ResidentProgress` objects **verbatim**, without merging new per-resident fields into each resident entry! If Milestone 2 adds `needs`, `position`, or `seenTopics` to `ResidentProgress`, loading an existing `v1` save will leave those nested properties `undefined` and crash simulation loops at runtime.
  - **No deep validation/clamping**: `parsed.minuteOfDay`, `parsed.playerPos`, `parsed.residents[id].trust`, and `memories` elements are trusted unvalidated if top-level checks pass.
  - **Silent catch blocks (`L49, L57`)**: Serialization or quota failures drop silently with no fallback/backup key or diagnostic warning hook.
  - **Missing NPC spatial persistence**: Because `residentPositions` are not in `WorldState`, saving mid-afternoon always reloads NPCs snapped to their slot targets.
- **Potential risk**:
  - Any Milestone 2 nested field addition on `WorldState` or `ResidentProgress` will silently corrupt returning players' browser `localStorage` saves unless an explicit migration pipeline runs before state hydration.
- **Proposed improvement**:
  - Add `schemaVersion: number`, implement pure versioned migrations (`migrateV1ToV2`), deep-merge per-resident defaults, clamp numeric domains on load, and guard writes with a rotating backup slot (`little_somewhere_world_backup_v1`).

---

## 6. Performance & Rendering Audit

### 6.1 Three.js Loop, React Sync & Software-WebGL Compatibility
- **Confirmed implementation**:
  - Single-mount WebGL lifecycle (`useEffect(..., [])` in `NeighborhoodCanvas.tsx:112-1204`) with ref mirrors (`L92-102`), module-scope scratch math objects (`L65-79`), `InstancedMesh` for 46 perimeter grove trees (`L250-279`), pooled 16-mesh `chimeParticles` (`L603-612`), and throttled `onHudSync` (`0.18s` or target-change edges, `L1155-1166`).
  - Software-WebGL path (`isSoftwareGl`, `L116-125`) disables AA and shadow maps, locks DPR to `1`, skips `renderer.compile()`, and paces frames with `gl.fenceSync` + `afterDraw` (`L811-826`).
- **Confirmed limitation**:
  - **Unconditional per-frame scene mutations**: `NeighborhoodCanvas.tsx:828-876` iterates `flowerGroups` (`18` groups), updates `windowMaterials` (`~16` materials), and sets visibility on static groups every single frame even when `env` and `phase` did not change.
  - **Repeated `MeshStandardMaterial` allocations at build time (`src/scene/models.ts`)**: `makeMat()` (`L19-21`) creates fresh materials for every cottage plinth, timber corner, flower petal, and character limb rather than sharing pooled palette materials—increasing WebGL uniform uploads per frame.
  - **Unbounded raycast proxy scan on pointerdown**: `interactableMeshes` (`9` residents + `6` props = `15` meshes, `L650-675`) is small today, but will grow if Milestone 2 adds collectible items, benches, café tables, or interior props without spatial/layer filtering.
  - **Deprecated `THREE.Clock` (`NeighborhoodCanvas.tsx:795`)**: Emits console deprecation warning in `three@0.187.0` (`THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.`), verified during browser QA.
  - **React HUD allocations inside `onHudSync` (`L1160-1165`)**: Allocates a new `{ ...world.playerPos }` object every `0.18s` even when the player is standing still (`minuteOfDay` changes subtly, forcing `App.tsx` to re-render `formatClock` and `getLandmarkAt` ~5.5×/sec even if formatted minute string `"8:15 AM"` and landmark ID have not changed).
  - **Software WebGL `dt` clamp (`L883`)**: At ~8–10 FPS under `afterDraw`, `Math.min(rawDt, 0.05)` limits simulated time to `~0.4–0.5s` per real second, slowing walk speed in headless Chromium tests; conversely, adding heavy rain/particles or un-instanced foliage without budgets would further depress software-GL frame pacing.
  - **Unmount cleanup completeness (`L1183-1203`)**: Disposes the 6 procedural textures and renderer, but leaves `scene.environment` (`PMREMGenerator` render target) and scene geometries/materials undisposed if `<NeighborhoodCanvas>` were ever unmounted in future routes (e.g., interior transitions).
- **Potential risk**:
  - Adding weather particles (rain/leaves/snow), speech bubbles, NPC-to-NPC animations, and seasonal material tints naively inside `tick()` without instancing, dirty flags, and HUD change-detection will multiply draw calls and trigger React re-renders on mobile Safari/Chrome and SwiftShader.
- **Proposed improvement**:
  - Introduce revision-gated scene diffing (`lastEnvRevision`, `lastMinuteInteger`, `lastLandmarkId`), shared palette material registry in `models.ts`, `InstancedMesh` weather/petal particle systems, `THREE.Timer` replacement, and strict disposal helpers for scene transitions.

---

## 7. Testing Coverage Audit

### 7.1 Current `node:test` Suite (`src/game/engine.test.ts`)
- **Confirmed implementation**:
  - 5 unit tests (`141` lines) covering:
    1. `PLAYER_SPAWN` walkability and landmark (`L24-30`).
    2. Cottage/pond blocking and axis sliding via `resolveMovement` (`L32-41`).
    3. All 9 residents × 4 phases schedule walkability with `reconciled = false` (`L43-56`).
    4. `getTimePhase` and `formatClock` spot checks (`L58-65`).
    5. Happy-path storyline completion (`Pip -> Barnaby -> Hollow Oak -> Mina -> Arthur -> Bell Ring -> advanceToNextDay`) (`L67-140`).
- **Confirmed limitation (Critical Gaps)**:
  - **Zero persistence tests**: `storage.ts` (`loadWorldState`, malformed JSON, partial v1 fields, `saveWorldState`, `resetWorldState`) is completely untested.
  - **Reconciled schedule coordinates untested**: `getResidentScheduleSlot(id, 'golden', true)` for Clara and Arthur is never checked for `isPointWalkable()` in Test #3.
  - **Alternate story branches untested**: Nora postcard -> Jun delivery -> Arthur softness; Sora chamomile tea -> Arthur softness; Clara `shared_baking` and `gentle_truth` mediations; `mailbox` letters across Day 1 / Day 2 / restored; `plaza_noticeboard` text progression.
  - **Boundary & invariant tests missing**: `WORLD_BOUNDS` edges, `CIRCLE_OBSTACLES` sliding, trust clamping (`0..5`), trust farming prevention, `advanceToNextDay` across multi-day streaks, and `markResidentMet` idempotency.
  - **No simulation step or determinism tests**: Because NPC movement and clock progression reside in `NeighborhoodCanvas.tsx`, headless tests cannot assert NPC arrival times, pathfinding around Mirror Pond, or deterministic seeded outcomes.
- **Potential risk**:
  - Refactoring schedules, relationships, weather, and persistence without expanding deterministic tests will silently break existing story branches or corrupt legacy saves.
- **Proposed improvement**:
  - Expand `src/game/` tests into focused suites (`navigation.test.ts`, `simulation.test.ts`, `relationships.test.ts`, `dialogue.test.ts`, `environment.test.ts`, `storage.test.ts`) wired under `npm test` via `tsx --test src/game/*.test.ts`.
