# 03 — LITTLE SOMEWHERE Visual Identity Specification

**Status**: Proposal for the v2 elevation of the official direction. **The official source of truth remains `docs/art-direction/VISUAL_IDENTITY.md` (Premium Handcrafted Storybook Diorama) until the validation set in Doc 09 passes**, after which §1.1 below is intended to be merged there per `AGENTS.md` Documentation Sync rule.

---

## 1. Final art direction statement

### 1.1 Direction name and meaning

**Premium Handcrafted Storybook Diorama — v2: "Readable Form, Evident Craft, Living Warmth."**

The v1 identity ("a lovingly handcrafted miniature world brought to life", `VISUAL_IDENTITY.md` §1) is **preserved as the personality**. v2 adds three *quality commitments* distilled from the reference analysis (Doc 02 §5):

1. **Readable Form** (from Clash of Clans): identity is legible at gameplay distance — first by silhouette, then by material contrast, last by micro-detail. Characters and objects are *identifiable before they are intricate*.
2. **Evident Craft** (from Tiny Glade): surfaces show how they were made. Wood shows grain; plaster shows tooth; fabric shows weave; stone shows courses. Handcraft is *demonstrated*, not asserted by color alone.
3. **Living Warmth** (from The Wild at Heart): seasons own moods; props whisper small stories; gentle exaggeration is reserved for what should be loved (faces, hands, focal objects).

### 1.2 The one-sentence test

> *After the upgrade, a player shown a single screenshot must still say "that's LITTLE SOMEWHERE" — a sunlit clay-and-cedar storybook neighborhood — while an art director can point to each object and say "that was made deliberately."*

### 1.3 What v2 changes vs. preserves

| Domain | Preserved (v1, unchanged) | Elevated (v2) |
| :--- | :--- | :--- |
| Genre/world | Cozy life-sim, storybook town, no combat/timers/currency | — (identity untouched) |
| Camera | 28° isometric diorama framing, zoom 0.72–1.45 | Readability standards calibrated to this exact distance |
| Palette | 28-color ACES-calibrated `STORYBOOK_PALETTE` | Per-family roughness/gradient standards + winter value recalibration |
| Buildings | 3-Scale Silhouette Rule, structural truth | Second-roof-element rule; bevel sweep; per-building massing breaks |
| Characters | Clay figurine warmth, named identity parts | Body archetypes; camera-calibrated faces; sculpted hands; emotion intensity |
| Interiors | Cutaway diorama grammar, station proxies | Evident-craft texture program; drape silhouettes; kit de-duplication |
| Lighting | 4 sacred phases, warm key/cool fill | Season-aware hemi ground; dusk rim curve; per-phase PMREM (optional) |
| UI | Linen storybook HUD, lucide discipline | Bespoke icon family; weather/season glyphs; item thumbnails |

## 2. Color philosophy

1. **The palette is law.** All 3D albedo continues to route through `STORYBOOK_PALETTE` (`materials.ts:73-107`). v2 adds **usage weights**, not new hues: walls stay cream/warm-plaster; cedar and terracotta remain the structural accents; foliage carries the saturation budget; brass and iron stay the only metallics.
2. **Value bands, not hue count.** Following the CoC value-band principle: ground (cobble/meadow), mid (walls/paths), focal (trim/props/characters) must each occupy distinguishable value bands in every phase and season. The winter phase's current wash-toward-cream (Doc 01 §4.5.4) is recalibrated by deepening winter cobble/mortar values, not by re-saturating everything.
3. **Gradients guide the eye** (CoC eye-guiding principle, proceduralized): where a surface has a focal point (shop sign, bakery display, character face, fountain spout), nearby albedo/roughness should step *slightly* lighter and *smoother* toward it. Implementation is procedural canvas gradients and roughness maps (Doc 06 §2), never photoreal grime.
4. **Warm/cool contract**: warm key light always pairs with cool sky fill and warm ground bounce (`VISUAL_IDENTITY.md` §5). v2 extends the contract to seasons (§5.4).
5. **No muddy, no neon.** The existing prohibitions stand (`VISUAL_IDENTITY.md` §2): no pure `#FFFFFF`/`#000000`, no oversaturated neon, no chalk-out pastels under ACES.

## 3. Geometry standards

### 3.1 The 3-Scale Silhouette Rule (preserved, sharpened)

Every asset keeps: **Primary mass** (softened grounded silhouette) → **Secondary carpentry/framing** (mid read) → **Artisan accents** (micro story read) — `VISUAL_IDENTITY.md` §3. v2 adds measurable teeth:

1. **Minimum bevel program**: all `ExtrudeGeometry` used as visible trim/roof/hood geometry must `bevelEnabled: true` with 0.04–0.1 bevel size (exterior standard already at 0.1 — `buildings.ts:272-278`). Glass may opt out. (Closes Doc 01 §4.2.4.)
2. **Second-roof-element rule**: every named building expresses at least one *massing break* beyond the base gable — dormer, secondary gable/wing, canted bay, spire cupola, or attached lean-to. (Willow: dormer ✓; Bakery: bakehouse wing ✓; Nook: bay window ✓; Woodshop: yard structures ✓; Greenhouse: sash vents + vestibule ✓; **Copperwheel: missing** — the first upgrade candidate, Doc 05 §2.2.)
3. **Chunk ratio for interactive furniture/props**: interactive objects (benches, carts, lamps, station furniture) keep a ≥ 2.5:1 length-to-thickness ratio on primary members so members read as *parts*, not planes; thin members (< 0.06 m) are reserved for wires, rope and twine.
4. **Trim band**: physical trim stays in the 0.12–0.40 m readability band at gameplay distance (`REFERENCE_GUIDELINES.md` §3.3); sub-0.03 m detail is decorative garnish only and never load-bearing for identity.
5. **Handcrafted imperfection** (preserved): ±8–15% deterministic asymmetry on organic props; clean joinery on architecture; zero floating geometry.

### 3.2 Proportion consistency

- Building doors ≈ 1.5× resident height; counters ≈ 0.6–0.7× resident height; seats within ±0.05 u of the sim `seatHeight` contract (current state is already compliant — Doc 01 §4.3.5; these become explicit standards).
- Character height span stays 0.78–1.08 `heightScale` (child → tall adult); Doc 04 defines the archetype system within this span.

## 4. Character standards (summary — full bible in Doc 04)

1. **Body archetypes replace the shared core body**: five archetype templates (Hearth-Round, Barrel, Slender, Bean/Sprout, Standard) parameterize torso radii, skirt flare, shoulder width and limb chunk per resident, inside the existing silhouette-envelope and seated-clearance test contracts.
2. **Camera-calibrated faces**: eye/catchlight/mouth/brow scale factors sized for legibility at ~30 m (28° FOV) — dialogue framing ≈ 29.7 m, zoom floor ≈ 23.8 m; emotion changes must be readable as posture+face before reading as HUD.
3. **Sculpted mitts**: three-finger mitten hands with cuff read; props parent to hands where grip is narratively visible.
4. **Two-segment arms** (elbow pivot) in a later animation phase; legs stay single-pivot with pre-bent geometry until data says otherwise (Doc 04 §8).
5. **Emotion intensity plumbing**: sim `emotionIntensity` (0.55–0.85) reaches the rig; amplitudes scale, never snap.
6. **Identity contract unchanged**: named parts, winter knits, per-resident accessories, and all test harnesses evolve rather than break.

## 5. Material standards

### 5.1 Roughness tiers (v2 formalization of the existing practice)

| Tier | Roughness | Metalness | Family | Standard |
| :--- | :--- | :--- | :--- | :--- |
| T1 Matte-masonry | 0.84–0.92 | 0.00–0.02 | plaster, fieldstone, cobble, mortar, terra-cotta unglazed | Procedural tooth/courses map (new); albedo mid-warm |
| T2 Fabric-fibre | 0.80–0.90 | 0.00 | wool, linen, knit, quilt | Weave map (new); slight sheen variation per garment panel |
| T3 Wood-dressed | 0.62–0.78 | 0.02–0.05 | cedar trim, furniture, shingles | Grain map (new) aligned to part axis |
| T4 Glazed-slick | 0.34–0.48 | 0.05 | ceramic, pottery, enamel clock faces | Smoothest catchlight; ≥ 0.25 delta vs neighbors (existing rule) |
| T5 Metal-warm | 0.22–0.30 | 0.82–0.88 | brass | Existing values preserved; pairs with IBL |
| T6 Metal-iron | 0.40–0.48 | 0.60–0.72 | wrought iron, stove iron | Wear gradient toward handles (CoC wear-accumulation principle) |
| T7 Glass-water | 0.10–0.18 | 0.08–0.15 | glass, water | Unchanged; shader-driven |

Adjacent-part rule (preserved): ≥ 0.25 roughness delta between adjacent materials (`AGENTS.md` §3; `VISUAL_QUALITY_STANDARDS.md` §E).

### 5.2 Procedural maps (the "evident craft" carrier)

- All maps are seeded `CanvasTexture` generators in `textures.ts` (zero external assets — unchanged law).
- Target set (Doc 06 §2 specifies sizes/budgets): `woodGrain` (2 variants), `plasterTooth`, `fabricWeave` (knit/linen), `stoneCourses` (cobble upgrade + brick), `roughnessNoise` (shared scalar-noise used as roughnessMap by T1–T3), `paperGrain` (UI/interiors), `detailAO` (soft corner-darkening for hero furniture).
- Map discipline: albedo maps stay low-frequency; *roughness maps carry the material story* (Supercell doctrine, Doc 02 §1.1.3). No normal-map harassment of mobile GPUs — normal maps only where a bevel cannot express the form (cobble/brick courses), at 128–256 px.

### 5.3 Material identity rule

Every object must answer, at a glance: *what is it made of, and how old is it?* Made-of comes from tier contrast; age comes from deliberate, story-placed wear (kitchen spoons darkened at the grip, door thresholds smoothed, chimney soot) — never uniform grunge.

## 6. Lighting standards

1. **Four sacred phases preserved** with their exact existing hex curves (`environmentRenderer.ts:329-382`) — these are identity.
2. **Season-aware hemisphere**: ground color follows season mood (spring dew-sage, summer honey, autumn umber, winter blue-gray) via one additional lerp in the existing controller; sky color pair stays.
3. **Dusk rim curve**: rim intensity follows `duskFactor` (0.45 → ~0.18) so twilight sculpts rather than flattens (Doc 06 §3.5).
4. **Per-phase PMREM regeneration (optional, flag-gated)**: regenerate the environment map at the four phase edges (4×/day) with phase-tinted room lighting, preserving brass/warm reflection truth (Doc 06 §3.6). If profiling shows any regression, the scalar `environmentIntensity` approach stands alone.
5. **Emissive choreography preserved**: hearth-truth windows, lantern schedules, festoons — existing curves are the cozy heart of dusk and remain untouched.
6. **Grounding standard preserved**: contact shadows under everything; v2 adds *instancing* of the discs (performance, not look) and optionally a faint sun-azimuth stretch for large structures (Doc 06 §4). No post-processing stack is introduced (Doc 06 §7).

## 7. Environmental standards

1. **Composition** (preserved): every district keeps a focal anchor, ≥ 2 m clear lanes, layered edge dressing that never blocks navigation (`VISUAL_IDENTITY.md` §7).
2. **Relational vegetation** (new): tufts/ivy/moss emerge *from* seams, bases and edges of structures (planter lips, wall bases, well coping), extending the existing cluster-anchor system to buildings; dressing never intrudes on `COBBLE_LANE_RECTS` legality (existing rule).
3. **Season mood ownership** (new): each season owns one *emotional* descriptor beyond hue — Spring "dewy renewal", Summer "honeyed ease", Autumn "amber reminiscence", Winter "hushed comfort" — expressed through palettes, vegetation state, and interior textiles (existing winter-knit language generalized).
4. **Micro-life budget** (preserved): koi, dragonflies, songbirds, butterflies, bees, fireflies, smoke wisps keep their caps; no new categories without a draw-call offset.
5. **Water truth** (preserved): pond/fountain shaders keep their uniform-driven behaviors; v2 adds a fresnel term for angle-based reflectivity (Doc 06 §6).

## 8. Object design standards (the CoC "decorative object" bar)

Every prop, furniture piece and decoration must satisfy all ten:

1. Recognizable silhouette at gameplay distance (the "squint test": at 8% zoom the object is still itself).
2. Intentional proportions (chunk ratios per §3.1.3; nothing accidentally spindly).
3. Deliberate bevels on hard-surface edges.
4. Simplified but complete geometry (no unresolved undersides; no micro-detail noise).
5. Material identity per §5 (≥ 2 material tiers on hero objects; single-tier only for tiny garnish).
6. One recognizable "signature detail" (the bakery's price card, the mailbox's peeking postcard — this house rule is already strong and becomes a gate).
7. Story whisper: the asset answers "who placed this here and why?" (Doc 05 §7).
8. Readable from the gameplay camera *and* from the interior cutaway camera.
9. Proportions consistent with the asset library's established scale bands.
10. Interactive objects visually communicate affordance (a bench invites sitting: contoured slats, armrests; a kettle invites pouring: spout + handle) — extend the existing `PROP_INTERACTABLES` visual-language.

## 9. UI standards (summary — details in Doc 08 Phase 7)

1. **Palette discipline becomes real tokens** — the declared CSS variables are adopted, with spacing/elevation/shadow scales added; hex literals migrate.
2. **Bespoke icon family**: hand-drawn-feel SVG icon set in the storybook voice for the HUD/journal/satchel domains (weather: sun/breeze/mist/rain glyphs; seasons; tier icons), replacing stock lucide glyphs *in cozy-context slots only*; functional glyphs (close, chevrons, zoom) may stay lucide.
3. **Item thumbnails**: 25 satchel items get tinted canvas thumbnails by reusing the existing `SubjectCanvas` painter (`DialogueVisuals.tsx:957-982`) — no new systems.
4. **Portrait unification**: Journal People cards reuse `PortraitCanvas`.
5. **A11y floor**: `focus-visible` everywhere, ≥ 44 px hitboxes everywhere (zoom buttons fixed), toast `role="status"`, tone styles for all five `DialogueChoice.tone` values, viewport zoom unblocked.
6. All `AGENTS.md` UI rules (no backdrop-filter over WebGL, semantic elements, 44px) remain binding.

## 10. Explicit non-goals (unchanged)

No photorealism, no post-processing stack, no external asset pipeline, no dynamic resolution scaling, no style islands (any asset that "looks like Clash of Clans" rather than "looks like our clay storybook" is a defect), no content changes to world/narrative/systems, no gameplay-code coupling of new visual state beyond the derive-only patterns of Doc 07.
