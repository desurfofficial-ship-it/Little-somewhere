import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SIP_MINUTES_SPENT,
  cookRecipeAction,
  enterCottageAction,
  exitCottageAction,
  interactWithCottageProp,
  interactWithProp,
  placeFlowerInVaseAction,
  sipBeverageAtTableAction,
  toggleDisplayedKeepsakeAction,
  togglePlayerSitAction,
} from './actions';
import {
  COTTAGE_DOOR_SPAWN,
  COTTAGE_INTERACTABLES,
  COTTAGE_INTERIOR_OBSTACLES,
  COTTAGE_SEAT_SPOTS,
  COTTAGE_WAKE_SPAWN,
  computeChimneySmokeStrength,
  isInteriorPointWalkable,
  resolveAnySeatById,
  resolveInteriorMovement,
  selectBestInteriorTarget,
} from './cottage';
import { getItemCount } from './inventory';
import {
  PLAYER_INDOOR_MAX_SPEED,
  PLAYER_SPRINT_SPEED,
  createInitialPlayerMotion,
  stepPlayerMovement,
} from './playerController';
import { stepSimulation } from './simulation';
import { advanceToNextDay, createFreshWorldState } from './storage';
import { DAY_END_MINUTE } from './time';
import { isPointWalkable } from './worldMap';

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
    facing: Math.atan2(-1, 0),
    motion: createInitialPlayerMotion(COTTAGE_DOOR_SPAWN),
    moveDirX: -1,
    moveDirZ: 0,
    inputMagnitude: 1,
    sprintHeld: false,
    carryingItem: false,
    posture: 'standing',
    seatId: null,
    location: 'cottage_interior',
    dt: 0.2,
  });
  assert.ok(indoorStep.pos.x < COTTAGE_DOOR_SPAWN.x);
  assert.equal(isInteriorPointWalkable(indoorStep.pos.x, indoorStep.pos.z, 0.42), true);
});

test('indoor sprint input is capped to the cozy room pace while outdoor speeds are untouched', () => {
  // 16 steps (~0.53s) accelerate to terminal pace but stay clear of interior walls
  const runSprintSteps = (location: 'exterior' | 'cottage_interior') => {
    // z=-0.45 is the open west corridor: no furniture blocks a 2.3 m dash from the door
    const start = location === 'cottage_interior' ? { x: 2.25, z: -0.45 } : { x: 2, z: -2 };
    const motion = createInitialPlayerMotion(start);
    let pos = { ...start };
    let latest = motion;
    for (let i = 0; i < 16; i++) {
      const res = stepPlayerMovement({
        pos,
        facing: Math.PI,
        motion: latest,
        moveDirX: -1,
        moveDirZ: 0,
        inputMagnitude: 1,
        sprintHeld: true,
        carryingItem: false,
        posture: 'standing',
        seatId: null,
        location,
        dt: 1 / 30,
      });
      pos = res.pos;
      latest = res.motion;
    }
    return latest.speed;
  };

  const indoorSpeed = runSprintSteps('cottage_interior');
  const outdoorSpeed = runSprintSteps('exterior');
  assert.ok(
    indoorSpeed <= PLAYER_INDOOR_MAX_SPEED + 0.05,
    `Indoor pace should trim to ${PLAYER_INDOOR_MAX_SPEED}, got ${indoorSpeed.toFixed(2)}`,
  );
  assert.ok(
    indoorSpeed > 3.0,
    `Indoor pace should still exceed a gentle walk, got ${indoorSpeed.toFixed(2)}`,
  );
  assert.ok(
    outdoorSpeed >= PLAYER_SPRINT_SPEED - 0.6,
    `Outdoor sprint should stay full-speed, got ${outdoorSpeed.toFixed(2)}`,
  );
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
  // Recipe discovery: pre-seed the chamomile_blossom ingredient discovery so
  // the recipe is available (the test simulates a player who has already
  // tended the window box at least once).
  const startMinute = world.minuteOfDay;
  const cooked = cookRecipeAction({
    ...world,
    sideFlags: { ...(world.sideFlags ?? {}), ingredientDiscovered_chamomile_blossom: true },
  }, 'recipe_chamomile_tea');
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

test('gathering results carry explicit gainedItems chips matching the inventory deltas', () => {
  let world = createFreshWorldState();

  const box = interactWithProp(world, 'cottage_window_box');
  world = box.nextWorld;
  assert.ok(box.gainedItems, 'window box result exposes gainedItems');
  const boxChamomile = box.gainedItems.find((c) => c.itemId === 'chamomile_blossom');
  assert.equal(boxChamomile?.count, getItemCount(world.inventory, 'chamomile_blossom') - 1);

  const greenhouse = interactWithProp(world, 'greenhouse_planters');
  world = greenhouse.nextWorld;
  // GA-2: the first-ever tending also finds Mina's one-time lavender seed sachet.
  assert.deepEqual(
    [...greenhouse.gainedItems ?? []].sort((a, b) => a.itemId.localeCompare(b.itemId)),
    [
      { itemId: 'lavender_seeds', count: 1 },
      { itemId: 'lavender_sprig', count: 1 },
      { itemId: 'lemon_thyme', count: 1 },
    ],
  );

  const orchard = interactWithProp(world, 'orchard_harvest');
  world = orchard.nextWorld;
  assert.deepEqual(orchard.gainedItems, [
    { itemId: 'crabapple', count: 2 },
    { itemId: 'wild_honey', count: 1 },
  ]);

  const pond = interactWithProp(world, 'pond_driftwood');
  world = pond.nextWorld;
  assert.equal(pond.gainedItems?.length, 1);
  assert.equal(
    getItemCount(world.inventory, pond.gainedItems![0].itemId),
    pond.gainedItems![0].count,
  );

  // Second visit (already tended today) grants nothing and exposes no chips
  const boxAgain = interactWithProp(world, 'cottage_window_box');
  assert.equal(boxAgain.nextWorld, world);
  assert.equal(boxAgain.gainedItems, undefined);
});

test('cottage indoor dining seats are footprint-anchored, walkable-approach, and offered by interior target selection', () => {
  const ids = new Set(COTTAGE_SEAT_SPOTS.map((s) => s.id));
  assert.equal(COTTAGE_SEAT_SPOTS.length, 2);
  assert.equal(ids.size, 2, 'Indoor seat ids are unique');

  const tableBox = COTTAGE_INTERIOR_OBSTACLES.find((o) => o.id === 'cottage_table')!;
  for (const seat of COTTAGE_SEAT_SPOTS) {
    assert.equal(seat.indoor, true, `${seat.id} must be flagged indoor`);
    assert.ok(
      seat.seatPos.x > tableBox.minX &&
        seat.seatPos.x < tableBox.maxX &&
        seat.seatPos.z > tableBox.minZ &&
        seat.seatPos.z < tableBox.maxZ,
      `${seat.id} seatPos sits on the tucked stool inside the table footprint`,
    );
    assert.equal(
      isInteriorPointWalkable(seat.approachPos.x, seat.approachPos.z, 0.42),
      true,
      `${seat.id} approachPos must be a walkable interior standing spot`,
    );
    assert.ok(seat.seatHeight > 0.3 && seat.seatHeight < 0.7, `${seat.id} seatHeight is stool-scale`);
  }

  // Cross-registry resolution: indoor seats first, outdoor benches fallback, nothing for null
  const westSeat = resolveAnySeatById('cottage_seat_table_west');
  assert.ok(westSeat && westSeat.indoor === true);
  const outdoorSeat = resolveAnySeatById('seat_east_plaza');
  assert.ok(outdoorSeat && !outdoorSeat.indoor);
  assert.equal(resolveAnySeatById(undefined), undefined);

  // Standing near the west approach and facing the stool surfaces the seat target
  const west = COTTAGE_SEAT_SPOTS[0];
  const seatWorld = {
    ...createFreshWorldState(),
    playerLocation: 'cottage_interior' as const,
    playerPos: { ...west.approachPos },
    playerFacing: Math.atan2(
      west.seatPos.x - west.approachPos.x,
      west.seatPos.z - west.approachPos.z,
    ),
  };
  const target = selectBestInteriorTarget(seatWorld);
  assert.ok(target && target.kind === 'seat' && target.seatId === west.id,
    'Facing the stool from its approach point offers the seat target');
  assert.equal(target.actionLabel, 'Sit on Oak Table Stool');
});

test('tea-table sip ritual consumes a drink, spends minutes, and writes one first-time journal memory', () => {
  // Build a seated-inside world with a freshly brewed tea in the satchel
  let world = enterCottageAction(createFreshWorldState()).nextWorld;
  const startMinute2 = world.minuteOfDay;
  // Recipe discovery: pre-seed ingredient discovery for the tea-table test.
  const cooked = cookRecipeAction({
    ...world,
    sideFlags: { ...(world.sideFlags ?? {}), ingredientDiscovered_chamomile_blossom: true },
  }, 'recipe_chamomile_tea');
  assert.equal(cooked.ok, true);
  world = cooked.nextWorld;
  const seated = togglePlayerSitAction(world, 'cottage_seat_table_west');
  assert.equal(seated.sat, true);
  world = seated.nextWorld;

  const startMinute = world.minuteOfDay;
  const sip = sipBeverageAtTableAction(world);
  assert.equal(sip.ok, true);
  world = sip.nextWorld;
  assert.equal(getItemCount(world.inventory, 'chamomile_pear_tea'), 0);
  assert.equal(world.minuteOfDay, Math.min(DAY_END_MINUTE, startMinute + SIP_MINUTES_SPENT));
  assert.ok(world.memories.some((m) => m.id === 'mem_teatable_chamomile_pear_tea'));
  assert.equal(sip.memoryUnlockedTitle, 'A Quiet Warm Chamomile Tea Moment');
  assert.ok(sip.title.includes('Oak Table'));

  // A second sip (with another tea brewed) is cozy but writes no duplicate memory
  const rebrew = cookRecipeAction(
    { ...world, inventory: { ...world.inventory, chamomile_blossom: 1 } },
    'recipe_chamomile_tea',
  );
  assert.equal(rebrew.ok, true);
  world = rebrew.nextWorld;
  const secondSip = sipBeverageAtTableAction(world);
  assert.equal(secondSip.ok, true);
  assert.equal(secondSip.memoryUnlockedTitle, undefined);
  assert.equal(
    secondSip.nextWorld.memories.filter((m) => m.id === 'mem_teatable_chamomile_pear_tea').length,
    1,
  );

  // Rejection paths: standing up and having no drink; outdoors now sips (C-5)
  const standingWorld = togglePlayerSitAction(world, undefined).nextWorld;
  assert.equal(sipBeverageAtTableAction(standingWorld).ok, false);
  const outdoorSeated = togglePlayerSitAction(
    {
      ...standingWorld,
      playerLocation: 'exterior' as const,
      // Overhaul G-3: stage beside the plaza bench like the real walk-then-sit
      // flow (the reducer no longer accepts cross-map teleport-sits).
      playerPos: { x: 4.35, z: 3.0 },
    },
    'seat_east_plaza',
  ).nextWorld;
  // Overhaul C-5: outdoor bench sipping is now supported — a seated player
  // with a brewed drink can sip anywhere.
  assert.equal(sipBeverageAtTableAction(outdoorSeated).ok, true);
  const emptySatchel = togglePlayerSitAction(
    { ...standingWorld, inventory: {} },
    'cottage_seat_table_east',
  ).nextWorld;
  assert.equal(sipBeverageAtTableAction(emptySatchel).ok, false);
  // Explicit non-sipable item request is rejected
  const seatedNoTea = togglePlayerSitAction(
    { ...emptySatchel, inventory: { herb_loaf: 1 } },
    'cottage_seat_table_east',
  ).nextWorld;
  assert.equal(sipBeverageAtTableAction(seatedNoTea, 'herb_loaf').ok, false);
});

test('Pass 10: chimney smoke strength advertises the hearth — cold hearth is clean, kettle-warm breathes harder', () => {
  const base = createFreshWorldState();
  const litKettle = {
    minuteOfDay: 1000,
    cottageState: { ...base.cottageState, hearthLit: true, kettleWarmUntilMinute: 1200 },
  };
  assert.equal(computeChimneySmokeStrength(litKettle), 1.3, 'Kettle-warm hearth breathes harder');

  const litColdKettle = {
    minuteOfDay: 1000,
    cottageState: { ...base.cottageState, hearthLit: true, kettleWarmUntilMinute: 0 },
  };
  assert.equal(computeChimneySmokeStrength(litColdKettle), 1, 'Lit hearth smokes at baseline');

  const expiredKettle = {
    minuteOfDay: 1250,
    cottageState: { ...base.cottageState, hearthLit: true, kettleWarmUntilMinute: 1200 },
  };
  assert.equal(
    computeChimneySmokeStrength(expiredKettle),
    1,
    'Expired kettle window falls back to baseline smoke',
  );

  const coldHearth = {
    minuteOfDay: 1000,
    cottageState: { ...base.cottageState, hearthLit: false, kettleWarmUntilMinute: 1200 },
  };
  assert.equal(computeChimneySmokeStrength(coldHearth), 0, 'Cold hearth stays clean');

  assert.equal(
    computeChimneySmokeStrength({ minuteOfDay: 1000, cottageState: undefined as never }),
    0,
    'Missing cottage state never smokes',
  );
});
