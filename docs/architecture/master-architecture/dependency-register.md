# Cross-Team Dependency Register

Maintained append-only per `07-parallel-development-protocol.md §6`. One entry per initiative
that crosses subsystem boundaries in doc 04 §1.

## [2026-11-22] Living World — World & Environment Lead (WP-1..WP-4)
- Team: World & Environment (owns `worldMap.ts`, `navigation.ts`, `walkability.ts`, `environment.ts`, `exploration.ts`, `playerController.ts`)
- Branch: `feat/world-environment-living-world` (pushed to origin)
- Scope: World & environmental systems (owner); touches Actions (reducers), Narrative (derive), Residents (schedules), Audio, Scene (builders/renderer/canvas), Types (contract), Items (none), Sim (none — no `simulation.ts` change)
- Shared files (additive-only per doc 07 §4): `types.ts` (+`sorrel_garden_bed` prop id), `actions.ts` (one `sorrel_garden_bed` reducer branch), `residents.ts` (one `mina_sorrel_garden_tend` candidate), `narrative.ts` (`festival_ring` festoon derive clause), `audio.ts` (outdoor rain mode + `playBreezeAmbience`), `narrative.ts` consumers untouched
- Schema bump: no (WorldState stays v11; project state rides `sideFlags`, sanitizer-safe)
- WORKLOG entries claimed: 059
- Contract surfaces: `ComposedEnvironmentState.worldEchoes` (new additive field: pebble stack / nosegay stub / garden stage), `communityProjects.ts` registry (pure, world-side half of GAME_DESIGN §12.2), `WildsRig.setGardenStage/setWellPebbleStack/setPosyBankPickedToday`, `cozyAudio.playRainAmbience(start, outdoor)` + `playBreezeAmbience(start, winter)`, `NeighborhoodCanvasProps.onDiscoveryFound?`, player-radius 0.48 nav guards
- Reviewers needed: Sim (residents candidate), Persistence (none needed — sanitizer untouched, `sanitizeSideFlags` already preserves arbitrary keys), HUD (toast wiring), Scene (wilds budget comment 80→88)
- Status: implemented on branch; ready-for-review
