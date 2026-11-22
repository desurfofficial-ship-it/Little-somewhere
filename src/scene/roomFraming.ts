/**
 * Room-aware camera framing — pure math, no React, no DOM, no Three.js objects.
 *
 * Overhaul Phase 1 (docs/proposals/2026-11-22-world-quality-overhaul/):
 * - single source of truth for per-location camera profiles,
 * - yaw-derived screen→world movement basis (replaces the hardcoded 0.7071 iso
 *   constants, so camera rotation cannot silently break WASD/joystick control),
 * - cutaway-side mapping (which interior wall sides face the camera),
 * - fit-distance math for bounds-derived interior framing (Phase 3 wiring).
 *
 * Parity contract: at the authored azimuth (yaw = π/4) and zero pitch, every
 * formula below reproduces the legacy inline camera behavior exactly
 * (offset (19.5, 18.2, 19.5) · zoom, focus compression ×0.42, lookY 0.85/1.0).
 * Locked by src/scene/roomFraming.test.ts.
 */

import type { PlayerLocation } from '../game/types';

/** World-unit zoom limits for the raw zoom target (wheel / HUD / pinch / QA). */
export const ZOOM_MIN = 0.55;
export const ZOOM_MAX = 1.75;

/** Authored camera azimuth: offset (19.5, 18.2, 19.5) ⇒ 45° in the XZ plane. */
export const AUTHORED_YAW = Math.PI / 4;

export type ShellSide = 'N' | 'E' | 'S' | 'W';

/**
 * Camera profile per location. The controller consumes this instead of
 * per-branch magic numbers. Fields mirror the legacy exterior/interior branch
 * semantics exactly at Phase 1; Phase 3 enriches interiors with bounds + fit.
 */
export interface RoomCameraProfile {
  /** focus = roomCenter + (player − roomCenter) × focusWeight. */
  focusWeight: number;
  /** Base look-target height (legacy: 1.0 exterior, 0.85 interior). */
  lookY: number;
  /** How much of the player's ground elevation feeds the look target (0.6 exterior, 0 interior). */
  groundFollow: number;
  /** Dialogue adds a vertical drop to the look target (legacy exterior only). */
  dialogueDrop: boolean;
  /** Dialogue focuses the midpoint between player and NPC (legacy exterior only). */
  dialogueMidpoint: boolean;
  /** Dialogue multiplies the zoom target by 0.9 (legacy exterior only). */
  dialogueZoom: boolean;
  /** Legacy exterior corner-lift heuristic (replaced by raycast occlusion in Phase 2). */
  cornerLift: boolean;
  /** zoomEff = clamp(zoomRaw × zoomScale, zoomMin, zoomMax). */
  zoomScale: number;
  zoomMin: number;
  zoomMax: number;
  /** Phase 3: room-local bounds the framing must keep inside the frustum. */
  bounds?: RoomBounds;
  /** Phase 3: precomputed distance at zoom = 1 that fits bounds + player margin. */
  baseDistance?: number;
}

export interface RoomBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const EXTERIOR_PROFILE: RoomCameraProfile = {
  focusWeight: 1.0,
  lookY: 1.0,
  groundFollow: 0.6,
  dialogueDrop: true,
  dialogueMidpoint: true,
  dialogueZoom: true,
  cornerLift: true,
  zoomScale: 1.0,
  zoomMin: ZOOM_MIN,
  zoomMax: ZOOM_MAX,
};

/**
 * Interior profiles at Phase 1 reproduce the legacy interior branch numbers
 * exactly (focus ×0.42 toward the room-centered origin, lookY 0.85,
 * zoom ×0.68 clamped [0.56, 0.92]) — with the greenhouse INCLUDED, fixing the
 * defect where greenhouse_interior fell through to the exterior camera branch
 * (D-4/E-4). Phase 3 replaces these with bounds-derived fits per room.
 */
export const LEGACY_INTERIOR_PROFILE: RoomCameraProfile = {
  focusWeight: 0.42,
  lookY: 0.85,
  groundFollow: 0,
  dialogueDrop: false,
  dialogueMidpoint: false,
  dialogueZoom: false,
  cornerLift: false,
  zoomScale: 0.68,
  zoomMin: 0.56,
  zoomMax: 0.92,
};

const INTERIOR_LOCATIONS: ReadonlySet<PlayerLocation> = new Set<PlayerLocation>([
  'cottage_interior',
  'bakery_interior',
  'nook_interior',
  'copperwheel_interior',
  'greenhouse_interior',
]);

export function isInteriorLocation(location: PlayerLocation): boolean {
  return INTERIOR_LOCATIONS.has(location);
}

export function profileForLocation(location: PlayerLocation): RoomCameraProfile {
  return isInteriorLocation(location) ? LEGACY_INTERIOR_PROFILE : EXTERIOR_PROFILE;
}

/**
 * Effective zoom for a profile: legacy exterior used zoomRaw directly
 * (canvas-clamped), legacy interior clamped AFTER scaling by 0.68.
 */
export function effectiveZoom(profile: RoomCameraProfile, zoomRaw: number): number {
  const scaled = zoomRaw * profile.zoomScale;
  return Math.min(profile.zoomMax, Math.max(profile.zoomMin, scaled));
}

/**
 * Yaw-derived screen→world movement basis.
 *
 * yaw is the camera azimuth: the camera sits at focus + (sin yaw, ·, cos yaw)·d.
 * Screen-down (joyY/keyVert +1) walks toward the camera; screen-right
 * (keyHoriz +1) walks to the screen's right. At the authored yaw π/4 this is
 * bit-identical to the legacy constants:
 *   moveX = h·0.7071 + v·0.7071, moveZ = −h·0.7071 + v·0.7071
 * (values are deliberately NOT normalized — parity with legacy input).
 */
export function screenToWorldMove(
  screenHoriz: number,
  screenVert: number,
  yaw: number,
  out: { x: number; z: number },
): void {
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  out.x = screenHoriz * cos + screenVert * sin;
  out.z = -screenHoriz * sin + screenVert * cos;
}

/**
 * Which interior shell sides sit between the camera and the room ("near" —
 * rendered as low cutaway curbs) versus behind the room ("far" — full walls).
 *
 * Convention: N = minZ wall, S = maxZ, E = maxX, W = minX. The camera sits in
 * the XZ direction (sin yaw, cos yaw) from the room center. At the authored
 * yaw π/4 the camera is in the +X/+Z quadrant ⇒ near = [E, S], far = [N, W] —
 * exactly the baked look of every existing interior (tall N/W, low E/S).
 */
export function cutawaySidesForYaw(yaw: number): { near: ShellSide[]; far: ShellSide[] } {
  // A side is "near" when its outward normal has a positive component along
  // the camera direction (sin yaw, cos yaw): E:(1,0)→sin, W:(−1,0)→−sin,
  // S:(0,1)→cos, N:(0,−1)→−cos. Fixed N/E/S/W order keeps results deterministic.
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  const dots: Array<[ShellSide, number]> = [
    ['N', -cos],
    ['E', sin],
    ['S', cos],
    ['W', -sin],
  ];
  const near: ShellSide[] = [];
  const far: ShellSide[] = [];
  for (const [side, dot] of dots) {
    (dot > 1e-6 ? near : far).push(side);
  }
  return { near, far };
}

/**
 * Fit distance: how far along the authored viewing direction the camera must
 * sit (at zoom = 1) so that the room bounding sphere + a player margin stay
 * inside the frustum. Pure math used by Phase 3 profiles.
 */
export function fitDistance(
  bounds: RoomBounds,
  fovYDeg: number,
  aspect: number,
  wallHeight: number,
  margin = 1.1,
): number {
  const hx = (bounds.maxX - bounds.minX) / 2 + margin;
  const hz = (bounds.maxZ - bounds.minZ) / 2 + margin;
  // Bounding-sphere radius of the room volume (walls included).
  const radius = Math.sqrt(hx * hx + hz * hz + ((wallHeight + margin) / 2) ** 2);
  const fovY = (fovYDeg * Math.PI) / 180;
  const fovX = 2 * Math.atan(Math.tan(fovY / 2) * aspect);
  const halfFov = Math.min(fovY, fovX) / 2;
  // Distance along the view axis so the bounding sphere fits inside the frustum.
  return radius / Math.sin(halfFov);
}
