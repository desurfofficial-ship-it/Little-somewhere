# WORKLOG.md — Engineering & Design Log

Chronological log of design decisions, implementation milestones, verification results, and fixes for **LITTLE SOMEWHERE**.

---

## Entry 001 — Creative Direction Selection
- **Date**: 2026-11-18
- **Status**: Completed
- **Summary**:
  - Proposed three distinct visual design directions for **LITTLE SOMEWHERE** prior to writing application code:
    1. *Sunlit Diorama & Clay Storybook* (selected)
    2. *Coastal Terracotta & Paper-Cut Sunburst*
    3. *Nordic Moss & Lantern Twilight*
  - User selected **Sunlit Diorama & Clay Storybook**.

---

## Entry 002 — Milestone 1: Core Engine, 3D Isometric World & Storybook HUD
- **Date**: 2026-11-18
- **Status**: Completed & Verified
- **Key Deliverables**:
  - **Pure Simulation & Narrative Engine (`src/game/`)**:
    - Implemented `types.ts`, `worldMap.ts`, `residents.ts`, `narrative.ts`, `actions.ts`, `storage.ts`, `audio.ts`, and `engine.test.ts`.
    - Defined *Willow Step Cottage* (player home + porch rest + unread mailbox) and 9 residents (*Clara*, *Arthur*, *Mina*, *Jun*, *Barnaby*, *Sora*, *Toby*, *Nora*, *Pip*) with 4 daily schedule slots (`morning`, `afternoon`, `golden`, `dusk`).
    - Built the interconnected storyline (*The Silent Gazebo Bell*) with branching choices, trust levels (`0–5`), timestamped journal memories, and `computeEnvironmentState()` driving 3D world reactivity.
  - **Three.js Isometric Diorama (`src/scene/`)**:
    - Built procedural `CanvasTexture` surfaces (`textures.ts`) and composite 3–12 part clay buildings, greenhouse, lathe-geometry brass bell gazebo, stone fountain, footbridge, and rigged characters (`models.ts`).
    - Integrated `NeighborhoodCanvas.tsx` with time-of-day atmospheric transitions, `RoomEnvironment` PMREM reflections, camera-relative isometric WASD/Arrow/Virtual-Joystick movement, raycast tap-to-walk/interact, pooled chime particles, and `isSoftwareGl` `afterDraw()` pacing.
  - **Mobile-First Game Shell (`src/components/` & `src/App.tsx`)**:
    - Built `TitleOverlay`, `VirtualJoystick`, `DialogueSheet`, `JournalDrawer`, and `PauseModal` with `Fraunces` + `Plus Jakarta Sans` + `JetBrains Mono` typography and `?autostart=1` support.
- **Verification & Bug Fixes**:
  - **Unit Tests**: Caught and fixed Pip's afternoon schedule coordinate (`(-2.6, 12.2)` -> `(-3.2, 12.4)`) so all 9×4 resident schedule slots clear pond collision bounds. All 5 tests in `src/game/engine.test.ts` pass (`npx --yes tsx --test src/game/engine.test.ts`).
  - **TypeScript Fix**: Separated screen-space `ScreenVec2` (`{ x, y }`) from world-space `Vec2` (`{ x, z }`) for `VirtualJoystick`; `tsc --noEmit` and `vite build` pass with 0 errors.
  - **Browser Verification Round 1 -> Round 2 (`playwright-cli`)**:
    - Added warm cream-linen backing card to `TitleOverlay` for high contrast over 3D cottage roofs.
    - Fixed mobile (`390×844`) top HUD wrapping by making the header single-row `flex-nowrap` and compacting the location card.
    - Raised Old Bell Gazebo columns (`3.2` -> `3.7`) and enlarged/lowered the brass bell (`LatheGeometry`) so the bell silhouette reads clearly from isometric view.
    - Upgraded Mirror Pond's flat plank bridge into a multi-part footbridge with posts and handrails; deepened meadow and cobblestone texture contrast under ACES tone mapping.
    - Fixed singular/plural `"1 Memory Saved"` grammar in `JournalDrawer`.
    - Verified desktop (`1440×900`) and mobile (`390×844`) views, Willow Mailbox inspection, Jun branching dialogue sheet, Pocket Journal, and reload persistence with 0 console errors.

---

## Entry 003 — Repository Architecture & Documentation Setup
- **Date**: 2026-11-18
- **Status**: Completed
- **Summary**:
  - Authored `AGENTS.md`, `WORKLOG.md`, `HANDOVER.md`, `ARCHITECTURE.md`, `GAME_DESIGN.md`, `README.md`, `CHANGELOG.md`, and `.editorconfig`.
  - Added `"test"` script to `package.json` (`tsx --test src/game/engine.test.ts`).

---

## Entry 004 — Deep Simulation Architecture Audit & Milestone 2 Blueprint
- **Date**: 2026-11-18
- **Status**: Completed (Review Ready — Zero Gameplay Changes)
- **Key Deliverables**:
  - Audited `src/game/`, `src/scene/`, `src/components/`, `src/App.tsx`, and `src/game/engine.test.ts` across all 7 simulation, persistence, performance, and testing domains.
  - Authored six architecture audit and blueprint documents under `docs/audits/`:
    1. `01-current-simulation-audit.md`
    2. `02-npc-life-simulation-blueprint.md`
    3. `03-relationship-and-dialogue-blueprint.md`
    4. `04-environmental-simulation-blueprint.md`
    5. `05-persistence-and-performance-review.md`
    6. `06-milestone-2-implementation-roadmap.md`
- **Confirmed Baseline Verification**:
  - `npm test`, `npm run lint`, and `npm run build` verified cleanly without modifying gameplay behavior.

---

## Entry 005 — Visual Identity, Art Direction & Quality Transformation (Willow Lane Prototype)
- **Date**: 2026-11-18
- **Status**: Completed & Verified
- **Key Deliverables**:
  - **Official Art Direction Established (`docs/art-direction/`)**:
    - Authored `VISUAL_IDENTITY.md` (*PREMIUM HANDCRAFTED STORYBOOK DIORAMA*, preserving *Sunlit Diorama & Clay Storybook* warmth while raising production craft), `VISUAL_QUALITY_STANDARDS.md` (mandatory 8-item asset-review checklist), `VISUAL_AUDIT.md`, `VISUAL_TRANSFORMATION_ROADMAP.md` (Stages 0–4), and `REFERENCE_GUIDELINES.md`.
    - Updated `AGENTS.md`, `GAME_DESIGN.md`, `ARCHITECTURE.md`, and `HANDOVER.md` to enforce the official visual direction across all future development.
  - **Shared Material Registry & ACES Calibration (`src/scene/materials.ts`, `src/scene/textures.ts`)**:
    - Added cached `MaterialPalette` registry + ACES-calibrated `STORYBOOK_PALETTE` constants; calibrated meadow and cobblestone `CanvasTexture` contrast to prevent highlight wash-out.
  - **Focused 3D Visual Prototype (`src/scene/prototypes/willowLaneDiorama.ts`)**:
    - Rebuilt **Willow Step Cottage** inside exact `player_cottage` collision bounds (`7.4 × 6.4` centered at `(-14.5, 10.0)`) with stepped stone plinth, corner quoins, cream bargeboards, projecting shingle roof dormer, stone-and-brick chimney with pooled drifting smoke puffs, covered East veranda with 4 stone-seated cedar posts + fascia + hanging brass lantern + slatted porch bench/mug/throw, shuttered windows with muntins & flower boxes, stacked firewood rack, and cedar rainwater barrel.
    - Upgraded **Willow Mailbox** (stone collar, clover tufts, braced cedar post, shingled sage barrel, brass latch, peeking stamped postcard, unread flag), **Willow Lane Courtyard & Pathway** (stepping flagstones, beveled curb trim, split-rail garden fence, lantern signpost, layered shrubs, wildflowers, and 3 multi-lobe sculpted willow/birch/apple trees matched to `CIRCLE_OBSTACLES`), and **Storybook Jun** (pivoted limbs, flared courier coat, amber knit scarf, cross-body leather satchel with brass buckle & postcard, courier cap with badge, expressive catchlight eyes & blush cheeks).
  - **Immediate Technical & Audit Fixes (`src/scene/NeighborhoodCanvas.tsx`, `src/scene/models.ts`)**:
    - Replaced deprecated `THREE.Clock` with `THREE.Timer` (`0` console warnings).
    - Snapped camera directly to `playerPos` on initial `playing` mount (`?autostart=1`).
    - Dimmed `RoomEnvironment` IBL (`environmentIntensity`), hemisphere fill, and directional key smoothly into Golden Hour & Lantern Dusk so windows and lanterns read warmly at twilight.
    - Exposed `clapperMesh` on `GazeboRig` (hidden until restored), added Tea Cart canopy support posts, and closed East Plaza cobble seam gap.
- **Verification**:
  - `npm test` (`5/5` pass), `npm run lint` (`tsc --noEmit`, 0 errors), and `npm run build` (`vite build`) passed.
  - Live Chromium inspection (`1440×900` morning, Golden Hour, Lantern Dusk, Jun/Porch interaction, and `390×844` mobile) confirmed **0 console errors, 0 console warnings**.

---

## Entry 006 — Milestone 2A Phase 1: Simulation Foundation
- **Date**: 2026-11-18
- **Status**: Completed & Verified
- **Key Deliverables**:
  - **Deterministic Simulation Core (`src/game/rng.ts`, `src/game/time.ts`, `src/game/types.ts`)**:
    - Added FNV-1a seed hashing (`hashSeed`) and `mulberry32` PRNG helpers (`seededRange`, `seededInt`, `seededPick`).
    - Unified simulation clock (`DAY_START_MINUTE = 360`, `NEXT_DAY_WAKE_MINUTE = 480`, `DEFAULT_START_MINUTE = 495`, `DAY_END_MINUTE = 1290`, `DAYS_PER_SEASON = 10`) used across engine, HUD (`+2h`), and renderer (`src/App.tsx`, `src/game/residents.ts`, `src/scene/NeighborhoodCanvas.tsx`).
    - Extended `WorldState` to schema v2 (`schemaVersion`, `simSeed`, `season`, `weather`, `npcRuntime`) while preserving 100% of v1 fields.
  - **Lane Navigation & Headless Simulation (`src/game/navigation.ts`, `src/game/simulation.ts`)**:
    - Authored connected 28-node lane waypoint graph (`NAV_NODES`, `NAV_EDGES`) with A* pathfinding, collinear line-of-sight smoothing, soft actor separation (`computeSeparationVector`), and stuck recovery.
    - Built zero-GC `stepSimulationInPlace` and pure immutable `stepSimulation` driving persistent `NpcRuntimeState` inside `WorldState`.
    - Removed local `residentPositions` / `residentWalkPhase` closures from `src/scene/NeighborhoodCanvas.tsx` and surfaced live `npcRuntime` activity labels in `src/components/JournalDrawer.tsx`.
  - **Versioned Migrations & Safe Sanitization (`src/game/migrations.ts`, `src/game/storage.ts`)**:
    - Implemented sequential `v1 -> v2` save migration (`migrateV1ToV2`), per-field save sanitization (`sanitizeWorldState`), corrupt JSON recovery, and pre-migration v1 backup (`little_somewhere_world_v1_backup`).
- **Verification**:
  - `npm test`: `17/17` tests pass across `engine.test.ts`, `navigation.test.ts`, `storage.test.ts`, and `simulation.test.ts`.
  - `npm run lint` (`tsc --noEmit`) and `npm run build` (`vite build`) passed with 0 errors.
  - Headless Chromium (`1440×900`) verified live `v1 -> v2` localStorage migration (preserving Day 3, trust, flags, memories), `+2h` advancing into Lantern Dusk, live Journal status, and 0 console errors/warnings.

---

## Entry 007 — Milestone 2A Phase 2: NPC Ambient Life
- **Date**: 2026-11-18
- **Status**: Completed & Verified
- **Key Deliverables**:
  - **Resident Traits & Autonomous Activities (`src/game/types.ts`, `src/game/residents.ts`, `src/game/simulation.ts`)**:
    - Added `ResidentTraits` (`sociability`, `outdoorsiness`, `morningLark`, `curiosity`, `preferredZones`, `rainBehavior`) and distinct per-resident `RESIDENT_EXTRA_ACTIVITIES` pools (errands, fountain/planter admiration, sketching, music, rain-sheltered awnings gated via `onlyWeathers`).
    - Replaced static schedule arrival with seeded utility selection (`selectActivityForResident`) driven by `simSeed`, `day`, `blockIndex`, weather, and unlocked `StoryFlags`, recording bounded `npcActivityHistory` per resident.
  - **NPC-to-NPC Social Encounters & Cooldowns (`src/game/simulation.ts`)**:
    - Added deterministic `ActiveSocialEncounter` pairing within `7.5 m` when both residents are idle, off cooldown (`SOCIAL_COOLDOWN_MINUTES = 95`), not next to the player, and `npcRelation.affinity >= -1` (strictly keeping estranged Clara & Arthur apart until `claraArthurReconciled`).
    - Paired NPCs walk to verified `1.28 m` conversation spots (`converse` pose), update bilateral `npcRelations`, log bounded `worldEvents`, and cleanly pause/clear via `interruptSocialEncounter()` when the player talks to either participant.
  - **Bilateral Relationships & Narrative Defect Fixes (`src/game/relationships.ts`, `src/game/actions.ts`, `src/game/narrative.ts`, `src/game/migrations.ts`, `src/components/DialogueSheet.tsx`, `src/components/JournalDrawer.tsx`)**:
    - Implemented `PlayerNpcRelation` (continuous `0..100` affinity mapped to `0..5` hearts) and `NpcNpcRelation` matrix with lore-accurate baseline bonds and daily non-milestone small-talk capping (fixing the Day 1 trust-farming exploit).
    - Fixed `nora_read_together` missing `mem_lost_postcard`, aligned `toby_clapper` `requiresFlag: 'heardBellMystery'`, added missing-node fallback in `DialogueSheet`, wove same-day social encounter awareness into neighbor greetings, and surfaced *Recent Lane Moments* in `JournalDrawer`.
- **Verification**:
  - `npm test`: `23/23` tests pass (`engine.test.ts`, `navigation.test.ts`, `relationships.test.ts`, `simulation.test.ts`, `storage.test.ts`).
  - `npm run lint` (`tsc --noEmit`) and `npm run build` (`vite build`) passed with 0 errors.
  - Headless Chromium (`1440×900`) verified live autonomous simulation, *Recent Lane Moments* population in Pocket Journal, and 0 console errors/warnings.

---

## Entry 008 — Milestone 2A Phase 3: Visual Transformation
- **Date**: 2026-11-18
- **Status**: Completed & Verified
- **Key Deliverables**:
  - **Town-Wide Vegetation, Perimeter, Hollow Oak & Mirror Pond (`src/scene/builders/vegetation.ts`)**:
    - Replaced generic perimeter stone wall blocks and lollipop `DodecahedronGeometry` instanced trees with a 3-draw-call `InstancedMesh` grove (flared `LatheGeometry` trunks + two overlapping sculpted organic crown layers per tree), natural fieldstone + cedar split-rail + hedgerow borders, soft distant rolling hills, gnarled **Hollow Oak** with flared buttress roots & North-East root cavity housing the brass glint, and natural stone-coped **Mirror Pond** (lily pads, cattails, arched cambered cedar footbridge).
  - **Hero Landmarks & Shop Cottages (`src/scene/builders/landmarks.ts`, `src/scene/builders/buildings.ts`)**:
    - Elevated **Old Bell Gazebo** (stepped octagonal dais, South entrance steps, plinth-mounted cedar columns with knee braces & open-front balustrade, tiered shingled cupola spire, `LatheGeometry` brass bell + yoke + rope, removable climbing ivy, marigold festival bunting) and **Mossy Stone Fountain** (octagonal apron, beveled coping, moss tufts, `LatheGeometry` fluted pedestal & catch-bowl, bronze spouts, water shimmer & droplets).
    - Upgraded **Hearth & Crumb Bakery** (post-supported striped awning, exterior brick/stone bake-oven, window display shelf with sourdough loaves, menu A-frame, café tables with linen runners & mugs), **Linden Book Nook** (post-supported awning, outdoor rolling book cart with colorful spines), **Copperwheel Cottage**, **Pinecone Woodshop**, **Sunbeam Greenhouse**, **Sora's Tea Cart** (spoked wheels, kettle, teacups, 4-post striped canopy), **Noticeboard** (3 toggleable flyers under shingled hood), and grounded plaza stone/iron lamps + festoon swag wire.
  - **Full Cast Storybook Character Rigs & Contextual Poses (`src/scene/builders/characters.ts`, `src/scene/models.ts`, `src/scene/NeighborhoodCanvas.tsx`)**:
    - Built articulated `CharacterRig` figures (`THREE.Object3D` hip/shoulder joint pivots) for the Player and remaining 8 residents matching `buildStorybookJun` craft (aprons, waistcoats/pocket watches, spectacles, loupe, straw/beret/cap/hood/bun styling, catchlight eyes, blush cheeks, sculpted noses, violin, sketchbook, watering can, bread basket).
    - Implemented zero-GC `animateCharacterRig()` driving Phase 2 `NpcAnimationState` poses (`walk`, `work`, `sketch_read`, `music`, `converse`, `admire`, `idle`), closed south/east cobble spurs, removed per-frame closures inside `tick()`, and fixed duplicate bell burst triggers.
- **Verification**:
  - `npm test` (`23/23` pass), `npm run lint` (`tsc --noEmit`, 0 errors), and `npm run build` (`vite build`) passed.
  - Headless Chromium inspection across Title (`1440×900`), Plaza & Pond gameplay (`1440×900`), and Mobile (`390×844`) confirmed cohesive *PREMIUM HANDCRAFTED STORYBOOK DIORAMA* craft and `0` console errors / `0` console warnings.

---

## Entry 009 — Milestone 2A Phase 4: Environmental Foundations & Verification
- **Date**: 2026-11-18
- **Status**: Completed & Verified
- **Key Deliverables**:
  - **Five-Layer Environment Composer (`src/game/environment.ts`, `src/game/environment.test.ts`)**:
    - Implemented deterministic pure `composeEnvironmentState()` combining Time of Day, Weather (`sunlit`, `breezy`, `misty_morning` clearing after 10:30 AM, `light_rain` with deterministic `rollWeatherForDay()`), 10-day Seasonal Transitions (`spring`, `summer`, `autumn`, `winter` palettes), Player-Driven `StoryFlags`, and NPC-Driven daily touches (`noticeboardFlyerCount`, `minaGreenhouseStage`, `claraPastryBasketVisible`, `arthurEarlyPorchLamp`) with a deterministic `revision` stamp.
  - **Dirty-Flagged Visual Controller & Instanced Weather FX (`src/scene/environmentRenderer.ts`, `src/scene/NeighborhoodCanvas.tsx`)**:
    - Added `EnvironmentVisualController` with revision-gated prop/material/window/lantern updates, season-gated tint updates for meadow and `InstancedMesh` grove foliage, continuous zero-GC atmosphere/fog/IBL curves, fixed-`dt` bell swing damping, and software-GL-capped `InstancedMesh` rain streaks (`24`/`48`) and drifting seasonal petals/leaves/flurries (`12`/`24`).
  - **HUD, Journal & Save Robustness (`src/App.tsx`, `src/components/JournalDrawer.tsx`)**:
    - Surfaced live season & weather in desktop HUD and Pocket Journal (`World & Time` tab with tomorrow's forecast, flyer counts, and greenhouse bloom stage).
    - Fixed `lastSavedStampRef` initialization in `src/App.tsx` so unchanged initial state does not spuriously write to `localStorage` on `pagehide`.
- **Verification**:
  - `npm test`: `27/27` tests pass across `engine.test.ts`, `environment.test.ts`, `navigation.test.ts`, `relationships.test.ts`, `simulation.test.ts`, and `storage.test.ts`.
  - `npm run lint` (`tsc --noEmit`) and `npm run build` (`vite build`) passed with `0` errors.
  - Headless Chromium (`1440×900` and `390×844`) verified live `v1 -> v2` localStorage migration (Day 24 Autumn, restored plaza, `little_somewhere_world_v1_backup` creation), `light_rain` / seasonal rendering, mobile layout, Pocket Journal, and `0` console errors / `0` console warnings.

---

## Entry 010 — Milestone 2A Independent Audit, Validation & Milestone 2B Readiness
- **Date**: 2026-11-18
- **Status**: Completed (Audit & Readiness Only — No Feature Code Changes)
- **Key Deliverables**:
  - Authored `docs/audits/07-milestone-2a-final-validation.md` with explicit verification statuses (`Verified`, `Partially verified`, `Not verified`, `Failed`) across Phases 1–4, persistence, performance, software WebGL, desktop/mobile rendering, and prototype extensibility.
  - Authored `docs/audits/08-milestone-2b-readiness.md` detailing Wave 0 pre-2B defect fixes, declarative `dialogueEngine.ts` + `DialogueTopic` extraction, `topicHistory` & `v2 -> v3` migration plan, relationship tiers, generalized conflict/reconciliation mechanics, multi-beat personal storylines, Pocket Journal history upgrades, tests, risks, and Milestone 3+ deferrals.
  - Updated `HANDOVER.md` with verified `28/28` test status, accurate confirmed defects/limitations, and Milestone 2B next steps.
- **Independent Audit Verification Results**:
  - `npm test` (`tsx --test src/game/*.test.ts`): **28/28 passing** (`0` failures, `731.5ms` across 6 test suites; corrects `27/27` / `5/5` references in Entry 009 & `HANDOVER.md`).
  - `npm run lint` (`tsc --noEmit`): **0 errors**.
  - `npm run build` (`vite build`): **Clean** (`1,690` modules).
  - Live Chromium (`1440×900` & `390×844`): **0 console errors, 0 console warnings**; verified Title, Day 1 gameplay, WASD + Jun dialogue, Pocket Journal (`Neighbors`, `World & Time`), reload persistence, `v1 -> v2` Day 24 Autumn migration + `little_somewhere_world_v1_backup`, `Summer · Light Rain`, `Winter · Misty Morning` clearing after `10:30 AM`, `Lantern Dusk`, and clean `titleLsAfterPagehide === null`.
- **Confirmed Milestone 2A Defects & Gaps Identified**:
  1. **Frame-0 Pre-Update Render (`src/scene/NeighborhoodCanvas.tsx:934-937`)**: Initial synchronous `renderer.render()` executes before `envController.update()`, showing uninitialized Spring/Morning defaults and unrestored props under SwiftShader until `tick()` #1 finishes.
  2. **Fountain Water Occlusion (`src/scene/builders/landmarks.ts:283-368`, `models.ts:435-466`)**: Solid `outerWall` cylinder (`top = 0.70`) buries `dryFloor` (`0.52`) and `waterMesh` (`0.62`), leaving restored fountain basin looking dry even while `spoutParticles` animate above it.
  3. **Mobile `JournalDrawer` Tab Clipping (`src/components/JournalDrawer.tsx:92-129`)**: On `390×844`, `whitespace-nowrap shrink-0` tabs clip `"Story & Memories (5/5)"` and push `"World & Time"` off-screen with no scroll indicator.
  4. **Prototype Count Hardcode (`src/components/PauseModal.tsx:43`)**: Still displays `{metCount}/9` instead of `{metCount}/${RESIDENT_ORDER.length}`.
  5. **Documented Scope Gaps**: `puddlesActive`, `claraPastryBasketVisible`, `minaGreenhouseStage`, and `arthurEarlyPorchLamp` have no 3D mesh hookups in `environmentRenderer.ts`; `willowLaneDiorama.ts` hero trees lack seasonal tinting; calm `sunlit` autumn/winter days do not emit leaves/snow (`showPetals`); `src/game/dialogueEngine.ts` remains scheduled for Milestone 2B; `getSaveStamp()` excludes `npcRuntime`/`flags`/`residents`.

---

## Entry 011 — Wave 0: Milestone 2A Stabilization & Persistence Reliability
- **Date**: 2026-11-18
- **Status**: Completed & Verified (Milestone 2B Ready)
- **Key Deliverables**:
  - **Wave 0A — Confirmed Defect Resolutions**:
    - **Fix 1 — Frame-0 Environment Sync (`src/scene/NeighborhoodCanvas.tsx`, `src/game/environment.ts`, `src/scene/environmentRenderer.test.ts`)**: Extracted `syncVisualAndHud()` inside `NeighborhoodCanvas.tsx` and invoked it at `elapsed = 0, dt = 0` immediately before the initial Frame-0 `renderer.render(scene, camera)` and loop start—synchronizing seasonal tints, weather atmosphere/fog, StoryFlags props, `questPip` cues, and initial HUD snapshot on Frame 0 without duplicating render loops or advancing simulation time early. Fixed `lanternScheduleActive` / `weatherIdx` bitmask overlap in `composeEnvironmentState()` (`src/game/environment.ts`). Added Frame-0 unit verification in `src/scene/environmentRenderer.test.ts`.
    - **Fix 2 — Fountain Basin Water Geometry (`src/scene/builders/landmarks.ts`, `src/scene/models.ts`)**: Replaced the solid `CylinderGeometry` `outerWall` (`top = 0.70`) with a hollow carved-stone `THREE.LatheGeometry` basin profile featuring a recessed floor (`y = 0.50`) and beveled coping (`y = 0.72`). Positioned `dryFloor` (`y = 0.525`) and shimmering `waterMesh` (`y = 0.65`, `r = 1.92`) cleanly inside the open stone rim so both dry stone bed and restored flowing water read unmistakably from isometric view. Added basin geometry regression test in `src/scene/environmentRenderer.test.ts`.
    - **Fix 3 — Mobile `JournalDrawer` Tab Responsiveness (`src/components/JournalDrawer.tsx`)**: Replaced horizontal clipping tabs (`whitespace-nowrap shrink-0`) with a responsive `grid-cols-3` mobile bar (`sm:flex` on desktop) so `Neighbors`, `Story & Memories`, and `World & Time` all remain visible, `>= 48px` tall, and non-overflowing at `390×844` while preserving the desktop layout.
    - **Fix 4 — Dynamic Resident Count (`src/components/PauseModal.tsx`, `src/components/TitleOverlay.tsx`, `src/game/engine.test.ts`, `src/game/simulation.test.ts`)**: Replaced `{metCount}/9` with `{metCount}/{RESIDENT_ORDER.length}` in `PauseModal.tsx`, generalized `TitleOverlay.tsx` subtitle copy (*"Meet your neighbors, discover their stories, build friendships, and help a little world bloom."*), and generalized `engine.test.ts` & `simulation.test.ts` resident-count assumptions.
  - **Wave 0B — Save System & Persistence Reliability (`src/game/storage.ts`, `src/App.tsx`, `src/game/storage.test.ts`)**:
    - Implemented pure allocation-free `computeWorldSaveRevision(state)` in `src/game/storage.ts` covering `npcRuntime`, `flags`, `residents`, `playerRelations`, `npcRelations`, `activeEncounters`, `worldEvents` (even at cap), `npcActivityHistory`, `mailboxUnread`, `dailyLettersRead`, `memories`, and quantized `playerPos` while excluding ephemeral `walkPhase`/`stuckSeconds` jitter.
    - Updated `src/App.tsx` (`getSaveStamp = computeWorldSaveRevision`), expanded `hasSavedProgress`, ensured `visibilitychange`/`pagehide` flushes dirty saves across both `'playing'` and `'paused'` states while strictly avoiding writes on untouched initial/title worlds, and routed `saveWorldState()` through `serializeWorldState(state)` (`sanitizeWorldState` normalization).
    - Added comprehensive persistence regression tests in `src/game/storage.test.ts` and registered `src/scene/*.test.ts` in `package.json` `"test"`.
  - **Environmental Scope Classification (`docs/audits/07` & `08`)**: Classified `puddlesActive`, `claraPastryBasketVisible`, `minaGreenhouseStage`, `arthurEarlyPorchLamp`, hero courtyard tree tinting, and calm autumn/winter particle behavior clearly across missing visual integrations vs deferred features without premature Milestone 2B/3 implementation.
- **Verification**:
  - `npm test`: **32/32 passing** (`0` failures across `src/game/*.test.ts` and `src/scene/*.test.ts`).
  - `npm run lint` (`tsc --noEmit`): **0 errors**.
  - `npm run build` (`vite build`) + `compile_applet`: **Clean**.
  - Live Chromium (`1440×900` & `390×844`): **0 console errors, 0 console warnings**; verified Title copy & untouched-Title `pagehide` no-write, immediate Frame-0 Day 14 Summer Golden Hour + visible fountain water & Day 24 Autumn Light Rain Dusk, `390×844` mobile HUD & `JournalDrawer` tabs (`scrollW === innerW === 390`, `dialogOverflowX: false`, zero clipping), PauseModal `/9` readout, `v1 -> v2` backup migration, and reload persistence.

---

## Entry 012 — JournalDrawer Tab Accessibility & Fountain Dry/Repaired Visual Accuracy Polish
- **Date**: 2026-11-18
- **Status**: Completed & Verified
- **Key Deliverables**:
  - **`src/components/JournalDrawer.tsx`**: Added full WAI-ARIA tab semantics (`role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `role="tabpanel"`, `ArrowLeft`/`ArrowRight`/`Home`/`End` keyboard navigation), `min-w-0 w-full sm:w-auto` grid overflow safeguards across all 3 mobile tabs (`Neighbors`, `Story & Memories`, `World & Time`), responsive mobile spacing/wrapping on resident cards, and full-width mobile centering on the `Advance 2 Hours` button.
  - **`src/scene/builders/landmarks.ts` & `src/scene/models.ts`**: Fixed `dryFloor` material in `buildStorybookFountain` from blue-slate (`#4E6E74`, which visually resembled water even while dry) to weathered warm stone (`#8E8475`), added matching `dryFloor` separation to `buildStoneFountain`, and attached surface ripple rings plus an upper catch-bowl water disc as children of `waterMesh` so the repaired state is unmistakably watery while preserving the hollow `LatheGeometry` stone wall and coping rim.
  - **`src/scene/environmentRenderer.test.ts`**: Expanded fountain geometry regression assertions across both `buildStorybookFountain` and `buildStoneFountain` to enforce recessed stone walls, warm dry-bed color distinction, elevated `waterMesh`, and ripple/pool sub-details.
- **Verification**:
  - `npm test`, `npm run lint` (`tsc --noEmit`), `compile_applet`, `lint_applet`, and `npm run build` all pass with 0 errors.
  - Live Chromium (`390×844` & `1440×900`): Verified zero horizontal overflow across all 3 `JournalDrawer` tabs (`docScrollW === 390`, `dlgScrollW === 368`, `panelHasOverflowX === false`) and clear visual separation between the dry stone fountain basin (`v2-fountain-dry.png`) and repaired flowing fountain (`v2-fountain-repaired.png`) with 0 console errors.

---

## Entry 013 — Player & Character Excellence Upgrade (Full Capability Polish)
- **Date**: 2026-11-18
- **Status**: Completed & Verified
- **Key Deliverables**:
  - **Baseline Type & Material Fixes (`src/game/types.ts`, `src/scene/builders/landmarks.ts`)**:
    - Exported `DialogueTopic` interface from `src/game/types.ts` to resolve `dialogueEngine.ts` / `narrative.ts` TypeScript imports.
    - Fixed invalid `STORYBOOK_PALETTE` keys inside `buildCarryablePropMesh()` (`landmarks.ts`) so `water_pail`, `rosemary_basket`, `chalk_bundle`, `tea_tray`, and `lost_parcel` use valid palette constants and crisp storybook hex colors.
  - **Player Locomotion, Sitting, Carrying & Camera Polish (`src/game/playerController.ts`, `src/scene/builders/characters.ts`, `src/scene/NeighborhoodCanvas.tsx`, `src/App.tsx`)**:
    - Added exported `computeSitGroundY(seatHeight, heightScale)` so seated pelvis/coat heights align flush on cedar slats across all character scales (`0.86` Pip to `1.08` Barnaby).
    - Upgraded tap-to-walk in `NeighborhoodCanvas.tsx` to route via A* `computeWaypointPath` + `findNearestWalkablePoint`, track moving NPCs dynamically, and recover cleanly from blocked paths (`tapStuckSeconds > 1.0`).
    - Fixed inverted `carry` arm Z-rotation (`+0.14` / `-0.14`) so arms cradle held props snugly inside `carrySocket`, added subtle idle breathing/weight-shift/glance micro-motion and `walk`/`run`/`sprint` torso counter-twist, and added contextual `playerActionPulse` (`interact`, `talk`, `wave`).
    - Smoothed occlusion fade (`THREE.MathUtils.damp`), added gentle dialogue midpoint camera framing (`smoothedDialogueZoom = 0.9`, `smoothedDialogueDropY = -0.42`), and tinted proximity rings sage-green (`#6FA873`) when holding a resident-liked gift.
    - Fixed mobile (`390×844`) `VirtualJoystick` flex squishing (`shrink-0` in `VirtualJoystick.tsx`) and tightened bottom HUD hint/CTA widths in `App.tsx`.
  - **NPC Intelligence, Narrative, Dialogue & Daily Props (`src/game/simulation.ts`, `src/game/dialogueEngine.ts`, `src/game/narrative.ts`, `src/game/storage.ts`, `src/components/DialogueSheet.tsx`)**:
    - Locked spoken-to residents in `'talk'` / `'sit'` facing the player during active dialogue (`activeDialogueResidentId`), triggered instant `'wave'` pose on spontaneous greeting bubbles, and added hard stuck-waypoint recovery (`stuckSeconds > 2.8`).
    - Added held liked-item conversational greetings, `make_amends_<residentId>` trust-recovery choices after blunt replies, `conflict_barnaby_arthur_rafters` (`conflict_reconciliation` topic), `event_gift_thanks` (`event_reaction` topic), emotion/tier-tailored dialogue closing buttons (`Step Back Gently` / `Wave Warmly` / `Wave Goodbye`), and morning reset of resident-delivered props back to `homePos` on `advanceToNextDay`.
- **Verification**:
  - `npm test`: **46/46 passing** (`0` failures across `src/game/*.test.ts` & `src/scene/*.test.ts`).
  - `npm run lint` (`tsc --noEmit`), `compile_applet`, and `npm run build` all pass with **0 errors**.
  - Live Chromium (`1440×900` & `390×844`): **0 console errors, 0 console warnings**; verified Title screen, WASD + Shift sprint, Jun dialogue framing & reply/wave close, carryable `Copper Water Pail` cradle & sage gift ring around Arthur, `Mirror Pond Bench` flush sitting pose, `Pocket Journal` tabs, `390×844` circular `VirtualJoystick` drag with zero horizontal overflow, and `v2 -> v3` Day 3 state migration.

---

## Entry 014 — Bench Back-Clipping Fix & Mirror Pond / Mossy Stone Fountain Full Upgrade
- **Date**: 2026-11-19
- **Status**: Completed & Verified
- **Key Deliverables**:
  - **Bench Sitting Back-Clearance Fix (`src/scene/builders/landmarks.ts`, `src/scene/builders/characters.ts`, `src/scene/environmentRenderer.test.ts`)**:
    - Recessed the cedar bench backrest slats and tilted iron stiles/spindle (`backrestFrontZ = -0.262`, seat slats deepened forward `z = -0.17..+0.22`) in `buildStorybookBench()`.
    - Adjusted seated hip/skirt offset (`targetBodyZ = 0.19`, thigh pitch `-1.18`) in `animateCharacterRig('sit')` so coats, hair buns/hoods, backpacks, and props clear the backrest cleanly across all character proportions (`player`, `clara`, `toby`, `barnaby`, `sora`, `jun` verified via `THREE.Box3` clearance regression test).
  - **Water Shader Foundation (`src/scene/waterShaders.ts`)**:
    - Added custom PBR `onBeforeCompile` shaders (`createStorybookPondWaterMaterial`, `createStorybookFountainWaterMaterial`, `createStorybookWaterStreamMaterial`) with deterministic `userData.waterUniforms` driving flowing caustics, depth gradation, lapping shoreline foam, raindrop rings, expanding coin-wish/pebble-skip concentric waves, winter crystalline frost/ice, and warm dusk lantern reflections.
  - **Mirror Pond & West Culvert Brook Upgrade (`src/scene/builders/vegetation.ts`, `src/scene/environmentRenderer.ts`, `src/game/actions.ts`, `src/game/worldMap.ts`)**:
    - Replaced the flat pond ellipse with a smooth `SplineCurve`/`ShapeGeometry` shoreline and west brook culvert passing under and past the cedar footbridge between mossy boulders, layered sandy shoal, 18 submerged pebbles, 3 articulated figure-8 swimming koi fish (`KoiFishRig`), 6 notched lily pads with marigold blooms, wind-swaying cattails and blue-flag iris, 2 skimming dragonflies, a north skipping-stone ledge, and a limestone-anchored south-east viewing pier with moored walnut sailboat (cabin trim + coral masthead pennant) and brass pier lantern.
    - Added `'mirror_pond'` (`Mirror Pond Bank`) prop interaction allowing stone skipping (`performPondStoneSkipAction`, `mem_pond_skip` memory, `cozyAudio.playWaterSplash()`).
  - **Mossy Stone Fountain Upgrade (`src/scene/builders/landmarks.ts`, `src/game/actions.ts`, `src/scene/NeighborhoodCanvas.tsx`)**:
    - Upgraded `buildStorybookFountain` with a 2-step octagonal apron, carved double-moulded `LatheGeometry` basin + 8 pilasters, moss cushions, brass spring valve wheel, pre-repair dry autumn leaves/twig (`clogDebrisGroup`) vs post-repair 8 glistening submerged wishing coins (`submergedCoinsGroup`), 4 bronze spouts + collars + upper overflow weirs, curved aerated `TubeGeometry` cascades (`cascadeGroup`), splash rings + foam collars, and 20 pooled ballistic droplets.
    - Replaced golden chime octahedrons on water actions with a zero-GC pooled aqua/white `splashParticles` droplet burst in `NeighborhoodCanvas.tsx`, keeping golden chimes exclusively on the Gazebo Bell; wired `'fountain_wish'` (`Toss a Lucky Coin`, `performFountainWishAction`, `mem_fountain_wish`).
- **Verification**:
  - `npm test`: **49/49 passing** (`0` failures across `src/game/*.test.ts` and `src/scene/*.test.ts`).
  - `npm run lint` (`tsc --noEmit`), `compile_applet`, and `npm run build` all pass with **0 errors**.
  - Live Chromium (`1440×900` & `390×844`): **0 console errors, 0 console warnings**; verified unobstructed West Plaza Bench sitting clearance (`r2-bench-sit-clear.png`), repaired Fountain coin-wish ripple & cascades (`r2-fountain-wish.png`), Mirror Pond Lantern Dusk stone-skip ripple + emerging west brook + anchored pier & sailboat (`r2-pond-skip-dusk.png`), and zero-overflow `390×844` mobile Mirror Pond bottom sheet (`r2-mobile.png`).

---

## Entry 015 — Milestone 2B Phase 1 (1A Inventory & 1B Declarative Dialogue Engine Consolidation)
- **Date**: 2026-11-19
- **Status**: Completed & Verified (Phase 1 Regression Checkpoint — Pending Phase 2 Authorization)
- **Key Deliverables**:
  - **Phase 1A Content & Migration Inventory (`docs/milestones/09a-dialogue-content-inventory.md`)**:
    - Cataloged all 42 `DIALOGUE_TOPICS`, 8 `CONCURRENT_QUEST_MILESTONES`, 3 dynamic engine flows (`resolveGreetingPrefix`, `buildDynamicGiftChoice`, `make_amends_<id>`), prop/mailbox text, all 18 `JournalMemory` IDs, 10 `sideFlags`, and 7 audit findings (`DUP-01`, `DUP-02`, `UNR-01`, `CON-01`, `SIG-01`, `ASYM-01`, `HARD-01`).
  - **Phase 1B Engine & Predicate Scalability (`src/game/types.ts`, `src/game/dialogueEngine.ts`)**:
    - Extended `DialogueCondition` (`minTier`, `maxTier`, `requiresWeatherNot`, `requiresPosture`, `requiresNpcMemoriesAny`, `excludesNpcMemories`, `requiresStoryline`) and `DialogueChoice` (`minAffinity`, `minTier`, `requiresCondition`).
    - Added overloaded backward-compatible `isChoiceAvailable()` accepting both `(choice, world, residentId)` and legacy `(choice, flags, trust, sideFlags)` signatures (`SIG-01`).
    - Added per-resident `topicHistory` keying (`getTopicHistoryKey` / `getTopicHistoryEntry`) for `residentId === 'any'` topics while reading legacy global `topicHistory[topicId]` (`CON-01`).
    - Exported declarative builders (`phaseGreet`, `makeSimpleTopic`, `makeBranchingTopic`) and surfaced actor-local `resolveContextFlavorRemark()` (bench seat & same-day `npc_social` partner whisper) on `daily_slice` conversations (`UNR-01`).
  - **Narrative Consolidation & Wiring (`src/game/narrative.ts`, `src/game/actions.ts`, `src/components/DialogueSheet.tsx`, `src/App.tsx`)**:
    - Replaced imperative concurrent milestone branching with declarative `CONCURRENT_QUEST_MILESTONES` data definitions, removed the duplicate `arthur_restore_bell` copy (`DUP-01`), converted all 5 main quest topics to `makeBranchingTopic()`, and replaced inline array spreads with declarative choice conditions.
    - Updated `applyDialogueChoice()` (`actions.ts`) and `DialogueSheet.tsx` (`App.tsx` passing `world={worldSnapshot}`) to evaluate `isChoiceAvailable(choice, world, residentId)` and record `topicHistory` under `session.topicHistoryKey ?? session.topicId`.
    - Schema remains cleanly at `WorldState` `v3` (`CURRENT_SCHEMA_VERSION = 3`).
- **Verification**:
  - `npm test`: **55/55 passing** (`0` failures across `src/game/*.test.ts` and `src/scene/*.test.ts`, including 10 tests in `dialogue.test.ts`).
  - `npm run lint` (`tsc --noEmit`), `compile_applet`, and `npm run build` (`vite build`) verified with **0 errors**.





---

## Entry 017 — Roadmap Build 1: R-01 Golden/Dusk Lighting Drama + R-03 Touch-Only Thumbstick (P1 items)
- **Date**: 2026-11-19
- **Status**: Completed & Verified
- **Key Deliverables** (per `docs/audits/09-comprehensive-asset-visual-audit.md` roadmap, user-approved "continue building"):
  - **R-01 Golden & Dusk Lighting Drama (`src/scene/environmentRenderer.ts`)**:
    - Deepened golden-hour warmth: sky `#F5CFA0` -> `#F2C28C`, sun `#FFB266` -> `#FF9D4A`; dusk deepened toward true twilight: sky `#6F7FA8` -> `#4C5B8F`, sun `#97AEE0` -> `#8099D8`, hemi sky `#5B71A8` -> `#47568C`, hemi ground `#3F3D52` -> `#34324A`.
    - Ambient falloff at dusk hardened per audit targets: hemisphere intensity floor 0.34 -> **0.22**, IBL `environmentIntensity` floor 0.24 -> **0.15**, sun intensity floor 0.58 -> **0.44** — glowing windows, lanterns, festoon bulbs and fireflies now read against genuinely dim twilight instead of noon ambient.
    - Sun path drama: azimuth sweep lengthened (0.5..2.4 -> 0.42..2.6 rad) and elevation curve lowered with a hard floor (`max(8, 24 - |tNorm-0.44|*30)`, was a flat `26 - |tNorm-0.5|*10`), so golden hour now casts long raking shadows and dusk sun sits low.
    - Glow contrast raised: dusk window emissive 1.75 -> **2.1**, golden 0.78 -> **0.9**, dusk lantern 1.85 -> **2.15**, dusk prototype lanterns 2.1 -> **2.35**.
    - Dusk assertions in `environmentRenderer.test.ts` updated to the new emissive targets (2.1 / 2.15).
  - **R-03 Touch-Only VirtualJoystick (`src/App.tsx`)**:
    - Added `hasTouchInput` gate: `(pointer: coarse)` media query OR `navigator.maxTouchPoints > 0`; the thumbstick now renders only on touch-capable devices, with an inert hidden spacer preserving the bottom-bar flex layout on desktop.
- **Verification**:
  - `npm test`: **55/55 passing**, `npm run lint`: **0 errors**, `npm run build`: pass.
  - Live headless Chromium desktop `1440×900`: Golden Hour 4:18 PM capture shows warm amber cast + long shadows; Lantern Dusk 8:20 PM capture shows deep twilight with high-contrast window/lantern/festoon glow; thumbstick confirmed **absent** on desktop (`aria-label` probe); **0 console errors, 0 page errors**.

---

## Entry 018 — Roadmap Build 2: R-04 Grass Tufts + R-05 Meadow Macro Variation + R-06 Legacy Builder Removal (P2 items)
- **Date**: 2026-11-19
- **Status**: Completed & Verified
- **Key Deliverables**:
  - **R-04 Sculpted Grass Tufts (`src/scene/builders/botanicalDressing.ts`)**:
    - Replaced the primitive single 5-sided cone tuft with a merged 3-blade tuft: three open-ended 4-sided tapered cones (heights 0.36/0.30/0.25, staggered leans ±0.13–0.22 rad, fanned at 120°) merged via `mergeGeometries` into one BufferGeometry.
    - Same `InstancedMesh`, same budget (104 GPU / 64 software-GL), same placement legality, per-instance tint unchanged -> still a single draw call; ~12 tris per tuft.
  - **R-05 Meadow Macro Variation (`src/scene/textures.ts`, `src/scene/NeighborhoodCanvas.tsx`)**:
    - New `createMeadowMacroTexture` (256², ~256 KB, seeded 77): broad soft warm/cool luminance patches (0.78–1.0 darken-only) + two anchored radial gradients.
    - Applied as `groundMat.lightMap` over a cloned second UV channel (`uv1`) at repeat 2x2 vs the detail map's 9x9 — breaks the visible blotch tiling of the 512² meadow texture across the 110 m plane without a second full-size texture; season tint still multiplies on top; ground geometry now disposed on cleanup.
  - **R-06 Legacy Dead Builder Removal (`src/scene/models.ts`, `src/scene/environmentRenderer.test.ts`)**:
    - Deleted `buildClayCottage`, `buildGreenhouse`, `buildStoneFountain` and their `CottageOptions`/`makeMat` helpers (~370 dead lines); folded the fountain dry-bed/water-level/lathe-basin assertions into a `buildStorybookFountain`-only test.
    - `models.ts` now contains only the live rig type contracts (`GazeboRig`, `FountainRig`, `KoiFishRig`, `MirrorPondRig`, `CharacterRig`) with a provenance note.
- **Verification**:
  - `npm test`: **59/59 passing**, `npm run lint`: **0 errors**, `npm run build`: pass.
  - Live headless Chromium desktop `1440×900` morning capture + 3x zoom crops: tufts read as fanned multi-blade clumps (no cone silhouettes), macro light/dark patches visibly break the 9x9 meadow tiling at mid zoom; **0 console errors, 0 page errors**.

---

## Entry 019 — Roadmap Build 3: R-07 Copperwheel Signature Props + R-08 Title Framing + R-09 Scene Chunk Split (P2 items)
- **Date**: 2026-11-19
- **Status**: Completed & Verified
- **Key Deliverables**:
  - **R-07 Copperwheel Cottage dressing (`src/scene/builders/buildings.ts`)** — the thinnest-dressed building now carries three workshop signature props beside the existing clock gable emblem:
    - Brass vent pipe + elbow + sphere cap on the roof ridge beside the chimney;
    - Wall-mounted bronze gear medallion (12-seg hub, brass core, 8 teeth) left of the south door (porch lamp occupies the right side);
    - Weathered workbench crate with lid rim, 4 brass bolts, and a leaning cedar ruler.
    - All props sit inside `BOX_OBSTACLES['workshop_arthur']` (group-local |x| <= 3.3, z <= 3.3), palette-cached materials, cast shadows on, ~230 extra triangles. Obstacle bounds and navigation untouched.
  - **R-08 Title framing (`src/scene/NeighborhoodCanvas.tsx`, `src/components/TitleOverlay.tsx`)**:
    - Title-orbit gaze biased east (`lookAt(1.5, 1.4, -2.5)`, was `0, 1.4, -2.5`) so west-side rooflines (Bakery / Book Nook) clear the top-left card during the orbit; verified live across 4 orbit phases.
    - Title card vertical padding slimmed (`p-5 sm:p-7` -> `p-4 sm:p-5.5`) to shrink the covered viewport area.
  - **R-09 Scene chunk split (`src/App.tsx`)**:
    - `NeighborhoodCanvas` now loads via `React.lazy` dynamic import behind a `<Suspense>` cream-sky fallback; types moved to a standalone `import type` line.
    - Bundle: single 1.08 MB chunk -> **407.97 kB main shell + 719.62 kB deferred scene chunk** (first-paint JS -62%); single-mount canvas lifecycle preserved; title screen renders immediately, canvas mounts as the chunk arrives.
- **Verification**:
  - `npm test`: **59/59 passing**, `npm run lint`: **0 errors**, `npm run build`: pass.
  - Live headless Chromium desktop `1440×900`: title orbit re-captured at 4 phases (card overlap reduced to gazebo dais edge only), Copperwheel gear medallion / vent pipe / crate confirmed on the workshop facade, "Begin Your Day" -> playing transition clean; `390×844` title capture shows zero horizontal overflow; **0 console errors, 0 page errors**.

---

## Entry 020 — Milestone 2B Phase 2: Simulation-Driven Relationships, Greeting Modulation, Tier Icons & Milestone Avatar Pulse
- **Date**: 2026-11-19
- **Status**: Completed & Verified (Paused at Phase 2 Regression Checkpoint pending review before Phase 3)
- **Key Deliverables**:
  - **Coherent Bidirectional Affinity & Negative Setbacks (`src/game/relationships.ts`, `src/game/migrations.ts`)**:
    - Negative/blunt dialogue choices (`isNegative`) now coherently lower derived `residents[id].trust` via `getHeartLevel(nextAffinity)` instead of keeping an inflated trust floor, and subsequent warm conversations soften `'frustrated'`/`'angry'` emotions back to `'relaxed'`.
    - `sanitizePlayerRelations()` preserves genuine negative affinity setbacks across save/reload (`negativeCount > 0 || rawAffinity > 0`) without snapping affinity back up to `trust * 20`, while keeping `WorldState` at `schemaVersion: 3`.
    - Added exported `TIER_RANK`, `getNpcRelationTier`, `getNpcRelationTierLabel`, and `isResidentGuarded`.
  - **Simulation-Driven Relationship Mechanics (`src/game/simulation.ts`)**:
    - NPC greeting distance dynamically scales by relationship tier & guardedness (`0.72×` when guarded, `0.8×` for reserved strangers, `1.12×` friendly, `1.28×` close/kindred).
    - Spontaneous greeting bubbles vary cleanly across all 5 tiers (`stranger` -> `kindred`), guardedness, and first-met status.
    - Nearby `close`/`kindred` friends gain subtle `needs.social` recharge (`+0.35 * dtMinutes`) when near the player; NPC-NPC encounter pairing & affinity/tension deltas (`enc_*`) modulate via `getNpcRelationTier()`.
  - **Relationship-Fluctuating Greetings & Tier Topics (`src/game/dialogueEngine.ts`, `src/game/narrative.ts`)**:
    - Exported `resolveRelationshipGreeting(residentId, world, phase)` and upgraded `phaseGreet` + `resolveGreetingPrefix` so openings fluctuate meaningfully across all 5 tiers, guardedness, emotions, and resident `homeName`/`favoriteThing` across `daily_slice` and Arthur/Clara quest roots.
    - Added guarded opener modulation on non-quest/non-conflict/non-emotion dialogues plus `tier_acquaintance_warmup` (`talkedCountMin: 2`), `tier_friendly_confide`, `tier_kindred_promise`, and `emotion_guarded_tension` topics.
  - **Dialogue UI Tier Indicator & Milestone Avatar Bounce (`src/game/types.ts`, `src/game/actions.ts`, `src/components/DialogueSheet.tsx`, `src/index.css`)**:
    - Added inline relationship-tier icon (`UserRound`, `Sprout`, `Smile`, `HeartHandshake`, `Sparkles` with `data-relationship-tier` and accessible label) beside the resident's name in `DialogueSheet`.
    - `applyDialogueChoice()` tracks `milestonePulseSeq` & `milestoneLabel` on tier promotion, heart increase, memory unlock, or story milestones, triggering a one-shot `@keyframes avatar-milestone-bounce` animation and honey-amber ring highlight on the Dialogue avatar medallion.
- **Verification**:
  - `npm test`: **61/61 passing** (`0` failures; includes 2 new Phase 2 regression tests in `src/game/relationships.test.ts`).
  - `npm run lint` (`tsc --noEmit`): **0 errors**; `compile_applet`: **Build succeeded**.
  - Live headless Chromium (`1440×900` & `390×844`): verified Stranger Pip (`UserRound`), milestone click (`pip_promise` -> `Sprout` Acquaintance + 1 heart + `.animate-avatar-milestone` / `data-milestone-seq="1"`), Kindred Clara (`Sparkles`, personalized greeting referencing `Hearth & Crumb Bakery`), `390×844` zero horizontal overflow (`scrollWidth: 390`), and **0 console errors / 0 warnings**.

---

## Entry 021 — Milestone 3 Build 1: Fern Hollow Orchard (North District Landmark)
- **Date**: 2026-11-19
- **Status**: Completed & Verified
- **Scope**: First Milestone 3 expansion district — a fully handcrafted crabapple orchard landmark on the open meadow north of the gazebo promenade (inside existing `WORLD_BOUNDS`; no region-bounds change). Game-layer additions keep residents, schedules, dialogue, and persistence untouched.
- **Key Deliverables**:
  - **Orchard asset builder (`src/scene/builders/orchard.ts`, new)**:
    - Six instanced crabapple trees as 4 draw calls: gnarled merged lathe-and-bough trunks, wider/flatter two-lobe canopies that **share the grove's cached `grove_crown_base` / `grove_crown_top` materials** (season tint applies to the orchard for free), and 72 instanced apples (merged body+stem geometry, per-instance red/amber-green tints) hung in canopy rings plus upper lobes.
    - Stone-and-cedar gate at the promenade edge: twin stacked fieldstone piers + limestone caps (merged), arched cedar lintel with woven lattice sticks, and a hanging framed sign carrying a new seeded `createOrchardSignTexture` ("Fern Hollow Orchard" with fern sprig flourishes).
    - Harvest dressing: merged cedar ladder leaning into the west tree, crate stack with iron bands + wicker gathering basket + five loose red crabapples (dedicated red material), bee skep (lathe dome + torus rings) on a three-leg cedar stool, and a 7-stone stepping-stone path from the promenade through the gate.
    - Instanced contact-shadow discs under all six trees; every prop pivoted at y = 0, palette-cached materials, software-GL shadow gating respected. ~20 new draw calls, scene chunk +8.7 kB (719.62 -> 728.36 kB).
  - **Game layer (`src/game/worldMap.ts`, `src/game/navigation.ts`)**:
    - 12 new circle obstacles (6 tree trunks, 2 gate piers, ladder, crates, skep, bench) mirroring the builder's exported `ORCHARD_TREES` / `ORCHARD_GATE` constants exactly.
    - New landmark zone `orchard` ("Fern Hollow Orchard — Crabapples, bee skeps & dappled shade"), 5th seat spot `seat_orchard_bench` (the canvas bench loop places the cedar bench automatically), and 5 nav nodes + 5 edges linking gazebo_north -> orchard_gate -> orchard interior so tap-to-walk and A* reach the district.
  - **Tests (`src/scene/orchard.test.ts`, new)**:
    - Tree/gate positions must mirror their worldMap obstacles; gate opening admits a 0.84-wide actor; fruit instances stay within canopy bands with hand-tuned scales; crown meshes must reuse the season-tinted grove materials (identity assertion); seat approach walkable + LOS from the orchard nav node; full A* reachability from plaza_east to the orchard bench with every leg LOS-clear.
- **Verification**:
  - `npm test`: **62/62 passing on the build tree** (59 prior + 3 new orchard suites); **64/64 on the merged tree** together with Entry 020's Phase 2 regression tests. `npm run lint`: **0 errors**, `npm run build`: pass (shell 409.20 kB + scene chunk 728.36 kB).
  - Live headless Chromium desktop `1440×900` + mobile `390×844` with injected `WorldState v3` saves (`scripts/make_orchard_save.ts`): HUD location chip reads "Fern Hollow Orchard" inside the district; gate piers/arch/sign, ladder, crates, skep, bench and red loose apples all confirmed across morning / Golden Hour 4:55 PM / Lantern Dusk 9:25 PM; bench interaction prompt "Sit on Fern Hollow Orchard Bench [F]" live; **0 console errors, 0 page errors** on both viewports.

---

## Entry 022 — Documentation Synchronization, Narrative Memory Consistency & Development Baseline
- **Date**: 2026-11-19
- **Status**: Completed & Verified (Maintenance & Baseline Sync Only — Zero New Feature Milestones)
- **Key Deliverables**:
  - **Documentation Synchronization (`ARCHITECTURE.md`, `docs/art-direction/VISUAL_IDENTITY.md`, `HANDOVER.md`, `AGENTS.md`, `README.md`, `docs/milestones/09-milestone-2b-audit-and-design.md`)**:
    - Left `/GAME_DESIGN.md` untouched as the approved 12-section design authority and preserved historical entries in `WORKLOG.md` (001–021) and `CHANGELOG.md`.
    - Updated `ARCHITECTURE.md` clock bounds (`360–1290`, `6:00 AM–9:30 PM`), R-08 title orbit lookAt `(1.5, 1.4, -2.5)`, `33`-node A* nav graph + orchard/bridge obstacles, `src/scene/builders/*`, and M2A/M2B module map.
    - Updated `docs/art-direction/VISUAL_IDENTITY.md` §5 lighting bounds and palette hexes to match `src/game/time.ts` (`9:30 PM` Dusk end) and `src/scene/environmentRenderer.ts` (Morning `#FFF1D0` / `#B5D7EB`, Afternoon `#D9ECF5` / `#FFF6DF`, Golden `#F2C28C` / `#FF9D4A`, Dusk `#4C5B8F` / `#8099D8` / `#47568C`), plus §6 implemented pose wording.
    - Updated `HANDOVER.md` with the verified `66/66` test baseline, `33`-node A* navigation, `5` benches, Milestone 2B (`IN PROGRESS`: Phases 1–2 done, Phases 3–5 `PLANNED`) and Fern Hollow Orchard (`IN PROGRESS`: scenery/nav/bench done, gameplay `PLANNED`) lifecycle status, and build metrics.
    - Synced minor command/path references in `AGENTS.md`, `README.md`, and `docs/milestones/09-milestone-2b-audit-and-design.md`.
  - **Narrative Memory Consistency Fixes (`src/game/narrative.ts`, `src/game/actions.ts`, `src/App.tsx`, `src/game/dialogue.test.ts`)**:
    - **Jun's Postcard (`quest_jun_postcard` -> `jun_advice`)**: Added `mem_postcard_sent` (`"Delayed Delivery"`) with distinct gentle fresh-note summary wording while preserving `jun_advice`'s distinct label, `'gentle'` tone, `deliveredPostcard: true`, and transition to `jun_relieved`.
    - **Brass Clapper Discovery (`interactWithProp('hollow_oak')` vs `toby_clapper`)**: Direct Hollow Oak discovery after `heardBellMystery` now unlocks `mem_brass_clapper` with independent summary wording (without attributing Toby or altering Toby's trust/reward balance), reports `memoryUnlockedTitle` for audio/toast parity in `src/App.tsx`, and uses neutral/independent re-inspection text when Toby was not involved—while keeping Clara (`clara_bridge_truth`), Arthur (`arthur_restore_bell`), and Toby's non-clapper interactions intact and hiding `toby_clapper` cleanly once already recovered.
    - Preserved `WorldState` `schemaVersion: 3` and all save migrations unchanged.
- **Verification**:
  - `npm test` (`tsx --test src/game/*.test.ts src/scene/*.test.ts`): **66/66 passing** (`0` failures).
  - `npm run lint` (`tsc --noEmit`), `compile_applet`, `lint_applet`, and `npm run build` (`vite build`): **Passing (`0` errors)**.

---

## Entry 023 — Milestone 2B Phase 3 Blueprint: NPC Memory & Gossip Architecture
- **Date**: 2026-11-19
- **Status**: Completed — Architecture & Blueprint Only (Zero Code, Test, or Schema Changes)
- **Scope**: Investigated the `v3` simulation, persistence, relationship, and dialogue systems and authored the complete Milestone 2B Phase 3 design package (`docs/milestones/10`–`15`) for review and approval prior to any implementation.
- **Key Deliverables**:
  - **`docs/milestones/10-phase-3-current-system-audit.md`**: Inventoried all 10 memory/event/mood/history mechanisms, separated narrative truth vs. player journal vs. personal NPC memory vs. secondhand rumor vs. short-term affect, and documented confirmed omniscient reads and event hygiene bugs (`OMN-01`, `OMN-02`, `DUP-03`, `BUG-01`, `GAP-01`–`GAP-03`).
  - **`docs/milestones/11-phase-3-target-architecture.md`**: Designed `src/game/memories.ts`, the structured `NpcMemoryEntry` data model (compatible with `ForwardWorldHooks`), spatial (`8.5 m`) and acoustic (`30 m`) witness rules, provenance upgrade/non-downgrade invariants, priority-based bounded eviction, discrete encounter-creation gossip exchange (`propagateEncounterGossipInPlace`, zero per-frame overhead), and restrained personality-tinted distortion.
  - **`docs/milestones/12-phase-3-worldstate-migration.md`**: Specified the sequential `WorldState v3 -> v4` migration (`npcMemories` + optional `NpcNpcRelation` gossip cooldown fields), lore/flag/friction hydration, defensive sanitization, next-day expiration, `computeWorldSaveRevision` integration, and save quota budget (`~10–13 KB` typical / `~32 KB` saturated for 9 residents).
  - **`docs/milestones/13-phase-3-implementation-roadmap.md`**: Laid out 9 dependency-ordered implementation steps (`3.1`–`3.9`) with exact file targets, acceptance criteria, and regression risks.
  - **`docs/milestones/14-phase-3-test-strategy.md`**: Defined test matrix across memory creation, provenance, gossip propagation, retention/eviction, determinism, migrations/sanitization, and population scalability.
  - **`docs/milestones/15-phase-3-design-decisions.md`**: Documented fixed architectural constraints, tunable defaults (flagged non-final), and 6 explicit approval gates (`D1`–`D6`) including `v4` scoping (`D1`), non-omniscient third-party gossip transition (`D2`), `BUG-01`/`DUP-03` bundling (`D3`), rumor clarification choices (`D4`), `worldEvents` role (`D5`), and `JournalDrawer` Phase 5 boundary (`D6`).
- **Verification**:
  - Preserved `WorldState` `schemaVersion: 3` and left `src/`, `package.json`, `GAME_DESIGN.md`, `ARCHITECTURE.md`, and `HANDOVER.md` untouched; baseline checks remain at `66/66` passing tests and `0` TypeScript errors.

---

## Entry 024 — Milestone 2B Phase 3: NPC Memory & Gossip System (`WorldState v4`)
- **Date**: 2026-11-19
- **Status**: Completed & Verified (Phase 3 Only — Phase 4 Storylines & Phase 5 JournalDrawer Not Started)
- **Key Deliverables**:
  - **Core NPC Memory & Deterministic Gossip Engine (`src/game/types.ts`, `src/game/memories.ts`, `src/game/relationships.ts`)**:
    - Added canonical Phase 3 types (`NpcMemoryEntry`, `NpcMemoryProvenance`, `NpcMemorySourceKind`, `NpcMemoryCategory`, `NpcMemoryValence`, `NpcMemoryRetention`, `NpcMemoryDistortionFlavor`, `NpcMemoryDetail`), `DialogueCondition.requiresNpcMemory`, `DialogueChoice.recordNpcMemories` / `markMemoryTagsMentioned` / `markMemoryEventIdsMentioned`, `DialogueSession.surfacedMemoryEventIds`, and `NpcNpcRelation` gossip cooldown fields (`lastGossipDay`, `lastGossipMinute`, `lastGossipEventId`).
    - Implemented `src/game/memories.ts` (`MAX_NPC_MEMORIES_PER_RESIDENT = 14`, `MAX_PERMANENT_MEMORIES_PER_RESIDENT = 6`, `EPHEMERAL_RUMOR_TTL_DAYS = 5`, `DURABLE_MEMORY_TTL_DAYS = 18`, `LOCAL_WITNESS_RADIUS = 8.5`, `ACOUSTIC_BELL_RADIUS = 30`), spatial/sheltered witness discovery, provenance upgrade/non-downgrade (`firsthand` > `secondhand` > `rumor`), multi-source corroboration, permanent-quota-preserving eviction, and in-game day expiration pruning.
    - Implemented `propagateEncounterGossipInPlace` (max `1` transfer per encounter, `MAX_GOSSIP_HOPS = 2` / `1` for `friction`, `MAX_SHARES_PER_ENTRY = 3`, `GOSSIP_MIN_AFFINITY = 20`, `GOSSIP_MAX_TENSION = 30`, sensitive gate `affinity >= 38 && tension < 20`, strict 1-per-day pair cooldown via `stampNpcGossipInPlace`, and deterministic `mulberry32` personality-colored `distortionFlavor`).
  - **`WorldState v3 -> v4` Migration, Sanitization & Persistence (`src/game/migrations.ts`, `src/game/storage.ts`)**:
    - Bumped `CURRENT_SCHEMA_VERSION = 4` with sequential `v1 -> v2 -> v3 -> v4` migration (`migrateV3ToV4`), strictly hydrating evidence-backed lore/milestone/event/friction entries without manufacturing firsthand memories for uninvolved residents.
    - Added `sanitizeNpcMemories` and `NpcNpcRelation` gossip cooldown sanitization, wired `pruneExpiredNpcMemoriesInPlace` into `advanceToNextDay` (in-game day rollover), and extended `computeWorldSaveRevision` to hash `npcMemories` and pair gossip fields.
  - **Event-to-Memory Capture & Event Hygiene Fixes (`src/game/actions.ts`, `src/App.tsx`)**:
    - Fixed `DUP-03` by deduplicating `deliverHeldItemAction` so gifting emits a single `player_help` `WorldEventRecord`.
    - Fixed `BUG-01` by making `interactWithProp('gazebo_bell')` read-only and moving `bellRungCount` increment, single `bell_ring` event emission, and dynamic visual (`8.5 m`) vs acoustic (`30 m`, sheltered-inclusive `bell_chime`) witness capture into `performRingBellAction` (removing hardcoded `['clara', 'arthur', 'pip']` attribution).
    - Recorded immutable firsthand + witness memories across gifts, story flags, side stories, blunt friction, `make_amends_*`, tier breakthroughs (`friendly`/`close`/`kindred`), fountain wishes, pond stone skips, and Hollow Oak clapper discovery, plus `mentionedToPlayer` updates via `surfacedMemoryEventIds` and `markMemory*`.
  - **Discrete Encounter Gossip & Non-Omniscient Dialogue (`src/game/simulation.ts`, `src/game/dialogueEngine.ts`, `src/game/narrative.ts`)**:
    - Wired `propagateEncounterGossipInPlace` into discrete encounter creation inside `stepSimulationInPlace` and deep-cloned `npcMemories` in pure `stepSimulation` with zero per-frame gossip scanning.
    - Removed omniscient global fallbacks in `dialogueEngine.ts`: `selectThirdPartyGossipSubject`, `playerRelationWith`, and `event_*` reaction topics now read strictly from the speaker's `npcMemories`, adapting phrasing by provenance, source neighbor (`fromResidentId`), acoustic vs visual distinction, and descriptive `distortionFlavor` without introducing player clarification choices.
    - Verified `DialogueSheet.tsx` cleanly evaluates `requiresCondition` against live `worldSnapshot`; left `JournalDrawer.tsx` completely untouched for Phase 5.
- **Verification**:
  - `npm test`: **81/81 passing** (`0` failures across `src/game/memories.test.ts`, `dialogue.test.ts`, `relationships.test.ts`, `storage.test.ts`, `simulation.test.ts`, `engine.test.ts`, `environment.test.ts`, `navigation.test.ts`, `player.test.ts`, and `src/scene/*.test.ts`).
  - `npm run lint` (`tsc --noEmit`), `compile_applet`, `lint_applet`, and `npm run build` (`vite build`): **Passing (`0` errors)**.
  - Live headless Chromium (`1440×900` & `390×844` via `?autostart=1`): verified playing world, interactive porch dialog sheet, zero horizontal overflow (`1440===1440`, `390===390`), `localStorage` persisting `schemaVersion: 4` with 9 resident `npcMemories` buckets, and **0 console errors / 0 warnings**.

---

## Entry 025 — Milestone 2B Phase 4: Multi-Stage Storylines & Conflict System (`WorldState v5`)
- **Date**: 2026-11-19
- **Status**: Completed & Verified (Phase 4 Only — Phase 5 `JournalDrawer.tsx` UI Left Untouched)
- **Key Deliverables**:
  - **Declarative Storyline Registry & Engine (`src/game/types.ts`, `src/game/storylines.ts`)**:
    - Extended `WorldState` to schema `v5` (`storylines: Record<string, StorylineProgress>`), adding `StorylineStatus`, `StorylineProgress`, `StorylineStageDef`, `StorylineOutcomeDef`, `StorylineDefinition`, `StorylineAdvanceSpec`, `NpcRelationAdjustment`, `DialogueStorylineCondition.requireCooldownCleared`, `DialogueChoice.advanceStoryline` / `adjustNpcRelations`, and `'storyline_beat' | 'conflict_shift'` `WorldEventKind` variants.
    - Authored `src/game/storylines.ts` with 5 multi-stage storylines (`STORYLINES` / `STORYLINE_MAP`): 4 upgraded 3-stage personal arcs (`side_pip_zine`, `side_herb_loaf`, `side_pond_stand`, `side_jun_watch`) and 1 interconnected 3-stage neighborhood conflict (`conflict_plaza_lanterns`), plus pure helpers (`createInitialStorylines`, `cloneStorylines`, `isStorylineOnCooldown`, `hydrateStorylinesFromLegacyState`, `sanitizeStorylines`, `syncSideFlagsFromStorylineInPlace`, `advanceStorylineInPlace`, `getActiveStorylineCue`, `projectStorylineForJournal`).
  - **Migrations, Sanitization & Simulation Integration (`src/game/migrations.ts`, `src/game/storage.ts`, `src/game/simulation.ts`)**:
    - Bumped `CURRENT_SCHEMA_VERSION = 5` with deterministic `migrateV4ToV5` hydrating `storylines` from legacy `sideFlags` without manufacturing `npcMemories`, sequential `v1 -> v2 -> v3 -> v4 -> v5` migration, defensive `sanitizeStorylines`, and `computeWorldSaveRevision` tracking of storyline progress/notes/cooldowns.
    - Deep-cloned `storylines` cleanly in `stepSimulation`.
  - **Dialogue, Reducer & Knowledge-Gated Content Integration (`src/game/dialogueEngine.ts`, `src/game/actions.ts`, `src/game/narrative.ts`)**:
    - Integrated native `world.storylines` and in-game `world.day` cooldown checks (`requireCooldownCleared`) into `evaluateDialogueCondition`, removing `ForwardStorylineHooks` shims.
    - Wired `advanceStorylineInPlace`, `adjustNpcRelations`, and `'storyline_beat'` / `'conflict_shift'` `WorldEventRecord` emission into `applyDialogueChoice` without mutating input state, guarding `hasPositiveStorylineAdvance` so negative friction choices still adjust affinity/reliability properly.
    - Upgraded all 4 personal arcs to 3-stage branching paths with alternative outcomes (preserving legacy `JournalMemory` IDs `mem_side_*`), added `conflict_plaza_lanterns` (`conflict_lanterns_1_spark` -> `conflict_lanterns_2_barnaby` [non-omniscient gossip check + 1-day cooldown] -> `conflict_lanterns_3_resolve` [relationship-gated `public_harmony` + `bridge_compromise` / `gentle_space`]), and added knowledge-gated `storyline_epilogue_lanterns` and `storyline_epilogue_zine`.
    - Tuned `conflict_lanterns_1_spark` / `conflict_lanterns_2_barnaby` priorities (`7`, total `91`) below Stage 2/3 personal storyline beats (`92–95`) so personal storylines proceed without starvation when `lanternsLit` is active.
- **Verification**:
  - `npm test`: **87/87 passing** (`0` failures across `src/game/storylines.test.ts`, `storage.test.ts`, `dialogue.test.ts`, `memories.test.ts`, `relationships.test.ts`, `simulation.test.ts`, `engine.test.ts`, `environment.test.ts`, `navigation.test.ts`, `player.test.ts`, and `src/scene/*.test.ts`).
  - `npm run lint` (`tsc --noEmit`), `compile_applet`, `lint_applet`, and `npm run build` (`vite build`): **Passing (`0` errors)**.
  - Verified `src/components/JournalDrawer.tsx` remains untouched pending Phase 5.


