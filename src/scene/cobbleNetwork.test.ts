import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildCobbleNetworkGeometry } from './builders/cobbleNetwork';
import {
  COBBLE_RECTS,
  COBBLE_SURFACE_HEIGHT,
  COBBLE_SKIRT_DEPTH,
  COBBLE_TEX_REPEATS_PER_UNIT,
} from '../game/groundSurfaces';

/** Extracts (top, bottom) triangle sets from the merged geometry. */
function triangleSets(geometry: THREE.BufferGeometry) {
  const pos = geometry.getAttribute('position');
  const nor = geometry.getAttribute('normal');
  const index = geometry.getIndex();
  const tops: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3]> = [];
  const skirts: Array<[THREE.Vector3, THREE.Vector3, THREE.Vector3]> = [];
  const count = index ? index.count : pos.count;
  const v = (i: number) => new THREE.Vector3().fromBufferAttribute(pos, i);
  for (let t = 0; t < count; t += 3) {
    const i0 = index ? index.getX(t) : t;
    const i1 = index ? index.getX(t + 1) : t + 1;
    const i2 = index ? index.getX(t + 2) : t + 2;
    const a = v(i0);
    const b = v(i1);
    const c = v(i2);
    if (nor.getY(i0) > 0.9) tops.push([a, b, c]);
    else skirts.push([a, b, c]);
  }
  return { tops, skirts };
}

function pointInTriangle2D(px: number, pz: number, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): boolean {
  const d1 = (px - b.x) * (a.z - b.z) - (a.x - b.x) * (pz - b.z);
  const d2 = (px - c.x) * (b.z - c.z) - (b.x - c.x) * (pz - c.z);
  const d3 = (px - a.x) * (c.z - a.z) - (c.x - a.x) * (pz - a.z);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

test('cobble network: one and only one top fragment per covered point (no coplanar pairs)', () => {
  // THE flicker invariant: the old 8-box layout rasterized 2-3 coplanar top faces per
  // pixel in every lane crossing. The union must yield EXACTLY ONE top triangle over
  // any point of the network (cell-boundary lines excluded: a point exactly on a
  // shared edge belongs to both adjacent triangles' closed sets — legal adjacency,
  // NOT overlap; rasterization fills each pixel once).
  const { geometry } = buildCobbleNetworkGeometry();
  const { tops } = triangleSets(geometry);
  assert.ok(tops.length > 0);

  const xsCuts = new Set<number>();
  const zsCuts = new Set<number>();
  for (const r of COBBLE_RECTS) {
    xsCuts.add(r.x - r.halfW);
    xsCuts.add(r.x + r.halfW);
    zsCuts.add(r.z - r.halfL);
    zsCuts.add(r.z + r.halfL);
  }
  const onCut = (v: number, cuts: Set<number>) => {
    for (const c of cuts) if (Math.abs(v - c) < 1e-6) return true;
    return false;
  };

  let samples = 0;
  for (let x = -12.5; x <= 12.5; x += 0.35) {
    for (let z = -13.5; z <= 13.5; z += 0.35) {
      const onEdge = onCut(x, xsCuts) || onCut(z, zsCuts);
      let cover = 0;
      if (!onEdge) {
        for (const [a, b, c] of tops) {
          if (pointInTriangle2D(x, z, a, b, c)) cover++;
        }
      }
      const PAD = 1e-9;
      const inAnyRect = COBBLE_RECTS.some(
        (r) =>
          Math.abs(x - r.x) <= r.halfW + PAD && Math.abs(z - r.z) <= r.halfL + PAD,
      );
      if (onEdge) continue; // shared-edge membership is legal, counted elsewhere
      if (inAnyRect) {
        assert.equal(cover, 1, `point (${x}, ${z}) covered ${cover}× — must be exactly 1`);
        samples++;
      } else if (cover > 0) {
        // Outside every rect the union must be empty (geometry coverage is exact).
        assert.fail(`point (${x}, ${z}) outside all rects but geometry covers it ${cover}×`);
      }
    }
  }
  assert.ok(samples > 200, `expected hundreds of covered samples, got ${samples}`);
});

test('cobble network: top face sits exactly at the slab height, skirts reach the old burial depth', () => {
  const { geometry } = buildCobbleNetworkGeometry();
  const pos = geometry.getAttribute('position');
  const nor = geometry.getAttribute('normal');
  // BufferAttribute stores Float32 — compare with a float32-appropriate epsilon.
  const EPS = 1e-6;
  let topVerts = 0;
  let skirtTopVerts = 0;
  let skirtBottomVerts = 0;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (nor.getY(i) > 0.9) {
      assert.ok(Math.abs(y - COBBLE_SURFACE_HEIGHT) < EPS, `top vertex ${i} y=${y}`);
      topVerts++;
    } else {
      assert.equal(Math.abs(nor.getY(i)), 0, `skirt vertex ${i} must be horizontal-normal`);
      if (Math.abs(y - COBBLE_SURFACE_HEIGHT) < EPS) skirtTopVerts++;
      else if (Math.abs(y - (COBBLE_SURFACE_HEIGHT - COBBLE_SKIRT_DEPTH)) < EPS) skirtBottomVerts++;
      else assert.fail(`skirt vertex ${i} at unexpected y=${y}`);
    }
  }
  assert.ok(topVerts >= 4, 'at least one top quad');
  assert.ok(skirtTopVerts > 0 && skirtBottomVerts > 0, 'skirt walls exist top and bottom');
});

test('cobble network: world-aligned UVs preserve the authored plaza density', () => {
  const { geometry } = buildCobbleNetworkGeometry();
  const pos = geometry.getAttribute('position');
  const nor = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  const k = COBBLE_TEX_REPEATS_PER_UNIT;
  const EPS = 1e-6;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (nor.getY(i) > 0.9) {
      // Top faces: uv is the world-aligned coordinate itself.
      assert.ok(Math.abs(uv.getX(i) - x * k) < EPS, `vertex ${i} u ${uv.getX(i)} != x*k ${x * k}`);
      assert.ok(Math.abs(uv.getY(i) - z * k) < EPS, `vertex ${i} v ${uv.getY(i)} != z*k ${z * k}`);
    } else if (Math.abs(nor.getX(i)) === 1) {
      // ±X skirts: u runs along the edge (z), v runs along the height (y).
      assert.ok(Math.abs(uv.getX(i) - z * k) < EPS, `skirt ${i} u ${uv.getX(i)} != z*k ${z * k}`);
      assert.ok(Math.abs(uv.getY(i) - y * k) < EPS, `skirt ${i} v ${uv.getY(i)} != y*k ${y * k}`);
    } else {
      // ±Z skirts: u runs along the edge (x), v runs along the height (y).
      assert.ok(Math.abs(nor.getZ(i)) === 1, `vertex ${i} unexpected normal`);
      assert.ok(Math.abs(uv.getX(i) - x * k) < EPS, `skirt ${i} u ${uv.getX(i)} != x*k ${x * k}`);
      assert.ok(Math.abs(uv.getY(i) - y * k) < EPS, `skirt ${i} v ${uv.getY(i)} != y*k ${y * k}`);
    }
  }
});

test('cobble network: stats are consistent and the surface is one small draw call', () => {
  const { geometry, stats } = buildCobbleNetworkGeometry();
  const pos = geometry.getAttribute('position');
  const index = geometry.getIndex()!;
  assert.equal(stats.vertices, pos.count);
  assert.equal(stats.triangles, index.count / 3);
  // Union of 8 rects is bounded: far below the old 8 boxes × 6 faces (288 tris) once
  // duplicated overlaps are gone; generous ceiling keeps the test about the contract,
  // not the exact count.
  assert.ok(stats.triangles > 0 && stats.triangles < 600, `triangles=${stats.triangles}`);
  assert.ok(stats.topQuads > 0 && stats.skirtQuads > 0);
});

test('cobble network: deterministic build (same rects → same geometry)', () => {
  const a = buildCobbleNetworkGeometry();
  const b = buildCobbleNetworkGeometry();
  const pa = a.geometry.getAttribute('position').array;
  const pb = b.geometry.getAttribute('position').array;
  assert.equal(pa.length, pb.length);
  for (let i = 0; i < pa.length; i++) assert.equal(pa[i], pb[i], `pos[${i}]`);
  assert.equal(a.stats.topQuads, b.stats.topQuads);
  assert.equal(a.stats.skirtQuads, b.stats.skirtQuads);
});

test('cobble network: normals are unit axis vectors only (clean shading, no mixed normals)', () => {
  const { geometry } = buildCobbleNetworkGeometry();
  const nor = geometry.getAttribute('normal');
  for (let i = 0; i < nor.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    const isAxis = (ax === 1 && ay === 0 && az === 0) || (ay === 1 && ax === 0 && az === 0) || (az === 1 && ax === 0 && ay === 0);
    assert.ok(isAxis, `vertex ${i} normal (${nor.getX(i)}, ${nor.getY(i)}, ${nor.getZ(i)})`);
  }
});

test('cobble network: the narrowest sliver cell (east lane ∩ plaza 0.05u band) is single-cover', () => {
  // Adversarial-review finding 6: the 0.35 sampling grid skipped the 0.05-wide cell
  // between the plaza east edge (6.25) and the east lane west edge (6.2). Sample its
  // interior explicitly.
  const { geometry } = buildCobbleNetworkGeometry();
  const { tops } = triangleSets(geometry);
  for (const [x, z] of [
    [6.22, -3.0], [6.22, 0.5], [6.22, 4.25], // inside the sliver (east lane ∪ plaza)
    [6.23, -6.5], [6.24, 6.0],
  ] as const) {
    let cover = 0;
    for (const [a, b, c] of tops) {
      if (pointInTriangle2D(x, z, a, b, c)) cover++;
    }
    assert.equal(cover, 1, `sliver point (${x}, ${z}) covered ${cover}× — must be exactly 1`);
  }
});
