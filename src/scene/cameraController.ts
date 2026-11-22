/**
 * CameraController — the game's camera as a testable unit (overhaul Phase 1).
 *
 * Owns ALL camera state: continuous yaw orbit, pitch band, zoom smoothing,
 * mode/location profiles, damped position + (new) damped look-target, and the
 * interval-scheduled occlusion probe request consumed by src/scene/occlusion.ts
 * in Phase 2. Never reads DOM events — the canvas GestureRouter feeds intents.
 *
 * Parity contract at the authored yaw (π/4) and zero pitch: this reproduces the
 * legacy inline camera choreography of NeighborhoodCanvas tick() exactly —
 * offset (19.5, 18.2, 19.5)·zoom, position damp 6.5, dialogue zoom 0.9 damp 5.0,
 * dialogue drop −0.42, exterior corner-lift damp 4.5, title orbit r 27 / y 16.5
 * / angle elapsed·0.14 + 0.65. Locked by src/scene/cameraController.test.ts.
 *
 * Zero allocations in update(): all math uses module-scratch vectors/numbers.
 */

import * as THREE from 'three';
import {
  AUTHORED_YAW,
  effectiveZoom,
  EXTERIOR_PROFILE,
  profileForLocation,
  type RoomCameraProfile,
} from './roomFraming';
import type { PlayerLocation } from '../game/types';

/** Legacy rig geometry: offset (19.5, 18.2, 19.5) ⇒ polar form. */
const BASE_HORIZ = 19.5 * Math.SQRT2; // 27.577…
const BASE_HEIGHT = 18.2;
const BASE_RADIUS = Math.hypot(BASE_HORIZ, BASE_HEIGHT); // 33.043…
const BASE_ELEV = Math.atan2(BASE_HEIGHT, BASE_HORIZ); // ≈ 0.5833 rad

/** Pitch band around the authored elevation (radians). */
export const PITCH_MIN = -0.12;
export const PITCH_MAX = 0.1;

const POS_DAMP = 6.5;
const LOOK_DAMP = 9;
const TITLE_DAMP = 3;
const DIALOGUE_ZOOM_DAMP = 5.0;
const DIALOGUE_DROP_DAMP = 5.0;
const LIFT_DAMP = 4.5;

/** Occlusion probe scheduling (Phase 2 consumes the request). */
const PROBE_INTERVAL = 0.15;
const PROBE_YAW_DELTA = 0.35;

export interface CameraSnapshot {
  playerX: number;
  playerZ: number;
  groundY: number;
  zoomRaw: number;
  dialogueNpcX: number | null;
  dialogueNpcZ: number | null;
}

export function createCameraSnapshot(): CameraSnapshot {
  return { playerX: 0, playerZ: 0, groundY: 0, zoomRaw: 1, dialogueNpcX: null, dialogueNpcZ: null };
}

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private yaw = AUTHORED_YAW;
  private pitch = 0;
  private titleState: boolean = true;
  private location: PlayerLocation = 'exterior';
  private profile: RoomCameraProfile = EXTERIOR_PROFILE;
  private dialogueOpen = false;
  private elapsed = 0;

  // Smoothed mirrors
  private smDialogueZoom = 1.0;
  private smDialogueDropY = 0;
  private smLift = 0;
  private lookX = 0;
  private lookY = 1;
  private lookZ = 0;
  private initialized = false;

  // Probe scheduling state
  private probeTimer = 0;
  private lastProbeYaw = AUTHORED_YAW;
  probeRequested = false;

  // Scratch
  private _look = new THREE.Vector3();
  private _pos = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  getYaw(): number {
    return this.yaw;
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  getPitch(): number {
    return this.pitch;
  }

  /** Drag-rotate: continuous yaw integration (no damping — user-driven input is 1:1). */
  addYawDelta(delta: number): void {
    this.yaw += delta;
    // Keep in [0, 2π) for stable probe-delta comparisons.
    const twoPi = Math.PI * 2;
    this.yaw = ((this.yaw % twoPi) + twoPi) % twoPi;
  }

  /** Drag-pitch: clamped band. Phase 3's dynamic cutaway keeps interiors safe. */
  addPitchDelta(delta: number): void {
    this.pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, this.pitch + delta));
  }

  /** Keyboard rotate (desktop Q/E). */
  nudgeYaw(step: number): void {
    this.addYawDelta(step);
  }

  setLocation(location: PlayerLocation, titleState: boolean): void {
    this.titleState = titleState;
    if (location !== this.location) {
      this.location = location;
      this.profile = profileForLocation(location);
      // Reset the corner-lift mirror so exterior re-entry re-damps from 0
      // (legacy behavior: module mirror persisted; keeping the reset is safe
      // because the lift target is 0 except in the covered quadrant).
      this.smLift = 0;
    } else {
      this.titleState = titleState;
    }
  }

  setDialogue(open: boolean): void {
    this.dialogueOpen = open;
  }

  /** Hard position snap used on location changes and by the QA zoom hook. */
  snapTo(focusX: number, focusZ: number, zoom: number): void {
    const distH = BASE_HORIZ * zoom;
    this.camera.position.set(
      focusX + Math.sin(this.yaw) * distH,
      BASE_HEIGHT * zoom,
      focusZ + Math.cos(this.yaw) * distH,
    );
    this.initialized = false;
  }

  /**
   * Returns true exactly when an occlusion probe is due (interval elapsed or
   * the yaw changed materially since the last probe). The canvas runs the
   * probe and clears the flag. Phase 2 consumes this.
   */
  consumeProbeRequest(dt: number): boolean {
    this.probeTimer += dt;
    const yawDelta = Math.abs(this.yaw - this.lastProbeYaw);
    const due =
      this.probeTimer >= PROBE_INTERVAL ||
      yawDelta > PROBE_YAW_DELTA ||
      !this.probeRequested;
    if (due) {
      this.probeTimer = 0;
      this.lastProbeYaw = this.yaw;
      this.probeRequested = true;
      return true;
    }
    return false;
  }

  update(dt: number, snap: CameraSnapshot): void {
    this.elapsed += dt;
    if (this.titleState) {
      this.updateTitle(dt);
      return;
    }

    const p = this.profile;
    const dialogue = this.dialogueOpen;

    // Zoom smoothing chain (legacy: smoothedDialogueZoom damp 5.0 toward 0.9/1.0).
    this.smDialogueZoom = THREE.MathUtils.damp(
      this.smDialogueZoom,
      dialogue ? 0.9 : 1.0,
      DIALOGUE_ZOOM_DAMP,
      dt,
    );
    if (p.dialogueDrop) {
      this.smDialogueDropY = THREE.MathUtils.damp(
        this.smDialogueDropY,
        dialogue ? -0.42 : 0,
        DIALOGUE_DROP_DAMP,
        dt,
      );
    } else {
      this.smDialogueDropY = THREE.MathUtils.damp(this.smDialogueDropY, 0, DIALOGUE_DROP_DAMP, dt);
    }

    const zoom = effectiveZoom(p, snap.zoomRaw) * (p.dialogueZoom ? this.smDialogueZoom : 1);

    // Focus composition.
    let focusX = snap.playerX;
    let focusZ = snap.playerZ;
    if (p.dialogueMidpoint && dialogue && snap.dialogueNpcX !== null && snap.dialogueNpcZ !== null) {
      focusX = (snap.playerX + snap.dialogueNpcX) * 0.5;
      focusZ = (snap.playerZ + snap.dialogueNpcZ) * 0.5;
    }
    if (p.focusWeight !== 1.0) {
      // Player-weighted composition toward the room center (interiors are
      // origin-centered dioramas; the weight keeps both player and layout in
      // frame instead of the legacy aim-at-compressed-floor).
      focusX = snap.playerX * p.focusWeight;
      focusZ = snap.playerZ * p.focusWeight;
    }

    // Legacy exterior corner-lift heuristic (Phase 2 replaces it with raycast
    // occlusion; kept here so exterior behavior is unchanged until then).
    if (p.cornerLift) {
      const targetLift = snap.playerZ > 8.5 && Math.abs(snap.playerX) > 8.5 ? 1.5 : 0;
      this.smLift = THREE.MathUtils.damp(this.smLift, targetLift, LIFT_DAMP, dt);
    }

    // Offset from yaw/pitch. Rooms with a bounds-derived baseDistance scale
    // the polar radius linearly with the effective zoom (zEff 0.68 sits at
    // exactly the fit distance); the exterior keeps the authored polar rig.
    const radius =
      p.baseDistance !== undefined
        ? p.baseDistance * (zoom / 0.68)
        : BASE_RADIUS * zoom;
    const elev = BASE_ELEV + this.pitch;
    const distH = radius * Math.cos(elev);
    const distY = radius * Math.sin(elev);
    this._pos.set(
      focusX + Math.sin(this.yaw) * distH,
      distY + this.smLift,
      focusZ + Math.cos(this.yaw) * distH,
    );

    // Look target — now smoothed (fixes the dialogue/branch look-target pops).
    // B-1 (QA-FINAL): seed the smoothed target on the SAME first frame the
    // position snaps, so resetSmoothing()/snapTo() reframe aim as well —
    // otherwise the look target damps from the stale pre-transition location.
    const firstFrame = !this.initialized;
    const targetY =
      p.lookY + snap.groundY * p.groundFollow + this.smDialogueDropY;
    if (firstFrame) {
      this.lookX = focusX;
      this.lookY = targetY;
      this.lookZ = focusZ;
    }
    this.lookX = THREE.MathUtils.damp(this.lookX, focusX, LOOK_DAMP, dt);
    this.lookY = THREE.MathUtils.damp(this.lookY, targetY, LOOK_DAMP, dt);
    this.lookZ = THREE.MathUtils.damp(this.lookZ, focusZ, LOOK_DAMP, dt);
    this._look.set(this.lookX, this.lookY, this.lookZ);
    this.camera.lookAt(this._look);

    if (firstFrame) {
      this.camera.position.copy(this._pos);
      this.initialized = true;
    } else {
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this._pos.x, POS_DAMP, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this._pos.y, POS_DAMP, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this._pos.z, POS_DAMP, dt);
    }
  }

  private updateTitle(dt: number): void {
    // Legacy title orbit: r 27, y 16.5, angle = elapsed·0.14 + 0.65, lerp dt·3,
    // gaze biased east of the plaza (R-08).
    const orbitAngle = this.elapsed * 0.14 + 0.65;
    const r = 27;
    this._pos.set(Math.cos(orbitAngle) * r, 16.5, Math.sin(orbitAngle) * r);
    this.camera.position.lerp(this._pos, Math.min(1, dt * TITLE_DAMP));
    this.camera.lookAt(1.5, 1.4, -2.5);
    this.yaw = AUTHORED_YAW;
    this.pitch = 0;
    this.initialized = false;
    this.lookX = 1.5;
    this.lookY = 1.4;
    this.lookZ = -2.5;
  }

  /** Re-seed the smoothed look target after exterior teleports (snap path). */
  resetSmoothing(): void {
    this.initialized = false;
  }
}
