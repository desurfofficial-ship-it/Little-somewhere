import test from 'node:test';
import assert from 'node:assert/strict';
import { togglePlayerSitAction } from './actions';
import { createFreshWorldState } from './storage';
import { BAKERY_SEAT_SPOTS } from './bakery';
import { NOOK_SEAT_SPOTS } from './bookNook';
import { COTTAGE_SEAT_SPOTS } from './cottage';
import { COPPERWHEEL_SEAT_SPOTS } from './copperwheel';
import { SEAT_SPOTS as OUTDOOR_SEAT_SPOTS } from './worldMap';
import type { PlayerLocation, SeatSpot, WorldState } from './types';

/**
 * QA-03 adversarial battery — cross-venue sit teleport (defect register QA-03;
 * integration-readiness blocker #3; implementation proposal §9 criterion 6).
 *
 * Historic bug (probe P5d): `togglePlayerSitAction` validated distance only, so
 * from `nook_interior` the bakery café chair was "sittable" — `sat:true`, and
 * `playerPos` teleported to the bakery-LOCAL chair coordinates (0.73, 1.45)
 * while `playerLocation` stayed `nook_interior`: a cross-grid ghost state that
 * the shipped UI never offered but any stale/captured target could reach.
 *
 * Fix under test: categorical location guard — `seatLocation(seat) !==
 * world.playerLocation` rejects before the G-3 distance check (a metric is
 * meaningless across coordinate spaces). Regression contract: from every
 * interior, sitting any other location's seat → `sat:false` with the world
 * referentially unchanged; every legitimate same-location flow stays green.
 */

const INTERIORS: PlayerLocation[] = [
  'cottage_interior',
  'bakery_interior',
  'nook_interior',
  'copperwheel_interior',
  'greenhouse_interior',
];

const INDOOR_SEATS: ReadonlyArray<{ location: PlayerLocation; seats: readonly SeatSpot[] }> = [
  { location: 'cottage_interior', seats: COTTAGE_SEAT_SPOTS },
  { location: 'bakery_interior', seats: BAKERY_SEAT_SPOTS },
  { location: 'nook_interior', seats: NOOK_SEAT_SPOTS },
  { location: 'copperwheel_interior', seats: COPPERWHEEL_SEAT_SPOTS },
];

/** A world staged so the player stands at `pos` inside `location` (standing, unseated). */
function stagedAt(location: PlayerLocation, pos: { x: number; z: number }): WorldState {
  const base = createFreshWorldState();
  return {
    ...base,
    playerLocation: location,
    playerPos: { ...pos },
    playerPosture: 'standing',
    playerSeatId: null,
  };
}

test('QA-03: from each interior, sitting any other location’s seat is refused with the world referentially unchanged (P5d matrix)', () => {
  const allSeats: ReadonlyArray<{ location: PlayerLocation; seat: SeatSpot }> = [
    ...INDOOR_SEATS.flatMap((entry) => entry.seats.map((seat) => ({ location: entry.location, seat }))),
    ...OUTDOOR_SEAT_SPOTS.map((seat) => ({ location: 'exterior' as PlayerLocation, seat })),
  ];

  for (const location of INTERIORS) {
    for (const { location: seatLoc, seat } of allSeats) {
      if (seatLoc === location) continue; // same-venue flows are positive controls below
      const world = stagedAt(location, { x: 0, z: 0 });
      const res = togglePlayerSitAction(world, seat.id);
      assert.equal(
        res.sat,
        false,
        `sitting ${seat.id} (${seatLoc}) from ${location} must be refused (QA-03)`,
      );
      assert.equal(
        res.nextWorld,
        world,
        `refusal must return the SAME world reference (zero mutation): ${seat.id} from ${location}`,
      );
    }
  }
});

test('QA-03: exact P5d repro flips — bakery café chair from nook_interior', () => {
  const world = stagedAt('nook_interior', { x: -0.9, z: 0.55 }); // nook-local floor near the armchair
  const bakerySeat = BAKERY_SEAT_SPOTS[0];
  // The bakery-LOCAL chair coordinates are "within 3.0 m" of this nook-local
  // playerPos — the historic bug rode exactly this metric meaninglessness.
  const res = togglePlayerSitAction(world, bakerySeat.id);
  assert.equal(res.sat, false, 'cross-venue sit must be refused');
  assert.equal(res.nextWorld, world, 'world unchanged');
  assert.equal(res.nextWorld.playerLocation, 'nook_interior');
  assert.deepEqual(res.nextWorld.playerPos, { x: -0.9, z: 0.55 });
});

test('QA-03: outdoor bench is refused from inside any interior (same categorical invariant)', () => {
  const bench = OUTDOOR_SEAT_SPOTS[0];
  const world = stagedAt('bakery_interior', { x: bench.seatPos.x, z: bench.seatPos.z });
  const res = togglePlayerSitAction(world, bench.id);
  assert.equal(res.sat, false, 'outdoor bench must be refused from bakery_interior');
  assert.equal(res.nextWorld, world);
});

test('QA-03 positive controls: every same-location sit flow stays green', () => {
  // Indoor chairs, staged at the seat's own approach position
  for (const { location, seats } of INDOOR_SEATS) {
    for (const seat of seats) {
      const world = stagedAt(location, { ...seat.approachPos });
      const res = togglePlayerSitAction(world, seat.id);
      assert.equal(res.sat, true, `${seat.id} must remain sittable inside ${location}`);
      assert.equal(res.nextWorld.playerSeatId, seat.id);
      assert.deepEqual(res.nextWorld.playerPos, { ...seat.seatPos });
    }
  }
  // Outdoor bench from the overworld
  const bench = OUTDOOR_SEAT_SPOTS[0];
  const outdoors = stagedAt('exterior', { ...bench.approachPos });
  const res = togglePlayerSitAction(outdoors, bench.id);
  assert.equal(res.sat, true, `${bench.id} must remain sittable from the exterior`);
});

test('QA-03: stand-up path is untouched by the guard (sitting player can always stand)', () => {
  const seat = BAKERY_SEAT_SPOTS[0];
  const world = stagedAt('bakery_interior', { ...seat.approachPos });
  const seated = togglePlayerSitAction(world, seat.id).nextWorld;
  const stood = togglePlayerSitAction(seated, undefined);
  assert.equal(stood.sat, false, 'second toggle stands the player up');
  assert.equal(stood.nextWorld.playerPosture, 'standing');
  assert.equal(stood.nextWorld.playerSeatId, null);
});

test('QA-03: claimed-station suppression (nook) still fires after the categorical guard for same-venue sits', () => {
  const armchair = NOOK_SEAT_SPOTS[0];
  const world = stagedAt('nook_interior', { ...armchair.approachPos });
  // Claim the nook chair with Nora's session occupancy (hand-staged, coherent).
  const claimed: WorldState = {
    ...world,
    occupancy: {
      residentId: 'nora',
      location: 'nook_interior',
      stationId: 'nook_chair',
      localPos: { x: -0.9, z: 1.65 },
      facing: 0.15,
      invitationId: 'inv_staged',
    },
  };
  const res = togglePlayerSitAction(claimed, armchair.id);
  assert.equal(res.sat, false, 'claimed chair stays refused');
  assert.match(res.toast ?? '', /Nora is keeping the reading armchair/);
});
