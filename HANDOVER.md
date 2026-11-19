# HANDOVER.md — Agent & Engineer Handover Brief

**Project**: LITTLE SOMEWHERE  
**Current Phase**: **Milestone 2C Polish Round 3 `COMPLETE` (Everyday Life Passes 8–12: weather-aware interior, rain room-tone, hearth-gated chimney, home-ritual dialogue/journal, wake lines)** atop **Milestone 3 Build 2 `COMPLETE` (Completing Fern Hollow Orchard)**, **Milestone 2A, 2B, 2C (`WorldState v6`)** & **Milestone 3 Builds 1 & 4**: Willow Step Cottage enterable interior cutaway (`7` stations), Personal Satchel (`18` items) & gifting, **Rowan the Orchard Keeper** (10th resident), **`side_orchard_gathering`** 3-stage dual-branch orchard storyline + epilogue, interactive **`orchard_skep`**, permanent **Orchard Tasting Table & Marigold Lantern Garland**, and **Orchard Songbirds + Seasonal Blossom/Leaf Drift**  
**Target Next Milestone**: Milestone 3 Polish / Village Expansion / Community Projects upon explicit user request

6. **Cottage Interior & 2C Polish Contracts (Entries 029-030)**:
   - `builders/cottageInterior.ts` mirrors `COTTAGE_BOUNDS` / `COTTAGE_INTERIOR_OBSTACLES` / `COTTAGE_INTERACTABLES` exactly (enforced by `src/game/cottage.test.ts` + `src/scene/cottageInterior.test.ts`); `rig.update(world, phase, elapsed)` is the single zero-GC reactive entry point. All interior statics live **inside existing obstacle footprints or wall planes** — never add furniture to the walk band without extending `COTTAGE_INTERIOR_OBSTACLES` together with its mirrored geometry and tests. The atmosphere layer (hearth `PointLight`, window shaft, dust motes) lives inside the rig's group; `rig.update` owns all flicker/drift math with zero allocation. The hearth brew overlay commits `cookRecipeAction` exactly once — keep `RECIPE_ACTIVITY_STEPS` coverage of every `HEARTH_RECIPES` id when adding recipes. `PropInteractionResult.gainedItems` must stay in sync with the actual inventory delta (enforced by test).

---

## 1. Current State of the Repository

All core simulation, cottage home-life, personal inventory/gifting, dialogue, relationship, NPC memory/gossip, multi-stage storyline/conflict, Pocket Journal projection, environment, water, bench, orchard diorama, **Fern Hollow Orchard gameplay & micro-life**, and `WorldState v6` persistence baselines are compiled, unit-tested (**`117/117`** across pure simulation/cottage/inventory/memory/storyline/journal/dialogue/navigation/player/relationship/persistence and Three.js scene suites), and type-checked with **`0` errors**:
- **Authoritative Design & Visual Direction**:
  - Game Design Document: `/GAME_DESIGN.md` (12-section authoritative baseline; currency-free, zero-FOMO, 5-label lifecycle discipline).
  - Official Visual Direction: **PREMIUM HANDCRAFTED STORYBOOK DIORAMA** (`docs/art-direction/VISUAL_IDENTITY.md`) across Willow Step Cottage & Courtyard **+ Enterable Cutaway Interior** (`cottageInterior.ts`), Hearth & Crumb Bakery, Linden Book Nook, Copperwheel Cottage, Sunbeam Greenhouse, Pinecone Woodshop, Old Bell Gazebo, Mossy Stone Fountain, Sora's Tea Cart, Noticeboard, Hollow Oak, Mirror Pond & Cedar Bridge, **Fern Hollow Orchard** (gate/sign, 6 season-tinted crabapple trees, harvest crates, glazed honey crock + `orchard_skep`, permanent cedar **Orchard Tasting Table** + marigold lantern garland, 5 nav nodes, `orchard` zone), 3-draw-call `InstancedMesh` grove, 5 carryable world props, **`4` daily outdoor gathering props** (`cottage_window_box`, `greenhouse_planters`, `orchard_harvest`, `pond_driftwood`), and **`5` walkable cedar benches** (`SEAT_SPOTS`) plus all 10 articulated `CharacterRig` figures.
- **Core Gameplay, Simulation & Narrative Baseline (`IMPLEMENTED`)**:
  - Title Screen (`body[data-state="title"]`) -> Live Isometric Neighborhood (`body[data-state="playing"]`) -> Seeded Deterministic Simulation (`WorldState v6` with `v1 -> v2 -> v3 -> v4 -> v5 -> v6` migration + **`33`-node A* lane navigation** + utility-scored autonomous activities, seat reservation, & `2–3` NPC social encounters + bilateral player/NPC relationship & reliability matrix + bounded per-NPC subjective `npcMemories` & discrete encounter gossip propagation + **`6` multi-stage `storylines`** including `side_orchard_gathering` + cooldowns) -> Willow Step Cottage Cutaway Interior (`7` stations) -> Personal Satchel (`18` items) + `InventoryDrawer` + contextual `DialogueSheet` gifting + 4-section `Pocket Journal` (`Stories`, `Memories`, `People`, `Discoveries` including `Willow Step Cottage & Satchel` and `Fern Hollow Orchard` status projections) -> Normalized `localStorage` Persistence (`little_somewhere_world_v1`).
- **System Lifecycle Snapshot (Aligned with `/GAME_DESIGN.md`)**:
  - **`IMPLEMENTED`**: Core `willow_square` world (`33`-node A*, `5` benches, `5` daily plaza props, `4` daily gathering spots), **enterable Willow Step Cottage cutaway interior (`7` stations)**, **personal satchel inventory (`18` items) & neighbor gifting/keepsakes**, 10 founding residents (`RESIDENT_ORDER` registry including `rowan`), traits/needs/emotions/encounters, bounded `npcMemories` & gossip (`WorldState v4`), `6` multi-stage storylines (`WorldState v5`, including *The Fern Hollow Orchard Gathering*), `WorldState v6` everyday life & home state, 4-tab `Pocket Journal`, Gazebo Bell, 5-layer environment (`360–1290`, `4` weathers, `10`-day `4` seasons), `cozyAudio`, and **complete Fern Hollow Orchard gameplay + micro-life (sway hooks, butterflies, skep bees, `orchard_skep`, Tasting Table, 3 orchard songbirds, seasonal petal/leaf drift)**.
  - **`PLANNED`**: Relationship-tier unlocks, post-Bell Community Projects, further residents beyond Rowan, neighborhood expansions (`REGIONS`).
  - **`LONG-TERM VISION` / `UNDECIDED`**: Fishing, Photography, Pocket Journal collectible albums, Sunday Market (currency-free, zero-FOMO), Seasonal Festivals, Pets, optional Cloud Saves.

---

## 2. Where to Read First

1. `GAME_DESIGN.md` — **Authoritative Game Design Document** (loops, reward philosophy, currency-free rules, and 5-label lifecycle status).
2. `docs/art-direction/VISUAL_IDENTITY.md` & `VISUAL_QUALITY_STANDARDS.md` — **Official Visual Identity (PREMIUM HANDCRAFTED STORYBOOK DIORAMA)** and mandatory asset review checklist.
3. `ARCHITECTURE.md` — System boundaries, `worldRef` vs React snapshot sync, isometric math, 33-node navigation, interior cutaway switching, and reactivity pipeline.
4. `src/game/types.ts` — Single source of truth for `WorldState` (`v6`), `CottageHomeState`, `DailyActivitiesState`, `PersonalItemId`, `StoryFlags`, `StorylineProgress`, `NpcMemoryEntry`, and `DialogueSession`.
5. `src/game/cottage.ts`, `src/game/inventory.ts`, `src/game/actions.ts`, `src/game/simulation.ts`, `src/game/memories.ts`, `src/game/storylines.ts`, `src/game/journal.ts`, `src/game/dialogueEngine.ts`, `src/game/narrative.ts`, & `src/game/storage.ts`.
6. `src/scene/NeighborhoodCanvas.tsx`, `src/scene/builders/orchard.ts`, `src/scene/builders/orchardMicroLife.ts`, `src/scene/builders/cottageInterior.ts`, `src/scene/waterShaders.ts`, & `src/scene/builders/characters.ts`.

---

## 3. Operational Rules & Notes

1. **Software WebGL Timing (`isSoftwareGl`) & Layout Rules**:
   - Headless browsers pace via `afterDraw(tick)` with `dt` clamped to `0.05s`. Never use `backdrop-filter` / `backdrop-blur` over WebGL, keep `VirtualJoystick` `shrink-0` on mobile, keep all mobile buttons `>= 44px`, and always run `npm test` after touching `worldMap.ts`, `cottage.ts`, `residents.ts`, `storage.ts`, or `environmentRenderer.ts`.
2. **Interior vs Exterior Cutaway Contract**:
   - `exteriorRoot` and `interiorRoot` toggle cleanly based on `playerLocation` (`'exterior'` vs `'cottage_interior'`), keeping all exterior rigs (including `orchardMicroLifeRig.group` and `orchardAmbientExtras.group`) parented inside `exteriorRoot`. Indoor tap-to-walk routes via `computeInteriorWaypoints()` around the central dining table.
3. **Environmental & Orchard Contracts**:
   - `OrchardRig.updateWind`, `OrchardRig.setGatheringVisual`, `orchardMicroLifeRig.update`, and `orchardAmbientExtras.update` remain zero-GC and weather-gated; `ORCHARD_TREES`, `ORCHARD_GATE`, and `ORCHARD_TASTING_TABLE` mirror `CIRCLE_OBSTACLES` in `worldMap.ts`.

---

## 4. Verification Status (2026-11-19, after Milestone 3 Build 2 completion)

- `npm test` (`tsx --test src/game/*.test.ts src/scene/*.test.ts`) — **134/134 passing** (`0` failures across all game engine & 3D scene suites, incl. the 8 Round-3 everyday-life weather/ritual suites).
- `npm run lint` (`tsc --noEmit`) — **Passing (0 errors)**.
- `npm run build` (`vite build`) — **Passing**.
- Live Headless Chromium QA (`1440×900` & `390×844` via `?autostart=1`): verified `Orchard Bee Skep [E]` proximity prompt & `"Woven Bee Skep & Honey Crock"` inspect modal, glazed honey crock + bees, permanent Orchard Tasting Table (`spiced_tart_table` & `blossom_honey_picnic` outcomes) with lit marigold lanterns at Golden Hour, all 3 perched orchard songbirds + falling spring blossom drift, Pocket Journal `Stories` (`The Fern Hollow Orchard Gathering`) & `Discoveries` (`Fern Hollow Orchard · Honey Picnic Open`), zero mobile horizontal overflow (`scrollW: 390 === innerW: 390`), and **0 console errors / 0 warnings**.


## 5. Round-2 Verification Addendum (2026-11-20, Milestone 2C Polish Round 2 — Sit & Sip)

- `npm test` — **126/126 passing** (`0` failures; the 121-suite merged orchard + everyday-life baseline + 5 new Round-2 suites: indoor-seat registry contract, sip reducer, player sit/stand + sip-target priority, interior seat proxies (7 cottage + 2 seat), teacup gating, hearth-wall life).
- `npm run lint` (`tsc --noEmit`) — **Passing (0 errors)**; `npm run build` — **Passing** (chunk-size warning unchanged).
- Browser QA (headless Chromium 1440×900 & 390×844, dusk `WorldState v6` save): brew tea → click stool → seated pose → `Sip Warm Chamomile Tea` → `Tea at the Oak Table` card (+8m, day-end clamp verified) → teacup visible while seated → tap-to-walk stand-up re-offers the seat → `A Quiet Warm Chamomile Tea Moment` in Pocket Journal → mute/unmute with ambience clean → mobile zero horizontal overflow → **0 console errors / 0 page errors** across all runs.
## 6. Round-3 Verification Addendum (2026-11-20, Milestone 2C Polish Round 3 — Weather-Aware Home)

- `npm test` — **134/134 passing**; `npx tsc --noEmit` — **0 errors**; `npm run build` — passing (chunk-size warning unchanged).
- Browser QA (headless Chromium 1440×900 & 390×844, rain/sunlit/winter `WorldState v6` saves): rain interiors show streaked dimmed west-window glass, a fogged pane, suppressed sun shaft, and hushed motes (sunlit renders bit-identical to baseline); the shelf clock reads the HUD time; winter feathers the sill with frost; the exterior chimney is clean when `hearthLit: false` and smokes (denser when the kettle is warm) when lit; rain patter room-tone layers under the hearth crackle indoors and stops on mute/exit; full live loop: sit → sip → "Quiet tea-table moments: 1" in the Journal home card → rest wakes into a weather-named morning toast; mobile zero horizontal overflow; save persists across reload; **0 console errors / 0 page errors** across all runs.
- **New contracts to respect**: the interior rig's `update()` now derives weather/season/minuteOfDay reactivity from `WorldState` directly — keep effective-weather logic mirrored with `composeEnvironmentState` (mist lifts after 10:30 AM) if either side changes. `computeChimneySmokeStrength` in `cottage.ts` is the single source of chimney truth; never re-smoke the diorama puffs unconditionally. `homeRitualCount` is derived (never persisted). All Pass 8–12 visuals stay inside existing footprints/wall planes — `COTTAGE_INTERIOR_OBSTACLES` and both interior test contracts remain bit-identical.
