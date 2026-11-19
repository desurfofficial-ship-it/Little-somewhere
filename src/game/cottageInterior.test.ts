import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BOX_OBSTACLES,
  CIRCLE_OBSTACLES,
  COTTAGE_INTERIOR_OFF_RECT,
  COTTAGE_INTERIOR_ON_RECT,
  COTTAGE_INTERIOR_PLATEAU,
  COTTAGE_PORCH_PLATEAU,
  COTTAGE_STEP_PLATEAU,
  getGroundHeightAt,
  getPropInteractionMetrics,
  isPlayerInCottageInterior,
  isPointWalkable,
  PROP_INTERACTABLES,
} from './worldMap';
import { NAV_NODES, computeWaypointPath, hasLineOfSight } from './navigation';
import { interactWithProp } from './actions';
import { createFreshWorldState } from './storage';

const nodePos = (id: string) => {
  const n = NAV_NODES.find((nn) => nn.id === id);
  assert.ok(n, `nav node ${id} must exist`);
  return n.pos;
};

test('cottage walls enclose the room with exactly one east doorway gap', () => {
  const wallIds = BOX_OBSTACLES.map((b) => b.id);
  for (const id of [
    'cottage_wall_west',
    'cottage_wall_north',
    'cottage_wall_south',
    'cottage_wall_east_north',
    'cottage_wall_east_south',
  ]) {
    assert.ok(wallIds.includes(id), `missing wall obstacle ${id}`);
  }

  const eastN = BOX_OBSTACLES.find((b) => b.id === 'cottage_wall_east_north')!;
  const eastS = BOX_OBSTACLES.find((b) => b.id === 'cottage_wall_east_south')!;
  // Doorway gap between the two east wall segments admits a 0.84-wide actor
  const gapProbeZ = (eastN.maxZ + eastS.minZ) / 2;
  assert.equal(eastN.maxZ, 9.3);
  assert.equal(eastS.minZ, 10.7);
  assert.ok(
    isPointWalkable(-12.85, gapProbeZ, 0.42),
    'doorway gap must admit an actor of radius 0.42 (0.84 wide)',
  );
  // And the LOS probe radius used by A* must pass too
  assert.ok(isPointWalkable(-12.85, gapProbeZ, 0.38));
});

test('interior room core is walkable while walls and furniture block solid mass', () => {
  assert.ok(isPointWalkable(-15.0, 10.0, 0.48), 'room center must be walkable');
  assert.ok(isPointWalkable(-15.5, 9.3, 0.48), 'bedside spot must be walkable');
  assert.ok(isPointWalkable(-16.0, 11.25, 0.48), 'hearth spot must be walkable');
  assert.ok(isPointWalkable(-11.75, 10.0, 0.48), 'porch deck must be walkable');

  // Solid mass is blocked
  assert.ok(!isPointWalkable(-12.85, 8.5, 0.48), 'east wall band must block');
  assert.ok(!isPointWalkable(-15.0, 7.75, 0.48), 'north wall band must block');
  assert.ok(!isPointWalkable(-16.65, 8.75, 0.48), 'bed footprint must block');
  assert.ok(!isPointWalkable(-16.9, 11.25, 0.48), 'hearth footprint must block');
  assert.ok(!isPointWalkable(-14.35, 11.15, 0.48), 'table footprint must block');
  assert.ok(!isPointWalkable(-13.85, 8.2, 0.48), 'kitchenette footprint must block');
  assert.ok(!isPointWalkable(-11.25, 8.6, 0.48), 'porch north rail must block');
});

test('walls block sightlines; the doorway restores them', () => {
  // From the lane north of the door line to the room: blocked by the east wall
  assert.ok(!hasLineOfSight({ x: -9.5, z: 7.5 }, { x: -14.2, z: 10.0 }, 0.38));
  // Through the doorway: porch -> room stays clear
  assert.ok(hasLineOfSight(nodePos('cottage_porch'), nodePos('cottage_door'), 0.38));
  assert.ok(hasLineOfSight(nodePos('cottage_door'), nodePos('cottage_room'), 0.38));
  // South lawn -> room blocked by the south wall
  assert.ok(!hasLineOfSight({ x: -15.0, z: 13.6 }, { x: -15.0, z: 10.2 }, 0.38));
});

test('A* reaches the furnished room, bedside and hearth from the public lane', () => {
  const start = nodePos('south_prom_mid');
  for (const goalId of ['cottage_room', 'cottage_bedside', 'cottage_hearth']) {
    const path = computeWaypointPath(start, nodePos(goalId), 0.38);
    assert.ok(path.length >= 2, `path to ${goalId} must exist`);
    // Every leg stays LOS-clear (0.38 probe, matching NPC/A* movement)
    let cursor = start;
    for (const wp of path) {
      assert.ok(
        hasLineOfSight(cursor, wp, 0.38),
        `path leg to ${goalId} must be LOS-clear: ${JSON.stringify(cursor)} -> ${JSON.stringify(wp)}`,
      );
      cursor = wp;
    }
    const last = path[path.length - 1];
    assert.ok(
      isPointWalkable(last.x, last.z, 0.48),
      `path endpoint into ${goalId} must be walkable for the player`,
    );
  }
});

test('cottage plateaus: hard porch/room floors and a smooth entry ramp', () => {
  assert.equal(getGroundHeightAt(0, 0), 0, 'open lawn stays at ground level');

  // Interior floor plateau (0.46) and porch deck plateau (0.42) are hard
  assert.equal(getGroundHeightAt(-15.0, 10.0), COTTAGE_INTERIOR_PLATEAU.height);
  assert.equal(getGroundHeightAt(-11.75, 10.0), COTTAGE_PORCH_PLATEAU.height);

  // Entry ramp descends smoothly from deck level to lawn along +x
  const ramp = [-11.4, -11.0, -10.8, -10.6, -10.45, -10.3].map((x) => getGroundHeightAt(x, 10.0));
  assert.ok(ramp[0] > 0.4, `ramp starts at deck height, got ${ramp[0]}`);
  for (let i = 1; i < ramp.length; i++) {
    assert.ok(ramp[i] <= ramp[i - 1] + 1e-9, 'entry ramp must descend monotonically');
  }
  assert.ok(ramp[ramp.length - 1] < 0.01, 'ramp reaches lawn east of the step');
  const midRamp = getGroundHeightAt(-10.95, 10.0);
  assert.ok(midRamp > 0.2 && midRamp < 0.42, `mid-ramp eased height, got ${midRamp}`);

  // Ramp shoulder fades quickly north/south of the stair gap
  const shoulder = getGroundHeightAt(-10.95, 8.9);
  assert.ok(shoulder >= 0 && shoulder < 0.3, `soft shoulder, got ${shoulder}`);
  assert.equal(getGroundHeightAt(-10.95, 7.5), 0, 'lawn beyond the shoulder is flat');

  // Bridge height logic untouched
  const bridgeH = getGroundHeightAt(-2.9, 14.0);
  assert.ok(bridgeH > 0.3, `bridge arch still elevated, got ${bridgeH}`);
});

test('interior-mode hysteresis: porch/room flip ON, full exit flips OFF', () => {
  // On the porch deck or inside the room: ON regardless of prior state
  assert.equal(isPlayerInCottageInterior(-11.75, 10.0, false), true);
  assert.equal(isPlayerInCottageInterior(-15.0, 10.0, false), true);
  assert.equal(isPlayerInCottageInterior(-10.9, 10.0, false), true, 'entry apron counts as ON');

  // Just outside the OFF rect (strolling the lane): OFF
  assert.equal(isPlayerInCottageInterior(-10.0, 10.0, false), false);

  // Hysteresis band (between ON and OFF rects): keeps prior state
  const bandX = (COTTAGE_INTERIOR_ON_RECT.maxX + COTTAGE_INTERIOR_OFF_RECT.maxX) / 2;
  assert.equal(isPlayerInCottageInterior(bandX, 10.0, true), true);
  assert.equal(isPlayerInCottageInterior(bandX, 10.0, false), false);
});

test('bed and hearth props: in range from their walkable spots with valid approaches', () => {
  const bedMetrics = getPropInteractionMetrics('player_bed', nodePos('cottage_bedside'));
  assert.equal(bedMetrics.inRange, true, 'bed reachable from bedside node');
  assert.ok(
    isPointWalkable(bedMetrics.approachPos.x, bedMetrics.approachPos.z, 0.48),
    'bed approach spot must be walkable',
  );

  const hearthMetrics = getPropInteractionMetrics('player_hearth', nodePos('cottage_hearth'));
  assert.equal(hearthMetrics.inRange, true, 'hearth reachable from hearth node');
  assert.ok(
    isPointWalkable(hearthMetrics.approachPos.x, hearthMetrics.approachPos.z, 0.48),
    'hearth approach spot must be walkable',
  );

  const doorMetrics = getPropInteractionMetrics('player_door', nodePos('cottage_porch'));
  assert.ok(
    isPointWalkable(doorMetrics.approachPos.x, doorMetrics.approachPos.z, 0.48),
    'door approach (doorway waypoint) must be walkable',
  );

  const bedProp = PROP_INTERACTABLES.find((p) => p.id === 'player_bed');
  const hearthProp = PROP_INTERACTABLES.find((p) => p.id === 'player_hearth');
  assert.ok(bedProp && hearthProp, 'bed & hearth registered as prop interactables');
});

test('interior prop interactions: bed rests, door and hearth give cozy flavor', () => {
  const world = createFreshWorldState();
  const bedResult = interactWithProp(world, 'player_bed');
  assert.equal(bedResult.actionType, 'rest_next_day');
  assert.equal(bedResult.actionLabel, 'Rest Until Morning');

  const doorOutside = interactWithProp(world, 'player_door');
  assert.equal(doorOutside.actionLabel, 'Step Inside');
  assert.equal(doorOutside.actionType, undefined);

  const insideWorld = { ...world, playerPos: { x: -15.0, z: 10.0 } };
  const doorInside = interactWithProp(insideWorld, 'player_door');
  assert.equal(doorInside.actionLabel, 'Step Outside');

  const hearthResult = interactWithProp(insideWorld, 'player_hearth');
  assert.equal(hearthResult.actionLabel, 'Warm Hands');
  assert.ok(hearthResult.title.includes('Hearth'));
});

test('all resident schedule targets remain walkable after the cottage rework', () => {
  // West-lane neighbors whose routes pass the reworked cottage footprints
  const claraDusk = { x: -9.0, z: -6.4 };
  assert.ok(isPointWalkable(claraDusk.x, claraDusk.z, 0.38));
  // The porch corridor from the lane keeps a clear 0.48-radius channel
  assert.ok(isPointWalkable(-11.3, 10.0, 0.48), 'porch entry channel');
  assert.ok(isPointWalkable(-12.2, 10.0, 0.48), 'porch deck channel');
});
