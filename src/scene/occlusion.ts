/**
 * Occlusion — selective building/vegetation fade (overhaul Phase 2, decision 2).
 *
 * When a registered shell sits between the camera and the player, its materials
 * tween to ~15% opacity so the player stays readable. The palette cache shares
 * material instances scene-wide, so registration CLONES every material once per
 * shell and fades only the clones — the shared originals are never touched
 * (locked by occlusion.test.ts).
 *
 * Probes are interval-scheduled by CameraController.consumeProbeRequest()
 * (≥150 ms cadence or on material yaw change) — never per frame. Three rays
 * (center + ±lateral) distinguish "shell between camera and player" from
 * "shell behind the player" via a distance margin.
 */

import * as THREE from 'three';

export const OCCLUSION_FADED_OPACITY = 0.15;
/** Distance margin: hits closer than (camera→player − margin) occlude. */
const HIT_MARGIN = 0.45;
const LATERAL_OFFSET = 0.45;
const FADE_DAMP = 9;
const OPACITY_EPSILON = 0.995;

export interface OccluderRecord {
  label: string;
  meshes: THREE.Mesh[];
  materials: THREE.Material[];
  baseOpacity: number[];
  fade: number;
  target: number;
}

export interface OcclusionRegistry {
  records: OccluderRecord[];
  /** clone → original, for restore on dispose. */
  originals: Map<THREE.Material, THREE.Material>;
  /** flat raycast target list, rebuilt on registration */
  rayTargets: THREE.Mesh[];
}

export function createOcclusionRegistry(): OcclusionRegistry {
  return { records: [], originals: new Map(), rayTargets: [] };
}

function isSkippableMaterial(mat: THREE.Material): boolean {
  const std = mat as THREE.MeshStandardMaterial;
  // Already-transparent materials (glass, contact shadows, particles) keep
  // their own presentation — fading them adds nothing and can look broken.
  return Boolean(std.transparent && (std.opacity ?? 1) < OPACITY_EPSILON);
}

export function registerOccluder(
  registry: OcclusionRegistry,
  root: THREE.Object3D,
  label: string,
): OccluderRecord | null {
  const record: OccluderRecord = {
    label,
    meshes: [],
    materials: [],
    baseOpacity: [],
    fade: 1,
    target: 1,
  };
  const replacement = new Map<THREE.Material, THREE.Material>();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m || replacement.has(m) || registry.originals.has(m)) continue;
      if (isSkippableMaterial(m)) continue;
      const clone = m.clone();
      registry.originals.set(clone, m);
      replacement.set(m, clone);
      record.materials.push(clone);
      record.baseOpacity.push(clone.opacity);
    }
  });
  if (record.materials.length === 0) return null;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    if (Array.isArray(mesh.material)) {
      let changed = false;
      const next = mesh.material.map((m) => {
        const rep = replacement.get(m);
        if (rep) changed = true;
        return rep ?? m;
      });
      if (changed) {
        record.meshes.push(mesh);
        mesh.material = next;
      }
    } else {
      const rep = replacement.get(mesh.material);
      if (rep) {
        record.meshes.push(mesh);
        mesh.material = rep;
      }
    }
  });
  if (record.meshes.length === 0) return null;
  registry.records.push(record);
  registry.rayTargets.push(...record.meshes);
  return record;
}

/** Freeze-and-restore helper for interior entry: everything back to opaque. */
export function setAllOccluderTargets(registry: OcclusionRegistry, target: number): void {
  for (const record of registry.records) record.target = target;
}

const _probeRaycaster = new THREE.Raycaster();
_probeRaycaster.far = 120;

/**
 * Fire the 3-ray fan from the camera toward the player and mark occluding
 * shells. Allocation-light: only the raycaster's internal hit arrays (interval-
 * scheduled, ≤ ~7/s).
 */
export function probeOcclusion(
  registry: OcclusionRegistry,
  camera: THREE.PerspectiveCamera,
  playerX: number,
  playerY: number,
  playerZ: number,
): void {
  if (registry.records.length === 0) return;
  const dx = playerX - camera.position.x;
  const dy = playerY - camera.position.y;
  const dz = playerZ - camera.position.z;
  const distToPlayer = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (distToPlayer < 0.5) {
    setAllOccluderTargets(registry, 1);
    return;
  }
  const hitRecords = new Set<number>();
  probeRays(registry, camera, playerX, playerY, playerZ, distToPlayer, hitRecords);
  for (let r = 0; r < registry.records.length; r++) {
    registry.records[r].target = hitRecords.has(r) ? OCCLUSION_FADED_OPACITY : 1;
  }
}

const _dirCopy = new THREE.Vector3();
const _lateral = new THREE.Vector3();
const _originCopy = new THREE.Vector3();

function probeRays(
  registry: OcclusionRegistry,
  camera: THREE.PerspectiveCamera,
  playerX: number,
  playerY: number,
  playerZ: number,
  distToPlayer: number,
  hitRecords: Set<number>,
): void {
  _dirCopy.set(playerX - camera.position.x, playerY - camera.position.y, playerZ - camera.position.z).normalize();
  _lateral.set(-_dirCopy.z, 0, _dirCopy.x).normalize().multiplyScalar(LATERAL_OFFSET);
  for (let i = 0; i < 3; i++) {
    _originCopy.copy(camera.position);
    if (i === 1) _originCopy.add(_lateral);
    if (i === 2) _originCopy.sub(_lateral);
    _probeRaycaster.set(_originCopy, _dirCopy);
    const hits = _probeRaycaster.intersectObjects(registry.rayTargets, false);
    for (const hit of hits) {
      if (hit.distance < distToPlayer - HIT_MARGIN) {
        const recIndex = registry.records.findIndex((r) => r.meshes.includes(hit.object as THREE.Mesh));
        if (recIndex >= 0) hitRecords.add(recIndex);
        break; // first (closest) hit along this ray is the occluder
      }
    }
  }
}

/** Per-frame fade tween (cheap: ≤ ~10 records × few materials). */
export function updateOcclusionFades(registry: OcclusionRegistry, dt: number): void {
  for (const record of registry.records) {
    if (record.fade !== record.target) {
      record.fade = THREE.MathUtils.damp(record.fade, record.target, FADE_DAMP, dt);
      if (Math.abs(record.fade - record.target) < 0.004) record.fade = record.target;
      const faded = record.fade < OPACITY_EPSILON;
      for (let i = 0; i < record.materials.length; i++) {
        const mat = record.materials[i];
        mat.opacity = record.baseOpacity[i] * record.fade;
        mat.transparent = faded;
        mat.depthWrite = !faded;
      }
    }
  }
}

/** Restore every original material (canvas teardown) and clear the registry. */
export function disposeOcclusion(registry: OcclusionRegistry): void {
  for (const record of registry.records) {
    for (const mesh of record.meshes) {
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((m) => registry.originals.get(m) ?? m);
      } else {
        const original = registry.originals.get(mesh.material);
        if (original) mesh.material = original;
      }
    }
    for (const clone of record.materials) clone.dispose();
  }
  registry.records.length = 0;
  registry.rayTargets.length = 0;
  registry.originals.clear();
}
