/**
 * CameraController tests — overhaul Phase 1 locks.
 *
 * Parity contract: at the authored yaw (π/4) and zero pitch the controller
 * reproduces the legacy inline camera choreography exactly (offset
 * (19.5, 18.2, 19.5)·zoom, interior focus compression ×0.42 / zoom ×0.68
 * clamped [0.56, 0.92], dialogue zoom ×0.9 + midpoint focus + drop −0.42).
 * New capabilities locked here: continuous yaw integration with wrap, pitch
 * clamping (and the interior pitch lock until Phase 3), damped look-target,
 * and occlusion probe scheduling.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { CameraController, createCameraSnapshot, PITCH_MAX, PITCH_MIN } from './cameraController';
import { AUTHORED_YAW } from './roomFraming';

const makeCamera = () => new THREE.PerspectiveCamera(28, 1.6, 0.5, 160);
const PROBE_INTERVAL = 0.15;

const settle = (c: CameraController, snap: ReturnType<typeof createCameraSnapshot>, frames = 600) => {
  for (let i = 0; i < frames; i++) c.update(1 / 60, snap);
};

test('legacy parity: first update at authored yaw/pitch reproduces (19.5, 18.2, 19.5)·zoom', () => {
  const camera = makeCamera();
  const c = new CameraController(camera);
  c.setLocation('exterior', false);
  const snap = createCameraSnapshot();
  snap.playerX = 3;
  snap.playerZ = -2;
  snap.groundY = 0;
  snap.zoomRaw = 1;
  c.update(1 / 60, snap);
  assert.ok(Math.abs(camera.position.x - (3 + 19.5)) < 1e-6, `${camera.position.x}`);
  assert.ok(Math.abs(camera.position.y - 18.2) < 1e-6, `${camera.position.y}`);
  assert.ok(Math.abs(camera.position.z - (-2 + 19.5)) < 1e-6, `${camera.position.z}`);
});

test('yaw integration: offset stays polar in yaw and height stays authored', () => {
  const camera = makeCamera();
  const c = new CameraController(camera);
  c.setLocation('exterior', false);
  c.addYawDelta(0.5); // arbitrary rotation away from the authored azimuth
  const snap = createCameraSnapshot();
  snap.playerX = 0;
  snap.playerZ = 0;
  snap.zoomRaw = 1;
  c.update(1 / 60, snap);
  const yaw = c.getYaw();
  const horiz = 19.5 * Math.SQRT2;
  assert.ok(Math.abs(camera.position.x - Math.sin(yaw) * horiz) < 1e-6);
  assert.ok(Math.abs(camera.position.z - Math.cos(yaw) * horiz) < 1e-6);
  assert.ok(Math.abs(camera.position.y - 18.2) < 1e-6);
  // Yaw normalizes into [0, 2π)
  c.addYawDelta(Math.PI * 10);
  assert.ok(c.getYaw() >= 0 && c.getYaw() < Math.PI * 2);
});

test('pitch clamps to the band and distorts the offset in polar form; interiors are pitch-locked', () => {
  const camera = makeCamera();
  const c = new CameraController(camera);
  c.setLocation('exterior', false);
  c.addPitchDelta(5);
  assert.equal(c.getPitch(), PITCH_MAX);
  c.addPitchDelta(-50);
  assert.equal(c.getPitch(), PITCH_MIN);
  // Pitch changes camera height monotonically (higher pitch = higher camera at
  // the same zoom since elev grows).
  const snap = createCameraSnapshot();
  snap.zoomRaw = 1;
  c.addPitchDelta(50); // back to max
  c.update(1 / 60, snap);
  const yAtMaxPitch = camera.position.y;
  assert.ok(yAtMaxPitch > 18.2, `elevated pitch should raise the camera: ${yAtMaxPitch}`);

  const c2 = new CameraController(makeCamera());
  c2.setLocation('nook_interior', false);
  c2.addPitchDelta(0.5);
  assert.equal(c2.getPitch(), 0, 'interior pitch stays locked until Phase 3 cutaway');
});

test('interior profile parity: focus compression ×0.42, zoom ×0.68, lookY 0.85', () => {
  const camera = makeCamera();
  const c = new CameraController(camera);
  c.setLocation('cottage_interior', false);
  const snap = createCameraSnapshot();
  snap.playerX = 3;
  snap.playerZ = 2;
  snap.zoomRaw = 1;
  settle(c, snap);
  const focusX = 3 * 0.42;
  const focusZ = 2 * 0.42;
  const zoom = 0.68;
  assert.ok(Math.abs(camera.position.x - (focusX + 19.5 * zoom)) < 0.01, `${camera.position.x}`);
  assert.ok(Math.abs(camera.position.y - 18.2 * zoom) < 0.01, `${camera.position.y}`);
  assert.ok(Math.abs(camera.position.z - (focusZ + 19.5 * zoom)) < 0.01, `${camera.position.z}`);
  // Look target converges to the compressed focus at lookY 0.85: reverse the
  // camera forward direction from the lookAt matrix.
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const expected = new THREE.Vector3(focusX, 0.85, focusZ).sub(camera.position).normalize();
  assert.ok(dir.dot(expected) > 0.9999, 'camera aims at the interior focus');
});

test('greenhouse interior now receives the interior camera treatment (D-4 fix)', () => {
  const camera = makeCamera();
  const c = new CameraController(camera);
  c.setLocation('greenhouse_interior', false);
  const snap = createCameraSnapshot();
  snap.playerX = -2;
  snap.playerZ = 1.5;
  snap.zoomRaw = 1;
  settle(c, snap);
  // Interior distance scale (×0.68), NOT the exterior (×1.0) treatment.
  assert.ok(Math.abs(camera.position.y - 18.2 * 0.68) < 0.01, `${camera.position.y}`);
});

test('dialogue: exterior zoom ×0.9, midpoint focus, and drop apply; interior ignores them', () => {
  const camera = makeCamera();
  const c = new CameraController(camera);
  c.setLocation('exterior', false);
  c.setDialogue(true);
  const snap = createCameraSnapshot();
  snap.playerX = 0;
  snap.playerZ = 0;
  snap.zoomRaw = 1;
  snap.dialogueNpcX = 2;
  snap.dialogueNpcZ = 0;
  settle(c, snap);
  const focusX = 1;
  const zoom = 0.9;
  assert.ok(Math.abs(camera.position.x - (focusX + 19.5 * zoom)) < 0.01, `${camera.position.x}`);
  assert.ok(Math.abs(camera.position.y - 18.2 * zoom) < 0.01, `${camera.position.y}`);
  assert.ok(Math.abs(camera.position.z - 19.5 * zoom) < 0.01, `${camera.position.z}`);

  const c2 = new CameraController(makeCamera());
  c2.setLocation('bakery_interior', false);
  c2.setDialogue(true);
  const snap2 = createCameraSnapshot();
  snap2.playerX = 0.5;
  snap2.playerZ = 1;
  snap2.zoomRaw = 1;
  snap2.dialogueNpcX = 3;
  snap2.dialogueNpcZ = 3;
  settle(c2, snap2);
  // Legacy interior branch ignored dialogue entirely.
  assert.ok(Math.abs(c2.getCamera().position.y - 18.2 * 0.68) < 0.01);
  const fx = 0.5 * 0.42;
  assert.ok(Math.abs(c2.getCamera().position.x - (fx + 19.5 * 0.68)) < 0.01);
});

test('look-target damping: converges smoothly instead of popping', () => {
  const camera = makeCamera();
  const c = new CameraController(camera);
  c.setLocation('exterior', false);
  const snap = createCameraSnapshot();
  snap.playerX = 0;
  snap.playerZ = 0;
  snap.zoomRaw = 1;
  c.update(1 / 60, snap); // initialize
  // Teleport the player — position and look target must both be damped
  // (position strictly between start and target on the first frame).
  snap.playerX = 4;
  const pxBefore = camera.position.x;
  c.update(1 / 60, snap);
  assert.ok(camera.position.x > pxBefore && camera.position.x < 4 + 19.5);
});

test('consumeProbeRequest schedules by interval, yaw delta, and first call', () => {
  const c = new CameraController(makeCamera());
  assert.equal(c.consumeProbeRequest(0.01), true, 'first call is always due');
  assert.equal(c.consumeProbeRequest(0.01), false);
  assert.equal(c.consumeProbeRequest(PROBE_INTERVAL), true, 'interval elapsed');
  c.addYawDelta(0.5);
  assert.equal(c.consumeProbeRequest(0), true, 'material yaw change is due');
  assert.equal(c.consumeProbeRequest(0), false);
});

test('snapTo positions the camera on the current yaw (location changes + QA hook)', () => {
  const camera = makeCamera();
  const c = new CameraController(camera);
  c.setLocation('exterior', false);
  c.addYawDelta(Math.PI);
  c.snapTo(1, 2, 1);
  const horiz = 19.5 * Math.SQRT2;
  const yaw = c.getYaw();
  assert.ok(Math.abs(camera.position.x - (1 + Math.sin(yaw) * horiz)) < 1e-6);
  assert.ok(Math.abs(camera.position.z - (2 + Math.cos(yaw) * horiz)) < 1e-6);
  assert.ok(Math.abs(camera.position.y - 18.2) < 1e-6);
});
