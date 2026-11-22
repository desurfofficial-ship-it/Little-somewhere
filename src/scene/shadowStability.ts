import * as THREE from 'three';

/**
 * Shadow-camera stability helpers (FLICKER FIX S2).
 *
 * The environment controller moves the sun every frame (a smooth day arc). An
 * unsnapped moving light makes the 1024² shadow map's texel grid swim continuously —
 * every shadow edge in the scene re-dithers each frame (measured contributor to the
 * "dark patches appear and disappear" report; see
 * docs/visual-quality/mobile-floor-flickering-investigation.md R2).
 *
 * Snapping the light's position onto its own shadow-map texel grid (in light space)
 * keeps the texel grid *stationary in translation* while the sun arc rotates slowly,
 * which is the standard directional-shadow stabilization for fixed-target dioramas.
 * Rotation-induced shimmer remains (slow, softened by the PCF radius) — the dominant
 * translational crawl is what this removes.
 *
 * Pure functions over THREE math types; unit-tested for grid alignment and continuity.
 */

const _dir = new THREE.Vector3();
const _zAxis = new THREE.Vector3();
const _xAxis = new THREE.Vector3();
const _yAxis = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _target = new THREE.Vector3();

/**
 * Snaps a directional light's position so its shadow-camera frustum origin lands on
 * whole shadow-map texels in light space. Mutates and returns `position`.
 *
 * Uses the light's own shadow camera (ortho extents + mapSize) to derive the texel
 * size, matching three's `DirectionalLightShadow.updateMatrices` basis (lookAt from
 * position toward target with world-up (0,1,0)).
 *
 * @param position    the light position (mutated in place)
 * @param target      the light target (three's default is the world origin)
 * @param texelWidth  shadow-camera width in world units / mapSize.width
 * @param texelHeight shadow-camera height in world units / mapSize.height
 */
export function snapLightPositionToShadowTexels(
  position: THREE.Vector3,
  target: THREE.Vector3,
  texelWidth: number,
  texelHeight: number,
): THREE.Vector3 {
  _dir.subVectors(position, target);
  const dist = _dir.length();
  if (dist < 1e-6 || texelWidth <= 0 || texelHeight <= 0) return position;
  _zAxis.copy(_dir).divideScalar(dist);

  // Guard the lookAt degeneracy (sun nearly straight overhead) — never happens in
  // this scene's sun arc (elevation ≤ ~42°), but the helper stays total.
  if (Math.abs(_zAxis.dot(_up)) > 0.999) return position;

  _xAxis.crossVectors(_up, _zAxis).normalize();
  _yAxis.crossVectors(_zAxis, _xAxis).normalize();

  // The ortho shadow frustum is centered on the light→target ray, so what must sit
  // on the texel grid is the TARGET-RELATIVE offset in light-space X/Y. Translating
  // the light along its own right/up axes does not change the direction, only the
  // ortho box origin — so those two components can be quantized freely.
  _dir.subVectors(position, target); // (reused as the relative offset vector)
  const relX = _dir.dot(_xAxis);
  const relY = _dir.dot(_yAxis);
  const relZ = _dir.dot(_zAxis); // == dist
  const snappedX = Math.round(relX / texelWidth) * texelWidth;
  const snappedY = Math.round(relY / texelHeight) * texelHeight;

  position
    .copy(target)
    .addScaledVector(_xAxis, snappedX)
    .addScaledVector(_yAxis, snappedY)
    .addScaledVector(_zAxis, relZ);
  return position;
}

/**
 * Convenience wrapper for a three DirectionalLight: derives the texel size from the
 * light's own ortho shadow camera + map size and snaps its position.
 *
 * NOTE (adversarial review finding 3): the target is read from
 * `light.target.matrixWorld` — exactly what three's `LightShadow.updateMatrices`
 * uses — so this helper and the renderer can never disagree about the basis. For the
 * scene's sun (target never repositioned/added to the scene) matrixWorld stays the
 * identity, i.e. the world origin, matching the authored rig.
 */
export function snapDirectionalLightToShadowTexels(light: THREE.DirectionalLight): THREE.Vector3 {
  const cam = light.shadow.camera;
  const mapWidth = light.shadow.mapSize.width || 1024;
  const mapHeight = light.shadow.mapSize.height || 1024;
  const texelWidth = (cam.right - cam.left) / mapWidth;
  const texelHeight = (cam.top - cam.bottom) / mapHeight;
  _target.setFromMatrixPosition(light.target.matrixWorld);
  return snapLightPositionToShadowTexels(light.position, _target, texelWidth, texelHeight);
}
