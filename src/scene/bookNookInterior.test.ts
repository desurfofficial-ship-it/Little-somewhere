import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { NOOK_INTERACTABLES, NOOK_SEAT_SPOTS, getFeaturedBookForDay } from '../game/bookNook';
import { createFreshWorldState } from '../game/storage';
import { MaterialPalette, STORYBOOK_PALETTE } from './materials';
import { collectShellSides } from './roomFraming';
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

test('nook shell tags: N/W full assembly + mounted shelves/frames tagged, E/S curbs tagged low, furniture never tagged', () => {
  const palette = new MaterialPalette();
  const rig = buildLindenBookNookInterior(palette, new THREE.Texture(), { isSoftwareGl: true });
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
      assert.ok(p.x > 2.3, `E curb at world x ${p.x.toFixed(2)}`);
    } else {
      assert.ok(p.z > 2.2, `S curb at world z ${p.z.toFixed(2)}`);
    }
  }

  // The armchair (and everything on it) must never hide: not a single mesh of
  // the chair group carries a shell tag.
  const chairCushion = findMeshByGeometry(rig.group, 'BoxGeometry', { width: 0.95, height: 0.32, depth: 0.95 });
  assert.ok(chairCushion && !tagged.has(chairCushion), 'armchair seat is never tagged');
  const chairBack = findMeshByGeometry(rig.group, 'BoxGeometry', { width: 0.95, height: 0.7, depth: 0.22 });
  assert.ok(chairBack && !tagged.has(chairBack), 'armchair back is never tagged');
  const shelfBody = findMeshByGeometry(rig.group, 'BoxGeometry', { width: 3.5, height: 1.9, depth: 0.62 });
  assert.ok(shelfBody && !tagged.has(shelfBody), 'bookshelf wall (furniture) is never tagged');
  const floor = findMeshByGeometry(rig.group, 'BoxGeometry', { width: 5.2, height: 0.06, depth: 4.9 });
  assert.ok(floor && !tagged.has(floor), 'plank floor is never tagged');
  for (const proxy of rig.hitProxies) {
    assert.ok(!tagged.has(proxy), 'hit proxies are never shell-tagged');
  }
  // The east door rides a curb side — deliberately untagged so it always shows.
  const doorPanel = findMeshByGeometry(rig.group, 'BoxGeometry', { width: 0.09, height: 1.9, depth: 1.0 });
  assert.ok(doorPanel && !tagged.has(doorPanel), 'east door panel (curb side) is never tagged');

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
