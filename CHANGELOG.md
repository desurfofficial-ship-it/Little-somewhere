# Changelog

All notable changes to **LITTLE SOMEWHERE** are documented in this file.

## [0.1.0] — 2026-11-18

### Added
- Selected **Sunlit Diorama & Clay Storybook** visual design direction.
- Built headless TypeScript game engine (`src/game/`) covering world collision, 4-phase schedules for 9 residents, branching dialogue trees (*The Silent Gazebo Bell*), environmental reactivity calculation, `localStorage` persistence, and procedural Web Audio SFX.
- Built isometric Three.js renderer (`src/scene/`) with composite low-poly clay cottages, greenhouse, lathe-geometry brass bell gazebo, flowing fountain, wooden footbridge, time-of-day atmospheric shifts, and `isSoftwareGl` pacing.
- Built mobile-first storybook UI (`src/components/`) including orbiting `TitleOverlay`, `VirtualJoystick`, bottom-docked `DialogueSheet`, `JournalDrawer`, and `PauseModal`.
- Added unit tests (`src/game/engine.test.ts`) and repository documentation (`AGENTS.md`, `ARCHITECTURE.md`, `GAME_DESIGN.md`, `HANDOVER.md`, `WORKLOG.md`, `README.md`).
