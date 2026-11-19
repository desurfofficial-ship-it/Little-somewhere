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
import { getLandmarkAt, getSeatById, isPlayerInCottageInterior, isPointWalkable, resolveMovement } from './worldMap';
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
import {  CarryableItemId,
  DialogueChoice,
  DialogueSession,
  EnvironmentalState,
  PropInteractableId,
  ResidentId,
  WorldState,
} from './types';

export interface PropInteractionResult {
  nextWorld: WorldState;
  title: string;
  body: string;
  actionLabel?: string;
  actionType?: 'rest_next_day' | 'ring_bell' | 'fountain_wish' | 'skip_stone';
  memoryUnlockedTitle?: string;
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
  };

  const giftToast = isGift
    ? `Shared ${world.worldProps?.[choice.deliverHeldItem!]?.label ?? 'item'} with ${RESIDENTS[residentId].name}!`
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
    const seat = getSeatById(world.playerSeatId);
    const standPos =
      seat && isPointWalkable(seat.approachPos.x, seat.approachPos.z, 0.48)
        ? { ...seat.approachPos }
        : { ...world.playerPos };
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

  const seat = getSeatById(seatId);
  if (!seat) return { nextWorld: world, sat: false };
  const occupier = isSeatOccupiedByNpc(world, seat.id);
  if (occupier) {
    return {
      nextWorld: world,
      sat: false,
      toast: `${RESIDENTS[occupier].name} is resting on ${seat.label} right now.`,
    };
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
    toast: `Resting on ${seat.label}.`,
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
  const env: EnvironmentalState = computeEnvironmentState(world.flags);

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
    const inside = isPlayerInCottageInterior(world.playerPos.x, world.playerPos.z);
    return inside
      ? {
          nextWorld: world,
          title: 'Willow Step Cottage Door',
          body: 'The cedar door rests ajar behind you, its brass knob warm from the hearth. Step back onto the porch whenever the lane calls.',
          actionLabel: 'Step Outside',
        }
      : {
          nextWorld: world,
          title: 'Willow Step Cottage Door',
          body: 'The cedar door swings open at your touch, letting out the smell of warm cedar, dried lavender, and this morning’s kettle. Wander in — the hearth is yours.',
          actionLabel: 'Step Inside',
        };
  }

  if (propId === 'player_bed') {
    return {
      nextWorld: world,
      title: 'Willow Quilt Bed',
      body: `Day ${world.day} is winding softly down beyond the shutters. Slip under the moss-green quilt until tomorrow morning? All neighbor friendships, memories, and neighborhood changes will stay just as you shaped them.`,
      actionLabel: 'Rest Until Morning',
      actionType: 'rest_next_day',
    };
  }

  if (propId === 'player_hearth') {
    return {
      nextWorld: world,
      title: 'Cottage Hearth',
      body: 'You cup your palms over the ember bed while the fieldstone breathes out its slow, dry warmth. Somewhere in the flue, a kettle hums a low evening note.',
      actionLabel: 'Warm Hands',
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

  // plaza_noticeboard
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
  return {
    nextWorld: world,
    title: 'Neighborhood Noticeboard',
    body: notes.join('  '),
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
