import * as THREE from 'three';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';
import { addContactShadow } from './vegetation';

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

    const blooms = new THREE.Group();
    blooms.position.set(0, -0.54, 0.2);
    const leafMat = ctx.palette.standard(STORYBOOK_PALETTE.foliageMid, 0.85, 0.0);
    const flowerColors = [
      STORYBOOK_PALETTE.petalRose,
      STORYBOOK_PALETTE.petalMarigold,
      STORYBOOK_PALETTE.petalLavender,
      STORYBOOK_PALETTE.petalCream,
    ];
    for (let i = -2; i <= 2; i++) {
      const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13, 0), leafMat);
      bush.position.set(i * 0.21, 0, 0);
      blooms.add(bush);
      const petal = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.085, 0),
        ctx.palette.standard(flowerColors[(i + 2) % flowerColors.length], 0.6, 0.02),
      );
      petal.position.set(i * 0.21, 0.1, 0.025);
      blooms.add(petal);
    }
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

  addContactShadow(group, shadowTex, width + 2.4, depth + 2.4, 0.46, 0.018);

  const stoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.9, 0.02);
  const darkStoneMat = palette.standard(STORYBOOK_PALETTE.fieldstoneDark, 0.92, 0.02);
  const wallMat = palette.standard(opts.wallColor, 0.85, 0.01);
  const trimMat = palette.standard(opts.trimColor, 0.74, 0.04);
  const creamTrimMat = palette.standard(STORYBOOK_PALETTE.creamTrim, 0.78, 0.02);
  const shutterMat = palette.standard(STORYBOOK_PALETTE.sageShutter, 0.74, 0.03);
  const potMat = palette.standard(STORYBOOK_PALETTE.terracottaPot, 0.44, 0.04);
  const doorMat = palette.standard(STORYBOOK_PALETTE.doorCedar, 0.7, 0.05);
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.24, 0.86);
  const ironMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.42, 0.72);

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
  });
  windowMaterials.push(winMat);

  const lanternMat = new THREE.MeshStandardMaterial({
    color: '#FFE9AF',
    emissive: new THREE.Color('#FFAB3B'),
    emissiveIntensity: 0.25,
    roughness: 0.18,
    metalness: 0.05,
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

  // 2. Main Lime Plaster Walls
  const body = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, depth), wallMat);
  body.position.y = 0.5 + wallHeight / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

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

  // 5. Chimney Stack + Terracotta Pot
  const [chX, chZ] = opts.chimneyOffset ?? [-halfW * 0.52, -halfD * 0.36];
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.82, 2.0, 0.82), darkStoneMat);
  chimney.position.set(chX, 0.5 + wallHeight + 0.95, chZ);
  chimney.castShadow = true;
  const chimneyRim = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.14, 0.96), stoneMat);
  chimneyRim.position.set(chX, 0.5 + wallHeight + 1.98, chZ);
  const chimneyPot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.34, 8), potMat);
  chimneyPot.position.set(chX, 0.5 + wallHeight + 2.2, chZ);
  group.add(chimney, chimneyRim, chimneyPot);

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
  const { palette } = ctx;
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

  // Window display shelf + golden loaves beside South entrance
  const displayShelf = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.14, 0.42), cedarMat);
  displayShelf.position.set(-2.05, 1.38, 2.76);
  group.add(displayShelf);
  for (let i = 0; i < 3; i++) {
    const loaf = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.18, 4, 6), loafMat);
    loaf.rotation.z = Math.PI / 2;
    loaf.position.set(-2.42 + i * 0.36, 1.54, 2.8);
    group.add(loaf);
  }

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
  const { palette } = ctx;
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

  return group;
}

/**
 * 4. Pinecone Woodshop (Barnaby) at (12.4, 0, 13.0).
 */
export function buildStorybookBarnabyWoodshop(ctx: BuildingBuildContext): THREE.Group {
  const { palette } = ctx;
  const { group } = buildStorybookCottageCore(
    {
      width: 5.6,
      depth: 5.2,
      wallHeight: 2.48,
      wallColor: '#E7D5BD',
      trimColor: STORYBOOK_PALETTE.cedarDark,
      doorSide: 'west',
      roofTex: ctx.sageRoofTex,
      roofCacheKey: 'barnaby_sage_roof',
      chimneyOffset: [1.4, 1.0],
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

  return group;
}

/**
 * 5. Sunbeam Greenhouse (Mina) at (14.3, 0, 1.7) (BOX_OBSTACLES minX:10.8, maxX:17.8, minZ:-1.8, maxZ:5.2).
 */
export function buildStorybookGreenhouse(ctx: BuildingBuildContext): THREE.Group {
  const { palette, shadowTex, windowMaterials } = ctx;
  const group = new THREE.Group();
  group.position.set(14.3, 0, 1.7);

  addContactShadow(group, shadowTex, 7.2, 6.8, 0.42, 0.018);

  const stoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.88, 0.02);
  const darkStoneMat = palette.standard(STORYBOOK_PALETTE.fieldstoneDark, 0.9, 0.02);
  const woodMat = palette.standard('#EAE0CA', 0.72, 0.04);
  const potMat = palette.standard(STORYBOOK_PALETTE.terracottaPot, 0.44, 0.04);
  const leafMat = palette.standard(STORYBOOK_PALETTE.foliageMid, 0.84, 0.0);
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#D2ECEB',
    roughness: 0.12,
    metalness: 0.1,
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
  });

  // Layered stone dwarf wall
  const base = new THREE.Mesh(new THREE.BoxGeometry(5.9, 0.88, 5.5), stoneMat);
  base.position.y = 0.44;
  base.castShadow = true;
  base.receiveShadow = true;
  const sillCap = new THREE.Mesh(new THREE.BoxGeometry(6.08, 0.12, 5.68), darkStoneMat);
  sillCap.position.y = 0.92;
  group.add(base, sillCap);

  // Glass enclosure & pitched glass roof
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

  // Conservatory timber framing ribs & ridge cap
  for (let z = -2.55; z <= 2.56; z += 1.27) {
    const ribL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.34, 0.14), woodMat);
    ribL.position.set(-2.78, 2.1, z);
    const ribR = ribL.clone();
    ribR.position.x = 2.78;
    group.add(ribL, ribR);
  }
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 5.52), woodMat);
  ridge.position.y = 4.82;
  group.add(ridge);

  // West entrance conservatory frame & stone step
  const entryFrame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.35, 1.38), woodMat);
  entryFrame.position.set(-2.85, 1.52, 0);
  const entryStep = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.22, 1.56), stoneMat);
  entryStep.position.set(-3.2, 0.11, 0);
  group.add(entryFrame, entryStep);

  // Interior potting bench, lush potted blooms & warm conservatory pendant
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.24, 3.5), palette.standard('#8C6245', 0.78, 0.03));
  shelf.position.y = 1.15;
  group.add(shelf);

  const potColors = ['#E77C7C', '#F2BE54', '#9E8CE0', '#7BC490', '#F097A5', '#82BBE0'];
  for (let i = 0; i < 6; i++) {
    const px = -1.2 + (i % 3) * 1.2;
    const pz = i < 3 ? -0.85 : 0.85;
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.34, 8), potMat);
    pot.position.set(px, 1.44, pz);
    const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(0.26, 0), leafMat);
    foliage.position.set(px, 1.72, pz);
    const bloom = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.16, 0),
      palette.standard(potColors[i], 0.6, 0.02),
    );
    bloom.position.set(px + 0.08, 1.92, pz);
    group.add(pot, foliage, bloom);
  }

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
  group.add(warmBulb);

  return group;
}
