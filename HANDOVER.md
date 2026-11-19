# HANDOVER.md — Agent & Engineer Handover Brief

**Project**: LITTLE SOMEWHERE  
**Current Phase**: Milestone 2B + Player & Character Excellence Upgrade Complete  
**Target Next Phase**: Milestone 3 Expansion (Walkable Interiors, Multi-Region Map, & Additional Residents)

---

## 1. Current State of the Repository

The **Player & Character Excellence Upgrade** (Phases 1–12) on top of Milestone 2A/2B is implemented, compiled, unit-tested (**`46/46`** across pure simulation/dialogue/navigation/player/relationship/persistence and Three.js scene suites), and live-browser verified on desktop (`1440×900`) and mobile (`390×844`) with **`0` console errors and `0` console warnings**:
- **Official Visual Direction**: **PREMIUM HANDCRAFTED STORYBOOK DIORAMA** (`docs/art-direction/VISUAL_IDENTITY.md`) applied across Willow Step Cottage & Courtyard, Hearth & Crumb Bakery, Linden Book Nook, Copperwheel Cottage, Sunbeam Greenhouse, Pinecone Woodshop, Old Bell Gazebo, Mossy Stone Fountain (open recessed basin + visible water/droplets), Sora's Tea Cart, Noticeboard, Hollow Oak, Mirror Pond & Cedar Bridge, 3-draw-call `InstancedMesh` grove, 5 carryable world props, 4 walkable cedar benches, and all 10 articulated `CharacterRig` figures.
- **Core Gameplay, Simulation & Character Loop**: Title Screen (`body[data-state="title"]`) -> Live Isometric Neighborhood (`body[data-state="playing"]`) -> Seeded Deterministic Simulation (`WorldState v3` with `v1 -> v2 -> v3` migration + 28-node A* lane navigation + utility-scored autonomous activities, seat reservation, & 2–3 NPC social encounters + bilateral relationship & reliability matrix) -> Analog Walk/Run/Sprint, Bridge Elevation, Carryable Prop Cradle & Gifting, Bench Sitting (`computeSitGroundY`), Contextual Player/NPC Poses (`wave`, `talk`, `interact`, `sit`, `carry`) & Dialogue Camera Framing -> Declarative `dialogueEngine.ts` (conflict mediation, `make_amends` recovery, 4 multi-beat side storylines, anti-repeat `topicHistory`) -> Normalized `localStorage` Persistence (`little_somewhere_world_v1`).
- **Prototype Scope Note (9 Living Residents)**: Clara, Arthur, Mina, Jun, Barnaby, Sora, Toby, Nora, and Pip form a deliberately limited testing population inside `willow_square`—architecture, UI, and tests derive counts from `RESIDENT_ORDER.length` and pair keys cleanly.

---

## 2. Where to Read First

1. `docs/art-direction/VISUAL_IDENTITY.md` & `VISUAL_QUALITY_STANDARDS.md` — **Official Visual Identity (PREMIUM HANDCRAFTED STORYBOOK DIORAMA)** and mandatory asset review checklist.
2. `ARCHITECTURE.md` — System boundaries, `worldRef` vs React snapshot sync, isometric math, and narrative reactivity pipeline.
3. `src/game/types.ts` — Single source of truth for `WorldState` (v3), `StoryFlags`, `PlayerPosture`, `CarryableItemId`, `DialogueTopic`, and `DialogueSession`.
4. `src/game/playerController.ts`, `src/game/simulation.ts`, `src/game/dialogueEngine.ts`, `src/game/narrative.ts`, & `src/game/storage.ts` — Movement/posture/targeting math, headless NPC life simulation, declarative dialogue selector, and normalized v3 persistence.
5. `src/scene/NeighborhoodCanvas.tsx` & `src/scene/builders/characters.ts` — Three.js scene lifecycle, A* tap-to-walk, dialogue camera framing, procedural character poses/cradle kinematics, and `isSoftwareGl` rendering.

---

## 3. Operational Rules & Notes

1. **Software WebGL Timing (`isSoftwareGl`) & Layout Rules**:
   - Headless browsers pace via `afterDraw(tick)` with `dt` clamped to `0.05s`. Never use `backdrop-filter` / `backdrop-blur` over WebGL, keep `VirtualJoystick` `shrink-0` on mobile, and always run `npm test` after touching `worldMap.ts`, `residents.ts`, `storage.ts`, or `environmentRenderer.ts`.
2. **Environmental Hooks Now Wired (Milestone 3 polish foundation)**:
   - `puddlesActive`, `claraPastryBasketVisible`, `minaGreenhouseStage`, and `arthurEarlyPorchLamp` all have 3D visual layers in `src/scene/builders/reactiveProps.ts` (built once in `NeighborhoodCanvas.tsx`, toggled/animated by `environmentRenderer.ts`).
   - Meadow margins additionally carry instanced botanical dressing (`src/scene/builders/botanicalDressing.ts`); when adding lanes or obstacles, keep `COBBLE_LANE_RECTS` in sync with the cobble strips and the dressing placement tests will guard walkability.
   - Remaining Milestone 3 work: multi-region map expansion, walkable interiors, and additional residents.

---

## 4. Verification Status (2026-11-19)

- `npm test` (`tsx --test src/game/*.test.ts src/scene/*.test.ts`) — **50/50 passing** (`0` failures)
- `npm run lint` (`tsc --noEmit`) — **Passing (0 errors)**
- `npm run build` (`vite build`) — **Passing**
- Browser QA (headless Chromium on `1440×900` Desktop & `390×844` Mobile: morning dressing pass, dusk festoon/fireflies/window glow, rain-day puddles & rain streaks via patched serialized save, `+2h` phase advance) — **0 console errors, 0 console warnings**



