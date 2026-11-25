# Sand3D Evaluation for Stage 3 Assets (Deliverable C)

Desk research only (no dataset download, no toolchain install, no generation runs).
Sources: github.com/Sandflow-ai/sand3d (README, LICENSE, docs/api.md, guides),
huggingface.co/datasets/Sandflow/sand3d-nature (dataset card + rows API sample),
huggingface.co/spaces/Sandflow/sand3d-explorer (Space metadata), fetched during this audit.
Local art-direction grounding: docs/art-direction/VISUAL_IDENTITY.md, VISUAL_QUALITY_STANDARDS.md,
visual-identity-evolution/06-rendering-technical-art-specification.md, 05-environment-asset-design-bible.md,
plus src/scene/textures.ts / models.ts pipeline facts.

## What Sand3D actually is

NOT a diffusion text-to-3D generator. It is a Python library for writing 3D objects as short
deterministic programs over Blender's `bpy` module ("3D modeling in Python, built for LLMs",
~72 flat `s3d.*` verbs incl. scatter/tufts/branches/phyllotaxis). Output meshes are
bit-for-bit reproducible and export via one call to GLB / URDF / USDA / OBJ. The HF datasets
are program-synthesis training data (prompt -> program) rendered via an agentic reconstruction
pipeline with a `semantic_score` per asset.

## Verdict per use area

| Use area | Verdict | Key evidence |
|----------|---------|--------------|
| Inspiration / reference browsing (Explorer, renders, silhouette studies) | **RECOMMEND** | Zero cost, zero license exposure; strong organic-form vocabulary (tufts, branching, phyllotaxis) our box/lathe builders lack. Fits REFERENCE_GUIDELINES (distill qualities, never clone). |
| Authoring-time blockout / organic-form R&D with our own programs | **CONDITIONAL** | Apache-2.0 tool, CPU-only headless (bpy 5.2 on Python 3.13 / 4.5 on 3.11; no GPU), deterministic diffable ~1-2 KB programs; but adds a non-TS toolchain and needs triangle discipline (coarse-first authoring: `facets(n)`, reduced tuft counts). Worth it only for the organic categories hardest to hand-author (moss, grass tufts, branching shrubs, fungi, rocks). |
| Direct dataset-asset production use (ship sand3d-nature meshes) | **REJECT-leaning** | Sampled rows: 1.2k-275k triangles (a "low-poly" vine = 216k); whole current diorama is ~2,196 geometries / measured 1,653-2,305 draw calls on software-WebGL budget. Dataset assets need 10-100x decimation AND a story-integration authoring pass; style risk violates VISUAL_IDENTITY section 2 ("generic flat-shaded untextured asset-pack look" prohibited). Salvageable only as hand-picked <=5k-tri stylized rows. |
| Runtime GLB loading in the game | **REJECT (for now)** | No import path exists; conflicts with the merged-geometry/instancing/draw-call law; AGENTS.md forbids unapproved runtime deps. Anything graduating becomes builder code or approved static merged geometry. |

## Pipeline sketch (authoring-time only)

`s3d program (our palette, coarse facets) -> pip env runs bpy headless -> s3d.export('plant.glb')
-> decimate <= target tris, verify silhouette -> dev-only GLTFLoader sandbox -> material remap to
our palette/roughness tiers (drop KHR_materials_volume) -> merge/instance per discipline ->
transcribe as builder code. Nothing ships at runtime without approval.`

## Licensing & attribution (verified)

- Dataset sand3d-nature: per-row `license: CC-BY-4.0`, `source_license: None`, `attribution: None`;
  card states programs/renders/OpenUSD are CC BY 4.0 with "Credit Sandflow when reusing these
  files"; assets start from text prompts (no third-party object entanglement). CC BY 4.0 permits
  commercial shipping with credit (e.g., a THIRD_PARTY_ASSETS.md notice + credits line).
  Derived assets (adapted programs/decimated meshes) remain CC BY derivatives.
- Library sand3d: Apache-2.0 -- programs authored from scratch carry no Sandflow copyright.
- Sibling datasets (objaverse/simready/automate) DO derive from third-party sets -- avoid those.
- Repo policy gap: no third-party asset policy exists yet; docs/THIRD_PARTY_ASSETS.md is a
  required prerequisite before any adoption decision.

## Mobile optimization plan (if anything graduates)

1. Shortlist via the dataset `triangles` column (HF rows/SQL API, no download): <=2k tris/prop,
   <=8k hero plant. 2. Decimate + weld; strip to base-color materials. 3. Merge into
   same-material batches; instance repeats >15. 4. Validate on the software-GL parity ladder +
   4-phase lighting + headless captures (1440x900, 390x844) + `npm test` draw-budget guards.

## Material compatibility with our identity

Structurally strong: Sand3D output is flat base-color + roughness with NO texture maps --
matching our color-only MeshStandardMaterial law (textures.ts; VISUAL_QUALITY_STANDARDS E4
"Zero External Assets" for textures). Palette remap to our 33-hex tones + roughness tiers
(foliage 0.82-0.92) is trivial. The risk is authorial, not technical: untextured organic meshes
are the asset-pack look until they receive silhouette-level craft and story placement (doc 05
section 7 "story-whisper" rule).

## Proof of concept (planned, NOT executed -- optional research, not a blocker)

One garden plant (5-petal daisy tuft in a glazed pot) through the full authoring -> restyle
path, judged side-by-side with the existing meadow tuft builder at gameplay camera distance in
all 4 phases. Acceptance: program <=~120 lines, deterministic rebuild; <=3k tris and <=3 draw
calls after merge; art-director verdict "not asset-pack" in all phases; measured perf delta
recorded. Estimated 1 day (0.5 env+program, 0.5 import/restyle/capture). Decision gate for the
product owner; ~80% of the effort is throwaway if the verdict is REJECT.

UNVERIFIED items (flagged honestly): exact GLB file sizes for dataset rows (Explorer assets
live in a separate repo not fetched); whether Sand3D GLB export optionally compresses
(draco/meshopt); pond-specific families (reeds/lily pads) in the dataset taxonomy.
