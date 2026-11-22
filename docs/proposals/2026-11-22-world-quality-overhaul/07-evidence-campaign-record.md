# LITTLE SOMEWHERE — World-Quality Overhaul: Evidence Campaign Record (Doc 07)

Status: **COMPLETE 2026-11-22** — fulfils Doc 06 §4 (visual verification protocol) and §5 (performance campaign) for every phase whose captures were still missing after the Phase 8 code/finalization pass. Companion to WORKLOG Entry 056; all paths relative to the repo root.

Method (Doc 06 §4.1 doctrine): production build served by `vite preview`; the real game driven via the agent-browser tooling; camera states exercised through the **real input paths** (synthetic canvas pointer drags at the production 0.006 rad/px sensitivity, `__LS_CAMERA_SET__` clamped+snapped zoom hook); harness `scripts/qa_overhaul_evidence.sh` (resumable, per-shot metadata, 0-page-error target). Console-error audit: **0 page errors in every capture session** (per-row `pageErrors` field).

## 1. Camera — interior framing (Phase 3) — `download/asset-qa/overhaul/phase3-interior-framing/`

Five rooms × (entry, yaw +90°, zoom min 0.55, zoom max 1.75) = 20 captures, plus the cottage cutaway yaw sweep (4 captures).

| Room | Entry | Yaw +90° | Zoom min | Zoom max | Framing profile (fit) |
|---|---|---|---|---|---|
| Hearth & Crumb Bakery | `room_bakery_entry` | `room_bakery_yaw90` | `room_bakery_zoommin` | `room_bakery_zoommax` | 23.1 |
| Copperwheel Cottage | `room_cottage_entry` | `room_cottage_yaw90` | `room_cottage_zoommin` | `room_cottage_zoommax` | 25.9 |
| Linden Book Nook | `room_nook_entry` | `room_nook_yaw90` | `room_nook_zoommin` | `room_nook_zoommax` | 22.1 |
| Copperwheel workshop | `room_copperwheel_entry` | `room_copperwheel_yaw90` | `room_copperwheel_zoommin` | `room_copperwheel_zoommax` | 23.3 |
| Sunbeam Greenhouse | `room_greenhouse_entry` | `room_greenhouse_yaw90` | `room_greenhouse_zoommin` | `room_greenhouse_zoommax` | 25.3 |

Verified in-capture: bounds-derived framing keeps every room inside the frustum at all four states; the greenhouse uses the **interior camera branch** (D/E defect fixed — no more exterior fallback framing); yaw +90° re-hides the near full-walls per side (dynamic cutaway follows rotation). Cutaway sweep: `cutaway_cottage_yaw0/90/180/270` — all four quadrants hide the correct near walls, wall-mounted dressing hides with its wall (Phase 8 D-1 fix visible in the north/west wall rows).

## 2. Fountain (Phase 4) — `download/asset-qa/overhaul/phase4-fountain/`

Rebuilt two-tier circular fountain (32-seg lathe basin + bullnose coping, 6 spouts, merged cascade arcs, ballistic droplets, pale-blue `#BFE3EF` water, decorative stone ring) at the corrected `FOUNTAIN_CENTER` (0, 1.5):

- Flowing (veteran `repairedFountain=true`), three angles: `fountain_after_default`, `fountain_after_orbit90` (real drag +90°), `fountain_after_close` (zoom 0.55).
- Dusk lighting row: `fountain_after_dusk_default`, `fountain_after_dusk_orbit90` (minute 1230; merged masonry under lantern lighting — no z-fighting with contact shadows observed).
- Dry repair-quest state preserved: `fountain_dry_default`, `fountain_dry_close`.
- **Before-state**: the committed BUILD 04 captures show the old octagonal teal basin (`download/asset-qa/build04-validation/v_plaza_hero_build04_desktop.png`, `v_plaza_hero_build04_f2/f3`).

Verified in-capture: circular silhouette, two tiers, water reads pale-blue with white droplet spray; the wish-token sits at the corrected center anchor; dry state shows bare basin + stone ring.

## 3. Furniture (Phase 5) — `download/asset-qa/overhaul/phase5-furniture/`

- Bench v2 ×3 spots + joinery detail: `bench_east_plaza` / `bench_gazebo` / `bench_pond_south` (zoom 0.85) and `bench_east_plaza_close` / `bench_gazebo_close` / `bench_pond_south_close` (zoom 0.62 — curved cedar frames, rounded rail, sage/mint all-season pad visible).
- Winter row: `bench_winter` (season winter, day 37 — pad color law holds).
- Armchair ×2 with mint upholstery: `armchair_nook` (Reading Armchair, striped mint cushion), `armchair_copperwheel` (Window Armchair, mint/green upholstery; `seatMeshYaw` contract untouched — prompts confirm seat identity).
- Bakery/stool row: `bakery_cafe_chair` (Café Corner Chair).

## 4. Seating residuals (Phase 6) — `download/asset-qa/overhaul/phase6-seating/`

- C-1 (deck sit sink): `seating_foxglove_deck_seated` (wide) + `seating_foxglove_deck_seated_close` (zoom 0.55) — saved sit-state at `seat_foxglove_rise`; the seated figure rests on the deck ground Y (no sink into the deck mesh); the live "Stand Up [E]" prompt proves the seated state is real, not staged.
- C-2 (stand-up null fallback): `seating_foxglove_deck_standup` — stand-up lands at the approach position.
- Outdoor bench sipping: `seating_east_plaza_sip` — seated at `seat_east_plaza` with a sipable drink (`chamomile_pear_tea` ×2) in the satchel.

## 5. Bug register behavioral evidence (Phase 7) — `download/asset-qa/overhaul/phase7-bug-register/`

- **G-2 future-schema data-loss fix** — live probe (`metadata.jsonl`, single row, `probe` object):
  1. A hand-edited **version 12** payload parked under the live storage key.
  2. Load refused → game started on a fresh v11 state (fresh start visible in `g2_future_schema_refusal`).
  3. After **10 s of live gameplay**, the stored payload still reads `version: 12` — autosave did **not** silently downgrade-overwrite it (pre-fix behavior destroyed the save).
  4. Refusal is structural via the `loadWorldState` `futureSchemaSaveDetected` gate; the explanatory warning string is the `deserializeWorldState` return value (not a console log) — recorded in the probe note.
- Remaining register items (G-3 sit-range reducer assert, G-7 arrival window, NPC separation, A*-null fallbacks, wish/skip cooldowns, KeyM gating, ambient registry dispose) are covered by the 38 new unit/contract tests added across Phases 1–8 (527/527 green) and are not screenshot-capturable by nature.

## 6. Performance campaign (Phase 8) — `download/asset-qa/overhaul/phase8-final/perf-after.jsonl`

20 s rows, SwiftShader, same save+framing doctrine as the committed pre-change baseline (`download/asset-qa/overhaul/baseline/baseline-perf.jsonl` = 2304 draws veteran; Entry 054 fresh parity = 1704):

| Row | Framing | Draw calls | Δ vs baseline | Tris | Programs | Textures |
|---|---|---|---|---|---|---|
| `perf_overhaul_veteran` | plaza hero (identical to baseline row) | **1764** | **−540 (−23.4 %)** | 156,086 (+3.6 %) | 40 | 21 |
| `perf_overhaul_fresh` | plaza hero, fresh save | **1653** | **−51 (−3.0 % vs 1704)** | 147,842 | 35 | 20 |
| `perf_overhaul_veteran_opensky` | pond bench (open sky, no occluder on ray) | 1508 | supplementary only | 134,303 | 38 | 19 |

Named drivers, per the "every addition names its offset" law:

- **Selective occlusion fade (Phase 2)** is active at the hero framing — a plaza-adjacent building shell hides, removing its subtree from the draw list (dominant share of the −540; the fade returns draws on player rotation, by design).
- **Fountain merge bank (Phase 4)**: flowing masonry merged per material, ~99 → 54 draws (WORKLOG 056), visible in both veteran rows.
- WORKLOG 056's earlier veteran pair (2268 → 2317, +49) was captured under a confounded framing (occlusion state + frustum contents differ per yaw/position); the rows above supersede it with an identical-framing methodology and are the evidence of record.
- Zero new textures (21–22 vs 22); programs 40 vs 35 = the BUILD 04 sway variants + occlusion-clone shader-state reattachment, no new per-frame programs.
- Real-GPU FPS remains the standing external-procedure gap (honesty over claims, Doc 06 §5).

## 7. Gate summary

- tsc clean · **527/527 tests** (489 pre-overhaul + 38 overhaul) · production build 854 ms — re-verified on the evidence-campaign tree.
- 53 capture PNGs + per-shot metadata across six phase directories; console-error audit **0 errors in every session**.
- Known limitations carried forward (WORKLOG 056): real-GPU FPS unmeasured; interior profiles use nominal aspect 1.6; occlusion probes SwiftShader-paced; fountain droplets individual meshes (InstancedMesh follow-up flagged).
