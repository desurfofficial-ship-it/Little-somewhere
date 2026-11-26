# Hearth & Crumb Bakery — PolyHaven Lighting & Material References

**Date**: 2026-11-26  
**Purpose**: Reference study only (polyhaven skill). Inform future visual polish of the bakery under golden-hour and warm interior lighting while preserving PREMIUM HANDCRAFTED STORYBOOK DIORAMA identity.  
**Constraint**: Zero external runtime assets. Prefer procedural geometry + CanvasTexture reconstruction. Do not fetch these assets at runtime.

## Useful CC0 references

### Lighting (HDRI)

| Asset | ID / URL | Why useful |
|-------|----------|------------|
| Warm Restaurant | [warm_restaurant](https://polyhaven.com/a/warm_restaurant) | Soft warm indoor restaurant lighting, wood ceiling, terracotta floor. Strong amber/honey mood reference for bakery interior under golden or lantern conditions. |
| Warm Restaurant Night | [warm_restaurant_night](https://polyhaven.com/a/warm_restaurant_night) | Same space under warmer artificial light. Useful for dusk / lantern comparison and soft volumetric feel. |

### Materials (texture study)

| Asset | ID / URL | Why useful |
|-------|----------|------------|
| Kitchen Wood | [kitchen_wood](https://polyhaven.com/a/kitchen_wood) | Clean warm wood grain. Study albedo + roughness structure, then rebuild procedurally for counters, tables, chairs, and shelves. |

## Application guidance (Dream Loop + project rules)

- Capture current in-engine bakery baseline (desktop 1440×900 + mobile 390×844) before any change.
- Target improvement: warmer volumetric shafts through windows, clearer material contrast (matte plaster vs glazed ceramic vs brushed brass), soft radial contact shadows, grounded café tables — still 100% storybook clay/diorama.
- Never drift toward photorealism or generic low-poly packs.
- Any geometry/material change must still satisfy the Asset-Review Checklist in `docs/art-direction/VISUAL_QUALITY_STANDARDS.md`.
- Record further decisions in WORKLOG.md when implementation occurs.

## License note

All listed Poly Haven assets are CC0. Record asset IDs and source URLs if any reference materially influences a design decision.
