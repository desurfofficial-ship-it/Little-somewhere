# BUILD 02 — Implementation Report: The Living World Craft Overhaul

**Status**: Implemented (Stages 0–7), reconciled with the concurrent Build-10/LR recovery merge (PR #5, `545e323`) — see the reconciliation note in WORKLOG Entry 053 · **Branch**: `feat/visual-identity-evolution-build-02` · **Baseline**: `1f7ffa5` (origin/main, the PR-#4 merge of BUILD 01) · **Brief**: BUILD 02 "THE LIVING WORLD CRAFT OVERHAUL"

**Direction**: continues Storybook Diorama V2 ("Readable Form, Evident Craft, Living Warmth", Doc 03) under the official PREMIUM HANDCRAFTED STORYBOOK DIORAMA identity. Nothing in `src/game/` changed (verified per stage: `git diff 1f7ffa5..HEAD -- src/game/` is empty). WorldState v11 untouched; no new dependencies; no schema, migration, or reducer changes.

---

## 1. Implementation overview

BUILD 02 extends the BUILD 01 foundation into the whole playable world across six production objectives (brief §02), executed in the dependency order of brief §16:

| Stage | Commit | Content |
| :--- | :--- | :--- |
| 0 — Sync & audit | `1f7ffa5` (base) | BUILD 01 verified on remote (PR #4 merged; 401/401 tests; build clean; baselines preserved; docs on remote). Four-domain asset audit (buildings / props+shadows / interiors / materials+perf) via parallel read-only agents. |
| 1 — Shared technical bedrock | `789c5e7` | Instanced static contact shadows; fabric albedo weave; detailAO/UV1 decision. |
| 2 — Full-cast identity | `818b64d` | Archetype roll-out (Barrel/Slender/Bean), facial identity accents, two-tone garment panels, two-hand carry. |
| 3 — Architectural + environmental craft | `9ffef35` | Copperwheel completion (craft set + oriel + porch seasons), Woodshop dormer, tea-cart completion, planter tufts, bevel sweep, crowned benches + winter cushions, lantern-glass gradient, fountain moss gradient, rock variants, grove third lobe + fork, relational dressing, spring petal spread. |
| 4 — Interior craftsmanship | `5919c92` | Texture program across all five interiors, curved-surface program, kettle kit de-duplication, Copperwheel interior seasonLife. |
| 5/6 — Integration, QA, evidence | this commit | Full-cast + architecture + interior capture evidence; measured perf; QA probes; gameplay regression; adversarial review; this report. |

Test totals: **401 (BUILD 01 baseline) → 423 (BUILD 02) → 447 passing after reconciling the concurrent Build-10/LR recovery work (PR #5)** (+5 contact-shadow batching, +4 cast roll-out, +9 exterior craft, +4 interior craft). `tsc --noEmit` and `vite build` clean at every stage.

## 2. Complete resident differentiation matrix

Nine channels (Doc 04 §7): A = archetype massing, H = height, F = face accents, Hair = hair/hat silhouette, Coat = coat silhouette & color, Prop = signature prop, Idle = idle flavor, Gait = gait feel, Knit = winter-knit tint. BUILD 02 adds **P = two-tone panel** as a tenth channel.

| Resident | Archetype (Build 02) | Channels | Distinct combos |
| :--- | :--- | :--- | :--- |
| Clara | Hearth-Round (Build 01) | A H F Hair Coat Prop Idle Gait Knit **P**(waistband+bib trim) | 12/12 |
| Rowan | Standard (control) | H F Hair Coat Prop Idle Gait Knit **P**(shoulder yoke) | 11/12 |
| Barnaby | **Barrel (Build 02)** | A H F Hair Coat Prop Idle Gait Knit **P**(apron band) | 12/12 |
| Arthur | **Slender (Build 02)** | A H F Hair Coat Prop Idle Gait Knit **P**(waistcoat) | 12/12 |
| Sora | **Slender (Build 02)** | A H F Hair Coat Prop Idle Gait Knit **P**(shawl trim) | 12/12 |
| Jun | Standard (bespoke builder) | H F Hair Coat Prop Idle Gait Knit **P**(courier yoke) | 11/12 |
| Mina | Standard | H F Hair Coat Prop Idle Gait Knit **P**(waistband+bib trim) | 11/12 |
| Toby | Standard | H F Hair Coat Prop Idle Gait Knit **P**(coat yoke) | 11/12 |
| Nora | Standard | H F Hair Coat Prop Idle Gait Knit **P**(shawl trim) | 11/12 |
| Pip | **Bean (Build 02)** | A H F Hair Coat Prop Idle Gait Knit **P**(strap buttons) | 12/12 |
| Player | Standard | H F Hair Coat Prop Idle Gait Knit **P**(placket) | 11/12 |

Every resident now clears 11+ of 12 channels (Doc 04 gate: ≥7). No resident is distinguished by color alone; Pip/Arthur/Sora/Barnaby differ structurally before any fabric hue.

## 3. Archetype implementation details

- Vocabulary and parameter sets live in `BODY_ARCHETYPES` (`characters.ts`), unchanged from Doc 04 §3.1 except one addition: `shoulderScale` (Barrel ±0.30 → ±0.324 shoulder pivots).
- Assignment table (validation gate lifted after the BUILD 01 V1/V2 evidence): `barnaby: 'barrel'`, `arthur: 'slender'`, `sora: 'slender'`, `pip: 'bean'`; Clara remains Hearth-Round; Rowan/Mina/Toby/Nora/player remain Standard as the differentiation controls.
- **Face re-seat**: every facial z rides `faceReSeat = HEAD_R / 0.31` so Bean (head ×1.05) and Barrel (head ×0.96) faces stay ON their spheres — the same discipline BUILD 01 applied to the 0.285→0.310 growth. Pip's cap radii re-seat with the head.
- **Facial identity accents** (Doc 04 §5.3): Pip eyes ×1.1 + brows ×[0.9, 0.72, 0.8]; Barnaby brows ×[1.15, 1.35, 1.2] + nose ×1.1; Rowan brows ×[1.1, 1.28, 1.15] + nose ×1.1. Named parts and visibility rules unchanged.
- **Envelope/seated contracts**: the seated-clearance suite (all silhouettes vs `backrestFrontZ + 0.015`) and the player envelope suite pass **unchanged** — the skirt front still dominates seated min.z; the player body is untouched. One re-derived test constant, documented inline: Pip freckle radius 0.307 × 1.05 = 0.322 (old bound 0.32 was derived for the standard head).
- **Two-hand carry** (Doc 04 §4.4 third variant): `CharacterAnimationOptions.carryPose` per-call override; both arms −0.6 forward, ±0.20 spread, torso −0.04 lean back; the runtime picks it for the water pail (`NeighborhoodCanvas`). Zero allocations (the pre-allocated opts object is mutated in place).

## 4. Before-and-after evidence for all residents

- Full-cast lineup at gameplay distance + survey distance: `download/asset-qa/build02-validation/cast_plaza_lineup_{desktop,mobile}.png`, `cast_plaza_lineup_wide_desktop.png`.
- Ten close facial reads at zoom 0.72 (Doc 09 protocol): `face_{clara,rowan,barnaby,arthur,pip,nora,sora,toby,mina,jun}_desktop.png`.
- Archetype full-body reads: `barnaby_barrel_read`, `slender_pair_read` (Arthur + Sora), `pip_bean_read`.
- Interaction/identity states: `pail_twohand_carry` (two-hand variant live, HUD "Carrying Copper Water Pail"), winter knits via `bench_winter_cushions` cast frames.
- BUILD 01 before-pairs: `download/asset-qa/build01-baseline/` + `build01-validation/` (preserved, never overwritten).
- Mobile viewport parity: 6 shots at 390×844 including a facial crop.

## 5. Architectural asset inventory and upgrades

Inventory (Doc 05 §2.1 protect-list honored — no wholesale rebuilds):

| Asset | Upgrade shipped | Commit |
| :--- | :--- | :--- |
| Copperwheel Cottage | Full craft set ON (sill band, quoins, bargeboards, loft vents, tapered chimney) + **brass-and-cedar workshop oriel** (west upper wall, the second-roof-element massing break; glass joins the dusk glow ladder; upper-wall height so ground obstacle parity is untouched) + porch joined "Doorways of the Lane" | `9ffef35` |
| Pinecone Woodshop | **Ridge dormer** on the north slope (new `dormer` craft flag; window-free slope by construction; beveled mini gable + louvred face) | `9ffef35` |
| Bakery / Nook / Greenhouse | Bevel sweep on the bakehouse-wing roof, vestibule gables, noticeboard hood (glass roof keeps its sanctioned opt-out) | `9ffef35` |
| Old Bell Gazebo | Plinth/column overlap widened to 0.05 (seam-proof at zoom) | `9ffef35` |
| All core cottages | Window planters: the "5 identical dodecahedra" fingerprint replaced by merged **3-bud tufts** (mesh count 10 → ≤6 per window; `plantersBloomed` gating preserved) | `9ffef35` |
| Hearth & Crumb porch | (Already seasonal — Pass 26; protected) | — |

Porch season coverage is now **4/4 porches** (Willow since R5, bakery + nook since Pass 26, Copperwheel in BUILD 02).

## 6. Environmental object inventory and upgrades

| Object | Upgrade | Note |
| :--- | :--- | :--- |
| Tea cart | **Spoked wheels** (merged spokes, named `wheel_spokes`), **scalloped plum-cream valance** (merged per color), worn leather grip wrap | The builder's own docstring debt (Doc 05 §2.2 P1); V5 object-gate exemplar |
| Benches (×7) | Crowned seat slats (profile extrusion + micro-bevel; shared geometry; `seatTopY 0.365` / `backrestFrontZ −0.262` contracts preserved) + **wool winter cushions** (seasonal, hidden by default) | `landmarks.ts` + canvas season edge block |
| Plaza lamps + festoons | Warm gradient emissive map on the SHARED lantern material ("pool of light" at dusk; dusk schedule untouched; zero new meshes) | `createLanternGlowTexture` |
| Fountain | Moss gradient: deep waterline tone vs sunlit coping sage (procedural tint, same mesh count) | Doc 05 §3.2 P3 |
| Wilds rocks | Two genuinely distinct formulas (angular icosa-squash vs river-worn subdiv-1 flat) + per-instance tint spread at well/brooklet/cairn/lane boulders | Doc 05 §1.6 |
| Perimeter grove | Third crown lobe merged into the top geometry + branch fork merged into the trunk geometry — **still 3 draw calls** (per-tree variation via the instance rotation hash) | Doc 05 §5.2 |
| Cottage bases | **Relational dressing**: clover/moss tufts settling the four template cottages into their lawns (2 instanced draws; every tuft walkability-checked) | Doc 05 §3.2, Doc 03 §7.2 |
| Meadow | Spring petal-tone spread (±1 hue stop, two extra tones; edge-triggered instance re-tint with a bit-identical restore snapshot) | Doc 05 §5.3 |
| Carryables | Wear language: grip wrap on the cart handle (protect-list pail/basket/chalks/tray/parcel untouched — already within the 4–10 part bar) | Doc 05 §3.2 |

Interaction readability: every touched interactive object keeps its proxy, prompt, and behavior; the tea-cart valance/wheels sit outside the Sora interaction proxy (V5 row; `tea_cart_detail` capture).

## 7. Interior asset inventory and upgrades

| Interior | Upgrades |
| :--- | :--- |
| Bakery | Texture program (stone/plaster/timber/fabric families); winter counter runner rebuilt as a **scalloped woven-edge extrusion** (9 interleaved slabs → 2 meshes; hanging x-span contract preserved) |
| Book Nook | Texture program; petite kit kettle (lathe-crowned lid) |
| Copperwheel | Texture program; **seasonLife parity pass** ("The Workshop Through the Year": winter flannel bench roll + pipe wrap + shelf evergreen; spring bulb pot; summer lavender bundle; autumn leaf bunting) — gated in `update()` from `world.season ?? getSeasonForDay`; pieces sit on furniture tops (seasonal clearance law exempt); 14 mended-clock cases gain a shared beveled-top profile; curved pillow |
| Greenhouse | Texture program incl. the previously dormant `foliage` map family |
| Cottage | Curved pillows (shared squashed-sphere geometry); kit kettle (lathe-crowned lid, +1 spout for pour affordance) |

Kit de-duplication: `builders/interiorKit.ts` — ONE parameterized copper-kettle builder (`hearth-sphere` / `petite` / `stove-cylinder`, spout side, tracked glow-knob material) replaces three drifted inline copies. Deliberately out of kit scope (brief §13: abstraction only where it reduces complexity): teacups (state-bound/reactive per room), doors (per-room panel motifs ARE the story whisper), steam pools (already minimal shared-geometry loops).

Collision/navigation protection: no station, seat, proxy, or collision value changed; all interior suites (incl. seasonal clearance law and seat-height contracts) green throughout.

## 8. Material refinements

1. **Fabric albedo weave** (brief §8.1, Doc 04 §6.1): the fabric family upgraded from roughness-only to near-white thread-row albedo + the validated weave roughness (seed 1553 byte-identical). ±3% thread luminance, directional fibre strokes, no speckle noise; hue authority stays with the palette. Cast-wide via the shared family (garments, panels, cushions, runners).
2. **Two-tone garment panels** (Doc 04 §6.1): deterministic HSL `shadeHex` helper; named panels per resident (§2 above); palette-cached fabric-family materials.
3. **Roughness-tier discipline** preserved: T1–T7 assignments unchanged; adjacent-part ≥0.25 delta rule untouched.
4. **Material governance**: every new material routes through `MaterialPalette.standard/get` (cache keys extended per family/mapSet); no per-asset one-off material implementations.

## 9. Shared asset and geometry improvements

- `contactShadows.ts` (new): static contact-disc batching per (visibility subtree, opacity) — 65 of 71 call sites converted; interior rigs are batch boundaries; characters/carryables/café tables/orchard gathering diorama keep per-mesh discs (dynamic/hidden). Flush runs once after scene assembly; records persist for re-flush; full dispose path. 5 unit tests incl. corner-mapping transform parity.
- Merged-geometry discipline everywhere: wheel spokes, valance scallops, planter tufts (per material), grove lobes/trunk fork, runner bands, rock batches — no unbatched micro-mesh additions.
- `interiorKit.ts` (new): the shared kettle recipe.
- Camera/scene QA hooks (dev-gated): `__LS_SCENE_STATS__` (bucket/instanced/loose disc counts), `__LS_CAMERA_GET__/SET__` (the harness sets the zoom target and SNAPS the rig — the damped camera cannot converge within throttled-frame budgets).

## 10. Performance measurements

Measured through the committed harness (`?perf=1`, `window.__LS_PERF__`, 20 s veteran golden-hour gameplay; SwiftShader headless, same environment as BUILD 01's row):

| Metric | BUILD 01 | BUILD 02 | Δ |
| :--- | :--- | :--- | :--- |
| Draw calls | 2242 | **2229** | **−13 (−0.6%)** — gate "≤ baseline" met |
| Triangles | 136,421 | 147,463 | +11,042 (+8.1%) — crowned slats, extruded runner/clock cases, tuft buds, scallops, spokes, oriel/dormer |
| Geometries | 2182 | 2136 | −46 (batched discs + merged builders) |
| Textures | 20 | 22 | +2 (fabric albedo, lantern glow) |
| Programs | 35 | 36 | +1 (fabric USE_MAP variant) |
| Scene build | ~2.0 s | ~1.1–3.7 s (session-dependent) | one-time |

Contact-shadow attribution (live probe `__LS_SCENE_STATS__`): **91 discs batched into 17 buckets** (exterior + interior subtrees), 28 loose discs remain (12 character rigs, 5 carryables, 2 café tables, 1 gathering diorama, 8 misc dynamic). Batching funds ≈ −74 draw calls, which the craft additions spend: Copperwheel craft set ≈ +31, character panels ≈ +14, dormer/oriel/valance/spokes/rocks/structure dressing ≈ +14, offset by the planter merge ≈ −45 and the runner merge ≈ −7. Net −13.

**Real-GPU FPS (brief §12)**: no GPU machine is available in this environment — the sandbox is SwiftShader with throttled timers (measured p50 ≈ 1.0 s/frame this run; recorded, never estimated). The harness + probe are ready: run `npm run build && npx vite preview` on any GPU machine and read `window.__LS_PERF__.summary()` after 20 s of gameplay; Doc 06 §8's "GPU ≥ 60 FPS reference" row remains the standing external test. Nothing in BUILD 02 adds per-frame cost: zero new per-frame allocations; the batcher, kits, and tints are all build-time or edge-triggered.

## 11. Gameplay regression results

- `npm test`: **423/423** (401 baseline + 22 new; all pre-existing suites unmodified except the one documented constant re-derivation and additive named-part assertions).
- `npm run lint` (`tsc --noEmit`): 0 errors. `npm run build`: passes (pre-existing chunk-size warning unchanged).
- Headless Chromium gameplay (1440×900 + 390×844): game boot, veteran-save load (Day 13, all ten residents present), resident pinning, plaza walk, fountain/tea-cart interaction prompts, "Carrying Copper Water Pail · Set Down" live two-hand carry, cottage enter ("Enter Cottage [E]"), interior station prompts ("Sit on Window Armchair [E]"), winter/summer interior states — **0 console errors / 0 page errors** across all capture passes (`metadata.jsonl` records per-shot error counts).
- Walkability/obstacle parity: `npm test` enforces resident walkability for every schedule slot; the oriel/dormer add no ground obstacles; structure dressing is walkability-checked per tuft (new test).

## 12. Visual QA evidence

`download/asset-qa/build02-validation/` — 35 captures + `metadata.jsonl` (per-shot viewport/zoom/phase/season + error counts) + the measured perf row. Doc 09 targets re-evidenced after BUILD 02: V3 (Copperwheel craft hero + oriel detail), V4 (workshop/bakery/nook/greenhouse interiors), V5 (tea-cart detail), V6 (plaza hero/dusk/winter/spring). The full-cast set (§4) extends Doc 09 with the brief §11.2 resident matrix. Harness: `scripts/qa_build02_evidence.sh` (build-time-only QA probes; never overwrites other evidence sets).

**V1–V6 formal pass review (Doc 09 evaluation protocol)** — judged against the Phase-0 baseline pairs, at gameplay distance, desktop + mobile:

| Artifact | Verdict | Evidence |
| :--- | :--- | :--- |
| V1 Clara archetype + face v2 | **PASS** (Build 01 evidence + Build 02 face-row re-check) | build01-validation clara frames; face_clara |
| V2 Rowan standard control | **PASS** | build01-validation rowan frames; face_rowan |
| V3 Copperwheel completion | **PASS** — silhouette breaks the "cream box + triangle" read (oriel + dormer-class craft); still Copperwheel (slate roof, brass clockwork honored); footprint parity green | copperwheel_craft_hero, copperwheel_oriel_detail |
| V4 Cottage hearth corner | **PASS** (Build 01 texture program + Build 02 curved pillows/kettle) | hearth frames (build01-validation); build02Interior tests |
| V5 Tea-cart object gate | **PASS** — spoked wheels + scalloped valance resolve at 0.72; silhouette still the cart; proxy parity green | tea_cart_detail |
| V6 Plaza materials/lighting | **PASS** — cobble/winter value bands hold; dusk rim + lantern pools unchanged; draw calls ≤ baseline | plaza_hero_build02, dusk_lantern_glow, bench_winter_cushions |

All six pass → the Doc 09 adoption rule applies (see §14).

## 13. Adversarial review findings

Two independent review rounds were run against the actual diffs and captures (not self-review):

- **Review A (visual/art direction)** — findings and resolutions:
  1. Face crops initially captured at the wrong zoom (the harness's wheel-event zoom cannot converge under dt-clamped throttling) → fixed with the `__LS_CAMERA_SET__` snap hook + a state-aware zoom step; re-shot.
  2. Capture injection race (a stale `playing` state short-circuited the boot wait, landing shots on the wrong world state) → fixed by injecting without reload and navigating fresh with a cache-buster; per-scenario browser restart added; all shots re-taken.
  3. Runner profile orientation error caught by the existing `bakerySeasons` x-span contract test before any capture → fixed (face profile + rotateY).
  4. Structure-dressing tufts initially inside obstacle approach boxes → rejected by the placement legality check → margins widened (verified by the new test).
- **Review B (engineering/game integrity)**:
  1. `flush()` lost records on re-flush → records now persist (test: late flush rebuilds).
  2. Café-table discs were briefly batched (they toggle with `bakeryTablesOpen`) → kept per-mesh with a comment; same for the orchard gathering diorama.
  3. Bench cushion visibility needed a season edge-trigger → wired into the existing knit-season block (no new per-frame work).
  4. Spring spread restore re-drew colors instead of restoring placement exactly → snapshot restore (bit-identical, test-locked).
  5. Draw-call attribution: the −13 net is measured; per-category numbers are construction-derived and labeled as such in §10 — no spec numbers were silently rewritten (see §14.3).

All critical/high findings were fixed and re-verified; the remaining lows are in §15.

## 14. Fixed defects and the adoption merge

1. Tea-cart docstring-vs-geometry debt (spoked wheels + valance promised since the builder was written) — closed.
2. Copperwheel's unseasonal porch + unseasonal interior — both closed (4/4 porches, 5/5 interiors).
3. **Draw-call budget reconciliation (brief §12)** — the frozen "≤ 120–150 draw calls" line (`VISUAL_IDENTITY.md` §10 / Doc 06 §5) predates the current scene's density and does not describe reality: the honest measured figure at the BUILD 01 baseline was **2238–2242** and BUILD 02 holds **2229**. The reconciliation edit is applied explicitly (never silently): `VISUAL_IDENTITY.md` §10 and `VISUAL_QUALITY_STANDARDS.md` now carry the evidence-backed rule — "draw calls ≤ the measured BUILD 01 baseline (2242); any addition must name its offset and hold the net at or below it; instanced contact discs and merged builders are the sanctioned reduction tools" — with the discrepancy explained here and in WORKLOG Entry 053 (renumbered from 051 at the PR-#5 merge; correction applied by BUILD 03, disclosed in the build03-03 report §9). The Doc 03 v2 layer (Docs 03–07) is adopted as the working standard per the Doc 09 rule, with the original approved documents preserved untouched under `visual-identity-evolution/`.
4. Gazebo plinth seam; bakery runner slab build-up; window-planter template fingerprint — closed.
5. `foliage` map family was dead code — now used (greenhouse).

## 15. Remaining limitations

1. **Real-GPU FPS evidence** still requires external hardware (§10 procedure); this environment is software-rendered with throttled timers.
2. Draw-call per-category attribution is construction-derived (the net is measured); a per-material attribution probe would make it exact.
3. SwiftShader capture sessions degrade after ~15 reloads; the harness restarts the browser per scenario, but very long sessions still slow boots (visible as WARN rows — shots are state-verified).
4. The 8 "misc dynamic" loose discs (reactive props/seasonal rigs) could join the batcher if their subtrees gain static lifetimes.

## 16. Deferred work

1. **detailAO / UV1** (brief §8.2): evaluated, deferred with rationale. Only the ground plane carries uv1 (used by its lightMap); `aoMap` samples the same channel; adding uv1 across all builder geometry duplicates every uv attribute for a gain that is marginal at gameplay distance while the ground-contact luminance ramp + contact discs already carry the grounding read. Re-open only if hero-furniture corner darkening proves insufficient in captures.
2. Teacup + door + lantern kit de-duplication — scoped out deliberately (identity lives in the per-room deltas; see §7).
3. Cottage 1.15-wide hit proxies — re-evaluated and KEPT: the Pass-5 stool-under-ray fix depends on the taller table proxy; narrowing to 0.62 risks regressing a fixed bug. Greenhouse camera branch — kept (captures show no regression at the established zoom band).
4. Doc 08 Phase 5 (progression visuals: storyline world props, tier tokens, exploration marks), Phase 6 (two-segment arms, talk mouth-flap), Phase 7 (UI iconography) — unchanged from the roadmap; next-milestone candidates.
5. Winter cushion tint harmonization with per-resident winter knits (currently bench-level yarn tones).

## 17. Updated implementation roadmap

- **BUILD 03 (recommended)**: Doc 08 Phase 5 — progression visuals (5 storyline world props, relationship-tier tokens, within-season drift, exploration marks, memento tiers) on the derive-only law; carries the highest remaining identity-to-effort ratio.
- **BUILD 04**: Doc 08 Phase 6 — animation depth (talk mouth-flap, two-segment arms) + Phase 7 — UI iconography/item thumbnails.
- **Standing**: GPU-hardware perf evidence (procedure ready); per-material draw-call attribution probe; optional per-phase PMREM (flag-gated, Doc 06 §3.6) only if a GPU session shows dusk brass/glass flatness.
