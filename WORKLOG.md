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

---
## Entry 026 — Milestone 2B Phase 5: Pocket Journal Upgrade & Storyline Integration
- **Date**: 2026-11-19
- **Status**: Completed & Verified
- **Key Deliverables**:
  - **Pure Player-Knowledge Journal Projection (`src/game/journal.ts`)**:
    - Built `buildPocketJournalView(world, seenKeys)` as a zero-DOM/zero-Three pure projection module reusing `projectStorylineForJournal()`, `STORYLINES`, `getStorylineProgress()`, `isStorylineOnCooldown()`, `getActiveStorylineCue()` from `src/game/storylines.ts`, `getResidentAvailableQuestCue()` from `src/game/narrative.ts`, and `composeEnvironmentState()` from `src/game/environment.ts` without modifying `src/game/storylines.ts` or bumping `CURRENT_SCHEMA_VERSION` (`5`).
    - Preserved all existing `world.memories` entries and legacy `mem_side_*` memories (`isLegacySide: true`).
    - Integrated active & completed `WorldState v5` storylines without duplicates, displaying current stage (`Part N/M`), stage hint, overnight cooldown pacing (`Settling overnight — check back on Day X.`), contributor notes, and completed outcomes—while strictly omitting hidden/unresolved `outcomeLabel` values prior to `status === 'completed'`, hiding undiscovered `locked` / stage-0 `available` storylines, and gating *The Silent Gazebo Bell* chapters 2–5 behind `world.flags.heardBellMystery`.
    - Enforced strict player-knowledge boundaries via `isNpcMemoryKnownToPlayer()` (surfacing only `mentionedToPlayer`, `sourceKind === 'player_told'`, or `sourceKind === 'participant' && subjectPlayer`), hiding unmet resident details (`!prog.met`), hiding unmentioned NPC gossip / private lore (`lore_gazebo_rift`), and filtering out private `npc_social` records from `world.worldEvents`.
    - Formatted NPC rumor and distorted memories (`provenance === 'rumor' || distorted`) in `formatNpcMemoryForPlayer()` with explicit `Unconfirmed rumor` / uncertainty-preserving wording across all distortion flavors (`uncertain`, `exaggerated`, `misattributed_motive`, `softened`), distinguishing `Secondhand word` and direct shared notes cleanly.
    - Added qualitative `getReliabilityLabel()` phrasing (`Deeply trusted`, `Steady friend`, `Warming up`, `Still cautious`, `Guarded lately`) and browser-safe `little_somewhere_journal_read_v1` New vs Read helpers (`loadJournalReadKeys`, `saveJournalReadKeys`).
  - **Notebook UI Upgrade (`src/components/JournalDrawer.tsx`)**:
    - Evolved the Pocket Journal into 4 organized sections (`Stories`, `Memories`, `People`, `Discoveries`) preserving `JournalDrawerProps`, `"Advance 2 Hours"` action, `Fraunces` / `Plus Jakarta Sans` / `JetBrains Mono` typography, and warm linen surfaces (zero `backdrop-blur`, zero `border-l-*`, zero pill-badge sandwiches, zero telemetry `%` readouts).
    - Added 2×2 mobile / single-row desktop segmented tablist with keyboard arrow navigation, crisp active-tab color swaps, `>= 44px` touch hitboxes, New vs Read visual states, and `"Mark read"` + automatic per-tab read marking on switch/close.
  - **Unit Tests & Browser Verification (`src/game/journal.test.ts`)**:
    - Added 7 deterministic test suites covering fresh-world gating, legacy `mem_side_*` saves (`v1..v5` migration compatibility), multi-stage storyline progression & deduplication, cooldown notes, strict non-omniscience boundaries, rumor/distortion uncertainty across all 4 flavors, and New vs Read tracking.
- **Verification**:
  - `npm test`: **94/94 passing** (`0` failures across all `src/game/*.test.ts` and `src/scene/*.test.ts` suites).
  - `npm run lint` (`tsc --noEmit`) & `compile_applet` (`vite build`): **Passing (`0` errors)**.
  - Live headless Chromium (`1440×900` & `390×844` via `?autostart=1`): verified Pocket Journal open/close, all 4 tabs, `>= 44px` touch targets, zero horizontal overflow, `WorldState v5` + read-state persistence across reload, screenshot visual inspection, and **0 console errors / 0 page errors**.

---

## Entry 028 — Milestone 3 Build 4: 10th Resident (Rowan, Orchard Keeper) + Fern Hollow Micro-Life (Sway Hooks, Butterflies, Skep Bees)
- **Date**: 2026-11-19
- **Status**: Completed & Verified
- **Scope**: The two remaining "next build" candidates ship together as one bulk build on the Milestone 2B Phase 5 tree: the neighborhood's **10th resident** anchors the Fern Hollow Orchard district, and the orchard comes alive with **wind-sway crowns/fruit** (sway hooks) plus weather-gated **blossom butterflies** and **skep bees**. (Cottage interiors & player polish remain reverted upstream per `refactor: revert cottage navigation graph`; Build 4 touches none of that surface.) Also repaired that revert's leftovers: removed the orphaned `src/game/cottageInterior.test.ts`, `src/scene/cottageInterior.test.ts`, and unused `src/scene/builders/cottageInterior.ts`, which still referenced the deleted `COTTAGE_INTERIOR_*` worldMap exports and broke `npm test` (SyntaxError) on the bare upstream tree.
- **Key Deliverables**:
  - **10th Resident — Rowan, Orchard Keeper (`src/game/types.ts`, `src/game/residents.ts`, `src/game/simulation.ts`, `src/game/narrative.ts`, `src/scene/builders/characters.ts`)**:
    - `ResidentId` grew to 10 entries and `propType` gained `fruit_basket`. Rowan lives at the orchard (`Fern Hollow Orchard`, homePos (-7.8, -20.0) — walkable), with a 4-phase schedule (blossom counting on the south rows, skep tending, bench journaling, keeper's-corner dusk) and **4 autonomous activities**: gate greeting, skep watch, `seat_orchard_bench` journaling (5th seat claim), and a light-rain shelter under the west canopy — all verified walkable + A*-reachable from his morning anchor by the existing suites.
    - Signature prop: a handcrafted woven gathering basket (lathe profile + torus rim) heaped with three crabapples and leaf cones, mounted on the right arm — distinct silhouette from Clara's loaf basket.
    - Simulation integration is registry-derived: `getDefaultPoseForSlot` gives Rowan work poses morning/afternoon and journal-sketching golden/dusk; evening wind-down, morning-lark behavior, traits, social encounters, memories, gossip, and pairing all derive from the shared `RESIDENT_ORDER` machinery with zero special cases.
    - Dialogue: two `daily_slice` topics (`daily_rowan_blossom` — blossom-count calendar with first-tree + crabapple-honey branches; `daily_rowan_ladder` — Barnaby's ladder + golden-hour picking with a pick-together branch). Greeting prefixes, guarded states, gift delivery (`water_pail`/`rosemary_basket` liked), amends, and gossip reuse the shared engine.
    - Saves: old `WorldState v5` saves hydrate Rowan through `sanitizeResidents`/`createInitialResidentsProgress` automatically (no migration bump needed).
  - **Orchard Sway Hooks (`src/scene/builders/orchard.ts`)**:
    - `OrchardRig.updateWind(elapsed, windStrength)`: crowns + fruit sway about a local trunk-top pivot (y 2.3) via pre-composed `T(pivot) * R * T(-pivot)` matrices; fruit composes `treeBase * swayLocal * fruitLocal` so the canopy rides **rigidly**. Wind 0 restores the authored rest pose exactly once; identical frames short-circuit; all scratch matrices are closure-level (zero-GC). Trunks + contact shadows stay anchored.
  - **Orchard Micro-Life (`src/scene/builders/orchardMicroLife.ts` new)**:
    - **Blossom butterflies** (3 software-GL / 6 full): instanced wing pairs + capsule bodies, per-blossom instance tints (cream/pale-yellow/pink/oat), six anchors hugging crowns, the gate flower strip, the bench overlook and the skep corner; analytic travel-facing yaw, wing-root flap, size flit — same zero-GC rig language as the meadow butterflies.
    - **Skep bees** (2 software-GL / 4): merged capsule+head geometry, figure-eight loops around the skep entrance with bobbing and tangent-facing yaw.
    - The rig owns its visibility (`group.visible = butterfliesActive || beesActive`); the renderer only calls `update(elapsed, { butterfliesActive, beesActive, windStrength })`.
  - **Wiring (`src/scene/environmentRenderer.ts`, `src/scene/NeighborhoodCanvas.tsx`)**:
    - `EnvironmentVisualController` gained optional `orchardRig` (drives `updateWind` in section 4 with the shared wind curve: breezy 1.0 / rain 0.65 / calm 0.25) and `orchardMicroLife` (section 6 gating: butterflies sunlit/breezy & non-dusk & non-winter; bees dry mornings-afternoons-golden & non-winter). Canvas builds, mounts, passes and disposes both rigs.
  - **Tests (`src/scene/orchard.test.ts` +2 suites, `src/scene/orchardMicroLife.test.ts` new 3 suites)**:
    - Sway: crowns+fruit respond to breeze with all 72 fruit moving, rest pose restored bit-exactly after calm, repeated calm calls are no-ops, crown pivot drift < 0.35 with tilt < 0.12 rad, fruit stays in the canopy band, no NaN. Crown meshes are identified by their shared season-tint materials (tree shadows also hold 6 instances, so counting would grab the wrong mesh).
    - Micro-life: pooled mesh counts per quality tier, anchors hug orchard fixtures inside the north district, inactive = hidden, active motion stays finite/anchored (butterflies within anchor bands, bees within 1.15 of the skep), wind only modulates drift speed.
    - `storage.test.ts` save-size bound now scales with `RESIDENT_ORDER.length` (registry-derived message + budget) instead of hardcoding 9 residents.
- **Verification**:
  - `npm test`: **99/99 passing** (`0` failures; 94 prior on the Pocket Journal tree + 5 new micro-life/sway suites, storage bound modernized for the 10th resident).
  - `npm run lint` (`tsc --noEmit`): **Passing (0 errors)**. `npm run build` (`vite build`): **Passing**.
  - Headless Chromium QA (1440×900, injected breezy-morning `WorldState v5` save parked at the orchard gate, `scripts/make_build4_save.ts` + `scripts/qa_build4.py`): `body[data-state="playing"]`, Rowan live at his morning activity (gate greeting beneath the orchard sign) with straw hat + woven fruit-basket prop, crabapple fruit visible in the swaying crowns, skep bees looping near the skep, breeze petal drift active; **0 console errors, 0 page errors** (only benign SwiftShader `ReadPixels` perf warnings from screenshot capture).
- **Asset Source Note (Permanent Instruction 15)**: All Build 4 assets are **Option A — self-built procedural Three.js** (Rowan via the shared `CharacterRig` + a new `fruit_basket` branch; butterflies/bees/sway via instanced geometry rigs). Evaluated against the alternatives: **Option B Polyfork** (production-viable) — no benefit here because the assets are tiny animated rigs that must integrate with the existing zero-GC `update()`/instance-color/season-tint contracts; an imported GLTF would add runtime weight, material-contract drift, and license/verification overhead for sub-1kB-equivalent geometry. **Option C Sandflow/SAND3D** — research-only per policy, not introduced. **Option D other external models** — not used. No external assets entered the build.

---

## Entry 029 — Milestone 2C: Everyday Life (Willow Step Cottage Interiors, Personal Satchel, Gifting & Daily Activities)
- **Date**: 2026-11-19
- **Status**: Completed & Verified
- **Scope**: Completed and fully integrated **Milestone 2C — Everyday Life** atop Milestones 2A, 2B, and 3 Builds 1 & 4, restoring and completing Willow Step Cottage interior gameplay, personal satchel inventory (`WorldState v6`), contextual item gifting & keepsakes, repeatable daily neighborhood activities, and everyday life narrative topics while preserving strict 3-layer boundaries and zero-FOMO / currency-free principles.
- **Key Deliverables & Integration Repairs**:
  - **Cottage Interior Cutaway (`src/scene/builders/cottageInterior.ts`, `src/game/cottage.ts`, `src/components/CottageStationModal.tsx`)**:
    - Implemented `buildWillowCottageInterior` matching **PREMIUM HANDCRAFTED STORYBOOK DIORAMA** with timber floors, woven rug, stone fireplace hearth with glowing embers & kettle, round oak dining table with reactive stoneware vase flowers (`placedFlowerId`), oak keepsake display shelf (`displayedKeepsakeIds`, 5 slots), sunlit sill planter, south window almanac desk + brass reading lamp, patchwork quilt bed, interior doorway, and all 7 raycast hit proxies matching `COTTAGE_INTERACTABLES`.
    - Added `computeInteriorWaypoints` hub routing in `src/game/cottage.ts` so indoor click-to-walk navigates cleanly around the center dining table (`cottage_table`), and mounted `orchardMicroLifeRig.group` inside `exteriorRoot` in `src/scene/NeighborhoodCanvas.tsx` so outdoor butterflies/bees never remain visible indoors.
  - **Personal Satchel & Gifting (`src/game/inventory.ts`, `src/components/InventoryDrawer.tsx`, `src/components/DialogueSheet.tsx`, `src/game/actions.ts`)**:
    - Added `'rowan'` gift preference profile to `RESIDENT_GIFT_PREFS` (`wild_honey`, `crabapple_tart`, `pressed_fern` loved; `crabapple`, `chamomile_pear_tea`, `lavender_sprig` liked) and his loved-gift reaction line in `buildGiftReactionLine`.
    - Enforced `min-w-[44px]` across mobile Satchel category tabs (`InventoryDrawer.tsx`), preserved separation between personal satchel (`WorldState.inventory`, 18 items, stack cap 20) and the 5 daily plaza carryable `worldProps`, and kept once-per-day-per-resident gifting with recipient/witness `npcMemories` and reciprocal `NEIGHBOR_KEEPSAKE_REWARDS`.
  - **Everyday Activities, Narrative Formatting & Pocket Journal (`src/game/narrative.ts`, `src/game/memories.ts`, `src/game/journal.ts`, `src/game/storage.ts`, `src/game/migrations.ts`)**:
    - Fixed `formatNpcMemorySummary`, `event_gift_thanks`, and `everyday_cottage_hearth` to resolve `detail.personalItemId` cleanly via `PERSONAL_ITEM_MAP` labels (e.g. `Orchard Honeycomb`, `Warm Chamomile Tea`).
    - Daily repeatable gathering spots (`cottage_window_box`, `greenhouse_planters`, `orchard_harvest`, `pond_driftwood`, indoor `cottage_planter`) advance the unified `360–1290` clock, honor once-per-day resets on `advanceToNextDay`, persist home decor & inventory in `WorldState v6`, and surface cleanly in the Pocket Journal `Discoveries` section (`Willow Step Cottage & Satchel`).
  - **Expanded Tests (`src/game/cottage.test.ts`, `src/game/storage.test.ts`, `src/game/dialogue.test.ts`, `src/scene/cottageInterior.test.ts`)**:
    - Added tests verifying indoor table-bypass waypoints, walkability of all 4 outdoor daily prop `approachPos` spots + `COTTAGE_PORCH_EXIT_POS`, `v5 -> v6` migration + backup key creation, `computeWorldSaveRevision` sensitivity to v6 fields, day rollover retention/resets, Rowan loved gift reactions, witness memories, `PERSONAL_ITEM_MAP` label formatting, and keepsake rewards.
- **Verification**:
  - `npm test`: **111/111 passing** (`0` failures across all `src/game/*.test.ts` and `src/scene/*.test.ts` suites).
  - `npm run lint` (`tsc --noEmit`) & `compile_applet` (`vite build`): **Passing (`0` errors)**.
  - Headless Chromium QA (`1440×900` & `390×844` via `?autostart=1`): verified Satchel drawer, Willow Step Cottage cutaway rendering (zero exterior leakage), Hearth tea brewing (`+15m`, `bakedCountToday: 1`, `chamomile_pear_tea: 1`), Pocket Journal `Discoveries` count update (`3/18`), `WorldState v6` `localStorage` persistence across full reload, `0` horizontal overflow on mobile (`390px`), `>= 44px` touch buttons, and **0 console errors / 0 page errors**.

---

## Entry 030 — Milestone 3 Build 2: Completing Fern Hollow Orchard
- **Date**: 2026-11-19
- **Status**: Completed & Verified
- **Scope**: Completed **Milestone 3 Build 2 — Completing Fern Hollow Orchard** atop Milestones 2A–2C (`WorldState v6`) and Milestone 3 Builds 1 & 4, connecting Fern Hollow Orchard's social routines, interactive bee skep, 3-stage community gathering storyline, permanent 3D Tasting Table transformation, and orchard songbirds + seasonal petal drift.
- **Key Deliverables & Fixes**:
  - **Orchard Social Life & Shared Gatherings (`src/game/residents.ts`, `src/game/simulation.ts`, `src/game/narrative.ts`)**:
    - Added utility-scored orchard activities (`clara` tasting-table prep, `mina` bough botany, `barnaby` timber bench inspection, `pip` skep & bird watching, and `rowan` tasting-table hosting) plus shared neighborhood **Tasting Table** activities gated on `orchardGatheringComplete`.
    - Added north-orchard social banter (`SOCIAL_BANTER_LINES`), Noticeboard orchard flyer (`prop_noticeboard`), and Rowan's orchard invitation letter (`prop_mailbox`).
  - **Interactive Orchard Bee Skep & 3-Stage Orchard Storyline (`src/game/worldMap.ts`, `src/game/storylines.ts`, `src/game/narrative.ts`, `src/game/actions.ts`, `src/game/journal.ts`)**:
    - Added `orchard_skep` (`Orchard Bee Skep`) as a season-, weather-, and post-gathering-reactive inspectable fixture.
    - Implemented the 3-stage `side_orchard_gathering` storyline (*The Fern Hollow Orchard Gathering*) with two permanent outcomes (`spiced_tart_table` vs `blossom_honey_picnic`), item rewards (`crabapple_tart` or `wild_honey`), cross-resident relation boosts, non-omniscient epilogue dialogue (`side_orchard_epilogue`), Pocket Journal memory integration, and `fern_hollow_orchard` landmark status updates in `Discoveries`.
    - Tuned active Arc 6 topic priorities (`side_clara_orchard_tart`, `side_mina_orchard_tea`, `side_rowan_orchard_2_host`) and `event_gift_thanks` (`18`) in `src/game/narrative.ts` so post-gift gratitude precedes unstarted pitches and active orchard steps precede unrelated Stage 1 hooks.
  - **Permanent 3D Orchard Gathering & Orchard Micro-Life (`src/scene/builders/orchard.ts`, `src/scene/builders/orchardMicroLife.ts`, `src/scene/environmentRenderer.ts`, `src/scene/NeighborhoodCanvas.tsx`, `src/game/worldMap.ts`, `src/game/environment.ts`)**:
    - Upgraded `orchard_skep` visuals (cedar base, glazed honey crock + wooden dipper + clover tufts) and built the permanent cedar **Orchard Tasting Table** (`ORCHARD_TASTING_TABLE` obstacle synced with `worldMap.ts`), upholstered stools, outcome-switched `spicedTartGroup` vs `blossomPicnicGroup`, and overhead marigold lantern garland driven by `OrchardRig.setGatheringVisual()`.
    - Fixed invalid `STORYBOOK_PALETTE` material keys (`moss`, `creamTrim`, `foliageSage`, `terracottaPot`, `sageShutter`, `agedBrass`, `looseFruitMat`, `strawMat`, `petalCream`) in `src/scene/builders/orchard.ts` so Three.js builds with zero material warnings.
    - Added 3 composite **Orchard Songbirds** (`gate_wren`, `bench_robin`, `east_finch`, tuned flush onto gate arch beam, rotated bench upper slat, and east stone pier cap) and instanced seasonal **Orchard Blossom / Leaf Drift** via `buildOrchardAmbientExtras({ isSoftwareGl })` inside `exteriorRoot`, wired cleanly into `EnvironmentVisualController` with zero per-frame allocations and winter/rain gating.
    - Centered the `orchard_skep` raycast proxy cylinder in `NeighborhoodCanvas.tsx` and widened `composeEnvironmentState()` typing in `src/game/environment.ts`.
  - **Expanded Test Suites**:
    - Expanded `src/game/storylines.test.ts`, `src/game/dialogue.test.ts`, `src/game/journal.test.ts`, `src/game/environment.test.ts`, `src/scene/orchard.test.ts`, `src/scene/orchardMicroLife.test.ts`, and `src/scene/environmentRenderer.test.ts`.
- **Verification**:
  - `npm test`: **117/117 passing** (`0` failures across all game & 3D scene suites).
  - `npm run lint` (`tsc --noEmit`) & `npm run build` (`vite build`): **Passing (`0` errors)**.
  - Headless Chromium QA (`1440×900` desktop & `390×844` mobile via `?autostart=1`): verified Orchard Bee Skep prompt & inspect modal (`"Woven Bee Skep & Honey Crock"`), glazed honey crock + bees, permanent Tasting Table (`spiced_tart_table` & `blossom_honey_picnic` outcomes) with lit Golden Hour marigold lanterns, all 3 perched orchard songbirds, falling spring blossom petals, Pocket Journal `Stories` & `Discoveries` (`Fern Hollow Orchard · Honey Picnic Open`), zero mobile horizontal overflow (`scrollW: 390 === innerW: 390`), and **0 console errors / 0 warnings**.
- **Asset Source Note (Permanent Instruction 15)**: all Build 2 assets are **Option A — self-built procedural Three.js** (palette-keyed composite meshes, instanced drift, zero-GC rig updates). Option B Polyfork evaluated: no benefit — every addition is obstacle-synced and storyline/state-reactive. Options C/D not used; no external assets entered the build.
- **Note (merge reconciliation)**: the parallel everyday-life polish lineage (Round 1: interior dressing, atmosphere layer, staged brew overlay, gathering chips, veil transitions, indoor speed cap) ships in the same tree; its QA record is preserved in `HANDOVER.md` §4 prior-QA lines and `docs/production/everyday-life-*`.

---

## Entry 031 — Milestone 2C Polish Round 2: Sit & Sip Tea Table, Hearth-Wall Life & Crackle Room-Tone (Passes 5–7)
- **Date**: 2026-11-20
- **Status**: Completed & Verified
- **Scope**: Round-2 iteration of the Milestone 2C everyday-life polish (per the roadmap's reassessment policy). A fresh headless playtest + code re-read produced new findings **EL-11…EL-15** (documented with evidence in `docs/production/everyday-life-quality-assessment.md` §5), and three dependency-ordered passes shipped against them — no save-schema changes, no regressions to Milestone 2A/2B/3 systems.
- **Findings addressed**: EL-11 (stools were decoration — no indoor seats) · EL-12 (brewed drinks had no enjoyment moment) · EL-13 (bare mantel/counter) · EL-14 (no hearth room-tone) · EL-15 (undressed entry quadrant).
- **Key Deliverables**:
  - **Pass 5 — Sit & Sip tea-table ritual**:
    - `src/game/cottage.ts`: new `COTTAGE_SEAT_SPOTS` (2 indoor seats exactly on the existing stool meshes at seatHeight 0.46, `indoor: true`, approach positions verified interior-walkable) + `resolveAnySeatById` (indoor-first, outdoor fallback) + `selectBestInteriorTarget` now offers seat candidates (kind `'seat'`, +0.22 bias behind props so aiming at stations is never stolen).
    - `src/game/playerController.ts`: sitting-block stand-up + seated-target branch resolve via `resolveAnySeatById`; indoor stand-up validated with `isInteriorPointWalkable`; **while seated on a cottage seat the indoor target becomes `Sip <drink>`** (with a drink in satchel) or plain `Stand Up` — never other room props.
    - `src/game/inventory.ts`: `sipable: true` flag on drinks + `getFirstSipableItem` (derived from defs, so new drinks join automatically).
    - `src/game/actions.ts`: `togglePlayerSitAction` is indoor-aware (approach walkability branch; indoor seats skip the outdoor NPC-occupancy check); new pure reducer `sipBeverageAtTableAction` — validates indoors + seated + sipable item, consumes 1, +8 min (DAY_END-clamped), first-time journal memory per drink (`mem_teatable_<id>`), rotating cozy prose scenes. `SIP_MINUTES_SPENT = 8` exported for tests.
    - `src/App.tsx`: seat-target branch runs the sip flow (prop card + interact pulse + `playSip()` + memory chime/toast); sit uses `playSitDown()`.
    - `src/scene/builders/cottageInterior.ts`: two low seat hit proxies (`targetKind: 'seat'`) over the stools; the **table proxy now hugs the tabletop zone** (`0.98×0.55×0.98` at y 1.02) so stool-click rays reach the seat proxies instead of being swallowed (interaction fix found in live playtest); canvas adds a table-vs-seat co-hit preference band; reactive **teacup + 2-puff steam wisp** on the table visible only while `playerPosture === 'sitting'` on a `cottage_seat_*` seat (visual-only, zero persisted state, zero allocation).
  - **Pass 6 — Hearth-wall life & entry dressing** (all statics in existing footprints/wall planes; obstacle table bit-identical): mantel beeswax candle with dusk-emissive flame (`mantelFlameMat`, phase curve + sine flicker), leaning pond photo frame, potted sprig; kitchen counter crock + wooden spoons, bread board + loaf slice, folded linen cloth; table honey pot + dipper; garden boots in the door recess, brass wall pegs + straw hat on the north wall near the door (the Pass-1 doormat already covered the entry-mat role).
  - **Pass 7 — Ambient hearth crackle & interaction SFX** (`src/game/audio.ts`): `playHearthAmbience(start)` — looping low-passed noise bed (0.022 gain) + randomized band-passed crackle pops via a self-rescheduling timer; idempotent start/stop; `setMuted(true)` stops it immediately. New `playSitDown()` (wooden settle + linen brush) and `playSip()` (two band-passed breaths + porcelain tick). `src/scene/NeighborhoodCanvas.tsx` gates it on transitions only: `isIndoors && hearthLit && playing && !muted` (never per-frame calls).
- **Tests (126/126 on the merged orchard + everyday-life tree)**: +5 Round-2 suites — indoor-seat registry contract (unique ids, indoor flag, seatPos inside `cottage_table` footprint, walkable approachPos, cross-registry resolution, seat target surfacing); sip reducer (consume + clamped time + one-time memory + four rejection paths); player sit/stand (seated lock at `computeSitGroundY(0.46)`, move-to-stand onto walkable approach, sip vs Stand Up target priority); interior rig seat proxies (7 cottage + 2 seat); teacup visibility gating (seated cottage seat only, steam bounded over 120 updates, hidden on outdoor seat); hearth-wall life (dusk candle glow, entry boots/hat presence).
- **Verification**:
  - `npm test`: **120/120 passing** (`0` failures). `npx tsc --noEmit`: **0 errors**. `npm run build`: **passing** (chunk-size warning unchanged).
  - Headless Chromium QA (1440×900 + 390×844, dusk `WorldState v6` save): full loop exercised live — brew tea via staged hearth overlay → **click stool** (seat proxy wins after the table-proxy fix) → seated pose on the stool with "Sitting at oak table stool." toast → **"Sip Warm Chamomile Tea"** action → "Tea at the Oak Table" card with "(Spent 8 minutes.)" (clamped at day end) → teacup visible on table while seated → tap-to-walk stands up and re-offers "Sit on Oak Table Stool" → "A Quiet Warm Chamomile Tea Moment" present in Pocket Journal memories (3 saved) → mute/unmute cycle with ambience loop clean → mobile 390px zero horizontal overflow → **0 console errors / 0 page errors** across all runs.
- **Asset Source Note (Permanent Instruction 15)**: all Pass 5–7 assets are **Option A — self-built procedural Three.js** (shared-`STORYBOOK_PALETTE` composite meshes, one tracked emissive flame material, procedural Web Audio) plus registry-driven seat data. Option B Polyfork evaluated: no benefit — seats/proxies/teacup are contract-bound to `COTTAGE_SEAT_SPOTS`, the indoor obstacle table, and save-reactive rig updates, which imported GLTFs would violate. Options C/D not used; no external assets entered the build.
- **Remaining limitations**: EL-10 chunk warning (pre-existing, tracked); tea sipping is restricted to the table ritual (no standalone "drink anywhere"); the hearth crackle loop intentionally has no positional audio; NPC dialogue referencing displayed keepsakes remains a future integration idea.

---

## Entry 032 — Milestone 2C Polish Round 3: A Room That Knows the Weather, a Home That Breathes (Passes 8–12)
- **Date**: 2026-11-20
- **Status**: Completed & Verified
- **Scope**: Round-3 iteration of the Milestone 2C everyday-life polish (roadmap reassessment policy). A fresh headless playtest on rain-dusk / rain-morning / sunlit-morning `WorldState v6` saves + code re-read produced findings **EL-16…EL-20** (documented with evidence in `docs/production/everyday-life-quality-assessment.md` §5), and five passes shipped against them — no save-schema changes, no new dependencies, no gameplay-genre drift, and Milestone 2A/2B/3 systems untouched.
- **Findings addressed**: EL-16 (interior ignored weather entirely) · EL-17 (wall clock frozen) · EL-18 (chimney smoke ignored the hearth) · EL-19 (rain silent indoors) · EL-20 (weather-blind morning wake beat).
- **Key Deliverables**:
  - **Pass 8 — A room that knows the weather & the hour** (`src/scene/builders/cottageInterior.ts` only):
    - **Rain streaks**: 10 shared-geometry thin quads sliding down the west window glass (`rainStreaks` group visible only in `light_rain`, per-streak phase + scale variety, zero allocation).
    - **Wet-glass veil**: translucent cool pane fog (`wetGlassVeilMat`, opacity 0.2 rain / 0.13 mist / 0 clear) and `windowGlassMat` emissive dimmed ×0.55 (rain) / ×0.72 (mist) across all phase branches.
    - **Shaft & mote suppression**: morning sun shaft ×0.22 in rain / ×0.40 in mist; dust motes ×0.5 in rain.
    - **Breezy curtain sway**: the two west linen panels ease ±0.02 rad sine sway only while `weather === 'breezy'`, resting at their dressed tilt otherwise.
    - **Winter frost**: sill strip + three glass-corner wedges (`frostDressing`) visible only when `season === 'winter'`.
    - **Living clock (EL-17)**: shelf clock hands re-parented onto pivot groups at the clock pin; hour/minute rotations derive from `minuteOfDay` every frame (`clockHands` exposed for tests). Effective-weather resolution mirrors `composeEnvironmentState` (mist lifts after 10:30).
  - **Pass 9 — Rain room-tone** (`src/game/audio.ts`, `src/scene/NeighborhoodCanvas.tsx`): `playRainAmbience(start)` — looping low rumble bed (720 Hz low-pass, 0.016 gain) + faint band-passed patter hiss (2600 Hz, 0.007), idempotent start/stop, immediate stop on mute; canvas gates it on transitions only (`isIndoors && effective === 'light_rain' && playing && !muted`), layering cleanly under the hearth crackle.
  - **Pass 10 — The home breathes outside** (`src/game/cottage.ts`, `src/scene/prototypes/willowLaneDiorama.ts`, canvas): pure `computeChimneySmokeStrength(world)` (0 cold hearth / 1 lit / 1.3 kettle-warm) feeds `updateWillowPrototypeMotion(…, smokeStrength)` which hides puffs when cold and scales puff size when the kettle hums — shared smoke material never mutated.
  - **Pass 11 — The neighborhood notices home rituals** (`src/game/narrative.ts`, `src/game/journal.ts`, `src/components/JournalDrawer.tsx`): new `everyday_home_kettle_steam` daily-slice topic for Mina — text branches on the kettle-warm window-steam cue, the tended vase, else a gentle invite (non-omniscient sensory reading only); `JournalHomeSummary.homeRitualCount` derives from `mem_teatable_*` memories (no schema change) and the home card renders "Quiet tea-table moments: N" when N > 0.
  - **Pass 12 — Weather-aware morning wake line** (`src/game/narrative.ts`, `src/App.tsx`): pure `buildMorningWakeLine(weather, season)` — four weather lines + winter frost accent — appended to the post-rest toast; `performNextDayRest` already rolls the next-day weather, so waking names the world it built.
- **Tests (134/134 on the merged tree)**: +8 Round-3 suites — interior clock hands (18:00 half-turn, 8:20 minute third); rain streaks/veil/glass dim/shaft suppression/mote hush vs sunlit; mist fog without streaks; breezy sway vs sunlit rest; winter frost visibility; chimney strength mapping (cold/lit/expired kettle/missing state); kettle-steam topic branches + daily-slice integration (wins after Mina's earlier slice is spent); wake lines per weather + winter accent + length bound; journal ritual count (0/1/2 + no leakage); audio room-tone idempotency without an AudioContext (headless/SSR safe).
- **Verification**:
  - `npm test` — **134/134 passing** (`0` failures). `npx tsc --noEmit` — **0 errors**. `npm run build` — passing (pre-existing chunk-size warning unchanged).
  - Headless Chromium QA (1440×900 + 390×844, rain-dusk/rain-morning/sunlit/winter `WorldState v6` saves): rain interiors show dimmed streaked glass with the shaft suppressed (vs the baseline's blazing shaft), sunlit mornings render bit-identical to baseline; winter frost group live; exterior chimney **clean** with `hearthLit: false` and **smoking** when lit + kettle warm (crop-compared); full live loop — "Sit on Oak Table Stool" → "Sipping" → "Sip Warm Chamomile Tea" → "Memory saved: A Quiet Warm Chamomile Tea Moment" → Journal Discoveries card shows **"Quiet tea-table moments: 1"** → bed rest wakes into "Good morning! Day 7 begins in Little Somewhere. Clean morning sun spills warm across the quilt." → mobile 390px zero horizontal overflow (`scrollW: 390 === innerW: 390`) → save persists across reload → mute/unmute cycle with both room-tone gates clean → **0 console errors / 0 page errors across all runs**.
- **Asset Source Note (Permanent Instruction 15)**: all Pass 8–12 additions are **Option A — self-built procedural Three.js / Web Audio** (shared-palette statics, one tracked streak material, one veil material, frost wedges, pivot-group clock hands, procedural rain noise beds, registry-derived prose). Option B Polyfork evaluated: no benefit — every addition is contract-bound to `COTTAGE_INTERIOR_OBSTACLES`, the interior rig's zero-GC update, the existing room-tone gating, and derived WorldState reads, which imported GLTFs/audio files would violate. Options C/D not used; no external assets entered the build.
- **Remaining limitations**: rain streaks live only on the west window (the room's single authored glass pane); the rain room-tone is a uniform bed (no positional muffle behind walls); `homeRitualCount` counts distinct first-time drink rituals, not repeat sips (by design — first-time memories only); Mina's kettle-steam topic surface was verified via unit selection tests rather than a live map walk.

---

## Entry 033 — Milestone 3 Build 6: Visitable Sunbeam Greenhouse & Mina's Growing Life
- **Date**: 2026-11-20
- **Status**: Completed & Verified
- **Scope**: Completed **Milestone 3 Build 6 — Visitable Sunbeam Greenhouse & Mina's Growing Life** atop Milestones 2A–2C (merged with the 2C Polish Round 3 tree, `WorldState v6` base) and Milestone 3 Builds 1, 2, 4 & 5: the neighborhood's second enterable interior cutaway, a day-driven shared growing loop (sow → water → sleep → harvest → re-sow), starter-seed economy, Mina dialogue integration, and a Pocket Journal discovery lifecycle. **Build-target audit first**: reconstructed the Milestone 3 sequence from WORKLOG Entries 021/028/029/030/031 + commit history — Build 3's scope (walkable cottage interior) shipped as Build 5/M2C after the upstream revert, so all prior builds are complete; the next dependency-satisfied build per `GAME_DESIGN.md` §12.2 is a *visitable neighbor interior*, chosen as the Sunbeam Greenhouse because it aligns with the design priorities (gardening & growing life; cooking & sharing meals via existing hearth recipes; deepening an existing resident) and requires no new characters or districts. Full rationale in `docs/milestones/16-milestone-3-build-6-sunbeam-greenhouse.md`.
- **Key Deliverables**:
  - **Game layer (`src/game/greenhouse.ts` new, `src/game/types.ts`, `src/game/inventory.ts`, `src/game/actions.ts`, `src/game/storage.ts`, `src/game/migrations.ts`)**:
    - Local-coordinate cutaway contract mirroring `cottage.ts`: `GREENHOUSE_BOUNDS` (-3.02..3.02 × -2.62..2.62), 4 furniture obstacles, 5 stations, sliding movement, 6-hub waypoint routing, `selectBestGreenhouseTarget` (distance + facing cone).
    - **Shared growing corner**: 4 fixed pots, 3 registry-derived crops (chamomile → Chamomile Blossoms, 2 watered nights; lavender → Sweet Lavender, 2; lemon thyme → Lemon Thyme Sprig, 3). Nightly growth via `advanceGreenhouseNightlyGrowthInPlace` in `advanceToNextDay`: only watered pots advance, unwatered pots wait (nothing dies), winter freezes growth. Every harvest returns one seed fold; Mina's worktable notes grant a one-time starter packet (`mem_greenhouse_note`).
    - Pure reducers: `enterGreenhouseAction`/`exitGreenhouseAction` (door spawn/porch exit, held props placed on entry), `interactWithGreenhouseProp` (station cards + panel routing), `waterGreenhousePlotsAction` (+8m, idempotent, ready pots free), `plantSeedAtPlotAction` (+10m, sowing-night watering, one-time `mem_greenhouse_first_sow`), `harvestPlotAction` (crop ×2 + seed, +12m, one-time `mem_greenhouse_first_harvest`), `readGreenhouseNotesAction` (seasonal rereads). Exterior `greenhouse_door` prop (`PROP_INTERACTABLES`) routes through `interactWithProp` → `enter_greenhouse`.
    - **`WorldState v7`**: `migrateV6ToV7` (hydrates `greenhouseState`, preserves v6 interior locations), `sanitizeGreenhouseState` (fixed shelf, unknown crops → empty pots, stage clamp, warnings), `computeWorldSaveRevision` + serialized round-trip coverage, interior-aware spawn/walkability validation for both interiors, greenhouse-aware wake placement, `playerLocation += 'greenhouse_interior'`, `simulation.ts` treats both interiors as indoors (no NPC greetings/encounters inside; exterior refs use `exteriorPlayerPos`).
    - 3 new non-giftable flora items: `chamomile_seeds`, `lavender_seeds`, `thyme_seeds` (satchel renders "For sowing at Sunbeam Greenhouse").
  - **Scene layer (`src/scene/builders/greenhouseInterior.ts` new, `src/scene/NeighborhoodCanvas.tsx`)**:
    - `buildSunbeamGreenhouseInterior`: Premium Handcrafted Storybook Diorama cutaway — dwarf-stone plinth + flagstone floor, timber-framed glass walls + pitched glass roof with ridge beam and hanging herb bundles, potting bench (brass-pull seed drawers, soil bag, pot stack, shears, twine), west growing shelf with the four registry-z pots rendering live growth stages (soil mound → sprout → leafy → per-crop blooms; watered soil darkens), rain barrel + hanging copper watering can, Mina's worktable (notebook, tea, specimen jars, stool), interior door + brass lantern, two sun shafts, 26 pollen motes, dusk lantern light, per-plot bloom sway — zero-GC `update(world, phase, elapsed)`, palette-cached materials, tracked disposal.
    - `buildSunbeamGreenhouseDoorway`: exterior cedar door + glass pane + brass knob on the west wall (11.14, 3.2) with posts/lintel, hanging lantern, planted sign, step stone, potted starts; raycast proxy at (10.98, 1.15, 3.2).
    - Canvas cutaway: both interior rigs under `interiorRoot` with location-based visibility; greenhouse glass-lit ambience branch (cooler hemi/brighter sun by day, below the cottage wash threshold; lantern dusk); location-aware indoor raycast, tap-to-walk, walkability fallback, camera snap, indoor speed cap; hearth crackle stays cottage-only.
  - **UI (`src/components/GreenhousePanel.tsx` new, `src/App.tsx`, `src/components/InventoryDrawer.tsx`)**:
    - `GreenhousePanel` ('planting' | 'harvest'): live plot-overview chips (growing/ready/thirsty + season note incl. winter rest), per-seed sow buttons per empty pot, harvest cards with yield preview, still-growing night progress; `>= 44px` targets; Escape/I/J/modal interplay.
    - App: `greenhouse_prop` branch (exit veil, panel routing, prop cards, memory chimes), exterior door veil-enter, HUD label `Sunbeam Greenhouse`.
  - **Dialogue, memories & journal (`src/game/narrative.ts`, `src/game/journal.ts`)**:
    - `side_mina_greenhouse_corner` (personal_story; requiresMet + !greenhousePlanted): offers the shared corner; choices record a warm durable `greenhouse_corner_shared` memory for Mina.
    - `daily_mina_greenhouse_checkin` (daily_slice; requiresMet + greenhousePlanted + notSeenToday): reacts to Mina's **own greenhouse's observable state** (ready crops / thirsty pots / winter dormancy / steady growth) with an ephemeral `greenhouse_corner_tended` interaction memory. Knowledge boundary: only persisted state of Mina's own building (visible during her daily tending); no cottage-interior or private player events leak.
    - Planting/harvesting create journal memories only (no NPC witnesses inside the greenhouse — the player tends it alone); Mina's recorded memories flow through existing gossip.
    - Pocket Journal: new `sunbeam_greenhouse` Discoveries row tracking `Mina's glass corner` → `Shared corner open` → `N pot(s) growing` / `N ready to harvest` → `Resting between sowings` (transformed).
- **Tests (project total 157/157 on the merged Round-3 + Build 6 tree)**:
  - `src/game/greenhouse.test.ts` (new, 16): registry/walkability/stand-spots, hub waypoints, stage math + nightly growth (watered/unwatered/winter/ready-stable), starter-note grant once, sowing + rejections, watering idempotence, harvest yields + resets + flags, end-to-end loop via `advanceToNextDay` (plant → sleep → water → sleep → harvest → re-sow → stall), enter/exit reducers, exterior door routing, station cards, summary/crop lookups, `v6→v7` migration, sanitizer repairs, save-revision sensitivity + round-trip + size.
  - `src/scene/greenhouseInterior.test.ts` (new, 5): per-station hit proxies at focus points + bounds, plot registry mirroring, growth-stage visual switching (wrong-crop exclusion, sway bounds), atmosphere (morning vs dusk shafts, dusk lantern, 240-update mote finiteness), doorway dressing + disposal.
  - `src/game/dialogue.test.ts` (+1): Mina topic gating both directions, knowledge-safe check-in variants (ready/thirsty/winter). `src/game/journal.test.ts` (+1): greenhouse Discoveries lifecycle. `src/game/inventory.test.ts`: catalog count 21.
- **Verification**:
  - `npm test`: **157/157 passing** (`0` failures on the merged tree; 134 Round-3 baseline + 23 Build 6 suites/extensions). `npm run lint` (`tsc --noEmit`): **0 errors**. `npm run build`: **passing** (pre-existing chunk-size warning, EL-10; scene chunk 784.4 kB).
  - Headless Chromium QA (agent-browser, dev server): desktop 1440×900 — `Step Inside[E]` → veil-enter → HUD `Sunbeam Greenhouse`, interior cutaway rendered, notes card (+seed chips), planting panel → sow (toast + persisted plot), watering idempotence card, sprout/bloom stage visuals, harvest panel → harvest (toast + inventory `chamomile_blossom 3` / `chamomile_seeds 3` + `totalHarvests 1` + flag), Pocket Journal `Discoveries · 7` with the greenhouse row, Mina dialogue (quest priority preserved; gating unit-tested), exterior doorway visual, dusk interior with dual ready blooms; mobile 390×844 — enter flow + toast, `scrollW 390 === innerW 390` (zero overflow), 0 sub-44px buttons, bottom-zone CTA; **0 console errors / 0 page errors** across all runs.
- **Asset Source Note (Permanent Instruction 15)**: all Build 6 assets are **Option A — self-built procedural Three.js** (palette-keyed composite meshes, tracked-geometry cutaway room, instanced-free pooled props, Web-Audio-free UI reusing existing chimes). Option B Polyfork evaluated: no benefit — every prop is contract-bound to `GREENHOUSE_INTERACTABLES`/`GREENHOUSE_INTERIOR_OBSTACLES`, the plot-state rig updates, and the v7 save schema, which imported GLTFs would violate. Options C/D not used; no external assets entered the build.
- **Remaining limitations**: waking inside the greenhouse steps the player outside (no bed); no NPC presence indoors (residents never enter interiors); winter growth rests until spring (surfaced in panel/notes/dialogue); fixed harvest yields (crop ×2 + seed ×1); the `docs/06-production-roadmap.md` path named in the assignment does not exist — the authoritative roadmap documents are `GAME_DESIGN.md` §12, `docs/production/*`, and `docs/milestones/16-milestone-3-build-6-sunbeam-greenhouse.md`.

---

## Entry 034 — Milestone 3 Build 7: Visitable Hearth & Crumb Bakery & Clara's Warm Kitchen
- **Date**: 2026-11-20
- **Status**: Completed & Verified
- **Scope**: Completed **Milestone 3 Build 7 — the first visitable neighbor interior** atop Milestones 2A–2C (Polish Rounds 1–3) and Milestone 3 Builds 1, 2, 4, 5 & 6, per the `HANDOVER.md` next-build target and `GAME_DESIGN.md` §12.2 list. Build-target audit first: Build 6's generalizable cutaway pattern applied to Clara's bakery — cooking & sharing meals pillar, an existing resident, an existing dressed landmark, no new characters/districts. Full rationale + verification in `docs/milestones/17-milestone-3-build-7-hearth-crumb-bakery.md`.
- **Key Deliverables**:
  - **Game layer (`src/game/bakery.ts` new, `src/game/types.ts`, `src/game/actions.ts`, `src/game/playerController.ts`, `src/game/cottage.ts`, `src/game/worldMap.ts`)**:
    - Local-coordinate cutaway contract mirroring `cottage.ts`/`greenhouse.ts`: `BAKERY_BOUNDS` (-3.0..3.0 × -2.4..2.4), 4 furniture obstacles (`bakery_oven`, `bakery_counter`, `bakery_prep`, `bakery_table`), 5 stations, sliding movement, 6-hub waypoint routing, `selectBestBakeryTarget` (+ café-seat candidate, weighted behind props like the cottage stools), south-wall door ↔ exterior `bakery_door` prop at (-12.4, -7.05) with porch exit (-12.4, -6.8).
    - **Deterministic daily bake roster** `getBakeForDay` (day % 4): Sunflower Sourdough (shares `herb_loaf`) → Orchard Crabapple Galette (`crabapple_tart`) → Lavender Butter Batch (`lavender_shortbread`) → **oven-rest day** (embers only). No new inventory items — shares map onto the existing baked-treat catalog (21 items unchanged).
    - Daily rituals (once per in-game day each): **check the morning bake** (+8m, `mem_bakery_first_bake`), **help knead dough** (+12m, `mem_bakery_first_knead`, doubles that day's counter share), **share the morning loaf** (+6m, `mem_bakery_first_loaf`, `gainedItems` chips), **read Clara's recipe notes** (one-time starter loaf + seasonal rereads, +8m, `mem_bakery_notes`).
    - One **indoor café-chair seat** (`BAKERY_SEAT_SPOTS`, `indoor: true`) reusing the cottage sit-and-sip ritual; `resolveAnySeatById` extended to all three seat registries (cottage indoor → bakery indoor → outdoor benches); NPCs never claim indoor seats.
    - **`WorldState v8`**: `bakeryState` (7 day-stamp/counter fields), `migrateV7ToV8`, `sanitizeBakeryState` (stamps ≥ 0, counters bounded, starter/notes cross-consistency repair), interior-aware spawn/walkability validation, save-revision sensitivity, `playerLocation += 'bakery_interior'`, interior-indoors handling in `simulation.ts` (no NPC greetings/encounters inside), `advanceToNextDay` steps a bakery sleeper out onto the porch (day stamps self-expire on the new day — no explicit resets).
  - **Scene layer (`src/scene/builders/bakeryInterior.ts` new, `src/scene/NeighborhoodCanvas.tsx`)**:
    - `buildHearthCrumbInterior`: Premium Handcrafted Storybook Diorama cutaway — plank floor + dwarf-stone plinth + hearthstone inlays, tall plaster north wall with chimney breast + mantle keepsakes, west kitchen window + tall wall, cutaway south/east wainscot, **brick dome bake oven** (iron mouth, tracked ember bed + `PointLight`, flue, peel, kindling box), **service counter** (loaf display row, brass bell, flour sacks, wall chalk slate), **flour-dusted prep table** (dough mound, rolling pin, flour jar, proof basket under linen), **east recipe-notes shelf** (oilcloth notebooks, recipe card) with hanging copper pans + dried herbs on the beam, **round café table** (two bentwood chairs, teacup, vase, runner), interior door + mat + wall lantern, morning window shaft, 22 flour-dust motes, **5 pooled steam puffs** above the oven mouth — zero-GC `update(world, phase, elapsed)`: ember intensity by bake/rest/checked state, steam gated on `bakeCheckedDay === day && bake active && !dusk`, counter loaf row hidden on rest days, dusk lantern, palette-cached materials, tracked disposal.
    - `buildHearthCrumbPorchDressing`: exterior step stone, lit wall lantern, butter-paper delivery crate at the building's existing south door; canvas raycast proxy routed through the default prop branch with a `bakery_door` focus at the doorway.
    - Canvas integration: bakery hit-proxy raycast branch (`bakery_prop`), `findNearestInteriorWalkablePoint`/tap-to-walk/waypoints via `isBakeryInteriorWalkable`/`computeBakeryWaypoints`, warm rosier indoor ambience branch, camera reuses the cottage close-up framing, rig disposal.
  - **UI (no new panel — all five stations resolve through existing prop-card sheets)**: App `bakery_prop` branch (exit veil, memory chime), exterior `bakery_door` veil-enter, `enter_bakery`/`exit_bakery` action routing, HUD label `Hearth & Crumb Bakery`, `Step Inside` action labels.
  - **Dialogue, memories & journal (`src/game/narrative.ts`, `src/game/journal.ts`)**:
    - `side_clara_bakery_kitchen` (personal_story; requiresMet + !`bakeryVisited`): Clara invites the player in — accepting sets `sideFlags.bakeryVisited` + warm durable memory; crust-secret branch.
    - `daily_clara_bakery_checkin` (daily_slice; requiresMet + `bakeryVisited` + notSeenToday): reacts only to **her own bakery's observable state** (kneaded today / shared today / oven-rest / fresh bake) with an ephemeral interaction memory — knowledge boundary identical to Mina's greenhouse check-in.
    - Pocket Journal: new `claras_kitchen` Discoveries row tracking `Clara's warm kitchen` → `Morning bake: {bake}` / `Oven resting today` → `N loaves shared` → `Kneaded with Clara` (transformed).
- **Tests (project total 182/182 on the merged tree)**:
  - `src/game/bakery.test.ts` (new, 18): obstacle/walkability/stand-spot validity, deterministic roster + share mapping (incl. rest day), bake check once/day + memory, knead once/day + share doubling, share once/day + rest-day silence, notes starter/rereads, enter/exit + held-prop + porch persistence, exterior door routing, all-station routing, hub waypoints to every station, target selection + café-seat offering, seat invariants, movement sliding, `v7→v8` migration, sanitizer repairs, save-revision sensitivity, round-trip, `advanceToNextDay` bakery wake-out.
  - `src/scene/bakeryInterior.test.ts` (new, 5): hit proxies at focus points + café seat + bounds, reactive ember/steam/loaf-row state machine + 240-update finite soak, roster ↔ rig contract across 8 days, porch dressing bounds + disposal, rig disposal isolation.
  - `src/game/dialogue.test.ts` (+1): Clara bakery topic gating both directions + knowledge-safe check-in variants (kneaded/shared/rest/fresh). `src/game/journal.test.ts` (+1): `claras_kitchen` discovery lifecycle. `src/game/greenhouse.test.ts` (updated): v6 save now chains v6→v7→v8 with all v7 invariants + fresh bakeryState asserted.
- **Verification**:
  - `npm test` — **182/182 passing** (`0` failures). `npx tsc --noEmit` — **0 errors**. `npm run build` — passing (pre-existing chunk-size warning unchanged, EL-10).
  - Headless Chromium QA (agent-browser, dev server, `scripts/make_build7_save.ts` door/inside QA saves; single-encoded localStorage injection with the flush-neutralizing patch — the double-encoded variant silently falls back to a fresh world): full live loop — porch `Step Inside[E]` → veil → interior diorama (oven/chimney breast, counter + slate, prep, café table, porch door) → `Sit on Café Corner Chair` → `Stand Up` → oven card `Today's bake: Sunflower Sourdough (+8m)` + memory chime → knead `(+12m)` → counter **`+2 Herb & Honey Loaf`** (kneaded doubling) → notes `+1 Herb & Honey Loaf` → Journal `Discoveries · 8` with `Hearth & Crumb Kitchen · Morning bake: Sunflower Sourdough` → door exit → reload persistence (`herb_loaf: 3`, full `bakeryState`, 3 memories) → Clara quest-priority topic selection intact → mobile 390×844: porch view with awning/loaf shelf/lantern/delivery crate, `Step Inside` CTA, interior loads, `scrollW 390 === innerW 390`, min control 44px → **0 console errors / 0 page errors across all runs**.
- **Asset Source Note (Permanent Instruction 15)**: all Build 7 assets are **Option A — self-built procedural Three.js** (palette-keyed composite meshes, tracked-geometry cutaway room, pooled steam puffs, registry-derived prose). Option B Polyfork evaluated: no benefit — every prop is contract-bound to `BAKERY_INTERACTABLES`/`BAKERY_INTERIOR_OBSTACLES`, the bake-roster rig updates, and the v8 save schema, which imported GLTFs would violate. Options C/D not used; no external assets entered the build.
- **Remaining limitations**: residents never enter the bakery interior (consistent with all interiors); the daily bake roster is a fixed 4-day cycle; kneaded-batch doubling caps at ×2; Clara's check-in surfaces only after quest-priority topics resolve (shared daily-slice design); no positional room-tone inside the bakery (hearth crackle stays cottage-only by design).

---

## Entry 035 — Milestone 3 Build 8: Visitable Linden Book Nook & Nora's Reading Corner
- **Date**: 2026-11-20
- **Status**: Completed & Verified
- **Scope**: Completed **Milestone 3 Build 8 — the second visitable neighbor interior** atop Builds 1–7, per the `HANDOVER.md` next-build list. The Build 7 cutaway pattern applied to Nora's paperbacks & tea: a browsing-reading-tea ritual set distinct from the bakery's bake-and-share loop. Full rationale + verification in `docs/milestones/18-milestone-3-build-8-linden-book-nook.md`.
- **Key Deliverables**:
  - **Game layer (`src/game/bookNook.ts` new, types/actions/playerController/cottage/worldMap/storage/migrations/simulation extensions)**: `NOOK_BOUNDS` (-2.5..2.5 × -2.4..2.4), 4 obstacles, 4 stations, 6-hub waypoints, `selectBestNookTarget` + armchair-seat candidate; east-wall door ↔ exterior `nook_door` prop at (-11.8, -1.0); **deterministic featured-book cycle** (day % 4: The Ivy Letters → Sketches of Mirror Pond → Bread & Bell → The Night Orchard, each with a one-time first-read memory); daily rituals — browse (+12m), reader's cup (+6m, sipable `chamomile_pear_tea` ×1), lending notes (one-time starter tea + seasonal rereads, +8m); one indoor reading-armchair seat; **`WorldState v9`** (`nookState`, `migrateV8ToV9`, `sanitizeNookState` with booksRead clamp, interior-aware spawn/walkability, save-revision sensitivity, `advanceToNextDay` porch wake-out). `resolveAnySeatById` now spans four seat registries.
  - **Scene layer (`src/scene/builders/bookNookInterior.ts` new + canvas)**: storybook cutaway — bookshelf wall (~53 tinted spines), lending desk (ledger + tea rings + desk lamp), tea console (copper kettle, cups, honey pot), reading armchair with **reactive open book** tinted by the featured book's shelf slot, floor lamp, door + coat hook, window shaft, paper-dust motes, **pooled tea steam** gated on `teaSharedDay === day`; zero-GC `update`, dusk reading-lamp warm-up, tracked disposal; exterior porch dressing + proxy; canvas branches (`nook_prop`, walkability/waypoints, rosier-paper indoor ambience, camera close-up).
  - **Dialogue & journal**: `side_nora_reading_corner` invitation (`nookVisited` flag + durable memory), `daily_nora_nook_checkin` reacting only to her own nook's state (names the day's book), Pocket Journal `linden_book_nook` row (`Nora's lamp-lit shelves` → `Reading: {book}` → `N of 4 books settled` → `Reader's tea poured`).
- **Tests (project total 206/206)**: `src/game/bookNook.test.ts` (new, 17) + `src/scene/bookNookInterior.test.ts` (new, 5) + Nora dialogue gating + journal lifecycle; v6/v7 chain tests updated to assert the chained v9 result with all intermediate invariants preserved.
- **Verification**:
  - `npm test` — **206/206 passing**; `npx tsc --noEmit` — **0 errors**; `npm run build` — passing (pre-existing chunk-size warning unchanged).
  - Headless Chromium QA (`scripts/make_build8_save.ts`): door `Step Inside[E]` → interior cutaway (shelf wall, desk, tea console, armchair, rug) → browse `The Ivy Letters (+12m)` + memory → reader's cup `(+6m, +1 Warm Chamomile Tea)` → lending notes `(+8m, +1 tea)` → armchair `Sit` → `Sip Warm Chamomile Tea` → `Stand Up` → Journal `Discoveries` (`Linden Book Nook · Reading: The Ivy Letters` + `Hearth & Crumb Kitchen` row intact) → door exit → reload persistence (`nookState` complete, 2 teas, 3 nook memories) → mobile 390×844 zero overflow, min control 44px → **0 console errors / 0 page errors** across all runs.
  - UX note: tea-console/armchair proximity shows the faced target (station-adjacency overlap in the cottage table-vs-stool behavior family); facing the chair offers `Sit on Reading Armchair`; the tea stand spot was nudged north so the chair wins when faced.
- **Asset Source Note (Permanent Instruction 15)**: all Build 8 assets are **Option A — self-built procedural Three.js**; Option B Polyfork evaluated, no benefit (registry/save-schema-bound props); Options C/D not used.
- **Remaining limitations**: residents never enter interiors; fixed 4-day shelf rotation; `booksRead` caps at 4; no positional room-tone; Nora's check-in surfaces after quest-priority topics resolve.

---

## Entry 036 — Milestone 2C Polish Round 4: The Home Remembers, Seasons of Home & A Second Quiet Cup
- **Date**: 2026-11-20
- **Status**: Completed & Verified
- **Scope**: Everyday-life polish Round 4 (Passes 13–15) — pillar-5 environmental storytelling and seasonality inside Willow Step Cottage, deliberately confined to the player-home lane while Milestone 3 Build 9 (Copperwheel Cottage) proceeds in a parallel agent lane. Full findings + acceptance criteria in `docs/production/everyday-life-quality-assessment.md` §7–8 and `docs/production/everyday-life-polish-roadmap.md` Passes 13–15.
- **Key Deliverables**:
  - **Pass 13 — The home remembers**: five progress-derived mementos in `builders/cottageInterior.ts`, gated in `rig.update` on existing persisted WorldState via allocation-free memory lookups (`hasMemoryId` / `hasMemoryIdPrefix`, no per-frame closures): greenhouse cutting jar on the sill (`greenhouseState.totalHarvests > 0`), orchard honey crock on the sideboard (`mem_orchard_harvest`), Clara's recipe card on the mantel (`bakeryState.kneadingSessions > 0`), Nora's borrowed book on the quilt (`nookState.booksRead > 0`), everyday tea tin on the oak table (`mem_teatable_*`). Zero schema impact, zero new interactions, obstacle table bit-identical; QA helper `scripts/make_round4_veteran_save.ts` (orchard completed + greenhouse/bakery/nook/tea history) added.
  - **Pass 14 — Seasons of home**: seasonal sill posy (spring chamomile / summer lavender / autumn leaves; winter returns the sill to frost), door-lintel evergreen swag with a season-swapping accent (blossoms / lavender / berries / brass bell), season-tinted west window emissive (precomputed `THREE.Color`, `copy()`-assigned), and spring petals / autumn leaves floor scatter. Season remains calendar-locked (`migrations.ts` derives from day — verified as an intentional two-branch normalization; QA uses day offsets 15/25/35).
  - **Pass 15 — A second quiet cup**: `lavender_chamomile_tea` (`PersonalItemId` union append) — sipable, giftable, brewed via new `recipe_lavender_tea` (lavender sprig + chamomile blossom, +15m) with staged `RECIPE_ACTIVITY_STEPS`; the station modal, `sipBeverageAtTableAction`, and the journal `homeRitualCount` all derive from defs (no reducer/UI changes). Nora's liked list gains the new tea with all existing entries preserved.
- **Tests (project total 210/210)**:
  - `src/scene/cottageInterior.test.ts` (+3): fresh-world hides all mementos; lived world reveals each at its home surface with world-position footprint bounds and non-sticky re-derivation; per-season posy/scatter visibility matrix + swag accent + glass tint differentiation.
  - `src/game/inventory.test.ts` (+1, updated 2): second-sipable invariants (def exists, recipe unique with correct ingredients, both teas resolve through `getFirstSipableItem`, every sipable drink must be hearth-brewable); catalog count 21 → 22; hearth recipe count 4 → 5.
- **Verification**:
  - `npm test` — **210/210 passing** (`0` failures); `npx tsc --noEmit` — **0 errors**; `npm run build` — passing (pre-existing chunk-size warning unchanged, EL-10).
  - Headless Chromium QA (agent-browser, dev server; single-encoded save injection with flush-neutralizing patch; season variants via day offsets): veteran morning interior shows exactly the five mementos (`veteran-morning-before.png` vs `veteran-morning-after-pass13.png`); summer/autumn/winter saves render distinct rooms (`veteran-summer|autumn|winter-pass14.png` — autumn swag berries + door leaves, winter frost + cutting jar persists, no posy); seated two-tea loop — `Sit on Oak Table Stool` → `Sip Warm Chamomile Tea` (+8m, memory) → `Sip Lavender Chamomile Tea` (+8m, "Memory saved: A Quiet Lavender Chamomile Tea Moment") → two distinct `mem_teatable_*` memories persisted, both consumables removed → **0 console errors / 0 page errors** across all runs.
- **Asset Source Note (Permanent Instruction 15)**: all Round-4 assets are **Option A — self-built procedural Three.js** (palette-keyed composite meshes inside existing footprints; derived from save-schema fields that imported GLTFs could not read). Option B Polyfork evaluated: no benefit — every memento is gated on per-save WorldState values. Options C/D not used; no external assets entered the build.
- **Remaining limitations**: mementos are visibility-gated props (no pick-up/inspect interactions); seasonal accents swap by material color rather than per-season geometry for the swag (evergreen base reads intentional); residents still never enter interiors, so no shared-tea moment exists; EL-10 chunk warning remains track-only.


---

## Entry 037 — Dialogue Modularization: `src/game/dialogue/` Content Modules (Behavior-Identical Refactor)
- **Date**: 2026-11-20
- **Status**: Completed & Verified
- **Scope**: Maintenance-only refactor implementing the approved Dialogue Modularization blueprint (Grok, 2026-11-19): extract all dialogue content out of `src/game/narrative.ts` into organized modules under `src/game/dialogue/` with zero gameplay-behavior change. Deliberately confined to content organization: no selection/evaluation/relationship/persistence/history logic touched, no new dialogue content (no Copperwheel/invitation/teaching topics — Copperwheel Cottage remains owned by the parallel Build 9 agent lane).
- **Audit before changes**: canonical `origin/main` at `e6ee46b` verified (local == remote, 0 ahead/0 behind); blueprint claims reconciled against reality — `narrative.ts` is 4,687 lines (matches), `dialogueEngine.ts` 1,006 (matches), `dialogue.test.ts` 1,433 (matches); blueprint's "~79 topics" corrected to the actual **77 topics**.
- **Topic counts (original -> final)**: **77 -> 77** (5 quest_milestone, 5 conflict_reconciliation, 20 personal_story, 6 event_reaction, 7 npc_gossip, 4 relationship_tier, 2 emotion_reaction, 2 weather_season, 26 daily_slice). Every id, priority, condition, node graph, text string and dynamic builder preserved **byte-identically** (sliced verbatim from the source array; proven by a byte-identity diff of all 19 module bodies against their original spans).
- **Modules created (19 content files + aggregation index)**:
  - `dialogue/quest/`: `bellQuest.ts` (5 Bell-mystery milestones), `conflicts.ts` (2 generalized mediation), `lanternsArc.ts` (3 Lanterns Over Mirror Pond conflict stages).
  - `dialogue/personal/` — arc-owned, not per-resident (see deviation note): `zineArc.ts` (4), `herbHearthArc.ts` (3), `musicStandArc.ts` (3), `pocketWatchArc.ts` (3), `orchardArc.ts` (4).
  - `dialogue/events/`: `epilogues.ts` (2 knowledge-gated storyline epilogues), `orchardEpilogue.ts` (1), `celebrations.ts` (3 event/gift-thanks reactions).
  - `dialogue/everyday/`: `gossip.ts` (7), `relationships.ts` (4 tier + 2 emotion reactions), `weather.ts` (2), `smalltalk.ts` (18 resident daily-slice pool), `home.ts` (5 Milestone 2C everyday home/hearth topics).
  - `dialogue/interiors/`: `greenhouse.ts`, `bakery.ts`, `bookNook.ts` (2 shared-corner topics each). `interiors/copperwheel.ts` intentionally **not** created — future Build 9 content.
  - `dialogue/index.ts`: authoritative aggregation point; spreads the 19 module arrays in **exactly** the original `DIALOGUE_TOPICS` order (order is a pinned compatibility contract).
- **Blueprint deviation (deliberate, recorded)**: the blueprint guessed per-resident `personal/clara.ts`-style files. Actual content is organized as sequential multi-resident community arcs (e.g. Zine: Pip -> Toby/Clara -> Nora), so `personal/` modules are **arc-owned** files per the implementation mandate "extract according to their actual ownership and dependencies"; per-resident files would have scattered each arc and made exact order preservation fragile.
- **Compatibility measures**: `narrative.ts` (4,687 -> 418 lines) is retained as the compatibility layer — it re-exports `DIALOGUE_TOPICS` unchanged, keeps `buildResidentDialogue` (still injecting the concurrent quest-milestone choices), `getResidentAvailableQuestCue`, `createInitialStoryFlags`, `computeEnvironmentState`, `buildMorningWakeLine` and the `isChoiceAvailable` re-export; **every existing import site** (`App.tsx`, `actions.ts`, `environment.ts`, `journal.ts`, `migrations.ts`, `NeighborhoodCanvas.tsx`, `DialogueSheet.tsx`, all test files) keeps working unmodified. Shared helpers stay in their existing modules (`dialogueEngine.ts` constructors, `types.ts` types) — no duplication. Dependency direction is one-way: `dialogue/*` -> (types, dialogueEngine, inventory, bakery, bookNook, residents, relationships); `narrative.ts` -> `dialogue/index.ts`; no dialogue module imports `narrative.ts`.
- **Files changed**: `src/game/narrative.ts` (array removed, imports pruned, re-export added); 20 new files under `src/game/dialogue/`; `src/game/dialogueRegistry.test.ts` (new); `scripts/dialogue-topics-golden.json` + `scripts/snapshot_topics_runtime.ts` (golden snapshot tooling); `WORKLOG.md`, `ARCHITECTURE.md`. **Not touched**: `dialogueEngine.ts`, `dialogue.test.ts` (zero assertion changes), `relationships.ts`, `memories.ts`, `storylines.ts`, `actions.ts`, storage/migrations — and no Copperwheel/Arthur-room content.
- **Tests (project total 215/215)**:
  - `src/game/dialogueRegistry.test.ts` (new, 5): unique topic ids; topic count + exact id sequence vs golden snapshot; registry metadata (resident/category/priority/historyScope/condition) field-for-field vs golden snapshot; every topic exposes a build function; resident-scoped topics reference a valid `ResidentId` or `'any'`.
  - Existing 210 tests pass **unchanged** — `dialogue.test.ts` required zero assertion changes.
- **Verification**:
  - Before changes: `npm test` 210/210, `tsc --noEmit` 0 errors, `vite build` pass — recorded as baseline.
  - After changes: `npm test` **215/215 passing**; `tsc --noEmit` **0 errors**; `npm run build` passing (pre-existing EL-10 chunk-size warning unchanged); runtime snapshot of `DIALOGUE_TOPICS` (imported from the real module) compared topic-by-topic against the pre-refactor snapshot — **count 77 == 77, ids identical in identical order, zero field diffs** (id/resident/category/priority/historyScope/condition).
  - Static import-graph scan over all 99 `src/` modules: **no circular dependencies**.
- **Remaining technical debt**: `interiors/copperwheel.ts` awaits Build 9 content (owned by the parallel lane); `dialogue/quest/conflicts.ts` holds the two "generalized mediation" topics while `lanternsArc.ts` holds the interconnected lantern conflict (split reflects original array contiguity; can be merged later without contract impact); golden snapshot must be re-baselined via `scripts/snapshot_topics_runtime.ts` whenever content is legitimately added; per-file "ownership" doc headers are duplicated boilerplate from the extractor and may be hand-tuned in future content passes.


---

## Entry 038 — Milestone 2C Polish Round 5: The Home Answers the World Outside
- **Date**: 2026-11-20
- **Status**: Completed & Verified
- **Scope**: Everyday-life polish Round 5 (Passes 16–18) — asset/visual lane only, deliberately confined to the Willow Step Cottage envelope (interior hearth wall, exterior window truth, porch seasons) while the Copperwheel Cottage build proceeds in its parallel agent lane. Follows the Round-4 reassessment candidates (autumn herb-drying, winter hearth-sock) plus the "exterior advertises interior state" pillar. Full pass specs in `docs/production/everyday-life-polish-roadmap.md` Passes 16–18; verification in `docs/production/everyday-life-quality-assessment.md` §9–10.
- **Key Deliverables**:
  - **Pass 16 — The hearth wall keeps the seasons** (`builders/cottageInterior.ts`): four wall-plane seasonal groups on the flue face and mantel — spring blossom-branch jug, summer fresh herb bundle on a brass flue peg, autumn cedar herb-drying rack with three tied bundles (chamomile/lavender/autumn-leaf, hanging clear of the mantel top), winter knitted hearth sock (wool red + cream cuff/heel/toe) with an evergreen mantel garland and brass bells. Season-gated in `rig.update` from `world.season`; zero game-state changes; `COTTAGE_INTERIOR_OBSTACLES` bit-identical.
  - **Pass 17 — Your windows answer the hearth** (`prototypes/willowLaneDiorama.ts`, `environmentRenderer.ts`, `NeighborhoodCanvas.tsx`): the cottage's window/door-glass material leaves the shared neighborhood pool (`WillowCottageRig.windowMats`) and the env controller gains an optional `willowWindowMaterials` dep that glows it to `computeChimneySmokeStrength`'s truth — dusk lit 2.5 / kettle-warm 2.85 / cold 0.3 (dark home), golden ×1.39 / ×1.78 / ×0.55, lantern-edge ×1.25 / ×0.35, daytime parity with the neighborhood. Evaluated per-update (not revision-gated): the kettle warms and expires on the in-game clock, which carries no world revision.
  - **Pass 18 — The porch keeps the seasons** (`willowLaneDiorama.ts` + new `willowDioramaSeasons.test.ts`): `updateWillowPrototypeMotion` gains a season parameter — rotating deck pot (summer keeps the original marigold tuft, re-parented into a gateable group), step-side seasonal tufts, door wreath whose accent mirrors the interior swag palette (spring blossom / summer lavender / autumn berry / winter brass), winter rail frost, and window-box overlays (autumn red-leaf sprigs, winter snow ridge + evergreen) tucked at box ends so the `flowerGroups` planter-progress contract is never hidden or repurposed.
- **Tests (project total 223/223)**:
  - `src/scene/cottageInterior.test.ts` (+1): hearth-wall season matrix with flue-face/mantel-zone world-position bounds and envelope check.
  - `src/scene/environmentRenderer.test.ts` (+2): dusk lit/kettle/cold matrix with neighborhood parity, golden/morning parity (float-exact products).
  - `src/scene/willowDioramaSeasons.test.ts` (new, 5): pot/tuft/frost visibility matrix, wreath accent table, overlay gating without `flowerGroups` impact, chimney truth alongside the seasonal gate.
- **Verification**:
  - `npm test` — **223/223 passing**; `npx tsc --noEmit` — **0 errors**; `npm run build` — passing (pre-existing EL-10 chunk warning unchanged).
  - Headless Chromium QA (`scripts/make_round5_qa_saves.ts`, 7 QA saves; playwright runner): autumn/winter/spring interiors, dusk lit/cold/kettle exteriors, summer porch — **0 page errors / 0 console errors** across all runs. Pixel-verified window-region ordering (kettle > lit > cold) and chimney smoke lift; winter save renders the sock + garland; summer porch renders the marigold pot and wreath. Screenshots: `download/asset-qa/round5/`.
  - QA pitfall re-confirmed and handled: the page's `pagehide` autosave flush overwrites naive save injection on reload — inject, then stub `Storage.prototype.setItem`, then reload (documented in HANDOVER §7).
- **Asset Source Note (Permanent Instruction 15)**: all Round-5 assets are **Option A — self-built procedural Three.js** (shared-palette composite meshes; season gating derives from save fields an imported GLTF could not read). Option B Polyfork evaluated: no benefit. Options C/D not used; no external assets entered the build.
- **Remaining limitations**: the herb-drying rack is visual-only (no drying reducer — named as a possible round-6 candidate); window truth reads at dusk/golden/lantern-edge only (daytime parity is intentional); wreath accent swaps by material color, not per-season geometry; residents still never enter interiors.

---

---

## Entry 039 — Milestone 3 Build 9: Visitable Copperwheel Cottage & Arthur's Brass Workshop
- **Date**: 2026-11-20
- **Status**: Completed & Verified
- **Scope**: Completed **Milestone 3 Build 9 — the third and final visitable neighbor interior** atop Builds 1–8, per the `HANDOVER.md` next-build list and `GAME_DESIGN.md` §12.2. The Build 7/8 cutaway pattern applied to Arthur's tinker-and-mend ritual set (bench project cycle + kettle tea + mending ledger), distinct from the bakery's bake-and-share and the nook's browse-and-read. Full rationale + verification in `docs/milestones/19-milestone-3-build-9-copperwheel-cottage.md`.
- **Key Deliverables**:
  - **Game layer (`src/game/copperwheel.ts` new, types/actions/playerController/cottage/worldMap/storage/migrations/simulation extensions)**: `COPPERWHEEL_BOUNDS` (-3.0..3.0 × -2.5..2.5), 5 obstacles (`cw_bench`/`cw_bed`/`cw_shelf`/`cw_stove`/`cw_chair`), 5 stations + nightstand inspect, 6-hub waypoints, `selectBestCopperwheelTarget` + armchair-seat candidate; south-wall door ↔ exterior `copperwheel_door` prop at (13.1, -7.85), porch exit (13.1, -7.6); **deterministic bench project cycle** `getProjectForDay` (day % 4: The Orchard Pendulum → A Music Box Comb → The Watch Escapement → bench rest, each with a one-time memory); daily rituals — bench check + fine-work help (+10m working / +8m rest, winding session), chamomile cup at the copper kettle (+6m, existing `chamomile_pear_tea`), mending ledger (one-time starter tea + seasonal rereads, +8m), nightstand peek (+4m, regulator-watch memory); one indoor window-armchair seat; **`WorldState v10`** (`copperwheelState` 8 fields, `migrateV9ToV10`, `sanitizeCopperwheelState` with projectsAdmired clamp, interior-aware spawn/walkability, save-revision sensitivity, `advanceToNextDay` porch wake-out). `resolveAnySeatById` spans five seat registries.
  - **Scene layer (`src/scene/builders/copperwheelInterior.ts` new + canvas)**: storybook cutaway — plank floor + workshop rug, tall north (pegboard + bed alcove) & west (mended shelf + window + chamomile sill pot) walls, cutaway south (door + mat + wall lantern) & east (stove flue into header); workbench (maple top, vise, gear tray, felt, loupe) with the **reactive day project group** (pendulum rod swings on checked days; music box / pocket watch / rolled felt rotate by day), nightstand regulator watch + framed photo, copper kettle stove with **pooled steam gated on `teaSharedDay === day`**, quilted window armchair + footstool, hanging bench lamp, morning shaft, 24 brass-dust motes, dusk warm-up — zero-GC `update(world, phase, elapsed)`, tracked disposal; exterior porch dressing (brass doormat, repair crate, A-frame sign) reusing the pre-existing porch lamp rig; canvas branches (`copperwheel_prop` raycast/walkability/waypoints, pale-plaster indoor ambience, camera close-up, disposal).
  - **Dialogue & journal** (`src/game/dialogue/interiors/copperwheel.ts` after the modularization rebase): `side_arthur_workshop_bench` invitation (winter / bell-restored / default variants; sets `copperwheelVisited` + durable memory; steady-hand branch) + `daily_arthur_workshop_checkin` reacting only to his own workshop's observable state (helped / rest day / kettle / cycle tease); Pocket Journal `copperwheel_cottage` Discoveries row (`Arthur's brass workshop` → `At the bench: {project}` / `Bench resting today` → `N of 4 projects admired` → `Helped at the bench` → `Tea shared at the kettle`).
  - **Cross-build defects found & fixed during QA**: (1) `copperwheel_door` was missing from `PROP_INTERACTABLES` (door prompt could never fire); (2) the save sanitizer resolved seats through the outdoor-only `getSeatById`, so sitting at ANY indoor seat silently degraded to standing on save/load since 2C — the sanitizer now resolves all five registries with interior/exterior pairing enforced; (3) `sipBeverageAtTableAction` hard-gated to `cottage_interior` (Pass-5 leftover), silently refusing the "Sip" prompt the Build 7/8 indoor seats advertised — the ritual now works at any indoor seat with seat-aware prose; (4) `afterDraw`'s software-GL fence poll could deadlock the whole loop when SwiftShader never signals the fence — a 250 ms wait budget degrades pacing instead; (5) the west window glass/trim were buried inside the wall slab.
- **Tests (project total 250/250)**: `src/game/copperwheel.test.ts` (new, 19) + `src/scene/copperwheelInterior.test.ts` (new, 5) + Arthur dialogue gating + `copperwheel_cottage` journal lifecycle + the two cross-build regression suites (indoor-seat persistence, cross-interior sip); the v6/v7/v8 migration-chain tests updated to assert the chained v10 result with all intermediate invariants preserved. Rebase note: Build 9 landed on top of Round 4 + Round 5 + the Dialogue Modularization refactor — Arthur's two topics moved verbatim into `src/game/dialogue/interiors/copperwheel.ts` (module `COPPERWHEEL_TOPICS`, spread last in `dialogue/index.ts`) and the golden snapshot was re-baselined 77 → 79 topics via `scripts/snapshot_topics_runtime.ts` (the pre-modularization 77 ids keep their exact order).
- **Verification**:
  - `npm test` — **250/250 passing** (the 223-suite post-Round-5 baseline + 27 Build 9 suites); `npx tsc --noEmit` — **0 errors**; `npm run build` — passing (pre-existing chunk-size warning unchanged, EL-10).
  - Headless Chromium QA (`scripts/make_build9_save.ts` door/inside QA saves; single-encoded injection with the flush-neutralizing patch): porch `Step Inside[E]` → veil → interior cutaway → bench card `Today's project: The Orchard Pendulum (+10m)` + memory → kettle `+1 Warm Chamomile Tea` → ledger starter tea → nightstand regulator-watch memory → armchair sit → **`Sip Warm Chamomile Tea` consumed the cup + saved `A Quiet Warm Chamomile Tea Moment`** (cross-interior sip fix verified live) → Journal `Discoveries · 10` with the Copperwheel row → door exit → reload persistence (`copperwheelState` complete, 3 memories, interior location preserved) → Arthur check-in fires live reacting to the used kettle (quest-priority topics outrank it until the bell quest resolves — verified the invitation surfaces post-bell via the selector) → mobile 390×844: door prompt + interior loads, `scrollW 390 === innerW 390`, 0 sub-44px controls → **0 console errors / 0 page errors** across clean sessions.
- **Asset Source Note (Permanent Instruction 15)**: all Build 9 assets are **Option A — self-built procedural Three.js**; Option B Polyfork evaluated, no benefit (registry/save-schema-bound props); Options C/D not used.
- **Remaining limitations**: residents never enter interiors; fixed 4-day bench rotation; `projectsAdmired` caps at 4; no positional room-tone; Arthur's topics surface after quest-priority topics resolve (shared daily-slice design).

---

## Entry 040 — Milestone 2C Polish Round 6 Pass 19: The Wanderer Reads as Someone (Player Character Polish)
- **Date**: 2026-11-20
- **Status**: Completed & Verified
- **Scope**: Player-character polish pass — asset/visual lane only, player archetype exclusively (`characterId === 'player'`); no resident rig, Copperwheel/Arthur content, or game-state logic touched. Grounded in production game-feel research: Steve Swink's *Game Feel* ("polish … dust particles at a character's feet"), the walk-cycle contact/recoil/passing/high-point standard, squash-&-stretch for low-poly figures (Polylusion), Mario-style footstep dust poofs, and Animal-Crossing-style layered idle variety.
- **Key Deliverables**:
  - **Identity silhouette** (`builders/characters.ts`, player branch): the wanderer now carries a cross-body **traveller satchel** (leather strap with brass buckle, hip pouch with flap + brass pin — the physical twin of the satchel the inventory UI speaks of) and a hand-knit **scarf** (collar torus + articulated 3-segment tail pivot) whose tail trails backward with speed, flares outward on banked turns, flares harder on launch, and breathes gently at rest. All extras stay inside the arm/nose clearance envelope; kept warm-brass/leather palette via the shared `MaterialPalette`.
  - **Continuous stride curve** (`playerController.ts`): legacy cadence snapped 8.5→11.5→14.5 exactly at the walk/run/sprint thresholds, popping the gait (and sliding feet) whenever inertia blended across a tier. New piecewise-linear `computeStrideFrequency()` anchors the legacy values *at* the tier speeds but blends smoothly between them (creep strides slower below walk; sprint ceiling clamped). Steady-state gait unchanged.
  - **Motion-feel envelopes** (`playerController.ts`): `PlayerMotionRuntime` gains `accelAmount` (0..1 normalized launch acceleration) and `skidAmount` (0..1 hard-brake/reversal envelope, monotonic exponential decay so rising edges fire exactly once). Release skid keys off *pre-slide* speed — how fast the wanderer was going when the brake was asked for. Sitting zeroes both envelopes.
  - **Squash & stretch + accel lean** (`builders/characters.ts`): rigs exposing `heightScale` rescale per-frame from an optional `squash` opt (positive compresses for skid/step impact, negative stretches on launch; ±≤8%, idle/interact poses exactly 1.0 so clearance guarantees hold). `accelLean` pitches the torso into the run while the head counter-pitches to keep the gaze level. Arms now damp at 0.82× body speed — follow-through overlap per the production walk-cycle standard. Layered idle variety: an occasional unhurried glance + soft weight shift (deterministic window, zero allocations).
  - **Footstep dust poofs** (`textures.ts` + `NeighborhoodCanvas.tsx`): new `createFootstepDustTexture()` (three-lobed lumpy warm puff + bright motes, seeded); 18-sprite zero-GC pooled system (scene-level so doorway puffs fade cleanly across scene switches) — one alternating-foot poof behind the heel on fast steps (>4.4 m/s, strength scales with speed), a two-poof burst on skid rising edges (>0.4), softer/ fainter motes indoors. Rise/drift/soften/fade life loop; all GPU resources disposed.
  - **Rig contract** (`models.ts`): `CharacterRig` gains optional `scarfPivot`, `satchelGroup`, `heightScale` — undefined on resident rigs, so NPC behavior is bit-identical.
- **Tests (project total 234/234)**:
  - `src/game/playerFeel.test.ts` (new, 5): stride continuity + monotonicity + legacy anchors + seam smoothness (<0.06 at both thresholds); launch-accel envelope >0.4 → settles <0.02; sprint release skid fires >0.15, decays monotonically, fully settles (<0.001) after stopping, and gentle walk stops never skid; sharp reversal at speed fires the envelope; sitting zeroes both envelopes.
  - `src/scene/playerAvatar.test.ts` (new, 5): player-only extras present (satchel ≥4 meshes, scarf ≥3 segments) and resident rigs (nora) expose none; silhouette-vs-baseline clearance (width ≤ NPC+0.03, front/back reach within envelope, nothing below y=0); squash rescales proportionally and idle keeps exactly the built scale; scarf trails at sprint, relaxes at rest, swings sideways on banked turns; accel lean pitches torso while head counter-pitches; idle glance window rotates the head only inside the window.
- **Verification**: `npm test` — **234/234 passing** (229 prior + 10 new − 5 rebalanced into the same files; player.test.ts 8 legacy movement tests untouched & green); `npx tsc --noEmit` — **0 errors**; `npm run build` — passing (pre-existing EL-10 chunk warning unchanged).
- **Compatibility**: save schema untouched (`PlayerMotionRuntime` is runtime-only, never persisted — migrations.ts reads NpcRuntimeState.walkPhase only); all 77 dialogue topics / registry contract untouched; Copperwheel & Arthur files untouched; existing player tests pass without modification.
- **Remaining limitations / candidates for Pass 20**: dust poofs use `Math.random()` jitter (visual only — simulation stays deterministic); no skid audio (footstep audio unchanged this pass); scarf is accent-color only (no per-season knit tint yet — natural Round-6 follow-up); NPCs do not yet take squash/accelLean opts (their locomotion is path-driven; player-only by design).
