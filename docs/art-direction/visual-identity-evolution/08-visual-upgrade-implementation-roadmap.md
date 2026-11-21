# 08 — Visual Upgrade Implementation Roadmap

**Scope**: dependency-ordered phases implementing Docs 03–07, with priorities, asset registers, technical dependencies, risks, and acceptance criteria. **Rules of engagement**: gameplay code untouched; simulation untouched; schemas untouched; no new dependencies; every phase ships behind the existing QA gates (`AGENTS.md` §4) and keeps `npm test` green. Phases 1 and 2 can run **in parallel tracks** after Phase 0 (they touch disjoint files); later phases converge.

**Effort scale**: S = single focused pass (≤1 working session), M = multi-part pass, L = program-level (multiple passes).

---

## Phase 0 — Foundations & Baselines (no visual change) · Effort S · PRIORITY P0

| Item | Detail |
| :--- | :--- |
| 0.1 Capture harness extension | Extend the existing QA script pattern (`scripts/qa_pass26.sh` style) into a repeatable matrix: 1440×900 + 390×844 × 4 phases × 4 seasons × 3 zooms (0.72/1.0/1.45) + interior set + dialogue framing; store under `download/asset-qa/audit-baseline/` |
| 0.2 FPS/dev counter | Lightweight dev-only rAF delta counter (GPU + software runs) — closes the telemetry gap (Doc 06 §5) |
| 0.3 Veteran-save generator | `scripts/make_audit_veteran_save.ts` (pattern of `make_build9_save.ts`): full flags/sideFlags/counters for full-progress captures (Doc 07 §7.4) |
| 0.4 Baseline registration | Record current curves/values as regression baselines (Doc 06 §3.1) |

**Accept**: harness runs 0 console errors; baselines committed; veteran save loads clean under `npm test`.

## Phase 1 — Material & Light Bedrock (parallel track A) · Effort M · PRIORITY P1

*Everything else inherits this phase's quality; it touches `textures.ts`, `materials.ts`, `environmentRenderer.ts` only.*

| Item | Detail | Pri |
| :--- | :--- | :--- |
| 1.1 Procedural map program | 7 generators (Doc 06 §2.1); apply to exterior timber/plaster/cobble first | P1 |
| 1.2 Palette cache map support | Cache key + `envMapIntensity` field (Doc 06 §2.2) | P1 |
| 1.3 Season-aware hemi ground + dusk rim curve | Doc 06 §3.2–3.3 | P1 |
| 1.4 Contact-shadow instancing | Doc 06 §3.4 (visual-identical perf win) | P1 |
| 1.5 Water fresnel term | Doc 06 §2.2 water note | P2 |
| 1.6 Winter ground value recalibration | Deepen winter cobble/mortar values (Doc 03 §2.2; QA `plaza_winter_residents_a.png` evidence) | P2 |
| 1.7 Per-phase PMREM [flag-gated, optional] | Doc 06 §3.6 — ship only if harness clean | P3 |

**Dependencies**: none after Phase 0. **Risks**: ACES interplay of maps (mitigate: calibrated test scene + 4-phase captures); shadow-map interplay with new roughness (mitigate: normalBias preserved, capture check).

**Accept**: 4-phase/4-season matrix captures show material separation reads at zoom 0.72; FPS unchanged on GPU and software; draw calls ≤ baseline (instancing should reduce); all suites green.

## Phase 2 — Character Form Overhaul (parallel track B) · Effort L · PRIORITY P1

*The brief's highest priority. Touches `characters.ts`, `willowLaneDiorama.ts` (Jun sync), `models.ts` rig fields, tests' re-derived constants.*

| Item | Detail | Pri |
| :--- | :--- | :--- |
| 2.1 Face v2 scales | Eye/catchlight/mouth/brow/nose/blush sizes + curved lids (Doc 04 §2.1, §5.1) | P1 |
| 2.2 Mitten hands + `handAnchor` | Doc 04 §4; re-parent grip props | P1 |
| 2.3 Body archetypes | 5 archetypes; cast assignment (Doc 04 §3); envelope/seated constants re-derived **with documented deltas** | P1 |
| 2.4 Emotion intensity plumbing | `emotionIntensity` → rig options; amplitude scaling (Doc 04 §5.2) | P2 |
| 2.5 Jun builder consolidation | Jun consumes shared face/head v2 path (Doc 01 §4.1.11) | P2 |
| 2.6 Carry variants | cradle / side / two-hand (Doc 04 §4.4) | P2 |
| 2.7 Boot massing | toe cap + heel (Doc 04 §2.1) | P3 |

**Dependencies**: none after Phase 0 (materials from Phase 1 can layer in later). **Risks**: silhouette-envelope & seated-clearance regressions (mitigate: re-derive constants + Doc 09 V1/V2 gates before cast-wide application — **Clara & Rowan first, then the cast**); uncanny valley (mitigate: anti-cartoonish guardrails Doc 04 §8.3; validation review); test churn (mitigate: additive named parts, renames forbidden).

**Accept**: Doc 09 V1 (Clara) + V2 (Rowan) pass all readability rows; `residentIdentity/playerAvatar/residentFeel/winterKnits` suites green; capture parity in software-GL; cast-wide roll-out only after gates pass.

## Phase 3 — Exterior Micro-Craft · Effort M · PRIORITY P2

| Item | Detail | Pri |
| :--- | :--- | :--- |
| 3.1 Copperwheel building completion | Craft flags + tapered chimney + workshop oriel (massing break) + `seasonLife` porch (Doc 05 §2.2) | P1 |
| 3.2 Tea cart completion | Spoked wheels + scalloped valance (Docstring debt, `landmarks.ts:607-608`) | P1 |
| 3.3 Shared 3-bud planter tufts | Replace 5-dodecahedron template (Doc 05 §2.2) | P2 |
| 3.4 Woodshop ridge dormer | Second-roof-element rule (Doc 05 §2.2) | P2 |
| 3.5 Bevel sweep + rock variants + plinth overlap | Doc 05 §1–2 | P3 |
| 3.6 Street-furniture & vegetation micro-craft | Doc 05 §3.2 + §5.2 registers: carryable grip/wear accents, contoured bench slats + winter wool cushion variant, lamp-glass warm emissive gradient, fountain moss gradient (P2–P3); grove third crown lobe, relational vegetation dressing, spring wildflower spread (P2–P3). *Season-bud canopy tinting is scheduled in Phase 5.3, not here.* | P2/P3 |

**Dependencies**: Phase 1 (materials make craft read). **Risks**: plot-compliance bounds (existing inline tests/comments guard every prop); draw budget (merged batches + instancing keep ≤).

## Phase 4 — Interior Craft · Effort L · PRIORITY P2

| Item | Detail | Pri |
| :--- | :--- | :--- |
| 4.1 Interior texture program | floors/grain/brick courses/plaster tooth/fabric weave/paper grain (Doc 05 §4.2.1) | P1 |
| 4.2 Curved-surface program | pillows, quilts, runners, plates, clock cases (Doc 05 §4.2.2) | P2 |
| 4.3 Kit de-duplication | parameterized kettle/teacup/door/lantern/steam builders with per-room identity (Doc 05 §4.2.3) | P2 |
| 4.4 Copperwheel interior `seasonLife` | the only unseasonal interior (Doc 05 §4.3) | P1 |
| 4.5 Greenhouse camera reconciliation + proxy normalization | Doc 05 §4.4 | P3 |

**Dependencies**: Phase 1 maps; Phase 0 capture matrix for interior zooms. **Risks**: seasonal clearance law & envelope tests (existing suites enforce); zero-GC updates (existing patterns; lint by review).

## Phase 5 — Progression Visuals · Effort M · PRIORITY P2

| Item | Detail | Pri |
| :--- | :--- | :--- |
| 5.1 Storyline world props | 5 props per Doc 07 §5.1 | P2 |
| 5.2 Relationship-tier tokens + keepsake echo | Doc 07 §5.2 | P2 |
| 5.3 Within-season drift | canopy tint lerp + meadow crossfade + sill posies (Doc 07 §5.3) | P2 |
| 5.4 Exploration marks | Doc 07 §5.4 | P3 |
| 5.5 Memento tiers + housekeeping signals | Doc 07 §5.5–5.6 | P3 |

**Dependencies**: Phase 0 veteran save; none else (pure scene-side derivation). **Risks**: fresh-save parity regression (explicit test Doc 07 §7.3); clutter (placement law + restraint review); `cozyLateNightHint` verify-first.

## Phase 6 — Animation Depth · Effort M · PRIORITY P3

| Item | Detail | Pri |
| :--- | :--- | :--- |
| 6.1 Talk mouth-flap | Doc 04 §5.1.2 | P2 |
| 6.2 Two-segment arms (elbows) | Doc 04 §8.2.2 | P3 |
| 6.3 Pre-bent leg geometry | Doc 04 §8.2.3 | P3 |
| 6.4 Hurried gait [OPTIONAL — needs design approval] | Doc 04 §8.2.4 | P3 |

**Dependencies**: Phase 2 (face scales), 2.4 (intensity). **Risks**: stride-sync/test interplay (knees explicitly deferred); damping-budget discipline.

## Phase 7 — UI Iconography & Tactile Polish · Effort M · PRIORITY P2

| Item | Detail | Pri |
| :--- | :--- | :--- |
| 7.1 Token adoption | CSS vars adopted; spacing/elevation/shadow scales; hex literals migrate (Doc 03 §9.1) | P2 |
| 7.2 Bespoke icon family | weather/season/tier/cozy-domain SVGs in storybook voice; lucide stays for functional glyphs (Doc 03 §9.2) | P2 |
| 7.3 Item thumbnails | reuse `SubjectCanvas` for the 25-item catalog (Doc 03 §9.3) | P2 |
| 7.4 Portrait unification | Journal People reuse `PortraitCanvas` (Doc 03 §9.4) | P3 |
| 7.5 A11y floor | focus-visible everywhere; 44px zoom buttons; toast `role="status"`; tone styles ×5; viewport zoom unblock; favicon | P2 |

**Dependencies**: none; parallel-safe. **Risks**: no `backdrop-filter` law (existing); mobile single-row HUD wrap (capture matrix enforces).

## 9. New assets genuinely needed (complete list)

1. 7 procedural map generators, including the shared noise-roughness map (Phase 1) — *procedural, zero external assets*.
2. Mitten-hand geometry + 5 archetype torso parameter sets (Phase 2) — parameters, not files.
3. Workshop oriel, woodshop dormer, spoked wheels, scalloped valance, 3-bud tuft builder, relational vegetation dressing props, bench cushion variant (Phase 3) — small builder additions.
4. 5 storyline world props + tier tokens + exploration marks + memento tiers (Phase 5) — small prop groups.
5. Icon family (SVG, ~15 glyphs) + item thumbnails via existing painter (Phase 7).
6. Nothing else. No new buildings, no new residents, no world changes.

## 10. Risk register (top-level)

| Risk | Likelihood | Mitigation |
| :--- | :--- | :--- |
| Character changes break identity tests / envelopes | Medium | Validation-gated rollout (V1/V2 before cast), re-derived constants documented, additive-only renames ban |
| ACES + maps wash out (winter especially) | Medium | Phase-0 baselines; calibrated capture matrix; value-band recalibration (Doc 03 §2.2) |
| Draw-call/texture budget creep | Low | Named offsets per addition; instancing first; ≤16 MB envelope check in Phase 1 |
| Software-GL divergence | Low | Content parity law enforced by captures; no new programs (maps ride `MeshStandardMaterial`) |
| Progression props clutter lanes/bench volumes | Low | Placement law + existing clearance tests extended |
| Scope drift into gameplay | Low | Phase table is scene/UI-files-only; any sim-side touch (e.g. 6.4) requires explicit design approval |

## 11. Final acceptance criteria (mapping the brief's §14)

| # | Brief criterion | Verified by |
| :--- | :--- | :--- |
| 1 | Remains unmistakably LITTLE SOMEWHERE | Side-by-side baseline vs. upgraded captures; palette/camera/phase curves unchanged (Doc 06 §3.1 frozen) |
| 2–3 | More expressive & recognizable characters; stronger silhouettes | Doc 09 V1/V2 readability rows at 3 zooms; archetype spread visible in plaza captures |
| 4 | Decorative objects gain personality & craftsmanship | Object gate (Doc 03 §8) applied to register items; tea cart/Copperwheel before/after |
| 5 | Buildings more visually distinctive | Second-roof-element rule audit table complete |
| 6 | Polished, intentionally stylized materials | Roughness-tier separation visible at zoom 0.72 (Phase 1 accept) |
| 7 | More appealing lighting | 4-phase × 4-season matrix review; rim/hemi curves |
| 8–9 | Charming coherent environments, interiors & exteriors | Interiors texture/curve program accepts; clearance tests green |
| 10 | No gameplay readability compromise | Interaction-proxy tests; walkability suite; station readability rows in Doc 09 |
| 11 | Performance suitable for target hardware | FPS evidence per phase; budgets (Doc 06 §5); software-GL parity |
| 12 | Direction supports the simulation | Doc 07 derive-only law; zero schema/reducer diffs in PRs |
