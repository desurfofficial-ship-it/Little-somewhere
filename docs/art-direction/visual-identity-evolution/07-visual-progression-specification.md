# 07 — Visual Progression Specification

**Scope**: how LITTLE SOMEWHERE's *existing* gameplay progression becomes visible — Clash of Clans' legibility of progress, without its timers, levels, currencies, or any gameplay change. Everything here rides the game's proven **derive-only** doctrine: visuals are computed from persisted state; no new save fields, no schema version bump (`HANDOVER.md:7-9` "never persist a memento flag — the signals must stay derived"; `migrations.ts:838-847` shows `sanitizeSideFlags` already preserves arbitrary keys).

**Philosophy alignment** (`GAME_DESIGN.md`): progression here means *relationships deepening, stories resolving, care accumulating, and the community visibly flourishing* — the currency-free "A World That Changes With Care" pillar (Design Pillar 4). There are no building-level numbers, no upgrade bars, no completion percentages (`GAME_DESIGN.md:299` "celebration over checklist").

---

## 1. The four proven patterns (extend these, invent nothing new)

| Pattern | Existing exemplar | Mechanism |
| :--- | :--- | :--- |
| **P1 — Story-flag prop groups** | 13 flags → blooms/fountain/ivy/clapper/festoons/tables/ribbon/glint (`narrative.ts:47-67` → `environmentRenderer.ts:213-240`) | `computeEnvironmentState()` derives booleans/counts; `EnvironmentVisualController` toggles pre-built groups on revision change |
| **P2 — Outcome-branched landmark dioramas** | `orchardGatheringOutcome` swaps tasting-table centerpiece + garland glow (`orchard.ts:820-825`) | sideFlags → derived enum → mutually exclusive prop groups |
| **P3 — Derived home mementos** | 5 cottage keepsakes from counters/memories, footprint-pinned (`cottageInterior.ts:1783-1789`) | read-only derivation from `greenhouseState`, `dailyActivities`, memory ids |
| **P4 — Deterministic day-cycle swaps** | bakery bake roster, nook featured-book cycle, Copperwheel bench projects, greenhouse growth stages (`bakery.ts:135-166` etc.) | day-stamped registries → reactive furniture states |

## 2. Current flag→visual map (the baseline being preserved)

**[CONFIRMED]** full map (condensed; the renderer rows are `environmentRenderer.ts` unless noted):

| Progression signal | Derived state | Visual expression |
| :--- | :--- | :--- |
| `plantedMoonPetals` (0–3) | `plantersBloomed` | window-box flower groups scale 0.55→1.15 (`:213-216`); exterior greenhouse stage rig (`reactiveProps.ts:109-183`) |
| `repairedFountain` | `fountainFlowing` | water + spouts + cascade arcs + underwater coins; clog debris hidden (`:225-235`, water uniforms `:397-450`) |
| `clearedGazeboIvy` | `ivyCleared` | gazebo ivy group hidden (`:218`) |
| `foundBrassClapper` | — | Hollow Oak glint hidden (`:223`) |
| `bellRestored` | `bellGleaming` + `festoonLanterns` | clapper appears; festoon strand visible; lantern schedule forced; town-wide `happy` emotion (`simulation.ts:371-373`) |
| `claraArthurReconciled` / `mediationStyle` | `bakeryTablesOpen`, `reconciledTogether` | café tables; marigold ribbon; golden-hour gazebo rendezvous schedule override (`residents.ts:632-657`) |
| `lanternsLit` (Plaza Lanterns conflict arc) | festoon display | festoon strand + lantern emissive schedule (`:222,254-260`) — *this arc is already scene-expressive; §5.1 adds only an outcome-tinted accent* |
| `heardBellMystery` / world events | `noticeboardFlyerCount` 1–3 | noticeboard flyers (`:237-240`) |
| mailbox unread | flag rotation | mailbox flag lifts (`:224`) |
| orchard storyline outcome | `orchardGatheringOutcome` | tasting table + tart/picnic centerpiece + garland emissive (P2) |
| rituals (bake/browse/bench/sow/water/harvest/vase/keepsakes) | interior states | ember/steam/loaf rows; open-book cover tint; project groups + pendulum; crop stages; wet soil; vase; 5-slot shelf (Doc 01 §4.8) |

## 3. Gap analysis — progression data with no (or weak) visual presence

**[CONFIRMED]** all rows verified by code inspection (Doc 01 §4.8):

| # | Data | Current visual presence | Gap |
| :--- | :--- | :--- | :--- |
| G1 | 4 of 6 storylines (zine, herb-loaf, music stand, pocket watch) — the orchard gathering renders as a landmark diorama and the lanterns conflict already drives the festoon display | dialogue + journal only for these four | no world prop |
| G2 | Relationship tiers (Stranger→Kindred, 0–5 hearts) | greeting-distance multiplier + bubbles (`simulation.ts:836-845`), journal | nothing marks a tier *in the world* |
| G3 | Keepsake milestone rewards (affinity 35/40/45, `inventory.ts:397-428`) | gift toast + shelf display (player-driven) | the *moment* is unmarked in-world |
| G4 | Exploration discoveries (`explored_*` sideFlags) | journal rows + memories only | landmarks carry no "discovered" mark |
| G5 | `dayOfSeason` 1–10 | none (season dressing is binary per season) | no within-season drift |
| G6 | Lifetime ritual counters (`kneadingSessions`, `booksRead`, `projectsAdmired`, `teasShared`) | journal prose; mementos use only `>0` | no growth gradient |
| G7 | `noticeboardUpdated` | computed + revision-packed, **no renderer consumer** (`narrative.ts:66-67`, `environment.ts:201`) | dead signal (or `flyerCount` is the intended proxy) |
| G8 | `cozyLateNightHint` (≥21:00, `environment.ts:139`) | composer-side only | candidate for a "warm windows late" pass [verify first] |

## 4. Design rules for all extensions

1. **Derive-only**: computed from existing `flags` / `sideFlags` / counters / memory ids / day numbers — zero schema impact, zero reducers, zero gameplay coupling (P3 doctrine).
2. **Revision-gated rendering**: static prop groups flip inside the existing dirty-flag blocks (`environmentRenderer.ts:205-286`); no per-frame cost.
3. **Permanent, gentle, non-cluttering**: additions are small prop groups *within district mesh budgets*; no HUD pips; no floating icons (the game's restraint is identity — `VISUAL_IDENTITY.md` §8).
4. **In-game time only**: no real-world timers, no waiting bars, no login cadence (`GAME_DESIGN.md:262-264`).
5. **Celebration over checklist**: nothing implies completeness percentages (`GAME_DESIGN.md:299`).

## 5. Extension specification

### 5.1 Storyline world props (G1 — closes the biggest gap; Pattern P1/P2)

The four currently scene-silent storylines each leave one permanent prop in the place its story lived; the lanterns conflict — already expressed through the festoon display (§2) — gains only a small outcome-tinted accent. This generalizes the orchard-gathering precedent:

| Storyline | World prop (proposal) | Placement law |
| :--- | :--- | :--- |
| *Willow Lane Zine* (Pip & Nora) | Chalk-drawn zine cover pinned to the Noticeboard side rail + a chalk caddy at its foot | outside obstacle footprints; flyer-count visuals untouched |
| *Lemon-Thyme Sourdough* (Mina & Clara) | Small herb-strung window crate on the Bakery display ledge (bakes the arc's herbs into the façade) | on corbel ledge geometry, `buildings.ts:594-603` zone |
| *Cedar Music Stand* (Sora & Barnaby) | The notched cedar music stand itself, by the Mirror Pond south bank near Sora's bench | clear of bench `seatTopY` volumes & nav edges |
| *True on the Route* (Jun & Arthur) | Jun's repaired pocket watch hanging as a tiny brass pendulum charm under the Copperwheel porch lantern | porch dressing zone |
| *Plaza Lanterns conflict* resolution | Two hooded lantern sconces on the pier posts (the arc's "Hooded Amber Compromise" outcome made literal) | pier geometry, `vegetation.ts:597-643` zone |

Each is gated on its existing `sideFlags` outcome value (branch-tinted per outcome where the arc has two endings, mirroring P2). **Priority P2** — Doc 08 Phase 5 (item 5.1).

### 5.2 Relationship-tier tokens (G2+G3 — quiet, environmental)

At affinity milestones, the *resident's own place* shows a small handmade token — derived from `playerRelations[].affinity` thresholds, never a HUD pip:

- **Friend (≥3 hearts)**: a tiny crafted charm appears on the resident's porch/home zone (Clara: flour-dusted rolling pin hook; Mina: pressed-flower glass; Barnaby: carved wood bead string; Nora: ribbon book thong…).
- **Kindred Spirit**: a hand-tied marigold ribbon knot on their porch post (visual rhyme with the festival ribbon — `landmarks.ts:235-256`).
- The keepsake-reward moment (G3) plays through the existing gift/toast flow, then the reward item *also* rests on the resident's shelf/counter the next day (derive from `neighborGiftsReceived` + item id), completing "the world remembers" symmetry with the cottage mementos.

**Priority P2.** All placement through interior/porch dressing groups with seasonal-clearance-law compliance (existing tests `greenhouseSeasons.test.ts:70-96` pattern).

### 5.3 Within-season drift (G5 — the season breathes)

Use `dayOfSeason` (already computed, `environment.ts:259`) to interpolate *existing* tintable materials across the 10 days rather than switching palettes binary:

- Canopy/leaf tint lerps bud→full→turn within Spring/Summer/Autumn (piggybacks `grove_crown_base/top` cached materials — `orchard.ts` docstring notes season tints are free there).
- Meadow clover density visuals: two pre-built instanced layers, visibility crossfading days 1→4 and 8→10 (zero new geometry, one extra draw call within budget).
- Interior: sill-posy bottle gains stems as the season ages (cottage only; trivial group toggle at day thresholds 3/7).

**Priority P2.** Winter stays its own hushed state (identity).

### 5.4 Exploration marks (G4)

Each discovered Wild Hollows landmark gains a modest, in-world "found" cue derived from `explored_*`: a hand-tied survey ribbon on the Old Stone Well coping, a small cairn stone added on Foxglove Rise, a chalk arrow on Marigold Lane's signpost, a sprig wreath on the Bee Line hive log. Children-first: no treasure-glitter, no minimap ping. **Priority P3.**

### 5.5 Tiered mementos & counters (G6)

The Pass-13 memento pattern gains growth stages (still derive-only): e.g. the book stack gains a 2nd book at `booksRead ≥ 4`, a 3rd at ≥ 9; the honey crock gains a dipper after 3 orchard harvests; the recipe card gains a second card after 5 kneads. **Priority P3.**

### 5.6 Housekeeping signals (G7, G8)

- Map `noticeboardUpdated` to a one-day subtle change: the newest flyer's brass pin brightens (emissive 0.4→0.9) on update day [renderer-side, safe]. *Deprecating the flag itself would touch game-layer code and requires explicit design approval — out of this roadmap's scope.* Either way the signal stops being dead.
- `cozyLateNightHint` (≥21:00): hearth-truth window intensities gain a +0.2 warm step at 21:00+ (one curve line). [verify current behavior in capture before shipping]

## 6. Building / interior / character / neighborhood evolution summary

| Domain | Evolution principle (no timers, no levels) |
| :--- | :--- |
| **Buildings** | Not "levels" — *lived-in depth*: storyline props (§5.1), seasonal porches (existing + Copperwheel parity), and care-derived accents. Buildings never gain floors, banners, or "upgrade" states. |
| **Interiors** | Deterministic daily cycles (existing) + memento growth (§5.5) + relationship tokens on shelves (§5.2). |
| **Characters** | Wardrobe truth already exists (winter knits); relationships read via *their place*, not their bodies (§5.2); emotion via existing face system (Doc 04). |
| **Neighborhood** | Flyer counts (existing), orchard transformation (existing), exploration marks (§5.4), within-season drift (§5.3). The square visibly *settles into being loved*. |

## 7. Compatibility & testing contract

1. **No new save fields, no migrations, no reducers** — all extensions derive in `environment.ts` / interior rigs from existing state (v10 shape, `types.ts:686-734`).
2. `npm test` green: all existing flag→visual tests (`environmentRenderer.test.ts:140+`, seasonal suites, memento footprint tests `cottageInterior.test.ts:407-475`) stay green; each §5 extension adds its own derive/toggle test in the same suite style.
3. **Fresh-save parity**: a brand-new save must be visually identical to today's Day 1 (all extension groups hidden at zero progress) — explicit test.
4. **Full-progress capture**: the QA harness gains a "veteran save" (scripts like `make_build9_save.ts` pattern) capturing every §5 group visible, one image per phase.
5. Every extension respects the seasonal clearance law (0.4–0.45 u from interactables) and district draw budgets.
