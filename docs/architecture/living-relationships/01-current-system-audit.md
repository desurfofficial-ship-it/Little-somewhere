# 01 — Current System Audit

**Scope**: Verified against canonical `origin/main` at Milestone 3 Build 8.  
**Rule**: Facts below are observed in source. Proposals appear only in later documents.

## 1.1 WorldState and Persistence

- Current schema: **v9** (`CURRENT_SCHEMA_VERSION = 9` in `src/game/migrations.ts`).
- Interior state slices already present:
  - `greenhouseState` (v7)
  - `bakeryState` (v8)
  - `nookState` (v9)
  - `cottageState` / `dailyActivities` (v6 everyday life)
- `playerLocation`: `'exterior' | 'cottage_interior' | 'greenhouse_interior' | 'bakery_interior' | 'nook_interior'`.
- Persistence is localStorage via `storage.ts` with defensive sanitizers and a chained migration path. Day-stamped fields (e.g. `bakeCheckedDay`, `teaSharedDay`) avoid nightly reset.

## 1.2 Relationships

**Player ↔ NPC** (`PlayerNpcRelation` in `types.ts`, logic in `relationships.ts`):

- `affinity` 0–100, derived tiers: stranger → acquaintance → friendly → close → kindred.
- `familiarity`, `reliability`, `talkedCount`, `lastTalkDay` / `lastTalkPhase`.
- Daily smalltalk affinity cap: **20** (`DAILY_SMALLTALK_AFFINITY_CAP`). First daily talk grants 10.
- No currency, no failure timers, no automatic decay observed in current code.

**NPC ↔ NPC** (`NpcNpcRelation`):

- Pair key, affinity (−50..100), tension, sharedTags, last interaction / gossip stamps.
- Used to suppress social pairing and to bias encounter chance.

## 1.3 Dialogue

- Selector lives in `dialogueEngine.ts` (`selectDialogueSession`, condition evaluation, `makeSimpleTopic` / `makeBranchingTopic`).
- Content registry is the large `DIALOGUE_TOPICS` array in `narrative.ts` (~79 topics).
- Conditions already support flags, relationship tiers, storyline stages, third-party relations, and interior-observable state (used by Mina/Clara/Nora).
- Topic history and last-topic-per-resident exist to avoid immediate repetition.

## 1.4 Residents, Schedules, and Simulation

- 10 residents defined in `residents.ts` with traits (`sociability`, `outdoorsiness`, `morningLark`, `preferredZones`, `rainBehavior`) and 4-phase schedules.
- `npcRuntime` holds position, activity, emotion, needs, posture, seat reservation, and social partner.
- `stepSimulationInPlace` evaluates activity transitions, seat claims, pathfinding, emotions, and bounded NPC–NPC encounters (2–3 participants).
- When the player is indoors, simulation treats player distance as infinite for outdoor greetings and uses `exteriorPlayerPos` for outdoor reference. **Residents do not enter interiors.**

## 1.5 Interiors

- Consistent cutaway pattern: local bounds, obstacle tables, interactables, hub waypoints, door enter/exit, scene builder that mirrors game registries, paired tests.
- Existing interiors: Willow Step Cottage (player), Sunbeam Greenhouse, Hearth & Crumb Bakery, Linden Book Nook.
- Copperwheel Cottage (Arthur) is the remaining planned neighbor interior; exterior and Arthur’s definition already exist.
- Indoor seats are marked so they are never NPC-claimed under current rules.
- Explicit limitation recorded in Build 8 milestone notes: residents never enter interiors.

## 1.6 Memories and Gossip

- Per-resident memory arrays with hard caps (`MAX_NPC_MEMORIES_PER_RESIDENT = 14`, permanent subset).
- Provenance, retention, valence, and hop limits for gossip.
- Player journal memories (`JournalMemory`) are day/phase stamped and used by dialogue and Discoveries.
- Gossip requires minimum affinity / maximum tension and is hop-limited.

## 1.7 What Does Not Exist

- No invitation records, offer generation, or acceptance flow.
- No interior occupancy model for NPCs.
- No teaching or shared-activity registry.
- No relationship-tier gated home access beyond the player freely entering existing interiors.
- No system that places a resident at an indoor station or chair.

## 1.8 Reusable Foundations (Do Not Rebuild)

- Relationship graph and tier helpers.
- Declarative dialogue topics + selector.
- Day-stamped ritual state pattern.
- Door enter/exit + `playerLocation` + exterior position stash.
- Memory and world-event append helpers.
- Bounded collections and sanitizers.
- Pure reducers in `actions.ts` that commit via `commitWorld()`.

## 1.9 Audit Conclusion

The project already has the social graph, dialogue conditions, interior contracts, and memory infrastructure needed for Living Relationships. The missing layer is a lightweight, relationship-driven invitation and occupancy model that reuses those systems rather than replacing them.
