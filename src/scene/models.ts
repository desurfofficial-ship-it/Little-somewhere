import * as THREE from 'three';
import { ResidentAppearance } from '../game/types';

export interface CottageOptions {
  width: number;
  depth: number;
  wallHeight: number;
  wallColor: string;
  roofColor: string;
  trimColor: string;
  doorSide: 'north' | 'south' | 'east' | 'west';
  hasAwning?: boolean;
  awningColor?: string;
  roofTex?: THREE.Texture;
  windowMaterials: THREE.MeshStandardMaterial[];
  flowerGroups: THREE.Group[];
}

function makeMat(color: string, roughness = 0.82, metalness = 0.04): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export function buildClayCottage(opts: CottageOptions): THREE.Group {
  const group = new THREE.Group();
  const { width, depth, wallHeight } = opts;

  const stoneMat = makeMat('#9B9284', 0.9, 0.02);
  const wallMat = makeMat(opts.wallColor, 0.82, 0.02);
  const trimMat = makeMat(opts.trimColor, 0.72, 0.05);
  const roofMat = opts.roofTex
    ? new THREE.MeshStandardMaterial({
        color: '#FFFFFF',
        map: opts.roofTex,
        roughness: 0.76,
        metalness: 0.04,
      })
    : makeMat(opts.roofColor, 0.76, 0.04);
  const doorMat = makeMat('#7B4E35', 0.7, 0.05);
  const brassMat = makeMat('#D9A543', 0.25, 0.85);

  // 1. Stone foundation plinth (grounded at y = 0)
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.45, 0.45, depth + 0.45),
    stoneMat,
  );
  plinth.position.y = 0.225;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  // 2. Main clay plaster cottage body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, wallHeight, depth),
    wallMat,
  );
  body.position.y = 0.45 + wallHeight / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // 3. Corner timber posts
  const postGeo = new THREE.BoxGeometry(0.24, wallHeight + 0.08, 0.24);
  const halfW = width / 2;
  const halfD = depth / 2;
  const corners = [
    [-halfW, -halfD],
    [halfW, -halfD],
    [-halfW, halfD],
    [halfW, halfD],
  ];
  for (const [cx, cz] of corners) {
    const post = new THREE.Mesh(postGeo, trimMat);
    post.position.set(cx, 0.45 + wallHeight / 2, cz);
    post.castShadow = true;
    group.add(post);
  }

  // 4. Beveled pitched gable roof via ExtrudeGeometry
  const roofH = 2.0;
  const overhang = 0.42;
  const shape = new THREE.Shape();
  shape.moveTo(-(halfW + overhang), 0);
  shape.lineTo(halfW + overhang, 0);
  shape.lineTo(0, roofH);
  shape.closePath();

  const roofGeo = new THREE.ExtrudeGeometry(shape, {
    depth: depth + overhang * 2,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.1,
    bevelSegments: 2,
  });
  roofGeo.translate(0, 0, -(depth + overhang * 2) / 2);
  const roofMesh = new THREE.Mesh(roofGeo, roofMat);
  roofMesh.position.y = 0.42 + wallHeight;
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  group.add(roofMesh);

  // Ridge beam accent
  const ridge = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.22, depth + overhang * 2 + 0.18),
    trimMat,
  );
  ridge.position.y = 0.45 + wallHeight + roofH + 0.06;
  group.add(ridge);

  // 5. Chimney stack + terracotta pot
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.9, 0.75), stoneMat);
  chimney.position.set(-halfW * 0.48, 0.45 + wallHeight + 1.0, -halfD * 0.35);
  chimney.castShadow = true;
  group.add(chimney);

  const chimneyRim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.22, 0.32, 8),
    makeMat('#C46748', 0.75, 0.05),
  );
  chimneyRim.position.set(-halfW * 0.48, 0.45 + wallHeight + 2.05, -halfD * 0.35);
  group.add(chimneyRim);

  // 6. Porch Door + Frame + Brass Knob
  const doorGroup = new THREE.Group();
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.35, 2.05, 0.18), trimMat);
  doorFrame.position.y = 1.02;
  doorGroup.add(doorFrame);

  const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.88, 0.22), doorMat);
  doorLeaf.position.y = 0.96;
  doorGroup.add(doorLeaf);

  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), brassMat);
  knob.position.set(0.32, 0.95, 0.14);
  doorGroup.add(knob);

  const step = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.24, 0.85), stoneMat);
  step.position.set(0, 0.12, 0.45);
  step.receiveShadow = true;
  doorGroup.add(step);

  if (opts.hasAwning) {
    const awningMat = makeMat(opts.awningColor ?? '#D86A50', 0.78, 0.02);
    const awning = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.14, 1.2), awningMat);
    awning.position.set(0, 2.38, 0.65);
    awning.rotation.x = 0.28;
    awning.castShadow = true;
    doorGroup.add(awning);
  }

  // Position door on requested side
  if (opts.doorSide === 'south') {
    doorGroup.position.set(0, 0.35, halfD + 0.05);
  } else if (opts.doorSide === 'north') {
    doorGroup.position.set(0, 0.35, -(halfD + 0.05));
    doorGroup.rotation.y = Math.PI;
  } else if (opts.doorSide === 'east') {
    doorGroup.position.set(halfW + 0.05, 0.35, 0);
    doorGroup.rotation.y = Math.PI / 2;
  } else {
    doorGroup.position.set(-(halfW + 0.05), 0.35, 0);
    doorGroup.rotation.y = -Math.PI / 2;
  }
  group.add(doorGroup);

  // 7. Glowing storybook windows + reactive window-box planters
  const winMat = new THREE.MeshStandardMaterial({
    color: '#FFF2C8',
    emissive: new THREE.Color('#FFBE55'),
    emissiveIntensity: 0.25,
    roughness: 0.18,
    metalness: 0.1,
  });
  opts.windowMaterials.push(winMat);

  const addWindow = (x: number, y: number, z: number, rotY: number) => {
    const wg = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.05, 0.14), trimMat);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.16), winMat);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.14, 0.35), trimMat);
    sill.position.y = -0.54;
    sill.position.z = 0.12;
    wg.add(frame, pane, sill);

    // Planter box + reactive blooms
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.26, 0.36), makeMat('#9E5B40', 0.85, 0.02));
    box.position.set(0, -0.7, 0.2);
    wg.add(box);

    const blooms = new THREE.Group();
    blooms.position.set(0, -0.52, 0.22);
    const flowerColors = ['#F28B82', '#FAD165', '#B59DF0', '#F7A9C4'];
    for (let i = -2; i <= 2; i++) {
      const bush = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.14, 0),
        makeMat('#5F8D54', 0.82, 0.02),
      );
      bush.position.set(i * 0.21, 0, 0);
      blooms.add(bush);
      const petal = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.09, 0),
        makeMat(flowerColors[(i + 2) % flowerColors.length], 0.6, 0.02),
      );
      petal.position.set(i * 0.21, 0.11, 0.03);
      blooms.add(petal);
    }
    opts.flowerGroups.push(blooms);
    wg.add(blooms);

    wg.position.set(x, y, z);
    wg.rotation.y = rotY;
    group.add(wg);
  };

  if (opts.doorSide !== 'south') addWindow(0, 1.9, halfD + 0.04, 0);
  if (opts.doorSide !== 'east') addWindow(halfW + 0.04, 1.9, 0, Math.PI / 2);
  if (opts.doorSide !== 'west') addWindow(-(halfW + 0.04), 1.9, 0, -Math.PI / 2);

  return group;
}

export function buildGreenhouse(windowMaterials: THREE.MeshStandardMaterial[]): THREE.Group {
  const group = new THREE.Group();
  const stoneMat = makeMat('#9B9284', 0.88, 0.02);
  const woodMat = makeMat('#E5DAC3', 0.72, 0.05);
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#CFE8E8',
    roughness: 0.12,
    metalness: 0.1,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });

  // Dwarf stone wall
  const base = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.9, 5.4), stoneMat);
  base.position.y = 0.45;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Glass enclosure
  const glassBox = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.2, 5.1), glassMat);
  glassBox.position.y = 2.0;
  group.add(glassBox);

  // Pitched glass roof
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-2.9, 0);
  roofShape.lineTo(2.9, 0);
  roofShape.lineTo(0, 1.55);
  roofShape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: 5.3, bevelEnabled: false });
  roofGeo.translate(0, 0, -2.65);
  const roofGlass = new THREE.Mesh(roofGeo, glassMat);
  roofGlass.position.y = 3.1;
  group.add(roofGlass);

  // Timber frame ribs
  for (let z = -2.5; z <= 2.51; z += 1.25) {
    const ribL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.3, 0.14), woodMat);
    ribL.position.set(-2.75, 2.0, z);
    const ribR = ribL.clone();
    ribR.position.x = 2.75;
    group.add(ribL, ribR);
  }
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 5.45), woodMat);
  ridge.position.y = 4.65;
  group.add(ridge);

  // Interior glowing seedling tables & terracotta pots
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.25, 3.4), makeMat('#8B6144', 0.8, 0.02));
  shelf.position.y = 1.1;
  group.add(shelf);

  const potColors = ['#E77C7C', '#F2BE54', '#9E8CE0', '#7BC490'];
  for (let i = 0; i < 6; i++) {
    const px = -1.2 + (i % 3) * 1.2;
    const pz = i < 3 ? -0.8 : 0.8;
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.18, 0.34, 8),
      makeMat('#C46748', 0.82, 0.02),
    );
    pot.position.set(px, 1.38, pz);
    const bloom = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.24, 0),
      makeMat(potColors[i % potColors.length], 0.65, 0.02),
    );
    bloom.position.set(px, 1.66, pz);
    group.add(pot, bloom);
  }

  // Warm interior lantern pane
  const warmBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 10),
    new THREE.MeshStandardMaterial({
      color: '#FFF1BD',
      emissive: '#FFB347',
      emissiveIntensity: 0.4,
      roughness: 0.2,
    }),
  );
  warmBulb.position.set(0, 3.2, 0);
  windowMaterials.push(warmBulb.material);
  group.add(warmBulb);

  return group;
}

export interface GazeboRig {
  group: THREE.Group;
  bellPivot: THREE.Group;
  bellMesh: THREE.Mesh;
  clapperMesh: THREE.Mesh;
  ivyGroup: THREE.Group;
  ribbonMesh: THREE.Mesh;
}

export function buildOldBellGazebo(): GazeboRig {
  const group = new THREE.Group();
  const stoneMat = makeMat('#A9A092', 0.88, 0.02);
  const cedarMat = makeMat('#8D5D3E', 0.78, 0.04);
  const roofMat = makeMat('#5D7B63', 0.75, 0.05);
  const brassMat = new THREE.MeshStandardMaterial({
    color: '#DFA844',
    roughness: 0.25,
    metalness: 0.86,
  });

  // Octagonal raised stone dais
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.95, 0.55, 8), stoneMat);
  dais.position.y = 0.275;
  dais.receiveShadow = true;
  dais.castShadow = true;
  group.add(dais);

  // 6 cedar columns
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 3.7, 8), cedarMat);
    col.position.set(Math.cos(angle) * 2.1, 2.35, Math.sin(angle) * 2.1);
    col.castShadow = true;
    group.add(col);
  }

  // Ring beam & spire roof
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.35, 0.28, 8), cedarMat);
  beam.position.y = 4.22;
  group.add(beam);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.05, 2.25, 8), roofMat);
  roof.position.y = 5.45;
  roof.castShadow = true;
  group.add(roof);

  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), brassMat);
  finial.position.y = 6.65;
  group.add(finial);

  // Hanging Brass Bell (LatheGeometry silhouette clearly visible beneath eaves)
  const bellPivot = new THREE.Group();
  bellPivot.position.set(0, 4.05, 0);

  const bellPoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.54, 0.0),
    new THREE.Vector2(0.46, 0.2),
    new THREE.Vector2(0.36, 0.65),
    new THREE.Vector2(0.28, 0.9),
    new THREE.Vector2(0.0, 0.98),
  ];
  const bellGeo = new THREE.LatheGeometry(bellPoints, 16);
  bellGeo.translate(0, -1.32, 0);
  const bellMesh = new THREE.Mesh(bellGeo, brassMat);
  bellMesh.castShadow = true;
  bellPivot.add(bellMesh);

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 6), brassMat);
  rod.position.y = -0.22;
  bellPivot.add(rod);

  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), brassMat);
  clapper.position.y = -1.34;
  clapper.visible = false;
  bellPivot.add(clapper);

  const rope = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6),
    makeMat('#D8C7A4', 0.9, 0),
  );
  rope.position.set(0.26, -1.9, 0);
  bellPivot.add(rope);
  group.add(bellPivot);

  // Creeping Ivy Group (toggled off once Barnaby's ladder clears it)
  const ivyGroup = new THREE.Group();
  const ivyMat = makeMat('#486F45', 0.84, 0.02);
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2;
    const tuft = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32 + (i % 3) * 0.08, 0), ivyMat);
    tuft.position.set(Math.cos(angle) * 2.15, 3.7 + (i % 3) * 0.35, Math.sin(angle) * 2.15);
    ivyGroup.add(tuft);
  }
  group.add(ivyGroup);

  // Nora's Marigold Festival Ribbon (visible when reconciled)
  const ribbonMesh = new THREE.Mesh(
    new THREE.TorusGeometry(2.22, 0.07, 6, 18),
    makeMat('#EFA93B', 0.5, 0.1),
  );
  ribbonMesh.rotation.x = Math.PI / 2;
  ribbonMesh.position.y = 4.05;
  ribbonMesh.visible = false;
  group.add(ribbonMesh);

  return { group, bellPivot, bellMesh, clapperMesh: clapper, ivyGroup, ribbonMesh };
}

export interface FountainRig {
  group: THREE.Group;
  waterMesh: THREE.Mesh;
  spoutParticles: THREE.Group;
}

export function buildStoneFountain(): FountainRig {
  const group = new THREE.Group();
  const stoneMat = makeMat('#ADA394', 0.88, 0.02);
  const dryBedMat = makeMat('#8E8475', 0.93, 0.0);
  const bronzeMat = makeMat('#7B6648', 0.45, 0.65);

  const basinProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(2.35, 0.0),
    new THREE.Vector2(2.2, 0.65),
    new THREE.Vector2(1.9, 0.65),
    new THREE.Vector2(1.88, 0.44),
    new THREE.Vector2(0.0, 0.44),
  ];
  const basin = new THREE.Mesh(new THREE.LatheGeometry(basinProfile, 16), stoneMat);
  basin.castShadow = true;
  basin.receiveShadow = true;
  group.add(basin);

  const innerRim = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.18, 8, 20), stoneMat);
  innerRim.rotation.x = Math.PI / 2;
  innerRim.position.y = 0.66;
  group.add(innerRim);

  const dryFloor = new THREE.Mesh(new THREE.CircleGeometry(1.89, 18), dryBedMat);
  dryFloor.rotation.x = -Math.PI / 2;
  dryFloor.position.y = 0.46;
  dryFloor.receiveShadow = true;
  group.add(dryFloor);

  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.48, 1.35, 10), stoneMat);
  pillar.position.y = 1.05;
  pillar.castShadow = true;
  group.add(pillar);

  const topBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.35, 0.35, 12), stoneMat);
  topBowl.position.y = 1.65;
  group.add(topBowl);

  const spout = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.42, 8), bronzeMat);
  spout.position.y = 1.98;
  group.add(spout);

  const waterMesh = new THREE.Mesh(
    new THREE.CircleGeometry(1.92, 18),
    new THREE.MeshStandardMaterial({
      color: '#6AB7C4',
      roughness: 0.14,
      metalness: 0.15,
      transparent: true,
      opacity: 0.86,
    }),
  );
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.y = 0.58;

  const ripple = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 0.76, 22),
    new THREE.MeshBasicMaterial({
      color: '#D2F3F8',
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  ripple.position.z = 0.012;
  waterMesh.add(ripple);

  waterMesh.visible = false;
  group.add(waterMesh);

  const spoutParticles = new THREE.Group();
  const dropMat = makeMat('#BBE8F0', 0.15, 0.1);
  for (let i = 0; i < 8; i++) {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), dropMat);
    drop.userData.phase = (i / 8) * Math.PI * 2;
    spoutParticles.add(drop);
  }
  spoutParticles.visible = false;
  group.add(spoutParticles);

  return { group, waterMesh, spoutParticles };
}

export interface CharacterRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  headGroup: THREE.Group;
  ringMesh: THREE.Mesh;
  questPip: THREE.Mesh;
}

export function buildClayCharacter(
  appearance: ResidentAppearance,
  shadowTex: THREE.Texture,
): CharacterRig {
  const root = new THREE.Group();
  const s = appearance.heightScale;

  // Ground contact shadow disc
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.54, 16),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  root.add(shadow);

  // Subtle selection/nearby ring (hidden until targeted/nearby)
  const ringMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.68, 24),
    new THREE.MeshBasicMaterial({
      color: '#E5A93C',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
  );
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.y = 0.04;
  ringMesh.visible = false;
  root.add(ringMesh);

  const bodyGroup = new THREE.Group();
  bodyGroup.scale.setScalar(s);
  root.add(bodyGroup);

  const bootMat = makeMat('#4A382E', 0.8, 0.04);
  const coatMat = makeMat(appearance.coatColor, 0.78, 0.03);
  const shirtMat = makeMat(appearance.shirtColor, 0.82, 0.02);
  const skinMat = makeMat(appearance.skinColor, 0.72, 0.02);
  const hairMat = makeMat(appearance.hairColor, 0.8, 0.04);
  const accentMat = makeMat(appearance.accentColor, 0.65, 0.08);
  const eyeMat = makeMat('#241D18', 0.2, 0.1);

  // Legs
  const legGeo = new THREE.CapsuleGeometry(0.11, 0.24, 4, 8);
  const leftLeg = new THREE.Mesh(legGeo, bootMat);
  leftLeg.position.set(-0.14, 0.24, 0);
  leftLeg.castShadow = true;
  const rightLeg = new THREE.Mesh(legGeo, bootMat);
  rightLeg.position.set(0.14, 0.24, 0);
  rightLeg.castShadow = true;
  bodyGroup.add(leftLeg, rightLeg);

  // Torso Coat + Collar
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 0.62, 10), coatMat);
  torso.position.y = 0.72;
  torso.castShadow = true;
  bodyGroup.add(torso);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 6, 12), accentMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.02;
  bodyGroup.add(collar);

  // Arms
  const armGeo = new THREE.CapsuleGeometry(0.085, 0.3, 4, 8);
  const leftArm = new THREE.Mesh(armGeo, coatMat);
  leftArm.position.set(-0.32, 0.74, 0);
  leftArm.castShadow = true;
  const rightArm = new THREE.Mesh(armGeo, coatMat);
  rightArm.position.set(0.32, 0.74, 0);
  rightArm.castShadow = true;
  bodyGroup.add(leftArm, rightArm);

  // Head + Hair + Hat + Eyes
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.32, 0);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), skinMat);
  head.castShadow = true;
  headGroup.add(head);

  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.295, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hairMat,
  );
  hairCap.rotation.x = -0.25;
  headGroup.add(hairCap);

  // Button eyes facing +Z
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.036, 6, 6), eyeMat);
  eyeL.position.set(-0.1, 0.02, 0.25);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.1;
  headGroup.add(eyeL, eyeR);

  // Hat styles
  if (appearance.hatStyle === 'beret') {
    const beret = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.12, 10), accentMat);
    beret.position.set(0.04, 0.26, -0.02);
    beret.rotation.z = -0.18;
    headGroup.add(beret);
  } else if (appearance.hatStyle === 'straw') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.05, 14), makeMat('#E5C97B', 0.85, 0));
    brim.position.y = 0.22;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.18, 12), makeMat('#E5C97B', 0.85, 0));
    crown.position.y = 0.32;
    headGroup.add(brim, crown);
  } else if (appearance.hatStyle === 'cap') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), accentMat);
    dome.position.y = 0.08;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.22), accentMat);
    visor.position.set(0, 0.14, 0.24);
    headGroup.add(dome, visor);
  } else if (appearance.hatStyle === 'bun') {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), hairMat);
    bun.position.set(0, 0.24, -0.2);
    headGroup.add(bun);
  } else if (appearance.hatStyle === 'hood') {
    const hood = new THREE.Mesh(new THREE.DodecahedronGeometry(0.31, 0), coatMat);
    hood.position.set(0, 0.04, -0.06);
    headGroup.add(hood);
  }

  bodyGroup.add(headGroup);

  // Character props
  if (appearance.propType === 'satchel') {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.26), makeMat('#8B5B38', 0.8, 0.05));
    bag.position.set(-0.34, 0.56, 0.05);
    bodyGroup.add(bag);
  } else if (appearance.propType === 'watering_can') {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.24, 8), makeMat('#6EA6B5', 0.35, 0.5));
    can.position.set(0.36, 0.52, 0.12);
    bodyGroup.add(can);
  } else if (appearance.propType === 'violin') {
    const caseMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.32, 4, 6), makeMat('#7A442E', 0.6, 0.1));
    caseMesh.position.set(-0.22, 0.78, -0.26);
    caseMesh.rotation.z = 0.35;
    bodyGroup.add(caseMesh);
  } else if (appearance.propType === 'book' || appearance.propType === 'sketchbook') {
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.3), shirtMat);
    book.position.set(0.28, 0.64, 0.18);
    book.rotation.y = 0.3;
    bodyGroup.add(book);
  } else if (appearance.propType === 'loaf') {
    const loaf = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.22, 4, 6), makeMat('#D99A4E', 0.85, 0));
    loaf.rotation.z = Math.PI / 2;
    loaf.position.set(0.22, 0.68, 0.26);
    bodyGroup.add(loaf);
  }

  // Story quest indicator diamond overhead
  const questPip = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.14, 0),
    new THREE.MeshStandardMaterial({
      color: '#FFD466',
      emissive: '#E59A28',
      emissiveIntensity: 0.5,
      roughness: 0.25,
    }),
  );
  questPip.position.set(0, 2.05 * s, 0);
  questPip.visible = false;
  root.add(questPip);

  return {
    root,
    bodyGroup,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    headGroup,
    ringMesh,
    questPip,
  };
}
