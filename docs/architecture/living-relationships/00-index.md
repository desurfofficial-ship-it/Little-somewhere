# Living Relationships Initiative — Design Package Index

**Project**: LITTLE SOMEWHERE  
**Status**: Design only — no runtime code changes  
**Base**: Milestone 3 Build 8 complete (`WorldState` v9, canonical `origin/main`)  
**Location**: `docs/architecture/living-relationships/`

This package designs the Invitation, Teaching, Home Visit, and Shared Activities systems so relationships produce spatial, social, and memory consequences without currency, grind, or punitive decay.

## Documents

| # | Document | Purpose |
|---|----------|---------|
| 01 | [Current System Audit](01-current-system-audit.md) | Verified facts about relationships, dialogue, interiors, schedules, memories, and persistence |
| 02 | [Gameplay Vision](02-gameplay-vision.md) | Player-facing experience and design constraints |
| 03 | [Invitation System](03-invitation-system.md) | How opportunities emerge from affinity, personality, availability, and story |
| 04 | [Home Visit Architecture](04-home-visit-architecture.md) | Lightweight interior occupancy, owner presence, arrival/departure |
| 05 | [Teaching System](05-teaching-system.md) | Knowledge and ritual unlocks without skill trees |
| 06 | [Shared Activity Framework](06-shared-activity-framework.md) | Reusable activities that produce memories and relationship change |
| 07 | [WorldState & Persistence](07-worldstate-and-persistence.md) | Schema additions, migration, and sanitization |
| 08 | [NPC Behavior Integration](08-npc-behavior-integration.md) | Schedules, runtime, and simulation hooks |
| 09 | [Dialogue Integration](09-dialogue-integration.md) | Topics, conditions, and memory/gossip hooks |
| 10 | [Milestone Roadmap](10-milestone-roadmap.md) | Dependency-ordered implementation stages |
| 11 | [Testing Strategy](11-testing-strategy.md) | Contract, selection, migration, and regression tests |
| 12 | [Risks and Mitigations](12-risks-and-mitigations.md) | Identity, complexity, and scalability risks |

## Reading Order

1. Audit (01) → Vision (02)  
2. Core systems (03–06)  
3. Technical integration (07–09)  
4. Delivery (10–12)

## Non-Goals (Explicit)

- Currency-based relationship progression  
- Grind-heavy friendship meters or daily quests  
- Arbitrary cooldowns that punish absence  
- Punitive friendship decay  
- Generic RPG skill trees  
- Complex multi-NPC interior pathfinding in the first milestones  
- Forced social interactions  
- Redesign of working relationship, dialogue, or interior contracts

## Implementation & Decision Records (13–21, added during implementation)

| # | Document | Purpose |
|---|---|---|
| 13 | Adversarial Pre-Implementation Review | Independent challenge of the implementation plan |
| 14 | Revised Architecture | Spec of record for LR-1/LR-2 as built (§2.4 strict predicate, §2.3 gates, §4 occupancy/load invariants) |
| 15 | Implementation Readiness Checklist | Red-test-first merge conditions |
| 16 | LR-1/LR-2 Acceptance Test Plan | Frozen acceptance gates (LR1-*, LR2-*) |
| 17 | Acceptance Plan Audit | Independent audit of doc 16 |
| 18 | Acceptance Plan Correction Report | Doc 18 mitigation records |
| 19 | Final Acceptance Readiness Review | Gate sign-off before implementation |
| 20 | [LR-1 Implementation Notes](20-lr1-implementation-notes.md) | Implementation record incl. anchoring policy (recovered from the PR #3 archive, byte-identical) |
| 21 | [LR-1 Design Decision Record](21-lr1-design-decision-record.md) | Decision A (gate-4 offer-time reading) & Decision B (LR2-04b staging) — recovered byte-identical from PR #3 `d615a8e`; Decision B's re-anchored staging is implemented on main since the Build-10/LR recovery (WORKLOG Entry 051) |

**Post-implementation corrective record**: `docs/architecture/build10-lr-recovery/` (docs 01–14) — Build-10 restoration, strict-predicate unification (doc 05), adversarial validation, gameplay QA, and the merge/integration record.
