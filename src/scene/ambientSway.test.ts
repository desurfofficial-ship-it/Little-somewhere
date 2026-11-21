import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  applyAmbientSway,
  registerAmbientSwinger,
  updateAmbientMotion,
  ambientMotionRegistrySize,
} from './ambientSway';
import { MaterialPalette } from './materials';
import { buildGroveTreesInstanced } from './builders/vegetation';
import { buildStorybookBakery, buildStorybookBookNook, buildStorybookBarnabyWoodshop, type BuildingBuildContext } from './builders/buildings';
import { buildMeadowDressing } from './builders/botanicalDressing';

/**
 * BUILD 04 — ambient motion contracts (VISUAL_IDENTITY §7 "Subtle Living
 * Motion"): shader-driven crown/tuft sway + hanging-sign swingers, both
 * draw-call-neutral and driven by ONE shared-clock call per frame.
 */

test('BUILD 04: grove crowns carry the shader sway, orchard keeps its own JS sway', () => {
  const palette = new MaterialPalette();
  const rig = buildGroveTreesInstanced(palette, false);
  assert.ok(rig.crownBaseMat.userData.swayUniforms, 'grove crown base is sway-hooked');
  assert.ok(rig.crownTopMat.userData.swayUniforms, 'grove crown top is sway-hooked');
  // The orchard reuses the ORIGINAL grove_crown_* cache keys — those materials
  // must remain un-hooked so the orchard's instance-sway stays authoritative.
  const orchardCrown = palette.get('grove_crown_base', { color: '#FFFFFF', roughness: 0.85, metalness: 0 });
  assert.ok(!orchardCrown.userData.swayUniforms, 'orchard crown material is not sway-hooked');
  // The shared clock reaches the sway uniforms through the driver.
  const uniforms = rig.crownBaseMat.userData.swayUniforms as { uTime: { value: number }; uWind: { value: number } };
  updateAmbientMotion(3.5, 0.8, 0);
  assert.equal(uniforms.uTime.value, 3.5, 'elapsed reaches the sway uniforms');
  assert.equal(uniforms.uWind.value, 0.8, 'wind reaches the sway uniforms');
});

test('BUILD 04: meadow tufts register sway materials without swingers', () => {
  const palette = new MaterialPalette();
  const before = ambientMotionRegistrySize();
  buildMeadowDressing(palette, false);
  const after = ambientMotionRegistrySize();
  assert.equal(after.sway - before.sway, 3, 'grass + stem + blossom materials register once each');
  assert.equal(after.swingers, before.swingers, 'meadow dressing adds no swingers');
});

test('BUILD 04: hanging signs swing about the bracket mount, breeze-scaled', () => {
  const palette = new MaterialPalette();
  const ctx: BuildingBuildContext = {
    palette,
    shadowTex: new THREE.Texture(),
    terracottaRoofTex: new THREE.Texture(),
    sageRoofTex: new THREE.Texture(),
    slateRoofTex: new THREE.Texture(),
    windowMaterials: [],
    lanternMaterials: [],
    flowerGroups: [],
  };
  const before = ambientMotionRegistrySize().swingers;
  const bakery = buildStorybookBakery(ctx);
  const nook = buildStorybookBookNook(ctx);
  const woodshop = buildStorybookBarnabyWoodshop(ctx);
  const after = ambientMotionRegistrySize().swingers;
  assert.equal(after - before, 3, 'bakery + book nook + woodshop each register one sign swing');
  // Drive the shared clock: exactly the registered pivots move, and the swing
  // is breeze-scaled (wind 0 restores the rest pose).
  const movingAtWind = new Set<THREE.Object3D>();
  for (const root of [bakery, nook, woodshop]) {
    root.traverse((o) => {
      if (o.rotation.x !== 0 || o.rotation.z !== 0) movingAtWind.add(o);
    });
  }
  updateAmbientMotion(0.62, 1.0, 0);
  let swung = 0;
  for (const root of [bakery, nook, woodshop]) {
    root.traverse((o) => {
      if (o.rotation.x !== 0 && o.rotation.z !== 0) swung++;
    });
  }
  assert.ok(swung >= 3, `registered sign pivots swing (got ${swung})`);
  updateAmbientMotion(0.62, 0.0, 0);
  for (const root of [bakery, nook, woodshop]) {
    root.traverse((o) => {
      if ((o.rotation.x !== 0 || o.rotation.z !== 0) && !movingAtWind.has(o)) {
        assert.fail('non-registered object moved');
      }
    });
  }
  void applyAmbientSway;
  void registerAmbientSwinger;
});
