/**
 * LR-2 acceptance tests — Shared activities, station exclusivity, affinity & memories.
 *
 * Spec of record: docs/architecture/living-relationships/14-revised-architecture.md
 * Test plan:      docs/architecture/living-relationships/16-lr1-lr2-acceptance-test-plan.md (§4, §5)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreshWorldState } from './storage';
import { offerInvitation, acceptInvitation } from './invitations';
import { completeSharedActivity } from './activities';
import {
  applyDialogueChoice,
  browseBookshelfAction,
  enterNookAction,
  interactWithNookProp,
  togglePlayerSitAction,
} from './actions';
import { buildResidentDialogue } from './narrative';
import { selectBestNookTarget } from './bookNook';
import { getTimePhase, RESIDENT_ORDER } from './residents';
import { getNpcPairKey } from './relationships';
import { GOSSIP_MIN_AFFINITY, propagateEncounterGossipInPlace } from './memories';
import { WorldState } from './types';

function stageLiveNookReadingVisit(overrides?: {
  affinity?: number;
  reliability?: number;
  dailyAffinityGained?: number;
}): WorldState {
  let world = createFreshWorldState();
  world = {
    ...world,
    minuteOfDay: 540, // Morning — Nora schedule slot at Linden Book Nook Bench (within 6m of homePos)
    flags: { ...world.flags, foundPostcard: true },
    residents: {
      ...world.residents,
      nora: { ...world.residents.nora, met: true, trust: 3 },
    },
    playerRelations: {
      ...world.playerRelations,
      nora: {
        ...world.playerRelations.nora,
        affinity: overrides?.affinity ?? 60,
        reliability: overrides?.reliability ?? 40,
        dailyAffinityGained: overrides?.dailyAffinityGained ?? 0,
        negativeCount: 0,
      },
    },
  };

  const offered = offerInvitation(world, 'nora', 'share_featured_reading');
  assert.equal(offered.ok, true, 'precondition offer succeeds');
  const accepted = acceptInvitation(offered.world);
  assert.equal(accepted.ok, true, 'precondition accept succeeds');
  const entered = enterNookAction(accepted.world);
  assert.equal(entered.nextWorld.playerLocation, 'nook_interior', 'player inside Book Nook');
  assert.equal(entered.nextWorld.occupancy?.residentId, 'nora', 'Nora seated indoors');
  return entered.nextWorld;
}

test('LR2-05: shared featured reading does not modify solo nookState counters and logs host-only memory', () => {
  const staged = stageLiveNookReadingVisit();
  const seeded: WorldState = {
    ...staged,
    nookState: {
      shelfBrowsedDay: 3,
      teaSharedDay: 2,
      notesReadDay: 1,
      starterTeaDay: 1,
      booksRead: 2,
      teasShared: 1,
    },
  };
  const memoriesBefore = seeded.memories.length;
  const noraMemBefore = seeded.npcMemories.nora.length;
  const otherMemCountsBefore = Object.fromEntries(
    RESIDENT_ORDER.filter((id) => id !== 'nora').map((id) => [id, seeded.npcMemories[id].length]),
  );

  const res = completeSharedActivity(seeded, 'share_featured_reading');
  assert.equal(res.ok, true, 'shared reading completes cleanly');

  // Solo nook counters completely untouched
  assert.equal(res.world.nookState.shelfBrowsedDay, 3, 'shelfBrowsedDay unchanged');
  assert.equal(res.world.nookState.teaSharedDay, 2, 'teaSharedDay unchanged');
  assert.equal(res.world.nookState.booksRead, 2, 'booksRead unchanged');
  assert.equal(res.world.nookState.teasShared, 1, 'teasShared unchanged');

  // Journal & host NPC memories
  assert.equal(res.world.memories.length, memoriesBefore + 1, 'exactly one new journal memory');
  assert.equal(
    res.world.memories[0].id,
    'mem_lr_nora_featured_reading',
    'journal unlocked activity memory id',
  );
  assert.equal(res.world.npcMemories.nora.length, noraMemBefore + 1, 'Nora gained one firsthand NPC memory');
  assert.equal(res.world.npcMemories.nora[0].tag, 'shared_featured_reading');
  for (const id of RESIDENT_ORDER) {
    if (id === 'nora') continue;
    assert.equal(
      res.world.npcMemories[id].length,
      otherMemCountsBefore[id],
      `other resident ${id} gained no memory`,
    );
  }
});

test('LR2-06: solo armchair sitting and bookshelf browsing are suppressed while Nora occupies the station', () => {
  const staged = stageLiveNookReadingVisit();
  const nookBefore = { ...staged.nookState };

  const sitAttempt = togglePlayerSitAction(staged, 'nook_seat_armchair');
  assert.equal(sitAttempt.sat, false, 'player cannot take the occupied armchair');
  assert.equal(sitAttempt.nextWorld.playerPosture, 'standing', 'player remains standing');
  assert.equal(sitAttempt.nextWorld.occupancy?.residentId, 'nora', 'occupancy unchanged');

  const browseAttempt = browseBookshelfAction(staged);
  assert.equal(browseAttempt.nextWorld.nookState.shelfBrowsedDay, nookBefore.shelfBrowsedDay);
  assert.equal(browseAttempt.nextWorld.nookState.booksRead, nookBefore.booksRead);
  assert.equal(browseAttempt.nextWorld.memories.length, staged.memories.length);
  assert.equal(browseAttempt.nextWorld.occupancy?.residentId, 'nora', 'occupancy unchanged');

  // Even standing right beside the armchair, solo sit prompt is suppressed in favor of Nora
  const atChair: WorldState = {
    ...staged,
    playerPos: { x: -0.9, z: 0.6 },
  };
  const bestTarget = selectBestNookTarget(atChair);
  assert.ok(bestTarget, 'target exists beside armchair');
  assert.equal(bestTarget.kind, 'resident', 'target resolves to Nora instead of solo armchair seat');
  assert.equal(bestTarget.id, 'nora');
});

test('LR2-07 & LR2-07b: duplicate completion and pre-seeded memory id are strict no-ops', () => {
  const staged = stageLiveNookReadingVisit({ affinity: 60, reliability: 40 });
  const first = completeSharedActivity(staged, 'share_featured_reading');
  assert.equal(first.ok, true);

  const memCount = first.world.memories.length;
  const affAfter = first.world.playerRelations.nora.affinity;
  const relAfter = first.world.playerRelations.nora.reliability;
  const historyAfter = first.world.invitations.history.length;

  const second = completeSharedActivity(first.world, 'share_featured_reading');
  assert.equal(second.ok, false, 'second completion returns ok: false');
  assert.equal(second.world.memories.length, memCount, 'no duplicate journal memory');
  assert.equal(second.world.playerRelations.nora.affinity, affAfter, 'no duplicate affinity');
  assert.equal(second.world.playerRelations.nora.reliability, relAfter, 'no duplicate reliability');
  assert.equal(
    second.world.invitations.history.filter((h) => h.outcome === 'completed').length,
    1,
    'only one completed row in history',
  );
  assert.equal(second.world.invitations.history.length, historyAfter);

  // LR2-07b: Pre-seeded activity memory id blocks even a fresh accepted visit
  const freshInviteWorld = stageLiveNookReadingVisit({ affinity: 50, reliability: 35 });
  const preSeeded: WorldState = {
    ...freshInviteWorld,
    memories: [
      {
        id: 'mem_lr_nora_featured_reading',
        day: 1,
        phase: 'morning',
        title: 'Shared Pages by Lamplight',
        summary: 'Already remembered.',
        residentId: 'nora',
      },
      ...freshInviteWorld.memories,
    ],
  };
  const memPre = preSeeded.memories.length;
  const blocked = completeSharedActivity(preSeeded, 'share_featured_reading');
  assert.equal(blocked.ok, false, 'pre-seeded memory id blocks second write');
  assert.equal(blocked.world.memories.length, memPre, 'memory count unchanged');
  assert.equal(blocked.world.playerRelations.nora.affinity, 50, 'affinity unchanged');
  assert.equal(blocked.world.playerRelations.nora.reliability, 35, 'reliability unchanged');
  assert.equal(blocked.world.invitations.history.length, 0, 'invite not double-archived');
});

test('LR2-08: dialogue choice and chair station path share single transactional completion', () => {
  // Order 1: Dialogue path first, then station path
  const worldA = stageLiveNookReadingVisit({ affinity: 60, reliability: 40 });
  const phase = getTimePhase(worldA.minuteOfDay);
  const session = buildResidentDialogue('nora', worldA, phase);
  assert.equal(session.topicId, 'inv_nora_indoor_reading', 'indoor Nora opens shared reading topic');
  const rootNode = session.nodes[session.currentNodeId];
  const completeChoice = rootNode.choices.find(
    (c) => c.completeSharedActivityId === 'share_featured_reading',
  );
  assert.ok(completeChoice, 'indoor dialogue presents completeSharedActivityId choice');

  const afterDialogue = applyDialogueChoice(worldA, session, completeChoice);
  assert.equal(afterDialogue.memoryUnlockedTitle, 'Shared Pages by Lamplight');
  assert.equal(afterDialogue.nextWorld.playerRelations.nora.affinity, 66);
  assert.equal(afterDialogue.nextWorld.playerRelations.nora.reliability, 42);
  assert.equal(afterDialogue.nextWorld.occupancy, null, 'completion clears occupant');

  // Now trying the chair station path afterwards offers no second completion
  const chairPropAfter = interactWithNookProp(afterDialogue.nextWorld, 'nook_chair');
  assert.equal(chairPropAfter.actionType, undefined, 'chair station no longer offers shared reading');
  const secondComplete = completeSharedActivity(afterDialogue.nextWorld, 'share_featured_reading');
  assert.equal(secondComplete.ok, false);
  assert.equal(secondComplete.world.playerRelations.nora.affinity, 66);

  // Order 2: Station path first (`interactWithNookProp(..., 'nook_chair')` -> `completeSharedActivity`), then dialogue
  const worldB = stageLiveNookReadingVisit({ affinity: 60, reliability: 40 });
  const chairProp = interactWithNookProp(worldB, 'nook_chair');
  assert.equal(chairProp.actionType, 'share_featured_reading', 'chair PropCard exposes shared reading action');
  const afterStation = completeSharedActivity(worldB, 'share_featured_reading');
  assert.equal(afterStation.ok, true);
  assert.equal(afterStation.world.playerRelations.nora.affinity, 66);
  assert.equal(afterStation.world.playerRelations.nora.reliability, 42);

  const sessionAfterStation = buildResidentDialogue('nora', afterStation.world, phase);
  assert.notEqual(
    sessionAfterStation.topicId,
    'inv_nora_indoor_reading',
    'indoor completion topic no longer active after station completion',
  );
});

test('LR2-09 & LR2-10: +6/+2 bypasses daily smalltalk cap cleanly and clamps at 100', () => {
  // LR2-09: dailyAffinityGained === 20, affinity 50, reliability 40
  const cappedWorld = stageLiveNookReadingVisit({
    affinity: 50,
    reliability: 40,
    dailyAffinityGained: 20,
  });
  const res = completeSharedActivity(cappedWorld, 'share_featured_reading');
  assert.equal(res.ok, true);
  assert.equal(res.world.playerRelations.nora.affinity, 56, 'affinity +6 outside smalltalk cap');
  assert.equal(res.world.playerRelations.nora.reliability, 42, 'reliability +2');
  assert.equal(
    res.world.playerRelations.nora.dailyAffinityGained,
    20,
    'dailyAffinityGained unchanged',
  );

  // LR2-10: affinity 97, reliability 99 -> clamped at 100
  const nearMaxWorld = stageLiveNookReadingVisit({ affinity: 97, reliability: 99 });
  const clamped = completeSharedActivity(nearMaxWorld, 'share_featured_reading');
  assert.equal(clamped.ok, true);
  assert.equal(clamped.world.playerRelations.nora.affinity, 100, 'affinity clamped to 100');
  assert.equal(clamped.world.playerRelations.nora.reliability, 100, 'reliability clamped to 100');
});

test('LR2-13: host-only firsthand NPC memory is not shared via gossip to low-affinity neighbor', () => {
  const staged = stageLiveNookReadingVisit();
  const pairKey = getNpcPairKey('nora', 'barnaby');
  const withLowAffinityPair: WorldState = {
    ...staged,
    npcRelations: {
      ...staged.npcRelations,
      [pairKey]: {
        ...staged.npcRelations[pairKey],
        pair: pairKey,
        affinity: GOSSIP_MIN_AFFINITY - 5,
        tension: 0,
        lastGossipDay: 0,
      },
    },
  };

  const completed = completeSharedActivity(withLowAffinityPair, 'share_featured_reading');
  assert.equal(completed.ok, true);
  assert.ok(
    completed.world.npcMemories.nora.some((m) => m.tag === 'shared_featured_reading'),
    'Nora holds firsthand shared reading memory',
  );
  assert.equal(
    completed.world.npcMemories.barnaby.some((m) => m.tag === 'shared_featured_reading'),
    false,
    'Barnaby holds no shared reading memory before gossip',
  );

  // Run existing gossip selection once
  const gossipOutcome = propagateEncounterGossipInPlace(
    completed.world,
    ['nora', 'barnaby'],
    'enc_lr2_13_test',
  );
  assert.equal(gossipOutcome, null, 'low-affinity pair skips gossip transfer');
  assert.equal(
    completed.world.npcMemories.barnaby.some((m) => m.tag === 'shared_featured_reading'),
    false,
    'low-affinity neighbor does not receive Nora memory',
  );
});
