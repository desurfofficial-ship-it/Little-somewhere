# 03 — NPC Navigation and Behaviour

## LayaAir Navigation (Verified / Documented)

- Pre-3.3: examples and community patterns often used A* on grids or simple graphs.
- 3.3+ (release notes + IDE docs): first-class **2D NavMesh** support via `NavMesh2DSurface` and `Nav2DAgent` components. Agents can pathfind, avoid, and follow on the mesh.
- 3D navigation exists in the broader feature set but is less emphasised in the open 3.x documentation examined.
- No evidence of high-level social NPC intelligence, daily schedules, or relationship-driven behaviour inside the engine core. Those remain application-level.

Source / doc anchors:
- LayaAir 3.3 release notes (NavMesh2D addition).
- IDE component documentation for 2D navigation surfaces and agents.
- Engine does not appear to ship a sophisticated multi-agent crowd simulation or utility AI out of the box.

## LITTLE SOMEWHERE Navigation (Inspected)

From `src/game/navigation.ts`, `worldMap.ts`, `playerController.ts`, interior modules, and tests:

- Explicit **33-node A* graph** (`NAV_NODES` + `NAV_EDGES`) covering lanes, bridge, plaza, orchard, and key porches/doors.
- Obstacle primitives: `BOX_OBSTACLES` + `CIRCLE_OBSTACLES` kept in sync with visual geometry.
- Line-of-sight smoothing, stuck recovery, axis-separated sliding (`resolveMovement`).
- Interior-specific bounds, walkability, hub waypoints, and station targets (cottage, greenhouse, bakery, book nook, copperwheel) with mirrored contracts and tests.
- Resident movement is schedule- and task-driven across four time phases; not free-roaming utility AI.

This is deliberately authored, small-world, and highly controllable.

## Behaviour Layer

LayaAir: engine-level movement + path following only.  
LITTLE SOMEWHERE: `residents.ts` (definitions + 4-phase slots), `simulation.ts` (needs, emotions, encounters), `relationships.ts`, `memories.ts`, `dialogueEngine.ts`. Behaviour is domain-specific and already richer for the cozy simulation goals.

## Classification

| Finding | Classification | Notes |
|---------|----------------|-------|
| NavMesh2D / agents | D (Reject for now) | Our explicit graph is simpler, fully tested, and matches the authored diorama. NavMesh adds authoring and runtime cost without clear benefit at current density. |
| Path recalculation / stuck recovery ideas | C (Study) | Compare our stuck recovery against LayaAir agent behaviour for possible micro-improvements. |
| Multi-agent performance patterns | C | Only relevant if resident count grows substantially. |
| High-level autonomous schedules / social awareness | — | Already implemented (and more relevant) in LITTLE SOMEWHERE; LayaAir does not provide this. |

## Opportunities for LITTLE SOMEWHERE

- Keep the 33-node graph and interior contracts. They are a strength.
- Optional future: if a new district becomes large and organic, evaluate a hybrid (graph for major lanes + local avoidance). Not required now.
- Behaviour: continue investing in schedule fidelity, relationship-driven invitations, and memory/gossip rather than generic pathfinding upgrades.

## Risks of Adoption

Replacing the navigation system would require rewriting player movement, all resident steering, interior walkability, and a large test suite, with high risk of regressions in the carefully tuned small world.
