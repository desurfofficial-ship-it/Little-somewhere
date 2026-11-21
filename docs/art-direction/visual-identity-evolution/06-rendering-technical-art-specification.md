# 06 — Rendering & Technical Art Specification

**Scope**: how the v2 look is carried by the *existing* pipeline — Three.js 0.187, ACESFilmic + `MeshStandardMaterial` + procedural `CanvasTexture` + `onBeforeCompile` water + PMREM `RoomEnvironment`, no post-processing, mobile-first with a software-WebGL degradation ladder (`NeighborhoodCanvas.tsx:385-411,422-427,1541-1564`; `AGENTS.md` §3). Every change below is chosen to be implementable **without new dependencies** and without violating `AGENTS.md` layer boundaries.

---

## 1. Principles

1. **No post-processing, ever** (within this direction). Richness comes from calibrated albedo, roughness maps, emissive choreography and light curves — the repo's current strength and the correct mobile strategy (Doc 01 §4.6.6). Any proposal requiring `EffectComposer` is rejected by default.
2. **Software-WebGL parity is non-negotiable**: scene *content* never changes under `isSoftwareGl` (`AGENTS.md:79`); only DPR/AA/shadows/particle caps/compile differ (existing ladder, `NeighborhoodCanvas.tsx:397-405,1491-1494,1541-1564`). Maps must therefore be legible *without* dynamic shadows (contact discs already guarantee this).
3. **Maps are cheap, scalar uniformity is expensive (visually)**: the biggest look-per-byte win available is 128–256 px procedural roughness/albedo detail maps; all can ship inside the existing ~16 MB texture envelope (current usage ≈ 5–6 MB incl. PMREM — Doc 01 §4.5).
4. **Zero-GC discipline preserved**: no new per-frame allocations; new curves live in `EnvironmentVisualController`'s pre-allocated Color/Vector scratch pattern (`environmentRenderer.ts:17-39`).

## 2. Material & shader improvements

### 2.1 Procedural map program (new generators in `textures.ts`, same seeded pattern)

| Generator | Size | Channels | Applied to |
| :--- | :--- | :--- | :--- |
| `createWoodGrainTexture` ×2 (light/dark) | 256² | albedo overlay + roughnessMap | timber trim, furniture, floors, docks, shingle under-tone |
| `createPlasterToothTexture` | 256² | albedo overlay + roughnessMap | wall masses, interior plaster |
| `createStoneCourseTexture` (cobble/brick) | 256² | roughnessMap (+ albedo tint) | cobble lanes, plinths, brick hearth/oven |
| `createFabricWeaveTexture` (knit/linen) | 128² | roughnessMap | quilts, runners, cushions, garments (characters optional) |
| `createNoiseRoughnessTexture` | 128² | roughnessMap (shared) | T1–T3 families as a universal subtle break-up |
| `createPaperGrainTexture` | 128² | albedo overlay | ledgers, almanac, UI (optional) |
| `createDetailAOTexture` | 128² | aoMap (MeshStandard supports `aoMap` via uv1 — the ground already uses uv1 for lightMap, `NeighborhoodCanvas.tsx:486-488`) | hero furniture, benches, stations |

**Budget impact**: ≈ +1.0–1.4 MB GPU total (7 textures ≤ 256² RGBA + mips) — inside envelope. **Draw-call impact**: zero (maps ride existing materials; shared via the `MaterialPalette` cache — the cache key must extend to include map identity).

### 2.2 Shader-level notes

- No new shader programs are required for maps (`MeshStandardMaterial.map/roughnessMap/aoMap` are built-in).
- **Roughness-led material story** (Supercell doctrine, Doc 02 §1.1.3): mortar darker/rougher than stone faces; grain direction modulates roughness ±0.08; weave roughness higher than fabric base — subtle, readable under ACES.
- **Per-material `envMapIntensity`** becomes a first-class palette field (currently unused repo-wide): brass 1.0, glass 0.9, ceramics 0.6, masonry 0.35, foliage 0.2 — sharpens material identity under the existing `RoomEnvironment` at zero new programs.
- **Water** (keep, extend): add a fresnel term in the existing `color_fragment` injection of `createStorybookPondWaterMaterial` (`waterShaders.ts:106-146`) — view-angle reflectivity lift toward grazing angles; replaces the pond-shape-hardcoded depth read gradually (the analytic `edgeMetric` stays for foam placement). No new program; same uniform driver.

### 2.3 Palette cache evolution

`MaterialPalette.standard()` keys extend to `(color, roughness, metalness, mapSet)`; the 33-hex palette constants are unchanged; window/lantern per-building emissive duplication and per-rig winter knit clones keep their documented exemptions (`buildings.ts:190-206`, `models.ts:88-95`, `winterKnits.test.ts:115-134`).

## 3. Lighting specification

### 3.1 Preserved exactly (identity)

The 4-phase sky/sun/hemi/fog curves, sun orbit, emissive choreography (windows/lanterns/festoons/hearth-truth), weather overlays, interior per-room scripts — all existing curves and values (`environmentRenderer.ts:329-382,243-327`; `NeighborhoodCanvas.tsx:1592-1671`) are frozen as identity references. The Phase-0 capture harness (Doc 08) records them as regression baselines.

### 3.2 Season-aware hemisphere ground (one lerp)

`hemisphereLight.groundColor` joins the season system: spring `#7A8A5E` (dew sage), summer `#8A744E` (honey earth), autumn `#7E5C3E` (umber), winter `#4E5560` (blue-gray hush) — lerped at season change alongside the existing albedo washes (`environmentRenderer.ts:174-192`). Sky color pair and intensity curve unchanged. Cost: zero.

### 3.3 Dusk rim curve (one line)

`rimLight.intensity = lerp(0.45, 0.18, duskFactor)` in the existing per-frame block; rim color shifts `#C8DCF2 → #9FA8D8` at dusk. Closes the twilight flattening (Doc 01 §4.6.1).

### 3.4 Contact-shadow modernization

1. **Instancing**: per-builder contact discs merge into shared instanced batches (the current ~dozens of 1-quad meshes are the largest un-instanced category, Doc 01 §4.6.3). Visual output identical.
2. **Optional sun-azimuth stretch (flag-gated)**: large-structure discs scale ×1.15 offset opposite the sun azimuth at extreme low sun. If capture shows muddiness, ship instancing only.
3. Discs keep `depthWrite: false`, `renderOrder` and existing texture (`textures.ts:199-216`).

### 3.5 Shadow map tuning (careful, flag-gated)

- Keep 1024² PCFSoft; add **sun-target following** (shadow camera target lerps to player XZ clamped ±12) to tighten resolution where the player is; verify no visible swimming in captures. GPU-only (software GL has shadows off already).
- `normalBias 0.025` preserved; bias revisited only if capture shows acne after archetype massing.

### 3.6 Per-phase PMREM regeneration [OPTIONAL SUGGESTION, flag-gated]

Regenerate `scene.environment` at the 4 phase edges with phase-tinted `RoomEnvironment` variants (morning cool-warm, golden amber, dusk indigo, afternoon neutral) — 4 PMREM builds/day, dirty-flag compatible. Expected gain: brass/glass reflections stop being "studio-white" at dusk. **Ship only if** the Phase-1 harness shows no hitching on mid-mobile GPUs; otherwise the scalar `environmentIntensity` approach (0.68→0.15, existing) remains the sole mechanism — acceptable.

## 4. Camera & readability standards

1. Camera rig is identity (28° FOV, offset, damping, zoom clamp, title orbit, dialogue framing, occlusion lift — `NeighborhoodCanvas.tsx:431-440,2313-2376`). No changes.
2. **Readability calibration table** (the design target all visual work validates against):

| Distance | Camera state | Must be readable |
| :--- | :--- | :--- |
| ≈ 47.9 m (zoom 1.45) | survey | district structure; building silhouettes; resident presence |
| ≈ 33 m (zoom 1.0, default) | gameplay | building identities; prop functions; resident archetype + coat + hat; bench/station affordance |
| ≈ 29.7 m (dialogue framing) | conversation | resident emotion via posture + face blocks; prop details of the held item |
| ≈ 23.8 m (zoom 0.72) | close inspection | faces fully; garment trim bands; object signature details |
| interior (zoom 0.56–0.92) | cutaway | furniture identity; station anchors; textile/material reads |

3. **Zoom-floor decision**: 0.72 stays. Close-ups are the UI portraits' job (identity preserved).

## 5. Performance budgets (binding for all visual work)

| Budget | Value (current) | Rule for v2 |
| :--- | :--- | :--- |
| Draw calls | ≤ 120–150 diorama-wide (`VISUAL_IDENTITY.md` §10) | Instanced contact discs *reduce* count; any addition must name its offset |
| Texture memory | ≈ 5–6 MB → target ≤ 16 MB (`VISUAL_AUDIT.md:136`) | Map program adds ≤ 1.4 MB |
| Per-frame allocations | zero in `tick()` (one known exception: `composeEnvironmentState()` object graph — flagged; fix opportunistically) | No new exceptions |
| Instancing | 38 `InstancedMesh` sites | Grove/planter/dressing additions must instance at > 15–20 instances (existing rule) |
| Particle caps | rain 24/48, petals 12/24, fireflies 8/14, butterflies 3/6, bees 2/4, drift 10/20, smoke 3–4/chimney | Unchanged; new FX default to software-GPU split caps |
| District envelopes | orchard ≈ 20 draws; Wilds ≤ 80 (test-enforced) | Preserved |
| Software-GL pacing | `afterDraw` 80 ms schedule; dt clamp 0.05 | Unchanged |

**Telemetry gap to close (Phase 0)**: no GPU FPS metric exists anywhere in the repo (QA is screenshot-based — Doc 01 §5.7). Phase 0 adds a lightweight dev-only overlay/HUD counter (GPU + software runs) so every phase's captures carry FPS evidence. No new dependencies (rAF delta aggregation + throttled console/debug HUD).

## 6. Asset optimization standards

1. **Merging discipline** (existing, extended): static same-material clusters keep using `addMerged` batches; new builders follow `boxAt`/`cylAt` transformed-geometry factories.
2. **Geometry sharing**: planter tufts, mitten hands, archetype torso geometries are module-level singletons; per-resident variation via scale/tint, not new buffers.
3. **Dispose contracts**: every new tracked material/geometry joins existing `dispose()` paths (interior rigs and builder dispose patterns — `orchard.ts:827-835`, `cottageInterior.ts:1851-1858`).
4. **CanvasTexture hygiene**: SRGBColorSpace on albedo, linear for roughness/AO; anisotropy 4 (not max) for new 256² maps; `generateMipmaps` default.

## 7. Rejected techniques (explicit, with reasons)

| Rejected | Why |
| :--- | :--- |
| Post-processing (bloom/SSAO/bloom-LUT) | Mobile + software-GL parity; emissive+halo already delivers cozy glow (Doc 01 §4.6.6) |
| Real-time shadowed point lights indoors | PointLights are shadowless by design; interior mood already achieved by scripts + emissives |
| Normal maps everywhere | GPU/memory cost vs. bevel geometry alternative; only cobble/brick courses may use them, if at all |
| Cloth simulation | Sculpted drape geometry achieves the read at zero runtime cost |
| Bone-based skeletal animation library (e.g. GPU instanced skinning) | Existing joint-hierarchy + damped targets is proven, test-locked, zero-GC; does not need replacement (Doc 04 §8) |
| New runtime dependencies | Forbidden without explicit approval (`AGENTS.md` boundary; brief §13) |
| Dynamic resolution / LOD system | Budgets are met by construction; LOD adds complexity the diorama scale doesn't need |

## 8. Acceptance gates (technical)

1. `npm test` green (all scene contracts, envelopes, seasonal clearance law).
2. `npm run lint` + `npm run build` clean.
3. Headless-Chromium captures at 1440×900 and 390×844 with **0 console errors**, across all 4 phases + 4 seasons (existing QA pattern, `HANDOVER.md:67-155`).
4. Software-GL run: content-identical screenshots (excluding AA/shadow differences), 0 errors.
5. FPS evidence attached per phase (new dev counter): GPU ≥ 60 on reference laptop; software-GL unchanged (~8–12 FPS ceiling by design).
6. Draw calls ≤ budget; texture memory ≤ 16 MB; zero new per-frame allocations.
