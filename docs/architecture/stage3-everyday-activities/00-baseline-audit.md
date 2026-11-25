# Stage 3 Baseline Audit -- Everyday Activity Systems (Deliverable A)

Branch `stage3/everyday-activities`, baseline = origin/main `052e171` (verified 2026-11-25).
Every claim below was verified against source code and tests on the exact baseline commit;
documentation was never treated as proof of implementation.

Verified baseline gates: `npm run lint` clean; `npm test` = **738/738 pass**; `vite build` OK;
`CURRENT_SCHEMA_VERSION = 12` (src/game/migrations.ts:144).

## Implementation map

| # | Feature | Status | Source evidence (file:symbol) | Tests | Missing capabilities |
|---|---------|--------|-------------------------------|-------|----------------------|
| 1 | Gardening / greenhouse | IMPLEMENTED | greenhouse.ts `GREENHOUSE_CROPS`:148, `advanceGreenhouseNightlyGrowthInPlace`:258, `stageForNights`:289, `isLushStreak`; actions.ts `plantSeedAtPlotAction`:2549, `waterGreenhousePlotsAction`:2514, `harvestPlotAction`:2630; GreenhousePanel.tsx; WorldState `greenhouseState` | greenhouse.test.ts, greenhouseInterior.test.ts, greenhouseSeasons.test.ts | 4 plots / 4 crops; no outdoor beds, window boxes are gather-props not gardens (actions.ts `cottage_window_box`:1345) |
| 2 | Inventory / Satchel | IMPLEMENTED | inventory.ts `PERSONAL_ITEMS`:19 (25 items), `MAX_ITEM_STACK=20`:10, `addItemToInventory`:456, `applyItemGrants`:606 (honest grants), `getGiftReactionTier`:515; `RESIDENT_GIFT_PREFS`:344 | inventory.test.ts | No total-slot cap (per-item stacks only); `PersonalItemId` is a closed union (types.ts:206) |
| 3 | Food & cooking | IMPLEMENTED | inventory.ts `HEARTH_RECIPES`:247 (5 recipes), `RECIPE_ACTIVITY_STEPS`:312; actions.ts `cookRecipeAction`:3683, `sipBeverageAtTableAction`:1058; bakery rituals (`checkMorningBakeAction`:2867 etc.); tea at nook/copperwheel (`pourReaderCupAction`:3301, `pourKettleCupAction`:3557) | bakery.test.ts, cottage.test.ts, bookNook.test.ts, copperwheel.test.ts | All 5 recipes known from day one -- no discovery/teaching gate (LR-4 territory) |
| 4 | Shared activities | PARTIALLY (framework done, registry = 1 entry) | activities.ts `SHARED_ACTIVITIES`:52 (`share_featured_reading` only), `completeSharedActivity`:161 (transactional, idempotent); invitations.ts chassis; invitationFramework.ts; occupancy.ts | activities/invitations/occupancy tests | Exactly one shared activity; LR-3 seams documented at invitationFramework.ts:47 but absent on main |
| 5 | Interior stations | IMPLEMENTED (5 interiors, uniform contract) | cottage/greenhouse/bakery/bookNook/copperwheel modules (`*_BOUNDS`, `*_INTERACTABLES`, `selectBest*Target`); seat registries worldMap.ts:147 + cottage.ts:172 | 5 interior test files + seating.test.ts | No plug-in point: each new interior = module + actions.ts block + App.tsx arms |
| 6 | Fishing | **ABSENT** | Only decorative koi: models.ts `KoiFishRig`:37, vegetation.ts `buildKoiFish`:387, environmentRenderer.ts:633. No rod/catch/bait code, dialogue, data or tests anywhere | none | Everything (MASTER-ROADMAP.md:170 honestly says "DESIGNED... Zero implementation") |
| 7 | Photography | **ABSENT** | Only decorative mantel frame cottageInterior.ts:535; perfProbe is a QA harness, not a player camera | none | Everything |
| 8 | Decorating | PARTIALLY | Vase: cottageState.placedFlowerId (types.ts:257), `COTTAGE_VASE_ITEMS` cottage.ts:137 (3 items), actions.ts:3772. Keepsake shelf: displayedKeepsakeIds, cap 5 verified (actions.ts:3861), rewards inventory.ts:397 | cottage.test.ts | No furniture/porch/outdoor placement |
| 9 | Discoveries & journal | IMPLEMENTED | exploration.ts `EXPLORATION_DISCOVERIES`:30 (4 zones), `discoverExplorationInPlace`:107; journal.ts `buildPocketJournalView`:1182 (pure view); entries = world.memories (cap 96, migrations.ts:160) | exploration.test.ts, journal.test.ts, save-integrity.test.ts | No generic "add journal entry" helper (inline idiom everywhere); read-markers in separate localStorage key |
| 10 | Collection album | **ABSENT** | Only raw counters: discoveredItemIds, countExploredDiscoveries, everyday.ts practice profile | everyday.test.ts | Everything (roadmap places albums in Stage 5) |
| 11 | Community projects | IMPLEMENTED (PR #17) | community.ts `COMMUNITY_PROJECTS`:71 (3 projects), `contributeToCommunityProject`:403; communityProjects.ts Sorrel pilot (staged, sideFlags-borne); CommunityProjectsPanel.tsx | community.test.ts, communityProjects.test.ts | GA-1 visible rewards do not render yet (World-team backlog) |
| 12 | NPC memories / prefs / dialogue | IMPLEMENTED | memories.ts `createNpcMemoryEntry`:188, `recordNpcMemoryInPlace`:440 (caps 14/resident, TTL 5/18d), `collectWitnessesForPosition`:37(radius 8.5); perceptions.ts; dialogueEngine.ts `evaluateDialogueCondition`:301; RESIDENT_GIFT_PREFS | memories.test.ts, relationships.test.ts, dialogue tests | Memories not yet tied to everyday activities (only shared_* tags) |
| 13 | Save/load & migrations | IMPLEMENTED | storage.ts (STORAGE_KEY:40, backup:41, future-schema refusal:76-90, autosave revision:191); migrations.ts chain v1-v12 + `sanitizeWorldState`:1246 | storage.test.ts, migrations-guard.test.ts, save-integrity.test.ts | sanitizeWorldState DROPS unknown top-level keys -- extension only via sanctioned containers |

## The interaction-wiring seam (most important for adding features)

There is no central reducer. `actions.ts` exports ~47 independent pure transforms; the two
dispatch surfaces live in App.tsx (`openTargetInteraction`:402 routes by target.kind;
`handlePropAction`:905 switches over the closed `PropInteractionResult.actionType` union) and
everything commits through App.tsx `commitWorld`:347. However:

- A new row in worldMap.ts `PROP_INTERACTABLES`:300 **automatically** gets a tap proxy, HUD
  prompt and walk-then-interact via the generic loops (NeighborhoodCanvas.tsx:1249-1287,
  playerController.ts:698) -- zero canvas edits.
- A prop branch inside `interactWithProp` (actions.ts:1273) that returns NO `actionType`
  renders as an inert prose card with optional item chips and memory toast -- zero App.tsx edits.
- Tick-owned systems (exploration discovery, perceptions) hook inside simulation.ts.

## Extensible persistence containers (zero schema bump)

- `world.sideFlags: Record<string, boolean|number|string>` -- `sanitizeSideFlags`
  (migrations.ts:1038) preserves arbitrary keys. Explicitly the sanctioned extension channel
  (exploration.ts:9 comment). Preserved by `computeWorldSaveRevision` (autosave dirtying).
- `world.memories: JournalMemory[]` -- prepend idiom, dedupe by id, cap 96 at load (oldest evicted).
- `world.topicHistory` -- arbitrary keys, `seenCount`/`lastSeenDay`/`chosenChoiceIds`.
- NOT extensible without edits: inventory ids (closed union), communityProjects (unknown ids dropped),
  worldEvents (closed kind enum), npcMemories detail (closed shape), npcRuntime (ephemeral).

## Reusable APIs a new activity can call today

`applyItemGrants` (honest grants + overflowIds), `consumeItemFromInventory`, `spendMinutes` /
`isDoneToday` / `EVENING_SLIPPED_NOTE` (time.ts), `getTimePhase` (residents.ts), `hashSeed` /
`mulberry32` / `seededPick` (rng.ts), `composeEnvironmentState` (environment.ts: season/weather/phase),
`collectWitnessesForPosition` / `createNpcMemoryEntry` / `recordNpcMemoryInPlace` / `cloneNpcMemories`
(memories.ts), `pushWorldEventInPlace` (relationships.ts), `applySharedActivityAffinity`
(activities.ts:87, cap-exempt), `serializeWorldState` / `deserializeWorldState` /
`computeWorldSaveRevision` (storage.ts).

## Folklore vs reality (selected)

1. actions.ts is not a reducer switch -- the switches live in App.tsx.
2. Community memory `detail.projectId` is stripped at next save (sanitizeMemoryDetail) -- runtime-only.
3. src/game/seating.ts does not exist (seating.test.ts tests playerController + cottage registries).
4. Satchel has no total capacity; only per-item stacks (20).
5. journal read-markers live in a SECOND localStorage key (`little_somewhere_journal_read_v1`).
6. `performFountainWishAction` / `performPondStoneSkipAction` use module-level `Date.now()`
   cooldowns (actions.ts:2067, 2147) -- an accepted purity exception that new code must NOT imitate.

## LR-3 ownership boundary (do-not-touch list)

Open PRs #26-#31 (docs/lr3-*, feat/lr3-slice-1/2, fix/qa03-cross-venue-sit, feat/bakery-spatial-comfort)
touch: src/game/actions.ts, activities.ts, bakery.ts, bakery.test.ts, bakerySpatial.test.ts,
invitations.ts, invitationFramework.ts, socialProfile.ts, journal.ts, migrations.ts, types.ts,
walkability.ts, App.tsx, NeighborhoodCanvas.tsx, src/scene/builders/bakeryInterior.ts,
src/game/dialogue/invitations/*, scripts/dialogue-topics-golden*, qa03/lr3 test batteries.
Verified via `git diff --name-only origin/main...origin/feat/lr3-slice-2` (23-file union).
Their types.ts hunk touches ONLY `BakeryInteractableId` (~line 105) and their actions.ts hunks
are imports (42/72/149) + bakery reducers (2799+), leaving additive-only room elsewhere.
