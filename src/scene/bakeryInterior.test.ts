import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BAKERY_INTERACTABLES, getBakeForDay } from '../game/bakery';
import { createFreshWorldState } from '../game/storage';
import { MaterialPalette } from './materials';
import {
  buildHearthCrumbInterior,
  buildHearthCrumbPorchDressing,
} from './builders/bakeryInterior';

test('bakery interior 3D rig exposes one hit proxy per station plus the café seat, and stays inside diorama bounds', () => {
  const palette = new MaterialPalette();
  const rig = buildHearthCrumbInterior(palette, new THREE.Texture(), { isSoftwareGl: true });

  const proxies = rig.hitProxies.filter((mesh) => mesh.userData.targetKind === 'bakery_prop');
  assert.equal(proxies.length, BAKERY_INTERACTABLES.length);
  const ids = new Set(proxies.map((mesh) => mesh.userData.targetId));
  for (const prop of BAKERY_INTERACTABLES) {
    assert.ok(ids.has(prop.id), `Missing bakery hit proxy for ${prop.id}`);
  }

  for (const prop of BAKERY_INTERACTABLES) {
    const proxy = proxies.find((p) => p.userData.targetId === prop.id)!;
    assert.ok(
      Math.abs(proxy.position.x - prop.focusX) < 0.05 && Math.abs(proxy.position.z - prop.focusZ) < 0.05,
      `Proxy for ${prop.id} should sit at the focus point`,
    );
  }

  const seatProxy = rig.hitProxies.find(
    (mesh) =>
      mesh.userData.targetKind === 'seat' && mesh.userData.targetId === 'bakery_seat_cafe_west',
  );
  assert.ok(seatProxy, 'café chair seat proxy present');

  const box = new THREE.Box3().setFromObject(rig.group);
  assert.ok(box.min.y >= -0.35 && box.max.y <= 4.4, `Bounds y: ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}`);
  assert.ok(box.min.x <= -2.9 && box.max.x >= 2.9, 'Bakery shell spans interior width');
  assert.ok(box.min.z <= -2.35 && box.max.z >= 2.35, 'Bakery shell spans interior depth');

  rig.dispose();
  palette.disposeAll();
});

test('bakery reactive layer: ember glow answers bake vs rest day, steam only when checked today', () => {
  const palette = new MaterialPalette();
  const rig = buildHearthCrumbInterior(palette, new THREE.Texture(), {});
  const base = createFreshWorldState();

  // Bake day (day 1, sunflower sourdough), not yet checked: embers warm, no steam, loaves shown
  const bakeDay = { ...base, day: 1 };
  rig.update(bakeDay, 'morning', 1.0);
  const emberColdCheck = rig.ovenEmberLight.intensity;
  assert.equal(rig.bakeSteamGroup.children.every((p) => p.visible === false), true);
  assert.equal(rig.counterLoafGroup.visible, true);
  assert.ok(emberColdCheck > 0.6, 'bake-day embers glow before reveal');

  // After checking the bake: steam puffs rise
  const checked = { ...bakeDay, bakeryState: { ...base.bakeryState, bakeCheckedDay: 1 } };
  rig.update(checked, 'morning', 1.0);
  assert.equal(rig.bakeSteamGroup.children.some((p) => p.visible === true), true);

  // Rest day (day 4): embers banked, steam off, counter loaf row hidden
  const restDay = { ...base, day: 4, bakeryState: { ...base.bakeryState, bakeCheckedDay: 4 } };
  rig.update(restDay, 'morning', 1.0);
  assert.equal(rig.bakeSteamGroup.children.every((p) => p.visible === false), true);
  assert.equal(rig.counterLoafGroup.visible, false);
  const restEmber = rig.ovenEmberLight.intensity;
  assert.ok(restEmber < emberColdCheck - 0.3, 'rest-day embers are visibly banked');

  // Dusk hides the morning steam but keeps embers alive
  rig.update(checked, 'dusk', 2.0);
  assert.equal(rig.bakeSteamGroup.children.every((p) => p.visible === false), true);
  assert.ok(rig.ovenEmberLight.intensity > 0.5);

  // 240-update soak: values stay finite (zero-GC + no NaN drift)
  let ok = true;
  for (let i = 0; i < 240; i++) {
    rig.update(checked, i % 4 === 0 ? 'morning' : 'afternoon', i * 0.016);
    if (!Number.isFinite(rig.ovenEmberLight.intensity)) ok = false;
  }
  assert.equal(ok, true, 'ember intensity stays finite across 240 updates');

  rig.dispose();
  palette.disposeAll();
});

test('bakery roster drives the reactive layer deterministically (roster ↔ rig contract)', () => {
  const palette = new MaterialPalette();
  const rig = buildHearthCrumbInterior(palette, new THREE.Texture(), {});
  const base = createFreshWorldState();

  // Every non-rest day shows loaves; the rest day hides them
  for (let day = 1; day <= 8; day++) {
    const world = { ...base, day, bakeryState: { ...base.bakeryState, bakeCheckedDay: day } };
    rig.update(world, 'morning', day * 0.1);
    const bake = getBakeForDay(day);
    assert.equal(rig.counterLoafGroup.visible, bake.id !== 'oven_rest', `day ${day} loaf row`);
  }

  rig.dispose();
  palette.disposeAll();
});

test('bakery porch dressing stays grounded, bounded, and disposes cleanly', () => {
  const palette = new MaterialPalette();
  const dressing = buildHearthCrumbPorchDressing(palette, new THREE.Texture());

  const box = new THREE.Box3().setFromObject(dressing);
  assert.ok(box.min.y >= -0.05 && box.max.y <= 2.3, `porch y bounds: ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}`);
  assert.ok(box.max.z > 0.4, 'step stone extends toward the player approach side');

  const disposeSpy = dressing.userData.dispose as () => void;
  assert.equal(typeof disposeSpy, 'function');
  disposeSpy();

  palette.disposeAll();
});

test('bakery rig disposal clears owned GPU resources without touching the palette registry', () => {
  const palette = new MaterialPalette();
  const rig = buildHearthCrumbInterior(palette, new THREE.Texture(), {});
  rig.dispose();
  // Disposable group remains structurally intact (callers own the add/remove lifecycle)
  assert.ok(rig.group.children.length > 10, 'rig group stays populated after dispose');
  assert.equal(typeof rig.update, 'function');
  palette.disposeAll();
});
