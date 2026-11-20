import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createResidentFeelState,
  deriveResidentPoofCues,
  updateResidentMotionFeel,
  type ResidentFeelState,
} from './residentFeel';

const DT = 1 / 30;

/** Drive one feel slot through a scripted (dt, facing, speed) sequence. */
function drive(
  state: ResidentFeelState,
  frames: Array<[number, number, number]>,
): ResidentFeelState {
  for (const [dt, facing, speed] of frames) {
    updateResidentMotionFeel(state, facing, speed, dt);
  }
  return state;
}

/**
 * Pass 26 poof-cue script: feed (dt, facing, speed, walkPhase) frames through
 * the same derive -> update call order the canvas uses each frame.
 */
function drivePoofs(
  state: ResidentFeelState,
  frames: Array<[number, number, number, number]>,
): Array<{ footstep: boolean; skid: boolean }> {
  const cues: Array<{ footstep: boolean; skid: boolean }> = [];
  for (const [dt, facing, speed, walkPhase] of frames) {
    deriveResidentPoofCues(state, facing, speed, walkPhase, dt);
    cues.push({ footstep: state.poofFootstep, skid: state.poofSkid });
    updateResidentMotionFeel(state, facing, speed, dt);
  }
  return cues;
}

test('resident feel: first observation snaps baselines — no spawn-yaw bank spike', () => {
  const state = createResidentFeelState();
  // Spawn facing is whatever the world authored (π here) — a naive delta from 0 would spike
  drive(state, [[DT, Math.PI, 0.9]]);
  assert.equal(state.bank, 0, 'first frame banks nothing');
  assert.equal(state.lean, 0, 'first frame leans nothing');
  assert.equal(state.squash, 0, 'first frame squashes nothing');
  assert.equal(state.prevFacing, Math.PI, 'baseline facing snapped');
  assert.equal(state.prevSpeed, 0.9, 'baseline speed snapped');

  // The very next identical frame produces no signal either (constant state)
  drive(state, [[DT, Math.PI, 0.9]]);
  assert.ok(Math.abs(state.bank) < 1e-9, 'constant facing banks nothing');
  assert.ok(Math.abs(state.lean) < 1e-9, 'constant speed leans nothing');
});

test('resident feel: turning banks into the turn with the player sign convention and clamps', () => {
  // Facing increasing (+yaw) must bank negative — same as the player's -turnRate formula
  const rightTurn = drive(createResidentFeelState(), [
    [DT, 0, 1.2],
    [DT, 0.3, 1.2],
    [DT, 0.6, 1.2],
    [DT, 0.9, 1.2],
  ]);
  assert.ok(rightTurn.bank < 0, `+yaw turn banks negative (got ${rightTurn.bank.toFixed(3)})`);
  assert.ok(rightTurn.bank >= -0.17, `bank respects the clamp (got ${rightTurn.bank.toFixed(3)})`);

  // Mirrored turn banks positive
  const leftTurn = drive(createResidentFeelState(), [
    [DT, 0, 1.2],
    [DT, -0.3, 1.2],
    [DT, -0.6, 1.2],
    [DT, -0.9, 1.2],
  ]);
  assert.ok(leftTurn.bank > 0, `-yaw turn banks positive (got ${leftTurn.bank.toFixed(3)})`);

  // A violent spin saturates at the clamp, never beyond (after damping converges)
  const spin = drive(createResidentFeelState(), [
    [DT, 0, 1.5],
    ...Array.from({ length: 30 }, (_, i) => [DT, (i + 1) * 0.9, 1.5] as [number, number, number]),
  ]);
  assert.ok(Math.abs(spin.bank) <= 0.17 + 1e-9, `spin saturates at ±0.17 (got ${spin.bank.toFixed(3)})`);
});

test('resident feel: turning in place banks nothing (speed gate)', () => {
  // Dialogue/greeting turns rotate facing with speed ≈ 0 — must not wobble the torso
  const state = drive(createResidentFeelState(), [
    [DT, 0, 0.02],
    [DT, 1.2, 0.02],
    [DT, 2.4, 0.02],
    [DT, 3.6, 0.02],
  ]);
  assert.ok(Math.abs(state.bank) < 0.005, `in-place turn keeps bank ≈ 0 (got ${state.bank.toFixed(4)})`);
});

test('resident feel: launch leans into the run and stretches; hard brake compresses', () => {
  // Launch: 0 → 1.15 u/s
  const launch = drive(createResidentFeelState(), [
    [DT, 0, 0],
    [DT, 0, 0.4],
    [DT, 0, 0.8],
    [DT, 0, 1.15],
    [DT, 0, 1.15],
  ]);
  assert.ok(launch.lean > 0.05, `launch builds lean (got ${launch.lean.toFixed(3)})`);
  assert.ok(launch.squash < 0, `launch stretches the figure (got ${launch.squash.toFixed(3)})`);

  // Planted-heel stop: 1.3 → 0.1 u/s while still above the brake speed floor
  const brake = drive(createResidentFeelState(), [
    [DT, 0, 1.3],
    [DT, 0, 0.5],
    [DT, 0, 0.35],
  ]);
  assert.ok(brake.squash > 0.01, `hard brake compresses (got ${brake.squash.toFixed(3)})`);

  // Gentle idle stop (1.3 → 0 at the floor) must not trigger brake squash
  const settle = drive(createResidentFeelState(), [
    [DT, 0, 1.3],
    [DT, 0, 0.28],
  ]);
  assert.ok(settle.brakeSquash < brake.squash, 'gentle stop squashes less than a hard brake');
});

test('resident feel: steady motion decays every signal toward zero (convergence)', () => {
  const state = drive(createResidentFeelState(), [
    [DT, 0, 0.1],
    [DT, 0.5, 1.3],
    [DT, 1.0, 1.3],
  ]);
  const bankMag = Math.abs(state.bank);
  const leanMag = state.lean;
  // Hold a straight constant speed for two seconds
  drive(state, Array.from({ length: 60 }, () => [DT, 1.0, 1.3] as [number, number, number]));
  assert.ok(Math.abs(state.bank) < bankMag * 0.05 + 1e-6, 'bank decays once the turn ends');
  assert.ok(state.lean < leanMag * 0.05 + 1e-6, 'lean decays once the launch ends');
  assert.ok(Math.abs(state.squash) < 0.002, 'squash settles near zero in steady motion');
});

test('resident feel: dt = 0 and pathological frames never produce NaN', () => {
  const state = drive(createResidentFeelState(), [
    [DT, 0.5, 1.0],
    [0, 1.0, 1.0], // frozen clock
    [DT, 1.5, 0.5],
    [-DT, 2.0, 0.5], // hostile dt
    [Number.NaN, 2.5, 0.5], // hostile dt
  ]);
  for (const v of [state.bank, state.lean, state.squash, state.brakeSquash]) {
    assert.ok(Number.isFinite(v), `signal stays finite (got ${v})`);
  }
  // Sequence continues working afterwards
  drive(state, [[DT, 2.6, 1.0]]);
  assert.ok(Number.isFinite(state.lean));
});

test('resident feel: deterministic — identical frame scripts produce identical state', () => {
  const frames: Array<[number, number, number]> = [
    [DT, 0, 0.2],
    [DT, 0.4, 1.2],
    [DT, 0.8, 1.4],
    [DT, 0.8, 0.3],
    [DT, 0.6, 0.3],
  ];
  const a = drive(createResidentFeelState(), frames);
  const b = drive(createResidentFeelState(), frames);
  assert.equal(a.bank, b.bank);
  assert.equal(a.lean, b.lean);
  assert.equal(a.squash, b.squash);
});

/* ------------------------------------------------------------------ */
/* Pass 26: footstep-timed dust-poof cues (deriveResidentPoofCues)     */
/* ------------------------------------------------------------------ */

test('resident poofs: full-stride footsteps cue on alternating feet only', () => {
  // Walk at the resident's full stride (2.3 u/s); the walkPhase script jumps
  // across π (frame 7) and 2π (frame 14) — the two stride crossings.
  const frames: Array<[number, number, number, number]> = [
    [DT, 0, 2.3, 0.1],
    [DT, 0, 2.3, 0.5],
    [DT, 0, 2.3, 0.9],
    [DT, 0, 2.3, 1.4],
    [DT, 0, 2.3, 1.9],
    [DT, 0, 2.3, 2.4],
    [DT, 0, 2.3, 3.0], // sin > 0 (0.141)
    [DT, 0, 2.3, 3.3], // sin < 0 (-0.158) — crosses π
    [DT, 0, 2.3, 3.7],
    [DT, 0, 2.3, 4.1],
    [DT, 0, 2.3, 4.5],
    [DT, 0, 2.3, 5.0],
    [DT, 0, 2.3, 5.6],
    [DT, 0, 2.3, 6.1], // sin < 0 (-0.182)
    [DT, 0, 2.3, 6.4], // sin > 0 (0.117) — crosses 2π
    [DT, 0, 2.3, 6.8],
  ];
  const cues = drivePoofs(createResidentFeelState(), frames);
  const cueIdx = cues.map((c, i) => (c.footstep ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(cueIdx, [7], 'exactly the π-crossing frame cues (alternating feet)');
  assert.ok(!cues[14].footstep, 'the 2π crossing is the other foot — no cue');
});

test('resident poofs: slow steps and gentle pacing never cue dust', () => {
  const frames: Array<[number, number, number, number]> = [
    [DT, 0, 1.2, 0.1],
    [DT, 0, 1.2, 0.5],
    [DT, 0, 1.2, 1.4],
    [DT, 0, 1.2, 3.0],
    [DT, 0, 1.2, 3.3], // crossing while below the 2.0 stride gate
    [DT, 0, 1.2, 3.7],
    [DT, 0, 1.2, 4.5],
    [DT, 0, 1.2, 6.1],
    [DT, 0, 1.2, 6.4], // second crossing, still slow
  ];
  const cues = drivePoofs(createResidentFeelState(), frames);
  assert.ok(cues.every((c) => !c.footstep && !c.skid), 'no dust at a gentle pace');
});

test('resident poofs: hard arrivals plant a skid burst exactly once', () => {
  const frames: Array<[number, number, number, number]> = [
    [DT, 0, 2.3, 0.1],
    [DT, 0, 2.3, 0.5],
    [DT, 0, 0.4, 0.5], // 2.3 -> 0.4 in one frame: planted-heel arrival
    [DT, 0, 0.4, 0.5],
    [DT, 0, 0.0, 0.5],
  ];
  const cues = drivePoofs(createResidentFeelState(), frames);
  const skidIdx = cues.map((c, i) => (c.skid ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(skidIdx, [2], 'the arrival frame cues one burst');
});

test('resident poofs: sharp speed-carrying pivots kick dust; in-place turns do not', () => {
  // Pivot while carrying speed
  const pivot = drivePoofs(createResidentFeelState(), [
    [DT, 0, 2.0, 0.1],
    [DT, 2.5, 2.0, 0.5], // yawRate 75 rad/s at full stride
    [DT, 2.5, 2.0, 0.9],
  ]);
  assert.ok(pivot[1].skid, 'speed-carrying pivot cues a skid burst');
  // Same pivot at a standstill (dialogue look-at turn) — nothing
  const inPlace = drivePoofs(createResidentFeelState(), [
    [DT, 0, 0.05, 0.1],
    [DT, 2.5, 0.05, 0.1],
    [DT, 2.5, 0.05, 0.1],
  ]);
  assert.ok(inPlace.every((c) => !c.skid), 'in-place pivot cues nothing');
});

test('resident poofs: first frame, frozen clock and hostile dt stay cue-free and finite', () => {
  const state = createResidentFeelState();
  // First observation must snap silently (no spawn poof storm)
  const first = drivePoofs(state, [[DT, 1.2, 2.3, 3.0]]);
  assert.ok(!first[0].footstep && !first[0].skid, 'first frame cues nothing');
  // dt <= 0 clears cues instead of dividing
  const frozen = drivePoofs(state, [
    [0, 1.2, 2.3, 3.3],
    [-DT, 1.2, 2.3, 3.7],
  ]);
  assert.ok(frozen.every((c) => !c.footstep && !c.skid), 'frozen/hostile clock cues nothing');
  assert.ok(Number.isFinite(state.prevWalkSin), 'poof baseline stays finite');
  // Sequence continues working afterwards
  const after = drivePoofs(state, [[DT, 1.2, 2.3, 6.1]]);
  assert.equal(typeof after[0].footstep, 'boolean');
});

test('resident poofs: deterministic — identical scripts produce identical cue streams', () => {
  const frames: Array<[number, number, number, number]> = [
    [DT, 0, 2.3, 0.1],
    [DT, 0, 2.3, 2.4],
    [DT, 0, 2.3, 3.0],
    [DT, 0, 2.3, 3.3],
    [DT, 0, 0.4, 3.3],
    [DT, 2.5, 2.0, 3.3],
    [DT, 2.5, 2.0, 3.7],
  ];
  const a = drivePoofs(createResidentFeelState(), frames);
  const b = drivePoofs(createResidentFeelState(), frames);
  assert.deepEqual(a, b, 'cue streams match frame for frame');
});
