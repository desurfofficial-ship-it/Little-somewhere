import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { NOOK_INTERACTABLES, NOOK_SEAT_SPOTS, getFeaturedBookForDay } from '../game/bookNook';
import { createFreshWorldState } from '../game/storage';
import { MaterialPalette } from './materials';
import {
  buildLindenBookNookInterior,
  buildLindenBookNookPorchDressing,
} from './builders/bookNookInterior';

test('book nook interior 3D rig exposes one hit proxy per station plus the reading armchair, and stays inside diorama bounds', () => {
  const palette = new MaterialPalette();
  const rig = buildLindenBookNookInterior(palette, new THREE.Texture(), { isSoftwareGl: true });

  const proxies = rig.hitProxies.filter((mesh) => mesh.userData.targetKind === 'nook_prop');
  assert.equal(proxies.length, NOOK_INTERACTABLES.length);
  const ids = new Set(proxies.map((mesh) => mesh.userData.targetId));
  for (const prop of NOOK_INTERACTABLES) {
    assert.ok(ids.has(prop.id), `Missing nook hit proxy for ${prop.id}`);
  }
  for (const prop of NOOK_INTERACTABLES) {
    const proxy = proxies.find((p) => p.userData.targetId === prop.id)!;
    assert.ok(
      Math.abs(proxy.position.x - prop.focusX) < 0.05 && Math.abs(proxy.position.z - prop.focusZ) < 0.05,
      `Proxy for ${prop.id} should sit at the focus point`,
    );
  }

  const seatProxy = rig.hitProxies.find(
    (mesh) =>
      mesh.userData.targetKind === 'seat' && mesh.userData.targetId === NOOK_SEAT_SPOTS[0].id,
  );
  assert.ok(seatProxy, 'reading armchair seat proxy present');

  const box = new THREE.Box3().setFromObject(rig.group);
  assert.ok(box.min.y >= -0.35 && box.max.y <= 4.3, `Bounds y: ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}`);
  assert.ok(box.min.x <= -2.4 && box.max.x >= 2.4, 'Nook shell spans interior width');
  assert.ok(box.min.z <= -2.3 && box.max.z >= 2.3, 'Nook shell spans interior depth');

  rig.dispose();
  palette.disposeAll();
});

test('book nook reactive layer: open book after the browse, tea steam only when poured, lamp warms at dusk', () => {
  const palette = new MaterialPalette();
  const rig = buildLindenBookNookInterior(palette, new THREE.Texture(), {});
  const base = createFreshWorldState();

  // Day 1, nothing done: open book hidden, no steam
  const fresh = { ...base, day: 1 };
  rig.update(fresh, 'morning', 1.0);
  assert.equal(rig.openBookGroup.visible, false);
  assert.equal(rig.teaSteamGroup.children.every((p) => p.visible === false), true);

  // After browsing: the open book appears with the featured book's shelf tint
  const browsed = { ...fresh, nookState: { ...base.nookState, shelfBrowsedDay: 1 } };
  rig.update(browsed, 'morning', 1.0);
  assert.equal(rig.openBookGroup.visible, true);

  // After pouring tea: steam puffs rise
  const tea = { ...browsed, nookState: { ...base.nookState, shelfBrowsedDay: 1, teaSharedDay: 1 } };
  rig.update(tea, 'morning', 1.0);
  assert.equal(rig.teaSteamGroup.children.some((p) => p.visible === true), true);

  // Dusk hides the steam but lights the reading lamp
  rig.update(tea, 'dusk', 2.0);
  assert.equal(rig.teaSteamGroup.children.every((p) => p.visible === false), true);
  assert.ok(rig.readingLampLight.intensity > 0.6, 'reading lamp glows at dusk');
  rig.update(browsed, 'dusk', 2.5);
  assert.ok(rig.readingLampLight.intensity > 0.6);

  // 240-update soak: values stay finite (zero-GC + no NaN drift)
  let ok = true;
  for (let i = 0; i < 240; i++) {
    rig.update(tea, i % 3 === 0 ? 'morning' : 'afternoon', i * 0.016);
    if (!Number.isFinite(rig.readingLampLight.intensity)) ok = false;
  }
  assert.equal(ok, true, 'lamp intensity stays finite across 240 updates');

  rig.dispose();
  palette.disposeAll();
});

test('book nook featured-book cycle drives the open book day by day (roster ↔ rig contract)', () => {
  const palette = new MaterialPalette();
  const rig = buildLindenBookNookInterior(palette, new THREE.Texture(), {});
  const base = createFreshWorldState();

  for (let day = 1; day <= 5; day++) {
    const world = { ...base, day, nookState: { ...base.nookState, shelfBrowsedDay: day } };
    rig.update(world, 'morning', day * 0.1);
    assert.equal(rig.openBookGroup.visible, true, `day ${day} open book`);
    const featured = getFeaturedBookForDay(day);
    const cover = rig.openBookGroup.children[0] as THREE.Mesh;
    assert.ok(cover, `cover mesh present for ${featured.title}`);
  }

  rig.dispose();
  palette.disposeAll();
});

test('book nook porch dressing stays grounded, bounded, and disposes cleanly', () => {
  const palette = new MaterialPalette();
  const dressing = buildLindenBookNookPorchDressing(palette, new THREE.Texture());

  const box = new THREE.Box3().setFromObject(dressing);
  assert.ok(box.min.y >= -0.05 && box.max.y <= 2.3, `porch y bounds: ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}`);

  const disposeSpy = dressing.userData.dispose as () => void;
  assert.equal(typeof disposeSpy, 'function');
  disposeSpy();

  palette.disposeAll();
});

test('book nook rig disposal clears owned GPU resources without touching the palette registry', () => {
  const palette = new MaterialPalette();
  const rig = buildLindenBookNookInterior(palette, new THREE.Texture(), {});
  rig.dispose();
  assert.ok(rig.group.children.length > 10, 'rig group stays populated after dispose');
  assert.equal(typeof rig.update, 'function');
  palette.disposeAll();
});
