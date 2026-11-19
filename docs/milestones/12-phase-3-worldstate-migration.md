# 12 — Milestone 2B Phase 3: WorldState Schema & Save Migration Plan

**Status**: Proposed Migration Blueprint (Requires Approval Before Editing `types.ts` or `migrations.ts`)  
**Target Transition**: `WorldState` `schemaVersion: 3` -> `schemaVersion: 4` (Sequential `v1 -> v2 -> v3 -> v4` pipeline)

---

## 1. Why `WorldState` Schema Version `4` Is Necessary

Phase 3 cannot be cleanly implemented inside existing `v3` structures without breaking architectural hygiene:

- `world.memories` is the **player's** Journal memory list (`JournalMemory[]`) and is rendered directly in `JournalDrawer.tsx` + checked by `App.tsx:122` (`hasSavedProgress`) and `engine.test.ts:140`. Mixing per-NPC hearsay/rumors into `world.memories` would corrupt the player's scrapbook.
- `world.worldEvents` is a bounded 40-entry global ring buffer (`WorldEventRecord[]`). As events scroll off after 40 entries, personal long-term NPC memories would vanish, and global records lack per-listener provenance, confidence, distortion state, and `mentionedToPlayer` tracking.
- Packing per-NPC memory arrays into `sideFlags: Record<string, boolean | number | string>` as stringified JSON blobs would bypass per-field TypeScript typing and sanitization.

Therefore, an additive `schemaVersion: 4` upgrade is the clean, maintainable path.

---

## 2. Schema Scope Boundary: Phase 3 (`v4`) vs. Phase 4 (`storylines`)

`docs/milestones/09-milestone-2b-audit-and-design.md` §4.3 originally sketched adding both `npcMemories` and `storylines` together under `v4`. Because Milestones 2B Phases 3 and 4 are now scoped and approved independently:

- **Recommended Approach (Option A — Clean Per-Phase Versioning)**:
  - **Phase 3 bumps `CURRENT_SCHEMA_VERSION = 4`**, adding strictly what Phase 3 owns:
    1. `WorldState.npcMemories: Record<ResidentId, NpcMemoryEntry[]>`
    2. Optional additive fields on `NpcNpcRelation`: `lastGossipDay?: number | null`, `lastGossipMinute?: number | null`, `lastGossipEventId?: string`
  - **Phase 4 later bumps `v4 -> v5`** cleanly to add `WorldState.storylines: Record<string, StorylineProgress>`.
  - *Why recommended*: Zero dead/untested `storylines` runtime code during Phase 3, strict boundary compliance ("do not start Phase 4"), and simple independent rollback.
- **Alternative (Option B — Reserve `storylines?: Record<string, ...>` in `v4`)**:
  - Avoids a second `v4 -> v5` bump later, at the cost of carrying unused Phase 4 type/migration scaffolding during Phase 3.
- *(Flagged explicitly in Doc 15 Decision D1 for reviewer confirmation.)*

---

## 3. Exact Additive `WorldState v4` Diff

```ts
// 1. Additive optional gossip cooldown fields on NpcNpcRelation (src/game/types.ts)
export interface NpcNpcRelation {
  pair: NpcPairKey;
  affinity: number; // -50..100
  tension: number; // 0..100
  sharedTags: string[];
  lastInteractionDay: number | null;
  lastGossipDay?: number | null;      // NEW (Phase 3)
  lastGossipMinute?: number | null;   // NEW (Phase 3)
  lastGossipEventId?: string;         // NEW (Phase 3)
}

// 2. Additive top-level field on WorldState (src/game/types.ts)
export interface WorldState {
  schemaVersion: number; // CURRENT_SCHEMA_VERSION = 4
  // ... all existing v3 fields preserved 100% unchanged ...
  npcMemories: Record<ResidentId, NpcMemoryEntry[]>; // NEW (Phase 3), bounded per resident
}
```

Every single `v3` property (`simSeed`, `regionId`, `day`, `minuteOfDay`, `season`, `weather`, `playerPos`, `playerFacing`, `playerPosture`, `playerSeatId`, `playerHeldItem`, `worldProps`, `residents`, `npcRuntime`, `playerRelations`, `npcRelations`, `activeEncounters`, `worldEvents`, `npcActivityHistory`, `topicHistory`, `lastTopicByResident`, `sideFlags`, `flags`, `memories`, `mailboxUnread`, `dailyLettersRead`, `bellRungCount`) remains **100% untouched** in type and behavior.

---

## 4. Sequential Migration Pipeline (`v1 -> v2 -> v3 -> v4`)

`src/game/migrations.ts` preserves the existing sequential chain and appends `migrateV3ToV4`:

```ts
if (version === 1) {
  working = migrateV1ToV2(working);
  version = 2;
}
if (version === 2) {
  working = migrateV2ToV3(working);
  version = 3;
}
if (version === 3) {
  working = migrateV3ToV4(working);
  version = 4;
}
```

- `loadWorldState()` (`src/game/storage.ts:46-52`) already detects `res.migratedFromVersion < CURRENT_SCHEMA_VERSION`, backs up the pre-upgrade raw payload to `little_somewhere_world_v1_backup`, and writes the upgraded `v4` save to `little_somewhere_world_v1`.

---

## 5. Hydration Rules for Existing `v1` / `v2` / `v3` Saves (`migrateV3ToV4`)

When upgrading an older save (or initializing a fresh world via `createDefaultWorldState()`):

1. **Preserve All Existing Player Progress**: Never alter `flags`, `sideFlags`, `memories`, `residents`, `playerRelations`, `npcRelations`, `worldEvents`, or `topicHistory`.
2. **Initialize Every Registered Resident (`RESIDENT_ORDER`)**: Start with `npcMemories[id] = []` for all residents (scales dynamically if new residents are added later).
3. **Lore-Consistent Baseline & Retroactive Flag Hydration** (runs inside `createInitialNpcMemoriesFromWorld(v3State)`):
   - **Gazebo Rift Lore**: If `!flags.claraArthurReconciled`, seed `gazebo_rift` (`provenance: 'firsthand'`, `sourceKind: 'participant'`, `category: 'town_lore'`, `retention: 'permanent'`, `importance: 4`, `valence: 'tense'`, `subjectResidents: ['clara', 'arthur']`, `mentionedToPlayer: false`) on both `'clara'` and `'arthur'` (also seeded on fresh Day 1 worlds so baseline tension has grounded memory!).
   - **Reconciliation & Bell Restoration**: If `flags.claraArthurReconciled`, seed `ev_clara_arthur_reconciled` (`permanent`, `firsthand`, `warm`) on `'clara'` and `'arthur'`. If `flags.bellRestored`, seed `ev_bell_restored` (`permanent`, `firsthand`, `warm`, `tag: 'bell_restored'`) on `'arthur'`, `'clara'`, and `'pip'` (only if those residents exist in `RESIDENTS`).
   - **Major Physical Plaza Flags**:
     - If `flags.repairedFountain`, seed `ev_fountain_fixed` (`durable`, `firsthand`, `tag: 'fountain_fixed'`) on `'barnaby'`.
     - If `flags.plantedMoonPetals`, seed `ev_moon_petals` (`durable`, `firsthand`, `tag: 'moon_petals'`) on `'mina'`.
     - If `flags.deliveredPostcard`, seed `ev_postcard_delivered` (`durable`, `firsthand`, `tag: 'postcard_delivered'`) on `'jun'` and `'nora'`.
     - If `flags.brewedChamomileTea`, seed `ev_chamomile_tea` (`durable`, `firsthand`, `tag: 'chamomile_tea'`) on `'sora'`.
   - **Existing Player Friction / Guardedness**: For any resident in `RESIDENT_ORDER` where `playerRelations[id]?.negativeCount > 0`, seed a single `durable` `friction` memory (`tag: 'player_blunt'`, `valence: 'tense'`, `createdDay: playerRelations[id].lastTalkDay ?? day`) so existing guarded relationships carry coherent Phase 3 memory immediately after upgrade.
   - **Existing `worldEvents` Backfill (Selective, Bounded)**: Optionally inspect `v3.worldEvents` where `world.day - ev.day <= 2` and `ev.kind === 'player_help' || ev.kind === 'bell_ring'` and hydrate `firsthand` memories onto `ev.actors` (only valid resident IDs), avoiding overwriting any milestone memory already hydrated above.

---

## 6. Per-Field Sanitization & Defensive Validation (`sanitizeWorldState`)

`sanitizeNpcMemories(rawNpcMemories, flags, currentDay, warnings)` enforces strict invariants on every load and every `serializeWorldState()` call:

1. **Resident Key Validation**: Only populate keys present in `RESIDENT_ORDER`; ignore orphaned/unknown resident keys cleanly while guaranteeing every active resident has an initialized array.
2. **Entry Field Validation & Clamping**:
   - Discard non-objects or entries missing valid string `id`, `eventId`, or `tag`.
   - Validate enum fields (`provenance`, `sourceKind`, `category`, `retention`, `valence`, `distortionFlavor`) against `Set` whitelists, falling back safely (`'secondhand'`, `'gossip'`, `'event'`, `'ephemeral'`, `'neutral'`, `'none'`).
   - Filter `subjectResidents` strictly to valid `RESIDENT_ORDER` entries.
   - Validate `fromResidentId` / `originResidentId` against `RESIDENT_ORDER`, clearing invalid or self-referential `fromResidentId === ownerId`.
   - Clamp `hopCount` (`0..MAX_GOSSIP_HOPS`, forced `0` if `provenance === 'firsthand'`).
   - Clamp `confidence` (`0..100`, forced `100` if `provenance === 'firsthand'`).
   - Clamp `importance` (`1..5`), `emotionalWeight` (`0..100`), `sharedCount` (`>= 0`).
   - Clamp temporal fields: `createdDay >= 1`, `learnedDay >= createdDay`, `createdMinute` / `learnedMinute` via `clampMinuteOfDay`.
   - Drop expired entries where `retention !== 'permanent' && expiresDay !== undefined && currentDay > expiresDay`.
3. **Deduplication & Hard Bound**:
   - Deduplicate entries with matching `id` or `eventId`, keeping whichever has higher provenance rank (`firsthand > secondhand > rumor`) and higher confidence.
   - Enforce `MAX_NPC_MEMORIES_PER_RESIDENT` (`14`, proposed) via the standard eviction scorer.
4. **Update `sanitizeNpcRelations`**:
   - Sanitize `lastGossipDay` (positive integer `>= 1` or `null`), `lastGossipMinute` (finite clamped minute or `null`), and `lastGossipEventId` (string or omitted).

---

## 7. Persistence Revision Hash (`computeWorldSaveRevision`)

`src/game/storage.ts:87-253` must include `npcMemories` and the new `NpcNpcRelation` gossip fields without allocating intermediate arrays:

- Loop `i` over `residentKeys` (`already sorted` at `storage.ts:170`):
  - Read `const nmems = state.npcMemories?.[id]`.
  - Push `nmems ? nmems.length : 0`, then for each entry `m` push `m.id`, `m.eventId`, `m.provenance`, `m.confidence`, `m.hopCount`, `m.learnedDay`, `m.mentionedToPlayer ? 1 : 0`, `m.sharedCount`.
- Inside the existing `npcRelKeys` loop (`storage.ts:228-237`):
  - Push `r.lastGossipDay ?? -1`, `Math.round(r.lastGossipMinute ?? -1)`, `r.lastGossipEventId ?? ''`.

This preserves `computeWorldSaveRevision`'s fast, zero-GC invariant while guaranteeing that every gossip transfer, memory upgrade, or `mentionedToPlayer` toggle triggers the 5-second / `pagehide` dirty autosave reliably.

---

## 8. Save Size & Quota Budget Analysis

Estimated JSON footprint per `NpcMemoryEntry` (compact structured fields, no duplicated long summary strings):

- **Average entry size**: ~`210–260 bytes` (e.g., `{"id":"ev_bell_restored","eventId":"ev_bell_restored","tag":"bell_restored","category":"event","subjectPlayer":true,"subjectResidents":["arthur","clara"],"provenance":"firsthand","sourceKind":"participant","hopCount":0,"confidence":100,"distorted":false,"distortionFlavor":"none","createdDay":3,"createdMinute":1020,"learnedDay":3,"learnedMinute":1020,"importance":5,"retention":"permanent","valence":"warm","emotionalWeight":90,"mentionedToPlayer":false,"sharedCount":0}`).
- **Current 9 residents (worst-case saturated `14` entries each = 126 entries)**:
  - `126 × 250 B ≈ 31.5 KB` (`+ ~0.5 KB` for `NpcNpcRelation` gossip timestamps).
  - Typical active play (~4–6 memories per NPC): `~10–13 KB`.
  - Total `WorldState v4` JSON size: ~`35–60 KB` (under **1.2%** of standard browser 5 MB `localStorage` quota).
- **Expanded cast (25 residents, saturated `14` entries each = 350 entries)**:
  - `350 × 250 B ≈ 87.5 KB` (`< 2%` of 5 MB `localStorage` quota).
- **Backup key impact (`little_somewhere_world_v1_backup`)**: Only stores a one-time snapshot during schema upgrade (`< 50 KB`), keeping combined storage well below 200 KB even on mobile Safari.
