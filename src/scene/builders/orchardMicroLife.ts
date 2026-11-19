import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * FERN HOLLOW ORCHARD MICRO-LIFE — Milestone 3 Build 4.
 *
 * Pooled ambient life confined to the orchard district, following the same
 * zero-GC rig contract as `builders/reactiveProps.ts` (every `update()`
 * mutates transforms/material scalars only — no per-frame allocations):
 *
 * - Blossom butterflies: wing-flapping wanderers anchored to the six
 *   crabapple crowns, the gate flower strip, the skep corner and the orchard
 *   bench, tinted in crabapple-blossom pastels.
 * - Skep bees: warm-gold loopers circling the bee skep entrance with a lazy
 *   figure-eight blossom excursion, active through the working day.
 *
 * Visibility is driven by `update()` options from `environmentRenderer.ts`
 * (weather / phase / season gating), so the rig owns its own visible flags
 * and the canvas only mounts and disposes one group.
 */

export interface OrchardMicroLifeContext {
  isSoftwareGl: boolean;
}

export interface OrchardMicroLifeUpdateOptions {
  /** Butterflies fly in sunlit/breezy daytime weather outside winter. */
  butterfliesActive: boolean;
  /** Bees work the skep from morning through golden hour, dry weather only. */
  beesActive: boolean;
  /** 0..1 breeze strength from the environment composer (drift speed). */
  windStrength: number;
}

export interface OrchardMicroLifeRig {
  group: THREE.Group;
  readonly butterflyCount: number;
  readonly beeCount: number;
  update(elapsed: number, opts: OrchardMicroLifeUpdateOptions): void;
  dispose(): void;
}

interface MicroAnchor {
  x: number;
  z: number;
  /** Base hover height above ground. */
  y: number;
  /** Wander radius multiplier. */
  r: number;
}

// Anchors hug the orchard landmark (zone center -2.6, -18.2, radius 6.5):
// three crowns, the gate flower strip, the bench overlook and the skep corner.
export const ORCHARD_BUTTERFLY_ANCHORS: readonly MicroAnchor[] = [
  { x: -9.6, z: -17.0, y: 1.15, r: 1.15 }, // NW crown
  { x: -3.2, z: -18.0, y: 1.05, r: 1.2 }, // Mid crown
  { x: 2.6, z: -16.7, y: 1.1, r: 1.05 }, // East crown
  { x: -2.6, z: -14.5, y: 0.62, r: 0.7 }, // Gate flower strip
  { x: -10.3, z: -19.8, y: 0.7, r: 0.75 }, // Bench overlook
  { x: 3.9, z: -16.6, y: 0.72, r: 0.65 }, // Skep corner
];

/** The bee skep on its cedar stool, mirrored from builders/orchard.ts. */
export const ORCHARD_SKEP_ANCHOR = { x: 4.9, z: -16.3, y: 1.02 } as const;

const BLOSSOM_TINTS = ['#F7EFD9', '#F2DF9E', '#F3D3D8', '#EFE6C8'] as const;

function makeSeededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildOrchardMicroLife(ctx: OrchardMicroLifeContext): OrchardMicroLifeRig {
  const { isSoftwareGl } = ctx;
  const group = new THREE.Group();
  const rand = makeSeededRandom(3113);

  // ------------------------------------------------------------------
  // 1. Blossom butterflies (3 instanced meshes, per-blossom tints)
  // ------------------------------------------------------------------
  const butterflyCount = isSoftwareGl ? 3 : 6;

  const wingGeo = new THREE.PlaneGeometry(0.155, 0.105);
  wingGeo.translate(0.078, 0, 0); // pivot at wing root
  wingGeo.rotateX(-Math.PI / 2); // lie flat in XZ
  const wingMat = new THREE.MeshBasicMaterial({
    color: '#FFFFFF',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
  });
  const bodyGeo = new THREE.CapsuleGeometry(0.02, 0.08, 2, 5);
  bodyGeo.rotateX(Math.PI / 2);
  const bodyMat = new THREE.MeshBasicMaterial({ color: '#5C4A3E' });

  const wingsL = new THREE.InstancedMesh(wingGeo, wingMat, butterflyCount);
  const wingsR = new THREE.InstancedMesh(wingGeo, wingMat, butterflyCount);
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, butterflyCount);
  for (const m of [wingsL, wingsR, bodies]) {
    m.frustumCulled = false;
    m.visible = false;
  }

  for (let i = 0; i < butterflyCount; i++) {
    const tint = BLOSSOM_TINTS[i % BLOSSOM_TINTS.length];
    wingsL.setColorAt(i, new THREE.Color(tint));
    wingsR.setColorAt(i, new THREE.Color(tint));
  }
  if (wingsL.instanceColor) wingsL.instanceColor.needsUpdate = true;
  if (wingsR.instanceColor) wingsR.instanceColor.needsUpdate = true;

  // Per-butterfly wandering seeds (radius, phase, speed, height wobble)
  const butterflySeeds = new Float32Array(butterflyCount * 4);
  for (let i = 0; i < butterflyCount; i++) {
    butterflySeeds[i * 4 + 0] = 0.55 + rand() * 0.85;
    butterflySeeds[i * 4 + 1] = rand() * Math.PI * 2;
    butterflySeeds[i * 4 + 2] = 0.5 + rand() * 0.45;
    butterflySeeds[i * 4 + 3] = 0.75 + rand() * 0.5;
  }

  const _pos = new THREE.Vector3();
  const _qYaw = new THREE.Quaternion();
  const _qFlap = new THREE.Quaternion();
  const _qFinal = new THREE.Quaternion();
  const _scaleOne = new THREE.Vector3(1, 1, 1);
  const _scaleFlit = new THREE.Vector3(1, 1, 1);
  const _axisY = new THREE.Vector3(0, 1, 0);
  const _axisX = new THREE.Vector3(1, 0, 0);
  const _mat = new THREE.Matrix4();

  // ------------------------------------------------------------------
  // 2. Skep bees (merged capsule body + head, single instanced mesh)
  // ------------------------------------------------------------------
  const beeCount = isSoftwareGl ? 2 : 4;
  const beeBodyGeo = new THREE.CapsuleGeometry(0.024, 0.055, 2, 6);
  beeBodyGeo.rotateX(Math.PI / 2);
  const beeHeadGeo = new THREE.SphereGeometry(0.018, 6, 6);
  beeHeadGeo.translate(0, 0, 0.055);
  const beeGeo = mergeGeometries([beeBodyGeo, beeHeadGeo], false);
  if (!beeGeo) throw new Error('orchardMicroLife: bee geometry merge failed');
  beeBodyGeo.dispose();
  beeHeadGeo.dispose();
  const beeMat = new THREE.MeshBasicMaterial({ color: '#D9A83F' });
  const beeMesh = new THREE.InstancedMesh(beeGeo, beeMat, beeCount);
  beeMesh.frustumCulled = false;
  beeMesh.visible = false;
  for (let i = 0; i < beeCount; i++) {
    const shade = i % 2 === 0 ? '#D9A83F' : '#C08A2E';
    beeMesh.setColorAt(i, new THREE.Color(shade));
  }
  if (beeMesh.instanceColor) beeMesh.instanceColor.needsUpdate = true;

  group.add(wingsL, wingsR, bodies, beeMesh);

  // Per-bee loop seeds (orbit radius, phase, speed, bob amplitude)
  const beeSeeds = new Float32Array(beeCount * 4);
  for (let i = 0; i < beeCount; i++) {
    beeSeeds[i * 4 + 0] = 0.34 + rand() * 0.42;
    beeSeeds[i * 4 + 1] = rand() * Math.PI * 2;
    beeSeeds[i * 4 + 2] = 0.85 + rand() * 0.5;
    beeSeeds[i * 4 + 3] = 0.06 + rand() * 0.08;
  }

  const rig: OrchardMicroLifeRig = {
    group,
    butterflyCount,
    beeCount,
    update(elapsed: number, opts: OrchardMicroLifeUpdateOptions) {
      const wind = Math.min(1, Math.max(0, opts.windStrength));

      // --- Butterflies ---
      if (opts.butterfliesActive) {
        wingsL.visible = true;
        wingsR.visible = true;
        bodies.visible = true;
        const drift = 0.82 + wind * 0.5;
        for (let i = 0; i < butterflyCount; i++) {
          const a = ORCHARD_BUTTERFLY_ANCHORS[i % ORCHARD_BUTTERFLY_ANCHORS.length];
          const rW = butterflySeeds[i * 4 + 0];
          const ph = butterflySeeds[i * 4 + 1];
          const sp = butterflySeeds[i * 4 + 2];
          const hW = butterflySeeds[i * 4 + 3];
          const t = elapsed * sp * drift + ph;
          const wx = a.x + Math.sin(t * 1.07) * rW * a.r + Math.sin(t * 2.3) * 0.22;
          const wz = a.z + Math.cos(t * 0.87) * rW * a.r * 0.86 + Math.cos(t * 2.1) * 0.18;
          const wy = a.y + Math.sin(t * 1.63) * 0.2 * hW + Math.sin(t * 3.1) * 0.04;
          _pos.set(wx, wy, wz);

          // Face travel direction (analytic velocity yaw)
          const yaw = Math.atan2(
            Math.cos(t * 1.07) * 1.07 + Math.cos(t * 2.3) * 0.51,
            -Math.sin(t * 0.87) * 0.75 - Math.sin(t * 2.1) * 0.38,
          );
          const flap = Math.sin(elapsed * 15.5 + i * 2.2) * 0.86;

          _scaleFlit.setScalar(0.92 + Math.sin(t * 1.31 + i) * 0.08);

          _qYaw.setFromAxisAngle(_axisY, yaw);
          _qFinal.copy(_qYaw);
          _mat.compose(_pos, _qFinal, _scaleFlit);
          bodies.setMatrixAt(i, _mat);

          _qFlap.setFromAxisAngle(_axisX, -flap);
          _qFinal.copy(_qYaw).multiply(_qFlap);
          _mat.compose(_pos, _qFinal, _scaleOne);
          wingsR.setMatrixAt(i, _mat);

          _qFlap.setFromAxisAngle(_axisX, flap);
          // Mirror wing: rotate 180° yaw so the translated root points the other way
          _qYaw.setFromAxisAngle(_axisY, yaw + Math.PI);
          _qFinal.copy(_qYaw).multiply(_qFlap);
          _mat.compose(_pos, _qFinal, _scaleOne);
          wingsL.setMatrixAt(i, _mat);
        }
        wingsL.instanceMatrix.needsUpdate = true;
        wingsR.instanceMatrix.needsUpdate = true;
        bodies.instanceMatrix.needsUpdate = true;
      } else {
        wingsL.visible = false;
        wingsR.visible = false;
        bodies.visible = false;
      }

      // --- Skep bees ---
      if (opts.beesActive) {
        beeMesh.visible = true;
        for (let i = 0; i < beeCount; i++) {
          const orbitR = beeSeeds[i * 4 + 0];
          const ph = beeSeeds[i * 4 + 1];
          const sp = beeSeeds[i * 4 + 2];
          const bob = beeSeeds[i * 4 + 3];
          const t = elapsed * sp + ph;
          // Figure-eight loop around the skep entrance with a leaning tilt
          const bx = ORCHARD_SKEP_ANCHOR.x + Math.sin(t) * orbitR;
          const bz = ORCHARD_SKEP_ANCHOR.z + Math.sin(t * 2) * orbitR * 0.55;
          const by =
            ORCHARD_SKEP_ANCHOR.y +
            Math.sin(t * 1.7) * bob +
            Math.sin(t * 4.3) * bob * 0.4;
          _pos.set(bx, by, bz);
          // Face the loop tangent
          const yaw = Math.atan2(Math.cos(t) * orbitR, Math.cos(t * 2) * orbitR * 1.1);
          _qYaw.setFromAxisAngle(_axisY, yaw);
          _scaleFlit.setScalar(0.9 + Math.sin(t * 2.2 + i) * 0.1);
          _mat.compose(_pos, _qYaw, _scaleFlit);
          beeMesh.setMatrixAt(i, _mat);
        }
        beeMesh.instanceMatrix.needsUpdate = true;
      } else {
        beeMesh.visible = false;
      }

      // The rig owns its group visibility; the canvas only mounts/disposes it.
      group.visible = opts.butterfliesActive || opts.beesActive;
    },
    dispose() {
      wingGeo.dispose();
      wingMat.dispose();
      bodyGeo.dispose();
      bodyMat.dispose();
      beeGeo.dispose();
      beeMat.dispose();
      group.clear();
    },
  };

  rig.update(0, { butterfliesActive: false, beesActive: false, windStrength: 0 });
  return rig;
}
