---
name: polyhaven
description: Search and download CC0 assets (HDRIs, textures, 3D models) from Poly Haven for reference or optional development use. Prefer the project's procedural geometry + CanvasTexture + Web Audio approach for anything that ships at runtime.
license: CC0 (assets) / project guidance MIT-style
---

# polyhaven (LITTLE SOMEWHERE context)

**Project rule**: LITTLE SOMEWHERE prioritizes zero external runtime asset failures (100% procedural Three.js geometry, CanvasTexture surfaces, Web Audio synthesis). Use Poly Haven primarily for **reference**, lighting studies, material inspiration, or carefully vetted optional assets that are vendored and verified. Never introduce runtime network fetches of Poly Haven assets.

## When to use

- Looking for HDRI lighting references that match warm storybook / golden-hour / lantern-dusk moods.
- Studying PBR texture structure (albedo, roughness, normal) to recreate similar look procedurally.
- Finding simple prop silhouettes as modelling reference (then rebuild as multi-part Groups with contact shadows).

## How to search / download

Poly Haven provides a public API and website: https://polyhaven.com/

Typical categories:
- HDRIs (environment lighting)
- Textures (PBR maps)
- Models (glTF / blend, etc.)

Prefer downloading into a local `references/` or `.dream-loop/` folder (gitignored if large) rather than `src/` or `public/` unless the asset is intentionally vendored and size-checked.

Always record the asset ID, license (CC0), and source URL when an asset influences a design decision.

## Constraints for this repo

1. Do not change the visual identity toward photorealism just because a Poly Haven asset is photoreal.
2. Any imported model must still satisfy the Asset-Review Checklist in `docs/art-direction/VISUAL_QUALITY_STANDARDS.md` (3-scale silhouette, structural connections, contact shadows, material contrast).
3. Prefer rebuilding simple props procedurally so the game stays self-contained and software-WebGL friendly.
4. If you vendor an asset, keep it small, document it in WORKLOG.md, and ensure the production build still has zero console errors and acceptable mobile performance.

## Useful starting points

- Studio / soft HDRIs for product-like lighting studies of cottages and props.
- Outdoor golden-hour or dusk HDRIs that approximate the project’s `golden` and `dusk` phases.
- Stone, wood, plaster, fabric textures as material-reference only.

Upstream site: https://polyhaven.com/
