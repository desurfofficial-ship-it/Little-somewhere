import * as THREE from 'three';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';
import { TimePhase } from '../../game/types';

/**
 * Reactive micro-props & pooled ambient life.
 *
 * Builders here produce the visual layer for environment hooks that the
 * simulation already computes (`composed.npcTouches`, `composed.weather.puddlesActive`)
 * plus zero-GC pooled ambient animation rigs (butterflies, dusk fireflies,
 * pond shimmer, chimney hearth wisps).
 *
 * Every animated rig exposes an `update(elapsed, ...)` that mutates only
 * transforms/material scalars — no per-frame allocations.
 */

function makeSeededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 1. Clara's morning pastry basket (Hearth & Crumb café table)
// ---------------------------------------------------------------------------

export interface PastryBasketRig {
  group: THREE.Group;
  dispose(): void;
}

/**
 * Woven pastry basket with two mini loaves + linen cloth, seated on the west
 * café table in front of the bakery (world ≈ (-8.0, 0.78, -6.0)).
 */
export function buildPastryBasketRig(palette: MaterialPalette): PastryBasketRig {
  const group = new THREE.Group();
  group.position.set(-8.0, 0.78, -6.0);
  group.rotation.y = 0.5;

  const wickerMat = palette.get('reactive_wicker', {
    color: '#A9804F',
    roughness: 0.82,
    metalness: 0.02,
  });
  const wickerDarkMat = palette.get('reactive_wicker_dark', {
    color: '#8B6540',
    roughness: 0.84,
    metalness: 0.02,
  });
  const clothMat = palette.get('reactive_basket_cloth', {
    color: '#EFE3CE',
    roughness: 0.9,
    metalness: 0.0,
  });
  const crustMat = palette.get('reactive_crust', {
    color: '#C98A4B',
    roughness: 0.78,
    metalness: 0.02,
  });

  const geos: THREE.BufferGeometry[] = [];
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    geos.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    group.add(m);
    return m;
  };

  // Woven body: tapered cylinder + two rim hoops + weave band
  const bodyGeo = new THREE.CylinderGeometry(0.15, 0.11, 0.16, 9);
  add(bodyGeo, wickerMat, 0, 0.08, 0);
  const rimGeo = new THREE.TorusGeometry(0.148, 0.022, 6, 12);
  const rim = add(rimGeo, wickerDarkMat, 0, 0.165, 0);
  rim.rotation.x = Math.PI / 2;
  const bandGeo = new THREE.TorusGeometry(0.132, 0.016, 6, 12);
  const band = add(bandGeo, wickerDarkMat, 0, 0.06, 0);
  band.rotation.x = Math.PI / 2;

  // Linen cloth draped over the rim
  const clothGeo = new THREE.CircleGeometry(0.13, 8, 0, Math.PI * 1.25);
  const cloth = add(clothGeo, clothMat, 0.02, 0.172, -0.01);
  cloth.rotation.x = -Math.PI / 2;
  cloth.rotation.z = 0.5;

  // Two mini loaves peeking from the basket
  const loafGeo = new THREE.CapsuleGeometry(0.055, 0.09, 3, 7);
  const loafA = add(loafGeo, crustMat, -0.05, 0.19, 0.03);
  loafA.rotation.z = Math.PI / 2 + 0.2;
  const loafB = add(loafGeo, crustMat, 0.04, 0.2, -0.03);
  loafB.rotation.z = Math.PI / 2 - 0.35;

  return {
    group,
    dispose() {
      for (const g of geos) g.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Mina's greenhouse moon-petal progression (stage 2 = buds, stage 3 = bloom)
// ---------------------------------------------------------------------------

export interface GreenhouseStageRig {
  group: THREE.Group;
  stageBuds: THREE.Group;
  stageBloom: THREE.Group;
  bloomGlowMat: THREE.MeshStandardMaterial;
  dispose(): void;
}

const MOON_POT_Y = 1.045;

// Moon-petal pots sit on the trestle potting bench along the greenhouse's north dwarf wall
// (bench top y 0.905 in buildings.ts; pot height 0.28 -> centre y 1.045 keeps them grounded).
const MOON_PETAL_POTS: ReadonlyArray<{ x: number; z: number }> = [
  { x: -2.45, z: -2.2 },
  { x: -1.9, z: -2.2 },
  { x: -1.35, z: -2.2 },
];

/**
 * Moon-petal planter trays on the greenhouse potting bench north edge.
 * Stage 1: hidden (base greenhouse only). Stage 2: potted buds appear.
 * Stage 3: buds bloom into softly glowing pale-lavender moon petals.
 */
export function buildGreenhouseStageRig(palette: MaterialPalette): GreenhouseStageRig {
  const group = new THREE.Group();
  group.position.set(14.3, 0, 1.7);

  const potMat = palette.get('reactive_moonpot', {
    color: STORYBOOK_PALETTE.terracottaPot,
    roughness: 0.44,
    metalness: 0.04,
  });
  const stemMat = palette.get('reactive_moonstem', {
    color: STORYBOOK_PALETTE.foliageMid,
    roughness: 0.84,
    metalness: 0.0,
  });
  const budMat = palette.get('reactive_moonbud', {
    color: '#B4A6C4',
    roughness: 0.7,
    metalness: 0.02,
  });
  const bloomGlowMat = new THREE.MeshStandardMaterial({
    color: '#D9C8F0',
    emissive: new THREE.Color('#B48FE0'),
    emissiveIntensity: 0.55,
    roughness: 0.5,
    metalness: 0.02,
  });

  const stageBuds = new THREE.Group();
  const stageBloom = new THREE.Group();
  stageBloom.visible = false;
  group.add(stageBuds, stageBloom);

  const geos: THREE.BufferGeometry[] = [];
  const potGeo = new THREE.CylinderGeometry(0.2, 0.15, 0.28, 8);
  geos.push(potGeo);
  const stemGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.34, 5);
  geos.push(stemGeo);
  stemGeo.translate(0, 0.17, 0);
  const budGeo = new THREE.SphereGeometry(0.09, 8, 8);
  geos.push(budGeo);
  budGeo.scale(1.0, 1.25, 1.0);
  budGeo.translate(0, 0.4, 0);
  const bloomGeo = new THREE.IcosahedronGeometry(0.13, 0);
  geos.push(bloomGeo);
  bloomGeo.scale(1.0, 0.85, 1.0);
  bloomGeo.translate(0, 0.44, 0);

  for (const p of MOON_PETAL_POTS) {
    const pot = new THREE.Mesh(potGeo, potMat);
    pot.position.set(p.x, MOON_POT_Y, p.z);
    pot.castShadow = true;
    group.add(pot); // pot is permanent once stage >= 2 (parent group visibility)

    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(p.x, MOON_POT_Y, p.z);
    const bud = new THREE.Mesh(budGeo, budMat);
    bud.position.set(p.x, MOON_POT_Y, p.z);
    stageBuds.add(stem, bud);

    const bloom = new THREE.Mesh(bloomGeo, bloomGlowMat);
    bloom.position.set(p.x, MOON_POT_Y, p.z);
    bloom.castShadow = true;
    stageBloom.add(bloom);
  }

  // Soft cool pool of light on the bench top when blooming
  const glowGeo = new THREE.CircleGeometry(0.72, 16);
  geos.push(glowGeo);
  const glowMat = new THREE.MeshBasicMaterial({
    color: '#CDB9EC',
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.scale.set(1, 0.55, 1); // elliptical pool stays on the bench top (1.44 × 0.79)
  glow.position.set(-1.9, 0.945, -2.2);
  stageBloom.add(glow);

  return {
    group,
    stageBuds,
    stageBloom,
    bloomGlowMat,
    dispose() {
      for (const g of geos) g.dispose();
      bloomGlowMat.dispose();
      glowMat.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Arthur's early porch lamp (Copperwheel Cottage)
// ---------------------------------------------------------------------------

export interface PorchLampRig {
  group: THREE.Group;
  glassMat: THREE.MeshStandardMaterial;
  haloMesh: THREE.Mesh;
  dispose(): void;
}

/**
 * Wall-mounted brass porch lantern beside Copperwheel Cottage's south door.
 * Fixture is permanent set dressing; the glass glow + warm halo activate when
 * `arthurEarlyPorchLamp` (rain / golden / dusk) is true.
 */
export function buildArthurPorchLampRig(palette: MaterialPalette): PorchLampRig {
  const group = new THREE.Group();
  // Copperwheel Cottage at (13.1, 0, -11.5), south wall face z = -8.8
  group.position.set(14.05, 0, -8.78);

  const ironMat = palette.get('reactive_lamp_iron', {
    color: STORYBOOK_PALETTE.wroughtIron,
    roughness: 0.42,
    metalness: 0.72,
  });
  const brassMat = palette.get('reactive_lamp_brass', {
    color: STORYBOOK_PALETTE.agedBrass,
    roughness: 0.24,
    metalness: 0.86,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#FFE6A3',
    emissive: new THREE.Color('#FFAA3B'),
    emissiveIntensity: 0.15,
    roughness: 0.2,
    metalness: 0.05,
  });

  const geos: THREE.BufferGeometry[] = [];
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    geos.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    group.add(m);
    return m;
  };

  // Wall plate + diagonal bracket arm + drop rod
  const plateGeo = new THREE.BoxGeometry(0.2, 0.26, 0.06);
  add(plateGeo, ironMat, 0, 2.42, 0.04);
  const armGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.42, 6);
  const arm = add(armGeo, ironMat, 0, 2.32, 0.2);
  arm.rotation.x = Math.PI / 2.6;
  const rodGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.3, 6);
  add(rodGeo, ironMat, 0, 2.06, 0.36);

  // Lantern housing: brass cap + glass body + iron base ring
  const capGeo = new THREE.ConeGeometry(0.14, 0.12, 6);
  add(capGeo, brassMat, 0, 1.84, 0.36);
  const glassGeo = new THREE.CylinderGeometry(0.1, 0.13, 0.22, 6);
  const glass = add(glassGeo, glassMat, 0, 1.68, 0.36);
  glass.castShadow = false;
  const baseGeo = new THREE.TorusGeometry(0.105, 0.026, 6, 10);
  const base = add(baseGeo, brassMat, 0, 1.55, 0.36);
  base.rotation.x = Math.PI / 2;

  // Warm light pool on the porch step below (activates with the glass)
  const haloGeo = new THREE.CircleGeometry(0.62, 14);
  geos.push(haloGeo);
  const haloMat = new THREE.MeshBasicMaterial({
    color: '#FFC46A',
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  const haloMesh = new THREE.Mesh(haloGeo, haloMat);
  haloMesh.rotation.x = -Math.PI / 2;
  haloMesh.position.set(0, 0.055, 0.42);
  haloMesh.visible = false;
  group.add(haloMesh);

  return {
    group,
    glassMat,
    haloMesh,
    dispose() {
      for (const g of geos) g.dispose();
      glassMat.dispose();
      haloMat.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// 4. Rain puddles (plaza & lane margins)
// ---------------------------------------------------------------------------

export interface PuddleRig {
  mesh: THREE.InstancedMesh;
  dispose(): void;
}

const PUDDLE_SPOTS: ReadonlyArray<{ x: number; z: number; r: number; rot: number }> = [
  { x: 2.55, z: 5.7, r: 1.05, rot: 0.3 },
  { x: -3.15, z: -4.55, r: 0.8, rot: 1.15 },
  { x: 6.7, z: -0.9, r: 0.72, rot: 2.0 },
  { x: -8.8, z: 0.95, r: 0.85, rot: 0.7 },
  { x: 1.15, z: -7.05, r: 0.92, rot: 2.6 },
  { x: -4.75, z: 8.7, r: 0.68, rot: 1.7 },
  { x: -1.0, z: 5.0, r: 0.6, rot: 0.15 },
];

/**
 * Soft rain puddle films on the cobblestone (cobble slab top = y 0.05,
 * puddle sits at y 0.058 to stay clear of z-fighting). No collision impact.
 */
export function buildPuddleRig(palette: MaterialPalette): PuddleRig {
  const geo = new THREE.CircleGeometry(1, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: '#8AA5B5',
    roughness: 0.1,
    metalness: 0.18,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, PUDDLE_SPOTS.length);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < PUDDLE_SPOTS.length; i++) {
    const p = PUDDLE_SPOTS[i];
    dummy.position.set(p.x, 0.058, p.z);
    dummy.rotation.set(-Math.PI / 2, 0, p.rot);
    dummy.scale.set(p.r, p.r * (0.62 + (i % 3) * 0.12), 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.visible = false;
  mesh.frustumCulled = false;
  return {
    mesh,
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// 5. Butterflies (pooled, wing-flapping, anchored to pond / greenhouse / courtyard)
// ---------------------------------------------------------------------------

export interface ButterflyRig {
  wingsL: THREE.InstancedMesh;
  wingsR: THREE.InstancedMesh;
  bodies: THREE.InstancedMesh;
  readonly count: number;
  anchors: ReadonlyArray<{ x: number; z: number }>;
  update(elapsed: number): void;
  dispose(): void;
}

const BUTTERFLY_ANCHORS = [
  { x: -1.6, z: 11.6 }, // Mirror Pond north shallows
  { x: 12.1, z: 6.3 }, // Greenhouse front beds
  { x: -12.9, z: 14.3 }, // Willow courtyard blooms
];

export function buildButterflyRig(isSoftwareGl: boolean): ButterflyRig {
  const count = isSoftwareGl ? 2 : 3;
  const rand = makeSeededRandom(909);

  const wingGeo = new THREE.PlaneGeometry(0.17, 0.12);
  wingGeo.translate(0.085, 0, 0); // pivot at wing root
  wingGeo.rotateX(-Math.PI / 2); // lie flat in XZ
  const wingMat = new THREE.MeshBasicMaterial({
    color: '#F6D9E2',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  const bodyGeo = new THREE.CapsuleGeometry(0.022, 0.09, 2, 5);
  bodyGeo.rotateX(Math.PI / 2);
  const bodyMat = new THREE.MeshBasicMaterial({ color: '#5C4A3E' });

  const wingsL = new THREE.InstancedMesh(wingGeo, wingMat, count);
  const wingsR = new THREE.InstancedMesh(wingGeo, wingMat, count);
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
  for (const m of [wingsL, wingsR, bodies]) {
    m.frustumCulled = false;
    m.visible = false;
  }

  // Per-butterfly wandering seeds
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    seeds[i * 4 + 0] = 0.5 + rand() * 0.9; // radius wobble
    seeds[i * 4 + 1] = rand() * Math.PI * 2; // phase
    seeds[i * 4 + 2] = 0.55 + rand() * 0.5; // speed
    seeds[i * 4 + 3] = 0.7 + rand() * 0.5; // height
  }

  const _pos = new THREE.Vector3();
  const _qYaw = new THREE.Quaternion();
  const _qFlap = new THREE.Quaternion();
  const _qFinal = new THREE.Quaternion();
  const _scale = new THREE.Vector3(1, 1, 1);
  const _axisY = new THREE.Vector3(0, 1, 0);
  const _axisX = new THREE.Vector3(1, 0, 0);
  const _mat = new THREE.Matrix4();

  const rig: ButterflyRig = {
    wingsL,
    wingsR,
    bodies,
    count,
    anchors: BUTTERFLY_ANCHORS,
    update(elapsed: number) {
      for (let i = 0; i < count; i++) {
        const a = BUTTERFLY_ANCHORS[i % BUTTERFLY_ANCHORS.length];
        const rW = seeds[i * 4 + 0];
        const ph = seeds[i * 4 + 1];
        const sp = seeds[i * 4 + 2];
        const h = seeds[i * 4 + 3];
        const t = elapsed * sp + ph;
        const wx = a.x + Math.sin(t * 1.1) * rW * 1.35 + Math.sin(t * 2.3) * 0.3;
        const wz = a.z + Math.cos(t * 0.9) * rW + Math.cos(t * 2.1) * 0.26;
        const wy = h + Math.sin(t * 1.7) * 0.22;
        _pos.set(wx, wy, wz);

        // Face travel direction (yaw from velocity estimate)
        const yaw = Math.atan2(Math.cos(t * 1.1) * 1.1 + Math.cos(t * 2.3) * 0.6, -Math.sin(t * 0.9) * 0.9 - Math.sin(t * 2.1) * 0.55);
        const flap = Math.sin(elapsed * 16 + i * 2.4) * 0.85;

        _qYaw.setFromAxisAngle(_axisY, yaw);

        _qFinal.copy(_qYaw);
        _mat.compose(_pos, _qFinal, _scale);
        bodies.setMatrixAt(i, _mat);

        _qFlap.setFromAxisAngle(_axisX, -flap);
        _qFinal.copy(_qYaw).multiply(_qFlap);
        _mat.compose(_pos, _qFinal, _scale);
        wingsR.setMatrixAt(i, _mat);

        _qFlap.setFromAxisAngle(_axisX, flap);
        // Mirror wing: rotate 180° yaw so the translated root points the other way
        _qYaw.setFromAxisAngle(_axisY, yaw + Math.PI);
        _qFinal.copy(_qYaw).multiply(_qFlap);
        _mat.compose(_pos, _qFinal, _scale);
        wingsL.setMatrixAt(i, _mat);
      }
      wingsL.instanceMatrix.needsUpdate = true;
      wingsR.instanceMatrix.needsUpdate = true;
      bodies.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      wingGeo.dispose();
      wingMat.dispose();
      bodyGeo.dispose();
      bodyMat.dispose();
    },
  };
  rig.update(0);
  return rig;
}

// ---------------------------------------------------------------------------
// 6. Dusk fireflies (pooled drifting ember motes over meadow margins)
// ---------------------------------------------------------------------------

export interface FireflyRig {
  mesh: THREE.InstancedMesh;
  readonly count: number;
  update(elapsed: number): void;
  dispose(): void;
}

const FIREFLY_SPOTS = [
  { x: -7.2, z: 18.6, r: 3.2 },
  { x: -15.6, z: 15.2, r: 2.6 },
  { x: 19.6, z: -6.8, r: 3.0 },
  { x: 8.6, z: 18.4, r: 2.8 },
  { x: -20.4, z: -9.6, r: 3.0 },
  { x: 12.4, z: -18.2, r: 2.6 },
];

export function buildFireflyRig(isSoftwareGl: boolean): FireflyRig {
  const count = isSoftwareGl ? 8 : 14;
  const rand = makeSeededRandom(424);

  const geo = new THREE.SphereGeometry(0.05, 6, 6);
  const mat = new THREE.MeshBasicMaterial({
    color: '#FFE9A8',
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  mesh.visible = false;

  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const spot = FIREFLY_SPOTS[i % FIREFLY_SPOTS.length];
    seeds[i * 4 + 0] = spot.x + (rand() - 0.5) * spot.r * 2;
    seeds[i * 4 + 1] = spot.z + (rand() - 0.5) * spot.r * 1.6;
    seeds[i * 4 + 2] = rand() * Math.PI * 2;
    seeds[i * 4 + 3] = 0.55 + rand() * 0.8;
  }

  const _mat = new THREE.Matrix4();
  const _pos = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const _axisYFirefly = new THREE.Vector3(0, 1, 0);

  const rig: FireflyRig = {
    mesh,
    count,
    update(elapsed: number) {
      const globalPulse = 0.5 + Math.sin(elapsed * 2.1) * 0.28;
      mat.opacity = 0.42 + globalPulse * 0.4;
      for (let i = 0; i < count; i++) {
        const bx = seeds[i * 4 + 0];
        const bz = seeds[i * 4 + 1];
        const ph = seeds[i * 4 + 2];
        const h = seeds[i * 4 + 3];
        const t = elapsed * 0.55 + ph;
        _pos.set(
          bx + Math.sin(t) * 0.9 + Math.sin(t * 2.3) * 0.22,
          h + Math.sin(t * 1.4 + ph) * 0.3,
          bz + Math.cos(t * 0.8) * 0.8,
        );
        const twinkle = 0.75 + Math.sin(elapsed * 5.2 + i * 1.7) * 0.45;
        _s.setScalar(Math.max(0.35, twinkle));
        _q.setFromAxisAngle(_axisYFirefly, elapsed * 0.6 + ph);
        _mat.compose(_pos, _q, _s);
        mesh.setMatrixAt(i, _mat);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
  rig.update(0);
  return rig;
}

// ---------------------------------------------------------------------------
// 7. Mirror Pond sun shimmer (slow drifting highlight flecks on the water)
// ---------------------------------------------------------------------------

export interface PondSparkleRig {
  mesh: THREE.InstancedMesh;
  readonly count: number;
  update(elapsed: number): void;
  dispose(): void;
}

export function buildPondSparkleRig(isSoftwareGl: boolean): PondSparkleRig {
  const count = isSoftwareGl ? 5 : 8;
  const rand = makeSeededRandom(616);

  const geo = new THREE.PlaneGeometry(0.3, 0.14);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: '#E9F7FA',
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;

  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    seeds[i * 3 + 0] = 1.7 + (rand() - 0.5) * 5.4; // pond x span
    seeds[i * 3 + 1] = 14.0 + (rand() - 0.5) * 3.4; // pond z span
    seeds[i * 3 + 2] = rand() * Math.PI * 2;
  }

  const _mat = new THREE.Matrix4();
  const _pos = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const _axisYSparkle = new THREE.Vector3(0, 1, 0);

  const rig: PondSparkleRig = {
    mesh,
    count,
    update(elapsed: number) {
      for (let i = 0; i < count; i++) {
        const bx = seeds[i * 3 + 0];
        const bz = seeds[i * 3 + 1];
        const ph = seeds[i * 3 + 2];
        _pos.set(
          bx + Math.sin(elapsed * 0.4 + ph) * 0.45,
          0.135,
          bz + Math.cos(elapsed * 0.32 + ph) * 0.3,
        );
        _q.setFromAxisAngle(_axisYSparkle, ph + elapsed * 0.1);
        const pulse = 0.75 + Math.sin(elapsed * 1.8 + ph * 2) * 0.35;
        _s.set(pulse, 1, pulse);
        _mat.compose(_pos, _q, _s);
        mesh.setMatrixAt(i, _mat);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
  rig.update(0);
  return rig;
}

// ---------------------------------------------------------------------------
// 8. Chimney hearth wisps (bakery / Copperwheel / woodshop, pooled & instanced)
// ---------------------------------------------------------------------------

export interface ChimneyWispRig {
  mesh: THREE.InstancedMesh;
  readonly chimneys: ReadonlyArray<{ x: number; y: number; z: number; phases: TimePhase[] }>;
  readonly puffsPerChimney: number;
  update(elapsed: number, activeMask: boolean[]): void;
  dispose(): void;
}

/**
 * Hearth smoke for the three workshop chimneys (Willow Cottage already has
 * its own dedicated puffs). Each chimney puffs only during the phases in
 * which its resident is working — a small daily-life storytelling beat.
 */
export function buildChimneyWispRig(isSoftwareGl: boolean): ChimneyWispRig {
  const chimneys = [
    // Hearth & Crumb Bakery — Clara bakes through the morning & afternoon
    { x: -14.5, y: 0.5 + 2.75 + 2.2, z: -11.7, phases: ['morning', 'afternoon'] as TimePhase[] },
    // Copperwheel Cottage — Arthur's late bench hours
    { x: 14.9, y: 0.5 + 2.62 + 2.2, z: -12.6, phases: ['afternoon', 'golden', 'dusk'] as TimePhase[] },
    // Pinecone Woodshop — Barnaby saws after lunch
    { x: 13.8, y: 0.5 + 2.48 + 2.2, z: 14.0, phases: ['afternoon', 'golden'] as TimePhase[] },
  ];
  const puffsPerChimney = isSoftwareGl ? 3 : 4;
  const total = chimneys.length * puffsPerChimney;

  const geo = new THREE.DodecahedronGeometry(0.18, 0);
  const mat = new THREE.MeshBasicMaterial({
    color: '#F7F1E5',
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, total);
  mesh.frustumCulled = false;

  const _mat = new THREE.Matrix4();
  const _pos = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const _axisY = new THREE.Vector3(0, 1, 0);

  const rig: ChimneyWispRig = {
    mesh,
    chimneys,
    puffsPerChimney,
    update(elapsed: number, activeMask: boolean[]) {
      let idx = 0;
      for (let c = 0; c < chimneys.length; c++) {
        const ch = chimneys[c];
        const active = activeMask[c] ?? false;
        for (let p = 0; p < puffsPerChimney; p++) {
          const cyc = (elapsed * 0.26 + p / puffsPerChimney) % 1;
          if (active) {
            _pos.set(
              ch.x + Math.sin(elapsed * 0.8 + c * 2 + p) * 0.12 + cyc * 0.24,
              ch.y + cyc * 1.6,
              ch.z + cyc * 0.16,
            );
            const s = (0.62 + cyc * 0.9) * (1 - cyc * 0.36);
            _s.setScalar(s);
            _q.setFromAxisAngle(_axisY, elapsed * 0.4 + p);
          } else {
            _pos.set(0, -50, 0);
            _s.setScalar(0.001);
            _q.identity();
          }
          _mat.compose(_pos, _q, _s);
          mesh.setMatrixAt(idx++, _mat);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
  return rig;
}

// ---------------------------------------------------------------------------
// Aggregate rig handle
// ---------------------------------------------------------------------------

export interface ReactiveVisualRigs {
  pastryBasket: PastryBasketRig;
  greenhouseStage: GreenhouseStageRig;
  porchLamp: PorchLampRig;
  puddles: PuddleRig;
  butterflies: ButterflyRig;
  fireflies: FireflyRig;
  pondSparkles: PondSparkleRig;
  chimneyWisps: ChimneyWispRig;
  disposeAll(): void;
}

export function buildAllReactiveRigs(
  palette: MaterialPalette,
  isSoftwareGl: boolean,
): ReactiveVisualRigs {
  const pastryBasket = buildPastryBasketRig(palette);
  const greenhouseStage = buildGreenhouseStageRig(palette);
  const porchLamp = buildArthurPorchLampRig(palette);
  const puddles = buildPuddleRig(palette);
  const butterflies = buildButterflyRig(isSoftwareGl);
  const fireflies = buildFireflyRig(isSoftwareGl);
  const pondSparkles = buildPondSparkleRig(isSoftwareGl);
  const chimneyWisps = buildChimneyWispRig(isSoftwareGl);

  return {
    pastryBasket,
    greenhouseStage,
    porchLamp,
    puddles,
    butterflies,
    fireflies,
    pondSparkles,
    chimneyWisps,
    disposeAll() {
      pastryBasket.dispose();
      greenhouseStage.dispose();
      porchLamp.dispose();
      puddles.dispose();
      butterflies.dispose();
      fireflies.dispose();
      pondSparkles.dispose();
      chimneyWisps.dispose();
    },
  };
}
