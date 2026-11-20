# 03 — Invitation System Specification

## 3.1 Purpose

Invitations turn existing relationship strength, personality, and recent shared activity into a concrete offer to spend time together. They are the entry point for home visits, teaching, and shared activities.

## 3.2 Design Rules

- An invitation is an **offer**, not a quest marker that must be cleared.
- Generation is evaluated at natural moments (dialogue open, morning wake, or a once-per-phase check), not every frame.
- At most **one active player invitation** at a time in the first milestones (expandable later).
- Missing an invitation produces **no penalty**. It simply expires.
- Affinity gain from accepting and completing is modest and does not bypass the existing daily smalltalk cap philosophy; milestone-style shared moments may use a small fixed bonus similar to current story or gift bonuses.
- Invitation text and availability are resident-specific.

## 3.3 Data Model

```ts
type InvitationStatus = 'offered' | 'accepted' | 'completed' | 'expired' | 'declined';

interface Invitation {
  id: string;                    // stable, e.g. 'clara_morning_pastry'
  hostId: ResidentId;
  activityId: string;            // references SharedActivity registry
  status: InvitationStatus;
  offeredDay: number;
  offeredMinute: number;
  windowStartMinute: number;     // e.g. 420 (7:00)
  windowEndMinute: number;       // e.g. 780 (1:00)
  expiresDay: number;            // usually offeredDay or offeredDay+1
  location: PlayerLocation;      // interior where the visit occurs
  stationId?: string;            // optional preferred station/seat
  taughtTopicId?: string;        // optional teaching payload
  memoryId: string;              // journal memory written on completion
}

interface InvitationState {
  active: Invitation | null;
  history: InvitationHistoryEntry[];  // bounded, last N completions/expirations
  lastOfferDayByHost: Partial<Record<ResidentId, number>>;
}

interface InvitationHistoryEntry {
  id: string;
  hostId: ResidentId;
  activityId: string;
  completedDay: number;
  outcome: 'completed' | 'expired' | 'declined';
}
```

`InvitationState` is a new WorldState slice (see document 07). History is capped (proposed: 12 entries) to match existing bounded-collection practice.

## 3.4 Generation Conditions

An invitation may be offered when **all** of the following hold:

1. No other active invitation exists.
2. Host has not offered in the last N in-game days (proposed: 2–3, personality-modulated).
3. Player relationship tier meets the invitation’s minimum (typically `friendly` or higher; some teaching invites require `close`).
4. Host is not guarded / high-tension with the player.
5. Relevant story flags or interior state are satisfied (e.g. Clara has shared at least one bake; Arthur’s rift is softening).
6. Time of day and weather fit the host’s personality (morning lark, rain shelter, etc.).
7. The host’s current schedule is compatible with being at home during the window (lightweight check against phase schedule; no full calendar solver).

Personality bias examples (design intent, not existing code):

| Resident | Bias | Example invitation |
|----------|------|--------------------|
| Clara | High sociability, morning, food | Morning pastry + tea after first bake |
| Arthur | Low sociability, contemplative | Quiet hour at the workbench |
| Mina | Outdoors / plants | Help water or admire a ready pot |
| Nora | Reading, tea | Settle with the featured book |
| Barnaby | Reserved, craft | Porch or shop conversation about a repair |
| Others | Later waves | Follow same pattern |

## 3.5 Lifecycle

1. **Offer** — Dialogue topic or a soft morning line presents the invitation. Player may accept or decline in dialogue.
2. **Accepted** — `status = 'accepted'`. Host is eligible for interior occupancy during the window (document 04).
3. **Participate** — Player enters the location and starts the linked shared activity (document 06).
4. **Complete** — Activity reducer writes journal memory, optional NPC memory, modest affinity/reliability movement, and marks invitation completed. History is appended.
5. **Expire / Decline** — Status updated; no negative affinity. Host’s `lastOfferDay` still advances so offers stay rare.

## 3.6 Delivery Surfaces

- **Primary**: Dialogue choice on the host (“I’d like that” / “Another time”).
- **Secondary** (optional later): A single quiet line on the noticeboard or mailbox for accepted invitations (“Clara is keeping a chair warm this morning”). No new UI chrome required for v1.
- **Never**: A quest tracker, countdown, or failure banner.

## 3.7 Integration Points (Existing Systems)

- Conditions reuse `DialogueCondition` (tier, flags, storyline).
- Completion uses existing memory append helpers and `recordPlayerTalkAffinity` / a small dedicated affinity helper that respects current caps.
- Location uses existing `PlayerLocation` and door flow.
- Evaluation can live in a new pure module `src/game/invitations.ts` called from dialogue selection or from the morning-advance reducer—not from the 60 Hz loop.

## 3.8 Explicit Exclusions (v1)

- Multiple simultaneous invitations.
- NPC-to-NPC invitations that the player merely witnesses (possible later).
- Player-initiated “ask to visit” beyond accepting an offer (can be a later polite request topic).
- Real-world time or notifications.
