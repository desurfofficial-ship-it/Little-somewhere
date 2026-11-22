# 01 — Integration Baseline

**Initiative**: Systemic Reliability Recovery, Rebase, Adversarial Integration & Controlled Merge.
**Branch**: `integrate/systemic-reliability-current-main` (dedicated worktree `/home/z/my-project/little-somewhere-int`).
**Recorded**: 2026-11-22, before publication.

## 1. Actual base and branch hashes (verified, not assumed)

| Item | Value | Verification |
|---|---|---|
| Integration base | `origin/main` = `0273821` (merge of PR #10, Visual Identity BUILD 04) | `git fetch origin` at initiative start; main had advanced past the last-verified `962fb07` through PR #9 (BUILD 03) and PR #10 (BUILD 04); per the directive, the actual current remote tip is the integration base — no reset to an old hash |
| Original reliability branch | `feat/systemic-reliability`, tip `b71bb3c`, base `545e323`, 9 commits | Preserved untouched in worktree `/home/z/my-project/little-somewhere-sri`; `git status` clean; no history rewrite |
| Remote reliability branch | none (local-only, as historically recorded) | `git ls-remote origin` |
| Integration tip at this record | cherry-picks `32c0d78`…`6eb473b` + repair commits (see §3) | `git log origin/main..HEAD` |

## 2. Main-branch state at the integration base

Measured, not inherited (base `0273821`, deps installed fresh in the integration worktree):

| Gate | Command | Result |
|---|---|---|
| Full suite | `npx tsx --test src/game/*.test.ts src/scene/*.test.ts` | **489/489 pass**, 0 fail |
| TypeScript | `npm run lint` (`tsc --noEmit`) | exit 0 |
| Production build | `npm run build` | exit 0 (pre-existing >500 kB chunk advisory only) |

Note: the last published baseline for BUILD 04 was recorded as 480/480 mid-branch; the actual merged tip measures 489 (late BUILD 04 stages added tests). This record uses the measured number.

Main-side drift since the reliability base `545e323` (compatibility scope): `src/game/` changed only in `dialogue/assets.ts`, `environment.ts`, and the new `progressionVisuals.{ts,test.ts}` (visual/progression presentation). **None of the five files the reliability initiative modified (`journal.ts`, `migrations.ts`, `simulation.ts`, `storage.ts`, `storylines.ts`) changed on main between `545e323` and `0273821`** — verified with `git diff --stat 545e323..origin/main -- <files>` (empty diff). `save-integrity.test.ts` does not exist on main.

## 3. Original reliability commit map (all 9 commits read individually)

| # | Original commit | Integration commit | Purpose | Class |
|---|---|---|---|---|
| 1 | `e2b9683` | `32c0d78` | docs 01–02: forensic baseline + defect reproduction on verified main `545e323` | docs (historical record) |
| 2 | `45546db` | `87da30c` | docs 03–04: target reliability model + implementation plan | docs (historical record) |
| 3 | `7e6b056` | `5d2439a` | adversarial save-integrity regression suite (33 tests; committed red-first to demonstrate the open boundary) | tests |
| 4 | `7a24293` | `23c9332` | SR-1..SR-9/13 sanitizer + persistence-contract fixes (`journal.ts`, `migrations.ts`, `storage.ts`, `storylines.ts`) | core fix |
| 5 | `b99b124` | `849ab6e` | SR-10 / F-SIM-1: isolate residents in the pure `stepSimulation` wrapper | core fix |
| 6 | `20ed227` | `609d1f0` | long-run stress harness (`scripts/longrun_stress.ts`, scenarios A–G, per-tick invariant sweep) | tests/harness |
| 7 | `5ed8485` | `043a763` | adversarial-review gap closure: warning parity, re-key collapse, counter-domain pin (`AR-2`, `AR-3`, `AR-4`, `AR-5`) | core fix |
| 8 | `ec93aba` | `33e3f84` | docs 05–11 + 00-index; original WORKLOG Entry 053 / HANDOVER §18 | docs (historical record) |
| 9 | `b71bb3c` | `6eb473b` | publication-blocker record (credentials unavailable in the original session) | docs (historical record) |

All cherry-picks carry `-x` provenance lines. The two commits that edited `WORKLOG.md`/`HANDOVER.md` (`ec93aba`, `b71bb3c`) were cherry-picked with their history-file hunks resolved to the integration branch's current content (main's Entries 001–055 / §§1–18); the reliability history is reconciled in the integration's own record (WORKLOG Entry 056, HANDOVER §19) instead of duplicating colliding numbers. See `03-integration-decisions.md` §2 for the conflict-resolution rationale.

## 4. Worktree and preservation record

- Original branch name: `feat/systemic-reliability`; original tip `b71bb3c`; original base `545e323`; commit list = §3 table.
- Original worktree: `/home/z/my-project/little-somewhere-sri` — **clean at every check** (`git status --porcelain` empty), preserved, not deleted or reset during this initiative.
- Original test evidence (historical, on the old base `545e323`): 459/459 (`npm test`), tsc clean, build green, stress scenarios A–G clean, `journal_bench` payload 38.2 KB / ~0.125 ms serialize / fixed points stable, browser QA pass (`docs/architecture/systemic-reliability/10-final-verification-report.md` §C).
- Uncommitted changes found on the original branch/worktree at initiative start: **none**.
- No remote reliability branch exists; nothing on the original branch was pushed, rewritten, or deleted by this initiative.

## 5. GitHub PR states at initiative start (verified via authenticated API)

| PR | State | Head | Disposition in this initiative |
|---|---|---|---|
| #3 | open, draft, unmerged | `d615a8e` | untouched (historical LR-1 archive) |
| #7 | open, draft, unmerged | `6fd59c7` | untouched (LR-3 discovery record) |
| #8 | open, draft, unmerged, stacked on #7 | `b26e0d3` | untouched (LR-3 advanced design record) |
| #9, #10 | merged (BUILD 03/04) | — | already in main history (why the base moved) |

## 6. Integration verification deltas (summary; full evidence in docs 04–05)

| Gate | Base (main `0273821`) | Integrated tree (pre-repair) | Final repaired tree |
|---|---|---|---|
| Full suite | 489/489 | 523/523 | **528/528** |
| TypeScript | clean | clean | clean |
| Build | green | green | green |
| Stress harness (A–G) | n/a (harness arrives with the branch) | all clean, replay/twin byte-identical | all clean, replay/twin byte-identical |
| Mutation register | n/a | M4 not caught (suite gap) | **9/9 caught** after repair |

The +34 tests vs main = the reliability suite (33 `save-integrity` + 1 purity); the final +5 are integration-repair tests (SR-2d, SR-9f, SR-9g, SR-2e, R1-S-02 purity mirror). Full arithmetic in `04-regression-and-adversarial-testing.md` §2.
