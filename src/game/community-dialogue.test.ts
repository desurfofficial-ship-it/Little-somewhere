/**
 * SC-A — Community Projects social dialogue acceptance tests.
 *
 * Spec of record: feat/community-social-consequences workstream SC-A
 * (Community Social Narrative Engineer). Verifies that the three
 * `COMMUNITY_ECHO_TOPICS` (src/game/dialogue/everyday/communityEcho.ts)
 * surface the GA-1 contribution reducer's witness/participant memory writes
 * as everyday conversational afterlife — stage-aware, knowledge-scoped, and
 * honor the append-only registry contract.
 *
 * Worlds are staged from createFreshWorldState() and reducers never mutate
 * their input world (house style; mirrors community.test.ts and
 * dialogue.test.ts).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { applyDialogueChoice } from './actions';
import { buildResidentDialogue } from './narrative';
import { contributeToCommunityProject } from './community';
import { createFreshWorldState } from './storage';
import { DIALOGUE_TOPICS } from './dialogue';
import { PersonalItemId, ResidentId, TimePhase, WorldState } from './types';

// ---------------------------------------------------------------------------
// Staged-world helpers (house style: built up from createFreshWorldState)
// ---------------------------------------------------------------------------

/**
 * Suppresses all quest_milestone intro topics (quest_pip_intro, quest_nora_*
 * etc.) so they don't outrank the event_reaction echo family. Mirrors the
 * flag set used by the dialogue.test.ts sample world.
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

function withSatchel(
  world: WorldState,
  items: Partial<Record<PersonalItemId, number>>,
): WorldState {
  return { ...world, inventory: { ...world.inventory, ...items } };
}

function withWitnessNearby(world: WorldState, id: ResidentId, distance = 1.2): WorldState {
  return {
    ...world,
    npcRuntime: {
      ...world.npcRuntime,
      [id]: {
        ...world.npcRuntime[id],
        position: { x: world.playerPos.x + distance, z: world.playerPos.z },
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

const COMMUNITY_ECHO_TOPIC_IDS = [
  'everyday_community_basket_echo',
  'everyday_community_completion_celebration',
  'everyday_community_project_pride',
] as const;

function isCommunityEchoTopic(topicId: string | undefined): boolean {
  return !!topicId && (COMMUNITY_ECHO_TOPIC_IDS as readonly string[]).includes(topicId);
}

// ---------------------------------------------------------------------------
// SC-A-01: Stage 1 — basket echo fires for a witness neighbor
// ---------------------------------------------------------------------------

test('SC-A-01: a witness neighbor echoes the in-progress contribution via shared_community memory', () => {
  let world = withIntroFlagsSuppressed(createFreshWorldState());
  world = withSatchel(world, { meadow_posy: 2 });
  world = withWitnessNearby(world, 'pip');
  world = withMet(world, 'pip');
  assert.equal(world.npcMemories.pip.length, 0, 'fresh Pip holds no memories');

  const res = contributeToCommunityProject(world, 'marigold_garland', 'meadow_posy', 1);
  assert.equal(res.ok, true);
  assert.equal(res.completedNow, false, 'project still in progress');

  // Pip (within LOCAL_WITNESS_RADIUS) holds an unmentioned shared_community
  // witness memory → the basket echo fires (priority 14 + SF-4 R1 boost 5 = 19,
  // decisively above the daily_slice band and unboosted gift_thanks 18).
  const session = buildResidentDialogue('pip', res.world, 'afternoon' as TimePhase);
  assert.equal(session.topicId, 'everyday_community_basket_echo');

  // Build text reflects the venue the witness memory carries.
  const rootText = session.nodes[session.currentNodeId].text;
  assert.ok(rootText.includes('Marigold Garland') || rootText.includes('Village Plaza'),
    `basket echo text references the project/venue; got: "${rootText}"`);
  assert.ok(rootText.includes('saw you'),
    `witness voice distinguishes from the participant voice; got: "${rootText}"`);

  // Input world not mutated by the pure dialogue read.
  assert.equal(world.npcMemories.pip.length, 0, 'input world not mutated by buildResidentDialogue');
});

// ---------------------------------------------------------------------------
// SC-A-02: Stage 2 — completion celebration fires for a thanksFrom neighbor
// ---------------------------------------------------------------------------

test('SC-A-02: a thanksFrom neighbor celebrates the completed project via the participant memory + completion event', () => {
  // orchard_lanterns one honey short of done: crabapple goal met (4/4),
  // wild_honey at 1/2, one honey in the satchel, Pip staged within
  // LOCAL_WITNESS_RADIUS. The next wild_honey contribution completes.
  let world = withIntroFlagsSuppressed(createFreshWorldState());
  world = withSatchel(world, { wild_honey: 1 });
  world = withWitnessNearby(world, 'pip');
  world = withMet(world, 'rowan');
  world = withMet(world, 'jun');
  world = withMet(world, 'pip');
  world = {
    ...world,
    communityProjects: {
      ...world.communityProjects,
      orchard_lanterns: { contributed: { crabapple: 4, wild_honey: 1 }, completedDay: 0 },
    },
  };

  const res = contributeToCommunityProject(world, 'orchard_lanterns', 'wild_honey', 1);
  assert.equal(res.ok, true);
  assert.equal(res.completedNow, true, 'project completed');

  // Rowan (thanksFrom) holds a participant memory bound to the completion
  // event → the completion celebration fires (priority 20 + SF-4 R1 boost 5 =
  // 25). This outranks the basket echo (19) when both memory kinds coexist,
  // and outranks the personal_story orchard arc (84) which is protected from
  // boosts.
  const session = buildResidentDialogue('rowan', res.world, 'afternoon' as TimePhase);
  assert.equal(session.topicId, 'everyday_community_completion_celebration');

  const rootText = session.nodes[session.currentNodeId].text;
  assert.ok(rootText.includes('Orchard Lantern') || rootText.includes('Fern Hollow'),
    `completion text references the project/venue; got: "${rootText}"`);
  assert.ok(rootText.includes('finished'),
    `participant voice marks completion; got: "${rootText}"`);
});

// ---------------------------------------------------------------------------
// SC-A-03: Omniscience guard — a far-away neighbor gets NO community echo
// ---------------------------------------------------------------------------

test('SC-A-03: a neighbor beyond LOCAL_WITNESS_RADIUS never echoes a community moment they never witnessed', () => {
  let world = withIntroFlagsSuppressed(createFreshWorldState());
  world = withSatchel(world, { meadow_posy: 2 });
  world = withWitnessNearby(world, 'pip');
  world = withFarAway(world, 'mina');
  world = withMet(world, 'pip');
  world = withMet(world, 'mina');

  const res = contributeToCommunityProject(world, 'marigold_garland', 'meadow_posy', 1);
  assert.equal(res.ok, true);

  // Mina (far beyond LOCAL_WITNESS_RADIUS) holds no shared_community memory
  // and is not in the completion event's actors list (project not complete).
  // None of the three echo topics may fire for her.
  const minaSession = buildResidentDialogue('mina', res.world, 'afternoon' as TimePhase);
  assert.equal(
    isCommunityEchoTopic(minaSession.topicId),
    false,
    `Mina (far away) must not echo a community moment she never witnessed; got topicId="${minaSession.topicId}"`,
  );

  // Pip (the witness) still gets the basket echo — the guard is per-speaker,
  // not a global suppression.
  const pipSession = buildResidentDialogue('pip', res.world, 'afternoon' as TimePhase);
  assert.equal(pipSession.topicId, 'everyday_community_basket_echo');
});

// ---------------------------------------------------------------------------
// SC-A-04: The basket echo's choice marks the shared_community memory mentioned
// ---------------------------------------------------------------------------

test('SC-A-04: applying the basket echo choice retires the shared_community witness memory', () => {
  let world = withIntroFlagsSuppressed(createFreshWorldState());
  world = withSatchel(world, { meadow_posy: 2 });
  world = withWitnessNearby(world, 'pip');
  world = withMet(world, 'pip');

  const res = contributeToCommunityProject(world, 'marigold_garland', 'meadow_posy', 1);
  assert.equal(res.ok, true);

  const witnessMem = res.world.npcMemories.pip.find((m) => m.tag === 'shared_community');
  assert.ok(witnessMem, 'Pip holds the witness memory');
  assert.equal(witnessMem!.mentionedToPlayer, false, 'memory starts unmentioned');

  const session = buildResidentDialogue('pip', res.world, 'afternoon' as TimePhase);
  assert.equal(session.topicId, 'everyday_community_basket_echo');

  const choice = session.nodes[session.currentNodeId].choices.find(
    (c) => c.id === 'ev_community_basket_warm',
  );
  assert.ok(choice, 'basket echo exposes the warm choice');
  assert.deepEqual(choice!.markMemoryTagsMentioned, ['shared_community'],
    'choice carries the belt-and-suspenders tag-flip side-effect');

  const after = applyDialogueChoice(res.world, session, choice!).nextWorld;
  const afterMem = after.npcMemories.pip.find((m) => m.tag === 'shared_community');
  assert.equal(afterMem!.mentionedToPlayer, true,
    'applying the choice flipped the witness memory to mentioned');

  // The basket echo no longer fires for Pip on a second conversation (memory
  // now mentioned → unmentionedOnly fails). This proves the mention-flip
  // actually retires the topic, not just decorates the choice.
  const session2 = buildResidentDialogue('pip', after, 'afternoon' as TimePhase);
  assert.notEqual(session2.topicId, 'everyday_community_basket_echo',
    'basket echo does not re-fire once the witness memory is mentioned');
});

// ---------------------------------------------------------------------------
// SC-A-05: Stage 2 broader — project pride fires on the second conversation
// ---------------------------------------------------------------------------

test('SC-A-05: project pride fires on the second conversation after the immediate echo retires', () => {
  // Complete orchard_lanterns with Pip staged as the witness. Pip holds a
  // witness memory (eventId = per-contribution witness event, NOT the
  // completion event). After Topic 1 fires and marks the memory mentioned,
  // Topic 1 fails on the next conversation and Topic 3 (priority 10, no
  // memory gate) takes over — Pip is still in the completion event's actors
  // list, so requiresRecentEventTag's D2 knowledge gate passes.
  let world = withIntroFlagsSuppressed(createFreshWorldState());
  world = withSatchel(world, { wild_honey: 1 });
  world = withWitnessNearby(world, 'pip');
  world = withMet(world, 'pip');
  world = {
    ...world,
    communityProjects: {
      ...world.communityProjects,
      orchard_lanterns: { contributed: { crabapple: 4, wild_honey: 1 }, completedDay: 0 },
    },
  };

  const res = contributeToCommunityProject(world, 'orchard_lanterns', 'wild_honey', 1);
  assert.equal(res.completedNow, true);

  // Conversation 1: the immediate basket echo wins (priority 19 with boost).
  const session1 = buildResidentDialogue('pip', res.world, 'afternoon' as TimePhase);
  assert.equal(session1.topicId, 'everyday_community_basket_echo',
    'conversation 1: basket echo fires for the witness');

  const choice1 = session1.nodes[session1.currentNodeId].choices.find(
    (c) => c.id === 'ev_community_basket_warm',
  )!;
  const after1 = applyDialogueChoice(res.world, session1, choice1).nextWorld;

  // Conversation 2 (same day): Topic 1 fails (memory mentioned + notSeenToday).
  // Topic 2 fails (Pip is not thanksFrom — no participant memory bound to the
  // completion event). Topic 3 fires: requiresRecentEventTag's D2 gate passes
  // (Pip is in the completion event's actors list), priority 10 is unboosted
  // but sits above the daily_slice band.
  const session2 = buildResidentDialogue('pip', after1, 'afternoon' as TimePhase);
  assert.equal(session2.topicId, 'everyday_community_project_pride',
    `conversation 2: project pride fires after the immediate echo retires; got="${session2.topicId}"`);

  // Project pride intentionally does NOT carry markMemoryTagsMentioned — it
  // does not claim the speaker witnessed the contribution, so it must not
  // retire a witness memory another neighbor could still surface.
  const prideChoice = session2.nodes[session2.currentNodeId].choices[0];
  assert.equal(prideChoice.markMemoryTagsMentioned, undefined,
    'project pride does not flip the shared_community memory (no witness claim)');
});

// ---------------------------------------------------------------------------
// SC-A-06: Registry contract — 3 community echo topics contiguous (no longer
// the tail: the 2 PHOTO_ECHO_TOPICS from photoEcho.ts now follow them, per
// the Stage 3 Continuation Photography workstream).
// ---------------------------------------------------------------------------

test('SC-A-06: COMMUNITY_ECHO_TOPICS are contiguous, photo echoes follow at the tail, golden matches', () => {
  // The three community echo topics exist in DIALOGUE_TOPICS.
  for (const id of COMMUNITY_ECHO_TOPIC_IDS) {
    const t = DIALOGUE_TOPICS.find((x) => x.id === id);
    assert.ok(t, `${id} registered in DIALOGUE_TOPICS`);
    assert.equal(t!.residentId, 'any', `${id} is resident-agnostic ('any')`);
    assert.equal(t!.category, 'event_reaction', `${id} sits in the event_reaction band`);
  }

  // Contiguity: the three community echo topics occupy three consecutive
  // indices in the registry (in authored order). The PHOTO_ECHO_TOPICS module
  // (Stage 3 Continuation, Workstream B) now appends two more event_reaction
  // echoes strictly after, so the community echoes are no longer the literal
  // tail — but they remain contiguous.
  const indices = COMMUNITY_ECHO_TOPIC_IDS.map((id) =>
    DIALOGUE_TOPICS.findIndex((t) => t.id === id),
  );
  assert.ok(indices.every((i) => i >= 0), 'every community echo topic is registered');
  assert.ok(indices[0] >= 3, 'community echoes appear after the early quest/personal bands');
  assert.equal(indices[1], indices[0] + 1, 'community echoes are contiguous (1→2)');
  assert.equal(indices[2], indices[1] + 1, 'community echoes are contiguous (2→3)');

  const goldenPath = new URL('../../scripts/dialogue-topics-golden.json', import.meta.url);
  const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as {
    count: number;
    topics: Array<{ id: string; residentId: string; category: string; priority: number }>;
  };
  assert.equal(golden.count, golden.topics.length, 'golden internally consistent');
  assert.equal(golden.count, DIALOGUE_TOPICS.length,
    `golden count matches registry: golden=${golden.count} registry=${DIALOGUE_TOPICS.length}`);
  // Append-only ordering contract milestone pin migrated: the registry tail is
  // now `teaching_nora_featured_reading` (the TEACHING_TOPICS module's LR-4
  // topic), appended strictly after PHOTO_ECHO_TOPICS. Both community echoes
  // and photo echoes remain field-for-field pinned below. Each future append
  // must similarly migrate this assertion, never reorder.
  assert.equal(golden.topics.at(-1)!.id, 'teaching_nora_featured_reading',
    'golden tail is the LR-4 teaching topic (milestone pin migrated from everyday_photo_noticer)');

  // Field-for-field pin on the three community echo topics (anti-fraud backstop).
  for (const expected of [
    { id: 'everyday_community_basket_echo', residentId: 'any', category: 'event_reaction', priority: 14 },
    { id: 'everyday_community_completion_celebration', residentId: 'any', category: 'event_reaction', priority: 20 },
    { id: 'everyday_community_project_pride', residentId: 'any', category: 'event_reaction', priority: 10 },
  ]) {
    const g = golden.topics.find((t) => t.id === expected.id);
    assert.ok(g, `${expected.id} present in golden`);
    assert.equal(g!.residentId, expected.residentId);
    assert.equal(g!.category, expected.category);
    assert.equal(g!.priority, expected.priority);
  }

  // Field-for-field pin on the two PHOTO_ECHO_TOPICS (Stage 3 Continuation,
  // Workstream B — appended strictly after the community echoes).
  for (const expected of [
    { id: 'everyday_photo_witness_echo', residentId: 'any', category: 'event_reaction', priority: 12 },
    { id: 'everyday_photo_noticer', residentId: 'any', category: 'event_reaction', priority: 8 },
  ]) {
    const g = golden.topics.find((t) => t.id === expected.id);
    assert.ok(g, `${expected.id} present in golden (Stage 3 Cont. photo echo)`);
    assert.equal(g!.residentId, expected.residentId);
    assert.equal(g!.category, expected.category);
    assert.equal(g!.priority, expected.priority);
  }
});

// ---------------------------------------------------------------------------
// SC-A-07: Topic 2 beats Topic 1 for a thanksFrom neighbor who is ALSO a witness
// ---------------------------------------------------------------------------

test('SC-A-07: when a thanksFrom neighbor also witnessed the contribution, completion celebration wins over the basket echo', () => {
  // orchard_lanterns: thanksFrom = ['rowan', 'jun']. Stage Rowan WITHIN
  // LOCAL_WITNESS_RADIUS during the contribution → Rowan holds BOTH a witness
  // memory (per-contribution, sourceKind='witness') AND a participant memory
  // (completion burst, sourceKind='participant'). Both Topic 1 and Topic 2
  // conditions pass; Topic 2 (priority 20 + boost 5 = 25) must win over
  // Topic 1 (priority 14 + boost 5 = 19). Completion is the bigger moment;
  // precedence follows.
  let world = withIntroFlagsSuppressed(createFreshWorldState());
  world = withSatchel(world, { wild_honey: 1 });
  world = withWitnessNearby(world, 'rowan');
  world = withMet(world, 'rowan');
  world = withMet(world, 'jun');
  world = {
    ...world,
    communityProjects: {
      ...world.communityProjects,
      orchard_lanterns: { contributed: { crabapple: 4, wild_honey: 1 }, completedDay: 0 },
    },
  };

  const res = contributeToCommunityProject(world, 'orchard_lanterns', 'wild_honey', 1);
  assert.equal(res.completedNow, true);

  // Rowan holds both memory kinds.
  const rowanMems = res.world.npcMemories.rowan.filter((m) => m.tag === 'shared_community');
  assert.equal(rowanMems.length, 2, 'Rowan holds both witness + participant memories');
  assert.ok(rowanMems.some((m) => m.sourceKind === 'witness'));
  assert.ok(rowanMems.some((m) => m.sourceKind === 'participant'));

  const session = buildResidentDialogue('rowan', res.world, 'afternoon' as TimePhase);
  assert.equal(session.topicId, 'everyday_community_completion_celebration',
    `completion celebration wins over basket echo when both memories coexist; got="${session.topicId}"`);

  // Build text uses the participant voice (not the witness voice).
  const rootText = session.nodes[session.currentNodeId].text;
  assert.ok(rootText.includes('finished'),
    `participant voice marks completion; got: "${rootText}"`);
  assert.ok(!rootText.includes('saw you'),
    `participant voice does not claim the witness moment; got: "${rootText}"`);
});

// ---------------------------------------------------------------------------
// SC-A-08: Tag verification — community.ts writes 'shared_community', not 'n'
// ---------------------------------------------------------------------------

test('SC-A-08: community.ts writes the shared_community tag (not the audit-claimed "n") to NPC memories', () => {
  // The SC-A audit brief flagged a suspected bug: community.ts comments
  // reference `shared_community` but the audit claimed the actual `tag:`
  // value written was `'n'`. This test pins the truth: the reducer writes
  // the literal string 'shared_community' on BOTH witness and participant
  // memories. dialogueContext.collectUnmentionedSharedTags keys off the
  // `shared_` prefix; a tag of 'n' would never surface in conversation.
  let world = withIntroFlagsSuppressed(createFreshWorldState());
  world = withSatchel(world, { meadow_posy: 2 });
  world = withWitnessNearby(world, 'pip');

  // Partial contribution (witness memory only).
  const partial = contributeToCommunityProject(world, 'marigold_garland', 'meadow_posy', 1);
  const witnessMem = partial.world.npcMemories.pip.find(
    (m) => m.eventId.startsWith('community_marigold_garland_d'),
  );
  assert.ok(witnessMem, 'witness memory recorded');
  assert.equal(witnessMem!.tag, 'shared_community',
    `witness memory tag is the literal 'shared_community' (not 'n')`);
  assert.equal(witnessMem!.sourceKind, 'witness');

  // Completion burst (participant memory).
  let world2 = withIntroFlagsSuppressed(createFreshWorldState());
  world2 = withSatchel(world2, { wild_honey: 1 });
  world2 = withWitnessNearby(world2, 'pip');
  world2 = {
    ...world2,
    communityProjects: {
      ...world2.communityProjects,
      orchard_lanterns: { contributed: { crabapple: 4, wild_honey: 1 }, completedDay: 0 },
    },
  };
  const completed = contributeToCommunityProject(world2, 'orchard_lanterns', 'wild_honey', 1);
  const participantMem = completed.world.npcMemories.rowan.find(
    (m) => m.eventId === `community_orchard_lanterns_complete_d${world2.day}`,
  );
  assert.ok(participantMem, 'participant memory recorded for thanksFrom Rowan');
  assert.equal(participantMem!.tag, 'shared_community',
    `participant memory tag is the literal 'shared_community' (not 'n')`);
  assert.equal(participantMem!.sourceKind, 'participant');

  // The completion event's summaryTag uses the documented prefix.
  const completionEvent = completed.world.worldEvents.find(
    (e) => e.summaryTag === 'community_orchard_lanterns_complete',
  );
  assert.ok(completionEvent, 'completion event recorded');
  assert.equal(completionEvent!.kind, 'player_help');
});
