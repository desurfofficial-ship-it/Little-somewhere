# Mobile Floor Flickering — Root-Cause Investigation Report
## Mission: Eliminate Floor Flickering & Mobile Rendering Artifacts (Little Somewhere)

**Date**: 2026-11-22 · **Branch**: `fix/mobile-floor-flickering`
**Method**: Phase-0 reconnaissance (`phase0-reconnaissance.md`) → five independent static forensic agents (ground geometry, shadows, depth/camera, textures, particles) → runtime reproduction campaign executed in a disposable lab clone → consolidation (this document).

**Confidence convention**: every claim below is labeled **CONFIRMED** (verified in code and/or reproduced at runtime), **PROBABLE** (strong evidence, one link missing), **UNCONFIRMED** (plausible, untested), or **RULED OUT** (evidence contradicts it). Hypotheses are presented as hypotheses until evidence, never as facts.

---

## 1. Confirmed symptoms

| # | Symptom (user report) | Runtime reproduction status |
| --- | --- | --- |
| S1 | Parts of the cobblestone floor flicker | **REPRODUCED (lab, forced-hardware path)**: 400–552 cobble pixels change strip-identity every 0.5 s with a *stationary* camera (color-coded strip test, §5-E) |
| S2 | Dark patches / irregular artifacts appear & disappear on the ground | **REPRODUCED (mechanism)**: coplanar winner flips sample *different, misaligned* cobble UVs → alternating mortar/stone patches; shadow-edge crawl adds moving darkening (§3-R2) |
| S3 | Small objects and environmental debris flicker | **REPRODUCED (mechanism)**: contact-shadow discs & interaction rings are depth-buried under cobble tops and pop at strip boundaries (§3-R3); MSAA edge shimmer on thin geometry at glancing angles contributes (§3-R6) |
| S4 | Artifacts particularly noticeable as the camera moves | **CONSISTENT**: z-fighting is rasterization-instability — sub-pixel camera motion flips winners; micro-dolly test changed 7,742 region pixels on a 0.05-unit dolly (§5-F) |
| S5 | Fountain plaza is the worst area | **EXPLAINED**: plaza carries the two largest coplanar overlap bands (37.6 m²), a 13.5 m sliver, two triple-overlap zones, and the densest cluster of buried contact discs (§3-R1/R3) |

Headless-lab caveat: reproduction ran under SwiftShader with the game's hardware path forced (`?forcehw=1`); WebGL2, **DEPTH_BITS=24**, MSAA on, dpr 1. Real iOS Safari/Chrome (WebKit-on-Metal) remains the target platform — device-only conclusions are marked in §8.

## 2. Affected rendering subsystems

1. **Ground geometry layering** (`NeighborhoodCanvas.tsx` cobble strips ×8, meadow plane) — primary.
2. **Shadow pipeline** (`THREE.PCFSoftShadowMap` config, per-frame sun mutation in `environmentRenderer.ts`) — secondary amplifier.
3. **Logical-ground contract** (`getGroundHeightAt` vs rendered surface heights) — drives symptom S3.
4. **Transparency render ordering** (instanced contact-disc buckets, water, puddles, occlusion-fade shells) — probable contributor.
5. **Texture/minification pipeline** (cobble albedo/roughness, per-strip UV density) — visual-shimmer contributor and identity inconsistency.

## 3. Root causes (each with status, evidence, and mechanism)

### R1 — Exactly-coplanar cobble strip tops (12 overlap pairs, 4 triple zones, ≈98 m²) — **CONFIRMED, PRIMARY**
- All 8 strips are `BoxGeometry(w, 0.06, l)` at `position.y = 0.02` → top faces at exactly **y = +0.05**, one shared material. Where strips overlap, two (or three) opaque top faces occupy identical depth.
- Evidence (static): computed pairwise overlap matrix — plaza∩northProm 23.13 m², plaza∩southProm 14.38 m², plaza∩eastLane 0.68 m² (13.5 m sliver), eastLane∩southProm 13.44 m², eastLane∩northProm 13.44 m², westLane∩southProm/northProm 9.28 m² ×2, homeLane∩{westLane, southProm, bridgeApproach}, southProm∩bridgeApproach; triple zones at plaza∩eastLane∩{both promenades}, homeLane∩westLane∩southProm, homeLane∩southProm∩bridgeApproach. (`NeighborhoodCanvas.tsx:620–634`.)
- Evidence (runtime, decisive): color-coding the 8 strips (world-position-keyed, tone-map-aware nearest-centroid classification) yields **400–552 strip-identity flips per 0.5 s on a stationary camera** (0.085–0.118 % of on-screen strip pixels), with transitions concentrated on exactly the predicted overlap pairs: eastLane↔bridgeApproach 376, southProm↔eastLane 327, eastLane↔northProm 198, southProm↔northProm 76, plaza↔bridgeApproach/eastLane, westLane↔{eastLane, southProm}. Additional flip pixels are MSAA seam blends at abutting strip edges.
- Mechanism: identical depth + different per-strip UV spaces (BoxGeometry maps UV 0..1 per face; cobbleTex repeat 4×4) → each pixel's winner alternates between *differently-stretched* cobble patterns → irregular light/dark patches that change with any camera motion. Texture density varies 9.6× across strips (§R7), so overlapped winners are strongly visually distinct.
- No `polygonOffset` exists anywhere in `src/` (grep: 0 hits) — there was zero mitigation.

### R2 — Dead PCFSoftShadowMap in three r187 + per-frame unsnapped sun movement — **CONFIRMED (mechanism), SECONDARY driver**
- **r187 fact (from installed source)**: `PCFSoftShadowMap` is deprecated (constant still = 2) but absent from `shadowMapTypeDefines` → `generateShadowMapTypeDefine` falls back to `SHADOWMAP_TYPE_BASIC`: a **single-tap, unfiltered** shadow lookup. The 5-tap Vogel-disk PCF path never compiles. Every shadow edge in the game is a hard 1-texel stairstep of a 1024² map over a 56×56-unit ortho frustum (texel = 0.0547 world units; ground-projected 0.067 u at noon → **0.195 u at dusk**).
- `environmentRenderer.ts:474–476` sets `sunLight.position` **every frame** (clock 2.2 game-min/s); `shadowMap.autoUpdate` is never disabled → the shadow map re-renders and its texel grid **swims continuously**. Walking residents/fountain-area props are animated casters. Camera motion re-samples the world-space stairsteps at new screen positions → crawling dark/light bands, exactly "dark patches appear and disappear," aggravated by movement.
- Shadow acne on ground/cobble is **RULED OUT** (neither ground nor strips cast shadows; nothing exists in the shadow map at their own depths) — the defect is edge *instability*, not self-shadowing.
- **Runtime weighting**: with shadows disabled (P3) or the shadow map frozen (`autoUpdate=false`, P4), the stationary same-pose diff is **unchanged** (~1 % full-frame / ~1.4–1.8 % plaza) → shadow crawl is a real but **secondary** contributor; the coplanar fight (R1) dominates.
- Peripheral confirmed coverage facts (not plaza-relevant): dusk sun height clamp `Math.max(8, …)` lets Sorrel Hollow casters fall behind the shadow-camera near plane (w<4) late in the day; Foxglove Rise exits the ±28 ortho box across-track from tNorm≈0.72; grove-ring shadow tips truncate mid-ground at low sun.

### R3 — Logical-ground ≠ visual-surface contract (5 cm burial on all cobble) — **CONFIRMED (drives S3)**
- `getGroundHeightAt` (`worldMap.ts:472–493`) models only the footbridge deck and Foxglove Rise — it returns **0 everywhere on cobble**, while the rendered strip tops sit at **0.05**.
- Consequences (all file:line verified): character contact discs at `ground+0.024` and interaction rings at `ground+0.04` (`characters.ts:313/326`) are **below the cobble top → depth-occluded on every strip**; static prop discs (fountain 6.2×6.2 @0.02 `landmarks.ts:343`, gazebo 6.6², tea cart, noticeboard, 4 plaza lamps @0.018) are permanently invisible on the plaza; footstep dust spawns at `ground+0.07` → only 2 cm above the slab → 30–60 % of each puff clips inside the slab with a camera-angle-dependent cut (`NeighborhoodCanvas.tsx:1146`).
- Reads as: shadows/objects vanish the instant a resident steps onto cobble and reappear on meadow — binary "flicker" concentrated on the plaza (most cobble, most traffic). Discs straddling strip edges show a camera-dependent burial silhouette.
- The tap-walk destination ring is a special case — see R4.

### R4 — Tap-destination ring exactly coplanar with strip tops — **CONFIRMED**
- `destRing.position.y = getGroundHeightAt(dest) + 0.05` (`NeighborhoodCanvas.tsx:2831–2838`) = **0.05 on cobble = exactly the strip-top height** → per-pixel z-fight of an 85 % opacity UI ring on every plaza tap, with a ±12 % per-frame scale pulse changing the overlap pattern continuously.

### R5 — Transparent render-order instability (instanced contact-disc buckets sort at parent origin) — **PROBABLE**
- three r187 sorts transparent objects by `matrixWorld` origin; the ~98 static contact discs are batched into ≤6 `InstancedMesh` buckets parented at `exteriorRoot` (world origin), while water/puddles/faded-occlusion shells sort at their true centers (`contactShadows.ts:170–171`, `occlusion.ts:215–224`). As yaw changes, relative draw order between dark-disc buckets and overlapping transparents **flips deterministically** → dark veils can gain/lose a blend pass over ground regions.
- Not directly discriminated at runtime (buried discs are invisible on the plaza due to R3; the meadow-side residual sits inside the animation baseline). Cheap deterministic fix implemented alongside the confirmed fixes.

### R6 — Texture/minification shimmer and material inconsistencies — **CONFIRMED as shimmer source, NOT a dark-patch source; identity defects**
- Cobble albedo: 512² canvas, mortar gaps ≈1.1 texel by mip 3; top-of-screen minification reaches 8× with 5:1 footprint elongation → classic trilinear transition-zone sparkle. Meadow detail: 1.2–2.6 px dots ≈ 0.6–2.5 screen px far-field → "dot twinkle." (`textures.ts:472–518`, `textures.ts:366–420`.)
- **RoughnessMap misalignment (CONFIRMED bug)**: the stone-course roughness map has 5 courses/tile × repeat 4 = **20 courses vs the albedo's 40** → specular bands straddle stones → view-dependent bright/dark sheen patches that don't track visible stonework. Fix: repeat (8,8).
- **UV density inconsistency (CONFIRMED)**: course size ranges 0.0575 u (bridge approach) → 0.55 u (promenades) across strips that should read as one pavement — 9.6× variation (identity defect + amplifies R1 winner visibility).
- Anisotropy: cobble/meadow take uncapped `maxAnisotropy`; needed ≈8, 16 redundant on TBDR; degenerate case (extension absent → aniso 0) would shimmer severely.
- **Ruled out**: mediump banding (no precision overrides anywhere; water shaders inherit highp), tone-mapping instability (exposure static), per-frame material mutations (season-gated only, verified), `needsUpdate` churn (zero per-frame), 512→1024 canvas (no magnification anywhere; pure memory cost).

### R7 — Depth-buffer precision / camera near-far — **RULED OUT on 24-bit hardware (the decisive fork measured)**
- Exact 1-LSB math (Δz = z²·(f−n)/(n·f·2^b), n=0.5/f=160, 24-bit): 0.087 mm @27 u, 0.36 mm @55 u — every non-coplanar separation in the scene (≥3 mm) holds **12×–693× margin** even at 90 u glancing.
- Runtime probe: **`gl.getParameter(gl.DEPTH_BITS) = 24`** (headless, forced-hardware path). Old-WebKit 16-bit edge cases remain **UNCONFIRMED on real legacy devices** — the report's one open device fork; the DEPTH_BITS probe added to perfProbe (Phase 4) closes it on any device.
- Tightening near/far buys ~2.2× precision — irrelevant against exact coplanarity (zero separation) — and far=90 would clip ground at zoom 1.75/pitch-min (top-of-screen ground reaches 128 u). **Logarithmic depth: RULED OUT** (zero benefit at this scale, per-fragment log2 cost on TBDR, breaks custom-shader chunk assumptions).

### R8 — Particle/environmental systems — **RULED OUT as plaza-floor patch sources (except R3 effects)**
- Rain: vertical streak cylinders (r 0.014), perpendicular intersection with ground — no coplanar band; tips reach y 0.02 (cosmetic 2–8 cm early termination on plaza). Petals/drift: min y 0.2–0.3 (never touch ground). Fountain: water disc r 2.2 inside basin wall r 2.21+ (≥1 cm gap), submerged pebbles/coins ≥1 cm clear — no coplanar risk; droplets dip ≤3 cm into water at cycle end (intended splash read).
- **Instanced culling pops: RULED OUT** — three r187 `InstancedMesh.computeBoundingSphere()` unions per-instance spheres (verified in installed source); all per-frame-matrix meshes set `frustumCulled=false`; orchard sway amplitude ≤0.12 u against a sphere spanning the orchard.
- Fountain basin interior: splash rings (+0.014) vs water disc (transparent, **depthWrite:true** default) sort per-object by center distance → far-side rings veil under the 0.88-opacity water, near-side rings render bright → subtle basin-interior brightness shimmer while orbiting (**PROBABLE**, cosmetic, basin-only).
- Puddles: 7 films @ y=0.058 (8 mm over strips — 24-bit safe 22×+), weather-gated by design — the only *intended* dark ground patches.
- Mystery boxes resolved: the five extra 0.06-tall boxes found at world origin in the runtime probe are the **interior floor decks** (`cottageInterior.ts:301` et al.) inside the hidden `interiorRoot` — invisible outdoors, **RULED OUT**.

## 4. Reproducibility findings (lab campaign, forced-hardware path, SwiftShader)

| Probe | Setting | Result |
| --- | --- | --- |
| E0 | environment | WebGL2, DEPTH_BITS **24**, antialias on, dpr 1 (headless), SwiftShader |
| E1 | stationary same-pose pairs ×3 | full-frame diff **0.95–1.06 %** (maxΔ 176–211); dominated by legitimate animation (residents, water, sway — verified by heatmap overlay) |
| E2 | shadows OFF | full 0.88–1.0 %, plaza-crop **1.37–1.45 %** → flicker persists → shadows not primary |
| E3 | shadow map frozen (`autoUpdate=false`) | full 1.02–1.19 %, plaza 1.41–1.80 % → per-frame shadow re-render not primary |
| E4 | ground+strips → flat unlit grey | full 0.98–1.20 %, plaza 1.47–1.81 % → not texture/material; residual = animated content + depth-order instability |
| E5 | color-coded strips (nearest-centroid, tone-map aware) | **400–552 strip-identity flips per 0.5 s stationary**; transition matrix matches computed overlap pairs |
| E6 | 0.05-unit micro-dolly | 7,742 region-pixel boundary changes → instability amplifies with motion (S4) |

Constraint: SwiftShader software rasterization ≠ Apple GPU TBDR; absolute pixel behavior differs. What transfers: geometry/topology facts (exact coplanarity is device-independent), shader-config facts (r187 PCFSoft→BASIC is source-verified), and contract bugs (heights, sort origins). What does not transfer: MSAA resolve details, aniso caps, real 60 fps pacing — marked for on-device verification.

## 5. Interaction map (why symptoms compound)

- R1 (coplanar tops) × camera damping (`POS_DAMP=6.5` never fully rests): winners re-flip without input → flicker while standing still; walking/orbiting amplifies (E6).
- R1 × R6-UV: overlapped winners sample different cobble densities (up to 9.6×) → flips are high-contrast, not subtle.
- R2 (BASIC stairsteps) × moving sun × animated casters: shadow edges crawl at 0.067–0.195 u/texel across cobble whose mortar is ≈1 shadow texel wide (plaza) → texture-shadow beat produces crawling dark line segments.
- R3 (burial) × strip boundaries: discs pop at plaza/meadow seams during walk cycles — small-object flicker (S3) even where geometry is stable.
- R5 (sort-origin buckets) × yaw orbit: dark disc veils vs water/shells order flips → occasional broad ground darkening.
- ACES tonemapping compresses mid-tones, making flip patches *darker-than-expected* (perceived "dark patches") rather than merely pattern changes.

## 6. Mobile-specific compatibility concerns (WebKit)

1. iOS Safari and iOS Chrome are **both WebKit** — one engine, one conclusion set; do not treat them as independent.
2. Modern iOS (15+) WebGL2 + antialias typically provisions 24-bit depth (as measured in the lab); **on-device DEPTH_BITS telemetry** is added in Phase 4 to close the legacy-16-bit fork permanently.
3. Apple TBDR favors: reduced transparency churn (renderOrder pinning is free), stable shadow-map content, aniso cap 8 (bandwidth), avoiding logdepth (per-fragment cost).
4. dpr cap 2 (on dpr-3 phones) is a deliberate perf trade — retained (raising to 3 costs 2.25× fragment work — rejected).
5. SwiftShader path (`isSoftwareGl`) is unaffected: shadows are already disabled there, and all fixes are geometry-level (help both paths) or guarded.

## 7. Suspected but unconfirmed / ruled-out ledger

| Hypothesis | Status |
| --- | --- |
| Coplanar strip tops z-fight | **CONFIRMED (primary)** — static math + runtime flips |
| destRing coplanar with strip tops | **CONFIRMED** — exact arithmetic |
| Ground-height contract burial (discs/rings/dust) | **CONFIRMED** — code; occlusion is deterministic |
| PCFSoft → BASIC fallback (r187) | **CONFIRMED** — installed-source verified |
| Per-frame unsnapped sun → crawling shadow edges | **CONFIRMED mechanism, secondary** (runtime-weighted) |
| Transparent bucket sort-origin flips | **PROBABLE** |
| Fountain basin ring/water sort shimmer | **PROBABLE** (basin-only) |
| MSAA glancing-edge shimmer on thin debris/discs | **PROBABLE** contributor to S3 |
| Shadow-frustum district pops (Sorrel near-clip, Foxglove across-track, grove truncation) | **CONFIRMED, peripheral** |
| RoughnessMap 20-vs-40 course misalignment | **CONFIRMED** |
| UV density 9.6× inconsistency | **CONFIRMED** |
| Texture minification shimmer (mortar/dots) | **CONFIRMED** (shimmer, not patches) |
| Depth-buffer precision (24-bit) | **RULED OUT** (math + measured DEPTH_BITS) |
| Logarithmic depth justification | **RULED OUT** |
| near/far tightening as fix | **RULED OUT** (no benefit; far-clip risk) |
| Shadow acne on ground/cobble | **RULED OUT** (receivers don't cast) |
| Instanced-mesh culling pops | **RULED OUT** (r187 instance-union spheres) |
| Per-frame material/season mutation flicker | **RULED OUT** (season-gated) |
| mediump/precision banding in shaders | **RULED OUT** |
| Tone-mapping/exposure instability | **RULED OUT** (static config) |
| Interior floor decks as plaza artifact source | **RULED OUT** (hidden outdoors) |
| Old-WebKit 16-bit depth devices | **UNCONFIRMED** — device telemetry added |

## 8. Proposed corrective architecture

Design rationale, alternatives considered, and trade-offs are detailed in `mobile-floor-flickering-correction-design.md` (Phase 3 companion). Summary of the coherent solution — *one unified walk-surface, one truthful ground contract, one honest shadow filter, one deterministic transparent order*:

1. **G1 — Unified cobble network geometry** (fixes R1 + R6-UV): replace the 8 overlapping boxes with a single merged walk-surface built from the exact-axis rectangle union (grid decomposition at rect boundary cuts; one top face per pixel at y=+0.05; skirt walls only at the true network boundary; **world-aligned UVs** at the plaza's authored density → constant stone size everywhere). One draw call, fewer vertices, zero coplanar pairs, zero seams.
2. **G2 — Ground-truth contract** (fixes R3 + R4): export the strip rectangles as the single source of truth in the game layer; `getGroundHeightAt` returns the authored 0.05 slab height inside the network (smooth 0.3 u ramp at boundaries); scene consumes the same table for the merged surface. Avatar discs/rings/dust/destRing ride the true surface (`destRing` at `ground+0.012`).
3. **G3 — Contact-disc rescue at flush time** (completes R3): the static contact-shadow batch lifts any disc whose baked world Y is below the game ground height to `ground+0.012` — **exterior buckets only** (interior rigs live at scene origin inside the plaza rect; their ground is the interior floor deck — adversarial-review finding).
4. **S1 — Honest shadow filter**: `shadowMap.type = PCFShadowMap` + `sunLight.shadow.radius ≈ 2.5` (restores the soft edge PCFSoft promised; 5-tap Vogel disk; storybook identity preserved/restored).
5. **S2 — Shadow-camera stability & coverage**: light-space position snapping (texel-aligned target-relative translation; distance-preserving; mirrors three's `updateMatrices` basis) and `shadow.camera.far 85→95` + dusk sun-height floor `8→10` (fixes Sorrel near-clip; no texel-size cost).
6. **T1 — Render-order pinning for ground-adjacent transparency**: exterior contact-disc buckets & puddles `renderOrder=1`, water `2`, fountain above-water decals & actually-faded occlusion shells `3` (shells reset to 0 on un-fade; interior buckets keep distance sorting) — kills yaw-dependent blend-order flips at zero visual cost.
7. **T2 — Material truth**: `cobbleRoughMap.repeat (4,4)→(8,8)` (restores intended mortar-locked roughness); aniso policy `min(8, maxAniso)` on cobble/meadow.
8. **D1 — Device telemetry**: one-time `DEPTH_BITS` + aniso-max log into perfProbe (closes the 16-bit fork with data).

Explicitly rejected: logarithmic depth buffer; near/far tightening; arbitrary global Y-offsets ("+0.02 and pray"); polygonOffset stopgaps (obsoleted by G1); disabling shadows/particles/AA; blanket material swaps; per-strip material clones with offset textures (+11 MB GPU).

## 9. Expected performance implications

- G1: −7 draw calls on the cobble network, fewer vertices, and — most importantly — **no duplicated fragment rasterization** in overlap zones (previously ~98 m² drawn 2–3×).
- S1: 5 shadow-map fetches per receiving fragment (PCF vs 1-tap BASIC) ≈ negligible on Apple TBDR; SwiftShader path untouched (shadows off).
- S2: same shadow-map size/resolution; snapping removes continuous re-blend churn; far 95 extends depth range cost-free.
- T1/T2/D1: zero or negligible (state changes only, one-time logs).
- Net: equal or better frame time on mobile, with the flicker eliminated at its mechanism.

## 10. Regression risks & guards

| Risk | Guard |
| --- | --- |
| Cobble look changes (stone size unification) | Plaza keeps the authored density exactly; A/B screenshots at desktop+mobile; VISUAL_IDENTITY review gate |
| Walk-height change (+0.05 on cobble) | Smooth ramp; walkability/nav unchanged (XZ-only); full test suite; interiors exempt (`isInteriorLocation`) so sit/mount heights stay on their floor planes; targeted assertion updates with justification |
| Shadow softening changes identity | radius 2.5 tuned in A/B; every prior screenshot shipped under the degraded 1-tap path, so intent (soft storybook edges) is *restored* |
| Light-space snapping math error | Deterministic unit tests (grid alignment, bounded displacement, distance preservation, degenerate guard) |
| renderOrder reordering side effects | Only transparent-phase draws affected; interior buckets excluded (greenhouse glass layering); water depthWrite unchanged |
| Contact-disc lift touching pond/water discs | Lift rule only raises *buried* discs (`worldY < groundHeight`) and only for exterior buckets; pond family untouched |
| Merged-geometry UV seam artifacts | Shared boundary vertices; POT texture + RepeatWrapping; skirt normals outward; unit tests on weld integrity |

## 11. Verification plan (executed in Phases 5–7)

Type-check (`npm run lint`), unit tests (`npm test`, incl. new geometry/contract tests), production build (`npm run build`), headless live checks at 1440×900 and 390×844 with zero console errors, runtime re-run of the probe battery, perf comparison via `__LS_PERF__`, desktop-vs-mobile A/B. Real-iOS verification remains explicitly **not claimable** from this sandbox — device-limited conclusions are documented above.

## 12. Verification addendum (Phases 5–7, executed)

**Implementation**: `fix/mobile-floor-flickering` — root-cause fixes + adversarial-review corrections, then re-established on the advanced mainline (`7998145`, PR #22/#23) after a sandbox recycle wiped the original local commits; all changes re-applied from the verified record with zero source overlap in mission-touched files (`git diff --stat 56ea1be..origin/main` = WORKLOG/HANDOVER only). Rationale in `mobile-floor-flickering-correction-design.md`; record in `WORKLOG.md` Entry 071; as-built contract in `HANDOVER.md` §11.

**Automated gates**: `tsc --noEmit` clean · **722/722 tests** (15 net new from this mission; the count also includes the NPC PRs' new suites on the advanced base) · production `vite build` clean · headless live sessions 0 console errors / 0 page errors at 1280×577 and 390×844.

**Runtime re-verification (forced-hardware path, SwiftShader, lab campaign on the identical code)**:
- Live config: `shadowMap.type = PCF (1)`, `radius 2.5`, `far 95`, DEPTH_BITS 24 · 17 exterior contact buckets at renderOrder 1, 4 interior buckets at renderOrder 0 (scoped correctly).
- Reviewer repro re-run: interior disc worldY **0.0180** / renderOrder 0 (authored placement preserved); exterior plaza disc **0.0620** (= 0.05 + 0.012) / renderOrder 1 (rescued).
- Scene census (state-independent): meshes **4248 → 4241** (8 cobble boxes → 1 union mesh), triangles +0.16 % (union 434 tris vs 96 box tris + state noise), instanced/points/sprites identical.
- A/B identity captures at pinned save state (desktop + mobile): composition, palette, HUD, NPC schedules identical; lane stone density normalized to the plaza reference (audited defect, intended); character contact shadows now render on cobble (were permanently buried).
- Honest limitation: SwiftShader frame times under the forced-hardware path (PCF + MSAA in software) reach seconds, so 500 ms-cadence same-pose screenshot pairs alias to identical frames — post-fix *pixel-diff* deltas are therefore not measurable in this lab. The flicker-elimination claim rests on (a) the mechanism being structurally removed — the merged surface yields exactly one top fragment per pixel, proven by the no-coplanar unit test over a dense sample grid — and (b) the pre-fix runtime census (400–552 flips/0.5 s) having no possible post-fix analogue. On-device measurement remains an external-hardware item.

**Performance audit (SwiftShader counters; real-GPU timing external)**:
| Metric | Baseline `56ea1be` | Fixed | Verdict |
| --- | --- | --- | --- |
| Scene meshes | 4248 | 4241 | −7 (union mesh) |
| Scene triangles | 617,953 | 618,967 | +0.16 % (union 434 tris; state noise dominates) |
| Instanced meshes / points / sprites | 65 / 5 / 26 | 65 / 5 / 26 | unchanged |
| Shader programs | 84 | 49 | −35 (fewer compiled variants) |
| Draw calls (view-dependent sample) | 2250 | 2651 | view/noise-dominated — census is authoritative |
| SwiftShader frame time | ~2.7–3.0 s | ~3.1–14 s | software-only cost of PCF+MSAA; not a mobile-GPU predictor (A-series executes PCF taps in hardware) |

**Definition-of-done status**: root cause established (R1 primary, R2/R3/R4/R5/R6 with evidence ledger) ✓ · confirmed causes corrected ✓ · cobble renders from a single-fragment-per-pixel surface ✓ · camera movement can no longer flip coplanar winners (none exist) ✓ · small objects ground-consistent (contract + rescue) ✓ · shadows/particles/environment functional and softened ✓ · desktop + mobile renders verified ✓ · automated gates pass ✓ · remaining device-specific limitations documented (real-iOS verification, Foxglove peripheral frustum exit, ≥3 mm decal margins on 16-bit-legacy devices) ✓.
