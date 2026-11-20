# 06 — World, Scene and Persistence

## LayaAir Scene & Resource Model

- Hierarchical scenes (`Scene3D`, nodes, prefabs).
- Explicit activation/deactivation, loading/unloading, and resource lifetime management.
- Prefab and streaming concepts exist for larger worlds.
- Memory and resource cleanup are engine responsibilities once objects are destroyed or scenes unloaded.

## LITTLE SOMEWHERE World Model (Inspected)

- Single persistent neighborhood with authored landmarks and multiple enterable interior cutaways (cottage, greenhouse, bakery, book nook, copperwheel).
- World progression and environmental changes are driven by the **in-game clock** and discrete actions, never by real-world elapsed time.
- Persistence: `WorldState` v10 → localStorage (`little_somewhere_world_v1`) via `storage.ts` + `migrations.ts`. Migrations are mandatory and tested.
- Interiors: data contracts (bounds, obstacles, stations, seats, waypoints) live in `src/game/`; geometry and reactive visuals live in `src/scene/builders/`. Dual maintenance is enforced by tests.
- No general scene streaming; the whole diorama is resident, with cutaway visibility toggles.

## Classification

| Area | Classification | Notes |
|------|----------------|-------|
| Full scene hierarchy / prefab system | D | Unnecessary; our builders + WorldState already give precise control. |
| Resource streaming ideas | C | Only relevant if the world grows dramatically. |
| Activation / deactivation patterns | B (Adapt) | Useful mental model for interior cutaway and seasonal prop enablement. |
| Persistence approach | A (keep ours) | Versioned WorldState + pure migrations is superior for this game’s needs. |
| Clock-driven progression | A (keep) | Non-negotiable design pillar. |

## Opportunities

- Continue treating interiors as data-driven contracts rather than free-form scenes.
- When adding new locations, copy the existing dual (game data + scene builder + tests) pattern.
- Document any new activation rules clearly so seasonal and progress-derived dressing stays allocation-free and derived from WorldState (already a HANDOVER contract).

## Risks

Importing engine scene management would couple the headless simulation to a heavy runtime and complicate the clean save model. Reject.
