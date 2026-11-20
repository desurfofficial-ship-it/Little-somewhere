# 02 — Interior Movement Bug Investigation

**Date**: 2026-11-20  
**Status**: Root cause confirmed via reproducible simulation

---

## A. Bug Reproduction Report

### Exact Reproduction Sequence

1. Enter any of the following interiors that contain a seating interaction:
   - Hearth & Crumb Bakery (`bakery_interior`) — café chair
   - Copperwheel Cottage (`copperwheel_interior`) — window armchair
2. Approach the chair until the interaction prompt appears.
3. Sit down (player posture becomes `sitting`, position snaps to `seatPos`).
4. Apply any movement input (WASD, arrows, or virtual joystick deflection ≥ 0.08).
5. Observe: player posture returns to `standing`, but the character remains at the original `seatPos` (inside the chair collision volume) and can no longer move in any direction.

Cottage table stools and the Book Nook armchair do **not** exhibit the permanent trap under the same sequence (see evidence below).

### Relevant Source Files and Functions

| File | Function / Symbol | Role in failure |
|------|-------------------|-----------------|
| `src/game/playerController.ts` | `stepPlayerMovement` (lines ~191–205) | Stand-up branch; wrong walkability check |
| `src/game/cottage.ts` | `isInteriorPointWalkable` | Only knows cottage bounds/obstacles |
| `src/game/bakery.ts` | `BAKERY_SEAT_SPOTS`, `resolveBakeryInteriorMovement` | Seat definition + correct resolver (never reached for approach) |
| `src/game/copperwheel.ts` | `COPPERWHEEL_SEAT_SPOTS`, `resolveCopperwheelInteriorMovement` | Same |
| `src/game/bookNook.ts` | `NOOK_SEAT_SPOTS` | Survives by coincidence |

### Actual Player and Collision States (Measured)

Simulation executed with `tsx` against the live modules (2026-11-20):

| Seat | Stood-up Position | Free Directions After Stand | Notes |
|------|-------------------|-----------------------------|-------|
| Cottage west stool | `{x: -0.99, z: 1.0}` (near approach) | 8 / 8 | Correct |
| Cottage east stool | `{x: 1.56, z: 0.9}` | 8 / 8 | Correct |
| Bakery café chair | `{x: 0.73, z: 1.45}` (**seatPos**) | **0 / 8** | Trapped |
| Book Nook armchair | `{x: -0.84, z: 0.55}` (near approach) | 8 / 8 | Survives |
| Copperwheel armchair | `{x: -1.4, z: 1.55}` (**seatPos**) | **0 / 8** | Trapped |

### Evidence of the Failure

For bakery and copperwheel the stand-up path evaluates:

```ts
isInteriorPointWalkable(seat.approachPos.x, seat.approachPos.z, 0.42)
```

This function returns `false` for positions outside cottage bounds (or inside cottage obstacles). Consequently the `if (seat && approachWalkable)` branch is skipped, `pos` remains `seatPos`, and `seatId` is cleared. The subsequent movement step calls the correct interior resolver, which immediately rejects every candidate because the player is already inside an obstacle.

---

## B. Root-Cause Analysis

### Confirmed Root Cause

**Incorrect walkability function used for non-cottage indoor seats during the stand-up transition.**

`stepPlayerMovement` hard-codes `isInteriorPointWalkable` (cottage-only) for every `seat.indoor === true` seat. Bakery and Copperwheel approach positions fail that check, so the player is never relocated to `approachPos` and is left inside the chair’s collision volume.

### Why the Existing Implementation Fails

1. Seat registries were added per-interior (Milestone 3 Builds 7–9) after the original cottage seating logic.
2. The stand-up path was never updated to dispatch to the matching interior walkability function.
3. For chairs that exist in the obstacle table (`nook_chair`, `cw_chair`) or whose visual geometry coincides with a solid volume, remaining at `seatPos` is fatal.
4. Axis-aligned sliding resolution cannot recover from a position that is already inside an obstacle.

### Scope

| Interior | Affected? | Reason |
|----------|-----------|--------|
| Cottage | No | Approach positions pass the cottage check |
| Bakery | **Yes** | Approach fails cottage check; seatPos is inside table/chair space |
| Book Nook | No (current data) | Approach happens to be accepted |
| Copperwheel | **Yes** | Same as bakery |
| Outdoor benches | No | Use `isPointWalkable` |

The bug is structural: any future indoor seat whose approach lies outside cottage bounds will be trapped.

---

## C. Proposed Technical Fix

### Exact Files and Systems

1. `src/game/playerController.ts` — replace the single `isInteriorPointWalkable` call with a location-aware dispatcher.
2. (Optional but recommended) Add a small helper `isAnyInteriorPointWalkable(location, x, z, radius)` that switches on `PlayerLocation`.
3. Unit tests in `src/game/player.test.ts` (and/or new `seating.test.ts`) covering all five indoor seats.

### Recommended Implementation Approach

```ts
function isApproachWalkable(seat: SeatSpot, location: PlayerLocation): boolean {
  const r = 0.42;
  switch (location) {
    case 'cottage_interior':
      return isInteriorPointWalkable(seat.approachPos.x, seat.approachPos.z, r);
    case 'bakery_interior':
      return isBakeryInteriorWalkable(seat.approachPos.x, seat.approachPos.z, r);
    case 'nook_interior':
      return isNookInteriorWalkable(seat.approachPos.x, seat.approachPos.z, r);
    case 'copperwheel_interior':
      return isCopperwheelInteriorWalkable(seat.approachPos.x, seat.approachPos.z, r);
    case 'greenhouse_interior':
      return isGreenhouseInteriorWalkable(seat.approachPos.x, seat.approachPos.z, r);
    default:
      return isPointWalkable(seat.approachPos.x, seat.approachPos.z, 0.48);
  }
}
```

Use this helper in the stand-up branch. If the approach is not walkable, fall back to a short radial search for the nearest walkable point outside the seat’s obstacle footprint (max 0.6 units) before giving up.

### State-Transition Improvements

- Always clear `seatId` **after** a successful reposition, or keep a one-frame “exiting seat” flag if recovery search is needed.
- Set `wasAirOrStepApex` (already done) so the animation system can play a stand transition.

### Safe Stand-up Positioning

- Prefer the authored `approachPos` when walkable under the **correct** interior function.
- If not, search in 8 directions at 0.35 and 0.55 units for a walkable point.
- If still none, leave the player at `seatPos` but mark a recovery flag so the next movement tick forces a push outward (last-resort).

### Collision and Navigation Considerations

No change to the existing axis-aligned resolvers is required once the player is placed outside the obstacle. The existing hub-based waypoint systems already treat approach positions as valid.

### Recovery Behavior

If the player is ever found inside an obstacle while `posture === 'standing'`, the movement step should attempt the same short radial search before applying input. This is a defensive addition, not required for the primary fix.

---

## D. Regression Testing Plan

### Unit Tests (must pass before merge)

1. For every indoor seat in `COTTAGE_SEAT_SPOTS`, `BAKERY_SEAT_SPOTS`, `NOOK_SEAT_SPOTS`, `COPPERWHEEL_SEAT_SPOTS`:
   - Sit → stand via movement input → resulting position is walkable under the matching interior function.
   - At least 4 of 8 cardinal/diagonal directions produce displacement > 0.01.
2. Outdoor bench stand-up continues to use `isPointWalkable` and remains green.
3. Zero-input while sitting still locks to `seatPos` and `animState: 'sit'`.

### Manual / Headless Checks

- Sit and stand at each chair 3× in succession.
- Sit, stand, immediately walk into the nearest wall and away.
- Sit at the bakery chair while the table is fully dressed; stand and leave the room.
- Verify no console errors and that the player never remains inside an obstacle after a valid stand.

### Acceptance Criterion

**The player must never become permanently trapped after a valid furniture interaction.**
