import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';
import {
  addContactShadow,
} from './vegetation';
import { addStaticContactShadow } from '../contactShadows';

export interface BuildingBuildContext {
  palette: MaterialPalette;
  shadowTex: THREE.Texture;
  terracottaRoofTex: THREE.Texture;
  sageRoofTex: THREE.Texture;
  slateRoofTex: THREE.Texture;
  windowMaterials: THREE.MeshStandardMaterial[];
  lanternMaterials: THREE.MeshStandardMaterial[];
  flowerGroups: THREE.Group[];
}

// Module-level transformed-geometry factories shared by the building builders
// (audit §10.4 draw-call discipline: merged bar grids and multi-part props build
// their parts as baked primitives, then merge per material).
const boxAt = (
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rotX = 0,
  rotY = 0,
  rotZ = 0,
): THREE.BufferGeometry => {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotX) g.rotateX(rotX);
  if (rotY) g.rotateY(rotY);
  if (rotZ) g.rotateZ(rotZ);
  g.translate(x, y, z);
  return g;
};
const cylAt = (
  rt: number,
  rb: number,
  h: number,
  x: number,
  y: number,
  z: number,
  rotX = 0,
  rotZ = 0,
  segments = 8,
): THREE.BufferGeometry => {
  const g = new THREE.CylinderGeometry(rt, rb, h, segments);
  if (rotX) g.rotateX(rotX);
  if (rotZ) g.rotateZ(rotZ);
  g.translate(x, y, z);
  return g;
};

interface StorybookCottageBaseOpts {
  width: number;
  depth: number;
  wallHeight: number;
  wallColor: string;
  trimColor: string;
  doorSide: 'north' | 'south' | 'east' | 'west';
  roofTex: THREE.Texture;
  roofCacheKey: string;
  roofHeight?: number;
  awning?: {
    colorA: string;
    colorB: string;
    postHeight?: number;
  };
  chimneyOffset?: [number, number];
  /**
   * Building-architecture audit Phase B — shared-core craft back-port (Willow Step
   * patterns promoted into the template). Every toggle defaults OFF so existing
   * buildings (incl. Copperwheel, owned by another agent) keep their current look
   * until their own pass enables them.
   */
  craft?: {
    /** Horizontal timber sill beam at the wall base (Willow pattern). */
    sillBand?: boolean;
    /** Stepped stone corner quoin blocks (Willow pattern). */
    quoins?: boolean;
    /** Plaster gable-triangle infill under the roof + cream bargeboards on both slopes. */
    bargeboards?: boolean;
    /** Small louvred loft-vent window in each gable triangle (attic truth-telling). */
    loftVents?: boolean;
    /** Three-part tapered fieldstone chimney stack (Willow pattern). */
    taperedChimney?: boolean;
    /**
     * BUILD 02 (Doc 05 §2.2 second-roof-element rule): a small ridge dormer on
     * the north roof slope — the only slope the core never gives windows, so
     * the massing break never collides with glazing. Willow-dormer pattern,
     * scaled down; breaks the shared "gable prism" read.
     */
    dormer?: boolean;
  };
}

function addRecessedWindowWithPlanter(
  group: THREE.Group,
  ctx: BuildingBuildContext,
  trimMat: THREE.MeshStandardMaterial,
  shutterMat: THREE.MeshStandardMaterial,
  potMat: THREE.MeshStandardMaterial,
  winMat: THREE.MeshStandardMaterial,
  x: number,
  y: number,
  z: number,
  rotY: number,
  hasPlanter = true,
): void {
  const wg = new THREE.Group();
  wg.position.set(x, y, z);
  wg.rotation.y = rotY;

  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.12, 0.14), trimMat);
  const pane = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.86, 0.16), winMat);
  const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.86, 0.18), trimMat);
  const mullionH = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.06, 0.18), trimMat);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.14, 0.34), trimMat);
  sill.position.set(0, -0.57, 0.12);
  wg.add(frame, pane, mullionV, mullionH, sill);

  for (const sx of [-0.72, 0.72]) {
    const shutter = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.04, 0.08), shutterMat);
    shutter.position.set(sx, 0, 0.04);
    shutter.castShadow = true;
    wg.add(shutter);
  }

  if (hasPlanter) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.24, 0.34), potMat);
    box.position.set(0, -0.72, 0.18);
    wg.add(box);

    // BUILD 02 (Doc 05 §2.2): the "5 identical dodecahedra" template fingerprint
    // becomes the Willow 3-bud tuft language (willowLaneDiorama makeFlowerTuft
    // pattern): squashed leaf lobe + 3 ringed, height-staggered buds per tuft,
    // tint-rotated per bud. MERGED per material (1 leaf mesh + one mesh per
    // petal color) so the upgrade removes template sameness while REDUCING the
    // per-window mesh count 10 → 5.
    const blooms = new THREE.Group();
    blooms.position.set(0, -0.54, 0.2);
    const leafMat = ctx.palette.standard(STORYBOOK_PALETTE.foliageMid, 0.85, 0.0);
    const flowerColors = [
      STORYBOOK_PALETTE.petalRose,
      STORYBOOK_PALETTE.petalMarigold,
      STORYBOOK_PALETTE.petalLavender,
      STORYBOOK_PALETTE.petalCream,
    ];
    const leafGeos: THREE.BufferGeometry[] = [];
    const petalGeos = new Map<string, THREE.BufferGeometry[]>();
    for (let i = -2; i <= 2; i++) {
      const leaf = new THREE.DodecahedronGeometry(0.115, 0);
      leaf.scale(1.2, 0.8, 1.0);
      leaf.translate(i * 0.21, 0, 0);
      leafGeos.push(leaf);
      for (let b = 0; b < 3; b++) {
        const a = (b / 3) * Math.PI * 2 + i * 1.3; // deterministic per-tuft rotation
        const bud = new THREE.DodecahedronGeometry(0.055, 0);
        bud.translate(
          i * 0.21 + Math.cos(a) * 0.062,
          0.1 + (b % 2) * 0.032,
          0.03 + Math.sin(a) * 0.05,
        );
        const colorHex = flowerColors[(i + b + 2) % flowerColors.length];
        const arr = petalGeos.get(colorHex);
        if (arr) arr.push(bud);
        else petalGeos.set(colorHex, [bud]);
      }
    }
    const leaves = new THREE.Mesh(mergeGeometries(leafGeos)!, leafMat);
    leaves.castShadow = true;
    blooms.add(leaves);
    for (const [colorHex, geos] of petalGeos) {
      const petals = new THREE.Mesh(
        mergeGeometries(geos)!,
        ctx.palette.standard(colorHex, 0.6, 0.02),
      );
      blooms.add(petals);
    }
    for (const g of leafGeos) if (g.dispose) g.dispose();
    ctx.flowerGroups.push(blooms);
    wg.add(blooms);
  }

  group.add(wg);
}

function buildStorybookCottageCore(
  opts: StorybookCottageBaseOpts,
  ctx: BuildingBuildContext,
): { group: THREE.Group; doorGroup: THREE.Group; lanternMat: THREE.MeshStandardMaterial } {
  const { palette, shadowTex, windowMaterials, lanternMaterials } = ctx;
  const group = new THREE.Group();
  const { width, depth, wallHeight } = opts;
  const halfW = width / 2;
  const halfD = depth / 2;
  const roofH = opts.roofHeight ?? 2.1;

  addStaticContactShadow(group, shadowTex, width + 2.4, depth + 2.4, 0.46, 0.018);

  // Evident-craft material families (Doc 06 §2.1): plaster walls carry tooth,
  // timber carries grain, stone carries course mortar — each tier distinct at
  // gameplay distance; metals answer the environment map per family.
  const stoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.9, 0.02, {
    mapSet: 'stone',
    envMapIntensity: 0.35,
    groundGradient: 0.6,
  });
  const darkStoneMat = palette.standard(STORYBOOK_PALETTE.fieldstoneDark, 0.92, 0.02, {
    mapSet: 'stone',
    envMapIntensity: 0.35,
    groundGradient: 0.6,
  });
  const wallMat = palette.standard(opts.wallColor, 0.85, 0.01, {
    mapSet: 'plaster',
    groundGradient: 2.7,
  });
  const trimMat = palette.standard(opts.trimColor, 0.74, 0.04, {
    mapSet: 'timber-dark',
    groundGradient: 2.7,
  });
  const creamTrimMat = palette.standard(STORYBOOK_PALETTE.creamTrim, 0.78, 0.02, {
    mapSet: 'timber-light',
  });
  const shutterMat = palette.standard(STORYBOOK_PALETTE.sageShutter, 0.74, 0.03, {
    mapSet: 'timber-dark',
  });
  const potMat = palette.standard(STORYBOOK_PALETTE.terracottaPot, 0.44, 0.04, {
    envMapIntensity: 0.6,
  });
  const doorMat = palette.standard(STORYBOOK_PALETTE.doorCedar, 0.7, 0.05, {
    mapSet: 'timber-dark',
    groundGradient: 1.6,
  });
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.24, 0.86, {
    envMapIntensity: 1.0,
  });
  const ironMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.42, 0.72, {
    envMapIntensity: 0.5,
  });

  const roofMat = palette.get(opts.roofCacheKey, {
    color: '#FFFFFF',
    roughness: 0.76,
    metalness: 0.03,
  });
  if (!roofMat.map) {
    roofMat.map = opts.roofTex;
    roofMat.needsUpdate = true;
  }

  const winMat = new THREE.MeshStandardMaterial({
    color: '#E6BE7C',
    emissive: new THREE.Color('#FF9F38'),
    emissiveIntensity: 0.24,
    roughness: 0.16,
    metalness: 0.08,
    envMapIntensity: 0.9, // glass family (Doc 06 §2.2)
  });
  windowMaterials.push(winMat);

  const lanternMat = new THREE.MeshStandardMaterial({
    color: '#FFE9AF',
    emissive: new THREE.Color('#FFAB3B'),
    emissiveIntensity: 0.25,
    roughness: 0.18,
    metalness: 0.05,
    envMapIntensity: 0.9, // lantern-glass family
  });
  lanternMaterials.push(lanternMat);

  // 1. Layered Stone Foundation Plinth + Stone Curb Trim
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.48, 0.46, depth + 0.48),
    stoneMat,
  );
  plinth.position.y = 0.23;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  const plinthCap = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.56, 0.1, depth + 0.56),
    darkStoneMat,
  );
  plinthCap.position.y = 0.48;
  group.add(plinth, plinthCap);

  // 2. Main Lime Plaster Walls + optional timber sill band & corner quoins (Phase B)
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, depth), wallMat);
  body.position.y = 0.5 + wallHeight / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  if (opts.craft?.sillBand) {
    const sillBand = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.14, 0.14, depth + 0.14),
      trimMat,
    );
    sillBand.position.y = 0.57;
    group.add(sillBand);
  }
  if (opts.craft?.quoins) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const quoinA = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.34), stoneMat);
        quoinA.position.set(sx * halfW, 0.72, sz * halfD);
        const quoinB = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.3), darkStoneMat);
        quoinB.position.set(sx * halfW, 1.08, sz * halfD);
        group.add(quoinA, quoinB);
      }
    }
  }

  // 3. Corner Timber Posts + Top Eave Beams
  const postGeo = new THREE.BoxGeometry(0.26, wallHeight + 0.12, 0.26);
  for (const [cx, cz] of [
    [-halfW, -halfD],
    [halfW, -halfD],
    [-halfW, halfD],
    [halfW, halfD],
  ]) {
    const post = new THREE.Mesh(postGeo, trimMat);
    post.position.set(cx, 0.5 + wallHeight / 2, cz);
    post.castShadow = true;
    group.add(post);
  }

  // 4. Beveled Shingle Gable Roof + Ridge Cap + Cream Bargeboards
  const overhang = 0.46;
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-(halfW + overhang), 0);
  roofShape.lineTo(halfW + overhang, 0);
  roofShape.lineTo(0, roofH);
  roofShape.closePath();

  const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
    depth: depth + overhang * 2,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.1,
    bevelSegments: 2,
  });
  roofGeo.translate(0, 0, -(depth + overhang * 2) / 2);
  const roofMesh = new THREE.Mesh(roofGeo, roofMat);
  roofMesh.position.y = 0.48 + wallHeight;
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  group.add(roofMesh);

  const ridge = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.22, depth + overhang * 2 + 0.2),
    trimMat,
  );
  ridge.position.y = 0.52 + wallHeight + roofH + 0.06;
  group.add(ridge);

  // Phase B: plaster gable infill + cream bargeboards + louvred loft vents.
  // The infill closes the open gable triangles (Willow pattern), the bargeboards
  // articulate the rakes, and the vents make the attic read as vented storage —
  // exterior truth-telling for the 1.6-2.1 m of gable volume the interiors do
  // not render as rooms (audit §7.3).
  if (opts.craft?.bargeboards || opts.craft?.loftVents) {
    const roofBaseY = 0.48 + wallHeight;
    // The infill closes the open gable triangles — required backing for the vents
    const infillShape = new THREE.Shape();
    infillShape.moveTo(-halfW, 0);
    infillShape.lineTo(halfW, 0);
    infillShape.lineTo(0, roofH - 0.14);
    infillShape.closePath();
    const infillGeo = new THREE.ExtrudeGeometry(infillShape, {
      depth: depth - 0.02,
      bevelEnabled: false,
    });
    infillGeo.translate(0, 0, -(depth - 0.02) / 2);
    const gableInfill = new THREE.Mesh(infillGeo, wallMat);
    gableInfill.position.y = roofBaseY + 0.02;
    group.add(gableInfill);

    if (opts.craft?.bargeboards) {
      const slopeLen = Math.hypot(halfW + overhang, roofH) + 0.16;
      const slopeAngle = Math.atan2(roofH, halfW + overhang);
      for (const sz of [-1, 1]) {
        for (const sx of [-1, 1]) {
          const barge = new THREE.Mesh(
            new THREE.BoxGeometry(slopeLen, 0.16, 0.12),
            creamTrimMat,
          );
          barge.position.set(
            sx * (halfW + overhang) * 0.5,
            roofBaseY + roofH * 0.5 + 0.08,
            sz * (halfD + overhang + 0.06),
          );
          barge.rotation.z = -sx * slopeAngle;
          barge.castShadow = true;
          group.add(barge);
        }
      }
    }
    if (opts.craft?.loftVents) {
      const ventY = 0.48 + wallHeight + roofH * 0.34;
      for (const sz of [-1, 1]) {
        const ventFrame = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.66, 0.1),
          creamTrimMat,
        );
        ventFrame.position.set(0, ventY, sz * (halfD + 0.01));
        const ventDark = new THREE.Mesh(
          new THREE.BoxGeometry(0.44, 0.5, 0.12),
          darkStoneMat,
        );
        ventDark.position.set(0, ventY, sz * (halfD + 0.02));
        group.add(ventFrame, ventDark);
        for (let s = -1; s <= 1; s++) {
          const slat = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.045, 0.13), trimMat);
          slat.position.set(0, ventY + s * 0.13, sz * (halfD + 0.03));
          slat.rotation.x = s * 0.5;
          group.add(slat);
        }
      }
    }
  }

  // BUILD 02 (Doc 05 §2.2): ridge dormer on the north slope — the second-roof-
  // element massing break. Willow-dormer recipe scaled down: beveled mini gable
  // roof + cedar-framed vent face, deterministic x offset so it never reads as
  // stamp-centered. The north slope never carries core windows, so the dormer
  // can never collide with glazing.
  if (opts.craft?.dormer) {
    const roofBaseY = 0.48 + wallHeight;
    const dormerW = 1.04;
    const dormerH = 0.72;
    const dormerD = 0.86;
    const dormerX = width * 0.14;
    const slopeRise = (roofH / (halfW + overhang)) * (halfD * 0.36);
    const dormerBaseY = roofBaseY + slopeRise * 0.62;
    const dormerZ = -(halfD + dormerD * 0.22);
    const dormerBody = new THREE.Mesh(
      new THREE.BoxGeometry(dormerW, dormerH, dormerD),
      wallMat,
    );
    dormerBody.position.set(dormerX, dormerBaseY + dormerH / 2 - 0.12, dormerZ);
    dormerBody.castShadow = true;
    group.add(dormerBody);
    // Mini beveled gable roof over the dormer
    const dRoofShape = new THREE.Shape();
    dRoofShape.moveTo(-dormerW / 2 - 0.14, 0);
    dRoofShape.lineTo(dormerW / 2 + 0.14, 0);
    dRoofShape.lineTo(0, 0.42);
    dRoofShape.closePath();
    const dRoofGeo = new THREE.ExtrudeGeometry(dRoofShape, {
      depth: dormerD + 0.22,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 1,
    });
    dRoofGeo.translate(0, 0, -(dormerD + 0.22) / 2);
    const dRoof = new THREE.Mesh(dRoofGeo, roofMat);
    dRoof.position.set(dormerX, dormerBaseY + dormerH - 0.12, dormerZ);
    dRoof.castShadow = true;
    group.add(dRoof);
    // Louvred dormer face (attic truth-telling, matching the loft vents)
    const dFrame = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.4, 0.08), creamTrimMat);
    dFrame.position.set(dormerX, dormerBaseY + dormerH * 0.42, dormerZ - dormerD / 2 - 0.02);
    const dDark = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.09), darkStoneMat);
    dDark.position.set(dormerX, dormerBaseY + dormerH * 0.42, dormerZ - dormerD / 2 - 0.03);
    group.add(dFrame, dDark);
  }

  // 5. Chimney Stack + Terracotta Pot (default box stack, or the Phase B
  //    three-part tapered fieldstone stack)
  const [chX, chZ] = opts.chimneyOffset ?? [-halfW * 0.52, -halfD * 0.36];
  if (opts.craft?.taperedChimney) {
    const stackBase = 0.5 + wallHeight;
    const stackA = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.05, 0.72), darkStoneMat);
    stackA.position.set(chX, stackBase + 0.45, chZ);
    stackA.castShadow = true;
    const stackB = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.6), darkStoneMat);
    stackB.position.set(chX, stackBase + 1.35, chZ);
    stackB.castShadow = true;
    const stackC = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.5), stoneMat);
    stackC.position.set(chX, stackBase + 2.0, chZ);
    stackC.castShadow = true;
    const stackRim = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.12, 0.62), stoneMat);
    stackRim.position.set(chX, stackBase + 2.36, chZ);
    const stackPot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.3, 8), potMat);
    stackPot.position.set(chX, stackBase + 2.56, chZ);
    group.add(stackA, stackB, stackC, stackRim, stackPot);
  } else {
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.82, 2.0, 0.82), darkStoneMat);
    chimney.position.set(chX, 0.5 + wallHeight + 0.95, chZ);
    chimney.castShadow = true;
    const chimneyRim = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.14, 0.96), stoneMat);
    chimneyRim.position.set(chX, 0.5 + wallHeight + 1.98, chZ);
    const chimneyPot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.34, 8), potMat);
    chimneyPot.position.set(chX, 0.5 + wallHeight + 2.2, chZ);
    group.add(chimney, chimneyRim, chimneyPot);
  }

  // 6. Recessed Porch Door + Steps + Hanging Lantern + Optional Supported Awning
  const doorGroup = new THREE.Group();
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.42, 2.12, 0.18), trimMat);
  doorFrame.position.y = 1.06;
  const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(1.08, 1.92, 0.22), doorMat);
  doorLeaf.position.y = 0.98;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), brassMat);
  knob.position.set(0.32, 0.96, 0.14);
  const doorWindow = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.24), winMat);
  doorWindow.position.set(0, 1.38, 0.02);
  doorGroup.add(doorFrame, doorLeaf, knob, doorWindow);

  // Stone Porch Stoop & Lower Step
  const stoop = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.28, 0.95), stoneMat);
  stoop.position.set(0, 0.14, 0.48);
  stoop.receiveShadow = true;
  const lowerStep = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.14, 0.44), darkStoneMat);
  lowerStep.position.set(0, 0.07, 1.08);
  lowerStep.receiveShadow = true;
  doorGroup.add(stoop, lowerStep);

  // Hanging brass/iron lantern beside door frame
  const lanternBracket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.36), ironMat);
  lanternBracket.position.set(0.82, 2.02, 0.2);
  const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.12, 6), ironMat);
  lanternCap.position.set(0.82, 1.88, 0.34);
  const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.22, 6), lanternMat);
  lanternGlass.position.set(0.82, 1.72, 0.34);
  doorGroup.add(lanternBracket, lanternCap, lanternGlass);

  // Supported striped fabric awning (with chamfered cedar posts reaching ground plinth!)
  if (opts.awning) {
    const awningW = Math.min(width * 0.74, 4.4);
    const stripeCount = 5;
    const sw = awningW / stripeCount;
    const matA = palette.standard(opts.awning.colorA, 0.78, 0.02);
    const matB = palette.standard(opts.awning.colorB, 0.8, 0.02);

    const awningPivot = new THREE.Group();
    awningPivot.position.set(0, 2.38, 0.62);
    awningPivot.rotation.x = 0.28;
    for (let i = 0; i < stripeCount; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.11, 1.26), i % 2 === 0 ? matA : matB);
      stripe.position.x = -awningW / 2 + sw * (i + 0.5);
      stripe.castShadow = true;
      awningPivot.add(stripe);
    }
    const frontValance = new THREE.Mesh(new THREE.BoxGeometry(awningW, 0.18, 0.06), matA);
    frontValance.position.set(0, -0.06, 0.62);
    awningPivot.add(frontValance);
    doorGroup.add(awningPivot);

    // Timber posts supporting front corners of awning (reaching down cleanly to y = -0.35 -> y = 0!)
    const postH = opts.awning.postHeight ?? 2.52;
    for (const px of [-awningW / 2 + 0.14, awningW / 2 - 0.14]) {
      const support = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, postH, 8), trimMat);
      support.position.set(px, postH / 2 - 0.32, 1.14);
      support.castShadow = true;
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.22), darkStoneMat);
      shoe.position.set(px, -0.24, 1.14);
      doorGroup.add(support, shoe);
    }
  }

  // Orient door side cleanly
  if (opts.doorSide === 'south') {
    doorGroup.position.set(0, 0.34, halfD + 0.04);
  } else if (opts.doorSide === 'north') {
    doorGroup.position.set(0, 0.34, -(halfD + 0.04));
    doorGroup.rotation.y = Math.PI;
  } else if (opts.doorSide === 'east') {
    doorGroup.position.set(halfW + 0.04, 0.34, 0);
    doorGroup.rotation.y = Math.PI / 2;
  } else {
    doorGroup.position.set(-(halfW + 0.04), 0.34, 0);
    doorGroup.rotation.y = -Math.PI / 2;
  }
  group.add(doorGroup);

  // Shuttered windows on non-door sides
  if (opts.doorSide !== 'south') {
    addRecessedWindowWithPlanter(group, ctx, creamTrimMat, shutterMat, potMat, winMat, 0, 1.95, halfD + 0.05, 0, true);
  }
  if (opts.doorSide !== 'east') {
    addRecessedWindowWithPlanter(group, ctx, creamTrimMat, shutterMat, potMat, winMat, halfW + 0.05, 1.95, 0, Math.PI / 2, true);
  }
  if (opts.doorSide !== 'west') {
    addRecessedWindowWithPlanter(group, ctx, creamTrimMat, shutterMat, potMat, winMat, -(halfW + 0.05), 1.95, 0, -Math.PI / 2, true);
  }

  return { group, doorGroup, lanternMat };
}

/**
 * 1. Hearth & Crumb Bakery at (-12.4, 0, -10.8) (BOX_OBSTACLES minX:-16.4, maxX:-8.4, minZ:-14.2, maxZ:-7.4).
 * Striped awning on timber posts, stone hearth oven bump-out, display shelf with sourdough loaves, & menu sign.
 */
export function buildStorybookBakery(ctx: BuildingBuildContext): THREE.Group {
  const { palette, shadowTex } = ctx;
  const { group } = buildStorybookCottageCore(
    {
      width: 6.4,
      depth: 5.2,
      wallHeight: 2.75,
      wallColor: '#F5DFC2',
      trimColor: STORYBOOK_PALETTE.cedarDark,
      doorSide: 'south',
      roofTex: ctx.terracottaRoofTex,
      roofCacheKey: 'bakery_terracotta_roof',
      awning: { colorA: '#CD6649', colorB: '#FAF2E3' },
      chimneyOffset: [-2.1, -0.9],
      // Phase B core back-port: the bakery is the neighborhood's food hearth —
      // full Willow-pattern craft set + a tapered chimney worth photographing
      craft: { sillBand: true, quoins: true, bargeboards: true, loftVents: true, taperedChimney: true },
    },
    ctx,
  );
  group.position.set(-12.4, 0, -10.8);

  const brickMat = palette.standard('#A85842', 0.86, 0.02);
  const stoneMat = palette.standard(STORYBOOK_PALETTE.fieldstoneDark, 0.9, 0.02);
  const loafMat = palette.standard('#D7944A', 0.82, 0.0);
  const cedarMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.74, 0.04);

  // Exterior stone & brick bake-oven dome on west gable side
  const ovenBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.35, 1.85), stoneMat);
  ovenBase.position.set(-3.45, 0.68, -0.9);
  ovenBase.castShadow = true;
  const ovenDome = new THREE.Mesh(new THREE.SphereGeometry(0.75, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), brickMat);
  ovenDome.position.set(-3.45, 1.32, -0.9);
  ovenDome.castShadow = true;
  const ovenPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.9, 8), brickMat);
  ovenPipe.position.set(-3.45, 2.75, -0.9);
  ovenPipe.castShadow = true;
  group.add(ovenBase, ovenDome, ovenPipe);

  // Phase C — bakehouse bump-out wing (audit §5.4): the oven stub grows into the
  // neighborhood's only L-shaped massing. The wing extends the oven base southward
  // along the west wall with its own small terracotta gable; a service door reads on
  // the wing's south face. Stays inside 'bakery' (world x >= -16.4: wing reaches
  // local x -3.85 = world -16.25) — no obstacle or interaction change.
  const wingWallMat = palette.standard('#EFDCC0', 0.85, 0.01);
  const wingRoofMat = palette.get('bakery_wing_roof', { color: '#FFFFFF', roughness: 0.76, metalness: 0.03 });
  if (!wingRoofMat.map) {
    wingRoofMat.map = ctx.terracottaRoofTex;
    wingRoofMat.needsUpdate = true;
  }
  const wingWalls: THREE.BufferGeometry[] = [
    boxAt(0.9, 2.0, 1.9, 0, 1.24, 0), // main wing mass hugging the west wall
  ];
  const wingMesh = new THREE.Mesh(mergeGeometries(wingWalls, false)!, wingWallMat);
  wingMesh.castShadow = true;
  wingMesh.receiveShadow = true;
  const wing = new THREE.Group();
  wing.position.set(-3.4, 0, 1.0);
  wing.add(wingMesh);
  // Wing roof: mini gable, ridge along Z (matching the main roof's ridge direction)
  const wingRoofShape = new THREE.Shape();
  wingRoofShape.moveTo(-0.58, 0);
  wingRoofShape.lineTo(0.58, 0);
  wingRoofShape.lineTo(0, 0.72);
  wingRoofShape.closePath();
  // BUILD 02 bevel sweep (Doc 05 §2.2 P3): the bakehouse wing roof gains its
  // softened edge — visible trim/roof extrusions carry the bevel program.
  const wingRoofGeo = new THREE.ExtrudeGeometry(wingRoofShape, {
    depth: 2.1,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 1,
  });
  wingRoofGeo.translate(0, 0, -1.05);
  const wingRoof = new THREE.Mesh(wingRoofGeo, wingRoofMat);
  wingRoof.position.y = 2.24;
  wingRoof.castShadow = true;
  wingRoof.receiveShadow = true;
  wing.add(wingRoof);
  const wingRidge = new THREE.Mesh(boxAt(0.16, 0.14, 2.1, 0, 2.98, 0, 0, 0, 0), cedarMat);
  wing.add(wingRidge);
  // Service door on the wing's south face + a small vent slit
  const wingDoor = new THREE.Mesh(boxAt(0.52, 1.42, 0.08, 0, 0.73, 0.97, 0, 0, 0), palette.standard(STORYBOOK_PALETTE.doorCedar, 0.68, 0.05));
  wingDoor.castShadow = true;
  const wingVent = new THREE.Mesh(boxAt(0.3, 0.18, 0.1, 0, 1.7, 0.97, 0, 0, 0), stoneMat);
  wing.add(wingDoor, wingVent);
  // Timber lintel band tying the wing back into the main west wall
  wing.add(new THREE.Mesh(boxAt(0.98, 0.12, 1.86, 0, 2.1, 0, 0, 0, 0), cedarMat));
  group.add(wing);
  addStaticContactShadow(wing, shadowTex, 1.6, 2.4, 0.42, 0.018);
  // Flour sacks + delivery crate parked between the oven base and the wing door
  const bakeYard = new THREE.Group();
  bakeYard.position.set(-3.35, 0, -2.45);
  addStaticContactShadow(bakeYard, shadowTex, 1.5, 1.0, 0.4, 0.018);
  const flourSackMat = palette.standard('#F3EBDC', 0.92, 0.0);
  const sackA = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6), flourSackMat);
  sackA.position.set(-0.25, 0.2, 0.05);
  sackA.scale.set(0.85, 1.05, 0.8);
  sackA.castShadow = true;
  const sackB = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), flourSackMat);
  sackB.position.set(0.12, 0.18, 0.28);
  sackB.scale.set(0.8, 0.95, 0.8);
  sackB.rotation.y = 0.5;
  sackB.castShadow = true;
  bakeYard.add(sackA, sackB);
  const deliveryCrate = new THREE.Mesh(boxAt(0.56, 0.4, 0.44, 0.42, 0.2, -0.18, 0, -0.24, 0), cedarMat);
  deliveryCrate.castShadow = true;
  bakeYard.add(deliveryCrate);
  const crateSlats = new THREE.Mesh(
    mergeGeometries([boxAt(0.58, 0.05, 0.46, 0.42, 0.3, -0.18, 0, -0.24, 0), boxAt(0.58, 0.05, 0.46, 0.42, 0.12, -0.18, 0, -0.24, 0)], false)!,
    palette.standard(STORYBOOK_PALETTE.cedarDark, 0.78, 0.04),
  );
  bakeYard.add(crateSlats);
  group.add(bakeYard);

  // Window display ledge with carved corbel supports (replaces the old floating shelf)
  const displayShelf = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.14, 0.42), cedarMat);
  displayShelf.position.set(-2.05, 1.38, 2.76);
  group.add(displayShelf);
  const corbels: THREE.BufferGeometry[] = [];
  for (const cx of [-2.55, -1.55]) {
    corbels.push(boxAt(0.12, 0.3, 0.34, cx, 1.16, 2.72, 0, 0, 0.35));
    corbels.push(boxAt(0.16, 0.1, 0.38, cx, 1.0, 2.74, 0, 0, 0));
  }
  group.add(new THREE.Mesh(mergeGeometries(corbels, false)!, palette.standard(STORYBOOK_PALETTE.cedarDark, 0.76, 0.04)));
  for (let i = 0; i < 3; i++) {
    const loaf = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.18, 4, 6), loafMat);
    loaf.rotation.z = Math.PI / 2;
    loaf.position.set(-2.42 + i * 0.36, 1.54, 2.8);
    group.add(loaf);
  }
  // Second bread tier + a small chalk price card on the ledge front
  for (let i = 0; i < 2; i++) {
    const roll = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 6), loafMat);
    roll.position.set(-2.3 + i * 0.42, 1.72, 2.76);
    roll.scale.set(1.1, 0.8, 0.9);
    group.add(roll);
  }
  const priceCard = new THREE.Mesh(boxAt(0.18, 0.12, 0.02, -1.62, 1.3, 2.98), palette.standard('#F7F1E3', 0.9, 0.0));
  priceCard.rotation.x = -0.15;
  group.add(priceCard);

  // Hanging bakery sign — bread board on an iron bracket, east of the awning span
  const shopSign = new THREE.Group();
  shopSign.position.set(2.6, 0, 0);
  shopSign.add(
    new THREE.Mesh(boxAt(0.05, 0.05, 0.42, 0, 2.98, 2.78, 0, 0, 0), palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.42, 0.72)),
    new THREE.Mesh(boxAt(0.05, 0.4, 0.05, 0, 2.8, 2.94, 0, 0, 0), palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.42, 0.72)),
  );
  const signBoard = new THREE.Mesh(boxAt(0.56, 0.38, 0.06, 0, 2.5, 2.94, 0, 0, 0), cedarMat);
  signBoard.castShadow = true;
  shopSign.add(signBoard);
  for (let i = 0; i < 3; i++) {
    const signLoaf = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.12, 4, 6), loafMat);
    signLoaf.rotation.z = Math.PI / 2;
    signLoaf.position.set(-0.15 + i * 0.15, 2.52, 2.97);
    shopSign.add(signLoaf);
  }
  group.add(shopSign);

  // Chalkboard menu A-frame next to porch steps
  const chalkGroup = new THREE.Group();
  chalkGroup.position.set(2.05, 0, 3.15);
  chalkGroup.rotation.y = -0.25;
  const boardA = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.08), cedarMat);
  boardA.position.set(0, 0.46, 0.1);
  boardA.rotation.x = -0.22;
  const slate = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.62, 0.09), palette.standard('#35393B', 0.86, 0.02));
  slate.position.set(0, 0.5, 0.12);
  slate.rotation.x = -0.22;
  const boardB = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.08), cedarMat);
  boardB.position.set(0, 0.46, -0.1);
  boardB.rotation.x = 0.22;
  chalkGroup.add(boardA, slate, boardB);
  group.add(chalkGroup);

  return group;
}

/**
 * Upgraded Reactive Outdoor Bakery Café Tables at (-8.0, 0, -6.4).
 */
export function buildBakeryCafeTables(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
): THREE.Group {
  const tablesGroup = new THREE.Group();
  tablesGroup.position.set(-8.0, 0, -6.4);

  const ironMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.42, 0.72);
  const clothMat = palette.standard('#FAF2E4', 0.82, 0.0);
  const runnerMat = palette.standard('#C9664A', 0.82, 0.0);
  const ceramicMat = palette.standard(STORYBOOK_PALETTE.ceramicCream, 0.36, 0.05);
  const loafMat = palette.standard('#D8964B', 0.8, 0.0);

  for (let i = 0; i < 2; i++) {
    const tbl = new THREE.Group();
    tbl.position.set(i * 2.1, 0, 0.4);
    // Café tables toggle with `bakeryTablesOpen` — disc must hide with the
    // group, so it stays a per-mesh quad (never batched).
    addContactShadow(tbl, shadowTex, 1.5, 1.5, 0.36, 0.018);

    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.08, 8), ironMat);
    foot.position.y = 0.04;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.68, 8), ironMat);
    stem.position.y = 0.38;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.07, 14), clothMat);
    top.position.y = 0.74;
    top.castShadow = true;
    const runner = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 1.24), runnerMat);
    runner.position.y = 0.745;

    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.04, 10), ceramicMat);
    plate.position.set(0, 0.79, 0);
    const loaf = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.18, 4, 6), loafMat);
    loaf.rotation.z = Math.PI / 2;
    loaf.position.set(0, 0.87, 0);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.11, 8), ceramicMat);
    mug.position.set(0.26, 0.83, 0.18);

    tbl.add(foot, stem, top, runner, plate, loaf, mug);
    tablesGroup.add(tbl);
  }
  tablesGroup.visible = false;
  return tablesGroup;
}

/**
 * 2. Linden Book Nook at (-15.8, 0, -1.0) (BOX_OBSTACLES minX:-19.2, maxX:-12.4, minZ:-4.2, maxZ:2.2).
 * Sage shingle roof, supported burgundy-cream shop awning, outdoor book cart, and bay reading shelf.
 */
export function buildStorybookBookNook(ctx: BuildingBuildContext): THREE.Group {
  const { palette, shadowTex } = ctx;
  const { group } = buildStorybookCottageCore(
    {
      width: 5.4,
      depth: 5.2,
      wallHeight: 2.58,
      wallColor: '#E8DEC9',
      trimColor: '#5D4438',
      doorSide: 'east',
      roofTex: ctx.sageRoofTex,
      roofCacheKey: 'booknook_sage_roof',
      awning: { colorA: '#7A5463', colorB: '#F2E7D3' },
      chimneyOffset: [-1.4, 1.2],
      // Phase B core back-port: sill band + quoins close the "recolor clone" gap;
      // box chimney kept for stack-shape variety on the lane
      craft: { sillBand: true, quoins: true, bargeboards: true, loftVents: true },
    },
    ctx,
  );
  group.position.set(-15.8, 0, -1.0);

  const cedarMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.78, 0.04);
  const cedarWarmMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.74, 0.04);
  const bookColors = ['#B5544A', '#4D7B64', '#5878A3', '#D69E4E', '#836391'];

  // Outdoor timber rolling book cart tucked along East veranda beside doorway
  const cart = new THREE.Group();
  cart.position.set(3.05, 0, -1.55);
  const cartBody = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 1.05), cedarWarmMat);
  cartBody.position.y = 0.56;
  cartBody.castShadow = true;
  const cartShelf = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.08, 1.12), cedarMat);
  cartShelf.position.y = 0.96;
  cart.add(cartBody, cartShelf);

  for (const wz of [-0.4, 0.4]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 10), cedarMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(0.28, 0.16, wz);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.1), cedarMat);
    leg.position.set(-0.22, 0.11, wz);
    cart.add(wheel, leg);
  }

  for (let i = 0; i < 6; i++) {
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.3, 0.1),
      palette.standard(bookColors[i % bookColors.length], 0.7, 0.03),
    );
    book.position.set(0.05, 1.15, -0.35 + i * 0.13);
    book.rotation.x = (i % 2 === 0 ? 1 : -1) * 0.08;
    cart.add(book);
  }
  group.add(cart);

  // Small stacked book crate on South-East corner of plinth
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.42, 0.55), cedarWarmMat);
  crate.position.set(2.95, 0.21, 1.55);
  crate.castShadow = true;
  group.add(crate);

  // Phase C — bookshop architecture (audit §5.3): the promised bay reading window,
  // a hanging blade sign, and north-lawn returns crates give the Nook its own
  // silhouette. All props stay inside book_nook (local |x|,|z| <= 3.2/3.4) — the bay
  // projection reaches local x 3.19 (world -12.61, 0.21 inside the box edge) — and
  // no obstacle, interactable, or door position changes.
  const glassMat = palette.standard('#D2ECEB', 0.14, 0.1);
  const creamMat = palette.standard(STORYBOOK_PALETTE.creamTrim, 0.78, 0.02);
  const ironMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.42, 0.72);
  const sageCapMat = palette.standard(STORYBOOK_PALETTE.sageRoof, 0.76, 0.03);

  // 1. True three-sided bay window on the east facade, north of the door —
  //    the docstring's promised "bay reading shelf", delivered at last.
  //    Canted geometry: wall opening (bay-local z ±0.5) widens to the front pane
  //    (z ±0.7) at 0.45 m projection; seat + books + mug read through the glass.
  const bay = new THREE.Group();
  bay.position.set(2.74, 0, -1.45);
  addStaticContactShadow(bay, shadowTex, 1.9, 1.7, 0.42, 0.018);
  const bayBase = new THREE.Mesh(boxAt(0.84, 0.5, 1.44, 0.22, 0.28, 0, 0, 0, 0), cedarWarmMat);
  bayBase.castShadow = true;
  bay.add(bayBase);
  const baySeat = new THREE.Mesh(boxAt(0.84, 0.07, 1.3, 0.3, 0.56, 0, 0, 0, 0), cedarMat);
  bay.add(baySeat);
  const seatBookA = new THREE.Mesh(boxAt(0.2, 0.26, 0.06, 0.16, 0.73, -0.24, 0, 0.3, 0.12), palette.standard(bookColors[0], 0.7, 0.03));
  const seatBookB = new THREE.Mesh(boxAt(0.18, 0.24, 0.06, 0.34, 0.72, -0.06, 0, -0.2, -0.1), palette.standard(bookColors[2], 0.7, 0.03));
  const seatMug = new THREE.Mesh(cylAt(0.05, 0.045, 0.09, 0.4, 0.64, 0.2, 0, 0, 9), palette.standard(STORYBOOK_PALETTE.ceramicCream, 0.4, 0.04));
  bay.add(seatBookA, seatBookB, seatMug);
  // Front pane + two canted return panes with cream mullions
  const bayFront = new THREE.Mesh(boxAt(0.06, 1.5, 1.4, 0.62, 1.32, 0, 0, 0, 0), glassMat);
  bay.add(bayFront);
  bay.add(
    new THREE.Mesh(boxAt(0.08, 1.5, 0.07, 0.62, 1.32, 0), creamMat),
    new THREE.Mesh(boxAt(0.08, 0.07, 1.4, 0.62, 1.32, 0), creamMat),
  );
  const baySideN = new THREE.Mesh(boxAt(0.66, 1.5, 0.06, 0.31, 1.32, -0.6, 0, 0.314, 0), glassMat);
  const baySideS = new THREE.Mesh(boxAt(0.66, 1.5, 0.06, 0.31, 1.32, 0.6, 0, -0.314, 0), glassMat);
  bay.add(baySideN, baySideS);
  // Corner stiles tie the three panes together (front corners + wall corners)
  bay.add(
    new THREE.Mesh(boxAt(0.09, 1.52, 0.09, 0.62, 1.32, -0.7, 0, 0, 0), creamMat),
    new THREE.Mesh(boxAt(0.09, 1.52, 0.09, 0.62, 1.32, 0.7, 0, 0, 0), creamMat),
    new THREE.Mesh(boxAt(0.09, 1.52, 0.09, 0.0, 1.32, -0.5, 0, 0, 0), creamMat),
    new THREE.Mesh(boxAt(0.09, 1.52, 0.09, 0.0, 1.32, 0.5, 0, 0, 0), creamMat),
  );
  // Head beam + pyramid cap in the shop's sage
  const bayHead = new THREE.Mesh(boxAt(1.06, 0.12, 1.52, 0.28, 2.12, 0, 0, 0, 0), creamMat);
  bay.add(bayHead);
  const bayCapGeo = new THREE.CylinderGeometry(0.02, 1.05, 0.44, 4);
  bayCapGeo.rotateY(Math.PI / 4);
  bayCapGeo.translate(0.24, 2.38, 0);
  const bayCap = new THREE.Mesh(bayCapGeo, sageCapMat);
  bayCap.castShadow = true;
  bay.add(bayCap);
  const bayCapTip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 7), palette.standard(STORYBOOK_PALETTE.agedBrass, 0.25, 0.86));
  bayCapTip.position.set(0.24, 2.62, 0);
  bay.add(bayCapTip);
  group.add(bay);

  // 2. Hanging blade sign (stacked-books motif) on a wrought-iron bracket, south wall
  const bladeBracket = new THREE.Group();
  bladeBracket.position.set(1.35, 0, 2.7);
  bladeBracket.add(
    new THREE.Mesh(boxAt(0.05, 0.42, 0.05, 0, 2.94, -0.16), ironMat),
    new THREE.Mesh(boxAt(0.05, 0.05, 0.4, 0, 3.1, 0.02), ironMat),
  );
  const bladeBoard = new THREE.Mesh(boxAt(0.5, 0.34, 0.05, 0, 2.78, 0.16, 0, 0, 0), cedarMat);
  bladeBoard.castShadow = true;
  bladeBracket.add(bladeBoard);
  const bladeHangers = new THREE.Mesh(
    mergeGeometries([boxAt(0.02, 0.14, 0.02, -0.16, 3.0, 0.16), boxAt(0.02, 0.14, 0.02, 0.16, 3.0, 0.16)], false)!,
    ironMat,
  );
  bladeBracket.add(bladeHangers);
  for (let s = 0; s < 3; s++) {
    const spine = new THREE.Mesh(boxAt(0.34, 0.075, 0.07, 0, 2.66 + s * 0.09, 0.16, 0, 0, (s % 2 === 0 ? 1 : -1) * 0.03), palette.standard(bookColors[(s + 1) % bookColors.length], 0.7, 0.03));
    bladeBracket.add(spine);
  }
  group.add(bladeBracket);

  // 3. Returns crates stacked on the north lawn (varied rotations)
  const returnsCrates = new THREE.Group();
  returnsCrates.position.set(-1.55, 0, -2.8);
  addStaticContactShadow(returnsCrates, shadowTex, 1.6, 1.1, 0.4, 0.018);
  const crateA = new THREE.Mesh(boxAt(0.62, 0.4, 0.5, 0, 0.2, 0, 0, 0.12, 0), cedarWarmMat);
  crateA.castShadow = true;
  const crateB = new THREE.Mesh(boxAt(0.52, 0.36, 0.46, 0.22, 0.58, 0.05, 0, -0.3, 0), cedarWarmMat);
  crateB.castShadow = true;
  returnsCrates.add(crateA, crateB);
  const crateBooks: THREE.BufferGeometry[] = [];
  const crateBookMats: THREE.MeshStandardMaterial[] = [];
  for (let b = 0; b < 5; b++) {
    const g = boxAt(0.3, 0.09, 0.2, -0.16 + (b % 3) * 0.14, 0.44 + Math.floor(b / 3) * 0.02, -0.12 + (b % 2) * 0.18, 0, (b % 2 === 0 ? 1 : -1) * 0.2, 0);
    crateBooks.push(g);
    crateBookMats.push(palette.standard(bookColors[(b + 2) % bookColors.length], 0.7, 0.03));
  }
  for (let b = 0; b < crateBooks.length; b++) {
    returnsCrates.add(new THREE.Mesh(crateBooks[b], crateBookMats[b]));
  }
  // One tipped crate leaning against the wall beside the stack
  const tippedCrate = new THREE.Mesh(boxAt(0.5, 0.38, 0.44, 1.15, 0.19, -0.06, 0, 0.5, 0.18), cedarWarmMat);
  tippedCrate.castShadow = true;
  returnsCrates.add(tippedCrate);
  group.add(returnsCrates);

  return group;
}

/**
 * 3. Copperwheel Cottage (Arthur) at (13.1, 0, -11.5).
 */
export function buildStorybookArthurWorkshop(ctx: BuildingBuildContext): THREE.Group {
  const { palette } = ctx;
  const { group } = buildStorybookCottageCore(
    {
      width: 6.2,
      depth: 5.4,
      wallHeight: 2.62,
      wallColor: '#E1DFD5',
      trimColor: '#564940',
      doorSide: 'south',
      roofTex: ctx.slateRoofTex,
      roofCacheKey: 'arthur_slate_roof',
      chimneyOffset: [1.8, -1.1],
      // BUILD 02 (Doc 05 §2.2 P1 — the last template building): the full craft
      // set lands here at last — sill band, quoins, bargeboards, loft vents and
      // the tapered chimney join the clockwork identity, and the workshop oriel
      // below adds the massing break that ends the "cream box + triangle" read.
      craft: { sillBand: true, quoins: true, bargeboards: true, loftVents: true, taperedChimney: true },
    },
    ctx,
  );
  group.position.set(13.1, 0, -11.5);

  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.24, 0.86);
  const clockFaceMat = palette.standard('#FAF2E1', 0.42, 0.02);

  // Gable brass clock emblem on South facade
  const clockRing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 16), brassMat);
  clockRing.position.set(0, 3.68, 2.75);
  const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 16), clockFaceMat);
  clockFace.rotation.x = Math.PI / 2;
  clockFace.position.set(0, 3.68, 2.73);
  group.add(clockRing, clockFace);

  // R-07: workshop signature props (Copperwheel was the thinnest-dressed building).
  // All props stay inside BOX_OBSTACLES 'workshop_arthur' (world x 9.4..16.8, z -14.8..-8.2)
  // -> group-local |x| <= 3.3, z <= 3.3; <= ~230 extra triangles, palette-cached materials.

  // 1. Brass vent pipe + elbow cap on the roof ridge beside the chimney
  const pipeMat = palette.standard('#B98E4A', 0.3, 0.82);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.78, 8, 1, true), pipeMat);
  pipe.position.set(-1.35, 4.62, -0.55);
  pipe.castShadow = true;
  const pipeElbow = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.42, 8), pipeMat);
  pipeElbow.rotation.z = Math.PI / 2.6;
  pipeElbow.position.set(-1.19, 5.03, -0.55);
  pipeElbow.castShadow = true;
  const pipeCap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), pipeMat);
  pipeCap.position.set(-1.04, 5.14, -0.55);
  group.add(pipe, pipeElbow, pipeCap);

  // 2. Wall-mounted bronze gear medallion left of the south door
  const gearMat = palette.standard('#8C6B3C', 0.38, 0.72);
  const gearHub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 12), gearMat);
  gearHub.rotation.x = Math.PI / 2;
  gearHub.position.set(-1.85, 2.14, 2.72);
  gearHub.castShadow = true;
  const gearCore = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.09, 10), brassMat);
  gearCore.rotation.x = Math.PI / 2;
  gearCore.position.set(-1.85, 2.14, 2.72);
  group.add(gearHub, gearCore);
  for (let t = 0; t < 8; t++) {
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.07), gearMat);
    const angle = (t / 8) * Math.PI * 2;
    tooth.position.set(
      -1.85 + Math.cos(angle) * 0.3,
      2.14 + Math.sin(angle) * 0.3,
      2.72,
    );
    tooth.rotation.z = angle;
    group.add(tooth);
  }

  // 3. Weathered workbench crate with brass bolts against the south wall
  const crateMat = palette.standard('#C9A876', 0.8, 0.02);
  const crateEdgeMat = palette.standard('#9A7A50', 0.84, 0.02);
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.52, 0.58), crateMat);
  crate.position.set(-2.55, 0.26, 2.72);
  crate.castShadow = true;
  crate.receiveShadow = true;
  const crateLid = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.09, 0.64), crateEdgeMat);
  crateLid.position.set(-2.55, 0.56, 2.72);
  crateLid.castShadow = true;
  group.add(crate, crateLid);
  const boltMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.3, 0.8);
  for (const bx of [-2.86, -2.24]) {
    for (const bz of [2.46, 2.98]) {
      const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), boltMat);
      bolt.position.set(bx, 0.34, bz);
      group.add(bolt);
    }
  }
  // A folded cedar ruler leaning on the crate (workshop storytelling detail)
  const ruler = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.09), crateEdgeMat);
  ruler.rotation.z = 0.32;
  ruler.position.set(-2.13, 0.62, 2.74);
  ruler.castShadow = true;
  group.add(ruler);

  // BUILD 02 (Doc 05 §2.2): the brass-and-cedar workshop ORIEL — Copperwheel's
  // second-roof-element massing break (Doc 09 V3). It cantilevers off the west
  // wall over the workbench side (the interior's bench zone), at upper-wall
  // height (y 2.5+), so ground obstacles/footprint parity is untouched. Cedar
  // framing + brass roof cap + warm glass: hand-made mechanical charm per the
  // Doc 05 §2.4 doctrine — Arthur could have built this.
  const cedarFrameMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.72, 0.04, {
    mapSet: 'timber-dark',
  });
  const orielGlassMat = new THREE.MeshStandardMaterial({
    color: '#E6BE7C',
    emissive: new THREE.Color('#FF9F38'),
    emissiveIntensity: 0.22,
    roughness: 0.16,
    metalness: 0.08,
    envMapIntensity: 0.9,
  });
  ctx.windowMaterials.push(orielGlassMat);
  const orielW = 1.5; // along z
  const orielH = 0.78;
  const orielProtrusion = 0.52;
  const orielY = 3.02; // upper wall: wall top is 0.5 + 2.62 = 3.12, eaves at 3.1
  const orielZ = -0.55; // bench side (northwest interior)
  const orielX = -(6.2 / 2) - orielProtrusion / 2 + 0.06;
  const orielBody = new THREE.Mesh(
    new THREE.BoxGeometry(orielProtrusion, orielH, orielW),
    cedarFrameMat,
  );
  orielBody.position.set(orielX, orielY, orielZ);
  orielBody.castShadow = true;
  group.add(orielBody);
  const orielPane = new THREE.Mesh(
    new THREE.BoxGeometry(orielProtrusion * 0.72, orielH * 0.62, orielW * 0.86),
    orielGlassMat,
  );
  orielPane.position.set(orielX - 0.04, orielY, orielZ);
  group.add(orielPane);
  // Brass cap roof (slight slope, beveled edge) + two angled cedar brackets
  const orielCap = new THREE.Mesh(
    new THREE.BoxGeometry(orielProtrusion + 0.18, 0.08, orielW + 0.16),
    brassMat,
  );
  orielCap.position.set(orielX, orielY + orielH / 2 + 0.1, orielZ);
  orielCap.rotation.z = 0.1;
  orielCap.castShadow = true;
  group.add(orielCap);
  for (const bz of [-orielW / 2 + 0.18, orielW / 2 - 0.18]) {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.09), cedarFrameMat);
    bracket.position.set(orielX + 0.08, orielY - orielH / 2 - 0.16, orielZ + bz);
    bracket.rotation.z = -0.62;
    bracket.castShadow = true;
    group.add(bracket);
  }

  return group;
}

/**
 * 4. Pinecone Woodshop (Barnaby) at (12.4, 0, 13.0).
 */
export function buildStorybookBarnabyWoodshop(ctx: BuildingBuildContext): THREE.Group {
  const { palette, shadowTex } = ctx;
  const { group } = buildStorybookCottageCore(
    {
      width: 5.6,
      depth: 5.2,
      wallHeight: 2.48,
      wallColor: '#E7D5BD',
      trimColor: STORYBOOK_PALETTE.cedarDark,
      doorSide: 'west',
      // Phase B/C: terracotta roof breaks the sage-twin pairing with the gazebo
      // lane read; full craft set + tapered chimney give the maker's yard its stack
      roofTex: ctx.terracottaRoofTex,
      roofCacheKey: 'barnaby_terracotta_roof',
      chimneyOffset: [1.4, 1.0],
      // BUILD 02 (Doc 05 §2.2): + the ridge dormer — the workbench gable gains
      // its second roof element, ending the shared gable-prism read.
      craft: { sillBand: true, quoins: true, bargeboards: true, loftVents: true, taperedChimney: true, dormer: true },
    },
    ctx,
  );
  group.position.set(12.4, 0, 13.0);

  // Stacked firewood log rack tucked against West porch wall
  const barkMat = palette.standard(STORYBOOK_PALETTE.oakBark, 0.88, 0.01);
  const woodCutMat = palette.standard('#DFC39B', 0.82, 0.0);
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 3 - row; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.72, 7), barkMat);
      log.rotation.z = Math.PI / 2;
      log.position.set(-3.12, 0.22 + row * 0.22, -1.6 + i * 0.28 + row * 0.14);
      const end = new THREE.Mesh(new THREE.CircleGeometry(0.12, 7), woodCutMat);
      end.rotation.y = -Math.PI / 2;
      end.position.set(-3.49, 0.22 + row * 0.22, -1.6 + i * 0.28 + row * 0.14);
      group.add(log, end);
    }
  }

  // Phase C — maker-identity yard (audit §5.2): the neighborhood's carpenter finally
  // tells a working story. All props stay inside workshop_barnaby (local |x|,|z| <= 3.2/3.4)
  // and carry contact shadows; no obstacle, interactable, or door-side change.
  const plankMat = palette.standard('#C8996A', 0.8, 0.02);
  const plankDarkMat = palette.standard('#B08258', 0.82, 0.02);
  const chipMat = palette.standard('#D9B487', 0.88, 0.0);
  const stoneDarkMat = palette.standard(STORYBOOK_PALETTE.fieldstoneDark, 0.9, 0.02);
  const ironMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.42, 0.72);

  // 1. Stacked lumber with visible end-grain discs along the south wall
  //    (board pitch compressed so the deepest tier stays inside the plot)
  const lumberGroup = new THREE.Group();
  lumberGroup.position.set(0.8, 0, 2.6);
  addStaticContactShadow(lumberGroup, shadowTex, 2.0, 0.85, 0.4, 0.018);
  const lumberBoards: THREE.BufferGeometry[] = [];
  const lumberEnds: THREE.BufferGeometry[] = [];
  for (let tier = 0; tier < 4; tier++) {
    const count = 4 - (tier % 2);
    for (let b = 0; b < count; b++) {
      const bz = -0.3 + b * 0.2 + tier * 0.02;
      lumberBoards.push(boxAt(1.5, 0.09, 0.28, 0, 0.14 + tier * 0.095, bz, 0, 0, (b % 2 === 0 ? 1 : -1) * 0.012));
      lumberEnds.push(cylAt(0.14, 0.14, 0.03, -0.74, 0.14 + tier * 0.095, bz, 0, Math.PI / 2, 10));
    }
  }
  const lumberMesh = new THREE.Mesh(mergeGeometries(lumberBoards, false)!, plankMat);
  lumberMesh.castShadow = true;
  lumberGroup.add(lumberMesh);
  const lumberEndsMesh = new THREE.Mesh(mergeGeometries(lumberEnds, false)!, woodCutMat);
  lumberGroup.add(lumberEndsMesh);
  // Two skid sleepers keep the stack off the grass
  lumberGroup.add(
    new THREE.Mesh(mergeGeometries([boxAt(1.6, 0.08, 0.14, 0, 0.04, -0.08, 0, 0, 0), boxAt(1.6, 0.08, 0.14, 0, 0.04, 0.22, 0, 0, 0)], false)!, plankDarkMat),
  );
  group.add(lumberGroup);

  // 2. Sawhorse with a half-sawn plank + curling wood-chip pile (south-east lawn)
  const sawhorse = new THREE.Group();
  sawhorse.position.set(2.35, 0, 2.35);
  sawhorse.rotation.y = -0.35;
  addStaticContactShadow(sawhorse, shadowTex, 1.5, 1.1, 0.4, 0.018);
  const horseLegs: THREE.BufferGeometry[] = [];
  for (const lx of [-0.55, 0.55]) {
    horseLegs.push(boxAt(0.07, 0.62, 0.07, lx, 0.31, -0.2, 0, 0, 0.24));
    horseLegs.push(boxAt(0.07, 0.62, 0.07, lx, 0.31, 0.2, 0, 0, -0.24));
    horseLegs.push(boxAt(0.06, 0.3, 0.06, lx, 0.42, 0, 0, 0, 0));
  }
  horseLegs.push(boxAt(1.3, 0.09, 0.14, 0, 0.64, 0));
  const horseMesh = new THREE.Mesh(mergeGeometries(horseLegs, false)!, plankDarkMat);
  horseMesh.castShadow = true;
  sawhorse.add(horseMesh);
  const workPlank = new THREE.Mesh(boxAt(1.7, 0.07, 0.3, 0.15, 0.72, 0, 0, 0, 0), plankMat);
  workPlank.castShadow = true;
  sawhorse.add(workPlank);
  // The cut line: a kerf gap + a fallen offcut wedge
  sawhorse.add(new THREE.Mesh(boxAt(0.03, 0.09, 0.32, 0.35, 0.72, 0), stoneDarkMat));
  const offcut = new THREE.Mesh(boxAt(0.42, 0.07, 0.28, 0.95, 0.045, 0.3, 0, 0.5, 0), plankMat);
  offcut.castShadow = true;
  sawhorse.add(offcut);
  const saw = new THREE.Mesh(boxAt(0.5, 0.02, 0.11, 0.55, 0.79, 0.05, 0, 0.4, 0), ironMat);
  sawhorse.add(saw);
  group.add(sawhorse);

  const chipPile = new THREE.Group();
  chipPile.position.set(-0.7, 0, 2.7);
  addStaticContactShadow(chipPile, shadowTex, 1.0, 0.9, 0.38, 0.018);
  const chips: THREE.BufferGeometry[] = [];
  for (let c = 0; c < 9; c++) {
    const chip = new THREE.DodecahedronGeometry(0.09 + (c % 3) * 0.02, 0);
    chip.scale(1, 0.4, 1);
    chip.rotateY(c * 1.3);
    chip.translate(
      -0.28 + ((c * 5) % 5) * 0.14,
      0.06 + (c % 3) * 0.05,
      -0.18 + ((c * 3) % 4) * 0.12,
    );
    chips.push(chip);
  }
  chipPile.add(new THREE.Mesh(mergeGeometries(chips, false)!, chipMat));
  group.add(chipPile);

  // 3. Hanging shingle sign — carved pinecone disc on an iron bracket by the west door
  const shingleBracket = new THREE.Group();
  shingleBracket.position.set(-2.92, 0, 1.05);
  const bracketArm = new THREE.Mesh(boxAt(0.34, 0.05, 0.05, -0.2, 2.62, 0), ironMat);
  const bracketPost = new THREE.Mesh(boxAt(0.05, 0.5, 0.05, -0.02, 2.42, 0), ironMat);
  shingleBracket.add(bracketArm, bracketPost);
  const shingleHanger = new THREE.Mesh(cylAt(0.012, 0.012, 0.22, -0.32, 2.5, 0), ironMat);
  shingleBracket.add(shingleHanger);
  const shingleDisc = new THREE.Mesh(cylAt(0.26, 0.26, 0.05, -0.32, 2.28, 0, 0, Math.PI / 2, 14), plankDarkMat);
  shingleDisc.castShadow = true;
  shingleBracket.add(shingleDisc);
  const pineconeCore = new THREE.Mesh(cylAt(0.055, 0.11, 0.22, -0.36, 2.28, 0, 0, Math.PI / 2, 8), barkMat);
  shingleBracket.add(pineconeCore);
  for (let s = 0; s < 4; s++) {
    const scale = new THREE.Mesh(boxAt(0.02, 0.045, 0.12, -0.375, 2.2 + s * 0.05, 0, 0, 0, 0.5), plankDarkMat);
    shingleBracket.add(scale);
  }
  group.add(shingleBracket);

  // 4. Wheelbarrow leaning on the west gable, north of the firewood rack
  const barrow = new THREE.Group();
  barrow.position.set(-2.95, 0, -2.35);
  barrow.rotation.y = 0.5;
  addStaticContactShadow(barrow, shadowTex, 1.2, 0.9, 0.4, 0.018);
  const barrowTray = new THREE.Mesh(boxAt(0.62, 0.24, 0.42, 0, 0.36, 0, 0, 0, 0), plankMat);
  barrowTray.castShadow = true;
  const barrowLipA = new THREE.Mesh(boxAt(0.66, 0.05, 0.46, 0, 0.49, 0), plankDarkMat);
  const barrowLegs = new THREE.Group();
  for (const [lx, lz] of [
    [0.2, 0.14],
    [0.2, -0.14],
  ] as Array<[number, number]>) {
    const leg = new THREE.Mesh(boxAt(0.05, 0.28, 0.05, lx, 0.14, lz), plankDarkMat);
    barrowLegs.add(leg);
  }
  const barrowHandles = new THREE.Mesh(
    mergeGeometries(
      [
        boxAt(0.7, 0.05, 0.05, 0.28, 0.32, 0.16, 0, 0, -0.12),
        boxAt(0.7, 0.05, 0.05, 0.28, 0.32, -0.16, 0, 0, -0.12),
      ],
      false,
    )!,
    plankDarkMat,
  );
  const barrowWheel = new THREE.Mesh(cylAt(0.17, 0.17, 0.06, -0.42, 0.17, 0, Math.PI / 2, 0, 12), plankDarkMat);
  barrowWheel.castShadow = true;
  const barrowWheelHub = new THREE.Mesh(cylAt(0.045, 0.045, 0.09, -0.42, 0.17, 0, Math.PI / 2, 0, 8), ironMat);
  barrow.add(barrowTray, barrowLipA, barrowLegs, barrowHandles, barrowWheel, barrowWheelHub);
  group.add(barrow);

  return group;
}

/**
 * 5. Sunbeam Greenhouse (Mina) at (14.3, 0, 1.7) (BOX_OBSTACLES minX:10.8, maxX:17.8, minZ:-1.8, maxZ:5.2).
 *
 * Building-architecture audit Phase A — "Sunbeam Conservatory" rebuild (visual only; the reserved
 * plot, the exterior door interactable at (10.15, 3.2) and the herb-planter prop are unchanged):
 * - Panelized structural glazing: per-face merged bar grids (stiles + transom + base/head rails)
 *   on all four glass faces, glazing bars + collar bars on both roof slopes, raked gable framing
 *   with king posts (the roof is the largest surface at the 28° camera — it now reads as glasswork).
 * - Working-glasshouse features: two ridge sash vents (one propped open), dwarf-wall louvre vents,
 *   timber eaves boards with cedar trough gutters + iron brackets, and a downpipe feeding a cedar
 *   rain barrel on the north-west corner (inside the plot, off the door approach).
 * - Layered stone dwarf wall: three coursed bands, stepped corner quoins, chamfered coping.
 * - One entrance only: a gabled timber vestibule wraps the real west doorway (group-local
 *   x -2.77, z 1.5); the old decoy entry frame at local (-2.85, z 0) is deleted. The separate
 *   doorway dressing (leaf, lantern, sign, step) is mounted by NeighborhoodCanvas at the glass line.
 * - Interior-faithful furniture read through the glass, mirroring greenhouseInterior.ts after the
 *   door-side reconciliation: trestle potting bench (N), growing shelf (E), worktable (S), water
 *   barrel (NE) — every piece legs-grounded (the old floating 3.9 × 3.5 bench slab is gone).
 * - Gardener's yard: staging shelf with seed trays + copper can, propped cold frame, tool rack,
 *   two herb beds, vitrex climbers on the vestibule posts. All props stay inside the reserved
 *   plot and carry contact shadows.
 */
export function buildStorybookGreenhouse(ctx: BuildingBuildContext): THREE.Group {
  const { palette, shadowTex, windowMaterials } = ctx;
  const group = new THREE.Group();
  group.position.set(14.3, 0, 1.7);

  addStaticContactShadow(group, shadowTex, 7.2, 6.8, 0.42, 0.018);

  const stoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.88, 0.02);
  const darkStoneMat = palette.standard(STORYBOOK_PALETTE.fieldstoneDark, 0.9, 0.02);
  const curbMat = palette.standard(STORYBOOK_PALETTE.limestoneCurb, 0.84, 0.02);
  const creamMat = palette.standard(STORYBOOK_PALETTE.creamTrim, 0.78, 0.02);
  const woodMat = palette.standard('#EAE0CA', 0.72, 0.04);
  const cedarMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.76, 0.04);
  const cedarDarkMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.78, 0.04);
  const ironMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.42, 0.72);
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.28, 0.8);
  const potMat = palette.standard(STORYBOOK_PALETTE.terracottaPot, 0.44, 0.04);
  const leafMat = palette.standard(STORYBOOK_PALETTE.foliageMid, 0.84, 0.0);
  const soilMat = palette.standard('#5B4635', 0.9, 0.0);
  const copperMat = palette.standard('#A8663B', 0.34, 0.78);
  const linenMat = palette.standard(STORYBOOK_PALETTE.ceramicCream, 0.5, 0.03);
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#D2ECEB',
    roughness: 0.12,
    metalness: 0.1,
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
  });

  // Per-material merge helper (audit §10.4 draw-call discipline:
  // the glazing grids would add 100+ meshes if built naively; merged per face/slope instead).
  const addMerged = (
    parts: THREE.BufferGeometry[],
    mat: THREE.Material,
    castShadow = false,
  ): THREE.Mesh => {
    const merged = mergeGeometries(parts, false) ?? parts[0];
    if (merged !== parts[0]) for (const p of parts) p.dispose();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = castShadow;
    group.add(mesh);
    return mesh;
  };

  // ---------------------------------------------------------------------
  // 1. Layered stone dwarf wall: three coursed bands + chamfered coping
  //    + stepped corner quoins + one louvre vent panel per side
  // ---------------------------------------------------------------------
  const dwarfCourses: Array<{ h: number; y: number; w: number; d: number; mat: THREE.Material }> = [
    { h: 0.34, y: 0.17, w: 5.9, d: 5.5, mat: stoneMat },
    { h: 0.3, y: 0.49, w: 5.86, d: 5.46, mat: darkStoneMat },
    { h: 0.24, y: 0.76, w: 5.94, d: 5.54, mat: stoneMat },
  ];
  for (const c of dwarfCourses) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.h, c.d), c.mat);
    mesh.position.y = c.y;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  // Chamfered coping (stepped two-box profile replaces the old flat cap)
  const copingBase = new THREE.Mesh(new THREE.BoxGeometry(6.08, 0.08, 5.68), curbMat);
  copingBase.position.y = 0.92;
  const copingTop = new THREE.Mesh(new THREE.BoxGeometry(5.96, 0.06, 5.56), curbMat);
  copingTop.position.y = 0.955;
  group.add(copingBase, copingTop);

  // Stepped corner quoin blocks (Willow Step pattern, scaled to the dwarf wall;
  // x/z offsets keep the blocks proud of every course silhouette)
  const quoins: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      quoins.push(boxAt(0.36, 0.44, 0.36, sx * 2.82, 0.26, sz * 2.62));
      quoins.push(boxAt(0.32, 0.4, 0.32, sx * 2.82, 0.68, sz * 2.62));
    }
  }
  addMerged(quoins, darkStoneMat, true);

  // Louvre vent panels: recessed dark box + four angled slats, one per face
  // Louvre centres are chosen to sit clear of the wall stile rhythm
  const louvreSpots: Array<{ x: number; z: number; rotY: number }> = [
    { x: 1.1, z: -2.79, rotY: 0 },
    { x: -1.1, z: 2.79, rotY: 0 },
    { x: 2.79, z: 0, rotY: Math.PI / 2 },
    { x: -2.79, z: -0.9, rotY: Math.PI / 2 },
  ];
  const louvreBoxes: THREE.BufferGeometry[] = [];
  const louvreSlats: THREE.BufferGeometry[] = [];
  for (const s of louvreSpots) {
    for (let i = 0; i < 4; i++) {
      const ly = 0.36 + i * 0.11;
      if (s.rotY === 0) {
        louvreSlats.push(boxAt(0.48, 0.035, 0.1, s.x, ly, s.z, 0, 0, 0.42));
      } else {
        louvreSlats.push(boxAt(0.1, 0.035, 0.48, s.x, ly, s.z, 0.42, 0, 0));
      }
    }
    louvreBoxes.push(
      s.rotY === 0
        ? boxAt(0.56, 0.5, 0.08, s.x, 0.52, s.z)
        : boxAt(0.08, 0.5, 0.56, s.x, 0.52, s.z),
    );
  }
  addMerged(louvreBoxes, darkStoneMat);
  addMerged(louvreSlats, cedarDarkMat);

  // ---------------------------------------------------------------------
  // 2. Glass enclosure & pitched glass roof (volumes unchanged from the
  //    audited build; all articulation is added framing around them)
  // ---------------------------------------------------------------------
  const glassBox = new THREE.Mesh(new THREE.BoxGeometry(5.55, 2.25, 5.15), glassMat);
  glassBox.position.y = 2.08;
  group.add(glassBox);

  const roofShape = new THREE.Shape();
  roofShape.moveTo(-2.95, 0);
  roofShape.lineTo(2.95, 0);
  roofShape.lineTo(0, 1.62);
  roofShape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 5.36, bevelEnabled: false });
  roofGeo.translate(0, 0, -2.68);
  const roofGlass = new THREE.Mesh(roofGeo, glassMat);
  roofGlass.position.y = 3.2;
  group.add(roofGlass);

  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 5.52), woodMat);
  ridge.position.y = 4.82;
  ridge.castShadow = true;
  group.add(ridge);

  // Panelized structural glazing — per-face merged bar grids (audit §6.2)
  const northBars: THREE.BufferGeometry[] = [];
  const southBars: THREE.BufferGeometry[] = [];
  const eastBars: THREE.BufferGeometry[] = [];
  const westBars: THREE.BufferGeometry[] = [];
  for (const bx of [-2.775, -1.665, -0.555, 0.555, 1.665, 2.775]) {
    northBars.push(boxAt(0.08, 2.25, 0.09, bx, 2.08, -2.61));
    southBars.push(boxAt(0.08, 2.25, 0.09, bx, 2.08, 2.61));
  }
  for (const bz of [-2.575, -1.545, -0.515, 0.515, 1.545, 2.575]) {
    eastBars.push(boxAt(0.09, 2.25, 0.08, 2.805, 2.08, bz));
  }
  // West face carries the doorway (group-local z 0.86..2.14 = the real entrance);
  // its stiles stop clear of the door surround and the rails split around it.
  for (const bz of [-2.575, -1.545, -0.515, 2.575]) {
    westBars.push(boxAt(0.09, 2.25, 0.08, -2.805, 2.08, bz));
  }
  for (const face of [
    { bars: northBars, axis: 'x' as const, sign: -1 },
    { bars: southBars, axis: 'x' as const, sign: 1 },
  ]) {
    const z = face.sign * 2.61;
    face.bars.push(
      boxAt(5.62, 0.09, 0.09, 0, 1.0, z),
      boxAt(5.62, 0.09, 0.09, 0, 3.16, z),
      boxAt(5.62, 0.08, 0.09, 0, 2.3, z),
    );
  }
  for (const face of [
    { bars: eastBars, sign: 1 },
    { bars: westBars, sign: -1 },
  ]) {
    const x = face.sign * 2.805;
    face.bars.push(
      boxAt(0.09, 0.09, 5.22, x, 1.0, 0),
      boxAt(0.09, 0.09, 5.22, x, 3.16, 0),
      boxAt(0.09, 0.08, 5.22, x, 2.3, 0),
    );
  }
  // West rails split around the doorway (north run + narrow south return + over-door header)
  westBars.push(
    boxAt(0.09, 0.09, 3.44, -2.805, 1.0, -0.855),
    boxAt(0.09, 0.09, 3.44, -2.805, 3.16, -0.855),
    boxAt(0.09, 0.09, 0.44, -2.805, 1.0, 2.375),
    boxAt(0.09, 0.09, 0.44, -2.805, 3.16, 2.375),
    boxAt(0.09, 0.08, 1.28, -2.805, 2.3, 1.5),
  );
  addMerged(northBars, woodMat, true);
  addMerged(southBars, woodMat, true);
  addMerged(eastBars, woodMat, true);
  addMerged(westBars, woodMat, true);

  // Chunky corner posts carry the structural hierarchy (stiles stay light)
  const cornerPosts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      cornerPosts.push(boxAt(0.16, 2.34, 0.16, sx * 2.775, 2.08, sz * 2.575));
    }
  }
  addMerged(cornerPosts, woodMat, true);

  // Roof glazing bars + collar bars on both slopes (the roof is the largest
  // visible surface from the isometric camera — audit §6.2)
  const pitch = Math.atan2(1.62, 2.95);
  const eastRoofBars: THREE.BufferGeometry[] = [];
  const westRoofBars: THREE.BufferGeometry[] = [];
  for (const bz of [-2.15, -1.08, 0, 1.08, 2.15]) {
    eastRoofBars.push(boxAt(3.5, 0.075, 0.09, 1.5, 4.05, bz, 0, 0, -pitch));
    westRoofBars.push(boxAt(3.5, 0.075, 0.09, -1.5, 4.05, bz, 0, 0, pitch));
  }
  for (const rx of [1.0, 2.0]) {
    const ry = 4.82 - (rx / 2.95) * 1.62 + 0.05;
    eastRoofBars.push(boxAt(0.07, 0.09, 5.15, rx, ry, 0));
    westRoofBars.push(boxAt(0.07, 0.09, 5.15, -rx, ry, 0));
  }
  addMerged(eastRoofBars, woodMat, true);
  addMerged(westRoofBars, woodMat, true);

  // Raked gable framing: barge bars along both edges + king post + tie bar (north & south)
  const gableFraming: THREE.BufferGeometry[] = [];
  for (const sz of [-1, 1]) {
    const gz = sz * 2.7;
    gableFraming.push(
      boxAt(3.5, 0.08, 0.09, 1.5, 4.05, gz, 0, 0, -pitch),
      boxAt(3.5, 0.08, 0.09, -1.5, 4.05, gz, 0, 0, pitch),
      boxAt(0.09, 1.4, 0.09, 0, 4.12, gz),
      boxAt(4.9, 0.08, 0.09, 0, 3.47, gz),
    );
  }
  addMerged(gableFraming, woodMat, true);

  // Two ridge sash ventilators on the east slope — the north one propped open
  for (const [vz, open] of [
    [1.2, false],
    [-1.2, true],
  ] as Array<[number, boolean]>) {
    const vy = 4.82 - (0.45 / 2.95) * 1.62;
    const ventFrame: THREE.BufferGeometry[] = [
      boxAt(0.62, 0.06, 0.74, 0.45, vy + 0.05, vz, 0, 0, -pitch),
      boxAt(0.5, 0.05, 0.1, 0.45, vy + 0.05, vz - 0.32, 0, 0, -pitch),
      boxAt(0.5, 0.05, 0.1, 0.45, vy + 0.05, vz + 0.32, 0, 0, -pitch),
    ];
    addMerged(ventFrame, cedarDarkMat, true);
    const ventGlass = new THREE.Mesh(
      open
        ? boxAt(0.52, 0.03, 0.58, 0.52, vy + 0.16, vz, 0, 0, -pitch - 0.42)
        : boxAt(0.52, 0.03, 0.58, 0.45, vy + 0.03, vz, 0, 0, -pitch),
      glassMat,
    );
    group.add(ventGlass);
    if (open) {
      group.add(new THREE.Mesh(boxAt(0.05, 0.05, 0.34, 0.62, vy + 0.22, vz + 0.18, 0, 0, 0.9), cedarMat));
    }
  }

  // Turned gable finials at both apexes (Gazebo pattern, scaled down; merged per material)
  const finialSpires: THREE.BufferGeometry[] = [];
  const finialBalls: THREE.BufferGeometry[] = [];
  for (const sz of [-1, 1]) {
    finialSpires.push(cylAt(0.05, 0.09, 0.42, 0, 5.02, sz * 2.72));
    const ball = new THREE.SphereGeometry(0.08, 8, 8);
    ball.translate(0, 5.26, sz * 2.72);
    finialBalls.push(ball);
  }
  addMerged(finialSpires, woodMat);
  addMerged(finialBalls, brassMat);

  // Timber eaves boards + cedar trough gutters + iron brackets on both long walls
  const eavesParts: THREE.BufferGeometry[] = [];
  const troughParts: THREE.BufferGeometry[] = [];
  const brackets: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    eavesParts.push(boxAt(0.16, 0.15, 5.72, sx * 2.97, 3.13, 0));
    troughParts.push(boxAt(0.14, 0.1, 5.66, sx * 2.99, 3.2, 0));
    for (const bz of [-2.0, 0, 2.0]) {
      brackets.push(boxAt(0.12, 0.03, 0.05, sx * 2.93, 3.13, bz));
      brackets.push(boxAt(0.03, 0.14, 0.05, sx * 2.99, 3.18, bz));
    }
  }
  addMerged(eavesParts, cedarMat, true);
  addMerged(troughParts, cedarDarkMat, true);
  addMerged(brackets, ironMat);

  // Downpipe from the west trough's north end into the rain barrel
  const pipe = new THREE.Mesh(cylAt(0.04, 0.04, 2.15, -2.93, 2.02, -2.78), ironMat);
  pipe.castShadow = true;
  const pipeElbow = new THREE.Mesh(cylAt(0.045, 0.045, 0.32, -2.88, 0.92, -2.8, 0, 0.9), ironMat);
  group.add(pipe, pipeElbow);

  const rainBarrel = new THREE.Group();
  rainBarrel.position.set(-2.72, 0, -2.85);
  addStaticContactShadow(rainBarrel, shadowTex, 1.0, 1.0, 0.4, 0.018);
  const rbBody = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.78, 12), cedarDarkMat);
  rbBody.position.y = 0.39;
  rbBody.castShadow = true;
  rainBarrel.add(rbBody);
  const rbBands: THREE.BufferGeometry[] = [];
  for (const by of [0.14, 0.62]) {
    const band = new THREE.TorusGeometry(0.325, 0.022, 6, 14);
    band.rotateX(Math.PI / 2);
    band.translate(0, by, 0);
    rbBands.push(band);
  }
  rainBarrel.add(new THREE.Mesh(mergeGeometries(rbBands, false)!, ironMat));
  const rbWater = new THREE.Mesh(
    new THREE.CylinderGeometry(0.29, 0.29, 0.05, 12),
    palette.standard('#6E93A8', 0.3, 0.08),
  );
  rbWater.position.y = 0.72;
  rainBarrel.add(rbWater);
  group.add(rainBarrel);

  // ---------------------------------------------------------------------
  // 3. Entrance vestibule wrapping the real west doorway (group-local
  //    x -2.77, z 1.5) — the decoy frame is deleted; this is the only entry
  // ---------------------------------------------------------------------
  const vestibuleWood: THREE.BufferGeometry[] = [];
  const vestibulePads: THREE.BufferGeometry[] = [];
  for (const vz of [0.62, 2.38]) {
    vestibulePads.push(boxAt(0.34, 0.14, 0.34, -3.29, 0.07, vz));
    vestibuleWood.push(boxAt(0.16, 2.3, 0.16, -3.29, 1.29, vz));
    vestibuleWood.push(boxAt(0.12, 2.3, 0.12, -2.84, 1.29, vz));
  }
  vestibuleWood.push(
    boxAt(0.14, 0.16, 1.98, -3.29, 2.5, 1.5),
    boxAt(0.12, 0.14, 1.98, -2.84, 2.49, 1.5),
  );
  addMerged(vestibulePads, darkStoneMat);
  addMerged(vestibuleWood, cedarDarkMat, true);

  // Mini gable porch hood carrying the roofline down over the door. Steep pitch,
  // narrow span, cream gable ends + deck so the hood separates cleanly from the
  // dark west eaves trough at the oblique approach camera (a shallow dark gable
  // merges into an unreadable wedge from the south-west; verified in Phase A QA).
  const porchPitch = Math.atan2(0.45, 0.85);
  const porchShape = new THREE.Shape();
  porchShape.moveTo(-0.85, 0);
  porchShape.lineTo(0.85, 0);
  porchShape.lineTo(0, 0.45);
  porchShape.closePath();
  for (const gx of [-3.5, -2.8]) {
    // BUILD 02 bevel sweep (Doc 05 §2.2 P3): vestibule porch gables soften.
    const gableGeo = new THREE.ExtrudeGeometry(porchShape, {
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 1,
    });
    gableGeo.translate(0, 0, 0);
    const gable = new THREE.Mesh(gableGeo, creamMat);
    gable.rotation.y = Math.PI / 2;
    gable.position.set(gx, 2.5, 1.5);
    group.add(gable);
  }
  const porchRidge = new THREE.Mesh(boxAt(0.8, 0.09, 0.11, -3.15, 2.95, 1.5), cedarDarkMat);
  porchRidge.castShadow = true;
  group.add(porchRidge);
  const porchWood: THREE.BufferGeometry[] = [];
  for (const px of [-3.3, -3.0]) {
    porchWood.push(
      boxAt(0.08, 0.06, 1.02, px, 2.72, 1.07, porchPitch, 0, 0),
      boxAt(0.08, 0.06, 1.02, px, 2.72, 1.93, -porchPitch, 0, 0),
    );
  }
  // Light deck boards over the rafters (cream family — reads as the conservatory
  // glazing-bar palette rather than a second dark roof)
  porchWood.push(
    boxAt(0.82, 0.04, 1.0, -3.15, 2.79, 1.06, porchPitch, 0, 0),
    boxAt(0.82, 0.04, 1.0, -3.15, 2.79, 1.94, -porchPitch, 0, 0),
  );
  addMerged(porchWood, woodMat, true);
  const porchFinial = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.26, 8), woodMat);
  porchFinial.position.set(-3.58, 3.06, 1.5);
  group.add(porchFinial);

  // Thermometer board on the north porch post + vitrex climbers on both posts
  const thermoBoard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.04), linenMat);
  thermoBoard.position.set(-3.29, 1.72, 0.5);
  const thermoDial = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10), brassMat);
  thermoDial.rotation.x = Math.PI / 2;
  thermoDial.position.set(-3.29, 1.8, 0.47);
  group.add(thermoBoard, thermoDial);

  const vineBeads: THREE.BufferGeometry[] = [];
  const vineBlooms: THREE.BufferGeometry[] = [];
  const vineSpots: Array<[number, number, number]> = [
    [-3.22, 0.55, 0.66],
    [-3.32, 0.95, 0.56],
    [-3.24, 1.35, 0.68],
    [-3.34, 1.75, 0.58],
    [-3.22, 0.6, 2.32],
    [-3.32, 1.0, 2.42],
    [-3.24, 1.4, 2.3],
    [-3.34, 1.8, 2.4],
  ];
  for (const [vx, vy, vz] of vineSpots) {
    vineBeads.push(cylAt(0.055, 0.07, 0.1, vx, vy, vz, Math.PI / 2, 0, 6));
  }
  for (const [vx, vy, vz] of [
    [-3.32, 1.15, 0.62],
    [-3.32, 1.58, 2.36],
  ]) {
    vineBlooms.push(cylAt(0.06, 0.06, 0.09, vx, vy, vz, Math.PI / 2, 0, 6));
  }
  addMerged(vineBeads, leafMat);
  addMerged(vineBlooms, palette.standard(STORYBOOK_PALETTE.petalRose, 0.6, 0.02));

  // ---------------------------------------------------------------------
  // 4. Interior-faithful furniture read through the glass — mirrors the
  //    cutaway diorama layout (potting bench N, growing shelf E, worktable
  //    S, water barrel NE). Every piece is grounded; the old floating
  //    3.9 × 3.5 bench slab is removed.
  // ---------------------------------------------------------------------
  // Potting bench (north wall) with trestle legs + lower shelf
  const benchWood: THREE.BufferGeometry[] = [
    boxAt(1.85, 0.09, 0.78, -1.9, 0.86, -2.15),
    boxAt(1.85, 0.5, 0.06, -1.9, 0.56, -1.79),
    boxAt(0.12, 0.86, 0.12, -2.72, 0.43, -2.15),
    boxAt(0.12, 0.86, 0.12, -1.08, 0.43, -2.15),
    boxAt(1.6, 0.05, 0.6, -1.9, 0.3, -2.15),
    boxAt(0.42, 0.16, 0.42, -2.52, 0.62, -2.15),
    boxAt(0.42, 0.16, 0.42, -2.52, 0.78, -2.15),
  ];
  addMerged(benchWood, cedarMat, true);
  const benchSoilBag = new THREE.Mesh(cylAt(0.17, 0.13, 0.34, -1.55, 1.07, -2.25, 0, 0.16), linenMat);
  benchSoilBag.castShadow = true;
  const benchPotStack: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) benchPotStack.push(cylAt(0.11, 0.08, 0.13, -1.25, 0.99 + i * 0.065, -2.03, 0, 0, 9));
  group.add(benchSoilBag);
  addMerged(benchPotStack, potMat);

  // Growing shelf (east wall) — braces, boards, upper jar shelf
  const shelfWood: THREE.BufferGeometry[] = [
    boxAt(0.68, 0.07, 2.5, 2.62, 0.92, 0.05),
    boxAt(0.62, 0.06, 2.5, 2.62, 0.34, 0.05),
    boxAt(0.58, 0.28, 0.09, 2.62, 0.63, -1.07),
    boxAt(0.58, 0.28, 0.09, 2.62, 0.63, 0.05),
    boxAt(0.58, 0.28, 0.09, 2.62, 0.63, 1.17),
    boxAt(0.4, 0.05, 1.6, 2.84, 1.72, 0.15),
  ];
  addMerged(shelfWood, cedarMat, true);
  const shelfJars: THREE.BufferGeometry[] = [];
  for (const jz of [-0.35, -0.13, 0.57]) shelfJars.push(cylAt(0.07, 0.07, 0.18, 2.84, 1.84, jz, 0, 0, 8));
  addMerged(shelfJars, linenMat);

  // Worktable (south wall) + field notebook + tea cup
  const tableWood: THREE.BufferGeometry[] = [
    boxAt(1.95, 0.08, 0.82, 0.1, 0.8, 2.12),
    boxAt(0.11, 0.8, 0.11, -0.75, 0.4, 2.12),
    boxAt(0.11, 0.8, 0.11, 0.95, 0.4, 2.12),
  ];
  addMerged(tableWood, cedarMat, true);
  const notePages = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.26), linenMat);
  notePages.position.set(-0.45, 0.86, 2.17);
  notePages.rotation.y = 0.35;
  const teaCup = new THREE.Mesh(cylAt(0.055, 0.042, 0.075, 0.22, 0.89, 2.26), linenMat);
  group.add(notePages, teaCup);

  // Water barrel (north-east corner, mirrors the interior station)
  const waterBarrel = new THREE.Group();
  waterBarrel.position.set(2.05, 0, -2.18);
  addStaticContactShadow(waterBarrel, shadowTex, 1.0, 1.0, 0.42, 0.018);
  const wbBody = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.78, 12), cedarDarkMat);
  wbBody.position.y = 0.39;
  wbBody.castShadow = true;
  waterBarrel.add(wbBody);
  const wbBands: THREE.BufferGeometry[] = [];
  for (const by of [0.14, 0.42, 0.68]) {
    const band = new THREE.TorusGeometry(0.315, 0.022, 6, 14);
    band.rotateX(Math.PI / 2);
    band.translate(0, by, 0);
    wbBands.push(band);
  }
  waterBarrel.add(new THREE.Mesh(mergeGeometries(wbBands, false)!, ironMat));
  group.add(waterBarrel);

  // Six potted blooms redistributed onto the shelf and the worktable — heads are
  // vertex-colored and merged into ONE mesh (audit §10.4 draw-call discipline)
  const potColors = ['#E77C7C', '#F2BE54', '#9E8CE0', '#7BC490', '#F097A5', '#82BBE0'];
  const bloomPotGeos: THREE.BufferGeometry[] = [];
  const bloomLeafGeos: THREE.BufferGeometry[] = [];
  const bloomHeadGeos: THREE.BufferGeometry[] = [];
  const bloomSpots: Array<[number, number, number]> = [
    [2.62, 1.09, -0.7],
    [2.62, 1.09, 0.1],
    [2.62, 1.09, 0.9],
    [-0.45, 0.97, 2.1],
    [0.1, 0.97, 2.08],
    [0.65, 0.97, 2.14],
  ];
  const paintGeo = (g: THREE.BufferGeometry, hex: string) => {
    const c = new THREE.Color(hex);
    const count = (g.getAttribute('position') as THREE.BufferAttribute).count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  };
  for (let i = 0; i < 6; i++) {
    const [px, py, pz] = bloomSpots[i];
    bloomPotGeos.push(cylAt(0.24, 0.18, 0.34, px, py, pz, 0, 0, 8));
    const leaf = new THREE.DodecahedronGeometry(0.26, 0);
    leaf.translate(px, py + 0.28, pz);
    bloomLeafGeos.push(leaf);
    const head = new THREE.DodecahedronGeometry(0.16, 0);
    head.translate(px + 0.08, py + 0.48, pz);
    paintGeo(head, potColors[i]);
    bloomHeadGeos.push(head);
  }
  addMerged(bloomPotGeos, potMat);
  addMerged(bloomLeafGeos, leafMat);
  addMerged(
    bloomHeadGeos,
    new THREE.MeshStandardMaterial({ color: '#FFFFFF', vertexColors: true, roughness: 0.6, metalness: 0.02 }),
  );

  // Warm conservatory pendant hung from the ridge (cord reaches into the bulb)
  const pendantCord = new THREE.Mesh(cylAt(0.014, 0.014, 1.45, 0, 4.045, 0), ironMat);
  const warmBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 10),
    new THREE.MeshStandardMaterial({
      color: '#FFF1BD',
      emissive: '#FFB347',
      emissiveIntensity: 0.4,
      roughness: 0.2,
    }),
  );
  warmBulb.position.set(0, 3.35, 0);
  windowMaterials.push(warmBulb.material);
  group.add(pendantCord, warmBulb);

  // ---------------------------------------------------------------------
  // 5. Gardener's yard (all inside the reserved plot, off the door approach)
  // ---------------------------------------------------------------------
  // Staging shelf against the south dwarf wall: seed trays, pots, copper can
  const staging = new THREE.Group();
  staging.position.set(1.0, 0, 3.05);
  addStaticContactShadow(staging, shadowTex, 2.0, 0.9, 0.4, 0.018);
  const stagingWood: THREE.BufferGeometry[] = [
    boxAt(1.7, 0.07, 0.5, 0, 0.78, 0),
    boxAt(0.08, 0.74, 0.08, -0.75, 0.39, -0.18),
    boxAt(0.08, 0.74, 0.08, 0.75, 0.39, -0.18),
    boxAt(0.08, 0.74, 0.08, -0.75, 0.39, 0.18),
    boxAt(0.08, 0.74, 0.08, 0.75, 0.39, 0.18),
    boxAt(1.5, 0.05, 0.42, 0, 0.28, 0),
  ];
  const stagingWoodMesh = new THREE.Mesh(mergeGeometries(stagingWood, false)!, cedarMat);
  stagingWoodMesh.castShadow = true;
  staging.add(stagingWoodMesh);
  const stagingPotGeos: THREE.BufferGeometry[] = [];
  for (const px of [-0.55, -0.25, 0.5]) stagingPotGeos.push(cylAt(0.13, 0.1, 0.2, px, 0.92, -0.08, 0, 0, 9));
  const stagingPotsMesh = new THREE.Mesh(mergeGeometries(stagingPotGeos, false)!, potMat);
  stagingPotsMesh.castShadow = true;
  staging.add(stagingPotsMesh);
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.28), cedarDarkMat);
  tray.position.set(0.12, 0.86, 0.1);
  staging.add(tray);
  const trayCells: THREE.BufferGeometry[] = [];
  for (let c = 0; c < 4; c++) trayCells.push(boxAt(0.08, 0.05, 0.08, -0.01 + (c % 2) * 0.11, 0.92, 0.05 + Math.floor(c / 2) * 0.1));
  const trayCellsMesh = new THREE.Mesh(mergeGeometries(trayCells, false)!, soilMat);
  staging.add(trayCellsMesh);
  const canBody = new THREE.Mesh(cylAt(0.11, 0.09, 0.2, -0.02, 0.92, -0.16, 0, 0, 9), copperMat);
  const canSpout = new THREE.Mesh(cylAt(0.02, 0.03, 0.2, 0.1, 0.97, -0.16, 0, 0, -0.8), copperMat);
  staging.add(canBody, canSpout);
  group.add(staging);

  // Propped cold frame snug against the east dwarf wall (long axis parallel to
  // the glazing; dark cedar + expressed lid glazing so it reads as glasswork,
  // not a stray cardboard box)
  const coldFrame = new THREE.Group();
  coldFrame.position.set(3.02, 0, 0.4);
  addStaticContactShadow(coldFrame, shadowTex, 1.0, 1.8, 0.38, 0.018);
  const cfBase = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.24, 1.3), cedarDarkMat);
  cfBase.position.y = 0.12;
  cfBase.castShadow = true;
  const cfSoil = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 1.18), soilMat);
  cfSoil.position.y = 0.26;
  coldFrame.add(cfBase, cfSoil);
  const cfLid = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.035, 1.34), glassMat);
  cfLid.position.set(-0.02, 0.44, -0.1);
  cfLid.rotation.x = 0.24;
  coldFrame.add(cfLid);
  const cfLidFrame = new THREE.Group();
  cfLidFrame.position.set(-0.02, 0.44, -0.1);
  cfLidFrame.rotation.x = 0.24;
  const cfBars: THREE.BufferGeometry[] = [
    boxAt(0.6, 0.045, 0.05, 0, 0.02, -0.32),
    boxAt(0.6, 0.045, 0.05, 0, 0.02, 0.22),
    boxAt(0.05, 0.045, 1.3, -0.29, 0.02, 0),
    boxAt(0.05, 0.045, 1.3, 0.29, 0.02, 0),
  ];
  cfLidFrame.add(new THREE.Mesh(mergeGeometries(cfBars, false)!, cedarDarkMat));
  coldFrame.add(cfLidFrame);
  const cfProp = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.04), cedarDarkMat);
  cfProp.position.set(0, 0.32, -0.52);
  cfProp.rotation.x = 0.55;
  coldFrame.add(cfProp);
  const cfTufts: THREE.BufferGeometry[] = [];
  for (const [tx, tz] of [
    [-0.1, -0.4],
    [0.08, -0.1],
    [-0.05, 0.2],
    [0.06, 0.45],
  ] as Array<[number, number]>) {
    const tuft = new THREE.DodecahedronGeometry(0.08, 0);
    tuft.translate(tx, 0.34, tz);
    cfTufts.push(tuft);
  }
  const cfTuftsMesh = new THREE.Mesh(mergeGeometries(cfTufts, false)!, leafMat);
  coldFrame.add(cfTuftsMesh);
  group.add(coldFrame);

  // Tool rack against the north dwarf wall (rake + hoe + hanging copper can)
  const rack = new THREE.Group();
  rack.position.set(2.2, 0, -2.82);
  addStaticContactShadow(rack, shadowTex, 1.1, 0.7, 0.4, 0.018);
  const rackBoard = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.05, 0.06), cedarDarkMat);
  rackBoard.position.y = 0.62;
  rackBoard.castShadow = true;
  rack.add(rackBoard);
  const rackWood: THREE.BufferGeometry[] = [
    boxAt(0.8, 0.05, 0.05, 0, 0.98, 0.06),
    boxAt(0.8, 0.05, 0.05, 0, 0.4, 0.06),
    cylAt(0.025, 0.025, 1.0, -0.22, 0.62, 0.1, 0.12, 0.06),
    cylAt(0.025, 0.025, 1.0, 0.18, 0.62, 0.1, 0.12, -0.08),
  ];
  rack.add(new THREE.Mesh(mergeGeometries(rackWood, false)!, cedarMat));
  const rackIron: THREE.BufferGeometry[] = [
    boxAt(0.3, 0.06, 0.04, -0.14, 0.12, 0.16),
    boxAt(0.16, 0.1, 0.03, 0.28, 0.14, 0.14, 0, 0, 0.3),
  ];
  rack.add(new THREE.Mesh(mergeGeometries(rackIron, false)!, ironMat));
  const hangCan = new THREE.Mesh(cylAt(0.09, 0.07, 0.16, 0.36, 0.86, 0.08, 0, 0, 9), copperMat);
  rack.add(hangCan);
  group.add(rack);

  // Two stone-edged herb beds along the north lawn
  const bedEdges: THREE.BufferGeometry[] = [];
  const bedSoils: THREE.BufferGeometry[] = [];
  const bedTufts: THREE.BufferGeometry[] = [];
  const bedBlooms: THREE.BufferGeometry[] = [];
  for (const bx of [-1.55, 0.9]) {
    bedEdges.push(
      boxAt(1.14, 0.16, 0.09, bx, 0.08, -3.05 - 0.26),
      boxAt(1.14, 0.16, 0.09, bx, 0.08, -3.05 + 0.26),
      boxAt(0.09, 0.16, 0.52, bx - 0.53, 0.08, -3.05),
      boxAt(0.09, 0.16, 0.52, bx + 0.53, 0.08, -3.05),
    );
    bedSoils.push(boxAt(1.02, 0.1, 0.46, bx, 0.09, -3.05));
    for (let t = 0; t < 5; t++) {
      const tuft = new THREE.DodecahedronGeometry(0.09, 0);
      tuft.translate(bx - 0.38 + t * 0.19, 0.18, -3.05 + ((t % 2 === 0 ? 1 : -1) * 0.1));
      bedTufts.push(tuft);
    }
    for (const [ox, oz] of [
      [-0.3, 0.06],
      [0.05, -0.08],
      [0.34, 0.04],
    ] as Array<[number, number]>) {
      const bloom = new THREE.SphereGeometry(0.05, 6, 5);
      bloom.translate(bx + ox, 0.26, -3.05 + oz);
      bedBlooms.push(bloom);
    }
  }
  addMerged(bedEdges, stoneMat, true);
  addMerged(bedSoils, soilMat);
  addMerged(bedTufts, leafMat);
  addMerged(bedBlooms, palette.standard(STORYBOOK_PALETTE.petalMarigold, 0.6, 0.02));

  return group;
}
