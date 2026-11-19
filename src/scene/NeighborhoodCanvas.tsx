import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  EnvironmentalState,
  GameScreenState,
  InteractiveTarget,
  PropInteractableId,
  ResidentId,
  ScreenVec2,
  TimePhase,
  Vec2,
  WorldState,
} from '../game/types';
import {
  RESIDENTS,
  RESIDENT_ORDER,
  getResidentScheduleSlot,
  getTimePhase,
} from '../game/residents';
import {
  PROP_INTERACTABLES,
  distance2D,
  isPointWalkable,
  resolveMovement,
} from '../game/worldMap';
import {
  computeEnvironmentState,
  getResidentAvailableQuestCue,
} from '../game/narrative';
import { cozyAudio } from '../game/audio';
import {
  CharacterRig,
  FountainRig,
  GazeboRig,
  buildClayCharacter,
  buildClayCottage,
  buildGreenhouse,
  buildOldBellGazebo,
  buildStoneFountain,
} from './models';
import {
  createCobblestoneTexture,
  createContactShadowTexture,
  createMeadowTexture,
  createRoofShingleTexture,
} from './textures';

export interface NeighborhoodCanvasProps {
  screenState: GameScreenState;
  worldRef: React.MutableRefObject<WorldState>;
  joystickVectorRef: React.MutableRefObject<ScreenVec2>;
  zoomRef: React.MutableRefObject<number>;
  bellRingCounter: number;
  isDialogueOpen: boolean;
  onHudSync: (snapshot: {
    minuteOfDay: number;
    playerPos: Vec2;
    playerFacing: number;
    nearestTarget: InteractiveTarget | null;
  }) => void;
  onSelectTarget: (target: InteractiveTarget) => void;
}

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _pointer = new THREE.Vector2();
const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _skyMorning = new THREE.Color('#DCEBF2');
const _skyAfternoon = new THREE.Color('#D9ECF5');
const _skyGolden = new THREE.Color('#F5CFA0');
const _skyDusk = new THREE.Color('#6F7FA8');
const _sunMorning = new THREE.Color('#FFF1D0');
const _sunAfternoon = new THREE.Color('#FFF6DF');
const _sunGolden = new THREE.Color('#FFB266');
const _sunDusk = new THREE.Color('#97AEE0');
const _hemiSkyMorning = new THREE.Color('#B5D7EB');
const _hemiSkyDusk = new THREE.Color('#6C82B5');

export const NeighborhoodCanvas: React.FC<NeighborhoodCanvasProps> = ({
  screenState,
  worldRef,
  joystickVectorRef,
  zoomRef,
  bellRingCounter,
  isDialogueOpen,
  onHudSync,
  onSelectTarget,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const screenStateRef = useRef<GameScreenState>(screenState);
  const dialogueOpenRef = useRef<boolean>(isDialogueOpen);
  const onHudSyncRef = useRef(onHudSync);
  const onSelectTargetRef = useRef(onSelectTarget);
  const bellSwingVelRef = useRef(0);
  const lastBellCountRef = useRef(bellRingCounter);

  screenStateRef.current = screenState;
  dialogueOpenRef.current = isDialogueOpen;
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

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const camera = new THREE.PerspectiveCamera(28, width / height, 0.5, 160);
    camera.position.set(18, 17, 18);
    camera.lookAt(0, 1.2, 0);

    // 3-Point Warm/Cool Lighting Rig
    const hemiLight = new THREE.HemisphereLight('#B5D7EB', '#7D6A54', 0.62);
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
    const cobbleTex = createCobblestoneTexture(maxAniso);
    const terracottaRoofTex = createRoofShingleTexture('#C46347', '#D97B5E', maxAniso);
    const sageRoofTex = createRoofShingleTexture('#5F8267', '#759B7D', maxAniso);
    const slateRoofTex = createRoofShingleTexture('#5D7082', '#73889C', maxAniso);
    const shadowTex = createContactShadowTexture();

    // Extended natural meadow floor (no boxed void)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(110, 110),
      new THREE.MeshStandardMaterial({
        color: '#FFFFFF',
        map: meadowTex,
        roughness: 0.92,
        metalness: 0.0,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Cobblestone road & plaza slabs (offset by +0.025 on Y to prevent Z-fighting)
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
      scene.add(m);
    };
    // Central Plaza + cross lanes
    addCobbleStrip(0, 0, 12.5, 13.5);
    addCobbleStrip(-9, 10, 11, 3.6); // Home lane
    addCobbleStrip(-10, -1, 3.8, 22); // West lane (Book Nook -> Bakery -> Home)
    addCobbleStrip(8.5, -1, 3.8, 23); // East lane (Workshop -> Greenhouse -> Woodshop)
    addCobbleStrip(0, 7.2, 22, 3.2); // South promenade above pond
    addCobbleStrip(0, -6.5, 22, 3.2); // North promenade by gazebo

    // Natural perimeter stone edging & rolling hills outside playable bounds
    const perimeterStoneMat = new THREE.MeshStandardMaterial({ color: '#9D9384', roughness: 0.9 });
    const hedgeMat = new THREE.MeshStandardMaterial({ color: '#618852', roughness: 0.85 });
    for (let i = -24; i <= 24; i += 6) {
      const wallN = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.65, 0.6), perimeterStoneMat);
      wallN.position.set(i, 0.32, -23.6);
      wallN.receiveShadow = true;
      const wallS = wallN.clone();
      wallS.position.z = 23.6;
      scene.add(wallN, wallS);
    }

    // Surrounding grove trees (InstancedMesh for crisp performance)
    const treeCount = 46;
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 1.4, 7);
    trunkGeo.translate(0, 0.7, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#78523A', roughness: 0.88 });
    const canopyGeo = new THREE.DodecahedronGeometry(1.15, 0);
    canopyGeo.translate(0, 2.15, 0);
    const canopyMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.84 });

    const trunksInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const canopiesInst = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCount);
    canopiesInst.castShadow = !isSoftwareGl;
    trunksInst.castShadow = !isSoftwareGl;
    const dummy = new THREE.Object3D();
    const treePalette = [
      new THREE.Color('#6B9A5A'),
      new THREE.Color('#7CA864'),
      new THREE.Color('#5E8954'),
      new THREE.Color('#8EB46B'),
    ];
    let tIdx = 0;
    for (let ring = 0; ring < treeCount; ring++) {
      const angle = (ring / treeCount) * Math.PI * 2;
      const radius = 26.5 + (ring % 3) * 3.8;
      const tx = Math.cos(angle) * radius * 1.08;
      const tz = Math.sin(angle) * radius * 0.96;
      const scale = 0.88 + ((ring * 17) % 10) * 0.03;
      dummy.position.set(tx, 0, tz);
      dummy.rotation.y = angle;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      trunksInst.setMatrixAt(tIdx, dummy.matrix);
      canopiesInst.setMatrixAt(tIdx, dummy.matrix);
      canopiesInst.setColorAt(tIdx, treePalette[ring % treePalette.length]);
      tIdx++;
    }
    trunksInst.computeBoundingSphere();
    canopiesInst.computeBoundingSphere();
    scene.add(trunksInst, canopiesInst);

    // Track reactive scene elements
    const windowMaterials: THREE.MeshStandardMaterial[] = [];
    const flowerGroups: THREE.Group[] = [];

    // Build Neighborhood Buildings (all pivoted at y = 0)
    // 1. Player Cottage (Willow Step Cottage)
    const playerHome = buildClayCottage({
      width: 6.2,
      depth: 5.4,
      wallHeight: 2.5,
      wallColor: '#F5EAD7',
      roofColor: '#C46347',
      trimColor: '#7A543E',
      doorSide: 'east',
      hasAwning: true,
      awningColor: '#698C6B',
      roofTex: terracottaRoofTex,
      windowMaterials,
      flowerGroups,
    });
    playerHome.position.set(-14.5, 0, 10.0);
    scene.add(playerHome);

    // Player Mailbox (with unread flag)
    const mailboxGroup = new THREE.Group();
    mailboxGroup.position.set(-9.8, 0, 7.2);
    const mbPost = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 1.0, 8),
      new THREE.MeshStandardMaterial({ color: '#6E4C36', roughness: 0.85 }),
    );
    mbPost.position.y = 0.5;
    const mbBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.35, 0.65),
      new THREE.MeshStandardMaterial({ color: '#5A7F64', roughness: 0.5, metalness: 0.2 }),
    );
    mbBox.position.y = 1.1;
    const mbFlag = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.34, 0.12),
      new THREE.MeshStandardMaterial({ color: '#E25B45', roughness: 0.4 }),
    );
    mbFlag.position.set(0.25, 1.28, 0.15);
    mailboxGroup.add(mbPost, mbBox, mbFlag);
    scene.add(mailboxGroup);

    // 2. Hearth & Crumb Bakery (Clara)
    const bakery = buildClayCottage({
      width: 6.8,
      depth: 5.8,
      wallHeight: 2.7,
      wallColor: '#F8DFC1',
      roofColor: '#C46347',
      trimColor: '#8B563A',
      doorSide: 'south',
      hasAwning: true,
      awningColor: '#D67054',
      roofTex: terracottaRoofTex,
      windowMaterials,
      flowerGroups,
    });
    bakery.position.set(-12.4, 0, -10.8);
    scene.add(bakery);

    // Reactive Bakery Outdoor Café Tables (appear after reconciliation or shared baking)
    const bakeryTablesGroup = new THREE.Group();
    bakeryTablesGroup.position.set(-8.0, 0, -6.4);
    for (let i = 0; i < 2; i++) {
      const tbl = new THREE.Group();
      tbl.position.set(i * 2.1, 0, 0.4);
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 0.72, 8),
        new THREE.MeshStandardMaterial({ color: '#5D4638', roughness: 0.8 }),
      );
      leg.position.y = 0.36;
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(0.62, 0.62, 0.08, 12),
        new THREE.MeshStandardMaterial({ color: '#FAF2E4', roughness: 0.7 }),
      );
      top.position.y = 0.74;
      const loaf = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.12, 0.22, 4, 6),
        new THREE.MeshStandardMaterial({ color: '#D8964B', roughness: 0.8 }),
      );
      loaf.rotation.z = Math.PI / 2;
      loaf.position.y = 0.86;
      tbl.add(leg, top, loaf);
      bakeryTablesGroup.add(tbl);
    }
    bakeryTablesGroup.visible = false;
    scene.add(bakeryTablesGroup);

    // 3. Linden Book Nook (Nora)
    const bookNook = buildClayCottage({
      width: 5.8,
      depth: 5.4,
      wallHeight: 2.5,
      wallColor: '#E5DAC8',
      roofColor: '#5F8267',
      trimColor: '#694F41',
      doorSide: 'east',
      hasAwning: true,
      awningColor: '#7A5463',
      roofTex: sageRoofTex,
      windowMaterials,
      flowerGroups,
    });
    bookNook.position.set(-15.8, 0, -1.0);
    scene.add(bookNook);

    // 4. Copperwheel Cottage (Arthur)
    const workshopArthur = buildClayCottage({
      width: 6.4,
      depth: 5.6,
      wallHeight: 2.6,
      wallColor: '#DFDFD6',
      roofColor: '#5D7082',
      trimColor: '#584B42',
      doorSide: 'south',
      hasAwning: false,
      roofTex: slateRoofTex,
      windowMaterials,
      flowerGroups,
    });
    workshopArthur.position.set(13.1, 0, -11.5);
    scene.add(workshopArthur);

    // 5. Sunbeam Greenhouse (Mina)
    const greenhouse = buildGreenhouse(windowMaterials);
    greenhouse.position.set(14.3, 0, 1.7);
    scene.add(greenhouse);

    // 6. Pinecone Woodshop (Barnaby)
    const workshopBarnaby = buildClayCottage({
      width: 5.8,
      depth: 5.4,
      wallHeight: 2.4,
      wallColor: '#E8D5BD',
      roofColor: '#5F8267',
      trimColor: '#7B4E34',
      doorSide: 'west',
      hasAwning: false,
      roofTex: sageRoofTex,
      windowMaterials,
      flowerGroups,
    });
    workshopBarnaby.position.set(12.4, 0, 13.0);
    scene.add(workshopBarnaby);

    // 7. Old Bell Gazebo (Centerpiece Landmark!)
    const gazeboRig: GazeboRig = buildOldBellGazebo();
    gazeboRig.group.position.set(0, 0, -9.5);
    scene.add(gazeboRig.group);

    // 8. Mossy Stone Fountain
    const fountainRig: FountainRig = buildStoneFountain();
    fountainRig.group.position.set(0, 0, 1.5);
    scene.add(fountainRig.group);

    // 9. Sora's Tea Cart & Noticeboard
    const teaCart = new THREE.Group();
    teaCart.position.set(-5.4, 0, -3.2);
    const cartBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.85, 0.95),
      new THREE.MeshStandardMaterial({ color: '#8D5F42', roughness: 0.8 }),
    );
    cartBase.position.y = 0.55;
    cartBase.castShadow = true;
    const kettle = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshStandardMaterial({ color: '#D49E42', roughness: 0.25, metalness: 0.8 }),
    );
    kettle.position.set(-0.2, 1.15, 0);
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.12, 1.2),
      new THREE.MeshStandardMaterial({ color: '#8C6BB1', roughness: 0.78 }),
    );
    canopy.position.y = 1.95;
    teaCart.add(cartBase, kettle, canopy);
    scene.add(teaCart);

    const noticeBoard = new THREE.Group();
    noticeBoard.position.set(4.4, 0, -3.2);
    const nbPostL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.6, 8),
      new THREE.MeshStandardMaterial({ color: '#6E4C36', roughness: 0.85 }),
    );
    nbPostL.position.set(-0.55, 0.8, 0);
    const nbPostR = nbPostL.clone();
    nbPostR.position.x = 0.55;
    const nbBoard = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.85, 0.14),
      new THREE.MeshStandardMaterial({ color: '#DFC7A0', roughness: 0.82 }),
    );
    nbBoard.position.y = 1.2;
    const nbFlyer = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.45, 0.16),
      new THREE.MeshStandardMaterial({ color: '#F9F3E4', roughness: 0.9 }),
    );
    nbFlyer.position.set(-0.2, 1.22, 0.02);
    noticeBoard.add(nbPostL, nbPostR, nbBoard, nbFlyer);
    scene.add(noticeBoard);

    // 10. Mirror Pond, Wooden Bridge & Hollow Oak
    const pondWater = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 0.12, 4.4),
      new THREE.MeshStandardMaterial({
        color: '#6CAEC0',
        roughness: 0.16,
        metalness: 0.15,
        transparent: true,
        opacity: 0.88,
      }),
    );
    pondWater.position.set(1.6, 0.06, 14.0);
    scene.add(pondWater);

    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(-2.9, 0, 14.0);
    const bridgeDeck = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.2, 5.2),
      new THREE.MeshStandardMaterial({ color: '#9D6E4C', roughness: 0.82 }),
    );
    bridgeDeck.position.y = 0.22;
    bridgeDeck.castShadow = true;
    bridgeDeck.receiveShadow = true;
    bridgeGroup.add(bridgeDeck);

    const railMat = new THREE.MeshStandardMaterial({ color: '#7D5338', roughness: 0.85 });
    for (const rx of [-0.96, 0.96]) {
      const railBar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 5.1), railMat);
      railBar.position.set(rx, 0.82, 0);
      bridgeGroup.add(railBar);
      for (const rz of [-2.2, 0, 2.2]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.68, 6), railMat);
        post.position.set(rx, 0.52, rz);
        bridgeGroup.add(post);
      }
    }
    scene.add(bridgeGroup);

    const hollowOak = new THREE.Group();
    hollowOak.position.set(-6.2, 0, 15.6);
    const oakTrunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.95, 2.2, 9),
      new THREE.MeshStandardMaterial({ color: '#6E4B35', roughness: 0.9 }),
    );
    oakTrunk.position.y = 1.1;
    oakTrunk.castShadow = true;
    const oakCrown = new THREE.Mesh(
      new THREE.DodecahedronGeometry(2.0, 0),
      hedgeMat,
    );
    oakCrown.position.y = 3.1;
    oakCrown.castShadow = true;
    const oakGlint = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshStandardMaterial({
        color: '#F5C452',
        emissive: '#E09A2B',
        emissiveIntensity: 0.65,
        metalness: 0.8,
        roughness: 0.2,
      }),
    );
    oakGlint.position.set(0.3, 0.35, -0.78);
    hollowOak.add(oakTrunk, oakCrown, oakGlint);
    scene.add(hollowOak);

    // 11. Festoon Lanterns & Plaza Lamps
    const lanternMat = new THREE.MeshStandardMaterial({
      color: '#FFE6A3',
      emissive: new THREE.Color('#FFAA3B'),
      emissiveIntensity: 0.2,
      roughness: 0.25,
    });
    const festoonGroup = new THREE.Group();
    const lampPosts: Array<[number, number]> = [
      [-6.2, -5.2],
      [6.2, -5.2],
      [-6.2, 6.2],
      [6.2, 6.2],
    ];
    for (const [lx, lz] of lampPosts) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.11, 2.8, 8),
        new THREE.MeshStandardMaterial({ color: '#45484E', roughness: 0.45, metalness: 0.6 }),
      );
      post.position.set(lx, 1.4, lz);
      post.castShadow = true;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), lanternMat);
      bulb.position.set(lx, 2.95, lz);
      scene.add(post, bulb);
    }

    // Festoon lantern bulbs strung across plaza
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const fx = THREE.MathUtils.lerp(-5.8, 5.8, t);
      const sag = Math.sin(t * Math.PI) * 0.65;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), lanternMat);
      bulb.position.set(fx, 3.3 - sag, -5.2);
      festoonGroup.add(bulb);
    }
    festoonGroup.visible = false;
    scene.add(festoonGroup);

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

    // Golden chime particle ring buffer (Zero-GC pooled)
    const chimePoolCount = 16;
    const chimeGeo = new THREE.OctahedronGeometry(0.12, 0);
    const chimeMat = new THREE.MeshBasicMaterial({ color: '#FFE082', transparent: true, opacity: 0.9 });
    const chimeParticles: Array<{ mesh: THREE.Mesh; vel: THREE.Vector3; life: number }> = [];
    for (let i = 0; i < chimePoolCount; i++) {
      const m = new THREE.Mesh(chimeGeo, chimeMat);
      m.visible = false;
      scene.add(m);
      chimeParticles.push({ mesh: m, vel: new THREE.Vector3(), life: 0 });
    }

    // Build Player & 9 Resident Character Rigs
    const playerRig: CharacterRig = buildClayCharacter(
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
      shadowTex,
    );
    playerRig.root.position.set(worldRef.current.playerPos.x, 0, worldRef.current.playerPos.z);
    playerRig.root.rotation.y = worldRef.current.playerFacing;
    scene.add(playerRig.root);

    const residentRigs = {} as Record<ResidentId, CharacterRig>;
    const residentPositions = {} as Record<ResidentId, Vec2>;
    const residentWalkPhase = {} as Record<ResidentId, number>;
    const interactableMeshes: THREE.Object3D[] = [];

    for (const id of RESIDENT_ORDER) {
      const def = RESIDENTS[id];
      const rig = buildClayCharacter(def.appearance, shadowTex);
      const slot = getResidentScheduleSlot(
        id,
        getTimePhase(worldRef.current.minuteOfDay),
        worldRef.current.flags.claraArthurReconciled,
      );
      rig.root.position.set(slot.target.x, 0, slot.target.z);
      rig.root.rotation.y = slot.facingAngle;
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
      residentPositions[id] = { x: slot.target.x, z: slot.target.z };
      residentWalkPhase[id] = 0;
      scene.add(rig.root);
    }

    // Add invisible raycast proxies for interactive props
    for (const prop of PROP_INTERACTABLES) {
      const hit = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 0.95, 2.2, 8),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hit.position.set(prop.x, 1.1, prop.z);
      hit.userData = { targetKind: 'prop', targetId: prop.id };
      scene.add(hit);
      interactableMeshes.push(hit);
    }

    // Input Tracking (WASD + Arrows + Tap-to-Walk + Interaction)
    const keysDown = new Set<string>();
    let tapWalkDest: Vec2 | null = null;
    let pendingTargetAfterWalk: InteractiveTarget | null = null;
    let playerWalkPhase = 0;
    let stepSoundAccum = 0;
    let hudSyncAccum = 0;
    let lastNearestId: string | null = null;

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

      const hits = _raycaster.intersectObjects(interactableMeshes, false);
      if (hits.length > 0) {
        const ud = hits[0].object.userData as { targetKind: 'resident' | 'prop'; targetId: string };
        const pPos = worldRef.current.playerPos;
        let tPos: Vec2 = { x: 0, z: 0 };
        let label = '';
        let actionLabel = 'Talk';

        if (ud.targetKind === 'resident') {
          const rid = ud.targetId as ResidentId;
          tPos = residentPositions[rid];
          label = RESIDENTS[rid].name;
          actionLabel = `Talk to ${label}`;
        } else {
          const prop = PROP_INTERACTABLES.find((p) => p.id === (ud.targetId as PropInteractableId));
          if (prop) {
            tPos = { x: prop.x, z: prop.z };
            label = prop.name;
            actionLabel = prop.id === 'player_door' ? 'Rest / Porch' : 'Inspect';
          }
        }

        const dist = distance2D(pPos, tPos);
        const targetObj: InteractiveTarget = {
          kind: ud.targetKind,
          id: ud.targetId,
          label,
          actionLabel,
          distance: dist,
          worldPos: { ...tPos },
        };

        if (dist <= 2.9) {
          cozyAudio.playUiTap(1.05);
          onSelectTargetRef.current(targetObj);
        } else {
          tapWalkDest = { ...tPos };
          pendingTargetAfterWalk = targetObj;
        }
        return;
      }

      // Ground tap-to-walk
      if (_raycaster.ray.intersectPlane(_groundPlane, _vec3A)) {
        if (isPointWalkable(_vec3A.x, _vec3A.z)) {
          tapWalkDest = { x: _vec3A.x, z: _vec3A.z };
          pendingTargetAfterWalk = null;
        } else {
          // Nudge to nearest walkable point along ray toward player
          const pPos = worldRef.current.playerPos;
          const clampedX = THREE.MathUtils.clamp(_vec3A.x, -23, 23);
          const clampedZ = THREE.MathUtils.clamp(_vec3A.z, -21, 21);
          const midX = (pPos.x + clampedX) * 0.5;
          const midZ = (pPos.z + clampedZ) * 0.5;
          if (isPointWalkable(midX, midZ)) {
            tapWalkDest = { x: midX, z: midZ };
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

    const clock = new THREE.Clock();
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

    function updateEnvironmentVisuals(env: EnvironmentalState, phase: TimePhase, elapsed: number) {
      // Planters blooming
      flowerGroups.forEach((fg, idx) => {
        const bloomActive = idx % 3 < env.plantersBloomed;
        const targetScale = bloomActive ? 1.15 : 0.45;
        fg.scale.setScalar(targetScale);
      });

      // Gazebo Ivy & Ribbon
      gazeboRig.ivyGroup.visible = !env.ivyCleared;
      gazeboRig.ribbonMesh.visible = env.reconciledTogether;
      bakeryTablesGroup.visible = env.bakeryTablesOpen;
      festoonGroup.visible = env.festoonLanterns || phase === 'dusk';

      // Hollow Oak glint hidden once brass clapper found
      oakGlint.visible = !worldRef.current.flags.foundBrassClapper;
      if (oakGlint.visible) {
        oakGlint.position.y = 0.35 + Math.sin(elapsed * 3.0) * 0.05;
      }

      // Mailbox unread flag raised/lowered
      mbFlag.rotation.z = worldRef.current.mailboxUnread ? 0 : -1.2;

      // Fountain water & droplets
      fountainRig.waterMesh.visible = env.fountainFlowing;
      fountainRig.spoutParticles.visible = env.fountainFlowing;
      if (env.fountainFlowing) {
        fountainRig.spoutParticles.children.forEach((drop, idx) => {
          const ph = ((elapsed * 1.8 + idx / 8) % 1);
          const angle = (idx / 8) * Math.PI * 2;
          const r = ph * 0.95;
          const arcY = 2.05 + Math.sin(ph * Math.PI) * 0.65 - ph * 1.45;
          drop.position.set(Math.cos(angle) * r, arcY, Math.sin(angle) * r);
        });
      }

      // Bell damped swing
      if (Math.abs(bellSwingVelRef.current) > 0.01 || Math.abs(gazeboRig.bellPivot.rotation.z) > 0.005) {
        const dtClamped = 0.016;
        const k = 18.0;
        const damping = 2.2;
        const acc = -k * gazeboRig.bellPivot.rotation.z - damping * bellSwingVelRef.current;
        bellSwingVelRef.current += acc * dtClamped;
        gazeboRig.bellPivot.rotation.z += bellSwingVelRef.current * dtClamped;
        if (Math.abs(bellSwingVelRef.current) > 3.6) {
          spawnChimeBurst(0, 3.1, -9.5);
        }
      }
    }

    let prevBellCountLocal = bellRingCounter;

    function tick() {
      if (disposed) return;
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.getElapsedTime();
      const state = screenStateRef.current;
      const world = worldRef.current;

      if (lastBellCountRef.current !== prevBellCountLocal) {
        prevBellCountLocal = lastBellCountRef.current;
        spawnChimeBurst(0, 3.1, -9.5);
      }

      // Advance cozy neighborhood clock while playing (not during pause/dialogue)
      if (state === 'playing' && !dialogueOpenRef.current) {
        world.minuteOfDay = Math.min(1260, world.minuteOfDay + dt * 2.2); // Gentle pace (~1 min = 27s)
      }

      const phase = getTimePhase(world.minuteOfDay);
      if (phase !== prevPhase) {
        prevPhase = phase;
      }

      // Smooth time-of-day sky, fog, sun & window glow
      const tNorm = THREE.MathUtils.clamp((world.minuteOfDay - 420) / 840, 0, 1);
      if (tNorm < 0.35) {
        _vec3A.set(_skyMorning.r, _skyMorning.g, _skyMorning.b);
        sunLight.color.copy(_sunMorning).lerp(_sunAfternoon, tNorm / 0.35);
        (scene.background as THREE.Color).copy(_skyMorning).lerp(_skyAfternoon, tNorm / 0.35);
      } else if (tNorm < 0.72) {
        const k = (tNorm - 0.35) / 0.37;
        sunLight.color.copy(_sunAfternoon).lerp(_sunGolden, k);
        (scene.background as THREE.Color).copy(_skyAfternoon).lerp(_skyGolden, k);
      } else {
        const k = (tNorm - 0.72) / 0.28;
        sunLight.color.copy(_sunGolden).lerp(_sunDusk, k);
        (scene.background as THREE.Color).copy(_skyGolden).lerp(_skyDusk, k);
      }
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.color.copy(scene.background as THREE.Color);
      }
      hemiLight.color.copy(_hemiSkyMorning).lerp(_hemiSkyDusk, Math.max(0, (tNorm - 0.6) / 0.4));
      sunLight.intensity = THREE.MathUtils.lerp(1.52, 0.92, Math.max(0, (tNorm - 0.65) / 0.35));

      const sunAngle = THREE.MathUtils.lerp(0.5, 2.4, tNorm);
      sunLight.position.set(Math.cos(sunAngle) * 26, 26 - Math.abs(tNorm - 0.5) * 10, 16);

      const windowGlow = phase === 'dusk' ? 1.25 : phase === 'golden' ? 0.65 : 0.2;
      for (const wm of windowMaterials) {
        wm.emissiveIntensity = windowGlow;
      }
      lanternMat.emissiveIntensity = phase === 'dusk' ? 1.5 : world.flags.lanternsLit ? 0.85 : 0.15;

      // Update environment visual reactivity
      const env = computeEnvironmentState(world.flags);
      updateEnvironmentVisuals(env, phase, elapsed);

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

      // Player Movement (when playing and not in dialogue)
      let moveX = 0;
      let moveZ = 0;

      if (state === 'playing' && !dialogueOpenRef.current) {
        // Isometric screen-aligned keyboard input
        const up = keysDown.has('KeyW') || keysDown.has('ArrowUp');
        const down = keysDown.has('KeyS') || keysDown.has('ArrowDown');
        const left = keysDown.has('KeyA') || keysDown.has('ArrowLeft');
        const right = keysDown.has('KeyD') || keysDown.has('ArrowRight');

        const screenHoriz = (right ? 1 : 0) - (left ? 1 : 0) + joystickVectorRef.current.x;
        const screenVert = (down ? 1 : 0) - (up ? 1 : 0) + joystickVectorRef.current.y;

        if (Math.abs(screenHoriz) > 0.08 || Math.abs(screenVert) > 0.08) {
          tapWalkDest = null;
          pendingTargetAfterWalk = null;
          // Screen-right = (+0.707, -0.707), Screen-down = (+0.707, +0.707)
          moveX = screenHoriz * 0.7071 + screenVert * 0.7071;
          moveZ = -screenHoriz * 0.7071 + screenVert * 0.7071;
        } else if (tapWalkDest) {
          const dx = tapWalkDest.x - world.playerPos.x;
          const dz = tapWalkDest.z - world.playerPos.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.35) {
            moveX = dx / dist;
            moveZ = dz / dist;
            if (pendingTargetAfterWalk && dist <= 2.4) {
              const target = pendingTargetAfterWalk;
              tapWalkDest = null;
              pendingTargetAfterWalk = null;
              cozyAudio.playUiTap(1.05);
              onSelectTargetRef.current(target);
            }
          } else {
            tapWalkDest = null;
            if (pendingTargetAfterWalk) {
              const target = pendingTargetAfterWalk;
              pendingTargetAfterWalk = null;
              onSelectTargetRef.current(target);
            }
          }
        }
      }

      const moveLen = Math.hypot(moveX, moveZ);
      if (moveLen > 0.01) {
        const nx = moveX / moveLen;
        const nz = moveZ / moveLen;
        const speed = 5.4;
        const desired = {
          x: world.playerPos.x + nx * speed * dt,
          z: world.playerPos.z + nz * speed * dt,
        };
        const resolved = resolveMovement(world.playerPos, desired, 0.48);
        const actualDist = distance2D(world.playerPos, resolved);
        world.playerPos = resolved;

        const targetAngle = Math.atan2(nx, nz);
        let diff = targetAngle - world.playerFacing;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        world.playerFacing += diff * Math.min(1, dt * 12);

        playerWalkPhase += actualDist * 5.5;
        stepSoundAccum += actualDist;
        if (stepSoundAccum >= 1.45) {
          stepSoundAccum = 0;
          cozyAudio.playFootstep();
        }
      } else {
        playerWalkPhase = THREE.MathUtils.damp(playerWalkPhase, Math.round(playerWalkPhase / Math.PI) * Math.PI, 8, dt);
      }

      // Update tap destination ring
      if (tapWalkDest) {
        destRing.visible = true;
        destRing.position.set(tapWalkDest.x, 0.05, tapWalkDest.z);
        const pulse = 1 + Math.sin(elapsed * 6) * 0.12;
        destRing.scale.setScalar(pulse);
      } else {
        destRing.visible = false;
      }

      // Animate player character rig
      playerRig.root.position.set(world.playerPos.x, 0, world.playerPos.z);
      playerRig.root.rotation.y = world.playerFacing;
      const swing = Math.sin(playerWalkPhase) * (moveLen > 0.01 ? 0.55 : 0);
      playerRig.leftLeg.rotation.x = swing;
      playerRig.rightLeg.rotation.x = -swing;
      playerRig.leftArm.rotation.x = -swing * 0.7;
      playerRig.rightArm.rotation.x = swing * 0.7;
      playerRig.bodyGroup.position.y = Math.abs(Math.sin(playerWalkPhase)) * (moveLen > 0.01 ? 0.06 : 0);

      // Move & animate all 9 residents along their living schedules
      let nearestTarget: InteractiveTarget | null = null;
      let nearestDist = 2.95;

      for (const id of RESIDENT_ORDER) {
        const rig = residentRigs[id];
        const pos = residentPositions[id];
        const slot = getResidentScheduleSlot(id, phase, env.reconciledTogether);
        const dx = slot.target.x - pos.x;
        const dz = slot.target.z - pos.z;
        const distToGoal = Math.hypot(dx, dz);

        if (distToGoal > 0.18 && state !== 'paused') {
          const step = Math.min(distToGoal, 2.3 * dt);
          const nx = dx / distToGoal;
          const nz = dz / distToGoal;
          const next = resolveMovement(pos, { x: pos.x + nx * step, z: pos.z + nz * step }, 0.38);
          pos.x = next.x;
          pos.z = next.z;
          rig.root.rotation.y = Math.atan2(nx, nz);
          residentWalkPhase[id] += step * 5.2;
          const rSwing = Math.sin(residentWalkPhase[id]) * 0.45;
          rig.leftLeg.rotation.x = rSwing;
          rig.rightLeg.rotation.x = -rSwing;
          rig.leftArm.rotation.x = -rSwing * 0.6;
          rig.rightArm.rotation.x = rSwing * 0.6;
          rig.bodyGroup.position.y = Math.abs(Math.sin(residentWalkPhase[id])) * 0.04;
        } else {
          // Gentle idle breathing & face toward schedule angle (or player if nearby)
          const pDist = distance2D(world.playerPos, pos);
          const goalRot =
            pDist < 3.2
              ? Math.atan2(world.playerPos.x - pos.x, world.playerPos.z - pos.z)
              : slot.facingAngle;
          let rDiff = goalRot - rig.root.rotation.y;
          while (rDiff > Math.PI) rDiff -= Math.PI * 2;
          while (rDiff < -Math.PI) rDiff += Math.PI * 2;
          rig.root.rotation.y += rDiff * Math.min(1, dt * 4);
          rig.leftLeg.rotation.x = 0;
          rig.rightLeg.rotation.x = 0;
          rig.leftArm.rotation.x = 0;
          rig.rightArm.rotation.x = 0;
          rig.bodyGroup.position.y = Math.sin(elapsed * 2.1 + pos.x) * 0.025;
        }
        rig.root.position.set(pos.x, 0, pos.z);

        // Quest cue diamond
        const cue = getResidentAvailableQuestCue(id, world);
        rig.questPip.visible = cue !== 'none';
        if (rig.questPip.visible) {
          rig.questPip.rotation.y = elapsed * 2.0;
          rig.questPip.position.y = (2.05 + Math.sin(elapsed * 3.2) * 0.08) * RESIDENTS[id].appearance.heightScale;
        }

        const pDist = distance2D(world.playerPos, pos);
        rig.ringMesh.visible = pDist < 2.95;
        if (pDist < nearestDist) {
          nearestDist = pDist;
          nearestTarget = {
            kind: 'resident',
            id,
            label: RESIDENTS[id].name,
            actionLabel: `Talk to ${RESIDENTS[id].name}`,
            distance: pDist,
            worldPos: { x: pos.x, z: pos.z },
          };
        }
      }

      // Check proximity to interactive neighborhood props
      for (const prop of PROP_INTERACTABLES) {
        const dProp = distance2D(world.playerPos, { x: prop.x, z: prop.z });
        if (dProp <= prop.interactRadius && dProp < nearestDist) {
          nearestDist = dProp;
          nearestTarget = {
            kind: 'prop',
            id: prop.id,
            label: prop.name,
            actionLabel:
              prop.id === 'player_door'
                ? 'Porch / Rest'
                : prop.id === 'gazebo_bell' && env.bellGleaming
                ? 'Ring Gazebo Bell'
                : `Inspect ${prop.name}`,
            distance: dProp,
            worldPos: { x: prop.x, z: prop.z },
          };
        }
      }

      // Camera Choreography: Title Screen orbits Plaza/Gazebo; Playing follows player smoothly
      if (state === 'title') {
        const orbitAngle = elapsed * 0.14 + 0.65;
        const r = 27;
        _vec3B.set(Math.cos(orbitAngle) * r, 16.5, Math.sin(orbitAngle) * r);
        camera.position.lerp(_vec3B, Math.min(1, dt * 3));
        camera.lookAt(0, 1.4, -2.5);
      } else {
        const zoom = zoomRef.current;
        const desiredCamX = world.playerPos.x + 19.5 * zoom;
        const desiredCamY = 18.2 * zoom;
        const desiredCamZ = world.playerPos.z + 19.5 * zoom;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, desiredCamX, 6.5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, desiredCamY, 6.5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, desiredCamZ, 6.5, dt);

        _vec3A.set(world.playerPos.x, 1.0, world.playerPos.z);
        camera.lookAt(_vec3A);
      }

      renderer.render(scene, camera);

      // Throttled HUD sync (~6 Hz or when nearest target changes)
      hudSyncAccum += dt;
      const nearestKey = nearestTarget ? `${nearestTarget.kind}:${nearestTarget.id}` : null;
      if (hudSyncAccum >= 0.18 || nearestKey !== lastNearestId) {
        hudSyncAccum = 0;
        lastNearestId = nearestKey;
        onHudSyncRef.current({
          minuteOfDay: world.minuteOfDay,
          playerPos: { ...world.playerPos },
          playerFacing: world.playerFacing,
          nearestTarget,
        });
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

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
      meadowTex.dispose();
      cobbleTex.dispose();
      terracottaRoofTex.dispose();
      sageRoofTex.dispose();
      slateRoofTex.dispose();
      shadowTex.dispose();
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
