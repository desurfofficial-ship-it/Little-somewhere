# 17 — Acceptance Plan Audit (LR-1 / LR-2)

**Role**: Independent principal engineer  
**Audited**: `14-revised-architecture.md` (authority), `15-implementation-readiness-checklist.md`, `16-lr1-lr2-acceptance-test-plan.md`  
**Verified against**: `src/game/storage.ts`, `migrations.ts`, `time.ts`, `simulation.ts`, `actions.ts`, `relationships.ts`, `memories.ts`, `bookNook.ts`, `src/App.tsx`  
**No gameplay code, tests, schemas, or documents 14–16 were modified.**

## Overall Verdict

**PASS WITH REQUIRED CORRECTIONS**

Document 16 is a usable acceptance spec. All 34 cases have the required fields. Existing-function citations that were checked are accurate, with two under-specifications. It does not yet fully lock the time-path and occupancy invariants in document 14, and one case blurs the LR-2 / LR-4 boundary. Those gaps are correctable in the plan. They are not a reason to reject the architecture.

Do not treat “34 cases exist” as implementation approval.

---

## Files Inspected

- `docs/architecture/living-relationships/14-revised-architecture.md`
- `docs/architecture/living-relationships/15-implementation-readiness-checklist.md`
- `docs/architecture/living-relationships/16-lr1-lr2-acceptance-test-plan.md`
- `src/game/storage.ts` (`advanceToNextDay`, `loadWorldState`, `saveWorldState`)
- `src/game/migrations.ts` (`CURRENT_SCHEMA_VERSION = 9`, `migrateV8ToV9`)
- `src/game/time.ts` (`NEXT_DAY_WAKE_MINUTE = 480`, `advanceSimulationClock`)
- `src/game/simulation.ts` (`stepSimulationInPlace` minute advance ~620, `createInitialNpcRuntime`)
- `src/game/actions.ts` (`enterNookAction` ~2617, `enter_nook` / `exit_nook` action types, browse ~2695, tea ~2744)
- `src/game/relationships.ts` (`DAILY_SMALLTALK_AFFINITY_CAP`, `recordPlayerTalkAffinity`, `isResidentGuarded`)
- `src/game/memories.ts` (`GOSSIP_MIN_AFFINITY = 20`, `MAX_NPC_MEMORIES_PER_RESIDENT`)
- `src/game/bookNook.ts` (`nook_chair`, nook state fields)
- `src/App.tsx` (`handleAdvanceTwoHours` ~837)

## Files Created

- `docs/architecture/living-relationships/17-acceptance-plan-audit.md` (this file)

## Confirmation

No gameplay code, tests, schemas, or documents 14–16 were changed.

---

## Source Reference Check

| Reference in doc 16 | Verdict | Evidence |
|---------------------|---------|----------|
| `advanceToNextDay` (`storage.ts`) | **Existing, accurate** | ~422. Ejects nook via `wokeInsideNook`, sets minute 480, resets `npcRuntime` via `createInitialNpcRuntime`, clears `activeEncounters`. |
| `loadWorldState` / `saveWorldState` | **Existing, accurate** | `storage.ts` ~56 / ~401 |
| `CURRENT_SCHEMA_VERSION`, `migrateV8ToV9` | **Existing, accurate** | `migrations.ts` 115, 1828. Value is 9. |
| `handleAdvanceTwoHours` | **Existing, line slightly off** | `App.tsx` ~837, not ~836. Uses `advanceSimulationClock(..., 120)` then spreads `minuteOfDay` only. Does not expire anything today. |
| `advanceSimulationClock` | **Existing, accurate** | `time.ts` ~32. Also used by `stepSimulationInPlace`. |
| `recordPlayerTalkAffinity`, cap 20, `isResidentGuarded` | **Existing, accurate** | `relationships.ts` 17, 85, 286 |
| Nook browse / tea reducers | **Existing, accurate** | `actions.ts` ~2695 (`shelfBrowsedDay`, `booksRead`), ~2744 (`teaSharedDay`, `teasShared`) |
| `enter_nook` / `exit_nook` | **Existing action types, under-specified** | Types at `actions.ts` 148–149. The reducer is `enterNookAction` (~2617). Doc 16 never names `enterNookAction`. |
| `nook_chair` | **Existing, accurate** | `bookNook.ts` ~56 |
| `GOSSIP_MIN_AFFINITY`, `MAX_NPC_MEMORIES_PER_RESIDENT` | **Existing, accurate** | `memories.ts` 44 and 33 |
| `offerInvitation`, `expireInvitationsAt`, `completeSharedActivity`, occupancy writers, `applySharedActivityAffinity` | **Proposed** | Named in doc 14. Not in the tree. Doc 16 marks them proposed. Correct. |

---

## Test-by-Test Audit

Status: **OK** = valid against doc 14. **WEAK** = fields present but assertion or path is incomplete. **BOUNDARY** = belongs to a later milestone.

| ID | Status | Notes |
|----|--------|-------|
| LR1-01 | OK | Offer creates one active `offered` invite. Matches §2. |
| LR1-02 | OK | Second offer rejected. Matches single-active rule. |
| LR1-03 | OK | Accept stays non-terminal; history unchanged. |
| LR1-04 | OK | Decline archives, nulls active, no rewards. |
| LR1-05 | WEAK | Calls expire after a manual +120. Does not prove `handleAdvanceTwoHours` itself reconciles. Doc 14 §2.4 requires the +2h path to run the predicate. |
| LR1-06 | OK | Inclusive window end. |
| LR1-07 | OK | Inclusive window start. |
| LR1-08 | OK | Guarded host rejected via existing `isResidentGuarded`. |
| LR1-09 | WEAK | Tests day-1 rejection. Does not test the equal-boundary `day - minDays` success case (default 2). |
| LR1-10 | OK | Unavailable schedule or encounter blocks offer. |
| LR1-11 | OK | Sleep on accepted invite. Matches §3, including existing nook ejection. |
| LR1-12 | OK | Expire is not a penalty. Cap reset is existing day-advance behavior. |
| LR1-13 | OK | Expire then sleep must not double-archive. |
| LR1-14 | OK | Save/load of a live offer. |
| LR1-15 | OK | Inconsistent occupancy cleared. Matches §4.3. |
| LR1-16 | OK | Corrupt host/id stripped; prior slices kept. |
| LR1-17 | OK | Uses current+1, not a hardcoded v10. Preserves v9 interiors. |
| LR1-18 | OK | Older-than-v9 still walks `migrateV8ToV9` then the LR step. |
| LR2-01 | WEAK | Says “perform `enter_nook`”. Should name `enterNookAction`. Otherwise matches set-on-enter. |
| LR2-02 | OK | Enter after expiry does not place Nora; stale accepted is archived. |
| LR2-03 | OK | Unavailable at enter expires with a visible line. Empty-visit rule. |
| LR2-04 | OK | Exit clears occupancy, keeps a still-live invite. Matches §4.2. |
| LR2-05 | OK | Counters unchanged, including `teasShared` (stronger than doc 14’s explicit list, consistent with it). Host-only memory. |
| LR2-06 | OK | Station exclusivity against browse/sit. |
| LR2-07 | OK | Second complete is a no-op. |
| LR2-08 | OK | Two callers, one writer. |
| LR2-09 | WEAK | Checks +6 and unchanged `dailyAffinityGained`. Does not assert reliability +2 from doc 14 §5.2. |
| LR2-10 | OK | Affinity clamp at 100. |
| LR2-11 | OK | Accepted invite is not declined. |
| LR2-12 | BOUNDARY | Teaching grant is LR-4 in doc 14 §10 and doc 15. Must not be an LR-2 merge blocker. |
| LR2-13 | OK | Host-only first party; gossip gate uses real `GOSSIP_MIN_AFFINITY`. |
| LR2-14 | OK | Sleep inside nook clears occupancy and archives. |
| LR2-15 | OK | Load restores a consistent live visit. |
| LR2-16 | OK | Load clears occupant on a dead window. |

**Count**: 34 cases present. 28 OK, 5 WEAK, 1 BOUNDARY. None are invalid or contradictory on their stated expected results.

---

## Missing or Weak Scenarios

Required before the plan can be the sole merge gate:

1. **Live simulation clock crosses `windowEnd`** (severity: high).  
   `stepSimulationInPlace` (`simulation.ts` ~620) advances `minuteOfDay` with `advanceSimulationClock` every unpaused frame. Doc 14 §2.4 lists “any minute mutation” as an expiry call site. Doc 16 only covers +2h and sleep. A test must advance the sim clock across the window and assert expire + occupancy clear without a manual `expireInvitationsAt` call from the test.

2. **`handleAdvanceTwoHours` is the actor** (severity: high).  
   LR1-05 can pass if a unit test calls `expireInvitationsAt` itself. The acceptance case must invoke the App handler’s reducer path (or a shared `advanceClockAndReconcile` that the handler is required to call) and fail if expiry is not inside that path.

3. **`expiresDay` already past while minute is inside the window** (severity: medium).  
   Doc 14 §2.4 is conjunctive (`day <= expiresDay` AND minute in window). No case sets `day > expiresDay` with a valid minute. Add it.

4. **Sleep while status is `offered`, not only `accepted`** (severity: medium).  
   LR1-11 uses an accepted invite. An offered invite must also archive on `advanceToNextDay`.

5. **Already inside when the window opens** (severity: medium).  
   Doc 14 §4.2 sets occupancy only in the enter reducer. If the player is already in the nook when the window starts, Nora must not appear until they exit and re-enter. Unstated in doc 16. This is an invariant test, not a new feature.

6. **Reliability +2** (severity: medium).  
   Doc 14 §5.2 specifies +2 reliability once. LR2-09 omits it.

7. **Spacing boundary** (severity: low).  
   `day - lastOfferDay === 2` must succeed when minDays is 2. LR1-09 only tests rejection at day-1.

8. **History cap** (severity: low).  
   Doc 14 archives into a capped history. No case overflows it.

9. **`activeActivity` without `active` on load** (severity: low).  
   Doc 14 §4.3 clears `activeActivity` if `active` is null. Not in LR1-15.

10. **Same memory id already in the journal** (severity: low).  
    LR2-07 covers a second call after success. A pre-seeded journal memory with that id should also make `completeSharedActivity` no-op. Worth one case; not a new system.

Not missing, and should stay out of LR-1/LR-2: bakery knead/share, Copperwheel, guest NPCs, passive owner occupancy, noticeboard reminders.

---

## Conflicts with Documents 14 and 15

| Item | Conflict | Required fix |
|------|----------|----------------|
| LR2-12 teaching | Doc 14 §10 and doc 15 place knowledge grants in LR-4. Doc 16 allows it inside LR-2. | Mark LR2-12 informational. Remove it from the LR-2 pass list in doc 16 §6. |
| Time paths | Doc 14 §2.4 requires every minute mutation to expire. Doc 16 does not bind the sim-clock path. | Add the sim-clock case; make LR1-05 assert the handler path. |
| `enterNookAction` | Doc 14 says occupancy is set in the door-enter reducer. Doc 16 names only the action-type string. | Cite `enterNookAction` (`actions.ts` ~2617) as the existing reducer the hook attaches to. |
| Line number | Doc 16 says `handleAdvanceTwoHours` ~836. | Actual is ~837. Cosmetic. |

No conflict on: single active slot, atomic archive, nook-first occupancy, +6 outside `dailyAffinityGained`, host-only memory, schema current+1, or separation of LR-1 from LR-2 in §6 (aside from LR2-12).

---

## Invariants vs Implementation Details

Most cases assert observable state (active null, history outcome, counter unchanged, affinity value). That is correct.

Weak spots that lean on implementation shape:

- LR1-05 asserts a helper call sequence rather than the user-facing +2h path.
- LR2-01 names `setOccupant` as the expected mechanism. Acceptable as an owner check from doc 14 §1, but the pass criterion should stay “occupant present and linked after `enterNookAction`,” not “a specific helper was invoked.”

No case requires a private field or a scene-graph detail. Scene occupancy is correctly optional in §5.

---

## Migration Expectations

LR1-17 and LR1-18 do **not** assume a fixed future version. They say current+1 at merge and require `migrateV8ToV9` to remain below the new step. That matches doc 14 §9 and the verified `CURRENT_SCHEMA_VERSION = 9`.

No correction required on schema numbering.

---

## Relationship Reward and Nook Counters

- **+6 once, clamp 100, no `dailyAffinityGained` change**: covered by LR2-07, LR2-09, LR2-10. Reliability +2 is the hole.
- **Offer grants 0**: covered by LR1-03 and LR1-04.
- **Browse/tea not invoked**: LR2-05 asserts `shelfBrowsedDay`, `teaSharedDay`, `booksRead`, `teasShared` unchanged. That is the right observable. It fails if completion calls the existing reducers at `actions.ts` ~2695 or ~2744. Sufficient for the counter contract.

---

## Required Corrections (by severity)

1. **High** — Add a case where `stepSimulationInPlace` clock advance crosses `windowEnd` and expiry/occupancy clear happen without the test calling `expireInvitationsAt` itself.
2. **High** — Rewrite LR1-05 so the actor is the +2h path (`handleAdvanceTwoHours` or the shared reducer it must call), not a manual expire after a clock helper.
3. **Medium** — Add `day > expiresDay` with minute inside the window; expect not live.
4. **Medium** — Add sleep-while-`offered`.
5. **Medium** — Add already-inside-when-window-opens: no occupant until re-enter.
6. **Medium** — Assert reliability +2 in the reward case.
7. **Medium** — Remove LR2-12 from the LR-2 pass gate. Teaching stays LR-4.
8. **Low** — Spacing equality case; history cap; `activeActivity` orphan on load; cite `enterNookAction`.

---

## Readiness Decisions

**LR-1 plan**: usable after corrections 2, 3, and 4. Cases LR1-01–04, 06–08, 10–18 already match doc 14. Do not start LR-1 implementation on doc 16 alone until the +2h path case is binding.

**LR-2 plan**: usable after corrections 1, 5, 6, and 7, and after LR-1 corrections. Occupancy, exclusivity, double completion, two-path completion, load, and sleep-inside are present and aligned. The sim-clock and already-inside gaps are the ones that would let a wrong integration merge.

**Implementation of the feature**: still **READY WITH EXPLICIT CONDITIONS** from doc 14/15. This audit does not upgrade that to unconditional ready, and does not block LR-1 design work. It does block treating doc 16 as a complete merge gate until the high and medium corrections are added to the plan.

---

## Conditions Before Implementation Begins

1. Document 14 remains the spec of record. Doc 16 must be updated (separately) with the high and medium corrections above before it is the LR-1/LR-2 merge checklist.
2. Schema target is `CURRENT_SCHEMA_VERSION + 1` at branch cut/rebase. Verified current is 9. Do not hardcode 10.
3. Invitation topics stay out of `narrative.ts`.
4. First occupancy target remains the nook. Teaching is not an LR-2 gate.
5. `advanceToNextDay`, the +2h path, and the sim-clock minute write must all reconcile expiry. Tests must fail if any one of them does not.
6. `completeSharedActivity` is the only completion writer and must not call the browse/tea reducers.
7. No gameplay code is written against doc 16 until those plan corrections exist.

If condition 1 or 5 is skipped, LR-2 is **NOT READY** to merge, even if all current 34 cases pass.
