import * as THREE from 'three';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';
import { FountainRig, GazeboRig } from '../models';
import { addContactShadow } from './vegetation';

/**
 * Hero Centerpiece Landmark: Old Bell Gazebo at (0, 0, -9.5) (CIRCLE_OBSTACLES r=2.3).
 * Stepped octagonal limestone dais, South entrance steps, chamfered cedar columns on stone plinths,
 * angled knee braces, perimeter balustrade, multi-tiered shingle spire, brass bell + yoke,
 * removable climbing ivy, and marigold festival swags.
 */
export function buildStorybookGazebo(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
  roofTex?: THREE.Texture,
): GazeboRig {
  const group = new THREE.Group();
  group.position.set(0, 0, -9.5);

  addContactShadow(group, shadowTex, 6.6, 6.6, 0.5, 0.02);

  const stoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.9, 0.02);
  const darkStoneMat = palette.standard(STORYBOOK_PALETTE.fieldstoneDark, 0.92, 0.02);
  const cedarDarkMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.78, 0.04);
  const cedarWarmMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.75, 0.04);
  const trimCreamMat = palette.standard(STORYBOOK_PALETTE.creamTrim, 0.76, 0.02);
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.24, 0.86);
  const ropeMat = palette.standard('#D7C5A0', 0.9, 0.0);

  const roofMat = roofTex
    ? palette.get('gazebo_sage_shingles', { color: '#FFFFFF', roughness: 0.75, metalness: 0.04 })
    : palette.standard(STORYBOOK_PALETTE.sageRoof, 0.75, 0.04);
  if (roofTex && !roofMat.map) {
    roofMat.map = roofTex;
    roofMat.needsUpdate = true;
  }

  // 1. Stepped octagonal dais + carved coping ring + South entrance steps
  const daisLower = new THREE.Mesh(new THREE.CylinderGeometry(2.74, 2.86, 0.28, 8), darkStoneMat);
  daisLower.position.y = 0.14;
  daisLower.receiveShadow = true;
  daisLower.castShadow = true;

  const daisUpper = new THREE.Mesh(new THREE.CylinderGeometry(2.48, 2.6, 0.3, 8), stoneMat);
  daisUpper.position.y = 0.43;
  daisUpper.receiveShadow = true;
  daisUpper.castShadow = true;

  const daisCap = new THREE.Mesh(new THREE.CylinderGeometry(2.54, 2.54, 0.06, 8), palette.standard(STORYBOOK_PALETTE.limestoneCurb, 0.88, 0.02));
  daisCap.position.y = 0.59;
  daisCap.receiveShadow = true;
  group.add(daisLower, daisUpper, daisCap);

  // Two broad carved steps facing South (+Z) toward Plaza
  const stepBottom = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.2, 0.62), darkStoneMat);
  stepBottom.position.set(0, 0.1, 2.66);
  stepBottom.receiveShadow = true;
  const stepTop = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.22, 0.46), stoneMat);
  stepTop.position.set(0, 0.34, 2.42);
  stepTop.receiveShadow = true;
  group.add(stepBottom, stepTop);

  // 2. Six chamfered cedar columns on stone plinth blocks + knee braces + open-front balustrade
  const colPositions: Array<{ angle: number; x: number; z: number }> = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + Math.PI / 6; // Columns flank +Z opening cleanly (angles at pi/6, pi/2, 5pi/6...)
    // Wait: cos(pi/2) = 0, sin(pi/2) = +1 would place a column right at +Z!
    // Rotate by +PI/6 -> angles: 0, pi/3, 2pi/3, pi, 4pi/3, 5pi/3 -> South (+Z) is at pi/2 which falls cleanly BETWEEN pi/3 and 2pi/3!
    const colAngle = (i / 6) * Math.PI * 2;
    const cx = Math.cos(colAngle) * 2.08;
    const cz = Math.sin(colAngle) * 2.08;
    colPositions.push({ angle: colAngle, x: cx, z: cz });

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.42), darkStoneMat);
    plinth.position.set(cx, 0.78, cz);
    plinth.rotation.y = -colAngle;
    plinth.castShadow = true;

    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.175, 3.38, 8), cedarDarkMat);
    col.position.set(cx, 2.62, cz);
    col.castShadow = true;

    const capTrim = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.38), cedarWarmMat);
    capTrim.position.set(cx, 4.26, cz);
    capTrim.rotation.y = -colAngle;
    group.add(plinth, col, capTrim);

    // Two angled timber knee braces meeting ring beam cleanly
    for (const dir of [-1, 1]) {
      const tangentX = -Math.sin(colAngle) * dir;
      const tangentZ = Math.cos(colAngle) * dir;
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.56, 0.09), cedarWarmMat);
      brace.position.set(cx + tangentX * 0.24, 4.02, cz + tangentZ * 0.24);
      brace.rotation.y = -colAngle;
      brace.rotation.x = dir * 0.72;
      group.add(brace);
    }
  }

  // Balustrade rails between columns (skip South span between col 1 [pi/3] and col 2 [2pi/3] where steps enter)
  for (let i = 0; i < 6; i++) {
    if (i === 1) continue; // Open South entrance facing +Z
    const a = colPositions[i];
    const b = colPositions[(i + 1) % 6];
    const mx = (a.x + b.x) * 0.5;
    const mz = (a.z + b.z) * 0.5;
    const span = Math.hypot(b.x - a.x, b.z - a.z);
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);

    const railGroup = new THREE.Group();
    railGroup.position.set(mx, 0.62, mz);
    railGroup.rotation.y = yaw;

    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, span - 0.18), cedarWarmMat);
    topRail.position.y = 0.72;
    topRail.castShadow = true;
    const botRail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, span - 0.18), cedarDarkMat);
    botRail.position.y = 0.18;
    railGroup.add(topRail, botRail);

    for (let s = -2; s <= 2; s++) {
      const spindle = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.52, 0.065), trimCreamMat);
      spindle.position.set(0, 0.45, s * ((span - 0.45) / 5));
      railGroup.add(spindle);
    }
    group.add(railGroup);
  }

  // 3. Octagonal fascia ring beam + tiered shingled spire roof + cupola lantern cap + brass finial
  const ringBeam = new THREE.Mesh(new THREE.CylinderGeometry(2.38, 2.38, 0.3, 8), cedarDarkMat);
  ringBeam.position.y = 4.42;
  ringBeam.castShadow = true;

  const fasciaTrim = new THREE.Mesh(new THREE.CylinderGeometry(2.58, 2.46, 0.12, 8), trimCreamMat);
  fasciaTrim.position.y = 4.56;
  group.add(ringBeam, fasciaTrim);

  const lowerRoof = new THREE.Mesh(new THREE.ConeGeometry(3.22, 1.55, 8), roofMat);
  lowerRoof.position.y = 5.34;
  lowerRoof.castShadow = true;
  lowerRoof.receiveShadow = true;
  group.add(lowerRoof);

  // Small hexagonal upper cupola collar & steep spire crown
  const cupolaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.05, 0.45, 8), trimCreamMat);
  cupolaBase.position.y = 6.02;
  const upperSpire = new THREE.Mesh(new THREE.ConeGeometry(1.16, 1.12, 8), roofMat);
  upperSpire.position.y = 6.72;
  upperSpire.castShadow = true;

  const finialCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.16, 8), brassMat);
  finialCollar.position.y = 7.3;
  const finialOrb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), brassMat);
  finialOrb.position.y = 7.48;
  const finialTip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.28, 6), brassMat);
  finialTip.position.y = 7.72;
  group.add(cupolaBase, upperSpire, finialCollar, finialOrb, finialTip);

  // 4. Hanging Aged-Brass Bell + Cedar Headstock Yoke + Gleaming Clapper + Hemp Rope
  const bellPivot = new THREE.Group();
  bellPivot.position.set(0, 4.22, 0);

  const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.16, 0.18), cedarWarmMat);
  yoke.position.y = -0.08;
  bellPivot.add(yoke);

  const bellPoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.58, 0.0),
    new THREE.Vector2(0.48, 0.16),
    new THREE.Vector2(0.38, 0.62),
    new THREE.Vector2(0.28, 0.92),
    new THREE.Vector2(0.14, 1.02),
    new THREE.Vector2(0.0, 1.05),
  ];
  const bellGeo = new THREE.LatheGeometry(bellPoints, 18);
  bellGeo.translate(0, -1.36, 0);
  const bellMesh = new THREE.Mesh(bellGeo, brassMat);
  bellMesh.castShadow = true;
  bellPivot.add(bellMesh);

  const bellLip = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.045, 6, 18), brassMat);
  bellLip.rotation.x = Math.PI / 2;
  bellLip.position.y = -1.35;
  bellPivot.add(bellLip);

  const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.36, 8), brassMat);
  strap.position.y = -0.24;
  bellPivot.add(strap);

  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 10), brassMat);
  clapper.position.y = -1.38;
  clapper.visible = false;
  bellPivot.add(clapper);

  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 1.55, 6), ropeMat);
  rope.position.set(0.28, -1.96, 0.06);
  const ropeKnot = new THREE.Mesh(new THREE.SphereGeometry(0.068, 7, 7), ropeMat);
  ropeKnot.position.set(0.28, -2.74, 0.06);
  bellPivot.add(rope, ropeKnot);
  group.add(bellPivot);

  // 5. Creeping Ivy Vines & Leaf Clusters (hidden once cleared with Barnaby's ladder)
  const ivyGroup = new THREE.Group();
  const ivyDeepMat = palette.standard('#466D42', 0.85, 0.01);
  const ivyLightMat = palette.standard('#5F8952', 0.82, 0.01);
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    const tuft = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.28 + (i % 3) * 0.08, 0),
      i % 2 === 0 ? ivyDeepMat : ivyLightMat,
    );
    const r = 2.08 + (i % 2) * 0.14;
    const y = 3.25 + (i % 4) * 0.42;
    tuft.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
    tuft.scale.set(1.15, 0.88, 1.1);
    ivyGroup.add(tuft);
  }
  // Trailing vine runners hanging down two back columns
  for (const colIdx of [3, 5]) {
    const ca = colPositions[colIdx].angle;
    for (let v = 0; v < 4; v++) {
      const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), ivyLightMat);
      leaf.position.set(Math.cos(ca) * 2.18, 1.75 + v * 0.48, Math.sin(ca) * 2.18);
      ivyGroup.add(leaf);
    }
  }
  group.add(ivyGroup);

  // 6. Nora's Marigold Festival Bunting & Ribbon Ring (toggled on reconciliation)
  const ribbonMesh = new THREE.Mesh(
    new THREE.TorusGeometry(2.36, 0.065, 6, 24),
    palette.standard('#EFA93B', 0.5, 0.06),
  );
  ribbonMesh.rotation.x = Math.PI / 2;
  ribbonMesh.position.y = 4.26;

  const swagMat = palette.standard('#DF7E7A', 0.58, 0.02);
  const creamBuntingMat = palette.standard(STORYBOOK_PALETTE.petalCream, 0.6, 0.02);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const bow = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.15, 0),
      i % 2 === 0 ? swagMat : creamBuntingMat,
    );
    bow.position.set(Math.cos(a) * 2.4, -0.05, Math.sin(a) * 2.4);
    bow.rotation.x = Math.PI / 2;
    ribbonMesh.add(bow);
  }
  ribbonMesh.visible = false;
  group.add(ribbonMesh);

  return { group, bellPivot, bellMesh, clapperMesh: clapper, ivyGroup, ribbonMesh };
}

/**
 * Mossy Stone Fountain at (0, 0, 1.5) (CIRCLE_OBSTACLES r=2.35).
 * Features octagonal stepped apron, carved coping ashlar basin, moss tufts,
 * LatheGeometry fluted central column & upper catch-bowl, bronze spouts, shimmering water & droplets.
 */
export function buildStorybookFountain(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
): FountainRig {
  const group = new THREE.Group();
  group.position.set(0, 0, 1.5);

  addContactShadow(group, shadowTex, 5.7, 5.7, 0.46, 0.02);

  const stoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.88, 0.02);
  const darkStoneMat = palette.standard(STORYBOOK_PALETTE.fieldstoneDark, 0.91, 0.02);
  const mossMat = palette.standard(STORYBOOK_PALETTE.moss, 0.88, 0.0);
  const bronzeMat = palette.standard('#8C724A', 0.34, 0.78);
  const basinBedMat = palette.standard('#4E6E74', 0.88, 0.0);

  // Octagonal ground apron
  const apron = new THREE.Mesh(new THREE.CylinderGeometry(2.42, 2.52, 0.14, 8), darkStoneMat);
  apron.position.y = 0.07;
  apron.receiveShadow = true;
  group.add(apron);

  // Outer carved stone basin wall + beveled top coping torus
  const outerWall = new THREE.Mesh(new THREE.CylinderGeometry(2.18, 2.28, 0.56, 16), stoneMat);
  outerWall.position.y = 0.42;
  outerWall.castShadow = true;
  outerWall.receiveShadow = true;
  group.add(outerWall);

  const coping = new THREE.Mesh(new THREE.TorusGeometry(2.06, 0.18, 8, 20), stoneMat);
  coping.rotation.x = Math.PI / 2;
  coping.position.y = 0.72;
  coping.castShadow = true;
  coping.receiveShadow = true;
  group.add(coping);

  // Interior wet basin floor (always visible when dry before Mina's fix)
  const dryFloor = new THREE.Mesh(new THREE.CircleGeometry(1.94, 18), basinBedMat);
  dryFloor.rotation.x = -Math.PI / 2;
  dryFloor.position.y = 0.52;
  dryFloor.receiveShadow = true;
  group.add(dryFloor);

  // Moss cushions hugging basin base & coping rim
  const mossSpots: Array<[number, number, number, number]> = [
    [2.12, 0.18, 0.65, 1.0],
    [-1.95, 0.18, -0.95, 0.9],
    [0.55, 0.18, -2.18, 0.85],
    [-1.2, 0.82, 1.68, 0.62],
    [1.65, 0.82, -1.25, 0.58],
  ];
  for (const [mx, my, mz, ms] of mossSpots) {
    const tuft = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24 * ms, 0), mossMat);
    tuft.scale.set(1.3, 0.55, 1.1);
    tuft.position.set(mx, my, mz);
    group.add(tuft);
  }

  // Fluted sculpted center column + upper catch bowl (LatheGeometry)
  const colPoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.62, 0.0),
    new THREE.Vector2(0.55, 0.25),
    new THREE.Vector2(0.34, 0.45),
    new THREE.Vector2(0.3, 1.15),
    new THREE.Vector2(0.45, 1.32),
    new THREE.Vector2(0.98, 1.52),
    new THREE.Vector2(1.02, 1.68),
    new THREE.Vector2(0.84, 1.7),
    new THREE.Vector2(0.28, 1.56),
    new THREE.Vector2(0.22, 1.92),
    new THREE.Vector2(0.0, 1.98),
  ];
  const fountainCore = new THREE.Mesh(new THREE.LatheGeometry(colPoints, 14), stoneMat);
  fountainCore.position.y = 0.36;
  fountainCore.castShadow = true;
  fountainCore.receiveShadow = true;
  group.add(fountainCore);

  // Bronze finial nozzle & 4 cardinal lion-head spouts
  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.44, 8), bronzeMat);
  finial.position.y = 2.48;
  finial.castShadow = true;
  group.add(finial);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.26, 6), bronzeMat);
    spout.position.set(Math.cos(a) * 0.36, 1.5, Math.sin(a) * 0.36);
    spout.rotation.z = -Math.cos(a) * 1.1;
    spout.rotation.x = Math.sin(a) * 1.1;
    group.add(spout);
  }

  // Water disc + animated droplets (visible once Mina restores the stone pump)
  const waterMesh = new THREE.Mesh(
    new THREE.CircleGeometry(1.96, 18),
    new THREE.MeshStandardMaterial({
      color: '#6BB8C8',
      roughness: 0.12,
      metalness: 0.18,
      transparent: true,
      opacity: 0.84,
    }),
  );
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.y = 0.62;
  waterMesh.visible = false;
  group.add(waterMesh);

  const spoutParticles = new THREE.Group();
  const dropMat = palette.standard('#C6EEF5', 0.14, 0.08);
  for (let i = 0; i < 8; i++) {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.085, 6, 6), dropMat);
    drop.userData.phase = (i / 8) * Math.PI * 2;
    spoutParticles.add(drop);
  }
  spoutParticles.visible = false;
  group.add(spoutParticles);

  return { group, waterMesh, spoutParticles };
}

/**
 * Sora's Tea Cart at (-5.4, 0, -3.2) (CIRCLE_OBSTACLES r=1.05).
 * Spoked rear wooden wheels, grounded front legs, beadboard cabinet, kettle + porcelain cups,
 * 4 chamfered timber posts, and scalloped plum-cream striped awning.
 */
export function buildStorybookTeaCart(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(-5.4, 0, -3.2);

  addContactShadow(group, shadowTex, 2.35, 1.75, 0.45, 0.018);

  const cedarDarkMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.78, 0.04);
  const cedarWarmMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.74, 0.04);
  const creamMat = palette.standard(STORYBOOK_PALETTE.creamTrim, 0.78, 0.02);
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.24, 0.85);
  const ceramicMat = palette.standard(STORYBOOK_PALETTE.ceramicCream, 0.36, 0.05);
  const canopyPlum = palette.standard('#8A67AF', 0.8, 0.02);
  const canopyCream = palette.standard('#F4EAD6', 0.82, 0.02);

  // Grounded chassis & cabinet
  const counterBase = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.66, 0.92), cedarWarmMat);
  counterBase.position.y = 0.62;
  counterBase.castShadow = true;
  counterBase.receiveShadow = true;

  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.09, 1.04), creamMat);
  counterTop.position.y = 0.98;
  counterTop.castShadow = true;
  group.add(counterBase, counterTop);

  // Two spoked rear wheels + front support legs resting at y = 0
  for (const wz of [-0.5, 0.5]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 6, 14), cedarDarkMat);
    wheel.position.set(-0.56, 0.285, wz);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8), brassMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(-0.56, 0.285, wz);
    group.add(wheel, hub);

    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.3, 6), cedarDarkMat);
    leg.position.set(0.58, 0.15, wz * 0.76);
    group.add(leg);
  }

  // Push handle on right side
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.96, 6), cedarDarkMat);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0.92, 0.88, 0);
  group.add(handle);

  // Brass tea kettle + spout + ceramic teapot + 2 teacups
  const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), brassMat);
  kettle.scale.set(1.05, 0.88, 1.05);
  kettle.position.set(-0.28, 1.18, 0.06);
  const kettleLid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.05, 8), brassMat);
  kettleLid.position.set(-0.28, 1.35, 0.06);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.18, 6), brassMat);
  spout.position.set(-0.1, 1.22, 0.06);
  spout.rotation.z = -0.65;
  group.add(kettle, kettleLid, spout);

  for (const cx of [0.22, 0.44]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.05, 0.09, 8), ceramicMat);
    cup.position.set(cx, 1.07, -0.14 + (cx > 0.3 ? 0.22 : 0));
    group.add(cup);
  }

  // Four sturdy canopy posts supporting striped cloth roof
  for (const px of [-0.7, 0.7]) {
    for (const pz of [-0.42, 0.42]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.044, 1.06, 6), cedarDarkMat);
      post.position.set(px, 1.54, pz);
      post.castShadow = true;
      group.add(post);
    }
  }

  const stripeCount = 5;
  const stripeW = 1.78 / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(stripeW, 0.1, 1.24),
      i % 2 === 0 ? canopyPlum : canopyCream,
    );
    stripe.position.set(-0.89 + stripeW * (i + 0.5), 2.08, 0);
    stripe.castShadow = true;
    group.add(stripe);
  }

  return group;
}

export interface NoticeboardRig {
  group: THREE.Group;
  flyers: THREE.Mesh[];
}

/**
 * Neighborhood Noticeboard at (4.4, 0, -3.2) (CIRCLE_OBSTACLES r=0.75).
 * Shingled mini-gable canopy, cedar posts with stone shoes, cork backing,
 * and 3 independently toggleable pinned flyers (for Phase 4 NPC-driven board count).
 */
export function buildStorybookNoticeboard(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
  roofTex?: THREE.Texture,
): NoticeboardRig {
  const group = new THREE.Group();
  group.position.set(4.4, 0, -3.2);

  addContactShadow(group, shadowTex, 1.85, 1.25, 0.42, 0.018);

  const stoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.9, 0.02);
  const cedarMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.78, 0.04);
  const cedarWarmMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.75, 0.04);
  const corkMat = palette.standard('#CEB389', 0.88, 0.01);
  const roofMat = roofTex
    ? palette.get('nb_shingle_roof', { color: '#FFFFFF', roughness: 0.76, metalness: 0.04 })
    : palette.standard(STORYBOOK_PALETTE.shingleTerracotta, 0.76, 0.04);
  if (roofTex && !roofMat.map) {
    roofMat.map = roofTex;
    roofMat.needsUpdate = true;
  }

  for (const px of [-0.58, 0.58]) {
    const shoe = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.18, 6), stoneMat);
    shoe.position.set(px, 0.09, 0);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.72, 0.12), cedarMat);
    post.position.set(px, 0.94, 0);
    post.castShadow = true;
    group.add(shoe, post);
  }

  const frameBack = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.92, 0.12), cedarWarmMat);
  frameBack.position.y = 1.25;
  frameBack.castShadow = true;
  const cork = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.74, 0.14), corkMat);
  cork.position.y = 1.25;
  group.add(frameBack, cork);

  // Pitched protective mini roof hood
  const hoodShape = new THREE.Shape();
  hoodShape.moveTo(-0.28, 0);
  hoodShape.lineTo(0.28, 0);
  hoodShape.lineTo(0, 0.24);
  hoodShape.closePath();
  const hoodGeo = new THREE.ExtrudeGeometry(hoodShape, { depth: 1.52, bevelEnabled: false });
  hoodGeo.translate(0, 0, -0.76);
  hoodGeo.rotateY(Math.PI / 2);
  const hood = new THREE.Mesh(hoodGeo, roofMat);
  hood.position.set(0, 1.76, 0);
  hood.castShadow = true;
  group.add(hood);

  // 3 color-coded pinned flyers with brass pins
  const flyerSpecs: Array<{ x: number; y: number; rot: number; color: string }> = [
    { x: -0.32, y: 1.32, rot: 0.06, color: '#FAF2E1' },
    { x: 0.06, y: 1.24, rot: -0.05, color: '#F5DFB0' },
    { x: 0.36, y: 1.31, rot: 0.08, color: '#EAE5F5' },
  ];
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.24, 0.85);
  const flyers: THREE.Mesh[] = [];
  for (const fs of flyerSpecs) {
    const flyer = new THREE.Mesh(
      new THREE.BoxGeometry(0.29, 0.38, 0.025),
      palette.standard(fs.color, 0.88, 0.0),
    );
    flyer.position.set(fs.x, fs.y, 0.08);
    flyer.rotation.z = fs.rot;
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), brassMat);
    pin.position.set(0, 0.14, 0.018);
    flyer.add(pin);
    group.add(flyer);
    flyers.push(flyer);
  }

  return { group, flyers };
}
