import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';
import {
  addContactShadow,
} from './vegetation';
import { addStaticContactShadow } from '../contactShadows';

/**
 * The Wild Hollows (Build 10) — exterior geography for the world expansion.
 *
 * Four destinations stitched to the game layer's collision/nav contracts:
 * - Foxglove Rise (SE): terraced knoll, timber stair cutting the north face,
 *   cedar lookout deck at y 0.62 (matches `getGroundHeightAt`), rail on the three
 *   obstacle-guarded edges, foxglove drifts on the slopes. The lookout bench and
 *   seat proxy are rendered by the shared SEAT_SPOTS loop in the canvas.
 * - Sorrel Hollow (SW): mossy Old Stone Well, pale birches (visual twins of the
 *   `hollow_birch_*` circles), a cedar footlog over a dry brooklet on the trail.
 * - Marigold Lane (E): merged vertex-colored wildflower drifts, mossy boulders
 *   (visual twins of `lane_boulder_*`), carved lane signpost, stepping stones.
 * - The Bee Line (NE): mossy wild hive log (visual twin of `wild_bee_log`),
 *   a small stone cairn, clover cushions along the clover trail.
 *
 * All geometry is static builder output (zero per-frame allocation). Seasonal
 * response rides the shared crown/ground tint materials returned in the rig,
 * synced by EnvironmentVisualController section 1 exactly like the grove.
 */

export interface WildsRig {
  group: THREE.Group;
  /** Tinted on season change (knoll grass): base color × season wash. */
  moundMat: THREE.MeshStandardMaterial;
  /** Tinted on season change (birch + foxglove foliage): base × wash. */
  crownBaseMat: THREE.MeshStandardMaterial;
  crownTopMat: THREE.MeshStandardMaterial;
  /** Base colors preserved so the environment renderer can compose base × wash
   *  (the season hexes are near-white washes, not final colors). */
  baseColors: {
    mound: THREE.Color;
    crownBase: THREE.Color;
    crownTop: THREE.Color;
  };
  dispose(): void;
}

function makeSeededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildWildHollows(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
  isSoftwareGl: boolean,
): WildsRig {
  const group = new THREE.Group();
  const ownedGeos: THREE.BufferGeometry[] = [];
  const own = <T extends THREE.BufferGeometry>(geo: T): T => {
    ownedGeos.push(geo);
    return geo;
  };
  const castShadows = !isSoftwareGl;
  const rand = makeSeededRandom(4212);

  // ------------------------------------------------------------------
  // Shared materials
  // ------------------------------------------------------------------
  const stoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.9, 0.02);
  const stoneDarkMat = palette.standard(STORYBOOK_PALETTE.fieldstoneDark, 0.92, 0.02);
  const cedarMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.76, 0.03);
  const cedarDarkMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.8, 0.03);
  const ironMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.42, 0.72);
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.26, 0.82);
  const birchBarkMat = palette.standard('#E4E0D4', 0.82, 0.01);
  const birchDashMat = palette.standard('#3E3A34', 0.85, 0.01);
  const mossMat = palette.standard('#6F9A5B', 0.88, 0.0);
  const soilMat = palette.standard('#6E5240', 0.92, 0.0);
  const waterDarkMat = palette.standard('#7FA9B8', 0.3, 0.05);

  // NOTE: the environment renderer's season tint hexes are near-white washes
  // (spring meadowTintHex '#F3F7DE') layered OVER materials that carry their own
  // base color — the ground plane does it via its grass texture, the grove via
  // per-instance colors. The wilds materials therefore carry real storybook
  // greens here and let the wash season-shift them.
  const moundMat = palette.get('wilds_mound', {
    color: '#7CA85F',
    roughness: 0.9,
    metalness: 0.0,
  });
  const crownBaseMat = palette.get('wilds_crown_base', {
    color: '#6B9556',
    roughness: 0.85,
    metalness: 0.0,
  });
  const crownTopMat = palette.get('wilds_crown_top', {
    color: '#82AC68',
    roughness: 0.82,
    metalness: 0.0,
  });

  // ------------------------------------------------------------------
  // 1. Foxglove Rise — terraced knoll + stair + lookout deck (SE)
  //    Deck rect x 20.4..22.5 / z 18.0..20.2 @ y 0.62; ramp 20.8..22.0 / 16.7..18.0.
  // ------------------------------------------------------------------
  const RISE = new THREE.Group();
  RISE.position.set(21.4, 0, 19.2);
  const riseShadow = new THREE.Mesh(
    own(new THREE.PlaneGeometry(6.0, 4.9)),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    }),
  );
  riseShadow.rotation.x = -Math.PI / 2;
  riseShadow.position.y = 0.022;
  RISE.add(riseShadow);

  // Three grassed tiers with stone retaining rims (top tier ends at y 0.62).
  // Z-scaled to 0.82 so the silhouette stays inside the rise_mound_* guard-box
  // union (world z 16.6..21.9 around the knoll center).
  const tiers: Array<{ r: number; h: number; top: number }> = [
    { r: 3.0, h: 0.21, top: 0.21 },
    { r: 2.5, h: 0.21, top: 0.42 },
    { r: 2.1, h: 0.21, top: 0.63 },
  ];
  const TIER_Z_SCALE = 0.82;
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    const baseY = i === 0 ? 0 : tiers[i - 1].top;
    const tierGeo = own(new THREE.CylinderGeometry(t.r, t.r + 0.12, t.h, 26));
    tierGeo.scale(1, 1, TIER_Z_SCALE);
    const tier = new THREE.Mesh(tierGeo, moundMat);
    tier.position.set(0, baseY + t.h / 2 - 0.005, 0);
    tier.receiveShadow = true;
    tier.castShadow = castShadows;
    RISE.add(tier);
    const rimGeo = own(new THREE.TorusGeometry(t.r + 0.03, 0.042, 6, 30));
    rimGeo.scale(1, TIER_Z_SCALE, 1);
    const rim = new THREE.Mesh(rimGeo, i % 2 === 0 ? stoneMat : stoneDarkMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = baseY + t.h - 0.03;
    rim.receiveShadow = true;
    RISE.add(rim);
  }
  // A few mossy coping stones peeking from the rims (merged, alternating mats
  // via vertex tint offsets is overkill — one dark-stone mesh reads the same)
  const copingGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.35;
    const tier = tiers[i % 3];
    const baseY = (i % 3) === 0 ? 0 : tiers[(i % 3) - 1].top;
    const st = new THREE.IcosahedronGeometry(0.16, 0);
    st.scale(1.15, 0.7, 0.9);
    st.translate(Math.cos(a) * (tier.r + 0.1), baseY + 0.14, Math.sin(a) * (tier.r + 0.1) * TIER_Z_SCALE);
    copingGeos.push(st);
  }
  const copingMesh = new THREE.Mesh(own(mergeGeometries(copingGeos, false) ?? copingGeos[0]), stoneDarkMat);
  copingMesh.castShadow = castShadows;
  RISE.add(copingMesh);

  // Timber stair cutting the north face (ramp x 20.8..22.0, z 16.7..18.0 world
  // => local x -0.6..0.6, z -2.5..-1.2; top of stair meets deck y 0.62)
  const stairTreads: THREE.BufferGeometry[] = [];
  const TREADS = 7;
  for (let s = 0; s < TREADS; s++) {
    const zLocal = -2.5 + (s + 0.5) * (1.3 / TREADS);
    const y = 0.62 * ((zLocal + 2.5) / 1.3);
    const tread = new THREE.BoxGeometry(1.16, 0.07, 1.3 / TREADS + 0.015);
    tread.translate(0, y - 0.035, zLocal);
    stairTreads.push(tread);
  }
  const treadsMesh = new THREE.Mesh(
    own(mergeGeometries(stairTreads, false) ?? stairTreads[0]),
    cedarMat,
  );
  treadsMesh.castShadow = castShadows;
  treadsMesh.receiveShadow = true;
  RISE.add(treadsMesh);

  const stairSides: THREE.BufferGeometry[] = [];
  for (const sx of [-0.63, 0.63]) {
    const stringer = new THREE.BoxGeometry(0.09, 0.6, 1.42);
    stringer.rotateX(-Math.atan2(0.62, 1.3));
    stringer.translate(sx, 0.58, -1.85);
    stairSides.push(stringer);
  }
  const stringersMesh = new THREE.Mesh(
    own(mergeGeometries(stairSides, false) ?? stairSides[0]),
    cedarMat,
  );
  stringersMesh.castShadow = castShadows;
  RISE.add(stringersMesh);

  const stairEdging: THREE.BufferGeometry[] = [];
  for (const sx of [-0.74, 0.74]) {
    for (const [sz, h, w] of [
      [-2.42, 0.3, 0.16],
      [-1.75, 0.42, 0.16],
      [-1.3, 0.56, 0.16],
    ] as const) {
      const block = new THREE.BoxGeometry(w, h, 0.24);
      block.translate(sx, h / 2, sz);
      stairEdging.push(block);
    }
  }
  const edgingMesh = new THREE.Mesh(
    own(mergeGeometries(stairEdging, false) ?? stairEdging[0]),
    stoneDarkMat,
  );
  edgingMesh.castShadow = castShadows;
  edgingMesh.receiveShadow = true;
  RISE.add(edgingMesh);

  // Cedar lookout deck (top y 0.62 — matches getGroundHeightAt)
  const deckPlanks: THREE.BufferGeometry[] = [];
  for (let p = 0; p < 9; p++) {
    const zLocal = 0.92 - p * 0.23; // local deck spans z -1.2..1.0 (world 18.0..20.2)
    const plank = new THREE.BoxGeometry(2.06, 0.055, 0.2);
    plank.translate((p % 2 === 0 ? 0.02 : -0.02), 0.6 - 0.0275, zLocal);
    deckPlanks.push(plank);
  }
  const deckMesh = new THREE.Mesh(
    own(mergeGeometries(deckPlanks, false) ?? deckPlanks[0]),
    cedarMat,
  );
  deckMesh.castShadow = castShadows;
  deckMesh.receiveShadow = true;
  RISE.add(deckMesh);

  // Deck posts down to the tier surface
  const postGeos: THREE.BufferGeometry[] = [];
  for (const [px, pz] of [
    [-0.95, -1.1],
    [0.95, -1.1],
    [-0.95, 0.92],
    [0.95, 0.92],
  ] as const) {
    const post = new THREE.BoxGeometry(0.12, 0.46, 0.12);
    post.translate(px, 0.34, pz);
    postGeos.push(post);
  }
  const postsMesh = new THREE.Mesh(own(mergeGeometries(postGeos, false) ?? postGeos[0]), cedarDarkMat);
  postsMesh.castShadow = castShadows;
  RISE.add(postsMesh);

  // Rail on the three obstacle-guarded edges (west, south, east; north = stair entry)
  const railGeos: THREE.BufferGeometry[] = [];
  const RAIL_H = 0.52;
  const railSegments: Array<[number, number, number, number]> = [
    // [x1, z1, x2, z2] in local deck coords
    [-0.98, -1.05, -0.98, 0.9], // west
    [-0.98, 0.9, 0.98, 0.9], // south
    [0.98, 0.9, 0.98, -0.35], // east (gap near stair entry corner)
  ];
  for (const [x1, z1, x2, z2] of railSegments) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const topRail = new THREE.BoxGeometry(0.055, 0.05, len + 0.06);
    topRail.rotateY(-Math.atan2(dz, dx));
    topRail.translate((x1 + x2) / 2, 0.62 + RAIL_H, (z1 + z2) / 2);
    railGeos.push(topRail);
    const midRail = new THREE.BoxGeometry(0.04, 0.04, len + 0.04);
    midRail.rotateY(-Math.atan2(dz, dx));
    midRail.translate((x1 + x2) / 2, 0.62 + RAIL_H * 0.55, (z1 + z2) / 2);
    railGeos.push(midRail);
  }
  for (const [px, pz] of [
    [-0.98, -1.05],
    [-0.98, 0.9],
    [0.0, 0.9],
    [0.98, 0.9],
    [0.98, -0.35],
    [0.98, -1.1],
  ] as const) {
    const post = new THREE.BoxGeometry(0.07, RAIL_H + 0.1, 0.07);
    post.translate(px, 0.62 + (RAIL_H + 0.1) / 2, pz);
    railGeos.push(post);
  }
  const railsMesh = new THREE.Mesh(own(mergeGeometries(railGeos, false) ?? railGeos[0]), cedarDarkMat);
  railsMesh.castShadow = castShadows;
  RISE.add(railsMesh);
  const railCap = new THREE.Mesh(own(new THREE.BoxGeometry(0.075, 0.045, 2.1)), brassMat);
  railCap.position.set(0, 0.62 + RAIL_H + 0.11, 0);
  railCap.rotation.y = Math.PI / 2;
  railCap.visible = false; // brass cap reserved; cedar rail reads cleaner in software GL
  RISE.add(railCap);

  // Wild foxgloves on the slopes (instanced spires + bells)
  const foxgloveSpots: Array<{ x: number; z: number; s: number }> = [];
  for (let i = 0; i < 34; i++) {
    const a = rand() * Math.PI * 2;
    const rr = 1.55 + rand() * 1.3;
    const fx = Math.cos(a) * rr;
    const fz = Math.sin(a) * rr * 0.92;
    // Keep off the deck footprint (local rect x -1.05..1.05, z -1.2..1.0)
    if (fx > -1.2 && fx < 1.2 && fz > -1.35 && fz < 1.15) continue;
    foxgloveSpots.push({ x: fx, z: fz, s: 0.9 + rand() * 0.7 });
  }
  const foxSpireGeo = own(new THREE.CylinderGeometry(0.018, 0.034, 0.62, 5));
  foxSpireGeo.translate(0, 0.31, 0);
  const foxSpireMat = palette.get('wilds_fox_stem', { color: '#4F6E3F', roughness: 0.85, metalness: 0.0 });
  const foxSpires = new THREE.InstancedMesh(foxSpireGeo, foxSpireMat, foxgloveSpots.length);
  const foxBellGeo = own(new THREE.SphereGeometry(0.055, 6, 5, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.55));
  const foxBellMat = palette.get('wilds_fox_bell', { color: '#FFFFFF', roughness: 0.6, metalness: 0.0 });
  const foxBells = new THREE.InstancedMesh(foxBellGeo, foxBellMat, foxgloveSpots.length * 4);
  const foxBellTints = [new THREE.Color('#C98BA8'), new THREE.Color('#D79DB6'), new THREE.Color('#B97C9B'), new THREE.Color('#E0AFC2')];
  const foxLeafGeo = own(new THREE.SphereGeometry(0.1, 6, 5));
  foxLeafGeo.scale(1.4, 0.5, 1.0);
  const foxLeaves = new THREE.InstancedMesh(foxLeafGeo, crownBaseMat, foxgloveSpots.length * 2);
  const dummy = new THREE.Object3D();
  let bellIdx = 0;
  let leafIdx = 0;
  const foxTint = new THREE.Color();
  for (let i = 0; i < foxgloveSpots.length; i++) {
    const spot = foxgloveSpots[i];
    // Height follows the tier surface below the flower
    const dist = Math.hypot(spot.x, spot.z);
    const zDist = Math.abs(spot.z) / TIER_Z_SCALE;
    const effDist = Math.max(dist, zDist);
    const baseY = effDist > 2.5 ? 0.21 : effDist > 2.1 ? 0.42 : 0.63;
    dummy.position.set(spot.x, baseY, spot.z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.setScalar(spot.s);
    dummy.updateMatrix();
    foxSpires.setMatrixAt(i, dummy.matrix);
    for (let b = 0; b < 4; b++) {
      const ang = rand() * Math.PI * 2;
      const rad = 0.05 + rand() * 0.06;
      dummy.position.set(spot.x + Math.cos(ang) * rad * spot.s, baseY + (0.42 + rand() * 0.2) * spot.s, spot.z + Math.sin(ang) * rad * spot.s);
      dummy.rotation.set(rand() * 0.5 - 0.25, ang, 0);
      dummy.scale.setScalar(spot.s * (0.8 + rand() * 0.4));
      dummy.updateMatrix();
      foxBells.setMatrixAt(bellIdx, dummy.matrix);
      foxTint.copy(foxBellTints[(i + b) % foxBellTints.length]);
      foxBells.setColorAt(bellIdx, foxTint);
      bellIdx++;
    }
    for (let l = 0; l < 2; l++) {
      const ang = rand() * Math.PI * 2;
      dummy.position.set(spot.x + Math.cos(ang) * 0.09, baseY + 0.05, spot.z + Math.sin(ang) * 0.09);
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.setScalar(spot.s * (0.8 + rand() * 0.5));
      dummy.updateMatrix();
      foxLeaves.setMatrixAt(leafIdx, dummy.matrix);
      leafIdx++;
    }
  }
  foxSpires.instanceMatrix.needsUpdate = true;
  foxBells.instanceMatrix.needsUpdate = true;
  foxLeaves.instanceMatrix.needsUpdate = true;
  if (foxBells.instanceColor) foxBells.instanceColor.needsUpdate = true;
  foxSpires.castShadow = castShadows;
  RISE.add(foxSpires, foxBells, foxLeaves);
  group.add(RISE);

  // ------------------------------------------------------------------
  // 2. Sorrel Hollow — Old Stone Well (world -21.4, 19.0)
  // ------------------------------------------------------------------
  const well = new THREE.Group();
  well.position.set(-21.4, 0, 19.0);
  addStaticContactShadow(well, shadowTex, 1.9, 1.9, 0.9, 0.02);

  const wellRing = new THREE.Mesh(own(new THREE.CylinderGeometry(0.72, 0.8, 0.72, 14)), stoneMat);
  wellRing.position.y = 0.36;
  wellRing.castShadow = castShadows;
  wellRing.receiveShadow = true;
  well.add(wellRing);
  const wellInner = new THREE.Mesh(own(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 12)), waterDarkMat);
  wellInner.position.y = 0.74;
  well.add(wellInner);
  const wellLip = new THREE.Mesh(own(new THREE.TorusGeometry(0.74, 0.07, 6, 16)), stoneDarkMat);
  wellLip.rotation.x = Math.PI / 2;
  wellLip.position.y = 0.73;
  wellLip.castShadow = castShadows;
  well.add(wellLip);
  // Mossy coping stones (merged into one dark-stone mesh)
  const wellCopGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.2;
    const cop = new THREE.IcosahedronGeometry(0.15, 0);
    cop.scale(1.1, 0.62, 0.9);
    cop.rotateY(a * 2.1);
    cop.translate(Math.cos(a) * 0.85, 0.14, Math.sin(a) * 0.85);
    wellCopGeos.push(cop);
  }
  const wellCopMesh = new THREE.Mesh(own(mergeGeometries(wellCopGeos, false) ?? wellCopGeos[0]), stoneDarkMat);
  wellCopMesh.castShadow = castShadows;
  well.add(wellCopMesh);
  const mossCap = new THREE.Mesh(own(new THREE.SphereGeometry(0.24, 7, 5)), mossMat);
  mossCap.scale.set(1.3, 0.5, 0.9);
  mossCap.position.set(0.62, 0.68, -0.35);
  well.add(mossCap);
  // Cedar posts + little shake roof
  for (const sx of [-0.62, 0.62]) {
    const post = new THREE.Mesh(own(new THREE.BoxGeometry(0.11, 1.55, 0.11)), cedarDarkMat);
    post.position.set(sx, 1.42, 0);
    post.castShadow = castShadows;
    well.add(post);
  }
  const crossbar = new THREE.Mesh(own(new THREE.CylinderGeometry(0.045, 0.045, 1.5, 8)), cedarMat);
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position.y = 2.08;
  crossbar.castShadow = castShadows;
  well.add(crossbar);
  const roofSlabs: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const slab = new THREE.BoxGeometry(0.85, 0.05, 1.3);
    slab.rotateX(side * 0.5);
    slab.translate(side * 0.34, 2.42, 0);
    roofSlabs.push(slab);
  }
  const roofMesh = new THREE.Mesh(own(mergeGeometries(roofSlabs, false) ?? roofSlabs[0]), cedarDarkMat);
  roofMesh.castShadow = castShadows;
  well.add(roofMesh);
  const ridge = new THREE.Mesh(own(new THREE.BoxGeometry(0.09, 0.09, 1.36)), cedarMat);
  ridge.position.y = 2.63;
  ridge.castShadow = castShadows;
  well.add(ridge);
  // Rope + bucket
  const rope = new THREE.Mesh(own(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 5)), cedarDarkMat);
  rope.position.y = 1.62;
  well.add(rope);
  const bucket = new THREE.Mesh(own(new THREE.CylinderGeometry(0.16, 0.13, 0.2, 9)), cedarMat);
  bucket.position.y = 1.1;
  bucket.castShadow = castShadows;
  well.add(bucket);
  const bucketBand = new THREE.Mesh(own(new THREE.TorusGeometry(0.155, 0.016, 5, 12)), brassMat);
  bucketBand.rotation.x = Math.PI / 2;
  bucketBand.position.y = 1.05;
  well.add(bucketBand);
  // Wild sorrel tufts around the base
  const sorrelGeo = own(new THREE.IcosahedronGeometry(0.11, 0));
  sorrelGeo.scale(1.2, 0.6, 1.0);
  const sorrelMat = palette.get('wilds_sorrel', { color: '#8A9A4E', roughness: 0.85, metalness: 0.0 });
  const sorrelTufts = new THREE.InstancedMesh(sorrelGeo, sorrelMat, 7);
  for (let i = 0; i < 7; i++) {
    const a = rand() * Math.PI * 2;
    const rr = 1.0 + rand() * 0.5;
    dummy.position.set(Math.cos(a) * rr, 0.06, Math.sin(a) * rr);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.setScalar(0.8 + rand() * 0.7);
    dummy.updateMatrix();
    sorrelTufts.setMatrixAt(i, dummy.matrix);
  }
  sorrelTufts.instanceMatrix.needsUpdate = true;
  well.add(sorrelTufts);
  group.add(well);

  // ------------------------------------------------------------------
  // 3. Sorrel Hollow birches (visual twins of hollow_birch_w/s/nw)
  // ------------------------------------------------------------------
  const birchTrunkProto = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.2, 0.0),
      new THREE.Vector2(0.16, 0.5),
      new THREE.Vector2(0.12, 1.9),
      new THREE.Vector2(0.07, 2.9),
      new THREE.Vector2(0.0, 3.0),
    ],
    7,
  );
  const birchDashProto = new THREE.BoxGeometry(0.035, 0.09, 0.02);
  const birchCrownProto = new THREE.IcosahedronGeometry(0.85, 1);
  birchCrownProto.scale(1.15, 0.85, 1.1);
  birchCrownProto.translate(0, 3.1, 0);
  const birchCrownTopProto = new THREE.IcosahedronGeometry(0.62, 1);
  birchCrownTopProto.scale(1.1, 0.8, 1.05);
  birchCrownTopProto.translate(0.18, 3.72, -0.1);
  const birchSpots = [
    { x: -22.6, z: 16.3, s: 1.0, tilt: 0.08 },
    { x: -19.15, z: 20.7, s: 0.88, tilt: -0.1 },
    { x: -23.1, z: 19.7, s: 1.12, tilt: 0.05 },
  ];
  {
    // Merge trunks + bark dashes into two meshes; crowns ride two instanced meshes
    const trunkGeos: THREE.BufferGeometry[] = [];
    const dashGeos: THREE.BufferGeometry[] = [];
    for (const b of birchSpots) {
      const trunk = birchTrunkProto.clone();
      trunk.scale(b.s, b.s, b.s);
      trunk.translate(b.x, 0, b.z);
      trunkGeos.push(trunk);
      for (let d = 0; d < 5; d++) {
        const a = rand() * Math.PI * 2;
        const dash = birchDashProto.clone();
        dash.rotateY(a);
        dash.translate(b.x + Math.cos(a) * 0.16 * b.s, (0.4 + d * 0.42) * b.s, b.z + Math.sin(a) * 0.16 * b.s);
        dashGeos.push(dash);
      }
    }
    birchTrunkProto.dispose();
    birchDashProto.dispose();
    const trunksMesh = new THREE.Mesh(own(mergeGeometries(trunkGeos, false) ?? trunkGeos[0]), birchBarkMat);
    trunksMesh.castShadow = castShadows;
    group.add(trunksMesh);
    const dashesMesh = new THREE.Mesh(own(mergeGeometries(dashGeos, false) ?? dashGeos[0]), birchDashMat);
    group.add(dashesMesh);
    const crownsInst = new THREE.InstancedMesh(birchCrownProto, crownBaseMat, birchSpots.length);
    const crownsTopInst = new THREE.InstancedMesh(birchCrownTopProto, crownTopMat, birchSpots.length);
    for (let i = 0; i < birchSpots.length; i++) {
      const b = birchSpots[i];
      dummy.position.set(b.x, 0, b.z);
      dummy.rotation.set(0, i * 1.7, b.tilt);
      dummy.scale.setScalar(b.s);
      dummy.updateMatrix();
      crownsInst.setMatrixAt(i, dummy.matrix);
      crownsTopInst.setMatrixAt(i, dummy.matrix);
    }
    crownsInst.instanceMatrix.needsUpdate = true;
    crownsTopInst.instanceMatrix.needsUpdate = true;
    crownsInst.castShadow = castShadows;
    crownsTopInst.castShadow = castShadows;
    group.add(crownsInst, crownsTopInst);
  }

  // ------------------------------------------------------------------
  // 4. Trail brooklet + cedar footlog on the Sorrel trail (~-11.2, 18.3)
  // ------------------------------------------------------------------
  const brooklet = new THREE.Group();
  brooklet.position.set(-11.2, 0, 18.3);
  addStaticContactShadow(brooklet, shadowTex, 3.4, 1.7, 1.6, 0.015);
  // The raw cylinder already lies flat along Y (its height axis); scale gives a
  // thin ellipse in XZ — no rotation needed.
  const bedGeo = own(new THREE.CylinderGeometry(1.55, 1.7, 0.04, 20));
  bedGeo.scale(1.15, 1.0, 0.62);
  bedGeo.rotateY(Math.PI / 2);
  const bedMesh = new THREE.Mesh(bedGeo, waterDarkMat);
  bedMesh.scale.y = 0.06;
  bedMesh.position.y = 0.045;
  bedMesh.receiveShadow = true;
  brooklet.add(bedMesh);
  const bankStones: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const st = new THREE.IcosahedronGeometry(0.13, 0);
    st.scale(1.1, 0.5, 0.85);
    st.translate(Math.cos(a) * 1.15, 0.05, Math.sin(a) * 0.62);
    bankStones.push(st);
  }
  const bankMesh = new THREE.Mesh(own(mergeGeometries(bankStones, false) ?? bankStones[0]), stoneDarkMat);
  bankMesh.castShadow = castShadows;
  brooklet.add(bankMesh);
  const footlogGeo = own(new THREE.CylinderGeometry(0.15, 0.17, 1.35, 9));
  footlogGeo.rotateZ(Math.PI / 2);
  const footlog = new THREE.Mesh(footlogGeo, cedarDarkMat);
  footlog.position.y = 0.17;
  footlog.castShadow = castShadows;
  brooklet.add(footlog);
  const footlogMoss = new THREE.Mesh(own(new THREE.SphereGeometry(0.12, 6, 5)), mossMat);
  footlogMoss.scale.set(1.5, 0.45, 0.9);
  footlogMoss.position.set(-0.5, 0.24, -0.1);
  brooklet.add(footlogMoss);
  group.add(brooklet);

  // ------------------------------------------------------------------
  // 5. Marigold Lane — wildflower drifts, boulders, signpost, stepping stones
  // ------------------------------------------------------------------
  const laneFlowerSpecs: Array<{ x: number; z: number; kind: number }> = [];
  for (let i = 0; i < 116; i++) {
    // Drift along the trail edges with clustered pulls
    const z = 1.6 + rand() * 13.6;
    const side = rand() < 0.5 ? -1 : 1;
    const x = 20.35 + side * (0.7 + rand() * 1.5);
    if (Math.abs(x - 18.9) < 0.85 && Math.abs(z - 7.4) < 0.85) continue; // boulder_n
    if (Math.abs(x - 21.9) < 0.85 && Math.abs(z - 10.8) < 0.85) continue; // boulder_s
    laneFlowerSpecs.push({ x, z, kind: Math.floor(rand() * 3) });
  }
  for (let i = 0; i < 44; i++) {
    // Dense drift around the wildflower bank (interactable at 20.3, 2.5)
    const a = rand() * Math.PI * 2;
    const rr = rand() * 1.9;
    laneFlowerSpecs.push({ x: 20.3 + Math.cos(a) * rr * 1.3, z: 2.5 + Math.sin(a) * rr, kind: Math.floor(rand() * 3) });
  }
  const stemGeo = own(new THREE.CylinderGeometry(0.014, 0.024, 0.28, 4));
  stemGeo.translate(0, 0.14, 0);
  const headGeo = own(new THREE.IcosahedronGeometry(0.085, 0));
  const flowerMatSpecs = [
    { mat: palette.get('wilds_marigold', { color: '#E5A93C', roughness: 0.62, metalness: 0.0 }), tint: '#E5A93C' },
    { mat: palette.get('wilds_cornflower', { color: '#7B9EC7', roughness: 0.62, metalness: 0.0 }), tint: '#7B9EC7' },
    { mat: palette.get('wilds_alyssum', { color: '#F5F0E2', roughness: 0.62, metalness: 0.0 }), tint: '#F5F0E2' },
  ];
  const stemMats: THREE.InstancedMesh[] = [];
  const headMats: THREE.InstancedMesh[] = [];
  const stemMatShared = palette.get('wilds_lane_stem', { color: '#5E8062', roughness: 0.85, metalness: 0.0 });
  for (let k = 0; k < 3; k++) {
    const count = laneFlowerSpecs.filter((f) => f.kind === k).length;
    const stems = new THREE.InstancedMesh(stemGeo, stemMatShared, count);
    const heads = new THREE.InstancedMesh(headGeo, flowerMatSpecs[k].mat, count);
    stems.castShadow = false;
    heads.castShadow = false;
    stemMats.push(stems);
    headMats.push(heads);
  }
  const kindCursor = [0, 0, 0];
  for (const f of laneFlowerSpecs) {
    const k = f.kind;
    const idx = kindCursor[k]++;
    const jitterX = (rand() - 0.5) * 0.1;
    const jitterZ = (rand() - 0.5) * 0.1;
    const s = 0.75 + rand() * 0.6;
    dummy.position.set(f.x + jitterX, 0, f.z + jitterZ);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    stemMats[k].setMatrixAt(idx, dummy.matrix);
    dummy.position.y = 0.29 * s;
    dummy.updateMatrix();
    headMats[k].setMatrixAt(idx, dummy.matrix);
  }
  for (let k = 0; k < 3; k++) {
    stemMats[k].instanceMatrix.needsUpdate = true;
    headMats[k].instanceMatrix.needsUpdate = true;
    group.add(stemMats[k], headMats[k]);
  }

  // Mossy boulders (visual twins of lane_boulder_n/s)
  for (const [bx, bz, bs] of [
    [18.9, 7.4, 1.0],
    [21.9, 10.8, 0.85],
  ] as const) {
    const boulder = new THREE.Group();
    boulder.position.set(bx, 0, bz);
    addStaticContactShadow(boulder, shadowTex, 1.5 * bs, 1.5 * bs, 0.7 * bs, 0.02);
    const rock = new THREE.Mesh(own(new THREE.IcosahedronGeometry(0.52 * bs, 1)), stoneMat);
    rock.scale.set(1.2, 0.72, 1.0);
    rock.position.y = 0.42 * bs;
    rock.rotation.y = bx;
    rock.castShadow = castShadows;
    rock.receiveShadow = true;
    boulder.add(rock);
    const rockLip = new THREE.Mesh(own(new THREE.IcosahedronGeometry(0.3 * bs, 1)), stoneDarkMat);
    rockLip.position.set(0.3 * bs, 0.54 * bs, 0.12 * bs);
    rockLip.scale.set(1.1, 0.6, 0.9);
    rockLip.castShadow = castShadows;
    boulder.add(rockLip);
    const bMoss = new THREE.Mesh(own(new THREE.SphereGeometry(0.3 * bs, 7, 5)), mossMat);
    bMoss.scale.set(1.3, 0.4, 1.0);
    bMoss.position.set(-0.2 * bs, 0.5 * bs, 0.1 * bs);
    boulder.add(bMoss);
    group.add(boulder);
  }

  // Carved lane signpost (world 21.5, 0.8 — obstacle `lane_signpost`)
  const signpost = new THREE.Group();
  signpost.position.set(21.5, 0, 0.8);
  addStaticContactShadow(signpost, shadowTex, 0.8, 0.8, 0.4, 0.018);
  const post = new THREE.Mesh(own(new THREE.CylinderGeometry(0.055, 0.07, 1.25, 7)), cedarDarkMat);
  post.position.y = 0.625;
  post.castShadow = castShadows;
  signpost.add(post);
  const board = new THREE.Mesh(own(new THREE.BoxGeometry(0.72, 0.2, 0.05)), cedarMat);
  board.position.set(0.16, 1.0, 0);
  board.rotation.y = -0.5;
  board.castShadow = castShadows;
  signpost.add(board);
  const boardTrim = new THREE.Mesh(own(new THREE.BoxGeometry(0.76, 0.045, 0.06)), cedarDarkMat);
  boardTrim.position.set(0.16, 1.1, 0);
  boardTrim.rotation.y = -0.5;
  signpost.add(boardTrim);
  const arrowTip = new THREE.Mesh(own(new THREE.ConeGeometry(0.11, 0.22, 4)), cedarMat);
  arrowTip.rotation.set(0, -0.5, Math.PI / 2);
  arrowTip.position.set(0.58, 1.0, 0.0);
  arrowTip.castShadow = castShadows;
  signpost.add(arrowTip);
  const signFinial = new THREE.Mesh(own(new THREE.SphereGeometry(0.06, 6, 5)), brassMat);
  signFinial.position.y = 1.3;
  signpost.add(signFinial);
  group.add(signpost);

  // Stepping stones along the lane centerline
  const stepGeo = own(new THREE.CylinderGeometry(0.24, 0.28, 0.05, 7));
  const stepMat = stoneDarkMat;
  const steps = new THREE.InstancedMesh(stepGeo, stepMat, 13);
  for (let i = 0; i < 13; i++) {
    const t = i / 12;
    const sx = 19.5 + t * 1.9 + (i % 3 - 1) * 0.18;
    const sz = 1.4 + t * 14.6;
    dummy.position.set(sx, 0.018, sz);
    dummy.rotation.set(0, rand() * Math.PI, 0);
    dummy.scale.setScalar(0.85 + rand() * 0.4);
    dummy.updateMatrix();
    steps.setMatrixAt(i, dummy.matrix);
  }
  steps.instanceMatrix.needsUpdate = true;
  steps.receiveShadow = true;
  group.add(steps);

  // ------------------------------------------------------------------
  // 6. The Bee Line — wild hive log, cairn, clover cushions
  // ------------------------------------------------------------------
  const beeLog = new THREE.Group();
  beeLog.position.set(11.0, 0, -19.7);
  addStaticContactShadow(beeLog, shadowTex, 2.0, 1.3, 0.9, 0.02);
  const logBodyGeo = own(new THREE.CylinderGeometry(0.26, 0.3, 1.5, 10));
  logBodyGeo.rotateZ(Math.PI / 2);
  logBodyGeo.rotateY(0.25);
  const logBody = new THREE.Mesh(logBodyGeo, cedarDarkMat);
  logBody.position.y = 0.32;
  logBody.castShadow = castShadows;
  logBody.receiveShadow = true;
  beeLog.add(logBody);
  const logFaceGeo = own(new THREE.CylinderGeometry(0.255, 0.255, 0.06, 10));
  logFaceGeo.rotateZ(Math.PI / 2);
  logFaceGeo.rotateY(0.25);
  const logFace = new THREE.Mesh(logFaceGeo, soilMat);
  logFace.position.set(-0.72, 0.32, 0.06);
  beeLog.add(logFace);
  const holeGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const hole = new THREE.CylinderGeometry(0.045, 0.045, 0.08, 6);
    hole.rotateZ(Math.PI / 2);
    hole.rotateY(0.25);
    hole.translate(-0.76, 0.22 + (i % 2) * 0.16, -0.06 + Math.floor(i / 2) * 0.14);
    holeGeos.push(hole);
  }
  const holesMesh = new THREE.Mesh(
    own(mergeGeometries(holeGeos, false) ?? holeGeos[0]),
    palette.get('wilds_hive_hole', { color: '#241C16', roughness: 0.95, metalness: 0.0 }),
  );
  beeLog.add(holesMesh);
  const logMoss = new THREE.Mesh(own(new THREE.SphereGeometry(0.3, 7, 5)), mossMat);
  logMoss.scale.set(1.7, 0.42, 1.0);
  logMoss.position.set(0.1, 0.5, 0.05);
  beeLog.add(logMoss);
  const beeDots = new THREE.InstancedMesh(
    own(new THREE.SphereGeometry(0.035, 5, 4)),
    palette.get('wilds_bee', { color: '#E5A93C', roughness: 0.5, metalness: 0.1 }),
    4,
  );
  for (let i = 0; i < 4; i++) {
    dummy.position.set(-0.5 + i * 0.28, 0.5 + rand() * 0.12, 0.1 + rand() * 0.2);
    dummy.rotation.set(0, rand() * Math.PI, 0);
    dummy.scale.setScalar(0.9 + rand() * 0.4);
    dummy.updateMatrix();
    beeDots.setMatrixAt(i, dummy.matrix);
  }
  beeDots.instanceMatrix.needsUpdate = true;
  beeLog.add(beeDots);
  group.add(beeLog);

  // Stone cairn (world 8.2, -19.9 — obstacle `beeline_cairn`)
  const cairn = new THREE.Group();
  cairn.position.set(8.2, 0, -19.9);
  addStaticContactShadow(cairn, shadowTex, 0.9, 0.9, 0.45, 0.018);
  const cairnStones: THREE.BufferGeometry[] = [];
  let cy = 0;
  for (let i = 0; i < 4; i++) {
    const r = 0.3 - i * 0.055;
    const st = new THREE.IcosahedronGeometry(r, 0);
    st.scale(1.15, 0.6, 1.0);
    st.translate((i % 2 === 0 ? 0.03 : -0.04), cy + r * 0.45, 0);
    cy += r * 0.58;
    cairnStones.push(st);
  }
  const cairnMesh = new THREE.Mesh(own(mergeGeometries(cairnStones, false) ?? cairnStones[0]), stoneMat);
  cairnMesh.castShadow = castShadows;
  cairnMesh.receiveShadow = true;
  cairn.add(cairnMesh);
  const cairnMoss = new THREE.Mesh(own(new THREE.SphereGeometry(0.14, 6, 5)), mossMat);
  cairnMoss.scale.set(1.3, 0.5, 1.0);
  cairnMoss.position.set(0.12, 0.5, 0.06);
  cairn.add(cairnMoss);
  group.add(cairn);

  // Clover cushions along the Bee Line trail
  const cloverGeo = own(new THREE.IcosahedronGeometry(0.17, 0));
  cloverGeo.scale(1.25, 0.55, 1.0);
  const cloverMat = palette.get('wilds_clover', { color: '#5E8F55', roughness: 0.88, metalness: 0.0 });
  const clovers = new THREE.InstancedMesh(cloverGeo, cloverMat, 16);
  for (let i = 0; i < 16; i++) {
    const t = rand();
    const cx = 7.6 + t * 6.6 + (rand() - 0.5) * 1.6;
    const cz = -18.3 - rand() * 2.2;
    dummy.position.set(cx, 0.09, cz);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.setScalar(0.7 + rand() * 0.5);
    dummy.updateMatrix();
    clovers.setMatrixAt(i, dummy.matrix);
  }
  clovers.instanceMatrix.needsUpdate = true;
  group.add(clovers);

  return {
    group,
    moundMat,
    crownBaseMat,
    crownTopMat,
    baseColors: {
      mound: new THREE.Color('#7CA85F'),
      crownBase: new THREE.Color('#6B9556'),
      crownTop: new THREE.Color('#82AC68'),
    },
    dispose() {
      group.removeFromParent();
      for (const geo of ownedGeos) geo.dispose();
    },
  };
}
