# 02 — ECS and Simulation Comparison

## LayaAir Model (Verified)

LayaAir does **not** implement a classic pure ECS (Entity = ID, Component = pure data, System = pure logic).  

Instead:
- **Entity ≈ Node / Sprite / Sprite3D** (has identity, transform, hierarchy, active state).
- **Component** base class holds data + some behaviour; user scripts inherit `Script`.
- Lifecycle methods (onAwake / onEnable / onStart / onUpdate / onLateUpdate / onDisable / onDestroy) and automatic event binding via `setupScript()`.
- Systems are not first-class registered executors; update order is driven by the engine’s node/component traversal and explicit priorities where exposed.
- Communication: events, direct references, and the scene hierarchy.

Source anchors:
- `src/layaAir/laya/components/Script.ts`
- `src/layaAir/laya/components/Component.ts`
- Module registration in `d3/ModuleDef.ts`

This is closer to Unity’s GameObject + MonoBehaviour model than to flecs / Bevy / pure data-oriented ECS.

## LITTLE SOMEWHERE Model (Inspected)

From `ARCHITECTURE.md` and `src/game/*`:

- **Authoritative state**: `WorldState` (versioned, currently v10) held in `worldRef.current` (mutable, 60 Hz) + throttled React snapshots.
- **Pure reducers** in `actions.ts` and related modules; discrete narrative / interaction mutations go through pure functions and `commitWorld()`.
- **Headless**: `src/game/` has zero Three.js / React / DOM imports (except guarded storage/audio). Fully testable in Node.
- **Residents, schedules, relationships, memories, dialogue, occupancy, interior stations** are data + pure logic.
- **No general-purpose entity-component registry**. Domain-specific structures (ResidentProgress, CottageHomeState, etc.) and explicit registries.
- Frame loop decoupling is deliberate: simulation advances via clock and discrete actions; rendering reads the ref.

This design prioritises:
1. Determinism and save compatibility.
2. Testability.
3. Clear ownership boundaries (game vs scene vs UI).
4. Avoidance of GC pressure from continuous React updates.

## Comparison & Classification

| Aspect | LayaAir | LITTLE SOMEWHERE | Classification | Rationale |
|--------|---------|------------------|----------------|-----------|
| Entity model | Node + components | Domain WorldState + explicit structures | D (Reject full model) | Our pure headless model is better for simulation + saves |
| Lifecycle | Rich Script callbacks | Explicit tick + pure reducers + React effects | B (Adapt conventions) | Formalise a few more ownership/lifecycle notes for new systems |
| System scheduling | Engine-driven | Clock + discrete actions + 60 Hz ref read | C (Study) | Useful reference for future agent update budgeting |
| Queries / filtering | Hierarchy + getComponent | Explicit maps / arrays / helpers | C | Not needed at current scale |
| Communication | Events + refs | Pure functions + world commit | A (keep ours) | Prefer pure reducers for testability |
| Large entity populations | Designed for them | Intentionally small (≈10 residents + props) | C | Only relevant if we later scale NPCs dramatically |

## Opportunities

- **Adopt (lightly)**: Document clearer “system ownership and update phase” conventions inspired by Script lifecycle for any new simulation modules.
- **Reject**: Introducing a general Component registry or making game objects into engine Nodes. That would couple the headless layer and complicate migrations/tests.
- **Study**: How LayaAir handles enable/disable and resource cleanup for ideas when adding/removing temporary activities or interior instances.

## Dependencies & Risks

Any move toward a heavier component model risks:
- Breaking the pure `src/game` boundary.
- Complicating WorldState migrations.
- Increasing per-frame allocation or React coupling.

Recommendation: keep the current architecture; borrow only naming/clarity conventions if they improve maintainability.
