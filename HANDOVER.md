# HANDOVER.md — Agent & Engineer Handover Brief

**Project**: LITTLE SOMEWHERE  
**Current Phase**: Milestone 2A Audited & Conditionally Verified (`docs/audits/07-milestone-2a-final-validation.md`)  
**Target Next Phase**: Milestone 2B — Wave 0 Pre-2B Bug Fixes, Declarative Dialogue Engine (`dialogueEngine.ts`), Expanded Relationships, Conflicts & Personal Storylines (`docs/audits/08-milestone-2b-readiness.md`)

---

## 1. Current State of the Repository

Milestone 2A (Phases 1–4) simulation, persistence, visual transformation, and environmental architecture are implemented, compiled, unit-tested (**`28/28`**), and live-browser audited on desktop (`1440×900`) and mobile (`390×844`) with **`0` console errors and `0` console warnings**:
- **Official Visual Direction**: **PREMIUM HANDCRAFTED STORYBOOK DIORAMA** (`docs/art-direction/VISUAL_IDENTITY.md`) applied across Willow Step Cottage & Courtyard, Hearth & Crumb Bakery, Linden Book Nook, Copperwheel Cottage, Sunbeam Greenhouse, Pinecone Woodshop, Old Bell Gazebo, Mossy Stone Fountain, Sora's Tea Cart, Noticeboard, Hollow Oak, Mirror Pond & Cedar Bridge, 3-draw-call `InstancedMesh` grove, and all 10 articulated `CharacterRig` figures.
- **Core Gameplay & Simulation Loop**: Title Screen (`body[data-state="title"]`) -> Live Isometric Neighborhood (`body[data-state="playing"]`) -> Seeded Deterministic Simulation (`WorldState v2` + `v1 -> v2` migration + 28-node A* lane navigation + trait-driven autonomous activities & NPC-to-NPC encounters + bilateral relationship matrix) -> 5-Layer Weather & Seasonal Environment -> Pocket Journal -> Porch Rest to Advance Day -> `localStorage` Persistence (`little_somewhere_world_v1` with `little_somewhere_world_v1_backup`).
- **Prototype Scope Note (9 Living Residents)**: Clara, Arthur, Mina, Jun, Barnaby, Sora, Toby, Nora, and Pip form a deliberately limited testing population inside `willow_square`—not the intended final cast or world ceiling. Architecture supports additive resident and region expansion (`ResidentId`, `RESIDENT_ORDER`, `regionId`, `REGIONS`).
- **Environmental Reactivity**: 5-layer composer (`composeEnvironmentState`) + dirty-flagged `EnvironmentVisualController` drives time-of-day curves, weather (`sunlit`, `breezy`, `misty_morning` clearing at 10:30 AM, `light_rain`), 10-day seasons (`spring`, `summer`, `autumn`, `winter`), story-reactive props, and instanced rain/petal effects.

---

## 2. Where to Read First

1. `docs/audits/07-milestone-2a-final-validation.md` & `08-milestone-2b-readiness.md` — Independent Milestone 2A audit findings, confirmed defects, and exact Milestone 2B execution plan.
2. `docs/art-direction/VISUAL_IDENTITY.md` & `VISUAL_QUALITY_STANDARDS.md` — **Official Visual Identity (PREMIUM HANDCRAFTED STORYBOOK DIORAMA)** and mandatory asset review checklist.
3. `ARCHITECTURE.md` — System boundaries, `worldRef` vs React snapshot sync, isometric math, and narrative reactivity pipeline.
4. `GAME_DESIGN.md` — Visual bible, resident profiles, storyline graph, and Milestone 2–3 design specs.
5. `src/game/types.ts` — Single source of truth for `WorldState`, `StoryFlags`, `EnvironmentalState`, and `DialogueSession`.
6. `src/game/narrative.ts` & `src/game/simulation.ts` — Current branching dialogue trees, `computeEnvironmentState()`, and headless NPC life simulation.
7. `src/scene/NeighborhoodCanvas.tsx` & `src/scene/environmentRenderer.ts` — Three.js scene lifecycle, camera damping, input handling, and dirty-flagged environment rendering.

---

## 3. Critical Gotchas & Confirmed Defects (From Audit 07)

1. **Frame-0 Pre-Update Render (`src/scene/NeighborhoodCanvas.tsx:934-937`)**:
   - Synchronous initial `renderer.render(scene, camera)` executes before `tick()` / `envController.update()` has run, briefly displaying un-tinted Spring/Morning defaults and unrestored props under software WebGL until Frame 1 completes. Fix in Milestone 2B Wave 0 by running initial `envController.update()` before first render.
2. **Fountain Water Occlusion (`src/scene/builders/landmarks.ts:283-368`, `src/scene/models.ts:435-466`)**:
   - `outerWall` is a solid `CylinderGeometry` whose top sits at `y = 0.70`, hiding `dryFloor` (`0.52`) and `waterMesh` (`0.62`) even when `repairedFountain === true`. Fix in Wave 0 with a hollow rim/elevated basin floor & water plane.
3. **Mobile `JournalDrawer` Tab Overflow (`src/components/JournalDrawer.tsx:92-129`)**:
   - At `390×844`, `whitespace-nowrap shrink-0` tabs clip `"Story & Memories"` and push `"World & Time"` off-screen (where mobile players access `+2h` and weather forecasts). Fix in Wave 0.
4. **Hardcoded `/9` in `PauseModal.tsx:43`**:
   - Uses `{metCount}/9` instead of `/{RESIDENT_ORDER.length}` (also `"Meet nine neighbors"` in `TitleOverlay.tsx:50`).
5. **Save Lifecycle & `EnvironmentRenderer` Gaps**:
   - `getSaveStamp()` (`src/App.tsx:57-60`) omits `npcRuntime`, `flags`, `residents`, `mailboxUnread`, and `dailyLettersRead`; `saveWorldState()` (`src/game/storage.ts:64`) calls `JSON.stringify(state)` directly rather than `serializeWorldState(state)`.
   - `puddlesActive`, `claraPastryBasketVisible`, `minaGreenhouseStage`, and `arthurEarlyPorchLamp` are computed in `environment.ts` without 3D mesh bindings yet; `willowLaneDiorama.ts` hero trees stay spring-green across seasons; `showPetals` skips calm `sunlit` autumn/winter days.
6. **Software WebGL Timing (`isSoftwareGl`) & Layout Rules**:
   - Headless browsers pace via `afterDraw(tick)` with `dt` clamped to `0.05s`. Never use `backdrop-filter` / `backdrop-blur` over WebGL, and always run `npm test` after touching `worldMap.ts` or `residents.ts`.

---

## 4. Recommended Next Backlog (Milestone 2B -> Milestone 3)

1. **Wave 0 (Immediate Pre-2B Cleanup)**: Fix Frame-0 `envController.update()` order, hollow Fountain basin water geometry, mobile `JournalDrawer` tab wrapping, and `PauseModal.tsx` `RESIDENT_ORDER.length`.
2. **Milestone 2B — Declarative Dialogue & Deep Social Life (`docs/audits/08-milestone-2b-readiness.md`)**:
   - Extract `narrative.ts` into `src/game/dialogueEngine.ts` (`DialogueTopic[]`, priority/fallback selection, concurrent quest reply injection, topic cooldowns & `topicHistory`, retiring write-only `lastDialogueId`).
   - Surface Relationship Tiers (`stranger`..`kindred`), generalize NPC gossip & event reactions beyond Nora/Jun, generalize conflict/tension reconciliation beyond `arthur:clara`, and add 3–4 multi-beat personal storylines.
3. **Milestone 3+ (Explicitly Deferred)**:
   - Walkable/cutaway cottage interiors, carryable item inventory & gifting, multi-neighborhood regions & expanded resident population, and weekly plaza market stalls.

---

## 5. Verification Status at Audit (2026-11-18)

- `npm test` (`npx --yes tsx --test src/game/*.test.ts`) — **28/28 passing** (`0` failures, `731.5ms`)
- `npm run lint` (`tsc --noEmit`) — **Passing (0 errors)**
- `npm run build` (`vite build`) — **Passing** (`1,690` modules)
- Browser QA (`playwright-cli` on `1440×900` Title, Day 1, Jun dialogue, Journal, reload persistence, `v1 -> v2` Day 24 Autumn migration, `Summer · Light Rain`, `Winter · Misty Morning` clearing, `Lantern Dusk` & `390×844` mobile) — **0 console errors, 0 console warnings; 4 defects documented in `07-milestone-2a-final-validation.md`**

