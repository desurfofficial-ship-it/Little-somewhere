# Stage 3 Architecture Proposal -- Everyday Activity Expansion (Deliverable B)

Authority chain (docs/MASTER-ROADMAP.md section 10): MASTER-ROADMAP is authoritative-strategic;
GAME_DESIGN.md is authoritative-mechanics; older production/milestone docs are historical. The
baseline audit (doc 00) grounds every claim below.

## Alignment finding (product decision documented, not silently invented)

The assignment brief lists six Stage 3 areas including "Collectibles and collection album".
The AUTHORITATIVE roadmap disagrees in two places:

1. MASTER-ROADMAP section 8 (Stage 3) says: prioritize the activity areas **one at a time, not
   simultaneously**, and its #6 is "Exploration and discoveries (expand the Wild Hollows)" --
   not a collection album.
2. "Personal collections and displays (photo album, collection album)" is explicitly **Stage 5**
   (MASTER-ROADMAP section 8); collectible albums are LONG-TERM VISION in GAME_DESIGN.md
   section 12 (line ~349), with the rule "celebration over checklist... never costs permanent
   missed collectibles" (GAME_DESIGN.md:300-307).

Decision taken: follow the authoritative roadmap. The album is documented as Stage 5 and NOT
built; the six brief areas are re-mapped below to the roadmap's sequencing. Fishing is carried
out first because the roadmap candidates it with "design doc needed first" and every dependency
it needs already exists in code.

## Per-area verdicts

| Area | Verdict | Rationale (roadmap + code evidence) |
|------|---------|-------------------------------------|
| Fishing | **BUILD-NOW** | Roadmap candidates it ("design doc needed first" -- this doc is that design doc); GAME_DESIGN.md:72 already specifies its shape ("unhurried rod fishing along Mirror Pond... never stressful stamina gauges or profit quotas"); zero existing code; idle pond assets (koi, pier prose, benches, pond bench seat, pond combing precedent); highest cross-system reach per line of code. Implemented in this slice. |
| Gardening expansion | BUILD-LATER | Greenhouse chassis is excellent (no withering, water-streak rewards, winter dormancy) but expansion stacks onto 4 existing daily-tend flags -- MASTER-ROADMAP section 6 pillar-6 watchlist explicitly names "Gardening watering-grind (Stage 3)" as the violation surface to watch. Needs schema conversation for new plot state. Prove the anti-chore pattern on a cheaper surface first. |
| Photography | BUILD-LATER | Framing/capture UI lives in App.tsx + NeighborhoodCanvas.tsx + journal.ts -- all locked by the active LR-3 PR cluster; and the album/display half is Stage 5. A photo system with nowhere to put photos is worse than none. Sequenced after LR-3 merges. |
| Decorating / personal expression | BUILD-LATER (trim) | Full placement is large state + collision + UI for modest immediate joy; vase (3 items) + 5-slot keepsake shelf already exist. Stage 5 owns the full decorating pillar. Cheap interim: widen shelf-eligible item types via the Items registry. |
| Cooking & shared meals | TRIM | Recipe DISCOVERY via residents overlaps LR-4 (teaching, designed, roadmap section 8 Stage 1: "do not invent final requirements"); shared meals reuse the LR-3-owned invitation chassis. Safe sliver: 1-2 new HEARTH_RECIPES rows as content (inventory.ts is unowned). Teaching story waits for LR-4. |
| Collection album | SKIP (Stage 3) | Stage 5 per MASTER-ROADMAP; an album before fishing/photos/taught-recipes exist is a checklist with empty pages -- inverts "celebration over checklist". Journal Discoveries + Memories tabs + practice ladder already give collection-shaped joy. |
| (Roadmap's real #6) Wild Hollows expansion | BUILD-LATER | 4 wilds + Sorrel pilot landed; discovery pattern proven. The fishing slice deliberately deepens pond-side exploration instead of opening a second front. |

## Cross-system connection model (Workstream B, all verified in code)

- P1 station-visit -> item grant: pond_driftwood combing (actions.ts:1745) is the template --
  once-per-day stamp, deterministic pick, applyItemGrants, spendMinutes. USED BY THIS SLICE.
- P2 item -> gift -> memory -> dialogue echo: giveInventoryItemAction consumes, writes
  player_gift memory + witness memories, generates gift_reaction dialogue; echoed later by
  everyday_cottage_hearth (requiresNpcMemory tag player_gift reading detail.personalItemId).
  USED BY THIS SLICE (catches are giftable; 4 residents gained fish preferences).
- P4 deed -> firsthand/witness NPC memory -> behavior + journal + gossip: pond stone-skip
  witness pattern (actions.ts:2176-2200). USED BY THIS SLICE (tag 'fishing').
- P6 counted practice -> derive-only tier ladder: everyday.ts reads existing counters only.
  USED BY THIS SLICE ('fishing' practice reading sideFlags.fishingCatchesCount).
- P5 discovery -> sideFlag -> journal + dialogue: available for future photo subjects.
- P7 completion -> persistent world transformation: Sorrel pilot pattern; future fishing-adjacent
  community project could use it (dock restoration) -- deferred.

## First implementation slice: Willow Jetty pond fishing (shipped in this branch)

Player-facing outcome: one unhurried cast per day at a new shore spot on Mirror Pond; a
deterministic seasonal catch (5 new giftable satchel items) or pond treasure (existing ids) or
a prose "quiet water" day; first-of-species Pocket Journal memories; pond-bank residents
remember witnessing catches (gossip/echo eligible); catches gift into the existing chain;
Daily Practices card gains a "Quiet Waters" row. No quotas, no rarity grind, nothing missable
(seasonal pools rotate, never remove access).

Design contract:
- Currency-free, no-fail, no-bait economy, no timers, no energy, no streaks. One cast/day --
  the neighborhood's existing soft-circuit cadence (pond combing, greenhouse trays, orchard,
  window box already are once-per-day).
- Deterministic: per-catch derived streams `mulberry32(hashSeed(simSeed, day, 'fishing_v1',
  catchIndex))` (simulation.ts block-stream discipline). No wall-clock reads anywhere.
- Persistence: sideFlags counters only (`fishingCatchesCount`, `fishingLastDay`) + memories +
  satchel via applyItemGrants. Zero schema bump (WorldState stays v12; D7 registry policy).
- Guards (QA F6 discipline): exterior location; fail-closed distance check; activeActivity
  null; isDoneToday day gate. Occupancy/invitations never touched (field-scoped test pins).
- Honesty: honest grant chips only (empty omitted); overflow releases the catch with truthful
  prose; NaN/safe-integer-guarded counter reads (QA F2 class).

Integration vs the LR-3 lock (#26-#31): additive-only unions in types.ts (PersonalItemId,
PropInteractableId -- LR-3 touches BakeryInteractableId only, verified); ONE dispatch branch in
actions.ts inserted immediately before the generic fallthrough (~:1956; LR-3 hunks are imports
and bakery reducers, trivial 3-way merge); zero edits to App.tsx, NeighborhoodCanvas.tsx,
journal.ts, migrations.ts, invitations*, bakery*, socialProfile.ts, walkability.ts.

Mobile budget: static creel-and-rod rig in environmentRenderer.ts (+5 draw calls on 2 shared
color-only materials, 0 new shader programs, 0 textures; rain/petal constructor precedent;
parented to exteriorRoot so it hides indoors via the existing toggle).

Files touched: NEW src/game/fishing.ts + fishing.test.ts; worldMap.ts (+1 registry row);
types.ts (+5 PersonalItemId, +1 PropInteractableId); inventory.ts (+5 items, +4 gift prefs);
actions.ts (+1 import, +1 branch); everyday.ts (+practice id/order/tiers/def/touchedToday);
dialogue/assets.ts (+SubjectScene item_fish, subject keys, 5 spec rows, willow_jetty case);
DialogueVisuals.tsx (+item_fish painter arm); environmentRenderer.ts (+static rig);
inventory.test.ts / itemSubjectMapping.test.ts / everyday.test.ts (count pins 25->30, 8->9,
tier rename pin).

## Follow-up slices (dependency-ordered, NOT started)

1. Fishing v1.1 (after any merge): West Brook second spot (reuses module table), 1-2 new
   everyday dialogue topics reacting to catches (needs golden-topic protocol coordination).
2. Photography (after LR-3 merges): frame predicate + photo-as-journal-memory + item_fish-style
   parametric scenes; album rendering rides Stage 5's display pillar.
3. Cooking content sliver: 2 new HEARTH_RECIPES rows + gift prefs (no new systems).
4. Garden window-boxes (needs owner-approved schema addition; anti-chore pattern documented
   in doc 00 section 1).
5. Stage 5: collection album + photo display (owner decision).

## Decisions requiring product-owner authorization (none block this slice)

1. Confirm fishing as the lead Stage 3 activity (this branch proceeds under the roadmap's
   "one at a time" rule).
2. Confirm the album stays Stage 5 despite the brief's framing.
3. New everyday dialogue topics touching scripts/dialogue-topics-golden.json require
   coordination with the golden-topic protocol owner (LR-3 currently owns that file).
4. Any future WorldState schema addition (garden boxes) must follow the persistence team's
   migration protocol -- not this workstream's call.
