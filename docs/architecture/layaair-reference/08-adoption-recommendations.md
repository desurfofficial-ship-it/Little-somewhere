# 08 — Adoption Recommendations

Classification key:
- **A — Adopt**: Strong technique worth incorporating soon.
- **B — Adapt**: Valuable concept requiring modification for our architecture.
- **C — Study**: Useful reference, no immediate implementation.
- **D — Reject**: Unsuitable, redundant, or unnecessarily expensive.

## Ranked Recommendations

### Priority 1 — Critical architectural hygiene & reliability
None from LayaAir rise to “critical weakness” level. Our headless design, WorldState migrations, and interior contracts are already strong. Continue protecting them.

### Priority 2 — Gameplay reliability / existing bug classes
- **B**: Clearer enter/exit volume helpers for stations and seats (inspired by trigger callbacks). Still pure geometry.
- **A (ours)**: Keep dual data/geometry contract frets; they already address furniture trapping.

### Priority 3 — NPC simulation quality
- **C**: Agent update budgeting ideas for future scale.
- High-level behaviour (schedules, relationships, memory, dialogue) is already more advanced and domain-appropriate than anything in the engine core. Continue investing there.

### Priority 4 — Player & character interaction
- **B (highest value)**: Lightweight animation state / transition patterns for sit, stand, walk, and activity loops. Borrow the *idea* of Animator layers/states, implement with simple data tables and existing presentation code.
- **B**: Animation-event style hooks to synchronise interaction completion.

### Priority 5 — World simulation & persistence
- **A (keep)**: Clock-driven progression, versioned WorldState, pure migrations.
- **D**: Engine scene loading / prefab systems.

### Priority 6 — Performance
- **B**: Explicit enable/disable or phase flags for optional systems.
- **C**: Broader profiling patterns.

### Priority 7 — Visual & presentation
- **B (light)**: UI transition polish for dialogue sheets and context UI, staying inside React + storybook language.
- **D**: Any change to the render pipeline or material system that fights the handcrafted diorama identity.

## Explicit Rejects
- Migrating the project to LayaAir or any full engine.
- Replacing the 33-node A* + obstacle system with NavMesh.
- Introducing general rigid-body physics.
- Rewriting the simulation as a general ECS or Node/Component graph.
- Any dependency that couples `src/game` to rendering or breaks save compatibility.

## Expected Benefits vs Risks
Benefits are incremental polish (animation feel, clearer station lifecycle, better documentation of ownership). Risks of over-adoption are architectural coupling, loss of determinism, and mobile performance regression. Stay conservative.
