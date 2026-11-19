import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDialogueChoice } from './actions';
import {
  JOURNAL_READ_STORAGE_KEY,
  buildPocketJournalView,
  formatNpcMemoryForPlayer,
  isNpcMemoryKnownToPlayer,
  loadJournalReadKeys,
  saveJournalReadKeys,
} from './journal';
import { createNpcMemoryEntry, recordNpcMemoryInPlace } from './memories';
import { buildResidentDialogue } from './narrative';
import { createFreshWorldState, deserializeWorldState } from './storage';
import { ResidentId, WorldState } from './types';

function pickChoice(
  world: WorldState,
  residentId: ResidentId,
  choiceId: string,
  phase: 'morning' | 'afternoon' | 'golden' | 'dusk' = 'afternoon',
) {
  const session = buildResidentDialogue(residentId, world, phase);
  const choice = session.nodes[session.currentNodeId].choices.find(
    (c) => c.id === choiceId,
  );
  assert.ok(
    choice,
    `Expected choice "${choiceId}" on ${residentId} (topic: ${session.topicId})`,
  );
  return { session, ...applyDialogueChoice(world, session, choice) };
}

test('fresh world journal preserves starter memory, gates main-story spoilers, and hides undiscovered storylines', () => {
  const world = createFreshWorldState();
  const view = buildPocketJournalView(world);

  // Starter memory preserved
  assert.equal(view.memories.length, 1);
  assert.equal(view.memories[0].id, 'mem_arrival');
  assert.equal(view.memories[0].isLegacySide, false);
  assert.equal(view.memories[0].isNew, true);

  // Before hearing the gazebo mystery, only the initial visible plaza observation shows
  assert.equal(view.mainStorySteps.length, 1);
  assert.equal(view.mainStorySteps[0].id, 'mystery');
  assert.equal(view.mainStorySteps[0].status, 'ongoing');

  // No undiscovered storylines ('available' at stage 0 or 'locked') appear
  assert.equal(view.activeStorylines.length, 0);
  assert.equal(view.completedStorylines.length, 0);

  // Once heardBellMystery is discovered, all 5 chapters appear cleanly
  const afterMystery: WorldState = {
    ...world,
    flags: { ...world.flags, heardBellMystery: true },
  };
  const viewAfter = buildPocketJournalView(afterMystery);
  assert.equal(viewAfter.mainStorySteps.length, 5);
  assert.equal(viewAfter.mainStorySteps[0].status, 'completed');
  assert.equal(viewAfter.mainStorySteps[1].status, 'ongoing');
});

test('strict player-knowledge boundaries hide unmet NPC details, unmentioned gossip, private lore, and npc_social events', () => {
  const base = createFreshWorldState();
  const w: WorldState = structuredClone(base);

  // Add private unmentioned gossip & witness memory onto Arthur (met: false) and Clara (met: true)
  w.residents.clara.met = true;
  w.residents.arthur.met = false;

  recordNpcMemoryInPlace(
    w.npcMemories,
    'clara',
    createNpcMemoryEntry({
      id: 'ev_secret_gossip',
      eventId: 'ev_secret_gossip',
      tag: 'fountain_fixed',
      category: 'event',
      provenance: 'secondhand',
      sourceKind: 'gossip',
      fromResidentId: 'barnaby',
      subjectPlayer: true,
      subjectResidents: ['barnaby'],
      createdDay: 1,
      createdMinute: 540,
      mentionedToPlayer: false,
      retention: 'durable',
    }),
    w.day,
  );

  recordNpcMemoryInPlace(
    w.npcMemories,
    'clara',
    createNpcMemoryEntry({
      id: 'ev_private_witness',
      eventId: 'ev_private_witness',
      tag: 'player_help_observed',
      category: 'interaction',
      provenance: 'firsthand',
      sourceKind: 'witness',
      subjectPlayer: true,
      subjectResidents: ['mina'],
      createdDay: 1,
      createdMinute: 550,
      mentionedToPlayer: false,
      retention: 'durable',
    }),
    w.day,
  );

  // Private world events (npc_social) vs player-shaped events
  w.worldEvents = [
    {
      id: 'ev_npc_private_chat',
      day: 1,
      phase: 'morning',
      minuteOfDay: 520,
      kind: 'npc_social',
      actors: ['barnaby', 'arthur'],
      summary: 'Barnaby and Arthur traded quiet carpentry notes behind closed doors.',
      summaryTag: 'npc_social',
    },
    {
      id: 'ev_player_bell',
      day: 1,
      phase: 'morning',
      minuteOfDay: 530,
      kind: 'player_help',
      actors: ['barnaby'],
      summary: 'Helped Barnaby clear the stone fountain intake.',
      summaryTag: 'fountain_fixed',
    },
  ];

  // Lock a storyline explicitly at stage 0
  w.storylines.side_pip_zine = {
    id: 'side_pip_zine',
    stage: 0,
    status: 'locked',
  };

  const view = buildPocketJournalView(w);

  // Unmet Arthur exposes NO personality, homeName, emotion, reliability, notes, or connections
  const arthurCard = view.people.find((p) => p.id === 'arthur');
  assert.ok(arthurCard);
  assert.equal(arthurCard.met, false);
  assert.equal(arthurCard.personality, undefined);
  assert.equal(arthurCard.emotionLabel, undefined);
  assert.equal(arthurCard.reliabilityLabel, undefined);
  assert.equal(arthurCard.knownNotes.length, 0);
  assert.equal(arthurCard.discoveredConnections.length, 0);
  assert.equal(arthurCard.roleLabel, 'New face along the lane');

  // Met Clara must NOT expose lore_gazebo_rift, unmentioned gossip, or unmentioned witness notes
  const claraCard = view.people.find((p) => p.id === 'clara');
  assert.ok(claraCard);
  assert.equal(claraCard.met, true);
  assert.equal(claraCard.knownNotes.length, 0);
  assert.equal(
    claraCard.discoveredConnections.includes('Arthur'),
    false,
    'Private Clara-Arthur rift must not leak before player learns of it',
  );

  // Private npc_social event excluded from laneMoments; player_help kept
  assert.equal(view.laneMoments.length, 1);
  assert.equal(view.laneMoments[0].id, 'ev_player_bell');

  // Locked storyline never exposed
  assert.equal(
    view.activeStorylines.some((s) => s.id === 'side_pip_zine'),
    false,
  );
  assert.equal(
    view.completedStorylines.some((s) => s.id === 'side_pip_zine'),
    false,
  );

  // Once Clara explicitly mentions the gossip OR town lore to the player, it becomes visible
  const gossipEntry = w.npcMemories.clara.find((m) => m.id === 'ev_secret_gossip');
  assert.ok(gossipEntry);
  assert.equal(isNpcMemoryKnownToPlayer(gossipEntry), false);
  gossipEntry.mentionedToPlayer = true;
  assert.equal(isNpcMemoryKnownToPlayer(gossipEntry), true);

  const viewAfterMention = buildPocketJournalView(w);
  const claraAfter = viewAfterMention.people.find((p) => p.id === 'clara');
  assert.equal(claraAfter?.knownNotes.length, 1);
  assert.equal(claraAfter?.knownNotes[0].certaintyKind, 'secondhand');
});

test('rumors and distorted memories always preserve uncertainty and never appear as confirmed fact', () => {
  const flavors: Array<'uncertain' | 'exaggerated' | 'misattributed_motive' | 'softened'> = [
    'uncertain',
    'exaggerated',
    'misattributed_motive',
    'softened',
  ];

  for (const flavor of flavors) {
    const entry = createNpcMemoryEntry({
      id: `ev_rumor_${flavor}`,
      eventId: `ev_rumor_${flavor}`,
      tag: 'lantern_debate',
      category: 'event',
      provenance: 'rumor',
      sourceKind: 'gossip',
      fromResidentId: 'pip',
      distorted: true,
      distortionFlavor: flavor,
      mentionedToPlayer: true,
      createdDay: 2,
      createdMinute: 700,
      retention: 'ephemeral',
    });

    const formatted = formatNpcMemoryForPlayer('toby', entry, new Set());
    assert.equal(formatted.certaintyKind, 'rumor');
    assert.equal(formatted.certaintyLabel, 'Unconfirmed rumor');
    assert.ok(
      formatted.text.startsWith('Word going around via Pip suggests'),
      `Expected uncertain rumor framing, got: "${formatted.text}"`,
    );
  }

  // Even a secondhand entry flagged distorted: true must downgrade to rumor uncertainty
  const distortedSecondhand = createNpcMemoryEntry({
    id: 'ev_distorted_secondhand',
    eventId: 'ev_distorted_secondhand',
    tag: 'player_blunt_observed',
    category: 'friction',
    provenance: 'secondhand',
    sourceKind: 'gossip',
    fromResidentId: 'mina',
    distorted: true,
    distortionFlavor: 'misattributed_motive',
    mentionedToPlayer: true,
    createdDay: 2,
    createdMinute: 740,
    retention: 'durable',
  });
  const formattedDistorted = formatNpcMemoryForPlayer(
    'nora',
    distortedSecondhand,
    new Set(),
  );
  assert.equal(formattedDistorted.certaintyKind, 'rumor');
  assert.equal(formattedDistorted.certaintyLabel, 'Unconfirmed rumor');
  assert.ok(formattedDistorted.text.includes('intentions sounded tangled'));
});

test('storyline progression updates journal cleanly without duplicates and hides outcomes until completion', () => {
  const base = createFreshWorldState();
  let world: WorldState = {
    ...base,
    flags: {
      ...base.flags,
      heardBellMystery: true,
      foundPostcard: true,
      deliveredPostcard: true,
    },
    residents: {
      ...base.residents,
      pip: { ...base.residents.pip, met: true, trust: 2 },
      toby: { ...base.residents.toby, met: true, trust: 2 },
      nora: { ...base.residents.nora, met: true, trust: 2 },
    },
  };

  // Stage 1: start Willow Lane Zine
  world = pickChoice(world, 'pip', 'pip_zine_start_choice').nextWorld;
  const viewS1 = buildPocketJournalView(world);
  assert.equal(viewS1.activeStorylines.length, 1);
  assert.equal(viewS1.completedStorylines.length, 0);
  assert.equal(viewS1.activeStorylines[0].id, 'side_pip_zine');
  assert.equal(viewS1.activeStorylines[0].stage, 1);
  assert.equal(viewS1.activeStorylines[0].outcomeLabel, undefined);
  assert.equal(viewS1.activeStorylines[0].isNew, true);

  // Mark stage 1 read
  const seenAfterS1 = new Set(viewS1.tabEntryKeys.stories);

  // Stage 2: Toby contributes watercolors (sets provisional outcome='art_edition' in engine)
  world = pickChoice(world, 'toby', 'toby_zine_watercolor').nextWorld;
  const viewS2 = buildPocketJournalView(world, seenAfterS1);
  assert.equal(viewS2.activeStorylines.length, 1, 'Advancing stage must not duplicate storyline card');
  assert.equal(viewS2.completedStorylines.length, 0);
  assert.equal(viewS2.activeStorylines[0].stage, 2);
  assert.equal(
    viewS2.activeStorylines[0].outcomeLabel,
    undefined,
    'Hidden/unresolved outcome label must NOT leak before completion',
  );
  assert.equal(
    viewS2.activeStorylines[0].isNew,
    true,
    'Advancing stage should generate a new entryKey so player sees the fresh update',
  );

  // Stage 3: Nora prints Issue #1 -> completed + legacy mem_side_chalk_zine preserved
  world = pickChoice(world, 'nora', 'nora_print_zine').nextWorld;
  const viewS3 = buildPocketJournalView(world, seenAfterS1);
  assert.equal(viewS3.activeStorylines.length, 0);
  assert.equal(viewS3.completedStorylines.length, 1);
  assert.equal(viewS3.completedStorylines[0].id, 'side_pip_zine');
  assert.equal(viewS3.completedStorylines[0].outcomeLabel, 'Pond & Lantern Art Edition');
  assert.equal(viewS3.completedStorylines[0].isNew, true);

  const zineMem = viewS3.memories.find((m) => m.id === 'mem_side_chalk_zine');
  assert.ok(zineMem, 'Legacy mem_side_chalk_zine memory must remain recorded');
  assert.equal(zineMem.isLegacySide, true);
});

test('cooldown storylines display overnight pacing note and read-state clears New status', () => {
  const world = createFreshWorldState();
  world.day = 3;
  world.storylines.conflict_plaza_lanterns = {
    id: 'conflict_plaza_lanterns',
    stage: 2,
    status: 'active',
    outcome: 'bridge_compromise',
    startedDay: 3,
    updatedDay: 3,
    cooldownUntilDay: 4,
    notes: ['Tested warm-hooded bridge lanterns at dusk.'],
  };

  const unreadView = buildPocketJournalView(world);
  assert.equal(unreadView.activeStorylines.length, 1);
  assert.equal(
    unreadView.activeStorylines[0].cooldownText,
    'Settling overnight — check back on Day 4.',
  );
  assert.equal(unreadView.activeStorylines[0].outcomeLabel, undefined);
  assert.equal(unreadView.activeStorylines[0].isNew, true);
  assert.ok(unreadView.newCounts.stories >= 1);

  const allStoriesRead = new Set(unreadView.tabEntryKeys.stories);
  const readView = buildPocketJournalView(world, allStoriesRead);
  assert.equal(readView.activeStorylines[0].isNew, false);
  assert.equal(readView.newCounts.stories, 0);
});

test('legacy v1/v3/v4 saves with mem_side_* memories migrate to v5 and render cleanly in Pocket Journal', () => {
  const legacySave = {
    schemaVersion: 3,
    day: 5,
    minuteOfDay: 1020,
    playerPos: { x: 0, z: 0 },
    playerFacing: 0,
    residents: {
      clara: { trust: 3, met: true, talkedToday: false, mood: 'warm', lastDialogueId: null },
      arthur: { trust: 2, met: true, talkedToday: false, mood: 'peaceful', lastDialogueId: null },
      mina: { trust: 2, met: true, talkedToday: false, mood: 'warm', lastDialogueId: null },
      jun: { trust: 2, met: true, talkedToday: false, mood: 'warm', lastDialogueId: null },
      barnaby: { trust: 3, met: true, talkedToday: false, mood: 'warm', lastDialogueId: null },
      sora: { trust: 2, met: true, talkedToday: false, mood: 'peaceful', lastDialogueId: null },
      toby: { trust: 2, met: true, talkedToday: false, mood: 'peaceful', lastDialogueId: null },
      nora: { trust: 2, met: true, talkedToday: false, mood: 'peaceful', lastDialogueId: null },
      pip: { trust: 2, met: true, talkedToday: false, mood: 'joyful', lastDialogueId: null },
    },
    flags: {
      heardBellMystery: true,
      foundPostcard: true,
      deliveredPostcard: true,
      brewedChamomileTea: true,
      borrowedBarnabyLadder: true,
      clearedGazeboIvy: true,
      foundBrassClapper: true,
      repairedFountain: true,
      plantedMoonPetals: true,
      mediationStyle: 'gentle_truth',
      bellRestored: true,
      claraArthurReconciled: true,
      lanternsLit: true,
    },
    sideFlags: {
      pipZineStarted: true,
      pipZinePrinted: true,
      pipZineTheme: 'kitchen_edition',
      herbLoafStarted: true,
      herbLoafShared: true,
      herbLoafStyle: 'plaza_table',
      lanternConflictStarted: true,
      lanternConflictResolved: true,
      lanternConflictOutcome: 'bridge_compromise',
    },
    memories: [
      {
        id: 'mem_arrival',
        day: 1,
        phase: 'morning',
        title: 'Moving Into Willow Step Cottage',
        summary: 'Stepped onto my new porch.',
      },
      {
        id: 'mem_side_chalk_zine',
        day: 3,
        phase: 'afternoon',
        title: 'Willow Lane Zine Issue #1',
        summary: 'Printed Pip and Nora’s neighborhood zine with Clara’s rosemary crust notes.',
        residentId: 'nora',
      },
      {
        id: 'mem_side_herb_loaf',
        day: 4,
        phase: 'golden',
        title: 'Lemon-Thyme Sourdough Afternoon',
        summary: 'Shared Mina and Clara’s warm herb loaves around the plaza.',
        residentId: 'clara',
      },
      {
        id: 'mem_side_lantern_compromise',
        day: 5,
        phase: 'dusk',
        title: 'Warm Hooded Bridge Lanterns',
        summary: 'Settled the Mirror Pond lantern spacing so fireflies still glimmer.',
        residentId: 'barnaby',
      },
    ],
  };

  const migrated = deserializeWorldState(JSON.stringify(legacySave));
  assert.equal(migrated.state.schemaVersion, 5);

  const view = buildPocketJournalView(migrated.state);
  assert.equal(view.memories.length, 4);
  assert.equal(
    view.memories.filter((m) => m.isLegacySide).length,
    3,
    'All legacy mem_side_* memories must remain intact',
  );
  assert.equal(view.completedStorylines.length, 3);
  assert.ok(
    view.completedStorylines.some(
      (s) => s.id === 'side_pip_zine' && s.outcomeLabel === 'Hearth & Recipe Edition',
    ),
  );
  assert.ok(
    view.completedStorylines.some(
      (s) => s.id === 'conflict_plaza_lanterns' && s.outcomeLabel === 'Hooded Amber Compromise',
    ),
  );
  // Landmark updates reflected accurately
  const bellLandmark = view.landmarks.find((l) => l.id === 'gazebo_bell');
  assert.equal(bellLandmark?.statusKind, 'transformed');
  assert.equal(bellLandmark?.statusLabel, 'Restored & chiming');
});

test('read-state storage helpers handle Node (no window) and browser localStorage safely', () => {
  // In Node without window, helpers do not throw
  assert.equal(loadJournalReadKeys().size, 0);
  saveJournalReadKeys(new Set(['k1']));

  const prevWindow = (globalThis as { window?: unknown }).window;
  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
    },
  };
  try {
    saveJournalReadKeys(new Set(['mem_mem_arrival', 'story_side_pip_zine_s1_active']));
    const loaded = loadJournalReadKeys();
    assert.equal(loaded.has('mem_mem_arrival'), true);
    assert.equal(loaded.has('story_side_pip_zine_s1_active'), true);
    assert.ok(store.has(JOURNAL_READ_STORAGE_KEY));
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = prevWindow;
    }
  }
});
