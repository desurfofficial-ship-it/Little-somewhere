# Document 4 — Target Architecture and Implementation Blueprint

## 1. Component responsibilities (after the overhaul)

```
App.tsx (HUD/modals/refs)          — unchanged role; passes gesture intents via refs
  └─ NeighborhoodCanvas.tsx        — scene ownership, rig construction, render loop orchestration
       ├─ GestureRouter (in canvas)— pointer events → camera intents | walk taps | interaction picks
       ├─ CameraController (NEW)   — camera state machine: yaw/pitch/zoom/mode, damping, occlusion scheduling
       ├─ roomFraming (NEW)        — pure: RoomCameraProfile + fit math + cutaway-side mapping
       ├─ occlusion (NEW)          — occluder registry + interval raycast + fade tweens
       ├─ Interior rigs (existing) — + tagged two-state shell sides (additive refactor)
       └─ game layer (unchanged)   — playerController / simulation / actions / worldMap / seating
```

Rule preserved from the existing architecture: **game layer stays pure and headless**; all camera state lives in the scene layer; save schema (v11) untouched.

## 2. New modules — interfaces

### 2.1 `src/scene/cameraController.ts`

```ts
export interface CameraIntent {           // produced by GestureRouter, consumed per frame
  yawDelta?: number;                       // radians from drag (or ±π/2 from stepped mode)
  pitchDelta?: number;                     // clamped band [−0.12, +0.10] around authored angle
  zoomDelta?: number;                      // wheel/pinch/HUD, applied to mode-specific range
}

export type CameraMode = 'title' | 'playing';

export class CameraController {
  // state (all private; exposed via getters + QA hooks)
  //   yaw (continuous), pitchOffset, zoom targets per location, smoothed mirrors (damped)
  constructor(camera: THREE.PerspectiveCamera);
  setLocation(location: PlayerLocation, state: 'title' | 'playing'): void; // event-driven
  setDialogue(open: boolean, npcPos?: { x: number; z: number }): void;
  addIntent(intent: CameraIntent): void;      // called from pointer/wheel/key handlers only
  update(dt: number, snap: CameraSnapshot): void;   // snap: playerPos, groundY, zoomRaw (from zoomRef)
  // update() responsibilities, in order:
  //   1. integrate intents (yaw/pitch/zoom targets, clamped per location profile)
  //   2. compose focus: title orbit / interior profile / exterior follow / dialogue midpoint
  //   3. damping: position (damp 6.5), look-target (NEW damp 9), zoom mirror
  //   4. emit occlusion request if (now - lastProbe > 150 ms) or |Δyaw| > 0.35 or |Δpos| > 1.2
  //   5. write camera.position / camera.lookAt (look target smoothed — kills D-7)
  // Zero allocations: module-scratch vectors only.
  // QA parity: window.__LS_CAMERA_SET__/GET__ semantics preserved (zoom snap + clamp).
  getYaw(): number;                            // consumed by movement-basis + shell cutaway
}
```

### 2.2 `src/scene/roomFraming.ts` (pure, fully unit-tested)

```ts
export interface RoomCameraProfile {
  focusWeight: number;    // focus = roomCenter + (player − roomCenter) × weight
  lookY: number;          // replaces fixed 0.85
  zoomScale: number;      // interior formula legacy = 0.68
  zoomMin: number; zoomMax: number;   // legacy interior = [0.56, 0.92]
  // Phase 3 additions:
  bounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
  wallHeight?: number; ridgeY?: number;
  baseDistance?: number;  // fit-derived at build time
}
export const EXTERIOR_PROFILE: RoomCameraProfile;         // focusWeight 1.0, lookY 1.0(+ground), zoom [0.55, 1.75]
export function profileForLocation(loc: PlayerLocation): RoomCameraProfile; // all 5 interiors incl. greenhouse
export function screenToWorldMove(h: number, v: number, yaw: number, out): void;
//   yaw = azimuth of camera offset (default π/4). forward = −(sin yaw, cos yaw);
//   right = (cos yaw·0.7071-parity at π/4) — locked by tests against the legacy 0.7071 constants.
export function cutawaySidesForYaw(yaw: number): { near: Side[]; far: Side[] };
// Contract test: cutawaySidesForYaw(π/4) === { near:['E','S'], far:['N','W'] }
//  → exactly today's baked look at the default angle (visual parity guarantee).
export function fitDistance(profile, fovDeg, aspect): number; // Phase 3: bounds + margin projected inside frustum
```

Profiles derive from the game layer's own constants (`*_BOUNDS` etc.) — builders already import the same sources of truth, so data cannot drift (mirroring is test-enforced today).

### 2.3 `src/scene/occlusion.ts`

```ts
export interface OccluderRecord { object: THREE.Object3D; materials: THREE.Material[]; fade: number; target: number; label: string; }
export function registerOccluder(registry, shell: THREE.Object3D, label: string): void; // clones materials once
export function probeOcclusion(registry, camera, playerPos): void;  // 3 rays: center + ±lateral; interval-called
export function updateFades(registry, dt: number): void;            // per-frame tween to target opacity
```
- Registration at build time: 5 building shells (+ bakery L-wing, workshop) + 2–3 large vegetation clusters near the plaza. Shell meshes get `userData.isOccluder = true`; their materials are **cloned once** at registration (bounded; palette cache untouched).
- Probe: 3 rays against flattened proxy bounding shapes; hits set `target = 0.15`, else `target = 1`; `transparent` toggled only while fading; depth-write disabled during fade.
- Interiors: probe skipped (the cutaway system handles visibility).

### 2.4 Interior shell tagging (additive builder refactor)

- Existing wall meshes in each interior builder get `userData.shellSide = 'N'|'E'|'S'|'W'` and `userData.shellKind = 'full'|'curb'`; builders additionally construct the currently-missing variants (full-height E/S walls mirroring the N/W style; low curbs for N/W mirroring the E/S style), tagged and hidden by default.
- `applyShellCutaway(rig, yawQuadrant)` in the canvas toggles near sides to curb variant, far sides to full variant. Hysteresis: switch at yaw crossing side midlines ± 0.15 rad.
- Greenhouse: full glass shell — no variants needed (glass never blocks the view); excluded from cutaway, included in profiles.

## 3. Input & gesture architecture (canvas)

```
pointerdown (canvas, playing, !dialogue)
  ├─ second pointer within 80 ms → PINCH mode (zoom)
  ├─ raycast interactable hit → INTERACT-CANDIDATE (existing approach logic)
  └─ else → DRAG-CANDIDATE
pointermove (candidate held)
  ├─ dist > 6 px → DRAG: yawDelta += dx·k, pitchDelta += dy·k (camera intent)
  └─ pinch: zoomDelta from span change
pointerup
  ├─ was DRAG → end drag (no walk)
  ├─ was INTERACT-CANDIDATE (no drag) → existing interact/approach flow   [fixes D-5]
  └─ else → tap-to-walk commit (existing ground-plane walk)               [fixes D-5]
wheel → zoomDelta (non-passive, preventDefault)   keyboard: Q/E → ±15° yaw (desktop only)
```
- Movement basis (fixes D-10): `screenToWorldMove(h, v, yaw)` replaces the hardcoded `0.7071` pair; locked by unit tests at yaw 0/90/180/270 (no inversion).
- Joystick fixes (G-1): unmount effect resets `vectorRef`; App resets on `screenState`/modal transitions.

## 4. Update order (per frame, revised `tick()`)

```
1. timer.update → rawDt → renderDt = min(raw, 0.05)
   └─ NEW: sim accumulator consumes rawDt (capped 0.25 s/frame) in fixed 1/20 s steps
2. GestureRouter: consume pointer/wheel deltas → controller.addIntent
3. per sim step: stepPlayerMovement(step); stepSimulationInPlace(step)
4. rig placement + FX + HUD sync                   [existing]
5. syncVisualAndHud (root/rig visibility)          [existing; + shell cutaway application here]
6. cameraController.update(renderDt, snap)         [REPLACES NC:2593-2656]
7. occlusion.updateFades (per-frame tween; probe only when controller requested)
8. renderer.render
```

## 5. Fountain rebuild — part specification (landmarks.ts)

| Part | Target construction | Reference anchor |
|---|---|---|
| Base ring | Circle apron, 32-seg, radius ≈ 2.6, cream limestone | wide circular footprint |
| Basin | Lathe profile, 32-seg: outer r ≈ 2.45, rim top y ≈ 0.85, inner water y ≈ 0.62 | thick, high rounded rim |
| Rim coping | Torus r ≈ 2.28, tube ≈ 0.22 | bullnose "thick rounded rim" |
| Pedestal | Lathe: foot r ≈ 0.62 → column → wide lower bowl r ≈ 1.15 y ≈ 1.5 → stem → upper tier r ≈ 0.72 y ≈ 2.3 | two-tier |
| Upper water | Circle r ≈ 0.66 in upper tier; lower disc r ≈ 2.2 | pale blue both |
| Spouts | 6 brass spouts on upper-tier rim, tilted arcs | multiple streams |
| Cascades | 6 jet tubes (upper→lower bowl) + 6 weir arcs (lower bowl→basin) + 2 crown plumes | layered streams |
| Droplets | 28 spheres, crown/basin kinds, ballistic animation (existing system) | droplets/splashes |
| Stone ring | 8–10 rounded stones (green/grey mix) at r ≈ 2.8, partially sunk | decorative stones |
| Merging | All static masonry merged per material | ≤ ~25 structured draw calls flowing |
| States | dry/clogged + flowing preserved; coins/moss/clog groups unchanged | narrative intact |
| Data | `FOUNTAIN_BASIN_RADIUS` synced; anchor fixed (0, 1.5); collision circle synced; plaza walk ring re-verified | collision correct |

Water material: base `#BFE3EF` family, opacity ≈ 0.88; splash centers retuned to new radii. `environmentRenderer.ts` animation hooks unchanged (they consume the rig contract). *(Implemented by the fountain specialist; deviations and their measured justifications recorded in its report.)*

## 6. Furniture specifications

**Bench v2** (landmarks.ts, same export + `userData.seatTopY = 0.365`, `userData.backrestFrontZ`, collider r 0.42 unchanged):
- Legs: curved hardwood profile replacing straight iron posts; warm cedar.
- Seat: 3 wide crowned slats (existing crowned-slat technique, wider bevel) + sage/mint fabric pad (fabric mapSet) across seasons; winter knit cushions keep their `userData.winterCushions` gating.
- Backrest: 2 slats + top rail, radiused; armrests with rounded caps.
- Material discipline: reuse palette + fabric/timber mapSets; merge static sub-meshes (≈ current draw calls per bench).

**Armchairs (nook + copperwheel)**: add cushion mesh (seat + back) in `upholsteryMint` fabric; rounded shell arms (torus-segment or capsule forms) parented inside the existing chair groups; **group yaw stays `seatMeshYaw(...)`** — zero contract change. Winter blanket/knit anchoring tests must stay green.

**Palette additions** (`materials.ts` STORYBOOK_PALETTE): `upholsteryMint ≈ #B9D8C2`, `upholsterySage ≈ #A7C4A0`, `cedarHoney ≈ #9A6B45` — all with fabric/timber mapSets so they inherit the procedural texture families.

## 7. Files expected to change / new files

| File | Change |
|---|---|
| `src/scene/cameraController.ts` | **NEW** — controller + mode machine + damping + QA hooks |
| `src/scene/roomFraming.ts` | **NEW** — pure profiles, fit math, cutaway mapping, screenToWorldMove |
| `src/scene/occlusion.ts` | **NEW** — registry, probes, fades |
| `src/scene/NeighborhoodCanvas.tsx` | camera block → controller call (2593–2656 replaced); gesture router rewrite of 1343–1669 + pinch; movement basis 2316–2319; sim accumulator 2197–2203; greenhouse interior branch removed (consumed by profiles); shell cutaway application; occluder registration; joystick-reset wiring; tap-walk pointerup commit + wall-hug timeout |
| `src/scene/builders/interiorKit.ts` | + shell-side helpers/tagging |
| `src/scene/builders/{cottage,bakery,bookNook,copperwheel,greenhouse}Interior.ts` | wall sections tagged two-state (dimensions/materials identical); armchair upholstery (nook, copperwheel) |
| `src/scene/builders/landmarks.ts` | fountain rebuild (done); bench v2 |
| `src/scene/waterShaders.ts` | fountain water retune (done — pale blue) |
| `src/scene/environmentRenderer.ts` | droplet/splash retune (no structural change) |
| `src/scene/materials.ts` | + 3 palette entries |
| `src/game/playerController.ts` | seated ground-Y terrain fix (C-1); dead sprint clause (G-10); seat range constant (G-11); zero-alloc target-selection scratch (D-11) |
| `src/game/walkability.ts` | stand-up null fallback (C-2) |
| `src/game/worldMap.ts` | fountain anchor fix (done); sorrel approach margin (C-3) |
| `src/game/actions.ts` | reducer range asserts (G-3); outdoor sip (C-5); wish cooldown (G-12); fountain anchor constants (done) |
| `src/game/simulation.ts` | player in separation buffer (G-4); A*-null handling (G-8); arrival pre-check (G-7) |
| `src/game/storage.ts` / `migrations.ts` | future-schema refuse + `*_newer` backup (G-2); autosave toast hook (G-13); log text (G-13) |
| `src/game/time.ts` / `storage.ts` | sleepy nudge (G-17); held-item sleep reset (G-13) |
| `src/App.tsx` | zoom buttons → widened clamp; KeyM gating (G-14); save-failure toast (G-13); joystick/screen-state resets |
| `src/components/VirtualJoystick.tsx` | unmount vector reset (G-1) |
| `src/scene/ambientSway.ts` | `disposeAmbientMotion()` + canvas teardown call (G-16) |
| `src/scene/environment.ts` | composed-state scratch reuse (G-15) |
| `WORKLOG.md`, `docs/art-direction/VISUAL_QUALITY_STANDARDS.md`, `HANDOVER.md`, `ARCHITECTURE.md` | documentation pass (Phase 8) |

**Tests to introduce** (new files or extensions):

| Test file | Locks |
|---|---|
| `src/scene/roomFraming.test.ts` | screenToWorldMove parity at π/4 + correctness at 0/90/180/270; profiles exist for all 5 interiors incl. greenhouse; `cutawaySidesForYaw` default-angle parity + all 4 quadrants; fit-distance math (Phase 3) |
| `src/scene/cameraController.test.ts` | yaw integration + clamps; zoom ranges per location; dialogue midpoint focus; look-target damping; zero-allocation behavior |
| `src/scene/occlusion.test.ts` | probe scheduling interval; hit→fade target; material-clone isolation (palette cache untouched) |
| `src/game/seating.test.ts` (extend) | seated ground-Y includes terrain (foxglove); stand-up fallback non-null for all 12 seats; sorrel margin ≥ 0.2 |
| `src/scene/landmarks.test.ts` | fountain contract + merging + collision clearance (done, 8 tests); bench v2 contract (`seatTopY`, `backrestFrontZ`) |
| `src/game/simulation.test.ts` (extend) | NPC-player separation; arrival pre-check; A*-null fallback |
| `src/game/storage.test.ts` (extend) | future-schema refuse + backup preservation |

## 8. Lifecycle & ownership rules

1. CameraController is created in the canvas effect, disposed in teardown (`dispose()` clears QA hooks; occlusion registry disposes clones).
2. GestureRouter owns pointer semantics; the controller never reads DOM events.
3. roomFraming and occlusion are side-effect-free modules consumed by the controller/canvas — never import React.
4. The game layer never imports scene modules (existing rule) — profiles are built in the canvas from imported game constants.
5. Every visual addition names its draw-call offset (house law); the merged fountain is the offset bank for Phases 4–5.

## 9. Compatibility guarantees (explicit non-goals)

- Save schema v11 unchanged; camera preferences stored in a separate `localStorage` key (not world state).
- Interior contents, furniture placement data, obstacle tables, SEAT_SPOTS, and the seating contract are **not modified** by camera phases (Phase 5/6 changes respect the contracts and their tests).
- Exterior world geometry (Build 10 content included) untouched except occluder tagging and the fountain/bench replacements.
- QA tooling contracts (`__LS_CAMERA_SET__/GET__`, perfProbe rows) preserved.
