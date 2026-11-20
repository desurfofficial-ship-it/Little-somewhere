import * as THREE from 'three';
import { COTTAGE_INTERACTABLES, COTTAGE_SEAT_SPOTS } from '../../game/cottage';

import { getSeasonForDay } from '../../game/time';
import { CottageHomeState, TimePhase, WorldState } from '../../game/types';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';
import { addContactShadow } from './vegetation';

/**
 * Round-4 Pass 13 helpers: allocation-free memory lookups for the rig's per-frame
 * update (no closure allocation — the interior update loop is a zero-GC contract).
 */
function hasMemoryId(
  memories: ReadonlyArray<{ id: string }> | undefined,
  id: string,
): boolean {
  if (!memories) return false;
  for (let i = 0; i < memories.length; i++) {
    if (memories[i].id === id) return true;
  }
  return false;
}

function hasMemoryIdPrefix(
  memories: ReadonlyArray<{ id: string }> | undefined,
  prefix: string,
): boolean {
  if (!memories) return false;
  for (let i = 0; i < memories.length; i++) {
    if (memories[i].id.startsWith(prefix)) return true;
  }
  return false;
}

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
  /**
   * Round-4 Pass 13: progress-derived mementos — the home remembers the life lived
   * around it. Every group is gated on existing persisted WorldState (read-only);
   * no new save fields, no new interactions.
   */
  homeMementos: {
    greenhouseCutting: THREE.Group;
    orchardHoney: THREE.Group;
    bakeryCard: THREE.Group;
    nookBook: THREE.Group;
    teaCaddy: THREE.Group;
  };
  /**
   * Round-4 Pass 14: seasons of home — observation handles for the seasonal sill
   * posies, the door-lintel swag (accent material swaps color per season), and
   * the spring/autumn floor scatter. Visual-only; derived from world.season.
   */
  seasonLife: {
    posySpring: THREE.Group;
    posySummer: THREE.Group;
    posyAutumn: THREE.Group;
    doorSwag: THREE.Group;
    doorSwagAccentMat: THREE.MeshStandardMaterial;
    autumnLeaves: THREE.Group;
    springPetals: THREE.Group;
    /** R5 Pass 16: the hearth wall keeps the seasons (wall-plane dressings). */
    hearthSpring: THREE.Group;
    hearthSummer: THREE.Group;
    hearthAutumn: THREE.Group;
    hearthWinter: THREE.Group;
  };
  /**
   * Pass 21: winter warmth — floor-scale winter textiles and fire reserve that
   * make the cold season read inside the room (knit runner, bed-foot throw,
   * firewood stack). Winter-gated in rig.update; visual-only, zero game-state.
   */
  winterComforts: THREE.Group;
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
  // Round-4 Pass 13: soft glass for the greenhouse cutting jar memento
  const jarGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#DDEFEF',
      transparent: true,
      opacity: 0.42,
      roughness: 0.18,
      metalness: 0.04,
    }),
  );
  const paperCardMat = palette.standard('#F7F1E3', 0.9, 0.0);
  // Round-4 Pass 14: swag accent material — its color follows the season in rig.update
  const doorSwagAccentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#F3E5C6',
      roughness: 0.6,
      metalness: 0.08,
    }),
  );
  /** Season glass/emissive tints + swag accent colors (precomputed, copied — zero alloc). */
  const seasonGlassTints: Record<string, THREE.Color> = {
    spring: new THREE.Color('#FFF6DA'),
    summer: new THREE.Color('#FFE9B0'),
    autumn: new THREE.Color('#FFDFA6'),
    winter: new THREE.Color('#E8F1F7'),
  };
  const seasonSwagAccents: Record<string, THREE.Color> = {
    spring: new THREE.Color('#F7EFD8'),
    summer: new THREE.Color('#B9A3D6'),
    autumn: new THREE.Color('#D97F3E'),
    winter: new THREE.Color('#D9B36A'),
  };

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
  westGlass.name = 'westWindowGlass';
  westGlass.position.set(-3.57, 1.52, 0);
  const westSill = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.32, 0.08, 1.66)), cedarDarkMat);
  westSill.position.set(-3.5, 0.94, 0);
  const westMullionV = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 1.14, 0.06)), creamMat);
  westMullionV.position.set(-3.55, 1.52, 0);
  const westMullionH = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.06, 1.42)), creamMat);
  westMullionH.position.set(-3.55, 1.52, 0);
  group.add(westGlass, westSill, westMullionV, westMullionH);

  // Phase B implied-space architecture (audit §7.3): the one-room contradiction is
  // answered with implied rooms, not more furniture —
  //  a) a CLOSED back-room door on the north wall's free east segment (pantry/store),
  //  b) a loft ladder leaning on the north wall between the chimney breast and the
  //     keepsake shelf, acknowledging the gable volume the exterior promises.
  // Both are wall-mounted visuals: no obstacle, interactable, or bounds change.
  const backDoorFrame = new THREE.Group();
  backDoorFrame.position.set(2.92, 0, -2.7);
  for (const fx of [-0.53, 0.53]) {
    const post = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 2.18, 0.16)), cedarDarkMat);
    post.position.set(fx, 1.09, 0.02);
    backDoorFrame.add(post);
  }
  const backLintel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.2, 0.14, 0.18)), cedarDarkMat);
  backLintel.position.set(0, 2.24, 0.02);
  backDoorFrame.add(backLintel);
  const backLeaf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.96, 1.96, 0.08)), doorMat);
  backLeaf.position.set(0, 0.99, 0.06);
  backLeaf.castShadow = true;
  backDoorFrame.add(backLeaf);
  const backRailGeo = trackGeo(new THREE.BoxGeometry(0.86, 0.09, 0.1));
  for (const ry of [0.5, 1.3]) {
    const rail = new THREE.Mesh(backRailGeo, cedarDarkMat);
    rail.position.set(0, ry, 0.09);
    backDoorFrame.add(rail);
  }
  const backKnob = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.045, 8, 7)), brassMat);
  backKnob.position.set(-0.34, 1.02, 0.12);
  backDoorFrame.add(backKnob);
  const backThreshold = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.1, 0.05, 0.18)), darkStoneMat);
  backThreshold.position.set(0, 0.03, 0.1);
  backDoorFrame.add(backThreshold);
  group.add(backDoorFrame);

  const loftLadder = new THREE.Group();
  loftLadder.position.set(-0.35, 0, -2.52);
  loftLadder.rotation.x = -0.12;
  for (const rx of [-0.22, 0.22]) {
    const rail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.055, 2.5, 0.055)), cedarWarmMat);
    rail.position.set(rx, 1.22, 0);
    loftLadder.add(rail);
  }
  for (let r = 0; r < 5; r++) {
    const rung = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.46, 6)), cedarDarkMat);
    rung.rotation.z = Math.PI / 2;
    rung.position.set(0, 0.32 + r * 0.48, 0);
    loftLadder.add(rung);
  }
  group.add(loftLadder);
  // Woven gathering basket parked at the ladder's foot
  const ladderBasket = new THREE.Group();
  ladderBasket.position.set(0.18, 0, -2.5);
  const ladderBasketBody = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.16, 0.12, 0.22, 9)), strawHatMat);
  ladderBasketBody.position.y = 0.11;
  ladderBasketBody.castShadow = true;
  const ladderBasketRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.155, 0.018, 5, 12)), cedarDarkMat);
  ladderBasketRim.rotation.x = Math.PI / 2;
  ladderBasketRim.position.y = 0.22;
  ladderBasket.add(ladderBasketBody, ladderBasketRim);
  group.add(ladderBasket);

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

  // M2 (Round-4 Pass 13). Clara's recipe card leaning against the flue — appears once
  // the player has kneaded dough beside her (bakeryState.kneadingSessions > 0).
  // (hearthGroup local: mantel top y 1.58, flue front face z 0.17)
  const bakeryCard = new THREE.Group();
  bakeryCard.position.set(0.2, 1.64, 0.19);
  bakeryCard.rotation.x = -0.22;
  bakeryCard.rotation.y = -0.08;
  bakeryCard.visible = false;
  const cardSheet = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.15, 0.11, 0.012)), paperCardMat);
  const cardLineA = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.01, 0.004)), cedarDarkMat);
  cardLineA.position.set(-0.01, 0.03, 0.008);
  const cardLineB = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.01, 0.004)), cedarDarkMat);
  cardLineB.position.set(-0.02, 0.0, 0.008);
  const cardLineC = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 0.01, 0.004)), cedarDarkMat);
  cardLineC.position.set(0.0, -0.03, 0.008);
  bakeryCard.add(cardSheet, cardLineA, cardLineB, cardLineC);
  hearthGroup.add(bakeryCard);

  // R5 (Round-5 Pass 16). The hearth wall keeps the seasons — the chimney breast
  // and mantel change with the calendar so the room's primary anchor reads the
  // same seasonal story the sill posy and door swag already tell. All groups are
  // wall-plane mounted inside existing footprints; visibility gated in rig.update
  // from world.season (visual-only, zero game-state changes):
  //   spring  — first blossom branch in a ceramic jug on the mantel's west end
  //   summer  — a fresh herb bundle hanging from a brass peg on the flue
  //   autumn  — a cedar herb-drying rack with three tied bundles (the harvest kept)
  //   winter  — a knitted hearth sock over the mantel edge + evergreen garland
  const hearthWoolMat = trackMat(palette.standard('#B8544A', 0.95, 0.0));
  const hearthKnitCreamMat = trackMat(palette.standard('#EFE3CE', 0.95, 0.0));

  const hearthSpring = new THREE.Group();
  {
    const jug = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.052, 0.066, 0.13, 10)), ceramicMat);
    jug.position.set(-0.72, 1.645, 0.14);
    const jugLip = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.05, 0.011, 6, 12)), ceramicMat);
    jugLip.rotation.x = Math.PI * 0.5;
    jugLip.position.set(-0.72, 1.712, 0.14);
    hearthSpring.add(jug, jugLip);
    const branch = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.007, 0.009, 0.3, 5)), cedarDarkMat);
    branch.position.set(-0.7, 1.86, 0.14);
    branch.rotation.z = -0.16;
    hearthSpring.add(branch);
    const twig = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.005, 0.007, 0.17, 5)), cedarDarkMat);
    twig.position.set(-0.745, 1.8, 0.14);
    twig.rotation.z = 0.55;
    hearthSpring.add(twig);
    const blossomSpecs: Array<[number, number, number, THREE.Material]> = [
      [-0.66, 1.98, 0.14, petalCreamMat],
      [-0.76, 1.9, 0.14, petalCreamMat],
      [-0.79, 1.83, 0.145, petalCreamMat],
      [-0.63, 1.9, 0.138, petalCreamMat],
    ];
    for (const [bx, by, bz, mat] of blossomSpecs) {
      const bloom = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.03, 7, 6)), mat);
      bloom.position.set(bx, by, bz);
      bloom.scale.set(1, 0.82, 1);
      hearthSpring.add(bloom);
    }
  }
  hearthSpring.visible = false;
  hearthGroup.add(hearthSpring);

  const hearthSummer = new THREE.Group();
  {
    const peg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 6)), brassMat);
    peg.rotation.x = Math.PI * 0.5;
    peg.position.set(0.42, 2.02, 0.21);
    const pegBall = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.02, 7, 6)), brassMat);
    pegBall.position.set(0.42, 2.02, 0.24);
    hearthSummer.add(peg, pegBall);
    const twine = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 5)), linenMat);
    twine.position.set(0.42, 1.965, 0.22);
    hearthSummer.add(twine);
    const bundle = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.036, 0.05, 0.16, 8)), foliageMat);
    bundle.position.set(0.42, 1.85, 0.22);
    bundle.rotation.z = 0.06;
    hearthSummer.add(bundle);
    const mintTipA = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(0.032, 0)), foliageMat);
    mintTipA.position.set(0.395, 1.755, 0.22);
    mintTipA.rotation.z = -0.3;
    const mintTipB = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(0.028, 0)), foliageMat);
    mintTipB.position.set(0.445, 1.765, 0.22);
    mintTipB.rotation.z = 0.34;
    hearthSummer.add(mintTipA, mintTipB);
    const tie = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.038, 0.007, 6, 12)), linenMat);
    tie.position.set(0.42, 1.925, 0.22);
    hearthSummer.add(tie);
  }
  hearthSummer.visible = false;
  hearthGroup.add(hearthSummer);

  const hearthAutumn = new THREE.Group();
  {
    // Cedar ladder rack flat against the flue's left face (local: flue front z 0.17)
    const rackRailL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.045, 0.46, 0.03)), cedarWarmMat);
    rackRailL.position.set(-0.5, 2.02, 0.2);
    const rackRailR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.045, 0.46, 0.03)), cedarWarmMat);
    rackRailR.position.set(-0.22, 2.02, 0.2);
    hearthAutumn.add(rackRailL, rackRailR);
    for (const [rx, ry, len] of [
      [-0.36, 2.2, 0.3],
      [-0.36, 2.02, 0.3],
      [-0.36, 1.84, 0.3],
    ] as const) {
      const rung = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(len, 0.032, 0.026)), cedarWarmMat);
      rung.position.set(rx, ry, 0.2);
      hearthAutumn.add(rung);
    }
    // Three tied bundles hang from the rungs — chamomile, lavender, autumn leaves
    const bundleSpecs: Array<[number, number, THREE.Material, THREE.Material]> = [
      [-0.45, 2.2, petalCreamMat, cedarDarkMat],
      [-0.36, 2.02, petalLavenderMat, cedarDarkMat],
      [-0.27, 1.84, appleRedMat, cedarDarkMat],
    ];
    for (const [bx, rungY, mat, stemMat] of bundleSpecs) {
      const cord = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.005, 0.005, 0.1, 5)), linenMat);
      cord.position.set(bx, rungY - 0.05, 0.205);
      const bundle = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.032, 0.046, 0.15, 8)), mat);
      bundle.position.set(bx, rungY - 0.155, 0.21);
      bundle.rotation.z = bx < -0.36 ? 0.07 : bx > -0.36 ? -0.07 : 0.0;
      const tie = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.034, 0.006, 6, 12)), linenMat);
      tie.position.set(bx, rungY - 0.095, 0.21);
      const stemPeek = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.006, 0.008, 0.04, 5)), stemMat);
      stemPeek.position.set(bx, rungY - 0.225, 0.21);
      stemPeek.rotation.z = bx < -0.36 ? -0.2 : bx > -0.36 ? 0.2 : 0.05;
      hearthAutumn.add(cord, bundle, tie, stemPeek);
    }
  }
  hearthAutumn.visible = false;
  hearthGroup.add(hearthAutumn);

  const hearthWinter = new THREE.Group();
  {
    // Knitted sock hung over the mantel's front edge, east of the terracotta sprig pot
    const cuff = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.045, 0.03)), hearthKnitCreamMat);
    cuff.position.set(0.64, 1.555, 0.45);
    const leg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.043, 0.038, 0.14, 8)), hearthWoolMat);
    leg.position.set(0.64, 1.4, 0.455);
    const heel = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.04, 7, 6)), hearthWoolMat);
    heel.scale.set(0.8, 0.9, 0.6);
    heel.position.set(0.605, 1.315, 0.44);
    const toe = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.042, 7, 6)), hearthKnitCreamMat);
    toe.scale.set(0.85, 0.8, 0.6);
    toe.position.set(0.678, 1.318, 0.455);
    const loop = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.02, 0.005, 6, 10)), hearthKnitCreamMat);
    loop.position.set(0.64, 1.588, 0.44);
    hearthWinter.add(cuff, leg, heel, toe, loop);
    // Evergreen mini-garland draped along the mantel's front edge with brass bells
    for (const [gx, drop] of [
      [-0.82, 0.0],
      [-0.6, 0.018],
      [-0.38, 0.03],
      [-0.16, 0.036],
      [0.06, 0.03],
      [0.28, 0.018],
      [0.86, 0.0],
    ] as const) {
      const sprig = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.055, 7, 6)), foliageMat);
      sprig.scale.set(0.5, 0.32, 0.72);
      sprig.position.set(gx, 1.575 - drop, 0.47);
      hearthWinter.add(sprig);
      if (Math.abs(gx + 0.16) < 0.01 || Math.abs(gx - 0.28) < 0.01) {
        const bell = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.018, 8, 6)), brassMat);
        bell.position.set(gx, 1.53 - drop, 0.48);
        hearthWinter.add(bell);
      }
    }
  }
  hearthWinter.visible = false;
  hearthGroup.add(hearthWinter);

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

  // M5 (Round-4 Pass 13). Everyday tea tin beside the honey pot — appears once the
  // tea-table ritual has been recorded at least once (mem_teatable_* in memories).
  const teaCaddy = new THREE.Group();
  teaCaddy.position.set(-0.34, 0.8, -0.18);
  teaCaddy.visible = false;
  const caddyBody = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.052, 0.09, 12)), ceramicMat);
  caddyBody.position.y = 0.045;
  const caddyLid = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.054, 0.054, 0.018, 12)), cedarWarmMat);
  caddyLid.position.y = 0.099;
  const caddyKnob = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.014, 8, 8)), brassMat);
  caddyKnob.position.y = 0.118;
  teaCaddy.add(caddyBody, caddyLid, caddyKnob);
  tableGroup.add(teaCaddy);

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

  // M4 (Round-4 Pass 13). A greenhouse cutting in a glass jar on the sill end —
  // appears once a shared plot has been harvested (greenhouseState.totalHarvests > 0).
  const greenhouseCutting = new THREE.Group();
  greenhouseCutting.position.set(-3.45, 0.98, 0.72);
  greenhouseCutting.visible = false;
  const jarBody = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.055, 0.13, 10)), jarGlassMat);
  jarBody.position.y = 0.065;
  const jarWater = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.042, 0.046, 0.07, 10)), palette.standard('#B9DAD6', 0.5, 0.0));
  jarWater.position.y = 0.042;
  const cuttingStem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.008, 0.011, 0.16, 6)), foliageMat);
  cuttingStem.position.set(0.008, 0.16, 0);
  cuttingStem.rotation.z = -0.12;
  const cuttingLeaf = new THREE.Mesh(trackGeo(new THREE.DodecahedronGeometry(0.045, 0)), foliageMat);
  cuttingLeaf.scale.set(1, 0.85, 1);
  cuttingLeaf.position.set(0.028, 0.26, 0);
  const cuttingBloom = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.028, 7, 6)), petalCreamMat);
  cuttingBloom.position.set(0.03, 0.31, 0);
  greenhouseCutting.add(jarBody, jarWater, cuttingStem, cuttingLeaf, cuttingBloom);
  group.add(greenhouseCutting);

  // M6 (Round-4 Pass 14). Seasonal sill posy on the north sill end — a glass bottle
  // with a small gathering from the season. Hidden in winter (frost owns the sill).
  const makePosyBottle = (x: number, z: number) => {
    const bottle = new THREE.Group();
    bottle.position.set(x, 0.98, z);
    const neck = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.032, 0.045, 0.11, 10)), jarGlassMat);
    neck.position.y = 0.055;
    bottle.add(neck);
    return bottle;
  };
  const posySpring = makePosyBottle(-3.44, -0.72);
  {
    const stemA = makeStem(0, 0, 0.14, -0.1);
    stemA.position.set(0, 0.02, 0);
    stemA.scale.setScalar(0.7);
    const headA = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.03, 7, 6)), petalCreamMat);
    headA.position.set(0.02, 0.18, 0);
    const stemB = makeStem(0, 0, -0.12, 0.12);
    stemB.position.set(0.01, 0.01, 0);
    stemB.scale.setScalar(0.6);
    const headB = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.026, 7, 6)), petalMarigoldMat);
    headB.position.set(-0.02, 0.15, 0.01);
    posySpring.add(stemA, headA, stemB, headB);
  }
  const posySummer = makePosyBottle(-3.44, -0.72);
  {
    const spikeA = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.02, 0.09, 4, 7)), petalLavenderMat);
    spikeA.position.set(0.02, 0.17, 0);
    spikeA.rotation.z = 0.14;
    const spikeB = new THREE.Mesh(trackGeo(new THREE.CapsuleGeometry(0.018, 0.08, 4, 7)), petalLavenderMat);
    spikeB.position.set(-0.02, 0.15, 0.01);
    spikeB.rotation.z = -0.16;
    const stemC = makeStem(0, 0, 0, 0.08);
    stemC.position.set(0, 0.02, 0);
    stemC.scale.setScalar(0.55);
    posySummer.add(spikeA, spikeB, stemC);
  }
  const posyAutumn = makePosyBottle(-3.44, -0.72);
  {
    const leafA = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.045, 7, 6)), petalMarigoldMat);
    leafA.scale.set(1.25, 0.5, 0.8);
    leafA.position.set(0.02, 0.16, 0);
    leafA.rotation.z = 0.3;
    const leafB = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.04, 7, 6)), appleRedMat);
    leafB.scale.set(1.2, 0.5, 0.8);
    leafB.position.set(-0.02, 0.13, 0.01);
    leafB.rotation.z = -0.34;
    const twig = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.007, 0.01, 0.14, 5)), cedarDarkMat);
    twig.position.set(0, 0.07, 0);
    twig.rotation.z = 0.08;
    posyAutumn.add(leafA, leafB, twig);
  }
  posySpring.visible = false;
  posySummer.visible = false;
  posyAutumn.visible = false;
  group.add(posySpring, posySummer, posyAutumn);

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

  // M7 (Round-4 Pass 14). Door-lintel seasonal swag — an evergreen sprig garland on
  // the lintel's inner face whose accent swaps with the season (spring blossoms,
  // summer lavender, autumn berries, a winter brass bell). Wall-plane mounted.
  const doorSwag = new THREE.Group();
  for (const [lx, ly, tilt, scl] of [
    [-0.36, 0.012, 0.24, 0.85],
    [-0.18, 0.02, 0.12, 1.0],
    [0.0, 0.024, 0.0, 1.05],
    [0.18, 0.02, -0.12, 1.0],
    [0.36, 0.012, -0.24, 0.85],
  ] as const) {
    const sprig = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.07, 7, 6)), foliageMat);
    sprig.scale.set(0.42, 0.3, 0.75);
    sprig.position.set(lx, 2.325 + ly, 0);
    sprig.rotation.z = tilt;
    sprig.scale.multiplyScalar(scl);
    doorSwag.add(sprig);
  }
  for (const ax of [-0.27, 0.0, 0.27]) {
    const accent = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.028, 8, 8)), doorSwagAccentMat);
    accent.position.set(ax, 2.3 + Math.abs(ax) * 0.06, 0.045);
    doorSwag.add(accent);
  }
  const swagCordL = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 5)), linenMat);
  swagCordL.position.set(-0.44, 2.37, 0);
  swagCordL.rotation.z = 0.5;
  const swagCordR = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 5)), linenMat);
  swagCordR.position.set(0.44, 2.37, 0);
  swagCordR.rotation.z = -0.5;
  doorSwag.add(swagCordL, swagCordR);
  doorGroup.add(doorSwag);

  // M8 (Round-4 Pass 14). Seasonal floor scatter — spring petals drift in from the
  // west window; autumn leaves gather by the door. Tiny, static, season-gated.
  const springPetals = new THREE.Group();
  for (const [px, pz, pr, mat] of [
    [-3.05, -0.28, 0.4, petalCreamMat],
    [-2.72, 0.34, -0.5, petalMarigoldMat],
    [-2.9, 0.02, 0.9, petalCreamMat],
  ] as const) {
    const petal = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.038, 7, 5)), mat);
    petal.scale.set(1.2, 0.22, 0.8);
    petal.position.set(px, 0.012, pz);
    petal.rotation.y = pr;
    springPetals.add(petal);
  }
  springPetals.visible = false;
  group.add(springPetals);
  const autumnLeaves = new THREE.Group();
  for (const [lx2, lz2, lr2, mat2] of [
    [3.12, -0.44, 0.3, petalMarigoldMat],
    [2.82, 0.12, -0.8, appleRedMat],
    [3.2, 0.4, 1.1, petalMarigoldMat],
  ] as const) {
    const leaf = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.05, 7, 5)), mat2);
    leaf.scale.set(1.15, 0.2, 0.75);
    leaf.position.set(lx2, 0.012, lz2);
    leaf.rotation.y = lr2;
    autumnLeaves.add(leaf);
  }
  autumnLeaves.visible = false;
  group.add(autumnLeaves);

  // Pass 21. Winter warmth — the cold season reads inside the room, not just on
  // the glass. Floor-scale textiles + fire reserve, winter-gated in rig.update;
  // all pieces sit inside existing footprints or hug walls so the walkable floor
  // reads unchanged and COTTAGE_INTERIOR_OBSTACLES stays untouched.
  const winterComforts = new THREE.Group();
  winterComforts.name = 'winter_comforts';
  {
    // Knit wool runner from the porch door into the room's east aisle — striped
    // rows + fringe ends, the winter answer to the braided hearth rug. Placed on
    // the open east floor (the braided rug owns the center-west patch).
    const runner = new THREE.Group();
    runner.position.set(2.2, 0, 0.0);
    runner.rotation.y = Math.PI * 0.5;
    const runnerBase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.5, 0.022, 1.72)), hearthKnitCreamMat);
    runnerBase.position.y = 0.011;
    runnerBase.receiveShadow = true;
    runner.add(runnerBase);
    const runnerStripes: Array<[number, THREE.Material]> = [
      [-0.52, hearthWoolMat],
      [-0.2, sageMat],
      [0.12, hearthWoolMat],
      [0.44, sageMat],
    ];
    for (const [sz, mat] of runnerStripes) {
      const stripe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.51, 0.008, 0.14)), mat);
      stripe.position.set(0, 0.024, sz);
      runner.add(stripe);
    }
    for (const endZ of [-0.88, 0.88]) {
      for (const fx of [-0.18, -0.09, 0, 0.09, 0.18]) {
        const fringe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.02, 0.004, 0.09)), hearthKnitCreamMat);
        fringe.position.set(fx, 0.01, endZ + Math.sign(endZ) * 0.045);
        runner.add(fringe);
      }
    }
    winterComforts.add(runner);

    // Knitted throw folded over the bed's foot rail — a winter-made bed.
    // Parented to winterComforts (not bedGroup) so the season gate hides it;
    // coordinates are the bed group's world origin (-2.48, 0, 1.7) + local offset.
    const bedThrow = new THREE.Group();
    bedThrow.position.set(-2.48, 0, 1.7);
    const throwDrape = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.34, 1.28)), hearthWoolMat);
    throwDrape.position.set(0.8, 0.33, 0);
    throwDrape.rotation.z = -0.5;
    const throwBand = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.09, 1.29)), hearthKnitCreamMat);
    throwBand.position.set(0.72, 0.44, 0);
    throwBand.rotation.z = -0.5;
    const throwFold = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.3, 0.055, 1.3)), hearthKnitCreamMat);
    throwFold.position.set(0.58, 0.6, 0);
    bedThrow.add(throwDrape, throwBand, throwFold);
    winterComforts.add(bedThrow);

    // Firewood reserve beside the hearth's east face — cut rounds stacked 2+1.
    const logStack = new THREE.Group();
    logStack.position.set(-0.82, 0, -2.28);
    for (const [lx3, ly3, lz3, lr3] of [
      [-0.04, 0.055, 0, 0.04],
      [0.05, 0.055, 0.01, -0.03],
      [0.005, 0.15, -0.005, 0.06],
    ] as const) {
      const log = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.052, 0.055, 0.34, 9)), cedarDarkMat);
      log.rotation.x = Math.PI * 0.5;
      log.rotation.z = lr3;
      log.position.set(lx3, ly3, lz3);
      const logEnd = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.053, 0.053, 0.012, 9)), cedarWarmMat);
      logEnd.rotation.x = Math.PI * 0.5;
      logEnd.rotation.z = lr3;
      logEnd.position.set(lx3, ly3, lz3 + 0.17);
      logStack.add(log, logEnd);
    }
    winterComforts.add(logStack);
  }
  winterComforts.visible = false;
  group.add(winterComforts);

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

  // Pass 21. Table life — season-independent craft: wool cushions warm the two
  // dining stools, and a small bread board rests at the table's south-east rim
  // (away from the vase focus and the reactive teacup), all inside the table
  // footprint so neither interaction targets nor walkability change.
  for (const [stool, tilt, cushionMat, cname] of [
    [stoolGroupWest, 0.09, terracottaMat, 'stool_cushion_west'],
    [stoolGroupEast, -0.07, sageMat, 'stool_cushion_east'],
  ] as const) {
    const cushion = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.15, 0.165, 0.05, 12)), cushionMat);
    cushion.position.y = 0.472;
    cushion.rotation.z = tilt;
    cushion.name = cname;
    cushion.castShadow = true;
    stool.add(cushion);
  }
  const tableBreadBoard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.3, 0.024, 0.17)), cedarWarmMat);
  tableBreadBoard.position.set(0.3, 0.783, -0.3);
  tableBreadBoard.rotation.y = -0.3;
  tableBreadBoard.castShadow = true;
  const tableBreadSlice = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.062, 0.062, 0.048, 14)), teaBrewMat);
  tableBreadSlice.position.set(0.26, 0.815, -0.27);
  tableBreadSlice.rotation.set(0, -0.3, Math.PI * 0.5);
  tableBreadSlice.scale.set(1, 1, 0.62);
  const tableCloth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.2, 0.016, 0.16)), linenMat);
  tableCloth.position.set(0.36, 0.779, -0.24);
  tableCloth.rotation.y = 0.4;
  tableGroup.add(tableBreadBoard, tableBreadSlice, tableCloth);

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

  // M1 (Round-4 Pass 13). Orchard honey crock on the sideboard — appears once the
  // Fern Hollow orchard harvest has been lived (mem_orchard_harvest in memories).
  const orchardHoney = new THREE.Group();
  orchardHoney.position.set(0.14, 0.855, 0.1);
  orchardHoney.visible = false;
  const crockJar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.072, 0.08, 0.11, 12)), honeyAmberMat);
  crockJar.position.y = 0.055;
  const crockLid = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.076, 0.076, 0.022, 12)), cedarDarkMat);
  crockLid.position.y = 0.121;
  const crockSwatch = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.06, 0.01)), paperCardMat);
  crockSwatch.position.set(0.0, 0.055, 0.081);
  orchardHoney.add(crockJar, crockLid, crockSwatch);
  shelfGroup.add(orchardHoney);

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

  // M3 (Round-4 Pass 13). Nora's borrowed book resting on the quilt — appears once a
  // featured nook book has been settled into (nookState.booksRead > 0).
  const nookBook = new THREE.Group();
  nookBook.position.set(0.02, 0.605, -0.28);
  nookBook.rotation.y = 0.35;
  nookBook.visible = false;
  const bookCover = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.2, 0.026, 0.14)), sageMat);
  const bookPages = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.17, 0.02, 0.115)), linenMat);
  bookPages.position.y = 0.004;
  const bookmarkRibbon = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.016, 0.008, 0.11)), terracottaMat);
  bookmarkRibbon.position.set(0.05, 0.018, -0.005);
  nookBook.add(bookCover, bookPages, bookmarkRibbon);
  bedGroup.add(nookBook);

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

    // Round-4 Pass 14: seasons of home — sill posy, swag accent, scatter, glass tint
    seasonLife.posySpring.visible = season === 'spring';
    seasonLife.posySummer.visible = season === 'summer';
    seasonLife.posyAutumn.visible = season === 'autumn';
    seasonLife.autumnLeaves.visible = season === 'autumn';
    seasonLife.springPetals.visible = season === 'spring';
    // R5 Pass 16: the hearth wall keeps the seasons
    seasonLife.hearthSpring.visible = season === 'spring';
    seasonLife.hearthSummer.visible = season === 'summer';
    seasonLife.hearthAutumn.visible = season === 'autumn';
    seasonLife.hearthWinter.visible = season === 'winter';
    // Pass 21: winter warmth — floor textiles + firewood appear with the frost
    winterComforts.visible = season === 'winter';
    const accent = seasonSwagAccents[season] ?? seasonSwagAccents.spring;
    seasonLife.doorSwagAccentMat.color.copy(accent);
    const glassTint = seasonGlassTints[season] ?? seasonGlassTints.spring;
    windowGlassMat.emissive.copy(glassTint);

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

    // Round-4 Pass 13: the home remembers — mementos derived from lived progress
    // (read-only world reads; allocation-free lookups; no save-schema impact).
    homeMementos.greenhouseCutting.visible = (world.greenhouseState?.totalHarvests ?? 0) > 0;
    homeMementos.bakeryCard.visible = (world.bakeryState?.kneadingSessions ?? 0) > 0;
    homeMementos.nookBook.visible = (world.nookState?.booksRead ?? 0) > 0;
    homeMementos.orchardHoney.visible = hasMemoryId(world.memories, 'mem_orchard_harvest');
    homeMementos.teaCaddy.visible = hasMemoryIdPrefix(world.memories, 'mem_teatable_');

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

  const homeMementos = {
    greenhouseCutting,
    orchardHoney,
    bakeryCard,
    nookBook,
    teaCaddy,
  };

  const seasonLife = {
    posySpring,
    posySummer,
    posyAutumn,
    doorSwag,
    doorSwagAccentMat,
    autumnLeaves,
    springPetals,
    hearthSpring,
    hearthSummer,
    hearthAutumn,
    hearthWinter,
  };

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
    homeMementos,
    seasonLife,
    winterComforts,
    update,
    dispose,
  };
}
