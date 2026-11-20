# 03 — Seating and Collision Technical Research

**Date**: 2026-11-20

---

## 1. Current Implementation Model

LITTLE SOMEWHERE uses a pure simulation step (`stepPlayerMovement`) with:

- Explicit `posture: 'sitting' | 'standing'`
- Authored `seatPos` / `approachPos` / `facingAngle` / `seatHeight` per seat
- Location-specific axis-aligned box obstacles and sliding resolvers
- No root-motion animation; position is set directly

This is appropriate for a deterministic, mobile-browser-first, zero-external-asset game.

---

## 2. Production Patterns Observed

### Safe Dismount Positions (Common Pattern)
Most 3D life-sim and adventure games author an explicit “exit point” that is guaranteed to be outside the furniture’s collision. The stand action teleports (or lerps) the character to that point before re-enabling locomotion. Examples include:
- Stardew Valley furniture interaction (sit → stand returns to a pre-validated tile)
- Animal Crossing furniture sitting (character steps back to a free adjacent tile)
- Many Unity/Unreal seating systems that store an `exitTransform` on the interactable

**Lesson**: The approach position must be validated by the **same** collision query that will govern subsequent movement.

### Collision Toggle During Animation
Some engines disable the player capsule while the sit/stand animation plays, then re-enable it only after the root is at the exit point. This avoids the “stuck inside geometry” frame.

LITTLE SOMEWHERE has no skeletal animation root motion, so a simple position swap is sufficient **if** the destination is walkable.

### Recovery from Invalid Positions
Robust systems include a last-resort “unstuck” that pushes the character along the nearest free normal or to a known safe hub. The existing interior hub waypoints (`INTERIOR_HUBS` etc.) already provide candidates for this.

---

## 3. Trade-off Analysis for This Codebase

| Approach | Pros | Cons | Fit for LITTLE SOMEWHERE |
|----------|------|------|--------------------------|
| Fix walkability dispatch only | Minimal change, preserves determinism, no schema impact | Does not protect against future seats with bad approach data | **Recommended primary fix** |
| Add radial recovery search | Handles imperfect approach data | Slightly more code; must remain allocation-free and deterministic | Recommended defensive addition |
| Disable collision while seated | Matches some AAA patterns | Unnecessary here; seated state already locks position | Not needed |
| Continuous collision during sit | Prevents overlap | Requires chair geometry to be non-solid or special-cased | Overkill; chairs are either visual or already in obstacle table |
| Root-motion animation | Highest fidelity | Requires animation assets and non-deterministic timing | Out of scope (zero external assets) |

---

## 4. Clearance Guidelines (Derived from Existing Data)

Current actor radius indoors: **0.42**.

Observed approach-to-obstacle clearances that work:
- Cottage west: approach is ~0.6 units clear of table box → free movement
- Book Nook: approach z is 0.5 units from chair minZ → free movement

Recommended minimum clearance for new seats: **≥ 0.55** units from any obstacle edge (radius 0.42 + 0.13 buffer).

---

## 5. Recommended Engineering Rules Going Forward

1. Every indoor seat’s `approachPos` **must** pass the matching interior walkability function at radius 0.42.
2. The stand-up path **must** call the location-specific walkability function (never a hard-coded cottage check).
3. Add a unit test that iterates all seat registries and asserts post-stand walkability + ≥4 free directions.
4. When a chair is added to an obstacle table, its `seatPos` may be inside the box, but `approachPos` must remain outside.
5. Visual furniture that is not in the obstacle table (cottage stools, bakery chair) still needs a walkable approach so the player is not left inside the visual volume.

These rules prevent recurrence without changing the overall architecture.
