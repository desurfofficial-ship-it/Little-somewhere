import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFreshWorldState } from '../game/storage';
import { MaterialPalette } from './materials';
import { buildCopperwheelInterior } from './builders/copperwheelInterior';
import { buildHearthCrumbInterior } from './builders/bakeryInterior';
import { buildWillowCottageInterior } from './builders/cottageInterior';
import { buildCopperKettle } from './builders/interiorKit';

/**
 * BUILD 02 Stage 4 — interior craftsmanship contracts (Doc 05 §4.2/§4.3).
 */

function findNamed(root: THREE.Object3D, name: string): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined;
  root.traverse((o) => {
    if (o.name === name) found = o;
  });
  return found;
}

test('interior kit: one shared copper-kettle recipe, three room identities', () => {
  const palette = new MaterialPalette();
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => g;

  const hearth = buildCopperKettle(palette, trackGeo, { style: 'hearth-sphere' });
  const petite = buildCopperKettle(palette, trackGeo, { style: 'petite' });
  const stove = buildCopperKettle(palette, trackGeo, { style: 'stove-cylinder', glowKnob: true, spoutSide: -1 });

  // Named parts, one recipe (body/lid/spout/handle), no spout-side drift
  for (const rig of [hearth, petite, stove]) {
    for (const part of ['kettle_body', 'kettle_lid', 'kettle_spout', 'kettle_handle']) {
      assert.ok(findNamed(rig.group, part), `${part} present`);
    }
  }
  // The lid is lathe-crowned on every room (curved-surface program rides the kit)
  for (const rig of [hearth, petite, stove]) {
    const lid = findNamed(rig.group, 'kettle_lid') as THREE.Mesh;
    assert.ok(lid.geometry instanceof THREE.LatheGeometry, 'kettle lid is lathe-crowned');
  }
  // Per-room massing identity
  const hearthBody = hearth.body.geometry as THREE.SphereGeometry;
  const petiteBody = petite.body.geometry as THREE.SphereGeometry;
  const stoveBody = stove.body.geometry as THREE.CylinderGeometry;
  assert.ok(Math.abs(hearthBody.parameters.radius - 0.17) < 0.001, 'hearth r 0.17');
  assert.ok(Math.abs(petiteBody.parameters.radius - 0.13) < 0.001, 'petite r 0.13');
  assert.ok(Math.abs(stoveBody.parameters.radiusTop - 0.16) < 0.001, 'stove cylinder body');
  // Glow knob only when asked, and it honors the provided tracked material
  assert.ok(!hearth.glowKnob && !petite.glowKnob, 'no stray glow knobs');
  const knob = stove.glowKnob!;
  assert.equal(knob.name, 'kettle_glow_knob');
  // Spout side: stove spout points −x
  assert.ok((stove.spout.position.x as number) < 0, 'stove spout mirrors to the −x corner');

  palette.disposeAll();
});

test('Copperwheel interior gains its four season groups (the last unseasonal room)', () => {
  const palette = new MaterialPalette();
  const rig = buildCopperwheelInterior(palette, new THREE.Texture(), { isSoftwareGl: true });
  const life = rig.seasonLife;
  const seasons = [life.spring, life.summer, life.autumn, life.winter];
  for (const g of seasons) {
    assert.ok(g.name.startsWith('copperwheel_season_'), `named: ${g.name}`);
    assert.equal(g.visible, false, 'ships hidden');
    assert.ok(g.children.length >= 2, 'each season carries its dressing');
  }
  // Winter carries the Doc 05 §4.3 pieces: flannel bench roll + evergreen sprig
  const winterBox = new THREE.Box3().setFromObject(life.winter);
  assert.ok(winterBox.min.y > 0.6, 'winter pieces sit on furniture tops (clearance law exempt)');
  // The gate flips exactly one group on per season
  const world = createFreshWorldState();
  world.season = 'winter';
  rig.update(world, 'dusk', 0);
  assert.ok(life.winter.visible && !life.spring.visible && !life.summer.visible && !life.autumn.visible,
    'winter gate: only the winter group shows');
  world.season = 'summer';
  rig.update(world, 'dusk', 0);
  assert.ok(life.summer.visible && !life.winter.visible, 'summer gate flips cleanly');
  rig.dispose();
  palette.disposeAll();
});

test('bakery winter runner is now a woven-edge extrusion (9 slabs → 2 meshes)', () => {
  const palette = new MaterialPalette();
  const rig = buildHearthCrumbInterior(palette, new THREE.Texture(), { isSoftwareGl: true });
  const winter = rig.seasonLife.winter;
  const runner = findNamed(rig.group, 'winter_counter_runner') ?? winter.children.find((c) => c.name === 'winter_counter_runner');
  assert.ok(runner, 'winter counter runner present');
  const meshes: THREE.Mesh[] = [];
  runner!.traverse((o) => {
    if (o instanceof THREE.Mesh) meshes.push(o);
  });
  assert.equal(meshes.length, 2, `runner is body + merged bands, got ${meshes.length}`);
  const bodyGeo = meshes[0].geometry;
  assert.ok(bodyGeo instanceof THREE.ExtrudeGeometry, 'runner body is the scalloped extrusion');
  rig.dispose();
  palette.disposeAll();
});

test('curved-surface program: pillows are soft forms, clock cases carry beveled tops', () => {
  const palette = new MaterialPalette();
  const cottage = buildWillowCottageInterior(palette, new THREE.Texture());
  const cw = buildCopperwheelInterior(palette, new THREE.Texture(), { isSoftwareGl: true });

  // Cottage bed pillows: scaled spheres sharing one geometry (position-filtered
  // to the bed's two pillow slots at x −0.54, z ±0.34 — other squashed spheres
  // exist in the room by design)
  const pillows: THREE.Mesh[] = [];
  cottage.group.traverse((o) => {
    if (
      o instanceof THREE.Mesh &&
      o.geometry instanceof THREE.SphereGeometry &&
      Math.abs(o.position.x + 0.54) < 0.02 &&
      Math.abs(Math.abs(o.position.z) - 0.34) < 0.02
    ) {
      pillows.push(o);
    }
  });
  assert.equal(pillows.length, 2, 'both bed pillows are curved forms');
  assert.ok(pillows[0].geometry === pillows[1].geometry, 'pillow geometry shared');

  // Copperwheel clock cases: extruded beveled profile, shared geometry
  const cases: THREE.Mesh[] = [];
  cw.group.traverse((o) => {
    if (o instanceof THREE.Mesh && o.geometry instanceof THREE.ExtrudeGeometry) {
      const size = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
      if (size.x < 0.2 && size.y < 0.25 && size.z < 0.2) cases.push(o);
    }
  });
  assert.ok(cases.length >= 14, `mended-clock cases beveled (${cases.length})`);
  assert.ok(cases.every((m) => m.geometry === cases[0].geometry), 'clock case geometry shared');

  cottage.dispose();
  cw.dispose();
  palette.disposeAll();
});
