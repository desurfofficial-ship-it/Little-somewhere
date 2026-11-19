import * as THREE from 'three';
import { COTTAGE_INTERACTABLES } from '../../game/cottage';
import { CottageHomeState, TimePhase, WorldState } from '../../game/types';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';
import { addContactShadow } from './vegetation';

type VaseFlowerKey = NonNullable<CottageHomeState['placedFlowerId']>;
type KeepsakeKey =
  | 'willow_zine_copy'
  | 'brass_pocket_bell'
  | 'pond_watercolor_card'
  | 'woven_herb_wreath'
  | 'cedar_music_box';

export interface WillowCottageInteriorRig {
  group: THREE.Group;
  hitProxies: THREE.Mesh[];
  vaseEmptyGroup: THREE.Group;
  vaseFlowers: Record<VaseFlowerKey, THREE.Group>;
  shelfKeepsakes: Record<KeepsakeKey, THREE.Group>;
  kettleSteamPuffs: THREE.Mesh[];
  almanacLampMat: THREE.MeshStandardMaterial;
  update(world: WorldState, phase: TimePhase, elapsed: number): void;
  dispose(): void;
}

/**
 * Willow Step Cottage Interior Cutaway Diorama.
 *
 * Matches `COTTAGE_BOUNDS` (-3.5..3.5 x -2.7..2.7) and the exact furniture footprint of
 * `COTTAGE_INTERIOR_OBSTACLES` & `COTTAGE_INTERACTABLES` in `src/game/cottage.ts`.
 * North and West walls rise to timber eaves with sunlit leaded windows; South and East edges
 * step down to cutaway wainscoting so the isometric camera sees cleanly into every corner.
 */
export function buildWillowCottageInterior(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
): WillowCottageInteriorRig {
  const group = new THREE.Group();
  const ownedGeos: THREE.BufferGeometry[] = [];
  const ownedMats: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    ownedGeos.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    ownedMats.push(m);
    return m;
  };

  // Shared calibrated storybook materials
  const stoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.9, 0.02);
  const darkStoneMat = palette.standard(STORYBOOK_PALETTE.fieldstoneDark, 0.92, 0.02);
  const plasterMat = palette.standard(STORYBOOK_PALETTE.warmPlaster, 0.86, 0.01);
  const creamMat = palette.standard(STORYBOOK_PALETTE.creamTrim, 0.78, 0.02);
  const cedarDarkMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.76, 0.04);
  const cedarWarmMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.72, 0.04);
  const doorMat = palette.standard(STORYBOOK_PALETTE.doorCedar, 0.72, 0.04);
  const floorOakMat = palette.standard('#9C724E', 0.74, 0.03);
  const floorPlankDarkMat = palette.standard('#855F3E', 0.78, 0.03);
  const terracottaMat = palette.standard(STORYBOOK_PALETTE.terracottaPot, 0.62, 0.03);
  const sageMat = palette.standard(STORYBOOK_PALETTE.sageShutter, 0.74, 0.02);
  const ceramicMat = palette.standard(STORYBOOK_PALETTE.ceramicCream, 0.4, 0.04);
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.25, 0.86);
  const ironMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.45, 0.65);
  const copperMat = palette.standard('#C56B45', 0.28, 0.78);
  const linenMat = palette.standard('#F5EEE0', 0.88, 0.0);
  const foliageMat = palette.standard(STORYBOOK_PALETTE.foliageMid, 0.82, 0.0);
  const petalCreamMat = palette.standard(STORYBOOK_PALETTE.petalCream, 0.7, 0.0);
  const petalMarigoldMat = palette.standard(STORYBOOK_PALETTE.petalMarigold, 0.68, 0.0);
  const petalLavenderMat = palette.standard(STORYBOOK_PALETTE.petalLavender, 0.72, 0.0);
  const appleRedMat = palette.standard('#C6493E', 0.46, 0.02);

  // Per-instance dynamic emissive / alpha materials
  const almanacLampMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#FFE9B3',
      emissive: '#FFBE5C',
      emissiveIntensity: 0.35,
      roughness: 0.35,
      metalness: 0.05,
    }),
  );
  const windowGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#DCEFF7',
      emissive: '#FFF0C8',
      emissiveIntensity: 0.45,
      roughness: 0.18,
      metalness: 0.08,
    }),
  );
  const hearthEmberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#E86A33',
      emissive: '#FF7B29',
      emissiveIntensity: 1.45,
      roughness: 0.55,
      metalness: 0.02,
    }),
  );
  const steamMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: '#FAF6EE',
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    }),
  );
  const hitProxyMat = trackMat(
    new THREE.MeshBasicMaterial({
      visible: false,
    }),
  );

  // 1. Foundation Plinth, Plank Floor & Braided Hearth Rug
  const plinth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.35, 0.24, 5.75)), darkStoneMat);
  plinth.position.set(0, -0.15, 0);
  plinth.receiveShadow = true;
  group.add(plinth);

  const floorDeck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.1, 0.06, 5.5)), floorOakMat);
  floorDeck.position.set(0, -0.02, 0);
  floorDeck.receiveShadow = true;
  group.add(floorDeck);

  // Subtle inlaid floor plank seams
  const plankGeo = trackGeo(new THREE.BoxGeometry(6.9, 0.012, 0.04));
  for (let z = -2.2; z <= 2.21; z += 0.55) {
    const seam = new THREE.Mesh(plankGeo, floorPlankDarkMat);
    seam.position.set(0, 0.008, z);
    seam.receiveShadow = true;
    group.add(seam);
  }

  // Braided oval rug in center-west hearth area
  const rugOuter = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.55, 1.58, 0.024, 24)), sageMat);
  rugOuter.scale.set(1.22, 1, 0.85);
  rugOuter.position.set(-0.35, 0.014, -0.25);
  rugOuter.receiveShadow = true;
  const rugMid = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.18, 1.2, 0.028, 24)), terracottaMat);
  rugMid.scale.set(1.2, 1, 0.82);
  rugMid.position.set(-0.35, 0.016, -0.25);
  rugMid.receiveShadow = true;
  const rugCenter = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.75, 0.77, 0.032, 24)), linenMat);
  rugCenter.scale.set(1.18, 1, 0.8);
  rugCenter.position.set(-0.35, 0.018, -0.25);
  rugCenter.receiveShadow = true;
  group.add(rugOuter, rugMid, rugCenter);

  // 2. Cutaway Walls (Full North & West walls, low stepped East & South curbs)
  const northWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.3, 2.75, 0.18)), plasterMat);
  northWall.position.set(0, 1.375, -2.79);
  northWall.receiveShadow = true;
  northWall.castShadow = true;
  const northWainscot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.24, 0.92, 0.21)), cedarWarmMat);
  northWainscot.position.set(0, 0.46, -2.78);
  const northCrown = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.36, 0.14, 0.24)), cedarDarkMat);
  northCrown.position.set(0, 2.75, -2.79);
  group.add(northWall, northWainscot, northCrown);

  // West wall split cleanly around the sunlit sill window at z = 0
  const westWallNorth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 2.75, 2.15)), plasterMat);
  westWallNorth.position.set(-3.59, 1.375, -1.8);
  westWallNorth.receiveShadow = true;
  const westWallSouth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 2.75, 2.15)), plasterMat);
  westWallSouth.position.set(-3.59, 1.375, 1.8);
  westWallSouth.receiveShadow = true;
  const westWallBelow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.95, 1.55)), plasterMat);
  westWallBelow.position.set(-3.59, 0.475, 0);
  const westWallAbove = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.65, 1.55)), plasterMat);
  westWallAbove.position.set(-3.59, 2.425, 0);
  const westWainscot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.21, 0.92, 5.64)), cedarWarmMat);
  westWainscot.position.set(-3.58, 0.46, 0);
  const westCrown = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.14, 5.72)), cedarDarkMat);
  westCrown.position.set(-3.59, 2.75, 0);
  group.add(westWallNorth, westWallSouth, westWallBelow, westWallAbove, westWainscot, westCrown);

  // West sunlit window frame + glass + muntins + sill
  const westGlass = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 1.12, 1.4)), windowGlassMat);
  westGlass.position.set(-3.57, 1.52, 0);
  const westSill = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.08, 1.66)), cedarDarkMat);
  westSill.position.set(-3.5, 0.94, 0);
  const westMullionV = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 1.14, 0.06)), creamMat);
  westMullionV.position.set(-3.55, 1.52, 0);
  const westMullionH = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.06, 1.42)), creamMat);
  westMullionH.position.set(-3.55, 1.52, 0);
  group.add(westGlass, westSill, westMullionV, westMullionH);

  // Low cutaway East curb + Porch Door frame at z = 0
  const eastCurbNorth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.42, 2.05)), cedarWarmMat);
  eastCurbNorth.position.set(3.59, 0.21, -1.82);
  const eastCurbSouth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.42, 2.05)), cedarWarmMat);
  eastCurbSouth.position.set(3.59, 0.21, 1.82);
  const southCurb = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.3, 0.36, 0.18)), cedarWarmMat);
  southCurb.position.set(0, 0.18, 2.79);
  const southCap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(7.34, 0.06, 0.22)), cedarDarkMat);
  southCap.position.set(0, 0.38, 2.79);
  group.add(eastCurbNorth, eastCurbSouth, southCurb, southCap);

  // Overhead north-west ceiling rafters (keep max.y <= 3.35)
  for (const rx of [-2.4, 0.0, 2.2]) {
    const beam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.16, 1.85)), cedarDarkMat);
    beam.position.set(rx, 2.68, -1.88);
    group.add(beam);
  }

  // 3. Furniture & Interactive Stations (exact COTTAGE_INTERIOR_OBSTACLES placement)

  // A. Kettle & Stone Hearth (cottage_hearth: x=-3.45..-0.95, z=-2.68..-1.68, focus=(-2.15, -2.2))
  const hearthGroup = new THREE.Group();
  hearthGroup.position.set(-2.2, 0, -2.2);
  addContactShadow(hearthGroup, shadowTex, 2.5, 1.35, 0.35, 0.022);
  const hearthSlab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.35, 0.22, 0.96)), darkStoneMat);
  hearthSlab.position.set(0, 0.11, 0.02);
  const chimneyBase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.56, 1.38, 0.86)), stoneMat);
  chimneyBase.position.set(0, 0.8, -0.06);
  const chimneyFlue = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.06, 1.65, 0.64)), stoneMat);
  chimneyFlue.position.set(0, 2.3, -0.15);
  const mantle = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.76, 0.12, 0.98)), cedarDarkMat);
  mantle.position.set(0, 1.52, 0.0);
  const firebox = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.84, 0.66, 0.42)), ironMat);
  firebox.position.set(0, 0.56, 0.22);
  const embers = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(0.24, 0)), hearthEmberMat);
  embers.scale.set(1.35, 0.42, 0.72);
  embers.position.set(0, 0.34, 0.32);

  // Side counter beside firebox for baking dough & spices
  const counterBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.72, 0.76, 0.82)), cedarWarmMat);
  counterBody.position.set(1.08, 0.48, 0.02);
  const counterTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.78, 0.08, 0.88)), creamMat);
  counterTop.position.set(1.08, 0.88, 0.02);

  // Copper kettle on trivet + 3 pooled rising steam puffs
  const kettleBody = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.17, 12, 10)), copperMat);
  kettleBody.scale.set(1.0, 0.82, 1.0);
  kettleBody.position.set(0.06, 0.48, 0.34);
  const kettleLid = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.09, 0.05, 10)), brassMat);
  kettleLid.position.set(0.06, 0.62, 0.34);
  const kettleHandle = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.14, 0.018, 6, 12, Math.PI)), ironMat);
  kettleHandle.position.set(0.06, 0.58, 0.34);
  hearthGroup.add(
    hearthSlab,
    chimneyBase,
    chimneyFlue,
    mantle,
    firebox,
    embers,
    counterBody,
    counterTop,
    kettleBody,
    kettleLid,
    kettleHandle,
  );

  const kettleSteamPuffs: THREE.Mesh[] = [];
  const puffGeo = trackGeo(new THREE.SphereGeometry(0.065, 8, 6));
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(puffGeo, steamMat);
    puff.position.set(0.06, 0.75 + i * 0.16, 0.34);
    puff.visible = false;
    hearthGroup.add(puff);
    kettleSteamPuffs.push(puff);
  }
  group.add(hearthGroup);

  // B. Patchwork Quilt Bed (cottage_bed: x=-3.42..-1.55, z=0.85..2.55, focus=(-2.4, 1.7))
  const bedGroup = new THREE.Group();
  bedGroup.position.set(-2.48, 0, 1.7);
  addContactShadow(bedGroup, shadowTex, 2.0, 1.85, 0.35, 0.022);
  const bedFrame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.72, 0.34, 1.54)), cedarDarkMat);
  bedFrame.position.set(0, 0.24, 0);
  const headboard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.96, 1.58)), cedarDarkMat);
  headboard.position.set(-0.84, 0.54, 0);
  const mattress = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.56, 0.18, 1.4)), linenMat);
  mattress.position.set(0.02, 0.47, 0);
  const quilt = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.12, 0.2, 1.44)), terracottaMat);
  quilt.position.set(0.24, 0.49, 0);
  const quiltStripe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.21, 1.45)), sageMat);
  quiltStripe.position.set(-0.08, 0.495, 0);
  const pillowA = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.14, 0.56)), linenMat);
  pillowA.position.set(-0.54, 0.6, -0.34);
  pillowA.rotation.z = -0.12;
  const pillowB = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.14, 0.56)), linenMat);
  pillowB.position.set(-0.54, 0.6, 0.34);
  pillowB.rotation.z = -0.12;
  bedGroup.add(bedFrame, headboard, mattress, quilt, quiltStripe, pillowA, pillowB);
  group.add(bedGroup);

  // C. Oak Table & Vase (cottage_table: x=-0.45..0.95, z=0.35..1.65, focus=(0.25, 1.0))
  const tableGroup = new THREE.Group();
  tableGroup.position.set(0.25, 0, 1.0);
  addContactShadow(tableGroup, shadowTex, 1.55, 1.45, 0.32, 0.022);
  const tableTop = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.64, 0.64, 0.08, 20)), cedarWarmMat);
  tableTop.position.set(0, 0.72, 0);
  const tablePedestal = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.11, 0.16, 0.66, 10)), cedarDarkMat);
  tablePedestal.position.set(0, 0.36, 0);
  const tableFoot = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.36, 0.42, 0.08, 12)), cedarDarkMat);
  tableFoot.position.set(0, 0.04, 0);
  const tableRunner = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, 0.015, 1.06)), linenMat);
  tableRunner.position.set(0, 0.766, 0);

  // Ceramic stoneware pitcher body
  const pitcherBody = new THREE.Mesh(
    trackGeo(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.0, 0.0),
          new THREE.Vector2(0.11, 0.0),
          new THREE.Vector2(0.145, 0.12),
          new THREE.Vector2(0.095, 0.24),
          new THREE.Vector2(0.115, 0.3),
          new THREE.Vector2(0.092, 0.3),
          new THREE.Vector2(0.078, 0.22),
        ],
        14,
      ),
    ),
    ceramicMat,
  );
  pitcherBody.position.set(0, 0.77, 0);
  tableGroup.add(tableTop, tablePedestal, tableFoot, tableRunner, pitcherBody);

  // Empty-vase indicator (coiled twine collar + dry rim pebble resting beside empty pitcher)
  const vaseEmptyGroup = new THREE.Group();
  vaseEmptyGroup.position.set(0, 0.77, 0);
  const emptyCollar = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.095, 0.014, 6, 14)), cedarWarmMat);
  emptyCollar.rotation.x = Math.PI * 0.5;
  emptyCollar.position.y = 0.25;
  vaseEmptyGroup.add(emptyCollar);
  tableGroup.add(vaseEmptyGroup);

  // Reactive placed flower arrangements
  const makeStem = (x: number, z: number, tiltX: number, tiltZ: number) => {
    const stem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.012, 0.014, 0.26, 6)), foliageMat);
    stem.position.set(x, 0.28, z);
    stem.rotation.set(tiltX, 0, tiltZ);
    return stem;
  };

  const chamomileGroup = new THREE.Group();
  chamomileGroup.position.set(0, 0.77, 0);
  chamomileGroup.visible = false;
  for (const [fx, fz, tx, tz] of [
    [-0.04, 0.03, 0.18, 0.2],
    [0.05, -0.03, -0.15, -0.22],
    [0.0, 0.05, 0.22, -0.06],
    [-0.03, -0.04, -0.18, 0.14],
  ]) {
    chamomileGroup.add(makeStem(fx, fz, tx, tz));
    const head = new THREE.Group();
    head.position.set(fx * 1.9, 0.4, fz * 1.9);
    const center = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.032, 8, 6)), petalMarigoldMat);
    const ring = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.068, 0.055, 0.02, 8)), petalCreamMat);
    head.add(ring, center);
    chamomileGroup.add(head);
  }
  tableGroup.add(chamomileGroup);

  const lavenderGroup = new THREE.Group();
  lavenderGroup.position.set(0, 0.77, 0);
  lavenderGroup.visible = false;
  for (const [fx, fz, tx, tz] of [
    [-0.04, 0.02, 0.15, 0.22],
    [0.04, -0.02, -0.16, -0.2],
    [0.0, 0.04, 0.2, 0.0],
    [0.01, -0.05, -0.2, 0.12],
  ]) {
    lavenderGroup.add(makeStem(fx, fz, tx, tz));
    const spike = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.026, 0.11, 5, 8)), petalLavenderMat);
    spike.position.set(fx * 1.8, 0.42, fz * 1.8);
    spike.rotation.set(tx, 0, tz);
    lavenderGroup.add(spike);
  }
  tableGroup.add(lavenderGroup);

  const crabappleGroup = new THREE.Group();
  crabappleGroup.position.set(0, 0.77, 0);
  crabappleGroup.visible = false;
  for (const [fx, fz, tx, tz] of [
    [-0.04, 0.02, 0.2, 0.18],
    [0.05, -0.02, -0.18, -0.22],
    [0.0, 0.04, 0.14, -0.1],
  ]) {
    const bough = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.014, 0.02, 0.3, 6)), cedarDarkMat);
    bough.position.set(fx, 0.28, fz);
    bough.rotation.set(tx, 0, tz);
    const fruit = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.052, 8, 8)), appleRedMat);
    fruit.position.set(fx * 2.1, 0.39, fz * 2.1);
    const leaf = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.042, 6, 5)), foliageMat);
    leaf.scale.set(1.3, 0.45, 0.8);
    leaf.position.set(fx * 1.6 + 0.03, 0.43, fz * 1.6);
    crabappleGroup.add(bough, fruit, leaf);
  }
  tableGroup.add(crabappleGroup);

  const vaseFlowers: Record<VaseFlowerKey, THREE.Group> = {
    chamomile_blossom: chamomileGroup,
    lavender_sprig: lavenderGroup,
    crabapple: crabappleGroup,
  };
  group.add(tableGroup);

  // D. Keepsake Display Shelf (cottage_shelf: x=0.25..2.35, z=-2.68..-1.88, focus=(1.3, -2.25))
  const shelfGroup = new THREE.Group();
  shelfGroup.position.set(1.3, 0, -2.3);
  addContactShadow(shelfGroup, shadowTex, 2.2, 0.95, 0.32, 0.022);
  const sideboard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.96, 0.78, 0.64)), cedarWarmMat);
  sideboard.position.set(0, 0.41, 0);
  const sideboardTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.06, 0.07, 0.7)), cedarDarkMat);
  sideboardTop.position.set(0, 0.82, 0);
  const upperShelf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.88, 0.07, 0.34)), cedarDarkMat);
  upperShelf.position.set(0, 1.56, -0.2);
  const bracketL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.24, 0.28)), cedarDarkMat);
  bracketL.position.set(-0.74, 1.42, -0.22);
  const bracketR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.24, 0.28)), cedarDarkMat);
  bracketR.position.set(0.74, 1.42, -0.22);
  shelfGroup.add(sideboard, sideboardTop, upperShelf, bracketL, bracketR);

  // 5 reactive Keepsake displays positioned cleanly across upper shelf & sideboard
  const zineGroup = new THREE.Group();
  zineGroup.position.set(-0.62, 1.6, -0.18);
  zineGroup.visible = false;
  const zineCover = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.32, 0.05)), terracottaMat);
  zineCover.position.y = 0.16;
  zineCover.rotation.x = -0.18;
  const zinePages = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.2, 0.28, 0.06)), linenMat);
  zinePages.position.set(0, 0.16, 0.01);
  zinePages.rotation.x = -0.18;
  zineGroup.add(zineCover, zinePages);

  const bellGroup = new THREE.Group();
  bellGroup.position.set(-0.2, 1.6, -0.18);
  bellGroup.visible = false;
  const bellStand = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.1, 0.04, 10)), cedarDarkMat);
  bellStand.position.y = 0.02;
  const bellCone = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.09, 0.18, 12)), brassMat);
  bellCone.position.y = 0.14;
  const bellFinial = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.03, 8, 8)), brassMat);
  bellFinial.position.y = 0.24;
  bellGroup.add(bellStand, bellCone, bellFinial);

  const watercolorGroup = new THREE.Group();
  watercolorGroup.position.set(0.22, 1.6, -0.18);
  watercolorGroup.visible = false;
  const cardFrame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 0.24, 0.04)), cedarWarmMat);
  cardFrame.position.y = 0.12;
  cardFrame.rotation.x = -0.2;
  const cardCanvas = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.22, 0.18, 0.045)),
    palette.standard('#8BBCD1', 0.65, 0.0),
  );
  cardCanvas.position.set(0, 0.12, 0.005);
  cardCanvas.rotation.x = -0.2;
  watercolorGroup.add(cardFrame, cardCanvas);

  const wreathGroup = new THREE.Group();
  wreathGroup.position.set(0.64, 1.76, -0.22);
  wreathGroup.visible = false;
  const wreathRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.14, 0.042, 8, 16)), foliageMat);
  const wreathAccent = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.035, 6, 6)), petalLavenderMat);
  wreathAccent.position.set(0.1, -0.09, 0.04);
  wreathGroup.add(wreathRing, wreathAccent);

  const musicBoxGroup = new THREE.Group();
  musicBoxGroup.position.set(-0.4, 0.86, 0.02);
  musicBoxGroup.visible = false;
  const dishBase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.18, 0.14, 0.08, 14)), cedarDarkMat);
  dishBase.position.y = 0.04;
  const dishTrim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.15, 0.015, 6, 14)), brassMat);
  dishTrim.rotation.x = Math.PI * 0.5;
  dishTrim.position.y = 0.08;
  musicBoxGroup.add(dishBase, dishTrim);

  shelfGroup.add(zineGroup, bellGroup, watercolorGroup, wreathGroup, musicBoxGroup);
  const shelfKeepsakes: Record<KeepsakeKey, THREE.Group> = {
    willow_zine_copy: zineGroup,
    brass_pocket_bell: bellGroup,
    pond_watercolor_card: watercolorGroup,
    woven_herb_wreath: wreathGroup,
    cedar_music_box: musicBoxGroup,
  };
  group.add(shelfGroup);

  // E. Window Almanac Desk (cottage_desk: x=1.35..2.95, z=1.8..2.66, focus=(2.15, 2.2))
  const deskGroup = new THREE.Group();
  deskGroup.position.set(2.15, 0, 2.22);
  addContactShadow(deskGroup, shadowTex, 1.65, 0.95, 0.32, 0.022);
  const deskTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.48, 0.08, 0.78)), cedarWarmMat);
  deskTop.position.set(0, 0.74, 0);
  for (const [lx, lz] of [
    [-0.64, -0.3],
    [0.64, -0.3],
    [-0.64, 0.3],
    [0.64, 0.3],
  ]) {
    const leg = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.09, 0.72, 0.09)), cedarDarkMat);
    leg.position.set(lx, 0.36, lz);
    deskGroup.add(leg);
  }
  const almanacCover = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.46, 0.04, 0.34)), sageMat);
  almanacCover.position.set(-0.16, 0.8, 0.02);
  const almanacPages = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 0.05, 0.3)), linenMat);
  almanacPages.position.set(-0.16, 0.815, 0.02);
  const lampBase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.09, 0.11, 0.05, 10)), brassMat);
  lampBase.position.set(0.44, 0.805, -0.14);
  const lampStem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.022, 0.026, 0.28, 8)), brassMat);
  lampStem.position.set(0.44, 0.96, -0.14);
  const lampShade = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.16, 0.16, 12)), almanacLampMat);
  lampShade.position.set(0.44, 1.14, -0.14);
  deskGroup.add(deskTop, almanacCover, almanacPages, lampBase, lampStem, lampShade);
  group.add(deskGroup);

  // F. Sunlit Sill Planter (cottage_planter: focus=(-3.5, 0.0))
  const planterGroup = new THREE.Group();
  planterGroup.position.set(-3.36, 0.98, 0.0);
  const planterBox = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.2, 1.24)), terracottaMat);
  planterBox.position.y = 0.1;
  planterGroup.add(planterBox);
  for (const pz of [-0.4, 0.0, 0.4]) {
    const mound = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(0.16, 0)), foliageMat);
    mound.scale.set(0.95, 0.7, 1.1);
    mound.position.set(0.02, 0.23, pz);
    const bloom = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.048, 7, 6)), petalCreamMat);
    bloom.position.set(0.03, 0.35, pz + 0.04);
    const bloomCore = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.024, 6, 6)), petalMarigoldMat);
    bloomCore.position.set(0.03, 0.37, pz + 0.04);
    planterGroup.add(mound, bloom, bloomCore);
  }
  group.add(planterGroup);

  // G. Front Porch Doorway (interior_door: focus=(3.45, 0.0))
  const doorGroup = new THREE.Group();
  doorGroup.position.set(3.48, 0, 0);
  const doorMatRug = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.56, 0.025, 1.12)), terracottaMat);
  doorMatRug.position.set(-0.36, 0.015, 0);
  const doorJambN = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 2.25, 0.14)), cedarDarkMat);
  doorJambN.position.set(0.04, 1.125, -0.62);
  const doorJambS = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 2.25, 0.14)), cedarDarkMat);
  doorJambS.position.set(0.04, 1.125, 0.62);
  const doorLintel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.14, 1.44)), cedarDarkMat);
  doorLintel.position.set(0.04, 2.28, 0);
  const doorLeaf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 2.16, 1.08)), doorMat);
  doorLeaf.position.set(0.08, 1.08, 0);
  const doorKnob = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.048, 8, 8)), brassMat);
  doorKnob.position.set(-0.01, 1.02, 0.36);
  doorGroup.add(doorMatRug, doorJambN, doorJambS, doorLintel, doorLeaf, doorKnob);
  group.add(doorGroup);

  // 4. Raycast Hit Proxies matching every entry in COTTAGE_INTERACTABLES (7 total)
  const hitProxies: THREE.Mesh[] = [];
  const proxyGeo = trackGeo(new THREE.BoxGeometry(1.15, 1.65, 1.15));
  for (const prop of COTTAGE_INTERACTABLES) {
    const proxy = new THREE.Mesh(proxyGeo, hitProxyMat);
    proxy.position.set(prop.focusX, 0.85, prop.focusZ);
    proxy.userData = {
      targetKind: 'cottage_prop',
      targetId: prop.id,
    };
    group.add(proxy);
    hitProxies.push(proxy);
  }

  function update(world: WorldState, phase: TimePhase, elapsed: number): void {
    const cs = world.cottageState;

    // Placed flower in table vase
    const placed = cs?.placedFlowerId ?? null;
    vaseEmptyGroup.visible = placed === null;
    vaseFlowers.chamomile_blossom.visible = placed === 'chamomile_blossom';
    vaseFlowers.lavender_sprig.visible = placed === 'lavender_sprig';
    vaseFlowers.crabapple.visible = placed === 'crabapple';

    // Shelf keepsakes
    const shown = cs?.displayedKeepsakeIds ?? [];
    for (const key of Object.keys(shelfKeepsakes) as KeepsakeKey[]) {
      shelfKeepsakes[key].visible = shown.includes(key);
    }

    // Warm kettle steam puffs
    const kettleWarm =
      (cs?.kettleWarmUntilMinute ?? 0) > 0 && world.minuteOfDay <= cs.kettleWarmUntilMinute;
    for (let i = 0; i < kettleSteamPuffs.length; i++) {
      const puff = kettleSteamPuffs[i];
      puff.visible = kettleWarm;
      if (kettleWarm) {
        const cycle = (elapsed * 0.65 + i * 0.33) % 1;
        puff.position.y = 0.72 + cycle * 0.56;
        puff.position.x = 0.06 + Math.sin(elapsed * 2.1 + i * 1.4) * 0.035;
        const sc = 0.75 + Math.sin(cycle * Math.PI) * 0.65;
        puff.scale.setScalar(sc);
      }
    }

    // Hearth embers flicker + Almanac lamp & sunlit window warmth
    hearthEmberMat.emissiveIntensity = 1.35 + Math.sin(elapsed * 4.5) * 0.22;
    if (phase === 'dusk') {
      almanacLampMat.emissiveIntensity = 1.65;
      windowGlassMat.emissiveIntensity = 0.28;
    } else if (phase === 'golden') {
      almanacLampMat.emissiveIntensity = 0.95;
      windowGlassMat.emissiveIntensity = 0.75;
    } else {
      almanacLampMat.emissiveIntensity = 0.35;
      windowGlassMat.emissiveIntensity = 0.55;
    }
  }

  function dispose(): void {
    for (const g of ownedGeos) {
      g.dispose();
    }
    for (const m of ownedMats) {
      m.dispose();
    }
  }

  return {
    group,
    hitProxies,
    vaseEmptyGroup,
    vaseFlowers,
    shelfKeepsakes,
    kettleSteamPuffs,
    almanacLampMat,
    update,
    dispose,
  };
}
