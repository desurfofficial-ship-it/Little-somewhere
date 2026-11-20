# 04 — Physics and Interaction Comparison

## LayaAir Physics (Verified at Class Level)

- 3D: `PhysicsComponent` and related classes under `d3/physics/` (shapes: Box, Capsule, Sphere, Mesh, Compound, Cone, Cylinder; rigid bodies; character controllers; collision flags; activation states; triggers).
- 2D: separate collider path (`ColliderBase` etc.).
- Features include continuous collision concepts, joint break events, trigger enter/stay/exit, and integration with the Script event system.
- Character movement controllers exist; exact CCD and solver details depend on the underlying backend (historically Bullet-influenced patterns).

Source: `src/layaAir/laya/d3/physics/PhysicsComponent.ts` and shape classes; Script collision callbacks.

## LITTLE SOMEWHERE Collision & Interaction (Inspected)

- Lightweight, deterministic, non-rigid-body:
  - Axis-separated sliding via `resolveMovement`.
  - Explicit obstacle lists (boxes + circles) kept in contract with visual geometry.
  - Interior-specific obstacle sets and walk bands (cottage, greenhouse, bakery, nook, copperwheel) with dual data/geometry tests.
  - Occupancy system for seats and stations.
  - Player controller handles locomotion, bridge Y, bench sit, prop targeting.
- Design goal: never trap the player between furniture; interiors are authored walkable bands, not free physics spaces.
- No continuous collision detection or general rigid-body simulation; everything is discrete and testable.

## Classification

| Area | Classification | Rationale |
|------|----------------|-----------|
| Full rigid-body / character controller stack | D (Reject) | Unnecessary cost and non-determinism risk for a small authored diorama. Current system is reliable and contract-tested. |
| Trigger / occupancy ideas | B (Adapt) | Our occupancy is already good; can study event-style enter/exit patterns for station activation clarity. |
| Preventing furniture trapping | A (ours is already strong) | Explicit interior contracts + tests are the correct solution for this game. Do not replace with physics. |
| Continuous collision | D | Overkill; would complicate save determinism and mobile performance. |

## Opportunities

- Harden any remaining edge cases in interior obstacle lists (already a focus of existing tests).
- Optionally add clearer “enter / exit station volume” helpers inspired by trigger callbacks, still implemented as pure geometry tests.
- Keep player and NPC movement in the headless layer; never push collision resolution into the Three.js scene graph.

## Risks

Introducing a general physics engine would:
- Break the pure headless boundary.
- Make deterministic replay and save migration harder.
- Increase frame cost on target mobile devices.
- Require re-authoring all interiors and re-writing large parts of the test suite.

Recommendation: stay with the current lightweight, contract-driven approach.
