# 08 — NPC Behavior Integration

## 8.1 Goal

Integrate invitations and occupancy into existing schedule and simulation systems with the smallest possible change to exterior autonomy.

## 8.2 Schedule Compatibility

- Do not rewrite the 4-phase schedule tables.
- Occupancy eligibility is a **filter** on top of the current slot:
  - If an accepted invitation window overlaps the current phase and the host’s schedule place is “home” or near home, occupancy is allowed.
  - If the host is in a distant outdoor slot (orchard, pond, gazebo), the invitation window should have been generated only when a home-compatible phase was available; if a conflict still occurs, occupancy is simply not applied that minute.
- Rain behavior already prefers shelter for several residents; this can bias offer generation but does not force new schedule nodes.

## 8.3 Simulation Changes (Minimal)

Inside `stepSimulationInPlace`:

1. If a resident has an active `InteriorOccupant` record, skip exterior pathfinding, encounter pairing, and seat reservation for that resident.
2. Advance or clear the occupant when `minuteOfDay` passes `departMinute`.
3. On clear, snap the resident’s exterior `npcRuntime.position` to their home porch or current schedule target (existing navigation helpers) and clear `waypoints`.
4. All other residents behave exactly as today.

No new utility scores or needs are required for v1. Existing emotion and social need may receive a small positive bump on activity completion (same style as current close-tier proximity bonus).

## 8.4 Player Interior Awareness

Current code already treats the player as unreachable for outdoor greetings while indoors. Extend the same guard:

- While the player is inside an interior that has an occupant, that occupant is the dialogue/interaction target via the existing nearest-target path.
- Other residents remain outdoors and are not greetable until the player exits.

## 8.5 Arrival Presentation

- Preferred: occupant is already at the station when the player enters during the window.
- Alternative soft line in the entry reducer: “Clara looks up from the table.”
- No cutscene system is required.

## 8.6 Gossip and Memory Hooks

On activity completion, call existing helpers:

- Append NPC memory for the host (and optionally one nearby close friend later).
- Push a world event so the existing gossip selection can surface a low-sensitivity remark.
- Do not invent a new gossip propagation algorithm.

## 8.7 Explicit Exclusions

- Changing default schedules for all residents.
- Indoor steering or dynamic obstacle avoidance.
- Needs-driven invitation generation in v1 (personality + tier + day stamp is sufficient).
- Altering the 33-node exterior graph.
