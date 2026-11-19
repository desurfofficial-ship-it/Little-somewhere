# HANDOVER.md — Agent & Engineer Handover Brief

**Project**: LITTLE SOMEWHERE  
**Current Phase**: Milestone 1 Complete (Playable Vertical Slice & Core Engine)  
**Target Next Phase**: Milestone 2 (Deeper Daily Life, Cottage Interiors, Gifting & Ambient NPC Socializing)

---

## 1. Current State of the Repository

The playable vertical slice is **complete, compiled, unit-tested, and browser-verified** on both desktop (`1440×900`) and mobile (`390×844`):
- **Core Gameplay Loop**: Title Screen (`body[data-state="title"]`) -> Live Isometric Neighborhood (`body[data-state="playing"]`) -> Branching Resident Dialogue / Prop Inspection -> Pocket Journal -> Porch Rest to Advance Day -> `localStorage` Persistence.
- **9 Living Residents**: Clara, Arthur, Mina, Jun, Barnaby, Sora, Toby, Nora, and Pip each have distinct 3D silhouettes, 4-phase schedules (`morning`, `afternoon`, `golden`, `dusk`), trust levels (`0–5`), and interconnected dialogue for *The Silent Gazebo Bell*.
- **Environmental Reactivity**: Resolving beats visibly transforms the 3D scene (window-box flowers bloom in 3 stages, gazebo ivy clears, stone fountain water & droplets activate, bakery outdoor café tables appear, plaza festoon lanterns glow, marigold ribbon drapes the gazebo, Hollow Oak glint vanishes on pickup, and the brass bell physically swings and emits particles when rung).

---

## 2. Where to Read First

1. `ARCHITECTURE.md` — System boundaries, `worldRef` vs React snapshot sync, isometric math, and narrative reactivity pipeline.
2. `GAME_DESIGN.md` — Visual bible, resident profiles, storyline graph, and Milestone 2–3 design specs.
3. `src/game/types.ts` — Single source of truth for `WorldState`, `StoryFlags`, `EnvironmentalState`, and `DialogueSession`.
4. `src/game/narrative.ts` — All branching dialogue trees and `computeEnvironmentState()`.
5. `src/scene/NeighborhoodCanvas.tsx` — Three.js scene lifecycle, camera damping, input handling, and per-frame animation.

---

## 3. Critical Gotchas & Non-Obvious Constraints

1. **Software WebGL Timing (`isSoftwareGl`)**:
   - Headless browsers and software-GL environments run at ~8–10 FPS via `afterDraw(tick)`. Frame `dt` is clamped to `0.05s` (`Math.min(rawDt, 0.05)`). Automated tests simulating long walks via held keys should account for ~0.4s of simulated game time per 1s of headless wall time, or use tap-to-walk / `?autostart=1`.
2. **Coordinate System (`Vec2` vs `ScreenVec2`)**:
   - World positions and collisions use `Vec2` (`{ x, z }`) because Three.js Y is up.
   - Screen-space joystick input uses `ScreenVec2` (`{ x, y }`). `NeighborhoodCanvas.tsx` rotates screen input by 45° (`0.7071`) to match the isometric camera at `(+19.5, +18.2, +19.5)`.
3. **Persistence Key & Schema Evolution**:
   - `src/game/storage.ts` persists under `little_somewhere_world_v1`. `loadWorldState()` merges persisted fields onto `createFreshWorldState()`, so adding optional fields to `StoryFlags` or new residents is backward-compatible as long as defaults exist in `createInitialStoryFlags()` and `createInitialResidentsProgress()`.
4. **No `backdrop-filter` Over WebGL**:
   - Keep HUD cards opaque or `rgba`/`/95` solid fills (`bg-[#FAF5EC]/95`) without `backdrop-blur` so software WebGL compositing never stalls.
5. **Collision vs Schedule Targets**:
   - Always run `npm test` after editing `src/game/worldMap.ts` or `src/game/residents.ts`. Test #3 enforces that every single resident's 4 schedule coordinates are strictly walkable (`isPointWalkable(..., 0.35)`).

---

## 4. Recommended Next Backlog (Milestone 2)

1. **NPC-to-NPC Ambient Banter**: When two residents occupy the same zone (e.g., Clara & Arthur at Golden Hour after reconciliation, or Mina & Clara at Bakery Patio), display floating world-space speech bubbles or ambient waves.
2. **Player Home Interior & Decoration**: Clicking `Enter Cottage` at Willow Step Cottage transitions the camera or swaps into a cozy cutaway interior scene where collected souvenirs (coastal postcard stamp, marigold ribbon, sketchbook doodle) appear on shelves.
3. **Lightweight Item Inventory & Gifting**: Carry small gifts (rosemary loaf, chamomile flask, moon-petal sprig) to deepen trust outside the main bell questline and unlock repeatable daily micro-stories.
4. **Multi-Day Dynamic Weather & Weekly Market**: Introduce occasional gentle rain days (glistening cobbles, umbrellas/hoods, cozy indoor schedules) and a Sunday Market stall cluster in the plaza.
5. **Optional Cloud Save / Sync**: Add optional backend or Firebase sync behind `src/game/storage.ts` while keeping offline `localStorage` as immediate local state.

---

## 5. Verification Status at Handover

- `npx --yes tsx --test src/game/engine.test.ts` — **5/5 passing**
- `npm run lint` (`tsc --noEmit`) — **Passing (0 errors)**
- `npm run build` (`vite build`) — **Passing**
- Browser QA (`playwright-cli` on `1440×900` & `390×844`) — **Passing (0 console errors)**
