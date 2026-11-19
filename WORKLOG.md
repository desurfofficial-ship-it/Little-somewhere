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

