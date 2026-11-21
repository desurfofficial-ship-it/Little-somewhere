import * as THREE from 'three';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';
import { KoiFishRig, MirrorPondRig } from '../models';
import { createStorybookPondWaterMaterial } from '../waterShaders';
import { addStaticContactShadow } from '../contactShadows';

/**
 * Per-mesh contact shadow disc — the canonical helper. Kept for DYNAMIC discs
 * (characters, carried items, outcome-toggled groups) whose shadows must
 * follow/hide with their object. Always-visible static discs route through
 * `addStaticContactShadow` (BUILD 02 instanced batching, Doc 06 §3.4).
 */
export function addContactShadow(
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
  return mesh;
}

export interface GroveTreesRig {
  group: THREE.Group;
  crownBaseMat: THREE.MeshStandardMaterial;
  crownTopMat: THREE.MeshStandardMaterial;
}

/**
 * Multi-layer instanced grove framing the diorama perimeter (46 trees, 3 draw calls total).
 * Uses flared LatheGeometry trunks + two sculpted overlapping foliage cushions per tree.
 */
export function buildGroveTreesInstanced(
  palette: MaterialPalette,
  isSoftwareGl: boolean,
): GroveTreesRig {
  const group = new THREE.Group();
  const treeCount = 46;

  // Tapered flared trunk via LatheGeometry
  const trunkPoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.36, 0.0),
    new THREE.Vector2(0.27, 0.35),
    new THREE.Vector2(0.21, 1.35),
    new THREE.Vector2(0.15, 1.78),
    new THREE.Vector2(0.0, 1.8),
  ];
  const trunkGeo = new THREE.LatheGeometry(trunkPoints, 8);
  const trunkMat = palette.standard(STORYBOOK_PALETTE.oakBark, 0.9, 0.01);

  // Lower main canopy cushion + asymmetrical upper canopy lobe
  const crownBaseGeo = new THREE.IcosahedronGeometry(1.08, 1);
  crownBaseGeo.scale(1.18, 0.86, 1.12);
  crownBaseGeo.translate(0, 2.28, 0);

  const crownTopGeo = new THREE.IcosahedronGeometry(0.82, 1);
  crownTopGeo.scale(1.12, 0.84, 1.04);
  crownTopGeo.translate(0.24, 2.84, -0.14);

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

  const trunksInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const crownsBaseInst = new THREE.InstancedMesh(crownBaseGeo, crownBaseMat, treeCount);
  const crownsTopInst = new THREE.InstancedMesh(crownTopGeo, crownTopMat, treeCount);

  trunksInst.castShadow = !isSoftwareGl;
  crownsBaseInst.castShadow = !isSoftwareGl;
  crownsBaseInst.receiveShadow = true;
  crownsTopInst.castShadow = !isSoftwareGl;
  crownsTopInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const basePalette = [
    new THREE.Color('#5A844D'),
    new THREE.Color('#669254'),
    new THREE.Color('#4F7845'),
    new THREE.Color('#6F9A5B'),
  ];
  const topPalette = [
    new THREE.Color('#78A360'),
    new THREE.Color('#86AE69'),
    new THREE.Color('#6C9658'),
    new THREE.Color('#91B771'),
  ];
  const trunkPalette = [
    new THREE.Color('#6B4B36'),
    new THREE.Color('#5E4230'),
    new THREE.Color('#77553C'),
    new THREE.Color('#63452F'),
  ];

  for (let ring = 0; ring < treeCount; ring++) {
    const angle = (ring / treeCount) * Math.PI * 2;
    const radius = 26.8 + (ring % 3) * 3.6 + ((ring * 7) % 5) * 0.35;
    const tx = Math.cos(angle) * radius * 1.08;
    const tz = Math.sin(angle) * radius * 0.96;
    const scale = 0.86 + ((ring * 17) % 11) * 0.032;

    dummy.position.set(tx, 0, tz);
    dummy.rotation.y = angle * 1.7 + (ring % 4) * 0.4;
    dummy.scale.set(scale, scale * (0.94 + (ring % 3) * 0.08), scale);
    dummy.updateMatrix();

    trunksInst.setMatrixAt(ring, dummy.matrix);
    crownsBaseInst.setMatrixAt(ring, dummy.matrix);
    crownsTopInst.setMatrixAt(ring, dummy.matrix);

    trunksInst.setColorAt(ring, trunkPalette[ring % trunkPalette.length]);
    crownsBaseInst.setColorAt(ring, basePalette[ring % basePalette.length]);
    crownsTopInst.setColorAt(ring, topPalette[(ring + 1) % topPalette.length]);
  }

  trunksInst.computeBoundingSphere();
  crownsBaseInst.computeBoundingSphere();
  crownsTopInst.computeBoundingSphere();
  group.add(trunksInst, crownsBaseInst, crownsTopInst);

  return { group, crownBaseMat, crownTopMat };
}

/**
 * Natural perimeter dressing: mossy low fieldstone walls, cedar post-and-rail fencing,
 * layered hedgerow cushions, and soft rolling meadow hills beyond the lanes.
 */
export function buildPerimeterBorder(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
): THREE.Group {
  const group = new THREE.Group();

  const stoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.9, 0.02);
  const darkStoneMat = palette.standard(STORYBOOK_PALETTE.fieldstoneDark, 0.92, 0.02);
  const cedarDarkMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.78, 0.04);
  const cedarWarmMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.76, 0.04);
  const hedgeDeepMat = palette.standard(STORYBOOK_PALETTE.foliageDeep, 0.86, 0.0);
  const hedgeMidMat = palette.standard(STORYBOOK_PALETTE.foliageMid, 0.84, 0.0);
  const hillMat = palette.standard('#648B4B', 0.92, 0.0);

  // North & South border runs (z = +/- 23.6) combining low stone walls + cedar split-rail spans + hedges
  for (const side of [-1, 1]) {
    const zPos = side * 23.8;
    for (let x = -22; x <= 22; x += 5.5) {
      const idx = Math.round((x + 22) / 5.5);
      if (idx % 2 === 0) {
        // Low fieldstone wall segment with stepped capstones
        const wall = new THREE.Group();
        wall.position.set(x, 0, zPos);
        addStaticContactShadow(wall, shadowTex, 4.6, 1.4, 0.32, 0.015);
        const base = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.42, 0.62), darkStoneMat);
        base.position.y = 0.21;
        base.receiveShadow = true;
        const cap = new THREE.Mesh(new THREE.BoxGeometry(4.36, 0.14, 0.74), stoneMat);
        cap.position.y = 0.48;
        cap.receiveShadow = true;
        wall.add(base, cap);
        group.add(wall);
      } else {
        // Split-rail cedar fence segment flanked by hedgerow cushions
        const railSeg = new THREE.Group();
        railSeg.position.set(x, 0, zPos);
        for (const px of [-2.0, 2.0]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.76, 0.16), cedarDarkMat);
          post.position.set(px, 0.38, 0);
          const cap = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.22), cedarWarmMat);
          cap.position.set(px, 0.78, 0);
          railSeg.add(post, cap);
        }
        for (const ry of [0.28, 0.56]) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(4.05, 0.08, 0.07), cedarWarmMat);
          rail.position.set(0, ry, 0);
          railSeg.add(rail);
        }
        group.add(railSeg);
      }

      // Asymmetric shrub mound behind fence/wall
      const shrub = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.68 + (idx % 2) * 0.18, 1),
        idx % 2 === 0 ? hedgeDeepMat : hedgeMidMat,
      );
      shrub.scale.set(1.35, 0.8, 1.05);
      shrub.position.set(x + (idx % 2 === 0 ? 1.1 : -0.9), 0.38, zPos + side * 0.85);
      group.add(shrub);
    }
  }

  // East & West outer hedgerow + fence pockets (beyond x = +/- 25.4)
  for (const side of [-1, 1]) {
    const xPos = side * 25.5;
    for (let z = -19; z <= 19; z += 6.3) {
      const hedge = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.75, 1),
        Math.abs(Math.round(z)) % 2 === 0 ? hedgeDeepMat : hedgeMidMat,
      );
      hedge.scale.set(1.05, 0.85, 1.45);
      hedge.position.set(xPos + side * 0.5, 0.42, z);
      group.add(hedge);
    }
  }

  // Soft distant rolling hills in the outer ring so horizon fog feels rich
  const hills: Array<{ x: number; z: number; rx: number; ry: number; rz: number }> = [
    { x: -34, z: -34, rx: 14, ry: 4.5, rz: 10 },
    { x: 0, z: -38, rx: 18, ry: 5.2, rz: 11 },
    { x: 34, z: -33, rx: 13, ry: 4.2, rz: 10 },
    { x: -38, z: 4, rx: 11, ry: 3.8, rz: 16 },
    { x: 38, z: 2, rx: 12, ry: 4.0, rz: 15 },
    { x: 26, z: 36, rx: 15, ry: 4.4, rz: 11 },
    { x: -24, z: 37, rx: 14, ry: 3.9, rz: 11 },
  ];
  for (const h of hills) {
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), hillMat);
    mound.position.set(h.x, -0.35, h.z);
    mound.scale.set(h.rx, h.ry, h.rz);
    mound.receiveShadow = true;
    group.add(mound);
  }

  return group;
}

export interface HollowOakRig {
  group: THREE.Group;
  oakGlint: THREE.Mesh;
}

/**
 * Hero botanical landmark: Gnarled Hollow Oak at (-6.2, 0, 15.6) inside CIRCLE_OBSTACLES r=1.35.
 */
export function buildHollowOakLandmark(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
): HollowOakRig {
  const group = new THREE.Group();
  group.position.set(-6.2, 0, 15.6);

  addStaticContactShadow(group, shadowTex, 4.6, 4.6, 0.52, 0.022);

  const barkMat = palette.standard('#64432F', 0.9, 0.01);
  const barkHighlightMat = palette.standard('#7A543C', 0.88, 0.01);
  const cavityMat = palette.standard('#261A14', 0.94, 0.0);
  const mossMat = palette.standard(STORYBOOK_PALETTE.moss, 0.88, 0.0);
  const foliageDeep = palette.standard(STORYBOOK_PALETTE.foliageDeep, 0.86, 0.0);
  const foliageMid = palette.standard(STORYBOOK_PALETTE.foliageMid, 0.84, 0.0);
  const foliageSun = palette.standard(STORYBOOK_PALETTE.foliageSun, 0.82, 0.0);

  // Flared root buttresses gripping the meadow
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const root = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.34, 0.95, 7), barkMat);
    root.position.set(Math.cos(a) * 0.68, 0.32, Math.sin(a) * 0.68);
    root.rotation.z = -Math.cos(a) * 0.62;
    root.rotation.x = Math.sin(a) * 0.62;
    root.castShadow = true;
    group.add(root);

    if (i % 2 === 0) {
      const moss = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), mossMat);
      moss.scale.set(1.3, 0.55, 1.1);
      moss.position.set(Math.cos(a) * 0.96, 0.14, Math.sin(a) * 0.96);
      group.add(moss);
    }
  }

  // Main gnarled oak trunk
  const trunkLower = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.96, 1.4, 10), barkMat);
  trunkLower.position.y = 0.7;
  trunkLower.castShadow = true;
  trunkLower.receiveShadow = true;

  const trunkUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.68, 1.1, 9), barkHighlightMat);
  trunkUpper.position.set(-0.04, 1.82, 0.02);
  trunkUpper.rotation.z = 0.06;
  trunkUpper.castShadow = true;
  group.add(trunkLower, trunkUpper);

  // Hollow root cavity facing North-East toward Toby (-4.8, 13.4), Hollow Oak inspect (-6.2, 14.0), & camera silhouette
  const cavityFrame = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.09, 7, 12), barkHighlightMat);
  cavityFrame.position.set(0.56, 0.42, -0.58);
  cavityFrame.rotation.y = Math.PI * 0.75;
  const cavityDark = new THREE.Mesh(new THREE.SphereGeometry(0.27, 8, 8), cavityMat);
  cavityDark.scale.set(1.0, 1.15, 0.65);
  cavityDark.position.set(0.51, 0.42, -0.53);
  cavityDark.rotation.y = Math.PI * 0.75;
  group.add(cavityFrame, cavityDark);

  // Gleaming brass clapper cue nestled inside hollow root
  const oakGlint = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.17, 0),
    new THREE.MeshStandardMaterial({
      color: '#FAD060',
      emissive: '#E8A028',
      emissiveIntensity: 0.9,
      metalness: 0.84,
      roughness: 0.2,
    }),
  );
  oakGlint.position.set(0.68, 0.36, -0.7);
  group.add(oakGlint);

  // Forked boughs supporting wide sculpted oak canopy
  const boughs: Array<{ pos: [number, number, number]; rot: [number, number, number]; len: number }> = [
    { pos: [-0.62, 2.38, 0.25], rot: [0.22, 0, 0.68], len: 1.3 },
    { pos: [0.68, 2.42, -0.18], rot: [-0.18, 0, -0.62], len: 1.25 },
    { pos: [0.08, 2.48, -0.58], rot: [-0.62, 0, 0.08], len: 1.15 },
  ];
  for (const b of boughs) {
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, b.len, 7), barkMat);
    limb.position.set(...b.pos);
    limb.rotation.set(...b.rot);
    limb.castShadow = true;
    group.add(limb);
  }

  // 6 multi-lobe sculpted foliage cushions (deep -> mid -> sunlit top highlights)
  const canopyLobes: Array<{ pos: [number, number, number]; scale: [number, number, number]; r: number; mat: THREE.MeshStandardMaterial }> = [
    { pos: [0, 3.35, 0], scale: [1.32, 0.92, 1.24], r: 1.38, mat: foliageMid },
    { pos: [-1.12, 2.95, 0.42], scale: [1.14, 0.85, 1.08], r: 1.05, mat: foliageDeep },
    { pos: [1.15, 3.05, -0.3], scale: [1.12, 0.86, 1.12], r: 1.02, mat: foliageMid },
    { pos: [0.18, 3.98, 0.16], scale: [1.16, 0.85, 1.08], r: 0.98, mat: foliageSun },
    { pos: [-0.35, 3.05, -0.95], scale: [1.04, 0.82, 1.04], r: 0.95, mat: foliageDeep },
    { pos: [0.55, 2.98, 0.88], scale: [1.05, 0.82, 1.02], r: 0.92, mat: foliageSun },
  ];
  for (const lobe of canopyLobes) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(lobe.r, 1), lobe.mat);
    puff.position.set(...lobe.pos);
    puff.scale.set(...lobe.scale);
    puff.castShadow = true;
    puff.receiveShadow = true;
    group.add(puff);
  }

  return { group, oakGlint };
}

function buildKoiFish(
  bodyColor: string,
  finColor: string,
  spotColor: string,
  palette: MaterialPalette,
  centerX: number,
  centerZ: number,
  radiusX: number,
  radiusZ: number,
  speed: number,
  phaseOffset: number,
): KoiFishRig {
  const group = new THREE.Group();
  const bodyMat = palette.standard(bodyColor, 0.35, 0.05);
  const finMat = palette.standard(finColor, 0.45, 0.02);
  const spotMat = palette.standard(spotColor, 0.38, 0.04);

  // Tapered plump koi body along +Z (forward)
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), bodyMat);
  torso.scale.set(0.85, 0.72, 2.05);
  group.add(torso);

  const dorsalSpot = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), spotMat);
  dorsalSpot.scale.set(0.9, 0.55, 1.3);
  dorsalSpot.position.set(0, 0.052, 0.04);
  group.add(dorsalSpot);

  // Subtle side pectoral fins
  for (const side of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.015, 0.07), finMat);
    fin.position.set(side * 0.1, -0.02, 0.05);
    fin.rotation.y = side * 0.45;
    group.add(fin);
  }

  // Hinged tail fin pivot at rear (-Z)
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0, -0.19);
  const tailUpper = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.16, 4), finMat);
  tailUpper.rotation.x = Math.PI / 2;
  tailUpper.scale.set(0.32, 1.0, 1.25);
  tailUpper.position.z = -0.06;
  tailPivot.add(tailUpper);
  group.add(tailPivot);

  return {
    group,
    tailPivot,
    centerX,
    centerZ,
    radiusX,
    radiusZ,
    speed,
    phaseOffset,
  };
}

/**
 * Mirror Pond with organic curved ShapeGeometry shoreline, layered sandy shoal & submerged river pebbles,
 * custom onBeforeCompile flowing water shader, articulated swimming koi fish, blooming water lilies,
 * swaying cattail/iris reeds, skimming dragonflies, a south-east cedar viewing pier with moored toy sailboat
 * & warm brass lanterns, north skipping-stone ledge, and a cambered cedar footbridge spanning the west brook.
 * Pond bounds stay inside BOX_OBSTACLES['pond_water'] (minX:-2.4, maxX:5.6, minZ:11.4, maxZ:16.6)
 * plus the flowing west brook culvert running cleanly under the arched bridge at (-2.9, 0, 14.0).
 */
export function buildMirrorPondAndBridge(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
  lanternMats?: THREE.MeshStandardMaterial[],
): MirrorPondRig {
  const group = new THREE.Group();

  const stoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.9, 0.02);
  const darkStoneMat = palette.standard(STORYBOOK_PALETTE.fieldstoneDark, 0.92, 0.02);
  const curbMat = palette.standard(STORYBOOK_PALETTE.limestoneCurb, 0.88, 0.02);
  const mossMat = palette.standard(STORYBOOK_PALETTE.moss, 0.88, 0.0);
  const deepBedMat = palette.standard('#355B66', 0.92, 0.0);
  const shoalBedMat = palette.standard('#8C836E', 0.9, 0.0);
  const lilyMat = palette.standard('#6FA355', 0.68, 0.02);
  const lilyFlowerMat = palette.standard(STORYBOOK_PALETTE.petalCream, 0.48, 0.04);
  const lilyCoreMat = palette.standard(STORYBOOK_PALETTE.petalMarigold, 0.55, 0.05);
  const reedMat = palette.standard(STORYBOOK_PALETTE.foliageDeep, 0.86, 0.0);
  const cattailMat = palette.standard('#6D452F', 0.86, 0.0);
  const irisMat = palette.standard('#7B74B8', 0.62, 0.02);
  const deckMat = palette.standard('#9E6F4D', 0.8, 0.03);
  const cedarDarkMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.78, 0.04);
  const cedarWarmMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.76, 0.04);
  const ropeMat = palette.standard('#C8B48A', 0.88, 0.0);
  const ironMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.4, 0.74);
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.25, 0.84);
  const wingMat = new THREE.MeshStandardMaterial({
    color: '#DDF2FA',
    roughness: 0.16,
    metalness: 0.12,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
  });
  const dragonflyBodyMat = palette.standard('#3E7E8C', 0.35, 0.35);

  const pierLanternGlassMat = new THREE.MeshStandardMaterial({
    color: '#FFE5A8',
    emissive: new THREE.Color('#FFA838'),
    emissiveIntensity: 0.25,
    roughness: 0.2,
  });
  if (lanternMats) {
    lanternMats.push(pierLanternGlassMat);
  }

  // Pond center (1.6, 0, 14.0)
  const pondGroup = new THREE.Group();
  pondGroup.position.set(1.6, 0, 14.0);
  addStaticContactShadow(pondGroup, shadowTex, 9.8, 5.6, 0.34, 0.015);

  // Organic curved pond silhouette in (sx, sy), rotated -PI/2 around X => localX = sx, localZ = -sy
  // Spans main pond x:-3.48..+3.58, z:-2.15..+2.15 plus west culvert brook tucked under bridge x:-5.18..-3.48, z:-0.88..+0.88
  const pondOutlinePts: THREE.Vector2[] = [
    new THREE.Vector2(-5.18, 0.48),
    new THREE.Vector2(-4.58, 0.68),
    new THREE.Vector2(-4.02, 0.90),
    new THREE.Vector2(-3.48, 1.38),
    new THREE.Vector2(-2.15, 2.02),
    new THREE.Vector2(-0.35, 2.16),
    new THREE.Vector2(1.55, 2.04),
    new THREE.Vector2(3.05, 1.56),
    new THREE.Vector2(3.58, 0.45),
    new THREE.Vector2(3.48, -0.95),
    new THREE.Vector2(2.65, -1.88),
    new THREE.Vector2(1.10, -2.14),
    new THREE.Vector2(-0.75, -2.06),
    new THREE.Vector2(-2.45, -1.82),
    new THREE.Vector2(-3.48, -1.32),
    new THREE.Vector2(-4.02, -0.88),
    new THREE.Vector2(-4.58, -0.66),
    new THREE.Vector2(-5.18, -0.46),
  ];
  const pondSpline = new THREE.SplineCurve(pondOutlinePts);
  const pondShape = new THREE.Shape(pondSpline.getPoints(80));
  const pondGeo = new THREE.ShapeGeometry(pondShape, 24);

  // Deep teal basin floor
  const pondBed = new THREE.Mesh(pondGeo, deepBedMat);
  pondBed.rotation.x = -Math.PI / 2;
  pondBed.position.y = 0.018;
  pondBed.receiveShadow = true;
  pondGroup.add(pondBed);

  // Slightly inset sandy shoal rim around edges for realistic depth falloff
  const shoalGeo = pondGeo.clone();
  const shoalRim = new THREE.Mesh(shoalGeo, shoalBedMat);
  shoalRim.rotation.x = -Math.PI / 2;
  shoalRim.scale.set(0.96, 0.94, 1);
  shoalRim.position.y = 0.024;
  shoalRim.receiveShadow = true;
  pondGroup.add(shoalRim);

  const deepCenterMat = deepBedMat;
  const deepCenter = new THREE.Mesh(new THREE.CircleGeometry(1.75, 20), deepCenterMat);
  deepCenter.rotation.x = -Math.PI / 2;
  deepCenter.scale.set(1.55, 0.92, 1);
  deepCenter.position.set(0.15, 0.03, 0);
  pondGroup.add(deepCenter);

  // 18 submerged river pebbles visible through clear water
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + (i % 3) * 0.25;
    const rad = 1.25 + (i % 4) * 0.42;
    const px = Math.cos(a) * rad * 1.38;
    const pz = Math.sin(a) * rad * 0.76;
    const pebble = new THREE.Mesh(
      new THREE.SphereGeometry(0.085 + (i % 3) * 0.025, 7, 5),
      i % 2 === 0 ? curbMat : darkStoneMat,
    );
    pebble.scale.set(1.3, 0.42, 1.05);
    pebble.position.set(px, 0.038, pz);
    pebble.rotation.y = i * 0.9;
    pondGroup.add(pebble);
  }

  // Animated custom shader pond water surface
  const waterMat = createStorybookPondWaterMaterial();
  const waterMesh = new THREE.Mesh(pondGeo, waterMat);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.y = 0.105;
  waterMesh.receiveShadow = true;
  pondGroup.add(waterMesh);

  // Natural fieldstone coping boulders & moss tufts hugging the curved shoreline (strictly inside pond_water bounds)
  const bankRocks: Array<{ x: number; z: number; r: number; sy: number; dark: boolean; moss?: boolean }> = [
    // North shore (kept south of world z = 11.35)
    { x: -3.22, z: -1.52, r: 0.38, sy: 0.48, dark: true },
    { x: -2.25, z: -1.92, r: 0.40, sy: 0.50, dark: false, moss: true },
    { x: -1.15, z: -1.96, r: 0.38, sy: 0.46, dark: true },
    { x: -0.25, z: -1.98, r: 0.39, sy: 0.42, dark: false },
    { x: 0.85, z: -1.96, r: 0.39, sy: 0.48, dark: true, moss: true },
    { x: 1.95, z: -1.86, r: 0.40, sy: 0.52, dark: false },
    { x: 2.95, z: -1.50, r: 0.42, sy: 0.50, dark: true },
    // East crescent (kept west of world x = 5.68)
    { x: 3.40, z: -0.58, r: 0.42, sy: 0.48, dark: false, moss: true },
    { x: 3.42, z: 0.48, r: 0.45, sy: 0.52, dark: true },
    { x: 3.18, z: 1.44, r: 0.44, sy: 0.50, dark: false },
    // South shore flanking pier (kept north of world z = 16.52)
    { x: 2.34, z: 1.84, r: 0.38, sy: 0.46, dark: true, moss: true },
    { x: 1.52, z: 1.94, r: 0.38, sy: 0.48, dark: false },
    { x: -0.25, z: 1.94, r: 0.39, sy: 0.50, dark: true },
    { x: -1.45, z: 1.88, r: 0.39, sy: 0.46, dark: false, moss: true },
    { x: -2.65, z: 1.66, r: 0.42, sy: 0.50, dark: true },
    { x: -3.22, z: 1.36, r: 0.38, sy: 0.46, dark: false },
    // West culvert mouth boulders (tucked cleanly beside bridge culvert, clear of (-4.35, 14.2) lawn path)
    { x: -5.02, z: -0.74, r: 0.28, sy: 0.44, dark: true, moss: true },
    { x: -5.02, z: 0.74, r: 0.28, sy: 0.44, dark: false },
  ];
  for (let i = 0; i < bankRocks.length; i++) {
    const rk = bankRocks[i];
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(rk.r, 0),
      rk.dark ? darkStoneMat : stoneMat,
    );
    rock.position.set(rk.x, 0.13, rk.z);
    rock.scale.set(1.22, rk.sy, 1.02);
    rock.rotation.y = i * 0.85;
    rock.castShadow = true;
    rock.receiveShadow = true;
    pondGroup.add(rock);

    if (rk.moss) {
      const tuft = new THREE.Mesh(new THREE.DodecahedronGeometry(rk.r * 0.52, 0), mossMat);
      tuft.scale.set(1.2, 0.55, 1.0);
      tuft.position.set(rk.x * 0.97, 0.24, rk.z * 0.97);
      pondGroup.add(tuft);
    }
  }

  // North shore skipping-stone ledge & bucket of smooth pebbles near mirror_pond interactable (local x:+0.2, z:-2.02 => world 1.8, 11.98)
  const skipLedge = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.52, 0.11, 8), curbMat);
  skipLedge.scale.set(1.35, 1, 0.95);
  skipLedge.position.set(0.2, 0.08, -2.02);
  skipLedge.receiveShadow = true;
  pondGroup.add(skipLedge);
  for (let p = 0; p < 4; p++) {
    const flatStone = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.07, 0.025, 7), stoneMat);
    flatStone.position.set(0.08 + p * 0.075, 0.148 + (p % 2) * 0.012, -2.02 + (p % 2) * 0.05);
    pondGroup.add(flatStone);
  }

  // South-East Mini Cedar Viewing Pier & Grounded Limestone Shore Step + Warm Pier Lantern
  const pierGroup = new THREE.Group();
  pierGroup.position.set(0.62, 0, 1.84);
  const pierShoreStep = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.16, 0.46), curbMat);
  pierShoreStep.position.set(0, 0.08, 0.44);
  pierShoreStep.castShadow = true;
  pierShoreStep.receiveShadow = true;
  pierGroup.add(pierShoreStep);
  for (const px of [-0.46, 0.46]) {
    for (const pz of [-0.62, 0.15]) {
      const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.42, 7), cedarDarkMat);
      piling.position.set(px, 0.14, pz);
      piling.castShadow = true;
      pierGroup.add(piling);
    }
  }
  const pierBeam = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.07, 0.09), cedarDarkMat);
  pierBeam.position.set(0, 0.18, -0.62);
  pierGroup.add(pierBeam);
  for (let i = 0; i < 5; i++) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(1.16, 0.055, 0.2),
      i % 2 === 0 ? deckMat : cedarWarmMat,
    );
    plank.position.set(0, 0.25, 0.34 - i * 0.23);
    plank.castShadow = true;
    plank.receiveShadow = true;
    pierGroup.add(plank);
  }
  // Mooring post + coiled hemp rope + warm brass pier lantern
  const lanternPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 1.28, 7), cedarDarkMat);
  lanternPost.position.set(-0.48, 0.64, -0.58);
  lanternPost.castShadow = true;
  const ropeCoil = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.024, 6, 12), ropeMat);
  ropeCoil.rotation.x = Math.PI / 2;
  ropeCoil.position.set(-0.48, 0.32, -0.58);
  const armBracket = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.05), ironMat);
  armBracket.position.set(-0.37, 1.24, -0.58);
  const pierLanternGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.065, 0.16, 6),
    pierLanternGlassMat,
  );
  pierLanternGlass.position.set(-0.27, 1.11, -0.58);
  const pierLanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.09, 6), ironMat);
  pierLanternCap.position.set(-0.27, 1.22, -0.58);
  pierGroup.add(lanternPost, ropeCoil, armBracket, pierLanternGlass, pierLanternCap);
  pondGroup.add(pierGroup);

  // Miniature moored walnut sailboat gently bobbing near the pier
  const sailboat = new THREE.Group();
  sailboat.position.set(1.42, 0.125, 1.02);
  sailboat.rotation.y = -0.55;
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.065, 0.42, 7), cedarDarkMat);
  hull.rotation.z = Math.PI / 2;
  hull.scale.set(0.66, 1.0, 1.18);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.055, 0.11),
    palette.standard('#FAF2E1', 0.72, 0.0),
  );
  cabin.position.set(-0.04, 0.068, 0);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.46, 5), cedarWarmMat);
  mast.position.set(0.02, 0.24, 0);
  const sailMat = palette.standard('#FBF5E8', 0.72, 0.0);
  const sailShape = new THREE.Shape();
  sailShape.moveTo(0, 0);
  sailShape.lineTo(0.24, 0.04);
  sailShape.lineTo(0, 0.36);
  sailShape.closePath();
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), sailMat);
  sail.material.side = THREE.DoubleSide;
  sail.position.set(0.02, 0.08, 0.005);
  const pennantShape = new THREE.Shape();
  pennantShape.moveTo(0, 0);
  pennantShape.lineTo(-0.1, -0.025);
  pennantShape.lineTo(0, -0.05);
  pennantShape.closePath();
  const pennant = new THREE.Mesh(
    new THREE.ShapeGeometry(pennantShape),
    palette.standard(STORYBOOK_PALETTE.terracottaPot, 0.68, 0.0),
  );
  pennant.material.side = THREE.DoubleSide;
  pennant.position.set(0.02, 0.46, 0.005);
  sailboat.add(hull, cabin, mast, sail, pennant);
  pondGroup.add(sailboat);

  // 3 Articulated Swimming Koi Fish gliding beneath the clear shader water (y = 0.065)
  const koiFishes: KoiFishRig[] = [
    buildKoiFish('#DE6B48', '#F6DFC6', '#FAF5EC', palette, -0.65, -0.22, 1.45, 0.72, 0.48, 0.0),
    buildKoiFish('#E8A63C', '#FCE7B2', '#2E2622', palette, 0.95, 0.18, 1.15, 0.68, 0.56, 2.2),
    buildKoiFish('#FAF4E8', '#E98D6B', '#D4573B', palette, 0.05, 0.08, 1.75, 0.85, 0.40, 4.1),
  ];
  for (const koi of koiFishes) {
    koi.group.position.set(koi.centerX, 0.065, koi.centerZ);
    pondGroup.add(koi.group);
  }

  // 6 Notched Lily Pads & 3 Layered Water Lily Blossoms
  const padSpecs: Array<[number, number, number, boolean]> = [
    [-1.45, -0.82, 0.34, true],
    [-0.95, -0.45, 0.25, false],
    [1.78, 0.85, 0.36, true],
    [2.28, 0.52, 0.24, false],
    [0.35, -1.08, 0.29, true],
    [-2.18, 0.75, 0.26, false],
  ];
  const lilyPadGroups: THREE.Group[] = [];
  const lilyBlooms: THREE.Mesh[] = [];
  for (const [lx, lz, lr, hasFlower] of padSpecs) {
    const padGroup = new THREE.Group();
    padGroup.position.set(lx, 0.128, lz);
    padGroup.rotation.y = lx * 1.4;
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(lr, lr, 0.026, 12, 1, false, 0.3, Math.PI * 1.78),
      lilyMat,
    );
    padGroup.add(pad);
    if (hasFlower) {
      const bloom = new THREE.Mesh(new THREE.DodecahedronGeometry(0.095, 0), lilyFlowerMat);
      bloom.position.set(0, 0.05, 0);
      bloom.scale.set(1.18, 0.68, 1.18);
      const centerCore = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), lilyCoreMat);
      centerCore.position.set(0, 0.045, 0);
      bloom.add(centerCore);
      padGroup.add(bloom);
      lilyBlooms.push(bloom);
    }
    pondGroup.add(padGroup);
    lilyPadGroups.push(padGroup);
  }

  // 4 Swaying Cattail & Blue-Flag Iris Clumps around shallow banks
  const reedStalks: THREE.Group[] = [];
  const reeds: Array<[number, number, boolean]> = [
    [2.95, -1.35, true],
    [3.12, 1.25, false],
    [-2.78, 1.48, true],
    [-2.95, -1.25, false],
  ];
  for (const [rx, rz, withIris] of reeds) {
    const clump = new THREE.Group();
    clump.position.set(rx, 0.08, rz);
    for (let s = 0; s < 4; s++) {
      const stalk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.03, 0.72 + s * 0.14, 5),
        reedMat,
      );
      stalk.position.set((s - 1.5) * 0.09, 0.36 + s * 0.04, (s % 2) * 0.08);
      stalk.rotation.z = (s - 1.5) * 0.1;
      clump.add(stalk);
      if (s === 1) {
        const tip = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.14, 3, 6), cattailMat);
        tip.position.set(-0.045, 0.78, 0.08);
        clump.add(tip);
      }
      if (withIris && s === 2) {
        const irisBloom = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), irisMat);
        irisBloom.scale.set(1.1, 1.4, 1.1);
        irisBloom.position.set(0.05, 0.82, 0);
        clump.add(irisBloom);
      }
    }
    pondGroup.add(clump);
    reedStalks.push(clump);
  }

  // 2 Skimming Pond Dragonflies
  const dragonflies: THREE.Group[] = [];
  for (let d = 0; d < 2; d++) {
    const df = new THREE.Group();
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.16, 5), dragonflyBodyMat);
    tail.rotation.x = Math.PI / 2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), brassMat);
    head.position.z = 0.08;
    const wingsL = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.045), wingMat);
    wingsL.rotation.x = -Math.PI / 2;
    wingsL.position.set(-0.08, 0.015, 0.02);
    const wingsR = wingsL.clone();
    wingsR.position.x = 0.08;
    df.add(tail, head, wingsL, wingsR);
    df.position.set(d === 0 ? -1.1 : 1.4, 0.55, d === 0 ? -0.4 : 0.6);
    pondGroup.add(df);
    dragonflies.push(df);
  }

  group.add(pondGroup);

  // Handcrafted Cedar Footbridge at (-2.9, 0, 14.0) with Stone Culvert Wing Walls & Bridge Post Lantern
  const bridgeGroup = new THREE.Group();
  bridgeGroup.position.set(-2.9, 0, 14.0);
  addStaticContactShadow(bridgeGroup, shadowTex, 2.5, 5.5, 0.42, 0.018);

  // Stone bridge abutments & stepped wing walls at North & South approaches
  for (const az of [-2.55, 2.55]) {
    const abutment = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.22, 0.56), stoneMat);
    abutment.position.set(0, 0.11, az);
    abutment.receiveShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.08, 0.64), curbMat);
    cap.position.set(0, 0.24, az);
    cap.receiveShadow = true;
    bridgeGroup.add(abutment, cap);
  }

  // Individual cambered wooden deck planks (spanning cleanly above the flowing west brook)
  const plankCount = 11;
  for (let i = 0; i < plankCount; i++) {
    const t = i / (plankCount - 1) - 0.5; // -0.5..0.5
    const pz = t * 4.55;
    const archY = 0.24 + (1 - 4 * t * t) * 0.18;
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(1.86, 0.11, 0.38),
      i % 2 === 0 ? deckMat : cedarWarmMat,
    );
    plank.position.set(0, archY, pz);
    plank.castShadow = true;
    plank.receiveShadow = true;
    bridgeGroup.add(plank);
  }

  // Side stringer beams & posts + handrails + brass post caps (aligned with bridge_west_rail & pond_water)
  for (const rx of [-0.79, 0.79]) {
    const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.18, 5.15), cedarDarkMat);
    stringer.position.set(rx, 0.22, 0);
    bridgeGroup.add(stringer);

    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 5.05), cedarWarmMat);
    topRail.position.set(rx, 0.96, 0);
    topRail.castShadow = true;
    const midRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 5.0), cedarDarkMat);
    midRail.position.set(rx, 0.64, 0);
    bridgeGroup.add(topRail, midRail);

    for (const rz of [-2.35, 0, 2.35]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.88, 0.14), cedarDarkMat);
      post.position.set(rx, 0.56, rz);
      post.castShadow = true;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.2), cedarWarmMat);
      cap.position.set(rx, 1.02, rz);
      const brassFinial = new THREE.Mesh(new THREE.SphereGeometry(0.045, 7, 7), brassMat);
      brassFinial.position.set(rx, 1.08, rz);
      bridgeGroup.add(post, cap, brassFinial);
    }
  }

  // Hanging iron-and-brass lantern mounted on south-east bridge post (aligned with shader dusk reflection)
  const bridgeLanternPost = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.52, 6), ironMat);
  bridgeLanternPost.position.set(0.79, 1.28, 1.75);
  const bridgeArm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.045, 0.045), ironMat);
  bridgeArm.position.set(0.87, 1.52, 1.75);
  const bridgeLanternBulb = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.06, 0.15, 6),
    pierLanternGlassMat,
  );
  bridgeLanternBulb.position.set(0.95, 1.4, 1.75);
  const bridgeLanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.08, 6), ironMat);
  bridgeLanternCap.position.set(0.95, 1.5, 1.75);
  bridgeGroup.add(bridgeLanternPost, bridgeArm, bridgeLanternBulb, bridgeLanternCap);

  group.add(bridgeGroup);

  return {
    group,
    waterMesh,
    waterMat,
    koiFishes,
    lilyPadGroups,
    lilyBlooms,
    reedStalks,
    dragonflies,
    sailboat,
  };
}
