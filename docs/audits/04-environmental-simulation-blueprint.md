# 04 — Environmental Simulation Blueprint (Milestone 2)

**Goal**: Decompose **LITTLE SOMEWHERE**'s monolithic `computeEnvironmentState(flags)` (`src/game/narrative.ts:31-47`) and per-frame Three.js lighting/prop updates (`src/scene/NeighborhoodCanvas.tsx:828-936`) into **five cleanly separated, reactive environmental systems**:
1. **Time of Day**
2. **Weather**
3. **Seasons**
4. **Player-Driven Changes**
5. **NPC-Driven Changes**

All progression remains strictly driven by **in-game time** (`day`, `minuteOfDay`, `phase`), preserving the **Sunlit Diorama & Clay Storybook** visual direction and mobile/software-WebGL frame budgets.

---

## 1. Current State & Architectural Problems

- **Confirmed implementation**:
  - `computeEnvironmentState(flags)` (`src/game/narrative.ts:31-47`) returns an 8-field `EnvironmentalState` object derived exclusively from `StoryFlags`.
  - `NeighborhoodCanvas.tsx:904-932` blends sky, fog, sun color/angle/intensity, hemisphere fill, window glow, and lantern intensity linearly over `world.minuteOfDay` (`420..1260`), then executes `updateEnvironmentVisuals(env, phase, elapsed)` (`L828-876`) every frame.
- **Confirmed limitations**:
  1. No separation between atmospheric cycles (time, weather, seasons) and persistent neighborhood mutations (player actions vs autonomous NPC upkeep).
  2. `world.minuteOfDay` clamps inconsistently (`1260` in `NeighborhoodCanvas.tsx:895` vs `1230` in `App.tsx:206`), with no weather state or multi-day seasonal calendar.
  3. **Visual state inaccuracies in `src/scene/`**:
     - `buildOldBellGazebo()` (`src/scene/models.ts:380-382`) renders the brass `clapper` inside the bell even before `foundBrassClapper`/`bellRestored` are true.
     - `noticeBoard` (`NeighborhoodCanvas.tsx:460-480`) never updates visually when `env.noticeboardUpdated` becomes true.
     - `updateEnvironmentVisuals()` iterates `flowerGroups` and `windowMaterials` every frame with no dirty flag (`L830-834, L928-930`), and `gazeboRig.bellPivot` uses hardcoded `dtClamped = 0.016` (`L866`) instead of real frame `dt`, while `spawnChimeBurst()` re-triggers continuously while `Math.abs(bellSwingVelRef.current) > 3.6` (`L872-874`).
- **Potential risk**:
  - Adding rain, seasonal leaf palettes, NPC-tended flower stages, and lantern schedules directly onto `StoryFlags` and per-frame scene loops will create tangled flag soup and steady frame-rate drops on mobile devices.
- **Proposed improvement**:
  - Replace the single flat `EnvironmentalState` projection with a layered, pure-TypeScript **Environment Composer (`src/game/environment.ts`)** producing a revision-stamped `ComposedEnvironmentState` consumed via dirty-checks in `src/scene/environmentRenderer.ts`.

---

## 2. Five-Layer Environmental Architecture (`src/game/environment.ts`)

```
 ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐
 │ 1. Time of Day  │  │ 2. Weather   │  │ 3. Seasons   │  (Atmospheric Curves)
 └────────┬────────┘  └──────┬───────┘  └──────┬───────┘
          │                  │                 │
 ┌────────┴──────────────────┴─────────────────┴────────┐
 │             Environment Composer (src/game/)          │
 └────────┬────────────────────────────────────┬────────┘
          │                                    │
 ┌────────┴────────────┐            ┌──────────┴────────────┐
 │ 4. Player-Driven    │            │ 5. NPC-Driven         │  (Physical Diorama State)
 │    Changes          │            │    Changes            │
 └─────────────────────┘            └───────────────────────┘
          │                                    │
          ▼                                    ▼
   ComposedEnvironmentState (revision number + lighting + weather + prop visibility)
```

### Layer 1: Time of Day (`TimeOfDayState`)
- **Confirmed implementation**: `getTimePhase()` (`residents.ts:450-455`) divides `360–1260` into `morning`, `afternoon`, `golden`, `dusk`.
- **Proposed improvement**:
  - Unify `DAY_START_MINUTE = 360` (6:00 AM) and `DAY_END_MINUTE = 1290` (9:30 PM, including `App.tsx` `+2h` button) in `src/game/time.ts`.
  - Compute smooth `tNorm`, `sunElevation`, `sunAzimuth`, `skyColorKey`, `ambientWarmth`, and `lanternScheduleActive` (`minuteOfDay >= 1095 || weather === 'misty_morning'`) deterministically in `src/game/`.
  - At `minuteOfDay >= 1260`, surface a cozy non-punitive HUD prompt (*"Lanterns are glowing low—head to Willow Step Porch to rest"*), never forcing a harsh blackout.

### Layer 2: Weather (`WeatherState`)
- **Confirmed implementation**: None (always clear sky).
- **Proposed improvement**:
  - Represent weather purely by in-game `day` and deterministic `simSeed`:
    ```ts
    export type WeatherType = 'sunlit' | 'breezy' | 'misty_morning' | 'light_rain';
    export interface WeatherState {
      current: WeatherType;
      tomorrowForecast: WeatherType; // Exposed on Noticeboard / Jun morning notes!
      intensity: number;             // 0..1 (e.g. mist lifts by 10:30 AM)
      puddlesActive: boolean;        // Linger 2h after light_rain clears
    }
    ```
  - **Sunlit Diorama Safety**: Day 1 is **always `'sunlit'`** so first-time onboarding and title screen retain the signature warm clay storybook look. Gentle `'misty_morning'` transitions smoothly to `'sunlit'`/`'breezy'` after `minuteOfDay >= 630`; `'light_rain'` occurs ~1 in 5 days with warm golden puddle glints rather than gloomy storm blackness (keeping `#FAF5EC` / `#D9ECF5` readability high).
  - **Gameplay Hooks**: `light_rain` shifts NPC utility scores (`rainBehavior`: Sora/Nora under eaves, Clara by ovens) and increases `planterHydration` without requiring manual watering chores.

### Layer 3: Seasons (`SeasonState`)
- **Confirmed implementation**: None (prose mentions *"three autumns"* lore, visuals remain evergreen spring/summer).
- **Proposed improvement**:
  - Purely in-game calendar derived from `world.day`: `DAYS_PER_SEASON = 10` (`spring` -> `summer` -> `autumn` -> `winter`, starting in `'spring'` on Day 1 so Milestone 1 visuals match Day 1).
  - Outputs deterministic palette modifiers (`meadowTintHex`, `treeCanopyPalette`, `flowerPalette`, `seasonalDecorationTag` e.g. autumn marigold garlands or winter hearth wreaths) applied to shared materials only when `season` changes—zero per-frame allocations.

### Layer 4: Player-Driven World Changes (`PlayerWorldChanges`)
- **Confirmed implementation**: `StoryFlags` drives `plantersBloomed`, `fountainFlowing`, `ivyCleared`, `bellGleaming`, `festoonLanterns`, `bakeryTablesOpen`, `reconciledTogether`, `noticeboardUpdated` (`narrative.ts:31-47`).
- **Confirmed limitation**: Coupled directly into narrative flags with no clean extensibility for Milestone 2 player cottage touches or neighborhood upkeep.
- **Proposed improvement**:
  - Retain all `StoryFlags` reactions identically, while introducing an explicit `playerChanges` structure for non-story-blocking world touches:
    - `cottagePlanterChoice`: `'marigold' | 'lavender' | 'moon_petal'`
    - `placedSouvenirs`: `string[]` (for future Willow Step Cottage interior/porch shelf display)
    - `litPlazaLanternDays`: `number` (tracks persistent community warmth)
  - Fix Gazebo clapper visibility (`models.ts:380`): `gazeboRig.clapperMesh.visible = flags.bellRestored` so the hollow-oak discovery matches the 3D bell silhouette!

### Layer 5: NPC-Driven World Changes (`NpcWorldChanges`)
- **Confirmed implementation**: Zero autonomous NPC environmental changes (even Clara's bakery tables only respond to player dialogue flags).
- **Confirmed limitation**: Outside player quest triggers, the neighborhood never looks tended by its 9 living residents.
- **Proposed improvement**:
  - Allow residents' daily schedules and interactions to organically evolve lightweight, reversible diorama props stored in `WorldState.npcEnvironment`:
    - **Clara**: Sets out morning pastry basket on bakery sill (`morning`/`afternoon` when `sunlit` or `bakeryTablesOpen`); packs it in at `dusk`.
    - **Mina**: Advances `greenhouseBloomStage` (`0..3`) and adds seasonal pot color variation around Sunbeam Greenhouse across days.
    - **Jun**: Pins `noticeboardFlyerCount` (`1..3`, matching `tomorrowForecast` and recent `WorldEventRecord` summaries), visually updating `noticeBoard` meshes on the plaza.
    - **Barnaby & Arthur**: Light Copperwheel porch oil-lamp early during `light_rain` or `dusk`, and keep Gazebo lanterns trimmed once `bellRestored` is true.

---

## 3. Dirty-Flagged 3D Environment Sync (`src/scene/environmentRenderer.ts`)

- **Architectural rule**: Split `updateEnvironmentVisuals()` out of `NeighborhoodCanvas.tsx` into a dedicated `EnvironmentVisualController` that tracks:
  - `lastStaticRevision`: updates `flowerGroups`, `gazeboRig` (ivy, clapper, ribbon), `bakeryTablesGroup`, `noticeBoard` flyers, `cottage` seasonal tints **only when revision changes**.
  - `lastMinuteTick`: updates sky/fog/sun curves when `Math.abs(minuteOfDay - lastMinute) >= 0.25` (still visually smooth, skips redundant work during pause/title or unchanged frames).
  - **Pooled Weather & Droplet Particles**: Pre-allocated `InstancedMesh` (max `48` soft rain streaks or `24` breeze petals) toggled via `.visible` and `count`, respecting `isSoftwareGl` caps (e.g., `24` streaks max under software GL) so frame pacing remains stable.
  - **Bell Physics Fix**: Integrate `gazeboRig.bellPivot.rotation.z` using clamped frame `dt` (`Math.min(rawDt, 0.05)`) rather than hardcoded `0.016`, and trigger `spawnChimeBurst()` once on ring impulse rather than every frame `vel > 3.6`.
