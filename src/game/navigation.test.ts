import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NAV_EDGES,
  NAV_NODES,
  computeSeparationVector,
  computeWaypointPath,
  findNearestNavNode,
  hasLineOfSight,
} from './navigation';
import {
  RESIDENT_EXTRA_ACTIVITIES,
  RESIDENT_ORDER,
  getResidentScheduleSlot,
} from './residents';
import {
  LANDMARK_ZONES,
  PROP_INTERACTABLES,
  distance2D,
  getPropInteractionMetrics,
  isPointWalkable,
} from './worldMap';

test('all navigation graph nodes and edges are strictly walkable with actor clearance', () => {
  const byId = new Map(NAV_NODES.map((n) => [n.id, n]));
  assert.ok(NAV_NODES.length >= 26);

  for (const node of NAV_NODES) {
    assert.equal(
      isPointWalkable(node.pos.x, node.pos.z, 0.42),
      true,
      `NavNode ${node.id} (${node.pos.x}, ${node.pos.z}) must be walkable`,
    );
  }

  for (const [aId, bId] of NAV_EDGES) {
    const a = byId.get(aId);
    const b = byId.get(bId);
    assert.ok(a, `Missing nav node ${aId}`);
    assert.ok(b, `Missing nav node ${bId}`);
    assert.equal(
      hasLineOfSight(a.pos, b.pos, 0.42),
      true,
      `NavEdge ${aId} <-> ${bId} must have unobstructed line of sight`,
    );
  }
});

test('navigation graph forms a single connected component', () => {
  const adj = new Map<string, string[]>();
  for (const n of NAV_NODES) adj.set(n.id, []);
  for (const [a, b] of NAV_EDGES) {
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  }

  const visited = new Set<string>();
  const queue = [NAV_NODES[0].id];
  visited.add(NAV_NODES[0].id);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of adj.get(cur) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  assert.equal(visited.size, NAV_NODES.length);
});

test('A* routes cleanly around Mirror Pond and central obstacles without cutting corners', () => {
  const pondWest = { x: -4.6, z: 12.2 }; // Toby morning at West Brook Bank (Slice W1)
  const eastWoodshop = { x: 7.5, z: 11.8 }; // Barnaby morning at Pinecone Woodshop
  const path = computeWaypointPath(pondWest, eastWoodshop, 0.38)!;
  assert.ok(path, 'computeWaypointPath returned null for a reachable goal (G-8 null-return adaptation)');

  assert.ok(path.length >= 2, 'Should route via bridge/south or plaza nodes around Mirror Pond');

  let prev = pondWest;
  for (const wp of path) {
    assert.equal(isPointWalkable(wp.x, wp.z, 0.38), true, `Waypoint (${wp.x}, ${wp.z}) walkable`);
    assert.equal(
      hasLineOfSight(prev, wp, 0.35),
      true,
      `Segment (${prev.x},${prev.z}) -> (${wp.x},${wp.z}) must stay clear of pond_water`,
    );
    prev = wp;
  }
  assert.ok(distance2D(path[path.length - 1], eastWoodshop) < 0.05);
});

test('all resident schedule transitions and reconciled slots produce valid walkable paths', () => {
  const phases = ['morning', 'afternoon', 'golden', 'dusk'] as const;
  for (const id of RESIDENT_ORDER) {
    for (let i = 0; i < phases.length; i++) {
      const fromSlot = getResidentScheduleSlot(id, phases[i], false);
      const toSlot = getResidentScheduleSlot(id, phases[(i + 1) % phases.length], false);
      const path = computeWaypointPath(fromSlot.target, toSlot.target, 0.38)!;
      assert.ok(path.length >= 1);
      for (const wp of path) {
        assert.equal(isPointWalkable(wp.x, wp.z, 0.35), true);
      }
    }
  }

  for (const id of ['clara', 'arthur'] as const) {
    const slot = getResidentScheduleSlot(id, 'golden', true);
    assert.equal(isPointWalkable(slot.target.x, slot.target.z, 0.38), true);
  }
});

test('actor separation pushes nearby NPCs apart cleanly', () => {
  const push = computeSeparationVector({ x: 0, z: 0 }, [{ x: 0.4, z: 0 }], 0.95);
  assert.ok(push.x < -0.5);
  assert.equal(Math.abs(push.z) < 0.001, true);
});

test('all autonomous resident extra activities are walkable and A*-reachable', () => {
  for (const id of RESIDENT_ORDER) {
    const start = getResidentScheduleSlot(id, 'morning', false).target;
    for (const act of RESIDENT_EXTRA_ACTIVITIES[id]) {
      assert.equal(
        isPointWalkable(act.target.x, act.target.z, 0.38),
        true,
        `Activity ${act.id} (${act.target.x}, ${act.target.z}) must be walkable`,
      );
      const path = computeWaypointPath(start, act.target, 0.38)!;
      assert.ok(path.length >= 1);
    }
  }
});

// ---------------------------------------------------------------------------
// WP-1 guard tests (world-environment initiative, WQA-01/02/03/07):
// the graph historically validated only the NPC radius (0.38/0.42) while the
// player walks at 0.48 — the Foxglove Rise pinch and bridge corner-cut were
// invisible to the suite. These guards pin the player radius everywhere.
// ---------------------------------------------------------------------------

const PLAYER_RADIUS = 0.48;

test('every nav node stays walkable at the player radius (0.48)', () => {
  for (const node of NAV_NODES) {
    assert.equal(
      isPointWalkable(node.pos.x, node.pos.z, PLAYER_RADIUS),
      true,
      `NavNode ${node.id} (${node.pos.x}, ${node.pos.z}) must be walkable at player radius ${PLAYER_RADIUS}`,
    );
  }
});

test('every nav edge keeps line of sight at the player radius (0.48)', () => {
  const byId = new Map(NAV_NODES.map((n) => [n.id, n]));
  for (const [aId, bId] of NAV_EDGES) {
    const a = byId.get(aId)!;
    const b = byId.get(bId)!;
    assert.equal(
      hasLineOfSight(a.pos, b.pos, PLAYER_RADIUS),
      true,
      `NavEdge ${aId} <-> ${bId} must stay clear at player radius ${PLAYER_RADIUS}`,
    );
  }
});

test('every landmark zone center routes to every other at the player radius', () => {
  // Endpoint resolution: zone centers that sit inside their own building/feature
  // footprint (fountain basin, gazebo plinth, cottage walls...) use their nearest
  // nav node; walkable centers (plaza, wilds, orchard) route center-to-center.
  const endpointOf = (zoneId: string, x: number, z: number): { x: number; z: number } =>
    isPointWalkable(x, z, PLAYER_RADIUS) ? { x, z } : findNearestNavNode({ x, z }, PLAYER_RADIUS).pos;

  for (const fromZone of LANDMARK_ZONES) {
    for (const toZone of LANDMARK_ZONES) {
      if (fromZone.id === toZone.id) continue;
      const from = endpointOf(fromZone.id, fromZone.x, fromZone.z);
      const to = endpointOf(toZone.id, toZone.x, toZone.z);
      const path = computeWaypointPath(from, to, PLAYER_RADIUS);
      assert.ok(path, 'computeWaypointPath returned null for a reachable goal (G-8 null-return adaptation)');
      assert.ok(
        path.length >= 1,
        `No path from ${fromZone.id} to ${toZone.id} at player radius`,
      );
      let prev = from;
      for (const wp of path) {
        assert.equal(
          isPointWalkable(wp.x, wp.z, PLAYER_RADIUS),
          true,
          `${fromZone.id} -> ${toZone.id}: waypoint (${wp.x.toFixed(2)}, ${wp.z.toFixed(2)}) unwalkable at player radius`,
        );
        prev = wp;
      }
      assert.ok(
        distance2D(path[path.length - 1], to) < 0.15,
        `${fromZone.id} -> ${toZone.id} path must terminate at target`,
      );
    }
  }
});

test('rise deck, bridge deck and west lawn are reachable at the player radius', () => {
  const plaza = { x: -3.6, z: 1.5 }; // plaza_west node
  const targets: Array<[string, { x: number; z: number }]> = [
    ['foxglove rise deck', { x: 21.85, z: 18.65 }],
    ['bridge deck mid', { x: -2.9, z: 14.0 }],
    ['west far lawn north', { x: -22.0, z: -6.5 }],
    ['west south lawn', { x: -22.0, z: 15.5 }],
    ['orchard south fringe', { x: -4.9, z: -21.8 }],
    // Stage 3 v1.1 (Slice W1): the West Brook fishing bank is reachable on foot
    // from the stream's north bank.
    ['west brook bank', { x: -5.5, z: 12.35 }],
  ];
  for (const [label, to] of targets) {
    const path = computeWaypointPath(plaza, to, PLAYER_RADIUS);
    assert.ok(path, 'computeWaypointPath returned null for a reachable goal (G-8 null-return adaptation)');
    let prev = plaza;
    for (const wp of path) {
      assert.equal(
        isPointWalkable(wp.x, wp.z, PLAYER_RADIUS),
        true,
        `${label}: waypoint (${wp.x.toFixed(2)}, ${wp.z.toFixed(2)}) unwalkable`,
      );
      prev = wp;
    }
    assert.ok(distance2D(path[path.length - 1], to) < 0.15, `${label} path must terminate at target`);
  }
});

test('door, mailbox and driftwood stand spots are walkable at the player radius', () => {
  const standSpots: Array<[string, number, number]> = [
    ['bakery_door', -12.4, -6.75],
    ['copperwheel_door', 13.1, -7.55],
    ['player_mailbox approach', -9.0, 7.2],
    ['pond_driftwood approach', 7.4, 15.1],
    // Stage 3 v1.1 (Slice W1): West Brook Bank — the second fishing stand spot
    // on the stream's north bank. Must stay clear of the rail band, the stream
    // and the hollow oak.
    ['west_brook_bank stand', -5.5, 12.35],
    // Slice W1: the relocated nav lane nodes stay walkable (brook reroute).
    ['pond_bank_sw reroute', -5.0, 12.2],
    ['bridge_north reroute', -4.65, 11.45],
    ['rail_corner_sw relief', -4.35, 16.9],
  ];
  for (const [label, x, z] of standSpots) {
    assert.equal(
      isPointWalkable(x, z, PLAYER_RADIUS),
      true,
      `${label} stand spot (${x}, ${z}) must be walkable at player radius`,
    );
  }
  // The metrics layer must steer walkers to those same clear stand spots.
  for (const propId of ['player_mailbox', 'pond_driftwood', 'bakery_door', 'copperwheel_door'] as const) {
    const metrics = getPropInteractionMetrics(propId, { x: 0, z: 0 });
    assert.equal(
      isPointWalkable(metrics.approachPos.x, metrics.approachPos.z, PLAYER_RADIUS),
      true,
      `${propId} approachPos (${metrics.approachPos.x}, ${metrics.approachPos.z}) must be walkable`,
    );
  }
  // Tap proxies stay glued to their visuals: every prop def keeps an in-reach focus
  // target (gazebo_bell legitimately looks 2.7 m deeper at the spire — cap at 3.0).
  for (const prop of PROP_INTERACTABLES) {
    const metrics = getPropInteractionMetrics(prop.id, { x: prop.x, z: prop.z });
    assert.ok(
      distance2D(metrics.focusPos, { x: prop.x, z: prop.z }) <= 3.0,
      `${prop.id} focusPos drifted from its tap proxy`,
    );
  }
});
