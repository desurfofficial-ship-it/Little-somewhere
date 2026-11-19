# HANDOVER.md — Agent & Engineer Handover Brief

**Project**: LITTLE SOMEWHERE  
**Current Phase**: Milestone 2A Stabilized — Wave 0 Complete (`docs/audits/07-milestone-2a-final-validation.md`)  
**Target Next Phase**: Milestone 2B — Declarative Dialogue Engine (`dialogueEngine.ts`), Expanded Relationships, Conflicts & Personal Storylines (`docs/audits/08-milestone-2b-readiness.md`)

---

## 1. Current State of the Repository

Milestone 2A (Phases 1–4) **plus Wave 0 stabilization** are implemented, compiled, unit-tested (**`32/32`** across pure simulation/persistence and Three.js scene initialization suites), and live-browser verified on desktop (`1440×900`) and mobile (`390×844`) with **`0` console errors and `0` console warnings**:
- **Official Visual Direction**: **PREMIUM HANDCRAFTED STORYBOOK DIORAMA** (`docs/art-direction/VISUAL_IDENTITY.md`) applied across Willow Step Cottage & Courtyard, Hearth & Crumb Bakery, Linden Book Nook, Copperwheel Cottage, Sunbeam Greenhouse, Pinecone Woodshop, Old Bell Gazebo, Mossy Stone Fountain (open recessed basin + visible water/droplets), Sora's Tea Cart, Noticeboard, Hollow Oak, Mirror Pond & Cedar Bridge, 3-draw-call `InstancedMesh` grove, and all 10 articulated `CharacterRig` figures.
- **Core Gameplay & Simulation Loop**: Title Screen (`body[data-state="title"]`) -> Live Isometric Neighborhood (`body[data-state="playing"]`) -> Seeded Deterministic Simulation (`WorldState v2` + `v1 -> v2` migration + 28-node A* lane navigation + trait-driven autonomous activities & NPC-to-NPC encounters + bilateral relationship matrix) -> 5-Layer Weather & Seasonal Environment (synchronized on Frame 0 before initial render) -> Pocket Journal (responsive 3-tab mobile layout) -> Porch Rest to Advance Day -> Normalized `localStorage` Persistence (`little_somewhere_world_v1` with `little_somewhere_world_v1_backup` and full-state `computeWorldSaveRevision` dirty detection).
- **Prototype Scope Note (9 Living Residents)**: Clara, Arthur, Mina, Jun, Barnaby, Sora, Toby, Nora, and Pip form a deliberately limited testing population inside `willow_square`—not the intended final cast or world ceiling. Architecture, UI (`PauseModal`, `JournalDrawer`, `TitleOverlay`), and tests derive counts from `RESIDENT_ORDER.length` and pair keys cleanly.
- **Environmental Reactivity**: 5-layer composer (`composeEnvironmentState`) + dirty-flagged `EnvironmentVisualController` drives time-of-day curves, weather (`sunlit`, `breezy`, `misty_morning` clearing at 10:30 AM, `light_rain`), 10-day seasons (`spring`, `summer`, `autumn`, `winter`), story-reactive props, and instanced rain/petal effects. See `07-milestone-2a-final-validation.md` for the 4-category classification of remaining deferred/visual-hook items.

---

## 2. Where to Read First

1. `docs/audits/07-milestone-2a-final-validation.md` & `08-milestone-2b-readiness.md` — Milestone 2A validation, Wave 0 resolutions, environmental item classifications, and Milestone 2B execution plan.
2. `docs/art-direction/VISUAL_IDENTITY.md` & `VISUAL_QUALITY_STANDARDS.md` — **Official Visual Identity (PREMIUM HANDCRAFTED STORYBOOK DIORAMA)** and mandatory asset review checklist.
3. `ARCHITECTURE.md` — System boundaries, `worldRef` vs React snapshot sync, isometric math, and narrative reactivity pipeline.
4. `GAME_DESIGN.md` — Visual bible, resident profiles, storyline graph, and Milestone 2–3 design specs.
5. `src/game/types.ts` — Single source of truth for `WorldState`, `StoryFlags`, `EnvironmentalState`, and `DialogueSession`.
6. `src/game/narrative.ts`, `src/game/simulation.ts` & `src/game/storage.ts` — Current branching dialogue trees, headless NPC life simulation, `computeWorldSaveRevision()`, and normalized persistence.
7. `src/scene/NeighborhoodCanvas.tsx` & `src/scene/environmentRenderer.ts` — Three.js scene lifecycle, Frame-0 visual sync, camera damping, input handling, and dirty-flagged environment rendering.

---

## 3. Operational Rules & Remaining Scope Notes (Post-Wave 0)

1. **Wave 0 Resolved Items (No Longer Blocking)**:
   - Frame-0 `syncVisualAndHud()` runs before the initial synchronous `renderer.render(scene, camera)` in `NeighborhoodCanvas.tsx`.
   - `buildStorybookFountain()` (`landmarks.ts`) and legacy `buildStoneFountain()` (`models.ts`) use recessed `LatheGeometry` stone basins so both dry floor (`y = 0.525`) and restored water (`y = 0.65`) render visibly inside the coping ring.
   - `JournalDrawer.tsx` tabs use a responsive `grid-cols-3` layout on `< 640px` mobile screens (`390×844`) with zero clipping.
   - `PauseModal.tsx`, `TitleOverlay.tsx`, `engine.test.ts`, and `simulation.test.ts` no longer hardcode `9`/`nine`.
   - `App.tsx` tracks `computeWorldSaveRevision(state)` across `npcRuntime`, `flags`, `residents`, `playerRelations`, `npcRelations`, `mailboxUnread`, `dailyLettersRead`, `memories`, and `worldEvents`, and `saveWorldState()` writes normalized `serializeWorldState(state)`.
2. **Remaining Non-Blocking Visual Integrations / Deferred Items (Classified in Audit 07)**:
   - *Missing visual integration*: 3D mesh hookups for `puddlesActive`, `claraPastryBasketVisible`, `minaGreenhouseStage`, `arthurEarlyPorchLamp`, and `willowLaneDiorama.ts` hero courtyard tree seasonal tinting.
   - *Deferred feature*: `src/game/dialogueEngine.ts` (Milestone 2B), calm-day autumn leaf / winter snow drift tuning beyond `breezy` (Milestone 2B/3 polish).
   - *Documentation-only*: Prototype 9-resident cast & single-region scope (extensible for future expansion).
3. **Software WebGL Timing (`isSoftwareGl`) & Layout Rules**:
   - Headless browsers pace via `afterDraw(tick)` with `dt` clamped to `0.05s`. Never use `backdrop-filter` / `backdrop-blur` over WebGL, and always run `npm test` after touching `worldMap.ts`, `residents.ts`, `storage.ts`, or `environmentRenderer.ts`.

---

## 4. Recommended Next Backlog (Milestone 2B -> Milestone 3)

1. **Milestone 2B — Declarative Dialogue & Deep Social Life (`docs/audits/08-milestone-2b-readiness.md`)**:
   - Extract `narrative.ts` into `src/game/dialogueEngine.ts` (`DialogueTopic[]`, priority/fallback selection, concurrent quest reply injection, topic cooldowns & `topicHistory`, retiring write-only `lastDialogueId`).
   - Surface Relationship Tiers (`stranger`..`kindred`), generalize NPC gossip & event reactions beyond Nora/Jun, generalize conflict/tension reconciliation beyond `arthur:clara`, and add 3–4 multi-beat personal storylines.
2. **Milestone 3+ (Explicitly Deferred)**:
   - Walkable/cutaway cottage interiors, carryable item inventory & gifting, multi-neighborhood regions & expanded resident population, and weekly plaza market stalls.

---

## 5. Verification Status (2026-11-18, Post-Wave 0)

- `npm test` (`tsx --test src/game/*.test.ts src/scene/*.test.ts`) — **32/32 passing** (`0` failures)
- `npm run lint` (`tsc --noEmit`) — **Passing (0 errors)**
- `npm run build` (`vite build`) — **Passing**
- Browser QA (`playwright-cli` on `1440×900` Title, Frame-0 Summer Golden Hour + restored fountain water, Frame-0 Autumn Light Rain Dusk, PauseModal, reload + `v1 -> v2` migration, & `390×844` mobile HUD + `JournalDrawer` tabs) — **0 console errors, 0 console warnings; all 4 Wave 0 defects verified fixed**


