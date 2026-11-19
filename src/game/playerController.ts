import {
  InteractiveTarget,
  NpcAnimationState,
  PlayerLocation,
  PlayerMovementMode,
  ResidentId,
  Vec2,
  WorldState,
} from './types';
import {
  isInteriorPointWalkable,
  resolveAnySeatById,
  resolveInteriorMovement,
  selectBestInteriorTarget,
} from './cottage';
import {
  isGreenhouseInteriorWalkable,
  resolveGreenhouseInteriorMovement,
  selectBestGreenhouseTarget,
} from './greenhouse';
import {
  isBakeryInteriorWalkable,
  resolveBakeryInteriorMovement,
  selectBestBakeryTarget,
} from './bakery';
import {
  PROP_INTERACTABLES,
  SEAT_SPOTS,
  computeFacingAlignment,
  distance2D,
  getGroundHeightAt,
  getPropInteractionMetrics,
  getSeatById,
  isPointWalkable,
  resolveMovement,
} from './worldMap';
import { getFirstSipableItem } from './inventory';

export const PLAYER_WALK_SPEED = 3.6;
export const PLAYER_RUN_SPEED = 5.4;
export const PLAYER_SPRINT_SPEED = 7.6;
/** Cozy top pace for the tight 7×5.4m cottage room — sprint input is trimmed indoors. */
export const PLAYER_INDOOR_MAX_SPEED = 4.4;
export const PLAYER_ACCEL_RATE = 16.0;
export const PLAYER_DECEL_RATE = 14.0;
export const PLAYER_TURN_RATE = 13.0;

export interface PlayerMotionRuntime {
  vx: number;
  vz: number;
  speed: number;
  mode: PlayerMovementMode;
  turnRateRadPerSec: number;
  bankAngle: number;
  walkPhase: number;
  animState: NpcAnimationState;
  groundY: number;
  footstepPending: boolean;
  wasAirOrStepApex: boolean;
}

export function createInitialPlayerMotion(pos: Vec2): PlayerMotionRuntime {
  return {
    vx: 0,
    vz: 0,
    speed: 0,
    mode: 'idle',
    turnRateRadPerSec: 0,
    bankAngle: 0,
    walkPhase: 0,
    animState: 'idle',
    groundY: getGroundHeightAt(pos.x, pos.z),
    footstepPending: false,
    wasAirOrStepApex: false,
  };
}

export function computeSitGroundY(seatHeight: number, heightScale = 1.0): number {
  return seatHeight - 0.33 * heightScale;
}

export function wrapAngleDelta(current: number, target: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export function resolveDesiredSpeed(
  inputMagnitude: number,
  sprintHeld: boolean,
  walkModifierHeld = false,
): number {
  if (inputMagnitude < 0.04) return 0;
  if (walkModifierHeld) return PLAYER_WALK_SPEED * Math.min(1, inputMagnitude * 1.1);
  if (sprintHeld || inputMagnitude >= 0.96 && sprintHeld) {
    return PLAYER_SPRINT_SPEED;
  }
  // Gentle proportional stick deflection walks softly; full deflection runs naturally
  if (inputMagnitude < 0.55) {
    const t = inputMagnitude / 0.55;
    return PLAYER_WALK_SPEED * (0.6 + t * 0.4);
  }
  const runT = Math.min(1, (inputMagnitude - 0.55) / 0.45);
  return PLAYER_WALK_SPEED + (PLAYER_RUN_SPEED - PLAYER_WALK_SPEED) * runT;
}

export interface StepPlayerMovementInput {
  pos: Vec2;
  facing: number;
  motion: PlayerMotionRuntime;
  moveDirX: number; // world X direction (-1..1, already camera-aligned)
  moveDirZ: number; // world Z direction (-1..1, already camera-aligned)
  inputMagnitude: number; // 0..1 strength
  sprintHeld: boolean;
  walkHeld?: boolean;
  carryingItem: boolean;
  interactionActive?: boolean;
  posture: WorldState['playerPosture'];
  seatId: string | null;
  location?: PlayerLocation;
  dt: number;
}

export interface StepPlayerMovementResult {
  pos: Vec2;
  facing: number;
  posture: WorldState['playerPosture'];
  seatId: string | null;
  motion: PlayerMotionRuntime;
  stoodUpFromMove: boolean;
}

/**
 * Pure simulation step for player locomotion with inertia, smooth turning, walk/run/sprint speed tiers,
 * sitting lock & move-to-stand release, bridge elevation tracking, and zero-wall snag sliding.
 */
export function stepPlayerMovement(input: StepPlayerMovementInput): StepPlayerMovementResult {
  const dt = Math.max(0.001, Math.min(0.05, input.dt));
  let pos = input.pos;
  let facing = input.facing;
  let posture = input.posture;
  let seatId = input.seatId;
  let stoodUpFromMove = false;

  const hasMoveInput = input.inputMagnitude >= 0.08 && (Math.abs(input.moveDirX) > 0.001 || Math.abs(input.moveDirZ) > 0.001);

  if (posture === 'sitting') {
    const seat = resolveAnySeatById(seatId);
    if (hasMoveInput) {
      // Pushing a movement key/stick while sitting gracefully steps back onto walkable approach spot
      posture = 'standing';
      stoodUpFromMove = true;
      const approachWalkable = seat
        ? seat.indoor
          ? isInteriorPointWalkable(seat.approachPos.x, seat.approachPos.z, 0.42)
          : isPointWalkable(seat.approachPos.x, seat.approachPos.z, 0.48)
        : false;
      if (seat && approachWalkable) {
        pos = { ...seat.approachPos };
      }
      seatId = null;
    } else {
      const seatPos = seat ? { ...seat.seatPos } : pos;
      const seatFacing = seat ? seat.facingAngle : facing;
      const nextMotion: PlayerMotionRuntime = {
        ...input.motion,
        vx: 0,
        vz: 0,
        speed: 0,
        mode: 'idle',
        turnRateRadPerSec: 0,
        bankAngle: 0,
        animState: 'sit',
        groundY: seat ? computeSitGroundY(seat.seatHeight, 1.0) : 0,
        footstepPending: false,
      };
      return {
        pos: seatPos,
        facing: seatFacing,
        posture: 'sitting',
        seatId,
        motion: nextMotion,
        stoodUpFromMove: false,
      };
    }
  }

  let dirX = input.moveDirX;
  let dirZ = input.moveDirZ;
  const mag = Math.hypot(dirX, dirZ);
  if (mag > 1e-4) {
    dirX /= mag;
    dirZ /= mag;
  } else {
    dirX = 0;
    dirZ = 0;
  }

  const activeLocomotionInput = hasMoveInput && !input.interactionActive;
  const isInterior =
    input.location === 'cottage_interior' ||
    input.location === 'greenhouse_interior' ||
    input.location === 'bakery_interior';
  // Carrying items trims top sprint pace slightly for cozy physical believability;
  // the small cottage room also caps sprinting so approach points never get overshot.
  const rawDesiredSpeed = resolveDesiredSpeed(
    activeLocomotionInput ? Math.min(1, input.inputMagnitude) : 0,
    input.sprintHeld,
    input.walkHeld,
  );
  let desiredSpeed = rawDesiredSpeed;
  if (input.carryingItem) {
    desiredSpeed = Math.min(desiredSpeed, PLAYER_RUN_SPEED);
  }
  if (isInterior) {
    desiredSpeed = Math.min(desiredSpeed, PLAYER_INDOOR_MAX_SPEED);
  }

  const targetVx = dirX * desiredSpeed;
  const targetVz = dirZ * desiredSpeed;

  const rate = input.interactionActive
    ? PLAYER_DECEL_RATE * 2.5
    : desiredSpeed > input.motion.speed
    ? PLAYER_ACCEL_RATE
    : PLAYER_DECEL_RATE;
  const blend = 1 - Math.exp(-rate * dt);

  let vx = input.motion.vx + (targetVx - input.motion.vx) * blend;
  let vz = input.motion.vz + (targetVz - input.motion.vz) * blend;

  const currentSpeed = Math.hypot(vx, vz);
  if (currentSpeed < 0.05 && !activeLocomotionInput) {
    vx = 0;
    vz = 0;
  }

  const nextPosCandidate = {
    x: pos.x + vx * dt,
    z: pos.z + vz * dt,
  };
  const resolvedPos = !isInterior
    ? resolveMovement(pos, nextPosCandidate, 0.48)
    : input.location === 'greenhouse_interior'
    ? resolveGreenhouseInteriorMovement(pos, nextPosCandidate, 0.42)
    : input.location === 'bakery_interior'
    ? resolveBakeryInteriorMovement(pos, nextPosCandidate, 0.42)
    : resolveInteriorMovement(pos, nextPosCandidate, 0.42);

  // Measure actual traveled velocity after sliding collision (damps into wall cleanly without sticky rebound)
  const actualVx = (resolvedPos.x - pos.x) / dt;
  const actualVz = (resolvedPos.z - pos.z) / dt;
  const actualSpeed = Math.hypot(actualVx, actualVz);
  if (actualSpeed < currentSpeed * 0.45 && Math.hypot(vx, vz) > 0.2) {
    vx = actualVx;
    vz = actualVz;
  }

  let turnRateRadPerSec = 0;
  if (activeLocomotionInput) {
    const targetYaw = Math.atan2(dirX, dirZ);
    const deltaYaw = wrapAngleDelta(facing, targetYaw);
    const turnAlpha = 1 - Math.exp(-PLAYER_TURN_RATE * dt);
    const appliedYaw = deltaYaw * turnAlpha;
    facing += appliedYaw;
    turnRateRadPerSec = appliedYaw / dt;
  }

  const targetBank = Math.max(-0.22, Math.min(0.22, -turnRateRadPerSec * 0.025 * Math.min(1, actualSpeed / 4)));
  const bankAngle = input.motion.bankAngle + (targetBank - input.motion.bankAngle) * Math.min(1, dt * 10);

  let mode: PlayerMovementMode = 'idle';
  if (actualSpeed >= 6.1) mode = 'sprint';
  else if (actualSpeed >= 4.2) mode = 'run';
  else if (actualSpeed >= 0.35) mode = 'walk';

  let animState: NpcAnimationState = 'idle';
  if (mode === 'sprint') animState = 'sprint';
  else if (mode === 'run') animState = 'run';
  else if (mode === 'walk') animState = input.carryingItem ? 'carry' : 'walk';
  else if (input.carryingItem) animState = 'carry';
  else if (Math.abs(turnRateRadPerSec) > 3.2) animState = 'turn';

  const prevSin = Math.sin(input.motion.walkPhase);
  const strideFreq = mode === 'sprint' ? 14.5 : mode === 'run' ? 11.5 : 8.5;
  const walkPhase = actualSpeed >= 0.35 ? input.motion.walkPhase + dt * strideFreq : input.motion.walkPhase;
  const nextSin = Math.sin(walkPhase);
  const crossedFootstep = actualSpeed >= 0.5 && ((prevSin < 0 && nextSin >= 0) || (prevSin > 0 && nextSin <= 0));

  const groundY = isInterior ? 0 : getGroundHeightAt(resolvedPos.x, resolvedPos.z);

  return {
    pos: resolvedPos,
    facing,
    posture: 'standing',
    seatId: null,
    stoodUpFromMove,
    motion: {
      vx,
      vz,
      speed: actualSpeed,
      mode,
      turnRateRadPerSec,
      bankAngle,
      walkPhase,
      animState,
      groundY,
      footstepPending: crossedFootstep,
      wasAirOrStepApex: stoodUpFromMove,
    },
  };
}

export function isSeatOccupiedByNpc(world: WorldState, seatId: string): ResidentId | null {
  for (const id of Object.keys(world.npcRuntime) as ResidentId[]) {
    const rt = world.npcRuntime[id];
    if (rt && rt.posture === 'sitting' && rt.reservedSeatId === seatId) {
      return id;
    }
  }
  return null;
}

/**
 * Selects the highest-priority interactive target (resident, carryable prop, world landmark prop, or bench seat)
 * weighted by distance + player facing cone so aiming feels crisp and intentional.
 */
export function selectBestInteractiveTarget(
  world: WorldState,
  residentNames: Record<ResidentId, { name: string }>,
): InteractiveTarget | null {
  if (world.playerLocation === 'cottage_interior') {
    // Seated at the cottage tea table (Pass 5): offer the sip ritual when a brewed drink
    // is in the satchel, otherwise a plain Stand Up target — never other room props.
    if (world.playerPosture === 'sitting') {
      const seat = resolveAnySeatById(world.playerSeatId);
      if (seat?.indoor) {
        const sip = getFirstSipableItem(world.inventory);
        if (sip) {
          return {
            kind: 'seat',
            id: seat.id,
            seatId: seat.id,
            label: seat.label,
            actionLabel: `Sip ${sip.def.label}`,
            distance: 0,
            worldPos: { ...world.playerPos },
            sipItemId: sip.itemId,
          };
        }
        return {
          kind: 'seat',
          id: seat.id,
          seatId: seat.id,
          label: seat.label,
          actionLabel: 'Stand Up',
          distance: 0,
          worldPos: { ...world.playerPos },
        };
      }
    }
    return selectBestInteriorTarget(world);
  }

  if (world.playerLocation === 'greenhouse_interior') {
    // M3 Build 6: Sunbeam Greenhouse stations (no indoor seats — residents never enter interiors).
    return selectBestGreenhouseTarget(world);
  }

  if (world.playerLocation === 'bakery_interior') {
    // M3 Build 7: Hearth & Crumb stations; seated at the café chair offers the same
    // sit-and-sip ritual as the cottage table (drinks travel in the same satchel).
    if (world.playerPosture === 'sitting') {
      const seat = resolveAnySeatById(world.playerSeatId);
      if (seat?.indoor) {
        const sip = getFirstSipableItem(world.inventory);
        if (sip) {
          return {
            kind: 'seat',
            id: seat.id,
            seatId: seat.id,
            label: seat.label,
            actionLabel: `Sip ${sip.def.label}`,
            distance: 0,
            worldPos: { ...world.playerPos },
            sipItemId: sip.itemId,
          };
        }
        return {
          kind: 'seat',
          id: seat.id,
          seatId: seat.id,
          label: seat.label,
          actionLabel: 'Stand Up',
          distance: 0,
          worldPos: { ...world.playerPos },
        };
      }
    }
    return selectBestBakeryTarget(world);
  }

  if (world.playerPosture === 'sitting') {
    const seat = resolveAnySeatById(world.playerSeatId);
    return {
      kind: 'seat',
      id: seat?.id ?? 'seat_current',
      seatId: seat?.id,
      label: seat?.label ?? 'Bench',
      actionLabel: 'Stand Up',
      distance: 0,
      worldPos: { ...world.playerPos },
    };
  }

  let bestTarget: InteractiveTarget | null = null;
  let bestScore = Infinity;

  const evaluateCandidate = (target: InteractiveTarget, basePriorityBias: number) => {
    const align = computeFacingAlignment(world.playerPos, world.playerFacing, target.worldPos);
    // Targets behind the player carry a small soft penalty; facing targets feel snappier
    const facingPenalty = (1 - align) * 0.45;
    const score = target.distance + facingPenalty + basePriorityBias;
    if (score < bestScore) {
      bestScore = score;
      bestTarget = target;
    }
  };

  // 1. Residents
  for (const id of Object.keys(world.npcRuntime) as ResidentId[]) {
    const rt = world.npcRuntime[id];
    const d = distance2D(world.playerPos, rt.position);
    if (d <= 2.9) {
      const name = residentNames[id]?.name ?? id;
      const heldItem = world.playerHeldItem ? world.worldProps[world.playerHeldItem] : null;
      const isLikedGift = heldItem ? heldItem.likedBy.includes(id) : false;
      evaluateCandidate(
        {
          kind: 'resident',
          id,
          label: name,
          actionLabel: isLikedGift ? `Talk / Share with ${name}` : `Talk to ${name}`,
          distance: d,
          worldPos: rt.position,
        },
        -0.35,
      );
    }
  }

  // 2. Carryable World Props (when hands are free)
  if (!world.playerHeldItem && world.worldProps) {
    for (const prop of Object.values(world.worldProps)) {
      if (prop.holder !== 'world') continue;
      const d = distance2D(world.playerPos, prop.pos);
      if (d <= 2.15) {
        evaluateCandidate(
          {
            kind: 'carryable',
            id: prop.id,
            carryableId: prop.id,
            label: prop.label,
            actionLabel: `Pick Up ${prop.label}`,
            distance: d,
            worldPos: prop.pos,
          },
          -0.08,
        );
      }
    }
  }

  // 3. Landmark Interactive Props (perimeter-aware for Fountain & Mirror Pond)
  for (const prop of PROP_INTERACTABLES) {
    const metrics = getPropInteractionMetrics(prop.id, world.playerPos);
    if (metrics.inRange) {
      const actionLabel =
        prop.id === 'gazebo_bell' && world.flags.bellRestored
          ? 'Ring Bell'
          : prop.id === 'player_door'
          ? 'Enter Cottage'
          : prop.id === 'greenhouse_door'
          ? 'Step Inside'
          : prop.id === 'bakery_door'
          ? 'Step Inside'
          : prop.id === 'cottage_window_box' ||
            prop.id === 'greenhouse_planters' ||
            prop.id === 'orchard_harvest' ||
            prop.id === 'orchard_skep' ||
            prop.id === 'pond_driftwood'
          ? prop.name
          : `Inspect ${prop.name}`;
      evaluateCandidate(
        {
          kind: 'prop',
          id: prop.id,
          label: prop.name,
          actionLabel,
          distance: metrics.scoreDistance,
          worldPos: metrics.focusPos,
        },
        0.05,
      );
    }
  }

  // 4. Benches & Seats (only if unoccupied by an NPC)
  for (const seat of SEAT_SPOTS) {
    if (isSeatOccupiedByNpc(world, seat.id)) continue;
    const d = Math.min(
      distance2D(world.playerPos, seat.seatPos),
      distance2D(world.playerPos, seat.approachPos) + 0.35,
    );
    if (d <= 2.0) {
      evaluateCandidate(
        {
          kind: 'seat',
          id: seat.id,
          seatId: seat.id,
          label: seat.label,
          actionLabel: `Sit on ${seat.label}`,
          distance: d,
          worldPos: seat.seatPos,
        },
        0.25,
      );
    }
  }

  return bestTarget;
}
