# Audit 1-c — Navigation & Spatial Interaction (World Environment / Living World)

**Branch:** `feat/world-environment-living-world` · **Scope:** read-only audit of `src/game/worldMap.ts`, `navigation.ts`, `walkability.ts`, `playerController.ts`, `simulation.ts`, `residents.ts` vs `src/scene/builders/*` and `NeighborhoodCanvas.tsx`.
**Method:** full-file read + two programmatic probes (grid flood-fill at r=0.48, A* path segment re-validation at r=0.38/0.42/0.48, per-interior 0.1 m flood-fill from door spawns, seat/approach/slot walkability sweeps). Probe scripts were run under `npx tsx` from outside the repo; no repo source was modified.

---

## 1. Obstacle-vs-scene mismatch table

### 1a. Building boxes (`BOX_OBSTACLES`, worldMap.ts:67–91) vs `buildings.ts` / `willowLaneDiorama.ts`

| Obstacle (worldMap line) | Scene builder anchor | Verdict |
|---|---|---|
| `player_cottage` −18.2..−10.8 × 6.8..13.2 (:69) | `buildWillowStepCottage` at (−14.5, 10.0), walls 5.0×4.9 (willowLaneDiorama.ts:192–193, NeighborhoodCanvas.tsx:674) | ✅ Synced. Box adds deliberate porch margin (east −12.0→−10.8 for the porch/door at −10.3). |
| `bakery` −16.4..−8.4 × −14.2..−7.4 (:71) | `buildStorybookBakery` core 6.4×5.2 at (−12.4, −10.8) (buildings.ts:626–646) | ✅ Synced (~0.8 m wall margin). Note: south margin means standable strip is z ≥ −7.88; see §4 door findings. |
| `book_nook` −19.2..−12.4 × −4.2..2.2 (:73) | core 5.4×5.2 at (−15.8, −1.0), door east (buildings.ts:868–888) | ✅ Synced. |
| `workshop_arthur` 9.4..16.8 × −14.8..−8.2 (:75) | core 6.2×5.4 at (13.1, −11.5), door south (buildings.ts:1048–1069) | ✅ Synced. |
| `greenhouse` 10.8..17.8 × −1.8..5.2 (:77) | `buildStorybookGreenhouse` at (14.3, 1.7), shadow footprint 7.2×6.8 (buildings.ts:1410–1415) | ✅ Synced. |
| `workshop_barnaby` 9.0..15.8 × 9.8..16.2 (:79) | core 5.6×5.2 at (12.4, 13.0) (buildings.ts:1207–1228) | ✅ Synced. |
| `pond_water` −2.2..5.68 × 11.2..16.65 (:81) | pond visual x −1.88..5.18, z 11.85..16.15 + west culvert −3.58..−1.88 × 13.12..14.88 (vegetation.ts:497–524) | ✅ Box is a shore-buffer around the visual water. ⚠️ vegetation.ts:449 comment cites stale values `−2.4..5.6 × 11.4..16.6` — doc drift only. |
| `bridge_west_rail` −3.7..−3.58 × 11.72..16.28 (:83) | bridge rail segments in `buildMirrorPondAndBridge` (vegetation.ts:198–221) | ✅ Synced, but see §2: inflated rail + pond box leave a **0.42 m** bridge corridor at player radius 0.48, and the rail also blocks 1.08 m of the west bank strip it borders. |
| `rise_mound_*` ×5 (:86–90) | Foxglove Rise terraces at (21.4, 19.2) (wilds.ts:130–159) | ⚠️ **Partial mismatch:** `rise_mound_east_of_deck` minX 22.0 overlaps the visual deck (deck spans 20.4..22.5 per `getGroundHeightAt`, worldMap.ts:475). Combined with `rise_bench` circle (20.85, 19.1, r0.42) the deck's walkable strip at bench height is only **0.26 m** wide at r=0.48 (measured: x 21.76..21.99). Ramp corridor is **0.22 m** at r=0.48 (x 21.30..21.52). |

### 1b. Circle obstacles (`CIRCLE_OBSTACLES`, worldMap.ts:93–133) vs landmarks/orchard/wilds

| Obstacle | Scene twin | Verdict |
|---|---|---|
| `fountain_basin` (0,1.5,2.46), `gazebo_pillars` (0,−9.5,2.3), `tea_cart`, `plaza_board`, `hollow_oak`, 4 plaza/pond benches, 4 willow trees/signpost | landmarks.ts:27/299/659/827, vegetation.ts:286; benches placed from `SEAT_SPOTS` (NeighborhoodCanvas.tsx:1232–1240); willow courtyard props willowLaneDiorama.ts:1175/1180/1186/1243 | ✅ All exact matches. Note: gazebo dais is *fully* blocked (steps at rel z 2.42–2.66 sit inside the inflated r 2.3+0.48=2.78 ring) — the gazebo interior is intentionally non-walkable; the bell is interacted from the south rim. |
| Orchard set (6 trees, gate piers, ladder, crates, skep, bench, tasting table) (:110–122) | `ORCHARD_TREES`/`ORCHARD_GATE`/`ORCHARD_TASTING_TABLE` (orchard.ts:35–45, 392–573) | ✅ Exact mirror; gate gap between piers is 2.56 m walkable at r=0.48. |
| Wilds set: `old_stone_well`, `wild_bee_log`, `rise_bench`, `sorrel_bench`, 3 birches, 2 boulders (:124–132) | wilds.ts:389 (well −21.4,19), 729 (bee log 11,−19.7), 481+ (birches), 650–675 (boulders); benches from SEAT_SPOTS | ✅ Exact matches. |

### 1c. Scene geometry with **NO** collision (walk-through props)

| Item | Scene position (file:line) | Impact |
|---|---|---|
| Bakery café tables ×3 + 6 chairs | buildings.ts:819–866, group (−8.0,−6.4), tables at (−8,−6.0) (−5.9,−6.0) (−3.8,−6.0); revealed by `flags.bakeryTablesOpen` (narrative.ts:65) | Player & NPCs walk through tabletops once Clara/Arthur reconcile. **No `CIRCLE_OBSTACLES` twins.** |
| Marigold Lane signpost | wilds.ts:682, (21.5, 0.8) | Walk-through; inconsistent — the Willow courtyard signpost (−12.5, 5.7) *does* have `willow_signpost`. |
| Bee Line cairn | wilds.ts:780, (8.2, −19.9) | Walk-through, 2.3 m from `beeline_mid` node. |
| Willow mailbox | NeighborhoodCanvas.tsx:681, (−9.8, 7.2) | Walk-through (it is also `player_mailbox` interactable origin). |
| Mirror Pond driftwood nook | NeighborhoodCanvas.tsx:774, (5.85, 13.8) | Walk-through. ⚠️ `PROP_INTERACTABLES.pond_driftwood` def origin is (6.5, 13.8) (worldMap.ts:287) — 0.65 m east of the visual; `focusPos` (5.85,13.8) matches the visual (worldMap.ts:430–431). |
| Greenhouse outdoor planter bench | NeighborhoodCanvas.tsx:755–760, (11.1, 1.7), 0.6×0.92 stand | Walk-through solid bench. |
| Porch herb box / flower-bed curb | NeighborhoodCanvas.tsx:740 (−10.8, 12.1); willowLaneDiorama.ts:1132 (−16.8, 6.72) | Walk-through (small, low). |
| Sorrel Hollow brooklet + stepping log | wilds.ts:552 (−11.2, 18.3), 585 | Decorative water surface has no collision or elevation — walkers wade through. Mild. |

**Collision-without-visual:** none found — every BOX/CIRCLE obstacle maps to live geometry.

### 1d. Documentation drift

- `ARCHITECTURE.md` §4 & file map say **“33-node A* graph”** — actual `NAV_NODES` = **50 nodes / 63 edges** (navigation.ts:13–160).
- `navigation.test.ts:23` validates nodes/edges only at **r=0.42**, while exterior tap-to-walk and the player controller use **r=0.48** (NeighborhoodCanvas.tsx:1618/1652, playerController.ts:292). This masks every finding in §2/§4 that only appears at 0.48.
- vegetation.ts:449 stale pond-box comment (see 1a).

---

## 2. Nav graph coverage assessment (verifiable)

**Graph shape (probe output):** 50 nodes, 63 edges, **single connected component**; all nodes walkable & all edges LOS-valid at r=0.38 and 0.42. At **r=0.48 (player)**: `rise_deck` node **not walkable** (blocked 0.08 m into `rise_mound_east_of_ramp` inflated box) and **3 edges fail LOS**: `pond_bank_sw>pond_south_w`, `orchard_south>orchard_west`, `rise_base>rise_deck`.

**Landmark coverage** (nearest node → zone center): all 14 zones ≤ 3.7 m (`home` 1.51, `square` 3.6, `gazebo` 3.7, `bakery` 2.06, `workshop_arthur` 1.79, `greenhouse` 1.9, `book_nook` 1.81, `barnaby` 1.71, `pond` 3.36, `orchard` 1.14, `marigold_lane` 2.2, `foxglove_rise` 0.05, `sorrel_hollow` 1.0, `bee_line` 0.1). Door coverage: `player_door` 1.81, `nook_door` 1.61, `greenhouse_door` 1.96, `bakery_door` 3.03, **`copperwheel_door` 4.74 (worst)**.

**Wild Hollows & Orchard:** Marigold Lane (4 nodes), Bee Line (4 nodes + copperwheel return), Sorrel Hollow trail (4 nodes) all route cleanly at 0.38. Fern Hollow Orchard is covered by 5 nodes; the `orchard_south→orchard_west` edge clips `orchard_tree_mid`'s inflated radius by **0.023 m** at r=0.48 (passes at 0.42) — sliding rescues it in practice.

**The cedar bridge is not in the graph.** `bridge_north`/`pond_bank_sw` sit on the west *bank* (x −4.35), not on the deck (x −3.83..−1.97); no edge crosses the pond. Tap-to-walk crosses the bridge only when the tap axis yields direct LOS through the 0.42 m corridor (probe: `(-2.9,11)→(-2.9,17)` succeeds); any oblique pond-crossing tap routes around the south shore.

**Physical vs graph connectivity:** flood fill at r=0.48 from spawn reaches **99.96 %** of walkable exterior samples (25,444/25,455) — no sealed pockets. A* endpoints reach 100 % of samples, but **31.0 %** of spawn→sample paths contain ≥ 1 blocked segment at r=0.48; bucketed by target distance-to-nearest-node: **<2 m: 11.8 %**, 2–4 m: 18.6 %, >4 m: 62.2 %. Axis-separated sliding (`resolveMovement`, worldMap.ts:517–529) rescues most of these over successive frames (probe-verified for `copperwheel_door`, `bakery_door`, sorrel bench); the reliable failure is the **Foxglove Rise deck's east half** (see §4).

**Dead pockets** (>2.5 m from any node; 57.6 % of samples — expected for a lane-based graph): far NW/SW meadow (max 15.8 m at (−22.3,−11.2)), NE meadow (18,−20.7), E meadow (22.2,−5.7), lawn pockets (12.5,−5.1) and (15.3,7.6), plus (11.4,18.6) between woodshop and rise. All are open lawn where the unvalidated final leg is usually LOS-clear; risk is stall-then-recover, not entrapment.

**Interior entrances (tap inside via interior waypoint hubs)** — per-interior flood-fill from door spawns at r=0.42: bakery **100 %**, cottage **98.9 %**, nook **99.2 %**, copperwheel **98.9 %**, greenhouse 100 %. Residual slivers: cottage strip x∈(−1.13,−0.87) between bed/table (0.26 m pinch, 8-connected-reachable — verified by 0.05 m BFS), nook west of armchair, copperwheel shelf/stove margins. All stations reachable; all indoor seat approaches walkable (`resolveSeatStandPos` sweep clean). *(False alarm corrected: `cw_bed`'s focus (2.75,−2.2) is far from reachable floor, but its trigger point (0.85,−1.85) is walkable and within radius — copperwheel.ts:96–104.)*

---

## 3. Interior walkability sync audit (per interior)

Obstacle tables live in `cottage.ts:40–51`, `greenhouse.ts:51–62`, `bakery.ts:47–56`, `bookNook.ts:50–59`, `copperwheel.ts:50–61`; builders consume the same constants (e.g. cottageInterior.ts:126, greenhouseInterior.ts:21) and place furniture by those footprints.

| Interior | Obstacle vs builder furniture anchors | No-overlap check | Connectivity |
|---|---|---|---|
| Cottage | hearth (−2.2,−2.2) slab 2.35×0.96 ↔ box −3.45..−0.95 × −2.68..−1.68 ✅; bed (−2.48,1.7) frame 1.72×1.54 ✅; table (0.25,1.0) ✅; shelf sideboard 1.96×0.64 at (1.3,−2.3) ✅; desk top 1.48×0.78 at (2.15,2.22) ✅; stools tucked inside table footprint (cottageInterior.ts:1364–1368) | clean | 98.9 %, 0.26 m bed/table pinch |
| Greenhouse | potting (−1.9,−2.15) ✅; growing shelf (2.62,0.05) ↔ 2.28..2.98 × −1.25..1.35 ✅; water station (2.05,−2.18) ✅; worktable (0.1,2.12) ✅; west door (−2.92,1.5) ↔ spawn (−2.3,1.5) ✅ (greenhouseInterior.ts:379/447/620/664/739) | clean | 100 % |
| Bakery | oven (−1.9,−1.95) ✅; counter (−2.55,0.2) ✅; prep (1.7,−1.95) ✅; café table (1.35,1.45) + chairs ±0.62 ✅; south porch door (0,2.32) ↔ spawn (0,1.5) ✅ (bakeryInterior.ts:365/425/506/590/661) | clean | 100 % |
| Book Nook | shelf wall (−0.68,−2.0) ✅; lending desk (0.55,2.02) ✅; tea console (−2.06,0.35) ✅; armchair (−0.9,1.6) ✅ (chair is `NOOK_OCCUPANT_POS` for hosted NPCs, occupancy.ts:20) ✅; east door (2.42,0) ↔ spawn (1.5,0) ✅ (bookNookInterior.ts:330/381/437/504/561) | clean | 99.2 % |
| Copperwheel | bench (−1.58,−1.97) ✅; bed (2.14,−1.68) ✅; shelf (−2.58,0.28) ✅; stove (2.58,0.6) ✅; armchair (−1.38,1.55) ✅; south door (1.0,2.44) ↔ spawn (1.0,1.75) ✅ (copperwheelInterior.ts:298/499/569/653/726/788) | clean | 98.9 % |

Winter/season dressing (cottageInterior.ts:1255–1362) is explicitly authored inside existing footprints. Desk east gap to wall: 3.5−2.95=0.55 < 2×0.42 → sealed against east wall (no pass-behind), same for bakery counter — by design, no traps.

---

## 4. Player controller edge cases (`playerController.ts`)

- **Sit → stand (190–233):** movement input stands up through `resolveSeatStandPos` (walkability.ts:110–122) which validates under the seat's *own* interior grid — bakery/copperwheel chair trap is fixed and covered by tests (seating.test.ts 16/16 pass). ✅
- **Bridge Y (364):** exterior `groundY = getGroundHeightAt(...)`; interiors forced to 0; `computeSitGroundY` = seatHeight − 0.33. The rise deck (0.62) uses the same contract as the bridge. ✅
- **Wall-damp heuristic (303–310):** if post-slide speed < 45 % of pre-slide speed, velocity snaps to actual — prevents sticky rebound; fine.
- **Dead condition (:138):** `if (sprintHeld || inputMagnitude >= 0.96 && sprintHeld)` — second clause is unreachable redundancy (`&&` binds tighter). Harmless; clean up.
- **Diagonal squeeze:** the 0.26 m bed↔table cottage sliver and the 0.22 m rise ramp are enterable only via axis-fallback sliding; both recoverable, the ramp is uncomfortably tight at sprint inertia.
- **Foxglove Rise tap-to-walk (top finding):** tapping the deck's **east half** or the `rise_vista` prop from plaza/east routes `…→rise_base→rise_deck→target`; the `rise_base→rise_deck` leg is LOS-blocked at 0.48 and `rise_deck` itself is unwalkable at 0.48. Sliding converges only when the tap lands x ≤ ~21.5; otherwise the tap-stuck timer (NeighborhoodCanvas.tsx:2430, 1.0 s) clears the waypoints ~1 m short of the deck and the player must re-tap or walk manually. Not a hard trap (position stays walkable, manual WASD works), but it is the least reliable landmark approach in the world.
- **Bench sit vs NPCs:** explicit sit (`actions.ts:991`) checks only *seated* NPC occupants; an NPC **walking to** a reserved bench can be scooped — the sim detects `seatStolenByPlayer` next frame (simulation.ts:692–695) and re-selects. Conversely NPC arrival warps onto `seat.seatPos` **without** checking the player (simulation.ts:760–771) → ≤ 1 frame of overlap before re-selection. Cosmetic.
- **Landmark zone triggers:** zones are label-only (`getLandmarkAt`); walking into one just updates the HUD label and grants deterministic exploration discoveries via `discoverExplorationInPlace` (simulation.ts:636–641, correctly using `exteriorPlayerPos` when indoors). No forced teleports. ✅

---

## 5. NPC steering consistency (`simulation.ts` / `residents.ts`)

- Residents steer with the **same A\*** as the player: `computeWaypointPath(rt.position, target, 0.38)` on goal change (simulation.ts:727), `stepAlongWaypoints` with soft separation (749–750), stuck ladder at 1.2 s (repath) / 2.8 s (drop waypoints, snap to idle pose) (785–799). Deterministic tie-breaking in the A* open set (navigation.ts:254).
- Encounter spots are midpoint-validated at r=0.38 before committing (`tryComputeEncounterSpots`, simulation.ts:519–566); encounter legs also go through A* (998).
- Slot validation sweep: **all 10 residents × 4 phases + reconciled golden slots + all extra activities are walkable at r=0.38** (0 issues). Only two slots sit >2.5 m from a node: toby afternoon (8.6,4.8) d=2.6, pip golden (−0.4,−5.4) d=3.38 — both approach via clear final legs (probe-verified).
- **Clipping:** since every slot/approach is obstacle-clear, NPCs cannot clip static collision; they *can* walk through the no-collision props in §1c (café tables, cairn, signpost, mailbox, driftwood). NPC indoor presence is teleport-based occupancy (never pathfinds indoors) — no interior graph needed for NPCs.
- The NPC seat-arrival warp skips `isPointWalkable` for the seat position itself (benches are obstacles by design) — intended.

---

## 6. Test run results

`npx tsx --test src/game/navigation.test.ts` → **6/6 pass** (nodes/edges walkable @0.42, single component, pond routing, schedule paths, separation, extra activities). `src/game/walkability.test.ts` **does not exist** (the walkability dispatcher is covered indirectly by `player.test.ts` + `seating.test.ts`: 16/16 pass, incl. per-seat stand-up walkability and 4-of-8-directions-free checks). Gap: nothing asserts the graph at the player's r=0.48.

---

## 7. Ranked fixes

| # | Fix | Severity | Effort |
|---|---|---|---|
| 1 | **Foxglove Rise access.** Widen ramp corridor (pull `rise_mound_west/east_of_ramp` to minX/maxX 20.9/21.9), stop `rise_mound_east_of_deck` overlapping the deck (minX 22.0 → 22.5), move `rise_deck` node to (21.45, 18.9) so it is walkable at 0.48, and add `hasLineOfSight` assertions at **0.48** to `navigation.test.ts` (keep 0.42 for NPCs). | **Players get stuck-ish** (tap stalls ~1 m short of the deck; reliable only on the deck's west half) | S (1–2 h incl. tests) |
| 2 | **Route A\* over the cedar bridge.** Add deck nodes (−2.9, 12.4) / (−2.9, 14.0) / (−2.9, 15.6) chained `pond_west_top→…→pond_south_w` (rail already guards the corridor); keeps tap-to-walk on the scenic path instead of around the south shore. | Mild awkwardness (autopilot never crosses the bridge; oblique pond taps detour ~12 m) | S |
| 3 | **Collision twins for walk-through props.** Add circles: café tables (−8,−6.0)(−5.9,−6.0)(−3.8,−6.0) r≈0.55 (activate with `bakeryTablesOpen` or always-on — tables ship visible-in-world), marigold signpost (21.5,0.8) r0.3, bee-line cairn (8.2,−19.9) r0.4, mailbox (−9.8,7.2) r0.3, driftwood (5.85,13.8) r0.45, greenhouse planter bench (11.1,1.7) r0.5. Re-run slot sweep afterwards (tables sit 2.4 m south of Clara's bakery-porch slots). | Clip (player/NPC walk through furniture) | S–M |
| 4 | **Door/prop origins inside inflated boxes.** Move `bakery_door` def z −7.05→−6.8 and `copperwheel_door` −7.85→−7.6 (matching `*_PORCH_EXIT_POS`), and align `pond_driftwood` def x 6.5→5.85 with its visual. Interact radii still hold. | Mild awkwardness (authored approach points unwalkable; sliding must rescue) | XS |
| 5 | **`orchard_south→orchard_west` edge clip at 0.48** (0.023 m into `orchard_tree_mid`): nudge `orchard_west` to (−6.3,−17.3) or add a mid node. | Mild (slide-rescued bump) | XS |
| 6 | **NPC arrival vs player seat race:** in the arrival branch (simulation.ts:760–771) skip the warp when `world.playerSeatId === rt.reservedSeatId` (let `seatStolenByPlayer` re-select). | Mild (1-frame overlap) | XS |
| 7 | **Docs & test hygiene:** ARCHITECTURE.md §4 “33-node” → 50 nodes/63 edges; vegetation.ts:449 pond-box comment; add `walkability.test.ts` (dispatcher routing + `resolveSeatStandPos` + radial determinism); delete dead `sprintHeld` clause (playerController.ts:138). | Mild (maintenance/drift) | S |

**Overall verdict:** the collision/nav/scene triple is in unusually good sync (all buildings, orchard, wilds twins match to the decimeter; interiors are mirror-tested), and physical connectivity is essentially complete (99.96 %). The systemic weakness is that the graph and its tests are calibrated to NPC radius (0.38/0.42) while the player walks at 0.48 — producing exactly two player-visible defects (Rise deck, bridge routing) plus a handful of walk-through props.
