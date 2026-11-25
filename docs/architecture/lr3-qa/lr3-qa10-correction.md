# QA-10 Correction Record — `ci.yml` push trigger verified INTACT

- **Date**: 2026-11-24
- **Status**: QA-10 in `lr3-defect-register.md` is corrected to **NOT-REPRODUCIBLE / CLOSED**; integration-readiness blocker #4 is likewise closed. No code change ships for this item.
- **Re-verification basis**: `origin/main` @ `052e1712`.

## Evidence (three independent methods, same session)

1. **Byte-exact content test, artifact-immune**: counting occurrences with programmatically constructed literals (`chr(91)+'main'+chr(93)` = `[main]`, `chr(93)` = `]`) yields:
   - working tree: 1 × `[main]`, 1 × `ain]` — the latter only as a *substring* of the former;
   - `git cat-file -p origin/main:.github/workflows/ci.yml`: identical counts;
   - working tree byte-identical to the remote blob (`worktree == remote: True`).
   If the file contained the corrupted scalar `branches: ain]`, the `[main]` count would be **0**. It is 1.
2. **YAML parse**: `yaml.safe_load` of the workflow parses the `on.push.branches` trigger as a **list of length 1** containing the string `'main'`. A corrupted `branches: ain]` would parse as a bare scalar string, not a sequence.
3. **Change history**: `git log --all -- .github/workflows/ci.yml` returns exactly one commit (`d45240d`, PR #14) — the file has never been modified since its introduction, so the register's "pre-existing since PR #14" premise cannot produce a different content at the QA campaign's base (`8e08d3b`).

## Root cause of the original finding

The QA campaign environment (and the 2026-11-24 delivery-audit session that first reported the corruption) exhibits a **literal-rewriting artifact** on the exact token `[main]` in command input/output text: typed or displayed occurrences of `branches: [main]` present as `branches: ain]`. Every textual observation of the corruption — including the register's citation and the audit report's claim — matches this artifact signature, while all artifact-immune methods (programmatic counting, YAML parsing, byte comparison) show the file intact. **PR-triggered CI was never affected, and push-triggered CI was never broken.**

## Dispositions

- `lr3-defect-register.md` QA-10 → CLOSED (NOT-REPRODUCIBLE, artifact).
- `lr3-integration-readiness.md` blocker #4 → resolved (no action required).
- The CI-integrity claim in the earlier LR-4 delivery audit (`LR4-DELIVERY-AUDIT.md`, 2026-11-24) is withdrawn on the same evidence.
- Functional proof limitation: the fine-grained token available to this session lacks `actions:read`, so Actions-run history could not be queried via API; the textual + parse + byte-identity evidence above is the basis of record. Post-merge push CI observability remains covered by the live `pull_request` + `push` trigger block verified here.
