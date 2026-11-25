# Willow Square Spatial Redesign — Implementation Record (Stage 3 continuation)

Branch `stage3/fishing-v11-west-brook`, base = origin/main `fa5dcfc` (verified 2026-11-25).
Commits: `1b35691` (spatial redesign) → `51a50c6` (merge of origin/main) → review-round fix
commit + this doc. This is the environmental half of the Stage 3 workstream: the fishing
v1.1 slice (`df3e7f1`, doc 04) is preserved intact and its West Brook Bank spot was
RELOCATED (not removed) by this redesign.

Authority: MASTER-ROADMAP.md §4/§6 (environmental quality, anti-chore, handcrafted
identity) + the Stage 3 spatial task brief. Every number below was measured, not
estimated: `scripts/probe_spatial_audit.ts` (grid walks the live modules) and the
committed browser evidence `download/asset-qa/stage3-spatial/{baseline,after,after2}/`.

## 1. Baseline audit (what was actually wrong — measured, then seen)

| Feature | Measured baseline | Verdict |
|---|---|---|
| Fountain | total height 2.86u vs house roof peaks ≈ 4.3u — the SHORTEST landmark in town | "birdbath" confirmed |
| Hollow oak | trunk top 2.9u, canopy top 4.8u ≈ house roofs; canopy spread 4.6u | "slightly larger ordinary tree" confirmed |
| Mirror Pond | visual water 29.1 u², shoreline 21.8u, box 42.9 u²; one bench + jetty + driftwood | destination quality absent |
| West Brook | a 1.7u-wide culvert slot fully hidden UNDER a 5.1u bridge (2/3 of the bridge crossed dry ground) | invisible; not a place |
| Cedar bridge | deck 1.86u wide but walk strip 0.42u (rail-inflated); arch 0.42u over a 1.7u channel | token miniature confirmed |
| Player body | radius 0.48 (exterior), walk speed 3.6–7.6; camera fov 28°, offset (19.5, 18.2, 19.5)×zoom 0.55–1.75 | all redesign ratios derived from these |
| Ghost/squeeze | 12.86% of the world center-walkable-but-body-blocked; razor corridor oak↔rail 0.19u at z≈14 | real pinch points |
| Buildings | 6 footprints 43.5–54.4 u² (12.5% of world), gaps 3.2–6.4u, walls 2.48–2.75u | **healthy — left untouched** (the compactness feeling was landmark scale + camera, not buildings) |

## 2. What changed (three slices, dependency-ordered)

### Slice F1 — Fountain landmark (plaza)
`STORYBOOK_FOUNTAIN_SPEC`: finial tip 2.86 → **4.45** (rig Box3 4.81), lower-bowl rim
y 1.56 → 2.30 (r 1.15 → 1.30), upper tier y 2.26 → 3.30 (r 0.72 → 0.85), pedestal lathe
re-profiled. Footprint byte-identical (basin/coping/apron radii, collision r 2.46, wish
splash r 1.18, weir landing 1.22) — clearance contracts, NPC circulation and the
botanical-dressing plaza-calm test untouched. Renderer crown/upper droplet anchors now
read the SPEC (hardcoded 2.86/2.15 removed). Dry clog state is the correct unrepaired
narrative; repaired-state water/cascades/droplets captured in `after2_*_repaired/close`.

### Slice O1 — Hollow Oak monumental rebuild
Re-composition, not a scale: flared LatheGeometry trunk (r 1.12 → 0.60 over 3.3u), 7 root
buttresses gripping to the walkable rim, 5 expressive boughs, 8-lobe canopy — measured
rig height 4.8 → **7.98u** (tallest silhouette, above the gazebo ≈ 5.2u), spread ≈ 8.0u,
canopy top ≈ 7.5u. LOGICAL collision unchanged (r 1.35 at −6.2,15.6) → zero
walkability/nav/fishing-spot change; canopy is ground-clear overhead. Merge discipline:
24 meshes → **8** (bark merged, canopy per tone, moss merged). Hollow enlarged
(opening ≈ 0.55u) and swung toward the default NE camera (review round 2).

### Slice W1 — Watershed: pond, brook, bridge, shores
- **Pond NE lobe**: `pond_water_east` box (5.68..6.3 × 12.3..15.2); visual water
  29.1 → **44.5 u²**, shoreline 21.8 → **39.0 u** (outline exported as
  `POND_OUTLINE_SHAPE_POINTS` so the headless battery verifies containment + growth).
- **West Brook run**: `west_brook_run` box (−11.6..−4.4 × 13.3..14.9) — the stream leaves
  the culvert and runs **7.2u west** under the oak; banks planted, mid-stream boulders,
  bank rocks/reeds. The oak overhangs it; Toby's lean-to moved to its north bank
  (homePos + morning slot (−4.6,12.2), golden (−4.9,12.6) — residents.ts, sanitizer-clean).
- **Arch bridge rebuild**: deck 2.5u wide, arch peak **0.95** (getGroundHeightAt region
  x −4.35..−2.0 × z 12.25..15.75, feathered), span shortened to the real channel,
  stone abutments + wing walls + culvert rings (r 1.0) + spandrel cheeks, stepped cedar
  railing, retained lantern; walk strip 0.42 → **0.71u** (`bridge_west_rail` moved west to
  −4.0..−3.88); ~40 meshes → **8** (per-material merge).
- **East pond bench**: new `seat_pond_east` (8.15,17.3, facing the water; approach
  7.15,17.3 — collider margin 0.10u) + collision twin; the pond is now a two-seat
  destination facing the lobe.
- **Driftwood nook**: relocated to the lobe's east bank (prop 6.9,14.5; approach 7.4,15.1;
  canvas group + progressionPresentation Toby card in lockstep).
- **Brook-bank fishing stand**: `west_brook_bank` moved to the stream's north bank
  (−5.5,12.35) — the old south-bank lane is now the brook. fishing.ts spot def, worldMap
  row, `fishingRigs.ts` placement (planks −6.15..−7.25 @ z 12.70, creel, rod over the
  bank) and the nav mirror all moved in one lockstep edit. Once-per-day gate, RNG streams,
  pools, prose tables unchanged (spot-independent by design).
- **Navigation**: `bridge_north` (−4.65,11.45), `pond_bank_sw` (−5.0,12.2) rerouted north
  of the brook, deck chain compressed to the arch span (entry (−2.9,10.9) → exit (−2.9,16.4)),
  edge `pond_bank_sw↔rail_corner_sw` removed, `pond_west_top↔pond_bank_sw` added.

## 3. Navigation & collision verification (independent R-NAV audit)

- 946/946 tests; probe: walkable 67.7 → 66.9% (the delta IS the new purposeful water);
  pinch hotspots unchanged from baseline (all pre-existing furniture clusters); **no new
  sub-1.2u corridor** (deck 0.71u acknowledged single-file, brook north lane 4.52u,
  east-bench lane 3.20u, driftwood lane 1.72u).
- Connected-component scan: **1 walkable component** — zero sealed pockets.
- 62/62 nav nodes, 8/8 seat approaches, 50/50 resident anchors, 44/44 extra-activity
  anchors walkable; **72/72 all-pairs routable** at r 0.38 and 0.48; **76/76 edges LOS-clean**.
- Bridge height contract continuous (feathered approaches < 0.1u, SPAT-02).

## 4. Spatial invariants battery (new, `src/scene/spatialInvariants.test.ts`)

SPAT-01 visible water ⊆ logical exclusions (deck strip excepted) · SPAT-02 deck walk
strip ≥ 0.6u at five stations + arch height/feather contract · SPAT-03 destination
anchors walkable + A*-reachable (east bench, both fishing spots, driftwood, jetty) ·
SPAT-04 silhouette hierarchy lock (oak top > fountain tip > house roofs; oak spread ≥ 6.5u)
· SPAT-05 pond growth lock (area ≥ 38 u², shore ≥ 30u) · SPAT-06 razor-corridor closure
(old oak-rail squeeze is now water; north-bank lane comfortable). Meaningful invariants
only — no per-coordinate brittleness beyond the contract anchors.

## 5. Visual evidence (real engine, deterministic injected saves)

`download/asset-qa/stage3-spatial/`: `baseline/` (7 shots), `after/` (7), `after2/` (7,
incl. repaired-fountain states). Desktop 1440×900 + mobile 390×844; far/normal/close
zooms via the camera QA hook. Captures driven by `scripts/qa_spatial_*.sh`.

## 6. Independent adversarial review (three reviewers, none the author)

- **R-NAV** (PASS-WITH-CONCERNS): findings = east-bench approach margin 0.05u
  (FIXED → 0.10u), driftwood anchor 0.12u from lobe inflated edge (accepted, pinned by
  SPAT-03 — future box growth must move the anchor consciously), comment rounding NITs.
- **R-VIS** (PASS-WITH-CONCERNS): MAJORs = brook readability (FIXED: banks widened,
  run 4.8 → 7.2u, boulders), arch profile (FIXED: peak 0.95 + rings + cheeks), oak hollow
  (FIXED: enlarged + re-aimed), fountain "dry" (DISPOSITIONED: correct unrepaired state;
  repaired evidence added); MINORs = canopy-vs-cottage (FIXED: lobe eased), root/footing
  clip (FIXED: roots trimmed), pond SE hard edge (FIXED: rounder lobe outline),
  mobile HUD title truncation (PRE-EXISTING location-card behavior, out of scope),
  orphan SW path slabs + empty southern meadow (PRE-EXISTING, recorded as remaining
  limitations), NPC/rail depth read on bridge (accepted isometric layering).
- **R-INT** (PASS-WITH-CONCERNS): scope clean (34 files, no accidental deletions, no
  secrets), game-layer import law clean, zero new wall-clock/RNG usage, persistence
  untouched (migrations/storage/types diff vs fa5dcfc = empty beyond the pre-existing
  additive `west_brook_bank` enum), oak 24→8 / bridge 40→8 mesh claims verified,
  community rigs (pondMosaic/plazaGarland/orchardLanterns) byte-identical and passing,
  merge resolutions verified. Cross-workstream finding handed over: **pondMosaic.ts
  parents its rig to exteriorRoot with pond-LOCAL coords (0.62,2.28) — the tiles render
  near the plaza, not on the pier step (world 2.22,16.28)**; byte-identical to merged
  PR #34, pre-existing, NOT fixed here (community owners' contract).

## 7. Gates (local, exact commits)

- `1b35691` (redesign): tsc clean; **813/813** (807 v1.1 + 6 SPAT); vite build green.
- `51a50c6` (merge of fa5dcfc): tsc clean; **946/946**; build green (2.44s).
- Review-round fix commit: tsc clean; **946/946**; build green.
- WorldState stays **v12** — zero persistence change (the redesign changes geometry and
  scene only; residents.ts slot coords are runtime schedule data, not persisted state).

## 8. Remaining limitations (honest)

1. The brook is a 1.6u stream — deliberately modest; it reads as a stream, not a river.
2. Bridge traversal stays single-file (0.71u walk strip) — comfortable, not two-lane.
3. Southern/eastern meadows remain open grass (pre-existing); the redesign deliberately
   did NOT fill them (purposeful space ≠ uniform density); future content should claim
   them the way the pond district was claimed.
4. Mobile location-title truncation and the SW orphan path slabs are pre-existing UI/
   dressing items outside this workstream.
5. pondMosaic placement finding belongs to the community-workstream owners (§6).
6. Software-WebGL captures are not real-device verification; the standard on-device
   visual pass remains the owner's step.
