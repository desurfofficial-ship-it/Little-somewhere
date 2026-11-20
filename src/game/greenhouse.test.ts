import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GREENHOUSE_HARVEST_MINUTES,
  GREENHOUSE_NOTE_READ_MINUTES,
  GREENHOUSE_PLANT_MINUTES,
  GREENHOUSE_PLOT_COUNT,
  GREENHOUSE_DOOR_SPAWN,
  GREENHOUSE_INTERACTABLES,
  GREENHOUSE_INTERIOR_OBSTACLES,
  GREENHOUSE_PLOT_SHELF_Z,
  GREENHOUSE_WATER_MINUTES,
  advanceGreenhouseNightlyGrowthInPlace,
  computeGreenhouseWaypoints,
  createInitialGreenhousePlot,
  createInitialGreenhouseState,
  describeGreenhouseStage,
  getGreenhouseCrop,
  getGreenhouseCropBySeed,
  isGreenhouseInteriorWalkable,
  resolveGreenhouseInteriorMovement,
  selectBestGreenhouseTarget,
  stageForNights,
  summarizeGreenhousePlots,
} from './greenhouse';
import {
  enterGreenhouseAction,
  exitGreenhouseAction,
  harvestPlotAction,
  interactWithGreenhouseProp,
  interactWithProp,
  plantSeedAtPlotAction,
  readGreenhouseNotesAction,
  waterGreenhousePlotsAction,
} from './actions';
import { getItemCount } from './inventory';
import { computeWorldSaveRevision, advanceToNextDay, createFreshWorldState, serializeWorldState } from './storage';
import { CURRENT_SCHEMA_VERSION, migrateWorldState } from './migrations';
import { GreenhousePlotState, WorldState } from './types';

function freshInsideGreenhouse(): WorldState {
  const world = createFreshWorldState();
  return {
    ...world,
    playerLocation: 'greenhouse_interior',
    playerPos: { ...GREENHOUSE_DOOR_SPAWN },
  };
}

function worldWithSeed(seed: 'chamomile_seeds' | 'lavender_seeds' | 'thyme_seeds'): WorldState {
  const world = freshInsideGreenhouse();
  return {
    ...world,
    inventory: { ...world.inventory, [seed]: 2 },
    discoveredItemIds: [...(world.discoveredItemIds ?? []), seed],
  };
}

test('greenhouse interior walkability, obstacle bounds, spawns, and interactable stand spots are valid', () => {
  assert.equal(isGreenhouseInteriorWalkable(GREENHOUSE_DOOR_SPAWN.x, GREENHOUSE_DOOR_SPAWN.z, 0.42), true);

  for (const obs of GREENHOUSE_INTERIOR_OBSTACLES) {
    const cx = (obs.minX + obs.maxX) * 0.5;
    const cz = (obs.minZ + obs.maxZ) * 0.5;
    assert.equal(
      isGreenhouseInteriorWalkable(cx, cz, 0.42),
      false,
      `Furniture obstacle center ${obs.id} should block walking`,
    );
  }

  for (const prop of GREENHOUSE_INTERACTABLES) {
    assert.equal(
      isGreenhouseInteriorWalkable(prop.x, prop.z, 0.42),
      true,
      `Stand spot for ${prop.id} at (${prop.x}, ${prop.z}) must be walkable`,
    );
    const targetWorld = {
      ...freshInsideGreenhouse(),
      playerPos: { x: prop.x, z: prop.z },
      playerFacing: Math.atan2(prop.focusX - prop.x, prop.focusZ - prop.z),
    };
    const best = selectBestGreenhouseTarget(targetWorld);
    assert.ok(best && best.greenhousePropId === prop.id, `Should select ${prop.id} at its stand spot`);
    assert.equal(best.kind, 'greenhouse_prop');
  }

  // Movement clamping resolves sliding along interior furniture without escaping room bounds
  const blocked = resolveGreenhouseInteriorMovement({ x: 0, z: 0 }, { x: 0, z: 2.4 }, 0.42);
  assert.ok(isGreenhouseInteriorWalkable(blocked.x, blocked.z, 0.42));
});

test('greenhouse hub waypoints route from the door to every station and never leave the room', () => {
  // Stations derive from the registry stand spots so future layout moves cannot desync
  const stations = GREENHOUSE_INTERACTABLES.filter((p) => p.id !== 'greenhouse_door').map((p) => ({
    x: p.x,
    z: p.z,
  }));
  for (const station of stations) {
    const path = computeGreenhouseWaypoints(GREENHOUSE_DOOR_SPAWN, station, 0.42);
    assert.ok(path.length >= 1);
    for (const wp of path) {
      assert.ok(
        isGreenhouseInteriorWalkable(wp.x, wp.z, 0.42),
        `Waypoint (${wp.x}, ${wp.z}) must be interior-walkable`,
      );
    }
    const last = path[path.length - 1];
    assert.ok(Math.hypot(last.x - station.x, last.z - station.z) < 0.2, 'Path should end near the station');
  }
});

test('stageForNights and nightly growth advance watered pots, stall unwatered ones, and rest through winter', () => {
  assert.equal(stageForNights(0, 2), 0);
  assert.equal(stageForNights(1, 2), 1);
  assert.equal(stageForNights(2, 2), 3);
  assert.equal(stageForNights(3, 3), 3);
  assert.equal(stageForNights(2, 3), 2);
  assert.equal(stageForNights(9, 3), 3);

  // Watered thyme pot advances one stage per night until ready
  const state = createInitialGreenhouseState();
  state.plots[0] = { cropId: 'thyme', plantedDay: 1, nightsGrown: 0, stage: 0, wateredToday: true };
  advanceGreenhouseNightlyGrowthInPlace(state, 'spring');
  assert.equal(state.plots[0].stage, 1);
  assert.equal(state.plots[0].nightsGrown, 1);
  assert.equal(state.plots[0].wateredToday, false, 'Watering resets each night');

  state.plots[0].wateredToday = true;
  advanceGreenhouseNightlyGrowthInPlace(state, 'summer');
  assert.equal(state.plots[0].stage, 2);
  state.plots[0].wateredToday = true;
  advanceGreenhouseNightlyGrowthInPlace(state, 'autumn');
  assert.equal(state.plots[0].stage, 3, 'Ready after three watered nights');

  // Ready pots keep their stage; unwatered pots stall but never wither
  state.plots[0].wateredToday = true;
  advanceGreenhouseNightlyGrowthInPlace(state, 'spring');
  assert.equal(state.plots[0].stage, 3);
  assert.equal(state.plots[0].nightsGrown, 3);

  state.plots[1] = { cropId: 'chamomile', plantedDay: 1, nightsGrown: 0, stage: 0, wateredToday: false };
  advanceGreenhouseNightlyGrowthInPlace(state, 'spring');
  assert.equal(state.plots[1].stage, 0, 'Unwatered pot waits without dying');

  // Winter dormancy freezes growth for watered pots
  state.plots[2] = { cropId: 'lavender', plantedDay: 2, nightsGrown: 0, stage: 0, wateredToday: true };
  advanceGreenhouseNightlyGrowthInPlace(state, 'winter');
  assert.equal(state.plots[2].stage, 0, 'Winter freezes all growth');
  assert.equal(state.plots[2].wateredToday, false);
});

test('Mina\'s planting notes grant the starter seed packet exactly once and unlock the shared-corner memory', () => {
  const world = freshInsideGreenhouse();
  assert.equal(world.greenhouseState.noteReadDay, 0);

  const first = readGreenhouseNotesAction(world);
  assert.ok(first.memoryUnlockedTitle === 'The Shared Glass Corner');
  assert.equal(getItemCount(first.nextWorld.inventory, 'chamomile_seeds'), 1);
  assert.equal(getItemCount(first.nextWorld.inventory, 'thyme_seeds'), 1);
  assert.equal(first.nextWorld.greenhouseState.noteReadDay, world.day);
  assert.equal(first.nextWorld.minuteOfDay, world.minuteOfDay + GREENHOUSE_NOTE_READ_MINUTES);
  assert.equal(
    first.nextWorld.memories.some((m) => m.id === 'mem_greenhouse_note'),
    true,
  );
  assert.ok(first.gainedItems && first.gainedItems.length === 2);

  // Re-reads are cozy, not rewarding
  const second = readGreenhouseNotesAction(first.nextWorld);
  assert.equal(second.nextWorld.greenhouseState, first.nextWorld.greenhouseState);
  assert.equal(getItemCount(second.nextWorld.inventory, 'chamomile_seeds'), 1);
  assert.ok(!second.memoryUnlockedTitle);
});

test('sowing consumes a seed, fills the empty pot, and records the first-sow journal memory once', () => {
  const world = worldWithSeed('chamomile_seeds');
  const res = plantSeedAtPlotAction(world, 'chamomile_seeds', 1);

  assert.equal(res.ok, true);
  assert.equal(getItemCount(res.nextWorld.inventory, 'chamomile_seeds'), 1);
  const plot = res.nextWorld.greenhouseState.plots[1];
  assert.equal(plot.cropId, 'chamomile');
  assert.equal(plot.stage, 0);
  assert.equal(plot.plantedDay, world.day);
  assert.equal(plot.wateredToday, true, 'Sowing includes the first watering');
  assert.equal(res.nextWorld.greenhouseState.totalPlanted, 1);
  assert.equal(res.nextWorld.sideFlags.greenhousePlanted, true);
  assert.equal(res.nextWorld.minuteOfDay, world.minuteOfDay + GREENHOUSE_PLANT_MINUTES);
  assert.equal(res.memoryUnlockedTitle, 'Seeds in the Glass Corner');

  // Second sowing does not duplicate the one-time memory
  const second = plantSeedAtPlotAction(res.nextWorld, 'chamomile_seeds', 2);
  assert.equal(second.ok, true);
  assert.ok(!second.memoryUnlockedTitle);
  assert.equal(
    second.nextWorld.memories.filter((m) => m.id === 'mem_greenhouse_first_sow').length,
    1,
  );
});

test('sowing rejects occupied plots, missing seeds, and exterior attempts without mutating state', () => {
  const seeded = worldWithSeed('thyme_seeds');
  const sown = plantSeedAtPlotAction(seeded, 'thyme_seeds', 0);
  assert.equal(sown.ok, true);

  const occupied = plantSeedAtPlotAction(sown.nextWorld, 'thyme_seeds', 0);
  assert.equal(occupied.ok, false);
  assert.equal(occupied.nextWorld, sown.nextWorld);

  const noSeedBase = freshInsideGreenhouse();
  const noSeed = plantSeedAtPlotAction(noSeedBase, 'thyme_seeds', 3);
  assert.equal(noSeed.ok, false);
  assert.equal(noSeed.nextWorld, noSeedBase);

  const outside = {
    ...worldWithSeed('chamomile_seeds'),
    playerLocation: 'exterior' as const,
    playerPos: { x: -8.5, z: 9.5 },
  };
  const rejected = plantSeedAtPlotAction(outside, 'chamomile_seeds', 0);
  assert.equal(rejected.ok, false);

  const badPlot = plantSeedAtPlotAction(worldWithSeed('chamomile_seeds'), 'chamomile_seeds', 99);
  assert.equal(badPlot.ok, false);
});

test('watering fills only thirsty growing pots, costs minutes once, and idles when done', () => {
  const base = freshInsideGreenhouse();
  const gh = createInitialGreenhouseState();
  gh.plots[0] = { cropId: 'chamomile', plantedDay: 1, nightsGrown: 0, stage: 0, wateredToday: false };
  gh.plots[1] = { cropId: 'lavender', plantedDay: 1, nightsGrown: 1, stage: 1, wateredToday: false };
  const world = { ...base, greenhouseState: gh };

  const res = waterGreenhousePlotsAction(world);
  assert.ok(res.nextWorld !== world);
  assert.ok(res.nextWorld.greenhouseState.plots[0].wateredToday);
  assert.ok(res.nextWorld.greenhouseState.plots[1].wateredToday);
  assert.equal(res.nextWorld.minuteOfDay, world.minuteOfDay + GREENHOUSE_WATER_MINUTES);

  // Already watered: no state mutation
  const again = waterGreenhousePlotsAction(res.nextWorld);
  assert.equal(again.nextWorld, res.nextWorld);
  assert.ok(again.body.includes('already watered'));

  // No pots at all: gentle guidance, no mutation
  const empty = waterGreenhousePlotsAction(base);
  assert.equal(empty.nextWorld, base);

  // Ready pots never consume watering time
  const readyBase = freshInsideGreenhouse();
  const readyGh = createInitialGreenhouseState();
  readyGh.plots[0] = { cropId: 'thyme', plantedDay: 1, nightsGrown: 3, stage: 3, wateredToday: false };
  const readyWorld = { ...readyBase, greenhouseState: readyGh };
  const readyRes = waterGreenhousePlotsAction(readyWorld);
  assert.equal(readyRes.nextWorld, readyWorld);
});

test('harvesting a ready pot yields the crop plus a returned seed and resets the pot', () => {
  const base = freshInsideGreenhouse();
  const gh = createInitialGreenhouseState();
  gh.plots[2] = { cropId: 'lavender', plantedDay: 1, nightsGrown: 2, stage: 3, wateredToday: false };
  gh.totalPlanted = 1;
  const world = { ...base, greenhouseState: gh, minuteOfDay: 700 };

  const res = harvestPlotAction(world, 2);
  assert.equal(res.ok, true);
  assert.equal(getItemCount(res.nextWorld.inventory, 'lavender_sprig'), 2);
  assert.equal(getItemCount(res.nextWorld.inventory, 'lavender_seeds'), 1);
  assert.equal(res.nextWorld.greenhouseState.totalHarvests, 1);
  assert.equal(res.nextWorld.greenhouseState.plots[2].cropId, null);
  assert.equal(res.nextWorld.greenhouseState.plots[2].stage, 0);
  assert.equal(res.nextWorld.sideFlags.greenhouseHarvested, true);
  assert.equal(res.nextWorld.minuteOfDay, 700 + GREENHOUSE_HARVEST_MINUTES);
  assert.equal(res.memoryUnlockedTitle, 'First Glasshouse Harvest');
  assert.ok(res.gainedItems && res.gainedItems.length === 2);
  assert.ok(
    world.memories.every((m) => m.id !== 'mem_greenhouse_first_harvest'),
  );
  assert.ok(
    res.nextWorld.memories.some((m) => m.id === 'mem_greenhouse_first_harvest'),
  );

  // Not-ready and invalid plots refuse cleanly
  const notReady = harvestPlotAction(res.nextWorld, 2);
  assert.equal(notReady.ok, false);
  const badIndex = harvestPlotAction(world, 7);
  assert.equal(badIndex.ok, false);
  const outside = harvestPlotAction({ ...world, playerLocation: 'exterior' }, 2);
  assert.equal(outside.ok, false);
});

test('the greenhouse growth loop completes end-to-end across in-game days via advanceToNextDay', () => {
  let world = worldWithSeed('chamomile_seeds');
  world = enterGreenhouseAction(world).nextWorld;
  assert.equal(world.playerLocation, 'greenhouse_interior');
  const expectedWakePos = { ...world.exteriorPlayerPos };

  world = plantSeedAtPlotAction(world, 'chamomile_seeds', 0).nextWorld;
  assert.equal(world.greenhouseState.plots[0].stage, 0);

  // Night 1: watered pot advances
  world = advanceToNextDay(world);
  assert.equal(world.greenhouseState.plots[0].stage, 1);
  assert.equal(world.playerLocation, 'exterior', 'Waking in the greenhouse steps outside');
  assert.deepEqual(world.playerPos, expectedWakePos, 'Wake position returns to the entry spot');

  // Enter again, water, sleep
  world = enterGreenhouseAction(world).nextWorld;
  world = waterGreenhousePlotsAction(world).nextWorld;
  world = advanceToNextDay(world);
  assert.equal(world.greenhouseState.plots[0].stage, 3, 'Second watered night ripens chamomile');

  // Harvest inside the greenhouse
  world = enterGreenhouseAction(world).nextWorld;
  const harvest = harvestPlotAction(world, 0);
  assert.equal(harvest.ok, true);
  world = harvest.nextWorld;
  assert.equal(getItemCount(world.inventory, 'chamomile_blossom'), 3, 'Starter blossom + 2 harvested');
  assert.equal(getItemCount(world.inventory, 'chamomile_seeds'), 2, '1 remaining after sowing + 1 seed fold returned');
  assert.equal(world.greenhouseState.plots[0].cropId, null);

  // Skip watering entirely: a sown pot grows on its sowing-night watering, then stalls without dying
  world = plantSeedAtPlotAction(world, 'chamomile_seeds', 3).nextWorld;
  world = advanceToNextDay(world);
  assert.equal(world.greenhouseState.plots[3].stage, 1, 'Sowing-night watering counts as night one');
  world = advanceToNextDay(world);
  assert.equal(world.greenhouseState.plots[3].stage, 1, 'Unwatered pot waits without dying');
});

test('enter/exit greenhouse reducers preserve the exterior spot and place the player at the interior door', () => {
  const outside = createFreshWorldState();
  const entered = enterGreenhouseAction(outside);
  assert.equal(entered.nextWorld.playerLocation, 'greenhouse_interior');
  assert.deepEqual(entered.nextWorld.playerPos, GREENHOUSE_DOOR_SPAWN);
  assert.ok(entered.nextWorld.exteriorPlayerPos);

  const exited = exitGreenhouseAction(entered.nextWorld);
  assert.equal(exited.nextWorld.playerLocation, 'exterior');
  assert.deepEqual(exited.nextWorld.playerPos, entered.nextWorld.exteriorPlayerPos);

  // Idempotence and wrong-location guards
  assert.equal(enterGreenhouseAction(exited.nextWorld).nextWorld.playerLocation, 'greenhouse_interior');
  assert.equal(exitGreenhouseAction(outside).nextWorld, outside);
});

test('the exterior greenhouse door prop routes through interactWithProp with an enter action', () => {
  const world = createFreshWorldState();
  const res = interactWithProp(world, 'greenhouse_door');
  assert.equal(res.actionType, 'enter_greenhouse');
  assert.equal(res.actionLabel, 'Step Inside');
  assert.equal(res.nextWorld, world);
});

test('greenhouse station cards summarize plots and route to the correct panels', () => {
  const base = freshInsideGreenhouse();
  const gh = createInitialGreenhouseState();
  gh.plots[0] = { cropId: 'chamomile', plantedDay: 1, nightsGrown: 0, stage: 0, wateredToday: true };

  const potting = interactWithGreenhouseProp(base, 'greenhouse_potting');
  assert.equal(potting.actionType, 'greenhouse_planting_panel');

  const shelfGrowing = interactWithGreenhouseProp({ ...base, greenhouseState: gh }, 'greenhouse_shelf');
  assert.ok(!shelfGrowing.actionType, 'Growing (not ready) pots show an info card, not a panel');
  assert.ok(shelfGrowing.body.includes('Pot 1'));

  const ghReady = createInitialGreenhouseState();
  ghReady.plots[0] = { cropId: 'thyme', plantedDay: 1, nightsGrown: 3, stage: 3, wateredToday: false };
  const shelfReady = interactWithGreenhouseProp({ ...base, greenhouseState: ghReady }, 'greenhouse_shelf');
  assert.equal(shelfReady.actionType, 'greenhouse_harvest_panel');

  const door = interactWithGreenhouseProp(base, 'greenhouse_door');
  assert.equal(door.actionType, 'exit_greenhouse');
});

test('summarizeGreenhousePlots, describeGreenhouseStage, and crop lookups stay registry-derived', () => {
  const gh = createInitialGreenhouseState();
  gh.plots[0] = { cropId: 'chamomile', plantedDay: 1, nightsGrown: 0, stage: 0, wateredToday: false };
  gh.plots[1] = { cropId: 'thyme', plantedDay: 1, nightsGrown: 3, stage: 3, wateredToday: false };
  const summary = summarizeGreenhousePlots(gh);
  assert.equal(summary.emptyPlots, 2);
  assert.equal(summary.growingPlots, 1);
  assert.equal(summary.thirstyPlots, 1);
  assert.equal(summary.readyPlots, 1);
  assert.equal(summary.totalPlots, GREENHOUSE_PLOT_COUNT);

  assert.equal(GREENHOUSE_PLOT_SHELF_Z.length, GREENHOUSE_PLOT_COUNT);
  assert.equal(getGreenhouseCropBySeed('thyme_seeds')?.cropItemId, 'lemon_thyme');
  assert.equal(getGreenhouseCropBySeed('lavender_seeds')?.growthNights, 2);
  assert.equal(getGreenhouseCrop('chamomile')?.seedItemId, 'chamomile_seeds');
  assert.equal(getGreenhouseCrop(null), null);

  assert.ok(describeGreenhouseStage(3, 'chamomile').includes('ready'));
  assert.ok(describeGreenhouseStage(0, null).includes('empty'));
});

test('v6 -> v7 migration hydrates greenhouseState and preserves v6 interior location', () => {
  const v6Save = {
    schemaVersion: 6,
    day: 4,
    minuteOfDay: 830,
    playerLocation: 'cottage_interior',
    playerPos: { x: 2.25, z: 0 },
    cottageState: { placedFlowerId: 'crabapple', displayedKeepsakeIds: [], hearthLit: true, kettleWarmUntilMinute: 0, almanacReadToday: false, cottageRestCount: 2 },
    inventory: { chamomile_blossom: 2 },
  };
  const res = migrateWorldState(v6Save);
  // Build 9 bumps the runtime schema to v10: the v6 save now chains v6→…→v10,
  // keeping every v7 greenhouse invariant plus the fresh v8 bakeryState, v9 nookState,
  // and v10 copperwheelState.
  assert.equal(res.state.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.equal(res.migratedFromVersion, 6);
  assert.equal(res.state.playerLocation, 'cottage_interior');
  assert.equal(res.state.greenhouseState.noteReadDay, 0);
  assert.equal(res.state.greenhouseState.plots.length, GREENHOUSE_PLOT_COUNT);
  assert.ok(res.state.greenhouseState.plots.every((p: GreenhousePlotState) => p.cropId === null));
  assert.ok(res.state.bakeryState, 'chain hydrates the fresh bakeryState');
  assert.ok(res.state.nookState, 'chain hydrates the fresh nookState');
  assert.ok(res.state.copperwheelState, 'chain hydrates the fresh copperwheelState');
  assert.deepEqual(res.state.cottageState.placedFlowerId, 'crabapple');
});

test('greenhouseState sanitizer repairs corrupt plots and clamps stages', () => {
  const corrupt = {
    schemaVersion: 7,
    day: 2,
    minuteOfDay: 500,
    greenhouseState: {
      plots: [
        { cropId: 'moonflower', plantedDay: 1, nightsGrown: 9, stage: 11, wateredToday: 'yes' },
        'garbage',
        { cropId: 'thyme', plantedDay: 0, nightsGrown: -4, stage: -2, wateredToday: true },
      ],
      noteReadDay: -3,
      totalHarvests: -1,
      totalPlanted: 'lots',
    },
  };
  const res = migrateWorldState(corrupt);
  const gh = res.state.greenhouseState;
  assert.equal(gh.plots.length, GREENHOUSE_PLOT_COUNT);
  assert.equal(gh.plots[0]?.cropId, null, 'Unknown crop ids reset to an empty pot');
  assert.equal(gh.plots[2]?.cropId, 'thyme');
  assert.ok(gh.plots[2]!.stage >= 0 && gh.plots[2]!.stage <= 3);
  assert.equal(gh.noteReadDay, 0);
  assert.equal(gh.totalHarvests, 0);
  assert.equal(gh.totalPlanted, 0);
  assert.ok(res.warnings.some((w) => w.includes('greenhouseState')));
});

test('computeWorldSaveRevision responds to greenhouse growth changes and serialized saves stay compact', () => {
  const base = createFreshWorldState();
  const grown = {
    ...base,
    greenhouseState: {
      ...base.greenhouseState,
      plots: base.greenhouseState.plots.map((p, i) =>
        i === 0 ? { cropId: 'chamomile' as const, plantedDay: 1, nightsGrown: 2, stage: 3 as const, wateredToday: true } : p,
      ),
    },
  };
  assert.notEqual(computeWorldSaveRevision(base), computeWorldSaveRevision(grown));

  const bytes = serializeWorldState(grown).length;
  assert.ok(bytes < 40_000, `Fresh save with greenhouse state should stay compact, got ${bytes} bytes`);

  // Round-trip through serialization preserves the plot state exactly
  const round = migrateWorldState(JSON.parse(serializeWorldState(grown)));
  assert.equal(round.state.greenhouseState.plots[0].stage, 3);
  assert.equal(round.state.greenhouseState.plots[0].nightsGrown, 2);
  assert.equal(round.state.greenhouseState.plots[0].wateredToday, true);
});
