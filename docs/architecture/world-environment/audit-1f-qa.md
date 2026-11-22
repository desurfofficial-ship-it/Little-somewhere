# Audit 1-f — Independent World QA (adversarial)

- **Auditor:** Task 1-f (independent; did not read 1a–1e reports)
- **Date:** branch `feat/world-environment-living-world` @ `07be49c`
- **Method:** full baseline run + throwaway programmatic probes (`/tmp/wqa1f/*.ts`, NOT in repo) importing `src/game/worldMap.ts` + `src/game/navigation.ts`; source-level greps for scene contracts. READ-ONLY audit; only this file was written.

---

## 1. Baseline gate results

| Gate | Result |
|---|---|
| `npx tsx --test src/game/*.test.ts src/scene/*.test.ts` | **595 tests, 595 pass, 0 fail, 0 skipped**, duration 17.28 s, exit 0 |
| `npx tsx scripts/check_layer_boundaries.ts` | **OK** — 61 game / 61 scene / 11 component files, game layer acyclic. One sanctioned warning: `journal.ts window.localStorage` (W5, doc 02, deferred to Phase E5) |
| World test subset run 2× (`navigation/worldMap/environment/exploration/wilds/orchard`) | 32/32 pass both runs; **no flakiness** (only bench-test timing variance 3.9→18.4 ms, non-assertive) |

---

## 2. Connectivity truth check (programmatic)

**Nav graph:** 50 nodes, 63 edges, **1 connected component**. All 63 edges have line-of-sight at NPC radius 0.38. All 50 nodes walkable at 0.38. **0 nodes inside any obstacle footprint at 0.38.**

**Landmark pair matrix (15 anchors, 105 pairs): 0 unreachable pairs.** All anchors reached a LOS nav node; one anomaly (see WQA-01): `foxglove_rise` approach point had **no LOS nav node at player radius 0.48** (fallback `bestAny` used).

Anchor→node: fountain→plaza_east (0.60 m), gazebo→gazebo_east (3.09 m), noticeboard→east_north (2.47 m), tea_cart→plaza_nw (0.69 m), orchard_gate→orchard_gate (0.73 m), bridge→plaza_sw (8.81 m — pond_bank_sw has no LOS from deck center at 0.48), foxglove_rise→rise_deck (NO-LOS fallback), old_stone_well→sorrel_hollow (0.85 m), sorrel_hollow→sorrel_hollow (0.88 m), marigold_lane→marigold_bank (2.20 m), bakery_door→west_north (2.90 m), booknook_door→book_nook_door (1.61 m), copperwheel_door→copperwheel_yard (4.78 m), greenhouse_door→greenhouse_walk (1.96 m), cottage_door→willow_porch (1.81 m).

**Ghost zones (8 000 uniform samples, player radius 0.48):**

| Metric | Value |
|---|---|
| World area | 50 × 46 m = 2 300 m² |
| Walkable | 5 496 / 8 000 samples = **68.7 %** of world |
| Walkable-but-nav-unreachable ("ghost") | **460 / 5 496 = 8.37 % of walkable area** (~132 m², 5.7 % of total world) |
| Ghost that is physically walkable-in (grid BFS 0.2 m, 8-conn from spawn) | 456 / 460 sampled; only ~14 sealed grid cells total (0.04 % of walkable) |
| Ghost clusters | far-west margin x[−25,−17] both z halves (~92 % of ghost samples), orchard south fringe z[−23,−16] x[−9,8] (5), SE rise-south sliver z[20,23] (1) |

Interpretation: the whole western lawn (west of book nook/cottage column, z −23…+15) and the orchard's south edge are walkable but have **zero nav nodes within LOS** — residents can never be scheduled there, and player tap-walk paths into these pockets end in slide-stuck bumps (WQA-03/04).

**Path-validity probe (`computeWaypointPath` from spawn, player radius 0.48):** 3 of 15 destinations return paths with ≥1 segment that fails `hasLineOfSight` at 0.48:
- `spawn→foxglove_rise`: seg `rise_base→rise_deck` blocked at (21.56, 18.14); final seg blocked at node itself
- `spawn→old_stone_well` / `spawn→sorrel_hollow`: seg `pond_bank_sw→pond_south_w` blocked at (−4.16, 16.16)

Root causes: (a) node/edge set validated only at NPC radius 0.38 (navigation.test.ts:70-122); (b) `findNearestNavNode` falls back to nearest-ANY node without LOS (navigation.ts:211); (c) A* exhaustion silently returns a straight line `[ {to} ]` (navigation.ts:304).

---

## 3. Collision sync check

**Obstacle→visual (35 circles + 13 boxes, ±0.5 tolerance against 11 scene builder files): 48/48 matched — 0 obstacles without a visual.**

**Visual→obstacle (87 builder `position.set` with footprint > 0.8 m; 5 far from any obstacle center):**
4 false positives on manual inspection — brooklet water bed (flat 0.04 m, wilds.ts:552), pond skip-ledge (inside pond_water box, vegetation.ts:624), bench glow pool (additive light, reactiveProps.ts:209), greenhouse cold frame (world (17.32, 2.1) via group origin (14.3, 1.7) at buildings.ts:1413 → inside greenhouse box).
**1 real mismatch → WQA-05** (signpost comment vs missing obstacle).

---

## 4. Environment contract check

**`computeEnvironmentState` flags (narrative.ts:43-71) — no dead contracts.** Scene consumers: plantersBloomed (environmentRenderer.ts:272), fountainFlowing (:282-291, :506), ivyCleared (:276), bellGleaming (:277), reconciledTogether (:278), bakeryTablesOpen (:279), orchardGatheringOutcome (:324), festoonLanterns (:410). `noticeboardUpdated` has **no direct scene consumer** but is alive via the indirect chain progressionVisuals.ts:387→444 (`housekeeping.noticeboardGlint`) → environmentRenderer.ts:302 (documented at environment.ts:293-296).

**Weather discriminants: all 4 handled.** `sunlit` / `breezy` / `misty_morning` / `light_rain` all appear as effective-weather branches in environmentRenderer.ts (:352, :383, :430-444, :468, :493-494, :608, :642, :662-663, :692, :735-752). **0 unhandled weather types.** Seasons: all 4 applied in the renderer (:216-224, :244-246, :492, :663, :694).

---

## 5. Interior state check

Actions can set exactly 5 interior ids (actions.ts:2126 cottage, :2171 greenhouse, :2678 bakery, :3023 nook, :3301 copperwheel). **NeighborhoodCanvas handles all 5** (rig visibility :1782-1786, camera paths :270-312, App UI mapping App.tsx:1194-1203); `walkability.ts:29-54` and `migrations.ts:1222-1289` cover all 5 with walkable-reset fallbacks. Every `enter*` action stores a walkability-validated `exteriorPlayerPos` and spawns at a door anchor; every `exit*` re-validates with `PLAYER_SPAWN` fallback. Storage day-roll ejects wake-in-greenhouse/bakery/nook/copperwheel to a validated porch pos (storage.ts:555-618). **No unhandled interior id; no live stranding path found.** Defense-in-depth note → WQA-06.

---

## 6. Test coverage gaps (world-critical invariants with NO test)

1. **Player-radius (0.48) nav validation** — navigation.test.ts checks nodes/edges/paths only at 0.38 (lines 70-122). WQA-01/02 pass CI today.
2. **All-pairs landmark reachability matrix** (15×15) — only single-component + a few curated routes are tested.
3. **Ghost-zone coverage metric** (% walkable with LOS to nav graph) — untested.
4. **Obstacle↔visual mirror tests** exist only for orchard + wilds subsets; bakery, book nook, workshop, greenhouse, cottage, fountain, gazebo, benches, tea cart, noticeboard, pond, bridge have no mirror test.
5. **Returned-path segment continuity** — test asserts each waypoint walkable, never `hasLineOfSight` between consecutive waypoints (WQA-04's snagged legs invisible).
6. **Dead-contract guard** — no test that every `playerChanges` flag / weather discriminant has a scene consumer (grep-level contract).
7. **Wake-in-interior ejection** for greenhouse/bakery/nook/copperwheel day-roll (storage.ts:607-618) — partially exercised; no dedicated assertions on exit-pos walkability per interior.

---

## 7. Severity-ranked defect register

| ID | Sev | Finding | Evidence | Minimal fix |
|---|---|---|---|---|
| **WQA-01** | High | Foxglove Rise ramp→deck pinch is not player-safe: `rise_mound_west_of_ramp.maxX=20.8` vs `rise_mound_east_of_ramp.minX=22.0` leaves only **0.24 m** corridor at r=0.48; nav node `rise_deck` (21.6,18.45) is **unwalkable at 0.48** (inside east-of-ramp +radius band) though walkable at 0.38; tap-walk to the lookout bench/vista snags (2 blocked segments) | navigation.ts:64; worldMap.ts:86-90, :475-480; NeighborhoodCanvas.tsx:1618/1652/2325 (player walks at 0.48); probe: `isPointWalkable(21.6,18.45,0.48)===false` | Widen ramp gap to ≥ 1.05 m (e.g. west-of-ramp.maxX→20.55, east-of-ramp.minX→22.25 with matching mound visuals) **and** move `rise_deck` node north into deck center (≈21.6, 18.8) |
| **WQA-02** | Med | Nav edge `pond_bank_sw→pond_south_w` corner-cuts `bridge_west_rail` at player radius: blocked at (−4.16,16.16) @0.48; at NPC 0.38 clearance is only ~0.02 m | worldMap.ts:83 (rail box); navigation.ts:96 (edge); probe segment dump | Add waypoint (−4.35, 16.9) splitting the edge, or move `pond_south_w.x` to −4.35 |
| **WQA-03** | Med | **Ghost zones = 8.37 % of walkable area**: far-west margin x[−25,−17] z[−23,+15] and orchard south fringe have no LOS nav node → resident sim & tap-walk A* cannot serve ~132 m² of physically walkable map | navigation.ts:13-79 (no nodes west of x≈−9.5 except sorrel trail z≈18.3); ghost sample list in §2 | Add 4-6 nodes along west margin (x≈−20, z −18…+14) wired to west spine / sorrel trail + 1 node behind orchard south row |
| **WQA-04** | Med | Silent nav failure: `computeWaypointPath` returns straight-line `[{to}]` on A* exhaustion (navigation.ts:304) and `findNearestNavNode` falls back to nearest-ANY node without LOS (navigation.ts:211) → callers receive impossible paths with no signal; walkers slide-stuck bumping final waypoint | navigation.ts:211, :304; probe: 3/15 spawn→landmark paths contain blocked segments at 0.48 | Return `null`/`{ path, reachable }`; make callers (simulation.ts:727/795/998, NeighborhoodCanvas tap-walk) handle unreachable explicitly |
| **WQA-05** | Low | Carved lane signpost visual at (21.5, 0.8) claims obstacle `lane_signpost` that **does not exist** in worldMap.ts — players clip through post (footprint < 0.8 m, cosmetic) | wilds.ts:680 comment; worldMap.ts:124-132 has only `lane_boulder_n/s` | Add `CIRCLE_OBSTACLES` entry `lane_signpost` r≈0.18 or correct the comment |
| **WQA-06** | Low | Day-roll inherits `occupancy`/`activeActivity` via spread without defensive clear (storage.ts:601-668); safe today only because the sole sleep path (cottage bed) forces nook exit first (actions.ts:3037-3060 clears occupant) | storage.ts:601-668; occupancy.ts:54-58 | Clear `occupancy`/`activeActivity` in the rolled state when waking outside the nook |
| **WQA-07** | Info | World nav tests validate only NPC radius 0.38; player radius 0.48 untested — the enabling gap behind WQA-01/02 | navigation.test.ts:70-122 | Add a 0.48 sweep mirroring the existing 0.38 assertions |
| **WQA-08** | Info | `noticeboardUpdated` reaches the scene only indirectly (progressionVisuals.ts:387,444 → environmentRenderer.ts:302); alive but fragile chain — no dead env flags, all 4 weather + 4 season discriminants handled (verified §4) | environment.ts:293-296; progressionVisuals.ts:444; environmentRenderer.ts:302 | Optional: document chain in shared contracts (master-architecture/06) |

---

## Verdict

World baseline is healthy: 595/595 green, layer boundaries intact, nav graph fully connected (105/105 landmark pairs reachable), obstacle/visual sync 48/48 forward-clean, no dead environment contracts, no interior stranding paths. The material defects concentrate in one theme — **the nav layer is validated at NPC radius 0.38 while the player walks at 0.48** (WQA-01/02/04/07) — plus a nav-coverage hole on the west margin (WQA-03). All fixes are small and localized to `navigation.ts` node/edge tables and `worldMap.ts` mound boxes.
