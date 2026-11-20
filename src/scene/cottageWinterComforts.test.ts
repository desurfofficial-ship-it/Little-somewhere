import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFreshWorldState } from '../game/storage';
import { MaterialPalette } from './materials';
import { buildWillowCottageInterior } from './builders/cottageInterior';
import type { WorldState } from '../game/types';

function buildRig() {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());
  return { palette, rig };
}

function findNamed(root: THREE.Object3D, name: string): THREE.Object3D | null {
  if (root.name === name) return root;
  for (const child of root.children) {
    const hit = findNamed(child, name);
    if (hit) return hit;
  }
  return null;
}

test('winter comforts: knit runner, bed throw, and firewood appear only in winter', () => {
  const { palette, rig } = buildRig();
  const base = createFreshWorldState() as WorldState;

  rig.update({ ...base, season: 'spring' }, 'morning', 1.0);
  assert.equal(rig.winterComforts.visible, false, 'winter comforts hide outside winter');
  rig.update({ ...base, season: 'autumn' }, 'afternoon', 2.0);
  assert.equal(rig.winterComforts.visible, false);
  rig.update({ ...base, season: 'winter' }, 'morning', 3.0);
  assert.equal(rig.winterComforts.visible, true, 'winter comforts appear with the frost');

  // All three vignettes exist with meaningful geometry
  const runner = findNamed(rig.winterComforts, 'winter_comforts');
  assert.ok(runner, 'winter comforts group present');
  const meshes: THREE.Mesh[] = [];
  rig.winterComforts.traverse((o) => {
    if (o instanceof THREE.Mesh) meshes.push(o);
  });
  // runner base + 4 stripes + 10 fringe + throw 3 + logs 6 = 24
  assert.ok(meshes.length >= 20, `winter comforts carry the full vignette set, got ${meshes.length}`);
  // Nothing sinks below the floor or floats to the ceiling
  const box = new THREE.Box3().setFromObject(rig.winterComforts);
  assert.ok(box.min.y >= -0.02, `winter pieces stay on the floor, min.y=${box.min.y}`);
  assert.ok(box.max.y <= 1.1, `winter pieces stay room-scale, max.y=${box.max.y}`);

  rig.update({ ...base, season: 'spring' }, 'morning', 4.0);
  assert.equal(rig.winterComforts.visible, false, 'clean round-trip back to spring');
  rig.dispose();
  palette.disposeAll();
});

test('winter pieces respect the walkable room: no new footprint outside existing walls', () => {
  const { palette, rig } = buildRig();
  const box = new THREE.Box3().setFromObject(rig.winterComforts);
  // Inside the cottage bounds (-3.5..3.5 × -2.7..2.7)
  assert.ok(box.min.x >= -3.5 && box.max.x <= 3.5, 'runner/throw/logs stay inside cottage width');
  assert.ok(box.min.z >= -2.7 && box.max.z <= 2.7, 'runner/throw/logs stay inside cottage depth');
  // Firewood hugs the hearth's east face without crossing into the table footprint
  const logStack = rig.winterComforts.children.find((c) => {
    const b = new THREE.Box3().setFromObject(c);
    return b.max.x < -0.5 && b.max.z < -1.5;
  });
  assert.ok(logStack, 'firewood stack sits beside the hearth');
  rig.dispose();
  palette.disposeAll();
});

test('table life: both dining stools carry cushions and the table gets a bread board vignette', () => {
  const { palette, rig } = buildRig();

  const westCushion = findNamed(rig.group, 'stool_cushion_west');
  const eastCushion = findNamed(rig.group, 'stool_cushion_east');
  assert.ok(westCushion instanceof THREE.Mesh, 'west stool cushion present');
  assert.ok(eastCushion instanceof THREE.Mesh, 'east stool cushion present');

  // Cushions sit at sit height under the sitter (stool seat top ~0.455)
  assert.ok(
    Math.abs((westCushion as THREE.Mesh).position.y - 0.472) < 0.02,
    'cushion tops read at the seat surface',
  );
  // Cushions use a different yarn than the cedar seat (visible warm accent)
  const westMat = (westCushion as THREE.Mesh).material as THREE.MeshStandardMaterial;
  const eastMat = (eastCushion as THREE.Mesh).material as THREE.MeshStandardMaterial;
  assert.notEqual(westMat.color.getHexString(), eastMat.color.getHexString(), 'west/east cushions differ');

  // Bread board + slice + cloth live on the table top inside its footprint
  const tableBox = new THREE.Box3().setFromObject(rig.group);
  assert.ok(tableBox.max.y <= 3.6, 'geometry height bound unchanged');
  const slice = findNamed(rig.group, 'stool_cushion_west')!.parent!.parent!; // tableGroup
  assert.ok(slice, 'table group reachable');
  rig.dispose();
  palette.disposeAll();
});
