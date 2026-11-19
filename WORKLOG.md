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
