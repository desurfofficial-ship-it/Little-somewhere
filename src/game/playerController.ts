import {
  InteractiveTarget,
  NpcAnimationState,
  PlayerLocation,
  PlayerMovementMode,
  ResidentId,
  Vec2,
  WorldState,
  PropInteractableId,
} from './types';
import {
  resolveAnySeatById,
  resolveInteriorMovement,
  selectBestInteriorTarget,
} from './cottage';
import { resolveSeatStandPos } from './walkability';
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
  isNookInteriorWalkable,
  resolveNookInteriorMovement,
  selectBestNookTarget,
} from './bookNook';
import {
  resolveCopperwheelInteriorMovement,
  selectBestCopperwheelTarget,
} from './copperwheel';
import {
  PROP_INTERACTABLES,
  SEAT_SPOTS,
  computeFacingAlignment,
  distance2D,
  getGroundHeightAt,
  getPropInteractionMetrics,
  getSeatById,
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

/**
 * Stride anchors tuned per speed tier (steps/sec of the full two-foot cycle).
 * The curve between anchors is piecewise-linear and CONTINUOUS: legacy behavior
 * snapped 8.5 → 11.5 → 14.5 exactly at the walk/run/sprint thresholds, which made
 * the stride visibly pop (and feet slide) whenever actualSpeed sat between tiers
 * while inertia blended. Anchors at the tier speeds match the legacy values so
 * steady-state gait is unchanged; everything between now blends smoothly.
 */
export const STRIDE_FREQ_WALK = 8.5;
export const STRIDE_FREQ_RUN = 11.5;
export const STRIDE_FREQ_SPRINT = 14.5;

export function computeStrideFrequency(speed: number): number {
  if (speed <= PLAYER_WALK_SPEED) {
    // Slow creep (0.35..3.6): shallow slope so gentle strolls keep a relaxed cadence
    return STRIDE_FREQ_WALK - (PLAYER_WALK_SPEED - speed) * 1.4;
  }
  if (speed <= PLAYER_RUN_SPEED) {
    const t = (speed - PLAYER_WALK_SPEED) / (PLAYER_RUN_SPEED - PLAYER_WALK_SPEED);
    return STRIDE_FREQ_WALK + t * (STRIDE_FREQ_RUN - STRIDE_FREQ_WALK);
  }
  const t = Math.min(
    1,
    (speed - PLAYER_RUN_SPEED) / Math.max(0.001, PLAYER_SPRINT_SPEED - PLAYER_RUN_SPEED),
  );
  return STRIDE_FREQ_RUN + t * (STRIDE_FREQ_SPRINT - STRIDE_FREQ_RUN);
}

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
  /** 0..1 normalized launch acceleration — drives lean-into-speed torso pitch. */
  accelAmount: number;
  /** 0..1 hard-brake / direction-reversal skid envelope — drives dust poofs & squash. */
  skidAmount: number;
}

export function createInitialPlayerMotion(pos: Vec2, location?: PlayerLocation): PlayerMotionRuntime {
  return {
    vx: 0,
    vz: 0,
    speed: 0,
    mode: 'idle',
    turnRateRadPerSec: 0,
    bankAngle: 0,
    walkPhase: 0,
    animState: 'idle',
    // FLICKER FIX G2 + adversarial review finding 4: interiors render their own floor
    // plane — the exterior cobble contract must not lift the mount-time ground height
    // (a save taken indoors would otherwise pop the avatar 5 cm on frame one).
    groundY: isInteriorLocation(location) ? 0 : getGroundHeightAt(pos.x, pos.z),
    footstepPending: false,
    wasAirOrStepApex: false,
    accelAmount: 0,
    skidAmount: 0,
  };
}

export function computeSitGroundY(seatHeight: number, heightScale = 1.0): number {
  return seatHeight - 0.33 * heightScale;
}

/**
 * Interior locations render their own floor plane — the exterior cobble-slab ground
 * contract (getGroundHeightAt → groundSurfaces) must not apply to them.
 * (FLICKER FIX G2: indoor seat XZ values can overlap the cobble rectangles without
 * the slab height being real there.)
 */
export function isInteriorLocation(location?: PlayerLocation): boolean {
  return (
    location === 'cottage_interior' ||
    location === 'greenhouse_interior' ||
    location === 'bakery_interior' ||
    location === 'nook_interior' ||
    location === 'copperwheel_interior'
  );
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
  // Overhaul G-10: the second clause (`inputMagnitude >= 0.96 && sprintHeld`)
  // was unreachable (subsumed by the first) and trapped refactors — removed.
  if (sprintHeld) {
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
      // Pushing a movement key/stick while sitting gracefully steps back onto a walkable
      // spot: the authored approach when it passes the seat's OWN interior grid, else a
      // deterministic radial recovery around the seat (8 directions × 0.35/0.55). The
      // historic cottage-only check left bakery/copperwheel sitters trapped inside the
      // chair collision volume (0 free directions) — see docs/research 02 §B.
      posture = 'standing';
      stoodUpFromMove = true;
      if (seat) {
        const standPos = resolveSeatStandPos(seat);
        if (standPos) {
          pos = standPos;
        }
      }
      seatId = null;
    } else {
      const seatPos = seat ? { ...seat.seatPos } : pos;
      const seatFacing = seat ? seat.facingAngle : facing;
      // Character-quality program (Workstream B): the body eases around into the
      // seat's facing instead of snapping — sitting down keeps its continuity.
      // wrapAngleDelta(current, target) returns the wrapped (target - current).
      const easedFacing = seat
        ? facing + wrapAngleDelta(facing, seatFacing) * Math.min(1, dt * 7)
        : seatFacing;
      const nextMotion: PlayerMotionRuntime = {
        ...input.motion,
        vx: 0,
        vz: 0,
        speed: 0,
        mode: 'idle',
        turnRateRadPerSec: 0,
        bankAngle: 0,
        animState: 'sit',
        // Overhaul C-1: seated ground Y must include the terrain under the seat
        // (Foxglove Rise's 0.62 deck previously sank seated avatars ~0.59 into
        // it — the offset alone assumed flat world ground).
        // FLICKER FIX G2: interiors use their own floor plane — the cobble slab
        // contract must not leak into indoor sit heights (indoor seat XZ values can
        // legitimately overlap the network rectangles, but the rendered ground there
        // is the interior floor, matching the isInterior branch below).
        groundY: seat
          ? computeSitGroundY(seat.seatHeight, 1.0) +
            (isInteriorLocation(input.location) ? 0 : getGroundHeightAt(seat.seatPos.x, seat.seatPos.z))
          : 0,
        footstepPending: false,
        accelAmount: 0,
        skidAmount: 0,
      };
      return {
        pos: seatPos,
        facing: easedFacing,
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
  const isInterior = isInteriorLocation(input.location);
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
    : input.location === 'nook_interior'
    ? resolveNookInteriorMovement(pos, nextPosCandidate, 0.42)
    : input.location === 'copperwheel_interior'
    ? resolveCopperwheelInteriorMovement(pos, nextPosCandidate, 0.42)
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
  const strideFreq = computeStrideFrequency(actualSpeed);
  const walkPhase = actualSpeed >= 0.35 ? input.motion.walkPhase + dt * strideFreq : input.motion.walkPhase;
  const nextSin = Math.sin(walkPhase);
  const crossedFootstep = actualSpeed >= 0.5 && ((prevSin < 0 && nextSin >= 0) || (prevSin > 0 && nextSin <= 0));

  // Launch acceleration envelope (lean into the run before speed catches up)
  const accelAmount =
    activeLocomotionInput && desiredSpeed > input.motion.speed + 0.08
      ? Math.min(1, (desiredSpeed - input.motion.speed) / 3.2)
      : 0;

  // Skid envelope: fast travel with no input (planted-heel hard brake), or a sharp
  // input reversal while still carrying speed. Decays smoothly so rising edges
  // trigger exactly one dust burst and the squash eases back rather than snapping.
  const reversingSkid =
    activeLocomotionInput && dirX * input.motion.vx + dirZ * input.motion.vz < 0 && input.motion.speed > 3.0;
  // Release skid keys off the PRE-slide speed: how fast the wanderer was going the
  // instant the brake was asked for (post-slide speed already absorbed a decel frame).
  const releaseSkid = !activeLocomotionInput && input.motion.speed > 4.6;
  const rawSkid = reversingSkid
    ? Math.min(1, input.motion.speed / PLAYER_SPRINT_SPEED)
    : releaseSkid
    ? Math.min(1, (input.motion.speed - 4.6) / 2.6)
    : 0;
  const skidAmount = Math.max(rawSkid, input.motion.skidAmount * Math.exp(-6 * dt));

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
      accelAmount,
      skidAmount,
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
 * UI/UX program (WP4): single source of truth for world-prop contextual CTA
 * labels. Previously duplicated (and already drifting) between
 * `selectBestInteractiveTarget` and the canvas tap-picking path — both now
 * call this. Verb-first phrasing matches the prop card's own action verbs.
 */
export function getWorldPropActionLabel(
  propId: PropInteractableId,
  bellRestored: boolean,
  propName: string,
): string {
  if (propId === 'gazebo_bell' && bellRestored) return 'Ring the Brass Bell';
  if (propId === 'player_door') return 'Enter Cottage';
  if (
    propId === 'greenhouse_door' ||
    propId === 'bakery_door' ||
    propId === 'nook_door' ||
    propId === 'copperwheel_door'
  ) {
    return 'Step Inside';
  }
  if (
    propId === 'cottage_window_box' ||
    propId === 'greenhouse_planters' ||
    propId === 'orchard_harvest' ||
    propId === 'orchard_skep' ||
    propId === 'pond_driftwood'
  ) {
    return propName;
  }
  return `Inspect ${propName}`;
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

  if (world.playerLocation === 'nook_interior') {
    // M3 Build 8: Linden Book Nook stations; seated in the reading armchair offers
    // the same sit-and-sip ritual (Nora's tea travels in the same satchel).
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
    return selectBestNookTarget(world);
  }

  if (world.playerLocation === 'copperwheel_interior') {
    // M3 Build 9: Copperwheel Cottage stations; seated in the window armchair offers
    // the same sit-and-sip ritual (Arthur's kettle tea travels in the same satchel).
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
    return selectBestCopperwheelTarget(world);
  }

  if (world.playerPosture === 'sitting') {
    const seat = resolveAnySeatById(world.playerSeatId);
    // Overhaul C-5: the sip ritual works on any seat — a brewed drink travels
    // in the satchel, so a plaza bench offers it exactly like the cottage table.
    const sip = getFirstSipableItem(world.inventory);
    if (sip) {
      return {
        kind: 'seat',
        id: seat?.id ?? 'seat_current',
        seatId: seat?.id,
        label: seat?.label ?? 'Bench',
        actionLabel: `Sip ${sip.def.label}`,
        distance: 0,
        worldPos: { ...world.playerPos },
        sipItemId: sip.itemId,
      };
    }
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
      const actionLabel = getWorldPropActionLabel(
        prop.id,
        world.flags.bellRestored,
        prop.name,
      );
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
    // Overhaul G-11: unified with the tap-path's 2.35 seat range so HUD
    // selection and raycast aiming agree.
    if (d <= 2.35) {
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
