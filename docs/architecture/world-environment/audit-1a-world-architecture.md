# Audit 1-a — World Architecture Research (LITTLE SOMEWHERE)

**Task:** 1-a (World Environment / Living World initiative)
**Branch:** `feat/world-environment-living-world` @ `07be49c`
**Mode:** READ-ONLY audit. No source files modified. This document is the only artifact written.
**Method:** every claim below is verified against the working tree with `file:line` citations. Doc-drift claims are verified against the shipped docs and the code they describe.

---

## 1. Executive summary

The world layer is **structurally healthy but contract-smeared**. The simulation side (`worldMap.ts` 568 LOC, `navigation.ts` 380 LOC, `exploration.ts` 140 LOC, `walkability.ts` 122 LOC) is pure, deterministic, and DAG-clean; the scene side mirrors game data through explicit "twin" constants and contract tests (`src/scene/wilds.test.ts:28-70`, `src/scene/builders/orchard.ts:23-24`). Nothing is broken at runtime. The real cost is that **one logical "world location" is defined in ~7 un-coordinated places** (obstacles, nav nodes, landmark zone, prop-interactable union, prop-metrics if/else chain, actions reducer branch, scene proxies), none of which are listed in any single document. Adding a location today is tribal knowledge.

Headline findings:

1. **`REGIONS`/`regionId` is write-only scaffolding.** `REGIONS` has exactly one entry whose bounds alias `WORLD_BOUNDS` (`src/game/worldMap.ts:56-62`); `regionId` is sanitized (`src/game/migrations.ts:1377-1379`) and hashed (`src/game/storage.ts:160`) but **never read by any gameplay consumer** — grep finds zero reads outside persistence. `WORLD_BOUNDS`, `LANDMARK_ZONES`, `NAV_NODES`, and `getGroundHeightAt` are all global singletons; nothing is region-scoped. The "Region-Aware World State" claim (`ARCHITECTURE.md:170`) is aspirational, not shipped.
2. **Doc drift is systemic around the world.** `ARCHITECTURE.md:47,98-101` and `GAME_DESIGN.md:81,336` say "33-node A* graph"; the actual graph is **50 nodes / 63 edges** after Build 10 (`src/game/navigation.ts:13-79,81-160`). `ARCHITECTURE.md:100` says "5 cedar benches"; `SEAT_SPOTS` has 7 (`src/game/worldMap.ts:135-199`). `ARCHITECTURE.md:35,139` still describe `WorldState v10` vs shipped v11 (`src/game/types.ts:737-790`).
3. **Two dead registries.** `ResidentTraits.preferredZones` (`src/game/types.ts:332`, populated for all 10 residents at `src/game/residents.ts:43…584`) has **zero consumers** — the simulator never reads it. `countExploredDiscoveries` (`src/game/exploration.ts:133-140`) is exported with zero callers; `journal.ts:1052-1090` re-implements the same four flag checks inline.
4. **One building is anchor-only.** Pinecone Woodshop (Barnaby) has a box obstacle (`worldMap.ts:79`), a landmark zone (`worldMap.ts:266`), a full exterior build (`src/scene/builders/buildings.ts:1207-1228`), and schedule anchors — but **no door interactable, no interior, no station**; it is the largest visual surface with no interaction.
5. **Elevation is a hardcoded two-case function.** `getGroundHeightAt` knows exactly two structures — the cedar bridge and Foxglove Rise (`src/game/worldMap.ts:461-482`). Any future terraced district must edit this function; there is no elevation registry.
6. **Discovery content is one-shot.** All four Wild Hollows interactions are single-grant or daily-flag resets; there is no recurring reason to revisit (see §5, opportunity W-4).

Everything else — plaza, gazebo, fountain, pond/bridge, orchard, the three visitable neighbor interiors, benches, noticeboard, mailbox — is genuinely **Complete**: logic, visuals, save state, and tests all line up.

---

## 2. Spatial inventory & lifecycle classification

World extents: `WORLD_BOUNDS` x −25..25, z −23..23 (`worldMap.ts:49-54`) — a 50 × 46 m single-region diorama. Density: 13 box obstacles (`worldMap.ts:67-91`), 35 circle obstacles (`worldMap.ts:93-133`), 7 outdoor seats (`worldMap.ts:135-199`), 14 named landmark zones (`worldMap.ts:258-273`), 20 prop interactables (`worldMap.ts:275-296`), 5 carryable props (`worldMap.ts:201-242`), 4 exploration discoveries (`exploration.ts:30-79`), 50 nav nodes / 63 edges (`navigation.ts:13-160`). HUD region label falls back to a synthetic 'lane' zone (`worldMap.ts:549-557`).

Lifecycle classes: **Complete** = logic + visuals + save + interaction all wired; **Partially functional** = some logic, visibly incomplete surface; **Visual-only** = rendered, no interaction/logic; **Missing** = designed but absent; **Broken** = runtime defect.

| # | Location / feature | Game layer | Scene layer | Class | Evidence |
|---|---|---|---|---|---|
| 1 | Willow Lane & Fountain Square plaza | landmark `square`, fountain obstacle | cobble plaza `NeighborhoodCanvas.tsx:600` | **Complete** | `worldMap.ts:260,94`; `actions.ts:1712` (fountain wish) |
| 2 | Mossy Stone Fountain | `fountain_plaza` interactable, wish counter `fountainWishesCount`, repair gate | `buildStorybookFountain` + water shader | **Complete** | `worldMap.ts:279,306-345`; `actions.ts:1712-1732`; `landmarks.ts:294` |
| 3 | Old Bell Gazebo | `gazebo_bell` interactable, `bellRestored`/`ivyCleared` flags, `bellRungCount`, ring reducer | `buildStorybookGazebo` + ivy/swags rig | **Complete** | `worldMap.ts:261,95,278`; `actions.ts:1688-1711,1873+`; `landmarks.ts:21` |
| 4 | Noticeboard | `plaza_noticeboard` interactable, dynamic notes (forecast, quest hints, gathering) | `buildStorybookNoticeboard`, 3 toggleable flyers | **Complete** | `worldMap.ts:281,98`; `actions.ts:1839-1867`; `landmarks.ts:821` |
| 5 | Sora's Tea Cart | circle obstacle + NPC anchor + adjacent carryable `tea_tray` | `buildStorybookTeaCart` | **Partially functional** — no interactable of its own; tea only via carryable/dialogue | `worldMap.ts:97,227-233`; `landmarks.ts:654` |
| 6 | Benches (plaza ×2, gazebo, pond, orchard, rise, sorrel) | 7 `SEAT_SPOTS`, NPC occupancy, stand-up recovery | bench loop `NeighborhoodCanvas.tsx:1230-1258` | **Complete** (zoneId labeling sloppy, §4-F) | `worldMap.ts:135-199`; `walkability.ts:48-59` |
| 7 | Mirror Pond | `mirror_pond` + `pond_driftwood` interactables, skip counter, perimeter metrics | `buildMirrorPondAndBridge` (koi, lilies, reeds, dragonflies) | **Complete** | `worldMap.ts:282,287,347-401`; `actions.ts:1733+`; `vegetation.ts:452` |
| 8 | Cedar Footbridge | walkable arch via `getGroundHeightAt`, rail box | built in pond builder | **Complete** | `worldMap.ts:83,462-470`; `vegetation.ts:452-465` |
| 9 | Pond pier + toy sailboat | — | pier, sailboat, lanterns in pond builder | **Visual-only** | `vegetation.ts:446-451` docstring; no `PROP_INTERACTABLES` entry |
| 10 | West Brook culvert | — | brook + culvert under bridge | **Visual-only** | `vegetation.ts:449` docstring |
| 11 | Hollow Oak | `hollow_oak` interactable (postcard/brass secret quest chain) | `buildHollowOakLandmark` | **Complete** | `worldMap.ts:96,280`; `actions.ts:1758+`; `vegetation.ts:281` |
| 12 | Willow Step Cottage (exterior) | `player_door`, `player_mailbox`, `cottage_window_box`; `home` zone | `buildWillowStepCottage` @ (−14.5, 10) | **Complete** | `worldMap.ts:69,259,276-277,283`; `actions.ts:1267-1369`; `NeighborhoodCanvas.tsx:678-692` |
| 13 | Hearth & Crumb Bakery | `bakery_door` → interior v8 state, café tables flag | `buildStorybookBakery` @ (−12.4, −10.8) + `buildBakeryCafeTables` | **Complete** | `worldMap.ts:71,289`; `buildings.ts:626,646,819`; `actions.ts:1303` |
| 14 | Linden Book Nook | `nook_door` → interior v9 state | `buildStorybookBookNook` @ (−15.8, −1.0) | **Complete** | `worldMap.ts:73,290`; `buildings.ts:868,888`; `actions.ts:1313` |
| 15 | Copperwheel Cottage | `copperwheel_door` → interior v10 state | `buildStorybookArthurWorkshop` @ (13.1, −11.5) | **Complete** | `worldMap.ts:75,291`; `buildings.ts:1048,1069`; `actions.ts:1323` |
| 16 | Sunbeam Greenhouse | `greenhouse_door` + `greenhouse_planters`; interior v7 | `buildStorybookGreenhouse` @ (14.3, 1.7) | **Complete** | `worldMap.ts:77,284,288`; `buildings.ts:1410,1413`; `actions.ts:1293,1370` |
| 17 | Pinecone Woodshop (Barnaby) | box obstacle + `barnaby` zone + schedule anchor **only** | `buildStorybookBarnabyWoodshop` @ (12.4, 13.0) | **Partially functional** — no door, no interior, no interactable | `worldMap.ts:79,266`; `buildings.ts:1207,1228` |
| 18 | Fern Hollow Orchard | `orchard_harvest`, `orchard_skep`, gathering storyline outcome, tasting table | `buildFernHollowOrchard` + micro-life + ambient birds | **Complete** | `worldMap.ts:109-122,285-286`; `orchard.ts:35-45,143`; `actions.ts:1399,1633` |
| 19 | Marigold Lane | discovery `marigold_lane`; `marigold_bank` daily posy | wildflower drifts, signpost, stepping stones, boulders | **Complete** (signpost/stones visual-only garnish) | `exploration.ts:31-42`; `actions.ts:1549+`; `worldMap.ts:269,294` |
| 20 | Foxglove Rise | discovery `foxglove_rise`; `rise_vista` season/weather-aware panorama; deck elevation | terraced knoll, stair, deck, rails, foxgloves | **Complete** | `exploration.ts:43-54`; `actions.ts:1504-1547`; `worldMap.ts:86-90,475-480`; `wilds.ts:126-384` |
| 21 | Sorrel Hollow | discovery `sorrel_hollow` | birches, sorrel tufts, benches | **Complete** | `exploration.ts:55-66`; `worldMap.ts:271`; `wilds.ts:386-546` |
| 22 | Old Stone Well | `old_stone_well` interactable — one-time `foxglove_seeds` grant → 4th greenhouse crop | well build in wilds builder | **Complete** | `worldMap.ts:292`; `actions.ts:1448-1481`; `wilds.ts:386-478` |
| 23 | Sorrel trail brooklet + cedar footlog | — | footlog, brook bed | **Visual-only** | `wilds.ts:548-578` |
| 24 | The Bee Line | discovery `bee_line`; `wild_bee_log` inspect; Rowan routine | hive log, cairn, clover cushions | **Complete** (one-shot) | `exploration.ts:67-78`; `actions.ts:1594+`; `wilds.ts:23` |
| 25 | Willow courtyard trees & signpost | circle obstacles only | courtyard props from prototype builder | **Visual-only** (collision only) | `worldMap.ts:105-108`; `NeighborhoodCanvas.tsx:681-683` |
| 26 | Festoon plaza lanterns | `lanternsLit` flag → `festoonLanterns` env state | string bulbs rig | **Complete** | `types.ts:375,383`; `ARCHITECTURE.md:126-130` |
| 27 | Perimeter border, distant hills, grove, meadow dressing | — | `buildPerimeterBorder`, `buildGroveTreesInstanced`, `buildMeadowDressing` | **Visual-only** (by design) | `NeighborhoodCanvas.tsx:612-625` |
| 28 | Cobble lane strips | — | 8 `addCobbleStrip` calls | **Visual-only** — paths are decorative; nav graph is the real network | `NeighborhoodCanvas.tsx:600-611` |
| 29 | `REGIONS` / district expansion | single-entry registry; `regionId` persisted | — | **Missing** (planned: GAME_DESIGN §4.2 `LONG-TERM VISION`) | `worldMap.ts:56-62`; `GAME_DESIGN.md:103-104` |
| 30 | Fishing / Decorating / Photography | — | — | **Missing** (PLANNED) | `GAME_DESIGN.md:339` |
| 31 | Community Projects | — | — | **Missing** (PLANNED post-bell) | `GAME_DESIGN.md:227,290,338` |

Summary: **17 Complete, 3 Partially functional** (Tea Cart, Woodshop, + zoneId hygiene counted separately), **6 Visual-only** clusters (pier/sailboat, west brook, footlog, courtyard trees, cobble strips, ambient dressing), **3 Missing** (REGIONS expansion, hobbies, community projects), **0 Broken**.

---

## 3. Visual-vs-logic gaps (the two-directional audit)

### 3a. Visual-only content (built, no logic)

| Visual | Built at | Why it matters |
|---|---|---|
| Pond pier, moored sailboat, brass lanterns | `vegetation.ts:446-451` | The most prominent "walkable-looking" structure with no interaction; the pond raycast proxy even includes a `pierHit` cylinder (`NeighborhoodCanvas.tsx:1188-1192`) that only routes to the generic `mirror_pond` inspection. |
| West Brook culvert + flowing brook | `vegetation.ts:449`, bridge arch `worldMap.ts:462-470` | Named in `GAME_DESIGN.md:93-94` ("West Brook") as a world feature; has zero logic surface. |
| Sorrel trail brooklet + cedar footlog | `wilds.ts:548-578` | A crossing structure the player must walk *around* (no elevation hook) — a readability hazard: it looks crossable, is not. |
| Marigold Lane signpost & stepping stones; Bee Line stone cairn; clover cushions | `wilds.ts:21-23` | Garnish; no obstacle twins, no interaction. |
| Willow courtyard trees + signpost | obstacles `worldMap.ts:105-108`, build `NeighborhoodCanvas.tsx:681-683` | The signpost is a natural "world map" diegetic surface that does nothing. |
| Cobble strips | `NeighborhoodCanvas.tsx:600-611` | Authored by hand per-lane; drift from `NAV_NODES` is unaudited — no test asserts visual paths and nav paths coincide. |
| Barnaby's chimney smoke, seasonal pastry baskets, etc. | env reactivity | Fine — reactive dressing, correctly flagged. |

### 3b. Logic-only content (modeled, no dedicated visual)

| Logic | Modeled at | Gap |
|---|---|---|
| `ResidentTraits.preferredZones` | `types.ts:332`; `residents.ts:43,103,163,223,283,343,403,463,523,584` | Zero consumers anywhere (grep over `src/game` + `src/scene`). 10 residents' zone affinities are authored data that influence nothing. |
| `SeatSpot.zoneId` on outdoor seats | `worldMap.ts:143,152,161,170,179,188,197` | Only interior values are consumed (`walkability.ts:49-58`); outdoor values (`'square'`, `'gazebo'`, `'pond'`, `'orchard'`) are dead — and two are wrong: `seat_foxglove_rise` claims `zoneId: 'square'` (`worldMap.ts:188`) and `seat_sorrel_hollow` claims `'orchard'` (`worldMap.ts:197`) though each sits inside a `foxglove_rise`/`sorrel_hollow` landmark zone. |
| `countExploredDiscoveries` | `exploration.ts:133-140` | Exported, tested, unused; `journal.ts:1052-1090` hand-rolls the same checks — registry divergence risk if a 5th discovery lands. |
| `REGIONS` / `regionId` | `worldMap.ts:56-62`; `types.ts:748`; `migrations.ts:1377-1379,1485` | Persisted, sanitized, revision-hashed (`storage.ts:160`) — and read by nobody. |
| Landmark zone `home` subtitle "Your quiet porch & mailbox" etc. | `worldMap.ts:259-273` | Zones drive only the HUD label (`App.tsx:1191-1204`) and two event place-names (`actions.ts:521,3895`). No zone-based sim behavior exists. |

### 3c. Twin-discipline (the good news)

Build 10 established an explicit "obstacle twin" contract the older builds only follow informally: wilds visuals document their worldMap twins in the module docstring (`wilds.ts:13-23`), and `src/scene/wilds.test.ts:28-70` asserts (a) deck/ramp heights match `getGroundHeightAt`, (b) silhouette stays inside obstacle-box union, (c) approach spots stay clear, (d) well/bee-log visuals center on their obstacle circles. `orchard.ts:23-24` states the same contract ("All positions mirror `CIRCLE_OBSTACLES` … exported for the walkability tests") with `orchard.test.ts` enforcing it. **This twin test pattern is exactly what is missing for the six older districts** — plaza/pond/buildings have no equivalent visual-twin assertions.

---

## 4. Structural findings (with evidence)

**A. The "one location, seven files" smear.** A new outdoor interactable location touches, minimally:
1. `types.ts:17-37` — `PropInteractableId` union (typed, compile-checked);
2. `worldMap.ts:275-296` — `PROP_INTERACTABLES` entry (x/z/radius);
3. `worldMap.ts:403-440` — bespoke `focusPos` arm in the 17-branch if/else inside `getPropInteractionMetrics` (optional but every existing prop has one);
4. `actions.ts:1267-1900` — a branch in `interactWithProp` (the 4,035-LOC monolith, doc 02 W3);
5. `worldMap.ts:67-133` — obstacle(s) + `navigation.ts:13-160` — nav node(s)/edge(s) if off-graph;
6. `worldMap.ts:258-273` — landmark zone (for the HUD label);
7. `NeighborhoodCanvas.tsx:1170-1226` — raycast proxy (with special-cased blocks for fountain/pond/skep/greenhouse door);
8. scene builder + `wilds.test.ts`-style twin test (tribal, only Build 10 does it).
No document lists this sequence. `AGENTS.md:105-109` §5 covers "Adding a Resident" and "Environmental Reactivity" but **not** "Adding a world location". Doc 04 §1 assigns the world files to the World team but contains no location recipe. This is the single largest undocumented tribal-knowledge surface in the world layer.

**B. `REGIONS` does not scale today.** Every world query bypasses the region abstraction: `isPointWalkable` reads `WORLD_BOUNDS` directly (`worldMap.ts:485-503`), `getLandmarkAt` iterates global `LANDMARK_ZONES` (`worldMap.ts:560`), `NAV_NODES`/`NAV_EDGES` are module singletons (`navigation.ts:162-172`), and `getGroundHeightAt` is a hardcoded two-case function (`worldMap.ts:461-482`). A second district would either share the one global graph (must stay within 50×46 m) or fork parallel copies of all four registries. The region plumbing that *does* exist (persisted `regionId`, `REGIONS` validation in `sanitizeWorldState`) is fine but decorative.

**C. World data is partially interior-fenced.** `PlayerLocation` (`types.ts:39-45`) and `walkability.ts:22-42` give interiors their own walkability dispatch, but the exterior remains a single global map — `exteriorPlayerPos`/`exteriorPlayerFacing` (`types.ts:778-779`) assume one exterior. A second region needs the same enter/exit treatment the interiors got in v6 (doc 06 §1 row `playerLocation`).

**D. Exploration is wired correctly and cheaply.** `discoverExplorationInPlace` is a pure in-place sim step hooked at `simulation.ts:640`, gated outdoors, writing `sideFlags` + one journal memory (`exploration.ts:107-130`). It deliberately avoids schema changes (`exploration.ts:9-12` docstring; `GAME_DESIGN.md:337` confirms "no schema/migration impact"). This is the right pattern for future discoveries — but it funnels into W1's un-typed `sideFlags` bag (doc 02 W1), and `EXPLORATION_FLAG_KEYS` (`exploration.ts:81`) is cited in doc 06 §5 as the partial registry pattern to generalize.

**E. Interaction metrics encode per-prop geometry knowledge procedurally.** `getPropInteractionMetrics` special-cases fountain (radial rim approach, `worldMap.ts:320-345`) and pond (shore-box clamp + bridge exclusion + splash clamp, `worldMap.ts:347-401`) with hardcoded constants (`POND_SHORE_BOX` at `worldMap.ts:309`, `FOUNTAIN_BASIN_RADIUS` at `:307`) duplicated from the obstacle tables. `player.test.ts:514` locks this behavior. Good determinism, poor extensibility.

**F. Save-safety for world state is solid.** Exploration flags ride `sideFlags` (sanitizer preserves arbitrary keys — `exploration.ts:9-11`), props ride `worldProps` (doc 06 §1), and day-gathers ride `dailyActivities`. No world feature stores unsanctioned state (contrast W5's journal channel). `bellRungCount`, `dailyLettersRead` are owned by actions (doc 06 §1).

**G. Test coverage for the world is strong in the game layer, selective in the scene layer.** Game: `navigation.test.ts` (walkability of every node/edge `:17`, single connected component `:42`, A* routing `:67`, all schedule transitions `:87`, extra activities `:113`); `player.test.ts` (bridge elevation `:227`, pond bank walkability `:488`, multi-sided perimeter interaction `:514`); `exploration.test.ts` (162 LOC). Scene: `wilds.test.ts`, `orchard.test.ts`, `build02Exterior.test.ts` enforce twin contracts — but **only** for Build-10/orchard content.

**H. Dead data will mislead the next world implementer.** `preferredZones` (§3b) reads like a functioning sim input; an agent extending resident behavior will reasonably assume it works. Same for the misleading `zoneId` values on the two Wild Hollows seats. Dead registries are worse than absent ones.

---

## 5. Top 10 improvement opportunities (ranked by player value ÷ effort)

| # | Opportunity | Player value | Effort | Notes / anchor evidence |
|---|---|---|---|---|
| **W-1** | **Codify the "new world location" contract** as a checklist doc + one guard test (every `PROP_INTERACTABLES` entry has: a `PropInteractableId` member, an `interactWithProp` branch, a landmark zone OR explicit lane fallback, a raycast proxy, walkable approach, and an actions test) | High (every future location ships faster & safer) | Low | §4-A list is 80% written already; enforce with a test like `migrations-guard.test.ts` pattern |
| **W-2** | **Give Pinecone Woodshop a purpose**: exterior interactable (workshop bench inspection / Barnaby's ladder hook already referenced by the bell quest at `actions.ts:1849`) as a bridge to a future interior | High (removes the most visible dead building; completes the square) | Medium | §2 row 17; box obstacle `worldMap.ts:79`; zone `:266` |
| **W-3** | **Make `REGIONS` real or freeze it**: region-scoped accessor functions (`getBoundsFor(regionId)`, `getLandmarkZonesFor`, per-region nav) OR delete `regionId` reads from sanitize to avoid implying support | Medium now / High later (unblocks districts, GAME_DESIGN §4.2) | Medium | §4-B; doc 06 §1 lists world as owner |
| **W-4** | **Recurring Wild Hollows visits**: weekly bee-log honey (ties to `orchard_skep` honey theme), marigold posy → gifting integration (posy already daily-gated at `actions.ts:1549-1560`), well water refill for the carryable `water_pail` (`worldMap.ts:203-209`) | High (cozy retention; discoveries are one-shot today) | Medium | §3 evidence; all hooks exist |
| **W-5** | **Kill or wire the dead registries**: delete `preferredZones` or consume it in `RESIDENT_EXTRA_ACTIVITIES` scoring; fix `seat_foxglove_rise`/`seat_sorrel_hollow` zoneIds; make `journal.ts` consume `countExploredDiscoveries` | Medium (correctness; prevents agent-trap) | Low | §4-H; `worldMap.ts:188,197`; `journal.ts:1052-1090` |
| **W-6** | **Interactify the pier** (sit-and-skip from the pier — reuse `mirror_pond` skip logic with a distinct splash anchor `worldMap.ts:368-373`) and add a `pond_pier` seat spot | Medium (signature pond moment, zero new systems) | Low | §3a row 1 |
| **W-7** | **World manifest generator**: a script that prints nav counts, obstacle counts, seat counts and location table; docs cite the generated output (kills the 33-node / 5-bench / v10 drift permanently) | Low-Medium (doc trust) | Low | §1 finding 2; `ARCHITECTURE.md:47,100`; `GAME_DESIGN.md:81,336` |
| **W-8** | **Generalize elevation**: extract `getGroundHeightAt` cases into a data-driven `ELEVATED_SURFACE[]` registry (id, box, height fn) with the bridge + rise as first two entries; twin-test each | Medium (unblocks any future terraced district) | Medium | `worldMap.ts:461-482`; pattern proven by `wilds.test.ts:28` |
| **W-9** | **Extend the twin-contract test to legacy districts** (plaza, pond, buildings): assert every building/landmark visual sits inside its obstacle footprint the way `wilds.test.ts:36` does for the rise | Medium (prevents visual/logic drift during art passes) | Medium | §3c |
| **W-10** | **Split `getPropInteractionMetrics` prop-knowledge into data**: move per-prop focus/approach constants into `PROP_INTERACTABLES` entries (optional fields) so the if/else chain (`worldMap.ts:403-440`) shrinks to the two procedural cases | Low-Medium (preps for many new props; touches shared file per doc 04 §2) | Medium | §4-E |

(Swaps are acceptable if effort estimates shift: W-7 and W-5 are the cheapest; W-2 and W-4 are the highest raw player value.)

---

## 6. Contract template — adding a new world location

**Status today:** no document codifies this; the sequence below is reconstructed from the shipped code (Build 10 is the reference implementation). **Proposed:** adopt this as `docs/architecture/world-environment/location-contract.md` + a guard test (opportunity W-1).

```markdown
### Adding a new exterior world location (checklist)

Owner: World team (doc 04 §1: worldMap.ts, navigation.ts, walkability.ts,
environment.ts, exploration.ts). Scene surfaces co-owned per §3c twin contract.

1. GAME LAYER (src/game/ — pure TS, zero three/React):
   a. types.ts — if the location is interactable, add the id to
      `PropInteractableId` (types.ts:17-37). Additive only (doc 04 §2).
   b. worldMap.ts —
      - obstacle(s): BOX_OBSTACLES / CIRCLE_OBSTACLES (:67-133); the visual
        builder MUST mirror these exactly (twin contract).
      - `PROP_INTERACTABLES` entry: id, name, x, z, interactRadius (:275-296).
      - landmark zone in `LANDMARK_ZONES` (:258-273) — else the HUD shows
        the 'lane' fallback (getLandmarkAt :549-568).
      - optional bespoke focus/approach arm in getPropInteractionMetrics
        (:315-449) — required for water/perimeter props; plain props may
        rely on the default branch (:442-448).
      - elevated surfaces: extend getGroundHeightAt (:461-482) + guard boxes
        so off-deck approaches are blocked (rise_mound_* pattern :86-90).
   c. navigation.ts — add NAV_NODES + NAV_EDGES (:13-160) so the location is
      reachable; navigation.test.ts:42 requires ONE connected component, and
      :17 requires every node/edge walkable with actor clearance.
   d. seats (optional): SEAT_SPOTS with seatPos/approachPos/facingAngle and a
      zoneId; outdoor zoneIds are currently unconsumed — prefer the landmark
      id (:135-199; walkability.ts:48-59 only maps interior ids).
   e. discovery/story hook (optional): ExplorationDiscovery in exploration.ts
      (:30-79) — grant rides sideFlags + memories, NO schema bump; or a
      reducer branch in actions.ts interactWithProp (:1267-1900).
2. SCENE LAYER (src/scene/):
   f. builder function returning a rig with dispose() + season materials
      (wilds.ts:30-45 pattern); register in NeighborhoodCanvas assembly
      (:541-760); raycast proxy in the PROP_INTERACTABLES loop (:1170-1210).
   g. Twin test mirroring wilds.test.ts:28-70: visual inside obstacle union,
      approach spots clear, elevated decks match getGroundHeightAt.
3. PERSISTENCE:
   h. No new WorldState field needed unless state is non-boolean/numeric —
      sideFlags survives sanitize for arbitrary keys (exploration.ts:9-12);
      otherwise schema-bump protocol (doc 07 §2, four merge-points doc 06 §2).
4. GATES (AGENTS.md §4):
   i. npm test (world guard tests + twin tests), npm run lint, npm run build,
      headless Chromium screenshots 1440×900 + 390×844, 0 console errors.
5. DOCS:
   j. WORKLOG entry (entry-number protocol doc 07 §5); update this checklist
      if the contract grew.
```

**Undocumented tribal knowledge remaining after codification:** (1) the `focusPos` if/else convention ("every prop gets an arm" is convention, not requirement); (2) the `isSoftwareGl` budget discipline in builders (`wilds.ts:66`, `wilds.test.ts:98`); (3) shared-file etiquette for `worldMap.ts` (35 importers — doc 04 §2 lists the file but not the per-array ripple rules for navigation vs scene builders).

---

## 7. Verification performed during this audit

- Full reads: `worldMap.ts`, `navigation.ts`, `exploration.ts`, `walkability.ts`, `wilds.ts` (structure), master-architecture docs 00/01/02/04/06, GAME_DESIGN §04/§12.
- Targeted reads: `types.ts` (17-681, 737-1024), `actions.ts` prop branches (1267-1900), `environment.ts` composer, `landmarks.ts`/`buildings.ts`/`orchard.ts` (headers + placements), `NeighborhoodCanvas.tsx` assembly (541-1268), `residents.ts` zone data, `migrations.ts`/`storage.ts` regionId handling.
- Greps: `regionId|REGIONS`, `preferredZones`, `zoneId`, `countExploredDiscoveries`, `LANDMARK_ZONES`/`getLandmarkAt` consumers, `discoverExplorationInPlace` wiring, `SEAT_SPOTS` scene loop.
- Counts verified by script: 50 nav nodes, 63 nav edges, 13 box obstacles, 35 circle obstacles, 7 outdoor seats, 14 landmark zones, 20 prop interactables, 5 carryables, 4 discoveries.
