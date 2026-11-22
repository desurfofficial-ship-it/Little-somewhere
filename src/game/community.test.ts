/**
 * Everyday Gameplay GA-1 — Community Projects acceptance tests (Workstream E).
 *
 * Spec of record: docs/architecture/everyday-gameplay/00-improvement-plan.md §GA-1.
 * Covers the transactional contribution reducer `contributeToCommunityProject`
 * (refusal identity discipline, goal clamping, witness NPC memories, completion
 * burst, cap-exempt gratitude), the save-integrity sanitizer, view models /
 * noticeboard prose, and persistence of the slice through the day roll.
 *
 * Mirrors the LR-2 shared-activity test discipline (activities.test.ts): worlds
 * are staged from createFreshWorldState() and reducers must never mutate their
 * input world.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { advanceToNextDay, createFreshWorldState } from './storage';
import {
  COMMUNITY_REASON_LABELS,
  MAX_CONTRIBUTED_PER_ITEM,
  areCommunityGoalsMet,
  contributeToCommunityProject,
  countCommunityContributions,
  describeCommunityNoticeboard,
  getCommunityProjectDef,
  getCommunityProjectProgress,
  getCommunityProjectView,
  isCommunityProjectComplete,
  sanitizeCommunityProjectsState,
  CommunityProjectDef,
} from './community';
import { getItemCount } from './inventory';
import { PersonalItemId, ResidentId, WorldState } from './types';

// ---------------------------------------------------------------------------
// Staged-world helpers (house style: built up from createFreshWorldState)
// ---------------------------------------------------------------------------

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

/**
 * Orchard Lantern Preparations one honey short of done: crabapple goal met (4/4),
 * wild_honey at 1/2, one honey in the satchel, Pip staged within
 * LOCAL_WITNESS_RADIUS of the player. The next wild_honey contribution is the
 * goal-meeting transaction.
 */
function stageNearlyCompleteOrchard(): { world: WorldState; def: CommunityProjectDef } {
  const def = getCommunityProjectDef('orchard_lanterns');
  assert.ok(def, 'orchard_lanterns def exists in COMMUNITY_PROJECTS');
  let world = createFreshWorldState();
  world = withSatchel(world, { wild_honey: 1 });
  world = withWitnessNearby(world, 'pip');
  world = {
    ...world,
    communityProjects: {
      ...world.communityProjects,
      orchard_lanterns: { contributed: { crabapple: 4, wild_honey: 1 }, completedDay: 0 },
    },
  };
  return { world, def: def! };
}

// ---------------------------------------------------------------------------
// Refusal paths — identity-equality discipline, no toast, no slice writes
// ---------------------------------------------------------------------------

test('CP-01: unknown project refusal returns ok:false with the SAME world reference', () => {
  const world = createFreshWorldState();
  const res = contributeToCommunityProject(world, 'mystery_shelf', 'meadow_posy', 1);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'unknown_project');
  assert.equal(res.toast, undefined, 'refusals carry no toast — App renders COMMUNITY_REASON_LABELS');
  assert.equal(res.world, world, 'refusal returns the input world reference unchanged');
  assert.ok(COMMUNITY_REASON_LABELS.unknown_project.length > 0, 'reason has player-legible prose');
  assert.deepEqual(world.communityProjects, {}, 'no slice written');
});

test('CP-02: valid item refused by a project that does not accept it', () => {
  const world = withSatchel(createFreshWorldState(), { heron_feather: 2 });
  const res = contributeToCommunityProject(world, 'marigold_garland', 'heron_feather', 1);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'item_not_accepted');
  assert.equal(res.toast, undefined);
  assert.equal(res.world, world, 'identity preserved on refusal');
  assert.equal(res.world.inventory.heron_feather, 2, 'satchel untouched');
});

test('CP-03: item absent from the satchel refuses with nothing_to_contribute', () => {
  const world = createFreshWorldState();
  assert.equal(getItemCount(world.inventory, 'meadow_posy'), 0, 'precondition: posy not owned');
  const res = contributeToCommunityProject(world, 'marigold_garland', 'meadow_posy', 1);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'nothing_to_contribute');
  assert.equal(res.toast, undefined);
  assert.equal(res.world, world, 'identity preserved on refusal');
  assert.equal(getCommunityProjectProgress(res.world, 'marigold_garland').completedDay, 0);
});

// ---------------------------------------------------------------------------
// Happy paths — consumption, clamping, witness memories
// ---------------------------------------------------------------------------

test('CP-04: happy path — satchel decremented, contribution recorded, world advanced', () => {
  const world = withSatchel(createFreshWorldState(), { meadow_posy: 3 });
  const res = contributeToCommunityProject(world, 'marigold_garland', 'meadow_posy', 1);
  assert.equal(res.ok, true);
  assert.equal(res.completedNow, false, 'one bloom does not finish the garland');
  assert.equal(res.memoryUnlockedTitle, undefined, 'no journal unlock mid-project');
  assert.notEqual(res.world, world, 'success returns an advanced world');
  assert.equal(res.world.inventory.meadow_posy, 2, 'exactly one item consumed');
  const progress = getCommunityProjectProgress(res.world, 'marigold_garland');
  assert.equal(progress.contributed.meadow_posy, 1);
  assert.equal(progress.completedDay, 0);
  assert.equal(countCommunityContributions(res.world), 1);
  assert.match(res.toast ?? '', /Meadow Posy/);
  assert.match(res.toast ?? '', /1\/3/);
  // Input world untouched (pure functional style)
  assert.equal(world.inventory.meadow_posy, 3);
  assert.deepEqual(world.communityProjects, {});
});

test('CP-05: over-contribution clamps to the goal (5 offered when 2 remain)', () => {
  let world = withSatchel(createFreshWorldState(), { meadow_posy: 8 });
  const first = contributeToCommunityProject(world, 'marigold_garland', 'meadow_posy', 1);
  assert.equal(first.ok, true);
  world = first.world;

  const second = contributeToCommunityProject(world, 'marigold_garland', 'meadow_posy', 5);
  assert.equal(second.ok, true);
  assert.equal(second.completedNow, false, 'posy goal met, but other garland goals stay open');
  const progress = getCommunityProjectProgress(second.world, 'marigold_garland');
  assert.equal(progress.contributed.meadow_posy, 3, 'contributed clamped to goal');
  assert.equal(progress.completedDay, 0);
  assert.equal(
    second.world.inventory.meadow_posy,
    5,
    'exactly 2 consumed (8 − 1 − 2), not the offered 5',
  );
  assert.match(second.toast ?? '', /3\/3/);
});

test('CP-06: nearby witness records a firsthand shared_community memory; distant neighbors do not', () => {
  let world = withSatchel(createFreshWorldState(), { meadow_posy: 2 });
  world = withWitnessNearby(world, 'pip');
  world = withFarAway(world, 'mina');
  assert.equal(world.npcMemories.pip.length, 0, 'fresh Pip holds no memories');

  const res = contributeToCommunityProject(world, 'marigold_garland', 'meadow_posy', 1);
  assert.equal(res.ok, true);

  const expectedEventId = `community_marigold_garland_d${world.day}_m${Math.round(world.minuteOfDay)}`;
  const pipMemory = res.world.npcMemories.pip.find((m) => m.tag === 'shared_community');
  assert.ok(pipMemory, 'Pip (within LOCAL_WITNESS_RADIUS) witnessed the contribution');
  assert.equal(pipMemory.eventId, expectedEventId);
  assert.equal(pipMemory.sourceKind, 'witness');
  assert.equal(pipMemory.provenance, 'firsthand');
  assert.equal(pipMemory.subjectPlayer, true);
  assert.ok(pipMemory.subjectResidents.includes('pip'));
  assert.equal(pipMemory.retention, 'durable');
  assert.equal(pipMemory.valence, 'warm');
  assert.equal(pipMemory.detail?.placeName, 'Village Plaza');
  assert.equal(
    (pipMemory.detail as Record<string, unknown>).projectId,
    'marigold_garland',
    'projectId rides in the memory detail for dialogue consumers',
  );

  assert.equal(
    res.world.npcMemories.mina.some((m) => m.eventId === expectedEventId),
    false,
    'Mina far beyond LOCAL_WITNESS_RADIUS holds no witness memory',
  );
  assert.equal(world.npcMemories.pip.length, 0, 'input world not mutated');
});

// ---------------------------------------------------------------------------
// Completion burst
// ---------------------------------------------------------------------------

test('CP-07: completion burst — journal memory, player_help event, thanksFrom memories, gratitude, sideFlag', () => {
  const { world, def } = stageNearlyCompleteOrchard();
  const rowanBefore = world.playerRelations.rowan;
  const junBefore = world.playerRelations.jun;
  const memoriesBefore = world.memories.length;

  const res = contributeToCommunityProject(world, 'orchard_lanterns', 'wild_honey', 1);
  assert.equal(res.ok, true);
  assert.equal(res.completedNow, true);
  assert.equal(res.memoryUnlockedTitle, def.memoryTitle);
  assert.match(res.toast ?? '', /finished together/);

  // Slice state: final goal met, completedDay stamped with the current day
  const progress = getCommunityProjectProgress(res.world, 'orchard_lanterns');
  assert.equal(progress.completedDay, world.day);
  assert.equal(progress.contributed.wild_honey, 2);
  assert.equal(progress.contributed.crabapple, 4);

  // Journal memory (prepended, spec-authored id/title/summary)
  assert.equal(res.world.memories.length, memoriesBefore + 1);
  assert.equal(res.world.memories[0].id, def.memoryId);
  assert.equal(res.world.memories[0].title, def.memoryTitle);
  assert.equal(res.world.memories[0].summary, def.memorySummary);
  assert.equal(res.world.memories[0].day, world.day);

  // Single player_help world event with the complete tag and deduped actors
  const event = res.world.worldEvents.find(
    (e) => e.summaryTag === 'community_orchard_lanterns_complete',
  );
  assert.ok(event, 'completion world event recorded');
  assert.equal(event.kind, 'player_help');
  assert.equal(event.id, `community_orchard_lanterns_complete_d${world.day}`);
  assert.equal(event.day, world.day);
  assert.equal(new Set(event.actors).size, event.actors.length, 'actors are unique');
  for (const actor of ['pip', 'rowan', 'jun'] as ResidentId[]) {
    assert.ok(event.actors.includes(actor), `actor ${actor} present (witnesses + thanksFrom)`);
  }

  // thanksFrom neighbors hold firsthand participant memories; Pip holds the witness memory
  for (const rid of def.thanksFrom) {
    const mem = res.world.npcMemories[rid].find(
      (m) => m.id === `community_orchard_lanterns_complete_d${world.day}`,
    );
    assert.ok(mem, `${rid} holds the completion memory`);
    assert.equal(mem.tag, 'shared_community');
    assert.equal(mem.sourceKind, 'participant');
    assert.equal(mem.importance, 4);
    assert.equal(mem.subjectPlayer, true);
  }
  assert.ok(
    res.world.npcMemories.pip.some(
      (m) => m.tag === 'shared_community' && m.sourceKind === 'witness',
    ),
  );

  // Gratitude: +4 affinity / +1 reliability per thanker (fresh baselines)
  assert.equal(res.world.playerRelations.rowan.affinity, rowanBefore.affinity + 4);
  assert.equal(res.world.playerRelations.rowan.reliability, (rowanBefore.reliability ?? 25) + 1);
  assert.equal(res.world.playerRelations.jun.affinity, junBefore.affinity + 4);
  assert.equal(res.world.playerRelations.jun.reliability, (junBefore.reliability ?? 25) + 1);

  // Permanent visible town reward flag (World team consumes)
  assert.equal(res.world.sideFlags[def.worldFlag], true);
});

test('CP-08: completed project refuses further contributions and returns the same world', () => {
  const { world } = stageNearlyCompleteOrchard();
  const done = contributeToCommunityProject(world, 'orchard_lanterns', 'wild_honey', 1);
  assert.equal(done.ok, true);
  assert.equal(done.completedNow, true);

  const retryWorld = withSatchel(done.world, { crabapple: 3 });
  const res = contributeToCommunityProject(retryWorld, 'orchard_lanterns', 'crabapple', 1);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'project_completed');
  assert.equal(res.toast, undefined);
  assert.equal(res.world, retryWorld, 'idempotent refusal returns the world reference unchanged');
  assert.equal(res.world.sideFlags.communityOrchardLanternsComplete, true, 'reward flag intact');
  assert.equal(
    res.world.worldEvents.filter((e) => e.summaryTag === 'community_orchard_lanterns_complete')
      .length,
    1,
    'no duplicate completion event',
  );
});

test('CP-09: goals-met never persists silently — the goal-meeting transaction completes the shelf', () => {
  const { world } = stageNearlyCompleteOrchard();
  assert.equal(areCommunityGoalsMet(world, 'orchard_lanterns'), false, 'one honey short of full');

  const res = contributeToCommunityProject(world, 'orchard_lanterns', 'wild_honey', 1);
  assert.equal(res.ok, true);
  assert.equal(areCommunityGoalsMet(res.world, 'orchard_lanterns'), true);
  assert.equal(
    isCommunityProjectComplete(res.world, 'orchard_lanterns'),
    true,
    'completed in the SAME transaction that met the final goal — no silent open state',
  );
});

// ---------------------------------------------------------------------------
// Save integrity, view models, persistence
// ---------------------------------------------------------------------------

test('CP-10: sanitizeCommunityProjectsState — garbage resets, unknown ids/items drop, counts floored and clamped', () => {
  // Garbage payload resets with a warning
  const garbageWarnings: string[] = [];
  assert.deepEqual(sanitizeCommunityProjectsState('not-a-shelf' as unknown, garbageWarnings), {});
  assert.ok(
    garbageWarnings.some((w) => w.includes('communityProjects reset')),
    'malformed payload warns',
  );
  const nullWarnings: string[] = [];
  assert.deepEqual(sanitizeCommunityProjectsState(null, nullWarnings), {});
  assert.equal(nullWarnings.length, 0, 'absent slice is silent');

  // Unknown project id dropped with a warning
  const unknownWarnings: string[] = [];
  const dropped = sanitizeCommunityProjectsState(
    { mystery_shelf: { contributed: { meadow_posy: 2 }, completedDay: 0 } } as unknown,
    unknownWarnings,
  );
  assert.deepEqual(dropped, {});
  assert.ok(
    unknownWarnings.some((w) => w.includes('dropped unknown project id: mystery_shelf')),
  );

  // Non-accepted item id dropped with a warning; accepted item kept
  const foreignWarnings: string[] = [];
  const kept = sanitizeCommunityProjectsState(
    {
      marigold_garland: { contributed: { heron_feather: 2, meadow_posy: 2 }, completedDay: 0 },
    } as unknown,
    foreignWarnings,
  );
  assert.deepEqual(kept.marigold_garland.contributed, { meadow_posy: 2 });
  assert.ok(
    foreignWarnings.some((w) => w.includes('dropped non-accepted item heron_feather')),
  );

  // Counts floored, clamped at MAX_CONTRIBUTED_PER_ITEM, dishonest values dropped
  const countsWarnings: string[] = [];
  const clamped = sanitizeCommunityProjectsState(
    {
      orchard_lanterns: {
        contributed: { crabapple: 2.9, wild_honey: 99 },
        completedDay: 3.7,
      },
    } as unknown,
    countsWarnings,
  );
  assert.deepEqual(clamped.orchard_lanterns.contributed, {
    crabapple: 2,
    wild_honey: MAX_CONTRIBUTED_PER_ITEM,
  });
  assert.equal(clamped.orchard_lanterns.completedDay, 3, 'completedDay floored');

  const honestWarnings: string[] = [];
  const honest = sanitizeCommunityProjectsState(
    {
      marigold_garland: {
        contributed: { meadow_posy: 2.5, chamomile_blossom: Number.NaN, lavender_sprig: -3 },
        completedDay: 0,
      },
    } as unknown,
    honestWarnings,
  );
  assert.deepEqual(honest.marigold_garland.contributed, { meadow_posy: 2 }, 'NaN/negative dropped');
});

test('CP-11: getCommunityProjectView math — contributed caps at goal, met flags, totals', () => {
  const world = createFreshWorldState();
  const fresh = getCommunityProjectView(world, 'pond_mosaic');
  assert.ok(fresh);
  assert.equal(fresh.totalContributed, 0);
  assert.equal(fresh.totalGoal, 6);
  assert.equal(fresh.completed, false);
  assert.equal(fresh.completedDay, 0);
  assert.ok(fresh.items.every((i) => !i.met));

  const staged: WorldState = {
    ...world,
    communityProjects: {
      pond_mosaic: {
        contributed: { smooth_river_glass: 99, pressed_fern: 1 },
        completedDay: 0,
      },
    },
  };
  const view = getCommunityProjectView(staged, 'pond_mosaic');
  assert.ok(view);
  const glass = view.items.find((i) => i.itemId === 'smooth_river_glass');
  assert.ok(glass);
  assert.equal(glass.contributed, 2, 'contributed caps at authored goal');
  assert.equal(glass.met, true);
  const fern = view.items.find((i) => i.itemId === 'pressed_fern');
  assert.ok(fern);
  assert.equal(fern.contributed, 1);
  assert.equal(fern.met, false);
  assert.equal(view.totalContributed, 3);
  assert.equal(view.totalGoal, 6);
  assert.equal(view.completed, false);

  const done = getCommunityProjectView(
    { ...world, communityProjects: { pond_mosaic: { contributed: {}, completedDay: 4 } } },
    'pond_mosaic',
  );
  assert.ok(done);
  assert.equal(done.completed, true);
  assert.equal(done.completedDay, 4);
  assert.equal(getCommunityProjectView(world, 'nope'), null, 'unknown project id → null');
});

test('CP-12: describeCommunityNoticeboard — open shelves show progress, finished shelves celebrate', () => {
  const world: WorldState = {
    ...createFreshWorldState(),
    communityProjects: {
      orchard_lanterns: { contributed: { crabapple: 2 }, completedDay: 0 },
      marigold_garland: { contributed: {}, completedDay: 2 },
    },
  };
  const lines = describeCommunityNoticeboard(world);
  assert.equal(lines.length, 3, 'one line per authored project');

  const marigold = lines.find((l) => l.includes('Marigold Garland'));
  assert.ok(marigold);
  assert.ok(marigold.includes('finished, and beautiful!'));

  const orchard = lines.find((l) => l.includes('Orchard Lantern'));
  assert.ok(orchard);
  assert.ok(orchard.includes('2 of 6 gathered'));
  assert.ok(orchard.includes('4 to go'));

  const pond = lines.find((l) => l.includes('Mirror Pond Mosaic'));
  assert.ok(pond);
  assert.ok(pond.includes('0 of 6 gathered'));
  assert.ok(pond.includes('Leave finds in the basket!'));
});

test('CP-13: gratitude affinity bypasses dailyAffinityGained (shared-activity discipline)', () => {
  let world = stageNearlyCompleteOrchard().world;
  world = {
    ...world,
    playerRelations: {
      ...world.playerRelations,
      rowan: {
        ...world.playerRelations.rowan,
        affinity: 50,
        reliability: 40,
        dailyAffinityGained: 20, // smalltalk cap already reached today
      },
      jun: {
        ...world.playerRelations.jun,
        affinity: 50,
        reliability: 40,
        dailyAffinityGained: 20,
      },
    },
  };

  const res = contributeToCommunityProject(world, 'orchard_lanterns', 'wild_honey', 1);
  assert.equal(res.ok, true);
  assert.equal(res.completedNow, true);
  assert.equal(res.world.playerRelations.rowan.affinity, 54, '+4 gratitude outside the cap');
  assert.equal(res.world.playerRelations.jun.affinity, 54);
  assert.equal(res.world.playerRelations.rowan.reliability, 41, '+1 reliability');
  assert.equal(res.world.playerRelations.jun.reliability, 41);
  assert.equal(
    res.world.playerRelations.rowan.dailyAffinityGained,
    20,
    'daily smalltalk ledger untouched',
  );
  assert.equal(res.world.playerRelations.jun.dailyAffinityGained, 20);
});

test('CP-14: communityProjects slice persists through the day roll', () => {
  const { world } = stageNearlyCompleteOrchard();
  const res = contributeToCommunityProject(world, 'orchard_lanterns', 'wild_honey', 1);
  assert.equal(res.ok, true);
  const before = res.world.communityProjects;
  assert.equal(before.orchard_lanterns?.completedDay, res.world.day);

  const next = advanceToNextDay(res.world);
  assert.deepEqual(next.communityProjects, before, 'slice carried through advanceToNextDay');
  assert.equal(next.day, res.world.day + 1);
  assert.equal(
    next.communityProjects.orchard_lanterns?.contributed.wild_honey,
    2,
    'contribution totals survive the roll',
  );
  assert.equal(next.communityProjects.orchard_lanterns?.completedDay, res.world.day);
});
