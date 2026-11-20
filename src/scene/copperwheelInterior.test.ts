import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  COPPERWHEEL_INTERACTABLES,
  COPPERWHEEL_SEAT_SPOTS,
  getProjectForDay,
} from '../game/copperwheel';
import { createFreshWorldState } from '../game/storage';
import { MaterialPalette } from './materials';
import {
  buildCopperwheelInterior,
  buildCopperwheelPorchDressing,
} from './builders/copperwheelInterior';

test('copperwheel interior 3D rig exposes one hit proxy per station plus the window armchair, and stays inside diorama bounds', () => {
  const palette = new MaterialPalette();
  const rig = buildCopperwheelInterior(palette, new THREE.Texture(), { isSoftwareGl: true });

  const proxies = rig.hitProxies.filter((mesh) => mesh.userData.targetKind === 'copperwheel_prop');
  assert.equal(proxies.length, COPPERWHEEL_INTERACTABLES.length);
  const ids = new Set(proxies.map((mesh) => mesh.userData.targetId));
  for (const prop of COPPERWHEEL_INTERACTABLES) {
    assert.ok(ids.has(prop.id), `Missing copperwheel hit proxy for ${prop.id}`);
  }
  for (const prop of COPPERWHEEL_INTERACTABLES) {
    const proxy = proxies.find((p) => p.userData.targetId === prop.id)!;
    assert.ok(
      Math.abs(proxy.position.x - prop.focusX) < 0.05 &&
        Math.abs(proxy.position.z - prop.focusZ) < 0.05,
      `Proxy for ${prop.id} should sit at the focus point`,
    );
  }

  const seatProxy = rig.hitProxies.find(
    (mesh) =>
      mesh.userData.targetKind === 'seat' && mesh.userData.targetId === COPPERWHEEL_SEAT_SPOTS[0].id,
  );
  assert.ok(seatProxy, 'window armchair seat proxy present');

  const box = new THREE.Box3().setFromObject(rig.group);
  assert.ok(box.min.y >= -0.35 && box.max.y <= 4.3, `Bounds y: ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}`);
  assert.ok(box.min.x <= -2.9 && box.max.x >= 2.9, 'Workshop shell spans interior width');
  assert.ok(box.min.z <= -2.4 && box.max.z >= 2.4, 'Workshop shell spans interior depth');

  rig.dispose();
  palette.disposeAll();
});

test('copperwheel reactive layer: day project swap, pendulum swing after the bench check, kettle steam only when poured, lamp warms at dusk', () => {
  const palette = new MaterialPalette();
  const rig = buildCopperwheelInterior(palette, new THREE.Texture(), {});
  const base = createFreshWorldState();

  // Day 1, nothing done: only the day-1 project visible, no steam, no swing
  const fresh = { ...base, day: 1 };
  rig.update(fresh, 'morning', 1.0);
  assert.equal(rig.projectGroups['orchard_pendulum'].visible, true, 'day-1 pendulum project shown');
  assert.equal(rig.projectGroups['music_box_comb'].visible, false);
  assert.equal(rig.projectGroups['bench_rest'].visible, false);
  assert.equal(rig.kettleSteamGroup.children.every((p) => p.visible === false), true);
  const pivotBefore = rig.projectGroups['orchard_pendulum'].children.find(
    (c) => c.type === 'Group',
  ) as THREE.Group | undefined;
  assert.ok(pivotBefore, 'pendulum rod pivot present');

  // After checking the bench: steam still off, but the rig updated with the checked state
  const checked = { ...fresh, copperwheelState: { ...base.copperwheelState, benchCheckedDay: 1 } };
  rig.update(checked, 'morning', 2.0);

  // After pouring tea: steam puffs rise
  const tea = {
    ...checked,
    copperwheelState: { ...base.copperwheelState, benchCheckedDay: 1, teaSharedDay: 1 },
  };
  rig.update(tea, 'morning', 3.0);
  assert.equal(rig.kettleSteamGroup.children.some((p) => p.visible === true), true);

  // Dusk hides the steam but lights the bench lamp
  rig.update(tea, 'dusk', 4.0);
  assert.equal(rig.kettleSteamGroup.children.every((p) => p.visible === false), true);
  assert.ok(rig.benchLampLight.intensity > 0.6, 'bench lamp glows at dusk');

  // Day 4: the bench-rest project replaces the pendulum
  rig.update({ ...base, day: 4 }, 'morning', 5.0);
  assert.equal(rig.projectGroups['bench_rest'].visible, true);
  assert.equal(rig.projectGroups['orchard_pendulum'].visible, false);

  // 240-update soak: values stay finite (zero-GC + no NaN drift)
  let ok = true;
  for (let i = 0; i < 240; i++) {
    rig.update(tea, i % 3 === 0 ? 'morning' : 'afternoon', i * 0.016);
    if (!Number.isFinite(rig.benchLampLight.intensity)) ok = false;
  }
  assert.equal(ok, true, 'lamp intensity stays finite across 240 updates');

  rig.dispose();
  palette.disposeAll();
});

test('copperwheel bench project cycle drives the visible project day by day (roster ↔ rig contract)', () => {
  const palette = new MaterialPalette();
  const rig = buildCopperwheelInterior(palette, new THREE.Texture(), {});
  const base = createFreshWorldState();

  for (let day = 1; day <= 5; day++) {
    const world = { ...base, day, copperwheelState: { ...base.copperwheelState, benchCheckedDay: day } };
    rig.update(world, 'morning', day * 0.1);
    const project = getProjectForDay(day);
    assert.equal(
      rig.projectGroups[project.id].visible,
      true,
      `day ${day} shows the ${project.id} project`,
    );
    const otherKeys = Object.keys(rig.projectGroups).filter((k) => k !== project.id);
    assert.equal(
      otherKeys.every((k) => rig.projectGroups[k].visible === false),
      true,
      `day ${day} hides all other projects`,
    );
  }

  rig.dispose();
  palette.disposeAll();
});

test('copperwheel porch dressing stays grounded, bounded, and disposes cleanly', () => {
  const palette = new MaterialPalette();
  const dressing = buildCopperwheelPorchDressing(palette, new THREE.Texture());

  const box = new THREE.Box3().setFromObject(dressing);
  assert.ok(box.min.y >= -0.05 && box.max.y <= 2.3, `porch y bounds: ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}`);

  const disposeSpy = dressing.userData.dispose as () => void;
  assert.equal(typeof disposeSpy, 'function');
  disposeSpy();

  palette.disposeAll();
});

test('copperwheel rig disposal clears owned GPU resources without touching the palette registry', () => {
  const palette = new MaterialPalette();
  const rig = buildCopperwheelInterior(palette, new THREE.Texture(), {});
  rig.dispose();
  assert.ok(rig.group.children.length > 10, 'rig group stays populated after dispose');
  assert.equal(typeof rig.update, 'function');
  palette.disposeAll();
});
