import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { composeEnvironmentState } from '../game/environment';
import { createFreshWorldState } from '../game/storage';
import { EnvironmentVisualController } from './environmentRenderer';

/**
 * Build 01 Phase 1 lighting-contract tests (review follow-up): the season-aware
 * hemisphere ground (Doc 06 §3.2), the dusk rim curve (Doc 06 §3.3), and the
 * winter cobble value recalibration (Doc 03 §2.2). These drive the REAL
 * controller with the new optional deps attached so the curves are pinned,
 * not just implemented.
 */

interface Fixture {
  controller: EnvironmentVisualController;
  hemiLight: THREE.HemisphereLight;
  rimLight: THREE.DirectionalLight;
  cobbleMat: THREE.MeshStandardMaterial;
  groundMat: THREE.MeshStandardMaterial;
}

function createFixture(): Fixture {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#DCEBF2');
  scene.fog = new THREE.Fog('#DCEBF2', 42, 86);
  const groundMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF' });
  const cobbleMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF' });
  const hemiLight = new THREE.HemisphereLight('#B5D7EB', '#7A664E', 0.54);
  const rimLight = new THREE.DirectionalLight('#C8DCF2', 0.45);
  const controller = new EnvironmentVisualController({
    scene,
    groundMat,
    cobbleMat,
    groveRig: {
      group: new THREE.Group(),
      crownBaseMat: new THREE.MeshStandardMaterial({ color: '#FFFFFF' }),
      crownTopMat: new THREE.MeshStandardMaterial({ color: '#FFFFFF' }),
    },
    hemiLight,
    sunLight: new THREE.DirectionalLight('#FFF1D0', 1.52),
    rimLight,
    windowMaterials: [],
    lanternMat: new THREE.MeshStandardMaterial(),
    prototypeLanternMats: [],
    flowerGroups: [],
    gazeboRig: {
      group: new THREE.Group(),
      bellPivot: new THREE.Group(),
      bellMesh: new THREE.Mesh(),
      clapperMesh: new THREE.Mesh(),
      ivyGroup: new THREE.Group(),
      ribbonMesh: new THREE.Mesh(),
    },
    fountainRig: { group: new THREE.Group(), waterMesh: new THREE.Mesh(), spoutParticles: new THREE.Group() },
    bakeryTablesGroup: new THREE.Group(),
    festoonGroup: new THREE.Group(),
    noticeboardRig: { group: new THREE.Group(), flyers: [] },
    oakGlint: new THREE.Mesh(),
    mbFlag: new THREE.Mesh(),
    bellSwingVelRef: { current: 0 },
    isSoftwareGl: true,
  });
  return { controller, hemiLight, rimLight, cobbleMat, groundMat };
}

function updateAt(fixture: Fixture, season: 'spring' | 'summer' | 'autumn' | 'winter', minuteOfDay: number): void {
  const base = createFreshWorldState();
  const world = { ...base, day: 12, season, weather: 'sunlit' as const, minuteOfDay };
  const composed = composeEnvironmentState(world);
  fixture.controller.update(composed, world, { x: 0, z: 0 }, 0, 0.016);
}

test('season-aware hemisphere ground: each season owns its daylight ground mood', () => {
  const f = createFixture();
  updateAt(f, 'spring', 540);
  assert.equal(f.hemiLight.groundColor.getHexString(), '7a8a5e', 'spring dew-sage ground');
  updateAt(f, 'summer', 540);
  assert.equal(f.hemiLight.groundColor.getHexString(), '8a744e', 'summer honey-earth ground');
  updateAt(f, 'autumn', 540);
  assert.equal(f.hemiLight.groundColor.getHexString(), '7e5c3e', 'autumn umber ground');
  updateAt(f, 'winter', 540);
  assert.equal(f.hemiLight.groundColor.getHexString(), '4e5560', 'winter blue-gray hush ground');
});

test('hemi ground keeps the identity twilight destination at dusk in every season', () => {
  const f = createFixture();
  for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
    updateAt(f, season, 1290); // tNorm 1.0 → duskFactor 1
    assert.equal(
      f.hemiLight.groundColor.getHexString(),
      '34324a',
      `${season} dusk settles into the shared twilight ground`,
    );
  }
});

test('dusk rim curve: full strength in daylight, eased and warmed at dusk', () => {
  const f = createFixture();
  updateAt(f, 'summer', 540); // morning: duskFactor 0
  assert.ok(Math.abs(f.rimLight.intensity - 0.45) < 0.01, 'daylight rim holds the identity 0.45');
  assert.equal(f.rimLight.color.getHexString(), 'c8dcf2', 'daylight rim keeps its cool color');
  updateAt(f, 'summer', 1290); // duskFactor 1
  assert.ok(Math.abs(f.rimLight.intensity - 0.18) < 0.01, 'dusk rim eases to 0.18');
  assert.equal(f.rimLight.color.getHexString(), '9fa8d8', 'dusk rim warms toward indigo');
});

test('winter cobble recalibration deepens the value band; other seasons stay neutral', () => {
  const f = createFixture();
  updateAt(f, 'winter', 840);
  assert.equal(f.cobbleMat.color.getHexString(), 'c9cfd8', 'winter cobble deepens cool');
  updateAt(f, 'summer', 840);
  assert.equal(f.cobbleMat.color.getHexString(), 'ffffff', 'non-winter cobble stays neutral');
});
