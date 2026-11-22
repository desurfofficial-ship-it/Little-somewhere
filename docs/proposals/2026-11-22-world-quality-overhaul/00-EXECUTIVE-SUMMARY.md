# LITTLE SOMEWHERE — World-Quality Overhaul: Executive Summary

Status: **IMPLEMENTED & EVIDENCE-COMPLETE 2026-11-22** on branch `feat/world-quality-overhaul` (8/8 phases + Doc 06 §4 evidence campaign; see `07-evidence-campaign-record.md`)
Date: 2026-11-22 · Base: `feat/visual-identity-evolution-build-04` @ `9653b76` · Baseline: tsc clean, 489 pre-overhaul tests (re-established after sandbox object loss; +8 fountain tests = 497 green), production build passes, 2304 draw calls (veteran, SwiftShader)

## The six problems, in one line each

| # | Problem | Root cause (verified) | Fix strategy |
|---|---------|----------------------|--------------|
| A | Fountain does not match reference | Current fountain is octagonal (8-seg aprons), teal water `#6BB8C8`, no surrounding stone ring, ~99 draw calls when flowing (`landmarks.ts:294-647`) | Rebuild `buildStorybookFountain` geometry to the reference silhouette inside the existing `FountainRig` contract; pale-blue water; merge static masonry |
| B | Benches / furniture quality | Single bench design is open iron-frame + flat slats; interior armchairs lack upholstery language; no mint-green fabric in the palette | Bench v2 + armchair upholstery within the seat contract (`seatTopY`, `backrestFrontZ`, `seatMeshYaw` preserved); palette additions |
| C | Armchair sit orientation | **Already fixed and independently verified** (`34905d5`, on remote): every backed seating mesh yaw derives from `seat.facingAngle` via `seatMeshYaw()` (`src/game/seating.ts`); 0/90/180/270 sweeps + 5× sit/stand cycles regression-locked | Residual seating defects only (Foxglove deck sink, stand-up null fallback, bench-yaw test lock) |
| D | Camera inadequate | Fixed isometric rig; **zero rotation input exists**; desktop-only zoom 0.72–1.45; no occlusion handling except a single-quadrant height heuristic; tap-to-walk fires on `pointerdown` (`NeighborhoodCanvas.tsx:2593-2656, 1343-1662, 1663-1669, 2620-2622`) | Dedicated `CameraController` module: continuous yaw orbit, widened+pinch zoom, interval raycast building fade, gesture re-ownership, fixed-timestep sim accumulator |
| E | Interior camera framing | Interior branch hardcodes magic numbers (focus ×0.42, lookAt y 0.85, zoom ×0.68 clamp 0.56–0.92); **greenhouse interior missing from the branch**; entry transition is a hard `position.set` snap; no room-size adaptation (`NeighborhoodCanvas.tsx:2602-2618, 2377-2395`) | `RoomCameraProfile` per location derived from the exported `*_BOUNDS`; fit-based framing with player-weighted focus; damped look-target; dynamic per-side wall cutaway so any yaw keeps the diorama readable |
| F | Additional bugs | 5×P1 + 17×P2 found by adversarial audit (slow-motion dt cap, stuck joystick vector, future-schema save data loss, no reducer range validation, NPC-player no-separation, …) | Phased bug-fix register (Doc 02 §G, Doc 05 Phase 7) |

## Key architectural insight

The game renders interiors as **origin-centered diorama rigs swapped wholesale**, with the cutaway baked into geometry (tall N/W walls, low E/S curbs) and every camera branch, input basis, and builder comment authored against **one fixed 45°/28° isometric angle**. Any camera rotation is therefore not an input feature — it requires a **dynamic cutaway system** (per-side wall variants selected by camera yaw quadrant) and a **movement basis derived from camera yaw** instead of the hardcoded `0.7071` constants. The blueprint (Doc 04) adds this without touching interior contents, furniture, or the simulation.

## Phases

1. Camera foundation — controller module, gestures, zoom, movement basis, dt accumulator
2. Obstruction intelligence — interval raycast building fade, occluder registry, greenhouse branch fix
3. Interior framing — RoomCameraProfile, dynamic cutaway shells, entry/exit transitions
4. Fountain reconstruction (reference-matched, draw-call-neutral via merging)
5. Furniture quality (bench v2, armchair upholstery, palette)
6. Seating residuals (deck sink, stand-up fallback guard, contract tests)
7. Bug-fix register batch (P1 set + selected P2)
8. Adversarial QA, perf evidence, documentation, final verification

## Approved decisions

| # | Decision | Approved |
|---|----------|----------|
| 1 | Camera rotation model | **Continuous free yaw** (drag); 90° stepped mode kept as a settings fallback |
| 2 | Building obstruction response | **Selective building fade** (per-building material clones, raycast-driven), not camera repositioning |
| 3 | Fountain flowing baseline | Keep the repair narrative (fountain starts dry) but make the **flowing state match the reference** |
| 4 | Bench identity | Keep park-bench language, upgrade construction + add sage/mint cushion option — do **not** turn benches into armchairs |
| 5 | Git checkpoint | Push the build-04 branch, then cut `feat/world-quality-overhaul` from its tip — **done** (`feat/world-quality-overhaul` pushed from `9653b76`) |

## Documents

1. [01-current-state-audit.md](01-current-state-audit.md) — what exists, who owns what, baselines, debt
2. [02-defect-root-cause-report.md](02-defect-root-cause-report.md) — every defect with file:line evidence and severity
3. [03-proposed-solutions-alternatives.md](03-proposed-solutions-alternatives.md) — chosen approaches vs alternatives
4. [04-target-architecture-blueprint.md](04-target-architecture-blueprint.md) — new modules, interfaces, update order, file inventory
5. [05-phased-execution-roadmap.md](05-phased-execution-roadmap.md) — dependency-ordered phases with acceptance criteria
6. [06-qa-adversarial-testing-strategy.md](06-qa-adversarial-testing-strategy.md) — how we will try to break it

Evidence basis: five parallel specialist investigations (camera, interiors, environment art, seating/collision, adversarial QA) reconciled against first-hand reads of `NeighborhoodCanvas.tsx`, `playerController.ts`, `seating.ts`, the interior builders, and a fresh baseline run. Line numbers refer to the base tip `9653b76` (identical layout to `34905d5` for all cited files; the two Stage-7 commits touch docs only).
