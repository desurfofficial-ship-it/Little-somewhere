# 08 — Recommended Dialogue UI Architecture

**Date**: 2026-11-20

---

## 1. Component Hierarchy (Proposed)

```
DialogueSheet (existing entry)
├── DialogueHeader
│   ├── SpeakerVisual          // portrait or object illustration
│   ├── SpeakerMeta            // name, role, mood, tier, hearts
│   └── CloseButton
├── DialogueBody
│   ├── TextReveal             // optional; local state
│   └── HistoryDrawer          // optional; last N lines, UI-only
├── DialogueChoices
│   └── ChoiceButton[]
└── GiftPicker                 // existing, unchanged ownership
```

Prop inspection reuses `SpeakerVisual` with an object key.

---

## 2. Data Flow

```
dialogueEngine / actions
        │
        ▼
DialogueSession (+ optional portraitKey / subjectImageKey on nodes)
        │
        ▼
DialogueSheet (reads only)
        │
        ├── resolves visual via pure lookup (assets.ts)
        └── emits onSelectChoice / onClose / onGiveGift
```

No reverse writes. History buffer lives in component state or a ref; it is not part of `WorldState`.

---

## 3. Asset Resolution Strategy

Create `src/game/dialogue/assets.ts` (pure):

```ts
export function resolvePortrait(key: string | undefined, residentId: ResidentId): PortraitDescriptor
export function resolveSubjectImage(key: string | undefined): SubjectDescriptor
```

Descriptors return either:
- A procedural canvas recipe (preferred — zero external assets), or
- A future texture ID if external assets are ever introduced.

Default path (no key): current coat-color initial.

---

## 4. State-Flow Diagram

```
Idle
  │ interact
  ▼
SessionOpen ──choice──► NodeAdvance ──► SessionOpen
  │                         │
  │ close / isEnd           │ gift
  ▼                         ▼
SessionClosed            GiftPicker (overlay)
```

Text-reveal state is orthogonal and resets on node change.

---

## 5. Integration Points

| File | Change |
|------|--------|
| `types.ts` | Optional `portraitKey?`, `subjectImageKey?` on `DialogueNode` |
| `dialogueEngine.ts` | No change required for selection |
| `DialogueSheet.tsx` | Consume new fields; larger visual; optional history |
| New `dialogue/assets.ts` | Pure resolvers |
| Content modules | Gradually add keys (non-blocking) |

---

## 6. Compatibility Guarantees

- All existing topic IDs, memory IDs, conditions, priorities, and choice effects remain byte-identical.
- Saves written before the change continue to load (fields are optional).
- Tests that assert on node text or choice availability remain valid.
- No new npm dependencies.

---

## 7. Disadvantages and Mitigations

| Disadvantage | Mitigation |
|--------------|------------|
| Portrait asset creation cost | Start with procedural canvases or simple illustrated initials; expand later |
| History state complexity | Cap at 6 lines; clear on session end |
| Expression variety limited at first | Single default portrait per resident is acceptable for v1 |

The architecture is deliberately additive so a later agent can implement it without guessing about ownership or save impact.
