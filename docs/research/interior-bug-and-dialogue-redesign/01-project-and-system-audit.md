# 01 — Project and System Audit

**LITTLE SOMEWHERE** — Interior Movement Bug Investigation & Dialogue Sheet Redesign Research  
**Date**: 2026-11-20  
**Repository**: https://github.com/desurfofficial-ship-it/Little-somewhere (main @ 67bbff9)

---

## 1. Current Milestone Status

**Latest completed work** (from `HANDOVER.md` and commit history):

- Milestone 3 Build 9 (`COMPLETE`): Visitable Copperwheel Cottage & Arthur's Brass Workshop
- Milestone 3 Build 8: Linden Book Nook
- Milestone 3 Build 7: Hearth & Crumb Bakery
- Milestone 3 Build 6: Sunbeam Greenhouse
- Milestone 2C Polish Rounds 1–4 (`COMPLETE`) — everyday life Passes 1–15
- Dialogue Modularization refactor (79 topics across 20 content modules)

**Target next milestone** (per HANDOVER): relationship-tier invitations/teaching, or post-Bell Community Projects. All four visitable interiors are complete.

**Current development priorities** (from `docs/production/everyday-life-polish-roadmap.md` and HANDOVER):
- Everyday-life polish continues in dependency-ordered passes.
- No save-schema changes are allowed without explicit migration work.
- Completed Milestone 2A/2B systems are protected.

---

## 2. Architecture Summary (Verified)

Three unidirectional layers (AGENTS.md §2, ARCHITECTURE.md):

| Layer | Path | Responsibility | Constraints |
|-------|------|----------------|-------------|
| Simulation | `src/game/` | Pure TypeScript, zero DOM/Three.js | Must remain Node-testable |
| Scene | `src/scene/` | Three.js isometric diorama | Mounted once; zero per-frame allocations in `tick()` |
| UI | `src/components/` + `App.tsx` | React HUD & game shell | No `backdrop-filter` over WebGL; ≥44px touch targets |

**Key simulation systems relevant to this research**:
- `playerController.ts` — locomotion, sitting lock, move-to-stand release, interior collision dispatch
- `cottage.ts`, `bakery.ts`, `bookNook.ts`, `copperwheel.ts`, `greenhouse.ts` — per-interior bounds, obstacles, seats, walkability, movement resolvers
- `dialogueEngine.ts` + `src/game/dialogue/` — declarative topic selection, memory/gossip, node evaluation
- `DialogueSheet.tsx` — current bottom-docked presentation

**Storage**: `localStorage` key `little_somewhere_world_v1`. WorldState is at v10. Save compatibility is a hard constraint.

---

## 3. Interior & Seating Implementation (Verified)

### Seat Registries
| Interior | Registry | Seat IDs | Chair in Obstacle Table? |
|----------|----------|----------|--------------------------|
| Cottage | `COTTAGE_SEAT_SPOTS` | `cottage_seat_table_west/east` | No (stools visual only) |
| Bakery | `BAKERY_SEAT_SPOTS` | `bakery_seat_cafe_west` | No (chair visual only) |
| Book Nook | `NOOK_SEAT_SPOTS` | `nook_seat_armchair` | Yes (`nook_chair`) |
| Copperwheel | `COPPERWHEEL_SEAT_SPOTS` | `cw_seat_armchair` | Yes (`cw_chair`) |

Outdoor benches live in `SEAT_SPOTS` (`worldMap.ts`) and are never claimed by NPCs indoors.

### Stand-up Logic (Critical)
In `stepPlayerMovement` (`playerController.ts` ~191–205):

```ts
if (posture === 'sitting' && hasMoveInput) {
  posture = 'standing';
  stoodUpFromMove = true;
  const approachWalkable = seat?.indoor
    ? isInteriorPointWalkable(seat.approachPos.x, seat.approachPos.z, 0.42)  // ← cottage-only
    : isPointWalkable(...);
  if (seat && approachWalkable) {
    pos = { ...seat.approachPos };
  }
  seatId = null;
}
```

`isInteriorPointWalkable` is imported from `cottage.ts` and only checks `COTTAGE_BOUNDS` + `COTTAGE_INTERIOR_OBSTACLES`.

### Movement Dispatch
Interior movement uses location-specific resolvers:
- `cottage_interior` → `resolveInteriorMovement`
- `bakery_interior` → `resolveBakeryInteriorMovement`
- `nook_interior` → `resolveNookInteriorMovement`
- `copperwheel_interior` → `resolveCopperwheelInteriorMovement`
- `greenhouse_interior` → `resolveGreenhouseInteriorMovement`

Each resolver is axis-aligned sliding (try full move, then X-only, then Z-only, else stay).

---

## 4. Dialogue System Architecture (Verified)

### Content / Runtime Separation
- **Content**: `src/game/dialogue/**/*.ts` — topic definitions with `build()` that return `{ rootId, nodes }`.
- **Selection**: `dialogueEngine.ts` — priority by category, conditions, history, memory, relationship tier.
- **Runtime state**: `DialogueSession` in `types.ts` — `residentId`, `currentNodeId`, `nodes`, optional `topicId`, emotion, tier.
- **Presentation**: `DialogueSheet.tsx` — purely presentational; calls `onSelectChoice` / `onClose` / `onGiveGift`.

### DialogueNode Shape
```ts
interface DialogueNode {
  id: string;
  speakerName: string;
  speakerRole: string;
  moodLabel: string;
  text: string;
  choices: DialogueChoice[];
  isEnd?: boolean;
}
```

No portrait or subject-image fields exist today.

### Current UI Characteristics
- Bottom-docked sheet (`items-end`).
- Circular initial avatar colored by `resDef.appearance.coatColor`.
- Speaker name + relationship tier icon + heart row + mood/role line.
- Quoted prose with max-height scroll.
- Choice buttons (≥44px).
- Separate prop inspection card path.
- Gift picker inline when applicable.

---

## 5. Relevant Documents Read

| Document | Purpose for this research |
|----------|---------------------------|
| AGENTS.md | Layer boundaries, visual rules, verification gates |
| ARCHITECTURE.md | System diagram, file ownership |
| GAME_DESIGN.md | Genre pillars, relationship & narrative goals |
| HANDOVER.md | Current milestone status, contracts for interiors |
| WORKLOG.md | Historical context (not re-summarized here) |
| docs/production/everyday-life-polish-roadmap.md | Active polish sequence |
| Milestone specs 16–19 | Interior contracts for greenhouse, bakery, nook, copperwheel |

---

## 6. Open Gaps Identified in This Audit

1. Stand-up walkability check is cottage-only → confirmed bug source (see document 02).
2. No portrait or subject-image metadata on `DialogueNode` or `DialogueSession`.
3. DialogueSheet owns no history buffer; conversation history is not surfaced.
4. Prop inspection and character dialogue use two separate visual treatments inside the same component.
5. No text-reveal / skip controls exist.

These gaps are the inputs to documents 02–10.
