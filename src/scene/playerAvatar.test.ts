import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { animateCharacterRig, buildStorybookCharacter } from './builders/characters';
import { MaterialPalette } from './materials';

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

function buildPlayer() {
  const palette = new MaterialPalette();
  const dummyTex = new THREE.Texture();
  return buildStorybookCharacter(PLAYER_APPEARANCE, palette, dummyTex, 'player');
}

test('player rig carries the wanderer identity: satchel strap, hip pouch, and scarf pivot', () => {
  const rig = buildPlayer();

  // Player-only extras exist on the rig contract
  assert.ok(rig.scarfPivot, 'player rig must expose a scarfPivot');
  assert.ok(rig.satchelGroup, 'player rig must expose a satchelGroup');
  assert.equal(rig.heightScale, 1.0);

  // Satchel: strap + pouch + flap + brass details present in the torso subtree
  const satchelMeshes: THREE.Mesh[] = [];
  rig.satchelGroup!.traverse((o) => {
    if (o instanceof THREE.Mesh) satchelMeshes.push(o);
  });
  assert.ok(satchelMeshes.length >= 4, `satchel should have strap/pouch/flap/pin, got ${satchelMeshes.length}`);

  // Scarf tail has articulated segments (upper, lower, fringe)
  const scarfMeshes: THREE.Mesh[] = [];
  rig.scarfPivot!.traverse((o) => {
    if (o instanceof THREE.Mesh) scarfMeshes.push(o);
  });
  assert.ok(scarfMeshes.length >= 3, `scarf tail should have >=3 segments, got ${scarfMeshes.length}`);

  // Resident rigs do NOT get the player extras (identity stays player-exclusive)
  const npcRig = buildStorybookCharacter(
    {
      coatColor: '#B7A98C',
      shirtColor: '#F2E7D3',
      hairColor: '#6E6259',
      skinColor: '#F0C5A7',
      accentColor: '#8A6B4A',
      hatStyle: 'bun',
      propType: 'book',
      heightScale: 0.95,
    },
    new MaterialPalette(),
    new THREE.Texture(),
    'nora',
  );
  assert.equal(npcRig.scarfPivot, undefined);
  assert.equal(npcRig.satchelGroup, undefined);
  assert.equal(npcRig.heightScale, 0.95);
});

test('player silhouette stays within the clearance envelope (satchel/scarf do not reach past nose or sleeves)', () => {
  const rig = buildPlayer();
  rig.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(rig.bodyGroup);

  // Compare against a same-scale NPC without the satchel/scarf: the player extras
  // must not extend the silhouette beyond the baseline arm/skirt envelope.
  const npcRig = buildStorybookCharacter(
    { ...PLAYER_APPEARANCE, hatStyle: 'none', heightScale: 1.0 },
    new MaterialPalette(),
    new THREE.Texture(),
    'toby',
  );
  npcRig.root.updateMatrixWorld(true);
  const npcBox = new THREE.Box3().setFromObject(npcRig.bodyGroup);

  const width = box.max.x - box.min.x;
  const npcWidth = npcBox.max.x - npcBox.min.x;
  assert.ok(
    width <= npcWidth + 0.03,
    `silhouette width ${width.toFixed(3)} exceeds sleeve envelope ${npcWidth.toFixed(3)}`,
  );
  // Front reach: nose ~0.315 — extras must not push past it noticeably
  assert.ok(box.max.z < 0.42, `front reach ${box.max.z.toFixed(3)} would clip fountain/pond clearances`);
  // Back reach: coat skirt ~0.34 — pouch tucks inside it
  assert.ok(box.min.z >= npcBox.min.z - 0.02, `back reach ${box.min.z.toFixed(3)} exceeds coat envelope`);
  // Grounded: nothing hangs below y=0
  assert.ok(box.min.y >= -0.01, `lowest point ${box.min.y.toFixed(3)} dips under the floor`);
});

test('squash & stretch rescales the figure proportionally and returns to rest', () => {
  const rig = buildPlayer();
  animateCharacterRig(rig, 'idle', 0, 1.2, 0.016, 0, {});
  assert.ok(
    Math.abs(rig.bodyGroup.scale.y - 1.0) < 1e-6,
    'idle with no squash must keep the built height scale exactly',
  );

  // Compress: positive squash narrows XZ, lowers Y
  animateCharacterRig(rig, 'walk', 2.2, 1.2, 0.016, 0, { squash: 0.06, isMoving: true });
  assert.ok(Math.abs(rig.bodyGroup.scale.y - 1.06) < 1e-6);
  assert.ok(Math.abs(rig.bodyGroup.scale.x - (1 - 0.06 * 0.55)) < 1e-6);
  assert.ok(Math.abs(rig.bodyGroup.scale.z - rig.bodyGroup.scale.x) < 1e-6);

  // Stretch: negative squash on launch
  animateCharacterRig(rig, 'run', 3.1, 1.4, 0.016, 0, { squash: -0.02, isMoving: true });
  assert.ok(Math.abs(rig.bodyGroup.scale.y - 0.98) < 1e-6);
});

test('scarf secondary motion trails backward when moving and breathes at rest', () => {
  const rig = buildPlayer();
  const scarf = rig.scarfPivot!;

  animateCharacterRig(rig, 'sprint', 5.0, 2.0, 0.05, 0, { isMoving: true });
  assert.ok(scarf.rotation.x > 0.15, `sprinting scarf should trail back, got ${scarf.rotation.x}`);

  const sprintX = scarf.rotation.x;
  animateCharacterRig(rig, 'idle', 0, 2.0, 0.05, 0, { isMoving: false });
  assert.ok(scarf.rotation.x < sprintX - 0.1, 'resting scarf relaxes toward the collar');

  // Scarf flares outward on banked turns (a few frames so the damp settles)
  for (let i = 0; i < 5; i++) {
    animateCharacterRig(rig, 'run', 4.0, 1.5, 0.05, 0, { isMoving: true, bankAngle: 0.22 });
  }
  assert.ok(Math.abs(scarf.rotation.z) > 0.06, `banked turn should swing the scarf tail sideways, got ${scarf.rotation.z.toFixed(3)}`);
});

test('acceleration lean pitches the torso forward while keeping the gaze level', () => {
  const rig = buildPlayer();
  animateCharacterRig(rig, 'idle', 0, 1.0, 0.03, 0, {});
  const restTorso = rig.torsoPivot!.rotation.x;
  const restHead = rig.headGroup.rotation.x;

  animateCharacterRig(rig, 'idle', 0, 1.0, 0.03, 0, { accelLean: 1 });
  assert.ok(
    rig.torsoPivot!.rotation.x > restTorso + 0.05,
    'launch acceleration leans the torso into the run',
  );
  assert.ok(
    rig.headGroup.rotation.x < restHead + 0.02,
    'head counter-pitches to keep the gaze level',
  );
});

test('idle glance variety occasionally turns the head without disturbing the body rest pose', () => {
  const rig = buildPlayer();
  // Window where glance is active: sin(elapsed*0.52) > 0.86 → elapsed ≈ 3.29 rad
  animateCharacterRig(rig, 'idle', 0, 3.3, 0.05, 0, {});
  assert.ok(
    Math.abs(rig.headGroup.rotation.y) > 0.02,
    'glance window should rotate the head',
  );

  // Outside the window the head stays near the gentle default sway
  const rig2 = buildPlayer();
  animateCharacterRig(rig2, 'idle', 0, 0.4, 0.05, 0, {});
  assert.ok(
    Math.abs(rig2.headGroup.rotation.y) < 0.1,
    'outside glance window head sway stays subtle',
  );
});
