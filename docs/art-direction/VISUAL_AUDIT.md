# VISUAL_AUDIT.md — Comprehensive Visual & Rendering Audit

**Audit Date**: 2026-11-18  
**Methodology**: Direct inspection of `src/scene/NeighborhoodCanvas.tsx`, `src/scene/models.ts`, `src/scene/textures.ts`, `src/game/worldMap.ts`, `src/game/residents.ts`, `src/App.tsx`, `src/components/*`, plus live headless Chromium captures at `1440×900` desktop (`baseline-title-desktop.png`, `baseline-play-desktop.png`) and `390×844` mobile (`baseline-play-mobile.png`).  
**Baseline Distinction**: All findings below distinguish **Confirmed Actual State** (observed in code and live screenshots) from **Assumptions / Unknowns**.

---

## 1. Executive Visual Quality Assessment

**Current Visual Identity**: **LITTLE SOMEWHERE** currently implements a functional, readable early prototype of *Sunlit Diorama & Clay Storybook*—with cohesive storybook UI typography (`Fraunces` + `Plus Jakarta Sans` + `JetBrains Mono`), clean cream-linen HUD framing (`#FAF5EC`), a recognizable 4-phase lighting progression, and distinct layout zoning for 6 cottages, Sunbeam Greenhouse, Old Bell Gazebo, Stone Fountain, and Mirror Pond.

**Where It Falls Short of "Premium Handcrafted Storybook Diorama"**:
1. **Uniform Template Architecture**: All 5 cottages share a single parameterized box-plus-extruded-triangle builder (`buildClayCottage` in `src/scene/models.ts:23-219`), giving the bakery, bookshop, player cottage, and workshops identical boxy proportions.
2. **Unfinished Primitive Props & Barriers**: Several props visible in the main camera frame are raw unjoined primitives—most noticeably Sora's Tea Cart (`NeighborhoodCanvas.tsx:439-458`, a floating purple slab above a brown box with no posts), the perimeter walls (`L232-239`, floating gray rectangular blocks spaced around the horizon), the Noticeboard (`L460-480`), and the Willow Mailbox (`L305-323`).
3. **Chalky / Washed-Out Surface Contrast**: Under `ACESFilmicToneMapping` (`0.98`), `hemiLight` (`0.62`), `sunLight` (`1.52`), and `RoomEnvironment` IBL, the light cobblestone (`#D2C3AA`–`#D9CCB5` on `#B8A88F` mortar) and meadow (`#759D5A`) wash out into a pale pastel cream/mint field with weak figure-ground contrast, especially when `shadowMap` is disabled under software WebGL.
4. **Generic Toy-Like Characters & Single-Polyhedron Trees**: Residents (`buildClayCharacter`, `models.ts:491-674`) use plain cylinders/capsules with stiffly hanging arms and 2 black sphere eyes; trees (`L242-279`, `L520-546`) are single `DodecahedronGeometry` lollipops on smooth cylinders.
5. **Initial Camera Drift & Desktop Virtual Joystick**: On `?autostart=1` (`baseline-play-desktop.png`), camera starts at `(18, 17, 18)` and damps slowly under software WebGL (~8 FPS), causing the player and Willow Step Cottage to be clipped off the left edge for the first 2 seconds of gameplay; additionally, `VirtualJoystick` renders unconditionally on desktop `1440×900` (`App.tsx:434`).

---

## 2. Domain-by-Domain Audit & Weakness Matrix

### Priority Legend
- **P0 (Critical / Immediate Visual Defect)**: Broken structural geometry, floating props, severe readability/framing glitch, or unfinished placeholder clearly visible on spawn/title.
- **P1 (High Impact Visual Elevation)**: Core buildings, paths, ground contrast, characters, and vegetation that define the storybook diorama impression.
- **P2 (Medium Polish)**: Secondary neighborhood props, animated fauna/foliage, HUD refinement, and atmospheric nuance.

---

### Audit 1 & 2: Current Visual Identity & Building / Architectural Assets
- **Actual State (`src/scene/models.ts:23-414`, `NeighborhoodCanvas.tsx:287-436`)**:
  - `buildClayCottage()` builds a stone box plinth, plaster box body, 4 corner square posts, extruded triangle roof, square chimney + cylinder pot, door group with optional sloped box awning, and square windows with flower boxes.
  - `buildGreenhouse()` (`models.ts:221-307`) uses translucent glass (`opacity: 0.45`, `depthWrite: false`) over timber ribs with 6 interior pots and a warm bulb—already a strong concept!
  - `buildOldBellGazebo()` (`models.ts:317-414`) uses an octagonal dais, 6 columns, ring beam, cone spire roof, brass finial, and a `LatheGeometry` bell—good centerpiece silhouette, though the brass `clapper` mesh (`L380-382`) renders visible even before `flags.bellRestored` is true.
- **Weaknesses**:
  1. **Repetitive Cottage Silhouettes (`buildClayCottage`)** *(Priority: P1 | Cost: Low–Medium)*:
     - *What's wrong*: Player cottage, Clara's bakery, Nora's bookshop, Arthur's workshop, and Barnaby's woodshop share one rigid box-and-triangle form. Windows are flat 0.8×0.8 squares without shutters, muntins, or depth.
     - *Desired result*: Distinct architectural personalities—e.g. Willow Step Cottage with cozy dormer/porch deck & scalloped overhang; Bakery with stone hearth oven bulge & café display sill; Book Nook with bay window & stacked books; Copperwheel with clock/gear wall medallion & copper pipe chimney.
     - *How to improve*: Modularize architectural roof/porch/window/door sub-builders with chamfered trim, shutters, muntin bars, porch posts, and grounded contact AO skirts.
  2. **Floating Door Awnings (`models.ts:141-148`)** *(Priority: P0 | Cost: Negligible)*:
     - *What's wrong*: Awnings on Willow Step Cottage, Hearth & Crumb, and Linden Book Nook (`baseline-play-desktop.png`, `baseline-play-mobile.png`) float off the wall face with zero brackets or support posts.
     - *Desired result*: Every awning or porch overhang supported by timber corner posts resting on the porch step or diagonal wall corbels.
  3. **Gazebo Brass Clapper Premature Visibility (`models.ts:380-382`)** *(Priority: P0 | Cost: Negligible)*:
     - *What's wrong*: Brass clapper renders inside the bell even at Day 1 before being rescued from Hollow Oak.
     - *How to improve*: Expose `clapperMesh` on `GazeboRig` and toggle visibility by `flags.bellRestored`.

---

### Audit 3: Character Model Quality
- **Actual State (`src/scene/models.ts:491-674`, `src/game/residents.ts:15-448`)**:
  - Characters use a contact shadow disc, torso cylinder, collar torus, capsule legs/arms, sphere head, hemisphere hair cap, 2 sphere eyes, hat variants (`beret`, `straw`, `cap`, `bun`, `hood`), and basic props (`satchel`, `watering_can`, `violin`, `book`, `loaf`).
- **Weaknesses** *(Priority: P1 | Cost: Low)*:
  - *What's wrong*: Arms hang straight vertically with zero elbow/cuff/hand read; coat torsos lack flared lower hems, aprons, buttons, or back silhouette detail; faces have only 2 tiny dot eyes with no nose, blush, or brow/hairline softness—making NPCs look like generic low-poly pawns from behind or side views (`baseline-play-mobile.png`).
  - *Desired result*: Tactile clay storybook figurines with flared coats/aprons, warm sculpted nose/cheeks, expressive catchlight eyes, layered hair bangs, angled resting arms with hands/cuffs, and signature storytelling props (e.g., envelope peeking from Jun's satchel).
  - *How to improve*: Upgrade character rig builder with layered clay garment geometry, shoulder/hip pivot groups, facial detail assembly, and per-character accessories.

---

### Audit 4: Vegetation & Environmental Asset Quality
- **Actual State (`NeighborhoodCanvas.tsx:230-280, 439-546`)**:
  - Perimeter trees (`treeCount = 46`): single cylinder trunk + single `DodecahedronGeometry` crown via `InstancedMesh`.
  - Hollow Oak (`L520-546`): 1 cylinder trunk + 1 `DodecahedronGeometry` crown + 1 glowing gold sphere.
  - Interior neighborhood greenery: almost zero bushes, garden beds, grass tufts, fences, or wildflowers outside cottage window boxes; perimeter walls (`L232-239`) are bare spaced gray boxes; Tea Cart (`L439-458`) has an unsupported floating purple slab; Noticeboard (`L460-480`) has 1 blank white square; Cobble strips (`L222-227`) leave a visible green triangle/sliver gap along the east plaza edge (`baseline-play-desktop.png` bottom-right).
- **Weaknesses**:
  1. **Floating Tea Cart Canopy & Bare Horizon Blocks (`NeighborhoodCanvas.tsx:232-239, 452-456`)** *(Priority: P0 | Cost: Negligible)*:
     - *What's wrong*: Tea Cart canopy floats without poles (`baseline-play-desktop.png`); perimeter wall boxes (`WallN`/`WallS`) float as disconnected sterile blocks around the meadow edge.
     - *How to improve*: Add 4 corner wooden poles + teacup tray to Tea Cart; replace bare perimeter blocks with staggered stone-and-split-rail garden walls interspersed with layered hedgerows.
  2. **Single-Dodecahedron Lollipop Trees & Empty Meadow Margins** *(Priority: P1 | Cost: Low)*:
     - *What's wrong*: Smooth cylinders + single polyhedron canopies lack organic storybook volume, and transitions between cobbles and grass look abrupt and sparse.
     - *How to improve*: Build multi-lobe sculpted tree crowns (3–5 overlapping squashed foliage puffs + branch Y-forks) instanced across perimeter + courtyard clusters; add flagstone/curb borders, clover tufts, wildflowers, and wooden benches.
  3. **Cobblestone Strip Junction Gap (`NeighborhoodCanvas.tsx:222-227`)** *(Priority: P0 | Cost: Negligible)*:
     - *What's wrong*: Visible thin green meadow gap between the central plaza slab (`w=12.5`) and east walkway (`x=8.5, w=3.8` -> `minX=6.6` vs plaza `maxX=6.25`, leaving a `0.35m` slit visible in `baseline-play-desktop.png`).
     - *How to improve*: Expand plaza/walkway overlap or dress seams with stone curb borders.

---

### Audit 5: Material & Texture Quality
- **Actual State (`src/scene/textures.ts`, `src/scene/models.ts`)**:
  - `textures.ts` generates 4 procedural `CanvasTexture` assets: meadow (`512×512`), cobble (`512×512`), roof shingles (`256×256`), and radial contact shadow (`128×128`), all properly tagged `SRGBColorSpace` with `maxAnisotropy`.
  - `models.ts` creates fresh `MeshStandardMaterial` instances inside every builder call (`makeMat()`).
- **Weaknesses**:
  1. **Pale / Bleached Cobblestone & Plaster Values Under ACESFilmic** *(Priority: P1 | Cost: Zero)*:
     - *What's wrong*: Cobble colors (`#D2C3AA`–`#D9CCB5` over `#B8A88F`) look almost flat cream in daylight (`baseline-play-desktop.png`), reducing contrast with cream cottage walls (`#F5EAD7`) and cream HUD cards (`#FAF5EC`).
     - *How to improve*: Deepen cobble stone contrast and mortar warmth (`#8E7B64` mortar, `#B7A287`–`#CBB79D` stones with subtle `roughnessMap`/warm variation) and deepen meadow tones (`#5D8348` base with warm clover highlights) so characters and cream cottages pop crisply.
  2. **Un-pooled Material Allocations (`models.ts:19-21`)** *(Priority: P1 | Cost: Negative — reduces GPU work)*:
     - *What's wrong*: `makeMat()` allocates >80 individual materials across props/buildings/characters instead of sharing identical palette materials.
     - *How to improve*: Introduce a shared `MaterialPalette` cache keyed by `(color, roughness, metalness)`.

---

### Audit 6 & 7: Lighting, Atmosphere & Camera Composition
- **Actual State (`NeighborhoodCanvas.tsx:131-183, 904-932, 1132-1150`)**:
  - Uses `ACESFilmicToneMapping` (`exposure = 0.98`), `RoomEnvironment` PMREM, `HemisphereLight` (`#B5D7EB`, `#7D6A54`, `0.62`), shadow-casting sun `DirectionalLight` (`1024×1024`, `±28` frustum), and cool rim light (`0.45`).
  - Camera: `PerspectiveCamera(28, aspect, 0.5, 160)` at `playerPos + (19.5 * zoom, 18.2 * zoom, 19.5 * zoom)`.
- **Weaknesses**:
  1. **Initial Gameplay Camera Lag (`NeighborhoodCanvas.tsx:157, 1140-1149`)** *(Priority: P0 | Cost: Zero)*:
     - *What's wrong*: Camera initializes at `(18, 17, 18)` looking at `(0, 1.2, 0)`. When booting directly into gameplay (`?autostart=1`) or clicking Start, the damped follow takes 1–2s under software WebGL to pan to the player, so early frames (`baseline-play-desktop.png`) clip Willow Step Cottage off-screen.
     - *How to improve*: Snap camera immediately to `playerPos + offset` on mount if `screenState === 'playing'` and on `title -> playing` start handshake (or fast snap/short blend).
  2. **No Grounded Ambient Occlusion When `isSoftwareGl` Disables Shadow Maps** *(Priority: P1 | Cost: Very Low)*:
     - *What's wrong*: On software WebGL (`shadowMap.enabled = false`), buildings, trees, and lampposts have zero shadow skirts underneath, making them feel slightly pasted onto the ground (`baseline-play-mobile.png`).
     - *How to improve*: Add soft contact shadow planes (`depthWrite: false`) beneath buildings, trees, benches, lamps, and props—reusing the existing `shadowTex`!
  3. **Flat Lighting Contrast (`hemi 0.62` + `RoomEnvironment` + `exposure 0.98`)** *(Priority: P1 | Cost: Zero)*:
     - *What's wrong*: Strong ambient hemisphere fill + bright white `RoomEnvironment` flattens sunlit-vs-shadow modeling on roofs and walls.
     - *How to improve*: Tune hemisphere intensity (`0.48–0.52`), ground bounce color (`#6E5640`), and `scene.environmentIntensity = 0.65` (preserving brass reflections while deepening warm/cool sculptural shading!).

---

### Audit 8: Animation Quality
- **Actual State (`NeighborhoodCanvas.tsx:828-876, 1032-1095`)**:
  - Character walk uses sinusoidal leg/arm swing + vertical body hop; idle breathes via `Math.sin(elapsed * 2.1)` and turns toward nearby player (`< 3.2m`).
  - Bell uses spring swing; fountain particles arc; oak glint bobs.
- **Weaknesses** *(Priority: P2 | Cost: Low)*:
  - Bell swing uses hardcoded `dtClamped = 0.016` (`L866`) instead of frame `dt`, and `spawnChimeBurst()` retriggers repeatedly while velocity `> 3.6`.
  - No environmental micro-life (no swaying flower/foliage tufts, no drifting pond ripples/dragonfly or chimney hearth puffs, no character head turn/expressive idle poses).
  - **Console warning**: `THREE.Clock` (`L795`) triggers a deprecation warning on `three@0.187.0`; migrating to `THREE.Timer` resolves it cleanly.

---

### Audit 9: UI Visual Consistency
- **Actual State (`src/App.tsx`, `src/components/*`)**:
  - Typography (`Fraunces`, `Plus Jakarta Sans`, `JetBrains Mono`), palette (`#FAF5EC`, `#D4C4AE`, `#C86446`, `#5E8062`), bottom-docked `DialogueSheet`, `JournalDrawer`, and single-row `390×844` mobile header are cohesive, legible, and free of SaaS clutter or `backdrop-filter` stalls.
- **Weaknesses** *(Priority: P2 | Cost: Zero)*:
  - **Desktop Virtual Joystick (`App.tsx:434`)**: Renders the circular touch thumbstick on `1440×900` desktop (`baseline-play-desktop.png` bottom-left) even when no touch pointer is active (`hidden md:block` / pointer-coarse detection would keep desktop viewports cleaner while staying visible on touch devices or phones).
  - **Title Card Overlap (`baseline-title-desktop.png`)**: Upper-left title card covers Linden Book Nook / Bakery roofs slightly; compacting vertical padding or shifting orbit lookAt slightly right keeps the gazebo + plaza + cottages framed harmoniously alongside the card.

---

### Audit 10: Rendering Performance & Mobile Limitations
- **Actual Measurements Observed in Code**:
  - Textures: 4 procedural `CanvasTexture`s (`512×512` × 2, `256×256` × 1, `128×128` × 1 ≈ **~2.3 MB** uncompressed RGBA GPU memory—very light!).
  - Shadows: 1 `DirectionalLight` shadow map (`1024×1024`), disabled when `isSoftwareGl === true`.
  - Transparency: Pond plane (`1`), greenhouse glass (`2`), fountain water (`1`), contact shadow/ring discs (`~22`), dest ring (`1`) — low overdraw.
  - Per-frame hazards found: `updateEnvironmentVisuals()` (`L828-876`) and `windowMaterials` loop (`L928-930`) run unconditionally every frame even when state hasn't changed; `onHudSync` (`L1160-1165`) allocates a fresh `{ ...world.playerPos }` every `0.18s`; `models.ts` creates un-cached materials per object.
- **Mobile & Software-GL Guardrails**:
  - Keep total draw calls `<= 140`, texture memory `< 16 MB`, `InstancedMesh` for repeated vegetation/curbs/flowers, `isSoftwareGl` pixel ratio `1` + `afterDraw(tick)` intact, and zero CSS `backdrop-filter` over WebGL.

---

## 3. Reusable Assets & Systems Worth Preserving
1. **`src/game/*` pure TypeScript boundary** (`types.ts`, `worldMap.ts`, `residents.ts`, `narrative.ts`, `actions.ts`, `storage.ts`, `audio.ts`).
2. **Procedural `CanvasTexture` generator pattern** (`src/scene/textures.ts`).
3. **Sunbeam Greenhouse** (`models.ts:221-307`) & **Old Bell Gazebo** (`models.ts:317-414` lathe bell + octagonal dais, minus premature clapper visibility).
4. **Mirror Pond Footbridge** (`NeighborhoodCanvas.tsx:496-518`) — solid base structure ready for stone/moss details.
5. **Single-mount WebGL lifecycle, `RoomEnvironment` PMREM, `isSoftwareGl` `afterDraw()` pacing, and module-scope scratch vectors** (`NeighborhoodCanvas.tsx`).
6. **Storybook UI typography, color tokens, bottom-docked `DialogueSheet`, and `JournalDrawer`**.
