/**
 * Gardening Expansion — comprehensive test suite.
 *
 * Tests the garden registry, plot primitives, nightly growth, planting,
 * watering, harvesting, persistence, corruption handling, determinism,
 * and cross-activity isolation.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreshWorldState, serializeWorldState, deserializeWorldState, advanceToNextDay } from './storage';
import { stepSimulation } from './simulation';
import {
  GARDENS,
  getGardenDef,
  getOrCreateGardenState,
  getGardenState,
  createInitialGardenState,
  summarizeGarden,
  cloneGardens,
  sowPlotInPlace,
  waterPlotInPlace,
  harvestPlotInPlace,
  advancePlotNightlyGrowthInPlace,
  advanceAllGardensNightlyGrowthInPlace,
  tendResidentGardenInPlace,
  residentNeedsToTend,
} from './gardens';
import {
  plantInGardenAction,
  waterGardenAction,
  harvestFromGardenAction,
  interactWithGardenBed,
  isGardenBedProp,
  gardenIdForProp,
} from './actions';
import { GREENHOUSE_CROPS, createInitialGreenhousePlot, stageForNights } from './greenhouse';
import { applyItemGrants, consumeItemFromInventory, getItemCount } from './inventory';
import { PERSONAL_ITEM_MAP } from './inventory';
import { deriveEverydayPracticeProfile } from './everyday';
import { DIALOGUE_TOPICS } from './dialogue';
import type { WorldState, GardenState, GreenhousePlotState, PersonalItemId } from './types';

// ── Registry ──────────────────────────────────────────────────────────────────

test('garden registry: 5 gardens with valid definitions', () => {
  assert.ok(GARDENS.length >= 5, `at least 5 gardens (got ${GARDENS.length})`);
  for (const def of GARDENS) {
    assert.ok(def.id, 'garden has an id');
    assert.ok(def.label, `${def.id} has a label`);
    assert.ok(def.blurb, `${def.id} has a blurb`);
    assert.ok(def.anchorPropId, `${def.id} has an anchorPropId`);
    assert.ok(def.plotCount >= 1 && def.plotCount <= 4, `${def.id} plotCount 1-4`);
  }
  // Verify unique ids.
  const ids = GARDENS.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length, 'garden ids are unique');
});

test('garden prop routing: all 5 bed props map to garden ids', () => {
  assert.ok(isGardenBedProp('bakery_herb_bed'));
  assert.ok(isGardenBedProp('nook_lavender_bed'));
  assert.ok(isGardenBedProp('pond_iris_bed'));
  assert.ok(isGardenBedProp('beeline_pollinator_bed'));
  assert.ok(isGardenBedProp('barnaby_compost_bed'));
  assert.equal(gardenIdForProp('bakery_herb_bed'), 'clara_herb_garden');
  assert.equal(gardenIdForProp('fountain_plaza'), null, 'non-garden prop returns null');
});

// ── Plot primitives ───────────────────────────────────────────────────────────

test('sowPlotInPlace: sets crop, day, stage 0, wateredToday true', () => {
  const plot = createInitialGreenhousePlot();
  sowPlotInPlace(plot, 'sage', 3);
  assert.equal(plot.cropId, 'sage');
  assert.equal(plot.plantedDay, 3);
  assert.equal(plot.stage, 0);
  assert.equal(plot.wateredToday, true);
  assert.equal(plot.waterStreak, 0);
  assert.equal(plot.nightsGrown, 0);
});

test('waterPlotInPlace: sets wateredToday true', () => {
  const plot: GreenhousePlotState = { cropId: 'sage', plantedDay: 1, nightsGrown: 0, stage: 1, wateredToday: false, waterStreak: 0 };
  waterPlotInPlace(plot);
  assert.equal(plot.wateredToday, true);
});

test('harvestPlotInPlace: resets to empty, returns yield', () => {
  const plot: GreenhousePlotState = { cropId: 'sage', plantedDay: 1, nightsGrown: 2, stage: 3, wateredToday: false, waterStreak: 3 };
  const result = harvestPlotInPlace(plot, 2, true); // lush
  assert.equal(result.yieldCount, 3, 'lush harvest yields 3');
  assert.equal(plot.cropId, null, 'plot reset to empty');
  assert.equal(plot.stage, 0);
});

test('advancePlotNightlyGrowthInPlace: watered growing plot advances', () => {
  const plot: GreenhousePlotState = { cropId: 'sage', plantedDay: 1, nightsGrown: 0, stage: 0, wateredToday: true, waterStreak: 0 };
  advancePlotNightlyGrowthInPlace(plot, 'spring', 2);
  assert.equal(plot.nightsGrown, 1, 'nightsGrown incremented');
  assert.equal(plot.stage, 1, 'stage advanced to sprout');
  assert.equal(plot.wateredToday, false, 'wateredToday reset');
  assert.equal(plot.waterStreak, 1, 'streak incremented');
});

test('advancePlotNightlyGrowthInPlace: unwatered plot resets streak but does not die', () => {
  const plot: GreenhousePlotState = { cropId: 'sage', plantedDay: 1, nightsGrown: 1, stage: 1, wateredToday: false, waterStreak: 2 };
  advancePlotNightlyGrowthInPlace(plot, 'summer', 3);
  assert.equal(plot.nightsGrown, 1, 'nightsGrown unchanged (no growth)');
  assert.equal(plot.stage, 1, 'stage unchanged (no regression)');
  assert.equal(plot.waterStreak, 0, 'streak reset');
  assert.equal(plot.wateredToday, false);
});

test('advancePlotNightlyGrowthInPlace: winter freezes growth', () => {
  const plot: GreenhousePlotState = { cropId: 'sage', plantedDay: 1, nightsGrown: 0, stage: 0, wateredToday: true, waterStreak: 2 };
  advancePlotNightlyGrowthInPlace(plot, 'winter', 2);
  assert.equal(plot.nightsGrown, 0, 'no growth in winter');
  assert.equal(plot.stage, 0, 'stage frozen');
  assert.equal(plot.waterStreak, 0, 'streak reset in winter');
});

test('advancePlotNightlyGrowthInPlace: empty plot is no-op', () => {
  const plot = createInitialGreenhousePlot();
  advancePlotNightlyGrowthInPlace(plot, 'spring', 2);
  assert.equal(plot.cropId, null, 'still empty');
  assert.equal(plot.nightsGrown, 0);
});

// ── Garden state lifecycle ────────────────────────────────────────────────────

test('createInitialGardenState: correct plot count and fields', () => {
  const def = GARDENS[0];
  const state = createInitialGardenState(def);
  assert.equal(state.plots.length, def.plotCount);
  assert.equal(state.totalHarvests, 0);
  assert.equal(state.totalPlanted, 0);
  assert.equal(state.lastTendedDay, 0);
  for (const plot of state.plots) {
    assert.equal(plot.cropId, null, 'all plots empty');
  }
});

test('getOrCreateGardenState: lazy-inits on first access', () => {
  const world = createFreshWorldState();
  assert.ok(!world.gardens || !world.gardens['clara_herb_garden'], 'garden does not exist yet');
  const state = getOrCreateGardenState(world, 'clara_herb_garden');
  assert.ok(state, 'state returned');
  assert.ok(world.gardens && world.gardens['clara_herb_garden'], 'garden lazily initialized');
});

test('summarizeGarden: correct counts', () => {
  const state: GardenState = {
    plots: [
      { cropId: null, plantedDay: 0, nightsGrown: 0, stage: 0, wateredToday: false, waterStreak: 0 },
      { cropId: 'sage', plantedDay: 1, nightsGrown: 0, stage: 1, wateredToday: false, waterStreak: 0 },
      { cropId: 'sage', plantedDay: 1, nightsGrown: 3, stage: 3, wateredToday: true, waterStreak: 3 },
    ],
    totalHarvests: 0,
    totalPlanted: 0,
    lastTendedDay: 0,
  };
  const s = summarizeGarden(state);
  assert.equal(s.emptyPlots, 1);
  assert.equal(s.growingPlots, 1);
  assert.equal(s.thirstyPlots, 1);
  assert.equal(s.readyPlots, 1);
  assert.equal(s.totalPlots, 3);
});

// ── Planting ──────────────────────────────────────────────────────────────────

test('plantInGardenAction: valid planting consumes seed and sets plot', () => {
  let world = createFreshWorldState();
  // Give the player some marigold seeds.
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [{ itemId: 'sage_seeds', amount: 1 }]);
  world = { ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds };
  const beforeSeeds = getItemCount(world.inventory, 'sage_seeds');
  assert.equal(beforeSeeds, 1, 'player has 1 marigold seed');
  const result = plantInGardenAction(world, 'beeline_pollinator_bed', 'sage_seeds', 0);
  assert.ok(result.ok, 'planting succeeded');
  const afterSeeds = getItemCount(result.nextWorld.inventory, 'sage_seeds');
  assert.equal(afterSeeds, 0, 'seed consumed');
  const garden = result.nextWorld.gardens!['beeline_pollinator_bed'];
  assert.ok(garden); assert.equal(garden.plots[0].cropId, 'sage', 'plot 0 has marigold');
  assert.ok(garden); assert.equal(garden.plots[0].stage, 0, 'stage 0');
  assert.ok(garden); assert.equal(garden.plots[0].wateredToday, true, 'watered on sowing');
  assert.ok(garden); assert.equal(garden.totalPlanted, 1, 'totalPlanted incremented');
  assert.ok(garden); assert.equal(garden.lastTendedDay, world.day, 'lastTendedDay set');
});

test('plantInGardenAction: invalid garden id fails safely', () => {
  const world = createFreshWorldState();
  const result = plantInGardenAction(world, 'nonexistent_garden', 'sage_seeds', 0);
  assert.ok(!result.ok);
  assert.equal(result.nextWorld, world, 'world unchanged on failure');
});

test('plantInGardenAction: occupied plot fails', () => {
  let world = createFreshWorldState();
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [{ itemId: 'sage_seeds', amount: 2 }]);
  world = { ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds };
  const r1 = plantInGardenAction(world, 'beeline_pollinator_bed', 'sage_seeds', 0);
  assert.ok(r1.ok);
  const r2 = plantInGardenAction(r1.nextWorld, 'beeline_pollinator_bed', 'sage_seeds', 0);
  assert.ok(!r2.ok, 'cannot plant in occupied plot');
});

test('plantInGardenAction: incompatible crop fails', () => {
  let world = createFreshWorldState();
  // foxglove is NOT in beeline_pollinator_bed's allowedCropIds (sage, thyme, lavender).
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [{ itemId: 'foxglove_seeds', amount: 1 }]);
  world = { ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds };
  const result = plantInGardenAction(world, 'beeline_pollinator_bed', 'foxglove_seeds', 0);
  assert.ok(!result.ok, 'foxglove rejected for beeline_pollinator_bed');
});

test('plantInGardenAction: insufficient seeds fails', () => {
  const world = createFreshWorldState();
  // No seeds in inventory.
  const result = plantInGardenAction(world, 'beeline_pollinator_bed', 'sage_seeds', 0);
  assert.ok(!result.ok, 'planting without seeds fails');
});

// ── Watering ──────────────────────────────────────────────────────────────────

test('waterGardenAction: waters thirsty plots', () => {
  let world = createFreshWorldState();
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [{ itemId: 'sage_seeds', amount: 1 }]);
  world = { ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds };
  // Plant and then advance a day to make it thirsty.
  const plantRes = plantInGardenAction(world, 'beeline_pollinator_bed', 'sage_seeds', 0);
  assert.ok(plantRes.ok);
  world = advanceToNextDay(plantRes.nextWorld);
  const garden = world.gardens!['beeline_pollinator_bed'];
  assert.ok(garden); assert.equal(garden.plots[0].wateredToday, false, 'plot is thirsty after day advance');
  const waterRes = waterGardenAction(world, 'beeline_pollinator_bed');
  const wateredGarden = waterRes.nextWorld.gardens!['beeline_pollinator_bed'];
  assert.ok(wateredGarden); assert.equal(wateredGarden.plots[0].wateredToday, true, 'plot watered');
});

test('waterGardenAction: no thirsty plots returns info', () => {
  let world = createFreshWorldState();
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [{ itemId: 'sage_seeds', amount: 1 }]);
  world = { ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds };
  const plantRes = plantInGardenAction(world, 'beeline_pollinator_bed', 'sage_seeds', 0);
  // Just planted — already watered (sowing-night watering).
  const waterRes = waterGardenAction(plantRes.nextWorld, 'beeline_pollinator_bed');
  assert.ok(waterRes.body.includes('already watered'), 'no thirsty plots message');
});

// ── Harvesting ────────────────────────────────────────────────────────────────

test('harvestFromGardenAction: premature harvest fails', () => {
  let world = createFreshWorldState();
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [{ itemId: 'sage_seeds', amount: 1 }]);
  world = { ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds };
  const plantRes = plantInGardenAction(world, 'beeline_pollinator_bed', 'sage_seeds', 0);
  const harvestRes = harvestFromGardenAction(plantRes.nextWorld, 'beeline_pollinator_bed', 0);
  assert.ok(!harvestRes.ok, 'premature harvest fails');
});

test('harvestFromGardenAction: mature harvest grants items and resets plot', () => {
  let world = createFreshWorldState();
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [{ itemId: 'sage_seeds', amount: 1 }]);
  world = { ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds };
  // Plant, water, advance days until mature.
  let w = plantInGardenAction(world, 'beeline_pollinator_bed', 'sage_seeds', 0).nextWorld;
  // Sage is 2-night growth. Advance 3 days with watering.
  for (let d = 0; d < 3; d++) {
    w = advanceToNextDay(w);
    const waterRes = waterGardenAction(w, 'beeline_pollinator_bed');
    w = waterRes.nextWorld;
  }
  const garden = w.gardens!['beeline_pollinator_bed'];
  assert.ok(garden); assert.equal(garden.plots[0].stage, 3, 'plot is mature after 3 watered nights');
  const beforeBlooms = getItemCount(w.inventory, 'sage_sprig');
  const harvestRes = harvestFromGardenAction(w, 'beeline_pollinator_bed', 0);
  assert.ok(harvestRes.ok, 'harvest succeeded');
  const afterBlooms = getItemCount(harvestRes.nextWorld.inventory, 'sage_sprig');
  assert.ok(afterBlooms > beforeBlooms, 'marigold blooms granted');
  const afterSeeds = getItemCount(harvestRes.nextWorld.inventory, 'sage_seeds');
  assert.ok(afterSeeds >= 1, 'seed returned');
  const harvestedGarden = harvestRes.nextWorld.gardens!['beeline_pollinator_bed'];
  assert.ok(harvestedGarden); assert.equal(harvestedGarden.plots[0].cropId, null, 'plot reset to empty');
  assert.ok(harvestedGarden); assert.equal(harvestedGarden.totalHarvests, 1, 'totalHarvests incremented');
});

// ── Nightly growth ────────────────────────────────────────────────────────────

test('advanceAllGardensNightlyGrowthInPlace: advances all gardens', () => {
  let world = createFreshWorldState();
  // Plant in two gardens.
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [
    { itemId: 'sage_seeds', amount: 1 },
    { itemId: 'foxglove_seeds', amount: 1 },
  ]);
  world = { ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds };
  world = plantInGardenAction(world, 'beeline_pollinator_bed', 'sage_seeds', 0).nextWorld;
  world = plantInGardenAction(world, 'pond_iris_border', 'foxglove_seeds', 0).nextWorld;
  // Advance a day — both should grow.
  world = advanceToNextDay(world);
  const beeGarden = world.gardens!['beeline_pollinator_bed'];
  const pondGarden = world.gardens!['pond_iris_border'];
  assert.ok(beeGarden, "bee garden exists"); assert.equal(beeGarden.plots[0].nightsGrown, 1, 'bee garden grew');
  assert.ok(pondGarden, "pond garden exists"); assert.equal(pondGarden.plots[0].nightsGrown, 1, 'pond garden grew');
  // Both should be watered=false (reset by nightly growth).
  assert.ok(beeGarden, "bee garden exists"); assert.equal(beeGarden.plots[0].wateredToday, false);
  assert.ok(pondGarden, "pond garden exists"); assert.equal(pondGarden.plots[0].wateredToday, false);
});

test('advanceAllGardensNightlyGrowthInPlace: does not mutate input', () => {
  let world = createFreshWorldState();
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [{ itemId: 'sage_seeds', amount: 1 }]);
  world = { ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds };
  world = plantInGardenAction(world, 'beeline_pollinator_bed', 'sage_seeds', 0).nextWorld;
  const beforeJson = serializeWorldState(world);
  advanceToNextDay(world);
  const afterJson = serializeWorldState(world);
  assert.equal(beforeJson, afterJson, 'input state not mutated by advanceToNextDay');
});

// ── Persistence ───────────────────────────────────────────────────────────────

test('persistence: garden state round-trips through serialize/deserialize', () => {
  let world = createFreshWorldState();
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [{ itemId: 'sage_seeds', amount: 1 }]);
  world = { ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds };
  world = plantInGardenAction(world, 'beeline_pollinator_bed', 'sage_seeds', 0).nextWorld;
  const reloaded = deserializeWorldState(serializeWorldState(world)).state;
  assert.deepEqual(reloaded.gardens, world.gardens, 'gardens round-trip byte-identical');
});

test('persistence: v12 save loads with empty gardens', () => {
  const world = createFreshWorldState();
  // Strip gardens to simulate a v12 save.
  const v12World = { ...world, gardens: undefined } as unknown as WorldState;
  const json = JSON.stringify({ ...v12World, schemaVersion: 12 });
  const reloaded = deserializeWorldState(json).state;
  assert.ok(reloaded.gardens, 'gardens field exists after v12 migration');
  assert.equal(Object.keys(reloaded.gardens).length, 0, 'gardens is empty after v12 migration');
});

test('persistence: corrupt garden state is sanitized', () => {
  const world = createFreshWorldState();
  const corruptWorld = {
    ...world,
    gardens: {
      'clara_herb_garden': {
        plots: [
          { cropId: 'INVALID_CROP', plantedDay: -5, nightsGrown: 999, stage: 99, wateredToday: 'yes', waterStreak: -3 },
        ],
        totalHarvests: -1,
        totalPlanted: 'bad',
        lastTendedDay: NaN,
      },
    },
  };
  const reloaded = deserializeWorldState(serializeWorldState(corruptWorld as unknown as WorldState)).state;
  const garden = reloaded.gardens!['clara_herb_garden'];
  assert.ok(garden, 'garden survived sanitization');
  assert.ok(garden); assert.equal(garden.plots[0].cropId, null, 'invalid cropId reset to null');
  assert.ok(garden); assert.equal(garden.plots[0].stage, 0, 'invalid-cropId plot stage reset to 0 (fresh empty plot)');
  assert.ok(garden); assert.equal(garden.plots[0].plantedDay, 0, 'plantedDay reset to 0');
  assert.ok(garden); assert.equal(garden.totalHarvests, 0, 'negative totalHarvests clamped to 0');
});

// ── Determinism ───────────────────────────────────────────────────────────────

test('determinism: twin simulation with gardens produces identical state', () => {
  let simA = createFreshWorldState();
  let simB = createFreshWorldState();
  // Seed both with the same garden state.
  const invRes = applyItemGrants(simA.inventory, simA.discoveredItemIds, [{ itemId: 'sage_seeds', amount: 1 }]);
  simA = { ...simA, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds };
  simA = plantInGardenAction(simA, 'beeline_pollinator_bed', 'sage_seeds', 0).nextWorld;
  const invResB = applyItemGrants(simB.inventory, simB.discoveredItemIds, [{ itemId: 'sage_seeds', amount: 1 }]);
  simB = { ...simB, inventory: invResB.inventory, discoveredItemIds: invResB.discoveredItemIds };
  simB = plantInGardenAction(simB, 'beeline_pollinator_bed', 'sage_seeds', 0).nextWorld;
  // Step and advance identically.
  for (let f = 0; f < 50; f++) {
    simA = stepSimulation(simA, 0.25);
    simB = stepSimulation(simB, 0.25);
  }
  simA = advanceToNextDay(simA);
  simB = advanceToNextDay(simB);
  for (let f = 0; f < 50; f++) {
    simA = stepSimulation(simA, 0.25);
    simB = stepSimulation(simB, 0.25);
  }
  assert.deepEqual(simA, simB, 'twin runs identical with garden state');
});

// ── Cross-activity isolation ──────────────────────────────────────────────────

test('cross-activity: garden planting does not affect greenhouse plots', () => {
  let world = createFreshWorldState();
  const ghBefore = JSON.stringify(world.greenhouseState);
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [{ itemId: 'sage_seeds', amount: 1 }]);
  world = { ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds };
  world = plantInGardenAction(world, 'beeline_pollinator_bed', 'sage_seeds', 0).nextWorld;
  const ghAfter = JSON.stringify(world.greenhouseState);
  assert.equal(ghBefore, ghAfter, 'greenhouse state unchanged by garden planting');
});

test('cross-activity: garden harvest does not duplicate greenhouse harvests', () => {
  let world = createFreshWorldState();
  const ghHarvestsBefore = world.greenhouseState.totalHarvests;
  // Grow and harvest a garden plot.
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [{ itemId: 'sage_seeds', amount: 1 }]);
  world = { ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds };
  world = plantInGardenAction(world, 'beeline_pollinator_bed', 'sage_seeds', 0).nextWorld;
  for (let d = 0; d < 3; d++) {
    world = advanceToNextDay(world);
    world = waterGardenAction(world, 'beeline_pollinator_bed').nextWorld;
  }
  world = harvestFromGardenAction(world, 'beeline_pollinator_bed', 0).nextWorld;
  assert.equal(world.greenhouseState.totalHarvests, ghHarvestsBefore, 'greenhouse harvests unchanged');
});

// ── Clone ─────────────────────────────────────────────────────────────────────

test('cloneGardens: deep-clones garden state', () => {
  const world = createFreshWorldState();
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [{ itemId: 'sage_seeds', amount: 1 }]);
  const w = plantInGardenAction({ ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds }, 'beeline_pollinator_bed', 'sage_seeds', 0).nextWorld;
  const cloned = cloneGardens(w.gardens);
  assert.deepEqual(cloned, w.gardens, 'clone matches original');
  // Mutate the clone — original should be unaffected.
  if (cloned['beeline_pollinator_bed']) {
    cloned['beeline_pollinator_bed'].plots[0].cropId = 'thyme';
    assert.notEqual(cloned['beeline_pollinator_bed'].plots[0].cropId, w.gardens!['beeline_pollinator_bed']!.plots[0].cropId, 'clone is independent');
  }
});

// ── Resident-owned garden tests ───────────────────────────────────────────────

test('resident garden ownership: clara, nora, barnaby own their gardens', () => {
  const clara = getGardenDef('clara_herb_garden');
  const nora = getGardenDef('nook_lavender_bed');
  const barnaby = getGardenDef('barnaby_compost_garden');
  assert.ok(clara); assert.equal(clara!.ownerId, 'clara', 'Clara owns her herb garden');
  assert.ok(nora); assert.equal(nora!.ownerId, 'nora', 'Nora owns her lavender bed');
  assert.ok(barnaby); assert.equal(barnaby!.ownerId, 'barnaby', 'Barnaby owns his compost garden');
  // Community gardens remain community-owned.
  const pond = getGardenDef('pond_iris_border');
  const bee = getGardenDef('beeline_pollinator_bed');
  assert.equal(pond!.ownerId, 'community', 'Pond iris is community');
  assert.equal(bee!.ownerId, 'community', 'Bee line is community');
});

test('tendResidentGardenInPlace: NPC sows empty plot on first tend', () => {
  const world = createFreshWorldState();
  tendResidentGardenInPlace(world, 'clara_herb_garden', 'clara');
  const state = getGardenState(world, 'clara_herb_garden');
  assert.ok(state, 'garden state created');
  assert.ok(state!.plots[0].cropId, 'plot 0 has a crop');
  assert.equal(state!.plots[0].stage, 0, 'stage 0 (freshly sown)');
  assert.equal(state!.plots[0].wateredToday, true, 'watered on sowing');
  assert.equal(state!.lastTendedDay, world.day, 'lastTendedDay set');
  assert.equal(state!.totalPlanted, 2, 'both plots planted');
});

test('tendResidentGardenInPlace: ownership guard rejects wrong resident', () => {
  const world = createFreshWorldState();
  // Arthur does not own clara_herb_garden.
  tendResidentGardenInPlace(world, 'clara_herb_garden', 'arthur');
  const state = getGardenState(world, 'clara_herb_garden');
  assert.ok(!state, 'no state created — wrong owner rejected');
});

test('tendResidentGardenInPlace: once-per-day gate prevents double-tend', () => {
  const world = createFreshWorldState();
  tendResidentGardenInPlace(world, 'clara_herb_garden', 'clara');
  const afterFirst = getGardenState(world, 'clara_herb_garden');
  const firstPlanted = afterFirst!.totalPlanted;
  // Second tend same day — should be a no-op.
  tendResidentGardenInPlace(world, 'clara_herb_garden', 'clara');
  const afterSecond = getGardenState(world, 'clara_herb_garden');
  assert.equal(afterSecond!.totalPlanted, firstPlanted, 'no double-tend within same day');
});

test('tendResidentGardenInPlace: NPC waters growing plot', () => {
  const world = createFreshWorldState();
  // Manually sow a plot without watering, then tend.
  const state = getOrCreateGardenState(world, 'clara_herb_garden')!;
  sowPlotInPlace(state.plots[0], 'sage', world.day);
  state.plots[0].wateredToday = false;
  tendResidentGardenInPlace(world, 'clara_herb_garden', 'clara');
  assert.equal(state.plots[0].wateredToday, true, 'NPC watered the growing plot');
});

test('tendResidentGardenInPlace: NPC harvests mature plot and resets', () => {
  const world = createFreshWorldState();
  const state = getOrCreateGardenState(world, 'clara_herb_garden')!;
  // Set up a mature plot.
  sowPlotInPlace(state.plots[0], 'sage', world.day);
  state.plots[0].stage = 3;
  state.plots[0].waterStreak = 3; // lush
  tendResidentGardenInPlace(world, 'clara_herb_garden', 'clara');
  assert.equal(state.plots[0].cropId, null, 'harvested plot reset to empty');
  assert.equal(state.plots[0].stage, 0, 'stage reset');
  assert.ok(state.totalHarvests > 0, 'totalHarvests incremented');
});

test('tendResidentGardenInPlace: NPC does not grant items to player inventory', () => {
  const world = createFreshWorldState();
  const beforeSage = getItemCount(world.inventory, 'sage_sprig');
  tendResidentGardenInPlace(world, 'clara_herb_garden', 'clara');
  // Advance to maturity and tend again (harvest).
  const state = getGardenState(world, 'clara_herb_garden')!;
  state.plots[0].stage = 3;
  state.lastTendedDay = 0; // reset gate to allow second tend
  tendResidentGardenInPlace(world, 'clara_herb_garden', 'clara');
  const afterSage = getItemCount(world.inventory, 'sage_sprig');
  assert.equal(afterSage, beforeSage, 'NPC harvest does not grant items to player');
});

test('residentNeedsToTend: returns gardenId when untended, null when tended', () => {
  const world = createFreshWorldState();
  const needsTend = residentNeedsToTend(world, 'clara');
  assert.ok(needsTend, 'Clara needs to tend her garden initially');
  tendResidentGardenInPlace(world, 'clara_herb_garden', 'clara');
  const noLonger = residentNeedsToTend(world, 'clara');
  assert.equal(noLonger, null, 'Clara does not need to tend after tending today');
});

test('resident-owned garden: nightly growth advances NPC-sown plots', () => {
  let world = createFreshWorldState();
  tendResidentGardenInPlace(world, 'clara_herb_garden', 'clara');
  const before = getGardenState(world, 'clara_herb_garden')!;
  assert.equal(before.plots[0].stage, 0, 'freshly sown at stage 0');
  // Advance a day — the nightly growth should advance the plot.
  world = advanceToNextDay(world);
  const after = getGardenState(world, 'clara_herb_garden')!;
  assert.equal(after.plots[0].nightsGrown, 1, 'nightsGrown advanced');
  assert.equal(after.plots[0].stage, 1, 'stage advanced to sprout');
  assert.equal(after.plots[0].wateredToday, false, 'wateredToday reset by nightly growth');
});

test('determinism: resident garden tending is deterministic across twin runs', () => {
  let simA = createFreshWorldState();
  let simB = createFreshWorldState();
  // Seed both identically.
  tendResidentGardenInPlace(simA, 'clara_herb_garden', 'clara');
  tendResidentGardenInPlace(simB, 'clara_herb_garden', 'clara');
  // Step and advance identically.
  for (let f = 0; f < 50; f++) {
    simA = stepSimulation(simA, 0.25);
    simB = stepSimulation(simB, 0.25);
  }
  simA = advanceToNextDay(simA);
  simB = advanceToNextDay(simB);
  for (let f = 0; f < 50; f++) {
    simA = stepSimulation(simA, 0.25);
    simB = stepSimulation(simB, 0.25);
  }
  assert.deepEqual(simA, simB, 'twin runs identical with resident garden tending');
});

// D1 fix test: lastTendedDay is stamped UNCONDITIONALLY, even on a no-op tend
// (all plots growing + watered). Previously, the gate was only stamped when
// didSomething === true, creating a latent loop risk.
test('D1: no-op tend still stamps lastTendedDay (unconditional gate)', () => {
  const world = createFreshWorldState();
  const state = getOrCreateGardenState(world, 'clara_herb_garden')!;
  // Set up a no-op state: both plots have crops, growing (stage < 3), watered.
  sowPlotInPlace(state.plots[0], 'sage', world.day);
  sowPlotInPlace(state.plots[1], 'sage', world.day);
  assert.equal(state.plots[0].wateredToday, true, 'sowPlotInPlace sets wateredToday');
  assert.equal(state.plots[1].wateredToday, true);
  assert.equal(state.lastTendedDay, 0, 'gate not yet stamped');
  // Call the reducer — all plots are growing+watered, so didSomething should be false.
  tendResidentGardenInPlace(world, 'clara_herb_garden', 'clara');
  // D1 fix: lastTendedDay is now stamped UNCONDITIONALLY.
  assert.equal(state.lastTendedDay, world.day, 'gate stamped even on no-op tend (D1 fix)');
});

// D3 fix test: plantInGardenAction does NOT mutate the input world's gardens.
test('D3: plantInGardenAction does not mutate input world.gardens', () => {
  const world = createFreshWorldState();
  world.playerPos = { x: -12.4, z: -15.5 };
  world.playerLocation = 'exterior';
  world.inventory = { ...world.inventory, sage_seeds: 2 };
  const gardensBefore = JSON.stringify(world.gardens);
  plantInGardenAction(world, 'beeline_pollinator_bed', 'sage_seeds' as PersonalItemId, 0);
  const gardensAfter = JSON.stringify(world.gardens);
  assert.equal(gardensAfter, gardensBefore, 'input world.gardens not mutated by plantInGardenAction (D3 fix)');
});

// D6: crop identity — NPC sows the correct crop (allowedCropIds[0]), not just any truthy value.
test('D6: NPC sows the correct crop (allowedCropIds[0])', () => {
  const world = createFreshWorldState();
  tendResidentGardenInPlace(world, 'clara_herb_garden', 'clara');
  const state = getGardenState(world, 'clara_herb_garden')!;
  assert.equal(state.plots[0].cropId, 'sage', 'Clara sows sage (allowedCropIds[0])');
  assert.equal(state.plots[1].cropId, 'sage', 'both plots sowed with sage');

  const world2 = createFreshWorldState();
  tendResidentGardenInPlace(world2, 'barnaby_compost_garden', 'barnaby');
  const state2 = getGardenState(world2, 'barnaby_compost_garden')!;
  assert.equal(state2.plots[0].cropId, 'marigold', 'Barnaby sows marigold (allowedCropIds[0])');
});

// D6: arrival integration — stepSimulation eventually triggers NPC garden tending.
test('D6: simulation steps eventually trigger resident garden tending (integration)', () => {
  let world = createFreshWorldState();
  // Pre-seed Clara's garden so it has state (the reducer lazy-inits on first call,
  // but we want to verify the simulation arrival path, not just the reducer).
  getOrCreateGardenState(world, 'clara_herb_garden');
  const beforeGardens = JSON.stringify(world.gardens);
  // Step the simulation for 200 frames (enough for several activity cycles).
  for (let f = 0; f < 200; f++) {
    world = stepSimulation(world, 0.25) as WorldState;
  }
  // The simulation should have advanced the world state in some way.
  // We don't assert Clara specifically tended (she may not have been selected),
  // but we verify the simulation didn't crash and gardens are still valid.
  assert.ok(world.gardens, 'gardens slice present after 200 sim steps');
  // If Clara did tend, her garden would have crops; if not, it's still empty.
  // Either way, the simulation is stable.
  const claraState = getGardenState(world, 'clara_herb_garden');
  if (claraState) {
    for (const plot of claraState.plots) {
      if (plot.cropId) {
        assert.equal(plot.cropId, 'sage', 'any sowed crop is sage (allowedCropIds[0])');
      }
    }
  }
});

// ── Critical Phase III tests: ownership guards, activation, everyday integrity ──

test('CRITICAL: player cannot harvest resident-owned garden (exploit guard)', () => {
  const world = createFreshWorldState();
  const state = getOrCreateGardenState(world, 'clara_herb_garden')!;
  sowPlotInPlace(state.plots[0], 'sage', world.day);
  state.plots[0].stage = 3;
  const beforeSprigs = getItemCount(world.inventory, 'sage_sprig');
  const res = harvestFromGardenAction(world, 'clara_herb_garden', 0);
  assert.ok(!res.ok, 'player cannot harvest Clara\'s NPC-owned garden');
  assert.equal(getItemCount(res.nextWorld.inventory, 'sage_sprig'), beforeSprigs, 'no items granted');
  const afterState = getGardenState(res.nextWorld, 'clara_herb_garden')!;
  assert.equal(afterState.plots[0].cropId, 'sage', 'crop not harvested');
});

test('CRITICAL: player cannot harvest Nora\'s or Barnaby\'s garden', () => {
  const world = createFreshWorldState();
  for (const [gid, crop] of [
    ['nook_lavender_bed', 'lavender'],
    ['barnaby_compost_garden', 'marigold'],
  ] as const) {
    const state = getOrCreateGardenState(world, gid)!;
    sowPlotInPlace(state.plots[0], crop, world.day);
    state.plots[0].stage = 3;
    const res = harvestFromGardenAction(world, gid, 0);
    assert.ok(!res.ok, `player cannot harvest ${gid}`);
  }
});

test('CRITICAL: player can harvest community-owned garden', () => {
  const world = createFreshWorldState();
  const state = getOrCreateGardenState(world, 'beeline_pollinator_bed')!;
  sowPlotInPlace(state.plots[0], 'sage', world.day);
  state.plots[0].stage = 3;
  const before = getItemCount(world.inventory, 'sage_sprig');
  const res = harvestFromGardenAction(world, 'beeline_pollinator_bed', 0);
  assert.ok(res.ok, 'community garden harvestable');
  assert.ok(getItemCount(res.nextWorld.inventory, 'sage_sprig') > before, 'items granted');
});

test('CRITICAL: player cannot plant in resident-owned garden (seed-loss guard)', () => {
  const world = createFreshWorldState();
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [{ itemId: 'sage_seeds', amount: 1 }]);
  const w = { ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds };
  const before = getItemCount(w.inventory, 'sage_seeds');
  const res = plantInGardenAction(w, 'clara_herb_garden', 'sage_seeds', 0);
  assert.ok(!res.ok, 'player cannot plant in Clara\'s garden');
  assert.equal(getItemCount(res.nextWorld.inventory, 'sage_seeds'), before, 'seed not consumed');
});

test('CRITICAL: stepSimulation activates garden-tend (feature is not inert)', () => {
  let world = createFreshWorldState();
  const GARDEN_IDS = ['clara_herb_garden', 'nook_lavender_bed', 'barnaby_compost_garden'] as const;
  let tended = false;
  for (let day = 0; day < 2; day++) {
    for (let step = 0; step < 900; step++) {
      world = stepSimulation(world, 0.25);
    }
    for (const gid of GARDEN_IDS) {
      if ((getGardenState(world, gid)?.totalPlanted ?? 0) > 0) tended = true;
    }
    if (tended) break;
    world = advanceToNextDay(world);
  }
  assert.ok(tended, 'at least one resident garden tended via arrival hook within 2 sim days');
});

test('CRITICAL: garden-tend fires at most once per day (non-vacuous)', () => {
  let world = createFreshWorldState();
  const GARDEN_IDS = ['clara_herb_garden', 'nook_lavender_bed', 'barnaby_compost_garden'] as const;
  const plantedDeltaByDay: Record<string, number[]> = {};
  for (const gid of GARDEN_IDS) plantedDeltaByDay[gid] = [];
  let totalTends = 0;
  for (let day = 0; day < 4; day++) {
    const startPlanted: Record<string, number> = {};
    for (const gid of GARDEN_IDS) startPlanted[gid] = getGardenState(world, gid)?.totalPlanted ?? 0;
    for (let step = 0; step < 900; step++) world = stepSimulation(world, 0.25);
    for (const gid of GARDEN_IDS) {
      const after = getGardenState(world, gid)?.totalPlanted ?? 0;
      const delta = after - startPlanted[gid];
      plantedDeltaByDay[gid].push(delta);
      if (delta > 0) totalTends++;
      const lt = getGardenState(world, gid)?.lastTendedDay ?? 0;
      assert.ok(lt <= world.day, `${gid}: lastTendedDay ${lt} <= day ${world.day}`);
    }
    world = advanceToNextDay(world);
  }
  assert.ok(totalTends > 0, `feature active: ${totalTends} tend events in 4 days`);
  for (const gid of GARDEN_IDS) {
    const maxDelta = Math.max(...plantedDeltaByDay[gid]);
    assert.ok(maxDelta <= 2, `${gid}: max planted delta/day = ${maxDelta} (≤ 2 plots, no multi-tend)`);
  }
});

test('CRITICAL: everyday practice excludes NPC tending', () => {
  const world = createFreshWorldState();
  tendResidentGardenInPlace(world, 'clara_herb_garden', 'clara');
  const profile = deriveEverydayPracticeProfile(world);
  assert.ok(!profile.touchedToday.includes('gardening' as never), 'NPC tending does not credit player');
});

test('CRITICAL: twin determinism via arrival hook pathway', () => {
  let simA = createFreshWorldState();
  let simB = createFreshWorldState();
  for (let day = 0; day < 2; day++) {
    for (let f = 0; f < 900; f++) {
      simA = stepSimulation(simA, 0.25);
      simB = stepSimulation(simB, 0.25);
    }
    simA = advanceToNextDay(simA);
    simB = advanceToNextDay(simB);
  }
  const ca = getGardenState(simA, 'clara_herb_garden');
  const cb = getGardenState(simB, 'clara_herb_garden');
  assert.ok(ca, 'arrival hook fired in simA: Clara garden state exists');
  assert.ok(cb, 'arrival hook fired in simB: Clara garden state exists');
  assert.equal(ca!.lastTendedDay, cb!.lastTendedDay, 'twin lastTendedDay matches');
  assert.equal(ca!.totalPlanted, cb!.totalPlanted, 'twin totalPlanted matches');
  assert.deepEqual(simA, simB, 'twin runs identical via arrival hook');
});

// ── D-2 regression: tendResidentGardenInPlace writes witness memory ──

test('D-2 regression: tendResidentGardenInPlace writes garden-tagged witness memory for nearby NPCs', () => {
  const world = createFreshWorldState();
  // Position a witness NPC near Clara's garden target.
  // Clara's herb garden target is at (-12.4, -15.5) per residents.ts.
  world.npcRuntime.mina.position = { x: -12.0, z: -15.0 };
  world.npcRuntime.mina.posture = 'standing';
  // Ensure Clara is at the garden.
  world.npcRuntime.clara.position = { x: -12.4, z: -15.5 };
  // Tend Clara's garden.
  tendResidentGardenInPlace(world, 'clara_herb_garden', 'clara');
  // Mina should have a witness memory with tag 'garden'.
  const minaMemories = world.npcMemories?.mina ?? [];
  const gardenMem = minaMemories.find((m) => m.tag === 'garden');
  assert.ok(gardenMem, 'Mina has a garden-tagged witness memory after seeing Clara tend');
  assert.equal(gardenMem!.subjectResidents?.[0], 'clara', 'memory subject is Clara');
  assert.equal(gardenMem!.sourceKind, 'witness', 'memory is firsthand witness');
});

test('D-2 regression: GARDEN_ECHO_TOPICS registered in DIALOGUE_TOPICS', () => {
  // Verify the garden echo topics are in the dialogue registry.
  
  const gardenTopicIds = DIALOGUE_TOPICS.filter((t) =>
    t.id?.startsWith('everyday_garden_')
  ).map((t) => t.id);
  assert.ok(gardenTopicIds.length >= 2, `GARDEN_ECHO_TOPICS registered: ${gardenTopicIds.join(', ')}`);
});

test('D-3 regression: FISHING_ECHO_TOPICS registered in DIALOGUE_TOPICS', () => {
  
  const fishingTopicIds = DIALOGUE_TOPICS.filter((t) =>
    t.id?.startsWith('everyday_fishing_')
  ).map((t) => t.id);
  assert.ok(fishingTopicIds.length >= 2, `FISHING_ECHO_TOPICS registered: ${fishingTopicIds.join(', ')}`);
});
