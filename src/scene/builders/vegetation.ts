import * as THREE from 'three';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';

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
        addContactShadow(wall, shadowTex, 4.6, 1.4, 0.32, 0.015);
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

  addContactShadow(group, shadowTex, 4.6, 4.6, 0.52, 0.022);

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

/**
 * Mirror Pond with natural fieldstone coping, lily pads, cattails, and arched cedar footbridge.
 * Pond bounds stay inside BOX_OBSTACLES['pond_water'] (minX:-2.4, maxX:5.6, minZ:11.4, maxZ:16.6).
 */
export function buildMirrorPondAndBridge(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
): THREE.Group {
  const group = new THREE.Group();

  const stoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.9, 0.02);
  const darkStoneMat = palette.standard(STORYBOOK_PALETTE.fieldstoneDark, 0.92, 0.02);
  const bedMat = palette.standard('#3E6976', 0.9, 0.0);
  const lilyMat = palette.standard(STORYBOOK_PALETTE.foliageSun, 0.72, 0.02);
  const lilyFlowerMat = palette.standard(STORYBOOK_PALETTE.petalCream, 0.55, 0.02);
  const reedMat = palette.standard(STORYBOOK_PALETTE.foliageDeep, 0.86, 0.0);
  const cattailMat = palette.standard('#6D452F', 0.86, 0.0);
  const deckMat = palette.standard('#9E6F4D', 0.8, 0.03);
  const cedarDarkMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.78, 0.04);
  const cedarWarmMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.76, 0.04);

  // Pond center (1.6, 0, 14.0), span ~ 7.5 x 4.8
  const pondGroup = new THREE.Group();
  pondGroup.position.set(1.6, 0, 14.0);
  addContactShadow(pondGroup, shadowTex, 8.2, 5.4, 0.34, 0.015);

  const pondBed = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.06, 4.4), bedMat);
  pondBed.position.y = 0.02;
  pondBed.receiveShadow = true;
  pondGroup.add(pondBed);

  const pondWater = new THREE.Mesh(
    new THREE.BoxGeometry(7.16, 0.08, 4.36),
    new THREE.MeshStandardMaterial({
      color: '#6BB4C6',
      roughness: 0.14,
      metalness: 0.16,
      transparent: true,
      opacity: 0.84,
    }),
  );
  pondWater.position.y = 0.08;
  pondGroup.add(pondWater);

  // Irregular fieldstone coping stones bordering the water
  const bankRocks: Array<{ x: number; z: number; r: number; sy: number; dark: boolean }> = [
    { x: -3.55, z: -1.9, r: 0.42, sy: 0.52, dark: false },
    { x: -2.5, z: -2.28, r: 0.48, sy: 0.48, dark: true },
    { x: -1.1, z: -2.3, r: 0.38, sy: 0.5, dark: false },
    { x: 0.4, z: -2.32, r: 0.46, sy: 0.52, dark: false },
    { x: 1.9, z: -2.28, r: 0.42, sy: 0.46, dark: true },
    { x: 3.3, z: -2.15, r: 0.48, sy: 0.54, dark: false },
    { x: 3.65, z: -0.9, r: 0.44, sy: 0.48, dark: true },
    { x: 3.68, z: 0.65, r: 0.46, sy: 0.5, dark: false },
    { x: 3.45, z: 2.05, r: 0.45, sy: 0.52, dark: false },
    { x: 2.1, z: 2.3, r: 0.4, sy: 0.46, dark: true },
    { x: 0.5, z: 2.32, r: 0.48, sy: 0.5, dark: false },
    { x: -1.2, z: 2.3, r: 0.42, sy: 0.48, dark: true },
    { x: -2.8, z: 2.25, r: 0.46, sy: 0.52, dark: false },
    { x: -3.55, z: 1.15, r: 0.4, sy: 0.48, dark: true },
  ];
  for (let i = 0; i < bankRocks.length; i++) {
    const rk = bankRocks[i];
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(rk.r, 0),
      rk.dark ? darkStoneMat : stoneMat,
    );
    rock.position.set(rk.x, 0.14, rk.z);
    rock.scale.set(1.25, rk.sy, 1.05);
    rock.rotation.y = i * 0.85;
    rock.receiveShadow = true;
    pondGroup.add(rock);
  }

  // Lily pads & blossoms
  const pads: Array<[number, number, number, boolean]> = [
    [-1.4, -0.8, 0.34, true],
    [-0.95, -0.45, 0.25, false],
    [1.75, 0.95, 0.36, true],
    [2.25, 0.65, 0.24, false],
    [0.3, -1.1, 0.28, false],
  ];
  for (const [lx, lz, lr, hasFlower] of pads) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(lr, lr, 0.03, 10, 1, false, 0.3, Math.PI * 1.78), lilyMat);
    pad.position.set(lx, 0.135, lz);
    pad.rotation.y = lx * 1.4;
    pondGroup.add(pad);
    if (hasFlower) {
      const bloom = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 0), lilyFlowerMat);
      bloom.position.set(lx, 0.19, lz);
      bloom.scale.set(1.1, 0.72, 1.1);
      pondGroup.add(bloom);
    }
  }

  // Cattail reed clumps along east & south-west pond rim
  const reeds: Array<[number, number]> = [
    [3.15, -1.65],
    [3.28, 1.45],
    [-2.95, 1.75],
  ];
  for (const [rx, rz] of reeds) {
    for (let s = 0; s < 3; s++) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.75 + s * 0.15, 5), reedMat);
      stalk.position.set(rx + (s - 1) * 0.1, 0.42, rz + (s % 2) * 0.08);
      stalk.rotation.z = (s - 1) * 0.12;
      pondGroup.add(stalk);
      if (s === 1) {
        const tip = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.14, 3, 6), cattailMat);
        tip.position.set(rx, 0.82, rz + 0.08);
        pondGroup.add(tip);
      }
    }
  }
  group.add(pondGroup);

  // Handcrafted Cedar Footbridge at (-2.9, 0, 14.0)
  const bridgeGroup = new THREE.Group();
  bridgeGroup.position.set(-2.9, 0, 14.0);
  addContactShadow(bridgeGroup, shadowTex, 2.8, 5.5, 0.42, 0.018);

  // Stone bridge abutments at North & South approaches
  for (const az of [-2.55, 2.55]) {
    const abutment = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.22, 0.55), stoneMat);
    abutment.position.set(0, 0.11, az);
    abutment.receiveShadow = true;
    bridgeGroup.add(abutment);
  }

  // Individual cambered wooden deck planks
  const plankCount = 11;
  for (let i = 0; i < plankCount; i++) {
    const t = i / (plankCount - 1) - 0.5; // -0.5..0.5
    const pz = t * 4.55;
    const archY = 0.22 + (1 - 4 * t * t) * 0.18;
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(2.14, 0.11, 0.38),
      i % 2 === 0 ? deckMat : cedarWarmMat,
    );
    plank.position.set(0, archY, pz);
    plank.castShadow = true;
    plank.receiveShadow = true;
    bridgeGroup.add(plank);
  }

  // Side stringer beams & posts + handrails
  for (const rx of [-0.98, 0.98]) {
    const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 5.15), cedarDarkMat);
    stringer.position.set(rx, 0.2, 0);
    bridgeGroup.add(stringer);

    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 5.05), cedarWarmMat);
    topRail.position.set(rx, 0.94, 0);
    topRail.castShadow = true;
    const midRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 5.0), cedarDarkMat);
    midRail.position.set(rx, 0.62, 0);
    bridgeGroup.add(topRail, midRail);

    for (const rz of [-2.35, 0, 2.35]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.88, 0.16), cedarDarkMat);
      post.position.set(rx, 0.54, rz);
      post.castShadow = true;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.22), cedarWarmMat);
      cap.position.set(rx, 1.0, rz);
      bridgeGroup.add(post, cap);
    }
  }
  group.add(bridgeGroup);

  return group;
}
