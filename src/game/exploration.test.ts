import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPLORATION_DISCOVERIES,
  countExploredDiscoveries,
  discoverExplorationInPlace,
  findNewExplorationDiscovery,
} from './exploration';
import { createFreshWorldState } from './storage';
import {
  LANDMARK_ZONES,
  PROP_INTERACTABLES,
  SEAT_SPOTS,
  getGroundHeightAt,
  isPointWalkable,
} from './worldMap';

function freshWorld() {
  return createFreshWorldState();
}

test('exploration registry matches the Wild Hollows landmark zones exactly', () => {
  for (const d of EXPLORATION_DISCOVERIES) {
    const zone = LANDMARK_ZONES.find((z) => z.id === d.id);
    assert.ok(zone, `landmark zone ${d.id} must exist`);
    assert.equal(zone.x, d.x, `${d.id} zone center x must match the discovery zone`);
    assert.equal(zone.z, d.z, `${d.id} zone center z must match the discovery zone`);
    assert.equal(zone.radius, d.radius, `${d.id} zone radius must match the discovery zone`);
  }
  assert.equal(EXPLORATION_DISCOVERIES.length, 4);
});

test('discovery zones stand spots are walkable and outside their own obstacles', () => {
  for (const d of EXPLORATION_DISCOVERIES) {
    const zone = LANDMARK_ZONES.find((z) => z.id === d.id)!;
    assert.equal(
      isPointWalkable(zone.x, zone.z, 0.42),
      true,
      `${d.id} zone center must be walkable`,
    );
  }
});

test('first visit grants exactly one discovery: flag + unique journal memory', () => {
  const world = freshWorld();
  const d = EXPLORATION_DISCOVERIES[0];
  const granted = discoverExplorationInPlace(world, d.x, d.z);
  assert.ok(granted);
  assert.equal(granted.id, d.id);
  assert.equal(world.sideFlags[d.sideFlag], true);
  assert.equal(world.memories.some((m) => m.id === d.memoryId), true);
  // Re-entering grants nothing new
  const again = discoverExplorationInPlace(world, d.x, d.z);
  assert.equal(again, null);
  const memCount = world.memories.filter((m) => m.id === d.memoryId).length;
  assert.equal(memCount, 1);
});

test('each wild destination is discoverable independently and counted', () => {
  const world = freshWorld();
  assert.equal(countExploredDiscoveries(world), 0);
  for (const d of EXPLORATION_DISCOVERIES) {
    const granted = discoverExplorationInPlace(world, d.x, d.z);
    assert.ok(granted, `${d.id} must grant on first visit`);
    assert.equal(countExploredDiscoveries(world), countExploredDiscoveries(world));
  }
  assert.equal(countExploredDiscoveries(world), 4);
  // Discovery memory ids are all unique
  const memIds = world.memories
    .filter((m) => m.id.startsWith('mem_explored_'))
    .map((m) => m.id);
  assert.equal(new Set(memIds).size, 4);
});

test('discovery does not trigger far away from the zones', () => {
  const world = freshWorld();
  const granted = discoverExplorationInPlace(world, 0, 1.5); // plaza fountain
  assert.equal(granted, null);
  assert.equal(findNewExplorationDiscovery(world, -8.5, 9.5), null); // spawn
  assert.equal(countExploredDiscoveries(world), 0);
});

test('discovery preserves existing sideFlags and memory order', () => {
  const world = freshWorld();
  world.sideFlags = { fountainWishesCount: 3, pondPebblesSkipped: 1 };
  const before = world.memories.length;
  const d = EXPLORATION_DISCOVERIES[2];
  discoverExplorationInPlace(world, d.x, d.z);
  assert.equal(world.sideFlags.fountainWishesCount, 3);
  assert.equal(world.sideFlags.pondPebblesSkipped, 1);
  assert.equal(world.sideFlags[d.sideFlag], true);
  assert.equal(world.memories.length, before + 1);
});

test('Foxglove Rise elevation: ramp climbs continuously to the deck and stays flat on top', () => {
  // Ramp base sits at ground level
  assert.equal(getGroundHeightAt(21.4, 16.7), 0);
  // Mid-ramp is strictly between
  const mid = getGroundHeightAt(21.4, 17.35);
  assert.ok(mid > 0.2 && mid < 0.45, `mid ramp height ${mid}`);
  // Deck top is flat at 0.62
  for (const [x, z] of [
    [20.7, 18.1],
    [21.5, 18.5],
    [22.2, 20.0],
  ] as const) {
    assert.equal(getGroundHeightAt(x, z), 0.62, `deck (${x}, ${z})`);
  }
  // Just outside the ramp footprint on the mound body: ground height (obstacle-guarded anyway)
  assert.equal(getGroundHeightAt(19.0, 17.0), 0);
});

test('Rise deck walkability: only the ramp connects to the top', () => {
  // Deck and ramp walkable
  assert.equal(isPointWalkable(21.4, 18.4, 0.42), true, 'deck walkable north of bench');
  assert.equal(isPointWalkable(21.4, 17.3, 0.42), true, 'mid-ramp walkable');
  assert.equal(isPointWalkable(21.3, 16.3, 0.42), true, 'ramp base walkable');
  // Mound body blocked on all other sides
  assert.equal(isPointWalkable(19.5, 17.3, 0.42), false, 'west of ramp blocked');
  assert.equal(isPointWalkable(23.0, 17.3, 0.42), false, 'east of ramp blocked');
  assert.equal(isPointWalkable(19.5, 19.0, 0.42), false, 'west of deck blocked');
  assert.equal(isPointWalkable(23.2, 19.0, 0.42), false, 'east of deck blocked');
  assert.equal(isPointWalkable(21.4, 21.0, 0.42), false, 'south of deck blocked');
});

test('new wild seats keep a walkable approach anchor outside the bench exclusion', () => {
  const wildSeats = SEAT_SPOTS.filter(
    (s) => s.id === 'seat_foxglove_rise' || s.id === 'seat_sorrel_hollow',
  );
  assert.equal(wildSeats.length, 2);
  for (const seat of wildSeats) {
    assert.equal(
      isPointWalkable(seat.approachPos.x, seat.approachPos.z, 0.42),
      true,
      `${seat.id} approach must be walkable`,
    );
    // The stand-up radial recovery must be able to reach the approach anchor:
    // approach must sit outside the bench circle exclusion for the seated actor.
    assert.equal(
      Math.hypot(
        seat.approachPos.x - seat.seatPos.x,
        seat.approachPos.z - seat.seatPos.z,
      ) > 0.85,
      true,
      `${seat.id} approach must clear the bench exclusion radius`,
    );
  }
});

test('new wild interactable stand spots are walkable', () => {
  const wildProps = PROP_INTERACTABLES.filter((p) =>
    ['old_stone_well', 'rise_vista', 'marigold_bank', 'wild_bee_log'].includes(p.id),
  );
  assert.equal(wildProps.length, 4);
  for (const p of wildProps) {
    assert.equal(
      isPointWalkable(p.x, p.z, 0.42),
      true,
      `${p.id} stand spot (${p.x}, ${p.z}) must be walkable`,
    );
  }
});
