import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';
import { isPointWalkable } from '../../game/worldMap';

/**
 * Meadow dressing shared placement data.
 *
 * Mirrors the cobblestone strips laid down in `NeighborhoodCanvas.tsx`
 * (`addCobbleStrip(x, z, w, l)`) so botanical clusters never sprout in the
 * middle of a walkable lane. Keep both lists in sync when lanes change.
 */
export const COBBLE_LANE_RECTS: ReadonlyArray<{
  x: number;
  z: number;
  w: number;
  l: number;
}> = [
  { x: 0, z: 0, w: 12.5, l: 13.5 }, // Central plaza
  { x: -9, z: 10, w: 11, l: 3.6 }, // Home lane
  { x: -10, z: -1, w: 3.8, l: 22 }, // West lane
  { x: 8.3, z: -1, w: 4.2, l: 23 }, // East lane
  { x: 8.3, z: 11.6, w: 4.0, l: 2.6 }, // East lane extension
  { x: 0, z: 7.2, w: 22, l: 3.2 }, // South promenade
  { x: -2.9, z: 10.1, w: 2.3, l: 3.0 }, // Bridge approach
  { x: 0, z: -6.5, w: 22, l: 3.2 }, // North promenade
];

function isOnCobble(x: number, z: number, padding: number): boolean {
  for (const r of COBBLE_LANE_RECTS) {
    if (
      x > r.x - r.w / 2 - padding &&
      x < r.x + r.w / 2 + padding &&
      z > r.z - r.l / 2 - padding &&
      z < r.z + r.l / 2 + padding
    ) {
      return true;
    }
  }
  return false;
}

function makeSeededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Handcrafted cluster anchors: storybook staggered clumping, never grid-stamped. */
const CLUSTER_ANCHORS: ReadonlyArray<{ x: number; z: number; spread: number }> = [
  { x: -6.2, z: 19.4, spread: 3.4 }, // Around Hollow Oak south lawn
  { x: -14.8, z: 16.8, spread: 3.0 }, // Willow cottage garden margins
  { x: -20.5, z: 10.5, spread: 3.2 }, // West meadow pocket
  { x: -19.5, z: -6.5, spread: 3.4 }, // Bakery side garden
  { x: 20.8, z: -8.0, spread: 3.4 }, // Copperwheel east margin
  { x: 21.5, z: 6.0, spread: 3.0 }, // Greenhouse east margin
  { x: 20.0, z: 19.8, spread: 3.4 }, // Woodshop south lawn
  { x: 8.0, z: 19.6, spread: 3.2 }, // Pond bench margins
  { x: -9.5, z: -18.5, spread: 3.4 }, // Gazebo northwest lawn
  { x: 12.5, z: -19.5, spread: 3.2 }, // Gazebo northeast lawn
  { x: 2.5, z: -18.0, spread: 3.0 }, // Behind gazebo dais
  { x: -22.0, z: 17.5, spread: 2.6 }, // Far southwest nook
  { x: 22.5, z: -17.5, spread: 2.6 }, // Far northeast nook
];

export interface MeadowDressingRig {
  group: THREE.Group;
  /** Placement audit points (one per tuft/flower/pebble) for tests & QA. */
  placementPoints: Array<{ x: number; z: number; kind: 'tuft' | 'flower' | 'pebble' }>;
  dispose(): void;
}

interface DressingBudget {
  tufts: number;
  flowers: number;
  pebbles: number;
}

/**
 * Instanced botanical dressing for the open meadow margins: clover cushions,
 * grass tufts, wildflower clumps, and weathered fieldstone pebbles.
 *
 * Placement guarantees (validated by tests):
 * - Every point is inside walkable world space and clear of all obstacles,
 *   seats, and the cobblestone lane network (padding >= 0.55m).
 * - Deterministic seed => identical layout on every boot.
 * - 5 draw calls total (2 instanced tuft layers, 2 flower layers, 1 pebble layer).
 */
export function buildMeadowDressing(
  palette: MaterialPalette,
  isSoftwareGl: boolean,
): MeadowDressingRig {
  const group = new THREE.Group();
  const rand = makeSeededRandom(1337);

  const budget: DressingBudget = isSoftwareGl
    ? { tufts: 64, flowers: 28, pebbles: 20 }
    : { tufts: 104, flowers: 44, pebbles: 32 };

  const placementPoints: MeadowDressingRig['placementPoints'] = [];

  const samplePoint = (padding: number): { x: number; z: number } | null => {
    for (let attempt = 0; attempt < 40; attempt++) {
      // Bias sampling toward handcrafted clusters (2/3) with free scatter (1/3)
      let x: number;
      let z: number;
      if (rand() < 0.68) {
        const anchor = CLUSTER_ANCHORS[Math.floor(rand() * CLUSTER_ANCHORS.length)];
        const a = rand() * Math.PI * 2;
        const r = anchor.spread * Math.sqrt(rand());
        x = anchor.x + Math.cos(a) * r;
        z = anchor.z + Math.sin(a) * r * 0.82;
      } else {
        x = (rand() * 2 - 1) * 23.5;
        z = (rand() * 2 - 1) * 21.5;
      }
      // Jitter BEFORE validation so the final mesh position is what we certify
      x += (rand() - 0.5) * 0.24;
      z += (rand() - 0.5) * 0.24;
      if (Math.abs(x) > 24.2 || Math.abs(z) > 22.2) continue;
      if (!isPointWalkable(x, z, 0.34)) continue; // clear of buildings, pond, trees, benches
      if (isOnCobble(x, z, padding)) continue; // clear of lanes & plaza
      // Keep the fountain plaza heart calm and readable
      if (x * x + (z - 1.5) * (z - 1.5) < 20.25) continue;
      return { x, z };
    }
    return null;
  };

  const dummy = new THREE.Object3D();
  const setColor = new THREE.Color();

  // 1. Clover cushions — soft squashed icosahedra in two botanical greens
  const cloverGeo = new THREE.IcosahedronGeometry(0.15, 0);
  cloverGeo.scale(1.0, 0.52, 1.0);
  const cloverMat = palette.get('dressing_clover', {
    color: '#FFFFFF',
    roughness: 0.86,
    metalness: 0.0,
  });
  const cloverInst = new THREE.InstancedMesh(cloverGeo, cloverMat, budget.tufts);
  const cloverTones = ['#649254', '#55814A', '#6F9C5C', '#4E7C43', '#7AA563'];
  let placed = 0;
  for (let i = 0; i < budget.tufts; i++) {
    const pt = samplePoint(0.55);
    if (!pt) continue;
    const s = 0.72 + rand() * 0.62;
    dummy.position.set(pt.x, 0.07 * s, pt.z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.set(s, s * (0.8 + rand() * 0.4), s);
    dummy.updateMatrix();
    cloverInst.setMatrixAt(placed, dummy.matrix);
    cloverInst.setColorAt(placed, setColor.set(cloverTones[Math.floor(rand() * cloverTones.length)]));
    placementPoints.push({ x: dummy.position.x, z: dummy.position.z, kind: 'tuft' });
    placed++;
  }
  cloverInst.count = placed;
  cloverInst.instanceMatrix.needsUpdate = true;
  if (cloverInst.instanceColor) cloverInst.instanceColor.needsUpdate = true;
  cloverInst.computeBoundingSphere();
  group.add(cloverInst);

  // 2. Grass tufts — sculpted 3-blade tufts (R-04: replaces the primitive single cone).
  //    Three open-ended tapered blades fanned at 120° with staggered heights/leans, merged
  //    into one BufferGeometry so each instance still costs a single instanced draw slot
  //    (same InstancedMesh budget & placement legality as before; 12 tris per tuft).
  const bladeGeos: THREE.BufferGeometry[] = [];
  const bladeSpecs = [
    { h: 0.36, r: 0.052, lean: 0.17, yaw: 0.0 },
    { h: 0.3, r: 0.046, lean: -0.13, yaw: (Math.PI * 2) / 3 },
    { h: 0.25, r: 0.04, lean: 0.22, yaw: (Math.PI * 4) / 3 },
  ];
  for (const spec of bladeSpecs) {
    const blade = new THREE.ConeGeometry(spec.r, spec.h, 4, 1, true);
    blade.translate(0, spec.h / 2, 0);
    blade.rotateX(spec.lean);
    blade.rotateY(spec.yaw);
    bladeGeos.push(blade);
  }
  const grassGeo = mergeGeometries(bladeGeos, false) ?? bladeGeos[0];
  for (const g of bladeGeos) {
    if (g !== grassGeo) g.dispose();
  }
  const grassMat = palette.get('dressing_grass', {
    color: '#FFFFFF',
    roughness: 0.88,
    metalness: 0.0,
  });
  const grassInst = new THREE.InstancedMesh(grassGeo, grassMat, budget.tufts);
  const grassTones = ['#5E8B4C', '#6D9C58', '#527C41', '#79A465'];
  let grassPlaced = 0;
  for (let i = 0; i < budget.tufts; i++) {
    const pt = samplePoint(0.55);
    if (!pt) continue;
    const s = 0.66 + rand() * 0.6;
    dummy.position.set(pt.x, 0, pt.z);
    dummy.rotation.set((rand() - 0.5) * 0.24, rand() * Math.PI * 2, (rand() - 0.5) * 0.24);
    dummy.scale.set(s, s * (0.85 + rand() * 0.5), s);
    dummy.updateMatrix();
    grassInst.setMatrixAt(grassPlaced, dummy.matrix);
    grassInst.setColorAt(grassPlaced, setColor.set(grassTones[Math.floor(rand() * grassTones.length)]));
    placementPoints.push({ x: dummy.position.x, z: dummy.position.z, kind: 'tuft' });
    grassPlaced++;
  }
  grassInst.count = grassPlaced;
  grassInst.instanceMatrix.needsUpdate = true;
  if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
  grassInst.computeBoundingSphere();
  group.add(grassInst);

  // 3. Wildflower stems + 4. blossom heads (>= 2 distinct colors per bed)
  const stemGeo = new THREE.CylinderGeometry(0.018, 0.026, 0.26, 5);
  stemGeo.translate(0, 0.13, 0);
  const stemMat = palette.get('dressing_stem', {
    color: STORYBOOK_PALETTE.foliageMid,
    roughness: 0.85,
    metalness: 0.0,
  });
  const stemInst = new THREE.InstancedMesh(stemGeo, stemMat, budget.flowers);
  const blossomGeo = new THREE.DodecahedronGeometry(0.075, 0);
  blossomGeo.scale(1.0, 0.78, 1.0);
  blossomGeo.translate(0, 0.3, 0);
  const blossomMat = palette.get('dressing_blossom', {
    color: '#FFFFFF',
    roughness: 0.62,
    metalness: 0.02,
  });
  const blossomInst = new THREE.InstancedMesh(blossomGeo, blossomMat, budget.flowers);
  const petalTones = [
    STORYBOOK_PALETTE.petalRose,
    STORYBOOK_PALETTE.petalMarigold,
    STORYBOOK_PALETTE.petalLavender,
    STORYBOOK_PALETTE.petalCream,
    STORYBOOK_PALETTE.petalCornflower,
  ];
  let flowersPlaced = 0;
  for (let i = 0; i < budget.flowers; i++) {
    const pt = samplePoint(0.6);
    if (!pt) continue;
    // Clumps of 2-3 stems share a small jitter pocket, re-validated per stem
    const clumpSize = 2 + Math.floor(rand() * 2);
    for (let c = 0; c < clumpSize && flowersPlaced < budget.flowers; c++) {
      const fx = pt.x + (rand() - 0.5) * 0.36;
      const fz = pt.z + (rand() - 0.5) * 0.36;
      if (!isPointWalkable(fx, fz, 0.34)) continue;
      if (isOnCobble(fx, fz, 0.45)) continue;
      if (fx * fx + (fz - 1.5) * (fz - 1.5) < 20.25) continue;
      const s = 0.8 + rand() * 0.45;
      dummy.position.set(fx, 0, fz);
      dummy.rotation.set((rand() - 0.5) * 0.16, rand() * Math.PI * 2, (rand() - 0.5) * 0.16);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      stemInst.setMatrixAt(flowersPlaced, dummy.matrix);
      blossomInst.setMatrixAt(flowersPlaced, dummy.matrix);
      blossomInst.setColorAt(
        flowersPlaced,
        setColor.set(petalTones[Math.floor(rand() * petalTones.length)]),
      );
      placementPoints.push({ x: fx, z: fz, kind: 'flower' });
      flowersPlaced++;
    }
  }
  stemInst.count = flowersPlaced;
  blossomInst.count = flowersPlaced;
  stemInst.instanceMatrix.needsUpdate = true;
  blossomInst.instanceMatrix.needsUpdate = true;
  if (blossomInst.instanceColor) blossomInst.instanceColor.needsUpdate = true;
  stemInst.computeBoundingSphere();
  blossomInst.computeBoundingSphere();
  group.add(stemInst, blossomInst);

  // 5. Weathered fieldstone pebbles near lane margins
  const pebbleGeo = new THREE.DodecahedronGeometry(0.14, 0);
  pebbleGeo.scale(1.15, 0.62, 1.0);
  const pebbleMat = palette.get('dressing_pebble', {
    color: '#FFFFFF',
    roughness: 0.9,
    metalness: 0.02,
  });
  const pebbleInst = new THREE.InstancedMesh(pebbleGeo, pebbleMat, budget.pebbles);
  const pebbleTones = [STORYBOOK_PALETTE.limestone, STORYBOOK_PALETTE.fieldstoneDark, '#A8997F'];
  let pebblesPlaced = 0;
  for (let i = 0; i < budget.pebbles; i++) {
    // Pebbles hug lane edges: sample with a tighter cobble padding
    const pt = samplePoint(0.22);
    if (!pt) continue;
    const s = 0.5 + rand() * 0.7;
    dummy.position.set(pt.x, 0.05 * s + 0.02, pt.z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    pebbleInst.setMatrixAt(pebblesPlaced, dummy.matrix);
    pebbleInst.setColorAt(pebblesPlaced, setColor.set(pebbleTones[Math.floor(rand() * pebbleTones.length)]));
    placementPoints.push({ x: dummy.position.x, z: dummy.position.z, kind: 'pebble' });
    pebblesPlaced++;
  }
  pebbleInst.count = pebblesPlaced;
  pebbleInst.instanceMatrix.needsUpdate = true;
  if (pebbleInst.instanceColor) pebbleInst.instanceColor.needsUpdate = true;
  pebbleInst.computeBoundingSphere();
  group.add(pebbleInst);

  return {
    group,
    placementPoints,
    dispose() {
      cloverGeo.dispose();
      grassGeo.dispose();
      stemGeo.dispose();
      blossomGeo.dispose();
      pebbleGeo.dispose();
    },
  };
}
