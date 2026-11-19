# Changelog

All notable changes to **LITTLE SOMEWHERE** are documented in this file.

## [0.5.0] — 2026-11-20

### Added — Milestone 2C Polish Round 3 (Everyday Life Passes 8–12)
- **A room that knows the weather & the hour** — rain streaks sliding down the west window, a translucent wet-glass veil with dimmed/cooling pane emissive, suppressed sun shafts and hushed dust motes in rain/mist, breezy-only linen curtain sway, winter sill frost wedges, and shelf clock hands that now read the actual in-game time (`cottageInterior.ts`, zero-GC reactive updates).
- **Rain room-tone** — `playRainAmbience()`: looping low rumble + faint patter hiss, gated to rainy-day interiors on transitions only, layering under the hearth crackle, mute-respecting (`audio.ts`, `NeighborhoodCanvas.tsx`).
- **The home breathes outside** — pure `computeChimneySmokeStrength()` gates the Willow Step Cottage chimney: clean while the hearth is cold, baseline smoke when lit, visibly harder while the kettle is warm (`cottage.ts`, `willowLaneDiorama.ts`).
- **The neighborhood notices home rituals** — Mina's new `everyday_home_kettle_steam` daily-slice topic reads the steaming window / tended vase cues; the Pocket Journal home card counts "Quiet tea-table moments" from first-time tea ritual memories (`narrative.ts`, `journal.ts`, `JournalDrawer.tsx`).
- **Weather-aware morning wake line** — resting now names the world you wake into: four weather lines plus a winter frost accent appended to the wake toast (`buildMorningWakeLine`).

### Changed
- Interior rig update now derives weather/season/minuteOfDay reactivity from `WorldState` directly (no signature change, no schema bump); `WillowCottageInteriorRig` exposes `rainStreaks`, `wetGlassVeilMat`, `frostDressing`, `clockHands`, `windowShaftMat`, `moteMaterial`, and `curtainPanels` for tests.
- `updateWillowPrototypeMotion` gains an optional `smokeStrength` parameter (default 1 preserves the old visual for callers without cottage state).

### Tests
- 8 new suites (126 → **134 passing**): living clock hands, rain/mist/sunlit window states, shaft & mote suppression, curtain sway, winter frost, chimney strength mapping, kettle-steam topic branches + integration, wake lines, journal ritual count, audio room-tone idempotency.

## [0.4.0] — 2026-11-19

### Added — Milestone 3 (Build 2: Completing Fern Hollow Orchard)
- **Orchard Social Routines & Shared Tasting Table Activities** — added Fern Hollow Orchard utility activities (`clara`, `mina`, `barnaby`, `pip`, `rowan`), shared post-completion Tasting Table gatherings, north-orchard social banter, Noticeboard bulletin updates, and Rowan's orchard mailbox letter.
- **Interactive Orchard Bee Skep (`orchard_skep`) & 3-Stage Orchard Storyline (`side_orchard_gathering`)** — added season-, weather-, and gathering-reactive skep inspection (`Woven Bee Skep & Honey Crock`), the 3-stage *The Fern Hollow Orchard Gathering* arc with dual permanent outcomes (`spiced_tart_table` vs `blossom_honey_picnic`), item rewards, cross-resident relation boosts, non-omniscient epilogue dialogue, and Pocket Journal `Stories` + `Discoveries` updates.
- **Permanent 3D Tasting Table & Orchard Micro-Life Completion** — enhanced `orchard_skep` with glazed honey crock + dipper + clover tufts, built the permanent cedar **Orchard Tasting Table** (`ORCHARD_TASTING_TABLE` synced with `worldMap.ts`) + outcome-switched tea/tart platters + lit marigold lantern garland via `OrchardRig.setGatheringVisual()`, and added 3 perched **Orchard Songbirds** + instanced seasonal **Orchard Blossom / Leaf Drift** (`buildOrchardAmbientExtras`).

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
