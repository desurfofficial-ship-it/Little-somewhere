# 06 — Dialogue System Mechanics Analysis

**Date**: 2026-11-20

---

## 1. Current Architecture (Verified)

### Separation of Concerns

| Concern | Owner | Notes |
|---------|-------|-------|
| Dialogue content | `src/game/dialogue/**/*.ts` | Topics with `build()` returning nodes |
| Selection & evaluation | `dialogueEngine.ts` | Priority, conditions, history, memory, gossip |
| Conversation runtime state | `DialogueSession` (types.ts) | `currentNodeId`, `nodes`, `residentId`, etc. |
| Speaker resolution | `DialogueNode.speakerName` + `RESIDENTS` | Name is a string; no asset ID |
| Presentation | `DialogueSheet.tsx` | Purely presentational |
| Player input | React callbacks (`onSelectChoice`, etc.) | No logic duplication |

This separation is already good. The UI does not own authoritative narrative state.

### Conversation Lifecycle

1. Player interacts with a resident → engine selects highest-priority eligible topic.
2. Topic `build()` produces a node graph.
3. `DialogueSession` is created and passed to `DialogueSheet`.
4. Player selects a choice → `actions.ts` (or equivalent) advances `currentNodeId` or ends the session.
5. Choice side-effects (memory, flags, relationship, inventory) are applied in the pure action layer.

### Missing Capabilities Relative to Production Systems

| Capability | Status | Notes |
|------------|--------|-------|
| Portrait / expression asset | Absent | Only colored initial circle |
| Object / subject image | Absent | Prop card is text-only |
| Text reveal / skip | Absent | Instant text |
| Conversation history buffer | Absent | No scroll-back |
| Multi-speaker in one node | Partial | `speakerName` can differ per node, but UI always uses session resident for avatar |
| Ambient vs deep mode | Absent | Single sheet style |

---

## 2. How the Engine Communicates with the UI

`DialogueSession` is the sole contract. The sheet reads:

- `session.residentId` → resident definition (color, name fallback)
- `session.nodes[currentNodeId]` → text, choices, speakerName, speakerRole, moodLabel
- External props: `playerRelation`, `emotion`, `flags`, `world` (for choice availability and gift picker)

No reverse data flow exists. This is correct.

---

## 3. Recommended Extensions (Non-Breaking)

To support portraits and subject imagery without schema migration or ID breakage:

1. Add optional fields to `DialogueNode`:
   ```ts
   portraitKey?: string;      // e.g. "clara_warm" or "object_oak_table"
   subjectImageKey?: string;  // for object/environment lines
   ```
2. Resolve keys in a pure lookup table (`src/game/dialogue/assets.ts` or similar) that maps key → canvas texture URL or procedural descriptor. UI never hard-codes asset paths.
3. Keep all existing topic IDs, memory IDs, conditions, and priorities untouched.
4. Default when fields are absent: current colored-initial behavior (backward compatible).

### Speaker Resolution Strategy

- If `node.portraitKey` is set, use it.
- Else if `node.speakerName` matches a resident, use that resident’s default portrait key.
- Else fall back to the colored initial.

This preserves existing content while allowing gradual enrichment.

---

## 4. Architectural Rules to Preserve

- Do not move selection logic into `DialogueSheet.tsx`.
- Do not let the UI write `WorldState`.
- Any new portrait or history buffer must be either derived or stored in a non-persisted UI-only ref (history does not need to survive save).
- Text-reveal state belongs in the component (local React state), not in `DialogueSession`.

The current design already follows good practice; the gaps are additive.
