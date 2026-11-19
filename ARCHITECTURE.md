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
│  • types.ts      — WorldState v4, StoryFlags, NpcMemoryEntry, Dialogue   │
│  • time.ts/rng.ts— Unified 360–1290 clock, 10-day seasons, deterministic PRNG│
│  • worldMap.ts   — Bounds, box/circle obstacles, seats, carryable props    │
│  • navigation.ts — 38-node A* lane graph + cottage interior, LOS smoothing  │
│  • residents.ts  — Founding residents, traits, 4-phase slots & activities  │
│  • simulation.ts — Needs, emotions, autonomous encounters & gossip hooks   │
│  • memories.ts   — Bounded NPC memories, witness rules, encounter gossip   │
│  • relationships.ts — Player<->NPC & NPC<->NPC tiers, daily cap, events    │
│  • dialogueEngine.ts — Declarative selector, non-omniscient memory & gossip│
│  • narrative.ts  — Story topics, Bell & side arcs, computeEnvironmentState │
│  • actions.ts    — Dialogue, prop, water wish/skip, & next-day reducers    │
│  • environment.ts— 5-layer Environment Composer (time/weather/season/props)│
│  • playerController.ts — Locomotion, bridge Y, bench sit, prop targeting   │
│  • migrations.ts — v1 -> v2 -> v3 -> v4 save migration & field sanitization│
│  • storage.ts    — localStorage persistence ('little_somewhere_world_v1')  │
│  • audio.ts      — Procedural Web Audio API SFX (footsteps, chimes, bell)  │
└────────────────────────────────────────────────────────────────────────────┘
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
- **Title Mode Orbit**: When `screenState === 'title'`, the camera smoothly orbits radius `27m` around `(1.5, 1.4, -2.5)` to keep west rooflines clear of the title card.
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

- **Obstacle Primitives & 38-Node A* Graph (`src/game/worldMap.ts`, `src/game/navigation.ts`)**:
  - `BOX_OBSTACLES`: Rectangular footprints for all 6 buildings, Mirror Pond water basin, `bridge_west_rail`, and the **Willow Step Cottage shell** (5 wall segments leaving a 1.4-wide east doorway gap) + its furniture (bed, hearth, bookshelf, kitchenette, porch rails — synced with `src/scene/builders/cottageInterior.ts`).
  - `CIRCLE_OBSTACLES`: Circular footprints for the Stone Fountain, Gazebo plinth, Hollow Oak trunk, Tea Cart, Noticeboard, 5 cedar benches, Willow courtyard trees/signpost, Fern Hollow Orchard trees/gate/props (synced with `src/scene/builders/orchard.ts`), and cottage table/stools/porch dressing.
  - `NAV_NODES` (`38` nodes) & `NAV_EDGES`: Connected cobblestone, bridge, orchard, and **cottage interior** waypoint graph (porch -> doorway -> room/bedside/hearth) with line-of-sight smoothing for tap-to-walk and NPC steering.
  - **Walkable Cottage Plates**: `getGroundHeightAt()` composes hard porch (0.42) & interior floor (0.46) plateaus with a smoothstep entry ramp (lawn -> deck through the stair gap), so walkers climb the threshold without popping; `isPlayerInCottageInterior()` provides the hysteresis ON/OFF rects that drive the dollhouse occlusion swap.
- **Axis-Separated Sliding (`resolveMovement`)**:
  - Checks `(desired.x, desired.z)`. If blocked, falls back to `(desired.x, current.z)` or `(current.x, desired.z)` so players and NPCs glide smoothly along cottage walls and plaza rims instead of snagging.
- **Schedule Transitions**:
  - `getTimePhase(minuteOfDay)` maps `360–1290` (`6:00 AM–9:30 PM`, `src/game/time.ts`) into `morning`, `afternoon`, `golden`, and `dusk`.
  - `stepSimulationInPlace()` blends 4-phase anchor slots (`getResidentScheduleSlot()`) with utility-scored `RESIDENT_EXTRA_ACTIVITIES`, autonomous encounters, and late-dusk porch wind-down (`1225+`), moving residents at `2.3 m/s` (`DEFAULT_NPC_SPEED`).

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
| `src/game/types.ts` | Core domain interfaces (`WorldState` v4, `StoryFlags`, `NpcMemoryEntry`, `DialogueSession`) |
| `src/game/time.ts`, `rng.ts` | Unified clock (`360–1290`), 10-day 4-season calendar, deterministic FNV/Mulberry PRNG |
| `src/game/worldMap.ts`, `navigation.ts` | Neighborhood map, bounds, collision math, landmarks, props, cottage interior plates, 38-node A* graph |
| `src/game/residents.ts`, `simulation.ts` | Founding resident definitions, traits, schedules, needs/emotions, encounters & gossip triggers |
| `src/game/memories.ts`, `relationships.ts` | Bounded per-NPC subjective memories, witness rules, controlled gossip/distortion, tiers & events |
| `src/game/dialogueEngine.ts`, `narrative.ts` | Declarative selector, knowledge-based gossip & reactions, Bell & side arcs, `computeEnvironmentState()` || `src/game/actions.ts`, `playerController.ts` | Pure state transition reducers, mailbox letters, prop/water actions, locomotion & bench logic |
| `src/game/environment.ts` | Pure 5-Layer Environment Composer (time, seeded weather, season, flags, NPC touches) |
| `src/game/migrations.ts`, `storage.ts`, `audio.ts` | `v1 -> v2 -> v3 -> v4` migrations, `localStorage` autosave + revision hash, Web Audio SFX |
| `src/game/*.test.ts`, `src/scene/*.test.ts` | Deterministic `node:test` suites covering engine rules, saves, and 3D scene contracts |
| `src/scene/textures.ts`, `materials.ts` | Seeded procedural `CanvasTexture` surfaces & shared `MaterialPalette` cache |
| `src/scene/models.ts`, `waterShaders.ts` | Shared rig type contracts (`GazeboRig`, `FountainRig`, `MirrorPondRig`, `CharacterRig`) & water shaders |
| `src/scene/builders/*` | Composite clay buildings, landmarks, Mirror Pond/bridge/grove, Fern Hollow Orchard, **walkable cottage interior (dollhouse shell, furniture, door swing, ember)**, characters, reactive props & meadow botanicals |
| `src/scene/prototypes/willowLaneDiorama.ts` | Premium Handcrafted Storybook Diorama prototype (Willow Step Cottage with hideable roof/body/window assemblies + swinging door pivot, lane, foliage & Jun) |
| `src/scene/environmentRenderer.ts` | Dirty-flagged lighting, weather FX, season palettes, and prop sync (`EnvironmentVisualController`) |
| `src/scene/NeighborhoodCanvas.tsx` | Deferred (`React.lazy`) Three.js renderer, lighting cycle, movement, raycasting, animation loop |
| `src/components/*` | `TitleOverlay`, `VirtualJoystick`, `DialogueSheet`, `JournalDrawer`, `PauseModal` |
| `src/App.tsx` | Top-level game shell, HUD bar, keyboard shortcuts, lazy canvas mount, persistence wiring |
| `docs/art-direction/*` | Official **Premium Handcrafted Storybook Diorama** identity, standards, audit & roadmap |

---

## 7. Prototype Scope vs. Expandable Architecture

The current nine-resident cast (`RESIDENT_ORDER`) and Willow Lane & Fountain Square (`DEFAULT_REGION_ID = 'willow_square'`) represent a **controlled playable prototype slice**, not the final world size or resident cap. Core subsystems are structured to scale without architectural rewrites:
- **Dynamic Resident Registry**: Simulation loops, relationship initialization, migration sanitization, and UI counters iterate `RESIDENT_ORDER` / `RESIDENTS` rather than hardcoding a fixed population of 9, and concurrent social encounter caps scale proportionally (`Math.max(2, Math.floor(RESIDENT_ORDER.length / 4))`).
- **Sparse Pairwise Relations**: `createInitialNpcRelations()` seeds only non-neutral lore bonds while `getNpcRelation()` resolves neutral defaults lazily and `sanitizeNpcRelations()` preserves arbitrary interacted pairs—avoiding $O(N^2)$ save bloat as the cast expands.
- **Region-Aware World State**: `WorldState.regionId` and `REGIONS` in `src/game/worldMap.ts` establish region-scoped bounds and landmark lookups for future neighborhoods and districts.


