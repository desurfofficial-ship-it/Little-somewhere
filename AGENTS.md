# AGENTS.md — Repository Engineering & Agent Guide for LITTLE SOMEWHERE

This document defines the mandatory architecture, design constitution, coding rules, and verification workflow for all engineers and coding agents working in the **LITTLE SOMEWHERE** repository.

---

## 1. Project Identity & Core Pillars

- **Title**: **LITTLE SOMEWHERE**
- **Genre**: Cozy isometric 3D low-poly life-simulation game (*"a little world filled with thousands of little stories"*).
- **Selected Visual Direction**: **PREMIUM HANDCRAFTED STORYBOOK DIORAMA** *(evolving the warm personality of Sunlit Diorama & Clay Storybook to premium cozy-game craft — see `docs/art-direction/VISUAL_IDENTITY.md`)*.
- **Primary Platforms**: Mobile-browser-first (390px+ touch ergonomics, bottom thumb-zone sheets, virtual thumbstick, tap-to-walk/interact) with full desktop browser support (1440px+ viewport, WASD/Arrows, mouse raycast, keyboard shortcuts).
- **Core Priorities**:
  1. Believable living characters with daily schedules across 4 time phases (`morning`, `afternoon`, `golden`, `dusk`).
  2. Meaningful interconnected personal stories with narrative branching.
  3. Environmental reactivity where narrative choices physically transform the 3D neighborhood.
  4. Persistent world progression across days (`localStorage` key `little_somewhere_world_v1`).
  5. Zero external runtime asset failures (100% procedural Three.js geometry, `CanvasTexture` surfaces, and Web Audio synthesis).

---

## OFFICIAL VISUAL IDENTITY — MANDATORY

All agents and contributors **must** read and follow the permanent art-direction documentation before designing, modifying, or reviewing any visual element:

- **Source of Truth**: `docs/art-direction/VISUAL_IDENTITY.md` (**PREMIUM HANDCRAFTED STORYBOOK DIORAMA**).
- **Quality & Review Gate**: `docs/art-direction/VISUAL_QUALITY_STANDARDS.md` (including the mandatory Asset-Review Checklist).
- **Audit, Roadmap & References**: `docs/art-direction/VISUAL_AUDIT.md`, `docs/art-direction/VISUAL_TRANSFORMATION_ROADMAP.md`, and `docs/art-direction/REFERENCE_GUIDELINES.md`.

**Non-Negotiable Rules**:
1. **Strict Visual Consistency**: All new buildings, characters, vegetation, pathways, props, lighting changes, animations, and UI surfaces must match **PREMIUM HANDCRAFTED STORYBOOK DIORAMA**—never introduce photorealism, generic low-poly asset-pack blocks, or an unrelated style.
2. **Consult Quality Standards First**: Review `docs/art-direction/VISUAL_QUALITY_STANDARDS.md` before building or editing any 3D asset, texture, shader, or HUD component.
3. **No Placeholder Geometry as Finished Art**: Never accept raw unmodified boxes/spheres/cylinders, floating canopies/awnings, single-polyhedron lollipop trees, or disconnected perimeter blocks as final assets. Every structure/prop must show 3-scale silhouette craft, structural connections, grounded contact shadows, and calibrated material contrast.
4. **Mandatory Visual Verification**: Significant visual or scene modifications must be verified via live screenshots at desktop (`1440×900`) and mobile (`390×844`) viewports in headless Chromium with 0 console errors.
5. **Mobile-First Rendering Discipline**: Preserve shared palette materials, `InstancedMesh` batching, zero per-frame allocations inside `tick()`, and full `isSoftwareGl` parity without sacrificing frame pacing.
6. **Documentation Sync**: Whenever the official visual standard or quality checklist evolves, update `docs/art-direction/VISUAL_IDENTITY.md` and `VISUAL_QUALITY_STANDARDS.md` in the same change.

---

## 2. Repository Layer Boundaries (Strict Separation)

Never collapse game logic, 3D rendering, and React UI into a single file. Respect these three unidirectional layers:

1. **`src/game/` — Pure TypeScript Simulation & Narrative Engine (Zero DOM / Zero Three.js)**
   - Must remain importable and testable directly in Node (`npx --yes tsx --test`).
   - Never import `three`, React, or browser-only globals in `types.ts`, `worldMap.ts`, `residents.ts`, `narrative.ts`, or `actions.ts`. (`storage.ts` guards `window.localStorage`, and `audio.ts` guards `AudioContext`).
   - All coordinates in world-space XZ use `Vec2` (`{ x, z }`). Screen-space 2D inputs (like the virtual joystick) use `ScreenVec2` (`{ x, y }`).

2. **`src/scene/` — Three.js Isometric 3D Diorama Renderer**
   - Mounted **once** inside an isolated `<div ref={mountRef} />` via `useEffect(..., [])` in `NeighborhoodCanvas.tsx`.
   - Reads live React state through `useRef` mirrors (`worldRef`, `screenStateRef`, `dialogueOpenRef`, `joystickVectorRef`, `zoomRef`) so React HUD re-renders **never** tear down or reset the WebGL context.
   - Syncs HUD readouts back to React at a throttled cadence (`~6 Hz` or target-change edges), never at 60 Hz.
   - Zero per-frame object allocations inside `tick()` — reuse module-scope scratch `Vector3`, `Raycaster`, `Vector2`, `Plane`, and `Color` instances.

3. **`src/components/` & `src/App.tsx` — Storybook HUD & Game Shell**
   - Full-viewport game shell (`Title` -> `Playing` -> `Paused`) mirrored to `document.body.dataset.state`.
   - **Never** apply CSS `backdrop-filter` / `backdrop-blur` over the active WebGL canvas (use opaque/rgba linen surfaces like `bg-[#FAF5EC]/95` to prevent software-WebGL stalls).
   - **Never** render website marketing navbars, SaaS pill badges on static metadata, or pulsating decorative status dots.
   - Every interactive control must use semantic `<button>` / `<dialog>` elements with accessible labels and `>= 44px` touch hitboxes.

---

## 3. Visual & 3D Craft Rules (Summary — See `docs/art-direction/`)

- **Typography**:
  - Display / Character Names / Landmarks: `Fraunces` (`font-display`).
  - UI Body / Dialogue Choices: `Plus Jakarta Sans`.
  - Clock / Day / Numeric Readouts: `JetBrains Mono` (`font-mono-nums` with `tabular-nums`).
- **Palette**:
  - Cream linen cards `#FAF5EC`, deep linen `#F1E8D9`, warm stone borders `#D4C4AE`.
  - Espresso ink `#2D241E`, muted ink `#6A5B50`.
  - Accents: Terracotta `#C86446`, Sage `#5E8062`, Honey Amber `#E5A93C`.
- **3D Geometry & Materials**:
  - Every building, landmark, prop, and actor must be a composite multi-part `THREE.Group` pivoted at bottom-center (`y = 0`) with soft radial contact shadows (`y = 0.02–0.025`).
  - Vary `roughness` across adjacent materials (`>= 0.25` delta, e.g. matte plaster `0.86` vs glazed ceramic `0.42` vs brushed brass `0.25`) using shared palette materials.
  - Always initialize `RoomEnvironment` via `PMREMGenerator` so metallic brass & glass elements reflect warmly instead of rendering black.
- **Software WebGL Compatibility (`isSoftwareGl`)**:
  - Detect software renderers (`SwiftShader|llvmpipe|softpipe|Software|Basic Render`) from `WEBGL_debug_renderer_info` / `RENDERER`.
  - When `isSoftwareGl` is true: set pixel ratio to `1`, disable `antialias` and `shadowMap`, skip `renderer.compile()`, and pace the loop with `afterDraw(tick)` (never raw `setTimeout(tick, n)`). Never alter gameplay logic or scene contents under `isSoftwareGl`.

---

## 4. Mandatory Commands & Verification Gates

Before considering any change complete, run these checks in order after your final edit:

1. **Unit Tests (Pure Engine Logic)**:
   ```bash
   npm test
   # equivalent to: npx --yes tsx --test src/game/*.test.ts src/scene/*.test.ts
   ```
2. **TypeScript Check**:
   ```bash
   npm run lint
   ```
3. **Production Build**:
   ```bash
   npm run build
   ```
4. **Live Browser Check (for UI or 3D changes)**:
   - Launch `http://localhost:3000` (or `http://localhost:3000/?autostart=1`) in headless Chromium, check zero console errors, verify desktop (`1440x900`) and mobile (`390x844`) layouts, and inspect actual screenshots.

---

## 5. Adding New Content Safely

- **Adding a Resident**: Add ID to `ResidentId` in `src/game/types.ts`, add definition + all 4 walkable `ScheduleSlot` coordinates to `src/game/residents.ts`, add dialogue tree in `src/game/narrative.ts`, and run `npm test` (which automatically validates walkability for every resident across all 4 phases).
- **Adding an Enterable Interior** (pattern: `src/scene/builders/cottageInterior.ts` + Entry 024): define layout constants (wall boxes with doorway gaps, furniture obstacles, plateau/ON/OFF rects) in the builder, mirror them exactly in `src/game/worldMap.ts` (obstacles + `getGroundHeightAt` plates + hysteresis helper), add nav nodes through the doorway, and keep the scene/game sync tests green. Never add scene lights for interiors — use emissive materials and toggle a hideable roof/body assembly per building.
- **Adding Environmental Reactivity**: Add flag to `StoryFlags` in `src/game/types.ts` and `createInitialStoryFlags()` in `src/game/narrative.ts`, derive visual boolean/count in `computeEnvironmentState()`, and toggle visibility/scale cleanly inside `EnvironmentVisualController.update()` in `src/scene/environmentRenderer.ts`.
- **Documentation Discipline**: Record every completed task in `WORKLOG.md` and update `HANDOVER.md` whenever architecture, storage keys, or open backlog items change.
