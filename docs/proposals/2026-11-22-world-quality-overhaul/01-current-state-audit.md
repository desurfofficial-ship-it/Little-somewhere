# Document 1 — Current State and Repository Audit

All references: `src/...` inside `little-somewhere/`, branch `feat/visual-identity-evolution-build-04`, base tip `9653b76` (line layout identical to `34905d5` for all cited files; the Stage-7 commits touch docs only).

## 1. Repository and git state

| Item | State |
|---|---|
| Repo | `/home/z/my-project/little-somewhere` (canonical worktree; the sibling `Little-somewhere/` clone hosts the `docs/visual-identity-evolution-audit` branch and is registered as git remote `audit`) |
| Branch | `feat/visual-identity-evolution-build-04` — contains the full world lineage (through Build 10 "Wild Hollows") plus the visual-identity series (stages 1–6) and the seating-orientation fix |
| Push state | Synced: remote `origin/feat/visual-identity-evolution-build-04` = `9653b76` (includes `e9c5229` adversarial-review fixes and the Stage-7 docs). The overhaul branch `feat/world-quality-overhaul` was cut from that tip and pushed |
| Working tree at audit time | Clean except one pre-existing unstaged content diff: `docs/art-direction/VISUAL_QUALITY_STANDARDS.md` (BUILD 04 leftover, subsequently reconciled by remote commit `9653b76`) |
| History hygiene | No TODO/FIXME/HACK/XXX/workaround markers anywhere in `src/` (verified by scan) |

## 2. Verification baseline (executed fresh for this proposal)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | clean, exit 0 |
| `npm test` (tsx --test, 60 test files) | **489/489 pass** at `9653b76` (the earlier local snapshot at `34905d5` measured 497; the sandbox lost older git objects mid-session — the current tip is authoritative; see final report for the reconciliation note) |
| `npm run build` (vite) | passes, ~900 ms; chunk-size warning (>500 kB) only |
| Draw calls | **2304** veteran golden-hour, SwiftShader (`download/asset-qa/build04-validation/baseline-perf.jsonl`); 150.7k tris, 22 textures, 35 programs, scene build 1150 ms |
| Known evidence gap | Real-GPU FPS never measured (WORKLOG 054 marks it "Deferred"); SwiftShader FPS ≈ 1.0 is not representative |

## 3. System ownership map

### 3.1 Application shell
- `src/App.tsx` (~1400 lines): React HUD, modal/dialogue orchestration, key bindings (M/Esc/P/J/I/E/G, E=interact), zoom HUD buttons (1318–1339), joystick + zoom refs passed as props (169–171), action dispatch `openTargetInteraction` (326–622), autosave loop (1117–1125), `playSceneVeil` transition wrapper (817).

### 3.2 Scene monolith
- `src/scene/NeighborhoodCanvas.tsx` (**2755 lines**) owns *everything* render-side: renderer + camera creation (505–516), exterior/interior root groups (494–496), all five interior rigs built at startup and parented to `interiorRoot` (920–968), landmark/bench instancing (807–855, 1174–1283), raycast pick proxies (1138–1179), the single `pointerdown` handler that performs picking AND tap-to-walk (1343–1662), wheel zoom (1663–1669), the custom rAF `tick()` loop (2197–2673) with sim step, input read, player movement, FX, HUD sync, and the camera choreography block (2593–2656), plus software-GL fallback pacing (1731–1754).
- No `useFrame`/R3F: plain Three.js inside one React effect with `deps []` (2745) — zero React re-render coupling to the render loop.

### 3.3 Game layer (pure, testable — the strength of this codebase)
- `src/game/playerController.ts`: movement (`stepPlayerMovement`, accel `1−e^(−rate·dt)` :276, indoor speed cap 4.4 :50–51), seated tick (`seatedUpdate` :208–231 pins position to `seat.seatPos`, facing to `seat.facingAngle`), interaction target selection (:408–543, ranges per kind).
- `src/game/worldMap.ts`: world constants — `BOX_OBSTACLES` (69–77), `CIRCLE_OBSTACLES` incl. `fountain_basin` r 2.46 (94–127), `SEAT_SPOTS` 7 outdoor benches (135–199), `PROP_INTERACTABLES` incl. fountain entry **at a stale anchor (0, 4.1) vs true center (0, 1.5)** (279), `getPropInteractionMetrics` (315–449), walkability + sliding `resolveMovement` (484–529).
- `src/game/walkability.ts`: per-interior obstacle tables dispatch (`isLocationPointWalkable` :22–42) and the stand-up recovery contract `resolveSeatStandPos` (approach anchor → 8-dir × 0.35/0.55 radial recovery, :67–122).
- `src/game/actions.ts` (~3300 lines): all state reducers; sit/stand at 955–1013 (sit teleports player to seat, stand uses `resolveSeatStandPos`); enter/exit interior actions for the 5 buildings; fountain wish (1963–2032), stone skip (2034–2106).
- `src/game/simulation.ts`: NPC ticks, seat reservation/claim (`isSeatClaimed` :146–158), NPC arrival snap to seats (760–771), seat-steal reconciliation (692–713), stuck watchdog (785–799).
- `src/game/seating.ts` (added in `34905d5`): the orientation contract — `seatMeshYaw(facingAngle, forwardAxis)` (46–57), forward = `(sin θ, cos θ)`, avatar front = local +Z.
- `src/game/environment.ts` + `time.ts` + `audio.ts`: deterministic weather per seed/day, clock curfew 1290, audio unlock/ambience.

### 3.4 Scene builders
- `src/scene/builders/buildings.ts`: exterior shells (cottage, bakery+L-wing, book nook+bay window, workshop, greenhouse shell), authored against the fixed 28° iso angle (comments at 1395, 1603).
- `src/scene/builders/{cottage,bakery,bookNook,copperwheel,greenhouse}Interior.ts` + `interiorKit.ts`: the five interior dioramas. Each room is built around origin from the game layer's `*_BOUNDS`/`*_INTERIOR_OBSTACLES`/`*_INTERACTABLES` (mirroring is test-enforced). Cutaway is **baked into geometry**: full-height N/W walls + low E/S wainscot curbs (e.g. cottage `:331-440`, bakery `:205-239`, nook `:203-264`, copperwheel `:201-217`, greenhouse full glass shell `:247-334`).
- `src/scene/builders/landmarks.ts`: `buildStorybookFountain` (294–647), tea cart (654–819), noticeboard (821–908), `buildStorybookBench` (910–1040).
- `src/scene/materials.ts` + `textures.ts`: cached `MeshStandardMaterial` palette registry keyed `std:color:rough:metal:mapSet:env:grad` (91–162); `STORYBOOK_PALETTE` constants (240–274); procedural canvas texture families (timber, plaster, stone, fabric, cobble…). Materials are **shared by reference** across the scene — critical constraint for any fade/transparency feature.
- `src/scene/waterShaders.ts`: shared `uTime/uRain/uWinter/uWind/uDusk/uSplashPos` uniform system via `onBeforeCompile`; pond water (52–185), fountain basin water (190–274, teal `#6BB8C8`), stream material (279–333).
- `src/scene/environmentRenderer.ts`: per-frame water uniform drive (506–519), fountain droplet ballistic animation (533–559), state toggles for fountain flowing/dry (282–291).
- `src/scene/ambientSway.ts`, `contactShadows.ts`, `perfProbe.ts`, `progressionPresentation.ts`, `residentFeel.ts`: ambient motion, baked contact shadows, perf instrumentation, NPC avatar feel.

### 3.5 UI components
`DialogueSheet`, `JournalDrawer`, `InventoryDrawer`, `GreenhousePanel`, `PauseModal`, `TitleOverlay`, `VirtualJoystick` (pointer-capture joystick, 14–59), `icons.tsx`, `uiPalette.ts`.

## 4. Interiors representation (camera-relevant)

| Interior | Bounds (w×d, local) | Wall system | Door | Seats |
|---|---|---|---|---|
| Cottage | 7.0×5.4 (`cottage.ts:18-23`) | N/W full 2.75, E/S curbs 0.42/0.36 | spawn (2.25, 0) | 2 stools |
| Bakery | 6.0×4.8 (`bakery.ts:24-29`) | N/W full 2.55, S/E wainscot | doorGroup (0, 0, 2.32) | 1 bentwood chair (+ decorative east chair) |
| Book Nook | 5.0×4.8 (`bookNook.ts:27-32`) | N/W full 2.6, E/S cutaway | doorGroup (2.42, 0, 0) east | 1 armchair + scripted NPC occupant |
| Copperwheel | 6.0×5.0 (`copperwheel.ts:27-32`) | N/W full 2.72, S/E cutaway | doorGroup (1.0, 0, 2.44) south | 1 armchair (`CW_ARMCHAIR_ORIGIN/FACING`) |
| Greenhouse | 6.04×5.24 (`greenhouse.ts:24-29`) | full glass shell, ridge y≈4.08 | doorGroup (−2.92, 0, 1.5) west | none (decorative stool only) |

Detection is **explicit, not bounds-based**: `PlayerLocation` union (`types.ts:39-45`), flipped by enter/exit actions that snapshot `exteriorPlayerPos` and teleport to `*_DOOR_SPAWN` (`actions.ts:2112-2136, 2157-2181, 2664-2690, 2960-3030, 3287-3311`). Per-frame `syncVisualAndHud` swaps root visibility, background `#2C221B`, fog 200/260, per-room lighting (`NeighborhoodCanvas.tsx:1767-1886`). **No room-id → world-origin table exists** (interiors render at scene origin; only the canvas placement code knows the exterior anchors).

## 5. Fountain current anatomy (summary; full constants in Doc 02 §A)

~109 meshes / ~99 draw calls when flowing, no geometry merging: 8-seg octagonal aprons + 24-seg lathe basin + torus rim + 8 corbels; lathe pedestal with scalloped bowl; 4 cardinal brass spouts + 4 weir boxes; 12 TubeGeometry cascade arcs; 20 droplet spheres; water disc + shader; coins/moss/clog debris state groups. Driven by `flags.repairedFountain` — **the fountain is dry/clogged until the repair quest completes**; the reference image shows the flowing state.

## 6. Bench current construction

`buildStorybookBench` (landmarks.ts:910–1040), instanced 7× from `SEAT_SPOTS` with `bench.rotation.y = seatMeshYaw(seat.facingAngle)` (NeighborhoodCanvas.tsx:1243). Iron scrolled legs + armrests, 4 crowned cedar seat slats (seat-top contract y 0.365 via `userData.seatTopY`), 2 backrest slats (`userData.backrestFrontZ`), rust-red wool cushions shown only in winter. Collision: circle obstacle r 0.42 per bench (worldMap.ts:100–127). The seat contract (seat top height, backrest front plane, yaw binding, collider) is what any furniture rebuild must preserve.

## 7. Existing tests (inventory by theme)

Seating (12+3 tests: exact sit-facing for all 12 seats, quarter-turn sweeps, 5× sit/stand cycles, built-rig yaw bindings with front-vector dot > 0.999), navigation, occupancy, player + playerFeel, engine, storage/migrations, dialogue (registry/assets/engine), per-building game tests, per-interior scene tests, materials/textures, ambient sway, contact shadows, perf probe, build-10 recovery lock, item-subject mapping, UI token discipline. **No camera tests exist** (camera logic has never been extracted into a testable unit — it lives inline in the canvas effect).

## 8. Technical debt register (pre-existing)

1. Camera/input/loop coupled inside the 2755-line canvas effect — untestable, the direct cause of Problems D/E.
2. No real-GPU perf evidence (SwiftShader only).
3. ~9.4 MB of committed QA PNGs (HANDOVER §17).
4. HANDOVER §17 deferred register: journal/toast freshness for tick-granted discoveries, pure-wrapper `residents` clone, sanitizer hardening, uncapped journal memory growth.
5. Interaction ranges duplicated across 4 call sites (`playerController.ts:576-657`, canvas 1407/1497/1515, arrive-dist 2336–2345) with no reducer-side validation.
6. `composeEnvironmentState` allocates a fresh state tree every frame even when unchanged (`environment.ts:253-298`).
7. Module-level ambient-sway registries grow on every canvas remount, never cleared (`ambientSway.ts:42-43`).
8. Stale fountain registry anchor `(0, 4.1)` vs true center `(0, 1.5)` (worldMap.ts:279 vs 94) — currently masked by per-id special cases; a landmine for the fountain rebuild.
9. Chunk-size warning on production build (single >500 kB chunk).

## 9. Relevant dependencies

React 19, three 0.187 (+ @types/three), Vite 8 (+ rolldown), Tailwind 4, motion, lucide-react, @google/genai (dialogue features), tsx test runner, TypeScript 7.0.2. No asset pipeline — **all art is procedural** (canvas textures + parametric geometry), which makes the fountain/furniture reconstruction self-contained in code.
