# Milestone 3 Build 7 — Visitable Hearth & Crumb Bakery (Clara's Warm Kitchen)

**Status**: COMPLETE & VERIFIED (2026-11-20)
**Base**: Milestone 3 Build 6 tree (`WorldState v7`, 157/157 tests)
**Authoritative scope source**: `GAME_DESIGN.md` §12.2 (`docs/milestones/16…md` §6 list item 1)

## 1. Why this build is next

`HANDOVER.md` and `docs/milestones/16…md` §6 both name **visitable neighbor interiors** as the
next dependency-satisfied build. Hearth & Crumb Bakery (Clara) is first because:

- **Cooking & sharing meals** is a core design pillar and Clara is its lead resident
  (`residents.ts`: "Sourdough Baker", schedule anchored at the bakery).
- The greenhouse cutaway pattern (M3 Build 6) generalizes directly — proven contracts,
  zero new dependencies, no render-architecture changes.
- It deepens an **existing** resident and an **existing** landmark (exterior already dressed:
  awning, oven dome, display shelf, chalkboard, café tables) — highest story value per risk.
- No new characters, no currency, no management mechanics: the player **helps and shares**,
  never runs the shop (cozy genre red line).

## 2. Implemented scope

### Game layer — `src/game/bakery.ts` (new) + contracts

- Local-coordinate cutaway contract mirroring `cottage.ts`/`greenhouse.ts`:
  `BAKERY_BOUNDS` (-3.0..3.0 × -2.4..2.4), 4 furniture obstacles (`bakery_oven`,
  `bakery_counter`, `bakery_prep`, `bakery_table`), 5 stations + sliding movement +
  6-hub waypoint routing + `selectBestBakeryTarget` (distance + facing cone).
- **Interior door** (south wall, centered) ↔ exterior `bakery_door` prop at
  (-12.4, -7.05) with porch exit (-12.4, -6.8).
- One **indoor café-chair seat** (`BAKERY_SEAT_SPOTS`, `indoor: true`) reusing the
  cottage sit-and-sip ritual; never claimed by NPCs (residents never enter interiors).
- **Deterministic daily bake roster** (`getBakeForDay`): day % 4 → Sunflower Sourdough
  (shares Herb & Honey Loaf) / Crabapple Galette (Rustic Crabapple Tart) / Lavender
  Butter Batch (Lavender Biscuits) / **oven-rest day** (embers only, no share).
  No new inventory items — shares map onto the existing baked-treat catalog (21 items).
- Daily rituals (each once per in-game day): **check the morning bake** (+8m), **help
  knead dough** (+12m; doubles that day's counter share), **share the morning loaf**
  (+6m), **read Clara's recipe notes** (one-time starter loaf + seasonal rereads, +8m).
- `WorldState v8`: `bakeryState` (`bakeCheckedDay`, `kneadedDay`, `loafSharedDay`,
  `notesReadDay`, `starterNotesDay`, `kneadingSessions`, `loavesShared`),
  `migrateV7ToV8`, `sanitizeBakeryState`, interior-aware spawn/walkability validation,
  save-revision sensitivity, `playerLocation += 'bakery_interior'`.

### Scene layer — `src/scene/builders/bakeryInterior.ts` (new)

- Premium Handcrafted Storybook Diorama cutaway: plank floor + dwarf-stone plinth,
  tall north/west walls, cutaway south/east wainscot; brick dome bake-oven with iron
  door + flue + flickering ember light, cedar service counter with loaf display +
  brass bell + flour sacks, flour-dusted prep table (dough mound, pin, jar, linen),
  east recipe-note shelf + hanging copper pans, round café table with the interactive
  chair, interior door + mat + lantern, morning window shaft, warm flour-dust motes.
- Zero-GC `update(world, phase, elapsed)`: oven glow by bake/rest day, bake-steam
  puffs gated on `bakeCheckedDay === day` (active bake), dusk lantern warm-up,
  idle dough-cloth sway; palette-cached materials, tracked disposal.
- Exterior doorway dressing (step stone + lantern accent) + raycast proxy on the
  building's existing south door.

### Dialogue, memories & journal

- `side_clara_bakery_kitchen` (personal_story; requiresMet + !`bakeryVisited`): Clara
  invites the player into her kitchen; accepting records a warm durable memory and
  sets `sideFlags.bakeryVisited`.
- `daily_clara_bakery_checkin` (daily_slice; requiresMet + `bakeryVisited` +
  notSeenToday): reacts only to **her own bakery's observable state** (kneaded today,
  loaf shared, oven-rest day) with an ephemeral interaction memory — knowledge boundary
  identical to Mina's greenhouse check-in.
- Player-only journal memories: first bake check, first knead, first shared loaf,
  recipe-notes starter (no NPC witnesses inside; Clara's own topics flow via gossip).
- Pocket Journal: new `claras_kitchen` Discoveries row tracking `Clara's warm kitchen`
  → `Morning bake: {bake}` → `N loaves shared` → `Oven resting today`.

### UI

- **No new panel component**: all five stations resolve through existing prop-card
  sheets (single-click rituals, unlike the greenhouse's multi-pot board). App wiring:
  `bakery_prop` branch, exterior `bakery_door` veil-enter, HUD label
  `Hearth & Crumb Bakery`, camera reuses the cottage close-up framing.

## 3. Protected systems

- Milestone 2A/2B systems, storyline definitions, WorldState migration chain
  (additive v7→v8 only), NPC simulation architecture, render architecture untouched.
- `COTTAGE_*`, `GREENHOUSE_*` contracts bit-identical; greenhouse behaviors unchanged.
- No currency, no shop/management loop, no new dependencies, no real-world-day mechanics.

## 4. Verification plan

- `npm test` (target ≥ 180 suites), `tsc --noEmit`, `vite build`.
- Headless Chromium QA (1440×900 + 390×844, QA save via `scripts/`): exterior door →
  veil-enter → interior cutaway → bake check → knead → doubled counter share →
  café-chair sit + sip → notes starter → Pocket Journal row → Clara check-in gating →
  reload persistence → mobile zero overflow → **0 console / 0 page errors**.
- Push `main` after gates pass (per standing Git instruction).

## 5. Verification (executed 2026-11-20)

- `npm test` — **182/182 passing** (`0` failures; 157 Build-6 baseline + 18 `bakery.test.ts` + 5 `bakeryInterior.test.ts` + Clara dialogue gating + journal discovery lifecycle; the v6→v7 migration test updated for the chained v6→v7→v8 result, every v7 invariant preserved).
- `npx tsc --noEmit` — **0 errors**. `npm run build` — passing (pre-existing chunk-size warning unchanged, EL-10).
- Headless Chromium QA (agent-browser, dev server, `scripts/make_build7_save.ts` QA saves with the pagehide-flush-neutralizing injection pattern):
  - **Desktop 1440×900**: exterior bakery porch — `Hearth & Crumb Bakery Door` proximity prompt with `Step Inside[E]` → veil-enter → HUD `Hearth & Crumb Bakery` → interior cutaway rendered (brick dome oven + chimney breast, counter + chalk slate, flour-dusted prep, café table + chairs, porch door, plank floor) → `Sit on Café Corner Chair` → seated → `Stand Up` → oven: `Today's bake: Sunflower Sourdough (+8m)` + `Memory saved: The Morning Bake Reveal` → prep: `(+12m)` + `Flour on My Sleeves` → counter: **`+2 Herb & Honey Loaf`** chip (kneaded-batch doubling) + `A Warm Loaf, Offered` → notes: `+1 Herb & Honey Loaf` + `Clara's Kitchen Margins` → Pocket Journal `Discoveries · 8` with `Hearth & Crumb Kitchen · Morning bake: Sunflower Sourdough` → door exit toast → full reload persistence (`herb_loaf: 3`, complete `bakeryState`, 3 bakery memories).
  - **Reactive layer**: steam puffs over the oven mouth after the bake check (gated off before the reveal and on rest days per unit tests), ember glow warmer on bake days / banked on rest days, counter loaf row hidden on rest days.
  - **Clara dialogue**: quest-priority topic selection intact (gazebo-bell topic outranks the daily slice, matching Mina's greenhouse check-in pattern); bakery topic gating (`bakeryVisited` flag, knowledge boundary) covered by unit selection tests.
  - **Mobile 390×844**: exterior bakery view (awning, loaf shelf, chalkboard, porch lantern + delivery crate dressing) → `Step Inside` CTA → interior loads; `scrollW 390 === innerW 390` (zero overflow); minimum interactive control 44px.
  - **0 console errors / 0 page errors** across all runs.
- Asset Source Note (Permanent Instruction 15): all Build 7 assets are **Option A — self-built procedural Three.js** (palette-keyed composite meshes, tracked-geometry cutaway room, pooled steam puffs, registry-derived prose). Option B Polyfork evaluated: no benefit — every prop is contract-bound to `BAKERY_INTERACTABLES`/`BAKERY_INTERIOR_OBSTACLES`, the bake-roster rig updates, and the v8 save schema, which imported GLTFs would violate. Options C/D not used; no external assets entered the build.
- Remaining limitations: residents never enter the bakery interior (consistent with all interiors); the daily bake roster is a fixed 4-day cycle (bake → bake → bake → rest); the kneaded-batch doubling caps at ×2; Clara's check-in surfaces only after quest-priority topics resolve (by design, shared with all daily slices).
