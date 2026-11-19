import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cookRecipeAction,
  enterCottageAction,
  exitCottageAction,
  interactWithCottageProp,
  interactWithProp,
  placeFlowerInVaseAction,
  toggleDisplayedKeepsakeAction,
} from './actions';
import {
  COTTAGE_DOOR_SPAWN,
  COTTAGE_INTERACTABLES,
  COTTAGE_INTERIOR_OBSTACLES,
  COTTAGE_PORCH_EXIT_POS,
  COTTAGE_WAKE_SPAWN,
  computeInteriorWaypoints,
  isInteriorPointWalkable,
  resolveInteriorMovement,
  selectBestInteriorTarget,
} from './cottage';
import { getItemCount } from './inventory';
import { createInitialPlayerMotion, stepPlayerMovement } from './playerController';
import { stepSimulation } from './simulation';
import { advanceToNextDay, createFreshWorldState } from './storage';
import { PROP_INTERACTABLES, getPropInteractionMetrics, isPointWalkable } from './worldMap';

test('cottage interior walkability, obstacle bounds, spawns, and interactable stand spots are valid', () => {
  assert.equal(isInteriorPointWalkable(COTTAGE_DOOR_SPAWN.x, COTTAGE_DOOR_SPAWN.z, 0.42), true);
  assert.equal(isInteriorPointWalkable(COTTAGE_WAKE_SPAWN.x, COTTAGE_WAKE_SPAWN.z, 0.42), true);

  for (const obs of COTTAGE_INTERIOR_OBSTACLES) {
    const cx = (obs.minX + obs.maxX) * 0.5;
    const cz = (obs.minZ + obs.maxZ) * 0.5;
    assert.equal(
      isInteriorPointWalkable(cx, cz, 0.42),
      false,
      `Furniture obstacle center ${obs.id} should block walking`,
    );
  }

  for (const prop of COTTAGE_INTERACTABLES) {
    assert.equal(
      isInteriorPointWalkable(prop.x, prop.z, 0.42),
      true,
      `Stand spot for ${prop.id} at (${prop.x}, ${prop.z}) must be walkable`,
    );
    const targetWorld = {
      ...createFreshWorldState(),
      playerLocation: 'cottage_interior' as const,
      playerPos: { x: prop.x, z: prop.z },
      playerFacing: Math.atan2(prop.focusX - prop.x, prop.focusZ - prop.z),
    };
    const best = selectBestInteriorTarget(targetWorld);
    assert.ok(best && best.cottagePropId === prop.id, `Should select ${prop.id} at its stand spot`);
  }

  // Movement clamping resolves sliding along interior furniture without escaping room bounds
  const blocked = resolveInteriorMovement({ x: 0, z: -0.4 }, { x: 0.25, z: 0.6 }, 0.42);
  assert.ok(isInteriorPointWalkable(blocked.x, blocked.z, 0.42));

  const indoorStep = stepPlayerMovement({
    pos: { ...COTTAGE_DOOR_SPAWN },
    facing: -Math.PI * 0.5,
    motion: createInitialPlayerMotion(COTTAGE_DOOR_SPAWN),
    moveDirX: -1,
    moveDirZ: 0,
    inputMagnitude: 1,
    sprintHeld: false,
    carryingItem: false,
    posture: 'standing',
    seatId: null,
    location: 'cottage_interior',
    dt: 0.05,
  });
  assert.ok(indoorStep.pos.x < COTTAGE_DOOR_SPAWN.x);
  assert.equal(isInteriorPointWalkable(indoorStep.pos.x, indoorStep.pos.z, 0.42), true);
});

test('entering and leaving Willow Step Cottage preserves exterior position and suspends outdoor greetings indoors', () => {
  const world = createFreshWorldState();
  const porchPos = { x: -9.8, z: 10.0 };
  const outside = { ...world, playerPos: porchPos, playerFacing: 0.9 };

  const entered = enterCottageAction(outside);
  assert.equal(entered.nextWorld.playerLocation, 'cottage_interior');
  assert.deepEqual(entered.nextWorld.exteriorPlayerPos, porchPos);
  assert.deepEqual(entered.nextWorld.playerPos, COTTAGE_DOOR_SPAWN);

  // Simulation indoors keeps playerPos inside cottage and does not fire outdoor spontaneous NPC greeting
  const simWorld = stepSimulation(entered.nextWorld, 0.5);
  assert.equal(simWorld.playerLocation, 'cottage_interior');
  assert.deepEqual(simWorld.playerPos, COTTAGE_DOOR_SPAWN);
  assert.deepEqual(simWorld.exteriorPlayerPos, porchPos);

  const exited = exitCottageAction(simWorld);
  assert.equal(exited.nextWorld.playerLocation, 'exterior');
  assert.deepEqual(exited.nextWorld.playerPos, porchPos);
  assert.equal(exited.nextWorld.playerFacing, 0.9);
  assert.equal(isPointWalkable(exited.nextWorld.playerPos.x, exited.nextWorld.playerPos.z, 0.48), true);
});

test('cottage hearth cooking, table vase arrangement, keepsake display, almanac, and bed rollover work cleanly', () => {
  let world = enterCottageAction(createFreshWorldState()).nextWorld;

  // Brew Chamomile Honey Tea using starter chamomile_blossom
  const startMinute = world.minuteOfDay;
  const cooked = cookRecipeAction(world, 'recipe_chamomile_tea');
  assert.equal(cooked.ok, true);
  world = cooked.nextWorld;
  assert.equal(getItemCount(world.inventory, 'chamomile_blossom'), 0);
  assert.equal(getItemCount(world.inventory, 'chamomile_pear_tea'), 1);
  assert.equal(world.minuteOfDay, startMinute + 15);
  assert.equal(world.dailyActivities.bakedCountToday, 1);
  assert.ok(world.memories.some((m) => m.id === 'mem_cottage_hearth'));

  // Sill planter yields fresh chamomile_blossom once per day
  const sill1 = interactWithCottageProp(world, 'cottage_planter');
  world = sill1.nextWorld;
  assert.equal(getItemCount(world.inventory, 'chamomile_blossom'), 1);
  assert.equal(world.dailyActivities.cottagePlanterTendedToday, true);

  const sill2 = interactWithCottageProp(world, 'cottage_planter');
  assert.equal(getItemCount(sill2.nextWorld.inventory, 'chamomile_blossom'), 1);

  // Arrange flower in table vase and swap / return without losing items
  const placed = placeFlowerInVaseAction(world, 'chamomile_blossom');
  assert.equal(placed.ok, true);
  world = placed.nextWorld;
  assert.equal(world.cottageState.placedFlowerId, 'chamomile_blossom');
  assert.equal(getItemCount(world.inventory, 'chamomile_blossom'), 0);

  const cleared = placeFlowerInVaseAction(world, null);
  assert.equal(cleared.ok, true);
  world = cleared.nextWorld;
  assert.equal(world.cottageState.placedFlowerId, null);
  assert.equal(getItemCount(world.inventory, 'chamomile_blossom'), 1);

  // Keepsake display requires ownership and toggles cleanly
  const unownedToggle = toggleDisplayedKeepsakeAction(world, 'willow_zine_copy');
  assert.equal(unownedToggle.ok, false);

  world = {
    ...world,
    inventory: { ...world.inventory, willow_zine_copy: 1 },
  };
  const showKeepsake = toggleDisplayedKeepsakeAction(world, 'willow_zine_copy');
  assert.equal(showKeepsake.ok, true);
  assert.deepEqual(showKeepsake.nextWorld.cottageState.displayedKeepsakeIds, ['willow_zine_copy']);
  const hideKeepsake = toggleDisplayedKeepsakeAction(showKeepsake.nextWorld, 'willow_zine_copy');
  assert.equal(hideKeepsake.ok, true);
  assert.deepEqual(hideKeepsake.nextWorld.cottageState.displayedKeepsakeIds, []);

  // Almanac advances time once per day
  const beforeAlmanac = world.minuteOfDay;
  const almanac1 = interactWithCottageProp(world, 'cottage_desk');
  assert.equal(almanac1.nextWorld.cottageState.almanacReadToday, true);
  assert.equal(almanac1.nextWorld.minuteOfDay, beforeAlmanac + 10);
  const almanac2 = interactWithCottageProp(almanac1.nextWorld, 'cottage_desk');
  assert.equal(almanac2.nextWorld.minuteOfDay, beforeAlmanac + 10);

  // Resting from bed advances day, resets dailyActivities & wakes inside cottage at COTTAGE_WAKE_SPAWN
  const bedInspect = interactWithCottageProp(almanac1.nextWorld, 'cottage_bed');
  assert.equal(bedInspect.actionType, 'rest_next_day');
  const morning = advanceToNextDay(almanac1.nextWorld);
  assert.equal(morning.day, 2);
  assert.equal(morning.playerLocation, 'cottage_interior');
  assert.deepEqual(morning.playerPos, COTTAGE_WAKE_SPAWN);
  assert.equal(morning.cottageState.cottageRestCount, 1);
  assert.equal(morning.cottageState.almanacReadToday, false);
  assert.equal(morning.dailyActivities.cottagePlanterTendedToday, false);
  assert.equal(morning.dailyActivities.bakedCountToday, 0);
});

test('outdoor gathering props grant daily items cleanly and respect once-per-day limits', () => {
  let world = createFreshWorldState();

  const gh = interactWithProp(world, 'greenhouse_planters');
  world = gh.nextWorld;
  assert.equal(getItemCount(world.inventory, 'lemon_thyme'), 2); // 1 starter + 1 clipped
  assert.equal(getItemCount(world.inventory, 'lavender_sprig'), 1);
  assert.equal(world.dailyActivities.greenhousePlantersTendedToday, true);

  const ghAgain = interactWithProp(world, 'greenhouse_planters');
  assert.equal(getItemCount(ghAgain.nextWorld.inventory, 'lavender_sprig'), 1);

  const orchard = interactWithProp(world, 'orchard_harvest');
  world = orchard.nextWorld;
  assert.equal(getItemCount(world.inventory, 'crabapple'), 2);
  assert.equal(getItemCount(world.inventory, 'wild_honey'), 1);
  assert.equal(orchard.memoryUnlockedTitle, 'Sunlit Boughs at Fern Hollow');
  assert.equal(world.dailyActivities.orchardHarvestedToday, true);

  const pond = interactWithProp(world, 'pond_driftwood');
  world = pond.nextWorld;
  assert.equal(world.dailyActivities.pondCombedToday, true);
  assert.ok(
    getItemCount(world.inventory, 'smooth_river_glass') +
      getItemCount(world.inventory, 'heron_feather') +
      getItemCount(world.inventory, 'pressed_fern') +
      getItemCount(world.inventory, 'cedar_shaving_rose') === 1,
  );
});

test('interior table-bypass waypoints and outdoor daily gathering prop approach positions stay walkable', () => {
  const bedSpot = COTTAGE_INTERACTABLES.find((p) => p.id === 'cottage_bed')!;
  const deskSpot = COTTAGE_INTERACTABLES.find((p) => p.id === 'cottage_desk')!;
  const waypoints = computeInteriorWaypoints(
    { x: bedSpot.x, z: bedSpot.z },
    { x: deskSpot.x, z: deskSpot.z },
    0.42,
  );
  assert.ok(waypoints.length >= 2, 'Should route around center table when walking from bed to desk');
  for (const wp of waypoints) {
    assert.equal(isInteriorPointWalkable(wp.x, wp.z, 0.42), true);
  }

  assert.equal(isPointWalkable(COTTAGE_PORCH_EXIT_POS.x, COTTAGE_PORCH_EXIT_POS.z, 0.48), true);
  const dailyProps = [
    'cottage_window_box',
    'greenhouse_planters',
    'orchard_harvest',
    'pond_driftwood',
  ] as const;
  for (const pid of dailyProps) {
    const prop = PROP_INTERACTABLES.find((p) => p.id === pid)!;
    const metrics = getPropInteractionMetrics(pid, { x: prop.x, z: prop.z });
    assert.equal(
      isPointWalkable(metrics.approachPos.x, metrics.approachPos.z, 0.48),
      true,
      `Outdoor daily prop ${pid} approachPos (${metrics.approachPos.x}, ${metrics.approachPos.z}) must be walkable`,
    );
  }
});
