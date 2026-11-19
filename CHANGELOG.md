# Changelog

All notable changes to **LITTLE SOMEWHERE** are documented in this file.

## [0.4.0] — 2026-11-20

### Added — Milestone 3 (Build 5)
- **Walkable Willow Step Cottage interior** — `builders/cottageInterior.ts` renders the player's home as a cutaway diorama: full-height north/west walls with sage-shuttered windows, wainscot cutaway stubs, plank floor, woven rug, ceiling beams, and an inward-swinging ajar front door. Furniture mirrors `COTTAGE_INTERIOR_OBSTACLES` exactly: stone hearth with chimney breast, recessed firebox (ember bed, crossed logs, animated flame, pooled kettle steam), timber bed with 20-patch storybook quilt, pedestal oak table with the stoneware pitcher vase (three swappable flower bundles), keepsake sideboard + wall shelf (five displayable keepsakes), window almanac desk with open almanac, quill pot, banker's lamp, and the sunlit sill planter. 7 invisible hit proxies feed the existing pointer pipeline.
- **Reactive home decor** — `rig.update(world, phase, elapsed)` (zero per-frame allocation) drives vase bundles by `placedFlowerId`, all five keepsakes by `displayedKeepsakeIds`, kettle steam while the kettle is warm, hearth ember/flame/point-light breathing, phase-driven banker's-lamp emissive (dusk 2.2), and window-glass daylight tint. Indoor ambience (hemi/sun/environment) is now phase-responsive, settling into warm ember twilight at dusk.
- Deterministic QA harnesses: `scripts/make_cottage_save.ts` (dusk decorated interior save), `scripts/qa_cottage.py` (3-case screenshot sweep), `scripts/qa_cottage_ui.py` (vase modal + satchel interaction), `scripts/debug_cottage_rig.ts` (headless rig state dump).

### Fixed
- **Restored Build 4 orchard wiring** silently dropped by the previous commit: `orchardRig` / `orchardMicroLife` deps, the crown/fruit `updateWind` call, and the section-6 butterfly/bee gating in `environmentRenderer.ts` (keeping its `exteriorRoot` rain/petal parenting fix).
- **Test/type repairs** on the inherited half-shipped tree: added `RESIDENT_GIFT_PREFS.rowan`, imported the cottage actions used by `journal.test.ts`, and migrated `cottage.test.ts` to the current `stepPlayerMovement` input-object API. Suite total 108/108 passing, `tsc --noEmit` 0 errors (was 13).

## [0.3.0] — 2026-11-19

### Added — Milestone 3 (Build 4)
- **10th resident: Rowan, the Orchard Keeper** — a full registry-derived neighbor for Fern Hollow Orchard: straw hat + woven gathering-basket prop (heaped crabapples), 4-phase orchard schedule (blossom counts, skep tending, bench journaling, keeper's corner), 4 autonomous activities (incl. a light-rain shelter under the west canopy and a `seat_orchard_bench` rest claim), two daily dialogue topics (blossom calendar + harvest-ladder), and automatic integration into memories, gossip, social encounters, and old-save hydration.
- **Fern Hollow micro-life (sway hooks + butterflies + bees)** — `OrchardRig.updateWind` sways crowns & fruit rigidly about a trunk-top pivot with the shared wind curve (breezy/rain/calm), restoring the authored rest pose exactly when calm; new `builders/orchardMicroLife.ts` adds per-blossom-tinted butterflies anchored to crowns/gate/bench/skep (3–6, quality-tiered) and figure-eight skep bees (2–4), both weather/phase/season-gated by the environment controller with zero per-frame allocations.
- 5 new test suites (orchard sway ×2, orchard micro-life ×3) covering pivot math, rest-pose restore, canopy bounds, anchor fidelity, and weather gating; the memory save-size bound is now derived from `RESIDENT_ORDER.length` instead of hardcoding 9 residents.

## [0.1.0] — 2026-11-18

### Added
- Selected **Sunlit Diorama & Clay Storybook** visual design direction.
- Built headless TypeScript game engine (`src/game/`) covering world collision, 4-phase schedules for 9 residents, branching dialogue trees (*The Silent Gazebo Bell*), environmental reactivity calculation, `localStorage` persistence, and procedural Web Audio SFX.
- Built isometric Three.js renderer (`src/scene/`) with composite low-poly clay cottages, greenhouse, lathe-geometry brass bell gazebo, flowing fountain, wooden footbridge, time-of-day atmospheric shifts, and `isSoftwareGl` pacing.
- Built mobile-first storybook UI (`src/components/`) including orbiting `TitleOverlay`, `VirtualJoystick`, bottom-docked `DialogueSheet`, `JournalDrawer`, and `PauseModal`.
- Added unit tests (`src/game/engine.test.ts`) and repository documentation (`AGENTS.md`, `ARCHITECTURE.md`, `GAME_DESIGN.md`, `HANDOVER.md`, `WORKLOG.md`, `README.md`).
