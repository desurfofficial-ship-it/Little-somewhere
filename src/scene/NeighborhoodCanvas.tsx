import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CarryableItemId,
  CottageInteractableId,
  GameScreenState,
  InteractiveTarget,
  PlayerLocation,
  PlayerPosture,
  PropInteractableId,
  ResidentId,
  ScreenVec2,
  SeasonType,
  TimePhase,
  Vec2,
  WeatherType,
  WorldState,
} from '../game/types';
import {
  RESIDENTS,
  RESIDENT_ORDER,
  getTimePhase,
} from '../game/residents';
import {
  createInitialNpcRuntime,
  stepSimulationInPlace,
} from '../game/simulation';
import {
  CARRYABLE_PROP_DEFS,
  PROP_INTERACTABLES,
  SEAT_SPOTS,
  distance2D,
  getGroundHeightAt,
  getPropInteractionMetrics,
  getSeatById,
  isPointWalkable,
} from '../game/worldMap';
import {
  computeSitGroundY,
  createInitialPlayerMotion,
  selectBestInteractiveTarget,
  stepPlayerMovement,
  wrapAngleDelta,
} from '../game/playerController';
import {
  COTTAGE_BOUNDS,
  COTTAGE_INTERACTABLES,
  computeInteriorWaypoints,
  isInteriorPointWalkable,
} from '../game/cottage';
import { computeWaypointPath } from '../game/navigation';
import { getResidentAvailableQuestCue } from '../game/narrative';
import { composeEnvironmentState } from '../game/environment';
import { cozyAudio } from '../game/audio';
import { EnvironmentVisualController } from './environmentRenderer';
import {
  CharacterRig,
  FountainRig,
  GazeboRig,
} from './models';
import {
  createCobblestoneTexture,
  createContactShadowTexture,
  createMeadowMacroTexture,
  createMeadowTexture,
  createOrchardSignTexture,
  createRoofShingleTexture,
} from './textures';
import { MaterialPalette, STORYBOOK_PALETTE } from './materials';
import {
  buildStorybookJun,
  buildWillowLaneCourtyardProps,
  buildWillowMailbox,
  buildWillowStepCottage,
  updateWillowPrototypeMotion,
} from './prototypes/willowLaneDiorama';
import {
  addContactShadow,
  buildGroveTreesInstanced,
  buildHollowOakLandmark,
  buildMirrorPondAndBridge,
  buildPerimeterBorder,
} from './builders/vegetation';
import { buildMeadowDressing } from './builders/botanicalDressing';
import { buildFernHollowOrchard } from './builders/orchard';
import { buildOrchardMicroLife } from './builders/orchardMicroLife';
import { buildAllReactiveRigs } from './builders/reactiveProps';
import { buildWillowCottageInterior } from './builders/cottageInterior';
import {
  buildCarryablePropMesh,
  buildStorybookBench,
  buildStorybookFountain,
  buildStorybookGazebo,
  buildStorybookNoticeboard,
  buildStorybookTeaCart,
} from './builders/landmarks';
import {
  buildBakeryCafeTables,
  buildStorybookArthurWorkshop,
  buildStorybookBakery,
  buildStorybookBarnabyWoodshop,
  buildStorybookBookNook,
  buildStorybookGreenhouse,
} from './builders/buildings';
import {
  CharacterAnimationOptions,
  animateCharacterRig,
  buildStorybookCharacter,
} from './builders/characters';

export interface HudBubbleSnapshot {
  residentId: ResidentId;
  name: string;
  text: string;
}

export interface PlayerActionPulse {
  kind: 'wave' | 'interact' | 'talk';
  seq: number;
  focusPos?: Vec2;
}

export interface NeighborhoodCanvasProps {
  screenState: GameScreenState;
  worldRef: React.MutableRefObject<WorldState>;
  joystickVectorRef: React.MutableRefObject<ScreenVec2>;
  zoomRef: React.MutableRefObject<number>;
  bellRingCounter: number;
  fountainWishCounter?: number;
  pondSkipCounter?: number;
  isDialogueOpen: boolean;
  activeDialogueResidentId?: ResidentId | null;
  activePropId?: PropInteractableId | null;
  playerActionPulse?: PlayerActionPulse | null;
  onHudSync: (snapshot: {
    minuteOfDay: number;
    playerPos: Vec2;
    playerFacing: number;
    playerPosture: PlayerPosture;
    playerHeldItem: CarryableItemId | null;
    playerLocation: PlayerLocation;
    nearestTarget: InteractiveTarget | null;
    nearbyBubble: HudBubbleSnapshot | null;
    weather: WeatherType;
    season: SeasonType;
  }) => void;
  onSelectTarget: (target: InteractiveTarget) => void;
}

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _pointer = new THREE.Vector2();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _ringAmber = new THREE.Color('#E5A93C');
const _ringGiftSage = new THREE.Color('#6FA873');
const _playerAnimOpts: CharacterAnimationOptions = {
  emotion: 'relaxed',
  lookYaw: 0,
  lookPitch: 0,
  bankAngle: 0,
  carrying: false,
  isMoving: false,
};
const _npcAnimOpts: CharacterAnimationOptions = {
  emotion: 'relaxed',
  lookYaw: 0,
  lookPitch: 0,
  bankAngle: 0,
  carrying: false,
  isMoving: false,
};

function findNearestWalkablePoint(x: number, z: number, playerPos: Vec2): Vec2 | null {
  const cx = THREE.MathUtils.clamp(x, -23, 23);
  const cz = THREE.MathUtils.clamp(z, -21, 21);
  if (isPointWalkable(cx, cz, 0.48)) return { x: cx, z: cz };

  for (let r = 0.8; r <= 4.0; r += 0.8) {
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      const nx = THREE.MathUtils.clamp(cx + Math.cos(ang) * r, -23, 23);
      const nz = THREE.MathUtils.clamp(cz + Math.sin(ang) * r, -21, 21);
      if (isPointWalkable(nx, nz, 0.48)) return { x: nx, z: nz };
    }
  }
  const midX = (playerPos.x + cx) * 0.5;
  const midZ = (playerPos.z + cz) * 0.5;
  return isPointWalkable(midX, midZ, 0.48) ? { x: midX, z: midZ } : null;
}

function findNearestInteriorWalkablePoint(x: number, z: number): Vec2 | null {
  const cx = THREE.MathUtils.clamp(x, COTTAGE_BOUNDS.minX + 0.45, COTTAGE_BOUNDS.maxX - 0.45);
  const cz = THREE.MathUtils.clamp(z, COTTAGE_BOUNDS.minZ + 0.45, COTTAGE_BOUNDS.maxZ - 0.45);
  if (isInteriorPointWalkable(cx, cz, 0.42)) return { x: cx, z: cz };

  for (let r = 0.45; r <= 2.4; r += 0.45) {
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      const nx = THREE.MathUtils.clamp(cx + Math.cos(ang) * r, COTTAGE_BOUNDS.minX + 0.45, COTTAGE_BOUNDS.maxX - 0.45);
      const nz = THREE.MathUtils.clamp(cz + Math.sin(ang) * r, COTTAGE_BOUNDS.minZ + 0.45, COTTAGE_BOUNDS.maxZ - 0.45);
      if (isInteriorPointWalkable(nx, nz, 0.42)) return { x: nx, z: nz };
    }
  }
  return null;
}

export const NeighborhoodCanvas: React.FC<NeighborhoodCanvasProps> = ({
  screenState,
  worldRef,
  joystickVectorRef,
  zoomRef,
  bellRingCounter,
  fountainWishCounter = 0,
  pondSkipCounter = 0,
  isDialogueOpen,
  activeDialogueResidentId = null,
  activePropId = null,
  playerActionPulse = null,
  onHudSync,
  onSelectTarget,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const screenStateRef = useRef<GameScreenState>(screenState);
  const dialogueOpenRef = useRef<boolean>(isDialogueOpen);
  const activeDialogueResidentRef = useRef<ResidentId | null>(activeDialogueResidentId);
  const activePropIdRef = useRef<PropInteractableId | null>(activePropId);
  const playerActionPulseRef = useRef<PlayerActionPulse | null>(playerActionPulse);
  const onHudSyncRef = useRef(onHudSync);
  const onSelectTargetRef = useRef(onSelectTarget);
  const bellSwingVelRef = useRef(0);
  const lastBellCountRef = useRef(bellRingCounter);
  const lastFountainWishCountRef = useRef(fountainWishCounter);
  const lastPondSkipCountRef = useRef(pondSkipCounter);

  screenStateRef.current = screenState;
  dialogueOpenRef.current = isDialogueOpen;
  activeDialogueResidentRef.current = activeDialogueResidentId;
  activePropIdRef.current = activePropId;
  playerActionPulseRef.current = playerActionPulse;
  onHudSyncRef.current = onHudSync;
  onSelectTargetRef.current = onSelectTarget;

  useEffect(() => {
    if (bellRingCounter > lastBellCountRef.current) {
      lastBellCountRef.current = bellRingCounter;
      bellSwingVelRef.current = 4.2;
      cozyAudio.playGazeboBell();
    }
  }, [bellRingCounter]);

  useEffect(() => {
    if (fountainWishCounter > lastFountainWishCountRef.current) {
      lastFountainWishCountRef.current = fountainWishCounter;
    }
  }, [fountainWishCounter]);

  useEffect(() => {
    if (pondSkipCounter > lastPondSkipCountRef.current) {
      lastPondSkipCountRef.current = pondSkipCounter;
    }
  }, [pondSkipCounter]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#DCEBF2');
    scene.fog = new THREE.Fog('#DCEBF2', 42, 86);

    const exteriorRoot = new THREE.Group();
    const interiorRoot = new THREE.Group();
    interiorRoot.visible = false;
    scene.add(exteriorRoot, interiorRoot);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    scene.environmentIntensity = 0.68;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const camera = new THREE.PerspectiveCamera(28, width / height, 0.5, 160);
    if (screenStateRef.current === 'playing') {
      const zoom = zoomRef.current;
      const pPos = worldRef.current.playerPos;
      camera.position.set(pPos.x + 19.5 * zoom, 18.2 * zoom, pPos.z + 19.5 * zoom);
      camera.lookAt(pPos.x, 1.0, pPos.z);
    } else {
      camera.position.set(18, 17, 18);
      camera.lookAt(0, 1.2, 0);
    }

    // 3-Point Warm/Cool Lighting Rig
    const hemiLight = new THREE.HemisphereLight('#B5D7EB', '#7A664E', 0.54);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight('#FFF1D0', 1.52);
    sunLight.position.set(22, 30, 16);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 4;
    sunLight.shadow.camera.far = 85;
    const d = 28;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.025;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight('#C8DCF2', 0.45);
    rimLight.position.set(-18, 14, -20);
    scene.add(rimLight);

    // Procedural textures
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const meadowTex = createMeadowTexture(maxAniso);
    const meadowMacroTex = createMeadowMacroTexture(maxAniso);
    const cobbleTex = createCobblestoneTexture(maxAniso);
    const terracottaRoofTex = createRoofShingleTexture('#C46347', '#D97B5E', maxAniso);
    const sageRoofTex = createRoofShingleTexture('#5F8267', '#759B7D', maxAniso);
    const slateRoofTex = createRoofShingleTexture('#5D7082', '#73889C', maxAniso);
    const shadowTex = createContactShadowTexture();
    const orchardSignTex = createOrchardSignTexture();

    // Extended natural meadow floor (no boxed void)
    const groundMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      map: meadowTex,
      roughness: 0.92,
      metalness: 0.0,
    });
    // R-05: second UV channel drives the large-scale macro-variation lightMap
    // (repeat 2x2) so the 9x9 detail tiling of the meadow texture no longer reads.
    const groundGeo = new THREE.PlaneGeometry(110, 110);
    groundGeo.setAttribute('uv1', groundGeo.getAttribute('uv').clone());
    groundMat.lightMap = meadowMacroTex;
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    exteriorRoot.add(ground);

    // Shared storybook palette & reactive scene elements
    const palette = new MaterialPalette();
    const windowMaterials: THREE.MeshStandardMaterial[] = [];
    const prototypeLanternMats: THREE.MeshStandardMaterial[] = [];
    const flowerGroups: THREE.Group[] = [];

    // Cobblestone road & plaza slabs (offset by +0.02 on Y to prevent Z-fighting)
    const cobbleMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      map: cobbleTex,
      roughness: 0.86,
      metalness: 0.02,
    });

    const addCobbleStrip = (x: number, z: number, w: number, l: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, l), cobbleMat);
      m.position.set(x, 0.02, z);
      m.receiveShadow = true;
      exteriorRoot.add(m);
    };
    // Central Plaza + cross lanes + bridge & woodshop spurs
    addCobbleStrip(0, 0, 12.5, 13.5);
    addCobbleStrip(-9, 10, 11, 3.6); // Home lane
    addCobbleStrip(-10, -1, 3.8, 22); // West lane (Book Nook -> Bakery -> Home)
    addCobbleStrip(8.3, -1, 4.2, 23); // East lane (Workshop -> Greenhouse -> Woodshop)
    addCobbleStrip(8.3, 11.6, 4.0, 2.6); // East lane extension to Pinecone Woodshop
    addCobbleStrip(0, 7.2, 22, 3.2); // South promenade above pond
    addCobbleStrip(-2.9, 10.1, 2.3, 3.0); // Bridge approach walk
    addCobbleStrip(0, -6.5, 22, 3.2); // North promenade by gazebo

    // Natural perimeter stone/cedar border, rolling distant hills & multi-lobe instanced grove
    exteriorRoot.add(buildPerimeterBorder(palette, shadowTex));
    const groveRig = buildGroveTreesInstanced(palette, isSoftwareGl);
    exteriorRoot.add(groveRig.group);

    // Instanced botanical dressing: clover cushions, grass tufts, wildflower
    // clumps & fieldstone pebbles across the meadow margins (5 draw calls,
    // collision-aware seeded placement)
    const meadowDressing = buildMeadowDressing(palette, isSoftwareGl);
    exteriorRoot.add(meadowDressing.group);

    // Fern Hollow Orchard — Milestone 3 north district landmark (instanced
    // crabapple trees sharing the grove season-tint materials, gate, ladder,
    // harvest corner, bee skep, stepping stones)
    const orchardRig = buildFernHollowOrchard({
      palette,
      shadowTex,
      signTex: orchardSignTex,
      isSoftwareGl,
    });
    exteriorRoot.add(orchardRig.group);

    // Fern Hollow micro-life: blossom butterflies + skep bees (weather-gated
    // by the environment controller, updated in its section 6)
    const orchardMicroLifeRig = buildOrchardMicroLife({ isSoftwareGl });
    exteriorRoot.add(orchardMicroLifeRig.group);

    const willowProtoCtx = {
      palette,
      shadowTex,
      terracottaRoofTex,
      windowMaterials,
      lanternMaterials: prototypeLanternMats,
      flowerGroups,
    };

    const buildingCtx = {
      palette,
      shadowTex,
      terracottaRoofTex,
      sageRoofTex,
      slateRoofTex,
      windowMaterials,
      lanternMaterials: prototypeLanternMats,
      flowerGroups,
    };

    // Build Neighborhood Buildings (all pivoted at y = 0)
    // 1. Player Cottage Prototype (Willow Step Cottage + Courtyard + Mailbox)
    const willowCottage = buildWillowStepCottage(willowProtoCtx);
    willowCottage.group.position.set(-14.5, 0, 10.0);
    exteriorRoot.add(willowCottage.group);

    const willowCourtyard = buildWillowLaneCourtyardProps(willowProtoCtx);
    exteriorRoot.add(willowCourtyard.group);

    const willowMailbox = buildWillowMailbox(willowProtoCtx);
    willowMailbox.group.position.set(-9.8, 0, 7.2);
    exteriorRoot.add(willowMailbox.group);
    const mbFlag = willowMailbox.flagMesh;

    // 2. Hearth & Crumb Bakery (Clara) + Reactive Outdoor Café Tables
    exteriorRoot.add(buildStorybookBakery(buildingCtx));
    const bakeryTablesGroup = buildBakeryCafeTables(palette, shadowTex);
    exteriorRoot.add(bakeryTablesGroup);

    // 3. Linden Book Nook (Nora)
    exteriorRoot.add(buildStorybookBookNook(buildingCtx));

    // 4. Copperwheel Cottage (Arthur)
    exteriorRoot.add(buildStorybookArthurWorkshop(buildingCtx));

    // 5. Sunbeam Greenhouse (Mina)
    exteriorRoot.add(buildStorybookGreenhouse(buildingCtx));

    // 6. Pinecone Woodshop (Barnaby)
    exteriorRoot.add(buildStorybookBarnabyWoodshop(buildingCtx));

    // 7. Old Bell Gazebo (Centerpiece Landmark!)
    const gazeboRig: GazeboRig = buildStorybookGazebo(palette, shadowTex, sageRoofTex);
    exteriorRoot.add(gazeboRig.group);

    // 8. Mossy Stone Fountain
    const fountainRig: FountainRig = buildStorybookFountain(palette, shadowTex);
    exteriorRoot.add(fountainRig.group);

    // 9. Sora's Tea Cart & Neighborhood Noticeboard
    exteriorRoot.add(buildStorybookTeaCart(palette, shadowTex));
    const noticeboardRig = buildStorybookNoticeboard(palette, shadowTex, terracottaRoofTex);
    exteriorRoot.add(noticeboardRig.group);

    // 10. Mirror Pond, Arched Cedar Bridge & Gnarled Hollow Oak
    const pondRig = buildMirrorPondAndBridge(palette, shadowTex, prototypeLanternMats);
    exteriorRoot.add(pondRig.group);
    const hollowOakRig = buildHollowOakLandmark(palette, shadowTex);
    exteriorRoot.add(hollowOakRig.group);
    const oakGlint = hollowOakRig.oakGlint;

    // 10b. Everyday Life Outdoor Activity Props (porch herb box, greenhouse herb tray, pond driftwood nook)
    {
      const cedarMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.72, 0.02);
      const terraMat = palette.standard(STORYBOOK_PALETTE.terracottaPot, 0.44, 0.04);
      const herbMat = palette.standard(STORYBOOK_PALETTE.foliageMid, 0.84, 0.0);
      const camPetalMat = palette.standard(STORYBOOK_PALETTE.petalCream, 0.65, 0.0);
      const lavMat = palette.standard(STORYBOOK_PALETTE.petalLavender, 0.65, 0.0);
      const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.25, 0.85);
      const driftMat = palette.standard('#A89882', 0.86, 0.0);
      const glassMat = palette.standard('#E5A93C', 0.22, 0.15);

      // Willow Cottage Porch Chamomile & Herb Box
      const porchHerbGroup = new THREE.Group();
      porchHerbGroup.position.set(-10.8, 0, 12.1);
      addContactShadow(porchHerbGroup, shadowTex, 0.9, 0.9, 0.35, 0.015);
      const trough = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.76), cedarMat);
      trough.position.y = 0.22;
      trough.castShadow = true;
      const herbCluster = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24, 0), herbMat);
      herbCluster.position.set(0, 0.42, -0.1);
      const herbBloom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 7, 7), camPetalMat);
      herbBloom.position.set(0.05, 0.56, 0.12);
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.2, 8), brassMat);
      can.position.set(0.24, 0.1, 0.26);
      porchHerbGroup.add(trough, herbCluster, herbBloom, can);
      exteriorRoot.add(porchHerbGroup);

      // Greenhouse Outdoor Herb Planters
      const ghPlanterGroup = new THREE.Group();
      ghPlanterGroup.position.set(11.1, 0, 1.7);
      addContactShadow(ghPlanterGroup, shadowTex, 1.0, 1.1, 0.38, 0.015);
      const benchStand = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.46, 0.92), cedarMat);
      benchStand.position.y = 0.23;
      benchStand.castShadow = true;
      const potA = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.22, 8), terraMat);
      potA.position.set(0, 0.57, -0.22);
      const potB = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.22, 8), terraMat);
      potB.position.set(0, 0.57, 0.22);
      const thyme = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), herbMat);
      thyme.position.set(0, 0.72, -0.22);
      const lavender = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.14, 3, 6), lavMat);
      lavender.position.set(0, 0.76, 0.22);
      ghPlanterGroup.add(benchStand, potA, potB, thyme, lavender);
      exteriorRoot.add(ghPlanterGroup);

      // Mirror Pond East Driftwood & Curio Basket Nook
      const driftwoodGroup = new THREE.Group();
      driftwoodGroup.position.set(5.85, 0, 13.8);
      addContactShadow(driftwoodGroup, shadowTex, 1.1, 0.9, 0.35, 0.015);
      const driftLog = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.05, 8), driftMat);
      driftLog.rotation.x = Math.PI / 2;
      driftLog.rotation.z = 0.42;
      driftLog.position.set(0, 0.12, 0);
      driftLog.castShadow = true;
      const reedBasket = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.22, 9), cedarMat);
      reedBasket.position.set(-0.22, 0.11, -0.28);
      const pebbleA = new THREE.Mesh(new THREE.SphereGeometry(0.06, 7, 6), glassMat);
      pebbleA.scale.set(1.2, 0.65, 1.0);
      pebbleA.position.set(-0.22, 0.22, -0.28);
      driftwoodGroup.add(driftLog, reedBasket, pebbleA);
      exteriorRoot.add(driftwoodGroup);
    }

    // 11. Plaza Stone/Iron Lamps & Festoon Lantern Strands
    const lanternMat = new THREE.MeshStandardMaterial({
      color: '#FFE6A3',
      emissive: new THREE.Color('#FFAA3B'),
      emissiveIntensity: 0.22,
      roughness: 0.2,
    });
    const lampStoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.88, 0.02);
    const lampIronMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.42, 0.72);
    const festoonGroup = new THREE.Group();
    const lampPosts: Array<[number, number]> = [
      [-6.2, -5.2],
      [6.2, -5.2],
      [-6.2, 6.2],
      [6.2, 6.2],
    ];
    for (const [lx, lz] of lampPosts) {
      const lamp = new THREE.Group();
      lamp.position.set(lx, 0, lz);
      addContactShadow(lamp, shadowTex, 0.95, 0.95, 0.42, 0.018);
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.23, 0.28, 8), lampStoneMat);
      plinth.position.y = 0.14;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.58, 8), lampIronMat);
      post.position.y = 1.56;
      post.castShadow = true;
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.09, 6), lampIronMat);
      collar.position.y = 2.86;
      const bulb = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.24, 6), lanternMat);
      bulb.position.y = 3.01;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.16, 6), lampIronMat);
      cap.position.y = 3.2;
      lamp.add(plinth, post, collar, bulb, cap);
      exteriorRoot.add(lamp);
    }

    // Festoon lantern bulbs + overhead swag wire strung across plaza
    const wireMat = palette.standard('#3E3B39', 0.65, 0.4);
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const fx = THREE.MathUtils.lerp(-5.8, 5.8, t);
      const sag = Math.sin(t * Math.PI) * 0.65;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), lanternMat);
      bulb.position.set(fx, 3.25 - sag, -5.2);
      festoonGroup.add(bulb);
      if (i < 8) {
        const nt = (i + 1) / 8;
        const nfx = THREE.MathUtils.lerp(-5.8, 5.8, nt);
        const nsag = Math.sin(nt * Math.PI) * 0.65;
        const dx = nfx - fx;
        const dy = (3.25 - nsag) - (3.25 - sag);
        const segLen = Math.hypot(dx, dy);
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, segLen, 4), wireMat);
        seg.position.set((fx + nfx) * 0.5, 3.36 - (sag + nsag) * 0.5, -5.2);
        seg.rotation.z = Math.PI / 2 - Math.atan2(dy, dx);
        festoonGroup.add(seg);
      }
    }
    festoonGroup.visible = false;
    exteriorRoot.add(festoonGroup);

    // Reactive micro-props & pooled ambient life (environment hooks + micro-life)
    function buildAndMountReactiveRigs() {
      const rigs = buildAllReactiveRigs(palette, isSoftwareGl);
      exteriorRoot.add(
        rigs.pastryBasket.group,
        rigs.greenhouseStage.group,
        rigs.porchLamp.group,
        rigs.puddles.mesh,
        rigs.butterflies.wingsL,
        rigs.butterflies.wingsR,
        rigs.butterflies.bodies,
        rigs.fireflies.mesh,
        rigs.pondSparkles.mesh,
        rigs.chimneyWisps.mesh,
      );
      return rigs;
    }

    const envController = new EnvironmentVisualController({
      scene,
      exteriorRoot,
      groundMat,
      groveRig,
      hemiLight,
      sunLight,
      windowMaterials,
      lanternMat,
      prototypeLanternMats,
      flowerGroups,
      gazeboRig,
      fountainRig,
      pondRig,
      bakeryTablesGroup,
      festoonGroup,
      noticeboardRig,
      oakGlint,
      mbFlag,
      bellSwingVelRef,
      isSoftwareGl,
      reactiveRigs: buildAndMountReactiveRigs(),
      orchardRig,
      orchardMicroLife: orchardMicroLifeRig,
    });

    // Willow Step Cottage Interior Cutaway Diorama (toggles cleanly via interiorRoot)
    const cottageInteriorRig = buildWillowCottageInterior(palette, shadowTex);
    interiorRoot.add(cottageInteriorRig.group);

    // Tap-to-walk destination indicator ring
    const destRing = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.42, 20),
      new THREE.MeshBasicMaterial({
        color: '#E5A93C',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    destRing.rotation.x = -Math.PI / 2;
    destRing.position.y = 0.05;
    destRing.visible = false;
    scene.add(destRing);

    // Golden chime particle ring buffer (Zero-GC pooled for Gazebo Bell)
    const chimePoolCount = 16;
    const chimeGeo = new THREE.OctahedronGeometry(0.12, 0);
    const chimeMat = new THREE.MeshBasicMaterial({ color: '#FFE082', transparent: true, opacity: 0.9 });
    const chimeParticles: Array<{ mesh: THREE.Mesh; vel: THREE.Vector3; life: number }> = [];
    for (let i = 0; i < chimePoolCount; i++) {
      const m = new THREE.Mesh(chimeGeo, chimeMat);
      m.visible = false;
      exteriorRoot.add(m);
      chimeParticles.push({ mesh: m, vel: new THREE.Vector3(), life: 0 });
    }

    // Translucent aqua/white splash droplet ring buffer (Zero-GC pooled for Pond skip & Fountain coin wish)
    const splashPoolCount = 16;
    const splashGeo = new THREE.SphereGeometry(0.055, 6, 5);
    const splashMat = new THREE.MeshBasicMaterial({
      color: '#EAF9FC',
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const splashParticles: Array<{
      mesh: THREE.Mesh;
      vel: THREE.Vector3;
      life: number;
      floorY: number;
    }> = [];
    for (let i = 0; i < splashPoolCount; i++) {
      const m = new THREE.Mesh(splashGeo, splashMat);
      m.visible = false;
      exteriorRoot.add(m);
      splashParticles.push({ mesh: m, vel: new THREE.Vector3(), life: 0, floorY: 0.1 });
    }

    // Build Player & 9 Resident Character Rigs (Storybook Diorama standard)
    const playerRig: CharacterRig = buildStorybookCharacter(
      {
        coatColor: '#D46E51',
        shirtColor: '#FAF4E8',
        hairColor: '#433027',
        skinColor: '#F0C5A7',
        accentColor: '#6E9A74',
        hatStyle: 'beret',
        propType: 'none',
        heightScale: 1.0,
      },
      palette,
      shadowTex,
      'player',
    );
    playerRig.root.position.set(
      worldRef.current.playerPos.x,
      getGroundHeightAt(worldRef.current.playerPos.x, worldRef.current.playerPos.z),
      worldRef.current.playerPos.z,
    );
    playerRig.root.rotation.y = worldRef.current.playerFacing;
    scene.add(playerRig.root);

    const residentRigs = {} as Record<ResidentId, CharacterRig>;
    const interactableMeshes: THREE.Object3D[] = [];
    if (!worldRef.current.npcRuntime) {
      worldRef.current.npcRuntime = createInitialNpcRuntime(
        worldRef.current.minuteOfDay,
        worldRef.current.flags.claraArthurReconciled,
      );
    }

    for (const id of RESIDENT_ORDER) {
      const def = RESIDENTS[id];
      const rig =
        id === 'jun'
          ? buildStorybookJun(def.appearance, palette, shadowTex)
          : buildStorybookCharacter(def.appearance, palette, shadowTex, id);
      const rt = worldRef.current.npcRuntime[id];
      rig.root.position.set(rt.position.x, getGroundHeightAt(rt.position.x, rt.position.z), rt.position.z);
      rig.root.rotation.y = rt.facing;
      rig.root.userData = { targetKind: 'resident', targetId: id };

      // Simple invisible raycast cylinder per resident
      const hitProxy = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.6, 1.9, 8),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hitProxy.position.y = 0.95;
      hitProxy.userData = { targetKind: 'resident', targetId: id };
      rig.root.add(hitProxy);
      interactableMeshes.push(hitProxy);

      residentRigs[id] = rig;
      exteriorRoot.add(rig.root);
    }

    // Add invisible raycast proxies for interactive landmark props (full-perimeter proxies for Fountain & Mirror Pond)
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
    for (const prop of PROP_INTERACTABLES) {
      if (prop.id === 'fountain_plaza') {
        const hit = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.55, 2.5, 12), proxyMat);
        hit.position.set(0, 1.25, 1.5);
        hit.userData = { targetKind: 'prop', targetId: prop.id };
        exteriorRoot.add(hit);
        interactableMeshes.push(hit);
      } else if (prop.id === 'mirror_pond') {
        const basinHit = new THREE.Mesh(new THREE.BoxGeometry(7.0, 1.1, 4.9), proxyMat);
        basinHit.position.set(1.85, 0.55, 14.0);
        basinHit.userData = { targetKind: 'prop', targetId: prop.id };
        const ledgeHit = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.4, 8), proxyMat);
        ledgeHit.position.set(1.8, 0.7, 11.5);
        ledgeHit.userData = { targetKind: 'prop', targetId: prop.id };
        const pierHit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.5), proxyMat);
        pierHit.position.set(2.22, 0.55, 15.9);
        pierHit.userData = { targetKind: 'prop', targetId: prop.id };
        exteriorRoot.add(basinHit, ledgeHit, pierHit);
        interactableMeshes.push(basinHit, ledgeHit, pierHit);
      } else {
        const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 2.2, 8), proxyMat);
        hit.position.set(prop.x, 1.1, prop.z);
        hit.userData = { targetKind: 'prop', targetId: prop.id };
        exteriorRoot.add(hit);
        interactableMeshes.push(hit);
      }
    }

    // 12. Handcrafted Cedar Benches at SEAT_SPOTS + raycast proxies
    for (const seat of SEAT_SPOTS) {
      const bench = buildStorybookBench(palette, shadowTex);
      bench.position.set(seat.seatPos.x, 0, seat.seatPos.z);
      bench.rotation.y = seat.facingAngle;
      exteriorRoot.add(bench);

      const seatHit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.68, 0.68, 1.0, 8),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      seatHit.position.set(seat.seatPos.x, 0.5, seat.seatPos.z);
      seatHit.userData = { targetKind: 'seat', targetId: seat.id };
      exteriorRoot.add(seatHit);
      interactableMeshes.push(seatHit);
    }

    // 13. 5 Handcrafted Carryable World Props
    const carryableRigs = {} as Record<
      CarryableItemId,
      { group: THREE.Group; shadow: THREE.Object3D | null; hitProxy: THREE.Mesh }
    >;
    for (const def of CARRYABLE_PROP_DEFS) {
      const group = buildCarryablePropMesh(def.id, palette, shadowTex);
      const shadow = (group.userData.shadowMesh as THREE.Object3D | undefined) ?? null;
      const py = getGroundHeightAt(def.pos.x, def.pos.z);
      group.position.set(def.pos.x, py, def.pos.z);
      exteriorRoot.add(group);

      const hitProxy = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.55, 0.9, 8),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hitProxy.position.set(def.pos.x, py + 0.4, def.pos.z);
      hitProxy.userData = { targetKind: 'carryable', targetId: def.id };
      exteriorRoot.add(hitProxy);
      interactableMeshes.push(hitProxy);

      carryableRigs[def.id] = { group, shadow, hitProxy };
    }

    // Input Tracking (WASD + Arrows + Shift Sprint + A* Tap-to-Walk + Interaction)
    const keysDown = new Set<string>();
    let tapWalkDest: Vec2 | null = null;
    let tapWalkWaypoints: Vec2[] = [];
    let tapStuckSeconds = 0;
    let pendingTargetAfterWalk: InteractiveTarget | null = null;
    let playerMotion = createInitialPlayerMotion(worldRef.current.playerPos);
    let lastPulseSeq = playerActionPulseRef.current?.seq ?? 0;
    let activePulseKind: 'wave' | 'interact' | 'talk' | null = null;
    let activePulseTimer = 0;
    let activePulseFocusX = 0;
    let activePulseFocusZ = 0;
    let hasActivePulseFocus = false;
    let smoothedOcclusionLift = 0;
    let smoothedDialogueZoom = 1.0;
    let smoothedDialogueDropY = 0;
    let hudSyncAccum = 0;
    let hasSyncedInitialHud = false;
    let lastNearestId: string | null = null;
    let lastSyncedMinuteInt = -1;
    let lastSyncedX = NaN;
    let lastSyncedZ = NaN;
    let lastSyncedWeather: WeatherType | null = null;
    let lastSyncedSeason: SeasonType | null = null;
    let lastSyncedPosture: PlayerPosture | null = null;
    let lastSyncedHeldItem: CarryableItemId | null | undefined = undefined;
    let lastSyncedBubbleKey: string | null = null;
    let lastSyncedLocation: PlayerLocation | null = null;
    let prevWorldLocation: PlayerLocation = worldRef.current.playerLocation ?? 'exterior';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        if (screenStateRef.current === 'title') return;
      }
      keysDown.add(e.code);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysDown.delete(e.code);
    };
    const clearInputs = () => {
      keysDown.clear();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', clearInputs);

    const handlePointerDown = (e: PointerEvent) => {
      if (screenStateRef.current !== 'playing' || dialogueOpenRef.current) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;

      const rect = renderer.domElement.getBoundingClientRect();
      _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_pointer, camera);

      const isIndoors = worldRef.current.playerLocation === 'cottage_interior';
      const activeInteractables = isIndoors ? cottageInteriorRig.hitProxies : interactableMeshes;
      const hits = _raycaster.intersectObjects(activeInteractables, false);
      if (hits.length > 0) {
        const ud = hits[0].object.userData as {
          targetKind: 'resident' | 'prop' | 'seat' | 'carryable' | 'cottage_prop';
          targetId: string;
        };
        const pPos = worldRef.current.playerPos;
        let tPos: Vec2 = { x: 0, z: 0 };
        let walkDest: Vec2 | null = null;
        let label = '';
        let actionLabel = 'Talk';
        let immediateRange = 2.9;
        let isImmediate = false;
        let scoreDist = 0;

        if (ud.targetKind === 'cottage_prop') {
          const cid = ud.targetId as CottageInteractableId;
          const prop = COTTAGE_INTERACTABLES.find((p) => p.id === cid);
          if (!prop) return;
          tPos = { x: prop.focusX, z: prop.focusZ };
          walkDest = { x: prop.x, z: prop.z };
          label = prop.name;
          actionLabel = prop.actionLabel;
          const effDist = Math.min(
            distance2D(pPos, { x: prop.x, z: prop.z }),
            distance2D(pPos, { x: prop.focusX, z: prop.focusZ }),
          );
          scoreDist = effDist;
          isImmediate = effDist <= prop.interactRadius;
        } else if (ud.targetKind === 'resident') {
          const rid = ud.targetId as ResidentId;
          tPos = worldRef.current.npcRuntime[rid].position;
          label = RESIDENTS[rid].name;
          actionLabel = `Talk to ${label}`;
          scoreDist = distance2D(pPos, tPos);
          isImmediate = scoreDist <= immediateRange;
        } else if (ud.targetKind === 'seat') {
          const seat = getSeatById(ud.targetId);
          if (!seat) return;
          tPos = { ...seat.seatPos };
          walkDest = { ...seat.approachPos };
          label = seat.label;
          actionLabel =
            worldRef.current.playerPosture === 'sitting' ? 'Stand Up' : `Sit on ${seat.label}`;
          immediateRange = 2.35;
          scoreDist = distance2D(pPos, tPos);
          isImmediate = scoreDist <= immediateRange;
        } else if (ud.targetKind === 'carryable') {
          const cid = ud.targetId as CarryableItemId;
          const cProp = worldRef.current.worldProps?.[cid];
          if (!cProp || cProp.holder !== 'world') return;
          tPos = { ...cProp.pos };
          label = cProp.label;
          actionLabel = `Pick Up ${cProp.label}`;
          immediateRange = 2.25;
          scoreDist = distance2D(pPos, tPos);
          isImmediate = scoreDist <= immediateRange;
        } else {
          const pid = ud.targetId as PropInteractableId;
          const prop = PROP_INTERACTABLES.find((p) => p.id === pid);
          if (prop) {
            const metrics = getPropInteractionMetrics(pid, pPos);
            tPos = metrics.focusPos;
            walkDest = metrics.approachPos;
            label = prop.name;
            actionLabel =
              pid === 'gazebo_bell' && worldRef.current.flags.bellRestored
                ? 'Ring Bell'
                : pid === 'player_door'
                ? 'Enter Cottage'
                : pid === 'cottage_window_box' ||
                  pid === 'greenhouse_planters' ||
                  pid === 'orchard_harvest' ||
                  pid === 'pond_driftwood'
                ? prop.name
                : `Inspect ${prop.name}`;
            scoreDist = metrics.scoreDistance;
            isImmediate = metrics.inRange;
          }
        }

        const targetObj: InteractiveTarget = {
          kind: ud.targetKind,
          id: ud.targetId,
          label,
          actionLabel,
          distance: scoreDist,
          worldPos: { ...tPos },
          seatId: ud.targetKind === 'seat' ? ud.targetId : undefined,
          carryableId: ud.targetKind === 'carryable' ? (ud.targetId as CarryableItemId) : undefined,
          cottagePropId:
            ud.targetKind === 'cottage_prop' ? (ud.targetId as CottageInteractableId) : undefined,
        };

        if (isImmediate) {
          cozyAudio.playUiTap(1.05);
          onSelectTargetRef.current(targetObj);
        } else if (isIndoors) {
          const dest = walkDest ?? { ...tPos };
          const walkableDest = isInteriorPointWalkable(dest.x, dest.z, 0.42)
            ? dest
            : findNearestInteriorWalkablePoint(dest.x, dest.z) ?? dest;
          tapWalkDest = walkableDest;
          tapWalkWaypoints = computeInteriorWaypoints(pPos, walkableDest, 0.42);
          tapStuckSeconds = 0;
          pendingTargetAfterWalk = targetObj;
        } else {
          const dest = walkDest ?? { ...tPos };
          const walkableDest = isPointWalkable(dest.x, dest.z, 0.48)
            ? dest
            : findNearestWalkablePoint(dest.x, dest.z, pPos) ?? dest;
          tapWalkDest = walkableDest;
          tapWalkWaypoints = computeWaypointPath(pPos, walkableDest, 0.48);
          tapStuckSeconds = 0;
          pendingTargetAfterWalk = targetObj;
        }
        return;
      }

      // Ground tap-to-walk
      if (_raycaster.ray.intersectPlane(_groundPlane, _vec3A)) {
        if (isIndoors) {
          const walkableDest = findNearestInteriorWalkablePoint(_vec3A.x, _vec3A.z);
          if (walkableDest) {
            tapWalkDest = walkableDest;
            tapWalkWaypoints = computeInteriorWaypoints(worldRef.current.playerPos, walkableDest, 0.42);
            tapStuckSeconds = 0;
            pendingTargetAfterWalk = null;
          }
        } else {
          const walkableDest = findNearestWalkablePoint(_vec3A.x, _vec3A.z, worldRef.current.playerPos);
          if (walkableDest) {
            tapWalkDest = walkableDest;
            tapWalkWaypoints = computeWaypointPath(worldRef.current.playerPos, walkableDest, 0.48);
            tapStuckSeconds = 0;
            pendingTargetAfterWalk = null;
          }
        }
      }
    };
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    const handleWheel = (e: WheelEvent) => {
      if (screenStateRef.current !== 'playing') return;
      zoomRef.current = THREE.MathUtils.clamp(zoomRef.current + e.deltaY * 0.0008, 0.72, 1.45);
    };
    renderer.domElement.addEventListener('wheel', handleWheel, { passive: true });

    const handleResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObs = new ResizeObserver(handleResize);
    resizeObs.observe(container);

    // Pre-warm shaders on GPU devices only
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const timer = new THREE.Timer();
    timer.connect(document);
    let frameId = 0;
    let disposed = false;
    let prevPhase: TimePhase = getTimePhase(worldRef.current.minuteOfDay);

    function spawnChimeBurst(originX: number, originY: number, originZ: number) {
      for (let i = 0; i < chimeParticles.length; i++) {
        const p = chimeParticles[i];
        p.mesh.position.set(originX, originY, originZ);
        const angle = (i / chimeParticles.length) * Math.PI * 2;
        p.vel.set(Math.cos(angle) * 1.8, 1.4 + (i % 3) * 0.5, Math.sin(angle) * 1.8);
        p.life = 1.0;
        p.mesh.visible = true;
      }
    }

    function spawnSplashBurst(
      originX: number,
      originY: number,
      originZ: number,
      spreadSkip: boolean,
    ) {
      const toCenterDx = 1.6 - originX;
      const toCenterDz = 14.0 - originZ;
      const toCenterLen = Math.hypot(toCenterDx, toCenterDz) || 1;
      const dirX = toCenterDx / toCenterLen;
      const dirZ = toCenterDz / toCenterLen;

      for (let i = 0; i < splashParticles.length; i++) {
        const p = splashParticles[i];
        const hopDist = spreadSkip ? (i % 3) * 0.48 : 0;
        const hopOffsetX = dirX * hopDist;
        const hopOffsetZ = dirZ * hopDist;
        p.mesh.position.set(originX + hopOffsetX, originY, originZ + hopOffsetZ);
        const angle = (i / splashParticles.length) * Math.PI * 2;
        const speedR = spreadSkip ? 0.85 + (i % 3) * 0.32 : 0.72 + (i % 3) * 0.25;
        p.vel.set(Math.cos(angle) * speedR, 1.7 + (i % 4) * 0.42, Math.sin(angle) * speedR);
        p.floorY = originY - 0.04;
        p.life = 1.0;
        p.mesh.scale.setScalar(0.8 + (i % 3) * 0.18);
        p.mesh.visible = true;
      }
    }

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    let prevBellCountLocal = bellRingCounter;
    let prevFountainWishLocal = fountainWishCounter;
    let prevPondSkipLocal = pondSkipCounter;

    function syncVisualAndHud(
      world: WorldState,
      elapsed: number,
      dt: number,
    ): void {
      // Five-layer environment composition & dirty-flagged GPU/scene visual controller
      const composed = composeEnvironmentState(world);
      const isIndoors = world.playerLocation === 'cottage_interior';
      envController.update(
        composed,
        world,
        isIndoors ? world.exteriorPlayerPos : world.playerPos,
        elapsed,
        dt,
      );

      if (isIndoors) {
        exteriorRoot.visible = false;
        interiorRoot.visible = true;
        (scene.background as THREE.Color).set('#2C221B');
        if (scene.fog instanceof THREE.Fog) {
          scene.fog.near = 200;
          scene.fog.far = 260;
        }
        hemiLight.color.set('#FBE7CC');
        hemiLight.groundColor.set('#6E523E');
        hemiLight.intensity = 0.85;
        sunLight.color.set('#FFE9C2');
        sunLight.intensity = 1.25;
        sunLight.position.set(10, 16, 11);
        scene.environmentIntensity = 0.65;
        cottageInteriorRig.update(world, composed.timeOfDay.phase, elapsed);
      } else {
        exteriorRoot.visible = true;
        interiorRoot.visible = false;
        updateWillowPrototypeMotion(willowCottage, willowCourtyard, elapsed);
      }

      // Update chime sparkle particles
      for (const p of chimeParticles) {
        if (p.life > 0) {
          p.life -= dt * 0.9;
          p.mesh.position.addScaledVector(p.vel, dt);
          p.mesh.rotation.y += dt * 4;
          p.mesh.scale.setScalar(Math.max(0.01, p.life));
          if (p.life <= 0) p.mesh.visible = false;
        }
      }

      // Update ballistic water splash droplets
      for (const p of splashParticles) {
        if (p.life > 0) {
          p.life -= dt * 1.45;
          p.vel.y -= 6.8 * dt;
          p.mesh.position.addScaledVector(p.vel, dt);
          if (p.mesh.position.y < p.floorY || p.life <= 0) {
            p.life = 0;
            p.mesh.visible = false;
          } else {
            p.mesh.scale.setScalar(Math.max(0.1, p.life));
          }
        }
      }

      // Sync carryable world props (ground placement vs held in player carrySocket vs delivered)
      const playerSocket = playerRig.carrySocket ?? playerRig.bodyGroup;
      for (let i = 0; i < CARRYABLE_PROP_DEFS.length; i++) {
        const def = CARRYABLE_PROP_DEFS[i];
        const rig = carryableRigs[def.id];
        const placement = world.worldProps?.[def.id];
        const holder = placement?.holder ?? 'world';
        if (holder === 'world') {
          const px = placement?.pos.x ?? def.pos.x;
          const pz = placement?.pos.z ?? def.pos.z;
          const py = getGroundHeightAt(px, pz);
          if (rig.group.parent !== exteriorRoot) exteriorRoot.add(rig.group);
          rig.group.position.set(px, py, pz);
          rig.group.rotation.set(0, Math.sin(elapsed * 0.7 + i) * 0.04, 0);
          rig.group.visible = true;
          if (rig.shadow) rig.shadow.visible = true;
          rig.hitProxy.position.set(px, py + 0.4, pz);
          rig.hitProxy.visible = true;
        } else if (holder === 'player') {
          if (rig.group.parent !== playerSocket) playerSocket.add(rig.group);
          rig.group.position.set(0, -0.05, 0);
          rig.group.rotation.set(0, 0, 0);
          rig.group.visible = true;
          if (rig.shadow) rig.shadow.visible = false;
          rig.hitProxy.visible = false;
        } else {
          rig.group.visible = false;
          rig.hitProxy.visible = false;
        }
      }

      // Project persistent NPC runtime state onto 3D resident rigs & locate active whisper bubble
      let nearbyBubble: HudBubbleSnapshot | null = null;
      let nearestBubbleDist = 4.6;

      for (let i = 0; i < RESIDENT_ORDER.length; i++) {
        const id = RESIDENT_ORDER[i];
        const rig = residentRigs[id];
        const rt = world.npcRuntime[id];
        const seat = rt.posture === 'sitting' ? getSeatById(rt.reservedSeatId) : undefined;
        const npcGroundY = seat
          ? computeSitGroundY(seat.seatHeight, RESIDENTS[id].appearance.heightScale)
          : getGroundHeightAt(rt.position.x, rt.position.z);
        rig.root.position.set(rt.position.x, npcGroundY, rt.position.z);
        rig.root.rotation.y = rt.facing;

        let lookYaw = 0;
        if (rt.targetLookPos) {
          const ldx = rt.targetLookPos.x - rt.position.x;
          const ldz = rt.targetLookPos.z - rt.position.z;
          if (ldx * ldx + ldz * ldz > 0.04) {
            lookYaw = wrapAngleDelta(rt.facing, Math.atan2(ldx, ldz));
          }
        }

        _npcAnimOpts.emotion = rt.emotion;
        _npcAnimOpts.lookYaw = lookYaw;
        _npcAnimOpts.lookPitch = 0;
        _npcAnimOpts.bankAngle = 0;
        _npcAnimOpts.carrying = false;
        _npcAnimOpts.isMoving = rt.currentSpeed > 0.25;
        animateCharacterRig(rig, rt.animState, rt.walkPhase, elapsed, dt, i * 0.7, _npcAnimOpts);

        // Quest cue diamond
        const cue = getResidentAvailableQuestCue(id, world);
        rig.questPip.visible = cue !== 'none';
        if (rig.questPip.visible) {
          rig.questPip.rotation.y = elapsed * 2.0;
          rig.questPip.position.y =
            (2.05 + Math.sin(elapsed * 3.2) * 0.08) * RESIDENTS[id].appearance.heightScale;
        }

        const pDist = isIndoors ? Infinity : distance2D(world.playerPos, rt.position);
        rig.ringMesh.visible = !isIndoors && pDist < 2.9;
        if (rig.ringMesh.visible) {
          const heldProp = world.playerHeldItem ? world.worldProps?.[world.playerHeldItem] : null;
          const likesGift = Boolean(heldProp && heldProp.likedBy.includes(id));
          (rig.ringMesh.material as THREE.MeshBasicMaterial).color.copy(
            likesGift ? _ringGiftSage : _ringAmber,
          );
        }

        if (
          !isIndoors &&
          rt.activeBubbleText &&
          world.minuteOfDay <= rt.activeBubbleUntilMinute &&
          pDist < nearestBubbleDist
        ) {
          nearestBubbleDist = pDist;
          nearbyBubble = {
            residentId: id,
            name: RESIDENTS[id].name,
            text: rt.activeBubbleText,
          };
        }
      }

      const nearestTarget = selectBestInteractiveTarget(world, RESIDENTS);

      // Edge-gated throttled HUD sync
      hudSyncAccum += dt;
      const minuteInt = Math.floor(world.minuteOfDay);
      const nearestKey = nearestTarget ? `${nearestTarget.kind}:${nearestTarget.id}` : null;
      const bubbleKey = nearbyBubble ? `${nearbyBubble.residentId}:${nearbyBubble.text}` : null;
      const heldItem = world.playerHeldItem ?? null;
      const posture = world.playerPosture ?? 'standing';
      const playerLocation = world.playerLocation ?? 'exterior';
      const movedDist = Number.isNaN(lastSyncedX)
        ? 999
        : Math.hypot(world.playerPos.x - lastSyncedX, world.playerPos.z - lastSyncedZ);
      const edgeTriggered =
        !hasSyncedInitialHud ||
        nearestKey !== lastNearestId ||
        bubbleKey !== lastSyncedBubbleKey ||
        posture !== lastSyncedPosture ||
        heldItem !== lastSyncedHeldItem ||
        playerLocation !== lastSyncedLocation ||
        composed.weather.effective !== lastSyncedWeather ||
        composed.season.season !== lastSyncedSeason;

      if (
        edgeTriggered ||
        (hudSyncAccum >= 0.18 && (minuteInt !== lastSyncedMinuteInt || movedDist > 0.15))
      ) {
        hasSyncedInitialHud = true;
        hudSyncAccum = 0;
        lastNearestId = nearestKey;
        lastSyncedBubbleKey = bubbleKey;
        lastSyncedPosture = posture;
        lastSyncedHeldItem = heldItem;
        lastSyncedLocation = playerLocation;
        lastSyncedMinuteInt = minuteInt;
        lastSyncedX = world.playerPos.x;
        lastSyncedZ = world.playerPos.z;
        lastSyncedWeather = composed.weather.effective;
        lastSyncedSeason = composed.season.season;
        onHudSyncRef.current({
          minuteOfDay: world.minuteOfDay,
          playerPos: { ...world.playerPos },
          playerFacing: world.playerFacing,
          playerPosture: posture,
          playerHeldItem: heldItem,
          playerLocation,
          nearestTarget,
          nearbyBubble,
          weather: composed.weather.effective,
          season: composed.season.season,
        });
      }
    }

    function tick() {
      if (disposed) return;
      timer.update();
      const rawDt = timer.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = timer.getElapsed();
      const state = screenStateRef.current;
      const world = worldRef.current;

      if (lastBellCountRef.current !== prevBellCountLocal) {
        prevBellCountLocal = lastBellCountRef.current;
        spawnChimeBurst(0, 3.1, -9.5);
      }
      if (lastFountainWishCountRef.current !== prevFountainWishLocal) {
        prevFountainWishLocal = lastFountainWishCountRef.current;
        const fSplash = getPropInteractionMetrics('fountain_plaza', world.playerPos).splashPos;
        envController.triggerFountainWishRipple(fSplash.x, fSplash.z);
        spawnSplashBurst(fSplash.x, 0.68, fSplash.z, false);
      }
      if (lastPondSkipCountRef.current !== prevPondSkipLocal) {
        prevPondSkipLocal = lastPondSkipCountRef.current;
        const pSplash = getPropInteractionMetrics('mirror_pond', world.playerPos).splashPos;
        envController.triggerPondRipple(pSplash.x, pSplash.z);
        spawnSplashBurst(pSplash.x, 0.14, pSplash.z, true);
      }

      // Step headless simulation clock & NPC navigation/runtime state
      stepSimulationInPlace(world, dt, {
        paused: state === 'paused',
        dialogueOpen: state !== 'playing' || dialogueOpenRef.current,
        activeDialogueResidentId: activeDialogueResidentRef.current,
      });

      // Update triggered player gesture pulses (wave / interact / talk)
      const latestPulse = playerActionPulseRef.current;
      if (latestPulse && latestPulse.seq !== lastPulseSeq) {
        lastPulseSeq = latestPulse.seq;
        activePulseKind = latestPulse.kind;
        activePulseTimer =
          latestPulse.kind === 'wave'
            ? 0.9
            : latestPulse.kind === 'interact'
            ? 0.78
            : 0.65;
        if (latestPulse.focusPos) {
          activePulseFocusX = latestPulse.focusPos.x;
          activePulseFocusZ = latestPulse.focusPos.z;
          hasActivePulseFocus = true;
        } else {
          hasActivePulseFocus = false;
        }
      }
      if (activePulseTimer > 0) {
        activePulseTimer = Math.max(0, activePulseTimer - dt);
        if (activePulseTimer === 0) {
          activePulseKind = null;
          hasActivePulseFocus = false;
        }
      }

      const phase = getTimePhase(world.minuteOfDay);
      if (phase !== prevPhase) {
        prevPhase = phase;
      }

      // Player Movement (when playing and not in dialogue)
      let moveDirX = 0;
      let moveDirZ = 0;
      let inputMagnitude = 0;
      const sprintHeld = keysDown.has('ShiftLeft') || keysDown.has('ShiftRight');
      const walkHeld = keysDown.has('AltLeft') || keysDown.has('AltRight');

      if (state === 'playing' && !dialogueOpenRef.current) {
        // Isometric screen-aligned keyboard + analog thumbstick input
        const up = keysDown.has('KeyW') || keysDown.has('ArrowUp');
        const down = keysDown.has('KeyS') || keysDown.has('ArrowDown');
        const left = keysDown.has('KeyA') || keysDown.has('ArrowLeft');
        const right = keysDown.has('KeyD') || keysDown.has('ArrowRight');

        const keyHoriz = (right ? 1 : 0) - (left ? 1 : 0);
        const keyVert = (down ? 1 : 0) - (up ? 1 : 0);
        const joyX = joystickVectorRef.current.x;
        const joyY = joystickVectorRef.current.y;
        const joyMag = Math.hypot(joyX, joyY);

        const screenHoriz = keyHoriz + joyX;
        const screenVert = keyVert + joyY;

        if (Math.abs(screenHoriz) > 0.08 || Math.abs(screenVert) > 0.08) {
          tapWalkDest = null;
          tapWalkWaypoints = [];
          tapStuckSeconds = 0;
          pendingTargetAfterWalk = null;
          activePulseTimer = 0;
          activePulseKind = null;
          hasActivePulseFocus = false;
          // Screen-right = (+0.707, -0.707), Screen-down = (+0.707, +0.707)
          moveDirX = screenHoriz * 0.7071 + screenVert * 0.7071;
          moveDirZ = -screenHoriz * 0.7071 + screenVert * 0.7071;
          inputMagnitude = Math.abs(keyHoriz) > 0 || Math.abs(keyVert) > 0 ? 1.0 : Math.min(1, joyMag);
        } else if (tapWalkDest) {
          // Track updated resident position when walking to talk
          if (pendingTargetAfterWalk?.kind === 'resident') {
            const livePos = world.npcRuntime[pendingTargetAfterWalk.id as ResidentId]?.position;
            if (livePos && distance2D(tapWalkDest, livePos) > 0.9) {
              tapWalkDest = { ...livePos };
              tapWalkWaypoints = computeWaypointPath(world.playerPos, tapWalkDest, 0.48);
            }
          }

          const finalDx = tapWalkDest.x - world.playerPos.x;
          const finalDz = tapWalkDest.z - world.playerPos.z;
          const finalDist = Math.hypot(finalDx, finalDz);
          const arriveDist =
            pendingTargetAfterWalk?.kind === 'seat'
              ? 0.55
              : pendingTargetAfterWalk?.kind === 'prop'
              ? 0.65
              : pendingTargetAfterWalk?.kind === 'carryable'
              ? 1.45
              : pendingTargetAfterWalk
              ? 2.35
              : 0.35;

          if (finalDist <= arriveDist) {
            tapWalkDest = null;
            tapWalkWaypoints = [];
            tapStuckSeconds = 0;
            if (pendingTargetAfterWalk) {
              const target = pendingTargetAfterWalk;
              pendingTargetAfterWalk = null;
              cozyAudio.playUiTap(1.05);
              onSelectTargetRef.current(target);
            }
          } else {
            while (
              tapWalkWaypoints.length > 1 &&
              distance2D(world.playerPos, tapWalkWaypoints[0]) <= 0.55
            ) {
              tapWalkWaypoints.shift();
            }
            const nextWp = tapWalkWaypoints[0] ?? tapWalkDest;
            const dx = nextWp.x - world.playerPos.x;
            const dz = nextWp.z - world.playerPos.z;
            const wpDist = Math.hypot(dx, dz);
            if (wpDist > 0.05) {
              moveDirX = dx / wpDist;
              moveDirZ = dz / wpDist;
              inputMagnitude = finalDist < 1.1 ? 0.5 : 0.94;
            }
          }
        }
      }

      const curLocation: PlayerLocation = world.playerLocation ?? 'exterior';
      const locationChanged = curLocation !== prevWorldLocation;
      if (locationChanged) {
        prevWorldLocation = curLocation;
        tapWalkDest = null;
        tapWalkWaypoints = [];
        tapStuckSeconds = 0;
        pendingTargetAfterWalk = null;
        playerMotion = createInitialPlayerMotion(world.playerPos);
        if (curLocation === 'cottage_interior') {
          playerMotion.groundY = 0;
        }
        // Snap camera smoothly toward the entered room or porch so there's zero disorienting cross-map pan
        const snapFocusX = curLocation === 'cottage_interior' ? world.playerPos.x * 0.45 : world.playerPos.x;
        const snapFocusZ = curLocation === 'cottage_interior' ? world.playerPos.z * 0.45 : world.playerPos.z;
        const snapZoom = curLocation === 'cottage_interior' ? 0.66 : zoomRef.current;
        camera.position.set(snapFocusX + 19.5 * snapZoom, 18.2 * snapZoom, snapFocusZ + 19.5 * snapZoom);
      }

      const currentActiveProp = activePropIdRef.current;
      const interactionActive =
        currentActiveProp !== null || (activePulseTimer > 0 && activePulseKind === 'interact');
      if (interactionActive && tapWalkDest) {
        tapWalkDest = null;
        tapWalkWaypoints = [];
        tapStuckSeconds = 0;
        pendingTargetAfterWalk = null;
      }

      const moveResult = stepPlayerMovement({
        pos: world.playerPos,
        facing: world.playerFacing,
        motion: playerMotion,
        moveDirX,
        moveDirZ,
        inputMagnitude,
        sprintHeld,
        walkHeld,
        carryingItem: Boolean(world.playerHeldItem),
        interactionActive,
        posture: world.playerPosture ?? 'standing',
        seatId: world.playerSeatId ?? null,
        location: curLocation,
        dt,
      });

      world.playerPos = moveResult.pos;
      world.playerFacing = moveResult.facing;
      world.playerPosture = moveResult.posture;
      world.playerSeatId = moveResult.seatId;
      playerMotion = moveResult.motion;

      // Cancel tap-walk cleanly if player stayed blocked on an obstacle
      if (tapWalkDest && inputMagnitude > 0.1) {
        if (playerMotion.speed < 0.22) {
          tapStuckSeconds += dt;
          if (tapStuckSeconds > 1.0) {
            tapWalkDest = null;
            tapWalkWaypoints = [];
            pendingTargetAfterWalk = null;
            tapStuckSeconds = 0;
          }
        } else {
          tapStuckSeconds = 0;
        }
      }

      if (playerMotion.footstepPending) {
        cozyAudio.playFootstep();
      }

      // Update tap destination ring
      if (tapWalkDest) {
        destRing.visible = true;
        destRing.position.set(
          tapWalkDest.x,
          getGroundHeightAt(tapWalkDest.x, tapWalkDest.z) + 0.05,
          tapWalkDest.z,
        );
        const pulse = 1 + Math.sin(elapsed * 6) * 0.12;
        destRing.scale.setScalar(pulse);
      } else {
        destRing.visible = false;
      }

      // Face speaker or water/landmark prop & choose contextual player pose (dialogue listen/talk, wave, interact)
      let playerAnim = playerMotion.animState;
      let playerLookYaw = 0;
      let playerLookPitch = 0;
      const dialogueResId = activeDialogueResidentRef.current;
      if (dialogueOpenRef.current && dialogueResId && world.npcRuntime?.[dialogueResId]) {
        const speakerPos = world.npcRuntime[dialogueResId].position;
        const targetYaw = Math.atan2(
          speakerPos.x - world.playerPos.x,
          speakerPos.z - world.playerPos.z,
        );
        if (world.playerPosture !== 'sitting') {
          world.playerFacing += wrapAngleDelta(world.playerFacing, targetYaw) * Math.min(1, dt * 8);
        }
        playerLookYaw = wrapAngleDelta(world.playerFacing, targetYaw);
        if (world.playerPosture !== 'sitting') {
          playerAnim = activePulseTimer > 0 && activePulseKind === 'talk' ? 'talk' : 'listen';
        }
      } else if (currentActiveProp !== null || (activePulseTimer > 0 && hasActivePulseFocus)) {
        let fx = activePulseFocusX;
        let fz = activePulseFocusZ;
        if (currentActiveProp !== null) {
          const propFocus = getPropInteractionMetrics(currentActiveProp, world.playerPos).focusPos;
          fx = propFocus.x;
          fz = propFocus.z;
        }
        const dx = fx - world.playerPos.x;
        const dz = fz - world.playerPos.z;
        if (dx * dx + dz * dz > 0.0025) {
          const targetYaw = Math.atan2(dx, dz);
          if (world.playerPosture !== 'sitting') {
            world.playerFacing += wrapAngleDelta(world.playerFacing, targetYaw) * Math.min(1, dt * 12);
          }
          playerLookYaw = wrapAngleDelta(world.playerFacing, targetYaw);
        }
        playerLookPitch = 0.16;
        if (
          world.playerPosture !== 'sitting' &&
          activePulseTimer > 0 &&
          activePulseKind &&
          playerMotion.speed < 1.35
        ) {
          playerAnim = activePulseKind;
        }
      } else if (
        activePulseTimer > 0 &&
        activePulseKind &&
        world.playerPosture !== 'sitting' &&
        (activePulseKind === 'interact' ? playerMotion.speed < 1.35 : playerMotion.speed < 0.25)
      ) {
        playerAnim = activePulseKind;
      }

      // Animate player character rig cleanly with joint pivots, ground height & turn banking
      playerRig.root.position.set(world.playerPos.x, playerMotion.groundY, world.playerPos.z);
      playerRig.root.rotation.y = world.playerFacing;
      _playerAnimOpts.emotion = world.playerHeldItem
        ? 'happy'
        : dialogueResId
        ? 'curious'
        : 'relaxed';
      _playerAnimOpts.lookYaw = playerLookYaw;
      _playerAnimOpts.lookPitch = playerLookPitch;
      _playerAnimOpts.bankAngle = playerMotion.bankAngle;
      _playerAnimOpts.carrying = Boolean(world.playerHeldItem);
      _playerAnimOpts.isMoving = playerMotion.speed > 0.25;
      animateCharacterRig(
        playerRig,
        playerAnim,
        playerMotion.walkPhase,
        elapsed,
        dt,
        0,
        _playerAnimOpts,
      );

      // Update environment lighting, seasonal tints, reactive props, resident rigs & HUD
      syncVisualAndHud(world, elapsed, dt);

      // Camera Choreography: Title Screen orbits Plaza/Gazebo; Playing follows player (or miniature cottage interior)
      if (state === 'title') {
        const orbitAngle = elapsed * 0.14 + 0.65;
        const r = 27;
        _vec3B.set(Math.cos(orbitAngle) * r, 16.5, Math.sin(orbitAngle) * r);
        camera.position.lerp(_vec3B, Math.min(1, dt * 3));
        // R-08: gaze biased east of the plaza so the slow orbit keeps the tallest
        // west-side rooflines (Bakery/Book Nook) clear of the top-left title card.
        camera.lookAt(1.5, 1.4, -2.5);
      } else if (curLocation === 'cottage_interior') {
        const interiorZoom = THREE.MathUtils.clamp(zoomRef.current * 0.68, 0.56, 0.92);
        const focusX = world.playerPos.x * 0.42;
        const focusZ = world.playerPos.z * 0.42;
        const desiredCamX = focusX + 19.5 * interiorZoom;
        const desiredCamY = 18.2 * interiorZoom;
        const desiredCamZ = focusZ + 19.5 * interiorZoom;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredCamX, 6.5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredCamY, 6.5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredCamZ, 6.5, dt);
        _vec3A.set(focusX, 0.85, focusZ);
        camera.lookAt(_vec3A);
      } else {
        const targetOcclusionLift =
          world.playerPos.z > 8.5 && Math.abs(world.playerPos.x) > 8.5 ? 1.5 : 0;
        smoothedOcclusionLift = THREE.MathUtils.damp(smoothedOcclusionLift, targetOcclusionLift, 4.5, dt);

        const inDialogueSheet = Boolean(dialogueResId);
        smoothedDialogueZoom = THREE.MathUtils.damp(
          smoothedDialogueZoom,
          inDialogueSheet ? 0.9 : 1.0,
          5.0,
          dt,
        );
        smoothedDialogueDropY = THREE.MathUtils.damp(
          smoothedDialogueDropY,
          inDialogueSheet ? -0.42 : 0,
          5.0,
          dt,
        );

        const zoom = zoomRef.current * smoothedDialogueZoom;
        let focusX = world.playerPos.x;
        let focusZ = world.playerPos.z;
        if (dialogueResId && world.npcRuntime?.[dialogueResId]) {
          const sp = world.npcRuntime[dialogueResId].position;
          focusX = (world.playerPos.x + sp.x) * 0.5;
          focusZ = (world.playerPos.z + sp.z) * 0.5;
        }

        const desiredCamX = focusX + 19.5 * zoom;
        const desiredCamY = 18.2 * zoom + smoothedOcclusionLift;
        const desiredCamZ = focusZ + 19.5 * zoom;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredCamX, 6.5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredCamY, 6.5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredCamZ, 6.5, dt);

        _vec3A.set(focusX, 1.0 + playerMotion.groundY * 0.6 + smoothedDialogueDropY, focusZ);
        camera.lookAt(_vec3A);
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    // Apply Frame-0 environment, weather, season, story flags, and character cues before first render
    syncVisualAndHud(worldRef.current, 0, 0);

    if (isSoftwareGl) {
      // Draw initial frame synchronously, then schedule via afterDraw
      renderer.render(scene, camera);
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObs.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clearInputs);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('wheel', handleWheel);
      envController.dispose();
      cottageInteriorRig.dispose();
      meadowDressing.dispose();
      orchardRig.dispose();
      orchardMicroLifeRig.dispose();
      groundMat.dispose();
      groundGeo.dispose();
      cobbleMat.dispose();
      lanternMat.dispose();
      chimeGeo.dispose();
      chimeMat.dispose();
      splashGeo.dispose();
      splashMat.dispose();
      meadowTex.dispose();
      meadowMacroTex.dispose();
      cobbleTex.dispose();
      terracottaRoofTex.dispose();
      sageRoofTex.dispose();
      slateRoofTex.dispose();
      shadowTex.dispose();
      orchardSignTex.dispose();
      palette.disposeAll();
      timer.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      data-testid="neighborhood-canvas"
      className="fixed inset-0 w-full h-full overflow-hidden"
    />
  );
};
