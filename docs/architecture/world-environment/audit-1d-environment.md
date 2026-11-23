# Audit 1-d — Environmental Simulation (Weather / Season / Day-Night / Ambient Life / Audio)

Branch `feat/world-environment-living-world` · read-only audit · all `file:line` refs verified against working tree.

---

## 1. Composer layer-by-layer verdict (`src/game/environment.ts`)

`composeEnvironmentState()` (environment.ts:134-298) returns `ComposedEnvironmentState` with a packed
deterministic `revision` (253-258) so the renderer only touches GPU/scene state on change.

| Layer | Outputs | Verdict |
|---|---|---|
| L1 Time (`TimeOfDayState`, env.ts:14-21, 152-159, 180-185) | `phase` (morning<690≤afternoon<960≤golden<1110≤dusk, time.ts:16-21), `tNorm` (420-1290 → 0..1), `sunElevation`/`sunAzimuth`, `lanternScheduleActive` (dusk ∨ ≥1095m ∨ rain ∨ mist ∨ `flags.lanternsLit`), `cozyLateNightHint` (≥1260) | **Strong.** `sunElevation`/`sunAzimuth` are **dead outputs** — the renderer recomputes its own sun angle/height (environmentRenderer.ts:474-476) and never reads them. |
| L2 Weather (`WeatherState`, env.ts:23-29, 161-178) | 4 types `sunlit/breezy/misty_morning/light_rain` (types.ts:401); day 1 forced `sunlit` (env.ts:120-121); `effective` = mist lifts to sunlit ≥630m (env.ts:163-165); fixed intensities 0.75/0.55/mist-decay/0 (env.ts:166-173); `puddlesActive` (rain today ∨ rained yesterday before 600m, env.ts:174-177); `tomorrowForecast` | **Good visuals, thin elsewhere.** Rain intensity is a constant — no drizzle/storm gradation. Forecast is journal/noticeboard text only (journal.ts:1223, actions.ts:1842) with zero gameplay effect. |
| L3 Season (`SeasonState`, env.ts:31-39, 187-190, 277-285) | `getSeasonForDay` 10-day cycle (time.ts:36-51); 3 wash hexes per season (env.ts:64-97, spring = pure white = authored identity) | **Strong visually, weakest sim coupling.** Season changes greenhouse growth only (greenhouse.ts:247 winter freeze) + almanac flavor (cottage.ts:381). Nothing else in `src/game/` branches on season. |
| L4 Player changes (`EnvironmentalState`, narrative.ts:43-70) | `plantersBloomed 0..3`, `fountainFlowing`, `ivyCleared`, `bellGleaming`, `festoonLanterns`, `bakeryTablesOpen`, `reconciledTogether`, `noticeboardUpdated`, `orchardGatheringOutcome` | **All 9 consumed** by environmentRenderer.ts:270-327. Note: `festoonGroup.visible = festoonLanterns ∥ dusk` (renderer:409-411) — flag is not exclusive. `bakeryTablesOpen` only differs for `mediationStyle==='shared_baking'` (narrative.ts:65); `gentle_truth`/`festival_ring` renders identically. |
| L5 NPC touches (`NpcEnvironmentTouches`, env.ts:41-46, 195-210) | Clara pastry basket (morning; afternoon if sunlit/reconciled), Mina greenhouse stage 1..3, noticeboard flyers 1..3, Arthur porch lamp (rain/golden/dusk) | **All 4 consumed** (renderer:305-320, 294-297). |
| L6 Progression (additive, env.ts:296 → progressionVisuals.ts:239-449) | storyline props ×5 with outcome styles, resident tokens, keepsake echoes, season drift (day 1 = anchor, winter never drifts, CANOPY_DRIFT_TARGETS:221-233), exploration marks ×4, memento tiers, noticeboard glint, posy stage | **All consumed** via `progressionPresentation.ts:666-714` + renderer drift (820-856). 2^53-safe radix revision, frozen cached state — clean. |

**Consumers of `composeEnvironmentState`:** scene `NeighborhoodCanvas.tsx:1762` (per-frame → `EnvironmentVisualController`), HUD `App.tsx:168,273,298` (weather/season sync 2159-2201), sim/dialogue `actions.ts:1484,1506,1552,1596,1634,1734,1840` (exploration flavor text, noticeboard notes), `journal.ts:1136,1219-1223` (Pocket Journal projection, almanac, well status). Dialogue engine bypasses the composer and reads `world.weather`/`world.season` directly for topic conditions (dialogueEngine.ts:377-379). `cottageInterior.ts:1821-1826` duplicates the effective-weather mist rule (drift risk: two copies of one rule).

## 2. Coverage matrix — system → visual → sim/audio/dialogue → gaps

| System | Visual (renderer/canvas) | Sim / Audio / Dialogue | Gaps |
|---|---|---|---|
| **morning→afternoon** | Sun/sky lerp tNorm 0-0.72 (renderer:415-427); window glow 0.22 (376-391); fog near/far 42/86 (448-450) | NPC anchor scores + meal window 690-820 (simulation.ts:223-249); morning-lark stoop beat <430 (simulation.ts:257-266) | Sun elevation curve not reused from composer (dead env.ts:157-158) |
| **golden** | `_sunGolden` #FF9D4A, long shadows raking (renderer:472-476), glow 0.9, rim eases (464-467); orchard gathering lanterns on (322-327) | Golden reconciliation beat for Clara/Arthur (simulation.ts:193-201); Arthur porch lamp (env.ts:209-210) | — |
| **dusk / late hint** | `_skyDusk` #4C5B8F indigo, hemi 0.54→0.22, envIntensity 0.68→0.15 (453-459); lanterns 2.15 + breathe ±0.06 (399-411); festoon auto-on; fireflies (707-714); late-night window step +0.2 | Late-dusk porch wind-down ≥1225 (simulation.ts:204-213); dusk-only topics | **No night exists** — clock hard-stops 1290; `advanceToNextDay` jumps to 480m (storage.ts:521,604). No stars/moon/deep-dark pass; fireflies are the only "night" cue. |
| **rain (light_rain)** | Instanced rain 48/24 (renderer:127-179, 641-658); puddles visible (330-334); sky/fog wash + fog 32/76 (430-451); sun ×0.78; window glow 0.45; pond `uRain` (567); cottage rain streaks + wet-glass veil (cottageInterior.ts:1839-1848); wind 0.65 | **Real sim coupling:** anchor score 0.55 vs 0.95 (simulation.ts:249); extras ×2.1 sheltered / ×1.15 umbrella-stroll / ×0.35 exposed (275-285); `shelter_home` emotion sad/relaxed (384-385); rain-behavior topics (dialogue/everyday/weather.ts:17-44) | **Rain audio indoors only** (NeighborhoodCanvas.tsx:1899-1906) — outdoor rain is silent; no rain on player actions (no speed/gather penalty); umbrella visuals never appear on umbrella_stroll residents |
| **breezy** | windStrength 1.0 → shader sway grove/wilds/meadow + sign swingers (ambientSway.ts:116-128); petals drift; curtains stir (cottageInterior.ts:1857-1861); pond `uWind` | Breezy preferred-weather extras ×0.6 if unpreferred (simulation.ts:286-287); misty/breezy topic (weather.ts:47+) | No wind audio; no gust variance over time (constant per day) |
| **misty_morning** | Sky/fog lerp ×intensity decay to 630m (renderer:433-435); fog 26/68; lantern schedule on; puddle-adjacent glass veil 0.13 indoors | Mist topic; NPC extras `onlyWeathers` can include it | Mist never affects NPC pathing/visibility gameplay; composer `weather.current` read only for Clara basket (env.ts:198) |
| **winter** | Ground/cobble/grove/wilds wash + deepened cobble (renderer:209-251); petal mesh recolored to snow (243-250) but **flakes only fall while `breezy`** (660-663: `sunlit && spring` ∥ breezy); hemi winter ground; lily blooms hidden, koi ×0.24 speed (578-598); water `uWinter` ice look; sway stiffened −45% (ambientSway.ts:88); knit tint + bench cushions (canvas:2203-2221); porch seasons ×3 + 4 interior season groups; cottage winter comforts/frost (cottageInterior.ts:1849-1866) | Greenhouse growth frozen (greenhouse.ts:247); almanac tips; journal "Quiet until spring" (journal.ts:1095); orchard micro-life/bees/butterflies off (renderer:734-760) | **No snow accumulation on ground/roofs**; petals show pink in spring sunlit but a calm winter day has zero falling snow; NPCs have no seasonal schedule variants (`RESIDENT_EXTRA_ACTIVITIES` gate on weather only, simulation.ts:275); orchard harvest & gathering not season-gated (actions.ts:1399-1433) |
| **spring/summer/autumn** | Season washes + within-season drift day 1→10 (renderer:820-856; meadow 5.3b); autumn leaves/spring petals via petalMesh recolor; spring meadow spread (botanicalDressing.ts:379-385) | None (no seasonal activities/events) | Seasonal flavor only in exploration text (actions.ts:1497-1520, 1596-1616); no seasonal recipes/crops/festivals |

**Pinned tests:** `environment.test.ts` pins day-1 sunlit, mist lift at 630m, puddle decay, 10-day season roll + weather re-roll on `advanceToNextDay`, revision increments on flags/NPC-touches/orchard outcomes, late-night hint (44-102). Renderer contracts pinned by `environmentRenderer.test.ts` / `lightingCurves.test.ts`; seasons by `bakerySeasons/greenhouseSeasons/nookSeasons/cottageWinterComforts/porchSeasonLife.test.ts`.

## 3. Ambient life inventory

| Where | What | Mechanics / perf |
|---|---|---|
| `orchardMicroLife.ts` (508 ln) | Blossom butterflies ×6 (3 on software-GL) instanced wings/bodies anchored to crowns/gate/bench/skep; skep bees on figure-8 excursions | InstancedMesh, seeded LCG, zero per-frame alloc (104-121, 318+); gates: sunlit/breezy, !dusk, !winter; bees also !rain |
| `orchardAmbientExtras` (orchardMicroLife.ts:318-508) | Songbirds + seasonal blossom/leaf drift particles | season-aware tint switch autumn/summer (458-470); drift off in rain/winter/dusk |
| `reactiveProps.ts` (782 ln) | Clara basket, Mina greenhouse stage buds/bloom, Arthur porch lamp + halo, puddle sheet, pooled butterflies/fireflies/pond sparkles/chimney wisps | All `update()` mutate transforms/scalars only; wisp mask reused (renderer:133-134, 720-727); chimneys keyed to per-resident phase schedules |
| `pondRig` (models + renderer:562-627) | Koi figure-8 loops, lily bob, reed sway, dragonflies (dry+warm only), toy sailboat | Winter damps everything via `isWinter` scalar; splash ripples event-driven (`triggerPondRipple`, canvas:2230-2239) |
| `ambientSway.ts` (133 ln) | Vertex-shader sway registry (grove/wilds/meadow) + hanging sign swingers | 2 scalar writes/material + 2/sign per frame; instancing phase from `instanceMatrix[3]` — draw-call neutral |
| `botanicalDressing.ts` (499 ln) | 13 handcrafted meadow clusters (tufts/flowers/pebbles), spring wildflower spread, season-day drift | Placement respects cobble rects (15-43); instance re-tint edge-triggered only |
| `porchSeasonLife.ts` (66 ln) | 4 hidden season groups per porch; bakery/nook/copperwheel wired (canvas:1879-1881) | Pure visibility writes, idempotent (tested round-trip) |
| `residentFeel.ts` (187 ln) | NPC bank/lean/squash + footstep/skid dust-poof cues | Module-load state slots, no alloc; motion feel, not environment-driven |
| Static (no life) | Gazebo ivy/bell, fountain droplets (only when flowing), festoon bulbs (visible toggle, no per-bulb flicker), bakery tables, orchard tasting table | Festoon breathe is one material-level sine (renderer:401) |

**Perf verdict:** clean. Particle budgets capped for software-GL (renderer:137-139), exterior ambient sections early-return indoors (478-486), zero per-frame heap allocs observed; InstancedMesh everywhere (rain/petals/butterflies/orchard crowns+fruit).

## 4. Soundscape inventory (`src/game/audio.ts`)

**Procedural one-shots (10):** `playFootstep` (38), `playUiTap` ×~60 call sites in App.tsx/Canvas, `playDialogueVoice` (73, App.tsx:339), `playMemoryChime` (92, milestone/gift/keepsake), `playGazeboBell` (113, canvas:381), `playKettleSteam` (142, CottageStationModal.tsx:220), `playArrangePop` (184, vase/keepsake/satchel), `playWaterSplash` (211, fountain wish/pond skip App.tsx:791,941,954), `playSitDown` (238), `playSip` (276).

**Ambient loops (2, both indoors-only, idempotent, mute-aware):** hearth crackle bed + randomized pops (399-469) — cottage interior while `hearthLit` (canvas:1888-1895); rain room-tone low rumble + patter hiss (327-392) — any interior on rainy days (canvas:1899-1906).

**Missing layers:** no outdoor rain/wind/mist ambience, no birdsong (visual songbirds exist!), no crickets/firefly-dusk tone, no day-night music/ambience gradient, no bell-distant reverb bed, no season variation (winter hush). All SFX triggered from `App.tsx` UI reducers, `NeighborhoodCanvas.tsx` (footstep 2442, bell, splashes) and `CottageStationModal.tsx`; **`src/game/` never calls audio** (correct layering; audio.ts guards `AudioContext`).

## 5. Dead flags / dead visuals

**Dead composer outputs:** `timeOfDay.sunElevation`, `timeOfDay.sunAzimuth` (env.ts:17-18,157-158 — never read; renderer recomputes its own arc at 474-476). `weather.current` read exactly once (Clara basket, env.ts:198); `revision` already double-packs orchard outcome (246-251) vs progression radix revision — two coexisting packing schemes.

**Dead/degenerate story-flag branches:** all 13 `StoryFlags` (types.ts:362-376) are consumed somewhere, but:
- `mediationStyle: 'gentle_truth' | 'festival_ring'` — no visual or sim distinction vs each other (narrative.ts:65 keys only `shared_baking`; both other paths set `claraArthurReconciled`+`lanternsLit` anyway).
- `borrowedBarnabyLadder` — dialogue-gate only; no prop/visual ever references the ladder (grep: narrative.ts, dialogue/quest/conflicts.ts only).
- `foundPostcard` / `deliveredPostcard` / `brewedChamomileTea` — quest-gates only; no world prop or environment output (no postcard pinned to a corkboard, no teacup trace).

**Dead enum values:** `WorldEventRecord.kind` declares `story_flag | npc_social | weather_shift | storyline_beat | conflict_shift` (types.ts:572-579) but writers only ever emit `bell_ring` and `player_help` (actions.ts:874, 1955, 3985). `weather_shift` is especially ironic — weather only changes at day rollover (storage.ts:603), never mid-day.

**Thin sideFlags:** `wellPebblesCount`, `pondPebblesSkipped`, `fountainWishesCount`, `posyPickedDay`, `meadowPosiesPicked`, `foundFoxgloveSeeds` (actions.ts:1474-1584, 1735, 1968) are counters feeding flavor text only — no visual echoes (pebble piles, fewer posies on the lane, etc.).

**Visuals with no state behind them:** festoon bulbs appear at dusk pre-`lanternsLit` (renderer:409-411) — intentional ambiance but the "lit the lanterns" milestone has no exclusive payoff; winter snow recolor of petalMesh exists but flakes never fall on calm winter days (660-663); `orchardGatheringOutcome` extras note says marigold lanterns sway (actions.ts:1652) — bulbs get emissive (orchard.ts:826-827) but no sway animation.

## 6. Ranked improvement opportunities (player value ÷ effort)

| # | Opportunity | Why it lands | Exact integration point |
|---|---|---|---|
| 1 | **Outdoor rain + breeze ambience loops** (extend `playRainAmbience` to run when `!isIndoors` at lower gain; add wind whoosh bed for `breezy`) | Weather is currently silent outside — the single biggest atmosphere hole; audio.ts patterns already exist | audio.ts:327-392 (gate), NeighborhoodCanvas.tsx:1899-1906 (condition `isIndoors &&` → drop, scale gain) |
| 2 | **Winter snowfall on calm days** — extend petal condition to `sunlit && winter` with slow fall speed | A calm winter day with zero falling snow breaks the season fantasy; mesh+recolor already exist | environmentRenderer.ts:660-663 (`showPetals`), fall speed via `windSpeed` 666 |
| 3 | **Seasonal NPC activities** — add `onlySeasons` next to `onlyWeathers` in `RESIDENT_EXTRA_ACTIVITIES` + weight hook | 10-day seasons currently change almost nothing in sim; residents shoveling/leaf-piling/flower-picking = living world for near-zero new systems | simulation.ts:275-287 (gates), residents.ts extras defs, types.ts activity option |
| 4 | **Reuse composer sun params** — delete renderer's private sun arc, drive from `sunElevation/sunAzimuth` | Kills dead outputs + one source of truth for shadows/golden hour | environmentRenderer.ts:472-476 consumes env.ts:157-158 |
| 5 | **Snow blankets & roof caps** (static per-season groups, porch-Season pattern) | Winter is tint-only on ground/roofs; cheapest big-visual win reusing `porchSeasonLife.ts:30-61` pattern on `buildings.ts`/`wilds.ts` rigs | environmentRenderer.ts:209-251 season block; builders/buildings.ts |
| 6 | **Mid-day weather shifts** — emit `weather_shift` world events when forecast ≠ today at ~630m or 1110m; renderer already handles rain→puddle transitions | Forecast finally matters ("tomorrow's sky" becomes a plan); enum value already exists | storage.ts advanceToNextDay (schedule roll), actions.ts worldEvents writers:874, environment.ts:161-178 |
| 7 | **Counter→visual echoes for sideFlags** — pebble cairn at well, posy gap in Marigold Lane dressing | 6 accumulated counters currently produce text only; instanced dressing already supports re-tint/hide | botanicalDressing.ts `setSeasonDayProgress` neighbor API; actions.ts:1497,1584 writers |
| 8 | **Seasonal harvest/almanac gameplay** — gate `orchard_harvest` yield or item by season (autumn crabapples, spring blossoms) + almanac tips as real buffs | First true season→reward loop; cottage almanac already exists as flavor | actions.ts:1399-1433 (harvest), cottage.ts:381-405 |
| 9 | **Night epilogue window** — extend clock to ~1350 with a true night curve (stars, moon disc, deeper fog) before `advanceToNextDay`, keeping 1290 as "curfew" | `cozyLateNightHint` proves demand; fireflies+lanterns already set the mood; clock plumbing exists | time.ts:6,32-34 (extend), environment.ts:154 tNorm, renderer:415-427 curve tail |
| 10 | **Dedupe effective-weather rule** — cottage interior should consume `composed.weather.effective` instead of re-deriving | Prevents drift bug class (two mist-lift copies); one-line refactor | cottageInterior.ts:1821-1826 ← NeighborhoodCanvas.tsx:1857 passes `composed` |

*Quick wins: #1, #2, #4, #10 are small, test-covered diffs (#4/#10 are pure refactors guarded by `lightingCurves.test.ts` / `environmentRenderer.test.ts`). Big swings: #3, #6, #9 are cross-layer (game+scene) and should follow AGENTS.md §5 reactivity pipeline.*
