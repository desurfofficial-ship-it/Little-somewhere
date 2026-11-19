# ARCHITECTURE.md — System & Engine Architecture

**LITTLE SOMEWHERE** is structured as a cleanly decoupled three-layer TypeScript + React + Three.js application.

---

## 1. High-Level System Diagram

```
┌───────────────────────────────────────────────────────────────────────────┐
│                         React Game Shell (src/App.tsx)                    │
│  body[data-state]: 'title' | 'playing' | 'paused'                         │
│  Holds worldRef (mutable 60Hz ref) + throttled HUD state snapshots        │
├──────────────────────────────┬────────────────────────────────────────────┤
│   HUD & Storybook UI         │     Isometric 3D Diorama Viewport          │
│   (src/components/*)         │     (src/scene/NeighborhoodCanvas.tsx)     │
│                              │                                            │
│  • TitleOverlay              │  • Mounted once via useEffect(..., [])     │
│  • VirtualJoystick           │  • Composite 3-12 part clay models         │
│  • DialogueSheet             │  • Procedural CanvasTextures & RoomEnv     │
│  • JournalDrawer             │  • Isometric follow/orbit camera damping   │
│  • PauseModal                │  • Raycast picking & ground tap-to-walk    │
│                              │  • Software-WebGL afterDraw() pacing       │
└──────────────┬───────────────┴──────────────────────┬─────────────────────┘
               │                                      │
               │ Reads/Mutates via pure reducers      │ Reads worldRef &
               │ & syncs ~6Hz snapshots               │ emits nearestTarget
               ▼                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│               Headless Game Engine (src/game/* — Zero UI/3D)              │
│                                                                           │
│  • types.ts      — WorldState, StoryFlags, EnvironmentalState, Dialogue   │
│  • worldMap.ts   — Bounds, box/circle obstacles, axis-sliding collision   │
│  • residents.ts  — 9 residents, 4-phase schedules, appearance metadata    │
│  • narrative.ts  — Branching dialogue trees & computeEnvironmentState()   │
│  • actions.ts    — applyDialogueChoice(), interactWithProp(), day rest    │
│  • storage.ts    — localStorage persistence ('little_somewhere_world_v1') │
│  • audio.ts      — Procedural Web Audio API SFX (footsteps, chimes, bell) │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 2. State Ownership & Frame Loop Decoupling

### Why `worldRef` + `worldSnapshot`?
Running React `setState` inside a 60 Hz Three.js animation loop causes continuous React reconciliation, GC pauses, and canvas stutter. Instead:
- **`worldRef.current`** is the live authoritative mutable state read by `NeighborhoodCanvas.tsx` each frame (player `x/z`, facing, and gently advancing `minuteOfDay`).
- **`hudSync`** throttles updates to React (`~6 Hz` or immediately when `nearestTarget` changes) to refresh the clock text, landmark label, and contextual `[E]` interact button.
- **Discrete Narrative Mutations** (selecting a dialogue choice, inspecting a prop, resting until morning, advancing time `+2h`) run through pure reducers in `src/game/actions.ts` and call `commitWorld()`, which atomically updates `worldRef.current`, React `worldSnapshot`, and `localStorage`.

---

## 3. Isometric Camera & Movement Math

- **Camera Rig**: `PerspectiveCamera` with narrow `fov = 28°` positioned at offset `(+19.5 * zoom, +18.2 * zoom, +19.5 * zoom)` relative to the player, smoothly damped with `THREE.MathUtils.damp(..., 6.5, dt)`.
- **Title Mode Orbit**: When `screenState === 'title'`, the camera smoothly orbits radius `27m` around the Town Square & Old Bell Gazebo `(0, 1.4, -2.5)`.
- **Screen-Aligned Isometric Input**:
  Because the camera looks along `(-1, 0, -1)`:
  - Screen Right (`+X_screen`) maps to world `(+0.7071, -0.7071)`.
  - Screen Down (`+Y_screen`) maps to world `(+0.7071, +0.7071)`.
  - Therefore:
    ```ts
    moveX = screenHoriz * 0.7071 + screenVert * 0.7071;
    moveZ = -screenHoriz * 0.7071 + screenVert * 0.7071;
    ```
  This single transform unifies WASD, Arrow Keys, and the mobile `VirtualJoystick`!

---

## 4. Collision & Resident Schedule Steering

- **Obstacle Primitives (`src/game/worldMap.ts`)**:
  - `BOX_OBSTACLES`: Rectangular footprints for all 6 buildings + Mirror Pond water basin.
  - `CIRCLE_OBSTACLES`: Circular footprints for the Stone Fountain, Gazebo plinth, Hollow Oak trunk, Tea Cart, and Noticeboard.
- **Axis-Separated Sliding (`resolveMovement`)**:
  - Checks `(desired.x, desired.z)`. If blocked, falls back to `(desired.x, current.z)` or `(current.x, desired.z)` so players and NPCs glide smoothly along cottage walls and plaza rims instead of snagging.
- **Schedule Transitions**:
  - `getTimePhase(minuteOfDay)` maps `360–1260` (6:00 AM–9:00 PM) into `morning`, `afternoon`, `golden`, and `dusk`.
  - When a phase changes (or when `claraArthurReconciled` flips true!), `getResidentScheduleSlot()` returns the new target coordinate and residents walk smoothly across the lanes at `2.3 m/s`.

---

## 5. Narrative Branching & Environmental Reactivity Pipeline

```
Dialogue Choice / Prop Inspection
        │
        ▼
applyDialogueChoice() / interactWithProp()
  ├── Mutates ResidentProgress (trust 0..5, mood, met, talkedToday)
  ├── Sets StoryFlags (e.g. clearedGazeboIvy, foundBrassClapper, bellRestored)
  └── Appends unique JournalMemory (day + phase stamped)
        │
        ▼
computeEnvironmentState(world.flags)
  ├── plantersBloomed (0..3)   ──▶ Scales cottage window-box flowers
  ├── ivyCleared               ──▶ Hides gazebo creeping ivy meshes
  ├── fountainFlowing          ──▶ Enables basin water + rising droplet arcs
  ├── festoonLanterns          ──▶ Reveals & lights plaza overhead string bulbs
  ├── bakeryTablesOpen         ──▶ Reveals Clara's outdoor sourdough café tables
  ├── reconciledTogether       ──▶ Ties Nora's marigold ribbon + shifts Clara/Arthur Golden Hour
  └── bellGleaming             ──▶ Unlocks Gazebo Bell rope ring + damped spring swing + sparkles
```

---

## 6. File Map

| Path | Responsibility |
| :--- | :--- |
| `src/game/types.ts` | Core domain interfaces (`WorldState`, `StoryFlags`, `DialogueSession`) |
| `src/game/worldMap.ts` | Neighborhood map, bounds, collision math, landmarks, prop zones |
| `src/game/residents.ts` | 9 resident definitions, appearances, 4-phase schedules, clock helpers |
| `src/game/narrative.ts` | Branching dialogue builder, quest cues, `computeEnvironmentState()` |
| `src/game/actions.ts` | Pure state transition reducers, mailbox letters, prop interactions |
| `src/game/storage.ts` | `localStorage` save/load/reset and `advanceToNextDay()` |
| `src/game/audio.ts` | Procedural Web Audio synthesizer (footsteps, voice, chime, brass bell) |
| `src/game/engine.test.ts` | Deterministic `node:test` suite for collision, schedules, and story flow |
| `src/scene/textures.ts` | Seeded procedural `CanvasTexture` generators (meadow, cobbles, shingles, contact shadows) |
| `src/scene/materials.ts` | Shared `MaterialPalette` cache enforcing roughness/ACES color discipline |
| `src/scene/models.ts` | Composite clay cottages, greenhouse, lathe brass bell gazebo, stone fountain, characters |
| `src/scene/prototypes/willowLaneDiorama.ts` | Premium Handcrafted Storybook Diorama prototype (Willow Step Cottage, lane, foliage & Jun) |
| `src/scene/NeighborhoodCanvas.tsx` | Three.js renderer, lighting cycle, movement, raycasting, animation loop |
| `src/components/*` | `TitleOverlay`, `VirtualJoystick`, `DialogueSheet`, `JournalDrawer`, `PauseModal` |
| `src/App.tsx` | Top-level game shell, HUD bar, keyboard shortcuts, persistence wiring |
| `docs/art-direction/*` | Official **Premium Handcrafted Storybook Diorama** identity, standards, audit & roadmap |

