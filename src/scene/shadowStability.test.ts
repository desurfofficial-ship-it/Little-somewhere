import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { snapLightPositionToShadowTexels, snapDirectionalLightToShadowTexels } from './shadowStability';

const TEXEL = 56 / 1024; // the authored sun shadow camera: ortho ±28 over a 1024² map

function lightBasis(position: THREE.Vector3, target: THREE.Vector3) {
  const z = new THREE.Vector3().subVectors(position, target).normalize();
  const x = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  return { x, y, z };
}

test('shadow snap: light-space X/Y offsets land exactly on the texel grid', () => {
  const target = new THREE.Vector3(0, 0, 0);
  // A sweep of sun positions across the authored day arc.
  for (let a = 0.42; a <= 2.6; a += 0.07) {
    for (const h of [10, 14, 18, 24]) {
      const p = new THREE.Vector3(Math.cos(a) * 26, h, 16);
      snapLightPositionToShadowTexels(p, target, TEXEL, TEXEL);
      const { x, y } = lightBasis(p, target);
      const relX = new THREE.Vector3().subVectors(p, target).dot(x);
      const relY = new THREE.Vector3().subVectors(p, target).dot(y);
      const cellsX = relX / TEXEL;
      const cellsY = relY / TEXEL;
      assert.ok(
        Math.abs(cellsX - Math.round(cellsX)) < 1e-6,
        `azimuth ${a} h ${h}: relX ${relX} = ${cellsX} texels (must be integer)`,
      );
      assert.ok(
        Math.abs(cellsY - Math.round(cellsY)) < 1e-6,
        `azimuth ${a} h ${h}: relY ${relY} = ${cellsY} texels (must be integer)`,
      );
    }
  }
});

test('shadow snap: preserves the light-target distance (stable shadow near/far semantics)', () => {
  const target = new THREE.Vector3(0, 0, 0);
  const p = new THREE.Vector3(18, 16, 16);
  const distBefore = p.distanceTo(target);
  snapLightPositionToShadowTexels(p, target, TEXEL, TEXEL);
  assert.ok(Math.abs(p.distanceTo(target) - distBefore) < 1e-6);
});

test('shadow snap: displacement is bounded by ~one texel per axis', () => {
  const target = new THREE.Vector3(0, 0, 0);
  const p0 = new THREE.Vector3(Math.cos(0.9) * 26, 20, 16);
  const before = p0.clone();
  snapLightPositionToShadowTexels(p0, target, TEXEL, TEXEL);
  const delta = p0.clone().sub(before);
  const { x, y } = lightBasis(before, target);
  const dX = Math.abs(delta.dot(x));
  const dY = Math.abs(delta.dot(y));
  assert.ok(dX <= TEXEL / 2 + 1e-9, `|ΔalongX| ${dX} > texel/2 ${TEXEL / 2}`);
  assert.ok(dY <= TEXEL / 2 + 1e-9, `|ΔalongY| ${dY} > texel/2 ${TEXEL / 2}`);
});

test('shadow snap: non-zero target works (frustum center is target-relative)', () => {
  const target = new THREE.Vector3(3, 0, -2);
  const p = new THREE.Vector3(21, 18, 14);
  snapLightPositionToShadowTexels(p, target, TEXEL, TEXEL);
  const { x, y } = lightBasis(p, target);
  const relX = new THREE.Vector3().subVectors(p, target).dot(x);
  const relY = new THREE.Vector3().subVectors(p, target).dot(y);
  assert.ok(Math.abs(relX / TEXEL - Math.round(relX / TEXEL)) < 1e-6);
  assert.ok(Math.abs(relY / TEXEL - Math.round(relY / TEXEL)) < 1e-6);
});

test('shadow snap: degenerate straight-overhead direction is a safe no-op', () => {
  const target = new THREE.Vector3(0, 0, 0);
  const p = new THREE.Vector3(0, 26, 0);
  const before = p.clone();
  snapLightPositionToShadowTexels(p, target, TEXEL, TEXEL);
  assert.deepEqual(p.toArray(), before.toArray());
});

test('directional light wrapper: derives the texel from its own shadow camera', () => {
  const light = new THREE.DirectionalLight('#ffffff', 1);
  light.shadow.mapSize.set(1024, 1024);
  const d = 28;
  light.shadow.camera.left = -d;
  light.shadow.camera.right = d;
  light.shadow.camera.top = d;
  light.shadow.camera.bottom = -d;
  light.position.set(15, 22, 12);
  snapDirectionalLightToShadowTexels(light);
  const { x, y } = lightBasis(light.position, light.target.position);
  const relX = new THREE.Vector3().subVectors(light.position, light.target.position).dot(x);
  const relY = new THREE.Vector3().subVectors(light.position, light.target.position).dot(y);
  assert.ok(Math.abs(relX / TEXEL - Math.round(relX / TEXEL)) < 1e-6);
  assert.ok(Math.abs(relY / TEXEL - Math.round(relY / TEXEL)) < 1e-6);
});
