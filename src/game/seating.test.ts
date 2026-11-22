import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSitGroundY, createInitialPlayerMotion, stepPlayerMovement } from './playerController';
import {
  COTTAGE_SEAT_SPOTS,
  isInteriorPointWalkable,
  resolveInteriorMovement,
} from './cottage';
import {
  BAKERY_SEAT_SPOTS,
  isBakeryInteriorWalkable,
  resolveBakeryInteriorMovement,
} from './bakery';
import {
  NOOK_SEAT_SPOTS,
  isNookInteriorWalkable,
  resolveNookInteriorMovement,
} from './bookNook';
import {
  COPPERWHEEL_SEAT_SPOTS,
  isCopperwheelInteriorWalkable,
  resolveCopperwheelInteriorMovement,
} from './copperwheel';
import {
  findNearestWalkableSpot,
  isLocationPointWalkable,
  resolveSeatStandPos,
  seatLocation,
} from './walkability';
import { togglePlayerSitAction } from './actions';
import { createFreshWorldState } from './storage';
import { SEAT_SPOTS, getGroundHeightAt, isPointWalkable } from './worldMap';
import { GREENHOUSE_BOUNDS, isGreenhouseInteriorWalkable } from './greenhouse';
import type { PlayerLocation, SeatSpot, Vec2 } from './types';

type InteriorFn = (x: number, z: number, radius: number) => boolean;

/** Every indoor seat paired with its own interior walkability function and movement resolver. */
const INDOOR_SEATS: ReadonlyArray<{
  seat: SeatSpot;
  location: PlayerLocation;
  walkable: InteriorFn;
  resolve: (current: Vec2, desired: Vec2, radius: number) => Vec2;
}> = [
  {
    seat: COTTAGE_SEAT_SPOTS[0],
    location: 'cottage_interior',
    walkable: isInteriorPointWalkable,
    resolve: resolveInteriorMovement,
  },
  {
    seat: COTTAGE_SEAT_SPOTS[1],
    location: 'cottage_interior',
    walkable: isInteriorPointWalkable,
    resolve: resolveInteriorMovement,
  },
  {
    seat: BAKERY_SEAT_SPOTS[0],
    location: 'bakery_interior',
    walkable: isBakeryInteriorWalkable,
    resolve: resolveBakeryInteriorMovement,
  },
  {
    seat: NOOK_SEAT_SPOTS[0],
    location: 'nook_interior',
    walkable: isNookInteriorWalkable,
    resolve: resolveNookInteriorMovement,
  },
  {
    seat: COPPERWHEEL_SEAT_SPOTS[0],
    location: 'copperwheel_interior',
    walkable: isCopperwheelInteriorWalkable,
    resolve: resolveCopperwheelInteriorMovement,
  },
];

const EIGHT_DIRECTIONS: readonly Vec2[] = [
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
  { x: Math.SQRT1_2, z: Math.SQRT1_2 },
  { x: Math.SQRT1_2, z: -Math.SQRT1_2 },
  { x: -Math.SQRT1_2, z: Math.SQRT1_2 },
  { x: -Math.SQRT1_2, z: -Math.SQRT1_2 },
];

/** Simulates sitting down on a seat through the sit toggle action. */
function sitOnSeat(seat: SeatSpot, location: PlayerLocation) {
  const baseWorld = {
    ...createFreshWorldState(),
    playerLocation: location,
    playerPos: { ...seat.approachPos },
  };
  const satRes = togglePlayerSitAction(baseWorld, seat.id);
  assert.equal(satRes.sat, true, `${seat.id} sit action should succeed`);
  return satRes.nextWorld;
}

test('every indoor seat: movement-driven stand-up lands on a position walkable under its own interior grid', () => {
  for (const { seat, location, walkable } of INDOOR_SEATS) {
    const world = sitOnSeat(seat, location);
    assert.equal(world.playerPosture, 'sitting');

    const stoodUp = stepPlayerMovement({
      pos: { ...world.playerPos },
      facing: world.playerFacing,
      motion: createInitialPlayerMotion(world.playerPos),
      moveDirX: 1,
      moveDirZ: 0,
      inputMagnitude: 1.0,
      sprintHeld: false,
      carryingItem: false,
      posture: 'sitting',
      seatId: seat.id,
      location,
      dt: 0.033,
    });

    assert.equal(stoodUp.posture, 'standing', `${seat.id} should stand on move input`);
    assert.equal(stoodUp.stoodUpFromMove, true, `${seat.id} flags the stand-up transition`);
    assert.equal(stoodUp.seatId, null, `${seat.id} seat reservation is cleared`);
    assert.equal(
      walkable(stoodUp.pos.x, stoodUp.pos.z, 0.42),
      true,
      `${seat.id} post-stand position (${stoodUp.pos.x.toFixed(2)}, ${stoodUp.pos.z.toFixed(
        2,
      )}) must be walkable under the matching interior function`,
    );
  }
});

test('every indoor seat: at least 4 of 8 cardinal/diagonal directions produce free movement after standing', () => {
  for (const { seat, location, walkable, resolve } of INDOOR_SEATS) {
    const world = sitOnSeat(seat, location);
    const stoodUp = stepPlayerMovement({
      pos: { ...world.playerPos },
      facing: world.playerFacing,
      motion: createInitialPlayerMotion(world.playerPos),
      moveDirX: 0,
      moveDirZ: 1,
      inputMagnitude: 1.0,
      sprintHeld: false,
      carryingItem: false,
      posture: 'sitting',
      seatId: seat.id,
      location,
      dt: 0.033,
    });

    assert.equal(walkable(stoodUp.pos.x, stoodUp.pos.z, 0.42), true);

    let freeDirections = 0;
    for (const dir of EIGHT_DIRECTIONS) {
      const target = {
        x: stoodUp.pos.x + dir.x * 0.35,
        z: stoodUp.pos.z + dir.z * 0.35,
      };
      const moved = resolve(stoodUp.pos, target, 0.42);
      const displacement = Math.hypot(moved.x - stoodUp.pos.x, moved.z - stoodUp.pos.z);
      if (displacement > 0.01) freeDirections += 1;
    }

    assert.ok(
      freeDirections >= 4,
      `${seat.id}: expected ≥4 of 8 free directions after standing, got ${freeDirections}`,
    );
  }
});

test('zero-input while sitting keeps the sit lock on every indoor seat', () => {
  for (const { seat, location } of INDOOR_SEATS) {
    const world = sitOnSeat(seat, location);
    const seatedStep = stepPlayerMovement({
      pos: { ...world.playerPos },
      facing: world.playerFacing,
      motion: createInitialPlayerMotion(world.playerPos),
      moveDirX: 0,
      moveDirZ: 0,
      inputMagnitude: 0,
      sprintHeld: false,
      carryingItem: false,
      posture: 'sitting',
      seatId: seat.id,
      location,
      dt: 0.016,
    });

    assert.equal(seatedStep.posture, 'sitting', `${seat.id} stays seated without input`);
    assert.equal(seatedStep.motion.animState, 'sit', `${seat.id} plays the sit animState`);
    assert.equal(seatedStep.motion.groundY, computeSitGroundY(seat.seatHeight, 1.0));
    assert.deepEqual(seatedStep.pos, { x: seat.seatPos.x, z: seat.seatPos.z });
    assert.equal(seatedStep.seatId, seat.id);
  }
});

test('explicit Stand Up action (togglePlayerSitAction) relocates indoor sitters to walkable spots', () => {
  for (const { seat, location, walkable } of INDOOR_SEATS) {
    const world = sitOnSeat(seat, location);
    assert.equal(world.playerPosture, 'sitting');

    const stoodRes = togglePlayerSitAction(world);
    assert.equal(stoodRes.sat, false);
    assert.equal(stoodRes.nextWorld.playerPosture, 'standing');
    assert.equal(stoodRes.nextWorld.playerSeatId, null);
    assert.equal(
      walkable(stoodRes.nextWorld.playerPos.x, stoodRes.nextWorld.playerPos.z, 0.42),
      true,
      `${seat.id}: explicit stand must place the player on walkable floor, got (${stoodRes.nextWorld.playerPos.x.toFixed(
        2,
      )}, ${stoodRes.nextWorld.playerPos.z.toFixed(2)})`,
    );
  }
});

test('outdoor bench behavior is unchanged: stand-up keeps landing exactly on the authored approach', () => {
  const bench = SEAT_SPOTS.find((s) => s.id === 'seat_east_plaza');
  assert.ok(bench);

  // Movement-driven stand-up from the bench
  const world = sitOnSeat(bench, 'exterior');
  const stoodUp = stepPlayerMovement({
    pos: { ...world.playerPos },
    facing: world.playerFacing,
    motion: createInitialPlayerMotion(world.playerPos),
    moveDirX: 1,
    moveDirZ: 0,
    inputMagnitude: 1.0,
    sprintHeld: false,
    carryingItem: false,
    posture: 'sitting',
    seatId: bench.id,
    dt: 0.033,
  });
  assert.equal(stoodUp.posture, 'standing');
  // After standing, the held movement input is applied for this same tick, so the
  // position legitimately advances beyond the approach point — assert walkable floor
  // (and that the player left the bench seat), not an exact coordinate.
  assert.equal(isPointWalkable(stoodUp.pos.x, stoodUp.pos.z, 0.48), true);
  assert.ok(
    Math.hypot(stoodUp.pos.x - bench.approachPos.x, stoodUp.pos.z - bench.approachPos.z) < 0.5,
    'post-stand position stays near the authored approach within one tick',
  );

  // Explicit stand-up action
  const stoodRes = togglePlayerSitAction(world);
  assert.deepEqual(stoodRes.nextWorld.playerPos, { x: bench.approachPos.x, z: bench.approachPos.z });

  // Seat location mapping stays exterior for outdoor benches
  assert.equal(seatLocation(bench), 'exterior');
});

test('isLocationPointWalkable routes each location to its own grid', () => {
  // Bakery and copperwheel approach points pass their own grid but fail the cottage grid
  const bakerySeat = BAKERY_SEAT_SPOTS[0];
  const cwSeat = COPPERWHEEL_SEAT_SPOTS[0];
  assert.equal(
    isLocationPointWalkable('bakery_interior', bakerySeat.approachPos.x, bakerySeat.approachPos.z, 0.42),
    true,
  );
  assert.equal(
    isLocationPointWalkable('copperwheel_interior', cwSeat.approachPos.x, cwSeat.approachPos.z, 0.42),
    true,
  );
  assert.equal(
    isInteriorPointWalkable(bakerySeat.approachPos.x, bakerySeat.approachPos.z, 0.42),
    false,
    'cottage-only check must reject the bakery approach (the original bug)',
  );

  // Greenhouse dispatch mirrors the greenhouse grid across its room
  for (const px of [GREENHOUSE_BOUNDS.minX + 0.6, 0, GREENHOUSE_BOUNDS.maxX - 0.6]) {
    const pz = GREENHOUSE_BOUNDS.maxZ - 0.6;
    assert.equal(
      isLocationPointWalkable('greenhouse_interior', px, pz, 0.42),
      isGreenhouseInteriorWalkable(px, pz, 0.42),
    );
  }

  // Outdoor dispatch defers to the overworld map
  assert.equal(isLocationPointWalkable('exterior', 0, 0, 0.48), isPointWalkable(0, 0, 0.48));
});

test('radial recovery search is deterministic and finds open floor around blocked seats', () => {
  // Around the bakery café chair seatPos (inside the table/chair obstacle volume),
  // the search must return a walkable bakery point — deterministic across calls.
  const bakerySeat = BAKERY_SEAT_SPOTS[0];
  const first = findNearestWalkableSpot(
    'bakery_interior',
    bakerySeat.seatPos.x,
    bakerySeat.seatPos.z,
    0.42,
  );
  assert.ok(first, 'radial recovery around the bakery chair should find open floor');
  assert.equal(isBakeryInteriorWalkable(first.x, first.z, 0.42), true);
  const second = findNearestWalkableSpot(
    'bakery_interior',
    bakerySeat.seatPos.x,
    bakerySeat.seatPos.z,
    0.42,
  );
  assert.deepEqual(first, second, 'same inputs must produce the same recovered spot');

  // Same guarantee around the copperwheel armchair. Its seatPos lies in a deep corner
  // pocket (bench/shelf/south wall all within the recovery shell), so the walkable exit
  // is found around the authored approach anchor — the second recovery anchor.
  const cwSeat = COPPERWHEEL_SEAT_SPOTS[0];
  const cwSpotFromSeat = findNearestWalkableSpot(
    'copperwheel_interior',
    cwSeat.seatPos.x,
    cwSeat.seatPos.z,
    0.42,
  );
  assert.equal(
    cwSpotFromSeat,
    null,
    'corner-pocket armchair has no walkable point in the 0.35/0.55 shell around seatPos (documents the two-anchor design)',
  );
  const cwSpot = findNearestWalkableSpot(
    'copperwheel_interior',
    cwSeat.approachPos.x,
    cwSeat.approachPos.z,
    0.42,
  );
  assert.ok(cwSpot, 'radial recovery around the copperwheel approach should find open floor');
  assert.equal(isCopperwheelInteriorWalkable(cwSpot.x, cwSpot.z, 0.42), true);

  // An already-walkable open room point needs no recovery in resolveSeatStandPos:
  // the authored approach wins and is returned verbatim.
  const standPos = resolveSeatStandPos(bakerySeat);
  assert.ok(standPos);
  assert.deepEqual(standPos, { x: bakerySeat.approachPos.x, z: bakerySeat.approachPos.z });
});

test('overhaul C-2: resolveSeatStandPos never returns null — every seat has a stand-up spot', () => {
  const allSeats = [...SEAT_SPOTS, ...COTTAGE_SEAT_SPOTS, ...BAKERY_SEAT_SPOTS, ...NOOK_SEAT_SPOTS, ...COPPERWHEEL_SEAT_SPOTS];
  assert.ok(allSeats.length >= 12, `expected the full 12-seat inventory, got ${allSeats.length}`);
  for (const seat of allSeats) {
    const standPos = resolveSeatStandPos(seat);
    assert.ok(standPos, `${seat.id} must always resolve a stand-up position`);
    // The final fallback is the authored approach anchor — never the seatPos
    // itself (which sits inside the furniture collision volume).
    assert.ok(
      !(standPos.x === seat.seatPos.x && standPos.z === seat.seatPos.z),
      `${seat.id} stand-up must not land inside the seat collider`,
    );
  }
});

test('overhaul C-1: seated ground Y includes the terrain under the seat (Foxglove deck)', () => {
  const foxglove = SEAT_SPOTS.find((s) => s.id === 'seat_foxglove_rise');
  assert.ok(foxglove, 'foxglove deck seat exists');
  const terrainY = getGroundHeightAt(foxglove.seatPos.x, foxglove.seatPos.z);
  assert.equal(terrainY, 0.62, 'the deck seat sits on the 0.62 rise deck');
  // The seated tick formula: computeSitGroundY + terrain. The legacy formula
  // omitted terrain and sank the sitter ~0.59 into the deck.
  const seatedGroundY = computeSitGroundY(foxglove.seatHeight, 1.0) + terrainY;
  assert.ok(seatedGroundY > 0.6, `seated ground ${seatedGroundY} clears the deck`);
});

test('overhaul C-3: every bench approach keeps a ≥ 0.2 margin against its collider', () => {
  for (const seat of SEAT_SPOTS) {
    const margin = Math.hypot(seat.approachPos.x - seat.seatPos.x, seat.approachPos.z - seat.seatPos.z) - 0.42;
    assert.ok(margin >= 0.2, `${seat.id} approach margin ${margin.toFixed(3)}`);
  }
});
