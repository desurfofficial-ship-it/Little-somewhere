import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MaterialPalette } from './materials';
import {
  PLAYER_LANTERN_GLOW,
  animateCharacterRig,
  buildStorybookPlayer,
  updatePlayerLantern,
} from './builders/characters';

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

function findMaterialColor(
  root: THREE.Object3D,
  hex: string,
): boolean {
  let found = false;
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
    if (mat && mat.color && `#${mat.color.getHexString()}`.toUpperCase() === hex.toUpperCase()) {
      found = true;
    }
  });
  return found;
}

test('buildStorybookPlayer layers the bespoke kit (scarf, satchel, postcard, beret pin) onto the shared storybook body', () => {
  const palette = new MaterialPalette();
  const dummyTex = new THREE.Texture();
  const rig = buildStorybookPlayer(PLAYER_APPEARANCE, palette, dummyTex);

  // Shared articulated body stays fully intact
  assert.ok(rig.torsoPivot, 'torsoPivot present');
  assert.ok(rig.carrySocket, 'carrySocket present');
  assert.ok(rig.carrySocket.parent === rig.torsoPivot, 'carrySocket attached to torso');
  assert.ok(rig.headGroup, 'headGroup present');

  // Bespoke layers: moss knit scarf (#87A98B), oat-canvas satchel (#C7B48E),
  // peeking postcard paper (#FAF2E1), and the brass lantern hardware.
  assert.ok(findMaterialColor(rig.root, '#87A98B'), 'moss knit scarf material present');
  assert.ok(findMaterialColor(rig.root, '#C7B48E'), 'oat-canvas satchel material present');
  assert.ok(findMaterialColor(rig.root, '#FAF2E1'), 'postcard paper material present');

  // Lantern hangs off the torso pivot and starts dark (daytime)
  assert.equal(rig.lantern.group.parent, rig.torsoPivot, 'lantern attached to torso pivot');
  assert.equal(rig.lantern.glassMat.emissiveIntensity, 0, 'lantern glass starts dark');
  assert.equal(rig.lantern.flameMat.emissiveIntensity, 0, 'lantern flame starts dark');
  assert.equal(rig.lantern.glowLevel, 0, 'glow level starts at zero');

  palette.disposeAll();
  dummyTex.dispose();
});

test('updatePlayerLantern damps glow toward the time-phase target and sways with the stride', () => {
  const palette = new MaterialPalette();
  const dummyTex = new THREE.Texture();
  const rig = buildStorybookPlayer(PLAYER_APPEARANCE, palette, dummyTex);
  const lantern = rig.lantern;

  // ~3 seconds of dusk exposure converges toward the dusk glow target
  for (let i = 0; i < 90; i++) {
    updatePlayerLantern(lantern, PLAYER_LANTERN_GLOW.dusk, 1 / 30, i / 30, 0);
  }
  assert.ok(
    lantern.glowLevel > PLAYER_LANTERN_GLOW.dusk * 0.9,
    `glow level converges toward dusk target (got ${lantern.glowLevel.toFixed(3)})`,
  );
  assert.ok(lantern.glassMat.emissiveIntensity > 1.0, 'glass emissive reads warmly at dusk');
  assert.ok(lantern.flameMat.emissiveIntensity > 1.0, 'flame emissive reads at dusk');
  assert.ok(lantern.flameMat.visible, 'flame visible once glowing');

  // Walking sway: phase advances with speed and the lantern tilts
  const phaseBefore = lantern.swingPhase;
  let maxTilt = 0;
  for (let i = 0; i < 90; i++) {
    updatePlayerLantern(lantern, PLAYER_LANTERN_GLOW.dusk, 1 / 30, 3 + i / 30, 5.4);
    maxTilt = Math.max(maxTilt, Math.abs(lantern.group.rotation.z));
  }
  assert.ok(lantern.swingPhase > phaseBefore, 'swing phase advances while moving');
  assert.ok(maxTilt > 0.02, `lantern sways while walking (max tilt ${maxTilt.toFixed(3)})`);

  // Daytime dims back down and the flame hides
  for (let i = 0; i < 180; i++) {
    updatePlayerLantern(lantern, PLAYER_LANTERN_GLOW.day, 1 / 30, 10 + i / 30, 0);
  }
  assert.ok(lantern.glowLevel < 0.2, 'glow decays back to daytime level');
  assert.ok(!lantern.flameMat.visible, 'flame hidden when dark');

  palette.disposeAll();
  dummyTex.dispose();
});

test("player idle flourishes animate: adjust_hat raises the arm to the beret, look_around sweeps the head", () => {
  const palette = new MaterialPalette();
  const dummyTex = new THREE.Texture();
  const rig = buildStorybookPlayer(PLAYER_APPEARANCE, palette, dummyTex);

  // adjust_hat: right arm lifts toward the beret, head tilts into the pat
  for (let i = 0; i < 40; i++) {
    animateCharacterRig(rig, 'adjust_hat', 0, i / 30, 1 / 30, 0);
  }
  assert.ok(
    rig.rightArm.rotation.x < -1.6,
    `adjust_hat raises right arm (got ${rig.rightArm.rotation.x.toFixed(3)})`,
  );
  assert.ok(
    Math.abs(rig.headGroup.rotation.z) > 0.02,
    'adjust_hat tilts the head',
  );

  // look_around: arm relaxes, head sweeps side to side
  let maxHeadYaw = 0;
  for (let i = 0; i < 90; i++) {
    animateCharacterRig(rig, 'look_around', 0, 2 + i / 30, 1 / 30, 0);
    maxHeadYaw = Math.max(maxHeadYaw, Math.abs(rig.headGroup.rotation.y));
  }
  assert.ok(
    rig.rightArm.rotation.x > -0.5,
    `arm relaxes during look_around (got ${rig.rightArm.rotation.x.toFixed(3)})`,
  );
  assert.ok(maxHeadYaw > 0.1, `look_around sweeps the head (max yaw ${maxHeadYaw.toFixed(3)})`);

  // Shared states still drive the bespoke rig (walk swing)
  for (let i = 0; i < 30; i++) {
    animateCharacterRig(rig, 'walk', i * 0.22, 5 + i / 30, 1 / 30, 0);
  }
  assert.notEqual(rig.leftLeg.rotation.x, 0, 'walk swing moves legs on bespoke rig');

  palette.disposeAll();
  dummyTex.dispose();
});
