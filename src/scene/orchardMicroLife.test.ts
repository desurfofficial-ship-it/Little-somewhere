import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  ORCHARD_BUTTERFLY_ANCHORS,
  ORCHARD_SKEP_ANCHOR,
  buildOrchardMicroLife,
  type OrchardMicroLifeRig,
} from './builders/orchardMicroLife';
import { ORCHARD_GATE, ORCHARD_TREES } from './builders/orchard';

const INACTIVE = { butterfliesActive: false, beesActive: false, windStrength: 0 } as const;
const ACTIVE = { butterfliesActive: true, beesActive: true, windStrength: 0.8 } as const;

function collectInstanced(group: THREE.Group): THREE.InstancedMesh[] {
  const out: THREE.InstancedMesh[] = [];
  group.traverse((child) => {
    if ((child as THREE.InstancedMesh).isInstancedMesh) out.push(child as THREE.InstancedMesh);
  });
  return out;
}

function assertFiniteMatrices(mesh: THREE.InstancedMesh, label: string) {
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m);
    m.decompose(pos, quat, scale);
    assert.ok(
      Number.isFinite(pos.x) && Number.isFinite(pos.y) && Number.isFinite(pos.z),
      `${label}[${i}] position must stay finite`,
    );
    assert.ok(
      scale.x > 0.2 && scale.x < 2.5,
      `${label}[${i}] scale ${scale.x} must stay in the hand-tuned band`,
    );
  }
}

test('orchard micro-life rig builds pooled instanced meshes with blossom anchors', () => {
  const rig: OrchardMicroLifeRig = buildOrchardMicroLife({ isSoftwareGl: true });
  assert.equal(rig.butterflyCount, 3, 'software GL caps butterflies at 3');
  assert.equal(rig.beeCount, 2, 'software GL caps bees at 2');

  const meshes = collectInstanced(rig.group);
  assert.equal(meshes.length, 4, 'wingsL + wingsR + bodies + bees');
  assert.equal(meshes.filter((m) => m.count === rig.butterflyCount).length, 3);
  assert.equal(meshes.filter((m) => m.count === rig.beeCount).length, 1);

  // All butterfly anchors sit inside the orchard landmark district (north meadow)
  // and hug an orchard fixture: a crabapple crown, the gate arch, the bench or the skep.
  const orchardFixtures: Array<{ x: number; z: number }> = [
    ...ORCHARD_TREES.map((t) => ({ x: t.x, z: t.z })),
    { x: ORCHARD_GATE.x, z: ORCHARD_GATE.z },
    { x: -11.0, z: -20.6 }, // seat_orchard_bench obstacle
    { x: ORCHARD_SKEP_ANCHOR.x, z: ORCHARD_SKEP_ANCHOR.z },
  ];
  for (const anchor of ORCHARD_BUTTERFLY_ANCHORS) {
    assert.ok(anchor.z < -13.5, `anchor ${anchor.x},${anchor.z} must live in the north orchard`);
    const nearestFixture = orchardFixtures.reduce(
      (best, f) => Math.min(best, Math.hypot(anchor.x - f.x, anchor.z - f.z)),
      Infinity,
    );
    assert.ok(
      nearestFixture < 2.2,
      `anchor ${anchor.x},${anchor.z} must hug an orchard fixture (${nearestFixture.toFixed(2)})`,
    );
  }
  // The skep anchor mirrors the orchard builder's skep position
  assert.equal(ORCHARD_SKEP_ANCHOR.x, 4.9);
  assert.equal(ORCHARD_SKEP_ANCHOR.z, -16.3);

  rig.dispose();
});

test('butterfly and bee motion stays finite, anchored and weather-gated', () => {
  const rig: OrchardMicroLifeRig = buildOrchardMicroLife({ isSoftwareGl: false });

  // Inactive: everything hidden
  rig.update(0.5, INACTIVE);
  assert.equal(rig.group.visible, false);
  for (const mesh of collectInstanced(rig.group)) {
    assert.equal(mesh.visible, false);
  }

  // Active: motion runs, positions stay near their anchors, no NaN
  rig.group.visible = true;
  rig.update(1.0, ACTIVE);
  const meshes = collectInstanced(rig.group);
  const bodies = meshes.find((m) => m.count === rig.butterflyCount)!;
  const bees = meshes.find((m) => m.count === rig.beeCount)!;
  assertFiniteMatrices(bodies, 'butterflyBody');
  assertFiniteMatrices(bees, 'bee');

  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let i = 0; i < bodies.count; i++) {
    bodies.getMatrixAt(i, m);
    m.decompose(pos, quat, scale);
    const anchor = ORCHARD_BUTTERFLY_ANCHORS[i % ORCHARD_BUTTERFLY_ANCHORS.length];
    const drift = Math.hypot(pos.x - anchor.x, pos.z - anchor.z);
    assert.ok(
      drift < anchor.r * 1.35 + 0.75,
      `butterfly ${i} wandered ${drift.toFixed(2)} from its blossom anchor`,
    );
    assert.ok(pos.y > 0.3 && pos.y < 2.4, `butterfly ${i} hover height ${pos.y} out of band`);
  }
  for (let i = 0; i < bees.count; i++) {
    bees.getMatrixAt(i, m);
    m.decompose(pos, quat, scale);
    const drift = Math.hypot(pos.x - ORCHARD_SKEP_ANCHOR.x, pos.z - ORCHARD_SKEP_ANCHOR.z);
    assert.ok(drift < 1.15, `bee ${i} strayed ${drift.toFixed(2)} from the skep`);
    assert.ok(pos.y > 0.5 && pos.y < 1.6, `bee ${i} altitude ${pos.y} out of skep band`);
  }

  // Per-blossom tint: left wings carry instance colors
  const wingsL = meshes.find(
    (mesh) => mesh.count === rig.butterflyCount && mesh !== bodies && mesh !== bees,
  )!;
  assert.ok(wingsL.instanceColor, 'butterfly wings must carry blossom tints');

  rig.dispose();
});

test('wind strength only modulates drift speed, never leaves the anchor bounds', () => {
  const rig: OrchardMicroLifeRig = buildOrchardMicroLife({ isSoftwareGl: false });
  rig.group.visible = true;

  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const bodies = collectInstanced(rig.group).find((mesh) => mesh.count === rig.butterflyCount)!;

  rig.update(2.5, { butterfliesActive: true, beesActive: false, windStrength: 0 });
  for (let i = 0; i < bodies.count; i++) {
    bodies.getMatrixAt(i, m);
    m.decompose(pos, quat, scale);
    const anchor = ORCHARD_BUTTERFLY_ANCHORS[i % ORCHARD_BUTTERFLY_ANCHORS.length];
    const drift = Math.hypot(pos.x - anchor.x, pos.z - anchor.z);
    assert.ok(drift < anchor.r * 1.2 + 0.6, `calm-air butterfly ${i} still anchored`);
  }

  rig.update(2.5, { butterfliesActive: true, beesActive: false, windStrength: 1 });
  for (let i = 0; i < bodies.count; i++) {
    bodies.getMatrixAt(i, m);
    m.decompose(pos, quat, scale);
    const anchor = ORCHARD_BUTTERFLY_ANCHORS[i % ORCHARD_BUTTERFLY_ANCHORS.length];
    const drift = Math.hypot(pos.x - anchor.x, pos.z - anchor.z);
    assert.ok(drift < anchor.r * 1.5 + 0.9, `brisk-breeze butterfly ${i} still anchored`);
  }

  rig.dispose();
});
