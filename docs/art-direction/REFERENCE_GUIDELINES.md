# REFERENCE_GUIDELINES.md — Visual Reference & Inspiration Discipline

This guide governs how engineers, artists, and coding agents use external visual references when designing or refining assets for **LITTLE SOMEWHERE**.

---

## 1. Core Principle: Distill Qualities, Never Clone IP

Visual references (cozy diorama games, stop-motion clay miniatures, illustrated picture books, architectural woodwork) exist to calibrate **craft qualities**, never to copy another game's exact character silhouettes, color schemes, UI layout, or world layout.

**Target Formula**:  
> **LITTLE SOMEWHERE** = *(Sunlit Diorama & Clay Storybook personality)* + *(Premium Cozy-Game Craft & Atmospheric Polish)*

---

## 2. What to Extract From References vs. What to Reject

| Reference Aspect | What to Extract (YES) | What to Reject (NO) |
| :--- | :--- | :--- |
| **Architecture & Props** | Roof overhang proportions, shingle layering, recessed window frames, stone plinth grounding, how chimneys and eaves break boxy silhouettes | Copying another franchise's specific landmark architecture, signage text, or photorealistic brick photos |
| **Materials & Shading** | How matte plaster contrasts against glazed terracotta and warm brushed brass; how sunlit highlights stay warm while shadows hold cool slate/lavender tones | High-frequency noise maps, gritty dirt grunge, metallic chrome sci-fi sheen, or flat untextured mobile-ad plastic |
| **Vegetation & Pathways** | Layered overlapping tree canopy puffs, stepped stone paths with moss/clover softening, clustering blooms in threes/fives near corners | Dense realistic foliage billboards that tank mobile FPS, or chaotic clutter blocking player lanes |
| **Characters** | Cozy head-to-body ratio, readable collar/coat/hat silhouettes from isometric distance, warm cheeks & expressive head tilts | Copying existing game mascots, realistic uncanny human proportions, or hyper-detailed facial rigs invisible at 20m |
| **Lighting & Color** | Warm key vs. cool hemisphere fill balance, golden-hour rim warmth, dusk window/lantern pools guiding the eye | Neon bloom filters, dark desaturated "moody indie" palettes, or high-contrast harsh black shadows |
| **UI & Typography** | Restraint, paper/linen materiality, clear reading measure, quiet corner HUD leaving the 3D diorama dominant | Generic SaaS pill badges, sci-fi glassmorphic blur panels, or cluttered mobile gacha HUD frames |

---

## 3. Mandatory Reference Adaptation Workflow

Before implementing a new building, biome prop, character variant, or shader improvement:

1. **Read the Core Truth**: Consult `docs/art-direction/VISUAL_IDENTITY.md` and `docs/art-direction/VISUAL_QUALITY_STANDARDS.md`.
2. **Translate Into Project Tokens**: Map inspiration strictly into LITTLE SOMEWHERE's calibrated palette (cream plaster, terracotta, sage, honey amber, espresso timber, aged brass) and shared `MaterialPalette` roughness tiers.
3. **Fit the Isometric Camera**: Evaluate every detail at actual gameplay camera distance (`~26–32m` at `28°` FOV), not just extreme close-up zoom. Micro-details smaller than `0.06m` rarely read cleanly; emphasize `0.12m–0.40m` trim, silhouette notches, and color contrast instead.
4. **Respect Mobile & Software-WebGL Budgets**: Any lighting, water, or foliage technique borrowed from high-end desktop references MUST have a clean zero-post-processing, instanced implementation that looks cohesive under `isSoftwareGl`.
5. **Preserve Narrative Coherence**: Every new visual element should support *"a little world filled with thousands of little stories"*—ask what neighbor placed it there and what small story it whispers.
