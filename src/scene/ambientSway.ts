import * as THREE from 'three';

/**
 * BUILD 04 ambient motion (VISUAL_IDENTITY §7 "Subtle Living Motion" — swaying
 * blooms & lanterns, budgeted so per-frame CPU work stays negligible).
 *
 * Two registries, both driven by ONE call per frame from the environment
 * renderer's section 4 (shared `elapsed` clock, no per-object timers):
 *
 * 1. Shader sway (`applyAmbientSway`) — draw-call-neutral vertex motion via the
 *    sanctioned waterShaders.ts `onBeforeCompile` doctrine: uniforms stored in
 *    `userData`, bound by reference, one stable program cache key per variant.
 *    Used for grove/wilds tree crowns and meadow grass/stem/blossom tufts.
 *    Per-instance phase variation comes free from `instanceMatrix[3]` (zero JS),
 *    and winter stiffens everything through `uWinter`.
 *
 * 2. Hanging-sign swingers (`registerAmbientSwinger`) — small rotation
 *    oscillation about the bracket mount for the shop-sign hanging assemblies
 *    (the swing groups wrap the board + hangers so the bracket arm stays rigid).
 *
 * Zero per-frame allocations; scalar writes only.
 */

export interface AmbientSwayUniforms {
  uTime: { value: number };
  uWind: { value: number };
  uWinter: { value: number };
}

interface SwayRegistration {
  uniforms: AmbientSwayUniforms;
}

interface SwingerRegistration {
  obj: THREE.Object3D;
  ampX: number;
  ampZ: number;
  speed: number;
  phase: number;
}

const swayRegistry: SwayRegistration[] = [];
const swingerRegistry: SwingerRegistration[] = [];

/**
 * Give a palette-cached foliage material a gentle breeze sway. `maskStart` /
 * `maskEnd` shape the height ramp (geometry-local y above which vertices move),
 * `amp` is the max displacement in world units at full wind, `freq` the base
 * oscillation speed. `key` must be unique per numeric variant (it seeds the
 * shader program cache key).
 */
export function applyAmbientSway(
  mat: THREE.MeshStandardMaterial,
  opts: { key: string; maskStart: number; maskEnd: number; amp: number; freq?: number },
): void {
  const uniforms: AmbientSwayUniforms = {
    uTime: { value: 0 },
    uWind: { value: 0.25 },
    uWinter: { value: 0 },
  };
  mat.userData.swayUniforms = uniforms;
  mat.customProgramCacheKey = () => `storybook_sway_${opts.key}`;
  const maskStart = opts.maskStart.toFixed(3);
  const maskEnd = opts.maskEnd.toFixed(3);
  const amp = opts.amp.toFixed(4);
  const freq = (opts.freq ?? 1).toFixed(2);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWind = uniforms.uWind;
    shader.uniforms.uWinter = uniforms.uWinter;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uWind;
        uniform float uWinter;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float swayH = smoothstep(${maskStart}, ${maskEnd}, position.y);
          float swayPhase = 0.0;
          #ifdef USE_INSTANCING
            swayPhase = dot(instanceMatrix[3].xz, vec2(0.83, 0.71));
          #endif
          float swayAmp = ${amp} * uWind * swayH * (1.0 - uWinter * 0.45);
          transformed.x += (sin(uTime * ${freq} + swayPhase) * 0.72 + sin(uTime * ${freq} * 2.17 + swayPhase * 1.31) * 0.28) * swayAmp;
          transformed.z += (cos(uTime * ${freq} * 0.87 + swayPhase * 1.73) * 0.66 + sin(uTime * ${freq} * 1.93 + swayPhase) * 0.34) * swayAmp;
        }`,
      );
  };
  swayRegistry.push({ uniforms });
}

/**
 * Register a hanging assembly (sign board + hangers wrapped in one group whose
 * origin sits at the bracket mount) for a gentle pendulum sway. The bracket arm
 * itself is NOT registered — it stays bolted to the wall.
 */
export function registerAmbientSwinger(
  obj: THREE.Object3D,
  opts: { ampX: number; ampZ: number; speed?: number; phase?: number },
): void {
  swingerRegistry.push({
    obj,
    ampX: opts.ampX,
    ampZ: opts.ampZ,
    speed: opts.speed ?? 1.3,
    phase: opts.phase ?? 0,
  });
}

/** One call per frame from the environment renderer (shared clock doctrine). */
export function updateAmbientMotion(elapsed: number, wind: number, winter: number): void {
  for (let i = 0; i < swayRegistry.length; i++) {
    const u = swayRegistry[i].uniforms;
    u.uTime.value = elapsed;
    u.uWind.value = wind;
    u.uWinter.value = winter;
  }
  for (let i = 0; i < swingerRegistry.length; i++) {
    const s = swingerRegistry[i];
    s.obj.rotation.x = Math.sin(elapsed * s.speed + s.phase) * s.ampX * wind;
    s.obj.rotation.z = Math.cos(elapsed * s.speed * 0.83 + s.phase * 1.7) * s.ampZ * wind;
  }
}

/** Test hook: registry sizes (materials and swingers must both register once). */
export function ambientMotionRegistrySize(): { sway: number; swingers: number } {
  return { sway: swayRegistry.length, swingers: swingerRegistry.length };
}

/**
 * Overhaul G-16: clear the module-level registries on canvas teardown.
 * Without this, every NeighborhoodCanvas remount (StrictMode double-mount,
 * error-boundary recovery) appended new entries holding disposed materials,
 * which updateAmbientMotion then drove forever — a leak that grew per mount.
 */
export function disposeAmbientMotion(): void {
  swayRegistry.length = 0;
  swingerRegistry.length = 0;
}
