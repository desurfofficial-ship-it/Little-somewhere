/**
 * Probe: pick a lawful West Brook bank stand spot (Stage 3 fishing v1.1).
 *
 * Constraints (all verified against the live contracts, not eyeballed):
 *  1. isPointWalkable at the player radius (0.48) — outside every inflated box/circle.
 *  2. A* reachable from the plaza west node (the walk-then-interact path must exist).
 *  3. Within the culvert's visual neighborhood — the water (world x -3.58..-1.88,
 *     z 13.12..14.88) must sit inside the spot's interact radius so the cast reads true.
 *  4. Clear of the hollow-oak circle (-6.2, 15.6, r 1.35) by player radius.
 *  5. ≥ 0.9 u from every progression token anchor (progressionPresentation contract).
 *
 * Run: npx tsx scripts/probe_brook_spot.ts
 */
import { isPointWalkable, distance2D } from '../src/game/worldMap';
import { computeWaypointPath } from '../src/game/navigation';
import { PROP_INTERACTABLES } from '../src/game/worldMap';

const PLAYER_RADIUS = 0.48;
const PLAZA = { x: -3.6, z: 1.5 };

// Culvert water (world) — from vegetation.ts pondGroup local (-5.18..-3.48, ±0.88) + (1.6, 14.0).
const CULVERT_WATER = { minX: -3.58, maxX: -1.88, minZ: 13.12, maxZ: 14.88 };
const CULVERT_CENTER = { x: -2.73, z: 14.0 };

// progressionPresentation.test.ts token anchors (ground-level obstruction contract).
const TOKEN_ANCHORS: Array<[string, number, number]> = [
  ['clara', -9.05, -8.13],
  ['arthur', 14.05, -8.56],
  ['mina', 10.66, 3.2],
  ['jun', -9.8, 7.2],
  ['barnaby', 13.2, 15.52],
  ['sora', -4.78, -3.05],
  ['toby', 2.75, 19.3],
  ['nora', -12.68, -2.48],
  ['pip', -9.15, -10.68],
  ['rowan', -6.09, -20.35],
];

const CANDIDATES: Array<[number, number]> = [
  [-4.55, 14.35],
  [-4.65, 14.2],
  [-4.5, 14.6],
  [-4.45, 13.9],
  [-4.7, 13.8],
  [-4.4, 14.9],
  [-5.0, 14.35],
  [-4.3, 15.3],
  [-4.3, 13.5],
  [-4.85, 15.0],
];

for (const [x, z] of CANDIDATES) {
  const walkable = isPointWalkable(x, z, PLAYER_RADIUS);
  const path = computeWaypointPath(PLAZA, { x, z }, PLAYER_RADIUS);
  const pathOk = path !== null;
  const dWater = Math.hypot(
    Math.max(CULVERT_WATER.minX - x, 0, x - CULVERT_WATER.maxX),
    Math.max(CULVERT_WATER.minZ - z, 0, z - CULVERT_WATER.maxZ),
  );
  const dOak = Math.hypot(x - -6.2, z - 15.6);
  const nearestAnchor = TOKEN_ANCHORS.map(([id, ax, az]) => ({
    id,
    d: Math.hypot(x - ax, z - az),
  })).sort((a, b) => a.d - b.d)[0];
  const nearestProp = PROP_INTERACTABLES.map((p) => ({
    id: p.id,
    d: distance2D({ x, z }, { x: p.x, z: p.z }),
  }))
    .sort((a, b) => a.d - b.d)[0];

  console.log(
    `(${x}, ${z}) walkable=${walkable} reachable=${pathOk} waterDist=${dWater.toFixed(2)} ` +
      `hollowOakDist=${dOak.toFixed(2)} nearestAnchor=${nearestAnchor.id}@${nearestAnchor.d.toFixed(2)} ` +
      `nearestProp=${nearestProp.id}@${nearestProp.d.toFixed(2)}`,
  );
}
