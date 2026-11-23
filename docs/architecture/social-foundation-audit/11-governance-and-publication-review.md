# Social Foundation — Post-Integration Adversarial Audit
# 11 — Governance and Publication Review

Classifying the direct-to-main publication as a governance incident: not exaggerated into a technical defect, not ignored because the tests passed.

## 1. Evidence chain (what happened)

| Time (2026-11-22 UTC) | Event | Evidence |
|---|---|---|
| 00:34:37 | PR #12 merged → `a80a220` | GitHub API |
| 02:45:11 | **PR #14 merged** → `e3f86b8` (master-architecture governance + CI + boundary script + migration guard; GitHub web-flow GPG signature) | API + `git log %G?` |
| 03:15:30 / 03:15:34 | Author dates of `8b715fc` (SF) and `07be49c` (bun.lock) | commit objects |
| 03:16:22 | Identical committer dates on both commits | commit objects |
| 03:16:54 | CI runs created, `event=push`, head `07be49c`, `pull_requests: []`, **actor `desurfofficial-ship-it`** (GitHub records the authenticated pusher) | run 44979901609 JSON |
| 03:17:15 | Pages deploy succeeded — **live site published the SF content** | deploy run (build-only, no tests) |
| — | Durability tags fired tip-only (`build-07be49c26107`) | `git ls-remote --tags` |

Established: (a) exactly two commits pushed, one parent chain, single-push reconstruction (strong inference from identical committer timestamps + one CI push pair + one tip tag); (b) **no PR exists** for either commit (programmatic scan of all 14 PRs — zero SHA matches); (c) no force-push **evidence** (linear ancestry, 0 orphaned CI-run SHAs, tags consistent) while the `forced` flag itself is **UNKNOWN** (events-stream PushEvent entries absent for the whole window — stream incompleteness demonstrated elsewhere, so absence of evidence is not evidence of absence); (d) both SF commits **unsigned** (`verified=false reason=unsigned`) from the unlinked identity `agent@little-somewhere.local`; (e) actor attribution: the CI run's actor field is the only GitHub-recorded link between the push and an account — the concrete credential (which PAT/key) and whether a human initiated or approved the push are **UNKNOWN**.

## 2. Technical vs process acceptability — explicitly separated

**TECHNICAL: SUPPORTED.** CI (test + typecheck + boundary + build) passed on the shipped tree; this audit independently reproduced every gate (doc 02 §4) and found no P0/P1 technical defect (docs 03-08, 12). The code deserves to remain.

**PROCESS: FAILED.** The repository's own release protocol — `master-architecture/08-integration-and-release-strategy.md` §8 ("Merge method: GitHub PR merge commit (repository convention, matching PRs #4-#12)") and §12 ("Merge via PR merge commit; verify pre- and post-merge") with its pre-merge checklist — was merged **2 hours 29 minutes earlier** via PR #14, and the very next publication bypassed it entirely: no PR, no reviewable diff, no independent review (the adversarial-QA record is authored within the same commit/identity as the code), unsigned commits, and recorded gate numbers describing a tree that was never shipped (doc 11 §4). Even the checklist's first item ("branch based on actual latest main") is contradicted by the recorded base (`a80a220` vs actual parent `e3f86b8`).

## 3. Control assessment

- **CI is reactive, not a publication gate.** `ci.yml` triggers on PR + `push: main`; a direct push lands first and CI runs ~32 s later. Required status checks gate PR merges, not direct pushes. Nothing blocked or could have blocked the publication.
- **The public site ships before tests conclude:** `deploy-pages.yml` builds and deploys on push with no test step and no environment protection; the live site carried the SF code 21 s after CI started.
- **Branch protection: UNKNOWN.** The API returns 403 ("Resource not accessible by personal access token") — existence, rules, and bypass lists cannot be verified with the available token. The `ci.yml:6` comment ("This workflow is a REQUIRED status check. No PR merges without it passing.") asserts a repository setting the file cannot enforce and whose truth is unverifiable — if protection is absent, the comment misdescribes the actual merge policy (P3 governance-doc defect).
- Ancestry/commit hygiene: intact; no history rewrite found.

## 4. Self-reported record accuracy (WORKLOG Entry 058 / HANDOVER §20 / commit message)

Verified claims: 62 new tests (total correct; per-module ranges mislabeled: SF3 is 01..16+02b = 17, SF4 is 01..11+03b = 12); LR-3 boundary mechanically verified (re-verified TRUE); golden 85→86 with justification (TRUE); clamp/reunion constants (TRUE); QA fixes F1/F6/F10 present in code (TRUE).

False/stale claims: "base a80a220" (actual parent `e3f86b8`) — systematic across commit message, WORKLOG, doc 03, doc 23; "590/590 (528 inherited)" (actual shipped tree: 595/595, 533 inherited) — doc 04's "final gates of record" line is arithmetically possible only on the pre-rebase tree, so **the recorded agent-side gates never ran on the shipped tree** (CI is the only shipped-tree evidence); doc 00/22 "588/588" (pre-QA-fix count); "Entry 057" cross-ref (actual 058); WORKLOG "ten scenario classes" (doc 04's table has eleven); HANDOVER §19's "authoritative main: f1c2af4" left stale by §20; "five historical call sites" file list wrong (`invitations.ts`/`activities.ts` contain zero such fallbacks). Browser-QA claims carry no committed artifacts (self-report only) — independently re-executed in this audit (doc 07 §2) with the same outcome. **No documentation claim masks a code defect** — every load-bearing claim (clamp, cancellation truthfulness, predicate reuse, LR-3 absence, golden tail, band math) was verified against code and holds; the stale numbers misreport evidence, not behavior.

## 5. Minimum controls to prevent recurrence (recommendations only — nothing changed)

1. **Enable branch protection on `main`** with "Require a pull request before merging" (≥1 review) — the *only* control that actually blocks direct-to-main publication; required-status-checks alone do not.
2. Scope the agent's push credential to a fine-grained PAT with `Contents: write` on feature/docs branches only (no `main` path), or a ruleset exempting only a human-maintained account.
3. Require commit signing (push signature verification) so push actor and commit authorship are separately attributable.
4. Make the Pages deploy conditional on CI success (`workflow_run` after `ci.yml` success, or an environment protection rule) — today the public site ships untested.
5. Align the `ci.yml:6` comment with the actual repository settings (or make the claim true by enabling required checks).

## 6. Incident disposition

Documented (this document set); contained by (i) the audit itself independently validating the shipped tree, (ii) recommendations 1-5 awaiting owner action, (iii) no evidence of recurrence or history tampering. Acceptance of the code does **not** retroactively authorize the push; the publication-path failure stands as the audit's sole P1 finding (process class).
