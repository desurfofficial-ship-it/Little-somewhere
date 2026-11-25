// Re-probe C4 at adjusted position to clear the pond_south_w -> pond_south_e LOS edge
import { isPointWalkable } from '../src/game/worldMap';
import { NAV_NODES, hasLineOfSight } from '../src/game/navigation';

const c = { id: 'C4_pond_iris_adjusted', cx: 6.5, cz: 19.5, w: 1.8, d: 0.9 };
console.log(`${c.id}: center=(${c.cx},${c.cz}) size=${c.w}x${c.d}`);
const corners = [
  ['SW', c.cx - c.w/2, c.cz - c.d/2],
  ['SE', c.cx + c.w/2, c.cz - c.d/2],
  ['NW', c.cx - c.w/2, c.cz + c.d/2],
  ['NE', c.cx + c.w/2, c.cz + c.d/2],
  ['C',  c.cx, c.cz],
] as const;
for (const [label, x, z] of corners) {
  console.log(`  ${label} (${x.toFixed(2)},${z.toFixed(2)}) walkable=${isPointWalkable(x, z, 0.48)}`);
}

// Check if the bed breaks the pond_south_w -> pond_south_e LOS edge
const pondSW = { x: -4.0, z: 17.8 };
const pondSE = { x: 7.2, z: 17.8 };
// Sample the LOS at the bed's x range
console.log('\n  LOS pond_south_w -> pond_south_e (z=17.8 line):');
for (let x = pondSW.x; x <= pondSE.x; x += 0.5) {
  const walk = isPointWalkable(x, 17.8, 0.48);
  console.log(`    x=${x.toFixed(2)} z=17.8 walkable=${walk}`);
}

// Also check distance from bed south edge to the z=17.8 path
const bedSouthZ = c.cz - c.d/2;
const walkerBodyNorth = 17.8 + 0.48;
console.log(`\n  Bed south edge z=${bedSouthZ}, walker body north edge z=${walkerBodyNorth}`);
console.log(`  Clearance: ${(bedSouthZ - walkerBodyNorth).toFixed(2)}m ${bedSouthZ > walkerBodyNorth ? '(CLEAR)' : '(BLOCKS PATH)'}`);

// Find nearest nav node
let nearest = Infinity, nearestId = '';
for (const n of NAV_NODES) {
  const d = Math.hypot(n.pos.x - c.cx, n.pos.z - c.cz);
  if (d < nearest) { nearest = d; nearestId = n.id; }
}
console.log(`  nearest nav node: ${nearestId} at ${nearest.toFixed(2)}m`);
