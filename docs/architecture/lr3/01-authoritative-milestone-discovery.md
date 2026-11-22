# LR-3 Authoritative Milestone Discovery

- **Date**: 2026-11-21 (reconciled 2026-11-22)
- **Status**: Discovery deliverable (Phase One). Docs-only; contains no code changes. Carries the 2026-11-22 reconciliation updates marked **[Reconciled]** — the original 2026-11-21 record is preserved.
- **Authority basis**: `docs/architecture/living-relationships/14-revised-architecture.md` (spec of record) and `15-implementation-readiness-checklist.md`, per their explicit authority clauses. Re-verified intact on current main (the `living-relationships/` document set is byte-identical from `962fb07` through `a80a220`).
- **Companion documents**: `02-current-capability-and-dependency-audit.md` (what exists today), `03-lr3-scope-and-acceptance.md` (what LR-3 must satisfy).
- **Reconciliation provenance**: original record produced against main `962fb07`; re-verified against main `a80a220` after the Systemic Reliability integration (PR #11, merge `f1c2af4`) and its post-merge verification (PR #12) landed. See §1.1 and §8.1.

---

## 1. Verification preamble — the state this discovery was performed against

Per the LR-3 initiative's Phase 0A directive, every reported historical fact was re-verified first-hand against the actual repository before any discovery claim was made. Verified 2026-11-21:

| Item | Verified state | Method |
|---|---|---|
| `origin/main` tip | `962fb07` ("ci: fix Pages deploy…"), containing the PR #5 merge (`5681eec`, Build-10/LR recovery), the PR #6 merge (`78d7d00`, Visual Identity BUILD 02) and subsequent CI/docs commits | `git fetch origin --prune`; `git log` |
| Main baseline health | **447/447 tests pass, `tsc --noEmit` clean, production build green** (pre-existing chunk-size warning only) | full suite + lint + build run on an extracted `962fb07` tree |
| PR #3 (`feat/lr1-implementation` @ `d615a8e`) | Still **open/draft**, head unchanged; **not modified, not merged** — untouched per directive | GitHub API `pulls?state=all` |
| PR #4 / PR #5 / PR #6 | All **merged** (BUILD 01 visual identity; Build-10/LR reconciliation @ `a2200eb` merged as `5681eec`; BUILD 02 @ `28adf85`) | GitHub API |
| Systemic Reliability branch | `feat/systemic-reliability` @ `b71bb3c`, clean worktree preserved locally; **9 commits ahead of base `545e323`; NOT merged into main; NOT pushed to origin** (no `origin/feat/systemic-reliability` exists) | git ancestry check + branch listing |
| Reliability branch health | **459/459 tests pass** on `b71bb3c` (independently reproduced); docs 00–11 + long-run stress harness + save-integrity suite present | full suite run in the preserved worktree |
| LR-3 implementation status on main | **None exists.** Zero occurrences of `share_morning_pastry` in `src/`; `enterBakeryAction` has no invitation/occupancy hook; `SHARED_ACTIVITIES` has one entry (`share_featured_reading`); `INVITATION_TOPICS` aggregates Nora topics only | grep + source inspection |

**Reliability integration gate verdict: NOT satisfied.** The Systemic Reliability initiative remains unmerged and unpublished. Consequences for this initiative, per the hard authorization boundary: discovery, architectural review, dependency analysis, and design work proceed; **no LR-3 implementation that assumes the reliability corrections are integrated**; the branch itself is preserved untouched. Section 8 of this document itemizes exactly which LR-3 conclusions depend on that unmerged work.

**[Reconciled 2026-11-22]** The verdict above was true at `962fb07` and is now historical. §1.1 records the resolution: the gate has been **satisfied via path (a)** of doc 03 §5 — the reliability work is merged into main (PR #11, merge `f1c2af4`) and independently verified post-merge (PR #12; 528/528 re-run first-hand during this reconciliation). No LR-3 conclusion that depended on unmerged work is any longer blocked; §8.1 maps each of §8's four dependencies to its merged location on current main.

### 1.1 Reconciliation-era verification (2026-11-22, first-hand)

Re-verified during the LR-3 reconciliation initiative on a fresh clone; verification commands and results are recorded in WORKLOG Entry 059:

| Item | Verified state | Method |
|---|---|---|
| `origin/main` tip | **`a80a220`** (2026-11-22T00:34:36Z) — "Merge pull request #12 … docs: record PR #11 merge + post-merge verification"; 32 commits after `962fb07` | GitHub API + `git log` |
| Main baseline health | **528/528 tests pass (`npm test`), `tsc --noEmit` 0 errors, production build green** (pre-existing chunk-size warning only) | full suite + lint + build run on `a80a220` |
| Test inventory | **63 files** (30 game + 33 scene); +8 new files since `962fb07` incl. `save-integrity.test.ts` (37 cases) | file census + per-file case count |
| PR #11 (Systemic Reliability integration) | **Merged** as `f1c2af4` (head `integrate/systemic-reliability-current-main` @ `a4afcc9`, 13 commits, 32 files) | GitHub API |
| PR #12 (post-merge verification docs) | **Merged** (`66a296b` → main `a80a220`) | GitHub API |
| PR #3 (`feat/lr1-implementation` @ `d615a8e`) | Still **open/draft**, untouched (base stale vs main; `mergeable_state: dirty`); **not modified, not merged** | GitHub API |
| PR #7 (`docs/lr3-discovery` @ `6fd59c7`) | **Open/draft, preserved untouched** — historical discovery record; conflicts with current main confined to WORKLOG/HANDOVER chronology | GitHub API + `git merge-tree` |
| PR #8 (`docs/lr3-design` @ `b26e0d3`, stacked on PR #7) | **Open/draft, preserved untouched** — historical design record; contains docs 01–09 | GitHub API |
| LR-3 implementation status on main | **Still none exists.** Zero occurrences of `share_morning_pastry` in `src/`; `enterBakeryAction` has no invitation/occupancy hook; `SHARED_ACTIVITIES` has one entry (`share_featured_reading`); no `offerPhases` field anywhere in `src/game` (D10 remains **USER APPROVED — NOT implemented**); `CURRENT_SCHEMA_VERSION = 11` (`migrations.ts:137`) | grep + source inspection |
| Reliability contracts on main | SR-7 stationId registry resolution (`migrations.ts:1772-1773`), window-domain clamp `[360,1290]` (`:1569-1593`), `expiresDay` re-pin (`:1608-1614`), occupancy/`activeActivity` anchoring (`:1716-1823`), save-integrity suite (37 cases) — all **present and pinned on main** | source inspection |

**Reconciled gate verdict: SATISFIED (path (a) executed).** Design/test-planning proceeds on the hardened, integrated main; implementation remains a separate, owner-authorized initiative (doc 03 §5, doc 09 §2).

## 2. Method

Sources inspected (all at `962fb07` unless stated):

- `docs/architecture/living-relationships/00-index.md` through `21-lr1-design-decision-record.md` — in particular `10-milestone-roadmap.md`, `14-revised-architecture.md`, `15-implementation-readiness-checklist.md`, `16`–`19` (acceptance chain), `20`/`21` (as-built notes and locked decisions).
- `docs/architecture/build10-lr-recovery/01`–`14` — in particular `05-lr-design-decision-reconciliation.md`, `13-final-integration-state.md`, `14-merge-and-integration-record.md`.
- `docs/architecture/systemic-reliability/00`–`11` — read in the preserved `b71bb3c` worktree (unmerged; treated as dependency evidence, not as main).
- `HANDOVER.md` (§16, §17 as-built contracts; §1 status block), `WORKLOG.md` (Entries 048–053), `GAME_DESIGN.md` §12, `CHANGELOG.md`.
- `docs/milestones/*` — grep confirmed **zero** LR references; these document Builds 1–10 only, which is why every LR milestone reuses already-shipped interiors.
- Production source cross-checks (`src/game/invitations.ts`, `activities.ts`, `occupancy.ts`, `actions.ts`, `migrations.ts`, `simulation.ts`, `dialogue/invitations/*`, venue modules) and the test suite inventory (55 test files, 447 tests).

Grep performed for: `LR-3`, `LR3`, `share_morning_pastry`, `share_featured_reading`, `Teaching`, `bakery`, invitation/occupancy symbols. Every claim below carries a `file:line` citation.

## 3. The documented LR roadmap

Two document generations describe the LR sequence. The first generation (docs 03–12, including `10-milestone-roadmap.md`) is **historical design**; the second (`14-revised-architecture.md` + `15-implementation-readiness-checklist.md`) is the **spec of record**. The full mapping, with the original wording preserved for traceability:

| Milestone | Doc 10 (original, superseded wording) | Doc 14 §10 (revised, authoritative) | Status on main |
|---|---|---|---|
| LR-1 | "One host: Clara, one activity id reserved (`share_morning_pastry`)" (`10-milestone-roadmap.md:5-32`) | Invitation foundation, host-agnostic lifecycle (`14-revised-architecture.md:282-283`) | **Complete** — built with Nora; `WorldState v10→v11` (`WORKLOG.md:948-964`, `HANDOVER.md:154-158`) |
| LR-2 | "Bakery Home Visit + Shared Pastry" (`10-milestone-roadmap.md:36-64`) | Nook occupancy + `share_featured_reading` — "first proving ground" (`14-revised-architecture.md:286-287`) | **Complete** — `enterNookAction` hook, `completeSharedActivity`, station exclusivity; re-validated by PR #5 recovery |
| **LR-3** | "Teaching Flag + Second Host (Nora or Mina)" (`10-milestone-roadmap.md:68-94`) | **Bakery occupancy + `share_morning_pastry` — "Exclusivity vs knead/share; Clara schedule gate"** (`14-revised-architecture.md:290-291`) | **Not implemented** (see §1) |
| LR-4 | "Copperwheel + Arthur" (`10-milestone-roadmap.md:98-123`) | Teaching flag — one knowledge id (`14-revised-architecture.md:294`) | Not implemented; `teaching.known` slice exists empty, never written (`activities.ts:48-49`, `types.ts:627,788`) |
| LR-5 | Barnaby/Sora/Toby breadth & polish (`10-milestone-roadmap.md:126-138`) | Arthur / Copperwheel — "only after Build 9 has merged" (`14-revised-architecture.md:297`) | Not implemented; **its Build-9 prerequisite is now satisfied** on main |

Order dependency of record: **Build 8 → LR-1 → LR-2 → LR-3 → LR-4 → LR-5** (`14-revised-architecture.md:275-298`, `10-milestone-roadmap.md:144-151`). With Build 8 merged and LR-1/LR-2 complete, **LR-3 is the next dependency-satisfied milestone**.

## 4. Resolving the LR-3 definition conflict

Grep surfaced an apparent conflict: doc 10 defines LR-3 as "Teaching Flag + Second Host (Nora or Mina)" while docs 14/15 define it as "Bakery occupancy + `share_morning_pastry`". Resolution chain, each link carrying explicit authority language:

1. **Doc 14 supersedes docs 03–12.** `14-revised-architecture.md:5`: "**This document supersedes conflicting rules in 03–12.** Those files remain as historical design; implementers follow 14 and 15." Reinforced at `:331` and by condition 1 of its readiness checklist ("Implementers treat document 14 as authoritative over 03–12"). Doc 15 repeats it (`15-implementation-readiness-checklist.md:3`: "`14-revised-architecture.md` overrides 03–12 where they differ"). Doc 13's adversarial review already recommended this exact re-sequencing ("Occupancy proof on Nora's nook… Teaching on the second host. Arthur only after Build 9", `13-adversarial-review.md:198-203`).
2. **Docs 16–19 defer to doc 14** (`16-lr1-lr2-acceptance-test-plan.md:4`: "Authority: 14-revised-architecture.md (spec of record)"; `19-final-acceptance-readiness-review.md:72`: "Knowledge grants remain LR-4 per document 14 §10").
3. **Docs 20–21 do not modify 14–19** (`20-lr1-implementation-notes.md:4`) and lock only gate-4 scope and LR2-04b staging (`21-lr1-design-decision-record.md`).
4. **build10-lr-recovery docs (PR #5) name doc 14 as "sources of record"** (`05-lr-design-decision-reconciliation.md:3`) and reconcile *decisions*, not the milestone order (`14-merge-and-integration-record.md:28`).
5. **HANDOVER never redefines LR-3.** Its "Target Next Milestone: LR-3+" (`HANDOVER.md:5`) is consistent with doc 14's ordering (Hearth & Crumb named first among the LR-3+ venues).
6. **Nothing after the PR #5 recovery through `962fb07` changes this.** WORKLOG Entries 051–053 record recovery and BUILD 02; neither touches LR scope.

**Verdict: doc 14 §10 + doc 15 §3 are the authoritative definition of LR-3.** Doc 10's "Teaching Flag + Second Host" is historical design. The confusion is real but settled — an implementer reading doc 10 alone would mis-scope LR-3 (its doc-10 test expectations at `10-milestone-roadmap.md:84-91` — knowledge granted once, dialogue seeing knowledge, migration defaults — belong to **LR-4** under the revised order).

## 5. The authoritative LR-3 definition

> **LR-3 = Hearth & Crumb Bakery interior occupancy + the shared activity `share_morning_pastry`, hosted by Clara — with station exclusivity against the existing knead/share rituals, and Clara's schedule gate. Teaching is not part of LR-3 (it is LR-4).**

Decisive citations: `14-revised-architecture.md:290-291` (§10 map), `15-implementation-readiness-checklist.md:85-90` (LR-3 battery), `16-lr1-lr2-acceptance-test-plan.md:411` ("Bakery knead/share exclusivity (LR-3)" explicitly out of LR-1/LR-2 scope), `20-lr1-implementation-notes.md:84` ("LR-3 (bakery) … intentionally **not** implemented here").

Scope items established by the authoritative documents:

1. **Second interior occupancy.** The bakery (`bakery_interior`) gains the same door-enter pattern as LR-2: occupant set only in the enter reducer after `isInvitationLive` + `isHostAvailableForActivity`, cleared by exit/expire/complete/day-advance/sanitizer (`14-revised-architecture.md:142-160`; as-built reference `actions.ts:2973-3016`). Occupancy rides the existing single global slot (`types.ts:787`) — one interior host at a time remains the architecture.
2. **New activity def `share_morning_pastry`** (host Clara, location `bakery_interior`) appended to the data-driven `SHARED_ACTIVITIES` registry (`activities.ts:52-72` pattern; "Registry is data-driven so later hosts are content, not architecture", `12-risks-and-mitigations.md:31`). The id was reserved in the original plan (`10-milestone-roadmap.md:9`) and carried into the revised map.
3. **Station exclusivity vs knead/share** (`14-revised-architecture.md:203-209`): while the activity is active or the invite live at the station, the linked station's ordinary primary action is suppressed or visibly refused; the shared activity must not mutate `kneadedDay`, `loafSharedDay`, `kneadingSessions`, `loavesShared`, `shelfBrowsedDay`, `teaSharedDay`, `booksRead`, or greenhouse plot fields. The bakery-specific hazard is pre-documented: knead/share day-stamps could co-fire with the shared activity in the same minute (`13-adversarial-review.md:91`).
4. **Clara schedule gate**: offer suppressed when her phase slot is away from home (`15-implementation-readiness-checklist.md:90`), per the generic 6 m home-radius gate (`14-revised-architecture.md:69`; `INVITATION_HOME_RADIUS = 6.0`, `invitations.ts:59-79`). Clara's morning slot (Bakery Porch, ≈1.0 m from `homePos`) is eligible; her afternoon slot (Fountain Plaza, ≈6.9 m [Reconciled `a80a220`: **8.938 m** — corrected with primary-source recomputation in doc 04 §1.2/§10.1; conclusion unchanged]) auto-blocks afternoon offers with no code change.
5. **No teaching grant in LR-3.** `teaching.known` stays unwritten until LR-4 (`14-revised-architecture.md:294`; `17-acceptance-plan-audit.md:148`; `19-final-acceptance-readiness-review.md:72`).
6. **Clara invitation dialogue topics** in a new `src/game/dialogue/invitations/clara.ts` module — "New topics live in `src/game/dialogue/invitations/` (one file per host)… Do not append invitation topics to the `DIALOGUE_TOPICS` literal" (`14-revised-architecture.md:243-244`); the aggregator currently spreads only `NORA_INVITATION_TOPICS` (`dialogue/invitations/index.ts:4-6`), and the golden-snapshot contract must be regenerated with behavioral justification.

Named entities: **Hearth & Crumb Bakery** (Build 7 interior, shipped and pinned by tests), **Clara** (host; `residents.ts:29-88`). Nora is the LR-2 host already done; Mina/Sunbeam Greenhouse and Arthur/Copperwheel are **not** in LR-3 per doc 14 (see §7, ambiguity 1).

## 6. What LR-3 is NOT

- **Not teaching.** Any knowledge-grant behavior belongs to LR-4; the `teaching.known` field must remain empty after LR-3 completions.
- **Not a second simultaneous host.** `canOfferInvitation` enforces one active invitation globally (`invitations.ts:159-199`) and `occupancy` is a single slot — LR-3 keeps that design.
- **Not a new framework.** No second memory system, no social-event framework, no new UI surface; the `SHARED_ACTIVITIES` registry, `completeSharedActivity`, occupancy module, journal invitation card and simulation skip are already host- and venue-generic (doc 02 §5).
- **Not greenhouse/Copperwheel.** Mina's greenhouse has no seat spots and no occupant rig; Arthur/Copperwheel is LR-5 sequencing. HANDOVER's looser "LR-3+" phrasing is an umbrella, not a re-scope.
- **Not real-world-time progression.** All gating stays on in-game phases/days, per design principle 4.

## 7. Open ambiguities that documents alone cannot resolve

These require design decisions (to be pinned in doc 03 §2 before implementation):

1. **Venue scope of "LR-3+"**: doc 14 is bakery-only; `HANDOVER.md:5` also names Sunbeam Greenhouse and Copperwheel as LR-3+ candidates. Doc 14 wins by its authority clause; whether the project owner intends LR-3 strictly as Clara/bakery (this document's reading) is a project-owner confirmation, not decidable from documents.
2. **`share_morning_pastry` def parameters** — window minutes, `minTier`/`minAffinity`, `seatPos`/`seatFacing`, `stationId`, memory id/title, `npcMemoryTag` — are unspecified in any authoritative doc; only the superseded doc 06 sketch (`06-shared-activity-framework.md:55`: Clara / bakery table / 8 min / memory `clara_tea_and_crumb`) is indicative. The D-17 window-cap policy (recovery doc 05 §3) requires the window cap to be Clara's contiguous-home-availability boundary — computed, not copied from Nora's 719.
3. **Which bakery station anchors the occupant**: doc 06 says "Bakery table"; doc 13:91 flags the sit-clash between doc 04's `bakery_table` and the as-built café chair; as-built `BAKERY_SEAT_SPOTS` contains only `bakery_seat_cafe_west` (`bakery.ts:297-308`).
4. **Clara offer discoverability**: Nora's offer is story-gated behind the postcard quest (`flags.foundPostcard`); whether Clara's invitation needs a designed story gate or surfaces on tier/affinity alone is unspecified (recovery doc 05 §5 documents the Nora pattern).
5. **Venue-named feedback**: the accept toast hardcodes "inside Linden Book Nook" (`actions.ts:897-907`); LR-3 should derive the venue from the activity def (one-line architecture tweak, listed in doc 02 §5).

## 8. Dependence on the unmerged Systemic Reliability initiative

The reliability branch (`b71bb3c`) contains no LR-3 mention, but four of its findings are **directly load-bearing for LR-3**. The following conclusions in this discovery depend on work that exists **only on the unmerged branch**:

| # | LR-3 conclusion | Depends on (unmerged) | Evidence |
|---|---|---|---|
| 1 | Bakery enter must reconcile invitation expiry — and per the recorded revisit condition, the reconciliation should move to a **shared enter path** rather than be duplicated per venue | Deferred finding **F-ENTER-1**: "Revisit when: a second interior gains an invitation-gated activity (then the reconciliation should move to the shared enter path)" | `docs/architecture/systemic-reliability/11-deferred-findings.md` (branch); baseline `actions.ts:2960` vs `2112/2157/2664/3287` |
| 2 | Any new persistent field gets deterministic defaults + domain rules + one classified warning per violation at the save/load choke point, and GUARD coverage | **Persistence contract of record** (reliability docs 03 §2, 06 §3–4; HANDOVER §18 on the branch) | branch `save-integrity.test.ts` (33 tests), `migrations.ts` enforcement |
| 3 | The new bakery `stationId` must resolve against `SHARED_ACTIVITIES[activityId].stationId` or occupancy is cleared + warned on load | **SR-7 fix** (stationId reference resolution) | branch `migrations.ts` (~1716-1719) |
| 4 | Second-host invitation windows must respect enforced domains (`[360,1290]`, `expiresDay === offeredDay`, `offeredDay ≤ day`) and the strict live/expired predicate | **SR-5/SR-6 fixes + D-03 strict predicate** (D-03 itself is already merged via PR #5; the sanitizer enforcement is branch-only) | branch `migrations.ts` (~1532-1590), `invitations.ts:119` (merged) |

Mitigating facts (verified): the branch changes **no schema version, no WorldState types, no migrations chain** (`types.ts` byte-identical between `962fb07` and `b71bb3c`); both directions of save compatibility hold at v11; the eventual merge surface is disjoint from main's BUILD 02 changes (reliability touched `migrations.ts`/`storage.ts`/`journal.ts`/`storylines.ts`/`simulation.ts` — main touched `src/scene/*`), so merge conflict risk is low and confined to five files with small text overlaps.

**Consequence for execution order** (formalized in doc 03 §5): LR-3 implementation should not begin until either (a) the reliability branch is published, reviewed and merged — then LR-3 builds on the hardened boundary; or (b) the project owner explicitly authorizes LR-3 to proceed on unhardened main, in which case the F-ENTER-1 shared-enter-path correction and the persistence-contract equivalent must be re-derived inside the LR-3 branch itself, clearly attributed, and re-reviewed when the reliability work lands.

### 8.1 Reconciliation update — the four dependencies are now main contracts (2026-11-22)

Path (a) was executed: PR #11 merged the Systemic Reliability initiative into main (merge `f1c2af4`), PR #12 recorded post-merge verification, and this reconciliation re-ran the full suite first-hand (**528/528**, `tsc` clean, build green on `a80a220`). Each of the four load-bearing items above is now verified on current main:

1. **F-ENTER-1**: the finding is carried verbatim in the integrated record (`docs/architecture/systemic-reliability-integration/06-deferred-findings.md`, "F-ENTER-1 — enter-reducer asymmetry — P3, deferred") with the revisit condition intact and the investigation explicitly owned by the LR-3 design record (PR #8). Code asymmetry re-verified first-hand: `enterNookAction` (`actions.ts:2960-3034`) still reconciles; `enterCottageAction` (`:2112-2136`), `enterGreenhouseAction` (`:2157-2181`), `enterBakeryAction` (`:2664-2688`), `enterCopperwheelAction` (`:3287-3311`) still do not; no shared helper exists; `setOccupant` retains exactly one call site (`actions.ts:2991`). The reliability merge did not touch `actions.ts` (byte-identical `962fb07`→`a80a220`), so doc 05 §9's investigation stands unchanged on the integrated tree.
2. **Persistence contract of record**: live on main — sanitizer classification/warnings (`migrations.ts:1532-1844`), tombstone-before-rewrite and future-version reject (`storage.ts`), save-integrity suite `src/game/save-integrity.test.ts` (**37 cases**) — and binds any LR-3 work that touches persisted state (doc 03 S7; D7 keeps LR-3 registry-only, so none is needed).
3. **SR-7 stationId resolution**: shipped — `migrations.ts:1772-1773` requires `occ.stationId === SHARED_ACTIVITIES[active.activityId].stationId` else occupancy is cleared with `"inconsistent interior occupancy cleared on load"`; pinned by `save-integrity.test.ts` (SR-7 fixture). Doc 05 §12 and doc 06 LR3-34/LR3-81 are updated from gate-conditional to this unconditional main behavior.
4. **Invitation domain enforcement**: shipped — window clamp `[360, DAY_END_MINUTE]` + warning (`migrations.ts:1569-1593`), `expiresDay` re-pin to `offeredDay` (`:1608-1614`), `offeredDay ≤ day` (`:1605`), strict predicate duality (`invitations.ts:119-125`, merged since PR #5).

The branch-era merge-surface analysis above (disjoint files, small conflicts, WORKLOG renumbering) is preserved as historical record; its prediction was borne out by PR #11's integration record (`docs/architecture/systemic-reliability-integration/02-compatibility-audit.md`, `07-final-integration-audit.md`).

## 9. Verdict

1. **LR-3 is fully discoverable from authoritative project evidence** — it is not an invented feature list. The repository's spec of record (doc 14 §10 + doc 15 §3) defines it precisely, its acceptance battery exists, and every mechanism it reuses is implemented, tested and pinned on main.
2. **LR-3 is the next dependency-satisfied milestone**: Build 8 merged; LR-1/LR-2 complete and re-validated by PR #5; 447/447 green at `962fb07`.
3. **The next step is Phase Two research** (how the bakery shared activity should behave and feel), then target architecture (doc 05) and the acceptance test plan (doc 06) — all design work. **Implementation is gated** by the reliability integration gate per §8, consistent with the initiative's authorization boundary.

**[Reconciled 2026-11-22]** 4. The reliability integration gate has resolved via path (a) (§1.1, §8.1); the hardened baseline is **528/528 / `tsc` clean / build green** on `a80a220`. LR-3 remains **unimplemented** on main, and implementation remains unauthorized until the owner approves the reconciled documentation for merge and opens the implementation initiative — the documentation deliverables (docs 01–09, reconciled) are the complete, verified specification that initiative will execute.
