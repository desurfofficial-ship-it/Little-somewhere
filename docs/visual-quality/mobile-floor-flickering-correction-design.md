# Correction Design — Mobile Floor Flickering (Little Somewhere)
## Phase 3 companion to `mobile-floor-flickering-investigation.md`

**Branch**: `fix/mobile-floor-flickering` · **Date**: 2026-11-22
**Design principle**: fix mechanisms, not symptoms; one coherent rendering story rather than disconnected patches; preserve the PREMIUM HANDCRAFTED STORYBOOK DIORAMA identity; prefer architecture-level correctness over tuned workarounds.

---

## 1. Ground stability

### G1 — Unified cobble network geometry (replaces 8 overlapping boxes)

**Problem addressed**: R1 (≈98 m² of exactly-coplanar strip tops), R6-UV (9.6× stone-density inconsistency), duplicated fragment rasterization in overlaps.

**Alternatives evaluated**:

| Approach | Verdict | Why |
| --- | --- | --- |
| **A. Exact rectangle-union mesh (world-aligned UVs)** — grid-decompose the 8 rects at their boundary coordinates; emit one top quad per covered cell; skirt walls only at the true network boundary; UV = worldXZ scaled to the plaza's authored density (0.32 repeats/unit, tile 3.125 u) | **CHOSEN** | One fragment per pixel (no fight possible), one draw call, constant stone size (identity: matches the plaza's authored look everywhere), fewer vertices, zero new dependencies, deterministic and unit-testable pure geometry. Handles the triple-overlap zones for free. |
| B. Height-staggered boxes (promenades 0.050 / lanes 0.053 / plaza 0.056) | Rejected | Leaves 3 boxes overlapping visually; still duplicates fragments; per-strip UV stretch (R6) survives; the 3 mm steps would need their own justification against walk-height logic; a "layered slabs" look was never the art direction. |
| C. `polygonOffset` on a split lower-priority material | Rejected | Works only while fights are exactly coplanar (true today); does not fix UV mismatch; adds a second material + render-order coupling; treats the symptom layer. |
| D. Per-strip texture clones with UV-normalizing offsets | Rejected | +8 texture uploads ≈ +11 MB GPU on mobile; 8 draw calls stay; fixes density but not coplanarity. |
| E. Move strips apart so they never overlap | Rejected | Changes the authored map layout (lanes must cross). Non-starter. |

**Geometry construction (deterministic, dependency-free)**:
1. Inputs: the same 8 rectangles the strips used today, exported as the single source of truth (see G2) — `(x, z, halfW, halfL)` in world XZ.
2. X-cuts = sorted unique rect boundaries in x; Z-cuts likewise → grid cells never straddle a rect boundary → a cell is covered iff its center is in ≥1 rect (exact, no rasterization error).
3. Emit top quads (y = +0.05) for covered cells; normals +Y; UVs world-aligned: `u = wx·k, v = wz·k` with `k = 4/12.5 = 0.32` (plaza density preserved exactly on the plaza; POT canvas + RepeatWrapping tolerate uv ≫ 1).
4. Emit skirt quads where a covered cell borders an uncovered cell (from y=+0.05 down to y=−0.01, outward normals) — preserves today's visible slab lip; interior skirts disappear (they were never visible anyway).
5. Merge into one indexed `BufferGeometry` (position/normal/uv), one mesh, `castShadow=false, receiveShadow=true`, `MeshStandardMaterial` = the existing `cobbleMat` (roughness repeat fix T2 applies).

**Upper bound**: ≤15 x-cuts × ≤15 z-cuts → ≤225 cells → trivial geometry, one draw call.

**Identity impact**: plaza unchanged (same density, same texture, same height); lanes/promenades gain the plaza's stone size (they currently render stretched/dwarfed stones — audited as a defect, not a look); seam line at slab borders unchanged. A/B verification mandatory.

### G2 — One ground-truth contract (strip table in the game layer)

**Problem addressed**: R3 (5 cm burial), R4 (destRing coplanarity), plus G1's single-source requirement.

- New pure-TS module `src/game/groundSurfaces.ts`: exports `COBBLE_RECTS` (the 8 rects) and `getCobbleSurfaceHeight(x, z)` returning 0.05 inside the network with a smooth 0.3 u ramp at boundaries (smoothstep on distance-to-rect-edge, clamped 0→0.05). Zero DOM / zero three (layer law respected; `src/game/` stays Node-testable).
- `worldMap.getGroundHeightAt` delegates to it (cobble previously returned 0 — the visual floor was 0.05; the logical contract was wrong, not the visual).
- `NeighborhoodCanvas` consumes `COBBLE_RECTS` for G1 (the rects are literally the same data the strips used — no layout change).
- `destRing` placement becomes `getGroundHeightAt(dest) + 0.012` (the shared decal clearance).
- Walkability/navigation untouched (XZ-only logic). Camera, seating, occupancy, invitations all derive character placement from `getGroundHeightAt` → everything rides the true surface consistently; the +0.05 rise is smoothed by the 0.3 u ramp and camera damping.
- **Interiors are exempt** (`isInteriorLocation`): indoor seat XZ values can legitimately overlap the plaza rect while the rendered ground there is the interior floor deck — sit heights, standing `groundY`, mount placement, and initial motion all branch on the predicate.

**Alternatives**: keep logical 0 and lower slabs to 0.02 — rejected (breaks authored 5 cm slab look, puddle clearance math, and skirt silhouette; touches more visual surface than the contract fix). Dynamic disc parenting — rejected (larger refactor of 71 call sites for the same result).

### G3 — Contact-disc rescue at flush time

- In `ContactShadowBatch.flush()`, after baking world matrices: if `discWorldY < getGroundHeightAt(worldX, worldZ)` (i.e. the disc is buried under the cobble network), lift to `groundHeight + 0.012` — **exterior (boundary-less) buckets only** (interior rigs live at scene origin inside the plaza rect; lifting their discs floated them ~5 cm above the interior floor — adversarial-review finding).
- Dynamic character discs/rings fix themselves via G2 (they already add offsets to `getGroundHeightAt`). Dust spawns likewise (`ground + 0.07` now clears the slab by 7 cm).

## 2. Shadow stability

### S1 — Restore a real filtered shadow path

| Approach | Verdict |
| --- | --- |
| **A. `PCFShadowMap` + `sunLight.shadow.radius ≈ 2.5`** | **CHOSEN.** The r187 PCF path is a 5-tap Vogel disk with hardware compare — restores the soft storybook edge the code always intended (every shipped screenshot was captured under the silent 1-tap degradation). Cost: 5 shadow-map fetches on receiving fragments ≈ negligible on Apple TBDR. One line + radius. |
| B. VSMShadowMap | Rejected — full-scene blur pass + light-bleed artifacts; heavier on mobile; identity risk. |
| C. Keep BASIC + raise mapSize to 2048 | Rejected as primary (4× shadow-pass fill on mobile for still-hard edges; texel 0.027 u still quantized). May be revisited as a desktop-only quality tier later. |
| D. Disable shadows on mobile | Rejected — explicitly forbidden (symptom suppression; destroys identity). |

### S2 — Shadow-camera stability & coverage

1. **Light-space position snapping**: after the per-frame sun curve computes `sunLight.position`, snap the shadow camera's target-relative light-space translation to the texel grid (0.0547 u): build the light basis (dir, right, up), snap the relative X/Y components to texel multiples, preserve distance along the light axis. Translational texel swimming stops; the residual rotation shimmer is slow (sun sweep ≈ minutes) and softened by S1. Pure helper function, unit-tested (grid alignment, bounded displacement, distance preservation, degenerate guard). Target is read from `light.target.matrixWorld` — exactly what three's `LightShadow.updateMatrices` uses.
   - Alternative considered: update the sun only at discrete game-minute steps — rejected (visible direction pops every ~0.45 s; worse than smooth rotation).
   - Alternative considered: `shadowMap.autoUpdate=false` + event-driven renders — rejected (walking residents must re-render shadows continuously).
2. **Coverage**: `shadow.camera.far 85→95` (frees Sorrel Hollow late-dusk clipping; no texel cost) and dusk sun-height floor `Math.max(8,…)→Math.max(10,…)` in the environment curve (keeps casters in front of the near plane at the lowest sun). Foxglove across-track exit at tNorm≥0.72 is **deferred** (fixing it requires widening the ortho box → texel size grows → softens plaza quality; peripheral district issue, documented as a known limitation).

## 3. Depth strategy — deliberately minimal

- **Keep** `near=0.5 / far=160` (R7: 12×–693× margins at 24-bit; exact-coplanar fixes make precision irrelevant to the symptoms).
- **Reject** logarithmicDepthBuffer (breaks custom chunk assumptions, TBDR cost, zero benefit), near/far tightening (far-clip risk at zoom-out, no gain), depth32F/stencil overrides (unneeded).
- **Add** DEPTH_BITS/MAX_SAMPLES/ANISO one-time telemetry to `perfProbe` (D1) so any device's actual precision is observable in the field.

## 4. Transparency & environmental rendering

### T1 — Deterministic render-order pinning
- Exterior contact-disc buckets + rain puddles: `renderOrder = 1`; water surfaces (pond + fountain family): `renderOrder = 2`; fountain above-water decals (splash rings, foam collars, cascades) and **actually-faded** occlusion shells: `renderOrder = 3` (shells reset to 0 on un-fade — the pin must not linger on opaque meshes and degrade the front-to-back opaque pass); dust sprites keep their authored `5`; **interior buckets keep distance sorting** (greenhouse glass layering depends on it — adversarial-review finding).
- Effect: transparent blend order no longer depends on camera-relative sort of parent-origin instanced buckets (R5) or water-center distances; blending is commutative within each layer, water's depth-write now always applies at the intended point. Alternative (water `depthWrite:false` + manual ordering) rejected — changes what is visible through water (identity risk).

### T2 — Material truth
- `cobbleRoughMap.repeat.set(8, 8)` — restores the intended 40-course mortar-locked roughness (static, invisible-risk).
- Aniso policy: cobble + meadow `Math.min(8, maxAniso)` (needed ≈8 for this rig's worst 5:1 footprint; 16 redundant; guards the aniso-0 degenerate case by never trusting raw max).
- **Not done** (identity-preserving choice): bevel-stroke/mortar softening, 1024² canvas, meadow dot resize — the minification shimmer is mitigated sufficiently by aniso policy + unified geometry; canvas changes would alter the authored stone look for marginal gain. Documented as optional future polish.

### E1 — Particles/environmental
- No changes required: rain/petals/fountain/instanced-culling all audited RULED OUT (investigation §R8). The only environmental touches ride G2/G3 (dust spawn height, disc rescue). Fountain basin ring-vs-water sort shimmer is cosmetic (basin-interior only) and is *improved* by T1's water renderOrder pinning; no further change.

## 5. Change inventory (files)

| File | Change |
| --- | --- |
| `src/game/groundSurfaces.ts` | NEW — cobble rect table + surface height function (pure, tested) |
| `src/game/worldMap.ts` | `getGroundHeightAt` delegates to the cobble surface (bridge/deck logic unchanged) |
| `src/game/playerController.ts` | `isInteriorLocation()` predicate; sit branch + initial-motion interior guard |
| `src/game/worldMap.test.ts` / `src/game/player.test.ts` | Assertions updated where they codified the 0-on-cobble inconsistency; new contract tests added |
| `src/scene/builders/cobbleNetwork.ts` | NEW — deterministic union-geometry builder (pure, tested) |
| `src/scene/NeighborhoodCanvas.tsx` | Replace 8 `addCobbleStrip` boxes with the unified mesh; destRing clearance; PCF + radius; shadow far; mount interior guard; interior-list dedupe; renderOrder pinning site; roughness repeat; aniso policy |
| `src/scene/environmentRenderer.ts` | Light-space snapping call after sun set; dusk height floor 10 |
| `src/scene/contactShadows.ts` | Buried-disc rescue in `flush()` (exterior-gated) + exterior renderOrder pin |
| `src/scene/shadowStability.ts` | NEW — texel-snap helpers (pure, tested) |
| `src/scene/textures.ts` | Aniso policy on cobble + meadow |
| `src/scene/perfProbe.ts` | DEPTH_BITS/aniso telemetry |
| `src/scene/builders/botanicalDressing.ts` | Rect list derived from the shared source (dedupe) |
| `src/scene/builders/landmarks.ts`, `vegetation.ts`, `reactiveProps.ts` | T1 renderOrder pins (fountain family, pond water, puddles) |
| `src/scene/occlusion.ts` | Faded-shell layer applied while faded, reset on un-fade |
| `src/scene/*.test.ts`, `src/game/groundSurfaces.test.ts` | New tests: union coverage exactness (+sliver cell), no-coplanar guarantee, UV alignment, height ramp, snap math, disc rescue + scoping, shell-order reset |
| `docs/visual-quality/*`, `WORKLOG.md`, `HANDOVER.md` | Records |

## 6. What this design deliberately does NOT do

- No device-sniffing conditionals scattered through the renderer — the single capability input remains `isSoftwareGl`; everything else is uniform and correct on all paths.
- No gameplay logic changes; no scene-content changes; no asset identity changes beyond documented normalizations (stone-size unification, roughness alignment).
- No tuning-by-screenshot ("+0.02 and pray") — every numeric in the design is derived from measured geometry or vendor-documented semantics.
