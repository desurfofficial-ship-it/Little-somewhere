import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COBBLE_RECTS,
  COBBLE_SURFACE_HEIGHT,
  COBBLE_EDGE_RAMP,
  getCobbleSurfaceHeight,
  isOnCobbleSurface,
} from './groundSurfaces';

test('cobble surface: slab height inside every authored rect', () => {
  const samples: ReadonlyArray<readonly [number, number]> = [
    [0, 0], // plaza center (fountain obstacle is logic-side, not geometry)
    [0, 6.2], // plaza ∩ south promenade overlap band (worst old z-fight zone)
    [-9, 10], // home lane center
    [-10, -1], // west lane center
    [8.3, -1], // east lane center
    [8.3, 11.6], // east extension
    [0, 7.2], // south promenade center
    [-2.9, 10.1], // bridge approach
    [0, -6.5], // north promenade center
    [-6.2, 6.7], // plaza western edge band
  ];
  for (const [x, z] of samples) {
    assert.equal(getCobbleSurfaceHeight(x, z), COBBLE_SURFACE_HEIGHT, `(${x}, ${z})`);
  }
});

test('cobble surface: 0 far from the network', () => {
  assert.equal(getCobbleSurfaceHeight(30, 30), 0);
  assert.equal(getCobbleSurfaceHeight(-30, 0), 0);
  assert.equal(getCobbleSurfaceHeight(0, 25), 0);
  assert.equal(getCobbleSurfaceHeight(19, 17), 0); // Foxglove mound body (not cobble)
});

test('cobble surface: edge ramp is continuous, monotonic, and bounded', () => {
  // Walk WEST off the west lane's edge (x=-11.9 at z=-5): a site with no neighboring
  // rect beyond it (the plaza's east edge at z=2 is covered by the east lane — union
  // behavior, tested in the seam-dip case below).
  const edge = -11.9;
  const inside = getCobbleSurfaceHeight(edge + 0.05, -5);
  assert.equal(inside, COBBLE_SURFACE_HEIGHT);
  let prev = inside;
  for (let d = 0.05; d <= COBBLE_EDGE_RAMP + 0.1; d += 0.025) {
    const h = getCobbleSurfaceHeight(edge - d, -5);
    assert.ok(h <= prev + 1e-9, `height must not increase walking away (d=${d})`);
    assert.ok(h >= 0 && h <= COBBLE_SURFACE_HEIGHT, `height bounded (d=${d})`);
    prev = h;
  }
  assert.equal(prev, 0, 'ramp reaches 0 at the ramp width');
});

test('cobble surface: overlapping rects never produce a seam dip', () => {
  // Between plaza (z ends 6.75) and south promenade (z 5.6..8.8): the union is
  // solid — the height must stay the slab height across the whole walk, never dip.
  for (let z = 5.5; z <= 8.75; z += 0.05) {
    assert.equal(getCobbleSurfaceHeight(0, z), COBBLE_SURFACE_HEIGHT, `z=${z}`);
  }
  // Immediately past the promenade's far edge the shared ramp takes over (smooth,
  // never a cliff back to 0).
  const past = getCobbleSurfaceHeight(0, 8.9);
  assert.ok(past > 0 && past < COBBLE_SURFACE_HEIGHT, `ramp past far edge: ${past}`);
  // Triple zone (plaza ∩ east lane ∩ promenades) likewise solid.
  for (let z = -6.8; z <= 6.8; z += 0.4) {
    assert.equal(getCobbleSurfaceHeight(6.22, z), COBBLE_SURFACE_HEIGHT, `x=6.22 z=${z}`);
  }
});

test('cobble surface: isOnCobbleSurface matches the height contract', () => {
  assert.equal(isOnCobbleSurface(0, 0), true);
  assert.equal(isOnCobbleSurface(0, 7.2), true);
  assert.equal(isOnCobbleSurface(15, 15), false);
  assert.equal(isOnCobbleSurface(-6.5, 2), false); // west of the plaza, off the lanes
});

test('cobble rects: exactly the eight authored surfaces', () => {
  assert.equal(COBBLE_RECTS.length, 8);
  // Plaza keeps its authored footprint (world-aligned UV density contract).
  const plaza = COBBLE_RECTS[0];
  assert.equal(plaza.x, 0);
  assert.equal(plaza.z, 0);
  assert.equal(plaza.halfW * 2, 12.5);
  assert.equal(plaza.halfL * 2, 13.5);
});
