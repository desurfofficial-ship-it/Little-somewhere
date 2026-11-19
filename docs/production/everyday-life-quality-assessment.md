# Everyday Life Quality Assessment — Milestone 2C Polish

**Date**: 2026-11-20
**Baseline tree**: `5879c28` (Milestone 3 Build 5 — walkable Willow Step Cottage interior) + Milestone 2C "Everyday Life"
**Method**: Phase Zero research (Lost Garden *Cozy Games*, Three.js lighting/performance threads, game-animation anticipation principles) → repository inspection of `src/game/cottage.ts`, `src/game/inventory.ts`, `src/game/actions.ts`, `src/game/playerController.ts`, `src/scene/builders/cottageInterior.ts`, `src/scene/NeighborhoodCanvas.tsx`, `src/components/CottageStationModal.tsx`, `src/components/DialogueSheet.tsx`, `src/game/audio.ts` → live headless-Chromium playtest (interior dusk loop, hearth brewing, vase/shelf arranging, satchel, door exit, window-box approach, Clara gifting flow) with screenshot review.

Severity scale: **P0** = broken/blocks the loop · **P1** = materially weakens the everyday experience · **P2** = polish gap worth fixing. All findings are evidence-backed; none block shipping today.

---

## 1. What already works well (do not regress)

| Strength | Evidence |
| :--- | :--- |
| Station-modal system is clean and readable | Hearth tab shows per-ingredient have/need with green/red states, disables uncraftable recipes, live "In satchel" badge (playtest qa_03/qa_04) |
| Interior is genuinely save-reactive | `cottageInterior.ts rig.update()` swaps vase bundles, toggles all 5 keepsakes, animates kettle steam only while `kettleWarmUntilMinute` holds, breathes ember emissive, phases the banker's lamp |
| Indoor navigation is real, not faked | `computeInteriorWaypoints` hub routing + `resolveInteriorMovement` axis-sliding; tap-to-walk indoors walks around furniture (`NeighborhoodCanvas.tsx` indoor raycast branch) |
| Everyday actions are integrated with the social systems | `cookRecipeAction` writes a memory; `giveInventoryItemAction` writes NPC memories + witness memories + keepsake rewards; gathering writes journal memories (`orchard_harvest`, `mem_brass_clapper`) |
| In-game clock discipline | Every activity advances `minuteOfDay` (+10…+25m), dusk kettle/lamp/window states respond; no real-time day pressure anywhere |
| Satchel identity | 4 categories with contextual actions (Use at Hearth / Arrange In Vase / Shelf Arrangement) and "On your cottage shelf" state |
| Quality gates | 110/110 `node:test` suites, `tsc --noEmit` 0 errors, `vite build` passing at baseline |

---

## 2. Findings

### EL-01 · P1 — Hearth preparation is a button, not an activity
**Where**: `src/components/CottageStationModal.tsx` (hearth tab), `src/App.tsx handleCookRecipe`, `src/game/actions.ts cookRecipeAction`.
**Evidence**: Clicking "Steep Tea" instantly adds the item; the only feedback is a toast. The directive's core ask — "make preparation feel like an activity rather than a button that adds an item" — is unmet. There is no anticipation, no staged presentation, no completion moment, and the 3D kettle does not react to the brew beyond the generic warm-steam loop.
**Impact**: The single most-repeated everyday interaction feels like inventory bookkeeping.

### EL-02 · P1 — Interior composition reads sparse; furniture lacks lived-in context
**Where**: `src/scene/builders/cottageInterior.ts`.
**Evidence (dusk screenshot review)**:
- The oak dining table has **no seating** — a home where nobody can sit down to tea.
- Wall planes are bare: no curtains, art, clock, or hanging herbs; the plaster reads flat.
- The mid-east corridor and south floor are large empty planks; the sideboard top holds nothing but keepsakes when displayed.
- No sign-of-use props (firewood, books, teacup, cushions) to say "someone lives here".
**Impact**: The room is tidy but un-inhabited; environmental storytelling (pillar 5C of the directive) is thin.

### EL-03 · P1 — Interior lighting is flat and murky at dusk; no atmosphere layer
**Where**: `src/scene/NeighborhoodCanvas.tsx` `isIndoors` lighting branch + `cottageInterior.ts`.
**Evidence**: Phase scaling exists (hemi 0.85→0.58, sun 1.25→0.55, env 0.65→0.42) but:
- The **hearth is lit with `hearthLit: true` yet casts no light into the room** — the fire glows without illuminating anything.
- No window daylight shafts; windows are emissive rectangles only.
- No dust motes or volumetric cue; at dusk the south/east floor falls into undifferentiated brown.
- Backdrop void is a flat dark brown with no depth cue behind the cutaway walls.
**Impact**: The room photographs "functional" but never "warm"; the directive's lighting-hierarchy pillar is unmet.

### EL-04 · P2 — Interior↔exterior transitions are hard cuts
**Where**: `src/App.tsx openTargetInteraction` (`player_door`), `interactWithCottageProp('interior_door')`, `handlePropAction('rest_next_day')`.
**Evidence**: Entering/exiting swaps `playerLocation` and the canvas toggles `interiorRoot.visible` in the same frame; bed rest snaps to the next morning instantly. No veil, no beat, no arrival moment.
**Impact**: The strongest scene change in the game has zero ceremony; transitions feel like a debug toggle.

### EL-05 · P2 — Gathering results hide the item gain inside prose
**Where**: `src/game/actions.ts interactWithProp` (window box, greenhouse, orchard, pond, sill planter) → `PropInteractionResult` → `src/components/DialogueSheet.tsx` prop-card renderer.
**Evidence**: Results are single-paragraph bodies ("Gathered 2 Orchard Crabapples and 1 Orchard Honeycomb…"). Items have no visual chips; counts must be read out of sentences. `PropInteractionResult` has no structured `gainedItems` field to render.
**Impact**: Acquisition — the reward beat of every gathering loop — is typographically flat.

### EL-06 · P2 — Station interactions are silent
**Where**: `src/game/audio.ts` (engine exposes `playUiTap`, `playMemoryChime`, `playWaterSplash`…), `CottageStationModal.tsx`, `App.tsx`.
**Evidence**: Brewing, arranging, and shelf-toggling all reuse the generic `playUiTap`. No kettle/steam/arrange sound identity for the home stations, though the audio engine pattern makes adding two short procedural SFX cheap and safe.
**Impact**: The hearth — described in copy as crackling — never crackles.

### EL-07 · P2 — Empty-state readability of the vase is weak
**Where**: `cottageInterior.ts` `vaseEmptyGroup` (a small twine collar), `CottageStationModal.tsx` vase tab.
**Evidence**: With no flower placed, the 3D pitcher reads as "vase with a ring"; playtest showed the empty state is easy to miss from the default camera.
**Impact**: Minor, but the vase is a daily touchpoint.

### EL-08 · P2 — Bed rest lacks a closing beat
**Where**: `App.tsx handlePropAction('rest_next_day')`.
**Evidence**: Rest plays a chime + toast but the world jumps; combined with EL-04 the same veil can give both door and bed transitions a shared, gentle closing beat.

### EL-09 · P2 — Indoor movement pacing un-tuned for the tight room
**Where**: `src/game/playerController.ts` (`stepPlayerMovement`), interior radius 0.42.
**Evidence**: Full run/sprint tier (up to 7.6 m/s) is reachable inside a 7×5.4 m room; sprinting indoors overshoots interaction approach points and can clip the player into the wall-slide loop. Exterior pacing is good and must not change.

### EL-10 · P2 — Build chunk warning persists (existing backlog, not a regression)
**Where**: `vite build` warns chunk > 500 kB (lazy scene chunk, by design from R-09). Track only; no action in this pass beyond not adding heavy imports.

---

## 3. What this assessment does NOT flag (checked and healthy)

- **Save/persistence**: autosave flush, `getSaveStamp` revisioning, and `WorldState v6` migration untouched by everyday actions; playtest reload preserved state.
- **NPC integration**: gifting writes bounded NPC memories + witness records through the existing `memories.ts` pipeline (no parallel system introduced).
- **Mobile UI**: all modal buttons keep `min-h-[44px]` targets; station tabs scroll horizontally on narrow widths.
- **Console hygiene**: 0 console errors / 0 page errors across the playtest session.

---

## 4. Production quality target (measurable)

"LITTLE SOMEWHERE everyday life is exceptional when, on a fresh save and a Day-3 decorated save:

1. Brewing tea at the hearth is a staged, audible, ~2 s activity with a completion card — and the 3D kettle visibly reacts.
2. The cottage interior reads as a lived-in home: seating at the table, dressed windows/walls, sign-of-use props, and a hearth that actually lights the room at dusk.
3. Interior daylight has a visible shaft + dust-mote layer, and the room never falls into undifferentiated murk at any phase.
4. Entering, leaving, and resting fade through a soft veil instead of hard cuts.
5. Every gathering result shows explicit item chips ("+2 Orchard Crabapple") in addition to prose.
6. All 110+ unit suites, `tsc`, and `vite build` stay green; console stays at 0 errors; the deferred scene chunk does not grow materially."
