# 05 — Animation, Rendering and UI

## LayaAir Animation (Verified)

- `Animator` component with controller layers, states, transitions, AvatarMask, and manager support.
- Skeletal animation, blending, animation events, and timeline concepts are present.
- Integrated with the 3D renderables and Script lifecycle.
- Source region: `src/layaAir/laya/d3/component/Animator/`.

This is one of the stronger, more reusable subsystems for character work.

## LayaAir Rendering & UI (High-Level)

- Mature 2D/3D pipelines, materials, lights (including newer 2D lighting), particles, post-processing options, LOD, static batching concepts.
- UI has multiple generations (`ui/`, `ui2/`); newer work leans toward more modern componentised UI with IDE support.
- Resource and material systems are engine-managed.

## LITTLE SOMEWHERE Presentation (Inspected)

- Rendering: custom Three.js isometric diorama (`NeighborhoodCanvas.tsx` + builders). Procedural geometry, CanvasTextures, shared materials, InstancedMesh discipline, software-WebGL pacing, seasonal dressing, interior cutaways.
- Character presentation: lighter animation surface (state-driven poses / simple transitions rather than full skeletal state machines). Resident feel modules exist.
- UI: React + Tailwind storybook dialogue sheets, journal, inventory, pause, virtual joystick. Bottom-docked mobile-first interaction model. Context-sensitive [E] prompts.

Visual identity is strictly “Premium Handcrafted Storybook Diorama” (see art-direction docs).

## Classification

| Area | Classification | Notes |
|------|----------------|-------|
| Animator state-machine patterns | B (Adapt) | Highest-value idea. Improve sit/stand/activity/interaction transitions without adopting full skeletal runtime or LayaAir dependencies. |
| Full render pipeline / materials / PBR | D | We already control the look completely with Three.js; do not import engine rendering. |
| UI component / transition patterns | B (Adapt lightly) | Study polish ideas for dialogue sheet enter/exit and context menus; keep React + existing visual language. |
| Animation events for gameplay sync | B | Useful for coordinating prop interactions and station activities with animation peaks. |
| Particles / post-process | C | Only if they serve the storybook aesthetic without cost. |

## Opportunities

1. Introduce a lightweight, data-driven animation state table for player and key NPCs (idle, walk, sit, stand-up, activity loops) with simple blending or cross-fade rules.
2. Tie station interactions more tightly to animation completion events (still pure or minimally coupled).
3. Polish DialogueSheet and related UI transitions using patterns observed in mature UI systems, without changing the storybook visual language.

## Risks

- Over-animating can break the calm, readable diorama feel.
- Any animation system must remain cheap on mobile and must not allocate per frame inside the tick path.
- Keep animation state inside or adjacent to the headless layer where possible so tests can still assert outcomes.
