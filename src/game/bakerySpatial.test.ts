import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BAKERY_BOUNDS,
  BAKERY_DOOR_SPAWN,
  BAKERY_INTERACTABLES,
  BAKERY_INTERIOR_OBSTACLES,
  BAKERY_SEAT_SPOTS,
  computeBakeryWaypoints,
  isBakeryInteriorWalkable,
} from './bakery';
import { resolveSeatStandPos } from './walkability';

/**
 * Hearth & Crumb — Spatial Comfort contract tests (player-perspective layout audit).
 *
 * These pin the MEASURABLE movement requirements for the 0.42-radius actor, so the
 * bakery cannot silently regress into a furniture obstacle course:
 *
 *   - main circulation  ≥ 2.0 m clear
 *   - secondary paths   ≥ 1.2 m clear
 *   - doorway band      ≥ 2.0 m clear at the entrance row
 *   - no scrape slivers (walkable cells with < 0.7 m local corridor width)
 *   - every routing hub on real walkable floor
 *   - comfortable turning disc in the central customer area
 *   - interaction approach space for every station
 *   - future host anchors keep player separation without blocking circulation
 */

const R = 0.42;
const STEP = 0.02;

function walkable(x: number, z: number): boolean {
  return isBakeryInteriorWalkable(x, z, R);
}

/** Longest contiguous walkable run along a row/column through the given span. */
function runWidthAlongX(z: number, xFrom: number, xTo: number): number {
  let best = 0;
  let cur = 0;
  for (let x = xFrom; x <= xTo + 1e-9; x += STEP) {
    if (walkable(x, z)) {
      cur += STEP;
      if (cur > best) best = cur;
    } else {
      cur = 0;
    }
  }
  return best;
}

function runWidthAlongZ(x: number, zFrom: number, zTo: number): number {
  let best = 0;
  let cur = 0;
  for (let z = zFrom; z <= zTo + 1e-9; z += STEP) {
    if (walkable(x, z)) {
      cur += STEP;
      if (cur > best) best = cur;
    } else {
      cur = 0;
    }
  }
  return best;
}

test('spatial: obstacle table stays coherent and inside the room bounds', () => {
  assert.ok(BAKERY_INTERIOR_OBSTACLES.length >= 4, 'core furniture present');
  for (const box of BAKERY_INTERIOR_OBSTACLES) {
    assert.ok(box.minX >= BAKERY_BOUNDS.minX && box.maxX <= BAKERY_BOUNDS.maxX, `${box.id} x inside bounds`);
    assert.ok(box.minZ >= BAKERY_BOUNDS.minZ && box.maxZ <= BAKERY_BOUNDS.maxZ, `${box.id} z inside bounds`);
    assert.ok(box.maxX > box.minX && box.maxZ > box.minZ, `${box.id} box non-degenerate`);
  }
});

test('spatial: circulation clear widths meet the comfort targets', () => {
  const minX = BAKERY_BOUNDS.minX;
  const maxX = BAKERY_BOUNDS.maxX;
  const minZ = BAKERY_BOUNDS.minZ;
  const maxZ = BAKERY_BOUNDS.maxZ;

  // Secondary path: north passage between oven and prep (was 0.86 m — the worst squeeze)
  const northPassage = runWidthAlongX(-1.7, minX, maxX);
  assert.ok(
    northPassage >= 1.2,
    `north passage clear width ${northPassage.toFixed(2)} m must be ≥ 1.2 m`,
  );

  // Main path: central customer aisle (door → counter/oven side)
  for (const z of [-0.5, 0.35, 0.9]) {
    const w = runWidthAlongX(z, minX, maxX);
    assert.ok(w >= 2.0, `central aisle row z=${z} clear width ${w.toFixed(2)} m must be ≥ 2.0 m`);
  }

  // Entrance band: the walkable row through the door-mat depth
  const doorBand = runWidthAlongX(1.5, minX, maxX);
  assert.ok(doorBand >= 2.0, `door band row z=1.5 clear width ${doorBand.toFixed(2)} m must be ≥ 2.0 m`);

  // Secondary path: east aisle between prep table and café table / notes shelf
  const eastAisle = runWidthAlongZ(1.5, minZ, maxZ);
  assert.ok(eastAisle >= 1.5, `east aisle col x=1.5 clear width ${eastAisle.toFixed(2)} m must be ≥ 1.5 m`);
  const eastAisleRow = runWidthAlongX(-0.5, minX, maxX);
  assert.ok(eastAisleRow >= 1.95, `east aisle row z=-0.5 clear width ${eastAisleRow.toFixed(2)} m must be ≥ 1.95 m`);

  // Secondary path: west aisle serving the counter and oven walk-ups
  const westAisle = runWidthAlongZ(-1.5, minZ, maxZ);
  assert.ok(westAisle >= 1.2, `west aisle col x=-1.5 clear width ${westAisle.toFixed(2)} m must be ≥ 1.2 m`);
});

test('spatial: no scrape slivers — every walkable cell keeps ≥ 0.7 m local corridor width', () => {
  const minX = BAKERY_BOUNDS.minX + R;
  const maxX = BAKERY_BOUNDS.maxX - R;
  const minZ = BAKERY_BOUNDS.minZ + R;
  const maxZ = BAKERY_BOUNDS.maxZ - R;
  const offenders: string[] = [];
  for (let x = minX; x <= maxX + 1e-9; x += 0.1) {
    for (let z = minZ; z <= maxZ + 1e-9; z += 0.1) {
      if (!walkable(x, z)) continue;
      let x0 = x;
      while (x0 - STEP >= BAKERY_BOUNDS.minX && walkable(x0 - STEP, z)) x0 -= STEP;
      let x1 = x;
      while (x1 + STEP <= BAKERY_BOUNDS.maxX && walkable(x1 + STEP, z)) x1 += STEP;
      let z0 = z;
      while (z0 - STEP >= BAKERY_BOUNDS.minZ && walkable(x, z0 - STEP)) z0 -= STEP;
      let z1 = z;
      while (z1 + STEP <= BAKERY_BOUNDS.maxZ && walkable(x, z1 + STEP)) z1 += STEP;
      const localW = Math.min(x1 - x0, z1 - z0);
      if (localW < 0.7) {
        offenders.push(`(${x.toFixed(2)}, ${z.toFixed(2)}) local width ${localW.toFixed(2)} m`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `walkable scrape slivers found (all cells must keep ≥ 0.7 m local width):\n${offenders.join('\n')}`,
  );
});

test('spatial: sealed scrape pockets — counter end slot and east-wall sliver are unwalkable', () => {
  // SW slot behind the (old) counter end against the south wall
  // (x stops at -1.8: east of the counter's inflated edge is the legitimate aisle)
  for (let x = -2.58; x <= -1.8; x += 0.1) {
    for (let z = 1.7; z <= 1.98; z += 0.05) {
      assert.equal(walkable(x, z), false, `old counter-end slot must be sealed at (${x.toFixed(2)}, ${z.toFixed(2)})`);
    }
  }
  // SE sliver east of the (old) café table against the east wall
  for (let x = 2.3; x <= 2.58; x += 0.05) {
    for (let z = 0.5; z <= 1.98; z += 0.1) {
      assert.equal(walkable(x, z), false, `old table-east sliver must be sealed at (${x.toFixed(2)}, ${z.toFixed(2)})`);
    }
  }
});

test('spatial: every navigation hub sits on real walkable floor', () => {
  // Mirrors BAKERY_INTERIOR_HUBS (not exported) — this list IS the routing contract.
  const hubs: Array<[string, number, number]> = [
    ['central aisle', -0.35, 0.35],
    ['west aisle', -1.5, -0.6],
    ['east aisle', 1.5, -0.75],
    ['north passage', 0.0, -1.35],
    ['south passage', -0.45, 1.6],
    ['east-aisle pocket', 2.1, -0.2],
    ['north-passage west mouth', -0.5, -1.0],
  ];
  for (const [name, hx, hz] of hubs) {
    assert.equal(walkable(hx, hz), true, `hub ${name} (${hx}, ${hz}) must be walkable`);
  }
});

test('spatial: comfortable turning disc in the central customer area', () => {
  const cx = -0.35;
  const cz = 0.35;
  const discRadius = 0.8; // 1.6 m diameter turn-around space
  for (let a = 0; a < 24; a++) {
    const ang = (a / 24) * Math.PI * 2;
    const px = cx + Math.cos(ang) * discRadius;
    const pz = cz + Math.sin(ang) * discRadius;
    assert.equal(
      walkable(px, pz),
      true,
      `turning disc point (${px.toFixed(2)}, ${pz.toFixed(2)}) at angle ${ang.toFixed(2)} must stay walkable`,
    );
  }
});

test('spatial: every station is approachable with usable stand space and reachable focus', () => {
  for (const prop of BAKERY_INTERACTABLES) {
    // Stand spots walkable (door focus sits beyond the south wall by design)
    if (prop.id !== 'bakery_door') {
      assert.equal(walkable(prop.x, prop.z), true, `stand spot for ${prop.id} must be walkable`);
    }
    // The focus must be reachable from walkable floor within the interaction radius
    let reachable = 0;
    for (let x = BAKERY_BOUNDS.minX + R; x <= BAKERY_BOUNDS.maxX - R; x += 0.1) {
      for (let z = BAKERY_BOUNDS.minZ + R; z <= BAKERY_BOUNDS.maxZ - R; z += 0.1) {
        if (!walkable(x, z)) continue;
        if (Math.hypot(x - prop.focusX, z - prop.focusZ) <= prop.interactRadius) reachable++;
      }
    }
    assert.ok(
      reachable >= 40,
      `${prop.id} needs generous approach space (found ${reachable} stand cells within radius ${prop.interactRadius})`,
    );
  }
});

test('spatial: routes from the door reach every station and the café seat within two hops', () => {
  const targets: Array<[string, { x: number; z: number }]> = [
    ...BAKERY_INTERACTABLES.map((p) => [p.id, { x: p.x, z: p.z }] as [string, { x: number; z: number }]),
    ...BAKERY_SEAT_SPOTS.map((s) => [`seat:${s.id}`, { ...s.approachPos }] as [string, { x: number; z: number }]),
  ];
  for (const [name, to] of targets) {
    const path = computeBakeryWaypoints({ ...BAKERY_DOOR_SPAWN }, to, R);
    assert.ok(path.length >= 1 && path.length <= 3, `${name}: route found (${path.length} hops)`);
    // every hop lands on walkable floor (final hop may be the station stand spot itself)
    let cursor = { ...BAKERY_DOOR_SPAWN };
    for (const waypoint of path) {
      const seg = computeBakeryWaypoints(cursor, waypoint, R);
      assert.equal(seg[seg.length - 1].x, waypoint.x, `${name}: segment reaches waypoint`);
      // sample the straight segment for walkability
      const dist = Math.hypot(waypoint.x - cursor.x, waypoint.z - cursor.z);
      const steps = Math.max(4, Math.ceil(dist / 0.2));
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const sx = cursor.x + (waypoint.x - cursor.x) * t;
        const sz = cursor.z + (waypoint.z - cursor.z) * t;
        assert.equal(
          walkable(sx, sz),
          true,
          `${name}: route segment passes through blocked floor at (${sx.toFixed(2)}, ${sz.toFixed(2)})`,
        );
      }
      cursor = waypoint;
    }
  }
});

test('spatial: café seat approach stays walkable and stand-up resolution never traps the sitter', () => {
  const seat = BAKERY_SEAT_SPOTS[0];
  assert.equal(walkable(seat.approachPos.x, seat.approachPos.z), true, 'seat approach must be walkable');
  // The seat itself tucks into the table's furniture footprint (chair at the table edge)
  const table = BAKERY_INTERIOR_OBSTACLES.find((b) => b.id === 'bakery_table')!;
  const inflated = {
    minX: table.minX - 0.2,
    maxX: table.maxX + 0.2,
    minZ: table.minZ - 0.2,
    maxZ: table.maxZ + 0.2,
  };
  assert.ok(
    seat.seatPos.x >= inflated.minX && seat.seatPos.x <= inflated.maxX &&
    seat.seatPos.z >= inflated.minZ && seat.seatPos.z <= inflated.maxZ,
    'seat position hugs the café table footprint',
  );
  // Stand-up path (dispatcher) resolves to a walkable exit
  const stand = resolveSeatStandPos(seat);
  assert.ok(stand, 'café seat must resolve a stand-up position');
  if (stand) {
    assert.equal(walkable(stand.x, stand.z), true, 'resolved stand-up position must be walkable');
  }
});

test('spatial: future bakery-visit host anchors keep player separation without blocking routes', () => {
  // Staff-side anchor behind the counter (x < -2.2 is unreachable for players)
  const staffAnchor = { x: -2.6, z: 0.2 };
  let minStaffDist = Infinity;
  for (let x = BAKERY_BOUNDS.minX + R; x <= BAKERY_BOUNDS.maxX - R; x += 0.05) {
    for (let z = BAKERY_BOUNDS.minZ + R; z <= BAKERY_BOUNDS.maxZ - R; z += 0.05) {
      if (!walkable(x, z)) continue;
      minStaffDist = Math.min(minStaffDist, Math.hypot(x - staffAnchor.x, z - staffAnchor.z));
    }
  }
  assert.ok(
    minStaffDist >= 0.75,
    `player must keep ≥ 0.75 m separation from the staff-side host anchor (min ${minStaffDist.toFixed(2)} m)`,
  );

  // Café-corner host seat (east chair) — the table separates host and guest
  const cafeAnchor = { x: 2.22, z: 1.48 };
  let minCafeDist = Infinity;
  for (let x = BAKERY_BOUNDS.minX + R; x <= BAKERY_BOUNDS.maxX - R; x += 0.05) {
    for (let z = BAKERY_BOUNDS.minZ + R; z <= BAKERY_BOUNDS.maxZ - R; z += 0.05) {
      if (!walkable(x, z)) continue;
      minCafeDist = Math.min(minCafeDist, Math.hypot(x - cafeAnchor.x, z - cafeAnchor.z));
    }
  }
  assert.ok(
    minCafeDist >= 0.95,
    `player must keep ≥ 0.95 m separation from the café host seat (min ${minCafeDist.toFixed(2)} m)`,
  );

  // Neither anchor sits on a routing hub or the door spawn
  assert.equal(walkable(staffAnchor.x, staffAnchor.z), false, 'staff anchor must be behind the counter (unreachable)');
  assert.equal(walkable(cafeAnchor.x, cafeAnchor.z), false, 'café host seat must sit in the table footprint (not on a route)');
});
