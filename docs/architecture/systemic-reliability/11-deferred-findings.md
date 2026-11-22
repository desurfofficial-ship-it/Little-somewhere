# 11 — Deferred Findings

Every deferral below carries its severity, the evidence that justified deferring (not ignoring), and what evidence would justify revisiting. Nothing here is a known regression.

## SR-11 — Journal/UI freshness gap (register F-UX-1) — P3, deferred

- **State:** a tick-granted discovery reaches the Pocket Journal only at the next world-committing action (memo deps `[world, seenKeys]`; identity changes only in `commitWorld`; step-0 grant discarded).
- **Why deferred:** pure UX freshness; zero state-integrity impact (the persisted state is correct — the UI reads it late). The register's deferral rationale was re-validated on current code (doc 02 §SR-11).
- **Revisit when:** the next UI-pass touches `JournalDrawer`/`commitWorld`; the fix is a revision counter or commit-on-grant.

## SR-12 — Per-tick O(n) memories scan on the discovery-grant path — P3, deferred

- **State:** `exploration.ts` scans `world.memories` per candidate tick (~8.5 ns/row measured).
- **Why deferred:** structurally resolved by the cap — the scan is bounded to ≤ 96 rows ≈ ≤ 0.8 µs (doc 05 §5); a keyed index is complexity without a measurable payoff at this size.
- **Revisit when:** the cap is ever lowered (gated by J-5) or the discovery registry grows by an order of magnitude.

## SR-14 — Journal view rebuilds while closed — P3, deferred

- **State:** `JournalDrawer` projection hooks run before the `!open` early return (79–116 µs + 0.18 µs/row per commit).
- **Why deferred:** micro-optimization; no correctness impact; headless measurement only.
- **Revisit when:** a render-profiling pass shows it on the critical path.

## F-ENTER-1 — Enter-reducer asymmetry — P3, deferred (contract note stands)

- **State:** only `enterNookAction` reconciles invitation expiry on room entry; cottage/greenhouse/bakery/copperwheel enters do not.
- **Why deferred:** harmless today — no invite-gated activity exists outside the nook; the HANDOVER §17 contract note documents the invariant for future interiors.
- **Revisit when:** a second interior gains an invitation-gated activity (then the reconciliation should move to the shared enter path).

## F-PRED-1 — Inline-predicate coverage — P3, deferred (backstop verified)

- **State:** the strict-predicate unification (D-03) already makes invitation semantics well-defined; the harness measured `staleInvitationSeen = 0` across all scenarios including invitation pressure.
- **Why deferred:** the backstop is empirically airtight; additional inline predicates would duplicate the single-predicate design.

## F-WORLD-1 / F-ASSET-1 / F-DOC-1 — carried as documented

- **F-WORLD-1** (QA-staging methodology note): no code change justified; preserved as written.
- **F-ASSET-1** (~9.4 MB QA PNGs from PR #4 main-only asset work): out of scope per register; unrelated to simulation reliability.
- **F-DOC-1** (WORKLOG Entry 048 stale test count): historical record preserved as written per the no-history-rewrite policy.

## Rejected (not deferred) — recorded so nobody re-proposes them without new evidence

- **Generic counter ceilings for `day` / `familiarity` / `bellRungCount`:** production writers leave these legitimately unbounded; sanitizer clamps would corrupt legitimate long saves (AR-4 pins the accept behavior).
- **Occupancy/`activeActivity` unit-clear:** rejected against doc 14 §4.3 / LR1-15b (doc 06 §3 is the contract of record).
- **Recent-entry retention + historical summaries / authoritative-event-state split for the journal:** rejected in doc 03 §1 (no authoritative event consumer; schema bump for zero current benefit).

## Follow-up gate

- **J-5 (doc 03 §1):** lowering `JOURNAL_MEMORY_CAP` below the ≈58-row content ceiling is permitted only after the presence-keyed dedup guards and cottage-memento lookups are re-anchored to `sideFlags` unlock markers.
