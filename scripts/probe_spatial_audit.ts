/**
 * Stage 3 spatial audit probe — evidence-backed measurements of Willow Square.
 * Run: npx tsx scripts/probe_spatial_audit.ts
 *
 * Measures, from the LIVE game modules (no invented numbers):
 *  1. Walkable fraction at player radius 0.48 vs free-center 0.05 (squeezed corridors).
 *  2. Distance-to-obstacle field: pinch corridors (width < 1.2u) with locations.
 *  3. Building footprints + pairwise separation gaps.
 *  4. Landmark pairwise distances.
 *  5. Pond: logical box area vs visual outline polygon area + perimeter (shoelace).
 *  6. Bridge proportions vs player diameter.
 *  7. Height hierarchy: fountain vs buildings vs hollow oak (from builder constants).
 *  8. Camera visible ground extents at zoom 0.55/1.0/1.75 for desktop+mobile aspects.
 */
import { POND_OUTLINE_SHAPE_POINTS, buildHollowOakLandmark } from '../src/scene/builders/vegetation';
import { buildStorybookFountain } from '../src/scene/builders/landmarks';
import { MaterialPalette } from '../src/scene/materials';
import * as THREE from 'three';
import {
  BOX_OBSTACLES,
  CIRCLE_OBSTACLES,
  WORLD_BOUNDS,
  isPointWalkable,
  FOUNTAIN_CENTER,
  POND_CENTER,
  SEAT_SPOTS,
  PROP_INTERACTABLES,
} from '../src/game/worldMap';
import { NAV_NODES, NAV_EDGES } from '../src/game/navigation';

const W = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX; // 50
const H = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ; // 46
const STEP = 0.25;

// --- 1+2. walkable field ----------------------------------------------------
let free = 0, tight = 0, total = 0;
const pinches: { x: number; z: number; clearance: number }[] = [];
// distance from point to nearest obstacle SURFACE (boxes + circles)
function obstacleSurfaceDist(x: number, z: number): number {
  let best = Infinity;
  for (const b of BOX_OBSTACLES) {
    const dx = Math.max(b.minX - x, 0, x - b.maxX);
    const dz = Math.max(b.minZ - z, 0, z - b.maxZ);
    best = Math.min(best, Math.hypot(dx, dz));
  }
  for (const c of CIRCLE_OBSTACLES) {
    const d = Math.hypot(x - c.x, z - c.z) - c.radius;
    best = Math.min(best, d);
  }
  // world bounds count as walls
  best = Math.min(
    best,
    x - WORLD_BOUNDS.minX,
    WORLD_BOUNDS.maxX - x,
    z - WORLD_BOUNDS.minZ,
    WORLD_BOUNDS.maxZ - z,
  );
  return best;
}
for (let x = WORLD_BOUNDS.minX + STEP / 2; x < WORLD_BOUNDS.maxX; x += STEP) {
  for (let z = WORLD_BOUNDS.minZ + STEP / 2; z < WORLD_BOUNDS.maxZ; z += STEP) {
    total++;
    if (isPointWalkable(x, z, 0.48)) {
      free++;
      const cl = obstacleSurfaceDist(x, z);
      if (cl < 0.6) pinches.push({ x, z, clearance: cl });
    } else if (isPointWalkable(x, z, 0.05)) {
      tight++; // walkable center but too narrow for the player body
    }
  }
}
const areaCell = STEP * STEP;
const worldArea = W * H;
const walkableArea = free * areaCell;
const tightArea = tight * areaCell;

// --- 3. buildings + gaps ----------------------------------------------------
const buildings = BOX_OBSTACLES.filter((b) =>
  ['player_cottage', 'bakery', 'book_nook', 'workshop_arthur', 'greenhouse', 'workshop_barnaby'].includes(b.id),
);
function rectGap(a: typeof buildings[0], b: typeof buildings[0]): number {
  const dx = Math.max(b.minX - a.maxX, a.minX - b.maxX, 0);
  const dz = Math.max(b.minZ - a.maxZ, a.minZ - b.maxZ, 0);
  return Math.hypot(dx, dz);
}
let builtArea = 0;
for (const b of buildings) builtArea += (b.maxX - b.minX) * (b.maxZ - b.minZ);
const pondBox = BOX_OBSTACLES.find((b) => b.id === 'pond_water')!;

// --- 5. pond outline polygon (world coords, LIVE from the builder export) ---
const PC = POND_CENTER;
const outline = POND_OUTLINE_SHAPE_POINTS.map(([sx, sy]) => [sx + PC.x, PC.z - sy] as [number, number]);
function polygonArea(pts: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % pts.length];
    a += x1 * z2 - x2 * z1;
  }
  return Math.abs(a) / 2;
}
function polygonPerimeter(pts: [number, number][]): number {
  let p = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % pts.length];
    p += Math.hypot(x2 - x1, z2 - z1);
  }
  return p;
}
const pondWaterArea = polygonArea(outline);
const pondShoreline = polygonPerimeter(outline);
// west brook channel width: measure the live west_brook_run box
const brookRun = BOX_OBSTACLES.find((b) => b.id === 'west_brook_run');
const brookArmWidth = brookRun ? brookRun.maxZ - brookRun.minZ : 0;

// --- 7. height hierarchy (MEASURED from the live rigs) ----------------------
const _pal = new MaterialPalette();
const _tex = new THREE.Texture();
const _f = buildStorybookFountain(_pal, _tex);
const _o = buildHollowOakLandmark(_pal, _tex);
_f.group.updateMatrixWorld(true);
_o.group.updateMatrixWorld(true);
const fb = new THREE.Box3().setFromObject(_f.group);
const ob = new THREE.Box3().setFromObject(_o.group);
const heights = {
  fountainRigHeight: +(fb.max.y - fb.min.y).toFixed(2),
  oakRigHeight: +(ob.max.y - ob.min.y).toFixed(2),
  oakCanopySpreadX: +(ob.max.x - ob.min.x).toFixed(2),
  houseWalls: [2.48, 2.58, 2.62, 2.75],
  houseRoofPeakApprox: 4.3,
  gazeboSpireApprox: 5.2,
};
_pal.disposeAll();

// --- 8. camera visible extents ----------------------------------------------
function visibleExtent(zoom: number, aspect: number): { horiz: number; vert: number; dist: number } {
  const dist = Math.hypot(19.5 * zoom, 18.2 * zoom, 19.5 * zoom);
  const vFov = (28 * Math.PI) / 180;
  const visVert = 2 * dist * Math.tan(vFov / 2); // view-space vertical span at player distance
  return { horiz: visVert * aspect, vert: visVert, dist };
}

// --- output ------------------------------------------------------------------
console.log('=== SPATIAL AUDIT PROBE (branch stage3/fishing-v11-west-brook @ df3e7f1) ===\n');
console.log('--- world ---');
console.log(`world: ${W} x ${H} u = ${worldArea.toFixed(0)} u²`);
console.log(`walkable @ r0.48: ${((free / total) * 100).toFixed(1)}% = ${walkableArea.toFixed(0)} u²`);
console.log(`center-walkable but body-blocked (squeezed/ghost): ${((tight / total) * 100).toFixed(2)}% = ${tightArea.toFixed(1)} u²`);
console.log(`pinch cells (clearance < 0.6u → corridor < 1.2u): ${pinches.length} cells`);
const pinchByRegion = new Map<string, number>();
for (const p of pinches) {
  const key = `x${Math.round(p.x)},z${Math.round(p.z)}`;
  pinchByRegion.set(key, (pinchByRegion.get(key) ?? 0) + 1);
}
console.log('pinch hotspots (cell clusters):');
const clusters: { cx: number; cz: number; n: number; minCl: number }[] = [];
for (const p of pinches) {
  const c = clusters.find((c) => Math.hypot(c.cx - p.x, c.cz - p.z) < 1.5);
  if (c) { c.n++; c.minCl = Math.min(c.minCl, p.clearance); }
  else clusters.push({ cx: p.x, cz: p.z, n: 1, minCl: p.clearance });
}
clusters.sort((a, b) => b.n - a.n);
for (const c of clusters.slice(0, 14)) {
  console.log(`  (${c.cx.toFixed(1)}, ${c.cz.toFixed(1)}) cells=${c.n} minClearance=${c.minCl.toFixed(2)}u → corridor ≈ ${(c.minCl * 2).toFixed(2)}u`);
}

console.log('\n--- buildings ---');
let bsum = 0;
for (const b of buildings) {
  const a = (b.maxX - b.minX) * (b.maxZ - b.minZ);
  bsum += a;
  console.log(`${b.id}: ${(b.maxX - b.minX).toFixed(1)} x ${(b.maxZ - b.minZ).toFixed(1)} = ${a.toFixed(1)} u²`);
}
console.log(`total building footprint: ${bsum.toFixed(1)} u² = ${((bsum / worldArea) * 100).toFixed(1)}% of world`);
console.log(`pond_water box: ${(pondBox.maxX - pondBox.minX).toFixed(2)} x ${(pondBox.maxZ - pondBox.minZ).toFixed(2)} = ${((pondBox.maxX - pondBox.minX) * (pondBox.maxZ - pondBox.minZ)).toFixed(1)} u²`);
console.log('\nbuilding separation gaps (surface-to-surface):');
for (let i = 0; i < buildings.length; i++) {
  for (let j = i + 1; j < buildings.length; j++) {
    const g = rectGap(buildings[i], buildings[j]);
    if (g > 0 && g < 12) {
      console.log(`  ${buildings[i].id} ↔ ${buildings[j].id}: ${g.toFixed(2)}u (player-usable ${((g - 0.96)).toFixed(2)}u)`);
    }
  }
}

console.log('\n--- pond ---');
console.log(`visual water polygon area: ${pondWaterArea.toFixed(1)} u² (main+brook)`);
console.log(`visual shoreline perimeter: ${pondShoreline.toFixed(1)} u`);
console.log(`west brook channel width ≈ ${brookArmWidth.toFixed(2)}u`);
console.log(`pond bench seat→water edge: seat (1.8, 19.3) → pond box maxZ 16.65 = ${(19.3 - 16.65).toFixed(2)}u behind the water line`);

console.log('\n--- bridge vs player ---');
const playerDia = 0.96;
// measure the LIVE walkable deck strip at midspan
let stripMin = Infinity, stripMax = -Infinity;
for (let x = -4.5; x <= -2.0; x += 0.01) {
  if (isPointWalkable(x, 14.0, 0.48)) { stripMin = Math.min(stripMin, x); stripMax = Math.max(stripMax, x); }
}
const stripW = stripMax - stripMin;
console.log(`deck walk strip @r0.48 at z=14: x ${stripMin.toFixed(2)}..${stripMax.toFixed(2)} = ${stripW.toFixed(2)}u wide (${(stripW / playerDia).toFixed(2)} player-diameters)`);
const brookSpan = brookRun ? brookRun.maxX - brookRun.minX : 0;
console.log(`brook run: ${brookSpan.toFixed(2)}u long x ${brookArmWidth.toFixed(2)}u wide (was 1.72u wide, culvert-only)`);

console.log('\n--- landmark distances ---');
const landmarks: Record<string, { x: number; z: number }> = {
  fountain: FOUNTAIN_CENTER,
  gazebo: { x: 0, z: -9.5 },
  pondCenter: POND_CENTER,
  hollowOak: { x: -6.2, z: 15.6 },
  bakeryDoor: { x: -12.4, z: -6.75 },
  nookDoor: { x: -11.8, z: -1.0 },
  greenhouseDoor: { x: 10.15, z: 3.2 },
  copperwheelDoor: { x: 13.1, z: -7.55 },
  barnabyYard: { x: 12.4, z: 13.0 },
  westBrookRig: { x: -4.45, z: 13.9 },
  willowJetty: { x: -0.8, z: 17.6 },
};
const ids = Object.keys(landmarks);
for (let i = 0; i < ids.length; i++) {
  for (let j = i + 1; j < ids.length; j++) {
    const a = landmarks[ids[i]], b = landmarks[ids[j]];
    const d = Math.hypot(a.x - b.x, a.z - b.z);
    if (d < 14) console.log(`  ${ids[i]} ↔ ${ids[j]}: ${d.toFixed(2)}u`);
  }
}

console.log('\n--- heights ---');
console.log(JSON.stringify(heights));

console.log('\n--- camera (fov 28°, offset 19.5/18.2/19.5 × zoom) ---');
for (const z of [0.55, 1.0, 1.75]) {
  const d = visibleExtent(z, 1.6);
  const m = visibleExtent(z, 390 / 844);
  console.log(`zoom ${z}: dist ${d.dist.toFixed(1)}u | desktop sees ${d.horiz.toFixed(1)}×${d.vert.toFixed(1)}u | mobile sees ${m.horiz.toFixed(1)}×${m.vert.toFixed(1)}u`);
  console.log(`  fountain (2.86u) screen height at player-plane: desktop ${((2.86 / d.vert) * 100).toFixed(0)}% | mobile ${((2.86 / m.vert) * 100).toFixed(0)}%`);
}

console.log('\n--- seats & interactables near pond/oak ---');
for (const s of SEAT_SPOTS) console.log(`seat ${s.id} @ (${s.seatPos.x}, ${s.seatPos.z}) zone ${s.zoneId}`);
for (const p of PROP_INTERACTABLES) {
  if (['willow_jetty', 'west_brook_bank', 'mirror_pond', 'hollow_oak', 'pond_driftwood', 'fountain_plaza'].includes(p.id)) {
    console.log(`prop ${p.id} @ (${p.x}, ${p.z}) r ${p.interactRadius}`);
  }
}
console.log(`nav nodes: ${NAV_NODES.length}, edges: ${NAV_EDGES.length}`);
