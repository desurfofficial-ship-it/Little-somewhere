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
