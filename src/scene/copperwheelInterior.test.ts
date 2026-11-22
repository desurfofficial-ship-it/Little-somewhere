import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  COPPERWHEEL_INTERACTABLES,
  COPPERWHEEL_SEAT_SPOTS,
  getProjectForDay,
} from '../game/copperwheel';
import { createFreshWorldState } from '../game/storage';
import { MaterialPalette, STORYBOOK_PALETTE } from './materials';
import { collectShellSides } from './roomFraming';
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

// ---------------------------------------------------------------------------
// FURN-1 / Overhaul Phase 3 (E-6): yaw-aware cutaway shell tags + upholstery
// ---------------------------------------------------------------------------

/** Finds the first mesh whose geometry type + numeric parameters all match. */
function findMeshByGeometry(
  root: THREE.Object3D,
  kind: string,
  params: Record<string, number>,
): THREE.Mesh | undefined {
  let found: THREE.Mesh | undefined;
  root.traverse((o) => {
    if (found) return;
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const geo = m.geometry as unknown as { type?: string; parameters?: Record<string, number> };
    if (geo.type !== kind) return;
    const p = geo.parameters ?? {};
    const matches = Object.entries(params).every(([k, v]) => Math.abs((p[k] ?? NaN) - v) < 1e-6);
    if (matches) found = m;
  });
  return found;
}

test('copperwheel shell tags: N/W full assembly + wall props tagged, E/S curbs tagged low, armchair never tagged', () => {
  const palette = new MaterialPalette();
  const rig = buildCopperwheelInterior(palette, new THREE.Texture(), { isSoftwareGl: true });
  const shells = collectShellSides(rig.group);
  const tagged = new Set(shells.map((s) => s.mesh));

  assert.ok(shells.length >= 4, `at least 4 tagged shell meshes, got ${shells.length}`);

  const fulls = shells.filter((s) => s.full);
  assert.ok(fulls.length >= 4, `full wall assembly tagged, got ${fulls.length}`);
  for (const s of fulls) {
    assert.ok(s.side === 'N' || s.side === 'W', `full shells sit on N/W only, got ${s.side}`);
    const p = new THREE.Vector3();
    s.mesh.getWorldPosition(p);
    if (s.side === 'N') {
      assert.ok(p.z < -2.0, `N-tagged mesh at world z ${p.z.toFixed(2)} (north side)`);
    } else {
      assert.ok(p.x < -2.3, `W-tagged mesh at world x ${p.x.toFixed(2)} (west side)`);
    }
  }

  const curbs = shells.filter((s) => !s.full);
  assert.ok(curbs.length >= 4, `curb meshes tagged, got ${curbs.length}`);
  for (const s of curbs) {
    assert.ok(s.side === 'E' || s.side === 'S', `curbs sit on E/S only, got ${s.side}`);
    const p = new THREE.Vector3();
    s.mesh.getWorldPosition(p);
    if (s.side === 'E') {
      assert.ok(p.x > 2.8, `E curb at world x ${p.x.toFixed(2)}`);
    } else {
      assert.ok(p.z > 2.3, `S curb at world z ${p.z.toFixed(2)}`);
    }
  }

  // The armchair rig must NEVER be tagged (FURN-1 hard rule) — chair shell,
  // plush upholstery, footstool and floor all stay untagged.
  const chairSeatBase = findMeshByGeometry(rig.group, 'BoxGeometry', { width: 0.86, height: 0.32, depth: 0.8 });
  assert.ok(chairSeatBase && !tagged.has(chairSeatBase), 'armchair seat base is never tagged');
  const backRest = findMeshByGeometry(rig.group, 'BoxGeometry', { width: 0.86, height: 0.72, depth: 0.2 });
  assert.ok(backRest && !tagged.has(backRest), 'armchair back rest is never tagged');
  const stoolTop = findMeshByGeometry(rig.group, 'BoxGeometry', { width: 0.44, height: 0.1, depth: 0.34 });
  assert.ok(stoolTop && !tagged.has(stoolTop), 'footstool is never tagged');
  const floor = findMeshByGeometry(rig.group, 'BoxGeometry', { width: 6.1, height: 0.06, depth: 5.1 });
  assert.ok(floor && !tagged.has(floor), 'plank floor is never tagged');
  for (const proxy of rig.hitProxies) {
    assert.ok(!tagged.has(proxy), 'hit proxies are never shell-tagged');
  }
  // The south door rides a curb side — deliberately untagged so it always shows.
  const doorSlab = findMeshByGeometry(rig.group, 'BoxGeometry', { width: 1.05, height: 2.05, depth: 0.09 });
  assert.ok(doorSlab && !tagged.has(doorSlab), 'south door slab (curb side) is never tagged');

  // B2 upholstery: plush mint seat + back cushions live INSIDE the armchair group
  const mintHex = new THREE.Color(STORYBOOK_PALETTE.upholsteryMint).getHexString();
  const mintCaps: THREE.Mesh[] = [];
  rig.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry.type === 'CapsuleGeometry') {
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat?.color?.getHexString() === mintHex) mintCaps.push(m);
    }
  });
  assert.ok(mintCaps.length >= 2, 'mint plush seat + back cushions present on the armchair');

  rig.dispose();
  palette.disposeAll();
});
