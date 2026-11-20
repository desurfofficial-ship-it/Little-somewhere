# 05 — Teaching System Specification

## 5.1 Purpose

Teaching lets a resident share a piece of their craft or knowledge. The outcome is a new way to participate in an existing ritual, a journal memory, and richer future dialogue—not a power increase or a skill tree.

## 5.2 What Teaching Is

- A **named knowledge or ritual** tied to one resident.
- Unlocked by completing a specific shared activity or invitation.
- Recorded as a boolean or small enum in a bounded `taughtKnowledge` set.
- Referenced by dialogue conditions and by interior station availability.

## 5.3 What Teaching Is Not

- No XP, levels, or mastery bars.
- No requirement to repeat the lesson N times.
- No failure state if the player “does it wrong.”
- No new inventory economy. Existing items (tea, loaves, seeds, keepsakes) may be used or produced exactly as current stations already do.

## 5.4 Data Model

```ts
type KnowledgeId =
  | 'clara_tea_and_crumb'      // how Clara likes morning tea with a shared bake
  | 'arthur_escapement_basics' // quiet clock-listening / simple polish ritual
  | 'mina_pot_care'            // watering rhythm already present, now “taught”
  | 'nora_featured_reading'    // how to settle with the day’s book
  | 'barnaby_quiet_repair';    // listening while something is mended

interface TeachingState {
  known: KnowledgeId[];        // bounded, append-only in practice
  taughtBy: Partial<Record<KnowledgeId, ResidentId>>;
  taughtDay: Partial<Record<KnowledgeId, number>>;
}
```

Knowledge IDs are a closed union. Adding one is a deliberate content change, not a runtime unlock tree.

## 5.5 Example Teachings (v1 set)

| Knowledge | Teacher | Unlocked by | Player-facing result |
|-----------|---------|-------------|----------------------|
| `clara_tea_and_crumb` | Clara | Complete morning pastry invitation | Bakery tea station can reference “Clara’s way”; new dialogue topic |
| `mina_pot_care` | Mina | Complete a greenhouse tending visit | Planting notes gain a warmer line; optional memory on first solo water after teaching |
| `nora_featured_reading` | Nora | Complete a shared reading | First-read memories gain a “we settled this one together” variant |
| `arthur_escapement_basics` | Arthur | Complete workbench hour (after Copperwheel exists) | New quiet station action; memory of the locked tools softening |
| `barnaby_quiet_repair` | Barnaby | Complete porch/shop conversation | New topic; no new crafting system |

## 5.6 Unlock Flow

1. Invitation or dialogue offers the teaching activity.
2. Player completes the shared activity (document 06).
3. Reducer appends the `KnowledgeId` if absent, stamps day and teacher, writes journal + NPC memory.
4. Subsequent dialogue conditions and station flavor text read `TeachingState`.

Teaching is idempotent: repeating the activity after knowledge is known still allows the cozy moment and a smaller affinity bump, but does not re-grant the knowledge or spam memories.

## 5.7 Relationship to Existing Systems

- Greenhouse growth, bakery recipes, nook book cycle, and cottage hearth already exist. Teaching **wraps** them with shared context; it does not replace their reducers.
- Dialogue conditions gain an optional `requiresKnowledge?: KnowledgeId[]` (or a side-flag equivalent) so topics can branch after a lesson.
- No change to inventory item IDs is required for the first teachings.

## 5.8 Explicit Exclusions

- Skill trees or prerequisite chains longer than one step.
- Teaching that grants combat, movement, or economic advantage (none exist in the game).
- Player teaching NPCs in v1 (possible later as a story beat, not a system).
