# Social Foundation — Post-Integration Adversarial Audit
# 02 — Repository and Change Provenance

All facts below were established from git commit objects, the GitHub API, and independent clean-checkout reproduction — **not** from commit messages or prior terminal output.

## 1. Repository state (Phase Zero)

| Item | Verified value | Evidence |
|---|---|---|
| Canonical remote | `github.com/desurfofficial-ship-it/Little-somewhere` | clone + `git remote -v` |
| `origin/main` head | `07be49c2610788f84b58c2410f74f9041dc4b44b` | `git rev-parse origin/main` after fresh fetch (2026-11-22) |
| Working tree | clean (no local modifications at audit start) | `git status --short` |
| Latest main commit | "chore(deps): re-sync bun.lock…" 2026-11-22T03:15:34Z (author) / 03:16:22Z (committer) | `git log -1` |
| Reported head `07be49c` | **matches actual main head** | — |
| Remote branches | 18 (incl. `docs/lr3-design`, `docs/lr3-discovery`, `feat/lr1-implementation`, …) | `git branch -r` |
| Relevant PRs | #3 (open, LR-1 reference), #7/#8 (open, LR-3 discovery/design, stacked), #13 (open), #14 (merged 02:45:11Z) | GitHub API `pulls?state=all` |
| **PR for the Social Foundation** | **does not exist** — no PR has head/merge SHA `8b715fc*`/`07be49c*` (programmatic scan of all 14 PRs) | GitHub API |

## 2. Commit ancestry (from commit objects)

```
a80a220  (pre-PR-14 main)
   │
e3f86b8  Merge PR #14 (docs/master-architecture-governance) — 2026-11-22T02:45:11Z, GitHub web-flow GPG signature
   │
8b715fc  feat(social): Social Foundation SF-1..SF-4 — author 03:15:30Z, committer 03:16:22Z,
   │      author = committer = "Little Somewhere Agent <agent@little-somewhere.local>", UNSIGNED
   │
07be49c  chore(deps): re-sync bun.lock (esbuild ^0.27.0) — author 03:15:34Z, committer 03:16:22Z, UNSIGNED  ← main
```

- Identical committer timestamps (03:16:22Z) on both commits + single CI push-run pair at the tip + one tip-only durability tag ⇒ **both commits landed in one push** (strong inference).
- Commit message of `8b715fc` says "base a80a220" — **stale**: actual parent is `e3f86b8` (PR #14's merge). Author dates post-date the merge, so the work was (re)committed onto post-PR-14 main; the rebase/adaptation was trivial (PR #14 touched zero files overlapping the SF diff — verified). All agent-side gate numbers in the message describe the pre-rebase tree (see doc 11 §4).
- No force-push evidence: ancestry strictly linear; all 24 CI run head-SHAs resolve into current main ancestry (0 orphans); tags consistent. The events-API `forced` flag itself is **UNKNOWN** (no PushEvent entries present for the relevant window — stream incompleteness demonstrated elsewhere in the same window).

## 3. Change-set inventory (G1)

`git diff e3f86b8 8b715fc --stat`: **27 files changed, +4013 / −4**. `07be49c` adds only `bun.lock` (28/28 lines, re-syncing a pre-existing desync: `package.json` declared `esbuild ^0.27.0` while the lock held 0.25.12 — verified at `e3f86b8`).

| Category | Files (change, introducing commit `8b715fc`) | Purpose | Authorization class | Risk |
|---|---|---|---|---|
| New production modules | `src/game/socialProfile.ts` (+546), `src/game/invitationFramework.ts` (+392), `src/game/emergentStories.ts` (+375), `src/game/dialogueContext.ts` (+305), `src/game/dialogue/everyday/reflections.ts` (+60) | SF-1..SF-4 derivation/composition layers + one new dialogue topic | Outside the documentation-reconciliation assignment (production feature implementation) | P2 findings R-01…R-06; no P0/P1 technical |
| Engine seams (modified) | `src/game/dialogueEngine.ts` (+55: clamp + `contextBoosts` param, `requiresWitnessedEvent`, `CATEGORY_PRIORITY` export, echo surfacing branch), `src/game/narrative.ts` (+15: single composition point), `src/game/dialogue/index.ts` (+6: tail append), `src/game/types.ts` (+12: additive `DialogueCondition.requiresWitnessedEvent`), `src/game/journal.ts` (+13: additive `chapter?` field) | additive integration seams | same | verified additive; parity + golden proven |
| UI | `src/components/JournalDrawer.tsx` (+6: one conditional `<p>`) | chapter-line rendering | same | clean |
| Golden snapshot | `scripts/dialogue-topics-golden.json` (count 85→86 + one appended topic) | registry pin regeneration with written justification (doc 22 §5) | same | verified pure append |
| Tests | 4 new files: `socialProfile.test.ts` (+470, SF1-01..20), `invitationFramework.test.ts` (+329, SF2-01..13), `emergentStories.test.ts` (+372, SF3-01..16+02b), `dialogueContext.test.ts` (+472, SF4-01..11+03b) = **62 new tests**; **zero pre-existing test files modified** | coverage | same | 15 mutation survivors = pin gaps (doc 12) |
| Docs | `docs/architecture/social-foundation/{00..04}.md` (new), `docs/architecture/living-relationships/{22,23,24}.md` (new), `00-index.md` (+4) | contracts, decision register, implementation record, adversarial-QA record, LR-4/LR-5 specs | docs — in-scope for the original assignment | doc 10 authority review |
| Worklog | `WORKLOG.md` (Entry 058), `HANDOVER.md` (§20) | chronology | in-scope | stale claims (doc 11 §4) |
| **Deleted lines** | exactly 4: golden `"count": 85`, `const`→`export` on `CATEGORY_PRIORITY`, engine score line (adds clamped boost), `buildResidentDialogue` call (forwards boosts) | — | — | all accounted |
| **Unchanged (verified 0-diff)** | `invitations.ts`, `activities.ts`, `occupancy.ts`, `migrations.ts`, `storage.ts`, `simulation.ts`, `actions.ts`, `relationships.ts`, `memories.ts`, `residents.ts`, all `dialogue/**` except noted, `worldMap.ts`, all `src/scene/**` | chassis/persistence/tick untouched | — | LR-3 reservation honored |

## 4. Baseline reproduction (G2/G3) — exact commands and results

Clean disposable worktree at `07be49c`, fresh `npm install --legacy-peer-deps` (CI-identical):

| Command | Exit | Result |
|---|---|---|
| `npm run lint` (`tsc --noEmit`) | 0 | clean |
| `npm test` (`tsx --test src/game/*.test.ts src/scene/*.test.ts`) | 0 | **595 tests, 595 pass, 0 fail** (≈21–37 s across runs) |
| `npx tsx scripts/check_layer_boundaries.ts` | 0 | "three-layer boundary intact, src/game production acyclic"; 61 game / 61 scene / 11 component files; single known W5 journal.ts localStorage violation (pre-existing, sanctioned, untouched) |
| `npm run build` (vite) | 0 | success; pre-existing >500 kB chunk warning (1.77 MB JS) |
| CI run 44979901609 (GitHub, push `07be49c`) | success | test + typecheck + boundary + build on the shipped tree |

Cross-checks: pre-SF baseline `e3f86b8` = **533/533 pass** (disposable worktree); static count of `test(` calls at HEAD = 595 (405 game + 190 scene). The reported "595/595" is **confirmed**; the commit message's "590/590 (528 inherited)" describes the pre-rebase `a80a220`-based tree and is stale (doc 11 §4, L1/L3).

## 5. Test-count provenance (resolves the 588/590/595 discrepancy)

| Tree | Inherited | New | Total |
|---|---|---|---|
| `f1c2af4` (older base, cited in HANDOVER §19) | 528 | — | 528 |
| `a80a220` (pre-PR-14; the tree the agent's records describe) | 528 | +60 (pre-QA-fix) | 588 |
| `a80a220` + QA fixes | 528 | +62 | 590 ("590/590" in commit message/doc 04) |
| `e3f86b8` (actual parent — PR #14 added 5 migrations-guard tests) | 533 | +62 | **595 = shipped main** |

All agent-side self-reports are internally consistent with the pre-rebase tree; only CI covers the shipped tree. No test was weakened or deleted at any point in the range.
