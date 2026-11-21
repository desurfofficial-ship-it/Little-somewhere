# BUILD 04 — LIFE IN MOTION · Implementation Report

**Milestone**: BUILD 04 — Animation Depth (Doc 08 Phase 6) + UI Iconography & Tactile Polish (Doc 08 Phase 7) + identity-mandated ambient motion.
**Branch**: `feat/visual-identity-evolution-build-04` (from `origin/main` `12389ac`, BUILD 03 PR #9 merge).
**Requirements basis**: `build04-01-requirements-audit.md` (Stage 0/1 — verified repo state, baseline re-run, traceability matrix, design lock).
**Companion evidence**: `download/asset-qa/build04-validation/` (14 captures, motion-pixel-diff.json, baseline-perf.jsonl, metadata.jsonl).

---

## 1. Executive summary

BUILD 04 makes LITTLE SOMEWHERE move, speak, and respond with the same craft BUILD 01–03 gave its forms — strictly inside the roadmap's Phase 6–7 scope and the identity doc's own "Subtle Living Motion" mandate, with zero simulation/schema/gameplay changes and no new dependencies.

- **Phase 6 (character animation)**: talk mouth-flap (6.1), two-segment arms with clamped elbows (6.2), and pre-bent leg geometry (6.3) shipped across the whole cast including Jun; 6.4 (hurried gait) **deferred** under its own design-approval gate (Doc 04 §8.2.4 forbids the sim-side constant without approval).
- **Phase 7 (UI)**: the palette became real Tailwind v4 design tokens with a 3-rung elevation scale and a literal-ban regression test (7.1); a bespoke 12-glyph storybook icon family covers weather/season/cozy-domain slots (7.2); all 25 satchel items gained tinted canvas thumbnails reusing the existing `SubjectCanvas` painter (7.3); Journal People cards reuse the procedural `PortraitCanvas` painter (7.4); the a11y floor landed in full (7.5).
- **Ambient motion (AM-1..5)**: shader-driven breeze sway on grove/wilds crowns and meadow tufts, hanging-sign pendulum swings, the lantern-glow dusk-lag **bug fix** with a gentle dusk breathe, and gating invisible exterior work while indoors — all draw-call-neutral by construction.
- **Evidence**: before/after perf on the same save/framing (2304 → 2305 draw calls), committed pixel-diff motion proof (all five frame sequences animate), 14 reviewed captures, 489/489 tests, tsc clean, 0 page errors.
- **Independent adversarial review**: ACCEPT-WITH-FIXES; both MAJOR findings fixed and re-verified (mobile HUD legibility, committed motion measurement), three MINORs fixed, remaining notes documented in §11.

## 2. Scope decisions (see audit doc §1 matrix for the full trace)

| Roadmap item | Decision | Where |
| :--- | :--- | :--- |
| 6.1 talk mouth-flap (P2) | **Shipped** — smile arc scale.y ±25 % @ ~9 Hz during talk/converse, intensity-scaled, uniform scale restored on every non-talk frame | `characters.ts` mouth block |
| 6.2 two-segment arms (P3) | **Shipped** — elbow group under each shoulder pivot; hand/hand-anchor ride it; per-state targets + damping + ±clamp; merged wrist bridge keeps one hand mesh | `makeArm` + Jun mirror |
| 6.3 pre-bent legs (P3) | **Shipped** — vertex-level forward knee arc baked into the pant cylinder (parameters contract intact) + boot rides the bend; heel planted; no new DOF | `makeLeg` + Jun mirror |
| 6.4 hurried gait (P3, OPTIONAL) | **Deferred** — Doc 04 §8.2 Phase D requires a sim-side read-only constant; out of scope by the roadmap's own rules | §11 deferred |
| 7.1 token adoption (P2) | **Shipped** — `@theme` tokens + elevation scale; 411 literals migrated; ban test | `index.css`, 10 components |
| 7.2 bespoke icons (P2) | **Shipped** — 12-glyph storybook family + HUD/satchel deployment; lucide stays functional | `icons.tsx` |
| 7.3 item thumbnails (P2) | **Shipped** — 14 parametric painter scenes tinted per item; satchel + gift picker | `assets.ts`, `DialogueVisuals.tsx` |
| 7.4 portrait unification (P3) | **Shipped** — People cards render `PortraitCanvas`; un-met neighbors keep the initial (mystery preserved) | `JournalDrawer.tsx` |
| 7.5 a11y floor (P2) | **Shipped** — focus-visible floor, toast `role="status"`, 44px zoom buttons, viewport zoom unblocked, favicon + theme-color, safe-area HUD, 5 tone styles | `index.css`, `App.tsx`, `index.html`, `DialogueSheet.tsx` |
| Ambient motion (Workstream C) | **Shipped** AM-1/2/3/4/5 — justified by VISUAL_IDENTITY §7's own mandate, all scene-side | §4 |

## 3. Architecture (what did and did not change)

No new animation engine, no new UI framework, no abstraction layer. Phase 6 extends the existing zero-GC damped-pose driver (`animateCharacterRig`); AM items extend the numbered-section `EnvironmentVisualController` and reuse the sanctioned `waterShaders.ts` `onBeforeCompile` doctrine via the new `src/scene/ambientSway.ts` (userData uniforms bound by reference, stable per-variant program cache keys, ONE driver call per frame from section 4). Elbow/pre-bend are additive geometry + pivot changes with every historical contract preserved by name (`hand`, `hand_anchor`, `boot`, `knee_patch`, `mouth_smile`, `mouth_o`, parameterized pant cylinder). Simulation, navigation, storage, and interaction logic are untouched (no `src/game/` behavioral diff; `dialogue/assets.ts` gained pure data only).

## 4. Character animation details

- **Mouth-flap**: derived internally from `animState ∈ {talk, converse}` (no canvas wiring; the driver already receives the state). Flap composes with the emotion scale and `faceAmp`; the surprised "o" gains the same drive. Deterministic phase via the existing seed pattern.
- **Elbows**: pivot at (±0.055, −0.305, 0.008) inside the arm pivot; hand/hand-anchor re-parented with world-space position preserved exactly (elbow+hand sums to the historical ±0.09/−0.38/0.02 — test-locked). Per-state bends: walk −0.25, run −0.38, sprint −0.5, wave forearm-snap −0.95±0.22, work ±0.12 articulation, music fret/bow, sketch_read −0.72, talk/converse gesture-coupled, sit/rest gentle; carry variants set their own; clamp [−1.35, 0.2]; armDamp follow-through. Wrist bridge merged into the mitten (still exactly one hand mesh).
- **Pre-bent knees**: cylinder vertices below the knee arc forward up to 0.026 (t^1.6 easing); boot capsule/toe ride +0.028, heel stays planted (bb.min.z < −0.1 holds). Jun mirrors both.
- **Bug fix riding along**: the nook occupant inherited a stale `emotionIntensity` from the resident loop's scratch options — now reset per call.

## 5. Ambient motion details

- **AM-1/2 sway**: grove crowns use NEW cache keys (`grove_crown_*_sway`) so the orchard's JS instance sway stays authoritative on the original keys (test-locked both ways); wilds crowns + meadow grass/stem/blossom hooks use height masks, per-instance phase from `instanceMatrix[3]` (zero JS), wind-scaled amplitude, winter stiffening ×(1−0.45·uWinter).
- **AM-3 signs**: bakery bread-board, nook blade sign, woodshop pinecone shingle hang from new pivot groups at their bracket mounts (bracket arm rigid); rotation ±0.02–0.03 rad, breeze-scaled, phase-varied.
- **AM-4 lantern fix**: lantern + festoon emissive writes moved from the revision-gated block to per-frame section 2.8 — the golden→dusk phase lag (the same defect already fixed for windows in BUILD 03) is gone; dusk gains a ±0.06 breathe. Frame-0 values are exact (breathe=0), so the pinned BUILD 03 ordering/tests hold.
- **AM-5 gating**: `update(composed, world, focusPos, elapsed, dt, isIndoors)` early-returns before exterior sections 4–6 while the exterior root is hidden; sections 1–3 and per-frame glow writes always run (cheap scalars; season/revision state stays consistent for the exit frame).

## 6. UI details

- Tokens: 13 `@theme` colors (byte-identical values) + `--shadow-card/-sheet/-drawer` + three elevation utility classes; 411 literal migrations across 10 files; canvas painters single-sourced through `components/uiPalette.ts`; `uiTokenDiscipline.test.ts` bans regression.
- Icons: `icons.tsx` documents its semantic inventory in-file (4 weather, 4 season, 4 cozy-domain); deployed in the HUD season/weather readout and satchel category slots; functional glyphs stay lucide.
- Thumbnails: 14 new parametric scenes (`item_sprig`, seeds, honey jar, tart, shortbread, river glass, feather, fern, cedar rose, zine, bell, watercolor card, wreath, music box) tinted from a per-item spec table; 11 items reuse existing scenes (`loaf`, `teacup`, …); `subjectForItem` falls back to the yarn ball for unknown ids. Satchel cards render 44px thumbnails; the dialogue gift picker renders 36px.
- Portraits: met residents get the procedural knit bust; un-met keep the coat-color initial.
- A11y floor: global `:focus-visible` (terracotta 2px), toast + whisper `role="status" aria-live="polite"`, zoom buttons 44px (cluster gated below `sm` after review — touch devices use the now-unblocked pinch), favicon = storybook crest data-URI + `theme-color`, HUD `safe-area-pad` honors insets on `viewport-fit=cover` devices, all five `DialogueChoice.tone` values have distinct tactile styles (gift keeps its own).

## 7. Performance report

| Metric | Baseline (pre-change, same save/framing) | Final | Δ |
| :--- | :--- | :--- | :--- |
| Draw calls (veteran full-progress, 20 s, SwiftShader) | 2304 | 2305 | **+1 (≤ +1 ≈ 0.04 %, inside session variance; see reconciliation below)** |
| Triangles | 150,707 | 153,119 | +2,412 = merged wrist bridges (11 rigs × 2 arms) |
| Geometries | 2196 | 2196 | 0 (no new scene meshes) |
| Textures | 22 | 22 | 0 |
| Programs | 35 | 40 | +5 = ambient-sway shader variants on existing cached materials |
| Scene build | 1150 ms | 1321 ms | +171 ms (program compile on first use) |
| Page errors | 0 | 0 | 0 |

**Reconciliation (explicit, mirrored in `VISUAL_QUALITY_STANDARDS.md`)**: the sway/swinger/elbow/pre-bend work adds zero scene meshes (geometries unchanged) and is draw-neutral by construction; the +1 measured call is not attributable to a named addition and sits inside the session variance already observed between BUILD 03's own re-measures (2268 → 2304 on the same tree). Artifacts: `baseline-perf.jsonl` (Stage 0/1, committed before feature code) and the final row in `metadata.jsonl`. AM-5 additionally **removes** per-frame pond/rain/petal/koi/orchard work from every indoor frame — a pure CPU win with zero visual change. **Hardware limitation (honest)**: all measurements are SwiftShader software-GL at ~1 fps wall-clock pacing; real-GPU frame-rate validation remains an external-hardware task exactly as documented in BUILD 02 §10 — no GPU FPS numbers are claimed here.

## 8. Testing and gameplay regression

- `npx tsc --noEmit` clean; `npm test` **489/489 pass** (480 inherited + 9 new: 4 character-animation locks, 3 ambient-motion contracts, 1 token-discipline ban, 1 item-mapping completeness). Re-run on the final tree after every fix commit — not historical reuse.
- New locks cover: flap oscillation + uniform restore; elbow existence/parentage/rest/wave/walk bends + hand-offset preservation (both builders); pre-bend vertex arc + boot bb + direct-child hip (no knee DOF); Jun parity; sway material registration + orchard exclusion + shared-clock uniforms; swinger count + breeze-scaled motion; UI literal ban; item-catalog mapping (25/25, ≥14 distinct scenes).
- Gameplay regression surfaces verified by the untouched suites: seated clearance, fountain/pond clearance, silhouette envelope, squash math, scarf/shawl cloth, winter knits, poof cues, save/load (walkPhase not serialized), dialogue greeting/talk states, walkability, fresh-save parity.
- Browser quality: 0 console/page errors across all 14 captures; harness re-verified per capture (resumable with frame-aware completeness).

## 9. Visual validation and evidence

`download/asset-qa/build04-validation/` — desktop 1440×900 + mobile 390×844, veteran Doc 07 save, per-shot metadata (zoom/phase/notes), 0 page errors:

| Evidence | What it shows |
| :--- | :--- |
| `v_plaza_hero_build04(_f2/_f3)` | golden hero + ambient-motion frame triple (crowns, signs, festoon live) |
| `v_cast_walk_plaza` | morning routines across the plaza — stride, elbows, pre-bent gait live |
| `v_talk_flap_zoom(_f2/_f3)` | clara pinned talk at dialogue zoom — mouth-flap triple |
| `v_wave_elbow_zoom(_f2)` | wave forearm snap |
| `v_dusk_lanterns_build04` | dusk pier sconces/lanterns/window glow per-frame (AM-4) |
| `ui_satchel_thumbnails` (desktop + mobile) | canvas thumbnails, bespoke cozy icons, token-drawn drawer |
| `ui_journal_portraits` | People tab procedural knit portraits (7.4) |
| `motion-pixel-diff.json` | committed measurement: all five sequences animate (2.0–2.9 % pixels changed per 1.5 s; threshold 0.1 %) |
| `baseline-perf.jsonl` / `metadata.jsonl` perf row | before/after under identical save, camera, and framing |

Every capture was visually inspected (hero/cast/talk/satchel/journal/mobile/dusk reviewed in-session; the talk/wave/hero sequences additionally proven by the committed pixel-diff). Review-fix re-captures: mobile pair re-shot after the HUD fix.

## 10. Adversarial review record

Independent Loop-F reviewer (integration), verdict **ACCEPT-WITH-FIXES** — findings and resolutions:

| # | Severity | Finding | Resolution |
| :--- | :--- | :--- | :--- |
| 1 | MAJOR | Mobile HUD legibility collapse at 390px (zoom cluster un-gated) | **Fixed** — cluster gated below `sm`; touch uses unblocked pinch; re-captured mobile pair confirms legible location card |
| 2 | MAJOR | "Pixel-diff motion analysis" claimed but not committed | **Fixed** — `scripts/qa_build04_motion_diff.py` + committed `motion-pixel-diff.json` (`allAnimated: true`) |
| 3 | MINOR | Pip knee patch buried by the pre-bent pant | **Fixed** — patch rides the bent surface (z 0.09 → 0.11) |
| 4 | MINOR | Frame-triple metadata inherited zoom `1.0` | **Fixed** — parent-scenario lookup |
| 5 | MINOR | Harness resumability could silently skip missing frames | **Fixed** — skip gated on base + all expected frames |
| 6 | MINOR | +1 draw call unattributed | **Documented** as ≤ +1 inside session variance (geometries/textures unchanged prove zero new meshes) |
| 7 | NOTE | Dead `SeasonType` import | **Fixed** |
| 8 | NOTE | Grip props shift a few cm with bent elbows (tuned for rigid forearm) | **Accepted** — rest pose exact; bent-pose shift ≤ 0.06 u; verified against `v_cast_walk_plaza`; two-hand pail rides the torso socket, not the elbow |
| 9 | NOTE | Ambient registries persist across canvas remount | **Accepted/documented** — scalar writes to detached objects only; production path is single-mount |
| 10 | NOTE | Page pinch can zoom during play | **Accepted** — the a11y-floor intent; iOS ignored `user-scalable=no` anyway |
| 11 | NOTE | Lockfile churn inside the Stage 0/1 docs commit | **Noted** — no further dependency changes |

Clean categories (reviewer-verified): stride-sync/sit/envelope/squash/blink/hand-position/boot contracts; shader-hook doctrine + orchard exclusion + tuft key isolation + winter damp + cache keys; lifecycle/exit-frame state; Tailwind v4 utility generation + tone completeness + portrait crash-safety + DPR repaint cost.

## 11. Deferred and documented (not silently dropped)

1. **6.4 hurried gait** — needs a sim-side constant; Doc 04's own design-approval gate. Driver already supports run/sprint poses if approved later.
2. **Interaction-presentation gaps** (no in-world highlight for static props/seats, no hover cursor, no directional cue for off-screen targets) — documented in the audit §1; out of Phase 6–7 scope; prompts/CTA/rings/veil/toasts already functional.
3. **UI exit animations** — `motion@12` remains installed-but-unused (kept out deliberately; no roadmap mandate).
4. **Real-GPU performance validation** — requires physical hardware (see §7 limitation); program + evidence procedure documented for whoever runs it.
5. **One-off tints** — intentional near-miss shades (e.g. TitleOverlay `#B55639`) left untouched; the ban list covers the 13 core tokens only.

## 12. Definition of done — checklist

Roadmap verified (audit §0) · previous builds intact (merged main base) · character animation materially improved (§4) · identity preserved (all name/constant contracts green) · contextual animation follows simulation state (flap/pose from authoritative `animState`/`emotion`) · environmental motion purposeful + efficient (§5, draw-neutral) · interactions unchanged and regression-tested · furniture/carrying functional (clearance suites green) · UI visually coherent (tokens/icons/thumbnails) · dialogue readable and character-centered · mobile usable (390×844 captures, safe-area, pinch) · interruption/recovery safe (presentation writes only; zero-GC driver) · save/load correct (no schema/behavior diff) · no major gameplay regressions (489/489) · performance measured honestly (§7 + standards reconciliation) · visual + motion evidence inspected (§9) · independent reviews completed (§10) · docs complete (audit + this report + standards reconciliation + WORKLOG 055) · committed and pushed.
