# GAME_DESIGN.md — LITTLE SOMEWHERE Game Design Document

**Title**: **LITTLE SOMEWHERE**  
**Genre**: Cozy Isometric 3D Neighborhood Life Simulation  
**Tagline**: *“A little world filled with thousands of little stories.”*  
**Authoritative Visual Source of Truth**: [`docs/art-direction/VISUAL_IDENTITY.md`](docs/art-direction/VISUAL_IDENTITY.md) (**PREMIUM HANDCRAFTED STORYBOOK DIORAMA**)

---

## Lifecycle Status Key

To keep shipped reality, active work, and future product vision unmistakably separate across this document, every major system is labeled using five strict lifecycle tags:

- **`IMPLEMENTED`**: Live and playable in the current build today.
- **`IN PROGRESS`**: Partially built across completed earlier phases and pending later phases (e.g., Milestone 2B overall; Fern Hollow Orchard).
- **`PLANNED`**: Committed near-to-mid-term design direction not yet implemented in gameplay code.
- **`LONG-TERM VISION`**: Horizon systems and broader world growth requiring future architecture and scoping.
- **`UNDECIDED / REQUIRES DESIGN DECISION`**: Open rules, parameters, or unlock details intentionally left unfixed for future design sessions.

---

## 01. Game Overview

**LITTLE SOMEWHERE** is a gentle, character-driven 3D neighborhood life simulation set in a miniature, sunlit storybook town. Rather than turning daily life into a farming spreadsheet, shopkeeping business, timer race, or checklist chore simulator, play revolves around **stepping into a living community, paying quiet attention, nurturing authentic friendships, sharing everyday creations, and watching small kindnesses reshape the world around you**.

### Target Player Experience & Session Identity
- **Mobile-First & Desktop-Ready (`IMPLEMENTED`)**: Built for comfortable one-handed or thumbstick play on mobile browsers (`390px+`) as well as keyboard-and-mouse play on desktop (`1440px+`).
- **Curiosity-Driven 5–15 Minute Sessions (`IMPLEMENTED` safety / `PLANNED` hooks)**: Designed so a player can drop in for a cozy ten-minute break—check the morning mail, notice the day’s sky and puddles, help or chat with neighbors, tend a hobby, and save—or linger seamlessly through an unhurried in-game day from morning into lantern dusk.
- **Currency-Free, Anti-Grind Identity (`IMPLEMENTED` foundation / `PLANNED` rule)**: **LITTLE SOMEWHERE** has **no coins, no shop economy, no daily login streaks, and no failure timers**. Progress comes from curiosity, thoughtfulness, shared creations, personal stories, and community care.

---

## 02. Design Pillars

1. **A Living, Autonomous Neighborhood** (`IMPLEMENTED` core → `PLANNED` growth)  
   Residents are not static quest kiosks waiting on fixed tiles. They have personalities, internal energy and mood rhythms, weather reactions, favorite benches, and unscripted conversations with one another that carry forward whether the player watches or walks past.
2. **Relationships Shape Community Life** (`IMPLEMENTED` matrix → `PLANNED` deep unlocks)  
   Bonds between the player and each resident—and between residents themselves—govern warmth, trust, gossip, shared activities, and conflict resolution. Relationships unlock genuine experiences, stories, invitations, and shared crafts rather than acting as empty heart counters.
3. **Stories Emerge & Interconnect** (`IN PROGRESS` Bell + prototype arcs → `PLANNED` Phases 3–4)  
   Major town mysteries, personal side stories, neighborhood friction, and small daily remarks weave together. Multiple compassionate routes resolve conflict, and residents remember who helped, who spoke gently, and what traveled along the cobblestone rumor mill.
4. **A World That Changes With Care** (`IMPLEMENTED` Bell & atmosphere → `PLANNED` projects & spaces)  
   Meaningful care leaves visible, lasting traces across the 3D diorama—blooming sills, flowing water, open café tables, dusk festoon lanterns, seasonal foliage, and future neighborhood improvements—alongside subtle daily touches residents initiate themselves.
5. **Cozy Agency Without Punishment** (`IMPLEMENTED` clock & persistence → `PLANNED` hobbies)  
   Time advances only while playing; there are zero starvation meters, zero stamina blackouts, zero missed-day penalties, and zero real-world FOMO traps. A player returning after a week steps back onto a welcoming porch at their own pace.

---

## 03. Core Player Loop & Everyday Agency

### 3.1 The Five-Beat Daily Rhythm (`IMPLEMENTED`)
Every day unfolds cleanly across **6:00 AM – 9:30 PM** (`minuteOfDay` `360–1290`), opening on Day 1 at **8:15 AM** and waking after rest at **8:00 AM**:
1. **Wake & Check In**: Step onto the porch of *Willow Step Cottage* and check the *Willow Mailbox* when its flag is raised, or glance at the *Neighborhood Noticeboard* for tomorrow’s weather forecast and town updates.
2. **Wander & Observe**: Stroll the cobblestone lanes across **Morning**, **Afternoon**, **Golden Hour**, and **Lantern Dusk** (or gently nudge the clock ahead with **`+2h`** in the HUD/Journal when sampling a later hour).
3. **Engage & Lend a Hand**: Talk with residents, listen to their moods and third-party news, rest on shared cedar benches, carry helpful neighborhood props to neighbors who appreciate them, toss wishing coins into the plaza fountain, or skip pebbles across Mirror Pond.
4. **Shape the Neighborhood**: Advance stories, ease tensions between neighbors, and watch physical 3D details across the square respond to community care.
5. **Rest & Persist**: Interact with your cottage porch door whenever you are ready to wind down (`Rest Until Morning`); friendships, memories, story progress, and town transformations carry forward into tomorrow’s fresh weather and season day.

### 3.2 Today’s Playable Player Actions (`IMPLEMENTED`)
- **Smooth Locomotion & Tap-to-Walk**: Analog movement (`WASD`/Arrows on desktop, touch-only `VirtualJoystick` on touch screens) with walk (`Alt`) / run / sprint (`Shift`), cambered cedar bridge traversal, plus 33-node A* tap-to-walk toward ground points, props, benches, and residents.
- **Shared Bench Sitting**: Sit and rest on **5 handcrafted cedar benches** (East Plaza, West Plaza, Gazebo, Mirror Pond South, Fern Hollow Orchard). Benches are shared community spaces: if a resident has claimed a bench to read, sketch, or rest, the seat yields politely until free.
- **Carrying & Sharing Daily Neighborhood Props**: Pick up, cradle-carry, set down (`[G]`), or hand-deliver **5 shared lane props** (`Copper Water Pail`, `Warm Loaf & Herb Basket`, `Pastel Street Chalks`, `Chamomile Tea Tray`, `Twine-Tied Lane Parcel`), each with resident `likedBy` preferences that boost warmth, reliability, and mood.
- **Landmark Water Micro-Interactions**: Once the plaza fountain flows, toss lucky copper coins (`fountain_wish`) with water splash rings, submerged glinting coins, and a saved memory; at Mirror Pond, skip flat stones across the water (`skip_stone`)—or skate pebbles across winter shore frost.

### 3.3 Planned Everyday Cozy Activities (`PLANNED`)
To broaden relaxed daily agency without turning **LITTLE SOMEWHERE** into a farming grind, shop-management game, or checklist chore simulator, everyday hobbies are planned in two clear waves—all feeding naturally into gifts, relationships, stories, collectibles, and world warmth:

#### Priority Hobbies After Foundation & Interiors (`PLANNED` — First Wave)
1. **Gardening** *(Priority #1)*: Today represented only visually through Mina’s greenhouse bloom stages and the Bell storyline’s cottage moon-petal boxes. Planned gameplay introduces calm, low-pressure tending of cottage window boxes, small soil beds, and orchard botanicals—growing herbs, blossoms, and seasonal ingredients at a friendly non-withering pace for cooking, sharing, and brightening the lane.
2. **Cooking & Sharing Meals** *(Priority #2)*: Today present in sourdough loaves, chamomile tea, and the Mina/Clara herb-loaf story. Planned gameplay turns *Willow Step Cottage*’s kitchen and neighborhood hearth spaces into warm creative stations where harvested herbs, orchard fruit, and recipes from neighbors become shareable loaves, teas, and small treats gifted purely out of hospitality.

#### Broader Activity Vision (`PLANNED` / `LONG-TERM VISION` — Subsequent Waves)
3. **Fishing** *(Broader Vision)*: Currently represented ambiently by swimming koi and pebble skipping in Mirror Pond. Future play adds unhurried rod fishing along Mirror Pond, the pier, and West Brook for discovery, pond ecology notes, and seasonal recipe/gift pairings—never stressful stamina gauges or profit quotas.
4. **Decorating** *(Broader Vision)*: Allows arranging earned keepsakes, framed photos, craft pieces, planters, and cozy furniture across enterable cottage interiors and porch spots so a player’s home reflects the friendships and stories they lived through.
5. **Photography** *(Broader Vision)*: A tactile storybook camera view letting players frame golden-hour lanterns, rainy puddle reflections, blooming planters, and candid resident gatherings into keepsake snapshots saved in the Pocket Journal and displayed at home.
6. **Community Gatherings & Helping** *(Extending `IMPLEMENTED` favors into `PLANNED` / `LONG-TERM VISION`)*: Expanding one-on-one prop deliveries and the Gazebo Bell celebration into seasonal neighborhood projects and optional **Sunday Market** mornings.

---

## 04. World, Neighborhood & Locations

The neighborhood is centered on a single cozy district (`willow_square`) bordered by Mirror Pond in the south and the newly built orchard clearing in the north (`33` connected A* navigation nodes across cobblestone lanes, meadows, and bridges).

### 4.1 Willow Lane & Fountain Square (`IMPLEMENTED`)
- **Willow Step Cottage** *(SW)*: The player’s shingled cottage with a stone porch (`Rest Until Morning` door trigger) and the **Willow Mailbox** (flag lifts on unread morning notes).
- **Sunlit Fountain Plaza** *(Center)*: Cobblestone heart of town housing the **Mossy Stone Fountain** (starts dry and leaf-clogged; flows with four bronze spouts and accepts lucky coins once repaired) and the **Neighborhood Noticeboard** (live tomorrow forecast, bakery notes, and town flyers).
- **Old Bell Gazebo** *(N-Center)*: Carved cedar pavilion crowning the plaza promenade and holding the **Silent Brass Bell**; clears of ivy, gains a marigold festival ribbon, and swings/chimes interactively once restored.
- **Hearth & Crumb Bakery** *(NW)*: Clara’s warm sourdough bakery; displays seasonal morning/sunny pastry baskets and opens sunlit outdoor café tables upon reconciliation.
- **Linden Book Nook** *(W)*: Nora’s bookshop keeping town almanacs, donated paperbacks, and festival ribbons.
- **Sora’s Tea Cart** *(W-Plaza)*: Lavender-canopied plaza cart where Sora steeps chamomile-pear blends.
- **Copperwheel Cottage** *(NE)*: Arthur’s workshop porch with brass clockwork gear details and an early-lighting oil lamp in rain or fading daylight.
- **Sunbeam Greenhouse** *(E)*: Mina’s glass flower house whose interior botanical density visually matures alongside town care (`Stage 1–3`).
- **Pinecone Woodshop** *(SE)*: Barnaby’s cedar carpentry shop and chimney hearth (puffing smoke wisps softly with the hour).
- **Mirror Pond, Cedar Footbridge, West Brook, Pier & Hollow Oak** *(S)*: Flowing water basin spanned by a cambered cedar footbridge, inhabited by koi carp, water lilies, reeds, and skimming dragonflies, with a docked cedar pier sailboat and the mossy **Hollow Oak** hiding a brass secret.

### 4.2 Expansion Spaces & Interiors
- **Fern Hollow Orchard** *(N, beyond the gazebo promenade)* — **`IN PROGRESS`**:
  - *Built Today (`IMPLEMENTED`)*: Stone-and-cedar entrance archway with a carved wooden sign, 6 crabapple trees (season-tinted alongside the town grove), harvest ladder, wooden crates, woven bee skep, 5 connected navigation nodes, the `orchard` landmark zone, and the neighborhood’s 5th walkable cedar bench (`Fern Hollow Orchard Bench`).
  - *Pending (`PLANNED`)*: Resident schedules (prioritizing **Clara** and **Mina**), harvestable crabapple/botanical interactions, bee-skep & honey/gardening play, and orchard stories—kept intentionally free of premature resident spawns until gameplay arrives.
- **Enterable & Customizable Cottage Interiors** — **`PLANNED`**:
  - Stepping inside *Willow Step Cottage* (currently a porch rest prompt) as well as neighbors’ shops and cottages (`Hearth & Crumb`, `Copperwheel`, `Linden Book Nook`, `Sunbeam Greenhouse`), turning homes into cozy visit destinations, cooking/decorating spaces, and relationship-earned sanctuaries.
- **Additional Neighboring Districts (`REGIONS`)** — **`LONG-TERM VISION`**:
  - The world map registry (`REGIONS`) is structured to connect future districts beyond `willow_square` (lanes, brookside clearings, coastal/hillside paths) as long-term narrative horizons expand.

---

## 05. Characters & Daily Lives

### 5.1 The Founding Neighborhood Cast (`IMPLEMENTED` — Built to Scale)
The current neighborhood is home to **9 founding residents** (`RESIDENT_ORDER`). Rather than acting as a fixed ceiling, the cast is an expandable registry designed to accommodate additional neighbors in future milestones alongside orchard and district growth (`PLANNED` / `LONG-TERM VISION`).

| Resident | Role | Home / Anchor | Personality & Liked Shared Props |
| :--- | :--- | :--- | :--- |
| **Clara** | Sourdough Baker | Hearth & Crumb Bakery | Warm-hearted, proud, secretly misses the bell (`rosemary_basket`, `tea_tray`) |
| **Arthur** | Clockmaker & Tinker | Copperwheel Cottage | Gentle perfectionist softening after an old rift (`tea_tray`, `water_pail`, `lost_parcel`) |
| **Mina** | Botanist & Florist | Sunbeam Greenhouse | Optimistic, patient; reads moods in blooms (`water_pail`, `rosemary_basket`, `tea_tray`) |
| **Jun** | Letter Carrier | Post Lane / Square | Cheerful, observant keeper of postcards (`lost_parcel`, `rosemary_basket`) |
| **Barnaby** | Retired Carpenter | Pinecone Woodshop | Gruff-warm craftsman proud of every cedar beam (`rosemary_basket`, `lost_parcel`, `water_pail`) |
| **Sora** | Violinist & Tea Brewer | Tea Cart / Caravan | Dreamy listener attuned to twilight harmonics (`tea_tray`, `rosemary_basket`) |
| **Toby** | Sketchbook Artist | Mirror Pond / Linden Loft | Quiet outdoor observer noticing glints & reflections (`chalk_bundle`, `water_pail`) |
| **Nora** | Bookshop Keeper | Linden Book Nook | Wry, wise chronicler of town almanacs (`tea_tray`, `chalk_bundle`) |
| **Pip** | Chalk-Note Messenger | Bakery Upstairs | Bright-eyed youngster who has never heard the town bell (`chalk_bundle`, `rosemary_basket`) |

### 5.2 Inner Simulation & Autonomous Daily Life (`IMPLEMENTED`)
- **4-Phase Anchor Routines + Utility Decisions**: Every resident holds morning, afternoon, golden-hour, and dusk anchor spots (including **Clara & Arthur’s shared Golden Hour rendezvous** at the Gazebo Steps once reconciled), blended dynamically with `RESIDENT_EXTRA_ACTIVITIES` scored deterministically by time, weather, traits, and unlocked world flags.
- **Personality & Weather Traits (`ResidentTraits`)**: `sociability`, `outdoorsiness`, `morningLark`, `curiosity`, `temperament`, `greetingDistance`, and distinct `rainBehavior` (`shelter_home`, `visit_cafe`, `umbrella_stroll`) shape where residents go when morning mist lingers or rain falls.
- **Soft Internal Needs & 10 Emotions**: Behind-the-scenes `NpcNeeds` (`energy`, `social`, `hunger`, `fulfillment` — never punishing meters exposed to the player) gently nudge residents toward bakery visits, benches, and chats, and drive 10 expressive emotions (`happy`, `sad`, `excited`, `tired`, `frustrated`, `angry`, `relaxed`, `embarrassed`, `curious`, `surprised`) stabilized by 35-minute hysteresis locks.
- **17 Expressive Poses & Late-Dusk Wind-Down**: Residents walk, wave, sit on shared benches, converse in circles, tend shops (`work`), sketch/read, play violin (`music`), admire blooms/fountains, and drift home toward their porches after **8:25 PM** (`1225+`).
- **Spontaneous Greetings**: Strolling within a resident’s tier-modulated greeting distance prompts them to look over, wave, and share a brief floating micro-greeting—while spending time near `Close` or `Kindred` friends gently uplifts their social warmth.

---

## 06. Relationships, Memory & Social Systems

### 6.1 Player-to-Resident Bonds (`IMPLEMENTED` Core / `PLANNED` Deep Unlocks)
- **Continuous Affinity & Cozy Qualitative Tiers**: Each bond tracks continuous `affinity` (`0–100`) mapped to **5 hearts** and five social tiers (**Stranger** → **Acquaintance** → **Friend** → **Close Friend** → **Kindred Spirit**), shown both with an icon and tier label beside the resident’s name in conversation.
- **Reliability, Friction & Honest Repair**:
  - A `reliability` score (`0–100`), `negativeCount`, `favorsCompleted`, and `giftsGiven` track dependability and care.
  - Blunt or tactless dialogue choices sting affinity and reliability and leave a neighbor briefly **guarded** (shorter greeting range, cooler posture); heartfelt **`Make Amends`** choices let the player apologize sincerely and soften the air cleanly without softlocking any story.
  - A **`DAILY_SMALLTALK_AFFINITY_CAP` (`20`)** prevents repetitive Day 1 small-talk farming while keeping meaningful gifts, favors, and story beats genuinely rewarding.
- **Milestone Celebration**: Reaching a new heart, relationship tier, story milestone, or memory gently pulses/bounces the resident’s avatar inside the dialogue sheet.

### 6.2 Meaning & Unlocks Behind Relationships (`IMPLEMENTED` cues → `PLANNED` unlocks)
Relationships are designed to **open lived experiences, not simply raise numbers**:
- **Implemented Today (`IMPLEMENTED`)**: Deeper tiers warm greetings and farewells, widen spontaneous wave distance, unlock personal side stories (`1+` heart / acquaintance warmth), trigger affectionate third-party neighbor remarks, and soothe residents when you linger nearby.
- **Planned Experience Unlocks (`PLANNED`)**: As bonds deepen toward `Friend`, `Close Friend`, and `Kindred Spirit`, relationships will organically unlock:
  - More personal, candid dialogue and deeper multi-stage character stories.
  - Reciprocal neighbor gifts, handwritten letters, and home keepsakes.
  - Invitations into cottages and workshops, shared everyday activities (cooking together, tending greenhouse/orchard beds, sketching/tea moments), and teaching of new recipes or hobby techniques.
  - Special community favors and cooperative neighborhood improvements.
- *Design Boundary (`UNDECIDED / REQUIRES DESIGN DECISION`)*: Exact tier-by-tier unlock tables and affinity thresholds per individual unlock remain open for dedicated design definition.

### 6.3 NPC-to-NPC Bonds & Autonomous Social Encounters (`IMPLEMENTED`)
- **Live Pairwise Social Matrix (`NpcNpcRelation`)**: Tracks pairwise `affinity` (`-50..100`), `tension` (`0..100`), `sharedTags`, and five **NPC-NPC tiers** (`Estranged`, `Guarded`, `Acquainted`, `Warm`, `Confidant`). Baseline bonds start warm across close pairs (Clara & Mina, Arthur & Barnaby, Nora & Sora, Pip & Toby) and start estranged between **Arthur & Clara** (`affinity: -20`, `tension: 75`).
- **Autonomous 2–3 Neighbor Circles**: Unbusy nearby residents pause together for ~16-minute encounters—chatting, trading gardening/baking tips, or reminiscing—which boost their mutual affinity, soothe tension, fulfill work/social needs, and record bounded `WorldEventRecord` notes.
- **Generalized Tension Suppression**: Any pair whose mutual `affinity < 0` or `tension >= 45` cannot form casual autonomous chats—making **Arthur & Clara’s reconciliation** (and conflict mediation with Barnaby) visibly change who gathers together in the plaza.

### 6.4 Memory, Hearsay & Gossip Architecture (`IN PROGRESS` → `PLANNED`)
- **Implemented Today (`IMPLEMENTED`)**:
  - **Pocket Journal Memories**: 18 curated player memories (`mem_arrival`, Bell milestones, 4 side stories, fountain wish, pond skip) preserved with day and time phase.
  - **Third-Party Player-Relation Gossip (`selectThirdPartyGossipSubject`)**: Residents comment naturally on how things stand between the player and another neighbor—offering gentle encouragement when friction leaves someone guarded, tips about favorite things at `Acquaintance`/`Friend`, or warm praise at `Close`/`Kindred`.
- **Planned Milestone 2B Phase 3 Depth (`PLANNED`)**:
  - **Per-NPC `npcMemories` (No Omniscient Hive-Mind)**: Replacing global event awareness so each resident holds only what they personally witnessed, heard directly from the player, or learned secondhand from another neighbor—tracking source reliability (`firsthand`, `secondhand`, `rumor`), hop limits, and subtle personality-colored distortion during `ActiveSocialEncounter` gossip exchanges (`WorldState v4`).

---

## 07. Dialogue & Storytelling System

Conversations are driven by the declarative `dialogueEngine.ts` selector rather than static loops (`IMPLEMENTED` core → `PLANNED` Phases 3–4 upgrades):

1. **9 Prioritized Topic Categories**:
   `quest_milestone` → `conflict_reconciliation` → `personal_story` → `event_reaction` → `relationship_tier` → `emotion_reaction` → `npc_gossip` → `weather_season` → `daily_slice`.
2. **Anti-Repeat Memory (`topicHistory` & `lastTopicByResident`)**: Ensures consecutive talks with the same neighbor rotate cleanly through distinct conversations and never lock on repetitive filler unless a vital quest beat awaits.
3. **Concurrent Choice & Prop Injection**: Story milestones (`buildConcurrentQuestChoices`), carried prop deliveries (`deliver_<item>_to_<id>`), and `Make Amends` repairs merge smoothly onto the current dialogue node so environmental chatter never blocks narrative progress.
4. **Live Contextual Recognition**: Opening lines adapt seamlessly to un-met introductions, current time phase, weather, 10 resident emotions, relationship tiers, guarded tension, seated bench remarks, recent social encounters, and whether the player is carrying something that neighbor loves.
5. **Planned Engine Extensions (`PLANNED` Phases 3–4)**: Wiring declarative predicates for per-NPC memories (`requiresNpcMemoriesAny` / `excludesNpcMemories`) and multi-stage storyline progress (`requiresStoryline`), forward hooks already stubbed in `dialogueEngine.ts`.

---

## 08. Narratives, Storylines & Events

### 8.1 Main Storyline — *The Silent Gazebo Bell* (`IMPLEMENTED`)
Three autumns ago, a stormy harvest cracked the gazebo beam. Proud words passed between **Clara** and **Arthur**, and Arthur quietly unpinned the brass bell clapper, wrapping it in blue linen inside the Hollow Oak root while creeping ivy overtook the rafters.
- **Open Multi-Route Discovery**: Triggered by **Pip** or **Nora** (`heardBellMystery`). Players clear the rafters with **Barnaby’s** cedar ladder, recover the clapper via **Toby** or directly at the **Hollow Oak**, mend **Barnaby’s** plaza fountain valve, plant moon-petals with **Mina**, and soften the silence through multiple empathetic paths:
  - *Postcard Route*: Recover the unmailed coastal postcard from **Nora** and help **Jun** deliver it gently to **Arthur**.
  - *Chamomile Tea Route*: Ask **Sora** to brew chamomile-pear tea for **Arthur**.
  - *Clara Mediations*: Reconnect via **`shared_baking`** (warm sourdough without scorekeeping) or **`gentle_truth`** (sharing how carefully Arthur kept the clapper).
  - *Festival Restoration*: Bring clear rafters and recovered clapper to **Arthur** (`festival_ring`) to re-pin the brass bell and chime it across town.

### 8.2 Personal Side Stories & Conflict Mediation (`IMPLEMENTED` Prototype → `PLANNED` Phase 4 Engine)
- **4 Implemented Prototype Side Stories (`sideFlags`)**:
  1. **Pip & Nora’s *Willow Lane Zine, Issue #1*** (chalk drawings & stitched pocket book).
  2. **Mina & Clara’s *Lemon-Thyme Sourdough*** (grafted greenhouse herbs baked into shared loaves).
  3. **Sora & Barnaby’s *Cedar Music Stand*** (notched cedar stand keeping pond violin sheets steady in the breeze).
  4. **Jun & Arthur’s *True on the Route*** (balancing Jun’s mist-slowed courier pocket watch).
- **2 Implemented Conflict Mediation Beats**: Helping ease unspoken hesitation between **Arthur & Clara** (`conflict_arthur_clara_tension`) and proud craftsmanship friction between **Barnaby & Arthur** (`conflict_barnaby_arthur_rafters`).
- **Planned Storyline Runtime (`PLANNED` Milestone 2B Phase 4 — `storylines.ts`)**: Elevating side narratives from two-step boolean flags into a modular multi-stage storyline framework with alternative outcomes, neighbor witnesses, and dynamic Journal reflection.

### 8.3 Narrative Hygiene Note — Two Investigated Story-Memory Asymmetries (`DOCUMENTED RECOMMENDATION`)
Code inspection confirmed two cases where alternate branches resolve the exact same narrative beat yet produce inconsistent memory unlocks:
1. **Postcard Delivery (`src/game/narrative.ts` `quest_jun_postcard`)**: Choosing `jun_reassure` and choosing `jun_advice` both transition to the identical `jun_relieved` response and set `deliveredPostcard: true` (`isStoryMilestone: true`), yet `jun_reassure` unlocks `mem_postcard_sent` (*"Delayed Delivery"*) while `jun_advice` omits it (`dialogue.test.ts` currently asserts that baseline). Unlike `quest_pip_intro` and `quest_nora_postcard`—where both sibling choices intentionally unlock the shared beat memory—this is an accidental omission.
2. **Hollow Oak Brass Clapper (`src/game/narrative.ts` `toby_clapper` vs. `src/game/actions.ts` `hollow_oak`)**: Asking Toby to rescue the clapper unlocks `mem_brass_clapper` (*"The Hidden Brass Clapper"*), whereas inspecting the Hollow Oak directly after `heardBellMystery` sets `foundBrassClapper: true` without awarding `mem_brass_clapper`—and hides Toby’s milestone afterward, permanently locking that memory.

**Design Recommendation**: Because both pairs represent the same core story milestones rather than meaningfully divergent story outcomes, both alternate paths should consistently unlock `mem_postcard_sent` and `mem_brass_clapper` respectively (tailoring summary wording if discovered solo vs. with Toby) during a future Milestone 2B cleanup pass.

### 8.4 Mailbox Letters, Weekly Sunday Market & Seasonal Events (`IMPLEMENTED` / `PLANNED` / `LONG-TERM VISION`)
- **Willow Mailbox (`IMPLEMENTED` baseline → `PLANNED` growth)**: Today delivers three milestone letters (`Welcome Committee`, Jun’s Day 2 clue note, and Clara & Arthur’s post-bell note). Planned expansion adds recurring neighbor letters, seasonal seeds, recipe notes, and Sunday Market notices.
- **The Sunday Market (`LONG-TERM VISION` / `PLANNED` calendar hook)**:
  - A recurring weekly plaza gathering where neighbors set up cheerful stalls to share home-baked goods, greenhouse cuttings, crafts, stories, and keepsakes—completely **currency-free** (rooted in gifts, neighborly exchange, and community sharing, with exact swap rules `UNDECIDED`).
  - **Separate 7-Day Rhythm Preserving 10-Day Seasons**: Seasons remain **10 days (`DAYS_PER_SEASON = 10`)** while any future Sunday Market runs on an independent **7-day weekday cadence** rather than reshaping seasonal length.
  - **Zero-Punishment Guarantee**: Participation is always optional, never tied to login streaks, never costs permanent missed collectibles, and recurs cleanly so a player who rests past or skips a Sunday loses nothing forever.
- **Seasonal Festivals (`LONG-TERM VISION`)**: Shared community celebrations marking seasonal turns, future Orchard autumn gatherings, and milestone town moments.

---

## 09. Environmental Systems & World Reactivity

The 3D neighborhood uses a deterministic **5-Layer Environment Composer** (`environment.ts` + `reactiveProps.ts` + `waterShaders.ts`) so the world continuously tells stories without cluttering the HUD:

1. **Layer 1 — Time of Day (`IMPLEMENTED`)**: Seamless key-light elevation curves, shadow lengthening, and hearth window/lantern glow across **Morning** (`6:00 AM–11:30 AM`), **Afternoon** (`11:30 AM–4:00 PM`), **Golden Hour** (`4:00 PM–6:30 PM`), and **Lantern Dusk** (`6:30 PM–9:30 PM`). *(Exact sky/sun hex specifications live solely in `VISUAL_IDENTITY.md` and the renderer.)*
2. **Layer 2 — Seeded Dynamic Weather (`IMPLEMENTED`)**: Day 1 opens in crisp **`Sunlit`** clarity; Day 2+ rolls deterministically from `simSeed` across **`Sunlit`**, **`Breezy`**, **`Misty Morning`** (gently lifting to sunlit after `10:30 AM`), and **`Light Rain`** (activating instanced rain streaks, damp stone reflections, lingering next-morning rain puddles until `10:00 AM`, earlier porch lamps, and resident rain behaviors). Tomorrow’s forecast posts live on the plaza **Noticeboard**.
3. **Layer 3 — 10-Day, 4-Season Cycle (`IMPLEMENTED`)**: Cycles cleanly through **Spring → Summer → Autumn → Winter** every 10 days—tinting meadow grass, town grove canopies, and Fern Hollow Orchard trees; edging Mirror Pond with clear winter ice-sheen and slowing winter carp; and gating spring/summer butterflies and dusk fireflies.
4. **Layer 4 — Player-Driven World Transformations (`IMPLEMENTED` Bell → `PLANNED` Projects & Decor)**:
   - *Implemented Today (`8` visible Bell transformations)*: Cottage window-box blooms (`0–3` stages), restored stone fountain flow & animated droplet arcs, cleared Gazebo ivy rafters, recovered Hollow Oak glint, glowing overhead plaza festoons, open Hearth & Crumb outdoor café tables with sourdough, Nora’s marigold festival ribbon + Clara/Arthur meeting together, and interactive swinging/chiming Gazebo Bell.
   - *Planned (`PLANNED`)*: Post-Bell **Community Projects** (collaborative town improvements whose built results remain permanently in the square/orchard) and **Exterior/Interior Decorating** keepsakes.
5. **Layer 5 — Autonomous NPC & Ambient World Touches (`IMPLEMENTED`)**: Clara’s outdoor sourdough basket on sunny/morning windows, Mina’s 3-stage greenhouse interior blossoms, expanding plaza Noticeboard flyers (`1–3`), Arthur’s rain/golden/dusk porch oil lamp, gentle chimney hearth smoke wisps from Willow Step Cottage plus scheduled puffs from Hearth & Crumb Bakery, Copperwheel Cottage, and Pinecone Woodshop, circling koi, and dragonflies over Mirror Pond.

---

## 10. Visual, Audio & Interface Direction

### 10.1 Visual Craft & Identity (`IMPLEMENTED`)
- **Official Direction**: **PREMIUM HANDCRAFTED STORYBOOK DIORAMA** — detailed in full in [`docs/art-direction/VISUAL_IDENTITY.md`](docs/art-direction/VISUAL_IDENTITY.md) and audited via [`docs/art-direction/VISUAL_QUALITY_STANDARDS.md`](docs/art-direction/VISUAL_QUALITY_STANDARDS.md).
- **Miniature Tactile Feel**: `28°` elevated isometric framing, matte polymer-clay plaster contrasting with smoother glazed ceramics, glass panes, warm cedar timber, and IBL-lit brushed brass; radial contact shadows keeping every cottage, tree, and villager softly grounded on all devices (including software WebGL).

### 10.2 Mobile-First & Desktop Interface (`IMPLEMENTED` → `PLANNED` Phase 5 Journal Upgrade)
- **Uncluttered Diorama Viewport (`>= 85%` open play space)**: Crisp linen HUD cards (`#FAF5EC`) paired with `Fraunces` headers, `Plus Jakarta Sans` prose, and `JetBrains Mono` (`tabular-nums`) clocks; zero `backdrop-filter` stalls over WebGL; `>= 44×44px` touch hitboxes.
- **Touch & Desktop Parity**: Touch-only `VirtualJoystick` appears automatically on touch/coarse-pointer devices while desktop shows keyboard hints (`[E]`, `[G]`, `[J]`, `[M]`, `[Esc]`), zoom controls, and `+2h` advance.
- **Compact Storybook Dialogue & Prop Sheets**: Bottom-anchored backdrop-dismissible dialogs displaying the resident’s coat-colored avatar (pulsing on milestones), relationship-tier icon, `0–5` hearts, emotion + tier label, tone-styled choices (`Gift` / `Blunt` / `Reply`), and clean close actions.
- **Pocket Journal (`Neighbors`, `Story & Memories`, `World & Time`)**:
  - *Implemented Today*: Neighbor summaries with live location/activity, relationship tier & mood, storyline step hints, chronological saved Memories, recent lane moments, weather forecast, and `+2h` button.
  - *Planned Milestone 2B Phase 5 Cleanup (`PLANNED`)*: Replacing the hardcoded React storyline checklists and clinical **`Reliability %`** telemetry readout with dynamic storyline records, warmer qualitative trust prose, and per-neighbor memory/rumor highlights—expanding naturally in future milestones into a calm, **non-completionist discovery & collectible keepsake album**.

### 10.3 Procedural Web Audio (`IMPLEMENTED`)
Zero-dependency Web Audio synthesizer (`cozyAudio`, toggleable via HUD or `[M]`): soft triangle footsteps, gentle UI taps, varied character dialogue tones, rising arpeggiated memory chimes, resonant harmonic brass Gazebo Bell strikes, and multi-droplet fountain/pond splashes.

---

## 11. Reward, Progression and Player Motivation

> *This chapter defines why players keep returning to **LITTLE SOMEWHERE** without coins, grind loops, or punishment timers.*

### 11.1 Currency-Free Motivation & 5–15 Minute Session Rhythm
**LITTLE SOMEWHERE** rejects monetary economies, shop prices, daily login bonuses, energy depletion bars, and checklist obligations. Instead, players return for **short, unhurried 5–15 minute curiosity sessions** (with full freedom to play longer) driven by living anticipation:
- *What kind of sky or seasonal tint greeted the square today?*
- *Did Clara or Mina mention what happened after yesterday’s conversation or gift?*
- *Are new buds ready in the cottage planters or greenhouse to harvest and bake into something warm?*
- *Who is sharing a bench or trading friendly news near Mirror Pond—or setting up at this week’s Sunday Market?*

**Anti-Punishment Guarantees (`IMPLEMENTED` foundation)**:
- **Zero offline decay (`Date.now()`-free)**: Time never marches away while the browser is closed; nothing withers or leaves if you step away for weeks.
- **Instant Save & Flexible Pacing**: Continuous dirty-flagged `localStorage` autosave (`little_somewhere_world_v1`) plus `+2h` clock advancement let short sessions reach Golden Hour or Lantern Dusk cleanly.

### 11.2 The Connected Cozy Reward Loop
Every player action connects across four mutually reinforcing pillars rather than isolated counters:

```
  1. EVERYDAY ACTIVITIES & OBSERVATION
     • Talk, sit on benches, deliver shared plaza props, wish & skip stones (`IMPLEMENTED`)
     • Tend plants & garden boxes, cook & share recipes (`PLANNED` Priority)
     • Fish Mirror Pond, frame photographs, decorate home & porch (`PLANNED` / Vision)
                    │
                    ▼  produces fresh herbs, dishes, photos, shared moments & favors
  2. LIVING RELATIONSHIPS & SOCIAL WEB
     • Deeper Affinity Tiers, Reliability & Guarded Repair (`IMPLEMENTED`)
     • Third-Party Gossip (`IMPLEMENTED`) & Per-NPC Memories (`PLANNED` Phase 3)
     • Tier-Earned Experiences: candid stories, recipes, home visits, shared hobbies (`PLANNED`)
                    │
                    ▼  opens trust, personal quests, keepsakes & town initiatives
  3. PERSONAL STORIES, COLLECTIBLES & KEEPSAKES
     • Gazebo Bell + Prototype Side Arcs (`IMPLEMENTED`) -> Multi-Stage Storylines (`PLANNED` P4)
     • Pocket Journal Memories (`IMPLEMENTED`) -> Celebration-Focused Discovery Records (`PLANNED`)
     • Persistent Personal Inventory: gifts, ingredients, crafted dishes, souvenirs (`PLANNED`)
                    │
                    ▼  inspires collaboration & lasting neighborhood care
  4. NEIGHBORHOOD EVOLUTION & WEEKLY/SEASONAL RHYTHMS
     • Visible Diorama Reactivity & NPC Micro-Touches (`IMPLEMENTED`)
     • Orchard Care, Enterable Interiors & Community Projects (`PLANNED`)
     • Optional Sunday Market, Seasonal Gatherings, Districts & Companions (`VISION`)
```

### 11.3 Personal Inventory vs. Shared Neighborhood Props (`PLANNED` Rule + `IMPLEMENTED` Boundary)
A strict boundary preserves the tactile charm of today’s plaza while enabling persistent personal progression:
- **Shared Neighborhood Tools & Props (`IMPLEMENTED` — Preserve Forever)**: The 5 existing plaza items (`Copper Water Pail`, `Warm Loaf & Herb Basket`, `Pastel Street Chalks`, `Chamomile Tea Tray`, `Twine-Tied Lane Parcel`) remain public environmental props resting on cobblestones and benches. Handing one to a resident places it in their care for the rest of the day and resets it to its `homePos` overnight upon rest (while items set down in the square or carried by the player stay where placed). **Do not fold these shared plaza props into pocket inventory.**
- **Player Personal Inventory (`PLANNED`)**: A distinct cozy satchel/pocket system reserved for **persistent personal possessions**—harvested flowers and seeds, freshly baked loaves and teas, caught pond discoveries, framed photographs, heartfelt neighbor gifts, and keepsakes—usable for gifting, cooking, decorating, community contributions, or Sunday Market sharing.

### 11.4 Pocket Journal Collectibles — Celebration Over Checklist (`IMPLEMENTED` Memories → `PLANNED` Albums)
Rather than pressuring completion percentages or trophy checklists, the Pocket Journal grows from its current **Memories (`18`)** into a warm personal keepsake book celebrating lived moments:
- **Recipes** *(baked, brewed, and taught by neighbors like Clara, Sora, and Mina)*
- **Flora & Seeds** *(greenhouse hybrids, cottage blooms, and Fern Hollow Orchard botanicals)*
- **Pond Discoveries & Catches** *(Mirror Pond & West Brook sightings and quiet catches)*
- **Photographs** *(player-framed snapshots of seasons, lanterns, and neighbor gatherings)*
- **Neighbor Gifts & Keepsakes** *(personal tokens exchanged at meaningful friendship milestones)*
- **Important Personal Memories** *(extending today’s timestamped storybook cards)*

### 11.5 Persistence & Optional Cloud Saves (`IMPLEMENTED` Local → `LONG-TERM VISION` Cloud)
- **Current Persistence (`IMPLEMENTED`)**: Browser `localStorage` (`little_somewhere_world_v1` + rolling upgrade backup) running `WorldState` schema `v3` (`v1 -> v2 -> v3` migrations, coordinate sanitization, `computeWorldSaveRevision()` autosave every 5s + `visibilitychange` / `pagehide`), deterministic `simSeed`. Planned `WorldState v4` adds `npcMemories` and `storylines`.
- **Optional Cloud Saves (`LONG-TERM VISION`)**: Future optional cross-device backup/sync so players may carry their neighborhood between mobile and desktop browsers. Cloud saves must **always remain 100% optional**, never gating offline or single-browser local play.

### 11.6 Open Progression & Reward Rules (`UNDECIDED / REQUIRES DESIGN DECISION`)
While the currency-free philosophy, inventory split, and qualitative unlocks are locked, exact balance details remain intentionally open for separate design sessions:
- Exact affinity thresholds and specific per-resident unlocks across `Friend`, `Close Friend`, and `Kindred Spirit` tiers.
- Inventory capacity, stacking, and organization layout (e.g., compact satchel vs. categorized pockets).
- Exact non-monetary exchange etiquette at **The Sunday Market** (free gifting, gentle recipe/item swaps, or community contribution pledges).
- Post-Bell cadence and cooperative structure for recurring **Community Projects**.
- Visual/narrative milestone celebrations inside the Pocket Journal when a seasonal or hobby collection grows.

---

## 12. Scope, Roadmap and Future Vision

### 12.1 Complete Feature & System Lifecycle Matrix

| Feature / System | Lifecycle Status | Scope & Design Notes |
| :--- | :---: | :--- |
| **Core World (`willow_square`), A* Nav (`33` nodes), `5` Shared Benches, Bridge & Water Play** | **`IMPLEMENTED`** | Cobblestone square, Fountain wishes, Mirror Pond stone-skipping, West Brook & Pier |
| **9 Founding Residents, Traits, Soft Needs, 10 Emotions, 17 Poses & Utility Routines** | **`IMPLEMENTED`** | Dynamic `RESIDENT_ORDER` built to expand cleanly beyond 9 |
| **Player–NPC Matrix (`5` Tiers, Hearts, `Reliability`, `Make Amends`, Daily Cap) & NPC–NPC Matrix** | **`IMPLEMENTED`** | Includes tier icons, greeting scaling, milestone pulse & tension-suppressed `2–3` NPC circles |
| **Declarative Dialogue (`9` Categories), Third-Party Player Gossip, *Silent Gazebo Bell*, `4` Prototype Side Arcs** | **`IMPLEMENTED`** | Plus `2` conflict topics, `5` daily-reset shared props, `3` mailbox letters, `cozyAudio` |
| **5-Layer Atmosphere (`4` Phases `6:00 AM–9:30 PM`, `4` Weathers, `10`-Day `4` Seasons, Reactive NPC Props)** | **`IMPLEMENTED`** | `WorldState v3` (`v1 -> v2 -> v3`), Noticeboard forecast, puddles, blooms, smoke wisps |
| **Milestone 2B Social & Story Depth** *(Phases 1–2 done; Phases 3–5 pending)* | **`IN PROGRESS`** | Phase 3 (`npcMemories`, rumor spread/distortion, `v4`), Phase 4 (`storylines.ts`), Phase 5 (dynamic Journal replacing `Reliability %`) |
| **Fern Hollow Orchard** *(Scenery, Nav & Bench built; Gameplay & Stories pending)* | **`IN PROGRESS`** | Prioritize Clara & Mina orchard routines, harvesting, gardening & bee-skep play (`PLANNED`) |
| **Asymmetric Memory Fix** (`jun_advice` & direct `hollow_oak` clapper pickup) | **`PLANNED`** | Unify alternate routes to unlock `mem_postcard_sent` & `mem_brass_clapper` consistently |
| **Enterable & Customizable Cottage Interiors** | **`PLANNED`** | Player home sanctuary + visitable neighbor shops/workshops tied to comfort & trust |
| **Personal Inventory & Pocket Journal Collectibles** | **`PLANNED`** | Separate from 5 daily plaza props; Recipes, Flora/Seeds, Pond Catches, Photos, Keepsakes, Memories |
| **Priority Everyday Hobbies: Gardening & Cooking / Sharing Meals** | **`PLANNED`** | Currency-free, anti-grind cozy tending and kitchen hospitality feeding gifts & town care |
| **Relationship Tier Gameplay Unlocks & Post-Bell Community Projects** | **`PLANNED`** | Deeper stories, reciprocal gifts, cottage invitations, hobby teaching, collaborative builds |
| **Additional Residents Beyond Founding 9** | **`PLANNED`** | Future neighbors expanding social circles and Orchard/town life |
| **Broader Everyday Hobbies: Fishing, Decorating & Photography** | **`PLANNED` / `LONG-TERM VISION`** | Calm Mirror Pond catches, personal home/porch arrangement, framing storybook memories |
| **The Sunday Market & Seasonal Festivals** | **`LONG-TERM VISION`** | Separate 7-day cadence preserving 10-day seasons; 100% optional, zero-FOMO, currency-free |
| **Neighborhood Expansion (`REGIONS`), Pets & Optional Cloud Saves** | **`LONG-TERM VISION`** | Connected districts, future animal companions, strictly optional cross-device JSON/account backup |
| **Exact tier unlock tables, inventory sizing, Sunday Market swap rules & project cadence** | **`UNDECIDED / REQUIRES DESIGN DECISION`** | Deferred intentionally until dedicated design scoping |

### 12.2 Staged Development Horizon
1. **Current Playable Baseline (`IMPLEMENTED`)**: A richly simulated, self-contained sunlit diorama with 9 autonomous residents, the complete *Silent Gazebo Bell* multi-route storyline, 4 prototype side arcs, dynamic weather & 10-day seasons, bench sitting, 5 daily shared props, water micro-play, and `WorldState v3` local persistence.
2. **Near-Term Narrative & Social Completion (`PLANNED` — Milestone 2B Phases 3–5)**: Per-resident memory & hearsay distortion (`npcMemories`, `WorldState v4`), formal multi-stage `storylines.ts`, memory-consistency fixes (`jun_advice` / `hollow_oak`), and the qualitative, prose-driven Pocket Journal upgrade removing `Reliability %` telemetry.
3. **Foundation, Home & Priority Cozy Hobbies (`PLANNED` — Milestone 3+)**: Enterable & customizable cottage interiors, completing **Fern Hollow Orchard** gameplay around Clara & Mina (harvesting, botanicals, bee skeps), introducing the personal **Inventory** (distinct from daily plaza props), launching **Gardening** and **Cooking & Sharing Meals**, expanding relationship-tier invitations/teaching/gifts, and launching post-Bell **Community Projects** and new residents.
4. **Broadening Cozy Life & Long-Term Vision (`LONG-TERM VISION`)**: Adding **Fishing**, **Decorating**, **Photography**, full Pocket Journal **Collectible Albums**, the separate-week **Sunday Market** and **Seasonal Festivals**, new connected districts (`REGIONS`), **Pets**, and strictly optional **Cloud Saves**—steadily realizing **LITTLE SOMEWHERE**’s promise of *“a little world filled with thousands of little stories.”*
