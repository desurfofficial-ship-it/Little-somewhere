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
  /** Previous walk-phase sine (NaN until the first poof update snaps it). */
  prevWalkSin: number;
  /** Alternating foot flag — flips on every stride crossing (±1). */
  footSign: number;
  /** One-frame cue: this resident's alternating foot planted at full stride. */
  poofFootstep: boolean;
  /** One-frame cue: hard arrival brake or sharp pivot while carrying speed. */
  poofSkid: boolean;
}

export function createResidentFeelState(): ResidentFeelState {
  return {
    bank: 0,
    lean: 0,
    squash: 0,
    prevFacing: NaN,
    prevSpeed: NaN,
    brakeSquash: 0,
    prevWalkSin: NaN,
    footSign: 1,
    poofFootstep: false,
    poofSkid: false,
  };
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

/* Pass 26 constants for the footstep-timed dust-poof cues. */
/** Full-stride threshold — only real walking kicks dust (never the settle-in steps). */
const POOF_STRIDE_SPEED = 2.0;
/** Previous speed above which a sudden drop counts as a planted-heel arrival skid. */
const POOF_SKID_SPEED = 1.6;
/** Fraction of previous speed a single frame must shed to read as an arrival skid. */
const POOF_SKID_DROP = 0.5;
/** Yaw rate (rad/s) while carrying speed that reads as a hard pivot. */
const POOF_PIVOT_RATE = 5.5;
/** Speed that must be carried through the pivot for it to kick dust. */
const POOF_PIVOT_SPEED = 1.0;

/**
 * Pass 26: derive one-frame dust-poof cues for a resident from the same facing /
 * speed / walkPhase stream the simulation already owns — the resident-language
 * counterpart of the player's fast-step poofs and skid bursts. Residents never
 * sprint, so their dust language is: an alternating-foot faint puff at full
 * stride (only every other crossing, so plazas stay soft) plus a single burst
 * on hard arrivals and sharp speed-carrying pivots.
 *
 * MUST be called before `updateResidentMotionFeel` in the same frame — it reads
 * the previous-frame facing/speed baselines that function then refreshes.
 * Mutates `state` cue fields only; no allocation; safe at dt ≤ 0 (cues clear).
 */
export function deriveResidentPoofCues(
  state: ResidentFeelState,
  facing: number,
  speed: number,
  walkPhase: number,
  dt: number,
): void {
  state.poofFootstep = false;
  state.poofSkid = false;
  if (dt <= 0 || Number.isNaN(state.prevFacing) || Number.isNaN(state.prevWalkSin)) {
    state.prevWalkSin = Math.sin(walkPhase);
    return;
  }

  // Alternating-foot footstep cue at full stride (mirrors the player's
  // walkPhase sine-crossing footstep detection, throttled to every other foot).
  const nextSin = Math.sin(walkPhase);
  const prevSin = state.prevWalkSin;
  state.prevWalkSin = nextSin;
  const crossed =
    (prevSin < 0 && nextSin >= 0) || (prevSin > 0 && nextSin <= 0);
  if (crossed && speed >= POOF_STRIDE_SPEED) {
    state.footSign = -state.footSign;
    if (state.footSign < 0) {
      state.poofFootstep = true;
    }
  }

  // Skid cue: a sudden single-frame speed collapse after real motion (arrival
  // plant) or a sharp yaw pivot while still carrying speed — the resident
  // scale-up of the player's release/reversal skid envelope.
  const prevSpeed = state.prevSpeed;
  const hardArrival = prevSpeed >= POOF_SKID_SPEED && speed < prevSpeed * POOF_SKID_DROP;
  const yawRate = Math.abs(wrapAngleDelta(state.prevFacing, facing)) / dt;
  const hardPivot = yawRate > POOF_PIVOT_RATE && speed >= POOF_PIVOT_SPEED && prevSpeed >= POOF_PIVOT_SPEED;
  state.poofSkid = hardArrival || hardPivot;
}
