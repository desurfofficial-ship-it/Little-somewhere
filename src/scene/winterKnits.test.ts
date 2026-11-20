import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  applyCharacterWinterTint,
  buildStorybookCharacter,
  buildWinterKnitCollar,
  computeWinterKnitTint,
} from './builders/characters';
import { buildStorybookJun } from './prototypes/willowLaneDiorama';
import { MaterialPalette } from './materials';
import { RESIDENTS } from '../game/residents';
import type { SeasonType } from '../game/types';

const PLAYER_APPEARANCE = {
  coatColor: '#D46E51',
  shirtColor: '#FAF4E8',
  hairColor: '#433027',
  skinColor: '#F0C5A7',
  accentColor: '#6E9A74',
  hatStyle: 'beret' as const,
  propType: 'none' as const,
  heightScale: 1.0,
};

function buildPlayer() {
  const palette = new MaterialPalette();
  const dummyTex = new THREE.Texture();
  return buildStorybookCharacter(PLAYER_APPEARANCE, palette, dummyTex, 'player');
}

function hexDistance(a: string, b: string): number {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const dr = ((pa >> 16) & 255) - ((pb >> 16) & 255);
  const dg = ((pa >> 8) & 255) - ((pb >> 8) & 255);
  const db = (pa & 255) - (pb & 255);
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

test('winter tint visibly shifts every knit color while keeping its identity', () => {
  const bases = Object.values(RESIDENTS).map((r) => r.appearance.coatColor);
  bases.push(PLAYER_APPEARANCE.coatColor, PLAYER_APPEARANCE.accentColor);
  const tints = bases.map((c) => computeWinterKnitTint(c));
  // Clearly visible change on every yarn color (not a subtle nudge)
  for (let i = 0; i < bases.length; i++) {
    assert.ok(
      hexDistance(bases[i], tints[i]) > 14,
      `${bases[i]} winter tint must be visibly distinct, got ${tints[i]}`,
    );
  }
  // Distinct bases stay distinct in winter (color identities never merge)
  assert.equal(new Set(tints).size, bases.length);
  // Deterministic
  for (let i = 0; i < bases.length; i++) {
    assert.equal(computeWinterKnitTint(bases[i]), tints[i]);
  }
  // Winter knits are deeper, not washed out (no channel blows toward white)
  for (let i = 0; i < bases.length; i++) {
    const pb = parseInt(bases[i].slice(1), 16);
    const pt = parseInt(tints[i].slice(1), 16);
    const lumB = 0.2126 * ((pb >> 16) & 255) + 0.7152 * ((pb >> 8) & 255) + 0.0722 * (pb & 255);
    const lumT = 0.2126 * ((pt >> 16) & 255) + 0.7152 * ((pt >> 8) & 255) + 0.0722 * (pt & 255);
    assert.ok(lumT < lumB, `${bases[i]} must darken in winter`);
  }
});

test('every character rig ships the winter knit kit (coat clone, collar, base colors)', () => {
  const palette = new MaterialPalette();
  const dummyTex = new THREE.Texture();
  for (const id of Object.keys(RESIDENTS) as Array<keyof typeof RESIDENTS>) {
    const rig =
      id === 'jun'
        ? buildStorybookJun(RESIDENTS[id].appearance, palette, dummyTex)
        : buildStorybookCharacter(RESIDENTS[id].appearance, palette, dummyTex, id);
    assert.ok(rig.knitMaterials && rig.knitMaterials.length >= 2, `${id} knit materials missing`);
    assert.ok(rig.knitBaseColors && rig.knitBaseColors.length >= 2, `${id} knit base colors missing`);
    assert.equal(rig.knitBaseColors[0], RESIDENTS[id].appearance.coatColor);
    assert.ok(rig.winterKnitCollar, `${id} winter collar missing`);
    assert.equal(rig.winterKnitCollar!.visible, false, `${id} collar must hide outside winter`);
  }
});

test('winter application shifts knit materials and shows the collar; spring restores exactly', () => {
  const rig = buildPlayer();
  const coatMat = rig.knitMaterials![0];
  const base = rig.knitBaseColors![0];

  applyCharacterWinterTint(rig, 'winter' as SeasonType);
  const winterHex = '#' + coatMat.color.getHexString();
  assert.ok(
    hexDistance(winterHex, computeWinterKnitTint(base)) <= 2,
    'winter coat matches the tint recipe (±1 color-space rounding)',
  );
  assert.ok(hexDistance(base, winterHex) > 14, 'winter coat color must be visibly distinct');
  assert.equal(rig.winterKnitCollar!.visible, true, 'winter collar appears in winter');

  applyCharacterWinterTint(rig, 'spring' as SeasonType);
  assert.ok(
    hexDistance('#' + coatMat.color.getHexString(), base) <= 2,
    'authoring coat color restored (±1 rounding from sRGB↔linear is imperceptible)',
  );
  assert.equal(rig.winterKnitCollar!.visible, false, 'collar hides outside winter');

  // All other seasons restore too (summer/autumn/winter/spring round-trip)
  for (const season of ['summer', 'autumn', 'winter', 'spring'] as SeasonType[]) {
    applyCharacterWinterTint(rig, season);
    if (season !== 'winter') {
      assert.ok(hexDistance('#' + coatMat.color.getHexString(), base) <= 2);
      assert.equal(rig.winterKnitCollar!.visible, false);
    }
  }
});

test('knit materials are per-rig clones — the shared palette cache is never mutated', () => {
  const palette = new MaterialPalette();
  const dummyTex = new THREE.Texture();
  const appearanceA = { ...PLAYER_APPEARANCE };
  const rigA = buildStorybookCharacter(appearanceA, palette, dummyTex, 'player');
  const rigB = buildStorybookCharacter(appearanceA, palette, dummyTex, 'player');

  const cacheCoatMat = palette.standard(appearanceA.coatColor, 0.78, 0.02);
  const cacheAccentMat = palette.standard(appearanceA.accentColor, 0.74, 0.04);

  applyCharacterWinterTint(rigA, 'winter' as SeasonType);
  // Rig A's clone shifted...
  const aCoat = '#' + rigA.knitMaterials![0].color.getHexString();
  assert.ok(hexDistance(aCoat, computeWinterKnitTint(appearanceA.coatColor)) <= 2);
  // ...the shared cache entry is untouched...
  assert.ok(hexDistance('#' + cacheCoatMat.color.getHexString(), appearanceA.coatColor) <= 2);
  assert.ok(hexDistance('#' + cacheAccentMat.color.getHexString(), appearanceA.accentColor) <= 2);
  // ...and rig B (built from the same cache) still wears the authoring color.
  assert.ok(hexDistance('#' + rigB.knitMaterials![0].color.getHexString(), appearanceA.coatColor) <= 2);
});

test('winter collar builds hidden, named, and tinted from the coat yarn', () => {
  const palette = new MaterialPalette();
  const { group, material } = buildWinterKnitCollar(palette, PLAYER_APPEARANCE);
  assert.equal(group.name, 'winter_knit_collar');
  assert.equal(group.visible, false);
  assert.ok(
    hexDistance('#' + material.color.getHexString(), PLAYER_APPEARANCE.coatColor) <= 2,
    'collar yarn matches the coat color (±1 color-space rounding)',
  );
  const meshes: THREE.Mesh[] = [];
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) meshes.push(o);
  });
  assert.ok(meshes.length >= 2, 'collar has a wrap + tail');
  for (const m of meshes) {
    assert.equal(m.material, material, 'collar pieces share one tintable yarn material');
  }
});
