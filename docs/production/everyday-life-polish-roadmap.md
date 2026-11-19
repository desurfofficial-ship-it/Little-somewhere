# Everyday Life Polish Roadmap — Milestone 2C

**Date**: 2026-11-20
**Companion docs**: `everyday-life-quality-assessment.md` (findings EL-01…EL-10), `everyday-life-visual-direction.md` (visual targets).
**Execution policy**: passes run in dependency order; after each pass the roadmap is reassessed. No save-schema changes; no gameplay-genre changes; completed Milestone 2A/2B systems are protected.

---

## Pass 1 — Cottage interior composition & environmental storytelling (EL-02, EL-07)

**Outcome**: Willow Step Cottage reads as a lived-in, intentionally composed home instead of a furnished diorama.

**Systems affected / files**: `src/scene/builders/cottageInterior.ts` only (visual layer; zero game-state changes).

**Technical approach** (all static meshes from the shared `MaterialPalette`, within the existing `COTTAGE_INTERIOR_OBSTACLES` footprints so collision stays bit-identical):
- Two carved cedar **dining stools** tucked against the oak table (inside the table's obstacle box).
- **Linen curtains** on the west sunlit window and north wall windows (wall-plane mounted, no new obstacles).
- **Wall dressing**: two small framed botanical prints, a round wall clock above the keepsake shelf, a hanging dried-herb bundle beside the hearth chimney.
- **Sign-of-use props**: firewood basket by the hearth, book stack + teacup on the sideboard, rolled blanket on the bed foot, umbrella + scarf by the door, small potted plants on the sill and sideboard.
- **Dusk-aware floor lamp** in the bed corner (emissive shade driven by the existing phase logic).
- **Stronger empty-vase cue**: dry stems + small tag on the empty pitcher group.
- Rug gets a stitched border ring for craft readability.

**Dependencies**: none. **Tests**: extend `src/scene/cottageInterior.test.ts` — height bounds still ≤ 3.6, hit proxies unchanged, new statics exist within expected rooms, empty-state group now contains the dry-stem cue.
**Perf**: ~40 shared-material meshes, zero per-frame cost beyond existing `update()`; no lights added in this pass.

**Acceptance criteria**: dusk and morning screenshots show seating, dressed walls, warm corner lamp at dusk; `npm test`, `tsc`, build green; interior obstacle tests untouched and passing.

---

## Pass 2 — Interior lighting & atmosphere (EL-03)

**Outcome**: The hearth lights the room; daylight shafts and dust motes give the interior weather-of-the-day atmosphere; dusk never goes murky.

**Systems affected / files**: `cottageInterior.ts` (rig-owned atmosphere), `src/scene/NeighborhoodCanvas.tsx` (ambient tuning + hearth PointLight in `interiorRoot`).

**Technical approach**:
- **Hearth PointLight** (warm `#FFB46B`, `castShadow: false`) parented inside `interiorRoot` next to the firebox; intensity = f(`hearthLit`, phase, gentle sine flicker) computed in the existing per-frame indoor branch (zero allocation). Light toggles only with `interiorRoot.visible` (two cached shader variants — no per-frame program churn).
- **Window light shafts**: two additive `MeshBasicMaterial` quads angled from the west window and north windows; opacity per phase (morning 0.5, afternoon 0.38, golden 0.45, dusk 0.14).
- **Dust motes**: one `THREE.Points` cloud (~34 vertices, additive, size ~0.05) drifting inside the shaft volume; positions advanced with closure-level scratch math in `rig.update` (zero-GC, finite bounds).
- Ambient tuning: dusk hemi 0.58→0.66 with warmer tint; indoor env intensity floor raised so plaster never reads mud; keep daytime values unchanged.

**Dependencies**: Pass 1 (curtains/shafts share window frames). **Tests**: extend `cottageInterior.test.ts` — motes exist, stay inside room bounds after 100 simulated updates with finite positions; shaft opacity differs morning vs dusk.
**Perf**: +1 PointLight (no shadow) active only indoors; +2 basic quads; +1 Points draw. Negligible on mobile; software-GL safe (no new heavy shaders).

**Acceptance criteria**: dusk screenshot shows warm hearth pool of light on floor/rug; morning screenshot shows visible shaft + motes; 0 console errors.

---

## Pass 3 — Everyday activity feel (EL-01, EL-05, EL-06)

**Outcome**: Brewing/baking is a staged ~2 s activity with a completion card; gathering results show item chips; home stations gain sound identity.

**Systems affected / files**:
- `src/game/actions.ts`: `PropInteractionResult` gains optional `gainedItems?: Array<{ itemId: PersonalItemId; count: number }>`; gathering reducers (window box, greenhouse, orchard, pond, sill planter) populate it. Cooking keeps its reducer shape (activity lives in UI).
- `src/game/inventory.ts` (or a small pure module): export `RECIPE_ACTIVITY_STEPS: Record<string, string[]>` — per-recipe 3-step labels, unit-testable.
- `src/components/CottageStationModal.tsx`: hearth craft click runs a local staged overlay (steps ~0.6 s apart, progress dots, completion card with item name + "+N min" note) before committing via the existing `onCookRecipe` callback at the *commit* moment (reducer still executes once — no double-apply risk; interruption = closing the modal cancels before commit).
- `src/components/DialogueSheet.tsx`: prop-card renders `gainedItems` as chips (item label × count) above the body prose.
- `src/game/audio.ts`: add `playKettleSteam()` (filtered noise swell) and `playArrangePop()` (soft wooden tick); wire into the brew overlay and vase/shelf handlers.

**Dependencies**: none (independent of Passes 1–2). **Tests**: new pure assertions for `RECIPE_ACTIVITY_STEPS` coverage of all `HEARTH_RECIPES`; `cottage.test.ts`/`inventory.test.ts` extensions assert `gainedItems` populated for each gathering reducer and unchanged inventory math.
**Perf**: one CSS transition overlay; no new dependencies.

**Acceptance criteria**: brewing tea shows 3 staged steps then a completion card; pond/orchard/window-box cards show chips; audio hooks fire without console errors; recipes cannot double-commit when the overlay runs.

---

## Pass 4 — Transitions & indoor pacing (EL-04, EL-08, EL-09)

**Outcome**: Door entries/exits and bed rest fade through a soft storybook veil; indoor top speed is cozy.

**Systems affected / files**: `src/App.tsx` (shared `sceneVeil` overlay state: door enter/exit + rest paths trigger a ~420 ms fade-out/in), `src/game/playerController.ts` (cap desired speed indoors at `PLAYER_RUN_SPEED * 0.82` via the existing `location` input; exterior untouched).

**Dependencies**: Pass 3 audio hooks for the veil cue. **Tests**: extend `player.test.ts` for the indoor cap; veil is UI-only (no unit test, covered by browser QA).
**Perf**: one absolutely-positioned div with CSS opacity transition; zero canvas cost.

**Acceptance criteria**: entering the cottage, exiting, and resting all show the veil; indoor sprint input reaches ~4.4 m/s max, not 7.6; exterior speeds bit-identical to baseline.

---

## Pass 5 — Sit & Sip: indoor seats + tea-table ritual (EL-11, EL-12)

**Outcome**: The player sits on either dining stool and sips a brewed drink at the table; the hearth→table routine closes.

**Systems affected / files**:
- `src/game/worldMap.ts`: `SeatSpot` gains optional `indoor?: boolean` (outdoor registry untouched — NPC seat-claiming machinery is protected).
- `src/game/cottage.ts`: new `COTTAGE_SEAT_SPOTS` (2 seats on the existing stool meshes, `indoor: true`, seatHeight 0.46) + `resolveAnySeatById` (indoor first, outdoor fallback via existing `getSeatById`) + `selectBestInteriorTarget` extended to offer seat candidates (kind `'seat'`, never when occupied — indoor seats cannot be occupied since NPCs never enter).
- `src/game/playerController.ts`: sitting-block stand-up + seated-target branch resolve via `resolveAnySeatById`; stand-up approach validated with `isInteriorPointWalkable` for `indoor` seats; while seated on an indoor seat with a sipable drink in satchel, the primary target becomes `Sip <drink>` (`InteractiveTarget` gains optional `sipItemId`).
- `src/game/inventory.ts`: optional `sipable?: true` flag on drink item defs + `getFirstSipableItem` helper (item defs are code, not save data — zero schema impact).
- `src/game/actions.ts`: `togglePlayerSitAction` stand-up uses the same indoor/outdoor branch; new `sipBeverageAtTableAction` — validates indoor + seated on cottage seat + sipable item; consumes 1, advances +8 min (clamped), first-time journal memory per item id (`mem_teatable_<itemId>`), returns prose card.
- `src/App.tsx`: seat-target branch handles the sip case (prop card + interact pulse + SFX); stand-up path unchanged.
- `src/scene/NeighborhoodCanvas.tsx`: seat proxy resolution uses `resolveAnySeatById`; hearth ambience gating (Pass 7).
- `src/scene/builders/cottageInterior.ts`: two invisible seat hit proxies (`targetKind: 'seat'`) over the stools; reactive **teacup + steam wisp** on the table while `playerPosture === 'sitting'` on a cottage seat (visual only — no persisted state).

**Dependencies**: none. **Tests**: `cottage.test.ts` (seat spots: unique ids, approach positions interior-walkable, seat positions inside `cottage_table` footprint), `player.test.ts` (indoor sit→move stands onto walkable approach; seated `groundY`), `inventory.test.ts` (sipable ids resolve), `engine.test.ts` or `cottage.test.ts` sip reducer (consume + time + one-time memory + rejection paths).

**Perf**: zero per-frame allocation beyond one visibility toggle; no new lights; 2 hit proxies reuse the existing proxy geometry.

**Acceptance criteria**: action button offers "Sit at Oak Table" near stools; seated pose renders on the stool; with tea in satchel the button becomes "Sip Warm Chamomile Tea"; sipping consumes the item, +8m, one journal memory, teacup visible while seated; standing up works via movement/tap; outdoor seats bit-identical.

---

## Pass 6 — Hearth-wall life & entry dressing (EL-13, EL-15)

**Outcome**: The chimney breast carries mantel-life; the kitchen counter shows sign-of-use; the entry quadrant reads "someone comes home here".

**Systems affected / files**: `src/scene/builders/cottageInterior.ts` only (visual layer; statics inside existing footprints/wall planes).
- **Mantel** (top y ≈ 1.58): beeswax candle in a brass holder (dusk-emissive flame dot), small leaning framed photo, tiny potted sprig.
- **Kitchen counter** (top y ≈ 0.92): stoneware crock with wooden spoons, small bread board with a loaf slice, folded linen cloth.
- **Table "tea for one" statics**: honey pot + spoon beside the vase (composition support for the sip ritual; the reactive teacup from Pass 5 appears only while seated).
- **Entry**: a pair of garden boots by the door jamb, two brass wall pegs with a woven hat on the north wall near the door, thin woven runner mat inside the door.

**Dependencies**: none. **Tests**: extend `cottageInterior.test.ts` — new statics exist inside expected rooms/bounds, diorama height envelope intact, hit proxies unchanged (7 cottage + 2 seat).

**Perf**: ~18 shared-palette statics; zero per-frame cost beyond the existing candle/teacup emissive toggles.

**Acceptance criteria**: dusk + morning screenshots show dressed mantel/counter/entry; obstacle table and all nav tests untouched; no growth in the deferred chunk beyond noise.

---

## Pass 7 — Ambient hearth crackle & interaction SFX (EL-14)

**Outcome**: Indoors with the hearth lit, a soft procedural crackle room-tone plays; sitting and sipping get gentle sound identity.

**Systems affected / files**:
- `src/game/audio.ts`: `playHearthAmbience(start: boolean)` — band-passed noise bed (~0.022 gain) + randomized crackle pops via a lightweight scheduler; idempotent start/stop; honors the existing mute switch (immediate stop on mute); `playSitDown()` (soft wooden settle), `playSip()` (two tiny filtered breaths + porcelain tick).
- `src/scene/NeighborhoodCanvas.tsx`: in the indoor branch — `playHearthAmbience(isIndoors && hearthLit && !muted && playing)` evaluated on state transitions only (no per-frame calls); stopped on location change / pause / mute.
- `src/App.tsx` + `CottageStationModal.tsx`: sit/stand/sip hooks under the existing mute switch.

**Dependencies**: Pass 5 (sit/sip moments). **Tests**: `audio.test.ts`-style pure coverage is not meaningful for Web Audio; covered by browser QA (no console errors, mute toggle stops the loop) + a light unit check that the engine exposes the new methods and start/stop is idempotent without an AudioContext (SSR/headless safe).

**Perf**: one persistent noise source + ~2 pop nodes/second (garbage-collected by the audio thread); negligible.

**Acceptance criteria**: crackle audible indoors with hearth lit, silent outdoors/extinguished/muted; sit and sip SFX fire once per action; 0 console errors on desktop + mobile QA.

---

## Reassessment & iteration policy

After each pass: rerun full gates, re-screenshot dusk + morning interiors and one gathering flow, and re-rank remaining findings. Round-2 leftovers tracked: EL-10 (chunk warning — track only). Expected after Pass 7: only micro-findings from visual review (fix inline within the pass that introduced them).
