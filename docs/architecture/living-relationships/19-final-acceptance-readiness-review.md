# 19 — Final Acceptance Readiness Review

**Role**: Independent verification of the corrected LR-1/LR-2 acceptance plan  
**Authority**: `14-revised-architecture.md`  
**Reviewed**: documents 14, 15, 16 (revised), 17, 18  
**Documents 14–18 were not modified. No gameplay code, tests, schemas, or runtime behavior were changed.**

## Overall Verdict

**READY FOR IMPLEMENTATION PLANNING**

Every high and medium finding in document 17 is addressed in document 16. LR-1 and LR-2 have separate, objective gates. Path cases cannot pass by calling `expireInvitationsAt` from the test. Teaching is outside both gates.

One low assumption remains: LR1-23’s cap number 12 comes from superseded document 03, not from document 14. It does not block planning. It must be bound to the implementation’s exported cap before that test is written.

This verdict authorizes planning and test authoring. It does not authorize feature code, and it does not mark document 14’s implementation conditions as already satisfied.

---

## Correction-by-Correction Verification

| # | Document 17 finding | Required fix | Document 16 result | Status |
|---|---------------------|--------------|--------------------|--------|
| 1 | Live sim clock never expires | Case that uses `stepSimulationInPlace` across `windowEnd` without the test calling `expireInvitationsAt` | **LR1-19**. Calls `stepSimulationInPlace`. Fail-closed if expiry is only proven by a direct helper call. Occupancy must clear. Tick must not write occupancy. | **Addressed** |
| 2 | LR1-05 could pass on a manual expire | Actor must be the +2h path | **LR1-05** rewritten. Actor is the entry `handleAdvanceTwoHours` (`App.tsx` ~837) must use (`advanceClockAndReconcile` or equivalent). Direct `expireInvitationsAt` does not satisfy it. | **Addressed** |
| 3 | `day > expiresDay` with minute inside window | Conjunctive predicate case | **LR1-20**. `expiresDay = day - 1`, minute inside window, `isInvitationLive` false, then archive. | **Addressed** |
| 4 | Sleep while `offered` | Day-advance case for non-accepted invite | **LR1-11b**. `advanceToNextDay` archives `offered`, no reward. | **Addressed** |
| 5 | Already inside when window opens | No retroactive occupancy | **LR2-04b**. Enter via `enterNookAction` before the window, advance with the LR1-05 or LR1-19 path, no re-enter: occupancy stays empty. Occupant only after exit and a new enter. | **Addressed** |
| 6 | Reliability +2 missing | Reward case must assert it | **LR2-09** expects affinity 50→56, reliability 40→42, `dailyAffinityGained` stays 20. **LR2-10** clamps both at 100. **LR2-07** repeats neither. | **Addressed** |
| 7 | Teaching inside LR-2 | Remove from the gate; keep as LR-4 | **LR2-12** removed from §6. §6 states teaching is not part of either gate. §8 holds **LR4-01** and **LR4-02** only. | **Addressed** |
| 8 | Spacing equality, history cap, orphan activity, `enterNookAction` | Add or cite | **LR1-09b** (day − 2 succeeds). **LR1-23** (cap). **LR1-15b** (orphan `activeActivity`). §0 and LR2-01/02/03 distinguish `enter_nook` (action type) from `enterNookAction` (~2617). | **Addressed, with one assumption on the cap number** |

No document 17 finding is unmapped.

---

## Specific Checks Requested

### LR1-19 — live simulation clock
Verified. The action is `stepSimulationInPlace` (`simulation.ts` ~604, minute write ~620). The test is forbidden from calling `expireInvitationsAt`. A passing helper unit test does not satisfy the case. This is the production clock path.

### LR1-05 — +2h reconciliation
Verified. The actor is the entry `handleAdvanceTwoHours` must call after wiring, not a test-local expire. Expected results cover minute advance, `active === null`, history `expired`, occupancy empty, and no affinity change. Fail-closed if the handler still only spreads `minuteOfDay`.

`handleAdvanceTwoHours` is a React callback. The plan correctly targets the shared reducer it must use. That matches document 17’s wording (“or the shared reducer it must call”).

### LR1-20 — expiresDay independent of the minute window
Verified. Preconditions put the minute inside the window and the day past `expiresDay`. Expected: not live. Matches document 14 §2.4 (conjunctive predicate). The following archive call is a predicate-case cleanup, not a substitute for LR1-05 or LR1-19.

### LR1-11b — sleep while offered
Verified. `advanceToNextDay` (`storage.ts` ~422) is the actor. Offered invite is archived `expired`. No affinity, no memory.

### LR2-04b — no retroactive occupancy
Verified. Player is already inside via `enterNookAction` before the window. Time advance uses a path case. Occupancy stays empty until exit and a new enter. Matches document 14 §4.2 (occupancy set only on enter).

### LR2-09 and LR2-10 — rewards
Verified against document 14 §5.2.

- +6 affinity once (50→56; second complete in LR2-07 does not add again)
- +2 reliability once (40→42; LR2-10 clamps 99→100)
- Affinity cannot exceed 100 (97→100)
- `dailyAffinityGained` unchanged at the smalltalk cap of 20
- Offer/accept add 0

### LR1-23 — history cap
**Partially verified.** Document 14 requires history to be capped. It does not set the number. Document 03 proposed 12 and is superseded by document 14. Document 16 uses “12 unless the impl doc sets another bound.” Behavior (no growth, oldest dropped, new entry kept) is the authoritative requirement. The literal 12 is not.

### LR2-07b — memory id uniqueness
Verified. A pre-seeded journal memory with the activity id makes `completeSharedActivity` return `ok: false`. No second memory, no affinity or reliability change, no double archive. Ownership stays with that single function.

### Teaching
Verified outside the gates. §6 and §7 exclude it. §8 is marked not a current gate. Knowledge grants remain LR-4 per document 14 §10.

### Existing vs proposed
Verified in §0 and §0.1. Existing: `advanceToNextDay`, `loadWorldState`, `saveWorldState`, `handleAdvanceTwoHours`, `advanceSimulationClock`, `stepSimulationInPlace`, `recordPlayerTalkAffinity`, `isResidentGuarded`, nook browse/tea reducers, `enterNookAction`, `enter_nook` / `exit_nook` as action types. Proposed: invitation, occupancy, and activity owners, including illustrative `advanceClockAndReconcile`.

### No bypass of protected paths
Verified for the two path cases. §0 states that calling `expireInvitationsAt` from a test does not satisfy LR1-05 or LR1-19. Both cases repeat the fail-closed rule. Other cases that call proposed owners directly are unit cases of those owners, which is correct.

### Independent gates
Verified. LR-1 requires LR1-01–18 plus LR1-09b, LR1-11b, LR1-15b, LR1-19, LR1-20, LR1-23. LR-2 requires all of LR-1 plus LR2-01–11, LR2-04b, LR2-07b, LR2-13–16. Teaching is in neither list.

---

## Remaining Contradictions and Unsupported Assumptions

1. **History cap number (unsupported assumption, low).**  
   LR1-23’s “12” is from document 03. Document 14 only says “capped.” Before the test is written, bind it to the exported cap constant. Do not treat 12 as architectural law. Document 18 already notes this. Not a contradiction with document 14’s required behavior.

2. **`advanceClockAndReconcile` is illustrative.**  
   Document 14 does not name it. Document 16 and 18 say any equivalent shared entry is acceptable if both `handleAdvanceTwoHours` and `stepSimulationInPlace` reach expiry without the test calling the helper. Not a contradiction.

3. **Exit reducer symbol.**  
   LR2-04 names the `exit_nook` action type and “its paired reducer.” `enterNookAction` was verified; the exit export was not re-checked in this review. Confirm the symbol when tests are written. Not a plan defect.

4. **Sim tick vs occupancy writer.**  
   Document 14 forbids `stepSimulationInPlace` from writing occupancy, and requires minute mutation to expire. Document 16 resolves this by having the tick call the reconcile helper, which may clear occupancy. Consistent with document 14 §1 and §4.2.

No other contradiction with documents 14 or 15 was found. Schema language remains “current at merge + 1.” Canonical version is still 9. No future version is hardcoded.

---

## Readiness Decisions

**LR-1**: **Ready for implementation planning.** Lifecycle, day advance, +2h path, sim-clock path, `expiresDay`, spacing, sleep-while-offered, save/load, migration, and history-cap behavior are specified with objective pass/fail. Planning and test authoring may start. Feature code waits on document 14’s conditions.

**LR-2**: **Ready for implementation planning.** Occupancy, no retroactive appear, exclusivity, double completion, two paths, rewards, memory ownership, and load/sleep cases are specified. It stays downstream of LR-1. Teaching is not in this gate.

---

## Document 14 Implementation Conditions

These are **not yet satisfied**. They are the conditions for writing feature code, not for planning.

| Condition (document 14 §13 / 15 §1) | Status |
|-------------------------------------|--------|
| Document 14 is the spec of record | **Met by the plan.** Doc 16 states it. |
| Schema version read from `CURRENT_SCHEMA_VERSION` at branch cut; never hardcoded | **Met by the plan.** Still a merge-time action. |
| LR-2 acceptance tests exist and fail before feature code, then pass before merge | **Not met.** The plan specifies them. They are not implemented. |
| Invitation topics stay out of `narrative.ts` | **Not yet applicable.** No topics have been added. Still binding. |
| Occupancy and completion have only the named owners | **Met by the plan.** Not yet true in code. |

Implementation of LR-1/LR-2 feature code remains **READY WITH EXPLICIT CONDITIONS** until those conditions are met. This review does not upgrade that to unconditional implementation approval.

---

## File-Change Report

**Inspected**

- `docs/architecture/living-relationships/14-revised-architecture.md`
- `docs/architecture/living-relationships/15-implementation-readiness-checklist.md`
- `docs/architecture/living-relationships/16-lr1-lr2-acceptance-test-plan.md`
- `docs/architecture/living-relationships/17-acceptance-plan-audit.md`
- `docs/architecture/living-relationships/18-acceptance-plan-correction-report.md`

**Created**

- `docs/architecture/living-relationships/19-final-acceptance-readiness-review.md`

**Modified**

- None. Documents 14–18 were not edited. No gameplay code, tests, schemas, or runtime behavior were changed.
