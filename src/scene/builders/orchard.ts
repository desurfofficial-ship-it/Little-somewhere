import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';
import { addContactShadow } from './vegetation';

/**
 * FERN HOLLOW ORCHARD — Milestone 3 Build 1 (north district landmark).
 *
 * A handcrafted storybook crabapple orchard on the meadow north of the gazebo
 * promenade: six instanced fruit trees sharing the grove's season-tinted crown
 * materials, a stone-and-cedar gate with hanging lettered sign, a harvest
 * ladder leaning into the west tree, a crate-and-basket harvest corner, a bee
 * skep on a cedar stool, and a stepping-stone path from the promenade.
 *
 * Craft contract (VISUAL_QUALITY_STANDARDS):
 * - Every prop is a composite multi-part build pivoted at y = 0 with grounded
 *   contact shadows; no raw unmodified primitives.
 * - Crowns reuse the grove's cached `grove_crown_base` / `grove_crown_top`
 *   materials so the season tint system colors the orchard for free.
 * - All positions mirror `CIRCLE_OBSTACLES` in `src/game/worldMap.ts` exactly;
 *   `ORCHARD_TREES` / `ORCHARD_GATE` are exported for the walkability tests.
 */

export interface OrchardTreeSpec {
  obstacleId: string;
  x: number;
  z: number;
  scale: number;
  yaw: number;
}

export const ORCHARD_TREES: readonly OrchardTreeSpec[] = [
  { obstacleId: 'orchard_tree_nw', x: -9.6, z: -17.2, scale: 1.0, yaw: 0.4 },
  { obstacleId: 'orchard_tree_w', x: -6.6, z: -20.1, scale: 0.92, yaw: 2.1 },
  { obstacleId: 'orchard_tree_mid', x: -3.2, z: -18.2, scale: 1.06, yaw: 3.6 },
  { obstacleId: 'orchard_tree_n', x: -0.2, z: -20.3, scale: 0.88, yaw: 1.2 },
  { obstacleId: 'orchard_tree_e', x: 2.6, z: -17.0, scale: 1.0, yaw: 5.0 },
  { obstacleId: 'orchard_tree_ne', x: 5.4, z: -19.6, scale: 0.95, yaw: 2.8 },
];

export const ORCHARD_GATE = { x: -2.6, z: -14.9, pierWestX: -4.3, pierEastX: -0.9 } as const;

export interface OrchardRig {
  group: THREE.Group;
  /**
   * Wind-driven crown sway hook (orchard micro-life). `windStrength` 0..1 —
   * 0 freezes crowns/fruit back at their authored rest pose, 1 is a brisk
   * breeze. Zero per-frame allocations; trunks and contact shadows stay put.
   */
  updateWind(elapsed: number, windStrength: number): void;
  dispose(): void;
}

export interface OrchardBuildContext {
  palette: MaterialPalette;
  shadowTex: THREE.Texture;
  signTex: THREE.Texture;
  isSoftwareGl: boolean;
}

const FRUIT_PER_TREE = 12;

/** Local-space pivot height about which crowns & fruit sway (trunk-top). */
const CROWN_PIVOT_Y = 2.3;

function makeSeededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Crabapple body + stem, merged once and instanced across every tree. */
function createAppleGeometry(): THREE.BufferGeometry {
  const body = new THREE.SphereGeometry(0.088, 7, 6);
  body.scale(1.0, 0.86, 1.0);
  const stem = new THREE.CylinderGeometry(0.012, 0.016, 0.085, 5);
  stem.translate(0, 0.105, 0);
  const apple = mergeGeometries([body, stem], false) ?? body;
  body.dispose();
  stem.dispose();
  return apple;
}

/** Gnarled fruit-tree trunk: flared lathe + two low bough stubs, merged. */
function createOrchardTrunkGeometry(): THREE.BufferGeometry {
  const points = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.4, 0.0),
    new THREE.Vector2(0.3, 0.3),
    new THREE.Vector2(0.22, 1.1),
    new THREE.Vector2(0.17, 1.85),
    new THREE.Vector2(0.13, 2.2),
    new THREE.Vector2(0.0, 2.24),
  ];
  const trunk = new THREE.LatheGeometry(points, 8);

  const boughA = new THREE.CylinderGeometry(0.085, 0.13, 0.85, 6);
  boughA.translate(0, 0.42, 0);
  boughA.rotateZ(-0.85);
  boughA.translate(0.12, 1.72, 0);

  const boughB = new THREE.CylinderGeometry(0.075, 0.115, 0.72, 6);
  boughB.translate(0, 0.36, 0);
  boughB.rotateZ(0.95);
  boughB.rotateY(1.9);
  boughB.translate(-0.1, 1.94, 0.05);

  const merged = mergeGeometries([trunk, boughA, boughB], false) ?? trunk;
  trunk.dispose();
  boughA.dispose();
  boughB.dispose();
  return merged;
}

/** Wider, flatter two-lobe orchard canopy (distinct from the round grove oaks). */
function createOrchardCrownGeometries(): { base: THREE.BufferGeometry; top: THREE.BufferGeometry } {
  const base = new THREE.IcosahedronGeometry(1.05, 1);
  base.scale(1.42, 0.78, 1.3);
  base.translate(0, 2.62, 0);

  const top = new THREE.IcosahedronGeometry(0.78, 1);
  top.scale(1.25, 0.8, 1.1);
  top.translate(0.34, 3.14, -0.2);

  return { base, top };
}

export function buildFernHollowOrchard(ctx: OrchardBuildContext): OrchardRig {
  const { palette, shadowTex, signTex, isSoftwareGl } = ctx;
  const group = new THREE.Group();
  const ownedGeos: THREE.BufferGeometry[] = [];
  const own = <T extends THREE.BufferGeometry>(geo: T): T => {
    ownedGeos.push(geo);
    return geo;
  };

  const castShadows = !isSoftwareGl;
  const rand = makeSeededRandom(1907);

  // ------------------------------------------------------------------
  // 0. Wind-sway state (orchard micro-life hooks)
  // Tree world matrices + fruit local matrices captured at build; per-frame
  // sway composes treeBase * swayLocal (crowns) and treeBase * swayLocal *
  // fruitLocal (fruit) so every fruit rides its crown rigidly about the
  // trunk-top pivot. Zero allocations in updateWind.
  // ------------------------------------------------------------------
  const swayTreeMatrices: THREE.Matrix4[] = [];
  const swayFruitLocalMatrices: THREE.Matrix4[] = [];
  const _swayEuler = new THREE.Euler(0, 0, 0);
  const _swayQuat = new THREE.Quaternion();
  const _swayRotM = new THREE.Matrix4();
  const _swayLocalM = new THREE.Matrix4();
  const _pivotPosM = new THREE.Matrix4().makeTranslation(0, CROWN_PIVOT_Y, 0);
  const _pivotNegM = new THREE.Matrix4().makeTranslation(0, -CROWN_PIVOT_Y, 0);
  const _swayOutM = new THREE.Matrix4();
  const _matScratch = new THREE.Matrix4();
  let lastWindStrength = -1;
  let lastWindElapsed = -1;

  // Shared palette materials (cached registry; crowns double as season-tint targets)
  const trunkMat = palette.standard(STORYBOOK_PALETTE.oakBark, 0.9, 0.01);
  const crownBaseMat = palette.get('grove_crown_base', {
    color: '#FFFFFF',
    roughness: 0.85,
    metalness: 0.0,
  });
  const crownTopMat = palette.get('grove_crown_top', {
    color: '#FFFFFF',
    roughness: 0.82,
    metalness: 0.0,
  });
  const fruitMat = palette.standard('#FFFFFF', 0.52, 0.02);
  const looseFruitMat = palette.standard('#B8492F', 0.5, 0.02);
  const fieldstoneMat = palette.standard(STORYBOOK_PALETTE.fieldstoneDark, 0.9, 0.02);
  const limestoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.9, 0.02);
  const cedarWarmMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.76, 0.04);
  const cedarDarkMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.82, 0.04);
  const ironMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.4, 0.72);
  const strawMat = palette.standard('#D9B36A', 0.88, 0.02);

  // ------------------------------------------------------------------
  // 1. Six instanced crabapple trees (4 draw calls) + contact shadows
  // ------------------------------------------------------------------
  const treeCount = ORCHARD_TREES.length;
  const trunkGeo = own(createOrchardTrunkGeometry());
  const { base: crownBaseGeoRaw, top: crownTopGeoRaw } = createOrchardCrownGeometries();
  const crownBaseGeo = own(crownBaseGeoRaw);
  const crownTopGeo = own(crownTopGeoRaw);
  const appleGeo = own(createAppleGeometry());

  const trunksInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const crownsBaseInst = new THREE.InstancedMesh(crownBaseGeo, crownBaseMat, treeCount);
  const crownsTopInst = new THREE.InstancedMesh(crownTopGeo, crownTopMat, treeCount);
  const fruitInst = new THREE.InstancedMesh(appleGeo, fruitMat, treeCount * FRUIT_PER_TREE);

  trunksInst.castShadow = castShadows;
  crownsBaseInst.castShadow = castShadows;
  crownsBaseInst.receiveShadow = true;
  crownsTopInst.castShadow = castShadows;
  fruitInst.castShadow = castShadows;

  const trunkTints = ['#6B4B36', '#5E4230', '#77553C', '#63452F'];
  const crownBaseTints = ['#4E7542', '#587F49', '#456C3C', '#62894F'];
  const crownTopTints = ['#6C9455', '#7AA262', '#60894E', '#84A765'];
  const fruitTints = ['#C8553D', '#B54A36', '#D26A4B', '#C0603F', '#A8B15C'];

  const dummy = new THREE.Object3D();
  const localDummy = new THREE.Object3D();
  const treeMatrix = new THREE.Matrix4();
  const appleMatrix = new THREE.Matrix4();

  for (let i = 0; i < treeCount; i++) {
    const tree = ORCHARD_TREES[i];
    dummy.position.set(tree.x, 0, tree.z);
    dummy.rotation.set(0, tree.yaw, 0);
    const s = tree.scale;
    dummy.scale.set(s, s * (0.96 + rand() * 0.08), s);
    dummy.updateMatrix();
    treeMatrix.copy(dummy.matrix);

    trunksInst.setMatrixAt(i, dummy.matrix);
    crownsBaseInst.setMatrixAt(i, dummy.matrix);
    crownsTopInst.setMatrixAt(i, dummy.matrix);
    trunksInst.setColorAt(i, new THREE.Color(trunkTints[i % trunkTints.length]));
    crownsBaseInst.setColorAt(i, new THREE.Color(crownBaseTints[i % crownBaseTints.length]));
    crownsTopInst.setColorAt(i, new THREE.Color(crownTopTints[(i + 1) % crownTopTints.length]));

    swayTreeMatrices.push(dummy.matrix.clone());

    // Fruit ring around the lower canopy + a few clustered near the top lobe
    for (let f = 0; f < FRUIT_PER_TREE; f++) {
      const ang = (f / FRUIT_PER_TREE) * Math.PI * 2 + rand() * 0.55;
      const highFruit = f % 5 === 4;
      const radius = highFruit ? 0.34 + rand() * 0.22 : 0.62 + rand() * 0.4;
      const localX = Math.cos(ang) * radius;
      const localZ = Math.sin(ang) * radius;
      const localY = highFruit ? 2.78 + rand() * 0.5 : 1.9 + rand() * 0.62;

      localDummy.position.set(localX, localY, localZ);
      localDummy.rotation.set(rand() * 0.5, rand() * Math.PI * 2, rand() * 0.5);
      const fs = (0.85 + rand() * 0.32) * s;
      localDummy.scale.set(fs, fs, fs);
      localDummy.updateMatrix();

      appleMatrix.multiplyMatrices(treeMatrix, localDummy.matrix);
      fruitInst.setMatrixAt(i * FRUIT_PER_TREE + f, appleMatrix);
      fruitInst.setColorAt(
        i * FRUIT_PER_TREE + f,
        new THREE.Color(fruitTints[Math.floor(rand() * fruitTints.length)]),
      );
      swayFruitLocalMatrices.push(localDummy.matrix.clone());
    }
  }
  trunksInst.computeBoundingSphere();
  crownsBaseInst.computeBoundingSphere();
  crownsTopInst.computeBoundingSphere();
  fruitInst.computeBoundingSphere();
  trunksInst.instanceColor!.needsUpdate = true;
  crownsBaseInst.instanceColor!.needsUpdate = true;
  crownsTopInst.instanceColor!.needsUpdate = true;
  fruitInst.instanceColor!.needsUpdate = true;
  group.add(trunksInst, crownsBaseInst, crownsTopInst, fruitInst);

  // Soft contact shadow discs under each tree (1 draw call)
  const treeShadowGeo = own(new THREE.PlaneGeometry(2.4, 2.4).rotateX(-Math.PI / 2));
  const treeShadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const treeShadowInst = new THREE.InstancedMesh(treeShadowGeo, treeShadowMat, treeCount);
  for (let i = 0; i < treeCount; i++) {
    const tree = ORCHARD_TREES[i];
    dummy.position.set(tree.x, 0.021, tree.z);
    dummy.rotation.set(0, 0, 0);
    const ss = tree.scale * (1.25 + rand() * 0.2);
    dummy.scale.set(ss, 1, ss);
    dummy.updateMatrix();
    treeShadowInst.setMatrixAt(i, dummy.matrix);
  }
  treeShadowInst.computeBoundingSphere();
  group.add(treeShadowInst);

  // ------------------------------------------------------------------
  // 2. Orchard gate: twin fieldstone piers, cedar arch + lattice, sign
  // ------------------------------------------------------------------
  const gate = new THREE.Group();
  gate.position.set(ORCHARD_GATE.x, 0, ORCHARD_GATE.z);
  addContactShadow(gate, shadowTex, 4.6, 1.5, 0.42, 0.016);

  const pierStones: THREE.BufferGeometry[] = [];
  const pierCaps: THREE.BufferGeometry[] = [];
  for (const px of [ORCHARD_GATE.pierWestX - ORCHARD_GATE.x, ORCHARD_GATE.pierEastX - ORCHARD_GATE.x]) {
    for (let row = 0; row < 4; row++) {
      const stone = new THREE.BoxGeometry(0.6 + rand() * 0.1, 0.4, 0.58 + rand() * 0.1);
      stone.translate(
        px + (rand() - 0.5) * 0.1,
        0.2 + row * 0.38,
        (rand() - 0.5) * 0.08,
      );
      pierStones.push(stone);
    }
    const cap = new THREE.BoxGeometry(0.82, 0.13, 0.8);
    cap.translate(px, 1.72, 0);
    pierCaps.push(cap);
  }
  const pierStonesMesh = new THREE.Mesh(own(mergeGeometries(pierStones, false)!), fieldstoneMat);
  const pierCapsMesh = new THREE.Mesh(own(mergeGeometries(pierCaps, false)!), limestoneMat);
  pierStonesMesh.castShadow = castShadows;
  pierStonesMesh.receiveShadow = true;
  pierCapsMesh.castShadow = castShadows;
  pierCapsMesh.receiveShadow = true;
  for (const g of pierStones) g.dispose();
  for (const g of pierCaps) g.dispose();
  gate.add(pierStonesMesh, pierCapsMesh);

  // Arched cedar lintel: angled shoulder beams + flat apex + woven lattice sticks
  const archParts: THREE.BufferGeometry[] = [];
  const shoulderL = new THREE.BoxGeometry(1.5, 0.14, 0.2);
  shoulderL.rotateZ(0.22);
  shoulderL.translate(-1.05, 1.94, 0);
  const shoulderR = new THREE.BoxGeometry(1.5, 0.14, 0.2);
  shoulderR.rotateZ(-0.22);
  shoulderR.translate(1.05, 1.94, 0);
  const apex = new THREE.BoxGeometry(1.6, 0.14, 0.2);
  apex.translate(0, 2.16, 0);
  archParts.push(shoulderL, shoulderR, apex);
  for (const lx of [-0.7, -0.25, 0.25, 0.7]) {
    const stick = new THREE.CylinderGeometry(0.028, 0.028, 0.3, 5);
    stick.translate(lx, 2.36, 0);
    archParts.push(stick);
  }
  for (const hookX of [-0.34, 0.34]) {
    const hook = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 5);
    hook.translate(hookX, 2.0, 0.02);
    archParts.push(hook);
  }
  const archMesh = new THREE.Mesh(own(mergeGeometries(archParts, false)!), cedarDarkMat);
  archMesh.castShadow = castShadows;
  for (const g of archParts) g.dispose();
  gate.add(archMesh);

  // Hanging lettered sign (framed board + textured face)
  const signBoard = new THREE.BoxGeometry(1.04, 0.54, 0.055);
  signBoard.translate(0, 1.6, 0.02);
  const signMesh = new THREE.Mesh(own(signBoard), cedarWarmMat);
  signMesh.castShadow = castShadows;
  const signFaceGeo = own(new THREE.PlaneGeometry(0.96, 0.46).translate(0, 1.6, 0.05));
  const signFaceMat = new THREE.MeshStandardMaterial({
    map: signTex,
    roughness: 0.72,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });
  const signFace = new THREE.Mesh(signFaceGeo, signFaceMat);
  gate.add(signMesh, signFace);
  group.add(gate);

  // ------------------------------------------------------------------
  // 3. Harvest ladder leaning into the west tree (merged, 1 draw call)
  // ------------------------------------------------------------------
  const ladderParts: THREE.BufferGeometry[] = [];
  for (const rx of [-0.24, 0.24]) {
    const rail = new THREE.BoxGeometry(0.07, 2.5, 0.05);
    rail.translate(rx, 1.25, 0);
    ladderParts.push(rail);
  }
  for (let r = 0; r < 7; r++) {
    const rung = new THREE.BoxGeometry(0.5, 0.055, 0.05);
    rung.translate(0, 0.32 + r * 0.3, 0);
    ladderParts.push(rung);
  }
  const ladderGeo = own(mergeGeometries(ladderParts, false)!);
  for (const g of ladderParts) g.dispose();
  const ladder = new THREE.Mesh(ladderGeo, cedarWarmMat);
  ladder.position.set(-5.85, 0, -20.35);
  // Lean the top northwest into the west tree's canopy
  ladder.rotation.order = 'YXZ';
  ladder.rotation.y = Math.atan2(-0.75, 0.25);
  ladder.rotation.x = 0.36;
  ladder.castShadow = castShadows;
  const ladderShadow = addContactShadow(group, shadowTex, 1.2, 0.8, 0.4, 0.017);
  ladderShadow.position.set(-5.85, 0.018, -20.35);
  group.add(ladder);

  // ------------------------------------------------------------------
  // 4. Harvest corner: crates + iron brackets + basket + loose apples
  // ------------------------------------------------------------------
  const corner = new THREE.Group();
  corner.position.set(-3.7, 0, -20.3);
  addContactShadow(corner, shadowTex, 2.2, 1.7, 0.44, 0.016);

  const crateSlats: THREE.BufferGeometry[] = [];
  const crateIron: THREE.BufferGeometry[] = [];
  const addCrate = (cx: number, cy: number, cz: number, size: number, yaw: number) => {
    const half = size / 2;
    for (const sy of [cy - half + 0.035, cy + half - 0.035]) {
      const lid = new THREE.BoxGeometry(size, 0.07, size);
      lid.rotateY(yaw);
      lid.translate(cx, sy, cz);
      crateSlats.push(lid);
    }
    for (const sx of [-half + 0.04, half - 0.04]) {
      for (const sz of [-half + 0.04, half - 0.04]) {
        const post = new THREE.BoxGeometry(0.075, size, 0.075);
        post.rotateY(yaw);
        post.translate(cx + sx, cy, cz + sz);
        crateSlats.push(post);
      }
    }
    for (const sy of [cy - half + 0.02, cy + half - 0.02]) {
      const band = new THREE.BoxGeometry(size * 0.96, 0.05, 0.05);
      band.rotateY(yaw + Math.PI / 4);
      band.translate(cx, sy, cz);
      crateIron.push(band);
    }
  };
  addCrate(-0.18, 0.26, 0.05, 0.52, 0.12);
  addCrate(-0.22, 0.74, 0.02, 0.44, 0.55);

  const crateSlatsMesh = new THREE.Mesh(own(mergeGeometries(crateSlats, false)!), cedarWarmMat);
  const crateIronMesh = new THREE.Mesh(own(mergeGeometries(crateIron, false)!), ironMat);
  crateSlatsMesh.castShadow = castShadows;
  crateSlatsMesh.receiveShadow = true;
  crateIronMesh.castShadow = castShadows;
  for (const g of crateSlats) g.dispose();
  for (const g of crateIron) g.dispose();
  corner.add(crateSlatsMesh, crateIronMesh);

  // Wicker gathering basket with a woven rim
  const basketPoints = [
    new THREE.Vector2(0.02, 0.0),
    new THREE.Vector2(0.2, 0.02),
    new THREE.Vector2(0.26, 0.14),
    new THREE.Vector2(0.28, 0.24),
    new THREE.Vector2(0.24, 0.26),
  ];
  const basketGeo = own(new THREE.LatheGeometry(basketPoints, 9));
  const basket = new THREE.Mesh(basketGeo, cedarDarkMat);
  basket.position.set(0.42, 0, 0.28);
  basket.castShadow = castShadows;
  corner.add(basket);

  // Loose crabapples spilled beside the crates (merged clones, fruit material)
  const groundApples: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const g = appleGeo.clone();
    const ang = rand() * Math.PI * 2;
    const rad = 0.42 + rand() * 0.24;
    g.rotateY(rand() * Math.PI * 2);
    g.scale(0.9 + rand() * 0.25, 0.9 + rand() * 0.25, 0.9 + rand() * 0.25);
    g.translate(Math.cos(ang) * rad + 0.55, 0.075, Math.sin(ang) * rad - 0.3);
    groundApples.push(g);
  }
  const groundApplesMesh = new THREE.Mesh(own(mergeGeometries(groundApples, false)!), looseFruitMat);
  groundApplesMesh.castShadow = castShadows;
  for (const g of groundApples) g.dispose();
  corner.add(groundApplesMesh);
  group.add(corner);

  // ------------------------------------------------------------------
  // 5. Bee skep on a cedar stool (east edge of the orchard)
  // ------------------------------------------------------------------
  const skepGroup = new THREE.Group();
  skepGroup.position.set(4.9, 0, -16.3);
  addContactShadow(skepGroup, shadowTex, 1.4, 1.4, 0.4, 0.016);

  const stoolParts: THREE.BufferGeometry[] = [];
  const seat = new THREE.CylinderGeometry(0.27, 0.27, 0.06, 10);
  seat.translate(0, 0.36, 0);
  stoolParts.push(seat);
  for (let l = 0; l < 3; l++) {
    const ang = (l / 3) * Math.PI * 2 + 0.5;
    const leg = new THREE.CylinderGeometry(0.032, 0.026, 0.36, 6);
    leg.rotateZ(0.14 * Math.cos(ang));
    leg.rotateX(-0.14 * Math.sin(ang));
    leg.translate(Math.cos(ang) * 0.17, 0.18, Math.sin(ang) * 0.17);
    stoolParts.push(leg);
  }
  const stoolMesh = new THREE.Mesh(own(mergeGeometries(stoolParts, false)!), cedarWarmMat);
  stoolMesh.castShadow = castShadows;
  for (const g of stoolParts) g.dispose();
  skepGroup.add(stoolMesh);

  const skepProfile = [
    new THREE.Vector2(0.001, 0.0),
    new THREE.Vector2(0.1, 0.01),
    new THREE.Vector2(0.2, 0.08),
    new THREE.Vector2(0.25, 0.18),
    new THREE.Vector2(0.24, 0.28),
    new THREE.Vector2(0.17, 0.38),
    new THREE.Vector2(0.06, 0.44),
    new THREE.Vector2(0.0, 0.45),
  ];
  const skepDome = new THREE.LatheGeometry(skepProfile, 10);
  const skepRings: THREE.BufferGeometry[] = [skepDome];
  for (const [ringY, ringR] of [
    [0.09, 0.21],
    [0.19, 0.25],
    [0.29, 0.235],
    [0.38, 0.16],
  ] as const) {
    const ring = new THREE.TorusGeometry(ringR, 0.016, 5, 12);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, ringY, 0);
    skepRings.push(ring);
  }
  const skepMesh = new THREE.Mesh(own(mergeGeometries(skepRings, false)!), strawMat);
  skepMesh.position.set(0, 0.39, 0);
  skepMesh.castShadow = castShadows;
  skepDome.dispose();
  for (let i = 1; i < skepRings.length; i++) skepRings[i].dispose();
  const entranceGeo = own(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8).rotateX(Math.PI / 2).translate(0, 0.52, 0.23));
  const entranceMat = palette.standard('#3E3026', 0.9, 0.0);
  const entrance = new THREE.Mesh(entranceGeo, entranceMat);
  skepGroup.add(skepMesh, entrance);
  group.add(skepGroup);

  // ------------------------------------------------------------------
  // 6. Stepping-stone path: promenade -> through the gate -> orchard
  // ------------------------------------------------------------------
  const stoneGeos: THREE.BufferGeometry[] = [];
  const steps = 7;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const wiggle = (i % 2 === 0 ? 1 : -1) * (0.08 + rand() * 0.1);
    const stoneR = 0.26 + rand() * 0.1;
    const stone = new THREE.CylinderGeometry(stoneR, stoneR * 1.08, 0.05, 7);
    stone.translate(-2.5 + t * 0.3 + wiggle, 0.022, -13.2 + t * 3.7);
    stoneGeos.push(stone);
  }
  const stonesMesh = new THREE.Mesh(own(mergeGeometries(stoneGeos, false)!), limestoneMat);
  stonesMesh.receiveShadow = true;
  for (const g of stoneGeos) g.dispose();
  group.add(stonesMesh);

  return {
    group,
    updateWind(elapsed: number, windStrength: number) {
      const wind = Math.min(1, Math.max(0, windStrength));
      // Fully calm (and unchanged) — leave matrices untouched
      if (wind <= 0.001) {
        if (lastWindStrength > 0.001) {
          // Restore authored rest pose exactly once when the wind dies down
          for (let i = 0; i < ORCHARD_TREES.length; i++) {
            crownsBaseInst.setMatrixAt(i, swayTreeMatrices[i]);
            crownsTopInst.setMatrixAt(i, swayTreeMatrices[i]);
            for (let f = 0; f < FRUIT_PER_TREE; f++) {
              _swayOutM.multiplyMatrices(
                swayTreeMatrices[i],
                swayFruitLocalMatrices[i * FRUIT_PER_TREE + f],
              );
              fruitInst.setMatrixAt(i * FRUIT_PER_TREE + f, _swayOutM);
            }
          }
          crownsBaseInst.instanceMatrix.needsUpdate = true;
          crownsTopInst.instanceMatrix.needsUpdate = true;
          fruitInst.instanceMatrix.needsUpdate = true;
        }
        lastWindStrength = wind;
        return;
      }
      // Identical frame (paused clock) — nothing new to integrate
      if (wind === lastWindStrength && elapsed === lastWindElapsed) return;
      lastWindStrength = wind;
      lastWindElapsed = elapsed;

      const amp = 0.018 + wind * 0.03; // ~0.026 rad idle drift .. 0.048 rad breeze
      for (let i = 0; i < ORCHARD_TREES.length; i++) {
        const tree = ORCHARD_TREES[i];
        const phase = tree.yaw * 1.7;
        const speed = 0.9 + wind * 1.1;
        _swayEuler.set(
          Math.sin(elapsed * speed + phase) * amp,
          0,
          Math.cos(elapsed * speed * 0.83 + phase * 1.31) * amp * 0.72,
        );
        _swayQuat.setFromEuler(_swayEuler);
        _swayRotM.makeRotationFromQuaternion(_swayQuat);
        // swayLocal = T(pivot) * R * T(-pivot): rotation about the trunk-top in tree space
        _swayLocalM.multiplyMatrices(_pivotPosM, _swayRotM);
        _swayLocalM.multiply(_pivotNegM);

        // Crowns ride treeBase * swayLocal; fruit rides treeBase * swayLocal *
        // fruitLocal so the whole canopy stays rigid about the pivot.
        _swayOutM.multiplyMatrices(swayTreeMatrices[i], _swayLocalM);
        crownsBaseInst.setMatrixAt(i, _swayOutM);
        crownsTopInst.setMatrixAt(i, _swayOutM);

        const crownSwayM = _swayOutM;
        for (let f = 0; f < FRUIT_PER_TREE; f++) {
          _matScratch.multiplyMatrices(crownSwayM, swayFruitLocalMatrices[i * FRUIT_PER_TREE + f]);
          fruitInst.setMatrixAt(i * FRUIT_PER_TREE + f, _matScratch);
        }
      }
      crownsBaseInst.instanceMatrix.needsUpdate = true;
      crownsTopInst.instanceMatrix.needsUpdate = true;
      fruitInst.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      for (const geo of ownedGeos) geo.dispose();
      treeShadowGeo.dispose();
      treeShadowMat.dispose();
      signFaceGeo.dispose();
      signFaceMat.dispose();
      group.clear();
    },
  };
}
