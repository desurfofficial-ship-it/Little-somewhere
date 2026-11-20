import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { animateCharacterRig, buildStorybookCharacter } from './builders/characters';
import { buildStorybookJun } from './prototypes/willowLaneDiorama';
import { MaterialPalette } from './materials';
import { RESIDENTS } from '../game/residents';
import type { ResidentId } from '../game/types';

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

/** Drive the rig with fixed dt until damped values settle (~1s of simulated time). */
function settleRig(
  rig: ReturnType<typeof buildRig>,
  animState: Parameters<typeof animateCharacterRig>[1],
  seconds: number,
  opts?: Parameters<typeof animateCharacterRig>[6],
) {
  const dt = 1 / 30;
  for (let i = 0; i < Math.ceil(seconds / dt); i++) {
    animateCharacterRig(rig, animState, i * dt * 6, i * dt, dt, 0, opts);
  }
}

const ALL_CAST: Array<ResidentId | 'player'> = [
  'player',
  'clara',
  'arthur',
  'mina',
  'jun',
  'barnaby',
  'sora',
  'toby',
  'nora',
  'pip',
  'rowan',
];

test('every member of the cast — player and all nine neighbors — has an expressive mouth', () => {
  for (const id of ALL_CAST) {
    const rig = buildRig(id);
    assert.ok(rig.mouthSmile, `${id} must expose mouthSmile`);
    assert.ok(rig.mouthO, `${id} must expose mouthO`);
    assert.equal(rig.mouthSmile!.visible, true, `${id} default mood shows the smile`);
    assert.equal(rig.mouthO!.visible, false, `${id} surprised "o" starts hidden`);
    // The mouth sits on the face: below eye level, in front of the head center
    assert.ok(rig.mouthSmile!.position.y < 0, `${id} mouth below the eyes`);
    assert.ok(rig.mouthSmile!.position.z > 0.2, `${id} mouth on the face front`);
  }
});

test('emotions travel across the face: wide smile when happy, frown when sad, "o" when surprised', () => {
  const rig = buildRig('nora');
  const smile = rig.mouthSmile!;
  const o = rig.mouthO!;
  const SMILE_RZ = Math.PI * 1.14;
  const FROWN_RZ = Math.PI * 0.14;

  // Relaxed baseline
  settleRig(rig, 'idle', 1.5, { emotion: 'relaxed' });
  assert.ok(Math.abs(smile.rotation.z - SMILE_RZ) < 0.05, 'relaxed sits at the smile arc');
  assert.ok(Math.abs(smile.scale.x - 1) < 0.05, 'relaxed smile is neutral scale');

  // Happy widens the smile
  settleRig(rig, 'idle', 1.5, { emotion: 'happy' });
  assert.ok(smile.scale.x > 1.15, `happy smile widens, got ${smile.scale.x.toFixed(2)}`);

  // Sad flips the arc to a frown
  settleRig(rig, 'idle', 1.5, { emotion: 'sad' });
  assert.ok(smile.rotation.z < Math.PI * 0.5, `sad rotates arc to frown, got ${smile.rotation.z.toFixed(2)}`);
  assert.ok(Math.abs(smile.rotation.z - FROWN_RZ) < 0.05);

  // Surprised swaps to the "o" ring
  settleRig(rig, 'idle', 1.0, { emotion: 'surprised' });
  assert.equal(o.visible, true, 'surprised shows the "o"');
  assert.equal(smile.visible, false, 'surprised hides the smile arc');
  assert.ok(o.scale.x > 0.5, 'o ring pops to visible scale');

  // Back to relaxed restores the smile
  settleRig(rig, 'idle', 1.5, { emotion: 'relaxed' });
  assert.equal(smile.visible, true);
  assert.equal(o.visible, false);
});

test('the player still smiles when carrying and residents keep their player-exclusive extras off', () => {
  const player = buildRig('player');
  settleRig(player, 'walk', 1.2, { emotion: 'happy', isMoving: true });
  assert.ok(player.mouthSmile!.scale.x > 1.1, 'player reads happy while holding an item');
  assert.ok(player.scarfPivot && player.satchelGroup, 'player keeps satchel + scarf');

  const nora = buildRig('nora');
  assert.equal(nora.scarfPivot, undefined, 'nora has no player scarf');
  assert.equal(nora.satchelGroup, undefined, 'nora has no player satchel');
});

test('each neighbor carries named identity props that make them readable at a glance', () => {
  const cases: Array<[ResidentId, string[]]> = [
    ['mina', ['hat_flower', 'hair_side_locks']],
    ['sora', ['hair_side_locks', 'shawl_tail_pivot']],
    ['nora', ['hair_back_fall', 'shawl_tail_pivot']],
    ['clara', ['hair_temple_strands']],
    ['barnaby', ['beard', 'soot_smudge']],
    ['rowan', ['beard', 'orchard_belt', 'pruning_shears', 'neckerchief']],
    ['toby', ['paint_smudges', 'sketch_roll', 'charcoal_smudge']],
    ['pip', ['freckles', 'knee_patch', 'hair_escaped_tuft']],
    ['jun', ['scarf_tail_pivot']],
  ];
  for (const [id, names] of cases) {
    const rig = buildRig(id);
    for (const name of names) {
      const part = findNamed(rig.root, name);
      assert.ok(part, `${id} must carry "${name}"`);
      assert.ok(part.visible, `${id}'s "${name}" is visible`);
    }
  }

  // Identity props stay exclusive: no cross-contamination of signature props
  const mina = buildRig('mina');
  assert.equal(findNamed(mina.root, 'orchard_belt'), undefined, 'rowan belt stays with rowan');
  const rowan = buildRig('rowan');
  assert.equal(findNamed(rowan.root, 'hat_flower'), undefined, 'mina flower stays with mina');
  const toby = buildRig('toby');
  assert.equal(findNamed(toby.root, 'beard'), undefined, 'beard belongs to barnaby/rowan only');
});

test('pip is a child: freckles sit on the cheeks and the knee patch rides the swinging leg', () => {
  const rig = buildRig('pip');
  const freckles = findNamed(rig.root, 'freckles')!;
  const dots: THREE.Mesh[] = [];
  freckles.traverse((o) => {
    if (o instanceof THREE.Mesh) dots.push(o);
  });
  assert.ok(dots.length >= 6, `pip has a scattered freckle cluster, got ${dots.length}`);
  for (const dot of dots) {
    const r = dot.position.length();
    assert.ok(r > 0.24 && r < 0.32, `freckle sits on the face surface, got ${r.toFixed(3)}`);
  }

  const patch = findNamed(rig.root, 'knee_patch')!;
  assert.ok(patch.parent === rig.rightLeg, 'knee patch is parented to the leg so it swings with it');
});

test('hanging cloth (shawl/scarf tails) sways with the stride and breathes at rest', () => {
  const sora = buildRig('sora');
  const tail = sora.swayTail!;
  assert.ok(tail, 'sora exposes swayTail');

  // Walk: the tail visibly answers each stride
  const dt = 1 / 30;
  let walkPhase = 0;
  for (let i = 0; i < 40; i++) {
    walkPhase += dt * 6;
    animateCharacterRig(sora, 'walk', walkPhase, i * dt, dt, 0, { isMoving: true });
  }
  assert.ok(Math.abs(tail.rotation.z) > 0.04, `tail swings while walking, got ${tail.rotation.z.toFixed(3)}`);

  // Rest: a gentle breathing sway, much smaller than the stride swing
  for (let i = 0; i < 40; i++) {
    animateCharacterRig(sora, 'idle', 0, i * dt, dt, 0, { isMoving: false });
  }
  assert.ok(Math.abs(tail.rotation.z) <= 0.12, `rest sway is gentle, got ${tail.rotation.z.toFixed(3)}`);

  // Jun's courier scarf tail rides the same system
  const jun = buildRig('jun');
  assert.ok(jun.swayTail, 'jun exposes swayTail');
});

test('identity pass leaves the shared silhouette contract intact (clearance & scale guards)', () => {
  for (const id of ['toby', 'rowan', 'barnaby', 'pip', 'mina'] as const) {
    const rig = buildRig(id);
    // Nothing added hangs below the ground plane
    let minY = Infinity;
    rig.root.traverse((o) => {
      if (o instanceof THREE.Mesh && o.visible) {
        o.updateWorldMatrix(true, false);
        const box = new THREE.Box3().setFromObject(o);
        if (box.min.y < minY) minY = box.min.y;
      }
    });
    assert.ok(minY > -0.02, `${id} has no mesh sinking below ground (minY=${minY.toFixed(3)})`);
    // Body group keeps its authored height scale (squash drives it only per-frame)
    assert.ok(rig.bodyGroup.scale.x > 0, `${id} body scale intact`);
  }
});
