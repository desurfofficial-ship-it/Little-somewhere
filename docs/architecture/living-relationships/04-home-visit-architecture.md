# 04 — Home Visit Architecture

## 4.1 Purpose

Allow a resident to be meaningfully present inside an interior during an accepted invitation or during a simple owner-occupancy window, without introducing multi-NPC interior pathfinding.

## 4.2 Occupancy Model (Lightweight)

```ts
type OccupancyRole = 'owner' | 'guest';

interface InteriorOccupant {
  residentId: ResidentId;
  role: OccupancyRole;
  location: PlayerLocation;
  stationId: string;          // known interactable or seat id
  localPos: Vec2;             // fixed local position for the station
  facing: number;
  arrivedMinute: number;
  departMinute: number;       // when they should no longer be present
  activityId?: string;
}

interface InteriorOccupancy {
  /** At most one occupant per interior in early milestones. */
  byLocation: Partial<Record<PlayerLocation, InteriorOccupant | null>>;
}
```

Rules for the first implementation:

- **One occupant per interior.**
- Occupant is almost always the **owner**.
- Position is a **fixed station**, not a path. The character is placed at the station when the player enters and remains there until departure.
- Exterior simulation continues for all other residents. The occupant is excluded from exterior pathfinding and encounter pairing while marked present indoors.
- No indoor A* graph is required for v1.

## 4.3 Owner Occupancy

Each visitable neighbor interior gains a small occupancy profile:

| Interior | Owner | Default station | Typical window |
|----------|-------|-----------------|----------------|
| Bakery | Clara | `bakery_table` or counter | Morning bake hours |
| Greenhouse | Mina | potting or shelf | Morning / afternoon |
| Book Nook | Nora | `nook_chair` or desk | Afternoon / golden |
| Copperwheel (future) | Arthur | workbench | Morning / golden |
| Player cottage | — | — | Player-only unless a future guest invite exists |

Owner presence is enabled when:

- An accepted invitation targets that interior and the current minute is inside the window, **or**
- A simple “at home” schedule slot is active and the player has at least acquaintance tier (optional, lower priority than invitation-driven presence).

## 4.4 Arrival and Departure

- **Arrival**: On successful door enter during a valid window, if occupancy is eligible, the occupant record is written and the scene places the character rig at `localPos`.
- **Departure**: When `minuteOfDay >= departMinute`, or the player exits, or the invitation completes/expires. The occupant is removed from the interior and their exterior runtime is restored to the current schedule slot (or a porch exit point).
- **Conflict**: If the player is already inside and the window starts, the occupant may appear on the next interior `rig.update` or on a soft “Clara steps in from the back” moment. No hard teleport of the player.

## 4.5 Interaction

- The occupant is a valid dialogue target using the existing dialogue sheet.
- Station interactions remain available. If the shared activity uses the same station, the activity UI takes precedence while the invitation is active.
- The occupant does not block walkability beyond the existing obstacle footprint of their station (they stand inside or adjacent to an already-obstacle station).

## 4.6 Visiting NPCs (Later Milestone)

A second phase may allow one non-owner guest (e.g. Arthur visiting Clara after reconciliation) under these constraints:

- Still one extra person maximum.
- Guest only appears when both an invitation/event and a compatible NPC–NPC relation exist.
- Guest uses a second predefined station, never free pathing.
- Explicitly out of scope for the first two milestones.

## 4.7 Scene Responsibilities

- Interior builders already update from world state each frame.
- Add a single occupant anchor (or reuse a character rig slot) that is visible only when `InteriorOccupancy` has an entry for the current `playerLocation`.
- Animation state is a simple idle / sit / work pose driven by the activity, reusing existing `NpcAnimationState` values.
- Zero allocation in the update path, consistent with current interior rigs.

## 4.8 Explicit Exclusions

- Multi-NPC indoor pathfinding.
- Residents freely wandering interiors on their own schedules.
- Occupancy of the player’s cottage by NPCs in the first milestone (possible later as a guest-for-tea invite).
- Physics or collision between player and occupant beyond existing station obstacles.
