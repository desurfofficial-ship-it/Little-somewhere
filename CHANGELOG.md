# Changelog

All notable changes to **LITTLE SOMEWHERE** are documented in this file.

## [0.2.0] — 2026-11-19

### Added — Milestone 3 (Builds 1–3)
- **Walkable Willow Step Cottage interior** (Build 3): furnished one-room interior with fieldstone hearth (phase-aware ember + flickering flames), moss-green quilt bed with a real *Rest Until Morning* flow, round table & stools on a woven rug, tinted bookshelf, kitchenette with jars & brass kettle, keepsake shelf + postcards, and a brass sconce that glows at dusk. Hinged porch door swings open as the player approaches; a dollhouse occlusion swap lifts the roof and camera-side walls the moment the player steps onto the porch. Entry ramp + raised porch/floor plates climb smoothly (`getGroundHeightAt`), the 38-node A* graph routes through the doorway, and the bed/hearth are real interactables with walkable approaches.
- **Fern Hollow Orchard** north district (Build 1): season-tinted crabapple orchard, fieldstone gate with hanging sign, harvest ladder/crates, bee skep, stepping stones, 5 nav nodes + orchard bench.
- **Player full-capability polish** (Build 2): bespoke storybook player rig (scarf/satchel/postcard/beret pin), dusk pocket lantern, idle flourishes, wave-hello emote with neighbor wave-back, tiered footstep audio + dust puffs, pinch-to-zoom, sprint camera juice.
- 17 new test suites covering cottage walkability/A*/plateaus/hysteresis/prop flows and scene-contract sync (88 total).

### Changed
- `player_door` interaction is now inside-aware flavor ("Step Inside" / "Step Outside"); resting moved to the new `player_bed` interactable (`rest_next_day`).
- Collision model: the solid cottage box became 5 wall segments + furniture obstacles with a 1.4-wide east doorway gap; nav graph grew from 33 to 38 nodes.

## [0.1.0] — 2026-11-18

### Added
- Selected **Sunlit Diorama & Clay Storybook** visual design direction.
- Built headless TypeScript game engine (`src/game/`) covering world collision, 4-phase schedules for 9 residents, branching dialogue trees (*The Silent Gazebo Bell*), environmental reactivity calculation, `localStorage` persistence, and procedural Web Audio SFX.
- Built isometric Three.js renderer (`src/scene/`) with composite low-poly clay cottages, greenhouse, lathe-geometry brass bell gazebo, flowing fountain, wooden footbridge, time-of-day atmospheric shifts, and `isSoftwareGl` pacing.
- Built mobile-first storybook UI (`src/components/`) including orbiting `TitleOverlay`, `VirtualJoystick`, bottom-docked `DialogueSheet`, `JournalDrawer`, and `PauseModal`.
- Added unit tests (`src/game/engine.test.ts`) and repository documentation (`AGENTS.md`, `ARCHITECTURE.md`, `GAME_DESIGN.md`, `HANDOVER.md`, `WORKLOG.md`, `README.md`).
