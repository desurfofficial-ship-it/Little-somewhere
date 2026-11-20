# 18 — Acceptance Plan Correction Report

**Corrects**: `16-lr1-lr2-acceptance-test-plan.md`  
**Against**: `17-acceptance-plan-audit.md`, with document 14 authoritative  
**No gameplay code, tests, schemas, or runtime behavior were changed.**

## Correction Map

| Audit item | Severity | Updated test ID | What changed |
|------------|----------|-----------------|--------------|
| Live sim clock does not expire | High | **LR1-19** (new) | `stepSimulationInPlace` advances across `windowEnd` via `advanceSimulationClock`. Test must not call `expireInvitationsAt`. Occupancy clears. Sim must not write occupancy. |
| LR1-05 can pass on a direct expire call | High | **LR1-05** (rewritten) | Actor is the +2h path (`handleAdvanceTwoHours` → `advanceClockAndReconcile`). Direct `expireInvitationsAt` from the test does not satisfy it. Fail-closed note added. |
| `day > expiresDay` while minute in window | Medium | **LR1-20** (new) | Conjunctive predicate. Day bound fails the invite even if the minute is inside the window. |
| Sleep while still `offered` | Medium | **LR1-11b** (new) | `advanceToNextDay` archives an offered invite. No reward. |
| Already inside when window opens | Medium | **LR2-04b** (new) | Enter before the window, advance into it, no re-enter: occupancy stays empty. Occupant appears only after exit + new `enterNookAction`. |
| Reliability +2 | Medium | **LR2-09** (extended), **LR2-10** (extended) | Complete expects affinity +6 and reliability +2. Cap at 100 covers both. `dailyAffinityGained` unchanged. |
| Teaching inside LR-2 gate | Medium | **LR2-12 removed from gate**; coverage moved to **LR4-01 / LR4-02** | §6 no longer lists teaching. §8 is explicitly not a current gate. |
| Spacing equality | Low | **LR1-09b** (new) | `day - lastOfferDay === 2` succeeds when minDays is 2. LR1-09 still tests day-1 rejection. |
| History cap | Low | **LR1-23** (new) | Terminal archive at cap drops the oldest entry and does not grow. |
| Orphan `activeActivity` | Low | **LR1-15b** (new) | Load with activity set and `active === null` clears the activity. |
| `enter_nook` vs reducer | Low | **§0 table**, **LR2-01**, **LR2-02**, **LR2-03** | Action type and `enterNookAction` (`actions.ts` ~2617) are distinguished. Pass criterion is the occupant record, not a named helper call. |
| +2h line number | Low | **§0 table** | `handleAdvanceTwoHours` cited at `App.tsx` ~837. |
| Pre-seeded memory id | Low (adjacent) | **LR2-07b** (new) | Journal already holding the activity memory id makes completion a no-op. |

## Cases Left Unchanged in Substance

LR1-01, LR1-02, LR1-03, LR1-04, LR1-06, LR1-07, LR1-08, LR1-10, LR1-11, LR1-12, LR1-14, LR1-15, LR1-16, LR1-17, LR1-18, LR2-02 (aside from naming the reducer), LR2-04, LR2-05, LR2-06, LR2-07, LR2-08, LR2-11, LR2-13, LR2-14, LR2-15, LR2-16.

LR1-13 now uses the LR1-05 path so the interrupted-session case cannot bypass the +2h requirement.

LR1-17 wording tightened so the expected schema is “current at merge + 1,” not a fixed future number.

## Gate Split

- **LR-1** now requires LR1-01–18, LR1-09b, LR1-11b, LR1-15b, LR1-19, LR1-20, LR1-23.
- **LR-2** requires those plus LR2-01–11, LR2-04b, LR2-07b, LR2-13–16.
- **LR-4** teaching cases are listed and excluded from both gates.

## Unresolved Issues

1. **Illustrative name `advanceClockAndReconcile`.** Document 14 requires every minute mutation to run expiry. It does not mandate this function name. The plan treats the name as illustrative. Implementers may use another name if `handleAdvanceTwoHours` and `stepSimulationInPlace` both reach `expireInvitationsAt` without a test calling it. Not a spec conflict.
2. **History cap value.** Document 14 says history is capped and earlier text suggested 12. The plan uses 12 unless an impl note sets another bound. If the cap number is finalized later, only LR1-23’s precondition number changes.
3. **Exit reducer name.** `exit_nook` is an action type. The plan does not cite a specific `exitNookAction` symbol because this audit did not re-verify that export. LR2-04 says “exit reducer paired with `exit_nook`.” Confirm the symbol when tests are written. Not blocking for the plan.
4. **How the sim tick should expire without becoming an occupancy writer.** Document 14 forbids `stepSimulationInPlace` from writing occupancy, but expiry must clear occupancy. The plan expects the tick to call the reconcile helper, which is allowed to clear occupancy. The split (tick calls helper; helper writes) is the intended resolution. If implementation instead expires only in a reducer wrapped around the tick, LR1-19 still passes as long as the test does not call `expireInvitationsAt` itself.
5. **Scene test remains optional.** Unchanged from doc 16. Not an unresolved defect.

No finding from document 17 is left unmapped.

## Statement

No gameplay code, tests, WorldState schemas, or runtime behavior were changed. Only `16-lr1-lr2-acceptance-test-plan.md` was updated and this report was added.
