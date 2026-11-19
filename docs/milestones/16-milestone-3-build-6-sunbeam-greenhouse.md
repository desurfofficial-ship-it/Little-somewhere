# Milestone 3 Build 6 — Visitable Sunbeam Greenhouse & Mina's Growing Life

**Status**: `IMPLEMENTED` & Verified (2026-11-20)
**Baseline**: Milestone 3 Build 2 complete (Entry 030) + Milestone 2C polish rounds 1–2 (Entry 031) on `WorldState v6`
**Schema**: `WorldState v7` (`greenhouseState`, `playerLocation += 'greenhouse_interior'`)

---

## 1. Why this build was the correct next step

The Milestone 3 build sequence reconstructed from `WORKLOG.md` (Entries 021, 028, 029, 030, 031) and the
commit history:

| Build | Scope | Status |
| :--- | :--- | :--- |
| M3 Build 1 (Entry 021) | Fern Hollow Orchard — north district landmark | Complete |
| M3 Build 2 (Entry 030) | Completing Fern Hollow Orchard (gathering content) | Complete |
| M3 Build 3 (commits `7c6ae14` / `5aaf384`) | Walkable Willow Step Cottage interior — reverted upstream, later re-shipped | Complete (via Build 5 / M2C) |
| M3 Build 4 (Entry 028) | 10th resident (Rowan) + Fern Hollow micro-life | Complete |
| M3 Build 5 (commit `5879c28`, Entry 029) | Walkable Willow Step Cottage interior diorama | Complete |
| M2C polish rounds 1–2 (Entry 031) | Everyday-life passes 1–7 (EL-01…EL-15) | Complete |

**Build 3 is therefore not the next target** — its scope shipped twice. The authoritative next-build list
(`GAME_DESIGN.md` §12.2 *Next Milestone Builds (PLANNED)*) names **visitable neighbor interiors**
(`Hearth & Crumb`, `Copperwheel`, `Linden Book Nook`, `Sunbeam Greenhouse`), relationship-tier
invitations/teaching, and post-Bell Community Projects. Combined with the design priorities that place
**gardening and growing life** first, **cooking and sharing meals** second, and **deepening existing
residents** fourth, the dependency-satisfied choice is the **Sunbeam Greenhouse interior (Mina)**:

- All dependencies existed: the greenhouse exterior landmark, the outdoor `greenhouse_planters` daily
  prop, Mina's resident definition/dialogue, the satchel + hearth-recipe economy, the cottage cutaway
  interior pattern, and the memory/gossip/journal systems.
- It requires **no new characters and no new districts** (existing residents and established locations first).
- It opens the **grow → harvest → cook/share** chain: greenhouse herbs feed the existing hearth recipes
  (`herb_loaf`, `lavender_shortbread`) and the giftable economy, while sowing/harvesting seeds keep the
  loop self-sustaining and zero-FOMO.

The remaining three interiors, relationship-tier teaching, and post-Bell Community Projects are the
following builds.

---

## 2. Implemented scope

### 2.1 Game layer (`src/game/greenhouse.ts` new, `types.ts`, `inventory.ts`, `actions.ts`, `storage.ts`, `migrations.ts`)

- **Local-coordinate cutaway contract** (mirrors `src/game/cottage.ts`): `GREENHOUSE_BOUNDS`
  (-3.02..3.02 × -2.62..2.62), 4 furniture obstacles (potting bench, growing shelf, rain barrel, worktable),
  5 stations (`GREENHOUSE_INTERACTABLES`), axis-separated sliding (`resolveGreenhouseInteriorMovement`),
  hub-routed waypoints (`computeGreenhouseWaypoints`, 6 hubs, 1–3 leg routes), and
  `selectBestGreenhouseTarget` (distance + facing-cone scoring, bias-free vs. cottage).
- **Shared growing corner**: 4 fixed terracotta pots (`GREENHOUSE_PLOT_COUNT`), 3 registry-derived crops —
  chamomile → `chamomile_blossom` (2 watered nights), lavender → `lavender_sprig` (2), lemon thyme →
  `lemon_thyme` (3). Growth is **day-driven**: only watered pots advance one stage per night
  (`advanceGreenhouseNightlyGrowthInPlace` inside `advanceToNextDay`); unwatered pots simply wait and
  **nothing ever dies**; winter freezes all growth until spring.
- **Seed economy**: 3 new non-giftable flora items (`chamomile_seeds`, `lavender_seeds`, `thyme_seeds`).
  Mina's worktable notes grant a one-time starter packet (chamomile + thyme) and unlock the
  `mem_greenhouse_note` journal memory; every harvest returns one seed fold of its crop.
- **Pure reducers** (`src/game/actions.ts`): `enterGreenhouseAction` / `exitGreenhouseAction` (door spawn
  `GREENHOUSE_DOOR_SPAWN`, porch exit `GREENHOUSE_PORCH_EXIT_POS`, held world props placed on entry),
  `interactWithGreenhouseProp` (station cards + panel routing), `waterGreenhousePlotsAction` (waters all
  thirsty growing pots, +8m, idempotent), `plantSeedAtPlotAction` (consumes a seed, +10m, sowing-night
  watering included, one-time `mem_greenhouse_first_sow`), `harvestPlotAction` (ready pots only, crop
  ×2 + seed ×1, +12m, one-time `mem_greenhouse_first_harvest`), `readGreenhouseNotesAction` (cozy
  seasonal rereads). Exterior `greenhouse_door` prop routes through `interactWithProp`
  (`actionType: 'enter_greenhouse'`).
- **WorldState v7** (`migrations.ts`): `CURRENT_SCHEMA_VERSION = 7`, pure `migrateV6ToV7` (hydrates
  `greenhouseState`, preserves v6 interior locations), `sanitizeGreenhouseState` (fixed 4-pot shelf,
  unknown crop ids reset to empty pots, stage clamped 0–3, negative counters clamped, warning surfaced),
  interior-aware player-position validation for both interiors, and `computeWorldSaveRevision` coverage
  of `noteReadDay` / counters / per-plot fields. `advanceToNextDay` applies nightly growth and places
  players who slept in the greenhouse back at their exterior entry spot.
- **`playerLocation`** gained `'greenhouse_interior'`; `simulation.ts` treats both interiors identically
  (no NPC greetings/encounters indoors; outdoor NPC logic uses `exteriorPlayerPos`).

### 2.2 Scene layer (`src/scene/builders/greenhouseInterior.ts` new, `NeighborhoodCanvas.tsx`)

- **`buildSunbeamGreenhouseInterior`** — Premium Handcrafted Storybook Diorama cutaway: dwarf-stone
  plinth + flagstone floor, timber-framed glass walls (north/west full height, south/east cutaway
  wainscot), pitched glass roof with ridge beam and hanging dried-herb bundles, cedar potting bench
  (seed drawers with brass pulls, soil bag, pot stack, shears, twine), west growing shelf with the four
  registry-z pots (soil mound → sprout → leafy clump → per-crop blooms; watered soil darkens), rain
  barrel with iron bands + hanging copper watering can, Mina's oak worktable (open field notebook with
  ribbon, tea cup, specimen jars, stool), interior door with brass lantern, two tilted sun shafts, 26
  pollen motes, dusk lantern light, per-plot bloom sway — all zero-GC (`update(world, phase, elapsed)`),
  palette-cached materials, tracked disposal, software-GL safe.
- **`buildSunbeamGreenhouseDoorway`** — exterior cedar door (rails + glass pane + brass knob) on the west
  glass wall at `(11.14, 3.2)` facing the plaza, with posts/lintel, hanging lantern, planted sign,
  step stone, and two potted starts; raycast proxy mounted at `(10.98, 1.15, 3.2)`.
- **Canvas cutaway** — `interiorRoot` hosts both interior rigs with location-based visibility; the
  greenhouse gets its own glass-lit ambience branch (cooler hemi, brighter sun by day, below the
  cottage wash threshold; lantern warms dusk); indoor raycast, tap-to-walk (greenhouse walkability +
  hub waypoints), `findNearestInteriorWalkablePoint`, camera snap, and indoor speed cap all branch on
  `playerLocation`; hearth crackle remains cottage-only.

### 2.3 UI layer (`src/components/GreenhousePanel.tsx` new, `App.tsx`, `InventoryDrawer.tsx`)

- **`GreenhousePanel`** ('planting' | 'harvest'): linen storybook card with a live plot-overview strip
  (growing / ready / thirsty chips + season note incl. winter rest), per-seed sow buttons per empty pot,
  harvest cards for ready pots (yield preview + "Harvest Gently"), and a still-growing list with
  nights-grown progress. `>= 44px` touch targets, Escape/`I`/`J` interplay, `anyModalOpen` integration.
- **App flow**: `greenhouse_prop` target branch (exit veil, panel routing, prop cards), `greenhouse_door`
  veil-enter on the exterior, plant/harvest/water handlers with memory chimes, HUD label
  `Sunbeam Greenhouse`, satchel/journal/pause state resets.
- **Satchel**: seeds render with a Sprout icon and "For sowing at Sunbeam Greenhouse" instead of the
  giftable footer.

### 2.4 Dialogue, memory & journal integration

- **Mina topics** (`src/game/narrative.ts`):
  - `side_mina_greenhouse_corner` (personal_story, 16; `requiresMet` + `!greenhousePlanted`): offers the
    shared corner and points to the planting notes; both choices record a warm durable
    `greenhouse_corner_shared` memory for Mina.
  - `daily_mina_greenhouse_checkin` (daily_slice, 15; `requiresMet` + `greenhousePlanted` + `notSeenToday`):
    reacts to **her own greenhouse's observable state** — ready crops, thirsty pots, winter dormancy, or
    steady growth — and records an ephemeral `greenhouse_corner_tended` interaction memory.
  - Knowledge-boundary note: the conditions read only the persisted state of Mina's own building (visible
    to her during daily tending); no cottage-interior or private player actions leak.
- **Pocket Journal** (`src/game/journal.ts`): new `sunbeam_greenhouse` Discoveries row tracking the
  lifecycle `Mina's glass corner` → `Shared corner open` → `N pot(s) growing` / `N ready to harvest` →
  `Resting between sowings` (transformed), with matching summaries. Strictly player-knowledge (the
  player has seen the room); no NPC memory projection.
- **Gossip/web**: Mina's recorded memories flow through the existing encounter-gossip machinery; the
  planting/harvest actions intentionally create **journal** memories only (no NPC witnesses inside the
  greenhouse — the player tends it alone).

---

## 3. Tests (26 new/extended suites; project total 149/149)

- `src/game/greenhouse.test.ts` (16): registry/walkability/stand-spots, hub waypoints, `stageForNights`
  + nightly growth (watered / unwatered / winter dormancy / ready-stable), starter-note grant (once),
  sowing (consume + plot fill + memory-once), sowing rejections (occupied / missing seed / exterior /
  bad index), watering (fills thirsty only, idempotent, no-pot guidance, ready pots free), harvest
  (crop ×2 + seed return + pot reset + flags + memory-once, non-ready rejections), end-to-end loop via
  `advanceToNextDay` (plant → sleep → water → sleep → harvest → re-sow → stall), enter/exit reducers,
  exterior door prop routing, station cards, summary/crop lookups, `v6 -> v7` migration (preserves
  cottage_interior + hydrates plots), sanitizer repairs (unknown crop / garbage rows / clamps), save
  revision sensitivity + serialized round-trip + compact size.
- `src/scene/greenhouseInterior.test.ts` (5): one hit proxy per station at focus points + diorama bounds,
  plot registry mirroring (z positions), growth-stage visual switching (sprout/leafy/per-crop blooms,
  wrong-crop exclusion, 120-update sway bounds), atmosphere (morning vs dusk shafts, dusk lantern,
  240-update mote finiteness/bands), doorway dressing (composite meshes, emissive lantern, bounds,
  disposal).
- `src/game/dialogue.test.ts` (+1): Mina topic gating (met/sideFlags both directions), knowledge-safe
  check-in build variants (ready / thirsty / winter), graph validity.
- `src/game/journal.test.ts` (+1): greenhouse Discoveries lifecycle across all four status states.
- `src/game/inventory.test.ts`: catalog count updated to 21 items.

## 4. Verification (all executed 2026-11-20)

- `npm test` (`tsx --test src/game/*.test.ts src/scene/*.test.ts`) — **149/149 passing** (0 failures).
- `npm run lint` (`tsc --noEmit`) — **0 errors**.
- `npm run build` (`vite build`) — **passing** (pre-existing chunk-size warning tracked as EL-10;
  NeighborhoodCanvas chunk 784.4 kB).
- Live headless Chromium QA (agent-browser, dev server):
  - **Desktop 1440×900**: QA save parked at the greenhouse door → `Step Inside[E]` prompt → veil-enter →
    HUD label `Sunbeam Greenhouse`, interior cutaway rendered (glasshouse shell, bench, shelf, barrel,
    worktable, door) → notes card (`+1 Chamomile Seeds` / `+1 Lemon Thyme Seeds` chips, memory) →
    planting panel (plot overview chips, per-seed sow buttons) → sowed Chamomile Pot 1 (toast, plot
    persisted `stage 0 / wateredToday true / plantedDay 3`) → watering card (idempotent "already
    watered") → stage-1 sprout + stage-3 bloom visuals on the shelf → harvest panel ("Yields Chamomile
    Blossoms ×2 + one seed fold back") → harvest toast + inventory `chamomile_blossom 3` /
    `chamomile_seeds 3` + `totalHarvests 1` + `greenhouseHarvested` flag → Pocket Journal `Discoveries · 7`
    with `Sunbeam Greenhouse — New · Resting between sowings` → Mina dialogue opened with quest-priority
    topic (gating unit-tested) → exterior doorway visual on the west wall → dusk interior with dual
    ready blooms.
  - **Mobile 390×844**: enter flow + toast, interior centered, `scrollW 390 === innerW 390` (zero
    horizontal overflow), 0 buttons below 44px, CTA in the bottom thumb zone.
  - **0 console errors / 0 page errors** across all runs (only benign vite/React-DevTools info logs).

## 5. Known limitations & deferred work

- Waking while inside the greenhouse (rest/day rollover at dusk indoors) steps the player outside to
  their entry spot rather than waking in the room (the greenhouse has no bed); deliberate, gentle.
- The greenhouse interior has no seating or NPC presence — residents never enter interiors by design;
  Mina's presence is expressed through dialogue, her notes, and the exterior micro-life.
- Winter planting is allowed but growth rests until spring (surfaced in the panel, notes, and Mina's
  winter line); no seasonal seed rotation yet.
- The `+2h` HUD button cannot roll the day (existing global behavior); overnight growth requires the
  cottage bed, as designed.
- Harvest yields a fixed crop ×2 + seed ×1 (no quality/streak variance) — kept simple and zero-FOMO.
- `docs/06-production-roadmap.md` referenced by the assignment does not exist in the repository; the
  authoritative roadmap documents are `GAME_DESIGN.md` §12, `docs/production/*`, and this milestone doc.

## 6. Next unfinished builds

Per `GAME_DESIGN.md` §12.2, the remaining PLANNED builds (all dependencies satisfied):
1. **Visitable neighbor interiors** — Hearth & Crumb Bakery (Clara; cooking/sharing meals), Linden Book
   Nook (Nora), Copperwheel Cottage (Arthur) — the greenhouse cutaway pattern now generalizes directly.
2. **Relationship-tier invitations / hobby teaching** (tier-gated experiences).
3. **Post-Bell Community Projects** across the square/orchard.
