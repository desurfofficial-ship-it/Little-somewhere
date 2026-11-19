# VISUAL_QUALITY_STANDARDS.md — Reviewable Visual Quality Requirements & Checklist

This document translates **PREMIUM HANDCRAFTED STORYBOOK DIORAMA** (`docs/art-direction/VISUAL_IDENTITY.md`) into concrete, inspectable standards and an asset-review gate for all visual work in **LITTLE SOMEWHERE**.

---

## 1. Per-Domain Quality Standards

### A. Buildings & Architecture
1. **Silhouette & Massing**: Minimum **3 structural scales**—grounded foundation plinth (`y = 0`), main wall mass with corner framing/wainscot trim, and articulated roofline (overhangs `>= 0.35m`, fascia/bargeboard or ridge beam, chimney/dormer or spire detail).
2. **Structural Integrity**: All awnings, porch roofs, balconies, and signs MUST connect via visible posts, brackets, or wall mounts. Zero floating geometry.
3. **Openings**: Doors sit inside a frame + threshold step aligned to the walkable approach; windows have outer frame, recessed sill, glass pane, and at least one storybook detail (muntin crossbars, shutters, flower box, or warm interior glow).
4. **Hero Uniqueness**: Every named building (*Willow Step Cottage*, *Hearth & Crumb*, *Linden Book Nook*, *Copperwheel Cottage*, *Sunbeam Greenhouse*, *Pinecone Woodshop*, *Old Bell Gazebo*) must exhibit distinct silhouette cues (roof pitch, porch/awning shape, shop props, or chimney style), never identical recolored clones.
5. **Grounding**: Solid contact shadow/AO skirt at `y = 0.015–0.025` beneath the plinth so buildings read anchored even when dynamic shadows are off.

### B. Characters
1. **Proportions & Craft**: Stylized 3-head/storybook proportions (`heightScale` matched to character age/build), tapered torso/coat silhouette, articulated sleeve cuffs and hands, collar/scarf wrap, and grounded boots with contact shadow disc.
2. **Face & Head Readability**: Clearly sculpted hair volume + bangs/parting, nose hint, warm cheek tint, and two-tone eyes (dark iris + tiny highlight) or glasses/hat silhouette readable in isometric zoom `0.85–1.15`.
3. **Silhouette Identity**: Every resident retains unique hat/hair, palette, and signature prop (e.g. satchel + stamped envelope, watering can, violin case, sketchbook, sourdough loaf).
4. **Pose & Rig Contract**: Must expose `CharacterRig` joints (`root`, `bodyGroup`, `leftLeg`, `rightLeg`, `leftArm`, `rightArm`, `headGroup`, `ringMesh`, `questPip`) cleanly pivoted at hip/shoulder/neck joints rather than mid-limb centers.

### C. Vegetation (Trees, Shrubs, Flowers & Grass)
1. **Multi-Cluster Canopy**: Trees MUST combine a tapered trunk (optional root flare + 1–2 branch forks) with **3–6 overlapping sculpted foliage lobes** (`IcosahedronGeometry`/`DodecahedronGeometry` squashed asymmetrically), never a single bare lollipop polyhedron on a straight pole.
2. **Botanical Variety**: Mix warm sage, olive moss, and sunlit leaf greens (`setColorAt` tint variation `±8–12%`); flower clusters must show visible greenery base + raised blossom heads (`>= 2` distinct colors per bed).
3. **Perimeter Polish**: Natural perimeter boundaries use layered tree clusters, hedges, and weathered split-rail or low fieldstone walls—never floating uniform gray blocks.

### D. Pathways & Street Furniture
1. **Clean Edges**: Cobblestone lanes and plazas must meet grass cleanly with **curb stones, moss/clover edge tufts, or stepped flagstones**—zero accidental green sliver gaps or overlapping Z-fighting planes (`>= 0.02m` vertical separation).
2. **Artisan Props**: Benches, mailboxes, noticeboards, tea carts, lamps, and signs must be composite `4–10` part assemblies with readable function (slatted seat + legs + armrest, lamp post base + bracket + glass lantern housing, supported canopy posts).

### E. Materials & Textures
1. **Material Contrast**: Adjacent parts MUST vary roughness by `>= 0.25` (e.g., matte plaster `0.86` vs glazed ceramic `0.42` vs brushed brass `0.25`).
2. **ACES Calibration**: Ground meadow and stone textures must retain visible mid-tone texture contrast (`#5D8548` meadow, `#8E7D67`–`#B9A88F` cobble) under `ACESFilmicToneMapping` without bleaching to flat pastel cream.
3. **Shared Resource Discipline**: Palette materials should be cached/shared (`materialRegistry`) rather than instantiating redundant `MeshStandardMaterial` clones per small part.
4. **Zero External Assets**: All textures procedural (`CanvasTexture` with `SRGBColorSpace` on albedo maps and `maxAnisotropy` set).

### F. Lighting & Atmosphere
1. **Balanced Warm/Cool Contrast**: Directional key light (`castShadow` on GPU) paired with cool sky/warm ground `HemisphereLight` + `RoomEnvironment` IBL + horizon-matched `Fog`.
2. **Dusk & Golden Hour Warmth**: Windows (`emissiveIntensity`), porch lanterns, and plaza festoons visibly brighten across `golden` -> `dusk` to create cozy focal pools without washing out terrain.
3. **No Expensive Post-Processing Overheads**: Achieve richness via calibrated albedo, lighting curves, and emissive contrast—no heavy screen-space bloom/SSAO passes on mobile.

### G. Animation & Environmental Life
1. **Distance-Synced Stride**: Walking legs/arms and vertical bounce sync to actual ground displacement (`stepDist`); resting actors return smoothly to neutral stance with gentle breathing/head micro-motion.
2. **Pivoted Joints**: Limbs rotate around shoulder/hip/bell pivots, not geometric centers.
3. **Living Props**: Fountain droplets arc smoothly, mailbox flags respond to unread state, bell physics uses real clamped frame `dt`, and optional gentle breeze sway/smoke wisps stay pooled and zero-GC.

### H. UI & HUD Presentation
1. **Storybook Materiality**: Warm cream-linen surfaces (`#FAF5EC`), warm stone borders (`#D4C4AE`), espresso ink (`#2D241E`), Fraunces + Plus Jakarta Sans + JetBrains Mono (`tabular-nums`).
2. **Viewport Dominance**: `>= 85%` unobstructed 3D scene during play; top HUD single-row without wrapping on `390px` mobile; no `backdrop-filter` over WebGL.
3. **Touch & Accessibility**: All interactive controls `>= 44×44px` hitboxes with semantic `<button>`/`<dialog>` markup.

---

## 2. Mandatory Asset-Review Checklist

Before any visual asset, scene section, or UI adjustment is marked complete, the implementer must verify every box:

- [ ] **3-Scale Silhouette**: Asset has distinct primary mass, secondary framing, and micro storybook detail (no unfinished raw primitive placeholders).
- [ ] **Structural Connection**: Every awning, sign, roof, lamp, and prop sits flush or visibly supported; nothing floats in air.
- [ ] **Collision & Interaction Parity**: Visual footprint matches `BOX_OBSTACLES` / `CIRCLE_OBSTACLES` and `PROP_INTERACTABLES` (`npm test` passes).
- [ ] **Material & Roughness Contrast**: Matte vs satin/glazed vs metallic contrast reads clearly under `ACESFilmicToneMapping` without chalky blow-out.
- [ ] **Grounding**: Asset rests at `y = 0` with contact shadow / AO skirt effective even when `shadowMap.enabled === false` (`isSoftwareGl`).
- [ ] **Shared Resources & Draw-Call Budget**: Reuses cached materials / `InstancedMesh` where appropriate; zero per-frame `new Vector3/Color/Material` allocations in `tick()`.
- [ ] **4-Phase Lighting Check**: Looks harmonious in `morning`, `afternoon`, `golden`, and `dusk`.
- [ ] **Live Browser Inspection**: Captured and visually inspected in headless Chromium at `1440×900` desktop and `390×844` mobile with 0 console errors.
