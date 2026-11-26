# Gardening Expansion — Architecture & Ownership Contract

**Branch**: `feat/gardening-expansion` (base `4893d56`, schema v12→v13)
**Baseline**: 991/991 tests, tsc clean, build green
**Campaign**: Gardening Expansion — The Neighborhood Garden Ecosystem

## 1. Existing Architecture (REUSED)

The greenhouse (`src/game/greenhouse.ts`) is a clean, registry-driven, deterministic
plot engine with 4 crops, 4 fixed plots, nightly growth, care streaks, and full
persistence since schema v7. The cottage window box and exterior planters are
daily-tend fixed-grant props (no plot lifecycle). Sorrel Hollow has a 4-stage
community-tending bed (sideFlags counter). All three patterns are preserved.

## 2. New Architecture (ADDITIVE)

### 2.1 Garden registry (`src/game/gardens.ts` — NEW FILE)

A `GardenDef` registry mirroring `COMMUNITY_PROJECTS` / `GREENHOUSE_CROPS`:

```ts
export type GardenId = string;
export interface GardenDef {
  id: GardenId;
  label: string;
  blurb: string;
  ownerId: 'player' | ResidentId | 'community';
  anchorPropId: string;           // references PROP_INTERACTABLES
  plotCount: number;              // 1-4
  allowedCropIds?: readonly string[];  // subset of all crops; undefined = all
  growthNightOverride?: Partial<Record<string, number>>;
}
export const GARDENS: readonly GardenDef[] = [...];
```

### 2.2 Garden state (reuses GreenhousePlotState shape)

```ts
export interface GardenState {
  plots: GreenhousePlotState[];  // same shape as greenhouse plots
  totalHarvests: number;
  totalPlanted: number;
  lastTendedDay: number;
}
```

### 2.3 WorldState addition (schema v13)

```ts
// WorldState gains:
gardens: Partial<Record<GardenId, GardenState>>;
```

### 2.4 Migration v12→v13

Pure `migrateV12ToV13`: adds `gardens: {}` and bumps `schemaVersion`. No data moves.
The greenhouse stays on `world.greenhouseState` (grandfathered). New gardens persist
on `world.gardens[id]`.

### 2.5 Plot primitives (extracted from greenhouse)

Pure functions `sowPlotInPlace`, `waterPlotInPlace`, `harvestPlotInPlace`,
`advancePlotNightlyGrowthInPlace` — extracted from the greenhouse reducers so both
the greenhouse and new gardens share the same lifecycle algorithm. The greenhouse
reducers become thin wrappers calling these primitives.

### 2.6 Nightly growth integration

`advanceToNextDay` calls `advanceAllGardensNightlyGrowthInPlace(world.gardens, nextSeason)`
after the existing `advanceGreenhouseNightlyGrowthInPlace` call. Same algorithm,
same winter rules, same care-streak semantics.

### 2.7 Generic garden reducers

`plantInGardenAction`, `waterGardenAction`, `harvestFromGardenAction` — parallel to
the greenhouse reducers but dispatching by `gardenId`. The greenhouse reducers
delegate to these with `gardenId='sunbeam_greenhouse'` (accessor adapter).

### 2.8 Future NPC ownership contract

`ownerId` field on `GardenDef` supports `'player' | ResidentId | 'community'`.
No NPC gardening autonomy is implemented. The contract documents integration
points (ActivityCandidate.gardenId, memory tags `garden_tended_<id>`, dialogue
conditions via requiresNpcMemory, shared activities via SharedActivityDef.gardenId).

## 3. New Garden Spaces (from WS-B spatial audit)

5 verified candidate locations, each walkable, non-obstructing, with clear spatial identity:

| Garden | Location | Owner | Plots | Theme |
|---|---|---|---|---|
| `clara_herb_garden` | South of Bakery (-12.4, -15.5) | Clara | 2 | Culinary herbs |
| `nook_lavender_bed` | South of Book Nook (-14.0, 3.5) | Nora | 2 | Lavender + chamomile |
| `pond_iris_border` | NE of Pond (6.5, 19.5) | Community | 2 | Waterside ornamentals |
| `beeline_pollinator_bed` | Near orchard skep (7.0, -16.5) | Community | 2 | Pollinator flowers |
| `barnaby_compost_garden` | East of workshop (17.5, 13.0) | Barnaby | 2 | Sunflowers + nasturtiums |

Plus 1 cottage south-face window box (visual, no new plot).

## 4. New Plant Content (from WS-D audit)

New crops (additive to `GreenhouseCropId`):
- **Marigold** — ornamental, 2-night growth, `marigold_seeds`→`marigold_bloom`
- **Sage** — culinary herb, 3-night growth, `sage_seeds`→`sage_sprig`

New crops extend the registry; each gets seed + harvest PersonalItemId entries.

## 5. Scene Builder (from WS-C audit)

`src/scene/builders/gardenBed.ts` — reusable `buildGardenBedRig(palette, shadowTex, spec)`
factory. Follows the greenhouse rig pattern (prebuilt stage groups, visibility-toggle
update, soil material swap, ambient sway). Uses shared palette materials. ~6-10 draw
calls per bed. Contact shadow via `addStaticContactShadow`.

## 6. Files Owned

**New files**:
- `src/game/gardens.ts` — registry + types + primitives + generic reducers
- `src/game/gardens.test.ts` — tests
- `src/scene/builders/gardenBed.ts` — outdoor garden bed visual rig

**Modified files (additive)**:
- `src/game/types.ts` — GardenId, GardenState, GardenDef, new crops, new items, `gardens` field
- `src/game/migrations.ts` — v13 bump, migrateV12ToV13, sanitizeGardensState
- `src/game/storage.ts` — fingerprint, nightly growth, advanceToNextDay
- `src/game/greenhouse.ts` — extract plot primitives (pure refactor)
- `src/game/actions.ts` — generic garden reducers + greenhouse wrapper refactor
- `src/game/inventory.ts` — new seeds + harvests
- `src/game/everyday.ts` — practice profile touchedToday extension
- `src/game/worldMap.ts` — new PROP_INTERACTABLES for garden beds
- `src/scene/NeighborhoodCanvas.tsx` — wire garden bed rigs

**Untouched**: greenhouse.test.ts, community.ts, invitations.ts, activities.ts, occupancy.ts

## 7. Schema Migration Justification

Schema v12→v13 is required because `world.gardens` is a new persisted collection that
cannot be expressed via `sideFlags` (it needs per-plot `GreenhousePlotState` arrays
with cropId, stage, nightsGrown, wateredToday, waterStreak). The migration is pure
additive (`gardens: {}` default), backward-compatible (v12 saves load with empty
gardens), and follows the existing 12-step migration chain pattern.

## 8. Risks

- **Twin-determinism**: nightly growth uses the same pure algorithm; no new RNG.
- **Save-compat**: v12 saves load with empty `gardens: {}`; sanitizer defaults.
- **Greenhouse regression**: greenhouse reducers become thin wrappers; existing
  26+ greenhouse tests must stay green byte-for-byte.
- **Draw-call budget**: 5 beds × ~8 draws = +40 calls (+1.7% over 2,304 baseline).
- **Navigation**: all 5 bed locations verified clear of LOS edges at 0.48m radius.

## 9. Implementation Order

1. `gardens.ts` core module (registry + types + primitives + reducers)
2. Schema v13 migration + sanitizer + nightly growth
3. New plant content (crops + seeds + harvests in inventory)
4. World props + interactables for garden beds
5. Scene builder for outdoor garden beds
6. Tests
7. Adversarial QA
8. Documentation + delivery
