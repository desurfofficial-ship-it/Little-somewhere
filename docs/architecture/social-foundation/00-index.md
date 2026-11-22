# Social Foundation — Initiative Index

- **Date**: 2026-11-22
- **Status**: Implemented & verified on main (`npm test` 588/588, `tsc` clean, `vite build` green)
- **Mission**: Relationships, Dialogue and Storytelling Lead — build the reusable social gameplay foundation (Workstreams A–F) that complements LR-1/LR-2 (merged) and LR-3 (Clara/bakery, owned elsewhere — untouched), and prepare LR-4/LR-5.
- **Deliverable of record**: `22-social-foundation-contracts.md` in the living-relationships series.

## Document map

| Doc | Content |
|---|---|
| `01-audit-synthesis.md` | Synthesis of the five parallel research audits (relationship architecture, dialogue engine, invitation chassis, story/journal, LR-4/LR-5 preparation) |
| `02-design-decision-register.md` | Design decisions of record (dimensions model, boost band-clamp, cancellation semantics, emergent knowledge boundary, LR-3 reservation map) |
| `03-implementation-record.md` | As-built file map, test map, and gate evidence |
| `04-adversarial-qa.md` | Independent adversarial QA round: findings, fixes, verdict |

## Companion specs (living-relationships series)

| Doc | Content |
|---|---|
| `../living-relationships/22-social-foundation-contracts.md` | The as-built contracts of SF-1..SF-4 (binding on future social work) |
| `../living-relationships/23-lr4-teaching-specification.md` | Implementation-ready LR-4 specification (teaching) |
| `../living-relationships/24-lr5-arthur-copperwheel-specification.md` | Implementation-ready LR-5 specification (Arthur / Copperwheel hosting) |

## Non-goals held

- No LR-3 (Clara / bakery) production code of any kind — mechanically verified by the QA round (no new `share_morning_pastry`, no `dialogue/invitations/clara.ts`, no `reconcileInvitedInteriorEntry`, no `offer_phase_closed` anywhere).
- No new persisted WorldState field; schema stays v11 (registry-only policy, D7).
- No new dialogue engine, no second memory system, no decay/currency/skill-tree mechanics.
