import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  GREENHOUSE_INTERACTABLES,
  GREENHOUSE_PLOT_COUNT,
  GREENHOUSE_PLOT_SHELF_Z,
} from '../game/greenhouse';
import { createFreshWorldState } from '../game/storage';
import { GreenhouseCropId } from '../game/types';
import { MaterialPalette } from './materials';
import {
  buildSunbeamGreenhouseDoorway,
  buildSunbeamGreenhouseInterior,
} from './builders/greenhouseInterior';

test('greenhouse interior 3D rig exposes one hit proxy per station and stays inside diorama bounds', () => {
  const palette = new MaterialPalette();
  const rig = buildSunbeamGreenhouseInterior(palette, new THREE.Texture(), { isSoftwareGl: true });

  const proxies = rig.hitProxies.filter((mesh) => mesh.userData.targetKind === 'greenhouse_prop');
  assert.equal(proxies.length, GREENHOUSE_INTERACTABLES.length);
  const ids = new Set(proxies.map((mesh) => mesh.userData.targetId));
  for (const prop of GREENHOUSE_INTERACTABLES) {
    assert.ok(ids.has(prop.id), `Missing greenhouse hit proxy for ${prop.id}`);
  }

  // Every proxy hovers near its station focus point
  for (const prop of GREENHOUSE_INTERACTABLES) {
    const proxy = proxies.find((p) => p.userData.targetId === prop.id)!;
    assert.ok(
      Math.abs(proxy.position.x - prop.focusX) < 0.05 && Math.abs(proxy.position.z - prop.focusZ) < 0.05,
      `Proxy for ${prop.id} should sit at the focus point`,
    );
  }

  const box = new THREE.Box3().setFromObject(rig.group);
  assert.ok(box.min.y >= -0.35 && box.max.y <= 4.6, `Bounds y: ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}`);
  assert.ok(box.min.x <= -2.9 && box.max.x >= 2.9, 'Glasshouse shell spans interior width');
  assert.ok(box.min.z <= -2.5 && box.max.z >= 2.5, 'Glasshouse shell spans interior depth');

  rig.dispose();
  palette.disposeAll();
});

test('greenhouse plot pots mirror the four plot registry slots with per-crop stage meshes', () => {
  const palette = new MaterialPalette();
  const rig = buildSunbeamGreenhouseInterior(palette, new THREE.Texture(), {});

  assert.equal(rig.plotSproutGroups.length, GREENHOUSE_PLOT_COUNT);
  assert.equal(rig.plotLeafyGroups.length, GREENHOUSE_PLOT_COUNT);
  assert.equal(rig.plotBloomGroups.length, GREENHOUSE_PLOT_COUNT);
  for (const crop of Object.keys(rig.plotStageGroups) as GreenhouseCropId[]) {
    assert.equal(
      rig.plotStageGroups[crop].length,
      GREENHOUSE_PLOT_COUNT,
      `Crop ${crop} has a bloom group per plot`,
    );
  }

  // Plot pots sit along the west shelf at the registry z positions
  for (let i = 0; i < GREENHOUSE_PLOT_COUNT; i++) {
    const sprout = rig.plotSproutGroups[i];
    const z = GREENHOUSE_PLOT_SHELF_Z[i];
    assert.ok(sprout, `Plot ${i} sprout group exists`);
    // Walk up from sprout to its plot group (2 levels) and compare shelf z
    const plotGroup = sprout.parent!;
    assert.ok(
      Math.abs(plotGroup.position.z - z) < 0.01,
      `Plot ${i} pot z ${plotGroup.position.z.toFixed(2)} matches registry ${z}`,
    );
  }

  rig.dispose();
  palette.disposeAll();
});

test('greenhouse growth stages drive pot visuals: sprout, leafy, per-crop blooms, and watered soil', () => {
  const palette = new MaterialPalette();
  const rig = buildSunbeamGreenhouseInterior(palette, new THREE.Texture(), {});
  const base = createFreshWorldState();

  // Empty greenhouse: nothing growing
  rig.update(base, 'morning', 1.0);
  for (let i = 0; i < GREENHOUSE_PLOT_COUNT; i++) {
    assert.equal(rig.plotSproutGroups[i].visible, false);
    assert.equal(rig.plotLeafyGroups[i].visible, false);
    for (const crop of Object.keys(rig.plotBloomGroups[i]) as GreenhouseCropId[]) {
      assert.equal(rig.plotBloomGroups[i][crop].visible, false);
    }
  }

  // Mixed plot states: ready chamomile, sprouting lavender, leafy thyme, one empty
  const growing = {
    ...base,
    greenhouseState: {
      ...base.greenhouseState,
      plots: [
        { cropId: 'chamomile' as const, plantedDay: 1, nightsGrown: 2, stage: 3 as const, wateredToday: true, waterStreak: 0 },
        { cropId: 'lavender' as const, plantedDay: 1, nightsGrown: 1, stage: 1 as const, wateredToday: false, waterStreak: 0 },
        { cropId: 'thyme' as const, plantedDay: 1, nightsGrown: 2, stage: 2 as const, wateredToday: true, waterStreak: 0 },
        { cropId: null, plantedDay: 0, nightsGrown: 0, stage: 0 as const, wateredToday: false, waterStreak: 0 },
      ],
    },
  };
  rig.update(growing, 'afternoon', 2.0);
  assert.equal(rig.plotBloomGroups[0].chamomile.visible, true, 'Ready chamomile blooms');
  assert.equal(rig.plotBloomGroups[0].lavender.visible, false);
  assert.equal(rig.plotBloomGroups[0].thyme.visible, false);
  assert.equal(rig.plotSproutGroups[1].visible, true, 'Lavender sprout shows');
  assert.equal(rig.plotLeafyGroups[2].visible, true, 'Leafy thyme shows');
  assert.equal(rig.plotSproutGroups[3].visible, false, 'Empty pot shows nothing');

  // Wrong-crop blooms never co-show on the ready pot; stage-2 pot shows leafy, not blooms
  rig.update(growing, 'afternoon', 2.4);
  assert.equal(rig.plotBloomGroups[0].chamomile.visible, true);
  assert.equal(rig.plotBloomGroups[0].thyme.visible, false);
  assert.equal(rig.plotBloomGroups[0].lavender.visible, false);
  assert.equal(rig.plotBloomGroups[2].thyme.visible, false, 'Stage-2 leafy pot has no blooms yet');
  assert.equal(rig.plotLeafyGroups[2].visible, true);

  // 120 simulated updates keep sway finite and inside small rotational bounds
  for (let t = 0; t < 120; t++) {
    rig.update(growing, 'afternoon', t * 0.1 + 3);
    const bloom = rig.plotBloomGroups[0].chamomile;
    assert.ok(Number.isFinite(bloom.rotation.z) && Math.abs(bloom.rotation.z) <= 0.06);
    assert.ok(Number.isFinite(bloom.rotation.x) && Math.abs(bloom.rotation.x) <= 0.05);
  }

  rig.dispose();
  palette.disposeAll();
});

test('greenhouse atmosphere: glass daylight shafts brighten by day, lantern warms at dusk, motes stay finite', () => {
  const palette = new MaterialPalette();
  const rig = buildSunbeamGreenhouseInterior(palette, new THREE.Texture(), {});
  const base = createFreshWorldState();

  let motes: THREE.Points | null = null;
  let shaft: THREE.Mesh | null = null;
  let lanternLight: THREE.PointLight | null = null;
  rig.group.traverse((obj) => {
    if (obj instanceof THREE.Points && !motes) motes = obj;
    if (obj instanceof THREE.PointLight && !lanternLight) lanternLight = obj;
    if (
      obj instanceof THREE.Mesh &&
      obj.material instanceof THREE.MeshBasicMaterial &&
      obj.material.transparent &&
      !obj.material.map &&
      (obj.geometry as THREE.PlaneGeometry).type === 'PlaneGeometry' &&
      !shaft
    ) {
      shaft = obj;
    }
  });

  assert.ok(motes, 'Greenhouse rig carries drifting pollen motes');
  assert.ok(shaft, 'Greenhouse rig carries glass sun shafts');
  assert.ok(lanternLight, 'Greenhouse rig carries a warm fallback lantern light');

  rig.update({ ...base, minuteOfDay: 540 }, 'morning', 2.0);
  const morningOpacity = (shaft as THREE.Mesh).material as THREE.MeshBasicMaterial;
  const morning = morningOpacity.opacity;
  rig.update({ ...base, minuteOfDay: 1140 }, 'dusk', 2.0);
  const dusk = morningOpacity.opacity;
  assert.ok(morning > dusk * 2.5, `Morning glass light (${morning.toFixed(2)}) much stronger than dusk (${dusk.toFixed(2)})`);
  assert.ok((lanternLight as THREE.PointLight).intensity > 1.0, 'Lantern carries the dusk mood');

  const arr = ((motes as THREE.Points).geometry).attributes.position.array as Float32Array;
  for (let t = 0; t < 240; t++) {
    rig.update(base, 'golden', t * 0.1 + 10);
    for (let i = 0; i < arr.length; i += 3) {
      assert.ok(Number.isFinite(arr[i]) && Number.isFinite(arr[i + 1]) && Number.isFinite(arr[i + 2]));
      assert.ok(arr[i] > -3.1 && arr[i] < 3.1, `Mote x out of band: ${arr[i]}`);
      assert.ok(arr[i + 1] > 0.2 && arr[i + 1] < 3.0, `Mote y out of band: ${arr[i + 1]}`);
      assert.ok(arr[i + 2] > -2.6 && arr[i + 2] < 2.6, `Mote z out of band: ${arr[i + 2]}`);
    }
  }

  rig.dispose();
  palette.disposeAll();
});

test('greenhouse doorway dressing: cedar door, lantern, sign, and step stone stay grounded and bounded', () => {
  const palette = new MaterialPalette();
  const doorway = buildSunbeamGreenhouseDoorway(palette, new THREE.Texture());

  let meshCount = 0;
  let emissiveGlow = 0;
  doorway.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      meshCount++;
      const mat = obj.material as THREE.MeshStandardMaterial;
      if (mat.emissive && mat.emissiveIntensity > 0.2) emissiveGlow++;
    }
  });
  assert.ok(meshCount >= 12, `Doorway dressing is composite (got ${meshCount} meshes)`);
  assert.ok(emissiveGlow >= 1, 'Door lantern carries an emissive glow');

  const box = new THREE.Box3().setFromObject(doorway);
  assert.ok(box.min.y >= -0.05 && box.max.y <= 2.6, `Doorway bounds y: ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}`);

  const dispose = doorway.userData.dispose as (() => void) | undefined;
  assert.equal(typeof dispose, 'function');
  dispose?.();

  palette.disposeAll();
});
