import {
  computeEnvironmentState,
  isChoiceAvailable,
} from './narrative';
import {
  composeEnvironmentState,
  getWeatherLabel,
} from './environment';
import {
  TIER_RANK,
  adjustNpcRelationPair,
  emotionToMood,
  getHeartLevel,
  getRelationshipTier,
  getRelationshipTierLabel,
  pushWorldEventInPlace,
  reconcileClaraAndArthurRelation,
  recordPlayerTalkAffinity,
} from './relationships';
import { RESIDENTS, getTimePhase } from './residents';
import { advanceToNextDay } from './storage';
import { isSeatOccupiedByNpc } from './playerController';
import {
  PLAYER_DEFAULT_FACING,
  PLAYER_SPAWN,
  getLandmarkAt,
  getSeatById,
  isPointWalkable,
  resolveMovement,
} from './worldMap';
import {
  COTTAGE_DOOR_DEFAULT_FACING,
  COTTAGE_DOOR_SPAWN,
  COTTAGE_PORCH_EXIT_POS,
  COTTAGE_VASE_ITEMS,
  createInitialCottageState,
  createInitialDailyActivities,
  describePlacedFlower,
  getSeasonalAlmanacReading,
  isInteriorPointWalkable,
  resolveAnySeatById,
} from './cottage';
import {
  GREENHOUSE_CROPS,
  GREENHOUSE_HARVEST_MINUTES,
  GREENHOUSE_NOTE_READ_MINUTES,
  GREENHOUSE_PLANT_MINUTES,
  GREENHOUSE_PORCH_EXIT_FACING,
  GREENHOUSE_PORCH_EXIT_POS,
  GREENHOUSE_DOOR_SPAWN,
  GREENHOUSE_DOOR_DEFAULT_FACING,
  GREENHOUSE_WATER_MINUTES,
  createInitialGreenhouseState,
  getGreenhouseCropBySeed,
  summarizeGreenhousePlots,
} from './greenhouse';
import {
  HEARTH_RECIPES,
  NEIGHBOR_KEEPSAKE_REWARDS,
  PERSONAL_ITEM_MAP,
  addItemToInventory,
  canCraftRecipe,
  consumeItemFromInventory,
  getFirstSipableItem,
  getGiftReactionTier,
  getItemCount,
} from './inventory';
import { DAY_END_MINUTE } from './time';
import {
  ACOUSTIC_BELL_RADIUS,
  LOCAL_WITNESS_RADIUS,
  cloneNpcMemories,
  collectWitnessesForPosition,
  createNpcMemoryEntry,
  markNpcMemoriesMentionedInPlace,
  recordNpcMemoryInPlace,
} from './memories';
import {
  STORYLINE_MAP,
  advanceStorylineInPlace,
  cloneStorylines,
} from './storylines';
import {
  CarryableItemId,
  CottageInteractableId,
  DialogueChoice,
  DialogueSession,
  EnvironmentalState,
  GiftReactionTier,
  GreenhouseInteractableId,
  PersonalItemId,
  PropInteractableId,
  ResidentId,
  WorldState,
} from './types';

export interface GainedItemChip {
  itemId: PersonalItemId;
  count: number;
}

export interface PropInteractionResult {
  nextWorld: WorldState;
  title: string;
  body: string;
  actionLabel?: string;
  actionType?:
    | 'rest_next_day'
    | 'ring_bell'
    | 'fountain_wish'
    | 'skip_stone'
    | 'enter_cottage'
    | 'exit_cottage'
    | 'hearth_panel'
    | 'vase_panel'
    | 'shelf_panel'
    | 'enter_greenhouse'
    | 'exit_greenhouse'
    | 'greenhouse_planting_panel'
    | 'greenhouse_harvest_panel';
  memoryUnlockedTitle?: string;
  /** Explicit item-gain readout rendered as chips above the prose (everyday-life polish). */
  gainedItems?: GainedItemChip[];
}

export function applyDialogueChoice(
  world: WorldState,
  session: DialogueSession,
  choice: DialogueChoice,
): { nextWorld: WorldState; nextSession: DialogueSession; memoryUnlockedTitle?: string } {
  const residentId: ResidentId = session.residentId;
  const currentRes = world.residents[residentId];
  const sf = world.sideFlags ?? {};
  if (!isChoiceAvailable(choice, world, residentId)) {
    return { nextWorld: world, nextSession: session };
  }

  const nextFlags = choice.setFlags
    ? { ...world.flags, ...choice.setFlags }
    : world.flags;

  const nextSideFlags = choice.setSideFlags
    ? { ...sf, ...choice.setSideFlags }
    : { ...sf };

  const nextStorylines = cloneStorylines(world.storylines);
  const storylineAdvances = choice.advanceStoryline
    ? Array.isArray(choice.advanceStoryline)
      ? choice.advanceStoryline
      : [choice.advanceStoryline]
    : [];
  const storylineResults: Array<{ specId: string; completedNow: boolean }> = [];
  for (const adv of storylineAdvances) {
    const advRes = advanceStorylineInPlace(nextStorylines, nextSideFlags, adv, world.day);
    storylineResults.push({ specId: adv.id, completedNow: advRes.completedNow });
  }

  const trustGain = choice.trustDelta ?? 0;
  const isGift = Boolean(choice.deliverHeldItem);
  const hasPositiveStorylineAdvance = storylineAdvances.length > 0 && !choice.isNegative;
  const isStoryMilestone = Boolean(
    choice.isStoryMilestone ||
      choice.setFlags ||
      choice.setSideFlags ||
      hasPositiveStorylineAdvance ||
      choice.unlockMemory ||
      trustGain >= 2,
  );
  const phase = getTimePhase(world.minuteOfDay);

  const forcedMood =
    nextFlags.claraArthurReconciled && (residentId === 'clara' || residentId === 'arthur')
      ? ('joyful' as const)
      : choice.setEmotion
      ? emotionToMood(choice.setEmotion)
      : undefined;

  const existingPlayerRel = world.playerRelations?.[residentId] ?? {
    residentId,
    affinity: currentRes.trust * 20,
    familiarity: currentRes.met ? 10 : 0,
    dailyAffinityGained: 0,
    talkedCount: currentRes.met ? 1 : 0,
    lastTalkDay: null,
    lastTalkPhase: null,
    mood: currentRes.mood,
    moodUntilMinute: 0,
    reliability: 25,
    negativeCount: 0,
    favorsCompleted: 0,
    giftsGiven: 0,
    lastEmotion: 'relaxed' as const,
  };

  const { relation: nextPlayerRel, progress: nextResidentProg } = recordPlayerTalkAffinity(
    existingPlayerRel,
    currentRes,
    {
      day: world.day,
      phase,
      minuteOfDay: world.minuteOfDay,
      requestedTrustDelta: trustGain,
      requestedReliabilityDelta: choice.reliabilityDelta,
      isStoryMilestone,
      isNegative: choice.isNegative,
      isGift,
      nextNodeId: choice.nextNodeId,
      forcedMood,
      forcedEmotion: choice.setEmotion,
    },
  );

  const nextResidents = {
    ...world.residents,
    [residentId]: nextResidentProg,
  };
  const nextPlayerRelations = {
    ...(world.playerRelations ?? {}),
    [residentId]: nextPlayerRel,
  };

  // Sync live NPC runtime emotion cleanly so expressions react immediately on screen
  let nextNpcRuntime = world.npcRuntime;
  if (world.npcRuntime?.[residentId]) {
    const rt = world.npcRuntime[residentId];
    const nextEmotion = choice.setEmotion ?? nextPlayerRel.lastEmotion;
    nextNpcRuntime = {
      ...world.npcRuntime,
      [residentId]: {
        ...rt,
        emotion: nextEmotion,
        emotionIntensity: choice.isNegative ? 0.78 : 0.85,
        emotionUntilMinute: world.minuteOfDay + 90,
      },
    };
  }

  let nextNpcRelations = world.npcRelations ?? {};
  if (nextFlags.claraArthurReconciled && !world.flags.claraArthurReconciled) {
    nextNpcRelations = reconcileClaraAndArthurRelation(nextNpcRelations, world.day);
  }
  if (choice.adjustNpcTension) {
    const adj = choice.adjustNpcTension;
    nextNpcRelations = adjustNpcRelationPair(
      nextNpcRelations,
      adj.a,
      adj.b,
      world.day,
      adj.deltaAffinity,
      adj.deltaTension,
      adj.tag,
    );
  }
  if (choice.adjustNpcRelations && choice.adjustNpcRelations.length > 0) {
    for (const adj of choice.adjustNpcRelations) {
      nextNpcRelations = adjustNpcRelationPair(
        nextNpcRelations,
        adj.a,
        adj.b,
        world.day,
        adj.deltaAffinity,
        adj.deltaTension,
        adj.tag,
      );
    }
  }

  // Handle held carryable delivery cleanly
  let nextHeldItem = world.playerHeldItem ?? null;
  let nextWorldProps = world.worldProps;
  if (choice.deliverHeldItem && world.worldProps?.[choice.deliverHeldItem]) {
    const deliveredId = choice.deliverHeldItem;
    const rtPos = nextNpcRuntime?.[residentId]?.position ?? world.playerPos;
    nextWorldProps = {
      ...world.worldProps,
      [deliveredId]: {
        ...world.worldProps[deliveredId],
        holder: residentId,
        pos: { ...rtPos },
      },
    };
    if (nextHeldItem === deliveredId) {
      nextHeldItem = null;
    }
  }

  let nextInventory = world.inventory;
  let nextDiscovered = world.discoveredItemIds;
  let grantedItemLabel: string | undefined;
  if (choice.grantPersonalItem) {
    const added = addItemToInventory(
      world.inventory,
      world.discoveredItemIds,
      choice.grantPersonalItem.itemId,
      choice.grantPersonalItem.count ?? 1,
    );
    nextInventory = added.inventory;
    nextDiscovered = added.discoveredItemIds;
    grantedItemLabel = PERSONAL_ITEM_MAP[choice.grantPersonalItem.itemId]?.label;
  }

  // Record topic history (per-resident for 'any' topics) & lastTopicByResident to prevent monotonous small-talk loops
  const nextTopicHistory = { ...(world.topicHistory ?? {}) };
  const nextLastTopic = { ...(world.lastTopicByResident ?? {}) };
  const historyKey = session.topicHistoryKey ?? session.topicId;
  if (session.topicId && historyKey) {
    const prevHist = nextTopicHistory[historyKey];
    const chosenIds = prevHist?.chosenChoiceIds.includes(choice.id)
      ? prevHist.chosenChoiceIds
      : [...(prevHist?.chosenChoiceIds ?? []), choice.id].slice(-8);
    nextTopicHistory[historyKey] = {
      seenCount: (prevHist?.seenCount ?? 0) + 1,
      lastSeenDay: world.day,
      lastSeenPhase: phase,
      chosenChoiceIds: chosenIds,
    };
    nextLastTopic[residentId] = session.topicId;
  }

  let nextMemories = world.memories;
  let memoryUnlockedTitle: string | undefined;

  if (choice.unlockMemory) {
    const alreadyExists = world.memories.some((m) => m.id === choice.unlockMemory!.id);
    if (!alreadyExists) {
      memoryUnlockedTitle = choice.unlockMemory.title;
      nextMemories = [
        {
          ...choice.unlockMemory,
          day: world.day,
          phase,
        },
        ...world.memories,
      ];
    }
  }

  const prevTier = getRelationshipTier(existingPlayerRel.affinity);
  const prevHearts = getHeartLevel(existingPlayerRel.affinity);
  const nextTier = getRelationshipTier(nextPlayerRel.affinity);
  const nextHearts = getHeartLevel(nextPlayerRel.affinity);
  const tierAdvanced = !choice.isNegative && TIER_RANK[nextTier] > TIER_RANK[prevTier];
  const heartAdvanced = !choice.isNegative && nextHearts > prevHearts;
  const completedStorylineNow = storylineResults.some((r) => r.completedNow);
  const significantMilestone =
    !choice.isNegative &&
    (tierAdvanced ||
      heartAdvanced ||
      Boolean(memoryUnlockedTitle) ||
      Boolean(choice.isStoryMilestone) ||
      completedStorylineNow);

  const nextEvents = [...(world.worldEvents ?? [])];
  const storyEventId = `story_${world.day}_${choice.id}`;
  const isConflictStoryline =
    storylineAdvances.some((a) => STORYLINE_MAP[a.id]?.category === 'interconnected_conflict') ||
    (session.category === 'conflict_reconciliation' && storylineAdvances.length > 0);
  if (choice.setFlags || choice.setSideFlags || storylineAdvances.length > 0 || isGift) {
    const flagSummary = memoryUnlockedTitle
      ? `${RESIDENTS[residentId].name}: ${memoryUnlockedTitle}`
      : isGift
      ? `Shared ${world.worldProps?.[choice.deliverHeldItem!]?.label ?? 'a keepsake'} with ${RESIDENTS[residentId].name}.`
      : `Shared a meaningful step with ${RESIDENTS[residentId].name}.`;
    const eventKind = isGift
      ? 'player_help'
      : isConflictStoryline
      ? 'conflict_shift'
      : storylineAdvances.length > 0 && !choice.setFlags
      ? 'storyline_beat'
      : 'story_flag';
    pushWorldEventInPlace(nextEvents, {
      id: storyEventId,
      day: world.day,
      phase,
      minuteOfDay: Math.round(world.minuteOfDay),
      kind: eventKind,
      actors: [residentId],
      summary: flagSummary,
      summaryTag: choice.id,
    });
  }

  // Capture bounded per-NPC subjective memories (immutable clone so world.npcMemories is untouched)
  const nextNpcMemories = cloneNpcMemories(world.npcMemories);
  const roundedMinute = Math.round(world.minuteOfDay);
  const eventPos = nextNpcRuntime?.[residentId]?.position ?? world.playerPos;
  const placeName = getLandmarkAt(eventPos).name;

  if (choice.recordNpcMemories && choice.recordNpcMemories.length > 0) {
    for (const spec of choice.recordNpcMemories) {
      const targetId = spec.target === 'speaker' ? residentId : spec.target;
      const specEventId = spec.eventId ?? spec.id;
      recordNpcMemoryInPlace(
        nextNpcMemories,
        targetId,
        createNpcMemoryEntry({
          id: spec.id,
          eventId: specEventId,
          tag: spec.tag,
          category: spec.category,
          subjectPlayer: spec.subjectPlayer ?? true,
          subjectResidents: spec.subjectResidents ?? [targetId],
          provenance: 'firsthand',
          sourceKind: spec.sourceKind ?? 'participant',
          createdDay: world.day,
          createdMinute: roundedMinute,
          importance: spec.importance,
          retention: spec.retention,
          valence: spec.valence,
          emotionalWeight: spec.emotionalWeight ?? 72,
          detail: { placeName },
        }),
        world.day,
      );
    }
  }

  if (isGift && choice.deliverHeldItem) {
    const giftEventId = storyEventId;
    recordNpcMemoryInPlace(
      nextNpcMemories,
      residentId,
      createNpcMemoryEntry({
        id: giftEventId,
        eventId: giftEventId,
        tag: 'player_gift',
        category: 'interaction',
        subjectPlayer: true,
        subjectResidents: [residentId],
        provenance: 'firsthand',
        sourceKind: 'participant',
        createdDay: world.day,
        createdMinute: roundedMinute,
        importance: 3,
        retention: 'durable',
        valence: 'warm',
        emotionalWeight: 74,
        detail: { itemId: choice.deliverHeldItem, placeName },
      }),
      world.day,
    );
    const witnesses = collectWitnessesForPosition(world, eventPos, LOCAL_WITNESS_RADIUS, {
      excludeIds: [residentId],
    });
    for (const wid of witnesses) {
      recordNpcMemoryInPlace(
        nextNpcMemories,
        wid,
        createNpcMemoryEntry({
          id: giftEventId,
          eventId: giftEventId,
          tag: 'player_help_observed',
          category: 'interaction',
          subjectPlayer: true,
          subjectResidents: [residentId],
          provenance: 'firsthand',
          sourceKind: 'witness',
          createdDay: world.day,
          createdMinute: roundedMinute,
          importance: 2,
          retention: 'durable',
          valence: 'warm',
          emotionalWeight: 58,
          detail: { itemId: choice.deliverHeldItem, placeName },
        }),
        world.day,
      );
    }
  }

  if (choice.setFlags) {
    const recordFlagWithWitnesses = (
      eventId: string,
      tag: string,
      category: 'event' | 'interaction' | 'town_lore',
      importance: number,
      retention: 'durable' | 'permanent',
      emotionalWeight: number,
      targetPlace: string,
      withWitnesses: boolean,
    ) => {
      recordNpcMemoryInPlace(
        nextNpcMemories,
        residentId,
        createNpcMemoryEntry({
          id: eventId,
          eventId,
          tag,
          category,
          subjectPlayer: true,
          subjectResidents: [residentId],
          provenance: 'firsthand',
          sourceKind: 'participant',
          createdDay: world.day,
          createdMinute: roundedMinute,
          importance,
          retention,
          valence: tag === 'bell_mystery' ? 'neutral' : 'warm',
          emotionalWeight,
          detail: { placeName: targetPlace },
        }),
        world.day,
      );
      if (withWitnesses) {
        const witnesses = collectWitnessesForPosition(world, eventPos, LOCAL_WITNESS_RADIUS, {
          excludeIds: [residentId],
        });
        for (const wid of witnesses) {
          recordNpcMemoryInPlace(
            nextNpcMemories,
            wid,
            createNpcMemoryEntry({
              id: eventId,
              eventId,
              tag,
              category,
              subjectPlayer: true,
              subjectResidents: [residentId],
              provenance: 'firsthand',
              sourceKind: 'witness',
              createdDay: world.day,
              createdMinute: roundedMinute,
              importance: Math.max(2, importance - 1),
              retention: retention === 'permanent' ? 'durable' : retention,
              valence: 'warm',
              emotionalWeight: Math.max(45, emotionalWeight - 15),
              detail: { placeName: targetPlace },
            }),
            world.day,
          );
        }
      }
    };

    if (nextFlags.heardBellMystery && !world.flags.heardBellMystery) {
      recordFlagWithWitnesses('ev_bell_mystery', 'bell_mystery', 'interaction', 3, 'durable', 62, placeName, false);
    }
    if (nextFlags.clearedGazeboIvy && !world.flags.clearedGazeboIvy) {
      recordFlagWithWitnesses('ev_gazebo_ivy', 'gazebo_ivy', 'event', 3, 'durable', 72, 'Old Bell Gazebo', true);
    }
    if (nextFlags.repairedFountain && !world.flags.repairedFountain) {
      recordFlagWithWitnesses('ev_fountain_fixed', 'fountain_fixed', 'event', 4, 'durable', 80, 'Sunlit Fountain Plaza', true);
    }
    if (nextFlags.plantedMoonPetals && !world.flags.plantedMoonPetals) {
      recordFlagWithWitnesses('ev_moon_petals', 'moon_petals', 'event', 4, 'durable', 78, 'Willow Step Planters', true);
    }
    if (nextFlags.deliveredPostcard && !world.flags.deliveredPostcard) {
      recordFlagWithWitnesses('ev_postcard_delivered', 'postcard_delivered', 'interaction', 3, 'durable', 72, placeName, false);
    }
    if (nextFlags.brewedChamomileTea && !world.flags.brewedChamomileTea) {
      recordFlagWithWitnesses('ev_chamomile_tea', 'chamomile_tea', 'interaction', 3, 'durable', 70, placeName, false);
    }
    if (nextFlags.foundBrassClapper && !world.flags.foundBrassClapper) {
      recordFlagWithWitnesses('ev_brass_clapper', 'brass_clapper', 'interaction', 4, 'durable', 75, placeName, false);
    }
    if (nextFlags.bellRestored && !world.flags.bellRestored) {
      recordFlagWithWitnesses('ev_bell_restored', 'bell_restored', 'event', 5, 'permanent', 95, 'Old Bell Gazebo', true);
    }
    if (nextFlags.claraArthurReconciled && !world.flags.claraArthurReconciled) {
      const recActors: ResidentId[] = ['arthur', 'clara'];
      for (const actor of recActors) {
        recordNpcMemoryInPlace(
          nextNpcMemories,
          actor,
          createNpcMemoryEntry({
            id: 'ev_clara_arthur_reconciled',
            eventId: 'ev_clara_arthur_reconciled',
            tag: 'clara_arthur_reconciled',
            category: 'town_lore',
            subjectPlayer: true,
            subjectResidents: ['arthur', 'clara'],
            provenance: 'firsthand',
            sourceKind: 'participant',
            createdDay: world.day,
            createdMinute: roundedMinute,
            importance: 5,
            retention: 'permanent',
            valence: 'warm',
            emotionalWeight: 92,
            detail: { placeName: 'Old Bell Gazebo' },
          }),
          world.day,
        );
      }
    }
  } else if (
    (choice.setSideFlags || hasPositiveStorylineAdvance || choice.isStoryMilestone) &&
    !isGift &&
    (!choice.recordNpcMemories || choice.recordNpcMemories.length === 0)
  ) {
    recordNpcMemoryInPlace(
      nextNpcMemories,
      residentId,
      createNpcMemoryEntry({
        id: storyEventId,
        eventId: storyEventId,
        tag: choice.id,
        category: 'interaction',
        subjectPlayer: true,
        subjectResidents: [residentId],
        provenance: 'firsthand',
        sourceKind: 'participant',
        createdDay: world.day,
        createdMinute: roundedMinute,
        importance: 3,
        retention: 'durable',
        valence: choice.isNegative ? 'tense' : 'warm',
        emotionalWeight: 68,
        detail: { placeName },
      }),
      world.day,
    );
  }

  if (choice.isNegative) {
    const frictionId = `ev_blunt_${world.day}_${roundedMinute}_${residentId}`;
    recordNpcMemoryInPlace(
      nextNpcMemories,
      residentId,
      createNpcMemoryEntry({
        id: frictionId,
        eventId: frictionId,
        tag: 'player_blunt',
        category: 'friction',
        subjectPlayer: true,
        subjectResidents: [residentId],
        provenance: 'firsthand',
        sourceKind: 'participant',
        createdDay: world.day,
        createdMinute: roundedMinute,
        importance: 3,
        retention: 'durable',
        valence: 'tense',
        emotionalWeight: 72,
        detail: { placeName },
      }),
      world.day,
    );
    const witnesses = collectWitnessesForPosition(world, eventPos, LOCAL_WITNESS_RADIUS, {
      excludeIds: [residentId],
    });
    for (const wid of witnesses) {
      recordNpcMemoryInPlace(
        nextNpcMemories,
        wid,
        createNpcMemoryEntry({
          id: frictionId,
          eventId: frictionId,
          tag: 'player_blunt_observed',
          category: 'friction',
          subjectPlayer: true,
          subjectResidents: [residentId],
          provenance: 'firsthand',
          sourceKind: 'witness',
          createdDay: world.day,
          createdMinute: roundedMinute,
          importance: 2,
          retention: 'durable',
          valence: 'tense',
          emotionalWeight: 56,
          detail: { placeName },
        }),
        world.day,
      );
    }
  } else if (choice.id.startsWith('make_amends_')) {
    const amendsId = `ev_amends_${world.day}_${roundedMinute}_${residentId}`;
    recordNpcMemoryInPlace(
      nextNpcMemories,
      residentId,
      createNpcMemoryEntry({
        id: amendsId,
        eventId: amendsId,
        tag: 'player_amends',
        category: 'interaction',
        subjectPlayer: true,
        subjectResidents: [residentId],
        provenance: 'firsthand',
        sourceKind: 'participant',
        createdDay: world.day,
        createdMinute: roundedMinute,
        importance: 3,
        retention: 'durable',
        valence: 'warm',
        emotionalWeight: 76,
        detail: { placeName },
      }),
      world.day,
    );
  }

  if (tierAdvanced && (nextTier === 'friendly' || nextTier === 'close' || nextTier === 'kindred')) {
    const tierEvId = `ev_tier_${residentId}_${nextTier}`;
    recordNpcMemoryInPlace(
      nextNpcMemories,
      residentId,
      createNpcMemoryEntry({
        id: tierEvId,
        eventId: tierEvId,
        tag: `player_bond_${nextTier}`,
        category: 'social_impression',
        subjectPlayer: true,
        subjectResidents: [residentId],
        provenance: 'firsthand',
        sourceKind: 'participant',
        createdDay: world.day,
        createdMinute: roundedMinute,
        importance: nextTier === 'kindred' ? 4 : 3,
        retention: 'durable',
        valence: 'warm',
        emotionalWeight: nextTier === 'kindred' ? 86 : 70,
        detail: { targetTier: nextTier, placeName },
      }),
      world.day,
    );
  }

  if (session.surfacedMemoryEventIds?.length) {
    for (const item of session.surfacedMemoryEventIds) {
      markNpcMemoriesMentionedInPlace(nextNpcMemories, item.residentId, {
        eventIds: [item.eventId],
      });
    }
  }
  if (choice.markMemoryTagsMentioned?.length || choice.markMemoryEventIdsMentioned?.length) {
    markNpcMemoriesMentionedInPlace(nextNpcMemories, residentId, {
      eventIds: choice.markMemoryEventIdsMentioned,
      tags: choice.markMemoryTagsMentioned,
    });
  }

  const nextWorld: WorldState = {
    ...world,
    playerHeldItem: nextHeldItem,
    worldProps: nextWorldProps,
    residents: nextResidents,
    npcRuntime: nextNpcRuntime,
    playerRelations: nextPlayerRelations,
    npcRelations: nextNpcRelations,
    worldEvents: nextEvents,
    topicHistory: nextTopicHistory,
    lastTopicByResident: nextLastTopic,
    sideFlags: nextSideFlags,
    storylines: nextStorylines,
    flags: nextFlags,
    memories: nextMemories,
    npcMemories: nextNpcMemories,
    inventory: nextInventory,
    discoveredItemIds: nextDiscovered,
  };

  const giftToast = isGift
    ? `Shared ${world.worldProps?.[choice.deliverHeldItem!]?.label ?? 'item'} with ${RESIDENTS[residentId].name}!`
    : grantedItemLabel
    ? `Tucked ${grantedItemLabel} into your satchel!`
    : undefined;

  const tierToast = tierAdvanced
    ? `Friendship grew: ${getRelationshipTierLabel(nextTier)}!`
    : heartAdvanced
    ? `Friendship grew with ${RESIDENTS[residentId].name}!`
    : undefined;

  const milestoneLabel = tierAdvanced
    ? `New bond: ${getRelationshipTierLabel(nextTier)}`
    : heartAdvanced
    ? 'Friendship deepened!'
    : memoryUnlockedTitle
    ? 'Memory unlocked!'
    : completedStorylineNow || choice.isStoryMilestone
    ? 'Story milestone!'
    : undefined;

  const nextSession: DialogueSession = {
    ...session,
    tier: nextTier,
    currentNodeId: choice.nextNodeId,
    emotion: nextNpcRuntime?.[residentId]?.emotion ?? session.emotion,
    recentToast: memoryUnlockedTitle
      ? `Memory saved: ${memoryUnlockedTitle}`
      : giftToast ?? tierToast,
    milestonePulseSeq: significantMilestone
      ? (session.milestonePulseSeq ?? 0) + 1
      : session.milestonePulseSeq,
    milestoneLabel: significantMilestone ? milestoneLabel : undefined,
  };

  return { nextWorld, nextSession, memoryUnlockedTitle };
}

export function togglePlayerSitAction(
  world: WorldState,
  seatId?: string,
): { nextWorld: WorldState; sat: boolean; toast?: string } {
  if (world.playerPosture === 'sitting') {
    const seat = resolveAnySeatById(world.playerSeatId);
    const approachWalkable = seat
      ? seat.indoor
        ? isInteriorPointWalkable(seat.approachPos.x, seat.approachPos.z, 0.42)
        : isPointWalkable(seat.approachPos.x, seat.approachPos.z, 0.48)
      : false;
    const standPos =
      seat && approachWalkable ? { ...seat.approachPos } : { ...world.playerPos };
    return {
      nextWorld: {
        ...world,
        playerPosture: 'standing',
        playerSeatId: null,
        playerPos: standPos,
      },
      sat: false,
      toast: seat ? `Stood up from ${seat.label}.` : 'Stood up.',
    };
  }

  const seat = resolveAnySeatById(seatId);
  if (!seat) return { nextWorld: world, sat: false };
  // Cottage-interior seats are player-only (residents never enter the home), so the
  // outdoor NPC seat-claiming occupancy check does not apply to them.
  if (!seat.indoor) {
    const occupier = isSeatOccupiedByNpc(world, seat.id);
    if (occupier) {
      return {
        nextWorld: world,
        sat: false,
        toast: `${RESIDENTS[occupier].name} is resting on ${seat.label} right now.`,
      };
    }
  }

  return {
    nextWorld: {
      ...world,
      playerPosture: 'sitting',
      playerSeatId: seat.id,
      playerPos: { ...seat.seatPos },
      playerFacing: seat.facingAngle,
    },
    sat: true,
    toast: seat.indoor ? `Sitting at ${seat.label.toLowerCase()}.` : `Resting on ${seat.label}.`,
  };
}

/** Minutes gently spent enjoying a drink at the cottage tea table. */
export const SIP_MINUTES_SPENT = 8;

export interface SipBeverageResult {
  ok: boolean;
  nextWorld: WorldState;
  title: string;
  body: string;
  toast?: string;
  memoryUnlockedTitle?: string;
}

const SIP_SCENES: string[] = [
  'The cup warms your hands while the room hums its quiet afternoon sounds. Outside, Willow Lane keeps moving without you — for a few minutes, that is exactly right.',
  'You take it slow, one unhurried sip at a time. The oak table holds the vase, the window holds the light, and the cottage holds you.',
  'Steam curls past your nose, sweet and faintly herbal. The stool creaks softly as you lean back and simply sit for a while.',
  'You wrap both palms around the cup and let the warmth settle in. Somewhere beyond the window, a neighbor passes humming — the lane carries on, and so do you.',
];

/**
 * Tea-table ritual (Pass 5, everyday-life polish): enjoy a brewed drink while seated
 * at a cottage seat. Consumes the item once, spends a few in-game minutes, and records
 * a first-time Pocket Journal memory per drink. Pure reducer — no UI scheduling.
 */
export function sipBeverageAtTableAction(
  world: WorldState,
  requestedItemId?: PersonalItemId,
): SipBeverageResult {
  if (world.playerLocation !== 'cottage_interior') {
    return { ok: false, nextWorld: world, title: '', body: '' };
  }
  if (world.playerPosture !== 'sitting') {
    return { ok: false, nextWorld: world, title: '', body: '' };
  }
  const seat = resolveAnySeatById(world.playerSeatId);
  if (!seat?.indoor) {
    return { ok: false, nextWorld: world, title: '', body: '' };
  }

  const sip = requestedItemId
    ? (() => {
        const def = PERSONAL_ITEM_MAP[requestedItemId];
        return def?.sipable && getItemCount(world.inventory, requestedItemId) > 0
          ? { itemId: requestedItemId, def }
          : null;
      })()
    : getFirstSipableItem(world.inventory);
  if (!sip) {
    return { ok: false, nextWorld: world, title: '', body: '' };
  }

  const consumed = consumeItemFromInventory({ ...(world.inventory ?? {}) }, sip.itemId, 1);
  if (!consumed.ok) {
    return { ok: false, nextWorld: world, title: '', body: '' };
  }

  const nextMin = Math.min(DAY_END_MINUTE, world.minuteOfDay + SIP_MINUTES_SPENT);
  const phase = getTimePhase(nextMin);

  const memId = `mem_teatable_${sip.itemId}`;
  const hasMem = world.memories.some((m) => m.id === memId);
  const memoryUnlockedTitle = hasMem ? undefined : `A Quiet ${sip.def.label} Moment`;
  const nextMemories = hasMem
    ? world.memories
    : [
        {
          id: memId,
          day: world.day,
          phase,
          title: memoryUnlockedTitle!,
          summary: `I sat at the oak table with a warm ${sip.def.label.toLowerCase()} and let the cottage be still for a few minutes.`,
        },
        ...world.memories,
      ];

  const sceneIdx = (world.day + Math.round(world.minuteOfDay)) % SIP_SCENES.length;

  return {
    ok: true,
    nextWorld: {
      ...world,
      minuteOfDay: nextMin,
      inventory: consumed.inventory,
      memories: nextMemories,
    },
    title: `Tea at the Oak Table`,
    body: `${SIP_SCENES[sceneIdx]} (Spent ${SIP_MINUTES_SPENT} minutes.)`,
    toast: `Enjoyed ${sip.def.label} at the table (+${SIP_MINUTES_SPENT}m).`,
    memoryUnlockedTitle,
  };
}

export function pickupWorldPropAction(
  world: WorldState,
  propId: CarryableItemId,
): { nextWorld: WorldState; toast: string } {
  const prop = world.worldProps?.[propId];
  if (!prop || prop.holder !== 'world') {
    return { nextWorld: world, toast: '' };
  }

  // If standing on a bench or holding something else, drop cleanly first
  let workingWorld = world;
  if (world.playerHeldItem && world.worldProps?.[world.playerHeldItem]) {
    workingWorld = placeWorldPropAction(world).nextWorld;
  }

  return {
    nextWorld: {
      ...workingWorld,
      playerHeldItem: propId,
      worldProps: {
        ...workingWorld.worldProps,
        [propId]: {
          ...workingWorld.worldProps[propId],
          holder: 'player',
        },
      },
    },
    toast: `Picked up ${prop.label}.`,
  };
}

export function placeWorldPropAction(world: WorldState): { nextWorld: WorldState; toast: string } {
  const heldId = world.playerHeldItem;
  if (!heldId || !world.worldProps?.[heldId]) {
    return { nextWorld: world, toast: '' };
  }
  const prop = world.worldProps[heldId];
  const dropTarget = {
    x: world.playerPos.x + Math.sin(world.playerFacing) * 0.72,
    z: world.playerPos.z + Math.cos(world.playerFacing) * 0.72,
  };
  const safePos = isPointWalkable(dropTarget.x, dropTarget.z, 0.35)
    ? dropTarget
    : resolveMovement(world.playerPos, dropTarget, 0.35);

  return {
    nextWorld: {
      ...world,
      playerHeldItem: null,
      worldProps: {
        ...world.worldProps,
        [heldId]: {
          ...prop,
          holder: 'world',
          pos: { x: safePos.x, z: safePos.z },
        },
      },
    },
    toast: `Set down ${prop.label}.`,
  };
}

export function deliverHeldItemAction(
  world: WorldState,
  residentId: ResidentId,
): { nextWorld: WorldState; toast: string; likesIt: boolean } {
  const heldId = world.playerHeldItem;
  if (!heldId || !world.worldProps?.[heldId]) {
    return { nextWorld: world, toast: '', likesIt: false };
  }
  const prop = world.worldProps[heldId];
  const likesIt = prop.likedBy.includes(residentId);

  const syntheticSession: DialogueSession = {
    residentId,
    currentNodeId: 'root',
    nodes: {},
  };
  const syntheticChoice: DialogueChoice = {
    id: `gift_${heldId}_${residentId}`,
    label: `Share ${prop.label}`,
    nextNodeId: 'gift_end',
    trustDelta: likesIt ? 1 : 0,
    reliabilityDelta: likesIt ? 10 : 5,
    setEmotion: likesIt ? 'excited' : 'happy',
    deliverHeldItem: heldId,
  };

  // applyDialogueChoice emits the single canonical player_help WorldEventRecord and captures recipient + witness npcMemories
  const res = applyDialogueChoice(world, syntheticSession, syntheticChoice);
  const nextWorld = {
    ...res.nextWorld,
    lastTopicByResident: world.lastTopicByResident,
  };

  return {
    nextWorld,
    likesIt,
    toast: likesIt
      ? `${RESIDENTS[residentId].name} loved the ${prop.label}!`
      : `Shared ${prop.label} with ${RESIDENTS[residentId].name}.`,
  };
}

export function markResidentMet(world: WorldState, id: ResidentId): WorldState {
  if (world.residents[id].met) return world;
  return {
    ...world,
    residents: {
      ...world.residents,
      [id]: {
        ...world.residents[id],
        met: true,
      },
    },
  };
}

export function getDailyMailboxLetter(world: WorldState): { subject: string; body: string; sender: string } {
  const f = world.flags;
  if (f.bellRestored) {
    return {
      sender: 'Clara & Arthur',
      subject: 'A Loaf & a Brass Key',
      body: 'Thank you for reminding two stubborn friends how bright the lane feels when we share it. Your porch is always welcome at Hearth & Crumb and Copperwheel.',
    };
  }
  if (!f.bellRestored && world.sideFlags?.orchardGatheringComplete) {
    return {
      sender: 'Rowan, Orchard Keeper',
      subject: 'Lanterns Beneath the Boughs',
      body: 'The marigold lanterns and tasting table in Fern Hollow Orchard stay open every afternoon now—stop by anytime to sample honeyed treats beneath the crabapples.',
    };
  }
  if (f.heardBellMystery && world.day >= 2) {
    return {
      sender: 'Jun, Letter Carrier',
      subject: 'Morning Rounds Note',
      body: 'Every neighbor has a piece of the puzzle—Mina knows the gazebo ivy, Toby sketches by the hollow oak, and Sora brews tea near the square.',
    };
  }
  return {
    sender: 'Little Somewhere Welcome Committee',
    subject: 'Welcome to Willow Step Cottage!',
    body: 'Take your time wandering the cobblestones. Hold Shift to sprint, rest on any cedar bench, share helpful lane items with neighbors, and check your porch door whenever you are ready for tomorrow.',
  };
}

export function interactWithProp(
  world: WorldState,
  propId: PropInteractableId,
): PropInteractionResult {
  const env: EnvironmentalState = computeEnvironmentState(world.flags, world.sideFlags);

  if (propId === 'player_mailbox') {
    const letter = getDailyMailboxLetter(world);
    const nextWorld: WorldState = {
      ...world,
      mailboxUnread: false,
      dailyLettersRead: world.dailyLettersRead.includes(world.day)
        ? world.dailyLettersRead
        : [...world.dailyLettersRead, world.day],
    };
    return {
      nextWorld,
      title: `${letter.subject} — from ${letter.sender}`,
      body: letter.body,
    };
  }

  if (propId === 'player_door') {
    return {
      nextWorld: world,
      title: 'Willow Step Cottage Porch',
      body: 'Your warm timber cottage waits just inside—kettle on the hearth, stoneware vase on the table, and a patchwork quilt bed by the window.',
      actionLabel: 'Enter Cottage',
      actionType: 'enter_cottage',
    };
  }

  if (propId === 'greenhouse_door') {
    return {
      nextWorld: world,
      title: 'Sunbeam Greenhouse Door',
      body: 'Warm glass panels glow with afternoon light. Mina’s seed drawers, rain barrel, and the shared growing shelf wait inside.',
      actionLabel: 'Step Inside',
      actionType: 'enter_greenhouse',
    };
  }

  if (propId === 'cottage_window_box') {
    const da = world.dailyActivities ?? createInitialDailyActivities();
    if (da.cottagePlanterTendedToday) {
      return {
        nextWorld: world,
        title: 'Porch Herb & Chamomile Box',
        body: 'You watered and clipped today’s fresh chamomile blossoms. New buds will open by tomorrow morning.',
      };
    }
    let invRes = addItemToInventory(world.inventory, world.discoveredItemIds, 'chamomile_blossom', 1);
    const bonusLavender = world.day % 2 === 0;
    if (bonusLavender) {
      invRes = addItemToInventory(invRes.inventory, invRes.discoveredItemIds, 'lavender_sprig', 1);
    }
    const gainedItems: GainedItemChip[] = bonusLavender
      ? [
          { itemId: 'chamomile_blossom', count: 1 },
          { itemId: 'lavender_sprig', count: 1 },
        ]
      : [{ itemId: 'chamomile_blossom', count: 1 }];
    const nextMin = Math.min(DAY_END_MINUTE, world.minuteOfDay + 12);
    return {
      nextWorld: {
        ...world,
        minuteOfDay: nextMin,
        inventory: invRes.inventory,
        discoveredItemIds: invRes.discoveredItemIds,
        dailyActivities: { ...da, cottagePlanterTendedToday: true },
      },
      title: 'Porch Herb & Chamomile Box',
      body: bonusLavender
        ? 'You brushed morning soil aside and clipped fresh Chamomile Blossoms alongside Sweet Lavender for your satchel (+12m).'
        : 'Warm sunlight scents the sill as you gather a handful of Chamomile Blossoms for your tea kettle or table vase (+12m).',
      gainedItems,
    };
  }

  if (propId === 'greenhouse_planters') {
    const da = world.dailyActivities ?? createInitialDailyActivities();
    if (da.greenhousePlantersTendedToday) {
      return {
        nextWorld: world,
        title: 'Sunbeam Herb Planters',
        body: 'The terracotta herb trays beside Mina’s greenhouse are freshly watered for the day.',
      };
    }
    let invRes = addItemToInventory(world.inventory, world.discoveredItemIds, 'lemon_thyme', 1);
    invRes = addItemToInventory(invRes.inventory, invRes.discoveredItemIds, 'lavender_sprig', 1);
    const nextMin = Math.min(DAY_END_MINUTE, world.minuteOfDay + 15);
    return {
      nextWorld: {
        ...world,
        minuteOfDay: nextMin,
        inventory: invRes.inventory,
        discoveredItemIds: invRes.discoveredItemIds,
        dailyActivities: { ...da, greenhousePlantersTendedToday: true },
      },
      title: 'Sunbeam Herb Planters',
      body: 'Mina left snipping shears out by the warm glasshouse trays. Gathered Lemon Thyme Sprig and Sweet Lavender (+15m).',
      gainedItems: [
        { itemId: 'lemon_thyme', count: 1 },
        { itemId: 'lavender_sprig', count: 1 },
      ],
    };
  }

  if (propId === 'orchard_harvest') {
    const da = world.dailyActivities ?? createInitialDailyActivities();
    if (da.orchardHarvestedToday) {
      return {
        nextWorld: world,
        title: 'Fern Hollow Harvest Crates',
        body: 'Today’s ripe crabapples and wild honeycomb have been gathered cleanly beneath the orchard boughs.',
      };
    }
    let invRes = addItemToInventory(world.inventory, world.discoveredItemIds, 'crabapple', 2);
    invRes = addItemToInventory(invRes.inventory, invRes.discoveredItemIds, 'wild_honey', 1);
    const phase = getTimePhase(world.minuteOfDay);
    const memId = 'mem_orchard_harvest';
    const hasMem = world.memories.some((m) => m.id === memId);
    const nextMemories = hasMem
      ? world.memories
      : [
          {
            id: memId,
            day: world.day,
            phase,
            title: 'Sunlit Boughs at Fern Hollow',
            summary:
              'Filled my satchel with crisp Orchard Crabapples and golden honeycomb beside the woven bee skep.',
          },
          ...world.memories,
        ];
    const nextMin = Math.min(DAY_END_MINUTE, world.minuteOfDay + 20);
    return {
      nextWorld: {
        ...world,
        minuteOfDay: nextMin,
        inventory: invRes.inventory,
        discoveredItemIds: invRes.discoveredItemIds,
        dailyActivities: { ...da, orchardHarvestedToday: true },
        memories: nextMemories,
      },
      title: 'Fern Hollow Harvest Crates',
      body: 'Dappled shade smells of warm apples and clover. Gathered 2 Orchard Crabapples and 1 Orchard Honeycomb into your satchel (+20m).',
      memoryUnlockedTitle: hasMem ? undefined : 'Sunlit Boughs at Fern Hollow',
      gainedItems: [
        { itemId: 'crabapple', count: 2 },
        { itemId: 'wild_honey', count: 1 },
      ],
    };
  }

  if (propId === 'orchard_skep') {
    const composed = composeEnvironmentState(world);
    const da = world.dailyActivities ?? createInitialDailyActivities();
    const season = composed.season.season;
    const phase = composed.timeOfDay.phase;
    const effWeather = composed.weather.effective;
    const skepLead =
      season === 'winter'
        ? 'A quiet winter cluster warms the inside of Rowan’s braided straw dome beneath frosted clover.'
        : effWeather === 'light_rain'
        ? 'Honeybees stay snug inside the dry waxed dome while rain beads across the clover leaves around the cedar stool.'
        : phase === 'morning' || phase === 'afternoon'
        ? 'Golden honeybees trace figure-eights past the skep entrance with dustings of blossom pollen, filling the glade with a gentle hum.'
        : 'Returning bees tuck their wings inside the straw rings as honey-warmth drifts softly beneath the orchard boughs.';
    const extraNote =
      env.orchardGatheringOutcome && env.orchardGatheringOutcome !== 'none'
        ? ' Just north of the skep, warm marigold lanterns sway above the Fern Hollow tasting table.'
        : da.orchardHarvestedToday
        ? ' Today’s fresh honeycomb is already tucked safely into your satchel.'
        : ' Rowan leaves extra wild honeycomb beside the cedar harvest crates just north.';
    return {
      nextWorld: world,
      title: 'Woven Bee Skep & Honey Crock',
      body: `${skepLead}${extraNote}`,
    };
  }

  if (propId === 'pond_driftwood') {
    const da = world.dailyActivities ?? createInitialDailyActivities();
    if (da.pondCombedToday) {
      return {
        nextWorld: world,
        title: 'Mirror Pond Driftwood Nook',
        body: 'Smooth pebbles sit dry along the reeds—wait for tomorrow’s ripples to turn up new shoreline curios.',
      };
    }
    const pool: PersonalItemId[] = ['smooth_river_glass', 'heron_feather', 'pressed_fern', 'cedar_shaving_rose'];
    const foundId = pool[(world.day + Math.floor(world.minuteOfDay / 60)) % pool.length];
    const foundDef = PERSONAL_ITEM_MAP[foundId];
    const invRes = addItemToInventory(world.inventory, world.discoveredItemIds, foundId, 1);
    const nextMin = Math.min(DAY_END_MINUTE, world.minuteOfDay + 15);
    return {
      nextWorld: {
        ...world,
        minuteOfDay: nextMin,
        inventory: invRes.inventory,
        discoveredItemIds: invRes.discoveredItemIds,
        dailyActivities: { ...da, pondCombedToday: true },
      },
      title: 'Mirror Pond Driftwood Nook',
      body: `While listening to water lap against the driftwood bank, you spotted ${foundDef.label} nestled beside the reeds and tucked it into your satchel (+15m).`,
      gainedItems: [{ itemId: foundId, count: 1 }],
    };
  }

  if (propId === 'gazebo_bell') {
    if (env.bellGleaming) {
      return {
        nextWorld: world,
        title: 'The Restored Gazebo Bell',
        body: 'The polished brass bell gleams under the cedar rafters, its clapper ready. Pull the braided linen rope to chime across Little Somewhere?',
        actionLabel: 'Ring the Brass Bell',
        actionType: 'ring_bell',
      };
    }
    if (env.ivyCleared) {
      return {
        nextWorld: world,
        title: 'Ivy-Cleared Gazebo Spire',
        body: 'Barnaby’s cedar ladder helped clear the creeping ivy from the beams. The brass bell hangs bright and quiet—only its missing clapper and Arthur’s blessing remain.',
      };
    }
    return {
      nextWorld: world,
      title: 'The Silent Gazebo Bell',
      body: 'Thick ivy curls around the cedar rafters, hiding a weathered brass bell overhead. Someone around the square—perhaps Pip, Nora, or Barnaby—knows its story.',
    };
  }

  if (propId === 'fountain_plaza') {
    if (env.fountainFlowing) {
      const wishes = Number(world.sideFlags?.fountainWishesCount ?? 0);
      return {
        nextWorld: world,
        title: 'Sunlit Stone Fountain',
        body:
          wishes > 0
            ? `Clear spring water arcs through all four bronze spouts over the mossy stone tiers. Beneath the ripples glint ${wishes} lucky copper coin${wishes === 1 ? '' : 's'} you tossed.`
            : 'Clear spring water arcs from the bronze crown plume down into the scalloped upper catch-bowl and mossy basin below. Toss a lucky copper coin into the sunlit ripples?',
        actionLabel: 'Toss a Lucky Coin',
        actionType: 'fountain_wish',
      };
    }
    return {
      nextWorld: world,
      title: 'Dry Mossy Fountain',
      body: 'Dry autumn leaves and twigs clog the brass valve and weathered stone basin. Barnaby over at Pinecone Woodshop knows how to clear the old spring line.',
    };
  }

  if (propId === 'mirror_pond') {
    const composed = composeEnvironmentState(world);
    const skips = Number(world.sideFlags?.pondPebblesSkipped ?? 0);
    const season = composed.season.season;
    const phase = composed.timeOfDay.phase;
    const effWeather = composed.weather.effective;
    const atmosphereNote =
      season === 'winter'
        ? 'Thin frost crystals lace the stone shoreline while plump carp glide sluggishly beneath the clear ice-sheen.'
        : effWeather === 'light_rain'
        ? 'Gentle raindrop rings polka-dot the turquoise surface while lily pads bob under the cedar footbridge.'
        : phase === 'dusk' || phase === 'golden'
        ? 'Warm pier and bridge lanterns shimmer across the gentle stream as calico carp weave beneath the blooming water lilies.'
        : 'Bright carp circle smoothly beneath the arched cedar footbridge while dragonflies skim above the blooming lily pads.';
    const countNote =
      skips > 0 ? ` You have skipped ${skips} smooth pebble${skips === 1 ? '' : 's'} here.` : '';
    return {
      nextWorld: world,
      title: 'Mirror Pond & Brook',
      body: `${atmosphereNote}${countNote}`,
      actionLabel: season === 'winter' ? 'Tap the Frosty Edge' : 'Skip a Smooth Pebble',
      actionType: 'skip_stone',
    };
  }

  if (propId === 'hollow_oak') {
    if (world.flags.foundBrassClapper) {
      const tobyHelped = world.memories.some(
        (m) => m.id === 'mem_brass_clapper' && m.residentId === 'toby',
      );
      return {
        nextWorld: world,
        title: 'Hollow Oak Root',
        body: tobyHelped
          ? 'Only warm dry moss and a scrap of blue ribbon remain inside the root hollow where Toby spotted the bell clapper.'
          : 'Only warm dry moss and a scrap of blue linen remain inside the quiet root hollow where you found the bell clapper.',
      };
    }
    if (world.flags.heardBellMystery) {
      const memId = 'mem_brass_clapper';
      const hasMem = world.memories.some((m) => m.id === memId);
      const phase = getTimePhase(world.minuteOfDay);
      const nextMemories = hasMem
        ? world.memories
        : [
            {
              id: memId,
              day: world.day,
              phase,
              title: 'The Hidden Brass Clapper',
              summary:
                'Found the gazebo bell’s polished brass clapper wrapped in blue linen inside the mossy hollow oak roots.',
            },
            ...world.memories,
          ];
      const nextNpcMemories = cloneNpcMemories(world.npcMemories);
      const oakWitnesses = collectWitnessesForPosition(
        world,
        { x: -6.2, z: 15.6 },
        LOCAL_WITNESS_RADIUS,
      );
      const roundedMinute = Math.round(world.minuteOfDay);
      for (const wid of oakWitnesses) {
        recordNpcMemoryInPlace(
          nextNpcMemories,
          wid,
          createNpcMemoryEntry({
            id: 'ev_brass_clapper',
            eventId: 'ev_brass_clapper',
            tag: 'brass_clapper',
            category: 'interaction',
            subjectPlayer: true,
            subjectResidents: [wid],
            provenance: 'firsthand',
            sourceKind: 'witness',
            createdDay: world.day,
            createdMinute: roundedMinute,
            importance: 3,
            retention: 'durable',
            valence: 'warm',
            emotionalWeight: 68,
            detail: { placeName: 'Hollow Oak Root' },
          }),
          world.day,
        );
      }
      return {
        nextWorld: {
          ...world,
          flags: { ...world.flags, foundBrassClapper: true },
          memories: nextMemories,
          npcMemories: nextNpcMemories,
        },
        title: 'A Glint in the Hollow Oak!',
        body: 'Tucked neatly inside a fold of blue linen lies the gazebo bell’s polished brass clapper! Arthur at Copperwheel Cottage will know how to pin it back in place.',
        memoryUnlockedTitle: hasMem ? undefined : 'The Hidden Brass Clapper',
      };
    }
    return {
      nextWorld: world,
      title: 'Hollow Oak by Mirror Pond',
      body: 'Something faintly metallic glints inside the mossy oak roots, though you aren’t sure yet what it belongs to.',
    };
  }

  // plaza_noticeboard (or fallback)
  if (propId === 'plaza_noticeboard') {
    const composed = composeEnvironmentState(world);
    const notes: string[] = [
      `• Tomorrow's Sky (${composed.season.seasonLabel} Day ${composed.season.dayOfSeason}): ${getWeatherLabel(composed.weather.tomorrowForecast)}.`,
      '• Hearth & Crumb: Warm rosemary loaves every morning!',
    ];
    if (world.flags.heardBellMystery) {
      notes.push('• Town Note: Anyone seen Barnaby’s cedar ladder or the gazebo clapper?');
    }
    if (env.fountainFlowing) {
      notes.push('• Plaza Update: Fountain water is flowing clear again!');
    }
    if (env.bellGleaming) {
      notes.push('• Festival Ribbon: The Gazebo Bell chimes daily at dusk!');
    }
    if (env.orchardGatheringOutcome && env.orchardGatheringOutcome !== 'none') {
      notes.push('• Fern Hollow Orchard: Tasting Table open daily under the north lanterns!');
    }
    return {
      nextWorld: world,
      title: 'Neighborhood Noticeboard',
      body: notes.join('  '),
    };
  }

  return {
    nextWorld: world,
    title: 'Willow Lane',
    body: 'Sunlight filters gently across the cobblestones.',
  };
}

export function performRingBellAction(world: WorldState): {
  nextWorld: WorldState;
  toast: string;
  actors: ResidentId[];
} {
  const nextCount = world.bellRungCount + 1;
  const bellPos = { x: 0, z: -9.5 };
  const phase = getTimePhase(world.minuteOfDay);
  const roundedMinute = Math.round(world.minuteOfDay);
  const bellEventId = `bell_${world.day}_${nextCount}`;

  const visualWitnesses = collectWitnessesForPosition(world, bellPos, LOCAL_WITNESS_RADIUS);
  const acousticListeners = collectWitnessesForPosition(world, bellPos, ACOUSTIC_BELL_RADIUS, {
    allowSheltered: true,
    excludeIds: visualWitnesses,
  });
  const actors = [...visualWitnesses, ...acousticListeners];

  const nextEvents = [...(world.worldEvents ?? [])];
  pushWorldEventInPlace(nextEvents, {
    id: bellEventId,
    day: world.day,
    phase,
    minuteOfDay: roundedMinute,
    kind: 'bell_ring',
    actors,
    summary: 'The restored brass Gazebo Bell rang softly across Little Somewhere.',
    summaryTag: 'gazebo_bell_chime',
  });

  const nextNpcMemories = cloneNpcMemories(world.npcMemories);
  for (const wid of visualWitnesses) {
    recordNpcMemoryInPlace(
      nextNpcMemories,
      wid,
      createNpcMemoryEntry({
        id: bellEventId,
        eventId: bellEventId,
        tag: 'bell_ring',
        category: 'event',
        subjectPlayer: true,
        subjectResidents: [wid],
        provenance: 'firsthand',
        sourceKind: 'witness',
        createdDay: world.day,
        createdMinute: roundedMinute,
        importance: 4,
        retention: 'durable',
        valence: 'warm',
        emotionalWeight: 82,
        detail: { placeName: 'Old Bell Gazebo', acousticOnly: false },
      }),
      world.day,
    );
  }
  for (const aid of acousticListeners) {
    recordNpcMemoryInPlace(
      nextNpcMemories,
      aid,
      createNpcMemoryEntry({
        id: bellEventId,
        eventId: bellEventId,
        tag: 'bell_chime',
        category: 'event',
        subjectPlayer: false,
        subjectResidents: [aid],
        provenance: 'firsthand',
        sourceKind: 'witness',
        createdDay: world.day,
        createdMinute: roundedMinute,
        importance: 3,
        retention: 'durable',
        valence: 'warm',
        emotionalWeight: 68,
        detail: { placeName: 'Old Bell Gazebo', acousticOnly: true },
      }),
      world.day,
    );
  }

  return {
    nextWorld: {
      ...world,
      bellRungCount: nextCount,
      worldEvents: nextEvents,
      npcMemories: nextNpcMemories,
    },
    toast: 'The brass bell rings out over the sunlit plaza!',
    actors,
  };
}

export function performFountainWishAction(world: WorldState): {
  nextWorld: WorldState;
  toast: string;
  memoryUnlockedTitle?: string;
} {
  const prevCount = Number(world.sideFlags?.fountainWishesCount ?? 0);
  const nextCount = prevCount + 1;
  const memId = 'mem_fountain_wish';
  const hasMem = world.memories.some((m) => m.id === memId);
  const phase = getTimePhase(world.minuteOfDay);
  const roundedMinute = Math.round(world.minuteOfDay);
  const nextMemories = hasMem
    ? world.memories
    : [
        {
          id: memId,
          day: world.day,
          phase,
          title: 'A Copper Coin in Sunlit Water',
          summary:
            'Dropped a bright copper coin into the restored plaza fountain and watched ripples ring around the stone basin.',
        },
        ...world.memories,
      ];

  const nextNpcMemories = cloneNpcMemories(world.npcMemories);
  const witnesses = collectWitnessesForPosition(world, { x: 0, z: 1.5 }, LOCAL_WITNESS_RADIUS);
  const wishEvId = `ev_fountain_wish_${world.day}_${nextCount}`;
  for (const wid of witnesses) {
    recordNpcMemoryInPlace(
      nextNpcMemories,
      wid,
      createNpcMemoryEntry({
        id: wishEvId,
        eventId: wishEvId,
        tag: 'fountain_wish',
        category: 'event',
        subjectPlayer: true,
        subjectResidents: [wid],
        provenance: 'firsthand',
        sourceKind: 'witness',
        createdDay: world.day,
        createdMinute: roundedMinute,
        importance: 2,
        retention: 'ephemeral',
        valence: 'warm',
        emotionalWeight: 54,
        detail: { placeName: 'Sunlit Fountain Plaza' },
      }),
      world.day,
    );
  }

  return {
    nextWorld: {
      ...world,
      sideFlags: {
        ...(world.sideFlags ?? {}),
        fountainWishesCount: nextCount,
      },
      memories: nextMemories,
      npcMemories: nextNpcMemories,
    },
    toast:
      nextCount === 1
        ? 'Your copper coin chimes softly beneath the fountain’s sunlit ripples!'
        : `Tossed lucky coin #${nextCount} into the shimmering fountain basin.`,
    memoryUnlockedTitle: hasMem ? undefined : 'A Copper Coin in Sunlit Water',
  };
}

export function performPondStoneSkipAction(world: WorldState): {
  nextWorld: WorldState;
  toast: string;
  memoryUnlockedTitle?: string;
  skipsThisThrow: number;
} {
  const prevCount = Number(world.sideFlags?.pondPebblesSkipped ?? 0);
  const nextCount = prevCount + 1;
  const skipsThisThrow = world.season === 'winter' ? 1 : 2 + ((world.day + nextCount) % 4);
  const memId = 'mem_pond_skip';
  const hasMem = world.memories.some((m) => m.id === memId);
  const phase = getTimePhase(world.minuteOfDay);
  const roundedMinute = Math.round(world.minuteOfDay);
  const nextMemories = hasMem
    ? world.memories
    : [
        {
          id: memId,
          day: world.day,
          phase,
          title: 'Circles on Mirror Pond',
          summary:
            'Skipped a flat river stone across Mirror Pond while bright carp darted beneath the arched cedar bridge.',
        },
        ...world.memories,
      ];

  const nextNpcMemories = cloneNpcMemories(world.npcMemories);
  const witnesses = collectWitnessesForPosition(world, { x: 1.6, z: 14.0 }, LOCAL_WITNESS_RADIUS);
  const skipEvId = `ev_pond_skip_${world.day}_${nextCount}`;
  for (const wid of witnesses) {
    recordNpcMemoryInPlace(
      nextNpcMemories,
      wid,
      createNpcMemoryEntry({
        id: skipEvId,
        eventId: skipEvId,
        tag: 'pond_skip',
        category: 'event',
        subjectPlayer: true,
        subjectResidents: [wid],
        provenance: 'firsthand',
        sourceKind: 'witness',
        createdDay: world.day,
        createdMinute: roundedMinute,
        importance: 2,
        retention: 'ephemeral',
        valence: 'warm',
        emotionalWeight: 52,
        detail: { placeName: 'Mirror Pond & Hollow Oak' },
      }),
      world.day,
    );
  }

  return {
    nextWorld: {
      ...world,
      sideFlags: {
        ...(world.sideFlags ?? {}),
        pondPebblesSkipped: nextCount,
      },
      memories: nextMemories,
      npcMemories: nextNpcMemories,
    },
    skipsThisThrow,
    toast:
      world.season === 'winter'
        ? 'Tink! A pebble skates briskly across Mirror Pond’s frosty sheen.'
        : `Plip-plip! Your smooth pebble skipped ${skipsThisThrow} times past the lily pads!`,
    memoryUnlockedTitle: hasMem ? undefined : 'Circles on Mirror Pond',
  };
}

export function performNextDayRest(world: WorldState): WorldState {
  return advanceToNextDay(world);
}

export function enterCottageAction(world: WorldState): { nextWorld: WorldState; toast: string } {
  if (world.playerLocation === 'cottage_interior') {
    return { nextWorld: world, toast: '' };
  }
  let working = world;
  if (working.playerHeldItem && working.worldProps?.[working.playerHeldItem]) {
    working = placeWorldPropAction(working).nextWorld;
  }
  const safeExteriorPos = isPointWalkable(working.playerPos.x, working.playerPos.z, 0.48)
    ? { ...working.playerPos }
    : { ...COTTAGE_PORCH_EXIT_POS };
  return {
    nextWorld: {
      ...working,
      playerLocation: 'cottage_interior',
      exteriorPlayerPos: safeExteriorPos,
      exteriorPlayerFacing: working.playerFacing,
      playerPos: { ...COTTAGE_DOOR_SPAWN },
      playerFacing: COTTAGE_DOOR_DEFAULT_FACING,
      playerPosture: 'standing',
      playerSeatId: null,
    },
    toast: 'Stepped inside Willow Step Cottage.',
  };
}

export function exitCottageAction(world: WorldState): { nextWorld: WorldState; toast: string } {
  if (world.playerLocation !== 'cottage_interior') {
    return { nextWorld: world, toast: '' };
  }
  const exPos = world.exteriorPlayerPos ?? COTTAGE_PORCH_EXIT_POS;
  const safePos = isPointWalkable(exPos.x, exPos.z, 0.48) ? { ...exPos } : { ...PLAYER_SPAWN };
  return {
    nextWorld: {
      ...world,
      playerLocation: 'exterior',
      playerPos: safePos,
      playerFacing: world.exteriorPlayerFacing ?? PLAYER_DEFAULT_FACING,
      playerPosture: 'standing',
      playerSeatId: null,
    },
    toast: 'Stepped out onto Willow Step Porch.',
  };
}

export function enterGreenhouseAction(world: WorldState): { nextWorld: WorldState; toast: string } {
  if (world.playerLocation === 'greenhouse_interior') {
    return { nextWorld: world, toast: '' };
  }
  let working = world;
  if (working.playerHeldItem && working.worldProps?.[working.playerHeldItem]) {
    working = placeWorldPropAction(working).nextWorld;
  }
  const safeExteriorPos = isPointWalkable(working.playerPos.x, working.playerPos.z, 0.48)
    ? { ...working.playerPos }
    : { ...GREENHOUSE_PORCH_EXIT_POS };
  return {
    nextWorld: {
      ...working,
      playerLocation: 'greenhouse_interior',
      exteriorPlayerPos: safeExteriorPos,
      exteriorPlayerFacing: working.playerFacing,
      playerPos: { ...GREENHOUSE_DOOR_SPAWN },
      playerFacing: GREENHOUSE_DOOR_DEFAULT_FACING,
      playerPosture: 'standing',
      playerSeatId: null,
    },
    toast: 'Stepped inside Sunbeam Greenhouse.',
  };
}

export function exitGreenhouseAction(world: WorldState): { nextWorld: WorldState; toast: string } {
  if (world.playerLocation !== 'greenhouse_interior') {
    return { nextWorld: world, toast: '' };
  }
  const exPos = world.exteriorPlayerPos ?? GREENHOUSE_PORCH_EXIT_POS;
  const safePos = isPointWalkable(exPos.x, exPos.z, 0.48) ? { ...exPos } : { ...PLAYER_SPAWN };
  return {
    nextWorld: {
      ...world,
      playerLocation: 'exterior',
      playerPos: safePos,
      playerFacing: world.exteriorPlayerFacing ?? PLAYER_DEFAULT_FACING,
      playerPosture: 'standing',
      playerSeatId: null,
    },
    toast: 'Stepped out beside Sunbeam Greenhouse.',
  };
}

export function interactWithCottageProp(
  world: WorldState,
  cottagePropId: CottageInteractableId,
): PropInteractionResult {
  const cottage = world.cottageState ?? createInitialCottageState();
  const da = world.dailyActivities ?? createInitialDailyActivities();

  if (cottagePropId === 'interior_door') {
    const exited = exitCottageAction(world);
    return {
      nextWorld: exited.nextWorld,
      title: 'Front Porch Door',
      body: 'Stepped back out onto Willow Step Porch.',
      actionType: 'exit_cottage',
    };
  }

  if (cottagePropId === 'cottage_bed') {
    return {
      nextWorld: world,
      title: 'Patchwork Quilt Bed',
      body: `Day ${world.day} settles softly outside your cottage window. Turn in until tomorrow morning? All neighbor friendships, memories, satchel items, and home keepsakes stay safely right here.`,
      actionLabel: 'Rest Until Morning',
      actionType: 'rest_next_day',
    };
  }

  if (cottagePropId === 'cottage_hearth') {
    return {
      nextWorld: world,
      title: 'Copper Kettle & Stone Hearth',
      body: 'Embers crackle warmly inside the hearthstone. Steep honeyed chamomile tea or bake treats with orchard crabapples and fresh herbs from your satchel.',
      actionLabel: 'Open Hearth & Kettle',
      actionType: 'hearth_panel',
    };
  }

  if (cottagePropId === 'cottage_table') {
    return {
      nextWorld: world,
      title: 'Oak Table & Stoneware Vase',
      body: describePlacedFlower(cottage.placedFlowerId),
      actionLabel: 'Arrange Table Vase',
      actionType: 'vase_panel',
    };
  }

  if (cottagePropId === 'cottage_shelf') {
    const count = cottage.displayedKeepsakeIds.length;
    return {
      nextWorld: world,
      title: 'Oak Keepsake Display Shelf',
      body:
        count > 0
          ? `Your sunlit wall shelf currently displays ${count} neighborhood ${count === 1 ? 'keepsake' : 'keepsakes'}.`
          : 'Your carved oak wall shelf has room for cherished keepsakes gifted by close neighbors.',
      actionLabel: 'Arrange Keepsakes',
      actionType: 'shelf_panel',
    };
  }

  if (cottagePropId === 'cottage_desk') {
    const reading = getSeasonalAlmanacReading(world.season, world.day);
    const nextMin = cottage.almanacReadToday
      ? world.minuteOfDay
      : Math.min(DAY_END_MINUTE, world.minuteOfDay + 10);
    return {
      nextWorld: {
        ...world,
        minuteOfDay: nextMin,
        cottageState: {
          ...cottage,
          almanacReadToday: true,
        },
      },
      title: reading.title,
      body: reading.body,
    };
  }

  // cottage_planter
  if (da.cottagePlanterTendedToday) {
    return {
      nextWorld: world,
      title: 'Sunlit Sill Planter',
      body: 'Your indoor sill planter is watered and blooming softly in the afternoon sun.',
    };
  }
  const invRes = addItemToInventory(world.inventory, world.discoveredItemIds, 'chamomile_blossom', 1);
  const nextMin = Math.min(DAY_END_MINUTE, world.minuteOfDay + 10);
  return {
    nextWorld: {
      ...world,
      minuteOfDay: nextMin,
      inventory: invRes.inventory,
      discoveredItemIds: invRes.discoveredItemIds,
      dailyActivities: { ...da, cottagePlanterTendedToday: true },
    },
    title: 'Sunlit Sill Planter',
    body: 'Clipped fresh Chamomile Blossoms from the warm wooden sill box and tucked them into your satchel (+10m).',
    gainedItems: [{ itemId: 'chamomile_blossom', count: 1 }],
  };
}

// ---------------------------------------------------------------------------
// Sunbeam Greenhouse interior stations & the shared growing corner (M3 Build 6, Entry 033)
// ---------------------------------------------------------------------------

function getGreenhouseStateSafe(world: WorldState) {
  return world.greenhouseState ?? createInitialGreenhouseState();
}

function addGreenhouseMemory(
  world: WorldState,
  memId: string,
  title: string,
  summary: string,
): { memories: WorldState['memories']; unlocked: boolean } {
  const phase = getTimePhase(world.minuteOfDay);
  if (world.memories.some((m) => m.id === memId)) {
    return { memories: world.memories, unlocked: false };
  }
  return {
    memories: [{ id: memId, day: world.day, phase, title, summary }, ...world.memories],
    unlocked: true,
  };
}

export function interactWithGreenhouseProp(
  world: WorldState,
  greenhousePropId: GreenhouseInteractableId,
): PropInteractionResult {
  if (greenhousePropId === 'greenhouse_door') {
    const exited = exitGreenhouseAction(world);
    return {
      nextWorld: exited.nextWorld,
      title: 'Glasshouse Door',
      body: 'Warm glass light fades behind you as you step back out beside Sunbeam Greenhouse.',
      actionType: 'exit_greenhouse',
    };
  }

  if (greenhousePropId === 'greenhouse_potting') {
    return {
      nextWorld: world,
      title: 'Potting Bench & Seed Drawers',
      body:
        world.season === 'winter'
          ? 'Mina’s seed drawers are tidy and full, and the bench waits in wintry quiet. Seeds sown now will rest safely until spring wakes the glasshouse.'
          : 'Fir-minster potting soil, folded paper seed pockets, and a row of empty terracotta pots wait on the cedar bench. Choose a seed from your satchel and tuck it into a pot.',
      actionLabel: 'Sow Seeds in a Pot',
      actionType: 'greenhouse_planting_panel',
    };
  }

  if (greenhousePropId === 'greenhouse_shelf') {
    const gh = getGreenhouseStateSafe(world);
    const summary = summarizeGreenhousePlots(gh);
    if (summary.readyPlots > 0) {
      return {
        nextWorld: world,
        title: 'Growing Shelf',
        body: `${summary.readyPlots === 1 ? 'One pot is' : `${summary.readyPlots} pots are`} thriving and ready for a gentle harvest on the sunlit shelf.`,
        actionLabel: 'Harvest Ready Pots',
        actionType: 'greenhouse_harvest_panel',
      };
    }
    const details = gh.plots
      .map((plot, idx) => {
        if (!plot.cropId) return `Pot ${idx + 1} — empty soil, waiting for seeds.`;
        const crop = GREENHOUSE_CROPS.find((c) => c.id === plot.cropId);
        const stageText =
          plot.stage >= 3
            ? 'ready to harvest'
            : plot.stage === 0
            ? 'newly sown'
            : plot.stage === 1
            ? 'a small sprout'
            : 'leafy and growing';
        const thirst = plot.stage < 3 && !plot.wateredToday ? ' · thirsty today' : '';
        return `Pot ${idx + 1} — ${crop?.label ?? 'seedling'}, ${stageText}${thirst}.`;
      })
      .join(' ');
    return {
      nextWorld: world,
      title: 'Growing Shelf',
      body: `Four terracotta pots line the sunlit shelf. ${details || 'All quiet for now.'}`,
    };
  }

  if (greenhousePropId === 'greenhouse_water') {
    return waterGreenhousePlotsAction(world);
  }

  // greenhouse_table — Mina's planting notes & starter seed packet
  return readGreenhouseNotesAction(world);
}

export function waterGreenhousePlotsAction(world: WorldState): PropInteractionResult {
  const gh = getGreenhouseStateSafe(world);
  const thirsty = gh.plots.filter((p) => p.cropId && p.stage < 3 && !p.wateredToday);
  if (thirsty.length === 0) {
    const anyGrowing = gh.plots.some((p) => p.cropId);
    return {
      nextWorld: world,
      title: 'Rain Barrel & Watering Can',
      body: anyGrowing
        ? 'Every growing pot is already watered for the day — the soil sits dark and content, and the copper can rests back on its hook.'
        : 'The rain barrel glimmers with cool water. There are no sown pots to water just yet — Mina’s planting notes by the worktable explain how the shared corner works.',
    };
  }
  const nextMin = Math.min(DAY_END_MINUTE, world.minuteOfDay + GREENHOUSE_WATER_MINUTES);
  const nextWorld: WorldState = {
    ...world,
    minuteOfDay: nextMin,
    greenhouseState: {
      ...gh,
      plots: gh.plots.map((p) =>
        p.cropId && p.stage < 3 ? { ...p, wateredToday: true } : p,
      ),
    },
  };
  return {
    nextWorld,
    title: 'Rain Barrel & Watering Can',
    body: `You tipped the copper watering can along the shelf until every thirsty pot drank its fill (+${GREENHOUSE_WATER_MINUTES}m). Tonight they will grow a little stronger.`,
  };
}

export function plantSeedAtPlotAction(
  world: WorldState,
  seedItemId: 'chamomile_seeds' | 'lavender_seeds' | 'thyme_seeds',
  plotIndex: number,
): { ok: boolean; nextWorld: WorldState; toast: string; memoryUnlockedTitle?: string } {
  if (world.playerLocation !== 'greenhouse_interior') {
    return { ok: false, nextWorld: world, toast: 'The seed drawers live inside Sunbeam Greenhouse.' };
  }
  const gh = getGreenhouseStateSafe(world);
  if (plotIndex < 0 || plotIndex >= gh.plots.length) {
    return { ok: false, nextWorld: world, toast: 'That pot is not on the growing shelf.' };
  }
  const plot = gh.plots[plotIndex];
  if (plot.cropId) {
    return { ok: false, nextWorld: world, toast: 'That pot is already growing something.' };
  }
  const crop = getGreenhouseCropBySeed(seedItemId);
  if (!crop) {
    return { ok: false, nextWorld: world, toast: 'That pocket holds no sowable seeds.' };
  }
  if (getItemCount(world.inventory, seedItemId) < 1) {
    return { ok: false, nextWorld: world, toast: 'No seeds of that kind left in your satchel.' };
  }

  const consumed = consumeItemFromInventory(world.inventory, seedItemId, 1);
  if (!consumed.ok) {
    return { ok: false, nextWorld: world, toast: 'No seeds of that kind left in your satchel.' };
  }

  const nextMin = Math.min(DAY_END_MINUTE, world.minuteOfDay + GREENHOUSE_PLANT_MINUTES);
  const phase = getTimePhase(nextMin);
  const memId = 'mem_greenhouse_first_sow';
  const hasMem = world.memories.some((m) => m.id === memId);
  const nextMemories = hasMem
    ? world.memories
    : [
        {
          id: memId,
          day: world.day,
          phase,
          title: 'Seeds in the Glass Corner',
          summary:
            'Sowed my first seeds in a sunny terracotta pot on the Sunbeam Greenhouse growing shelf — Mina’s shared corner already feels like mine too.',
        },
        ...world.memories,
      ];

  const seedLabel = PERSONAL_ITEM_MAP[seedItemId].label;
  return {
    ok: true,
    nextWorld: {
      ...world,
      minuteOfDay: nextMin,
      inventory: consumed.inventory,
      greenhouseState: {
        ...gh,
        totalPlanted: gh.totalPlanted + 1,
        plots: gh.plots.map((p, idx) =>
          idx === plotIndex
            ? {
                cropId: crop.id,
                plantedDay: world.day,
                nightsGrown: 0,
                stage: 0 as const,
                wateredToday: true,
              }
            : p,
        ),
      },
      sideFlags: {
        ...(world.sideFlags ?? {}),
        greenhousePlanted: true,
      },
      memories: nextMemories,
    },
    toast: `Sowed ${seedLabel} in pot ${plotIndex + 1} (+${GREENHOUSE_PLANT_MINUTES}m). Water it at the rain barrel each day.`,
    memoryUnlockedTitle: hasMem ? undefined : 'Seeds in the Glass Corner',
  };
}

export function harvestPlotAction(
  world: WorldState,
  plotIndex: number,
): {
  ok: boolean;
  nextWorld: WorldState;
  toast: string;
  memoryUnlockedTitle?: string;
  gainedItems?: GainedItemChip[];
} {
  if (world.playerLocation !== 'greenhouse_interior') {
    return { ok: false, nextWorld: world, toast: 'The growing shelf lives inside Sunbeam Greenhouse.' };
  }
  const gh = getGreenhouseStateSafe(world);
  if (plotIndex < 0 || plotIndex >= gh.plots.length) {
    return { ok: false, nextWorld: world, toast: 'That pot is not on the growing shelf.' };
  }
  const plot = gh.plots[plotIndex];
  if (!plot.cropId || plot.stage < 3) {
    return { ok: false, nextWorld: world, toast: 'That pot is still growing — it needs a few more good days.' };
  }
  const crop = getGreenhouseCropBySeedSafe(plot.cropId);
  if (!crop) {
    return { ok: false, nextWorld: world, toast: 'That pot holds an unfamiliar seedling.' };
  }

  let invRes = addItemToInventory(world.inventory, world.discoveredItemIds, crop.cropItemId, crop.harvestCount);
  invRes = addItemToInventory(invRes.inventory, invRes.discoveredItemIds, crop.seedItemId, 1);

  const nextMin = Math.min(DAY_END_MINUTE, world.minuteOfDay + GREENHOUSE_HARVEST_MINUTES);
  const phase = getTimePhase(nextMin);
  const memId = 'mem_greenhouse_first_harvest';
  const hasMem = world.memories.some((m) => m.id === memId);
  const nextMemories = hasMem
    ? world.memories
    : [
        {
          id: memId,
          day: world.day,
          phase,
          title: 'First Glasshouse Harvest',
          summary:
            'Clipped the first greens from my own pot on Mina’s greenhouse shelf — grown from a paper fold of seeds, a kettle of water, and a few patient days.',
        },
        ...world.memories,
      ];

  const cropDef = PERSONAL_ITEM_MAP[crop.cropItemId];
  return {
    ok: true,
    nextWorld: {
      ...world,
      minuteOfDay: nextMin,
      inventory: invRes.inventory,
      discoveredItemIds: invRes.discoveredItemIds,
      greenhouseState: {
        ...gh,
        totalHarvests: gh.totalHarvests + 1,
        plots: gh.plots.map((p, idx) =>
          idx === plotIndex
            ? { cropId: null, plantedDay: 0, nightsGrown: 0, stage: 0 as const, wateredToday: false }
            : p,
        ),
      },
      sideFlags: {
        ...(world.sideFlags ?? {}),
        greenhouseHarvested: true,
      },
      memories: nextMemories,
    },
    toast: `Harvested ${cropDef.label} ×${crop.harvestCount} and kept one seed fold for the next sowing (+${GREENHOUSE_HARVEST_MINUTES}m).`,
    memoryUnlockedTitle: hasMem ? undefined : 'First Glasshouse Harvest',
    gainedItems: [
      { itemId: crop.cropItemId, count: crop.harvestCount },
      { itemId: crop.seedItemId, count: 1 },
    ],
  };
}

function getGreenhouseCropBySeedSafe(cropId: string) {
  return GREENHOUSE_CROPS.find((c) => c.id === cropId) ?? null;
}

export function readGreenhouseNotesAction(world: WorldState): PropInteractionResult {
  const gh = getGreenhouseStateSafe(world);
  if (gh.noteReadDay > 0) {
    return {
      nextWorld: world,
      title: 'Mina’s Worktable & Field Notes',
      body:
        world.season === 'winter'
          ? '“Pots rest through the frost — nothing dies of waiting. Wake them gently with spring water.” The same warm line, still true on every reread.'
          : '“Water each pot once a day; what is watered grows, and what waits simply waits.” Mina’s note still smells faintly of lemon thyme.',
    };
  }

  const firstSeedRes = addItemToInventory(world.inventory, world.discoveredItemIds, 'chamomile_seeds', 1);
  const secondSeedRes = addItemToInventory(firstSeedRes.inventory, firstSeedRes.discoveredItemIds, 'thyme_seeds', 1);
  const nextMin = Math.min(DAY_END_MINUTE, world.minuteOfDay + GREENHOUSE_NOTE_READ_MINUTES);
  const { memories: nextMemories, unlocked } = addGreenhouseMemory(
    { ...world, minuteOfDay: nextMin },
    'mem_greenhouse_note',
    'The Shared Glass Corner',
    'Read Mina’s planting notes inside Sunbeam Greenhouse — she left a welcome packet of chamomile and thyme seeds beside them for whoever tends the shared pots.',
  );

  return {
    nextWorld: {
      ...world,
      minuteOfDay: nextMin,
      inventory: secondSeedRes.inventory,
      discoveredItemIds: secondSeedRes.discoveredItemIds,
      greenhouseState: {
        ...gh,
        noteReadDay: world.day,
      },
      memories: nextMemories,
    },
    title: 'Mina’s Worktable & Field Notes',
    body:
      '“This corner is yours too. Water each pot once a day — what is watered grows, and what waits simply waits. Nothing dies of patience here.” A paper packet of Chamomile and Lemon Thyme seeds is tucked beside the notebook (+8m).',
    memoryUnlockedTitle: unlocked ? 'The Shared Glass Corner' : undefined,
    gainedItems: [
      { itemId: 'chamomile_seeds', count: 1 },
      { itemId: 'thyme_seeds', count: 1 },
    ],
  };
}

export function cookRecipeAction(
  world: WorldState,
  recipeId: string,
): {
  ok: boolean;
  nextWorld: WorldState;
  toast: string;
  memoryUnlockedTitle?: string;
} {
  const recipe = HEARTH_RECIPES.find((r) => r.id === recipeId);
  if (!recipe) {
    return { ok: false, nextWorld: world, toast: 'Unknown hearth recipe.' };
  }
  if (!canCraftRecipe(world.inventory, recipe)) {
    return { ok: false, nextWorld: world, toast: 'Still missing fresh ingredients for that recipe.' };
  }

  let nextInv = { ...(world.inventory ?? {}) };
  for (const ing of recipe.ingredients) {
    const consumed = consumeItemFromInventory(nextInv, ing.itemId, ing.count);
    if (!consumed.ok) {
      return { ok: false, nextWorld: world, toast: 'Missing required ingredient.' };
    }
    nextInv = consumed.inventory;
  }

  const addedRes = addItemToInventory(
    nextInv,
    world.discoveredItemIds,
    recipe.outputItemId,
    recipe.outputCount,
  );
  const outDef = PERSONAL_ITEM_MAP[recipe.outputItemId];
  const cottage = world.cottageState ?? createInitialCottageState();
  const da = world.dailyActivities ?? createInitialDailyActivities();
  const nextMin = Math.min(DAY_END_MINUTE, world.minuteOfDay + recipe.minutesRequired);
  const phase = getTimePhase(nextMin);

  const memId = 'mem_cottage_hearth';
  const hasMem = world.memories.some((m) => m.id === memId);
  const nextMemories = hasMem
    ? world.memories
    : [
        {
          id: memId,
          day: world.day,
          phase,
          title: 'First Hearth Bake at Willow Step',
          summary:
            'Warm gingered steam filled Willow Step Cottage while preparing my first treat at the stone hearth.',
        },
        ...world.memories,
      ];

  return {
    ok: true,
    nextWorld: {
      ...world,
      minuteOfDay: nextMin,
      inventory: addedRes.inventory,
      discoveredItemIds: addedRes.discoveredItemIds,
      cottageState: {
        ...cottage,
        hearthLit: true,
        kettleWarmUntilMinute: Math.min(DAY_END_MINUTE, nextMin + 90),
      },
      dailyActivities: {
        ...da,
        bakedCountToday: da.bakedCountToday + 1,
      },
      memories: nextMemories,
    },
    toast: `Prepared ${outDef.label} at the hearth (+${recipe.minutesRequired}m)!`,
    memoryUnlockedTitle: hasMem ? undefined : 'First Hearth Bake at Willow Step',
  };
}

export function placeFlowerInVaseAction(
  world: WorldState,
  flowerId: PersonalItemId | null,
): { ok: boolean; nextWorld: WorldState; toast: string } {
  const cottage = world.cottageState ?? createInitialCottageState();
  let nextInv = { ...(world.inventory ?? {}) };
  let nextDiscovered = [...(world.discoveredItemIds ?? [])];

  if (flowerId === null) {
    if (!cottage.placedFlowerId) {
      return { ok: false, nextWorld: world, toast: 'Your table vase is already empty.' };
    }
    const prevId = cottage.placedFlowerId;
    const returned = addItemToInventory(nextInv, nextDiscovered, prevId, 1);
    return {
      ok: true,
      nextWorld: {
        ...world,
        inventory: returned.inventory,
        discoveredItemIds: returned.discoveredItemIds,
        cottageState: {
          ...cottage,
          placedFlowerId: null,
        },
      },
      toast: `Returned ${PERSONAL_ITEM_MAP[prevId].label} to your satchel.`,
    };
  }

  if (!COTTAGE_VASE_ITEMS.has(flowerId as NonNullable<WorldState['cottageState']['placedFlowerId']>)) {
    return { ok: false, nextWorld: world, toast: 'That item cannot be arranged in the table vase.' };
  }
  const consumed = consumeItemFromInventory(nextInv, flowerId, 1);
  if (!consumed.ok) {
    return { ok: false, nextWorld: world, toast: 'You do not have that bloom in your satchel.' };
  }
  nextInv = consumed.inventory;

  if (cottage.placedFlowerId) {
    const returned = addItemToInventory(nextInv, nextDiscovered, cottage.placedFlowerId, 1);
    nextInv = returned.inventory;
    nextDiscovered = returned.discoveredItemIds;
  }

  return {
    ok: true,
    nextWorld: {
      ...world,
      inventory: nextInv,
      discoveredItemIds: nextDiscovered,
      cottageState: {
        ...cottage,
        placedFlowerId: flowerId as NonNullable<WorldState['cottageState']['placedFlowerId']>,
      },
    },
    toast: `Arranged ${PERSONAL_ITEM_MAP[flowerId].label} in your cottage vase.`,
  };
}

export function toggleDisplayedKeepsakeAction(
  world: WorldState,
  keepsakeId: PersonalItemId,
): { ok: boolean; nextWorld: WorldState; toast: string } {
  const def = PERSONAL_ITEM_MAP[keepsakeId];
  if (!def || def.homeDisplayable !== 'shelf') {
    return { ok: false, nextWorld: world, toast: 'That item does not fit on the keepsake shelf.' };
  }
  if (getItemCount(world.inventory, keepsakeId) <= 0) {
    return { ok: false, nextWorld: world, toast: 'You have not earned that keepsake yet.' };
  }

  const cottage = world.cottageState ?? createInitialCottageState();
  const current = [...cottage.displayedKeepsakeIds];
  const existsIdx = current.indexOf(keepsakeId);
  if (existsIdx >= 0) {
    current.splice(existsIdx, 1);
    return {
      ok: true,
      nextWorld: {
        ...world,
        cottageState: {
          ...cottage,
          displayedKeepsakeIds: current,
        },
      },
      toast: `Tucked ${def.label} safely back into your chest.`,
    };
  }

  if (current.length >= 5) {
    return { ok: false, nextWorld: world, toast: 'Your oak shelf already holds 5 keepsakes.' };
  }

  current.push(keepsakeId);
  return {
    ok: true,
    nextWorld: {
      ...world,
      cottageState: {
        ...cottage,
        displayedKeepsakeIds: current,
      },
    },
    toast: `Set ${def.label} onto your sunlit oak keepsake shelf.`,
  };
}

function buildGiftReactionLine(
  residentId: ResidentId,
  itemId: PersonalItemId,
  tier: GiftReactionTier,
): string {
  const def = PERSONAL_ITEM_MAP[itemId];
  if (tier === 'loved') {
    switch (residentId) {
      case 'clara':
        return `Oh goodness—${def.label}! Look at the color on that—this makes my whole afternoon shine brighter than the hearth!`;
      case 'arthur':
        return `Ah… ${def.label}. You remembered exactly what steadies an old watchmaker’s hands. Thank you kindly, neighbor.`;
      case 'mina':
        return `Oh!! Fresh ${def.label}! Look how bright the petals still are—wait till you see where I press and keep this!`;
      case 'jun':
        return `No way—${def.label}?! Best stop on my entire Willow Lane mail route today, hands down!`;
      case 'barnaby':
        return `Well now—${def.label}! Now that’s craftsmanship worth pausing a chisel for. Much obliged!`;
      case 'sora':
        return `${def.label}… thank you. Just holding this settles the whole afternoon like a warm resolving chord.`;
      case 'toby':
        return `Whoa—is that really ${def.label} for me?! Look how the light catches it—I’m sketching this right away!`;
      case 'nora':
        return `${def.label}… how remarkably thoughtful of you. I’ll tuck this right beside my favorite bookmark.`;
      case 'pip':
        return `WHOA!! ${def.label}?! Are you serious?! Best neighbor on Willow Lane EVER!`;
      case 'rowan':
        return `Well look at that—${def.label}! Straight from bright mornings into good hands. Thank you kindly, neighbor.`;
    }
  }
  if (tier === 'liked') {
    return `Why thank you! ${def.label} is right up my alley—how kind of you to think of me while out on your walk.`;
  }
  return `Oh, ${def.label}? That’s very thoughtful of you to share, neighbor. Thank you!`;
}

export function giveInventoryItemAction(
  world: WorldState,
  residentId: ResidentId,
  itemId: PersonalItemId,
  session: DialogueSession,
): {
  ok: boolean;
  nextWorld: WorldState;
  nextSession: DialogueSession;
  reactionTier: GiftReactionTier;
  keepsakeAwardedId?: PersonalItemId;
  toast: string;
} {
  const itemDef = PERSONAL_ITEM_MAP[itemId];
  const da = world.dailyActivities ?? createInitialDailyActivities();
  if (!itemDef || !itemDef.giftable) {
    return {
      ok: false,
      nextWorld: world,
      nextSession: session,
      reactionTier: 'neutral',
      toast: 'That keepsake is meant for your cottage shelf.',
    };
  }
  if (da.giftedResidentsToday.includes(residentId)) {
    return {
      ok: false,
      nextWorld: world,
      nextSession: session,
      reactionTier: 'neutral',
      toast: `You already shared a gift with ${RESIDENTS[residentId].name} today.`,
    };
  }

  const consumed = consumeItemFromInventory(world.inventory, itemId, 1);
  if (!consumed.ok) {
    return {
      ok: false,
      nextWorld: world,
      nextSession: session,
      reactionTier: 'neutral',
      toast: 'That item is no longer in your satchel.',
    };
  }

  const reactionTier = getGiftReactionTier(residentId, itemId);
  const phase = getTimePhase(world.minuteOfDay);
  const currentRes = world.residents[residentId];
  const existingRel = world.playerRelations?.[residentId] ?? {
    residentId,
    affinity: currentRes.trust * 20,
    familiarity: currentRes.met ? 10 : 0,
    dailyAffinityGained: 0,
    talkedCount: currentRes.met ? 1 : 0,
    lastTalkDay: null,
    lastTalkPhase: null,
    mood: currentRes.mood,
    moodUntilMinute: 0,
    reliability: 25,
    negativeCount: 0,
    favorsCompleted: 0,
    giftsGiven: 0,
    lastEmotion: 'relaxed' as const,
  };

  const prevTier = getRelationshipTier(existingRel.affinity);
  const prevHearts = getHeartLevel(existingRel.affinity);

  const { relation: nextPlayerRel, progress: nextResidentProg } = recordPlayerTalkAffinity(
    existingRel,
    currentRes,
    {
      day: world.day,
      phase,
      minuteOfDay: world.minuteOfDay,
      requestedTrustDelta: reactionTier === 'loved' ? 1.5 : reactionTier === 'liked' ? 1 : 0,
      requestedReliabilityDelta: reactionTier === 'loved' ? 10 : reactionTier === 'liked' ? 6 : 3,
      isStoryMilestone: false,
      isGift: true,
      nextNodeId: 'gift_reaction',
      forcedEmotion: reactionTier === 'loved' ? 'excited' : reactionTier === 'liked' ? 'happy' : 'relaxed',
    },
  );

  let nextNpcRuntime = world.npcRuntime;
  if (world.npcRuntime?.[residentId]) {
    nextNpcRuntime = {
      ...world.npcRuntime,
      [residentId]: {
        ...world.npcRuntime[residentId],
        emotion: nextPlayerRel.lastEmotion,
        emotionIntensity: reactionTier === 'loved' ? 0.9 : 0.78,
        emotionUntilMinute: world.minuteOfDay + 90,
      },
    };
  }

  let nextInventory = consumed.inventory;
  let nextDiscovered = [...(world.discoveredItemIds ?? [])];
  const nextNeighborGifts = [...(world.neighborGiftsReceived ?? [])];
  let keepsakeAwardedId: PersonalItemId | undefined;
  let keepsakeNote = '';

  const reward = NEIGHBOR_KEEPSAKE_REWARDS.find((r) => r.residentId === residentId);
  if (
    reward &&
    nextPlayerRel.affinity >= reward.minAffinity &&
    !nextNeighborGifts.includes(residentId)
  ) {
    const addedKeepsake = addItemToInventory(nextInventory, nextDiscovered, reward.itemId, 1);
    nextInventory = addedKeepsake.inventory;
    nextDiscovered = addedKeepsake.discoveredItemIds;
    nextNeighborGifts.push(residentId);
    keepsakeAwardedId = reward.itemId;
    keepsakeNote = `  ${reward.note}`;
  }

  const roundedMinute = Math.round(world.minuteOfDay);
  const eventPos = nextNpcRuntime?.[residentId]?.position ?? world.playerPos;
  const placeName = getLandmarkAt(eventPos).name;
  const giftEventId = `gift_${world.day}_${residentId}_${itemId}`;

  const nextEvents = [...(world.worldEvents ?? [])];
  pushWorldEventInPlace(nextEvents, {
    id: giftEventId,
    day: world.day,
    phase,
    minuteOfDay: roundedMinute,
    kind: 'player_help',
    actors: [residentId],
    summary: `Gifted ${itemDef.label} to ${RESIDENTS[residentId].name}.`,
    summaryTag: `gift_${itemId}`,
  });

  const nextNpcMemories = cloneNpcMemories(world.npcMemories);
  recordNpcMemoryInPlace(
    nextNpcMemories,
    residentId,
    createNpcMemoryEntry({
      id: giftEventId,
      eventId: giftEventId,
      tag: 'player_gift',
      category: 'interaction',
      subjectPlayer: true,
      subjectResidents: [residentId],
      provenance: 'firsthand',
      sourceKind: 'participant',
      createdDay: world.day,
      createdMinute: roundedMinute,
      importance: reactionTier === 'loved' ? 4 : 3,
      retention: 'durable',
      valence: 'warm',
      emotionalWeight: reactionTier === 'loved' ? 84 : 70,
      detail: { personalItemId: itemId, placeName },
    }),
    world.day,
  );

  const witnesses = collectWitnessesForPosition(world, eventPos, LOCAL_WITNESS_RADIUS, {
    excludeIds: [residentId],
  });
  for (const wid of witnesses) {
    recordNpcMemoryInPlace(
      nextNpcMemories,
      wid,
      createNpcMemoryEntry({
        id: giftEventId,
        eventId: giftEventId,
        tag: 'player_help_observed',
        category: 'interaction',
        subjectPlayer: true,
        subjectResidents: [residentId],
        provenance: 'firsthand',
        sourceKind: 'witness',
        createdDay: world.day,
        createdMinute: roundedMinute,
        importance: 2,
        retention: 'durable',
        valence: 'warm',
        emotionalWeight: 56,
        detail: { personalItemId: itemId, placeName },
      }),
      world.day,
    );
  }

  const nextTier = getRelationshipTier(nextPlayerRel.affinity);
  const nextHearts = getHeartLevel(nextPlayerRel.affinity);
  const tierAdvanced = TIER_RANK[nextTier] > TIER_RANK[prevTier];
  const heartAdvanced = nextHearts > prevHearts;

  const nextWorld: WorldState = {
    ...world,
    inventory: nextInventory,
    discoveredItemIds: nextDiscovered,
    dailyActivities: {
      ...da,
      giftedResidentsToday: [...da.giftedResidentsToday, residentId],
    },
    neighborGiftsReceived: nextNeighborGifts,
    residents: {
      ...world.residents,
      [residentId]: nextResidentProg,
    },
    playerRelations: {
      ...(world.playerRelations ?? {}),
      [residentId]: nextPlayerRel,
    },
    npcRuntime: nextNpcRuntime,
    worldEvents: nextEvents,
    npcMemories: nextNpcMemories,
  };

  const reactionLine = buildGiftReactionLine(residentId, itemId, reactionTier) + keepsakeNote;
  const giftToast = keepsakeAwardedId
    ? `${RESIDENTS[residentId].name} gave you ${PERSONAL_ITEM_MAP[keepsakeAwardedId].label}!`
    : reactionTier === 'loved'
    ? `${RESIDENTS[residentId].name} loved your ${itemDef.label}!`
    : `Gave ${itemDef.label} to ${RESIDENTS[residentId].name}.`;

  const milestoneLabel = keepsakeAwardedId
    ? `Keepsake received!`
    : tierAdvanced
    ? `New bond: ${getRelationshipTierLabel(nextTier)}`
    : heartAdvanced
    ? 'Friendship deepened!'
    : undefined;

  const nextSession: DialogueSession = {
    ...session,
    tier: nextTier,
    emotion: nextPlayerRel.lastEmotion,
    currentNodeId: 'gift_reaction',
    recentToast: giftToast,
    milestonePulseSeq:
      milestoneLabel !== undefined ? (session.milestonePulseSeq ?? 0) + 1 : session.milestonePulseSeq,
    milestoneLabel,
    nodes: {
      ...session.nodes,
      gift_reaction: {
        id: 'gift_reaction',
        speakerName: RESIDENTS[residentId].name,
        speakerRole: RESIDENTS[residentId].role,
        moodLabel: reactionTier === 'loved' ? 'Delighted' : reactionTier === 'liked' ? 'Warm' : 'Grateful',
        text: reactionLine,
        choices: [],
        isEnd: true,
      },
    },
  };

  return {
    ok: true,
    nextWorld,
    nextSession,
    reactionTier,
    keepsakeAwardedId,
    toast: giftToast,
  };
}
