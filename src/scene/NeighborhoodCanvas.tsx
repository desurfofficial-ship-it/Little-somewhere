import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  GameScreenState,
  InteractiveTarget,
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
  PROP_INTERACTABLES,
  distance2D,
  isPointWalkable,
  resolveMovement,
} from '../game/worldMap';
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
  createMeadowTexture,
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
import {
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
  animateCharacterRig,
  buildStorybookCharacter,
} from './builders/characters';

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
    const cobbleTex = createCobblestoneTexture(maxAniso);
    const terracottaRoofTex = createRoofShingleTexture('#C46347', '#D97B5E', maxAniso);
    const sageRoofTex = createRoofShingleTexture('#5F8267', '#759B7D', maxAniso);
    const slateRoofTex = createRoofShingleTexture('#5D7082', '#73889C', maxAniso);
    const shadowTex = createContactShadowTexture();

    // Extended natural meadow floor (no boxed void)
    const groundMat = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      map: meadowTex,
      roughness: 0.92,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

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
      scene.add(m);
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
    scene.add(buildPerimeterBorder(palette, shadowTex));
    const groveRig = buildGroveTreesInstanced(palette, isSoftwareGl);
    scene.add(groveRig.group);

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
    scene.add(willowCottage.group);

    const willowCourtyard = buildWillowLaneCourtyardProps(willowProtoCtx);
    scene.add(willowCourtyard.group);

    const willowMailbox = buildWillowMailbox(willowProtoCtx);
    willowMailbox.group.position.set(-9.8, 0, 7.2);
    scene.add(willowMailbox.group);
    const mbFlag = willowMailbox.flagMesh;

    // 2. Hearth & Crumb Bakery (Clara) + Reactive Outdoor Café Tables
    scene.add(buildStorybookBakery(buildingCtx));
    const bakeryTablesGroup = buildBakeryCafeTables(palette, shadowTex);
    scene.add(bakeryTablesGroup);

    // 3. Linden Book Nook (Nora)
    scene.add(buildStorybookBookNook(buildingCtx));

    // 4. Copperwheel Cottage (Arthur)
    scene.add(buildStorybookArthurWorkshop(buildingCtx));

    // 5. Sunbeam Greenhouse (Mina)
    scene.add(buildStorybookGreenhouse(buildingCtx));

    // 6. Pinecone Woodshop (Barnaby)
    scene.add(buildStorybookBarnabyWoodshop(buildingCtx));

    // 7. Old Bell Gazebo (Centerpiece Landmark!)
    const gazeboRig: GazeboRig = buildStorybookGazebo(palette, shadowTex, sageRoofTex);
    scene.add(gazeboRig.group);

    // 8. Mossy Stone Fountain
    const fountainRig: FountainRig = buildStorybookFountain(palette, shadowTex);
    scene.add(fountainRig.group);

    // 9. Sora's Tea Cart & Neighborhood Noticeboard
    scene.add(buildStorybookTeaCart(palette, shadowTex));
    const noticeboardRig = buildStorybookNoticeboard(palette, shadowTex, terracottaRoofTex);
    scene.add(noticeboardRig.group);

    // 10. Mirror Pond, Arched Cedar Bridge & Gnarled Hollow Oak
    scene.add(buildMirrorPondAndBridge(palette, shadowTex));
    const hollowOakRig = buildHollowOakLandmark(palette, shadowTex);
    scene.add(hollowOakRig.group);
    const oakGlint = hollowOakRig.oakGlint;

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
      scene.add(lamp);
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
    scene.add(festoonGroup);

    const envController = new EnvironmentVisualController({
      scene,
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
      bakeryTablesGroup,
      festoonGroup,
      noticeboardRig,
      oakGlint,
      mbFlag,
      bellSwingVelRef,
      isSoftwareGl,
    });

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
    playerRig.root.position.set(worldRef.current.playerPos.x, 0, worldRef.current.playerPos.z);
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
      rig.root.position.set(rt.position.x, 0, rt.position.z);
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
    let hasSyncedInitialHud = false;
    let lastNearestId: string | null = null;
    let lastSyncedMinuteInt = -1;
    let lastSyncedX = NaN;
    let lastSyncedZ = NaN;
    let lastSyncedWeather: WeatherType | null = null;
    let lastSyncedSeason: SeasonType | null = null;

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
          tPos = worldRef.current.npcRuntime[rid].position;
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

      // Step headless simulation clock & NPC navigation/runtime state
      stepSimulationInPlace(world, dt, {
        paused: state === 'paused',
        dialogueOpen: state !== 'playing' || dialogueOpenRef.current,
      });

      const phase = getTimePhase(world.minuteOfDay);
      if (phase !== prevPhase) {
        prevPhase = phase;
      }

      // Five-layer environment composition & dirty-flagged GPU/scene visual controller
      const composed = composeEnvironmentState(world);
      envController.update(composed, world, world.playerPos, elapsed, dt);
      updateWillowPrototypeMotion(willowCottage, willowCourtyard, elapsed);

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

      // Animate player character rig cleanly with joint pivots
      playerRig.root.position.set(world.playerPos.x, 0, world.playerPos.z);
      playerRig.root.rotation.y = world.playerFacing;
      animateCharacterRig(
        playerRig,
        moveLen > 0.01 ? 'walk' : 'idle',
        playerWalkPhase,
        elapsed,
        dt,
        0,
      );

      // Project persistent NPC runtime state onto 3D resident rigs
      let nearestTarget: InteractiveTarget | null = null;
      let nearestDist = 2.95;

      for (let i = 0; i < RESIDENT_ORDER.length; i++) {
        const id = RESIDENT_ORDER[i];
        const rig = residentRigs[id];
        const rt = world.npcRuntime[id];
        rig.root.position.set(rt.position.x, 0, rt.position.z);
        rig.root.rotation.y = rt.facing;

        animateCharacterRig(rig, rt.animState, rt.walkPhase, elapsed, dt, i * 0.7);

        // Quest cue diamond
        const cue = getResidentAvailableQuestCue(id, world);
        rig.questPip.visible = cue !== 'none';
        if (rig.questPip.visible) {
          rig.questPip.rotation.y = elapsed * 2.0;
          rig.questPip.position.y = (2.05 + Math.sin(elapsed * 3.2) * 0.08) * RESIDENTS[id].appearance.heightScale;
        }

        const pDist = distance2D(world.playerPos, rt.position);
        rig.ringMesh.visible = pDist < 2.95;
        if (pDist < nearestDist) {
          nearestDist = pDist;
          nearestTarget = {
            kind: 'resident',
            id,
            label: RESIDENTS[id].name,
            actionLabel: `Talk to ${RESIDENTS[id].name}`,
            distance: pDist,
            worldPos: { x: rt.position.x, z: rt.position.z },
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
                : prop.id === 'gazebo_bell' && composed.playerChanges.bellGleaming
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

      // Edge-gated throttled HUD sync
      hudSyncAccum += dt;
      const minuteInt = Math.floor(world.minuteOfDay);
      const nearestKey = nearestTarget ? `${nearestTarget.kind}:${nearestTarget.id}` : null;
      const movedDist = Number.isNaN(lastSyncedX)
        ? 999
        : Math.hypot(world.playerPos.x - lastSyncedX, world.playerPos.z - lastSyncedZ);
      const edgeTriggered =
        !hasSyncedInitialHud ||
        nearestKey !== lastNearestId ||
        composed.weather.effective !== lastSyncedWeather ||
        composed.season.season !== lastSyncedSeason;

      if (
        edgeTriggered ||
        (hudSyncAccum >= 0.18 && (minuteInt !== lastSyncedMinuteInt || movedDist > 0.15))
      ) {
        hasSyncedInitialHud = true;
        hudSyncAccum = 0;
        lastNearestId = nearestKey;
        lastSyncedMinuteInt = minuteInt;
        lastSyncedX = world.playerPos.x;
        lastSyncedZ = world.playerPos.z;
        lastSyncedWeather = composed.weather.effective;
        lastSyncedSeason = composed.season.season;
        onHudSyncRef.current({
          minuteOfDay: world.minuteOfDay,
          playerPos: { ...world.playerPos },
          playerFacing: world.playerFacing,
          nearestTarget,
          weather: composed.weather.effective,
          season: composed.season.season,
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
      envController.dispose();
      groundMat.dispose();
      cobbleMat.dispose();
      lanternMat.dispose();
      chimeGeo.dispose();
      chimeMat.dispose();
      meadowTex.dispose();
      cobbleTex.dispose();
      terracottaRoofTex.dispose();
      sageRoofTex.dispose();
      slateRoofTex.dispose();
      shadowTex.dispose();
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
