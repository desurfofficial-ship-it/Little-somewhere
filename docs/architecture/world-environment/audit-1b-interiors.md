# Audit 1-b — Interiors & Building Transitions (Read-Only)

**Task ID**: 1-b (interior & building specialist) · **Branch**: `feat/world-environment-living-world` · **Date**: audit pass, read-only
**Scope**: all six interior concerns — Willow Step Cottage, Sunbeam Greenhouse, Hearth & Crumb Bakery, Linden Book Nook, Copperwheel Cottage, plus the enter/exit transition & interior-occupancy layer that binds them.
**Verdict taxonomy**: `Complete` (fully playable, state-reactive, tested) · `Partially functional` (works but thin/lopsided depth) · `Visual-only` (decorative by design, no interaction) · `Missing` (designed gap, scoped to a future milestone) · `Broken` (player-facing defect). **No `Broken` interiors were found.**

Method: static read of engine modules, scene builders, HUD components, transition wiring, and the LR contract docs. No code was modified. All coordinates are local interior-space unless marked world-space.

---

## 0. Shared interior pattern (what every room inherits)

Every enterable interior follows one cutaway contract, which is why six rooms cost so little to audit:

1. **Pure room registry** (`src/game/<room>.ts`): `*_BOUNDS`, `*_INTERIOR_OBSTACLES`, `*_INTERACTABLES` (id/name/focus/radius/actionLabel), optional `*_SEAT_SPOTS` (`zoneId`, `indoor: true`), a hub-routed waypoint resolver (`compute*Waypoints`, 5–6 hubs, single+pair hub search, segment-sampled at 0.2), and a facing-weighted `selectBest*Target` (facing penalty `(1-align)*0.45`, seats weighted `+0.22` behind props so a stool never steals an aim at a station).
2. **Mirrored scene rig** (`src/scene/builders/<room>Interior.ts`): raycast `hitProxies` per interactable + per seat, and a zero-GC `rig.update(world, phase, elapsed)` reactive entry point. Mirror parity is test-enforced (HANDOVER.md:12–20).
3. **Location-aware movement** (`src/game/walkability.ts:22-42`): one dispatcher routes point walkability to the correct room grid; `resolveSeatStandPos` (walkability.ts:110-122) prefers the authored `approachPos`, then deterministic 8-direction × 2-radius recovery around both seat and approach anchors (walkability.ts:67-95).
4. **Enter/exit reducers** (`src/game/actions.ts`): idempotent re-entry guard, held-item auto-placement, walkability-fallback exterior position snapshot (`exteriorPlayerPos`), door spawn + facing, posture/seat reset.
5. **Per-room indoor lighting & audio** in `syncVisualAndHud` (NeighborhoodCanvas.tsx:1779-1858) and transition-only hearth/rain ambience (1884-1907).

**Sit-and-sip ritual** is wired identically in all four seated rooms (cottage table stools, bakery café chair, nook armchair, copperwheel window armchair): seated players get `Sip <drink>` / `Stand Up` as the only offered target (playerController.ts:408-510). Greenhouse intentionally has no seats (playerController.ts:441-444).

---

## 1. Willow Step Cottage (player home)

Files: `src/game/cottage.ts` · `src/scene/builders/cottageInterior.ts` · `src/components/CottageStationModal.tsx` · reducers `src/game/actions.ts:2112-2304`.

Bounds 7.0 × 5.4 (cottage.ts:18-23); 5 obstacles (cottage.ts:40-51); 7 interactables (cottage.ts:64-135); 2 indoor stool seats (cottage.ts:172-193); 5 interior hubs (cottage.ts:242-248).

### Station classification

| Station | Verdict | Evidence & depth |
|---|---|---|
| `interior_door` | **Complete** | Exit reducer (actions.ts:2138-2155); exterior counterpart `player_door` worldMap.ts:276. |
| `cottage_hearth` (Brew & Bake) | **Complete** | Deepest station in the game: prop card → `CottageStationModal` hearth tab (CottageStationModal.tsx:163-237) with per-ingredient `have/need` counters, 44px craft buttons, staged 640 ms sensory step overlay + completion card (374-418); `cookRecipeAction` commits once (RECIPE_ACTIVITY_STEPS coverage pinned per HANDOVER.md:12). |
| `cottage_table` (vase) | **Complete** | Vase panel; `placeFlowerInVaseAction`; rig mirrors 3 flower keys (`vaseFlowers`, cottageInterior.ts:52); descriptive copy from `describePlacedFlower` (cottage.ts:411-415). |
| `cottage_shelf` (keepsakes) | **Complete** | Shelf panel, 5 displayed keepsakes cap (`displayedIds.length}/5`, CottageStationModal.tsx:309); rig mirrors all 5 keepsake meshes + tiered progression groups (cottageInterior.ts:85-92). |
| `cottage_desk` (almanac) | **Complete** | Seasonal 2–3 tip pool + day number (cottage.ts:381-409); +10m, once/day (actions.ts:2263-2280). |
| `cottage_planter` | **Partially functional** | One daily action only: first tend grants 1 chamomile +10m (actions.ts:2290-2303), subsequent reads are a status line. Depth is fine for a sill box; no growth state like greenhouse pots. |
| `cottage_bed` (rest) | **Complete** | The only day-advance trigger; confirmation card → `performNextDayRest` (App.tsx:800-815). |

### Furniture interaction depth (beyond stations)

| Group | Verdict |
|---|---|
| Window life: rain streaks, wet-glass veil, frost wedges, curtains | Visual-only, weather/season-reactive (cottageInterior.ts:56-67, 1835-1849) |
| Wall clock with live in-game hands | Visual-only (EL-17, cottageInterior.ts:62-63, 1829-1833) |
| Five home mementos + progression tiers (book/honey/recipe/posy) | Visual-only, derived read-only from persisted state — never persisted (cottageInterior.ts:73-92; HANDOVER.md:10) |
| Seasonal dressing: sill posies, door swag, floor scatter, hearth wall | Visual-only (cottageInterior.ts:98-117) |
| Indoor stools ×2 | Complete seats: sit, sip ritual, NPC-exempt by contract (cottage.ts:166-171) |

### Assessment
(a) **Spatial readability**: excellent — cutaway wainscoting on south/east so the iso camera sees every corner (cottageInterior.ts:126-129); all station focus points sit against walls with open approach lanes; 5 hubs give full connectivity.
(b) **Camera**: interior branch with 0.68× zoom clamp + 0.42 focus centering (NeighborhoodCanvas.tsx:2598-2614). Correct.
(c) **Interaction depth**: strongest room; hearth is a genuine 3-step crafting surface.
(d) **Transitions**: enter/exit robust (actions.ts:2112-2155); day rollover keeps the player *inside* at `COTTAGE_WAKE_SPAWN` (storage.ts:555-609).
(e) **Navigation**: `isInteriorPointWalkable` + sliding + hub routing; seat approach spots verified walkable (cottage.ts:168-171).
(f) **Accessibility**: 2–4 clicks per ritual; HUD button 48px (App.tsx:1416); all modal controls ≥44px.
(g) **Storytelling**: the room remembers — mementos light up from `totalHarvests`, `kneadingSessions`, `booksRead`, memory ids, and calendar season (cottageInterior.ts:1818+ update). Best-in-class.
(h) **NPC usage**: none by design — residents never enter the cottage; indoor seats are NPC-exempt (cottage.ts:166-171). Appropriate for a private home.

---

## 2. Sunbeam Greenhouse

Files: `src/game/greenhouse.ts` · `src/scene/builders/greenhouseInterior.ts` · `src/components/GreenhousePanel.tsx` · reducers `actions.ts:2330-2638`.

Bounds 6.04 × 5.24 (greenhouse.ts:24-29); 4 obstacles (51-62); 5 interactables (75-128); **no seats** (playerController.ts:441-444). Door-side reconciliation already done: interior west-wall door matches the exterior west door (greenhouse.ts:36-41).

### Station classification

| Station | Verdict | Evidence & depth |
|---|---|---|
| `greenhouse_door` | **Complete** | `exitGreenhouseAction` (actions.ts:2183-2200). |
| `greenhouse_potting` (sow) | **Complete** | Winter-aware copy (actions.ts:2344-2355); planting panel: crop cards with owned counts + per-empty-pot sow buttons (GreenhousePanel.tsx:115-175); `plantSeedAtPlotAction` guards location/plot/crop/inventory (actions.ts:2431-2509); first-sow memory; sowing pre-waters the pot (2495). |
| `greenhouse_shelf` (4-pot loop) | **Complete** | Status readout names per-pot crop/stage/thirst (actions.ts:2357-2389); harvest panel only offered when `readyPlots > 0` (2360-2367); harvest returns crop ×2 + one seed fold (2511-2588); rig toggles sprout/leafy/bloom per crop and darkens watered soil every frame (greenhouseInterior.ts:990-1015). |
| `greenhouse_water` | **Complete** | One-click waters *all* thirsty pots +8m (actions.ts:2400-2429); idle copy points at the notes station when nothing is sown (2408-2410). |
| `greenhouse_table` (notes) | **Complete** | First read grants starter chamomile+thyme seeds +8m + memory (actions.ts:2594-2638); seasonal rereads. |

The 4-pot growing loop is coherent end-to-end: nightly growth only in `advanceToNextDay` via `advanceGreenhouseNightlyGrowthInPlace` (greenhouse.ts:240-255; wired at storage.ts:566-574), winter freeze, nothing withers, seeds non-giftable (HANDOVER.md:14).

### Furniture interaction depth

| Group | Verdict |
|---|---|
| Cedar potting bench, shelf pots, rain barrel + copper can, worktable | All interactive (above) |
| Glass walls, phase lantern, dust/light shaft | Visual-only |
| Season dressing: spring trays / summer / autumn trug / winter | Visual-only reactive (greenhouseInterior.ts:948-952, 983-988) |
| Mina keepsake wreath echo | Visual-only, derived from `composeProgressionVisualState` (977-980) |

### Assessment
(a) **Readability**: clean four-corner layout (bench NW, shelf E, barrel NE, table S) with a central aisle hub (greenhouse.ts:355-362). Stations are findable; the day-cycle state is *visible* (soil darkness, stage meshes) before any UI is opened.
(b) **Camera — the one real defect of this audit**: `greenhouse_interior` is missing from the interior camera branch, which lists only cottage/bakery/nook/copperwheel (NeighborhoodCanvas.tsx:2598-2603). It therefore renders under the **exterior** camera path (2615-2652): full `zoomRef` distance, raw `playerPos` focus (no 0.42 centering), no 0.56–0.92 zoom clamp, plus the occlusion-lift/dialogue-zoom machinery meant for the street. Net effect: the greenhouse diorama reads smaller and farther than its four siblings while floating on the dark interior backdrop. Indoor *lighting* is properly custom for the glasshouse (1793-1806), which makes the framing inconsistency more conspicuous. One-line fix candidate (see §8, R1).
(c) **Depth**: the only multi-day loop in any interior; sowing→watering→harvest is 3 stations + 1 calendar. Water-all is the right ergonomic call for 4 pots.
(d) **Transitions**: robust; day rollover steps the player out to the porch (`safeGreenhouseExit`, storage.ts:576-580, 610-611).
(e) **Navigation**: 6 hubs; shelf obstacle padding (minX 2.28 − 0.42) is accounted for in the water station stand-spot comment (greenhouse.ts:109-114).
(f) **Accessibility**: 2 clicks for water/notes; 3–4 for sow/harvest; all panel buttons ≥44px (GreenhousePanel.tsx:85, 165, 214).
(g) **Storytelling**: "Mina's shared corner" — her notes address the player directly, starter seeds are left for "whoever tends the shared pots"; the wreath echo ties her friendship into the room. Clear and warm.
(h) **NPC usage**: none; Mina is exterior-only and referenced through her dialogue module (`dialogue/interiors/greenhouse.ts:19-73`) under a strict knowledge boundary. Consistent with the room-as-shared-corner fiction.

---

## 3. Hearth & Crumb Bakery

Files: `src/game/bakery.ts` · `src/scene/builders/bakeryInterior.ts` · `src/game/dialogue/interiors/bakery.ts` · reducers `actions.ts:2664-2934`.

Bounds 6.0 × 4.8 (bakery.ts:24-29); 4 obstacles (47-56); 5 interactables (69-120); 1 café seat (297-308); 6 hubs (229-236).

### Station classification

| Station | Verdict | Evidence & depth |
|---|---|---|
| `bakery_door` | **Complete** | `exitBakeryAction` (actions.ts:2690-2707). |
| `bakery_oven` (daily bake reveal) | **Complete** | Deterministic 4-day roster `getBakeForDay` (bakery.ts:135-166); once/day +8m + first-visit memory (actions.ts:2740-2777); seasonal lead-in copy. |
| `bakery_counter` (share the loaf) | **Complete** | Grants the day's `shareItemId`; nothing on oven-rest days (2828-2846); kneading first **doubles** the share (2849-2856, 2881). Counter loaf mesh visibility tracks the bake day (bakeryInterior.ts:1016). |
| `bakery_prep` (help knead) | **Complete** | +12m, `kneadingSessions` counter feeds the cottage memento system (2814); oven-rest-day variant copy (2788-2796). |
| `bakery_notes` | **Complete** | One-time starter herb loaf + seasonal rereads (2888-2934). |
| Café chair `bakery_seat_cafe_west` | **Complete** | Sit + sit-and-sip (playerController.ts:446-477); seat proxy over the bentwood chair (bakeryInterior.ts:969-975). |

### Furniture interaction depth

| Group | Verdict |
|---|---|
| Brick dome oven + hearthstone, counter + loaf shelf, prep table, recipe notes shelf | Interactive (above) |
| Round café table + bentwood chair | Seat, interactive |
| Oven steam puffs (reactive to knead/bake), season dressing | Visual-only reactive |

### Assessment
(a) **Readability**: legible 3-wall kitchen with the café corner as a distinct social sub-zone; hub graph covers the counter/prep gap and the notes-shelf pocket (bakery.ts:229-236).
(b) **Camera**: correct interior branch (NeighborhoodCanvas.tsx:2599-2602).
(c) **Depth**: four once-per-day rituals with a real cross-station synergy (knead → doubled share) and a deterministic "oven rest" rhythm day. This is the best *rhythm* design of the four visitable rooms.
(d) **Transitions**: robust; day rollover ejects to the bakery porch (storage.ts:582-587, 612-613).
(e) **Navigation**: fine; note the historic stand-up trap at this chair was the motivating bug for the location-aware walkability dispatcher (walkability.ts:9-18) — now fixed, with the seat `approachPos` (−0.2, 1.4) verified outside the table obstacle.
(f) **Accessibility**: 2 clicks per ritual; synergy is discovered through post-knead copy (2819).
(g) **Storytelling**: strong ("floury fingerprints", honey-butter rest days), with one **presence dissonance**: every ritual narrates Clara acting in the room ("Clara wraps today's…", "slides a thimble of honey", actions.ts:2819, 2881) while no resident ever renders inside — the room reads as "Clara just stepped out" during an interaction she is narratively performing. Acceptable today; becomes a real gap once LR-3 makes her a hostable occupant (§7).
(h) **NPC usage**: none inside. Clara's interior knowledge is confined to her own bakery state in `dialogue/interiors/bakery.ts:17-20, 104-114` (kneaded/shared/rest checks) — boundary respected.

---

## 4. Linden Book Nook

Files: `src/game/bookNook.ts` · `src/scene/builders/bookNookInterior.ts` · `src/game/dialogue/interiors/bookNook.ts` · occupancy (`occupancy.ts`), shared activity (`activities.ts`), reducers `actions.ts:2960-3261`.

Bounds 5.0 × 4.8 (bookNook.ts:27-32); 4 obstacles (50-59); 4 interactables (72-113); 1 armchair seat (317-328); 6 hubs (249-256).

### Station classification

| Station | Verdict | Evidence & depth |
|---|---|---|
| `nook_door` | **Complete** | `exitNookAction` (actions.ts:3036-3055). |
| `nook_shelf` (featured book) | **Complete** | Deterministic 4-book cycle (bookNook.ts:130-185); each first read saves its own memory; `booksRead` counter capped at 4 feeds cottage mementos (actions.ts:3153-3167). Station exclusivity (LR2-06): solo browsing is politely blocked while Nora holds the chair for an active session (3112-3123). |
| `nook_desk` (lending notes) | **Complete** | One-time starter tea + seasonal rereads (3215-3261). |
| `nook_tea` (reader's cup) | **Complete** | +6m, item grant, once/day (3174-3212). |
| `nook_seat_armchair` | **Complete — and occupancy-aware** | Seat offer is **suppressed while Nora occupies the chair** (`chairOccupied` guard, bookNook.ts:395-418); occupied armchair proxy converts into the shared-reading card (actions.ts:3071-3087). |

### The occupancy layer (unique to this room)

- Only `SHARED_ACTIVITIES` entry today: `share_featured_reading` (host nora, `nook_interior`, station `nook_chair`, seat `NOOK_OCCUPANT_POS`, +6/+2 affinity/reliability, knowledge `nora_featured_reading`) — activities.ts:52-72.
- `enterNookAction` is the **only** enter reducer with the invitation graft: expiry reconcile → live-accepted-invite check → host availability → `setOccupant` → `activeActivity` + personalized toast (actions.ts:2972-3018). Exit clears occupancy + activeActivity but keeps the accepted invite re-graftable on re-entry (3040-3051).
- Occupant is exempted from exterior sim (`simulation.ts:653-656`), offered as a talk/share target with a −0.12 priority bump (bookNook.ts:366-391), rendered by a dedicated `nookOccupantRig` with sit pose, ring, and quest pip (NeighborhoodCanvas.tsx:945-963, 2088-2136).
- Completion is transactional and idempotent: window/location/occupancy/host-encounter re-checks, host-only NPC memory, invitation archived, occupancy cleared (activities.ts:161-336).
- Invitation chassis: single active slot, 2-day spacing, tier/affinity gate, home-radius availability (6 m) against the raw phase slot (invitations.ts:59-79, 159-199); Nora is home-available morning/golden/dusk but not afternoon (West Bench ≈7.6 m — the `computeOfferWindow` comment at invitations.ts:137-146 encodes exactly this).
- Offer surface exists only for Nora: `dialogue/invitations/nora.ts` (in-room completion / pending / offer / accepted reminder topics).

### Assessment
(a) **Readability**: four walls, four clear zones (shelf N, desk S, tea W, chair SW); featured-book day state is visible on the shelf-adjacent open book with per-book cover tint (bookNookInterior.ts:850-857).
(b) **Camera**: correct interior branch.
(c) **Depth**: deepest social interior — solo rituals + one invited co-activity with affinity/memory/teaching hooks.
(d) **Transitions**: the only fully reconciled enter/exit pair; every edge (expired invite on entry, host unavailable, mid-visit expiry tick, day-advance clear) is owned by a named reducer and tested.
(e) **Navigation**: fine; armchair approach (−0.9, 0.55) matches `NOOK_OCCUPANT_APPROACH_POS` (occupancy.ts:21).
(f) **Accessibility**: solo rituals 2 clicks; shared reading = enter during window → pip-marked Nora → talk/share → confirm card. Occupant rig shows a rotating quest pip + amber ring within 2.9 m (NeighborhoodCanvas.tsx:2122-2132), so the invitation moment is discoverable without UI text.
(g) **Storytelling**: books about the other neighbors (ivy letters/pond sketches/bakery year/night orchard) cross-reference the cast; tea-ringed ledger; "chapter" echo via keepsake zine (836-838).
(h) **NPC usage**: **yes — the only interior a resident can occupy**, and the implementation is the pattern doc 24 tells LR-5 to copy (below).

---

## 5. Copperwheel Cottage

Files: `src/game/copperwheel.ts` · `src/scene/builders/copperwheelInterior.ts` · `src/game/dialogue/interiors/copperwheel.ts` · reducers `actions.ts:3287-3554` · LR-5 spec `docs/architecture/living-relationships/24-lr5-arthur-copperwheel-specification.md`.

Bounds 6.0 × 5.0 (copperwheel.ts:27-32); 5 obstacles (50-61); 5 interactables (74-125); 1 window-armchair seat with a documented backrest-clip nudge (340-362); 6 hubs (271-278).

### Station classification

| Station | Verdict | Evidence & depth |
|---|---|---|
| `cw_door` | **Complete** | `exitCopperwheelAction` (actions.ts:3313-3330). |
| `cw_bench` (daily project + help) | **Complete** | 4-day project rotation incl. bench-rest day (copperwheel.ts:144-204); once/day +10m (rest +8m); per-project one-time memories; `windingSessions`/`projectsAdmired` counters (actions.ts:3367-3424). Rig shows exactly one project group per day and swings the pendulum only after today's check (copperwheelInterior.ts:961-976). |
| `cw_bed` (nightstand peek) | **Partially functional** | +4m, one-time memory, seasonal detail (actions.ts:3530-3554). A pure inspect — the only "bed" in a visitable room with no rest option (correct: cottage bed stays the one true rest). |
| `cw_shelf` (mending ledger) | **Complete** | One-time starter tea + seasonal rereads (3476-3527). |
| `cw_stove` (chamomile cup) | **Complete** | +6m, item grant, kettle steam only after today's pour (actions.ts:3430-3473; copperwheelInterior.ts:978-992). |
| `cw_seat_armchair` | **Complete** | Sit + sip (playerController.ts:512+); documented seat-offset polish for the rotated armchair (copperwheel.ts:343-349); stand-up uses the two-anchor radial recovery precisely because this chair sits in a deep corner pocket (walkability.ts:105-107). |

### Assessment
(a) **Readability**: strong workshop legibility — bench, bed alcove, shelf wall, kettle wall, window corner each own a wall; the daily project is physically on the felt, not just in text.
(b) **Camera**: correct interior branch.
(c) **Depth**: same rhythm quality as the bakery (project/tea/ledger/peek with a rest day); slightly lower ceiling because "helping" is a single auto-resolved flavor line rather than a sub-loop.
(d) **Transitions — the known LR-3/LR-5 gap**: `enterCopperwheelAction`/`exitCopperwheelAction` have **no invitation reconcile and no occupancy graft** (actions.ts:3287-3330) — the exact asymmetry doc 24 §1 records ("the exact asymmetry LR-3's F-ENTER-1 helper resolves; LR-5 adopts the helper"). Likewise the **occupant anchor is missing**: occupancy constants exist only for the nook (occupancy.ts:19-23) and Copperwheel has exactly one seat spot — the player's armchair (copperwheel.ts:350-362; doc 24 §1 row `copperwheel.ts:350-362` "no occupant anchor exists"). This is the HANDOVER-recorded gap (HANDOVER.md:218: doc 24 "READY-WITH-EXPLICIT-DECISIONS; `share_workbench_hour`, bench occupant anchor, schedule matrix incl. the golden 5.69 m quirk"). It is *designed* absence, not breakage — solo play is complete today.
(e) **Navigation**: fine; hub set covers the bench/bed north passage and the armchair approach pocket (copperwheel.ts:271-278).
(f) **Accessibility**: 2 clicks per ritual.
(g) **Storytelling**: excellent — the stopped regulator watch at 4:15, the railmen photo, the "wind nothing, touch the loupe" visitor card, ledger clover (actions.ts:3452, 3469, 3491, 3551).
(h) **NPC usage**: none inside; Arthur narrates the room in `dialogue/interiors/copperwheel.ts:23-160` with the same knowledge boundary. Note the **golden 5.69 m quirk** (doc 24 §4): Arthur's golden schedule slot (Gazebo Steps) is 5.69 m from `homePos {8.8,-7.6}` — it *passes* the generic 6 m gate (invitations.ts:27,70) even though he is visibly away, which is why doc 24 D-5B requires `offerPhases` gating (morning/dusk only) when `share_workbench_hour` lands.

---

## 6. Interior transitions — robustness matrix

| Edge case | Behavior | Evidence |
|---|---|---|
| Enter with held carried prop | Prop auto-placed before spawn swap | actions.ts:2117-2119, 2162-2164, 2668-2671, 2964-2967, 3292-3295 |
| Enter from blocked exterior tile | Falls back to porch exit pos | actions.ts:2120-2122 (+4 twins) |
| Re-enter while already inside | Idempotent no-op | actions.ts:2113-2115 (+4 twins) |
| Exit onto since-blocked exterior tile | Falls back to `PLAYER_SPAWN` | actions.ts:2142-2143 (+4 twins) |
| Scene transition UX | `playSceneVeil` fade + SFX on all 10 enter/exit paths | App.tsx:549-603, 816-917 |
| Clock while inside | Keeps advancing (`dtMinutes` identical indoors); station rituals add minutes | simulation.ts:620-624; per-station `+Nm` |
| Exterior sim while inside | Continues; player-distance greetings use `exteriorPlayerPos`/`Infinity` | simulation.ts:827-840, 889-896 |
| Invitations while inside | Tick reconciler expires on window end (`expireInvitationsInPlace`, simulation.ts:623); +2 h button reconciles (App.tsx:980-991 → invitations.ts:429-439); bed rest expires via day advance (invitations.ts:419-422); nook enter reconciles (actions.ts:2972-2974). **Cottage/greenhouse/bakery/copperwheel enters do not reconcile** — currently harmless (only the nook hosts activities), and the LR-3 `reconcileInvitedInteriorEntry` helper is the planned single fix (doc 24 §1; HANDOVER.md:217). |
| Save/load mid-visit | Sanitizer preserves occupancy clone (simulation.ts:1113-1115); day rollover is interior-aware: cottage wakes inside, other four eject to their porches | storage.ts:555-617 |
| Indoor audio | Hearth crackle cottage-only; rain patter all interiors; both transition-gated | NeighborhoodCanvas.tsx:1884-1907 |
| HUD | Location label + "Indoors" phase badge swap | App.tsx:1192-1204, 1258-1259 |

**Occupancy wiring status across all six rooms**: cottage ✗ (private by design, cottage.ts:166-171) · greenhouse ✗ (no seats by design, playerController.ts:442) · bakery ✗ (narratively present, no occupancy) · **nook ✓ (complete)** · copperwheel ✗ (anchor missing — doc 24 L5-S2) · exterior shared chassis ✓. So interior occupancy is wired for **1 of 5 visitable interiors**, exactly matching the LR-1/LR-2 milestone boundary and the prepared (not built) LR-3/LR-5 backlog.

---

## 7. Interaction-depth matrix

Steps = approximate player inputs from standing at the door. "Day" = once-per-in-game-day gate; "Mem" = one-time journal memory; "Echo" = visible scene reaction.

| Room · Station | Steps | Day-gate | Item economy | Mem | Echo in room |
|---|---|---|---|---|---|
| Cottage · Hearth recipe | 4 (card→modal→recipe→brew) | recipe-specific | consumes ingredients → drink/treat | — | kettle steam, chimney strength (cottage.ts:423-431) |
| Cottage · Vase / Shelf | 3–4 | no | place/return flowers, 5 keepsakes | — | vase/keepsake meshes swap live |
| Cottage · Almanac / Planter | 2 | yes | +1 chamomile (planter) | — | — |
| Cottage · Bed | 2 | — | — | — | full day-advance |
| Cottage · Stools | 1 sit + 1 sip | — | consumes drink | — | — |
| Greenhouse · Sow | 4 | no | seed → plot | ✓ first sow | sprout appears stage 0 |
| Greenhouse · Water | 2 | yes | — | — | all pots darken |
| Greenhouse · Harvest | 3 | crop-ready | +crop ×2, +1 seed | ✓ first harvest | blooms clear |
| Greenhouse · Notes | 2 | once (starter) | +2 seed folds | ✓ | — |
| Bakery · Oven / Counter / Prep / Notes | 2 | yes | loaf ×1 (×2 kneaded), starter loaf | ✓ each | counter loaf visibility, steam |
| Bakery · Café chair | 1 sit + 1 sip | — | consumes drink | — | — |
| Nook · Browse / Tea / Desk | 2 | browse yes | +1 tea | ✓ per book | open book + tint, steam |
| Nook · Shared reading | 3 (enter→talk→confirm) | invite window | — | ✓ + NPC memory | occupant rig, sit pose |
| Copperwheel · Bench / Stove / Ledger / Nightstand | 2 | bench yes | +1 tea | ✓ per project | project group, pendulum, steam |
| Copperwheel · Armchair | 1 sit + 1 sip | — | consumes drink | — | — |

Touch-target compliance: HUD interact button `min-h-[48px]` (App.tsx:1416); every modal/panel control ≥44px (CottageStationModal.tsx:126, 148, 222, 256, 290, 356, 410; GreenhousePanel.tsx:85, 165, 214). Raycast proxies are generous in the cottage (1.15×1.65×1.15, cottageInterior.ts:1793) but the greenhouse's are the smallest in the game (0.62×1.05×0.62, greenhouseInterior.ts:963) — irrelevant to mobile accuracy because the 48 px HUD button carries the interaction, but worth parity if tap-to-raycast ever becomes primary.

---

## 8. Ranked interior usability improvements (minimal, no rebuilds)

Interiors that need **no** work: cottage stations, bakery stations, nook stations, copperwheel stations — all Complete. The list below is ordered by player value per unit of code.

1. **R1 — Greenhouse interior camera parity (1-line, high visual value).** Add `curLocation === 'greenhouse_interior'` to the interior camera branch so the glasshouse gets the same 0.68× zoom clamp + 0.42 focus centering as the other four rooms (NeighborhoodCanvas.tsx:2598-2603). Its lighting is already custom (1793-1806); only the framing lags. Then re-verify the desktop/mobile screenshots per the visual gate.
2. **R2 — Land the LR-5 Copperwheel occupant anchor via the LR-3 helper (designed gap, do not improvise).** Add `CW_BENCH_STATION_ID` / occupant pos / facing / approach constants mirroring `occupancy.ts:19-23`, adopt LR-3's `reconcileInvitedInteriorEntry` in `enterCopperwheelAction` + location-guarded clear in exit (doc 24 §2 L5-S2/S3; the raw asymmetry is actions.ts:3287-3330 vs 2972-3018). Gate offers with `offerPhases` so the golden 5.69 m slot can't host Arthur away from his bench (doc 24 §4, D-5B).
3. **R3 — Same graft for the bakery when `share_morning_pastry` lands (LR-3).** `enterBakeryAction`/`exitBakeryAction` (actions.ts:2664-2707) need the identical reconcile/graft + a Clara occupant anchor (counter or café table) — HANDOVER.md:5 names Hearth & Crumb as an LR-3 venue. Keep the nook implementation (§4) as the template; parameterize the occupant rig instead of a second `nora` hardcode (doc 24 L5-S6; the current hit proxy is hardcoded `targetId: 'nora'`, NeighborhoodCanvas.tsx:956).
4. **R4 — Bakery synergy hint (2-line copy change).** `shareMorningLoafAction` on an un-kneaded bake day never mentions that kneading doubles the share; the hint only appears *after* kneading (actions.ts:2819, 2881). Add one clause to the first-visit counter body when `!kneaded && bake.shareItemId`: "help knead first and she'll split the batch two ways." Directly increases the loop's discoverable depth.
5. **R5 — Greenhouse raycast-proxy parity (micro).** Bump greenhouse proxies from 0.62 to ≥0.9 width (greenhouseInterior.ts:963) toward the cottage standard (1.15, cottageInterior.ts:1793) so aim-assist margins match across rooms; no gameplay change (selectBest*Target radii already dominate).
6. **R6 — Occupied-armchair fallback card in Copperwheel/Nook parity.** When LR-5 seats Arthur at the bench, suppress `cw_seat_armchair` offers only if the *armchair* is the claimed station — copy the nook's per-station suppression (`chairOccupied`, bookNook.ts:395-418) rather than a blanket occupancy check, so tea at the armchair stays available while Arthur works.
7. **R7 — Interior-entry invitation awareness for future venues (LR-3 helper consumers only).** Once LR-3's `reconcileInvitedInteriorEntry` exists, route all five enter reducers through it so window expiry on entry is room-agnostic (today only the nook does, actions.ts:2972-2974). Do **not** hand-roll a second reconcile (HANDOVER.md:217 binding note).
8. **R8 — Nit: camera snap/focus factor mismatch.** Load-time interior snap uses 0.45 (NeighborhoodCanvas.tsx:2387-2388) while the live branch uses 0.42 (2605-2606); align to one constant to kill the tiny first-frame reframing after loading a save indoors.

**Explicitly not recommended**: restructuring any room's bounds/stations (all walkability hubs verify), adding a fifth greenhouse pot, giving residents cottage/greenhouse entry, or persisting memento flags (HANDOVER.md:10 contract forbids).

---

## 9. Evidence index (primary files)

- Engine registries: `src/game/cottage.ts` (18-51, 64-135, 172-205, 207-316, 318-379), `greenhouse.ts` (24-62, 75-128, 134-214, 240-261, 316-420), `bakery.ts` (24-56, 69-120, 135-172, 190-308), `bookNook.ts` (27-59, 72-113, 130-204, 210-328, 330-421), `copperwheel.ts` (27-61, 74-125, 144-226, 232-362, 364-425)
- Reducers: `src/game/actions.ts` (2112-2304 cottage, 2330-2638 greenhouse, 2664-2934 bakery, 2960-3261 nook, 3287-3554 copperwheel)
- Movement/seat safety: `src/game/walkability.ts` (9-18, 22-59, 67-122); `src/game/playerController.ts` (390-519)
- Occupancy/social: `src/game/occupancy.ts` (19-86), `src/game/activities.ts` (52-72, 87-146, 161-336), `src/game/invitations.ts` (59-79, 127-152, 159-278, 319-439)
- Scene rigs: `builders/cottageInterior.ts` (1790-1816 proxies, 1818+ update), `greenhouseInterior.ts` (957-1015), `bakeryInterior.ts` (952-1016), `bookNookInterior.ts` (807-905), `copperwheelInterior.ts` (851-1027)
- Renderer/tick/camera: `src/scene/NeighborhoodCanvas.tsx` (268-338 interior walkable search, 919-968 rig assembly + nook occupant, 1351-1369 raycast routing, 1479 occupancy HUD, 1755-1907 indoor lighting/audio, 1988 occupant skip, 2088-2136 occupant render, 2386-2389 snap, 2589-2652 camera)
- Shell wiring: `src/App.tsx` (549-623 door entries, 798-978 prop actions incl. share Featured Reading, 1395-1438 HUD buttons)
- Day rollover: `src/game/storage.ts` (555-617); sim: `src/game/simulation.ts` (620-656, 827-840, 889-896, 1105-1120)
- Dialogue: `dialogue/interiors/{greenhouse,bakery,bookNook,copperwheel}.ts`; invitations `dialogue/invitations/nora.ts`
- Contracts: HANDOVER.md:5, 10-20, 217-218; docs/architecture/living-relationships/24-lr5-arthur-copperwheel-specification.md §1-§6
