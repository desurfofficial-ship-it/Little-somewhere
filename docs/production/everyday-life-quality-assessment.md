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

## 5. Round-2 findings (2026-11-20, after Passes 1–4 shipped)

**Method**: re-playtest on a fresh headless session (desktop 1440×900 + mobile 390×844) with the dusk `WorldState v6` save, full hearth→satchel→vase→shelf→door loop exercised, plus a line-level re-read of `src/game/cottage.ts`, `src/game/playerController.ts`, `src/game/actions.ts`, `src/game/inventory.ts`, `src/scene/builders/cottageInterior.ts`, `src/scene/NeighborhoodCanvas.tsx`, and `src/game/audio.ts`. Baseline at commit `86ba9e2` (115/115 suites, `tsc` 0 errors, build green).

### EL-11 · P1 — The dining stools are decoration; the player cannot sit at home
**Where**: `src/game/worldMap.ts SEAT_SPOTS` (outdoor-only), `src/game/cottage.ts selectBestInteriorTarget` (cottage props only), `src/game/playerController.ts selectBestInteractiveTarget` (indoor branch never offers seats).
**Evidence**: All six `SEAT_SPOTS` entries are outdoor benches; the two carved stools built in Pass 1 are static meshes. The seated-player pipeline (`playerPosture: 'sitting'`, sit pose in `characters.ts`, `computeSitGroundY`, move-to-stand release) is fully generic and works for any seat — only the seat registry and target selection are missing indoors. Playtest confirms the action button cycles only cottage props; no "Sit" ever appears.
**Impact**: The directive's end-state vision is "brew tea, **sit down**, tidy things, enjoy home" — the sit beat is the missing piece of that sentence.

### EL-12 · P1 — Brewed drinks have no enjoyment moment; hearth→table routine is severed
**Where**: `src/game/inventory.ts` (drink items are `baked_treat` with no consume path), `src/game/actions.ts` (no sip/serve action).
**Evidence**: `chamomile_pear_tea` can be brewed, gifted, or carried forever, but never consumed at home. The routine breaks: brew → item lands in satchel → nothing in the room acknowledges it.
**Impact**: The most-produced home item has no payoff ritual; the home loop reads as production + storage rather than living.

### EL-13 · P2 — Hearth wall lacks mantel life and kitchen sign-of-use
**Where**: `src/scene/builders/cottageInterior.ts` (mantle at y 1.52 is bare; counter top at y 0.92 is bare).
**Evidence**: Dusk screenshot review — the chimney breast dominates the north-west but is a blank slab; the cream counter reads as an empty white box; EL-02's wall dressing did not extend to the hearth zone.
**Impact**: The room's primary activity anchor is its least-inhabited surface.

### EL-14 · P2 — The hearth never audibly crackles; no indoor room-tone
**Where**: `src/game/audio.ts` (one-shot SFX only; no loop manager).
**Evidence**: Hearth copy says "Embers crackle warmly" — brewing plays a kettle swell once, but sitting in the room is silent regardless of `hearthLit`.
**Impact**: The strongest ambience opportunity in the game is unused; home feels quieter than the porch.

### EL-15 · P2 — Door-side floor quadrant is undressed
**Where**: `cottageInterior.ts` south-east floor (between door jamb and desk).
**Evidence**: Dusk screenshot — the door-to-desk diagonal is bare plank; entry area has a doormat but no boots/peg/coat cue to say "someone comes home here".
**Impact**: Minor, but it is the first floor the player sees on every entry.

### Round-2 healthy checks (do not regress)
- Passes 1–4 hold: dressing, atmosphere layer, brew overlay, item chips, veil transitions, indoor speed cap all verified live.
- Save persistence (`WorldState v6`), NPC memory/gossip pipeline, mobile hit targets, 0 console errors — all unchanged.

### Round-3 findings (2026-11-20, after Passes 5–7 shipped, baseline `7c2867e`)

**Method**: fresh headless-Chromium playtest on rain-dusk / rain-morning / sunlit-morning `WorldState v6` saves (1440×900, 0 page errors), plus a line-level re-read of `src/scene/builders/cottageInterior.ts`, `src/scene/prototypes/willowLaneDiorama.ts`, `src/scene/NeighborhoodCanvas.tsx`, `src/game/audio.ts`, `src/game/actions.ts`, `src/game/journal.ts`, and `src/game/narrative.ts`.

### EL-16 · P1 — The interior ignores weather entirely; the room cannot feel the rain
**Where**: `src/scene/builders/cottageInterior.ts` (`rig.update` reads only `phase`), `src/scene/NeighborhoodCanvas.tsx` indoor branch.
**Evidence**: With the HUD reading "Light Rain" (dusk 1120 and morning 500 saves), the west window glass shows the identical fair-weather emissive view, the morning sun shaft blazes at full opacity across the bed (baseline shot `05-interior-morning-rain.png`), no streaks or wet-glass cue exist, and the linen curtains never stir — even in `breezy`. Outdoors, rain streaks/puddles render convincingly (shot `04-exterior-dusk-rain.png`), so stepping inside severs the weather.
**Impact**: The directive's "weather-of-the-day atmosphere" pillar stops at the doorstep; the strongest mood lever in the game is unused indoors.

### EL-17 · P2 — The wall clock is frozen
**Where**: `cottageInterior.ts` — `clockHandM.rotation.z = 2.1` set once at build; never updated.
**Evidence**: HUD reads 6:40 PM while the shelf clock reads ~7:10 in every screenshot, at every hour.
**Impact**: The room's most legible "living clock" prop contradicts the in-game time it sits under.

### EL-18 · P2 — Chimney smoke ignores the hearth state
**Where**: `src/scene/prototypes/willowLaneDiorama.ts` `updateWillowPrototypeMotion` — smoke puffs animate unconditionally.
**Evidence**: `cottageState.hearthLit` and `kettleWarmUntilMinute` gate the interior fire, kettle steam, and crackle audio, but the exterior chimney puffs run regardless; a cold hearth still smokes.
**Impact**: The exterior↔home-state link ("your home breathes") is severed exactly where neighbors could see it.

### EL-19 · P2 — Rain is silent indoors; no rain room-tone
**Where**: `src/game/audio.ts` (one hearth loop only), `NeighborhoodCanvas.tsx` ambience gating.
**Evidence**: The ambience layer has exactly one room-tone (`playHearthAmbience`); `light_rain` days produce no patter bed indoors, so the rainy world is a silent film inside the cottage.
**Impact**: Pass 7's room-tone concept stops at the hearth; rain days feel identical acoustically to sunlit ones.

### EL-20 · P2 — The morning wake beat is weather-blind
**Where**: `src/App.tsx` `handlePropAction('rest_next_day')` → `performNextDayRest` (which already rolls `weather: rollWeatherForDay(simSeed, nextDay)`).
**Evidence**: The post-rest toast is always "Good morning! Day N begins in Little Somewhere." even though the new day's weather and season are already computed and drive the whole scene.
**Impact**: The daily reset — the game's strongest ritual — never acknowledges the world it just built.

### Round-3 healthy checks (do not regress)
- Passes 1–7 hold: dressed interior, atmosphere layer, staged brew, chips, veil transitions, indoor pace cap, sit & sip ritual, mantel/counter/entry life, crackle room-tone all verified live; 126/126 suites, `tsc` 0 errors, build green at `7c2867e`.
- Save persistence (`WorldState v6`), NPC memory/gossip pipeline, mobile hit targets, 0 console/page errors — unchanged.

## 6. Production quality target (round 3 — measurable)

"Willow Step Cottage is *lived in* when:

12. Rain and mist reach the room: streaked, dimmed glass; suppressed light shafts; hushed motes; curtains stir in a breeze; winter feathers the sill with frost — and a soft rain patter joins the room-tone.
13. The shelf clock reads the actual in-game time.
14. The exterior chimney smokes only while the hearth is lit, and breathes harder while the kettle is warm.
15. A neighbor can reference the kettle's steam and the vase, and the Pocket Journal home card counts quiet tea-table moments.
16. Waking up names the weather you wake into.
17. All 126+ suites, `tsc`, and `vite build` stay green; obstacle/collision contracts bit-identical; no save-schema version bump."
