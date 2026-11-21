import * as THREE from 'three';
import {
  COPPERWHEEL_INTERACTABLES,
  COPPERWHEEL_SEAT_SPOTS,
  getProjectForDay,
} from '../../game/copperwheel';
import { TimePhase, WorldState } from '../../game/types';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';
import {
  addContactShadow,
} from './vegetation';
import { addStaticContactShadow } from '../contactShadows';

/**
 * Copperwheel Cottage Interior Cutaway Diorama (Milestone 3 Build 9).
 *
 * Mirrors `COPPERWHEEL_BOUNDS` (-3.0..3.0 x -2.5..2.5) and the exact furniture footprints
 * of `COPPERWHEEL_INTERIOR_OBSTACLES` & `COPPERWHEEL_INTERACTABLES` in `src/game/copperwheel.ts`.
 * North + West walls rise tall around the clockmaker's workbench and mended-pieces shelf;
 * South + East edges step down to cutaway wainscot so the isometric camera reads cleanly
 * into the brass-and-oakwood workshop. The reactive layer: the bench project group swaps
 * with the deterministic day cycle (pendulum case / music box / pocket watch / rolled felt),
 * the kettle steams only on days a chamomile cup was poured, the pendulum swings on days
 * the bench was checked, and the bench lamp warms the room toward dusk.
 */
export interface CopperwheelInteriorRig {
  group: THREE.Group;
  hitProxies: THREE.Mesh[];
  /** Warm bench-lamp light above the workbench (dusk fallback). */
  benchLampLight: THREE.PointLight;
  /** Kettle steam group above the copper kettle — visible only when a cup was poured today. */
  kettleSteamGroup: THREE.Group;
  /** The four day-cycle bench project groups (one visible per project day). */
  projectGroups: Record<string, THREE.Group>;
  update(world: WorldState, phase: TimePhase, elapsed: number): void;
  dispose(): void;
}

export function buildCopperwheelInterior(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
  _options: { isSoftwareGl?: boolean } = {},
): CopperwheelInteriorRig {
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
  const darkStoneMat = palette.standard(STORYBOOK_PALETTE.fieldstoneDark, 0.9, 0.02);
  const limestoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.88, 0.02);
  const creamMat = palette.standard(STORYBOOK_PALETTE.creamTrim, 0.78, 0.02);
  const plasterMat = palette.standard('#E1DFD5', 0.86, 0.02); // matches the exterior walls
  const trimMat = palette.standard('#564940', 0.74, 0.04); // matches the exterior dark trim
  const cedarWarmMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.72, 0.04);
  const mapleMat = palette.standard('#C9A876', 0.8, 0.02); // workbench top (matches crate wood)
  const mapleEdgeMat = palette.standard('#9A7A50', 0.84, 0.02);
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.25, 0.86);
  const ironMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.45, 0.65);
  const copperMat = palette.standard('#C56B45', 0.28, 0.78);
  const feltMat = palette.standard('#7A6A4F', 0.92, 0.0);
  const linenMat = palette.standard('#F5EEE0', 0.88, 0.0);
  const quiltMat = palette.standard('#8FA08C', 0.86, 0.0);
  const quiltTrimMat = palette.standard('#E9D9B8', 0.9, 0.0);
  const ceramicMat = palette.standard(STORYBOOK_PALETTE.ceramicCream, 0.4, 0.04);
  const walnutMat = palette.standard('#6B4A36', 0.62, 0.05);
  const crabwoodMat = palette.standard('#B98A5C', 0.7, 0.03);
  const floorWoodMat = palette.standard('#B99B72', 0.82, 0.03);
  const rugMat = palette.standard('#A8A0B5', 0.9, 0.0);
  const rugTrimMat = palette.standard('#D9CBA8', 0.9, 0.0);

  // Brass clock-face enamel (echoes the exterior gable emblem)
  const clockFaceMat = palette.standard('#FAF2E1', 0.42, 0.02);
  const gearMats = ['#8C6B3C', '#B98E4A', '#5E8062'].map((c) => palette.standard(c, 0.38, 0.72));

  // Per-instance dynamic materials
  const windowGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#D8E6DE',
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
      opacity: 0.26,
      depthWrite: false,
    }),
  );
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
      color: '#7FB08A',
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
  const kettleGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#FFE1A8',
      emissive: '#E89A46',
      emissiveIntensity: 0.1,
      roughness: 0.3,
      metalness: 0.7,
    }),
  );
  const hitProxyMat = trackMat(new THREE.MeshBasicMaterial({ visible: false }));

  // Bench lamp light above the workbench + soft armchair fill
  const benchLampLight = new THREE.PointLight('#FFD9A0', 0, 7.0, 1.8);
  benchLampLight.position.set(-1.6, 1.9, -1.5);
  group.add(benchLampLight);

  // ---------------------------------------------------------------------
  // 1. Foundation plinth, plank floor & brass-inlaid rug
  // ---------------------------------------------------------------------
  const plinth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.4, 0.24, 5.4)), darkStoneMat);
  plinth.position.set(0, -0.15, 0);
  plinth.receiveShadow = true;
  group.add(plinth);

  const floorDeck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.1, 0.06, 5.1)), floorWoodMat);
  floorDeck.position.set(0, -0.02, 0);
  floorDeck.receiveShadow = true;
  group.add(floorDeck);

  // Rounded workshop rug under the central aisle
  const rug = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.5, 1.5, 0.03, 20)), rugMat);
  rug.position.set(0.2, 0.015, 0.2);
  rug.scale.set(1.0, 1.0, 0.82);
  rug.receiveShadow = true;
  group.add(rug);
  const rugRim = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(1.58, 1.58, 0.022, 20)), rugTrimMat);
  rugRim.position.set(0.2, 0.008, 0.2);
  rugRim.scale.set(1.0, 1.0, 0.82);
  group.add(rugRim);

  // ---------------------------------------------------------------------
  // 2. Room shell: tall north/west walls, cutaway south/east wainscot
  // ---------------------------------------------------------------------
  const wallHeight = 2.72;
  // North wall (z = -2.5) behind the workbench and bed alcove
  const northWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.1, wallHeight, 0.16)), plasterMat);
  northWall.position.set(0, 0.8 + wallHeight / 2, -2.52);
  group.add(northWall);
  const northWainscot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.1, 0.72, 0.18)), cedarWarmMat);
  northWainscot.position.set(0, 0.42, -2.5);
  northWainscot.castShadow = true;
  group.add(northWainscot);
  const northCrown = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.1, 0.1, 0.24)), trimMat);
  northCrown.position.set(0, 2.6, -2.44);
  group.add(northCrown);

  // West wall (x = -3.0) with a tall window above the mended shelf
  const westWall = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, wallHeight, 5.1)), plasterMat);
  westWall.position.set(-3.02, 0.8 + wallHeight / 2, 0);
  group.add(westWall);
  const westWainscot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.72, 5.1)), cedarWarmMat);
  westWainscot.position.set(-3.0, 0.42, 0);
  westWainscot.castShadow = true;
  group.add(westWainscot);
  const westWindow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 1.15, 1.3)), windowGlassMat);
  westWindow.position.set(-2.93, 1.85, 0.1);
  group.add(westWindow);
  const westWindowTrim = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 1.31, 1.46)), creamMat);
  westWindowTrim.position.set(-2.94, 1.85, 0.1);
  group.add(westWindowTrim);
  const westWindowMuntinV = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 1.15, 0.05)), creamMat);
  westWindowMuntinV.position.set(-2.92, 1.85, 0.1);
  group.add(westWindowMuntinV);
  const westWindowMuntinH = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.1, 0.05, 1.3)), creamMat);
  westWindowMuntinH.position.set(-2.92, 1.85, 0.1);
  group.add(westWindowMuntinH);
  const westSill = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.26, 0.08, 1.52)), limestoneMat);
  westSill.position.set(-2.96, 1.22, 0.1);
  group.add(westSill);
  // Little chamomile pot on the sill (Arthur's favorite bloom)
  const sillPot = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.09, 0.07, 0.12, 8)), ceramicMat);
  sillPot.position.set(-2.93, 1.32, -0.25);
  group.add(sillPot);
  const sillBloom = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.06, 7, 6)), creamMat);
  sillBloom.position.set(-2.93, 1.43, -0.25);
  group.add(sillBloom);

  // East wall (x = +3.0) — cutaway dwarf wainscot + header; stove flue rises into it
  const eastWainscotNorth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.72, 1.65)), cedarWarmMat);
  eastWainscotNorth.position.set(3.0, 0.42, -1.68);
  eastWainscotNorth.castShadow = true;
  group.add(eastWainscotNorth);
  const eastWainscotSouth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.72, 1.6)), cedarWarmMat);
  eastWainscotSouth.position.set(3.0, 0.42, 1.7);
  eastWainscotSouth.castShadow = true;
  group.add(eastWainscotSouth);
  const eastHeader = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.8, 5.1)), plasterMat);
  eastHeader.position.set(3.02, 2.92, 0);
  group.add(eastHeader);
  const eastHeaderBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.15, 1.4)), trimMat);
  eastHeaderBeam.position.set(3.0, 2.34, 0.55);
  group.add(eastHeaderBeam);

  // South wall (z = +2.5) — cutaway dwarf + header; door opening on the east side (x ~ 1.0)
  const southWainscotWest = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.5, 0.72, 0.18)), cedarWarmMat);
  southWainscotWest.position.set(-1.75, 0.42, 2.5);
  southWainscotWest.castShadow = true;
  group.add(southWainscotWest);
  const southWainscotDoorSide = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.5, 0.72, 0.18)), cedarWarmMat);
  southWainscotDoorSide.position.set(2.25, 0.42, 2.5);
  southWainscotDoorSide.castShadow = true;
  group.add(southWainscotDoorSide);
  const southHeader = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(6.1, 0.8, 0.2)), plasterMat);
  southHeader.position.set(0, 2.86, 2.52);
  group.add(southHeader);
  const southDoorHeader = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.15, 0.55, 0.2)), trimMat);
  southDoorHeader.position.set(1.0, 2.18, 2.5);
  group.add(southDoorHeader);

  // Corner posts
  const postGeo = trackGeo(new THREE.BoxGeometry(0.15, 2.86, 0.15));
  const cornerPosts: Array<[number, number]> = [
    [-2.94, -2.44],
    [2.94, -2.44],
    [-2.94, 2.44],
    [2.94, 2.44],
  ];
  for (const [px, pz] of cornerPosts) {
    const post = new THREE.Mesh(postGeo, cedarWarmMat);
    post.position.set(px, 1.44, pz);
    post.castShadow = true;
    group.add(post);
  }
  // Ceiling beam with the hanging brass bench lamp over the workbench
  const ceilingBeam = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.8, 0.12, 0.16)), trimMat);
  ceilingBeam.position.set(0, 2.56, -1.35);
  group.add(ceilingBeam);

  // ---------------------------------------------------------------------
  // 3. Clockmaker's workbench (north-west) — mirrors cw_bench obstacle
  // ---------------------------------------------------------------------
  const benchGroup = new THREE.Group();
  benchGroup.position.set(-1.58, 0, -1.97);
  addStaticContactShadow(benchGroup, shadowTex, 3.0, 1.0, 0.5, 0.018);

  const benchTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.56, 0.1, 0.84)), mapleMat);
  benchTop.position.set(0, 0.92, 0);
  benchTop.castShadow = true;
  benchGroup.add(benchTop);
  const benchFrontApron = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(2.56, 0.14, 0.1)), mapleEdgeMat);
  benchFrontApron.position.set(0, 0.82, 0.4);
  benchGroup.add(benchFrontApron);
  const benchLegGeo = trackGeo(new THREE.BoxGeometry(0.12, 0.86, 0.12));
  for (const [lx, lz] of [
    [-1.14, -0.28],
    [1.14, -0.28],
    [-1.14, 0.28],
    [1.14, 0.28],
  ]) {
    const leg = new THREE.Mesh(benchLegGeo, mapleEdgeMat);
    leg.position.set(lx, 0.43, lz);
    leg.castShadow = true;
    benchGroup.add(leg);
  }
  // Felt working mat
  const benchFelt = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.7, 0.015, 0.6)), feltMat);
  benchFelt.position.set(-0.25, 0.98, 0);
  benchGroup.add(benchFelt);
  // Iron vise on the east end of the bench
  const viseBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.2, 0.16, 0.22)), ironMat);
  viseBody.position.set(1.0, 1.05, -0.05);
  viseBody.castShadow = true;
  benchGroup.add(viseBody);
  const viseJaw = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 0.14, 0.2)), ironMat);
  viseJaw.position.set(0.86, 1.05, -0.05);
  benchGroup.add(viseJaw);
  const viseHandle = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.24, 6)), ironMat);
  viseHandle.rotation.x = Math.PI / 2;
  viseHandle.position.set(1.14, 1.08, -0.05);
  benchGroup.add(viseHandle);
  // Gear tray with three brass gears
  const tray = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 0.05, 0.3)), mapleEdgeMat);
  tray.position.set(-1.0, 1.0, 0.02);
  benchGroup.add(tray);
  const gearGeo = trackGeo(new THREE.TorusGeometry(0.07, 0.02, 6, 12));
  for (let gi = 0; gi < 3; gi++) {
    const gear = new THREE.Mesh(gearGeo, gearMats[gi]);
    gear.position.set(-1.08 + gi * 0.11, 1.04, 0.02 + (gi % 2) * 0.06);
    gear.rotation.x = -0.5;
    benchGroup.add(gear);
  }
  // Pegboard of tiny tools behind the bench, on the north wall
  const pegboard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.9, 0.62, 0.05)), cedarWarmMat);
  pegboard.position.set(0, 1.86, -0.42);
  pegboard.castShadow = true;
  benchGroup.add(pegboard);
  const toolGeo = trackGeo(new THREE.BoxGeometry(0.04, 0.3, 0.03));
  for (let ti = 0; ti < 6; ti++) {
    const tool = new THREE.Mesh(toolGeo, ti % 2 === 0 ? ironMat : brassMat);
    tool.position.set(-0.75 + ti * 0.3, 1.82 + (ti % 3) * 0.03, -0.38);
    tool.rotation.z = (ti % 3) * 0.14 - 0.14;
    benchGroup.add(tool);
  }
  // The magnifier loupe hanging on its hook (west end)
  const loupeRim = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.09, 0.025, 6, 14)), brassMat);
  loupeRim.position.set(-1.32, 1.62, -0.36);
  benchGroup.add(loupeRim);
  const loupeGlass = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 12)), windowGlassMat);
  loupeGlass.rotation.x = Math.PI / 2;
  loupeGlass.position.set(-1.32, 1.62, -0.36);
  benchGroup.add(loupeGlass);
  benchGroup.position.z = -1.97;

  // Hanging brass bench lamp over the workbench (pendant from the ceiling beam)
  const lampDrop = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5)), ironMat);
  lampDrop.position.set(-1.6, 2.31, -1.5);
  group.add(lampDrop);
  const lampShade = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.16, 0.24, 0.2, 10, 1, true)), lampShadeMat);
  lampShade.position.set(-1.6, 1.98, -1.5);
  group.add(lampShade);
  const lampGlow = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.07, 8, 7)), lampMat);
  lampGlow.position.set(-1.6, 1.94, -1.5);
  group.add(lampGlow);

  // ---------------------------------------------------------------------
  // 4. Reactive bench project groups — one visible per day of the cycle
  // ---------------------------------------------------------------------
  const projectGroups: Record<string, THREE.Group> = {};
  const projectMount = new THREE.Group();
  projectMount.position.set(-1.35, 0, -1.95);
  group.add(projectMount);

  // 4a. The Orchard Pendulum — crabwood long-case body on the bench + hanging pendulum
  const pendulumGroup = new THREE.Group();
  const pendulumCase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, 0.62, 0.26)), crabwoodMat);
  pendulumCase.position.set(0.5, 1.34, -0.18);
  pendulumCase.castShadow = true;
  pendulumGroup.add(pendulumCase);
  const pendulumFace = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 14)), clockFaceMat);
  pendulumFace.rotation.x = Math.PI / 2;
  pendulumFace.position.set(0.5, 1.52, -0.04);
  pendulumGroup.add(pendulumFace);
  const pendulumHandH = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.015, 0.01)), brassMat);
  pendulumHandH.position.set(0.53, 1.53, -0.01);
  pendulumGroup.add(pendulumHandH);
  const pendulumHandV = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.015, 0.07, 0.01)), brassMat);
  pendulumHandV.position.set(0.5, 1.56, -0.01);
  pendulumGroup.add(pendulumHandV);
  const pendulumRodPivot = new THREE.Group();
  pendulumRodPivot.position.set(0.5, 1.05, 0.02);
  pendulumGroup.add(pendulumRodPivot);
  const pendulumRod = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.02, 0.5, 0.01)), brassMat);
  pendulumRod.position.y = -0.25;
  pendulumRodPivot.add(pendulumRod);
  const pendulumBob = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 12)), brassMat);
  pendulumBob.rotation.x = Math.PI / 2;
  pendulumBob.position.y = -0.48;
  pendulumRodPivot.add(pendulumBob);
  projectMount.add(pendulumGroup);
  projectGroups['orchard_pendulum'] = pendulumGroup;

  // 4b. A Music Box Comb — small cedar box open under the loupe with a brass comb
  const musicBoxGroup = new THREE.Group();
  const boxBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, 0.14, 0.26)), walnutMat);
  boxBody.position.set(0.45, 1.06, 0);
  boxBody.castShadow = true;
  musicBoxGroup.add(boxBody);
  const boxLid = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, 0.03, 0.26)), walnutMat);
  boxLid.position.set(0.32, 1.2, -0.16);
  boxLid.rotation.y = 0.5;
  boxLid.rotation.x = -0.28;
  musicBoxGroup.add(boxLid);
  const combBase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.22, 0.02, 0.1)), brassMat);
  combBase.position.set(0.45, 1.14, 0.02);
  musicBoxGroup.add(combBase);
  const combToothGeo = trackGeo(new THREE.BoxGeometry(0.012, 0.05, 0.012));
  for (let ci = 0; ci < 7; ci++) {
    const tooth = new THREE.Mesh(combToothGeo, brassMat);
    tooth.position.set(0.36 + ci * 0.03, 1.17, 0.02);
    tooth.scale.y = 1 - ci * 0.07;
    musicBoxGroup.add(tooth);
  }
  projectMount.add(musicBoxGroup);
  projectGroups['music_box_comb'] = musicBoxGroup;

  // 4c. The Watch Escapement — pocket watch on a stand, back plate open
  const watchGroup = new THREE.Group();
  const watchStand = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.1, 0.13, 0.1, 8)), ironMat);
  watchStand.position.set(0.45, 1.04, 0);
  watchGroup.add(watchStand);
  const watchBody = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 16)), brassMat);
  watchBody.rotation.x = Math.PI / 2 - 0.3;
  watchBody.position.set(0.45, 1.18, 0.02);
  watchBody.castShadow = true;
  watchGroup.add(watchBody);
  const watchFace = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.085, 0.085, 0.015, 16)), clockFaceMat);
  watchFace.rotation.x = Math.PI / 2 - 0.3;
  watchFace.position.set(0.45, 1.18, 0.05);
  watchGroup.add(watchFace);
  const backPlate = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 0.015, 14)), gearMats[0]);
  backPlate.rotation.x = Math.PI / 2 - 0.3;
  backPlate.rotation.z = 0.7;
  backPlate.position.set(0.56, 1.2, -0.06);
  watchGroup.add(backPlate);
  projectMount.add(watchGroup);
  projectGroups['watch_escapement'] = watchGroup;

  // 4d. Bench Resting — rolled felt + covered tools, bench swept clean
  const restGroup = new THREE.Group();
  const rolledFelt = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 10)), feltMat);
  rolledFelt.rotation.z = Math.PI / 2;
  rolledFelt.position.set(-0.3, 1.05, 0);
  rolledFelt.castShadow = true;
  restGroup.add(rolledFelt);
  const toolRoll = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.44, 0.1, 0.18)), linenMat);
  toolRoll.position.set(0.5, 1.02, -0.05);
  toolRoll.rotation.y = 0.2;
  restGroup.add(toolRoll);
  const toolTie = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.11, 0.19)), trimMat);
  toolTie.position.set(0.42, 1.02, -0.05);
  restGroup.add(toolTie);
  projectMount.add(restGroup);
  projectGroups['bench_rest'] = restGroup;

  // ---------------------------------------------------------------------
  // 5. Bed alcove (north-east) — mirrors cw_bed obstacle
  // ---------------------------------------------------------------------
  const bedGroup = new THREE.Group();
  bedGroup.position.set(2.14, 0, -1.68);
  addStaticContactShadow(bedGroup, shadowTex, 1.7, 1.6, 0.45, 0.018);

  const bedFrame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.44, 0.26, 1.36)), walnutMat);
  bedFrame.position.set(0, 0.24, 0);
  bedFrame.castShadow = true;
  bedGroup.add(bedFrame);
  const mattress = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.36, 0.18, 1.28)), linenMat);
  mattress.position.set(0, 0.44, 0);
  bedGroup.add(mattress);
  const quilt = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.3, 0.1, 0.9)), quiltMat);
  quilt.position.set(-0.03, 0.55, 0.18);
  quilt.castShadow = true;
  bedGroup.add(quilt);
  const quiltFold = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.3, 0.06, 0.2)), quiltTrimMat);
  quiltFold.position.set(-0.03, 0.6, -0.22);
  bedGroup.add(quiltFold);
  const pillow = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.42, 0.12, 0.3)), linenMat);
  pillow.position.set(-0.38, 0.58, -0.42);
  pillow.rotation.y = 0.12;
  bedGroup.add(pillow);
  // Iron headboard against the east wall
  const headboard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.08, 0.7, 1.3)), ironMat);
  headboard.position.set(0.72, 0.5, 0);
  headboard.castShadow = true;
  bedGroup.add(headboard);
  // Nightstand west of the bed head with the regulator watch
  const nightstand = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.44, 0.5, 0.4)), walnutMat);
  nightstand.position.set(-0.95, 0.25, -0.42);
  nightstand.castShadow = true;
  bedGroup.add(nightstand);
  const nightDrawer = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.36, 0.12, 0.32)), trimMat);
  nightDrawer.position.set(-0.95, 0.3, -0.28);
  bedGroup.add(nightDrawer);
  const nightKnob = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.025, 6, 5)), brassMat);
  nightKnob.position.set(-0.95, 0.3, -0.1);
  bedGroup.add(nightKnob);
  const regulatorWatch = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 14)), brassMat);
  regulatorWatch.position.set(-0.95, 0.54, -0.42);
  regulatorWatch.castShadow = true;
  bedGroup.add(regulatorWatch);
  const regulatorFace = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 0.01, 12)), clockFaceMat);
  regulatorFace.rotation.x = Math.PI / 2;
  regulatorFace.position.set(-0.95, 0.56, -0.42);
  bedGroup.add(regulatorFace);
  // Small framed photo leaning against the wall lamp
  const photoFrame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.02, 0.18, 0.14)), walnutMat);
  photoFrame.position.set(-0.95, 0.66, -0.66);
  photoFrame.rotation.x = -0.18;
  bedGroup.add(photoFrame);
  const photoCard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.015, 0.14, 0.1)), creamMat);
  photoCard.position.set(-0.955, 0.66, -0.66);
  photoCard.rotation.x = -0.18;
  bedGroup.add(photoCard);
  // Wall lamp above the nightstand (warm at dusk, echoes the exterior porch lamp)
  const bedLampPlate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.16, 0.14)), ironMat);
  bedLampPlate.position.set(0.85, 1.3, -0.42);
  bedGroup.add(bedLampPlate);
  const bedLampGlass = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.07, 0.09, 0.14, 7)), lampMat);
  bedLampGlass.position.set(0.78, 1.3, -0.42);
  bedGroup.add(bedLampGlass);
  group.add(bedGroup);

  // ---------------------------------------------------------------------
  // 6. Mended pieces shelf & drawers (west) — mirrors cw_shelf obstacle
  // ---------------------------------------------------------------------
  const shelfGroup = new THREE.Group();
  shelfGroup.position.set(-2.58, 0, 0.28);
  addStaticContactShadow(shelfGroup, shadowTex, 1.0, 2.4, 0.42, 0.018);

  const shelfBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.72, 1.86, 2.14)), cedarWarmMat);
  shelfBody.position.set(0, 1.0, 0);
  shelfBody.castShadow = true;
  shelfGroup.add(shelfBody);
  const shelfBack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 1.86, 2.14)), trimMat);
  shelfBack.position.set(0.34, 1.0, 0);
  shelfGroup.add(shelfBack);
  // Three boards with mended clocks
  const boardGeo = trackGeo(new THREE.BoxGeometry(0.5, 0.05, 2.02));
  const clockCaseGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.2, 0.12));
  const shelfRows: Array<[number, number]> = [
    [0.62, 5],
    [1.12, 4],
    [1.62, 5],
  ];
  for (const [by, count] of shelfRows) {
    const board = new THREE.Mesh(boardGeo, mapleMat);
    board.position.set(0.06, by, 0);
    shelfGroup.add(board);
    for (let ci = 0; ci < count; ci++) {
      const clockCase = new THREE.Mesh(clockCaseGeo, ci % 2 === 0 ? walnutMat : crabwoodMat);
      clockCase.position.set(0.1, by + 0.14, -0.85 + ci * 0.38 + (ci % 2) * 0.06);
      clockCase.rotation.y = (ci % 3) * 0.16 - 0.16;
      shelfGroup.add(clockCase);
      if (ci % 2 === 0) {
        const tinyFace = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 10)), clockFaceMat);
        tinyFace.rotation.z = Math.PI / 2;
        tinyFace.position.set(0.19, by + 0.16, -0.85 + ci * 0.38 + (ci % 2) * 0.06);
        shelfGroup.add(tinyFace);
      }
    }
  }
  // Drawer cabinet base (two drawers with brass pulls)
  const drawerCab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.66, 0.52, 2.0)), mapleEdgeMat);
  drawerCab.position.set(0, 0.28, 0);
  drawerCab.castShadow = true;
  shelfGroup.add(drawerCab);
  const pullGeo = trackGeo(new THREE.TorusGeometry(0.035, 0.01, 5, 10), );
  for (const [dy, dz] of [
    [0.38, -0.5],
    [0.38, 0.5],
    [0.14, -0.5],
    [0.14, 0.5],
  ]) {
    const pull = new THREE.Mesh(pullGeo, brassMat);
    pull.position.set(0.34, dy, dz);
    pull.rotation.y = Math.PI / 2;
    shelfGroup.add(pull);
  }
  // The mending ledger, cloth-bound, lying open on the middle board
  const ledgerCover = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.2, 0.03, 0.3)), trimMat);
  ledgerCover.position.set(0.16, 1.18, 0.72);
  ledgerCover.rotation.y = 0.18;
  shelfGroup.add(ledgerCover);
  const ledgerPage = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.17, 0.012, 0.26)), linenMat);
  ledgerPage.position.set(0.17, 1.19, 0.72);
  ledgerPage.rotation.y = 0.18;
  shelfGroup.add(ledgerPage);
  group.add(shelfGroup);

  // ---------------------------------------------------------------------
  // 7. Copper kettle stove (east) — mirrors cw_stove obstacle
  // ---------------------------------------------------------------------
  const stoveGroup = new THREE.Group();
  stoveGroup.position.set(2.58, 0, 0.6);
  addStaticContactShadow(stoveGroup, shadowTex, 1.0, 2.1, 0.45, 0.018);

  const stoveBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.72, 0.94, 1.5)), ironMat);
  stoveBody.position.set(0, 0.47, 0);
  stoveBody.castShadow = true;
  stoveGroup.add(stoveBody);
  const stoveTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.78, 0.07, 1.56)), darkStoneMat);
  stoveTop.position.set(0, 0.97, 0);
  stoveGroup.add(stoveTop);
  // Fire door + small brass rail
  const fireDoor = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.34, 0.4)), trimMat);
  fireDoor.position.set(-0.37, 0.42, -0.2);
  stoveGroup.add(fireDoor);
  const fireRail = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.06, 0.012, 5, 10)), brassMat);
  fireRail.position.set(-0.37, 0.42, -0.2);
  fireRail.rotation.y = Math.PI / 2;
  stoveGroup.add(fireRail);
  // Copper kettle with spout + handle
  const kettleBody = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.16, 0.19, 0.24, 12)), copperMat);
  kettleBody.position.set(0, 1.14, 0.24);
  kettleBody.castShadow = true;
  stoveGroup.add(kettleBody);
  const kettleLid = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.1, 0.14, 0.07, 12)), copperMat);
  kettleLid.position.set(0, 1.3, 0.24);
  stoveGroup.add(kettleLid);
  const kettleKnob = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.03, 6, 5)), kettleGlowMat);
  kettleKnob.position.set(0, 1.36, 0.24);
  stoveGroup.add(kettleKnob);
  const kettleSpout = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.03, 0.045, 0.2, 7)), copperMat);
  kettleSpout.rotation.z = 0.9;
  kettleSpout.position.set(-0.18, 1.2, 0.24);
  stoveGroup.add(kettleSpout);
  const kettleHandle = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.11, 0.015, 5, 12, Math.PI)), ironMat);
  kettleHandle.rotation.z = Math.PI;
  kettleHandle.position.set(0, 1.3, 0.24);
  stoveGroup.add(kettleHandle);
  // Two stoneware cups waiting on the stove top
  const cupGeo = trackGeo(new THREE.CylinderGeometry(0.05, 0.04, 0.08, 9));
  const cupA = new THREE.Mesh(cupGeo, ceramicMat);
  cupA.position.set(0.05, 1.05, -0.34);
  stoveGroup.add(cupA);
  const cupB = new THREE.Mesh(cupGeo, ceramicMat);
  cupB.position.set(-0.12, 1.05, -0.16);
  stoveGroup.add(cupB);
  // The brass-edged visitor's card propped against the wall
  const visitorCard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.02, 0.16, 0.22)), creamMat);
  visitorCard.position.set(-0.14, 1.14, -0.58);
  visitorCard.rotation.x = -0.24;
  stoveGroup.add(visitorCard);
  const cardEdge = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.015, 0.17, 0.23)), brassMat);
  cardEdge.position.set(-0.152, 1.14, -0.58);
  cardEdge.rotation.x = -0.24;
  stoveGroup.add(cardEdge);
  // Flue pipe rising into the east header beam
  const flueLower = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.07, 0.08, 0.5, 9)), ironMat);
  flueLower.position.set(0.1, 1.28, -0.42);
  stoveGroup.add(flueLower);
  const flueUpper = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 9)), ironMat);
  flueUpper.position.set(0.1, 2.02, -0.42);
  stoveGroup.add(flueUpper);
  group.add(stoveGroup);

  // Pooled kettle steam puffs above the kettle mouth (gated on teaSharedDay)
  const kettleSteamGroup = new THREE.Group();
  kettleSteamGroup.position.set(2.58, 1.44, 0.84);
  group.add(kettleSteamGroup);
  const steamPuffs: THREE.Mesh[] = [];
  const puffGeo = trackGeo(new THREE.SphereGeometry(0.07, 7, 6));
  for (let i = 0; i < 4; i++) {
    const puff = new THREE.Mesh(puffGeo, steamMat);
    puff.visible = false;
    kettleSteamGroup.add(puff);
    steamPuffs.push(puff);
  }

  // ---------------------------------------------------------------------
  // 8. Window armchair (south-west) — mirrors cw_chair obstacle
  // ---------------------------------------------------------------------
  const chairGroup = new THREE.Group();
  chairGroup.position.set(-1.38, 0, 1.55);
  chairGroup.rotation.y = 0.5; // angled toward the room / kettle corner
  addStaticContactShadow(chairGroup, shadowTex, 1.5, 1.4, 0.5, 0.018);

  const seatBase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.86, 0.32, 0.8)), quiltMat);
  seatBase.position.set(0, 0.28, 0);
  seatBase.castShadow = true;
  chairGroup.add(seatBase);
  const seatCushion = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.8, 0.14, 0.74)), linenMat);
  seatCushion.position.set(0, 0.5, 0);
  chairGroup.add(seatCushion);
  const backRest = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.86, 0.72, 0.2)), quiltMat);
  backRest.position.set(0, 0.72, -0.34);
  backRest.rotation.x = 0.14;
  backRest.castShadow = true;
  chairGroup.add(backRest);
  const armGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.3, 0.72));
  const armL = new THREE.Mesh(armGeo, quiltMat);
  armL.position.set(-0.42, 0.56, 0.02);
  armL.castShadow = true;
  chairGroup.add(armL);
  const armR = new THREE.Mesh(armGeo, quiltMat);
  armR.position.set(0.42, 0.56, 0.02);
  armR.castShadow = true;
  chairGroup.add(armR);
  const throwFold = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.3, 0.05, 0.5)), quiltTrimMat);
  throwFold.position.set(-0.3, 0.58, 0.05);
  throwFold.rotation.y = 0.3;
  chairGroup.add(throwFold);
  // Four stubby legs
  const legGeo = trackGeo(new THREE.CylinderGeometry(0.045, 0.035, 0.14, 7));
  for (const [lx, lz] of [
    [-0.34, -0.28],
    [0.34, -0.28],
    [-0.34, 0.28],
    [0.34, 0.28],
  ]) {
    const leg = new THREE.Mesh(legGeo, walnutMat);
    leg.position.set(lx, 0.07, lz);
    chairGroup.add(leg);
  }
  // Footstool in front
  const stoolTop = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.44, 0.1, 0.34)), linenMat);
  stoolTop.position.set(0, 0.22, 0.6);
  stoolTop.castShadow = true;
  chairGroup.add(stoolTop);
  for (const [sx, sz] of [
    [-0.16, 0.5],
    [0.16, 0.5],
    [-0.16, 0.7],
    [0.16, 0.7],
  ]) {
    const sleg = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.03, 0.025, 0.18, 6)), walnutMat);
    sleg.position.set(sx, 0.09, sz);
    chairGroup.add(sleg);
  }
  group.add(chairGroup);

  // ---------------------------------------------------------------------
  // 9. Interior door (south), mat & wall lantern
  // ---------------------------------------------------------------------
  const doorGroup = new THREE.Group();
  doorGroup.position.set(1.0, 0, 2.44);
  const doorSlab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.05, 2.05, 0.09)), cedarWarmMat);
  doorSlab.position.set(0, 1.02, 0.05);
  doorGroup.add(doorSlab);
  const doorPanelA = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.75, 0.7, 0.03)), trimMat);
  doorPanelA.position.set(0, 1.42, 0.1);
  doorGroup.add(doorPanelA);
  const doorPanelB = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.75, 0.85, 0.03)), trimMat);
  doorPanelB.position.set(0, 0.6, 0.1);
  doorGroup.add(doorPanelB);
  const doorKnob = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.05, 8, 7)), brassMat);
  doorKnob.position.set(-0.4, 1.05, 0.14);
  doorGroup.add(doorKnob);
  const doorPlate = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.075, 0.075, 0.015, 10)), brassMat);
  doorPlate.rotation.x = Math.PI / 2;
  doorPlate.position.set(-0.4, 1.05, 0.11);
  doorGroup.add(doorPlate);
  // A little brass letter slot (Arthur reads the noticeboard by mail)
  const letterSlot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.18, 0.03, 0.02)), brassMat);
  letterSlot.position.set(0.1, 1.22, 0.11);
  doorGroup.add(letterSlot);
  group.add(doorGroup);

  const doorMat = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.0, 0.03, 0.55)), feltMat);
  doorMat.position.set(1.0, 0.025, 2.0);
  group.add(doorMat);

  // Wall lantern beside the door (echoes the exterior porch lamp)
  const wallLanternBracket = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.05, 0.16)), ironMat);
  wallLanternBracket.position.set(1.9, 2.06, 2.4);
  group.add(wallLanternBracket);
  const wallLanternCage = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.07, 0.085, 0.16, 6)), ironMat);
  wallLanternCage.position.set(1.9, 1.94, 2.38);
  group.add(wallLanternCage);
  const wallLanternGlow = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.065, 0.11, 6)), lampMat);
  wallLanternGlow.position.set(1.9, 1.93, 2.38);
  group.add(wallLanternGlow);

  // ---------------------------------------------------------------------
  // 10. Window shaft + brass-dust motes
  // ---------------------------------------------------------------------
  const shaftGeo = trackGeo(new THREE.PlaneGeometry(1.5, 3.4));
  const shaftA = new THREE.Mesh(shaftGeo, shaftMat);
  shaftA.position.set(-2.5, 1.7, 0.1);
  shaftA.rotation.y = Math.PI / 2.2;
  shaftA.rotation.x = 0.15;
  group.add(shaftA);

  const MOTE_COUNT = 24;
  const moteGeo = trackGeo(new THREE.BufferGeometry());
  const moteBase = new Float32Array(MOTE_COUNT * 3);
  for (let i = 0; i < MOTE_COUNT; i++) {
    moteBase[i * 3] = -2.4 + (i % 10) * 0.5;
    moteBase[i * 3 + 1] = 0.5 + ((i * 7) % 13) * 0.13;
    moteBase[i * 3 + 2] = -1.7 + ((i * 5) % 15) * 0.24;
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(moteBase.slice(), 3));
  const motes = new THREE.Points(moteGeo, moteMat);
  group.add(motes);

  // ---------------------------------------------------------------------
  // 11. Interaction hit proxies (stations + window armchair seat)
  // ---------------------------------------------------------------------
  const hitProxies: THREE.Mesh[] = [];
  const proxyGeoCache = new Map<string, THREE.BoxGeometry>();
  for (const prop of COPPERWHEEL_INTERACTABLES) {
    const key = `${prop.id}_${Math.round(prop.x * 10)}`;
    let proxyGeo = proxyGeoCache.get(key);
    if (!proxyGeo) {
      proxyGeo = trackGeo(new THREE.BoxGeometry(0.62, 1.05, 0.62));
      proxyGeoCache.set(key, proxyGeo);
    }
    const proxy = new THREE.Mesh(proxyGeo, hitProxyMat);
    proxy.position.set(prop.focusX, 0.72, prop.focusZ);
    proxy.userData = { targetKind: 'copperwheel_prop', targetId: prop.id };
    group.add(proxy);
    hitProxies.push(proxy);
  }
  const seatProxyGeo = trackGeo(new THREE.BoxGeometry(0.6, 0.95, 0.6));
  const seatProxy = new THREE.Mesh(seatProxyGeo, hitProxyMat);
  const seat = COPPERWHEEL_SEAT_SPOTS[0];
  seatProxy.position.set(seat.seatPos.x, 0.6, seat.seatPos.z);
  seatProxy.userData = { targetKind: 'seat', targetId: seat.id };
  group.add(seatProxy);
  hitProxies.push(seatProxy);

  // ---------------------------------------------------------------------
  // Reactive update — zero per-frame allocation
  // ---------------------------------------------------------------------
  function update(world: WorldState, phase: TimePhase, elapsed: number): void {
    const cws = world.copperwheelState;
    const checkedToday = (cws?.benchCheckedDay ?? 0) === world.day;
    const teaPouredToday = (cws?.teaSharedDay ?? 0) === world.day;
    const project = getProjectForDay(world.day);

    // Day-cycle bench project: one group visible at a time
    for (const key of Object.keys(projectGroups)) {
      projectGroups[key].visible = key === project.id;
    }
    // The pendulum swings only while the bench was checked today (the helping moment)
    if (project.id === 'orchard_pendulum') {
      pendulumRodPivot.rotation.z = checkedToday
        ? Math.sin(elapsed * 2.4) * 0.16
        : 0.02;
    }

    // Kettle steam rises only when a chamomile cup was poured today
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

    // Bench lamp warms the room toward dusk; soft glow during golden hour
    if (phase === 'dusk') {
      benchLampLight.intensity = 1.3 + Math.sin(elapsed * 3.1) * 0.08;
      lampMat.emissiveIntensity = 1.5 + Math.sin(elapsed * 4.0) * 0.12;
      lampShadeMat.emissiveIntensity = 0.6;
      kettleGlowMat.emissiveIntensity = 0.35;
      shaftMat.opacity = 0.05;
      moteMat.opacity = 0.12;
    } else if (phase === 'golden') {
      benchLampLight.intensity = 0.4;
      lampMat.emissiveIntensity = 0.45;
      lampShadeMat.emissiveIntensity = 0.2;
      kettleGlowMat.emissiveIntensity = 0.14;
      shaftMat.opacity = 0.24 + Math.sin(elapsed * 0.7) * 0.03;
      moteMat.opacity = 0.26;
    } else {
      benchLampLight.intensity = 0.0;
      lampMat.emissiveIntensity = 0.16;
      lampShadeMat.emissiveIntensity = 0.1;
      kettleGlowMat.emissiveIntensity = 0.08;
      shaftMat.opacity = phase === 'morning' ? 0.3 : 0.17;
      moteMat.opacity = 0.26;
    }

    // Drifting brass-dust motes in the window shaft
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
    benchLampLight,
    kettleSteamGroup,
    projectGroups,
    update,
    dispose,
  };
}

/** Shelf-slot tint per bench project so the rig + game cycle stay in contract (tested). */
export const COPPERWHEEL_PROJECT_COUNT = 4;

/**
 * Small exterior porch dressing for Copperwheel's existing south door: a brass-edged step mat,
 * a crate of clock parts awaiting repair, and a lean-to repair sign. Mounted by the canvas at
 * the south face of the cottage (world position (13.1, 0, -8.72), facing the south yard).
 * The wall lantern beside the door is already provided by `buildArthurPorchLampRig`.
 */
export function buildCopperwheelPorchDressing(
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
  const mapleMat = palette.standard('#C9A876', 0.8, 0.02);
  const mapleEdgeMat = palette.standard('#9A7A50', 0.84, 0.02);
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.25, 0.86);
  const creamMat = palette.standard(STORYBOOK_PALETTE.creamTrim, 0.78, 0.02);
  const walnutMat = palette.standard('#6B4A36', 0.62, 0.05);

  // Step stone + brass-edged doormat under the doorway
  const step = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.15, 0.09, 0.85)), limestoneMat);
  step.position.set(0, 0.045, 0.32);
  step.receiveShadow = true;
  group.add(step);
  const matEdge = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.92, 0.035, 0.6)), brassMat);
  matEdge.position.set(0, 0.105, 0.3);
  group.add(matEdge);
  const matInfill = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.8, 0.03, 0.48)), creamMat);
  matInfill.position.set(0, 0.115, 0.3);
  group.add(matInfill);

  // Repair crate with a clock case peeking out (drop-off point for mending)
  const crate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.56, 0.36, 0.42)), mapleMat);
  crate.position.set(-0.75, 0.26, 0.15);
  crate.castShadow = true;
  crate.receiveShadow = true;
  group.add(crate);
  const crateLid = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.62, 0.07, 0.48)), mapleEdgeMat);
  crateLid.position.set(-0.75, 0.47, 0.15);
  crateLid.castShadow = true;
  group.add(crateLid);
  const waitingCase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.16, 0.2, 0.13)), walnutMat);
  waitingCase.position.set(-0.62, 0.6, 0.15);
  waitingCase.rotation.y = 0.3;
  waitingCase.castShadow = true;
  group.add(waitingCase);
  const waitingFace = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 10)), creamMat);
  waitingFace.rotation.z = Math.PI / 2;
  waitingFace.rotation.y = 0.3;
  waitingFace.position.set(-0.53, 0.6, 0.15);
  group.add(waitingFace);
  const boltMat = brassMat;
  for (const bx of [-1.0, -0.5]) {
    for (const bz of [0.0, 0.32]) {
      const bolt = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.03, 6, 5)), boltMat);
      bolt.position.set(bx, 0.34, bz);
      group.add(bolt);
    }
  }

  // Lean-to "MENDED WHILE YOU WAIT" style A-frame sign
  const signBoard = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.34, 0.42, 0.04)), creamMat);
  signBoard.position.set(0.72, 0.42, 0.22);
  signBoard.rotation.x = -0.12;
  signBoard.castShadow = true;
  group.add(signBoard);
  const signGear = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.09, 0.02, 6, 12)), brassMat);
  signGear.position.set(0.72, 0.5, 0.25);
  signGear.rotation.x = -0.12;
  group.add(signGear);
  const signGearHub = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 8)), brassMat);
  signGearHub.rotation.x = Math.PI / 2 - 0.12;
  signGearHub.position.set(0.72, 0.5, 0.25);
  group.add(signGearHub);
  for (const sx of [0.58, 0.86]) {
    const signLeg = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.05, 0.44, 0.05)), mapleEdgeMat);
    signLeg.position.set(sx, 0.22, 0.3);
    signLeg.castShadow = true;
    group.add(signLeg);
  }

  addStaticContactShadow(group, shadowTex, 2.2, 1.2, 0.42, 0.018);

  group.userData.dispose = () => {
    for (const g of ownedGeos) g.dispose();
    for (const m of ownedMats) m.dispose();
  };

  return group;
}
