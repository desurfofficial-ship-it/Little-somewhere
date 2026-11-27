/**
 * Social Foundation SF-4 — Dialogue Context Assembly tests.
 *
 * Spec of record: docs/architecture/social-foundation/02-design-decision-register.md
 * Contracts:      docs/architecture/living-relationships/22-social-foundation-contracts.md
 *
 * Scope:
 *  - Boost-free parity: the engine's legacy ordering is byte-identical when
 *    boosts are absent (all shipped tests keep running boost-free).
 *  - Band protection: boosts (≤ 5 < min category gap 6) can reorder within a
 *    category band but can NEVER smuggle a topic across bands.
 *  - R1 shared-experience echo and R2 reunion warmth are evidence-bound to
 *    the speaker's own memories (anti-omniscience).
 *  - `requiresWitnessedEvent` is the knowledge-scoped event predicate.
 *  - The echo topic is registry-registered and golden-pinned (BD10-style
 *    anti-fraud backstop, additive).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFreshWorldState } from './storage';
import { DIALOGUE_TOPICS } from './dialogue';
import { selectDialogueSession } from './dialogueEngine';
import { buildResidentDialogue } from './narrative';
import { offerInvitation, acceptInvitation } from './invitations';
import { createNpcMemoryEntry } from './memories';
import type { DialogueTopic, NpcMemoryEntry, WorldState } from './types';
import {
  buildDialogueContext,
  computeContextBoosts,
  describeDialogueContext,
  MAX_CONTEXT_BOOST,
} from './dialogueContext';

const noChoices = () => ({ choices: [], extraNodes: {} });

function freshWorld(): WorldState {
  return createFreshWorldState() as WorldState;
}

function makeTopic(
  id: string,
  category: DialogueTopic['category'],
  priority: number,
  condition?: DialogueTopic['condition'],
): DialogueTopic {
  return {
    id,
    residentId: 'any',
    category,
    priority,
    condition,
    build: () => ({
      rootId: 'root',
      nodes: {
        root: {
          id: 'root',
          speakerName: 'T',
          speakerRole: 'r',
          moodLabel: 'm',
          text: `text:${id}`,
          choices: [],
        },
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// Boost-free parity
// ---------------------------------------------------------------------------

test('SF4-01: boost-free selection is byte-identical to the legacy 5-arg call', () => {
  const world = freshWorld();
  world.day = 4;
  world.minuteOfDay = 560;
  world.residents.nora.met = true;
  world.playerRelations.nora.affinity = 65;

  const legacy = selectDialogueSession('nora', world, 'morning', DIALOGUE_TOPICS, noChoices);
  const withEmpty = selectDialogueSession('nora', world, 'morning', DIALOGUE_TOPICS, noChoices, {});
  assert.equal(JSON.stringify(legacy), JSON.stringify(withEmpty));

  const boosts = computeContextBoosts(world, 'nora', 'morning', DIALOGUE_TOPICS);
  const withBoosts = selectDialogueSession('nora', world, 'morning', DIALOGUE_TOPICS, noChoices, boosts);
  assert.equal(JSON.stringify(legacy), JSON.stringify(withBoosts));
});

test('SF4-02: a fresh (all-unmet) world produces zero boosts', () => {
  const world = freshWorld();
  assert.deepEqual(computeContextBoosts(world, 'nora', 'morning', DIALOGUE_TOPICS), {});
});

// ---------------------------------------------------------------------------
// Band protection — the critical engine-semantics guard
// ---------------------------------------------------------------------------

test('SF4-03: a boosted daily_slice topic can never leapfrog a quest_milestone band', () => {
  const world = freshWorld();
  world.residents.nora.met = true;
  world.playerRelations.nora.affinity = 60;
  world.residents.nora.mood = 'wistful'; // quiet-feeling signal (unused here; boosts stay bounded)

  const quest = makeTopic('q_test', 'quest_milestone', 0);
  const dailyLow = makeTopic('d_low', 'daily_slice', 0);
  const dailyHigh = makeTopic('d_high', 'daily_slice', 0);

  const topics = [quest, dailyLow, dailyHigh];
  // d_high boosted to the band maximum — still far below the quest band.
  const boosts = { d_high: MAX_CONTEXT_BOOST };

  const session = selectDialogueSession('nora', world, 'morning', topics, noChoices, boosts);
  assert.equal(session.topicId, 'q_test'); // quest band always wins

  const noQuest = selectDialogueSession('nora', world, 'morning', [dailyLow, dailyHigh], noChoices, boosts);
  assert.equal(noQuest.topicId, 'd_high'); // within-band reordering works
});

test('SF4-03b: the ENGINE clamps hostile boost inputs — band protection is an invariant', () => {
  const world = freshWorld();
  world.residents.nora.met = true;
  world.playerRelations.nora.affinity = 60;

  const quest = makeTopic('q_test', 'quest_milestone', 0);
  const daily = makeTopic('d_hostile', 'daily_slice', 0);

  // Hostile producer input (QA finding F1): the engine clamps ±5, so the
  // daily topic can never cross into the quest band regardless of caller.
  const session = selectDialogueSession('nora', world, 'morning', [quest, daily], noChoices, {
    d_hostile: 10000,
    q_test: -10000,
  });
  assert.equal(session.topicId, 'q_test');
});

test('SF4-04: boosts are clamped to MAX_CONTEXT_BOOST', () => {
  const world = freshWorld();
  world.residents.nora.met = true;
  world.playerRelations.nora.affinity = 60;
  for (const [, value] of Object.entries(
    computeContextBoosts(world, 'nora', 'morning', DIALOGUE_TOPICS),
  )) {
    assert.ok(value >= 0 && value <= MAX_CONTEXT_BOOST);
  }
});

// ---------------------------------------------------------------------------
// R1 — shared-experience echo (memory-bound)
// ---------------------------------------------------------------------------

test('SF4-05: R1 echo boost fires only from the speaker\'s own unmentioned shared memory', () => {
  const world = freshWorld();
  world.day = 5;
  world.minuteOfDay = 560;
  world.residents.nora.met = true;
  world.playerRelations.nora.affinity = 60;

  const echoTopic = makeTopic('echo_probe', 'event_reaction', 0, {
    requiresNpcMemory: { tags: ['shared_featured_reading'], unmentionedOnly: true, maxDaysOld: 6 },
  });

  // No memory → no boost.
  assert.deepEqual(computeContextBoosts(world, 'nora', 'morning', [echoTopic]), {});

  const entry = createNpcMemoryEntry({
    id: 'ev_shared_test',
    eventId: 'ev_shared_test',
    tag: 'shared_featured_reading',
    category: 'interaction',
    subjectPlayer: true,
    subjectResidents: ['nora'],
    provenance: 'firsthand',
    sourceKind: 'participant',
    createdDay: 3,
    createdMinute: 600,
    importance: 4,
    retention: 'durable',
    valence: 'warm',
    emotionalWeight: 80,
    detail: { placeName: 'Linden Book Nook' },
  }) as NpcMemoryEntry;
  world.npcMemories.nora = [entry];

  const boosts = computeContextBoosts(world, 'nora', 'morning', [echoTopic]);
  assert.equal(boosts.echo_probe, MAX_CONTEXT_BOOST);

  // Once mentioned, the echo boost retires (no nagging).
  entry.mentionedToPlayer = true;
  assert.deepEqual(computeContextBoosts(world, 'nora', 'morning', [echoTopic]), {});
});

test('SF4-06: the real echo topic outranks the gift topic only when both memories exist', () => {
  const world = freshWorld();
  world.day = 5;
  world.minuteOfDay = 560;
  world.residents.nora.met = true;
  world.playerRelations.nora.affinity = 60;

  const shared = createNpcMemoryEntry({
    id: 'ev_shared_test',
    eventId: 'ev_shared_test',
    tag: 'shared_featured_reading',
    category: 'interaction',
    subjectPlayer: true,
    subjectResidents: ['nora'],
    provenance: 'firsthand',
    sourceKind: 'participant',
    createdDay: 3,
    createdMinute: 600,
    importance: 4,
    retention: 'durable',
    valence: 'warm',
    emotionalWeight: 80,
  }) as NpcMemoryEntry;
  const gift = createNpcMemoryEntry({
    id: 'ev_gift_test',
    eventId: 'ev_gift_test',
    tag: 'player_gift',
    category: 'interaction',
    subjectPlayer: true,
    subjectResidents: ['nora'],
    provenance: 'firsthand',
    sourceKind: 'participant',
    createdDay: 5,
    createdMinute: 500,
    importance: 3,
    retention: 'durable',
    valence: 'warm',
    emotionalWeight: 70,
  }) as NpcMemoryEntry;
  world.npcMemories.nora = [shared, gift];

  // Both REAL event-reaction topics, REAL conditions, REAL boosts: with the
  // shared memory alone the echo fires; with a fresher gift memory too, the
  // boosted echo (14+5=19) still outranks event_gift_thanks (18).
  const pair = DIALOGUE_TOPICS.filter(
    (t) => t.id === 'everyday_shared_visit_echo' || t.id === 'event_gift_thanks',
  );
  assert.equal(pair.length, 2);
  const boosts = computeContextBoosts(world, 'nora', 'morning', pair);
  const session = selectDialogueSession('nora', world, 'morning', pair, noChoices, boosts);
  assert.equal(session.topicId, 'everyday_shared_visit_echo');
  assert.ok(session.surfacedMemoryEventIds?.some((s) => s.eventId === 'ev_shared_test'));

  // Boost-free, the authored gift priority (18) beats the echo (14) — the
  // boost is what carries the lived experience.
  const giftOnly = selectDialogueSession('nora', world, 'morning', pair, noChoices);
  assert.equal(giftOnly.topicId, 'event_gift_thanks');
});

test('SF4-07: the echo topic is registered at the tail and golden-pinned (anti-fraud backstop)', () => {
  const t = DIALOGUE_TOPICS.find((x) => x.id === 'everyday_shared_visit_echo');
  assert.ok(t);
  assert.equal(t.residentId, 'any');
  assert.equal(t.category, 'event_reaction');
  assert.equal(t.priority, 14);
  assert.deepEqual(t.condition, {
    requiresNpcMemory: {
      tags: ['shared_featured_reading'],
      unmentionedOnly: true,
      maxDaysOld: 6,
    },
    notSeenToday: true,
  });

  const goldenPath = new URL('../../scripts/dialogue-topics-golden.json', import.meta.url);
  const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as {
    count: number;
    topics: Array<{ id: string }>;
  };
  assert.equal(golden.count, golden.topics.length);
  assert.equal(golden.count, DIALOGUE_TOPICS.length);
  assert.ok(golden.topics.some((g) => g.id === 'everyday_shared_visit_echo'));
  // Append-only ordering contract milestone pin: the registry tail is the
  // most recently appended module's last topic. SF-4 owned the tail at
  // `everyday_shared_visit_echo`; the Community Projects social-afterlife
  // module (COMMUNITY_ECHO_TOPICS, feat/community-social-consequences)
  // appended three topics strictly after REFLECTION_TOPICS, so the pin
  // migrated to `everyday_community_project_pride`. The Stage 3 Continuation
  // Photography workstream (PHOTO_ECHO_TOPICS) appends two more event_reaction
  // echoes strictly after the community echoes, so the pin migrates again to
  // `everyday_photo_noticer`. The existence check above still pins the SF-4
  // topic itself; only the tail pin moves. Each future append must similarly
  // migrate this assertion, never reorder.
  assert.equal(golden.topics.at(-1)!.id, 'everyday_garden_noticer');
});

// ---------------------------------------------------------------------------
// R2 — reunion warmth
// ---------------------------------------------------------------------------

test('SF4-08: R2 reunion boost rises within the relationship_tier band after quiet days', () => {
  const world = freshWorld();
  world.day = 10;
  world.residents.nora.met = true;
  world.playerRelations.nora.affinity = 65;
  world.playerRelations.nora.lastTalkDay = 6; // 4 quiet days

  const tierA = makeTopic('tier_a', 'relationship_tier', 10, { minTier: 'friendly' });
  const tierB = makeTopic('tier_b', 'relationship_tier', 10, { minTier: 'friendly' });
  const boosts = computeContextBoosts(world, 'nora', 'morning', [tierA, tierB]);
  // Neither targets an unmentioned shared tag; the reunion path alone yields
  // no boost (R2 is exercised through the production registry where tier-band
  // warmups exist; the crafted pair proves the no-boost baseline).

  // Give A the echo tag too: combined clamping keeps it at the max.
  const echoTagged = makeTopic('tier_echo', 'relationship_tier', 10, {
    requiresNpcMemory: { tags: ['shared_featured_reading'], unmentionedOnly: true, maxDaysOld: 6 },
  });
  world.npcMemories.nora = [
    createNpcMemoryEntry({
      id: 'ev_shared_test',
      eventId: 'ev_shared_test',
      tag: 'shared_featured_reading',
      category: 'interaction',
      subjectPlayer: true,
      subjectResidents: ['nora'],
      provenance: 'firsthand',
      sourceKind: 'participant',
      createdDay: 9,
      createdMinute: 600,
      importance: 4,
      retention: 'durable',
      valence: 'warm',
      emotionalWeight: 80,
    }) as NpcMemoryEntry,
  ];
  const boosts2 = computeContextBoosts(world, 'nora', 'morning', [tierA, tierB, echoTagged]);
  // R2 applies a uniform REUNION_BOOST across the whole tier band (it helps
  // tier topics clear small history penalties after a quiet spell) while the
  // echo-tagged topic reaches the clamp maximum.
  assert.equal(boosts2.tier_a, 3);
  assert.equal(boosts2.tier_b, 3);
  assert.equal(boosts2.tier_echo, MAX_CONTEXT_BOOST);
  void boosts;

  const session = selectDialogueSession('nora', world, 'morning', [tierA, tierB, echoTagged], noChoices, boosts2);
  assert.equal(session.topicId, 'tier_echo');
});

// ---------------------------------------------------------------------------
// requiresWitnessedEvent — the knowledge-scoped event predicate
// ---------------------------------------------------------------------------

test('SF4-09: requiresWitnessedEvent demands actor membership AND a bound memory', () => {
  const world = freshWorld();
  world.day = 5;
  world.residents.nora.met = true;

  const event = {
    id: 'ev_help_test',
    day: 5,
    phase: 'afternoon' as const,
    minuteOfDay: 800,
    kind: 'player_help' as const,
    actors: ['nora' as const, 'pip' as const],
    summary: 'helped stack crates',
    summaryTag: 'player_help',
  };
  world.worldEvents = [event];

  const cond = { requiresWitnessedEvent: { kinds: ['player_help' as const], maxDaysAgo: 3 } };

  // No memory → silent (actor alone is not enough).
  const probe = makeTopic('w_probe', 'event_reaction', 0, cond);
  const sessionNone = selectDialogueSession('nora', world, 'afternoon', [probe], noChoices, {});
  assert.equal(sessionNone.topicId, 'nora_fallback');

  // Bound memory for a NON-actor (clara) still fails for clara.
  const claraMemory = createNpcMemoryEntry({
    id: 'mem_clara_help',
    eventId: 'ev_help_test',
    tag: 'player_help_observed',
    category: 'event',
    subjectPlayer: true,
    subjectResidents: ['nora'],
    provenance: 'secondhand',
    sourceKind: 'witness',
    createdDay: 5,
    createdMinute: 810,
    importance: 3,
    retention: 'durable',
    valence: 'warm',
    emotionalWeight: 50,
  }) as NpcMemoryEntry;
  world.npcMemories.clara = [claraMemory];
  const sessionClara = selectDialogueSession('clara', world, 'afternoon', [probe], noChoices, {});
  assert.equal(sessionClara.topicId, 'clara_fallback'); // clara is not in actors

  // Actor + memory → the resident may bring it up.
  world.npcMemories.nora = [
    createNpcMemoryEntry({
      id: 'mem_nora_help',
      eventId: 'ev_help_test',
      tag: 'player_help_observed',
      category: 'event',
      subjectPlayer: true,
      subjectResidents: ['nora'],
      provenance: 'firsthand',
      sourceKind: 'participant',
      createdDay: 5,
      createdMinute: 800,
      importance: 3,
      retention: 'durable',
      valence: 'warm',
      emotionalWeight: 55,
    }) as NpcMemoryEntry,
  ];
  const sessionNora = selectDialogueSession('nora', world, 'afternoon', [probe], noChoices, {});
  assert.equal(sessionNora.topicId, 'w_probe');

  // Kind filter mismatch → silent even for the actor.
  const wrongKind = makeTopic('w_wrong', 'event_reaction', 0, {
    requiresWitnessedEvent: { kinds: ['bell_ring'], maxDaysAgo: 3 },
  });
  const sessionWrong = selectDialogueSession('nora', world, 'afternoon', [wrongKind], noChoices, {});
  assert.equal(sessionWrong.topicId, 'nora_fallback');
});

// ---------------------------------------------------------------------------
// Snapshot + description
// ---------------------------------------------------------------------------

test('SF4-10: buildDialogueContext captures the actionable conversation state', () => {
  const world = freshWorld();
  world.day = 4;
  world.minuteOfDay = 560;
  world.residents.nora.met = true;
  world.playerRelations.nora.affinity = 65;
  world.playerRelations.nora.lastTalkDay = 1;

  const ctx = buildDialogueContext(world, 'nora', 'morning');
  assert.equal(ctx.met, true);
  assert.equal(ctx.tier, 'friendly');
  assert.equal(ctx.daysSinceLastTalk, 3);
  assert.equal(ctx.pendingLiveVisit, false);
  assert.equal(ctx.daysSinceSharedVisit, null);
  assert.deepEqual(ctx.unmentionedSharedTags, []);
  assert.equal(ctx.companionsToday.length, 0);
  assert.equal(ctx.openFriction, false);

  const line = describeDialogueContext(ctx);
  assert.ok(line.includes('Nora'));
  assert.ok(line.includes('Friend'));
  assert.ok(line.includes('last talked 3d ago'));
});

test('SF4-11: context detects a pending live visit and today\'s company', () => {
  const world = freshWorld();
  world.day = 4;
  world.minuteOfDay = 560;
  world.residents.nora.met = true;
  world.playerRelations.nora.affinity = 65;
  world.playerRelations.nora.reliability = 40;

  const offer = offerInvitation(world, 'nora', 'share_featured_reading');
  assert.equal(offer.ok, true);
  const accept = acceptInvitation(offer.world);
  Object.assign(world, accept.world);

  const ctx = buildDialogueContext(world, 'nora', 'morning');
  assert.equal(ctx.pendingLiveVisit, true);
  const line = describeDialogueContext(ctx);
  assert.ok(line.includes('visit pending'));

  world.worldEvents = [
    {
      id: 'ev_chat_1',
      day: 4,
      phase: 'morning',
      minuteOfDay: 500,
      kind: 'npc_social',
      actors: ['nora', 'clara'],
      summary: 'chatted about lavender',
      summaryTag: 'chat_lavender',
    },
  ];
  const ctx2 = buildDialogueContext(world, 'nora', 'morning');
  assert.deepEqual(ctx2.companionsToday, ['clara']);
});
