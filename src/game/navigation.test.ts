import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NAV_EDGES,
  NAV_NODES,
  computeSeparationVector,
  computeWaypointPath,
  hasLineOfSight,
} from './navigation';
import {
  RESIDENT_EXTRA_ACTIVITIES,
  RESIDENT_ORDER,
  getResidentScheduleSlot,
} from './residents';
import { distance2D, isPointWalkable } from './worldMap';

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
  const pondWest = { x: -4.4, z: 13.8 }; // Toby morning at Mirror Pond Bank
  const eastWoodshop = { x: 7.5, z: 11.8 }; // Barnaby morning at Pinecone Woodshop
  const path = computeWaypointPath(pondWest, eastWoodshop, 0.38);

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
      const path = computeWaypointPath(fromSlot.target, toSlot.target, 0.38);
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
      const path = computeWaypointPath(start, act.target, 0.38);
      assert.ok(path.length >= 1);
    }
  }
});
