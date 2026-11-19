import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  ORCHARD_GATE,
  ORCHARD_TREES,
  buildFernHollowOrchard,
  type OrchardRig,
} from './builders/orchard';
import { MaterialPalette } from './materials';
import {
  CIRCLE_OBSTACLES,
  LANDMARK_ZONES,
  SEAT_SPOTS,
  isPointWalkable,
} from '../game/worldMap';
import { NAV_NODES, computeWaypointPath, hasLineOfSight } from '../game/navigation';

/** Finds the first child matching a predicate without O(n) allocations leaking. */
function findChild<T extends THREE.Object3D>(group: THREE.Group, pred: (o: THREE.Object3D) => o is T): T | null {
  let found: T | null = null;
  group.traverse((child) => {
    if (!found && pred(child)) found = child;
  });
  return found;
}

test('orchard trees and gate piers mirror their worldMap circle obstacles exactly', () => {
  assert.equal(ORCHARD_TREES.length, 6);
  for (const tree of ORCHARD_TREES) {
    const obstacle = CIRCLE_OBSTACLES.find((c) => c.id === tree.obstacleId);
    assert.ok(obstacle, `missing circle obstacle for ${tree.obstacleId}`);
    assert.equal(obstacle.x, tree.x);
    assert.equal(obstacle.z, tree.z);
    assert.equal(obstacle.radius, 0.52);
  }

  for (const pierX of [ORCHARD_GATE.pierWestX, ORCHARD_GATE.pierEastX]) {
    const pier = CIRCLE_OBSTACLES.find(
      (c) => c.id.startsWith('orchard_gate') && c.x === pierX && c.z === ORCHARD_GATE.z,
    );
    assert.ok(pier, `missing gate pier obstacle at x=${pierX}`);
  }
  // Walkable gate opening between pier clearance bubbles (actor radius 0.42)
  const gap = ORCHARD_GATE.pierEastX - ORCHARD_GATE.pierWestX - 2 * 0.42;
  assert.ok(gap >= 1.7, `gate opening ${gap} must admit a 0.84-wide actor pair`);
});

test('orchard rig instancing, fruit placement and season-tint material sharing', () => {
  const palette = new MaterialPalette();
  const rig: OrchardRig = buildFernHollowOrchard({
    palette,
    shadowTex: new THREE.Texture(),
    signTex: new THREE.Texture(),
    isSoftwareGl: true,
  });

  const instanced: THREE.InstancedMesh[] = [];
  rig.group.traverse((child) => {
    if ((child as THREE.InstancedMesh).isInstancedMesh) instanced.push(child as THREE.InstancedMesh);
  });
  const byCount = (n: number) => instanced.filter((m) => m.count === n);
  assert.ok(byCount(6).length >= 3, 'trunks + two crown layers must hold 6 instances each');
  const fruit = byCount(ORCHARD_TREES.length * 12);
  assert.equal(fruit.length, 1, 'one instanced apple mesh across all trees');
  assert.equal(fruit[0].count, 72);

  // Every apple hangs inside its tree canopy (horizontal reach + height band)
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let i = 0; i < fruit[0].count; i++) {
    fruit[0].getMatrixAt(i, m);
    m.decompose(pos, quat, scale);
    const tree = ORCHARD_TREES.reduce((best, t) => {
      const d = Math.hypot(pos.x - t.x, pos.z - t.z);
      return d < best.d ? { d, t } : best;
    }, { d: Infinity, t: ORCHARD_TREES[0] });
    assert.ok(
      tree.d <= 1.6,
      `fruit ${i} at (${pos.x.toFixed(2)}, ${pos.z.toFixed(2)}) drifted ${tree.d.toFixed(2)} from ${tree.t.obstacleId}`,
    );
    assert.ok(pos.y > 1.6 && pos.y < 3.7, `fruit ${i} height ${pos.y.toFixed(2)} outside canopy band`);
    assert.ok(scale.x > 0.5 && scale.x < 1.3, `fruit ${i} scale ${scale.x} out of hand-tuned range`);
  }

  // Season-tint contract: orchard crowns share the grove's cached materials
  const crownBase = findChild(rig.group, (o): o is THREE.InstancedMesh =>
    (o as THREE.InstancedMesh).isInstancedMesh === true && (o as THREE.InstancedMesh).material === palette.get('grove_crown_base', { color: '#FFFFFF', roughness: 0.85, metalness: 0.0 }),
  );
  const crownTop = findChild(rig.group, (o): o is THREE.InstancedMesh =>
    (o as THREE.InstancedMesh).isInstancedMesh === true && (o as THREE.InstancedMesh).material === palette.get('grove_crown_top', { color: '#FFFFFF', roughness: 0.82, metalness: 0.0 }),
  );
  assert.ok(crownBase, 'orchard crown base must reuse the season-tinted grove material');
  assert.ok(crownTop, 'orchard crown top must reuse the season-tinted grove material');

  rig.dispose();
});

test('orchard bench seat, approach and landmark zone are player-ready', () => {
  const seat = SEAT_SPOTS.find((s) => s.id === 'seat_orchard_bench');
  assert.ok(seat, 'seat_orchard_bench must exist');
  assert.equal(isPointWalkable(seat.approachPos.x, seat.approachPos.z, 0.42), true, 'approach must be walkable');
  assert.equal(isPointWalkable(seat.seatPos.x, seat.seatPos.z, 0.42), false, 'seat rests on the bench obstacle');

  const benchNode = NAV_NODES.find((n) => n.id === 'orchard_bench');
  assert.ok(benchNode);
  assert.equal(hasLineOfSight(benchNode.pos, seat.approachPos, 0.42), true);

  const zone = LANDMARK_ZONES.find((z) => z.id === 'orchard');
  assert.ok(zone, 'orchard landmark zone must exist');
  assert.ok(zone.radius >= 6);

  // Full A* reachability from the plaza to the orchard bench, every leg LOS-clear
  const path = computeWaypointPath({ x: 3.6, z: 1.5 }, seat.approachPos, 0.42);
  assert.ok(path.length >= 1);
  let cursor = { x: 3.6, z: 1.5 };
  for (const wp of path) {
    assert.equal(hasLineOfSight(cursor, wp, 0.42), true, `path leg ${cursor.x},${cursor.z} -> ${wp.x},${wp.z} blocked`);
    cursor = wp;
  }
});
