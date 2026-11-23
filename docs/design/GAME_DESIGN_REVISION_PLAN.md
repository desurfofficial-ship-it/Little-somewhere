> **STATUS: OBSOLETE** — the revision this plan proposed was executed; `GAME_DESIGN.md` is now the revised 347-line, 12-section authoritative baseline. Preserved as the historical record of the revision plan. Do not read as current.

# GAME_DESIGN_REVISION_PLAN.md — LITTLE SOMEWHERE GDD Revision Blueprint

**Audit Phase**: Phase 1 — Expanded Audit & Revision Planning (Awaiting Approval Before Revising `/GAME_DESIGN.md`)  
**Target Output**: Authoritative 12-Section Game Design Document (`/GAME_DESIGN.md`)  
**Companion Audit**: `/docs/design/GAME_DESIGN_AUDIT.md`

---

## 1. Revision Philosophy & Boundaries

The revised `/GAME_DESIGN.md` must unify the **implemented Milestone 1 / 2A / 2B (Phases 1–2) / Milestone 3 (Build 1) reality** with the **expanded long-term vision** into a coherent, player-centered Game Design Document.

- **Strict Documentation Hygiene**: Explain player experience, systems intent, and feedback loops cleanly without duplicating `VISUAL_IDENTITY.md` hex/shader constants or `ARCHITECTURE.md` TypeScript/Three.js internals.
- **Strict 5-Label Honesty**: Tag every planned or future system clearly as **`IMPLEMENTED`**, **`IN PROGRESS`**, **`PLANNED`**, **`LONG-TERM VISION`**, or **`UNDECIDED / REQUIRES DESIGN DECISION`**.
- **No Unapproved Economic Invention**: Never invent currency names, point scales, reward drop tables, login bonuses, or unapproved blueprint shortcuts (e.g., Audit 04's unimplemented `cottagePlanterChoice` / `placedSouvenirs`) as settled rules—surface undefined reward mechanics explicitly as design decisions.

---

## 2. Reward, Progression and Player Motivation

> *Dedicated planning chapter addressing the most critical gap identified across the repository and original GDD.*

### 2.1 Player Motivation & Anti-Punishment Session Philosophy (`IMPLEMENTED` Mindset / `PLANNED` Depth)
**LITTLE SOMEWHERE** is designed for **warm, curiosity-driven 5–15 minute drop-in sessions** (with complete freedom to linger much longer in a living day):
- **Why players return**: Not because a streak breaks or crops wither in real-time, and not to grind currency counters—but to see **what season/weather arrived**, **what happened in the neighborhood**, **how a resident responded to yesterday's kindness or gossip**, **what bloomed or finished crafting**, and **who is gathered at the square or Sunday Market**.
- **Return-Friendly Guarantees**:
  - **Zero real-world time pressure**: In-game time advances only while playing (`time.ts`, no `Date.now()` offline decay or missed-day penalties).
  - **Zero stressful survival bars**: Soft `NpcNeeds` regulate resident behavior behind the scenes; the player never manages hunger/exhaustion timers.
  - **Instant resume & deliberate pacing**: Continuous autosave + `+2 Hours` fast-forward let short-session players sample Morning, Golden Hour, or Lantern Dusk at their own pace.

### 2.2 The Connected Cozy Reward Loop
Rather than flattening progression into money or a single heart counter, rewards in **LITTLE SOMEWHERE** flow through **four interconnected, mutually reinforcing pillars**:

```
   ┌──────────────────────────────────────────────────────────────────────┐
   │  EVERYDAY AGENCY & ACTIVITIES                                        │
   │  • Explore, Observe, Sit & Rest (`IMPLEMENTED`)                      │
   │  • Share Neighborhood Props, Skip Stones, Toss Coins (`IMPLEMENTED`) │
   │  • Gardening, Fishing, Cooking, Photography, Decorating (`PLANNED`)  │
   └───────────────────────────────┬──────────────────────────────────────┘
                                   │ yields creations, discoveries,
                                   │ shared experiences & gifts
                                   ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │  RELATIONSHIPS & LIVING SOCIAL WEB                                   │
   │  • Affinity, Tiers, Reliability & Repair (`IMPLEMENTED`)             │
   │  • Third-Party Gossip (`IMPLEMENTED`) & NPC Memories (`PLANNED`)     │
   │  • Shared Activities, Favors & Invitations (`PLANNED`)               │
   └───────────────────────────────┬──────────────────────────────────────┘
                                   │ unlocks stories, recipes, tools,
                                   │ resident initiatives & trust
                                   ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │  PERSONAL STORIES, COLLECTIBLES & DISCOVERIES                        │
   │  • Main & Multi-Stage Personal Arcs (`IN PROGRESS` / `PLANNED`)      │
   │  • Pocket Journal Memories (`IMPLEMENTED`) & Collections (`PLANNED`) │
   │  • Cozy Home Keepsakes, Photos & Albums (`PLANNED`)                  │
   └───────────────────────────────┬──────────────────────────────────────┘
                                   │ inspires community contributions
                                   │ & seasonal rituals
                                   ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │  WORLD EVOLUTION & EXPANDING OPPORTUNITIES                           │
   │  • Restored Landmarks, Lanterns, Planters & Waters (`IMPLEMENTED`)   │
   │  • Orchard Gameplay, Community Projects, Interiors (`PLANNED`)       │
   │  • Sunday Market, Seasonal Festivals, Districts & Pets (`VISION`)    │
   └──────────────────────────────────────────────────────────────────────┘
```

### 2.3 How Every System Connects Inside the Loop
1. **Everyday Activities -> Tangible Outputs (`PLANNED` extending `IMPLEMENTED` micro-play)**:
   - *Gardening, Fishing, Cooking, and Exploration* should produce **meaningful, shareable things** (fresh harvests, fish/pond finds, baked loaves & steeped teas, pressed leaves, orchard fruit, keepsake photos)—not sterile vendor-trash.
   - *Photography* and *Exploration* document fleeting moments (rain puddles, Golden Hour gossip circles, seasonal blooms) into lasting keepsakes and conversation starters.
2. **Inventory, Collectibles & Persistent Gifts -> Social & Creative Fuel (`PLANNED` / `UNDECIDED`)**:
   - Moving beyond today's 5 static morning-reset props (`water_pail`..`lost_parcel`), a proper pocket **Inventory** allows keeping a freshly cooked dish, harvested flower, framed snapshot, or Sunday Market find to gift intentionally, decorate a room/porch, or contribute to a town project.
   - **Collectible Records** (Memory entries today; future Fish/Botanical/Recipe/Photo/Souvenir catalogs) celebrate curiosity and seasonal variety across Spring, Summer, Autumn, and Winter.
3. **Relationships Unlock Genuine Gameplay & Story Opportunity (`IMPLEMENTED` foundation -> `PLANNED` payoff)**:
   - Deepening a bond (`Stranger` -> `Kindred`) shouldn't only fill hearts—it shifts greeting distance and warmth (`IMPLEMENTED`), unlocks personal side arcs (`IMPLEMENTED` at Trust 1), guards against rushed exploitation (`IMPLEMENTED`), and **future-wise** should unlock cottage invitations, signature recipes/craft plans, honest memories/rumors (`Phase 3`), community project help, and special Sunday Market or companion interactions.
4. **Community Contributions -> Visible Neighborhood Transformation (`IMPLEMENTED` Bell -> `PLANNED` Projects & Events)**:
   - Just as *The Silent Gazebo Bell* transformed planters, water, ivy, café tables, and dusk lanterns, ongoing **Community Projects** (e.g., orchard harvest preparations, seasonal garlands, pier/bridge dressings, Sunday Market stall setup) give players collaborative goals whose rewards **remain permanently visible in the town** for everyone to enjoy.
5. **Sunday Market & Seasonal Rhythm -> Short-Session Destination Hooks (`PLANNED` / `LONG-TERM VISION`)**:
   - Giving the town recurring weekly and seasonal rhythms (a **Sunday Market** gathering neighbors to trade, share homemade goods, unveil rare seeds/decor/keepsakes, and exchange gossip) creates natural mid-term milestones that fit a single 10-minute session without FOMO penalties.

### 2.4 Reward & Progression Questions Requiring Separate Design Discussion (`UNDECIDED`)
Before specifying exact mechanics in implementation or final balance rules, these questions remain **open**:
1. **Exchange / Economy Model**: Should Sunday Market / community sharing use purely **barter & neighborly exchange / gift tokens**, a cozy **community currency**, or pure **item-for-item / favor reciprocity**? *(Zero currency or pricing model currently exists in the codebase.)*
2. **Inventory Scope & Friction Philosophy**: How minimalist should the pocket inventory be (e.g., compact curated satchel vs categorized pocket tabs for Seeds/Ingredients/Gifts/Decor/Photos), and should items stack or remain individually tactile?
3. **Coexistence of World Props & Personal Gifts**: When an inventory exists, do the current 5 shared cobblestone props (`water_pail`, etc.) remain free tactile shared tools in the plaza while personal gifts/items live in your pocket, or do they merge?
4. **Relationship Tier Gameplay Unlocks**: Which specific privileges unlock at `Friendly`, `Close`, and `Kindred` (e.g., home entry hours, recipe/gardening teaching, personal favors, keepsake gifts back from NPCs, custom portrait/photo requests)?
5. **Collectible Completion Rewards**: What do completing seasonal collections (e.g., pond catches, moon-petal hybrids, town photographs) unlock—Journal stamps/seals, cottage keepsakes, town banner embellishments, or new dialogue memories?
6. **Non-Punitive Weekly Calendar Mapping**: How should `Sunday Market` align with `time.ts` (which currently counts `Day 1, 2, 3...` in `DAYS_PER_SEASON = 10` without named weekdays—e.g., changing season length to `7`/`14`/`28` days vs adding weekday names `Mon–Sun`, and ensuring a player never feels punished if they rest past a Sunday)?
7. **Post-Bell Community Project Cadence**: After restoring the Gazebo Bell, should future community improvements unlock sequentially via seasonal milestones, via Sunday Market notices, or freely via resident collaborations?

---

## 3. Proposed 12-Section GDD Structure (`/GAME_DESIGN.md`)

### `01. Game Overview`
- **Intent**: Anchor premise (*"A little world filled with thousands of little stories"*), genre, mobile-first + desktop experience, cozy 5–15 minute drop-in session identity, and core anti-grind guarantees.
- **Sources**: `GAME_DESIGN.md` §1, `README.md`, `AGENTS.md`, `TitleOverlay.tsx`.

### `02. Design Pillars`
- **Intent**: Formalize the core pillars guiding all design decisions:
  1. **A Living, Autonomous Neighborhood** (`IMPLEMENTED` core -> `PLANNED` expansion)
  2. **Relationships Shape Community Life** (`IMPLEMENTED` dual matrix -> `PLANNED` memories/perks)
  3. **Stories Emerge & Interconnect** (`IN PROGRESS` Bell + prototype arcs -> `PLANNED` Phases 3–4)
  4. **A World That Changes With Care** (`IMPLEMENTED` Bell/weather/seasons/NPC props -> `PLANNED` community projects & districts)
  5. **Cozy Agency Without Punishment** (`IMPLEMENTED` clock/autosave safety -> `PLANNED` hobby pacing)
- **Sources**: Audit Pillars, `simulation.ts`, `relationships.ts`, `environment.ts`.

### `03. Core Player Loop & Everyday Agency`
- **Intent**: Document both the **5-beat daily cadence** (`8:15 AM`/`8:00 AM` wake through `9:30 PM` Dusk, `+2h` agency, porch rest) and the complete **Everyday Activities Taxonomy**, separating `IMPLEMENTED` play (walking, observing, talking/mediating, shared bench sitting, carrying 5 daily tools/gifts, coin wishes, stone skipping) from `PLANNED` hobbies (**Gardening**, **Fishing**, **Cooking & Sharing Meals**, **Decorating**, **Photography**, **Community Events**) and explaining how every activity links back to bonds, discoveries, and world life.
- **Sources**: `time.ts`, `playerController.ts`, `actions.ts`, `worldMap.ts`, `App.tsx`, Expanded Vision Brief.

### `04. World, Neighborhood & Locations`
- **Intent**: Map **Willow Lane & Fountain Square** (`willow_square` districts, cottages, landmarks, 5 benches, interactive props, noticeboard, mirror pond & west brook) alongside **Fern Hollow Orchard** (`IN PROGRESS`: visuals/nav/bench built vs harvest/social gameplay `PLANNED`), **Enterable & Customizable Cottage Interiors** (`PLANNED`), and **Multi-District Expansion** (`REGIONS`, `LONG-TERM VISION`).
- **Sources**: `worldMap.ts`, `navigation.ts`, `orchard.ts`, `willowLaneDiorama.ts`, `HANDOVER.md`.

### `05. Characters & Daily Lives`
- **Intent**: Profile the **9 founding residents** (`RESIDENT_ORDER`, framed as expandable prototype cast) and explain the internal simulation machinery that makes them believable: `ResidentTraits`, `rainBehavior`, soft `NpcNeeds`, 10 `CharacterEmotion`s, 17 poses, utility-scored activities, shared bench contention, and late-dusk porch return. Also note future `PLANNED` cast growth (e.g., orchard/market roles).
- **Sources**: `residents.ts`, `simulation.ts`, `characters.ts`, `ARCHITECTURE.md` §7.

### `06. Relationships, Memory & Social Systems`
- **Intent**: Define the full social engine:
  - `PlayerNpcRelation`: `affinity` (5 tiers + 5 hearts), `reliability` & guardedness (`make_amends` repair, anti-farming daily cap), greeting modulation (`IMPLEMENTED`), plus `PLANNED` tier-based gameplay unlocks.
  - `NpcNpcRelation` & Autonomous Encounters: 2–3 resident gatherings, tension suppression, mutual chore warmth (`IMPLEMENTED`).
  - **Memory & Rumor Architecture**: Distinguish `JournalMemories` (`IMPLEMENTED`) & third-party player-relation gossip (`IMPLEMENTED`) from `PLANNED` Milestone 2B Phase 3 per-NPC `npcMemories`, controlled hearsay spread, and mild personality distortion.
- **Sources**: `relationships.ts`, `simulation.ts`, `dialogueEngine.ts`, `docs/milestones/09-milestone-2b-audit-and-design.md`.

### `07. Dialogue & Storytelling System`
- **Intent**: Explain how conversations respond dynamically to time, weather, season, emotions, held props, relationship tiers, recent encounters, and anti-repeat memory (`dialogueEngine.ts`), plus how Phase 3–4 upgrades will layer NPC hearsay and branching outcomes into talk without blocking story progress.
- **Sources**: `dialogueEngine.ts`, `narrative.ts`, `DialogueSheet.tsx`, `docs/milestones/09a-dialogue-content-inventory.md`.

### `08. Narratives, Storylines & Events`
- **Intent**: Catalog both curated and emergent storytelling:
  - **Main Storyline**: *The Silent Gazebo Bell* (mystery, 5 reconciliation/restoration styles, permanent town transformation — `IMPLEMENTED`).
  - **Personal Side Stories & Conflicts**: 4 prototype side arcs + 2 conflict mediation topics (`IMPLEMENTED`) transitioning into the formal multi-stage/multi-outcome `storylines.ts` runtime (`PLANNED` Phase 4).
  - **Emergent Neighborhood Stories, Mailbox Letters & Community Events**: Spontaneous encounters, weather shifts, expanding mail rituals, **Sunday Market** days, and **Seasonal Festivals** (`PLANNED` / `LONG-TERM VISION`).
- **Sources**: `narrative.ts`, `actions.ts`, `JournalDrawer.tsx`, `docs/milestones/09`.

### `09. Environmental Systems & World Reactivity`
- **Intent**: Document the **5-Layer Environment Composer** (`environment.ts` + `reactiveProps.ts` + `waterShaders.ts`):
  1. Time of Day & Lighting Mood
  2. Deterministic Weather & Noticeboard Forecasts
  3. 10-Day 4-Season Cycle (`spring`–`winter` palettes, pond frost, wildlife)
  4. Player-Driven World Changes (Bell flags `IMPLEMENTED` + future Community Projects & Exterior Decorating `PLANNED`)
  5. Autonomous NPC & Ambient World Touches (pastry basket, greenhouse growth, flyers, early lamp, hearth smoke wisps, koi, dragonflies, butterflies, fireflies)
- **Sources**: `environment.ts`, `environmentRenderer.ts`, `reactiveProps.ts`, `waterShaders.ts`, `docs/audits/04`.

### `10. Visual, Audio & Interface Direction`
- **Intent**: Present **PREMIUM HANDCRAFTED STORYBOOK DIORAMA** by referencing `docs/art-direction/VISUAL_IDENTITY.md` & `VISUAL_QUALITY_STANDARDS.md`, cover desktop + mobile touch ergonomics (`VirtualJoystick` touch-only, compact backdrop-dismissible `DialogueSheet` with tier icon & milestone bounce), review `Pocket Journal` (`Neighbors`, `Story & Memories`, `World & Time`, plus Phase 5 prose/reliability cleanup), and document the procedural Web Audio soundscape (`cozyAudio`).
- **Sources**: `docs/art-direction/*`, `App.tsx`, `DialogueSheet.tsx`, `JournalDrawer.tsx`, `PauseModal.tsx`, `TitleOverlay.tsx`, `audio.ts`.

### `11. Reward, Progression and Player Motivation`
- **Intent**: Establish the complete cohesive progression model built around **5–15 minute curiosity-driven sessions** rather than grind/streaks:
  - How activities (`Gardening`, `Fishing`, `Cooking`, `Photography`, `Exploration`), relationships, personal stories, and community projects reinforce each other.
  - Current rewards (`Memories`, relationship tiers, visual transformations, shared props, wish/skip milestones) vs `PLANNED` **Pocket Inventory, Collectible Catalogs, Giftable Creations, Cottage Keepsakes & Unlocks**.
  - Cross-day continuity rules (shared world props morning reset vs persistent progress, seeded determinism, `localStorage` autosave `WorldState v3` -> `v4`, and `LONG-TERM VISION` **Optional Cloud Saves**).
  - Explicit listing of `UNDECIDED` reward design parameters awaiting dedicated discussion.
- **Sources**: `storage.ts`, `migrations.ts`, `actions.ts`, `time.ts`, Expanded Vision Brief.

### `12. Scope, Roadmap and Future Vision`
- **Intent**: Provide an explicit roadmap crystal-clear on lifecycle status across horizons:
  - **Current Baseline**: Milestone 1 + 2A + 2B Phases 1–2 + Milestone 3 Build 1 (Orchard scenery/nav/bench) (`IMPLEMENTED` / `IN PROGRESS`).
  - **Near-Term Narrative & Social Completion**: Milestone 2B Phases 3–5 (`npcMemories` & rumor spread, `storylines.ts`, dynamic `JournalDrawer`) (`PLANNED`).
  - **World & Gameplay Expansion (Milestone 3+)**: Orchard gameplay completion, Everyday Cozy Hobbies (`Gardening`, `Fishing`, `Cooking`, `Decorating`, `Photography`), Inventory & Collectibles, **Enterable & Customizable Cottage Interiors**, **Additional Residents** (`PLANNED`).
  - **Long-Term Town Life Horizon**: **The Sunday Market** + weekday rhythm, **Community Projects & Seasonal Festivals**, **Pets**, **Optional Cloud Saves**, and **New Neighboring Districts (`REGIONS`)** realizing *"thousands of little stories"* (`LONG-TERM VISION`).
- **Sources**: `HANDOVER.md`, `ARCHITECTURE.md` §7, `WORKLOG.md`, `docs/milestones/09`, `docs/audits/08`, Expanded Vision Brief.

---

## 4. Complete Feature & System Lifecycle Matrix

| Feature / System | Status | Verified Notes & Dependencies |
| :--- | :--- | :--- |
| 9 anchor residents, traits, soft needs, 10 emotions, 17 animation poses | **`IMPLEMENTED`** | `residents.ts`, `simulation.ts`, `characters.ts` |
| 33-node A* nav, `willow_square` collision, cambered footbridge, 5 shared benches | **`IMPLEMENTED`** | `navigation.ts`, `worldMap.ts` |
| Autonomous 2–3 NPC social encounters, cooldowns, tension suppression | **`IMPLEMENTED`** | `simulation.ts`, `relationships.ts` |
| *Silent Gazebo Bell* storyline, 2 conflict topics, 4 `sideFlags` prototype arcs | **`IMPLEMENTED`** | `narrative.ts`, `actions.ts` |
| Bilateral `PlayerNpcRelation` (5 tiers, hearts, `reliability`, `make_amends`, daily cap) & `NpcNpcRelation` | **`IMPLEMENTED`** | `relationships.ts`, `actions.ts` |
| Declarative `dialogueEngine.ts`, relationship-modulated greetings, tier icon & milestone bounce, third-party player gossip | **`IMPLEMENTED`** | `dialogueEngine.ts`, `DialogueSheet.tsx` |
| 5 daily-reset carryable props w/ `likedBy` gifting, Fountain wishes, Pond pebble skipping, Noticeboard forecast | **`IMPLEMENTED`** | `worldMap.ts`, `actions.ts`, `environmentRenderer.ts` |
| 5-layer environment (`4` weathers, `10`-day `4` seasons, reactive props, water shaders, ambient wildlife) | **`IMPLEMENTED`** | `environment.ts`, `reactiveProps.ts`, `waterShaders.ts` |
| Procedural Web Audio SFX, touch-only joystick, compact HUD/Journal, `WorldState v3` autosave | **`IMPLEMENTED`** | `audio.ts`, `App.tsx`, `storage.ts`, `migrations.ts` |
| **Milestone 2B Overall** (Phases 1–2 done; paused before Phases 3–5) | **`IN PROGRESS`** | `HANDOVER.md`, `docs/milestones/09` |
| **Fern Hollow Orchard District** (scenery, nav, zone, 5th bench built; gameplay/schedules/props missing) | **`IN PROGRESS`** | `orchard.ts`, `worldMap.ts` (`WORKLOG` Entry 021) |
| **Milestone 2B Phases 3–5** (`npcMemories`, encounter gossip distortion, `WorldState v4`, formal `storylines.ts`, dynamic Journal prose replacing `Reliability %`) | **`PLANNED`** | `docs/milestones/09-milestone-2b-audit-and-design.md` |
| **Pocket Inventory, Collectible Catalogs & Persistent Gift Economy** | **`PLANNED`** | Expanded Vision §1 (exact structure `UNDECIDED`) |
| **Everyday Cozy Activities**: Gardening, Fishing, Cooking & Sharing Meals, Decorating, Photography | **`PLANNED`** | Expanded Vision §2 (note Koi/Greenhouse/loaves are cosmetic/lore today) |
| **Orchard Gameplay** (crabapple/honey interactions, resident schedules, orchard stories) | **`PLANNED`** | Completion of `Milestone 3 Build 1` |
| **Enterable & Customizable Cottage Interiors** (player home & neighbor workshops/shops) | **`PLANNED`** | `HANDOVER.md` §3, `08-milestone-2b-readiness.md`, Expanded Vision §6 |
| **Community Projects & Town Improvements** (post-Bell collaborative builds & repairs) | **`PLANNED`** | Expanded Vision §1, §5 |
| **Additional Residents Beyond Founding 9** | **`PLANNED`** | Supported by `RESIDENT_ORDER` / sparse `npcRelations` (`ARCHITECTURE.md` §7) |
| **The Sunday Market** (weekly gathering, stalls, goods, trade/sharing) | **`LONG-TERM VISION`** | `08-milestone-2b-readiness.md` ("Weekly plaza market stalls"), Expanded Vision §6 |
| **Seasonal Festivals & Recurring Town Events** | **`LONG-TERM VISION`** | `08-milestone-2b-readiness.md`, Expanded Vision §5–6 |
| **Pets & Animal Companions** | **`LONG-TERM VISION`** | Expanded Vision §6 *(today only "marmalade cat" prose flavor exists)* |
| **Additional Neighborhoods / Regions (`REGIONS`)** | **`LONG-TERM VISION`** | `worldMap.ts` hook (`willow_square` only today), Expanded Vision §6 |
| **Optional Cloud Saves** (cross-device backup alongside `localStorage`) | **`LONG-TERM VISION`** | Expanded Vision §6 *(today browser `localStorage` only)* |
| **Economy rules, exact reward unlocks, tier perks, weekday calendar mapping, asymmetric memory policy** | **`UNDECIDED / REQUIRES DESIGN DECISION`** | See Section 5 below |

---

## 5. Major Design Decisions Requiring Discussion & Sign-Off (`UNDECIDED`)

Before drafting the revised `/GAME_DESIGN.md`, please clarify or confirm these design questions (grouped by topic so no reward formulas or unapproved rules are assumed):

### Group A — Reward, Inventory & Progression Rules (Needs Separate Design Alignment)
1. **Value Exchange & Progression Currency Question**: Should **LITTLE SOMEWHERE** remain completely **currency-free** (progressing through gifts, recipes, seeds, shared favors, collections, and community contributions), introduce a **single gentle community token / coin / stall favor system** for the Sunday Market, or stay undecided until Milestone 3 scoping?
2. **Inventory & Gift Persistence Boundary**: When a player pocket inventory is added, should carried/gifted creations persist permanently once acquired/crafted, and should the existing **5 plaza props** (`water_pail`, `rosemary_basket`, `chalk_bundle`, `tea_tray`, `lost_parcel`) stay as shared daily neighborhood tools that reset overnight?
3. **Collectibles & Discovery Framing**: What should the Pocket Journal record as long-term collectibles (e.g., Recipes, Flora/Seeds, Pond Species, Photograph Album, Neighbor Keepsakes/Souvenirs), and what cozy feedback should completing a collection give (visual cottage display, Journal stamp, conversation unlocks)?
4. **Relationship Tier Gameplay Privileges**: Beyond warmer dialogue and longer greeting range, what concrete gameplay opportunities should `Friendly`, `Close`, and `Kindred` tiers unlock (e.g., cottage interior hours, teaching hobby techniques/recipes, personal favor quests, keepsake gifts)?
5. **Sunday Market & Weekday Calendar Design**: Introducing **The Sunday Market** implies a **named day-of-week rhythm (`Mon–Sun`)**. Should seasons stay `10` days with a rotating market rhythm, adjust to `7` or `14` days per season so Sunday aligns cleanly, and how should missed-Sunday FOMO be prevented (e.g., keeping Sunday accessible via cozy pacing rather than real-world wall clocks)?

### Group B — Everyday Activities, Scope & Milestone Priorities
6. **Hobby Priority & Mechanical Depth (`Gardening`, `Fishing`, `Cooking`, `Decorating`, `Photography`)**: Which 1–2 activities should follow right after Milestone 2B / Interiors, and how tactile vs relaxed should they feel (e.g., cozy timed bite / framing camera vs calm one-tap tending)?
7. **Fern Hollow Orchard's Gameplay Role**: Should the newly built Orchard become (a) a seasonal crabapple-harvest & bee-skep gathering/cooking zone for **Clara & Mina**, (b) the workplace of a **10th resident**, (c) a future venue for an Autumn Cider gathering, or all three?
8. **Pets Scope & Role**: For the planned **Pets** vision, are you imagining a **single personal companion pet** (like adopting Willow Lane's mentioned marmalade cat), neighborhood pets owned by residents, or multiple adoptable/befriendable creatures?
9. **Optional Cloud Saves Scope**: Should optional cloud saves be scoped strictly as manual export/import + optional account sync for `WorldState` JSON in a far future phase?

### Group C — Existing Code & Doc Consistencies
10. **Milestone 2B Phases 3–5 Confirmation**: Confirm that `npcMemories`, encounter gossip propagation & distortion, `WorldState v4`, multi-stage `storylines.ts`, and dynamic `JournalDrawer` (replacing telemetry `Reliability %` with cozy qualitative prose) remain the committed `PLANNED` specification for Milestone 2B completion.
11. **Asymmetric Narrative Memories (`jun_advice`, `hollow_oak`)**: Confirm whether alternative quest paths (`jun_advice` vs `jun_reassure`; picking up the brass clapper directly at `hollow_oak` vs rescuing it with Toby) should uniformly unlock `mem_postcard_sent` and `mem_brass_clapper`, or intentionally yield route-distinct memories.
12. **Drafting Scope of *"Thousands of Little Stories"***: Confirm framing this tagline in Section 01 & Section 12 as the **intersection** of (a) emergent daily autonomy, NPC memories & gossip + (b) expanding modular personal stories, hobbies, market life, and districts over time.

---

## 6. Recommended Additions & Removals for `/GAME_DESIGN.md`

- **Remove / Relocate Out of `/GAME_DESIGN.md`**:
  - Raw Three.js roughness decimals & lighting hex codes (`#F5CFA0`, `#6F7FA8`) -> link `docs/art-direction/VISUAL_IDENTITY.md`.
  - Outdated `9:00 PM` Dusk cutoff and static-only framing of resident schedules & single-tier trust.
- **Add to `/GAME_DESIGN.md`**:
  - Complete **5-Status Lifecycle tagging** across all 12 sections (`IMPLEMENTED`, `IN PROGRESS`, `PLANNED`, `LONG-TERM VISION`, `UNDECIDED`).
  - Explicit **5–15 minute curiosity-driven, zero-punishment session philosophy**.
  - **Connected Reward, Progression & Player Motivation** chapter bridging activities, bonds, memories, collectibles, stories, and evolving town spaces without inventing unapproved currencies/numbers.
  - Full documentation of shipped simulation (`traits`, `needs`, `emotions`, `encounters`, `weather`, `seasons`, `benches`, `carryable props`, `water play`, `third-party gossip`) AND planned roadmap pillars (`Milestone 2B P3–5`, `Orchard gameplay`, `Gardening/Fishing/Cooking/Decorating/Photography`, `Interiors`, `Sunday Market`, `Pets`, `Community Projects`, `Optional Cloud Saves`).
