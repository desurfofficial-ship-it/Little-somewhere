import * as THREE from 'three';
import {
  CharacterEmotion,
  NpcAnimationState,
  ResidentAppearance,
  ResidentId,
} from '../../game/types';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';
import { CharacterRig } from '../models';
import { addContactShadow } from './vegetation';

export type CharacterArchetypeId = ResidentId | 'player';

export interface CharacterAnimationOptions {
  emotion?: CharacterEmotion;
  lookYaw?: number;
  lookPitch?: number;
  bankAngle?: number;
  carrying?: boolean;
  isMoving?: boolean;
}

/**
 * Dusk pocket lantern carried on the player's satchel — emissive-only glow
 * (no extra scene light) following the same lantern language as the world's
 * hanging brass lanterns, with a gentle walking sway and flame flicker.
 */
export interface PlayerLanternRig {
  group: THREE.Group;
  glassMat: THREE.MeshStandardMaterial;
  flameMat: THREE.MeshStandardMaterial;
  glowLevel: number;
  swingPhase: number;
}

export interface StorybookPlayerRig extends CharacterRig {
  lantern: PlayerLanternRig;
}

export const PLAYER_LANTERN_GLOW = {
  day: 0.08,
  golden: 0.7,
  dusk: 1.45,
} as const;

/**
 * Builds the bespoke player rig: the beloved rust-coat & sage beret look layered
 * with a moss knit scarf, oat-canvas cross-body satchel (brass buckle + peeking
 * postcard), left elbow patch, beret pin, and the signature dusk pocket lantern.
 * Extends the shared storybook body so all 19 animation states keep working.
 */
export function buildStorybookPlayer(
  appearance: ResidentAppearance,
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
): StorybookPlayerRig {
  const rig = buildStorybookCharacter(appearance, palette, shadowTex, 'player');
  const torso = rig.torsoPivot;
  if (!torso) return { ...rig, lantern: buildLanternPlaceholder(palette) };

  const knitScarfMat = palette.standard('#87A98B', 0.88, 0.01);
  const canvasBagMat = palette.standard('#C7B48E', 0.86, 0.01);
  const canvasShadeMat = palette.standard('#B29F79', 0.84, 0.015);
  const leatherMat = palette.standard('#7C4F32', 0.68, 0.06);
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.24, 0.85);
  const paperMat = palette.standard('#FAF2E1', 0.88, 0.0);
  const stampMat = palette.standard('#C86446', 0.65, 0.02);

  // 1. Moss knit scarf wrap + tail (right-hip drape mirrors the satchel side)
  const scarfCollar = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.068, 8, 14), knitScarfMat);
  scarfCollar.rotation.x = Math.PI / 2;
  scarfCollar.position.y = 0.6;
  const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.27, 0.05), knitScarfMat);
  scarfTail.position.set(-0.12, 0.44, 0.24);
  scarfTail.rotation.z = 0.16;
  scarfTail.rotation.x = -0.12;
  const scarfKnot = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), knitScarfMat);
  scarfKnot.position.set(-0.1, 0.52, 0.24);
  torso.add(scarfCollar, scarfTail, scarfKnot);

  // 2. Oat-canvas cross-body satchel on the right hip (brass buckle + postcard)
  const satchelStrap = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.028, 6, 16), leatherMat);
  satchelStrap.position.set(0.02, 0.33, 0);
  satchelStrap.rotation.y = Math.PI / 2;
  satchelStrap.rotation.x = -0.65;
  torso.add(satchelStrap);

  const bagGroup = new THREE.Group();
  bagGroup.position.set(0.32, 0.13, 0.04);
  bagGroup.rotation.z = 0.08;
  const bagBody = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.24, 0.3), canvasBagMat);
  bagBody.castShadow = true;
  const bagFlap = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.31), canvasShadeMat);
  bagFlap.position.set(0.01, 0.07, 0);
  const bagBuckle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.055, 0.06), brassMat);
  bagBuckle.position.set(0.1, 0.02, 0);
  const postcardPeek = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.15, 0.19), paperMat);
  postcardPeek.position.set(-0.02, 0.12, -0.03);
  postcardPeek.rotation.x = -0.18;
  const postcardStamp = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.045, 0.045), stampMat);
  postcardStamp.position.set(-0.02, 0.16, 0.03);
  bagGroup.add(bagBody, bagFlap, bagBuckle, postcardPeek, postcardStamp);
  torso.add(bagGroup);

  // 3. Left elbow patch — a mended, well-loved coat
  const elbowPatch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.11, 0.022), canvasShadeMat);
  elbowPatch.position.set(-0.075, -0.19, 0.02);
  elbowPatch.rotation.z = 0.18;
  rig.leftArm.add(elbowPatch);

  // 4. Brass pin on the sage beret
  const beretPin = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 6), brassMat);
  beretPin.position.set(0.02, 0.21, 0.245);
  rig.headGroup.add(beretPin);

  // 5. Signature dusk pocket lantern hanging off the satchel
  const lanternGlassMat = palette.standard('#FFE9B8', 0.4, 0.0);
  lanternGlassMat.emissive.set('#FFC66E');
  lanternGlassMat.emissiveIntensity = 0;
  lanternGlassMat.transparent = true;
  lanternGlassMat.opacity = 0.94;
  const lanternFlameMat = palette.standard('#FFD98A', 0.5, 0.0);
  lanternFlameMat.emissive.set('#FFB84D');
  lanternFlameMat.emissiveIntensity = 0;

  const lanternGroup = new THREE.Group();
  lanternGroup.position.set(0.33, -0.05, 0.14);
  const hookRing = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.009, 6, 10), brassMat);
  hookRing.position.y = 0.115;
  const lanternCap = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.046, 0.03, 8), brassMat);
  lanternCap.position.y = 0.075;
  const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.056, 0.115, 8), lanternGlassMat);
  lanternGlass.position.y = 0;
  const lanternBase = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.044, 0.026, 8), brassMat);
  lanternBase.position.y = -0.068;
  const lanternFlame = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), lanternFlameMat);
  lanternFlame.scale.y = 1.35;
  lanternFlame.position.y = -0.008;
  lanternGroup.add(hookRing, lanternCap, lanternGlass, lanternBase, lanternFlame);
  torso.add(lanternGroup);

  return {
    ...rig,
    lantern: {
      group: lanternGroup,
      glassMat: lanternGlassMat,
      flameMat: lanternFlameMat,
      glowLevel: 0,
      swingPhase: 0,
    },
  };
}

function buildLanternPlaceholder(palette: MaterialPalette): PlayerLanternRig {
  // Defensive fallback if torsoPivot is ever absent — keeps the rig contract whole.
  const mat = palette.standard('#FFE9B8', 0.4, 0.0);
  return {
    group: new THREE.Group(),
    glassMat: mat,
    flameMat: mat,
    glowLevel: 0,
    swingPhase: 0,
  };
}

/**
 * Per-frame dusk lantern driver: damps glow toward the time-phase target,
 * flickers the flame softly, and sways with walking motion. Zero allocations.
 */
export function updatePlayerLantern(
  lantern: PlayerLanternRig,
  targetGlow: number,
  dt: number,
  elapsed: number,
  motionSpeed: number,
): void {
  lantern.glowLevel = THREE.MathUtils.damp(lantern.glowLevel, targetGlow, 3.2, dt);
  const flicker = 0.94 + Math.sin(elapsed * 12.7) * 0.04 + Math.sin(elapsed * 31.3) * 0.02;
  lantern.glassMat.emissiveIntensity = lantern.glowLevel * 1.5 * flicker;
  lantern.flameMat.emissiveIntensity = lantern.glowLevel * 2.4 * flicker;
  // Daytime keeps only a faint warm hint in the glass; the flame itself sleeps
  lantern.flameMat.visible = lantern.glowLevel > 0.2;

  lantern.swingPhase += dt * (2.1 + Math.min(4.2, motionSpeed * 1.15));
  const swayAmp = Math.min(0.24, motionSpeed * 0.038);
  lantern.group.rotation.z = Math.sin(lantern.swingPhase) * swayAmp;
  lantern.group.rotation.x = Math.cos(lantern.swingPhase * 0.72) * swayAmp * 0.6;
}

/**
 * Builds a handcrafted Storybook Diorama character rig with articulated hip/waist/shoulder joints,
 * layered coat/apron/scarf silhouettes, sculpted hair/hats, expressive eyelids & brows,
 * catchlight eyes, carry socket, and bespoke props.
 */
export function buildStorybookCharacter(
  appearance: ResidentAppearance,
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
  characterId: CharacterArchetypeId = 'player',
): CharacterRig {
  const root = new THREE.Group();
  const s = appearance.heightScale;

  addContactShadow(root, shadowTex, 1.12, 1.12, 0.54, 0.024);

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
  const trousersMat = palette.standard(
    characterId === 'pip' ? '#466886' : characterId === 'barnaby' ? '#584B42' : '#404552',
    0.84,
    0.02,
  );
  const coatMat = palette.standard(appearance.coatColor, 0.78, 0.02);
  const shirtMat = palette.standard(appearance.shirtColor, 0.84, 0.01);
  const accentMat = palette.standard(appearance.accentColor, 0.74, 0.04);
  const skinMat = palette.standard(appearance.skinColor, 0.7, 0.02);
  const blushMat = palette.standard('#E59580', 0.74, 0.0);
  const hairMat = palette.standard(appearance.hairColor, 0.82, 0.03);
  const eyeMat = palette.standard('#1E1814', 0.16, 0.08);
  const highlightMat = palette.standard('#FAF5EC', 0.12, 0.0);
  const brassMat = palette.standard(STORYBOOK_PALETTE.agedBrass, 0.24, 0.85);
  const leatherMat = palette.standard('#7C4F32', 0.68, 0.06);

  // 1. Articulated Legs (hip pivot at y = 0.42)
  const makeLeg = (xPos: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(xPos, 0.42, 0);
    const pant = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.092, 0.22, 8), trousersMat);
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

  // 2. Articulated Waist / Upper-Body Pivot (y = 0.45 in bodyGroup)
  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.45, 0);
  bodyGroup.add(torsoPivot);

  const coatSkirt = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.24,
      characterId === 'clara' || characterId === 'mina' || characterId === 'nora' ? 0.37 : 0.34,
      0.35,
      12,
    ),
    coatMat,
  );
  coatSkirt.position.y = 0.1;
  coatSkirt.castShadow = true;
  const coatChest = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.26, 0.38, 12), coatMat);
  coatChest.position.y = 0.42;
  coatChest.castShadow = true;
  const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.32, 0.06), shirtMat);
  lapel.position.set(0, 0.43, 0.22);
  torsoPivot.add(coatSkirt, coatChest, lapel);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.062, 8, 14), accentMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.6;
  torsoPivot.add(collar);

  // Bespoke chest/waist tailoring by character role
  if (characterId === 'clara' || characterId === 'mina') {
    const apronBib = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.05), shirtMat);
    apronBib.position.set(0, 0.39, 0.24);
    const apronSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.255, 0.38, 0.34, 12, 1, false, -Math.PI * 0.38, Math.PI * 0.76),
      shirtMat,
    );
    apronSkirt.position.set(0, 0.1, 0.02);
    torsoPivot.add(apronBib, apronSkirt);
  } else if (characterId === 'barnaby') {
    const leatherApron = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.52, 0.06), leatherMat);
    leatherApron.position.set(0, 0.23, 0.25);
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.08), accentMat);
    pocket.position.set(0, 0.21, 0.26);
    torsoPivot.add(leatherApron, pocket);
  } else if (characterId === 'arthur') {
    const pocketChain = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.016, 5, 10, Math.PI), brassMat);
    pocketChain.position.set(0.06, 0.23, 0.27);
    pocketChain.rotation.z = Math.PI;
    const watch = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.025, 10), brassMat);
    watch.rotation.x = Math.PI / 2;
    watch.position.set(0.16, 0.23, 0.28);
    torsoPivot.add(pocketChain, watch);
  } else if (characterId === 'sora' || characterId === 'nora') {
    const shawlTail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.05), accentMat);
    shawlTail.position.set(0.12, 0.44, 0.24);
    shawlTail.rotation.z = -0.18;
    torsoPivot.add(shawlTail);
  } else if (characterId === 'pip') {
    const bib = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.05), accentMat);
    bib.position.set(0, 0.37, 0.24);
    torsoPivot.add(bib);
  } else {
    for (let b = 0; b < 3; b++) {
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.023, 6, 6), brassMat);
      btn.position.set(0, 0.27 + b * 0.11, 0.26);
      torsoPivot.add(btn);
    }
  }

  // Carry socket positioned neatly at chest/hand cradle height
  const carrySocket = new THREE.Group();
  carrySocket.position.set(0, 0.31, 0.37);
  torsoPivot.add(carrySocket);

  // 3. Articulated Sleeved Arms with Cuffs & Clay Hands (shoulder pivot at y = 0.53 inside torsoPivot)
  const makeArm = (side: -1 | 1) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.3, 0.53, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.094, 0.33, 8), coatMat);
    sleeve.position.set(side * 0.04, -0.155, 0);
    sleeve.rotation.z = side * 0.18;
    sleeve.castShadow = true;
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 8), shirtMat);
    cuff.position.set(side * 0.07, -0.31, 0);
    cuff.rotation.z = side * 0.18;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), skinMat);
    hand.position.set(side * 0.09, -0.38, 0.02);
    armPivot.add(sleeve, cuff, hand);
    return armPivot;
  };
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  torsoPivot.add(leftArm, rightArm);

  // 4. Expressive Head + Blush + Catchlight Eyes + Eyelids + Brows + Nose + Hair + Hats
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.9, 0);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.285, 14, 12), skinMat);
  head.castShadow = true;
  headGroup.add(head);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), skinMat);
  nose.position.set(0, -0.02, 0.275);
  headGroup.add(nose);

  const lidGeo = new THREE.BoxGeometry(0.082, 0.056, 0.036);
  const browGeo = new THREE.BoxGeometry(0.074, 0.02, 0.024);

  let leftEyelid!: THREE.Mesh;
  let rightEyelid!: THREE.Mesh;
  let leftBrow!: THREE.Mesh;
  let rightBrow!: THREE.Mesh;

  for (const sx of [-1, 1] as const) {
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), blushMat);
    blush.scale.set(1.2, 0.72, 0.45);
    blush.position.set(sx * 0.155, -0.06, 0.22);
    headGroup.add(blush);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), eyeMat);
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

  // Character-specific eyewear / mustache accents
  if (characterId === 'nora') {
    for (const sx of [-1, 1]) {
      const lensRim = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 12), brassMat);
      lensRim.position.set(sx * 0.105, 0.025, 0.285);
      headGroup.add(lensRim);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.014, 0.014), brassMat);
    bridge.position.set(0, 0.03, 0.285);
    headGroup.add(bridge);
  } else if (characterId === 'arthur') {
    const loupe = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.015, 6, 12), brassMat);
    loupe.position.set(0.108, 0.028, 0.288);
    headGroup.add(loupe);
  } else if (characterId === 'barnaby') {
    const stache = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.14, 4, 6), hairMat);
    stache.rotation.z = Math.PI / 2;
    stache.position.set(0, -0.075, 0.26);
    headGroup.add(stache);
  }

  // Hair cap + sculpted bangs
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat,
  );
  hairCap.rotation.x = -0.32;
  headGroup.add(hairCap);

  for (const bx of [-0.11, 0, 0.11]) {
    const bang = new THREE.Mesh(new THREE.DodecahedronGeometry(0.07, 0), hairMat);
    bang.scale.set(1.1, 0.72, 0.8);
    bang.position.set(bx, 0.135, 0.24);
    headGroup.add(bang);
  }

  // Hat / Hair Style Variants
  if (appearance.hatStyle === 'beret') {
    const beretCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.23, 0.11, 12), accentMat);
    beretCrown.position.set(0.04, 0.25, -0.02);
    beretCrown.rotation.z = -0.18;
    const beretStem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.06, 6), accentMat);
    beretStem.position.set(0.06, 0.32, -0.02);
    headGroup.add(beretCrown, beretStem);
  } else if (appearance.hatStyle === 'straw') {
    const strawMat = palette.standard('#E5C97B', 0.85, 0.0);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.47, 0.05, 16), strawMat);
    brim.position.y = 0.21;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.18, 14), strawMat);
    crown.position.y = 0.31;
    const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.05, 14), accentMat);
    ribbon.position.y = 0.25;
    headGroup.add(brim, crown, ribbon);
  } else if (appearance.hatStyle === 'cap') {
    const capCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.275, 0.15, 12), accentMat);
    capCrown.position.set(0, 0.21, -0.02);
    capCrown.rotation.x = -0.14;
    const visor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.29, 0.04, 12, 1, false, -Math.PI * 0.36, Math.PI * 0.72),
      accentMat,
    );
    visor.position.set(0, 0.12, 0.06);
    visor.rotation.x = 0.08;
    headGroup.add(capCrown, visor);
  } else if (appearance.hatStyle === 'bun') {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.145, 10, 10), hairMat);
    bun.position.set(0, 0.23, -0.21);
    const hairPin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.025), accentMat);
    hairPin.position.set(0, 0.24, -0.21);
    hairPin.rotation.z = 0.35;
    headGroup.add(bun, hairPin);
  } else if (appearance.hatStyle === 'hood') {
    const hood = new THREE.Mesh(new THREE.DodecahedronGeometry(0.315, 1), coatMat);
    hood.scale.set(1.02, 0.95, 1.08);
    hood.position.set(0, 0.05, -0.07);
    headGroup.add(hood);
  }

  torsoPivot.add(headGroup);

  // 5. Detailed Signature Props
  if (appearance.propType === 'watering_can') {
    const canMat = palette.standard('#6EA6B5', 0.34, 0.55);
    const canBody = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.24, 10), canMat);
    canBody.position.set(0.1, -0.44, 0.08);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.045, 0.22, 6), canMat);
    spout.position.set(0.1, -0.4, 0.22);
    spout.rotation.x = 0.72;
    const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.03, 0.04, 8), brassMat);
    rose.position.set(0.1, -0.32, 0.3);
    rose.rotation.x = 0.72;
    rightArm.add(canBody, spout, rose);
  } else if (appearance.propType === 'violin') {
    const violinWood = palette.standard('#8C4A2B', 0.45, 0.08);
    const violinGroup = new THREE.Group();
    violinGroup.position.set(-0.22, 0.37, -0.26);
    violinGroup.rotation.z = 0.38;
    const bodyLow = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 10), violinWood);
    bodyLow.rotation.x = Math.PI / 2;
    const bodyTop = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 10), violinWood);
    bodyTop.rotation.x = Math.PI / 2;
    bodyTop.position.y = 0.15;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.03), bootMat);
    neck.position.y = 0.3;
    violinGroup.add(bodyLow, bodyTop, neck);
    torsoPivot.add(violinGroup);
  } else if (appearance.propType === 'book' || appearance.propType === 'sketchbook') {
    const coverMat = palette.standard(
      appearance.propType === 'sketchbook' ? '#6D5543' : '#5878A3',
      0.72,
      0.03,
    );
    const pageMat = palette.standard('#FAF2E1', 0.88, 0.0);
    const book = new THREE.Group();
    book.position.set(0.05, -0.36, 0.12);
    book.rotation.y = 0.25;
    book.rotation.x = -0.35;
    const cover = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.3), coverMat);
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.052, 0.28), pageMat);
    pages.position.x = 0.01;
    book.add(cover, pages);
    rightArm.add(book);
  } else if (appearance.propType === 'loaf') {
    const basketMat = palette.standard('#B48653', 0.84, 0.02);
    const loafMat = palette.standard('#D8964B', 0.82, 0.0);
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.12, 10), basketMat);
    basket.position.set(0.06, -0.38, 0.14);
    const loaf = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.16, 4, 6), loafMat);
    loaf.rotation.z = Math.PI / 2;
    loaf.position.set(0.06, -0.31, 0.14);
    rightArm.add(basket, loaf);
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
  questPip.position.set(0, 2.08 * s, 0);
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
 * Zero-GC per-frame animation driver for all 19 NpcAnimationStates (17 shared + 2 player
 * idle flourishes) + 10 CharacterEmotion moods + deterministic eye blinking + clamped head
 * look-at + turn banking.
 */
export function animateCharacterRig(
  rig: CharacterRig,
  animState: NpcAnimationState,
  walkPhase: number,
  elapsed: number,
  dt: number,
  phaseSeed: number,
  opts?: CharacterAnimationOptions,
): void {
  const dampSpeed = dt > 0 ? Math.min(1, dt * 11) : 1;
  const emotion = opts?.emotion ?? 'relaxed';
  const carrying = opts?.carrying ?? animState === 'carry';
  const bankAngle = opts?.bankAngle ?? 0;

  let targetLeftLegX = 0;
  let targetRightLegX = 0;
  let targetLeftArmX = 0;
  let targetRightArmX = 0;
  let targetLeftArmZ = 0.06;
  let targetRightArmZ = -0.06;
  let targetTorsoX = 0;
  let targetTorsoY = 0;
  let targetTorsoZ = bankAngle;
  let targetHeadX = 0;
  let targetHeadY = 0;
  let targetHeadZ = 0;
  let targetBodyY = Math.sin(elapsed * 2.1 + phaseSeed) * 0.022;
  let targetBodyZ = 0;

  if (animState === 'idle') {
    const breath = Math.sin(elapsed * 2.1 + phaseSeed);
    targetLeftArmX = breath * 0.035;
    targetRightArmX = -breath * 0.035;
    if (Math.abs(bankAngle) < 0.005) {
      targetTorsoZ = Math.sin(elapsed * 0.95 + phaseSeed) * 0.018;
    }
    targetHeadY = Math.sin(elapsed * 0.65 + phaseSeed * 1.3) * 0.045;
  } else if (animState === 'walk') {
    const rSwing = Math.sin(walkPhase) * 0.48;
    targetLeftLegX = rSwing;
    targetRightLegX = -rSwing;
    targetLeftArmX = -rSwing * 0.65;
    targetRightArmX = rSwing * 0.65;
    targetLeftArmZ = 0.08;
    targetRightArmZ = -0.08;
    targetTorsoX = 0.05;
    targetTorsoY = -Math.sin(walkPhase) * 0.055;
    targetBodyY = Math.abs(Math.sin(walkPhase)) * 0.045;
  } else if (animState === 'run') {
    const rSwing = Math.sin(walkPhase) * 0.72;
    targetLeftLegX = rSwing;
    targetRightLegX = -rSwing;
    targetLeftArmX = -0.25 - rSwing * 0.8;
    targetRightArmX = -0.25 + rSwing * 0.8;
    targetLeftArmZ = 0.1;
    targetRightArmZ = -0.1;
    targetTorsoX = 0.12;
    targetTorsoY = -Math.sin(walkPhase) * 0.08;
    targetBodyY = Math.abs(Math.sin(walkPhase)) * 0.072;
  } else if (animState === 'sprint') {
    const rSwing = Math.sin(walkPhase) * 0.92;
    targetLeftLegX = rSwing;
    targetRightLegX = -rSwing;
    targetLeftArmX = -0.45 - rSwing * 0.95;
    targetRightArmX = -0.45 + rSwing * 0.95;
    targetLeftArmZ = 0.12;
    targetRightArmZ = -0.12;
    targetTorsoX = 0.2;
    targetTorsoY = -Math.sin(walkPhase) * 0.1;
    targetBodyY = Math.abs(Math.sin(walkPhase)) * 0.095;
  } else if (animState === 'carry') {
    if (opts?.isMoving) {
      const rSwing = Math.sin(walkPhase) * 0.44;
      targetLeftLegX = rSwing;
      targetRightLegX = -rSwing;
      targetBodyY = Math.abs(Math.sin(walkPhase)) * 0.04;
      targetTorsoX = 0.04;
    } else {
      targetBodyY = Math.sin(elapsed * 2.0 + phaseSeed) * 0.018;
    }
  } else if (animState === 'turn') {
    targetLeftLegX = 0.16;
    targetRightLegX = -0.16;
    targetTorsoY = Math.sin(elapsed * 5 + phaseSeed) * 0.08;
  } else if (animState === 'sit') {
    targetLeftLegX = -1.18;
    targetRightLegX = -1.18;
    targetLeftArmX = -0.34;
    targetRightArmX = -0.34;
    targetLeftArmZ = 0.11;
    targetRightArmZ = -0.11;
    targetBodyY = -0.02;
    targetBodyZ = 0.19;
    targetTorsoX = 0.035 + Math.sin(elapsed * 1.4 + phaseSeed) * 0.018;
  } else if (animState === 'rest') {
    targetLeftArmX = -0.1;
    targetRightArmX = -0.1;
    targetTorsoX = 0.05;
    targetHeadX = 0.1 + Math.sin(elapsed * 1.2 + phaseSeed) * 0.04;
    targetHeadZ = 0.06;
    targetBodyY = Math.sin(elapsed * 1.3 + phaseSeed) * 0.018;
  } else if (animState === 'interact') {
    const reach = Math.sin(elapsed * 6.0 + phaseSeed) * 0.18;
    targetLeftArmX = -0.26;
    targetRightArmX = -0.92 + reach;
    targetRightArmZ = -0.14;
    targetTorsoX = 0.08;
    targetTorsoY = -0.05;
    targetHeadX = 0.14;
    targetBodyY = Math.sin(elapsed * 3.0 + phaseSeed) * 0.015;
  } else if (animState === 'talk') {
    const gesture = Math.sin(elapsed * 3.4 + phaseSeed);
    targetLeftArmX = -0.26 + Math.max(0, gesture) * 0.28;
    targetRightArmX = -0.28 + Math.max(0, -gesture) * 0.3;
    targetLeftArmZ = 0.14;
    targetRightArmZ = -0.14;
    targetHeadX = Math.sin(elapsed * 3.6 + phaseSeed) * 0.09;
    targetHeadY = Math.sin(elapsed * 1.8 + phaseSeed) * 0.1;
    targetBodyY = Math.sin(elapsed * 2.5 + phaseSeed) * 0.024;
  } else if (animState === 'listen') {
    targetLeftArmX = -0.12;
    targetRightArmX = -0.12;
    targetHeadX = Math.max(0, Math.sin(elapsed * 2.2 + phaseSeed)) * 0.1;
    targetHeadZ = 0.09;
  } else if (animState === 'wave') {
    targetLeftArmX = -0.08;
    targetRightArmX = -2.35;
    targetRightArmZ = -0.35 + Math.sin(elapsed * 8.5 + phaseSeed) * 0.26;
    targetHeadZ = -0.07;
    targetBodyY = Math.abs(Math.sin(elapsed * 4.2 + phaseSeed)) * 0.032;
  } else if (animState === 'work') {
    const workWave = Math.sin(elapsed * 3.1 + phaseSeed);
    targetLeftArmX = -0.38 + workWave * 0.16;
    targetRightArmX = -0.45 - workWave * 0.16;
    targetTorsoX = 0.08;
    targetHeadX = 0.14 + Math.sin(elapsed * 1.6 + phaseSeed) * 0.04;
    targetHeadY = Math.sin(elapsed * 0.9 + phaseSeed) * 0.08;
    targetBodyY = Math.sin(elapsed * 2.4 + phaseSeed) * 0.025;
  } else if (animState === 'sketch_read') {
    targetLeftArmX = -0.25;
    targetRightArmX = -0.62 + Math.sin(elapsed * 2.4 + phaseSeed) * 0.05;
    targetRightArmZ = -0.18;
    targetHeadX = 0.22;
    targetHeadY = Math.sin(elapsed * 0.7 + phaseSeed) * 0.08;
    targetBodyY = Math.sin(elapsed * 1.8 + phaseSeed) * 0.018;
  } else if (animState === 'music') {
    const bow = Math.sin(elapsed * 3.6 + phaseSeed) * 0.22;
    targetLeftArmX = -0.58;
    targetLeftArmZ = 0.26;
    targetRightArmX = -0.52 + bow;
    targetRightArmZ = -0.22;
    targetTorsoZ = Math.sin(elapsed * 1.5 + phaseSeed) * 0.04;
    targetHeadX = 0.08 + Math.sin(elapsed * 1.8 + phaseSeed) * 0.05;
    targetHeadY = Math.sin(elapsed * 1.2 + phaseSeed) * 0.14;
    targetBodyY = Math.sin(elapsed * 2.0 + phaseSeed) * 0.028;
  } else if (animState === 'converse') {
    const gesture = Math.sin(elapsed * 2.8 + phaseSeed);
    targetLeftArmX = -0.22 + Math.max(0, gesture) * 0.24;
    targetRightArmX = -0.22 + Math.max(0, -gesture) * 0.24;
    targetLeftArmZ = 0.14;
    targetRightArmZ = -0.14;
    targetHeadX = Math.sin(elapsed * 3.2 + phaseSeed) * 0.09;
    targetHeadY = Math.sin(elapsed * 1.5 + phaseSeed) * 0.12;
    targetBodyY = Math.sin(elapsed * 2.2 + phaseSeed) * 0.024;
  } else if (animState === 'admire') {
    targetLeftArmX = -0.08;
    targetRightArmX = -0.08;
    targetHeadX = -0.12;
    targetHeadY = Math.sin(elapsed * 0.65 + phaseSeed) * 0.18;
    targetBodyY = Math.sin(elapsed * 1.8 + phaseSeed) * 0.02;
  } else if (animState === 'adjust_hat') {
    // Player idle flourish: a fond little pat of the beret
    const settle = Math.sin(elapsed * 8.2 + phaseSeed) * 0.09;
    targetLeftArmX = -0.06;
    targetRightArmX = -2.42 + settle * 0.55;
    targetRightArmZ = -0.4;
    targetHeadZ = 0.09 + settle * 0.12;
    targetHeadX = 0.05;
    targetTorsoX = 0.035;
    targetBodyY = Math.sin(elapsed * 2.6 + phaseSeed) * 0.014;
  } else if (animState === 'look_around') {
    // Player idle flourish: a curious scan of the lane, torso following the gaze
    const glance = Math.sin(elapsed * 2.3 + phaseSeed);
    targetLeftArmX = -0.06;
    targetRightArmX = -0.06;
    targetHeadY = glance * 0.44;
    targetHeadX = 0.045;
    targetTorsoY = glance * 0.13;
    targetBodyY = Math.sin(elapsed * 1.9 + phaseSeed) * 0.016;
  }

  // Override arm cradle cleanly whenever carrying a prop across idle/walk/run
  if (carrying && animState !== 'sit' && animState !== 'wave') {
    targetLeftArmX = -0.84;
    targetRightArmX = -0.84;
    targetLeftArmZ = 0.14;
    targetRightArmZ = -0.14;
  }

  // Emotion posture & facial modifiers
  let eyelidScaleY = 0.2;
  let eyelidPosY = 0.056;
  let browOffsetY = 0.078;
  let browTiltZ = 0;

  if (emotion === 'happy') {
    targetTorsoX -= 0.03;
    browOffsetY = 0.085;
    eyelidScaleY = 0.26;
  } else if (emotion === 'excited') {
    targetTorsoX -= 0.05;
    browOffsetY = 0.092;
    eyelidScaleY = 0.16;
    if (animState === 'idle' || animState === 'talk') {
      targetBodyY += Math.abs(Math.sin(elapsed * 5.2 + phaseSeed)) * 0.028;
    }
  } else if (emotion === 'sad') {
    targetTorsoX += 0.08;
    targetHeadX += 0.08;
    eyelidScaleY = 0.45;
    eyelidPosY = 0.044;
    browOffsetY = 0.076;
    browTiltZ = 0.24;
  } else if (emotion === 'tired') {
    targetTorsoX += 0.1;
    targetHeadX += 0.09;
    eyelidScaleY = 0.62;
    eyelidPosY = 0.04;
    browOffsetY = 0.072;
  } else if (emotion === 'frustrated' || emotion === 'angry') {
    targetTorsoX += 0.05;
    eyelidScaleY = 0.34;
    eyelidPosY = 0.048;
    browOffsetY = 0.072;
    browTiltZ = emotion === 'angry' ? -0.32 : -0.22;
  } else if (emotion === 'curious') {
    targetHeadZ += 0.1;
    browOffsetY = 0.088;
    browTiltZ = 0.1;
    eyelidScaleY = 0.14;
  } else if (emotion === 'surprised') {
    browOffsetY = 0.096;
    eyelidScaleY = 0.1;
    targetHeadX -= 0.06;
  } else if (emotion === 'embarrassed') {
    targetHeadX += 0.08;
    targetHeadZ -= 0.08;
    browOffsetY = 0.082;
    browTiltZ = 0.16;
  }

  // Deterministic natural blink cycle (~every 4.3s)
  const blinkPhase = (elapsed + phaseSeed * 1.7) % 4.3;
  if (blinkPhase > 4.14) {
    eyelidScaleY = 1.38;
    eyelidPosY = 0.025;
  }

  // Apply clamped head look-at toward targetLookPos
  if (opts?.lookYaw !== undefined) {
    targetHeadY += THREE.MathUtils.clamp(opts.lookYaw, -0.55, 0.55);
  }
  if (opts?.lookPitch !== undefined) {
    targetHeadX += THREE.MathUtils.clamp(opts.lookPitch, -0.25, 0.25);
  }

  // Smoothly damp joint rotations & waist pivot (zero allocations)
  rig.leftLeg.rotation.x = THREE.MathUtils.lerp(rig.leftLeg.rotation.x, targetLeftLegX, dampSpeed);
  rig.rightLeg.rotation.x = THREE.MathUtils.lerp(rig.rightLeg.rotation.x, targetRightLegX, dampSpeed);
  rig.leftArm.rotation.x = THREE.MathUtils.lerp(rig.leftArm.rotation.x, targetLeftArmX, dampSpeed);
  rig.rightArm.rotation.x = THREE.MathUtils.lerp(rig.rightArm.rotation.x, targetRightArmX, dampSpeed);
  rig.leftArm.rotation.z = THREE.MathUtils.lerp(rig.leftArm.rotation.z, targetLeftArmZ, dampSpeed);
  rig.rightArm.rotation.z = THREE.MathUtils.lerp(rig.rightArm.rotation.z, targetRightArmZ, dampSpeed);
  rig.headGroup.rotation.x = THREE.MathUtils.lerp(rig.headGroup.rotation.x, targetHeadX, dampSpeed);
  rig.headGroup.rotation.y = THREE.MathUtils.lerp(rig.headGroup.rotation.y, targetHeadY, dampSpeed);
  rig.headGroup.rotation.z = THREE.MathUtils.lerp(rig.headGroup.rotation.z, targetHeadZ, dampSpeed);
  rig.bodyGroup.position.y = THREE.MathUtils.lerp(rig.bodyGroup.position.y, targetBodyY, dampSpeed);
  rig.bodyGroup.position.z = THREE.MathUtils.lerp(rig.bodyGroup.position.z, targetBodyZ, dampSpeed);

  if (rig.torsoPivot) {
    rig.torsoPivot.rotation.x = THREE.MathUtils.lerp(rig.torsoPivot.rotation.x, targetTorsoX, dampSpeed);
    rig.torsoPivot.rotation.y = THREE.MathUtils.lerp(rig.torsoPivot.rotation.y, targetTorsoY, dampSpeed);
    rig.torsoPivot.rotation.z = THREE.MathUtils.lerp(rig.torsoPivot.rotation.z, targetTorsoZ, dampSpeed);
  }

  if (rig.leftEyelid && rig.rightEyelid) {
    rig.leftEyelid.scale.y = THREE.MathUtils.lerp(rig.leftEyelid.scale.y, eyelidScaleY, Math.min(1, dampSpeed * 1.8));
    rig.rightEyelid.scale.y = THREE.MathUtils.lerp(rig.rightEyelid.scale.y, eyelidScaleY, Math.min(1, dampSpeed * 1.8));
    rig.leftEyelid.position.y = THREE.MathUtils.lerp(rig.leftEyelid.position.y, eyelidPosY, Math.min(1, dampSpeed * 1.8));
    rig.rightEyelid.position.y = THREE.MathUtils.lerp(rig.rightEyelid.position.y, eyelidPosY, Math.min(1, dampSpeed * 1.8));
  }

  if (rig.leftBrow && rig.rightBrow) {
    rig.leftBrow.position.y = THREE.MathUtils.lerp(rig.leftBrow.position.y, browOffsetY, dampSpeed);
    rig.rightBrow.position.y = THREE.MathUtils.lerp(
      rig.rightBrow.position.y,
      emotion === 'curious' ? browOffsetY + 0.01 : browOffsetY,
      dampSpeed,
    );
    rig.leftBrow.rotation.z = THREE.MathUtils.lerp(rig.leftBrow.rotation.z, browTiltZ, dampSpeed);
    rig.rightBrow.rotation.z = THREE.MathUtils.lerp(rig.rightBrow.rotation.z, -browTiltZ, dampSpeed);
  }
}

