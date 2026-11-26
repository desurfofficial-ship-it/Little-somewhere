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
  createInitialGardenState,
  summarizeGarden,
  cloneGardens,
  sowPlotInPlace,
  waterPlotInPlace,
  harvestPlotInPlace,
  advancePlotNightlyGrowthInPlace,
  advanceAllGardensNightlyGrowthInPlace,
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
  const result = plantInGardenAction(world, 'clara_herb_garden', 'sage_seeds', 0);
  assert.ok(result.ok, 'planting succeeded');
  const afterSeeds = getItemCount(result.nextWorld.inventory, 'sage_seeds');
  assert.equal(afterSeeds, 0, 'seed consumed');
  const garden = result.nextWorld.gardens!['clara_herb_garden'];
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
  const r1 = plantInGardenAction(world, 'clara_herb_garden', 'sage_seeds', 0);
  assert.ok(r1.ok);
  const r2 = plantInGardenAction(r1.nextWorld, 'clara_herb_garden', 'sage_seeds', 0);
  assert.ok(!r2.ok, 'cannot plant in occupied plot');
});

test('plantInGardenAction: incompatible crop fails', () => {
  let world = createFreshWorldState();
  // foxglove is NOT in clara_herb_garden's allowedCropIds (sage, thyme, lavender).
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [{ itemId: 'foxglove_seeds', amount: 1 }]);
  world = { ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds };
  const result = plantInGardenAction(world, 'clara_herb_garden', 'foxglove_seeds', 0);
  assert.ok(!result.ok, 'foxglove rejected for clara_herb_garden');
});

test('plantInGardenAction: insufficient seeds fails', () => {
  const world = createFreshWorldState();
  // No seeds in inventory.
  const result = plantInGardenAction(world, 'clara_herb_garden', 'sage_seeds', 0);
  assert.ok(!result.ok, 'planting without seeds fails');
});

// ── Watering ──────────────────────────────────────────────────────────────────

test('waterGardenAction: waters thirsty plots', () => {
  let world = createFreshWorldState();
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [{ itemId: 'sage_seeds', amount: 1 }]);
  world = { ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds };
  // Plant and then advance a day to make it thirsty.
  const plantRes = plantInGardenAction(world, 'clara_herb_garden', 'sage_seeds', 0);
  assert.ok(plantRes.ok);
  world = advanceToNextDay(plantRes.nextWorld);
  const garden = world.gardens!['clara_herb_garden'];
  assert.ok(garden); assert.equal(garden.plots[0].wateredToday, false, 'plot is thirsty after day advance');
  const waterRes = waterGardenAction(world, 'clara_herb_garden');
  const wateredGarden = waterRes.nextWorld.gardens!['clara_herb_garden'];
  assert.ok(wateredGarden); assert.equal(wateredGarden.plots[0].wateredToday, true, 'plot watered');
});

test('waterGardenAction: no thirsty plots returns info', () => {
  let world = createFreshWorldState();
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [{ itemId: 'sage_seeds', amount: 1 }]);
  world = { ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds };
  const plantRes = plantInGardenAction(world, 'clara_herb_garden', 'sage_seeds', 0);
  // Just planted — already watered (sowing-night watering).
  const waterRes = waterGardenAction(plantRes.nextWorld, 'clara_herb_garden');
  assert.ok(waterRes.body.includes('already watered'), 'no thirsty plots message');
});

// ── Harvesting ────────────────────────────────────────────────────────────────

test('harvestFromGardenAction: premature harvest fails', () => {
  let world = createFreshWorldState();
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [{ itemId: 'sage_seeds', amount: 1 }]);
  world = { ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds };
  const plantRes = plantInGardenAction(world, 'clara_herb_garden', 'sage_seeds', 0);
  const harvestRes = harvestFromGardenAction(plantRes.nextWorld, 'clara_herb_garden', 0);
  assert.ok(!harvestRes.ok, 'premature harvest fails');
});

test('harvestFromGardenAction: mature harvest grants items and resets plot', () => {
  let world = createFreshWorldState();
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [{ itemId: 'sage_seeds', amount: 1 }]);
  world = { ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds };
  // Plant, water, advance days until mature.
  let w = plantInGardenAction(world, 'clara_herb_garden', 'sage_seeds', 0).nextWorld;
  // Sage is 2-night growth. Advance 3 days with watering.
  for (let d = 0; d < 3; d++) {
    w = advanceToNextDay(w);
    const waterRes = waterGardenAction(w, 'clara_herb_garden');
    w = waterRes.nextWorld;
  }
  const garden = w.gardens!['clara_herb_garden'];
  assert.ok(garden); assert.equal(garden.plots[0].stage, 3, 'plot is mature after 3 watered nights');
  const beforeBlooms = getItemCount(w.inventory, 'sage_sprig');
  const harvestRes = harvestFromGardenAction(w, 'clara_herb_garden', 0);
  assert.ok(harvestRes.ok, 'harvest succeeded');
  const afterBlooms = getItemCount(harvestRes.nextWorld.inventory, 'sage_sprig');
  assert.ok(afterBlooms > beforeBlooms, 'marigold blooms granted');
  const afterSeeds = getItemCount(harvestRes.nextWorld.inventory, 'sage_seeds');
  assert.ok(afterSeeds >= 1, 'seed returned');
  const harvestedGarden = harvestRes.nextWorld.gardens!['clara_herb_garden'];
  assert.ok(harvestedGarden); assert.equal(harvestedGarden.plots[0].cropId, null, 'plot reset to empty');
  assert.ok(harvestedGarden); assert.equal(harvestedGarden.totalHarvests, 1, 'totalHarvests incremented');
});

// ── Nightly growth ────────────────────────────────────────────────────────────

test('advanceAllGardensNightlyGrowthInPlace: advances all gardens', () => {
  let world = createFreshWorldState();
  // Plant in two gardens.
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [
    { itemId: 'sage_seeds', amount: 1 },
    { itemId: 'lavender_seeds', amount: 1 },
  ]);
  world = { ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds };
  world = plantInGardenAction(world, 'clara_herb_garden', 'sage_seeds', 0).nextWorld;
  world = plantInGardenAction(world, 'nook_lavender_bed', 'lavender_seeds', 0).nextWorld;
  // Advance a day — both should grow.
  world = advanceToNextDay(world);
  const claraGarden = world.gardens!['clara_herb_garden'];
  const nookGarden = world.gardens!['nook_lavender_bed'];
  assert.ok(claraGarden, "clara garden exists"); assert.equal(claraGarden.plots[0].nightsGrown, 1, 'clara garden grew');
  assert.ok(nookGarden, "nook garden exists"); assert.equal(nookGarden.plots[0].nightsGrown, 1, 'nook garden grew');
  // Both should be watered=false (reset by nightly growth).
  assert.ok(claraGarden, "clara garden exists"); assert.equal(claraGarden.plots[0].wateredToday, false);
  assert.ok(nookGarden, "nook garden exists"); assert.equal(nookGarden.plots[0].wateredToday, false);
});

test('advanceAllGardensNightlyGrowthInPlace: does not mutate input', () => {
  let world = createFreshWorldState();
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [{ itemId: 'sage_seeds', amount: 1 }]);
  world = { ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds };
  world = plantInGardenAction(world, 'clara_herb_garden', 'sage_seeds', 0).nextWorld;
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
  world = plantInGardenAction(world, 'clara_herb_garden', 'sage_seeds', 0).nextWorld;
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
  simA = plantInGardenAction(simA, 'clara_herb_garden', 'sage_seeds', 0).nextWorld;
  const invResB = applyItemGrants(simB.inventory, simB.discoveredItemIds, [{ itemId: 'sage_seeds', amount: 1 }]);
  simB = { ...simB, inventory: invResB.inventory, discoveredItemIds: invResB.discoveredItemIds };
  simB = plantInGardenAction(simB, 'clara_herb_garden', 'sage_seeds', 0).nextWorld;
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
  world = plantInGardenAction(world, 'clara_herb_garden', 'sage_seeds', 0).nextWorld;
  const ghAfter = JSON.stringify(world.greenhouseState);
  assert.equal(ghBefore, ghAfter, 'greenhouse state unchanged by garden planting');
});

test('cross-activity: garden harvest does not duplicate greenhouse harvests', () => {
  let world = createFreshWorldState();
  const ghHarvestsBefore = world.greenhouseState.totalHarvests;
  // Grow and harvest a garden plot.
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [{ itemId: 'sage_seeds', amount: 1 }]);
  world = { ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds };
  world = plantInGardenAction(world, 'clara_herb_garden', 'sage_seeds', 0).nextWorld;
  for (let d = 0; d < 3; d++) {
    world = advanceToNextDay(world);
    world = waterGardenAction(world, 'clara_herb_garden').nextWorld;
  }
  world = harvestFromGardenAction(world, 'clara_herb_garden', 0).nextWorld;
  assert.equal(world.greenhouseState.totalHarvests, ghHarvestsBefore, 'greenhouse harvests unchanged');
});

// ── Clone ─────────────────────────────────────────────────────────────────────

test('cloneGardens: deep-clones garden state', () => {
  const world = createFreshWorldState();
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [{ itemId: 'sage_seeds', amount: 1 }]);
  const w = plantInGardenAction({ ...world, inventory: invRes.inventory, discoveredItemIds: invRes.discoveredItemIds }, 'clara_herb_garden', 'sage_seeds', 0).nextWorld;
  const cloned = cloneGardens(w.gardens);
  assert.deepEqual(cloned, w.gardens, 'clone matches original');
  // Mutate the clone — original should be unaffected.
  if (cloned['clara_herb_garden']) {
    cloned['clara_herb_garden'].plots[0].cropId = 'thyme';
    assert.notEqual(cloned['clara_herb_garden'].plots[0].cropId, w.gardens!['clara_herb_garden']!.plots[0].cropId, 'clone is independent');
  }
});
