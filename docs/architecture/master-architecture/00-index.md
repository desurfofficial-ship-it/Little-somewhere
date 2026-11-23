# 00 — Master Architecture Index

**Initiative:** Master Architecture, Engineering & Integration Direction
**Recorded:** 2026-11-22, atop `origin/main` @ `a80a220` (Merge PR #12).
**Owner:** Chief Architecture & Engineering Lead (this directory is the authoritative architectural-governance surface).
**Scope:** establish the engineering foundation that lets multiple specialist teams develop LITTLE SOMEWHERE simultaneously with predictable interfaces and controlled integration.

---

## How this directory relates to existing docs

| Existing doc | Role | Relationship to this directory |
| :--- | :--- | :--- |
| `ARCHITECTURE.md` (root) | System mechanics: layers, camera math, reactivity pipeline, file map | **Unchanged and authoritative** for mechanical detail. This directory governs ownership, contracts, and parallel-development protocol; it references `ARCHITECTURE.md` rather than duplicating it. |
| `AGENTS.md` | Engineering constitution: layer boundaries, visual rules, verification gates | **Unchanged and authoritative.** The protocol here enforces `AGENTS.md` §2 layer boundaries with machine-checked gates. |
| `HANDOVER.md` | Current milestone status + open backlog | **Unchanged.** This directory adds the standing governance layer above the milestone cadence. |
| `GAME_DESIGN.md` | Authoritative game design | Out of scope — design, not architecture. |
| `WORKLOG.md` / `CHANGELOG.md` | Chronological record | This initiative is logged there (WORKLOG entry for the master-architecture initiative). |
| `docs/architecture/living-relationships/` | LR-1/LR-2 architecture | Feature-scoped; superseded only at the contract surfaces this directory formalizes. |
| `docs/architecture/systemic-reliability{,-integration}/` | Reliability + integration audits | Evidence base; deferred findings tracked here where they remain open. |
| `docs/architecture/build10-lr-recovery/` | Build-10 recovery record | Historical; the lost-branch lesson is formalized here in doc 08. |
| `docs/audits/`, `docs/milestones/`, `docs/research/` | Per-initiative analyses | Unchanged. |
| `docs/MASTER-ROADMAP.md` | Strategic product vision + 6-pillar roadmap + milestone sequence | **Complementary.** This directory governs *engineering* (ownership, contracts, protocol, gates); MASTER-ROADMAP governs *product* (vision, pillars, boundaries, status, sequence). Both obey the operating directive (doc 10). Audit evidence: `docs/roadmap/REPOSITORY-ALIGNMENT-AUDIT.md`. |

**Principle:** this directory does not rewrite working systems. It extracts, formalizes, and machine-checks the contracts that already exist implicitly in the code.

---

## Document map

| # | Document | Purpose |
| :--- | :--- | :--- |
| 00 | This index | Navigation + relationship to existing docs. |
| 01 | [Verified current architecture](01-verified-current-architecture.md) | Consolidated, evidence-cited map of the runtime architecture as it exists in code on `main`. The single source of truth for "what is actually shipped." |
| 02 | [Architectural weaknesses](02-architectural-weaknesses.md) | Ranked register of weaknesses that block parallel multi-team development, each with evidence, blast radius, and a non-rewriting remediation direction. |
| 03 | [Target architecture](03-target-architecture.md) | The target state for each subsystem, the decomposition strategy (adversarial-adjusted), and the explicitly-rejected alternatives with rationale. |
| 04 | [Module ownership matrix](04-module-ownership-matrix.md) | Subsystem → owning module set → files; the "do not import" rules; file ownership and change-management for shared files; machine-checked enforcement. |
| 05 | [Dependency graph](05-dependency-graph.md) | The verified DAG, fan-in/fan-out hotspots, layer-boundary rules, shared-mutable-singleton register, and the coupling-risk register. |
| 06 | [Shared contracts](06-shared-contracts.md) | The `WorldState` v11 field→owner contract, the cross-subsystem derived-read contract map, the interface-extraction plan, and the typed-registry plan for smeared flags. |
| 07 | [Parallel-development protocol](07-parallel-development-protocol.md) | Branch strategy, the serialized schema-bump protocol, WORKLOG numbering protocol, dialogue-content ordering, guard-test-first rule, cross-team dependency register. |
| 08 | [Integration and release strategy](08-integration-and-release-strategy.md) | CI gates, tag-on-merge durability, golden-replay harness requirement, merge method, pre-merge verification checklist, phantom-dependency cleanup, deploy hardening. |
| 09 | [Specialist evidence pack](09-specialist-evidence-pack.md) | Consolidated raw findings from the six parallel specialist investigations (Tasks 1-a..1-f) that ground docs 01–08. Kept for auditability. |
| 10 | [Global multi-agent operating directive](10-operating-directive.md) | The operating constitution for every specialist lead and subagent: the 9 directive sections + philosophy, the directive↔governance alignment map, and the standing operating rules (subagent no-recursion, no competing implementations, no unauthorized irreversible decisions, no unmerged-as-complete). |

---

## Reading order

- **Architect / tech lead onboarding:** 01 → 02 → 03 → 04.
- **Feature team starting work:** 04 (what do I own?) → 06 (what contracts must I honor?) → 07 (how do I branch?) → 08 (what gates must I pass?).
- **Reviewer / integration lead:** 05 (is the boundary intact?) → 07 (is the protocol followed?) → 08 (are the gates green?).
- **Auditor / new agent reconstructing state:** 01 → 09 → 02.

---

## Standing invariants (non-negotiable)

These are the load-bearing properties of the codebase. Every proposal in this directory is evaluated against them; no compromise of any invariant is authorized without an explicit, recorded decision in doc 03 §"Decision register."

1. **Deterministic save replay** — `migrateWorldState` (linear explicit chain) + `sanitizeWorldState` (whitelist rebuild). Same input → byte-identical output. (`migrations.ts:2412-2478`, `save-integrity.test.ts`, `build10-recovery.test.ts`.)
2. **Save integrity via sanitizer whitelist** — `sanitizeWorldState` constructs the world from a whitelisted field set, dropping unknowns. The corruption backstop. (`migrations.ts:1203`.)
3. **Three-layer boundary** — `src/game/` pure (zero `three`/React/browser except sanctioned `storage.ts` + `audio.ts`); `src/scene/` Three.js; `src/components/`+`App.tsx` React. One-way: `components → scene → game`. (`AGENTS.md` §2.)
4. **Atomic `commitWorld`** — single React-side funnel at `App.tsx:272`: `worldRef` swap + `setWorldSnapshot` + 7 HUD setters + `saveWorldState` in one `useCallback`. (`App.tsx:272-284`.)
5. **Zero per-frame allocations in `tick()`** — module-scope scratch (`NeighborhoodCanvas.tsx:221-226`, `environmentRenderer.ts:22-65`). (`AGENTS.md` §2.)
6. **No history rewrite** — WORKLOG/HANDOVER entries preserved verbatim; numbering gaps stay. (`WORKLOG.md` Entry 056 policy.)
7. **Clean DAG** — `src/game/` has zero circular dependencies (Tarjan-verified, doc 05). No proposal may introduce a back-edge.

## Standing operating rules (behavioral — additive to the invariants)

These four rules are behavioral, not mechanical. They are recorded authoritatively in doc 10 §4 and mirrored here so they appear alongside the load-bearing invariants.

- **(a) Subagent no-recursion** — subagents may be delegated independent missions but cannot launch further subagents. The lead owns synthesis. (Directive §1.)
- **(b) No competing implementations in production** — competing *approaches* are compared off-main via subagents; exactly one implementation lands on `main`. Two PRs implementing the same subsystem with incompatible designs are both blocked until the lead picks one. (Directive §2.)
- **(c) No irreversible product decisions without authorization** — adding/removing a resident, interior, storyline, or core gameplay loop requires explicit architect authorization recorded in doc 03 §6 Decision register. Behavior-preserving refactors do not. (Directive §8.)
- **(d) No unmerged work described as complete on `main`** — per the 6-state vocabulary (doc 07 §6), work not yet `Merged` may not be described as "shipped," "complete," or "in the game." Work that is `Merged` but not `Verified in integrated build` may be described as "merged" only, never "verified." (Directive §9.)
