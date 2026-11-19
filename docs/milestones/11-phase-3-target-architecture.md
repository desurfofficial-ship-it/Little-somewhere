# 11 — Milestone 2B Phase 3: Target Architecture (NPC Memories & Gossip)

**Status**: Proposed Architecture Blueprint (Requires Review & Approval Before Implementation)  
**Scope**: Bounded, deterministic per-NPC memory, provenance tracking, witness/participation capture, controlled gossip propagation with restrained distortion, retention/eviction, and dialogue reaction integration.  
**Note on Numeric Constants**: All numeric limits, radii, cooldowns, confidence scores, hop caps, and expiration windows below are **proposed tuning values**, isolated as named constants so they can be tuned safely during Phase 3 implementation and playtesting.

---

## 1. Architectural Goals & Design Constraints

1. **Believable Subjective Residents (No Hive-Mind)**: Each resident remembers only what they experienced, directly witnessed within physical/acoustic reach, heard directly from the player, or learned through an actual NPC-to-NPC conversation.
2. **Strict Separation of Truth vs. Hearsay**: Permanent `StoryFlags` and player `JournalMemory` records remain unaffected by rumors, fading, or NPC misunderstandings.
3. **Bounded Memory & Save Footprint**: Hard per-resident memory caps and age-based expiration prevent unbounded `localStorage` growth over 100+ in-game days.
4. **Zero-GC Frame Pacing**: The 60 Hz simulation loop (`stepSimulationInPlace`) must not scan all resident pairs or allocate arrays per frame. Gossip exchange runs **only** on discrete `ActiveSocialEncounter` transitions (and discrete player actions).
5. **100% Deterministic & In-Game Time Driven**: All rolls use `hashSeed` + `mulberry32` keyed on `world.simSeed`, `world.day`, and discrete IDs. Zero `Date.now()` or real-world calendar logic.
6. **Population-Scalable**: No hardcoded resident count (`9`) or fixed resident pairings in core memory/gossip logic; iterates `RESIDENT_ORDER` and `NpcNpcRelation` dynamically.
7. **Zero New Dependencies & Pure Engine Isolation**: Lives strictly in `src/game/` (`memories.ts` + pure hooks in `actions.ts`, `simulation.ts`, `dialogueEngine.ts`, `relationships.ts`, `migrations.ts`, `storage.ts`).

---

## 2. Module Ownership & Unidirectional Dependency Flow

```
types.ts  <── rng.ts / time.ts / worldMap.ts / residents.ts
   ▲
   ├── relationships.ts   (Player<->NPC & NPC<->NPC tiers, guardedness, gossip cooldown helpers)
   ├── memories.ts [NEW]  (NpcMemoryEntry creation, witness rules, retention/eviction, gossip & distortion)
   │
   ├── simulation.ts      (Calls propagateEncounterGossipInPlace ONLY when encounter begins/completes)
   ├── dialogueEngine.ts  (Evaluates npcMemories predicates, provenance-aware reactions & third-party scope)
   ├── narrative.ts       (Topic definitions using requiresNpcMemoriesAny + provenance phrasing)
   └── actions.ts         (Records participant & spatial/acoustic witness memories on player actions)
         ▲
   migrations.ts & storage.ts  (v3->v4 hydration, sanitization, day-aging cleanup, save revision hash)
```

---

## 3. Data Model: `NpcMemoryEntry` & Supporting Types

`NpcMemoryEntry` satisfies the existing `ForwardWorldHooks` contract `{ id: string; tag: string }` (`src/game/dialogueEngine.ts:41`) so `requiresNpcMemoriesAny` and `excludesNpcMemories` continue working without breaking existing condition semantics.

```ts
export type NpcMemoryProvenance = 'firsthand' | 'secondhand' | 'rumor';

export type NpcMemorySourceKind =
  | 'participant'   // NPC was directly involved in the event or dialogue
  | 'witness'       // NPC was physically within sight or acoustic range
  | 'player_told'   // Player shared this directly in conversation
  | 'gossip';       // Learned from another resident during an encounter

export type NpcMemoryCategory =
  | 'event'             // Town happenings (bell chime, fountain flow, lantern lighting)
  | 'interaction'       // Player kindness, gifts, shared moments
  | 'friction'          // Blunt remark, tense mediation, guarded impression
  | 'social_impression' // Observation/impression of player's standing with someone, or NPC bond shift
  | 'town_lore';        // Baseline personal history (e.g., Clara & Arthur's old gazebo rift)

export type NpcMemoryValence = 'warm' | 'neutral' | 'tense';

export type NpcMemoryRetention =
  | 'permanent'   // Protected milestone / foundational lore memory (exempt from age expiry)
  | 'durable'     // Meaningful personal/town memory; decays slowly after many in-game days
  | 'ephemeral';  // Passing impression or rumor; expires after several in-game days unless reinforced

export type NpcMemoryDistortionFlavor =
  | 'none'
  | 'uncertain'           // Speaker/listener hedges ("someone said...", "might have...")
  | 'exaggerated'         // Spirited/curious embellishment of scale or enthusiasm
  | 'softened'            // Gentle resident downplaying friction or blame
  | 'misattributed_motive'; // Tense/guarded misunderstanding of intent (never alters story truth)

export interface NpcMemoryDetail {
  itemId?: CarryableItemId;
  placeName?: string;
  targetTier?: RelationshipTier;
  acousticOnly?: boolean; // e.g., heard the Gazebo Bell across town without seeing who pulled the rope
}

export interface NpcMemoryEntry {
  // Identity & Deduplication
  id: string;                  // Per-subject memory key (e.g. 'ev_bell_restored', 'help_rosemary_clara')
  eventId: string;             // Underlying canonical event ID linking firsthand & hearsay versions
  tag: string;                 // Semantic predicate tag for DialogueCondition (e.g. 'bell_chime', 'player_gift')
  category: NpcMemoryCategory;

  // Subjects
  subjectPlayer: boolean;
  subjectResidents: ResidentId[]; // Empty if purely environmental; involved NPCs otherwise

  // Provenance & Certainty
  provenance: NpcMemoryProvenance;
  sourceKind: NpcMemorySourceKind;
  originResidentId?: ResidentId;  // Resident who originally saw/experienced it (when known)
  fromResidentId?: ResidentId;    // Immediate speaker who passed it to this resident
  hopCount: number;               // 0 = direct, 1..MAX_GOSSIP_HOPS = gossip
  confidence: number;             // 0..100 integer (100 firsthand; degrades across hops)
  distorted: boolean;
  distortionFlavor: NpcMemoryDistortionFlavor;

  // Temporal & Retention Metadata (strictly in-game days/minutes)
  createdDay: number;
  createdMinute: number;
  learnedDay: number;
  learnedMinute: number;
  expiresDay?: number;            // Undefined for permanent memories
  importance: number;             // 1..5 (proposed scale)
  retention: NpcMemoryRetention;

  // Affect & Dialogue Pacing
  valence: NpcMemoryValence;
  emotionalWeight: number;        // 0..100 intensity at time of encoding
  mentionedToPlayer: boolean;     // Prevents repeating the exact same gossip/reaction endlessly
  sharedCount: number;            // Number of times this NPC passed it along in gossip
  detail?: NpcMemoryDetail;       // Compact structured context for pure prose formatting
}
```

### Design Rationale: Structured Facts Over Raw Persisted Prose

- **Why no required freeform `summary` field persisted in `WorldState`?**
  Storing structured fields (`eventId`, `tag`, `provenance`, `distortionFlavor`, `subjectResidents`, `fromResidentId`, `detail`) keeps each entry compact (~190–240 bytes JSON), eliminates stale prose when an NPC upgrades a rumor to `firsthand` or gains a clearer impression, and allows dialogue/Journal renderers to phrase the exact same memory naturally through each speaker's voice (`traits.temperament`, `provenance`, `fromResidentId`).
- A pure helper `formatNpcMemorySummary(entry, viewerId)` in `src/game/memories.ts` derives readable summary prose deterministically whenever UI or dialogue needs it.

### Additive `WorldState` & `NpcNpcRelation` Extensions

- **`WorldState.npcMemories`**: `Record<ResidentId, NpcMemoryEntry[]>` (initialized for every resident in `RESIDENT_ORDER`).
- **`NpcNpcRelation` optional fields**:
  - `lastGossipDay?: number | null;`
  - `lastGossipMinute?: number | null;`
  - `lastGossipEventId?: string;`

---

## 4. Event-to-Memory Creation & Witness Rules

Memories are created strictly by discrete simulation/player actions—never polled in a render loop.

### 4.1 Creation Triggers & Channels

| Trigger Source | Origin Action | Who Records Firsthand (`hopCount: 0`, `confidence: 100`) | Proposed Retention & Importance |
| :--- | :--- | :--- | :--- |
| **Dialogue Milestone / Story Flag** | `applyDialogueChoice` (`setFlags`, `setSideFlags`, `isStoryMilestone`) | Speaking `residentId` (`participant`); any idle nearby resident within `LOCAL_WITNESS_RADIUS` (`8.5 m`, proposed) (`witness`, excluding acoustic/private notes unless public) | `permanent` (`importance: 4..5`) for `bellRestored`, `claraArthurReconciled`, `repairedFountain`, `plantedMoonPetals`; `durable` (`3..4`) for intermediate beats |
| **Dialogue Friction / Amends** | `applyDialogueChoice` (`isNegative` or `make_amends_<id>`) | Speaking `residentId` (`participant`, `category: 'friction'`, `valence: 'tense'` or `'warm'`) | `durable` (`importance: 3`, e.g. `14` days unless overwritten by amends) |
| **Held Prop Delivery / Gift** | `applyDialogueChoice` (`deliverHeldItem`) / `deliverHeldItemAction` | Receiving `residentId` (`participant`, `tag: 'player_gift'` / `'player_help'`); nearby residents within `LOCAL_WITNESS_RADIUS` (`8.5 m`, proposed) (`witness`, `tag: 'player_help_observed'`) | `durable` (`importance: 3`, liked gift; `importance: 2`, standard share) |
| **Gazebo Bell Ring** | `interactWithProp('gazebo_bell')` / `ring_bell` | Residents near gazebo (`<= 8.5 m`, proposed) record full `witness` (`bell_ring`); residents outdoors across town (`<= ACOUSTIC_BELL_RADIUS = 30 m`, proposed) record `witness` with `detail: { acousticOnly: true }` (`bell_chime`) | `durable` (`importance: 3`, refreshes `learnedDay` on repeat chimes without duplicating) |
| **Fountain Wish / Pond Skip / Hollow Oak** | `actions.ts` landmark props | Residents within `LOCAL_WITNESS_RADIUS` (`8.5 m`, proposed) only (e.g., Toby near Hollow Oak/Pond) | `ephemeral` or `durable` (`importance: 2`) |
| **Player Shares News in Dialogue** | Choice declaring `recordMemories` / `shareEvent` | Listener records `sourceKind: 'player_told'` (`provenance: 'firsthand'` if player is reporting own action/direct truth, or `'secondhand'` if recounting someone else's news) | `durable` (`importance: 3`) |
| **Autonomous NPC Encounter** | `simulation.ts` `ActiveSocialEncounter` | Participants record nothing extra unless an actual gossip transfer occurs (`sourceKind: 'gossip'`, `hopCount + 1`) or pair bond upgrades tier | `ephemeral` (`importance: 1..2`) |

### 4.2 Spatial & Acoustic Witness Rules (No Sheltered Omniscience)

- Witness selection runs a small pure helper `collectWitnessesForPosition(world, pos, radius, excludeIds)`:
  - Iterates `RESIDENT_ORDER` (with `O(N)` distance check using `distance2D`).
  - Excludes residents currently sheltered indoors/far away (`rt.currentActivityId.includes('home')` or `rt.currentActivityId.includes('shelter')` during `light_rain`, except for wide acoustic bell chimes).
  - Separates `visualWitness` (`<= 8.5 m`, proposed) from `acousticWitness` (`<= 30 m`, proposed, bell chimes only), preserving believable details (hearing the bell echo vs seeing who pulled the rope).

### 4.3 Deduplication, Reinforcement & Provenance Integrity

When recording a candidate memory `incoming` for `residentId`:

1. Match existing entry in `npcMemories[residentId]` by `existing.eventId === incoming.eventId || existing.id === incoming.id`.
2. **If no match exists**: insert `incoming` and run bounded eviction if above capacity.
3. **If a match already exists**:
   - **Provenance Rank**: `firsthand (3) > secondhand (2) > rumor (1)`.
   - **Never silently downgrade**: If `existing` has higher provenance rank than `incoming`, **do not** overwrite `provenance`, `sourceKind`, `hopCount`, or `distorted`. Only refresh `learnedDay` / `confidence` slightly (capped below `100` for non-firsthand) if it is a repeated confirmation.
   - **Upgrade on Direct Experience**: If `existing` was `secondhand` or `rumor` and `incoming` is `firsthand` (e.g., an NPC who heard a rumor about the fountain later walks past and sees it flowing, or hears the bell directly), **upgrade** cleanly to `firsthand` (`hopCount: 0`, `confidence: 100`, `distorted: false`, `distortionFlavor: 'none'`).
   - **Multiple Rumor Confirmations**: If both are `secondhand`/`rumor` and `fromResidentId !== existing.fromResidentId`, boost `confidence` modestly (`+10`, proposed, capped at `85`) and clear `'uncertain'` flavor if confidence crosses threshold (`>= 70`, proposed)—representing corroboration without creating duplicate cards.

---

## 5. Memory Retention, Decay & Bounded Eviction

### 5.1 Proposed Bounds & Lifetimes *(All Proposed Tuning Values)*

| Constant | Proposed Tuning Value | Purpose |
| :--- | :--- | :--- |
| `MAX_NPC_MEMORIES_PER_RESIDENT` | `14` *(range 12–16)* | Hard cap on `npcMemories[id].length` |
| `MAX_PERMANENT_MEMORIES_PER_RESIDENT` | `6` *(inside the 14 cap)* | Prevents permanent milestones from starving all ephemeral social slots |
| `EPHEMERAL_RUMOR_TTL_DAYS` | `5` in-game days | Default expiration for `ephemeral` rumors/impressions |
| `DURABLE_MEMORY_TTL_DAYS` | `18` in-game days | Soft expiry window for ordinary interactions/favors (unless `permanent`) |
| `MENTIONED_RETENTION_PENALTY` | `-1.5` priority weight | Slightly favors unmentioned memories over already-discussed ones during eviction |

### 5.2 Expiration & Eviction Rules

1. **In-Game Day Expiration**: On `advanceToNextDay` (and during sanitization/read cleanup), remove entries where `retention !== 'permanent' && expiresDay !== undefined && world.day > expiresDay`.
2. **Capacity Overflow Eviction**: Whenever `list.length > MAX_NPC_MEMORIES_PER_RESIDENT`:
   - Partition `retention === 'permanent'` memories (protected from normal eviction; if permanent alone exceeds `MAX_PERMANENT_MEMORIES_PER_RESIDENT`, evict lowest `importance` / oldest `createdDay` permanent entry—though milestone counts in Milestone 2B fit well within 6).
   - Score each non-permanent entry:
     ```ts
     retentionScore =
       entry.importance * 3.0 +
       (entry.provenance === 'firsthand' ? 2.5 : entry.provenance === 'secondhand' ? 1.0 : 0) +
       (entry.emotionalWeight / 40) +
       (entry.mentionedToPlayer ? 0 : 1.25) -
       Math.max(0, currentDay - entry.learnedDay) * 0.45;
     ```
   - Evict the lowest-scoring entry until `list.length <= MAX_NPC_MEMORIES_PER_RESIDENT`.

---

## 6. Controlled Deterministic Gossip Propagation

### 6.1 Where & When Gossip Happens

- **Primary Hook**: Inside `stepSimulationInPlace()` (`src/game/simulation.ts:913-969`) **exclusively at the moment an `ActiveSocialEncounter` is created** (when `participants` pair up, max `2` encounters active at once, evaluated on 15-minute `socialSlot` boundaries).
- **Zero-Frame-Overhead Guarantee**: Because encounter creation occurs only a handful of times per in-game day, gossip selection adds negligible CPU cost and **zero allocations on normal movement frames**.
- Exported pure function `propagateEncounterGossip(world, participants, encounterId, day, minuteOfDay)` in `src/game/memories.ts` can be called both in-place by `simulation.ts` and standalone in unit tests.

### 6.2 Eligibility Gates *(Proposed Tuning Thresholds)*

For an encounter with `participants` (2 or 3 residents):

1. **Pairwise Relationship Gate**:
   - Check `rel = getNpcRelation(world.npcRelations, speakerId, listenerId)`.
   - Must NOT be suppressed (`!shouldSuppressNpcSocial(rel)`).
   - Require `rel.affinity >= GOSSIP_MIN_AFFINITY` (`20`, proposed) and `rel.tension < GOSSIP_MAX_TENSION` (`30`, proposed).
   - **Sensitivity Gate**: Friction or personal third-party impressions (`category === 'friction' || category === 'social_impression'`) require higher trust (`rel.affinity >= 38 && rel.tension < 20`, proposed, i.e. `'warm'` or `'confidant'` `NpcRelationTier`) unless the speaker has high sociability/curiosity (`>= 0.70`, proposed) sharing mild public curiosity.
2. **Pair Cooldown Gate**:
   - Require `rel.lastGossipDay !== world.day` (at most **once per in-game day** per specific pair), OR an optional minimum in-game minute cooldown (proposed `GOSSIP_PAIR_COOLDOWN_MINUTES = 180` if same-day evening sharing is desired; once per day per pair is cleaner and prevents rapid ping-ponging).
3. **Speaker Share Gate & Trait Modulation**:
   - Deterministic roll via `mulberry32(hashSeed(world.simSeed, day, encounterId, 'gossip'))`.
   - Probability scales gently with `speaker.traits.sociability`, `speaker.traits.curiosity`, and `getNpcRelationTier(rel)` (`confidant` > `warm` > `acquainted`), proposed baseline ~`0.45–0.75` for eligible pairs.
4. **Hop Cap & Spread Cap**:
   - Only memories with `entry.hopCount < MAX_GOSSIP_HOPS` (`2` proposed; `1` proposed for `category === 'friction'`) can be shared.
   - Only memories where `entry.sharedCount < MAX_SHARES_PER_ENTRY` (`3`, proposed) and `entry.subjectResidents` does not solely expose private listener self-criticism (`!entry.subjectResidents.includes(listenerId)` for negative/friction gossip—residents don't awkwardly gossip to *you* about your own secret mistake unless it's a warm event!).
   - **Max 1 memory transferred per encounter** (`MAX_GOSSIP_PER_ENCOUNTER = 1`, proposed). This ensures news ripples across the neighborhood over days rather than saturating all 9 residents in one afternoon.

### 6.3 Candidate Selection & Deduplication

From speaker's `npcMemories[speakerId]`:
- Filter out entries the listener already holds (`!listenerHasEvent(listenerId, entry.eventId)`—unless listener holds a lower-confidence version that qualifies for corroboration).
- Score eligible memories by novelty (`sharedCount === 0` bonus), recency (`day - createdDay <= 3`), `importance`, `emotionalWeight`, and `speaker.traits.curiosity` (curious/spirited neighbors favor surprising/recent news; gentle/contemplative neighbors favor warm milestones).
- Pick deterministically via weighted/ranked choice seeded by `encounterId`.

### 6.4 Secondhand Provenance & Restrained Distortion Model

When `speakerId` shares `sourceMem` with `listenerId`:

1. **Provenance & Confidence Step**:
   - `nextHop = sourceMem.hopCount + 1`.
   - `nextProvenance = nextHop === 1 && !sourceMem.distorted ? 'secondhand' : 'rumor'`.
   - `nextConfidence = Math.max(25, sourceMem.confidence - (nextHop === 1 ? 22 : 30))` *(proposed tuning)*.
   - `originResidentId = sourceMem.originResidentId ?? (sourceMem.hopCount === 0 ? speakerId : undefined)`.
   - `fromResidentId = speakerId`.
2. **Restrained Personality-Tinted Distortion**:
   - Distortion probability increases on `hop >= 2`, high `speaker.traits.curiosity` / `sociability` (`>= 0.72`, e.g. Pip or Jun), or lower `NpcNpcRelation` warmth (`rel.affinity < 35` or `tension >= 15`), and is **zero** for protected canonical lore unless uncertain wording applies.
   - Deterministic `distortionFlavor` selection:
     - `'uncertain'`: default mild drift on hop 2 or low confidence (`<= 55`).
     - `'exaggerated'`: if speaker `temperament === 'spirited' || traits.curiosity >= 0.75` and `valence === 'warm'` (e.g., Pip embellishes a fountain coin or sourdough basket into a minor festival).
     - `'softened'`: if speaker `temperament === 'gentle'` and `valence === 'tense'` (softens awkwardness into *"seemed a bit distracted"*).
     - `'misattributed_motive'`: rare (`<= 12%` when `valence === 'tense'` and `rel.tension >= 15`), e.g. misreading why someone stepped back—**always preserving true `eventId`, `subjectPlayer`, and `subjectResidents`** so the player can clarify or mend it directly!
3. **Anti-Loop & Cooldown Stamp**:
   - Increment `sourceMem.sharedCount += 1`.
   - Set `rel.lastGossipDay = day`, `rel.lastGossipMinute = minuteOfDay`, `rel.lastGossipEventId = sourceMem.eventId`.

---

## 7. Social Reactions & Third-Party Gossip Integration

### 7.1 Replacing Global Omniscience in `event_reaction` (`narrative.ts:1038-1124`)

- **`event_bell_celebration`**: Replace `requiresRecentEventKind: { kind: 'bell_ring' }` with `requiresNpcMemoriesAny: ['bell_ring', 'bell_chime', 'bell_restored']`. Topic text adapts cleanly to `mem.provenance` & `mem.detail?.acousticOnly`:
  - `firsthand` (visual): *"Seeing the brass bell swing again right above the square..."*
  - `firsthand` (`acousticOnly`): *"Hearing that clear brass chime carry all the way over here..."*
  - `secondhand` / `rumor`: *"${fromName} told me the Gazebo Bell rang out earlier—I have to walk by and hear it myself!"*
- **`event_gift_thanks`**: Replace `requiresRecentEventKind: { kind: 'player_help' }` with `requiresNpcMemoriesAny: ['player_gift', 'player_help_observed', 'player_help']`. Phrasing distinguishes receiving a gift (`sourceKind === 'participant'`), seeing the player carry bundles (`'witness'`), or hearing from a neighbor (`'gossip'`), plus exaggerated flavor if `distortionFlavor === 'exaggerated'`.
- **`event_fountain_repair`**: Trigger on `requiresNpcMemoriesAny: ['fountain_fixed']` (recorded for Barnaby, nearby witnesses, and anyone who visits the plaza or hears via gossip) rather than raw global `flagsTrue`.

### 7.2 Grounding Third-Party Player Gossip (`selectThirdPartyGossipSubject` & `gossip_third_party_relation`)

Instead of reading `world.playerRelations[otherId]` omnisciently for any resident:

1. **Knowledge-Backed Candidate Filtering**: A speaker `S` can only discuss player relationship/friction with `otherId` if at least one of the following holds:
   - `S` holds an `npcMemories[S]` entry involving `otherId` (`subjectResidents.includes(otherId) && subjectPlayer`) such as a witnessed gift, friction, milestone, or secondhand `social_impression` / `gossip` entry; OR
   - `S` and `otherId` share a `warm` / `confidant` bond (`getNpcRelation(S, otherId).affinity >= 45 && tension < 20`) **and** they have interacted recently (`lastInteractionDay !== null`, e.g., within 3 days) or are in a shared encounter/zone where `otherId` would naturally confide in `S`.
2. **Provenance-Colored Delivery**:
   - Direct `firsthand` witness/participant vs `secondhand` (*"${fromName} mentioned..."*) vs `rumor` (*"Heard a whisper on the cobbles—not sure I got every detail straight, though..."*), plus gentle opportunity for the player to clarify if `distorted === true`!
3. **One-Shot Mention Guard**: Selecting or completing a memory-backed reaction/gossip choice marks that `NpcMemoryEntry.mentionedToPlayer = true` via `DialogueChoice` hooks (`markMemoriesMentioned`) so residents move naturally on to fresh memories instead of looping on yesterday's news.

### 7.3 `DialogueCondition` & `DialogueChoice` Extensions

- **`DialogueCondition` additions** (`src/game/types.ts`):
  - `requiresNpcMemory?: { tag?: string; id?: string; provenance?: NpcMemoryProvenance[]; maxDaysOld?: number; unmentionedOnly?: boolean }` (rich companion to existing `requiresNpcMemoriesAny` / `excludesNpcMemories`, which remain 100% supported).
- **`DialogueChoice` additions** (`src/game/types.ts`):
  - `recordNpcMemories?: Array<{ target: 'speaker' | ResidentId; id: string; eventId?: string; tag: string; category: NpcMemoryCategory; valence: NpcMemoryValence; importance: number; retention: NpcMemoryRetention; sourceKind?: NpcMemorySourceKind; subjectPlayer?: boolean; subjectResidents?: ResidentId[] }>`
  - `markMemoryTagsMentioned?: string[]` (or automatic `session.mentionedMemoryEventIds` on `DialogueSession` marked when the root/choice concludes).

---

## 8. Scalability & Performance Analysis

- **Beyond 9 Residents (e.g., 25–40 residents)**:
  - All memory creation, witness distance scans, retention pruning, and encounter gossip iterate `RESIDENT_ORDER` (`O(N)` per discrete event, never `O(N^2)` per frame).
  - Even with 40 residents, `collectWitnessesForPosition` performs 40 squared-distance arithmetic checks on discrete player actions (< 0.005 ms).
  - `ActiveSocialEncounter` concurrency remains bounded (`Math.max(2, Math.floor(N / 4))`), and `propagateEncounterGossip` evaluates at most 2–3 participants at encounter creation time.
- **Zero-GC Compliance**:
  - `stepSimulationInPlace` only invokes `propagateEncounterGossipInPlace` inside the `if (world.activeEncounters.length < maxConcurrentEncounters)` encounter-creation branch, leaving steady-state 60 Hz movement frames completely allocation-free.
