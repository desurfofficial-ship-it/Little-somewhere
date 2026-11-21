import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  buildStorybookArthurWorkshop,
  buildStorybookBarnabyWoodshop,
  buildStorybookBakery,
  buildStorybookBookNook,
  type BuildingBuildContext,
} from './builders/buildings';
import { buildStorybookBench, buildStorybookTeaCart } from './builders/landmarks';
import { buildCopperwheelPorchDressing } from './builders/copperwheelInterior';
import { buildMeadowDressing, buildStructureDressing } from './builders/botanicalDressing';
import { MaterialPalette } from './materials';
import { isPointWalkable } from '../game/worldMap';

/**
 * BUILD 02 Stage 3 — exterior craft contracts (Doc 05 §2.2/§3.2/§5.2).
 * Every upgrade is additive and mesh-light: merged geometry, named parts,
 * seasonal groups, and the second-roof-element rule completed.
 */

function makeCtx(): { ctx: BuildingBuildContext; cleanup(): void } {
  const palette = new MaterialPalette();
  const dummyTex = new THREE.Texture();
  // Plain textures: roof generators need DOM; builders only ASSIGN these.
  const terracottaRoofTex = new THREE.Texture();
  const sageRoofTex = new THREE.Texture();
  const slateRoofTex = new THREE.Texture();
  const windowMaterials: THREE.MeshStandardMaterial[] = [];
  const lanternMaterials: THREE.MeshStandardMaterial[] = [];
  const flowerGroups: THREE.Group[] = [];
  return {
    ctx: {
      palette,
      shadowTex: dummyTex,
      terracottaRoofTex,
      sageRoofTex,
      slateRoofTex,
      windowMaterials,
      lanternMaterials,
      flowerGroups,
    },
    cleanup() {
      terracottaRoofTex.dispose();
      sageRoofTex.dispose();
      slateRoofTex.dispose();
      palette.disposeAll();
    },
  };
}

function findNamed(root: THREE.Object3D, name: string): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined;
  root.traverse((o) => {
    if (o.name === name) found = o;
  });
  return found;
}

test('Copperwheel completion: full craft set + workshop oriel massing break', () => {
  const { ctx, cleanup } = makeCtx();
  const workshop = buildStorybookArthurWorkshop(ctx);
  workshop.updateMatrixWorld(true);

  // The craft flags produce sill band, quoin blocks, gable infill + bargeboards,
  // loft vents and the tapered chimney — count the distinctive parts.
  const boxes = workshop.children.filter(
    (o): o is THREE.Mesh => o instanceof THREE.Mesh && o.geometry instanceof THREE.BoxGeometry,
  );
  assert.ok(boxes.length >= 20, `craft pass adds substantial trim mass, got ${boxes.length}`);
  // Tapered chimney: three stacked diminishing boxes + rim (4 boxes) + the
  // terracotta pot cylinder above them (the box default is 2 boxes + rim).
  const chimneyMeshes = boxes.filter(
    (m) => m.position.y > 3.0 && Math.abs(m.position.x - 1.8) < 0.3 && Math.abs(m.position.z + 1.1) < 0.3,
  );
  assert.ok(chimneyMeshes.length >= 4, `tapered chimney stack present, got ${chimneyMeshes.length}`);
  const potNearChimney = workshop.children.some(
    (o): o is THREE.Mesh =>
      o instanceof THREE.Mesh &&
      o.geometry instanceof THREE.CylinderGeometry &&
      Math.abs(o.position.x - 1.8) < 0.3 &&
      Math.abs(o.position.z + 1.1) < 0.3 &&
      o.position.y > 5.0,
  );
  assert.ok(potNearChimney, 'tapered stack crowns with its terracotta pot');
  // The oriel: cedar body + glass pane + brass cap protruding west at upper-wall height
  const orielBody = boxes.find(
    (m) => m.position.y > 2.8 && m.position.y < 3.2 && m.position.x < -3 && m.geometry instanceof THREE.BoxGeometry,
  );
  assert.ok(orielBody, 'workshop oriel body protrudes from the west upper wall');
  const pane = workshop.children.find(
    (o): o is THREE.Mesh =>
      o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && o.material.emissive !== undefined &&
      o.position.y > 2.8 && o.position.x < -3,
  );
  assert.ok(pane, 'oriel carries its warm glass pane');
  // The oriel joins the dusk window schedule
  assert.ok(
    ctx.windowMaterials.some((m) => m.emissive.getHexString() === 'ff9f38'),
    'oriel glass registered with the window materials for the dusk glow ladder',
  );
  cleanup();
});

test('Woodshop gains the ridge dormer (second roof element rule)', () => {
  const { ctx, cleanup } = makeCtx();
  const woodshop = buildStorybookBarnabyWoodshop(ctx);
  woodshop.updateMatrixWorld(true);
  // Dormer: a small wall-material body + beveled mini gable + louvred face on the north slope
  const dormerBody = woodshop.children.find(
    (o): o is THREE.Mesh =>
      o instanceof THREE.Mesh &&
      o.geometry instanceof THREE.BoxGeometry &&
      o.position.z < -2.4 &&
      o.position.y > 3.4 &&
      Math.abs(o.position.x - 5.6 * 0.14) < 0.2,
  );
  assert.ok(dormerBody, 'ridge dormer body sits on the north slope');
  const dormerRoof = woodshop.children.find(
    (o): o is THREE.Mesh => o instanceof THREE.Mesh && o.geometry instanceof THREE.ExtrudeGeometry && o.position.z < -2.4,
  );
  assert.ok(dormerRoof, 'dormer carries its own beveled mini gable');
  cleanup();
});

test('Tea cart completion: spoked wheels, scalloped valance, grip wrap (V5 object gate)', () => {
  const palette = new MaterialPalette();
  const dummyTex = new THREE.Texture();
  const cart = buildStorybookTeaCart(palette, dummyTex);
  // Spokes: a merged cedar mesh inside each wheel position
  const spokeMeshes = cart.children.filter((o) => o.name === 'wheel_spokes');
  assert.equal(spokeMeshes.length, 2, 'one merged spoke set per rear wheel');
  const valance = findNamed(cart, 'canopy_scalloped_valance');
  assert.ok(valance, 'scalloped valance present');
  assert.ok(findNamed(cart, 'handle_grip_wrap'), 'handle carries its worn grip wrap');
  palette.disposeAll();
});

test('Window planters bloom as merged 3-bud tufts (template fingerprint removed, mesh count down)', () => {
  const { ctx, cleanup } = makeCtx();
  const nook = buildStorybookBookNook(ctx);
  assert.ok(ctx.flowerGroups.length >= 2, 'nook windows registered their bloom groups');
  for (const blooms of ctx.flowerGroups) {
    const meshes = blooms.children.filter((o): o is THREE.Mesh => o instanceof THREE.Mesh);
    assert.ok(
      meshes.length <= 6 && meshes.length >= 2,
      `each planter merges to a handful of meshes (1 leaf + petals), got ${meshes.length}`,
    );
    // The leaf tier is one merged geometry carrying all five lobes
    const leafMesh = meshes.find((m) => (m.geometry as THREE.BufferGeometry).attributes.position.count >= 60);
    assert.ok(leafMesh, 'leaf lobes are merged into one geometry');
  }
  cleanup();
});

test('Bench: crowned seat slats + hidden winter wool cushions with contract intact', () => {
  const palette = new MaterialPalette();
  const dummyTex = new THREE.Texture();
  const bench = buildStorybookBench(palette, dummyTex);
  bench.updateMatrixWorld(true);
  assert.equal(Number(bench.userData.seatTopY), 0.365, 'seat contract untouched');
  assert.equal(Number(bench.userData.backrestFrontZ), -0.262, 'backrest contract untouched');
  // Slats became extruded crowned profiles sharing ONE geometry
  const extruded = bench.children.filter(
    (o): o is THREE.Mesh => o instanceof THREE.Mesh && o.geometry instanceof THREE.ExtrudeGeometry,
  );
  assert.equal(extruded.length, 4, 'four crowned seat slats');
  assert.ok(
    extruded.every((m) => m.geometry === extruded[0].geometry),
    'slat geometry is shared (memory discipline)',
  );
  // Crown peak stays within a thumb's height of the 0.365 contract
  const slatBox = new THREE.Box3().setFromObject(extruded[0]);
  assert.ok(slatBox.max.y < 0.39, `crown peak ${slatBox.max.y.toFixed(3)} stays near the seat contract`);
  const cushions = bench.userData.winterCushions as THREE.Group;
  assert.ok(cushions && !cushions.visible, 'winter cushions ship hidden');
  palette.disposeAll();
});

test('Copperwheel porch joins Doorways of the Lane (four season groups)', () => {
  const palette = new MaterialPalette();
  const dummyTex = new THREE.Texture();
  const porch = buildCopperwheelPorchDressing(palette, dummyTex);
  const life = porch.userData.porchSeasonLife as
    | { spring: THREE.Group; summer: THREE.Group; autumn: THREE.Group; winter: THREE.Group }
    | undefined;
  assert.ok(life, 'porch exposes its season rig');
  const seasons = [life!.spring, life!.summer, life!.autumn, life!.winter];
  for (const g of seasons) {
    assert.ok(g.name.startsWith('copperwheel_porch_'), `season group named: ${g.name}`);
    assert.equal(g.visible, false, 'season groups ship hidden');
    assert.ok(g.children.length > 0, 'each season carries its dressing');
  }
  // Winter carries the frost roll + evergreen sprig; spring the herb pot
  const winterNames = life!.winter.children.map((o) => o.type);
  assert.ok(life!.winter.children.length >= 2, 'winter dressing present');
  assert.ok(life!.spring.children.length >= 4, 'spring herb pot + buds present');
  palette.disposeAll();
  dummyTex.dispose();
});

test('Meadow spring spread re-tints the same instances deterministically', () => {
  const palette = new MaterialPalette();
  const meadow = buildMeadowDressing(palette, true);
  assert.ok(meadow.placementPoints.some((p) => p.kind === 'flower'), 'flowers placed');
  const colors: string[] = [];
  const c = new THREE.Color();
  // The blossom mesh is the small-dodecahedron instanced layer (clover/grass
  // instanced layers share the group and also carry instanceColor).
  meadow.group.updateMatrixWorld(true);
  const blossom = meadow.group.children.find((o): o is THREE.InstancedMesh => {
    if (!(o instanceof THREE.InstancedMesh) || !o.instanceColor) return false;
    o.geometry.computeBoundingSphere();
    return o.geometry.boundingSphere!.radius < 0.12;
  })!;
  assert.ok(blossom, 'blossom instanced layer found');
  const count = blossom.instanceColor!.count;
  for (let i = 0; i < count; i++) {
    blossom.getColorAt(i, c);
    colors.push(c.getHexString());
  }
  meadow.setSpringSpread(true);
  const springColors: string[] = [];
  for (let i = 0; i < count; i++) {
    blossom.getColorAt(i, c);
    springColors.push(c.getHexString());
  }
  assert.ok(
    springColors.some((h) => !colors.includes(h)),
    'spring widens the petal-tone palette with new hues',
  );
  meadow.setSpringSpread(false);
  const restored: string[] = [];
  for (let i = 0; i < count; i++) {
    blossom.getColorAt(i, c);
    restored.push(c.getHexString());
  }
  assert.deepEqual(restored, colors, 'non-spring restores the standard palette exactly');
  palette.disposeAll();
});

test('Structure dressing: cottages settle into relational tufts, legally placed', () => {
  const palette = new MaterialPalette();
  const dressing = buildStructureDressing(palette);
  const instanced = dressing.group.children.filter(
    (o): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh,
  );
  assert.equal(instanced.length, 2, 'two instanced draw calls (clover + moss)');
  for (const inst of instanced) {
    assert.ok(inst.count > 4, `dressing placed (count ${inst.count})`);
    // Every tuft stays clear of the walk lanes (placement law)
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    for (let i = 0; i < inst.count; i++) {
      inst.getMatrixAt(i, m);
      pos.setFromMatrixPosition(m);
      assert.ok(
        isPointWalkable(pos.x, pos.z, 0.1),
        `tuft at (${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}) stays off blocked volumes`,
      );
    }
  }
  palette.disposeAll();
});

test('Bakery build remains green with the crowned-bench bevel sweep world (smoke)', () => {
  const { ctx, cleanup } = makeCtx();
  const bakery = buildStorybookBakery(ctx);
  bakery.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(bakery);
  assert.ok(box.max.y > 4.5 && box.max.y < 7.5, 'bakery silhouette stays in its established band');
  cleanup();
});
