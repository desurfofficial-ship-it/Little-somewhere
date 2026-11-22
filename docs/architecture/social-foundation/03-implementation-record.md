# 03 — Implementation Record

- **Base**: main `a80a220` (post PR #12). Baseline re-verified before any change: **528/528**, `tsc` clean, build green.
- **Result**: **588/588** (+60 new), `tsc` clean, `vite build` green (pre-existing chunk-size warning EL-10 unchanged).

## File map

| File | Change class | Content |
|---|---|---|
| `src/game/socialProfile.ts` | **NEW (SF-1)** | Derived composite relationship layer: canonical affinity accessor, knowledge-boundary predicate (lockstep-mirrored), familiarity bands, feeling resolution, shared-history ledger, NPC bond web + suppressed-pair queries, both unlock readings, composite profile, coherence probes |
| `src/game/invitationFramework.ts` | **NEW (SF-2)** | Reason-label map, player-initiated cancellation (offered→decline contract; accepted→forced expiry with machine reason), registry-wide capability rows, host readiness, derived ledger |
| `src/game/emergentStories.ts` | **NEW (SF-3)** | Seven emergent seed archetypes (derive-only, knowledge-boundary-safe, deterministic, capped 6) + People-card chapter derivation |
| `src/game/dialogueContext.ts` | **NEW (SF-4)** | Conversation context snapshot, band-clamped context boosts (R1 echo / R2 reunion), debug description |
| `src/game/dialogue/everyday/reflections.ts` | **NEW (content)** | `everyday_shared_visit_echo` — memory-callback reflection over the speaker's own unmentioned shared-visit memory (append-only registry tail) |
| `src/game/dialogueEngine.ts` | **ADDITIVE** | (1) export `CATEGORY_PRIORITY`; (2) optional 6th `contextBoosts` param on `selectDialogueSession` (undefined = byte-identical legacy); (3) new condition `requiresWitnessedEvent` (actor + memory bound); (4) surfaced-memory branch for the echo topic |
| `src/game/types.ts` | **ADDITIVE** | `DialogueCondition.requiresWitnessedEvent` optional field (+ doc comment). No WorldState change — schema stays v11 |
| `src/game/narrative.ts` | **ADDITIVE** | `buildResidentDialogue` computes boosts via SF-4 and forwards them (single production composition point; 3-arg signature preserved) |
| `src/game/dialogue/index.ts` | **ADDITIVE** | `REFLECTION_TOPICS` appended at the registry tail (append-only ordering contract) |
| `src/game/journal.ts` | **ADDITIVE** | `JournalPersonCard.chapter?` field + derivation call in the met branch (unmet stub untouched) |
| `src/components/JournalDrawer.tsx` | **ADDITIVE** | Chapter line rendered after personality (italic, muted ink token) |
| `scripts/dialogue-topics-golden.json` | **REGENERATED** | 85 → 86 topics; appended tail only; justification in `22-social-foundation-contracts.md` §5 |
| `src/game/socialProfile.test.ts` | **NEW** | 20 tests (SF1-01..20) |
| `src/game/invitationFramework.test.ts` | **NEW** | 13 tests (SF2-01..13) |
| `src/game/emergentStories.test.ts` | **NEW** | 16 tests (SF3-01..16) |
| `src/game/dialogueContext.test.ts` | **NEW** | 11 tests (SF4-01..11) |
| `docs/architecture/social-foundation/00..04` | **NEW** | Initiative record |
| `docs/architecture/living-relationships/22,23,24` | **NEW** | Contracts + LR-4/LR-5 specs |
| `WORKLOG.md`, `HANDOVER.md` | **APPENDED** | Entry 058 / §20 |

**Explicitly untouched**: `invitations.ts`, `activities.ts`, `occupancy.ts`, `simulation.ts`, `actions.ts`, `migrations.ts`, `storage.ts` (the LR-1/LR-2/LR-3 chassis and the persistence boundary), all scene builders, all resident schedules, the tick path, every existing test file. The golden snapshot is the only existing data file regenerated (sanctioned workflow).

## Import graph (acyclic, verified by tsc)

```
dialogueContext ─→ dialogueEngine, socialProfile, relationships, residents, memories
socialProfile  ─→ relationships, residents, activities, memories          (leaf-consumer)
emergentStories ─→ socialProfile, relationships, residents, invitations, memories
invitationFramework ─→ invitations, activities, socialProfile, relationships, residents, time
journal ─→ emergentStories (+ existing deps)
narrative ─→ dialogueContext (+ existing deps)
occupancy.ts remains a leaf; activities.ts's inlined window check untouched (cycle avoidance)
```

## Gate evidence (this tree)

1. `npm test` — **588/588 passing, 0 failures** (528 baseline suites unmodified and green + 60 new SF suites).
2. `npx tsc --noEmit` — **0 errors**.
3. `npm run build` — **green** (pre-existing chunk-size warning EL-10 unchanged).
4. Live browser QA — see `04-adversarial-qa.md` (journal chapter render, desktop + mobile).
