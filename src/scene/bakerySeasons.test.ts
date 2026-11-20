import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BAKERY_INTERACTABLES } from '../game/bakery';
import { createFreshWorldState } from '../game/storage';
import { MaterialPalette } from './materials';
import { buildHearthCrumbInterior } from './builders/bakeryInterior';
import type { SeasonType, WorldState } from '../game/types';

/** Build a world state forced to the given season (day kept in-season for realism). */
function worldInSeason(base: WorldState, season: SeasonType): WorldState {
  const day = season === 'spring' ? 2 : season === 'summer' ? 15 : season === 'autumn' ? 25 : 31;
  return { ...base, day, season };
}

const SEASONS: SeasonType[] = ['spring', 'summer', 'autumn', 'winter'];

test('bakery seasons: exactly one seasonal dressing group is visible per season, all hidden by default', () => {
  const palette = new MaterialPalette();
  const rig = buildHearthCrumbInterior(palette, new THREE.Texture(), { isSoftwareGl: true });
  const base = createFreshWorldState();

  // Fresh build, before any update: every season group starts hidden (spring default world)
  for (const season of SEASONS) {
    assert.equal(rig.seasonLife[season].visible, false, `${season} starts hidden`);
  }

  // Each season lights exactly its own group
  for (const season of SEASONS) {
    rig.update(worldInSeason(base, season), 'morning', 1.0);
    for (const s of SEASONS) {
      assert.equal(
        rig.seasonLife[s].visible,
        s === season,
        `${s} group visibility in ${season}`,
      );
    }
  }

  rig.dispose();
  palette.disposeAll();
});

test('bakery winter: swag, counter runner, sill pie and frost wedges all exist, named and placed inside the room', () => {
  const palette = new MaterialPalette();
  const rig = buildHearthCrumbInterior(palette, new THREE.Texture(), { isSoftwareGl: true });
  const base = createFreshWorldState();
  rig.update(worldInSeason(base, 'winter'), 'morning', 1.0);

  const winter = rig.seasonLife.winter;
  assert.ok(winter.visible, 'winter group shows in winter');
  const names = ['winter_swag', 'winter_counter_runner', 'winter_sill_pie', 'winter_frost_wedges'];
  for (const name of names) {
    const found = winter.children.find((c) => c.name === name);
    assert.ok(found, `missing winter piece: ${name}`);
  }
  // Swag carries evergreen tufts + berries + a brass bell (>= 10 meshes)
  const swag = winter.children.find((c) => c.name === 'winter_swag')!;
  assert.ok(swag.children.length >= 10, `swag dressing density: ${swag.children.length}`);

  // All winter pieces sit inside the bakery room volume (no leak through walls)
  const box = new THREE.Box3().setFromObject(winter);
  assert.ok(box.min.x >= -3.15 && box.max.x <= 3.15, `winter x span ${box.min.x.toFixed(2)}..${box.max.x.toFixed(2)}`);
  assert.ok(box.min.z >= -2.55 && box.max.z <= 2.55, `winter z span ${box.min.z.toFixed(2)}..${box.max.z.toFixed(2)}`);
  assert.ok(box.min.y >= 0.2 && box.max.y <= 4.3, `winter y span ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}`);

  // The counter runner hangs on the counter's customer face (x east of the counter top)
  const runner = winter.children.find((c) => c.name === 'winter_counter_runner')!;
  const runnerBox = new THREE.Box3().setFromObject(runner);
  assert.ok(runnerBox.min.x > -2.5 && runnerBox.max.x < -1.9, 'runner drapes on the counter front');

  rig.dispose();
  palette.disposeAll();
});

test('bakery seasonal floor pieces keep station walk-ups and the café seat clear', () => {
  const palette = new MaterialPalette();
  const rig = buildHearthCrumbInterior(palette, new THREE.Texture(), { isSoftwareGl: true });
  const base = createFreshWorldState();

  // Standard rule: floor-hugging pieces (box.min.y ≤ 0.25) keep 0.45u from every
  // interactable focus + the café seat; furniture-top / wall / beam pieces are exempt by height.
  const keepOuts: Array<[number, number]> = [
    ...BAKERY_INTERACTABLES.map((p) => [p.focusX, p.focusZ] as [number, number]),
    [0.73, 1.45], // bakery_seat_cafe_west world position
  ];
  for (const season of SEASONS) {
    rig.update(worldInSeason(base, season), 'morning', 1.0);
    for (const piece of rig.seasonLife[season].children) {
      const box = new THREE.Box3().setFromObject(piece);
      if (box.min.y > 0.25) continue;
      for (const [kx, kz] of keepOuts) {
        const dx = Math.max(box.min.x - kx, kx - box.max.x, 0);
        const dz = Math.max(box.min.z - kz, kz - box.max.z, 0);
        const dist = Math.hypot(dx, dz);
        assert.ok(dist > 0.45, `${season}/${piece.name} intrudes near (${kx}, ${kz}): ${dist.toFixed(2)}`);
      }
    }
  }

  rig.dispose();
  palette.disposeAll();
});

test('bakery season round-trip: dressing flips cleanly across a full year and spring jug/summer herbs/autumn garland exist', () => {
  const palette = new MaterialPalette();
  const rig = buildHearthCrumbInterior(palette, new THREE.Texture(), { isSoftwareGl: true });
  const base = createFreshWorldState();

  const expectedPiece = {
    spring: 'spring_sill_jug',
    summer: 'summer_sill_herbs',
    autumn: 'autumn_beam_garland',
    winter: 'winter_swag',
  } as const;
  for (const season of SEASONS) {
    rig.update(worldInSeason(base, season), 'morning', 1.0);
    const piece = rig.seasonLife[season].children.find((c) => c.name === expectedPiece[season]);
    assert.ok(piece, `missing ${season} signature piece: ${expectedPiece[season]}`);
  }

  // Full-year round trip: winter -> spring -> summer -> autumn -> winter, always exactly one on
  const year: SeasonType[] = ['winter', 'spring', 'summer', 'autumn', 'winter'];
  for (const season of year) {
    rig.update(worldInSeason(base, season), 'dusk', 2.0);
    const on = SEASONS.filter((s) => rig.seasonLife[s].visible);
    assert.deepEqual(on, [season], `exactly ${season} visible mid-round-trip`);
  }

  rig.dispose();
  palette.disposeAll();
});
