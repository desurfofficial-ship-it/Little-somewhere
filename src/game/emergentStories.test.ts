/**
 * Social Foundation SF-3 — Emergent Stories layer tests.
 *
 * Spec of record: docs/architecture/social-foundation/02-design-decision-register.md
 * Contracts:      docs/architecture/living-relationships/22-social-foundation-contracts.md
 *
 * Scope:
 *  - Every seed archetype triggers from its interconnected signals and is
 *    silent otherwise (boundary cases pinned).
 *  - The knowledge boundary holds: no seed may leak NPC-private memories or
 *    unwitnessed NPC-to-NPC events.
 *  - Determinism, the MAX_SEEDS cap, and derive-only (no WorldState writes).
 *  - The People-card chapter resolves the archetypes in story priority order.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreshWorldState } from './storage';
import { offerInvitation, acceptInvitation } from './invitations';
import { getHeartLevel } from './relationships';
import { createNpcMemoryEntry } from './memories';
import type { NpcMemoryEntry, WorldState } from './types';
import {
  deriveEmergentStorySeeds,
  deriveResidentChapter,
  MAX_SEEDS,
} from './emergentStories';

const ACTIVITY_ID = 'share_featured_reading';
const HOST = 'nora' as const;

function freshWorld(): WorldState {
  return createFreshWorldState() as WorldState;
}

function stageFriendly(world: WorldState, id: keyof WorldState['residents'], affinity = 50): void {
  world.residents[id].met = true;
  const rel = world.playerRelations[id];
  rel.affinity = affinity;
  rel.familiarity = 40;
  rel.talkedCount = 5;
  rel.lastTalkDay = world.day;
  world.residents[id].trust = getHeartLevel(affinity);
}

function stageAcceptedVisit(world: WorldState, minute = 560): void {
  world.day = 4;
  world.minuteOfDay = minute;
  stageFriendly(world, HOST, 60);
  const offer = offerInvitation(world, HOST, ACTIVITY_ID);
  assert.equal(offer.ok, true);
  const accept = acceptInvitation(offer.world);
  assert.equal(accept.ok, true);
  // Replace the caller's world contents with the accepted state.
  Object.assign(world, accept.world);
}

function knownPairMemory(world: WorldState, holder: 'arthur' | 'clara'): void {
  const entry = createNpcMemoryEntry({
    id: 'ev_pair_known',
    eventId: 'ev_pair_known',
    tag: 'lore_rift',
    category: 'town_lore',
    subjectPlayer: false,
    subjectResidents: ['arthur', 'clara'],
    provenance: 'firsthand',
    sourceKind: 'participant',
    createdDay: world.day,
    createdMinute: 600,
    importance: 4,
    retention: 'permanent',
    valence: 'tense',
    emotionalWeight: 60,
  });
  entry.mentionedToPlayer = true;
  world.npcMemories[holder] = [entry as NpcMemoryEntry, ...(world.npcMemories[holder] ?? [])];
}

// ---------------------------------------------------------------------------
// Open visit
// ---------------------------------------------------------------------------

test('SF3-01: an accepted live visit while outdoors yields the gentle open-visit seed', () => {
  const world = freshWorld();
  stageAcceptedVisit(world);
  const seeds = deriveEmergentStorySeeds(world);
  const seed = seeds.find((s) => s.kind === 'open_visit');
  assert.ok(seed);
  assert.equal(seed.residentIds[0], HOST);
  assert.ok(seed.title.includes('Nora'));
  // Zero-FOMO phrasing: no obligation words.
  assert.ok(!/must|need to|before it'?s too late/i.test(seed.summary));
});

test('SF3-02: open-visit seed is silent indoors or after expiry', () => {
  const world = freshWorld();
  stageAcceptedVisit(world);
  world.playerLocation = 'nook_interior';
  assert.equal(
    deriveEmergentStorySeeds(world).some((s) => s.kind === 'open_visit'),
    false,
  );

  const world2 = freshWorld();
  stageAcceptedVisit(world2);
  world2.minuteOfDay = 1250; // past the window
  assert.equal(
    deriveEmergentStorySeeds(world2).some((s) => s.kind === 'open_visit'),
    false,
  );
});

test('SF3-02b: an active invitation with an unknown host degrades silently (corrupted save class)', () => {
  const world = freshWorld();
  world.invitations.active = {
    id: 'inv_corrupt',
    status: 'accepted',
    hostId: 'zorg', // unknown resident id (hand-edited save class)
    activityId: ACTIVITY_ID,
    offeredDay: world.day,
    expiresDay: world.day,
    windowStartMinute: 360,
    windowEndMinute: 1290,
  } as unknown as WorldState['invitations']['active'];
  const seeds = deriveEmergentStorySeeds(world);
  assert.equal(seeds.some((s) => s.kind === 'open_visit'), false);
});

// ---------------------------------------------------------------------------
// Rift bridging — the knowledge-boundary headline case
// ---------------------------------------------------------------------------

test('SF3-03: the bridging seed appears only when the player knows the tie and both sides', () => {
  const world = freshWorld();
  stageFriendly(world, 'arthur', 50);
  stageFriendly(world, 'clara', 50);
  // Fresh world carries the suppressed arthur:clara baseline, but the player
  // has neither the bell discovery nor a known memory of the pair.
  assert.equal(
    deriveEmergentStorySeeds(world).some((s) => s.kind === 'rift_bridging'),
    false,
  );

  // Discovery through the canonical journal gate.
  world.flags.heardBellMystery = true;
  const seeds = deriveEmergentStorySeeds(world);
  const seed = seeds.find((s) => s.kind === 'rift_bridging');
  assert.ok(seed);
  assert.deepEqual([...seed.residentIds].sort(), ['arthur', 'clara']);
});

test('SF3-04: a player-known memory naming both residents also opens the bridging seed', () => {
  const world = freshWorld();
  stageFriendly(world, 'arthur', 50);
  stageFriendly(world, 'clara', 50);
  knownPairMemory(world, 'clara');
  assert.ok(deriveEmergentStorySeeds(world).some((s) => s.kind === 'rift_bridging'));
});

test('SF3-05: the bridging seed stays silent when the player only knows one side', () => {
  const world = freshWorld();
  world.flags.heardBellMystery = true;
  stageFriendly(world, 'clara', 50);
  // arthur still stranger.
  assert.equal(
    deriveEmergentStorySeeds(world).some((s) => s.kind === 'rift_bridging'),
    false,
  );
});

// ---------------------------------------------------------------------------
// Shared tradition
// ---------------------------------------------------------------------------

test('SF3-06: two completed visits form a tradition; one does not', () => {
  const world = freshWorld();
  stageFriendly(world, HOST, 60);
  world.invitations.history = [
    {
      invitationId: 'inv_1',
      hostId: HOST,
      activityId: ACTIVITY_ID,
      day: 2,
      outcome: 'completed',
    },
  ];
  assert.equal(
    deriveEmergentStorySeeds(world).some((s) => s.kind === 'shared_tradition'),
    false,
  );

  world.invitations.history.push({
    invitationId: 'inv_2',
    hostId: HOST,
    activityId: ACTIVITY_ID,
    day: 5,
    outcome: 'completed',
  });
  const seed = deriveEmergentStorySeeds(world).find((s) => s.kind === 'shared_tradition');
  assert.ok(seed);
  assert.equal(seed.evidenceCount, 2);
  assert.ok(seed.summary.includes('2 visits'));
  assert.ok(seed.summary.includes('day 5'));
});

// ---------------------------------------------------------------------------
// Quiet feeling
// ---------------------------------------------------------------------------

test('SF3-07: the quiet-feeling seed reflects observable feeling of the closest low resident', () => {
  const world = freshWorld();
  stageFriendly(world, 'pip', 30);
  stageFriendly(world, 'nora', 60);
  world.residents.pip.mood = 'wistful';
  world.residents.nora.mood = 'joyful';
  const seeds = deriveEmergentStorySeeds(world);
  const seed = seeds.find((s) => s.kind === 'quiet_feeling');
  assert.ok(seed);
  assert.equal(seed.residentIds[0], 'pip'); // only low resident wins
});

test('SF3-08: unmet residents never yield a quiet-feeling seed (fresh arthur/clara are wistful)', () => {
  const world = freshWorld();
  // Fresh clara and arthur start wistful but are unmet.
  assert.equal(
    deriveEmergentStorySeeds(world).some((s) => s.kind === 'quiet_feeling'),
    false,
  );
});

// ---------------------------------------------------------------------------
// Thank-you / first steps / community pulse
// ---------------------------------------------------------------------------

test('SF3-09: an unacknowledged keepsake yields one thank-you seed', () => {
  const world = freshWorld();
  stageFriendly(world, 'pip', 30);
  world.neighborGiftsReceived = ['pip'];
  const seed = deriveEmergentStorySeeds(world).find((s) => s.kind === 'thank_you_owed');
  assert.ok(seed);
  assert.equal(seed.residentIds[0], 'pip');

  // Already acknowledged in kind → silent.
  world.playerRelations.pip.giftsGiven = 1;
  assert.equal(
    deriveEmergentStorySeeds(world).some((s) => s.kind === 'thank_you_owed'),
    false,
  );
});

test('SF3-10: a met-but-barely-known resident yields the first-steps seed', () => {
  const world = freshWorld();
  world.residents.rowan.met = true;
  world.residents.rowan.trust = 1;
  world.playerRelations.rowan.affinity = 20;
  world.playerRelations.rowan.talkedCount = 1;
  const seed = deriveEmergentStorySeeds(world).find((s) => s.kind === 'first_steps');
  assert.ok(seed);
  assert.equal(seed.residentIds[0], 'rowan');

  world.playerRelations.rowan.talkedCount = 4;
  assert.equal(
    deriveEmergentStorySeeds(world).some((s) => s.kind === 'first_steps'),
    false,
  );
});

test('SF3-11: the community pulse crosses its threshold only through shared doings', () => {
  const world = freshWorld();
  assert.equal(
    deriveEmergentStorySeeds(world).some((s) => s.kind === 'community_pulse'),
    false,
  );
  world.nookState.booksRead = 4;
  world.greenhouseState.totalHarvests = 3;
  world.copperwheelState.projectsAdmired = 2;
  const seed = deriveEmergentStorySeeds(world).find((s) => s.kind === 'community_pulse');
  assert.ok(seed);
  assert.equal(seed.evidenceCount, 10); // 4 + 3 + 2 + 0 loaves + 1 starter memory
});

// ---------------------------------------------------------------------------
// Cap, ordering, determinism, derive-only
// ---------------------------------------------------------------------------

test('SF3-12: seeds are capped, priority-ordered and deterministic', () => {
  const world = freshWorld();
  stageAcceptedVisit(world); // open_visit 80
  world.flags.heardBellMystery = true;
  stageFriendly(world, 'arthur', 50);
  stageFriendly(world, 'clara', 50); // rift_bridging 70
  stageFriendly(world, 'sora', 30);
  world.residents.sora.mood = 'wistful'; // quiet_feeling 50 (sora over nora: both? nora is accepted-visit host, joyful default)
  world.invitations.history = [
    { invitationId: 'i1', hostId: HOST, activityId: ACTIVITY_ID, day: 2, outcome: 'completed' },
    { invitationId: 'i2', hostId: HOST, activityId: ACTIVITY_ID, day: 5, outcome: 'completed' },
  ]; // shared_tradition 60

  const seeds = deriveEmergentStorySeeds(world);
  assert.ok(seeds.length <= MAX_SEEDS);
  for (let i = 1; i < seeds.length; i += 1) {
    assert.ok(seeds[i - 1].priority >= seeds[i].priority);
  }
  const again = deriveEmergentStorySeeds(world);
  assert.equal(JSON.stringify(seeds), JSON.stringify(again));
});

test('SF3-13: the derivation layer never mutates WorldState', () => {
  const world = freshWorld();
  stageAcceptedVisit(world);
  const before = JSON.stringify(world);
  deriveEmergentStorySeeds(world);
  deriveResidentChapter(world, HOST);
  assert.equal(JSON.stringify(world), before);
});

// ---------------------------------------------------------------------------
// Resident chapters (People cards)
// ---------------------------------------------------------------------------

test('SF3-14: chapters resolve in story priority order and stay silent for unmet residents', () => {
  const world = freshWorld();
  assert.equal(deriveResidentChapter(world, 'clara'), undefined); // unmet

  stageFriendly(world, 'nora', 60);
  assert.equal(
    deriveResidentChapter(world, 'nora'),
    undefined,
  ); // talked 5, nothing else lived yet

  // Bridging beats everything for a rift side.
  world.flags.heardBellMystery = true;
  stageFriendly(world, 'arthur', 50);
  stageFriendly(world, 'clara', 50);
  const claraChapter = deriveResidentChapter(world, 'clara');
  assert.ok(claraChapter);
  assert.ok(claraChapter.includes('both sides of the quiet rift'));
});

test('SF3-15: tradition and keepsake chapters read truthfully from the ledgers', () => {
  const world = freshWorld();
  stageFriendly(world, HOST, 60);
  world.invitations.history = [
    { invitationId: 'i1', hostId: HOST, activityId: ACTIVITY_ID, day: 2, outcome: 'completed' },
    { invitationId: 'i2', hostId: HOST, activityId: ACTIVITY_ID, day: 5, outcome: 'completed' },
  ];
  const chapter = deriveResidentChapter(world, HOST);
  assert.ok(chapter);
  assert.ok(chapter.includes('2 quiet visits'));

  // Keepsake chapter when no tradition exists.
  const world2 = freshWorld();
  stageFriendly(world2, 'pip', 30);
  world2.playerRelations.pip.talkedCount = 5;
  world2.neighborGiftsReceived = ['pip'];
  assert.equal(
    deriveResidentChapter(world2, 'pip'),
    'Pip once left you a keepsake — a kind word is still owed.',
  );
});

test('SF3-16: the early-acquaintance chapter is the final fallback', () => {
  const world = freshWorld();
  world.residents.rowan.met = true;
  world.residents.rowan.trust = 1;
  world.playerRelations.rowan.affinity = 20;
  world.playerRelations.rowan.talkedCount = 1;
  const chapter = deriveResidentChapter(world, 'rowan');
  assert.ok(chapter);
  assert.ok(chapter.toLowerCase().includes('face becoming a name'));
});
