# Audit 1-e — World Content & Storytelling (Discoveries, Storylines, Dialogue, Journal, Community-Project Seam)

Branch `feat/world-environment-living-world` · **read-only audit** · all `file:line` refs verified against the working tree.
Scope: how *content* (discoveries, storylines, dialogue, journal) wires into the 3D world, and where a post-Bell
**Community Projects** pipeline (GAME_DESIGN.md §12.2 "persistent environmental transformation") should attach.
Companion to `audit-1d-environment.md` (which covers weather/season/time/ambient life — this file covers story→world content).

---

## 1. Discovery / story→world wiring inventory

### 1.1 Build-10 Wild Hollows discovery registry (`src/game/exploration.ts`)

Four discoveries (`EXPLORATION_DISCOVERIES`, exploration.ts:30-79), centers/radii mirroring `LANDMARK_ZONES`
(worldMap.ts:269-272):

| id | sideFlag | memoryId | zone (x,z,r) | Journal title |
|---|---|---|---|---|
| marigold_lane | `explored_marigold_lane` | `mem_explored_marigold_lane` | 20.3, 5.5, r 5.2 | "A Lane All My Own" |
| foxglove_rise | `explored_foxglove_rise` | `mem_explored_foxglove_rise` | 21.6, 18.5, r 5.4 | "The Whole World From the Rise" |
| sorrel_hollow | `explored_sorrel_hollow` | `mem_explored_sorrel_hollow` | −20.4, 18.3, r 5.2 | "The Forgotten Garden" |
| bee_line | `explored_bee_line` | `mem_explored_bee_line` | 10.4, −18.8, r 5.0 | "A Hum in the Clover" |

**Grant mechanics**: `discoverExplorationInPlace` (exploration.ts:107-130) is a pure in-place sim step called at
**step 0 of `stepSimulationInPlace`** (simulation.ts:634-641), exterior-only (uses `exteriorPlayerPos` when the
player is indoors), copy-on-write `sideFlags` + memory prepend, idempotent (flag guard + memory-id guard).
One-shot by design; correctness pinned by `build10-recovery.test.ts` (BD10-01…09) and `exploration.test.ts`.

**Visual trigger**: the flags flow through the **Build-03 progression pipeline**, *not* `computeEnvironmentState`:
- `progressionVisuals.ts:371-376` derives `explorationMarks { wellRibbon ← explored_sorrel_hollow, riseCairn ←
  explored_foxglove_rise, laneArrow ← explored_marigold_lane, hiveWreath ← explored_bee_line }` and packs them
  into the radix revision.
- `progressionPresentation.ts:570-655` builds the four mark groups (`prog_mark_well_ribbon` etc., placed near the
  well/rise-stair/lane/beehive) hidden by default; `:711-714` flips visibility from `state.explorationMarks` inside
  `apply()`, which `environmentRenderer.ts:267` calls inside the static-revision block (`:254-261`).
- So a discovery = a small *marker token* (ribbon/cairn/arrow/wreath), not a world transformation.

**Discovery UX**: **silent**. `simulation.ts:640` discards the return value — no toast, no chime. The player learns
of a grant only via the Pocket Journal discoveries rows (`journal.ts:1052-1099`) where each wild site gets a
knowledge-bounded landmark row with a **live status** ("3 posies picked", "Seeds carried home", "Foxgloves growing
below", "Quiet until spring" in winter — journal.ts:1056-1095). This is the deferred register item **F-UX-1**
(`docs/architecture/build10-lr-recovery/03-exploration-restoration-design.md:34`; doc 12).

**Do discoveries matter afterwards?** Yes, asymmetrically:
- **Sorrel Hollow**: strongest follow-through. `old_stone_well` prop (worldMap.ts:292) grants `foxglove_seeds`
  + `foundFoxgloveSeeds` (actions.ts:1448-1481) → feeds the **4th greenhouse crop** (`seedItemId` union incl.
  `foxglove_seeds`, actions.ts:2433) → Mina's daily check-in `daily_mina_foxglove` (dialogue/interiors/wilds.ts:14-83)
  branches on **actual** `greenhouseState.plots` (seeds carried / growing / ready-to-snip — wilds.ts:20-34).
  Plus `wellPebblesCount` counter (actions.ts:1486-1497).
- **Bee Line**: `wild_bee_log` prop + Rowan's daily check-in `daily_rowan_beeline_checkin` (wilds.ts:85-133)
  branching on **actual** `world.season === 'winter'` (wilds.ts:92-95).
- **Marigold Lane**: `marigold_bank` prop → `meadowPosiesPicked` counter (actions.ts:1577-1590); Mina has a
  scheduled walk there (residents.ts:816-825) — but **no dialogue topic ever mentions the lane**.
- **Foxglove Rise**: `rise_vista` panorama prop (worldMap.ts:293) + a bench seat (`seat_foxglove_rise`,
  worldMap.ts:182) — **zero dialogue, zero resident presence**. Weakest of the four.
- After the initial topic, discoveries never re-enter `computeEnvironmentState` (narrative.ts:43-71 reads only
  `orchardGatheringComplete` from sideFlags) — the marks are end-state tokens.

### 1.2 Storyline registry vs. world (`src/game/storylines.ts:20-288`)

Six multi-stage storylines (each 3 stages, 2-3 authored outcomes, journal hints per stage):

| Storyline | Category | Drives world change? | Mechanism |
|---|---|---|---|
| `side_pip_zine` | personal | Visual prop only | `pipZinePrinted/Theme` sideFlags → `zineChalkboard` (progressionVisuals.ts:252-259 → progressionPresentation.ts:667-672) |
| `side_herb_loaf` | personal | Visual prop only | `herbLoafShared/Style` → `herbWindowCrate` (progressionVisuals.ts:260-267) |
| `side_pond_stand` | personal | Visual prop only | `pondStandBuilt/Style` → `musicStand` (progressionVisuals.ts:268-275) |
| `side_jun_watch` | personal | Visual prop only | `watchTuneFinished/Style` → `watchCharm` (progressionVisuals.ts:276-283) |
| `conflict_plaza_lanterns` | conflict | **World + visual** | Unlocked *by* world flag `lanternsLit` (storylines.ts:211); outcome → `lanternConflictResolved/Outcome` (lanternsArc.ts:317-320, 384, 453) → `pierSconces` + 3 sconce styles (progressionVisuals.ts:284-289 → progressionPresentation.ts:695, 727) |
| `side_orchard_gathering` | personal | **World + schedules + social** | outcome sideFlags (orchardArc.ts:139, 197, 263-267) → `computeEnvironmentState.orchardGatheringOutcome` (narrative.ts:52-57) → `orchardRig.setGatheringVisual` (environmentRenderer.ts:322-327) → **4 new resident routines** gated `requiresSideFlag: 'orchardGatheringComplete'` (residents.ts:749, 871, 1135, 1207) → richer NPC encounter behavior (simulation.ts:478-485) |

**Location mentions in dialogue**: every module references named places (counts per module: lanternsArc 13,
zineArc 11, smalltalk/home 7 each, …; measured via grep). Quest/personal arcs are anchored to the plaza-pond-bakery
band; **no topic outside `interiors/wilds.ts` mentions any Wild Hollows site** (grep for Foxglove/Marigold/Sorrel/
Bee Line across `src/game/dialogue/` returns only wilds.ts + one "Marigold lanterns" in orchardArc.ts:252 which
refers to the orchard garlands).

**Interior dialogue (`dialogue/interiors/*`)**: two-phase handshake per interior — a one-time exterior invitation
topic gated `sideFlagsFalse: ['bakeryVisited']` (bakery.ts:26; same pattern bookNook.ts:44/66 `nookVisited`,
copperwheel.ts:50/72 `copperwheelVisited`, greenhouse.ts) sets the flag on acceptance, then a **daily check-in**
gated `sideFlagsTrue: ['bakeryVisited'], notSeenToday` (bakery.ts:97-102) whose builder reads the interior's
**actual deterministic day-cycle state** (`getBakeForDay`, kneaded/shared day — bakery.ts:104-114). Winter
branches in all five interior modules (grep `world.season === 'winter'`: bookNook.ts:27, greenhouse.ts:26,104,
copperwheel.ts:30, wilds.ts:92, bakery.ts:28).

**Everyday weather/home dialogue**: reactive to real state.
- `dialogue/everyday/weather.ts` — 2 topics; condition gates `{ weathers: ['light_rain'] }` (:23) and
  `{ weathers: ['misty_morning','breezy'] }` (:54); `buildText` branches on `w.weather` (:56-60) and on
  per-resident `traits.rainBehavior` (:27). Reactive ✅.
- `dialogue/everyday/home.ts` — reads actual `cottageState.kettleWarmUntilMinute` / `placedFlowerId` /
  `displayedKeepsakeIds` and `dailyActivities.bakedCountToday` (home.ts:85-87, 147-151, 180-189). Reactive ✅.
- **Season gap**: `DialogueCondition.seasons?: SeasonType[]` exists (types.ts:844) and the engine evaluates it,
  but **no dialogue topic ever uses a `seasons:` gate** — the only season awareness is the `winter` ternaries in
  interior/wilds builders. `WEATHER_SEASON_TOPICS` (weather.ts:16) contains no season topic despite its name.
- The morning wake beat names actual weather+season (`buildMorningWakeLine`, narrative.ts:415-432).

### 1.3 The story→world contract, both directions (`narrative.ts:43-71` + grep of `src/scene`)

`computeEnvironmentState(flags, sideFlags)` emits 9 fields; **every one is consumed** by the renderer:

| Derived flag | Scene consumption (environmentRenderer.ts unless noted) |
|---|---|
| `plantersBloomed` | :272-274 flowerGroups scale per 3-bloom stride |
| `fountainFlowing` | :282-291 water/spout/clog/coins/cascade |
| `ivyCleared` | :276 gazebo ivy visibility |
| `bellGleaming` | :277 clapper mesh (+ rope ring/sparkles in rig) |
| `festoonLanterns` | :409-411 (`‖ dusk` so not exclusive); packed into revision (environment.ts:218) |
| `bakeryTablesOpen` | :279 bakeryTablesGroup |
| `reconciledTogether` | :278 ribbonMesh (+ golden-hour co-schedule via `getResidentScheduleSlot`, residents.ts:638-655) |
| `noticeboardUpdated` | environment.ts:296 → progressionVisuals.ts:387 noticeboard glint |
| `orchardGatheringOutcome` | :322-327 `orchardRig.setGatheringVisual(outcome, lanternsActive)` |

Also wired from raw flags: `foundBrassClapper` → oakGlint (renderer:280), `mailboxUnread` → flag angle (:281).
**Conclusion: no orphaned derived flag.**

**Visuals that exist but no story ever touches** (the reverse list):
- `seat_foxglove_rise` and `seat_sorrel_hollow` (worldMap.ts:182, 191) — **never referenced by any schedule or
  activity**; only the player can sit. Two hand-built benches with permanent zero occupancy.
- All static Wild Hollows dressing: brooklet (wilds.ts:587), clover cushions (:805-821), hollow birches,
  lane boulders, and the decorative beeline cairn (:778-803, distinct from the progression rise-cairn mark).
- West Brook/pier: physically rendered with lantern-sconce mounts (sconces themselves *are* story-driven), but
  no resident ever schedules onto the pier and no topic references it.
- Festoon bulb flicker is one material sine (renderer:401) — the "festival ring" mediation outcome
  (`mediationStyle === 'festival_ring'`, types.ts:372) renders identically to `gentle_truth` for everything except
  the table flag (audit-1d L4 note; content-side consequence: two of three mediation choices produce no unique
  world trace beyond journal/memory text).

---

## 2. Location usage table (residents × locations)

Compiled from 40 base `ScheduleSlot`s (residents.ts:58-630) + 33 `RESIDENT_EXTRA_ACTIVITIES` candidates
(residents.ts:679-1210; weight/flag/weather-gated, not guaranteed daily). "✓" = scheduled slot exists.

| Location (LANDMARK_ZONES, worldMap.ts:258-272) | clara | arthur | mina | jun | barnaby | sora | toby | nora | pip | rowan |
|---|---|---|---|---|---|---|---|---|---|---|
| Fountain Plaza / South Cobblestones | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | ✓ | |
| Old Bell Gazebo (walk/steps/lawn/bench/lanterns) | ✓ | ✓ | | ✓ | ✓ | ✓(lanterns) | ✓ | ✓ | ✓ | |
| Hearth & Crumb Bakery (porch/patio/stoop/awning/café) | ✓ | | ✓ | ✓ | | ✓ | | | ✓ | |
| Sunbeam Greenhouse (door/wall/exterior) | ✓ | | ✓ | | | | ✓ | | | |
| Linden Book Nook (porch/rain) | | | | | | | | ✓ | | |
| Copperwheel Cottage (yard/porch) | | ✓ | | | | | | | | |
| Pinecone Woodshop | | | | | ✓ | | | | | |
| Sora's Tea Cart | ✓ | | | | | ✓ | | | | |
| Noticeboard Corner | | ✓ | | ✓ | | | ✓ | | ✓ | |
| East/West Plaza Benches | | ✓ | | ✓(E) | | | | ✓(W) | ✓(E) | |
| Mirror Pond (bank/bridge/approach/bench) | | | ✓ | | | ✓ | ✓ | | ✓ | |
| Hollow Oak | | | | | | | ✓ | | | |
| Willow Step Lane / planters (exterior) | | | ✓ | ✓ | ✓ | | | | | |
| East Bridge Path | | | | | ✓ | | | | | |
| Fern Hollow Orchard (rows/skep/gate/crates/bench/canopy) | ✓ | | ✓ | | ✓ | | | | | ✓ |
| Orchard Tasting Table *(sideFlag-gated)* | ✓ | | ✓ | | | | | | ✓ | ✓ |
| **Marigold Lane** | | | ✓ | | | | | | | |
| **Sorrel Hollow** | | | | | | | | | ✓ | |
| **The Bee Line** | | | | | | | | | | ✓ |
| **Foxglove Rise** | — | — | — | — | — | — | — | — | — | — |
| **Willow Step Cottage interior / pier / west brook** | — | — | — | — | — | — | — | — | — | — |

**Never host any resident activity**: **Foxglove Rise** (bench + vista interactable, 0 residents — the only
discovery zone with no presence), **Willow Step Cottage interior** (player-only by design; Mina tends the
*exterior* planters), **pier/west brook**, and the wilds' two spare benches. The wilds as a whole have exactly
3 routine visitors (Mina/Pip/Rowan, each one phase-window candidate, weights 0.70-0.80 = low priority) — the
 southeastern/southwestern map quarters are quiet most days.

---

## 3. Environmental storytelling audit — what the world communicates

**Strengths (world narrates itself):**
1. **Story outcomes are legible in space**: every completed arc leaves a permanent, styled prop (gathering
   outcome variants → tasting-table set dressing + marigold garlands; lantern outcome → 3 sconce styles;
   zine/herb/stand/watch → themed props). The OR-fallback (`sideFlags.‖ storyline completed`,
   progressionVisuals.ts:248-252) means the visual can never dangle.
2. **Journal is weather/season-literate**: World & Time tab shows season/day/weather + tomorrow forecast
   (journal.ts:1219-1223); discovery rows change status with season and player actions (:1056-1095); NPC memory
   prose anchors events to *places* and to world transformations (`gazebo_ivy`, `fountain_fixed`,
   `bell_restored`, `bell_ring` tag renderers — journal.ts:327-356; `placeName` detail :297,306-315).
3. **Dialogue honors knowledge boundaries**: interiors/wilds topics read only state the speaker could know
   (bakery.ts:18-20 comment discipline; wilds.ts builders read greenhouse/season, not omniscient facts);
   `requiresWitnessedEvent` (types.ts:862-866) exists for event reactivity.
4. **The day announces itself**: morning wake line names weather/season (narrative.ts:415-432); noticeboard
   posts tomorrow's forecast (audit-1d §2).

**Weaknesses (what the world fails to say):**
1. **`weather_shift` WorldEventRecord kind is defined (types.ts:576) but never emitted anywhere** — weather days
   pass without a single social/journal trace; the lane-moments feed (journal.ts:1111-1125) never carries the
   sky. Weather is ambient, not narrative.
2. **Season has zero dialogue surface** (`seasons:` predicate unused — §1.2) and zero journal *event* (only
   passive labels). The 10-day season turn — the game's biggest recurring world change — passes silently except
   for interior winter ternaries.
3. **Discovery grants are invisible at the moment they happen** (no toast/chime; F-UX-1 deferred) — the exact
   moment of "the world rewarded curiosity" is the one beat with no feedback.
4. **Two discovery sites are dead ends narratively**: Foxglove Rise (no dialogue, no resident, unused bench) and
   Marigold Lane (no topic mentions it).
5. **`community_pulse` emergent seed (emergentStories.ts:287-297) counts indoor rituals only**
   (booksRead/harvests/projectsAdmired/loavesShared) — the "community" feeling never reads outdoor/environmental
   facts (gatherings attended, discoveries, weather shared).
6. Mediation outcome `festival_ring` has no unique visual (§1.3) — a branch whose world-trace is journal text only.

---

## 4. Community-project seam analysis (Workstream E prep)

### 4.1 What infrastructure already exists

- **Open sideFlags ledger**: `WorldState.sideFlags: Record<string, boolean|number|string>` (types.ts:768);
  `sanitizeSideFlags` preserves arbitrary keys (proven by build10-recovery.test.ts:479-488) — new project flags
  need **zero schema/migration work** (Build 10's explicit design stance, GAME_DESIGN §12.1 row "no
  schema/migration impact").
- **Typed flags need migration**: `StoryFlags` (types.ts:362-376) is a closed interface — extending it means
  `createInitialStoryFlags` (narrative.ts:25-41) + save migration. Prefer sideFlags for project state.
- **Two-way sync discipline**: dialogue outcomes write sideFlags + advance storylines atomically
  (actions.ts:276-277, :492); `syncSideFlagsFromStorylineInPlace` (storylines.ts:650-691) re-mirrors
  storyline→sideFlags, and `hydrateStorylinesFromLegacyState` (:426-543) re-derives storylines→sideFlags on
  legacy loads. Flags and storyline state never diverge in real saves.
- **Derived-visual contract is pure & tested**: `composeProgressionVisualState` (progressionVisuals.ts:239-449)
  with radix-sum revision packing (:29-31, :376) and frozen cached state; consumed via
  `environment.ts:296` → `environmentRenderer.ts:254-267` dirty-flag static block.
- **World-life hooks**: `ActivityCandidate.requiresSideFlag` (residents.ts:673) already spawns/retires resident
  routines off flags; `requiresWitnessedEvent`/`requiresRecentEventTag` (types.ts:853-866) let residents *talk
  about* world events; `journal.ts` landmark rows (1052-1099) are the player-facing ledger pattern.
- **Contribution loop pieces**: prop interactables with counters (well pebbles actions.ts:1486-1497), inventory
  items (foxglove seeds actions.ts:1451-1481), `dailyActivities` ledger, and the noticeboard surface
  (`noticeboardUpdated` + flyers 1-3, renderer:294-297).

### 4.2 The analogous existing pattern (template to mirror)

**`side_orchard_gathering` is the exact vertical slice a Community Project needs**, end to end:
1. Proposal dialogue (orchardArc.ts:42/85 sets `orchardGatheringStarted`) gated by trust + quest cue
   (narrative.ts:90-100).
2. Outcome choice sets `setSideFlags { orchardGatheringComplete, orchardGatheringOutcome }` +
   `advanceStoryline` + `recordNpcMemories` town-lore memories + WorldEventRecord (orchardArc.ts:263-267;
   actions.ts:492-504 emits the `story_flag`/`storyline_beat` event).
3. Pure derivation → `orchardGatheringOutcome` in `computeEnvironmentState` (narrative.ts:52-57), revision-bumped
   (environment.ts:247-249).
4. Scene sync `orchardRig.setGatheringVisual(outcome, lanternsActive)` (environmentRenderer.ts:322-327) — outcome-
   styled, lantern-aware, **two distinct built results** (tart table vs honey picnic).
5. The built result gets **daily life**: 4 residents add `requiresSideFlag` tasting-table routines
   (residents.ts:749/871/1135/1207) and Rowan-centric encounters change (simulation.ts:478-485).
6. Player-facing record: journal storyline card (stage hints, storylines.ts:255-286) + `transformed` landmark
   status (journal.ts:1066 pattern).
The lantern conflict adds the *outcome-variant visual* precedent (3 sconce styles,
progressionPresentation.ts:727+).

### 4.3 Recommended architecture — `communityProjects.ts` + `worldTransformations` sync

**Layer 1 — Registry (`src/game/communityProjects.ts`, pure)**: mirror `STORYLINES` + `EXPLORATION_DISCOVERIES`:

```ts
export interface CommunityProjectDef {
  id: string;                       // e.g. 'well_garden_restored'
  title: string; subtitle: string;
  sponsorResidents: ResidentId[];   // proposal + check-in speakers
  proposalCondition: DialogueCondition;   // e.g. sideFlagsTrue ['explored_sorrel_hollow']
  stages: [propose, gather, build];       // contribution windows, journal hints
  contributions: { itemId?: PersonalItemId; counterFlag?: string; needed: number }[];
  outcomes: Record<string, { label: string; journalSummary: string }>;
  worldChange: {                    // the visual contract
    anchor: Vec2;                   // mirrors LANDMARK_ZONES coords (exploration.ts pattern)
    visualId: string;               // builder key in scene
    variants?: string[];            // outcome styles (sconce pattern)
  };
  residentLife: { requiresSideFlag: string }[];  // ActivityCandidate seeds (orchard pattern)
}
```

**Layer 2 — State**: keep everything in sideFlags: `project_<id>_started`, `_contributions` (number),
`_complete` (bool), `_outcome` (string) — plus `syncCommunityProjectFlagsInPlace` mirroring
`syncSideFlagsFromStorylineInPlace` (storylines.ts:650) so a future storyline-style ledger stays coherent.
Zero migration, save-safe, deterministic.

**Layer 3 — Contract (pure derive)**: `composeCommunityWorldState(world) → { revision, transformations:
readonly TransformationState[] }` following the derive-only doctrine (progressionVisuals.ts:1-31 header; "never
persist a memento flag"). Compose it into `composeEnvironmentState` additively exactly where
`progression` was bolted on (environment.ts:293-296) — do **not** widen `EnvironmentalState`; the 9-field
interface is fully consumed and stable.

**Layer 4 — Visual sync**: one `src/scene/builders/communityTransformations.ts` returning `{ group, apply(state) }`
mounted like `progressionRigs`, invoked inside the static-revision block (environmentRenderer.ts:263-267)
before season drift re-application (ordering pinned by environmentRenderer.test.ts). Style variants per outcome
(sconce pattern, progressionPresentation.ts:727).

**Layer 5 — Life & narrative**: `requiresSideFlag` activity candidates per completed project (residents.ts:749
pattern); one daily check-in topic per project with `sideFlagsTrue: ['project_x_complete'], notSeenToday`
(wilds.ts/bakery check-in pattern); journal landmark row with `transformed` status (journal.ts:1052-1099
pattern); optional `worldEvents` `storyline_beat` emission for gossip/lane-moments (actions.ts:492-504).

**Cleanest first pilot** (highest narrative leverage, cheapest build): **"The Forgotten Garden" — restore the
Sorrel Hollow well garden**. Every hook already exists: the discovery memory foreshadows it ("Someone tended
this garden long before the square had a name", exploration.ts:60-65); Mina's check-in already promises it
("I'll bring the hollow's garden back to life, one pot at a time" — wilds.ts:43) and poses the open question
("Do you know who tended that garden…?" :65, answered by :78 "the first new thing that garden has grown in a
very long while"); foxglove seeds already flow into the greenhouse; the site has an anchor prop, a bench, and
a journal row with `active` states. Player contribution = posy/seed/bloom deliveries (inventory already holds
`meadow_posy`, `foxglove_bloom`, seeds); resident life = Mina/Pip routines at the restored beds.

---

## 5. Ranked content opportunities (player value ÷ effort)

1. **Close F-UX-1 — celebrate the discovery moment**: surface the discarded return of `discoverExplorationInPlace`
   (simulation.ts:640) as a toast + `playMemoryChime` (App.tsx toast/chime patterns at :497-499/:353). One line of
   plumbing; converts the game's best "world rewards curiosity" beat from silent to felt.
2. **Give Foxglove Rise a pulse**: add one resident routine at `seat_foxglove_rise` (e.g., Sora golden-hour violin
   "where the whole valley listens" — extends her pond-melody candidate, residents.ts:965-974) + one vista check-in
   topic. Fixes the only zero-occupancy discovery zone (§2) and gives the rise bench a reason to exist.
3. **Make the season speak**: use the already-supported `seasons:` predicate (types.ts:844) for 2-3 everyday topics
   (first blossom / harvest smell / first frost) and one non-winter branch fix — `WEATHER_SEASON_TOPICS` currently
   honors only half its name (§1.2). Zero engine work.
4. **Emit `weather_shift` world events** on day-roll weather change (kind already in types.ts:576; emit site next
   to `advanceToNextDay`) → lane-moment rows + `requiresWitnessedEvent` gossip ("first rain of the season") —
   weather becomes part of the social web instead of ambience only.
5. **Pilot Community Project: Sorrel Hollow well garden** (§4.3) — proposal hook, contribution loop, outcome
   visual, resident routines, journal row all have working analogues; it converts the strongest existing
   foreshadowing into Workstream E's first "persistent environmental transformation."
6. **Post-gathering cadence**: `orchardGatheringComplete` spawns 4 schedule slots but no recurring *topic*; add a
   daily tasting-table check-in (bakery.ts:97-102 pattern) + journal `transformed` row so the gathering keeps
   narrating itself after day one.
7. **Counter follow-through for Marigold Lane**: `meadowPosiesPicked` / `wellPebblesCount` currently surface only
   as journal labels (journal.ts:1040-1041, 1057, 1084); one reaction topic each (Mina vase; Nora well-wish lore)
   makes small counters feel witnessed.
8. **Post-bell town cadence seed**: after `bellRestored` the plaza's only recurring beat is the Clara/Arthur
   golden slot (residents.ts:638-655); a noticeboard "project flyer" (flyer surface exists, renderer:294-297 +
   `noticeboardUpdated`) advertising the next community project is the lightest possible on-ramp to Workstream E.

---

*Verification: all claims traced by direct file reads/greps this session; no source files modified; single new
file written (`audit-1e-content.md`). Topic count note: runtime snapshot = 85 topics (scripts/topic_snapshot_runtime.json);
GAME_DESIGN.md's "79 topics" and dialogue/index.ts comments lag by a few SF-4/LR additions.*
