import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BAKERY_INTERACTABLES, getBakeForDay } from '../game/bakery';
import { createFreshWorldState } from '../game/storage';
import { MaterialPalette } from './materials';
import { collectShellSides } from './roomFraming';
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

// ---------------------------------------------------------------------------
// FURN-1 / Overhaul Phase 3 (E-6): yaw-aware cutaway shell tags
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

test('bakery shell tags: N/W full assembly + mounted props tagged, E/S curbs tagged low, furniture never tagged', () => {
  const palette = new MaterialPalette();
  const rig = buildHearthCrumbInterior(palette, new THREE.Texture(), { isSoftwareGl: true });
  const shells = collectShellSides(rig.group);
  const tagged = new Set(shells.map((s) => s.mesh));

  assert.ok(shells.length >= 4, `at least 4 tagged shell meshes, got ${shells.length}`);

  // Full-height shell: N or W only, and geometrically at its side (N = −Z, W = −X)
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

  // Curbs: E or S with full=false, geometrically at their low sides
  const curbs = shells.filter((s) => !s.full);
  assert.ok(curbs.length >= 3, `curb meshes tagged, got ${curbs.length}`);
  for (const s of curbs) {
    assert.ok(s.side === 'E' || s.side === 'S', `curbs sit on E/S only, got ${s.side}`);
    const p = new THREE.Vector3();
    s.mesh.getWorldPosition(p);
    if (s.side === 'E') {
      assert.ok(p.x > 2.8, `E curb at world x ${p.x.toFixed(2)}`);
    } else {
      assert.ok(p.z > 2.2, `S curb at world z ${p.z.toFixed(2)}`);
    }
  }

  // Furniture, floor and interaction anchors are NEVER tagged (they must never hide)
  for (const proxy of rig.hitProxies) {
    assert.ok(!tagged.has(proxy), 'hit proxies are never shell-tagged');
  }
  const floor = findMeshByGeometry(rig.group, 'BoxGeometry', { width: 6.2, height: 0.06, depth: 4.9 });
  assert.ok(floor && !tagged.has(floor), 'plank floor is never tagged');
  const chairSeat = findMeshByGeometry(rig.group, 'CylinderGeometry', {
    radiusTop: 0.19,
    radiusBottom: 0.17,
    height: 0.05,
  });
  assert.ok(chairSeat && !tagged.has(chairSeat), 'café chair seats are never tagged');
  const ovenDome = findMeshByGeometry(rig.group, 'SphereGeometry', { radius: 0.72 });
  assert.ok(ovenDome && !tagged.has(ovenDome), 'bake oven (furniture) is never tagged');
  // The south entrance door group rides a curb side — deliberately untagged so it always shows.
  const doorPanel = findMeshByGeometry(rig.group, 'BoxGeometry', { width: 1.06, height: 1.92, depth: 0.09 });
  assert.ok(doorPanel && !tagged.has(doorPanel), 'south door panel (curb side) is never tagged');

  rig.dispose();
  palette.disposeAll();
});
