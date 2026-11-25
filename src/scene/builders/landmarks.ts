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
/**
 * Hero Centerpiece Landmark: Circular Two-Tier Plaza Fountain at (0, 0, 1.5)
 * (CIRCLE_OBSTACLES 'fountain_basin' r=2.46, true basin center (0, 1.5)).
 * WORLD-QUALITY OVERHAUL rebuild (Doc 04 §5) matching the approved reference:
 * a fully circular two-tier cream-stone fountain —
 * - Circular 32-seg limestone apron (fieldstoneDark base step + limestoneCurb cap)
 *   ringed by 10 partially-sunk rounded moss/grey stones (Dodecahedron, squashed)
 * - LatheGeometry carved basin (outer r 2.44, rim seat y 0.84, floor y 0.50, 32-seg)
 *   capped by a thick bullnose limestoneCurb coping torus (r 2.21 tube 0.19, 16×48)
 * - LatheGeometry pedestal: foot r 0.62 → column → wide lower bowl r 1.15 (y 1.56)
 *   → stem → upper tier r 0.72 (y 2.26) → bronze+brass pineapple crown finial (tip y 2.86)
 * - 6 tilted agedBrass spouts on the upper-tier rim + 6 bronze overflow weir lips
 * - PALE-BLUE onBeforeCompile water (#BFE3EF family): basin disc (r 2.20, y 0.62) +
 *   lower-bowl disc (r 0.94, y 1.50) + upper-tier disc (r 0.65, y 2.20) sharing one
 *   material, 5 animated splash ripple rings + merged foam collars
 * - 14 CatmullRom stream tubes MERGED into one mesh (6 jets upper→lower bowl,
 *   6 weir arcs lower bowl→basin landing at r ≈ 1.22, 2 crown plumes from the finial)
 * - 28 ballistic droplets (8 'crown' + 20 'basin' kinds — envRenderer contract)
 * - Narrative states kept: dry clog debris (leaves/twig) before repair, submerged
 *   lucky coins & river pebbles after, Barnaby's brass spring valve handwheel
 * - Static masonry is MERGED per material (BufferGeometryUtils.mergeGeometries):
 *   structured flowing scene = 25 draw calls (28 contract-required droplet sprites extra)
 */
export const STORYBOOK_FOUNTAIN_SPEC = {
  anchor: { x: 0, z: 1.5 },
  apronOuterRadius: 2.6,
  basinOuterRadius: 2.44,
  copingRadius: 2.21,
  copingTube: 0.19,
  copingOuterRadius: 2.4,
  rimSeatY: 0.84,
  waterY: 0.62,
  basinFloorY: 0.5,
  // Stage 3 spatial redesign (Slice F1): the fountain was measured SHORTER than
  // every house roof (old finial tip 2.86 vs roof peaks ≈ 4.3) — visually a
  // birdbath in the plaza's heart. The vertical composition is re-tiered so the
  // crown reads as the plaza's landmark at every camera zoom while the FOOTPRINT
  // (basin/coping/apron radii, collision r 2.46) stays byte-identical: all
  // clearance contracts, wish metrics and NPC circulation are untouched.
  lowerBowlRimRadius: 1.3,
  lowerBowlRimY: 2.3,
  lowerBowlWaterY: 2.24,
  upperTierRimRadius: 0.85,
  upperTierRimY: 3.3,
  upperTierWaterY: 3.24,
  finialTipY: 4.45,
  weirLandingRadius: 1.22,
  waterColorHex: '#BFE3EF',
  dropletCount: 28,
  crownDroplets: 8,
  basinDroplets: 20,
  spoutCount: 6,
  weirCount: 6,
  plumeCount: 2,
  stoneRingCount: 10,
  masonryMeshBudget: 6,
} as const;

export function buildStorybookFountain(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
): FountainRig {
  const group = new THREE.Group();
  group.position.set(STORYBOOK_FOUNTAIN_SPEC.anchor.x, 0, STORYBOOK_FOUNTAIN_SPEC.anchor.z);

  addStaticContactShadow(group, shadowTex, 6.2, 6.2, 0.48, 0.02);

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
  const mossWaterlineMat = palette.standard('#4C6E3E', 0.9, 0.0);
  const mossCopingMat = palette.standard(STORYBOOK_PALETTE.foliageSage, 0.86, 0.0);
  const stoneGreyMat = palette.standard('#8E8B84', 0.92, 0.0, { mapSet: 'stone' });
  const stoneMossMat = palette.standard(STORYBOOK_PALETTE.moss, 0.92, 0.0);
  const bronzeMat = palette.standard('#8E7043', 0.28, 0.82, { envMapIntensity: 0.85 });
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.24, 0.86, {
    envMapIntensity: 1.0,
  });
  const basinBedMat = palette.standard('#8E8475', 0.93, 0.0);
  const leafDryMat = palette.standard('#B86D3B', 0.86, 0.0);
  const twigMat = palette.standard(STORYBOOK_PALETTE.oakBark, 0.9, 0.0);

  // ---------------------------------------------------------------- helpers
  // Transform-baking for per-material merged static geometry (same pattern as
  // the tea-cart valance: build parts, bake transforms, mergeGeometries, dispose).
  const scratch = new THREE.Object3D();
  function baked(
    geo: THREE.BufferGeometry,
    pos: [number, number, number],
    rot?: [number, number, number],
    scale?: [number, number, number],
  ): THREE.BufferGeometry {
    scratch.position.set(pos[0], pos[1], pos[2]);
    scratch.rotation.set(rot?.[0] ?? 0, rot?.[1] ?? 0, rot?.[2] ?? 0);
    scratch.scale.set(scale?.[0] ?? 1, scale?.[1] ?? 1, scale?.[2] ?? 1);
    scratch.updateMatrix();
    geo.applyMatrix4(scratch.matrix);
    return geo;
  }
  function mergeIntoMesh(
    geos: THREE.BufferGeometry[],
    mat: THREE.Material,
    name: string,
    shadows = true,
  ): THREE.Mesh {
    const merged = mergeGeometries(geos)!;
    for (const g of geos) g.dispose();
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = name;
    mesh.castShadow = shadows;
    mesh.receiveShadow = shadows;
    return mesh;
  }

  // 1. Circular two-step limestone apron (32-seg, fully round per reference).
  //    apronLower stays a standalone CylinderGeometry mesh: the clearance test
  //    measures its footprint against player boots at the walkable rim (2.95).
  const apronLower = new THREE.Mesh(
    new THREE.CylinderGeometry(2.52, STORYBOOK_FOUNTAIN_SPEC.apronOuterRadius, 0.09, 32),
    darkStoneMat,
  );
  apronLower.position.y = 0.045;
  apronLower.receiveShadow = true;
  apronLower.castShadow = true;
  const apronUpper = new THREE.Mesh(new THREE.CylinderGeometry(2.42, 2.5, 0.09, 32), curbMat);
  apronUpper.position.y = 0.135;
  apronUpper.receiveShadow = true;
  apronUpper.castShadow = true;
  group.add(apronLower, apronUpper);

  // 2. Carved stone basin (LatheGeometry 32-seg, standalone for the wall/clearance
  //    contracts): outer wall r 2.44 up to rim seat y 0.84, inner waterline r 2.235,
  //    weathered floor at y 0.50.
  const basinProfile = [
    new THREE.Vector2(0.0, 0.16),
    new THREE.Vector2(2.44, 0.16),
    new THREE.Vector2(2.44, 0.26),
    new THREE.Vector2(2.35, 0.33),
    new THREE.Vector2(2.37, 0.6),
    new THREE.Vector2(2.41, 0.72),
    new THREE.Vector2(2.38, 0.82),
    new THREE.Vector2(2.25, 0.84),
    new THREE.Vector2(2.23, 0.7),
    new THREE.Vector2(2.24, 0.58),
    new THREE.Vector2(2.21, 0.5),
    new THREE.Vector2(0.0, 0.5),
  ];
  const basinLathe = new THREE.Mesh(
    new THREE.LatheGeometry(basinProfile, 32),
    stoneMat,
  );
  basinLathe.name = 'fountain_basin_lathe';
  basinLathe.castShadow = true;
  basinLathe.receiveShadow = true;
  group.add(basinLathe);

  // 3. Thick bullnose coping torus capping the rim (standalone TorusGeometry mesh
  //    for the same clearance contract). Outer reach 2.40 keeps 0.015 of margin to
  //    the measured player body reach (2.465) at the walkable rim.
  const coping = new THREE.Mesh(
    new THREE.TorusGeometry(
      STORYBOOK_FOUNTAIN_SPEC.copingRadius,
      STORYBOOK_FOUNTAIN_SPEC.copingTube,
      16,
      48,
    ),
    curbMat,
  );
  coping.rotation.x = Math.PI / 2;
  coping.position.y = 0.79;
  coping.castShadow = true;
  coping.receiveShadow = true;
  group.add(coping);

  // 4. Sculpted pedestal (LatheGeometry 32-seg): foot r 0.72 -> column -> wide
  //    lower bowl (rim r 1.30 @ world y 2.30) -> stem -> upper tier (rim r 0.85 @
  //    world y 3.30) -> centre stub under the crown finial (top y 3.62). Origin on
  //    basin floor. Slice F1: re-tiered vertical composition — see SPEC comment.
  const pedestalProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.72, 0.0),
    new THREE.Vector2(0.62, 0.16),
    new THREE.Vector2(0.34, 0.3),
    new THREE.Vector2(0.3, 0.85),
    new THREE.Vector2(0.5, 1.0),
    new THREE.Vector2(0.6, 1.1),
    new THREE.Vector2(1.16, 1.7),
    new THREE.Vector2(1.3, 1.8),
    new THREE.Vector2(1.2, 1.84),
    new THREE.Vector2(1.06, 1.76),
    new THREE.Vector2(0.95, 1.68),
    new THREE.Vector2(0.42, 1.72),
    new THREE.Vector2(0.38, 1.86),
    new THREE.Vector2(0.34, 2.24),
    new THREE.Vector2(0.58, 2.4),
    new THREE.Vector2(0.8, 2.58),
    new THREE.Vector2(0.85, 2.8),
    new THREE.Vector2(0.78, 2.84),
    new THREE.Vector2(0.68, 2.76),
    new THREE.Vector2(0.36, 2.78),
    new THREE.Vector2(0.2, 3.0),
    new THREE.Vector2(0.0, 3.12),
  ];
  const pedestal = new THREE.Mesh(new THREE.LatheGeometry(pedestalProfile, 32), stoneMat);
  pedestal.name = 'fountain_pedestal_lathe';
  pedestal.position.y = STORYBOOK_FOUNTAIN_SPEC.basinFloorY;
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  group.add(pedestal);

  // 5. Brass spring valve handwheel on the pedestal foot (Barnaby's repair nod)
  const valveStem = baked(
    new THREE.CylinderGeometry(0.035, 0.035, 0.14, 6),
    [-0.39, 0.74, 0.39],
    [Math.PI / 4, 0, Math.PI / 4],
  );
  const valveWheel = baked(
    new THREE.TorusGeometry(0.095, 0.02, 6, 12),
    [-0.45, 0.74, 0.45],
    [0, Math.PI / 4, 0],
  );

  // 6. Bronze pineapple/lotus crown finial (tip sphere at y 4.45 — the crown
  //    droplets' animation anchor in environmentRenderer reads the SPEC).
  const finialBase = baked(new THREE.CylinderGeometry(0.18, 0.24, 0.18, 10), [0, 3.66, 0]);
  const finial = baked(new THREE.ConeGeometry(0.16, 0.72, 10), [0, 4.09, 0]);
  const finialTip = baked(new THREE.SphereGeometry(0.075, 8, 8), [0, 4.45, 0]);

  // 7. 6 tilted brass spouts on the upper-tier rim (30° offsets) + 6 bronze weir
  //    lips on the lower-bowl rim (60° grid). All merged per material.
  const brassParts: THREE.BufferGeometry[] = [valveWheel, finial, finialTip];
  const bronzeParts: THREE.BufferGeometry[] = [valveStem, finialBase];
  for (let i = 0; i < STORYBOOK_FOUNTAIN_SPEC.spoutCount; i++) {
    const a = (i / STORYBOOK_FOUNTAIN_SPEC.spoutCount) * Math.PI * 2 + Math.PI / 6;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    brassParts.push(
      baked(new THREE.CylinderGeometry(0.042, 0.068, 0.26, 8), [ca * 0.74, 3.38, sa * 0.74], [
        sa * 1.05,
        0,
        -ca * 1.05,
      ]),
    );
    brassParts.push(
      baked(new THREE.TorusGeometry(0.052, 0.015, 6, 10), [ca * 0.84, 3.34, sa * 0.84], [
        0,
        -a + Math.PI / 2,
        0,
      ]),
    );
    bronzeParts.push(baked(new THREE.SphereGeometry(0.075, 8, 8), [ca * 0.68, 3.36, sa * 0.68]));
  }
  for (let i = 0; i < STORYBOOK_FOUNTAIN_SPEC.weirCount; i++) {
    const a = (i / STORYBOOK_FOUNTAIN_SPEC.weirCount) * Math.PI * 2;
    bronzeParts.push(
      baked(new THREE.BoxGeometry(0.16, 0.075, 0.18), [Math.cos(a) * 1.26, 2.32, Math.sin(a) * 1.26], [
        0,
        -a + Math.PI / 2,
        0,
      ]),
    );
  }
  const brassMerged = mergeIntoMesh(brassParts, brassMat, 'fountain_brass_merged');
  const bronzeMerged = mergeIntoMesh(bronzeParts, bronzeMat, 'fountain_bronze_merged');
  group.add(brassMerged, bronzeMerged);

  // 8. Weathered dry basin floor (visible until repair; hidden under the water disc)
  const dryFloor = new THREE.Mesh(new THREE.CircleGeometry(2.19, 32), basinBedMat);
  dryFloor.rotation.x = -Math.PI / 2;
  dryFloor.position.y = 0.505;
  dryFloor.receiveShadow = true;
  group.add(dryFloor);

  // 9. Autumn clog debris (dry state only) — leaves merged into one mesh + twig
  const clogDebrisGroup = new THREE.Group();
  const leafSpecs: Array<[number, number, number]> = [
    [0.62, 0.515, 0.35],
    [-0.75, 0.515, 0.42],
    [0.24, 0.515, -0.82],
    [-0.45, 0.515, -0.58],
    [0.88, 0.515, -0.34],
    [-1.12, 0.515, 0.18],
    [0.12, 0.515, 1.05],
    [-0.3, 2.18, 0.34], // clogged leaf in the upper tier
    [0.22, 2.18, -0.26],
    [0.62, 1.46, 0.4], // leaf riding the lower bowl
  ];
  const leafGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < leafSpecs.length; i++) {
    const [lx, ly, lz] = leafSpecs[i];
    leafGeos.push(
      baked(new THREE.DodecahedronGeometry(0.11, 0), [lx, ly, lz], [0, i * 1.1, 0], [1.4, 0.24, 0.9]),
    );
  }
  const leavesMerged = mergeIntoMesh(leafGeos, leafDryMat, 'fountain_clog_leaves');
  clogDebrisGroup.add(leavesMerged);
  const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.65, 5), twigMat);
  twig.position.set(-0.55, 0.53, 0.48);
  twig.rotation.z = Math.PI / 2;
  twig.rotation.y = 0.65;
  clogDebrisGroup.add(twig);
  group.add(clogDebrisGroup);

  // 10. Submerged copper & brass wishing coins + river pebbles (revealed once repaired)
  const submergedCoinsGroup = new THREE.Group();
  const glintCopperMat = palette.standard('#DF894F', 0.18, 0.88);
  const glintGoldMat = palette.standard('#F2C258', 0.18, 0.9);
  const pebbleSpots: Array<[number, number, number]> = [
    [0.72, 0.515, 0.55],
    [-0.95, 0.515, -0.45],
    [0.32, 0.515, -1.08],
    [-0.42, 0.515, 0.92],
    [1.18, 0.515, -0.25],
  ];
  const pebbleGeos: THREE.BufferGeometry[] = [];
  for (const [px, py, pz] of pebbleSpots) {
    pebbleGeos.push(baked(new THREE.SphereGeometry(0.08, 7, 5), [px, py, pz], undefined, [1.25, 0.5, 1.0]));
  }
  submergedCoinsGroup.add(mergeIntoMesh(pebbleGeos, curbMat, 'fountain_pebbles_merged'));
  const coinSpots: Array<[number, number]> = [
    [0.6, 0.46],
    [-0.8, -0.38],
    [0.27, -0.91],
    [-0.35, 0.77],
    [0.99, -0.21],
    [0.45, 1.04],
    [-0.66, 0.97],
    [1.06, 0.6],
  ];
  const copperGeos: THREE.BufferGeometry[] = [];
  const goldGeos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < coinSpots.length; i++) {
    const [px, pz] = coinSpots[i];
    (i % 2 === 0 ? copperGeos : goldGeos).push(
      baked(new THREE.CylinderGeometry(0.068, 0.068, 0.022, 10), [px, 0.527, pz]),
    );
  }
  submergedCoinsGroup.add(mergeIntoMesh(copperGeos, glintCopperMat, 'fountain_coins_copper'));
  submergedCoinsGroup.add(mergeIntoMesh(goldGeos, glintGoldMat, 'fountain_coins_gold'));
  submergedCoinsGroup.visible = false;
  group.add(submergedCoinsGroup);

  // 11. Moss cushions hugging the apron/basin seam & the coping rim (merged per tone)
  const mossSpots: Array<[number, number, number, number, boolean]> = [
    [2.34, 0.2, 0.72, 1.0, false],
    [-2.16, 0.2, -1.06, 0.9, false],
    [0.61, 0.2, -2.38, 0.85, false],
    [-1.62, 0.2, 1.8, 0.8, false],
    [-1.34, 0.99, 1.86, 0.62, true],
    [1.86, 0.99, -1.4, 0.58, true],
    [0.45, 0.99, 2.24, 0.52, true],
  ];
  const mossWaterlineGeos: THREE.BufferGeometry[] = [];
  const mossCopingGeos: THREE.BufferGeometry[] = [];
  for (const [mx, my, mz, ms, onRim] of mossSpots) {
    const geo = baked(
      new THREE.DodecahedronGeometry(0.24 * ms, 0),
      [mx, my, mz],
      undefined,
      [1.3, 0.55, 1.1],
    );
    (onRim ? mossCopingGeos : mossWaterlineGeos).push(geo);
  }
  const mossWaterline = mergeIntoMesh(mossWaterlineGeos, mossWaterlineMat, 'fountain_moss_waterline');
  const mossCoping = mergeIntoMesh(mossCopingGeos, mossCopingMat, 'fountain_moss_coping');
  group.add(mossWaterline, mossCoping);

  // 12. Rounded decorative stone ring around the apron (reference: small green/grey
  //     stones, partially sunk). 10 squashed dodecas at r ≈ 2.84, angles jittered
  //     off the 4 cardinal approach axes.
  const stoneSpecs: Array<[number, number, number, boolean]> = [
    [0.31, 2.82, 0.18, false],
    [0.94, 2.84, 0.16, true],
    [1.52, 2.79, 0.17, false],
    [2.2, 2.83, 0.15, true],
    [2.78, 2.8, 0.18, false],
    [3.4, 2.84, 0.16, true],
    [3.94, 2.8, 0.18, false],
    [4.52, 2.83, 0.15, true],
    [5.1, 2.8, 0.18, false],
    [5.68, 2.84, 0.16, true],
  ];
  const stoneGreyGeos: THREE.BufferGeometry[] = [];
  const stoneMossGeos: THREE.BufferGeometry[] = [];
  for (const [a, r, size, mossy] of stoneSpecs) {
    const geo = baked(
      new THREE.DodecahedronGeometry(size, 0),
      [Math.cos(a) * r, 0.02, Math.sin(a) * r],
      [0, a * 1.7, 0],
      [1.15, 0.5, 0.9],
    );
    (mossy ? stoneMossGeos : stoneGreyGeos).push(geo);
  }
  const stonesGrey = mergeIntoMesh(stoneGreyGeos, stoneGreyMat, 'fountain_stone_ring_grey');
  const stonesMoss = mergeIntoMesh(stoneMossGeos, stoneMossMat, 'fountain_stone_ring_moss');
  stonesGrey.userData.stoneRingCount = stoneGreyGeos.length;
  stonesMoss.userData.stoneRingCount = stoneMossGeos.length;
  group.add(stonesGrey, stonesMoss);

  // 13. Animated pale-blue shader water: basin disc (rig contract mesh) + lower-bowl
  //     & upper-tier discs as children sharing the material (old child pattern kept:
  //     local +z of the rotated parent maps to world +y).
  const waterMat = createStorybookFountainWaterMaterial();
  const waterMesh = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), waterMat);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.y = STORYBOOK_FOUNTAIN_SPEC.waterY;
  // FLICKER FIX T1 (investigation R5/E-H5): deterministic transparent order — water
  // layer 2, its above-surface decal children (splash rings / foam / cascades) layer 3,
  // so far-side rings no longer veil under the depth-writing water disc when the
  // camera-relative sort flips sides during orbit.
  waterMesh.renderOrder = 2;

  const lowerBowlWater = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), waterMat);
  lowerBowlWater.position.z =
    STORYBOOK_FOUNTAIN_SPEC.lowerBowlWaterY - STORYBOOK_FOUNTAIN_SPEC.waterY; // world y 2.24 inside the lower bowl
  waterMesh.add(lowerBowlWater);

  const upperTierWater = new THREE.Mesh(new THREE.CircleGeometry(0.78, 20), waterMat);
  upperTierWater.position.z =
    STORYBOOK_FOUNTAIN_SPEC.upperTierWaterY - STORYBOOK_FOUNTAIN_SPEC.waterY; // world y 3.24 inside the upper tier
  waterMesh.add(upperTierWater);

  // Expanding concentric splash ripple rings + merged aerated foam collars on the
  // lower water surface (rings keep per-ring materials: opacity animates per ring).
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
  const collarGeos: THREE.BufferGeometry[] = [];
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
    ring.renderOrder = 3; // above the water layer (T1)
    waterMesh.add(ring);
    splashRings.push(ring);

    if (i > 0) {
      collarGeos.push(baked(new THREE.RingGeometry(0.05, 0.13, 14), [rx, -rz, 0.012]));
    }
  }
  const collarsMerged = mergeIntoMesh(collarGeos, foamCollarMat, 'fountain_foam_collars', false);
  collarsMerged.renderOrder = 3; // above the water layer (T1)
  waterMesh.add(collarsMerged);

  waterMesh.visible = false;
  group.add(waterMesh);

  // 14. Cascading streams — 6 spout jets (upper tier -> lower bowl), 6 weir arcs
  //     (lower bowl -> basin, landing at r ≈ 1.22 to match the shader splash
  //     centers / droplet splash ring / wish-ripple metrics at r ≈ 1.2) and 2 crown
  //     plumes off the finial tip — ALL MERGED into one stream mesh.
  const cascadeGroup = new THREE.Group();
  const streamMat = createStorybookWaterStreamMaterial();
  const streamGeos: THREE.BufferGeometry[] = [];

  for (let i = 0; i < STORYBOOK_FOUNTAIN_SPEC.spoutCount; i++) {
    const a = (i / STORYBOOK_FOUNTAIN_SPEC.spoutCount) * Math.PI * 2 + Math.PI / 6;
    const cx = Math.cos(a);
    const sz = Math.sin(a);
    // Upper-tier spout jet arcing down into the lower bowl (water y 2.24)
    const jetCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cx * 0.92, 3.24, sz * 0.92),
      new THREE.Vector3(cx * 1.04, 3.02, sz * 1.04),
      new THREE.Vector3(cx * 1.02, 2.78, sz * 1.02),
      new THREE.Vector3(cx * 0.97, 2.28, sz * 0.97),
    ]);
    streamGeos.push(new THREE.TubeGeometry(jetCurve, 12, 0.04, 6, false));
  }
  for (let i = 0; i < STORYBOOK_FOUNTAIN_SPEC.weirCount; i++) {
    const a = (i / STORYBOOK_FOUNTAIN_SPEC.weirCount) * Math.PI * 2;
    const wcx = Math.cos(a);
    const wsz = Math.sin(a);
    // Lower-bowl overflow weir ribbon falling into the basin (water y 0.62)
    const weirCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(wcx * 1.26, 2.32, wsz * 1.26),
      new THREE.Vector3(wcx * 1.4, 2.08, wsz * 1.4),
      new THREE.Vector3(wcx * 1.46, 1.6, wsz * 1.46),
      new THREE.Vector3(wcx * 1.38, 1.0, wsz * 1.38),
      new THREE.Vector3(wcx * STORYBOOK_FOUNTAIN_SPEC.weirLandingRadius, 0.66, wsz * STORYBOOK_FOUNTAIN_SPEC.weirLandingRadius),
    ]);
    streamGeos.push(new THREE.TubeGeometry(weirCurve, 12, 0.034, 5, false));
  }
  for (const pa of [Math.PI / 4, Math.PI / 4 + Math.PI]) {
    const pcx = Math.cos(pa);
    const psz = Math.sin(pa);
    // Crown plume arching out of the finial tip (y 4.45) into the upper tier
    const plumeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(pcx * 0.04, 4.45, psz * 0.04),
      new THREE.Vector3(pcx * 0.28, 4.72, psz * 0.28),
      new THREE.Vector3(pcx * 0.5, 4.3, psz * 0.5),
      new THREE.Vector3(pcx * 0.62, 3.72, psz * 0.62),
    ]);
    streamGeos.push(new THREE.TubeGeometry(plumeCurve, 12, 0.026, 5, false));
  }
  const streamsMerged = mergeIntoMesh(streamGeos, streamMat, 'fountain_streams_merged', false);
  streamsMerged.userData.streamCount = streamGeos.length;
  streamsMerged.renderOrder = 3; // above the water layer (T1)
  cascadeGroup.add(streamsMerged);
  cascadeGroup.visible = false;
  group.add(cascadeGroup);

  // 15. 28 pooled ballistic splash & crown spray droplets — kind layout is the
  //     envRenderer contract: children 0-7 'crown' (finial spray), 8+ 'basin'
  //     (weir-landing splash at r ≈ 1.2). One shared geometry + material.
  const spoutParticles = new THREE.Group();
  const dropMat = palette.standard('#D7F4FA', 0.1, 0.08);
  const dropGeo = new THREE.SphereGeometry(0.068, 6, 6);
  const { dropletCount, crownDroplets } = STORYBOOK_FOUNTAIN_SPEC;
  for (let i = 0; i < dropletCount; i++) {
    const drop = new THREE.Mesh(dropGeo, dropMat);
    drop.userData.phase = i / dropletCount;
    drop.userData.kind = i < crownDroplets ? 'crown' : 'basin';
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
 *
 * FURN-1 bench v2: the straight iron legs are replaced by curved warm-cedar
 * hardwood side frames (one rounded silhouette per side: front leg, seat rail
 * and the splayed rear stile), the crowned slats widen with a softer crown, a
 * slim mint seat pad + sage arm pads sit on the wood in ALL seasons, the
 * backrest gains radiused capsule slats under a rounded top rail, and brass
 * bolts dress the joints. Static sub-meshes merge per material (tea-cart
 * pattern): 11 draw calls per bench by default (contact shadow included,
 * winter cushions hidden). The seat contract (seatTopY 0.365 /
 * backrestFrontZ -0.262 / winterCushions group) is regression-locked.
 */
export function buildStorybookBench(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
): THREE.Group {
  const group = new THREE.Group();
  addStaticContactShadow(group, shadowTex, 1.6, 1.02, 0.44, 0.018);

  const cedarMat = palette.standard(STORYBOOK_PALETTE.cedarWarm, 0.78, 0.03, {
    mapSet: 'timber-dark',
    groundGradient: 0.7,
  });
  const cedarDarkMat = palette.standard(STORYBOOK_PALETTE.cedarDark, 0.82, 0.03, {
    mapSet: 'timber-dark',
    groundGradient: 0.7,
  });
  const cedarHoneyMat = palette.standard(STORYBOOK_PALETTE.cedarHoney, 0.74, 0.04, {
    mapSet: 'timber-dark',
    groundGradient: 0.7,
  });
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.24, 0.85, {
    envMapIntensity: 1.0,
  });
  const mintPadMat = palette.standard(STORYBOOK_PALETTE.upholsteryMint, 0.88, 0.0, { mapSet: 'fabric' });
  const sagePadMat = palette.standard(STORYBOOK_PALETTE.upholsterySage, 0.88, 0.0, { mapSet: 'fabric' });

  // 1. Curved cedar side frames — front leg, seat rail and the splayed rear
  //    stile read as ONE rounded hardwood silhouette per side (shape space:
  //    x = world z, y = world y; extrusion depth = frame thickness). Both
  //    sides + the low center stretcher merge into a single honey-cedar mesh.
  const frameShape = new THREE.Shape();
  frameShape.moveTo(0.26, 0); // front foot, flat bottom
  frameShape.quadraticCurveTo(0.262, 0.08, 0.235, 0.16); // rounded toe, curved leg face
  frameShape.quadraticCurveTo(0.226, 0.27, 0.242, 0.318); // rail nose
  frameShape.lineTo(-0.212, 0.318); // seat rail top runs back under the slats (slat undersides land at 0.315)
  frameShape.quadraticCurveTo(-0.252, 0.5, -0.285, 0.735); // splayed rear stile front edge
  frameShape.quadraticCurveTo(-0.291, 0.782, -0.314, 0.778); // rounded stile cap
  frameShape.quadraticCurveTo(-0.338, 0.772, -0.33, 0.66); // cap back → stile back edge
  frameShape.quadraticCurveTo(-0.3, 0.44, -0.258, 0.262); // splay down to the rear leg
  frameShape.quadraticCurveTo(-0.25, 0.12, -0.202, 0.0); // curved rear leg, rounded heel
  frameShape.lineTo(-0.154, 0.0); // rear foot bottom
  frameShape.quadraticCurveTo(-0.138, 0.07, -0.132, 0.262); // rear leg front edge → rail underside
  frameShape.lineTo(0.15, 0.262); // rail underside back to the front leg
  frameShape.quadraticCurveTo(0.158, 0.13, 0.174, 0.056); // curved front-leg back edge
  frameShape.lineTo(0.174, 0.0); // foot pad
  frameShape.closePath();
  const frameGeoBase = new THREE.ExtrudeGeometry(frameShape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  frameGeoBase.translate(0, 0.008, -0.025); // lift the bevelled feet to y=0, center the thickness
  frameGeoBase.rotateY(-Math.PI / 2); // extrusion axis → world X, shape.x → world z
  const stretcherGeo = new THREE.CylinderGeometry(0.022, 0.022, 1.02, 8);
  stretcherGeo.rotateZ(Math.PI / 2); // along X
  stretcherGeo.translate(0, 0.168, -0.02);
  const framePartGeos = [
    frameGeoBase.clone().translate(-0.54, 0, 0), // extrude output is already non-indexed
    frameGeoBase.clone().translate(0.54, 0, 0),
    stretcherGeo.toNonIndexed(),
  ];
  const framesMerged = new THREE.Mesh(mergeGeometries(framePartGeos)!, cedarHoneyMat);
  framesMerged.name = 'bench_cedar_frames';
  framesMerged.castShadow = true;
  group.add(framesMerged);
  frameGeoBase.dispose();
  stretcherGeo.dispose();
  for (const g of framePartGeos) g.dispose();

  // 2. Rounded armrest caps + their front posts + the rounded top rail — one
  //    dark-cedar mesh (radiused capsule ends on the rail).
  const darkPartGeos: THREE.BufferGeometry[] = [];
  for (const sx of [-0.54, 0.54]) {
    const cap = new THREE.CapsuleGeometry(0.034, 0.36, 4, 10);
    cap.rotateX(Math.PI / 2); // roll along Z
    cap.translate(sx, 0.508, 0.02);
    darkPartGeos.push(cap);
    const post = new THREE.CylinderGeometry(0.026, 0.03, 0.17, 8);
    post.translate(sx, 0.402, 0.19);
    darkPartGeos.push(post);
  }
  const topRail = new THREE.CapsuleGeometry(0.032, 1.096, 4, 10);
  topRail.rotateZ(Math.PI / 2); // along X
  topRail.translate(0, 0.795, -0.315);
  darkPartGeos.push(topRail);
  const darkMerged = new THREE.Mesh(mergeGeometries(darkPartGeos)!, cedarDarkMat);
  darkMerged.name = 'bench_cedar_dark_merged';
  darkMerged.castShadow = true;
  group.add(darkMerged);
  for (const g of darkPartGeos) g.dispose();

  // 3. Sage fabric arm pads riding the caps (merged pair, all-season).
  const armPadGeos: THREE.BufferGeometry[] = [];
  for (const sx of [-0.54, 0.54]) {
    const pad = new THREE.CapsuleGeometry(0.03, 0.3, 4, 10);
    pad.rotateX(Math.PI / 2);
    pad.scale(1, 0.5, 1); // oval cross-section
    pad.translate(sx, 0.552, 0.02);
    armPadGeos.push(pad);
  }
  const armPads = new THREE.Mesh(mergeGeometries(armPadGeos)!, sagePadMat);
  armPads.name = 'bench_arm_pads';
  group.add(armPads);
  for (const g of armPadGeos) g.dispose();

  // 4. Four crowned cedar seat slats spanning z = -0.2265..+0.2765 — wider
  //    slats (0.115) with a softer crown. BUILD 02 lineage kept: one shared
  //    ExtrudeGeometry, profile edges land the seat line at y = 0.365.
  const slatProfile = new THREE.Shape();
  slatProfile.moveTo(-0.0525, -0.0225);
  slatProfile.lineTo(-0.0525, 0.0225);
  slatProfile.quadraticCurveTo(0, 0.03, 0.0525, 0.0225); // softer crown peak ≈ +0.004 over the edges
  slatProfile.lineTo(0.0525, -0.0225);
  slatProfile.closePath();
  const slatGeo = new THREE.ExtrudeGeometry(slatProfile, {
    depth: 1.18,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.005,
    bevelSegments: 1,
  });
  slatGeo.rotateY(Math.PI / 2); // extrusion axis becomes X (the slat length)
  slatGeo.translate(-0.593, 0.3425, 0); // center the length on the frames; profile edge top line at y 0.365
  for (const sz of [-0.17, -0.04, 0.09, 0.22]) {
    const slat = new THREE.Mesh(slatGeo, cedarMat);
    slat.position.set(0, 0, sz);
    slat.castShadow = true;
    slat.receiveShadow = true;
    group.add(slat);
  }

  // 5. Slim mint fabric seat pad resting on the crowned slats in ALL seasons
  //    (squashed capsule, fabric weave). The winter wool cushions still ride
  //    over it via group.userData.winterCushions below.
  const seatPadGeo = new THREE.CapsuleGeometry(0.16, 0.62, 4, 12);
  seatPadGeo.rotateZ(Math.PI / 2); // along X
  seatPadGeo.scale(1, 0.16, 1.15); // slim pad: y ≈ 0.051, z ≈ 0.368
  seatPadGeo.translate(0, 0.399, 0.025);
  const seatPad = new THREE.Mesh(seatPadGeo, mintPadMat);
  seatPad.name = 'bench_seat_pad';
  seatPad.castShadow = true;
  group.add(seatPad);

  // 6. Two recessed angled backrest slats with radiused (capsule) ends —
  //    front face cleanly behind z = -0.262 so seated characters never pass
  //    through (same recline and rail lines as the locked contract).
  const backSpecs: Array<{ y: number; z: number }> = [
    { y: 0.54, z: -0.288 },
    { y: 0.71, z: -0.316 },
  ];
  const backGeos: THREE.BufferGeometry[] = [];
  for (const bs of backSpecs) {
    const g = new THREE.CapsuleGeometry(0.022, 1.116, 4, 10);
    g.rotateZ(Math.PI / 2); // along X
    g.rotateX(-0.16); // same recline as the locked backrest line
    g.translate(0, bs.y, bs.z);
    backGeos.push(g);
  }
  const backSlats = new THREE.Mesh(mergeGeometries(backGeos)!, cedarMat);
  backSlats.name = 'bench_backrest_slats';
  backSlats.castShadow = true;
  group.add(backSlats);
  for (const g of backGeos) g.dispose();

  // 7. Brass bolt details, sparingly — slat joints + rail seats (merged pair).
  const boltGeos: THREE.BufferGeometry[] = [];
  for (const bs of backSpecs) {
    for (const bx of [-0.54, 0.54]) {
      const bolt = new THREE.SphereGeometry(0.015, 6, 6);
      bolt.translate(bx, bs.y, bs.z + 0.026);
      boltGeos.push(bolt);
    }
  }
  for (const bx of [-0.54, 0.54]) {
    const bolt = new THREE.SphereGeometry(0.015, 6, 6);
    bolt.translate(bx, 0.795, -0.29);
    boltGeos.push(bolt);
  }
  const bolts = new THREE.Mesh(mergeGeometries(boltGeos)!, brassMat);
  bolts.name = 'bench_brass_bolts';
  group.add(bolts);
  for (const g of boltGeos) g.dispose();

  // 8. BUILD 02 (Doc 05 §3.2 P2): wool winter seat cushions — seasonal group
  //    (hidden by default; the canvas shows it in winter, matching the interior
  //    knit language). Named + collected via `group.userData.winterCushions`;
  //    in winter the knit cushions appear OVER the mint pad.
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

