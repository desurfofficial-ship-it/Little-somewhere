# Document 3 — Proposed Solutions and Alternatives

Per problem: the recommended approach, the alternatives considered, and why the recommendation wins. Performance implications and integration risks are stated for every proposal.

---

## 1. Camera system (Problems D + E share one architecture)

### 1.1 Recommended: extract a `CameraController` with continuous yaw orbit + dynamic interior cutaway + raycast building fade

A new `src/scene/cameraController.ts` owns all camera state (yaw, pitch-band, zoom, mode). The canvas keeps only: input gesture routing, per-frame `controller.update(dt, snapshot)`, and application of the controller's outputs (position, lookAt, shell cutaway, occluder fades). Full module design in Doc 04.

**Alternatives considered**

| Alternative | Pros | Cons | Verdict |
|---|---|---|---|
| (a) Patch the existing inline branches (add yaw variables, more clamps) | Smallest diff | Keeps the 2755-line monolith untestable; every feature multiplies branch complexity; cannot unit-test framing math; repeats the debt | Rejected |
| (b) 90°-stepped yaw (quarter turns) | Simplest occlusion model (4 discrete cutaway states); no motion-sickness risk | Feels mechanical; brief demands smooth rotation + responsive feel; still requires the *same* dynamic-cutaway work indoors; zoom/occlusion problems untouched | Kept as a settings fallback, not primary |
| (c) Full R3F / react-three-fiber rewrite | Idiomatic React ecosystem | Massive rewrite of a working 2755-line system; violates "do not rewrite working systems"; perf risk on SwiftShader fallback path | Rejected |
| (d) Exterior-only rotation, interiors stay fixed | Cheapest | Brief §5.4 explicitly requires rotate/zoom inside rooms | Rejected |

**Why recommended:** it converts an inline pile of magic numbers into a testable unit (the codebase's own proven pattern — see the seating contract), enables continuous rotation, and isolates every camera concern behind one `update()` call. Integration is additive: the canvas's camera block (NC:2593–2656) is replaced by one controller call; nothing else moves.

**Performance:** controller math is allocation-free (module scratch vectors, same discipline as the existing `_vec3A/_vec3B`); occlusion raycasts are **interval-scheduled** (≥150 ms cadence or on significant yaw/position delta, never per-frame); fade tweens run on a small fixed registry. Net frame cost ≈ current.

**Integration risks + mitigations:**
- Movement basis must be re-derived from yaw (D-10) — shipped in the same phase, with a unit test locking `screenDir → worldDir` at 0°/90°/180°/270° so controls never invert.
- Builders' authored-angle assumptions apply to *interior cutaway* only; exterior geometry is full 3D and rotates safely. Interiors get the dynamic shell (§1.3).
- QA camera hooks (`window.__LS_CAMERA_SET__/GET__`, NC:447–462) are re-exposed through the controller to keep the QA tooling contract.

### 1.2 Building obstruction: selective raycast-driven building fade

When the camera→player ray (or a small cone of 3 rays: center + ±lateral for wide buildings) intersects a registered **occluder proxy** (the building's outer shell, tagged at build time), the building's shell materials tween to ~15% opacity for ~200 ms and back. Trees/props: the largest vegetation clusters get the same tag near the plaza; small props are ignored (they never hide the player at these zooms).

**Alternatives considered**

| Alternative | Pros | Cons | Verdict |
|---|---|---|---|
| Camera repositioning (pull camera in front of obstacles) | No material work | Constantly changes perspective → nausea; fights the iso aesthetic; oscillation-prone near corners | Rejected |
| Full cutaway (slice buildings when player behind) | Deterministic | Heavy builder surgery on 6+ exterior buildings; visual violence; brief warns against blind whole-building transparency | Rejected for exteriors |
| Do nothing but keep the corner-lift heuristic | Zero cost | Already proven insufficient (covers 1 of 5 building corners) | Rejected |
| **Selective fade** (recommended) | Player always visible; preserves composition; bounded scope (≈8 building shells + few tree clusters); standard life-sim idiom | Needs per-building material clones (materials are shared by reference today) | **Recommended** |

**Key implementation detail:** the palette cache shares `MeshStandardMaterial` instances — fading a shared material would fade the entire world. The occluder registry therefore clones materials **once per building shell at registration** (bounded, ~8 buildings × few materials), and fades only the clones. Transparent-mode toggling (`transparent=true` during fade only) avoids sort-order cost when opacity = 1.

**Performance:** 3 raycasts per 150 ms against a flattened proxy array (≤ ~40 boxes/cylinders) ≈ negligible; no per-frame allocations.

### 1.3 Interior presentation: dynamic per-side cutaway (enables rotation indoors)

Each interior rig gains four **shell sides** (N/E/S/W wall assemblies), each pre-built with its two states — full-height wall and low curb — and tagged (`userData.shellSide`). A pure function `cutawaySidesForYaw(yaw)` returns which sides face the camera; those sides render the low-curb variant, the far sides render full walls. At the default 45° azimuth the result is exactly today's authored look (N/W tall, E/S curbs) — verified by a regression test, so the visual identity is preserved bit-for-bit at default angle and becomes correct at every other angle.

**Alternatives considered**

| Alternative | Pros | Cons | Verdict |
|---|---|---|---|
| (a) Re-author 4 fixed cutaway variants per room (bake per-quadrant rigs) | Simple rendering | 5 rooms × 4 variants of geometry authoring; large asset-code growth; transition pops between variants | Rejected |
| (b) Dynamic transparency on near walls | No geometry variants | Transparency sorting + lighting artifacts on interior walls; looks broken with baked contact shadows | Rejected |
| (c) **Prebuilt two-state sides + visibility switch** (recommended) | Zero runtime geometry cost (visibility toggles); exact default-angle parity; testable pure mapping | Builders must be refactored to assemble walls per-side (mechanical, additive) | **Recommended** |

**Performance:** toggling `visible` on ≤ 16 wall meshes per room per quadrant change; no draw-call delta (same mesh count; curb variant is cheaper than full).

### 1.4 Room framing (Problem E): `RoomCameraProfile` + fit-based composition

New pure module `src/scene/roomFraming.ts` consumes, per `PlayerLocation`: the exported `*_BOUNDS`, interactable focal points, wall height, and produces a **profile** `{ baseDistance, pitch, focusWeight, lookY, zoomRange }`. Per frame the camera target = `lerp(roomCenter, playerPos, focusWeight)` and the distance adapts so the room bounds + player project inside the frustum (fit math is pure and unit-tested). Greenhouse gets its profile (fixes D-4/E-4). Entry/exit transitions become damped paths (no `position.set`), preserving the user's yaw and zoom; the existing veil remains the first beat of the transition.

**Alternatives considered**

| Alternative | Pros | Cons | Verdict |
|---|---|---|---|
| Hand-tuned per-room camera presets | Total control | Rigid; 5 rooms × manual tuning; fails "adapt to actual geometry, not hardcoded room types" | Rejected as primary; presets survive as per-profile overrides where needed |
| Force overhead view indoors | Simple legibility | Explicitly rejected by brief §5.3 | Rejected |
| **Bounds-derived fit + player-weighted focus** (recommended) | Adapts to any room automatically; pure math, unit-testable; consumes data that already exists | Needs the world↔room mapping made explicit (rooms render at origin) | **Recommended** |

**Performance:** fit computation only on room entry or zoom change (event-driven), per-frame work is the same damp as today.

---

## 2. Fountain reconstruction (Problem A)

### Recommended: rebuild `buildStorybookFountain` inside the existing `FountainRig` contract, reference-matched, merged for draw calls

- **Geometry:** fully circular 32-seg construction — wide circular basin (thick rounded bullnose rim), central pedestal with a wide lower bowl and a smaller upper tier (matching the reference's two-tier silhouette); 6–8 spouts on the upper tier rim; ring of small green/grey rounded stones around the base on the cobble apron.
- **Water:** retune `createStorybookFountainWaterMaterial` base toward pale blue (`≈#BFE3EF` family); streams re-arc from the upper tier; droplet count 20→~28 with wider ballistic spread; splash rings retuned to the reference's rhythm.
- **States preserved:** dry/clogged narrative state remains; the *flowing* state matches the reference. No narrative/quest changes.
- **Merging:** static masonry merged by material (`mergeGeometries`) — target ≤ ~25 structured draw calls flowing (from ~99), offsetting the known +49 draw-call history of additions (VQS §10 law).
- **Registry hygiene first:** fix the stale anchor (0, 4.1) → (0, 1.5); keep `CIRCLE_OBSTACLES.fountain_basin` in sync with any radius change.

**Alternatives considered**

| Alternative | Pros | Cons | Verdict |
|---|---|---|---|
| Recolor/retune only | Cheapest | Explicitly rejected by brief ("Do not simply recolor") | Rejected |
| Import an external GLTF asset | "Real" asset | No asset pipeline; procedural is the house style; licensing | Rejected |
| New standalone fountain module | Clean slate | Duplicates the FountainRig/state/animation wiring; more risk | Rejected — rebuild in place |

**Performance:** fewer draw calls than today; poly budget kept ≈ current (~8–12 k tris); same shader uniforms. **Integration risks:** collision radius change must re-verify the plaza walk ring; wish-splash hardcodes consolidated onto registry metrics during the phase (kills G-6 properly).

---

## 3. Benches and furniture quality (Problem B)

### Recommended: bench v2 + armchair upholstery within the seat contract; palette additions

- **Bench v2** (same builder, new construction): sculpted hardwood frame with rounded radius edges, wider crowned seat slats, integrated padded armrest caps, optional sage/mint seat pad (fabric mapSet) in all seasons (winter keeps the existing knit cushions), refined proportions (seat depth/height unchanged — the 0.365 seat-top contract and r 0.42 collider are immutable).
- **Armchairs (nook + copperwheel):** rounded shell arms + plush seat/back cushion geometry in mint-green fabric with warm wood legs — geometry added *inside* the existing chair groups, **yaw still derived via `seatMeshYaw`** (contract untouched); blanket/winter knits keep their world-space anchoring.
- **Bakery bentwood + cottage stools:** material/proportion polish only (identity preserved).
- **Palette:** add `upholsteryMint` (≈#B9D8C2 family), `upholsterySage`, warm-wood variant to `STORYBOOK_PALETTE` with the fabric mapSet.

**Alternatives considered**

| Alternative | Pros | Cons | Verdict |
|---|---|---|---|
| Turn benches into upholstered armchair-like seats | Matches reference image literally | Explicitly forbidden by brief §8; destroys outdoor/indoor distinction | Rejected |
| Full generic furniture framework | Elegant for N future pieces | Overkill for 2 armchairs + 1 bench; YAGNI | Rejected |
| **In-place builder upgrades + palette additions** (recommended) | Contained diffs; contract tests already guard the seams; materials system supports new entries | None material | **Recommended** |

**Performance:** bench v2 replaces 1:1 (7 instances); armchair additions ≈ +6–10 small meshes per chair, offset by merging static sub-parts; no new texture families.

---

## 4. Seating residuals (Problem C)

Orientation is solved (verified). Remaining fixes are surgical:
- **C-1 Foxglove sink:** seated ground Y = `getGroundHeightAt(seatPos) + seatHeight offset` at both the player tick and NPC render sites; unit test with the deck seat.
- **C-2 stand-up null fallback:** if recovery returns null, fall back to approach-adjacent scan + one-line log; test with a deliberately over-constrained pocket.
- **C-3 Sorrel margin:** widen approach anchor by 0.15 (data-only) + assert margin ≥ 0.2 in tests.
- **C-4 test locks:** bench-loop yaw lock (pure math part extracted so it is testable) + stool contract note.
- **C-5 outdoor sip:** allow `sipBeverageAtTableAction` on any seated posture (copy: "Sip on the bench").

**Alternatives:** none worth recording — these are defect fixes, not designs.

---

## 5. Bug-fix register batch (Problem F)

**In-scope for this overhaul (P1 + cheap P2):**
- G-1 joystick unmount vector reset (also reset on `screenState` transitions).
- G-2 refuse-to-load future-schema saves + raw backup under a `*_newer` key (no data loss).
- G-3 reducer-side range asserts (defense-in-depth; selector ranges unchanged).
- G-4 include player in NPC separation (skip when player seated).
- G-5/D-6 **fixed-timestep accumulator** (sim substeps at 20 Hz cap) — prerequisite for camera occlusion probes.
- G-6 stale fountain anchor (inside Phase 4).
- G-7 seat-claim check before NPC arrival teleport.
- G-8 A* failure returns null + caller-side fallback idle.
- G-10 dead sprint clause removal; G-11 unify seat range to 2.35 constant; G-13 autosave-failure toast + log text + held-item sleep reset; G-14 KeyM modal gating; G-15 environment-state scratch reuse; G-16 ambient registry dispose; G-17 sleepy nudge at curfew−30 min; D-8 tap-walk total timeout; D-9 dead input removal.

**Registered, out of scope (recorded in HANDOVER §17 tradition):** G-9 pure-wrapper residents clone (test-only reachability), journal memory cap, QA PNG weight, chunk splitting.

---

## 6. Why this combination is superior overall

1. **One abstraction per problem, no patch accumulation:** a camera *system* (not branches), a *profile* (not per-room magic), a *cutaway mapping* (not re-authored variants), a *contract-preserving rebuild* (not recolors).
2. **Everything consumes data that already exists** (`*_BOUNDS`, focal points, seat anchors, palette) — minimal new state, maximal reuse; the simulation and save schema (v11) are untouched.
3. **Testability follows the codebase's own winning pattern** (pure module + regression locks), so the new systems are verifiable without a GPU.
4. **Performance is budgeted, not hoped for:** interval-scheduled raycasts, merged fountain, zero-alloc camera math, and the dt accumulator make the *heaviest* new feature (occlusion) cheaper than the defects it replaces.
5. **Risk is sequenced:** camera foundation → obstruction → interiors means each phase has a working, shippable game; every phase is independently revertable.
