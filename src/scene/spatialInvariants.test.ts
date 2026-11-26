/**
 * Stage 3 spatial redesign — spatial invariants battery (Slice W1/F1/O1).
 *
 * Meaningful spatial invariants only (no brittle coordinate pins): the water
 * you can SEE is never ground you can STAND on, the bridge deck is actually
 * walkable along its span, the redesigned landmarks carry real silhouette
 * height, and the pond measurably GREW. Run: npm test (tsx --test).
 *
 * Test id → spec map:
 *   SPAT-01 visible water polygon ⊆ logical water exclusions (deck strip excepted)
 *   SPAT-02 bridge deck walk strip ≥ 0.6u wide at five stations + arch height contract
 *   SPAT-03 destination anchors walkable & A*-reachable (east bench, both fishing spots, driftwood)
 *   SPAT-04 silhouette hierarchy: oak top > fountain top > house roofs; oak spread ≥ 6.5u
 *   SPAT-05 pond growth lock: water area ≥ 38 u² (baseline 29.1), shoreline ≥ 30u (baseline 21.8)
 *   SPAT-06 the old oak-rail razor corridor is now water (never walkable at all)
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import * as THREE from 'three';

import { POND_OUTLINE_SHAPE_POINTS } from './builders/vegetation';
import { buildStorybookFountain, STORYBOOK_FOUNTAIN_SPEC } from './builders/landmarks';
import { buildHollowOakLandmark } from './builders/vegetation';
import {
  isPointWalkable,
  getGroundHeightAt,
  POND_CENTER,
  SEAT_SPOTS,
  PROP_INTERACTABLES,
} from '../game/worldMap';
import { computeWaypointPath } from '../game/navigation';
import { MaterialPalette, STORYBOOK_PALETTE } from './materials';

const PLAYER_RADIUS = 0.48;

// World-space polygon of the rendered water (POND_CENTER mapping: world x = cx + sx, world z = cz - sy).
const spline = new THREE.SplineCurve(POND_OUTLINE_SHAPE_POINTS.map((p) => new THREE.Vector2(p[0], p[1])));
const shapePts = spline.getPoints(120);
const worldPoly: [number, number][] = shapePts.map((p) => [POND_CENTER.x + p.x, POND_CENTER.z - p.y]);

function pointInPolygon(x: number, z: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function polygonArea(poly: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    a += x1 * z2 - x2 * z1;
  }
  return Math.abs(a) / 2;
}

function polygonPerimeter(poly: [number, number][]): number {
  let p = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    p += Math.hypot(x2 - x1, z2 - z1);
  }
  return p;
}

// The deck strip is the ONE place a walkable cell may carry visible water underfoot
// (the player walks the planks 0.85u above the culvert channel).
function isDeckStrip(x: number, z: number): boolean {
  return x > -3.4 && x < -2.68 && z >= 12.25 && z <= 15.75;
}

describe('Stage 3 spatial invariants (Willow Square redesign)', () => {
  it('SPAT-01: every visible-water cell is blocked to the player body (deck strip excepted)', () => {
    let checked = 0;
    const STEP = 0.15;
    for (let x = -11.5; x <= 7; x += STEP) {
      for (let z = 11; z <= 17.5; z += STEP) {
        if (!pointInPolygon(x, z, worldPoly)) continue;
        checked++;
        if (isDeckStrip(x, z)) continue;
        assert.equal(
          isPointWalkable(x, z, PLAYER_RADIUS),
          false,
          `visible water at (${x.toFixed(2)}, ${z.toFixed(2)}) must not be standable at r ${PLAYER_RADIUS}`,
        );
      }
    }
    assert.ok(checked > 800, `water sampling covered enough cells (got ${checked})`);
  });

  it('SPAT-02: the bridge deck walk strip stays ≥ 0.6u wide and honors the arch height', () => {
    for (const z of [12.5, 13.0, 14.0, 15.0, 15.5]) {
      let minX = Infinity;
      let maxX = -Infinity;
      for (let x = -3.6; x <= -2.5; x += 0.01) {
        if (isPointWalkable(x, z, PLAYER_RADIUS)) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
      }
      assert.ok(
        maxX - minX >= 0.6,
        `deck walk strip at z ${z} measured ${(maxX - minX).toFixed(2)}u (min 0.6u)`,
      );
      const midX = (minX + maxX) / 2;
      const h = getGroundHeightAt(midX, z);
      assert.ok(h > 0.1, `deck height at z ${z} must be elevated (got ${h.toFixed(2)})`);
    }
    // The arch peaks at 0.85 over the channel and feathers to the approaches.
    assert.ok(Math.abs(getGroundHeightAt(-2.9, 14.0) - 0.95) < 0.02, 'arch peak 0.95 at midspan');
    assert.ok(getGroundHeightAt(-2.9, 12.0) < 0.1, 'north approach returns to ground level');
    assert.ok(getGroundHeightAt(-2.9, 16.0) < 0.1, 'south approach returns to ground level');
    // Continuity: no cliff between deck and bank at the feathers.
    for (const z of [12.3, 15.7]) {
      const h = getGroundHeightAt(-2.9, z);
      assert.ok(h < 0.35, `deck tip height at z ${z} must be feathered (got ${h.toFixed(2)})`);
    }
  });

  it('SPAT-03: destination anchors are walkable and A*-reachable from the plaza', () => {
    const plaza = { x: 0, z: 3 };
    const eastBench = SEAT_SPOTS.find((s) => s.id === 'seat_pond_east');
    assert.ok(eastBench, 'seat_pond_east exists');
    assert.equal(isPointWalkable(eastBench.approachPos.x, eastBench.approachPos.z, PLAYER_RADIUS), true);
    const path = computeWaypointPath(plaza, eastBench.approachPos, PLAYER_RADIUS);
    assert.ok(path, 'east pond bench approach is A*-reachable');

    const driftwood = PROP_INTERACTABLES.find((p) => p.id === 'pond_driftwood')!;
    assert.equal(isPointWalkable(driftwood.x, driftwood.z, PLAYER_RADIUS), true, 'driftwood stand walkable');
    assert.ok(computeWaypointPath(plaza, { x: driftwood.x, z: driftwood.z }, PLAYER_RADIUS), 'driftwood reachable');

    const brook = PROP_INTERACTABLES.find((p) => p.id === 'west_brook_bank')!;
    assert.equal(isPointWalkable(brook.x, brook.z, PLAYER_RADIUS), true, 'brook bank stand walkable');
    assert.ok(computeWaypointPath(plaza, { x: brook.x, z: brook.z }, PLAYER_RADIUS), 'brook bank reachable');

    const jetty = PROP_INTERACTABLES.find((p) => p.id === 'willow_jetty')!;
    assert.equal(isPointWalkable(jetty.x, jetty.z, PLAYER_RADIUS), true, 'jetty stand walkable (regression)');
    assert.ok(computeWaypointPath(plaza, { x: jetty.x, z: jetty.z }, PLAYER_RADIUS), 'jetty reachable (regression)');
  });

  it('SPAT-04: silhouette hierarchy — oak top > fountain top > house roof peaks; oak spread ≥ 6.5u', () => {
    const palette = new MaterialPalette();
    const dummyTex = new THREE.Texture();
    const fountain = buildStorybookFountain(palette, dummyTex);
    const oak = buildHollowOakLandmark(palette, dummyTex);
    fountain.group.updateMatrixWorld(true);
    oak.group.updateMatrixWorld(true);

    const fountainBox = new THREE.Box3().setFromObject(fountain.group);
    const oakBox = new THREE.Box3().setFromObject(oak.group);
    const fountainH = fountainBox.max.y - fountainBox.min.y;
    const oakH = oakBox.max.y - oakBox.min.y;
    const oakW = Math.max(oakBox.max.x - oakBox.min.x, oakBox.max.z - oakBox.min.z);

    assert.ok(
      STORYBOOK_FOUNTAIN_SPEC.finialTipY >= 4.2,
      `fountain tip ${STORYBOOK_FOUNTAIN_SPEC.finialTipY} clears the tallest house roof peak (≈ 4.3 incl. walls, ≈ 4.2 minimum lock)`,
    );
    assert.ok(fountainH >= 4.2, `fountain rig height ${fountainH.toFixed(2)} ≥ 4.2`);
    assert.ok(oakH >= 7.0, `oak rig height ${oakH.toFixed(2)} ≥ 7.0 (was 4.8)`);
    assert.ok(oakW >= 6.5, `oak canopy spread ${oakW.toFixed(2)} ≥ 6.5 (was 4.6)`);
    assert.ok(oakH > STORYBOOK_FOUNTAIN_SPEC.finialTipY, 'the oak is the tallest silhouette in Willow Square');
    palette.disposeAll();
  });

  it('SPAT-05: the pond measurably grew (area ≥ 38 u² from 29.1; shoreline ≥ 30u from 21.8)', () => {
    const area = polygonArea(worldPoly);
    const shore = polygonPerimeter(worldPoly);
    assert.ok(area >= 38, `water area ${area.toFixed(1)} u² ≥ 38 u²`);
    assert.ok(shore >= 30, `shoreline ${shore.toFixed(1)} u ≥ 30 u`);
  });

  it('SPAT-06: the old oak-rail razor corridor is now running water (never walkable)', () => {
    // The 0.19u squeeze between the hollow oak and the old rail band at z ≈ 14.
    for (const x of [-4.3, -4.2, -4.1]) {
      assert.equal(
        isPointWalkable(x, 14.0, PLAYER_RADIUS),
        false,
        `(${x}, 14.0) is brook water now — the razor corridor is gone`,
      );
    }
    // And the replacement north-bank lane is genuinely comfortable.
    for (const x of [-5.0, -5.5, -6.0]) {
      assert.equal(
        isPointWalkable(x, 12.2, PLAYER_RADIUS),
        true,
        `north-bank lane (${x}, 12.2) walkable at player radius`,
      );
    }
  });
});
