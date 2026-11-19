import * as THREE from 'three';
import { BAKERY_BOUNDS, BAKERY_INTERACTABLES, getBakeForDay } from '../../game/bakery';
import { TimePhase, WorldState } from '../../game/types';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';
import { addContactShadow } from './vegetation';

/**
 * Hearth & Crumb Bakery Interior Cutaway Diorama (Milestone 3 Build 7).
 *
 * Mirrors `BAKERY_BOUNDS` (-3.0..3.0 x -2.4..2.4) and the exact furniture footprints of
 * `BAKERY_INTERIOR_OBSTACLES` & `BAKERY_INTERACTABLES` in `src/game/bakery.ts`.
 * North + West walls rise tall around the brick dome oven and service counter; South + East
 * edges step down to cutaway plaster wainscot so the isometric camera reads cleanly into the
 * flour-warm kitchen. The reactive layer: the bake oven's ember glow and steam puffs answer
 * `world.bakeryState.bakeCheckedDay` + the deterministic daily bake roster, the wall lantern
 * warms the room at dusk, and flour-dust motes drift through the morning window shaft.
 */
export interface HearthCrumbInteriorRig {
  group: THREE.Group;
  hitProxies: THREE.Mesh[];
  /** Reactive ember glow inside the oven mouth (driven by bake/rest day state). */
  ovenEmberLight: THREE.PointLight;
  /** Steam puff group above the oven door — visible only when today's bake was checked. */
  bakeSteamGroup: THREE.Group;
  /** Counter loaf-row visibility flips on oven-rest days (nothing to share). */
  counterLoafGroup: THREE.Group;
  update(world: WorldState, phase: TimePhase, elapsed: number): void;
  dispose(): void;
}

export function buildHearthCrumbInterior(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
  _options: { isSoftwareGl?: boolean } = {},
): HearthCrumbInteriorRig {
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
  const darkStoneMat = palette.standard(STORYBOOK_PALETTE.fieldstoneDark, 0.9, 0.02);
  const limestoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.88, 0.02);
  const creamMat = palette.standard(STORYBOOK_PALETTE.creamTrim, 0.78, 0.02);
  const plasterMat = palette.standard('#F5DFC2', 0.86, 0.02); // bakery wall cream (matches exterior)
  const cedarDarkMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.74, 0.04);
  const cedarWarmMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.72, 0.04);
  const doorMat = palette.standard(STORYBOOK_PALETTE.doorCedar, 0.7, 0.04);
  const brickMat = palette.standard('#A85842', 0.86, 0.02); // matches the exterior oven dome
  const terracottaMat = palette.standard(STORYBOOK_PALETTE.terracottaPot, 0.58, 0.04);
  const ceramicMat = palette.standard(STORYBOOK_PALETTE.ceramicCream, 0.4, 0.04);
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.25, 0.86);
  const ironMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.45, 0.65);
  const copperMat = palette.standard('#C56B45', 0.28, 0.78);
  const linenMat = palette.standard('#F5EEE0', 0.88, 0.0);
  const linenRedMat = palette.standard('#CD6649', 0.82, 0.0); // awning stripe red
  const flourMat = palette.standard('#F3EBDC', 0.94, 0.0);
  const loafMat = palette.standard('#D7944A', 0.82, 0.0); // matches exterior display loaves
  const loafDeepMat = palette.standard('#B4733A', 0.86, 0.0);
  const mossMat = palette.standard(STORYBOOK_PALETTE.moss, 0.84, 0.0);
  const floorPlankMat = palette.standard('#C7A578', 0.82, 0.03);
  const slateMat = palette.standard('#35393B', 0.86, 0.02);

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
      opacity: 0.24,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const moteMat = trackMat(
    new THREE.PointsMaterial({
      color: '#FFF4DE',
      size: 0.045,
      transparent: true,
      opacity: 0.32,
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
  const emberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#E8843C',
      emissive: '#FF9A3C',
      emissiveIntensity: 0.9,
      roughness: 0.9,
      metalness: 0.0,
    }),
  );
  const steamMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: '#FDF7EA',
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    }),
  );
  const hitProxyMat = trackMat(new THREE.MeshBasicMaterial({ visible: false }));

  // Warm ember light inside the oven + dusk lantern fallback light
  const ovenEmberLight = new THREE.PointLight('#FF9C4A', 0.85, 6.5, 1.8);
  ovenEmberLight.position.set(-1.9, 1.0, -2.0);
  group.add(ovenEmberLight);
  const lanternLight = new THREE.PointLight('#FFD9A0', 0, 7.0, 1.8);
  lanternLight.position.set(0.6, 2.2, 0.6);
  group.add(lanternLight);

  // ---------------------------------------------------------------------
  // 1. Foundation plinth, plank floor & door mat
  // ---------------------------------------------------------------------
  const plinth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.5, 0.24, 5.2)), darkStoneMat);
  plinth.position.set(0, -0.15, 0);
  plinth.receiveShadow = true;
  group.add(plinth);

  const floorDeck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.2, 0.06, 4.9)), floorPlankMat);
  floorDeck.position.set(0, -0.02, 0);
  floorDeck.receiveShadow = true;
  group.add(floorDeck);

  // Warm hearthstone inlays around the oven walk-up for handcrafted floor rhythm
  const stoneGeo = trackGeo(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 7));
  const stoneSpots: Array<[number, number, number]> = [
    [-1.5, -1.0, 1.0],
    [-0.5, -0.5, 0.9],
    [1.0, -0.9, 0.85],
    [-2.0, 0.9, 0.9],
    [0.6, 0.2, 1.05],
    [1.6, 0.4, 0.8],
  ];
  for (const [sx, sz, s] of stoneSpots) {
    const stone = new THREE.Mesh(stoneGeo, limestoneMat);
    stone.position.set(sx, 0.008, sz);
    stone.scale.set(s, 1, s * 0.86);
    stone.receiveShadow = true;
    group.add(stone);
  }

  const doorMatMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.1, 0.025, 0.6)), mossMat);
  doorMatMesh.position.set(0, 0.015, 1.9);
  doorMatMesh.receiveShadow = true;
  group.add(doorMatMesh);

  // ---------------------------------------------------------------------
  // 2. Room shell: tall north/west walls, cutaway south/east wainscot
  // ---------------------------------------------------------------------
  const wallHeight = 2.55;
  // North wall (z = -2.4) — chimney breast carries the bake oven
  const northWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.1, wallHeight, 0.16)), plasterMat);
  northWall.position.set(0, 0.8 + wallHeight / 2, -2.42);
  group.add(northWall);
  const northWainscot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.1, 0.72, 0.18)), cedarWarmMat);
  northWainscot.position.set(0, 0.42, -2.4);
  northWainscot.castShadow = true;
  group.add(northWainscot);
  // Chimney breast above the oven
  const chimneyBreast = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.4, 2.4, 0.34)), darkStoneMat);
  chimneyBreast.position.set(-1.9, 1.9, -2.32);
  chimneyBreast.castShadow = true;
  group.add(chimneyBreast);
  const mantle = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.6, 0.12, 0.44)), cedarDarkMat);
  mantle.position.set(-1.9, 1.06, -2.24);
  mantle.castShadow = true;
  group.add(mantle);
  // Mantle keepsakes: small jar, tiny potted herb, flour tin
  const mantleJar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 8)), ceramicMat);
  mantleJar.position.set(-2.5, 1.2, -2.24);
  group.add(mantleJar);
  const mantlePot = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.05, 0.1, 8)), terracottaMat);
  mantlePot.position.set(-1.9, 1.17, -2.24);
  group.add(mantlePot);
  const mantleHerb = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.07, 7, 6)), mossMat);
  mantleHerb.position.set(-1.9, 1.28, -2.24);
  group.add(mantleHerb);

  // West wall (x = -3.0) with a tall kitchen window (z -0.4..1.0)
  const westWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, wallHeight, 4.9)), plasterMat);
  westWall.position.set(-3.02, 0.8 + wallHeight / 2, 0);
  group.add(westWall);
  const westWainscot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.72, 4.9)), cedarWarmMat);
  westWainscot.position.set(-3.0, 0.42, 0);
  westWainscot.castShadow = true;
  group.add(westWainscot);
  const westWindow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 1.0, 1.3)), windowGlassMat);
  westWindow.position.set(-3.04, 1.75, 0.25);
  group.add(westWindow);
  const westWindowTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 1.14, 1.44)), creamMat);
  westWindowTrim.position.set(-3.02, 1.75, 0.25);
  group.add(westWindowTrim);
  const westSill = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.26, 0.08, 1.5)), limestoneMat);
  westSill.position.set(-2.98, 1.2, 0.25);
  group.add(westSill);

  // East wall (x = +3.0) — cutaway dwarf wainscot + low glass so the camera reads in
  const eastWainscot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.72, 4.9)), cedarWarmMat);
  eastWainscot.position.set(3.0, 0.42, 0);
  eastWainscot.castShadow = true;
  group.add(eastWainscot);
  const eastHeader = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.7, 4.9)), plasterMat);
  eastHeader.position.set(3.02, 2.85, 0);
  group.add(eastHeader);

  // South wall (z = +2.4) — cutaway dwarf + header with the centered door opening
  const southWainscotWest = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.2, 0.72, 0.18)), cedarWarmMat);
  southWainscotWest.position.set(-1.9, 0.42, 2.4);
  southWainscotWest.castShadow = true;
  group.add(southWainscotWest);
  const southWainscotEast = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.2, 0.72, 0.18)), cedarWarmMat);
  southWainscotEast.position.set(1.9, 0.42, 2.4);
  southWainscotEast.castShadow = true;
  group.add(southWainscotEast);
  const southHeader = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.1, 0.8, 0.2)), plasterMat);
  southHeader.position.set(0, 2.8, 2.42);
  group.add(southHeader);
  const southHeaderBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.5, 0.16, 0.24)), cedarDarkMat);
  southHeaderBeam.position.set(0, 2.32, 2.4);
  group.add(southHeaderBeam);

  // Corner posts
  const postGeo = trackGeo(new THREE.BoxGeometry(0.16, 2.7, 0.16));
  const cornerPosts: Array<[number, number]> = [
    [-2.94, -2.36],
    [2.94, -2.36],
    [-2.94, 2.36],
    [2.94, 2.36],
  ];
  for (const [px, pz] of cornerPosts) {
    const post = new THREE.Mesh(postGeo, cedarWarmMat);
    post.position.set(px, 1.4, pz);
    post.castShadow = true;
    group.add(post);
  }
  // Ceiling beam with hanging utensils & dried herbs
  const ceilingBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.6, 0.12, 0.18)), cedarDarkMat);
  ceilingBeam.position.set(0.2, 2.42, 0.4);
  group.add(ceilingBeam);
  const hookRail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.3, 0.04, 0.04)), brassMat);
  hookRail.position.set(1.7, 2.28, 0.4);
  group.add(hookRail);
  const panGeo = trackGeo(new THREE.CylinderGeometry(0.13, 0.11, 0.05, 10));
  for (const [px, mat] of [
    [1.4, copperMat],
    [1.72, copperMat],
    [2.04, ironMat],
  ] as Array<[number, THREE.Material]>) {
    const pan = new THREE.Mesh(panGeo, mat);
    pan.position.set(px, 2.14, 0.4);
    pan.rotation.x = 0.12;
    group.add(pan);
    const hook = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.028, 0.008, 5, 8)), ironMat);
    hook.position.set(px, 2.24, 0.4);
    group.add(hook);
  }
  const driedHerbGeo = trackGeo(new THREE.ConeGeometry(0.05, 0.28, 6));
  for (const hx of [-1.0, 0.3]) {
    const bundle = new THREE.Mesh(driedHerbGeo, mossMat);
    bundle.position.set(hx, 2.28, 0.4);
    bundle.rotation.x = Math.PI;
    group.add(bundle);
  }

  // ---------------------------------------------------------------------
  // 3. Brick dome bake oven (north-west) — mirrors bakery_oven obstacle
  // ---------------------------------------------------------------------
  const ovenGroup = new THREE.Group();
  ovenGroup.position.set(-1.9, 0, -1.95);
  addContactShadow(ovenGroup, shadowTex, 2.2, 1.0, 0.42, 0.018);

  const ovenBase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.9, 0.62, 0.82)), darkStoneMat);
  ovenBase.position.y = 0.31;
  ovenBase.castShadow = true;
  ovenGroup.add(ovenBase);
  const hearthSlab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.0, 0.09, 0.9)), limestoneMat);
  hearthSlab.position.y = 0.68;
  ovenGroup.add(hearthSlab);
  const dome = new THREE.Mesh(
    trackGeo(new THREE.SphereGeometry(0.72, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.55)),
    brickMat,
  );
  dome.position.y = 0.73;
  dome.scale.set(1.3, 1.0, 0.92);
  dome.castShadow = true;
  ovenGroup.add(dome);
  const flue = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.17, 1.5, 8)), brickMat);
  flue.position.set(-0.35, 1.85, -0.18);
  ovenGroup.add(flue);
  // Iron oven mouth with glowing ember bed
  const ovenMouth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.5, 0.34, 0.1)), ironMat);
  ovenMouth.position.set(-0.15, 0.52, 0.36);
  ovenGroup.add(ovenMouth);
  const emberBed = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.38, 0.16, 0.06)), emberMat);
  emberBed.position.set(-0.15, 0.44, 0.4);
  ovenGroup.add(emberBed);
  // Long-handled peel leaning against the oven's east side
  const peelShaft = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.025, 0.03, 1.7, 6)), cedarWarmMat);
  peelShaft.position.set(0.82, 0.85, 0.18);
  peelShaft.rotation.z = -0.5;
  ovenGroup.add(peelShaft);
  const peelBlade = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.3, 0.02, 0.24)), brassMat);
  peelBlade.position.set(0.52, 1.55, 0.18);
  peelBlade.rotation.z = -0.5;
  ovenGroup.add(peelBlade);
  // Kindling box + split logs at the base
  const woodBox = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.44, 0.3, 0.34)), cedarDarkMat);
  woodBox.position.set(1.02, 0.15, 0.1);
  ovenGroup.add(woodBox);
  const logGeo = trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 0.4, 6));
  for (const [lx, lr] of [
    [-0.06, 0.4],
    [0.06, 0.9],
    [0.0, 1.5],
  ] as Array<[number, number]>) {
    const log = new THREE.Mesh(logGeo, cedarDarkMat);
    log.position.set(1.02 + lx, 0.36, 0.1);
    log.rotation.x = Math.PI / 2;
    log.rotation.z = lr;
    ovenGroup.add(log);
  }

  group.add(ovenGroup);

  // ---------------------------------------------------------------------
  // 4. Service counter with loaf display (west wall) — mirrors bakery_counter
  // ---------------------------------------------------------------------
  const counterGroup = new THREE.Group();
  counterGroup.position.set(-2.55, 0, 0.2);
  addContactShadow(counterGroup, shadowTex, 1.0, 2.4, 0.4, 0.018);

  const counterTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.72, 0.08, 2.0)), cedarWarmMat);
  counterTop.position.y = 0.92;
  counterTop.castShadow = true;
  counterGroup.add(counterTop);
  const counterFront = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 0.52, 1.9)), cedarDarkMat);
  counterFront.position.set(0.34, 0.62, 0);
  counterGroup.add(counterFront);
  for (const cz of [-0.85, 0.85]) {
    const leg = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 0.9, 0.12)), cedarDarkMat);
    leg.position.set(0.0, 0.45, cz);
    counterGroup.add(leg);
  }
  const counterLower = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.6, 0.05, 1.8)), cedarWarmMat);
  counterLower.position.y = 0.32;
  counterGroup.add(counterLower);

  // Loaf display shelf on the counter with four warm loaves (hidden on oven-rest days)
  const counterLoafGroup = new THREE.Group();
  const loafGeo = trackGeo(new THREE.CapsuleGeometry(0.1, 0.16, 4, 7));
  const loafSpots: Array<[number, number]> = [
    [-0.5, 0.0],
    [-0.15, 0.3],
    [0.2, -0.28],
    [0.42, 0.12],
  ];
  for (const [lx, lz] of loafSpots) {
    const loaf = new THREE.Mesh(loafGeo, loafMat);
    loaf.rotation.z = Math.PI / 2;
    loaf.rotation.y = Math.sin(lz * 7) * 0.6;
    loaf.position.set(lx, 1.06, lz);
    counterLoafGroup.add(loaf);
  }
  counterGroup.add(counterLoafGroup);

  // Brass service bell + folded cloth on the counter
  const bellBase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.07, 0.08, 0.03, 9)), brassMat);
  bellBase.position.set(-0.1, 0.98, -0.72);
  counterGroup.add(bellBase);
  const bellDome = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.06, 9, 7, 0, Math.PI * 2, 0, Math.PI * 0.55)), brassMat);
  bellDome.position.set(-0.1, 1.0, -0.72);
  counterGroup.add(bellDome);
  const counterCloth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.2, 0.02, 0.24)), linenRedMat);
  counterCloth.position.set(0.15, 0.97, 0.62);
  counterGroup.add(counterCloth);

  // Flour sacks tucked beneath the counter
  const sackGeo = trackGeo(new THREE.SphereGeometry(0.17, 8, 6));
  for (const [sx, sz, s] of [
    [-0.05, -0.5, 1.0],
    [0.05, 0.05, 0.85],
  ] as Array<[number, number, number]>) {
    const sack = new THREE.Mesh(sackGeo, flourMat);
    sack.position.set(sx, 0.28, sz);
    sack.scale.set(0.8, s, 0.9);
    counterGroup.add(sack);
  }

  // Wall chalk slate announcing today's bake
  const slate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.4, 0.5, 0.05)), slateMat);
  slate.position.set(-0.28, 1.7, -0.72);
  slate.rotation.x = -0.06;
  counterGroup.add(slate);
  const slateFrame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.48, 0.58, 0.04)), cedarWarmMat);
  slateFrame.position.set(-0.28, 1.7, -0.75);
  counterGroup.add(slateFrame);
  const chalkLine = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.26, 0.02, 0.01)), linenMat);
  chalkLine.position.set(-0.28, 1.78, -0.71);
  counterGroup.add(chalkLine);
  const chalkLine2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.02, 0.01)), linenMat);
  chalkLine2.position.set(-0.28, 1.7, -0.71);
  counterGroup.add(chalkLine2);

  group.add(counterGroup);

  // ---------------------------------------------------------------------
  // 5. Flour-dusted prep table (north-east) — mirrors bakery_prep obstacle
  // ---------------------------------------------------------------------
  const prepGroup = new THREE.Group();
  prepGroup.position.set(1.7, 0, -1.95);
  addContactShadow(prepGroup, shadowTex, 1.9, 1.0, 0.42, 0.018);

  const prepTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.7, 0.09, 0.76)), cedarWarmMat);
  prepTop.position.y = 0.86;
  prepTop.castShadow = true;
  prepGroup.add(prepTop);
  // Flour dusting layer on the tabletop
  const flourDust = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.56, 0.012, 0.64)), flourMat);
  flourDust.position.y = 0.92;
  prepGroup.add(flourDust);
  for (const lx of [-0.72, 0.72]) {
    const leg = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.11, 0.86, 0.11)), cedarDarkMat);
    leg.position.set(lx, 0.43, 0);
    prepGroup.add(leg);
  }

  // Soft dough mound mid-proof
  const doughMound = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.14, 9, 7)), flourMat);
  doughMound.position.set(-0.35, 0.99, 0.02);
  doughMound.scale.set(1.15, 0.6, 1.0);
  prepGroup.add(doughMound);
  // Rolling pin resting beside it
  const pinBody = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8)), cedarWarmMat);
  pinBody.rotation.x = Math.PI / 2;
  pinBody.rotation.z = 0.18;
  pinBody.position.set(0.18, 0.96, 0.16);
  prepGroup.add(pinBody);
  const pinHandleGeo = trackGeo(new THREE.CylinderGeometry(0.018, 0.02, 0.08, 6));
  const pinHandleA = new THREE.Mesh(pinHandleGeo, cedarDarkMat);
  pinHandleA.position.set(0.11, 0.965, 0.32);
  pinHandleA.rotation.x = Math.PI / 2;
  prepGroup.add(pinHandleA);
  const pinHandleB = new THREE.Mesh(pinHandleGeo, cedarDarkMat);
  pinHandleB.position.set(0.25, 0.965, -0.02);
  pinHandleB.rotation.x = Math.PI / 2;
  prepGroup.add(pinHandleB);
  // Stoneware flour jar + linen cloth over the rising basket
  const flourJar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.09, 0.08, 0.2, 9)), ceramicMat);
  flourJar.position.set(0.62, 1.0, -0.14);
  prepGroup.add(flourJar);
  const proofBasket = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.16, 0.13, 0.14, 9)), cedarDarkMat);
  proofBasket.position.set(-0.62, 0.95, -0.2);
  prepGroup.add(proofBasket);
  const proofCloth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.3, 0.015, 0.3)), linenMat);
  proofCloth.position.set(-0.62, 1.03, -0.2);
  proofCloth.rotation.y = 0.3;
  prepGroup.add(proofCloth);

  group.add(prepGroup);

  // ---------------------------------------------------------------------
  // 6. Recipe notes shelf + copper pans (east wall) — bakery_notes station
  // ---------------------------------------------------------------------
  const notesGroup = new THREE.Group();
  notesGroup.position.set(2.88, 0, 0.2);

  const noteShelf = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, 0.05, 0.9)), cedarWarmMat);
  noteShelf.position.set(-0.06, 1.5, 0);
  notesGroup.add(noteShelf);
  const noteShelfBrace = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.22, 0.7)), cedarDarkMat);
  noteShelfBrace.position.set(-0.14, 1.38, 0);
  notesGroup.add(noteShelfBrace);
  // Two oilcloth notebooks + a folded recipe card
  const bookGeo = trackGeo(new THREE.BoxGeometry(0.2, 0.05, 0.26));
  const bookA = new THREE.Mesh(bookGeo, linenRedMat);
  bookA.position.set(-0.06, 1.55, -0.22);
  bookA.rotation.y = 0.2;
  notesGroup.add(bookA);
  const bookB = new THREE.Mesh(bookGeo, linenMat);
  bookB.position.set(-0.06, 1.55, 0.06);
  bookB.rotation.y = -0.12;
  notesGroup.add(bookB);
  const recipeCard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 0.012, 0.2)), flourMat);
  recipeCard.position.set(-0.06, 1.53, 0.32);
  recipeCard.rotation.y = 0.5;
  notesGroup.add(recipeCard);

  group.add(notesGroup);

  // ---------------------------------------------------------------------
  // 7. Round café table with chairs (south-east) — mirrors bakery_table obstacle
  // ---------------------------------------------------------------------
  const cafeGroup = new THREE.Group();
  cafeGroup.position.set(1.35, 0, 1.45);
  addContactShadow(cafeGroup, shadowTex, 1.7, 1.7, 0.4, 0.018);

  const tableTop = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.58, 0.6, 0.07, 14)), cedarWarmMat);
  tableTop.position.y = 0.78;
  tableTop.castShadow = true;
  cafeGroup.add(tableTop);
  const tableStem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.09, 0.74, 8)), ironMat);
  tableStem.position.y = 0.39;
  cafeGroup.add(tableStem);
  const tableFoot = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.24, 0.3, 0.07, 10)), ironMat);
  tableFoot.position.y = 0.04;
  cafeGroup.add(tableFoot);

  // Teacup + tiny vase on the table
  const cafeCup = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.04, 0.07, 9)), ceramicMat);
  cafeCup.position.set(-0.16, 0.85, 0.1);
  cafeGroup.add(cafeCup);
  const cafeSaucer = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.085, 0.085, 0.018, 10)), ceramicMat);
  cafeSaucer.position.set(-0.16, 0.815, 0.1);
  cafeGroup.add(cafeSaucer);
  const cafeVase = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.045, 0.055, 0.12, 8)), terracottaMat);
  cafeVase.position.set(0.14, 0.87, -0.12);
  cafeGroup.add(cafeVase);
  const cafeSprig = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.05, 6, 5)), mossMat);
  cafeSprig.position.set(0.14, 0.97, -0.12);
  cafeGroup.add(cafeSprig);

  // Bentwood chair (the interactive café seat) at the table's west side
  const chairWest = new THREE.Group();
  const chairSeat = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.19, 0.17, 0.05, 10)), cedarWarmMat);
  chairSeat.position.y = 0.46;
  chairSeat.castShadow = true;
  chairWest.add(chairSeat);
  const chairBack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.44, 0.3)), cedarWarmMat);
  chairBack.position.set(-0.17, 0.72, 0);
  chairBack.rotation.y = Math.PI / 2;
  chairWest.add(chairBack);
  const chairLegGeo = trackGeo(new THREE.CylinderGeometry(0.024, 0.028, 0.46, 6));
  for (const [lx, lz] of [
    [-0.1, -0.1],
    [0.1, -0.1],
    [-0.1, 0.1],
    [0.1, 0.1],
  ] as Array<[number, number]>) {
    const cleg = new THREE.Mesh(chairLegGeo, cedarDarkMat);
    cleg.position.set(lx, 0.23, lz);
    chairWest.add(cleg);
  }
  chairWest.position.set(-0.62, 0, 0.0);
  chairWest.rotation.y = 0.15;
  cafeGroup.add(chairWest);

  // Second chair across the table (east side, decorative counterweight)
  const chairEast = chairWest.clone();
  chairEast.position.set(0.62, 0, -0.02);
  chairEast.rotation.y = Math.PI - 0.15;
  cafeGroup.add(chairEast);

  // Small checkered cloth runner over the tabletop edge
  const cafeRunner = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.5, 0.014, 0.34)), linenRedMat);
  cafeRunner.position.set(0.02, 0.82, 0.02);
  cafeRunner.rotation.y = 0.2;
  cafeGroup.add(cafeRunner);

  group.add(cafeGroup);

  // ---------------------------------------------------------------------
  // 8. Interior door (south wall) + wall lantern
  // ---------------------------------------------------------------------
  const doorGroup = new THREE.Group();
  doorGroup.position.set(0, 0, 2.32);
  const doorPanel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.06, 1.92, 0.09)), doorMat);
  doorPanel.position.set(0, 0.97, 0);
  doorPanel.castShadow = true;
  doorGroup.add(doorPanel);
  const doorRailGeo = trackGeo(new THREE.BoxGeometry(0.96, 0.09, 0.1));
  for (const ry of [0.42, 1.24, 1.68]) {
    const rail = new THREE.Mesh(doorRailGeo, cedarDarkMat);
    rail.position.set(0, ry, 0.01);
    doorGroup.add(rail);
  }
  const doorWindow = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.4, 0.44, 0.05)),
    windowGlassMat,
  );
  doorWindow.position.set(0, 1.48, 0.02);
  doorGroup.add(doorWindow);
  const knob = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.045, 8, 7)), brassMat);
  knob.position.set(0.36, 1.0, 0.08);
  doorGroup.add(knob);
  const doorLantern = new THREE.Group();
  const lanternCage = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.075, 0.09, 0.16, 6)), ironMat);
  const lanternGlass = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.055, 0.07, 0.12, 6)), lanternMat);
  lanternGlass.position.y = 0.005;
  doorLantern.add(lanternCage, lanternGlass);
  doorLantern.position.set(-0.78, 2.1, 0.05);
  doorGroup.add(doorLantern);
  group.add(doorGroup);

  // ---------------------------------------------------------------------
  // 9. Morning window shaft & drifting flour-dust motes (atmosphere layer)
  // ---------------------------------------------------------------------
  const shaftGeo = trackGeo(new THREE.PlaneGeometry(1.5, 3.3));
  const shaftA = new THREE.Mesh(shaftGeo, shaftMat);
  shaftA.position.set(-1.9, 1.7, -0.2);
  shaftA.rotation.y = Math.PI / 2.3;
  shaftA.rotation.x = 0.14;
  group.add(shaftA);

  const MOTE_COUNT = 22;
  const moteGeo = trackGeo(new THREE.BufferGeometry());
  const moteBase = new Float32Array(MOTE_COUNT * 3);
  for (let i = 0; i < MOTE_COUNT; i++) {
    moteBase[i * 3] = -2.4 + (i % 11) * 0.42;
    moteBase[i * 3 + 1] = 0.5 + ((i * 7) % 14) * 0.13;
    moteBase[i * 3 + 2] = -1.6 + ((i * 5) % 15) * 0.22;
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(moteBase.slice(), 3));
  const motes = new THREE.Points(moteGeo, moteMat);
  group.add(motes);

  // ---------------------------------------------------------------------
  // 10. Bake steam puffs above the oven mouth (pooled, toggled by state)
  // ---------------------------------------------------------------------
  const bakeSteamGroup = new THREE.Group();
  const steamPuffGeo = trackGeo(new THREE.SphereGeometry(0.09, 7, 6));
  const steamPuffs: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const puff = new THREE.Mesh(steamPuffGeo, steamMat);
    puff.position.set(-0.15, 0.75, 0.4);
    puff.visible = false;
    bakeSteamGroup.add(puff);
    steamPuffs.push(puff);
  }
  bakeSteamGroup.position.set(0, 0, 0);
  ovenGroup.add(bakeSteamGroup);

  // ---------------------------------------------------------------------
  // 11. Contact shadows + interaction hit proxies (stations + café seat)
  // ---------------------------------------------------------------------
  const hitProxies: THREE.Mesh[] = [];
  const proxyGeoCache = new Map<string, THREE.BoxGeometry>();
  for (const prop of BAKERY_INTERACTABLES) {
    const key = `${prop.id}_${Math.round(prop.x * 10)}`;
    let proxyGeo = proxyGeoCache.get(key);
    if (!proxyGeo) {
      proxyGeo = trackGeo(new THREE.BoxGeometry(0.62, 1.05, 0.62));
      proxyGeoCache.set(key, proxyGeo);
    }
    const proxy = new THREE.Mesh(proxyGeo, hitProxyMat);
    proxy.position.set(prop.focusX, 0.72, prop.focusZ);
    proxy.userData = { targetKind: 'bakery_prop', targetId: prop.id };
    group.add(proxy);
    hitProxies.push(proxy);
  }
  // Café-chair seat proxy (targetKind seat, mirrors cottage indoor stool proxies)
  const seatProxyGeo = trackGeo(new THREE.BoxGeometry(0.56, 0.9, 0.56));
  const seatProxy = new THREE.Mesh(seatProxyGeo, hitProxyMat);
  seatProxy.position.set(0.73, 0.6, 1.45);
  seatProxy.userData = { targetKind: 'seat', targetId: 'bakery_seat_cafe_west' };
  group.add(seatProxy);
  hitProxies.push(seatProxy);

  // ---------------------------------------------------------------------
  // Reactive update — zero per-frame allocation
  // ---------------------------------------------------------------------
  function update(world: WorldState, phase: TimePhase, elapsed: number): void {
    const bk = world.bakeryState;
    const bakeCheckedToday = (bk?.bakeCheckedDay ?? 0) === world.day;
    const todayBake = getBakeForDay(world.day);
    const bakeActive = todayBake.id !== 'oven_rest';

    // Oven ember glow: full warmth on bake days, banked embers on rest days,
    // and a small extra lift once the morning bake has been revealed.
    const emberBase = bakeActive ? (bakeCheckedToday ? 1.15 : 0.95) : 0.35;
    ovenEmberLight.intensity = emberBase + Math.sin(elapsed * 5.2) * 0.07 + Math.sin(elapsed * 2.3) * 0.04;
    emberMat.emissiveIntensity = bakeActive ? 0.95 + Math.sin(elapsed * 4.6) * 0.12 : 0.3;

    // Steam puffs rise only when today's bake is fresh and the dome was checked
    const steamOn = bakeActive && bakeCheckedToday && phase !== 'dusk';
    for (let i = 0; i < steamPuffs.length; i++) {
      const puff = steamPuffs[i];
      puff.visible = steamOn;
      if (steamOn) {
        const cycle = (elapsed * 0.45 + i * 0.2) % 1;
        puff.position.set(
          -0.15 + Math.sin(cycle * Math.PI * 2 + i) * 0.06,
          0.78 + cycle * 0.55,
          0.4 + Math.cos(cycle * Math.PI * 2 + i) * 0.04,
        );
        puff.scale.setScalar(0.55 + cycle * 0.75);
      }
    }

    // Counter loaf row only shows when the dome actually baked today's goods
    counterLoafGroup.visible = bakeActive;

    // Phase lighting: warm morning shafts, ember-warm dusk with the wall lantern
    if (phase === 'dusk') {
      lanternLight.intensity = 1.3 + Math.sin(elapsed * 3.2) * 0.08;
      lanternMat.emissiveIntensity = 1.55 + Math.sin(elapsed * 4.2) * 0.13;
      shaftMat.opacity = 0.05;
      moteMat.opacity = 0.14;
    } else if (phase === 'golden') {
      lanternLight.intensity = 0.4;
      lanternMat.emissiveIntensity = 0.5;
      shaftMat.opacity = 0.26 + Math.sin(elapsed * 0.7) * 0.03;
      moteMat.opacity = 0.3;
    } else {
      lanternLight.intensity = 0.0;
      lanternMat.emissiveIntensity = 0.18;
      shaftMat.opacity = phase === 'morning' ? 0.32 : 0.18;
      moteMat.opacity = 0.3;
    }

    // Drifting flour-dust motes in the window shaft
    const moteArr = moteGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < MOTE_COUNT; i++) {
      const i3 = i * 3;
      moteArr[i3] = moteBase[i3] + Math.sin(elapsed * 0.3 + i * 1.5) * 0.08;
      moteArr[i3 + 1] = moteBase[i3 + 1] + Math.sin(elapsed * 0.42 + i * 0.9) * 0.1;
      moteArr[i3 + 2] = moteBase[i3 + 2] + Math.cos(elapsed * 0.36 + i * 2.0) * 0.07;
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
    ovenEmberLight,
    bakeSteamGroup,
    counterLoafGroup,
    update,
    dispose,
  };
}

/**
 * Small exterior porch dressing for the bakery's existing south door: a warm step stone,
 * a lit wall lantern accent, and a butter-paper delivery crate. Mounted by the canvas at
 * the south face of Hearth & Crumb (world position (-12.4, 0, -8.16), facing south).
 */
export function buildHearthCrumbPorchDressing(
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
  const cedarDarkMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.74, 0.04);
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.25, 0.86);
  const ironMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.45, 0.65);

  // Warm step stone under the doorway
  const step = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.3, 0.09, 0.7)), limestoneMat);
  step.position.set(0, 0.045, 0.55);
  step.receiveShadow = true;
  group.add(step);

  // Small hanging lantern bracket beside the door
  const bracket = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 0.05, 0.24)), ironMat);
  bracket.position.set(-0.82, 2.05, 0.08);
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
  lantern.position.set(-0.82, 1.92, 0.18);
  group.add(lantern);

  // Butter-paper delivery crate on the step corner
  const crate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, 0.2, 0.26)), cedarDarkMat);
  crate.position.set(0.72, 0.19, 0.62);
  crate.rotation.y = 0.18;
  crate.castShadow = true;
  group.add(crate);
  const crateRail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.3, 0.03, 0.03)), brassMat);
  crateRail.position.set(0.72, 0.3, 0.62);
  group.add(crateRail);

  addContactShadow(group, shadowTex, 2.0, 1.4, 0.4, 0.018);

  group.userData.dispose = () => {
    for (const g of ownedGeos) g.dispose();
    for (const m of ownedMats) m.dispose();
  };

  return group;
}
