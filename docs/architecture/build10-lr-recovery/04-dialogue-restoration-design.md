# 04 — Dialogue Restoration Design (D-02)

**Principle:** add, do not swap back. The LR invitation topics are newer, verified gameplay — the restoration must coexist with them.

## Restoration

Commit `f46740f` re-adds to `src/game/dialogue/index.ts`:

```ts
import { WILDS_TOPICS } from './interiors/wilds';
…
  ...COPPERWHEEL_TOPICS, // 2 topics (Milestone 3 Build 9 — Copperwheel Cottage, Arthur)
  ...WILDS_TOPICS, // 2 topics (Build 10 — The Wild Hollows exploration check-ins)
  ...INVITATION_TOPICS, // Living Relationships LR-1 / LR-2
```

Insertion point: immediately after COPPERWHEEL, before INVITATION — the exact relative position wilds occupied at `9cde87d` (last interior group). Registry: **85 topics**, order verified id-by-id against both snapshots; no duplicate ids; wilds rows at indices 79–80, invitation rows 81–84.

The wilds content module itself (`src/game/dialogue/interiors/wilds.ts`) was never damaged — `4ad2e5f` only unwired it. Its conditions are restored verbatim and pinned hardcoded:

| Topic | Resident | Category | Priority | Condition |
|---|---|---|---|---|
| `daily_mina_foxglove` | mina | daily_slice | 14 | `{ requiresMet: true, sideFlagsTrue: ['explored_sorrel_hollow'], notSeenToday: true }` |
| `daily_rowan_beeline_checkin` | rowan | daily_slice | 14 | `{ requiresMet: true, sideFlagsTrue: ['explored_bee_line'], notSeenToday: true }` |

## Golden snapshot regeneration (independently justified, per the golden policy)

`scripts/dialogue-topics-golden.json` + `scripts/topic_snapshot_runtime.json` regenerated from the **live registry** via the repo's own generator (`npx tsx scripts/snapshot_topics_runtime.ts`). Programmatic diff vs the old golden:

- added: `daily_mina_foxglove`, `daily_rowan_beeline_checkin` (positions 79/80) — the restoration itself;
- removed: none; changed fields: only `index` shifts on the four invitation rows (81→83 etc.);
- the 83 shared rows are otherwise identical; count 83 → 85; sequence before the insertion is preserved exactly.

`dialogueRegistry.test.ts` (ordering + metadata contracts) passes unmodified. **No snapshot was changed to conceal a behavior loss — the snapshot change IS the restored behavior**, and BD10-10/11 now pin the rows from hardcoded expectations so regeneration can never again hide a registry loss.

## Selection semantics (measured, production scoring untouched)

Scoring formula (dialogueEngine): `CATEGORY_PRIORITY[category] + topic.priority` with history penalties (`-28` same-day, `-min(20, seenCount·5)`, `-120` last-topic). Measured fresh-world scores (spring, day 2, 08:05, met + explored flags set):

| Resident | Competitor | Score | Wilds check-in | Production pick |
|---|---|---|---|---|
| mina | side_mina_greenhouse_corner (personal_story) | 92 | 48 | story topic first |
| rowan | side_rowan_orchard_1 (personal_story) | 84 | 48 | story topic first |
| nora | quest_nora_postcard (quest_milestone) | 145 | — | story gate |

The check-ins surface **through ordinary play once the competing personal-story/tier topics drain through the same-day history penalty** — measured for Mina: surfaces at interaction **7** (`greenhouse_corner → herbloaf_1 → tier_friendly_confide → greenhouse_corner → gossip → greenhouse_corner → daily_mina_foxglove`). This is faithful-to-9cde87d behavior; production scoring was intentionally not modified (mandate: no arbitrary scoring changes). The deterministic starvation pin is BD10-12(c)/BD10-13: after the measured blocking preconditions resolve and everything else was talked about today, the check-in IS the selected topic.

## LR-2 coexistence guards

- Disjoint residents (mina/rowan vs nora) and disjoint preconditions (`requiresActiveInvitation` vs `sideFlagsTrue`) — no scoring interference (architecture specialist verified history-key disjointness).
- BD10-10's second half fails if a naive full revert drops `INVITATION_TOPICS` (mutation-verified: 11 failures).
- The dialogue gate's `requireLive` condition shares the unified strict predicate — invitation topics drop from selection exactly when the tick would archive the invite (doc 05).
