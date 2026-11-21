import * as THREE from 'three';

/**
 * Static contact-shadow instancing (Doc 06 §3.4 — BUILD 02 Workstream E, item 8.3).
 *
 * BUILD 01 measured the diorama at ≈2,242 draw calls and identified the ~dozens
 * of one-off contact-shadow quads as "the largest un-instanced category" (the
 * audit's words; this census found 71 `addContactShadow` call sites, ≈98 outdoor
 * discs + 26 interior discs at runtime). Every disc is a static 1-quad
 * `MeshBasicMaterial` plane sharing one radial texture — differing only in
 * width/depth (instance scale), height (instance position) and opacity (bucket).
 *
 * This module keeps the visual output IDENTICAL while collapsing each
 * opacity-bucket per visibility subtree into ONE `InstancedMesh` draw call:
 *  - static discs register through `addStaticContactShadow` (drop-in twin of
 *    `addContactShadow`),
 *  - dynamic discs (characters, carried items, outcome-toggled groups) keep the
 *    original per-mesh helper,
 *  - `flushStaticContactShadows` runs once after the scene is assembled (and,
 *    if ever needed, again — buckets rebuild from the persistent records).
 *
 * Visibility correctness: a disc that must hide/show with a toggled subtree
 * (interior rigs) is batched into an `InstancedMesh` parented INSIDE that
 * subtree — mark such subtree roots with `userData.contactBatchRoot = true` and
 * every registered disc beneath them batches into that root (each interior
 * stays one bucket family of its own and inherits the rig's visibility). Discs
 * under outcome-toggled groups (orchard gathering diorama, café tables) are NOT
 * registered at all.
 *
 * Build-time-only cost (matrix reads + bucket rebuild); zero per-frame cost;
 * software-GL safe (same MeshBasicMaterial program, one per opacity value).
 */

interface PendingDisc {
  /** The exact same 1-quad mesh `addContactShadow` would have created. */
  mesh: THREE.Mesh;
  opacity: number;
  /** Nearest enclosing subtree root marked `userData.contactBatchRoot` (or null). */
  boundary: THREE.Object3D | null;
}

/** Persisted disc transform — survives flush so re-flushes rebuild all buckets. */
interface DiscRecord {
  matrix: THREE.Matrix4;
  opacity: number;
  boundary: THREE.Object3D | null;
}

/** Shared unit disc geometry (1 quad, pre-rotated flat). Instance scale = (width, depth, 1). */
function createUnitDiscGeometry(): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

export class ContactShadowBatch {
  private readonly pending: PendingDisc[] = [];
  private readonly records: DiscRecord[] = [];
  private readonly batches: THREE.InstancedMesh[] = [];
  private sourceTexture: THREE.Texture | null = null;
  private flushed = false;

  /**
   * Creates the identical disc mesh `addContactShadow` would create (same
   * geometry params, material flags, texture, y offset) and registers it for
   * instanced batching at flush time. The mesh parents to `parent` immediately
   * so world transforms stay correct for any later repositioning.
   */
  add(
    parent: THREE.Object3D,
    shadowTex: THREE.Texture,
    width: number,
    depth: number,
    opacity = 0.48,
    y = 0.018,
  ): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(width, depth);
    const mat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    parent.add(mesh);

    let boundary: THREE.Object3D | null = null;
    for (let o: THREE.Object3D | null = parent; o; o = o.parent) {
      if (o.userData?.contactBatchRoot === true) {
        boundary = o;
        break;
      }
    }
    this.pending.push({ mesh, opacity, boundary });
    this.sourceTexture = shadowTex;
    return mesh;
  }

  /**
   * Collapses every registered disc into per-(subtree, opacity) InstancedMesh
   * buckets, removes the individual meshes and disposes their private
   * geometry/material. Calling again after new registrations rebuilds ALL
   * buckets from the persistent records (the original meshes are consumed on
   * their first flush; only their baked transforms survive).
   *
   * Matrices are read from the live scene graph (`updateWorldMatrix(true,
   * false)` climbs ancestors), so the caller flushes AFTER all placement.
   */
  flush(defaultRoot: THREE.Object3D): void {
    if (this.pending.length === 0 && !this.flushed) return;
    this.disposeBatches();

    // Bake every pending disc's final world transform into a persistent record.
    for (const { mesh, opacity, boundary } of this.pending) {
      mesh.updateWorldMatrix(true, false);
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scl = new THREE.Vector3();
      mesh.matrixWorld.decompose(pos, quat, scl);
      const geo = mesh.geometry as THREE.PlaneGeometry;
      const params = geo.parameters as { width: number; height: number };
      // The instance matrix pre-multiplies the unit disc by (width, depth, 1)
      // in the disc's local frame — compose(T, R, S) applies S before R, which
      // is exactly how the original PlaneGeometry(width, depth) behaved under
      // its mesh rotation, so the mapped geometry is identical.
      const matrix = new THREE.Matrix4().compose(
        pos,
        quat,
        new THREE.Vector3(params.width, params.height, 1),
      );
      this.records.push({ matrix, opacity, boundary });
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.pending.length = 0;

    // Bucket key: visibility subtree + exact opacity (one material per key).
    const buckets = new Map<
      string,
      { root: THREE.Object3D; opacity: number; matrices: THREE.Matrix4[] }
    >();
    for (const d of this.records) {
      const root = d.boundary ?? defaultRoot;
      const key = `${root.uuid}:${d.opacity.toFixed(3)}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { root, opacity: d.opacity, matrices: [] };
        buckets.set(key, bucket);
      }
      bucket.matrices.push(d.matrix);
    }

    const unitGeo = createUnitDiscGeometry();
    for (const bucket of buckets.values()) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.sourceTexture,
        transparent: true,
        opacity: bucket.opacity,
        depthWrite: false,
      });
      const inst = new THREE.InstancedMesh(unitGeo, mat, bucket.matrices.length);
      inst.name = 'instanced_contact_shadows';
      for (let i = 0; i < bucket.matrices.length; i++) {
        inst.setMatrixAt(i, bucket.matrices[i]);
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.frustumCulled = false; // buckets span the whole diorama; never pop per-frame
      bucket.root.add(inst);
      this.batches.push(inst);
    }

    this.flushed = true;
  }

  private disposeBatches(): void {
    for (const inst of this.batches) {
      inst.parent?.remove(inst);
      inst.geometry.dispose();
      (inst.material as THREE.Material).dispose();
      inst.dispose();
    }
    this.batches.length = 0;
  }

  /** Teardown (scene unmount): removes buckets and clears records. */
  dispose(): void {
    this.disposeBatches();
    for (const { mesh } of this.pending) {
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.pending.length = 0;
    this.records.length = 0;
    this.flushed = false;
  }

  /** Test/QA introspection: number of instanced buckets after flush. */
  get batchCount(): number {
    return this.batches.length;
  }

  /** Test/QA introspection: total instanced discs across buckets. */
  get instancedDiscCount(): number {
    return this.batches.reduce((sum, b) => sum + b.count, 0);
  }

  get isFlushed(): boolean {
    return this.flushed;
  }
}

/**
 * Scene-level batch singleton. Builders register discs at construction time
 * (inside their own group subtrees); `NeighborhoodCanvas` flushes once after
 * the full diorama is assembled and disposes on unmount.
 */
export const staticContactShadows = new ContactShadowBatch();

/** Drop-in twin of `addContactShadow` for always-visible, static discs. */
export function addStaticContactShadow(
  parent: THREE.Object3D,
  shadowTex: THREE.Texture,
  width: number,
  depth: number,
  opacity = 0.48,
  y = 0.018,
): THREE.Mesh {
  return staticContactShadows.add(parent, shadowTex, width, depth, opacity, y);
}

/** Flushes the scene-level batch after scene assembly. */
export function flushStaticContactShadows(root: THREE.Object3D): void {
  staticContactShadows.flush(root);
}
