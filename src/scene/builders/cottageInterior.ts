import * as THREE from 'three';
import { TimePhase } from '../../game/types';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';
import { addContactShadow } from './vegetation';

/**
 * WALKABLE COTTAGE INTERIOR — Willow Step Cottage (Milestone 3 Build 3)
 *
 * Layout contract (mirrored EXACTLY by src/game/worldMap.ts and enforced by
 * src/scene/cottageInterior.test.ts + src/game/cottageInterior.test.ts):
 *  - Five wall boxes enclose the room and leave a 1.4-wide doorway gap on the
 *    east wall (z 9.3..10.7) aligned with the porch door.
 *  - Furniture boxes/circles give the bed, hearth, bookshelf, kitchenette,
 *    table, stools and porch dressing real collision.
 *  - Three walkable plateaus (entry step 0.24 / porch deck 0.42 / interior
 *    floor 0.46) are feathered in getGroundHeightAt.
 *  - COTTAGE_INTERIOR_ON/OFF_RECTS drive the dollhouse occlusion swap with
 *    hysteresis (roof + body + camera-side walls hide, interior shell shows).
 */

export interface CottageWallBox {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const COTTAGE_WALL_BOXES: readonly CottageWallBox[] = [
  { id: 'cottage_wall_west', minX: -17.65, maxX: -17.25, minZ: 7.55, maxZ: 12.45 },
  { id: 'cottage_wall_north', minX: -17.65, maxX: -12.65, minZ: 7.55, maxZ: 7.95 },
  { id: 'cottage_wall_south', minX: -17.65, maxX: -12.65, minZ: 12.05, maxZ: 12.45 },
  { id: 'cottage_wall_east_north', minX: -13.05, maxX: -12.65, minZ: 7.55, maxZ: 9.3 },
  { id: 'cottage_wall_east_south', minX: -13.05, maxX: -12.65, minZ: 10.7, maxZ: 12.45 },
];

export const COTTAGE_DOOR_GAP = { minZ: 9.3, maxZ: 10.7 } as const;

/** World-space anchor of the porch doorway (door leaf hinge midpoint). */
export const COTTAGE_DOOR_WORLD_POS = { x: -12.85, z: 10.0 } as const;

export const COTTAGE_FURNITURE_BOXES: readonly CottageWallBox[] = [
  { id: 'cottage_bed', minX: -17.2, maxX: -16.1, minZ: 7.95, maxZ: 9.55 },
  { id: 'cottage_hearth', minX: -17.25, maxX: -16.55, minZ: 10.5, maxZ: 12.0 },
  { id: 'cottage_bookshelf', minX: -15.95, maxX: -14.95, minZ: 7.95, maxZ: 8.55 },
  { id: 'cottage_kitchenette', minX: -14.55, maxX: -13.15, minZ: 7.95, maxZ: 8.5 },
  { id: 'cottage_porch_rail_north', minX: -11.45, maxX: -11.05, minZ: 8.0, maxZ: 9.2 },
  { id: 'cottage_porch_rail_south', minX: -11.45, maxX: -11.05, minZ: 10.8, maxZ: 12.0 },
];

export const COTTAGE_FURNITURE_CIRCLES: ReadonlyArray<{
  id: string;
  x: number;
  z: number;
  radius: number;
}> = [
  { id: 'cottage_table', x: -14.35, z: 11.15, radius: 0.52 },
  { id: 'cottage_stool_east', x: -13.8, z: 11.42, radius: 0.24 },
  { id: 'cottage_stool_west', x: -15.1, z: 11.55, radius: 0.24 },
  { id: 'cottage_porch_bench', x: -12.05, z: 11.5, radius: 0.45 },
  { id: 'cottage_porch_pot', x: -12.1, z: 8.55, radius: 0.32 },
];

/** Entry ramp band: lawn at x >= -10.34 rises (smoothstep) to deck height at x <= -11.13. */
export const COTTAGE_STEP_PLATEAU = {
  minX: -11.13,
  maxX: -10.34,
  minZ: 9.125,
  maxZ: 10.875,
  height: 0.42,
} as const;

export const COTTAGE_PORCH_PLATEAU = {
  minX: -12.65,
  maxX: -11.13,
  minZ: 7.8,
  maxZ: 12.2,
  height: 0.42,
} as const;

export const COTTAGE_INTERIOR_PLATEAU = {
  minX: -17.65,
  maxX: -12.65,
  minZ: 7.55,
  maxZ: 12.45,
  height: 0.46,
} as const;

export const COTTAGE_INTERIOR_ON_RECT = {
  minX: -17.65,
  maxX: -10.6,
  minZ: 7.55,
  maxZ: 12.45,
} as const;

export const COTTAGE_INTERIOR_OFF_RECT = {
  minX: -17.95,
  maxX: -10.3,
  minZ: 7.25,
  maxZ: 12.75,
} as const;

export interface WillowCottageInteriorRig {
  /** Everything that must only be visible in interior (dollhouse) mode. */
  interiorOnly: THREE.Group;
  /** Furniture/room dressing that stays visible in both modes (threshold strip). */
  group: THREE.Group;
  emberMat: THREE.MeshStandardMaterial;
  flameMeshes: THREE.Mesh[];
}

export interface WillowCottageInteriorContext {
  palette: MaterialPalette;
  shadowTex: THREE.Texture;
  floorTex: THREE.Texture;
  lanternMaterials: THREE.MeshStandardMaterial[];
}

const FLOOR_TOP = 0.46;

export function buildWillowCottageInterior(
  ctx: WillowCottageInteriorContext,
): WillowCottageInteriorRig {
  const { palette, shadowTex, floorTex, lanternMaterials } = ctx;
  const interiorOnly = new THREE.Group();
  interiorOnly.visible = false;
  interiorOnly.name = 'willow_cottage_interior';

  const plasterMat = palette.standard(STORYBOOK_PALETTE.warmPlaster, 0.86, 0.01);
  const creamTrimMat = palette.standard(STORYBOOK_PALETTE.creamTrim, 0.78, 0.02);
  const cedarDarkMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.76, 0.04);
  const cedarWarmMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.74, 0.04);
  const limestoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.9, 0.02);
  const fieldstoneMat = palette.standard(STORYBOOK_PALETTE.fieldstoneDark, 0.92, 0.02);
  const ceramicMat = palette.standard(STORYBOOK_PALETTE.ceramicCream, 0.38, 0.05);
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.24, 0.86);
  const ironMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.42, 0.72);
  const sageClothMat = palette.standard('#6C8D6F', 0.9, 0.0);
  const terracottaMat = palette.standard(STORYBOOK_PALETTE.terracottaPot, 0.44, 0.04);

  // 1. Raised plank floor (top at y = 0.46, feathered in getGroundHeightAt)
  const floorMat = new THREE.MeshStandardMaterial({
    color: '#FFFFFF',
    map: floorTex,
    roughness: 0.82,
    metalness: 0.02,
  });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.08, 4.9), floorMat);
  floor.position.set(-15.15, FLOOR_TOP - 0.04, 10.0);
  floor.receiveShadow = true;
  interiorOnly.add(floor);

  // Cedar threshold plank marking the doorway line (visible in both modes)
  const threshold = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.06, 1.42),
    cedarDarkMat,
  );
  threshold.position.set(-12.86, FLOOR_TOP - 0.03, 10.0);
  threshold.receiveShadow = true;
  const alwaysGroup = new THREE.Group();
  alwaysGroup.name = 'willow_cottage_interior_threshold';
  alwaysGroup.add(threshold);

  // 2. Dollhouse shell: far walls full height, camera-side (south/east) walls
  //    cut down to low stubs so the SE isometric camera sees straight in.
  const wallH = 2.43;
  const westSlab = new THREE.Mesh(new THREE.BoxGeometry(0.42, wallH, 4.9), plasterMat);
  westSlab.position.set(-17.44, FLOOR_TOP + wallH / 2, 10.0);
  westSlab.castShadow = true;
  westSlab.receiveShadow = true;
  interiorOnly.add(westSlab);

  const northSlab = new THREE.Mesh(new THREE.BoxGeometry(5.0, wallH, 0.42), plasterMat);
  northSlab.position.set(-15.15, FLOOR_TOP + wallH / 2, 7.76);
  northSlab.castShadow = true;
  northSlab.receiveShadow = true;
  interiorOnly.add(northSlab);

  const stubH = 0.55;
  const southStub = new THREE.Mesh(new THREE.BoxGeometry(5.0, stubH, 0.42), plasterMat);
  southStub.position.set(-15.15, FLOOR_TOP + stubH / 2, 12.26);
  southStub.receiveShadow = true;
  interiorOnly.add(southStub);

  const eastStubN = new THREE.Mesh(new THREE.BoxGeometry(0.42, stubH, 1.75), plasterMat);
  eastStubN.position.set(-12.86, FLOOR_TOP + stubH / 2, 8.425);
  eastStubN.receiveShadow = true;
  interiorOnly.add(eastStubN);

  const eastStubS = new THREE.Mesh(new THREE.BoxGeometry(0.42, stubH, 1.75), plasterMat);
  eastStubS.position.set(-12.86, FLOOR_TOP + stubH / 2, 11.575);
  eastStubS.receiveShadow = true;
  interiorOnly.add(eastStubS);

  // Baseboard trim on the far walls (visual finish where slabs meet the floor)
  const baseWest = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 4.6), cedarDarkMat);
  baseWest.position.set(-17.18, FLOOR_TOP + 0.07, 10.0);
  interiorOnly.add(baseWest);
  const baseNorth = new THREE.Mesh(new THREE.BoxGeometry(4.7, 0.14, 0.1), cedarDarkMat);
  baseNorth.position.set(-15.0, FLOOR_TOP + 0.07, 8.02);
  interiorOnly.add(baseNorth);

  // 3. Bed against the west wall (headboard north) — moss-green quilt
  const bed = new THREE.Group();
  bed.position.set(-16.65, FLOOR_TOP, 8.75);
  for (const [lx, lz] of [[-0.48, -0.72], [0.48, -0.72], [-0.48, 0.72], [0.48, 0.72]] as const) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.09), cedarWarmMat);
    leg.position.set(lx, 0.15, lz);
    bed.add(leg);
  }
  const bedDeck = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.12, 1.56), cedarWarmMat);
  bedDeck.position.y = 0.34;
  bedDeck.castShadow = true;
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.18, 1.46), ceramicMat);
  mattress.position.y = 0.48;
  mattress.castShadow = true;
  const quilt = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.92), sageClothMat);
  quilt.position.set(0, 0.56, 0.24);
  const quiltFold = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.06, 0.2), palette.standard('#5E8062', 0.9, 0));
  quiltFold.position.set(0, 0.6, -0.18);
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.15, 0.36), palette.standard('#F6EEDC', 0.92, 0));
  pillow.position.set(0, 0.62, -0.5);
  pillow.rotation.z = 0.04;
  const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.8, 0.1), cedarWarmMat);
  headboard.position.set(0, 0.5, -0.76);
  headboard.castShadow = true;
  bed.add(bedDeck, mattress, quilt, quiltFold, pillow, headboard);
  interiorOnly.add(bed);
  addContactShadow(bed, shadowTex, 1.5, 2.0, 0.4, 0.02);

  // 4. Fieldstone hearth beneath the (hidden-when-inside) chimney flue
  const hearth = new THREE.Group();
  hearth.position.set(-16.9, FLOOR_TOP, 11.25);
  const hearthFoot = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.16, 1.5), fieldstoneMat);
  hearthFoot.position.y = 0.08;
  hearthFoot.receiveShadow = true;
  const hearthBody = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.42, 1.36), limestoneMat);
  hearthBody.position.set(-0.08, 0.86, 0);
  hearthBody.castShadow = true;
  const firebox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.62, 0.86), palette.standard('#2E2520', 0.95, 0));
  firebox.position.set(0.2, 0.5, 0);
  const emberMat = new THREE.MeshStandardMaterial({
    color: '#4A2C1A',
    emissive: new THREE.Color('#FF7A2E'),
    emissiveIntensity: 0.7,
    roughness: 0.9,
    metalness: 0.0,
  });
  const emberBed = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.8), emberMat);
  emberBed.position.set(0.24, 0.24, 0);
  const flameMeshes: THREE.Mesh[] = [];
  const flameMat = new THREE.MeshStandardMaterial({
    color: '#FFC96B',
    emissive: new THREE.Color('#FF9E3D'),
    emissiveIntensity: 1.4,
    transparent: true,
    opacity: 0.85,
    roughness: 0.5,
  });
  for (let i = 0; i < 3; i++) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.2, 6), flameMat);
    flame.position.set(0.26, 0.38, -0.22 + i * 0.22);
    flame.userData.flamePhase = i * 1.7;
    flameMeshes.push(flame);
    hearth.add(flame);
  }
  const logA = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), cedarDarkMat);
  logA.rotation.x = Math.PI / 2;
  logA.position.set(0.24, 0.31, 0.05);
  const logB = logA.clone();
  logB.position.z = -0.14;
  logB.position.y = 0.36;
  const mantel = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.09, 1.5), cedarDarkMat);
  mantel.position.set(-0.06, 1.6, 0);
  mantel.castShadow = true;
  // Mantel vignette: brass kettle, tiny framed postcard, keepsake jar
  const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), brassMat);
  kettle.position.set(-0.08, 1.78, 0.45);
  kettle.scale.set(1, 0.82, 1);
  const kettleSpout = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.16, 6), brassMat);
  kettleSpout.position.set(0.05, 1.8, 0.45);
  kettleSpout.rotation.z = 0.9;
  const kettleHandle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 5, 10), ironMat);
  kettleHandle.position.set(-0.08, 1.9, 0.45);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.24, 0.2), cedarDarkMat);
  frame.position.set(-0.1, 1.82, -0.4);
  const framePhoto = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.17, 0.13), palette.standard('#EAD9B7', 0.9, 0));
  framePhoto.position.set(-0.095, 1.82, -0.4);
  const keepsakeJar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.2, 8), ceramicMat);
  keepsakeJar.position.set(-0.08, 1.76, -0.1);
  hearth.add(
    hearthFoot,
    hearthBody,
    firebox,
    emberBed,
    logA,
    logB,
    mantel,
    kettle,
    kettleSpout,
    kettleHandle,
    frame,
    framePhoto,
    keepsakeJar,
  );
  interiorOnly.add(hearth);
  addContactShadow(hearth, shadowTex, 1.2, 1.9, 0.4, 0.02);

  // Firewood basket beside the hearth
  const basket = new THREE.Group();
  basket.position.set(-16.85, FLOOR_TOP, 10.15);
  const basketBody = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.24, 8), terracottaMat);
  basketBody.position.y = 0.12;
  const basketLog = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 6), cedarWarmMat);
  basketLog.rotation.z = Math.PI / 2;
  basketLog.rotation.y = 0.5;
  basketLog.position.y = 0.26;
  basket.add(basketBody, basketLog);
  interiorOnly.add(basket);

  // 5. Round cedar table + stools (SE quadrant of the room)
  const table = new THREE.Group();
  table.position.set(-14.35, FLOOR_TOP, 11.15);
  const tabletop = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.07, 14), cedarWarmMat);
  tabletop.position.y = 0.78;
  tabletop.castShadow = true;
  const tablePedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.68, 8), cedarDarkMat);
  tablePedestal.position.y = 0.41;
  const tableBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.08, 10), cedarDarkMat);
  tableBase.position.y = 0.04;
  const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.2, 8), ceramicMat);
  vase.position.y = 0.92;
  const bloom = new THREE.Group();
  bloom.position.set(0, 1.0, 0);
  const bloomStem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 4), sageClothMat);
  bloomStem.position.y = 0.08;
  const bloomHead = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06, 0), palette.standard(STORYBOOK_PALETTE.petalMarigold, 0.62, 0.02));
  bloomHead.position.y = 0.2;
  bloom.add(bloomStem, bloomHead);
  const journal = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.17), palette.standard('#EFE3C8', 0.9, 0));
  journal.position.set(-0.22, 0.83, 0.12);
  journal.rotation.y = 0.4;
  const journalPage = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.012, 0.15), palette.standard('#FAF6EA', 0.92, 0));
  journalPage.position.set(-0.22, 0.845, 0.12);
  journalPage.rotation.y = 0.44;
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.09, 8), ceramicMat);
  mug.position.set(0.2, 0.87, -0.18);
  table.add(tabletop, tablePedestal, tableBase, vase, bloom, journal, journalPage, mug);
  interiorOnly.add(table);
  addContactShadow(table, shadowTex, 1.3, 1.3, 0.38, 0.02);

  const makeStool = (x: number, z: number, rot: number) => {
    const stool = new THREE.Group();
    stool.position.set(x, FLOOR_TOP, z);
    stool.rotation.y = rot;
    const seatPost = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.19, 0.4, 8), cedarWarmMat);
    seatPost.position.y = 0.2;
    seatPost.castShadow = true;
    const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 10), sageClothMat);
    cushion.position.y = 0.43;
    stool.add(seatPost, cushion);
    interiorOnly.add(stool);
    addContactShadow(stool, shadowTex, 0.55, 0.55, 0.34, 0.02);
  };
  makeStool(-13.8, 11.42, 0.4);
  makeStool(-15.1, 11.55, -0.7);

  // Woven rug anchoring the table corner
  const rugBase = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.05, 0.022, 22),
    palette.standard('#B46A48', 0.95, 0),
  );
  rugBase.position.set(-14.5, FLOOR_TOP + 0.012, 10.9);
  rugBase.receiveShadow = true;
  const rugInner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.68, 0.68, 0.024, 20),
    palette.standard('#C79A6A', 0.94, 0),
  );
  rugInner.position.set(-14.5, FLOOR_TOP + 0.014, 10.9);
  const rugRing = new THREE.Mesh(
    new THREE.RingGeometry(0.72, 0.82, 22),
    new THREE.MeshBasicMaterial({ color: '#6C8D6F', transparent: true, opacity: 0.75, depthWrite: false }),
  );
  rugRing.rotation.x = -Math.PI / 2;
  rugRing.position.set(-14.5, FLOOR_TOP + 0.027, 10.9);
  interiorOnly.add(rugBase, rugInner, rugRing);

  // 6. Bookshelf on the north wall (west of the kitchenette)
  const shelf = new THREE.Group();
  shelf.position.set(-15.45, FLOOR_TOP, 8.24);
  for (const sx of [-0.5, 0.5]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.5, 0.4), cedarDarkMat);
    side.position.set(sx, 0.75, 0);
    shelf.add(side);
  }
  const shelfBack = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.5, 0.05), cedarDarkMat);
  shelfBack.position.set(0, 0.75, -0.17);
  shelf.add(shelfBack);
  const bookColors = [
    STORYBOOK_PALETTE.petalRose,
    STORYBOOK_PALETTE.petalCornflower,
    STORYBOOK_PALETTE.foliageMid,
    STORYBOOK_PALETTE.petalLavender,
    STORYBOOK_PALETTE.petalMarigold,
  ];
  const shelfLevels = [0.52, 0.95, 1.38];
  for (let lv = 0; lv < shelfLevels.length; lv++) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.4), cedarWarmMat);
    board.position.set(0, shelfLevels[lv], 0);
    shelf.add(board);
    const isTopRow = lv === shelfLevels.length - 1;
    const count = isTopRow ? 3 : 6;
    for (let b = 0; b < count; b++) {
      const bh = 0.24 + ((b * 7 + lv * 3) % 3) * 0.035;
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, bh, 0.26),
        palette.standard(bookColors[(b + lv) % bookColors.length], 0.85, 0),
      );
      book.position.set(-0.32 + b * 0.13, shelfLevels[lv] + 0.025 + bh / 2, 0.02);
      if (b === count - 1 && !isTopRow) {
        book.rotation.z = -0.18;
        book.position.y -= 0.015;
      }
      shelf.add(book);
    }
  }
  const shelfJar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.18, 8), terracottaMat);
  shelfJar.position.set(0.28, 1.55, 0.02);
  const shelfPlant = new THREE.Mesh(new THREE.DodecahedronGeometry(0.09, 0), palette.standard(STORYBOOK_PALETTE.foliageMid, 0.86, 0));
  shelfPlant.position.set(-0.3, 1.56, 0.02);
  shelfPlant.scale.set(1.2, 0.75, 1.1);
  shelf.add(shelfJar, shelfPlant);
  interiorOnly.add(shelf);
  addContactShadow(shelf, shadowTex, 1.2, 0.8, 0.36, 0.02);

  // 7. Kitchenette on the north wall (east portion, beside the door)
  const kitchen = new THREE.Group();
  kitchen.position.set(-13.85, FLOOR_TOP, 8.2);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.5, 0.52), cedarWarmMat);
  counter.position.y = 0.25;
  counter.castShadow = true;
  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.05, 0.56), creamTrimMat);
  counterTop.position.y = 0.53;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.08, 0.1, 10), ceramicMat);
  bowl.position.set(-0.4, 0.6, 0.02);
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.2), cedarDarkMat);
  board.position.set(0.1, 0.575, 0.05);
  const boardLoaf = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 7), palette.standard('#C99058', 0.88, 0));
  boardLoaf.position.set(0.1, 0.64, 0.05);
  boardLoaf.scale.set(1.2, 0.6, 0.9);
  const hangingShelf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.045, 0.24), cedarDarkMat);
  hangingShelf.position.set(0, 1.42, -0.05);
  for (const [jx, mat] of [
    [-0.42, terracottaMat],
    [-0.05, ceramicMat],
    [0.34, sageClothMat],
  ] as const) {
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.16, 8), mat);
    jar.position.set(jx, 1.53, -0.05);
    kitchen.add(jar);
  }
  const kettleArm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 6), ironMat);
  kettleArm.position.set(0.55, 1.2, -0.05);
  const kitchenKettle = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), brassMat);
  kitchenKettle.position.set(0.55, 1.02, -0.05);
  kitchenKettle.scale.set(1, 0.8, 1);
  kitchen.add(counter, counterTop, bowl, board, boardLoaf, hangingShelf, kettleArm, kitchenKettle);
  interiorOnly.add(kitchen);
  addContactShadow(kitchen, shadowTex, 1.6, 0.8, 0.36, 0.02);

  // 8. West-wall dressing: keepsake shelf + pinned postcards
  const westShelf = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.7), cedarWarmMat);
  westShelf.position.set(-17.32, 1.58, 9.95);
  const westShelfBook = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.08), palette.standard(STORYBOOK_PALETTE.petalCornflower, 0.85, 0));
  westShelfBook.position.set(-17.3, 1.71, 9.78);
  const westShelfJar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.14, 8), ceramicMat);
  westShelfJar.position.set(-17.3, 1.68, 10.12);
  interiorOnly.add(westShelf, westShelfBook, westShelfJar);
  for (const [pz, rot, stampHex] of [
    [9.62, 0.06, '#C86446'],
    [10.28, -0.08, '#5E8062'],
  ] as const) {
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.21, 0.16), palette.standard('#F4E9D2', 0.9, 0));
    card.position.set(-17.22, 1.98, pz);
    card.rotation.x = rot;
    const stamp = new THREE.Mesh(new THREE.BoxGeometry(0.021, 0.07, 0.06), palette.standard(stampHex, 0.8, 0));
    stamp.position.set(-17.21, 2.03, pz);
    stamp.rotation.x = rot;
    interiorOnly.add(card, stamp);
  }

  // 9. Brass sconce by the door (north wall east end) — dusk glow via lanternMaterials
  const sconceMat = new THREE.MeshStandardMaterial({
    color: '#FFE9AF',
    emissive: new THREE.Color('#FFAB3B'),
    emissiveIntensity: 0.25,
    roughness: 0.18,
    metalness: 0.05,
  });
  lanternMaterials.push(sconceMat);
  const sconcePlate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.04), ironMat);
  sconcePlate.position.set(-13.35, 1.8, 8.0);
  const sconceGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.14, 6), sconceMat);
  sconceGlass.position.set(-13.33, 1.72, 8.03);
  const sconceCap = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.07, 6), ironMat);
  sconceCap.position.set(-13.33, 1.83, 8.03);
  interiorOnly.add(sconcePlate, sconceGlass, sconceCap);

  // 10. Soft contact shadows under the room's walking line (console-warm depth)
  addContactShadow(interiorOnly, shadowTex, 4.4, 4.3, 0.22, FLOOR_TOP + 0.008);

  return {
    interiorOnly,
    group: alwaysGroup,
    emberMat,
    flameMeshes,
  };
}

const DOOR_OPEN_ANGLE = -1.82;
const DOOR_CLOSED_ANGLE = 0;

export interface WillowCottageInteriorMotionOpts {
  playerX: number;
  playerZ: number;
  phase: TimePhase;
  interiorMode: boolean;
  elapsed: number;
  dt: number;
}

let emberGlow = 0.7;
let doorSwingCurrent = 0;

/**
 * Per-tick interior life: hearth ember flicker (phase-aware), flame dance, and
 * the porch door swing (opens proactively when the player nears or is inside).
 * Zero allocations; damp-only state so it stays smooth across mode swaps.
 */
export function updateWillowCottageInteriorMotion(
  rig: WillowCottageInteriorRig,
  doorPivot: THREE.Object3D | null,
  opts: WillowCottageInteriorMotionOpts,
): void {
  const { phase, elapsed, dt } = opts;

  // Ember glow: day embers smolder, golden hour breathes, dusk roars gently
  const emberTarget = phase === 'dusk' ? 1.6 : phase === 'golden' ? 1.15 : 0.7;
  emberGlow = THREE.MathUtils.damp(emberGlow, emberTarget, 2.2, dt);
  const flicker = 0.86 + Math.sin(elapsed * 7.3) * 0.09 + Math.sin(elapsed * 3.17 + 1.2) * 0.07;
  rig.emberMat.emissiveIntensity = emberGlow * flicker;
  for (const flame of rig.flameMeshes) {
    const ph = flame.userData.flamePhase as number;
    flame.scale.set(
      0.9 + Math.sin(elapsed * 6.1 + ph) * 0.14,
      0.85 + Math.sin(elapsed * 5.2 + ph * 1.3) * 0.2,
      1,
    );
    flame.rotation.y = Math.sin(elapsed * 2.4 + ph) * 0.2;
  }

  // Door swing: open while the player approaches or occupies the cottage
  if (doorPivot) {
    const distToDoor = Math.hypot(opts.playerX - COTTAGE_DOOR_WORLD_POS.x, opts.playerZ - COTTAGE_DOOR_WORLD_POS.z);
    const doorOpen = opts.interiorMode || distToDoor < 2.6;
    const target = doorOpen ? DOOR_OPEN_ANGLE : DOOR_CLOSED_ANGLE;
    const rate = doorOpen ? 4.6 : 2.6;
    doorSwingCurrent = THREE.MathUtils.damp(doorSwingCurrent, target, rate, dt);
    doorPivot.rotation.y = doorSwingCurrent;
  }
}
