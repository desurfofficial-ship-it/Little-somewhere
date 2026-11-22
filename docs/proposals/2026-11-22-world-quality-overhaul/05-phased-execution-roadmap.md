# Document 5 — Phased Execution Roadmap

Dependency-ordered; every phase ends shippable (tsc + tests + build green, game playable). Each phase names its owner role (main agent or specialist subagent) and integration checkpoint.

**Git checkpoint (Phase 0):** DONE — build-04 synced and pushed; `feat/world-quality-overhaul` cut from `9653b76` and pushed; baseline recorded in `download/asset-qa/overhaul/baseline/`.

---

## Phase 1 — Camera foundation (main agent; camera specialist review)

- Objective: `CameraController` exists and replaces the inline block; rotation + zoom work; controls never invert; slow-motion eliminated.
- Contents: new `cameraController.ts` + `roomFraming.ts` (profiles for all locations, legacy-parity interior numbers); GestureRouter (drag-rotate, pinch zoom, wheel, pointerup tap-walk commit, wall-hug timeout D-8); movement basis from yaw (D-10); sim accumulator (D-6/G-5); look-target damping (D-7); dead input removal (D-9); joystick reset (G-1); zoom range widening (exterior 0.55–1.75) + HUD buttons wired to same clamp.
- Dependencies: none (first phase).
- Acceptance criteria:
  - Drag rotates smoothly; no drift; no flip; yaw preserved across interior/exterior transitions.
  - WASD/joystick/tap directions correct at 0/90/180/270 yaw (automated basis tests + manual check).
  - 20 FPS-forced environment no longer slows the world clock (accumulator test).
  - Tap-to-walk never fires after a drag; pinch zooms on mobile layout.
- Verification: new unit tests (basis, controller, accumulator) + `__LS_CAMERA_SET__` QA sweep + manual playtest captures.

## Phase 2 — Obstruction intelligence (camera specialist)

- Objective: the player is never invisible behind buildings/trees; camera never penetrates.
- Contents: `occlusion.ts` registry + interval probes + fades; occluder tagging on 5 building shells + bakery L-wing + workshop + 2 vegetation clusters; material-clone isolation; camera min-height guard over water/props.
- Dependencies: Phase 1 (controller emits probe requests; accumulator in place).
- Acceptance criteria:
  - Walking behind any of the 6 buildings keeps the player readable (fade ≤ 200 ms in/out, no flicker at corners — hysteresis verified).
  - Palette cache materials untouched (clone-isolation test); draw calls ± 0 at opacity 1.
  - Probe cost ≤ 3 rays / 150 ms (instrumented).
- Verification: unit tests, manual walk-behind sweep per building, perf row.

## Phase 3 — Interior framing & dynamic cutaway (interior specialist)

- Objective: entering any room feels authored; framing adapts; rotation works indoors.
- Contents: real per-room profiles (bounds from game constants, fit distance, focus weight 0.55–0.7, lookY ≈ 0.95); entry/exit damped transitions (remove `position.set` snap); wall tagging + missing-variant construction in 4 rooms (greenhouse glass excluded); `applyShellCutaway` with hysteresis; per-room zoom ranges.
- Dependencies: Phase 1 (controller/modes), Phase 2 (occlusion interplay).
- Acceptance criteria:
  - Default-angle visual parity: screenshots at default yaw per room match pre-refactor (contact-shadow/wall look unchanged).
  - Rotating 90°/180° indoors re-selects cutaway sides correctly; walls never block the player at any yaw.
  - Small vs large rooms receive visibly different distances; player + key furniture always in frame.
  - Entry/exit transitions are damped (no snap), yaw/zoom preserved.
- Verification: parity captures ×5 rooms ×2 angles, matrix D1–D9, unit tests.

## Phase 4 — Fountain reconstruction (environment art specialist) — INTEGRATED

- Objective: reference-matched flowing fountain; big draw-call reduction; collision/interaction correct.
- Status: implemented by specialist on this branch (landmarks.ts rebuild, waterShaders pale-blue retune, worldMap anchor fix `FOUNTAIN_CENTER`, actions.ts witness constants, landmarks.test.ts ×8, environmentRenderer.test.ts droplet count 20→28). Gates re-verified by main agent: tsc clean, 497/497, build pass. Flowing draw calls ~99 → 54 (26 structured + 28 contract-pinned droplet sprites); dry ~15.
- NC follow-ups accepted: optional proxy widening (NC:1174) and splash y polish (NC:2233) — applied during Phase 2 canvas work if trivially safe.

## Phase 5 — Furniture quality (environment art specialist)

- Objective: bench v2 + armchair upholstery to reference quality, contracts intact.
- Contents: palette additions; bench v2 (all 7 instances via existing loop); nook + copperwheel armchair upholstery; bakery/stool polish; merge sub-parts.
- Dependencies: Phase 3 (interior builders) and Phase 4 (landmarks.ts) landed first.
- Acceptance: seat contract tests stay green; visual identity preserved; winter states anchor correctly; draw calls net ≤ +10.

## Phase 6 — Seating residuals (main agent)

- Objective: close the verified seating gaps.
- Contents: C-1 foxglove ground-Y (player + NPC sites), C-2 stand-up fallback, C-3 sorrel margin, C-4 test locks, C-5 outdoor sip.
- Dependencies: none (independent).
- Acceptance: extended seating suite green; manual foxglove sit render correct at deck height; sip works on benches.

## Phase 7 — Bug-fix register batch (main agent + QA review)

- Objective: land the P1 set + cheap P2s from Doc 02 §G.
- Contents: G-2 save guard, G-3 range asserts, G-4 NPC separation, G-7 arrival pre-check, G-8 A*-null, G-10, G-11, G-12 cooldowns, G-13 save toasts/text/sleep reset, G-14, G-15 scratch reuse, G-16 ambient dispose, G-17 nudge, D-8 (if not in 1).
- Dependencies: G-3 after camera gestures settle (Phase 1); others independent.
- Acceptance: each fix ships with its test; full suite green; no behavior regressions.

## Phase 8 — Adversarial QA, performance, documentation, final verification (QA agent + main agent)

- Objective: prove it, then document it.
- Contents: full Doc 06 protocol (camera 15-scenario matrix, furniture matrix, seating sweeps, save/load matrix, perf campaign, visual evidence pack); independent adversarial review pass; defect burn-down; documentation updates (WORKLOG, HANDOVER §17, ARCHITECTURE camera section, VQS additions); final Definition-of-Done audit vs brief §13.
- Acceptance: DoD checklist fully ticked with evidence links; known-limitations list published.

---

## Integration checkpoints (per phase)

1. Every phase = 1–3 commits with tagged scope (`feat(camera): …`, `fix(seating): …`); explicit path staging (never `git add -A`) — parallel specialist work shares the tree.
2. Cross-phase conflicts: Phase 3 and Phase 5 both touch interior builders → Phase 3 lands first; Phase 5 rebases its furniture diffs.
3. After Phases 2, 5, 7: fresh QA-agent review of the integrated tree.
4. Rollback strategy: each phase is a revertable commit range; the branch never merges with a red gate.
5. Sandbox durability rule discovered in execution: untracked artifacts (proposal docs, evidence) are committed immediately — the sandbox can drop untracked files and prune loose git objects between turns.

## Out of scope (registered only)

G-9 pure-wrapper clone; journal memory cap; QA PNG dedup; chunk splitting; multiplayer/npcs-entering-interiors redesign; any narrative/quest changes.
