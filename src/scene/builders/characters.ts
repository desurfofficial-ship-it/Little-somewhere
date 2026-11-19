import * as THREE from 'three';
import { NpcAnimationState, ResidentAppearance, ResidentId } from '../../game/types';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';
import { CharacterRig } from '../models';
import { addContactShadow } from './vegetation';

export type CharacterArchetypeId = ResidentId | 'player';

/**
 * Builds a handcrafted Storybook Diorama character rig with articulated hip/shoulder joints,
 * layered coat/apron/scarf silhouettes, sculpted hair/hats, catchlight eyes, and bespoke props.
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

  // 2. Tailored Layered Torso + Collar + Character-Specific Aprons/Vests/Shawls
  const coatSkirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, characterId === 'clara' || characterId === 'mina' || characterId === 'nora' ? 0.37 : 0.34, 0.35, 12),
    coatMat,
  );
  coatSkirt.position.y = 0.55;
  coatSkirt.castShadow = true;
  const coatChest = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.26, 0.38, 12), coatMat);
  coatChest.position.y = 0.87;
  coatChest.castShadow = true;
  const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.32, 0.06), shirtMat);
  lapel.position.set(0, 0.88, 0.22);
  bodyGroup.add(coatSkirt, coatChest, lapel);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.062, 8, 14), accentMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.05;
  bodyGroup.add(collar);

  // Bespoke chest/waist tailoring by character role
  if (characterId === 'clara' || characterId === 'mina') {
    const apronBib = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.26, 0.05), shirtMat);
    apronBib.position.set(0, 0.84, 0.24);
    const apronSkirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.255, 0.38, 0.34, 12, 1, false, -Math.PI * 0.38, Math.PI * 0.76),
      shirtMat,
    );
    apronSkirt.position.set(0, 0.55, 0.02);
    bodyGroup.add(apronBib, apronSkirt);
  } else if (characterId === 'barnaby') {
    const leatherApron = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.52, 0.06), leatherMat);
    leatherApron.position.set(0, 0.68, 0.25);
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.08), accentMat);
    pocket.position.set(0, 0.66, 0.26);
    bodyGroup.add(leatherApron, pocket);
  } else if (characterId === 'arthur') {
    const pocketChain = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.016, 5, 10, Math.PI), brassMat);
    pocketChain.position.set(0.06, 0.68, 0.27);
    pocketChain.rotation.z = Math.PI;
    const watch = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.025, 10), brassMat);
    watch.rotation.x = Math.PI / 2;
    watch.position.set(0.16, 0.68, 0.28);
    bodyGroup.add(pocketChain, watch);
  } else if (characterId === 'sora' || characterId === 'nora') {
    const shawlTail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.05), accentMat);
    shawlTail.position.set(0.12, 0.89, 0.24);
    shawlTail.rotation.z = -0.18;
    bodyGroup.add(shawlTail);
  } else if (characterId === 'pip') {
    const bib = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.05), accentMat);
    bib.position.set(0, 0.82, 0.24);
    bodyGroup.add(bib);
  } else {
    // Player or coat buttons
    for (let b = 0; b < 3; b++) {
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.023, 6, 6), brassMat);
      btn.position.set(0, 0.72 + b * 0.11, 0.26);
      bodyGroup.add(btn);
    }
  }

  // 3. Articulated Sleeved Arms with Cuffs & Clay Hands (shoulder pivot at y = 0.98)
  const makeArm = (side: -1 | 1) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(side * 0.3, 0.98, 0);
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
  bodyGroup.add(leftArm, rightArm);

  // 4. Expressive Head + Blush + Catchlight Eyes + Nose + Hair + Hats
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.35, 0);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.285, 14, 12), skinMat);
  head.castShadow = true;
  headGroup.add(head);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), skinMat);
  nose.position.set(0, -0.02, 0.275);
  headGroup.add(nose);

  for (const sx of [-1, 1]) {
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), blushMat);
    blush.scale.set(1.2, 0.72, 0.45);
    blush.position.set(sx * 0.155, -0.06, 0.22);
    headGroup.add(blush);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), eyeMat);
    eye.position.set(sx * 0.105, 0.025, 0.252);
    const catchlight = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 6), highlightMat);
    catchlight.position.set(sx * 0.105 + 0.012, 0.04, 0.284);
    headGroup.add(eye, catchlight);
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

  bodyGroup.add(headGroup);

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
    violinGroup.position.set(-0.22, 0.82, -0.26);
    violinGroup.rotation.z = 0.38;
    const bodyLow = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 10), violinWood);
    bodyLow.rotation.x = Math.PI / 2;
    const bodyTop = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 10), violinWood);
    bodyTop.rotation.x = Math.PI / 2;
    bodyTop.position.y = 0.15;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.03), bootMat);
    neck.position.y = 0.3;
    violinGroup.add(bodyLow, bodyTop, neck);
    bodyGroup.add(violinGroup);
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
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    headGroup,
    ringMesh,
    questPip,
  };
}

/**
 * Zero-GC per-frame animation driver for all Phase 2 NpcAnimationStates.
 */
export function animateCharacterRig(
  rig: CharacterRig,
  animState: NpcAnimationState,
  walkPhase: number,
  elapsed: number,
  dt: number,
  phaseSeed: number,
): void {
  const dampAlpha = Math.min(1, dt * 10);

  if (animState === 'walk') {
    const rSwing = Math.sin(walkPhase) * 0.48;
    rig.leftLeg.rotation.x = rSwing;
    rig.rightLeg.rotation.x = -rSwing;
    rig.leftArm.rotation.x = -rSwing * 0.65;
    rig.rightArm.rotation.x = rSwing * 0.65;
    rig.leftArm.rotation.z = THREE.MathUtils.lerp(rig.leftArm.rotation.z, 0.08, dampAlpha);
    rig.rightArm.rotation.z = THREE.MathUtils.lerp(rig.rightArm.rotation.z, -0.08, dampAlpha);
    rig.headGroup.rotation.x = THREE.MathUtils.lerp(rig.headGroup.rotation.x, 0, dampAlpha);
    rig.headGroup.rotation.y = THREE.MathUtils.lerp(rig.headGroup.rotation.y, 0, dampAlpha);
    rig.bodyGroup.position.y = Math.abs(Math.sin(walkPhase)) * 0.045;
    return;
  }

  // Non-walking poses reset leg stride cleanly
  rig.leftLeg.rotation.x = THREE.MathUtils.lerp(rig.leftLeg.rotation.x, 0, dampAlpha);
  rig.rightLeg.rotation.x = THREE.MathUtils.lerp(rig.rightLeg.rotation.x, 0, dampAlpha);

  if (animState === 'work') {
    const workWave = Math.sin(elapsed * 3.1 + phaseSeed);
    rig.leftArm.rotation.x = -0.38 + workWave * 0.16;
    rig.rightArm.rotation.x = -0.45 - workWave * 0.16;
    rig.headGroup.rotation.x = 0.14 + Math.sin(elapsed * 1.6 + phaseSeed) * 0.04;
    rig.headGroup.rotation.y = Math.sin(elapsed * 0.9 + phaseSeed) * 0.08;
    rig.bodyGroup.position.y = Math.sin(elapsed * 2.4 + phaseSeed) * 0.025;
  } else if (animState === 'sketch_read') {
    rig.leftArm.rotation.x = -0.25;
    rig.rightArm.rotation.x = -0.62 + Math.sin(elapsed * 2.4 + phaseSeed) * 0.05;
    rig.rightArm.rotation.z = -0.18;
    rig.headGroup.rotation.x = 0.24;
    rig.headGroup.rotation.y = Math.sin(elapsed * 0.7 + phaseSeed) * 0.08;
    rig.bodyGroup.position.y = Math.sin(elapsed * 1.8 + phaseSeed) * 0.018;
  } else if (animState === 'music') {
    const bow = Math.sin(elapsed * 3.6 + phaseSeed) * 0.22;
    rig.leftArm.rotation.x = -0.58;
    rig.leftArm.rotation.z = 0.26;
    rig.rightArm.rotation.x = -0.52 + bow;
    rig.rightArm.rotation.z = -0.22;
    rig.headGroup.rotation.x = 0.08 + Math.sin(elapsed * 1.8 + phaseSeed) * 0.05;
    rig.headGroup.rotation.y = Math.sin(elapsed * 1.2 + phaseSeed) * 0.14;
    rig.bodyGroup.position.y = Math.sin(elapsed * 2.0 + phaseSeed) * 0.028;
  } else if (animState === 'converse') {
    const gesture = Math.sin(elapsed * 2.8 + phaseSeed);
    rig.leftArm.rotation.x = -0.22 + Math.max(0, gesture) * 0.24;
    rig.rightArm.rotation.x = -0.22 + Math.max(0, -gesture) * 0.24;
    rig.leftArm.rotation.z = 0.14;
    rig.rightArm.rotation.z = -0.14;
    rig.headGroup.rotation.x = Math.sin(elapsed * 3.2 + phaseSeed) * 0.09;
    rig.headGroup.rotation.y = Math.sin(elapsed * 1.5 + phaseSeed) * 0.12;
    rig.bodyGroup.position.y = Math.sin(elapsed * 2.2 + phaseSeed) * 0.024;
  } else if (animState === 'admire') {
    rig.leftArm.rotation.x = -0.08;
    rig.rightArm.rotation.x = -0.08;
    rig.headGroup.rotation.x = -0.12;
    rig.headGroup.rotation.y = Math.sin(elapsed * 0.65 + phaseSeed) * 0.18;
    rig.bodyGroup.position.y = Math.sin(elapsed * 1.8 + phaseSeed) * 0.02;
  } else {
    // idle
    rig.leftArm.rotation.x = THREE.MathUtils.lerp(rig.leftArm.rotation.x, 0, dampAlpha);
    rig.rightArm.rotation.x = THREE.MathUtils.lerp(rig.rightArm.rotation.x, 0, dampAlpha);
    rig.leftArm.rotation.z = THREE.MathUtils.lerp(rig.leftArm.rotation.z, 0.06, dampAlpha);
    rig.rightArm.rotation.z = THREE.MathUtils.lerp(rig.rightArm.rotation.z, -0.06, dampAlpha);
    rig.headGroup.rotation.x = THREE.MathUtils.lerp(rig.headGroup.rotation.x, 0, dampAlpha);
    rig.headGroup.rotation.y = THREE.MathUtils.lerp(rig.headGroup.rotation.y, 0, dampAlpha);
    rig.bodyGroup.position.y = Math.sin(elapsed * 2.1 + phaseSeed) * 0.024;
  }
}
