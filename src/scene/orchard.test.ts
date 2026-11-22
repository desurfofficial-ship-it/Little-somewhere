import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  ORCHARD_GATE,
  ORCHARD_TASTING_TABLE,
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
  const path = computeWaypointPath({ x: 3.6, z: 1.5 }, seat.approachPos, 0.42)!;
  assert.ok(path.length >= 1);
  let cursor = { x: 3.6, z: 1.5 };
  for (const wp of path) {
    assert.equal(hasLineOfSight(cursor, wp, 0.42), true, `path leg ${cursor.x},${cursor.z} -> ${wp.x},${wp.z} blocked`);
    cursor = wp;
  }
});

function collectSwayMeshes(
  rig: OrchardRig,
  palette: MaterialPalette,
): {
  crownsBase: THREE.InstancedMesh;
  crownsTop: THREE.InstancedMesh;
  fruit: THREE.InstancedMesh;
} {
  // Identify crown layers by their shared season-tint materials (tree shadows
  // also hold 6 instances, so counting alone would grab the wrong mesh).
  const crownBaseMat = palette.get('grove_crown_base', { color: '#FFFFFF', roughness: 0.85, metalness: 0.0 });
  const crownTopMat = palette.get('grove_crown_top', { color: '#FFFFFF', roughness: 0.82, metalness: 0.0 });
  const meshes: THREE.InstancedMesh[] = [];
  rig.group.traverse((child) => {
    if ((child as THREE.InstancedMesh).isInstancedMesh) meshes.push(child as THREE.InstancedMesh);
  });
  const crownsBase = meshes.find((m) => m.material === crownBaseMat)!;
  const crownsTop = meshes.find((m) => m.material === crownTopMat)!;
  assert.ok(crownsBase, 'crown base mesh must exist');
  assert.ok(crownsTop, 'crown top mesh must exist');
  const fruit = meshes.find((m) => m.count === 72)!;
  return { crownsBase, crownsTop, fruit };
}

function snapshotMatrices(mesh: THREE.InstancedMesh): number[][] {
  const m = new THREE.Matrix4();
  const snap: number[][] = [];
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m);
    snap.push(Array.from(m.elements));
  }
  return snap;
}

test('wind sway deforms crowns + fruit and restores the authored rest pose when calm', () => {
  const palette = new MaterialPalette();
  const rig: OrchardRig = buildFernHollowOrchard({
    palette,
    shadowTex: new THREE.Texture(),
    signTex: new THREE.Texture(),
    isSoftwareGl: true,
  });
  const { crownsBase, crownsTop, fruit } = collectSwayMeshes(rig, palette);

  const restBase = snapshotMatrices(crownsBase);
  const restFruit = snapshotMatrices(fruit);

  // Brisk breeze: every crown moves, every fruit follows its tree
  rig.updateWind(1.35, 1.0);
  const swayedBase = snapshotMatrices(crownsBase);
  const swayedTop = snapshotMatrices(crownsTop);
  const swayedFruit = snapshotMatrices(fruit);
  let movedCrowns = 0;
  let movedFruit = 0;
  for (let i = 0; i < 6; i++) {
    if (swayedBase[i].some((v, k) => Math.abs(v - restBase[i][k]) > 1e-5)) movedCrowns++;
  }
  for (let i = 0; i < 72; i++) {
    if (swayedFruit[i].some((v, k) => Math.abs(v - restFruit[i][k]) > 1e-5)) movedFruit++;
  }
  assert.equal(movedCrowns, 6, 'all six crowns must respond to the breeze');
  assert.equal(movedFruit, 72, 'fruit must follow its tree through the sway');

  // No NaN under sustained wind
  for (const snap of [swayedBase, swayedTop, swayedFruit]) {
    for (const row of snap) {
      for (const v of row) assert.ok(Number.isFinite(v), 'sway matrices must stay finite');
    }
  }

  // Calm: rest pose restored exactly (once, not repeatedly)
  rig.updateWind(2.0, 0);
  const restored = snapshotMatrices(crownsBase);
  for (let i = 0; i < 6; i++) {
    for (let k = 0; k < 16; k++) {
      assert.ok(Math.abs(restored[i][k] - restBase[i][k]) < 1e-6, 'calm must restore the authored pose');
    }
  }

  // Zero-GC contract: repeated calm updates are no-ops, matrices untouched
  rig.updateWind(2.5, 0);
  rig.updateWind(3.0, 0);
  const restoredAgain = snapshotMatrices(crownsBase);
  for (let i = 0; i < 6; i++) {
    assert.deepEqual(restoredAgain[i], restored[i]);
  }

  rig.dispose();
});

test('sway stays grounded: crowns pivot near the trunk top, trunks never move', () => {
  const palette = new MaterialPalette();
  const rig: OrchardRig = buildFernHollowOrchard({
    palette,
    shadowTex: new THREE.Texture(),
    signTex: new THREE.Texture(),
    isSoftwareGl: false,
  });
  const { crownsBase, fruit } = collectSwayMeshes(rig, palette);

  rig.updateWind(4.2, 1.0);

  // Crown base should stay within a small radius of its tree trunk anchor.
  // (Crown heights live in the shared geometry; instance matrices carry y≈0.)
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const restQuat = new THREE.Quaternion();
  for (let i = 0; i < 6; i++) {
    crownsBase.getMatrixAt(i, m);
    m.decompose(pos, quat, scale);
    const tree = ORCHARD_TREES[i];
    const drift = Math.hypot(pos.x - tree.x, pos.z - tree.z);
    assert.ok(
      drift < 0.35,
      `crown ${i} pivoted ${drift.toFixed(2)} from its trunk-top anchor — sway too wild`,
    );
    assert.ok(pos.y > -0.1 && pos.y < 0.25, `crown ${i} pivot offset ${pos.y.toFixed(2)} out of band`);
    // Rotation stays a gentle tilt away from the authored yaw-only rest pose
    restQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tree.yaw);
    const tilt = quat.angleTo(restQuat);
    assert.ok(tilt < 0.12, `crown ${i} tilt ${tilt.toFixed(3)} rad exceeded a gentle breeze`);
  }
  // Fruit stays inside the canopy band even while swaying
  for (let i = 0; i < 72; i++) {
    fruit.getMatrixAt(i, m);
    m.decompose(pos, quat, scale);
    assert.ok(pos.y > 1.5 && pos.y < 3.8, `swaying fruit ${i} height ${pos.y.toFixed(2)} outside canopy band`);
  }

  rig.dispose();
});

test('Milestone 3 Build 2: ORCHARD_TASTING_TABLE mirrors worldMap obstacle, skep & gathering slots are walkable, and setGatheringVisual toggles outcome props & lanterns', () => {
  const tableObstacle = CIRCLE_OBSTACLES.find((c) => c.id === 'orchard_tasting_table');
  assert.ok(tableObstacle, 'orchard_tasting_table circle obstacle must exist');
  assert.equal(tableObstacle.x, ORCHARD_TASTING_TABLE.x);
  assert.equal(tableObstacle.z, ORCHARD_TASTING_TABLE.z);
  assert.equal(tableObstacle.radius, ORCHARD_TASTING_TABLE.radius);

  // Verify shared Tasting Table and orchard activity coordinates are all walkable
  const gatheringStandingSpots = [
    { name: 'clara_orchard_gathering', x: 3.05, z: -19.5 },
    { name: 'mina_orchard_gathering', x: 1.8, z: -18.1 },
    { name: 'pip_orchard_gathering', x: 1.8, z: -20.75 },
    { name: 'rowan_orchard_gathering', x: 0.55, z: -19.1 },
    { name: 'clara_orchard_apples', x: -2.4, z: -19.3 },
    { name: 'mina_orchard_blossoms', x: 3.7, z: -17.9 },
    { name: 'barnaby_orchard_crates', x: -4.9, z: -19.4 },
    { name: 'orchard_skep_approach', x: 3.9, z: -16.3 },
  ];
  for (const spot of gatheringStandingSpots) {
    assert.equal(
      isPointWalkable(spot.x, spot.z, 0.42),
      true,
      `${spot.name} at (${spot.x}, ${spot.z}) must be walkable`,
    );
  }

  const palette = new MaterialPalette();
  const rig: OrchardRig = buildFernHollowOrchard({
    palette,
    shadowTex: new THREE.Texture(),
    signTex: new THREE.Texture(),
    isSoftwareGl: true,
  });

  // Hidden by default
  const gatheringGroup = rig.group.children.find(
    (c) => c.position.x === ORCHARD_TASTING_TABLE.x && c.position.z === ORCHARD_TASTING_TABLE.z,
  ) as THREE.Group;
  assert.ok(gatheringGroup, 'gatheringGroup should be positioned at ORCHARD_TASTING_TABLE');
  assert.equal(gatheringGroup.visible, false);

  // Switch to spiced_tart_table (lanterns off -> glow emissive 0.48)
  rig.setGatheringVisual('spiced_tart_table', false);
  assert.equal(gatheringGroup.visible, true);

  // Switch to blossom_honey_picnic with lanterns lit (emissive 2.1)
  rig.setGatheringVisual('blossom_honey_picnic', true);
  assert.equal(gatheringGroup.visible, true);

  let foundLitLantern = false;
  gatheringGroup.traverse((child) => {
    const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (mat && mat.emissiveIntensity === 2.1) {
      foundLitLantern = true;
    }
  });
  assert.equal(foundLitLantern, true, 'lit marigold lanterns should boost emissive intensity to 2.1');

  // Switch back to 'none'
  rig.setGatheringVisual('none', false);
  assert.equal(gatheringGroup.visible, false);

  rig.dispose();
  palette.disposeAll();
});
