# 03 — Relationship & Dialogue Architecture Blueprint (Milestone 2)

**Goal**: Evolve **LITTLE SOMEWHERE**'s trust scalar (`0–5`) and 839-line imperative `buildResidentDialogue()` into a **bilateral relationship matrix** (`player <-> NPC` and `NPC <-> NPC`) plus a **declarative, reusable dialogue topic engine** with personality/relationship/event-memory predicates—while preserving every single line, branch, memory, and quest cue of *The Silent Gazebo Bell*.

---

## 1. Current State & Identified Defects

- **Confirmed implementation**:
  - `ResidentProgress` (`src/game/types.ts:64-70`) tracks `trust` (`0..5`), `met`, `talkedToday`, `mood`, and `lastDialogueId`.
  - `buildResidentDialogue(id, world, phase)` (`src/game/narrative.ts:79-917`) builds `Record<string, DialogueNode>` per conversation via imperative `if/else` trees.
  - `applyDialogueChoice()` (`src/game/actions.ts:24-93`) mutates flags, trust, mood, `lastDialogueId`, and unlocks `JournalMemory`.
- **Confirmed limitations**:
  1. **Trust farming bug**: `applyDialogueChoice()` (`actions.ts:39-40`) applies `trustDelta` on every repeatable small-talk node (`pip_skip`, `nora_tea_chat`, `jun_gossip`, `mina_ivy`, `mina_tea`, `barnaby_craft`, `sora_song`, `toby_sketch`, `clara_listen`, `clara_hug`, `arthur_ring_note`) with no `talkedToday` or `choiceId` cooldown check.
  2. **Dead `lastDialogueId` field**: Written at `actions.ts:57`, never read anywhere—NPCs repeat identical conversations endlessly on the same day.
  3. **No NPC-to-NPC relationship graph**: Cross-character bonds (Clara–Arthur estrangement/reconciliation, Mina–Clara herb sharing, Nora–Pip mentorship, Toby–Arthur quiet caution) cannot be queried generically.
  4. **Verified Milestone 1 bugs in `narrative.ts`**:
     - `nora_read_together` (`L260-266`) sets `foundPostcard: true` without unlocking `mem_lost_postcard`.
     - `toby_clapper` (`L633-646`) lacks `requiresFlag: 'heardBellMystery'`, disagreeing with `getResidentAvailableQuestCue('toby', world)` (`L70`) and `interactWithProp(world, 'hollow_oak')` (`actions.ts:211`).
     - `DialogueSheet.tsx:86` assumes `session.nodes[session.currentNodeId]` is non-null without a fallback guard.
- **Potential risk**:
  - Adding 3–5 new side stories, seasonal remarks, and NPC gossip into `buildResidentDialogue()` will push `narrative.ts` past 3,000 lines of fragile nested conditionals and worsen repeat-dialogue fatigue.
- **Proposed improvement**:
  - Separate relationship state (`src/game/relationships.ts`) from a data-driven `DialogueTopic[]` registry and selector (`src/game/dialogueEngine.ts`), keeping a thin compatibility layer for `The Silent Gazebo Bell` milestone beats.

---

## 2. Relationship Architecture (`src/game/relationships.ts`)

### 2.1 Unified Bilateral Relationship Graph
Represent relationships symmetrically/directed in `WorldState`:

```ts
export type RelationshipTier =
  | 'stranger'      // trust < 1
  | 'acquaintance'  // 1 <= trust < 2
  | 'friendly'      // 2 <= trust < 3.5
  | 'close'         // 3.5 <= trust < 4.5
  | 'kindred';      // >= 4.5

export interface PlayerNpcRelation {
  residentId: ResidentId;
  affinity: number;             // Continuous 0..100 (maps cleanly to 0..5 hearts!)
  familiarity: number;          // Increments on talks/waves even if daily trust capped
  dailyAffinityGained: number;  // Resets on advanceToNextDay(), hard cap e.g. +20/day
  talkedCount: number;
  lastTalkDay: number | null;
  lastTalkPhase: TimePhase | null;
  mood: ResidentProgress['mood'];
  moodUntilMinute: number;      // Allows temporary 'joyful' or 'busy' moods without lock-in
}

export type NpcPairKey = `${ResidentId}:${ResidentId}`; // Canonical alphabetical sort e.g. 'arthur:clara'

export interface NpcNpcRelation {
  pair: NpcPairKey;
  affinity: number;             // -50 (estranged) .. +100 (close confidants)
  tension: number;              // 0..100 (Clara:Arthur starts at affinity: -20, tension: 75)
  sharedTags: string[];         // e.g. ['sourdough_herbs', 'gazebo_rift', 'reconciled_autumn']
  lastInteractionDay: number | null;
}
```

### 2.2 Backward Compatibility & Trust Farming Fix
- **Heart Derivation**: `getHeartLevel(affinity)` returns `Math.min(5, Math.floor(affinity / 20))` (`0..5`), preserving the 5-heart UI in `DialogueSheet.tsx:114-125` and `JournalDrawer.tsx:168-179`, plus `minTrust` checks (`minTrust * 20 <= relation.affinity`).
- **Daily Cap & Diminishing Returns**:
  - Story milestone beats (`isStoryMilestone: true`, e.g., finding the clapper or restoring the bell) always grant their full affinity reward (`+20` = `+1` heart).
  - Repeatable small-talk / flavor choices check `dailyAffinityGained < 20` and enforce per-topic/per-day rewards (e.g., first daily chat `+12` affinity, repeat same-day chats `+0` affinity / `+2` familiarity), completely eliminating the Day 1 infinite heart-farming exploit.
- **NPC-to-NPC Seeded Baseline**:
  - `arthur:clara` starts `{ affinity: -20, tension: 75, sharedTags: ['gazebo_rift'] }` -> upon `claraArthurReconciled`, shifts to `{ affinity: 55, tension: 5, sharedTags: ['reconciled_bell'] }` and continues warming slowly when they meet at Golden Hour.
  - `clara:mina` starts `{ affinity: 65, tension: 0, sharedTags: ['lavender_loaves'] }`.
  - `arthur:barnaby`, `nora:sora`, `nora:pip`, `pip:toby`, `jun:clara` start with distinct lore-accurate warmths so social encounters and gossip immediately feel alive.

---

## 3. Declarative Dialogue & Event History Engine (`src/game/dialogueEngine.ts`)

### 3.1 Event History & Conversation Memory
Track lightweight structured history on `WorldState` (bounded ring buffer, e.g., last `60` world events + per-topic `DialogueSeenRecord`):

```ts
export interface WorldEventRecord {
  id: string;
  day: number;
  phase: TimePhase;
  kind: 'story_flag' | 'npc_social' | 'bell_ring' | 'weather_shift' | 'player_help';
  actors: ResidentId[];
  summaryTag: string; // e.g. 'fountain_fixed', 'chat_clara_mina'
}

export interface TopicHistoryEntry {
  seenCount: number;
  lastSeenDay: number;
  lastSeenPhase: TimePhase;
  chosenChoiceIds: string[];
}
```

### 3.2 Reusable Declarative `DialogueTopic` Schema
Replace hardcoded procedural trees with typed `DialogueTopic` definitions organized per resident or shared neighborhood pool:

```ts
export interface DialogueCondition {
  flagsTrue?: Array<keyof StoryFlags>;
  flagsFalse?: Array<keyof StoryFlags>;
  minTrust?: number;                        // Player <-> speaker (0..5)
  maxTrust?: number;
  minNpcAffinity?: { a: ResidentId; b: ResidentId; min: number };
  phases?: TimePhase[];
  weathers?: WeatherType[];
  seasons?: SeasonType[];
  requiresPersonalityTag?: string;          // e.g. 'outdoorsy', 'craftsperson'
  requiresRecentEventTag?: { tag: string; maxDaysAgo: number };
  notSeenToday?: boolean;
  maxSeenCount?: number;
  minDaysSinceSeen?: number;
}

export interface DialogueTopic {
  id: string;
  residentId: ResidentId | 'any';
  category: 'quest_milestone' | 'event_reaction' | 'npc_gossip' | 'weather_season' | 'daily_slice';
  priority: number;                         // e.g. 100 = quest, 70 = recent event, 40 = weather/time, 10 = fallback
  cooldownDays: number;
  condition: DialogueCondition;
  buildNodes: (ctx: DialogueBuildContext) => Record<string, DialogueNode>;
}
```

### 3.3 Deterministic Topic Selection Pipeline
When the player talks to `residentId`:
1. Gather all `DialogueTopic` entries matching `topic.residentId === residentId || topic.residentId === 'any'`.
2. Filter by `evaluateCondition(topic.condition, world, residentId, phase)` (checking flags, trust, NPC-to-NPC affinity, personality traits, weather/season, recent `worldEvents`, and `topicHistory[topic.id]` cooldowns).
3. Sort eligible topics by `(priority DESC, neverSeenBonus DESC, leastRecentlySeen ASC, deterministicTieBreak)`.
4. Also append up to 1 **secondary unlocked conversation option** onto the selected `root` node if a lower-priority `quest_milestone` choice (like Clara's mediation or Barnaby's fountain valve) is available concurrently—ensuring the player is never locked out of story progression by a daily weather greeting!
5. **Fallback Safety**: Always include a zero-condition `daily_slice` fallback pool (3–4 distinct phase/personality-flavored variations per resident selected by `(day + talkedCount) % pool.length`), guaranteeing `session.nodes[session.currentNodeId]` is always valid and preventing same-day verbatim repetition.

---

## 4. Preserving *The Silent Gazebo Bell* & Fixing Verified Inconsistencies

- **Storyline Preservation**:
  - Every existing choice ID (`pip_promise`, `nora_take_card`, `barnaby_ladder`, `barnaby_fountain`, `mina_plant`, `sora_tea`, `toby_clapper`, `clara_bridge_baking`, `clara_bridge_truth`, `arthur_restore_bell`, etc.), flag mutation, and `JournalMemory` ID (`mem_bell_mystery`, `mem_lost_postcard`, `mem_postcard_sent`, `mem_moon_petals`, `mem_gazebo_cleared`, `mem_fountain_fixed`, `mem_chamomile_tea`, `mem_brass_clapper`, `mem_reconciliation_bread`, `mem_reconciliation_truth`, `mem_bell_restored`) is migrated verbatim into `quest_milestone` topics.
- **Confirmed Defect Fixes Scheduled for Milestone 2**:
  1. Ensure `nora_read_together` grants `mem_lost_postcard` consistently with `nora_take_card` (fixing `narrative.ts:260-266`).
  2. Align `toby_clapper` choice availability with `getResidentAvailableQuestCue('toby', world)` (`requiresFlag: 'heardBellMystery'`) OR allow discovering it intentionally with an updated cue (fixing the mismatch between `narrative.ts:70` and `narrative.ts:637`).
  3. Add a missing-node fallback in `DialogueSheet.tsx:86` (`const node = session.nodes[session.currentNodeId] ?? Object.values(session.nodes)[0]`) and a `node:test` integrity check verifying every `choice.nextNodeId` resolves to an existing node in `session.nodes`.
  4. Replace hardcoded `lastDialogueId` dead-write with `topicHistory` + `lastTopicId` tracking, and add **repeatable post-story conversations** (e.g., Clara asking about seasonal sourdough loaves, Arthur offering clockwork trivia, neighbors reacting to recent rain or NPC-to-NPC chats they shared earlier that day).
