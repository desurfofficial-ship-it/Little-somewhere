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
