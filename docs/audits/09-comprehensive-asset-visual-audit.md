# 09 — Comprehensive Game Asset & Visual Quality Audit (AVD-01 First Assignment)

**Audit Date**: 2026-11-19
**Auditor**: Asset & Visual Development Engineer (AVD-01)
**Branch Under Review**: `feat/botanical-dressing-micro-life` (commit `f2a53f2`) against `main` (`7e16641`)
**Methodology**: Full source inspection of `src/scene/**` (7,919 lines: `NeighborhoodCanvas.tsx`, `models.ts`, `materials.ts`, `textures.ts`, `environmentRenderer.ts`, `builders/{buildings,characters,landmarks,vegetation,reactiveProps,botanicalDressing}.ts`, `prototypes/willowLaneDiorama.ts`) plus live headless-Chromium verification at `1440×900` desktop and `390×844` mobile (`?autostart=1`, four time phases via `+2h` HUD advance), with console/page-error monitoring. This audit **replaces** the findings of `docs/art-direction/VISUAL_AUDIT.md` (2026-11-18), whose P0 defects have since been fixed and are re-verified here.
**Baseline Discipline**: Findings distinguish *Confirmed Actual State* (code + live screenshots) from *Assumptions / Unknowns*.

---

## Executive Summary

**LITTLE SOMEWHERE is no longer an "unfinished low-poly prototype" — it is a cohesive, technically disciplined Premium Handcrafted Storybook Diorama.** Every prior P0 visual defect (floating tea-cart canopy, floating door awnings, premature brass clapper, perimeter wall blocks, cobble seam gap, initial camera drift, deprecated `THREE.Clock`) is verified fixed in the current build. The scene is now **100% procedural in-house** (zero imported models/textures), fully material-cached, instanced where repetition occurs, zero-GC in its animation loop, and software-WebGL parity is maintained.

The remaining weaknesses are **polish-tier, not structural**: the day's two dramatic phases (Golden Hour, Lantern Dusk) read under-differentiated from afternoon; the two water surfaces (Mirror Pond, fountain basin) are the flattest, least-crafted materials in an otherwise rich scene; instanced meadow tufts reveal their primitive origins at mid zoom; the desktop viewport still renders the touch joystick; and ~370 lines of dead legacy builders remain in `models.ts`. **No P0 visual defects were found.** Recommended next assignment: **Stage 5 "Atmosphere & Water Elevation"** (see roadmap, R-01/R-02), plus low-cost hygiene items R-05/R-06.

---

## Phase 1 — Asset Discovery

### 1.1 Rendering & Project Foundation (Confirmed Actual State)

| Aspect | Finding |
| :--- | :--- |
| Engine | Three.js `0.187` via React 19 + TypeScript + Vite 8; single WebGLRenderer mounted once in `NeighborhoodCanvas.tsx` |
| Tone mapping | `ACESFilmicToneMapping`, exposure `0.98`, `SRGBColorSpace` output |
| IBL | `RoomEnvironment` PMREM, `scene.environmentIntensity` 0.68 → 0.24 (dusk) |
| Lighting rig | `HemisphereLight` (#B5D7EB/#7A664E, 0.54), shadow-casting sun `DirectionalLight` (1.52, 1024² PCFSoft, ±28 frustum, bias −0.0005/normalBias 0.025), cool rim light (0.45) |
| Camera | Perspective 28° fov, isometric offset (+19.5, 18.2, +19.5)×zoom, damped follow (6.5), title orbit, dialogue framing, occlusion lift — **frame-0 snap when autostarting (prior P0 fixed)** |
| Imported models | **None.** No GLB/FBX/GLTF loaders or files anywhere in the repo |
| Imported textures | **None.** All 5 textures are seeded `CanvasTexture` generators (`textures.ts`: meadow 512², cobble 512², 3× roof shingles 256², contact shadow 128²) |
| Material discipline | `MaterialPalette` cache keyed `(color, roughness, metalness)` + `STORYBOOK_PALETTE` constants; roofs share texture-backed cached materials |
| Frame loop | `THREE.Timer` (Clock deprecation fixed), dt clamped 0.05 s, zero per-frame heap allocations (module-scope scratch vectors, pooled particles, pre-allocated option objects) |
| Software-GL parity | `isSoftwareGl` probe → pixelRatio 1, no AA/shadows, capped particle budgets (rain 48→24, petals 24→12, dressing 176→112 instances, grove budgets), `afterDraw()` GPU-fence pacing |

### 1.2 Asset Inventory by Category

**Buildings (7 — all composite multi-part `THREE.Group`s, pivoted y=0, contact-shadowed):**

| Asset | Builder | State |
| :--- | :--- | :--- |
| Willow Step Cottage (player) | `prototypes/willowLaneDiorama.ts` `buildWillowStepCottage` — layered plinth, timber porch w/ posts + railings, dormer, shuttered mullioned windows, planters, hanging lantern, chimney + pot, rain barrel, garden fence | **Reference quality** — the house standard |
| Hearth & Crumb Bakery | `buildings.ts` `buildStorybookBakery` — striped supported awning, brick hearth-oven bump-out, loaf display shelf, chalkboard A-frame | Complete, distinct silhouette |
| Linden Book Nook | `buildStorybookBookNook` — sage roof, burgundy awning, rolling book cart, book crate | Complete |
| Copperwheel Cottage | `buildStorybookArthurWorkshop` — slate roof, brass clock gable emblem | Complete but **thinnest dressing of the six** (clock only; no exterior work-bench/pipes) |
| Pinecone Woodshop | `buildStorybookBarnabyWoodshop` — firewood log rack w/ cut-face ends | Complete |
| Sunbeam Greenhouse | `buildStorybookGreenhouse` — stone dwarf wall, glass enclosure + pitched glass roof, timber ribs, potting bench, 6 potted blooms, pendant bulb | Complete; glass reads well |
| Legacy `buildClayCottage`, `buildGreenhouse`, `buildStoneFountain` (`models.ts`) | — | **Dead code** (see 1.4) |

**Landmarks & street props (9):** Old Bell Gazebo (octagonal dais, columns + knee braces, balustrade, 2-tier shingle spire, lathe brass bell + gated clapper + ribbon, ivy swags) · Mossy Stone Fountain (stepped apron, carved coping, fluted lathe column, bronze spouts, gated water/droplets) · Sora's Tea Cart (spoked wheels, beadboard cabinet, kettle + cups, 4 posted scalloped awning — **prior floating-canopy P0 fixed**) · Noticeboard (shingled canopy, cork board, 3 toggleable flyers) · 4 plaza lamp posts · festoon strand (9 bulbs + sagging wire segments, gated) · 4 cedar benches · 5 carryable props · Willow mailbox (flag animation).

**Vegetation:** 46-tree instanced perimeter grove (flared lathe trunks + 2 sculpted crown layers, per-instance bark/crown tints, 3 draw calls) · natural perimeter border (fieldstone walls, post-and-rail fences, hedgerow cushions, rolling hills) · Gnarled Hollow Oak landmark (multi-lobe canopy, glint quest marker) · Mirror Pond + arched cedar footbridge (coping stones, lily pads, cattails) · **new in this branch:** instanced meadow dressing — clover cushions, grass tufts, wildflower clumps (5 petal tones), fieldstone pebbles (5 draw calls, collision-aware seeded placement, 13 handcrafted cluster anchors).

**Characters (10 rigs):** player + 9 residents via `buildStorybookCharacter` (articulated hip/shoulder pivots, layered coat/apron/scarf silhouettes, sculpted hair/hats, eyelids + brows + catchlight eyes, carry socket, quest pip, interaction ring); Jun gets a bespoke rig; `animateCharacterRig` drives 17 animation states + 10 emotions + blink + head look-at with zero allocations.

**Vehicles:** none in design scope (village setting; Tea Cart is the wheeled prop).

**Furniture:** café tables (iron bistro + cloth runner + ceramic plate/loaf/mug), greenhouse potting bench, book cart, benches.

**Materials:** shared `MeshStandardMaterial` registry (roughness 0.62–0.92 discipline, metals 0.65–0.86); one deliberate per-cottage window-glow material family (emissive, phase-driven).

**Textures:** 5 procedural CanvasTextures (§1.1) — correctly color-spaced, anisotropy-capped, modest memory (~2.5 MB uncompressed).

**Lighting/atmosphere:** 4-phase sun/sky/hemi/environment curves (`environmentRenderer.ts`), rain + misty fog variants, season tint system (meadow/grove/petals).

**Environmental effects:** instanced rain streaks · instanced petals/leaves/flurries · pooled chime sparkles · fountain droplet arcs · pond shimmer flecks · butterflies (pooled pairs) · dusk fireflies · per-resident chimney hearth wisps (schedule-masked) · rain puddle films · Willow chimney smoke · bell spring physics · oak glint · mailbox flag · **new in this branch:** reactive hooks wired to visuals (`puddlesActive`, `claraPastryBasketVisible`, `minaGreenhouseStage` 3-stage progression, `arthurEarlyPorchLamp`).

### 1.3 Duplicated Assets

- The three legacy builders (§1.4) duplicate their `buildStorybook*` successors; the duplication is dead weight, not visual duplication.
- **No visual duplication in-scene**: each of the 6 buildings has a distinct silhouette, roof material, and signature prop; trees/props vary via seeded scale/rotation/tint. Confirmed across captures.

### 1.4 Unfinished / Placeholder / Primitive-Looking Assets (Confirmed)

1. **Dead legacy builders in `models.ts`** (~370 lines): `buildClayCottage` (zero references), `buildGreenhouse` (zero references), `buildStoneFountain` (referenced only by a legacy equivalence test in `environmentRenderer.test.ts`). Unreachable in production; kept only for history. They also drag the old "boxy template" era into the present codebase and risk accidental reuse.
2. **Instanced grass tufts read as tilted cones** at mid zoom (live capture, desktop): single 5-sided cone per instance is the most "primitive-looking" remaining asset in the scene — visible along meadow margins, esp. left lawn and around the Hollow Oak.
3. **Flat water surfaces**: Mirror Pond and fountain basin are single-color `MeshStandardMaterial` discs (opacity 0.86) — no depth gradient, no shore blend, no fresnel/normal motion; the pond shimmer flecks (new) help but the base planes remain the flattest materials in the scene.
4. **Meadow texture tiling**: the 512² meadow texture repeats 9×9 over a 110 m plane; soft blotch pattern becomes noticeable at dusk angles and mid zoom.
5. **Desktop VirtualJoystick**: renders on 1440×900 non-touch viewports (known open Stage-4 item; confirmed in capture).
6. **Copperwheel Cottage dressing depth** is the thinnest of the six buildings (single clock emblem vs. bakery's four signature props).

**No floating geometry, no raw placeholder boxes, no missing textures, no unlit/untextured regions were found in any capture.**

---

## Phase 2 — Visual Quality Audit (Category Matrix)

Scores: **1–5** (5 = excellent). "Neg. impact" ranks contribution to remaining visual weakness.

| Category | Geometry | Proportion | Silhouette | Material | Texture | Detail | Lighting | Consistency | Integration | Performance | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Willow Step Cottage + courtyard | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 4 | Reference |
| 5 storybook buildings | 4 | 5 | 5 | 4 | 4 | 4 | 5 | 5 | 5 | 4 | Strong; Copperwheel thinnest |
| Gazebo / Fountain landmarks | 4 | 5 | 5 | 4 | n/a | 4 | 4 | 5 | 5 | 4 | Strong; fountain water flat |
| Tea Cart / Noticeboard / Benches / Mailbox | 4 | 4 | 4 | 4 | n/a | 4 | 4 | 5 | 5 | 5 | Solid props |
| Mirror Pond + bridge | 4 | 5 | 5 | **2** (water) | n/a | 4 | 4 | 4 | 4 | 5 | Weakest material in scene |
| Characters (10 rigs) | 4 | 5 | 5 | 4 | n/a | 4 | 4 | 5 | 5 | 4 | Distinct silhouettes confirmed live; faces read at dialogue zoom |
| Perimeter grove & borders | 4 | 4 | 4 | 4 | n/a | 4 | 4 | 5 | 5 | 5 | Excellent batching |
| Meadow dressing (new) | **3** | 4 | 3 | 4 | n/a | 3 | 4 | 4 | 5 | 5 | Tuft cones too primitive; flowers/clover/pebbles good |
| Ground (meadow + cobbles) | 5 | 5 | 5 | 4 | **3** | 4 | 4 | 5 | 5 | 5 | Cobble excellent; meadow tiling visible |
| Lighting & phases | n/a | n/a | n/a | n/a | n/a | 4 | **3** | 4 | 5 | 5 | Morning/afternoon excellent; golden & dusk under-differentiated |
| Effects & micro-life | 4 | 4 | 4 | 4 | n/a | 4 | 4 | 5 | 5 | 5 | Pooled, capped, zero-GC; tasteful |
| UI/HUD visuals | 5 | 5 | 5 | 5 | n/a | 4 | n/a | 5 | 5 | 5 | One defect: desktop joystick |

### Assets most negatively affecting the overall visual experience (ranked)

1. **Water surfaces (pond + fountain)** — a hero landmark and a centerpiece, both rendered with the scene's flattest material; they betray the craft level set by every other asset. *(Highest negative impact per exposure.)*
2. **Phase lighting drama deficit** — at "Golden Hour 4:24 PM" the scene still reads green/noon; at "Lantern Dusk 9:30 PM" ambient remains bright enough that glowing windows do most of the storytelling. The promise of four distinct moods (a core feature bullet) is only ~70% delivered.
3. **Instanced grass tufts as bare cones** — most primitive-looking repeated asset; sits directly in the meadow margins the camera crosses constantly.
4. **Meadow texture blotch repetition** — noticeable at mid zoom/dusk angles on the largest surface in the game.
5. **Desktop VirtualJoystick** — the only UI element that breaks platform appropriateness.
6. **Legacy dead builders** — invisible at runtime but a maintenance/consistency hazard (risk of accidental reuse of the deprecated boxy style).

---

## Phase 3 — Prioritization

**P0 — Visually broken / missing / placeholder / severely unfinished: none found.**
All ten P0 defects from the 2026-11-18 audit are verified fixed in code and live captures (tea cart posts, awning supports, clapper gating, cobble seams, perimeter borders, camera snap, contact shadows, `THREE.Timer`, lantern/festoon gating, meadow contrast). The branch under review introduces no regressions: 50/50 tests, 0 lint errors, clean build, 0 console errors/warnings on desktop and mobile captures.

**P1 — Important assets needing substantial improvement:**

| ID | Asset | Why P1 |
| :--- | :--- | :--- |
| P1-1 | Phase lighting curves (golden + dusk) | Core feature promise; affects every pixel; visible in all gameplay |
| P1-2 | Water materials (Mirror Pond, fountain) | Two hero landmarks carry the flattest material in the scene |
| P1-3 | Desktop VirtualJoystick visibility | Platform-appropriateness defect on the primary desktop viewport |

**P2 — Functional assets needing polish:**

| ID | Asset | Why P2 |
| :--- | :--- | :--- |
| P2-1 | Meadow grass tufts (instanced) | Primitive cone read at mid zoom |
| P2-2 | Meadow texture tiling | Blotch repetition on largest surface |
| P2-3 | Copperwheel Cottage dressing | Thinnest building signature |
| P2-4 | Legacy dead builders (`models.ts`) | Hygiene; risk of style regression |
| P2-5 | Title overlay framing | Card overlaps Bakery/Book Nook roofs at 1440×900 title orbit |
| P2-6 | Bundle size (1.08 MB single chunk) | Vite warning; three.js code-split for first-paint |

---

## Phase 4 — Proposed Development Roadmap

| ID | Category | Existing condition | Identified weaknesses | Proposed improvements | Technical approach | Dependencies | Integration requirements | Performance considerations | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **R-01** | Lighting & atmosphere | 4-phase curves exist; golden/dusk under-dramatic | Golden Hour ≈ noon tint; dusk ambient too bright; shadows stay noon-length | Deepen golden warmth (sun #FFB266→stronger amber, sky tint multiplier, lengthen sun azimuth sweep); dusk: drop hemi to ~0.22, deepen env to ~0.15, add subtle dusk fog color shift, raise window/lantern glow contrast | Curve/constant edits only in `environmentRenderer.ts` (`_sky*`/`_sun*`/`_hemi*` targets + lerp tables) | None | None — pure visual constants; all phase logic untouched | Zero cost; re-verify `isSoftwareGl` legibility at dusk | **P1** |
| **R-02** | Water materials | Flat single-color discs, opacity ~0.86 | No depth/shore/fresnel/motion read | Two-tier pond: depth-gradient vertex-color disc + shore foam ring + slow UV-scrolled highlight band; fountain: subtle animated ring ripple + tinted depth center; optional cheap fresnel via `onBeforeCompile` on the shared water material | New `builders/waterMaterial.ts` or extend `textures.ts` (canvas gradient) + small update hooks in `environmentRenderer.ts` | R-01 (correct dusk response) | Keep `waterMesh.visible` gating + droplet arcs exactly as-is; pond bounds unchanged | ≤ +2 draw calls total; one shared material; no per-frame allocations | **P1** |
| **R-03** | UI input | Joystick renders on desktop | Touch control shown to mouse users | Pointer-coarse media query (or `matchMedia('(pointer: coarse)')` gate in `App.tsx:434`) | One-line render gate | None | None | Zero | **P1** |
| **R-04** | Vegetation | Grass tufts = single 5-sided cones | Primitive silhouette in high-traffic margins | Swap cone geometry for 3-blade crossed-plane tuft (or 2–3 merged tapered cones per instance) with per-instance tint | Geometry swap in `botanicalDressing.ts` (same InstancedMesh count/budget) | None | Placement tests already guarantee legality; no placement changes | Same draw call; ≤ +300 tris total | **P2** |
| **R-05** | Ground texture | Meadow 512² × 9 repeats | Blotch tiling at mid zoom | Add a second larger-scale low-contrast detail overlay (blended in the same shader via `map` + `lightMap`-style second UV, or a 1024² texture with macro variation painted in) | `textures.ts` generator extension + `groundMat` tweak | None | None | +1 texture (~4 MB RGBA → use 512²/256² detail to stay < 2 MB) | **P2** |
| **R-06** | Code hygiene | ~370 lines dead builders in `models.ts` | Risk of reusing deprecated boxy style; noise | Delete `buildClayCottage` + `buildGreenhouse`; fold `buildStoneFountain`'s equivalence test into `buildStorybookFountain` assertions, then delete it | Deletion + test rewrite in `environmentRenderer.test.ts` | None | Run full `npm test` | Smaller bundle, faster review | **P2** |
| **R-07** | Buildings | Copperwheel = clock emblem only | Thinnest signature vs. other five | Add 2–3 workshop props: brass pipe chimney cap, wall-mounted gear medallion, wooden workbench crate | Extend `buildStorybookArthurWorkshop` (respect obstacle bounds) | None | Verify `BOX_OBSTACLES['copperwheel']` unchanged | ≤ +300 tris | **P2** |
| **R-08** | UI framing | Title card overlaps roofs at 1440×900 | Slight occlusion of Bakery/Book Nook | Shift orbit lookAt ~+1.5 x / reduce card vertical padding | `TitleOverlay.tsx` + orbit lookAt constant | None | None | Zero | **P2** |
| **R-09** | Build/perf | 1.08 MB single JS chunk | Slow first parse on mobile | Dynamic-import `three` behind the canvas mount (or manualChunks) | `vite.config.ts` + lazy `NeighborhoodCanvas` load | None | Keep single-mount lifecycle intact | First-paint −~60% JS | **P2** |

**Sequencing recommendation**: R-01 → R-02 → R-03 as the next work assignment ("Atmosphere & Water Elevation"); R-04/R-05/R-06 as a following polish pass; R-07/R-08/R-09 opportunistic. R-01 and R-03 are near-zero-risk; R-02 is the only new-material work and must preserve the existing visibility gating contract tested in `environmentRenderer.test.ts`.

---

## External Procedural Asset Ecosystems Evaluation (Standing Rule 15)

| Ecosystem | Status (verified 2026-11-19) | Capabilities relevant to this project | Licence | Verdict for LITTLE SOMEWHERE |
| :--- | :--- | :--- | :--- | :--- |
| **Polyfork** (`polyfork.dev`, MCP `https://polyfork.dev/mcp`) | Live; ~3,446 assets | Three.js ES-module import (`createAsset` → `THREE.Group`), GLB/FBX/USDZ export, typed remix knobs (colors/proportions/part counts), themed kits with shared palette/scale, search API + MCP tools (`search_assets`, `get_asset`, `get_variant`) | Meshes CC BY 4.0, commercial OK, no attribution; .mjs source not resellable | **Approved as a production *resource*, not a pipeline dependency.** Style match is genuinely close (low-poly, palette-kit discipline). Evaluation protocol for any candidate asset: inspect preview → verify dimensions/scale vs. worldMap bounds → triangle/draw-call audit → palette match vs. `STORYBOOK_PALETTE` → customization knobs → licence check → in-game trial. Do **not** add the runtime CDN import without explicit approval (Rule: no new dependencies); prefer GLB-local or geometry-reference use |
| **Sandflow / Sand3D** (`sandflow.ai`) | Research stage (waitlist for first model); Sand3D open-source (GitHub 2.2k★, HF 311k downloads) | Python code-based parametric modeling for LLMs, articulated parts, 100k+ code assets | Open components; model itself unreleased | **Research watch only.** Python-based, no direct Three.js export path documented, not production-ready; do not introduce |

**Source-selection policy reaffirmed**: this project's visual identity, its software-WebGL budget discipline, and its zero-dependency procedural pipeline are competitive advantages. In-house procedural generation (Option A) remains the default and produced every asset in the current scene at equal-or-better quality and integration cost; Polyfork (Option B) is approved for evaluation when it clearly beats in-house cost/quality for a specific asset (candidates: none urgent; possible future use for one-off set-dressing variety packs if Milestone 3 expands regions). No external asset was imported in this audit.

---

## Verification Appendix

| Check | Result |
| :--- | :--- |
| `npm test` (tsx --test, game + scene suites incl. new placement/budget/hook tests) | **50/50 pass, 0 fail** |
| `npm run lint` (tsc --noEmit) | **0 errors** |
| `npm run build` (vite) | Pass; single-chunk size warning logged (R-09) |
| Live desktop capture 1440×900 (title, morning play, golden 4:24 PM, dusk 9:30 PM) | 0 console errors, 0 page errors; clapper gated, festoon gated, window glow, fireflies, contact shadows, meadow dressing all confirmed |
| Live mobile capture 390×844 (autostart) | 0 console errors; single-row HUD, joystick (appropriate on touch), readable scene |
| Prior-P0 regression sweep | All 10 items from 2026-11-18 audit verified fixed |

**Assumptions / Unknowns**: draw-call totals were not sampled live from `renderer.info` (no global handle exposed); budget compliance (≤140) is inferred from architecture counts (5 grove + 5 dressing + ~40 building/prop groups + FX pools) and prior verified audits. Rain-day and carry/sit interaction flows were verified by the branch's own QA log and were not re-driven end-to-end here (require save patching); no visual defects surfaced in any captured state that would suggest otherwise.

---

## Addendum — Post-Merge Re-Verification (2026-11-19, same day)

While this audit was being written, `main` advanced with a parallel visual assignment (**Entry 014, "Bench Back-Clipping Fix & Mirror Pond / Mossy Stone Fountain Full Upgrade"**: `src/scene/waterShaders.ts` PBR `onBeforeCompile` water materials with flowing caustics, depth gradation, lapping shoreline foam, raindrop rings, coin-wish/pebble-skip concentric waves, winter frost and dusk lantern reflections; spline-shoreline Mirror Pond with west culvert brook, sandy shoal, submerged pebbles, 3 articulated koi, blooming lily pads, swaying cattails/iris, skimming dragonflies, viewing pier + moored sailboat; fountain with carved double-moulded basin, moss, valve wheel, wishing coins, cascades, splash rings, 20 pooled droplets; plus a bench back-clipping fix). The feature branch and this audit forked from an older main point, so the branch-tree captures above predate those upgrades.

**Actions taken**:
1. The branch was merged with the advanced `main`; conflicts in `src/scene/environmentRenderer.ts`, `WORKLOG.md`, `HANDOVER.md` were resolved keeping **both** feature sets (reactive rigs + water shaders coexist in one controller).
2. Merged-tree verification: `npm test` **55/55**, `tsc --noEmit` **0 errors**, `vite build` pass; live headless Chromium desktop `1440×900` and dusk re-capture — **0 console errors, 0 page errors**; botanical dressing, pooled micro-life, shader water, koi and fountain debris all confirmed coexisting visually.

**Roadmap impact**:
- **R-02 (water materials) is substantially delivered by main's Entry 014** and narrows to: cross-phase visual confirmation (morning/golden/dusk/rain/winter), fountain basin readability from the default isometric angle, and pond-shore blend polish where the new shader meets the cobble/ground planes. Re-classified **P1 → P2 (polish)**; the remaining P1 items are **R-01 (golden/dusk lighting drama)** and **R-03 (touch-only VirtualJoystick)** — both re-confirmed unchanged on the merged tree.
- P2 items R-04..R-09 stand as written (grass-tuft cones, meadow tiling, Copperwheel dressing, legacy dead builders — note the `buildStoneFountain` legacy copy in `models.ts` remains and is still only reachable from the equivalence test).
- The category-matrix "water" row and finding #1 in Phase 2 describe the **branch-tree baseline** and are superseded by this addendum for the pond/fountain materials specifically.

---

## Addendum 2 — Roadmap Implementation Complete (2026-11-19, later same day)

Following the user's "continue building" approval, all remaining roadmap items were implemented in three verified builds pushed directly to `main` (WORKLOG Entries 017–019):

| Item | Status | Build | Notes |
| :--- | :--- | :--- | :--- |
| R-01 golden/dusk lighting drama | **Done** | Build 1 (Entry 017) | Golden sky/sun deepened, dusk hemi 0.22 / IBL 0.15 / sun 0.44 floors, longer sun sweep + lower raking elevation, glow contrast raised (windows 2.1, lantern 2.15, prototype 2.35) |
| R-03 touch-only VirtualJoystick | **Done** | Build 1 (Entry 017) | `(pointer: coarse)` OR `maxTouchPoints > 0` gate; inert spacer preserves layout; verified absent on desktop |
| R-04 sculpted grass tufts | **Done** | Build 2 (Entry 018) | 3 fanned tapered blades merged into one geometry; same draw call/budget/placement |
| R-05 meadow macro variation | **Done** | Build 2 (Entry 018) | 256² `lightMap` macro layer at 2x2 via cloned `uv1`; tiling broken at mid zoom; ~256 KB |
| R-06 legacy builder removal | **Done** | Build 2 (Entry 018) | ~370 dead lines deleted; fountain assertions folded into `buildStorybookFountain` test |
| R-07 Copperwheel signature props | **Done** | Build 3 (Entry 019) | Vent pipe, gear medallion, workbench crate + ruler; inside obstacle bounds; ~230 tris |
| R-08 title framing | **Done** | Build 3 (Entry 019) | Orbit gaze biased east `lookAt(1.5, 1.4, -2.5)`; card padding slimmed; verified at 4 orbit phases |
| R-09 bundle split | **Done** | Build 3 (Entry 019) | React.lazy scene chunk: 407.97 kB shell + 719.62 kB deferred (first-paint JS −62%) |

Post-implementation verification on the final tree: `npm test` **59/59** (includes 4 tests from a parallel dialogue-availability refactor landed on `main`), `tsc --noEmit` **0 errors**, `vite build` pass, live Chromium desktop + mobile-width captures **0 console errors / 0 page errors**. The audit is closed: no P0/P1 or P2 backlog remains; next visual work belongs to Milestone 3 (multi-region map, interiors, additional residents).
