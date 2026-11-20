import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createResidentFeelState,
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
