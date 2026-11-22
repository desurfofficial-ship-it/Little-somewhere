/**
 * Ground-surface truth for the cobblestone walk network (single source of truth).
 *
 * FLICKER FIX G2 (docs/visual-quality/mobile-floor-flickering-investigation.md R3/R4):
 * the rendered cobble slabs sit at y = 0.05, but `getGroundHeightAt` used to return 0
 * on the whole network — every character contact disc, interaction ring, tap-dest ring
 * and dust puff mounted at "logical ground" was depth-buried 5 cm under the plaza and
 * popped in/out at strip boundaries. This module owns the slab geometry data so the
 * scene mesh (src/scene/builders/cobbleNetwork.ts) and the logical height function
 * can never drift apart again.
 *
 * Pure data + pure math: zero DOM, zero Three.js (src/game layer law — Node-testable).
 */

/** Authored cobble slab top height (was only implied by the old box offsets). */
export const COBBLE_SURFACE_HEIGHT = 0.05;

/** Skirt runs from the slab top down past the meadow plane (boxes used [-0.01, +0.05]). */
export const COBBLE_SKIRT_DEPTH = 0.06;

/** Walk-height ramp width at the slab edges (smooth 0 → 0.05 transition). */
export const COBBLE_EDGE_RAMP = 0.3;

/** World-aligned cobble texture repeats per world unit — preserves the plaza's
 *  authored density exactly (old plaza strip: 12.5 u wide, cobbleTex repeat 4×4). */
export const COBBLE_TEX_REPEATS_PER_UNIT = 4 / 12.5;

export interface CobbleRect {
  /** Rect center X (world). */
  x: number;
  /** Rect center Z (world). */
  z: number;
  /** Half-extent along X. */
  halfW: number;
  /** Half-extent along Z. */
  halfL: number;
}

/**
 * The authored cobblestone lane/plaza network — the exact rectangles the eight
 * `addCobbleStrip` boxes laid out in NeighborhoodCanvas (plaza, home lane, west/east
 * lanes, east extension, south/north promenades, bridge approach).
 */
export const COBBLE_RECTS: readonly CobbleRect[] = [
  { x: 0, z: 0, halfW: 6.25, halfL: 6.75 }, // Central Plaza (fountain)
  { x: -9, z: 10, halfW: 5.5, halfL: 1.8 }, // Home lane
  { x: -10, z: -1, halfW: 1.9, halfL: 11 }, // West lane (Book Nook -> Bakery -> Home)
  { x: 8.3, z: -1, halfW: 2.1, halfL: 11.5 }, // East lane (Workshop -> Greenhouse -> Woodshop)
  { x: 8.3, z: 11.6, halfW: 2.0, halfL: 1.3 }, // East lane extension to Pinecone Woodshop
  { x: 0, z: 7.2, halfW: 11, halfL: 1.6 }, // South promenade above pond
  { x: -2.9, z: 10.1, halfW: 1.15, halfL: 1.5 }, // Bridge approach walk
  { x: 0, z: -6.5, halfW: 11, halfL: 1.6 }, // North promenade by gazebo
];

function smoothstep(t: number): number {
  const c = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

/**
 * Walkable surface height of the cobble network at world (x, z): the slab height
 * inside any rect, ramping smoothly to 0 across COBBLE_EDGE_RAMP outside the nearest
 * edge (so characters glide onto/off the slabs instead of popping). Where rects
 * overlap the height is identical (single slab plane), so a plain max is exact.
 */
export function getCobbleSurfaceHeight(x: number, z: number): number {
  let best = 0;
  for (const r of COBBLE_RECTS) {
    const dx = Math.abs(x - r.x) - r.halfW;
    const dz = Math.abs(z - r.z) - r.halfL;
    if (dx <= 0 && dz <= 0) {
      return COBBLE_SURFACE_HEIGHT; // strictly inside — slab height, no blending needed
    }
    const d = Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
    if (d < COBBLE_EDGE_RAMP) {
      const h = COBBLE_SURFACE_HEIGHT * smoothstep(1 - d / COBBLE_EDGE_RAMP);
      if (h > best) best = h;
    }
  }
  return best;
}

/** True when (x, z) is on the slab (used by scene-side decal placement rules). */
export function isOnCobbleSurface(x: number, z: number): boolean {
  return getCobbleSurfaceHeight(x, z) >= COBBLE_SURFACE_HEIGHT - 1e-6;
}
