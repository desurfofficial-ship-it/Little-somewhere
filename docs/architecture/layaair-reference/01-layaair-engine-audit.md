# 01 — LayaAir Engine Audit

**Reference**: https://github.com/layabox/LayaAir (LayaAir 3.x branches, e.g. LayaAir_3.3)  
**Official docs**: https://layaair.com/3.x/doc/  
**Date of audit**: 2026-11-20  
**Scope**: Research only. No code changes to LITTLE SOMEWHERE.

## 1. Overall Engine Architecture

LayaAir is a full-featured, cross-platform 2D/3D game engine written primarily in TypeScript. It targets HTML5, native (Android/iOS/Windows/Mac/Linux), and multiple mini-game platforms. Core characteristics:

- **Node-centric hierarchy**: Everything lives under a scene graph of `Node` / `Sprite` / `Sprite3D`.
- **Component + Script model**: Behaviour is attached via components. User logic typically inherits `Laya.Script` (itself a `Component`).
- **Module registration**: Classes are registered via `ClassUtils.regClass` and module definition files (e.g. `src/layaAir/laya/d3/ModuleDef.ts`).
- **Resource ownership**: Explicit loaders, resource managers, and cleanup paths.
- **Update scheduling**: Engine-driven lifecycle (onAwake, onEnable, onStart, onUpdate, onLateUpdate, onDisable, onDestroy) plus event system.
- **Rendering**: Supports WebGL / WebGPU, programmable pipelines, PBR, ClusterLighting, Forward+, 2D and 3D paths.
- **IDE integration**: Strong visual editors for scenes, materials, animation, physics, UI, particles, and (in 3.3+) 2D navigation.

Verified source locations (LayaAir 3.x tree):
- Core components: `src/layaAir/laya/components/Component.ts`, `Script.ts`
- 3D module registration: `src/layaAir/laya/d3/ModuleDef.ts`
- Scene: `src/layaAir/laya/d3/core/scene/Scene3D.ts` (and related)
- Display / Node: `src/layaAir/laya/display/`

## 2. Important Subsystems (Summary)

| Subsystem | Key Classes / Paths | Notes |
|-----------|---------------------|-------|
| Component / Script | `components/Component.ts`, `Script.ts` | Lifecycle + automatic event binding in `setupScript` |
| 3D Scene & Objects | `d3/core/Sprite3D.ts`, `Scene3D` | Hierarchical, transform-driven |
| Physics 3D | `d3/physics/PhysicsComponent.ts`, shapes, simulation | Historically Bullet-derived patterns; colliders, rigid bodies, character controllers |
| Physics 2D | `physics/` (ColliderBase etc.) | Separate 2D path |
| Animation | `d3/component/Animator/` (Animator, AnimatorControllerLayer, AnimatorState, AvatarMask) | State-machine oriented |
| Navigation | 3.3+ NavMesh2D + Nav2DAgent (documented in IDE docs) | 2D-focused addition |
| UI | `ui/`, `ui2/` | Multiple generations; newer system closer to FairyGUI patterns |
| Resource | `resource/`, loaders | Explicit management and streaming concepts |
| Events | `events/Event` | Used heavily by Script for collision, input, triggers |

## 3. Source-Code Investigation Highlights

### Script Lifecycle (verified)
From `Script.ts` (raw source inspected):
- Extends `Component`.
- `setupScript()` wires optional methods (`onTriggerEnter`, `onCollisionEnter`, mouse/keyboard handlers, etc.) to owner or stage events.
- Owner is typed as `Sprite | Sprite3D`.
- Provides a rich set of optional callbacks that feel Unity-like.

This is **not** a pure data-oriented ECS. Entities are Nodes; “components” carry both data and logic (especially Scripts).

### Module System
`ModuleDef.ts` registers large numbers of 3D classes (lights, renderers, Animator pieces, LOD, reflection probes, etc.). The engine is modular but still ships as a cohesive runtime.

### Physics Notes
`PhysicsComponent` manages activation states, collision flags, shapes (Box, Capsule, Mesh, Sphere, Compound, etc.), and integration with a simulation. Character movement and continuous collision concepts exist. Exact backend (Bullet vs others) has evolved; treat as mature rigid-body + character controller support.

### Navigation
Pre-3.3 pathfinding was more ad-hoc / A*-style examples. 3.3 introduced first-class 2D navigation mesh surfaces and agents (see release notes and IDE component docs). 3D navigation exists in some form but is less prominent in the open documentation examined.

## 4. Technical Findings Relevant to LITTLE SOMEWHERE

- LayaAir solves the general “game object + behaviour + update order + resource lifetime” problem with a mature Node + Component + Script stack.
- It provides production-grade animation state machines, physics, and (recently) nav-mesh agents.
- It is designed for broad platform coverage and IDE-driven content pipelines.
- Deterministic headless simulation, pure-function reducers, and save-migration contracts are **not** first-class concerns of the engine; those are application responsibilities.

## 5. Classification Preview (detailed in later docs)

- Strong reference value for animation controllers, component lifecycle conventions, and some performance/resource patterns.
- Low direct adoption value for the overall architecture or physics/nav systems given LITTLE SOMEWHERE’s existing headless design and small authored world.

## Verification Status

- Script.ts lifecycle and event wiring: **Verified** (raw source).
- ModuleDef registration patterns: **Verified**.
- PhysicsComponent surface: **Verified** at class level.
- NavMesh2D details: **Documented** in official 3.3 IDE docs; implementation internals not fully line-audited in this pass.
- Exact 3D pathfinding algorithms and multi-agent crowd behaviour: **Partially verified / Study**.

Unverified claims are marked in subsequent comparison documents.
