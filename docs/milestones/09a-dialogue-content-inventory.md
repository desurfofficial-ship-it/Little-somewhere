# 09a — Existing Dialogue Content Inventory & Migration Audit (Phase 1A)

**Status**: Complete — **Awaiting Review Before Any Phase 1 Source Edits**  
**Scope**: Comprehensive, lossless inventory of all dialogue topics, concurrent quest injections, dynamic dialogue hooks, non-topic text interactions, memory IDs, WorldState mutations, engine/UI interactions, duplications, conflicts, and migration mappings across `src/game/` and `src/components/`.  
**Constraint Compliance**: Zero source files modified during Phase 1A; no narrative expansion introduced.

---

## 1. Architecture & System Interaction Trace

### 1.1 Runtime Pipeline Across Files
```
[Player Clicks / Presses E on Resident]
  └─ src/App.tsx: openTargetInteraction() (lines 186–201)
       ├─ interruptSocialEncounter(current, rid)          [src/game/simulation.ts]
       ├─ markResidentMet(interrupted, rid)               [src/game/actions.ts:413]
       └─ buildResidentDialogue(rid, metWorld, phase)     [src/game/narrative.ts:1640]
            └─ selectDialogueSession(id, world, phase, DIALOGUE_TOPICS, buildConcurrentQuestChoices)
                 [src/game/dialogueEngine.ts:255]
                 ├─ Filters topics by residentId ('any' | rid) + evaluateDialogueCondition()
                 ├─ Scores: CATEGORY_PRIORITY[cat] + priority - historyPenalty (-28 today / -min(20, seen*5)) - antiRepeat (-120 if lastTopicId)
                 ├─ Anti-back-to-back swap: if top topic === lastTopicByResident[id] && cat !== 'quest_milestone' && matching.length > 1 -> pick #2
                 ├─ Fallback if matching.length === 0 -> builds `${residentId}_fallback` session
                 ├─ Builds chosen topic nodes, clones root choices
                 ├─ Injects buildConcurrentQuestChoices(rid, world) at START of root.choices (unshift, deduped by choice.id)
                 ├─ Injects buildDynamicGiftChoice(rid, world) at END of root.choices if world.playerHeldItem != null
                 ├─ Injects `make_amends_${rid}` at END of root.choices if rel.negativeCount > 0 && (reliability < 40 || emotion in frustrated/embarrassed/angry) && cat !== 'quest_milestone'
                 └─ Prepends liked-held-item recognition prefix on non-quest root.text

[DialogueSheet Renders Session]
  └─ src/components/DialogueSheet.tsx (lines 98–235)
       ├─ Reads node = session.nodes[session.currentNodeId] ?? session.nodes.root ?? firstNode
       ├─ Filters node.choices via isChoiceAvailable(c, flags, trust, sideFlags)   [narrative.ts -> dialogueEngine.ts:36]
       └─ Dispatches onSelectChoice(choice) -> App.tsx: handleSelectChoice() (lines 254–276)
            └─ applyDialogueChoice(world, session, choice)                          [src/game/actions.ts:38]
                 ├─ Validates isChoiceAvailable(choice, world.flags, currentRes.trust, sf)
                 ├─ Merges choice.setFlags -> world.flags
                 ├─ Merges choice.setSideFlags -> world.sideFlags
                 ├─ Calls recordPlayerTalkAffinity(...)                             [src/game/relationships.ts:238]
                 │    └─ Updates affinity, familiarity, dailyAffinityGained, talkedCount, reliability, negativeCount, favorsCompleted, giftsGiven, trust, mood, lastEmotion
                 ├─ Updates world.npcRuntime[rid].emotion / intensity / emotionUntilMinute
                 ├─ If claraArthurReconciled flipped true -> reconcileClaraAndArthurRelation()
                 ├─ If choice.adjustNpcTension -> adjustNpcRelationPair(...)
                 ├─ If choice.deliverHeldItem -> transfers worldProps[id].holder = rid, clears playerHeldItem
                 ├─ Updates world.topicHistory[session.topicId] (global!) & world.lastTopicByResident[rid]
                 ├─ If choice.unlockMemory -> prepends JournalMemory (deduped by memory.id)
                 └─ If setFlags || setSideFlags || isGift -> pushes WorldEventRecord ('player_help' or 'story_flag')
```

### 1.2 Priority Table (`dialogueEngine.ts:24–34`)
| Category | Base Priority | Notes |
| :--- | :---: | :--- |
| `quest_milestone` | 100 | Immune to non-quest anti-repeat swap at line 301 (still subject to `-120` score penalty). |
| `conflict_reconciliation` | 84 | Generalized pair tension/affinity topics. |
| `personal_story` | 76 | 4 multi-resident side storylines backed by `sideFlags`. |
| `event_reaction` | 68 | Town reactions to `bell_ring`, `repairedFountain`, `player_help`. |
| `relationship_tier` | 60 | Affinity-gated tier dialogue. |
| `emotion_reaction` | 54 | NPC runtime/stored emotion dialogue. |
| `npc_gossip` | 48 | Resident-specific warmth/gossip about another neighbor. |
| `weather_season` | 42 | Weather-conditioned chat. |
| `daily_slice` | 34 | Resident-specific everyday chatter (2 per resident). |

### 1.3 Parallel Cue & Status Consumers
- **`getResidentAvailableQuestCue(id, world)` (`narrative.ts:53–70`)**: Consumed by `NeighborhoodCanvas.tsx:1043` (overhead 3D cue indicator) and `JournalDrawer.tsx:239` (`"· Story waiting"` badge). Checks `world.flags` only—does **not** currently surface active `sideFlags` personal stories or conflict topics.
- **`computeEnvironmentState(flags)` (`narrative.ts:35–51`)**: Pure projection of `StoryFlags` driving planters (`0..3`), `fountainFlowing`, `ivyCleared`, `bellGleaming`, `festoonLanterns`, `bakeryTablesOpen`, `reconciledTogether`, and `noticeboardUpdated`.

---

## 2. Complete Inventory of Existing Dialogue Content

### 2.1 Concurrent Quest Milestone Choices (`buildConcurrentQuestChoices`, `narrative.ts:129–379`)
Injected at the front of `root.choices` on **any** selected topic for the target resident when prerequisites hold.

| Choice ID | Target Resident | Label | Tone | Conditions | Resulting Node (`isEnd`) | WorldState Mutations (`flags`, `trust`, `emotion`, `memoryId`, `other`) | Target Declarative Mapping | Migration Status / Coverage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `barnaby_ladder` | `barnaby` | Could I borrow your cedar ladder to clear the gazebo ivy? | `practical` | `heardBellMystery === true`, `borrowedBarnabyLadder === false` | `barnaby_lend` (`Pleased`) | `trust +1`, `isStoryMilestone: true`, `emotion: 'happy'`, `flags: { borrowedBarnabyLadder: true, clearedGazeboIvy: true }`, `mem_gazebo_cleared`, `worldEvents` (`story_flag`) | Preserve in `concurrentQuestChoices` (or shared milestone injector) | Preserve exact ID; covered by `engine.test.ts:87` |
| `barnaby_fountain` | `barnaby` | Do you know why the plaza stone fountain stopped running? | `curious` | `repairedFountain === false` | `barnaby_valve` (`Helpful`) | `trust +1`, `isStoryMilestone: true`, `emotion: 'happy'`, `flags: { repairedFountain: true }`, `mem_fountain_fixed`, `worldEvents` (`story_flag`) | Preserve in `concurrentQuestChoices` | Preserve exact ID; covered by `engine.test.ts:93` & `relationships.test.ts:51` |
| `mina_plant` | `mina` | Let’s plant moon-petals in the plaza window boxes! | `warm` | `plantedMoonPetals === false` | `mina_planted` (`Joyful`) | `trust +1`, `isStoryMilestone: true`, `emotion: 'excited'`, `flags: { plantedMoonPetals: true }`, `mem_moon_petals`, `worldEvents` (`story_flag`) | Preserve in `concurrentQuestChoices` | Preserve exact ID; covered by `engine.test.ts:105` |
| `sora_tea` | `sora` | Could you steep two cups of chamomile-pear tea for Arthur and Clara? | `warm` | `brewedChamomileTea === false` | `sora_brewed` (`Warm`) | `trust +1`, `isStoryMilestone: true`, `emotion: 'happy'`, `flags: { brewedChamomileTea: true }`, `mem_chamomile_tea`, `worldEvents` (`story_flag`) | Preserve in `concurrentQuestChoices` | Preserve exact ID; **add regression test** |
| `toby_clapper` | `toby` | Let’s rescue the brass clapper from the hollow oak together. | `practical` | `heardBellMystery === true`, `foundBrassClapper === false` | `toby_found` (`Proud`) | `trust +1`, `isStoryMilestone: true`, `emotion: 'happy'`, `flags: { foundBrassClapper: true }`, `mem_brass_clapper`, `worldEvents` (`story_flag`) | Preserve in `concurrentQuestChoices` | Preserve exact ID; partially checked in `relationships.test.ts:66` (add completion test) |
| `clara_bridge_baking` | `clara` | Invite Arthur to share warm sourdough by the fountain instead of apologizing. | `warm` | `!claraArthurReconciled && (deliveredPostcard || brewedChamomileTea || foundBrassClapper)` | `clara_agrees` (`Moved`) | `trust +1`, `isStoryMilestone: true`, `emotion: 'happy'`, `flags: { mediationStyle: 'shared_baking', claraArthurReconciled: true, lanternsLit: true }`, `mem_reconciliation_bread`, `reconcileClaraAndArthurRelation`, `worldEvents` (`story_flag`) | Preserve in `concurrentQuestChoices` | Preserve exact ID; **add regression test** |
| `clara_bridge_truth` | `clara` | Tell her Arthur never threw away the bell—he kept the clapper safe. | `gentle` | Same as above + `foundBrassClapper === true` | `clara_truth` (`Softened`) | `trust +1`, `isStoryMilestone: true`, `emotion: 'happy'`, `flags: { mediationStyle: 'gentle_truth', claraArthurReconciled: true, lanternsLit: true }`, `mem_reconciliation_truth`, `reconcileClaraAndArthurRelation`, `worldEvents` (`story_flag`) | Preserve in `concurrentQuestChoices` | Preserve exact ID; covered by `relationships.test.ts:108` |
| `arthur_restore_bell` *(COPY A — Active/Shadowing)* | `arthur` | The ivy is cleared and we found the brass clapper—let’s hang it! | `practical` | `!bellRestored && foundBrassClapper && clearedGazeboIvy` | `arthur_restores` (`Moved`) | `trust +2`, `isStoryMilestone: true`, `emotion: 'happy'`, `flags: { bellRestored: true, claraArthurReconciled: true, lanternsLit: true, mediationStyle: preserve or 'festival_ring' }`, `mem_bell_restored`, `reconcileClaraAndArthurRelation`, `worldEvents` (`story_flag`) | **Single authoritative definition** (keep here or in declarative topic—remove duplicate copy B) | **DUPLICATED**; covered by `engine.test.ts:112` |

---

### 2.2 All 42 Declarative Topics in `DIALOGUE_TOPICS` (`narrative.ts:381–1638`)

#### A. Main Quest Milestones (5 Topics)

| Topic ID (Lines) | Resident | Priority | Topic Condition | Nodes & Choices Summary | Choice Outcomes & WorldState Mutations | Target Declarative Destination | Status & Test Needs |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| `quest_pip_intro` (384–453) | `pip` | 50 | `flagsFalse: ['heardBellMystery']` | `root` (`Curious`) -> **`pip_promise`** (`warm`) -> `pip_excited` (`Eager`, end); **`pip_chalk`** (`curious`) -> `pip_drawing` (`Bright`, end) | Both: `trust +1`, `isStoryMilestone: true`, `flags: { heardBellMystery: true }`, `mem_bell_mystery` (differs in `summary` text between choices), `worldEvents` (`story_flag`). `pip_promise` sets `'excited'`; `pip_chalk` sets `'happy'`. | Keep as `quest_milestone` topic ID `quest_pip_intro` (preserve both distinct `mem_bell_mystery` summaries). | Preserve; `pip_promise` tested (`engine.test.ts:80`); **add test for `pip_chalk`** |
| `quest_nora_postcard` (456–558) | `nora` | 45 | `flagsFalse: ['foundPostcard']` | `root` (`Thoughtful`) -> **`nora_bell`** (`requiresFlag: 'heardBellMystery'`, `trust +1`) -> `nora_story` (`Reflective`) -> [**`nora_take_card`** -> `nora_given` (`Warm`, end), **`nora_read_together`** -> `nora_ribbon` (`Fond`, end)]; **`nora_books`** -> `nora_almanac` (`Amused`, end, `trust +1`) | `nora_bell`: smalltalk `+1` trust step into `nora_story`. `nora_take_card` & `nora_read_together`: both `trust +1`, `isStoryMilestone: true`, `flags: { foundPostcard: true }`, `mem_lost_postcard`, `worldEvents`. `nora_take_card` sets `'happy'`; `nora_read_together` sets `'relaxed'`. `nora_books`: `trust +1` (`nora_almanac`, leaves `foundPostcard: false`). | Keep as `quest_milestone` topic ID `quest_nora_postcard` with all 3 branches preserved. | Preserve; `nora_read_together` tested (`relationships.test.ts:74-82`); **add tests for `nora_take_card` & `nora_books` gating** |
| `quest_jun_postcard` (561–633) | `jun` | 48 | `flagsTrue: ['foundPostcard'], flagsFalse: ['deliveredPostcard']` | `root` (`Flustered`) -> **`jun_reassure`** -> `jun_relieved` (`Grateful`, end); **`jun_advice`** -> `jun_relieved`; **`jun_scold_blunt`** -> `jun_blunt_end` (`Bashful`, end) | `jun_reassure`: `trust +1`, `isStoryMilestone: true`, `'happy'`, `flags: { deliveredPostcard: true }`, **`mem_postcard_sent`**, `worldEvents`.<br>`jun_advice`: `trust +1`, `isStoryMilestone: true`, `'happy'`, `flags: { deliveredPostcard: true }` (**NOTE: omits `unlockMemory`**).<br>`jun_scold_blunt`: `isNegative: true`, `trustDelta: -1` (affinity `-8`, reliability `-5`, `negativeCount +1`), `'embarrassed'`. | Keep as `quest_milestone` topic ID `quest_jun_postcard`. **Audit flag**: document whether `jun_advice` keeps `unlockMemory` omitted or aligns with `mem_postcard_sent` (Phase 1 preserves existing behavior unless approved). | Preserve; `jun_scold_blunt` tested (`dialogue.test.ts:148`); **add tests for `jun_reassure` & `jun_advice`** |
| `quest_arthur_bell` (636–743) | `arthur` | 44 | `flagsFalse: ['bellRestored']` | `root` (`Guarded`) -> conditional **`arthur_postcard`** (if `deliveredPostcard`) -> `arthur_softens` (`Touched`, end); conditional **`arthur_tea`** (if `brewedChamomileTea`) -> `arthur_softens`; conditional **`arthur_restore_bell`** *(COPY B — shadowed!)* -> `arthur_restores`; **`arthur_smalltalk`** -> `arthur_craft` (`Thoughtful`, end) | `arthur_postcard`: `trust +1`, `'surprised'`.<br>`arthur_tea`: `trust +1`, `'relaxed'`.<br>`arthur_restore_bell`: same mutations as Copy A.<br>`arthur_smalltalk`: `trustDelta: prog.met ? 0 : 1`. | Keep as `quest_milestone` topic ID `quest_arthur_bell`. **Consolidate `arthur_restore_bell`** so only ONE single authoritative definition exists across `narrative.ts` (either solely via `buildConcurrentQuestChoices` or solely via declarative condition/injector). Convert inline `...(flag ? [...] : [])` choice spreads to declarative `requiresFlag` fields so `DialogueCondition`/`DialogueChoice` stays uniform. | **DUPLICATED** (`arthur_restore_bell`); **add tests for `arthur_postcard`, `arthur_tea`, `arthur_smalltalk`** |
| `quest_clara_rift` (746–808) | `clara` | 40 | `flagsFalse: ['claraArthurReconciled'], maxSeenCount: 2` | `root` (`Wistful`) -> **`clara_listen`** -> `clara_story` (`Reflective`, end); conditional **`clara_blunt_nudge`** (shown when `!canMediate`) -> `clara_stung` (`Guarded`, end) | `clara_listen`: `trust +1`, `'sad'`.<br>`clara_blunt_nudge`: `isNegative: true`, `trustDelta: -1`, `'frustrated'`. | Keep as `quest_milestone` topic ID `quest_clara_rift`; preserve `!canMediate` gating on `clara_blunt_nudge` via declarative condition. | Preserve; **add regression tests for `clara_listen`, `clara_blunt_nudge`, and `maxSeenCount: 2` cap** |

#### B. Generalized Conflict Mediation (2 Topics)

| Topic ID (Lines) | Resident | Priority | Topic Condition | Nodes & Choices Summary | Choice Outcomes & WorldState Mutations | Target Declarative Destination | Status & Test Needs |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| `conflict_arthur_clara_tension` (811–854) | `arthur` | 12 | `minNpcTension: { a: 'arthur', b: 'clara', min: 35 }, flagsFalse: ['claraArthurReconciled'], notSeenToday: true` | `root` (`Quiet`) -> **`arthur_ease_pride`** -> `ease_end` (`Relieved`); **`arthur_brush_off`** -> `stiff_end` (`Withdrawn`) | `arthur_ease_pride`: `trust +1`, `reliability +6`, `'relaxed'`, `adjustNpcTension: { a: 'arthur', b: 'clara', deltaAffinity: +10, deltaTension: -15, tag: 'kind_bridge' }`.<br>`arthur_brush_off`: `isNegative: true`, `trust -1`, `'frustrated'`, `adjustNpcTension: { deltaAffinity: -4, deltaTension: +6 }`. | Keep ID; stays `conflict_reconciliation` (Phase 4 expands into interconnected conflict storyline without dropping ID/effects). | `arthur_ease_pride` tested (`dialogue.test.ts:169`); **add test for `arthur_brush_off`** |
| `conflict_barnaby_arthur_rafters` (856–899) | `barnaby` | 6 | `flagsTrue: ['borrowedBarnabyLadder'], flagsFalse: ['bellRestored'], maxNpcAffinity: { a: 'arthur', b: 'barnaby', max: 62 }, notSeenToday: true` | `root` (`Gruff`) -> **`barnaby_bridge_craft`** -> `craft_warm_end` (`Charmed`); **`barnaby_stew_blunt`** -> `craft_blunt_end` (`Brusque`) | `barnaby_bridge_craft`: `trust +1`, `reliability +6`, `'relaxed'`, `adjustNpcTension: { a: 'arthur', b: 'barnaby', deltaAffinity: +12, deltaTension: -8, tag: 'shared_craft' }`.<br>`barnaby_stew_blunt`: `isNegative: true`, `trust -1`, `'frustrated'`, `adjustNpcTension: { deltaAffinity: -4, deltaTension: +7 }`. | Keep ID; stays `conflict_reconciliation`. | `barnaby_bridge_craft` tested (`dialogue.test.ts:240`); **add test for `barnaby_stew_blunt`** |

#### C. Personal Side Storylines (8 Topics across 4 Arcs)

| Topic ID (Lines) | Resident | Priority | Topic Condition | Choice ID -> End Node | WorldState Mutations (`sideFlags`, `trust`, `reliability`, `memoryId`) | Target Declarative Destination | Status & Test Needs |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| `side_pip_zine_1` (903–933) | `pip` | 15 | `sideFlagsFalse: ['pipZineStarted'], minTrust: 1, notSeenToday: true` | `pip_zine_start_choice` -> `end_yes` (`Beaming`) | `trust +1`, `reliability +8`, `isStoryMilestone: true`, `'excited'`, `sideFlags: { pipZineStarted: true }`, `worldEvents` | Preserve ID in Phase 1; Phase 4 adds multi-stage `storylines` sync while keeping `sideFlags.pipZineStarted`. | Tested (`dialogue.test.ts:105`) |
| `side_nora_zine_2` (934–970) | `nora` | 18 | `sideFlagsTrue: ['pipZineStarted'], sideFlagsFalse: ['pipZinePrinted'], notSeenToday: true` | `nora_print_zine` -> `end_print` (`Proud`) | `trust +1`, `reliability +10`, `isStoryMilestone: true`, `'happy'`, `sideFlags: { pipZinePrinted: true }`, **`mem_side_chalk_zine`**, `worldEvents` | Preserve ID & `mem_side_chalk_zine`. | Tested (`dialogue.test.ts:107`) |
| `side_mina_herbloaf_1` (973–1003) | `mina` | 14 | `sideFlagsFalse: ['herbLoafStarted'], minTrust: 1, notSeenToday: true` | `mina_herb_pass` -> `end_herb` (`Grateful`) | `trust +1`, `reliability +6`, `isStoryMilestone: true`, `'happy'`, `sideFlags: { herbLoafStarted: true }`, `worldEvents` | Preserve ID & `sideFlags.herbLoafStarted`. | Tested (`dialogue.test.ts:111`) |
| `side_clara_herbloaf_2` (1004–1040) | `clara` | 17 | `sideFlagsTrue: ['herbLoafStarted'], sideFlagsFalse: ['herbLoafShared'], notSeenToday: true` | `clara_share_herb_loaf` -> `end_share` (`Delighted`) | `trust +1`, `reliability +10`, `isStoryMilestone: true`, `'happy'`, `sideFlags: { herbLoafShared: true }`, **`mem_side_herb_loaf`**, `worldEvents` | Preserve ID & `mem_side_herb_loaf`. | Tested (`dialogue.test.ts:113`) |
| `side_sora_stand_1` (1043–1073) | `sora` | 14 | `sideFlagsFalse: ['pondStandStarted'], minTrust: 1, notSeenToday: true` | `sora_ask_barnaby` -> `end_stand1` (`Hopeful`) | `trust +1`, `reliability +7`, `isStoryMilestone: true`, `'happy'`, `sideFlags: { pondStandStarted: true }`, `worldEvents` | Preserve ID & `sideFlags.pondStandStarted`. | Tested (`dialogue.test.ts:117`) |
| `side_barnaby_stand_2` (1074–1110) | `barnaby` | 17 | `sideFlagsTrue: ['pondStandStarted'], sideFlagsFalse: ['pondStandBuilt'], notSeenToday: true` | `barnaby_carve_stand` -> `end_stand2` (`Proud`) | `trust +1`, `reliability +10`, `isStoryMilestone: true`, `'happy'`, `sideFlags: { pondStandBuilt: true }`, **`mem_side_music_stand`**, `worldEvents` | Preserve ID & `mem_side_music_stand`. | Tested (`dialogue.test.ts:119`) |
| `side_jun_watch_1` (1113–1143) | `jun` | 13 | `sideFlagsFalse: ['watchTuneStarted'], flagsTrue: ['deliveredPostcard'], notSeenToday: true` | `jun_watch_arthur` -> `end_w1` (`Relieved`) | `trust +1`, `reliability +6`, `isStoryMilestone: true`, `'happy'`, `sideFlags: { watchTuneStarted: true }`, `worldEvents` | Preserve ID & `sideFlags.watchTuneStarted`. | Tested (`dialogue.test.ts:123`) |
| `side_arthur_watch_2` (1144–1180) | `arthur` | 16 | `sideFlagsTrue: ['watchTuneStarted'], sideFlagsFalse: ['watchTuneFinished'], notSeenToday: true` | `arthur_fix_watch` -> `end_w2` (`Warm`) | `trust +1`, `reliability +10`, `isStoryMilestone: true`, `'happy'`, `sideFlags: { watchTuneFinished: true }`, **`mem_side_jun_watch`**, `worldEvents` | Preserve ID & `mem_side_jun_watch`. | Tested (`dialogue.test.ts:125`) |

#### D. Event, Gossip, Tier, Emotion & Weather Topics (9 Topics)

| Topic ID (Lines) | Resident | Category | Priority | Condition | Choice IDs & Outcomes | Migration Audit Notes |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| `event_bell_celebration` (1183–1210) | `any` | `event_reaction` | 10 | `requiresRecentEventKind: { kind: 'bell_ring', maxDaysAgo: 2 }, notSeenToday: true` | `ev_bell_warm` -> `ev_bell_end` (`trust +1`, `'happy'`) | Uses `traits.temperament === 'spirited'` interpolation. Global `topicHistory` blocks other residents same day (**see Section 4**). Phase 3 scopes to `npcMemories`. |
| `event_fountain_repair` (1212–1239) | `any` | `event_reaction` | 8 | `flagsTrue: ['repairedFountain'], notSeenToday: true, maxSeenCount: 1` | `ev_fountain_cheer` -> `ev_fountain_end` (`trust +1`, `'happy'`) | **Global `maxSeenCount: 1` conflict**: after 1 talk with *any* resident, `topicHistory` blocks all other residents forever. |
| `event_gift_thanks` (1241–1269) | `any` | `event_reaction` | 9 | `requiresRecentEventKind: { kind: 'player_help', maxDaysAgo: 1 }, notSeenToday: true` | `ev_help_reply` -> `ev_help_end` (`trust +1`, `reliability +4`, `'happy'`) | Tested (`dialogue.test.ts:199`). Omniscient across all residents today; Phase 3 narrows via `npcMemories`/gossip. |
| `gossip_clara_mina_loaves` (1271–1298) | `clara` | `npc_gossip` | 5 | `minNpcAffinity: { a: 'clara', b: 'mina', min: 55 }, notSeenToday: true` | `gossip_cm_warm` -> `gossip_cm_end` (`trust +1`, `'happy'`) | Keep ID; **add unit test**. |
| `gossip_pip_toby_pond` (1300–1327) | `toby` | `npc_gossip` | 5 | `minNpcAffinity: { a: 'pip', b: 'toby', min: 45 }, notSeenToday: true` | `gossip_pt_curious` -> `gossip_pt_end` (`trust +1`, `'happy'`) | Keep ID; **add unit test**. |
| `tier_close_kindred_bond` (1330–1358) | `any` | `relationship_tier` | 8 | `minAffinity: 60, notSeenToday: true` | `tier_close_warm` -> `tier_close_end` (`trust +1`, `reliability +4`, `'happy'`) | Uses `id === 'arthur' ? 'neighbor' : 'friend'`. Note global `notSeenToday` blocks second close friend on same day. **Add unit test**. |
| `emotion_tired_check` (1360–1400) | `any` | `emotion_reaction` | 6 | `emotions: ['tired'], notSeenToday: true` | `em_tired_kind` (`trust +1`, `'relaxed'`) vs `em_tired_blunt` (`isNegative: true`, `trust -1`, `'frustrated'`) | **Add unit test for both positive & blunt outcomes**. |
| `weather_rain_reflection` (1403–1432) | `any` | `weather_season` | 7 | `weathers: ['light_rain'], notSeenToday: true` | `rain_cozy_yes` -> `rain_yes_end` (`trust +1`, `'relaxed'`) | Branches prose on `traits.rainBehavior === 'umbrella_stroll'`. **Add unit test**. |
| `weather_misty_breezy_note` (1434–1463) | `any` | `weather_season` | 4 | `weathers: ['misty_morning', 'breezy'], notSeenToday: true` | `weather_mb_reply` -> `weather_mb_end` (`trust +1`, `'curious'`) | Branches prose on `misty_morning` vs `breezy`. **Add unit test**. |

#### E. Resident Daily Slice Pool (18 Topics — 2 per Resident, Lines 1465–1638)

| Topic ID (Lines) | Resident | Priority | Condition | Choices (`choice.id` -> `endId`) | Special Effects & Audit Notes |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `daily_clara_crust` (1467–1474) | `clara` | 2 | `{}` | `clara_d1` -> `d1_e` | `trust +1`, `'happy'` |
| `daily_clara_tables` (1475–1484) | `clara` | 2 | `{}` | `clara_hug` -> `d2_e` | Dynamic prose on `flags.claraArthurReconciled`; `trust +1`, `'happy'` |
| `daily_arthur_springs` (1487–1494) | `arthur` | 2 | `{}` | `arthur_d1` -> `a1_e` | `trust +1`, `'relaxed'` |
| `daily_arthur_peace` (1495–1502) | `arthur` | 3 | `{ flagsTrue: ['bellRestored'] }` | `arthur_ring_note` -> `a2_e` | `trust +1`, `'happy'` (unlocked post-restoration) |
| `daily_mina_soil` (1505–1512) | `mina` | 2 | `{}` | `mina_d1` -> `m1_e` | `trust +1`, `'curious'` |
| `daily_mina_chamomile` (1513–1520) | `mina` | 2 | `{}` | `mina_tea` -> `m2_e` | `trust +1`, `'happy'` |
| `daily_jun_route` (1523–1534) | `jun` | 2 | `{}` | `jun_gossip` -> `j1_e`; **`jun_lanterns`** -> `j2_e` | `jun_lanterns` sets **`flags: { lanternsLit: true }`**, `isStoryMilestone: true`, `trust +1`! Must preserve (`env.festoonLanterns` reactivity). |
| `daily_jun_stamps` (1535–1542) | `jun` | 2 | `{}` | `jun_d2` -> `j3_e` | `trust +1`, `'happy'` |
| `daily_barnaby_craft` (1545–1552) | `barnaby` | 2 | `{}` | **`barnaby_craft`** -> `b1_e` | `trust +1`, `'happy'`. Tested in `relationships.test.ts:37`. |
| `daily_barnaby_benches` (1553–1561) | `barnaby` | 2 | `{}` | `barnaby_d2` -> `b2_e`; **`barnaby_craft`** -> `b2_e` | **DUPLICATE CHOICE ID** (`barnaby_craft` reused verbatim from `daily_barnaby_craft`, pointing to `b2_e` while repeating cottage-porch label on bench topic!). Keep `barnaby_craft` on `daily_barnaby_craft` and differentiate or alias safely. |
| `daily_sora_chord` (1564–1571) | `sora` | 2 | `{}` | `sora_song` -> `s1_e` | `trust +1`, `'relaxed'` |
| `daily_sora_tea` (1572–1579) | `sora` | 2 | `{}` | `sora_d2` -> `s2_e` | `trust +1`, `'curious'` |
| `daily_toby_sketch` (1582–1589) | `toby` | 2 | `{}` | `toby_sketch` -> `t1_e` | `trust +1`, `'happy'` |
| `daily_toby_charcoal` (1590–1597) | `toby` | 2 | `{}` | `toby_d2` -> `t2_e` | `trust +1`, `'excited'` |
| `daily_nora_lanterns` (1600–1609) | `nora` | 2 | `{ flagsTrue: ['foundPostcard'] }` | `nora_tea_chat` -> `n1_e` | Dynamic prose on `claraArthurReconciled`; `trust +1`, `'relaxed'` |
| `daily_nora_margins` (1610–1617) | `nora` | 2 | `{}` | `nora_d2` -> `n2_e` | `trust +1`, `'happy'` |
| `daily_pip_carp` (1620–1629) | `pip` | 2 | `{ flagsTrue: ['heardBellMystery'] }` | `pip_skip` -> `p1_e` | Dynamic prose on `bellRestored`; `trust +1`, `'excited'` |
| `daily_pip_cinnamon` (1630–1637) | `pip` | 2 | `{ flagsTrue: ['heardBellMystery'] }` | `pip_d2` -> `p2_e` | `trust +1`, `'happy'` |

---

### 2.3 Engine-Injected Dynamic Dialogue (`dialogueEngine.ts`)

| Mechanism (Lines) | Trigger Condition | Generated IDs & Text | Effects | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Dynamic Gift Choice** (`buildDynamicGiftChoice`, 219–253) | `world.playerHeldItem` exists in `world.worldProps` | Choice `deliver_${heldId}_to_${id}` (`warm`), End node `gift_delivered_end`; plus root prefix `"Oh—is that ${prop.label} you’re carrying? "` on non-quest topics when `prop.likedBy.includes(id)`. | Transfers `worldProps[heldId].holder = id`, clears `playerHeldItem`, `trustDelta: likesIt ? 1 : 0`, `reliabilityDelta: likesIt ? 10 : 5`, `setEmotion: likesIt ? 'excited' : 'happy'`, `giftsGiven +1`, pushes `worldEvents` (`kind: 'player_help'`). | Covered in `dialogue.test.ts:178-200`. Also note direct path `deliverHeldItemAction()` in `actions.ts:360-411` creates synthetic `gift_${heldId}_${residentId}` (pushes duplicate `help_` event if `applyDialogueChoice` already pushed `story_` event). |
| **Heartfelt Amends Injection** (`selectDialogueSession`, 379–403) | `rel && rel.negativeCount > 0 && (rel.reliability < 40 || emotion in ['frustrated','embarrassed','angry']) && category !== 'quest_milestone'` | Choice `make_amends_${residentId}` (`gentle`), End node `amends_end`. | `trustDelta: 0`, `reliabilityDelta: +9`, `setEmotion: 'relaxed'`. | Covered in `dialogue.test.ts:202-227`. |
| **Fallback Dialogue** (`selectDialogueSession`, 307–345) | No topic matches `evaluateDialogueCondition()` | Session `topicId: '${residentId}_fallback'`, Choice `${residentId}_kind_check_in`, End node `fallback_end`. Root prose combines `resolveGreetingPrefix()` + `resolveContextFlavorRemark()` (sitting seat remark OR today's `npc_social` partner remark). | `trustDelta: +1`, `setEmotion: 'happy'`. | Note: `resolveContextFlavorRemark()` only runs on fallback sessions (never reached once a resident has `daily_slice` topics matching `{}`!). That means sitting-on-bench or recent-social partner remarks in `resolveContextFlavorRemark()` are **currently unreachable** for all 9 residents! |

---

### 2.4 Non-Topic Dialogue / Narrative Text & Ambient Speech

| System / File | Function / Lines | Triggers & Content | Memories / Flags / Effects |
| :--- | :--- | :--- | :--- |
| **Prop Interactions** (`actions.ts:450–692`) | `interactWithProp()`, `performFountainWishAction()`, `performPondStoneSkipAction()`, `getDailyMailboxLetter()` | 7 props (`player_mailbox`, `player_door`, `gazebo_bell`, `fountain_plaza`, `mirror_pond`, `hollow_oak`, `plaza_noticeboard`). Mailbox has 3 letters (`bellRestored`, `heardBellMystery && day >= 2`, welcome). `hollow_oak` sets `foundBrassClapper: true` if `heardBellMystery`. `gazebo_bell` pushes `bell_ring` event (`actors: ['clara','arthur','pip']`). | `mem_fountain_wish` (`fountainWishesCount`), `mem_pond_skip` (`pondPebblesSkipped`), `dailyLettersRead`, `bellRungCount`. *(Note: `hollow_oak` does NOT unlock `mem_brass_clapper`; `App.tsx:288` handles `ring_bell` action separately from `interactWithProp`).* |
| **Autonomous Bubbles & Encounters** (`simulation.ts:87–98, 423–444, 754–898`) | `getGreetingBubbleText()`, `buildSocialTopic()` | Proximity bubbles (`pDist < greetDist`, 65m cooldown) varied by `emotion`, `affinity >= 60`, and `traits.temperament`. Pair encounter topics (`reconciled_chat`, `helped_chore`, `evening_almanac`, `pond_stories`, `bell_chimes`, `neighbor_chat`). | Updates `activeBubbleText`, `activeEncounters`, `npcRelations` (`+3/+4` affinity, `-2` tension), `worldEvents` (`npc_social`). |

---

## 3. Complete Memory ID, Topic History & Flag Dependency Registry

### 3.1 Canonical `JournalMemory` IDs (14 Total)
1. `mem_arrival` — Starter memory (`migrations.ts:140`, Day 1 morning).
2. `mem_bell_mystery` — `pip_promise` **or** `pip_chalk` (`quest_pip_intro`).
3. `mem_lost_postcard` — `nora_take_card` **or** `nora_read_together` (`quest_nora_postcard`).
4. `mem_postcard_sent` — `jun_reassure` only (`quest_jun_postcard`).
5. `mem_gazebo_cleared` — `barnaby_ladder` (concurrent).
6. `mem_fountain_fixed` — `barnaby_fountain` (concurrent).
7. `mem_moon_petals` — `mina_plant` (concurrent).
8. `mem_chamomile_tea` — `sora_tea` (concurrent).
9. `mem_brass_clapper` — `toby_clapper` (concurrent; **not** unlocked by `hollow_oak` direct pickup).
10. `mem_reconciliation_bread` — `clara_bridge_baking` (concurrent).
11. `mem_reconciliation_truth` — `clara_bridge_truth` (concurrent).
12. `mem_bell_restored` — `arthur_restore_bell` (concurrent & `quest_arthur_bell`).
13. `mem_side_chalk_zine` — `nora_print_zine` (`side_nora_zine_2`).
14. `mem_side_herb_loaf` — `clara_share_herb_loaf` (`side_clara_herbloaf_2`).
15. `mem_side_music_stand` — `barnaby_carve_stand` (`side_barnaby_stand_2`).
16. `mem_side_jun_watch` — `arthur_fix_watch` (`side_arthur_watch_2`).
17. `mem_fountain_wish` — `performFountainWishAction()` (`actions.ts:618`).
18. `mem_pond_skip` — `performPondStoneSkipAction()` (`actions.ts:660`).

*(Verified count: 18 unique `JournalMemory` IDs across the entire codebase, matching lines found via grep.)*

### 3.2 `sideFlags` Key Registry (`Record<string, boolean | number | string>`)
- **Side Storyline Booleans (8)**: `pipZineStarted`, `pipZinePrinted`, `herbLoafStarted`, `herbLoafShared`, `pondStandStarted`, `pondStandBuilt`, `watchTuneStarted`, `watchTuneFinished`.
- **Prop Interaction Counters (2)**: `fountainWishesCount`, `pondPebblesSkipped`.
- **Hardcoded React Coupling (`JournalDrawer.tsx:35–107`)**: Both `storyThreads` (5 items) and `personalThreads` (4 items) are currently duplicated directly inside React JSX rather than projected from `src/game/`.

### 3.3 `topicHistory` & Anti-Repeat Mechanisms
- **`world.lastTopicByResident[residentId]`**: Records `session.topicId` in `applyDialogueChoice()` (`actions.ts:182`). Penalized `-120` in `selectDialogueSession()` (`dialogueEngine.ts:288-290`) and bypassed via runner-up selection for non-quest topics (`lines 298-305`).
- **`world.topicHistory[topicId]`**: Tracks `{ seenCount, lastSeenDay, lastSeenPhase, chosenChoiceIds }`.
  - Used by `notSeenToday`, `minDaysSinceSeen`, `maxSeenCount`, and soft recency penalties (`-28` same day, `-min(20, seenCount * 5)` prior days).
  - **Scope Defect**: Keyed globally by `topicId` only, causing `residentId: 'any'` topics to share cooldowns/max-seen counts across all 9 residents.

---

## 4. Duplicated, Obsolete, Unreachable & Conflicting Definitions

| Issue ID | Type | Location | Description | Recommended Phase 1 Resolution |
| :--- | :--- | :--- | :--- | :--- |
| **DUP-01** | **Exact Duplication** | `narrative.ts:346–375` (`buildConcurrentQuestChoices`) vs `narrative.ts:682–730` (`quest_arthur_bell`) | `arthur_restore_bell` + `arthur_restores` defined identically in both places. Concurrent copy unshifts first and suppresses the topic copy via `existingIds`. | Keep **one single authoritative builder/definition** (in `buildConcurrentQuestChoices` or shared helper) and remove the duplicate copy inside `quest_arthur_bell` while keeping `arthur_restore_bell` available in `quest_arthur_bell` sessions. |
| **DUP-02** | **Duplicate Choice ID** | `narrative.ts:1549` (`daily_barnaby_craft`) vs `narrative.ts:1558` (`daily_barnaby_benches`) | Choice ID `barnaby_craft` appears in both Barnaby daily topics with identical label (`Tell me about building the cottage porches here.`), pointing to `b1_e` vs `b2_e`. | Keep `barnaby_craft` on `daily_barnaby_craft` (preserving `relationships.test.ts:37`); keep `daily_barnaby_benches` distinct with `barnaby_d2` (or unique secondary choice ID if needed, preserving exact prose `b2_e`). |
| **UNR-01** | **Unreachable Code** | `dialogueEngine.ts:201–217, 307–345` (`resolveContextFlavorRemark`) | Only invoked inside the fallback branch when `matching.length === 0`. Since every resident has 2 unconditional `{}` `daily_slice` topics, fallback **never runs**—so sitting-seat remarks and same-day social-partner whispers never appear in dialogue! | Expose `resolveContextFlavorRemark()` cleanly inside `selectDialogueSession()` on ambient non-milestone topics (or phase out global `worldEvents` lookup in favor of Phase 3 personal memories while preserving seat-context flavor). |
| **CON-01** | **Global `topicHistory` Collision** | `dialogueEngine.ts:149–156, 283–287`, `actions.ts:171–183`, `narrative.ts:1188, 1217, 1246, 1335, 1365, 1408, 1439` | `'any'` topics (`event_fountain_repair` with `maxSeenCount: 1`, `event_bell_celebration`, `tier_close_kindred_bond`, etc.) record `topicHistory[topicId]` globally rather than per-resident (`${residentId}:${topicId}` or combined), starving other residents. | Support per-resident `topicHistory` lookup/migration cleanly in Phase 1 (checking `topicHistory[`${residentId}:${topicId}`] ?? topicHistory[topicId]` for backward compatibility with existing saves) so each neighbor gets their own memory/cooldown of `'any'` topics. |
| **SIG-01** | **Fragmented Availability Signature** | `dialogueEngine.ts:36–48`, `DialogueSheet.tsx:114`, `actions.ts:46` | `isChoiceAvailable(choice, flags, trust, sideFlags)` cannot inspect `playerRelations.affinity`, `npcMemories`, `storylines`, or posture. | Extend `isChoiceAvailable(choice, worldOrFlags, trustOrResidentId?, sideFlags?)` with an overload/backward-compatible signature supporting both legacy `(choice, flags, trust, sideFlags)` callers/tests and full `(choice, world, residentId)` evaluation. |
| **ASYM-01** | **Asymmetric Memory Unlock (Documented Preservation)** | `narrative.ts:593–601` (`jun_advice`) vs `577–591` (`jun_reassure`); `actions.ts:572–580` (`hollow_oak`) vs `narrative.ts:258–274` (`toby_clapper`) | `jun_advice` sets `deliveredPostcard: true` without unlocking `mem_postcard_sent`; `hollow_oak` sets `foundBrassClapper: true` without unlocking `mem_brass_clapper`. | Document explicitly; preserve `hollow_oak` behavior and decide cleanly whether `jun_advice` keeps parity or unlocks `mem_postcard_sent` without altering `deliveredPostcard` behavior. |
| **HARD-01** | **React Thread Hardcoding** | `JournalDrawer.tsx:35–107` | Hardcodes `storyThreads` and `personalThreads` strings inside JSX instead of projecting from `src/game/`. | Deferred to Phases 4–5 (must remain synced during Phase 1). |

---

## 5. Migration Completeness Checklist (Phase 1 Gate)

Before Phase 1 is signed off, every item below must be checked:

- [x] **All 42 `DIALOGUE_TOPICS`** preserved with exact `id`, `residentId`, `category`, prose, choices, end nodes, and WorldState mutations.
- [x] **All 8 `buildConcurrentQuestChoices` entries** preserved with exact choice IDs (`barnaby_ladder`, `barnaby_fountain`, `mina_plant`, `sora_tea`, `toby_clapper`, `clara_bridge_baking`, `clara_bridge_truth`, `arthur_restore_bell`).
- [x] **DUP-01 (`arthur_restore_bell`) resolved**: Single authoritative definition in `CONCURRENT_QUEST_MILESTONES` with zero silent divergence and identical player-facing options when `foundBrassClapper && clearedGazeboIvy && !bellRestored`.
- [x] **DUP-02 (`barnaby_craft`) handled intentionally**: Preserved across `daily_barnaby_craft` and `daily_barnaby_benches` (annotated inline) so `relationships.test.ts` anti-repeat rotation passes unchanged, with zero duplicate choice IDs inside any built session.
- [x] **`DialogueCondition` extended cleanly**: Supports `minTier`, `maxTier`, `requiresNpcMemoriesAny` *(Phase 3 hook)*, `excludesNpcMemories` *(Phase 3 hook)*, `requiresStoryline` *(Phase 4 hook)*, `requiresPosture`, `requiresWeatherNot`, plus choice-level `minAffinity` / `minTier` / `requiresCondition`.
- [x] **`isChoiceAvailable()` unified**: Accepts `(choice, world, residentId)` in `DialogueSheet.tsx` and `actions.ts` while remaining 100% backward-compatible with legacy `(choice, flags, trust, sideFlags)` signatures (verified by `engine.test.ts:88` and `dialogue.test.ts`).
- [x] **Per-resident `topicHistory` scoping for `'any'` topics**: Prevents talking to Resident A from exhausting `event_fountain_repair` (`maxSeenCount: 1`) or `tier_close_kindred_bond` for Resident B, while reading legacy global `topicHistory[topicId]` gracefully.
- [x] **UNR-01 context remark preservation**: Sitting-on-bench remark and actor-local same-day `npc_social` partner whisper surfaced cleanly on `daily_slice` topics (global `worldEvents` omniscience scoped to participating actors).
- [x] **All 18 `JournalMemory` IDs** preserved unchanged; `sideFlags`, `StoryFlags`, `make_amends_<id>`, and `deliver_<item>_to_<id>` intact.
- [x] **No hardcoded 9-resident count assumptions** anywhere in `dialogueEngine.ts` or `narrative.ts`.

---

## 6. Phase 1 Regression-Test Requirements (`src/game/dialogue.test.ts` & `engine.test.ts`)

1. **Structural Integrity (All Topics & Concurrent Choices)**:
   - Every topic in `DIALOGUE_TOPICS` has valid `rootId` and every `choice.nextNodeId` resolves to an existing node.
   - Zero duplicate choice IDs within any resident's built dialogue session (`arthur` with `ready === true`, `barnaby` across both daily topics, etc.).
   - Across all residents (`RESIDENT_ORDER`) and all 4 `TimePhase`s, `buildResidentDialogue()` produces zero broken `nextNodeId` links both in fresh state and mid/late-story states.
2. **All Main Quest Milestones & Alternate Branches**:
   - `quest_pip_intro`: both `pip_promise` and `pip_chalk` set `heardBellMystery: true` and unlock `mem_bell_mystery` with their distinct summaries.
   - `quest_nora_postcard`: `nora_books` leaves `foundPostcard: false`; `nora_bell -> nora_take_card` and `nora_bell -> nora_read_together` both set `foundPostcard: true` and unlock `mem_lost_postcard`.
   - `quest_jun_postcard`: `jun_reassure`, `jun_advice`, and `jun_scold_blunt` outcomes verified (`deliveredPostcard`, `mem_postcard_sent`, negative penalty).
   - `quest_arthur_bell` + concurrent milestones: `arthur_postcard`, `arthur_tea`, `arthur_smalltalk`, `arthur_restore_bell` (single unique choice, sets `bellRestored: true`, `claraArthurReconciled: true`, `lanternsLit: true`, `mem_bell_restored`, preserves existing `mediationStyle` or defaults to `'festival_ring'`).
   - Concurrent milestones: `barnaby_ladder`, `barnaby_fountain`, `mina_plant`, `sora_tea`, `toby_clapper`, `clara_bridge_baking`, `clara_bridge_truth`.
   - `quest_clara_rift`: `clara_listen`, `clara_blunt_nudge` hidden once mediation prerequisites exist, and topic stops surfacing after `seenCount >= 2`.
3. **Conflict Mediation, Side Storylines & Ambient Topics**:
   - `conflict_arthur_clara_tension` (`arthur_ease_pride` AND `arthur_brush_off`) and `conflict_barnaby_arthur_rafters` (`barnaby_bridge_craft` AND `barnaby_stew_blunt`).
   - All 4 personal side stories (`side_pip_zine_*`, `side_mina_herbloaf_*`, `side_sora_stand_*`, `side_jun_watch_*`) + 4 memory IDs.
   - `gossip_clara_mina_loaves`, `gossip_pip_toby_pond`, `tier_close_kindred_bond`, `emotion_tired_check` (both kind & blunt), `weather_rain_reflection`, `weather_misty_breezy_note`, `daily_jun_route` (`jun_lanterns` sets `lanternsLit: true`).
4. **Engine Guarantees**:
   - `'any'` topic with `maxSeenCount: 1` (`event_fountain_repair`) or `notSeenToday: true` (`tier_close_kindred_bond`) tracked per resident so one neighbor seeing it does not lock out another eligible neighbor.
   - `isChoiceAvailable()` works cleanly for both legacy `(choice, flags, trust, sideFlags)` and new `(choice, world, residentId)` calls, including `minTier` / `minAffinity` choice checks.
   - `make_amends_<id>`, held-item gift delivery (`deliver_<item>_to_<id>`), and anti-repeat rotation remain unbroken.
