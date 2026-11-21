import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MaterialPalette } from './materials';

test('standard materials cache by identity: same args share one instance', () => {
  const palette = new MaterialPalette();
  const a = palette.standard('#865A3E', 0.74, 0.04);
  const b = palette.standard('#865A3E', 0.74, 0.04);
  assert.equal(a, b, 'identical specs must reuse the cached material');
  const c = palette.standard('#865A3E', 0.76, 0.04);
  assert.notEqual(a, c, 'different roughness must not collide');
  palette.disposeAll();
});

test('map sets and envMapIntensity extend the cache key without colliding', () => {
  const palette = new MaterialPalette();
  const plain = palette.standard('#6B4834', 0.78, 0.04);
  const timber = palette.standard('#6B4834', 0.78, 0.04, { mapSet: 'timber-dark' });
  const brass = palette.standard('#D7A041', 0.24, 0.85, { envMapIntensity: 1.0 });
  assert.notEqual(plain, timber, 'mapSet must fork the cache entry');
  assert.equal(brass.envMapIntensity, 1.0, 'envMapIntensity becomes a first-class field');
  const brassAgain = palette.standard('#D7A041', 0.24, 0.85, { envMapIntensity: 1.0 });
  assert.equal(brass, brassAgain, 'identical opts reuse the cache');
  palette.disposeAll();
});

test('procedural map families are unavailable in pure Node (renderer-side concern)', () => {
  const palette = new MaterialPalette();
  // No DOM in the test runner: the bundle must be null, not a crash, so every
  // geometry/identity suite can construct rigs with plain materials.
  assert.equal(palette.mapBundle('timber-light'), null);
  assert.equal(palette.mapBundle('plaster'), null);
  assert.equal(palette.mapBundle('stone'), null);
  assert.equal(palette.mapBundle('fabric'), null);
  // And the fallback is cached (idempotent within one palette lifetime)
  assert.equal(palette.mapBundle('fabric'), null);
  palette.disposeAll();
});

test('textured materials keep their scalar identity fields untouched', () => {
  const palette = new MaterialPalette();
  const wall = palette.standard('#E1DFD5', 0.85, 0.01, { mapSet: 'plaster' });
  assert.equal(wall.color.getHexString(), 'e1dfd5');
  assert.equal(wall.roughness, 0.85);
  assert.equal(wall.metalness, 0.01);
  palette.disposeAll();
});
