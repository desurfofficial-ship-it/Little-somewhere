/**
 * Room-aware camera framing tests — overhaul Phase 1 locks.
 *
 * The parity locks are the safety net for the whole camera redesign: any
 * refactor that changes the authored-angle behavior of movement input, zoom
 * mapping, or interior cutaway selection fails here before it can regress the
 * game.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import {
  AUTHORED_YAW,
  applyShellCutaway,
  collectShellSides,
  cutawaySidesForYaw,
  effectiveZoom,
  EXTERIOR_PROFILE,
  fitDistance,
  isInteriorLocation,
  profileForLocation,
  screenToWorldMove,
  ZOOM_MAX,
  ZOOM_MIN,
  type RoomBounds,
} from './roomFraming';

const SIN45 = Math.SQRT1_2;

test('screenToWorldMove reproduces the legacy iso constants at the authored yaw', () => {
  const out = { x: 0, z: 0 };
  // Legacy: moveX = h·0.7071 + v·0.7071; moveZ = −h·0.7071 + v·0.7071
  screenToWorldMove(1, 0, AUTHORED_YAW, out);
  assert.ok(Math.abs(out.x - SIN45) < 1e-9, `right.x ${out.x}`);
  assert.ok(Math.abs(out.z + SIN45) < 1e-9, `right.z ${out.z}`);
  screenToWorldMove(0, 1, AUTHORED_YAW, out);
  assert.ok(Math.abs(out.x - SIN45) < 1e-9, `down.x ${out.x}`);
  assert.ok(Math.abs(out.z - SIN45) < 1e-9, `down.z ${out.z}`);
  // Diagonal parity (values deliberately NOT normalized — legacy input shape).
  screenToWorldMove(1, 1, AUTHORED_YAW, out);
  assert.ok(Math.abs(out.x - 2 * SIN45) < 1e-9);
  assert.ok(Math.abs(out.z) < 1e-9);
});

test('screenToWorldMove stays camera-aligned at all four quadrant yaws (no inversion)', () => {
  const out = { x: 0, z: 0 };
  // Screen-up (v = −1) always walks AWAY from the camera:
  // yaw 0 → camera at +Z → away = −Z
  screenToWorldMove(0, -1, 0, out);
  assert.ok(out.z < 0 && Math.abs(out.x) < 1e-9);
  // yaw π/2 → camera at +X → away = −X
  screenToWorldMove(0, -1, Math.PI / 2, out);
  assert.ok(out.x < 0 && Math.abs(out.z) < 1e-9);
  // yaw π → camera at −Z → away = +Z
  screenToWorldMove(0, -1, Math.PI, out);
  assert.ok(out.z > 0 && Math.abs(out.x) < 1e-9);
  // yaw 3π/2 → camera at −X → away = +X
  screenToWorldMove(0, -1, Math.PI * 1.5, out);
  assert.ok(out.x > 0 && Math.abs(out.z) < 1e-9);
  // Screen-right stays perpendicular: facing −Z (yaw 0) → right = +X;
  // facing +Z (yaw π) → right = −X.
  screenToWorldMove(1, 0, 0, out);
  assert.ok(out.x > 0 && Math.abs(out.z) < 1e-9);
  screenToWorldMove(1, 0, Math.PI, out);
  assert.ok(out.x < 0 && Math.abs(out.z) < 1e-9);
});

test('profiles: every interior gets a bounds-derived profile — greenhouse included (D-4/E-2)', () => {
  const interiors = [
    'cottage_interior',
    'bakery_interior',
    'nook_interior',
    'copperwheel_interior',
    'greenhouse_interior',
  ] as const;
  const seen = new Set<unknown>();
  for (const loc of interiors) {
    const p = profileForLocation(loc);
    assert.ok(isInteriorLocation(loc), loc);
    assert.ok(p.bounds, `${loc} carries bounds`);
    assert.ok(p.baseDistance && p.baseDistance > 8, `${loc} fit distance ${p.baseDistance}`);
    assert.equal(p.zoomScale, 0.68, `${loc} keeps the legacy zoom scale`);
    assert.equal(p.focusWeight, 0.55, `${loc} player-weighted composition`);
    seen.add(p);
  }
  assert.equal(seen.size, 5, 'each room has its own profile instance');
  // Room-size adaptation: the smallest room (book nook) frames closer than the
  // largest (cottage); the greenhouse's tall glass ridge pushes it farthest.
  const nook = profileForLocation('nook_interior').baseDistance!;
  const cottage = profileForLocation('cottage_interior').baseDistance!;
  const greenhouse = profileForLocation('greenhouse_interior').baseDistance!;
  const bakery = profileForLocation('bakery_interior').baseDistance!;
  assert.ok(nook < cottage, `nook ${nook} < cottage ${cottage}`);
  assert.ok(greenhouse > bakery, 'greenhouse ridge raises its fit distance');
  assert.equal(profileForLocation('exterior'), EXTERIOR_PROFILE);
  assert.ok(!isInteriorLocation('exterior'));
});

test('effectiveZoom: interior scale-then-clamp parity; exterior raw clamped to the widened band', () => {
  const interior = profileForLocation('cottage_interior');
  assert.ok(Math.abs(effectiveZoom(interior, 1.0) - 0.68) < 1e-9);
  assert.equal(effectiveZoom(interior, 0.3), 0.56);
  assert.equal(effectiveZoom(interior, 3.0), 0.92);
  assert.equal(effectiveZoom(EXTERIOR_PROFILE, 1.2), 1.2);
  assert.equal(effectiveZoom(EXTERIOR_PROFILE, 0.1), ZOOM_MIN);
  assert.equal(effectiveZoom(EXTERIOR_PROFILE, 9), ZOOM_MAX);
});

test('cutawaySidesForYaw: authored yaw reproduces the baked tall-N/W + curb-E/S look', () => {
  const { near, far } = cutawaySidesForYaw(AUTHORED_YAW);
  assert.deepEqual(near, ['E', 'S']);
  assert.deepEqual(far, ['N', 'W']);
});

test('cutawaySidesForYaw: each quadrant makes the camera-facing side near', () => {
  const q0 = cutawaySidesForYaw(0); // camera due +Z
  assert.ok(q0.near.includes('S') && q0.far.includes('N'));
  const q90 = cutawaySidesForYaw(Math.PI / 2); // camera due +X
  assert.ok(q90.near.includes('E') && q90.far.includes('W'));
  const q180 = cutawaySidesForYaw(Math.PI); // camera due −Z
  assert.ok(q180.near.includes('N') && q180.far.includes('S'));
  const q270 = cutawaySidesForYaw(Math.PI * 1.5); // camera due −X
  assert.ok(q270.near.includes('W') && q270.far.includes('E'));
  // Deterministic regardless of yaw sign/wrap.
  const wrapped = cutawaySidesForYaw(AUTHORED_YAW + Math.PI * 8);
  assert.deepEqual(wrapped, { near: ['E', 'S'], far: ['N', 'W'] });
});

test('collectShellSides + applyShellCutaway: near full walls hide, default angle untouched', () => {
  const root = new THREE.Group();
  const tag = (obj: THREE.Object3D, side: string, full: boolean) => {
    obj.userData.shellSide = side;
    obj.userData.shellFull = full;
  };
  const northWall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  tag(northWall, 'N', true);
  const mountedProp = new THREE.Group();
  tag(mountedProp, 'N', true);
  mountedProp.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2)));
  const westWall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  tag(westWall, 'W', true);
  const eastCurb = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 1));
  tag(eastCurb, 'E', false);
  const untagged = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  root.add(northWall, mountedProp, westWall, eastCurb, untagged);

  const shells = collectShellSides(root);
  // mountedProp's child is collected via inherited tags (4 tagged meshes).
  assert.equal(shells.length, 4);

  // Authored yaw: near = [E, S] → no full wall is near → nothing hidden.
  applyShellCutaway(shells, AUTHORED_YAW);
  assert.ok(northWall.visible && westWall.visible && eastCurb.visible);

  // Camera rotated to the north side (yaw π): N wall + mounted prop hide;
  // west stays (far), curb stays, untagged untouched.
  applyShellCutaway(shells, Math.PI);
  assert.ok(!northWall.visible, 'north full wall hides');
  assert.ok(!mountedProp.children[0].visible, 'mounted prop hides with its wall');
  assert.ok(westWall.visible, 'far west wall stays');
  assert.ok(eastCurb.visible, 'curbs never hide');
  assert.ok(untagged.visible);

  // Rotating back restores everything.
  applyShellCutaway(shells, AUTHORED_YAW);
  assert.ok(northWall.visible && mountedProp.children[0].visible);
});

function fitDistanceSanity() {
  test('fitDistance: bounds-derived distance grows with room size and with fov-limiting narrow aspects', () => {
    const small: RoomBounds = { minX: -2.5, maxX: 2.5, minZ: -2.4, maxZ: 2.4 };
    const large: RoomBounds = { minX: -3.5, maxX: 3.5, minZ: -2.7, maxZ: 2.7 };
    const dSmall = fitDistance(small, 28, 1.6, 2.6);
    const dLarge = fitDistance(large, 28, 1.6, 2.6);
    assert.ok(dLarge > dSmall, `large ${dLarge} should exceed small ${dSmall}`);
    const dPortrait = fitDistance(small, 28, 0.5, 2.6);
    assert.ok(dPortrait > dSmall, `portrait ${dPortrait} should exceed ${dSmall}`);
    assert.ok(dSmall > 6 && dSmall < 40, `cottage fit ${dSmall}`);
  });
}
fitDistanceSanity();
