import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOOK_BROWSE_MINUTES,
  NOOK_BOOKS,
  NOOK_DOOR_SPAWN,
  NOOK_INTERACTABLES,
  NOOK_INTERIOR_OBSTACLES,
  NOOK_NOTES_MINUTES,
  NOOK_PORCH_EXIT_FACING,
  NOOK_PORCH_EXIT_POS,
  NOOK_SEAT_SPOTS,
  NOOK_TEA_MINUTES,
  computeNookWaypoints,
  createInitialNookState,
  getFeaturedBookForDay,
  isNookInteriorWalkable,
  resolveNookInteriorMovement,
  selectBestNookTarget,
} from './bookNook';
import {
  browseBookshelfAction,
  enterNookAction,
  exitNookAction,
  interactWithNookProp,
  interactWithProp,
  pourReaderCupAction,
  readLendingNotesAction,
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

function freshInsideNook(day = 1, minuteOfDay = 540): WorldState {
  const world = createFreshWorldState();
  return {
    ...world,
    day,
    minuteOfDay,
    playerLocation: 'nook_interior',
    playerPos: { ...NOOK_DOOR_SPAWN },
  };
}

test('book nook interior walkability, obstacle bounds, spawns, and interactable stand spots are valid', () => {
  assert.equal(isNookInteriorWalkable(NOOK_DOOR_SPAWN.x, NOOK_DOOR_SPAWN.z, 0.42), true);
  for (const box of NOOK_INTERIOR_OBSTACLES) {
    assert.ok(box.maxX > box.minX, `obstacle ${box.id} maxX above minX`);
    assert.ok(box.maxZ > box.minZ, `obstacle ${box.id} maxZ above minZ`);
    assert.equal(
      isNookInteriorWalkable((box.minX + box.maxX) / 2, (box.minZ + box.maxZ) / 2, 0.42),
      false,
      `obstacle ${box.id} center must block`,
    );
  }
  for (const prop of NOOK_INTERACTABLES) {
    const standOk =
      isNookInteriorWalkable(prop.x, prop.z, 0.42) ||
      // door focus sits beyond the east wall by design (mirrors the other interior doors)
      prop.id === 'nook_door';
    assert.equal(standOk, true, `stand spot for ${prop.id} must be walkable`);
  }
});

test('deterministic featured-book cycle rotates one book per day', () => {
  assert.equal(getFeaturedBookForDay(1).id, 'ivy_letters');
  assert.equal(getFeaturedBookForDay(2).id, 'pond_sketches');
  assert.equal(getFeaturedBookForDay(3).id, 'bread_hymns');
  assert.equal(getFeaturedBookForDay(4).id, 'night_orchard');
  assert.equal(getFeaturedBookForDay(5).id, 'ivy_letters');
  assert.equal(getFeaturedBookForDay(8).id, 'night_orchard');
  // every book carries its own first-read memory identity
  const memoryIds = new Set(NOOK_BOOKS.map((b) => b.memoryId));
  assert.equal(memoryIds.size, 4);
});

test('browseBookshelfAction reveals the featured book once per day and saves one memory per book', () => {
  const res = browseBookshelfAction(freshInsideNook(1, 480));
  assert.ok(res.title.includes('Bookshelf'));
  assert.ok(res.body.includes('The Ivy Letters'));
  assert.ok(res.body.includes(`+${NOOK_BROWSE_MINUTES}m`));
  assert.equal(res.nextWorld.nookState?.shelfBrowsedDay, 1);
  assert.equal(res.nextWorld.nookState?.booksRead, 1);
  assert.equal(res.nextWorld.minuteOfDay, 480 + NOOK_BROWSE_MINUTES);
  assert.equal(res.memoryUnlockedTitle, 'The Ivy Letters');
  assert.ok(res.nextWorld.memories.some((m) => m.id === 'mem_book_ivy_letters'));

  // Second browse the same day: no clock advance, no new counter, no new memory
  const res2 = browseBookshelfAction(res.nextWorld);
  assert.equal(res2.nextWorld, res.nextWorld);
  assert.equal(res2.memoryUnlockedTitle, undefined);

  // Day 2, a different book: booksRead increments to 2 with a fresh memory
  const res3 = browseBookshelfAction({ ...freshInsideNook(2, 480), nookState: res.nextWorld.nookState });
  assert.equal(res3.nextWorld.nookState?.booksRead, 2);
  assert.equal(res3.memoryUnlockedTitle, 'Sketches of Mirror Pond');

  // Rereading the day-1 book on day 5: no duplicate memory, counter stays capped
  const revisit = browseBookshelfAction({
    ...freshInsideNook(5, 480),
    nookState: { ...res.nextWorld.nookState, shelfBrowsedDay: 4 },
    memories: res.nextWorld.memories,
  });
  assert.equal(revisit.nextWorld.nookState?.booksRead, 1);
  assert.equal(revisit.memoryUnlockedTitle, undefined);
});

test('pourReaderCupAction is once-per-day, grants the sipable tea, and advances the clock', () => {
  const res = pourReaderCupAction(freshInsideNook(1, 600));
  assert.ok(res.title.includes('Tea Tray'));
  assert.equal(getItemCount(res.nextWorld.inventory, 'chamomile_pear_tea'), 1);
  assert.equal(res.nextWorld.nookState?.teaSharedDay, 1);
  assert.equal(res.nextWorld.nookState?.teasShared, 1);
  assert.equal(res.nextWorld.minuteOfDay, 600 + NOOK_TEA_MINUTES);
  assert.equal(res.memoryUnlockedTitle, 'A Reader’s Cup');
  assert.ok(res.gainedItems?.some((chip) => chip.itemId === 'chamomile_pear_tea'));

  const res2 = pourReaderCupAction(res.nextWorld);
  assert.equal(res2.nextWorld, res.nextWorld);
  assert.equal(res2.memoryUnlockedTitle, undefined);
});

test('readLendingNotesAction grants a one-time starter tea, then becomes seasonal rereads', () => {
  const res = readLendingNotesAction(freshInsideNook(1, 700));
  assert.equal(getItemCount(res.nextWorld.inventory, 'chamomile_pear_tea'), 1);
  assert.equal(res.nextWorld.nookState?.notesReadDay, 1);
  assert.equal(res.nextWorld.nookState?.starterTeaDay, 1);
  assert.equal(res.nextWorld.minuteOfDay, 700 + NOOK_NOTES_MINUTES);
  assert.equal(res.memoryUnlockedTitle, 'The Lending Ledger');

  const res2 = readLendingNotesAction(res.nextWorld);
  assert.equal(res2.nextWorld, res.nextWorld);
  assert.equal(res2.memoryUnlockedTitle, undefined);
});

test('enterNookAction / exitNookAction preserve exterior position and place held props', () => {
  const outside = { ...createFreshWorldState(), playerPos: { x: -11.8, z: -1.0 }, playerFacing: -Math.PI / 2 };
  const entered = enterNookAction(outside);
  assert.equal(entered.nextWorld.playerLocation, 'nook_interior');
  assert.deepEqual(entered.nextWorld.playerPos, { x: NOOK_DOOR_SPAWN.x, z: NOOK_DOOR_SPAWN.z });
  assert.equal(entered.nextWorld.exteriorPlayerPos?.x, -11.8);
  assert.equal(entered.nextWorld.exteriorPlayerPos?.z, -1.0);
  assert.equal(entered.toast.length > 0, true);

  const exited = exitNookAction(entered.nextWorld);
  assert.equal(exited.nextWorld.playerLocation, 'exterior');
  assert.equal(exited.nextWorld.playerPos?.x, -11.8);
  assert.equal(exited.nextWorld.playerFacing, -Math.PI / 2);

  assert.equal(enterNookAction(entered.nextWorld).nextWorld, entered.nextWorld);
  assert.equal(exitNookAction(outside).nextWorld, outside);
  assert.equal(NOOK_PORCH_EXIT_FACING, Math.PI * 0.5);
});

test('interactWithProp routes the exterior nook door through enter_nook', () => {
  const outside = createFreshWorldState();
  const res = interactWithProp(outside, 'nook_door');
  assert.equal(res.actionType, 'enter_nook');
  assert.equal(res.actionLabel, 'Step Inside');
  assert.ok(res.title.includes('Linden Book Nook'));
});

test('interactWithNookProp routes all four stations correctly', () => {
  const world = freshInsideNook(1, 540);
  const door = interactWithNookProp(world, 'nook_door');
  assert.equal(door.actionType, 'exit_nook');
  assert.equal(door.nextWorld.playerLocation, 'exterior');

  const shelf = interactWithNookProp(world, 'nook_shelf');
  assert.ok(shelf.title.includes('Bookshelf'));
  assert.equal(shelf.nextWorld.nookState?.shelfBrowsedDay, 1);

  const desk = interactWithNookProp(shelf.nextWorld, 'nook_desk');
  assert.ok(desk.title.includes('Lending Desk'));
  assert.equal(desk.nextWorld.nookState?.starterTeaDay, 1);

  const tea = interactWithNookProp(desk.nextWorld, 'nook_tea');
  assert.ok(tea.title.includes('Tea Tray'));
  assert.equal(getItemCount(tea.nextWorld.inventory, 'chamomile_pear_tea'), 2);
});

test('nook hub waypoints route around furniture between door spawn and every station', () => {
  for (const prop of NOOK_INTERACTABLES) {
    const path = computeNookWaypoints({ ...NOOK_DOOR_SPAWN }, { x: prop.x, z: prop.z }, 0.42);
    assert.ok(path.length >= 1, `waypoint path for ${prop.id}`);
    const last = path[path.length - 1];
    assert.deepEqual(last, { x: prop.x, z: prop.z });
  }
  const direct = computeNookWaypoints({ x: 0.6, z: 0.0 }, { x: 1.5, z: -0.9 }, 0.42);
  assert.equal(direct.length, 1);
});

test('selectBestNookTarget prefers facing-aligned stations and offers the armchair nearby', () => {
  const nearShelf = {
    ...freshInsideNook(),
    playerPos: { x: -0.6, z: -1.0 },
    playerFacing: Math.PI, // facing north toward the shelf focus
  };
  const shelfTarget = selectBestNookTarget(nearShelf);
  assert.ok(shelfTarget, 'shelf target within radius');
  assert.equal(shelfTarget?.kind, 'nook_prop');
  assert.equal(shelfTarget?.nookPropId, 'nook_shelf');

  const nearSeat = {
    ...freshInsideNook(),
    playerPos: { x: -0.9, z: 0.55 },
    playerFacing: Math.PI, // facing south toward the armchair
  };
  const seatTarget = selectBestNookTarget(nearSeat);
  assert.ok(seatTarget, 'seat/prop target within radius near the armchair');
  assert.ok(
    seatTarget?.kind === 'seat' || seatTarget?.kind === 'nook_prop',
    'seat or station candidate near the reading corner',
  );
});

test('reading armchair is indoor, approachable, and never collides with other seat ids', () => {
  assert.equal(NOOK_SEAT_SPOTS.length, 1);
  const seat = NOOK_SEAT_SPOTS[0];
  assert.equal(seat.indoor, true);
  assert.equal(seat.id.startsWith('nook_'), true);
  assert.equal(isNookInteriorWalkable(seat.approachPos.x, seat.approachPos.z, 0.42), true);
});

test('resolveNookInteriorMovement slides along walls instead of sticking', () => {
  const blocked = resolveNookInteriorMovement(
    { x: -0.6, z: -1.2 },
    { x: -0.6, z: -2.0 }, // into the bookshelf obstacle
    0.42,
  );
  assert.deepEqual(blocked, { x: -0.6, z: -1.2 });
  const slide = resolveNookInteriorMovement(
    { x: -0.6, z: -1.2 },
    { x: 1.8, z: -2.0 },
    0.42,
  );
  assert.equal(isNookInteriorWalkable(slide.x, slide.z, 0.42), true);
});

test('v8 saves migrate to v9 with a fresh nookState and interior locations preserved', () => {
  const world = createFreshWorldState();
  const parsed = JSON.parse(serializeWorldState(world)) as Record<string, unknown>;
  const v8Raw = { ...parsed, schemaVersion: 8 } as Record<string, unknown>;
  delete v8Raw.nookState;
  const result = migrateWorldState(v8Raw);
  // LR-1 (WorldState v11) keeps the invariant: the v8 save chains v8→…→<current>,
  // preserving every v9 invariant plus the fresh interior states along the way.
  assert.equal(result.state.schemaVersion, CURRENT_SCHEMA_VERSION);
  assert.ok(result.state.nookState);
  assert.equal(result.state.nookState.booksRead, 0);
  assert.ok(result.state.copperwheelState, 'chain hydrates the fresh copperwheelState');
  assert.equal(result.warnings.length, 0);
});

test('sanitizeNookState repairs negative/missing fields and clamps booksRead to the shelf cycle', () => {
  const world = createFreshWorldState();
  const payload = JSON.parse(serializeWorldState(world)) as Record<string, unknown>;
  const corrupted = {
    ...payload,
    nookState: {
      shelfBrowsedDay: -2,
      teaSharedDay: 'x',
      notesReadDay: 3,
      starterTeaDay: 0,
      booksRead: 11,
      teasShared: -4,
    },
  };
  const result = migrateWorldState(corrupted);
  assert.equal(result.state.nookState.shelfBrowsedDay, 0);
  assert.equal(result.state.nookState.teaSharedDay, 0);
  assert.equal(result.state.nookState.notesReadDay, 3);
  assert.equal(result.state.nookState.booksRead, 4);
  assert.equal(result.state.nookState.teasShared, 0);
  assert.ok(result.warnings.length >= 0);
});

test('computeWorldSaveRevision is sensitive to nookState fields', () => {
  const base = createFreshWorldState();
  const modified: WorldState = {
    ...base,
    nookState: { ...base.nookState, teasShared: 2 },
  };
  assert.notEqual(computeWorldSaveRevision(base), computeWorldSaveRevision(modified));
});

test('nook state round-trips through serialize + migrate without loss', () => {
  const world: WorldState = {
    ...freshInsideNook(3, 720),
    nookState: {
      shelfBrowsedDay: 3,
      teaSharedDay: 2,
      notesReadDay: 1,
      starterTeaDay: 1,
      booksRead: 2,
      teasShared: 3,
    },
  };
  const serialized = serializeWorldState(world);
  const result = migrateWorldState(JSON.parse(serialized));
  assert.deepEqual(result.state.nookState, world.nookState);
});

test('advanceToNextDay steps a nook sleeper out onto the porch and preserves lifetime counters', () => {
  const inside = {
    ...freshInsideNook(2, 1200),
    exteriorPlayerPos: { x: NOOK_PORCH_EXIT_POS.x, z: NOOK_PORCH_EXIT_POS.z },
    exteriorPlayerFacing: Math.PI * 0.5,
    nookState: {
      shelfBrowsedDay: 2,
      teaSharedDay: 2,
      notesReadDay: 1,
      starterTeaDay: 1,
      booksRead: 2,
      teasShared: 3,
    },
  };
  const next = advanceToNextDay(inside);
  assert.equal(next.playerLocation, 'exterior');
  assert.equal(next.playerPos?.x, NOOK_PORCH_EXIT_POS.x);
  assert.equal(next.playerPos?.z, NOOK_PORCH_EXIT_POS.z);
  assert.equal(next.nookState?.booksRead, 2);
  assert.equal(next.nookState?.teasShared, 3);
});
