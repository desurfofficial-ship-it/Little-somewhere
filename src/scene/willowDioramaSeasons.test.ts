import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MaterialPalette } from './materials';
import {
  buildWillowLaneCourtyardProps,
  buildWillowStepCottage,
  updateWillowPrototypeMotion,
  WillowCourtyardRig,
} from './prototypes/willowLaneDiorama';
import { SeasonType } from '../game/types';

/**
 * R5 Pass 18: the porch keeps the seasons. Contract: the seasonal porch
 * dressing rotates with world.season via updateWillowPrototypeMotion —
 * exactly one pot variant, matching step tufts, wreath accent color, winter
 * rail frost and window-box overlays. Visual-only: the planter-bloom groups
 * that carry plantersBloomed progress (flowerGroups) are never toggled here.
 */

function buildRig() {
  const palette = new MaterialPalette();
  const ctx = {
    palette,
    shadowTex: new THREE.Texture(),
    terracottaRoofTex: new THREE.Texture(),
    windowMaterials: [] as THREE.MeshStandardMaterial[],
    lanternMaterials: [] as THREE.MeshStandardMaterial[],
    flowerGroups: [] as THREE.Group[],
  };
  const cottage = buildWillowStepCottage(ctx);
  const courtyard = buildWillowLaneCourtyardProps(ctx);
  return { palette, cottage, courtyard: courtyard as WillowCourtyardRig, flowerGroups: ctx.flowerGroups };
}

const SEASONS: SeasonType[] = ['spring', 'summer', 'autumn', 'winter'];

test('R5 Pass 18: the porch pot rotates with the season — one variant at a time', () => {
  const { palette, cottage, courtyard } = buildRig();
  const life = cottage.porchSeasonLife;
  for (const season of SEASONS) {
    updateWillowPrototypeMotion(cottage, courtyard, 0, 1, season);
    assert.equal(life.potsSpring.visible, season === 'spring', `spring pot in ${season}`);
    assert.equal(life.potsSummer.visible, season === 'summer', `summer pot in ${season}`);
    assert.equal(life.potsAutumn.visible, season === 'autumn', `autumn pot in ${season}`);
    assert.equal(life.potsWinter.visible, season === 'winter', `winter pot in ${season}`);
  }
  rigBounds(cottage);
  palette.disposeAll();
});

test('R5 Pass 18: step tufts follow the season; winter owns rail frost', () => {
  const { palette, cottage, courtyard } = buildRig();
  const life = cottage.porchSeasonLife;
  for (const season of SEASONS) {
    updateWillowPrototypeMotion(cottage, courtyard, 0, 1, season);
    assert.equal(life.stepTuftsSpring.visible, season === 'spring');
    assert.equal(life.stepTuftsSummer.visible, season === 'summer');
    assert.equal(life.stepTuftsAutumn.visible, season === 'autumn');
    assert.equal(life.winterRailFrost.visible, season === 'winter', `rail frost only in winter (got ${season})`);
  }
  rigBounds(cottage);
  palette.disposeAll();
});

test('R5 Pass 18: wreath accent swaps with the season, matching the interior swag palette', () => {
  const { palette, cottage, courtyard } = buildRig();
  const life = cottage.porchSeasonLife;
  const seen = new Set<string>();
  for (const season of SEASONS) {
    updateWillowPrototypeMotion(cottage, courtyard, 0, 1, season);
    const hex = life.wreathAccentMat.color.getHexString();
    seen.add(hex);
    const expected = { spring: 'f7efd8', summer: 'b9a3d6', autumn: 'd97f3e', winter: 'd9b36a' }[season];
    assert.equal(hex, expected, `wreath accent for ${season}`);
  }
  assert.equal(seen.size, 4, 'all four seasons read a distinct accent');
  palette.disposeAll();
});

test('R5 Pass 18: window-box overlays gate per season without touching planter-progress blooms', () => {
  const { palette, cottage, courtyard, flowerGroups } = buildRig();
  const life = cottage.porchSeasonLife;
  assert.equal(life.boxAutumnOverlays.length, 3, 'three flower boxes carry autumn overlays');
  assert.equal(life.boxWinterOverlays.length, 3, 'three flower boxes carry winter overlays');
  assert.equal(flowerGroups.length, 3, 'planter bloom groups are untouched by the overlay work');
  updateWillowPrototypeMotion(cottage, courtyard, 0, 1, 'autumn');
  assert.ok(life.boxAutumnOverlays.every((o) => o.visible), 'autumn overlays visible in autumn');
  assert.ok(life.boxWinterOverlays.every((o) => !o.visible), 'winter overlays hidden in autumn');
  updateWillowPrototypeMotion(cottage, courtyard, 0, 1, 'winter');
  assert.ok(life.boxAutumnOverlays.every((o) => !o.visible), 'autumn overlays hidden in winter');
  assert.ok(life.boxWinterOverlays.every((o) => o.visible), 'winter overlays visible in winter');
  updateWillowPrototypeMotion(cottage, courtyard, 0, 1, 'summer');
  assert.ok(
    life.boxAutumnOverlays.every((o) => !o.visible) && life.boxWinterOverlays.every((o) => !o.visible),
    'summer shows bare boxes (planter blooms only)',
  );
  palette.disposeAll();
});

test('R5 Pass 18: cold-hearth chimney truth still holds alongside the seasonal gate', () => {
  const { palette, cottage, courtyard } = buildRig();
  updateWillowPrototypeMotion(cottage, courtyard, 1.2, 0, 'winter');
  assert.ok(cottage.smokePuffs.every((p) => !p.visible), 'cold hearth: no smoke even in winter');
  updateWillowPrototypeMotion(cottage, courtyard, 1.2, 1, 'winter');
  assert.ok(cottage.smokePuffs.every((p) => p.visible), 'lit hearth smokes');
  rigBounds(cottage);
  palette.disposeAll();
});

function rigBounds(cottage: { group: THREE.Group }): void {
  cottage.group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(cottage.group);
  assert.ok(box.max.y <= 7.5, `cottage envelope stays sane (max y ${box.max.y.toFixed(2)})`);
}
