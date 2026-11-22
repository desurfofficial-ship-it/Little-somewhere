# LR-3 Requirement Traceability Matrix

Requirement → implementation location → test → evidence, audited on `main` @ `8e08d3b`.
Scope items S1–S8 are the authorized LR-3 scope (doc 03 §1); battery areas are doc 06 §1–§10 (98 scenarios LR3-01…98).
Status vocabulary per campaign §9: **PASS** (executed and passed) · **FAIL** (executed and failed) · **BLOCKED** (cannot execute — dependency missing) · **INSPECTED** (reviewed, not behaviorally verified).

## 1. Scope items S1–S8

| Req | Requirement (source) | Planned implementation location (doc 05 §4, re-based) | Implementation status | Existing foundation test coverage (verified on main) | Battery |
|---|---|---|---|---|---|
| S1 | Player+Clara enter bakery interior on accepted invitation; coherent exit (doc 03 §1 S1) | `actions.ts` `enterBakeryAction` (now :2724-2748) / `exitBakeryAction` (:2750-2767) via shared `reconcileInvitedInteriorEntry` helper (D5, F-ENTER-1) | **ABSENT — BLOCKED** (enter is reconciliation-free today, verified) | Nook precedent pinned: LR2-01…04, LR2-04b/bis (`occupancy.test.ts`), LRTL-01/02/04/06 (`lr-tick-load.test.ts`); QA-F-07 (day-advance sweep) | LR3-13–22, 87–92 |
| S2 | `share_morning_pastry` registration + completion transaction (doc 03 §1 S2) | `activities.ts` `SHARED_ACTIVITIES` (:52, def fields :31-50 — **not** types.ts, QA-15) | **ABSENT — BLOCKED** (registry has exactly one def, `share_featured_reading`) | Transaction chassis pinned: QA-F-03/04/05 (refusal ladder, purity/atomicity, duplicate refusal); LR2-05/07/09-10 (`activities.test.ts`) | LR3-01/11/12/44/45/46 |
| S3 | Station exclusivity: claimed station refuses knead/share/oven/solo-sit with zero bakeryState mutation (doc 03 §1 S3) | three bakery ritual reducers (:2800/:2843/:2888) + sit-suppression branch (mirror :993-1002) + `bakery_cafe_table` card anchor (mirror nook_chair :3131-3153) | **ABSENT — BLOCKED**; adversarially confirmed absent: ritual reducers mutate under a synthetic claimed station (Specialist C probe P4), bakery chair sits under claim (probe P5a) | Nook-side suppression pinned (LR2-06, `activities.test.ts:111-130`); G-3 range assert pinned (`player.test.ts:270/369`, `cottage.test.ts:392`); **no bakery-side test exists (expected — gap G1/C-1)** | LR3-23–32, 84 |
| S4 | Clara schedule gate + morning-only offers (D10 owner-approved `offerPhases: ['morning']`) | `invitations.ts` `canOfferInvitation` gate ladder (:159-199, unchanged); def `offerPhases` slot | **ABSENT — BLOCKED**; schedule facts VERIFIED: 1.020/8.938/5.533/0.0 m, cap 719 re-derived + pinned (QA-F-02) | Gate order + spacing pinned (LR1-01/02/09/09b); `computeOfferWindow` itself has **zero direct tests** (gap B-5) | LR3-02/03/11/18/19/50/86 |
| S5 | Clara dialogue quartet (offer/pending/indoor/reminder) + golden snapshot regen | NEW `src/game/dialogue/invitations/clara.ts` + `INVITATION_TOPICS` spread (`dialogue/invitations/index.ts:4-6` → `dialogue/index.ts:42-70`) + `scripts/dialogue-topics-golden.json` regen | **ABSENT — BLOCKED**; quartet pattern + condition evaluator verified (`dialogueEngine.ts:502-531`, drifted from doc's :473-505) | Golden mechanism pinned (`dialogueRegistry.test.ts:44-112`, BD10-10/11); **golden count is 86, docs say 85→89 — correct math 86→90 (QA-05)** | LR3-49–56, 98 |
| S6 | Truthful venue text: accept toast (D6), completion summaries (D9), refusal card | `actions.ts:908` toast hardcode; `activities.ts:214/223/231/281` Nora-only strings | **ABSENT — BLOCKED (hardcodes confirmed live, byte-identical to doc anchors)** | **No test pins the toast or completion strings today** (gap B-6) — LR3-87/88 will be the first pins | LR3-45/46/87/88 |
| S7 | Persistence: registry-only, no schema bump, save/load round-trips (D7 + binding stop-rule) | no migration; existing v12 maps (`lastOfferDayByHost`, `occupancy`, `activeActivity`, invitations slice) | **ABSENT — BLOCKED for Clara rows**; chassis verified: sanitizer generic host check `migrations.ts:1613`, SR-7 `:1779-1780`, G-2 future-schema gate intact (`storage.ts:74-88/135-149/570-572/583-590`) | save-integrity 37/37, migrations-guard 5/5, storage 21/21, LR1-14, LR2-15/16, LRTL suite; **schema baseline is now v12 — docs' "v11" claims superseded (QA-02)** | LR3-33/66–73/89/90/93/94 |
| S8 | Cross-venue regression: Book Nook byte-identical after helper refactor + interleaving | `enterNookAction` :3020-3094 refactor target; battery §6 mandatory interleaved rows | **ABSENT — BLOCKED** (helper not yet extracted; nook path untouched today) | Nook suites green (bookNook 17/17, occupancy 8/8, activities LR2 rows) — verified this campaign | LR3-13–21/72/75–85 |

## 2. Foundation contracts the implementation inherits (verified this campaign)

| Contract | Test/evidence | Status |
|---|---|---|
| Completion transaction purity (input never mutated) | QA-F-04 + Specialist A probe P4 | PASS |
| Refusal ladder order and reason strings | QA-F-03; SF2-01 label map; Specialist A probes P1/P2/P6 | PASS |
| Duplicate completion refused, grants nothing | QA-F-05 + LR2-07 | PASS |
| Single global occupancy slot; location-scoped lookups | QA-F-06; Specialist C probes P9 | PASS |
| Day-advance force-archive (`expired`/`day_end`) | QA-F-07; LR2-14; Specialist D probe P5 | PASS |
| Tick reconciler expires mid-window; seated host tick-skipped | LRTL suite; `simulation.ts` occupant skip (verified) | PASS |
| Away-afternoon window cap 719 (offer-time stamp) | QA-F-02 (first pin — previously untested, gap B-5) | PASS |
| Phase minute boundaries 360/689/690/959/960/1109/1110/1290 | QA-F-01 (previously incidental only) | PASS |
| Bakery seat anchor (D3): `bakery_seat_cafe_west`, seatPos (0.73,1.45), approach (−0.2,1.4), facing π/2, indoor | QA-F-08 | PASS |
| Sanitizer host/def/station/window/expiresDay validation (generic) | save-integrity 37/37; Specialist D citation check (:1613/:1779-1780) | PASS |
| G-2 future-schema refusal + autosave block + tombstone | `storage.ts` union verified by inspection + inherited suite; **direct refusal-branch pins still missing** (gap D-1/2) | PASS (suite) / INSPECTED (branch) |
| Bounded growth: npcMemories ≤14/resident, journal ≤96, history ≤12, worldEvents ≤40, lastOfferDayByHost ≤10 keys | longrun_stress (npcMem ceiling 140 hit exactly); migrations caps | PASS |
| Determinism: seeded replay, tick double-run, save/reload twin | BD10-08/09, longrun_stress `F_deterministic_replay` byte-identical | PASS (caveat QA-14e: `Date.now` cooldown actions documented-exception) |

## 3. Coverage-gap ledger (requirements with NO meaningful verification today)

Foundation-side gaps the campaign confirmed (battery ids in parentheses are the prepared owners):

1. Completion-refusal battery vs `completeSharedActivity` (`wrong_location`, `occupant_not_present`, `host_mismatch`, …) — only reason strings exist in a label map today (LR3-38/84).
2. Stale-occupancy-with-mismatched-`invitationId` completion (LR3-84; occupancy triple as completion authority).
3. Occupancy released between claim and completion while `activeActivity` lingers (LR3-92 G1).
4. `favorsCompleted` +1 side effect (QA-11 — unpinned either way).
5. Refused-completion dialogue topic-history burn (QA-12).
6. Guard-order pins (encounter-vs-idempotency; committed-duplicate reason) (QA-13).
7. `computeOfferWindow` direct shape table incl. golden/dusk `max(now+90,1260)` rule and 360 floor (LR3-01).
8. `offer_phase_closed` label presence — SF2-01's hardcoded 17-item list cannot catch its omission (QA-04).
9. Cross-venue sit validation (QA-03 — currently false-verified: the distance guard passes accidentally).
10. Bakery-scoped occupancy lifecycle (exit release, day sweep) — nook-only today (LR3-22).
11. App.tsx station-card completion path (LR3-36 dual-surface deep-compare) — zero coverage.
12. Save-path warning parity beyond the memories trim; `computeWorldSaveRevision` occupancy-localPos omission (LR3-90/94 region).

All twelve are carried into `lr3-adversarial-test-matrix.md` with prepared specs.
