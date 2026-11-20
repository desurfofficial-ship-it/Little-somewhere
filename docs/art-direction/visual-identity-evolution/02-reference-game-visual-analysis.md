# 02 — Reference Game Visual Analysis

**Purpose**: Extract *techniques*, never content. Each reference gets: what it is, why it works, precisely what LITTLE SOMEWHERE should learn, and what must not be copied. This document operationalizes `docs/art-direction/REFERENCE_GUIDELINES.md` ("distill qualities, never clone IP") for the new reference set.

**Sources actually consulted**: Adobe Substance 3D Magazine interview with Kalle Väisänen (artist, Supercell Helsinki), "Creating Stylized Content for Clash of Clans and Clash Royale", Nov 22, 2019; the official Tiny Glade Steam page (store.steampowered.com/app/2198150); 80.lv interview "Story and Development of The Wild at Heart" with Chris Sumsky (co-founder, Moonlight Kids), Sep 29, 2021. All other statements are art-direction analysis grounded in the games as shipped artifacts and in the repo's own evidence.

---

## 1. Primary reference — Clash of Clans

### 1.1 Why it works (the mechanism, not the look)

Clash of Clans' visual excellence is an **information-design system** designed around one hard constraint: a fixed, elevated isometric camera at significant distance, with zero zoom-in to faces. Everything below serves that constraint:

1. **Silhouette primaries.** Every troop, building and prop is constructed so its *outer contour alone* identifies it at combat-camera distance. Distinctive hats, oversized fists, exaggerated noses, chunky boots and weapon outlines do the work that facial detail does in close-up games. At CoC's camera, characters are effectively **2D shape icons that happen to be 3D**.
2. **Form-first character construction.** Big heads (~1:2 to 1:3 head-to-body), compressed limbs, enlarged hands and boots. Importantly: proportions are *character-specific* — the Builder, Barbarian, Archer, Wizard and Goblin are not one body with different clothes; their skeletal proportions, masses and head shapes differ per character.
3. **Eye-guiding gradients.** Per the Supercell interview: "subtle changes in color and value with gradients guide the viewer's eye to key areas (usually the character's face)." Materials are deliberately *rougher than real life* ("break the PBR in many ways") to produce softer, more legible color gradients; albedo stays simple with a couple of color variations per material; the roughness map carries most of the material story. Wear and damage are placed *where wear would accumulate* ("leather will naturally get more damaged in the corners").
4. **Chunky, beveled geometry with layered reads.** Buildings stack a grounded base, a bold mid mass, and an articulated roof/tower line; edges are thick; every tier is separately readable. Decorative objects are sculptural one-glance icons (statues, barrels, lanterns) rather than generic furniture.
5. **Rich but separated color.** Saturated hue families with strong value separation between figure and ground; grass, paths and buildings each occupy a distinct value band so units pop. Contrast is earned by *value design*, not by darkening shadows.
6. **Visual progression legibility.** Building upgrade levels change silhouette (new tiers, added towers, banners) so town level is readable at a glance — a progression system expressed *formally*, not just numerically.
7. **Material contrast at distance.** Metal, wood, stone and cloth each catch light differently (specular behavior + roughness), letting mixed-material objects (a cannon: wood + iron + brass) decompose into readable parts even when small.

### 1.2 What LITTLE SOMEWHERE should learn (adopt)

| Technique | Where it lands for us | Evidence anchor in our repo |
| :--- | :--- | :--- |
| Silhouette-first character identity (body archetype + hat/hair + coat block, readable before facial detail) | Character bible: per-resident body-mass archetypes, larger face features sized to the 28° camera | Doc 01 §4.1.3–4 shows current identity is accessory-only |
| Character-specific proportions (not one shared body recolored) | Character bible §archetypes — torso radii, leg length, shoulder width per resident | `characters.ts` shared core body |
| Enlarged, sculpted hands/boots (grip shown, not implied) | Mitten-style hands, boots with toe/heel mass | `characters.ts:445` featureless r0.07 spheres |
| Eye-guiding value gradients (rougher-than-real materials, simple albedos, gradients toward focal zones) | Doc 06: procedural roughness maps + gradient rules toward faces, shop signs, station anchors | Zero maps exist today (`materials.ts`) |
| Chunky beveled secondary geometry | Bevel sweep over remaining extrusions; thicker trim on core cottages | Doc 01 §4.2.4 un-beveled list |
| Decorative-object sculptural quality (props as one-glance icons) | Object design standards: silhouette test for benches/lamps/carts/planters | Tea-cart docstring-geometry lag (Doc 01 §4.2.3) |
| Formal visual progression (state changes silhouette, not just count) | Doc 07: storyline world props, tier tokens, greenhouse stage rig — extend the existing four patterns | `orchard.ts:820-825` outcome swap |
| Value-band separation between ground/paths/buildings | Ground/cobble/wall value recalibration in winter (our only washed-out phase) | QA `plaza_winter_residents_a.png` |

### 1.3 What must NOT be copied (hard rejections)

1. **The medieval-fantasy theme**: no castles, barracks, cannons, walls-as-defense, gold/elixir economies, troop imagery, or combat silhouettes. Our world is a modern-cozy storybook neighborhood; every decorative object must belong to it (`REFERENCE_GUIDELINES.md` §1; Doc 00 §3).
2. **Upgrade timers / Town Hall progression / level-gated content**: the currency-free, zero-timer philosophy is non-negotiable (`GAME_DESIGN.md:29,262-264`). CoC's *legibility* of progression is adopted; its *mechanics* are not.
3. **The specific IP silhouettes** (Barbarian hair, Goblin ears, specific building profiles): identity comes from our ten named residents and our architecture.
4. **Heavy albedo texture-painting pipeline**: CoC relies on Substance-authored painted textures on dedicated character meshes. Our constraint — 100% procedural `CanvasTexture`, no external assets (`AGENTS.md:18`) — is kept; we achieve the *same legibility goals* with procedural maps and geometry (Doc 06 §2).
5. **Hordes-of-units readability tricks** (extreme color coding for faction identification): irrelevant to a 10-resident life-sim; would oversaturate our cast.

### 1.4 Adaptation principle

CoC techniques are adopted **through the existing storybook-clay filter**: chunky forms get softened bevels and handcrafted asymmetry (already the house style — `VISUAL_IDENTITY.md` §3 "Handcrafted Imperfection Rule"); value gradients get warm storybook tints rather than game-y saturation; character chunk gets *cozy* — round and soft, not martial and angular.

---

## 2. Secondary reference — Tiny Glade

### 2.1 What it is (from the official page)

A "small diorama builder" of "whimsical castles, cozy cottages & romantic ruins" where the building system "carefully assemble[s] every brick, pebble and plank, adapting to your whim"; ivy "envelops your buildings"; fireflies "light up the night"; sheep waddle through player-drawn paths; no management, combat, or wrong answers.

### 2.2 Why it works

1. **Evident craft.** Every surface demonstrates how it was made: courses of individually laid bricks, plaster subtly breaking over stone, ivy hugging wall contours, timber with grain and knots. The player reads *care* even without knowing why. This is the emotional core of "handcrafted" — the opposite of generic asset-library appearance.
2. **Warm light as an actor.** Late-afternoon key light, soft ambient, gentle bloom from sun through foliage; shadows stay soft and cool so warmth reads as temperature, not saturation.
3. **Vegetation as architecture.** Ivy, moss, grass tufts and creepers are placed *relationally* (growing out of wall seams, around doors), making buildings feel lived-in and time-worn — and the vegetation system is respectful of performance.
4. **Micro-life as delight.** Fireflies, sheep, birds — small autonomous agents that respond to the player's world and generate "delightful moments" without any management pressure.
5. **Diorama composition.** Every angle frames like a miniature: clear foreground interest, breathing-room midground, soft distant depth.

### 2.3 What LITTLE SOMEWHERE should learn (adopt)

1. **Evident-craft texture program** — procedural wood grain, fabric weave, plaster tooth, brick courses, paper grain (Doc 06 §2, Doc 05 §6). This is the single biggest warmth lever available to us: the infrastructure (`textures.ts`, 7 generators, ~3.2 MB) exists but currently never reaches interiors (Doc 01 §4.3.2).
2. **Relational vegetation dressing** — window-box tufts spilling over planter lips, ivy/moss hugging wall bases and stone seams (extend existing `botanicalDressing.ts` cluster-anchor approach to walls/buildings).
3. **Micro-life extends**: our koi/dragonflies/songbirds/fireflies system already matches this philosophy; add seasonal-variance depth rather than new categories (Doc 07 §5.4).
4. **Contact lighting truth**: soft cool shadow fill against warm keys is already our documented pairing (`VISUAL_IDENTITY.md` §5); enforce it per-season (Doc 06 §3.4).
5. **Diorama composition discipline** stays as-is — our framing is already excellent.

### 2.4 What must NOT be copied

1. **Castle/ruin/medieval content** — same hard rejection as CoC.
2. **Procedural-geometry generation as a *gameplay* mechanic** (draw-to-build systems): our buildings are fixed authored dioramas; no building system is proposed.
3. **Its heavy per-instance compute budget** (Tiny Glade runs desktop-first, GPU-heavy indirect techniques); our mobile + software-WebGL floor forbids it (Doc 06 §7).

---

## 3. Tertiary reference — The Wild at Heart

### 3.1 What it is (from the 80.lv interview)

An adventure whose art is "very illustrative, akin to a child's storybook," evoking nostalgia and "childlike wonder," inspired by *Where the Wild Things Are*, Studio Ghibli (*Spirited Away*, *My Neighbor Totoro*) and Cartoon Saloon; environments are a magical Pacific Northwest with biome-specific moods ("Wispwagon with moody purples", "Frostfields with snowy plains"); "exaggerated proportions and features to draw awe and wonder."

### 3.2 Why it works

1. **Biome-as-emotion.** Each region owns a palette-mood pairing; you *feel* where you are before reading anything. Environments stay "somewhat natural" — believable ecosystems — so fantasy accents land harder.
2. **Illustrated nostalgia.** Shapes, textures and lighting read like painted storybook plates: warm rim light, textured edges, compositional framing that implies a narrator.
3. **Wonder through exaggeration.** Key creatures/objects get deliberate proportion exaggeration to create awe — controlled against an otherwise natural world.
4. **Environmental storytelling.** Props and clutter imply histories (junky TVs fallen through from another world) — objects are narration.

### 3.3 What LITTLE SOMEWHERE should learn (adopt)

1. **Season-as-emotion gradients** — our four seasons should each own a mood *value*, not just a hue wash: Spring = dewy renewal, Summer = honeyed ease, Autumn = amber reminiscence, Winter = hushed blue comfort (Doc 03 §5, Doc 07 §5.3 uses `dayOfSeason` for within-season progression).
2. **Environmental storytelling as house style, formalized** — our props already narrate (chalk menu slate, tea-ring ledger); the bible (Doc 05 §7) makes "what story does this object whisper?" an explicit review question for new assets.
3. **Character warmth through gentle exaggeration** — eyebrow, hair-tuft and accessory exaggeration sized for readability (Doc 04), echoing "exaggerated proportions to draw awe" but scaled to cozy.
4. **The memory/keepsake tone** — journal and world props celebrating lived moments align with the storybook-nostalgia register (Doc 07 §5.5).

### 3.4 What must NOT be copied

1. **Wilderness-adventure framing** (sprites, combat-adjacent exploration magic, Ghibli spirits as characters). Our fantasy budget is *ambient* — moon-petals and wishing coins already stretch it; nothing darker or more mystical.
2. **Moody/desaturated palettes** ("moody purples") — our direction forbids dark desaturated grading (`VISUAL_IDENTITY.md` §2 "Strictly Prohibited").
3. **Realistic ecology density** — our draw budgets are mobile-first.

---

## 4. Additional references identified (brief, optional)

- **Animal Crossing: New Horizons** — the genre gold standard for *readable interior vignettes* and furniture-as-character. Adopt its lesson: furniture silhouettes must be identifiable from any angle at room-camera distance. [OPTIONAL SUGGESTION]
- **A Short Hike** — proof that low-poly + warm grading + soft shadows can feel premium in a browser-class budget; closest technical peer to our pipeline. Adopt its lesson: bold, few-value color fields beat many-value noise. [OPTIONAL SUGGESTION]
- **Unpacking** — narrative density through object placement alone; validates our interior "props narrate" direction. [OPTIONAL SUGGESTION]

## 5. Synthesis — the combined doctrine

| Reference | Core transferable principle | One-line rule for LITTLE SOMEWHERE |
| :--- | :--- | :--- |
| Clash of Clans | Readability is engineered: silhouette primaries, material contrast, eye-guiding gradients, formal visual progression | "Identify before detail: every character and object must read as itself at gameplay distance, first by silhouette, then by material, last by micro-detail." |
| Tiny Glade | Warmth is evidenced craft: surfaces show their making; vegetation is relational; light is temperature | "Every hero surface shows evidence of handcraft; plants grow *from* things, not beside them." |
| The Wild at Heart | Storybook nostalgia: seasons own moods; objects narrate; gentle exaggeration creates wonder | "Each season is a mood; every prop whispers a small story; exaggerate only what should be loved." |

**The fused direction** (formalized in Doc 03): **Storybook Diorama v2 — Readable Form, Evident Craft, Living Warmth** — the existing *Premium Handcrafted Storybook Diorama* identity elevated with CoC's information-design rigor, Tiny Glade's craft evidence, and Wild at Heart's seasonal emotion.

**On the brief's "traditional craft × unusual invention" admiration**: CoC expresses that pairing through medieval structures housing strange devices. LITTLE SOMEWHERE's world already owns its own sanctioned expression — Copperwheel's hand-made brass clockwork, the Conservatory's propped vents, the fountain's valve handwheel — and Doc 05 §2.4 fixes the doctrine (do/don't lines) for any future inventive-device prop.
