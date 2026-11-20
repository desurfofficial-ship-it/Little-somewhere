# 10 — Milestone Roadmap

Implementation is dependency-ordered and intentionally small. No milestone requires multi-NPC interior pathfinding or skill trees.

## Milestone LR-1 — Invitation Foundation

**Scope**  
- `InvitationState` data model and pure helpers (offer eligibility, accept, decline, expire).  
- One host: Clara, one activity id reserved (`share_morning_pastry`).  
- Dialogue offer/accept/decline topics.  
- No interior occupancy yet; completion can be a dialogue-confirmed “we shared tea” for pipeline testing, or deferred to LR-2.

**Dependencies**  
- None beyond current Build 8.

**Files / systems**  
- New: `src/game/invitations.ts` (+ test).  
- Touch: `types.ts`, `migrations.ts` (v10 slice for invitations only), `dialogueEngine.ts` (condition hook), `narrative.ts` or dialogue module, `actions.ts` (accept/decline reducer).

**New persistent state**  
- `invitations` only.

**Tests**  
- Eligibility gating by tier, day stamp, and active-invitation lock.  
- Accept / decline / expire transitions.  
- Migration v9 → v10 preserves prior state.

**Acceptance**  
- Clara can offer, player can accept or decline, state persists, no affinity penalty on decline, existing dialogue tests still pass.

**Exclusions**  
- Occupancy, teaching grants, other residents.

---

## Milestone LR-2 — Bakery Home Visit + Shared Pastry

**Scope**  
- `InteriorOccupancy` for bakery only.  
- Clara placed at table/counter during accepted window when player enters.  
- Shared activity `share_morning_pastry` completes at the station, writes memory, small affinity bump, clears invitation.  
- Exterior simulation skips Clara while she is the occupant.

**Dependencies**  
- LR-1.

**Files / systems**  
- `invitations.ts`, new `activities.ts`, `simulation.ts` (skip exterior for occupant), `actions.ts`, bakery interior builder (occupant anchor), `playerController.ts` / target selection if needed.

**New persistent state**  
- `occupancy`, `activeActivity`.

**Tests**  
- Enter during window → occupant present.  
- Enter outside window → no occupant.  
- Completion writes memory and completes invitation.  
- Clara excluded from exterior encounters while indoors.  
- Reload mid-visit restores or safely clears occupancy.

**Acceptance**  
- Player can accept Clara’s invite, enter the bakery, find her at the table, share the moment, and leave with a journal memory. Outdoor neighborhood otherwise unchanged.

**Exclusions**  
- Other interiors, teaching knowledge flags, guest NPCs.

---

## Milestone LR-3 — Teaching Flag + Second Host (Nora or Mina)

**Scope**  
- `TeachingState` and knowledge grant on activity completion.  
- Second host and activity (recommended: Nora reading or Mina tending—both interiors already exist).  
- One post-teaching dialogue variant.

**Dependencies**  
- LR-2.

**Files / systems**  
- `activities.ts`, `types.ts`, dialogue conditions, second interior builder occupancy anchor, migrations sanitizer for knowledge ids.

**New persistent state**  
- `teaching`.

**Tests**  
- Knowledge granted once.  
- Repeat activity does not duplicate memory spam.  
- Dialogue condition sees knowledge.  
- Migration defaults empty knowledge.

**Acceptance**  
- Two residents can invite and host; one teaching unlock changes later dialogue. No skill UI.

**Exclusions**  
- Copperwheel (unless Build 9 has landed), Barnaby, music/sketch activities.

---

## Milestone LR-4 — Copperwheel + Arthur (after Build 9)

**Scope**  
- Arthur workbench invitation and `share_workbench_hour`.  
- Occupancy on Copperwheel using the same pattern.  
- Knowledge `arthur_escapement_basics`.

**Dependencies**  
- Build 9 Copperwheel interior contract; LR-3.

**Files / systems**  
- Copperwheel module, Arthur dialogue topics, occupancy map entry.

**New persistent state**  
- None beyond registry entries.

**Tests**  
- Same occupancy and completion contracts as bakery.  
- Copperwheel contract tests remain green.

**Acceptance**  
- Arthur’s rift-adjacent quiet hour works inside his cottage.

**Exclusions**  
- Full tool-crafting system.

---

## Milestone LR-5 — Breadth and Polish

**Scope**  
- Remaining lightweight hosts (Barnaby quiet repair; optional Sora/Toby).  
- Gossip line for a completed shared activity.  
- Optional noticeboard/mailbox one-liner for an accepted invite.  
- Registry uniqueness and “at most one occupant” tests.

**Dependencies**  
- LR-3 (LR-4 optional).

**Exclusions**  
- Multi-NPC pathfinding, player cottage guests, community projects.

---

## Suggested Order Relative to Other Work

```
Build 8 (done)
    ├─ Dialogue modularization (parallel, recommended)
    ├─ Build 9 Copperwheel (parallel or just before LR-4)
    └─ LR-1 → LR-2 → LR-3 → LR-4 → LR-5
```

LR-1 and LR-2 can proceed before Copperwheel. They prove the pattern on systems that already exist.
