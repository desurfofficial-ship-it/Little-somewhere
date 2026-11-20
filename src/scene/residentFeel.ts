import { wrapAngleDelta } from '../game/playerController';

/**
 * residentFeel.ts — Pass 25: resident motion feel parity.
 *
 * The player (Pass 19) reads turn-bank / launch-lean / brake-squash from the
 * movement controller; resident locomotion is path-driven inside the simulation,
 * so the same three feel signals are derived here from the per-frame state the
 * runtime already exposes (`npcRuntime[id].facing` + `.currentSpeed`), using the
 * player's formulas rescaled to resident speeds. One small mutable state slot per
 * resident is created once at module load — the steady-state update allocates
 * nothing and never touches game state.
 *
 * Sign conventions mirror `playerController.stepPlayerMovement` exactly:
 * - bankAngle: `targetBank = clamp(-turnRate * k * min(1, speed / vRef), ±max)`,
 *   damped at `dt * 10`.
 * - accelLean: rising-speed envelope 0..1, damped at `dt * 9`.
 * - squash: brake compression (positive) minus launch stretch (`lean * 0.022`),
 *   damped at `dt * 9`.
 */

/** Bank clamp — slightly tighter than the player's ±0.22 (lower top speeds). */
const BANK_MAX = 0.17;
/** Bank gain — a touch stronger than the player's 0.025 to read at NPC speeds. */
const BANK_GAIN = 0.032;
/** Speed that maps to full bank weight (player reference is 4.0 for sprint-scale speeds). */
const BANK_SPEED_REF = 1.7;
/** Acceleration (u/s²) that maps to a full lean envelope. */
const LEAN_ACCEL_REF = 2.4;
/** Minimum deceleration (u/s²) that counts as a planted-heel brake. */
const BRAKE_THRESHOLD = 1.4;
/** Full brake squash amplitude (player uses `skidAmount * 0.05`). */
const BRAKE_SQUASH = 0.06;
/** Speed above which braking squash is allowed (idle stops just settle). */
const BRAKE_MIN_SPEED = 0.3;

export interface ResidentFeelState {
  /** Damped turn bank in radians — feeds `CharacterAnimationOptions.bankAngle`. */
  bank: number;
  /** 0..1 launch lean envelope — feeds `CharacterAnimationOptions.accelLean`. */
  lean: number;
  /** Composed squash value — feeds `CharacterAnimationOptions.squash`. */
  squash: number;
  /** Previous-frame facing/speed (NaN until the first update snaps them). */
  prevFacing: number;
  prevSpeed: number;
  /** Internal damped brake-squash envelope before the launch-stretch composition. */
  brakeSquash: number;
}

export function createResidentFeelState(): ResidentFeelState {
  return { bank: 0, lean: 0, squash: 0, prevFacing: NaN, prevSpeed: NaN, brakeSquash: 0 };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Advance one resident's feel state from the runtime's facing/speed for this frame.
 * Mutates `state` only; deterministic; safe at dt ≤ 0 (signals decay, no NaN).
 */
export function updateResidentMotionFeel(
  state: ResidentFeelState,
  facing: number,
  speed: number,
  dt: number,
): void {
  // First observation: snap baselines so a fresh session never banks from spawn yaw.
  if (Number.isNaN(state.prevFacing)) {
    state.prevFacing = facing;
    state.prevSpeed = speed;
    return;
  }

  if (dt > 0) {
    const turnRate = wrapAngleDelta(state.prevFacing, facing) / dt;
    // Dead-zone below 0.1 u/s: dialogue look-at turns / path pivots in place
    // must bank exactly nothing, not just very little.
    const bankWeight = clamp((speed - 0.1) / (BANK_SPEED_REF - 0.1), 0, 1);
    const targetBank = clamp(-turnRate * BANK_GAIN * bankWeight, -BANK_MAX, BANK_MAX);
    state.bank += (targetBank - state.bank) * Math.min(1, dt * 10);

    const accelRaw = (speed - state.prevSpeed) / dt;
    const leanTarget = accelRaw > 0.25 ? clamp(accelRaw / LEAN_ACCEL_REF, 0, 1) : 0;
    state.lean += (leanTarget - state.lean) * Math.min(1, dt * 9);

    const brakeRaw = (state.prevSpeed - speed) / dt;
    const brakeTarget =
      speed > BRAKE_MIN_SPEED && brakeRaw > BRAKE_THRESHOLD
        ? clamp(brakeRaw / (BRAKE_THRESHOLD * 5), 0, 1) * BRAKE_SQUASH
        : 0;
    state.brakeSquash += (brakeTarget - state.brakeSquash) * Math.min(1, dt * 9);
  } else {
    // Frozen clock: signals relax rather than divide by zero.
    state.bank += (0 - state.bank) * 0.5;
    state.lean += (0 - state.lean) * 0.5;
    state.brakeSquash += (0 - state.brakeSquash) * 0.5;
  }

  // Launch stretch (negative) composed with brake compression (positive), matching
  // the player's `squash = impact + skid * 0.05 - accel * 0.022` composition.
  state.squash = state.brakeSquash - state.lean * 0.022;
  state.prevFacing = facing;
  state.prevSpeed = speed;
}
