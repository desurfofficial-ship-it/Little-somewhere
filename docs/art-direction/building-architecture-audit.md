# Building Architecture Quality Audit — LITTLE SOMEWHERE

**Audit date**: 2026-11-20
**Auditor role**: Senior Three.js Environment Artist / Architectural Modeller / Technical Art Director
**Method**: Direct source inspection of `src/scene/builders/buildings.ts`, `src/scene/builders/landmarks.ts`, `src/scene/builders/vegetation.ts`, `src/scene/builders/orchard.ts`, `src/scene/prototypes/willowLaneDiorama.ts`, the five interior builders under `src/scene/builders/*Interior.ts`, `src/game/worldMap.ts`, and the interior bounds/walkability modules (`src/game/cottage.ts`, `bakery.ts`, `bookNook.ts`, `copperwheel.ts`, `greenhouse.ts`). All dimensions below are computed from the actual geometry constants in those files — nothing is estimated from screenshots.
**References**: `docs/art-direction/VISUAL_IDENTITY.md` (Premium Handcrafted Storybook Diorama), `docs/art-direction/VISUAL_QUALITY_STANDARDS.md` (per-domain review gate), `docs/art-direction/VISUAL_AUDIT.md` (2026-11-18 baseline audit, largely remediated), `docs/art-direction/VISUAL_TRANSFORMATION_ROADMAP.md` (Stage 2 — Signature Architecture).

**Scope guard**: This document is AUDIT ONLY. It changes no gameplay code, no building geometry, no collision footprints, no interaction positions, and adds no dependencies. The Copperwheel Cottage (Arthur) content is owned by another agent; it is assessed here for context, but its improvement items are flagged for coordination, not for unilateral execution.

---

## 1. Executive Summary

The neighborhood's architectural quality is **highly uneven — and the unevenness is systematic, not random**. LITTLE SOMEWHERE contains a small set of genuinely premium architectural assets (Willow Step Cottage, Old Bell Gazebo, Mossy Stone Fountain, Mirror Pond & Cedar Footbridge, Fern Hollow Orchard) and a set of buildings that all descend from **one shared parametric template** (`buildStorybookCottageCore`, `buildings.ts:98–317`) whose differentiation budget is only a roof texture, a wall color, and 2–4 loose props. The result is exactly what a player articulates informally: *"every building looks like the same house with a different paint job, the greenhouse is a glass box, and the interiors are one small room no matter how big the house looks."* That perception is **measurable and correct**:

1. **Template monoculture.** Four of the six named buildings (Bakery, Book Nook, Copperwheel, Pinecone Woodshop) are the *same 5.2–5.4 m deep gable box* with wall heights within a 0.27 m band (2.48–2.75 m), the same single extruded bevel roof (no dormers, no gable windows, no secondary masses), the same box chimney, the same lone window per wall, and the same door group. Their silhouettes are distinguishable only by roof tint. Against VISUAL_QUALITY_STANDARDS §A.4 ("never identical recolored clones"), three of the four fail the spirit of the gate.
2. **Sunbeam Greenhouse is the weakest named building.** Despite being the project's designated "glass flower house," it is one translucent box (`5.55 × 2.25 × 5.15`), one unglazed-bar glass gable, five corner posts, a plain stone box dwarf wall, a floating legless potting bench, **no door leaf in its own builder**, no roof vents, no eaves, no gutters, no exterior planting program — plus a **decoy entrance frame 1.50 m away from the real doorway** and an **exterior-west / interior-east door-side contradiction**.
3. **The "big house outside, small room inside" effect is real and quantified.** The game reserves generous building plots (`BOX_OBSTACLES`, 43.5–54.4 m² each), the visible exteriors occupy only 52–69 % of those plots, and every interior is a **single-room studio** (24.0–37.8 m² gross walkable, flat ~2.5–2.7 m ceilings) with no hallway, no second floor, no implied back rooms — while the exteriors carry 1.6–2.1 m of gable attic volume and, in Willow Step's case, a dormer that explicitly promises an upper floor. The disconnect is not that interiors are "small" per se — Willow's room is 37.8 m² — it is that **the interior program (one room, everything in it) contradicts the exterior promise (a full cottage)**.
4. **The pond is not lazy — it is a benchmark.** Mirror Pond is one of the strongest objects in the project (spline-outline basin, custom shader water, koi, lily pads, cattails, pier, footbridge). If anything deserves the "assembled by a lazy dude" complaint, it is the shared cottage core and the greenhouse, not the pond.

**Overall verdict**: the project does not have a *lazy* art team — it has an **inconsistent differentiation budget**. The fix is not a redesign of the visual identity (explicitly out of scope); it is to bring the four template buildings and the greenhouse up to the craft floor that Willow Step Cottage, the Gazebo, and the Pond already prove this codebase can hit.

---

## 2. Complete Building-by-Building Quality Assessment

Ratings use the three-scale silhouette rule from VISUAL_IDENTITY.md §3: **P**rimary mass / **S**econdary framing / **T**ertiary story accents, plus grounding, openings, uniqueness, and storytelling.

### 2.0 Shared core — `buildStorybookCottageCore` (buildings.ts:98–317)

The single most consequential piece of architecture code in the project. What it provides, verified:

| Element | Implementation | Verdict |
| --- | --- | --- |
| Foundation | Two-layer stone plinth `+0.48/+0.56` overhang, cap rail | Good — matches §A.1 |
| Walls | Single box `width × wallHeight × depth`, one flat color | Functional; zero wall articulation (no wainscot band, no sill beam, no quoins) |
| Framing | 4 corner posts only (`0.26 × 0.26`), no intermediate studs, no lintels | Minimal — below Willow Step (which adds sill band + quoins) |
| Roof | One extruded bevel gable, ridge cap box; overhang `0.46` | Passable; **no fascia/bargeboards, no gutter, no dormer, no gable window, no secondary gable** |
| Chimney | One box `0.82 × 2.0 × 0.82` + rim + pot | Flat single-volume stack; below Willow Step's 3-part tapered stack |
| Door | Recessed frame + leaf + knob + glazed light + stoop + lower step + bracket lantern | Good — best part of the core |
| Windows | `addRecessedWindowWithPlanter` on south/east/west faces only — **the north wall can never carry a window**, and every door-side eliminates one more face; in practice **every core building ships with exactly 2 windows** (`1.1 × 1.12`) | Severely under-windowed for walls 5.2–6.4 m wide; no gable/attic lights |
| Grounding | `addContactShadow(width+2.4, depth+2.4)` | Good |

**Consequence**: every building built on this core inherits the same fingerprint. Per-building builders can only add props *around* the box; they cannot change massing.

### 2.1 Willow Step Cottage (player home) — `willowLaneDiorama.ts:135+` — **TIER A (benchmark)**

- Plot `player_cottage` 7.4 × 6.4 (47.4 m²); wall mass 5.0 × 4.9 × 2.45 + 1.48 m covered porch; total height ≈ 4.93 m + finials.
- Secondary craft: stepped two-course plinth, timber sill band, corner posts **with stone quoins**, plaster gable infill under bargeboards, 4 cream bargeboards, ridge beam, **two turned gable finials**, east-slope **dormer** with its own mini gable roof, 3-part tapered fieldstone chimney **with pooled smoke puffs**, covered east porch on 4 stone-pad posts with knee-brace rafters, porch railing with 3 balusters per side, doormat, porch bench + throw + mug.
- Openings: paneled cedar door with glazed upper light + brass handle; lantern on bracket.
- Seasonal contract: porch pot ×4 seasons, step tufts ×3, wreath, winter rail frost (R5 Pass 18) — the only building whose exterior is season-gated at this granularity.
- **Shortcomings (minor)**: no gable loft window in the north/south gable triangles; garden strip west of the house is generic; the dormer is decorative only (interior has no loft acknowledgment); no visible gutters.

### 2.2 Hearth & Crumb Bakery (Clara) — `buildings.ts:323–387` — **TIER B−**

- 6.4 × 5.2 × 2.75 terracotta roof, south door, striped awning on posts; bake-oven dome bump-out on west gable (base + half-sphere + pipe); display shelf with 3 loaves; chalkboard A-frame. Plot 8.0 × 6.8 (largest reserved plot, 54.4 m²).
- **What works**: the oven dome is genuine functional storytelling; awning posts are grounded (fixes the old P0); porch café tables add life.
- **Shortcomings**: silhouette is still the core gable box — from any isometric angle > 12 m the bakery reads as "cream cottage, terracotta roof"; the 6.4 m south facade carries a door + awning but the facade's *display* function (a bakery!) is one floating shelf and three loaves; no hanging shop sign; no flour/barrel/crate delivery story; gable triangles empty; chimney is the default core stack (the *bakery's* chimney should be the neighborhood's most characterful — it is not); the west oven bump-out is a stub (1.1 wide) that could anchor a whole bakehouse wing.

### 2.3 Linden Book Nook (Nora) — `buildings.ts:439–499` — **TIER C+**

- 5.4 × 5.2 × 2.58 sage roof, east door, burgundy awning, rolling book cart (6 books), one crate. Plot 6.8 × 6.4.
- **What works**: cart wheels/leg construction is honest joinery; book color variety is good micro-story.
- **Shortcomings**: **the weakest identity of the four core buildings** — after the awning, cart, and crate there is nothing that says "bookshop" on the building itself. The builder docstring promises a "bay reading shelf" that does not exist in geometry. No bay window (the classic bookshop cue), no window-seat storytelling, no hanging sign, no stacked-book window display, gable triangles empty, and only 2 windows (east wall is the door; the core never lights the north wall, so just south + west). It is one recolor away from being the Woodshop's twin.

### 2.4 Copperwheel Cottage (Arthur) — `buildings.ts:504–599` — **TIER B** *(other agent's ownership)*

- 6.2 × 5.4 × 2.62 slate roof, south door, gable brass clock emblem (torus + cylinder face), roof vent pipe + elbow + cap, 8-tooth gear medallion, bolted crate + leaning ruler. R-07 pass already notes "Copperwheel was the thinnest-dressed building" and fixed it.
- **Shortcomings**: still core-box massing; clock is a flat emblem, not a works-driven feature (no gable clock case, no pendulum window); slate roof + gray-white walls make it the coldest building on the lane with no warm counterpoint. **Ownership note**: improvements here must be coordinated with the Copperwheel agent; this audit does not task them unilaterally.

### 2.5 Pinecone Woodshop (Barnaby) — `buildings.ts:604–638` — **TIER C−**

- 5.6 × 5.2 × 2.48 sage roof, west door, firewood rack (5 logs + end discs). Plot 6.8 × 6.4, southeast of the plaza.
- **Shortcomings**: **the most under-dressed named building in the project** — 34 lines of builder code, one prop cluster. No lumber stack, no sawhorse/workbench, no wood-chip pile, no shingle/sign, no hanging tools, no barrow, no workshop window glow story. For the neighborhood's *maker*, the exterior tells zero maker stories. It also fails the §A.4 uniqueness gate hardest: sage roof + east neighbor greenhouse also sage = visual twins on the same lane.

### 2.6 Sunbeam Greenhouse (Mina) — `buildings.ts:643–743` — **TIER D (weakest named building)**

Verified defects, in construction order:

1. **Dwarf wall is a plain stone box** (5.9 × 0.88 × 5.5 + cap). No coursing, no buttresses, no vent louvres — a conservatory plinth should be its most characterful masonry.
2. **The glazing is one translucent box** (5.55 × 2.25 × 5.15, `opacity 0.44, depthWrite: false`). No structural glazing divisions on the faces — glass panels, muntins, or sash bars are absent. The only framing is 5 vertical post pairs at the *side walls* (x = ±2.78); the front/back glass faces are completely unarticulated.
3. **Roof glass has zero glazing bars** — one extruded glass prism (5.9 × 1.62 × 5.36) + ridge cap. Real conservatories are read by their roof bars; from the isometric camera (which looks *down* at 28° FOV) the roof is the single largest visible surface of this building, and it is empty.
4. **No eaves, no gutters, no downpipes, no ridge vents / ventilators** — the ventilation features that make a conservatory read as a working glasshouse are absent.
5. **No door in the main builder.** The west "entry" is a solid wood slab (`0.22 × 2.35 × 1.38`, buildings.ts:702–706) + step — an architrave-shaped *wall panel*, not a door: no leaf, no glass, no handle, no aperture.
6. **Decoy entrance.** The real, beautifully built cedar doorway (`buildSunbeamGreenhouseDoorway` — leaf with rails, glazed window, brass knob, hanging lantern, planted sign, step, flanking pots) is placed separately in `NeighborhoodCanvas.tsx:819–822` at world **(11.14, 3.20)**, while the decoy frame in the main builder sits at world **(11.45, 1.70)** — **1.50 m apart on the same facade**. Players approach the interactable at `(10.15, 3.20)` and see two competing "entrances."
7. **Door-side contradiction.** Exterior entrances (both of them) are on the **west** wall; the interior room's door is built into the **east** glass wall (`greenhouseInterior.ts:258` "East glass wall with door opening", door mat at local x 2.15, `GREENHOUSE_DOOR_SPAWN (2.3, -0.4)` facing west). Every other building's exterior/interior door sides match; the greenhouse is the only one that teleports the player through the building. (All four other interiors: verified consistent.)
8. **Floating potting bench.** The interior-visible bench slab (`3.9 × 0.24 × 3.5` at y = 1.15, buildings.ts:709–711) has **no legs, brackets, or trestles** — a direct violation of §A.2 "zero floating geometry," visible through the glass from the outside.
9. **No exterior program.** No cold frames, no rain barrel, no tool rack, no wheelbarrow, no staging shelves against the dwarf wall, no herb beds, no path apron — the "gardener's building" has no gardening around it. Contrast: the bakery got an oven, shelf, and chalkboard.
10. **Proportions.** Total ridge height ≈ 4.37 m over a 7.0 × 7.0 plot — the shortest named building, sitting lowest on the lane, reinforcing the "shed" read.

### 2.7 Old Bell Gazebo — `landmarks.ts:17–259` — **TIER A (benchmark #2)**

Stepped octagonal dais + coping + south steps; 6 chamfered columns on plinth blocks with knee braces; balustrade with 5 spindles/span; octagonal ring beam + fascia; **two-tier shingled spire with cupola**; brass collar + orb + tip finial; lathe-profiled bell with lip torus, yoke, clapper (correctly `visible = false` until restored), rope + knot; 18-tuft ivy ring + trailing runners; festival ribbon ring. The only multi-tier roofline in the neighborhood — which is exactly why the single-tier cottages feel flat next to it.

### 2.8 Mossy Stone Fountain — `landmarks.ts:270+` — **TIER A**

Two-step octagonal apron, 8 buttress pilasters, lathe double-moulded basin, bullnose coping, scalloped catch-bowl with brass weirs, lion spouts, pineapple finial, custom ripple water, droplets. Fully satisfying §A.1–A.5; not a concern for this audit.

### 2.9 Mirror Pond & Cedar Footbridge ("Objects: Pond") — `vegetation.ts:416–867` — **TIER A (benchmark #3)**

**Verdict on the user's instinct to flag the Pond: the source does not support "lazy" here — this is one of the most-detailed objects in the project.** Verified inventory: organic 18-point spline basin outline (main pond + west culvert brook), teal bed + sandy shoal rim + deep center, 18 submerged pebbles, custom shader water at y = 0.105, 17 coping boulders with 7 moss tufts, skipping-stone ledge with 4 flat stones, cedar viewing pier (pilings, beam, 5 planks, mooring post, rope coil, lantern), moored walnut sailboat (hull, cabin, mast, sail, pennant), 3 animated koi, 6 notched lily pads + 3 layered blossoms, 4 cattail/iris clumps, 2 dragonflies; plus the footbridge: 2 stone abutments + caps, 11 individually cambered planks following the same arch function as `getGroundHeightAt`, 2 stringers, top/mid rails, 6 posts with brass finials, iron lantern.
**Honest minor notes (P2 polish, not defects)**: the water plane is perfectly flat, so banks read slightly "cut-out" where the spline meets grass; the culvert brook is a stub with no flow read; only 4 reed clumps for a 7.9 × 5.5 m basin; no bank-side path dressing (the pond interacts richly but sits in a bare meadow pocket).

### 2.10 Hollow Oak — `vegetation.ts:245–349` — **TIER A−**

Flared root buttresses with moss, two-stage gnarled trunk, framed cavity + dark void + brass glint, 3 forked boughs, 6-lobe layered canopy. Storybook-correct.

### 2.11 Fern Hollow Orchard — `orchard.ts:140+` — **TIER B+**

Six instanced season-tinted trees, stone-and-cedar gate with hanging lettered sign, leaning harvest ladder, crate-and-basket corner, skep on stool, stepping-stone path (per builder contract, positions mirror `CIRCLE_OBSTACLES` exactly). District-level dressing is above the cottage tier; the gate is the orchard's best architectural moment.

### 2.12 Street furniture — `landmarks.ts` (Tea Cart, Noticeboard, Benches) — **TIER A−**

Tea cart: spoked wheels, grounded legs, beadboard cabinet, 4 chamfered posts + striped scalloped awning (the old floating-canopy P0 is fully remediated). Benches are composite slatted assemblies with armrests. No audit concerns.

---

## 3. Weakest Buildings Ranked by Priority

| Rank | Building | Tier | Core reason |
| --- | --- | --- | --- |
| 1 | **Sunbeam Greenhouse** | D | Glass-box massing, no structural glazing, no door in builder, decoy entrance, floating bench, no exterior program, door-side contradiction |
| 2 | **Pinecone Woodshop** | C− | One prop cluster; no maker identity; roof-twin of the greenhouse on the same lane |
| 3 | **Linden Book Nook** | C+ | Recolor-only identity; promised bay window absent; weakest interior ratio (24 m² in a 43.5 m² plot) |
| 4 | **Hearth & Crumb Bakery** | B− | Good props, but silhouette-identical to the other three; facade under-merchandised; default chimney |
| 5 | **Copperwheel Cottage** | B | Post-R-07 props help; still core massing; *owned by another agent — coordinate* |
| 6 | **Willow Step Cottage** | A | Benchmark; minor elevations only |

---

## 4. Exact Shortcomings (per building, evidence-cited)

**Sunbeam Greenhouse** — `buildings.ts:643–743`, `NeighborhoodCanvas.tsx:819–822`, `greenhouseInterior.ts:258`, `greenhouse.ts`:
glass faces have no mullions/sash bars (only 5 side post-pairs, buildings.ts:690–696); roof prism has no glazing bars (678–687); no vents/eaves/gutters anywhere in the builder; entry is a solid slab, not a door (702–706); decoy frame at world (11.45, 1.70) vs real doorway at (11.14, 3.20) — 1.50 m apart; interior door east vs exterior door west; potting bench `3.9 × 0.24 × 3.5` at y = 1.15 floats with no supports (709–711); ridge height 4.37 m is the lowest of all named buildings; no exterior planting/equipment props.

**Pinecone Woodshop** — `buildings.ts:604–638`:
total builder body = 34 lines; single prop system (firewood rack, 5 logs); no trade signage, no lumber/sawhorse/chips/barrow/tools; shares sage roof cache family with greenhouse (`barnaby_sage_roof` vs gazebo `sage_shingles` textures — distinct caches but same tint family); west door faces the map edge rather than the lane.

**Linden Book Nook** — `buildings.ts:439–499`:
identity props = cart + crate only; docstring claims "bay reading shelf" with no bay geometry; only 2 wall windows (north + west); gable triangles empty; smallest interior (5.0 × 4.8) against a 6.8 × 6.4 plot.

**Hearth & Crumb Bakery** — `buildings.ts:323–387`:
massing identical to core; display = 1 shelf + 3 loaves floating on wall brackets (no corbels, `buildings.ts:360–368` — technically wall-mounted but visually thin); no hanging sign; oven bump-out is 1.1 m wide stub with no work surface, no wood store; chimney is default core stack (215–224); gable triangles empty.

**Copperwheel Cottage** — `buildings.ts:504–599`:
massing identical to core; clock = flat torus + disc on the gable (526–531); slate + `#E1DFD5` walls = coldest palette on the lane; ownership red line applies.

**Willow Step Cottage** — `willowLaneDiorama.ts`:
no gable loft windows in either gable triangle (273–286 infill is blank plaster); dormer is exterior-only (interior has no loft echo); no gutters; west/north garden strips rely on generic courtyard props.

**Mirror Pond** — `vegetation.ts:416–867`:
flat water plane at y = 0.105 meets the shoal rim in a hard line; brook culvert has no flow animation; only 4 reed clumps; meadow pocket around the basin is under-dressed vs the plaza.

---

## 5. Specific Geometry & Detailing Improvements

All proposals stay inside each building's existing `BOX_OBSTACLES` plot and preserve every interaction point; they are additive visual geometry on the existing builder seams.

### 5.1 Sunbeam Greenhouse → "Sunbeam Conservatory" (full concept in §6)
- **Structural glazing**: replace the single glass box with a panelized cage — bay spacing 0.95–1.05 m across the 5.55 m width; each bay gets a glazing bar grid (vertical stiles + 1–2 horizontal transom bars) in the existing `woodMat`; front/back faces get the same treatment. Glass stays a single cached material; bars are thin boxes (`0.06–0.08`) merged per face to control draw calls.
- **Roof articulation**: add roof glazing bars mirroring the wall bays; 2 ridge ventilators (small timber-framed glass sashes, one opening apparent via a slight tilt); a finial at both gable apexes.
- **Eaves & rain goods**: timber eaves boards under both roof slopes + 2 half-round gutters + 1 downpipe into a **cedar rain barrel** on the north-west corner (inside plot, off the door approach).
- **Dwarf wall upgrade**: 3-course stone blocking with quoin stones at corners, one louvred vent panel per side, and a chamfered coping (replaces the flat cap).
- **Entrance reconciliation**: remove the decoy frame from `buildStorybookGreenhouse`; the real doorway (`buildSunbeamGreenhouseDoorway`) becomes the single west entrance; add a gabled entry porch vestibule (1.6 × 1.2 footprint, 2.4 m tall) around that doorway so the entrance is an architectural event; integrate the door leaf from the doorway builder into the main builder or keep the canvas composite but delete the conflict.
- **Interior-visible fixes**: give the potting bench trestle legs + lower shelf (or move it against the dwarf wall with visible corbels); align the interior door wall to the west in a later phase (game-layer contract change — see §9 risks).
- **Exterior program**: staging shelf against the south dwarf wall with 4–5 pots; cold frame (timber + glass lid) on the east lawn inside the plot; tool rack (rake + hoe + watering can); 2 herb beds with the existing flower-tuft system; stepping-stone path from plaza.

### 5.2 Pinecone Woodshop → maker identity
- Lumber stack (4–6 boards with visible end-grain discs) + sawhorse with a half-sawn plank + curling wood-chip pile (flattened dodecahedra) along the south wall (inside plot).
- Hanging shingle sign ("carved pinecone" disc on iron bracket) over the west door; barrow leaning on the west gable; log-sawing stool.
- Swap the roof to the terracotta or a cedar-shake cache to break the sage-twin pairing with the gazebo/greenhouse lane.

### 5.3 Linden Book Nook → bookshop architecture
- **True bay window** on the east facade beside the door: 3-sided, 0.40–0.45 m projection, 1.9 m tall, own mini copper/sage roof, window seat visible inside with 2 books + mug — this delivers the docstring's promised "bay reading shelf."
- Hanging blade sign (book stack motif) on wrought-iron bracket; stacked book crates (2–3, varied rotations) on the north wall; gable loft vent window in both gable triangles.

### 5.4 Hearth & Crumb Bakery → bakery facade + bakehouse wing
- Hanging sign (pretzel/bread board) on the south facade; corbel-supported display ledge (replace floating shelf) with 2 bread tiers + chalk prices; flour sacks + delivery crate beside the oven bump-out.
- Grow the oven stub into a **bakehouse bump-out wing** (≈ 2.4 × 1.8, own small gable) on the west side — creates the only L-shaped massing in the core four and breaks the template silhouette.
- Tapered 3-part chimney (Willow pattern) + copper kettle vent.

### 5.5 Copperwheel Cottage (coordinate with owning agent)
- Gable clock *case* (timber hood + pendulum window) instead of flat emblem; warm lantern or brass weathervane to counter the cold palette. **Not tasked unilaterally.**

### 5.6 Shared core template upgrades (benefits all four at once)
- Gable triangles: plaster infill + one loft vent window option (per-building toggle).
- Fascia/bargeboards on both gable slopes (Willow pattern, `slopeLen`/`slopeAngle` math already proven at willowLaneDiorama.ts:289–305).
- Sill band + corner quoins (Willow pattern, 218–246) promoted from prototype to core.
- Chimney: tapered 3-part option.
- Optional dormer slot (core already has Willow's as proof).

---

## 6. Special Study — Sunbeam Greenhouse as a Storybook Conservatory

**Design target**: from "glass box on a stone slab" to *"the neighborhood's jewel box"* — a Victorian-style lean-to conservatory read at isometric glance, recognizable by silhouette alone:

1. **Silhouette**: dwarf wall (0.9–1.1 m) → glazed wall zone with strong bay rhythm → decorative eaves line with gutters → steep glass gable with visible bars → ventilated ridge with 2 sash vents + finials → optional small cross-wing (potting porch) on the north face for asymmetry. Total ridge 4.7–4.9 m (from 4.37 m) so it stops reading as a shed between two 5+ m cottages.
2. **Structural glazing divisions**: 6 wall bays × (2 stiles + transom) + roof bars aligned to the same bays — the bar grid is what makes glass architecture read from a 28° top-down camera. Timber color stays the existing `#EAE0CA` family; glass stays the single cached `opacity 0.44` material (draw-call discipline in §9).
3. **Entrance architecture**: one entrance only — the existing cedar doorway upgraded with a gabled vestibule (timber posts on stone pads, mini glass gable above the lintel carrying the roofline down), a stone step apron, and the existing planted sign + lantern reused. Delete the decoy frame at (11.45, 1.70).
4. **Ventilation & function features**: 2 ridge sash vents, 2 dwarf-wall louvre panels, rain barrel + downpipe, thermometer board by the door — each is 2–4 meshes, each is *storytelling*, and together they make the building "work" for a living.
5. **Gardener's yard (inside the 7.0 × 7.0 plot, off the approach line)**: staging shelf with propagated cuttings, cold frame, tool rack, 2 herb beds, stepping-stone path — mirroring the density the bakery already has.
6. **Interior continuity fix** (phase-gated, touches game layer): move `GREENHOUSE_DOOR_SPAWN`/door wall to the west so the door the player clicks is the door they walked to; until then, at minimum mirror the exterior vestibule geometry inside at the east wall so both ends have architecture.

**Reference comparisons within the project**: Willow Step Cottage proves the codebase supports multi-part masonry + dormer + porch craft; the Gazebo proves tiered roofs + lathe ornaments; the Pond proves spline outlines + shader surfaces + rig animation. The conservatory should consciously borrow all three: *Willow's dwarf-wall/quoins, the Gazebo's ridge finials, the Pond's disciplined glazing-bar rhythm.*

---

## 7. The Exterior–Interior Scale Mismatch ("big house outside, small room inside")

This complaint from live play is **structurally true** and worth naming precisely, because it drives more perceived "laziness" than any single mesh.

### 7.1 The numbers (all measured from source)

| Building | Reserved plot (`BOX_OBSTACLES`) | Visual wall box | Interior walkable room | Interior ÷ plot | Interior ÷ visual box |
| --- | --- | --- | --- | --- | --- |
| Willow Step Cottage | 47.4 m² | 24.5 m² (+porch ≈ 32 m²) | 37.8 m² (7.0 × 5.4) | 80 % | ≈ 154 % |
| Hearth & Crumb | 54.4 m² | 33.3 m² | 28.8 m² (6.0 × 4.8) | 53 % | 86 % |
| Linden Book Nook | 43.5 m² | 28.1 m² | 24.0 m² (5.0 × 4.8) | 55 % | 85 % |
| Copperwheel | 48.8 m² | 33.5 m² | 30.0 m² (6.0 × 5.0) | 61 % | 90 % |
| Sunbeam Greenhouse | 49.0 m² | 32.5 m² | 31.6 m² (6.04 × 5.24) | 65 % | 97 % |
| Pinecone Woodshop | 43.5 m² | 29.1 m² | *(no interior)* | — | — |

### 7.2 Why it *feels* like a big house with a tiny room

1. **Program mismatch, not area mismatch.** In plan, four of the five interiors are roughly footprint-faithful (85–97 % of the visual wall box); the cottage is the outlier in the *opposite* direction — its 37.8 m² room is larger than its 24.5 m² visible wall mass (≈ 154 %, covering wall box + porch envelope), so the player's own home is literally bigger inside than out. The problem in both directions is *program*: each interior is **one room doing everything** (Bakery = shop + kitchen; Cottage = bed + hearth + table + desk + kitchen + shelf in one studio; Nook = shop + reading room). Meanwhile every exterior promises more: 1.6–2.1 m of gable attic, chimneys for rooms the player never sees, a dormer on Willow that literally draws an upper-floor window, awnings implying a second interior zone behind the shop. The eye does the math — *"that's a 1½-storey house, why is it one room?"*
2. **Ceiling compression.** Interior ceilings sit at 2.42–2.56 m with beams (cottage rafters ≤ 3.35), while exteriors top out at ≈ 4.9–5.4 m. In the interior cutaway camera the low ceiling plus full-height furniture makes the room read dollhouse-scale even where the floor area is generous (Willow: 27.2 m² free floor after furniture).
3. **Plot padding inflation.** `BOX_OBSTACLES` boxes are 1.24–1.40× the visual wall box (they must cover porches, awnings, bump-outs, props). Players perceive the *reserved plot* as the building's footprint — so the bakery "feels" 54 m² outside and 29 m² inside.
4. **Zero circulation language.** No hallways, no interior door to a back room, no stair, no landing — nothing says "this room is part of a larger home." The strongest trick used by cozy games (a visible, *locked* door to a back room, a stair nook with a rope, a hatch) is absent everywhere.

### 7.3 Remediation directions (phase-gated; interiors are content-heavy)

- **Cheapest (visual-only, no walkability change)**: add *implied-space architecture* inside each room — a visible interior door with frame + lintel on a blank wall segment ("back room"), a curtained stair nook or loft ladder under the gable, a ceiling hatch, wall-mounted room signage ("Bakehouse", "Parlour"). This costs meshes, not m², and directly answers the one-room contradiction. Align at least one exterior window per building with an interior window shaft.
- **Medium (interior rebuild within current bounds)**: densify zoning so each room reads as *one wing* of a bigger plan — e.g. bakery gets a serving counter separating "shop" from "kitchen" zones; cottage gets a rug/ceiling-beam axis separating sleeping vs living halves. (Copperwheel's interior already does this best with its bench-and-felt zoning.)
- **Largest (contract change, later phase)**: grow interiors toward plot parity (bakery 6.0 × 4.8 → 7.0 × 5.6) — but this touches `*_BOUNDS`, all obstacles, seating, waypoints, and their mirrored tests; it is a Milestone-scale change, not a polish pass.
- **Exterior truth-telling**: where an interior cannot grow, make the exterior honest — reduce attic volume read via lower roof pitch or add functional uses of the implied space (dormer shutters, attic vent) so the promise shrinks.

### 7.4 Verdict on "does it look like a lazy dude did it?"

Fair question, and the honest answer is *half-yes*: **no one who built the Pond, the Gazebo, the Fountain, the Orchard, or Willow Step Cottage is lazy** — those are 400–800-line, multi-system, season-gated constructions with genuine joinery discipline. But **the four template cottages + greenhouse *do* read as assembled from the cheapest possible primitives** relative to that bar, because the shared core was built to ship five buildings fast and only two buildings ever escaped it (Willow got a bespoke prototype; Copperwheel got a prop pass). The project's weakness is not effort — it is that **the craft floor visible in the best assets was never back-ported into the shared building core**. That is a fixable, bounded problem, and §8 sequences it.

---

## 8. Reference Comparisons Against the Strongest Buildings

| Craft dimension | Benchmark (Willow Step / Gazebo / Pond) | Template cottages today | Greenhouse today |
| --- | --- | --- | --- |
| Primary massing | Compound: porch + dormer + tiered spire / spline basin | Single gable box | Single glass box + prism |
| Secondary framing | Quoins, sill bands, knee braces, stringers | 4 corner posts | 5 side post-pairs only |
| Openings | Paneled door, dormer window, muntins | Same recessed window ×3 | No door; unbroken glass |
| Roof complexity | Dormer roof, cupola, bargeboards, finials | 1 bevel gable + ridge | 1 unbarred glass gable |
| Micro-story props | Smoke puffs, bench+throw+mug, doormat, rope coils | 2–4 props (Bakery best: oven) | 6 pots + floating bench |
| Seasonal life | 4-season porch contract | None on exteriors (porch dressing exists via `porchSeasonLife` for 3 buildings) | Seasonal interior dressing only |
| Grounding | Contact shadows everywhere | Present | Present |
| Uniqueness at 20 m | Instantly identifiable | Roof-tint only | "The glass shed" |

**Transferable patterns to copy**: (a) Willow's *stepped plinth + quoins + sill band* trio; (b) Willow's *bargeboard math* (lines 289–305); (c) Willow's *3-part tapered chimney*; (d) Gazebo's *tier the roofline* principle (even a 2-tier gable + loft band breaks monotony); (e) Pond's *outline discipline* — an asymmetrical, hand-plotted silhouette beats a rectangle every time (directly applicable to the greenhouse's rectangular plan: notch the NE corner for a potting porch).

---

## 9. Prioritized Implementation Roadmap (next phases — audit proposal only)

**Phase A — Sunbeam Conservatory rebuild (highest visual ROI, highest defect density)**
1. Delete decoy west frame; single vestibule entrance at (11.14, 3.20). *(visual only)*
2. Panelized glazing (wall bays + roof bars), eaves + gutters + rain barrel, ridge vents, dwarf-wall coursing + louvres. *(visual only)*
3. Potting-bench legs; exterior gardener's yard set. *(visual only)*
4. Door-side reconciliation east→west interior door. *(touches `greenhouse.ts` spawn constants + mirrored tests — schedule as its own gated pass with `npm test` + interior rebuild)*

**Phase B — Template core back-port (fixes 4 buildings with one change)**
1. Sill band + quoins + bargeboards + loft-vent option + tapered chimney option into `buildStorybookCottageCore` with per-building toggles. *(visual only; verify `BOX_OBSTACLES` margins — all additions ≤ existing overhang 0.46 except chimneys which already pierce the roof)*

**Phase C — Pinecone Woodshop dressing** (lumber/sawhorse/chips/sign/barrow + roof cache swap). *(visual only)*

**Phase D — Linden Book Nook bay window + signage + crates.** *(visual only; bay projection ≤ 0.45 m stays inside `book_nook` BOX maxX −12.4)*

**Phase E — Hearth & Crumb bakehouse wing + facade merchandising + sign.** *(visual only; wing stays inside the 8.0 × 6.8 BOX west margin — oven bump-out already occupies x ≈ −15.85 world, margin to minX −16.4 allows ≤ 0.5 m more)*

**Phase F — Implied-space interior pass** (back-room doors, stair nooks, window alignment). *(visual only; no bounds changes)*

**Phase G — Copperwheel clock case & warmth** — *coordinated with the Copperwheel agent's ownership; do not run in parallel with their in-flight content work.*

**Phase H — Pond micro-polish** (bank transition ring, brook flow, extra reeds) — P2, only after A–E.

**Order rationale**: A removes the only two structural-defect-class findings (floating geometry, decoy entrance) and upgrades the flagged weakest building; B lifts four buildings at once; C and D close the two weakest identity stories; E adds the first non-rectangular massing; F addresses the interior promise gap; G/H are polish.

---

## 10. Risks — Collisions, Navigation, Interaction, Performance

1. **`BOX_OBSTACLES` fidelity (§A gate)**: every proposed prop must remain inside the existing box; visual geometry *outside* the box is walkable-through (players will clip it). Additions in Phases A–E are specified within margins; re-verify with the walkability test suite (`npm test`, `worldMap` obstacle assertions) after each phase.
2. **Interaction points**: `PROP_INTERACTABLES` (`greenhouse_door` at 10.15/3.20, `bakery_door` −12.4/−7.05, `nook_door` −11.8/−1.0, `copperwheel_door` 13.1/−7.85, `greenhouse_planters` 10.0/1.7) and `SEAT_SPOTS` approaches must keep ≥ 0.9 m clear approach. The greenhouse vestibule must not crowd the `greenhouse_door` radius (2.1); keep the step apron ≤ 0.6 m proud of the glass line.
3. **Door-side reconciliation (Phase A.4)** is the only proposal that touches game constants (`GREENHOUSE_DOOR_SPAWN`, interior obstacles, waypoints, seating) — it invalidates mirrored interior tests and needs its own save-compat review (visual spawn change is save-safe; position constants are not persisted, but waypoint tests assert them).
4. **Draw calls & materials**: the glazing-bar grids could add 40–80 meshes if naively built. Mandate: merge bars per face (`BufferGeometryUtils.mergeGeometries` — already imported in `orchard.ts`), share the single cached glass + wood materials, keep each building ≤ ~300 added triangles. Mobile budget (≤ 120–150 total draws, VISUAL_IDENTITY §10) must be re-measured via the standard headless-Chromium pass.
5. **Transparency sorting**: more glass geometry near `depthWrite: false` panes risks sort flicker; keep glass as the *last-added, single-material* surfaces and bars as opaque geometry (bars opaque → no sorting cost).
6. **Zero per-frame allocation**: all new geometry is static builder output; no `tick()` work. Seasonal gating (if any greenhouse yard items rotate) must follow the existing `porchSeasonLife` group-gate pattern, not per-frame checks.
7. **Contact shadows**: new exterior props (cold frame, barrow, beds) each need `addContactShadow` to satisfy the software-GL grounding gate.
8. **Save/WorldState compatibility**: Phases A–F are visual-only — no schema, WorldState, topic-ID, or migration impact. Golden dialogue snapshot unaffected.
9. **Ownership red line**: Phase G touches another agent's building; sequence it explicitly to avoid merge conflicts in `buildings.ts:504–599`.
10. **Camera framing**: raising the greenhouse ridge to ≈ 4.8 m and adding bakery awning depth changes title-screen orbit silhouettes; re-check the title framing note from `VISUAL_AUDIT.md` §Audit 9 (title card overlap).

---

## 11. Recommendation for the Next Implementation Phase

**Execute Phase A — the Sunbeam Conservatory rebuild — as the next implementation pass**, in two gated sub-passes:

- **A-1 (visual, ~1 pass)**: vestibule entrance + decoy-frame removal + panelized glazing + roof bars + vents + gutters + rain barrel + dwarf-wall coursing + potting-bench legs. Gates: `npm test`, `npm run lint`, `vite build`, headless-Chromium captures at 1440×900 and 390×844, 4-phase lighting check, zero console errors.
- **A-2 (contract, ~1 pass)**: greenhouse door-side reconciliation (exterior west ↔ interior west) with the mirrored interior/scene tests updated together, plus the gardener's-yard exterior set.

Then proceed B → C → D → E → F as scheduled above. This ordering removes both structural-defect-class violations first, rescues the two weakest identity stories next, and defers all game-contract risk to isolated, test-gated passes — while keeping every collision footprint, interaction position, and the entire dialogue/save contract untouched.

*Audit complete. No code was modified in the production of this document.*
