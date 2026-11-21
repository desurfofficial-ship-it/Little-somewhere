import * as THREE from 'three';
import {
  GREENHOUSE_CROPS,
  GREENHOUSE_INTERACTABLES,
  GREENHOUSE_PLOT_COUNT,
  GREENHOUSE_PLOT_SHELF_Z,
} from '../../game/greenhouse';
import { GreenhouseCropId, TimePhase, WorldState } from '../../game/types';
import { getSeasonForDay } from '../../game/time';
import { composeProgressionVisualState } from '../../game/progressionVisuals';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';
import {
  addContactShadow,
} from './vegetation';
import { addStaticContactShadow } from '../contactShadows';

/**
 * Sunbeam Greenhouse Interior Cutaway Diorama (Milestone 3 Build 6).
 *
 * Mirrors `GREENHOUSE_BOUNDS` (-3.02..3.02 x -2.62..2.62) and the exact furniture footprints
 * of `GREENHOUSE_INTERIOR_OBSTACLES` & `GREENHOUSE_INTERACTABLES` in `src/game/greenhouse.ts`.
 * Building-audit Phase A door-side reconciliation: the interior door now sits in the WEST
 * glass wall (door opening z 0.9..2.1, spawn (-2.3, 1.5)) agreeing with the exterior west
 * vestibule doorway, instead of teleporting the player across the room. The east glass wall
 * rises taller for the growing shelf light (shelf moved from west to east with the four
 * shared plot pots; registry `GREENHOUSE_PLOT_SHELF_Z` z values are unchanged). North + East
 * walls rise as timber-framed glass with tall sunlit panes; South + West edges step down to
 * cutaway dwarf-stone wainscoting so the isometric camera reads cleanly into every corner.
 */
export interface SunbeamGreenhouseInteriorRig {
  group: THREE.Group;
  hitProxies: THREE.Mesh[];
  /** Per-crop arrays of stage-3 bloom groups (rig-level detail for tests). */
  plotStageGroups: Record<GreenhouseCropId, THREE.Group[]>;
  /** Per-plot maps of crop → bloom group (index-aligned with `world.greenhouseState.plots`). */
  plotBloomGroups: Array<Record<GreenhouseCropId, THREE.Group>>;
  /** Per-plot stage-1 sprout groups (index-aligned with `world.greenhouseState.plots`). */
  plotSproutGroups: THREE.Group[];
  /** Per-plot stage-2 leafy groups (index-aligned with `world.greenhouseState.plots`). */
  plotLeafyGroups: THREE.Group[];
  /**
   * Pass 24 "Growing Through Winter": per-season dressing groups, all built hidden
   * and gated by `world.season` inside `update()`. Visual-only — no obstacle,
   * interactable, or plot stage is touched.
   */
  seasonLife: {
    spring: THREE.Group;
    summer: THREE.Group;
    autumn: THREE.Group;
    winter: THREE.Group;
  };
  update(world: WorldState, phase: TimePhase, elapsed: number): void;
  dispose(): void;
}

type CropKey = GreenhouseCropId;

export function buildSunbeamGreenhouseInterior(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
  _options: { isSoftwareGl?: boolean } = {},
): SunbeamGreenhouseInteriorRig {
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

  // Shared calibrated storybook materials (registry-cached, zero warnings)
  const darkStoneMat = palette.standard(STORYBOOK_PALETTE.fieldstoneDark, 0.9, 0.02, { mapSet: 'stone' });
  const limestoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.88, 0.02, { mapSet: 'stone' });
  const creamMat = palette.standard(STORYBOOK_PALETTE.creamTrim, 0.78, 0.02, { mapSet: 'timber-light' });
  const cedarDarkMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.74, 0.04, { mapSet: 'timber-dark' });
  const cedarWarmMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.72, 0.04, { mapSet: 'timber-dark' });
  const doorMat = palette.standard(STORYBOOK_PALETTE.doorCedar, 0.7, 0.04, { mapSet: 'timber-dark' });
  const sageMat = palette.standard(STORYBOOK_PALETTE.sageShutter, 0.72, 0.02, { mapSet: 'timber-dark' });
  const terracottaMat = palette.standard(STORYBOOK_PALETTE.terracottaPot, 0.58, 0.04);
  const ceramicMat = palette.standard(STORYBOOK_PALETTE.ceramicCream, 0.4, 0.04);
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.25, 0.86);
  const ironMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.45, 0.65);
  const copperMat = palette.standard('#C56B45', 0.28, 0.78);
  const foliageMat = palette.standard(STORYBOOK_PALETTE.foliageMid, 0.8, 0.0, { mapSet: 'foliage' });
  const foliageDeepMat = palette.standard(STORYBOOK_PALETTE.foliageDeep, 0.82, 0.0, { mapSet: 'foliage' });
  const foliageSunMat = palette.standard(STORYBOOK_PALETTE.foliageSun, 0.78, 0.0, { mapSet: 'foliage' });
  const petalCreamMat = palette.standard(STORYBOOK_PALETTE.petalCream, 0.66, 0.0);
  const petalLavenderMat = palette.standard(STORYBOOK_PALETTE.petalLavender, 0.66, 0.0);
  const mossMat = palette.standard(STORYBOOK_PALETTE.moss, 0.84, 0.0);
  const linenMat = palette.standard('#F5EEE0', 0.88, 0.0);
  const floorStoneMat = palette.standard('#B9A98F', 0.86, 0.02);
  const soilWetMat = palette.standard('#4E3A2C', 0.94, 0.0);
  const soilDryMat = palette.standard('#7A5B42', 0.95, 0.0);

  // Per-instance dynamic materials
  const glassPaneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#C4E2DF',
      roughness: 0.14,
      metalness: 0.08,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const roofGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#D0E4EA',
      roughness: 0.16,
      metalness: 0.06,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const shaftMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: '#FFEFC9',
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const moteMat = trackMat(
    new THREE.PointsMaterial({
      color: '#FFF6DC',
      size: 0.05,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    }),
  );
  const lanternMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#FFE8AD',
      emissive: '#FFC470',
      emissiveIntensity: 0.2,
      roughness: 0.4,
      metalness: 0.04,
    }),
  );
  const bloomChamomileMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#FAF4E4',
      emissive: '#FFF6DA',
      emissiveIntensity: 0.12,
      roughness: 0.6,
      metalness: 0.0,
    }),
  );
  const bloomLavenderMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: STORYBOOK_PALETTE.petalLavender,
      emissive: '#C3AEE8',
      emissiveIntensity: 0.1,
      roughness: 0.62,
      metalness: 0.0,
    }),
  );
  const bloomFoxgloveMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#C98BA8',
      emissive: '#E7B8CC',
      emissiveIntensity: 0.08,
      roughness: 0.6,
      metalness: 0.0,
    }),
  );
  const hitProxyMat = trackMat(new THREE.MeshBasicMaterial({ visible: false }));

  // Pass 24 seasonal accents (registry-cached + two tracked emissive/translucent mats)
  const frostMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#EAF4F1',
      roughness: 0.42,
      metalness: 0.0,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    }),
  );
  const heaterGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#FFD9A0',
      emissive: '#FF9A3C',
      emissiveIntensity: 0.55,
      roughness: 0.5,
      metalness: 0.0,
    }),
  );
  const seedHeadMat = palette.standard('#C9A15A', 0.82, 0.0);

  // Warm interior lantern light (dusk fallback for the glass daylight)
  const lanternLight = new THREE.PointLight('#FFD9A0', 0, 7.5, 1.8);
  lanternLight.position.set(0.4, 2.35, 0.1);
  group.add(lanternLight);
  // Sun shaft key light inside the glass
  const glassKeyLight = new THREE.PointLight('#FFF3D6', 0.55, 9.5, 1.6);
  glassKeyLight.position.set(-1.2, 2.6, 0.2);
  group.add(glassKeyLight);

  // ---------------------------------------------------------------------
  // 1. Foundation plinth, flagstone floor & door mat
  // ---------------------------------------------------------------------
  const plinth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.5, 0.24, 5.7)), darkStoneMat);
  plinth.position.set(0, -0.15, 0);
  plinth.receiveShadow = true;
  group.add(plinth);

  const floorDeck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.2, 0.06, 5.4)), floorStoneMat);
  floorDeck.position.set(0, -0.02, 0);
  floorDeck.receiveShadow = true;
  group.add(floorDeck);

  // Irregular flagstone inlays for handcrafted floor rhythm
  const flagstoneGeo = trackGeo(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 7));
  const flagstoneSpots: Array<[number, number, number, number]> = [
    [-1.4, 0.008, -0.6, 1.0],
    [0.9, 0.008, 0.6, 0.9],
    [1.5, 0.008, -0.9, 0.85],
    [-0.2, 0.008, 1.0, 1.05],
    [0.3, 0.008, -1.5, 0.8],
    [-1.0, 0.008, 1.6, 0.9],
  ];
  for (const [fx, fy, fz, s] of flagstoneSpots) {
    const stone = new THREE.Mesh(flagstoneGeo, limestoneMat);
    stone.position.set(fx, fy, fz);
    stone.scale.set(s, 1, s * 0.86);
    stone.receiveShadow = true;
    group.add(stone);
  }

  const doorMat2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.15, 0.025, 0.62)), mossMat);
  doorMat2.position.set(-2.15, 0.015, 1.5);
  doorMat2.receiveShadow = true;
  group.add(doorMat2);

  // ---------------------------------------------------------------------
  // 2. Glasshouse shell: north/east glass walls + dwarf-stone south/west wainscot
  //    (Phase A door-side reconciliation: door opening now in the west wall at z 1.5)
  // ---------------------------------------------------------------------
  const glassHeight = 2.5;
  // North glass wall (z = -2.62)
  const northGlass = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.1, glassHeight, 0.06)), glassPaneMat);
  northGlass.position.set(0, 0.95 + glassHeight / 2, -2.63);
  group.add(northGlass);
  const northDwarf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.1, 0.72, 0.18)), darkStoneMat);
  northDwarf.position.set(0, 0.42, -2.6);
  northDwarf.castShadow = true;
  group.add(northDwarf);
  const northSill = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.22, 0.1, 0.26)), limestoneMat);
  northSill.position.set(0, 0.82, -2.58);
  group.add(northSill);

  // East glass wall (x = 3.02) — taller for the growing shelf light
  const eastGlass = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, glassHeight + 0.3, 5.3)), glassPaneMat);
  eastGlass.position.set(3.03, 1.0 + (glassHeight + 0.3) / 2, 0);
  group.add(eastGlass);
  const eastDwarf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.72, 5.3)), darkStoneMat);
  eastDwarf.position.set(2.99, 0.42, 0);
  eastDwarf.castShadow = true;
  group.add(eastDwarf);
  const eastSill = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.26, 0.1, 5.42)), limestoneMat);
  eastSill.position.set(2.97, 0.82, 0);
  group.add(eastSill);

  // West glass wall with door opening (door occupies z 0.9..2.1)
  const westDwarf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.72, 5.3)), darkStoneMat);
  westDwarf.position.set(-2.99, 0.42, 0);
  westDwarf.castShadow = true;
  group.add(westDwarf);
  const westGlassNorth = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.06, glassHeight, 3.52)),
    glassPaneMat,
  );
  westGlassNorth.position.set(-3.03, 0.95 + glassHeight / 2, -0.86);
  group.add(westGlassNorth);
  const westGlassSouth = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.06, glassHeight, 0.52)),
    glassPaneMat,
  );
  westGlassSouth.position.set(-3.03, 0.95 + glassHeight / 2, 2.36);
  group.add(westGlassSouth);
  const westHeader = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.55, 1.6)), cedarWarmMat);
  westHeader.position.set(-3.01, 2.95, 1.5);
  group.add(westHeader);
  // Glass above the door opening
  const doorHeaderGlass = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.06, 1.0, 1.26)),
    glassPaneMat,
  );
  doorHeaderGlass.position.set(-3.03, 1.95, 1.5);
  group.add(doorHeaderGlass);

  // South wall (z = +2.62) — cutaway dwarf stone + low glass so camera reads in
  const southDwarf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.1, 0.72, 0.18)), darkStoneMat);
  southDwarf.position.set(0, 0.42, 2.6);
  southDwarf.castShadow = true;
  group.add(southDwarf);
  const southGlass = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.1, 1.5, 0.06)), glassPaneMat);
  southGlass.position.set(-0.9, 1.7, 2.63);
  group.add(southGlass);

  // Corner posts & timber ribs
  const postGeo = trackGeo(new THREE.BoxGeometry(0.16, 3.3, 0.16));
  const cornerPosts: Array<[number, number]> = [
    [-2.96, -2.56],
    [2.96, -2.56],
    [-2.96, 2.56],
    [2.96, 2.56],
  ];
  for (const [px, pz] of cornerPosts) {
    const post = new THREE.Mesh(postGeo, cedarWarmMat);
    post.position.set(px, 1.65, pz);
    post.castShadow = true;
    group.add(post);
  }
  const ribGeoN = trackGeo(new THREE.BoxGeometry(0.1, 3.0, 0.12));
  for (let x = -2.2; x <= 2.2; x += 1.47) {
    const rib = new THREE.Mesh(ribGeoN, cedarWarmMat);
    rib.position.set(x, 1.6, -2.58);
    group.add(rib);
    const ribE = new THREE.Mesh(ribGeoN, cedarWarmMat);
    ribE.position.set(2.96, 1.6, x * 0.9);
    ribE.rotation.y = Math.PI / 2;
    group.add(ribE);
  }

  // Pitched glass roof with ridge cap (ridge runs along X at y≈3.5)
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-3.05, 0);
  roofShape.lineTo(3.05, 0);
  roofShape.lineTo(0, 1.35);
  roofShape.closePath();
  const roofGeo = trackGeo(new THREE.ExtrudeGeometry(roofShape, { depth: 5.3, bevelEnabled: false }));
  roofGeo.translate(0, 2.72, -2.65);
  const roofGlass = new THREE.Mesh(roofGeo, roofGlassMat);
  group.add(roofGlass);
  const ridgeCap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.25, 0.09, 0.2)), cedarDarkMat);
  ridgeCap.position.set(0, 4.08, 0);
  group.add(ridgeCap);

  // Interior ridge beam with hanging dried herb bundles
  const ridgeBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.9, 0.12, 0.18)), cedarDarkMat);
  ridgeBeam.position.set(0, 3.62, 0.15);
  group.add(ridgeBeam);

  const herbBundleGeo = trackGeo(new THREE.ConeGeometry(0.07, 0.34, 6));
  const herbTieGeo = trackGeo(new THREE.TorusGeometry(0.05, 0.014, 5, 10));
  const herbSpots: Array<[number, number]> = [
    [-1.6, 0.15],
    [-0.4, 0.15],
    [0.8, 0.15],
  ];
  for (const [hx, hz] of herbSpots) {
    const bundle = new THREE.Group();
    const foliage = new THREE.Mesh(herbBundleGeo, foliageDeepMat);
    foliage.position.y = -0.17;
    const tie = new THREE.Mesh(herbTieGeo, brassMat);
    tie.rotation.x = Math.PI / 2;
    tie.position.y = 0.0;
    bundle.add(foliage, tie);
    bundle.position.set(hx, 3.56, hz);
    group.add(bundle);
  }

  // ---------------------------------------------------------------------
  // 3. Potting bench (north-west wall) — matches greenhouse_potting obstacle
  // ---------------------------------------------------------------------
  const pottingGroup = new THREE.Group();
  pottingGroup.position.set(-1.9, 0, -2.15);
  addStaticContactShadow(pottingGroup, shadowTex, 2.15, 1.0, 0.42, 0.018);

  const benchTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.85, 0.09, 0.78)), cedarWarmMat);
  benchTop.position.y = 0.86;
  benchTop.castShadow = true;
  pottingGroup.add(benchTop);
  const benchFront = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.85, 0.5, 0.06)), cedarDarkMat);
  benchFront.position.set(0, 0.56, 0.38);
  pottingGroup.add(benchFront);
  for (const lx of [-0.82, 0.82]) {
    const leg = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 0.86, 0.12)), cedarDarkMat);
    leg.position.set(lx, 0.43, 0);
    pottingGroup.add(leg);
  }
  const benchLowerShelf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.6, 0.05, 0.6)), cedarWarmMat);
  benchLowerShelf.position.y = 0.3;
  pottingGroup.add(benchLowerShelf);

  // Seed drawers with brass pulls on the bench front-left
  const drawerGeo = trackGeo(new THREE.BoxGeometry(0.42, 0.16, 0.42));
  const drawerPullGeo = trackGeo(new THREE.BoxGeometry(0.16, 0.035, 0.035));
  const drawerSpots: Array<[number, number]> = [
    [-0.62, -0.12],
    [-0.62, 0.09],
  ];
  for (const [dx, dy] of drawerSpots) {
    const drawer = new THREE.Mesh(drawerGeo, cedarDarkMat);
    drawer.position.set(dx, 0.62 + dy, 0.02);
    pottingGroup.add(drawer);
    const pull = new THREE.Mesh(drawerPullGeo, brassMat);
    pull.position.set(dx, 0.62 + dy, 0.24);
    pottingGroup.add(pull);
  }

  // Potting paraphernalia: soil bag, pot stack, shears, twine
  const soilBag = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.17, 0.13, 0.34, 8)), linenMat);
  soilBag.position.set(0.32, 1.07, -0.12);
  soilBag.rotation.z = 0.16;
  soilBag.castShadow = true;
  pottingGroup.add(soilBag);
  const potStack = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const pot = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.11, 0.08, 0.13, 9)), terracottaMat);
    pot.position.y = i * 0.065;
    potStack.add(pot);
  }
  potStack.position.set(0.62, 0.95, 0.12);
  pottingGroup.add(potStack);
  const shears = new THREE.Group();
  const shearBlade = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.02, 0.035)), brassMat);
  const shearHandle = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.03, 0.03)), sageMat);
  shearHandle.position.x = -0.12;
  shears.add(shearBlade, shearHandle);
  shears.position.set(-0.15, 0.92, 0.1);
  shears.rotation.y = 0.7;
  pottingGroup.add(shears);
  const twineBall = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.055, 8, 7)), linenMat);
  twineBall.position.set(-0.35, 0.94, 0.14);
  pottingGroup.add(twineBall);

  group.add(pottingGroup);

  // ---------------------------------------------------------------------
  // 4. Growing shelf (east wall) with the four shared terracotta pots
  //    (Phase A: shelf mirrored west -> east with the door-side flip)
  // ---------------------------------------------------------------------
  const shelfGroup = new THREE.Group();
  shelfGroup.position.set(2.62, 0, 0.05);
  addStaticContactShadow(shelfGroup, shadowTex, 1.0, 2.7, 0.4, 0.018);

  const shelfLong = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.68, 0.07, 2.5)), cedarWarmMat);
  shelfLong.position.y = 0.92;
  shelfLong.castShadow = true;
  shelfGroup.add(shelfLong);
  const shelfLower = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.62, 0.06, 2.5)), cedarWarmMat);
  shelfLower.position.y = 0.34;
  shelfGroup.add(shelfLower);
  for (const sz of [-1.12, 0.0, 1.12]) {
    const brace = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.58, 0.28, 0.09)), cedarDarkMat);
    brace.position.set(0, 0.63, sz);
    shelfGroup.add(brace);
  }

  // BUILD 03 5.2c — keepsake echo: Mina's woven_herb_wreath rests on the growing
  // shelf once the gift was granted (neighborGiftsReceived). Derived; zero save impact.
  const wreathEcho = new THREE.Group();
  wreathEcho.position.set(0.12, 0.99, -0.6);
  wreathEcho.visible = false;
  const wreathRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.095, 0.02, 5, 12)), foliageMat);
  wreathRing.rotation.x = Math.PI / 2;
  wreathEcho.add(wreathRing);
  shelfGroup.add(wreathEcho);
  // Lower shelf props: spare pots + watering tin
  const lowerPot = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.13, 0.1, 0.16, 9)), terracottaMat);
  lowerPot.position.set(0.02, 0.45, -0.85);
  shelfGroup.add(lowerPot);
  const tinCan = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 0.2, 9)), ironMat);
  tinCan.position.set(0.0, 0.47, 0.9);
  shelfGroup.add(tinCan);

  // Jars + folded notes on a small wall shelf above (mounted toward the east glass)
  const upperShelf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.4, 0.05, 1.6)), cedarWarmMat);
  upperShelf.position.set(0.22, 1.72, 0.1);
  shelfGroup.add(upperShelf);
  const jarGeo = trackGeo(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 8));
  for (const jz of [-0.5, -0.28, 0.42]) {
    const jar = new THREE.Mesh(jarGeo, ceramicMat);
    jar.position.set(0.22, 1.84, jz);
    shelfGroup.add(jar);
  }
  const noteFold = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.015, 0.2)), linenMat);
  noteFold.position.set(0.22, 1.76, 0.05);
  noteFold.rotation.y = 0.4;
  shelfGroup.add(noteFold);

  // The four shared terracotta pots with reactive growth stages
  const potGeo = trackGeo(new THREE.CylinderGeometry(0.155, 0.115, 0.2, 10));
  const saucerGeo = trackGeo(new THREE.CylinderGeometry(0.17, 0.17, 0.035, 10));
  const soilGeo = trackGeo(new THREE.CylinderGeometry(0.125, 0.1, 0.09, 10));
  const soilMoundGeo = trackGeo(new THREE.SphereGeometry(0.1, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2));

  const plotStageGroups: Record<CropKey, THREE.Group[]> = {
    chamomile: [],
    lavender: [],
    thyme: [],
    foxglove: [],
  };
  const soilMeshes: THREE.Mesh[] = [];
  const plotLeafyGroups: THREE.Group[] = [];
  const plotSproutGroups: THREE.Group[] = [];
  const plotBloomGroups: Array<Record<CropKey, THREE.Group>> = [];
  for (let i = 0; i < GREENHOUSE_PLOT_COUNT; i++) {
    const z = GREENHOUSE_PLOT_SHELF_Z[i] ?? -0.9 + i * 0.6;
    const plotGroup = new THREE.Group();
    plotGroup.position.set(0.02, 0.995, z);

    const saucer = new THREE.Mesh(saucerGeo, ceramicMat);
    saucer.position.y = -0.09;
    plotGroup.add(saucer);
    const pot = new THREE.Mesh(potGeo, terracottaMat);
    pot.castShadow = true;
    plotGroup.add(pot);

    const soil = new THREE.Mesh(soilGeo, soilDryMat);
    soil.position.y = 0.1;
    plotGroup.add(soil);
    const mound = new THREE.Mesh(soilMoundGeo, soilDryMat);
    mound.position.y = 0.1;
    mound.scale.set(1.05, 0.55, 1.05);
    plotGroup.add(mound);
    soilMeshes.push(soil, mound);

    // Stage 1 sprout: two tiny cotyledon leaves (scaled to read at diorama distance)
    const sprout = new THREE.Group();
    const sproutLeafGeo = trackGeo(new THREE.SphereGeometry(0.075, 6, 5));
    const leafL = new THREE.Mesh(sproutLeafGeo, foliageSunMat);
    leafL.scale.set(1.0, 0.5, 0.7);
    leafL.position.set(-0.065, 0.075, 0);
    leafL.rotation.z = 0.55;
    const leafR = new THREE.Mesh(sproutLeafGeo, foliageSunMat);
    leafR.scale.set(1.0, 0.5, 0.7);
    leafR.position.set(0.065, 0.075, 0);
    leafR.rotation.z = -0.55;
    const stem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.016, 0.02, 0.14, 5)), foliageDeepMat);
    stem.position.y = 0.07;
    sprout.add(leafL, leafR, stem);
    sprout.position.y = 0.12;
    sprout.visible = false;
    plotGroup.add(sprout);
    plotSproutGroups.push(sprout);

    // Stage 2 leafy: rounded herb clump
    const leafy = new THREE.Group();
    const clumpGeo = trackGeo(new THREE.SphereGeometry(0.145, 7, 6));
    for (const [cx, cz, s] of [
      [-0.06, 0.03, 0.85],
      [0.06, -0.04, 0.78],
      [0.0, 0.06, 0.72],
      [0.02, -0.02, 0.66],
    ] as Array<[number, number, number]>) {
      const clump = new THREE.Mesh(clumpGeo, foliageMat);
      clump.position.set(cx, 0.09, cz);
      clump.scale.set(1, s * 0.8, 1);
      leafy.add(clump);
    }
    leafy.position.y = 0.12;
    leafy.visible = false;
    plotGroup.add(leafy);
    plotLeafyGroups.push(leafy);

    // Stage 3 blooming: per-crop flowering tops
    const bloomByCrop: Record<CropKey, THREE.Group> = {} as Record<CropKey, THREE.Group>;
    for (const crop of GREENHOUSE_CROPS) {
      const bloomGroup = new THREE.Group();
      const clump = new THREE.Mesh(clumpGeo, foliageMat);
      clump.position.y = 0.08;
      clump.scale.set(1.05, 0.8, 1.05);
      bloomGroup.add(clump);
      const stemGeo = trackGeo(new THREE.CylinderGeometry(0.014, 0.014, 0.17, 5));
      const bloomGeo = trackGeo(new THREE.SphereGeometry(0.06, 6, 5));
      const budMat =
        crop.id === 'chamomile'
          ? bloomChamomileMat
          : crop.id === 'lavender'
          ? bloomLavenderMat
          : crop.id === 'foxglove'
          ? bloomFoxgloveMat
          : foliageSunMat;
      const stemMat = foliageDeepMat;
      for (let b = 0; b < 6; b++) {
        const ang = (b / 6) * Math.PI * 2;
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.position.set(Math.cos(ang) * 0.08, 0.19, Math.sin(ang) * 0.08);
        stem.rotation.z = Math.cos(ang) * 0.2;
        stem.rotation.x = Math.sin(ang) * -0.2;
        bloomGroup.add(stem);
        const bud = new THREE.Mesh(bloomGeo, budMat);
        bud.position.set(Math.cos(ang) * 0.12, 0.29, Math.sin(ang) * 0.12);
        bud.scale.setScalar(
          crop.id === 'thyme' ? 0.62 : crop.id === 'foxglove' ? 0.8 : 1.0,
        );
        bloomGroup.add(bud);
      }
      bloomGroup.position.y = 0.12;
      bloomGroup.visible = false;
      bloomByCrop[crop.id] = bloomGroup;
      plotGroup.add(bloomGroup);
      plotStageGroups[crop.id].push(bloomGroup);
    }
    plotBloomGroups.push(bloomByCrop);

    shelfGroup.add(plotGroup);
  }

  group.add(shelfGroup);

  // ---------------------------------------------------------------------
  // 5. Rain barrel + copper watering can (north-east corner)
  // ---------------------------------------------------------------------
  const waterGroup = new THREE.Group();
  waterGroup.position.set(2.05, 0, -2.18);
  addStaticContactShadow(waterGroup, shadowTex, 1.1, 1.0, 0.42, 0.018);

  const barrel = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.34, 0.3, 0.78, 12)), cedarDarkMat);
  barrel.position.y = 0.39;
  barrel.castShadow = true;
  waterGroup.add(barrel);
  const barrelBandGeo = trackGeo(new THREE.TorusGeometry(0.315, 0.022, 6, 14));
  for (const by of [0.14, 0.42, 0.68]) {
    const band = new THREE.Mesh(barrelBandGeo, ironMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = by;
    waterGroup.add(band);
  }
  const barrelWater = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 12)),
    palette.standard('#7FB2C4', 0.24, 0.06),
  );
  barrelWater.position.y = 0.76;
  waterGroup.add(barrelWater);

  // Wall hook + hanging copper watering can
  const hook = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.05, 0.22)), ironMat);
  hook.position.set(0.0, 1.42, 0.3);
  waterGroup.add(hook);
  const wateringCan = new THREE.Group();
  const canBody = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.15, 0.13, 0.2, 10)), copperMat);
  const canSpout = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.02, 0.035, 0.26, 7)), copperMat);
  canSpout.position.set(0.16, 0.06, 0);
  canSpout.rotation.z = -0.7;
  const canHandle = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.075, 0.016, 6, 12, Math.PI)), copperMat);
  canHandle.position.y = 0.11;
  canHandle.rotation.y = Math.PI / 2;
  wateringCan.add(canBody, canSpout, canHandle);
  wateringCan.position.set(0.0, 1.18, 0.32);
  wateringCan.rotation.y = -0.4;
  waterGroup.add(wateringCan);

  group.add(waterGroup);

  // ---------------------------------------------------------------------
  // 6. Mina's worktable (south wall) — field notes, tea, specimen jars
  // ---------------------------------------------------------------------
  const tableGroup = new THREE.Group();
  tableGroup.position.set(0.1, 0, 2.12);
  addStaticContactShadow(tableGroup, shadowTex, 2.1, 0.9, 0.42, 0.018);

  const tableTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.95, 0.08, 0.82)), cedarWarmMat);
  tableTop.position.y = 0.8;
  tableTop.castShadow = true;
  tableGroup.add(tableTop);
  for (const lx of [-0.85, 0.85]) {
    const leg = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.11, 0.8, 0.11)), cedarDarkMat);
    leg.position.set(lx, 0.4, 0);
    tableGroup.add(leg);
  }

  // Open field notebook with a ribbon bookmark
  const notebook = new THREE.Group();
  const pageGeo = trackGeo(new THREE.BoxGeometry(0.34, 0.018, 0.26));
  const pageL = new THREE.Mesh(pageGeo, linenMat);
  pageL.rotation.y = -0.16;
  const pageR = new THREE.Mesh(pageGeo, linenMat);
  pageR.rotation.y = 0.16;
  pageR.position.x = 0.3;
  pageL.position.x = -0.03;
  const ribbon = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.03, 0.02, 0.3)), petalLavenderMat);
  ribbon.position.set(0.14, 0.005, 0.04);
  notebook.add(pageL, pageR, ribbon);
  notebook.position.set(-0.55, 0.86, 0.05);
  notebook.rotation.y = 0.35;
  tableGroup.add(notebook);

  // Tea cup + saucer
  const cupGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.042, 0.075, 9));
  const cup = new THREE.Mesh(cupGeo, ceramicMat);
  cup.position.set(0.12, 0.89, 0.14);
  tableGroup.add(cup);
  const cupSaucer = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 10)), ceramicMat);
  cupSaucer.position.set(0.12, 0.85, 0.14);
  tableGroup.add(cupSaucer);

  // Specimen jars with sprig samples
  const jarTallGeo = trackGeo(new THREE.CylinderGeometry(0.07, 0.07, 0.22, 8));
  for (const [jx, jz, cropTint] of [
    [0.52, 0.0, foliageSunMat],
    [0.72, 0.14, bloomLavenderMat],
  ] as Array<[number, number, THREE.Material]>) {
    const jar = new THREE.Mesh(jarTallGeo, ceramicMat);
    jar.position.set(jx, 0.95, jz);
    tableGroup.add(jar);
    const sprig = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.05, 6, 5)), cropTint);
    sprig.position.set(jx, 1.0, jz);
    tableGroup.add(sprig);
  }

  // Stool tucked at the table's west end
  const stoolSeat = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.17, 0.15, 0.07, 9)), cedarWarmMat);
  stoolSeat.position.set(-1.15, 0.44, 0.1);
  stoolSeat.castShadow = true;
  tableGroup.add(stoolSeat);
  const stoolLegGeo = trackGeo(new THREE.CylinderGeometry(0.025, 0.03, 0.42, 6));
  for (const [sx, sz] of [
    [-1.28, -0.02],
    [-1.02, -0.02],
    [-1.15, 0.22],
  ] as Array<[number, number]>) {
    const sleg = new THREE.Mesh(stoolLegGeo, cedarDarkMat);
    sleg.position.set(sx, 0.21, sz);
    tableGroup.add(sleg);
  }

  group.add(tableGroup);

  // ---------------------------------------------------------------------
  // 7. Interior door (west wall, agreeing with the exterior vestibule door)
  //    + brass lantern above the mat
  // ---------------------------------------------------------------------
  const doorGroup = new THREE.Group();
  doorGroup.position.set(-2.92, 0, 1.5);
  doorGroup.rotation.y = Math.PI; // knob faces into the room (east)
  const doorPanel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 1.9, 1.05)), doorMat);
  doorPanel.position.set(0.02, 0.97, 0);
  doorPanel.castShadow = true;
  doorGroup.add(doorPanel);
  const doorRailGeo = trackGeo(new THREE.BoxGeometry(0.1, 0.09, 0.95));
  for (const ry of [0.42, 1.24]) {
    const rail = new THREE.Mesh(doorRailGeo, cedarDarkMat);
    rail.position.set(0.05, ry, 0);
    doorGroup.add(rail);
  }
  const knob = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.045, 8, 7)), brassMat);
  knob.position.set(-0.06, 1.0, 0.38);
  doorGroup.add(knob);
  const doorLantern = new THREE.Group();
  const lanternCage = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.075, 0.09, 0.16, 6)), ironMat);
  const lanternGlass = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.055, 0.07, 0.12, 6)), lanternMat);
  lanternGlass.position.y = 0.005;
  doorLantern.add(lanternCage, lanternGlass);
  doorLantern.position.set(-0.1, 2.28, 0);
  doorGroup.add(doorLantern);
  group.add(doorGroup);

  // ---------------------------------------------------------------------
  // 8. Sun shafts & drifting pollen motes (atmosphere layer)
  // ---------------------------------------------------------------------
  const shaftGeo = trackGeo(new THREE.PlaneGeometry(1.7, 3.6));
  const shaftA = new THREE.Mesh(shaftGeo, shaftMat);
  shaftA.position.set(-1.7, 1.85, -0.7);
  shaftA.rotation.y = Math.PI / 2.4;
  shaftA.rotation.x = 0.16;
  group.add(shaftA);
  const shaftB = new THREE.Mesh(shaftGeo, shaftMat);
  shaftB.position.set(0.7, 1.85, 0.9);
  shaftB.rotation.y = Math.PI / 1.9;
  shaftB.rotation.x = 0.14;
  group.add(shaftB);

  const MOTE_COUNT = 26;
  const moteGeo = trackGeo(new THREE.BufferGeometry());
  const moteBase = new Float32Array(MOTE_COUNT * 3);
  for (let i = 0; i < MOTE_COUNT; i++) {
    moteBase[i * 3] = -2.4 + (i % 13) * 0.36;
    moteBase[i * 3 + 1] = 0.5 + ((i * 7) % 16) * 0.13;
    moteBase[i * 3 + 2] = -1.8 + ((i * 5) % 17) * 0.21;
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(moteBase.slice(), 3));
  const motes = new THREE.Points(moteGeo, moteMat);
  group.add(motes);

  // ---------------------------------------------------------------------
  // 8.5 Pass 24 "Growing Through Winter" — per-season dressing, all built
  //     hidden and gated by world.season in update(). Floor pieces hug walls
  //     (heater), everything else lives on furniture tops / wall / ridge
  //     planes; obstacles, interactables and the reactive plots read unchanged.
  // ---------------------------------------------------------------------
  const seasonLife = {
    spring: new THREE.Group(),
    summer: new THREE.Group(),
    autumn: new THREE.Group(),
    winter: new THREE.Group(),
  };
  seasonLife.spring.name = 'greenhouse_season_spring';
  seasonLife.summer.name = 'greenhouse_season_summer';
  seasonLife.autumn.name = 'greenhouse_season_autumn';
  seasonLife.winter.name = 'greenhouse_season_winter';

  // — Winter: tin paraffin heater by the door + burlap rolls on the bench + glass frost —
  {
    // Heater tucked in the north-east corner between the rain barrel and the
    // growing shelf (was beside the old east door; interior door now opens west)
    const heater = new THREE.Group();
    heater.name = 'winter_paraffin_heater';
    heater.position.set(2.6, 0, -1.5);
    const body = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.16, 0.17, 0.34, 10)), ironMat);
    body.position.y = 0.17;
    body.castShadow = true;
    heater.add(body);
    const topPlate = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 10)), ironMat);
    topPlate.position.y = 0.355;
    heater.add(topPlate);
    const chimney = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.03, 0.036, 0.5, 7)), ironMat);
    chimney.position.y = 0.62;
    heater.add(chimney);
    const flameWindow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.02, 0.13, 0.1)), heaterGlowMat);
    flameWindow.position.set(-0.16, 0.17, 0);
    heater.add(flameWindow);
    const baseRing = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.16, 0.018, 5, 12)), ironMat);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.02;
    heater.add(baseRing);
    seasonLife.winter.add(heater);

    // Burlap frost-cloth rolls lying on the potting bench top's free west end
    // (bench group origin (-1.9, 0, -2.15); top y 0.86)
    const rolls = new THREE.Group();
    rolls.name = 'winter_burlap_rolls';
    for (const [rx, rz, r] of [
      [-0.72, -0.15, 0.1],
      [-0.72, 0.08, -0.35],
    ] as Array<[number, number, number]>) {
      const roll = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.085, 0.085, 0.48, 8)), linenMat);
      roll.position.set(rx, 0.945, rz);
      roll.rotation.z = Math.PI / 2;
      roll.rotation.y = r;
      rolls.add(roll);
      const tie = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.088, 0.012, 5, 10)), brassMat);
      tie.position.set(rx - 0.14, 0.945, rz);
      tie.rotation.y = Math.PI / 2 + r;
      rolls.add(tie);
    }
    seasonLife.winter.add(rolls);

    // Frost feathers along the north glass sill line (glass wall at z ≈ -2.63)
    const frost = new THREE.Group();
    frost.name = 'winter_glass_frost';
    for (let i = 0; i < 5; i++) {
      const fx = -2.2 + i * 1.1;
      const wedge = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, 0.3, 0.02)), frostMat);
      wedge.position.set(fx, 1.02, -2.56);
      wedge.rotation.z = i % 2 === 0 ? 0.45 : -0.45;
      frost.add(wedge);
    }
    seasonLife.winter.add(frost);
  }

  // — Spring: seedling tray with sprouted cells on the growing shelf's lower board —
  {
    // Shelf group origin (2.62, 0, 0.05) after the door-side mirror; lower board top y 0.365
    const tray = new THREE.Group();
    tray.name = 'spring_seedling_tray';
    tray.position.set(2.62, 0, 0.05);
    const frame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.44, 0.06, 0.26)), cedarDarkMat);
    frame.position.set(-0.02, 0.395, -0.25);
    tray.add(frame);
    for (let c = 0; c < 6; c++) {
      const cx = -0.02 - 0.15 + (c % 3) * 0.15;
      const cz = -0.25 - 0.06 + Math.floor(c / 3) * 0.12;
      const cell = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.045, 0.085)), soilDryMat);
      cell.position.set(cx, 0.425, cz);
      tray.add(cell);
      const sprout = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.03, 6, 5)), foliageSunMat);
      sprout.position.set(cx, 0.465, cz);
      sprout.scale.set(1, 0.6, 1);
      tray.add(sprout);
    }
    seasonLife.spring.add(tray);
  }

  // — Summer: trailing vine swag draped along the ridge beam between the herb bundles —
  {
    const vine = new THREE.Group();
    vine.name = 'summer_ridge_vine';
    for (let i = 0; i < 8; i++) {
      const vx = -0.9 + i * 0.17;
      const vy = 3.52 - Math.sin(((vx + 0.9) / 1.2) * Math.PI) * 0.1;
      const bead = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.055, 6, 5)),
        i % 2 === 0 ? foliageMat : foliageDeepMat,
      );
      bead.position.set(vx, vy, 0.15);
      bead.scale.set(1, 0.72, 0.85);
      vine.add(bead);
    }
    seasonLife.summer.add(vine);
  }

  // — Autumn: seed-head drying bundles at the ridge + harvest trug on the worktable —
  {
    const bundles = new THREE.Group();
    bundles.name = 'autumn_seed_bundles';
    for (const bx of [-1.0, 0.35, 1.4]) {
      const bundle = new THREE.Group();
      const head = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.06, 0.26, 6)), seedHeadMat);
      head.rotation.x = Math.PI;
      head.position.y = -0.13;
      bundle.add(head);
      const tie = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.045, 0.012, 5, 9)), brassMat);
      tie.rotation.x = Math.PI / 2;
      bundle.add(tie);
      bundle.position.set(bx, 3.6, 0.15);
      bundles.add(bundle);
    }
    seasonLife.autumn.add(bundles);

    // Harvest trug of seed pods on the worktable's free north edge
    // (table group origin (0.1, 0, 2.12); top y 0.84)
    const trug = new THREE.Group();
    trug.name = 'autumn_seed_trug';
    trug.position.set(0.1, 0, 2.12);
    const bin = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, 0.09, 0.2)), cedarDarkMat);
    bin.position.set(0.35, 0.885, -0.22);
    trug.add(bin);
    const trugRim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.37, 0.02, 0.23)), cedarWarmMat);
    trugRim.position.set(0.35, 0.94, -0.22);
    trug.add(trugRim);
    for (const [px, pz] of [
      [0.28, -0.2],
      [0.4, -0.26],
      [0.36, -0.16],
    ] as Array<[number, number]>) {
      const pod = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.032, 6, 5)), seedHeadMat);
      pod.position.set(px, 0.955, pz);
      trug.add(pod);
    }
    seasonLife.autumn.add(trug);
  }

  seasonLife.spring.visible = false;
  seasonLife.summer.visible = false;
  seasonLife.autumn.visible = false;
  seasonLife.winter.visible = false;
  group.add(seasonLife.spring, seasonLife.summer, seasonLife.autumn, seasonLife.winter);

  // ---------------------------------------------------------------------
  // 9. Contact shadows for stations + interaction hit proxies
  // ---------------------------------------------------------------------
  const hitProxies: THREE.Mesh[] = [];
  const proxyGeoCache = new Map<string, THREE.BoxGeometry>();
  for (const prop of GREENHOUSE_INTERACTABLES) {
    const key = `${prop.id}_${Math.round(prop.x * 10)}`;
    let proxyGeo = proxyGeoCache.get(key);
    if (!proxyGeo) {
      proxyGeo = trackGeo(new THREE.BoxGeometry(0.62, 1.05, 0.62));
      proxyGeoCache.set(key, proxyGeo);
    }
    const proxy = new THREE.Mesh(proxyGeo, hitProxyMat);
    proxy.position.set(prop.focusX, Math.abs(prop.focusX) === 3.1 ? 1.05 : 0.72, prop.focusZ);
    proxy.userData = { targetKind: 'greenhouse_prop', targetId: prop.id };
    group.add(proxy);
    hitProxies.push(proxy);
  }

  // ---------------------------------------------------------------------
  // Reactive update — zero per-frame allocation, idle sway + stage visibility
  // ---------------------------------------------------------------------
  function update(world: WorldState, phase: TimePhase, elapsed: number): void {
    // BUILD 03 5.2c — keepsake echo toggle (single derivation source)
    wreathEcho.visible = composeProgressionVisualState(world).keepsakeEchoes.some(
      (e) => e.residentId === 'mina',
    );
    const gh = world.greenhouseState;

    // Pass 24: seasonal dressing answers the calendar (visual-only, zero alloc)
    const season = world.season ?? getSeasonForDay(world.day).season;
    seasonLife.spring.visible = season === 'spring';
    seasonLife.summer.visible = season === 'summer';
    seasonLife.autumn.visible = season === 'autumn';
    seasonLife.winter.visible = season === 'winter';

    for (let i = 0; i < GREENHOUSE_PLOT_COUNT; i++) {
      const plot = gh?.plots?.[i];
      const sprout = plotSproutGroups[i];
      const leafy = plotLeafyGroups[i];
      const blooms = plotBloomGroups[i];
      const stage = plot?.cropId ? plot.stage : -1;
      if (sprout) sprout.visible = stage === 1;
      if (leafy) leafy.visible = stage === 2;
      for (const crop of GREENHOUSE_CROPS) {
        const bloom = blooms[crop.id];
        if (bloom) {
          bloom.visible = stage === 3 && plot?.cropId === crop.id;
          if (bloom.visible) {
            bloom.rotation.z = Math.sin(elapsed * 1.3 + i * 1.7) * 0.035;
            bloom.rotation.x = Math.cos(elapsed * 1.1 + i) * 0.025;
          }
        }
      }
      // Watered soil reads darker & richer
      const damp = plot?.wateredToday === true;
      for (const soil of [soilMeshes[i * 2], soilMeshes[i * 2 + 1]]) {
        if (soil) {
          soil.material = damp ? soilWetMat : soilDryMat;
        }
      }
    }

    // Phase lighting: glass daylight floods the room by day, lantern warms it at dusk
    if (phase === 'dusk') {
      lanternLight.intensity = 1.35 + Math.sin(elapsed * 3.4) * 0.09;
      lanternMat.emissiveIntensity = 1.6 + Math.sin(elapsed * 4.4) * 0.14;
      shaftMat.opacity = 0.06;
      moteMat.opacity = 0.16;
      glassKeyLight.intensity = 0.24;
    } else if (phase === 'golden') {
      lanternLight.intensity = 0.42;
      lanternMat.emissiveIntensity = 0.5;
      shaftMat.opacity = 0.26 + Math.sin(elapsed * 0.7) * 0.03;
      moteMat.opacity = 0.32;
      glassKeyLight.intensity = 0.42;
    } else {
      lanternLight.intensity = 0.0;
      lanternMat.emissiveIntensity = 0.18;
      shaftMat.opacity = phase === 'morning' ? 0.34 : 0.2;
      moteMat.opacity = 0.3;
      glassKeyLight.intensity = phase === 'morning' ? 0.6 : 0.5;
    }

    // Drifting pollen motes inside the sun shafts
    const moteArr = moteGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < MOTE_COUNT; i++) {
      const i3 = i * 3;
      moteArr[i3] = moteBase[i3] + Math.sin(elapsed * 0.32 + i * 1.7) * 0.09;
      moteArr[i3 + 1] = moteBase[i3 + 1] + Math.sin(elapsed * 0.46 + i * 0.9) * 0.11;
      moteArr[i3 + 2] = moteBase[i3 + 2] + Math.cos(elapsed * 0.38 + i * 2.1) * 0.07;
    }
    moteGeo.attributes.position.needsUpdate = true;
  }

  function dispose(): void {
    for (const g of ownedGeos) g.dispose();
    for (const m of ownedMats) m.dispose();
  }

  return {
    group,
    hitProxies,
    plotStageGroups,
    plotBloomGroups,
    plotSproutGroups,
    plotLeafyGroups,
    seasonLife,
    update,
    dispose,
  };
}

/**
 * Exterior Sunbeam Greenhouse doorway: cedar door in the west glass wall with brass knob,
 * step stone, hanging lantern and a small planted sign. Positioned by the canvas at the
 * west glazing plane (x ≈ 11.53, z = 3.2) facing the plaza, with its raycast proxy mounted
 * separately. The planted sign sits inside the vestibule's north edge (local x 0.85).
 */
export function buildSunbeamGreenhouseDoorway(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
): THREE.Group {
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

  const cedarDarkMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.74, 0.04);
  const doorMat = palette.standard(STORYBOOK_PALETTE.doorCedar, 0.68, 0.04);
  const sageMat = palette.standard(STORYBOOK_PALETTE.sageShutter, 0.7, 0.02);
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.25, 0.86);
  const limestoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.88, 0.02);
  const foliageMat = palette.standard(STORYBOOK_PALETTE.foliageMid, 0.8, 0.0);

  // Cedar door panel with rails + small glass window
  const panel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.12, 1.92, 0.09)), doorMat);
  panel.position.set(0, 0.96, 0);
  panel.castShadow = true;
  group.add(panel);
  const railGeo = trackGeo(new THREE.BoxGeometry(1.02, 0.09, 0.11));
  for (const ry of [0.5, 1.28, 1.72]) {
    const rail = new THREE.Mesh(railGeo, cedarDarkMat);
    rail.position.set(0, ry, 0.01);
    group.add(rail);
  }
  const doorWindow = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.44, 0.5, 0.05)),
    palette.standard('#D2ECEB', 0.14, 0.1),
  );
  doorWindow.position.set(0, 1.5, 0.02);
  group.add(doorWindow);

  // Frame posts + lintel
  for (const px of [-0.64, 0.64]) {
    const post = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 2.24, 0.16)), cedarDarkMat);
    post.position.set(px, 1.12, 0);
    post.castShadow = true;
    group.add(post);
  }
  const lintel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.52, 0.14, 0.18)), cedarDarkMat);
  lintel.position.set(0, 2.24, 0);
  group.add(lintel);

  // Brass knob + hook latch
  const knob = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.05, 8, 7)), brassMat);
  knob.position.set(-0.44, 1.0, 0.1);
  group.add(knob);

  // Hanging lantern beside the door
  const lantern = new THREE.Group();
  const cage = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.095, 0.17, 6)), palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.45, 0.65));
  const glow = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.055, 0.07, 0.12, 6)),
    trackMat(
      new THREE.MeshStandardMaterial({
        color: '#FFE8AD',
        emissive: '#FFC470',
        emissiveIntensity: 0.5,
        roughness: 0.4,
        metalness: 0.04,
      }),
    ),
  );
  glow.position.y = 0.005;
  lantern.add(cage, glow);
  lantern.position.set(-0.92, 1.95, 0.06);
  group.add(lantern);

  // Planted sign with sage frame (tucked inside the vestibule's north post line)
  const signBoard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.52, 0.2, 0.04)), sageMat);
  signBoard.position.set(0.85, 1.14, 0.05);
  signBoard.rotation.z = 0.03;
  group.add(signBoard);
  const signPost = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.03, 0.035, 1.1, 6)), cedarDarkMat);
  signPost.position.set(0.85, 0.55, 0.05);
  group.add(signPost);

  // Step stone + a pair of potted starts flanking the entrance
  const step = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.15, 0.09, 0.66)), limestoneMat);
  step.position.set(0, 0.045, 0.62);
  step.receiveShadow = true;
  group.add(step);
  for (const px of [-0.72, 0.72]) {
    const pot = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.13, 0.1, 0.18, 9)),
      palette.standard(STORYBOOK_PALETTE.terracottaPot, 0.58, 0.04),
    );
    pot.position.set(px, 0.09, 0.5);
    pot.castShadow = true;
    group.add(pot);
    const start = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.085, 7, 6)), foliageMat);
    start.position.set(px, 0.24, 0.5);
    group.add(start);
  }

  addStaticContactShadow(group, shadowTex, 2.4, 1.6, 0.4, 0.018);

  group.userData.dispose = () => {
    for (const g of ownedGeos) g.dispose();
    for (const m of ownedMats) m.dispose();
  };

  return group;
}
