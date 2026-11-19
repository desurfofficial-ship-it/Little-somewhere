# 15 — Milestone 2B Phase 3: Design Decisions, Trade-Offs & Approval Gates

**Status**: Decision Register for Review & Explicit Approval  
**Note**: Nothing in this blueprint has been implemented yet. All concrete numbers in Section B are **proposed tuning defaults** open to adjustment.

---

## A. Established Constraints & Decisions (Already Fixed)

1. **Pure Layer Separation**: All Phase 3 simulation, memory, gossip, dialogue, and persistence logic lives in `src/game/` with zero Three.js, React, or unguarded browser DOM imports.
2. **In-Game Time Only**: All memory timestamps (`createdDay`, `learnedDay`, `expiresDay`), cooldowns (`lastGossipDay`), and decay use in-game `world.day` and `world.minuteOfDay`—never `Date.now()` or real-world calendar days.
3. **Deterministic PRNG**: All gossip selection and distortion rolls use `hashSeed` + `mulberry32` seeded from `world.simSeed`, `world.day`, and discrete IDs.
4. **No Hive-Mind / Truth Integrity**: NPC memories (`npcMemories`) are subjective and separate from permanent world truth (`flags`, `JournalMemory`). Rumors never mutate `StoryFlags` or erase permanent milestones.
5. **Dynamic Population Scaling**: All iteration, witness scanning, gossip pairing, and persistence sanitization must use `RESIDENT_ORDER` and `NpcNpcRelation` pairs rather than hardcoding 9 residents.
6. **Zero New Dependencies & Zero-GC Tick Discipline**: Zero new npm packages; no per-frame pair scans or allocations in `stepSimulationInPlace`.

---

## B. Proposed Technical Defaults (With Tuning Parameters Flagged)

| Area | Proposed Default | Tuning Parameters Flagged *(Non-Final)* |
| :--- | :--- | :--- |
| **Memory Capacity** | Bounded sorted list per resident in `WorldState.npcMemories` | `MAX_NPC_MEMORIES_PER_RESIDENT = 14`; `MAX_PERMANENT_MEMORIES_PER_RESIDENT = 6` |
| **Memory Lifetimes** | Permanent milestones exempt from TTL; durable & ephemeral age by in-game days | `EPHEMERAL_RUMOR_TTL_DAYS = 5`; `DURABLE_MEMORY_TTL_DAYS = 18` |
| **Witness Capture** | Spatial check on player/story actions + wider acoustic check for Gazebo Bell chimes | `LOCAL_WITNESS_RADIUS = 8.5 m`; `ACOUSTIC_BELL_RADIUS = 30 m` |
| **Gossip Trigger** | Discrete hook inside `ActiveSocialEncounter` creation only (zero per-frame scan) | `MAX_GOSSIP_PER_ENCOUNTER = 1`; `MAX_GOSSIP_HOPS = 2` (`1` for friction); `MAX_SHARES_PER_ENTRY = 3` |
| **Gossip Trust & Cooldown** | Requires non-estranged bond; friction/personal rumors require warm/confidant bond | `GOSSIP_MIN_AFFINITY = 20`, `GOSSIP_MAX_TENSION = 30`; sensitive bar `affinity >= 38, tension < 20`; pair cooldown `1x per in-game day` |
| **Distortion Model** | Restrained, traceable flavor tags (`uncertain`, `exaggerated`, `softened`, `misattributed_motive`) keeping true `eventId` & subjects | Confidence steps: `100` firsthand -> `-22` hop 1 (`78`) -> `-30` hop 2 (`48`, min `25`); corroboration `+10` (cap `85`) |
| **Text Representation** | Compact structured `NpcMemoryEntry` + deterministic `formatNpcMemorySummary()` prose builder | Eliminates persisted prose duplication & stale text on upgrade |

---

## C. Unresolved Questions & Architectural Trade-Offs

### D1. `WorldState` Schema Versioning Scope (`v4` Phase-3-Only vs. Shared `v4` with Phase 4)
- **Context**: `docs/milestones/09-milestone-2b-audit-and-design.md` §4.3 proposed adding both `npcMemories` (Phase 3) and `storylines` (Phase 4) in `v4`.
- **Option A (Recommended)**: Advance to `schemaVersion: 4` containing **only** Phase 3 (`npcMemories` + optional `NpcNpcRelation` gossip cooldown fields), then advance `v4 -> v5` in Phase 4 when `storylines` is actually designed and built. Keeps Phase 3 100% isolated from Phase 4.
- **Option B**: Reserve optional `storylines?: Record<string, ...>` in `v4` now so `schemaVersion` only bumps once across Phases 3–4.
- **Trade-off**: Option A avoids dead unused fields in `WorldState v4` and preserves clean milestone isolation; Option B saves one sequential migration function (`migrateV4ToV5`) later.

### D2. Transitioning `selectThirdPartyGossipSubject` & Existing Omniscient Gossip Tests
- **Context**: `src/game/dialogueEngine.ts:73-127` (`selectThirdPartyGossipSubject`) currently reads `world.playerRelations[otherId]` globally, and `src/game/relationships.test.ts:255-304` asserts that Sora immediately comments on Toby being `kindred` or `guarded` on a fresh state with zero encounters or witness events. Also, 4 handcrafted topics (`gossip_jun_clara_bond`, `gossip_sora_mina_bond`, `gossip_nora_arthur_bond`, `gossip_barnaby_pip_acquaintance`) rely on `playerRelationWith`.
- **Option A (Recommended — Strict Non-Omniscience)**: Scope `selectThirdPartyGossipSubject` (and optionally the 4 bond gossip topics) to require either a relevant `npcMemories[speaker]` record involving the player & `otherId`, **or** a high-warmth bond (`affinity >= 45` with recent interaction) + update `relationships.test.ts:255-304` cleanly to seed the witness/gossip memory or encounter that informed Sora.
- **Option B (Hybrid Transition)**: Keep `selectThirdPartyGossipSubject` reading `playerRelations` only when `speaker` and `otherId` are `'warm'`/`'confidant'` baseline friends (like Sora & Mina, Jun & Clara) while gating distant/guarded rumors strictly through `npcMemories` + gossip propagation.
- **Trade-off**: Option A fully delivers the Phase 3 non-omniscience goal (with a clean update to the pre-Phase-3 test setup); Option B preserves the exact existing test untouched at the cost of allowing close pairs to infer player standing without an explicit encounter.

### D3. Bundling Pre-Existing `v3` Event Hygiene Fixes (`BUG-01` & `DUP-03`) in Phase 3
- **Context**: Audit found two bugs in `src/game/actions.ts`:
  1. `DUP-03` (`actions.ts:210-226` + `426-441`): `deliverHeldItemAction` pushes two `player_help` `WorldEventRecord`s for one gift (`story_...` + `help_...`).
  2. `BUG-01` (`actions.ts:522-541` + `App.tsx:253-269, 319-331`): `interactWithProp('gazebo_bell')` increments `bellRungCount` and pushes a `bell_ring` `WorldEventRecord` with hardcoded `actors: ['clara', 'arthur', 'pip']` **before** the user clicks `"Ring the Brass Bell"`, and `handlePropAction('ring_bell')` increments `bellRungCount` again without a `WorldEventRecord`.
- **Option A (Recommended)**: Fix `DUP-03` and `BUG-01` cleanly in Step 3.5 so acoustic bell witness memories fire on the actual ring action (`ring_bell`) without hardcoded 3-resident actor lists, and gifts produce one canonical event/memory. *(Requires updating `engine.test.ts:131-133` if `bellRungCount` moves from `interactWithProp` preview to `ring_bell` action, OR keeping `interactWithProp` consistent.)*
- **Option B**: Leave existing `WorldEventRecord` behavior untouched and merely deduplicate in `memories.ts` by `eventId`.
- **Trade-off**: Option A prevents bell inspection cancellations from falsely telling the whole town the bell rang; Option B avoids touching any existing `engine.test.ts` assertions.

### D4. Clarification / Repair Flow for Distorted Rumors
- **Context**: Phase 3 introduces restrained `distortionFlavor` (`exaggerated`, `uncertain`, `misattributed_motive`).
- **Question**: Should Phase 3 include a light player dialogue choice when hearing a distorted rumor (e.g., *"Actually, here's what happened..."* which clarifies the rumor to `secondhand` / clears `misattributed_motive`), or treat distorted rumors purely as ambient narrative flavor until Phase 4 storylines?
- **Recommendation**: Include a lightweight dynamic clarification choice on `gossip_third_party_relation` / `event_reaction` when `mem.distorted && mem.distortionFlavor === 'misattributed_motive'`, keeping authoring minimal (~1 shared helper) while making misunderstandings interactive and cozy.

### D5. Role of `world.worldEvents` After Phase 3
- **Context**: `JournalDrawer.tsx:399-420` displays `world.worldEvents.slice(0, 5)` as *"Recent Lane Moments"*.
- **Recommendation**: Keep `world.worldEvents` strictly as the **bounded player-facing chronicle** (used by `JournalDrawer` and `resolveContextFlavorRemark`'s same-day direct encounter check) and migrate all `event_reaction` NPC awareness (`dialogueEngine.ts` / `narrative.ts`) off global `worldEvents` onto `npcMemories`.

### D6. `JournalDrawer` Visibility During Phase 3 vs. Phase 5
- **Recommendation**: Defer **all** `JournalDrawer.tsx` UI changes (showing per-neighbor memories/rumors, removing `Reliability %`, dynamic storyline cards) cleanly to **Phase 5**, keeping Phase 3 focused strictly on simulation, memory, gossip, dialogue reactions, and persistence.

---

## D. Explicit Decisions Requiring Approval Before Implementation

Please review and confirm approval on:

1. **Overall Phase 3 Architecture & 9-Step Roadmap** (Docs 11 & 13).
2. **D1 (`WorldState` Versioning)**: Bump `CURRENT_SCHEMA_VERSION = 4` for Phase 3 (`npcMemories` + optional `NpcNpcRelation` gossip cooldown fields), deferring `storylines` to Phase 4 (`v5`) — *or confirm Option B (`v4` reserves both)*.
3. **D2 (Non-Omniscient Third-Party Gossip)**: Transition `selectThirdPartyGossipSubject` to knowledge/memory-backed selection and update the pre-Phase-3 omniscient fixture in `relationships.test.ts` — *or confirm Option B hybrid*.
4. **D3 (`BUG-01` & `DUP-03` Event Fixes)**: Bundle the `deliverHeldItemAction` duplicate-event fix and `gazebo_bell` ring timing/hardcoded-actors fix into Step 3.5 — *or keep `actions.ts` event timing unchanged*.
5. **D4 (Rumor Clarification Choice)**: Allow lightweight player clarification when an NPC repeats a distorted rumor, or keep distortion purely descriptive in Phase 3.
6. **D6 (UI Boundary)**: Keep `JournalDrawer.tsx` unchanged until Phase 5.
7. **Proposed Tuning Values**: Confirm whether the proposed starting defaults (`MAX_NPC_MEMORIES = 14`, `MAX_GOSSIP_HOPS = 2`, `1` gossip per encounter, `1x/day` pair cooldown, `8.5 m` sight / `30 m` bell acoustic radius, `5`/`18` day TTLs) are acceptable as initial tunable constants.
