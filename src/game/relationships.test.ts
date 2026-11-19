import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getHeartLevel,
  getNpcPairKey,
  getNpcRelation,
  getNpcRelationTier,
  getRelationshipTier,
  isResidentGuarded,
} from './relationships';
import { createFreshWorldState, advanceToNextDay, serializeWorldState, deserializeWorldState } from './storage';
import { buildResidentDialogue } from './narrative';
import { resolveRelationshipGreeting } from './dialogueEngine';
import { applyDialogueChoice } from './actions';
import { stepSimulation } from './simulation';
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
  assert.equal(getNpcRelationTier(claraArthur), 'estranged');

  const claraMina = getNpcRelation(world.npcRelations, 'clara', 'mina');
  assert.ok(claraMina.affinity >= 60);
  assert.equal(getNpcRelationTier(claraMina), 'confidant');
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
  const milestoneRes = applyDialogueChoice(world, fountainSession, fountainChoice);
  world = milestoneRes.nextWorld;
  assert.equal(world.residents.barnaby.trust, 1);
  assert.equal(milestoneRes.nextSession.tier, 'acquaintance');
  assert.equal(milestoneRes.nextSession.milestonePulseSeq, 1);

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
  assert.equal(getNpcRelationTier(rel), 'warm');
});

test('Phase 2: negative affinity setbacks survive save/reload and greeting text fluctuates warmly across tiers', () => {
  let world = createFreshWorldState();
  world = {
    ...world,
    flags: { ...world.flags, heardBellMystery: true, foundPostcard: true },
    residents: {
      ...world.residents,
      jun: { ...world.residents.jun, met: true, trust: 1 },
    },
    playerRelations: {
      ...world.playerRelations,
      jun: { ...world.playerRelations.jun, affinity: 22, reliability: 25 },
    },
  };

  // Blunt reply reduces Jun's affinity below 20 and lowers derived trust coherently
  const junSession = buildResidentDialogue('jun', world, 'morning');
  const blunt = junSession.nodes.root.choices.find((c) => c.id === 'jun_scold_blunt')!;
  const afterBluntRes = applyDialogueChoice(world, junSession, blunt);
  world = afterBluntRes.nextWorld;

  assert.ok(world.playerRelations.jun.affinity < 20);
  assert.equal(world.residents.jun.trust, 0);
  assert.equal(afterBluntRes.nextSession.milestonePulseSeq, undefined);
  assert.equal(isResidentGuarded(world.playerRelations.jun, world.npcRuntime.jun.emotion), true);

  // Round-trip save/reload must NOT snap affinity back up to 20
  const reloaded = deserializeWorldState(serializeWorldState(world)).state;
  assert.equal(reloaded.playerRelations.jun.affinity, world.playerRelations.jun.affinity);
  assert.equal(reloaded.residents.jun.trust, 0);

  // Greeting text fluctuates meaningfully across Stranger -> Acquaintance -> Friendly -> Close -> Kindred
  const claraWorld: typeof world = {
    ...world,
    residents: { ...world.residents, clara: { ...world.residents.clara, met: true } },
    npcRuntime: { ...world.npcRuntime, clara: { ...world.npcRuntime.clara, emotion: 'happy' } },
  };
  const strangerGreet = resolveRelationshipGreeting('clara', {
    ...claraWorld,
    playerRelations: { ...claraWorld.playerRelations, clara: { ...claraWorld.playerRelations.clara, affinity: 5 } },
  }, 'morning');
  const friendlyGreet = resolveRelationshipGreeting('clara', {
    ...claraWorld,
    playerRelations: { ...claraWorld.playerRelations, clara: { ...claraWorld.playerRelations.clara, affinity: 45 } },
  }, 'morning');
  const kindredGreet = resolveRelationshipGreeting('clara', {
    ...claraWorld,
    playerRelations: { ...claraWorld.playerRelations, clara: { ...claraWorld.playerRelations.clara, affinity: 90 } },
  }, 'morning');

  assert.notEqual(strangerGreet, friendlyGreet);
  assert.notEqual(friendlyGreet, kindredGreet);
  assert.ok(kindredGreet.includes('Hearth & Crumb') || kindredGreet.includes('kindred'));
});

test('Phase 2: relationship tiers drive NPC greeting distance, bubble warmth, and social recharge', () => {
  const base = createFreshWorldState();
  // Place player 3.8m away from Mina (outside base 3.3m greeting distance, inside kindred 1.28x ~4.22m range)
  const targetPos = { x: base.npcRuntime.mina.position.x + 3.7, z: base.npcRuntime.mina.position.z };

  const strangerWorld = {
    ...base,
    playerPos: targetPos,
    residents: { ...base.residents, mina: { ...base.residents.mina, met: true } },
    playerRelations: {
      ...base.playerRelations,
      mina: { ...base.playerRelations.mina, affinity: 5, reliability: 25 },
    },
  };
  const kindredWorld = {
    ...strangerWorld,
    playerRelations: {
      ...strangerWorld.playerRelations,
      mina: { ...strangerWorld.playerRelations.mina, affinity: 92, reliability: 60 },
    },
  };

  const steppedStranger = stepSimulation(strangerWorld, 0.2);
  const steppedKindred = stepSimulation(kindredWorld, 0.2);

  assert.equal(steppedStranger.npcRuntime.mina.activeBubbleText, null);
  assert.ok(steppedKindred.npcRuntime.mina.activeBubbleText);
  assert.ok(
    steppedKindred.npcRuntime.mina.activeBubbleText!.includes('Favorite') ||
      steppedKindred.npcRuntime.mina.activeBubbleText!.includes('crosses mine'),
  );
});

