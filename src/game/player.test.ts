import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAYER_RUN_SPEED,
  PLAYER_SPRINT_SPEED,
  PLAYER_WALK_SPEED,
  computeSitGroundY,
  createInitialPlayerMotion,
  selectBestInteractiveTarget,
  stepPlayerMovement,
} from './playerController';
import { computeWaypointPath, hasLineOfSight } from './navigation';
import {
  deliverHeldItemAction,
  pickupWorldPropAction,
  placeWorldPropAction,
  togglePlayerSitAction,
} from './actions';
import { RESIDENTS } from './residents';
import { createFreshWorldState } from './storage';
import {
  PLAYER_SPAWN,
  SEAT_SPOTS,
  getGroundHeightAt,
  getSeatById,
  isPointWalkable,
} from './worldMap';

test('player movement supports analog walk, run, sprint speeds, inertia, turn banking, and carry cap', () => {
  const startPos = { ...PLAYER_SPAWN };

  // Walk tier (partial stick deflection ~0.4)
  let walkMotion = createInitialPlayerMotion(startPos);
  let walkPos = { ...startPos };
  let walkFacing = 0;
  for (let i = 0; i < 30; i++) {
    const step = stepPlayerMovement({
      pos: walkPos,
      facing: walkFacing,
      motion: walkMotion,
      moveDirX: 1,
      moveDirZ: 0,
      inputMagnitude: 0.4,
      sprintHeld: false,
      carryingItem: false,
      posture: 'standing',
      seatId: null,
      dt: 0.033,
    });
    walkPos = step.pos;
    walkFacing = step.facing;
    walkMotion = step.motion;
  }
  assert.ok(walkMotion.speed > 2.2 && walkMotion.speed <= PLAYER_WALK_SPEED + 0.05);
  assert.equal(walkMotion.mode, 'walk');

  // Run tier (full stick deflection, no sprint)
  let runMotion = createInitialPlayerMotion(startPos);
  let runPos = { ...startPos };
  let runFacing = 0;
  // First step checks acceleration inertia (speed < target speed)
  const firstStep = stepPlayerMovement({
    pos: runPos,
    facing: runFacing,
    motion: runMotion,
    moveDirX: 1,
    moveDirZ: 0,
    inputMagnitude: 1.0,
    sprintHeld: false,
    carryingItem: false,
    posture: 'standing',
    seatId: null,
    dt: 0.025,
  });
  assert.ok(firstStep.motion.speed > 0 && firstStep.motion.speed < PLAYER_RUN_SPEED * 0.65);

  runPos = firstStep.pos;
  runFacing = firstStep.facing;
  runMotion = firstStep.motion;
  for (let i = 0; i < 30; i++) {
    const step = stepPlayerMovement({
      pos: runPos,
      facing: runFacing,
      motion: runMotion,
      moveDirX: 1,
      moveDirZ: 0,
      inputMagnitude: 1.0,
      sprintHeld: false,
      carryingItem: false,
      posture: 'standing',
      seatId: null,
      dt: 0.033,
    });
    runPos = step.pos;
    runFacing = step.facing;
    runMotion = step.motion;
  }
  assert.ok(runMotion.speed > PLAYER_WALK_SPEED + 0.8 && runMotion.speed <= PLAYER_RUN_SPEED + 0.05);
  assert.equal(runMotion.mode, 'run');

  // Deceleration inertia when releasing input
  const releaseStep = stepPlayerMovement({
    pos: runPos,
    facing: runFacing,
    motion: runMotion,
    moveDirX: 0,
    moveDirZ: 0,
    inputMagnitude: 0,
    sprintHeld: false,
    carryingItem: false,
    posture: 'standing',
    seatId: null,
    dt: 0.03,
  });
  assert.ok(releaseStep.motion.speed > 0 && releaseStep.motion.speed < runMotion.speed);

  let stopMotion = releaseStep.motion;
  let stopPos = releaseStep.pos;
  for (let i = 0; i < 40; i++) {
    const s = stepPlayerMovement({
      pos: stopPos,
      facing: runFacing,
      motion: stopMotion,
      moveDirX: 0,
      moveDirZ: 0,
      inputMagnitude: 0,
      sprintHeld: false,
      carryingItem: false,
      posture: 'standing',
      seatId: null,
      dt: 0.033,
    });
    stopPos = s.pos;
    stopMotion = s.motion;
  }
  assert.equal(stopMotion.speed, 0);
  assert.equal(stopMotion.mode, 'idle');

  // Sprint tier + sharp turn banking check
  let sprintMotion = createInitialPlayerMotion(startPos);
  let sprintPos = { ...startPos };
  let sprintFacing = 0;
  for (let i = 0; i < 30; i++) {
    const s = stepPlayerMovement({
      pos: sprintPos,
      facing: sprintFacing,
      motion: sprintMotion,
      moveDirX: 0.8,
      moveDirZ: -0.6,
      inputMagnitude: 1.0,
      sprintHeld: true,
      carryingItem: false,
      posture: 'standing',
      seatId: null,
      dt: 0.033,
    });
    sprintPos = s.pos;
    sprintFacing = s.facing;
    sprintMotion = s.motion;
  }
  assert.ok(sprintMotion.speed > PLAYER_RUN_SPEED + 1.0 && sprintMotion.speed <= PLAYER_SPRINT_SPEED + 0.05);
  assert.equal(sprintMotion.mode, 'sprint');
  assert.ok(walkMotion.speed < runMotion.speed && runMotion.speed < sprintMotion.speed);

  // Sharp turn creates bounded bankAngle
  const turnStep = stepPlayerMovement({
    pos: sprintPos,
    facing: sprintFacing,
    motion: sprintMotion,
    moveDirX: -1,
    moveDirZ: 0,
    inputMagnitude: 1.0,
    sprintHeld: true,
    carryingItem: false,
    posture: 'standing',
    seatId: null,
    dt: 0.033,
  });
  assert.ok(Math.abs(turnStep.motion.bankAngle) > 0.005);
  assert.ok(Math.abs(turnStep.motion.bankAngle) <= 0.22);

  // Carrying item caps sprint speed at PLAYER_RUN_SPEED and uses 'carry' idle pose when stopped
  let carryMotion = createInitialPlayerMotion(startPos);
  let carryPos = { ...startPos };
  for (let i = 0; i < 30; i++) {
    const s = stepPlayerMovement({
      pos: carryPos,
      facing: 0,
      motion: carryMotion,
      moveDirX: 1,
      moveDirZ: 0,
      inputMagnitude: 1.0,
      sprintHeld: true,
      carryingItem: true,
      posture: 'standing',
      seatId: null,
      dt: 0.033,
    });
    carryPos = s.pos;
    carryMotion = s.motion;
  }
  assert.ok(carryMotion.speed <= PLAYER_RUN_SPEED + 0.05);

  const idleCarry = stepPlayerMovement({
    pos: startPos,
    facing: 0,
    motion: createInitialPlayerMotion(startPos),
    moveDirX: 0,
    moveDirZ: 0,
    inputMagnitude: 0,
    sprintHeld: false,
    carryingItem: true,
    posture: 'standing',
    seatId: null,
    dt: 0.033,
  });
  assert.equal(idleCarry.motion.animState, 'carry');
});

test('bridge ground elevation and sliding obstacle collision behave cleanly', () => {
  const bridgeHeight = getGroundHeightAt(-2.9, 14.0);
  assert.ok(bridgeHeight > 0.35, `Expected bridge arch > 0.35, got ${bridgeHeight}`);
  assert.equal(getGroundHeightAt(0, 0), 0);

  const bridgeStep = stepPlayerMovement({
    pos: { x: -2.9, z: 13.8 },
    facing: 0,
    motion: createInitialPlayerMotion({ x: -2.9, z: 13.8 }),
    moveDirX: 0,
    moveDirZ: 1,
    inputMagnitude: 0.6,
    sprintHeld: false,
    carryingItem: false,
    posture: 'standing',
    seatId: null,
    dt: 0.033,
  });
  assert.ok(bridgeStep.motion.groundY > 0.35);

  // Slide diagonally against east edge of Willow Step Cottage without entering obstacle box
  const nearWall = { x: -10.25, z: 10.0 };
  const slideStep = stepPlayerMovement({
    pos: nearWall,
    facing: -Math.PI * 0.75,
    motion: createInitialPlayerMotion(nearWall),
    moveDirX: -0.7,
    moveDirZ: -0.7,
    inputMagnitude: 1.0,
    sprintHeld: false,
    carryingItem: false,
    posture: 'standing',
    seatId: null,
    dt: 0.04,
  });
  assert.equal(isPointWalkable(slideStep.pos.x, slideStep.pos.z, 0.48), true);
  assert.ok(slideStep.pos.z < nearWall.z, 'Player should slide smoothly along Z when X meets cottage wall');
});

test('sitting and standing on benches respects NPC occupancy and movement stand-up', () => {
  const world = createFreshWorldState();
  const seat = getSeatById('seat_east_plaza');
  assert.ok(seat);

  const satRes = togglePlayerSitAction(world, 'seat_east_plaza');
  assert.equal(satRes.sat, true);
  assert.equal(satRes.nextWorld.playerPosture, 'sitting');
  assert.equal(satRes.nextWorld.playerSeatId, 'seat_east_plaza');
  assert.deepEqual(satRes.nextWorld.playerPos, seat.seatPos);

  // Zero-input while sitting stays seated in 'sit' animState
  const staySat = stepPlayerMovement({
    pos: satRes.nextWorld.playerPos,
    facing: satRes.nextWorld.playerFacing,
    motion: createInitialPlayerMotion(satRes.nextWorld.playerPos),
    moveDirX: 0,
    moveDirZ: 0,
    inputMagnitude: 0,
    sprintHeld: false,
    carryingItem: false,
    posture: satRes.nextWorld.playerPosture,
    seatId: satRes.nextWorld.playerSeatId,
    dt: 0.033,
  });
  assert.equal(staySat.posture, 'sitting');
  assert.equal(staySat.motion.animState, 'sit');

  // Movement input stands back onto walkable approachPos
  const standFromMove = stepPlayerMovement({
    pos: satRes.nextWorld.playerPos,
    facing: satRes.nextWorld.playerFacing,
    motion: staySat.motion,
    moveDirX: -1,
    moveDirZ: 0,
    inputMagnitude: 1.0,
    sprintHeld: false,
    carryingItem: false,
    posture: 'sitting',
    seatId: 'seat_east_plaza',
    dt: 0.033,
  });
  assert.equal(standFromMove.stoodUpFromMove, true);
  assert.equal(standFromMove.posture, 'standing');
  assert.equal(standFromMove.seatId, null);
  assert.equal(isPointWalkable(standFromMove.pos.x, standFromMove.pos.z, 0.48), true);

  // Occupied seat cannot be sat on by player
  const occupiedWorld = {
    ...world,
    npcRuntime: {
      ...world.npcRuntime,
      sora: {
        ...world.npcRuntime.sora,
        posture: 'sitting' as const,
        reservedSeatId: 'seat_east_plaza',
        position: { ...seat.seatPos },
      },
    },
  };
  const blocked = togglePlayerSitAction(occupiedWorld, 'seat_east_plaza');
  assert.equal(blocked.sat, false);
  assert.equal(blocked.nextWorld.playerPosture, 'standing');
});

test('carryable props support pickup, walkable drop, and resident delivery with affection reward', () => {
  let world = createFreshWorldState();

  const picked = pickupWorldPropAction(world, 'water_pail');
  world = picked.nextWorld;
  assert.equal(world.playerHeldItem, 'water_pail');
  assert.equal(world.worldProps.water_pail.holder, 'player');

  const dropped = placeWorldPropAction(world);
  assert.equal(dropped.nextWorld.playerHeldItem, null);
  assert.equal(dropped.nextWorld.worldProps.water_pail.holder, 'world');
  assert.equal(
    isPointWalkable(dropped.nextWorld.worldProps.water_pail.pos.x, dropped.nextWorld.worldProps.water_pail.pos.z, 0.35),
    true,
  );

  // Pick back up and deliver to Mina (who likes water_pail)
  world = pickupWorldPropAction(dropped.nextWorld, 'water_pail').nextWorld;
  const beforeAffinity = world.playerRelations.mina.affinity;
  const beforeFamiliarity = world.playerRelations.mina.familiarity;
  const beforeRel = world.playerRelations.mina.reliability;
  const delivered = deliverHeldItemAction(world, 'mina');

  assert.equal(delivered.likesIt, true);
  assert.equal(delivered.nextWorld.playerHeldItem, null);
  assert.equal(delivered.nextWorld.worldProps.water_pail.holder, 'mina');
  assert.equal(delivered.nextWorld.playerRelations.mina.giftsGiven, 1);
  assert.ok(delivered.nextWorld.playerRelations.mina.affinity >= beforeAffinity + 12);
  assert.ok(delivered.nextWorld.playerRelations.mina.familiarity > beforeFamiliarity);
  assert.ok(delivered.nextWorld.playerRelations.mina.reliability > beforeRel);
});

test('selectBestInteractiveTarget prioritizes facing resident, excludes occupied seats, and surfaces Stand Up when sitting', () => {
  const base = createFreshWorldState();
  const seat = SEAT_SPOTS[0];

  // 1. Sitting overrides with Stand Up
  const sittingWorld = togglePlayerSitAction(base, seat.id).nextWorld;
  const sitTarget = selectBestInteractiveTarget(sittingWorld, RESIDENTS);
  assert.ok(sitTarget);
  assert.equal(sitTarget.kind, 'seat');
  assert.equal(sitTarget.actionLabel, 'Stand Up');

  // 2. Facing a resident ahead vs a prop slightly behind picks the resident
  const facingWorld = {
    ...base,
    playerPos: { x: 2.0, z: 3.0 },
    playerFacing: -Math.PI / 2, // facing west (-X) toward Clara
    worldProps: {
      ...base.worldProps,
      water_pail: { ...base.worldProps.water_pail, pos: { x: 3.1, z: 3.0 }, holder: 'world' as const },
    },
    npcRuntime: {
      ...base.npcRuntime,
      clara: {
        ...base.npcRuntime.clara,
        position: { x: 0.7, z: 3.0 },
      },
    },
  };
  const chosen = selectBestInteractiveTarget(facingWorld, RESIDENTS);
  assert.ok(chosen);
  assert.equal(chosen.kind, 'resident');
  assert.equal(chosen.id, 'clara');

  // 3. Occupied seat near player is excluded
  const nearEastBench = {
    ...base,
    playerPos: { ...seat.approachPos },
    npcRuntime: {
      ...base.npcRuntime,
      clara: { ...base.npcRuntime.clara, position: { x: -12, z: -12 } },
      arthur: { ...base.npcRuntime.arthur, position: { x: 14, z: -12 } },
      mina: { ...base.npcRuntime.mina, position: { x: 14, z: 2 } },
      jun: { ...base.npcRuntime.jun, position: { x: -12, z: 12 } },
      barnaby: { ...base.npcRuntime.barnaby, position: { x: 12, z: 14 } },
      sora: {
        ...base.npcRuntime.sora,
        posture: 'sitting' as const,
        reservedSeatId: seat.id,
        position: { ...seat.seatPos },
      },
      toby: { ...base.npcRuntime.toby, position: { x: -6, z: 16 } },
      nora: { ...base.npcRuntime.nora, position: { x: -14, z: -2 } },
      pip: { ...base.npcRuntime.pip, position: { x: -10, z: -10 } },
    },
  };
  const benchCheck = selectBestInteractiveTarget(nearEastBench, RESIDENTS);
  assert.notEqual(benchCheck?.seatId, seat.id);
});

test('diagonal player movement normalizes speed, Alt modifier enforces walk speed, sit height scales cleanly, and A* routes around pond', () => {
  // Diagonal normalization keeps speed capped at PLAYER_RUN_SPEED
  let diagMotion = createInitialPlayerMotion(PLAYER_SPAWN);
  let diagPos = { ...PLAYER_SPAWN };
  for (let i = 0; i < 35; i++) {
    const s = stepPlayerMovement({
      pos: diagPos,
      facing: 0,
      motion: diagMotion,
      moveDirX: 1,
      moveDirZ: 1, // unnormalized diagonal input
      inputMagnitude: 1.0,
      sprintHeld: false,
      carryingItem: false,
      posture: 'standing',
      seatId: null,
      dt: 0.033,
    });
    diagPos = s.pos;
    diagMotion = s.motion;
  }
  assert.ok(diagMotion.speed <= PLAYER_RUN_SPEED + 0.05);

  // Alt walk modifier keeps speed <= PLAYER_WALK_SPEED even with full input & Shift
  let walkModMotion = createInitialPlayerMotion(PLAYER_SPAWN);
  let walkModPos = { ...PLAYER_SPAWN };
  for (let i = 0; i < 30; i++) {
    const s = stepPlayerMovement({
      pos: walkModPos,
      facing: 0,
      motion: walkModMotion,
      moveDirX: 1,
      moveDirZ: 0,
      inputMagnitude: 1.0,
      sprintHeld: true,
      walkHeld: true,
      carryingItem: false,
      posture: 'standing',
      seatId: null,
      dt: 0.033,
    });
    walkModPos = s.pos;
    walkModMotion = s.motion;
  }
  assert.ok(walkModMotion.speed <= PLAYER_WALK_SPEED + 0.05);
  assert.equal(walkModMotion.mode, 'walk');

  // Bench height calibration aligns coat bottom (~0.325 * heightScale) to seatHeight across scales
  const seatHeight = 0.36;
  const pipSitY = computeSitGroundY(seatHeight, RESIDENTS.pip.appearance.heightScale);
  const barnabySitY = computeSitGroundY(seatHeight, RESIDENTS.barnaby.appearance.heightScale);
  assert.ok(pipSitY > barnabySitY);
  assert.ok(Math.abs(pipSitY + 0.33 * RESIDENTS.pip.appearance.heightScale - seatHeight) < 0.001);

  // Tap-to-walk across Mirror Pond produces unobstructed A* waypoints
  const start = { x: -4.2, z: 14.2 };
  const acrossPond = { x: 7.4, z: 11.4 };
  const route = computeWaypointPath(start, acrossPond, 0.48);
  assert.ok(route.length >= 2);
  let prev = start;
  for (const wp of route) {
    assert.equal(hasLineOfSight(prev, wp, 0.42), true);
    prev = wp;
  }
});
