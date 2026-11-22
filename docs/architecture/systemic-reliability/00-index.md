# 00 — Index: Systemic Reliability Initiative

**Branch:** `feat/systemic-reliability` (base: verified `origin/main` = `545e323`)
**Status:** complete — all P0/P1 resolved (no P0 existed), P2 implemented or bounded, P3 dispositions in `11-deferred-findings.md`; independent adversarial review PASS (concerns resolved, `09`).

| Doc | Content |
|---|---|
| `01-baseline-and-repository-state.md` | Verified repository state, baseline verification (425/425), architectural boundaries, deferred-findings register, reproduction summary, performance baseline, initial risk classification |
| `02-defect-reproduction.md` | Full defect catalog SR-1..SR-14 (reproduced or structurally verified on `545e323`), non-reproduced register items, determinism verdict |
| `03-target-reliability-model.md` | Journal lifecycle contract (J-1..J-5), persistence contract + domain tables, state-ownership contract, determinism contract, long-run invariants, save/load guarantees, error-handling policy, performance budgets |
| `04-implementation-plan.md` | Change specifications (findings, evidence, root cause, target invariant, files, risk, test strategy, rollback), actual commit sequence, explicit deferrals |
| `05-journal-lifecycle-and-performance.md` | Journal lifecycle model, production content ceiling, before/after benchmarks (cap converges payload to 38.2 KB; steady-state save ≈0.125 ms), retention decision, dispositions |
| `06-save-integrity-and-migrations.md` | Persistence pipeline, responsibility taxonomy, the occupancy/activeActivity contract of record, enforced domain rules, warning topology, round-trip guarantees, migration behavior, fixture catalog |
| `07-simulation-state-ownership.md` | Ownership model, SR-10/F-SIM-1 defect and smallest-coherent correction, verification and mutation evidence, why no other cloning was added |
| `08-long-run-stress-testing.md` | Harness design (real production pathways), scenarios A–G, per-tick invariant sweep with honest scope notes, full-run results, usage |
| `09-adversarial-review.md` | Both adversarial rounds: implementation-time loop (unit-clear rejected on doc 14 §4.3 evidence) and the independent post-implementation review (verdict, reproduced claims, attacks 2a–2g, 9 findings all resolved), mutation evidence register |
| `10-final-verification-report.md` | Findings → resolution table, final verification results (459/459, tsc 0, build green, harness clean, browser QA, benchmarks), gate review A–G |
| `11-deferred-findings.md` | Deferred P3s with revisit conditions, rejected-with-evidence proposals, J-5 follow-up gate |

Companion tooling: `scripts/longrun_stress.ts` (harness), `scripts/journal_bench.ts` (benchmark), `scripts/qa_sri_browser.sh` (browser QA, repo agent-browser convention).
