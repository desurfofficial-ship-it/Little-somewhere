import * as THREE from 'three';
import { NOOK_INTERACTABLES, NOOK_SEAT_SPOTS, getFeaturedBookForDay } from '../../game/bookNook';
import { TimePhase, WorldState } from '../../game/types';
import { getSeasonForDay } from '../../game/time';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';
import { attachPorchSeasonLife, createPorchSeasonLife } from './porchSeasonLife';
import { addStaticContactShadow } from '../contactShadows';
import { buildCopperKettle } from './interiorKit';
import { composeProgressionVisualState } from '../../game/progressionVisuals';

/**
 * Linden Book Nook Interior Cutaway Diorama (Milestone 3 Build 8).
 *
 * Mirrors `NOOK_BOUNDS` (-2.5..2.5 x -2.4..2.4) and the exact furniture footprints of
 * `NOOK_INTERIOR_OBSTACLES` & `NOOK_INTERACTABLES` in `src/game/bookNook.ts`.
 * North + West walls rise tall around the bookshelf wall and tea console; South + East
 * edges step down to cutaway wainscot so the isometric camera reads cleanly into the
 * paper-and-lamp-oil reading corner. The reactive layer: the tea kettle steams only on
 * days a reader's cup was poured, the open book appears beside the armchair after the
 * shelf's featured book was browsed, and the reading lamp warms the room at dusk.
 */
export interface LindenBookNookInteriorRig {
  group: THREE.Group;
  hitProxies: THREE.Mesh[];
  /** Warm reading-lamp light near the armchair (dusk fallback). */
  readingLampLight: THREE.PointLight;
  /** Tea steam group above the kettle — visible only when a cup was poured today. */
  teaSteamGroup: THREE.Group;
  /** Open book on the armchair side table — visible after browsing the featured book. */
  openBookGroup: THREE.Group;
  /**
   * Pass 23 "Reading Seasons": per-season dressing groups, all built hidden and
   * gated by `world.season` inside `update()`. Visual-only — no obstacle,
   * interactable, or the reading-armchair seat is touched.
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

export function buildLindenBookNookInterior(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
  _options: { isSoftwareGl?: boolean } = {},
): LindenBookNookInteriorRig {
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
  const darkStoneMat = palette.standard(STORYBOOK_PALETTE.fieldstoneDark, 0.9, 0.02, { mapSet: 'stone' });
  const limestoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.88, 0.02, { mapSet: 'stone' });
  const creamMat = palette.standard(STORYBOOK_PALETTE.creamTrim, 0.78, 0.02, { mapSet: 'timber-light' });
  const plasterMat = palette.standard('#E8DEC9', 0.86, 0.02, { mapSet: 'plaster' }); // nook wall cream (matches exterior)
  const cedarDarkMat = palette.standard('#5D4438', 0.74, 0.04); // nook trim brown (matches exterior)
  const cedarWarmMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.72, 0.04, { mapSet: 'timber-dark' });
  const doorMat = palette.standard('#7A5463', 0.7, 0.04, { mapSet: 'timber-dark' }); // awning plum, echoes the shop front
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.25, 0.86);
  const ironMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.45, 0.65);
  const copperMat = palette.standard('#C56B45', 0.28, 0.78);
  const linenMat = palette.standard('#F5EEE0', 0.88, 0.0, { mapSet: 'fabric' });
  const linenPlumMat = palette.standard('#7A5463', 0.82, 0.0, { mapSet: 'fabric' });
  const ceramicMat = palette.standard(STORYBOOK_PALETTE.ceramicCream, 0.4, 0.04);
  const mossMat = palette.standard(STORYBOOK_PALETTE.moss, 0.84, 0.0);
  const floorWoodMat = palette.standard('#B99B72', 0.82, 0.03, { mapSet: 'timber-light' });
  const rugMat = palette.standard('#A8B8A0', 0.9, 0.0, { mapSet: 'fabric' });
  const rugFringeMat = palette.standard('#E9D9B8', 0.9, 0.0);

  // Book spine colors (mirrors the outdoor book cart palette)
  const bookMats = ['#B5544A', '#4D7B64', '#5878A3', '#D69E4E', '#836391'].map((c) =>
    palette.standard(c, 0.72, 0.02),
  );

  // Per-instance dynamic materials
  const windowGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#CFE6DF',
      roughness: 0.16,
      metalness: 0.06,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const shaftMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: '#FFE9BC',
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const moteMat = trackMat(
    new THREE.PointsMaterial({
      color: '#FFF4DE',
      size: 0.04,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
  );
  // Pass 23 seasonal accents (registry-cached + one tracked translucent frost)
  const frostMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#EAF4F1',
      roughness: 0.42,
      metalness: 0.0,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    }),
  );
  const blossomMat = palette.standard('#F2C4CC', 0.6, 0.0);
  const sunflowerMat = palette.standard('#E9B23C', 0.72, 0.0);
  const leafAutumnMat = palette.standard('#C4762F', 0.8, 0.0);
  const leafRustMat = palette.standard('#A85030', 0.8, 0.0);
  const lampMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#FFE8AD',
      emissive: '#FFC470',
      emissiveIntensity: 0.25,
      roughness: 0.4,
      metalness: 0.04,
    }),
  );
  const lampShadeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#E8B86B',
      emissive: '#D98E3C',
      emissiveIntensity: 0.12,
      roughness: 0.62,
      metalness: 0.02,
    }),
  );
  const steamMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: '#FDF7EA',
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
  );
  const pageMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#F6EDD8',
      emissive: '#FFF3D6',
      emissiveIntensity: 0.06,
      roughness: 0.9,
      metalness: 0.0,
    }),
  );
  const hitProxyMat = trackMat(new THREE.MeshBasicMaterial({ visible: false }));

  // Reading lamp light near the armchair + ambient dusk fill
  const readingLampLight = new THREE.PointLight('#FFD9A0', 0, 6.5, 1.8);
  readingLampLight.position.set(-1.0, 1.6, 1.5);
  group.add(readingLampLight);

  // ---------------------------------------------------------------------
  // 1. Foundation plinth, wood floor & reading rug
  // ---------------------------------------------------------------------
  const plinth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.5, 0.24, 5.2)), darkStoneMat);
  plinth.position.set(0, -0.15, 0);
  plinth.receiveShadow = true;
  group.add(plinth);

  const floorDeck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.2, 0.06, 4.9)), floorWoodMat);
  floorDeck.position.set(0, -0.02, 0);
  floorDeck.receiveShadow = true;
  group.add(floorDeck);

  // Oval-ish reading rug under the armchair corner
  const rug = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.15, 1.15, 0.03, 18)), rugMat);
  rug.position.set(-0.75, 0.015, 1.05);
  rug.scale.set(1.0, 1.0, 0.86);
  rug.receiveShadow = true;
  group.add(rug);
  const rugRim = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.22, 1.22, 0.022, 18)), rugFringeMat);
  rugRim.position.set(-0.75, 0.008, 1.05);
  rugRim.scale.set(1.0, 1.0, 0.86);
  group.add(rugRim);

  // ---------------------------------------------------------------------
  // 2. Room shell: tall north/west walls, cutaway south/east wainscot
  // ---------------------------------------------------------------------
  const wallHeight = 2.6;
  // North wall (z = -2.4) behind the bookshelf
  const northWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.1, wallHeight, 0.16)), plasterMat);
  northWall.position.set(0, 0.8 + wallHeight / 2, -2.42);
  group.add(northWall);
  const northWainscot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.1, 0.72, 0.18)), cedarWarmMat);
  northWainscot.position.set(0, 0.42, -2.4);
  northWainscot.castShadow = true;
  group.add(northWainscot);
  // Shelf-wall crown + little ladder rail
  const shelfCrown = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.7, 0.1, 0.24)), cedarDarkMat);
  shelfCrown.position.set(-0.68, 2.52, -2.34);
  group.add(shelfCrown);

  // Phase B implied-space architecture (audit §7.3): a closed STACKS door on the
  // north wall's free east segment (east of the bookshelf wall) implying the archive
  // room behind it, with a small returns-stack on the wainscot ledge beside it.
  // Wall-mounted visual only: no obstacle, interactable, or bounds change.
  const stacksDoor = new THREE.Group();
  stacksDoor.position.set(1.75, 0, -2.38);
  for (const fx of [-0.5, 0.5]) {
    const post = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.11, 2.14, 0.15)), cedarDarkMat);
    post.position.set(fx, 1.07, 0.02);
    stacksDoor.add(post);
  }
  const stacksLintel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.12, 0.13, 0.17)), cedarDarkMat);
  stacksLintel.position.set(0, 2.2, 0.02);
  stacksDoor.add(stacksLintel);
  const stacksLeaf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.9, 1.92, 0.08)), doorMat);
  stacksLeaf.position.set(0, 0.97, 0.06);
  stacksLeaf.castShadow = true;
  stacksDoor.add(stacksLeaf);
  const stacksRailGeo = trackGeo(new THREE.BoxGeometry(0.8, 0.08, 0.1));
  for (const ry of [0.48, 1.28]) {
    const rail = new THREE.Mesh(stacksRailGeo, cedarDarkMat);
    rail.position.set(0, ry, 0.09);
    stacksDoor.add(rail);
  }
  const stacksKnob = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.042, 8, 7)), brassMat);
  stacksKnob.position.set(-0.32, 1.0, 0.12);
  stacksDoor.add(stacksKnob);
  group.add(stacksDoor);
  // Returns stack: two leaning books + a folded lending slip on the wainscot ledge
  const returnsStack = new THREE.Group();
  returnsStack.position.set(2.3, 0, -2.36);
  const slip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.015, 0.22)), linenMat);
  slip.position.set(0, 0.745, 0.02);
  slip.rotation.y = 0.3;
  returnsStack.add(slip);
  const rbA = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.09, 0.24, 0.14)), bookMats[0]);
  rbA.position.set(-0.03, 0.87, 0.01);
  rbA.rotation.z = 0.08;
  const rbB = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.09, 0.22, 0.13)), bookMats[2]);
  rbB.position.set(0.05, 0.85, 0.03);
  rbB.rotation.z = -0.14;
  returnsStack.add(rbA, rbB);
  group.add(returnsStack);

  // West wall (x = -2.5) with a reading window above the tea console
  const westWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, wallHeight, 4.9)), plasterMat);
  westWall.position.set(-2.52, 0.8 + wallHeight / 2, 0);
  group.add(westWall);
  const westWainscot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.72, 4.9)), cedarWarmMat);
  westWainscot.position.set(-2.5, 0.42, 0);
  westWainscot.castShadow = true;
  group.add(westWainscot);
  const westWindow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.95, 1.2)), windowGlassMat);
  westWindow.position.set(-2.54, 1.8, 0.3);
  group.add(westWindow);
  const westWindowTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 1.09, 1.34)), creamMat);
  westWindowTrim.position.set(-2.52, 1.8, 0.3);
  group.add(westWindowTrim);
  const westSill = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 0.08, 1.4)), limestoneMat);
  westSill.position.set(-2.48, 1.27, 0.3);
  group.add(westSill);

  // East wall (x = +2.5) — cutaway dwarf wainscot + header; door opening centered z 0
  const eastWainscotNorth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.72, 1.7)), cedarWarmMat);
  eastWainscotNorth.position.set(2.5, 0.42, -1.55);
  eastWainscotNorth.castShadow = true;
  group.add(eastWainscotNorth);
  const eastWainscotSouth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.72, 1.7)), cedarWarmMat);
  eastWainscotSouth.position.set(2.5, 0.42, 1.55);
  eastWainscotSouth.castShadow = true;
  group.add(eastWainscotSouth);
  const eastHeader = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.75, 4.9)), plasterMat);
  eastHeader.position.set(2.52, 2.85, 0);
  group.add(eastHeader);
  const eastHeaderBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.15, 1.2)), cedarDarkMat);
  eastHeaderBeam.position.set(2.5, 2.28, 0);
  group.add(eastHeaderBeam);

  // South wall (z = +2.4) — cutaway dwarf + header
  const southWainscotWest = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.9, 0.72, 0.18)), cedarWarmMat);
  southWainscotWest.position.set(-1.55, 0.42, 2.4);
  southWainscotWest.castShadow = true;
  group.add(southWainscotWest);
  const southWainscotEast = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.8, 0.72, 0.18)), cedarWarmMat);
  southWainscotEast.position.set(1.55, 0.42, 2.4);
  southWainscotEast.castShadow = true;
  group.add(southWainscotEast);
  const southHeader = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.1, 0.8, 0.2)), plasterMat);
  southHeader.position.set(0, 2.8, 2.42);
  group.add(southHeader);

  // Corner posts
  const postGeo = trackGeo(new THREE.BoxGeometry(0.15, 2.72, 0.15));
  const cornerPosts: Array<[number, number]> = [
    [-2.44, -2.36],
    [2.44, -2.36],
    [-2.44, 2.36],
    [2.44, 2.36],
  ];
  for (const [px, pz] of cornerPosts) {
    const post = new THREE.Mesh(postGeo, cedarWarmMat);
    post.position.set(px, 1.4, pz);
    post.castShadow = true;
    group.add(post);
  }
  // Ceiling beam with a hanging reading lamp over the rug edge
  const ceilingBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.8, 0.11, 0.16)), cedarDarkMat);
  ceilingBeam.position.set(0, 2.42, -0.5);
  group.add(ceilingBeam);

  // ---------------------------------------------------------------------
  // 3. Bookshelf wall (north) — mirrors nook_shelf obstacle
  // ---------------------------------------------------------------------
  const shelfGroup = new THREE.Group();
  shelfGroup.position.set(-0.68, 0, -2.0);
  addStaticContactShadow(shelfGroup, shadowTex, 3.6, 0.9, 0.42, 0.018);

  const shelfBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.5, 1.9, 0.62)), cedarWarmMat);
  shelfBody.position.set(0, 1.0, -0.08);
  shelfBody.castShadow = true;
  shelfGroup.add(shelfBody);
  const shelfBack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(3.5, 1.9, 0.06)), cedarDarkMat);
  shelfBack.position.set(0, 1.0, -0.32);
  shelfGroup.add(shelfBack);

  // Four shelf boards with rows of colorful book spines
  const spineGeo = trackGeo(new THREE.BoxGeometry(0.055, 0.3, 0.17));
  const boardGeo = trackGeo(new THREE.BoxGeometry(3.44, 0.05, 0.5));
  const shelfRows: Array<[number, number]> = [
    [0.55, 14],
    [1.0, 13],
    [1.45, 14],
    [1.86, 12],
  ];
  for (const [ry, count] of shelfRows) {
    const board = new THREE.Mesh(boardGeo, cedarDarkMat);
    board.position.set(0, ry, -0.02);
    shelfGroup.add(board);
    for (let i = 0; i < count; i++) {
      const spine = new THREE.Mesh(spineGeo, bookMats[(i + ry * 7) % bookMats.length]);
      const x = -1.62 + (i + 0.5) * (3.2 / count);
      const lean = i % 7 === 3 ? 0.16 : 0;
      spine.position.set(x, ry + 0.17, 0.12);
      spine.rotation.z = lean;
      spine.scale.y = 0.82 + ((i * 13 + ry * 3) % 5) * 0.05;
      shelfGroup.add(spine);
    }
  }
  // Shelf-top keepsakes: small plant, bookend owl, folded reading glasses
  const shelfPlant = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.11, 7, 6)), mossMat);
  shelfPlant.position.set(-1.55, 2.12, 0.0);
  shelfGroup.add(shelfPlant);
  const shelfPlantPot = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.07, 0.06, 0.1, 8)), terracottaSafe(palette));
  shelfPlantPot.position.set(-1.55, 2.0, 0.0);
  shelfGroup.add(shelfPlantPot);
  const bookend = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.07, 0.16, 6)), brassMat);
  bookend.position.set(1.6, 2.06, 0.0);
  shelfGroup.add(bookend);

  group.add(shelfGroup);

  // ---------------------------------------------------------------------
  // 4. Nora's lending desk (south) — mirrors nook_desk obstacle
  // ---------------------------------------------------------------------
  const deskGroup = new THREE.Group();
  deskGroup.position.set(0.55, 0, 2.02);
  addStaticContactShadow(deskGroup, shadowTex, 1.9, 0.9, 0.42, 0.018);

  const deskTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.72, 0.08, 0.62)), cedarWarmMat);
  deskTop.position.y = 0.84;
  deskTop.castShadow = true;
  deskGroup.add(deskTop);
  for (const lx of [-0.74, 0.74]) {
    const leg = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.84, 0.1)), cedarDarkMat);
    leg.position.set(lx, 0.42, 0);
    deskGroup.add(leg);
  }
  const deskFront = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.6, 0.4, 0.05)), cedarDarkMat);
  deskFront.position.set(0, 0.62, 0.2);
  deskGroup.add(deskFront);

  // Oilcloth lending ledger with a tea-ring stain + brass pen
  const ledger = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.4, 0.04, 0.3)), linenPlumMat);
  ledger.position.set(-0.45, 0.9, 0.02);
  ledger.rotation.y = 0.22;
  deskGroup.add(ledger);
  const ledgerPages = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, 0.015, 0.24)), linenMat);
  ledgerPages.position.set(-0.45, 0.925, 0.02);
  ledgerPages.rotation.y = 0.22;
  deskGroup.add(ledgerPages);
  const pen = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.012, 0.014, 0.2, 6)), brassMat);
  pen.rotation.z = Math.PI / 2;
  pen.rotation.y = 0.5;
  pen.position.set(-0.08, 0.9, 0.08);
  deskGroup.add(pen);
  // A returned stack of borrowable books
  const stackGeo = trackGeo(new THREE.BoxGeometry(0.26, 0.05, 0.19));
  for (let i = 0; i < 3; i++) {
    const bk = new THREE.Mesh(stackGeo, bookMats[(i * 2 + 1) % bookMats.length]);
    bk.position.set(0.45, 0.91 + i * 0.05, 0.02);
    bk.rotation.y = 0.3 - i * 0.18;
    deskGroup.add(bk);
  }
  // Small desk lamp with warm shade
  const lampBase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.08, 0.04, 8)), ironMat);
  lampBase.position.set(0.72, 0.9, -0.14);
  deskGroup.add(lampBase);
  const lampStem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.016, 0.02, 0.3, 6)), ironMat);
  lampStem.position.set(0.72, 1.06, -0.14);
  lampStem.rotation.z = 0.12;
  deskGroup.add(lampStem);
  const lampShade = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.1, 0.12, 9, 1, true)), lampShadeMat);
  lampShade.position.set(0.74, 1.24, -0.14);
  deskGroup.add(lampShade);

  group.add(deskGroup);

  // ---------------------------------------------------------------------
  // 5. Reader's tea tray console (west wall) — mirrors nook_tea obstacle
  // ---------------------------------------------------------------------
  const teaGroup = new THREE.Group();
  teaGroup.position.set(-2.06, 0, 0.35);
  addStaticContactShadow(teaGroup, shadowTex, 0.9, 1.9, 0.4, 0.018);

  const teaConsole = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.68, 0.08, 1.7)), cedarWarmMat);
  teaConsole.position.y = 0.86;
  teaConsole.castShadow = true;
  teaGroup.add(teaConsole);
  for (const tz of [-0.72, 0.72]) {
    const leg = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.86, 0.1)), cedarDarkMat);
    leg.position.set(0, 0.43, tz);
    teaGroup.add(leg);
  }

  // Little copper kettle + stoneware cups + honey pot.
  // BUILD 02 (Doc 05 §4.2.3): petite kit kettle — same four-part recipe, room
  // identity kept (r 0.13 sphere), lid lathe-crowned.
  const kettle = buildCopperKettle(palette, trackGeo, { style: 'petite', bodyMat: copperMat });
  kettle.group.position.set(-0.02, 1.06, -0.3);
  teaGroup.add(kettle.group);

  const cupGeo = trackGeo(new THREE.CylinderGeometry(0.05, 0.04, 0.07, 9));
  for (const [cx, cz] of [
    [0.02, 0.28],
    [-0.05, 0.55],
  ] as Array<[number, number]>) {
    const cup = new THREE.Mesh(cupGeo, ceramicMat);
    cup.position.set(cx, 0.94, cz);
    teaGroup.add(cup);
    const saucer = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.085, 0.085, 0.018, 10)), ceramicMat);
    saucer.position.set(cx, 0.905, cz);
    teaGroup.add(saucer);
  }
  const honeyPot = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.055, 0.06, 0.1, 8)), ceramicMat);
  honeyPot.position.set(-0.02, 0.95, 0.0);
  teaGroup.add(honeyPot);

  // BUILD 03 5.2c — keepsake echo: Pip's willow_zine_copy rests on the nook counter
  // once the zine arc's gift was actually granted (neighborGiftsReceived — the story
  // true place: "Issue #1 on the Counter"). Derived; zero save impact.
  const zineEcho = new THREE.Group();
  zineEcho.position.set(0.12, 0.9, 0.68);
  zineEcho.rotation.y = -0.3;
  zineEcho.visible = false;
  const zineEchoBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.13, 0.024, 0.17)), linenMat);
  const zineEchoStitch = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.012, 0.008, 0.15)), linenPlumMat);
  zineEcho.add(zineEchoBody, zineEchoStitch);
  teaGroup.add(zineEcho);

  // Tea steam group (pooled puffs above the kettle spout)
  const teaSteamGroup = new THREE.Group();
  const steamPuffGeo = trackGeo(new THREE.SphereGeometry(0.06, 7, 6));
  const steamPuffs: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const puff = new THREE.Mesh(steamPuffGeo, steamMat);
    puff.visible = false;
    teaSteamGroup.add(puff);
    steamPuffs.push(puff);
  }
  teaSteamGroup.position.set(0.13, 1.16, -0.3);
  teaGroup.add(teaSteamGroup);

  group.add(teaGroup);

  // ---------------------------------------------------------------------
  // 6. Reading armchair (south-west) — mirrors nook_chair obstacle + indoor seat
  // ---------------------------------------------------------------------
  const chairGroup = new THREE.Group();
  chairGroup.position.set(-0.9, 0, 1.6);
  addStaticContactShadow(chairGroup, shadowTex, 1.2, 1.2, 0.42, 0.018);

  const cushion = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.95, 0.32, 0.95)), linenPlumMat);
  cushion.position.y = 0.36;
  cushion.castShadow = true;
  chairGroup.add(cushion);
  const chairBack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.95, 0.7, 0.22)), linenPlumMat);
  chairBack.position.set(0, 0.72, -0.36);
  chairBack.rotation.x = -0.12;
  chairGroup.add(chairBack);
  const armWest = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.2, 0.26, 0.9)), linenMat);
  armWest.position.set(-0.44, 0.62, 0.0);
  chairGroup.add(armWest);
  const armEast = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.2, 0.26, 0.9)), linenMat);
  armEast.position.set(0.44, 0.62, 0.0);
  chairGroup.add(armEast);
  for (const [lx, lz] of [
    [-0.4, -0.38],
    [0.4, -0.38],
    [-0.4, 0.38],
    [0.4, 0.38],
  ] as Array<[number, number]>) {
    const leg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.035, 0.045, 0.2, 6)), cedarDarkMat);
    leg.position.set(lx, 0.1, lz);
    chairGroup.add(leg);
  }

  // Side table + the reactive open book + quilt fold
  const sideTable = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.16, 0.18, 0.5, 9)), cedarWarmMat);
  sideTable.position.set(0.78, 0.25, 0.1);
  chairGroup.add(sideTable);
  const openBookGroup = new THREE.Group();
  const pageL = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.02, 0.2)), pageMat);
  pageL.rotation.y = -0.18;
  const pageR = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.02, 0.2)), pageMat);
  pageR.rotation.y = 0.18;
  pageR.position.x = 0.14;
  pageL.position.x = -0.14;
  const bookCover = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.44, 0.016, 0.24)), bookMats[1]);
  openBookGroup.add(bookCover, pageL, pageR);
  openBookGroup.position.set(0.78, 0.53, 0.1);
  openBookGroup.rotation.y = 0.4;
  openBookGroup.visible = false;
  chairGroup.add(openBookGroup);

  const quilt = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.6, 0.05, 0.4)), rugFringeMat);
  quilt.position.set(-0.08, 0.54, 0.18);
  quilt.rotation.y = 0.2;
  chairGroup.add(quilt);

  group.add(chairGroup);

  // ---------------------------------------------------------------------
  // 7. Interior door (east wall) + coat hook
  // ---------------------------------------------------------------------
  const doorGroup = new THREE.Group();
  doorGroup.position.set(2.42, 0, 0);
  const doorPanel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.09, 1.9, 1.0)), doorMat);
  doorPanel.position.set(0, 0.97, 0);
  doorPanel.castShadow = true;
  doorGroup.add(doorPanel);
  const doorRailGeo = trackGeo(new THREE.BoxGeometry(0.1, 0.09, 0.9));
  for (const ry of [0.42, 1.24, 1.66]) {
    const rail = new THREE.Mesh(doorRailGeo, cedarDarkMat);
    rail.position.set(0.01, ry, 0);
    doorGroup.add(rail);
  }
  const doorWindow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.4, 0.38)), windowGlassMat);
  doorWindow.position.set(0.02, 1.45, 0);
  doorGroup.add(doorWindow);
  const knob = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.045, 8, 7)), brassMat);
  knob.position.set(-0.07, 1.0, -0.36);
  doorGroup.add(knob);
  // Coat hook with a hanging scarf by the door
  const hookRailNook = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.05, 0.4)), cedarDarkMat);
  hookRailNook.position.set(-0.02, 1.86, 0.62);
  doorGroup.add(hookRailNook);
  const scarf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.04, 0.34, 0.12)), rugFringeMat);
  scarf.position.set(-0.06, 1.66, 0.72);
  doorGroup.add(scarf);
  group.add(doorGroup);

  // ---------------------------------------------------------------------
  // 8. Reading floor lamp (beside the armchair) + window shaft + motes
  // ---------------------------------------------------------------------
  const floorLamp = new THREE.Group();
  const floorLampBase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.11, 0.13, 0.05, 9)), ironMat);
  floorLampBase.position.y = 0.03;
  floorLamp.add(floorLampBase);
  const floorLampStem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.02, 0.025, 1.35, 7)), ironMat);
  floorLampStem.position.y = 0.7;
  floorLamp.add(floorLampStem);
  const floorLampShade = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.2, 0.22, 10, 1, true)), lampShadeMat);
  floorLampShade.position.y = 1.45;
  floorLamp.add(floorLampShade);
  const floorLampGlow = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.07, 8, 7)), lampMat);
  floorLampGlow.position.y = 1.42;
  floorLamp.add(floorLampGlow);
  floorLamp.position.set(-1.7, 0, 2.0);
  floorLamp.rotation.y = 0.6;
  group.add(floorLamp);

  const shaftGeo = trackGeo(new THREE.PlaneGeometry(1.4, 3.2));
  const shaftA = new THREE.Mesh(shaftGeo, shaftMat);
  shaftA.position.set(-2.0, 1.65, 0.3);
  shaftA.rotation.y = Math.PI / 2.2;
  shaftA.rotation.x = 0.15;
  group.add(shaftA);

  const MOTE_COUNT = 20;
  const moteGeo = trackGeo(new THREE.BufferGeometry());
  const moteBase = new Float32Array(MOTE_COUNT * 3);
  for (let i = 0; i < MOTE_COUNT; i++) {
    moteBase[i * 3] = -2.0 + (i % 10) * 0.4;
    moteBase[i * 3 + 1] = 0.5 + ((i * 7) % 13) * 0.13;
    moteBase[i * 3 + 2] = -1.6 + ((i * 5) % 14) * 0.23;
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(moteBase.slice(), 3));
  const motes = new THREE.Points(moteGeo, moteMat);
  group.add(motes);

  // ---------------------------------------------------------------------
  // 8.5 Pass 23 "Reading Seasons" — per-season dressing, all built hidden and
  //     gated by world.season in update(). Pieces hug wall/sill/beam planes or
  //     rest on furniture tops; the walkable floor, obstacles, interactables
  //     and the armchair seat read unchanged.
  // ---------------------------------------------------------------------
  const seasonLife = {
    spring: new THREE.Group(),
    summer: new THREE.Group(),
    autumn: new THREE.Group(),
    winter: new THREE.Group(),
  };
  seasonLife.spring.name = 'nook_season_spring';
  seasonLife.summer.name = 'nook_season_summer';
  seasonLife.autumn.name = 'nook_season_autumn';
  seasonLife.winter.name = 'nook_season_winter';

  // — Winter: plum knit blanket over the armchair's east arm + window frost + door swag —
  {
    // Armchair group origin is (-0.9, 0, 1.6); its east arm spans world x -0.56..-0.36
    const blanket = new THREE.Group();
    blanket.name = 'winter_arm_blanket';
    blanket.position.set(-0.9, 0, 1.6);
    const topSlab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.26, 0.05, 0.6)), linenPlumMat);
    topSlab.position.set(0.44, 0.765, 0);
    blanket.add(topSlab);
    const hangOuter = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.28, 0.5)), linenPlumMat);
    hangOuter.position.set(0.495, 0.61, 0);
    blanket.add(hangOuter);
    const hangInner = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.22, 0.5)), linenPlumMat);
    hangInner.position.set(0.39, 0.63, 0);
    blanket.add(hangInner);
    const band = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.27, 0.08, 0.61)), linenMat);
    band.position.set(0.44, 0.71, 0);
    blanket.add(band);
    seasonLife.winter.add(blanket);

    // Frost ferns at the west reading-window corners (glass at x ≈ -2.54, y 1.33..2.28)
    const frost = new THREE.Group();
    frost.name = 'winter_window_frost';
    for (const [fy, fz, r] of [
      [2.19, -0.18, 0.55],
      [2.19, 0.78, -0.55],
      [1.42, -0.18, -0.5],
      [1.42, 0.78, 0.5],
    ] as Array<[number, number, number]>) {
      const wedge = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.02, 0.18, 0.28)), frostMat);
      wedge.position.set(-2.49, fy, fz);
      wedge.rotation.z = r;
      frost.add(wedge);
    }
    seasonLife.winter.add(frost);

    // Evergreen swag + brass bell over the east door header beam (2.5, 2.28, 0)
    const swag = new THREE.Group();
    swag.name = 'winter_door_swag';
    swag.position.set(2.44, 2.24, 0);
    for (const [tz, ty, ts] of [
      [-0.5, -0.02, 0.8],
      [-0.25, -0.09, 1.0],
      [0.0, -0.12, 1.05],
      [0.25, -0.09, 1.0],
      [0.5, -0.02, 0.8],
    ] as Array<[number, number, number]>) {
      const tuft = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.1, 7, 6)), mossMat);
      tuft.position.set(0, ty, tz);
      tuft.scale.set(0.62, 0.55 * ts, 1.15);
      swag.add(tuft);
    }
    for (const [bz, by] of [
      [-0.36, -0.06],
      [-0.1, -0.1],
      [0.18, -0.08],
      [0.42, -0.03],
    ] as Array<[number, number]>) {
      const berry = new THREE.Mesh(
        trackGeo(new THREE.SphereGeometry(0.022, 6, 5)),
        palette.standard('#A64B3C', 0.6, 0.0),
      );
      berry.position.set(0.06, by + 0.02, bz);
      swag.add(berry);
    }
    const bellYoke = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.02, 0.05)), brassMat);
    bellYoke.position.set(0.04, -0.18, 0);
    const bellBody = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.032, 0.05, 0.065, 8)), brassMat);
    bellBody.position.set(0.04, -0.24, 0);
    swag.add(bellYoke, bellBody);
    seasonLife.winter.add(swag);
  }

  // — Spring: bud bottle with a blossom sprig on the west sill —
  {
    const bud = new THREE.Group();
    bud.name = 'spring_sill_bud';
    bud.position.set(-2.47, 1.31, -0.16);
    const bottle = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.04, 0.035, 0.11, 8)), ceramicMat);
    bottle.position.y = 0.055;
    bud.add(bottle);
    const stem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.007, 0.009, 0.26, 5)), cedarWarmMat);
    stem.position.set(0.01, 0.21, 0);
    stem.rotation.z = -0.2;
    bud.add(stem);
    for (const [fx, fy, fz, fs] of [
      [0.05, 0.3, 0.01, 1.0],
      [-0.02, 0.35, 0.02, 0.78],
      [0.02, 0.25, 0.03, 0.68],
    ] as Array<[number, number, number, number]>) {
      const bloom = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.03, 6, 5)), blossomMat);
      bloom.position.set(fx, fy, fz);
      bloom.scale.setScalar(fs);
      bud.add(bloom);
    }
    seasonLife.spring.add(bud);
  }

  // — Summer: potted mini-sunflower on the shelf top (east of the bookend owl) —
  {
    const flower = new THREE.Group();
    flower.name = 'summer_shelf_sunflower';
    flower.position.set(-0.68 + 0.75, 2.0, -2.0);
    const pot = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.055, 0.045, 0.1, 8)), terracottaSafe(palette));
    pot.position.y = 0.05;
    flower.add(pot);
    const stem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.012, 0.016, 0.24, 5)), mossMat);
    stem.position.y = 0.21;
    flower.add(stem);
    const center = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.045, 7, 6)), palette.standard('#8A5A28', 0.8, 0.0));
    center.position.y = 0.36;
    flower.add(center);
    for (let p = 0; p < 7; p++) {
      const ang = (p / 7) * Math.PI * 2;
      const petal = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.035, 6, 5)), sunflowerMat);
      petal.position.set(Math.cos(ang) * 0.075, 0.36, Math.sin(ang) * 0.075);
      petal.scale.set(1.0, 0.55, 1.0);
      flower.add(petal);
    }
    seasonLife.summer.add(flower);
  }

  // — Autumn: leaf garland on the ceiling beam + two leaves resting on the desk —
  {
    const garland = new THREE.Group();
    garland.name = 'autumn_beam_garland';
    for (let i = 0; i < 8; i++) {
      const gx = -2.1 + i * 0.6;
      const leaf = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.08, 0.012, 0.11)),
        i % 2 === 0 ? leafAutumnMat : leafRustMat,
      );
      leaf.position.set(gx, 2.33 - (i % 3) * 0.014, -0.5);
      leaf.rotation.y = (i * 2.1) % Math.PI;
      garland.add(leaf);
      const stem = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.014, 0.05, 0.02)), cedarWarmMat);
      stem.position.set(gx, 2.365, -0.5);
      garland.add(stem);
    }
    seasonLife.autumn.add(garland);

    const deskLeaves = new THREE.Group();
    deskLeaves.name = 'autumn_desk_leaves';
    for (const [lx, lz, r] of [
      [0.72, 1.78, 0.4],
      [0.9, 1.95, -0.7],
    ] as Array<[number, number, number]>) {
      const leaf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.09, 0.008, 0.12)), leafAutumnMat);
      leaf.position.set(lx, 0.887, lz);
      leaf.rotation.y = r;
      deskLeaves.add(leaf);
    }
    seasonLife.autumn.add(deskLeaves);
  }

  seasonLife.spring.visible = false;
  seasonLife.summer.visible = false;
  seasonLife.autumn.visible = false;
  seasonLife.winter.visible = false;
  group.add(seasonLife.spring, seasonLife.summer, seasonLife.autumn, seasonLife.winter);

  // ---------------------------------------------------------------------
  // 9. Interaction hit proxies (stations + reading armchair seat)
  // ---------------------------------------------------------------------
  const hitProxies: THREE.Mesh[] = [];
  const proxyGeoCache = new Map<string, THREE.BoxGeometry>();
  for (const prop of NOOK_INTERACTABLES) {
    const key = `${prop.id}_${Math.round(prop.x * 10)}`;
    let proxyGeo = proxyGeoCache.get(key);
    if (!proxyGeo) {
      proxyGeo = trackGeo(new THREE.BoxGeometry(0.62, 1.05, 0.62));
      proxyGeoCache.set(key, proxyGeo);
    }
    const proxy = new THREE.Mesh(proxyGeo, hitProxyMat);
    proxy.position.set(prop.focusX, 0.72, prop.focusZ);
    proxy.userData = { targetKind: 'nook_prop', targetId: prop.id };
    group.add(proxy);
    hitProxies.push(proxy);
  }
  const seatProxyGeo = trackGeo(new THREE.BoxGeometry(0.6, 0.95, 0.6));
  const seatProxy = new THREE.Mesh(seatProxyGeo, hitProxyMat);
  const seat = NOOK_SEAT_SPOTS[0];
  seatProxy.position.set(seat.seatPos.x, 0.6, seat.seatPos.z);
  seatProxy.userData = { targetKind: 'seat', targetId: seat.id };
  group.add(seatProxy);
  hitProxies.push(seatProxy);

  // ---------------------------------------------------------------------
  // Reactive update — zero per-frame allocation
  // ---------------------------------------------------------------------
  function update(world: WorldState, phase: TimePhase, elapsed: number): void {
    const nk = world.nookState;
    // BUILD 03 5.2c — keepsake echo toggle (single derivation source)
    zineEcho.visible = composeProgressionVisualState(world).keepsakeEchoes.some(
      (e) => e.residentId === 'pip',
    );
    const browsedToday = (nk?.shelfBrowsedDay ?? 0) === world.day;
    const teaPouredToday = (nk?.teaSharedDay ?? 0) === world.day;
    const featured = getFeaturedBookForDay(world.day);

    // Pass 23: seasonal dressing answers the calendar (visual-only, zero alloc)
    const season = world.season ?? getSeasonForDay(world.day).season;
    seasonLife.spring.visible = season === 'spring';
    seasonLife.summer.visible = season === 'summer';
    seasonLife.autumn.visible = season === 'autumn';
    seasonLife.winter.visible = season === 'winter';

    // Open book beside the armchair appears only while the day's featured book is out
    openBookGroup.visible = browsedToday;
    if (browsedToday) {
      // Cover tint follows the featured book's slot in the shelf palette
      const cover = openBookGroup.children[0] as THREE.Mesh;
      const coverIndex = NOOK_BOOK_SLOT_TINT[featured.id] ?? 1;
      cover.material = bookMats[coverIndex] ?? bookMats[1];
    }

    // Tea steam rises only when a reader's cup was poured today
    const steamOn = teaPouredToday && phase !== 'dusk';
    for (let i = 0; i < steamPuffs.length; i++) {
      const puff = steamPuffs[i];
      puff.visible = steamOn;
      if (steamOn) {
        const cycle = (elapsed * 0.4 + i * 0.25) % 1;
        puff.position.set(
          Math.sin(cycle * Math.PI * 2 + i) * 0.05,
          cycle * 0.5,
          Math.cos(cycle * Math.PI * 2 + i) * 0.04,
        );
        puff.scale.setScalar(0.5 + cycle * 0.7);
      }
    }

    // Reading lamp warms the room toward dusk; soft glow during golden hour
    if (phase === 'dusk') {
      readingLampLight.intensity = 1.25 + Math.sin(elapsed * 3.1) * 0.08;
      lampMat.emissiveIntensity = 1.5 + Math.sin(elapsed * 4.0) * 0.12;
      lampShadeMat.emissiveIntensity = 0.6;
      shaftMat.opacity = 0.05;
      moteMat.opacity = 0.13;
    } else if (phase === 'golden') {
      readingLampLight.intensity = 0.38;
      lampMat.emissiveIntensity = 0.45;
      lampShadeMat.emissiveIntensity = 0.2;
      shaftMat.opacity = 0.24 + Math.sin(elapsed * 0.7) * 0.03;
      moteMat.opacity = 0.28;
    } else {
      readingLampLight.intensity = 0.0;
      lampMat.emissiveIntensity = 0.16;
      lampShadeMat.emissiveIntensity = 0.1;
      shaftMat.opacity = phase === 'morning' ? 0.3 : 0.17;
      moteMat.opacity = 0.28;
    }

    // Drifting paper-dust motes in the window shaft
    const moteArr = moteGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < MOTE_COUNT; i++) {
      const i3 = i * 3;
      moteArr[i3] = moteBase[i3] + Math.sin(elapsed * 0.28 + i * 1.4) * 0.07;
      moteArr[i3 + 1] = moteBase[i3 + 1] + Math.sin(elapsed * 0.4 + i * 0.85) * 0.09;
      moteArr[i3 + 2] = moteBase[i3 + 2] + Math.cos(elapsed * 0.34 + i * 1.9) * 0.06;
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
    readingLampLight,
    teaSteamGroup,
    openBookGroup,
    seasonLife,
    update,
    dispose,
  };
}

/** Shelf-palette slot per featured book so the reactive open-book cover matches its spine. */
const NOOK_BOOK_SLOT_TINT: Record<string, number> = {
  ivy_letters: 4,
  pond_sketches: 2,
  bread_hymns: 0,
  night_orchard: 3,
};

/** Tiny local helper: terracotta pot material cached from the palette registry. */
function terracottaSafe(palette: MaterialPalette): THREE.Material {
  return palette.standard(STORYBOOK_PALETTE.terracottaPot, 0.58, 0.04);
}

/**
 * Small exterior porch dressing for the Book Nook's existing east door: a sage step stone,
 * a lit wall lantern accent, and a returned-book basket. Mounted by the canvas at the east
 * face of the Linden Book Nook (world position (-13.1, 0, -1.0), facing east).
 */
export function buildLindenBookNookPorchDressing(
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

  const limestoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.88, 0.02);
  const cedarDarkMat = palette.standard('#5D4438', 0.74, 0.04, { mapSet: 'timber-dark' });
  const ironMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.45, 0.65);
  const bookMats = ['#B5544A', '#4D7B64', '#5878A3'].map((c) => palette.standard(c, 0.72, 0.02));

  // Step stone under the doorway
  const step = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.72, 0.09, 1.25)), limestoneMat);
  step.position.set(0.55, 0.045, 0);
  step.receiveShadow = true;
  group.add(step);

  // Wall lantern bracket beside the door
  const bracket = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.05, 0.22)), ironMat);
  bracket.position.set(0.1, 2.0, -0.85);
  group.add(bracket);
  const lanternCage = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.095, 0.17, 6)), ironMat);
  const lanternGlow = new THREE.Mesh(
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
  lanternGlow.position.y = 0.005;
  const lantern = new THREE.Group();
  lantern.add(lanternCage, lanternGlow);
  lantern.position.set(0.22, 1.86, -0.85);
  group.add(lantern);

  // Returned-books basket on the step corner
  const basket = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.2, 0.16, 0.22, 9)), cedarDarkMat);
  basket.position.set(0.6, 0.2, 0.62);
  basket.castShadow = true;
  group.add(basket);
  const bkGeo = trackGeo(new THREE.BoxGeometry(0.16, 0.05, 0.12));
  for (let i = 0; i < 3; i++) {
    const bk = new THREE.Mesh(bkGeo, bookMats[i % bookMats.length]);
    bk.position.set(0.6, 0.33 + i * 0.045, 0.62);
    bk.rotation.y = 0.5 - i * 0.4;
    group.add(bk);
  }

  // Pass 26 "Doorways of the Lane": the reading porch keeps the seasons like the
  // cottage and bakery porches do. Pieces hug the step, the book basket, or the
  // wall bracket inside the dressing's existing footprint (local x 0..0.95,
  // z -0.95..0.95, y <= 2.3) — the lane walk band reads unchanged.
  const porchLife = createPorchSeasonLife('linden_nook');
  const soilMat = palette.standard('#4A3527', 0.92, 0.0);
  const blossomMat = palette.standard('#EFA7B4', 0.72, 0.0);
  const leafMat = palette.standard('#5F8F5C', 0.78, 0.0);
  const frostMat = palette.standard('#EAF2F6', 0.5, 0.06);
  const snowMat = palette.standard('#F4F8FA', 0.62, 0.04);
  const evergreenMat = palette.standard('#3F6B4F', 0.8, 0.0);
  const copperMat = palette.standard('#A96B4C', 0.5, 0.72);
  const cushionMat = palette.standard('#8E5D74', 0.86, 0.0);

  // Spring: a copper bud vase with a blossom sprig on the step's north end.
  {
    const vase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.055, 0.07, 0.15, 8)), copperMat);
    vase.name = 'nook_porch_spring_bud_vase';
    vase.position.set(0.55, 0.165, -0.42);
    porchLife.spring.add(vase);
    const sprigStem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.01, 0.01, 0.13, 5)), evergreenMat);
    sprigStem.position.set(0.55, 0.28, -0.42);
    sprigStem.rotation.z = 0.18;
    porchLife.spring.add(sprigStem);
    for (let b = 0; b < 4; b++) {
      const bloom = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.04, 6, 5)), blossomMat);
      bloom.name = `nook_porch_spring_bloom_${b}`;
      bloom.position.set(0.55 + (b - 1.5) * 0.055, 0.35 + (b % 2) * 0.035, -0.42 + (b - 1.5) * 0.025);
      porchLife.spring.add(bloom);
    }
  }

  // Summer: a potted mini fern + a small reading cushion on the step's south end.
  {
    const pot = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.075, 0.06, 0.11, 8)), palette.standard('#B96A4B', 0.82, 0.0));
    pot.name = 'nook_porch_summer_fern_pot';
    pot.position.set(0.84, 0.145, -0.4);
    pot.castShadow = true;
    porchLife.summer.add(pot);
    const soil = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 8)), soilMat);
    soil.position.set(0.84, 0.2, -0.4);
    porchLife.summer.add(soil);
    for (let f = 0; f < 4; f++) {
      const frond = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.022, 0.13, 5)), leafMat);
      frond.name = `nook_porch_summer_frond_${f}`;
      frond.position.set(0.84 + (f % 2 === 0 ? -0.02 : 0.02), 0.26, -0.4 + (f < 2 ? -0.02 : 0.02));
      frond.rotation.set((f - 1.5) * 0.22, f * 1.6, (f - 1.5) * -0.18);
      porchLife.summer.add(frond);
    }
    const cushion = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.26, 0.06, 0.2)), cushionMat);
    cushion.name = 'nook_porch_summer_reading_cushion';
    cushion.position.set(0.3, 0.12, 0.42);
    cushion.rotation.y = 0.3;
    porchLife.summer.add(cushion);
  }

  // Autumn: leaf scatter around the basket + a tiny pumpkin bookend guard.
  {
    const leafGeo = trackGeo(new THREE.SphereGeometry(0.04, 5, 4));
    const leafAutumnMat = palette.standard('#C97B3E', 0.82, 0.0);
    const leafSpots: Array<[number, number]> = [
      [0.34, 0.6],
      [0.86, 0.56],
      [0.58, 0.9],
      [0.62, -0.5],
    ];
    leafSpots.forEach(([lx, lz], li) => {
      const leaf = new THREE.Mesh(leafGeo, leafAutumnMat);
      leaf.name = `nook_porch_autumn_leaf_${li}`;
      leaf.scale.set(1.25, 0.35, 0.9);
      leaf.rotation.y = li * 1.1;
      leaf.position.set(lx, 0.105, lz);
      porchLife.autumn.add(leaf);
    });
    const bookend = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.085, 8, 6)), palette.standard('#D98A3D', 0.78, 0.0));
    bookend.name = 'nook_porch_autumn_pumpkin_bookend';
    bookend.scale.set(1.1, 0.72, 1.1);
    bookend.position.set(0.3, 0.1, -0.3);
    porchLife.autumn.add(bookend);
  }

  // Winter: frost ferns on the step corners, a snow cap on the returned books,
  // a berry evergreen sprig on the bracket, and a plum knit scarf on the step.
  {
    const fernGeo = trackGeo(new THREE.ConeGeometry(0.038, 0.17, 5));
    const fernSpots: Array<[number, number]> = [
      [0.28, -0.52],
      [0.84, -0.5],
      [0.28, 0.5],
    ];
    fernSpots.forEach(([fx, fz], fi) => {
      const fern = new THREE.Mesh(fernGeo, frostMat);
      fern.name = `nook_porch_winter_frost_fern_${fi}`;
      fern.rotation.set((fi - 1) * 0.3, fi * 1.7, (fi - 1) * -0.25);
      fern.position.set(fx, 0.14, fz);
      porchLife.winter.add(fern);
    });
    const bookSnow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.19, 0.07, 0.15)), snowMat);
    bookSnow.name = 'nook_porch_winter_book_snow';
    bookSnow.position.set(0.6, 0.475, 0.62);
    bookSnow.rotation.y = -0.3;
    porchLife.winter.add(bookSnow);
    const sprig = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(0.038, 0.18, 5)), evergreenMat);
    sprig.name = 'nook_porch_winter_evergreen_sprig';
    sprig.position.set(0.1, 2.03, -0.85);
    sprig.rotation.set(0.4, 0.5, 0.25);
    porchLife.winter.add(sprig);
    const berryMat = palette.standard('#C94F4F', 0.6, 0.0);
    for (let b = 0; b < 2; b++) {
      const berry = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.02, 6, 5)), berryMat);
      berry.name = `nook_porch_winter_sprig_berry_${b}`;
      berry.position.set(0.13 + b * 0.035, 2.09 - b * 0.03, -0.83);
      porchLife.winter.add(berry);
    }
    // Plum knit scarf folded on the step's lane edge (the reader's own wool).
    const scarfMat = palette.standard('#8E5D74', 0.86, 0.0);
    const scarfStripe = palette.standard('#E8DCC8', 0.86, 0.0);
    const scarf = new THREE.Group();
    scarf.name = 'nook_porch_winter_knit_scarf';
    for (let m = 0; m < 3; m++) {
      const band = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.3, 0.03, 0.16 - m * 0.03)), m % 2 === 0 ? scarfMat : scarfStripe);
      band.position.set(0.55, 0.105 + m * 0.032, 0.16);
      band.rotation.y = 0.06 * m;
      scarf.add(band);
    }
    porchLife.winter.add(scarf);
  }

  attachPorchSeasonLife(group, porchLife);

  addStaticContactShadow(group, shadowTex, 1.6, 2.0, 0.4, 0.018);

  group.userData.dispose = () => {
    for (const g of ownedGeos) g.dispose();
    for (const m of ownedMats) m.dispose();
  };

  return group;
}
