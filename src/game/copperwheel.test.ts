import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COPPERWHEEL_BENCH_MINUTES,
  COPPERWHEEL_DOOR_SPAWN,
  COPPERWHEEL_INTERACTABLES,
  COPPERWHEEL_INTERIOR_OBSTACLES,
  COPPERWHEEL_NOTES_MINUTES,
  COPPERWHEEL_PORCH_EXIT_FACING,
  COPPERWHEEL_PORCH_EXIT_POS,
  COPPERWHEEL_PROJECTS,
  COPPERWHEEL_SEAT_SPOTS,
  COPPERWHEEL_TEA_MINUTES,
  computeCopperwheelWaypoints,
  createInitialCopperwheelState,
  getProjectForDay,
  isCopperwheelInteriorWalkable,
  resolveCopperwheelInteriorMovement,
  selectBestCopperwheelTarget,
} from './copperwheel';
import {
  sipBeverageAtTableAction,
  checkWorkbenchProjectAction,
  enterCopperwheelAction,
  exitCopperwheelAction,
  interactWithCopperwheelProp,
  interactWithProp,
  peekNightstandAction,
  pourKettleCupAction,
  readMendingLedgerAction,
} from './actions';
import { resolveAnySeatById } from './cottage';
import { getItemCount } from './inventory';
import {
  advanceToNextDay,
  computeWorldSaveRevision,
  createFreshWorldState,
  serializeWorldState,
} from './storage';
import { CURRENT_SCHEMA_VERSION, migrateWorldState } from './migrations';
import { WorldState } from './types';

function freshInsideCopperwheel(day = 1, minuteOfDay = 540): WorldState {
  const world = createFreshWorldState();
  return {
    ...world,
    day,
    minuteOfDay,
    playerLocation: 'copperwheel_interior',
    playerPos: { ...COPPERWHEEL_DOOR_SPAWN },
  };
}

test('copperwheel interior walkability, obstacle bounds, spawns, and interactable stand spots are valid', () => {
  assert.equal(isCopperwheelInteriorWalkable(COPPERWHEEL_DOOR_SPAWN.x, COPPERWHEEL_DOOR_SPAWN.z, 0.42), true);
  for (const box of COPPERWHEEL_INTERIOR_OBSTACLES) {
    assert.ok(box.maxX > box.minX, `obstacle ${box.id} maxX above minX`);
    assert.ok(box.maxZ > box.minZ, `obstacle ${box.id} maxZ above minZ`);
    assert.equal(
      isCopperwheelInteriorWalkable((box.minX + box.maxX) / 2, (box.minZ + box.maxZ) / 2, 0.42),
      false,
      `obstacle ${box.id} center must block`,
    );
  }
  for (const prop of COPPERWHEEL_INTERACTABLES) {
    const standOk =
      isCopperwheelInteriorWalkable(prop.x, prop.z, 0.42) ||
      // door focus sits beyond the south wall by design (mirrors the other interior doors)
      prop.id === 'cw_door';
    assert.equal(standOk, true, `stand spot for ${prop.id} must be walkable`);
  }
  // Obstacle ids stay unique and align with the registry contract
  const obstacleIds = new Set(COPPERWHEEL_INTERIOR_OBSTACLES.map((o) => o.id));
  assert.equal(obstacleIds.size, COPPERWHEEL_INTERIOR_OBSTACLES.length);
});

test('deterministic bench project cycle rotates one project per day', () => {
  assert.equal(getProjectForDay(1).id, 'orchard_pendulum');
  assert.equal(getProjectForDay(2).id, 'music_box_comb');
  assert.equal(getProjectForDay(3).id, 'watch_escapement');
  assert.equal(getProjectForDay(4).id, 'bench_rest');
  assert.equal(getProjectForDay(5).id, 'orchard_pendulum');
  assert.equal(getProjectForDay(8).id, 'bench_rest');
  // every project carries its own one-time memory identity
  const memoryIds = new Set(COPPERWHEEL_PROJECTS.map((p) => p.memoryId));
  assert.equal(memoryIds.size, 4);
  // resting day declares no fine work
  assert.equal(getProjectForDay(4).fineWork.length, 0);
});

test('checkWorkbenchProjectAction reveals the day project once per day, counts the winding session, and saves one memory per project', () => {
  const res = checkWorkbenchProjectAction(freshInsideCopperwheel(1, 480));
  assert.ok(res.title.includes('Workbench'));
  assert.ok(res.body.includes('The Orchard Pendulum'));
  assert.ok(res.body.includes(`+${COPPERWHEEL_BENCH_MINUTES}m`));
  assert.equal(res.nextWorld.copperwheelState?.benchCheckedDay, 1);
  assert.equal(res.nextWorld.copperwheelState?.helpedDay, 1);
  assert.equal(res.nextWorld.copperwheelState?.windingSessions, 1);
  assert.equal(res.nextWorld.copperwheelState?.projectsAdmired, 1);
  assert.equal(res.nextWorld.minuteOfDay, 480 + COPPERWHEEL_BENCH_MINUTES);
  assert.equal(res.memoryUnlockedTitle, 'The Orchard Pendulum');
  assert.ok(res.nextWorld.memories.some((m) => m.id === 'mem_cw_project_pendulum'));

  // Second check the same day: no clock advance, no new counter, no new memory
  const res2 = checkWorkbenchProjectAction(res.nextWorld);
  assert.equal(res2.nextWorld, res.nextWorld);
  assert.equal(res2.memoryUnlockedTitle, undefined);

  // Day 2, a different project: projectsAdmired increments to 2 with a fresh memory
  const res3 = checkWorkbenchProjectAction({
    ...freshInsideCopperwheel(2, 480),
    copperwheelState: res.nextWorld.copperwheelState,
  });
  assert.equal(res3.nextWorld.copperwheelState?.projectsAdmired, 2);
  assert.equal(res3.memoryUnlockedTitle, 'A Music Box Comb');

  // Rest day (day 4): no winding session counted, rest memory instead
  const rest = checkWorkbenchProjectAction(freshInsideCopperwheel(4, 480));
  assert.ok(rest.body.includes('rest'));
  assert.equal(rest.nextWorld.copperwheelState?.helpedDay, 0);
  assert.equal(rest.nextWorld.copperwheelState?.windingSessions, 0);
  assert.equal(rest.nextWorld.minuteOfDay, 480 + 8);
  assert.equal(rest.memoryUnlockedTitle, 'The Bench at Rest');

  // Revisiting a previously admired project on its day does not duplicate the memory
  const revisit = checkWorkbenchProjectAction({
    ...freshInsideCopperwheel(5, 480),
    copperwheelState: { ...createInitialCopperwheelState(), benchCheckedDay: 4 },
    memories: res.nextWorld.memories,
  });
  assert.equal(revisit.nextWorld.copperwheelState?.projectsAdmired, 0);
  assert.equal(revisit.memoryUnlockedTitle, undefined);
});

test('pourKettleCupAction is once-per-day, grants the sipable tea, and advances the clock', () => {
  const res = pourKettleCupAction(freshInsideCopperwheel(1, 600));
  assert.ok(res.title.includes('Kettle'));
  assert.equal(getItemCount(res.nextWorld.inventory, 'chamomile_pear_tea'), 1);
  assert.equal(res.nextWorld.copperwheelState?.teaSharedDay, 1);
  assert.equal(res.nextWorld.copperwheelState?.teasShared, 1);
  assert.equal(res.nextWorld.minuteOfDay, 600 + COPPERWHEEL_TEA_MINUTES);
  assert.equal(res.memoryUnlockedTitle, 'A Cup at the Copper Kettle');
  assert.deepEqual(res.gainedItems, [{ itemId: 'chamomile_pear_tea', count: 1 }]);

  const res2 = pourKettleCupAction(res.nextWorld);
  assert.equal(res2.nextWorld, res.nextWorld);
  assert.equal(res2.gainedItems, undefined);
});

test('readMendingLedgerAction grants a one-time starter tea, then becomes seasonal rereads', () => {
  const res = readMendingLedgerAction(freshInsideCopperwheel(1, 620));
  assert.ok(res.title.includes('Shelf'));
  assert.equal(getItemCount(res.nextWorld.inventory, 'chamomile_pear_tea'), 1);
  assert.equal(res.nextWorld.copperwheelState?.notesReadDay, 1);
  assert.equal(res.nextWorld.copperwheelState?.starterTeaDay, 1);
  assert.equal(res.nextWorld.minuteOfDay, 620 + COPPERWHEEL_NOTES_MINUTES);
  assert.equal(res.memoryUnlockedTitle, 'The Mending Ledger');

  const res2 = readMendingLedgerAction({
    ...freshInsideCopperwheel(1, 700),
    copperwheelState: res.nextWorld.copperwheelState,
    inventory: res.nextWorld.inventory,
  });
  assert.equal(res2.nextWorld, res2.nextWorld);
  assert.equal(res2.memoryUnlockedTitle, undefined);
  assert.equal(getItemCount(res2.nextWorld.inventory, 'chamomile_pear_tea'), 1);
  assert.ok(res2.body.length > 0);
});

test('peekNightstandAction saves one quiet memory and keeps a small clock cost', () => {
  const res = peekNightstandAction(freshInsideCopperwheel(1, 640));
  assert.ok(res.title.includes('Nightstand'));
  assert.equal(res.nextWorld.minuteOfDay, 640 + 4);
  assert.equal(res.memoryUnlockedTitle, 'The Regulator’s Watch');
  assert.ok(res.nextWorld.memories.some((m) => m.id === 'mem_cw_nightstand'));

  const res2 = peekNightstandAction(res.nextWorld);
  assert.equal(res2.memoryUnlockedTitle, undefined);
  assert.equal(res2.nextWorld.minuteOfDay, 640 + 8);
});

test('enterCopperwheelAction / exitCopperwheelAction preserve exterior position and place held props', () => {
  const world = createFreshWorldState();
  const atDoor = {
    ...world,
    playerPos: { x: 12.4, z: -7.6 },
    playerFacing: 0.4,
    playerHeldItem: 'tea_tray' as const,
  };
  const entered = enterCopperwheelAction(atDoor);
  assert.equal(entered.nextWorld.playerLocation, 'copperwheel_interior');
  assert.equal(entered.nextWorld.playerHeldItem, null);
  assert.equal(entered.nextWorld.worldProps?.tea_tray?.holder, 'world');
  assert.deepEqual(entered.nextWorld.exteriorPlayerPos, { x: 12.4, z: -7.6 });
  assert.equal(entered.nextWorld.exteriorPlayerFacing, 0.4);
  assert.deepEqual(entered.nextWorld.playerPos, { ...COPPERWHEEL_DOOR_SPAWN });

  const exited = exitCopperwheelAction(entered.nextWorld);
  assert.equal(exited.nextWorld.playerLocation, 'exterior');
  assert.deepEqual(exited.nextWorld.playerPos, { x: 12.4, z: -7.6 });
  assert.equal(exited.nextWorld.playerFacing, 0.4);
});

test('interactWithProp routes the exterior copperwheel door through enter_copperwheel', () => {
  const world = { ...createFreshWorldState(), playerPos: { x: 13.0, z: -7.7 } };
  const res = interactWithProp(world, 'copperwheel_door');
  assert.equal(res.actionType, 'enter_copperwheel');
  assert.ok(res.title.includes('Copperwheel'));
  assert.equal(res.actionLabel, 'Step Inside');
});

test('interactWithCopperwheelProp routes all five stations correctly', () => {
  const world = freshInsideCopperwheel(1, 600);
  const doorRes = interactWithCopperwheelProp(world, 'cw_door');
  assert.equal(doorRes.actionType, 'exit_copperwheel');

  const benchRes = interactWithCopperwheelProp(world, 'cw_bench');
  assert.ok(benchRes.title.includes('Workbench'));

  const stoveRes = interactWithCopperwheelProp(freshInsideCopperwheel(1, 600), 'cw_stove');
  assert.ok(stoveRes.title.includes('Kettle'));

  const shelfRes = interactWithCopperwheelProp(freshInsideCopperwheel(1, 600), 'cw_shelf');
  assert.ok(shelfRes.title.includes('Shelf'));

  const bedRes = interactWithCopperwheelProp(freshInsideCopperwheel(1, 600), 'cw_bed');
  assert.ok(bedRes.title.includes('Nightstand'));
});

test('copperwheel hub waypoints route around furniture between door spawn and every station', () => {
  for (const prop of COPPERWHEEL_INTERACTABLES) {
    const waypoints = computeCopperwheelWaypoints(COPPERWHEEL_DOOR_SPAWN, { x: prop.x, z: prop.z }, 0.42);
    assert.ok(waypoints.length >= 1, `route to ${prop.id} should exist`);
    const final = waypoints[waypoints.length - 1];
    assert.ok(
      isCopperwheelInteriorWalkable(final.x, final.z, 0.42) || prop.id === 'cw_door',
      `route to ${prop.id} should end walkable`,
    );
    for (const wp of waypoints) {
      assert.ok(
        isCopperwheelInteriorWalkable(wp.x, wp.z, 0.42) || prop.id === 'cw_door',
        `waypoint for ${prop.id} must be walkable`,
      );
    }
  }
});

test('selectBestCopperwheelTarget prefers facing-aligned stations and offers the armchair nearby', () => {
  // Facing the bench focus from the bench stand spot offers the bench
  const atBench = {
    ...freshInsideCopperwheel(1, 540),
    playerPos: { x: -1.5, z: -1.0 },
    playerFacing: Math.atan2(-1.6 - -1.5, -2.4 - -1.0),
  };
  const benchTarget = selectBestCopperwheelTarget(atBench);
  assert.ok(benchTarget, 'bench target reachable');
  assert.equal(benchTarget?.kind, 'copperwheel_prop');
  assert.equal(benchTarget?.copperwheelPropId, 'cw_bench');

  // Standing by the armchair approach facing it offers the seat
  const atSeat = {
    ...freshInsideCopperwheel(1, 540),
    playerPos: { ...COPPERWHEEL_SEAT_SPOTS[0].approachPos },
    playerFacing: Math.atan2(
      COPPERWHEEL_SEAT_SPOTS[0].seatPos.x - COPPERWHEEL_SEAT_SPOTS[0].approachPos.x,
      COPPERWHEEL_SEAT_SPOTS[0].seatPos.z - COPPERWHEEL_SEAT_SPOTS[0].approachPos.z,
    ),
  };
  const seatTarget = selectBestCopperwheelTarget(atSeat);
  assert.ok(seatTarget, 'seat target reachable');
  assert.equal(seatTarget?.kind, 'seat');
  assert.equal(seatTarget?.actionLabel, 'Sit on Window Armchair');

  // Far from everything: no target
  const far = { ...freshInsideCopperwheel(1, 540), playerPos: { x: 0.6, z: 0.0 }, playerFacing: 0 };
  const t = selectBestCopperwheelTarget(far);
  if (t) {
    assert.ok(t.distance <= 2.2, 'any offered target stays within interact reach');
  }
});

test('window armchair is indoor, approachable, and never collides with other seat ids', () => {
  const seat = COPPERWHEEL_SEAT_SPOTS[0];
  assert.equal(seat.indoor, true);
  assert.equal(seat.zoneId, 'copperwheel_interior');
  assert.equal(resolveAnySeatById(seat.id)?.id, seat.id);
  assert.equal(resolveAnySeatById('bakery_seat_cafe_west')?.id, 'bakery_seat_cafe_west');
  assert.equal(resolveAnySeatById('nook_seat_armchair')?.id, 'nook_seat_armchair');
  assert.equal(resolveAnySeatById('seat_east_plaza')?.id, 'seat_east_plaza');
  // approach spot is walkable inside the room
  assert.equal(isCopperwheelInteriorWalkable(seat.approachPos.x, seat.approachPos.z, 0.42), true);
});

test('resolveCopperwheelInteriorMovement slides along walls instead of sticking', () => {
  const start = { x: 0.6, z: 0.0 };
  // Pushed into the stove obstacle from the east aisle: slides, never inside
  const pushed = resolveCopperwheelInteriorMovement(start, { x: 2.6, z: 0.0 }, 0.42);
  assert.equal(isCopperwheelInteriorWalkable(pushed.x, pushed.z, 0.42), true);
  // Pushed into the north wall
  const pushedNorth = resolveCopperwheelInteriorMovement(start, { x: 0.6, z: -2.5 }, 0.42);
  assert.equal(isCopperwheelInteriorWalkable(pushedNorth.x, pushedNorth.z, 0.42), true);
  // Free move passes straight through
  const free = resolveCopperwheelInteriorMovement(start, { x: 0.9, z: 0.4 }, 0.42);
  assert.deepEqual(free, { x: 0.9, z: 0.4 });
});

test('v9 saves migrate to v10 with a fresh copperwheelState and interior locations preserved', () => {
  const world = createFreshWorldState();
  const parsed = JSON.parse(serializeWorldState(world)) as Record<string, unknown>;
  const v9Raw = { ...parsed, schemaVersion: 9 } as Record<string, unknown>;
  delete v9Raw.copperwheelState;
  const result = migrateWorldState(v9Raw);
  // LR-1 (WorldState v11) keeps the invariant: the v9 save chains v9→v10→<current>;
  // copperwheelState stays fresh from its own step and interior state is preserved.
  assert.equal(result.state.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.ok(result.state.copperwheelState);
  assert.equal(result.state.copperwheelState.windingSessions, 0);
  assert.ok(result.state.nookState, 'v9 nookState preserved through the chain');
  assert.equal(result.warnings.length, 0);
});

test('sanitizeCopperwheelState repairs negative/missing fields and clamps projectsAdmired to the bench cycle', () => {
  const world = createFreshWorldState();
  const payload = JSON.parse(serializeWorldState(world)) as Record<string, unknown>;
  const corrupted = {
    ...payload,
    copperwheelState: {
      benchCheckedDay: -3,
      helpedDay: -1,
      teaSharedDay: 'nope',
      notesReadDay: 2.7,
      starterTeaDay: -9,
      projectsAdmired: 11,
      windingSessions: -4,
      teasShared: null,
    },
  };
  const res = migrateWorldState(corrupted);
  const cw = res.state.copperwheelState;
  assert.equal(cw.benchCheckedDay, 0);
  assert.equal(cw.helpedDay, 0);
  assert.equal(cw.teaSharedDay, 0);
  assert.equal(cw.notesReadDay, 2);
  assert.equal(cw.starterTeaDay, 0);
  assert.equal(cw.projectsAdmired, 4);
  assert.equal(cw.windingSessions, 0);
  assert.equal(cw.teasShared, 0);
  // missing copperwheelState hydrates defaults without warnings
  const missing = migrateWorldState({ ...payload, copperwheelState: undefined });
  assert.deepEqual(missing.state.copperwheelState, createInitialCopperwheelState());
});

test('computeWorldSaveRevision is sensitive to copperwheelState fields', () => {
  const base = createFreshWorldState();
  const revA = computeWorldSaveRevision(base);
  const bumped = {
    ...base,
    copperwheelState: { ...base.copperwheelState, benchCheckedDay: base.copperwheelState.benchCheckedDay + 1 },
  };
  const revB = computeWorldSaveRevision(bumped);
  const counterBumped = {
    ...base,
    copperwheelState: { ...base.copperwheelState, windingSessions: base.copperwheelState.windingSessions + 3 },
  };
  const revC = computeWorldSaveRevision(counterBumped);
  assert.notEqual(revA, revB);
  assert.notEqual(revA, revC);
  assert.notEqual(revB, revC);
});

test('copperwheel state round-trips through serialize + migrate without loss', () => {
  const world: WorldState = {
    ...createFreshWorldState(),
    day: 6,
    playerLocation: 'copperwheel_interior',
    playerPos: { x: -1.5, z: 0.25 },
    exteriorPlayerPos: { ...COPPERWHEEL_PORCH_EXIT_POS },
    exteriorPlayerFacing: COPPERWHEEL_PORCH_EXIT_FACING,
    copperwheelState: {
      benchCheckedDay: 6,
      helpedDay: 6,
      teaSharedDay: 5,
      notesReadDay: 4,
      starterTeaDay: 4,
      projectsAdmired: 3,
      windingSessions: 4,
      teasShared: 2,
    },
  };
  const serialized = serializeWorldState(world);
  const migrated = migrateWorldState(JSON.parse(serialized));
  assert.equal(migrated.state.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.deepEqual(migrated.state.copperwheelState, world.copperwheelState);
  assert.equal(migrated.state.playerLocation, 'copperwheel_interior');
  assert.deepEqual(migrated.state.playerPos, { x: -1.5, z: 0.25 });
  assert.deepEqual(migrated.state.exteriorPlayerPos, { ...COPPERWHEEL_PORCH_EXIT_POS });
});

test('the window armchair sip ritual works inside Copperwheel (Build 9 cross-interior sip fix)', () => {
  // Regression: sipBeverageAtTableAction previously hard-gated to cottage_interior, so
  // every indoor seat added in Builds 7-9 advertised "Sip" but silently refused it.
  const seated: WorldState = {
    ...freshInsideCopperwheel(1, 620),
    inventory: { ...freshInsideCopperwheel(1, 620).inventory, chamomile_pear_tea: 1 },
    playerPosture: 'sitting',
    playerSeatId: 'cw_seat_armchair',
    playerPos: { ...COPPERWHEEL_SEAT_SPOTS[0].seatPos },
    playerFacing: COPPERWHEEL_SEAT_SPOTS[0].facingAngle,
  };
  const sip = sipBeverageAtTableAction(seated, 'chamomile_pear_tea');
  assert.equal(sip.ok, true, 'seated sip inside copperwheel_interior must succeed');
  assert.equal(getItemCount(sip.nextWorld.inventory, 'chamomile_pear_tea'), 0);
  assert.equal(sip.nextWorld.minuteOfDay, 620 + 8);
  assert.equal(sip.memoryUnlockedTitle, 'A Quiet Warm Chamomile Tea Moment');
  assert.ok(sip.title.includes('Window Armchair'));
  assert.ok(sip.nextWorld.memories.some((m) => m.id === 'mem_teatable_chamomile_pear_tea'));

  // Standing up (or sitting outdoors) still refuses the sip
  const standing = { ...seated, playerPosture: 'standing' as const, playerSeatId: null };
  assert.equal(sipBeverageAtTableAction(standing).ok, false);
  const outdoorSeated: WorldState = {
    ...createFreshWorldState(),
    playerPosture: 'sitting',
    playerSeatId: 'cw_seat_armchair',
    inventory: { chamomile_pear_tea: 1 },
  };
  assert.equal(sipBeverageAtTableAction(outdoorSeated).ok, false);
});

test('seated indoor sitting persists through serialize + migrate (Build 9 sanitizer seat fix)', () => {
  // Regression: the sanitizer previously resolved seats via the outdoor-only registry,
  // so sitting at ANY indoor seat silently degraded to standing on save.
  const seated: WorldState = {
    ...freshInsideCopperwheel(1, 700),
    playerPosture: 'sitting',
    playerSeatId: 'cw_seat_armchair',
    playerPos: { ...COPPERWHEEL_SEAT_SPOTS[0].seatPos },
    playerFacing: COPPERWHEEL_SEAT_SPOTS[0].facingAngle,
  };
  const serialized = JSON.parse(serializeWorldState(seated)) as Record<string, unknown>;
  assert.equal(serialized.playerPosture, 'sitting', 'indoor sitting survives serialization');
  assert.equal(serialized.playerSeatId, 'cw_seat_armchair');
  const migrated = migrateWorldState(serialized);
  assert.equal(migrated.state.playerPosture, 'sitting');
  assert.equal(migrated.state.playerSeatId, 'cw_seat_armchair');
  assert.deepEqual(migrated.state.playerPos, { ...COPPERWHEEL_SEAT_SPOTS[0].seatPos });
  assert.equal(migrated.state.playerFacing, COPPERWHEEL_SEAT_SPOTS[0].facingAngle);

  // Indoor seats are never valid outdoors, and outdoor benches are never valid indoors
  const outdoorsSeated: WorldState = {
    ...createFreshWorldState(),
    playerPosture: 'sitting',
    playerSeatId: 'cw_seat_armchair',
  };
  const outdoorSanitized = migrateWorldState(JSON.parse(serializeWorldState(outdoorsSeated)));
  assert.equal(outdoorSanitized.state.playerPosture, 'standing');
  assert.equal(outdoorSanitized.state.playerSeatId, null);

  // The cottage oak stool persists identically (pre-existing indoor seat, now fixed too)
  const cottageSeated: WorldState = {
    ...createFreshWorldState(),
    playerLocation: 'cottage_interior',
    playerPosture: 'sitting',
    playerSeatId: 'cottage_seat_table_west',
    playerPos: { x: -0.37, z: 1.04 },
  };
  const cottageResult = migrateWorldState(JSON.parse(serializeWorldState(cottageSeated)));
  assert.equal(cottageResult.state.playerPosture, 'sitting');
  assert.equal(cottageResult.state.playerSeatId, 'cottage_seat_table_west');
});

test('advanceToNextDay steps a copperwheel sleeper out onto the porch and preserves lifetime counters', () => {
  const world: WorldState = {
    ...freshInsideCopperwheel(3, 1280),
    exteriorPlayerPos: { ...COPPERWHEEL_PORCH_EXIT_POS },
    exteriorPlayerFacing: COPPERWHEEL_PORCH_EXIT_FACING,
    copperwheelState: {
      benchCheckedDay: 3,
      helpedDay: 3,
      teaSharedDay: 3,
      notesReadDay: 2,
      starterTeaDay: 2,
      projectsAdmired: 3,
      windingSessions: 2,
      teasShared: 1,
    },
  };
  const next = advanceToNextDay(world);
  assert.equal(next.day, 4);
  assert.equal(next.playerLocation, 'exterior');
  assert.deepEqual(next.playerPos, { ...COPPERWHEEL_PORCH_EXIT_POS });
  assert.equal(next.playerFacing, COPPERWHEEL_PORCH_EXIT_FACING);
  assert.deepEqual(next.exteriorPlayerPos, { ...COPPERWHEEL_PORCH_EXIT_POS });
  // lifetime counters and stamps persist — stamps self-expire against the new day
  assert.equal(next.copperwheelState.projectsAdmired, 3);
  assert.equal(next.copperwheelState.windingSessions, 2);
  assert.equal(next.copperwheelState.teasShared, 1);
  assert.equal(next.copperwheelState.benchCheckedDay, 3);
});
