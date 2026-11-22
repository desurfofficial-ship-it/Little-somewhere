# 04 — Regression and Adversarial Testing

## 1. Exact commands and outcomes (final repaired tree `f2eb808`)

| Gate | Command | Result |
|---|---|---|
| Full suite | `npx tsx --test src/game/*.test.ts src/scene/*.test.ts` | **528/528 pass, 0 fail, 0 skipped** (15–20 s) |
| TypeScript | `npm run lint` / `npx tsc --noEmit` | exit 0, 0 errors |
| Production build | `npm run build` | exit 0 (pre-existing >500 kB chunk advisory only) |
| Stress harness | `npx tsx scripts/longrun_stress.ts` | scenarios A–G all clean, **zero hard invariant violations**; `F_deterministic_replay byte-identical=true`; `B_twin_continuity byte-identical=true` |
| Benchmarks | `npx tsx scripts/journal_bench.ts` | payload bounded 38.2 KB; serialize @96 rows median 0.134 ms (min 0.121 / max 0.164); fixed points byte-stable; fresh round-trip 17763 B byte-stable |
| Mutation register | `/home/z/my-project/scripts/sri_mutation_checks.py` (external, tree restored + verified clean after every mutation) | **9/9 caught** (see §3) |

Base comparisons measured on the same machine/session: main `0273821` = 489/489; integrated pre-repair = 523/523; repaired = 528/528.

## 2. Test-count arithmetic (no double counting)

- main `0273821`: 489.
- reliability suite added by the cherry-picks: `save-integrity.test.ts` 33 + purity 1 = **+34** → 523 (measured).
- integration-repair tests: SR-2d, SR-9f, SR-9g (+3 in `save-integrity.test.ts`), R1-S-02 purity mirror (+1 in `simulation.test.ts`), SR-2e (+1) = **+5** → 528 (measured).

## 3. Mutation register (directive §16)

Harness: each mutation applies an exact-string patch to the integrated tree, runs the targeted test files, records which tests go red, restores the file, and re-verifies green + clean tree. Register kept at `/home/z/my-project/initiative-scratch/sri_mutation_results.json`. Final state: **every mutation caught by the expected tests; final tree clean.**

| ID | Mutation (deliberately broken invariant) | Expected failing area | Actual result |
|---|---|---|---|
| M1 | journal-memory cap disabled (`> Number.MAX_SAFE_INTEGER`) | SR-1 (cap) | caught — 11 tests red |
| M2 | keep-first → keep-last in npcRelations re-key collapse (AR-2) | AR-2 | caught — AR-2 red |
| M3 | duplicate-id detection bypassed in activeEncounters (SR-8b) | SR-8b | caught — SR-8b red |
| M4 | npcRelations resident-validation bypass (SR-3) | SR-3 | **first run: NOT caught → suite gap found and repaired** (see §4); after repair: caught — SR-3 red |
| M5 | invitation window clamp disabled (F-SAVE-1) | F-SAVE-1 | caught — F-SAVE-1 red |
| M6 | occupancy stationId consistency bypassed (SR-7) | SR-7 | caught — SR-7 red |
| M7 | save-path warning propagation removed (AR-5) | AR-5 | caught — AR-5 red |
| M8 | resident clone aliasing restored (`= record` instead of spread) | SR-10 purity | caught — purity test red (leak reproduced at step 682, matching doc 07's register number; independently re-derived by the round-2 reviewer at the default clock rate) |
| M9 | backwards-time encounter check disabled (SR-9a) | SR-9a | caught — SR-9a red |

No mutation remains in the delivered tree (verified: `git status --porcelain` empty after the register run; restore re-verified green per mutation).

## 4. Findings → repairs (independent adversarial review loop, directive §17)

Two substantive rounds, two independent reviewers (persistence scope; simulation/LR scope). Both review rounds ran against the **actual diff and actual tests** — neither approved from the implementer's summary.

**Round 1 (both reviewers: PASS WITH CONCERNS — zero data-corruption paths found):**

| ID | Sev | Finding | Disposition |
|---|---|---|---|
| R1-P-01 / R1-S-01 | P2/P3 | mismatched persisted `activeActivity` under a live invitation cleared silently (load + save) | **FIXED** — discard warning + SR-2d pin (commit `d450893`) |
| R1-P-02 | P2 (pre-existing on main, not a diff regression) | present-but-invalid `schemaVersion` (null/string) falls into the legacy v1 heuristic → silent v2-era rebuild | **FIXED** — reject-to-fresh + SR-9f pin (`d450893`) |
| R1-P-03 | P3 (docs) | doc 03 §2 stale "cleared as a unit" bullet contradicting the shipped anchor rule | **FIXED** — attributed correction (`d450893`) |
| R1-P-04 | P3 | non-record rows in memories/worldEvents/activeEncounters skipped before the drop counters | **FIXED** — counted + warned + SR-9g pin (`d450893`) |
| R1-S-02 | P3 | pure wrapper fabricated `{}` resident records for missing ids | **FIXED** — mirror-missing + purity test (`d450893`) |
| (mutation) M4 | — | SR-3 fixture masked by re-keying + loose warning assertion | **FIXED** — canonical-key fixture + precise `unregistered residents` assertion (commit `044084d`) |

**Round 2 (both reviewers: PASS WITH EXPLICIT NON-BLOCKING CONCERNS — all round-1 findings independently verified FIXED):**

| ID | Sev | Finding | Disposition |
|---|---|---|---|
| R2-P-01 | P3 | truthy non-record `activeActivity`/`occupancy` garbage still cleared silently | **FIXED** — warn + SR-2e pin (commit `f2eb808`) |
| R2-P-02 | P3 | SR-2d canonical GUARD fixture read a nonexistent payload field (passed via the `invitationId === undefined` clause, not a real id match) | **FIXED** — fixture reads the real `raw.invitations.active.id` (`f2eb808`) |
| R2-S-01 | P3 | persisted slice with absent/undefined `invitationId` canonicalized silently — pre-existing main tolerance, unreachable from production writers, value-preserving | **DEFERRED** with rationale in `06-deferred-findings.md` |

Reviewer-verified non-regression evidence (round 2): production-writer census for `activeActivity`/`occupancy` (9 production shapes all load warning-free); counters proven warning-only (byte-identical sanitized state); per-class idempotency (second load warning-free, byte-stable); `schemaVersion` guard cannot break legacy loads (JSON never encodes present-undefined; field-less payloads still route through the heuristic); M8 aliasing sensitivity re-derived independently at the committed test's default clock rate.

## 5. Adversarial coverage matrix (directive §15)

The reliability suite (`save-integrity.test.ts`, 37 tests) + purity tests pin the directive's classes; the stress harness covers the long-run classes:

- **Persistence adversarial**: empty/over-cap/duplicate journals, duplicate records with different payloads, missing/invalid references, legacy save formats (v1 heuristic GUARD + AR-3 chain-warning pin), corrupt nested structures (non-record rows, garbage slices), unsupported versions (SR-9b/f + future-version tombstone), repeated load/save cycles + save-after-heal + save-after-tombstone (fixed-point + twin continuity), warning passthrough (AR-3/AR-5).
- **Invitation adversarial**: valid/expired/missing-host/unavailable-host lifecycle (main's invitation suite), invalid temporal fields (F-SAVE-1/2, SR-5, SR-9a), domain-valid extremes (AR-4), window boundary (GUARD + F-SAVE-1), 690–719 dead zone (untouched production semantics — GUARD probes load live windows warning-free), save/load during each lifecycle state (stress scenario B/G), host-unavailable-between-accept-and-complete (main suite), cross-interior attempts (main suite), reconciliation idempotency (SR-2a/2b/2c/2d/2e).
- **Occupancy/activity adversarial**: valid/missing/conflicting occupant, activity without occupancy and vice versa (SR-2 family), interrupted activity, re-entry, save/load during activity, repeated completion attempts (main occupancy suite + stress scenario G).
- **Determinism adversarial**: identical states + action sequences (F replay byte-identical), different batching where the contract permits (pure ≡ in-place trajectories), repeated save/load/sanitize/self-heal (twin continuity byte-identical), long-running simulation (scenarios A–G, 1,500–2,000 ticks each), dedup under repeated events (scenario C/D pressure).

Every test asserts explicit expected outcomes (state shapes, warning texts, byte-stability) — none relies on "no exception thrown".
