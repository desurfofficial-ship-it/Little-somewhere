// Quick numerical sanity check: for each proposed candidate garden location,
// verify isPointWalkable at the bed center AND at each bed corner with the
// standard actor radius (0.48), and report distance to nearest NAV_NODE.
import { isPointWalkable } from '../src/game/worldMap';
import { NAV_NODES } from '../src/game/navigation';

const candidates = [
  // Adjusted C1: pushed south to clear bakery BOX inflated edge
  { id: 'C1_bakery_herb',        cx: -12.4, cz: -15.5, w: 2.0, d: 0.9 },
  { id: 'C2_barnaby_compost',    cx: 17.5,  cz: 13.0,  w: 1.5, d: 0.9 },
  { id: 'C3_nook_lavender',      cx: -14.0, cz: 3.5,   w: 1.6, d: 0.9 },
  { id: 'C4_pond_iris',          cx: 6.5,   cz: 18.5,  w: 1.8, d: 0.9 },
  // Adjusted C5: pushed east+north to clear skep circle and beeline path
  { id: 'C5_beeline_pollinator', cx: 7.0,   cz: -16.5, w: 1.5, d: 0.9 },
];

for (const c of candidates) {
  const corners = [
    ['SW', c.cx - c.w/2, c.cz - c.d/2],
    ['SE', c.cx + c.w/2, c.cz - c.d/2],
    ['NW', c.cx - c.w/2, c.cz + c.d/2],
    ['NE', c.cx + c.w/2, c.cz + c.d/2],
    ['C',  c.cx, c.cz],
  ] as const;
  console.log(`${c.id}: center=(${c.cx},${c.cz}) size=${c.w}x${c.d}`);
  for (const [label, x, z] of corners) {
    const walk = isPointWalkable(x, z, 0.48);
    console.log(`  ${label} (${x.toFixed(2)},${z.toFixed(2)}) walkable=${walk}`);
  }
  let nearest = Infinity, nearestId = '';
  for (const n of NAV_NODES) {
    const d = Math.hypot(n.pos.x - c.cx, n.pos.z - c.cz);
    if (d < nearest) { nearest = d; nearestId = n.id; }
  }
  console.log(`  nearest nav node: ${nearestId} at ${nearest.toFixed(2)}m`);
  const allWalkable = corners.every(([, x, z]) => isPointWalkable(x, z, 0.48));
  console.log(`  ${allWalkable ? 'PASS' : 'FAIL'}`);
  console.log();
}

// Also probe the existing Sorrel Hollow garden bed for parity
console.log('--- Existing Sorrel Hollow garden bed (parity check) ---');
const sorrel = { cx: -21.0, cz: 21.3, w: 1.4, d: 0.9 };
for (const [label, x, z] of [
  ['SW', sorrel.cx - sorrel.w/2, sorrel.cz - sorrel.d/2],
  ['SE', sorrel.cx + sorrel.w/2, sorrel.cz - sorrel.d/2],
  ['NW', sorrel.cx - sorrel.w/2, sorrel.cz + sorrel.d/2],
  ['NE', sorrel.cx + sorrel.w/2, sorrel.cz + sorrel.d/2],
  ['C', sorrel.cx, sorrel.cz],
] as const) {
  console.log(`  ${label} (${x.toFixed(2)},${z.toFixed(2)}) walkable=${isPointWalkable(x, z, 0.48)}`);
}
