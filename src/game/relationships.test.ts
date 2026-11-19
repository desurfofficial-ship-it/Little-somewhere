import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getHeartLevel,
  getNpcPairKey,
  getNpcRelation,
  getRelationshipTier,
} from './relationships';
import { createFreshWorldState, advanceToNextDay } from './storage';
import { buildResidentDialogue } from './narrative';
import { applyDialogueChoice } from './actions';
import { RESIDENT_ORDER } from './residents';

test('relationship tiers, canonical pair keys, and baseline lore bonds initialize properly', () => {
  assert.equal(getNpcPairKey('clara', 'arthur'), 'arthur:clara');
  assert.equal(getNpcPairKey('arthur', 'clara'), 'arthur:clara');
  assert.equal(getHeartLevel(39), 1);
  assert.equal(getHeartLevel(40), 2);
  assert.equal(getRelationshipTier(0), 'stranger');
  assert.equal(getRelationshipTier(50), 'friendly');
  assert.equal(getRelationshipTier(95), 'kindred');

  const world = createFreshWorldState();
  const claraArthur = getNpcRelation(world.npcRelations, 'clara', 'arthur');
  assert.ok(claraArthur.affinity < 0);
  assert.equal(claraArthur.tension, 75);

  const claraMina = getNpcRelation(world.npcRelations, 'clara', 'mina');
  assert.ok(claraMina.affinity >= 60);
});

test('daily small-talk cap prevents Day 1 trust-farming exploit while milestones still award hearts', () => {
  let world = createFreshWorldState();
  // Speak to Barnaby repeatedly using small-talk choice (barnaby_craft)
  for (let i = 0; i < 6; i++) {
    const session = buildResidentDialogue('barnaby', world, 'morning');
    const craftChoice = session.nodes.root.choices.find((c) => c.id === 'barnaby_craft');
    assert.ok(craftChoice);
    world = applyDialogueChoice(world, session, craftChoice).nextWorld;
  }

  // Should NOT be able to farm Barnaby trust to 5 on Day 1 via small talk
  assert.equal(world.residents.barnaby.trust, 0);
  assert.equal(world.playerRelations.barnaby.dailyAffinityGained, 10);
  assert.equal(world.playerRelations.barnaby.affinity, 10);
  assert.equal(world.playerRelations.barnaby.talkedCount, 6);
  assert.ok(world.playerRelations.barnaby.familiarity >= 14);

  // Story milestone choice still unlocks full heart reward
  const fountainSession = buildResidentDialogue('barnaby', world, 'morning');
  const fountainChoice = fountainSession.nodes.root.choices.find((c) => c.id === 'barnaby_fountain');
  assert.ok(fountainChoice);
  world = applyDialogueChoice(world, fountainSession, fountainChoice).nextWorld;
  assert.equal(world.residents.barnaby.trust, 1);

  // Next day resets dailyAffinityGained so second day small-talk warms naturally across 20 -> 1 heart
  world = advanceToNextDay(world);
  assert.equal(world.playerRelations.barnaby.dailyAffinityGained, 0);
});

test('nora_read_together and toby_clapper fixes and all dialogue nextNodeId references hold', () => {
  let world = createFreshWorldState();

  // Verify Toby clapper choice requires heardBellMystery
  const tobyBefore = buildResidentDialogue('toby', world, 'morning');
  const clapperBefore = tobyBefore.nodes.root.choices.find((c) => c.id === 'toby_clapper');
  assert.equal(clapperBefore?.requiresFlag, 'heardBellMystery');

  // Learn mystery via Pip
  const pipSession = buildResidentDialogue('pip', world, 'morning');
  world = applyDialogueChoice(world, pipSession, pipSession.nodes.root.choices[0]).nextWorld;

  // Nora alternate path (nora_read_together) also unlocks mem_lost_postcard
  const noraSession = buildResidentDialogue('nora', world, 'morning');
  const storyChoice = noraSession.nodes.root.choices.find((c) => c.id === 'nora_bell')!;
  const step1 = applyDialogueChoice(world, noraSession, storyChoice);
  world = step1.nextWorld;
  const readTogether = step1.nextSession.nodes.nora_story.choices.find(
    (c) => c.id === 'nora_read_together',
  )!;
  const step2 = applyDialogueChoice(world, step1.nextSession, readTogether);
  assert.equal(step2.nextWorld.memories.some((m) => m.id === 'mem_lost_postcard'), true);

  // Verify every choice.nextNodeId resolves cleanly across all residents & phases
  const phases = ['morning', 'afternoon', 'golden', 'dusk'] as const;
  for (const id of RESIDENT_ORDER) {
    for (const phase of phases) {
      const s = buildResidentDialogue(id, world, phase);
      for (const node of Object.values(s.nodes)) {
        for (const ch of node.choices) {
          assert.ok(
            s.nodes[ch.nextNodeId],
            `Dialogue ${id} (${phase}) choice ${ch.id} points to missing node ${ch.nextNodeId}`,
          );
        }
      }
    }
  }
});

test('reconciliation upgrades arthur:clara bilateral NPC relationship', () => {
  let world = createFreshWorldState();
  world = {
    ...world,
    flags: { ...world.flags, heardBellMystery: true, foundBrassClapper: true },
  };
  const claraSession = buildResidentDialogue('clara', world, 'morning');
  const bridge = claraSession.nodes.root.choices.find((c) => c.id === 'clara_bridge_truth')!;
  world = applyDialogueChoice(world, claraSession, bridge).nextWorld;

  const rel = getNpcRelation(world.npcRelations, 'clara', 'arthur');
  assert.ok(rel.affinity >= 55);
  assert.ok(rel.tension <= 10);
});
