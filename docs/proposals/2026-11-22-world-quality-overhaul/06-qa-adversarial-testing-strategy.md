# Document 6 — QA and Adversarial Testing Strategy

How this overhaul will be challenged before it merges. Principles: every claim is executed (no "should work"); visual verification happens in the **running game**, not in code review; adversarial review is done by an agent that did not write the code; every defect found is recorded, triaged, and either fixed or explicitly registered.

## 1. Automated regression floor (every phase gate)

- `npx tsc --noEmit` clean; full `npm test` green (489 pre-overhaul baseline + new tests; target ≥ 530 by Phase 8); `npm run build` clean.
- Existing tests are the no-regression floor: seating contract (15), navigation, occupancy, storage/migrations, build-10 recovery, materials, per-interior mirroring — none may be weakened; any test that must change is justified in the commit message.
- New automated locks (Doc 04 §7): camera controller (yaw/clamps/damping/zero-alloc), movement basis at 4 yaws, room profiles + fit math + cutaway parity mapping, occlusion scheduling + clone isolation, fountain contract + merging + collision clearance (8 tests, done), extended seating locks (foxglove ground-Y, stand-up non-null, sorrel margin), NPC separation + arrival pre-check + A*-null, future-schema save guard.

## 2. Camera adversarial matrix (manual, running game — brief §12)

| # | Scenario | Pass criteria |
|---|---|---|
| C1 | Walk behind small house (cottage) | Player readable (fade in ≤ 200 ms, out ≤ 200 ms, no flicker) |
| C2 | Walk behind large house (bakery + L-wing, workshop) | Same; corner transitions hysteresis-stable |
| C3 | Orbit camera around building corners (all 5 buildings) | No oscillation; no penetration through walls; occluder probe handles concave corners |
| C4 | Enter small room (book nook 5.0×4.8) | Deliberate transition; player + armchair + desk legible; no wall block |
| C5 | Enter large room (cottage 7.0×5.4) | Wider framing; player not lost; furniture readable |
| C6 | Enter narrow/tall room (greenhouse glass, ridge 4.08) | Pitch/fit adapts; glass shell never blocks; plants visible |
| C7 | Move through doorways (in/out × all 5) | No snap; yaw + zoom preserved; veil + damp compose naturally |
| C8 | Rotate inside rooms (all 4 quadrants) | Cutaway sides switch correctly; nothing ever hides the player; movement basis stays correct after rotation |
| C9 | Zoom inside rooms (min/max) | Never trapped; zoom range respects room profile; HUD buttons + wheel + pinch agree |
| C10 | Move around furniture (tables, armchairs, stools) | No camera jitter from props; collisions unchanged |
| C11 | Walk near fountain | Basin never penetrates; stone ring doesn't trap; fade of fountain body if between camera and player |
| C12 | Walk around trees (orchard, hollows) | Vegetation fade on tagged clusters only; no pop-in |
| C13 | Rapid camera rotation (spin + flick) | No drift, no NaNs, damping stable; intents integrate without overshoot |
| C14 | Rapid interior↔exterior ping-pong (×10) | No state conflicts; mode switches settle ≤ 1 s; no stale occluder fades |
| C15 | Repeatedly re-enter same room (×10) | Framing deterministic; no accumulation errors |

Mobile-specific: drag-rotate vs joystick isolation; pinch vs UI gestures; gesture ownership during dialogue/menus (canvas input gated — verified existing gate NC:1344 + App modal guard); joystick stale-vector regression (G-1) retested after fix.

## 3. Furniture & seating matrix

- Sit/stand on **all 12 seats** (7 benches + 2 cottage stools + bakery chair + 2 armchairs): position, facing, animation, stand-up spot, ×5 cycles each, zero drift (automated + spot visual).
- Rotational sweep: seatMeshYaw round-trip 0/90/180/270 × 4 axes (already locked; re-run after bench v2 replaces the mesh).
- NPC seating: nook occupant parity; outdoor NPC sit + player-steal reconciliation; occupied-seat prompts.
- Furniture near tables/walls: bakery chair, cottage stools, armchairs — stand-up pockets verified walkable with ≥ 4/8 free directions (extended tests).
- Bench v2 at all 7 spots: no clipping with ground/props (foxglove deck, sorrel hollow), winter cushions gating intact.

## 4. Visual verification protocol (evidence, not assertions)

1. Run the production build locally (`npm run dev` / `preview`); drive the game via the agent-browser tooling; capture screenshots into `download/asset-qa/overhaul/<phase>/` (the established evidence pattern).
2. Required evidence sets:
   - Fountain: before/after ×3 angles (default, orbit +90°, close), flowing + dry states, night/dusk lighting row.
   - Furniture: bench ×3 spots, armchair ×2, bakery/stool row, winter row.
   - Camera: C1–C15 capture pairs (defect state vs fixed state where the defect was capturable).
   - Interior framing: 5 rooms × (entry, rotated 90°, zoom min/max).
3. Console-error audit per session (target: 0 errors, 0 new warnings).
4. Every capture referenced in the phase report; "verified" claims link to files.

## 5. Performance campaign

- Baseline: 2304 draw calls / 150.7k tris (veteran, SwiftShader) — every phase row records its delta; the "every addition names its offset" law enforced in review (the merged fountain is the bank: −45 flowing).
- Frame cost: perfProbe rows for camera update, occlusion probe (must be ≤ 3 rays/150 ms), fade tween registry, shell cutaway switch.
- Allocations: zero-alloc assertions on controller/framing/occlusion modules; GC sweep check on 5-minute soak.
- Memory: ambient-registry leak fix verified by double-mount test; no growth across 20 room transitions.
- Real-GPU: record one hardware run where available (or explicitly re-register the standing evidence gap — honesty over claims).
- SwiftShader correctness: game clock no longer dilates under 20 FPS cap (accumulator lock test + manual 5-minute low-FPS session).

## 6. Failure scenarios to actively try to break

- Save forward-compat: load a hand-edited v12 save → must refuse + preserve raw backup (G-2).
- Interaction edge: stale pending target after long walk → reducer range assert blocks teleport-sit (G-3).
- NPC edge: player stands inside an NPC's arrival path; two NPCs converge on one bench; NPC goal inside fountain ring (A*-null path).
- Seat edge: sit while NPC arriving (1-tick window, G-7); stand-up into a corner the radial recovery can't solve (C-2 fallback).
- Camera edge: drag during dialogue open; pinch mid-transition; yaw exactly at quadrant midline (hysteresis); zoom to extremes then enter interior; window resize mid-drag; devicePixelRatio change.
- Fountain: wish spam cooldown; repair-quest state transitions; splash target after anchor fix.
- Season edge: winter at foxglove deck (bench + sink fix); dusk lighting on merged fountain geometry (no z-fighting with contact shadows).

## 7. Regression-risk register (with guards)

| Risk | Guard |
|---|---|
| Movement basis refactor inverts controls at some yaw | Basis unit tests at 4 yaws + manual matrix C8 |
| Cutaway refactor changes default-angle visuals | Parity captures + `cutawaySidesForYaw(π/4)` contract test |
| Material clones break palette dedupe/sharing | Clone-isolation test + program-count row (35 baseline) |
| Bench v2 breaks seat contract | Contract tests + spot height checks at 7 positions |
| Fountain rebuild breaks wish/repair flows | Quest-state manual pass + action tests |
| Sim accumulator changes game timing feel | Clock-advance tests; time-to-dusk manual check; NPC schedule spot checks |
| Range asserts break legitimate interactions | Assert constants match selector ranges (unified G-11); full interaction sweep |
| Interior builder refactor (5 large files) | Phase 3 specialist does mechanical diffs; per-room mirroring tests + parity captures |

## 8. Adversarial review loop

- After Phases 2, 5, 7 and before merge: a fresh QA agent (no context from implementation) receives the diff range + this document and attempts to break the build in-game and in tests; findings triaged into fix-now / register.
- Final independent review: architecture + perf + docs consistency pass (brief §3 Agent 6 role) before the merge commit.

## 9. Definition of Done audit (maps to brief §13)

Every checklist item in the brief's §13 is ticked **only** with a linked artifact: test run output, capture file, perf JSONL row, or doc section. Items that cannot be verified in this environment (e.g., real-GPU FPS on target hardware) are recorded honestly as known limitations, never claimed as passed.
