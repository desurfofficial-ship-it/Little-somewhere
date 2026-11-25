/**
 * Quiet fishing bank rigs (Stage 3 fishing v1.1).
 *
 * Small static creel-and-rod rigs marking the two quiet waters:
 *   - willow_jetty_rig   — Mirror Pond's south shore (v1 slice; positions pinned)
 *   - west_brook_bank_rig — the culvert mouth on the west lawn (v1.1)
 *
 * Extracted from environmentRenderer.ts so the placement contract is
 * structurally testable headlessly (tsx --test, three.js as pure math — no
 * WebGL required to build groups). Rendering discipline: built once at scene
 * construction (rain/petal constructor precedent) — zero per-frame work,
 * 5 meshes per rig, TWO shared color-only materials across both rigs, no new
 * shader programs, no textures. Both rigs parent to exteriorRoot so they hide
 * indoors via the existing toggle.
 *
 * Visibility contract (browser QA lesson): the brook rig's meshes sit ~0.9 u
 * WEST of the bridge's rail band so the culvert-bank corner is never inside
 * the bridge's visual shadow — from the default NE camera, from the bridge
 * deck and from the south lawn the creel/rod/planks stay clear of occluders.
 */
import * as THREE from 'three';

export interface FishingBankRigOffsets {
  /** i-th plank local offset: (plankDx, plankDz + i * plankStep). */
  plankDx: number;
  plankDz: number;
  plankStep: number;
  creelDx: number;
  creelDz: number;
  rodDx: number;
  rodDz: number;
}

export interface FishingBankRigPlacement {
  /** Rig group name — matches the worldMap prop id + '_rig' convention. */
  name: string;
  /** Rig anchor = the worldMap prop standing point. */
  x: number;
  z: number;
  /** Yaw rotating the rig's local offsets around the anchor. */
  rotY: number;
  offsets: FishingBankRigOffsets;
}

export const FISHING_BANK_RIG_PLACEMENTS: readonly FishingBankRigPlacement[] = [
  // v1 Willow Jetty: rotY 0 + these offsets reproduce the original absolute
  // coordinates byte-for-byte (planks x -0.35 / z 16.95..18.05, creel
  // -1.05/17.85, rod -0.62/17.75) — visual regression lock.
  {
    name: 'willow_jetty_rig',
    x: -0.8,
    z: 17.6,
    rotY: 0,
    offsets: {
      plankDx: 0.45,
      plankDz: -0.65,
      plankStep: 0.55,
      creelDx: -0.25,
      creelDz: 0.25,
      rodDx: 0.18,
      rodDz: 0.15,
    },
  },
  // v1.1 West Brook Bank: with rotY = +PI/2 local +z maps to world +x, so the
  // plank trio steps from x -4.90 WESTWARD to x -6.00 at z 13.45 — the bank
  // corner clear of the bridge's rail band (-3.7..-3.58) and its visual
  // shadow; creel rests at (-5.10, 14.15); rod leans over the bank at
  // (-5.20, 13.72), angled toward the culvert outflow (water west tip
  // x -3.58) without touching it. All meshes on walkable ground (RIG-05),
  // every mesh west of x -3.7 (RIG-03).
  {
    name: 'west_brook_bank_rig',
    x: -4.45,
    z: 13.9,
    rotY: Math.PI / 2,
    offsets: {
      plankDx: 0.45,
      plankDz: -0.45,
      plankStep: -0.55,
      creelDx: -0.25,
      creelDz: -0.65,
      rodDx: 0.18,
      rodDz: -0.75,
    },
  },
];

/**
 * Builds one bank rig: three weathered planks, a wicker creel, and a rod
 * leaned against the bank. Offsets are local to the anchor and rotated by rotY.
 */
export function buildFishingBankRig(
  placement: FishingBankRigPlacement,
  woodMat: THREE.MeshStandardMaterial,
  wickerMat: THREE.MeshStandardMaterial,
): THREE.Group {
  const rig = new THREE.Group();
  rig.name = placement.name;
  const cos = Math.cos(placement.rotY);
  const sin = Math.sin(placement.rotY);
  const place = (mesh: THREE.Mesh, dx: number, dz: number) => {
    mesh.position.set(
      placement.x + dx * cos + dz * sin,
      mesh.position.y,
      placement.z - dx * sin + dz * cos,
    );
    mesh.rotation.y += placement.rotY;
    rig.add(mesh);
  };
  const o = placement.offsets;
  for (let i = 0; i < 3; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.5), woodMat);
    plank.position.set(0, 0.1 + i * 0.004, 0);
    plank.rotation.y = 0.06;
    plank.rotation.z = -0.012;
    place(plank, o.plankDx, o.plankDz + i * o.plankStep);
  }
  const creel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.22, 7), wickerMat);
  creel.position.set(0, 0.13, 0);
  place(creel, o.creelDx, o.creelDz);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.03, 1.5, 5), woodMat);
  rod.position.set(0, 0.62, 0);
  rod.rotation.z = 0.38;
  rod.rotation.x = -0.1;
  place(rod, o.rodDx, o.rodDz);
  return rig;
}
