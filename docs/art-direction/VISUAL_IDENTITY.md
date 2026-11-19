# VISUAL_IDENTITY.md — Official Art Direction Source of Truth

**Project**: LITTLE SOMEWHERE  
**Official Visual Direction**: **PREMIUM HANDCRAFTED STORYBOOK DIORAMA**  
**Heritage**: Preserves the warm artistic personality of *Sunlit Diorama & Clay Storybook* while elevating craft, silhouette, material fidelity, composition, and life toward a premium modern cozy 3D game.

---

## 1. Core Visual Philosophy

**LITTLE SOMEWHERE** must look like a **lovingly handcrafted miniature world brought to life**—as if an artisan sculpted polymer-clay cottages, carved cedar trim, glazed ceramic planters, and painted matte flagstones onto a sunlit tabletop diorama, then breathed gentle storybook life into its nine residents.

Every visual decision must satisfy seven core qualities:
1. **Warm and welcoming** — sunlit cream plaster, honeyed oak, terracotta clay, and sage foliage invite lingering rather than rushing.
2. **Handcrafted, never procedurally generic** — tapered beams, beveled eaves, asymmetrical flower clusters, and varied foliage cushions replace sterile boxes and raw polyhedra.
3. **Colorful without oversaturation** — rich, grounded storybook hues calibrated for `ACESFilmicToneMapping` so colors never chalk out under sunlight or burn neon.
4. **Detailed without visual clutter** — medium-scale focal clusters (porches, planters, street corners, bridges) framed by calm walkable cobblestone and meadow breathing room.
5. **Whimsical without childishness** — tactile craft and gentle nostalgia (*"a little world filled with thousands of little stories"*) rather than garish toy-plastic colors.
6. **Composed even while standing still** — any isometric frame should read like an illustrated picture-book plate with clear foreground, midground, and soft horizon depth.
7. **Rewarding close observation** — small environmental details (peeking mail envelopes, rolled bread loaves, folded wool throws, moss caps, hanging lanterns) tell micro-stories on sight.

---

## 2. Artistic Principles & Style Boundaries

### Preservation vs. Elevation
- **Preserve**: Isometric miniature perspective (`28°` FOV), matte-clay + glazed-ceramic/brass material warmth, cream-linen & espresso-ink UI, 4 daily atmospheric phases (`morning`, `afternoon`, `golden`, `dusk`), and distinct identities for all 9 residents.
- **Elevate**: Silhouette complexity, intentional proportions, multi-part carpentry/masonry, material separation, grounded contact shadows, character expressiveness, and living environmental motion.
- **Strictly Prohibited**:
  - Photorealistic PBR grit, dark horror contrast, or noisy photographic bump maps.
  - Generic flat-shaded untextured low-poly "asset-pack" look.
  - Cyberpunk/neon bloom, uncalibrated pure `#FFFFFF`/`#000000` extremes, or glossy uniform plastic shaders.

---

## 3. Shape Language & Modeling Standards

All 3D forms follow a **3-Scale Silhouette Rule** tailored for the isometric camera:

1. **Primary Mass (Macro Read)**: Softened, grounded silhouettes (`ExtrudeGeometry` with bevels, tapered `CylinderGeometry` / `LatheGeometry`, compound roofs with overhangs and dormers). Never leave an un-beveled single box or sharp raw sphere as a finished structure.
2. **Secondary Carpentry & Framing (Mid Read)**: Corner timber posts with chamfered brackets, stone plinths with stepped sills, roof ridge beams, recessed window frames with shutters/muntins, awnings on visible timber/iron supports, and layered foliage clusters.
3. **Artisan Accents (Micro Story Read)**: Ceramic pots, stacked firewood, hanging brass lanterns with glass panes, carved signposts, flagstones, rolled aprons, satchels, and mail envelopes.

**Handcrafted Imperfection Rule**:
- Organic props (trees, bushes, flagstones, flower stems, stepping stones) use slight deterministic rotation/scale asymmetry (`±8–15%`) and staggered clustering so nothing looks grid-stamped.
- Architectural trim uses clean structural joinery (posts meet awnings, beams rest on corbels, doors sit inside recessed jambs on solid porch steps—**never** floating canopies or disconnected geometry).

---

## 4. Material & Surface Standards

Materials must visually tell you what an object is made of at a glance, using **shared palette materials** and **efficient procedural `CanvasTexture` surfaces** rather than heavy external image textures:

| Surface Class | Target Roughness | Target Metalness | Tactile Treatment |
| :--- | :---: | :---: | :--- |
| **Lime / Clay Plaster Walls** | `0.84 – 0.90` | `0.00 – 0.02` | Warm off-white / cream / parchment (`#EFE3CE`–`#E6D5BD`), subtle warm tint so sun highlights never blow white |
| **Painted / Carved Timber** | `0.70 – 0.78` | `0.02 – 0.05` | Deep cedar, walnut, and painted sage/terracotta trim; distinct contrast against plaster walls |
| **Fieldstone & Cobblestone** | `0.85 – 0.92` | `0.02` | Procedural stone tiles with warm mortar grooves and subtle moss/stone tone variation |
| **Roof Shingles & Terracotta** | `0.72 – 0.80` | `0.03 – 0.05` | Patterned shingle `CanvasTexture` + overhanging fascia boards + ridge caps |
| **Glazed Ceramic & Pottery** | `0.38 – 0.48` | `0.05` | Noticeably smoother specular catchlight than matte clay walls (`>= 0.25` roughness delta) |
| **Polished / Aged Brass** | `0.22 – 0.30` | `0.82 – 0.88` | Lantern cages, doorknobs, bell hardware, buckles; always paired with `RoomEnvironment` IBL |
| **Foliage & Meadow Grass** | `0.82 – 0.92` | `0.00` | Rich mid-value botanical greens (`#557D46`–`#7B9F5C`) that hold saturation under `ACESFilmic` |
| **Glass & Clear Water** | `0.10 – 0.18` | `0.08 – 0.15` | Translucent cyan-teal water (`depthWrite: false` outer glass), warm hearth glow in dusk windows |

---

## 5. Color & Lighting Atmosphere

### Tone Mapping & Calibrated Albedo Rule
Because the renderer uses `ACESFilmicToneMapping`, raw light pastel hex colors (`>#ECECEC`) wash out toward flat white under `sunLight` (`1.4–1.55`) + `HemisphereLight` + `RoomEnvironment`. Keep ground, stone, and wall albedos in **rich mid-warm storybook registers** so sunlit faces glow softly while shaded sides keep color and depth.

### Four Sacred Time Phases (Preserved & Elevated)
1. **Morning (`6:00 AM – 11:30 AM`)**: Crisp sky `#DCEBF2`, warm honey sunlight `#FFECC4`, cool sky shadow fill `#8EB8D8`, faint fresh dew warmth.
2. **Afternoon (`11:30 AM – 4:00 PM`)**: Clear bright sky `#D6EAF4`, sunlit cream key `#FFF3D6`, rich leaf/cobble contrast without glare.
3. **Golden Hour (`4:00 PM – 6:30 PM`)**: Apricot sky `#F2C692`, amber directional key `#FFA958`, long cozy shadows, cottage windows begin glowing warmly.
4. **Lantern Dusk (`6:30 PM – 9:00 PM`)**: Twilight periwinkle-indigo `#64749E`, cool moonlit fill `#6B82B8` contrasting sharply with glowing amber cottage hearths, porch lanterns, and plaza festoons (`#FFAA3B`).

### Grounding & Depth
- Every structure, tree, prop, and actor sits flush at `y = 0` with **real contact grounding**: a soft radial contact shadow disc or subtle foundation AO skirt underneath so objects stay grounded even when dynamic shadow maps are disabled on software WebGL.

---

## 6. Character Design Standards

Residents must feel like **expressive miniature storybook figurines**, never recolored pegs:
- **Distinct Silhouettes & Proportions**: Meaningful variation in height (`0.78` Pip to `1.08` Barnaby), coat drape/flared hems, sleeves/cuffs, hats/hair buns, and signature carried props (satchel with sticking-out letter, watering can, violin case, sketchbook, sourdough loaf).
- **Readable Storybook Faces**: Warm clay skin tone, subtle blush cheeks, sculpted nose hint, expressive eyes (with subtle white catchlight), and layered hair tufts/bangs visible from the elevated isometric angle.
- **Expressive Postures**: Arms slightly angled away from torso with articulated cuffs/mittens or hands; clear front-to-back read (coat lapels, buttons, collar scarf, apron ties, back pack/case).
- **Personality-Driven Animation**: Walk stride synced to traveled distance, gentle breathing/weight shift at rest, turning smoothly toward the player when approached, and future activity poses (tending plants, reading, brewing, playing violin).

---

## 7. Environment, Animation & Camera Standards

- **Neighborhood Composition**: Every district needs a clear focal anchor (porch, fountain, gazebo, greenhouse, footbridge), readable cobblestone/stepping-stone circulation (`>= 2m` clear lanes), and layered edge dressing (curbs, shrubs, flowers, benches, fences) that never blocks navigation.
- **Subtle Living Motion**: Fountain droplet arcs, glinting oak clues, gentle idle breathing, swaying blooms/lanterns, and pooled chime bursts—budgeted so per-frame CPU work stays negligible.
- **Isometric Camera (`28°` FOV)**: Preserve the established elevated diorama framing (`(+19.5 * zoom, +18.2 * zoom, +19.5 * zoom)`), initializing cleanly on the player on gameplay entry without disorienting half-second pans, and orbiting the town square calmly on the Title screen.

---

## 8. UI Visual Standards

- **Typography**: `Fraunces` (display & landmark/resident headers), `Plus Jakarta Sans` (dialogue & UI actions), `JetBrains Mono` (`tabular-nums` clocks & counters).
- **Palette**: Warm linen `#FAF5EC`, deep linen `#F1E8D9`, stone borders `#D4C4AE`, espresso ink `#2D241E`, terracotta primary `#C86446`, sage secondary `#5E8062`, honey accent `#E5A93C`.
- **Restraint**: Unboxed inline metadata (`Day 1 · 8:15 AM · Morning`), no `backdrop-filter` over WebGL, minimum `44×44px` mobile touch hitboxes, `>= 85%` unobstructed central 3D viewport during play, and no modern SaaS dashboard chrome or pulsing decorative dots.

---

## 9. Examples: Acceptable vs. Unacceptable Craft

| Domain | Unacceptable (Placeholder) | Acceptable (Premium Storybook Diorama) |
| :--- | :--- | :--- |
| **Building** | Plain box + triangle prism + flat square window + floating awning | Stone plinth + chamfered timber posts + recessed shuttered windows with sills & herb pots + beveled shingle gable + supported awning + hanging lantern |
| **Pathway** | Raw flat rectangle slab with exposed sharp corners & gaps | Cobblestone bed edged with stepped curb stones, recessed stepping stones, and corner clover/grass clusters |
| **Tree / Foliage** | Brown cylinder + single dodecahedron sphere | Tapered trunk with root flare + branching limbs + 4–6 layered organic foliage cushions + ground shadow |
| **Prop (Mailbox / Cart)** | 2–3 unjoined boxes; canopy floating with no posts | Supported cedar frame, beveled brass/tin roof, readable micro-detail (letter slot, envelope, kettle spout, ceramic cup) |
| **Character** | Cylinder body + stiff hanging arms + 2 plain black dots | Tapered coat flare, collar fold, sleeves/hands, hair bangs, subtle nose & rosy cheeks, catchlight eyes, bespoke satchel/tool |

---

## 10. Mobile-First Performance Mandates

- Maintain full visual parity of scene content across GPU and `isSoftwareGl` devices; scale **only** DPR (`1` on software GL, `<= 2` on GPU), AA, shadow map, and non-essential particle density.
- Share materials via palette caches; batch repeated flora/curbs/props with `InstancedMesh` wherever instance count `> 15–20`.
- Keep draw calls bounded (`<= 120–150` across the diorama) and zero per-frame allocations inside `tick()`.
