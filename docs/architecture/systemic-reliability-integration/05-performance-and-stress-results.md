# 05 — Performance and Stress Results

## 1. Methodology

- Machine/session: the same sandbox session for base, integrated, and repaired measurements (comparable runtime conditions; no dedicated GPU work involved).
- Benchmark: `scripts/journal_bench.ts` (arrives with the integration) — fixed seed, warm-up iterations, medians across 3 runs of medians; stress: `scripts/longrun_stress.ts` — deterministic seeds, scenarios A–G with per-tick invariant sweeps, first-violation reporting.
- Historical numbers (original branch, old base `545e323`) are treated as reference points, not proof (directive §18): payload ≈38.2 KB; steady-state serialize ≈0.125 ms; deserialize ≈0.14 ms; fixed-point byte stability; tick path 5–7 µs steady, size-independent.

## 2. Current results (final repaired tree `f2eb808`)

| Measurement | Historical (old base) | Current integrated | Comparison |
|---|---|---|---|
| Serialized payload at cap | ≈38.2 KB bounded | **38.2 KB** (fixed) | identical bound |
| Serialize @96 rows (median of medians, 3 runs) | ≈0.125 ms | **0.134 ms** (min 0.121, max 0.164) | +0.009 ms ≈ run noise; the sanitize path now also runs the new warning counters (warning-only, no state change) |
| Deserialize (bench table) | ≈0.14 ms | 0.130–0.139 ms across run sizes | comparable |
| Fixed point `serialize(load(serialize(x)))` | byte-stable | **byte-stable** (p2.length 39,150 B) | holds |
| Fresh-world round-trip | byte-stable | **byte-stable** (17,763 B) | holds |
| Cap behavior | 96-row convergence | 12,800 rows → 96, first (newest) rows kept; re-load warning-free | holds |
| Tick path | untouched | untouched (`stepSimulationInPlace` byte-identical to main) | no regression by construction |
| Pure-wrapper clone cost | ≈0.43 µs claimed | 0.367–0.397 µs measured (reviewers, N=10) | at/below claim |

No regression vs either the historical reference or the current-main baseline was observed in any measured dimension. Limitations: single-session timing (no cross-machine comparison); real-GPU/frame-rate work remains external-hardware territory as before; the memory-id validation sweep on out-of-envelope states remains bounded by the cap rather than a keyed index (deferred SR-12, unchanged).

## 3. Long-run stress (deterministic seeds; harness prints per-scenario rows)

| Scenario | Ticks | Rests | Save/reloads | Result |
|---|---|---|---|---|
| A_extended_ordinary_life | 2,000 | 1 | 0 | clean; payload 17,763 → 40,559 B; journal 1; npcMem 5 |
| B_persistence_endurance | 2,000 | 2 | 10 | clean; payload → 65,128 B; **twin continuity: save/reload twin byte-identical to no-reload twin** |
| C_journal_pressure | 2,000 | 5 | 0 | clean; payload → 68,529 B; no unbounded journal growth |
| D_invitation_pressure | 2,000 | 7 | 0 | clean; payload → 110,182 B (bounded history/cooldowns); no lifecycle drift |
| E_boundary_transitions | 1,500 | 3 | 0 | clean |
| G_interrupted_progression | 1,500 | 3 | 10 | clean; no stale occupancy/activity after interruption + reload |
| F_deterministic_replay | 10 checkpoints/run | — | — | **byte-identical = true** |

Checks engaged: caps engage exactly at their bounds; no accumulating duplicate state; no invalid references; no stale occupancy/active activities; no serialization growth beyond the documented caps; no progressive degradation across the runs. All on the repaired tree (re-run after both repair commits).

## 4. Browser verification

`scripts/qa_sri_browser.sh` (repo agent-browser convention, from the original initiative) exercises: journal renders + persists across reload; save/load continuity; corrupt-save heal with classified warnings + backup; future-version tombstone + conservative load. The original run (old base) passed with 0 page/console errors. **Not re-executed in this sandbox session** (no display/agent-browser harness bound in this environment); the check it covers is additionally protected on the integrated tree by: (a) the storage self-heal/tombstone unit tests, (b) the corrupt/future-version fixtures (SR-9b/f/e), and (c) the stress harness save/load continuity. Re-running the browser pass on target hardware before release is listed as a non-blocking follow-up in `06-deferred-findings.md`.
