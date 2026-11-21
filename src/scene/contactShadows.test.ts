import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ContactShadowBatch } from './contactShadows';

/**
 * BUILD 02 Stage 1a — static contact-shadow instancing contracts (Doc 06 §3.4).
 * The batcher must collapse the ~90 static per-mesh shadow quads into
 * per-(subtree, opacity) InstancedMesh buckets with IDENTICAL world transforms,
 * while dynamic discs (characters, carried items, outcome-toggled groups) stay
 * per-mesh via the untouched `addContactShadow` helper.
 */

function makeTex(): THREE.Texture {
  return new THREE.Texture();
}

test('flush collapses same-opacity discs into one InstancedMesh with identical transforms', () => {
  const batch = new ContactShadowBatch();
  const tex = makeTex();
  const root = new THREE.Group();
  const a = new THREE.Group();
  a.position.set(2, 0.5, -3);
  a.rotation.y = 0.7;
  root.add(a);
  const b = new THREE.Group();
  b.position.set(-5, 0, 8);
  root.add(b);

  batch.add(a, tex, 1.6, 1.02, 0.44, 0.018);
  batch.add(b, tex, 6.6, 6.6, 0.44, 0.02);
  batch.add(b, tex, 0.95, 0.95, 0.44, 0.018);

  // Record expected world matrices BEFORE flush (flush removes the meshes).
  const expected: THREE.Matrix4[] = [];
  for (const obj of [a.children[0], b.children[0], b.children[1]] as THREE.Object3D[]) {
    obj.updateWorldMatrix(true, false);
    expected.push(obj.matrixWorld.clone());
  }

  batch.flush(root);
  assert.equal(batch.batchCount, 1, 'same opacity in one subtree = exactly one bucket');
  assert.equal(batch.instancedDiscCount, 3, 'all three discs instanced');
  assert.ok(batch.isFlushed, 'flush state recorded');

  const inst = root.children.find(
    (c) => (c as THREE.InstancedMesh).isInstancedMesh,
  ) as THREE.InstancedMesh;
  assert.ok(inst, 'bucket is an InstancedMesh parented at the default root');
  const m = new THREE.Matrix4();
  // Geometric parity: the unit disc's corners mapped through the instance
  // matrix must land EXACTLY where the original (width, depth) disc's corners
  // landed through its mesh world matrix — visual output identical.
  const discDims: Array<[number, number]> = [
    [1.6, 1.02],
    [6.6, 6.6],
    [0.95, 0.95],
  ];
  const cornerNdc: Array<[number, number]> = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ];
  const vA = new THREE.Vector3();
  const vE = new THREE.Vector3();
  for (let i = 0; i < 3; i++) {
    inst.getMatrixAt(i, m);
    const [w, d] = discDims[i];
    for (const [nx, ny] of cornerNdc) {
      vA.set(nx, ny, 0).applyMatrix4(m);
      vE.set(nx * w, ny * d, 0).applyMatrix4(expected[i]);
      assert.ok(vA.distanceTo(vE) < 1e-5, `instance ${i} corner (${nx},${ny}) maps to the original disc corner`);
    }
  }
  batch.dispose();
});

test('different opacities batch into separate buckets sharing one unit geometry', () => {
  const batch = new ContactShadowBatch();
  const tex = makeTex();
  const root = new THREE.Group();
  batch.add(root, tex, 4.6, 4.6, 0.52, 0.022);
  batch.add(root, tex, 2.35, 1.75, 0.45, 0.018);
  batch.add(root, tex, 0.9, 0.9, 0.32, 0.015);
  batch.flush(root);
  assert.equal(batch.batchCount, 3, 'three opacity values → three buckets');
  assert.equal(batch.instancedDiscCount, 3);
  const mats = root.children.map((c) => ((c as THREE.InstancedMesh).material as THREE.MeshBasicMaterial));
  assert.deepEqual(
    mats.map((mm) => mm.opacity).sort((x, y) => x - y),
    [0.32, 0.45, 0.52],
    'each bucket keeps its own opacity',
  );
  assert.ok(mats.every((mm) => mm.transparent && !mm.depthWrite), 'material flags identical to the per-mesh discs');
  batch.dispose();
  assert.equal(batch.batchCount, 0, 'dispose removes every bucket');
});

test('discs under a contactBatchRoot subtree batch inside that subtree (visibility follows the room)', () => {
  const batch = new ContactShadowBatch();
  const tex = makeTex();
  const scene = new THREE.Group();
  const exterior = new THREE.Group();
  scene.add(exterior);
  const interiorRig = new THREE.Group();
  interiorRig.userData.contactBatchRoot = true;
  interiorRig.visible = false; // interiors start hidden
  scene.add(interiorRig);
  const shelf = new THREE.Group();
  shelf.position.set(0.4, 0.8, -1.2);
  interiorRig.add(shelf);

  batch.add(shelf, tex, 0.35, 0.35, 0.4, 0.022);
  batch.add(exterior, tex, 5.8, 5.8, 0.48, 0.02);
  batch.flush(scene);

  assert.equal(batch.batchCount, 2, 'interior bucket + exterior bucket');
  // The interior bucket must be a descendant of the rig group (visibility follows).
  const interiorBucket = interiorRig.children.find(
    (c) => (c as THREE.InstancedMesh).isInstancedMesh,
  ) as THREE.InstancedMesh | undefined;
  assert.ok(interiorBucket, 'interior discs batch INSIDE the marked rig group');
  assert.equal(interiorBucket!.count, 1);
  const exteriorBucket = scene.children.find(
    (c) => (c as THREE.InstancedMesh).isInstancedMesh,
  ) as THREE.InstancedMesh | undefined;
  assert.ok(exteriorBucket, 'exterior discs batch at the default root');
  assert.equal(exteriorBucket!.count, 1);
  batch.dispose();
});

test('late flush after new registrations rebuilds buckets from all records', () => {
  const batch = new ContactShadowBatch();
  const tex = makeTex();
  const root = new THREE.Group();
  batch.add(root, tex, 1.5, 1.5, 0.4, 0.018);
  batch.flush(root);
  assert.equal(batch.batchCount, 1);
  batch.add(root, tex, 2.5, 2.5, 0.4, 0.018);
  batch.flush(root);
  assert.equal(batch.batchCount, 1, 're-flush merges into one fresh bucket');
  assert.equal(batch.instancedDiscCount, 2, 'both discs present after rebuild');
  assert.equal(root.children.length, 1, 'no stale buckets left behind');
  batch.dispose();
});

test('flush without registrations is a no-op that never creates empty buckets', () => {
  const batch = new ContactShadowBatch();
  const root = new THREE.Group();
  batch.flush(root);
  assert.equal(batch.batchCount, 0);
  assert.equal(root.children.length, 0);
  assert.equal(batch.isFlushed, false, 'empty flush does not claim flushed state');
});
