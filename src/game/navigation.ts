import { Vec2 } from './types';
import {
  distance2D,
  isPointWalkable,
  resolveMovement,
} from './worldMap';

export interface NavNode {
  id: string;
  pos: Vec2;
}

export const NAV_NODES: readonly NavNode[] = [
  // West lane & Willow Step
  { id: 'bakery_porch', pos: { x: -8.0, z: -6.5 } },
  { id: 'west_north', pos: { x: -10.0, z: -5.2 } },
  { id: 'book_nook_door', pos: { x: -10.2, z: -0.8 } },
  { id: 'west_mid', pos: { x: -9.5, z: 4.0 } },
  { id: 'willow_mailbox', pos: { x: -8.8, z: 6.8 } },
  { id: 'willow_porch', pos: { x: -8.5, z: 9.8 } },
  { id: 'pond_west_top', pos: { x: -5.2, z: 9.8 } },
  // Slice W1: moved west/out of the old rail-adjacent slot — the node now sits
  // on the brook's north-bank lane (west_brook_run blocks the old south lane).
  { id: 'bridge_north', pos: { x: -4.65, z: 11.45 } },
  { id: 'pond_bank_sw', pos: { x: -5.0, z: 12.2 } },
  // Cedar bridge deck lane (WP-1/WQA-02; compressed to the Slice W1 arch span
  // z 12.25..15.75 — walkable strip x -3.40..-2.68 between rail + pond boxes).
  // Entry node sits NORTH of the rail band (z < 11.24 inflated) so the
  // pond_west_top -> entry leg keeps line of sight at the player radius.
  { id: 'bridge_deck_entry_n', pos: { x: -2.9, z: 10.9 } },
  { id: 'bridge_deck_north', pos: { x: -2.9, z: 12.9 } },
  { id: 'bridge_deck_mid', pos: { x: -2.9, z: 14.0 } },
  { id: 'bridge_deck_south', pos: { x: -2.9, z: 15.2 } },
  { id: 'bridge_deck_exit_s', pos: { x: -2.9, z: 16.4 } },
  // West-bank lane corner relief (WP-1/WQA-02): keeps the pond_south_w leg clear of the
  // rail's south-west inflated corner (z 16.76).
  { id: 'rail_corner_sw', pos: { x: -4.35, z: 16.9 } },
  { id: 'pond_south_w', pos: { x: -4.0, z: 17.8 } },

  // North promenade & Plaza north
  { id: 'gazebo_west', pos: { x: -3.6, z: -6.5 } },
  { id: 'gazebo_east', pos: { x: 3.6, z: -6.5 } },
  { id: 'gazebo_nw', pos: { x: -3.8, z: -12.6 } },
  { id: 'gazebo_north', pos: { x: 0.0, z: -13.2 } },
  { id: 'gazebo_ne', pos: { x: 3.8, z: -12.6 } },
  { id: 'plaza_nw', pos: { x: -3.4, z: -2.6 } },
  { id: 'plaza_ne', pos: { x: 3.0, z: -2.6 } },

  // Fern Hollow Orchard (north district)
  { id: 'orchard_gate', pos: { x: -2.4, z: -13.9 } },
  { id: 'orchard_south', pos: { x: -2.3, z: -17.1 } },
  // Nudged north-east (WP-1): keeps the orchard_south leg clear of orchard_tree_mid.
  { id: 'orchard_west', pos: { x: -6.35, z: -17.15 } },
  { id: 'orchard_bench', pos: { x: -9.2, z: -20.0 } },
  { id: 'orchard_east', pos: { x: 3.8, z: -18.6 } },
  // Orchard south fringe (WP-1/WQA-03): covers the previously unreachable strip south of
  // the tree rows. A hook node east of orchard_ladder keeps both legs clear of the
  // ladder/crates obstacle corridor.
  { id: 'orchard_south_hook', pos: { x: -5.0, z: -19.2 } },
  { id: 'orchard_south_fr', pos: { x: -4.9, z: -21.8 } },

  // Plaza flanks & South promenade
  { id: 'plaza_west', pos: { x: -3.6, z: 1.5 } },
  { id: 'plaza_east', pos: { x: 3.6, z: 1.5 } },
  { id: 'plaza_sw', pos: { x: -3.2, z: 5.2 } },
  { id: 'plaza_se', pos: { x: 3.0, z: 5.2 } },
  { id: 'south_prom_mid', pos: { x: 0.0, z: 7.2 } },

  // East lane & Pond east
  { id: 'copperwheel_yard', pos: { x: 8.4, z: -7.2 } },
  { id: 'east_north', pos: { x: 8.2, z: -3.5 } },
  { id: 'greenhouse_walk', pos: { x: 8.6, z: 2.0 } },
  { id: 'east_south_mid', pos: { x: 7.6, z: 7.2 } },
  { id: 'barnaby_yard', pos: { x: 7.4, z: 11.4 } },
  { id: 'pond_south_e', pos: { x: 7.2, z: 17.8 } },

  // The Wild Hollows — east: Marigold Lane & Foxglove Rise (Build 10)
  { id: 'greenhouse_ne', pos: { x: 18.6, z: -3.0 } },
  { id: 'marigold_north', pos: { x: 19.4, z: 1.2 } },
  { id: 'marigold_bank', pos: { x: 20.3, z: 3.3 } },
  { id: 'marigold_mid', pos: { x: 20.6, z: 9.0 } },
  { id: 'marigold_south', pos: { x: 20.9, z: 14.0 } },
  { id: 'rise_base', pos: { x: 21.3, z: 16.3 } },
  // Moved onto the deck's walkable east strip (WP-1/WQA-01) — the former (21.6, 18.45)
  // sat inside the ramp-mound inflated shadow at player radius.
  { id: 'rise_deck', pos: { x: 21.85, z: 18.65 } },

  // The Wild Hollows — south-west: Sorrel Hollow trail (Build 10)
  { id: 'wilds_w1', pos: { x: -9.0, z: 18.3 } },
  { id: 'wilds_w2', pos: { x: -13.5, z: 18.4 } },
  { id: 'wilds_w3', pos: { x: -17.5, z: 18.2 } },
  { id: 'sorrel_hollow', pos: { x: -19.6, z: 18.9 } },

  // West-margin lawn nodes (WP-1/WQA-03): shrink the walkable-but-unroutable ghost band
  // along x -25..-17 (book_nook/cottage facades block direct LOS to town lanes).
  { id: 'west_far_n', pos: { x: -22.0, z: -6.5 } },
  { id: 'west_bakery_lawn', pos: { x: -20.0, z: -10.5 } },
  { id: 'west_far_s', pos: { x: -22.0, z: 10.0 } },
  { id: 'west_south_lawn', pos: { x: -22.0, z: 15.5 } },

  // The Wild Hollows — north-east: The Bee Line (Build 10)
  { id: 'beeline_w', pos: { x: 7.4, z: -17.9 } },
  { id: 'beeline_mid', pos: { x: 10.4, z: -18.7 } },
  { id: 'beeline_e', pos: { x: 14.2, z: -18.8 } },
  { id: 'beeline_corner', pos: { x: 17.9, z: -16.2 } },
  { id: 'copperwheel_ne', pos: { x: 18.1, z: -12.0 } },
  { id: 'copperwheel_east', pos: { x: 17.9, z: -6.6 } },
] as const;

export const NAV_EDGES: ReadonlyArray<readonly [string, string]> = [
  // West lane spine
  ['bakery_porch', 'west_north'],
  ['bakery_porch', 'gazebo_west'],
  ['west_north', 'book_nook_door'],
  ['book_nook_door', 'west_mid'],
  ['book_nook_door', 'plaza_west'],
  ['west_mid', 'willow_mailbox'],
  ['west_mid', 'plaza_sw'],
  ['willow_mailbox', 'willow_porch'],
  ['willow_mailbox', 'south_prom_mid'],
  ['willow_porch', 'pond_west_top'],
  ['pond_west_top', 'bridge_north'],
  ['pond_west_top', 'south_prom_mid'],
  // Slice W1: the brook's north-bank lane links the west lane to the bridge
  // head AND keeps pond_bank_sw reachable after west_brook_run blocked the
  // old south-bank corner route.
  ['pond_west_top', 'pond_bank_sw'],
  ['bridge_north', 'pond_bank_sw'],
  // Cedar bridge deck chain (WP-1/WQA-02; Slice W1 span z 12.25..15.75)
  ['pond_west_top', 'bridge_deck_entry_n'],
  ['bridge_deck_entry_n', 'bridge_deck_north'],
  ['bridge_deck_north', 'bridge_deck_mid'],
  ['bridge_deck_mid', 'bridge_deck_south'],
  ['bridge_deck_south', 'bridge_deck_exit_s'],
  ['bridge_deck_exit_s', 'pond_south_w'],
  // West-bank lane corner relief (WP-1/WQA-02) — Slice W1: pond_bank_sw now
  // reaches the corner from the NORTH side (brook blocks the direct leg), so
  // rail_corner_sw is fed from pond_south_w only.
  ['rail_corner_sw', 'pond_south_w'],
  ['pond_south_w', 'pond_south_e'],

  // North promenade & Gazebo ring
  ['gazebo_west', 'gazebo_east'],
  ['gazebo_west', 'plaza_nw'],
  ['gazebo_east', 'plaza_ne'],
  ['gazebo_east', 'copperwheel_yard'],
  ['gazebo_west', 'gazebo_nw'],
  ['gazebo_nw', 'gazebo_north'],
  ['gazebo_north', 'gazebo_ne'],
  ['gazebo_ne', 'gazebo_east'],

  // Fern Hollow Orchard links
  ['gazebo_north', 'orchard_gate'],
  ['orchard_gate', 'orchard_south'],
  ['orchard_south', 'orchard_west'],
  ['orchard_south', 'orchard_east'],
  ['orchard_west', 'orchard_bench'],
  ['orchard_west', 'orchard_south_hook'],
  ['orchard_south_hook', 'orchard_south_fr'],

  // Plaza perimeter around Fountain
  ['plaza_nw', 'plaza_ne'],
  ['plaza_nw', 'plaza_west'],
  ['plaza_ne', 'plaza_east'],
  ['plaza_west', 'plaza_sw'],
  ['plaza_east', 'plaza_se'],
  ['plaza_sw', 'south_prom_mid'],
  ['plaza_se', 'south_prom_mid'],
  ['plaza_sw', 'plaza_se'],

  // East lane spine
  ['copperwheel_yard', 'east_north'],
  ['east_north', 'gazebo_east'],
  ['east_north', 'greenhouse_walk'],
  ['greenhouse_walk', 'plaza_east'],
  ['greenhouse_walk', 'east_south_mid'],
  ['east_south_mid', 'south_prom_mid'],
  ['east_south_mid', 'plaza_se'],
  ['east_south_mid', 'barnaby_yard'],
  ['barnaby_yard', 'pond_south_e'],

  // The Wild Hollows — Marigold Lane & Foxglove Rise loop (Build 10)
  ['east_north', 'greenhouse_ne'],
  ['greenhouse_ne', 'marigold_north'],
  ['marigold_north', 'marigold_bank'],
  ['marigold_bank', 'marigold_mid'],
  ['marigold_mid', 'marigold_south'],
  ['marigold_south', 'rise_base'],
  ['rise_base', 'rise_deck'],

  // The Wild Hollows — Sorrel Hollow trail (Build 10)
  ['pond_south_w', 'wilds_w1'],
  ['wilds_w1', 'wilds_w2'],
  ['wilds_w2', 'wilds_w3'],
  ['wilds_w3', 'sorrel_hollow'],

  // West-margin lawn (WP-1/WQA-03): the z ≈ -6.5 lane threads between the book nook and
  // bakery footprints; the south lawn chains around the cottage to the Sorrel trail.
  ['west_far_n', 'bakery_porch'],
  ['west_far_n', 'west_bakery_lawn'],
  ['west_far_s', 'west_south_lawn'],
  ['west_south_lawn', 'wilds_w1'],

  // The Wild Hollows — Bee Line & Copperwheel east return (Build 10)
  ['orchard_east', 'beeline_w'],
  ['beeline_w', 'beeline_mid'],
  ['beeline_mid', 'beeline_e'],
  ['beeline_e', 'beeline_corner'],
  ['beeline_corner', 'copperwheel_ne'],
  ['copperwheel_ne', 'copperwheel_east'],
  ['copperwheel_east', 'east_north'],
] as const;

const nodeById = new Map<string, NavNode>();
const adjacency = new Map<string, string[]>();

/** Bounded diagnostic counter for the A*-exhaustion warning (WP-1/WQA-04). */
let exhaustionWarnings = 0;

for (const node of NAV_NODES) {
  nodeById.set(node.id, node);
  adjacency.set(node.id, []);
}
for (const [a, b] of NAV_EDGES) {
  adjacency.get(a)?.push(b);
  adjacency.get(b)?.push(a);
}

/**
 * Checks obstacle-free straight segment walkability between two points.
 */
export function hasLineOfSight(from: Vec2, to: Vec2, actorRadius = 0.38): boolean {
  const dist = distance2D(from, to);
  if (dist < 0.05) return isPointWalkable(to.x, to.z, actorRadius);

  const steps = Math.max(2, Math.ceil(dist / 0.35));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;
    if (!isPointWalkable(x, z, actorRadius)) {
      return false;
    }
  }
  return true;
}

export function findNearestNavNode(pos: Vec2, actorRadius = 0.38): NavNode {
  let bestLos: NavNode | null = null;
  let bestLosDist = Infinity;
  let bestAny = NAV_NODES[0];
  let bestAnyDist = Infinity;

  for (const node of NAV_NODES) {
    const d = distance2D(pos, node.pos);
    if (d < bestAnyDist) {
      bestAnyDist = d;
      bestAny = node;
    }
    if (d < bestLosDist && hasLineOfSight(pos, node.pos, actorRadius)) {
      bestLosDist = d;
      bestLos = node;
    }
  }

  return bestLos ?? bestAny;
}

/**
 * Computes a deterministic walkable waypoint path using A* over NAV_NODES,
 * with a zero-overhead line-of-sight fast path and collinear smoothing.
 */
export function computeWaypointPath(from: Vec2, to: Vec2, actorRadius = 0.38): Vec2[] | null {
  if (distance2D(from, to) <= 0.15) {
    return [{ x: to.x, z: to.z }];
  }

  if (hasLineOfSight(from, to, actorRadius)) {
    return [{ x: to.x, z: to.z }];
  }

  const startNode = findNearestNavNode(from, actorRadius);
  const goalNode = findNearestNavNode(to, actorRadius);

  if (startNode.id === goalNode.id) {
    return [
      { x: startNode.pos.x, z: startNode.pos.z },
      { x: to.x, z: to.z },
    ];
  }

  const open = new Set<string>([startNode.id]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();

  for (const node of NAV_NODES) {
    gScore.set(node.id, Infinity);
    fScore.set(node.id, Infinity);
  }
  gScore.set(startNode.id, 0);
  fScore.set(startNode.id, distance2D(startNode.pos, goalNode.pos));

  while (open.size > 0) {
    let currentId: string | null = null;
    let bestF = Infinity;
    for (const candidate of open) {
      const f = fScore.get(candidate) ?? Infinity;
      if (f < bestF || (f === bestF && currentId !== null && candidate < currentId)) {
        bestF = f;
        currentId = candidate;
      }
    }

    if (!currentId) break;
    if (currentId === goalNode.id) {
      const nodeChain: Vec2[] = [];
      let cursor: string | undefined = currentId;
      while (cursor) {
        const n = nodeById.get(cursor);
        if (n) nodeChain.push({ x: n.pos.x, z: n.pos.z });
        cursor = cameFrom.get(cursor);
      }
      nodeChain.reverse();

      // Prune redundant start node if already close or direct LOS to second node
      const fullPath: Vec2[] = [...nodeChain, { x: to.x, z: to.z }];
      const smoothed: Vec2[] = [];
      let anchor: Vec2 = from;
      for (let i = 0; i < fullPath.length; i++) {
        if (
          i < fullPath.length - 1 &&
          hasLineOfSight(anchor, fullPath[i + 1], actorRadius)
        ) {
          continue;
        }
        smoothed.push(fullPath[i]);
        anchor = fullPath[i];
      }
      return smoothed.length > 0 ? smoothed : [{ x: to.x, z: to.z }];
    }

    open.delete(currentId);
    const currentPos = nodeById.get(currentId)!.pos;
    const neighbors = adjacency.get(currentId) ?? [];

    for (const neighborId of neighbors) {
      const neighborPos = nodeById.get(neighborId)!.pos;
      const tentativeG = (gScore.get(currentId) ?? Infinity) + distance2D(currentPos, neighborPos);
      if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
        cameFrom.set(neighborId, currentId);
        gScore.set(neighborId, tentativeG);
        fScore.set(neighborId, tentativeG + distance2D(neighborPos, goalNode.pos));
        open.add(neighborId);
      }
    }
  }

  // Overhaul G-8: an unreachable goal no longer fabricates a direct-line
  // waypoint (residents beelined into walls before the watchdog bailed) —
  // return null and let callers fall back to an idle.
  return null;
}

/**
 * Computes soft actor-to-actor separation vector so NPCs do not stack directly on top of one another.
 */
export function computeSeparationVector(
  actorPos: Vec2,
  otherPositions: readonly Vec2[],
  minDist = 0.95,
): Vec2 {
  let pushX = 0;
  let pushZ = 0;
  for (let i = 0; i < otherPositions.length; i++) {
    const other = otherPositions[i];
    const dx = actorPos.x - other.x;
    const dz = actorPos.z - other.z;
    const dSq = dx * dx + dz * dz;
    if (dSq > 0.0001 && dSq < minDist * minDist) {
      const d = Math.sqrt(dSq);
      const strength = (minDist - d) / minDist;
      pushX += (dx / d) * strength;
      pushZ += (dz / d) * strength;
    }
  }
  return { x: pushX, z: pushZ };
}

export function stepAlongWaypoints(
  pos: Vec2,
  waypoints: Vec2[],
  speedPerSec: number,
  dt: number,
  separation: Vec2,
  actorRadius = 0.38,
): { nextPos: Vec2; movedDist: number; moveDirX: number; moveDirZ: number; arrived: boolean } {
  if (waypoints.length === 0) {
    return { nextPos: pos, movedDist: 0, moveDirX: 0, moveDirZ: 0, arrived: true };
  }

  while (waypoints.length > 0 && distance2D(pos, waypoints[0]) <= 0.2) {
    waypoints.shift();
  }

  if (waypoints.length === 0) {
    return { nextPos: pos, movedDist: 0, moveDirX: 0, moveDirZ: 0, arrived: true };
  }

  const wp = waypoints[0];
  const dx = wp.x - pos.x;
  const dz = wp.z - pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.001) {
    return { nextPos: pos, movedDist: 0, moveDirX: 0, moveDirZ: 0, arrived: waypoints.length <= 1 };
  }

  const stepDist = Math.min(dist, speedPerSec * dt);
  let dirX = dx / dist + separation.x * 0.35;
  let dirZ = dz / dist + separation.z * 0.35;
  const dirLen = Math.hypot(dirX, dirZ) || 1;
  dirX /= dirLen;
  dirZ /= dirLen;

  const desired: Vec2 = {
    x: pos.x + dirX * stepDist,
    z: pos.z + dirZ * stepDist,
  };
  const nextPos = resolveMovement(pos, desired, actorRadius);
  const movedDist = distance2D(pos, nextPos);
  return {
    nextPos,
    movedDist,
    moveDirX: dirX,
    moveDirZ: dirZ,
    arrived: false,
  };
}
