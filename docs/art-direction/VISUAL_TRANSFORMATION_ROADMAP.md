# VISUAL_TRANSFORMATION_ROADMAP.md — Staged Visual Elevation Plan

This roadmap defines a disciplined, incremental rollout to elevate **LITTLE SOMEWHERE** from its functional Milestone 1 low-poly baseline to the **PREMIUM HANDCRAFTED STORYBOOK DIORAMA** standard (`docs/art-direction/VISUAL_IDENTITY.md`) without sacrificing mobile performance, software-WebGL parity, or gameplay stability.

---

## Stage 0 — Visual Foundation & Willow Lane Quality Prototype *(Current Assignment)*

- **Objectives**:
  - Formalize official visual identity, quality standards, audit, roadmap, and reference guidelines in `docs/art-direction/`.
  - Lock mandatory visual governance into `AGENTS.md`, `GAME_DESIGN.md`, `ARCHITECTURE.md`, and `HANDOVER.md`.
  - Fix immediate structural/console/camera defects discovered in the audit (initial gameplay camera snap, `THREE.Timer` replacing deprecated `THREE.Clock`, gazebo clapper visibility gated on `bellRestored`).
  - Deliver an in-game **Willow Step Cottage & Willow Lane Prototype** showcasing target architectural, pathway, foliage, prop, lighting, and character (`Jun`) quality.
- **Systems & Modules Affected**:
  - New: `src/scene/materials.ts` (shared palette material cache), `src/scene/prototypes/willowLaneDiorama.ts` (handcrafted cottage, courtyard, mailbox, bench, fence, trees, wildflowers, upgraded Jun rig).
  - Modified: `src/scene/NeighborhoodCanvas.tsx`, `src/scene/models.ts`, `src/scene/textures.ts`, `AGENTS.md`, `GAME_DESIGN.md`, `ARCHITECTURE.md`, `HANDOVER.md`, `WORKLOG.md`.
- **Dependencies**: None.
- **Performance Considerations**: Shared palette materials reduce redundant shader bindings; prototype foliage/props stay tightly budgeted (`< +30` draw calls) and use grounded `shadowTex` contact planes so `isSoftwareGl` matches GPU visual depth.
- **Acceptance Criteria**:
  - Willow Step Cottage features layered foundation, timber porch posts, hanging lantern, shuttered windows, beveled shingle gables, and chimney detail.
  - Willow Lane displays curb borders, stepping stones, sculpted multi-cluster trees, wildflowers, supported mailbox, and seated/standing props with zero collision regression (`npm test` passing).
  - Jun exhibits upgraded storybook proportions, face readability, coat/bag detail, and gentle sorting animation.
- **Verification**: `npm test`, `npm run lint`, `npm run build`, and headless Chromium captures at `1440×900` & `390×844` with 0 console errors.

---

## Stage 1 — Lighting Calibration, Material Registry & Quick Structural Defect Fixes

- **Objectives**:
  - Roll out the shared `MaterialPalette` cache and calibrated ACES meadow/cobblestone textures across the full neighborhood.
  - Fix remaining P0 scene defects outside Willow Lane: add support posts to Sora's Tea Cart (`NeighborhoodCanvas.tsx:452-456`), close the central-east cobblestone strip gap (`L222-227`), replace floating perimeter wall blocks (`L232-239`) with cohesive fieldstone + split-rail + hedgerow borders, and add contact shadow skirts under all buildings/lamps.
  - Dirty-flag `updateEnvironmentVisuals()` and fix bell physics `dt`.
- **Systems & Modules Affected**: `src/scene/materials.ts`, `src/scene/textures.ts`, `src/scene/models.ts`, `src/scene/NeighborhoodCanvas.tsx`.
- **Dependencies**: Stage 0 prototype review approval.
- **Performance Considerations**: Expected **net reduction** in draw calls/material state changes via `MaterialPalette` and dirty-flagged updates.
- **Acceptance Criteria**: Zero floating structural geometry anywhere in the 50×46m diorama; calibrated sunlit/shadow contrast across all 4 phases; `isSoftwareGl` grounded shadows intact.
- **Verification**: Full-town flyover screenshots in all 4 phases (`morning`, `afternoon`, `golden`, `dusk`) at `1440×900` and `390×844`.

---

## Stage 2 — Signature Architecture & Landmark Craft

- **Objectives**:
  - Upgrade the remaining 5 named buildings (*Hearth & Crumb Bakery*, *Linden Book Nook*, *Copperwheel Cottage*, *Pinecone Woodshop*, *Sunbeam Greenhouse* exterior bed trim) from generic `buildClayCottage` clones into bespoke composite silhouettes matching each resident's craft.
  - Upgrade *Old Bell Gazebo*, *Stone Fountain*, *Noticeboard*, and *Hollow Oak* with storybook trim (carved fountain lions/spouts, layered noticeboard roof + pinned colored flyers, gnarled multi-root Hollow Oak with layered crown).
- **Systems & Modules Affected**: `src/scene/models.ts`, `src/scene/buildings/*.ts`, `src/game/worldMap.ts` (verify obstacle bounds stay exact!).
- **Dependencies**: Stage 1 `MaterialPalette` and contact shadow helpers.
- **Performance Considerations**: Merge static architectural trim sub-meshes where non-animated or reuse cached box/cylinder geometries; cap per-building triangle count around `800–1,800` tris.
- **Acceptance Criteria**: Every cottage recognizable purely by silhouette without reading HUD labels; all `BOX_OBSTACLES`/`CIRCLE_OBSTACLES` and `PROP_INTERACTABLES` remain aligned (`npm test` green).
- **Verification**: Per-landmark inspection captures + collision walkability test pass.

---

## Stage 3 — Full Cast Character & Animation Elevation

- **Objectives**:
  - Roll out the prototype's upgraded storybook character craft (`buildStorybookCharacter`) across the player and all 8 remaining residents (`clara`, `arthur`, `mina`, `barnaby`, `sora`, `toby`, `nora`, `pip`) with distinct clothing trims (baker apron, clockmaker vest & monocle/brass loupe, florist straw ribbon, carpenter leather apron, violinist scarf, artist beret/smock, librarian spectacles, kid patched shorts).
  - Add contextual activity animations (`work`, `sketch_read`, `music`, `converse`, `admire`) synced with the Milestone 2 simulation blueprint (`docs/audits/02-npc-life-simulation-blueprint.md`).
- **Systems & Modules Affected**: `src/scene/characters.ts`, `src/scene/models.ts`, `src/scene/NeighborhoodCanvas.tsx`, `src/game/residents.ts` (read-only appearance/trait hooks).
- **Dependencies**: Stage 0 Jun prototype validation.
- **Performance Considerations**: Share torso/limb base geometries and palette materials across all 10 rigs; keep per-character draw calls `<= 12–16`.
- **Acceptance Criteria**: All 9 residents clearly distinguishable by silhouette, gait/idle pose, and face from normal isometric camera zoom.
- **Verification**: Lineup capture + close-up dialogue/walk motion clip (`playwright-cli video-start`).

---

## Stage 4 — Botanical Dressing, Micro-Life & HUD Polish

- **Objectives**:
  - Upgrade perimeter grove `InstancedMesh` trees and interior courtyard trees to multi-lobe sculpted canopies (`2` instanced layers: trunks + multi-puff crowns).
  - Add instanced clover, wildflower clumps, stone curbs, wooden benches, garden fences, and pooled environmental life (chimney hearth wisps, Mirror Pond water ripple shader/shimmer, butterfly/dragonfly pairs by pond & greenhouse, gentle dusk fireflies).
  - Polish HUD touches: responsive touch-only visibility or subtle auto-collapse for `VirtualJoystick` on non-touch desktop viewports, and refined `TitleOverlay` framing over the plaza.
- **Systems & Modules Affected**: `src/scene/foliage.ts`, `src/scene/NeighborhoodCanvas.tsx`, `src/App.tsx`, `src/components/TitleOverlay.tsx`, `src/components/VirtualJoystick.tsx`.
- **Dependencies**: Stages 1–3.
- **Performance Considerations**: Strictly use `THREE.InstancedMesh` for grass/flowers/trees/curbs; cap ambient wildlife/particle pools (`<= 24` instances on GPU, `<= 12` on `isSoftwareGl`); preserve `>= 85%` clear viewport and zero `backdrop-filter`.
- **Acceptance Criteria**: Idle neighborhood feels alive and serene across all 4 times of day; draw calls `<= 140`; 0 console errors on desktop and mobile.
- **Verification**: Full desktop (`1440×900`) and mobile (`390×844`) gameplay & software-GL capture suite.
