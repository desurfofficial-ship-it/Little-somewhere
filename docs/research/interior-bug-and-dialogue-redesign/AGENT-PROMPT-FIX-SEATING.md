# Agent Prompt — Fix Interior Seating Trap

You are a Senior Gameplay Systems Engineer working on LITTLE SOMEWHERE.

## Task
Fix the confirmed interior seating bug so the player is never permanently trapped after sitting and standing.

## Confirmed Root Cause
In `src/game/playerController.ts` (`stepPlayerMovement`, sitting branch), the stand-up path always calls `isInteriorPointWalkable` from `cottage.ts`. That function only knows cottage bounds and obstacles.

For bakery and copperwheel seats the approach position fails the check, so the player is left at `seatPos` (inside the chair collision volume). After posture becomes `standing` and `seatId` is cleared, every movement direction is rejected (0 free directions).

Simulation evidence is in `docs/research/interior-bug-and-dialogue-redesign/02-interior-movement-bug-investigation.md`.

## Required Changes
1. Replace the cottage-only walkability check with a location-aware dispatcher that calls the correct function:
   - `cottage_interior` → `isInteriorPointWalkable`
   - `bakery_interior` → `isBakeryInteriorWalkable`
   - `nook_interior` → `isNookInteriorWalkable`
   - `copperwheel_interior` → `isCopperwheelInteriorWalkable`
   - `greenhouse_interior` → `isGreenhouseInteriorWalkable`
   - outdoor → `isPointWalkable`
2. If the approach is still not walkable, perform a short deterministic radial search (8 directions, 0.35 and 0.55 units) for the nearest walkable point before falling back.
3. Add unit tests that, for every indoor seat, assert:
   - post-stand position is walkable under the matching interior function
   - at least 4 of 8 cardinal/diagonal directions produce displacement > 0.01
4. Keep outdoor bench behavior unchanged.
5. Run `npm test`, `npm run lint`, and `npm run build`.

## Constraints
- Do not change save schema or WorldState.
- Do not alter dialogue systems in this pass.
- Preserve determinism and zero-allocation rules in the simulation step.
- Update `WORKLOG.md` with a short entry describing the fix.

## Acceptance
The reproduction sequence (enter bakery or copperwheel, sit on the chair, apply movement input) must leave the player at a walkable position with free movement in multiple directions.
