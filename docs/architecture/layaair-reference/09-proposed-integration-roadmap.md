# 09 — Proposed Integration Roadmap

**Constraint**: Audit and documentation only. This roadmap is advisory. No implementation is authorised by this document.

All items preserve:
- Existing WorldState v10 + migration chain.
- Headless pure `src/game` boundary.
- In-game clock as the sole progression driver.
- Mobile-first performance discipline.
- Storybook visual identity.

## Phase 0 — Foundation (already largely done)
- Protect current architecture documents and contracts.
- Keep dual interior tests green.

## Phase 1 — Low-risk documentation & conventions (Complexity: Low)
- Add short “system ownership / update phase” notes to ARCHITECTURE.md or a new conventions file, inspired by Script lifecycle clarity.
- Acceptance: docs only; no runtime change.

## Phase 2 — Animation transition polish (Complexity: Medium)
- Design a small data-driven state table for player + key NPCs (idle / walk / sit / stand / activity).
- Implement simple cross-fades or instant switches inside existing presentation code.
- Optional: fire lightweight “animation peak” callbacks for interaction sync.
- Files likely involved: resident feel modules, player controller presentation, possibly a new thin animation helper under `src/game` or `src/scene`.
- Acceptance: sit/stand and station interactions feel smoother; no new allocations in tick; tests still pass; visual identity unchanged.
- Prerequisite: none beyond current milestone stability.

## Phase 3 — Station volume helpers (Complexity: Low–Medium)
- Pure geometry enter/exit helpers for stations and seats if any remaining edge cases exist.
- Acceptance: occupancy and interaction reliability improved or unchanged; contracts still dual-tested.

## Phase 4 — Future scale readiness (Complexity: Low, deferred)
- Document agent update budgeting rules.
- Only implement if resident count or activity density increases substantially.

## Explicitly Out of Scope / Never
- Engine migration.
- Physics engine integration.
- NavMesh replacement.
- General ECS rewrite.
- Save schema changes driven by this research.

## Testing Requirements for Any Future Work
- Existing pure unit tests must remain green.
- New movement or interior changes require updated contract tests.
- Visual changes require desktop + mobile screenshot verification per AGENTS.md rules.
- No regressions in save/load or clock-driven progression.
