# Changelog

All notable changes to **LITTLE SOMEWHERE** are documented in this file.

## [0.10.0] — 2026-11-22

### Added — Character Quality Build CQ-1 (expression, motion & presentation program)
- **Living faces**: damped eye micro-gaze (rest wander, motion steadying, speech saccades, downcast sad/tired, away-glance embarrassment, surprised lift) + emotion-gated blush warmth (joy warms, weariness fades, embarrassment blooms) + emotion-paced speech flap rate + occasional double-blink — every face now answers the sim's live `emotion`/`emotionIntensity` stream (rigs expose `eyeBindings`/`blushMeshes`; both builders, Jun included).
- **Grounded sitting**: seated boots pitch toes-down around a compensated ankle point scaled by seat height (bench vs stool), residents glide into the seat facing on arrival instead of snapping, seated players ease around, and the Book Nook host page-reads while hosting an invitation.
- **Continuous gait blending**: walk/run/sprint amplitudes ride the controller's speed ramps instead of popping at tier gates (`opts.speed`).
- **Visible gift hand-overs**: the new `'gift'` player pulse + a 1.25 s receive gesture — the delivered prop rides the recipient's hand before being treasured away; satchel gifts and held-item "Share" both animate.
- **Social mirroring**: dialogue goodbyes earn a wave-back from the nearest friendly outdoor neighbor; first-ever meetings flash a `surprised` welcome; bench thieves earn an organic `frustrated` huff ("Oh — I was just resting there.").
- **Idle life**: slow weight shifts, occasional thoughtful fidgets, and emotion flavor riding the gait (excited bounce, weary sag).

### Performance & compatibility
- Zero per-frame allocations added to `tick()`; zero new meshes/materials/draw calls; WorldState stays v11 (no migration); every pre-existing test contract unmodified — suite 595/595, `tsc` 0 errors.
## [0.11.0] — 2026-11-22

### Added — Everyday Gameplay Systems (Community Projects, Greenhouse Care Depth, Practice Profile)
- **WorldState v12 (additive)** — `communityProjects` contribution shelves + per-plot greenhouse `waterStreak`; clean v11 migration, sanitizer whitelists, save-revision fingerprints, simulation clone isolation.
- **Community Projects** — three registry-driven neighborhood endeavors (Marigold Garland for the Plaza, Orchard Lantern Preparations, Mirror Pond Mosaic) with any-of item goals, no deadlines and no expiry: contribute everyday items at the plaza noticeboard, nearby residents notice and remember (tag `shared_community` rides the SF-4 dialogue echo), completion saves a journal memory, one `player_help` world event, neighbor gratitude (+4/+1, cap-exempt), and a permanent `sideFlags` reward the World team renders visibly in town.
- **Greenhouse care depth** — consecutive-watered-night streaks reward attentive tending with a deterministic lush harvest (+1 yield); rain days let the rain chain carry the watering for free; Mina's one-time lavender seed sachet unblocks the fourth crop; care lines + rain hints in the panel.
- **Everyday Practice Profile** — derive-only eight-practice participation summary (gardening, kitchen, reading, tea & tables, mending, wilds, friendship, community) with cozy tier titles ('Quiet Soil' → 'Keeper of the Beds'), a touched-today line, and a derived keeper title, surfaced in the Pocket Journal alongside a Community Shelves card.
- **Community Contribution Shelf panel** — noticeboard-driven sheet with honest disabled states, progress bars, contribute-one/contribute-all buttons, and completed banners.

### Fixed — everyday honesty & coherence
- **Phantom item gains eliminated** — every grant path now reports only what truly entered the satchel (`applyItemGrants`; stack-cap overflow no longer claims items the player never received).
- **Brewing agrees with the story** — brewing chamomile tea at the hearth now sets `flags.brewedChamomileTea` (previously the bell-quest gate was dialogue-only).
- **`lavender_seeds` is obtainable** — the greenhouse's fourth crop was previously unreachable in legitimate play.
- **Named minute spends** — everyday activity time costs route through one clamp with a gentle 'the evening slipped away' note.

### Tests
- 30 new tests (community ×14, greenhouse care ×8, practice profile ×8) + literal repairs; totals now **625/625 passing**, `tsc` 0 errors, layer-boundary green, production build green.

## [0.9.0] — 2026-11-20

### Added — Milestone 3 (Build 9: Visitable Copperwheel Cottage & Arthur's Brass Workshop)
- **Copperwheel Cottage Enterable Interior (5 stations + window-armchair seat)** — the third visitable neighbor interior and the last of `GAME_DESIGN.md` §12.2's interior list: clockmaker's workbench (maple top, iron vise, gear tray, felt mat, hanging loupe, tool pegboard), bed alcove (iron frame, quilt, nightstand regulator watch + framed photo + wall lamp), mended-pieces shelf & brass-pull drawers with the open ledger, copper kettle stove (fire door, kettle + cups, visitor's card, flue into the header beam), quilted window armchair + footstool, brass-lettered door with letter slot, hanging bench lamp, morning window shaft with a chamomile sill pot, and 24 brass-dust motes. Exterior porch dressing (brass-edged doormat, clock-parts repair crate, lean-to sign) beside the pre-existing porch lantern (`copperwheelInterior.ts`, `Step Inside [E]`).
- **Deterministic bench project cycle** — one project rests on the felt per day (day % 4): *The Orchard Pendulum* (Rowan's crabwood gate clock) → *A Music Box Comb* (Barnaby's cedar music box) → *The Watch Escapement* (Jun's courier pocket watch) → *bench rest* (rolled felt, oiled drawers). Each project saves its own one-time memory; helping with the fine work counts a winding session on working days.
- **Daily Copperwheel rituals** — check the workbench & help with the fine work (+10m working / +8m rest), pour a chamomile cup at the copper kettle (+6m, the existing sipable `chamomile_pear_tea`), read Arthur's mending ledger (one-time starter tea + seasonal rereads, +8m), and peek at the nightstand's railmen regulator watch (+4m inspect). Kettle steam, the pendulum swing, and the bench-lamp glow react live in the rig.
- **Arthur dialogue & journal integration** — `side_arthur_workshop_bench` invitation (winter / bell-restored / default variants) + `daily_arthur_workshop_checkin` reacting only to his own workshop's observable state; Pocket Journal `Copperwheel Cottage` Discoveries row tracking the workshop lifecycle.
- **WorldState v10** — pure `v9 -> v10` migration hydrating `copperwheelState`; interior-aware spawn validation; Copperwheel-aware day rollover (porch wake-out); `resolveAnySeatById` spans five seat registries.

### Fixed — cross-build defects surfaced by Build 9 QA
- **Interior door prompt** — `copperwheel_door` was missing from `PROP_INTERACTABLES`; the exterior `Step Inside [E]` prompt could never fire without it (`worldMap.ts`).
- **Indoor sitting persistence** — the save sanitizer resolved seats through the outdoor-only registry, so sitting at any indoor seat (cottage stools since 2C, café chair, reading armchair) silently degraded to standing on save/load; the sanitizer now resolves all five registries with interior/exterior pairing enforced (`migrations.ts`, regression-tested).
- **Cross-interior sit-and-sip** — `sipBeverageAtTableAction` hard-gated to `cottage_interior` (Pass-5 leftover), silently refusing the sip that every Build 7/8 indoor seat advertised; the ritual now serves any indoor seat with seat-aware prose (`actions.ts`, regression-tested).
- **Software-WebGL fence deadlock** — `afterDraw`'s fence poll could freeze the whole loop when a driver never signals `SYNC_GPU_COMMANDS_COMPLETE`; a 250 ms wait budget degrades pacing gracefully instead (`NeighborhoodCanvas.tsx`).

### Tests
- 27 new/extended suites (copperwheel engine ×19, copperwheel 3D rig ×5, Arthur dialogue gating, journal discovery lifecycle, indoor-seat persistence, cross-interior sip, migration-chain updates); totals now **250/250 passing** (Build 9 rebased onto Round 4/5 + Dialogue Modularization — Arthur's topics live in `src/game/dialogue/interiors/copperwheel.ts`, golden snapshot re-baselined to 79 topics), `tsc` 0 errors, production build passing.

## [0.5.0] — 2026-11-20

### Added — Milestone 2C Polish Round 3 (Everyday Life Passes 8–12)
- **A room that knows the weather & the hour** — rain streaks sliding down the west window, a translucent wet-glass veil with dimmed/cooling pane emissive, suppressed sun shafts and hushed dust motes in rain/mist, breezy-only linen curtain sway, winter sill frost wedges, and shelf clock hands that now read the actual in-game time (`cottageInterior.ts`, zero-GC reactive updates).
- **Rain room-tone** — `playRainAmbience()`: looping low rumble + faint patter hiss, gated to rainy-day interiors on transitions only, layering under the hearth crackle, mute-respecting (`audio.ts`, `NeighborhoodCanvas.tsx`).
- **The home breathes outside** — pure `computeChimneySmokeStrength()` gates the Willow Step Cottage chimney: clean while the hearth is cold, baseline smoke when lit, visibly harder while the kettle is warm (`cottage.ts`, `willowLaneDiorama.ts`).
- **The neighborhood notices home rituals** — Mina's new `everyday_home_kettle_steam` daily-slice topic reads the steaming window / tended vase cues; the Pocket Journal home card counts "Quiet tea-table moments" from first-time tea ritual memories (`narrative.ts`, `journal.ts`, `JournalDrawer.tsx`).
- **Weather-aware morning wake line** — resting now names the world you wake into: four weather lines plus a winter frost accent appended to the wake toast (`buildMorningWakeLine`).

### Changed
- Interior rig update now derives weather/season/minuteOfDay reactivity from `WorldState` directly (no signature change, no schema bump); `WillowCottageInteriorRig` exposes `rainStreaks`, `wetGlassVeilMat`, `frostDressing`, `clockHands`, `windowShaftMat`, `moteMaterial`, and `curtainPanels` for tests.
- `updateWillowPrototypeMotion` gains an optional `smokeStrength` parameter (default 1 preserves the old visual for callers without cottage state).

### Tests
- 8 new suites (126 → **134 passing**): living clock hands, rain/mist/sunlit window states, shaft & mote suppression, curtain sway, winter frost, chimney strength mapping, kettle-steam topic branches + integration, wake lines, journal ritual count, audio room-tone idempotency.

## [0.6.0] — 2026-11-20

### Added — Milestone 3 (Build 6: Visitable Sunbeam Greenhouse & Mina's Growing Life)
- **Sunbeam Greenhouse Enterable Interior (5 stations)** — the neighborhood's second walkable cutaway diorama: glasshouse shell with timber ribs and pitched glass roof, potting bench with brass-pull seed drawers, west growing shelf with four terracotta pots, rain barrel + hanging copper watering can, and Mina's oak worktable (planting notes, tea, specimen jars). Exterior cedar doorway with hanging lantern and planted sign on the west glass wall (`Step Inside [E]`).
- **Shared Growing Corner (day-driven, zero-FOMO)** — sow chamomile/lavender/lemon-thyme seed folds into 4 shared pots; watered pots grow one stage per in-game night (soil mound → sprout → leafy → per-crop blooms, with darkened watered soil), unwatered pots simply wait, and winter freezes growth until spring. Harvests yield crop ×2 + one seed fold back (fully seed-sustainable). Growth feeds the existing cottage hearth recipes and giftable economy.
- **Mina's Planting Notes & Starter Packet** — reading the worktable notes grants a one-time chamomile + thyme starter packet; Mina gains two dialogue topics (`side_mina_greenhouse_corner` offer + state-reactive daily check-in honoring her own building's observable state, incl. winter dormancy).
- **WorldState v7** — pure `v6 -> v7` migration hydrating `greenhouseState`; interior-aware spawn validation for both interiors; greenhouse-aware day rollover (players who sleep in the greenhouse wake at their entry spot).
- **Pocket Journal Discoveries** — new `Sunbeam Greenhouse` landmark row tracking the shared corner lifecycle (`Mina's glass corner` → `Shared corner open` → `N pot(s) growing` / `N ready to harvest` → `Resting between sowings`).
- **UI** — new `GreenhousePanel` sowing/harvest boards with live plot-overview chips and night-progress rows; satchel seeds labeled "For sowing at Sunbeam Greenhouse"; HUD label `Sunbeam Greenhouse` indoors.
- 26 new/extended test suites (greenhouse engine ×16, greenhouse 3D rig ×5, Mina dialogue gating, journal discovery lifecycle, inventory catalog); totals now **157/157 passing** (on the merged Round-3 baseline), `tsc` 0 errors, production build passing.

## [0.4.0] — 2026-11-19

### Added — Milestone 3 (Build 2: Completing Fern Hollow Orchard)
- **Orchard Social Routines & Shared Tasting Table Activities** — added Fern Hollow Orchard utility activities (`clara`, `mina`, `barnaby`, `pip`, `rowan`), shared post-completion Tasting Table gatherings, north-orchard social banter, Noticeboard bulletin updates, and Rowan's orchard mailbox letter.
- **Interactive Orchard Bee Skep (`orchard_skep`) & 3-Stage Orchard Storyline (`side_orchard_gathering`)** — added season-, weather-, and gathering-reactive skep inspection (`Woven Bee Skep & Honey Crock`), the 3-stage *The Fern Hollow Orchard Gathering* arc with dual permanent outcomes (`spiced_tart_table` vs `blossom_honey_picnic`), item rewards, cross-resident relation boosts, non-omniscient epilogue dialogue, and Pocket Journal `Stories` + `Discoveries` updates.
- **Permanent 3D Tasting Table & Orchard Micro-Life Completion** — enhanced `orchard_skep` with glazed honey crock + dipper + clover tufts, built the permanent cedar **Orchard Tasting Table** (`ORCHARD_TASTING_TABLE` synced with `worldMap.ts`) + outcome-switched tea/tart platters + lit marigold lantern garland via `OrchardRig.setGatheringVisual()`, and added 3 perched **Orchard Songbirds** + instanced seasonal **Orchard Blossom / Leaf Drift** (`buildOrchardAmbientExtras`).

## [0.3.0] — 2026-11-19

### Added — Milestone 3 (Build 4)
- **10th resident: Rowan, the Orchard Keeper** — a full registry-derived neighbor for Fern Hollow Orchard: straw hat + woven gathering-basket prop (heaped crabapples), 4-phase orchard schedule (blossom counts, skep tending, bench journaling, keeper's corner), 4 autonomous activities (incl. a light-rain shelter under the west canopy and a `seat_orchard_bench` rest claim), two daily dialogue topics (blossom calendar + harvest-ladder), and automatic integration into memories, gossip, social encounters, and old-save hydration.
- **Fern Hollow micro-life (sway hooks + butterflies + bees)** — `OrchardRig.updateWind` sways crowns & fruit rigidly about a trunk-top pivot with the shared wind curve (breezy/rain/calm), restoring the authored rest pose exactly when calm; new `builders/orchardMicroLife.ts` adds per-blossom-tinted butterflies anchored to crowns/gate/bench/skep (3–6, quality-tiered) and figure-eight skep bees (2–4), both weather/phase/season-gated by the environment controller with zero per-frame allocations.
- 5 new test suites (orchard sway ×2, orchard micro-life ×3) covering pivot math, rest-pose restore, canopy bounds, anchor fidelity, and weather gating; the memory save-size bound is now derived from `RESIDENT_ORDER.length` instead of hardcoding 9 residents.

## [0.1.0] — 2026-11-18

### Added
- Selected **Sunlit Diorama & Clay Storybook** visual design direction.
- Built headless TypeScript game engine (`src/game/`) covering world collision, 4-phase schedules for 9 residents, branching dialogue trees (*The Silent Gazebo Bell*), environmental reactivity calculation, `localStorage` persistence, and procedural Web Audio SFX.
- Built isometric Three.js renderer (`src/scene/`) with composite low-poly clay cottages, greenhouse, lathe-geometry brass bell gazebo, flowing fountain, wooden footbridge, time-of-day atmospheric shifts, and `isSoftwareGl` pacing.
- Built mobile-first storybook UI (`src/components/`) including orbiting `TitleOverlay`, `VirtualJoystick`, bottom-docked `DialogueSheet`, `JournalDrawer`, and `PauseModal`.
- Added unit tests (`src/game/engine.test.ts`) and repository documentation (`AGENTS.md`, `ARCHITECTURE.md`, `GAME_DESIGN.md`, `HANDOVER.md`, `WORKLOG.md`, `README.md`).
