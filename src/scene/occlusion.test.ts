/**
 * Occlusion tests — overhaul Phase 2 locks.
 *
 * Core guarantees: (1) the shared palette-cache materials are NEVER mutated —
 * registration fades per-shell clones only; (2) a shell between the camera and
 * the player fades, a shell behind the player does not; (3) fades tween with a
 * transparent/depthWrite flip; (4) dispose restores the originals exactly.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import {
  createOcclusionRegistry,
  disposeOcclusion,
  OCCLUSION_FADED_OPACITY,
  probeOcclusion,
  registerOccluder,
  setAllOccluderTargets,
  updateOcclusionFades,
} from './occlusion';

test('registerOccluder clones materials — the shared palette original is never mutated', () => {
  const shared = new THREE.MeshStandardMaterial({ color: '#A89E8E' });
  const root = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared);
  root.add(wall);
  const registry = createOcclusionRegistry();
  const record = registerOccluder(registry, root, 'hut');
  assert.ok(record);
  assert.notEqual(wall.material, shared, 'mesh uses the clone');
  assert.equal((wall.material as THREE.MeshStandardMaterial).color.getHexString(), 'a89e8e');
  // Fade the record hard — the shared original must stay opaque/untouched.
  record.target = OCCLUSION_FADED_OPACITY;
  for (let i = 0; i < 60; i++) updateOcclusionFades(registry, 1 / 30);
  assert.equal(shared.opacity, 1, 'original opacity untouched');
  assert.equal(shared.transparent, false, 'original transparency untouched');
  disposeOcclusion(registry);
  assert.equal(wall.material, shared, 'dispose restores the original');
  shared.dispose();
});

test('probeOcclusion fades a shell between camera and player, not behind the player', () => {
  const registry = createOcclusionRegistry();
  const root = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 0.4), mat);
  wall.position.set(0, 2, 0); // wall plane at z = 0 facing the camera
  root.add(wall);
  wall.updateMatrixWorld(true); // no scene in the test — bake the world matrix
  registerOccluder(registry, root, 'wall');

  const camera = new THREE.PerspectiveCamera(28, 1.6, 0.5, 160);
  camera.position.set(0, 18, 22);
  const playerBehindWall = new THREE.Vector3(0, 0.6, -2.2); // camera → wall → player
  const playerInFrontOfWall = new THREE.Vector3(0, 0.6, 2.2); // camera → player → wall

  probeOcclusion(registry, camera, playerBehindWall.x, playerBehindWall.y, playerBehindWall.z);
  assert.equal(registry.records[0].target, OCCLUSION_FADED_OPACITY, 'wall occludes');

  probeOcclusion(registry, camera, playerInFrontOfWall.x, playerInFrontOfWall.y, playerInFrontOfWall.z);
  assert.equal(registry.records[0].target, 1, 'wall behind the player does not occlude');

  disposeOcclusion(registry);
});

test('fades tween toward the target and flip transparent/depthWrite while faded', () => {
  const registry = createOcclusionRegistry();
  const root = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ transparent: false });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
  root.add(mesh);
  registerOccluder(registry, root, 'block');
  const clone = mesh.material as THREE.MeshStandardMaterial; // fades apply to the clone
  assert.notEqual(clone, mat);
  registry.records[0].target = OCCLUSION_FADED_OPACITY;
  for (let i = 0; i < 120; i++) updateOcclusionFades(registry, 1 / 30);
  assert.ok(Math.abs(clone.opacity - OCCLUSION_FADED_OPACITY) < 0.01, `opacity ${clone.opacity}`);
  assert.equal(clone.transparent, true);
  assert.equal(clone.depthWrite, false);
  registry.records[0].target = 1;
  for (let i = 0; i < 120; i++) updateOcclusionFades(registry, 1 / 30);
  assert.equal(clone.opacity, 1);
  assert.equal(clone.transparent, false);
  assert.equal(clone.depthWrite, true);
  disposeOcclusion(registry);
});

test('setAllOccluderTargets restores opacity targets (interior entry) and multi-shell registries stay isolated', () => {
  const registry = createOcclusionRegistry();
  const matA = new THREE.MeshStandardMaterial();
  const matB = new THREE.MeshStandardMaterial();
  const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matA);
  const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matB);
  registerOccluder(registry, a, 'a');
  registerOccluder(registry, b, 'b');
  assert.equal(registry.records.length, 2);
  registry.records[0].target = OCCLUSION_FADED_OPACITY;
  setAllOccluderTargets(registry, 1);
  assert.equal(registry.records[0].target, 1);
  // One record fading does not touch the other's materials.
  registry.records[0].target = OCCLUSION_FADED_OPACITY;
  updateOcclusionFades(registry, 1);
  assert.equal(matB.opacity, 1);
  disposeOcclusion(registry);
});
