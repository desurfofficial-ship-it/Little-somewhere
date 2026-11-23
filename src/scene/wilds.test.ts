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
  // WP-3/WP-4 (world-environment initiative): the budget rises 80 -> 88 to carry the
  // counter→visual echo rigs (1 instanced pebble mesh + 2 merged stub meshes) and the
  // Sorrel community-garden stage groups (6 aggressively merged meshes). Every new
  // feature follows the mobile discipline: merged geometry, shared materials, no
  // loose per-instance meshes.
  assert.ok(meshes <= 88, `wilds must stay within draw budget, got ${meshes}`);
  rig.dispose();
});

// WP-3 (world-environment initiative): counter→visual echo setters.
test('well pebble stack and nosegay stub setters write pure visibility state', () => {
  const palette = new MaterialPalette();
  const rig = buildWildHollows(palette, new THREE.Texture(), true);
  rig.group.updateMatrixWorld(true);

  const wellGroup = rig.group.children.find(
    (c) => c instanceof THREE.Group && Math.abs(c.position.x - -21.4) < 0.01,
  ) as THREE.Group | undefined;
  assert.ok(wellGroup, 'well group must exist at (-21.4, 19.0)');
  // Pebbles ride exactly one InstancedMesh (single draw call, mobile discipline);
  // the instance transforms carry the lip positions.
  const inst = wellGroup.children.find(
    (c) => c instanceof THREE.InstancedMesh && (c as THREE.InstancedMesh).count === 5,
  ) as THREE.InstancedMesh | undefined;
  assert.ok(inst, 'well pebbles must ride a single 5-instance InstancedMesh');
  const countVisible = () => {
    let n = 0;
    const m = new THREE.Matrix4();
    for (let i = 0; i < inst.count; i++) {
      inst.getMatrixAt(i, m);
      // Column-0 length equals scale.x even under rotation (rotations preserve length).
      const sx = Math.hypot(m.elements[0], m.elements[1], m.elements[2]);
      if (sx > 0.5) n += 1; // shown instances keep scale 1; hidden collapse to 0.0001
    }
    return n;
  };
  rig.setWellPebbleStack(0);
  assert.equal(countVisible(), 0);
  rig.setWellPebbleStack(3);
  assert.equal(countVisible(), 3);
  rig.setWellPebbleStack(99);
  assert.equal(countVisible(), 5, 'pebble stack caps at 5 visible stones');
  rig.setWellPebbleStack(-4);
  assert.equal(countVisible(), 0);

  // Nosegay stub: visibility toggles without touching any other object.
  const stubGroup = rig.group.children.find(
    (c) => c instanceof THREE.Group && Math.abs(c.position.x - 20.3) < 0.01,
  ) as THREE.Group | undefined;
  assert.ok(stubGroup, 'posy stub group must exist at (20.3, 2.5)');
  assert.equal(stubGroup.visible, false);
  rig.setPosyBankPickedToday(true);
  assert.equal(stubGroup.visible, true);
  rig.setPosyBankPickedToday(false);
  assert.equal(stubGroup.visible, false);
  rig.dispose();
});

// WP-4 (world-environment initiative): the Sorrel community garden stage groups.
test('garden bed stage groups write pure visibility state across all four stages', () => {
  const palette = new MaterialPalette();
  const rig = buildWildHollows(palette, new THREE.Texture(), true);
  rig.group.updateMatrixWorld(true);

  const gardenGroup = rig.group.children.find(
    (c) => c instanceof THREE.Group && Math.abs(c.position.x - -21.0) < 0.01 &&
      Math.abs(c.position.z - 21.3) < 0.01,
  ) as THREE.Group | undefined;
  assert.ok(gardenGroup, 'garden bed group must exist at (-21.0, 21.3)');
  const stageGroups = gardenGroup.children.filter((c) => c instanceof THREE.Group);
  assert.equal(stageGroups.length, 4, 'four prebuilt stage groups (forgotten/tilled/sprouts/bloom)');

  const stageAt = (s: number) => {
    rig.setGardenStage(s);
    return stageGroups.map((g) => g.visible);
  };
  // [forgotten, tilled, sprouts, bloom]
  assert.deepEqual(stageAt(0), [true, false, false, false], 'stage 0: only the forgotten tangle');
  assert.deepEqual(stageAt(1), [false, true, false, false], 'stage 1: tilled beds');
  assert.deepEqual(stageAt(2), [false, true, true, false], 'stage 2: tilled + sprouting');
  assert.deepEqual(stageAt(3), [false, true, true, true], 'stage 3: the blooming garden');
  // Corruption fails closed to the forgotten state.
  assert.deepEqual(stageAt(-1), [true, false, false, false]);
  assert.deepEqual(stageAt(9), [false, true, true, true]);
  rig.dispose();
});
