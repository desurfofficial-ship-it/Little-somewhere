import * as THREE from 'three';
import {
  COBBLE_RECTS,
  COBBLE_SKIRT_DEPTH,
  COBBLE_SURFACE_HEIGHT,
  COBBLE_TEX_REPEATS_PER_UNIT,
  type CobbleRect,
} from '../../game/groundSurfaces';

/**
 * Unified cobblestone walk-surface geometry (FLICKER FIX G1).
 *
 * The old renderer laid the plaza/lane network as EIGHT overlapping BoxGeometry slabs.
 * All tops sat at exactly y = +0.05 with one shared material, so every lane crossing
 * rasterized TWO (or three) opaque surfaces at identical depth — ≈98 m² of true
 * z-fighting whose winner flips with any camera sub-pixel motion (the reported floor
 * flicker; measured 400–552 strip-identity flips per 0.5 s on a stationary camera).
 * The per-face box UVs also stretched one shared cobble texture over footprints from
 * 2.3 u to 22 u — stone density varied 9.6× across surfaces meant to read as one pavement.
 *
 * This builder produces ONE geometry from the exact axis-aligned rectangle union:
 *   - grid decomposition at the rects' own boundary coordinates (cells never straddle
 *     a rect edge → coverage is exact, no sampling error),
 *   - one top quad per covered cell at y = COBBLE_SURFACE_HEIGHT (a single fragment
 *     per pixel — the coplanar pair simply no longer exists),
 *   - skirt walls only at the TRUE network boundary (down to the same -0.01 burial the
 *     boxes used), with outward normals,
 *   - world-aligned UVs (uv = worldXZ · COBBLE_TEX_REPEATS_PER_UNIT) so the plaza's
 *     authored stone density is preserved exactly and applied uniformly everywhere.
 *
 * Deterministic pure geometry: same rects in, same vertices out (unit-tested).
 */

export interface CobbleNetworkGeometryStats {
  topQuads: number;
  skirtQuads: number;
  vertices: number;
  triangles: number;
}

interface Acc {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  vertexKeys: Map<string, number>;
  topQuads: number;
  skirtQuads: number;
}

function vertexIndex(
  acc: Acc,
  x: number,
  y: number,
  z: number,
  nx: number,
  ny: number,
  nz: number,
  u: number,
  v: number,
): number {
  // Top faces all share one normal; skirts are axis-aligned; keying on position+normal
  // lets adjacent cells weld into a continuous surface (no T-junction shading seams).
  const key = `${x.toFixed(4)}_${y.toFixed(4)}_${z.toFixed(4)}_${nx}_${ny}_${nz}`;
  const existing = acc.vertexKeys.get(key);
  if (existing !== undefined) return existing;
  const idx = acc.positions.length / 3;
  acc.positions.push(x, y, z);
  acc.normals.push(nx, ny, nz);
  acc.uvs.push(u, v);
  acc.vertexKeys.set(key, idx);
  return idx;
}

function rectContains(r: CobbleRect, x: number, z: number): boolean {
  return Math.abs(x - r.x) <= r.halfW && Math.abs(z - r.z) <= r.halfL;
}

/**
 * Builds the merged cobble walk-surface geometry.
 *
 * @param rects rect table (defaults to the authored COBBLE_RECTS; parameter exists for tests)
 * @param repeatsPerUnit world-aligned texture repeats per world unit (defaults to the authored plaza density)
 */
export function buildCobbleNetworkGeometry(
  rects: readonly CobbleRect[] = COBBLE_RECTS,
  repeatsPerUnit: number = COBBLE_TEX_REPEATS_PER_UNIT,
): { geometry: THREE.BufferGeometry; stats: CobbleNetworkGeometryStats } {
  if (rects.length === 0) {
    return {
      geometry: new THREE.BufferGeometry(),
      stats: { topQuads: 0, skirtQuads: 0, vertices: 0, triangles: 0 },
    };
  }

  // --- exact grid cuts from the rects themselves -------------------------------
  const xsSet = new Set<number>();
  const zsSet = new Set<number>();
  for (const r of rects) {
    xsSet.add(r.x - r.halfW);
    xsSet.add(r.x + r.halfW);
    zsSet.add(r.z - r.halfL);
    zsSet.add(r.z + r.halfL);
  }
  const xs = [...xsSet].sort((a, b) => a - b);
  const zs = [...zsSet].sort((a, b) => a - b);

  const acc: Acc = {
    positions: [],
    normals: [],
    uvs: [],
    indices: [],
    vertexKeys: new Map<string, number>(),
    topQuads: 0,
    skirtQuads: 0,
  };
  const H = COBBLE_SURFACE_HEIGHT;
  const B = H - COBBLE_SKIRT_DEPTH; // skirt bottom (-0.01, mirroring the old boxes)

  const covered = (cx: number, cz: number): boolean =>
    rects.some((r) => rectContains(r, cx, cz));

  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < zs.length - 1; j++) {
      const x0 = xs[i];
      const x1 = xs[i + 1];
      const z0 = zs[j];
      const z1 = zs[j + 1];
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      if (!covered(cx, cz)) continue;

      // --- top quad (+Y normal), CCW seen from above -------------------------
      const k = repeatsPerUnit;
      const a = vertexIndex(acc, x0, H, z0, 0, 1, 0, x0 * k, z0 * k);
      const b = vertexIndex(acc, x0, H, z1, 0, 1, 0, x0 * k, z1 * k);
      const c = vertexIndex(acc, x1, H, z1, 0, 1, 0, x1 * k, z1 * k);
      const d = vertexIndex(acc, x1, H, z0, 0, 1, 0, x1 * k, z0 * k);
      acc.indices.push(a, b, c, a, c, d);
      acc.topQuads++;

      // --- skirt walls where the union actually ends -------------------------
      const rightNeighborCovered = i + 1 <= xs.length - 2 && covered((x1 + xs[i + 2]) / 2, cz);
      const leftNeighborCovered = i - 1 >= 0 && covered((x0 + xs[i - 1]) / 2, cz);
      const upNeighborCovered = j + 1 <= zs.length - 2 && covered(cx, (z1 + zs[j + 2]) / 2);
      const downNeighborCovered = j - 1 >= 0 && covered(cx, (z0 + zs[j - 1]) / 2);

      if (!rightNeighborCovered) {
        const v0 = vertexIndex(acc, x1, H, z0, 1, 0, 0, z0 * k, H * k);
        const v1 = vertexIndex(acc, x1, H, z1, 1, 0, 0, z1 * k, H * k);
        const v2 = vertexIndex(acc, x1, B, z1, 1, 0, 0, z1 * k, B * k);
        const v3 = vertexIndex(acc, x1, B, z0, 1, 0, 0, z0 * k, B * k);
        acc.indices.push(v0, v1, v2, v0, v2, v3);
        acc.skirtQuads++;
      }
      if (!leftNeighborCovered) {
        const v0 = vertexIndex(acc, x0, H, z1, -1, 0, 0, z1 * k, H * k);
        const v1 = vertexIndex(acc, x0, H, z0, -1, 0, 0, z0 * k, H * k);
        const v2 = vertexIndex(acc, x0, B, z0, -1, 0, 0, z0 * k, B * k);
        const v3 = vertexIndex(acc, x0, B, z1, -1, 0, 0, z1 * k, B * k);
        acc.indices.push(v0, v1, v2, v0, v2, v3);
        acc.skirtQuads++;
      }
      if (!upNeighborCovered) {
        const v0 = vertexIndex(acc, x1, H, z1, 0, 0, 1, x1 * k, H * k);
        const v1 = vertexIndex(acc, x0, H, z1, 0, 0, 1, x0 * k, H * k);
        const v2 = vertexIndex(acc, x0, B, z1, 0, 0, 1, x0 * k, B * k);
        const v3 = vertexIndex(acc, x1, B, z1, 0, 0, 1, x1 * k, B * k);
        acc.indices.push(v0, v1, v2, v0, v2, v3);
        acc.skirtQuads++;
      }
      if (!downNeighborCovered) {
        const v0 = vertexIndex(acc, x0, H, z0, 0, 0, -1, x0 * k, H * k);
        const v1 = vertexIndex(acc, x1, H, z0, 0, 0, -1, x1 * k, H * k);
        const v2 = vertexIndex(acc, x1, B, z0, 0, 0, -1, x1 * k, B * k);
        const v3 = vertexIndex(acc, x0, B, z0, 0, 0, -1, x0 * k, B * k);
        acc.indices.push(v0, v1, v2, v0, v2, v3);
        acc.skirtQuads++;
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(acc.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(acc.normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(acc.uvs, 2));
  geometry.setIndex(acc.indices);
  geometry.computeBoundingSphere();

  return {
    geometry,
    stats: {
      topQuads: acc.topQuads,
      skirtQuads: acc.skirtQuads,
      vertices: acc.positions.length / 3,
      triangles: acc.indices.length / 3,
    },
  };
}
