import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAYER_RUN_SPEED,
  PLAYER_SPRINT_SPEED,
  PLAYER_WALK_SPEED,
  computeStrideFrequency,
  createInitialPlayerMotion,
  stepPlayerMovement,
} from './playerController';
import { PLAYER_SPAWN } from './worldMap';

function stepForward(
  pos: { x: number; z: number },
  motion: ReturnType<typeof createInitialPlayerMotion>,
  inputMagnitude: number,
  sprintHeld: boolean,
  dt = 0.033,
) {
  return stepPlayerMovement({
    pos,
    facing: 0,
    motion,
    moveDirX: 1,
    moveDirZ: 0,
    inputMagnitude,
    sprintHeld,
    carryingItem: false,
    posture: 'standing',
    seatId: null,
    dt,
  });
}

function sprintUp(steps = 34) {
  let motion = createInitialPlayerMotion(PLAYER_SPAWN);
  let pos = { ...PLAYER_SPAWN };
  for (let i = 0; i < steps; i++) {
    const s = stepForward(pos, motion, 1.0, true);
    motion = s.motion;
    pos = s.pos;
  }
  return { motion, pos };
}

test('computeStrideFrequency is continuous and monotonic across the whole speed range', () => {
  // Anchors preserve the legacy per-tier cadence values
  assert.ok(Math.abs(computeStrideFrequency(PLAYER_WALK_SPEED) - 8.5) < 0.001);
  assert.ok(Math.abs(computeStrideFrequency(PLAYER_RUN_SPEED) - 11.5) < 0.001);
  assert.ok(Math.abs(computeStrideFrequency(PLAYER_SPRINT_SPEED) - 14.5) < 0.001);

  // Monotonic, non-decreasing with speed
  let prev = computeStrideFrequency(0.2);
  for (let s = 0.3; s <= PLAYER_SPRINT_SPEED + 0.4; s += 0.05) {
    const f = computeStrideFrequency(s);
    assert.ok(f >= prev - 1e-9, `stride frequency must not dip at speed ${s.toFixed(2)}`);
    prev = f;
  }

  // Continuity: no visible pop at the legacy tier thresholds (walk->run, run->sprint)
  const eps = 0.005;
  const atWalk = computeStrideFrequency(PLAYER_WALK_SPEED - eps);
  const aboveWalk = computeStrideFrequency(PLAYER_WALK_SPEED + eps);
  assert.ok(
    Math.abs(aboveWalk - atWalk) < 0.06,
    `walk/run stride seam jumps by ${(aboveWalk - atWalk).toFixed(3)} — must be smooth`,
  );
  const atRun = computeStrideFrequency(PLAYER_RUN_SPEED - eps);
  const aboveRun = computeStrideFrequency(PLAYER_RUN_SPEED + eps);
  assert.ok(
    Math.abs(aboveRun - atRun) < 0.06,
    `run/sprint stride seam jumps by ${(aboveRun - atRun).toFixed(3)} — must be smooth`,
  );

  // Slow creep strides slower than a full walk
  assert.ok(computeStrideFrequency(0.6) < computeStrideFrequency(PLAYER_WALK_SPEED));
  // Sprint ceiling clamped
  assert.ok(computeStrideFrequency(PLAYER_SPRINT_SPEED + 2) <= 14.5 + 0.001);
});

test('motion exposes launch acceleration envelope that decays once speed catches up', () => {
  let motion = createInitialPlayerMotion(PLAYER_SPAWN);
  const first = stepForward(PLAYER_SPAWN, motion, 1.0, false, 0.025);
  assert.ok(first.motion.accelAmount > 0.4, `launch accel should be strong, got ${first.motion.accelAmount}`);
  motion = first.motion;
  let pos = first.pos;
  // Run until steady state
  for (let i = 0; i < 40; i++) {
    const s = stepForward(pos, motion, 1.0, false);
    motion = s.motion;
    pos = s.pos;
  }
  assert.ok(motion.speed > PLAYER_RUN_SPEED - 0.15);
  assert.ok(
    motion.accelAmount < 0.02,
    `steady-state accel envelope must settle to ~0, got ${motion.accelAmount}`,
  );
});

test('hard brake from sprint produces a skid envelope that decays to zero', () => {
  // Build up sprint speed
  const { motion, pos } = sprintUp();
  assert.equal(motion.mode, 'sprint');

  // No skid while steadily sprinting
  const steady = stepForward(pos, motion, 1.0, true);
  assert.ok(steady.motion.skidAmount < 0.05, `steady sprint must not skid, got ${steady.motion.skidAmount}`);

  // Release input while fast: planted-heel skid fires, then decays
  let release = stepPlayerMovement({
    pos,
    facing: 0,
    motion: steady.motion,
    moveDirX: 0,
    moveDirZ: 0,
    inputMagnitude: 0,
    sprintHeld: false,
    carryingItem: false,
    posture: 'standing',
    seatId: null,
    dt: 0.033,
  });
  assert.ok(
    release.motion.skidAmount > 0.15,
    `release-at-speed should skid, got ${release.motion.skidAmount}`,
  );
  let lastSkid = release.motion.skidAmount;
  let skidPos = release.pos;
  let skidMotion = release.motion;
  // The envelope keeps decaying after the body stops (inertia of the dust/squash)
  for (let i = 0; i < 60; i++) {
    const s = stepPlayerMovement({
      pos: skidPos,
      facing: 0,
      motion: skidMotion,
      moveDirX: 0,
      moveDirZ: 0,
      inputMagnitude: 0,
      sprintHeld: false,
      carryingItem: false,
      posture: 'standing',
      seatId: null,
      dt: 0.033,
    });
    skidMotion = s.motion;
    skidPos = s.pos;
    assert.ok(
      skidMotion.skidAmount <= lastSkid + 1e-9,
      'skid envelope must decay monotonically once input is released',
    );
    lastSkid = skidMotion.skidAmount;
  }
  assert.equal(skidMotion.speed, 0);
  assert.ok(skidMotion.skidAmount < 0.001, `skid fully settles after stopping, got ${skidMotion.skidAmount}`);

  // Gentle walk release does NOT skid
  let walkMotion = createInitialPlayerMotion(PLAYER_SPAWN);
  let walkPos = { ...PLAYER_SPAWN };
  for (let i = 0; i < 30; i++) {
    const s = stepForward(walkPos, walkMotion, 0.4, false);
    walkMotion = s.motion;
    walkPos = s.pos;
  }
  assert.ok(walkMotion.speed > 2.2, `precondition walking, got ${walkMotion.speed}`);
  const walkRelease = stepPlayerMovement({
    pos: walkPos,
    facing: 0,
    motion: walkMotion,
    moveDirX: 0,
    moveDirZ: 0,
    inputMagnitude: 0,
    sprintHeld: false,
    carryingItem: false,
    posture: 'standing',
    seatId: null,
    dt: 0.033,
  });
  assert.ok(walkRelease.motion.skidAmount < 0.02, 'soft walk stop must not skid');
});

test('sharp direction reversal while fast fires the skid envelope', () => {
  const { motion, pos } = sprintUp();
  assert.ok(motion.speed > 5.5, `precondition fast travel, got ${motion.speed}`);

  const reverse = stepPlayerMovement({
    pos,
    facing: 0,
    motion,
    moveDirX: -1,
    moveDirZ: 0,
    inputMagnitude: 1.0,
    sprintHeld: true,
    carryingItem: false,
    posture: 'standing',
    seatId: null,
    dt: 0.033,
  });
  assert.ok(
    reverse.motion.skidAmount > 0.2,
    `reversal at speed should skid, got ${reverse.motion.skidAmount}`,
  );
});

test('sitting resets accel and skid envelopes to zero', () => {
  const { motion, pos } = sprintUp(30);
  const seated = stepPlayerMovement({
    pos,
    facing: 0,
    motion: { ...motion, accelAmount: 0.8, skidAmount: 0.7 },
    moveDirX: 0,
    moveDirZ: 0,
    inputMagnitude: 0,
    sprintHeld: false,
    carryingItem: false,
    posture: 'sitting',
    seatId: null,
    dt: 0.033,
  });
  assert.equal(seated.motion.accelAmount, 0);
  assert.equal(seated.motion.skidAmount, 0);
  assert.equal(seated.motion.animState, 'sit');
});
