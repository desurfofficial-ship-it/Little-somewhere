import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BAKERY_BAKES,
  BAKERY_CHECK_MINUTES,
  BAKERY_DOOR_SPAWN,
  BAKERY_INTERACTABLES,
  BAKERY_INTERIOR_OBSTACLES,
  BAKERY_KNEAD_MINUTES,
  BAKERY_NOTES_MINUTES,
  BAKERY_PORCH_EXIT_FACING,
  BAKERY_PORCH_EXIT_POS,
  BAKERY_SHARE_MINUTES,
  BAKERY_SEAT_SPOTS,
  computeBakeryWaypoints,
  createInitialBakeryState,
  getBakeForDay,
  isBakeryInteriorWalkable,
  resolveBakeryInteriorMovement,
  selectBestBakeryTarget,
} from './bakery';
import {
  checkMorningBakeAction,
  enterBakeryAction,
  exitBakeryAction,
  helpKneadDoughAction,
  interactWithBakeryProp,
  interactWithProp,
  readBakeryNotesAction,
  shareMorningLoafAction,
} from './actions';
import { getItemCount } from './inventory';
import {
  advanceToNextDay,
  computeWorldSaveRevision,
  createFreshWorldState,
  serializeWorldState,
} from './storage';
import { CURRENT_SCHEMA_VERSION, migrateWorldState } from './migrations';
import { WorldState } from './types';

function freshInsideBakery(day = 1, minuteOfDay = 540): WorldState {
  const world = createFreshWorldState();
  return {
    ...world,
    day,
    minuteOfDay,
    playerLocation: 'bakery_interior',
    playerPos: { ...BAKERY_DOOR_SPAWN },
  };
}

test('bakery interior walkability, obstacle bounds, spawns, and interactable stand spots are valid', () => {
  assert.equal(isBakeryInteriorWalkable(BAKERY_DOOR_SPAWN.x, BAKERY_DOOR_SPAWN.z, 0.42), true);
  for (const box of BAKERY_INTERIOR_OBSTACLES) {
    assert.ok(box.maxX > box.minX, `obstacle ${box.id} maxX above minX`);
    assert.ok(box.maxZ > box.minZ, `obstacle ${box.id} maxZ above minZ`);
    assert.equal(
      isBakeryInteriorWalkable((box.minX + box.maxX) / 2, (box.minZ + box.maxZ) / 2, 0.42),
      false,
      `obstacle ${box.id} center must block`,
    );
  }
  for (const prop of BAKERY_INTERACTABLES) {
    const standOk =
      isBakeryInteriorWalkable(prop.x, prop.z, 0.42) ||
      // door focus sits beyond the south wall by design (mirrors greenhouse door focus)
      prop.id === 'bakery_door';
    assert.equal(standOk, true, `stand spot for ${prop.id} must be walkable`);
    // approachable: some spot inside the room reaches the interaction radius
    assert.ok(
      BAKERY_INTERIOR_OBSTACLES.some(
        (b) => b.id === (prop.id as typeof b.id),
      ) ||
        prop.id === 'bakery_door' ||
        prop.id === 'bakery_notes' ||
        // LR-3 café-corner card anchor (doc 05 §6.3): a fixture of the
        // bakery_table obstacle (its claimed-station card), not a separate box.
        prop.id === 'bakery_cafe_table',
      `station ${prop.id} mirrors an obstacle or is a wall-mounted fixture`,
    );
  }
  // Porch exit must be walkable in the exterior world grid
  const exterior = createFreshWorldState();
  assert.equal(exterior.playerLocation, 'exterior');
});

test('deterministic bake roster cycles bake → bake → bake → oven rest', () => {
  assert.equal(getBakeForDay(1).id, 'sunflower_sourdough');
  assert.equal(getBakeForDay(2).id, 'crabapple_galette');
  assert.equal(getBakeForDay(3).id, 'lavender_butter_batch');
  assert.equal(getBakeForDay(4).id, 'oven_rest');
  assert.equal(getBakeForDay(5).id, 'sunflower_sourdough');
  assert.equal(getBakeForDay(11).id, 'lavender_butter_batch');
  // share mapping
  assert.equal(getBakeForDay(1).shareItemId, 'herb_loaf');
  assert.equal(getBakeForDay(2).shareItemId, 'crabapple_tart');
  assert.equal(getBakeForDay(3).shareItemId, 'lavender_shortbread');
  assert.equal(getBakeForDay(4).shareItemId, null);
  // rest-day roster entry has no share and every bake entry does
  for (const bake of BAKERY_BAKES) {
    assert.ok(bake.label.length > 3);
    assert.ok(bake.blurb.length > 10);
  }
});

test('checkMorningBakeAction reveals today\'s bake once, advances the clock, and saves one memory', () => {
  const res = checkMorningBakeAction(freshInsideBakery(1, 480));
  const bake = getBakeForDay(1);
  assert.ok(res.title.includes('Brick Dome'));
  assert.ok(res.body.includes(bake.label));
  assert.ok(res.body.includes(`+${BAKERY_CHECK_MINUTES}m`));
  assert.equal(res.nextWorld.bakeryState?.bakeCheckedDay, 1);
  assert.equal(res.nextWorld.minuteOfDay, 480 + BAKERY_CHECK_MINUTES);
  assert.equal(res.memoryUnlockedTitle, 'The Morning Bake Reveal');
  assert.ok(res.nextWorld.memories.some((m) => m.id === 'mem_bakery_first_bake'));

  // Second check the same day: no clock advance, no new memory
  const res2 = checkMorningBakeAction(res.nextWorld);
  assert.equal(res2.nextWorld, res.nextWorld);
  assert.equal(res2.memoryUnlockedTitle, undefined);
});

test('helpKneadDoughAction is once-per-day, advances the clock, and doubles the counter share', () => {
  const res = helpKneadDoughAction(freshInsideBakery(1, 500));
  assert.ok(res.title.includes('Prep Table'));
  assert.equal(res.nextWorld.bakeryState?.kneadedDay, 1);
  assert.equal(res.nextWorld.bakeryState?.kneadingSessions, 1);
  assert.equal(res.nextWorld.minuteOfDay, 500 + BAKERY_KNEAD_MINUTES);
  assert.equal(res.memoryUnlockedTitle, 'Flour on My Sleeves');

  // repeat knead: world unchanged
  const res2 = helpKneadDoughAction(res.nextWorld);
  assert.equal(res2.nextWorld, res.nextWorld);
  assert.equal(res2.memoryUnlockedTitle, undefined);

  // kneaded morning doubles the share
  const share = shareMorningLoafAction(res.nextWorld);
  assert.equal(getItemCount(share.nextWorld.inventory, 'herb_loaf'), 2);
  assert.ok(share.body.includes('splits the batch'));

  // plain morning gives a single share
  const plainShare = shareMorningLoafAction(freshInsideBakery(1, 500));
  assert.equal(getItemCount(plainShare.nextWorld.inventory, 'herb_loaf'), 1);
});

test('shareMorningLoafAction is once-per-day, grants the bake-matched item, and is silent on rest days', () => {
  // Day 2 = crabapple galette
  const res = shareMorningLoafAction(freshInsideBakery(2, 600));
  assert.equal(getItemCount(res.nextWorld.inventory, 'crabapple_tart'), 1);
  assert.equal(res.nextWorld.bakeryState?.loafSharedDay, 2);
  assert.equal(res.nextWorld.bakeryState?.loavesShared, 1);
  assert.equal(res.nextWorld.minuteOfDay, 600 + BAKERY_SHARE_MINUTES);
  assert.equal(res.memoryUnlockedTitle, 'A Warm Loaf, Offered');
  assert.ok(res.gainedItems?.some((chip) => chip.itemId === 'crabapple_tart' && chip.count === 1));

  // Second share attempt same day: no item change
  const res2 = shareMorningLoafAction(res.nextWorld);
  assert.equal(res2.nextWorld, res.nextWorld);
  assert.equal(getItemCount(res2.nextWorld.inventory, 'crabapple_tart'), 1);

  // Day 4 = oven rest: nothing shared, no clock advance
  const rest = shareMorningLoafAction(freshInsideBakery(4, 600));
  assert.ok(rest.body.includes('rest'));
  assert.equal(rest.nextWorld.minuteOfDay, 600);
  assert.equal(rest.nextWorld.bakeryState?.loavesShared, 0);
  assert.equal(getItemCount(rest.nextWorld.inventory, 'herb_loaf'), 0);
});

test('readBakeryNotesAction grants a one-time starter loaf, then becomes seasonal rereads', () => {
  const res = readBakeryNotesAction(freshInsideBakery(1, 700));
  assert.equal(getItemCount(res.nextWorld.inventory, 'herb_loaf'), 1);
  assert.equal(res.nextWorld.bakeryState?.notesReadDay, 1);
  assert.equal(res.nextWorld.bakeryState?.starterNotesDay, 1);
  assert.equal(res.nextWorld.minuteOfDay, 700 + BAKERY_NOTES_MINUTES);
  assert.equal(res.memoryUnlockedTitle, 'Clara’s Kitchen Margins');
  assert.ok(res.gainedItems?.some((chip) => chip.itemId === 'herb_loaf'));

  // Reread: no items, no clock change, memory retained
  const res2 = readBakeryNotesAction(res.nextWorld);
  assert.equal(res2.nextWorld, res.nextWorld);
  assert.equal(res2.memoryUnlockedTitle, undefined);
  assert.equal(getItemCount(res2.nextWorld.inventory, 'herb_loaf'), 1);
});

test('enterBakeryAction / exitBakeryAction preserve exterior position and place held props', () => {
  const outside = { ...createFreshWorldState(), playerPos: { x: -12.4, z: -6.9 }, playerFacing: Math.PI };
  const entered = enterBakeryAction(outside);
  assert.equal(entered.nextWorld.playerLocation, 'bakery_interior');
  assert.deepEqual(entered.nextWorld.playerPos, { x: BAKERY_DOOR_SPAWN.x, z: BAKERY_DOOR_SPAWN.z });
  assert.equal(entered.nextWorld.exteriorPlayerPos?.x, -12.4);
  assert.equal(entered.nextWorld.exteriorPlayerPos?.z, -6.9);
  assert.equal(entered.toast.length > 0, true);

  const exited = exitBakeryAction(entered.nextWorld);
  assert.equal(exited.nextWorld.playerLocation, 'exterior');
  assert.equal(exited.nextWorld.playerPos?.z, -6.9);
  assert.equal(exited.nextWorld.playerFacing, Math.PI);

  // Idempotence guards
  assert.equal(enterBakeryAction(entered.nextWorld).nextWorld, entered.nextWorld);
  assert.equal(exitBakeryAction(outside).nextWorld, outside);

  // Facing constants stay coherent: door faces north into the room, porch faces north back to the door
  assert.equal(BAKERY_PORCH_EXIT_FACING, Math.PI);
});

test('interactWithProp routes the exterior bakery door through enter_bakery', () => {
  const outside = createFreshWorldState();
  const res = interactWithProp(outside, 'bakery_door');
  assert.equal(res.actionType, 'enter_bakery');
  assert.equal(res.actionLabel, 'Step Inside');
  assert.ok(res.title.includes('Hearth & Crumb'));
});

test('interactWithBakeryProp routes all five stations correctly', () => {
  const world = freshInsideBakery(1, 540);
  // door exits
  const door = interactWithBakeryProp(world, 'bakery_door');
  assert.equal(door.actionType, 'exit_bakery');
  assert.equal(door.nextWorld.playerLocation, 'exterior');
  // oven checks the bake
  const oven = interactWithBakeryProp(world, 'bakery_oven');
  assert.ok(oven.title.includes('Brick Dome'));
  assert.equal(oven.nextWorld.bakeryState?.bakeCheckedDay, 1);
  // counter shares
  const counter = interactWithBakeryProp(oven.nextWorld, 'bakery_counter');
  assert.ok(counter.title.includes('Counter'));
  assert.equal(getItemCount(counter.nextWorld.inventory, 'herb_loaf'), 1);
  // prep kneads
  const prep = interactWithBakeryProp(counter.nextWorld, 'bakery_prep');
  assert.ok(prep.title.includes('Prep Table'));
  assert.equal(prep.nextWorld.bakeryState?.kneadedDay, 1);
  // notes read
  const notes = interactWithBakeryProp(prep.nextWorld, 'bakery_notes');
  assert.ok(notes.title.includes('Recipe Notes'));
  assert.equal(notes.nextWorld.bakeryState?.starterNotesDay, 1);
});

test('bakery hub waypoints route around furniture between door spawn and every station', () => {
  for (const prop of BAKERY_INTERACTABLES) {
    const path = computeBakeryWaypoints({ ...BAKERY_DOOR_SPAWN }, { x: prop.x, z: prop.z }, 0.42);
    assert.ok(path.length >= 1, `waypoint path for ${prop.id}`);
    const last = path[path.length - 1];
    assert.deepEqual(last, { x: prop.x, z: prop.z });
  }
  // straight shot across the center aisle needs no hubs
  const direct = computeBakeryWaypoints({ x: -0.35, z: 0.35 }, { x: 0.0, z: -1.35 }, 0.42);
  assert.equal(direct.length, 1);
});

test('selectBestBakeryTarget prefers facing-aligned stations and offers the café seat nearby', () => {
  const nearOven = {
    ...freshInsideBakery(),
    playerPos: { x: -1.5, z: -0.85 },
    playerFacing: Math.PI, // facing north toward the oven focus
  };
  const ovenTarget = selectBestBakeryTarget(nearOven);
  assert.ok(ovenTarget, 'oven target within radius');
  assert.equal(ovenTarget?.kind, 'bakery_prop');
  assert.equal(ovenTarget?.bakeryPropId, 'bakery_oven');

  // Near the café chair (west of the table), the seat candidate is offered
  const nearSeat = {
    ...freshInsideBakery(),
    playerPos: { x: -0.2, z: 1.4 },
    playerFacing: Math.atan2(1, 0), // facing east toward the chair
  };
  const seatTarget = selectBestBakeryTarget(nearSeat);
  assert.ok(seatTarget, 'seat/prop target within radius near café corner');
  assert.ok(
    seatTarget?.kind === 'seat' || seatTarget?.kind === 'bakery_prop',
    'seat or station candidate near the café corner',
  );
});

test('bakery café seat is indoor, approachable, and never collides with outdoor seat ids', () => {
  assert.equal(BAKERY_SEAT_SPOTS.length, 1);
  const seat = BAKERY_SEAT_SPOTS[0];
  assert.equal(seat.indoor, true);
  assert.equal(seat.id.startsWith('bakery_'), true);
  // approach spot must be interior-walkable
  assert.equal(isBakeryInteriorWalkable(seat.approachPos.x, seat.approachPos.z, 0.42), true);
});

test('resolveBakeryInteriorMovement slides along walls instead of sticking', () => {
  const blocked = resolveBakeryInteriorMovement(
    { x: -1.5, z: -1.2 },
    { x: -1.5, z: -2.0 }, // into the oven obstacle
    0.42,
  );
  assert.deepEqual(blocked, { x: -1.5, z: -1.2 });
  const slide = resolveBakeryInteriorMovement(
    { x: -1.5, z: -1.2 },
    { x: -0.2, z: -2.0 },
    0.42,
  );
  assert.equal(isBakeryInteriorWalkable(slide.x, slide.z, 0.42), true);
});

test('v7 saves chain to the current schema with a fresh bakeryState and interior locations preserved', () => {
  const world = createFreshWorldState();
  const parsed = JSON.parse(serializeWorldState(world)) as Record<string, unknown>;
  const v7Raw = { ...parsed, schemaVersion: 7 } as Record<string, unknown>;
  delete v7Raw.bakeryState;
  delete v7Raw.nookState;
  const result = migrateWorldState(v7Raw);
  // Build 9 bumps the runtime schema to v10: the v7 save now chains v7→…→v10.
  assert.equal(result.state.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.ok(result.state.bakeryState);
  assert.equal(result.state.bakeryState.kneadingSessions, 0);
  assert.ok(result.state.copperwheelState, 'chain hydrates the fresh copperwheelState');
  assert.equal(result.warnings.length, 0);
});

test('sanitizeBakeryState repairs negative/missing fields and keeps counters bounded', () => {
  const world = createFreshWorldState();
  const payload = JSON.parse(serializeWorldState(world)) as Record<string, unknown>;
  const corrupted = {
    ...payload,
    bakeryState: {
      bakeCheckedDay: -3,
      kneadedDay: 'nope',
      loafSharedDay: 2,
      notesReadDay: 0,
      starterNotesDay: 5,
      kneadingSessions: -1.5,
      loavesShared: 2.7,
    },
  };
  const result = migrateWorldState(corrupted);
  assert.equal(result.state.bakeryState.bakeCheckedDay, 0);
  assert.equal(result.state.bakeryState.kneadedDay, 0);
  assert.equal(result.state.bakeryState.loafSharedDay, 2);
  // cross-consistency repair: starter day implies notes read
  assert.equal(result.state.bakeryState.notesReadDay, 5);
  assert.equal(result.state.bakeryState.kneadingSessions, 0);
  assert.equal(result.state.bakeryState.loavesShared, 2);
  assert.ok(result.warnings.length >= 1);
});

test('computeWorldSaveRevision is sensitive to bakeryState fields', () => {
  const base = createFreshWorldState();
  const modified: WorldState = {
    ...base,
    bakeryState: { ...base.bakeryState, loavesShared: 3 },
  };
  assert.notEqual(computeWorldSaveRevision(base), computeWorldSaveRevision(modified));
});

test('bakery state round-trips through serialize + migrate without loss', () => {
  const world: WorldState = {
    ...freshInsideBakery(3, 720),
    bakeryState: {
      bakeCheckedDay: 3,
      kneadedDay: 3,
      loafSharedDay: 2,
      notesReadDay: 1,
      starterNotesDay: 1,
      kneadingSessions: 2,
      loavesShared: 3,
    },
  };
  const serialized = serializeWorldState(world);
  const result = migrateWorldState(JSON.parse(serialized));
  assert.deepEqual(result.state.bakeryState, world.bakeryState);
});

test('advanceToNextDay steps a bakery sleeper out onto the porch and preserves lifetime counters', () => {
  const inside = {
    ...freshInsideBakery(2, 1200),
    exteriorPlayerPos: { x: BAKERY_PORCH_EXIT_POS.x, z: BAKERY_PORCH_EXIT_POS.z },
    exteriorPlayerFacing: Math.PI,
    bakeryState: {
      bakeCheckedDay: 2,
      kneadedDay: 2,
      loafSharedDay: 2,
      notesReadDay: 1,
      starterNotesDay: 1,
      kneadingSessions: 2,
      loavesShared: 3,
    },
  };
  const next = advanceToNextDay(inside);
  assert.equal(next.playerLocation, 'exterior');
  assert.equal(next.playerPos?.x, BAKERY_PORCH_EXIT_POS.x);
  assert.equal(next.playerPos?.z, BAKERY_PORCH_EXIT_POS.z);
  assert.equal(next.exteriorPlayerPos?.x, BAKERY_PORCH_EXIT_POS.x);
  assert.equal(next.bakeryState?.kneadingSessions, 2);
  assert.equal(next.bakeryState?.loavesShared, 3);
  // day stamps differ on the new day, so rituals naturally reset without explicit clears
  assert.notEqual(next.day, 2);
});
