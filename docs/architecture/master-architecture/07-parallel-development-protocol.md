# 07 — Parallel-Development Protocol

**Recorded:** 2026-11-22, atop `origin/main` @ `a80a220`.
**Purpose:** let multiple specialist teams work simultaneously with minimal conflicts, predictable interfaces, and controlled integration. This protocol is the operating manual for the ownership matrix (doc 04) and the contracts (doc 06).

**Principle:** in an agent-driven repo, the protocol is only as strong as its machine-checked gates (doc 08). Human ceremony is a fallback, not the primary enforcement.

---

## 1. Branch strategy

| Branch type | Naming | Lifetime | Merge method |
| :--- | :--- | :--- | :--- |
| Feature branch | `feat/<team>-<scope>` (e.g., `feat/lr3-bakery-invitations`) | Short-lived; rebase on `main` before merge | PR merge commit (repo convention, matching PRs #4–#12) |
| Fix branch | `fix/<scope>` | Short-lived | PR merge commit |
| Integration branch | `integrate/<initiative>` (e.g., `integrate/systemic-reliability`) | Initiative-scoped; preserved on remote after merge | PR merge commit |
| Docs branch | `docs/<scope>` | Short-lived | PR merge commit (squash optional for docs) |

**Rules:**
1. **No branch is durable until pushed to `origin/`.** Local-only branches are one worktree deletion away from being lost (the lost-branch incident, doc 08 §5). Push before any non-trivial work.
2. **No branch is durable until tagged on merge.** Every merge to `main` gets `git tag build-<N>-<sha>` (doc 08 §4). Tags are GC-proof.
3. **One branch per cross-team initiative.** Integration branches are preserved on the remote after merge (matching the `integrate/systemic-reliability` precedent).
4. **Base on the actual latest `main`**, not on a stale fetch. Re-fetch before cutting a branch (`doc 04 §5`).
5. **Historical PR protection:** open/draft PRs (#3, #7, #8 at last audit) are never force-pushed or closed by other teams. Their heads are verified via the GitHub API before any integration action.

---

## 2. Schema-bump protocol (the serialized merge-points)

When a team needs to add a persisted field to `WorldState`, the four merge-points (doc 06 §2) serialize the work. **Until Phase D lands**, follow this protocol:

| Step | Action | Owner | Guard |
| :--- | :--- | :--- | :--- |
| 1 | File a cross-team dependency register entry (§6) declaring intent to bump schema to v(N+1) and the field(s) being added. | Proposing team | Entry exists before code starts |
| 2 | Cut `feat/<team>-schema-v(N+1)` from latest `main`. | Proposing team | Branch pushed to `origin/` |
| 3 | Add the field to `WorldState` in `types.ts` (cross-layer portion) — additive only. | Contract lead reviews | `tsc` clean |
| 4 | Write `migrateV{N}ToV{N+1}` in `migrations.ts` (→ `persistence/migrations/v<N+1>.ts` after D1). | Proposing team | Duplicate-version guard test (A4) passes |
| 5 | Add the field to `sanitizeWorldState`'s whitelist (→ per-subsystem sanitizer dispatch after D2). | Proposing team | `save-integrity.test.ts` green |
| 6 | Add the field to `computeWorldSaveRevision` (→ per-subsystem hash fragment after D3). | Proposing team | Autosave fires on changes to the new field (verified by test) |
| 7 | Bump `CURRENT_SCHEMA_VERSION` to N+1. | Proposing team | — |
| 8 | Add the field's owning subsystem to the doc 06 §1 table (in the same PR). | Proposing team | Doc review |
| 9 | Run full `npm test` + `npm run lint` + `npm run build`. | Proposing team | CI green |
| 10 | Open PR; merge via merge commit. | Integration lead | Tag-on-merge fires |

**Parallel schema bumps:** if two teams need to bump simultaneously, they coordinate via the dependency register (§6). The second team rebases on the first's merged PR and bumps to v(N+2). The duplicate-version guard test (A4) prevents both from claiming v(N+1). **After Phase D**, the merge-points become additive registries and the serialization largely disappears.

---

## 3. Guard-test-first rule

**No decomposition extraction (Phase B–E in doc 03) may land before the guard test that proves it preserved behavior.**

| Extraction | Required guard test |
| :--- | :--- |
| Leaf action extraction (B1, E2) | Golden-replay harness: every `scripts/make_*_save.ts` fixture run through every action → byte-identical `JSON.stringify(world)` before/after |
| Input director extraction (B2) | Headless screenshot diff 1440×900 + 390×844; `perfProbe` per-frame allocation count unchanged |
| `PropInteractionResult` move (B3) | `tsc` clean; `DialogueSheet.tsx` dep graph no longer includes `actions.ts` |
| `npcRuntime.ts` extraction (B6) | 528 tests green, zero test edits |
| `SideFlagKey` registry (C1) | Compile-time: unregistered key rejected; dev-mode runtime assert; migration validates |
| `ProgressionReadModel` (C3) | Test asserting every reader field exists in the interface |
| `types.ts` split (C4) | `tsc` clean; `src/scene/`+`src/components/` import only from `src/game/types.ts` |
| Migration split (D1) | Every `make_*_save.ts` fixture migrates to v11 byte-identical; `detectSchemaVersion` unchanged |
| Sanitizer split (D2) | Byte-identical save output; `save-integrity.test.ts` green |
| Revision hash split (D3) | Autosave fires on changes to every persisted field; `storage.test.ts` round-trip green |
| `useGameActions` extraction (E1) | 528 tests green, zero test edits; HUD in sync after reset |
| Scene assembly extraction (E3) | Screenshot diff; `perfProbe` allocation unchanged |
| Character rig merge (E4) | Draw-call count ↓ per `perfProbe`; screenshot diff |
| Journal persistence fold (E5) | Boundary-check script passes; journal-read state migrates with schema |

**If the guard test does not exist, the extraction does not happen.** This is the single rule that makes decomposition safe in an agent-driven repo.

---

## 4. Shared-file change protocol

Changes to shared files (doc 04 §2) require:

1. **PR description lists every consumer affected** (grep the importers).
2. **CI + the relevant guard test pass.**
3. **A reviewer from each affected team signs off** (or the architect waives in the PR with rationale).
4. **The doc 06 contract table is updated in the same PR** if the change affects a field's shape or owner.
5. **`HANDOVER.md` is updated** if the change affects architecture, storage keys, or open backlog (`AGENTS.md` §5).
6. **`WORKLOG.md` entry** is appended per §5 below.

**Renaming a field on `WorldState`:** update every consumer in the same PR + add a migration step that renames the persisted key. **Removing a field:** deprecation cycle (one release with the field ignored-but-present, then removal) + migration that drops it.

---

## 5. WORKLOG entry-number protocol (collisions have already happened)

**The hazard:** WORKLOG Entry 053/054/055 collided between the reliability branch and main's BUILD 02/03/04 work (Entry 056 documents the reconciliation). Three parallel teams each claiming "Entry 057" would collide on merge.

**Protocol:**
1. **Before starting work, re-fetch `main` and read the latest WORKLOG entry number.**
2. **Claim the next number(s) in the cross-team dependency register (§6).** The register is the single source of truth for "who has which entry numbers."
3. **If your branch spans multiple entries, claim a contiguous range.**
4. **On merge, the entry numbers must match the register claim.** If they don't (because another team merged first), renumber in a follow-up commit before merge, preserving historical entries verbatim (no rewrite — doc 00 invariant #6).
5. **Numbering gaps are allowed and preserved** (main's history has gaps at 016/027 — historical, untouched).

**Register entry format:**
```
- [team-lr] claimed WORKLOG Entry 057, 058 for LR-3 bakery invitations (branch feat/lr3-bakery-invitations, 2026-11-22)
```

---

## 6. Cross-team dependency register

**Location:** `docs/architecture/master-architecture/dependency-register.md` (maintained append-only; created by this initiative if teams adopt the protocol) — or, pragmatically, a pinned GitHub issue per initiative. The register is the coordination surface for any work that crosses subsystem boundaries.

**When to file an entry:**
- Adding a resident (touches types + residents + narrative + actions + scene + dialogue).
- Adding an interior (touches types + interior module + actions + scene builder + dialogue + migrations).
- Adding a storyline (touches storylines + narrative + dialogue + actions + possibly sideFlags/StoryFlags).
- Bumping the schema (§2).
- Touching a shared file (§4).
- Any change affecting >1 owning team in doc 04 §1.

**Entry format:**
```
## [YYYY-MM-DD] <initiative>
- Team: <owning team>
- Branch: <branch name, pushed to origin/>
- Scope: <subsystems touched, per doc 04 §1>
- Shared files: <per doc 04 §2>
- Schema bump: yes/no (if yes, v? → v?)
- WORKLOG entries claimed: <numbers>
- Contract surfaces: <per doc 06>
- Reviewers needed: <teams per doc 04 §1 whose contract is touched>
- Status: **use the 6-state vocabulary (directive §9)** — `Proposed` / `In progress` / `Implemented locally` / `Tested` / `Merged` / `Verified in integrated build`. See the transition rule below.
```

**6-state status vocabulary (directive §9) — forward-only transitions:**
1. **Proposed** — design exists in a doc/PR; no code on `main`.
2. **In progress** — code on a feature branch pushed to `origin/`; not yet green on CI.
3. **Implemented locally** — code passes `tsc` + `npm test` + `npm run build` on the branch; not yet reviewed.
4. **Tested** — CI green (test + lint + build + boundary-check + guard test) on the branch AND an independent adversarial review filed with reproducible findings addressed (doc 08 §2).
5. **Merged** — merge commit landed on `main`; tag `build-<N>-<sha>` pushed.
6. **Verified in integrated build** — re-verified on a fresh checkout of merged `main` (doc 08 §8 post-merge step).

**Rule:** No PR description, WORKLOG entry, or `master-architecture/` doc may describe work in a state later than its actual state. Work not yet **Merged** may not be described as "shipped," "complete," or "in the game." Work that is **Merged** but not yet **Verified in integrated build** may be described as "merged" only, never "verified." (Directive §9 / doc 00 standing operating rule (d).)

---

## 7. Dialogue-content ordering protocol

`src/game/dialogue/index.ts` aggregates 22 topic modules in a documented "do not reorder" order (the `dialogueEngine.selectDialogueSession` priority depends on array order; `dialogue.test.ts` golden topics pin it).

**Protocol:**
1. **Adding a topic module:** append to the relevant subdirectory (`everyday/`, `personal/`, `quest/`, `events/`, `interiors/`, `invitations/`); add the import + spread to `dialogue/index.ts` **at the end of its category block**.
2. **Do not reorder existing entries.** The golden topics test (`dialogue.test.ts`) will fail.
3. **Two teams adding topic modules in parallel:** both append; the merge is additive if they append to different category blocks. If they append to the same block, the second-to-merge appends after the first's entry — no conflict on the existing entries.
4. **Removing a topic module:** requires updating the golden topics test in the same PR.

---

## 8. Integration rules

| Rule | Enforcement |
| :--- | :--- |
| No unverified changes merge | CI (test + lint + build) is a required status check (doc 08) |
| No cross-layer import merges | Boundary-check script (doc 08 §3) is a required check |
| No cycle introduced in `src/game/` | Tarjan SCC in boundary-check script |
| No duplicate migration version | Guard test (A4) |
| No WORKLOG number collision | Dependency register (§5) — human-enforced fallback |
| Merge method: PR merge commit | Repo convention (PRs #4–#12) |
| Tag on merge | `git tag build-<N>-<sha>` (doc 08 §4) |
| Historical PRs protected | Open/draft PRs never force-pushed or closed by other teams |
| Original branches preserved on remote after merge | Precedent: `feat/systemic-reliability` preserved |

---

## 9. Conflict-resolution ladder

When two teams' work conflicts:

1. **Rebase the smaller branch onto the larger.** Prefer rebasing the narrower scope.
2. **If the conflict is on a shared file (doc 04 §2):** both teams' reviewers sign off; the contract table (doc 06) is the arbiter.
3. **If the conflict is a schema-version collision (§2):** the second team bumps to N+2; the duplicate-version guard test caught it.
4. **If the conflict is a WORKLOG number collision (§5):** the second team renumbers, preserving historical entries verbatim.
5. **If the conflict is semantic (two teams changed the same reducer's behavior):** the owning team's version wins; the other team adapts. The architect breaks ties.
6. **If the conflict is a contract change (doc 06):** the contract lead (architect) decides; the decision is recorded in doc 03 §6 Decision register.

---

## 10. Anti-patterns (do not)

- **Do not** rewrite a working system because a different implementation is imaginable (initiative boundary).
- **Do not** introduce a dependency without strong justification + explicit architect approval (initiative boundary).
- **Do not** block unrelated development while investigating a subsystem (investigate on a branch; main stays open).
- **Do not** independently rewrite LR-3 (initiative boundary — LR-3 is the next milestone, owned by the LR team).
- **Do not** merge unverified changes (CI must be green).
- **Do not** edit a shared file (doc 04 §2) without the shared-file change protocol (§4).
- **Do not** introduce an event bus / dynamic registry / per-region tick controller (rejected alternatives, doc 03 §5).
- **Do not** take ownership of another team's feature implementation (initiative boundary).
- **Do not** create competing implementations in production code on `main` — compete on *approaches* via subagents off-main, then land one (directive §2 / doc 00 standing operating rule (b)).
- **Do not** describe unmerged work as complete on `main` — use the 6-state vocabulary (§6) honestly (directive §9 / doc 00 standing operating rule (d)).
- **Do not** make irreversible product decisions (adding/removing a resident, interior, storyline, or core gameplay loop) without explicit architect authorization recorded in doc 03 §6 (directive §8 / doc 00 standing operating rule (c)).

---

This protocol is the operating manual. Its enforcement is the gates in doc 08. Its evidence base is the specialist findings in doc 09. Its operating constitution is doc 10.

---

## 11. Consolidated team-report spec (directive §7)

Every team maintains a consolidated report so the central coordinator can see the whole field at once. **Cadence:** one report per merge cycle (whenever a PR merging to `main` touches >1 owning team) OR daily if any team has active in-flight work, whichever is more frequent. Filed as a WORKLOG entry (per §5 numbering) with a structured sub-section, OR posted to the team's coordination channel.

**Format (10 required fields):**

```
## [YYYY-MM-DD] Consolidated team report — <team/initiative>
- Completed this cycle: PR #, tag build-<N>-<sha>, files, owning team, final 6-state status (§6).
- Active work: branch, owner, current 6-state status, blocking on.
- Subagents launched this cycle: agent ID, mission, parent team, findings disposition.
- Files/modules affected: per doc 04 §1 ownership.
- Dependencies: cross-team register entries (§6) filed/merged this cycle; schema bumps.
- Blockers: explicit list with owner + escalation path.
- Test evidence: CI run URL, screenshot diff baselines, golden-replay result if applicable.
- Decisions: any doc 03 §6 Decision register entries this cycle.
- Risks: new/changed risks vs doc 02 W1-W24 + doc 05 §9 coupling register.
- Next: the single highest-leverage next action.
```

**Immediate-escalation rule:** if a cross-team dependency blocks another team's PR, notify the central coordinator the same day (WORKLOG entry prefixed `[BLOCKER]` or direct message). Do not sit on a blocker.
