import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CarryableItemId } from '../../game/types';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';
import { FountainRig, GazeboRig } from '../models';
import {
  createStorybookFountainWaterMaterial,
  createStorybookWaterStreamMaterial,
} from '../waterShaders';
import {
  addContactShadow,
} from './vegetation';
import { addStaticContactShadow } from '../contactShadows';

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

  addStaticContactShadow(group, shadowTex, 6.6, 6.6, 0.5, 0.02);

  const stoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.9, 0.02, {
    mapSet: 'stone',
    envMapIntensity: 0.35,
    groundGradient: 0.8,
  });
  const darkStoneMat = palette.standard(STORYBOOK_PALETTE.fieldstoneDark, 0.92, 0.02, {
    mapSet: 'stone',
    envMapIntensity: 0.35,
    groundGradient: 0.8,
  });
  const cedarDarkMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.78, 0.04, {
    mapSet: 'timber-dark',
    groundGradient: 2.4,
  });
  const cedarWarmMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.75, 0.04, {
    mapSet: 'timber-dark',
    groundGradient: 2.4,
  });
  const trimCreamMat = palette.standard(STORYBOOK_PALETTE.creamTrim, 0.76, 0.02, {
    mapSet: 'timber-light',
  });
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.24, 0.86, {
    envMapIntensity: 1.0,
  });
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

    // BUILD 02 (Doc 05 §2.2 P3): plinth top now overlaps the column base by
    // 0.05 (was a 0.03 kiss) — zoom-inspection can no longer catch a seam.
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.42), darkStoneMat);
    plinth.position.set(cx, 0.79, cz);
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
 * Full storybook centerpiece featuring:
 * - Two-step octagonal limestone apron, 8 carved buttress pilasters, and brass spring valve wheel
 * - LatheGeometry carved double-moulded basin wall & bullnose coping with corner moss tufts
 * - Weathered dry floor with autumn clog leaves/twigs before repair vs submerged lucky coins & river pebbles after
 * - Scalloped upper catch-bowl with 4 brass overflow weirs, 4 cardinal lion-spout jets, & top pineapple finial plume
 * - Custom onBeforeCompile water ripple shaders, TubeGeometry curved stream arcs, 5 splash ripple rings & 20 droplets
 */
export function buildStorybookFountain(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
): FountainRig {
  const group = new THREE.Group();
  group.position.set(0, 0, 1.5);

  addStaticContactShadow(group, shadowTex, 5.8, 5.8, 0.48, 0.02);

  const stoneMat = palette.standard(STORYBOOK_PALETTE.limestone, 0.88, 0.02, {
    mapSet: 'stone',
    envMapIntensity: 0.35,
    groundGradient: 2.6,
  });
  const darkStoneMat = palette.standard(STORYBOOK_PALETTE.fieldstoneDark, 0.91, 0.02, {
    mapSet: 'stone',
    envMapIntensity: 0.35,
    groundGradient: 2.6,
  });
  const curbMat = palette.standard(STORYBOOK_PALETTE.limestoneCurb, 0.86, 0.02, {
    mapSet: 'stone',
    envMapIntensity: 0.35,
    groundGradient: 2.6,
  });
  const mossMat = palette.standard(STORYBOOK_PALETTE.moss, 0.88, 0.0);
  const bronzeMat = palette.standard('#8E7043', 0.28, 0.82, { envMapIntensity: 0.85 });
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.24, 0.86, {
    envMapIntensity: 1.0,
  });
  const copperMat = palette.standard('#C9794E', 0.28, 0.82);
  const basinBedMat = palette.standard('#8E8475', 0.93, 0.0);
  const leafDryMat = palette.standard('#B86D3B', 0.86, 0.0);
  const twigMat = palette.standard(STORYBOOK_PALETTE.oakBark, 0.9, 0.0);

  // 1. Two-tier stepped octagonal stone plinth (staying within r <= 2.35 obstacle)
  const apronLower = new THREE.Mesh(new THREE.CylinderGeometry(2.44, 2.52, 0.09, 8), darkStoneMat);
  apronLower.position.y = 0.045;
  apronLower.receiveShadow = true;
  const apronUpper = new THREE.Mesh(new THREE.CylinderGeometry(2.30, 2.38, 0.09, 8), curbMat);
  apronUpper.position.y = 0.13;
  apronUpper.receiveShadow = true;
  group.add(apronLower, apronUpper);

  // 2. Hollow carved double-moulded stone basin wall (recessed floor y=0.50, inner r=1.90, outer r=2.26)
  const basinProfile = [
    new THREE.Vector2(0.0, 0.14),
    new THREE.Vector2(2.28, 0.14),
    new THREE.Vector2(2.28, 0.24),
    new THREE.Vector2(2.14, 0.30),
    new THREE.Vector2(2.15, 0.62),
    new THREE.Vector2(2.24, 0.68),
    new THREE.Vector2(2.20, 0.74),
    new THREE.Vector2(1.90, 0.74),
    new THREE.Vector2(1.88, 0.50),
    new THREE.Vector2(0.0, 0.50),
  ];
  const outerWall = new THREE.Mesh(new THREE.LatheGeometry(basinProfile, 24), stoneMat);
  outerWall.position.y = 0;
  outerWall.castShadow = true;
  outerWall.receiveShadow = true;
  group.add(outerWall);

  // 8 carved radial buttress corbels & bullnose coping ring
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.56, 0.22), curbMat);
    pilaster.position.set(Math.cos(a) * 2.16, 0.44, Math.sin(a) * 2.16);
    pilaster.rotation.y = -a + Math.PI / 2;
    pilaster.castShadow = true;
    pilaster.receiveShadow = true;
    group.add(pilaster);
  }

  const coping = new THREE.Mesh(new THREE.TorusGeometry(2.06, 0.18, 10, 28), stoneMat);
  coping.rotation.x = Math.PI / 2;
  coping.position.y = 0.73;
  coping.castShadow = true;
  coping.receiveShadow = true;
  group.add(coping);

  // 3. Dry weathered basin floor + clog debris (visible only before repair)
  const dryFloor = new THREE.Mesh(new THREE.CircleGeometry(1.90, 24), basinBedMat);
  dryFloor.rotation.x = -Math.PI / 2;
  dryFloor.position.y = 0.525;
  dryFloor.receiveShadow = true;
  group.add(dryFloor);

  const clogDebrisGroup = new THREE.Group();
  const leafSpecs: Array<[number, number, number]> = [
    [0.62, 0.54, 0.35],
    [-0.75, 0.54, 0.42],
    [0.24, 0.54, -0.82],
    [-0.45, 0.54, -0.58],
    [0.88, 0.54, -0.34],
    [-1.12, 0.54, 0.18],
    [0.12, 0.54, 1.05],
    [-0.18, 1.98, 0.38], // clogged leaf in upper bowl
    [0.28, 1.98, -0.26],
  ];
  for (let i = 0; i < leafSpecs.length; i++) {
    const [lx, ly, lz] = leafSpecs[i];
    const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 0), leafDryMat);
    leaf.scale.set(1.4, 0.24, 0.9);
    leaf.position.set(lx, ly, lz);
    leaf.rotation.y = i * 1.1;
    clogDebrisGroup.add(leaf);
  }
  const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.65, 5), twigMat);
  twig.position.set(-0.55, 0.54, 0.48);
  twig.rotation.z = Math.PI / 2;
  twig.rotation.y = 0.65;
  clogDebrisGroup.add(twig);
  group.add(clogDebrisGroup);

  // Submerged copper & brass wishing coins + river pebbles (revealed once repaired!)
  const submergedCoinsGroup = new THREE.Group();
  const glintCopperMat = palette.standard('#DF894F', 0.18, 0.88);
  const glintGoldMat = palette.standard('#F2C258', 0.18, 0.9);
  const pebbleSpots: Array<[number, number, number]> = [
    [0.72, 0.54, 0.55],
    [-0.95, 0.54, -0.45],
    [0.32, 0.54, -1.08],
    [-0.42, 0.54, 0.92],
    [1.18, 0.54, -0.25],
    [0.54, 0.54, 1.24],
    [-0.78, 0.54, 1.15],
    [1.26, 0.54, 0.72],
  ];
  for (let i = 0; i < pebbleSpots.length; i++) {
    const [px, py, pz] = pebbleSpots[i];
    if (i < 5) {
      const pebble = new THREE.Mesh(new THREE.SphereGeometry(0.08, 7, 5), curbMat);
      pebble.scale.set(1.25, 0.5, 1.0);
      pebble.position.set(px, py, pz);
      submergedCoinsGroup.add(pebble);
    }

    const coin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.068, 0.022, 10),
      i % 2 === 0 ? glintCopperMat : glintGoldMat,
    );
    coin.position.set(px * 0.84, py + 0.012, pz * 0.84);
    submergedCoinsGroup.add(coin);
  }
  submergedCoinsGroup.visible = false;
  group.add(submergedCoinsGroup);

  // Moss cushions hugging basin base & coping rim
  const mossSpots: Array<[number, number, number, number]> = [
    [2.12, 0.19, 0.65, 1.0],
    [-1.95, 0.19, -0.95, 0.9],
    [0.55, 0.19, -2.14, 0.85],
    [-1.45, 0.19, 1.62, 0.8],
    [-1.2, 0.83, 1.68, 0.62],
    [1.65, 0.83, -1.25, 0.58],
    [0.4, 0.83, 2.02, 0.52],
  ];
  // BUILD 02 (Doc 05 §3.2 P3): moss gradient on the basin stones — procedural
  // tint, not geometry. Waterline tufts read deep and damp; coping tufts catch
  // sun in a lighter sage. Deterministic by height, same mesh count.
  const mossWaterlineMat = palette.standard('#4C6E3E', 0.9, 0.0);
  const mossCopingMat = palette.standard(STORYBOOK_PALETTE.foliageSage, 0.86, 0.0);
  for (const [mx, my, mz, ms] of mossSpots) {
    const tone = my > 0.5 ? mossCopingMat : mossWaterlineMat;
    const tuft = new THREE.Mesh(new THREE.DodecahedronGeometry(0.24 * ms, 0), tone);
    tuft.scale.set(1.3, 0.55, 1.1);
    tuft.position.set(mx, my, mz);
    group.add(tuft);
  }

  // 4. Fluted sculpted center column + scalloped upper catch-bowl + top lotus cup (LatheGeometry)
  const colPoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.68, 0.0),
    new THREE.Vector2(0.60, 0.24),
    new THREE.Vector2(0.36, 0.44),
    new THREE.Vector2(0.31, 1.15),
    new THREE.Vector2(0.48, 1.32),
    new THREE.Vector2(1.04, 1.54),
    new THREE.Vector2(1.08, 1.70),
    new THREE.Vector2(0.88, 1.72),
    new THREE.Vector2(0.66, 1.60),
    new THREE.Vector2(0.29, 1.58),
    new THREE.Vector2(0.24, 1.98),
    new THREE.Vector2(0.38, 2.06),
    new THREE.Vector2(0.34, 2.12),
    new THREE.Vector2(0.0, 2.10),
  ];
  const fountainCore = new THREE.Mesh(new THREE.LatheGeometry(colPoints, 18), stoneMat);
  fountainCore.position.y = 0.36;
  fountainCore.castShadow = true;
  fountainCore.receiveShadow = true;
  group.add(fountainCore);

  // Brass spring valve handwheel on south-west pedestal collar (nod to Barnaby's repair!)
  const valveStem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 6), bronzeMat);
  valveStem.position.set(-0.34, 0.85, 0.34);
  valveStem.rotation.z = Math.PI / 4;
  valveStem.rotation.x = Math.PI / 4;
  const valveWheel = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.02, 6, 12), brassMat);
  valveWheel.position.set(-0.4, 0.85, 0.4);
  valveWheel.rotation.y = Math.PI / 4;
  group.add(valveStem, valveWheel);

  // Bronze pineapple/lotus crown finial + 4 cardinal sculpted lion-head spouts + 4 upper bowl weirs
  const finialBase = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.16, 10), bronzeMat);
  finialBase.position.y = 2.48;
  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.36, 10), brassMat);
  finial.position.y = 2.70;
  finial.castShadow = true;
  const finialTip = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), brassMat);
  finialTip.position.y = 2.86;
  group.add(finialBase, finial, finialTip);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 8), bronzeMat);
    boss.position.set(Math.cos(a) * 0.34, 1.50, Math.sin(a) * 0.34);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.082, 0.28, 8), brassMat);
    spout.position.set(Math.cos(a) * 0.45, 1.47, Math.sin(a) * 0.45);
    spout.rotation.z = -Math.cos(a) * 1.15;
    spout.rotation.x = Math.sin(a) * 1.15;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.016, 6, 10), brassMat);
    collar.position.set(Math.cos(a) * 0.54, 1.43, Math.sin(a) * 0.54);
    collar.rotation.y = -a + Math.PI / 2;

    // Upper bowl overflow weir lip at 45-degree diagonals
    const wa = a + Math.PI / 4;
    const weir = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.16), bronzeMat);
    weir.position.set(Math.cos(wa) * 0.99, 2.04, Math.sin(wa) * 0.99);
    weir.rotation.y = -wa + Math.PI / 2;

    group.add(boss, spout, collar, weir);
  }

  // 5. Animated Shader Water Pools (lower basin + upper catch-bowl)
  const waterMat = createStorybookFountainWaterMaterial();
  const waterMesh = new THREE.Mesh(new THREE.CircleGeometry(1.92, 28), waterMat);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.y = 0.655;

  const upperBowlWater = new THREE.Mesh(new THREE.CircleGeometry(0.84, 20), waterMat);
  upperBowlWater.position.z = 1.385; // World y = 0.655 + 1.385 = 2.04 inside upper catch-bowl
  waterMesh.add(upperBowlWater);

  // Expanding concentric splash ripple rings + aerated foam collars on lower water surface
  const splashRings: THREE.Mesh[] = [];
  const foamCollarMat = new THREE.MeshBasicMaterial({
    color: '#F2FCFE',
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  const ringLocations: Array<[number, number]> = [
    [0, 0],
    [1.2, 0],
    [-1.2, 0],
    [0, 1.2],
    [0, -1.2],
  ];
  for (let i = 0; i < ringLocations.length; i++) {
    const [rx, rz] = ringLocations[i];
    const rMat = new THREE.MeshBasicMaterial({
      color: '#E0F7FC',
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.28, 22), rMat);
    ring.position.set(rx, -rz, 0.014);
    ring.userData.phaseOffset = i * 0.23;
    waterMesh.add(ring);
    splashRings.push(ring);

    if (i > 0) {
      const collar = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.13, 14), foamCollarMat);
      collar.position.set(rx, -rz, 0.012);
      waterMesh.add(collar);
    }
  }

  waterMesh.visible = false;
  group.add(waterMesh);

  // 6. Sculpted Cascading Water Jets & Finial Crown Plume (visible when flowing)
  const cascadeGroup = new THREE.Group();
  const streamMat = createStorybookWaterStreamMaterial();

  // 4 cardinal spout parabolic water arcs
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const cx = Math.cos(a);
    const sz = Math.sin(a);
    const jetCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx * 0.55, 1.43, sz * 0.55),
      new THREE.Vector3(cx * 0.88, 1.36, sz * 0.88),
      new THREE.Vector3(cx * 1.12, 1.06, sz * 1.12),
      new THREE.Vector3(cx * 1.20, 0.64, sz * 1.20),
    ]);
    const jetMesh = new THREE.Mesh(new THREE.TubeGeometry(jetCurve, 14, 0.042, 6, false), streamMat);
    cascadeGroup.add(jetMesh);

    // 4 upper-bowl overflow weir spill ribbons
    const wa = a + Math.PI / 4;
    const wcx = Math.cos(wa);
    const wsz = Math.sin(wa);
    const weirCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(wcx * 0.98, 2.04, wsz * 0.98),
      new THREE.Vector3(wcx * 1.12, 1.72, wsz * 1.12),
      new THREE.Vector3(wcx * 1.14, 1.18, wsz * 1.14),
      new THREE.Vector3(wcx * 1.12, 0.64, wsz * 1.12),
    ]);
    const weirStream = new THREE.Mesh(new THREE.TubeGeometry(weirCurve, 12, 0.032, 5, false), streamMat);
    cascadeGroup.add(weirStream);

    // Top crown plume arching out of pineapple finial into upper catch-bowl
    const plumeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx * 0.04, 2.86, sz * 0.04),
      new THREE.Vector3(cx * 0.24, 3.16, sz * 0.24),
      new THREE.Vector3(cx * 0.48, 2.74, sz * 0.48),
      new THREE.Vector3(cx * 0.58, 2.02, sz * 0.58),
    ]);
    const plumeStream = new THREE.Mesh(new THREE.TubeGeometry(plumeCurve, 12, 0.026, 5, false), streamMat);
    cascadeGroup.add(plumeStream);
  }

  cascadeGroup.visible = false;
  group.add(cascadeGroup);

  // 7. 20 Pooled Ballistic Splash & Crown Spray Droplets
  const spoutParticles = new THREE.Group();
  const dropMat = palette.standard('#D7F4FA', 0.1, 0.08);
  const dropGeo = new THREE.SphereGeometry(0.068, 6, 6);
  for (let i = 0; i < 20; i++) {
    const drop = new THREE.Mesh(dropGeo, dropMat);
    drop.userData.phase = i / 20;
    drop.userData.kind = i < 8 ? 'crown' : 'basin';
    spoutParticles.add(drop);
  }
  spoutParticles.visible = false;
  group.add(spoutParticles);

  return {
    group,
    waterMesh,
    spoutParticles,
    clogDebrisGroup,
    submergedCoinsGroup,
    cascadeGroup,
    splashRings,
    waterMat,
    streamMat,
  };
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

  addStaticContactShadow(group, shadowTex, 2.35, 1.75, 0.45, 0.018);

  // Evident-craft families on the cart (V5 object gate, Doc 03 §8): timber grain
  // on the chassis, weave on the canopy cloth, kettle/cups answer the IBL.
  const cedarDarkMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.78, 0.04, {
    mapSet: 'timber-dark',
    groundGradient: 1.3,
  });
  const cedarWarmMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.74, 0.04, {
    mapSet: 'timber-dark',
    groundGradient: 1.3,
  });
  const creamMat = palette.standard(STORYBOOK_PALETTE.creamTrim, 0.78, 0.02, {
    mapSet: 'timber-light',
    groundGradient: 1.3,
  });
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.24, 0.85, {
    envMapIntensity: 1.0,
  });
  const ceramicMat = palette.standard(STORYBOOK_PALETTE.ceramicCream, 0.36, 0.05, {
    envMapIntensity: 0.6,
  });
  const canopyPlum = palette.standard('#8A67AF', 0.8, 0.02, { mapSet: 'fabric' });
  const canopyCream = palette.standard('#F4EAD6', 0.82, 0.02, { mapSet: 'fabric' });

  // Grounded chassis & cabinet
  const counterBase = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.66, 0.92), cedarWarmMat);
  counterBase.position.y = 0.62;
  counterBase.castShadow = true;
  counterBase.receiveShadow = true;

  const counterTop = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.09, 1.04), creamMat);
  counterTop.position.y = 0.98;
  counterTop.castShadow = true;
  group.add(counterBase, counterTop);

  // Two spoked rear wheels + front support legs resting at y = 0.
  // BUILD 02 (Doc 05 §2.2 P1, Doc 09 V5): the docstring promised "spoked rear
  // wooden wheels" — the geometry finally keeps that promise. Rim torus + 6
  // tapered spokes MERGED into one cedar geometry per wheel (mesh-neutral),
  // brass hub kept.
  const spokeGeosPerWheel: THREE.BufferGeometry[] = [];
  for (let sp = 0; sp < 6; sp++) {
    const spoke = new THREE.CylinderGeometry(0.016, 0.022, 0.42, 5);
    spoke.rotateZ((sp / 6) * Math.PI * 2);
    spoke.translate(
      Math.cos((sp / 6) * Math.PI * 2) * 0.115,
      Math.sin((sp / 6) * Math.PI * 2) * 0.115,
      0,
    );
    spokeGeosPerWheel.push(spoke);
  }
  const spokesGeo = mergeGeometries(spokeGeosPerWheel)!;
  for (const wz of [-0.5, 0.5]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 6, 14), cedarDarkMat);
    wheel.position.set(-0.56, 0.285, wz);
    wheel.castShadow = true;
    const spokes = new THREE.Mesh(spokesGeo, cedarWarmMat);
    spokes.name = 'wheel_spokes';
    spokes.position.set(-0.56, 0.285, wz);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8), brassMat);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(-0.56, 0.285, wz);
    group.add(wheel, spokes, hub);

    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.3, 6), cedarDarkMat);
    leg.position.set(0.58, 0.15, wz * 0.76);
    group.add(leg);
  }
  for (const g of spokeGeosPerWheel) g.dispose();

  // Push handle on right side — with a worn leather grip wrap where hands rest
  // (Doc 05 §3.2: wear accumulates where hands hold; CoC wear-accumulation).
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.96, 6), cedarDarkMat);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0.92, 0.88, 0);
  const gripWrap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.037, 0.037, 0.2, 8),
    palette.standard('#7C4F32', 0.7, 0.04, { mapSet: 'fabric' }),
  );
  gripWrap.name = 'handle_grip_wrap';
  gripWrap.rotation.x = Math.PI / 2;
  gripWrap.position.set(0.92, 0.88, -0.22);
  group.add(handle, gripWrap);

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
  for (let i = 0; i < 5; i++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(stripeW, 0.1, 1.24),
      i % 2 === 0 ? canopyPlum : canopyCream,
    );
    stripe.position.set(-0.89 + stripeW * (i + 0.5), 2.08, 0);
    stripe.castShadow = true;
    group.add(stripe);
  }

  // BUILD 02 (Doc 05 §2.2 P1, Doc 09 V5): the docstring's "scalloped
  // plum-cream striped awning" gains its scalloped valance — alternating
  // half-cylinder scallops hanging from both canopy edges, merged per color
  // (2 meshes) so the craft is mesh-light.
  const scallopPlumGeos: THREE.BufferGeometry[] = [];
  const scallopCreamGeos: THREE.BufferGeometry[] = [];
  const scallopCount = 7;
  for (const sz of [-1, 1]) {
    for (let i = 0; i < scallopCount; i++) {
      const scallop = new THREE.CylinderGeometry(0.092, 0.092, 0.11, 8, 1, false, 0, Math.PI);
      scallop.rotateX(Math.PI); // open downward
      scallop.rotateY(Math.PI / 2); // axis along X so the scallop row runs with the edge
      scallop.translate(-0.79 + i * (1.58 / (scallopCount - 1)), 2.015, sz * 0.625);
      const target = i % 2 === 0 ? scallopPlumGeos : scallopCreamGeos;
      target.push(scallop);
    }
  }
  const valancePlum = new THREE.Mesh(mergeGeometries(scallopPlumGeos)!, canopyPlum);
  const valanceCream = new THREE.Mesh(mergeGeometries(scallopCreamGeos)!, canopyCream);
  valancePlum.name = 'canopy_scalloped_valance';
  group.add(valancePlum, valanceCream);
  for (const g of [...scallopPlumGeos, ...scallopCreamGeos]) g.dispose();

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

  addStaticContactShadow(group, shadowTex, 1.85, 1.25, 0.42, 0.018);

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
  // BUILD 02 bevel sweep (Doc 05 §2.2 P3): the hood's visible edges soften.
  const hoodGeo = new THREE.ExtrudeGeometry(hoodShape, {
    depth: 1.52,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 1,
  });
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

/**
 * Handcrafted Plaza & Pond Cedar Bench pivoted at y = 0, facing +Z.
 * Seat surface rests cleanly at y = 0.36 to match SEAT_SPOTS[].seatHeight, with
 * deepened seat slats and recessed backrest (-0.29..-0.32) so seated characters never clip the backrest.
 */
export function buildStorybookBench(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
): THREE.Group {
  const group = new THREE.Group();
  addStaticContactShadow(group, shadowTex, 1.6, 1.02, 0.44, 0.018);

  const ironMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.38, 0.75, {
    envMapIntensity: 0.5,
  });
  const cedarMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.78, 0.03, {
    mapSet: 'timber-dark',
    groundGradient: 0.7,
  });
  const cedarDarkMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.82, 0.03, {
    mapSet: 'timber-dark',
    groundGradient: 0.7,
  });
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.24, 0.85, {
    envMapIntensity: 1.0,
  });

  // Two scrolled iron leg frames (front legs at z=+0.22, recessed tilted backrest stiles at z=-0.27)
  for (const sx of [-0.54, 0.54]) {
    const legFront = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.06), ironMat);
    legFront.position.set(sx, 0.18, 0.22);
    legFront.castShadow = true;

    const legRearBase = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.06), ironMat);
    legRearBase.position.set(sx, 0.18, -0.22);
    legRearBase.castShadow = true;

    const backrestStile = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.50, 0.055), ironMat);
    backrestStile.position.set(sx, 0.57, -0.295);
    backrestStile.rotation.x = -0.16;
    backrestStile.castShadow = true;

    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.055, 0.52), ironMat);
    rail.position.set(sx, 0.31, 0.01);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.045, 0.44), cedarDarkMat);
    arm.position.set(sx, 0.51, 0.01);
    arm.castShadow = true;

    const armPost = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.19, 6), ironMat);
    armPost.position.set(sx, 0.415, 0.19);

    group.add(legFront, legRearBase, backrestStile, rail, arm, armPost);
  }

  // Decorative center wrought-iron vertical backrest spindle + stretcher
  const stretcher = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.08, 6), ironMat);
  stretcher.rotation.z = Math.PI / 2;
  stretcher.position.set(0, 0.16, -0.04);
  const centerSpindle = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.44, 0.04), ironMat);
  centerSpindle.position.set(0, 0.56, -0.295);
  centerSpindle.rotation.x = -0.16;
  group.add(stretcher, centerSpindle);

  // Four contoured cedar seat slats spanning z = -0.215..+0.265, top cleanly at y = 0.365.
  // BUILD 02 (Doc 05 §3.2 P2): each slat gains a crowned center bulge (lathe-
  // profile extrusion + micro-bevel) — the seat reads as planed timber parts,
  // not planes. Same mesh count; the seat contract (top y 0.365) is preserved
  // by the profile's 0.052 peak landing exactly on the old box top.
  const slatProfile = new THREE.Shape();
  slatProfile.moveTo(-0.0475, -0.0225);
  slatProfile.lineTo(-0.0475, 0.0225);
  slatProfile.quadraticCurveTo(0, 0.0375, 0.0475, 0.0225); // crown peak ≈ +0.030
  slatProfile.lineTo(0.0475, -0.0225);
  slatProfile.closePath();
  const slatGeo = new THREE.ExtrudeGeometry(slatProfile, {
    depth: 1.18,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 1,
  });
  slatGeo.rotateY(Math.PI / 2); // extrusion axis becomes X (the slat length)
  slatGeo.translate(0, 0.3425, 0); // profile bottom lands at 0.32; edge top at 0.365
  for (const sz of [-0.17, -0.04, 0.09, 0.22]) {
    const slat = new THREE.Mesh(slatGeo, cedarMat);
    slat.position.set(0, 0, sz);
    slat.castShadow = true;
    slat.receiveShadow = true;
    group.add(slat);
  }

  // BUILD 02 (Doc 05 §3.2 P2): wool winter seat cushions — seasonal group
  // (hidden by default; the canvas shows it in winter, matching the interior
  // knit language). Named + collected via `group.userData.winterCushions`.
  const cushionGroup = new THREE.Group();
  cushionGroup.name = 'winter_seat_cushion';
  const woolMat = palette.standard('#B3554A', 0.86, 0.0, { mapSet: 'fabric' });
  const woolMatB = palette.standard('#C86446', 0.86, 0.0, { mapSet: 'fabric' });
  for (const [sz, mat] of [
    [-0.1, woolMat],
    [0.14, woolMatB],
  ] as const) {
    const cushion = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), mat);
    cushion.scale.set(3.6, 0.42, 1.25);
    cushion.position.set(0, 0.375, sz);
    cushion.castShadow = true;
    cushionGroup.add(cushion);
  }
  cushionGroup.visible = false;
  group.userData.winterCushions = cushionGroup;
  group.add(cushionGroup);

  // Two recessed angled backrest slats (front face cleanly behind z = -0.262 so seated characters never pass through)
  const backSpecs: Array<{ y: number; z: number }> = [
    { y: 0.54, z: -0.288 },
    { y: 0.71, z: -0.316 },
  ];
  for (const bs of backSpecs) {
    const backSlat = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.105, 0.044), cedarMat);
    backSlat.position.set(0, bs.y, bs.z);
    backSlat.rotation.x = -0.16;
    backSlat.castShadow = true;
    group.add(backSlat);

    for (const bx of [-0.54, 0.54]) {
      const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), brassMat);
      bolt.position.set(bx, bs.y, bs.z + 0.024);
      group.add(bolt);
    }
  }

  group.userData.backrestFrontZ = -0.262;
  group.userData.seatTopY = 0.365;
  return group;
}

/**
 * Handcrafted multi-part carryable neighborhood props pivoted at y = 0.
 * Stores optional ground contact shadow on `group.userData.shadowMesh` so holding hides shadow cleanly.
 */
export function buildCarryablePropMesh(
  id: CarryableItemId,
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
): THREE.Group {
  const group = new THREE.Group();
  addContactShadow(group, shadowTex, 0.62, 0.62, 0.4, 0.018);
  group.userData.shadowMesh = group.children[0];

  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.24, 0.85);
  const ironMat = palette.standard(STORYBOOK_PALETTE.wroughtIron, 0.42, 0.72);
  const cedarMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.78, 0.03);
  const creamMat = palette.standard(STORYBOOK_PALETTE.creamTrim, 0.86, 0.01);

  if (id === 'water_pail') {
    const copperMat = palette.standard('#C9794E', 0.34, 0.72);
    const waterMat = palette.standard('#6CB9C9', 0.14, 0.12);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.125, 0.25, 12), copperMat);
    body.position.y = 0.125;
    body.castShadow = true;
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.014, 6, 14), brassMat);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = 0.19;
    const waterDisc = new THREE.Mesh(new THREE.CircleGeometry(0.138, 12), waterMat);
    waterDisc.rotation.x = -Math.PI / 2;
    waterDisc.position.y = 0.23;
    const bail = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.012, 6, 14, Math.PI), ironMat);
    bail.position.y = 0.24;
    group.add(body, hoop, waterDisc, bail);
  } else if (id === 'rosemary_basket') {
    const wickerMat = palette.standard('#B88952', 0.86, 0.01);
    const crustMat = palette.standard('#D79045', 0.82, 0.0);
    const herbMat = palette.standard(STORYBOOK_PALETTE.foliageSage, 0.78, 0.01);
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.14, 0.15, 10), wickerMat);
    basket.position.y = 0.075;
    basket.castShadow = true;
    const cloth = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.185, 0.04, 10), creamMat);
    cloth.position.y = 0.14;
    const loaf = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.15, 4, 8), crustMat);
    loaf.rotation.z = Math.PI / 2;
    loaf.position.set(0, 0.175, 0);
    loaf.castShadow = true;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.016, 6, 12, Math.PI), wickerMat);
    handle.position.y = 0.15;
    group.add(basket, cloth, loaf, handle);
    for (let i = -1; i <= 1; i++) {
      const sprig = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.13, 5), herbMat);
      sprig.position.set(i * 0.055, 0.21, 0.08);
      sprig.rotation.x = 0.45;
      sprig.rotation.z = -i * 0.22;
      group.add(sprig);
    }
  } else if (id === 'chalk_bundle') {
    const twineMat = palette.standard('#8C6A47', 0.88, 0.0);
    const slateMat = palette.standard('#5D7082', 0.82, 0.04);
    const baseCard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.2), slateMat);
    baseCard.position.y = 0.015;
    baseCard.castShadow = true;
    group.add(baseCard);

    const pastelHexes = ['#EFC663', '#84B7D6', '#E58A94', '#FAF2E1'];
    for (let i = 0; i < pastelHexes.length; i++) {
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, 0.19, 8),
        palette.standard(pastelHexes[i], 0.9, 0.0),
      );
      stick.rotation.z = Math.PI / 2;
      stick.rotation.y = (i - 1.5) * 0.08;
      stick.position.set(0, 0.06 + (i % 2) * 0.036, (i - 1.5) * 0.038);
      stick.castShadow = true;
      group.add(stick);
    }
    const twine = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.011, 6, 12), twineMat);
    twine.rotation.y = Math.PI / 2;
    twine.position.set(0, 0.07, 0);
    group.add(twine);
  } else if (id === 'tea_tray') {
    const glazeMat = palette.standard('#8BB6B5', 0.28, 0.08);
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.26), cedarMat);
    tray.position.y = 0.015;
    tray.castShadow = true;
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), glazeMat);
    pot.scale.set(1, 0.88, 1);
    pot.position.set(-0.06, 0.095, 0);
    pot.castShadow = true;
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), brassMat);
    lid.position.set(-0.06, 0.175, 0);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.07, 6), glazeMat);
    spout.position.set(0.02, 0.11, 0);
    spout.rotation.z = -0.7;
    group.add(tray, pot, lid, spout);

    for (const cz of [-0.055, 0.055]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.026, 0.048, 8), creamMat);
      cup.position.set(0.085, 0.054, cz);
      group.add(cup);
    }
  } else {
    // lost_parcel
    const kraftMat = palette.standard('#C9A574', 0.86, 0.0);
    const sealMat = palette.standard(STORYBOOK_PALETTE.terracottaPot, 0.52, 0.04);
    const twineMat = palette.standard('#6E513A', 0.88, 0.0);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.15, 0.22), kraftMat);
    box.position.y = 0.075;
    box.castShadow = true;
    const wrapA = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.158, 0.022), twineMat);
    wrapA.position.y = 0.075;
    const wrapB = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.158, 0.23), twineMat);
    wrapB.position.y = 0.075;
    const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.034, 0.016, 10), sealMat);
    seal.position.set(0, 0.156, 0);
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.05), creamMat);
    tag.position.set(0.06, 0.155, 0.04);
    tag.rotation.y = 0.35;
    group.add(box, wrapA, wrapB, seal, tag);
  }

  return group;
}

