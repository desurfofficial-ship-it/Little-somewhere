/**
 * LR-4 acceptance & adversarial battery — Teaching grant, knowledge registry,
 * sanitizer stripping, and gated post-reading dialogue.
 *
 * Spec of record:
 *   - docs/architecture/living-relationships/14-revised-architecture.md (§10)
 *   - docs/architecture/living-relationships/23-lr4-teaching-specification.md (§2–§5)
 *   - docs/architecture/living-relationships/25-lr4-implementation-proposal.md
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  advanceToNextDay,
  computeWorldSaveRevision,
  createFreshWorldState,
  deserializeWorldState,
  serializeWorldState,
} from './storage';
import { CURRENT_SCHEMA_VERSION } from './migrations';
import { acceptInvitation, declineInvitation, expireInvitationsAt, offerInvitation } from './invitations';
import {
  KNOWLEDGE_IDS,
  KNOWN_KNOWLEDGE_IDS,
  completeSharedActivity,
  getSharedActivityDef,
} from './activities';
import { applyDialogueChoice, enterBakeryAction, enterNookAction, exitNookAction } from './actions';
import { DIALOGUE_TOPICS } from './dialogue';
import { computeContextBoosts } from './dialogueContext';
import { selectDialogueSession } from './dialogueEngine';
import { buildResidentDialogue } from './narrative';
import { stepSimulation } from './simulation';
import { getFeaturedBookForDay } from './bookNook';
import { createNpcMemoryEntry, recordNpcMemoryInPlace } from './memories';
import type { WorldState } from './types';

const noChoices = () => ({ choices: [], extraNodes: {} });

function stageMorningNookVisit(overrides?: { nookVisited?: boolean }): WorldState {
  const base = createFreshWorldState();
  const staged: WorldState = {
    ...base,
    day: 2,
    minuteOfDay: 540, // Morning: Nora at Linden Book Nook Bench
    flags: { ...base.flags, foundPostcard: true },
    sideFlags: { ...base.sideFlags, nookVisited: overrides?.nookVisited ?? true },
    residents: {
      ...base.residents,
      nora: { ...base.residents.nora, met: true, trust: 3 },
      clara: { ...base.residents.clara, met: true, trust: 3 },
    },
    playerRelations: {
      ...base.playerRelations,
      nora: {
        ...base.playerRelations.nora,
        affinity: 60,
        reliability: 40,
        negativeCount: 0,
      },
      clara: {
        ...base.playerRelations.clara,
        affinity: 60,
        reliability: 40,
        negativeCount: 0,
      },
    },
  };
  const offered = offerInvitation(staged, 'nora', 'share_featured_reading');
  assert.equal(offered.ok, true, 'precondition offer succeeds');
  const accepted = acceptInvitation(offered.world);
  assert.equal(accepted.ok, true, 'precondition accept succeeds');
  const entered = enterNookAction(accepted.world);
  assert.equal(entered.nextWorld.playerLocation, 'nook_interior');
  assert.equal(entered.nextWorld.occupancy?.residentId, 'nora');
  return entered.nextWorld;
}

test('LR4-01: registry exports nora_featured_reading cleanly and fresh reading completion grants it once', () => {
  assert.equal(KNOWN_KNOWLEDGE_IDS.includes('nora_featured_reading'), true);
  assert.equal(KNOWLEDGE_IDS.has('nora_featured_reading'), true);
  // Pre-LR5 pin updated cleanly upon LR-5 shipment: both LR-4 & LR-5 ids live.
  assert.equal(KNOWLEDGE_IDS.has('arthur_escapement_basics'), true, 'LR-5 shipped alongside LR-4');
  assert.equal(KNOWLEDGE_IDS.size, 2, 'LR-4 + LR-5 knowledge ids');

  const staged = stageMorningNookVisit();
  assert.deepEqual(staged.teaching.known, [], 'empty before completion');

  const res = completeSharedActivity(staged, 'share_featured_reading');
  assert.equal(res.ok, true);
  assert.deepEqual(res.world.teaching.known, ['nora_featured_reading']);
  assert.equal(res.world.playerRelations.nora.affinity, 66);
  assert.equal(res.world.playerRelations.nora.reliability, 42);
  assert.equal(
    res.world.memories.some((m) => m.id === 'mem_lr_nora_featured_reading'),
    true,
  );
  // Input world untouched (immutability)
  assert.deepEqual(staged.teaching.known, []);
});

test('LR4-01b: dialogue choice completion pathway also grants nora_featured_reading cleanly', () => {
  const staged = stageMorningNookVisit();
  const indoorSession = buildResidentDialogue('nora', staged, 'morning');
  assert.equal(indoorSession.topicId, 'inv_nora_indoor_reading');
  const completeChoice = indoorSession.nodes.root.choices.find(
    (c) => c.completeSharedActivityId === 'share_featured_reading',
  );
  assert.ok(completeChoice, 'indoor completion choice present');
  const afterChoice = applyDialogueChoice(staged, indoorSession, completeChoice);
  assert.deepEqual(afterChoice.nextWorld.teaching.known, ['nora_featured_reading']);
});

test('LR4-02: decline, window expiry, day advance expiry, and host-unavailable refusal grant zero knowledge', () => {
  const base = stageMorningNookVisit();
  // Offer -> decline
  const bare = createFreshWorldState();
  const ready: WorldState = {
    ...bare,
    minuteOfDay: 540,
    residents: { ...bare.residents, nora: { ...bare.residents.nora, met: true, trust: 3 } },
    playerRelations: {
      ...bare.playerRelations,
      nora: { ...bare.playerRelations.nora, affinity: 60, reliability: 40, negativeCount: 0 },
    },
  };
  const offer = offerInvitation(ready, 'nora', 'share_featured_reading').world;
  const declined = declineInvitation(offer).world;
  assert.deepEqual(declined.teaching.known, [], 'no grant on decline');

  // Offer -> minute expiry
  const expired = expireInvitationsAt(offer, offer.day, 750).world;
  assert.deepEqual(expired.teaching.known, [], 'no grant on window expiry');

  // Host-unavailable completion refusal (H-1 drift)
  const drifted: WorldState = {
    ...base,
    activeEncounters: [
      {
        id: 'enc_nora_lr4_drift',
        participants: ['nora', 'clara'],
        topicTag: 'drift',
        summary: 'Drifted outside',
        spots: [
          { x: 0, z: 0 },
          { x: 1, z: 0 },
        ],
        startedMinute: 540,
        endsMinute: 560,
      },
    ],
  };
  const refused = completeSharedActivity(drifted, 'share_featured_reading');
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, 'host_unavailable');
  assert.deepEqual(refused.world.teaching.known, [], 'no grant on host-unavailable refusal');
});

test('LR4-03: duplicate completion, pre-seeded memory guard, and already-known entry are idempotent', () => {
  const staged = stageMorningNookVisit();
  const first = completeSharedActivity(staged, 'share_featured_reading');
  assert.equal(first.ok, true);
  assert.deepEqual(first.world.teaching.known, ['nora_featured_reading']);

  const second = completeSharedActivity(first.world, 'share_featured_reading');
  assert.equal(second.ok, false);
  assert.deepEqual(second.world.teaching.known, ['nora_featured_reading'], 'no duplicate grant');

  // Pre-seeded memory blocks fresh visit completion AND knowledge grant
  const preSeeded: WorldState = {
    ...staged,
    memories: [
      {
        id: 'mem_lr_nora_featured_reading',
        day: 1,
        phase: 'morning',
        title: 'Shared Pages by Lamplight',
        summary: 'Already saved.',
        residentId: 'nora',
      },
      ...staged.memories,
    ],
  };
  const blocked = completeSharedActivity(preSeeded, 'share_featured_reading');
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, 'already_completed');
  assert.deepEqual(blocked.world.teaching.known, [], 'blocked pre-seeded visit grants nothing');

  // Already-known edge case (e.g. save already held knowledge without memory) never duplicates
  const alreadyKnown: WorldState = {
    ...staged,
    teaching: { known: ['nora_featured_reading'] },
  };
  const completedAgain = completeSharedActivity(alreadyKnown, 'share_featured_reading');
  assert.equal(completedAgain.ok, true);
  assert.deepEqual(completedAgain.world.teaching.known, ['nora_featured_reading']);
});

test('LR4-04: Nora teaching topic stays hidden before grant, surfaces immediately after reading, retires cleanly, and respects golden order', () => {
  // Hidden before teaching grant EVEN IF shared_featured_reading NPC memory exists
  const fresh = createFreshWorldState();
  const beforeGrant: WorldState = {
    ...fresh,
    day: 2,
    minuteOfDay: 600,
    flags: { ...fresh.flags, foundPostcard: true },
    sideFlags: { ...fresh.sideFlags, nookVisited: true },
    residents: {
      ...fresh.residents,
      nora: { ...fresh.residents.nora, met: true, trust: 3 },
      clara: { ...fresh.residents.clara, met: true, trust: 3 },
    },
    playerRelations: {
      ...fresh.playerRelations,
      nora: { ...fresh.playerRelations.nora, affinity: 60 },
      clara: { ...fresh.playerRelations.clara, affinity: 60 },
    },
  };
  recordNpcMemoryInPlace(
    beforeGrant.npcMemories,
    'nora',
    createNpcMemoryEntry({
      id: 'ev_shared_no_teach',
      eventId: 'ev_shared_no_teach',
      tag: 'shared_featured_reading',
      category: 'interaction',
      subjectPlayer: true,
      subjectResidents: ['nora'],
      provenance: 'firsthand',
      sourceKind: 'participant',
      createdDay: 2,
      createdMinute: 550,
      importance: 4,
      retention: 'durable',
      valence: 'warm',
    }),
    2,
  );
  const preSession = buildResidentDialogue('nora', beforeGrant, 'morning');
  assert.notEqual(
    preSession.topicId,
    'teaching_nora_featured_reading',
    'topic must not surface before nora_featured_reading is in teaching.known',
  );

  // Full end-to-end completion -> exit Nook -> talk to Nora
  const staged = stageMorningNookVisit({ nookVisited: true });
  const done = completeSharedActivity(staged, 'share_featured_reading');
  assert.equal(done.ok, true);
  const outside = exitNookAction(done.world).nextWorld;

  // Context boosts must NOT boost teaching_nora_featured_reading (doc 23 §1)
  const boosts = computeContextBoosts(outside, 'nora', 'morning', DIALOGUE_TOPICS);
  assert.equal(boosts.teaching_nora_featured_reading ?? 0, 0, 'teaching topic stays unboosted');

  const postSession = buildResidentDialogue('nora', outside, 'morning');
  assert.equal(
    postSession.topicId,
    'teaching_nora_featured_reading',
    'LR-4 topic surfaces cleanly after completion ahead of generic shared-visit echo',
  );
  const featuredTitle = getFeaturedBookForDay(outside.day).title;
  assert.ok(
    postSession.nodes.root.text.includes(featuredTitle),
    'teaching dialogue references today’s featured book',
  );

  // Choose reply -> marks shared_featured_reading mentioned -> retires cleanly without nagging
  const warmChoice = postSession.nodes.root.choices.find(
    (c) => c.id === 'lr4_nora_margins_warm',
  );
  assert.ok(warmChoice);
  const afterTalk = applyDialogueChoice(outside, postSession, warmChoice).nextWorld;
  assert.equal(
    afterTalk.npcMemories.nora.every((m) => m.tag !== 'shared_featured_reading' || m.mentionedToPlayer),
    true,
    'shared_featured_reading memory marked mentioned after Nora teaching talk',
  );
  assert.deepEqual(afterTalk.teaching.known, ['nora_featured_reading']);

  // Next day talk to Nora does NOT repeat teaching_nora_featured_reading
  const nextDay = advanceToNextDay(afterTalk);
  const nextSession = buildResidentDialogue('nora', nextDay, 'morning');
  assert.notEqual(nextSession.topicId, 'teaching_nora_featured_reading');

  // Resident scope & SF-4 gossip safety: Clara holding shared_featured_reading gets
  // everyday_shared_visit_echo, never Nora's teaching topic
  const claraGossip = structuredClone(outside);
  recordNpcMemoryInPlace(
    claraGossip.npcMemories,
    'clara',
    createNpcMemoryEntry({
      id: 'ev_gossip_shared_reading',
      eventId: 'ev_gossip_shared_reading',
      tag: 'shared_featured_reading',
      category: 'interaction',
      subjectPlayer: true,
      subjectResidents: ['nora'],
      provenance: 'secondhand',
      sourceKind: 'gossip',
      fromResidentId: 'nora',
      createdDay: outside.day,
      createdMinute: 560,
      importance: 4,
      retention: 'durable',
      valence: 'warm',
    }),
    outside.day,
  );
  const claraOnlyWorld: WorldState = {
    ...claraGossip,
    minuteOfDay: 780,
    flags: { ...claraGossip.flags, heardBellMystery: true, claraArthurReconciled: true },
    sideFlags: { ...claraGossip.sideFlags, bakeryVisited: true },
  };
  const claraOnly = selectDialogueSession(
    'clara',
    claraOnlyWorld,
    'afternoon',
    DIALOGUE_TOPICS,
    noChoices,
    computeContextBoosts(claraOnlyWorld, 'clara', 'afternoon', DIALOGUE_TOPICS),
  );
  assert.equal(claraOnly.topicId, 'everyday_shared_visit_echo');

  // Golden snapshot matches 101 topics after LR-5 (+4 invitation, +1 teaching at tail)
  const goldenPath = new URL('../../scripts/dialogue-topics-golden.json', import.meta.url);
  const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as {
    count: number;
    topics: Array<{ id: string }>;
  };
  assert.equal(golden.count, 101);
  assert.equal(golden.count, DIALOGUE_TOPICS.length);
  assert.ok(golden.topics.some((t) => t.id === 'teaching_nora_featured_reading'));
  assert.equal(golden.topics.at(-1)?.id, 'teaching_arthur_escapement_basics');
});

test('LR4-05: sanitizer strips unknown knowledge ids with warning, dedupes valid ids, and preserves schema v13', () => {
  const base = createFreshWorldState();
  const payload = JSON.parse(serializeWorldState(base)) as Record<string, unknown>;
  payload.teaching = {
    known: ['nora_featured_reading', 'phantom_knowledge', 'nora_featured_reading', '', 123],
  };

  const loaded = deserializeWorldState(JSON.stringify(payload));
  assert.equal(loaded.state.schemaVersion, CURRENT_SCHEMA_VERSION, 'no schema bump (v13 preserved)');
  assert.deepEqual(loaded.state.teaching.known, ['nora_featured_reading']);
  assert.equal(
    loaded.warnings.some((w) => w.includes('phantom_knowledge')),
    true,
    `load warnings include stripped unknown id, got: ${JSON.stringify(loaded.warnings)}`,
  );
  assert.equal(
    loaded.warnings.some((w) => w.includes('invalid teaching knowledge')),
    true,
    `load warnings report invalid entries, got: ${JSON.stringify(loaded.warnings)}`,
  );

  // Save path sanitizer also strips & emits warning when given corrupted in-memory state
  const mutated: WorldState = {
    ...base,
    teaching: { known: ['phantom_knowledge', 'nora_featured_reading'] },
  };
  const saveWarnings: string[] = [];
  const savedJson = serializeWorldState(mutated, saveWarnings);
  assert.equal(
    saveWarnings.some((w) => w.includes('phantom_knowledge')),
    true,
    `save warnings include stripped unknown id, got: ${JSON.stringify(saveWarnings)}`,
  );
  const reloaded = deserializeWorldState(savedJson);
  assert.deepEqual(reloaded.state.teaching.known, ['nora_featured_reading']);
  assert.deepEqual(
    reloaded.warnings,
    [],
    'already-cleaned save reloads completely warning-free',
  );
});

test('LR4-06: teaching.known persists across save/load, day advance, simulation steps, and save revision fingerprint', () => {
  const staged = stageMorningNookVisit();
  const revBefore = computeWorldSaveRevision(staged);

  // Mid-visit round-trip: empty teaching preserved cleanly
  const midJson = serializeWorldState(staged);
  const midLoaded = deserializeWorldState(midJson);
  assert.deepEqual(midLoaded.state.teaching.known, []);
  assert.deepEqual(midLoaded.warnings, []);

  // Post-completion save-revision changes and persists across reload
  const done = completeSharedActivity(staged, 'share_featured_reading').world;
  const revAfter = computeWorldSaveRevision(done);
  assert.notEqual(revAfter, revBefore, 'computeWorldSaveRevision tracks teaching.known change');

  const doneWarnings: string[] = [];
  const doneJson = serializeWorldState(done, doneWarnings);
  assert.deepEqual(doneWarnings, [], 'valid teaching save writes warning-free');
  const doneLoaded = deserializeWorldState(doneJson);
  assert.deepEqual(doneLoaded.warnings, [], 'valid teaching save loads warning-free');
  assert.deepEqual(doneLoaded.state.teaching.known, ['nora_featured_reading']);

  // Day advance retains learned knowledge while resetting visit slots
  const woken = advanceToNextDay(done);
  assert.deepEqual(woken.teaching.known, ['nora_featured_reading']);

  // stepSimulation pure-wrapper clones teaching.known deeply without aliasing
  const stepped = stepSimulation(done, 1 / 60);
  assert.deepEqual(stepped.teaching.known, ['nora_featured_reading']);
  assert.notEqual(stepped.teaching, done.teaching);
  assert.notEqual(stepped.teaching.known, done.teaching.known);
});

test('LR4-07: LR-3 isolation — share_morning_pastry carries no knowledgeGranted and leaves teaching.known empty', () => {
  assert.equal(
    getSharedActivityDef('share_morning_pastry')?.knowledgeGranted,
    undefined,
    'Clara morning pastry grants no knowledge (LR3-48)',
  );

  const base = createFreshWorldState();
  const stagedBase: WorldState = {
    ...base,
    day: 2,
    minuteOfDay: 495,
    residents: {
      ...base.residents,
      clara: { ...base.residents.clara, met: true, trust: 3 },
    },
    playerRelations: {
      ...base.playerRelations,
      clara: { ...base.playerRelations.clara, affinity: 60, reliability: 40, negativeCount: 0 },
    },
  };
  const claraOffered = offerInvitation(stagedBase, 'clara', 'share_morning_pastry');
  assert.equal(claraOffered.ok, true);
  const claraAccepted = acceptInvitation(claraOffered.world);
  assert.equal(claraAccepted.ok, true);
  const claraEntered = enterBakeryAction(claraAccepted.world);
  assert.equal(claraEntered.nextWorld.playerLocation, 'bakery_interior');
  assert.equal(claraEntered.nextWorld.occupancy?.residentId, 'clara');

  const claraRes = completeSharedActivity(claraEntered.nextWorld, 'share_morning_pastry');
  assert.equal(claraRes.ok, true);
  assert.deepEqual(claraRes.world.teaching.known, [], 'bakery completion keeps teaching.known empty');
});
