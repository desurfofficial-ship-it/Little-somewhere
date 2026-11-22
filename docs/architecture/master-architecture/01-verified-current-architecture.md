# 01 — Verified Current Architecture

**Recorded:** 2026-11-22, atop `origin/main` @ `a80a220`.
**Method:** consolidated from six parallel specialist investigations (Tasks 1-a..1-f, evidence in doc 09). Every claim is cited to `file:line` against the actual `main` tree, not to stale documentation.

---

## 1. Stack and baseline

| Property | Value | Evidence |
| :--- | :--- | :--- |
| Framework | Vite 8 + React 19 + TypeScript 7 (`target: ES2022`, `moduleResolution: bundler`) | `package.json`, `tsconfig.json` |
| 3D / rendering | Three.js 0.187 + `@types/three` | `package.json` |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`) | `vite.config.ts` |
| Audio | Web Audio API (procedural, zero external assets) | `src/game/audio.ts` |
| AI integration | `@google/genai` declared but **imported nowhere in runtime code** (phantom dependency — doc 08 §6) | grep over `src/`+`scripts/`+`skills/` |
| Persistence | `localStorage` key `little_somewhere_world_v1` | `src/game/storage.ts:38` |
| Deploy | GitHub Pages project site, `peaceiris/actions-gh-pages@v4`, `force_orphan: true`, **build-only, main-only, no tests** | `.github/workflows/deploy-pages.yml` |
| Baseline | **528/528 tests pass, `tsc --noEmit` clean, build green** | post-merge verification, `docs/architecture/systemic-reliability-integration/07-final-integration-audit.md` |
| Schema | `WorldState` **v11** (`CURRENT_SCHEMA_VERSION = 11`) | `src/game/migrations.ts:137` |
| Source size | 161 files (147 `.ts` + 13 `.tsx` + 1 `.css`); ~45,000 production LOC | `find src -type f` |

---

## 2. Three-layer structure — verified at file-system level

The documented three-layer boundary (`AGENTS.md` §2) **holds**, with **two real violations** (doc 02 W5, W6).

| Layer | Root | Production files | LOC | Imports `three`/React? | Browser globals? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Game engine | `src/game/` | 47 | ~17,900 | **No** (zero `import ... from 'three'`/`'react'` in any `src/game/*`) | `storage.ts` (sanctioned `window.localStorage`), `audio.ts` (sanctioned `AudioContext`), **`journal.ts` (unsanctioned `window.localStorage`)**, `audio.ts` (timer APIs outside guard scope) |
| Scene renderer | `src/scene/` | 43 (29 + 14 builders) | ~22,100 | Yes (expected) | Expected |
| HUD / shell | `src/components/` + `App.tsx` | 14 | ~5,100 | Yes (expected) | Expected |

**Dependency direction is strictly one-way and acyclic:**
- `src/components/` + `App.tsx` → `src/scene/` → `src/game/` (consumption direction).
- `src/game/` → `src/scene/`: **0 imports** (verified).
- `src/scene/` → `src/game/`: extensive, read-only.
- `src/components/` → `three`: **0 direct imports** (only string-literal matches).
- `src/components/` → `src/scene/`: **0 imports**; the sole Three.js entry point is `NeighborhoodCanvas.tsx`, instantiated once by `App.tsx:105` (the composition root).

**`src/game/` is a clean DAG** — Tarjan SCC over 159 nodes / 764 import edges yields **159 single-node SCCs, 0 multi-node, 0 self-loops**. Zero circular dependencies. This is the codebase's strongest structural property (doc 05).

---

## 3. Module inventory (condensed — full table in doc 09 §1)

### `src/game/` — pure engine (47 files)

| Domain | Modules | Headline responsibility |
| :--- | :--- | :--- |
| **Contract** | `types.ts` (1012 LOC) | All domain interfaces incl. `WorldState` v11. **105 importers; zero re-exports elsewhere — the canonical shared contract.** |
| **Persistence** | `migrations.ts` (2487), `storage.ts` (671) | v1→v11 linear chain + `sanitizeWorldState` whitelist + `createDefaultWorldState`; localStorage save/load/backup/revision-hash + `advanceToNextDay`. |
| **Reducers** | `actions.ts` (4035) | 47 exported pure reducers (dialogue, gifting, props, all 5 interiors, next-day). **Leaf sink** — only 2 production importers (`App.tsx`, `DialogueSheet.tsx` for one interface). |
| **Simulation** | `simulation.ts` (1121), `memories.ts` (997), `relationships.ts` (500), `residents.ts` (1224) | `stepSimulationInPlace` (needs/emotions/schedules/encounters/gossip), bounded NPC memories, player↔NPC & NPC↔NPC tiers, 10 founding residents. |
| **Narrative** | `storylines.ts` (833), `journal.ts` (1237), `dialogueEngine.ts` (1048), `narrative.ts` (419), `progressionVisuals.ts` (474) | Multi-stage storylines, player Pocket Journal projection, declarative dialogue selector, quest cues + `computeEnvironmentState`, derived visual flags. |
| **World** | `worldMap.ts` (568), `navigation.ts` (380), `walkability.ts` (122), `playerController.ts` (674) | Bounds/obstacles/33-node A* graph/landmarks, LOS smoothing, cross-interior seat resolver, locomotion/bench/prop-targeting. |
| **Interiors** | `cottage.ts`, `greenhouse.ts`, `bakery.ts`, `bookNook.ts`, `copperwheel.ts` (371–456 each) | Per-interior bounds/stations/day-cycle registries. |
| **Items** | `inventory.ts` (568) | 21 items, hearth recipes, gift prefs, keepsakes. |
| **LR subsystem** | `invitations.ts` (439), `occupancy.ts` (86), `activities.ts` (336) | LR-1 invitation lifecycle, LR-2 indoor occupant slots, shared-activity registry. |
| **Environment** | `environment.ts` (298), `exploration.ts` (140) | 5-layer composed environment; Build-10 exploration discovery registry. |
| **Core** | `time.ts` (51), `rng.ts` (41) | Clock 360–1290, 10-day seasons, FNV/Mulberry PRNG. |
| **Audio** | `audio.ts` (472) | Web Audio SFX (sanctioned guard). |
| **Dialogue content** | `dialogue/index.ts` (64) + 20 leaf modules across `quest/`, `personal/`, `events/`, `interiors/`, `everyday/`, `invitations/` | `DIALOGUE_TOPICS` aggregator (23 module spreads); leaf modules import nothing upstream. |

### `src/scene/` — Three.js renderer (43 files)

| Module | LOC | Responsibility |
| :--- | :--- | :--- |
| `NeighborhoodCanvas.tsx` | 2750 | **God renderer**: single `useEffect(..., [])` mount, scene assembly, input/raycast, animation loop `tick()`, HUD sync. Fan-out **39** (highest in repo). |
| `environmentRenderer.ts` | 869 | `EnvironmentVisualController` dirty-flagged prop/lighting/weather/season sync. |
| `progressionPresentation.ts` | 755 | Visual progression rigs (book stacks, posy, honey dipper). |
| `textures.ts` / `materials.ts` | 714 / 274 | Procedural CanvasTextures + shared `MaterialPalette` cache (instance-scoped — good design). |
| `waterShaders.ts`, `models.ts` | 333 / 123 | Mirror Pond/fountain shaders; rig type contracts (`GazeboRig`, `FountainRig`, `CharacterRig`, …). |
| `perfProbe.ts`, `contactShadows.ts`, `ambientSway.ts`, `residentFeel.ts` | 253/238/133/187 | Renderer utilities. |
| `builders/buildings.ts` | 2075 | 5 exterior storybook buildings + bakery café tables. |
| `builders/cottageInterior.ts` | 2044 | Player's cottage cutaway + 7 stations + mementos + season dressing. |
| `builders/characters.ts` | 1780 | 10 residents + player rigs, winter tint, animation. **~50–80 loose meshes per rig (perf risk — doc 02 W9).** |
| `builders/{copperwheel,greenhouse,bakery,bookNook}Interior.ts` | 1194/1185/1295/1143 | Per-interior cutaway dioramas. |
| `builders/landmarks.ts` | 1165 | Gazebo, fountain, mirror pond, bridge, hollow oak, tea cart. |
| `builders/{orchard,orchardMicroLife,wilds,vegetation,botanicalDressing,reactiveProps,porchSeasonLife,interiorKit}.ts` | 66–840 each | Scene dressing & reactive rigs. |
| `prototypes/willowLaneDiorama.ts` | 1722 | **Production code misfiled under `prototypes/`** — actively imported by `NeighborhoodCanvas.tsx:110-114` for the player cottage/mailbox/courtyard. |

### `src/components/` + `App.tsx` (14 files)

| Module | LOC | Responsibility |
| :--- | :--- | :--- |
| `App.tsx` | 1546 | Game shell, HUD, **18 `handle*` action dispatchers**, keyboard shortcuts, autosave, `commitWorld`. |
| `components/DialogueVisuals.tsx` | 1267 | Portrait + subject-illustration resolution. |
| `components/JournalDrawer.tsx` | 929 | Pocket Journal UI. |
| `components/DialogueSheet.tsx` | 536 | Dialogue choice sheet (imports `PropInteractionResult` type from `actions.ts:162`). |
| `components/{CottageStationModal,GreenhousePanel,InventoryDrawer,icons,TitleOverlay,PauseModal,VirtualJoystick}.tsx` | 73–422 | Shell chrome & station panels. |

---

## 4. Boot sequence (ordered)

1. `index.html:21-24` — `<body data-state="title">`, loads `/src/main.tsx`.
2. `src/main.tsx:1-5` — `createRoot(...).render(<App />)`.
3. `App.tsx:162` `App()` mounts. During render, **synchronous state-slot initializers**:
   - `App.tsx:167` `[initialLoaded] = useState(() => loadWorldState())` → `storage.ts:77` → `deserializeWorldState` → `migrations.ts:2412 migrateWorldState` (full v1→v11 chain) → `sanitizeWorldState`. **Migration-on-load gate runs before `worldRef` exists, before `<NeighborhoodCanvas>` mounts, before any tick.** No tick can fire on an un-migrated state.
   - `App.tsx:168` `[initialComposed] = useState(() => composeEnvironmentState(initialLoaded))` (pure).
   - `App.tsx:169` `worldRef = useRef<WorldState>(initialLoaded)`.
4. `App.tsx:1213-1232` — React renders `<main>` → `<SceneErrorBoundary>` → `<NeighborhoodCanvas .../>`. **No sim tick yet.**
5. `NeighborhoodCanvas.tsx:377` `useEffect(() => {...}, [])` runs **once after first paint**:
   - `471-499` WebGLRenderer + Scene + PMREM RoomEnvironment.
   - `1128-1168` player + 9 resident rigs built.
   - Scene assembly through builders (`~1200-1680`).
   - `2672` `syncVisualAndHud(worldRef.current, 0, 0)` — **Frame-0 env+HUD sync, no sim step.**
   - `2674-2680` first `renderer.render`, then `frameId = requestAnimationFrame(tick)`.
6. **First sim tick** on next rAF: `NeighborhoodCanvas.tsx:2193 tick()` → `2243 stepSimulationInPlace(worldRef.current, dt, {...})`.
7. **First HUD snapshot** to React via `onHudSyncRef.current({...})` at `NeighborhoodCanvas.tsx:2178`, edge-triggered first call (`2153`) or throttled `hudSyncAccum >= 0.18` (`2164`) ≈ **5.5 Hz**.

---

## 5. Per-frame update order (`tick()`, `NeighborhoodCanvas.tsx:2193-2668`)

| # | Stage | file:line |
| :--- | :--- | :--- |
| 1 | `timer.update()` → raw dt; clamp `dt = Math.min(rawDt, 0.05)` | `2195-2199` |
| 2 | Edge-triggered winter-knit retint on season change | `2206-2223` |
| 3 | Edge-triggered bell/fountain/pond effect bursts | `2225-2240` |
| 4 | **`stepSimulationInPlace(world, dt, opts)`** — clock, needs, emotions, NPC steering, encounters, gossip, exploration | `2243-2247` |
| 5 | Player-action pulse edge detection | `2250-2274` |
| 6 | Phase transition edge marker | `2276-2279` |
| 7 | **Player input sampling** (keys, joystick, tap-walk) | `2281-2370` |
| 8 | Location-change snap | `2373-2391` |
| 9 | **`stepPlayerMovement({...})`** → in-place `world.playerPos/playerFacing/playerPosture/playerSeatId` | `2403-2424` |
| 10 | Footstep/dust poofs + squash envelope | `2441-2481` |
| 11 | Player facing lock toward speaker/prop | `2497-2554` |
| 12 | Player rig animation (`animateCharacterRig`) | `2556-2584` |
| 13 | **`syncVisualAndHud(world, elapsed, dt)`** — envController.update, interior/exterior vis, resident rigs, nearest-target, throttled HUD sync | `2587` → `1756-2191` |
| 14 | Camera choreography (title orbit / interior / exterior follow) | `2589-2652` |
| 15 | `renderer.render(scene, camera)` | `2654` |
| 16 | Perf probe sample/overlay | `2657-2662` |
| 17 | Schedule next: `afterDraw(tick)` (SwiftShader) or `requestAnimationFrame(tick)` | `2664-2668` |

**App.tsx has no per-frame work** — no rAF/interval except the 5 s autosave (`App.tsx:1121-1125`) and `visibilitychange`/`pagehide` flushes, gated on `screenState === 'playing'`.

---

## 6. `commitWorld()` — the atomic React-side funnel

**Definition:** `App.tsx:272-284` — a single `useCallback` that synchronously swaps `worldRef.current`, calls `setWorldSnapshot` + 7 HUD setters, updates the dirty stamp, and calls `saveWorldState(next)` (synchronous `localStorage.setItem`). **Atomic within the React layer; no reentrancy, no await.**

**Intent dispatch topology — single funnel.** All user intents route through `App.tsx` callbacks → reducers in `actions.ts` → `commitWorld`. No component imports `saveWorldState` or assigns `worldRef.current =` directly. Entry points: keyboard (`App.tsx:1000-1108`), click nearest-target (`:1415`), dialogue choice (`:636-661`), gift (`:663-689`), cottage station (`:691-738`), greenhouse station (`:741-796`), prop action (`:798-978`), +2h advance (`:984`), reset (`:295-324` — **the one outlier: reimplements the setter sequence inline instead of calling `commitWorld(fresh)`; drift risk**, doc 02 W4).

**Autonomous sim mutations are NOT atomic.** `stepSimulationInPlace` and `stepPlayerMovement` mutate `worldRef.current` in place ~60×/sec without calling `commitWorld`. These in-place writes (`npcRuntime`, `activeEncounters`, `worldEvents`, `npcActivityHistory`, `npcMemories`, `npcRelations`, `occupancy`, `activeActivity`, `playerPos/facing/posture`, exploration `sideFlags`/`memories`) are persisted **only** by the 5 s autosave + `pagehide` flush. `commitWorld` is the funnel for *user-intent* mutations only; the sim/locomotion paths are intentionally zero-GC in-place writes coordinated via `worldRef`. **This is documented and by-design**, but means React `worldSnapshot` is always up to ~166 ms behind the canvas (`hudSyncAccum >= 0.18` throttle).

---

## 7. Determinism verdict — verified pure

`stepSimulationInPlace` is **pure deterministic given `(world, dt, options)`**:
- **No `Math.random()`** in `src/game/simulation.ts` (grep: zero matches). Only PRNG is `mulberry32(hashSeed(world.simSeed, world.day, socialSlot, a, b))` (`simulation.ts:924`).
- **No `Date.now()`/`new Date()`/`performance.now()`** in any `src/game/` module. The only `Date.now()` in the scene layer is `NeighborhoodCanvas.tsx:1737` (afterDraw fence-wait stall guard, not sim).
- `Math.random()` exists only in `src/game/audio.ts` (sound synthesis, isolated from state) and `NeighborhoodCanvas.tsx:1101-1106` (visual dust jitter, never touches `worldRef`).
- All collections in the sim hot path are arrays (`RESIDENT_ORDER`) or plain objects; no `Map`/`Set` iteration in the sim path.
- `composeEnvironmentState` (`environment.ts:134`) is pure; `rollWeatherForDay` uses `mulberry32(hashSeed(simSeed, day, 'weather_v1'))`.

**Save replay determinism:** `serializeWorldState` runs `sanitizeWorldState`, which reconstructs the object with a **fixed key order** (`migrations.ts:1482-1529` literal). Tests `storage.test.ts:137-143` and `save-integrity.test.ts:137-153` assert `serialize(deserialize(serialize(x))) === serialize(x)` across three cycles — byte-identical fixed point. The "twin continuity byte-identical" claim holds.

**dt clamp:** `simulation.ts:611` `dt = Math.max(0, Math.min(dtSeconds, 0.25))`; scene-side clamp tighter at 50 ms (`NeighborhoodCanvas.tsx:2197`). Clock never auto-rolls day (`time.ts:32-34` clamps at `DAY_END_MINUTE = 1290`); only `performNextDayRest` → `advanceToNextDay` advances the day.

---

## 8. Scene lifecycle / disposal — comprehensive

`NeighborhoodCanvas.tsx:2685-2740` disposes: `perfProbe`, window globals, `cancelAnimationFrame` + `clearTimeout` (covers afterDraw path), `resizeObs`, all event listeners, `envController.dispose()`, `progressionRigs.dispose()`, `staticContactShadows.dispose()`, all 5 interior rig `.dispose()`, all dressing rigs, all textures/materials, `palette.disposeAll()` (`materials.ts:226-230`), `timer.dispose()`, `renderer.dispose()` (final GPU dealloc), `container.removeChild`. The `useEffect` has `[]` deps so cleanup runs only on unmount.

**Gap:** `CharacterRig` (`models.ts:60`) lacks an explicit `.dispose()` method; relies on `palette.disposeAll()` + `renderer.dispose()`. Leak risk is LOW today but a future non-palette geometry on a rig would silently leak until renderer death. **`SceneErrorBoundary` (`App.tsx:123-158`) does not remount on HMR** — a failed scene build requires manual reload.

---

## 9. Save/load + day-rollover lifecycle

**Load** (`storage.ts:77 loadWorldState`): read key → if absent `createDefaultWorldState` → else `deserializeWorldState` → `migrateWorldState` (sequential chain) → `sanitizeWorldState` → tombstone raw to `STORAGE_BACKUP_KEY` if migrated/warnings → re-persist sanitized. Synchronous in `App.tsx:167` `useState` initializer.

**Autosave** (`App.tsx:1110-1146`): 5 s `setInterval` flush when `screenState==='playing'` AND dirty (`computeWorldSaveRevision` FNV-1a–style 32-bit hash ≠ `lastSavedStampRef`); plus `visibilitychange`/`pagehide` flushes. `commitWorld` also saves synchronously — the 5 s interval is a backstop for in-place sim/locomotion mutations only.

**Day rollover** (`storage.ts:521 advanceToNextDay`, invoked only from `performNextDayRest`): clone residents reset `talkedToday`, clone playerRelations reset daily caps, clone worldProps reset held/delivered, `pruneExpiredNpcMemoriesInPlace`, `getSeasonForDay(nextDay)`, greenhouse nightly growth, compute safe exit positions, build rolled WorldState (day+1, `minuteOfDay=480` 8 AM, fresh weather + `npcRuntime`, empty `activeEncounters`, `mailboxUnread=true`), `reconcileLivingRelationshipsOnDayAdvance`. The +2h button uses `advanceClockAndReconcile` (`invitations.ts:429`) which advances minutes within the same day only — does NOT roll the day.

---

## 10. What is implemented, partial, and missing

| Subsystem | Status | Evidence |
| :--- | :--- | :--- |
| Pure sim engine (needs/emotions/schedules/encounters/gossip) | **Implemented, deterministic** | `simulation.ts`, `memories.ts`, 528 tests green |
| 10 residents, 4-phase schedules, 5 visitable interiors | **Implemented** | `residents.ts`, `cottage/greenhouse/bakery/bookNook/copperwheel.ts` |
| Branching narrative + 79 dialogue topics | **Implemented, modularized** | `dialogue/` (20 leaf modules + index) |
| Environmental reactivity pipeline (flags → visuals) | **Implemented** | `narrative.ts:computeEnvironmentState`, `environmentRenderer.ts` |
| Persistence v1→v11 + sanitizer + integrity | **Implemented** | `migrations.ts`, `storage.ts` |
| LR-1 invitations + LR-2 indoor occupancy | **Implemented** | `invitations.ts`, `occupancy.ts`, `activities.ts` |
| Build-10 Wild Hollows exploration | **Implemented** | `exploration.ts`, `scene/builders/wilds.ts` |
| Software-WebGL fallback | **Implemented, gameplay-neutral** | `NeighborhoodCanvas.tsx:401-410`, visual-only reductions |
| **CI test/lint workflow** | **Implemented** (PR #14) | `.github/workflows/ci.yml` — test + lint + build + boundary on every PR + push — doc 08 |
| **Tag-on-merge durability** | **Implemented** (PR #14) | `deploy-pages.yml` tag-on-merge step — doc 08 §4 |
| **Machine-checked layer-boundary enforcement** | **Implemented** (PR #14) | `scripts/check_layer_boundaries.ts` — doc 04, 08 |
| **Duplicate-migration-version guard test** | **Implemented** (PR #14) | `src/game/migrations-guard.test.ts` (LR-A11) — doc 07, 08 |
| **Operating directive encoded** | **Implemented** (PR #18) | `docs/architecture/master-architecture/10-operating-directive.md` + alignment across docs 00/03/07/08 — doc 10 |
| Social foundation SF-1..SF-4 (derived) | **Implemented** (commit `8b715fc`) | `socialProfile.ts`, `invitationFramework.ts`, `emergentStories.ts`, `dialogueContext.ts` — zero new WorldState fields; schema stays v11; derive-only layer — doc 04 §1, doc 06 §3 |
| LR-3 (Clara invitation) | **In progress — design phase** | owner: LR team; design on `origin/docs/lr3-{design,discovery,reconciliation}` (PR #13 open); **not on `main`** — doc 04 §1, doc 10 §5 |
| `@google/genai` runtime integration | **Phantom** (declared, unused) | doc 08 §6 |

---

This document is the consolidated "what is actually shipped" baseline. Weaknesses derived from it are in doc 02; the target state is in doc 03.
