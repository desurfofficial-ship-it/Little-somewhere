import * as THREE from 'three';
import { ResidentAppearance } from '../../game/types';
import { CharacterRig } from '../models';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';

export interface WillowCottageRig {
  group: THREE.Group;
  smokePuffs: THREE.Mesh[];
  lanternMesh: THREE.Mesh;
}

export interface WillowMailboxRig {
  group: THREE.Group;
  flagMesh: THREE.Mesh;
}

export interface WillowCourtyardRig {
  group: THREE.Group;
  swayClusters: THREE.Group[];
  lanternGlowMeshes: THREE.Mesh[];
}

export interface WillowPrototypeContext {
  palette: MaterialPalette;
  shadowTex: THREE.Texture;
  terracottaRoofTex: THREE.Texture;
  windowMaterials: THREE.MeshStandardMaterial[];
  lanternMaterials: THREE.MeshStandardMaterial[];
  flowerGroups: THREE.Group[];
}

function addContactShadow(
  parent: THREE.Object3D,
  shadowTex: THREE.Texture,
  width: number,
  depth: number,
  opacity = 0.5,
  y = 0.018,
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(width, depth);
  const mat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  parent.add(mesh);
  return mesh;
}

function makeFlowerTuft(
  palette: MaterialPalette,
  petalHex: string,
  scale = 1,
): THREE.Group {
  const g = new THREE.Group();
  const leafMat = palette.standard(STORYBOOK_PALETTE.foliageMid, 0.86, 0.0);
  const petalMat = palette.standard(petalHex, 0.62, 0.02);
  const centerMat = palette.standard(STORYBOOK_PALETTE.petalMarigold, 0.55, 0.04);

  const leafA = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11 * scale, 0), leafMat);
  leafA.scale.set(1.25, 0.65, 1.15);
  leafA.position.set(0, 0.05 * scale, 0);
  g.add(leafA);

  const budCount = 3;
  for (let i = 0; i < budCount; i++) {
    const a = (i / budCount) * Math.PI * 2 + 0.4;
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.065 * scale, 0), petalMat);
    head.scale.set(1.1, 0.72, 1.1);
    head.position.set(Math.cos(a) * 0.075 * scale, (0.12 + (i % 2) * 0.03) * scale, Math.sin(a) * 0.075 * scale);
    g.add(head);
  }

  const center = new THREE.Mesh(new THREE.SphereGeometry(0.032 * scale, 6, 6), centerMat);
  center.position.set(0, 0.14 * scale, 0);
  g.add(center);

  return g;
}

function makeCloverPatch(palette: MaterialPalette, radius = 0.24, count = 4): THREE.Group {
  const g = new THREE.Group();
  const matA = palette.standard(STORYBOOK_PALETTE.moss, 0.88, 0.0);
  const matB = palette.standard(STORYBOOK_PALETTE.foliageSun, 0.86, 0.0);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + 0.35;
    const r = (i % 2 === 0 ? 0.45 : 0.78) * radius;
    const lobe = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.085 + (i % 2) * 0.025, 0),
      i % 2 === 0 ? matA : matB,
    );
    lobe.scale.set(1.25, 0.55, 1.15);
    lobe.position.set(Math.cos(angle) * r, 0.035, Math.sin(angle) * r);
    lobe.rotation.y = angle;
    g.add(lobe);
  }
  return g;
}

/**
 * 1. HERO BUILDING PROTOTYPE: Willow Step Cottage
 * Fits cleanly inside BOX_OBSTACLES['player_cottage'] (7.4 x 6.4 centered at (-14.5, 10.0)).
 */
export function buildWillowStepCottage(ctx: WillowPrototypeContext): WillowCottageRig {
  const { palette, shadowTex, terracottaRoofTex, windowMaterials, lanternMaterials, flowerGroups } = ctx;
  const group = new THREE.Group();

  const stoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.9, 0.02);
  const darkStoneMat = palette.standard(STORYBOOK_PALETTE.fieldstoneDark, 0.92, 0.02);
  const plasterMat = palette.standard(STORYBOOK_PALETTE.warmPlaster, 0.86, 0.01);
  const creamTrimMat = palette.standard(STORYBOOK_PALETTE.creamTrim, 0.78, 0.02);
  const cedarDarkMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.76, 0.04);
  const cedarWarmMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.74, 0.04);
  const doorMat = palette.standard(STORYBOOK_PALETTE.doorCedar, 0.7, 0.05);
  const shutterMat = palette.standard(STORYBOOK_PALETTE.sageShutter, 0.74, 0.03);
  const potMat = palette.standard(STORYBOOK_PALETTE.terracottaPot, 0.44, 0.04);
  const ceramicMat = palette.standard(STORYBOOK_PALETTE.ceramicCream, 0.38, 0.05);
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.24, 0.86);
  const ironMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.42, 0.72);
  const roofMat = palette.get('willow_terracotta_roof', {
    color: '#FFFFFF',
    roughness: 0.76,
    metalness: 0.03,
  });
  if (!roofMat.map) {
    roofMat.map = terracottaRoofTex;
    roofMat.needsUpdate = true;
  }

  const winMat = new THREE.MeshStandardMaterial({
    color: '#D9AE6C',
    emissive: new THREE.Color('#FF9F38'),
    emissiveIntensity: 0.22,
    roughness: 0.16,
    metalness: 0.08,
  });
  windowMaterials.push(winMat);

  const porchLanternMat = new THREE.MeshStandardMaterial({
    color: '#FFE9AF',
    emissive: new THREE.Color('#FFAB3B'),
    emissiveIntensity: 0.25,
    roughness: 0.18,
    metalness: 0.05,
  });
  lanternMaterials.push(porchLanternMat);

  // Soft AO shadow skirt covering cottage + covered porch (effective in software GL too)
  addContactShadow(group, shadowTex, 8.6, 7.2, 0.52, 0.016);

  // Main cottage mass shifted slightly west (-0.65) to house a true 1.45m East covered porch
  const wallCenterX = -0.65;
  const wallW = 5.0;
  const wallD = 4.9;
  const wallH = 2.45;
  const plinthH = 0.44;

  // 1. Stepped stone foundation plinth
  const lowerFoot = new THREE.Mesh(
    new THREE.BoxGeometry(wallW + 0.56, 0.22, wallD + 0.56),
    darkStoneMat,
  );
  lowerFoot.position.set(wallCenterX, 0.11, 0);
  lowerFoot.receiveShadow = true;
  group.add(lowerFoot);

  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(wallW + 0.34, 0.24, wallD + 0.34),
    stoneMat,
  );
  plinth.position.set(wallCenterX, 0.32, 0);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  // 2. Main lime-plaster walls + horizontal timber sill beam
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(wallW, wallH, wallD),
    plasterMat,
  );
  body.position.set(wallCenterX, plinthH + wallH / 2, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const sillBand = new THREE.Mesh(
    new THREE.BoxGeometry(wallW + 0.14, 0.14, wallD + 0.14),
    cedarDarkMat,
  );
  sillBand.position.set(wallCenterX, plinthH + 0.05, 0);
  group.add(sillBand);

  // Corner timber posts + chamfered stone corner quoins
  const halfW = wallW / 2;
  const halfD = wallD / 2;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, wallH + 0.08, 0.24),
        cedarDarkMat,
      );
      post.position.set(wallCenterX + sx * halfW, plinthH + wallH / 2, sz * halfD);
      post.castShadow = true;
      group.add(post);

      // Stepped stone corner quoin block
      const quoin = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.38, 0.32),
        stoneMat,
      );
      quoin.position.set(wallCenterX + sx * halfW, plinthH + 0.24, sz * halfD);
      group.add(quoin);
    }
  }

  // 3. Beveled pitched gable roof (ridge along Z so terracotta slope faces East courtyard)
  const roofBaseY = plinthH + wallH - 0.04;
  const roofH = 1.98;
  const overhangX = 0.44;
  const overhangZ = 0.44;
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-(halfW + overhangX), 0);
  gableShape.lineTo(halfW + overhangX, 0);
  gableShape.lineTo(0, roofH);
  gableShape.closePath();

  const roofGeo = new THREE.ExtrudeGeometry(gableShape, {
    depth: wallD + overhangZ * 2,
    bevelEnabled: true,
    bevelThickness: 0.09,
    bevelSize: 0.09,
    bevelSegments: 2,
  });
  roofGeo.translate(0, 0, -(wallD + overhangZ * 2) / 2);
  const mainRoof = new THREE.Mesh(roofGeo, roofMat);
  mainRoof.position.set(wallCenterX, roofBaseY, 0);
  mainRoof.castShadow = true;
  mainRoof.receiveShadow = true;
  group.add(mainRoof);

  // Plaster gable wall infill triangles (clean joinery beneath bargeboards)
  const infillShape = new THREE.Shape();
  infillShape.moveTo(-halfW, 0);
  infillShape.lineTo(halfW, 0);
  infillShape.lineTo(0, roofH - 0.14);
  infillShape.closePath();
  const infillGeo = new THREE.ExtrudeGeometry(infillShape, {
    depth: wallD - 0.02,
    bevelEnabled: false,
  });
  infillGeo.translate(0, 0, -(wallD - 0.02) / 2);
  const gableInfill = new THREE.Mesh(infillGeo, plasterMat);
  gableInfill.position.set(wallCenterX, roofBaseY + 0.02, 0);
  group.add(gableInfill);

  // Cream fascia bargeboards on North & South gable faces + cedar ridge beam + finial
  const slopeLen = Math.hypot(halfW + overhangX, roofH) + 0.16;
  const slopeAngle = Math.atan2(roofH, halfW + overhangX);
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const barge = new THREE.Mesh(
        new THREE.BoxGeometry(slopeLen, 0.16, 0.12),
        creamTrimMat,
      );
      barge.position.set(
        wallCenterX + sx * (halfW + overhangX) * 0.5,
        roofBaseY + roofH * 0.5 + 0.08,
        sz * (halfD + overhangZ + 0.06),
      );
      barge.rotation.z = -sx * slopeAngle;
      group.add(barge);
    }
  }

  const ridgeBeam = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.22, wallD + overhangZ * 2 + 0.26),
    cedarDarkMat,
  );
  ridgeBeam.position.set(wallCenterX, roofBaseY + roofH + 0.06, 0);
  group.add(ridgeBeam);

  // Turned wooden gable finials
  for (const sz of [-1, 1]) {
    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.09, 0.42, 8),
      creamTrimMat,
    );
    spire.position.set(wallCenterX, roofBaseY + roofH + 0.22, sz * (halfD + overhangZ + 0.08));
    const capBall = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), brassMat);
    capBall.position.set(wallCenterX, roofBaseY + roofH + 0.45, sz * (halfD + overhangZ + 0.08));
    group.add(spire, capBall);
  }

  // 4. East Slope Storybook Dormer Window
  const dormerGroup = new THREE.Group();
  dormerGroup.position.set(wallCenterX + 1.22, roofBaseY + 0.76, -0.32);
  const dormerBox = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.88, 1.04), plasterMat);
  dormerBox.castShadow = true;
  dormerGroup.add(dormerBox);

  const dRoofShape = new THREE.Shape();
  dRoofShape.moveTo(-0.66, 0);
  dRoofShape.lineTo(0.66, 0);
  dRoofShape.lineTo(0, 0.56);
  dRoofShape.closePath();
  const dRoofGeo = new THREE.ExtrudeGeometry(dRoofShape, {
    depth: 1.42,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 1,
  });
  dRoofGeo.rotateY(Math.PI / 2);
  dRoofGeo.translate(-0.71, 0.44, 0);
  const dormerRoof = new THREE.Mesh(dRoofGeo, roofMat);
  dormerRoof.castShadow = true;
  dormerGroup.add(dormerRoof);

  const dFrame = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.66, 0.66), cedarDarkMat);
  dFrame.position.set(0.58, 0.04, 0);
  const dPane = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.48, 0.48), winMat);
  dPane.position.set(0.58, 0.04, 0);
  const dMullionV = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.05), creamTrimMat);
  dMullionV.position.set(0.58, 0.04, 0);
  const dMullionH = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.5), creamTrimMat);
  dMullionH.position.set(0.58, 0.04, 0);
  dormerGroup.add(dFrame, dPane, dMullionV, dMullionH);
  group.add(dormerGroup);

  // 5. Tapered Fieldstone Chimney + Terracotta Chimney Pot + Pooled Smoke Puffs
  const chimX = wallCenterX - 1.35;
  const chimZ = 1.25;
  const chimBase = new THREE.Mesh(new THREE.BoxGeometry(0.92, 2.35, 0.92), darkStoneMat);
  chimBase.position.set(chimX, roofBaseY - 0.1, chimZ);
  chimBase.castShadow = true;
  const chimShaft = new THREE.Mesh(new THREE.BoxGeometry(0.74, 1.45, 0.74), stoneMat);
  chimShaft.position.set(chimX, roofBaseY + 1.55, chimZ);
  chimShaft.castShadow = true;
  const chimCrown = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.18, 0.86), darkStoneMat);
  chimCrown.position.set(chimX, roofBaseY + 2.28, chimZ);
  const chimPot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.25, 0.42, 8),
    potMat,
  );
  chimPot.position.set(chimX, roofBaseY + 2.55, chimZ);
  group.add(chimBase, chimShaft, chimCrown, chimPot);

  const smokeMat = palette.get('willow_chimney_smoke', {
    color: '#F7F1E5',
    roughness: 0.95,
    metalness: 0,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  const smokeGeo = new THREE.DodecahedronGeometry(0.18, 0);
  const smokePuffs: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const puff = new THREE.Mesh(smokeGeo, smokeMat);
    puff.userData.originX = chimX;
    puff.userData.originY = roofBaseY + 2.85;
    puff.userData.originZ = chimZ;
    puff.userData.phase = i * 0.25;
    puff.position.set(chimX, roofBaseY + 2.85 + i * 0.45, chimZ);
    group.add(puff);
    smokePuffs.push(puff);
  }

  // 6. Covered East Timber Porch (Supported on Stone Piers — Zero Floating Geometry!)
  const porchStartX = wallCenterX + halfW; // +1.85
  const porchDepth = 1.48;
  const porchWidthZ = 4.4;
  const porchEndX = porchStartX + porchDepth; // +3.33 (world x = -11.17)
  const deckY = 0.42;

  const porchFoundation = new THREE.Mesh(
    new THREE.BoxGeometry(porchDepth + 0.12, 0.28, porchWidthZ + 0.14),
    darkStoneMat,
  );
  porchFoundation.position.set(porchStartX + porchDepth / 2, 0.14, 0);
  porchFoundation.receiveShadow = true;
  group.add(porchFoundation);

  const porchDeck = new THREE.Mesh(
    new THREE.BoxGeometry(porchDepth + 0.08, 0.14, porchWidthZ),
    cedarWarmMat,
  );
  porchDeck.position.set(porchStartX + porchDepth / 2, deckY - 0.07, 0);
  porchDeck.castShadow = true;
  porchDeck.receiveShadow = true;
  group.add(porchDeck);

  // Wide chamfered stone entrance step leading cleanly toward (-10.3, 10.0)
  const stepStone = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.24, 1.75),
    stoneMat,
  );
  stepStone.position.set(porchEndX + 0.22, 0.12, 0);
  stepStone.castShadow = true;
  stepStone.receiveShadow = true;
  group.add(stepStone);

  // Woven doormat on deck outside front door
  const doormat = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.04, 0.98),
    palette.standard('#B46A48', 0.92, 0.0),
  );
  doormat.position.set(porchStartX + 0.45, deckY + 0.02, 0);
  group.add(doormat);

  // Sloped shingled porch roof + beam + 4 solid posts resting on carved stone pads
  const porchRoofGroup = new THREE.Group();
  const porchRoofSlab = new THREE.Mesh(
    new THREE.BoxGeometry(porchDepth + 0.46, 0.14, porchWidthZ + 0.36),
    roofMat,
  );
  porchRoofSlab.position.set(porchStartX + porchDepth / 2 + 0.08, 2.66, 0);
  porchRoofSlab.rotation.z = -0.26;
  porchRoofSlab.castShadow = true;
  porchRoofSlab.receiveShadow = true;
  porchRoofGroup.add(porchRoofSlab);

  const porchHeaderBeam = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.18, porchWidthZ + 0.16),
    cedarDarkMat,
  );
  porchHeaderBeam.position.set(porchEndX - 0.1, 2.38, 0);
  porchRoofGroup.add(porchHeaderBeam);

  const porchFascia = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.14, porchWidthZ + 0.4),
    creamTrimMat,
  );
  porchFascia.position.set(porchEndX + 0.28, 2.47, 0);
  porchRoofGroup.add(porchFascia);

  // 4 porch posts with stone pads & angled knee braces
  const postZs = [-2.02, -0.78, 0.78, 2.02];
  const postX = porchEndX - 0.1;
  const postHeight = 1.92;
  for (const pz of postZs) {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.26), stoneMat);
    pad.position.set(postX, deckY + 0.07, pz);
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.095, postHeight, 8),
      creamTrimMat,
    );
    post.position.set(postX, deckY + 0.14 + postHeight / 2, pz);
    post.castShadow = true;
    porchRoofGroup.add(pad, post);

    // Side eaves rafter bracket connecting post back to cottage wall
    const rafter = new THREE.Mesh(
      new THREE.BoxGeometry(porchDepth, 0.1, 0.1),
      cedarDarkMat,
    );
    rafter.position.set(porchStartX + porchDepth / 2, 2.48, pz);
    rafter.rotation.z = -0.22;
    porchRoofGroup.add(rafter);
  }
  group.add(porchRoofGroup);

  // Low porch railing flanking the stairs (leaves center doorway open)
  for (const sz of [-1, 1]) {
    const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 1.24), creamTrimMat);
    railTop.position.set(postX, deckY + 0.72, sz * 1.4);
    group.add(railTop);
    for (let b = 0; b < 3; b++) {
      const baluster = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.62, 0.06),
        creamTrimMat,
      );
      baluster.position.set(postX, deckY + 0.38, sz * (1.02 + b * 0.36));
      group.add(baluster);
    }
  }

  // Hanging Brass Porch Lantern (mounted cleanly on doorway post bracket)
  const lanternBracket = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.06), ironMat);
  lanternBracket.position.set(postX + 0.14, 2.18, -0.78);
  const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.1, 6), ironMat);
  lanternCap.position.set(postX + 0.22, 2.02, -0.78);
  const lanternMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.07, 0.18, 6),
    porchLanternMat,
  );
  lanternMesh.position.set(postX + 0.22, 1.88, -0.78);
  const lanternBase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.05, 0.05, 6), ironMat);
  lanternBase.position.set(postX + 0.22, 1.76, -0.78);
  group.add(lanternBracket, lanternCap, lanternMesh, lanternBase);

  // Recessed Paneled Cedar Door + Glazed Upper Light + Brass Knob
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.98, 1.24), creamTrimMat);
  doorFrame.position.set(porchStartX + 0.02, deckY + 0.99, 0);
  const doorLeaf = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.84, 0.96), doorMat);
  doorLeaf.position.set(porchStartX + 0.03, deckY + 0.92, 0);
  const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.44, 0.46), winMat);
  doorGlass.position.set(porchStartX + 0.03, deckY + 1.32, 0);
  const doorHandle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), brassMat);
  doorHandle.position.set(porchStartX + 0.14, deckY + 0.9, 0.32);
  group.add(doorFrame, doorLeaf, doorGlass, doorHandle);

  // Porch Micro-Storytelling Props: Slatted Wooden Bench + Sage Throw + Tea Mug
  const benchGroup = new THREE.Group();
  benchGroup.position.set(porchStartX + 0.56, deckY, 1.44);
  for (const bz of [-0.4, 0.4]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.08), cedarDarkMat);
    leg.position.set(0, 0.17, bz);
    benchGroup.add(leg);
  }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.96), cedarWarmMat);
  seat.position.set(0, 0.36, 0);
  const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.36, 0.96), cedarWarmMat);
  backrest.position.set(-0.17, 0.58, 0);
  const foldedThrow = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.08, 0.38),
    palette.standard('#6C8D6F', 0.9, 0),
  );
  foldedThrow.position.set(0.02, 0.43, 0.22);
  const ceramicMug = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.048, 0.1, 8), ceramicMat);
  ceramicMug.position.set(0.04, 0.44, -0.24);
  benchGroup.add(seat, backrest, foldedThrow, ceramicMug);
  group.add(benchGroup);

  // Potted porch marigold on north side of deck
  const porchPot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.13, 0.28, 8), potMat);
  porchPot.position.set(porchStartX + 0.52, deckY + 0.14, -1.46);
  const porchBloom = makeFlowerTuft(palette, STORYBOOK_PALETTE.petalMarigold, 1.15);
  porchBloom.position.set(porchStartX + 0.52, deckY + 0.28, -1.46);
  group.add(porchPot, porchBloom);

  // 7. Recessed Shuttered Windows + Muntins + Blooming Window Planter Boxes
  const addStorybookWindow = (
    wx: number,
    wy: number,
    wz: number,
    rotY: number,
    withShutters: boolean,
    withFlowerBox: boolean,
  ) => {
    const wg = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.08, 1.08, 0.14), cedarDarkMat);
    const innerSash = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.88, 0.15), creamTrimMat);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.76, 0.16), winMat);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.78, 0.18), creamTrimMat);
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.06, 0.18), creamTrimMat);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.12, 0.28), cedarDarkMat);
    sill.position.set(0, -0.54, 0.1);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.12, 0.22), cedarDarkMat);
    lintel.position.set(0, 0.56, 0.06);
    wg.add(frame, innerSash, pane, crossV, crossH, sill, lintel);

    if (withShutters) {
      for (const side of [-1, 1]) {
        const shutter = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.94, 0.08), shutterMat);
        shutter.position.set(side * 0.72, 0, 0.04);
        shutter.rotation.y = -side * 0.14;
        wg.add(shutter);
      }
    }

    if (withFlowerBox) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.24, 0.34), potMat);
      box.position.set(0, -0.7, 0.18);
      wg.add(box);

      const blooms = new THREE.Group();
      blooms.position.set(0, -0.56, 0.2);
      const colors = [
        STORYBOOK_PALETTE.petalRose,
        STORYBOOK_PALETTE.petalMarigold,
        STORYBOOK_PALETTE.petalLavender,
        STORYBOOK_PALETTE.petalCream,
      ];
      for (let i = -2; i <= 2; i++) {
        const tuft = makeFlowerTuft(palette, colors[(i + 2) % colors.length], 0.88);
        tuft.position.set(i * 0.21, 0, 0);
        blooms.add(tuft);
      }
      flowerGroups.push(blooms);
      wg.add(blooms);
    }

    wg.position.set(wx, wy, wz);
    wg.rotation.y = rotY;
    group.add(wg);
  };

  // South wall (facing foreground-left camera!): two shuttered windows + flower boxes
  addStorybookWindow(wallCenterX - 1.05, 1.72, halfD + 0.02, 0, true, true);
  addStorybookWindow(wallCenterX + 1.05, 1.72, halfD + 0.02, 0, true, true);
  // East wall porch windows flanking door
  addStorybookWindow(porchStartX + 0.02, 1.72, -1.45, Math.PI / 2, false, false);
  addStorybookWindow(porchStartX + 0.02, 1.72, 1.45, Math.PI / 2, false, false);
  // West wall window
  addStorybookWindow(wallCenterX - halfW - 0.02, 1.72, 0, -Math.PI / 2, true, true);

  // 8. South-Eave Story Vignette (Inside collision footprint z <= 3.12):
  // Stacked firewood rack + cedar rainwater barrel + flowerbed border
  const woodRack = new THREE.Group();
  woodRack.position.set(wallCenterX - 1.55, 0, halfD + 0.42);
  const rackBase = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.44), cedarDarkMat);
  rackBase.position.y = 0.04;
  woodRack.add(rackBase);
  const logBarkMat = palette.standard(STORYBOOK_PALETTE.oakBark, 0.88, 0.0);
  const logCutMat = palette.standard('#DFC69D', 0.84, 0.0);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4 - row; col++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.09, 0.44, 7), logBarkMat);
      log.rotation.x = Math.PI / 2;
      log.position.set(-0.34 + row * 0.11 + col * 0.22, 0.16 + row * 0.14, 0);
      const cut = new THREE.Mesh(new THREE.CircleGeometry(0.072, 7), logCutMat);
      cut.position.set(log.position.x, log.position.y, 0.225);
      woodRack.add(log, cut);
    }
  }
  group.add(woodRack);

  // Cedar rainwater barrel by South-East wall corner
  const barrel = new THREE.Group();
  barrel.position.set(wallCenterX + 2.02, 0, halfD + 0.38);
  const barrelBody = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.72, 10), cedarWarmMat);
  barrelBody.position.y = 0.36;
  barrelBody.castShadow = true;
  const hoopTop = new THREE.Mesh(new THREE.TorusGeometry(0.275, 0.022, 6, 12), ironMat);
  hoopTop.rotation.x = Math.PI / 2;
  hoopTop.position.y = 0.56;
  const hoopBot = hoopTop.clone();
  hoopBot.position.y = 0.18;
  const barrelRim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 10), cedarDarkMat);
  barrelRim.position.y = 0.71;
  barrel.add(barrelBody, hoopTop, hoopBot, barrelRim);
  group.add(barrel);

  // Cottage south stone-edged garden strip (z = halfD + 0.38 = +2.83, comfortably inside z <= 3.2)
  const gardenColors = [
    STORYBOOK_PALETTE.petalLavender,
    STORYBOOK_PALETTE.petalMarigold,
    STORYBOOK_PALETTE.petalRose,
    STORYBOOK_PALETTE.petalCream,
  ];
  for (let i = 0; i < 6; i++) {
    const fx = wallCenterX - 0.35 + i * 0.4;
    const fz = halfD + 0.34 + ((i % 2) * 0.12);
    const tuft = makeFlowerTuft(palette, gardenColors[i % gardenColors.length], 0.92 + (i % 2) * 0.15);
    tuft.position.set(fx, 0, fz);
    tuft.rotation.y = i * 0.9;
    group.add(tuft);
  }

  return { group, smokePuffs, lanternMesh };
}

/**
 * 2. HANDCRAFTED MAILBOX PROTOTYPE: Willow Mailbox at (-9.8, 0, 7.2)
 */
export function buildWillowMailbox(ctx: WillowPrototypeContext): WillowMailboxRig {
  const { palette, shadowTex } = ctx;
  const group = new THREE.Group();

  const stoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.9, 0.02);
  const cedarMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.76, 0.04);
  const boxSageMat = palette.standard('#547B5F', 0.48, 0.18);
  const tinRoofMat = palette.standard('#8C6A4E', 0.62, 0.12);
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.25, 0.85);
  const paperMat = palette.standard('#FBF4E4', 0.88, 0.0);
  const stampMat = palette.standard('#C86446', 0.68, 0.02);
  const flagMat = palette.standard('#D95642', 0.45, 0.05);

  addContactShadow(group, shadowTex, 1.35, 1.35, 0.48, 0.018);

  // Stone base collar + tucked clover & tiny daisies
  const basePad = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.1, 8), stoneMat);
  basePad.position.y = 0.05;
  basePad.receiveShadow = true;
  group.add(basePad);

  const clover = makeCloverPatch(palette, 0.36, 4);
  clover.position.set(0.06, 0.01, 0.08);
  const daisy = makeFlowerTuft(palette, STORYBOOK_PALETTE.petalCream, 0.72);
  daisy.position.set(-0.24, 0.02, 0.2);
  group.add(clover, daisy);

  // Cedar post + angled support strut
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.02, 0.15), cedarMat);
  post.position.y = 0.54;
  post.castShadow = true;
  const brace = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.1), cedarMat);
  brace.position.set(0, 0.88, 0.14);
  brace.rotation.x = 0.72;
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.66), cedarMat);
  shelf.position.set(0, 1.02, 0.05);
  group.add(post, brace, shelf);

  // Curved barrel mailbox housing
  const lowerBox = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.58), boxSageMat);
  lowerBox.position.set(0, 1.15, 0.05);
  lowerBox.castShadow = true;
  const archTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 0.58, 12, 1, false, 0, Math.PI),
    boxSageMat,
  );
  archTop.rotation.z = Math.PI / 2;
  archTop.rotation.y = Math.PI / 2;
  archTop.position.set(0, 1.25, 0.05);
  archTop.castShadow = true;
  group.add(lowerBox, archTop);

  // Tiny pitched decorative shingle cap + brass front latch
  for (const sx of [-1, 1]) {
    const eaves = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.64), tinRoofMat);
    eaves.position.set(sx * 0.11, 1.44, 0.05);
    eaves.rotation.z = -sx * 0.45;
    group.add(eaves);
  }
  const brassLatch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.06), brassMat);
  brassLatch.position.set(0, 1.24, 0.35);
  group.add(brassLatch);

  // Peeking cream stamped postcard sticking out the front slot
  const postcard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.2), paperMat);
  postcard.position.set(-0.02, 1.14, 0.37);
  postcard.rotation.y = 0.12;
  const stamp = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.035, 0.055), stampMat);
  stamp.position.set(0.05, 1.145, 0.42);
  stamp.rotation.y = 0.12;
  group.add(postcard, stamp);

  // Pivoted red wooden flag (rotation.z animated via world.mailboxUnread)
  const flagPivot = new THREE.Group();
  flagPivot.position.set(0.21, 1.2, -0.05);
  const flagStem = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.05), flagMat);
  flagStem.position.y = 0.16;
  const flagTip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.11, 0.14), flagMat);
  flagTip.position.set(0, 0.28, 0.05);
  flagPivot.add(flagStem, flagTip);
  group.add(flagPivot);

  return { group, flagMesh: flagPivot as unknown as THREE.Mesh };
}

/**
 * 3. PATHWAY, TREES, FENCE, SIGNPOST & VEGETATION: Willow Lane Courtyard Diorama
 */
function buildSculptedTree(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
  variant: 'willow_birch' | 'apple_blossom' | 'sage_birch',
): THREE.Group {
  const tree = new THREE.Group();
  addContactShadow(tree, shadowTex, 3.2, 3.2, 0.46, 0.02);

  const barkMat =
    variant === 'willow_birch' || variant === 'sage_birch'
      ? palette.standard(STORYBOOK_PALETTE.birchBark, 0.88, 0.01)
      : palette.standard(STORYBOOK_PALETTE.oakBark, 0.9, 0.01);

  // Root flare + tapered trunk + branch fork
  const rootFlare = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.36, 0.42, 7), barkMat);
  rootFlare.position.y = 0.21;
  rootFlare.castShadow = true;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.24, 1.75, 8), barkMat);
  trunk.position.y = 1.08;
  trunk.rotation.z = variant === 'willow_birch' ? 0.06 : -0.04;
  trunk.castShadow = true;
  tree.add(rootFlare, trunk);

  const branchA = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.95, 6), barkMat);
  branchA.position.set(-0.28, 1.85, 0.14);
  branchA.rotation.z = 0.55;
  branchA.rotation.x = 0.2;
  branchA.castShadow = true;

  const branchB = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.88, 6), barkMat);
  branchB.position.set(0.32, 1.92, -0.16);
  branchB.rotation.z = -0.52;
  branchB.rotation.x = -0.22;
  branchB.castShadow = true;
  tree.add(branchA, branchB);

  // Birch bark dark horizontal flecks
  if (variant !== 'apple_blossom') {
    const fleckMat = palette.standard('#4E443B', 0.88, 0.0);
    for (let i = 0; i < 3; i++) {
      const fleck = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.32), fleckMat);
      fleck.position.set(0, 0.65 + i * 0.38, 0);
      fleck.rotation.y = i * 1.1;
      tree.add(fleck);
    }
  }

  // Multi-lobe organic foliage canopy (5-6 sculpted cushions, never 1 raw polyhedron)
  const foliageA = palette.standard(STORYBOOK_PALETTE.foliageDeep, 0.86, 0.0);
  const foliageB = palette.standard(
    variant === 'willow_birch' ? STORYBOOK_PALETTE.foliageSage : STORYBOOK_PALETTE.foliageMid,
    0.84,
    0.0,
  );
  const foliageC = palette.standard(STORYBOOK_PALETTE.foliageSun, 0.82, 0.0);

  const lobes: Array<{ pos: [number, number, number]; scale: [number, number, number]; r: number; mat: THREE.MeshStandardMaterial }> = [
    { pos: [0, 2.66, 0], scale: [1.22, 0.94, 1.15], r: 0.96, mat: foliageB },
    { pos: [-0.6, 2.34, 0.34], scale: [1.08, 0.86, 1.04], r: 0.76, mat: foliageA },
    { pos: [0.62, 2.42, -0.28], scale: [1.06, 0.88, 1.06], r: 0.74, mat: foliageB },
    { pos: [0.16, 3.12, 0.14], scale: [1.1, 0.88, 1.02], r: 0.72, mat: foliageC },
    { pos: [-0.22, 2.42, -0.54], scale: [0.98, 0.84, 0.98], r: 0.7, mat: foliageA },
  ];
  for (const l of lobes) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(l.r, 1), l.mat);
    puff.position.set(...l.pos);
    puff.scale.set(...l.scale);
    puff.castShadow = true;
    puff.receiveShadow = true;
    tree.add(puff);
  }

  if (variant === 'willow_birch') {
    // Hanging willow leaf garlands
    const vineMat = palette.standard(STORYBOOK_PALETTE.foliageSage, 0.86, 0.0);
    for (let v = 0; v < 5; v++) {
      const a = (v / 5) * Math.PI * 2 + 0.4;
      const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.02, 0.85, 5), vineMat);
      vine.position.set(Math.cos(a) * 0.92, 1.98, Math.sin(a) * 0.92);
      tree.add(vine);
    }
  } else if (variant === 'apple_blossom') {
    // Tiny coral-cream blossoms nestled around foliage crown
    const blossomMat = palette.standard(STORYBOOK_PALETTE.petalRose, 0.58, 0.02);
    const blossomPositions: Array<[number, number, number]> = [
      [0.45, 2.68, 0.65],
      [-0.55, 2.52, 0.72],
      [0.72, 2.38, 0.25],
      [-0.12, 3.22, 0.62],
      [0.25, 2.95, -0.45],
    ];
    for (const [bx, by, bz] of blossomPositions) {
      const fl = new THREE.Mesh(new THREE.DodecahedronGeometry(0.095, 0), blossomMat);
      fl.position.set(bx, by, bz);
      tree.add(fl);
    }
  }

  return tree;
}

export function buildWillowLaneCourtyardProps(ctx: WillowPrototypeContext): WillowCourtyardRig {
  const { palette, shadowTex, lanternMaterials } = ctx;
  const group = new THREE.Group();
  const swayClusters: THREE.Group[] = [];
  const lanternGlowMeshes: THREE.Mesh[] = [];

  const stoneCurbMat = palette.standard(STORYBOOK_PALETTE.limestoneCurb, 0.88, 0.02);
  const flagstoneWarmMat = palette.standard('#9D8D79', 0.88, 0.02);
  const flagstoneCoolMat = palette.standard('#8C7E6C', 0.9, 0.02);
  const cedarMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.78, 0.04);
  const cedarWarmMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.75, 0.04);
  const ironMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.42, 0.72);
  const signCreamMat = palette.standard(STORYBOOK_PALETTE.creamTrim, 0.76, 0.02);
  const hedgeMat = palette.standard(STORYBOOK_PALETTE.foliageDeep, 0.86, 0.0);
  const hedgeSunMat = palette.standard(STORYBOOK_PALETTE.foliageSun, 0.84, 0.0);

  const postLanternMat = new THREE.MeshStandardMaterial({
    color: '#FFE9AF',
    emissive: new THREE.Color('#FFAB3B'),
    emissiveIntensity: 0.25,
    roughness: 0.18,
    metalness: 0.05,
  });
  lanternMaterials.push(postLanternMat);

  // A. PATHWAY ELEVATION: Handcrafted stepping flagstones (walkable, y = 0.036)
  // Path from cottage step (-10.6, 10.0) out into Willow Step Lane & spur up to Willow Mailbox (-9.8, 7.2)
  const flagstoneSpecs: Array<{ x: number; z: number; w: number; d: number; rot: number; warm: boolean }> = [
    { x: -10.35, z: 10.0, w: 0.82, d: 1.05, rot: 0.05, warm: true },
    { x: -9.55, z: 9.85, w: 0.76, d: 0.82, rot: -0.14, warm: false },
    { x: -8.75, z: 9.6, w: 0.78, d: 0.74, rot: 0.18, warm: true },
    { x: -7.95, z: 9.88, w: 0.72, d: 0.84, rot: -0.08, warm: false },
    { x: -7.15, z: 9.65, w: 0.76, d: 0.74, rot: 0.22, warm: true },
    { x: -6.35, z: 9.92, w: 0.82, d: 0.8, rot: -0.12, warm: false },
    // Spur stepping stones curving up toward Willow Mailbox (-9.8, 7.2)
    { x: -9.85, z: 9.05, w: 0.68, d: 0.62, rot: 0.25, warm: true },
    { x: -9.72, z: 8.32, w: 0.64, d: 0.58, rot: -0.2, warm: false },
    { x: -9.45, z: 7.65, w: 0.66, d: 0.58, rot: 0.12, warm: true },
  ];
  for (const fs of flagstoneSpecs) {
    const paver = new THREE.Mesh(
      new THREE.CylinderGeometry(fs.w * 0.55, fs.w * 0.6, 0.045, 7),
      fs.warm ? flagstoneWarmMat : flagstoneCoolMat,
    );
    paver.scale.set(1, 1, fs.d / fs.w);
    paver.position.set(fs.x, 0.036, fs.z);
    paver.rotation.y = fs.rot;
    paver.receiveShadow = true;
    group.add(paver);
  }

  // Beveled stone curb trim along non-blocking lane borders & cottage north/south perimeter
  const curbBlocks: Array<{ x: number; z: number; w: number; d: number }> = [
    // South cottage lane curb border (hugged tightly at z = 11.9, outside walk lane or flush? Wait: home lane cobbles span z: 8.2..11.8!)
    { x: -10.0, z: 11.92, w: 1.4, d: 0.26 },
    { x: -8.35, z: 11.92, w: 1.5, d: 0.26 },
    { x: -6.7, z: 11.92, w: 1.4, d: 0.26 },
    // North edge of cottage garden along z = 6.72, x = -18.2..-11.2 (inside unreachable plinth margin!)
    { x: -16.8, z: 6.72, w: 2.2, d: 0.24 },
    { x: -14.2, z: 6.72, w: 2.3, d: 0.24 },
    { x: -11.9, z: 6.72, w: 1.5, d: 0.24 },
    // West edge of West Lane north of cottage (x = -12.02, z = 4.5..6.4)
    { x: -12.02, z: 5.7, w: 0.26, d: 1.35 },
    { x: -12.02, z: 4.3, w: 0.26, d: 1.2 },
  ];
  for (const cb of curbBlocks) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(cb.w, 0.09, cb.d), stoneCurbMat);
    curb.position.set(cb.x, 0.045, cb.z);
    curb.receiveShadow = true;
    group.add(curb);
  }

  // B. WOODEN SPLIT-RAIL GARDEN FENCE (hugging cottage south margin z = 13.38, inside player_cottage actorRadius buffer)
  const fenceGroup = new THREE.Group();
  const fenceZ = 13.38;
  const fenceXs = [-18.0, -16.25, -14.5, -12.75, -11.05];
  for (let i = 0; i < fenceXs.length; i++) {
    const fx = fenceXs[i];
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.72, 0.14), cedarMat);
    post.position.set(fx, 0.36, fenceZ);
    post.castShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.18), cedarWarmMat);
    cap.position.set(fx, 0.73, fenceZ);
    fenceGroup.add(post, cap);

    if (i < fenceXs.length - 1) {
      const nextX = fenceXs[i + 1];
      const span = nextX - fx;
      const midX = (fx + nextX) / 2;
      for (const ry of [0.26, 0.52]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(span, 0.075, 0.06), cedarWarmMat);
        rail.position.set(midX, ry, fenceZ);
        rail.castShadow = true;
        fenceGroup.add(rail);
      }
    }
  }
  group.add(fenceGroup);

  // C. SCULPTED TREES (matched to CIRCLE_OBSTACLES in worldMap.ts)
  const treeSW = buildSculptedTree(palette, shadowTex, 'willow_birch');
  treeSW.position.set(-19.2, 0, 13.6);
  treeSW.rotation.y = 0.7;
  group.add(treeSW);

  const treeSouth = buildSculptedTree(palette, shadowTex, 'apple_blossom');
  treeSouth.position.set(-15.5, 0, 15.0);
  treeSouth.scale.setScalar(0.92);
  treeSouth.rotation.y = -0.45;
  group.add(treeSouth);

  const treeNW = buildSculptedTree(palette, shadowTex, 'sage_birch');
  treeNW.position.set(-16.8, 0, 5.2);
  treeNW.scale.setScalar(0.96);
  treeNW.rotation.y = 1.9;
  group.add(treeNW);

  // D. LAYERED GARDEN SHRUBS & WILDFLOWER CLUSTERS (framing cottage corners & fence)
  const shrubSpots: Array<{ x: number; z: number; scale: number; warm: boolean }> = [
    { x: -18.35, z: 12.6, scale: 1.0, warm: false },
    { x: -18.4, z: 7.4, scale: 0.92, warm: true },
    { x: -12.3, z: 13.55, scale: 0.85, warm: false },
    { x: -16.8, z: 13.6, scale: 0.9, warm: true },
    { x: -14.8, z: 6.45, scale: 0.84, warm: false },
  ];
  for (const sh of shrubSpots) {
    const sg = new THREE.Group();
    sg.position.set(sh.x, 0, sh.z);
    addContactShadow(sg, shadowTex, 1.3 * sh.scale, 1.3 * sh.scale, 0.36, 0.018);
    const mainMound = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.42 * sh.scale, 1),
      sh.warm ? hedgeSunMat : hedgeMat,
    );
    mainMound.scale.set(1.2, 0.82, 1.15);
    mainMound.position.y = 0.26 * sh.scale;
    mainMound.castShadow = true;
    const sideMound = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.28 * sh.scale, 1),
      sh.warm ? hedgeMat : hedgeSunMat,
    );
    sideMound.position.set(0.26 * sh.scale, 0.2 * sh.scale, 0.16 * sh.scale);
    sg.add(mainMound, sideMound);
    group.add(sg);
  }

  // Wildflower & clover clusters around fence, curb corners, and tree bases
  const flowerBeds: Array<{ x: number; z: number; color: string; scale: number }> = [
    { x: -11.4, z: 13.55, color: STORYBOOK_PALETTE.petalMarigold, scale: 1.05 },
    { x: -13.6, z: 13.62, color: STORYBOOK_PALETTE.petalCornflower, scale: 0.95 },
    { x: -15.4, z: 13.6, color: STORYBOOK_PALETTE.petalRose, scale: 1.0 },
    { x: -17.5, z: 13.65, color: STORYBOOK_PALETTE.petalCream, scale: 0.95 },
    { x: -13.2, z: 6.52, color: STORYBOOK_PALETTE.petalLavender, scale: 0.95 },
    { x: -11.55, z: 6.54, color: STORYBOOK_PALETTE.petalMarigold, scale: 0.9 },
    { x: -10.55, z: 11.95, color: STORYBOOK_PALETTE.petalCream, scale: 0.78 },
    { x: -7.55, z: 11.98, color: STORYBOOK_PALETTE.petalCornflower, scale: 0.82 },
  ];
  for (let i = 0; i < flowerBeds.length; i++) {
    const fb = flowerBeds[i];
    const cluster = new THREE.Group();
    cluster.position.set(fb.x, 0, fb.z);
    const clover = makeCloverPatch(palette, 0.28 * fb.scale, 3);
    const tuft = makeFlowerTuft(palette, fb.color, fb.scale);
    cluster.add(clover, tuft);
    group.add(cluster);
    swayClusters.push(cluster);
  }

  // E. COURTYARD LANTERN SIGNPOST at (-12.5, 0, 5.7) (matched to CIRCLE_OBSTACLES)
  const signpost = new THREE.Group();
  signpost.position.set(-12.5, 0, 5.7);
  addContactShadow(signpost, shadowTex, 1.45, 1.45, 0.48, 0.018);

  const signBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.14, 8), stoneCurbMat);
  signBase.position.y = 0.07;
  const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.11, 2.38, 8), cedarMat);
  signPost.position.y = 1.22;
  signPost.castShadow = true;
  const postFinial = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), cedarWarmMat);
  postFinial.position.y = 2.46;
  signpost.add(signBase, signPost, postFinial);

  // Two carved directional sign planks ("Willow Step" & "Town Plaza")
  const signA = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.2, 0.07), signCreamMat);
  signA.position.set(0.32, 1.56, 0.06);
  signA.rotation.y = -0.18;
  const signB = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.18, 0.07), signCreamMat);
  signB.position.set(0.08, 1.28, -0.28);
  signB.rotation.y = Math.PI / 2 - 0.15;
  signpost.add(signA, signB);

  // Hanging wrought-iron lantern arm
  const armBar = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.06, 0.06), ironMat);
  armBar.position.set(0.26, 2.22, 0);
  const armBrace = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.05), ironMat);
  armBrace.position.set(0.14, 2.06, 0);
  armBrace.rotation.z = 0.72;
  const postCap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.12, 6), ironMat);
  postCap.position.set(0.48, 2.04, 0);
  const lanternBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.085, 0.22, 6),
    postLanternMat,
  );
  lanternBody.position.set(0.48, 1.88, 0);
  const lanternFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.06, 0.06, 6), ironMat);
  lanternFoot.position.set(0.48, 1.74, 0);
  signpost.add(armBar, armBrace, postCap, lanternBody, lanternFoot);
  lanternGlowMeshes.push(lanternBody);

  // Tiny flower ring at signpost base
  const signFlower = makeFlowerTuft(palette, STORYBOOK_PALETTE.petalMarigold, 0.85);
  signFlower.position.set(0.28, 0.02, 0.22);
  signpost.add(signFlower);

  group.add(signpost);

  return { group, swayClusters, lanternGlowMeshes };
}

/**
 * 4. STORYBOOK CHARACTER PROTOTYPE: Jun the Letter Carrier
 * Returns a fully compatible CharacterRig for NeighborhoodCanvas.tsx.
 */
export function buildStorybookJun(
  appearance: ResidentAppearance,
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
): CharacterRig {
  const root = new THREE.Group();
  const s = appearance.heightScale;

  addContactShadow(root, shadowTex, 1.12, 1.12, 0.56, 0.024);

  const ringMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.68, 24),
    new THREE.MeshBasicMaterial({
      color: '#E5A93C',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
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

  const bootMat = palette.standard('#46342A', 0.72, 0.05);
  const trousersMat = palette.standard('#344A61', 0.84, 0.02);
  const coatMat = palette.standard(appearance.coatColor, 0.78, 0.02);
  const coatShadeMat = palette.standard('#3B5F87', 0.8, 0.02);
  const shirtMat = palette.standard(appearance.shirtColor, 0.84, 0.01);
  const scarfMat = palette.standard(appearance.accentColor, 0.86, 0.01);
  const skinMat = palette.standard(appearance.skinColor, 0.7, 0.02);
  const blushMat = palette.standard('#E59580', 0.74, 0.0);
  const hairMat = palette.standard(appearance.hairColor, 0.82, 0.03);
  const eyeMat = palette.standard('#1E1814', 0.16, 0.08);
  const highlightMat = palette.standard('#FAF5EC', 0.12, 0.0);
  const leatherMat = palette.standard('#7D4F30', 0.64, 0.08);
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.24, 0.85);
  const paperMat = palette.standard('#FAF2E1', 0.88, 0.0);
  const stampMat = palette.standard('#C86446', 0.65, 0.02);

  // Pivoted Legs (hip pivot at y = 0.42)
  const makeLeg = (xPos: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(xPos, 0.42, 0);
    const pant = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.095, 0.22, 8), trousersMat);
    pant.position.y = -0.11;
    pant.castShadow = true;
    const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.1, 4, 8), bootMat);
    boot.position.set(0, -0.28, 0.03);
    boot.castShadow = true;
    legPivot.add(pant, boot);
    return legPivot;
  };
  const leftLeg = makeLeg(-0.13);
  const rightLeg = makeLeg(0.13);
  bodyGroup.add(leftLeg, rightLeg);

  // Waist / Upper-Body Pivot (y = 0.45 inside bodyGroup)
  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.45, 0);
  bodyGroup.add(torsoPivot);

  // Flared Courier Coat + Shirt Placket + Brass Buttons
  const coatSkirt = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.35, 0.34, 12), coatMat);
  coatSkirt.position.y = 0.1;
  coatSkirt.castShadow = true;
  const coatChest = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.26, 0.38, 12), coatMat);
  coatChest.position.y = 0.42;
  coatChest.castShadow = true;
  const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.06), shirtMat);
  lapel.position.set(0, 0.43, 0.22);
  torsoPivot.add(coatSkirt, coatChest, lapel);

  for (let b = 0; b < 3; b++) {
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 6), brassMat);
    btn.position.set(0, 0.27 + b * 0.11, 0.26);
    torsoPivot.add(btn);
  }

  // Knit Amber Scarf Wrap + Tail
  const scarfCollar = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.065, 8, 14), scarfMat);
  scarfCollar.rotation.x = Math.PI / 2;
  scarfCollar.position.y = 0.6;
  const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.26, 0.05), scarfMat);
  scarfTail.position.set(0.12, 0.45, 0.24);
  scarfTail.rotation.z = -0.16;
  scarfTail.rotation.x = -0.12;
  torsoPivot.add(scarfCollar, scarfTail);

  const carrySocket = new THREE.Group();
  carrySocket.position.set(0, 0.31, 0.37);
  torsoPivot.add(carrySocket);

  // Pivoted Sleeved Arms with Cream Cuffs & Clay Hands (shoulder pivot at y = 0.53 inside torsoPivot)
  const makeArm = (side: -1 | 1) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.3, 0.53, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.34, 8), coatMat);
    sleeve.position.set(side * 0.04, -0.16, 0);
    sleeve.rotation.z = side * 0.18;
    sleeve.castShadow = true;
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.06, 8), shirtMat);
    cuff.position.set(side * 0.07, -0.32, 0);
    cuff.rotation.z = side * 0.18;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.072, 8, 8), skinMat);
    hand.position.set(side * 0.09, -0.39, 0.02);
    armPivot.add(sleeve, cuff, hand);
    return armPivot;
  };
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  torsoPivot.add(leftArm, rightArm);

  // Cross-Body Leather Courier Satchel + Brass Buckle + Peeking Postcard
  const satchelStrap = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.028, 6, 16), leatherMat);
  satchelStrap.position.set(-0.02, 0.33, 0);
  satchelStrap.rotation.y = Math.PI / 2;
  satchelStrap.rotation.x = 0.65;
  torsoPivot.add(satchelStrap);

  const bagGroup = new THREE.Group();
  bagGroup.position.set(-0.32, 0.13, 0.04);
  bagGroup.rotation.z = -0.08;
  const bagBody = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.3), leatherMat);
  bagBody.castShadow = true;
  const bagFlap = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.31), leatherMat);
  bagFlap.position.set(-0.01, 0.07, 0);
  const bagBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.055, 0.06), brassMat);
  bagBuckle.position.set(-0.095, 0.02, 0);
  const letterPeek = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.2), paperMat);
  letterPeek.position.set(0.02, 0.12, -0.03);
  letterPeek.rotation.x = -0.18;
  const letterStamp = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.045, 0.045), stampMat);
  letterStamp.position.set(0.02, 0.16, 0.03);
  bagGroup.add(bagBody, bagFlap, bagBuckle, letterPeek, letterStamp);
  torsoPivot.add(bagGroup);

  // Expressive Storybook Head + Hair Tufts + Courier Cap + Brass Post-Horn Badge
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.9, 0);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.285, 14, 12), skinMat);
  head.castShadow = true;
  headGroup.add(head);

  // Sculpted nose + warm cheek blush
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), skinMat);
  nose.position.set(0, -0.02, 0.275);
  headGroup.add(nose);

  const lidGeo = new THREE.BoxGeometry(0.082, 0.056, 0.036);
  const browGeo = new THREE.BoxGeometry(0.074, 0.02, 0.024);
  let leftEyelid!: THREE.Mesh;
  let rightEyelid!: THREE.Mesh;
  let leftBrow!: THREE.Mesh;
  let rightBrow!: THREE.Mesh;

  for (const sx of [-1, 1] as const) {
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 8), blushMat);
    blush.scale.set(1.2, 0.72, 0.45);
    blush.position.set(sx * 0.155, -0.06, 0.22);
    headGroup.add(blush);

    // Expressive eye + tiny warm catchlight dot
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), eyeMat);
    eye.position.set(sx * 0.105, 0.025, 0.252);
    const catchlight = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 6), highlightMat);
    catchlight.position.set(sx * 0.105 + 0.012, 0.04, 0.284);
    headGroup.add(eye, catchlight);

    const eyelid = new THREE.Mesh(lidGeo, skinMat);
    eyelid.position.set(sx * 0.105, 0.056, 0.268);
    eyelid.scale.y = 0.2;
    headGroup.add(eyelid);

    const brow = new THREE.Mesh(browGeo, hairMat);
    brow.position.set(sx * 0.105, 0.078, 0.274);
    headGroup.add(brow);

    if (sx === -1) {
      leftEyelid = eyelid;
      leftBrow = brow;
    } else {
      rightEyelid = eyelid;
      rightBrow = brow;
    }
  }

  // Sculpted back hair + bangs tufts under cap
  const hairBack = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6),
    hairMat,
  );
  hairBack.rotation.x = -0.35;
  headGroup.add(hairBack);

  for (const bx of [-0.11, 0, 0.11]) {
    const bang = new THREE.Mesh(new THREE.DodecahedronGeometry(0.072, 0), hairMat);
    bang.scale.set(1.1, 0.75, 0.8);
    bang.position.set(bx, 0.13, 0.24);
    headGroup.add(bang);
  }

  // Courier Cap + Visor + Brass Badge
  const capCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.28, 0.16, 12),
    coatMat,
  );
  capCrown.position.set(0, 0.21, -0.02);
  capCrown.rotation.x = -0.14;
  capCrown.castShadow = true;
  const capBand = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.285, 0.06, 12), coatShadeMat);
  capBand.position.set(0, 0.14, 0);
  capBand.rotation.x = -0.14;
  const capVisor = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.04, 12, 1, false, -Math.PI * 0.36, Math.PI * 0.72), coatShadeMat);
  capVisor.position.set(0, 0.12, 0.06);
  capVisor.rotation.x = 0.08;
  const capBadge = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.025, 8), brassMat);
  capBadge.rotation.x = Math.PI / 2;
  capBadge.position.set(0, 0.22, 0.28);
  headGroup.add(capCrown, capBand, capVisor, capBadge);

  torsoPivot.add(headGroup);

  const questPip = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.14, 0),
    new THREE.MeshStandardMaterial({
      color: '#FFD466',
      emissive: '#E59A28',
      emissiveIntensity: 0.5,
      roughness: 0.25,
    }),
  );
  questPip.position.set(0, 2.1 * s, 0);
  questPip.visible = false;
  root.add(questPip);

  return {
    root,
    bodyGroup,
    torsoPivot,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    headGroup,
    leftEyelid,
    rightEyelid,
    leftBrow,
    rightBrow,
    carrySocket,
    ringMesh,
    questPip,
  };
}

/**
 * Zero-GC per-frame subtle motion for the Willow Lane diorama prototype:
 * - Gentle chimney smoke puff drift
 * - Soft breeze sway on courtyard wildflower clusters
 */
export function updateWillowPrototypeMotion(
  cottage: WillowCottageRig,
  courtyard: WillowCourtyardRig,
  elapsed: number,
): void {
  for (let i = 0; i < cottage.smokePuffs.length; i++) {
    const puff = cottage.smokePuffs[i];
    const cyc = (elapsed * 0.28 + (puff.userData.phase as number)) % 1;
    const ox = puff.userData.originX as number;
    const oy = puff.userData.originY as number;
    const oz = puff.userData.originZ as number;
    puff.position.set(
      ox + Math.sin(elapsed * 0.9 + i) * 0.12 + cyc * 0.22,
      oy + cyc * 1.65,
      oz + cyc * 0.14,
    );
    const scale = 0.65 + cyc * 0.85;
    puff.scale.setScalar(scale * (1 - cyc * 0.38));
    puff.rotation.y = elapsed * 0.5 + i;
  }

  for (let i = 0; i < courtyard.swayClusters.length; i++) {
    const cluster = courtyard.swayClusters[i];
    cluster.rotation.z = Math.sin(elapsed * 1.7 + i * 0.9) * 0.045;
  }
}
