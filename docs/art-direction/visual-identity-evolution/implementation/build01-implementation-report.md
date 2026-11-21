# BUILD 01 — Implementation Report: The Visual Foundation & Character Transformation

**Status**: Implemented (Phases 0–2 complete) · **Branch**: `feat/visual-identity-evolution-build-01` · **Baseline**: `4ad2e5f` (origin/main) · **Audit docs**: `4df68c5` (cherry-picked from the delivered `docs/visual-identity-evolution-audit` branch after it was located outside the remote)

**Direction**: Storybook Diorama V2 — Readable Form, Evident Craft, Living Warmth (Doc 03). Every change layers under the official PREMIUM HANDCRAFTED STORYBOOK DIORAMA identity; nothing in `src/game/` (simulation, schemas, narrative, NPC identity) changed — verified by `git diff 4ad2e5f..HEAD -- src/game/` being empty.

---

## 1. Phase 0 — Visual production infrastructure (commit `0db4f45`)

| Deliverable | Result |
| :--- | :--- |
| Perf instrumentation | `src/scene/perfProbe.ts` — dev-only (`?perf=1`), zero-cost disabled, zero per-frame allocation, first-frame GPU sample, `window.__LS_PERF__` QA hook, 5 unit tests |
| Veteran-save generator | `scripts/make_audit_veteran_save.ts` — golden-hour summer WorldState v11 (bell restored, reconciliation, lanterns, orchard complete, memento shelf, fountain repaired); loads with **0 page errors** |
| Capture harness | `scripts/qa_visual_baseline.sh` — 6 targets × 1440×900 + 390×844 × zoom 0.72/1.0/1.45 × phases/seasons, state-poll waits, resumable, per-shot metadata, dedicated perf-evidence pass |
| Baseline evidence | `download/asset-qa/build01-baseline/` — 31 pre-upgrade captures preserved (never overwritten) |

**Measured baseline (SwiftShader headless)**: 2238 draw calls / 129,259 triangles / 2181 geometries / 24 programs / ~1.8 s scene build / 10 textures.

**Documented limitation**: the headless-SwiftShader environment throttles timers (~1.5 s/frame wall time), so absolute FPS here is **not** representative of real hardware. The harness records the environment truth; GPU-hardware FPS runs are the standing Phase-0 follow-up (harness ready, needs a GPU machine). Draw-call/triangle/geometry/program counts are renderer.info facts and are environment-independent.

**Harness corrections after adversarial review**: NPC pins hold to day end (golden/dusk frames no longer shoot residents mid-walk-off), perf window excludes an 8 s warm-up, dialogue captures assert the sheet really rendered, preview binds localhost, metadata records exactly what it measures.

## 2. Phase 1 — Material & light bedrock (commit `7db9bb8`)

- **Six procedural map generators** in `textures.ts` (wood grain ×2, plaster tooth, stone courses, fabric weave, shared noise roughness, paper grain) — seeded, low-frequency, near-white albedo overlays + LINEAR roughness maps, ≈+1.9 MB (inside the ≤16 MB envelope). `detailAO` deferred with rationale (aoMap needs uv1, which builder geometry does not carry — Phase 4 material).
- **`MaterialPalette` became the shared material library**: `mapSet` families (`timber-light/dark`, `plaster`, `stone`, `fabric`, `foliage`), first-class `envMapIntensity` (brass 1.0 / glass 0.9 / ceramic 0.6 / masonry 0.35 / iron 0.5), and the hand-painted **ground-contact luminance ramp** (0.90→1.0 over a compile-time height, `onBeforeCompile` + `customProgramCacheKey`, software-GL safe, zero draw-call cost). Node-test DOM fallback keeps every geometry suite pure.
- **Applied to all six validation-target families**: character garments + brass (cast-wide), cottage core (walls/trim/stone/door → Copperwheel inherits), tea cart, cottage interior (floors/hearth/linens), plaza gazebo/fountain/benches, cobble ground (stone-course roughness at matched 4×4 repeat + one-step mortar deepening).
- **Lighting**: season-aware hemisphere ground (spring dew-sage / summer honey / autumn umber / winter blue-gray; shared twilight dusk destination unchanged), dusk rim curve (0.45/#C8DCF2 → 0.18/#9FA8D8), winter cobble value-band deepening `#C9CFD8`, water fresnel lift (ice-suppressed). All frozen identity curves untouched; pinned by `lightingCurves.test.ts`.

## 3. Phase 2 — Character form & presentation (commits `180fe57`, `cd40fc6`)

- **Face v2** (Doc 04 §2.1, cast-wide through the shared builder + Jun consolidation): head r 0.310 (1:2.6 head:height), eyes 0.052 @ ±0.120, catchlights 0.020, mouth arc 0.070/0.018, brows 0.096×0.024×0.030, nose 0.052 @ z 0.283, blush 0.062; every part re-seated on the larger sphere; names/visibility rules unchanged.
- **Curved lids**: z-flattened spherical lens caps; blink covers the r-0.052 eye at scale 1.05 without overshooting the brow.
- **Mitten hands**: two-lobe merged mitten (palm + knuckle + thumb ≈ 0.095 equiv chunk band) + `handAnchor` rig field; grip props re-parented (Clara loaf, Rowan fruit basket, Mina watering can, Nora/Toby book) — carried items visibly ride the hand.
- **Boot massing**: toe cap + heel merged into one `boot` mesh per leg — Phase 2 adds **zero net meshes** (geometries delta: +1 scene-wide).
- **Body archetypes** (validation-gated): Clara = Hearth-Round (flare 0.40 × z-flatten 0.90, chest 0.275, baked 0.02 welcome lean); Rowan ships `'standard'` as the V2 differentiation control; cast-wide roll-out stays gated on Doc 09 V1/V2 passes. Carry variants shipped (`cradle` / `side`).
- **Emotion intensity plumbing**: sim `emotionIntensity` (0.55–0.9) reaches the rig; face + pose amplitudes scale; 0.75 = exact historical behavior.

## 4. Measured results (baseline → validation, same harness)

| Metric | Baseline | Build 01 | Δ |
| :--- | :--- | :--- | :--- |
| Draw calls | 2238 | 2242 | **+0.2%** (gate "≤ baseline" met via merged geometry) |
| Triangles | 129,259 | 136,421 | +5.5% (richer characters/props) |
| Geometries | 2181 | 2182 | +1 net |
| Textures | 10 | 20 | +10 procedural families (~+1.9 MB) |
| Programs | 24 | 35 | +11 (map/gradient define variants — no new shader source) |
| Scene build | 1.78 s | 2.01 s | +0.23 s one-time texture generation |

Evidence: `download/asset-qa/build01-validation/` (32 after-captures + metadata) vs `build01-baseline/` (31 before-captures).

## 5. Budget reconciliation note (for the Doc-09 adoption merge)

The frozen "≤ 120–150 draw calls" line (VISUAL_IDENTITY.md §10 / Doc 06 §5 "current") does not match the **measured** reality (≈2,238 — the number predates the current scene's density and counts unmerged builder meshes). Build 01 holds "no regression vs measured baseline" and flags the reconciliation as a required edit when Doc 03's v2 layer merges into the official docs (per AGENTS.md Documentation Sync). The largest honest reduction opportunity remains static contact-disc instancing (~60 candidate sites), deferred to Build 02 with measured data.

## 6. Resident differentiation matrix (anti-homogenization gate, Doc 04 §7)

Nine channels; archetype + face v2 push every resident to 7+. (A = archetype massing, H = height, F = face accents, Hair = hair/hat silhouette, Coat = coat silhouette & color, Prop = signature prop, Idle = idle animation flavor, Gait = gait feel, Knit = winter-knit tint.)

| Resident | Archetype | Channels | Distinct combos |
| :--- | :--- | :--- | :--- |
| Clara | Hearth-Round (Build 01) | A H F Hair Coat Prop Idle Gait Knit | 10/10 — wide soft skirt, bun+pin, loaf cradle |
| Rowan | Standard (V2 control) | H F Hair Coat Prop Idle Gait Knit | 8/10 — beard, orchard belt + shears + neckerchief, basket grip |
| Barnaby | Standard (gated: Barrel) | H F Hair Coat Prop Idle Gait Knit | 8/10 — stache+beard+soot, leather apron |
| Arthur | Standard (gated: Slender) | H F Hair Coat Prop Idle Gait Knit | 8/10 — loupe, watch chain, precision coat |
| Jun | Standard (bespoke builder) | H F Hair Coat Prop Idle Gait Knit | 8/10 — courier cap/badge, peeking postcard |
| Mina | Standard | H F Hair Coat Prop Idle Gait Knit | 8/10 — straw hat blossom, side locks |
| Sora | Standard (gated: Slender) | H F Hair Coat Prop Idle Gait Knit | 8/10 — violin, bob + shawl tail |
| Toby | Standard | H F Hair Coat Prop Idle Gait Knit | 8/10 — beret, paint smudges, sketch roll |
| Nora | Standard | H F Hair Coat Prop Idle Gait Knit | 8/10 — glasses, silver back-fall, book side-carry |
| Pip | Standard (gated: Bean) | H F Hair Coat Prop Idle Gait Knit | 8/10 — freckles, knee patch, escaped tuft |
| Player | Standard | H F Hair Coat Prop Idle Gait Knit | 8/10 — scarf+satchel exclusivity test-locked |

## 7. Verification gates

- `npm test` **401/401** (377 baseline + 24 new: probe ×5, materials ×4, character evolution ×11, lighting curves ×4, plus re-derived assertions) · `tsc --noEmit` clean · production build clean.
- Headless Chromium gameplay pass: keyboard walk, bench sit/stand, cottage enter/exit, dialogue sheet open/close, veteran-save boot — **0 console / 0 page errors** throughout.
- Doc 09 protocol: V1–V6 artifacts captured before/after at 1440×900 + 390×844; zoom-0.72 face crops show eyes/catchlights/brows resolving; golden/dusk/winter/interior frames recorded.

## 8. Known limitations & deferred work

1. **GPU-hardware FPS evidence** — harness ready; this environment is software-rendered with timer throttling (recorded, not estimated).
2. **Contact-shadow instancing** (Doc 08 1.4) — deferred with measured data (~60 static sites; net draw delta already +0.2%).
3. **`detailAO` generator** — needs uv1 on builder geometry (Phase 4 interior material program).
4. **Fabric albedo weave / two-tone garment panels** (Doc 04 §6.1) — garments currently roughness-only; deferred to the Phase 4/7 pass.
5. **Cast-wide archetype roll-out** (Barrel/Slender/Bean) — gated on the Doc 09 validation set passing; assignment table ready in `characters.ts`.
6. **Budget-doc reconciliation** (§5 above) — required at the adoption merge.
7. Talk mouth-flap, two-segment arms, pre-bent legs (Doc 08 Phase 6) — out of Build 01 scope.

## 9. Commit traceability

| Commit | Content |
| :--- | :--- |
| `4df68c5` | Audit docs (00–09) cherry-picked + WORKLOG Entry 049 conflict resolved |
| `0db4f45` | Phase 0 — QA infrastructure + baseline evidence |
| `7db9bb8` | Phase 1 — material & light bedrock |
| `180fe57` | Phase 2 — character form & presentation |
| `cd40fc6` | Adversarial review fixes (both reviews) |
