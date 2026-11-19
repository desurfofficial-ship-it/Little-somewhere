import * as THREE from 'three';
import { COTTAGE_INTERACTABLES, COTTAGE_SEAT_SPOTS } from '../../game/cottage';
import { getSeasonForDay } from '../../game/time';
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
  /** Pass 8: weather-reactive window life — streak group visible only in rain. */
  rainStreaks: THREE.Group;
  /** Pass 8: translucent wet-glass veil material (opacity follows rain/mist). */
  wetGlassVeilMat: THREE.MeshBasicMaterial;
  /** Pass 8: winter-only sill/glass frost wedges. */
  frostDressing: THREE.Group;
  /** Pass 8: shelf clock hand pivots — rotations track minuteOfDay. */
  clockHands: { hour: THREE.Group; minute: THREE.Group };
  /** Pass 8: observation handles — sun-shaft material, mote material, curtain panels. */
  windowShaftMat: THREE.MeshBasicMaterial;
  moteMaterial: THREE.PointsMaterial;
  curtainPanels: { north: THREE.Mesh; south: THREE.Mesh };
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
  // Warm pendant-lantern shade — glows toward dusk so the room's center stays alive
  const pendantLampMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#FFE4AE',
      emissive: '#FFC470',
      emissiveIntensity: 0.2,
      roughness: 0.4,
      metalness: 0.04,
    }),
  );
  const hitProxyMat = trackMat(
    new THREE.MeshBasicMaterial({
      visible: false,
    }),
  );
  // Mantel candle flame — dusk-emissive, flicker shared with the ember curve
  const mantelFlameMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#FFD27F',
      emissive: '#FFB050',
      emissiveIntensity: 0.3,
      roughness: 0.5,
      metalness: 0.02,
    }),
  );
  const honeyAmberMat = palette.standard('#D9A441', 0.5, 0.02);
  const strawHatMat = palette.standard('#C9A85C', 0.85, 0.0);
  const teaBrewMat = palette.standard('#B97F4A', 0.6, 0.0);

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

  // H7 (Pass 6). Mantel life: beeswax candle, leaning photo frame, potted sprig
  // (hearthGroup local: mantle top y 1.58, spans x -0.88..0.88, front edge z 0.49)
  const candleHolder = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.045, 0.055, 0.03, 10)), brassMat);
  candleHolder.position.set(-0.44, 1.595, 0.16);
  const candleBody = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.026, 0.028, 0.1, 10)), linenMat);
  candleBody.position.set(-0.44, 1.66, 0.16);
  const candleFlame = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.018, 8, 6)), mantelFlameMat);
  candleFlame.scale.set(0.7, 1.25, 0.7);
  candleFlame.position.set(-0.44, 1.735, 0.16);
  const photoFrame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.17, 0.21, 0.022)), cedarWarmMat);
  photoFrame.position.set(-0.04, 1.665, 0.2);
  photoFrame.rotation.x = -0.16;
  const photoCanvas = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.13, 0.17, 0.026)), petalCreamMat);
  photoCanvas.position.set(-0.04, 1.67, 0.201);
  photoCanvas.rotation.x = -0.16;
  const photoPond = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.09, 0.05, 0.03)), palette.standard('#8BBCD1', 0.65, 0.0));
  photoPond.position.set(-0.04, 1.685, 0.206);
  photoPond.rotation.x = -0.16;
  const mantelPot = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.048, 0.038, 0.075, 10)), terracottaMat);
  mantelPot.position.set(0.44, 1.617, 0.1);
  const mantelSprig = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(0.052, 0)), foliageMat);
  mantelSprig.scale.set(1, 0.8, 1);
  mantelSprig.position.set(0.44, 1.685, 0.1);
  hearthGroup.add(
    candleHolder,
    candleBody,
    candleFlame,
    photoFrame,
    photoCanvas,
    photoPond,
    mantelPot,
    mantelSprig,
  );

  // H8 (Pass 6). Kitchen counter sign-of-use: crock + spoons, bread board + slice, folded cloth
  // (hearthGroup local: counter top surface y 0.96, spans x 0.69..1.47, z -0.42..0.46)
  const crockBody = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.078, 0.092, 0.17, 12)), ceramicMat);
  crockBody.position.set(0.82, 1.045, -0.18);
  const crockRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.078, 0.012, 6, 14)), ceramicMat);
  crockRim.rotation.x = Math.PI * 0.5;
  crockRim.position.set(0.82, 1.128, -0.18);
  for (const [sx, tilt, len] of [
    [-0.03, 0.28, 0.2],
    [0.02, -0.2, 0.16],
  ] as const) {
    const spoon = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.008, 0.007, len, 6)), cedarDarkMat);
    spoon.position.set(0.82 + sx, 1.2, -0.18);
    spoon.rotation.z = tilt;
    hearthGroup.add(spoon);
  }
  const breadBoard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, 0.026, 0.2)), cedarWarmMat);
  breadBoard.position.set(1.18, 0.973, 0.16);
  breadBoard.rotation.y = 0.3;
  const loafSlice = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.072, 0.072, 0.052, 14)), teaBrewMat);
  loafSlice.position.set(1.18, 1.012, 0.16);
  loafSlice.rotation.set(0, 0.3, Math.PI * 0.5);
  loafSlice.scale.set(1, 1, 0.62);
  const linenCloth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.018, 0.18)), linenMat);
  linenCloth.position.set(1.34, 0.969, -0.14);
  linenCloth.rotation.y = -0.22;
  hearthGroup.add(crockBody, crockRim, breadBoard, loafSlice, linenCloth);

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

  // H9 (Pass 6). Tea-for-one statics: honey pot + spoon rest beside the vase
  const honeyPot = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.045, 0.085, 12)), honeyAmberMat);
  honeyPot.position.set(0.3, 0.812, -0.26);
  const honeyLid = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.052, 0.052, 0.02, 12)), cedarDarkMat);
  honeyLid.position.set(0.3, 0.862, -0.26);
  const honeyDipper = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.007, 0.009, 0.14, 6)), cedarWarmMat);
  honeyDipper.position.set(0.36, 0.86, -0.22);
  honeyDipper.rotation.z = 0.5;
  tableGroup.add(honeyPot, honeyLid, honeyDipper);

  // H10 (Pass 5). Reactive tea moment: stoneware teacup + steam wisp visible while the
  // player is seated at a cottage seat (visual-only, derived from posture — no save state)
  const teacupGroup = new THREE.Group();
  teacupGroup.name = 'teacupGroup';
  teacupGroup.position.set(-0.29, 0.762, 0.17);
  teacupGroup.visible = false;
  const cupSaucer = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.095, 0.08, 0.016, 14)), ceramicMat);
  cupSaucer.position.y = 0.008;
  const seatedCupBody = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.05, 0.078, 12)), ceramicMat);
  seatedCupBody.position.y = 0.055;
  const cupTea = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.052, 0.052, 0.012, 12)), teaBrewMat);
  cupTea.position.y = 0.086;
  const seatedCupHandle = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.026, 0.007, 6, 12, Math.PI)), ceramicMat);
  seatedCupHandle.position.set(0.062, 0.055, 0);
  seatedCupHandle.rotation.z = -Math.PI * 0.5;
  teacupGroup.add(cupSaucer, seatedCupBody, cupTea, seatedCupHandle);
  const cupSteamPuffs: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const puff = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.022, 7, 6)), steamMat);
    puff.position.set(0, 0.13 + i * 0.1, 0);
    puff.visible = false;
    teacupGroup.add(puff);
    cupSteamPuffs.push(puff);
  }
  tableGroup.add(teacupGroup);

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

  // H11 (Pass 6). Entry sign-of-use: garden boots in the door recess + wall pegs with a straw hat
  // (door recess spans z -0.62..0.62 at the east curb; pegs live on the north wall plane near the door)
  const bootLeatherMat = palette.standard('#5C3A28', 0.72, 0.04);
  for (const [bx, bz, rot] of [
    [3.14, -0.45, 0.18],
    [3.14, -0.2, -0.12],
  ] as const) {
    const bootShaft = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.17, 0.12)), bootLeatherMat);
    bootShaft.position.set(bx, 0.085, bz);
    bootShaft.rotation.y = rot;
    const bootToe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.055, 0.09)), bootLeatherMat);
    bootToe.position.set(bx - 0.015, 0.027, bz + 0.09);
    bootToe.rotation.y = rot;
    group.add(bootShaft, bootToe);
  }
  const pegA = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.02, 0.024, 0.09, 8)), brassMat);
  pegA.position.set(2.52, 1.36, -2.7);
  pegA.rotation.x = Math.PI * 0.5;
  const pegB = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.02, 0.024, 0.09, 8)), brassMat);
  pegB.position.set(2.78, 1.36, -2.7);
  pegB.rotation.x = Math.PI * 0.5;
  const pegBoard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.44, 0.1, 0.03)), cedarWarmMat);
  pegBoard.position.set(2.65, 1.44, -2.71);
  const hatCrown = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.095, 10, 8)), strawHatMat);
  hatCrown.scale.set(1, 0.55, 1);
  hatCrown.position.set(2.65, 1.38, -2.65);
  const hatBrim = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.15, 0.155, 0.02, 14)), strawHatMat);
  hatBrim.position.set(2.65, 1.365, -2.65);
  hatBrim.rotation.set(0.12, 0, -0.06);
  group.add(pegA, pegB, pegBoard, hatCrown, hatBrim);

  // H. Lived-in dressing (Pass 1 — Everyday Life polish; all inside existing obstacle
  //    footprints or wall planes so COTTAGE_INTERIOR_OBSTACLES stays untouched).

  // H1. Dining stools tucked at the oak table (inside cottage_table footprint)
  const stoolGroupWest = new THREE.Group();
  stoolGroupWest.position.set(-0.62, 0, 0.04);
  const stoolGroupEast = new THREE.Group();
  stoolGroupEast.position.set(0.62, 0, -0.06);
  for (const [stool, tilt] of [
    [stoolGroupWest, 0.09],
    [stoolGroupEast, -0.07],
  ] as const) {
    const seat = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.17, 0.15, 0.07, 12)), cedarWarmMat);
    seat.position.y = 0.42;
    seat.rotation.z = tilt;
    for (const [lx, lz] of [
      [-0.09, -0.09],
      [0.09, -0.09],
      [-0.09, 0.09],
      [0.09, 0.09],
    ]) {
      const leg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.022, 0.018, 0.4, 6)), cedarDarkMat);
      leg.position.set(lx, 0.2, lz);
      stool.add(leg);
    }
    const ring = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.105, 0.012, 5, 12)), cedarDarkMat);
    ring.rotation.x = Math.PI * 0.5;
    ring.position.y = 0.14;
    stool.add(seat, ring);
    tableGroup.add(stool);
  }

  // H2. Linen curtains + brass rod dressing the west sunlit window
  const curtainRod = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 1.98, 8)), brassMat);
  curtainRod.rotation.x = Math.PI * 0.5;
  curtainRod.position.set(-3.53, 2.16, 0);
  group.add(curtainRod);
  const curtainNorth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.07, 1.16, 0.34)), linenMat);
  curtainNorth.position.set(-3.52, 1.5, -0.86);
  curtainNorth.rotation.z = 0.02;
  const curtainSouth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.07, 1.16, 0.34)), linenMat);
  curtainSouth.position.set(-3.52, 1.5, 0.86);
  curtainSouth.rotation.z = -0.02;
  const curtainTieN = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.075, 0.016, 5, 10)), brassMat);
  curtainTieN.position.set(-3.51, 1.28, -0.83);
  curtainTieN.rotation.y = Math.PI * 0.5;
  const curtainTieS = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.075, 0.016, 5, 10)), brassMat);
  curtainTieS.position.set(-3.51, 1.28, 0.83);
  curtainTieS.rotation.y = Math.PI * 0.5;
  group.add(curtainNorth, curtainSouth, curtainTieN, curtainTieS);

  // H3. Framed botanical prints on the north wall (either side of keepsake shelf clock)
  const printFrameA = new THREE.Group();
  printFrameA.position.set(-0.55, 1.72, -2.68);
  const frameA = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, 0.44, 0.045)), cedarWarmMat);
  const canvasA = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.28, 0.38, 0.05)), petalCreamMat);
  const canvasLeafA = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.09, 0.13, 0.052, 7)), foliageMat);
  canvasLeafA.scale.set(0.8, 1, 1);
  canvasLeafA.rotation.x = Math.PI * 0.5;
  canvasLeafA.position.y = -0.02;
  printFrameA.add(frameA, canvasA, canvasLeafA);
  const printFrameB = new THREE.Group();
  printFrameB.position.set(2.52, 1.78, -2.68);
  const frameB = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.3, 0.38, 0.045)), cedarDarkMat);
  const canvasB = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.32, 0.05)), petalLavenderMat);
  printFrameB.add(frameB, canvasB);
  group.add(printFrameA, printFrameB);

  // H4. Round wall clock above the keepsake shelf — hands are pivot groups so
  // rig.update can drive them from the in-game minuteOfDay (Pass 8, EL-17).
  const clockFace = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 18)), creamMat);
  clockFace.rotation.x = Math.PI * 0.5;
  const clockRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.17, 0.02, 6, 18)), brassMat);
  clockRim.position.set(1.3, 2.26, -2.66);
  clockFace.position.set(1.3, 2.26, -2.675);
  const clockHandHourPivot = new THREE.Group();
  clockHandHourPivot.position.set(1.3, 2.26, -2.646);
  const clockHandHour = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.016, 0.09, 0.02)), ironMat);
  clockHandHour.position.y = 0.042;
  clockHandHourPivot.add(clockHandHour);
  const clockHandMinutePivot = new THREE.Group();
  clockHandMinutePivot.position.set(1.3, 2.26, -2.638);
  const clockHandMinute = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.012, 0.13, 0.02)), ironMat);
  clockHandMinute.position.y = 0.062;
  clockHandMinutePivot.add(clockHandMinute);
  const clockPin = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.02, 6, 6)), brassMat);
  clockPin.position.set(1.3, 2.26, -2.63);
  group.add(clockRim, clockFace, clockHandHourPivot, clockHandMinutePivot, clockPin);

  // H5. Dried-herb bundle hanging beside the chimney breast
  const herbBundle = new THREE.Group();
  herbBundle.position.set(-1.28, 1.5, -2.42);
  const herbTwine = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.045, 0.012, 5, 10)), cedarDarkMat);
  for (let hi = 0; hi < 5; hi++) {
    const ha = (hi / 5) * Math.PI * 2;
    const stem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.012, 0.006, 0.24, 5)), hi % 2 === 0 ? sageMat : petalLavenderMat);
    stem.position.set(Math.cos(ha) * 0.035, -0.16, Math.sin(ha) * 0.035);
    stem.rotation.z = Math.cos(ha) * 0.22;
    stem.rotation.x = Math.sin(ha) * 0.22;
    herbBundle.add(stem);
  }
  herbBundle.add(herbTwine);
  group.add(herbBundle);

  // H6. Firewood basket beside the hearth counter (inside cottage_hearth footprint)
  const woodBasket = new THREE.Group();
  woodBasket.position.set(-1.05, 0, -2.06);
  const basketBody = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.17, 0.14, 0.2, 10)), terracottaMat);
  basketBody.position.y = 0.1;
  const basketRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.165, 0.02, 6, 12)), cedarDarkMat);
  basketRim.rotation.x = Math.PI * 0.5;
  basketRim.position.y = 0.2;
  woodBasket.add(basketBody, basketRim);
  for (const [wx, wy, wr, wl] of [
    [-0.04, 0.26, 0.032, 0.3],
    [0.04, 0.27, 0.028, 0.26],
    [0.0, 0.31, 0.026, 0.28],
  ] as const) {
    const log = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(wr, wr, wl, 7)), cedarWarmMat);
    log.rotation.z = Math.PI * 0.5;
    log.rotation.y = wx * 4;
    log.position.set(wx * 1.6, wy, 0);
    woodBasket.add(log);
  }
  group.add(woodBasket);

  // H7. Sideboard life: book stack, teacup, small potted plant
  const bookStack = new THREE.Group();
  bookStack.position.set(0.82, 0.86, 0.04);
  const bookBottom = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.045, 0.17)), sageMat);
  bookBottom.position.y = 0.023;
  const bookMiddle = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.21, 0.04, 0.15)), terracottaMat);
  bookMiddle.position.set(0.01, 0.065, 0.01);
  bookMiddle.rotation.y = 0.18;
  const bookTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.035, 0.13)), linenMat);
  bookTop.position.set(-0.01, 0.103, -0.005);
  bookTop.rotation.y = -0.14;
  bookStack.add(bookBottom, bookMiddle, bookTop);
  const teacup = new THREE.Group();
  teacup.position.set(-0.78, 0.86, 0.06);
  const cupBody = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.038, 0.07, 10)), ceramicMat);
  cupBody.position.y = 0.035;
  const cupHandle = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.026, 0.008, 5, 10, Math.PI)), ceramicMat);
  cupHandle.position.set(0.052, 0.04, 0);
  cupHandle.rotation.z = -Math.PI * 0.5;
  const saucer = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.07, 0.055, 0.018, 12)), ceramicMat);
  saucer.position.y = 0.009;
  teacup.add(cupBody, cupHandle, saucer);
  const sillPot = new THREE.Group();
  sillPot.position.set(0.52, 0.86, -0.16);
  const sillPotBody = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.055, 0.042, 0.09, 9)), terracottaMat);
  sillPotBody.position.y = 0.045;
  const sillPotPlant = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(0.07, 0)), foliageMat);
  sillPotPlant.position.y = 0.14;
  sillPotPlant.scale.set(1, 0.85, 1);
  sillPot.add(sillPotBody, sillPotPlant);
  shelfGroup.add(bookStack, teacup, sillPot);

  // H8. Rolled blanket at the bed foot (inside cottage_bed footprint)
  const bedBlanket = new THREE.Group();
  bedBlanket.position.set(0.42, 0.6, 0.5);
  const blanketRoll = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 0.52, 10)), sageMat);
  blanketRoll.rotation.x = Math.PI * 0.5;
  const blanketBelt = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.092, 0.014, 5, 12)), linenMat);
  blanketBelt.rotation.y = Math.PI * 0.5;
  blanketBelt.position.x = 0.1;
  bedBlanket.add(blanketRoll, blanketBelt);
  bedGroup.add(bedBlanket);

  // H9. Umbrella by the door jamb + scarf peg on the north wall east end
  const umbrella = new THREE.Group();
  umbrella.position.set(3.42, 0, -0.86);
  umbrella.rotation.z = -0.28;
  const umbrellaPole = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.018, 0.018, 0.92, 6)), brassMat);
  umbrellaPole.position.y = 0.46;
  const umbrellaTop = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.14, 0.14, 8)), sageMat);
  umbrellaTop.position.y = 0.98;
  const umbrellaHandle = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.05, 0.014, 5, 9, Math.PI * 1.2)), cedarDarkMat);
  umbrellaHandle.position.set(0, 0.05, 0);
  umbrellaHandle.rotation.y = Math.PI * 0.5;
  umbrella.add(umbrellaPole, umbrellaTop, umbrellaHandle);
  group.add(umbrella);
  const scarfPeg = new THREE.Group();
  scarfPeg.position.set(3.02, 1.72, -2.68);
  const pegPin = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.032, 8, 8)), brassMat);
  const scarfLoop = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.075, 0.03, 6, 12)), terracottaMat);
  scarfLoop.position.set(0.01, -0.05, 0.045);
  const scarfCloth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.11, 0.3, 0.05)), terracottaMat);
  scarfCloth.position.set(0.02, -0.2, 0.05);
  scarfCloth.rotation.z = 0.1;
  const scarfTail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.085, 0.22, 0.045)), linenMat);
  scarfTail.position.set(-0.035, -0.16, 0.02);
  scarfTail.rotation.z = -0.16;
  scarfPeg.add(pegPin, scarfLoop, scarfCloth, scarfTail);
  group.add(scarfPeg);

  // H10. Hanging pendant lantern under the center beam (airborne — no walkability impact)
  const pendantGroup = new THREE.Group();
  pendantGroup.position.set(0.0, 0, -1.32);
  const pendantCord = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5)), ironMat);
  pendantCord.position.y = 2.36;
  const pendantShade = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.13, 0.2, 0.2, 10, 1, true)), pendantLampMat);
  pendantShade.position.y = 2.0;
  const pendantBulb = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.055, 8, 7)), pendantLampMat);
  pendantBulb.position.y = 1.93;
  const pendantRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.035, 0.01, 5, 10)), brassMat);
  pendantRing.position.y = 2.11;
  pendantGroup.add(pendantCord, pendantShade, pendantBulb, pendantRing);
  group.add(pendantGroup);

  // H11. Stronger empty-vase cue: dry stems + a small paper tag on the empty pitcher
  const dryStemA = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.008, 0.01, 0.2, 5)), foliageMat);
  dryStemA.position.set(0.03, 0.36, -0.02);
  dryStemA.rotation.z = -0.18;
  const dryStemB = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.007, 0.009, 0.16, 5)), foliageMat);
  dryStemB.position.set(-0.03, 0.34, 0.02);
  dryStemB.rotation.z = 0.24;
  vaseEmptyGroup.add(dryStemA, dryStemB);
  const vaseTag = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.07, 0.09, 0.012)), linenMat);
  vaseTag.position.set(0.12, 0.12, 0.09);
  vaseTag.rotation.set(0.12, 0.4, -0.14);
  vaseEmptyGroup.add(vaseTag);

  // I. Interior atmosphere layer (Pass 2 — Everyday Life polish)
  //    Hearth point light (no shadows, indoor-only via interiorRoot visibility),
  //    a west-window daylight shaft, and drifting dust motes. All zero-allocation.
  const hearthLight = new THREE.PointLight('#FFB46B', 0, 7.0, 1.7);
  hearthLight.position.set(-1.9, 1.05, -1.75);
  group.add(hearthLight);

  const shaftMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: '#FFF3D0',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const windowShaft = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.3, 2.3)), shaftMat);
  windowShaft.position.set(-2.48, 1.02, 0.02);
  windowShaft.rotation.set(0, Math.PI * 0.5, -0.5);
  group.add(windowShaft);

  const MOTE_COUNT = 34;
  const moteBase = new Float32Array(MOTE_COUNT * 3);
  const moteGeo = trackGeo(new THREE.BufferGeometry());
  {
    const arr = new Float32Array(MOTE_COUNT * 3);
    for (let i = 0; i < MOTE_COUNT; i++) {
      const mx = -3.35 + (i % 6) * 0.34 + ((i * 7) % 5) * 0.045;
      const my = 0.42 + ((i * 13) % 10) * 0.155;
      const mz = -0.55 + ((i * 11) % 9) * 0.132;
      arr[i * 3] = mx;
      arr[i * 3 + 1] = my;
      arr[i * 3 + 2] = mz;
      moteBase[i * 3] = mx;
      moteBase[i * 3 + 1] = my;
      moteBase[i * 3 + 2] = mz;
    }
    moteGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  }
  const moteMat = trackMat(
    new THREE.PointsMaterial({
      color: '#FFF7E0',
      size: 0.055,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  const dustMotes = new THREE.Points(moteGeo, moteMat);
  group.add(dustMotes);

  // J. Weather-reactive window life (Pass 8 — Everyday Life polish round 3).
  //    Rain streaks slide down the west glass in `light_rain`; a translucent cool
  //    veil fogs the pane in rain/mist; winter feathers the sill with frost.
  //    All zero-allocation, driven entirely inside rig.update().
  const rainStreaks = new THREE.Group();
  rainStreaks.visible = false;
  const streakMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: '#D9E9F3',
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    }),
  );
  const streakGeo = trackGeo(new THREE.BoxGeometry(0.02, 0.34, 0.018));
  const rainStreakMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const streak = new THREE.Mesh(streakGeo, streakMat);
    streak.userData.phase = ((i * 17) % 40) / 40;
    streak.position.set(-3.548, 1.6, -0.58 + (i % 10) * 0.13);
    streak.scale.y = i % 3 === 0 ? 1.25 : i % 3 === 1 ? 0.8 : 1;
    rainStreaks.add(streak);
    rainStreakMeshes.push(streak);
  }
  group.add(rainStreaks);

  const wetGlassVeilMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: '#9FB6C4',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  const wetGlassVeil = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.42, 1.16)), wetGlassVeilMat);
  wetGlassVeil.position.set(-3.546, 1.52, 0);
  wetGlassVeil.rotation.y = Math.PI * 0.5;
  group.add(wetGlassVeil);

  const frostDressing = new THREE.Group();
  frostDressing.visible = false;
  const frostMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#F4F8FA',
      roughness: 0.92,
      metalness: 0,
      transparent: true,
      opacity: 0.85,
    }),
  );
  const sillFrost = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.09, 0.022, 1.5)), frostMat);
  sillFrost.position.set(-3.5, 0.985, 0);
  const frostWedgeN = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.17, 0.22)), frostMat);
  frostWedgeN.position.set(-3.55, 1.04, -0.58);
  const frostWedgeS = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.15, 0.18)), frostMat);
  frostWedgeS.position.set(-3.55, 1.03, 0.56);
  const frostWedgeMid = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.04, 0.1, 0.13)), frostMat);
  frostWedgeMid.position.set(-3.55, 1.0, 0.12);
  frostDressing.add(sillFrost, frostWedgeN, frostWedgeS, frostWedgeMid);
  group.add(frostDressing);

  // 4. Raycast Hit Proxies matching every entry in COTTAGE_INTERACTABLES (7 total)
  //    plus the two indoor dining-seat proxies (Pass 5, targetKind 'seat').
  const hitProxies: THREE.Mesh[] = [];
  const proxyGeo = trackGeo(new THREE.BoxGeometry(1.15, 1.65, 1.15));
  // The table proxy hugs the tabletop zone only, so stool-click rays pass under it to the
  // low seat proxies instead of being swallowed by a tall invisible box (Pass 5 fix).
  const tableProxyGeo = trackGeo(new THREE.BoxGeometry(0.98, 0.55, 0.98));
  for (const prop of COTTAGE_INTERACTABLES) {
    const isTable = prop.id === 'cottage_table';
    const proxy = new THREE.Mesh(isTable ? tableProxyGeo : proxyGeo, hitProxyMat);
    proxy.position.set(prop.focusX, isTable ? 1.02 : 0.85, prop.focusZ);
    proxy.userData = {
      targetKind: 'cottage_prop',
      targetId: prop.id,
    };
    group.add(proxy);
    hitProxies.push(proxy);
  }
  // Seat proxies stand over the stool meshes so clicks near the stools resolve to the seat.
  const seatProxyGeo = trackGeo(new THREE.BoxGeometry(0.52, 0.85, 0.52));
  for (const seat of COTTAGE_SEAT_SPOTS) {
    const proxy = new THREE.Mesh(seatProxyGeo, hitProxyMat);
    proxy.position.set(seat.seatPos.x, 0.42, seat.seatPos.z);
    proxy.userData = { targetKind: 'seat', targetId: seat.id };
    group.add(proxy);
    hitProxies.push(proxy);
  }

  function update(world: WorldState, phase: TimePhase, elapsed: number): void {
    const cs = world.cottageState;

    // Pass 8: weather & season resolution (mirrors composeEnvironmentState's
    // effective-weather rule — mist lifts cleanly after 10:30 AM).
    const rawWeather = world.weather ?? 'sunlit';
    const raining = rawWeather === 'light_rain';
    const misting = rawWeather === 'misty_morning' && world.minuteOfDay < 630;
    const breezy = rawWeather === 'breezy';
    const season = world.season ?? getSeasonForDay(world.day).season;

    // Pass 8: the shelf clock reads the actual in-game time (EL-17)
    const minuteAngle = ((world.minuteOfDay % 60) / 60) * Math.PI * 2;
    const hourAngle = (((world.minuteOfDay / 60) % 12) / 12) * Math.PI * 2;
    clockHandMinutePivot.rotation.z = -minuteAngle;
    clockHandHourPivot.rotation.z = -hourAngle;

    // Pass 8: rain streaks slide down the glass; the veil fogs in rain/mist
    rainStreaks.visible = raining;
    if (raining) {
      wetGlassVeilMat.opacity = 0.2;
      for (let i = 0; i < rainStreakMeshes.length; i++) {
        const streak = rainStreakMeshes[i];
        const cyc = (elapsed * 0.85 + (streak.userData.phase as number)) % 1;
        streak.position.y = 2.04 - cyc * 1.08;
      }
    } else {
      wetGlassVeilMat.opacity = misting ? 0.13 : 0;
    }

    // Pass 8: winter frost feathers the sill and glass corners
    frostDressing.visible = season === 'winter';

    // Pass 8: linen curtains stir only in a breeze, easing back to rest otherwise
    const swayAmp = breezy ? 1 : 0;
    curtainNorth.rotation.z = 0.02 + swayAmp * Math.sin(elapsed * 1.35) * 0.02;
    curtainSouth.rotation.z = -0.02 - swayAmp * Math.sin(elapsed * 1.35 + 0.9) * 0.02;

    // Reactive tea moment (Pass 5): teacup + steam wisp while seated at a cottage seat
    const seatedIndoor =
      world.playerPosture === 'sitting' &&
      typeof world.playerSeatId === 'string' &&
      world.playerSeatId.startsWith('cottage_seat_');
    teacupGroup.visible = seatedIndoor;
    for (let i = 0; i < cupSteamPuffs.length; i++) {
      const puff = cupSteamPuffs[i];
      puff.visible = seatedIndoor;
      if (seatedIndoor) {
        const cycle = (elapsed * 0.5 + i * 0.5) % 1;
        puff.position.y = 0.12 + cycle * 0.22;
        puff.position.x = Math.sin(elapsed * 1.7 + i * 2.1) * 0.018;
        puff.scale.setScalar(0.7 + Math.sin(cycle * Math.PI) * 0.6);
      }
    }

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
    // (Pass 8: window glass dims & cools in rain/mist so the pane reads wet)
    const glassWeatherDim = raining ? 0.55 : misting ? 0.72 : 1;
    hearthEmberMat.emissiveIntensity = 1.35 + Math.sin(elapsed * 4.5) * 0.22;
    if (phase === 'dusk') {
      almanacLampMat.emissiveIntensity = 1.65;
      windowGlassMat.emissiveIntensity = 0.28 * glassWeatherDim;
      pendantLampMat.emissiveIntensity = 1.45 + Math.sin(elapsed * 3.1) * 0.12;
      mantelFlameMat.emissiveIntensity = 1.7 + Math.sin(elapsed * 6.3) * 0.18;
    } else if (phase === 'golden') {
      almanacLampMat.emissiveIntensity = 0.95;
      windowGlassMat.emissiveIntensity = 0.75 * glassWeatherDim;
      pendantLampMat.emissiveIntensity = 0.62;
      mantelFlameMat.emissiveIntensity = 0.95 + Math.sin(elapsed * 6.3) * 0.12;
    } else {
      almanacLampMat.emissiveIntensity = 0.35;
      windowGlassMat.emissiveIntensity = 0.55 * glassWeatherDim;
      pendantLampMat.emissiveIntensity = 0.14;
      mantelFlameMat.emissiveIntensity = 0.3;
    }

    // Atmosphere: hearth key light, window daylight shaft, drifting dust motes
    // (Pass 8: the sun shaft is suppressed by rain/mist; motes hush in rain)
    const hearthActive = (cs?.hearthLit ?? true) ? 1 : 0;
    const hearthBase =
      phase === 'dusk' ? 2.7 : phase === 'golden' ? 1.9 : phase === 'afternoon' ? 1.0 : 0.75;
    hearthLight.intensity =
      hearthBase *
      hearthActive *
      (1 + Math.sin(elapsed * 7.0) * 0.09 + Math.sin(elapsed * 12.7) * 0.05);
    const shaftBase =
      phase === 'morning' ? 0.33 : phase === 'afternoon' ? 0.21 : phase === 'golden' ? 0.28 : 0.07;
    const shaftWeatherDim = raining ? 0.22 : misting ? 0.4 : 1;
    shaftMat.opacity = shaftBase * shaftWeatherDim * (0.92 + Math.sin(elapsed * 0.7) * 0.08);
    moteMat.opacity = (phase === 'dusk' ? 0.18 : 0.32) * (raining ? 0.5 : 1);
    const moteArr = moteGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < MOTE_COUNT; i++) {
      const i3 = i * 3;
      moteArr[i3] = moteBase[i3] + Math.sin(elapsed * 0.33 + i * 1.7) * 0.1;
      moteArr[i3 + 1] = moteBase[i3 + 1] + Math.sin(elapsed * 0.5 + i) * 0.12;
      moteArr[i3 + 2] = moteBase[i3 + 2] + Math.cos(elapsed * 0.41 + i * 2.3) * 0.08;
    }
    moteGeo.attributes.position.needsUpdate = true;
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
    rainStreaks,
    wetGlassVeilMat,
    frostDressing,
    clockHands: { hour: clockHandHourPivot, minute: clockHandMinutePivot },
    windowShaftMat: shaftMat,
    moteMaterial: moteMat,
    curtainPanels: { north: curtainNorth, south: curtainSouth },
    update,
    dispose,
  };
}
