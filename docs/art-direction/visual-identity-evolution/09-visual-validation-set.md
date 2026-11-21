# 09 — Visual Validation Set

**Purpose**: prove the v2 direction on real project assets before any cast-wide or library-wide rollout (brief §12: "Do not approve the new art direction based only on written descriptions"). Every artifact uses **actual project assets and the existing rendering pipeline**; nothing invents an unrelated fantasy village. Each item is small enough to ship inside a single roadmap phase.

**Method**: all captures run through the Phase-0 harness (Doc 08, Phase 0): headless Chromium at **1440×900** (desktop) and **390×844** (mobile), zoom steps **0.72 / 1.0 / 1.45**, all four lighting phases, GPU *and* software-WebGL runs, 0 console errors, stored under `download/asset-qa/audit-validation/`. Every artifact ships with a **before/after pair** (Phase-0 baseline vs. candidate) evaluated side by side.

---

## The six validation artifacts

### V1 — Existing character redesigned: **Clara** (Hearth-Round archetype + face v2)

*Why Clara*: the cast's emotional center, a v1-archetype case (skirt flare change is visible), test-locked named parts (apron, bun, hair pin, loaf) prove the identity contract survives.

- **Scope**: `buildStorybookCharacter` Clara branch gains archetype params + Doc 04 §2.1 face scales; mitten hands; grip on loaf basket.
- **Frames**: plaza default (1.0), dialogue framing, zoom 0.72 face crop, back view (coat/silhouette read), bench-seated (clearance), golden hour + dusk (lantern rim), winter (knit tint).
- **Pass rows**:
  1. At zoom 1.0, Clara is identifiable by silhouette + coat block + bun before any face detail.
  2. At 0.72 face crop, eyes/catchlight/blush/mouth resolve and a **happy vs sad** emotion flip is unambiguous.
  3. Seated min.z still clears bench `backrestFrontZ + 0.015` (existing test green).
  4. Named parts intact (`residentIdentity` green); no mesh below ground; software-GL content-identical.
  5. Side-by-side: same person — a *loved* Clara, not a different character.

### V2 — Ordinary resident with distinctive personality: **Rowan**

*Why Rowan*: newest resident, orchard keeper, carries the lathe apple basket — validates grip, Standard archetype, and an outdoor workplace.

- **Frames**: orchard workplace interactions (admire pose), basket grip close-up at 0.72, walk cycle mid-stride (gait read), conversation with Clara (two-archetype read together), golden hour.
- **Pass rows**: basket visibly *held* (mitten grip on `handAnchor`); personality (thoughtful, quiet-humored) readable from posture set; walk stride sync unbroken (`simulation.ts:773`); identity parts (`orchard_belt`, `pruning_shears`, beard) intact.

### V3 — Existing building upgraded: **Copperwheel Cottage** (craft completion + oriel + seasonal porch)

*Why Copperwheel*: the only template-core building left — the strongest before/after delta available without inventing content.

- **Scope**: craft flags (sill band, quoins, bargeboards, tapered chimney), brass-and-cedar workshop oriel, `seasonLife` porch group ×4 seasons, material maps from Phase 1.
- **Frames**: 3/4 hero angle at 1.0, roofline silhouette at 1.45, doorway approach (walkable read), all four porch seasons, dusk (lantern + gear medallion emissive), interior cutaway pair-check (workbench stays legible).
- **Pass rows**:
  1. Silhouette breaks the "cream box + triangle" read at 1.45 survey distance.
  2. It is still **Copperwheel** — slate roof, brass clockwork identity props unchanged (`buildings.ts:879-971` honored).
  3. Footprint/obstacle parity green (`npm test` walkability); porches respect clearance law.
  4. Material tiers (plaster T1 / timber T3 / brass T5) distinguishable at 1.0.

### V4 — Interior furniture arrangement: **Willow Step Cottage hearth corner**

*Why the hearth corner*: the densest craft zone — stone hearth, kettle, mantel life, quilt bed edge, rug — exercising texture program, curved-surface program and interior lighting together.

- **Scope**: hearth/counter/mantel/bed-edge pieces gain grain/weave/AO maps + curved quilt & pillow silhouettes + kettle/teacup parameterized variants (Phase 4 kit de-dup exemplar).
- **Frames**: interior camera (cutaway zoom band 0.56–0.92), morning vs dusk (hearth `PointLight` interplay), rain day (interior weather streaks visible on window), winter (knit runner + curved throw), station-proxy overlay shot (hit proxies aligned).
- **Pass rows**:
  1. Wood floor shows grain at interior zoom; brick shows courses; quilt reads fabric.
  2. All 7 station anchors and 2 seats remain visually obvious and clickable (proxy alignment unchanged).
  3. Seasonal clearance law green; `cottageInterior` suite green; zero-GC update intact.
  4. Room mood ("flour-warm cottage") unchanged or warmer — never darker or moodier.

### V5 — Decorative environmental object: **Sora's Tea Cart** (sculptural completion)

*Why the tea cart*: highest-traffic plaza prop with a confirmed docstring-vs-geometry gap — a contained, honest demonstration of the ten-point object gate (Doc 03 §8).

- **Scope**: spoked wheels, scalloped valance, kettle gleam (`envMapIntensity`), handle wear accent.
- **Frames**: 1.0 3/4 view; 0.72 detail crop (wheel spokes + scallops resolve); squint test at 1.45; dusk (canopy against festoons); beside a resident (scale read).
- **Pass rows**: all ten object-gate rows pass; silhouette test — at 1.45 the cart is *still the cart*; wheels/valance do not obstruct `Sora interaction` raycast (proxy parity green).

### V6 — Material & lighting treatment: **Sunlit Fountain Plaza, golden hour + winter recalibration**

*Why the plaza*: the game's cover shot; exercises the whole bedrock phase — cobble roughness courses, hemi season ground, rim dusk curve, instanced contact shadows, water fresnel.

- **Scope**: Phase-1 material/light changes only, no geometry changes.
- **Frames**: golden hour default zoom (hero frame), winter midday (recalibrated value bands), dusk lantern choreography, software-GL run of the same, zoom 0.72 cobble crop.
- **Pass rows**:
  1. Cobble stones read as *stones* (mortar vs face) at 1.0 without turning photoreal.
  2. Winter cobble/meadow stop washing to cream; characters and cottages pop (value-band check).
  3. Golden hour: warm key + cool shadow sculpting visible on the fountain's lathe profiles.
  4. Dusk: rim no longer flattens; lantern pools unchanged (identity).
  5. FPS evidence: GPU ≥ 60 reference; software-GL unchanged; draw calls ≤ baseline.

---

## Evaluation protocol

1. **Side-by-side rule**: each artifact is judged *only* against its Phase-0 baseline pair and the readability table (Doc 06 §4) — never against another game's screenshots.
2. **Distance rule**: every pass row evaluated at the stated zoom on both desktop and mobile viewports; the gameplay distance (1.0) is the deciding vote; 0.72 crops are for craft inspection only.
3. **Identity rule**: a three-question test per artifact — *Is it still the same town? Is it still the same character/object? Would a returning player notice the difference and call it "better cared-for" rather than "different"?*
4. **Gate rule**: artifact passes only with all suites green (`npm test`), 0 console errors, software-GL content parity, and budget evidence attached (FPS/draws/texture MB).
5. **Adoption rule**: all six pass → Doc 03's v2 layer merges into `docs/art-direction/VISUAL_IDENTITY.md` + `VISUAL_QUALITY_STANDARDS.md` (per `AGENTS.md` Documentation Sync) and the roadmap's cast-wide/library-wide rollouts unlock. Any single failure → iterate that artifact only; no mass production begins on partial passes.

## Set-level acceptance (the brief's final criterion)

After V1–V6 pass: *a person familiar with LITTLE SOMEWHERE, shown the validation gallery next to the baseline gallery, recognizes the same game instantly — and describes the new one as "the same world, lovingly polished."* That is the whole direction, working.
