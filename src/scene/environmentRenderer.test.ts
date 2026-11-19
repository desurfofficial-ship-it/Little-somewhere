import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { composeEnvironmentState } from '../game/environment';
import { computeSitGroundY } from '../game/playerController';
import { RESIDENTS } from '../game/residents';
import { createFreshWorldState } from '../game/storage';
import { getGroundHeightAt, isPointWalkable } from '../game/worldMap';
import { EnvironmentVisualController } from './environmentRenderer';
import { animateCharacterRig, buildStorybookCharacter } from './builders/characters';
import { buildStorybookBench, buildStorybookFountain } from './builders/landmarks';
import { buildMirrorPondAndBridge } from './builders/vegetation';
import { buildStorybookJun } from './prototypes/willowLaneDiorama';
import { MaterialPalette } from './materials';
import { getWaterShaderUniforms } from './waterShaders';

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
  assert.equal(windowMat.emissiveIntensity, 2.1);
  assert.equal(lanternMat.emissiveIntensity, 2.15);
  assert.equal((scene.fog as THREE.Fog).near, 32);

  controller.dispose();
});

test('buildStorybookFountain preserves stone walls and keeps water visible above dry stone bed', () => {
  const palette = new MaterialPalette();
  const dummyTex = new THREE.Texture();

  const rig = buildStorybookFountain(palette, dummyTex);
  const circleMeshes = rig.group.children.filter(
    (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.geometry instanceof THREE.CircleGeometry,
  );
  assert.ok(
    circleMeshes.length >= 2,
    'buildStorybookFountain: expected dryFloor and waterMesh circle discs',
  );
  const dryFloor = circleMeshes.find((m) => m !== rig.waterMesh);
  assert.ok(dryFloor, 'buildStorybookFountain: expected dryFloor mesh inside fountain basin');
  assert.ok(
    rig.waterMesh.position.y > dryFloor.position.y + 0.08,
    `buildStorybookFountain: waterMesh (${rig.waterMesh.position.y}) must sit cleanly above dryFloor (${dryFloor.position.y})`,
  );

  const dryColor = (dryFloor.material as THREE.MeshStandardMaterial).color;
  assert.ok(
    dryColor.r >= dryColor.b,
    'buildStorybookFountain: dry stone bed should read as warm stone rather than blue water',
  );

  const latheBasin = rig.group.children.find(
    (c): c is THREE.Mesh =>
      c instanceof THREE.Mesh && c.geometry instanceof THREE.LatheGeometry && c.position.y === 0,
  );
  assert.ok(latheBasin, 'buildStorybookFountain: outer basin must use recessed LatheGeometry');
  assert.ok(
    rig.waterMesh.children.length >= 1,
    'buildStorybookFountain: repaired water should include ripple/pool details',
  );

  palette.disposeAll();
  dummyTex.dispose();
});

test('seated characters sit cleanly in front of bench backrest with zero back clipping across all silhouettes', () => {
  const palette = new MaterialPalette();
  const dummyTex = new THREE.Texture();
  const bench = buildStorybookBench(palette, dummyTex);
  bench.updateMatrixWorld(true);
  const backrestFrontZ = Number(bench.userData.backrestFrontZ);
  assert.ok(Number.isFinite(backrestFrontZ) && backrestFrontZ < -0.22);

  const testCases = [
    {
      label: 'player',
      scale: 1.0,
      rig: buildStorybookCharacter(
        {
          coatColor: '#D46E51',
          shirtColor: '#FAF4E8',
          hairColor: '#433027',
          skinColor: '#F0C5A7',
          accentColor: '#6E9A74',
          hatStyle: 'beret',
          propType: 'none',
          heightScale: 1.0,
        },
        palette,
        dummyTex,
        'player',
      ),
    },
    {
      label: 'clara',
      scale: RESIDENTS.clara.appearance.heightScale,
      rig: buildStorybookCharacter(RESIDENTS.clara.appearance, palette, dummyTex, 'clara'),
    },
    {
      label: 'toby',
      scale: RESIDENTS.toby.appearance.heightScale,
      rig: buildStorybookCharacter(RESIDENTS.toby.appearance, palette, dummyTex, 'toby'),
    },
    {
      label: 'barnaby',
      scale: RESIDENTS.barnaby.appearance.heightScale,
      rig: buildStorybookCharacter(RESIDENTS.barnaby.appearance, palette, dummyTex, 'barnaby'),
    },
    {
      label: 'sora',
      scale: RESIDENTS.sora.appearance.heightScale,
      rig: buildStorybookCharacter(RESIDENTS.sora.appearance, palette, dummyTex, 'sora'),
    },
    {
      label: 'jun',
      scale: RESIDENTS.jun.appearance.heightScale,
      rig: buildStorybookJun(RESIDENTS.jun.appearance, palette, dummyTex),
    },
  ];

  const box = new THREE.Box3();
  for (const tc of testCases) {
    tc.rig.root.position.set(0, computeSitGroundY(0.36, tc.scale), 0);
    animateCharacterRig(tc.rig, 'sit', 0, 0, 0, 0);
    tc.rig.root.updateMatrixWorld(true);

    // Measure seated bodyGroup bounds (coat skirt, torso, head, hair/hood/bun, backpack/violin)
    box.setFromObject(tc.rig.bodyGroup);
    assert.ok(
      box.min.z > backrestFrontZ + 0.015,
      `${tc.label}: seated body min.z (${box.min.z.toFixed(3)}) must clear backrestFrontZ (${backrestFrontZ.toFixed(3)})`,
    );
  }

  palette.disposeAll();
  dummyTex.dispose();
});

test('upgraded Fountain and Mirror Pond rigs animate water shaders, koi, debris/coins, and seasonal reactivity', () => {
  const palette = new MaterialPalette();
  const dummyTex = new THREE.Texture();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#DCEBF2');
  scene.fog = new THREE.Fog('#DCEBF2', 42, 86);

  const fountainRig = buildStorybookFountain(palette, dummyTex);
  const protoLanterns: THREE.MeshStandardMaterial[] = [];
  const pondRig = buildMirrorPondAndBridge(palette, dummyTex, protoLanterns);

  assert.ok(fountainRig.clogDebrisGroup);
  assert.ok(fountainRig.submergedCoinsGroup);
  assert.ok(fountainRig.cascadeGroup);
  assert.ok((fountainRig.splashRings?.length ?? 0) >= 5);
  assert.equal(fountainRig.spoutParticles.children.length, 20);
  assert.equal(pondRig.koiFishes.length, 3);
  assert.ok(pondRig.lilyBlooms.length >= 3);
  assert.ok(pondRig.dragonflies.length >= 2);
  assert.ok(protoLanterns.length >= 1);

  const controller = new EnvironmentVisualController({
    scene,
    groundMat: new THREE.MeshStandardMaterial(),
    groveRig: {
      group: new THREE.Group(),
      crownBaseMat: new THREE.MeshStandardMaterial(),
      crownTopMat: new THREE.MeshStandardMaterial(),
    },
    hemiLight: new THREE.HemisphereLight(),
    sunLight: new THREE.DirectionalLight(),
    windowMaterials: [],
    lanternMat: new THREE.MeshStandardMaterial(),
    prototypeLanternMats: protoLanterns,
    flowerGroups: [],
    gazeboRig: {
      group: new THREE.Group(),
      bellPivot: new THREE.Group(),
      bellMesh: new THREE.Mesh(),
      clapperMesh: new THREE.Mesh(),
      ivyGroup: new THREE.Group(),
      ribbonMesh: new THREE.Mesh(),
    },
    fountainRig,
    pondRig,
    bakeryTablesGroup: new THREE.Group(),
    festoonGroup: new THREE.Group(),
    noticeboardRig: { group: new THREE.Group(), flyers: [] },
    oakGlint: new THREE.Mesh(),
    mbFlag: new THREE.Mesh(),
    bellSwingVelRef: { current: 0 },
    isSoftwareGl: true,
  });

  // 1. Fresh clogged spring morning state
  const fresh = createFreshWorldState();
  controller.update(composeEnvironmentState(fresh), fresh, fresh.playerPos, 0.5, 0.03);
  assert.equal(fountainRig.clogDebrisGroup!.visible, true);
  assert.equal(fountainRig.submergedCoinsGroup!.visible, false);
  assert.equal(fountainRig.cascadeGroup!.visible, false);

  const initialKoiX = pondRig.koiFishes[0].group.position.x;

  // 2. Repaired fountain + splash triggers + winter freeze behavior
  const repairedSpring = {
    ...fresh,
    flags: { ...fresh.flags, repairedFountain: true },
  };
  controller.triggerFountainWishRipple();
  controller.triggerPondRipple(2.0, 14.2);
  controller.update(composeEnvironmentState(repairedSpring), repairedSpring, repairedSpring.playerPos, 2.2, 0.03);

  assert.equal(fountainRig.clogDebrisGroup!.visible, false);
  assert.equal(fountainRig.submergedCoinsGroup!.visible, true);
  assert.equal(fountainRig.cascadeGroup!.visible, true);
  assert.notEqual(pondRig.koiFishes[0].group.position.x, initialKoiX);
  assert.ok((getWaterShaderUniforms(pondRig.waterMat)?.uSplashAge.value ?? 99) < 0.2);
  assert.ok((getWaterShaderUniforms(fountainRig.waterMat)?.uSplashAge.value ?? 99) < 0.2);

  // Winter hides lily blooms & dragonflies and sets uWinter=1
  const winterWorld = { ...repairedSpring, season: 'winter' as const, day: 68 };
  controller.update(composeEnvironmentState(winterWorld), winterWorld, winterWorld.playerPos, 2.6, 0.03);
  assert.equal(getWaterShaderUniforms(pondRig.waterMat)?.uWinter.value, 1);
  assert.equal(pondRig.lilyBlooms.every((b) => !b.visible), true);
  assert.equal(pondRig.dragonflies.every((d) => !d.visible), true);

  controller.dispose();
  palette.disposeAll();
  dummyTex.dispose();
});

test('THREE.Box3 clearance verifies zero player-mesh clipping with Fountain and Mirror Pond geometry in idle & interact poses', () => {
  const palette = new MaterialPalette();
  const dummyTex = new THREE.Texture();
  const protoLanterns: THREE.MeshStandardMaterial[] = [];

  const fountainRig = buildStorybookFountain(palette, dummyTex);
  fountainRig.group.updateMatrixWorld(true);

  const pondRig = buildMirrorPondAndBridge(palette, dummyTex, protoLanterns);
  pondRig.group.updateMatrixWorld(true);

  const playerRig = buildStorybookCharacter(
    {
      coatColor: '#D46E51',
      shirtColor: '#FAF4E8',
      hairColor: '#433027',
      skinColor: '#F0C5A7',
      accentColor: '#6E9A74',
      hatStyle: 'beret',
      propType: 'none',
      heightScale: 1.0,
    },
    palette,
    dummyTex,
    'player',
  );

  // Measure physical Fountain stone coping/wall outer bounds & stepped apron bounds
  const fGroup = fountainRig.group;
  const fApronLower = fGroup.children.find(
    (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.geometry instanceof THREE.CylinderGeometry,
  )!;
  const fCoping = fGroup.children.find(
    (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.geometry instanceof THREE.TorusGeometry,
  )!;
  const apronBox = new THREE.Box3().setFromObject(fApronLower);
  const copingBox = new THREE.Box3().setFromObject(fCoping);
  const apronRadius = (apronBox.max.x - apronBox.min.x) * 0.5;
  const copingRadius = (copingBox.max.x - copingBox.min.x) * 0.5;

  const pBox = new THREE.Box3();
  const legBox = new THREE.Box3();

  // Check cardinal rim walkable edges (distance = 2.95m from center (0, 1.5)) facing center in idle & interact
  const fountainRimChecks = [
    { pos: { x: 0, z: 1.5 + 2.95 }, facing: Math.PI, check: () => ({ bMin: pBox.min.z - 1.5, lMin: legBox.min.z - 1.5 }) },
    { pos: { x: 0, z: 1.5 - 2.95 }, facing: 0, check: () => ({ bMin: 1.5 - pBox.max.z, lMin: 1.5 - legBox.max.z }) },
    { pos: { x: 2.95, z: 1.5 }, facing: -Math.PI / 2, check: () => ({ bMin: pBox.min.x, lMin: legBox.min.x }) },
    { pos: { x: -2.95, z: 1.5 }, facing: Math.PI / 2, check: () => ({ bMin: -pBox.max.x, lMin: -legBox.max.x }) },
  ];

  for (const rim of fountainRimChecks) {
    assert.equal(isPointWalkable(rim.pos.x, rim.pos.z, 0.48), true);
    for (const pose of ['idle', 'interact'] as const) {
      playerRig.root.position.set(rim.pos.x, 0, rim.pos.z);
      playerRig.root.rotation.y = rim.facing;
      animateCharacterRig(playerRig, pose, 0, Math.PI / 4, 0.1, 0, { lookPitch: 0.16 });
      playerRig.root.updateMatrixWorld(true);
      pBox.setFromObject(playerRig.bodyGroup);
      legBox.setFromObject(playerRig.leftLeg).union(new THREE.Box3().setFromObject(playerRig.rightLeg));
      const { bMin, lMin } = rim.check();
      assert.ok(bMin > copingRadius + 0.05, `Fountain ${pose} upper reach (${bMin.toFixed(3)}) must clear coping (${copingRadius.toFixed(3)})`);
      assert.ok(lMin > apronRadius + 0.05, `Fountain ${pose} boots (${lMin.toFixed(3)}) must clear apron (${apronRadius.toFixed(3)})`);
    }
  }

  // Compute Mirror Pond stone rocks, skipping ledge, pier step, and bridge rail bounds
  const pondSubGroup = pondRig.group.children[0] as THREE.Group;
  const bridgeSubGroup = pondRig.group.children[1] as THREE.Group;

  // North shore (z = 10.71, walkable edge) facing pond (+Z) must clear north stones/skipping ledge
  let minNorthStoneZ = Infinity;
  let maxSouthPierZ = -Infinity;
  pondSubGroup.traverse((obj) => {
    if (obj instanceof THREE.Mesh && (obj.geometry instanceof THREE.DodecahedronGeometry || obj.geometry instanceof THREE.CylinderGeometry || obj.geometry instanceof THREE.BoxGeometry)) {
      const box = new THREE.Box3().setFromObject(obj);
      // Exclude water-surface lily pads / sailboat mast / bridge
      if (box.min.z < 12.2 && box.max.y < 0.8) {
        minNorthStoneZ = Math.min(minNorthStoneZ, box.min.z);
      }
      if (box.max.z > 15.8 && box.max.y < 0.8) {
        maxSouthPierZ = Math.max(maxSouthPierZ, box.max.z);
      }
    }
  });

  // 1) North skipping ledge walkable boundary
  assert.equal(isPointWalkable(1.8, 10.71, 0.48), true);
  playerRig.root.position.set(1.8, 0, 10.71);
  playerRig.root.rotation.y = 0;
  animateCharacterRig(playerRig, 'interact', 0, Math.PI / 4, 0.1, 0, { lookPitch: 0.16 });
  playerRig.root.updateMatrixWorld(true);
  pBox.setFromObject(playerRig.bodyGroup);
  assert.ok(pBox.max.z < minNorthStoneZ - 0.02, `North shore interact (${pBox.max.z.toFixed(3)}) must clear north rocks/ledge (${minNorthStoneZ.toFixed(3)})`);

  // 2) South viewing pier walkable boundary (x = 2.22, z = 17.14)
  assert.equal(isPointWalkable(2.22, 17.14, 0.48), true);
  playerRig.root.position.set(2.22, 0, 17.14);
  playerRig.root.rotation.y = Math.PI;
  animateCharacterRig(playerRig, 'interact', 0, Math.PI / 4, 0.1, 0, { lookPitch: 0.16 });
  playerRig.root.updateMatrixWorld(true);
  pBox.setFromObject(playerRig.bodyGroup);
  assert.ok(pBox.min.z > maxSouthPierZ + 0.02, `South pier interact (${pBox.min.z.toFixed(3)}) must clear pier shore step/rocks (${maxSouthPierZ.toFixed(3)})`);

  // 3) Cedar bridge deck clearance vs east & west bridge handrails
  let westRailMaxX = -Infinity;
  let eastRailMinX = Infinity;
  bridgeSubGroup.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const box = new THREE.Box3().setFromObject(obj);
      const centerX = (box.min.x + box.max.x) * 0.5;
      if (box.max.y > 0.7 && centerX < -2.9) {
        westRailMaxX = Math.max(westRailMaxX, box.max.x);
      } else if (box.max.y > 0.7 && centerX > -2.9 && box.min.x > -2.5) {
        eastRailMinX = Math.min(eastRailMinX, box.min.x);
      }
    }
  });

  assert.equal(isPointWalkable(-2.9, 14.0, 0.48), true);
  playerRig.root.position.set(-2.9, getGroundHeightAt(-2.9, 14.0), 14.0);
  playerRig.root.rotation.y = Math.PI / 2; // Facing east across pond rail
  animateCharacterRig(playerRig, 'interact', 0, Math.PI / 4, 0.1, 0, { lookPitch: 0.16 });
  playerRig.root.updateMatrixWorld(true);
  pBox.setFromObject(playerRig.bodyGroup);
  assert.ok(pBox.max.x < eastRailMinX - 0.02, `Bridge interact (${pBox.max.x.toFixed(3)}) must clear east bridge rail (${eastRailMinX.toFixed(3)})`);
  assert.ok(pBox.min.x > westRailMaxX + 0.02, `Bridge body (${pBox.min.x.toFixed(3)}) must clear west bridge rail (${westRailMaxX.toFixed(3)})`);

  palette.disposeAll();
  dummyTex.dispose();
});

