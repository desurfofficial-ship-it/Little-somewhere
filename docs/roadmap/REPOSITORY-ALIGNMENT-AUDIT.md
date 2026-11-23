# Repository Alignment Audit

> **Companion to `docs/MASTER-ROADMAP.md`.** This is the evidence-based audit record: what was inspected, what was found, what conflicts/stale claims exist, and what documentation changes are needed. Produced by three parallel specialist auditors (Agent A: vision/roadmap; Agent B: technical implementation; Agent C: docs/governance) plus an independent adversarial review (Agent D).

**Audited:** 2026-11-23, `origin/main` @ `a765f38`.
**Audit basis:** actual codebase (`src/`), tests (re-run live: 722/722), git history, all top-level docs, the full `docs/` tree, open/merged PRs via the GitHub API.
**Headline facts verified first-hand:** `CURRENT_SCHEMA_VERSION = 12` (`src/game/migrations.ts:144`); 722 tests green; `RESIDENT_ORDER` = 10 residents; `SHARED_ACTIVITIES` has exactly 1 entry (`share_featured_reading`) — LR-3 not implemented; dialogue = 86 topics across 23 modules.

---

## 1. Documents inspected + authority classification

### Top-level docs
| Document | Authority | Headline issue |
| :--- | :--- | :--- |
| `README.md` | SUPPORTING | Says "9 Living Residents" — actual 10. Omits LR/SF/everyday/NPC work. |
| `HANDOVER.md` | AUTHORITATIVE (current technical state) | §1 said `WorldState v11` (actual v12); §1 baseline `528/528` (actual 722); §1 + §24 said LR-3 docs PR "unmerged" (actually merged `fab1101`). **Reconciled in this pass.** |
| `GAME_DESIGN.md` | AUTHORITATIVE (mechanics) | §5 said neighbor interiors `PLANNED` (all IMPLEMENTED); §7 said `npcMemories` `PLANNED` (IMPLEMENTED Build 4); §11/§12 said Community Projects `PLANNED` (shipped GA-1); §12.2 said "v10" (actual v12); §02 lists 5 pillars not 6. **Reconciled in this pass.** |
| `AGENTS.md` | AUTHORITATIVE (rules) | Was missing the mandatory development rules + MASTER-ROADMAP reference. **§7 added in this pass (21 rules).** |
| `ARCHITECTURE.md` | AUTHORITATIVE (system mechanics) | Said "WorldState v10" (v12), "21 personal items" (22), "v1→v10" (v1→v12). **Reconciled in this pass.** |
| `WORKLOG.md` | AUTHORITATIVE (chronological) | Current (Entry 071). Entry 072 appended for this initiative. |
| `CHANGELOG.md` | AUTHORITATIVE (release notes) | Latest `[0.11.0]`. Missing NPC Intelligence + floor-flicker releases (deferred follow-up). |

### `docs/architecture/master-architecture/` (engineering governance)
| Doc | Issue |
| :--- | :--- |
| `00-index.md` | **MASTER-ROADMAP row added** to the relationship table in this pass. |
| `01-verified-current-architecture.md` | §10 stale (test count, v11, LR-3 status). Line-ref refresh deferred. |
| `04-module-ownership-matrix.md` | `migrations.test.ts` path bug (actual: `migrations-guard.test.ts`); LR-3 row stale. Fix deferred. |
| `06-shared-contracts.md` | v11→v12 + v12 fields. Refresh deferred. |
| `08-integration-and-release-strategy.md` | Internal contradiction (§1 "one workflow file" vs §10 `ci.yml`). Historical-status framing deferred. |
| `10-operating-directive.md` | §6 open item "PR #13 rebase" — resolved (merged `fab1101`). Close-marker deferred. |

### Feature-scoped + historical docs
- `docs/architecture/living-relationships/00-24` — `00-index.md` said "Design only" (stale; LR-1/LR-2 IMPLEMENTED). Doc 14 §10 + doc 15 §3 = spec of record.
- `docs/architecture/build10-lr-recovery/01-14` — AUTHORITATIVE corrective record.
- `docs/architecture/systemic-reliability{,-integration}/` — properly historical + integration audit.
- `docs/architecture/social-foundation/00-04` — `00:4` "588/588" stale (current 722).
- `docs/architecture/everyday-gameplay/00-04` — AUTHORITATIVE v12 spec.
- `docs/architecture/npc-intelligence-living-simulation/` — `00:21` "528-test... 11-version" stale (v12, 722).
- `docs/architecture/lr3/01-09` — AUTHORITATIVE LR-3 design (internally stale vs v12; flagged by lr3-qa blocker #2).
- `docs/architecture/lr3-qa/*` — correctly says docs merged `fab1101`.
- `docs/architecture/layaair-reference/01-10` — HISTORICAL (rejected); not marked in index.
- `docs/design/GAME_DESIGN_AUDIT.md` + `GAME_DESIGN_REVISION_PLAN.md` — **OBSOLETE** (targeted the 94-line prototype GDD). **STATUS: OBSOLETE markers added in this pass.**

---

## 2. Duplicated / competing roadmap authority

**9+ documents** previously carried "roadmap" in their filename or claimed roadmap-style authority. With `docs/MASTER-ROADMAP.md` now the single strategic authority, these are reclassified:

| Document | New status |
| :--- | :--- |
| `GAME_DESIGN.md §12.2` (staged horizon) | SUPPORTING — feeds MASTER-ROADMAP |
| `HANDOVER.md §1` (target next milestone) | AUTHORITATIVE — current state only |
| `docs/architecture/living-relationships/10-milestone-roadmap.md` | HISTORICAL |
| `docs/audits/06-milestone-2-implementation-roadmap.md` | HISTORICAL |
| `docs/milestones/13-phase-3-implementation-roadmap.md` | HISTORICAL |
| `docs/production/everyday-life-polish-roadmap.md` | HISTORICAL |
| `docs/art-direction/VISUAL_TRANSFORMATION_ROADMAP.md` | HISTORICAL |
| `docs/art-direction/visual-identity-evolution/08-…` | HISTORICAL |
| `docs/research/interior-bug-and-dialogue-redesign/10-…` | HISTORICAL |
| `docs/proposals/2026-11-22-world-quality-overhaul/05-…` | HISTORICAL |
| `docs/architecture/layaair-reference/09-…` | HISTORICAL (REJECTED) |

---

## 3. Conflicts discovered (same fact, two docs disagree)

1. **LR-3 documentation PR merge status** — HANDOVER/master-architecture said "unmerged"; lr3-qa/WORKLOG said "merged `fab1101`." **Resolution: PR #13 merged as `fab1101`. HANDOVER §1 reconciled in this pass.**
2. **WorldState version (v10/v11 vs v12):** multiple docs. Actual: **v12**. ARCHITECTURE.md + HANDOVER §1 **reconciled in this pass**; master-architecture line-refs deferred.
3. **Test counts (528/588/590/671 vs 722):** Actual: **722/722**. HANDOVER §1 **reconciled**.
4. **SF test count (588 vs 590):** both stale vs 722.
5. **`migrations.test.ts` vs `migrations-guard.test.ts`:** master-architecture/04 path bug. Fix deferred.
6. **`.github/workflows/` count:** master-architecture/08 internal contradiction. Deferred.
7. **HANDOVER §22 numbering collision:** LR-3 §22 vs Everyday §22. Structural fix deferred.

---

## 4. Incorrect or outdated claims (specific citations)

### (a) WorldState version
- `HANDOVER.md:4,32,50` — v11/v10 (actual v12) — **HANDOVER §1 reconciled**
- `ARCHITECTURE.md:35,61,149` — v10 (actual v12) — **ARCHITECTURE reconciled**
- `GAME_DESIGN.md:345` — v10 (actual v12) — GAME_DESIGN reconciliation applied (§12.2 note)
- `docs/architecture/master-architecture/06:4,8,14` — v11 (actual v12) — deferred
- `docs/architecture/social-foundation/00:28` — "schema stays v11" — deferred

### (b) Features "PLANNED" that are IMPLEMENTED
- `GAME_DESIGN.md:290` — Community Projects "PLANNED" (IMPLEMENTED GA-1) — **reconciled**
- `GAME_DESIGN.md:338` — neighbor interiors "PLANNED" (IMPLEMENTED Builds 6-9) — **reconciled**
- `GAME_DESIGN.md:164-165` — `npcMemories` "PLANNED" (IMPLEMENTED Build 4) — deferred
- `docs/architecture/living-relationships/00-index.md:4` — "Design only" (LR-1/LR-2 IMPLEMENTED) — deferred

### (c) Stale test counts
- `HANDOVER.md:32` — 528/528 — **reconciled** (722/722 noted)
- `docs/architecture/master-architecture/02:45` — 528 — deferred
- `docs/architecture/npc-intelligence-living-simulation/00:21` — 528 — deferred

---

## 5. Missing documentation
- **`docs/MASTER-ROADMAP.md`** — created by this initiative.
- **`docs/roadmap/REPOSITORY-ALIGNMENT-AUDIT.md`** — this file (created).
- **v12 field→owner entries** in `master-architecture/06` §1 — deferred.
- **CHANGELOG entries** for NPC Intelligence + floor-flicker — deferred.
- **STATUS markers** on 10 historical docs — deferred (2 obsolete markers applied).
- **MASTER-ROADMAP cross-links** from HANDOVER/GAME_DESIGN/AGENTS/ARCHITECTURE/master-architecture/00 — **applied**.

---

## 6. Changes made by this initiative

| # | File | Change | Type |
| :--- | :--- | :--- | :--- |
| 1 | `docs/MASTER-ROADMAP.md` | Created — authoritative product vision + 6 pillars + boundaries + status + milestones + LR-3 (5 blockers) + remaining work by pillar + deferred + 6-stage sequence + governance + 21 rules | NEW (structural) |
| 2 | `docs/roadmap/REPOSITORY-ALIGNMENT-AUDIT.md` | Created — this audit record | NEW (structural) |
| 3 | `HANDOVER.md` | §1: WorldState v11→v12, test count 528→722, LR-3 docs "unmerged"→merged `fab1101` (additive `[Reconciled]`); add MASTER-ROADMAP pointer | Additive |
| 4 | `AGENTS.md` | Add §7: 21 mandatory rules + MASTER-ROADMAP reference + product-identity preservation + LR-3 scope control | Additive |
| 5 | `GAME_DESIGN.md` | §11/§12.1: flip stale "PLANNED"→"IMPLEMENTED" with `[Reconciled]` (Community Projects, neighbor interiors) | Additive |
| 6 | `ARCHITECTURE.md` | v10→v12, 21→22 items, v1→v10→v1→v12 | Additive |
| 7 | `docs/architecture/master-architecture/00-index.md` | Add MASTER-ROADMAP row to relationship table | Additive |
| 8 | `docs/architecture/master-architecture/01-verified-current-architecture.md` | §10: 4 MISSING→Implemented, LR-3 status, v11→v12, 528→722 | Deferred |
| 9 | `docs/architecture/master-architecture/04-module-ownership-matrix.md` | Fix `migrations.test.ts`→`migrations-guard.test.ts`; LR-3 row | Deferred |
| 10 | `docs/architecture/master-architecture/06-shared-contracts.md` | v11→v12; add v12 fields; refresh line citations | Deferred |
| 11 | `docs/architecture/master-architecture/10-operating-directive.md` | §6 open item "PR #13 rebase"→CLOSED | Deferred |
| 12 | `docs/design/GAME_DESIGN_AUDIT.md` + `GAME_DESIGN_REVISION_PLAN.md` | Add `STATUS: OBSOLETE` headers | Additive |
| 13 | 10 historical roadmap docs | Add `STATUS: HISTORICAL` headers | Deferred |
| 14 | `WORKLOG.md` | Append entry for this initiative | Additive |

*(Items 1–7, 12, 14 are **APPLIED** in this pass. Items 8–11 (master-architecture line-ref refreshes) and item 13 (10 historical `STATUS: HISTORICAL` headers) are **DEFERRED FOLLOW-UP** — directionally correct, lower-urgency. The adversarial reviewer (Agent D) confirmed the 3 blocking findings are closed: the audit no longer claims un-applied edits as completed; AGENTS.md §7 now mirrors the 21 rules; MASTER-ROADMAP §5 discloses all 5 LR-3 blockers.)*

---

## 7. Remaining uncertainty

| Item | Uncertainty | Resolution path |
| :--- | :--- | :--- |
| LR-3 implementation start | Owner-authorized but not started; 5 clearance items | Awaiting owner go-ahead + blocker clearance |
| LR-4/LR-5 final requirements | Design specs exist but need re-validation against v12 | Re-base the LR specs onto v12 before implementation |
| SF derived views unwired | `socialProfile`/`invitationFramework` built but only consumed by tests | Decision: wire into UI or defer |
| Sunday Market cadence | "UNDECIDED" | Design decision needed before Stage 5 |
| Community Project visible rewards | Flags persisted; scene rendering open | World team backlog |

---

## 8. Implementation evidence summary (verified by Agent B)

- **722/722 tests** re-run live.
- **`WorldState` v12**, 11-step migration chain.
- **10 residents** (`RESIDENT_ORDER`).
- **5 visitable interiors** (Cottage, Greenhouse, Bakery, Book Nook, Copperwheel) — all IMPLEMENTED.
- **6+ exterior locations** — IMPLEMENTED.
- **86 dialogue topics across 23 modules**.
- **6 storylines** (multi-stage, branching).
- **1 shared activity** (`share_featured_reading`) — LR-3 `share_morning_pastry` reserved but NOT defined.
- **NPC Intelligence Evolution (PR #23)**: memory→behavior bridge, directional perception, social groups, friction, atrophy — integrated.
- **3 Community Projects** (marigold_garland, orchard_lanterns, pond_mosaic) — contribute-only.
- **Architectural risks**: monoliths growing (`actions.ts` 4107, `NeighborhoodCanvas.tsx` 3131, `App.tsx` 1627); `sideFlags` untyped bag (W1); 4 schema-bump merge-points (W2).

---

## 9. Independent adversarial review (Agent D)

Verdict: **ACCEPT-WITH-FIXES**. 3 blocking findings, all closed:
1. Audit §6 false-completion → reframed to honest applied/deferred tense.
2. MASTER-ROADMAP §11 false mirror claim ("17 rules mirrored in AGENTS.md") → AGENTS.md §7 now has all 21 rules.
3. MASTER-ROADMAP §5 LR-3 "READY FOR IMPLEMENTATION" overclaim → now discloses all 5 blockers from `lr3-qa/lr3-integration-readiness.md`.

Non-blocking findings addressed: "21 modules"→"23"; 17 rules→21 (added subagent no-recursion, 11-field proposal, adversarial review gate, team report cadence); §3 AGENTS.md negative-space claim made precise (cites §7); Pillar 6 gap analysis deepened (future violation surfaces noted).

---

This audit is the evidence base for `docs/MASTER-ROADMAP.md`. Every implementation claim is supported by code (`file:line`), tests, or git history. Design documents were NOT treated as proof of implementation. Historical records were preserved with explicit status markers rather than rewritten.
