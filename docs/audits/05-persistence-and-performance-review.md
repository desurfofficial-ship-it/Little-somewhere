# 05 — Persistence, Performance & Testing Review (Milestone 2)

**Goal**: Establish a zero-data-loss **versioned save-schema migration strategy**, identify **Three.js + React + Software-WebGL performance budgets** as NPC autonomy and weather grow, and define a **comprehensive deterministic test strategy** in Node (`node:test`).

---

## 1. Persistence Architecture & Versioned Migration Strategy

### 1.1 Current Persistence Audit (`src/game/storage.ts`)
- **Confirmed implementation**:
  - `STORAGE_KEY = 'little_somewhere_world_v1'` (`storage.ts:6`).
  - `loadWorldState()` (`L31-52`) reads JSON, checks `typeof parsed.day === 'number' && parsed.residents && parsed.flags`, and shallow-merges `fresh` with `parsed`, `residents: { ...fresh.residents, ...parsed.residents }`, and `flags: { ...fresh.flags, ...parsed.flags }`.
  - `App.tsx:97` saves on every `commitWorld()`, plus a `5000 ms` `setInterval` (`L278-285`) during `'playing'`.
- **Confirmed limitations**:
  1. **No `schemaVersion` discriminator**: Cannot distinguish legacy Milestone 1 saves from future schemas cleanly.
  2. **Shallow per-resident merge bug (`storage.ts:44`)**: `{ ...fresh.residents, ...parsed.residents }` replaces each `ResidentProgress` object wholesale with the stored v1 object. Any new nested property added inside `ResidentProgress` (or a new sibling map like `npcRuntime` / `relations`) risks `undefined` property crashes unless explicitly hydrated per entry.
  3. **No field-level validation/sanitization**: Out-of-bounds `minuteOfDay`, `NaN` coordinates, missing resident keys, or non-walkable saved `playerPos` (e.g., if obstacle geometry ever shifts slightly) pass straight into runtime state.
  4. **Silent error swallowing (`L49, L57`)**: No backup copy or structured persistence status return value.
- **Potential risk**:
  - Returning players with existing `little_somewhere_world_v1` data in `localStorage` will experience broken NPC states or erased progress during Milestone 2 upgrades if migration is ad hoc.
- **Proposed improvement — Versioned Migration Pipeline (`src/game/migrations.ts`)**:
  - **Storage Key Policy**: Keep reading `'little_somewhere_world_v1'` seamlessly (either continuing to write to `'little_somewhere_world_v1'` with `schemaVersion: 2`, or migrating `'little_somewhere_world_v1'` -> `'little_somewhere_world_v2'` while retaining read-fallback from `v1` and writing a rolling `'little_somewhere_world_backup_v1'` snapshot on successful load before upgrade). Keeping `'little_somewhere_world_v1'` as primary read source with `schemaVersion: 2` ensures zero surprise resets.
  - **Explicit Version Pipeline**:
    ```ts
    export const CURRENT_SCHEMA_VERSION = 2;

    export interface MigrationResult {
      state: WorldState;
      migratedFromVersion: number | null;
      warnings: string[];
    }
    ```
    1. **Detect Version**: Missing `schemaVersion` + valid `day/residents/flags` => `version = 1`.
    2. **Sequential Pure Upgraders (`migrateV1ToV2(v1Raw)`)**:
       - Copies all v1 fields (`day`, `minuteOfDay`, `playerPos`, `playerFacing`, `flags`, `memories`, `mailboxUnread`, `dailyLettersRead`, `bellRungCount`).
       - Hydrates `playerRelations` from v1 `residents[id].trust` (`affinity = trust * 20`, preserving exact heart counts!), `met`, `talkedToday`, and `mood`.
       - Initializes `npcRelations` using Milestone 1 flags (`claraArthurReconciled` immediately sets `arthur:clara` to reconciled affinity `55`, tension `5`!).
       - Initializes `npcRuntime[id]` to the phase-accurate walkable `ScheduleSlot` (and validates `isPointWalkable()`, snapping to nearest `NAV_NODE` if invalid).
       - Sets `weather` (`'sunlit'` for Day 1 or deterministic forecast for `day`) and `season` (`getSeasonForDay(day)`).
       - Seeds `topicHistory` softly from existing `memories` (so players who already solved *The Silent Gazebo Bell* don't re-hear resolved intro lines).
    3. **Post-Migration Sanitizer (`sanitizeWorldState(state)`)**:
       - Clamps `day >= 1`, `minuteOfDay` within `[360, 1290]`, `trust` `[0..5]`, `affinity` `[0..100]`, checks `isPointWalkable(playerPos.x, playerPos.z)` (falling back to `PLAYER_SPAWN` if stuck).
    4. **Atomic Backup & Save Throttling**:
       - Before writing a migrated `v2` payload, copy raw `v1` JSON to `little_somewhere_world_v1_backup`.
       - Keep `saveWorldState` non-throwing, returning `{ ok: boolean; error?: string }`, and save on `visibilitychange` / `pagehide` in addition to `commitWorld` + 5s interval (eliminating unnecessary JSON.stringify writes when `worldRef.current` revision hasn't changed!).

---

## 2. Performance & Software-WebGL Review (`src/scene/` & `src/App.tsx`)

### 2.1 Confirmed Implementation vs Emerging Bottlenecks
- **Confirmed implementation**:
  - `NeighborhoodCanvas.tsx` uses a single `useEffect(..., [])` mount (`L112-1204`), reusable module-scope scratch objects (`L65-79`), `InstancedMesh` for 46 trees (`L250-279`), pooled chime particles (`L603-612`), throttled HUD sync (`0.18s`, `L1155-1166`), and `isSoftwareGl` (`afterDraw`, `L811-826`).
- **Confirmed limitations & Risks as Milestone 2 Scales**:
  1. **Per-frame redundant scene traversal (`NeighborhoodCanvas.tsx:828-876, 928-931`)**: `updateEnvironmentVisuals()` and `windowMaterials` loop run at 60 Hz even when zero flags or phases changed.
     - *Consequence*: Unnecessary CPU overhead and material state churn once seasonal palettes, NPC props, and weather meshes are added.
  2. **Per-object `MeshStandardMaterial` duplication (`src/scene/models.ts:19-21`)**: Every building part and character limb calls `new THREE.MeshStandardMaterial(...)`.
     - *Consequence*: Increases shader uniform switches (`~80+` unique materials across 6 buildings, gazebo, fountain, and 10 characters). Sharing palette materials via a `Map<string, MeshStandardMaterial>` cuts material switches by >60%.
  3. **React HUD churn (`NeighborhoodCanvas.tsx:1160-1165` & `App.tsx:287-299`)**: `onHudSync` passes a newly allocated `{ ...world.playerPos }` every `0.18s`, triggering React re-renders of `<App>` (including `getLandmarkAt`) ~5.5 times/sec even when the player stands still and the formatted minute (`"8:15 AM"`) hasn't changed.
     - *Consequence*: Minor mobile GC pressure that worsens if `App.tsx` also passes weather/social feed props downward.
  4. **Deprecated `THREE.Clock` (`NeighborhoodCanvas.tsx:795`)**: Emits console warning in `three@0.187.0`; migrating to `THREE.Timer` (with `timer.update()`) cleans console output.
  5. **Bell swing `dt` bug (`NeighborhoodCanvas.tsx:866`)**: Hardcoded `0.016` makes bell physics FPS-dependent (slow on 10 FPS software WebGL, too fast on 120 Hz ProMotion displays!).
  6. **Software WebGL (`isSoftwareGl`) headroom**: Under SwiftShader (`~8–10 FPS` via `afterDraw` `80 ms` pacing), every extra transparent overlay pass (rain streaks, puddles, speech bubbles) costs real rasterization time.
- **Proposed performance budgets for Milestone 2**:
  - **Draw calls**: Keep total scene draw calls `<= 140` (use `InstancedMesh` for rain streaks `<= 48`, breeze petals `<= 24`, seasonal flowers, and café clutter).
  - **HTML/CSS overlays over WebGL**: Zero `backdrop-filter` / `backdrop-blur` (strictly preserve `AGENTS.md` §2.3); render ambient NPC-to-NPC speech indicators either via lightweight pooled 3D sprite badges OR throttled (`<= 4 Hz`) projected CSS pills capped to `max 2` visible bubbles within `14 m` of player.
  - **HUD Sync Edge-Gating**: Only call `onHudSync` when `formatClock(minuteOfDay)` changes, `Math.hypot(playerPos - lastSyncedPos) > 0.15`, `nearestKey` changes, or `weather` changes.
  - **5s Auto-Save Dirty Check**: Track `worldRevision` integer so the 5s `setInterval` skips `JSON.stringify` + `localStorage.setItem` when the player is idle/stationary.

---

## 3. Testing Strategy Evaluation (`src/game/*.test.ts`)

### 3.1 Current Coverage vs Milestone 2 Required Test Matrix
- **Confirmed implementation**: `src/game/engine.test.ts` contains 5 tests (`141` lines) checking spawn, basic obstacle slide, 9×4 `reconciled=false` schedule walkability, time phase formatting, and 1 happy-path bell completion.
- **Confirmed limitations**:
  - `reconciled = true` Golden Hour slots untested.
  - `storage.ts` has 0% coverage.
  - Alternate narrative routes (Nora/Jun postcard, Sora tea, Clara `shared_baking` / `gentle_truth`, Mailbox/Noticeboard states) untested.
  - No headless simulation loop tests, navigation tests, relationship cap tests, or weather/season tests exist.

### 3.2 Recommended Deterministic Test Suite Layout (`tsx --test src/game/*.test.ts`)

| Test Module | Mandatory Deterministic Assertions |
| :--- | :--- |
| `worldMap.test.ts` | Bounds clamping, all `BOX_OBSTACLES` & `CIRCLE_OBSTACLES`, `NAV_NODES` + `NAV_EDGES` walkability (`0.42` radius), A* pathfinding across Mirror Pond bridge, zero straight-line snagging between every pair of resident schedule slots. |
| `simulation.test.ts` | Stepping `stepNeighborhoodSimulation()` for a full 15-hour game day (`360..1260`) produces identical `NpcRuntimeState` across two runs with same `simSeed`; verifies Clara & Arthur converge on Gazebo Steps at Golden Hour only after reconciliation; verifies social encounters trigger and respect cooldowns. |
| `relationships.test.ts` | `playerRelations` affinity clamping (`0..100`), heart mapping (`0..5`), daily small-talk affinity cap prevents Day 1 trust farming, `npcRelations` symmetry (`arthur:clara` === `clara:arthur`), mood expiry across phases/days. |
| `dialogue.test.ts` | Every topic's `nextNodeId` resolves cleanly; verifies *all* Milestone 1 branches (Pip -> Barnaby -> Oak -> Mina -> Arthur; Nora -> Jun -> Arthur; Sora -> Arthur; Clara `shared_baking` & `gentle_truth`); verifies `nora_read_together` memory parity; verifies `toby_clapper` & quest cue parity; verifies repeatable topic cooldowns & daily fallback variation. |
| `environment.test.ts` | Day 1 always `'sunlit'`; deterministic multi-day weather forecast & `misty_morning` lift by `10:30 AM`; 4-season rollover every `DAYS_PER_SEASON`; composition of player-driven flags + NPC-driven flyers/baskets/blooms into `ComposedEnvironmentState` revision increments. |
| `storage.test.ts` | Clean fresh world creation; round-trip serialization; `migrateV1ToV2` on real Milestone 1 JSON payloads (verifying trust, memories, flags, reconciled `npcRelations`, and missing-field hydration); corrupt JSON recovery; out-of-bounds coordinate sanitization. |
