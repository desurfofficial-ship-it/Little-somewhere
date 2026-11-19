import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { COTTAGE_INTERACTABLES, COTTAGE_SEAT_SPOTS } from '../game/cottage';
import { createFreshWorldState } from '../game/storage';
import { MaterialPalette } from './materials';
import { buildWillowCottageInterior } from './builders/cottageInterior';

test('cottage interior 3D rig exposes all 7 cottage hit proxies + 2 indoor seat proxies', () => {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());

  const cottageProxies = rig.hitProxies.filter(
    (mesh) => mesh.userData.targetKind === 'cottage_prop',
  );
  const seatProxies = rig.hitProxies.filter((mesh) => mesh.userData.targetKind === 'seat');
  assert.equal(cottageProxies.length, COTTAGE_INTERACTABLES.length);
  assert.equal(seatProxies.length, COTTAGE_SEAT_SPOTS.length);
  const ids = new Set(cottageProxies.map((mesh) => mesh.userData.targetId));
  for (const prop of COTTAGE_INTERACTABLES) {
    assert.ok(ids.has(prop.id), `Missing interior hit proxy for ${prop.id}`);
  }
  const seatIds = new Set(seatProxies.map((mesh) => mesh.userData.targetId));
  for (const seat of COTTAGE_SEAT_SPOTS) {
    assert.ok(seatIds.has(seat.id), `Missing indoor seat proxy for ${seat.id}`);
  }

  const box = new THREE.Box3().setFromObject(rig.group);
  assert.ok(box.min.y >= -0.35 && box.max.y <= 3.6, 'Interior geometry stays within diorama height bounds');
  assert.ok(box.min.x <= -3.4 && box.max.x >= 3.4, 'Interior floor/walls span cottage width');
  assert.ok(box.min.z <= -2.6 && box.max.z >= 2.6, 'Interior floor/walls span cottage depth');

  rig.dispose();
  palette.disposeAll();
});

test('cottage interior reactive vase flowers, keepsake shelf items, hearth embers, and window daylight update cleanly', () => {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());
  const base = createFreshWorldState();

  // Default state: empty vase visible, flowers hidden, keepsakes hidden
  rig.update(base, 'morning', 1.0);
  assert.equal(rig.vaseEmptyGroup.visible, true);
  assert.equal(rig.vaseFlowers.chamomile_blossom.visible, false);
  assert.equal(rig.vaseFlowers.lavender_sprig.visible, false);
  assert.equal(rig.vaseFlowers.crabapple.visible, false);
  assert.equal(rig.shelfKeepsakes.willow_zine_copy.visible, false);
  assert.equal(rig.shelfKeepsakes.brass_pocket_bell.visible, false);

  // Place lavender & display keepsakes + warm kettle dusk update
  const decorated = {
    ...base,
    minuteOfDay: 1120,
    cottageState: {
      ...base.cottageState,
      placedFlowerId: 'lavender_sprig' as const,
      displayedKeepsakeIds: ['willow_zine_copy' as const, 'brass_pocket_bell' as const],
      kettleWarmUntilMinute: 1200,
    },
  };
  rig.update(decorated, 'dusk', 2.5);
  assert.equal(rig.vaseFlowers.lavender_sprig.visible, true);
  assert.equal(rig.vaseFlowers.chamomile_blossom.visible, false);
  assert.equal(rig.shelfKeepsakes.willow_zine_copy.visible, true);
  assert.equal(rig.shelfKeepsakes.brass_pocket_bell.visible, true);
  assert.equal(rig.shelfKeepsakes.pond_watercolor_card.visible, false);
  assert.equal(rig.kettleSteamPuffs[0].visible, true);
  assert.ok(rig.almanacLampMat.emissiveIntensity > 0.7);

  rig.dispose();
  palette.disposeAll();
});

test('cottage interior atmosphere layer: hearth light responds to hearthLit, motes stay finite and bounded', () => {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());
  const base = createFreshWorldState();

  // Walk the rig graph to find the atmosphere pieces
  let hearthLight: THREE.PointLight | null = null;
  let motes: THREE.Points | null = null;
  let shaft: THREE.Mesh | null = null;
  rig.group.traverse((obj) => {
    if (obj instanceof THREE.PointLight && !hearthLight) hearthLight = obj;
    if (obj instanceof THREE.Points && !motes) motes = obj;
    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshBasicMaterial) {
      const mat = obj.material as THREE.MeshBasicMaterial;
      if (mat.blending === THREE.AdditiveBlending && (obj.geometry as THREE.PlaneGeometry).type === 'PlaneGeometry' && !shaft) {
        shaft = obj;
      }
    }
  });

  assert.ok(hearthLight, 'Interior rig carries a hearth point light');
  assert.ok(motes, 'Interior rig carries a dust-mote Points cloud');
  assert.ok(shaft, 'Interior rig carries a window daylight shaft');

  // Lit hearth at dusk: strong warm light; unlit hearth: light off
  const litWorld = { ...base, minuteOfDay: 1120 };
  rig.update(litWorld, 'dusk', 1.2);
  const litIntensity = (hearthLight as THREE.PointLight).intensity;
  assert.ok(litIntensity > 2.0, `Dusk hearth light should be strong, got ${litIntensity.toFixed(2)}`);

  const unlitWorld = {
    ...litWorld,
    cottageState: { ...base.cottageState, hearthLit: false },
  };
  rig.update(unlitWorld, 'dusk', 1.2);
  assert.equal((hearthLight as THREE.PointLight).intensity, 0);

  // Morning shaft is clearly brighter than dusk shaft
  rig.update({ ...base, minuteOfDay: 540 }, 'morning', 3.0);
  const shaftMat = (shaft as THREE.Mesh).material as THREE.MeshBasicMaterial;
  const morningOpacity = shaftMat.opacity;
  rig.update({ ...base, minuteOfDay: 1140 }, 'dusk', 3.0);
  const duskOpacity = shaftMat.opacity;
  assert.ok(morningOpacity > duskOpacity * 2, 'Morning shaft reads much stronger than dusk');

  // 240 simulated seconds of updates keep mote positions finite & inside the room
  const moteGeo = (motes as THREE.Points).geometry;
  const arr = moteGeo.attributes.position.array as Float32Array;
  for (let t = 0; t < 240; t++) {
    rig.update(base, 'morning', t * 0.1 + 10);
    for (let i = 0; i < arr.length; i += 3) {
      assert.ok(Number.isFinite(arr[i]) && Number.isFinite(arr[i + 1]) && Number.isFinite(arr[i + 2]));
      assert.ok(arr[i] > -3.7 && arr[i] < -1.3, `Mote x out of band: ${arr[i]}`);
      assert.ok(arr[i + 1] > 0.1 && arr[i + 1] < 2.2, `Mote y out of band: ${arr[i + 1]}`);
      assert.ok(arr[i + 2] > -0.8 && arr[i + 2] < 0.8, `Mote z out of band: ${arr[i + 2]}`);
    }
  }

  rig.dispose();
  palette.disposeAll();
});

test('cottage interior lived-in dressing exists without inflating the diorama bounds', () => {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());

  // Count meshes by name-tagged expectations via a simple heuristic: total mesh count
  // must have grown well past the pre-polish baseline while staying performant.
  let meshCount = 0;
  let stoolSeats = 0;
  rig.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      meshCount++;
      const geo = obj.geometry;
      if (geo instanceof THREE.CylinderGeometry && obj.position.y > 0.35 && obj.position.y < 0.5) {
        stoolSeats++;
      }
    }
  });

  assert.ok(stoolSeats >= 2, 'Two dining stools tuck against the oak table');
  assert.ok(meshCount > 90, `Interior dressing grew the mesh count (got ${meshCount})`);

  // The whole dressed diorama still fits the diorama envelope
  const box = new THREE.Box3().setFromObject(rig.group);
  assert.ok(box.min.y >= -0.35 && box.max.y <= 3.6, `Bounds y: ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}`);

  rig.dispose();
  palette.disposeAll();
});

test('cottage interior tea-table moment: reactive teacup appears only while seated at a cottage seat', () => {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());
  const base = createFreshWorldState();

  const teacup = rig.group.getObjectByName('teacupGroup');
  assert.ok(teacup, 'Reactive teacup group exists on the oak table');

  // Standing indoors: teacup hidden
  rig.update(base, 'morning', 1.0);
  assert.equal(teacup.visible, false);

  // Seated at a cottage seat: teacup + steam wisps appear, steam stays bounded
  const seated = {
    ...base,
    playerLocation: 'cottage_interior' as const,
    playerPosture: 'sitting' as const,
    playerSeatId: 'cottage_seat_table_west',
  };
  for (let t = 0; t < 120; t++) {
    rig.update(seated, 'afternoon', t * 0.1 + 2);
    assert.equal(teacup.visible, true);
    for (const child of teacup.children) {
      if (child instanceof THREE.Mesh && child.geometry instanceof THREE.SphereGeometry) {
        assert.ok(child.position.y > 0.05 && child.position.y < 0.5, `Steam wisp bounded: ${child.position.y}`);
        assert.ok(Number.isFinite(child.position.x) && Number.isFinite(child.position.y));
      }
    }
  }

  // Seated outdoors (bench) or on an unknown seat: teacup stays hidden
  rig.update(
    { ...seated, playerSeatId: 'seat_east_plaza' },
    'afternoon',
    3,
  );
  assert.equal(teacup.visible, false);

  rig.dispose();
  palette.disposeAll();
});

test('cottage interior hearth-wall life: mantel candle glows at dusk and the rig carries entry dressing', () => {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());
  const base = createFreshWorldState();

  // Find the mantel flame material via a flame-tagged emissive mesh near the chimney
  let flameMesh: THREE.Mesh | null = null;
  rig.group.traverse((obj) => {
    if (
      obj instanceof THREE.Mesh &&
      obj.material instanceof THREE.MeshStandardMaterial &&
      (obj.material as THREE.MeshStandardMaterial).emissive.getHexString() === 'ffb050' &&
      !flameMesh
    ) {
      flameMesh = obj;
    }
  });
  assert.ok(flameMesh, 'Mantel candle flame exists');
  const flameMat = (flameMesh as THREE.Mesh).material as THREE.MeshStandardMaterial;

  rig.update({ ...base, minuteOfDay: 1120 }, 'dusk', 1.2);
  const duskIntensity = flameMat.emissiveIntensity;
  assert.ok(duskIntensity > 1.2, `Candle flame glows at dusk, got ${duskIntensity.toFixed(2)}`);
  rig.update(base, 'morning', 1.2);
  assert.ok(flameMat.emissiveIntensity < 0.5, 'Candle flame dims by day');

  // Entry dressing: garden boots + straw hat exist in the door/east-corner region
  let bootMeshes = 0;
  let hatMeshes = 0;
  rig.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const p = obj.position;
      if (p.x > 2.9 && p.x < 3.4 && p.z > -0.7 && p.z < 0.2 && p.y < 0.25) bootMeshes++;
      if (p.x > 2.3 && p.x < 3.0 && p.z < -2.55 && p.y > 1.25 && p.y < 1.55) hatMeshes++;
    }
  });
  assert.ok(bootMeshes >= 4, `Garden boots dress the door recess (got ${bootMeshes})`);
  assert.ok(hatMeshes >= 2, `Straw hat hangs by the wall pegs (got ${hatMeshes})`);

  rig.dispose();
  palette.disposeAll();
});
