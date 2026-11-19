# 07 — Milestone 2A Final Validation & Technical Audit

**Audit Date**: 2026-11-18  
**Audit Scope**: Independent verification of Milestone 2A (Phases 1–4), save lifecycle, desktop & mobile runtime behavior, performance/software-WebGL discipline, prototype extensibility, and Milestone 2B readiness.  
**Audit Ground Rules**: Zero assumptions from prior reports (`WORKLOG.md` Entry 009 / `HANDOVER.md`). Every status below reflects direct source inspection, freshly executed automated checks, and live headless Chromium (`playwright-cli`) inspection.

---

## 1. Executive Verdict

**Overall Milestone 2A Status**: **Partially verified — Core Architecture & Simulation Verified; 4 Targeted Defects Found in Live Visual/Mobile Verification**

- **Simulation, Persistence & Automated Checks**: **Verified** (`28/28` unit tests pass in `npm test`, `0` TypeScript errors in `npm run lint`, clean production bundle in `npm run build`, `0` React/Three.js leaks in `src/game/`).
- **Live Browser Execution & Console Health**: **Verified** (`0` console errors and `0` console warnings across desktop `1440×900` and mobile `390×844` sessions, live `v1 -> v2` save upgrade, reload persistence, dialogue, Pocket Journal, and weather/season/time transitions).
- **Visual & Mobile Polish / Reactive Edge Cases**: **Partially verified** due to **4 confirmed Milestone 2A defects** uncovered during independent inspection:
  1. **Critical/Medium — Frame-0 Pre-Update Render (`src/scene/NeighborhoodCanvas.tsx:934-937`)**: Under `isSoftwareGl`, the initial synchronous `renderer.render(scene, camera)` executes *before* `tick()` / `envController.update()` has ever run, showing un-tinted Spring/Morning defaults and unrestored props for ~2+ seconds until Frame 1 completes.
  2. **Medium — Fountain Basin Water Buried by Solid Cylinder (`src/scene/builders/landmarks.ts:283-368`, `src/scene/models.ts:435-466`)**: `outerWall` is a solid `CylinderGeometry` whose top cap sits at `y = 0.70`, completely occluding `dryFloor` (`y = 0.52`) and `waterMesh` (`y = 0.62`) even when `repairedFountain === true` (`spoutParticles` animate above it, while the basin looks like dry flat limestone).
  3. **Medium — Mobile `JournalDrawer` Tab Bar Clipped at `390×844` (`src/components/JournalDrawer.tsx:92-129`)**: `whitespace-nowrap shrink-0` tabs inside a horizontal scroll strip clip `"Story & Memories (5/5)"` and hide `"World & Time"` off the right edge on `390px` screens without a scroll indicator—critical because mobile hides the top-bar `+2h` button and relies on `"World & Time"` for time skip and weather/season readouts.
  4. **Low/Extensibility — Remaining `/9` Hardcode (`src/components/PauseModal.tsx:43`)**: Still renders `{metCount}/9` instead of `{metCount}/${RESIDENT_ORDER.length}` (unlike `JournalDrawer.tsx:103`), alongside `"Meet nine neighbors"` copy in `src/components/TitleOverlay.tsx:50`.

---

## 2. Verification Matrix (Using Explicit Audit Labels)

| Area / Deliverable | Status | Directly Observed Evidence |
| :--- | :--- | :--- |
| **Layer Separation (`src/game/` pure TypeScript)** | **Verified** | `grep` confirmed zero `three` or `react` imports under `src/game/`. `storage.ts` guards `window.localStorage`; `audio.ts` guards `AudioContext`. |
| **Automated Test Suite (`npm test`)** | **Verified** | `tsx --test src/game/*.test.ts` executed cleanly: **28/28 tests pass** (`0` failures, `731.5ms`) across `engine.test.ts` (#1–5), `environment.test.ts` (#6–9), `navigation.test.ts` (#10–15), `relationships.test.ts` (#16–19), `simulation.test.ts` (#20–23), and `storage.test.ts` (#24–28). *(Note: prior `WORKLOG.md` Entry 009 cited `27/27` and `HANDOVER.md:59` cited `5/5`.)* |
| **TypeScript Check (`npm run lint`)** | **Verified** | `tsc --noEmit` exited `0` with `0` errors. |
| **Production Build (`npm run build`)** | **Verified** | `vite build` exited `0` (`1,690` modules; `dist/assets/index-DMgzOgzs.js` `1,217.50 kB`, `index-DqH0R5YX.css` `28.97 kB`). Emits non-fatal Vite advisories on `__dirname` in `vite.config.ts:22` and >500 kB chunk size. |
| **Phase 1 — RNG, Unified Clock & `WorldState v2`** | **Verified** | `src/game/rng.ts` (`hashSeed`, `mulberry32`), `src/game/time.ts` (`360..1290`, `DAYS_PER_SEASON = 10`, `getSeasonForDay`, `getTimePhase`), `src/game/types.ts` (`schemaVersion: 2`, `regionId`, `simSeed`, `npcRuntime`, `playerRelations`, `npcRelations`, `activeEncounters`, `worldEvents`, `npcActivityHistory`). |
| **Phase 1 — `v1 -> v2` Migration & Sanitization** | **Verified** | Unit-tested in `storage.test.ts` (#24–28) and verified live in Chromium: seeding a Day 24 v1 save without `schemaVersion` upgraded in-place to `schemaVersion: 2`, created `little_somewhere_world_v1_backup`, preserved `day: 24`, `season: 'autumn'`, trust (`4`), flags, and memories, and hydrated all 9 `npcRuntime` entries. |
| **Phase 1 — Lane Waypoint Navigation & Headless Sim** | **Verified** | `src/game/navigation.ts` defines a 28-node connected lane graph (`NAV_NODES`, `NAV_EDGES`), A* pathfinding, collinear LOS smoothing, soft separation, and stuck recovery (`navigation.test.ts` #10–15). `src/game/simulation.ts` executes zero-GC `stepSimulationInPlace` and deterministic `stepSimulation` (`simulation.test.ts` #20–23). |
| **Phase 2 — Resident Traits, Activities & Social Encounters** | **Verified** | `src/game/residents.ts` defines `ResidentTraits` and per-resident `RESIDENT_EXTRA_ACTIVITIES` (with `onlyWeathers` rain-shelter pools). `src/game/simulation.ts` pairs idle NPCs within `7.5 m`, walks them to `1.28 m` conversation spots (`converse` pose), enforces `SOCIAL_COOLDOWN_MINUTES = 95`, blocks estranged `arthur:clara` (`affinity >= -1`) until `claraArthurReconciled`, logs `worldEvents`, and pauses via `interruptSocialEncounter()` when the player talks. Verified live in Journal (`Clara: Chatting with Nora`, `Arthur: Chatting with Jun`). |
| **Phase 2 — Bilateral Relationships & Small-Talk Cap** | **Verified** | `src/game/relationships.ts` tracks continuous `affinity` (`0..100` -> `0..5` hearts), `DAILY_SMALLTALK_AFFINITY_CAP = 20`, `NpcNpcRelation` baseline bonds (`arthur:clara` `-20` affinity / `75` tension), and `alreadyRewardedSmallTalkToday` preventing Day 1 heart farming (`relationships.test.ts` #16–19). |
| **Phase 2 — Narrative Fixes (`nora_read_together`, `toby_clapper`)** | **Verified (within imperative scope)** | `nora_read_together` (`narrative.ts:276-282`) now grants `mem_lost_postcard`; `toby_clapper` (`narrative.ts:660`) aligns with `requiresFlag: 'heardBellMystery'`; `DialogueSheet.tsx` has node lookup fallback. **Deferred to Milestone 2B**: `dialogueEngine.ts` does not exist yet; `narrative.ts` remains 934 lines of imperative `if/else` builders; `lastDialogueId` is still write-only; `recentSocial` remark (`narrative.ts:98-105`) only interpolates for `nora` and `jun`. |
| **Phase 3 — 3D Visual Transformation (Diorama & Cast)** | **Partially verified** | All buildings (`willowLaneDiorama.ts`, `buildings.ts`), `InstancedMesh` 3-draw-call grove + Hollow Oak + Mirror Pond & Cedar Bridge (`vegetation.ts`), Old Bell Gazebo + Noticeboard + Tea Cart (`landmarks.ts`), and 10 articulated `CharacterRig` figures + 7 animation poses (`characters.ts`) visually adhere to *PREMIUM HANDCRAFTED STORYBOOK DIORAMA*. **Defect**: `buildStorybookFountain` solid `outerWall` hides `dryFloor` and `waterMesh` (`landmarks.ts:283-368`, `models.ts:435-466`). Legacy unused Milestone 1 builders remain in `src/scene/models.ts`. |
| **Phase 4 — 5-Layer Environment & Visual Controller** | **Partially verified** | `composeEnvironmentState()` (`src/game/environment.ts`) cleanly composes 5 layers (`environment.test.ts` #6–9). Live Chromium confirmed `Autumn`, `Summer · Light Rain` (diagonal instanced streaks + overcast lighting), `Winter · Misty Morning` clearing to `Sunlit` after `10:30 AM` (`+2h` steps), and `Lantern Dusk` festoon/window glow. **Defects/Gaps**: (1) Frame 0 renders before `tick()`/`envController.update()`; (2) `puddlesActive`, `claraPastryBasketVisible`, `minaGreenhouseStage`, and `arthurEarlyPorchLamp` have no 3D mesh/material hookups in `environmentRenderer.ts`; (3) `willowLaneDiorama.ts` prototype trees do not receive seasonal leaf tinting; (4) `showPetals` omits calm `sunlit` autumn leaves & winter snow flurries (`environmentRenderer.ts:308-310`). |
| **Save Lifecycle & Autosave Correctness** | **Verified (with minor limitations)** | Confirmed `titleLsAfterPagehide === null` (unchanged Title screen + `pagehide` writes nothing), confirmed reload persistence across `+2h` (`minuteOfDay: 735.99`), dialogue (`junMet: true`), and memories. **Limitations**: `getSaveStamp(w)` (`App.tsx:57-60`) omits `npcRuntime`, `flags`, `residents`, `mailboxUnread`, and `dailyLettersRead`; `saveWorldState()` (`storage.ts:64`) calls `JSON.stringify(state)` instead of `serializeWorldState(state)`. |
| **Desktop (`1440×900`) & Mobile (`390×844`) UX** | **Partially verified** | Desktop (`1440×900`) Title, Playing, DialogueSheet, JournalDrawer, PauseModal, and Dusk transitions render cleanly with `0` console errors/warnings (note `VirtualJoystick` still renders on desktop). Mobile (`390×844`) HUD header stays single-row with `scrollW === innerW === 390` and `0` console errors/warnings, **but `JournalDrawer` tabs clip off-screen on `390px` mobile**. |
| **Software WebGL & Per-Frame Discipline** | **Verified** | `NeighborhoodCanvas.tsx` detects `SwiftShader|llvmpipe|softpipe|Software|Basic Render`, sets pixel ratio `1`, disables antialias & shadow maps, skips `renderer.compile()`, caps instanced weather particles (`24` rain / `12` petals), uses `THREE.Timer`, module-scope scratch vectors, and `afterDraw(tick)` (`gl.fenceSync` + `80ms` yield). |

---

## 3. Detailed Findings on Confirmed Defects & Gaps

### Defect M2A-1 — Frame-0 Renders Uninitialized Scene Before `envController.update()` (`NeighborhoodCanvas.tsx:934-937`)
- **Severity**: Medium-High (user-visible on load, especially under software WebGL).
- **Observation**: On initial mount when `isSoftwareGl === true`, `NeighborhoodCanvas.tsx:936` calls `renderer.render(scene, camera)` before `tick()` or `envController.update()` has ever executed. Because SwiftShader takes ~2.0–2.5 seconds to finish PMREM `RoomEnvironment` + Frame 0 + `gl.fenceSync` before `tick()` #1 fires, screenshots captured at 2.0–2.2s (`audit-plaza-restored-day.png`, `audit-mobile-390.png`, `audit-summer-rain-desktop2.png`) visibly rendered Morning/Spring defaults with `gazeboRig.ivyGroup` visible, `ribbonMesh`/`festoonGroup`/`bakeryTablesGroup`/`spoutParticles` hidden, `oakGlint` visible, and `"Walk up to a neighbor or cottage to interact"` CTA—even though `WorldState` had all 5 story threads complete and `Summer · Light Rain` loaded. Clicking `+2h` or waiting past Frame 1 immediately popped all props into the true state (`audit-after-2h.png`).
- **Root Cause**: `envController.update(composeEnvironmentState(worldRef.current), worldRef.current, worldRef.current.playerPos, 0, 0)` is not invoked prior to the initial synchronous `renderer.render(scene, camera)` on line 936.

### Defect M2A-2 — Fountain Basin Water Occluded by Solid `outerWall` Cylinder (`landmarks.ts:283-368`, `models.ts:435-466`)
- **Severity**: Medium (breaks visual payoff of Mina's fountain repair milestone).
- **Observation**: In `audit-mobile-390.png` and `audit-after-2h.png` (both with `repairedFountain: true` and Journal confirming `"Flowing with clear water"`), `spoutParticles` droplets appear above the upper catch-bowl, **but the main lower fountain basin renders as flat solid grey stone**.
- **Root Cause**: `outerWall` is a solid `THREE.CylinderGeometry(2.18, 2.28, 0.56, 16)` positioned at `y = 0.42`, placing its solid top cap at `y = 0.70`. Both `dryFloor` (`y = 0.52`) and `waterMesh` (`y = 0.62`) sit beneath `y = 0.70` and are completely hidden inside the cylinder.

### Defect M2A-3 — Mobile `JournalDrawer` Tabs Clip Off-Screen at `390×844` (`JournalDrawer.tsx:92-129`)
- **Severity**: Medium (hurts mobile UX & blocks discoverability of `+2h` and forecast).
- **Observation**: In `audit-mobile-journal.png` (`390×844`), the segmented tab container (`flex items-center gap-2 overflow-x-auto`) with `whitespace-nowrap shrink-0` buttons clips `"Story & Memories (5/5)"` at the right edge and pushes the `"World & Time"` tab completely out of view with no visual scroll affordance. Because the mobile top HUD hides the `+2h` button, `"World & Time"` is mobile players' primary entry point for time-skip and weather/season details.

### Defect M2A-4 — Hardcoded Prototype Count in `PauseModal.tsx:43` (and Copy/Test Assumptions)
- **Severity**: Low (extensibility defect for post-prototype cast expansion).
- **Observation**: `src/components/PauseModal.tsx:43` still displays `{metCount}/9` rather than `{metCount}/${RESIDENT_ORDER.length}`, whereas `JournalDrawer.tsx:103` already uses `{RESIDENT_ORDER.length}`. Additionally `src/components/TitleOverlay.tsx:50` states `"Meet nine neighbors..."` and `src/game/engine.test.ts:44` hard-asserts `RESIDENT_ORDER.length === 9`.

### Gap M2A-5 — Unwired 5-Layer Outputs & Seasonal Leaf Limitations (`environmentRenderer.ts`, `willowLaneDiorama.ts`)
- **Severity**: Low-Medium (documented scope gap between pure composer and 3D scene).
- **Observation**:
  - `composeEnvironmentState()` outputs `weather.puddlesActive`, `npcTouches.claraPastryBasketVisible`, `npcTouches.minaGreenhouseStage` (`1..3`), and `npcTouches.arthurEarlyPorchLamp`, but `EnvironmentVisualController` does not bind any 3D meshes or materials to those four fields (`minaGreenhouseStage` and `tomorrowForecast` are surfaced as text in `JournalDrawer.tsx`).
  - `EnvironmentVisualController` only tints `groundMat` and `groveRig` (`InstancedMesh` perimeter grove) per season. The 3 hero trees in `buildWillowLaneCourtyardProps()` (`willowLaneDiorama.ts`) use `palette.standard(STORYBOOK_PALETTE.leafSage/leafMint/leafMoss)` directly, remaining spring-green in Autumn (`audit-autumn-migrated-desktop.png`) and Winter (`audit-winter-mist-desktop.png`).
  - `showPetals` (`environmentRenderer.ts:308-310`) only renders when `effWeather === 'breezy' || (effWeather === 'sunlit' && season === 'spring')`, so autumn leaves and winter snow flurries do not drift on calm `sunlit` autumn or winter days.

### Gap M2A-6 — Minor Residual & Deferred Items
- `src/scene/models.ts` retains ~450 lines of uncalled Milestone 1 builders (`buildClayCottage`, `buildGreenhouse`, `buildOldBellGazebo`, `buildStoneFountain`, `buildClayCharacter`), exporting only the TypeScript rig interfaces actively used by `src/scene/builders/`.
- `App.tsx:497` renders `VirtualJoystick` on desktop viewports (`1440×900`) as well as mobile/touch.
- `getSaveStamp()` (`App.tsx:57-60`) excludes `npcRuntime`, `flags`, `residents`, `mailboxUnread`, and `dailyLettersRead`; `saveWorldState()` (`storage.ts:64`) skips `serializeWorldState()` sanitization at write time.
- `src/game/dialogueEngine.ts` (scheduled in `docs/audits/06` Phase C) was intentionally deferred to Milestone 2B; `recentSocial` partner awareness in `narrative.ts:98-105` is only interpolated for `nora` and `jun`.

---

## 4. Prioritized Pre-2B Cleanup vs Milestone 2B Readiness

**Is the codebase ready for Milestone 2B?**  
**Yes — architecture, simulation engine, persistence, navigation, bilateral relationships, and 5-layer environment foundation are solid.** However, Milestone 2B execution should open with a quick **Wave 0 stabilization pass** (~4 focused surgical edits) to eliminate the 4 confirmed Milestone 2A defects above before layering declarative dialogue and deeper storylines onto `src/game/`.

1. **Wave 0 (Before 2B Narrative Work)**:
   - Call initial `envController.update(...)` and initial `hudSync` setup before Frame 0 `renderer.render(scene, camera)` in `NeighborhoodCanvas.tsx`.
   - Fix `buildStorybookFountain()` (`landmarks.ts`) so `waterMesh` (`y = 0.72`) and `dryFloor` sit visibly inside an open basin rim (hollow lathe wall or torus coping above basin floor) rather than buried under `y = 0.70`.
   - Fix `JournalDrawer.tsx:92` tab bar responsiveness on `390px` (`flex-wrap` or compact mobile padding/labels so all 3 tabs remain visible and clickable).
   - Replace `{metCount}/9` with `{metCount}/{RESIDENT_ORDER.length}` in `PauseModal.tsx:43`.
2. **Proceed Immediately After Wave 0 to Milestone 2B** as specified in `docs/audits/08-milestone-2b-readiness.md`.

---

## 5. Wave 0 Addendum — Resolution & Environmental Scope Classification (2026-11-18)

### Wave 0 Verification Summary
All Wave 0A defects (`M2A-1` through `M2A-4`) and Wave 0B save-reliability issues (`getSaveStamp` coverage and `saveWorldState()` normalization) have been resolved and verified:
- **Verified**: `npm test` passes **32/32** tests (`src/game/*.test.ts` + `src/scene/*.test.ts`), `npm run lint` passes with `0` errors, `npm run build` builds cleanly.
- **Verified in Headless Chromium (`1440×900` & `390×844`, `0` console errors / `0` console warnings)**:
  - Frame 0 renders Day 14 Summer Golden Hour + restored fountain water and Day 24 Autumn Light Rain Dusk immediately upon mount.
  - Fountain stone basin shows recessed dry bed (`y = 0.525`) before restoration and shimmering water (`y = 0.65`) inside the coping rim once restored.
  - Mobile (`390×844`) `JournalDrawer` displays all 3 tabs cleanly (`grid-cols-3`, `dialogOverflowX: false`, zero clipping), and `+2h` in `World & Time` advances time & saves cleanly.
  - `TitleOverlay` copy removes hardcoded `"nine"` limit; `PauseModal` displays `{metCount}/{RESIDENT_ORDER.length}`.
  - `computeWorldSaveRevision` tracks full `WorldState` (`npcRuntime`, `flags`, `residents`, relations, mailbox, daily letters, capped `worldEvents`), `saveWorldState()` serializes via `sanitizeWorldState()`, and untouched initial Title state performs zero writes on `pagehide`.

### Explicit Classification of Remaining Environmental Items
To keep Milestone 2B and Milestone 3 scoping unambiguous, the 6 environmental items noted in Gap `M2A-5` are formally classified below:

| Item | Classification | Current State & Next Owner |
| :--- | :--- | :--- |
| **`puddlesActive`** (`src/game/environment.ts:154`) | **Missing visual integration** | Computed cleanly in `composeEnvironmentState()`; no puddle decal/cobble-sheen mesh hookup in `environmentRenderer.ts` yet. Target: Future visual polish / Milestone 2B–3. |
| **`claraPastryBasketVisible`** (`src/game/environment.ts:175`) | **Missing visual integration** | Computed cleanly in `composeEnvironmentState()`; Hearth & Crumb Bakery renders static window loaves rather than a toggleable outdoor basket mesh. Target: Future visual polish / Milestone 2B–3. |
| **`minaGreenhouseStage`** (`src/game/environment.ts:178`) | **Missing visual integration** *(HUD text already wired)* | Surfaced numerically in `JournalDrawer.tsx` (`Stage 1..3/3`), not yet driving 3D greenhouse planter stages in `environmentRenderer.ts`. Target: Future visual polish / Milestone 2B–3. |
| **`arthurEarlyPorchLamp`** (`src/game/environment.ts:188`) | **Missing visual integration** | Computed cleanly in `composeEnvironmentState()`; Copperwheel Cottage porch lamp currently shares townwide lantern/window emissive curves. Target: Future visual polish / Milestone 2B–3. |
| **Hero courtyard tree seasonal tinting** (`src/scene/prototypes/willowLaneDiorama.ts`) | **Missing visual integration** | `EnvironmentVisualController` tints `groundMat` and `InstancedMesh` perimeter grove (`groveRig`), whereas courtyard hero tree materials use static `palette.standard(...)` spring greens. Target: Future visual polish / Milestone 2B–3. |
| **Calm autumn/winter particle behavior** (`src/scene/environmentRenderer.ts:308-310`) | **Deferred feature** | Autumn amber leaf and winter snow tints exist (`petalMat`), intentionally gated to `'breezy'` weather so calm `'sunlit'` autumn/winter days stay clear (`showPetals`). Expanding calm-day drift density/cadence is deferred to Milestone 2B/3 polish. |

**Updated Milestone 2A Status**: **Verified & Milestone 2B Ready**.

