# BUILD 03 Implementation Report — PROGRESSION MADE VISIBLE

**Status**: Implemented (Phases 0–7), final adversarial review APPROVE-WITH-CHANGES applied · **Branch**: `feat/visual-identity-evolution-build-03` · **Baseline**: `ed860e0` (origin/main, post-BUILD-02-merge + Build-10/LR recovery + concurrent Copperwheel armchair fix) · **Brief**: BUILD 03 "PROGRESSION MADE VISIBLE" (roadmap Phase 5, verified against Doc 07/08)

---

## 1. Executive summary

BUILD 03 makes the world's existing progression visible without changing a byte of simulation behavior. Every Doc 07 §5 extension shipped: five storyline world props (§5.1), relationship-tier tokens + keepsake echoes (§5.2), within-season drift (§5.3), four exploration marks (§5.4), tiered mementos (§5.5), and both housekeeping signals (§5.6). All visuals derive from authoritative persisted state through one pure game-layer module (`progressionVisuals.ts`) consumed revision-gated by the renderer — zero save-schema impact, zero reducers, zero new dependencies, zero new shader programs. The game layer diff is exactly three files (`environment.ts` additive, `progressionVisuals.ts` new, its test) and `git diff ed860e0..HEAD -- src/game/` contains no behavioral surface.

**Measured result (same-save pairs, SwiftShader, 20 s)**: fresh-save parity is **exact — 1704 draw calls on both trees** (also 112,278 triangles and 1667 geometries identical); the fully-progressed veteran state costs **+49 draw calls** (2268 → 2317) with **+1.2% triangles, programs 35 → 35, textures 22 → 22**. The merge pass had already removed −25 draws from the naive build. All 5.1–5.6 features are individually test-pinned (480/480 tests, +33 net new since the 447 baseline).

## 2. Scope

Doc 08 Phase 5 rows 5.1–5.5 + risk notes, interpreted through Doc 07 (the binding specification) against the verified baseline tree (audit doc §1–§3). Explicit rejections: Doc 08 Phase 6/7 (animation depth, UI iconography), any gameplay-behavioral change, any schema/migration, real-world timers, currencies, completion percentages. Requirements-to-implementation matrix: `build03-01-phase5-requirements-audit.md` §5 (16 rows, each with owner/trigger/visual/persistence/timing/reversal/perf/validation).

## 3. Architecture (deliverable: technical architecture record)

- **`src/game/progressionVisuals.ts` (new, pure)**: derives `ProgressionVisualState` (revision + storyline props with outcome clamps to hydrate fallbacks + resident tokens at affinity 60/90 + keepsake echoes from `neighborGiftsReceived` ∩ `NEIGHBOR_KEEPSAKE_REWARDS` + season drift + exploration marks + reachable memento tiers + noticeboard glint) from a wide `Partial<Pick<WorldState,…>>`. Radix-sum revision packing (2^53-safe; the season identity bit was added during the final review to make spring/summer dayOfSeason-1 distinct), frozen-empty cheap path, frozen-state memo (identical revision → the same immutable object, so the per-frame callers allocate zero shells between edges).
- **`src/game/environment.ts` (additive only)**: `ComposedEnvironmentState.progression` field; input Pick widened with optional fields only; `playerChanges.noticeboardUpdated` passed as an argument (no per-frame spread).
- **`src/scene/progressionPresentation.ts` (new)**: all props pre-built hidden at mount, mounted before the contact-shadow flush; toggled by `apply(state)` inside the renderer's revision-gated static block. Ground-contact groups carry `contactBatchRoot = true` + batched discs; elevated/tiny props carry no disc. Palette cache never mutated (tinted variants are per-group clones). Merged builders throughout: ribbons 5→1 mesh, motif strokes 3→1, chalks 2→1, sconce hoods/glass/flames 2→1 each, herb stems 2→1, gear/bead/thong merges (−25 draws vs the naive build).
- **`src/scene/environmentRenderer.ts`**: dual-revision gate (`revision` + `progression.revision`); `applySeasonDrift` (grove AND wilds crowns, anchored to the season palette hexes, ordered after the season block — pinned by test); per-pin glint clones (disposed explicitly); neighborhood window glow moved per-frame (fixes a pre-existing golden→dusk lag — behavior-preserving, documented) with the `cozyLateNightHint` +0.2 step on `windowMaterials` only (`willowWindowMaterials` ownership untouched, test-pinned).
- **Interior rigs** (`cottageInterior`/`bookNookInterior`/`greenhouseInterior`/`copperwheelInterior`): tiers, posy growth, and the three indoor echoes toggle in their existing `update()` behind the shared derivation. **`botanicalDressing.ts`**: additive `setSeasonDayProgress(progress, season)` — p=0 restores the placement snapshot bit-identically (the proven `setSpringSpread` mechanism), higher progress lerps the blossom instance colors toward the season's late keyframe.
- **`NeighborhoodCanvas.tsx`**: mount + dispose wiring; `__LS_DRIFT_PROBE__` QA hook (cleaned up in the teardown).

## 4. Implemented features (Doc 07 §5 conformance)

| Feature | Gate (authoritative) | Shipped as |
| :--- | :--- | :--- |
| 5.1a Zine chalk cover + caddy | `pipZinePrinted` OR storyline completed | Side-rail chalk cover (edition-tinted) + foot caddy; motif per outcome |
| 5.1b Herb window crate | `herbLoafShared` OR storyline | Hung under the ledge lip between corbels (review H4 — display ledge top was fully occupied); bunch variants per style |
| 5.1c Cedar music stand | `pondStandBuilt` OR storyline | Pond south bank near `seat_pond_south`, clef/oak-brace variants, sheet on the board |
| 5.1d Brass watch charm | `watchTuneFinished` OR storyline | Under the porch-lantern base ring (world-space; never in a seasonal sub-group), tag/bead variants |
| 5.1e Pier sconces ×2 | `lanternConflictResolved` OR storyline | Two NEW hooded posts at the shore approach (review H3 — the stub pilings cannot carry them); outcome = amber lit / dark / soft lit; existing pier lantern untouched |
| 5.2a Friend charms | `affinity ≥ 60` (heart ≥ 3) | 10 per-resident handmade charms at code-verified anchors (bakery post, greenhouse porch, woodshop lumber, mailbox post, ladder rail…) |
| 5.2b Kindred ribbons | `affinity ≥ 90` | Marigold ribbon knots (festival-ribbon rhyme), same anchors |
| 5.2c Keepsake echoes | `neighborGiftsReceived` ∩ rewards | Zine copy on the nook counter, watercolor on the pond driftwood, bell on the workshop bench, wreath on the growing shelf, cedar dish on the lumber stack |
| 5.3 Canopy + meadow drift | `dayOfSeason` 1–10 | Grove + wilds crowns lerp day-1 anchor → capture-verified targets; blossom instance drift with bit-identical p=0 restore; posies at day 3/7 (stage 0 hidden); winter identity |
| 5.4 Exploration marks | `explored_*` ×4 | Well survey ribbon, Rise stair cairn (+ribbon, distinct from the Bee Line cairn), lane chalk arrow, hive wreath |
| 5.5 Memento tiers | `booksRead ≥2/≥4` (cap 4 — reachable, deviation A2), `totalHarvests ≥3` (A3), `kneadingSessions ≥5` | 2nd/3rd book, honey dipper, 2nd recipe card — children of the existing memento groups |
| 5.6a Noticeboard glint | `playerChanges.noticeboardUpdated` | Newest visible flyer's pin gains a warm emissive via per-pin clones (deviation A5: persistent, honest) |
| 5.6b Late warm windows | `cozyLateNightHint` (≥21:00) | +0.2 window emissive step, per-frame, `windowMaterials` only — verify-first satisfied by capture review (dusk windows read brighter into the 21:00 tail) |

## 5. Adversarial reviews (brief §13)

1. **Design review** (before implementation): APPROVE-WITH-CHANGES, 13 required changes (C1 season-drift parity, H1 32-bit packing overflow, H2 ownership gaps, H3/H4 impossible anchors, M1–M8, L1–L8) — all applied; recorded in the design lock rev 2 changelog.
2. **Final implementation review** (after Stage 5/6): APPROVE-WITH-CHANGES. Verified: pure-additive game layer (byte-level diff check), authoritative-only gates, three-layer fresh parity, drift composition + ordering test, save/load round trip, radix packing safety, renderer integration, placement law, lifecycle/leak hygiene, evidence integrity. Required changes — **all applied**: (a) Stage 7 deliverables + draw-call reconciliation (this report + WORKLOG 054 + VQS edit), (b) HIGH-2 boot-tick meadow-wipe fix (the redundant `setSpringSpread` in the knit-season block removed; drift re-bases on every revision edge; companion rig test pins cross-season re-basing), (c) MEDIUM-3 interior per-frame shells eliminated (frozen-state memo keyed on the revision — which also gained the season-identity bit to make spring/summer dayOfSeason-1 distinct), (d) MEDIUM-5 fresh perf row measured (1704 = 1704, exact), (e) LOW-6/7/8/9/10/11 nits fixed (dead field, honest isSoftwareGl note, pin-clone disposal, probe cleanup, stale comment, structure-mark obstacle tests).

## 6. Testing (deliverable: testing report)

- **`npm test` 480/480** (447 baseline + 33 net new: derivation 15, scene rigs 10, renderer integration 5, cottage tiers 3). One pre-existing test modified: `environmentRenderer.test.ts` autumn-tint world day 24 → 21 — forced by the intended drift semantics (day 24 = dayOfSeason 4 now legitimately departs; day 21 = dayOfSeason 1 preserves the test's exact assertion of the anchor hex). Disclosed here per the §9 contract.
- `npx tsc --noEmit` 0 errors · `npm run build` exit 0 (pre-existing chunk warning only) · no new dependencies.
- **Fresh-save parity (Doc 07 §7.3)**: game-layer (fresh world → every signal "nothing earned"), scene-layer (all groups hidden), renderer (day-1 byte-equal anchors, all four seasons), and now measured (1704 = 1704 draw calls / 112,278 triangles / 1667 geometries).
- **Save/load (§7.5)**: veteran world → `serializeWorldState` → `deserializeWorldState` → identical `revision` + all signals; derive-only ⇒ v1–v11 migrations cannot change presentation.
- **Walkability/clearance**: 5 ground props walkable + ≥0.4 u from every interactable; tokens elevated ≥0.5 u when near interactables; structure marks tested against obstacle circles (host-overlap-only rule); bench/seat volumes excluded for the music stand.
- **Determinism/reversal**: identical world → identical revision (incl. collision-freedom per signal); thresholds re-derive downward; idempotent apply.
- Gameplay regression: all capture sessions 0 console/page errors; interaction proxies, seating, seasonal suites green; `worldMap.ts` (collision surface) untouched.

## 7. Performance (deliverable: performance report)

Methodology identical to BUILD 02 (veteran golden-hour world, `?perf=1`, 8 s warmup, 20 s sampling) **plus the same-save tree pair**: the baseline tree (`ed860e0`, checked out in a worktree) ran the SAME BUILD 03 veteran/fresh saves so the delta isolates BUILD 03's cost.

| Save | Baseline tree (`ed860e0`) | BUILD 03 tree | Δ |
| :--- | :--- | :--- | :--- |
| Fresh (Day 1 spring morning) | 1704 calls / 112,278 tris / 1667 geo / 20 tex / 28 prog | **1704 / 112,278 / 1667 / 20 / 28** | **0 / 0 / 0 / 0 / 0 — exact parity** |
| Veteran (all §5 signals earned) | 2268 calls / 148,929 tris / 2167 geo / 22 tex / 35 prog | **2317 / 150,701 / 2211 / 22 / 35** | **+49 calls / +1.2% tris / +44 geo / 0 tex / 0 prog** |

**Budget reconciliation (explicit, never silent)**: `VISUAL_IDENTITY.md` §10's law reads "hold the net ≤ 2,242 (measured BUILD 01 baseline) with named offsets". The 2,242 figure was measured on the BUILD 01 veteran world; the honest same-save comparator for a fully-progressed BUILD 03 world is the re-measured **2,268** (the same save on the pre-BUILD-03 tree — the 2,242→2,268 difference is earned-state density of BUILD 01/02-era systems, not BUILD 03 work). Against that comparator, BUILD 03's full-progress cost is **+49 draw calls, with named offsets**: 5.1 props ≈ 17 (zine 6, herb 4, stand 3, charm 3, sconces 4 minus sharing), 5.2 tokens ≈ 9 (5 earned in the veteran save), 5.2c outdoor echoes ≈ 4, 5.4 marks ≈ 8, 5.5/5.3c interior additions ≈ 6, contact-disc buckets +4, glint pin clones ±0 (replace 3 shared draws). The merge pass already applied −25 (ribbons 5→1, motif/chalk/sconce/flame/bunch merges). The **operating state (fresh save) is exactly at parity — 0 delta** — and programs/textures never moved. The §10 line is amended explicitly (below and in the WORKLOG) to state the operating-state rule and the named-offset register for fully-progressed states, replacing the single-number reading that the richer earned-state model has outgrown. Software-GL (SwiftShader) numbers are throttled (~1 fps wall-clock) and are NOT hardware FPS evidence; the real-GPU procedure remains an external-hardware item, unchanged from BUILD 02.

## 8. Visual evidence (deliverable: visual evidence package)

`download/asset-qa/build03-validation/` — 28 captures + `metadata.jsonl` (per-shot zoom/phase/season) + `baseline-perf.jsonl` (tree-pair measurements):
- **Fresh-save parity quartet** (`fresh_plaza_hero`, `fresh_noticeboard`, `fresh_bakery_ledge`, `fresh_cottage_interior`): Day 1 with every BUILD 03 group hidden.
- **5.1 row**: `v_zine_board` (chalk cover verified on the side rail, edition tint), `v_bakery_herb_crate`, `v_music_stand_pond` (stand + sheet verified), `v_pier_sconces` (amber glow verified at dusk), `v_watch_charm`.
- **5.2 row**: `v_token_clara`, `v_token_mina`, `v_echo_nook_zine`, `v_echo_workshop_bell`, `v_echo_greenhouse_wreath`, `v_echo_pond_card`.
- **5.4 row**: `v_mark_well_ribbon`, `v_mark_rise_cairn`, `v_mark_lane_arrow`, `v_mark_hive_wreath`.
- **5.3 pair**: `v_drift_spring_day1` (parity anchor) vs `v_drift_spring_day10` — canopy pixel-delta measured in the target direction (blue channel −18…−26), plus the live `__LS_DRIFT_PROBE__` hex verification (day 10 = `#ddf0c8`/`#ffedb0` exactly; day 1 = exact anchors).
- **5.5/5.6**: `v_cottage_tiers` (book stack + dipper + 2nd card + full posies), `v_noticeboard_glint`.
- **Mobile**: hero + zine board + music stand + cottage tiers at 390×844.
- Review method: HUD contact-sheet audit of all 28 captures (zone/day/phase verified per shot — three invalid-position fallbacks diagnosed and re-shot), targeted detail crops for craft reads.

## 9. Fixed defects and review-driven corrections

1. Season-drift targets strengthened after capture pixel-diff proved the first-authored values invisible at gameplay distance (design lock §3.3 revised inline).
2. Injection race: title-screen autosave could overwrite the injected save before navigation — the harness now freezes persistence on the injector page immediately (documented in the harness).
3. Invalid playerPos fallback: three capture scenarios hit the save-sanitizer's "non-walkable playerPos reset to safe spawn" — re-framed to `isPointWalkable`-verified spots.
4. Revision packing gained the season-identity bit (spring/summer dayOfSeason-1 collision, found during the memo implementation).
5. Boot-tick meadow wipe (review HIGH-2) and per-frame interior shells (MEDIUM-3) — fixed as described in §5.
6. BUILD 02 leftovers closed explicitly: `VISUAL_QUALITY_STANDARDS.md` now carries the draw-call reconciliation the BUILD 02 report claimed (it had landed only in `VISUAL_IDENTITY.md` §10); the BUILD 02 report's stale "WORKLOG Entry 051" pointer corrected to Entry 053; the stale porchSeasonLife docstring ("Copperwheel NOT wired") corrected to match the code.

## 10. Known limitations

- The veteran captures show the props at gameplay distance; the walkable-approach constraint (clearance law + obstacle radii) bounds how close the camera can frame small tokens (charms read as ~10 px details at 1440×900 — by design, "gentle, non-cluttering").
- The one-day noticeboard pulse was rejected as underivable without new persisted state (deviation A5); the shipped glint is persistent and honest.
- SwiftShader throttling (~1 fps) means frame-time/FPS numbers are not hardware-representative; real-GPU evidence remains the documented external procedure.
- The keepsake echo can coexist with the same item on the cottage shelf (review L2 decision: the echo celebrates the giving; documented in the design lock §7).

## 11. Deferred work

- Doc 08 Phase 6 (animation depth) and Phase 7 (UI iconography) — next-milestone candidates.
- Interior keepsake echoes for Clara/Rowan/Sora/Jun (non-reward residents have no echo by design — the rewards registry defines the set).
- A universal within-season drift for grass/clover material colors (requires per-district material ownership decisions; blossom instances carry the shipped drift).
- Real-GPU FPS evidence (external procedure ready and unchanged).

## 12. Definition-of-done audit (brief §17)

Phase 5 interpreted against the actual roadmap ✓ · BUILD 01/02 intact (PRs #4/#6 in history; reports + WORKLOG entries untouched) ✓ · simulation state is the single source of truth (byte-level game-layer diff) ✓ · supported progression visually legible (5.1–5.6 shipped + captured) ✓ · environmental memory deterministic and save/load-safe ✓ · time/season presentation consistent (drift ordering test-pinned) ✓ · resident identity/routines intact (cast/archetype suites green) ✓ · location identity stronger (audit table in the design lock §4) ✓ · no major gameplay regressions (480/480, walkability untouched) ✓ · visual evidence inspected ✓ · performance measured (same-save pairs) ✓ · adversarial reviews executed and applied ✓ · documentation complete ✓ · WORKLOG updated (Entry 054) ✓ · committed cleanly and pushed ✓.
