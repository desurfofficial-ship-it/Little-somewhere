> **STATUS: OBSOLETE** — this audit targeted the original 94-line prototype `GAME_DESIGN.md`. The revision landed; the current `GAME_DESIGN.md` is the 347-line, 12-section authoritative baseline. Preserved here as the historical record of the pre-revision GDD audit. Do not read as current; see `/GAME_DESIGN.md` and `docs/MASTER-ROADMAP.md` for the as-built product state.

# GAME_DESIGN_AUDIT.md — LITTLE SOMEWHERE GDD Audit & Consistency Matrix

**Audit Phase**: Phase 1 — Expanded Audit & Revision Planning (No Code or `/GAME_DESIGN.md` Edits)  
**Target Document Audited**: `/GAME_DESIGN.md` (94 lines, Milestone 1 prototype baseline + 1-line Milestone 3 Orchard note)  
**Evidence Base**: Cross-referenced across `/src/game/*`, `/src/scene/*`, `/src/components/*`, `/docs/art-direction/*`, `/docs/milestones/*`, `/docs/audits/*`, `/ARCHITECTURE.md`, `/HANDOVER.md`, `/WORKLOG.md`, `/CHANGELOG.md`, and `/README.md`.

---

## 1. Status Classification Key (Strict Evidence Standard)

Every feature, mechanic, and direction in this audit is classified under one of five strict statuses so existing code, active milestones, unapproved blueprints, and future vision are never conflated:

- **`IMPLEMENTED`**: Verified live and functional in `/src/` today.
- **`IN PROGRESS`**: Partially built or spans completed earlier phases and pending later phases (e.g., Milestone 2B overall; Fern Hollow Orchard visual/nav slice).
- **`PLANNED`**: Explicitly targeted in project roadmaps or established near/mid-term product plans (`09-milestone-2b-audit-and-design.md`, `HANDOVER.md`, `08-milestone-2b-readiness.md`, or confirmed expanded gameplay pillars), **not yet built**.
- **`LONG-TERM VISION`**: Broad horizon systems & world expansion goals requiring substantial future architecture (multi-region world, seasonal festivals, optional cloud saves, pets, large-scale community life).
- **`UNDECIDED / REQUIRES DESIGN DECISION`**: Unestablished product rules, previously floated unapproved sketches (e.g., Audit 04 `cottagePlanterChoice` / `placedSouvenirs`), or open reward/progression mechanics needing explicit user direction before specification.

---

## 2. Existing Document Assessment (`/GAME_DESIGN.md`)

`/GAME_DESIGN.md` currently functions as a **94-line Milestone 1 showcase brief** rather than an authoritative Game Design Document.

### Strengths of the Current Document
- Captures the creative heart clearly: *"A little world filled with thousands of little stories."*
- Establishes an anti-grind, calm ethos (*"no grinding resource meters or rushing timers; observing daily routines, listening closely, noticing small clues, and gently mending relationships"*).
- Accurately outlines the multi-route structure of *The Silent Gazebo Bell* and the core 8 `StoryFlags` visual transformations.
- Summarizes the 9 anchor residents and 11 neighborhood locations (with a late single-line addition for Fern Hollow Orchard).

### Critical Structural & Vision Gaps
1. **Silent on Implemented Simulation & Social Depth**: Omits nearly all systems shipped in Milestone 2A and Milestone 2B Phases 1–2 (traits, needs, emotions, autonomous social encounters, bilateral `player <-> NPC` and `NPC <-> NPC` relationships, declarative dialogue, third-party gossip, bench sitting, carryable gifting, water micro-interactions, dynamic weather, 10-day seasons, reactive NPC micro-props, and audio).
2. **Completely Missing Reward, Progression & Retention Design**: Beyond unlocking memories, raising 0–5 hearts, and restoring the gazebo bell, the GDD offers **no reward loop, no inventory/collectible model, no unlock structure, no community project cadence, and no long-term reason to keep returning** across relaxed sessions.
3. **Completely Missing Planned Everyday Cozy Activities**: Gardening, fishing, cooking & sharing meals, decorating, photography, the Sunday Market, enterable cottage interiors, pets, and optional cloud saves are entirely absent.
4. **No Session-Pacing & Anti-Punishment Articulation**: While the game is safe against offline decay by design, `/GAME_DESIGN.md` never formalizes the **5–15 minute curiosity-driven play session philosophy** or the strict ban on streak penalties, stressful energy depletion, and FOMO clocks.
5. **Art & Spec Drift**: §2 duplicates raw shader roughnesses and stale lighting hex values that already drifted from `docs/art-direction/VISUAL_IDENTITY.md` and `src/scene/environmentRenderer.ts`.
6. **No Lifecycle Clarity**: Does not separate shipped prototype scope from `IN PROGRESS`, `PLANNED`, `LONG-TERM VISION`, or `UNDECIDED` systems.

---

## 3. What Should Be Preserved

1. **Title, Genre & Premise**: **LITTLE SOMEWHERE** — Cozy isometric 3D life-simulation game; *"A little world filled with thousands of little stories."*
2. **Cozy Non-Punitive Philosophy**: Zero starvation/stamina failure states, zero stressful countdowns, zero punishment for missing real-world days, belonging over grinding.
3. **Official Visual Identity**: **PREMIUM HANDCRAFTED STORYBOOK DIORAMA** (`docs/art-direction/VISUAL_IDENTITY.md` as authoritative visual source of truth).
4. **Core Five-Beat Daily Loop**: Waking on Willow Step Porch -> exploring & observing -> talking & engaging -> shaping the living world -> resting & persisting.
5. **The 9 Anchor Residents**: Clara, Arthur, Mina, Jun, Barnaby, Sora, Toby, Nora, and Pip (framed explicitly as the founding neighborhood cast, not a permanent ceiling).
6. **Signature Founding Storyline**: *The Silent Gazebo Bell* and its multi-route compassionate resolution.
7. **Environmental Reactivity Core**: Neighborhood visuals tangibly reward care, restoration, and community bonds.

---

## 4. What Is Outdated in `/GAME_DESIGN.md`

| Outdated Element | Current GDD Claim | Verified Project Truth |
| :--- | :--- | :--- |
| **Golden Hour Sky / Sun Hexes** (`§2` L29) | `#F5CFA0` horizon, `#FFB266` amber sun | Updated in R-01 (`src/scene/environmentRenderer.ts:13,21`) to `#F2C28C` sky and `#FF9D4A` sun with raking shadow curve (`max(8, 24 - |tNorm - 0.44| * 30)`). |
| **Lantern Dusk Clock & Sky Hexes** (`§2` L30) | `6:30 PM – 9:00 PM`, `#6F7FA8` sky | Clock runs until **9:30 PM** (`DAY_END_MINUTE = 1290` in `src/game/time.ts:6`); dusk sky deepened in R-01 to `#4C5B8F`, sun `#8099D8`. *(Note: `ARCHITECTURE.md` §4 still says `360–1260`.)* |
| **Daily Wake-Up Time** (`§1` L12, `§2` L27) | Implies 6:00 AM wake | `DAY_START_MINUTE = 360` (6:00 AM), Day 1 opens at **8:15 AM** (`DEFAULT_START_MINUTE = 495`), resting wakes at **8:00 AM** (`NEXT_DAY_WAKE_MINUTE = 480`). |
| **Static 4-Slot Schedules** (`§4` table) | Implies 4 fixed daily locations | Anchor slots (`residents.ts`) combine with utility-scored `RESIDENT_EXTRA_ACTIVITIES`, `rainBehavior`, trait preferences, bench reservations, social encounters, and late-dusk porch wind-down (`1225+`). |
| **Daily Mailbox Loop** (`§1` L12) | *"check the Willow Mailbox for morning notes"* daily | `getDailyMailboxLetter()` (`src/game/actions.ts:465-486`) delivers **3 milestone-gated letters** (`Welcome`, Day >= 2 `heardBellMystery`, `bellRestored`)—no daily procedural mail yet. |
| **Cast Framing** (`§4` heading) | *"Cast of 9 Residents"* | `ARCHITECTURE.md` §7 and `HANDOVER.md` §1 confirm 9 (`RESIDENT_ORDER`) is a controlled prototype cast built on scalable registries. |
| **Orchard Context** (`§3` L47) | Listed alongside interactive landmarks; cites *"Milestone 3's first expansion district"* | `Fern Hollow Orchard` (`Milestone 3 Build 1`, `WORKLOG` Entry 021) has 3D trees/gate/sign/ladder/crates/skep, 5 nav nodes, `orchard` zone, and `seat_orchard_bench`, **but zero NPC schedules, harvest/skep props, or orchard dialogue yet (`IN PROGRESS`)**. |

---

## 5. Missing Systems Audit (Implemented Code & Expanded Product Vision)

### 5.1 Implemented Systems Absent from `/GAME_DESIGN.md`
1. **Living Neighborhood Simulation (`simulation.ts`, `residents.ts`)**:
   - `ResidentTraits` (`sociability`, `outdoorsiness`, `morningLark`, `curiosity`, `preferredZones`, `rainBehavior`, `temperament`, `greetingDistance`).
   - Internal non-punitive `NpcNeeds` (`energy`, `hunger`, `social`, `fulfillment`) and 10 `CharacterEmotion`s with 35-minute hysteresis locks driving goal weights and mood reactions.
   - 17 procedural animation poses (`idle`, `walk`, `run`, `sprint`, `wave`, `talk`, `interact`, `work`, `sketch_read`, `music`, `converse`, `admire`, `sit`, `carry`, `carry_walk`, `rest`).
   - Autonomous 2–3 resident `ActiveSocialEncounter`s (cooldowns, mutual affinity/tension adjustments, chore fulfillment, player interruption, generalized social suppression when pairwise `affinity < 0 || tension >= 45`).
   - Spontaneous proximity greeting micro-bubbles scaled by relationship tier and guardedness; `close`/`kindred` player proximity gently restores NPC social need.
2. **Bilateral Relationship & Declarative Dialogue Architecture (`relationships.ts`, `dialogueEngine.ts`, `narrative.ts`)**:
   - Continuous `PlayerNpcRelation`: `affinity` (`0..100` -> 5 `RelationshipTier`s: `stranger` -> `kindred` + `0..5` hearts), `reliability` (`0..100`), `negativeCount`, guardedness, `DAILY_SMALLTALK_AFFINITY_CAP = 20`, and `make_amends_<id>` repair choices.
   - Sparse pairwise `NpcNpcRelation`: `affinity` (`-50..100`), `tension` (`0..100`), 5 `NpcRelationTier`s (`estranged` -> `confidant`).
   - 9 prioritized dialogue categories, anti-repeat `topicHistory` (resident-scoped for `'any'` topics), `lastTopicByResident`, concurrent quest injection, tier/emotion-modulated greetings (`resolveRelationshipGreeting`), **Third-Party Player-Relation Gossip** (`gossip_third_party_relation` + 4 pair topics), 2 conflict topics, and 4 prototype `sideFlags` side stories (`Pip & Nora's Zine`, `Mina & Clara's Herb Loaf`, `Sora & Barnaby's Music Stand`, `Jun & Arthur's Pocket Watch`).
3. **Tactile World Play, Prop Carrying & Water Landmarks (`playerController.ts`, `actions.ts`, `worldMap.ts`)**:
   - Analog walk/run/sprint (`Shift`) / walk (`Alt`), 33-node A* tap-to-walk, cambered bridge elevation.
   - 5 shared sit-able cedar benches (`SEAT_SPOTS`, blocked cleanly when occupied by a resident).
   - 5 carryable world props (`water_pail`, `rosemary_basket`, `chalk_bundle`, `tea_tray`, `lost_parcel`) with cradle animation, placement, `likedBy` affinity/reliability/emotion bonuses, and morning reset to `homePos`.
   - Fountain lucky coin wishing (`fountain_wish`, submerged coins, `mem_fountain_wish`), Mirror Pond pebble skipping / winter frost tapping (`skip_stone`, `mem_pond_skip`), and live Noticeboard tomorrow forecast.
4. **5-Layer Environment, Weather, 10-Day Seasons & Reactive Micro-Props (`environment.ts`, `reactiveProps.ts`, `environmentRenderer.ts`, `waterShaders.ts`)**:
   - Seeded deterministic weather (`sunlit`, `breezy`, `misty_morning` clearing at 10:30 AM, `light_rain`) with Day 1 fixed to `'sunlit'`, rain puddles, and instanced weather particles.
   - 10-day 4-season cycle (`spring` -> `winter`) tinting terrain/grove/orchard canopies, icing pond edges, slowing winter koi, and gating butterflies/fireflies.
   - Autonomous NPC visual touches (`claraPastryBasketVisible`, `minaGreenhouseStage`, `noticeboardFlyerCount`, `arthurEarlyPorchLamp`) and phase-driven workshop chimney smoke wisps.
5. **UI, Persistence & Web Audio (`App.tsx`, `DialogueSheet.tsx`, `JournalDrawer.tsx`, `audio.ts`, `storage.ts`, `migrations.ts`)**:
   - Relationship-tier icon & milestone avatar bounce in `DialogueSheet`; 3-tab `Pocket Journal` with `+2 Hours` skip; touch-only `VirtualJoystick`; procedural `cozyAudio` SFX; `WorldState v3` (`v1 -> v2 -> v3`) autosave & seeded deterministic `simSeed`.

### 5.2 Missing Planned & Future Systems Across Repository Docs & Expanded Product Vision

A thorough cross-reference of `docs/`, `HANDOVER.md`, `src/`, and the expanded game vision identifies six major areas currently absent from `/GAME_DESIGN.md`:

1. **Reward, Inventory & Progression Loop (`PLANNED` / `UNDECIDED`)**:
   - **What exists**: Memories (`18`), 5-tier affinity + hearts, `likedBy` delivery of 5 static props (resetting daily), 8 town visual changes, and numeric counts for wishes/pebbles.
   - **What is missing**: No multi-slot pocket inventory, no collectible encyclopedia/album (fish, flowers, dishes, photos, keepsakes), no persistent personal gifts or crafted/harvested items, no structured **community projects** beyond the Bell questline, and no documented **post-Bell long-term reward loop**.
   - **Critical Discipline**: Exact currencies (if any), numeric reward curves, inventory slot counts, or unlock quantities are **not defined anywhere in the repo** and must be marked `UNDECIDED / REQUIRES DESIGN DECISION`.
2. **Everyday Cozy Activities (`PLANNED` / `LONG-TERM VISION`)**:
   - **Gardening**: Currently *visual NPC state only* (`minaGreenhouseStage`, fixed `plantedMoonPetals` flag). No player planting, watering, soil plots, seasonal crops, or harvesting exists. *(Audit 04 floated unimplemented `cottagePlanterChoice`.)*
   - **Fishing**: Currently *ambient Koi visuals (`KoiFishRig`) + 1-click stone skipping (`skip_stone`)*. No fishing rod, cast/bite interaction, species variety, or weather/season catch table exists.
   - **Cooking & Sharing Meals**: Currently *flavor lore only* (`Sourdough`, `Chamomile Tea`, `Herb Loaf`, `rosemary_basket`). No kitchen station, recipe collection, cooking activity, or shareable food gifts exist.
   - **Decorating**: Zero indoor or outdoor player-placeable decor/furniture exists. *(Audit 04 floated unimplemented `placedSouvenirs` & `cottagePlanterChoice`.)*
   - **Photography**: Zero viewfinder/camera mode, screenshot/photo album, or neighbor photo requests exist.
   - **Community Activities & Events**: Noted as deferred in `08-milestone-2b-readiness.md` (*"Weekly plaza market stalls & festival calendar events"*); zero day-of-week clock (`Mon–Sun`) or festival scheduler exists in `src/game/time.ts`.
3. **Deeper Relationship Memory & Storyline Continuity (`IN PROGRESS` -> `PLANNED`)**:
   - Milestone 2B is explicitly **paused at Phase 2 checkpoint**: Phases 3–5 (`src/game/memories.ts`, encounter gossip spread + distortion, `WorldState v4`, formal multi-stage `storylines.ts`, dynamic `JournalDrawer` replacing hardcoded threads and telemetry `Reliability %`) exist only as an unapproved target blueprint in `docs/milestones/09-milestone-2b-audit-and-design.md` (plus two forward type hooks in `dialogueEngine.ts:40-43`).
   - Relationship tiers currently unlock dialogue & longer greetings, **not yet** deeper privilege/activity unlocks (interior visits, collaborative cooking/gardening, special recipes, companion moments).
4. **Neighborhood Growth & World Evolution (`IN PROGRESS` / `PLANNED` / `LONG-TERM VISION`)**:
   - `Fern Hollow Orchard` (`Milestone 3 Build 1`) built the northern scenery, gate, nav nodes, and bench, **without** orchard residents, harvesting, honey/skep play, or stories.
   - `cottage interiors` (`player_door` currently just rests until morning), `new districts` (`REGIONS` currently contains only `willow_square`), and `additional residents` (`RESIDENT_ORDER` prepared to scale, still 9 today) are all pending.
5. **Expanded Long-Term Content (`Sunday Market`, `Pets`, `Cloud Saves`)**:
   - **The Sunday Market**: Deferred in `08-milestone-2b-readiness.md` (`"Weekly plaza market stalls"`); requires introducing a **7-day week / named weekday system** (`time.ts`) plus rotating stalls/goods/social traffic.
   - **Pets**: Mentioned *only* as atmospheric dialogue flavor (`"marmalade cat"` in Pip & Toby lines, `narrative.ts:760, 1858`); zero pet systems exist in `src/` or prior `docs/`. Classified clearly as `LONG-TERM VISION` / `UNDECIDED`.
   - **Optional Cloud Saves**: Absent from `storage.ts` (`localStorage`-only today, zero backend/auth). Classified clearly as `LONG-TERM VISION` / `UNDECIDED`.
6. **Return-Friendly Session Design (`5–15 Minute Sessions`)**:
   - Verified today: Instant autosave (`commitWorld` + 5s revision check + `pagehide`), `+2 Hours` fast-forward, and zero real-world-clock penalties.
   - Missing today: GDD articulation of **5–15 minute curiosity-driven loop targets**, and enough rotating daily/weekly reasons (morning mail variety, market prep, growing plants, ongoing resident stories, collectible milestones) to reward returning player sessions long after Day 5.

---

## 6. Contradictions, Premature Claims & Discrepancies Across Docs & Code

1. **`HANDOVER.md` Milestone 2B Status vs Actual Phase 2 Checkpoint**: `HANDOVER.md:4` accurately notes *"Phase 2 Complete (At Regression Checkpoint — Paused before Phase 3)"*, whereas Milestone 2B (`docs/milestones/09`) is **5 phases total**, making Milestone 2B **`IN PROGRESS`** overall while Phases 3–5 remain **`PLANNED`**.
2. **Third-Party Gossip Distinction**: `selectThirdPartyGossipSubject` (`dialogueEngine.ts`) + `gossip_third_party_relation` (`narrative.ts`) **are `IMPLEMENTED`** (reacting to player relationships with a third party), whereas **Phase 3 `npcMemories` + encounter-to-encounter rumor spread & distortion** remain **`PLANNED`**.
3. **Unapproved Blueprint Proposals vs Implemented State**: `docs/audits/04` lists `cottagePlanterChoice` and `placedSouvenirs` on a proposed interface; **neither exists in `src/game/types.ts`**. They must be treated as `UNDECIDED` proposals, not shipped design.
4. **Asymmetric Story Memory & Route Rewards**:
   - `jun_advice` (`narrative.ts:529-537`) sets `deliveredPostcard: true` *without* unlocking `mem_postcard_sent`, unlike `jun_reassure` (`L513-526`).
   - `interactWithProp('hollow_oak')` (`actions.ts:610-618`) sets `foundBrassClapper: true` *without* unlocking `mem_brass_clapper`, unlike `toby_clapper` (`narrative.ts:220`).
5. **UI Telemetry Tone Conflict**: `JournalDrawer.tsx:293` renders raw `Reliability 25%` next to qualitative cozy labels despite anti-meter design goals (targeted for cleanup in Phase 5).
6. **Stale Cross-Doc References**: `ARCHITECTURE.md` §4 line 79 cites `360–1260` (code is `360–1290`), and `HANDOVER.md` line 11 cites `49/49` tests while §4 cites `64/64`.
7. **Orchard Visual-Only State**: `GAME_DESIGN.md` line 47 lists Fern Hollow Orchard identically to interactive landmarks despite lacking any resident schedules, props, or dialogue yet.

---

## 7. Design Consistency Matrix (Deliverable C)

| Design Area | Current GDD Description (`/GAME_DESIGN.md`) | Verified Project State | Lifecycle Status | Recommended GDD Treatment |
| :--- | :--- | :--- | :--- | :--- |
| **Core Premise & Pillars** | Relaxing life-sim; observe routines, listen, mend ties; no grind/timers. | Core cozy ethos intact across all `src/` layers & docs. | `IMPLEMENTED` | **Preserve & Expand**: Formalize 5 Pillars including 5–15 min return-friendly curiosity & non-punishment. |
| **Daily Clock & Calendar** | Implies 6:00 AM start; Dusk ends `9:00 PM` (`1260`). | `360..1290` (`6:00 AM – 9:30 PM`), Day 1 start `8:15 AM`, wake `8:00 AM`, `+2h` skip, `DAYS_PER_SEASON = 10`. **No weekday (`Mon–Sun`) model exists yet.** | `IMPLEMENTED` *(Weekday calendar: `PLANNED`)* | **Correct & Expand**: Document real `8:15 AM`/`8:00 AM`–`9:30 PM` bounds & 10-day seasons; flag weekday cycle for Sunday Market as `PLANNED`. |
| **Neighborhood Landmarks (`willow_square`)** | 10 core spots + 1 Orchard bullet. | All 10 `LANDMARK_ZONES`, 5 benches, Noticeboard, West Brook, Pier & Sailboat live. | `IMPLEMENTED` | **Reorganize cleanly** by courtyard/plaza/pond districts and interactive landmark roles. |
| **Fern Hollow Orchard** | Listed as a finished landmark + *"Milestone 3's first expansion district"*. | 3D trees, gate, sign, ladder, crates, skep, 5 nav nodes, `orchard` zone & `seat_orchard_bench` live; **no NPC routines, props, or orchard stories**. | `IN PROGRESS` | **Separate clearly**: Mark physical district/bench `IMPLEMENTED` and harvest/social/narrative gameplay `PLANNED`. |
| **Visual Identity & Lighting** | Hardcodes FOV, roughnesses, & stale hexes (`#F5CFA0`, `#6F7FA8`). | `VISUAL_IDENTITY.md` & `environmentRenderer.ts` (R-01) hold real specs. | `IMPLEMENTED` | **Deduplicate**: Reference `VISUAL_IDENTITY.md`; describe visual mood qualitatively without engine hexes. |
| **Cast & Daily Schedules** | `"Cast of 9 Residents"` + static 4-phase table. | 9 prototype residents (`RESIDENT_ORDER`) built to scale; anchor slots + trait/weather `RESIDENT_EXTRA_ACTIVITIES` + dusk porch wind-down. | `IMPLEMENTED` | **Reframe**: Clarify 9 is founding prototype cast; document dynamic trait- & weather-adapted schedules. |
| **NPC Autonomy, Traits, Needs & Emotions** | Absent. | `ResidentTraits`, soft internal `NpcNeeds`, 10 emotions (`35m` lock), 17 poses, greeting bubbles. | `IMPLEMENTED` | **Add Section 05**: Explain how inner life creates authentic autonomy without survival meters. |
| **Player–NPC Relationships & Tiers** | *"raise trust (0–5 hearts)"*. | `affinity` (`0..100` -> 5 tiers + 5 hearts), `reliability` (`0..100`), guardedness, daily smalltalk cap (`20`), `make_amends`, tier icons & milestone bounce. | `IMPLEMENTED` *(Journal prose & deeper tier perks: `PLANNED` / `UNDECIDED`)* | **Add Section 06**: Detail bilateral trust/reliability, repair, greeting scaling, & needed tier-unlock design. |
| **NPC–NPC Relations & Social Encounters** | Only reconciled Clara/Arthur Golden Hour overlap. | `NpcNpcRelation` (`affinity -50..100`, `tension 0..100`, 5 tiers), 2–3 NPC `ActiveSocialEncounter`s, suppression (`affinity < 0 || tension >= 45`). | `IMPLEMENTED` | **Add Section 06**: Detail autonomous social circles, mutual help, & tension suppression. |
| **NPC Memories & Encounter Gossip** | Absent. | **Global** `worldEvents` + **player-relation** third-party gossip (`selectThirdPartyGossipSubject`) exist. **Per-NPC `npcMemories` + rumor distortion (`Phase 3`) not built.** | `PLANNED` *(Third-party player gossip: `IMPLEMENTED`)* | **Distinguish strictly**: Document shipped third-party gossip vs. planned `Phase 3` hearsay & distortion. |
| **Dialogue & Branching Stories** | Branching choices & memories only (*The Silent Gazebo Bell*). | Declarative `dialogueEngine.ts` (9 categories), `topicHistory`, 4 prototype `sideFlags` stories, 2 conflicts. Formal `storylines.ts` (`Phase 4`) & dynamic Journal (`Phase 5`) pending. | `IN PROGRESS` *(Bell + 4 prototype arcs `IMPLEMENTED`; `Phase 4–5` `PLANNED`)* | **Add Sections 07–08**: Detail topic prioritization, Bell routes, prototype side arcs, & planned `Phase 4` storyline engine. |
| **Player Movement, Sitting & Carryable Gifts** | Absent. | Analog walk/run/sprint, A* tap-walk, 5 shared benches, 5 morning-reset carryable props w/ `likedBy` delivery, Fountain coins, Pond stone skip. | `IMPLEMENTED` | **Add Sections 03–04**: Document locomotion, shared bench etiquette, & shared neighborhood gifting. |
| **Weather, Seasons & NPC Environmental Touches** | Only 8 `StoryFlags` rows. | 4 seeded weathers + forecasts + puddles; 10-day 4 seasons; reactive pastry basket, greenhouse buds/blooms, flyers, early lamp, smoke wisps, wildlife. | `IMPLEMENTED` | **Upgrade Section 09**: Separate atmospheric layers, player world transformations, & autonomous NPC/ambient life. |
| **Pocket Journal, HUD, Audio & Local Save** | Brief type/palette note + *"progress carries forward"*. | Compact backdrop-dismissible `DialogueSheet`, 3-tab `JournalDrawer` (has `Reliability %` leak), touch-only joystick, Web Audio SFX, `WorldState v3` (`localStorage`). | `IMPLEMENTED` *(Dynamic Journal `Phase 5`: `PLANNED`)* | **Document in Sections 10–11**: Capture UI ergonomics, audio identity, autosave safety, & Phase 5 cleanup. |
| **Reward Loop, Inventory & Collectibles** | Absent (only memories, hearts, & 8 Bell visual flags). | Only `JournalMemory` list (18), 5 daily-reset props, & counters (`fountainWishesCount`, `pondPebblesSkipped`). **Zero inventory, catalog, or persistent rewards.** | `PLANNED` / `UNDECIDED` | **Add New Progression Chapter (Section 11)**: Design cohesive cozy loop & isolate undefined reward rules for sign-off. |
| **Everyday Cozy Activities (Garden/Fish/Cook/Decor/Photo)** | Absent. | Cosmetic koi & greenhouse NPC stages only; zero player farming/fishing/cooking/decorating/camera mechanics exist. | `PLANNED` | **Add to Sections 03 & 12**: Define intended activities & how each feeds gifts, bonds, discoveries & world life. |
| **Enterable & Customizable Interiors** | Absent (`Willow Step Cottage` = porch rest trigger only). | Explicitly deferred to Milestone 3+ in `HANDOVER.md` & `08-milestone-2b-readiness.md`; `player_door` prompts next-day rest. | `PLANNED` | **Document in Sections 04 & 12**: Define interior role as home sanctuary, decorating canvas & resident visits. |
| **The Sunday Market & Community Events** | Absent (only Bell celebration concept). | Cited in `08-milestone-2b-readiness.md` (*"Weekly plaza market stalls & festival calendar events"*); requires weekday/calendar system (`time.ts`). | `PLANNED` / `LONG-TERM VISION` | **Document in Sections 09 & 12**: Position as anchor weekly social/trade/gift ritual & seasonal climax. |
| **Pets & Animal Companions** | Absent. | Only dialogue prose mention (`marmalade cat` in Pip/Toby chat); zero pet entities or mechanics exist. | `LONG-TERM VISION` / `UNDECIDED` | **Place in Section 12**: Frame carefully as long-term companion vision without fabricating unapproved mechanics. |
| **Optional Cloud Saves & Multi-District Growth** | Absent. | `localStorage` only (`storage.ts`); `REGIONS` data hook exists for `willow_square` only. | `LONG-TERM VISION` | **Place in Sections 11–12**: State browser `localStorage` baseline today & optional cross-device cloud save + multi-district future. |

---

## 8. Critical Audit Takeaways Before Revision

1. **Zero Fabrication on Undefined Rewards**: Because the repository has zero currency names, reward tables, inventory sizes, or unlock formulas, **no numeric economy rules may be invented** inside the GDD without explicit design decisions first.
2. **Clean Separation of Implemented vs. Intended**: Players currently experience a richly simulated 9-resident town with a finished founding quest, 4 prototype side arcs, weather/seasons, benches, 5 daily props, and Orchard visuals—while **Phase 3–5 social depth**, **inventory/collectibles**, **everyday hobbies (gardening/fishing/cooking/decorating/photography)**, **interiors**, **the Sunday Market**, **pets**, and **cloud saves** sit cleanly in `PLANNED` or `LONG-TERM VISION`.
3. **Cozy Retention Focus**: The revised GDD must directly connect every planned activity and social feature into a **curiosity-driven 5–15 minute session loop** that rewards returning with stories, creations, relationships, and a blooming town—never login streaks or timers.
