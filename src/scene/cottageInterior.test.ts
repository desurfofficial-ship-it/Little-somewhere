import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  COTTAGE_DOOR_GAP,
  COTTAGE_FURNITURE_BOXES,
  COTTAGE_FURNITURE_CIRCLES,
  COTTAGE_INTERIOR_OFF_RECT,
  COTTAGE_INTERIOR_ON_RECT,
  COTTAGE_INTERIOR_PLATEAU,
  COTTAGE_PORCH_PLATEAU,
  COTTAGE_STEP_PLATEAU,
  COTTAGE_WALL_BOXES,
  buildWillowCottageInterior,
  updateWillowCottageInteriorMotion,
  type WillowCottageInteriorRig,
} from './builders/cottageInterior';
import { buildWillowStepCottage, type WillowCottageRig } from './prototypes/willowLaneDiorama';
import { MaterialPalette } from './materials';
import {
  BOX_OBSTACLES,
  CIRCLE_OBSTACLES,
  COTTAGE_INTERIOR_OFF_RECT as WM_OFF_RECT,
  COTTAGE_INTERIOR_ON_RECT as WM_ON_RECT,
  COTTAGE_INTERIOR_PLATEAU as WM_INTERIOR_PLATEAU,
  COTTAGE_PORCH_PLATEAU as WM_PORCH_PLATEAU,
  COTTAGE_STEP_PLATEAU as WM_STEP_PLATEAU,
  isPointWalkable,
} from '../game/worldMap';

const palette = new MaterialPalette();

function buildInterior(): WillowCottageInteriorRig {
  return buildWillowCottageInterior({
    palette,
    shadowTex: new THREE.Texture(),
    floorTex: new THREE.Texture(),
    lanternMaterials: [],
  });
}

function buildCottage(): WillowCottageRig {
  return buildWillowStepCottage({
    palette,
    shadowTex: new THREE.Texture(),
    terracottaRoofTex: new THREE.Texture(),
    windowMaterials: [],
    lanternMaterials: [],
    flowerGroups: [],
  });
}

test('cottage wall boxes mirror worldMap obstacles exactly (single source of truth)', () => {
  for (const wall of COTTAGE_WALL_BOXES) {
    const obstacle = BOX_OBSTACLES.find((b) => b.id === wall.id);
    assert.ok(obstacle, `worldMap missing wall obstacle ${wall.id}`);
    assert.equal(obstacle.minX, wall.minX, `${wall.id} minX`);
    assert.equal(obstacle.maxX, wall.maxX, `${wall.id} maxX`);
    assert.equal(obstacle.minZ, wall.minZ, `${wall.id} minZ`);
    assert.equal(obstacle.maxZ, wall.maxZ, `${wall.id} maxZ`);
  }
  assert.ok(
    !BOX_OBSTACLES.some((b) => b.id === 'player_cottage'),
    'legacy solid player_cottage box must be gone',
  );
});

test('furniture obstacles mirror the interior builder layout exactly', () => {
  for (const furniture of COTTAGE_FURNITURE_BOXES) {
    const obstacle = BOX_OBSTACLES.find((b) => b.id === furniture.id);
    assert.ok(obstacle, `worldMap missing furniture box ${furniture.id}`);
    assert.equal(obstacle.minX, furniture.minX, `${furniture.id} minX`);
    assert.equal(obstacle.maxX, furniture.maxX, `${furniture.id} maxX`);
    assert.equal(obstacle.minZ, furniture.minZ, `${furniture.id} minZ`);
    assert.equal(obstacle.maxZ, furniture.maxZ, `${furniture.id} maxZ`);
  }
  for (const furniture of COTTAGE_FURNITURE_CIRCLES) {
    const obstacle = CIRCLE_OBSTACLES.find((c) => c.id === furniture.id);
    assert.ok(obstacle, `worldMap missing furniture circle ${furniture.id}`);
    assert.equal(obstacle.x, furniture.x, `${furniture.id} x`);
    assert.equal(obstacle.z, furniture.z, `${furniture.id} z`);
    assert.equal(obstacle.radius, furniture.radius, `${furniture.id} radius`);
  }
});

test('cottage plateaus and interior-mode rects stay in sync with the game layer', () => {
  // worldMap must mirror the builder's walkable-plateau geometry exactly
  assert.deepEqual(
    [WM_STEP_PLATEAU.minX, WM_STEP_PLATEAU.maxX, WM_STEP_PLATEAU.minZ, WM_STEP_PLATEAU.maxZ, WM_STEP_PLATEAU.height],
    [COTTAGE_STEP_PLATEAU.minX, COTTAGE_STEP_PLATEAU.maxX, COTTAGE_STEP_PLATEAU.minZ, COTTAGE_STEP_PLATEAU.maxZ, COTTAGE_STEP_PLATEAU.height],
  );
  assert.deepEqual(
    [WM_PORCH_PLATEAU.minX, WM_PORCH_PLATEAU.maxX, WM_PORCH_PLATEAU.minZ, WM_PORCH_PLATEAU.maxZ, WM_PORCH_PLATEAU.height],
    [COTTAGE_PORCH_PLATEAU.minX, COTTAGE_PORCH_PLATEAU.maxX, COTTAGE_PORCH_PLATEAU.minZ, COTTAGE_PORCH_PLATEAU.maxZ, COTTAGE_PORCH_PLATEAU.height],
  );
  assert.deepEqual(
    [WM_INTERIOR_PLATEAU.minX, WM_INTERIOR_PLATEAU.maxX, WM_INTERIOR_PLATEAU.minZ, WM_INTERIOR_PLATEAU.maxZ, WM_INTERIOR_PLATEAU.height],
    [COTTAGE_INTERIOR_PLATEAU.minX, COTTAGE_INTERIOR_PLATEAU.maxX, COTTAGE_INTERIOR_PLATEAU.minZ, COTTAGE_INTERIOR_PLATEAU.maxZ, COTTAGE_INTERIOR_PLATEAU.height],
  );
  assert.deepEqual(
    [WM_ON_RECT.minX, WM_ON_RECT.maxX, WM_ON_RECT.minZ, WM_ON_RECT.maxZ],
    [COTTAGE_INTERIOR_ON_RECT.minX, COTTAGE_INTERIOR_ON_RECT.maxX, COTTAGE_INTERIOR_ON_RECT.minZ, COTTAGE_INTERIOR_ON_RECT.maxZ],
  );
  assert.deepEqual(
    [WM_OFF_RECT.minX, WM_OFF_RECT.maxX, WM_OFF_RECT.minZ, WM_OFF_RECT.maxZ],
    [COTTAGE_INTERIOR_OFF_RECT.minX, COTTAGE_INTERIOR_OFF_RECT.maxX, COTTAGE_INTERIOR_OFF_RECT.minZ, COTTAGE_INTERIOR_OFF_RECT.maxZ],
  );
  // ON rect covers porch + interior + entry apron; OFF rect strictly larger (hysteresis)
  assert.equal(COTTAGE_INTERIOR_ON_RECT.maxX, -10.6);
  assert.ok(COTTAGE_INTERIOR_OFF_RECT.maxX > COTTAGE_INTERIOR_ON_RECT.maxX);
  assert.ok(COTTAGE_INTERIOR_OFF_RECT.minX < COTTAGE_INTERIOR_ON_RECT.minX);
  assert.ok(COTTAGE_INTERIOR_OFF_RECT.minZ < COTTAGE_INTERIOR_ON_RECT.minZ);
  assert.ok(COTTAGE_INTERIOR_OFF_RECT.maxZ > COTTAGE_INTERIOR_ON_RECT.maxZ);
});

test('doorway gap geometry admits a player and matches the threshold strip', () => {
  assert.equal(COTTAGE_DOOR_GAP.minZ, 9.3);
  assert.equal(COTTAGE_DOOR_GAP.maxZ, 10.7);
  const eastN = BOX_OBSTACLES.find((b) => b.id === 'cottage_wall_east_north')!;
  const eastS = BOX_OBSTACLES.find((b) => b.id === 'cottage_wall_east_south')!;
  assert.equal(eastN.maxZ, COTTAGE_DOOR_GAP.minZ);
  assert.equal(eastS.minZ, COTTAGE_DOOR_GAP.maxZ);
  assert.ok(isPointWalkable(-12.85, 10.0, 0.48), 'player passes the doorway');
});

test('interior rig starts hidden, floor sits at 0.46, and adds no lights', () => {
  const rig = buildInterior();
  assert.equal(rig.interiorOnly.visible, false, 'interiorOnly must start hidden');
  assert.equal(rig.flameMeshes.length, 3);
  assert.ok(rig.emberMat.emissiveIntensity > 0, 'ember bed begins glowing');

  let floorMesh: THREE.Mesh | null = null;
  let lightCount = 0;
  rig.interiorOnly.traverse((child) => {
    if ((child as THREE.Light).isLight) lightCount++;
    const mesh = child as THREE.Mesh;
    if (
      !floorMesh &&
      mesh.isMesh &&
      mesh.geometry instanceof THREE.BoxGeometry &&
      Math.abs((mesh.geometry as THREE.BoxGeometry).parameters.width - 5.0) < 0.001 &&
      Math.abs((mesh.geometry as THREE.BoxGeometry).parameters.height - 0.08) < 0.001
    ) {
      floorMesh = mesh;
    }
  });
  assert.ok(floorMesh, 'interior floor slab must exist');
  assert.ok(
    Math.abs((floorMesh as THREE.Mesh).position.y - 0.42) < 1e-6,
    'floor top lands at y=0.46',
  );
  assert.equal(lightCount, 0, 'interior uses emissive materials only (no scene lights)');
});

test('threshold strip is visible in both modes and sits inside the doorway gap', () => {
  const rig = buildInterior();
  assert.equal(rig.group.children.length, 1, 'only the threshold strip stays always-visible');
  const threshold = rig.group.children[0] as THREE.Mesh;
  const geo = threshold.geometry as THREE.BoxGeometry;
  assert.ok(Math.abs(geo.parameters.depth - 1.42) < 0.001);
  assert.ok(geo.parameters.depth <= COTTAGE_DOOR_GAP.maxZ - COTTAGE_DOOR_GAP.minZ + 0.05);
});

test('cottage rig exposes hideable assemblies and the swinging door pivot', () => {
  const rig = buildCottage();
  assert.ok(rig.roofAssembly && rig.roofAssembly.children.length >= 10, 'roof assembly carries roof/chimney/dormer');
  assert.ok(rig.porchRoofGroup.children.length >= 6, 'porch roof group carries slab/posts/rafters');
  assert.ok(rig.bodyMesh instanceof THREE.Mesh);
  assert.equal(rig.southWallWindows.length, 2);
  assert.equal(rig.eastWallWindows.length, 2);
  assert.equal(rig.doorPivot.children.length, 3, 'leaf + glass + handle on the pivot');

  const leaf = rig.doorPivot.children[0] as THREE.Mesh;
  const leafBox = new THREE.Box3().setFromObject(leaf);
  assert.ok(
    leafBox.min.z >= -0.05 && leafBox.max.z <= 1.0,
    'door leaf geometry is offset to swing from the north jamb',
  );
  assert.equal(rig.doorPivot.rotation.y, 0, 'door starts closed');
});

test('interior motion: door swings open near the player, closes when they leave; ember follows phase', () => {
  const rig = buildInterior();
  const doorPivot = buildCottage().doorPivot;
  const step = (playerX: number, playerZ: number, phase: 'morning' | 'golden' | 'dusk') => {
    updateWillowCottageInteriorMotion(rig, doorPivot, {
      playerX,
      playerZ,
      phase,
      interiorMode: false,
      elapsed: 0,
      dt: 1 / 60,
    });
  };

  // Far away: converge closed
  for (let i = 0; i < 180; i++) step(-8.0, 10.0, 'morning');
  assert.ok(Math.abs(doorPivot.rotation.y) < 0.05, `door rests closed, got ${doorPivot.rotation.y}`);

  // Approaching the door: swings open toward the room (negative yaw)
  for (let i = 0; i < 240; i++) step(-11.2, 10.0, 'morning');
  assert.ok(doorPivot.rotation.y < -1.4, `door opens wide, got ${doorPivot.rotation.y}`);

  // Leaving again: swings shut
  for (let i = 0; i < 300; i++) step(-7.0, 6.0, 'morning');
  assert.ok(Math.abs(doorPivot.rotation.y) < 0.05, 'door closes after the player leaves');

  // Ember: dusk glow clearly above morning glow (after settling)
  for (let i = 0; i < 240; i++) step(-15.0, 10.0, 'morning');
  const morningIntensity = rig.emberMat.emissiveIntensity;
  for (let i = 0; i < 240; i++) step(-15.0, 10.0, 'dusk');
  const duskIntensity = rig.emberMat.emissiveIntensity;
  assert.ok(duskIntensity > morningIntensity * 1.5, `dusk ${duskIntensity} >> morning ${morningIntensity}`);
  assert.ok(Number.isFinite(duskIntensity) && Number.isFinite(doorPivot.rotation.y), 'no NaN in motion state');

  // Flames dance but stay sane
  for (const flame of rig.flameMeshes) {
    assert.ok(flame.scale.x > 0.5 && flame.scale.x < 1.4);
    assert.ok(Number.isFinite(flame.rotation.y));
  }
});
