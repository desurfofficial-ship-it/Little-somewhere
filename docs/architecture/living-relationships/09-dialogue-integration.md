# 09 — Dialogue Integration

## 9.1 Goal

Surface invitations, visits, teaching, and shared memories through the existing declarative topic system without enlarging `narrative.ts` further if the modularization blueprint is adopted.

## 9.2 New Condition Hooks

Extend `DialogueCondition` (or evaluate via side data the selector already receives) with optional fields:

- `requiresInvitationStatus?: { id?: string; status: InvitationStatus }`
- `requiresKnowledge?: KnowledgeId[]`
- `requiresNoActiveInvitation?: boolean`
- `hostAtHome?: boolean` (occupant present in current or target interior)

These are evaluated in `dialogueEngine.ts` alongside existing flag, tier, and storyline checks. No second selector is introduced.

## 9.3 Topic Categories

Add a small set of topics per participating resident:

1. **Offer topic** — Available when generation conditions pass and no active invitation exists. Choices: accept / decline.
2. **Reminder topic** — Available while invitation is accepted and window is open. Short, warm, non-urgent.
3. **During-activity topic** — Available while occupant is present and activity can start. Leads into the shared activity reducer.
4. **After-memory topic** — Available once knowledge or the completion memory exists. References the shared moment; low priority so it does not crowd quest topics.

Topics use `makeSimpleTopic` / `makeBranchingTopic` exactly as current content does.

## 9.4 Priority and History

- Offer topics sit below active quest milestones and above generic smalltalk (proposed priority band 30–40).
- Completion topics use resident-scoped history so they appear once per few days, not every conversation.
- Existing daily affinity cap behavior remains; offer/accept dialogue itself should not grant large affinity (the activity completion does).

## 9.5 Memory and Gossip Lines

- Host memory text is written by the activity reducer, not hardcoded inside every topic.
- Gossip topics can reuse the existing third-party gossip selector when a recent world event of kind `shared_activity` exists and affinity/tension gates pass.
- Non-omniscience rules stay in force: a resident only references a visit they hosted or a memory they actually hold.

## 9.6 Content Organization

If the Dialogue Modularization Blueprint is followed, new topics live in:

- `src/game/dialogue/invitations/clara.ts` (and peers)
- or `src/game/dialogue/interiors/*.ts` next to existing interior topics

Until modularization lands, topics may be appended to `DIALOGUE_TOPICS` in a clearly marked section. Prefer modularization first or in parallel to avoid further growth of `narrative.ts`.

## 9.7 Explicit Exclusions

- Free-form generated dialogue.
- Omniscient NPCs who know about visits they did not attend.
- Replacing the current greeting or quest topic flow.
