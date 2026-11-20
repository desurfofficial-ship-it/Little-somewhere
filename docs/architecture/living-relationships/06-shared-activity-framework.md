# 06 — Shared Activity Framework

## 6.1 Purpose

Shared activities are reusable, resident-aware moments that two participants (player + one NPC) can perform. They are the payload of invitations and the vehicle for teaching and memory.

## 6.2 Design Rules

- An activity is short (a few in-game minutes), cozy, and non-failing.
- It reuses an existing station or seat where possible.
- Completion always writes at least one journal memory.
- Completion may write one NPC memory and a modest relationship change.
- Activities are data-driven so new ones do not require new UI patterns.

## 6.3 Data Model

```ts
interface SharedActivityDef {
  id: string;
  name: string;
  hostId: ResidentId;                 // primary host; 'any' not used in v1
  location: PlayerLocation;
  stationId: string;
  durationMinutes: number;            // e.g. 6–15
  minTier: RelationshipTier;
  knowledgeGranted?: KnowledgeId;
  memory: {
    id: string;
    title: string;
    summary: string;
  };
  affinityDelta: number;              // small, e.g. 4–8
  reliabilityDelta?: number;
  /** Optional environmental or side-flag consequence. */
  sideEffects?: {
    setSideFlag?: string;
    // no currency, no item destruction beyond existing station rules
  };
}

interface ActiveSharedActivity {
  activityId: string;
  hostId: ResidentId;
  startedMinute: number;
  invitationId?: string;
}
```

Registry lives in a new pure module (proposed `src/game/activities.ts`). WorldState holds only the active instance (or null) plus any permanent knowledge/memories already covered elsewhere.

## 6.4 v1 Activity Set

| ID | Host | Location / station | Duration | Grants | Notes |
|----|------|--------------------|----------|--------|-------|
| `share_morning_pastry` | Clara | Bakery table | 8 min | `clara_tea_and_crumb` | Reuses tea + bake share flavor |
| `share_greenhouse_tending` | Mina | Greenhouse shelf / water | 6 min | `mina_pot_care` | Does not alter growth rules |
| `share_featured_reading` | Nora | Nook chair | 12 min | `nora_featured_reading` | Uses day’s featured book |
| `share_workbench_hour` | Arthur | Copperwheel bench (future) | 10 min | `arthur_escapement_basics` | Depends on Build 9 interior |
| `share_quiet_repair` | Barnaby | Porch or future woodshop | 8 min | `barnaby_quiet_repair` | Can start exterior if no interior |

Later activities (not v1): listening to music (Sora), sketching (Toby), seasonal gathering at the orchard table. They plug into the same registry.

## 6.5 Flow

1. Player accepts invitation or chooses a “spend a moment” dialogue/station action while host is present.
2. Reducer validates location, station proximity, tier, and that no other activity is active.
3. `ActiveSharedActivity` is set. Time advances by `durationMinutes` (same gentle advance used by current station rituals).
4. On commit: clear active activity, mark invitation completed if linked, grant knowledge if new, append memories, apply small affinity/reliability deltas, push a world event for gossip eligibility.
5. Dialogue and journal update on the next snapshot.

## 6.6 Reuse of Existing Rituals

- Bakery knead/share, greenhouse water/harvest, nook browse/tea, and cottage hearth sip already advance time and write state.
- Shared activities should **call or mirror** those reducers when the fiction matches, then add the relationship/memory layer. Do not fork the growth or bake roster logic.
- Sit-and-sip posture can be reused for tea and reading activities.

## 6.7 Consequences

- **Memory**: Journal entry + optional NPC memory with provenance `shared_activity`.
- **Relationship**: Small affinity/reliability increase; respects overall gentle pacing.
- **Dialogue**: New or variant topics become available via knowledge or memory conditions.
- **Environment**: Only when it fits existing flag patterns (e.g. a shared bake might already open tables; do not invent new flag types without need).
- **Gossip**: A completed activity is a valid low-sensitivity memory that close NPCs may mention later, using existing hop and affinity gates.

## 6.8 Explicit Exclusions

- Activities with failure, score, or repetition requirements.
- Activities that consume rare resources or create currency.
- Activities requiring more than one NPC in v1.
- Real-time minigames.
