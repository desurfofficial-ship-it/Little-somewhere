# Everyday Gameplay Systems — Implementation Record

- **Date**: 2026-11-22
- **Branch**: `feat/everyday-gameplay-systems` (base: main @ `07be49c`)
- **Method**: foundation package landed first (shared files), then three parallel specialist packages with strict file ownership, then integration, UI, and independent QA. Six parallel read-only audits preceded all design work.

## Change surface (24 files)

### GA-0 Foundation (schema v12, additive only)
| File | Change |
|---|---|
| `src/game/types.ts` | `GreenhousePlotState.waterStreak: number`; `CommunityProjectProgress`, `CommunityProjectsState`; `WorldState.communityProjects` |
| `src/game/migrations.ts` | `CURRENT_SCHEMA_VERSION = 12`; `migrateV11ToV12` (backfills shelves + streaks); `sanitizeGreenhouseState` clamps streaks; `sanitizeWorldState` runs `sanitizeCommunityProjectsState`; `createDefaultWorldState` carries the new slice |
| `src/game/storage.ts` | `computeWorldSaveRevision` fingerprints `communityProjects` + per-plot streaks; `advanceToNextDay` persists shelves via existing spread |
| `src/game/simulation.ts` | `stepSimulation` pure-clone list extended with a deep `communityProjects` copy |
| `src/game/inventory.ts` | `applyItemGrants()` — single honest grant path (merges duplicate ids, reports true `gainedItems` + `overflowIds`) |
| `src/game/time.ts` | `spendMinutes()` (single day-end clamp + `eveningSlippedAway`), `isDoneToday()`, `EVENING_SLIPPED_NOTE` |
| `src/game/community.ts` | data layer: `COMMUNITY_PROJECTS` registry (marigold_garland / orchard_lanterns / pond_mosaic), factories, `sanitizeCommunityProjectsState`, view models, noticeboard prose, contribution counter |

### GA-1 Community Projects transaction (specialist package C1)
| File | Change |
|---|---|
| `src/game/community.ts` (append) | `CommunityContributionReason`, `COMMUNITY_REASON_LABELS`, `contributeToCommunityProject()` — guard chain (7 machine reasons, world-reference-identical refusals), goal-clamped consumption via the central inventory API, witness NPC memories (tag `shared_community` → SF-4 echo), completion burst (idempotent journal memory, `player_help` world event, thanksFrom participant memories + `applySharedActivityAffinity` +4/+1 gratitude, `sideFlags[worldFlag]`) |
| `src/game/community.test.ts` | 14 tests, CP-01…CP-14 (refusals, clamps, witnesses, completion burst, idempotency, gratitude cap-bypass, day-roll persistence, sanitizer, views, noticeboard) |

### GA-2 Greenhouse care depth (specialist package C2)
| File | Change |
|---|---|
| `src/game/greenhouse.ts` | `LUSH_WATER_STREAK_MIN = 3`, `isLushStreak()`, `describeCareStreak()`; `advanceGreenhouseNightlyGrowthInPlace` streak bookkeeping (watered night +1, missed night reset, winter reset, ready plots keep streak) with byte-identical growth math |
| `src/game/greenhouse.test.ts` | 14 plot literals repaired (`waterStreak`), 8 tests added GD-01…GD-08 |
| `src/game/actions.ts` (reducers) | `harvestPlotAction` lush yield (+1) with warm toast + honest chips; `waterGreenhousePlotsAction` rain-day free watering (`light_rain` → 0 minutes, rain-chain prose); `plantSeedAtPlotAction` seeds streak at 0 |
| `src/game/actions.ts` (exterior) | first-ever Sunbeam planters tend grants the one-time `lavender_seeds` sachet (`foundLavenderSeeds`) — repairs the dead crop |

### GA-3 Everyday practice profile (specialist package C3)
| File | Change |
|---|---|
| `src/game/everyday.ts` | 8-practice catalog (labels, blurbs, 5-rung tier ladders), `deriveEverydayPracticeProfile()` (derive-only, null-safe, deterministic), `touchedToday`, `deriveKeeperTitle`, `formatTouchedTodayLine`, `EVERYDAY_PRACTICE_ORDER` |
| `src/game/journal.ts` | `JournalPracticeCard` + `dailyPractices` field; builder in `buildPocketJournalView` |
| `src/game/everyday.test.ts` | 8 tests, EP-01…EP-08 |

### GA-4 Honesty & coherence repairs (foundation/integration)
| File | Change |
|---|---|
| `src/game/actions.ts` | `cookRecipeAction` now sets `flags.brewedChamomileTea` (brewing agrees with the bell-quest dialogue gate) + honest output grant + overflow note; grant-path adoption at cottage window box, greenhouse planters, orchard crates, pond driftwood, marigold bank, old stone well (foxglove), sill planter; `spendMinutes` adoption replaces magic minute literals (+12/+15/+20/+15/+10/+10/+8/+4-flavored sites as applicable) |
| `src/game/cottage.test.ts` | chip expectation updated for the lavender seed sachet (GA-2) |
| `src/game/dialogue.test.ts`, `src/scene/greenhouseInterior.test.ts`, `src/game/journal.test.ts` | hand-built plot literals carry `waterStreak: 0` |

### GA-5 UI packages (specialist package C4)
| File | Change |
|---|---|
| `src/components/CommunityProjectsPanel.tsx` | new — noticeboard-driven contribution sheet: summary strip, per-project cards with venue chips, item rows (`have in satchel: N`, progress bars, contributed/goal fractions), Contribute 1 / Contribute all buttons with honest disabled states, completed banners; 44px targets, no backdrop-filter, `max-h-[70vh]` scroll |
| `src/components/GreenhousePanel.tsx` | per-plot care-streak lines (`describeCareStreak`, sage when lush) + rain-day hint |
| `src/components/JournalDrawer.tsx` | Daily Practices card (keeperTitle + 8 lines + touched-today footer) + Community Shelves card in Discoveries |
| `src/App.tsx` | `communityProjectsOpen` state + modal lifecycle parity (Escape stack, key exclusivity, HUD closeouts); `handleContribute` (refusal → reason label toast; success → commitWorld + memory-chime pattern); `community_projects_panel` actionType branch; panel rendered adjacent to GreenhousePanel |
| `src/game/journal.ts` | `JournalCommunityCard` + `communityProjects` field + builder (integration owner) |

### Docs
| File | Content |
|---|---|
| `docs/architecture/everyday-gameplay/00-improvement-plan.md` | plan of record |
| `docs/architecture/everyday-gameplay/01-audit-synthesis.md` | six-audit evidence |
| `docs/architecture/everyday-gameplay/02-design-decision-register.md` | GA-D1..D9 |
| `docs/architecture/everyday-gameplay/03-implementation-record.md` | this file |
| `docs/architecture/everyday-gameplay/04-adversarial-qa.md` | QA evidence |
| `download/asset-qa/everyday-gameplay/` | browser QA screenshots (desktop + mobile) |

## Schema v12 notes for downstream teams

- `communityProjects`: `Record<string, { contributed: Partial<Record<PersonalItemId, number>>, completedDay: number }>` — only registry-known project ids and per-def accepted item ids survive sanitization.
- **World team handoff (GA-D4)**: `sideFlags.communityGarlandComplete` / `sideFlags.communityOrchardLanternsComplete` / `sideFlags.communityPondMosaicComplete` are the permanent-visible-reward triggers (Bell precedent: read them in `computeEnvironmentState` / `EnvironmentVisualController` / scene builders).
- **Narrative team note**: witness + thanks NPC memories use tag `shared_community` — already collected by SF-4 `unmentionedSharedTags` (≤6 days) for the +5 echo boost; a future `everyday_community_echo` topic can gate on it without engine changes.

## Test totals

625/625 passing = 595 inherited (unmodified) + 30 new (14 CP + 8 GD + 8 EP) + cottage/dialogue/journal/scene literal repairs.
