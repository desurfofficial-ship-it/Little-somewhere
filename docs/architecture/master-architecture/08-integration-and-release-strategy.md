# 08 — Integration and Release Strategy

**Recorded:** 2026-11-22, atop `origin/main` @ `a80a220`.
**Purpose:** the machine-checked gates that make the parallel-development protocol (doc 07) real, the durability guarantees that prevent another lost-branch incident, the release/merge method, the pre-merge verification checklist, and the cleanup/hardening items.

**This initiative implements Phase A of doc 03 (the foundation gates) as executable infrastructure.** Everything else in this document is the standing strategy.

---

## 1. Current CI state (the gap)

`.github/workflows/` contains exactly **one** file, `deploy-pages.yml`:
- Triggers on `push: main` only — **never on PRs**.
- Runs `npm run build` only — **no `npm test`, no `npm run lint`**.
- Uses `peaceiris/actions-gh-pages@v4` (third-party) with `force_orphan: true` (destroys `gh-pages` history on every deploy — no rollback).
- Installs with `--legacy-peer-deps` (signals known peer-dep fragility).

**Consequence:** a PR can merge with zero tests run. The only gate is the author's self-report. This is the highest-leverage gap in the project.

---

## 2. Target gate stack

| Gate | Mechanism | Runs on | Required | Status |
| :--- | :--- | :--- | :--- | :--- |
| Unit tests | `npm test` (`tsx --test src/game/*.test.ts src/scene/*.test.ts`) | every PR + push | yes | **Added in `ci.yml` (this initiative)** |
| TypeScript | `npm run lint` (`tsc --noEmit`) | every PR + push | yes | **Added in `ci.yml`** |
| Production build | `npm run build` | every PR + push | yes | **Added in `ci.yml`** |
| Layer boundary | `scripts/check_layer_boundaries.ts` | every PR + push | yes | **Added in `ci.yml` + script (this initiative)** |
| Duplicate migration version | guard test in the test suite | every PR + push | yes (via `npm test`) | **Added (this initiative)** |
| Branch durability | `git tag build-<N>-<sha>` on merge to main | merge to main | yes | **Added in `deploy-pages.yml` (this initiative)** |
| GitHub Pages deploy | `npm run build` + `peaceiris/actions-gh-pages` | push to main | (existing) | Existing; hardening recommendations in §7 |
| Golden-replay harness | target | every PR touching `actions/*` or `migrations/*` | target (Phase E2 prerequisite) | Not yet built |
| Screenshot diff | target | every PR touching `src/scene/**` | target | Partial (`scripts/qa_*_evidence.sh` exist); formalize |

---

## 3. Boundary-check script (`scripts/check_layer_boundaries.ts`)

**Purpose:** machine-check the three-layer boundary (doc 04 §3) without adding ESLint as a dependency (initiative boundary: no new dependencies without explicit approval).

**Checks:**
1. `src/game/**` must not import `three` or `react`/`react-dom`.
2. `src/game/**` must not touch browser globals (`window.`, `document.`, `AudioContext`, `requestAnimationFrame`, `localStorage`, `fetch`, `Worker`, `indexedDB`, `navigator`, `performance.now`) **except** in sanctioned modules: `storage.ts` (`window.localStorage`), `audio.ts` (`AudioContext` + `window.setTimeout`/`clearTimeout` until W6 remediation, then timer use moves behind the `Scheduler` port and the sanction for timers is removed).
3. `src/scene/**` must not import from `src/components/`.
4. `src/components/**` must not import `three` directly.
5. `src/components/**` must not import from `src/scene/**`.
6. `src/game/**` import graph must be acyclic (Tarjan SCC → no multi-node SCC, no self-loops).

**Exit code:** 0 if all checks pass, non-zero with a diagnostic list if any fail. **Sanctioned-module list is configurable** so W5/W6 remediation shrinks the list back without script changes.

**This script is implemented as part of this initiative** and run in `ci.yml`.

---

## 4. Tag-on-merge durability

**Purpose:** prevent a repeat of the lost-branch incident (`docs/architecture/build10-lr-recovery/13-final-integration-state.md` §1), where a corrective branch lived only in a local worktree, was never pushed to a remote durable ref, and was GC'd.

**Mechanism:** on every push to `main` (i.e., every merge), the workflow tags the commit:
```
git tag build-<short-sha> <sha>
git push origin build-<short-sha>
```
Tags are **never garbage-collected** by git. Even if every branch ref is deleted, the tagged commits remain reachable. This is the cheapest possible durability guarantee.

**Implemented in `deploy-pages.yml`** (the existing main-push workflow) as a pre-deploy step.

**Secondary durability guidance (CONTRIBUTING-style, recorded in doc 07 §1):** "No branch is considered durable until pushed to `origin/` and tagged." Local-only branches are not durable.

---

## 5. The lost-branch incident — root cause and the fix

**Root cause (verified):** the reliability work lived in a separate worktree (`/home/z/my-project/little-somewhere-sri`) on a branch (`feat/systemic-reliability @ b71bb3c`) that was **not pushed to a remote durable ref** (no tag, no `origin/feat/...`). When the worktree was lost, the commits became unreachable and were GC'd. The build10-lr-recovery docs (12 docs) describe the re-execution from "primary sources" (architecture docs + surviving red tests + audit), not from git history.

**This was primarily a worktree-durability + process gap, secondarily a CI gap.** CI would not have saved the branch object. But CI *would* have produced an independent green-build artifact proving the re-execution matched the original — which is exactly what the 14-doc recovery effort had to reconstruct manually.

**The fix (three layers, implemented in this initiative):**
1. **Tag every merge to main** (`git tag build-<sha>` in `deploy-pages.yml`). Tags are GC-proof. (§4)
2. **Add `ci.yml`** running tests + lint + build on PRs + push. (§2)
3. **Record the durability rule** in doc 07 §1: "No branch is durable until pushed to `origin/` and tagged."

**Total cost of the fix:** ~1 workflow file + ~1 script + ~1 guard test + doc updates. Addresses the *real* lesson (durability) not the *surface* lesson (CI).

---

## 6. Phantom dependency cleanup (`@google/genai`)

**Finding (Task 1-f, doc 09 §1-f):** `@google/genai` (`^2.4.0`) is declared in `package.json` but is **imported nowhere** in `src/`, `scripts/`, or `skills/`. `GEMINI_API_KEY` in `.env.example` is dead config. The "Gemini integration" does not ship in the game runtime.

**Risks:**
- Install-time failure breaks `deploy-pages.yml` (the `--legacy-peer-deps` flag signals known peer-dep conflicts).
- `GEMINI_API_KEY` dead env var misleads agents into thinking a runtime integration exists.
- Repo bloat + supply-chain surface.

**Remediation (deferred — verify skills usage first):**
1. Verify no `skills/` entry uses `@google/genai` at dev time (grep `skills/`).
2. If unused at dev time: remove `@google/genai` from `dependencies` (or move to `devDependencies` if skills need it).
3. Delete `.env.example`'s `GEMINI_API_KEY` line.
4. Re-run `npm install` + `npm run build` to confirm no breakage.

**This is recorded as a tracked item, not executed in this initiative** (it touches `package.json` which affects the install graph; needs a dedicated verification pass). Tracked in doc 02 W21.

---

## 7. GitHub Pages deploy hardening (recommendations, not executed)

The existing `deploy-pages.yml` has three SPOFs:

| SPOF | Risk | Hardening direction |
| :--- | :--- | :--- |
| `peaceiris/actions-gh-pages@v4` (third-party action) | supply-chain risk; action could be compromised | pin to a specific SHA (not a floating tag); or migrate to the official `actions/deploy-pages` action. |
| `force_orphan: true` | destroys `gh-pages` history on every deploy — no rollback | drop `force_orphan`; use incremental deploy with `keep_history: true`. |
| `push: main` only | a broken main ships directly to the public site with no canary | gate deploy behind a manual approval, or deploy from a `release/*` branch. |

**Base-path check:** `vite.config.ts:38-47` uses a `grep`-style env check (`GITHUB_PAGES === 'true'`). A refactor that changes the asset prefix format silently breaks the live site. Add a build-time assertion that the base path resolves to a non-empty string when `GITHUB_PAGES=true`.

**These are recommendations for the Integration lead, not executed in this initiative** (they touch the deploy workflow which needs its own verification pass against the live site).

---

## 8. Merge method and pre-merge verification checklist

**Merge method:** GitHub PR **merge commit** (repository convention, matching PRs #4–#12). Squash is not used (preserves per-commit attribution and scope verification).

**Pre-merge checklist (the integration lead verifies before clicking merge):**
- [ ] Branch based on actual latest `main` (re-fetched).
- [ ] PR base is still current (no unexpected commits on `main` since branch cut).
- [ ] No unexpected commits on the branch (scope matches PR description).
- [ ] CI green: `npm test` + `npm run lint` + `npm run build` + `scripts/check_layer_boundaries.ts`.
- [ ] No credentials or secrets in the diff.
- [ ] Scope is confined to the claimed subsystems (doc 04 §1); no unrelated files changed.
- [ ] If touching a shared file (doc 04 §2): every affected consumer listed; reviewers signed off.
- [ ] If schema bump (doc 07 §2): all four merge-points covered; duplicate-version guard passes; doc 06 §1 table updated.
- [ ] If touching `src/scene/**`: screenshot diff acceptable.
- [ ] `WORKLOG.md` entry appended (correct number per doc 07 §5).
- [ ] `HANDOVER.md` updated if architecture/storage keys/open backlog changed.
- [ ] Re-run full verification on the final tree (the tip commit, not an earlier commit).
- [ ] Inspect the final PR diff.

**Post-merge:**
- [ ] Tag-on-merge fires (`git tag build-<sha>` pushed).
- [ ] Verify `origin/main` advanced to the merge commit.
- [ ] If the branch was an integration branch, preserve it on the remote (precedent: `feat/systemic-reliability`).
- [ ] Re-run `npm test` on a fresh checkout of the merged main to confirm no environment-dependent drift.

---

## 9. Release strategy

LITTLE SOMEWHERE deploys via GitHub Pages on every push to `main` (continuous deployment). There is no separate release branch today.

| Release concept | Current | Target |
| :--- | :--- | :--- |
| Cadence | every push to main | every push to main (keep) |
| Artifact | GitHub Pages site | GitHub Pages site |
| Versioning | WORKLOG entry numbers + CHANGELOG | WORKLOG + CHANGELOG + `git tag build-<sha>` (this initiative) |
| Rollback | none (`force_orphan` destroys history) | target: `keep_history: true` + redeploy prior tag (§7) |
| Canary | none | target: gate deploy behind manual approval or `release/*` branch (§7) |

**CHANGELOG** (`CHANGELOG.md`) is the human-readable release log; WORKLOG is the engineering log; tags are the durable machine-readable release markers. The three together form the release record.

---

## 10. Files added by this initiative (Phase A foundation gates)

| File | Purpose | Verified |
| :--- | :--- | :--- |
| `.github/workflows/ci.yml` | test + lint + build + boundary-check on every PR + push | §2 |
| `scripts/check_layer_boundaries.ts` | machine-check the three-layer boundary + DAG invariant | §3 |
| `src/game/migrations-guard.test.ts` | duplicate-migration-version guard (LR-A11) | §2, doc 07 §3 |
| `docs/architecture/master-architecture/00-09` | this governance directory | — |
| `deploy-pages.yml` (edited) | add tag-on-merge step before deploy | §4 |
| `ARCHITECTURE.md` (edited) | add pointer to `master-architecture/` directory | — |
| `HANDOVER.md` (edited) | add pointer to master-architecture initiative | — |
| `WORKLOG.md` (edited) | append entry for the master-architecture initiative | — |

**All additions are additive.** No production gameplay code is touched. No existing tests are modified. The 528-test baseline + `tsc` clean + build green must all still pass (verified before push, §11).

---

## 11. Verification before push

Before this initiative's PR is pushed:

1. `npm install` (fresh) — confirms `package.json` is valid.
2. `npm test` — confirms 528 tests still pass + the new guard test passes.
3. `npm run lint` (`tsc --noEmit`) — confirms the new script + test typecheck.
4. `npm run build` — confirms the build is green.
5. `node --loader tsx scripts/check_layer_boundaries.ts` (or `bun run` equivalent) — confirms the boundary script runs and passes on the clean tree.
6. Inspect the final diff.

**If any step fails, the push does not happen.** This is the "do not merge unverified changes" invariant applied to this initiative itself.

---

## 12. Standing integration strategy (summary)

- **Gates are machine-checked, not human-checked.** CI + boundary script + guard test + tag-on-merge.
- **Decomposition is gated by guard tests.** No extraction lands before the test that proves it preserved behavior (doc 07 §3).
- **Shared files change via the protocol.** doc 07 §4.
- **Schema bumps are serialized until Phase D.** doc 07 §2.
- **Branches are durable only when pushed + tagged.** doc 07 §1, this doc §4.
- **Merge via PR merge commit; verify pre- and post-merge.** §8.
- **Historical PRs and integration branches are preserved.** §8, doc 07 §1.

This is the engineering foundation. It is intentionally minimal, machine-checked, and additive. Everything else in the master-architecture directory (docs 01–07, 09) is the specification this foundation enforces.
