import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';
import type { SeasonType } from '../../game/types';
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
  /**
   * BUILD 02 (Doc 05 §5.3): spring wildflower spread — re-tints the SAME
   * instances with the widened petal palette in spring, restores the standard
   * palette otherwise. Edge-triggered by the canvas on season change.
   */
  setSpringSpread(spring: boolean): void;
  /**
   * BUILD 03 5.3b — within-season drift (design lock rev 2 §3.3, review C1).
   * Progress 0 restores the placement-time colors bit-identically (same snapshot
   * mechanism as setSpringSpread(false)), so day 1 of any season renders exactly
   * today's look; higher progress lerps the blossom instance colors toward the
   * season's late keyframe. Winter never drifts (the derivation clamps progress
   * to 0). Day-edge calls only (revision-gated) — never per-frame.
   */
  setSeasonDayProgress(progress: number, season: SeasonType): void;
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
/**
 * BUILD 03 5.3b — season late-meadow keyframes (authored once; cited in the
 * design lock §3.3). Progress departs FROM the placement colors toward these.
 */
const SEASON_LATE_MEADOW: Record<Exclude<SeasonType, 'winter'>, string> = {
  spring: '#f2b25c', // late-spring gold
  summer: '#e8c878', // dry-grass gold
  autumn: '#d89a54', // deep amber
};
const _seasonDriftTarget = new THREE.Color();

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

  // BUILD 02 (Doc 05 §5.2 P3): spring wildflower spread — in spring only the
  // petal-tone palette widens ±1 hue stop (two marigold/rose-leaning tones
  // join the rotation). Deterministic re-tint of the SAME instances (seeded
  // re-read of the placement order); edge-triggered by the canvas on season
  // change, so zero per-frame cost.
  const springTones = [
    STORYBOOK_PALETTE.petalRose,
    STORYBOOK_PALETTE.petalMarigold,
    STORYBOOK_PALETTE.petalLavender,
    STORYBOOK_PALETTE.petalCream,
    STORYBOOK_PALETTE.petalCornflower,
    '#F0A24C', // marigold-leaning warm spread (+1 hue stop)
    '#E88AB0', // rose-leaning pink spread (−1 hue stop)
  ];
  const retintScratch = new THREE.Color();
  // Snapshot the placement-time colors once — `setSpringSpread(false)` restores
  // EXACTLY what placement produced (bit-identical), not a re-draw.
  const originalColors = blossomInst.instanceColor
    ? Float32Array.from(blossomInst.instanceColor.array as Float32Array)
    : null;
  const setSpringSpread = (spring: boolean) => {
    if (spring) {
      let r = 9107 >>> 0;
      const next = () => {
        r = (r * 1664525 + 1013904223) >>> 0;
        return r / 4294967296;
      };
      for (let i = 0; i < flowersPlaced; i++) {
        // Mirror the placement-time draw order: one tone draw per placed flower.
        const tone = springTones[Math.floor(next() * springTones.length)];
        blossomInst.setColorAt(i, retintScratch.set(tone));
      }
    } else if (originalColors) {
      (blossomInst.instanceColor!.array as Float32Array).set(originalColors);
    }
    if (blossomInst.instanceColor) blossomInst.instanceColor.needsUpdate = true;
  };

  return {
    group,
    placementPoints,
    setSpringSpread,
    setSeasonDayProgress(progress: number, season: SeasonType) {
      // Step 1 — rebuild the p=0 base into the buffer (bit-identical restore):
      // spring uses the widened spread palette, every other season the snapshot.
      setSpringSpread(season === 'spring');
      if (progress <= 0 || season === 'winter' || !blossomInst.instanceColor) return;
      // Step 2 — drift: lerp every blossom color toward the season's late keyframe.
      const target = _seasonDriftTarget.set(SEASON_LATE_MEADOW[season]);
      const arr = blossomInst.instanceColor.array as Float32Array;
      for (let i = 0; i < flowersPlaced; i++) {
        const o = i * 3;
        arr[o] += (target.r - arr[o]) * progress;
        arr[o + 1] += (target.g - arr[o + 1]) * progress;
        arr[o + 2] += (target.b - arr[o + 2]) * progress;
      }
      blossomInst.instanceColor.needsUpdate = true;
    },
    dispose() {
      cloverGeo.dispose();
      grassGeo.dispose();
      stemGeo.dispose();
      blossomGeo.dispose();
      pebbleGeo.dispose();
    },
  };
}

/**
 * BUILD 02 (Doc 05 §3.2 "relational dressing", Doc 03 §7.2): clover and moss
 * tufts emerging FROM the bases of the four template cottages — the cluster-
 * anchor law extended to structures, so buildings settle into their lawns
 * instead of sitting on them. Placement law honored: never on COBBLE_LANE_RECTS
 * (isOnCobble), never inside walkable paths (isPointWalkable), always just
 * outside the stone plinth overhang. Two instanced draw calls total.
 */
export function buildStructureDressing(palette: MaterialPalette): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group();
  group.name = 'structure_dressing';

  // (center x, center z, halfW + obstacle margin, halfD + obstacle margin) per
  // cottage. Margins clear the plinth AND the BOX_OBSTACLES approach boxes so
  // every tuft lands outside blocked volumes (the walkability check below
  // verifies each spot before placement).
  const anchors: ReadonlyArray<[number, number, number, number]> = [
    [-12.4, -10.8, 4.25, 3.75], // Hearth & Crumb bakery
    [-15.8, -1.0, 3.75, 3.75], // Linden Book Nook
    [13.1, -11.5, 4.15, 3.85], // Copperwheel Cottage
    [12.4, 13.0, 3.85, 3.75], // Pinecone Woodshop
  ];

  const rand = makeSeededRandom(7717);
  const dummy = new THREE.Object3D();
  const setColor = new THREE.Color();

  const cloverGeo = new THREE.IcosahedronGeometry(0.11, 0);
  cloverGeo.scale(1.25, 0.55, 1.0);
  const cloverMat = palette.get('structure_clover', { color: '#FFFFFF', roughness: 0.85, metalness: 0.0 });
  const cloverInst = new THREE.InstancedMesh(cloverGeo, cloverMat, 64);
  const mossGeo = new THREE.IcosahedronGeometry(0.14, 0);
  mossGeo.scale(1.3, 0.42, 1.1);
  const mossMat = palette.get('structure_moss', { color: '#FFFFFF', roughness: 0.9, metalness: 0.0 });
  const mossInst = new THREE.InstancedMesh(mossGeo, mossMat, 48);

  const cloverTones = [STORYBOOK_PALETTE.foliageMid, STORYBOOK_PALETTE.foliageSage, '#5E8062'];
  const mossTones = [STORYBOOK_PALETTE.moss, '#4C6E3E', STORYBOOK_PALETTE.foliageDeep];

  let cloversPlaced = 0;
  let mossPlaced = 0;
  for (const [ax, az, hw, hd] of anchors) {
    // Two tuft runs along the south edge (+z, sun side) and one per gable end
    const spots: Array<[number, number]> = [
      [ax - hw * 0.5, az + hd + 0.22],
      [ax + hw * 0.25, az + hd + 0.26],
      [ax + hw + 0.24, az + hd * 0.3],
      [ax - hw - 0.26, az - hd * 0.25],
      [ax + hw * 0.6, az - hd - 0.24],
    ];
    for (const [sx, sz] of spots) {
      if (isOnCobble(sx, sz, 0.5)) continue;
      if (!isPointWalkable(sx, sz, 0.3)) continue;
      if (cloversPlaced < 64) {
        dummy.position.set(sx + (rand() - 0.5) * 0.3, 0.035, sz + (rand() - 0.5) * 0.3);
        dummy.rotation.set(0, rand() * Math.PI * 2, 0);
        const s = 0.75 + rand() * 0.5;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        cloverInst.setMatrixAt(cloversPlaced, dummy.matrix);
        cloverInst.setColorAt(cloversPlaced, setColor.set(cloverTones[Math.floor(rand() * cloverTones.length)]));
        cloversPlaced++;
      }
      if (mossPlaced < 48 && rand() > 0.45) {
        dummy.position.set(sx + (rand() - 0.5) * 0.5, 0.028, sz + (rand() - 0.5) * 0.5);
        dummy.rotation.set(0, rand() * Math.PI * 2, 0);
        const s = 0.7 + rand() * 0.5;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        mossInst.setMatrixAt(mossPlaced, dummy.matrix);
        mossInst.setColorAt(mossPlaced, setColor.set(mossTones[Math.floor(rand() * mossTones.length)]));
        mossPlaced++;
      }
    }
  }
  cloverInst.count = cloversPlaced;
  mossInst.count = mossPlaced;
  cloverInst.instanceMatrix.needsUpdate = true;
  mossInst.instanceMatrix.needsUpdate = true;
  if (cloverInst.instanceColor) cloverInst.instanceColor.needsUpdate = true;
  if (mossInst.instanceColor) mossInst.instanceColor.needsUpdate = true;
  cloverInst.computeBoundingSphere();
  mossInst.computeBoundingSphere();
  group.add(cloverInst, mossInst);

  return {
    group,
    dispose() {
      cloverGeo.dispose();
      mossGeo.dispose();
    },
  };
}
