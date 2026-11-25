import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';
import { KoiFishRig, MirrorPondRig } from '../models';
import { createStorybookPondWaterMaterial } from '../waterShaders';
import { addStaticContactShadow } from '../contactShadows';
import { applyAmbientSway } from '../ambientSway';

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

  // Tapered flared trunk via LatheGeometry — with a forked bough hint merged
  // into the same geometry (BUILD 02 Doc 05 §5.2: branch fork without a 4th
  // instanced mesh). The fork reads differently per tree because each instance
  // carries its own rotation hash.
  const trunkPoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.36, 0.0),
    new THREE.Vector2(0.27, 0.35),
    new THREE.Vector2(0.21, 1.35),
    new THREE.Vector2(0.15, 1.78),
    new THREE.Vector2(0.0, 1.8),
  ];
  const trunkGeo = new THREE.LatheGeometry(trunkPoints, 8);
  const forkGeo = new THREE.CylinderGeometry(0.055, 0.085, 1.05, 6);
  forkGeo.translate(0, 0.52, 0);
  forkGeo.rotateZ(0.62);
  forkGeo.translate(0.12, 1.52, 0);
  const trunkWithFork = mergeGeometries([trunkGeo, forkGeo])!;
  trunkGeo.dispose();
  forkGeo.dispose();
  const trunkMat = palette.standard(STORYBOOK_PALETTE.oakBark, 0.9, 0.01);

  // Lower main canopy cushion + asymmetrical upper canopy lobe. BUILD 02
  // (Doc 05 §5.2): a THIRD crown lobe merges into the top geometry — per-tree
  // variation comes from the instance rotation hash, so the grove keeps its
  // 3 draw calls while the 2-lobe stack read breaks at every angle.
  const crownBaseGeo = new THREE.IcosahedronGeometry(1.08, 1);
  crownBaseGeo.scale(1.18, 0.86, 1.12);
  crownBaseGeo.translate(0, 2.28, 0);

  const crownTopLobe = new THREE.IcosahedronGeometry(0.82, 1);
  crownTopLobe.scale(1.12, 0.84, 1.04);
  crownTopLobe.translate(0.24, 2.84, -0.14);
  const crownMidLobe = new THREE.IcosahedronGeometry(0.62, 1);
  crownMidLobe.scale(1.05, 0.9, 1.0);
  crownMidLobe.rotateY(2.1);
  crownMidLobe.translate(-0.42, 2.62, 0.28);
  const crownTopGeo = mergeGeometries([crownTopLobe, crownMidLobe])!;
  crownTopLobe.dispose();
  crownMidLobe.dispose();

  // BUILD 04 (VISUAL_IDENTITY §7): the grove gains a shader-driven breeze sway —
  // a distinct cache key keeps the orchard's JS instance sway authoritative
  // (orchard trees reuse the ORIGINAL grove_crown_* keys and stay un-hooked),
  // and the rig exposes these same material instances so the seasonal tint
  // path follows automatically. Zero draw-call delta, zero per-frame JS.
  const crownBaseMat = palette.get('grove_crown_base_sway', {
    color: '#FFFFFF',
    roughness: 0.85,
    metalness: 0.0,
  });
  const crownTopMat = palette.get('grove_crown_top_sway', {
    color: '#FFFFFF',
    roughness: 0.82,
    metalness: 0.0,
  });
  applyAmbientSway(crownBaseMat, { key: 'crown_grove_base', maskStart: 1.9, maskEnd: 3.05, amp: 0.042, freq: 1.05 });
  applyAmbientSway(crownTopMat, { key: 'crown_grove_top', maskStart: 1.9, maskEnd: 2.85, amp: 0.055, freq: 1.05 });

  const trunksInst = new THREE.InstancedMesh(trunkWithFork, trunkMat, treeCount);
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
 *
 * Stage 3 spatial redesign (Slice O1): the old oak measured trunk-top ≈ 2.9u /
 * canopy-top ≈ 4.8u — barely above the house roof peaks (≈ 4.3u), so the "enormous,
 * memorable tree" read as a slightly plump neighbor of the ordinary trees. The
 * rebuild is a re-COMPOSITION, not a uniform scale: flared root buttresses grip to
 * the walkable boundary (visual reach ≈ 1.7u ≈ collision 1.35 + player 0.48), the
 * trunk tapers 1.12 → 0.60 over 3.3u of height, five expressive boughs carry an
 * eight-lobe canopy whose top ≈ 7.5u (tallest silhouette in Willow Square, above
 * the gazebo spire ≈ 5.2u) with a ≈ 7.3u spread that naturally overhangs the West
 * Brook and the jetty lawn with dappled shade. LOGICAL collision stays r 1.35 —
 * zero walkability, navigation, fishing-spot or NPC-route change; the canopy is
 * ground-clear overhead (no collider, same as every tree crown).
 *
 * Draw discipline: bark (roots + trunk + boughs) merges into ONE mesh, canopy
 * lobes merge per tone (deep/mid/sun) into 3 meshes, moss merges into 1 — the
 * old build spent 24 meshes; this one spends 8 (+ glint/cavity contracts).
 */
export function buildHollowOakLandmark(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
): HollowOakRig {
  const group = new THREE.Group();
  group.position.set(-6.2, 0, 15.6);

  addStaticContactShadow(group, shadowTex, 8.0, 8.0, 0.52, 0.022);

  const barkMat = palette.standard('#64432F', 0.9, 0.01);
  const barkHighlightMat = palette.standard('#7A543C', 0.88, 0.01);
  const cavityMat = palette.standard('#261A14', 0.94, 0.0);
  const mossMat = palette.standard(STORYBOOK_PALETTE.moss, 0.88, 0.0);
  const foliageDeep = palette.standard(STORYBOOK_PALETTE.foliageDeep, 0.86, 0.0);
  const foliageMid = palette.standard(STORYBOOK_PALETTE.foliageMid, 0.84, 0.0);
  const foliageSun = palette.standard(STORYBOOK_PALETTE.foliageSun, 0.82, 0.0);

  // Transform-baking for per-material merged static geometry (fountain precedent).
  const scratch = new THREE.Object3D();
  const baked = (
    geo: THREE.BufferGeometry,
    pos: [number, number, number],
    rot?: [number, number, number],
    scale?: [number, number, number],
  ): THREE.BufferGeometry => {
    scratch.position.set(pos[0], pos[1], pos[2]);
    scratch.rotation.set(rot?.[0] ?? 0, rot?.[1] ?? 0, rot?.[2] ?? 0);
    scratch.scale.set(scale?.[0] ?? 1, scale?.[1] ?? 1, scale?.[2] ?? 1);
    scratch.updateMatrix();
    geo.applyMatrix4(scratch.matrix);
    return geo;
  };

  const barkGeos: THREE.BufferGeometry[] = [];
  const mossGeos: THREE.BufferGeometry[] = [];

  // Flared root buttresses gripping the meadow (7, reaching the walkable rim)
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const rx = Math.cos(a);
    const rz = Math.sin(a);
    barkGeos.push(
      baked(new THREE.CylinderGeometry(0.2, 0.44, 1.15, 7), [rx * 0.74, 0.36, rz * 0.74], [
        rz * 0.66,
        0,
        -rx * 0.66,
      ]),
    );
    if (i % 2 === 0) {
      mossGeos.push(
        baked(new THREE.DodecahedronGeometry(0.3, 0), [rx * 1.05, 0.15, rz * 1.05], undefined, [
          1.35,
          0.55,
          1.15,
        ]),
      );
    }
  }

  // Main gnarled oak trunk — flared LatheGeometry with pronounced taper
  // (base r 1.12 → waist 0.64 → top 0.60 over 3.3u; the old build topped at 2.4u).
  const trunkProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(1.02, 0.0),
    new THREE.Vector2(1.12, 0.22),
    new THREE.Vector2(0.98, 0.62),
    new THREE.Vector2(0.82, 1.35),
    new THREE.Vector2(0.72, 2.1),
    new THREE.Vector2(0.64, 2.85),
    new THREE.Vector2(0.6, 3.3),
    new THREE.Vector2(0.0, 3.34),
  ];
  barkGeos.push(new THREE.LatheGeometry(trunkProfile, 10));

  // Hollow root cavity facing North-East toward Toby (-4.8, 13.4), Hollow Oak
  // inspect (-6.2, 14.0), & camera silhouette — scaled up with the trunk so the
  // hollow reads at gameplay zoom (old opening ≈ 0.32u → 0.44u).
  // Review round: the hollow must READ from the default NE camera — enlarged
  // (opening ≈ 0.42 → 0.55u) and swung toward east-north-east.
  const cavityFrameGeo = new THREE.TorusGeometry(0.52, 0.14, 7, 14);
  const cavityFrame = new THREE.Mesh(cavityFrameGeo, barkHighlightMat);
  cavityFrame.position.set(0.78, 0.72, -0.5);
  cavityFrame.rotation.y = Math.PI * 0.72;
  cavityFrame.castShadow = true;
  const cavityDarkGeo = new THREE.SphereGeometry(0.47, 8, 8);
  const cavityDark = new THREE.Mesh(cavityDarkGeo, cavityMat);
  cavityDark.scale.set(1.0, 1.2, 0.5);
  cavityDark.position.set(0.72, 0.72, -0.44);
  cavityDark.rotation.y = Math.PI * 0.72;
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
  oakGlint.position.set(0.92, 0.48, -0.62);
  group.add(oakGlint);

  // Five expressive forked boughs carrying the broad crown
  const boughs: Array<{ pos: [number, number, number]; rot: [number, number, number]; len: number; r0: number; r1: number }> = [
    { pos: [-0.95, 3.35, 0.5], rot: [0.24, 0, 0.72], len: 2.5, r0: 0.2, r1: 0.34 },
    { pos: [1.0, 3.45, -0.4], rot: [-0.2, 0, -0.68], len: 2.4, r0: 0.2, r1: 0.32 },
    { pos: [0.12, 3.6, -1.0], rot: [-0.66, 0, 0.1], len: 2.2, r0: 0.18, r1: 0.3 },
    { pos: [-0.4, 3.5, 1.05], rot: [0.6, 0, 0.24], len: 2.1, r0: 0.16, r1: 0.28 },
    { pos: [0.55, 3.7, 0.45], rot: [0.12, 0, -0.2], len: 1.9, r0: 0.16, r1: 0.26 },
  ];
  for (const b of boughs) {
    barkGeos.push(
      baked(new THREE.CylinderGeometry(b.r0, b.r1, b.len, 7), b.pos, [b.rot[0], 0, b.rot[2]]),
    );
  }

  const barkMerged = new THREE.Mesh(mergeGeometries(barkGeos)!, barkMat);
  barkMerged.name = 'hollow_oak_bark_merged';
  barkMerged.castShadow = true;
  barkMerged.receiveShadow = true;
  group.add(barkMerged);

  // Eight multi-lobe sculpted foliage cushions (deep → mid → sunlit top
  // highlights), baked + merged per tone: canopy top ≈ 7.5u, spread ≈ 7.3u.
  const canopyLobes: Array<{ pos: [number, number, number]; scale: [number, number, number]; r: number; mat: THREE.MeshStandardMaterial }> = [
    { pos: [0, 5.6, 0], scale: [1.35, 0.95, 1.3], r: 2.1, mat: foliageMid },
    { pos: [-1.7, 5.0, 0.9], scale: [1.2, 0.88, 1.15], r: 1.6, mat: foliageDeep },
    { pos: [1.9, 5.15, -1.0], scale: [1.18, 0.9, 1.16], r: 1.65, mat: foliageMid },
    { pos: [0.5, 6.35, 0.3], scale: [1.15, 0.85, 1.1], r: 1.5, mat: foliageSun },
    { pos: [-1.2, 4.7, -1.6], scale: [1.12, 0.84, 1.1], r: 1.5, mat: foliageDeep },
    { pos: [1.3, 4.75, 1.5], scale: [1.1, 0.84, 1.08], r: 1.45, mat: foliageSun },
    { pos: [-0.6, 6.0, -1.3], scale: [1.08, 0.82, 1.06], r: 1.4, mat: foliageMid },
    { pos: [0.1, 4.4, 2.1], scale: [1.06, 0.8, 1.04], r: 1.3, mat: foliageDeep },
  ];
  const canopyByTone = new Map<THREE.MeshStandardMaterial, THREE.BufferGeometry[]>();
  for (const lobe of canopyLobes) {
    const geo = new THREE.IcosahedronGeometry(lobe.r, 1);
    scratch.position.set(lobe.pos[0], lobe.pos[1], lobe.pos[2]);
    scratch.rotation.set(0, 0, 0);
    scratch.scale.set(lobe.scale[0], lobe.scale[1], lobe.scale[2]);
    scratch.updateMatrix();
    geo.applyMatrix4(scratch.matrix);
    const list = canopyByTone.get(lobe.mat) ?? [];
    list.push(geo);
    canopyByTone.set(lobe.mat, list);
  }
  let toneIndex = 0;
  for (const [mat, geos] of canopyByTone) {
    const merged = new THREE.Mesh(mergeGeometries(geos)!, mat);
    merged.name = `hollow_oak_canopy_${toneIndex++}`;
    merged.castShadow = true;
    merged.receiveShadow = true;
    for (const g of geos) g.dispose();
    group.add(merged);
  }

  const mossMerged = new THREE.Mesh(mergeGeometries(mossGeos)!, mossMat);
  mossMerged.name = 'hollow_oak_moss_merged';
  mossMerged.receiveShadow = true;
  group.add(mossMerged);

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
/**
 * Slice W1: the pond + West Brook water outline in SHAPE space (sx, sy), where
 * world x = POND_CENTER.x + sx and world z = POND_CENTER.z - sy. Exported so the
 * headless spatial-invariants battery can verify the rendered water polygon is
 * fully covered by the walkability exclusion boxes (visible water is never
 * standable) and that the pond's area/shoreline actually GREW.
 */
export const POND_OUTLINE_SHAPE_POINTS: readonly [number, number][] = [
  [-13.2, 0.4], [-12.0, 0.55], [-10.8, 0.62], [-9.5, 0.66], [-8.2, 0.68],
  [-7.0, 0.68], [-6.0, 0.68], [-5.5, 0.92], [-5.0, 1.2], [-4.5, 1.5],
  [-3.9, 1.78], [-3.0, 2.02], [-1.6, 2.14], [0.3, 2.08], [1.8, 1.98],
  [2.9, 1.7], [3.25, 1.52], [3.6, 1.32], [4.0, 1.12], [4.4, 0.85],
  [4.68, 0.5], [4.7, 0.0], [4.62, -0.5], [4.4, -0.85], [4.1, -1.08],
  [3.7, -1.25], [3.25, -1.48], [2.85, -1.62], [1.9, -1.9], [0.6, -2.06],
  [-0.9, -2.02], [-2.3, -1.84], [-3.4, -1.46], [-4.0, -1.12], [-4.6, -0.8],
  [-5.3, -0.74], [-6.0, -0.76], [-7.0, -0.8], [-8.2, -0.82], [-9.5, -0.8],
  [-10.8, -0.72], [-12.0, -0.6], [-13.2, -0.4],
];

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
  // Slice W1: the water grows a north-east lobe (world x to 6.3, z 12.3..15.2) and the
  // West Brook extends WEST as a running stream (world x -9.2..-4.4, z 13.3..14.9)
  // — every outline point stays inside its walkability exclusion box
  // (pond_water / pond_water_east / west_brook_run) or the rail/pond-covered
  // under-bridge band, so visible water is never standable (SPAT-01 pin).
  const pondOutlinePts: THREE.Vector2[] = POND_OUTLINE_SHAPE_POINTS.map((p) => new THREE.Vector2(p[0], p[1]));
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
  // FLICKER FIX T1 (investigation R5): deterministic transparent water layer.
  waterMesh.renderOrder = 2;
  pondGroup.add(waterMesh);

  // Natural fieldstone coping boulders & moss tufts hugging the curved shoreline
  // (strictly inside the water exclusion boxes / under-bridge culvert band)
  const bankRocks: Array<{ x: number; z: number; r: number; sy: number; dark: boolean; moss?: boolean }> = [
    // North shore (kept south of world z = 11.35)
    { x: -3.22, z: -1.52, r: 0.38, sy: 0.48, dark: true },
    { x: -2.25, z: -1.92, r: 0.40, sy: 0.50, dark: false, moss: true },
    { x: -1.15, z: -1.96, r: 0.38, sy: 0.46, dark: true },
    { x: -0.25, z: -1.98, r: 0.39, sy: 0.42, dark: false },
    { x: 0.85, z: -1.96, r: 0.39, sy: 0.48, dark: true, moss: true },
    { x: 1.95, z: -1.86, r: 0.40, sy: 0.52, dark: false },
    { x: 2.95, z: -1.50, r: 0.42, sy: 0.50, dark: true },
    // East lobe shore (Slice W1: world x 5.7..6.5, z 12.4..15.2)
    { x: 4.9, z: -1.4, r: 0.40, sy: 0.48, dark: true },
    { x: 4.95, z: -0.4, r: 0.42, sy: 0.52, dark: false, moss: true },
    { x: 4.9, z: 0.7, r: 0.40, sy: 0.5, dark: true },
    { x: 4.5, z: 1.15, r: 0.38, sy: 0.46, dark: false },
    { x: 4.3, z: -1.5, r: 0.36, sy: 0.44, dark: true, moss: true },
    // South shore flanking pier (kept north of world z = 16.52)
    { x: 2.34, z: 1.84, r: 0.38, sy: 0.46, dark: true, moss: true },
    { x: 1.52, z: 1.94, r: 0.38, sy: 0.48, dark: false },
    { x: -0.25, z: 1.94, r: 0.39, sy: 0.50, dark: true },
    { x: -1.45, z: 1.88, r: 0.39, sy: 0.46, dark: false, moss: true },
    { x: -2.65, z: 1.66, r: 0.42, sy: 0.50, dark: true },
    { x: -3.22, z: 1.36, r: 0.38, sy: 0.46, dark: false },
    // West brook stream banks (Slice W1: along world z ≈ 13.1 / 14.9)
    { x: -7.0, z: -0.88, r: 0.3, sy: 0.44, dark: true },
    { x: -8.2, z: -0.84, r: 0.28, sy: 0.42, dark: false, moss: true },
    { x: -6.4, z: 0.9, r: 0.3, sy: 0.44, dark: false },
    { x: -7.9, z: 0.86, r: 0.28, sy: 0.42, dark: true, moss: true },
    { x: -8.9, z: -0.84, r: 0.26, sy: 0.4, dark: false },
    { x: -10.4, z: 0.78, r: 0.26, sy: 0.4, dark: true },
    { x: -11.8, z: -0.72, r: 0.28, sy: 0.42, dark: false, moss: true },
    // Mid-stream boulders breaking the current (visual only, inside the water)
    { x: -8.5, z: -0.08, r: 0.2, sy: 0.3, dark: true },
    { x: -10.2, z: 0.14, r: 0.18, sy: 0.28, dark: false },
    { x: -7.2, z: 0.28, r: 0.16, sy: 0.26, dark: true },
    // Culvert mouth boulders flanking the widened channel under the bridge
    { x: -6.15, z: -0.65, r: 0.3, sy: 0.46, dark: true, moss: true },
    { x: -6.15, z: 0.85, r: 0.3, sy: 0.46, dark: false },
    { x: -5.55, z: -0.72, r: 0.28, sy: 0.44, dark: true },
    { x: -5.55, z: 0.76, r: 0.28, sy: 0.44, dark: false, moss: true },
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

  // 4 Swaying Cattail & Blue-Flag Iris Clumps around shallow banks + 2 streamside
  // clumps on the new West Brook run (Slice W1)
  const reedStalks: THREE.Group[] = [];
  const reeds: Array<[number, number, boolean]> = [
    [2.95, -1.35, true],
    [3.12, 1.25, false],
    [-2.78, 1.48, true],
    [-2.95, -1.25, false],
    [-7.9, -0.85, true],
    [-9.1, 0.9, false],
    [-11.4, -0.78, true],
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

  // Handcrafted Stone-and-Cedar Arch Bridge at (-2.9, 0, 14.0) — Slice W1 rebuild.
  // The old span was a 1.86u-wide, 0.42u-tall plank run crossing 5.1u of mostly
  // DRY ground (its 1.7u channel sat under the middle) — a token miniature. The
  // rebuild is a real arch: 2.5u deck, 0.85u cambered peak, a 3.5u span that
  // actually bridges the widened culvert + brook channel, stone abutments with
  // wing walls, half-torus culvert rings at both water mouths, stepped cedar
  // railing with brass caps, and the retained iron lantern. The logical twin
  // (getGroundHeightAt arch + bridge_west_rail box + nav deck chain) is updated
  // to match exactly. Merged per material: 8 meshes (old ≈ 40).
  const bridgeGroup = new THREE.Group();
  bridgeGroup.position.set(-2.9, 0, 14.0);
  addStaticContactShadow(bridgeGroup, shadowTex, 3.6, 4.6, 0.5, 0.018);

  const stoneGeos: THREE.BufferGeometry[] = [];
  const plankDeckGeos: THREE.BufferGeometry[] = [];
  const plankWarmGeos: THREE.BufferGeometry[] = [];
  const cedarDarkGeos: THREE.BufferGeometry[] = [];
  const cedarWarmGeos: THREE.BufferGeometry[] = [];
  const brassGeos: THREE.BufferGeometry[] = [];
  const ironBridgeGeos: THREE.BufferGeometry[] = [];
  const bridgeScratch = new THREE.Object3D();
  const bBake = (
    geo: THREE.BufferGeometry,
    pos: [number, number, number],
    rot?: [number, number, number],
  ): THREE.BufferGeometry => {
    bridgeScratch.position.set(pos[0], pos[1], pos[2]);
    bridgeScratch.rotation.set(rot?.[0] ?? 0, rot?.[1] ?? 0, rot?.[2] ?? 0);
    bridgeScratch.scale.set(1, 1, 1);
    bridgeScratch.updateMatrix();
    geo.applyMatrix4(bridgeScratch.matrix);
    return geo;
  };

  // Stone abutments + stepped wing walls at both approaches (deeper, wider)
  for (const az of [-1.95, 1.95]) {
    stoneGeos.push(bBake(new THREE.BoxGeometry(2.9, 0.3, 0.62), [0, 0.15, az]));
    stoneGeos.push(bBake(new THREE.BoxGeometry(3.0, 0.1, 0.72), [0, 0.33, az]));
    // Angled wing walls guiding the bank into the abutment
    const dir = az > 0 ? 1 : -1;
    stoneGeos.push(
      bBake(new THREE.BoxGeometry(0.9, 0.24, 0.4), [1.72, 0.12, az + dir * 0.38], [0, dir * -0.5, 0]),
    );
    stoneGeos.push(
      bBake(new THREE.BoxGeometry(0.9, 0.24, 0.4), [-1.72, 0.12, az + dir * 0.38], [0, dir * 0.5, 0]),
    );
  }
  // Half-torus culvert rings framing both water mouths under the deck
  stoneGeos.push(
    bBake(new THREE.TorusGeometry(1.0, 0.17, 8, 14, Math.PI), [-1.45, 0.1, 0], [0, Math.PI / 2, 0]),
  );
  stoneGeos.push(
    bBake(new THREE.TorusGeometry(1.0, 0.17, 8, 14, Math.PI), [0.75, 0.1, 0], [0, Math.PI / 2, 0]),
  );
  // Stone spandrel cheeks under the deck edges — give the span a masonry
  // profile so the arch reads from the isometric camera (review finding).
  stoneGeos.push(bBake(new THREE.BoxGeometry(0.34, 0.5, 3.0), [-1.18, 0.3, 0]));
  stoneGeos.push(bBake(new THREE.BoxGeometry(0.34, 0.5, 3.0), [1.18, 0.3, 0]));

  // Individual cambered deck planks (9 × 2.5u-wide cedar, arch peak 0.85)
  const plankCount = 9;
  for (let i = 0; i < plankCount; i++) {
    const t = i / (plankCount - 1) - 0.5; // -0.5..0.5
    const pz = t * 3.5;
    const archY = 0.24 + (1 - 4 * t * t) * 0.71;
    const geo = new THREE.BoxGeometry(2.5, 0.12, 0.4);
    const bakedPlank = bBake(geo, [0, archY, pz]);
    (i % 2 === 0 ? plankDeckGeos : plankWarmGeos).push(bakedPlank);
  }

  // Side stringer beams, posts, mid rails (cedar dark) + top rails & caps (warm)
  for (const rx of [-1.12, 1.12]) {
    cedarDarkGeos.push(bBake(new THREE.BoxGeometry(0.15, 0.2, 3.9), [rx, 0.42, 0]));
    cedarWarmGeos.push(bBake(new THREE.BoxGeometry(0.11, 0.09, 3.6), [rx, 1.4, 0]));
    cedarDarkGeos.push(bBake(new THREE.BoxGeometry(0.08, 0.06, 3.55), [rx, 1.06, 0]));
    for (const rz of [-1.5, 0, 1.5]) {
      cedarDarkGeos.push(bBake(new THREE.BoxGeometry(0.15, 1.0, 0.15), [rx, 1.16, rz]));
      cedarWarmGeos.push(bBake(new THREE.BoxGeometry(0.2, 0.07, 0.2), [rx, 1.7, rz]));
      brassGeos.push(bBake(new THREE.SphereGeometry(0.05, 7, 7), [rx, 1.77, rz]));
    }
  }

  const stoneMerged = new THREE.Mesh(mergeGeometries(stoneGeos)!, stoneMat);
  stoneMerged.name = 'bridge_stone_merged';
  stoneMerged.castShadow = true;
  stoneMerged.receiveShadow = true;
  bridgeGroup.add(stoneMerged);
  const plankDeckMerged = new THREE.Mesh(mergeGeometries(plankDeckGeos)!, deckMat);
  plankDeckMerged.name = 'bridge_planks_deck';
  plankDeckMerged.castShadow = true;
  plankDeckMerged.receiveShadow = true;
  bridgeGroup.add(plankDeckMerged);
  const plankWarmMerged = new THREE.Mesh(mergeGeometries(plankWarmGeos)!, cedarWarmMat);
  plankWarmMerged.name = 'bridge_planks_warm';
  plankWarmMerged.castShadow = true;
  plankWarmMerged.receiveShadow = true;
  bridgeGroup.add(plankWarmMerged);
  const cedarDarkMerged = new THREE.Mesh(mergeGeometries(cedarDarkGeos)!, cedarDarkMat);
  cedarDarkMerged.name = 'bridge_frame_dark';
  cedarDarkMerged.castShadow = true;
  bridgeGroup.add(cedarDarkMerged);
  const cedarWarmMerged = new THREE.Mesh(mergeGeometries(cedarWarmGeos)!, cedarWarmMat);
  cedarWarmMerged.name = 'bridge_rails_warm';
  cedarWarmMerged.castShadow = true;
  bridgeGroup.add(cedarWarmMerged);
  const brassMergedBridge = new THREE.Mesh(mergeGeometries(brassGeos)!, brassMat);
  brassMergedBridge.name = 'bridge_brass_caps';
  bridgeGroup.add(brassMergedBridge);

  // Hanging iron-and-brass lantern on the south-east rail post
  ironBridgeGeos.push(bBake(new THREE.CylinderGeometry(0.045, 0.055, 0.52, 6), [1.12, 1.92, 1.5]));
  ironBridgeGeos.push(bBake(new THREE.BoxGeometry(0.24, 0.045, 0.045), [1.24, 2.14, 1.5]));
  ironBridgeGeos.push(bBake(new THREE.ConeGeometry(0.11, 0.08, 6), [1.32, 2.1, 1.5]));
  const ironMergedBridge = new THREE.Mesh(mergeGeometries(ironBridgeGeos)!, ironMat);
  ironMergedBridge.name = 'bridge_lantern_iron';
  bridgeGroup.add(ironMergedBridge);
  const bridgeLanternBulb = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.06, 0.15, 6),
    pierLanternGlassMat,
  );
  bridgeLanternBulb.position.set(1.32, 2.0, 1.5);
  bridgeGroup.add(bridgeLanternBulb);

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
