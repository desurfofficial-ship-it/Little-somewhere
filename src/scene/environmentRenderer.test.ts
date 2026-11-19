import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { composeEnvironmentState } from '../game/environment';
import { createFreshWorldState } from '../game/storage';
import { EnvironmentVisualController } from './environmentRenderer';
import { buildStorybookFountain } from './builders/landmarks';
import { buildStoneFountain } from './models';
import { MaterialPalette } from './materials';

test('EnvironmentVisualController applies non-default season, weather, lighting, and StoryFlags on Frame 0 (dt=0)', () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#DCEBF2');
  scene.fog = new THREE.Fog('#DCEBF2', 42, 86);

  const groundMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF' });
  const groveBaseMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF' });
  const groveTopMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF' });
  const hemiLight = new THREE.HemisphereLight('#B5D7EB', '#7A664E', 0.54);
  const sunLight = new THREE.DirectionalLight('#FFF1D0', 1.52);
  const windowMat = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.22 });
  const lanternMat = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.15 });
  const protoLanternMat = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.22 });

  const flowerA = new THREE.Group();
  const flowerB = new THREE.Group();
  const flowerC = new THREE.Group();

  const ivyGroup = new THREE.Group();
  const clapperMesh = new THREE.Mesh();
  const ribbonMesh = new THREE.Mesh();
  ribbonMesh.visible = false;

  const waterMesh = new THREE.Mesh();
  waterMesh.visible = false;
  const spoutParticles = new THREE.Group();
  spoutParticles.visible = false;

  const bakeryTablesGroup = new THREE.Group();
  bakeryTablesGroup.visible = false;
  const festoonGroup = new THREE.Group();
  festoonGroup.visible = false;
  const flyers = [new THREE.Mesh(), new THREE.Mesh(), new THREE.Mesh()];
  const oakGlint = new THREE.Mesh();
  const mbFlag = new THREE.Mesh();

  const controller = new EnvironmentVisualController({
    scene,
    groundMat,
    groveRig: {
      group: new THREE.Group(),
      crownBaseMat: groveBaseMat,
      crownTopMat: groveTopMat,
    },
    hemiLight,
    sunLight,
    windowMaterials: [windowMat],
    lanternMat,
    prototypeLanternMats: [protoLanternMat],
    flowerGroups: [flowerA, flowerB, flowerC],
    gazeboRig: {
      group: new THREE.Group(),
      bellPivot: new THREE.Group(),
      bellMesh: new THREE.Mesh(),
      clapperMesh,
      ivyGroup,
      ribbonMesh,
    },
    fountainRig: {
      group: new THREE.Group(),
      waterMesh,
      spoutParticles,
    },
    bakeryTablesGroup,
    festoonGroup,
    noticeboardRig: {
      group: new THREE.Group(),
      flyers,
    },
    oakGlint,
    mbFlag,
    bellSwingVelRef: { current: 0 },
    isSoftwareGl: true,
  });

  const base = createFreshWorldState();
  const autumnDuskWorld = {
    ...base,
    day: 24,
    season: 'autumn' as const,
    weather: 'light_rain' as const,
    minuteOfDay: 1180,
    mailboxUnread: false,
    flags: {
      ...base.flags,
      heardBellMystery: true,
      clearedGazeboIvy: true,
      foundBrassClapper: true,
      repairedFountain: true,
      plantedMoonPetals: true,
      bellRestored: true,
      claraArthurReconciled: true,
      lanternsLit: true,
    },
  };

  // Simulate Frame-0 pre-render call (elapsed = 0, dt = 0)
  const composed = composeEnvironmentState(autumnDuskWorld);
  controller.update(composed, autumnDuskWorld, autumnDuskWorld.playerPos, 0, 0);

  // Seasonal ground & canopy tints applied immediately on Frame 0
  assert.equal(`#${groundMat.color.getHexString().toUpperCase()}`, composed.season.meadowTintHex);
  assert.equal(`#${groveBaseMat.color.getHexString().toUpperCase()}`, composed.season.groveBaseTintHex);
  assert.equal(`#${groveTopMat.color.getHexString().toUpperCase()}`, composed.season.groveTopTintHex);

  // Story flags, fountain, ivy, bunting, bakery tables, oak glint, mailbox, and dusk lighting applied on Frame 0
  assert.equal(ivyGroup.visible, false);
  assert.equal(clapperMesh.visible, true);
  assert.equal(ribbonMesh.visible, true);
  assert.equal(waterMesh.visible, true);
  assert.equal(spoutParticles.visible, true);
  assert.equal(bakeryTablesGroup.visible, true);
  assert.equal(festoonGroup.visible, true);
  assert.equal(oakGlint.visible, false);
  assert.equal(mbFlag.rotation.z, -1.2);
  assert.equal(flyers.every((f) => f.visible), true);
  assert.equal(windowMat.emissiveIntensity, 1.75);
  assert.equal(lanternMat.emissiveIntensity, 1.85);
  assert.equal((scene.fog as THREE.Fog).near, 32);

  controller.dispose();
});

test('buildStorybookFountain and buildStoneFountain preserve stone walls and keep water visible above dry stone bed', () => {
  const palette = new MaterialPalette();
  const dummyTex = new THREE.Texture();

  for (const [name, rig] of [
    ['buildStorybookFountain', buildStorybookFountain(palette, dummyTex)],
    ['buildStoneFountain', buildStoneFountain()],
  ] as const) {
    const circleMeshes = rig.group.children.filter(
      (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.geometry instanceof THREE.CircleGeometry,
    );
    assert.ok(circleMeshes.length >= 2, `${name}: expected dryFloor and waterMesh circle discs`);
    const dryFloor = circleMeshes.find((m) => m !== rig.waterMesh);
    assert.ok(dryFloor, `${name}: expected dryFloor mesh inside fountain basin`);
    assert.ok(
      rig.waterMesh.position.y > dryFloor.position.y + 0.08,
      `${name}: waterMesh (${rig.waterMesh.position.y}) must sit cleanly above dryFloor (${dryFloor.position.y})`,
    );

    const dryColor = (dryFloor.material as THREE.MeshStandardMaterial).color;
    assert.ok(
      dryColor.r >= dryColor.b,
      `${name}: dry stone bed should read as warm stone rather than blue water`,
    );

    const latheBasin = rig.group.children.find(
      (c): c is THREE.Mesh =>
        c instanceof THREE.Mesh && c.geometry instanceof THREE.LatheGeometry && c.position.y === 0,
    );
    assert.ok(latheBasin, `${name}: outer basin must use recessed LatheGeometry`);
    assert.ok(rig.waterMesh.children.length >= 1, `${name}: repaired water should include ripple/pool details`);
  }

  palette.disposeAll();
  dummyTex.dispose();
});
