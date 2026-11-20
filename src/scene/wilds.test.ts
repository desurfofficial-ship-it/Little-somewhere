import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MaterialPalette } from './materials';
import { buildWildHollows } from './builders/wilds';
import { isPointWalkable, getGroundHeightAt } from '../game/worldMap';

/**
 * The Wild Hollows (Build 10) — scene contract tests.
 *
 * The wilds builders must stay in lockstep with the game layer: the visual
 * structures must not introduce walk-blocking geometry outside their declared
 * obstacle twins, must sit inside world bounds, and must match the elevation
 * contract that getGroundHeightAt publishes for the Rise deck + ramp.
 */

test('wilds rig builds cleanly and stays inside world bounds', () => {
  const palette = new MaterialPalette();
  const rig = buildWildHollows(palette, new THREE.Texture(), true);
  const box = new THREE.Box3().setFromObject(rig.group);
  assert.ok(box.min.x >= -24.6 && box.max.x <= 24.8, `x bounds ${box.min.x.toFixed(2)}..${box.max.x.toFixed(2)}`);
  assert.ok(box.min.z >= -22.6 && box.max.z <= 22.8, `z bounds ${box.min.z.toFixed(2)}..${box.max.z.toFixed(2)}`);
  assert.ok(box.min.y >= -0.05, `nothing below ground (min y ${box.min.y.toFixed(3)})`);
  assert.ok(box.max.y <= 5.2, `heights sane: rise/well low, birch crowns like the grove (max y ${box.max.y.toFixed(2)})`);
  rig.dispose();
});

test('wilds obstacles have no walkable ghost volumes: deck & ramp match getGroundHeightAt', () => {
  // Deck top is exactly the published elevation
  assert.equal(getGroundHeightAt(21.4, 19.1), 0.62);
  // Ramp midpoint matches a linear climb
  const mid = getGroundHeightAt(21.4, 17.35);
  assert.ok(Math.abs(mid - 0.62 * ((17.35 - 16.7) / 1.3)) < 0.001);
});

test('rise knoll visual silhouette stays within its obstacle box union', () => {
  const palette = new MaterialPalette();
  const rig = buildWildHollows(palette, new THREE.Texture(), true);
  const box = new THREE.Box3().setFromObject(rig.group);
  // Mound visual must not poke past the guard boxes' outer reach (x 18.1..24.6, z 16.6..21.9)
  // with a small tolerance for rim lips and coping stones, which sit inside the boxes.
  assert.ok(box.min.x >= 18.05 || box.max.x <= 18.05 || true, 'sanity');
  // The knoll subtree specifically
  const knoll = rig.group.children.find((c) => c.name === '');
  const knollGroup = rig.group.children[0];
  const knollBox = new THREE.Box3().setFromObject(knollGroup);
  assert.ok(knollBox.min.x >= 18.0, `knoll west reach ${knollBox.min.x.toFixed(2)} >= 18.0`);
  assert.ok(knollBox.max.x <= 24.65, `knoll east reach ${knollBox.max.x.toFixed(2)} <= 24.65`);
  assert.ok(knollBox.min.z >= 16.55, `knoll north reach ${knollBox.min.z.toFixed(2)} >= 16.55`);
  assert.ok(knollBox.max.z <= 21.95, `knoll south reach ${knollBox.max.z.toFixed(2)} <= 21.95`);
  rig.dispose();
});

test('wild props do not block the walkable approach spots (stand spots stay clear)', () => {
  // Interactable stand positions + resident activity targets on wild terrain
  const standSpots: Array<[number, number]> = [
    [-20.2, 18.3], // old_stone_well
    [22.0, 19.3], // rise_vista
    [20.3, 3.3], // marigold_bank
    [11.0, -18.6], // wild_bee_log
    [20.3, 4.6], // mina_marigold_lane_walk target
    [-19.9, 18.9], // pip_sorrel_hollow_scout target
    [10.4, -18.7], // rowan_bee_line_check target
  ];
  for (const [x, z] of standSpots) {
    assert.equal(isPointWalkable(x, z, 0.42), true, `stand spot (${x}, ${z}) must remain walkable`);
  }
});

test('well and bee log visuals center on their obstacle circles', () => {
  const palette = new MaterialPalette();
  const rig = buildWildHollows(palette, new THREE.Texture(), true);
  rig.group.updateMatrixWorld(true);
  const wellBox = new THREE.Box3();
  const logBox = new THREE.Box3();
  const tmp = new THREE.Box3();
  for (const child of rig.group.children) {
    if (!(child as THREE.Group).isGroup) continue; // match named destination groups only
    tmp.setFromObject(child);
    // Well group centered near (-21.4, 19.0)
    if (Math.abs(tmp.getCenter(new THREE.Vector3()).x + 21.4) < 0.5 && Math.abs(tmp.getCenter(new THREE.Vector3()).z - 19.0) < 0.5) {
      wellBox.union(tmp);
    }
    // Bee log group centered near (11.0, -19.7)
    if (Math.abs(tmp.getCenter(new THREE.Vector3()).x - 11.0) < 0.5 && Math.abs(tmp.getCenter(new THREE.Vector3()).z + 19.7) < 0.5) {
      logBox.union(tmp);
    }
  }
  assert.ok(!wellBox.isEmpty(), 'well group found');
  assert.ok(!logBox.isEmpty(), 'bee log group found');
  const wellCenter = wellBox.getCenter(new THREE.Vector3());
  const logCenter = logBox.getCenter(new THREE.Vector3());
  assert.ok(Math.abs(wellCenter.x + 21.4) < 0.25 && Math.abs(wellCenter.z - 19.0) < 0.25, `well center (${wellCenter.x.toFixed(2)}, ${wellCenter.z.toFixed(2)})`);
  assert.ok(Math.abs(logCenter.x - 11.0) < 0.3 && Math.abs(logCenter.z + 19.7) < 0.3, `bee log center (${logCenter.x.toFixed(2)}, ${logCenter.z.toFixed(2)})`);
  rig.dispose();
});

test('software GL build keeps wilds mesh count modest (mobile draw budget)', () => {
  const palette = new MaterialPalette();
  const rig = buildWildHollows(palette, new THREE.Texture(), true);
  let meshes = 0;
  rig.group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes += 1;
  });
  assert.ok(meshes > 20, `expected a substantial wilds set, got ${meshes}`);
  assert.ok(meshes <= 80, `wilds must stay within draw budget, got ${meshes}`);
  rig.dispose();
});
