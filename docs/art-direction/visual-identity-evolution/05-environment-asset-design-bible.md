# 05 — Environment & Asset Design Bible

**Scope**: all non-character 3D assets — buildings, street furniture, decorations, vegetation, props, interiors — plus the modeling standards and material categories that govern them. Current-state claims are `[CONFIRMED]` with `file:line`; upgrades are **targeted**, never wholesale rebuilds ("do not assume that every asset needs rebuilding" — the existing hero landmarks are already at or near the target bar).

---

## 1. Modeling standards (the library contract)

1. **3-Scale Silhouette Rule + bevel program** (Doc 03 §3.1): primary mass → framing → artisan accent, with mandatory bevels on visible trim/roof extrusions (0.04–0.1) and the second-roof-element rule for named buildings.
2. **Geometry technique ladder** (choose the cheapest technique that reads):
   - Lathe for anything rotationally symmetric with profile character (bells, basins, pots, baskets, trunks — already house practice: `landmarks.ts:172-185,300-316`, `orchard.ts:444-451`, `vegetation.ts:46-53`).
   - Beveled `ExtrudeGeometry` for roofs, hoods, signs, brackets.
   - Transformed-primitive composition (`boxAt`/`cylAt` + `addMerged` batching — `buildings.ts:17-54,1203-1214`) for the mass of furniture and props.
   - Merged BufferGeometry batches for static clusters (lumber, rocks, spines).
3. **Detail budget at camera distance**: primary members ≥ 0.06 m thick; trim 0.12–0.40 m; sub-0.03 m detail only as garnish. (Rationale: `REFERENCE_GUIDELINES.md` §3.3; interior micro-detail flag in Doc 01 §4.3.7.)
4. **Zero floating geometry; structural joinery posts/brackets/corbels** (existing law — `VISUAL_QUALITY_STANDARDS.md` §A; verified systematic in Doc 01 §4.2).
5. **Grounding**: every builder ends with `addContactShadow` (`vegetation.ts:6-26`); discs become instanced in Phase 1 (Doc 06 §4).
6. **Deterministic asymmetry** ±8–15% on organic props; **rock variety**: the shared icosa-squash rock pattern (`wilds.ts:154,384,539,628`) gains two genuinely distinct variants (different subdivision/axis-squash) + per-instance tint spread (Doc 01 §4.2.6).
7. **Bounds discipline**: visual footprints stay synced with `BOX_OBSTACLES`/`CIRCLE_OBSTACLES` and district mesh budgets (orchard ≈20 draws; Wilds ≤80 test-enforced) — unchanged law.

## 2. Buildings

### 2.1 What already meets the bar (protect)

Willow Step Cottage (bespoke, dormer + full porch program — `willowLaneDiorama.ts:135-873`); Hearth & Crumb (oven dome + bakehouse wing + corbel display + sign + chalkboard — `buildings.ts:486-656`); Linden Book Nook (canted bay window + blade sign + cart — `buildings.ts:708-874`); Pinecone Woodshop (maker yard: sawhorse kerf, lumber, wheelbarrow — `buildings.ts:979-1147`); Sunbeam Greenhouse/Conservatory (panelized glazing, propped sash vents, gutters, cold frame — `buildings.ts:1171-1829`); Old Bell Gazebo and Mossy Stone Fountain (Doc 01 §4.2).

### 2.2 Building upgrade register (targeted)

| Asset | Upgrade | Priority | Notes |
| :--- | :--- | :--- | :--- |
| **Copperwheel Cottage** | Enable full `craft` set (sill band, quoins, bargeboards, loft vents) + tapered chimney + one massing break: a **brass-and-cedar workshop oriel** over the bench side; add `seasonLife` porch group (the only un-seasonal porch, `porchSeasonLife.ts:16-17`) | **P1** | The last template building; its clockwork identity props (gear medallion, vent pipe) are kept and honored |
| **Tea cart** | Spoked wheels + scalloped valance (promised by the builder's own docstring `landmarks.ts:607-608`, not yet in geometry), kettle gleam | **P1** | Docstring-geometry debt; highest-traffic plaza prop |
| **Core cottages (Nook/Woodshop/Copperwheel)** | One secondary roof element each where missing (Nook ✓ bay; Woodshop: **small ridge dormer over the workbench gable**; Copperwheel: oriel per above) | **P2** | Breaks the shared gable-prism read (Doc 01 §4.2.2) |
| **Window planters (all core cottages)** | Replace 5 identical dodecahedra with the Willow 3-bud tuft builder (`willowLaneDiorama.ts:96-107` pattern), shared geometry, per-window tint | **P2** | Template fingerprint removal |
| **Noticeboard hood, bakery wing roof, greenhouse porch gables** | Bevel sweep (§1.2) | **P3** | Micro-craft |
| **Gazebo column plinths** | 0.05 overlap fix (plinth top vs column base) | **P3** | Zoom-inspection risk only |
| All buildings | Roughness/grain maps per Doc 06 (courses, shingle grain) | **P1** | Material phase, not geometry |

### 2.3 Prohibitions (identity)

No castellation, no banners-as-heraldry, no weapon/armor decor, no stone-keep massing, no lanterns repurposed as siege torches. Decorative details must keep whispering *community* stories (Doc 02 §1.3): flour sacks, book returns, kindling, herb strings, chalk menus, mended clocks.

### 2.4 Craftsmanship × inventive devices (brief §6 interpretation)

The brief admires how the reference world blends traditional-looking craftsmanship with unusual inventions — and explicitly warns this must **not** be read as medieval-izing the game. Our world already contains the sanctioned expression of that pairing, and it becomes doctrine here:

- **What already embodies "traditional craft meets inventive charm"** `[CONFIRMED]`: Copperwheel Cottage's brass clockwork — 14 mended clocks with enamel faces, the pendulum, the music-box comb, the pocket watch, the regulator (`copperwheelInterior.ts:317-566`); the fountain's brass valve handwheel (`landmarks.ts:444-452`); the glazed-crock orchard skep (`orchard.ts`); the paraffin greenhouse heater with flame window (`greenhouseInterior.ts:797-817`); the propped sash vents and cold frame of the Conservatory (`buildings.ts:1394-1415,1728-1769`); copper kettles across three rooms; Arthur's loupe and pegboard tools (`copperwheelInterior.ts:333-347`).
- **The line (do)**: hand-made mechanical charm a neighborhood artisan could plausibly build — clocks, music boxes, clever hinges, water-driven features, wind whirlygigs, camera-obscura niches, automaton-like toys. Inventions must look *worn, repaired and loved* — the mended-clocks language is the register.
- **The line (don't)**: no steam/industrial engines, no electricity-era gadgetry beyond existing warm bulbs, no steampunk gear-decoration without function, no medieval heraldry, no magic — and nothing that turns Arthur's workshop into a "technology lab". Inventive devices are *characters' handiwork*, never world-building anachronisms.

## 3. Street furniture & decorative objects

### 3.1 Existing quality (protect)

Cedar benches with `seatTopY`/`backrestFrontZ` contracts (`landmarks.ts:792-872`); plaza lamps; festoon strand; lantern signpost; animated mailbox with peeking postcard; noticeboard with brass-pinned flyers; café tables; 5 carryables (4–8 parts each, within the "4–10 part composite" bar).

### 3.2 Upgrade register

| Object | Upgrade | Priority |
| :--- | :--- | :--- |
| Carryable props (pail, basket, chalks, tray, parcel) | Mitten-grip sizing pass with character hands (Doc 04 §4); wear accents where hands would hold (CoC wear-accumulation doctrine) | P2 |
| Benches | Contoured slats get a subtle center bulge (lathe-profile extrusion) + wool-seat winter cushion variant (seasonal group, matches interior knit language) | P2 |
| Plaza lamps | Glass panes get warm gradient emissive texture (procedural) for dusk "pool of light" read | P3 |
| Fountain | Signature-detail pass: moss gradient on basin stones (procedural tint, not geometry), coin glint sparkle budget check | P3 |
| Perimeter walls/hedges | Two rock formula variants + tint spread (§1.6) | P3 |

### 3.3 The ten-point object gate (from Doc 03 §8) applies to every new or touched object.

## 4. Interior furniture (cutaway dioramas)

### 4.1 What already meets the bar (protect)

The "props narrate" programs of all five interiors; state-reactive furniture (mementos, loaf rows, open-book tint, pendulum, clock hands, crop stages); winter textile language; per-room lighting scripts; seat-height contract compliance (Doc 01 §4.3).

### 4.2 The three interior levers (priority order — from Doc 01 §4.3 weaknesses)

1. **Texture program (P1)** — wood floors gain grain + plank-tone variation; brick chimney/dome gain courses; plaster walls gain tooth; quilt/runner/blanket fabric gains weave; ledger/paper gains grain. All procedural via the shared generators (Doc 06 §2). *No geometry changes required for the base win.*
2. **Curved-surface program (P2)** — replace box slabs on **hero fabric and vessel pieces** with lathe/extrude/bevel forms:
   - Pillows: superellipsoid-ish squashed spheres with corner tucks (current rotated boxes).
   - Quilts/throws/blankets: extruded profile with scalloped edge silhouette + drape lobe at corners (no cloth sim — sculpted drape).
   - Runners: woven-edge extrusion instead of 9 interleaved slabs (`bakeryInterior.ts:783-795`).
   - Plates/trays/clock cases: beveled tops; kettle lids lathe-crowned.
   - Pitcher precedent: the interior set's *only* lathe (`cottageInterior.ts:734`) becomes the pattern, not the exception.
3. **Kit de-duplication with per-room variation (P2)** — the shared recipes (copper kettle ×3, teacup ×4, door ×5, lantern ×4, steam ×4) become parameterized shared builders with per-room identity deltas: bakery kettle soot-tinted + larger, nook kettle petite + honey pot adjacency, Copperwheel kettle polished; teacup glaze colors per room palette; door paneling motifs per building (flour-heel scuff for bakery, brass-cornered for nook, felt-bumped for Copperwheel).

### 4.3 Interior upgrade register (targeted)

| Interior | Upgrade | Priority |
| :--- | :--- | :--- |
| **Copperwheel interior** | `seasonLife` parity pass (winter: flannel bench roll + pipe-insulation wrap + evergreen sprig on shelf; spring/summer/autumn per existing patterns) — the only interior without seasons | **P1** |
| Cottage | Curved-surface program on bed quilt/pillows/runner; drape silhouettes | P2 |
| Bakery | Curved runner; bread crust roughness gradient (bake-day loaves slightly glossier); chalk slate legibility (raise chalk strokes to 0.018) | P2 |
| Book Nook | Shelf books gain page-block faces (cream end caps) + 2 title-band colors on featured books; spine lean variety already exists | P2 |
| Greenhouse | Cold-frame lid glazing gains faint condensation emissive; pots gain rim-highlight gradient | P3 |
| All interiors | Sub-0.03 detail audit (raise hero micro-details into trim band; keep true garnish below) | P3 |
| All interiors | Hit-proxy normalization: cottage 1.15-wide proxies reviewed against the 0.62 standard for feel consistency | P3 |

### 4.4 Presentation (preserved, one fix)

Cutaway grammar (full-height N/W walls, low S/E curbs, dark stage, per-room light scripts) is identity and stays. One reconciliation: the greenhouse interior camera branch joins the others' zoom treatment or the entry snap matches the exterior damping (Doc 01 §4.3.8) — decide by capture comparison in Phase 0.

## 5. Vegetation

### 5.1 Protect

Lathe trunks with root flares; multi-lobe canopies ("never 1 raw polyhedron"); 4-tone per-instance tints; orchard wind sway; 5-draw-call meadow; legality-checked seeded placement; pond flora; Hollow Oak 6-lobe canopy.

### 5.2 Upgrade register

| Asset | Upgrade | Priority |
| :--- | :--- | :--- |
| Perimeter grove (46 trees, 3 draws) | Add third crown lobe + branch fork hint to break the 2-lobe stack read at some angles (still 3 draw calls) | P2 |
| Courtyard/wilds trees | Season-bud progression: `dayOfSeason`-driven canopy tint interpolation (Doc 07 §5.3) — piggybacks existing season-tint materials | P2 |
| Window/planter flora | Shared 3-bud tuft builder (§2.2) | P2 |
| Relational dressing (new) | Clover/moss tufts and ivy strands emerging from wall bases, well coping, planter lips, bench feet (extend `botanicalDressing` cluster-anchor law to structures; never on `COBBLE_LANE_RECTS`) | P2 |
| Meadow wildflowers | Petal-tone spread widened ±1 hue stop in spring only | P3 |

## 6. Material categories (quick reference)

| Category | Where | Tier (Doc 03 §5.1) | Map treatment |
| :--- | :--- | :--- | :--- |
| Plaster / clay walls | all buildings, interiors | T1 | tooth + subtle hand-trowel arcs |
| Fieldstone / cobble / brick | plinths, lanes, hearth, oven | T1 | courses + mortar depth (roughness-led) |
| Cedar / walnut / maple timber | trim, furniture, shingles, docks | T3 | grain aligned to axis; end-grain discs darker |
| Fabric / wool / linen | garments, quilts, runners, cushions | T2 | weave; fold shading sculpted, not textured |
| Glazed ceramic / enamel | pots, clock faces, teacups | T4 | smooth catchlight; rim gradients |
| Brass / iron | lanterns, gears, tools, stove | T5/T6 | handle-wear gradients; keep IBL pairing |
| Glass / water | windows, greenhouse, pond, fountain | T7 | shader-driven; no new maps |
| Foliage | trees, tufts, blooms | T1-foliage | existing tint system; no maps (billboard-free) |

## 7. Story-whisper rule (the Wild at Heart inheritance)

Every touched asset's review includes one question: **"Which neighbor placed this, and what small story does it whisper?"** (formalizing the existing house strength — chalk menu slate, tea-ring ledger, boots by the door). New decorative assets without an answer are rejected as "asset-library appearance" even if technically polished. This is the single strongest guard against the generic look the brief warns about.

## 8. Explicit rebuild policy

The audit's asset survey (Doc 01) identifies **no asset that requires wholesale replacement**. All upgrades are: parameter changes, additive craft passes, texture applications, or kit consolidations. The "preserve good existing work" mandate is enforced by the register tables above — anything not listed is out of scope and must not be touched for taste reasons alone.
