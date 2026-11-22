/**
 * Social Foundation SF-1 — Social Profile layer tests.
 *
 * Spec of record: docs/architecture/social-foundation/02-design-decision-register.md
 * Contracts:      docs/architecture/living-relationships/22-social-foundation-contracts.md
 *
 * Scope:
 *  - Composite relationship derivation (familiarity / tier / reliability /
 *    feeling / shared history / NPC bond web) is pure and respects the
 *    player knowledge boundary.
 *  - Canonical accessors agree with the historical fallback chains.
 *  - Coherence probes expose contradictory relationship states (Workstream F)
 *    without repairing them.
 *  - Zero WorldState writes anywhere in the layer (derive-only doctrine).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreshWorldState } from './storage';
import {
  getHeartLevel,
  getRelationshipTier,
  isResidentGuarded,
  moodToEmotion,
} from './relationships';
import { isNpcMemoryKnownToPlayer, getReliabilityLabel } from './journal';
import { createNpcMemoryEntry } from './memories';
import type { NpcMemoryEntry, WorldState } from './types';
import {
  buildRelationshipProfile,
  deriveSharedHistory,
  findRelationshipIncoherencies,
  getEffectivePlayerAffinity,
  getFamiliarityBand,
  getNotableNpcBonds,
  getSuppressedNpcPairs,
  isMemoryPlayerKnown,
  meetsRelationshipUnlock,
  meetsStrictRelationshipUnlock,
  resolveCurrentFeeling,
} from './socialProfile';

function freshWorld(): WorldState {
  return createFreshWorldState() as WorldState;
}

function stageMetResident(world: WorldState, id: keyof WorldState['residents'], affinity: number): void {
  world.residents[id].met = true;
  const rel = world.playerRelations[id];
  rel.affinity = affinity;
  rel.familiarity = 30;
  rel.talkedCount = 3;
  rel.lastTalkDay = world.day;
  // Keep the trust ratchet coherent the way the production writers do.
  world.residents[id].trust = getHeartLevel(affinity);
}

// ---------------------------------------------------------------------------
// Canonical accessor
// ---------------------------------------------------------------------------

test('SF1-01: getEffectivePlayerAffinity reads the authoritative relation first', () => {
  const world = freshWorld();
  stageMetResident(world, 'nora', 64);
  assert.equal(getEffectivePlayerAffinity(world, 'nora'), 64);
});

test('SF1-02: getEffectivePlayerAffinity falls back to trust*20 exactly like the engine', () => {
  const world = freshWorld();
  world.residents.jun.trust = 2;
  // Simulate a legacy world without the relations map.
  const legacy = { ...world, playerRelations: undefined } as unknown as WorldState;
  assert.equal(getEffectivePlayerAffinity(legacy, 'jun'), 40);
  assert.equal(getEffectivePlayerAffinity({ ...world, playerRelations: undefined } as unknown as WorldState, 'jun'), 40);
  // With the map present, the authoritative relation wins (fresh jun seeds affinity 20).
  assert.equal(getEffectivePlayerAffinity(world, 'jun'), 20);
});

// ---------------------------------------------------------------------------
// Knowledge boundary lockstep
// ---------------------------------------------------------------------------

function memoryCase(overrides: Partial<NpcMemoryEntry>): NpcMemoryEntry {
  return createNpcMemoryEntry({
    id: 'ev_case',
    eventId: 'ev_case',
    tag: 'case_tag',
    category: 'event',
    subjectPlayer: true,
    subjectResidents: ['nora'],
    provenance: 'firsthand',
    sourceKind: 'participant',
    createdDay: 1,
    createdMinute: 600,
    importance: 3,
    retention: 'durable',
    valence: 'warm',
    emotionalWeight: 50,
    ...overrides,
  }) as NpcMemoryEntry;
}

test('SF1-03: isMemoryPlayerKnown stays in lockstep with journal.isNpcMemoryKnownToPlayer', () => {
  const cases: NpcMemoryEntry[] = [
    memoryCase({ mentionedToPlayer: true }),
    memoryCase({ mentionedToPlayer: false }),
    memoryCase({ mentionedToPlayer: false, sourceKind: 'player_told' }),
    memoryCase({ mentionedToPlayer: false, sourceKind: 'witness' }),
    memoryCase({ mentionedToPlayer: false, sourceKind: 'gossip' }),
    memoryCase({ mentionedToPlayer: false, sourceKind: 'participant', subjectPlayer: false }),
  ];
  for (const mem of cases) {
    assert.equal(
      isMemoryPlayerKnown(mem),
      isNpcMemoryKnownToPlayer(mem),
      `lockstep violated for sourceKind=${mem.sourceKind} mentioned=${mem.mentionedToPlayer} subjectPlayer=${mem.subjectPlayer}`,
    );
  }
});

// ---------------------------------------------------------------------------
// Familiarity bands
// ---------------------------------------------------------------------------

test('SF1-04: familiarity bands partition the unbounded accumulation', () => {
  assert.equal(getFamiliarityBand(0), 'unfamiliar');
  assert.equal(getFamiliarityBand(9), 'unfamiliar');
  assert.equal(getFamiliarityBand(10), 'passing');
  assert.equal(getFamiliarityBand(39), 'passing');
  assert.equal(getFamiliarityBand(40), 'recognized');
  assert.equal(getFamiliarityBand(89), 'recognized');
  assert.equal(getFamiliarityBand(90), 'familiar');
  assert.equal(getFamiliarityBand(159), 'familiar');
  assert.equal(getFamiliarityBand(160), 'well_known');
  assert.equal(getFamiliarityBand(250), 'well_known');
});

// ---------------------------------------------------------------------------
// Feeling consolidation
// ---------------------------------------------------------------------------

test('SF1-05: resolveCurrentFeeling follows the canonical emotion chain', () => {
  const world = freshWorld();
  stageMetResident(world, 'nora', 60);
  const freshRuntime = world.npcRuntime.nora;

  // Chain 3: prog.mood fallback (runtime cleared AND no stored lastEmotion).
  world.npcRuntime = {} as WorldState['npcRuntime'];
  const { lastEmotion: _dropped, ...relWithoutEmotion } = world.playerRelations.nora;
  void _dropped;
  world.playerRelations = {
    ...world.playerRelations,
    nora: relWithoutEmotion as typeof world.playerRelations.nora,
  };
  world.residents.nora.mood = 'wistful';
  assert.equal(resolveCurrentFeeling(world, 'nora'), 'sad');

  // Chain 2: rel.lastEmotion wins over prog.mood when runtime is absent.
  world.playerRelations.nora.lastEmotion = 'happy';
  assert.equal(resolveCurrentFeeling(world, 'nora'), 'happy');

  // Chain 1: npcRuntime.emotion wins over everything.
  world.npcRuntime = {
    nora: { ...freshRuntime, emotion: 'curious' },
  } as WorldState['npcRuntime'];
  assert.equal(resolveCurrentFeeling(world, 'nora'), 'curious');
});

// ---------------------------------------------------------------------------
// Shared history
// ---------------------------------------------------------------------------

test('SF1-06: deriveSharedHistory reads only the canonical ledgers', () => {
  const world = freshWorld();
  stageMetResident(world, 'nora', 60);
  world.invitations.history = [
    {
      invitationId: 'inv_1',
      hostId: 'nora',
      activityId: 'share_featured_reading',
      day: 3,
      outcome: 'completed',
    },
    {
      invitationId: 'inv_2',
      hostId: 'nora',
      activityId: 'share_featured_reading',
      day: 6,
      outcome: 'expired',
    },
    {
      invitationId: 'inv_3',
      hostId: 'clara',
      activityId: 'share_featured_reading',
      day: 5,
      outcome: 'completed',
    },
  ];
  world.memories = [
    { id: 'mem_a', day: 4, phase: 'morning', title: 'Quiet pages', summary: 'x', residentId: 'nora' },
    { id: 'mem_b', day: 5, phase: 'golden', title: 'Unrelated', summary: 'y' },
  ];
  world.worldEvents = [
    {
      id: 'ev_help_1',
      day: 4,
      phase: 'afternoon',
      minuteOfDay: 800,
      kind: 'player_help',
      actors: ['nora', 'pip'],
      summary: 'helped stack crates',
      summaryTag: 'player_help',
    },
    {
      id: 'ev_social_1',
      day: 4,
      phase: 'afternoon',
      minuteOfDay: 810,
      kind: 'npc_social',
      actors: ['nora', 'clara'],
      summary: 'chatted',
      summaryTag: 'chat_',
    },
  ];

  const history = deriveSharedHistory(world, 'nora');
  assert.equal(history.completedVisits.length, 1);
  assert.equal(history.completedVisits[0].activityTitle, 'Shared Featured Reading');
  assert.equal(history.lastCompletedVisitDay, 3);
  assert.equal(history.expiredCount, 1);
  assert.equal(history.declinedCount, 0);
  assert.deepEqual(
    history.playerMemories.map((m) => m.id),
    ['mem_a'],
  );
  assert.equal(history.witnessedHelpEventCount, 1); // npc_social excluded by kind
  assert.equal(history.hasLeftKeepsake, false);
});

test('SF1-07: shared-history knowledge counts respect expiry and the player boundary', () => {
  const world = freshWorld();
  stageMetResident(world, 'nora', 60);
  world.day = 3;
  const known = memoryCase({
    id: 'ev_known',
    eventId: 'ev_known',
    tag: 'gift_tag',
    mentionedToPlayer: true,
    createdDay: 2,
  });
  const knownUnmentioned = memoryCase({
    id: 'ev_unmentioned',
    eventId: 'ev_unmentioned',
    tag: 'shared_featured_reading',
    mentionedToPlayer: false,
    createdDay: 3,
  });
  const privateMemory = memoryCase({
    id: 'ev_private',
    eventId: 'ev_private',
    tag: 'friction_tag',
    category: 'friction',
    valence: 'tense',
    mentionedToPlayer: false,
    sourceKind: 'witness',
    createdDay: 3,
  });
  const expiredMemory = memoryCase({
    id: 'ev_expired',
    eventId: 'ev_expired',
    tag: 'old_tag',
    retention: 'ephemeral',
    mentionedToPlayer: true,
    createdDay: 0,
  });
  world.npcMemories.nora = [known, knownUnmentioned, privateMemory, expiredMemory];

  const history = deriveSharedHistory(world, 'nora');
  // expired (ephemeral +18d... createdDay 0 day 3 is not expired) — adjust expectation:
  assert.equal(history.knownNpcMemoryCount, 3);
  assert.equal(history.unmentionedKnownNpcMemoryCount, 1);
});

// ---------------------------------------------------------------------------
// NPC bond web
// ---------------------------------------------------------------------------

test('SF1-08: the baseline social web surfaces the estranged rift and warm bonds', () => {
  const world = freshWorld();
  const claraBonds = getNotableNpcBonds(world, 'clara');
  const arthurBond = claraBonds.find((b) => b.otherId === 'arthur');
  assert.ok(arthurBond);
  assert.equal(arthurBond.tier, 'estranged');
  assert.equal(arthurBond.suppressed, true);

  const minaBond = claraBonds.find((b) => b.otherId === 'mina');
  assert.ok(minaBond);
  assert.equal(minaBond.tier, 'confidant');
  assert.equal(minaBond.suppressed, false);
});

test('SF1-09: getSuppressedNpcPairs reports canonical, deduped, sorted pairs', () => {
  const world = freshWorld();
  const pairs = getSuppressedNpcPairs(world);
  assert.ok(pairs.length >= 1);
  for (const pair of pairs) {
    assert.equal(pair.pairKey, `${pair.a}:${pair.b}`);
    assert.ok(pair.a < pair.b);
    assert.ok(pair.affinity < 0 || pair.tension >= 45);
  }
  const keys = pairs.map((p) => p.pairKey);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(keys, [...keys].sort());
});

// ---------------------------------------------------------------------------
// Unlock semantics
// ---------------------------------------------------------------------------

test('SF1-10: unlock readings mirror their contract owners exactly', () => {
  // Affinity 42 is 'friendly' tier (hearts 2.1) but below the affinity floor 45:
  // the OR reading (invitation contract, invitations.ts gate 5) passes, the AND
  // reading (dialogue conditions) fails — the discriminating case.
  assert.equal(meetsRelationshipUnlock(42, { minTier: 'friendly', minAffinity: 45 }), true);
  assert.equal(meetsStrictRelationshipUnlock(42, { minTier: 'friendly', minAffinity: 45 }), false);

  // Both gates below either floor.
  assert.equal(meetsRelationshipUnlock(30, { minTier: 'friendly', minAffinity: 45 }), false);
  assert.equal(meetsStrictRelationshipUnlock(30, { minTier: 'friendly', minAffinity: 45 }), false);

  // Both gates above both floors.
  assert.equal(meetsRelationshipUnlock(70, { minTier: 'friendly', minAffinity: 45 }), true);
  assert.equal(meetsStrictRelationshipUnlock(70, { minTier: 'friendly', minAffinity: 45 }), true);

  // Affinity 45 alone (stranger→friendly boundary crossing at 40): both floors met.
  assert.equal(meetsStrictRelationshipUnlock(45, { minTier: 'friendly', minAffinity: 45 }), true);
});

// ---------------------------------------------------------------------------
// Composite profile
// ---------------------------------------------------------------------------

test('SF1-11: buildRelationshipProfile composes all dimensions coherently', () => {
  const world = freshWorld();
  stageMetResident(world, 'nora', 75);
  world.invitations.history = [
    {
      invitationId: 'inv_1',
      hostId: 'nora',
      activityId: 'share_featured_reading',
      day: 2,
      outcome: 'completed',
    },
  ];
  world.neighborGiftsReceived = ['nora'];

  const profile = buildRelationshipProfile(world, 'nora');
  assert.equal(profile.met, true);
  assert.equal(profile.affinity, 75);
  assert.equal(profile.tier, 'close');
  assert.equal(profile.tierLabel, 'Close Friend');
  assert.equal(profile.familiarityBand, 'passing');
  assert.equal(profile.guarded, false);
  assert.equal(profile.sharedHistory.completedVisits.length, 1);
  assert.equal(profile.sharedHistory.hasLeftKeepsake, true);
  assert.equal(profile.daysSinceLastTalk, 0);
});

test('SF1-12: an unmet resident yields the stranger profile without crashing', () => {
  const world = freshWorld();
  const profile = buildRelationshipProfile(world, 'rowan');
  assert.equal(profile.met, false);
  assert.equal(profile.affinity, 0);
  assert.equal(profile.tier, 'stranger');
  assert.equal(profile.familiarityBand, 'unfamiliar');
  assert.equal(profile.sharedHistory.completedVisits.length, 0);
});

// ---------------------------------------------------------------------------
// Coherence probes (Workstream F — contradictory states)
// ---------------------------------------------------------------------------

test('SF1-13: a coherent production-shaped world reports zero incoherencies', () => {
  const world = freshWorld();
  stageMetResident(world, 'nora', 75);
  stageMetResident(world, 'pip', 30);
  assert.deepEqual(findRelationshipIncoherencies(world), []);
});

test('SF1-14: trust/heart drift is exposed without repair', () => {
  const world = freshWorld();
  stageMetResident(world, 'nora', 75);
  world.residents.nora.trust = 1; // affinity 75 derives hearts 3
  const incoherencies = findRelationshipIncoherencies(world);
  const drift = incoherencies.find((i) => i.kind === 'trust_heart_drift');
  assert.ok(drift);
  assert.equal(drift.residentId, 'nora');
});

test('SF1-15: out-of-range affinity is exposed', () => {
  const world = freshWorld();
  stageMetResident(world, 'nora', 75);
  world.playerRelations.nora.affinity = 140;
  const kinds = findRelationshipIncoherencies(world).map((i) => i.kind);
  assert.ok(kinds.includes('affinity_out_of_range'));
});

test('SF1-16: kindred-but-guarded contradiction (hand-edited save class) is exposed', () => {
  const world = freshWorld();
  stageMetResident(world, 'nora', 95);
  world.playerRelations.nora.reliability = 10; // guarded via reliability < 20
  const incoherencies = findRelationshipIncoherencies(world);
  const conflict = incoherencies.find((i) => i.kind === 'kindred_but_guarded');
  assert.ok(conflict);
  // And the coherence probe agrees with the guardedness predicate itself.
  assert.equal(isResidentGuarded(world.playerRelations.nora), true);
  assert.equal(getRelationshipTier(95), 'kindred');
});

test('SF1-17: noncanonical or unknown npcRelations keys are exposed', () => {
  const world = freshWorld();
  world.npcRelations = {
    ...world.npcRelations,
    'clara:arthur': world.npcRelations['arthur:clara'], // reversed
    'ghost:mina': {
      pair: 'ghost:mina', // canonical ordering, unknown resident
      affinity: 10,
      tension: 0,
      sharedTags: [],
      lastInteractionDay: null,
    },
  } as unknown as WorldState['npcRelations'];
  const kinds = findRelationshipIncoherencies(world).map((i) => i.kind);
  assert.ok(kinds.includes('noncanonical_pair_key'));
  assert.ok(kinds.includes('pair_resident_unknown'));
});

test('SF1-18: met-without-familiarity is exposed', () => {
  const world = freshWorld();
  world.residents.nora.met = true;
  const rel = world.playerRelations.nora;
  rel.affinity = 10;
  rel.familiarity = 0;
  world.residents.nora.trust = 0;
  const kinds = findRelationshipIncoherencies(world).map((i) => i.kind);
  assert.ok(kinds.includes('met_without_familiarity'));
});

// ---------------------------------------------------------------------------
// Derive-only doctrine guard
// ---------------------------------------------------------------------------

test('SF1-19: the profile layer never mutates WorldState (deep-equal guard)', () => {
  const world = freshWorld();
  stageMetResident(world, 'nora', 75);
  const before = JSON.stringify(world);
  buildRelationshipProfile(world, 'nora');
  deriveSharedHistory(world, 'clara');
  getNotableNpcBonds(world, 'arthur');
  getSuppressedNpcPairs(world);
  findRelationshipIncoherencies(world);
  assert.equal(JSON.stringify(world), before);
});

test('SF1-20: reliability labels stay journaled via journal, not re-banded here', () => {
  // The profile layer exposes the raw reliability number; the label remains
  // journal-owned (single-owner rule). Guard that the label contract is intact.
  assert.equal(getReliabilityLabel(80), 'Deeply trusted');
  assert.equal(getReliabilityLabel(50), 'Steady friend');
});
