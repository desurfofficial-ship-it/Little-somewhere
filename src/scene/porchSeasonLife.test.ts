import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MaterialPalette } from './materials';
import {
  PorchSeasonLife,
  applyPorchSeason,
  readPorchSeasonLife,
} from './builders/porchSeasonLife';
import { buildHearthCrumbPorchDressing } from './builders/bakeryInterior';
import { buildLindenBookNookPorchDressing } from './builders/bookNookInterior';
import { SeasonType } from '../game/types';

/**
 * Pass 26 "Doorways of the Lane": the bakery & book nook porch dressings keep
 * the seasons the way the Willow Step Cottage porch does (R5 Pass 18).
 * Contract: four hidden named season groups per porch, exactly one visible per
 * season via the shared `applyPorchSeason` gate, all pieces inside each
 * dressing's existing footprint (never entering the lane walk band), and the
 * existing dispose path untouched. Copperwheel's porch is Arthur's content and
 * is intentionally absent from this system.
 */

const SEASONS: SeasonType[] = ['spring', 'summer', 'autumn', 'winter'];

function findNamed(root: THREE.Object3D, name: string): THREE.Object3D | undefined {
  if (root.name === name) return root;
  for (const child of root.children) {
    const hit = findNamed(child, name);
    if (hit) return hit;
  }
  return undefined;
}

function assertOneSeasonVisible(life: PorchSeasonLife, season: SeasonType, label: string): void {
  assert.equal(life.spring.visible, season === 'spring', `${label} spring gate in ${season}`);
  assert.equal(life.summer.visible, season === 'summer', `${label} summer gate in ${season}`);
  assert.equal(life.autumn.visible, season === 'autumn', `${label} autumn gate in ${season}`);
  assert.equal(life.winter.visible, season === 'winter', `${label} winter gate in ${season}`);
}

test('bakery porch keeps the seasons — one variant at a time, hidden by default', () => {
  const palette = new MaterialPalette();
  const dressing = buildHearthCrumbPorchDressing(palette, new THREE.Texture());
  const life = readPorchSeasonLife(dressing);
  assert.ok(life, 'bakery porch exposes its season life rig');
  assert.equal(life!.spring.name, 'hearth_crumb_porch_spring');
  assert.equal(life!.summer.name, 'hearth_crumb_porch_summer');
  assert.equal(life!.autumn.name, 'hearth_crumb_porch_autumn');
  assert.equal(life!.winter.name, 'hearth_crumb_porch_winter');
  assert.ok(
    !life!.spring.visible && !life!.summer.visible && !life!.autumn.visible && !life!.winter.visible,
    'all season groups build hidden',
  );
  for (const season of SEASONS) {
    applyPorchSeason(life!, season);
    assertOneSeasonVisible(life!, season, 'bakery');
  }
  const disposeSpy = dressing.userData.dispose as () => void;
  disposeSpy();
  palette.disposeAll();
});

test('bakery porch winter carries its signature pieces; summer carries bake-day herbs', () => {
  const palette = new MaterialPalette();
  const dressing = buildHearthCrumbPorchDressing(palette, new THREE.Texture());
  const life = readPorchSeasonLife(dressing)!;
  assert.ok(findNamed(life.winter, 'bakery_porch_winter_frost_strip'), 'winter frost strip on the step');
  assert.ok(findNamed(life.winter, 'bakery_porch_winter_crate_snow'), 'winter snow cap on the delivery crate');
  assert.ok(findNamed(life.winter, 'bakery_porch_winter_evergreen_bundle'), 'winter evergreen bundle on the bracket');
  assert.ok(findNamed(life.winter, 'bakery_porch_winter_berry_0'), 'winter berries on the bundle');
  assert.ok(findNamed(life.winter, 'bakery_porch_winter_knit_muffler'), 'winter knit muffler on the crate');
  assert.ok(findNamed(life.spring, 'bakery_porch_spring_swag'), 'spring blossom swag under the bracket');
  assert.ok(findNamed(life.spring, 'bakery_porch_spring_pot_0'), 'spring herb pot');
  assert.ok(findNamed(life.summer, 'bakery_porch_summer_tomato_pot'), 'summer tomato pot');
  assert.ok(findNamed(life.summer, 'bakery_porch_summer_watering_can'), 'summer watering can');
  assert.ok(findNamed(life.autumn, 'bakery_porch_autumn_pumpkin'), 'autumn bake-day pumpkin');
  assert.ok(findNamed(life.autumn, 'bakery_porch_autumn_herb_string'), 'autumn dried-herb string');
  palette.disposeAll();
});

test('book nook porch keeps the seasons — one variant at a time, signature pieces named', () => {
  const palette = new MaterialPalette();
  const dressing = buildLindenBookNookPorchDressing(palette, new THREE.Texture());
  const life = readPorchSeasonLife(dressing);
  assert.ok(life, 'nook porch exposes its season life rig');
  assert.equal(life!.spring.name, 'linden_nook_porch_spring');
  for (const season of SEASONS) {
    applyPorchSeason(life!, season);
    assertOneSeasonVisible(life!, season, 'nook');
  }
  assert.ok(findNamed(life!.spring, 'nook_porch_spring_bud_vase'), 'spring bud vase');
  assert.ok(findNamed(life!.summer, 'nook_porch_summer_fern_pot'), 'summer fern pot');
  assert.ok(findNamed(life!.summer, 'nook_porch_summer_reading_cushion'), 'summer reading cushion');
  assert.ok(findNamed(life!.autumn, 'nook_porch_autumn_pumpkin_bookend'), 'autumn pumpkin bookend');
  assert.ok(findNamed(life!.winter, 'nook_porch_winter_frost_fern_0'), 'winter frost fern');
  assert.ok(findNamed(life!.winter, 'nook_porch_winter_book_snow'), 'winter snow cap on the returned books');
  assert.ok(findNamed(life!.winter, 'nook_porch_winter_evergreen_sprig'), 'winter evergreen sprig on the bracket');
  assert.ok(findNamed(life!.winter, 'nook_porch_winter_sprig_berry_0'), 'winter berries on the sprig');
  assert.ok(findNamed(life!.winter, 'nook_porch_winter_knit_scarf'), 'winter knit scarf on the step');
  const disposeSpy = dressing.userData.dispose as () => void;
  disposeSpy();
  palette.disposeAll();
});

test('seasonal porch pieces stay inside the dressing footprints — never entering the lane', () => {
  const palette = new MaterialPalette();
  // Bakery porch: local envelope |x| <= 1.2, z in [-0.15, 1.05], y <= 2.3.
  const bakery = buildHearthCrumbPorchDressing(palette, new THREE.Texture());
  const bakeryLife = readPorchSeasonLife(bakery)!;
  for (const season of SEASONS) {
    bakeryLife[season].updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(bakeryLife[season]);
    assert.ok(box.max.x <= 1.2 && box.min.x >= -1.2, `bakery ${season} x envelope ${box.min.x.toFixed(2)}..${box.max.x.toFixed(2)}`);
    assert.ok(box.min.z >= -0.15 && box.max.z <= 1.05, `bakery ${season} z envelope ${box.min.z.toFixed(2)}..${box.max.z.toFixed(2)}`);
    assert.ok(box.min.y >= -0.02 && box.max.y <= 2.3, `bakery ${season} y bounds ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}`);
  }
  // Nook porch (local frame before the canvas' east-facing rotation):
  // x in [0, 1.05], |z| <= 1.0, y <= 2.3.
  const nook = buildLindenBookNookPorchDressing(palette, new THREE.Texture());
  const nookLife = readPorchSeasonLife(nook)!;
  for (const season of SEASONS) {
    nookLife[season].updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(nookLife[season]);
    assert.ok(box.min.x >= -0.02 && box.max.x <= 1.05, `nook ${season} x envelope ${box.min.x.toFixed(2)}..${box.max.x.toFixed(2)}`);
    assert.ok(box.min.z >= -1.0 && box.max.z <= 1.0, `nook ${season} z envelope ${box.min.z.toFixed(2)}..${box.max.z.toFixed(2)}`);
    assert.ok(box.min.y >= -0.02 && box.max.y <= 2.3, `nook ${season} y bounds ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}`);
  }
  palette.disposeAll();
});

test('applyPorchSeason is deterministic — repeated application is idempotent and full-year round-trips restore', () => {
  const palette = new MaterialPalette();
  const dressing = buildHearthCrumbPorchDressing(palette, new THREE.Texture());
  const life = readPorchSeasonLife(dressing)!;
  applyPorchSeason(life, 'winter');
  const snapshot = [life.spring.visible, life.summer.visible, life.autumn.visible, life.winter.visible];
  applyPorchSeason(life, 'winter');
  assert.deepEqual(
    [life.spring.visible, life.summer.visible, life.autumn.visible, life.winter.visible],
    snapshot,
    'same season applied twice leaves identical state',
  );
  // Full-year round trip.
  applyPorchSeason(life, 'spring');
  applyPorchSeason(life, 'summer');
  applyPorchSeason(life, 'autumn');
  applyPorchSeason(life, 'winter');
  assert.ok(life.winter.visible && !life.spring.visible, 'round trip lands back on winter alone');
  palette.disposeAll();
});
