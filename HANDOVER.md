# HANDOVER.md — Agent & Engineer Handover Brief

**Project**: LITTLE SOMEWHERE  
**Current Phase**: **Milestone 2B `IN PROGRESS`** (**Phases 1–4 Done**: Declarative Dialogue, Relationships, `WorldState v4` NPC Memories/Gossip, & `WorldState v5` Multi-Stage Storylines/Conflicts; **Phase 5 `PLANNED`** `JournalDrawer.tsx` UI) · **Milestone 3 Build 1 (`Fern Hollow Orchard`) `IN PROGRESS`** (Scenery, `33`-node A* & Bench Done; Gameplay **`PLANNED`**)  
**Target Next Milestone**: Milestone 2B Phase 5 (`JournalDrawer.tsx` dynamic storylines & gossip chronicle) or Milestone 3 Foundation / Interiors upon explicit approval

---

## 1. Current State of the Repository

All core simulation, dialogue, relationship, NPC memory/gossip, multi-stage storyline/conflict, environment, water, bench, orchard diorama, and persistence baselines are compiled, unit-tested (**`87/87`** across pure simulation/memory/storyline/dialogue/navigation/player/relationship/persistence and Three.js scene suites), and type-checked with **`0` errors**:
- **Authoritative Design & Visual Direction**:
  - Game Design Document: `/GAME_DESIGN.md` (12-section authoritative baseline; currency-free, zero-FOMO, 5-label lifecycle discipline).
  - Official Visual Direction: **PREMIUM HANDCRAFTED STORYBOOK DIORAMA** (`docs/art-direction/VISUAL_IDENTITY.md`) across Willow Step Cottage & Courtyard, Hearth & Crumb Bakery, Linden Book Nook, Copperwheel Cottage, Sunbeam Greenhouse, Pinecone Woodshop, Old Bell Gazebo, Mossy Stone Fountain (double-moulded basin, clog debris -> submerged wishing coins, curved `TubeGeometry` cascades, splash rings, custom water shader, coin-wish interaction), Sora's Tea Cart, Noticeboard, Hollow Oak, Mirror Pond & Cedar Bridge (custom flowing caustic/weather/winter/dusk shader, west brook culvert, swimming koi, lily blooms, reeds, dragonflies, anchored cedar pier + sailboat, stone-skipping interaction), **Fern Hollow Orchard** (gate/sign, 6 season-tinted crabapple trees, harvest ladder/crates, bee skep, 5 nav nodes, `orchard` zone), 3-draw-call `InstancedMesh` grove, 5 carryable world props, and **`5` walkable cedar benches** (`SEAT_SPOTS`, including `seat_orchard_bench`) plus all 10 articulated `CharacterRig` figures.
- **Core Gameplay, Simulation & Narrative Baseline (`IMPLEMENTED`)**:
  - Title Screen (`body[data-state="title"]`) -> Live Isometric Neighborhood (`body[data-state="playing"]`) -> Seeded Deterministic Simulation (`WorldState v5` with `v1 -> v2 -> v3 -> v4 -> v5` migration + **`33`-node A* lane navigation** + utility-scored autonomous activities, seat reservation, & `2–3` NPC social encounters + bilateral player/NPC relationship & reliability matrix + bounded per-NPC subjective `npcMemories` & discrete encounter gossip propagation + multi-stage `storylines` progression & cooldowns) -> Analog Walk/Run/Sprint, Bridge Elevation, Carryable Prop Cradle & Gifting, Bench Sitting (`computeSitGroundY`), Contextual Player/NPC Poses (`wave`, `talk`, `interact`, `sit`, `carry`) & Dialogue Camera Framing -> Declarative `dialogueEngine.ts` (9 categories, relationship-modulated greetings, tier icons + milestone avatar bounce, strictly knowledge-based non-omniscient third-party gossip & event reactions with provenance/descriptive distortion, conflict mediation, `make_amends` recovery, *The Silent Gazebo Bell*, 4 upgraded 3-stage personal arcs + `conflict_plaza_lanterns` 3-stage conflict + knowledge-gated storyline epilogues, unified `jun_advice` `mem_postcard_sent` & direct `hollow_oak` `mem_brass_clapper` memory unlocks, anti-repeat `topicHistory`) -> Interactive Water Landmarks (`fountain_plaza` lucky coin wish & `mirror_pond` stone skipping) -> Normalized `localStorage` Persistence (`little_somewhere_world_v1`).
- **System Lifecycle Snapshot (Aligned with `/GAME_DESIGN.md`)**:
  - **`IMPLEMENTED`**: Core `willow_square` world (`33`-node A*, `5` benches, `5` daily-reset plaza props), 9 founding residents (`RESIDENT_ORDER` scalable registry), traits/needs/emotions/encounters, player–NPC & NPC–NPC matrices, bounded `npcMemories` & deterministic encounter gossip (`WorldState v4`), multi-stage personal storylines & interconnected `conflict_plaza_lanterns` (`WorldState v5`), non-omniscient third-party player gossip & event reactions, Gazebo Bell, 5-layer environment (`360–1290` `6:00 AM–9:30 PM`, `4` weathers, `10`-day `4` seasons), `cozyAudio`.
  - **`IN PROGRESS`**: **Milestone 2B** (Phases 1–4 done; Phase 5 `JournalDrawer.tsx` pending) and **Fern Hollow Orchard** (scenery/nav/bench built; resident schedules & harvest/skep play pending).
  - **`PLANNED`**: Milestone 2B Phases 4–5 (`storylines.ts` & `WorldState v5`, dynamic `JournalDrawer` removing `Reliability %`), enterable cottage interiors, personal inventory (strictly separate from 5 daily plaza props), Priority #1 Gardening & #2 Cooking, Clara & Mina Orchard play, relationship-tier unlocks, post-Bell Community Projects, additional residents.
  - **`LONG-TERM VISION` / `UNDECIDED`**: Fishing, Decorating, Photography, Pocket Journal collectible albums, Sunday Market (separate 7-day cadence preserving `DAYS_PER_SEASON = 10`, zero-FOMO, currency-free), Seasonal Festivals, `REGIONS` districts, Pets, optional Cloud Saves; exact tier unlock tables, inventory sizing, and market swap etiquette remain `UNDECIDED`.
- **Prototype Scope Note (9 Founding Residents)**: Clara, Arthur, Mina, Jun, Barnaby, Sora, Toby, Nora, and Pip form a controlled starting population inside `willow_square`—architecture, UI, and tests derive counts from `RESIDENT_ORDER.length` and pair keys cleanly.

---

## 2. Where to Read First

1. `GAME_DESIGN.md` — **Authoritative Game Design Document** (loops, reward philosophy, currency-free rules, and 5-label lifecycle status).
2. `docs/art-direction/VISUAL_IDENTITY.md` & `VISUAL_QUALITY_STANDARDS.md` — **Official Visual Identity (PREMIUM HANDCRAFTED STORYBOOK DIORAMA)** and mandatory asset review checklist.
3. `ARCHITECTURE.md` — System boundaries, `worldRef` vs React snapshot sync, isometric math, 33-node navigation, and reactivity pipeline.
4. `src/game/types.ts` — Single source of truth for `WorldState` (`v5`), `StoryFlags`, `StorylineProgress`, `NpcMemoryEntry`, `PlayerPosture`, `CarryableItemId`, `DialogueTopic`, and `DialogueSession`.
5. `src/game/playerController.ts`, `src/game/simulation.ts`, `src/game/memories.ts`, `src/game/storylines.ts`, `src/game/dialogueEngine.ts`, `src/game/narrative.ts`, & `src/game/storage.ts` — Movement/posture/targeting math, headless NPC life simulation, bounded subjective NPC memory & gossip engine, declarative multi-stage storyline registry & engine, dialogue selector, and normalized `v5` persistence.
6. `src/scene/NeighborhoodCanvas.tsx`, `src/scene/waterShaders.ts`, & `src/scene/builders/characters.ts` — Three.js scene lifecycle, custom water shaders, A* tap-to-walk, dialogue camera framing, procedural character poses/cradle kinematics, and `isSoftwareGl` rendering.

---

## 3. Operational Rules & Notes

1. **Software WebGL Timing (`isSoftwareGl`) & Layout Rules**:
   - Headless browsers pace via `afterDraw(tick)` with `dt` clamped to `0.05s`. Never use `backdrop-filter` / `backdrop-blur` over WebGL, keep `VirtualJoystick` `shrink-0` on mobile, and always run `npm test` after touching `worldMap.ts`, `residents.ts`, `storage.ts`, or `environmentRenderer.ts`.
2. **Environmental Hooks Now Wired (Milestone 3 polish foundation)**:
   - `puddlesActive`, `claraPastryBasketVisible`, `minaGreenhouseStage`, and `arthurEarlyPorchLamp` all have 3D visual layers in `src/scene/builders/reactiveProps.ts` (built once in `NeighborhoodCanvas.tsx`, toggled/animated by `environmentRenderer.ts`).
   - Meadow margins additionally carry instanced botanical dressing (`src/scene/builders/botanicalDressing.ts`); when adding lanes or obstacles, keep `COBBLE_LANE_RECTS` in sync with the cobble strips and the dressing placement tests will guard walkability.
   - **Visual backlog**: `docs/audits/09-comprehensive-asset-visual-audit.md` (2026-11-19) supersedes `docs/art-direction/VISUAL_AUDIT.md`; it confirms zero P0 defects. **All roadmap items R-01..R-09 are now implemented** (WORKLOG Entries 017-019): R-01 golden/dusk lighting drama, R-02 water elevation (Entry 014), R-03 touch-only VirtualJoystick (`(pointer: coarse)` OR `maxTouchPoints > 0`), R-04 sculpted 3-blade tufts, R-05 meadow macro lightMap, R-06 legacy builder removal, R-07 Copperwheel signature props, R-08 title orbit gaze bias + slimmed card, R-09 lazy scene chunk (408 kB shell / 720 kB deferred).
  - **Milestone 3 groundwork started (Entry 020)**: **Fern Hollow Orchard** north district landmark is live (`src/scene/builders/orchard.ts`). Contract: the builder's exported `ORCHARD_TREES` / `ORCHARD_GATE` must stay in exact sync with their `CIRCLE_OBSTACLES` entries (enforced by `src/scene/orchard.test.ts`); orchard crowns reuse the cached `grove_crown_base` / `grove_crown_top` materials so the season tint colors them — do not clone those materials. Nav access flows through `orchard_gate` / `orchard_south` / `orchard_west` / `orchard_bench` / `orchard_east` nodes; `seat_orchard_bench` is the 5th `SEAT_SPOTS` entry (bench auto-placed by the canvas seat loop).
   - **VirtualJoystick rule update**: the thumbstick renders only when `hasTouchInput` (`pointer: coarse` media query or `navigator.maxTouchPoints > 0`); it is hidden on mouse-first desktops with an inert spacer preserving the bottom-bar flex layout.
   - **Ground material rule**: the meadow ground uses `map` (512², 9x9) + `lightMap` macro variation (256², 2x2) over a cloned `uv1` channel; season tint multiplies on top. Keep both when touching `groundMat`.
   - Remaining Milestone 3 work: walkable interiors, additional residents, and further region dressing building on the Fern Hollow Orchard pattern (obstacle-synced builder + nav nodes + landmark zone + seat).

---

## 4. Verification Status (2026-11-19, Milestone 2B Phase 4: Multi-Stage Storylines & Conflict Baseline)

- `npm test` (`tsx --test src/game/*.test.ts src/scene/*.test.ts`) — **87/87 passing** (`0` failures; adds Phase 4 storyline, v4->v5 migration, and cooldown gate suites in `storylines.test.ts`, `storage.test.ts`, and `dialogue.test.ts`)
- `npm run lint` (`tsc --noEmit`) — **Passing (`0` errors)**
- `npm run build` (`vite build`) — **Passing** (`index` `734.57 kB` shell + `NeighborhoodCanvas` `728.48 kB` deferred via `React.lazy`)
- Live Browser QA (headless Chromium `1440×900` & `390×844`): verified `?autostart=1` world render, zero horizontal overflow, interactive dialog sheet, `localStorage` persistence of `schemaVersion: 5` with `storylines`, and **0 console errors / 0 warnings** (`JournalDrawer.tsx` left untouched pending Phase 5).





