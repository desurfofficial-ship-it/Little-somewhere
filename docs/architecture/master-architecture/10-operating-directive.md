# 10 — Global Multi-Agent Operating Directive

**Issued:** 2026-11-22, by the project owner (central coordinator).
**Encoded:** 2026-11-22, by the Master Architecture & Engineering Lead (WORKLOG Entry 060).
**Status of this doc:** **Verified in integrated build** (merged to `main`; CI green).
**Authority:** this document is the authoritative copy of the operating directive. Where a directive rule is also encoded in docs 03/07/08, those docs are the actionable spec and this doc is the source-of-truth statement. If they ever diverge, this doc wins and the other doc is the bug.

---

## 1. Purpose

This document establishes the operating rules for every specialist lead and their subagents working on LITTLE SOMEWHERE. It complements the standing invariants (doc 00 §"Standing invariants") and the parallel-development protocol (doc 07): the invariants are *what must not break*; the protocol is *how work flows*; this directive is *how teams and agents behave*.

**The goal is not eight separate projects.** It is ONE coherent, deeply interconnected, polished, reliable life simulation. Every rule below exists to prevent silo-formation, unreviewed risk, and unverified claims.

---

## 2. The directive (9 sections + philosophy + final)

### Philosophy
Be unrealistically ambitious, optimally intelligent, elegant, surgically precise. Conduct parallel, complementary, adversarial development and QA loops to the practical limit of subagent capacity. **Optimize for actual game quality, architectural integrity, meaningful functionality, and verified results — not for files changed or features announced.**

### §1 — Subagent delegation
Use subagent capacity. Delegate independent investigations and isolated implementation packages. Assign each subagent a specific mission, expected deliverable, and boundaries. **Subagents cannot launch further subagents** (no recursion). The main agent / lead owns synthesis and final decisions.

### §2 — Competing approaches
For important systems, use independent subagents to investigate different implementation approaches. Compare on: elegance, correctness, extensibility, runtime cost, integration complexity, maintainability, compatibility, testing difficulty. Choose the strongest by evidence. **Do not create competing implementations in the shared production codebase.** Compete on *ideas* off-main; land *one* implementation.

### §3 — Mandatory implementation proposals
Before implementing a substantial feature, write a proposal covering 11 fields (existing-system investigation; problem definition; proposed solution; alternatives considered; architecture & interfaces; files affected; dependencies; risks; acceptance criteria; testing plan; integration requirements). The proposal must be reviewed by the lead and relevant neighboring teams before implementation. **Full template + trigger definition: doc 03 §8.**

### §4 — Parallel execution
Maximize independent work. Do not wait for unrelated teams. Establish file ownership (doc 04) and interface contracts (doc 06) before simultaneous implementation. If work depends on an unfinished system, build against an approved interface (doc 06) or work on independent preparation. **Never introduce incompatible parallel implementations.**

### §5 — Adversarial development
Every major implementation must receive an independent review. Reviewers must actively attempt to disprove correctness: hunt edge cases, broken invariants (doc 00), architectural weaknesses (doc 02), data loss, state inconsistencies, player-facing failures. Developers must respond to reproducible findings (fix or documented architect waiver in doc 03 §6). **Full gate + "major implementation" definition: doc 08 §2 + §8.**

### §6 — Quality gates
A feature is not complete because code exists. Completion requires: implementation; relevant automated tests; TypeScript verification; production build; integration verification; persistence verification where applicable; browser/gameplay verification where appropriate; independent review (§5); documentation updates. **Report failures honestly. Never bypass tests merely to produce a green result.** Full pre-merge checklist: doc 08 §8.

### §7 — Coordination
Maintain a consolidated report for your team (completed / active / subagents / files / deps / blockers / test evidence / decisions / risks / next). Notify the central coordinator about cross-team dependencies immediately. **Full report spec + cadence: doc 07 §11.**

### §8 — Strict scope control
Do not duplicate another team's responsibilities. Do not restart existing work without investigating it. **LR-3 Clara invitation is owned by the LR team; design is underway on `origin/docs/lr3-{design,discovery,reconciliation}` branches (PR #13 open). Other teams coordinate with the LR team — do not create a competing implementation, branch, or proposal.** Investigations of *approaches* to LR-3 sub-problems are permitted only with the LR team's acknowledgment and must route findings back to the owner. Do not invent missing requirements or make irreversible product decisions without authorization.

### §9 — Documentation
Keep project documentation consistent with the actual integrated code. Distinguish six states (doc 07 §6): **Proposed → In progress → Implemented locally → Tested → Merged → Verified in integrated build.** **Never describe an unmerged implementation as complete on `main`.** Work that is Merged but not yet Verified-in-integrated-build may be described as "merged" only, never "verified."

### Final
Think like a world-class multidisciplinary game-development organization. Investigate before building, implement with precision, verify aggressively. Use the full practical power of parallel research, independent implementation, and adversarial QA.

---

## 3. Directive ↔ Governance alignment map

Verified against the 10 governance docs (Task 2-a-v2). Every directive section is now encoded.

| Directive § | Status | Encoded at |
| :--- | :--- | :--- |
| Philosophy | ENCODED | doc 00 §"Standing invariants" + this doc §2 |
| §1 Subagent delegation (no recursion) | ENCODED | this doc §2 + doc 00 standing operating rule (a) |
| §2 No competing implementations | ENCODED | this doc §2 + doc 00 standing operating rule (b) + doc 07 §10 anti-pattern |
| §3 11-field proposal template | ENCODED | doc 03 §8 (full template + trigger) |
| §4 Parallel execution (approved interfaces) | ENCODED | doc 07 §4 (shared-file protocol) + doc 06 (contracts) + doc 00 standing operating rule (c) |
| §5 Adversarial review gate | ENCODED | doc 08 §2 (gate row) + §8 (checklist) + "major implementation" definition |
| §6 9-step quality gate | ENCODED | doc 08 §2 gate stack + §8 pre-merge/post-merge checklist (persistence + gameplay/browser items added) |
| §7 Consolidated team report | ENCODED | doc 07 §11 (cadence + 10-field format) |
| §8 LR-3 scope control | ENCODED | doc 04 §1 (LR-3 in-flight row) + doc 01 §10 (LR-3 status corrected) + doc 03 §6 Decision register (first entry) + doc 07 §10 anti-pattern |
| §9 6-state vocabulary | ENCODED | doc 07 §6 (replaced 4-state) + doc 01 §10 (status column) |
| Final (no unmerged as complete) | ENCODED | doc 00 standing operating rule (d) + doc 07 §10 anti-pattern |

---

## 4. Standing operating rules (additive to doc 00 invariants)

These four rules are behavioral, not mechanical. They are recorded here as the authoritative text and mirrored in doc 00 §"Standing operating rules."

- **(a) Subagent no-recursion.** Subagents may be delegated independent missions but cannot launch further subagents. The lead owns synthesis.
- **(b) No competing implementations in production.** Competing *approaches* are compared off-main via subagents; exactly one implementation lands on `main`. Two PRs implementing the same subsystem with incompatible designs are both blocked until the lead picks one.
- **(c) No irreversible product decisions without authorization.** Adding/removing a resident, interior, storyline, or core gameplay loop requires explicit architect authorization recorded in doc 03 §6. Refactors that preserve behavior do not.
- **(d) No unmerged work described as complete on `main`.** Per the 6-state vocabulary (doc 07 §6), work not yet `Merged` may not be described as "shipped," "complete," or "in the game." Work that is `Merged` but not `Verified in integrated build` may be described as "merged" only.

---

## 5. Reconciliation record (this encoding)

| Item | Before | After |
| :--- | :--- | :--- |
| LR-3 status (doc 01 §10) | "Not started" | "In progress (design phase — PR #13 open; owner: LR team; see doc 04 §1)" |
| LR-3 ownership (doc 04 §1) | no row | LR-3 Clara invitation row added (owner: LR team; status: design-phase on `origin/docs/lr3-*`) |
| Status vocabulary (doc 07 §6) | 4-state (`proposed/in-progress/ready-for-review/merged`) | 6-state (Proposed/In progress/Implemented locally/Tested/Merged/Verified in integrated build) |
| Proposal template | missing | doc 03 §8 (11 fields + trigger) |
| Adversarial review gate | missing (doc 08 was mechanical only) | doc 08 §2 gate row + §8 checklist + "major implementation" definition |
| Consolidated team report | missing | doc 07 §11 (cadence + 10-field format) |
| Social foundation subsystem (doc 04 §1) | missing (SF-1..SF-4 landed in `8b715fc` ungoverned) | "Social foundation (derived)" row added (owner: Relationships/Dialogue/Storytelling Lead; zero persisted state) |
| SF derived-read contracts (doc 06 §3) | missing | 3 entries added (journal→emergentStories; narrative→dialogueContext; `isMemoryPlayerKnown` mirror lockstep) |
| Decision register (doc 03 §6) | empty | first entry: LR-3 owner decision |

---

## 6. Open items (tracked, not blocking this encoding)

| Item | Owner | Note |
| :--- | :--- | :--- |
| LR-3 PR #13 rebase onto current `main` | LR team (main agent authorized to assist) | PR #13 base is `a80a220`; must rebase onto `07be49c`+ to coexist with this governance + Social Foundation. Resolved in WORKLOG Entry 060. |
| SF doc off-by-one typo (references "Entry 057", actual heading "Entry 058") | Relationships/Dialogue/Storytelling Lead | Minor; not blocking. Flagged in doc 09 evidence. |
| SF test-count inconsistency (588 vs 590) | Relationships/Dialogue/Storytelling Lead | Canonical is 590/590 (post adversarial-QA pins). Minor. |
| `@google/genai` phantom dependency cleanup | Persistence/Integration lead | doc 02 W21; verify skills usage first. |
| GitHub Pages deploy hardening | Integration lead | doc 08 §7; `force_orphan` / third-party action / main-only. |

---

This document is the operating constitution for the multi-agent organization. The invariants (doc 00) say what must not break; the contracts (doc 06) say how subsystems talk; the protocol (doc 07) says how work flows; the gates (doc 08) say what must pass; this directive says how teams behave.
