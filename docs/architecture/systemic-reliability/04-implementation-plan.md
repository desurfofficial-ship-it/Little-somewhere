# 04 — Implementation Plan

**Classification policy:** P0 catastrophic data loss/corruption · P1 serious production correctness · P2 meaningful reliability/performance/maintainability · P3 low-risk improvement. Prioritization ladder: data corruption → invalid runtime state → determinism → long-run failures → persistence performance → memory/lifecycle → test-only isolation → cleanup.

**Scope decision:** no P0 exists on this baseline (round-trips are byte-stable; no data-loss path found). All P1/P2 findings are implemented; P3 findings are implemented where the correction is smaller than the risk it removes (SR-6/7 fold into the P1/P2 sanitizer correction; SR-10 is a one-line-equivalent purity fix), and explicitly deferred where the deferral is cheaper than the change (SR-11, SR-12, SR-14 — see doc 11).

---

## Change 1 — Persistence-boundary hardening (P1/P2; SR-2, SR-3, SR-4, SR-5, SR-6, SR-7, SR-8, SR-9)

| Field | Content |
|---|---|
| Finding IDs | SR-2 (P1), SR-3 (P1), SR-4 (P1), SR-5 (P2), SR-6 (P3), SR-7 (P3), SR-8 (P2), SR-9 (P2) |
| Evidence | doc 02 §SR-2…SR-9 (32-fixture adversarial catalog: 7 fixtures produced runtime states violating the game's own invariants; serious corruptions silent) |
| Root cause | the sanitizer grew as a normalization layer for *older valid schemas* and never fully assumed its third role — defensive boundary for *untrusted* input; domain/ceiling/reference checks absent where production writers happen to clamp |
| Target invariant | doc 03 §2 domain table + unit rule + reference-resolution + warned-deterministic-repair |
| Files | `src/game/migrations.ts` (sanitizer core), `src/game/storylines.ts` (unknown-key drop), `src/game/storage.ts` (backup-on-reseed rule, warning text), `src/App.tsx` (console surface of load warnings) |
| Dependencies | none outside the load/save path; no schema version bump (no new fields) |
| Migration implications | none for valid saves; corrupt saves converge deterministically at next load; same-version reseeded payloads now get the same backup protection as version upgrades |
| Risk | medium — the sanitizer is shared by save and load; every new check must be idempotent and must not reject any state the simulation itself produces (guarded by: full suite + fixture catalog where every production-writer-derived fixture must still load unchanged) |
| Test strategy | test-first: `src/game/save-integrity.test.ts` — the adversarial fixture catalog as regression tests, each asserting the doc 03 §2 target behavior (and demonstrating the pre-fix failure first); round-trip fixed-point tests for current + migrated-v1 states |
| Rollback | revert the commit; sanitizer changes are self-contained (no data-format change), rollback restores prior accept-behavior |

**Repair-behavior decisions (deterministic, documented per mandate):** window minutes clamped (not dropped — invitation records are history too); `expiresDay` re-pinned to `offeredDay` (the production writer's invariant; strict predicate then archives if past) — immortal invites become ordinary expired invites; unknown relation pairs / storyline keys / stations dropped+warned (never fabricated); occupancy/`activeActivity` cleared as a unit; duplicates keep-first; negative/unknown versions reject-to-fresh.

## Change 2 — Journal/memory bounded retention (P2; SR-1) + read-key symmetry (P3; SR-13)

| Field | Content |
|---|---|
| Finding IDs | SR-1 (P2, register F-SAVE-3), SR-13 (P3) |
| Evidence | doc 02 §SR-1 (uncapped collection; fixed+linear scaling 0.92–0.97 µs/row, +212.1 B/row), §SR-13; benchmark tables doc 01 §7 |
| Root cause | caps were added per-collection at append time as features matured; `world.memories` (the oldest, earliest append path) never received one; sanitizer choke point existed but never trimmed |
| Target invariant | J-1/J-2/J-4 (doc 03 §1): `JOURNAL_MEMORY_CAP = 96`, newest-first slice in `sanitizeMemories`, headroom > 58-row production ceiling; readKeys trimmed on load |
| Files | `src/game/migrations.ts` (`sanitizeMemories`), `src/game/journal.ts` (load-path trim) |
| Dependencies | none; no schema bump — old saves converge at next save |
| Migration implications | hand-edited >96-row saves get trimmed (intentional, documented behavioral change for corrupt/out-of-envelope input; production states ≤58 rows are untouched) |
| Risk | low — single choke point, deterministic slice; guard: presence-keyed dedup guards + cottage memento lookups must behave identically for every production-reachable state (headroom argument) — asserted by tests |
| Test strategy | test-first: cap enforcement test (98-row hand-built state → 96 rows, newest-first, deterministic across runs); headroom invariant test (production append surfaces cannot exceed cap); readKeys trim test; benchmark before/after recorded in doc 05 |
| Rollback | revert commit; cap removal is format-neutral |

## Change 3 — Pure-wrapper state isolation (P3 test-only; SR-10, register F-SIM-1)

| Field | Content |
|---|---|
| Finding IDs | SR-10 (P3, register F-SIM-1/H-2) |
| Evidence | doc 02 §SR-10: first natural leak at pure step 682, 4 mood paths; sole boundary-crossing writer `updateResidentEmotionInPlace` (`simulation.ts:399-401`); call-site audit — pure wrapper is test-only |
| Root cause | the pure wrapper's clone literal grew slice-by-slice with WorldState fields; `residents` predates it and was never added (production never needed it — in-place path owns mutation) |
| Target invariant | doc 03 §3: pure path returns state whose mutable leaves never alias the input's; fixtures survive stepping without cross-contamination |
| Files | `src/game/simulation.ts` (clone literal: per-resident shallow record clone), `src/game/simulation.test.ts` (purity regression test) |
| Dependencies | none; `stepSimulationInPlace` untouched (production tick must not gain allocations) |
| Migration implications | none |
| Risk | very low — ownership-only change; fix-emulation pre-validated: 1,500-tick harness value-identical trajectories, ~432 ns/call (0.9 % of the pure call), 0 ns on the production path |
| Test strategy | test-first: purity test — snapshot input before N pure steps (past 682), assert untouched; mutation-testing: remove the clone → test fails at the same step → restore → passes |
| Rollback | revert commit |

## Change 4 — Long-run stress harness as committed regression tooling (P2 infrastructure)

| Field | Content |
|---|---|
| Finding IDs | verification infrastructure for doc 03 §5 invariants (no defect of its own) |
| Evidence | doc 01 §8: ~29,500 ticks, 8 scenarios, zero hard violations — the harness found nothing because the baseline is healthy; its value is keeping it that way |
| Files | `scripts/longrun_stress.ts` (harness + invariant checker + scenarios A–G, adapted from the investigation harness to the repo's script conventions) |
| Dependencies | none |
| Risk | none (dev tooling; not on the game path) |
| Test strategy | run via `npx tsx scripts/longrun_stress.ts --quick`; exit code 0 = all invariants hold; full run documented in doc 08 |
| Rollback | delete file |

## Commit sequence (adapted from the suggested organization, dependency-ordered)

1. `test(reliability): adversarial save-integrity fixture suite (red where the boundary is open)` — Change 1 + 2 tests first, demonstrating expected-reason failures (mutation evidence recorded in doc 09).
2. `fix(persistence): enforce the persistence contract in the sanitizer (domains, references, unit rule, dedup, warned repair)` — Change 1 implementation → fixture suite green; full suite green.
3. `fix(journal): bound world.memories at JOURNAL_MEMORY_CAP=96 + readKeys load trim` — Change 2 → green.
4. `fix(simulation): isolate residents in the pure stepSimulation wrapper (F-SIM-1)` — Change 3 → green.
5. `test(reliability): long-run stress harness (scenarios A–G, per-tick invariant sweep)` — Change 4.
6. `docs(reliability): record 05–11, WORKLOG, HANDOVER` — final documentation.

**Test-first gate per change:** write test → run → demonstrate failure for the expected reason → smallest coherent correction → targeted test → subsystem tests → full suite (425+) → adversarial suite → invariant re-verification.

## Explicit deferrals (justified; full register in doc 11)

- **SR-11 / F-UX-1** journal freshness (P3 UX): UI-surface change; register's deferral rationale stands; no state-integrity impact; revisit with the next UI pass.
- **SR-12** per-tick memories scan (P3): the cap (Change 2) bounds the scan to ≤96 rows ≈ ≤0.8 µs — the scaling concern is structurally resolved; keyed-index optimization only if the cap is ever lowered (gated by J-5).
- **SR-14** JournalDrawer closed-panel cost (P3): micro-optimization, no correctness impact.
- **F-ENTER-1, F-PRED-1, F-WORLD-1, F-ASSET-1, F-DOC-1:** register dispositions re-validated on current evidence (doc 02); unchanged.
