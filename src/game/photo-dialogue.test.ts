/**
 * PHDE — Photography social dialogue acceptance tests (Workstream B).
 *
 * Spec of record: docs/architecture/stage3-everyday-activities/05-photography-design.md
 * Verifies that the two `PHOTO_ECHO_TOPICS`
 * (src/game/dialogue/everyday/photoEcho.ts) surface the photography.ts
 * capture reducer's witness memory writes as everyday conversational
 * afterlife — witness-scoped, mention-flip retired, and honoring the
 * append-only registry contract.
 *
 * Mirrors the SC-A pattern from community-dialogue.test.ts (Stage 1 witness
 * echo, omniscience guard, choice retires memory). Worlds are staged from
 * createFreshWorldState(); the pure reducer never mutates its input.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { applyDialogueChoice } from './actions';
import { buildResidentDialogue } from './narrative';
import { performPhotoAction } from './photography';
import { createFreshWorldState } from './storage';
import { PersonalItemId, ResidentId, TimePhase, WorldState } from './types';

// ---------------------------------------------------------------------------
// Staged-world helpers (house style — copied from community-dialogue.test.ts)
// ---------------------------------------------------------------------------

/**
 * Suppresses all quest_milestone intro topics so they don't outrank the
 * event_reaction echo family. Mirrors the flag set used by community-dialogue
 * and dialogue.test.ts sample worlds.
 */
function withIntroFlagsSuppressed(world: WorldState): WorldState {
  return {
    ...world,
    flags: {
      ...world.flags,
      heardBellMystery: true,
      foundPostcard: true,
      deliveredPostcard: true,
      brewedChamomileTea: true,
      borrowedBarnabyLadder: true,
      clearedGazeboIvy: true,
      foundBrassClapper: true,
      repairedFountain: true,
      plantedMoonPetals: true,
    },
  };
}

function withWitnessNearby(world: WorldState, id: ResidentId, distance = 1.2): WorldState {
  return {
    ...world,
    npcRuntime: {
      ...world.npcRuntime,
      [id]: {
        ...world.npcRuntime[id],
        position: { x: world.playerPos.x + distance, z: world.playerPos.z },
        targetPos: { x: world.playerPos.x + distance, z: world.playerPos.z },
      },
    },
  };
}

function withFarAway(world: WorldState, id: ResidentId): WorldState {
  return {
    ...world,
    npcRuntime: {
      ...world.npcRuntime,
      [id]: {
        ...world.npcRuntime[id],
        position: { x: world.playerPos.x + 40, z: world.playerPos.z + 40 },
        targetPos: { x: world.playerPos.x + 40, z: world.playerPos.z + 40 },
      },
    },
  };
}

/** Marks the resident as met so computeContextBoosts applies the R1 echo boost. */
function withMet(world: WorldState, id: ResidentId): WorldState {
  return {
    ...world,
    residents: {
      ...world.residents,
      [id]: { ...world.residents[id], met: true },
    },
  };
}

/** Stages the player outdoors beside Mirror Pond, ready to capture. */
function stageOutdoorAtPond(world: WorldState): WorldState {
  return {
    ...world,
    playerPos: { x: 1.8, z: 10.6 },
    playerLocation: 'exterior',
  };
}

// ---------------------------------------------------------------------------
// PHDE-01: a witness neighbor echoes the capture via the 'photo' witness memory
// ---------------------------------------------------------------------------

test('PHDE-01: a witness neighbor echoes the capture via the photo witness memory', () => {
  let world = withIntroFlagsSuppressed(createFreshWorldState());
  world = stageOutdoorAtPond(world);
  world = withWitnessNearby(world, 'pip');
  world = withMet(world, 'pip');
  assert.equal(world.npcMemories.pip.length, 0, 'fresh Pip holds no memories');

  // Capture mirror_pond outdoors, with Pip within LOCAL_WITNESS_RADIUS.
  const res = performPhotoAction(world, 'mirror_pond');
  const captureWorld = res.nextWorld;

  // Pip (within LOCAL_WITNESS_RADIUS) holds an unmentioned 'photo' witness
  // memory → the witness echo fires (priority 12, no SF-4 boost because the
  // tag is 'photo' not 'shared_photo' — stays gentle below the community band).
  const session = buildResidentDialogue('pip', captureWorld, 'afternoon' as TimePhase);
  assert.equal(
    session.topicId,
    'everyday_photo_witness_echo',
    `expected witness echo; got topicId="${session.topicId}"`,
  );

  // Build text reflects the subject name the witness memory carries and uses
  // the witness-voice phrase 'saw you' (distinguishes from the participant voice
  // community echo topics use).
  const rootText = session.nodes[session.currentNodeId].text;
  assert.ok(
    rootText.includes('Mirror Pond Bank'),
    `witness echo text references the subject name; got: "${rootText}"`,
  );
  assert.ok(
    rootText.includes('saw you'),
    `witness voice uses 'saw you'; got: "${rootText}"`,
  );

  // Input world not mutated by the pure dialogue read.
  assert.equal(world.npcMemories.pip.length, 0, 'input world not mutated by buildResidentDialogue');
});

// ---------------------------------------------------------------------------
// PHDE-02: Omniscience guard — a far-away neighbor gets NO photo echo
// ---------------------------------------------------------------------------

test('PHDE-02: a neighbor beyond LOCAL_WITNESS_RADIUS never echoes a capture they never witnessed', () => {
  let world = withIntroFlagsSuppressed(createFreshWorldState());
  world = stageOutdoorAtPond(world);
  // Pip is the witness (within radius); Mina is far away and never witnesses.
  world = withWitnessNearby(world, 'pip');
  world = withFarAway(world, 'mina');
  world = withMet(world, 'pip');
  world = withMet(world, 'mina');

  const res = performPhotoAction(world, 'mirror_pond');

  // Mina (far beyond LOCAL_WITNESS_RADIUS) holds no 'photo' witness memory,
  // so neither witness echo nor noticer may fire for her.
  const minaSession = buildResidentDialogue('mina', res.nextWorld, 'afternoon' as TimePhase);
  assert.notEqual(
    minaSession.topicId,
    'everyday_photo_witness_echo',
    `Mina (far away) must not echo a capture she never witnessed; got topicId="${minaSession.topicId}"`,
  );
  assert.notEqual(
    minaSession.topicId,
    'everyday_photo_noticer',
    `Mina (far away) must not fire the noticer either; got topicId="${minaSession.topicId}"`,
  );

  // Pip (the witness) still gets the echo — the guard is per-speaker, not a
  // global suppression.
  const pipSession = buildResidentDialogue('pip', res.nextWorld, 'afternoon' as TimePhase);
  assert.equal(
    pipSession.topicId,
    'everyday_photo_witness_echo',
    'Pip (the witness) still gets the echo',
  );
});

// ---------------------------------------------------------------------------
// PHDE-03: applying the witness echo choice retires the 'photo' witness memory
// ---------------------------------------------------------------------------

test('PHDE-03: applying the witness echo choice marks the photo memory mentioned and retires the echo', () => {
  let world = withIntroFlagsSuppressed(createFreshWorldState());
  world = stageOutdoorAtPond(world);
  world = withWitnessNearby(world, 'pip');
  world = withMet(world, 'pip');

  const res = performPhotoAction(world, 'mirror_pond');
  const captureWorld = res.nextWorld;

  const witnessMem = captureWorld.npcMemories.pip.find((m) => m.tag === 'photo');
  assert.ok(witnessMem, 'Pip holds the witness memory');
  assert.equal(witnessMem!.mentionedToPlayer, false, 'memory starts unmentioned');

  const session = buildResidentDialogue('pip', captureWorld, 'afternoon' as TimePhase);
  assert.equal(session.topicId, 'everyday_photo_witness_echo');

  const choice = session.nodes[session.currentNodeId].choices.find(
    (c) => c.id === 'ev_photo_witness_warm',
  );
  assert.ok(choice, 'witness echo exposes the warm choice');
  assert.deepEqual(
    choice!.markMemoryTagsMentioned,
    ['photo'],
    'choice carries the tag-flip side-effect that retires the photo memory',
  );

  const after = applyDialogueChoice(captureWorld, session, choice!).nextWorld;
  const afterMem = after.npcMemories.pip.find((m) => m.tag === 'photo');
  assert.equal(
    afterMem!.mentionedToPlayer,
    true,
    'applying the choice flipped the witness memory to mentioned',
  );

  // The witness echo no longer fires for Pip on a second conversation (memory
  // now mentioned → unmentionedOnly:true fails). This proves the mention-flip
  // actually retires the topic, not just decorates the choice. Mirrors SC-A-04.
  const session2 = buildResidentDialogue('pip', after, 'afternoon' as TimePhase);
  assert.notEqual(
    session2.topicId,
    'everyday_photo_witness_echo',
    `witness echo does not re-fire once the photo memory is mentioned; got topicId="${session2.topicId}"`,
  );
});
