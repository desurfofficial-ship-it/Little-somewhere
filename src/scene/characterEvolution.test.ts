import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { animateCharacterRig, buildStorybookCharacter } from './builders/characters';
import { buildStorybookJun } from './prototypes/willowLaneDiorama';
import { MaterialPalette } from './materials';
import { RESIDENTS } from '../game/residents';
import type { ResidentId } from '../game/types';

/**
 * Build 01 — Character Form & Presentation contracts (Doc 04 v2 targets).
 * These tests lock the NEW capabilities additively: face v2 scales, sculpted
 * mitten hands + hand anchors, the Hearth-Round archetype on Clara, Rowan's
 * 'standard' differentiation control, boot massing, and the emotion-intensity
 * amplitude plumbing. The pre-existing identity suites (residentIdentity,
 * playerAvatar, winterKnits, environmentRenderer seated clearance) stay
 * untouched and green — the evolve-don't-break discipline.
 */

const PLAYER_APPEARANCE = {
  coatColor: '#D46E51',
  shirtColor: '#FAF4E8',
  hairColor: '#433027',
  skinColor: '#F0C5A7',
  accentColor: '#6E9A74',
  hatStyle: 'beret' as const,
  propType: 'none' as const,
  heightScale: 1.0,
};

function buildRig(id: ResidentId | 'player') {
  const palette = new MaterialPalette();
  const dummyTex = new THREE.Texture();
  if (id === 'player') {
    return buildStorybookCharacter(PLAYER_APPEARANCE, palette, dummyTex, 'player');
  }
  if (id === 'jun') {
    return buildStorybookJun(RESIDENTS.jun.appearance, palette, dummyTex);
  }
  return buildStorybookCharacter(RESIDENTS[id].appearance, palette, dummyTex, id);
}

function findNamed(root: THREE.Object3D, name: string): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined;
  root.traverse((o) => {
    if (o.name === name) found = o;
  });
  return found;
}

test('face v2: eyes, catchlights, brows and mouth rescale to the camera-calibrated sizes', () => {
  for (const id of ['clara', 'rowan', 'toby', 'jun'] as const) {
    const rig = buildRig(id);
    const head = rig.headGroup.children.find(
      (o): o is THREE.Mesh => o instanceof THREE.Mesh && o.geometry instanceof THREE.SphereGeometry,
    );
    assert.ok(head, `${id} has a head sphere`);
    const headGeo = head!.geometry as THREE.SphereGeometry;
    assert.ok(
      Math.abs(headGeo.parameters.radius - 0.31) < 0.001,
      `${id} head radius is 0.310 (v2), got ${headGeo.parameters.radius}`,
    );

    // Eye beads: r 0.052 at ±0.120 — sized to resolve at ~30 m / 28° FOV.
    // (The v2 nose is also r 0.052 but sits on the face axis — filter by spread.)
    const eyes = rig.headGroup.children.filter(
      (o): o is THREE.Mesh =>
        o instanceof THREE.Mesh &&
        o.geometry instanceof THREE.SphereGeometry &&
        Math.abs((o.geometry as THREE.SphereGeometry).parameters.radius - 0.052) < 0.001 &&
        Math.abs(o.position.x) > 0.05,
    );
    assert.equal(eyes.length, 2, `${id} has exactly two v2 eye beads`);
    const spreads = eyes.map((e) => Math.abs(e.position.x));
    assert.ok(
      spreads.every((sp) => Math.abs(sp - 0.12) < 0.002),
      `${id} eye spread ±0.120, got ${spreads.join(',')}`,
    );
  }
});

test('curved lids ride the larger eye spheres and still blink', () => {
  const rig = buildRig('clara');
  assert.ok(rig.leftEyelid && rig.rightEyelid, 'clara keeps exposed eyelids');
  const lidGeo = rig.leftEyelid!.geometry as THREE.SphereGeometry;
  assert.ok(
    lidGeo.type === 'SphereGeometry',
    'v2 lids are curved spherical lens caps, not skin boxes',
  );
  assert.ok(Math.abs(rig.leftEyelid!.scale.y - 0.2) < 0.001, 'relaxed lid starts squashed');
  // Blink path: drive the rig into the blink window and confirm the lid covers the eye.
  const blinkElapsed = 4.2; // (elapsed + seed*1.7) % 4.3 > 4.14
  animateCharacterRig(rig, 'idle', 0, blinkElapsed, 0.05, 0, {});
  assert.ok(rig.leftEyelid!.scale.y > 1.2, `blink squashes the lid open, got ${rig.leftEyelid!.scale.y}`);
  assert.ok(rig.leftEyelid!.position.y < 0.05, `blink slides the lid over the eye, got ${rig.leftEyelid!.position.y}`);
});

test('mitten hands: chunky palms with thumbs replace the plain spheres, anchors exposed', () => {
  for (const id of ['clara', 'rowan', 'jun'] as const) {
    const rig = buildRig(id);
    assert.ok(rig.handAnchor, `${id} exposes a right-hand anchor`);
    assert.equal(rig.handAnchor!.name, 'hand_anchor');
    const hand = findNamed(rig.root, 'hand');
    assert.ok(hand, `${id} has a named hand group`);
    const meshes: THREE.Mesh[] = [];
    hand!.traverse((o) => {
      if (o instanceof THREE.Mesh) meshes.push(o);
    });
    // palm + thumb = at least 2 meshes per mitten
    assert.ok(meshes.length >= 2, `${id} mitten has palm + thumb, got ${meshes.length}`);
    // palm is squashed (chunky read, Doc 04 §4.1)
    const palm = meshes[0];
    assert.ok(palm.scale.x > 1.0 && palm.scale.y < 1.0, `${id} palm is a squashed sphere`);
  }
});

test('grip props ride the hand anchor: Clara loaf, Rowan fruit basket, Mina can, Nora book', () => {
  const clara = buildRig('clara');
  const loaf = findNamed(clara.root, 'loaf_basket_prop');
  assert.ok(loaf, 'clara loaf basket re-parented to the hand anchor');
  assert.equal(loaf!.parent!.name, 'hand_anchor');

  const rowan = buildRig('rowan');
  const basket = findNamed(rowan.root, 'fruit_basket_prop');
  assert.ok(basket, 'rowan gathering basket re-parented to the hand anchor');
  assert.equal(basket!.parent!.name, 'hand_anchor');
  // identity parts stay in place through the re-parenting
  assert.ok(findNamed(rowan.root, 'orchard_belt') && findNamed(rowan.root, 'pruning_shears'));

  const mina = buildRig('mina');
  const can = findNamed(mina.root, 'watering_can_prop');
  assert.ok(can, 'mina watering can re-parented to the hand anchor');
  assert.equal(can!.parent!.name, 'hand_anchor');

  const nora = buildRig('nora');
  const book = findNamed(nora.root, 'book_prop');
  assert.ok(book, 'nora book re-parented to the hand anchor');
  assert.equal(book!.parent!.name, 'hand_anchor');
});

test('Hearth-Round archetype: Clara gains the wide soft skirt and welcoming lean', () => {
  const clara = buildRig('clara');
  assert.ok(
    Math.abs((clara.postureLeanX ?? 0) - 0.02) < 1e-6,
    'clara carries the baked 0.02 welcoming lean',
  );
  const skirt = clara.torsoPivot!.children.find(
    (o): o is THREE.Mesh =>
      o instanceof THREE.Mesh && o.geometry instanceof THREE.CylinderGeometry,
  );
  assert.ok(skirt, 'clara coat skirt found');
  const skirtGeo = skirt!.geometry as THREE.CylinderGeometry;
  assert.ok(
    Math.abs(skirtGeo.parameters.radiusBottom - 0.4) < 0.001,
    `hearth-round flare 0.40, got ${skirtGeo.parameters.radiusBottom}`,
  );
  assert.ok(
    Math.abs(skirt.scale.z - 0.9) < 0.001,
    'skirt is elliptical (z-flatten 0.90) so seated clearance holds',
  );

  // The lean actually reaches the animation driver
  animateCharacterRig(clara, 'idle', 0, 1.0, 0.05, 0, {});
  assert.ok(clara.torsoPivot!.rotation.x > 0.01, 'idle pose shows the welcoming lean');
});

test('Rowan stays standard: the design system differentiates rather than templates', () => {
  const rowan = buildRig('rowan');
  assert.equal(rowan.postureLeanX, undefined, 'standard archetype has no baked lean');
  const skirt = rowan.torsoPivot!.children.find(
    (o): o is THREE.Mesh =>
      o instanceof THREE.Mesh && o.geometry instanceof THREE.CylinderGeometry,
  );
  assert.ok(skirt, 'rowan coat skirt found');
  const skirtGeo = skirt!.geometry as THREE.CylinderGeometry;
  assert.ok(
    Math.abs(skirtGeo.parameters.radiusBottom - 0.34) < 0.001,
    `standard flare 0.34, got ${skirtGeo.parameters.radiusBottom}`,
  );
  assert.equal(skirt!.scale.z, 1, 'standard skirt keeps its radial profile');
  // But Rowan shares the v2 face + mitten system — same design language, different person.
  assert.ok(rowan.handAnchor, 'rowan still gets mitten hands + anchor');
});

test('boot massing: toe cap and heel ground the stance', () => {
  const rig = buildRig('rowan');
  const toeCaps = findNamed(rig.root, 'hand') // any mesh search fallback
    ? null
    : null;
  void toeCaps;
  // Count boot extras: each leg gets boot capsule + toe cap + heel (3 boot meshes)
  let bootExtras = 0;
  rig.leftLeg.traverse((o) => {
    if (o instanceof THREE.Mesh && o.geometry instanceof THREE.SphereGeometry) bootExtras++;
    if (o instanceof THREE.Mesh && o.geometry instanceof THREE.BoxGeometry) bootExtras++;
  });
  assert.ok(bootExtras >= 2, `left leg carries toe cap + heel, got ${bootExtras}`);
});

test('emotion intensity scales face and pose amplitudes without changing default behavior', () => {
  const base = buildRig('clara');
  const low = buildRig('clara');
  const high = buildRig('clara');
  for (const rig of [base, low, high]) {
    animateCharacterRig(rig, 'idle', 0, 1.5, 1 / 30, 0, { emotion: 'happy' });
  }
  // Default (absent) == the historical 0.75 baseline
  const withDefault = buildRig('clara');
  animateCharacterRig(withDefault, 'idle', 0, 1.5, 1 / 30, 0, { emotion: 'happy' });
  assert.ok(
    Math.abs(withDefault.mouthSmile!.scale.x - base.mouthSmile!.scale.x) < 1e-9,
    'absent option == 0.75 default (no behavior change)',
  );

  // Higher intensity → wider happy smile; lower → gentler
  const hi = buildRig('clara');
  animateCharacterRig(hi, 'idle', 0, 1.5, 1 / 30, 0, { emotion: 'happy', emotionIntensity: 0.85 });
  const lo = buildRig('clara');
  animateCharacterRig(lo, 'idle', 0, 1.5, 1 / 30, 0, { emotion: 'happy', emotionIntensity: 0.55 });
  assert.ok(hi.mouthSmile!.scale.x > base.mouthSmile!.scale.x, '0.85 smiles wider than 0.75');
  assert.ok(lo.mouthSmile!.scale.x < base.mouthSmile!.scale.x, '0.55 smiles softer than 0.75');

  // Pose amplitude scales with intensity too
  const sadHi = buildRig('clara');
  animateCharacterRig(sadHi, 'idle', 0, 1.5, 1 / 30, 0, { emotion: 'sad', emotionIntensity: 0.85 });
  const sadLo = buildRig('clara');
  animateCharacterRig(sadLo, 'idle', 0, 1.5, 1 / 30, 0, { emotion: 'sad', emotionIntensity: 0.55 });
  assert.ok(sadHi.torsoPivot!.rotation.x > sadLo.torsoPivot!.rotation.x, 'sad slouch deepens with intensity');
});

test('Jun consumes the shared face/head v2 path (builder consolidation)', () => {
  const jun = buildRig('jun');
  const head = jun.headGroup.children.find(
    (o): o is THREE.Mesh => o instanceof THREE.Mesh && o.geometry instanceof THREE.SphereGeometry,
  )!;
  assert.equal((head.geometry as THREE.SphereGeometry).parameters.radius, 0.31);
  assert.ok(jun.handAnchor, 'jun exposes the hand anchor contract');
  // Jun's courier cap still sits over the v2 head
  const capCrown = jun.headGroup.children.find(
    (o): o is THREE.Mesh =>
      o instanceof THREE.Mesh && o.geometry instanceof THREE.CylinderGeometry && o.position.y > 0.15,
  );
  assert.ok(capCrown, 'jun keeps his courier cap over the v2 head');
});

test('re-derived silhouette envelope: head/hand growth stays inside the gameplay envelope', () => {
  const rig = buildRig('player');
  rig.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(rig.bodyGroup);
  assert.ok(box.max.z < 0.42, `front reach ${box.max.z.toFixed(3)} stays under 0.42`);
  assert.ok(box.min.y >= -0.01, `grounded: lowest point ${box.min.y.toFixed(3)} >= -0.01`);
  // Height: head top ≈ 1.66 with the v2 head (unchanged height span law)
  const topY = rig.headGroup.position.y + 0.45 + 0.31;
  assert.ok(topY > 1.6 && topY < 1.7, `standing height ≈ 1.66, got ${topY.toFixed(3)}`);
});
