# 02 — NPC Life Simulation Blueprint (Milestone 2)

**Goal**: Evolve the 9 existing residents (`clara`, `arthur`, `mina`, `jun`, `barnaby`, `sora`, `toby`, `nora`, `pip`) from static 4-coordinate targets inside `NeighborhoodCanvas.tsx` into a **deterministic, pure-TypeScript life simulation** inside `src/game/` supporting pathfinding, autonomous daily routines, preferences, interruptible micro-activities, and NPC-to-NPC social interactions—with zero React or Three.js dependencies.

---

## 1. Current State & Target Architectural Boundary

- **Confirmed implementation**:
  - `src/game/residents.ts` defines static `schedule: Record<TimePhase, ScheduleSlot>` (`L33-448`) and a single reconciliation override in `getResidentScheduleSlot()` (`L466-492`).
  - `src/scene/NeighborhoodCanvas.tsx:633-663` and `L1046-1086` own transient `residentPositions`, `residentWalkPhase`, straight-line steering at `2.3 m/s`, and `resolveMovement(..., 0.38)` collision sliding.
- **Confirmed limitation**:
  - Continuous NPC state is invisible to `WorldState`, non-persistent across reloads, untestable in Node, lacks pathfinding around `pond_water` and buildings, and has no autonomous activity or social decision layer.
- **Potential risk**:
  - Expanding resident schedules with errands, rainy-day shelter, or spontaneous socializing while movement remains inside `NeighborhoodCanvas.tsx` will cause NPCs to snag on `BOX_OBSTACLES`/`CIRCLE_OBSTACLES`, desynchronize between `JournalDrawer` and 3D world positions, and block deterministic testing.
- **Proposed improvement**:
  - Move all NPC locomotion, pathfinding, activity scheduling, and social encounter selection into pure `src/game/` modules (`src/game/navigation.ts` and `src/game/npcSimulation.ts`), leaving `NeighborhoodCanvas.tsx` solely responsible for interpolating visuals and limb animation from `NpcRuntimeState`.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ src/game/ (Pure TypeScript, Deterministic, Node-Testable)               │
│                                                                         │
│  navigation.ts      ──▶ Static Lane Waypoint Graph + A* + Separation    │
│  npcSimulation.ts   ──▶ Daily Plan, Needs/Prefs, Social Pairs, Tick()   │
│  residents.ts       ──▶ 9 Resident Profiles, Trait Vectors, Base Slots  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ emits NpcRuntimeState (pos, facing, anim, intent)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ src/scene/NeighborhoodCanvas.tsx (Pure Visual Projection)               │
│  • Reads npcRuntime[id].pos, facing, animState, socialBubble            │
│  • Applies skeletal bob/stride/sit/tend/converse poses                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Deterministic Navigation & Collision Architecture (`src/game/navigation.ts`)

### 2.1 Waypoint Lane Graph + Local Steering
- **Confirmed implementation**: `worldMap.ts:97-142` validates points via `isPointWalkable()` against `WORLD_BOUNDS`, 7 `BOX_OBSTACLES`, and 5 `CIRCLE_OBSTACLES`, and slides locally via `resolveMovement()`.
- **Confirmed limitation**: Straight-line movement fails whenever an obstacle wider than one frame step lies between origin and goal (most critically `pond_water` spanning `x: -2.4..5.6, z: 11.4..16.6` and the central `fountain_basin`).
- **Potential risk**: NPCs transitioning between opposite corners of the map (e.g., `Copperwheel Yard (8.6, -7.5)` to `Mirror Pond Bank (-4.4, 13.8)`) or reacting to dynamic errands will stall against cottage corners.
- **Proposed improvement**:
  - Define a compact **22–28 node Lane Waypoint Graph** (`NAV_NODES`, `NAV_EDGES`) pre-aligned to the existing cobblestone walkways (`NeighborhoodCanvas.tsx:222-227`), bridge deck (`(-2.9, 14.0)`), and landmark porches:
    - All nodes and edge midpoints validated in `node:test` via `isPointWalkable(x, z, 0.42)`.
    - Helper `computeWaypointPath(from: Vec2, to: Vec2, actorRadius = 0.38): Vec2[]`:
      1. Fast path: if `hasLineOfSight(from, to, actorRadius)` (ray-march every `0.45 m`) succeeds, return `[to]` directly—zero overhead for local moves.
      2. Otherwise, snap `from` and `to` to nearest LOS-visible `NAV_NODES`, run deterministic A* (< 30 nodes, sub-10 µs), prune collinear/LOS-skippable nodes, and append `[to]`.
  - **Actor-to-Actor Soft Separation**:
    - During each simulation step (`dt`), compute a soft repulsion vector between residents within `1.05 m` (excluding paired conversationalists who intentionally stand `1.15–1.4 m` apart facing each other) and pass the combined desired step through `resolveMovement(pos, desired, 0.38)`.
  - **Stuck-Recovery Guard**:
    - Track `stuckSeconds` per resident when moving toward a waypoint and `actualDisplacement < 0.15 * expectedStep`. If `stuckSeconds > 1.2`, recompute path via nearest open `NAV_NODE` (never teleporting visibly unless `stuckSeconds > 4.0` while offscreen or transitioning across day rest).

---

## 3. Resident Personality, Preferences & Needs Model

- **Confirmed implementation**: `ResidentDefinition` (`src/game/types.ts:53-62`) stores string `personality` and `favoriteThing` only for UI prose.
- **Confirmed limitation**: The simulation has no structured representation of what makes Clara seek busy bakery tables while Arthur seeks quiet workshop repairs or Toby lingers by Mirror Pond during mist.
- **Potential risk**: Arbitrary RNG activity picking would make characters feel out-of-character (e.g., Arthur loitering noisily at Pip's chalk spot).
- **Proposed improvement**: Add structured `ResidentTraits` and lightweight `ResidentDailyState` in `src/game/types.ts` / `residents.ts`:

```ts
export interface ResidentTraits {
  sociability: number;     // 0.0 (Arthur/Toby) .. 1.0 (Pip/Jun)
  outdoorsiness: number;   // Preference for open plaza/pond vs porches/indoors
  morningLark: number;     // Early energy peak vs dusk energy peak
  curiosity: number;       // Draws toward noticeboard, fountain, gazebo events
  preferredZones: string[]; // LandmarkZone IDs ('bakery', 'pond', 'gazebo', etc.)
  rainBehavior: 'shelter_home' | 'visit_cafe' | 'umbrella_stroll';
}

export type NpcAnimationState =
  | 'idle'
  | 'walk'
  | 'work'       // Baking, planing wood, misting pots, tinkering
  | 'sketch_read'// Toby sketching, Nora reading
  | 'music'      // Sora violin/humming
  | 'converse'   // Facing social partner with subtle gesture bob
  | 'admire';    // Inspecting bloomed planters, fountain, or restored bell
```

- **Cozy "Soft Needs" (Non-Punitive)**:
  - Keep a tiny normalized state (`socialAppetite: 0..1`, `restNeed: 0..1`) purely to pace transitions between solitary work (`work`/`sketch_read`) and plaza socializing (`converse`/`admire`). Never introduce stressful hunger/energy failure states (preserving `GAME_DESIGN.md` §1).

---

## 4. Deterministic Activity Utility & Decision Loop (`src/game/npcSimulation.ts`)

### 4.1 Seeded Determinism Driven Strictly by In-Game Time
- **Constraint Check**: All progression must remain driven by in-game time (`day`, `minuteOfDay`, `phase`), never real-world `Date.now()` or calendar time.
- **Proposed improvement**:
  - Add `simSeed: number` (default deterministic constant e.g. `18042` on `createFreshWorldState()`) and a pure `mulberry32(seed)` PRNG helper in `src/game/rng.ts`.
  - Derive per-resident, per-block seeds via `hashSeed(world.simSeed, world.day, blockIndex, residentIndex)`. Replaying the same day and player actions produces the **exact same** micro-activity picks and social pairings, making simulation behavior 100% unit-testable.

### 4.2 Activity Candidate Pool & Scoring
Each `TimePhase` (`morning`, `afternoon`, `golden`, `dusk`) retains each resident's signature **anchor `ScheduleSlot`** from `residents.ts` as baseline, supplemented by an `ActivityCandidate[]` pool:
1. **Anchor Routine** (baseline score `1.0`, guaranteed valid fallback—preserves every Milestone 1 schedule location and *The Silent Gazebo Bell* quest availability).
2. **Weather-Adapted Alternate** (e.g., during `light_rain`, Sora moves under Hearth & Crumb awning or Book Nook porch; Toby sketches under Gazebo roof; Barnaby stays in Pinecone Woodshop).
3. **Environmental Attraction** (unlocked dynamically: e.g., when `fountainFlowing === true`, Mina/Pip/Sora score higher to visit the fountain; when `bakeryTablesOpen === true`, Jun/Nora/Mina occasionally stop by Clara's café tables; when `bellGleaming === true`, residents gather near the Gazebo around `minuteOfDay` `1065–1095` at Golden Hour).
4. **Spontaneous Micro-Activity** (e.g., reading the Noticeboard, admiring bloomed cottage window boxes, checking Mirror Pond carp).

- **Re-evaluation cadence**: Decisions evaluate only on:
  - Phase boundary crossings,
  - Weather changes,
  - Story flag unlocks (e.g., `claraArthurReconciled` immediately re-evaluates Clara & Arthur during `golden`),
  - Or completion of a current activity dwell timer (`activityUntilMinute`, typically `35–75` in-game minutes).
  - Never re-roll every frame—eliminates oscillating/indecisive NPC jitter.

---

## 5. NPC-to-NPC Social Interactions (`SocialEncounter`)

- **Confirmed implementation**: Only Clara and Arthur have a post-reconciliation co-location check (`residents.ts:473-490`), with zero active interaction or speech feedback.
- **Confirmed limitation**: Residents standing two meters apart ignore each other completely.
- **Potential risk**: Uncoordinated social pairs could pull critical quest NPCs far away from players or collide with walkways.
- **Proposed improvement**:
  - Define an explicit `SocialEncounter` sub-state inside `NpcSimulationState`:
    ```ts
    export interface ActiveSocialEncounter {
      id: string;
      participants: [ResidentId, ResidentId];
      topicTag: string;          // e.g. 'tea_chat', 'sourdough_delivery', 'bell_memories'
      meetingPoint: Vec2;
      startedMinute: number;
      endsMinute: number;
      ambientLines: [string, string]; // Short 1-line clay storybook snippets
    }
    ```
  - **Eligibility rules**:
    1. Both residents are in the same or adjacent `LandmarkZone` (`distance < 7.5 m`), not currently in dialogue with the player, and off personal social cooldown (`>= 90` in-game minutes since last encounter).
    2. NPC-to-NPC `affinity` (from the new Relationship Matrix, Blueprint 03) is `>= -1` (e.g., Clara & Arthur will NOT autonomously socialize until `claraArthurReconciled === true` or a Story Beat pairs them, preserving the narrative arc!).
    3. Meeting point uses a nearby walkable offset (`1.25 m` apart) validated with `isPointWalkable(..., 0.38)` so corridors stay unblocked.
  - **Effects**:
    - Both NPCs orient toward each other (`converse` state for ~`15–22` in-game minutes), show gentle floating storybook mood icons/speech chips when within camera frustum, increment their bilateral `NpcRelationEdge.affinity` / `familiarity`, and record a lightweight `WorldEvent` (e.g., `"Clara & Mina chatted about lavender loaves"`) usable by Dialogue (Blueprint 03) and Journal rumors!
  - **Player Interruptibility**:
    - If the player walks within `2.9 m` and initiates Talk with either participant, the encounter pauses/closes gracefully while the NPC turns toward the player (`NeighborhoodCanvas.tsx:1071-1075` already implements player turn-to-face!).

---

## 6. Headless State Contract (`NpcRuntimeState`) & `JournalDrawer` Sync

- **Proposed `NpcRuntimeState`** (stored in `WorldState.npcRuntime` so saves restore exact positions/activities):
  ```ts
  export interface NpcRuntimeState {
    position: Vec2;
    facing: number;
    currentActivityId: string;
    currentPlaceName: string;
    currentActivityLabel: string;
    animState: NpcAnimationState;
    waypoints: Vec2[];
    activityUntilMinute: number;
    socialPartnerId: ResidentId | null;
    socialCooldownUntilMinute: number;
  }
  ```
- **Architectural consequence**:
  - `JournalDrawer.tsx:188` (`Now: {slot.placeName} — {slot.activity}`) reads `world.npcRuntime[id].currentPlaceName` and `currentActivityLabel` instead of assuming the NPC is already at the static `getResidentScheduleSlot()` destination.
  - `NeighborhoodCanvas.tsx` drops `residentPositions` closure state and runs `stepNpcSimulation(worldRef.current, simDeltaMinutes)` inside `tick()` (or calls a pure `stepWorldSimulation(world, simInput, dt)`), keeping `src/game/` as the single source of truth for all 9 residents.
