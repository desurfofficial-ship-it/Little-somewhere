# 11 — Documentation Reconciliation

## §1 Principle

Preserve every historical record; add, never rewrite. The merged repository must tell one coherent engineering story: Build-10 shipped (Entry 048 at 9cde87d) → the LR ritual commit displaced it (main's Entry 048 rewrite, 4ad2e5f) → the audit documented the damage (19 docs, preserved outside the repo) → the corrective operation restored it and recorded why (docs 01–14 here, WORKLOG 051–052).

## §2 What was recovered, what was preserved, what was newly written

| Record | Disposition |
|---|---|
| 19-document LR audit (`living-relationships-reconciliation/`) | **Preserved outside the repo** (`audit-preserve/`), untouched. Referenced by the recovery docs; not copied into the repo (the branch's docs are evidence-backed summaries with exact pointers). |
| Decision records 20/21 (PR #3 only) | **Recovered byte-identically** onto main's doc series (`docs/architecture/living-relationships/20-…`, `21-…`; verified `diff`-identical to `d615a8e`). Provenance noted in `00-index.md`. PR #3 itself untouched (open/draft). |
| `00-index.md` (living-relationships) | **Extended** — the index stopped at doc 12 ("Design only"); added the 13–21 implementation/decision table + pointer to the corrective package. No existing row edited except none (the stale "Design only" status lived in the index's implicit framing; the new table supersedes it explicitly). |
| Corrective records 01–12 | **Regenerated with real evidence** (the lost originals were never committed). Every claim cites commits, test names, SHAs, or measured numbers from this initiative. |
| WORKLOG | Main's Entries 001–050 **verbatim** (including the historical 048 rewrite — it is part of the record and is corrected *by* Entries 051/052, not by editing 048). Corrective **Entries 051–052 appended**. Entry 048's stale "361/361" test count is left as written (historical record); §17 of HANDOVER and doc 01 carry the accurate counts. |
| HANDOVER | §16's tolerant-predicate contract bullet **amended in place with an explicit supersession note** (HANDOVER is the living operational brief, not an archive — a contract that no longer holds must not keep being handed to new agents); **§17 appended** with the as-built contracts, regression-suite list, and deferred register pointer. §2 "Where to Read First" unchanged (the new §17 carries the routing, keeping the edit surface minimal). |
| PR #3 | Untouched (open/draft, head `d615a8e`). Its decision content lives on main via the byte-identical doc recovery. |

## §3 Cross-reference integrity checks (all verified)

- Every code citation to "build10-lr-recovery doc NN §M" resolves to a file on this branch (the architecture auditor flagged this as an actionable gap **before** the docs landed; closed by this package).
- Doc 21's internal references to "Entry 049"/"HANDOVER §16" describe the **PR #3 branch's own** numbering — preserved verbatim as an archival record; the provenance note in `00-index.md` and doc 13 §1/§3 prevents misreading them as main's numbering.
- No duplicate WORKLOG entries (051/052 unique; main's 048–050 untouched); no broken relative links in the new docs; no stale test counts presented as current (425/425 appears only in verification-status sections).
- The golden snapshot change is documented in THREE coherent places (doc 04 §2 justification, commit message, BD10-11 pin) — a snapshot is never the only evidence of correctness.
