# Golden Snapshot Regeneration — Behavioral Justification (LR3-56 / LR3-98)

- **Date**: 2026-11-24
- **Regeneration**: 86 → 90 topics (QA-05 correction of doc 06's "85 → 89": the SF-2 overhaul had already raised the baseline to 86 on integrated main; the correct arithmetic is 86 + 4 Clara topics = 90).
- **Generator**: `scripts/generate_dialogue_golden.ts` (committed alongside; deterministic dump of `DIALOGUE_TOPICS` metadata in registry order, byte-compatible formatting `JSON.stringify(..., null, 1)`).
- **Verification basis**: `feat/lr3-slice-1` on top of `feat/bakery-spatial-comfort` (main lineage `052e1712`).

## What changed and why it is behaviorally justified

Exactly four topics were added — Clara's invitation quartet (`src/game/dialogue/invitations/clara.ts`, doc 05 §8), spread into the registry through `dialogue/invitations/index.ts` after Nora's quartet:

| index | id | purpose |
|---|---|---|
| 85 | `inv_clara_indoor_pastry` | Indoor completion topic (accepted + live + requireIndoors) — offers the `share_morning_pastry` completion choice, mirroring NR-01's shape |
| 86 | `inv_clara_pending_offer` | Re-ask while an offer awaits response (accept/decline flags wired to the invitation writers) |
| 87 | `inv_clara_offer_pastry` | Fresh morning offer, gated by `requiresInvitationEligible` — structurally silent outside the morning because `canOfferInvitation` carries the D10 `offerPhases: ['morning']` gate (LR3-02/50/86) |
| 88 | `inv_clara_accepted_reminder` | Reminder while accepted and still outdoors |

## Integrity statement (LR3-98)

- The 86 pre-existing entries are **content-identical field-for-field** (id, residentId, category, priority, historyScope, condition) — verified programmatically by stripping positional `index` fields and deep-comparing before/after. Positions from 85 onward shift by +4 because the invitation aggregator sits at that fixed point in the module concatenation order (`dialogue/index.ts:64`); the registry's fixed order is preserved exactly (no reorder, no mutation).
- No existing topic's condition, priority, category, or text metadata changed. The golden contract test (`dialogueRegistry.test.ts`) passes against the regenerated snapshot.
- The quartet topics reference the day's bake roster (`getBakeForDay`) at build time — dynamic text, static metadata — so future roster changes cannot alter topic identity or ordering.

---

# Golden Snapshot Regeneration — Living Relationships LR-4 (95 → 96 Topics)

- **Date**: 2026-11-26
- **Regeneration**: `95 → 96` topics (`scripts/dialogue-topics-golden.json`).
- **Generator**: `npx --yes tsx scripts/generate_dialogue_golden.ts`.

## What changed and why it is behaviorally justified

One topic (`src/game/dialogue/everyday/teaching.ts` -> `TEACHING_TOPICS`) was appended strictly at the tail of `DIALOGUE_TOPICS` (`src/game/dialogue/index.ts`) after `PHOTO_ECHO_TOPICS`:

| index | id | residentId | category | priority | condition | purpose |
|---|---|---|---|---|---|---|
| 95 | `teaching_nora_featured_reading` | `nora` | `event_reaction` | `20` | `requiresMet: true`, `requiresTeachingKnown: ['nora_featured_reading']`, `requiresNpcMemory: { tag: 'shared_featured_reading', unmentionedOnly: true, maxDaysOld: 6 }`, `notSeenToday: true`, `maxSeenCount: 1` | Nora post-reading "what you learned" reflection gated on `nora_featured_reading` (LR-4 L4-S4). Uses singular `tag` so SF-4 context boosts remain 0 while priority 20 (`88`) beats `everyday_shared_visit_echo` (`87`) cleanly once without repeating. |

## Integrity statement

- All `95` pre-existing entries (`0..94`) remain **content-identical and position-identical** (zero reordering, zero condition/priority mutation).
- LR-3's bakery quartet (`85..88`) and SF-4 / GA-1 / Photography echoes (`89..94`) are completely untouched.

---

# Golden Snapshot Regeneration — Living Relationships LR-5 (96 → 101 Topics)

- **Date**: 2026-11-27
- **Regeneration**: `96 → 101` topics (`scripts/dialogue-topics-golden.json`).
- **Generator**: `npx --yes tsx scripts/generate_dialogue_golden.ts`.

## What changed and why it is behaviorally justified

Five topics were added strictly following the established LR-2/LR-3 + LR-4 append points:
1. Four topics (`src/game/dialogue/invitations/arthur.ts` -> `ARTHUR_INVITATION_TOPICS`) spread after `CLARA_INVITATION_TOPICS` in `src/game/dialogue/invitations/index.ts` (positions shifted deterministically right after position `88`):
   - `inv_arthur_indoor_workbench` (`arthur`, `invitation`, priority `40`)
   - `inv_arthur_pending_offer` (`arthur`, `invitation`, priority `10`)
   - `inv_arthur_offer_workbench` (`arthur`, `invitation`, priority `8`, gated on `sideFlagsTrue: ['copperwheelVisited']` + `requiresInvitationEligible`)
   - `inv_arthur_accepted_reminder` (`arthur`, `invitation`, priority `6`)
2. One topic appended strictly at the tail of `TEACHING_TOPICS` (`src/game/dialogue/everyday/teaching.ts`, now index `100`):
   - `teaching_arthur_escapement_basics` (`arthur`, `event_reaction`, priority `20`, gated on `requiresTeachingKnown: ['arthur_escapement_basics']` + singular `requiresNpcMemory: { tag: 'shared_workbench_hour', unmentionedOnly: true, maxDaysOld: 6 }`, `notSeenToday: true`, `maxSeenCount: 1`)

## Integrity statement

- All `96` pre-existing topic entries remain **content-identical** (zero condition, priority, category, or ordering mutations; `0..88` position-identical, `89..95` shifted cleanly by `+4` for `INVITATION_TOPICS` concatenation).
- All LR-3 (`share_morning_pastry`) and LR-4 (`teaching_nora_featured_reading`) topics remain untouched.
