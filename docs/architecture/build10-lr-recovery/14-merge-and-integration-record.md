# 14 — Merge & Integration Record

**Status:** candidate verified; merge executed under the final-integration mandate's Phase Eleven after all mandatory gates passed. Merge outcome recorded in §9.
**Candidate:** `fix/build10-lr-reconciliation` @ **`4f3b203`** — 6 commits on top of target `origin/main` `eb95d77`.

---

## 1. Candidate identity and provenance

| Item | Value |
|---|---|
| Original corrective base (previous initiative) | `4ad2e5f` |
| Original corrective head (previous initiative) | `86ecb92` — **lost** (never pushed; worktree/objects unrecoverable; doc 13 §1) |
| Integration target (actual latest main at reconciliation) | `eb95d77` (`fix(copperwheel): adjust window armchair seatPos…`) |
| Candidate branch | `fix/build10-lr-reconciliation`, cut at `eb95d77` |
| Candidate commits (in order) | `f46740f` (D-01+D-02 restoration), `5bbf2dc` (D-03 strict predicate), `69fade1` (regression suites), `6812bba` (D-04/H-1 completion re-check), `2db618a` (docs 01–13 + records 20/21 + WORKLOG/HANDOVER), `1d6f765` (QA evidence + doc 09/12 + save generator), `4f3b203` (tsc cast fix) |
| Post-merge record commit | see §9 |

## 2. Reconciliation strategy and why it was safest

**Branch-from-target instead of merge/rebase/cherry-pick.** The original corrective branch was lost (doc 13 §1), so the work was re-executed from primary sources directly on top of the actual latest main. This (a) eliminates the entire conflict class (no merge base divergence), (b) preserves clean historical attribution (each defect is a scoped, inspectable commit), (c) keeps every restoration diffable against its primary source (`9cde87d`, PR #3 `d615a8e`), and (d) avoids any history rewrite or force-push. `4ad2e5f..eb95d77` (PR #4 + seatPos fixes) touches 97 files with **zero overlap** with the corrective surface (`src/game/`: only `copperwheel.ts` seatPos constants + `WORKLOG.md`) — verified by name-diff and by the main suite passing unchanged inside the candidate's 425.

## 3. Conflicts encountered and resolutions

- **Git conflicts: none** (branch-from-target).
- **Semantic conflicts: none found** (main-only commits name-scanned against the corrective surface; copperwheel seatPos shares no state with invitations/occupancy/discovery).
- **Record collision (the feared Entry 049/050 clash): dissolved by the strategy** — main's Entries 048–050 preserved verbatim; corrective records continue at 051/052.
- **Decision conflicts reconciled in code+docs** (doc 05): D-03 two-predicate duality → ONE strict predicate (doc 14 §2.4 of the LR series + doc 21 §2.4 Decision B); D-04/H-1 → completion re-check with the **encounter signal** (not static schedule — a static re-check would false-reject morning-entered visits completing after the 690 boundary with the host visibly seated; companion pin added).

## 4. Production files changed (complete)

| File | Change |
|---|---|
| `src/game/simulation.ts` | + exploration import, + 8-line step-0 block (md5-identical to `9cde87d`) |
| `src/game/dialogue/index.ts` | + WILDS_TOPICS import + spread (additive; INVITATION_TOPICS kept) |
| `src/game/invitations.ts` | `isInvitationExpired` → `return !isInvitationLive(...)` + 13-line decision-of-record header |
| `src/game/activities.ts` | + 20-line completion-time encounter re-check (visible refusal, zero rewards) |
| `scripts/dialogue-topics-golden.json`, `scripts/topic_snapshot_runtime.json` | regenerated from the live registry (83 → 85; only the two wilds rows + `index` shifts) |

No schema change (WorldState stays v11; `migrations.ts` untouched). No dependency changes. No scene/rendering changes (dist +5.3 KB, +0.30%).

## 5. Tests added or modified

`src/game/build10-recovery.test.ts` (13 new), `src/game/lr-tick-load.test.ts` (8 new), `occupancy.test.ts` LR2-04b re-staged per doc 21 §2.4 + LR2-04b-bis added, `activities.test.ts` +2 H-1 pins. Existing suites unmodified (425 total = 401 main + 24 new). Mutation-verified: remove tick call → 7 fail; drop WILDS_TOPICS → 10 fail; restore tolerant predicate → LRTL-01 fails; drop INVITATION_TOPICS → 11 fail (final auditor independently reproduced the first mutation: 7/13 fail).

## 6. Browser QA evidence

`docs/architecture/build10-lr-recovery/09-gameplay-verification-report.md` — G1–G7 all PASS with screenshots (`qa-screenshots/`, 10 captures): discovery through the live tick + reload persistence + journal row; wilds check-in through the real dialogue sheet; Nora offer/accept through ordinary dialogue; [E] door entry with the full occupancy triple (Nora seated, station/link/activity); schedule-drift backstop (static + dynamic variants, visible `host_unavailable` refusal); mid-visit reload restoring the triple; general regression + mobile overflow check. 0 console / 0 page errors throughout.

## 7. Independent review record

Five read-only specialists (architecture, Build-10 recovery, LR adversarial, save/migration/determinism, performance) + the independent final release auditor: **MERGEABLE WITH NON-BLOCKING FINDINGS** — byte-identity (md5), decision-record byte-equality, history integrity, code spot-audit, and a self-run mutation all reproduced; the sole actionable finding (doc 14 referenced before existing) is resolved by this document. Findings and disclosed limitations: `08-adversarial-qa-report.md`, doc 12 §3.

## 8. Technical-debt disposition

Deferred register in doc 12 §2 (10 findings: F-UX-1 journal/toast freshness, F-SIM-1 pure-wrapper residents clone, F-SAVE-1/2 sanitizer hardening, F-SAVE-3 uncapped journal + serialize cost, F-ENTER-1 enter-reducer asymmetry, F-WORLD-1 Sorrel-center walkability, F-ASSET-1 QA PNG size, F-DOC-1 historical count, F-PRED-1 inline-predicate coverage) — each with severity, reachability, and rationale; none blocks integration.

## 9. Merge outcome (recorded post-merge)

- **Pull request:** [#5 — Restore Build-10 exploration and reconcile Living Relationships](https://github.com/desurfofficial-ship-it/Little-somewhere/pull/5) (head `a2200eb`, base `eb95d77`, mergeable_state `clean` at merge time)
- **Merge method:** merge commit via the GitHub merge API (the repository's established history-preserving policy, matching PR #1/#4; no squash, no rebase, no force-push, no admin bypass)
- **Merge commit / resulting origin/main HEAD:** **`5681eec`** — `Merge pull request #5 from desurfofficial-ship-it/fix/build10-lr-reconciliation`
- **Merge timestamp:** `2026-11-21T08:16:57Z`
- **CI:** no GitHub Actions workflows exist on this repository (verified during Phase Zero: `.github/` absent) — the authoritative gates are the local suite/tsc/build plus the independent audit, all green on the exact candidate
- **Post-merge verification on the merged tree (fresh worktree at `5681eec`):** `npm test` **425/425 pass** · `npx tsc --noEmit` **0 errors** · `npm run build` **exit 0** · restored step-0 block, both dialogue registrations, strict predicate, H-1 guard, regression suites, docs 01–14, WORKLOG 051–052 and HANDOVER §17 all present on the merged tree (remote tree spot-checked via `git ls-tree`/`git grep` on `origin/main` before the local clone; full local verification after)
- **Branch retention:** `fix/build10-lr-reconciliation` retained on origin (not deleted), per the project's convention of retaining historical branches (cf. `feat/botanical-dressing-micro-life`, `feat/visual-identity-evolution-build-01`)
- **PR #3:** open/draft at head `d615a8e` — untouched by the entire operation (re-verified via the GitHub API after the merge)
