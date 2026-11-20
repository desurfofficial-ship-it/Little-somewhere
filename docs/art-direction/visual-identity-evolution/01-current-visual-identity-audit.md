# 01 — Current Visual Identity Audit

**Audit date**: 2026-11-21
**Method**: Direct code inspection of every production module under `src/scene/`, `src/game/` (visual-relevant parts), `src/components/`, plus review of committed QA captures in `download/asset-qa/pass26/` (e.g. `plaza_winter_residents_a.png`, `rowan_plaza_face.png`, `bakery_porch_spring.png`) and prior audit documents (`docs/art-direction/VISUAL_AUDIT.md`, `docs/art-direction/building-architecture-audit.md`, `docs/audits/09-comprehensive-asset-visual-audit.md`, `docs/production/everyday-life-quality-assessment.md`).
**Claim discipline**: `[CONFIRMED]` items cite `file:line` or QA artifacts; `[ARTISTIC OPPORTUNITY]` items are judgments grounded in that evidence; nothing here is aspirational guesswork.

---

## 1. What LITTLE SOMEWHERE is (the identity being protected)

**[CONFIRMED]** The game is a cozy isometric 3D low-poly life-simulation: *"a little world filled with thousands of little stories"* (`README.md:3`, `GAME_DESIGN.md:1-29`). Its identity constants, all of which must survive any visual upgrade:

| Identity constant | Evidence |
| :--- | :--- |
| Currency-free, anti-grind, zero-timers philosophy | `GAME_DESIGN.md:29` ("no coins, no shop economy, no daily login streaks, no failure timers"), `GAME_DESIGN.md:262-264` |
| 10 autonomous residents (Clara, Arthur, Mina, Jun, Barnaby, Sora, Toby, Nora, Pip, Rowan) with 4-phase schedules, traits, 10 emotions | `GAME_DESIGN.md:111-132`, `src/game/residents.ts`, `src/game/simulation.ts` |
| The Silent Gazebo Bell main story + 6 multi-stage storylines + conflicts | `GAME_DESIGN.md:184-199`, `src/game/storylines.ts` |
| 5-layer environment composer: time (4 phases 6:00–21:30), seeded weather, 10-day seasons, player-driven transformations, autonomous NPC touches | `GAME_DESIGN.md:220-228`, `src/game/environment.ts` |
| Willow Lane & Fountain Square district + Fern Hollow Orchard + The Wild Hollows; 6 named buildings + gazebo + fountain + Mirror Pond | `GAME_DESIGN.md:79-104`, `src/game/worldMap.ts` |
| 100% procedural assets: no external models/textures/audio (`CanvasTexture` + geometry + Web Audio) | `AGENTS.md:18`, `src/scene/textures.ts`, `src/game/audio.ts` |
| Official visual direction: **Premium Handcrafted Storybook Diorama** | `AGENTS.md:11`, `docs/art-direction/VISUAL_IDENTITY.md` |
| Isometric camera: 28° FOV, offset `(+19.5·zoom, +18.2·zoom, +19.5·zoom)`, zoom clamp 0.72–1.45 | `src/scene/NeighborhoodCanvas.tsx:431-436,1475-1479` |
| Mobile-browser-first with software-WebGL fallback (DPR 1, no AA/shadows, `afterDraw` pacing ≈ 8–12 FPS ceiling) | `AGENTS.md:77-79`, `NeighborhoodCanvas.tsx:385-394,1541-1564` |
| `WorldState` v10 localStorage persistence with derived-visual (schema-frozen) discipline | `src/game/migrations.ts:122`, `HANDOVER.md:7-9` |

## 2. Executive assessment

**[CONFIRMED]** The current build is far beyond the state described by the last committed audit (`docs/art-direction/VISUAL_AUDIT.md`, 2026-11-18). All ten of its P0/P1 geometry findings — floating awnings, floating tea-cart canopy, lollipop trees, floating perimeter blocks, cobble seam gaps, premature gazebo clapper, template cottages, missing contact shadows, un-pooled materials, dead legacy builders — have been remediated (verification table in §10). Through polish Passes 1–26 (`docs/production/everyday-life-polish-roadmap.md`, `WORKLOG.md`), the game has developed a genuinely crafted, season-aware, structurally honest, test-locked visual layer.

**[CONFIRMED]** Where the game still falls short of the brief's benchmark (*Clash of Clans decorative-object and character quality, Tiny Glade environmental warmth, Wild at Heart storybook expressiveness*), the gap is **no longer placeholder geometry** — it is concentrated in five structural ceilings:

1. **Character form does not carry identity; accessories do.** All residents share one core body (identical torso/arm/leg radii, head radius); differentiation is achieved via `heightScale` (0.78–1.08), coat colors, hats and named props. Limbs are single-pivot rigid levers with no elbows/knees; hands are featureless spheres; faces are authored at a scale nearly invisible at gameplay camera distance (~30 m, 28° FOV). — §4.1
2. **Micro-craft on secondary geometry lags the hero landmarks.** One building (Copperwheel) still runs the bare template core with no craft flags and no seasonal porch; secondary roofs/awnings use un-beveled extrusions; the tea cart's geometry trails its own docstring (spoke-less wheels, no scalloped valance); window planter blooms are five identical dodecahedra; wilds rocks share one formula. — §4.2
3. **The material system is flat-color-only.** Zero texture maps beyond albedo/lightMap exist anywhere (no roughness/normal/AO maps); interiors have zero maps at all; every surface's spec response is a single scalar roughness. The ACES-calibrated 28-color palette is excellent, but wood, fabric, plaster, brick and paper are distinguishable only by hue. — §4.5
4. **Lighting curves are strong but leave flat spots.** The rim light is static across the whole day; hemisphere ground color is season-blind; the RoomEnvironment IBL is a fixed studio blur; contact-shadow discs ignore the moving sun; the greenhouse interior camera branch falls through to exterior treatment (zoom pop). — §4.6
5. **Progression is visually expressed through four proven patterns, but six of the strongest data states remain scene-invisible** (four of six storylines — the other two already render via the orchard transformation and the festoon lanterns; relationship tiers beyond greeting distance, keepsake milestones, exploration discoveries, within-season day progression, lifetime ritual counters). — §4.8

**[ARTISTIC OPPORTUNITY]** None of these ceilings require replacing functioning systems. Every weakness above can be closed by *extending* the existing procedural builders, the existing `MaterialPalette` cache, the existing dirty-flagged `EnvironmentVisualController`, and the existing test contracts.

## 3. Asset inventory snapshot (scale of what exists)

**[CONFIRMED]** All geometry is procedural, builder-composed, and test-locked:

- **Characters**: `buildStorybookCharacter` (~94 meshes per character, `src/scene/builders/characters.ts:149-876`) + bespoke Jun builder (`src/scene/prototypes/willowLaneDiorama.ts:1289-1591`, 36 meshes); `CharacterRig` contract at `src/scene/models.ts:60-98`; 17 animation states + 10-emotion face system driven by `animateCharacterRig` (`characters.ts:878-890`); player avatar with scarf/satchel secondary motion.
- **Exteriors**: shared `buildStorybookCottageCore` with craft-toggle system (`src/scene/builders/buildings.ts:56-90,156-480`) serving 4 lane cottages; fully bespoke Willow Step Cottage (`willowLaneDiorama.ts:135-873`) and Sunbeam Greenhouse/Conservatory (`buildings.ts:1171-1829`); bespoke landmarks — gazebo with lathe bell (`landmarks.ts:17-259`), fountain with 4 water-shader systems and pooled droplets (`landmarks.ts:270-603`, `waterShaders.ts:182-325`), Mirror Pond with spline shoreline, koi, pier, sailboat (`vegetation.ts:416-781`), cedar footbridge with 11 cambered planks (`vegetation.ts:783-854`), Hollow Oak, Old Stone Well.
- **Street furniture & props**: cedar benches with seat-height contracts (`landmarks.ts:792-872`), plaza lamps, festoon strand, lantern signpost, animated mailbox, noticeboard with 1–3 flyers, tea cart, café tables, 5 carryable props (`landmarks.ts:878-996`).
- **Vegetation**: 46-tree instanced perimeter grove in 3 draw calls (`vegetation.ts:38-134`), 5-lobe courtyard trees, wind-swaying orchard crabapples (`orchard.ts`), wilds birches, 5-draw-call instanced meadow dressing (`botanicalDressing.ts:91-316`), pond flora.
- **Interiors** (5 cutaway dioramas, ~6,500 lines total): Willow Step Cottage (~130 meshes), Sunbeam Greenhouse, Hearth & Crumb Bakery, Linden Book Nook, Copperwheel Cottage — each with station proxies, reactive furniture, and (4 of 5) seasonal dressing groups.
- **Textures**: 7 procedural `CanvasTexture` generators ≈ 3.2 MB GPU (`src/scene/textures.ts`), plus PMREM `RoomEnvironment` (~2–3 MB).
- **UI**: 9 React components, lucide icon set + one custom SVG crest, procedural canvas portrait/subject painters (`src/components/DialogueVisuals.tsx`), linen/espresso token system.

## 4. Domain-by-domain findings

### 4.1 Characters & animation

**Confirmed strengths (preserve — these are production-grade):**

1. **Real joint hierarchy with named pivots** (hip 0.42 / waist 0.45 / shoulder 0.53 / neck 0.9 — `characters.ts:199,215,437,456`); every pose is joint-driven, no mesh-swapping.
2. **Motion-craft unusually strong for the scale**: volume-preserving squash & stretch (`characters.ts:1251-1257`), arm follow-through at 0.82× damping ("production walk-cycle standard", `characters.ts:1148-1153`), stride-locked NPC walking (`simulation.ts:773`), continuous player stride-frequency curve (`playerController.ts:56-82`), turn banking with dead-zone (`residentFeel.ts:22-35`), launch lean and brake squash, cloth secondary motion (scarf tails, shawl sway — `characters.ts:1166-1178,1235-1249`), footstep-dust language (`residentFeel.ts:127-187`).
3. **A coherent 10-emotion system** moving lids, brows, and mouth arc together (smile↔frown arc rotation, surprise "o" — `characters.ts:1078-1128,1180-1233`), backed by 35-minute sim hysteresis (`simulation.ts:365-396`); deterministic blinking (`characters.ts:1130-1135`).
4. **Named identity-part system with an exclusivity test harness** (`residentIdentity.test.ts:125-153`): `hat_flower`, `beard`, `orchard_belt`, `pruning_shears`, `knee_patch`, `freckles`, `paint_smudges`, `sketch_roll`, etc.
5. **Winter knit season system** with per-rig material clones that never mutate the shared cache (`characters.ts:818-848`, `winterKnits.test.ts:115-134`).
6. **Per-resident customization breadth**: Clara's apron/bun/hair-pin/loaf, Arthur's pocket-watch chain/loupe, Mina's straw hat blossom/watering can, Jun's fully bespoke courier build (satchel with peeking postcard, scarf tail pivot), Barnaby's leather apron/beard/soot, Sora's beret/shawl/violin, Toby's hood/paint smudges/sketch roll, Nora's brass glasses/silver bun, Pip's freckles/knee patch/dungarees, Rowan's lathe apple basket/belt/shears — `characters.ts:253-427,521-590,607-648,650-712,716-802`, `residents.ts` appearance blocks.

**Confirmed weaknesses (the character ceiling):**

1. **Limb rigidity.** Legs are one hip pivot with welded pant+boot (`characters.ts:197-211`); arms are one shoulder pivot with welded sleeve+cuff+hand (`characters.ts:435-449`). No elbows, knees, wrists or ankles; `run`/`sprint` read as scissoring rigid levers with higher amplitude (0.72/0.92 vs walk 0.48 — `characters.ts:927-959`).
2. **Featureless hands.** r 0.07 spheres (`characters.ts:445`); props attach to the arm pivot, not the hand (`characters.ts:727,757,801`) — grip is implied, never shown.
3. **Faces authored below the readability threshold.** Head r 0.285, eye spheres r 0.036 (12.6% of head radius), catchlight r 0.013, mouth tube r 0.0125 (`characters.ts:458-519`). At the gameplay camera (distance ≈ 33·zoom, fov 28° — `NeighborhoodCanvas.tsx:431-435`) these are a few pixels wide. Verified visually in `download/asset-qa/pass26/rowan_plaza_face.png`: at default zoom, faces read as plain spheres; identity is carried by hat/hair/coat color only.
4. **Silhouette variety is accessory-only.** Every resident shares identical torso cylinders, limb radii and head radius; only `heightScale` and coat-skirt flare (0.34 vs 0.37 for three residents — `characters.ts:219-224`) alter the core mass. No per-resident shoulder width, belly, leg length, or posture. [ARTISTIC OPPORTUNITY: body-mass archetypes are the single highest-leverage character upgrade.]
5. **Eyes are static beads.** No pupil tracking (look-at rotates the whole head, `characters.ts:1137-1143`), no eye whites, no gaze darts; blink is a lid scale-pop.
6. **`emotionIntensity` is computed by the sim (0.55–0.85, `simulation.ts:369-396`) but never rendered** — the rig options carry no intensity field (`characters.ts:15-26`); all emotions snap toward full amplitude.
7. **No speech-driven mouth motion** — `talk` (`characters.ts:1000-1008`) and `converse` (`characters.ts:1045-1053`) animate arms/head only; the mouth is emotion-driven only.
8. **Residents never run** — a single `DEFAULT_NPC_SPEED = 2.3` (`simulation.ts:58`); `run`/`sprint`/`turn` states are player-only in practice. [OPTIONAL SUGGESTION: hurried gait for high-curiosity residents.]
9. **Carry pose is one-size-fits-all** (symmetric cradle −0.84 regardless of prop, `characters.ts:1063-1068`).
10. **Character materials are numeric-only** — flat `MeshStandardMaterial` from a color-keyed cache; no trim strips, two-tone garment panels, or fabric texture. (Character code *can* receive maps once Doc 06 adds them.)
11. **Jun's builder duplicates the facial/hat code path** (`willowLaneDiorama.ts:1436-1499` vs `characters.ts:455-519`) — drift risk when faces evolve.

**Test contracts that lock this domain** (upgrades must evolve them deliberately, never break them): mouth-arc behavior and named parts (`residentIdentity.test.ts:68-153`), player silhouette envelope "width ≤ NPC baseline + 0.03" and seated clearance (`playerAvatar.test.ts:67-95`, `environmentRenderer.test.ts:179-250`), squash math (`playerAvatar.test.ts:97-114`), banking/lean/squash feel (`residentFeel.test.ts`), winter tint recipe (`winterKnits.test.ts:41-153`).

### 4.2 Buildings & exterior architecture

**Confirmed strengths:**

1. **Structural truth is systematic**: awning posts reach y = 0 with stone shoes (`buildings.ts:441-450`); Willow porch is fully post-supported with carved pads and knee rafters ("Zero Floating Geometry!" — `willowLaneDiorama.ts:401-493`); tea-cart canopy carried by 4 chamfered posts (`landmarks.ts:675-695`); bakery display ledge on carved corbels (`buildings.ts:594-603`); greenhouse vestibule wraps the real west doorway ("the decoy frame is deleted", `buildings.ts:1475-1529`).
2. **Every named building has a distinct story program** (4–6 signature props each, bounds-checked with inline plot-compliance comments): bakery brick oven dome + bakehouse wing + chalkboard + bread-board sign (`buildings.ts:513-653`); book nook canted bay window + stacked-books blade sign + rolling cart (`buildings.ts:734-871`); woodshop sawhorse with kerf + lumber + wheelbarrow (`buildings.ts:1024-1144`); Copperwheel gear medallion + vent pipe + workbench crate (`buildings.ts:912-971`).
3. **Hero landmarks are genuinely layered**: lathe-stone fountain with lion-spout jets, 12 cascade arcs, 20 pooled droplets and 4 shader water behaviors (`landmarks.ts:270-603`); gazebo with 6 plinthed columns, 12 knee braces, 5 balustrades, 2-tier spire, hidden-until-restored lathe bell (`landmarks.ts:17-259`); Mirror Pond with 18-point spline shoreline, 18 mossy bank rocks, cedar pier, walnut sailboat, 3 articulated koi (`vegetation.ts:416-781`).
4. **Vegetation pipeline is benchmark-grade**: lathe trunks with root flares, multi-lobe canopies with explicit "never 1 raw polyhedron" comments (`willowLaneDiorama.ts:1013-1036`), per-instance 4-tone tinting, wind-sway rigs, legality-checked seeded placement.

**Confirmed weaknesses:**

1. **Copperwheel Cottage still runs the bare template core** — no `craft` key (no sill band, quoins, bargeboards, loft vents, default box chimney) at `buildings.ts:879-893`, and its porch dressing is explicitly excluded from the Pass-26 season system (`porchSeasonLife.ts:16-17`). The Phase-B docstring anticipated enabling these "until their own pass enables them" (`buildings.ts:72-77`) — that pass never landed. It is also the thinnest silhouette of the six buildings (cf. `docs/audits/09-comprehensive-asset-visual-audit.md:45,80`).
2. **Core roof massing is still a plain beveled gable prism on 3 of 4 core cottages** (book nook, woodshop, Copperwheel share the same triangle profile; only the bakery gained the bakehouse wing). [ARTISTIC OPPORTUNITY: a single secondary roof element per building breaks the "cream box + triangle" read at distance.]
3. **Tea-cart geometry trails its docstring**: promises "spoked wheels" and "scalloped awning" (`landmarks.ts:607-608`) but delivers spoke-less tori (`landmarks.ts:640-645`) and a valance-less striped canopy (`landmarks.ts:685-695`).
4. **Un-beveled secondary extrusions**: greenhouse roof glass (`buildings.ts:1291`), bakery wing roof (`buildings.ts:551`), noticeboard hood (`landmarks.ts:748-760`), greenhouse porch gables (`buildings.ts:1503`).
5. **Window planter blooms are 5 identical dodecahedra** on every core-cottage window (`buildings.ts:138-148`) versus Willow's richer 3-bud tufts (`willowLaneDiorama.ts:96-107`) — a visible template fingerprint. Verified visually in `bakery_porch_spring.png`.
6. **Rock/moss formula repetition** in wilds/dressing — a shared icosa-squash rock *pattern* whose squash constants are re-tuned per site rather than a genuinely varied rock family (`wilds.ts:154,384,539,628` use related squash formulas: 1.15/0.7/0.9, 1.1/0.62/0.9, 1.1/0.5/0.85, 1.2/0.72/1.0). [OPTIONAL SUGGESTION: 2 additional rock variants + tint spread.]
7. **Gazebo column plinths meet the dais by only ~0.03 overlap** (`landmarks.ts:79-81` vs column base) — acceptable at gameplay distance, a zoom-inspection risk only.

### 4.3 Interiors & furniture

**Confirmed strengths:**

1. **Objects narrate (the CoC "intentionality" bar is met)**: chalk-line menu slate + service bell + flour sacks say "shop" (`bakeryInterior.ts:461-497`); pegboard + vise + loupe + gear tray say "clockmaker" (`copperwheelInterior.ts:305-347`); tea-ring ledger + returns slip say "lending library" (`bookNookInterior.ts:395-408`); boots/hat/umbrella by the door say "someone lives here" (`cottageInterior.ts:1244-1273,1500-1512`).
2. **State-reactive furniture is best-in-repo**: progress-derived home mementos pinned to furniture footprints with zero schema impact (`cottageInterior.ts:1783-1789`, tests `cottageInterior.test.ts:407-475`); bakery roster↔loaf/steam contract; nook cover tint follows the featured book; Copperwheel day-cycle bench projects with conditional pendulum swing; greenhouse 3-stage crops with watered-soil darkening.
3. **A working wall clock tracking `minuteOfDay`** with exact-angle tests (`cottageInterior.ts:1708-1712`).
4. **Winter warmth is systemic**: knit runners, throws, hearth socks, paraffin heater, fire reserves across 4 interiors; per-room lighting scripts (`NeighborhoodCanvas.tsx:1606-1671`) each echo the building's exterior palette.
5. **Proportions are consistent**: seat heights within ±0.05 of the `seatHeight` sim contract; doors ≈1.5× character height; tables at counter height for a chibi cast (details in Doc 05 §4).

**Confirmed weaknesses:**

1. **Box-dominant geometry**: ~393 Box vs ~200 Cylinder vs ~87 Sphere primitives across the 5 interior builders; exactly **one** LatheGeometry (cottage pitcher, `cottageInterior.ts:734`) and **one** ExtrudeGeometry with bevels explicitly off (greenhouse roof, `greenhouseInterior.ts:339`). Plates, trays, clock cases and cards are rectangular slabs.
2. **Zero texture maps indoors** (no `map:` assignments in any of the five builders) — wood, brick, plaster, fabric, paper are flat colors despite `textures.ts` infrastructure existing since long ago.
3. **Fabric never drapes** — pillows, quilts, blankets, runners are stacked/rotated boxes; the bakery counter runner is literally 9 interleaved slabs (`bakeryInterior.ts:783-795`).
4. **Kit repetition across interiors**: copper kettle ×3, teacup+saucer ×4, door+rails+brass-knob ×5, iron-cage lantern ×4, steam-puff system ×4 — same recipe, new constants.
5. **Copperwheel interior has no seasonal dressing** (its rig interface lacks `seasonLife`, `copperwheelInterior.ts:23-34`), matching its excluded porch — winter there is lights-only.
6. **Proxy generosity mismatch**: cottage hit proxies are 1.15-wide vs 0.62 in all other interiors (`cottageInterior.ts:1672` vs e.g. `bakeryInterior.ts:933`) — indoor click feel differs between home and shops.
7. **Sub-0.03-unit details** (clock pin r 0.02, comb teeth 0.012, chalk lines 0.01) will shimmer at interior zoom ranges (0.56–0.92). [OPTIONAL SUGGESTION: raise hero micro-details to the 0.12–0.40 m trim band per `REFERENCE_GUIDELINES.md` §3.3.]
8. **Greenhouse camera branch falls through to exterior treatment** (`NeighborhoodCanvas.tsx:2323-2338` lists only cottage/bakery/nook/copperwheel) — a visible zoom pop between the entry snap (0.66) and per-frame damping. [CONFIRMED inconsistency; likely intentional for the larger room but unreconciled.]

### 4.4 Vegetation, water & world dressing

**Confirmed strengths:** perimeter replaced stone/split-rail/hedgerow/hills (no floating blocks — `vegetation.ts:154-235`); cobble/plaza seams now overlap by 0.05 m with curb stones (`NeighborhoodCanvas.tsx:514-522`, `willowLaneDiorama.ts:1118-1137`); 5-draw-call instanced meadow with 13 handcrafted cluster anchors (`botanicalDressing.ts:52-100`); pond/fountain/stream are 3 `onBeforeCompile` materials with caustics, foam, raindrop rings, skip-stone splashes, winter ice and dusk lantern glints (`waterShaders.ts:52-325`); orchard wind sway and seasonal blossom/leaf drift; Wild Hollows districts ship within an ≤80-mesh draw budget enforced by tests.

**Confirmed weaknesses:** perimeter grove trees read as 2-lobe stacks from some angles (visible in `bakery_porch_spring.png` top edge); rock-formula repetition (§4.2.6); water depth is an analytic ellipse tuned to the one pond shape (`waterShaders.ts:104,114-115`) rather than a fresnel/scene-depth read. [ARTISTIC OPPORTUNITY: fresnel term in the existing injection point — no new pipeline.]

### 4.5 Materials & textures

**Confirmed strengths:** the `MaterialPalette` cache (`materials.ts:19-52`) serves ~495 `standard()` call sites across 13 production files with a 28-color ACES-calibrated palette (`materials.ts:71-107`); roughness spans 0.10–0.95 with signature separation (matte masonry 0.88–0.92, glazed ceramic ≈0.42, brass 0.24–0.25/0.85, iron 0.42–0.45/0.65–0.72); window/lantern glass deliberately duplicated per building for independent emissive glow (`buildings.ts:190-206`); per-instance `setColorAt` tone arrays for grove/orchard/meadow; winter HSL re-dye recipe for knitwear (`characters.ts:32-100`).

**Confirmed weaknesses:**

1. **Zero shader maps beyond albedo/lightMap** — repo-wide grep for `roughnessMap|normalMap|metalnessMap|aoMap|bumpMap` returns nothing. The cobble texture fakes bevel shading with canvas highlight strokes (`textures.ts:147-150`).
2. **Flat scalar roughness = uniform specular** across each material family; per-material `envMapIntensity` is unused (0 grep matches); the RoomEnvironment IBL is a single fixed-blur studio response (`NeighborhoodCanvas.tsx:422-427`) that doesn't follow time of day.
3. **Interior builders receive no textures at all** (§4.3.2) even though 7 generators already exist.
4. **Winter ground wash reads pale** in QA captures (`plaza_winter_residents_a.png`: cobble and meadow wash toward cream/mint under ACES 0.98 + hemi + IBL) — the pre-calibration risk flagged by the old audit is *reduced but not eliminated* in winter.

### 4.6 Lighting, camera & atmosphere

**Confirmed strengths:** ACESFilmic 0.98 + SRGB; full day-cycle curves (sky, sun color/intensity, hemi, `environmentIntensity` 0.68→0.15, fog distances) driven zero-GC by `EnvironmentVisualController` (`environmentRenderer.ts:329-382`); sun orbit (azimuth lerp 0.42→2.6, height curve — `environmentRenderer.ts:378-382`); per-phase emissive choreography (windows dusk 2.1 / golden 0.9, lanterns 2.15, festoons); hearth-truth windows tied to kettle/hearth state (`environmentRenderer.ts:294-327`); weather overlays (rain sky lerp, mist fog 26/68); interior lighting scripts per room; title orbit and dialogue framing with occlusion lift.

**Confirmed weaknesses / opportunities:**

1. **Rim light is static** (`#C8DCF2`, 0.45, never mutated after construction — `NeighborhoodCanvas.tsx:462-464`): it does not fade as the sun drops to 0.44 at dusk; slight twilight flattening.
2. **Hemisphere ground color is season-blind** (`#7A664E→#34324A` only — `environmentRenderer.ts:369-372`); season palettes tint albedo only.
3. **Contact-shadow discs are static and un-instanced** — one plane per prop/character/building (`vegetation.ts:6-26`, dozens of 1-quad draw calls), unresponsive to sun azimuth; the largest un-instanced draw-call category.
4. **No per-phase PMREM regeneration** — the studio environment map persists all day, retuned only by the scalar `environmentIntensity`.
5. **No shadow-camera follow logic** — the ±28 ortho box is fine when the sun is high but drifts at low sun angles. [CONFIRMED by config inspection; visual impact currently mild.]
6. **Post-processing is entirely absent** (repo-wide grep: no EffectComposer/bloom/SSAO). Glow is emissive meshes + halo planes only. **[ARTISTIC OPPORTUNITY]** This is a *feature* for mobile parity — Doc 06 deliberately keeps it and achieves richness via maps + curves instead.
7. Camera zoom floor is 0.72 (≈14 u) — no close-up capability by design; dialogue close-ups live in the UI's procedural portraits. Preserved as identity.

### 4.7 UI, iconography & presentation

**Confirmed strengths:** disciplined single palette across all 9 components; lucide-only icons + one hand-authored SVG crest (zero emoji); procedural knit-pattern portrait painter with per-resident hats/expressions/motif badges (`DialogueVisuals.tsx:246-437`) — genuinely bespoke; tone-coded dialogue choices (gift sage / blunt blush / reply paper — `DialogueSheet.tsx:398-425`); 44px hitboxes nearly everywhere; `prefers-reduced-motion` kill-switch; journal roving-tab keyboard navigation.

**Confirmed weaknesses:**

1. **Tokens declared but bypassed** — 7 CSS variables exist (`index.css:8-14`) while ~40 hex literals hardcode the palette in JSX; no spacing/elevation/shadow tokens.
2. **No bespoke iconography** — stock lucide outline glyphs everywhere; the storybook voice appears only in portraits.
3. **No weather/season icons** — HUD and journal render "Light Rain", "Winter" as plain text (`App.tsx:1228-1230`, `JournalDrawer.tsx:729-732`); for a weather-driven cozy game this is the most visible missing iconography.
4. **Satchel items are typographically flat** — 25 items, no thumbnails or tint chips (`InventoryDrawer.tsx:157-219`), while `SubjectCanvas` already paints 37 object scenes for prop cards and is simply not applied to items.
5. **Two avatar systems** — rich portraits in dialogue vs bare initial circles in Journal People (`JournalDrawer.tsx:568-574`).
6. **Dialogue tone flattening** — 4 of 5 `DialogueChoice.tone` values render identically (`types.ts:821`).
7. **A11y gaps**: `focus-visible` styling only on the two title buttons; 40px zoom targets below the 44px rule; viewport blocks pinch zoom (`index.html:5`); HUD toast lacks `role="status"`.
8. `motion` dependency installed but unused (`package.json:22`); no favicon; zoom button labels inverted vs ref semantics.

### 4.8 Progression → visual mapping

**Confirmed strengths (four proven, test-locked patterns):**

1. **Story-flag prop groups**: 13 flags → visible scene changes (window-box blooms 0–3 stages, fountain flow + coins, gazebo ivy/clapper/festoons/ribbon, café tables, marigold ribbon, Hollow Oak glint — full map in Doc 07 §2).
2. **Outcome-branched landmark dioramas**: `orchardGatheringOutcome` swaps tasting-table centerpiece (tart vs picnic) + garland glow (`orchard.ts:820-825`).
3. **Derived home mementos**: 5 keepsakes derived read-only from counters/memories with zero schema impact (`cottageInterior.ts:1783-1789`, "never persist a memento flag" — `HANDOVER.md:7-9`).
4. **Deterministic day-cycle interior swaps**: bakery bake roster, nook featured-book cycle, Copperwheel bench-project cycle, greenhouse growth stages.

**Confirmed gaps (data exists, scene is silent):** four of six storylines have no world prop (zine, herb loaf, music stand, pocket watch — the orchard gathering renders as a landmark diorama and the lanterns conflict feeds the festoon display); relationship tiers beyond greeting distance are journal-only; keepsake milestones (affinity 35–45, `inventory.ts:397-428`) never mark the moment in-world; exploration discoveries leave no landmark mark; `dayOfSeason` (1–10) has no visual gradient; lifetime ritual counters are journal-text-only; `noticeboardUpdated` has no renderer consumer. Full analysis in Doc 07.

## 5. Technical constraints (binding context for every recommendation)

**[CONFIRMED]**

1. **Software-WebGL parity**: detection regex (`NeighborhoodCanvas.tsx:385-394`); degradation ladder = DPR 1, no AA, no shadow maps, skip `renderer.compile()`, `afterDraw` fence pacing (≈12.5 FPS ceiling, 80 ms schedule), particle caps (rain 24 vs 48, fireflies 8 vs 14, etc.); dt clamp 0.05 s. Scene content must never change under software GL (`AGENTS.md:79`).
2. **Draw-call budgets**: grove 46 trees in 3 calls; meadow in 5; orchard ≈20; Wilds ≤80 meshes test-enforced; 38 `InstancedMesh` constructions repo-wide; contact-shadow discs are the main un-instanced sink (§4.6.3).
3. **Zero-GC frame loop**: module-scope scratch vectors/options; dirty-flag gating via revision bit-packing (`environment.ts:192-238`); HUD sync throttled 0.18 s. One known per-frame allocation remains (`composeEnvironmentState()` builds a fresh object graph, `environment.ts:240-275`).
4. **Texture budget**: ~3.2 MB procedural + PMREM ~2–3 MB; no compressed-texture pipeline exists (no KTX2/DDS). Doc 06's map program must stay in the ≤16 MB envelope.
5. **Three.js 0.187 / React 19 / Vite 8 / Tailwind v4** (`package.json`); no post-processing stack; `motion` installed but unused.
6. **Test harness**: `npm test` runs `node:test` suites over game + scene contracts, including walkability validation per resident per phase, mesh-count envelopes, seasonal clearance law (0.4–0.45 u from interactables), named-part exclusivity, and seated-clearance contracts. Visual upgrades must keep these green or evolve them explicitly.
7. **No GPU FPS telemetry exists** — QA is screenshot + console-error based (`WORKLOG.md:533,942,958`); Doc 08 Phase 0 adds a lightweight capture/measure harness.

## 6. Strengths and weaknesses summary

**Strengths to protect (do not rebuild):**
- ACES-calibrated 28-color palette + shared material cache discipline.
- Structural truth-telling (zero floating geometry) as a systematic builder rule.
- Story programs per building/interior (props that narrate).
- The 4-phase lighting curves and hearth-truth emissive choreography.
- The character motion stack (squash/bank/lean/cloth/stride parity).
- The named-part test harness that locks identity.
- The derived-memento pattern (schema-frozen visual progression).
- Zero-emoji UI discipline + procedural portrait craft.
- Software-GL degradation ladder and zero-GC loop hygiene.

**Weaknesses ranked by player-perceived impact:**
1. Character faces/silhouettes at gameplay distance (§4.1.3–4) — affects every frame of play.
2. Box-flat interiors with no surface texture (§4.3) — affects the entire home/shop experience.
3. Copperwheel building + porch unfinished (§4.2.1) — the one visible "template" building.
4. Flat scalar materials everywhere (§4.5.1–2) — caps the polish ceiling of every asset at once.
5. Scene-invisible progression (§4.8) — the world under-reports the player's care.
6. Secondary micro-craft (tea cart, planters, rocks, bevels) (§4.2.3–6).
7. UI iconography and token adoption (§4.7.1–4).
8. Lighting flat spots (rim, hemi season-blindness, IBL) (§4.6.1–4).

## 7. What "good" looks like after the upgrade (acceptance preview)

The full acceptance criteria are in Doc 08 §11; the headline outcomes:

- At default gameplay zoom, each resident is identifiable by **body archetype + hair/hat + coat color block** before facial detail; at dialogue zoom, eyes/brows/mouth clearly read emotion.
- Every interior surface family (wood, plaster, fabric, brick, paper) shows **evident craft** via procedural maps without exceeding texture budgets.
- No building reads as "cream box + triangle": every named building has a **second roof element or massing break**.
- Progression states a player earned are **visible in the world** within the same session.
- Software-WebGL output remains content-identical; all test suites stay green; draw calls stay within existing budgets plus the small instanced additions.

## 8. Assumptions / unknowns

- GPU-side FPS is unmeasured in the repo (no telemetry); Doc 08 Phase 0 establishes a baseline before any visual work lands. [CONFIRMED gap, not assumed performance]
- Exact pixel size of facial features at the gameplay camera is computed geometrically (distance ≈ 33·zoom, fov 28°) and corroborated by QA screenshots; per-device DPI variation remains an unknown to be captured in the Phase-0 harness.
- The greenhouse interior camera fall-through (§4.3.8) is assumed unreconciled rather than intentional; flagged for the owning team to confirm.

## 9. Evidence index

- Code: all `file:line` citations in this document refer to the working tree at commit `9cde87d` ("Build 10 'The Wild Hollows' — scene polish", 2026-11).
- Screenshots: `download/asset-qa/pass26/` — `plaza_winter_residents_a.png` (winter plaza, dry fountain, HUD, character scale), `rowan_plaza_face.png` (face-readability evidence), `bakery_porch_spring.png` (bakery/book-nook craft, template planter blooms, grove canopies), plus `mina_hat_flower_plaza.png`, `barnaby_beard_dialogue.png`, `rowan_procedural_portrait.png`, porch-season captures.
- Prior audits consumed: `docs/art-direction/VISUAL_AUDIT.md`, `docs/art-direction/building-architecture-audit.md`, `docs/audits/01–09`, `docs/production/everyday-life-{visual-direction,polish-roadmap,quality-assessment}.md`.

## 10. Remediation verification of the 2026-11-18 visual audit

| Old finding (VISUAL_AUDIT.md) | Status in current build | Evidence |
| :--- | :--- | :--- |
| Uniform template cottages via `buildClayCottage` | **FIXED & REMOVED** — legacy builders deleted; Willow bespoke; 4 cottages use craft-flagged core + distinct programs | `models.ts:1-14`, `buildings.ts:502,724,994` vs `881-893` |
| Floating door awnings | **FIXED** — posts reach y = 0 with stone shoes | `buildings.ts:441-450` |
| Tea-cart floating canopy | **FIXED** — 4 grounded posts | `landmarks.ts:675-695` |
| Single-polyhedron lollipop trees | **FIXED** — lathe trunks, 2–6 lobe canopies, forks | `vegetation.ts:45-64`, `willowLaneDiorama.ts:1013-1036` |
| Floating perimeter wall blocks | **FIXED** — stone/split-rail/hedgerow/hills | `vegetation.ts:154-235` |
| Cobble seam gap 0.35 m | **FIXED** — overlap + curbs + synced dressing rects | `NeighborhoodCanvas.tsx:515,518` |
| Premature gazebo clapper | **FIXED** — built hidden, gated on `bellGleaming` | `landmarks.ts:196-199`, `environmentRenderer.ts:219` |
| Missing contact shadows under software GL | **FIXED** — `addContactShadow` everywhere | `vegetation.ts:6-26` |
| Un-pooled materials | **FIXED** — `MaterialPalette` cache | `materials.ts:19-52` |
| Dead legacy builders | **FIXED** — removed | `models.ts:6-14` |
