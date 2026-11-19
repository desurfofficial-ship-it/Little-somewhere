import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MaterialPalette } from './materials';
import { buildMeadowDressing, COBBLE_LANE_RECTS } from './builders/botanicalDressing';
import {
  buildAllReactiveRigs,
  buildButterflyRig,
  buildChimneyWispRig,
  buildPuddleRig,
} from './builders/reactiveProps';
import { isPointWalkable } from '../game/worldMap';
import { composeEnvironmentState } from '../game/environment';
import { createFreshWorldState } from '../game/storage';
import { EnvironmentVisualController } from './environmentRenderer';

function isOnAnyLane(x: number, z: number, padding: number): boolean {
  for (const r of COBBLE_LANE_RECTS) {
    if (
      x > r.x - r.w / 2 - padding &&
      x < r.x + r.w / 2 + padding &&
      z > r.z - r.l / 2 - padding &&
      z < r.z + r.l / 2 + padding
    ) {
      return true;
    }
  }
  return false;
}

test('meadow dressing placement never blocks lanes, obstacles, or plaza heart', () => {
  const palette = new MaterialPalette();
  const rig = buildMeadowDressing(palette, false);
  assert.ok(rig.placementPoints.length > 40, 'expected a densely dressed meadow');

  for (const pt of rig.placementPoints) {
    assert.ok(
      isPointWalkable(pt.x, pt.z, 0.3),
      `dressing point (${pt.x.toFixed(2)}, ${pt.z.toFixed(2)}) must stay outside obstacles`,
    );
    assert.ok(
      !isOnAnyLane(pt.x, pt.z, 0.2),
      `dressing point (${pt.x.toFixed(2)}, ${pt.z.toFixed(2)}) must not sit on a cobble lane`,
    );
    const plazaDist = Math.hypot(pt.x, pt.z - 1.5);
    assert.ok(plazaDist > 4.4, 'fountain plaza heart must stay calm and clear');
    assert.ok(Number.isFinite(pt.x) && Number.isFinite(pt.z), 'no NaN placement points');
  }

  rig.dispose();
  palette.disposeAll();
});

test('software-GL dressing budget is smaller than GPU budget', () => {
  const paletteA = new MaterialPalette();
  const paletteB = new MaterialPalette();
  const soft = buildMeadowDressing(paletteA, true);
  const full = buildMeadowDressing(paletteB, false);
  assert.ok(soft.placementPoints.length < full.placementPoints.length);
  soft.dispose();
  full.dispose();
  paletteA.disposeAll();
  paletteB.disposeAll();
});

test('reactive rigs: puddles sit above cobble tops; butterfly & wisp pools are software-capped', () => {
  const palette = new MaterialPalette();
  const puddles = buildPuddleRig(palette);
  assert.equal(puddles.mesh.visible, false, 'puddles start hidden (dry day 1)');
  const pos = new THREE.Vector3();
  for (let i = 0; i < puddles.mesh.count; i++) {
    puddles.mesh.getMatrixAt(i, new THREE.Matrix4()).decompose(pos, new THREE.Quaternion(), new THREE.Vector3());
    assert.ok(Math.abs(pos.x - PUDDLE_X[i]) < 1e-2, 'puddle placement deterministic');
    assert.ok(pos.y > 0.05 && pos.y < 0.075, `puddle film must sit just above cobble top (got ${pos.y})`);
  }
  puddles.dispose();

  const softButterflies = buildButterflyRig(true);
  const gpuButterflies = buildButterflyRig(false);
  assert.equal(softButterflies.count, 2);
  assert.equal(gpuButterflies.count, 3);
  softButterflies.dispose();
  gpuButterflies.dispose();

  const wisps = buildChimneyWispRig(false);
  assert.equal(wisps.chimneys.length, 3);
  assert.equal(wisps.chimneys.length * wisps.puffsPerChimney, 12);
  // Zero-alloc update contract: runs without throwing across a day cycle
  wisps.update(0, [true, false, false]);
  wisps.update(1.5, [false, true, true]);
  wisps.dispose();
  palette.disposeAll();
});

const PUDDLE_X = [2.55, -3.15, 6.7, -8.8, 1.15, -4.75, -1.0];

test('environment controller drives reactive hooks on frame 0 (rain day, stage 3, dusk)', () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#DCEBF2');
  scene.fog = new THREE.Fog('#DCEBF2', 42, 86);
  const groundMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF' });
  const hemiLight = new THREE.HemisphereLight('#B5D7EB', '#7A664E', 0.54);
  const sunLight = new THREE.DirectionalLight('#FFF1D0', 1.52);
  const palette = new MaterialPalette();
  const rigs = buildAllReactiveRigs(palette, true);
  scene.add(
    rigs.pastryBasket.group,
    rigs.greenhouseStage.group,
    rigs.porchLamp.group,
    rigs.puddles.mesh,
    rigs.butterflies.wingsL,
    rigs.butterflies.wingsR,
    rigs.butterflies.bodies,
    rigs.fireflies.mesh,
    rigs.pondSparkles.mesh,
    rigs.chimneyWisps.mesh,
  );

  const controller = new EnvironmentVisualController({
    scene,
    groundMat,
    groveRig: {
      group: new THREE.Group(),
      crownBaseMat: new THREE.MeshStandardMaterial({ color: '#FFFFFF' }),
      crownTopMat: new THREE.MeshStandardMaterial({ color: '#FFFFFF' }),
    },
    hemiLight,
    sunLight,
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
    reactiveRigs: rigs,
  });

  const base = createFreshWorldState();
  const rainyDuskWorld = {
    ...base,
    day: 9,
    season: 'spring' as const,
    weather: 'light_rain' as const,
    minuteOfDay: 1185,
    flags: {
      ...base.flags,
      plantedMoonPetals: true,
      repairedFountain: true,
    },
  };
  const composed = composeEnvironmentState(rainyDuskWorld);
  controller.update(composed, rainyDuskWorld, rainyDuskWorld.playerPos, 0, 0);

  // Rain day: puddles visible; dusk: fireflies on, butterflies off
  assert.equal(rigs.puddles.mesh.visible, true, 'rain day must show puddles');
  assert.equal(rigs.fireflies.mesh.visible, true, 'dusk must show fireflies');
  assert.equal(rigs.butterflies.wingsL.visible, false, 'rain+dusk hides butterflies');
  assert.ok(rigs.porchLamp.glassMat.emissiveIntensity > 1.0, 'rainy day lights Arthurs porch lamp');
  assert.equal(rigs.greenhouseStage.group.visible, true, 'stage 3 shows moon petals');
  assert.equal(rigs.greenhouseStage.stageBloom.visible, true);
  // Bakery chimney active at dusk per schedule; bakery phase mask includes morning/afternoon only
  const wispPos = new THREE.Vector3();
  const m4 = new THREE.Matrix4();
  rigs.chimneyWisps.mesh.getMatrixAt(0, m4).decompose(wispPos, new THREE.Quaternion(), new THREE.Vector3());
  assert.ok(wispPos.y < -40, 'inactive chimney puffs park far below the scene');

  controller.dispose();
});
