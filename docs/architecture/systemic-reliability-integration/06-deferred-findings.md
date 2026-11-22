# 06 — Deferred Findings

Every deferral carries severity, the evidence that justified deferring, and the conditions for reopening. Nothing here is a known regression; nothing blocks the integration.

## R2-S-01 — absent/undefined `invitationId` on a persisted `activeActivity` slice is canonicalized silently — P3, deferred

- **State**: a record-shaped slice whose `invitationId` key is absent (or explicitly `undefined`) is kept and value-completed to the live invitation's id with zero warnings (`migrations.ts` step-2 back-compat clause `rawAct.invitationId === undefined`).
- **Why deferred**: the tolerance predates the initiative (present on main, unchanged by the integration); unreachable from production writers (every writer sets the id; `JSON.stringify` drops undefined); value-preserving (the slice is completed to the true id, no information lost — strictly weaker than a drop). Changing it would alter pre-existing main behavior for zero production benefit.
- **Revisit when**: the slice schema next changes, or if an owner wants strict-shape persistence (one-line warning + test, mirroring SR-2d/2e).

## SR-11 — Journal/UI freshness gap (F-UX-1) — P3, deferred (carried from the original initiative)

- **State**: a tick-granted discovery reaches the Pocket Journal at the next world-committing action (memo deps; step-0 grant discarded). Zero state-integrity impact — the persisted state is correct.
- **Revisit when**: the next UI pass touches `JournalDrawer`/`commitWorld`.

## SR-12 — per-tick O(n) memories scan on the discovery path — P3, deferred (carried)

- **Why deferred**: structurally bounded by the cap (≤96 rows ≈ ≤0.8 µs measured ≈8.5 ns/row); a keyed index is complexity without measurable payoff at this size.
- **Revisit when**: the cap is lowered below the ≈58-row content ceiling (gated by J-5) or the discovery registry grows by an order of magnitude.

## SR-14 — Journal view rebuilds while closed — P3, deferred (carried)

- **Why deferred**: micro-optimization (79–116 µs + 0.18 µs/row per commit, headless-only measurement); no correctness impact.
- **Revisit when**: a render-profiling pass shows it on the critical path.

## F-ENTER-1 — enter-reducer asymmetry — P3, deferred (carried; contract note stands)

- **State**: only `enterNookAction` reconciles invitation expiry on room entry; cottage/greenhouse/bakery/copperwheel enters do not.
- **Why deferred**: harmless today — no invite-gated activity exists outside the nook.
- **Revisit when**: a second interior gains an invitation-gated activity (this is also LR-3's F-ENTER-1 trigger — the LR-3 design record on PR #8 owns that investigation; **this integration does not implement it**).

## F-PRED-1, F-WORLD-1, F-ASSET-1, F-DOC-1 — carried as documented

- F-PRED-1 (inline-predicate coverage): backstop empirically airtight (`staleInvitationSeen = 0` across all harness scenarios).
- F-WORLD-1 (QA-staging methodology note): no code change justified; preserved as written.
- F-ASSET-1 (~9.4 MB QA PNGs from PR #4 main-only asset work): out of scope; unrelated to simulation reliability.
- F-DOC-1 (WORKLOG Entry 048 stale test count): historical record preserved per the no-history-rewrite policy.

## Rejected (not deferred) — recorded so nobody re-proposes without new evidence

- Generic counter ceilings for `day` / `familiarity` / `bellRungCount` (AR-4 pins the accept behavior).
- Occupancy/`activeActivity` unit-clear (rejected against doc 14 §4.3 / LR1-15b; the shipped anchor rule is the contract of record).
- Recent-entry retention + historical summaries / authoritative-event-state split for the journal (no authoritative event consumer; schema bump for zero current benefit).
- Treating present-but-invalid `schemaVersion` claims as v11 (invents a version; masks corruption — the tombstone-backed reject-to-fresh is strictly safer).

## Non-blocking follow-ups owned by this record

1. Re-run `scripts/qa_sri_browser.sh` on target hardware before release (browser evidence for the integrated tree; unit + stress coverage already pins the same contracts — see doc 05 §4).
2. Optional one-line strictness follow-up for R2-S-01 (warn when a record-shaped slice lacks `invitationId`) if strict-shape persistence is ever wanted.
3. The LR-3 decision-register follow-up action in `08-lr3-d10-owner-decision-record.md` (apply the recorded D10 approval to PR #8's register when the LR-3 implementation initiative opens — do **not** edit the PR #8 branch before then).
