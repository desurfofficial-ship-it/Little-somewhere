# HANDOVER.md — Agent & Engineer Handover Brief

**Project**: LITTLE SOMEWHERE  
**Current Phase**: **Milestone 2C `COMPLETE` (Everyday Life)** on top of **Milestone 2A + 2B (Phases 1–5)** & **Milestone 3 Builds 1 & 4**: Willow Step Cottage enterable interior cutaway (`7` interactive stations), `WorldState v6` Personal Satchel (`18` items) & `InventoryDrawer`, contextual gifting + `NEIGHBOR_KEEPSAKE_REWARDS` + witness memories, repeatable daily gathering/hearth activities (`cottage_window_box`, `greenhouse_planters`, `orchard_harvest`, `pond_driftwood`, `cottage_planter`), **Rowan the Orchard Keeper** (10th resident) + **Fern Hollow Micro-Life**  
**Target Next Milestone**: Milestone 3 Polish / Orchard Clara & Mina Beats / Community Projects upon explicit user request

---

## 1. Current State of the Repository

All core simulation, cottage home-life, personal inventory/gifting, dialogue, relationship, NPC memory/gossip, multi-stage storyline/conflict, Pocket Journal projection, environment, water, bench, orchard diorama, **orchard micro-life**, and `WorldState v6` persistence baselines are compiled, unit-tested (**`111/111`** across pure simulation/cottage/inventory/memory/storyline/journal/dialogue/navigation/player/relationship/persistence and Three.js scene suites), and type-checked with **`0` errors**:
- **Authoritative Design & Visual Direction**:
  - Game Design Document: `/GAME_DESIGN.md` (12-section authoritative baseline; currency-free, zero-FOMO, 5-label lifecycle discipline).
  - Official Visual Direction: **PREMIUM HANDCRAFTED STORYBOOK DIORAMA** (`docs/art-direction/VISUAL_IDENTITY.md`) across Willow Step Cottage & Courtyard **+ Enterable Cutaway Interior** (`cottageInterior.ts`), Hearth & Crumb Bakery, Linden Book Nook, Copperwheel Cottage, Sunbeam Greenhouse, Pinecone Woodshop, Old Bell Gazebo, Mossy Stone Fountain, Sora's Tea Cart, Noticeboard, Hollow Oak, Mirror Pond & Cedar Bridge, **Fern Hollow Orchard** (gate/sign, 6 season-tinted crabapple trees, harvest crates, bee skep, 5 nav nodes, `orchard` zone), 3-draw-call `InstancedMesh` grove, 5 carryable world props, **`4` daily outdoor gathering props** (`cottage_window_box`, `greenhouse_planters`, `orchard_harvest`, `pond_driftwood`), and **`5` walkable cedar benches** (`SEAT_SPOTS`) plus all 10 articulated `CharacterRig` figures.
- **Core Gameplay, Simulation & Narrative Baseline (`IMPLEMENTED`)**:
  - Title Screen (`body[data-state="title"]`) -> Live Isometric Neighborhood (`body[data-state="playing"]`) -> Seeded Deterministic Simulation (`WorldState v6` with `v1 -> v2 -> v3 -> v4 -> v5 -> v6` migration + **`33`-node A* lane navigation** + utility-scored autonomous activities, seat reservation, & `2–3` NPC social encounters + bilateral player/NPC relationship & reliability matrix + bounded per-NPC subjective `npcMemories` & discrete encounter gossip propagation + multi-stage `storylines` progression & cooldowns) -> Willow Step Cottage Cutaway Interior (`interior_door`, `cottage_hearth` baking/brewing, `cottage_table` stoneware vase arrangement, `cottage_shelf` 5-slot keepsake display, `cottage_desk` seasonal almanac, `cottage_planter` chamomile sill box, `cottage_bed` next-day rest) -> Personal Satchel (`world.inventory`, `18` catalog items, stack cap `20`, strictly separate from 5 daily plaza `worldProps`) + `InventoryDrawer` + contextual `DialogueSheet` gifting (`giveInventoryItemAction`, `RESIDENT_GIFT_PREFS` across all 10 residents, once-per-day cap, keepsake rewards, witness/recipient memories) -> 4-section `Pocket Journal` (`Stories`, `Memories`, `People`, `Discoveries` including `Willow Step Cottage & Satchel` projection) -> Normalized `localStorage` Persistence (`little_somewhere_world_v1`).
- **System Lifecycle Snapshot (Aligned with `/GAME_DESIGN.md`)**:
  - **`IMPLEMENTED`**: Core `willow_square` world (`33`-node A*, `5` benches, `5` daily plaza props, `4` daily gathering spots), **enterable Willow Step Cottage cutaway interior (`7` stations)**, **personal satchel inventory (`18` items) & neighbor gifting/keepsakes**, 10 founding residents (`RESIDENT_ORDER` registry including `rowan`), traits/needs/emotions/encounters, bounded `npcMemories` & gossip (`WorldState v4`), multi-stage storylines (`WorldState v5`), `WorldState v6` everyday life & home state, 4-tab `Pocket Journal`, Gazebo Bell, 5-layer environment (`360–1290`, `4` weathers, `10`-day `4` seasons), `cozyAudio`, **Fern Hollow Orchard + micro-life (sway hooks + butterflies + bees)**.
  - **`IN PROGRESS`**: **Fern Hollow Orchard deeper social beats** (Clara & Mina shared orchard schedule beats / harvest festivals).
  - **`PLANNED`**: Relationship-tier unlocks, post-Bell Community Projects, further residents beyond Rowan, additional micro-life layers (songbirds, falling blossom drift).
  - **`LONG-TERM VISION` / `UNDECIDED`**: Fishing, Photography, Pocket Journal collectible albums, Sunday Market (currency-free, zero-FOMO), Seasonal Festivals, `REGIONS` districts, Pets, optional Cloud Saves.

---

## 2. Where to Read First

1. `GAME_DESIGN.md` — **Authoritative Game Design Document** (loops, reward philosophy, currency-free rules, and 5-label lifecycle status).
2. `docs/art-direction/VISUAL_IDENTITY.md` & `VISUAL_QUALITY_STANDARDS.md` — **Official Visual Identity (PREMIUM HANDCRAFTED STORYBOOK DIORAMA)** and mandatory asset review checklist.
3. `ARCHITECTURE.md` — System boundaries, `worldRef` vs React snapshot sync, isometric math, 33-node navigation, interior cutaway switching, and reactivity pipeline.
4. `src/game/types.ts` — Single source of truth for `WorldState` (`v6`), `CottageHomeState`, `DailyActivitiesState`, `PersonalItemId`, `StoryFlags`, `StorylineProgress`, `NpcMemoryEntry`, and `DialogueSession`.
5. `src/game/cottage.ts`, `src/game/inventory.ts`, `src/game/actions.ts`, `src/game/simulation.ts`, `src/game/memories.ts`, `src/game/storylines.ts`, `src/game/journal.ts`, `src/game/dialogueEngine.ts`, `src/game/narrative.ts`, & `src/game/storage.ts`.
6. `src/scene/NeighborhoodCanvas.tsx`, `src/scene/builders/cottageInterior.ts`, `src/scene/waterShaders.ts`, & `src/scene/builders/characters.ts`.

---

## 3. Operational Rules & Notes

1. **Software WebGL Timing (`isSoftwareGl`) & Layout Rules**:
   - Headless browsers pace via `afterDraw(tick)` with `dt` clamped to `0.05s`. Never use `backdrop-filter` / `backdrop-blur` over WebGL, keep `VirtualJoystick` `shrink-0` on mobile, keep all mobile buttons `>= 44px`, and always run `npm test` after touching `worldMap.ts`, `cottage.ts`, `residents.ts`, `storage.ts`, or `environmentRenderer.ts`.
2. **Interior vs Exterior Cutaway Contract**:
   - `exteriorRoot` and `interiorRoot` toggle cleanly based on `playerLocation` (`'exterior'` vs `'cottage_interior'`), keeping all exterior rigs (including `orchardMicroLifeRig.group`) parented inside `exteriorRoot`. Indoor tap-to-walk routes via `computeInteriorWaypoints()` around the central dining table.
3. **Environmental & Orchard Contracts**:
   - `OrchardRig.updateWind` and `orchardMicroLifeRig.update` remain zero-GC and weather-gated; `ORCHARD_TREES` / `ORCHARD_GATE` mirror `CIRCLE_OBSTACLES` in `worldMap.ts`.

---

## 4. Verification Status (2026-11-19, after Milestone 2C Everyday Life completion)

- `npm test` (`tsx --test src/game/*.test.ts src/scene/*.test.ts`) — **111/111 passing** (`0` failures across all game engine & 3D scene suites).
- `npm run lint` (`tsc --noEmit`) — **Passing (0 errors)**.
- `npm run build` (`vite build`) — **Passing**.
- Live Headless Chromium QA (`1440×900` & `390×844` via `?autostart=1`): verified Satchel & Keepsakes drawer, enter/exit Willow Step Cottage interior cutaway (zero exterior bleed), Kettle & Hearth brewing (`Warm Chamomile Tea`, `+15m`), Pocket Journal `Discoveries` count (`3/18`), `WorldState v6` `localStorage` persistence across page reload, `390×844` mobile HUD with zero horizontal overflow (`scrollW === innerW`) and `>= 44px` hitboxes, and **0 console errors / 0 page errors**.
