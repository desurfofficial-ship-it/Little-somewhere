# 10 — Final Verification Report

**Status:** initiative complete with non-blocking deferred findings (doc 11). All gates below were re-run on the final tree of this branch.

## A. Repository state

| Item | Value |
|---|---|
| Initiative branch | `feat/systemic-reliability` (dedicated worktree `/home/z/my-project/little-somewhere-sri`) |
| Base | verified `origin/main` = `545e323` (PR #5 merge `5681eec` + doc 14 addendum; verified against the live remote at initiative start — doc 01 §1) |
| Working tree | clean at every recorded checkpoint (mutations applied and reverted with verified clean tree) |
| PR #3 / PR #5 | untouched (directive compliance: not closed, not modified; PR #5 history unaltered) |
| Publication | branch committed locally and preserved (`ec93aba` tip); **push blocked** — `git push` fails with `could not read Username for 'https://github.com': No such device or address` (no credential helper configured, no `gh` CLI, no `GH_TOKEN`/`GITHUB_TOKEN` in the environment; the PAT supplied in a prior session was never stored and is not available). Nothing has been published; the draft PR remains to be opened once credentials exist (see WORKLOG Entry 053) |

## B. Findings → resolution summary

| ID | Severity | Resolution | Where |
|---|---|---|---|
| SR-1 (F-SAVE-3) | P2 | implemented — `JOURNAL_MEMORY_CAP=96` at the sanitizer choke point + read-key symmetry (SR-13) | `7a24293`; doc 05 |
| SR-2 | P1 | implemented — orphan rule observable + occupancy anchored + deterministic restore (contract of record doc 14 §4.3; the audit's unit-clear was adversarially rejected) | `7a24293`; docs 06 §3, 09 §1 |
| SR-3 | P1 | implemented — reference resolution, drop+warn, re-key; re-key collisions collapsed keep-first + warned (AR-2) | `7a24293` + AR round |
| SR-4 | P1 | implemented — unknown storyline keys dropped + warned | `7a24293` |
| SR-5 | P1→P2 | implemented subset (invitation temporal sanity) + generic counter ceilings rejected with production evidence (AR-4 pin) | `7a24293`; docs 06 §4, 09 §3-2 |
| SR-6 (F-SAVE-1) | P3 | implemented — window domain clamp + warn | `7a24293` |
| SR-7 (F-SAVE-2 remainder) | P3 | implemented — stationId resolution; facing = finite angle (docs corrected) | `7a24293` |
| SR-8 | P2 | implemented — keep-first id dedup ×3 collections | `7a24293` |
| SR-9 | P2 | implemented — classified warnings everywhere (incl. AR-1/1b/3/5 completeness), self-heal backup+rewrite, tombstone discipline | `7a24293` + AR round |
| SR-10 (F-SIM-1) | P3 | implemented — per-resident clone in the pure wrapper; production path untouched | `b99b124`; doc 07 |
| SR-11 (F-UX-1) | P3 | deferred (UX surface; register rationale stands) | doc 11 |
| SR-12 | P3 | deferred — cap bounds the scan to ≤ 0.8 µs | doc 11 |
| SR-13 | P3 | implemented — read-keys load-path trim (240) | `7a24293` |
| SR-14 | P3 | deferred (micro-optimization) | doc 11 |
| F-ENTER-1 / F-PRED-1 / F-WORLD-1 / F-ASSET-1 / F-DOC-1 | P3+ | dispositions re-validated on fresh evidence; unchanged / preserved | doc 02 tail, doc 11 |

No P0 was found at any point (round trips byte-stable; no data-loss path).

## C. Verification results (final tree)

| Gate | Command | Result |
|---|---|---|
| Full suite | `npm test` | **459/459 pass** (425 baseline + 27 save-integrity + 1 purity + 6 AR round), 0 fail / 0 skipped |
| TypeScript | `npm run lint` | exit 0, 0 errors |
| Production build | `npm run build` | exit 0 (pre-existing >500 kB chunk advisory only) |
| Stress harness | `npx tsx scripts/longrun_stress.ts` (full) | all scenarios clean, zero hard violations; replay + twin continuity byte-identical (doc 08 §4) |
| Benchmarks | `npx tsx scripts/journal_bench.ts` | payload bounded 38.2 KB; steady-state save ≈0.125 ms; fixed points stable (doc 05 §3) |
| Mutation experiments | doc 09 §5 register | every correction demonstrated red-before → green-after for the expected reason |
| Browser QA | `scripts/qa_sri_browser.sh` (repo agent-browser convention) | journal renders + persists across reload; save/load continuity (day/memories stable, save loaded not reset); corrupt-save heal with classified warnings + backup + "Continue Day 1"; future-version tombstone + conservative load; **0 page errors, 0 console errors**; only pre-existing benign `favicon.ico` 404 (screenshots `/tmp/qa_shots/sri_*.png`) |
| Independent adversarial review | doc 09 | PASS WITH CONCERNS → all 9 findings resolved (code test-first where behavioral, docs corrected otherwise); reviewer independently reproduced the key claims |

## D. Gate review (prompt §13)

- **Gate A — repository integrity:** dedicated branch from verified main; unrelated work excluded; attributable commit sequence; no untracked artifacts at delivery. **PASS**
- **Gate B — correctness:** all confirmed P0/P1 resolved (none P0 existed); regression tests pin every correction; save/load invariants hold (fixed-point + twin evidence); deterministic replay verified. **PASS**
- **Gate C — performance:** before/after tables (docs 01 §7 vs 05 §3); tick path untouched (5–7 µs steady, size-independent); no material regression; remaining limitations documented honestly (input-size validation sweep on out-of-envelope states). **PASS**
- **Gate D — long-run reliability:** scenarios A–G clean; caps engage exactly; no drift (byte-identical twins). **PASS**
- **Gate E — compatibility:** v1 fixture loads through the full chain (now with observable warnings — AR-3); sequential migrations intact; round trips byte-stable; invalid saves handled safely with backup discipline; no silent loss of valid historical data (ceiling headroom + GUARD fixtures). **PASS**
- **Gate F — regression protection:** suite + tsc + build + harness + browser + independent review all pass. **PASS**
- **Gate G — documentation:** findings trace to source evidence (docs 01–02); decisions documented (03–04, 06–07); deferred work explicit (11); WORKLOG Entry 053 + HANDOVER §18 updated; this report reflects the final tree. **PASS**

## E. What would falsify this report

- Any GUARD fixture growing a warning (over-rejection of production-reachable state).
- Any harness scenario printing a hard violation (first-violation reporting makes it actionable).
- The purity test failing (a future tick writer crossing the wrapper boundary).
- A save/load cycle producing progressive drift (twin-continuity check in scenario B).
