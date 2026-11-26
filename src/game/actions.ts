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
  FOUNTAIN_CENTER,
  POND_CENTER,
  distance2D,
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
  resolveAnySeatById,
} from './cottage';
import { resolveSeatStandPos, seatLocation } from './walkability';
import { performFishingAction } from './fishing';
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
  isLushStreak,
  summarizeGreenhousePlots,
} from './greenhouse';
import {
  GARDENS,
  getGardenDef,
  getOrCreateGardenState,
  getGardenState,
  sowPlotInPlace,
  harvestPlotInPlace,
  summarizeGarden,
} from './gardens';
import {
  NOOK_BROWSE_MINUTES,
  NOOK_DOOR_DEFAULT_FACING,
  NOOK_DOOR_SPAWN,
  NOOK_NOTES_MINUTES,
  NOOK_PORCH_EXIT_FACING,
  NOOK_PORCH_EXIT_POS,
  NOOK_TEA_ITEM_ID,
  NOOK_TEA_MINUTES,
  createInitialNookState,
  getFeaturedBookForDay,
} from './bookNook';
import {
  BAKERY_BAKES,
  BAKERY_CAFE_STATION_ID,
  BAKERY_CAFE_TABLE_CARD_LABEL,
  BAKERY_CAFE_TABLE_CARD_TITLE,
  BAKERY_CAFE_TABLE_FLAVOR_BODY,
  BAKERY_CAFE_TABLE_FLAVOR_TITLE,
  BAKERY_CHECK_MINUTES,
  BAKERY_DOOR_DEFAULT_FACING,
  BAKERY_DOOR_SPAWN,
  BAKERY_KNEAD_MINUTES,
  BAKERY_NOTES_MINUTES,
  BAKERY_PORCH_EXIT_FACING,
  BAKERY_PORCH_EXIT_POS,
  BAKERY_SHARE_MINUTES,
  createInitialBakeryState,
  getBakeForDay,
} from './bakery';
import {
  HEARTH_RECIPES,
  NEIGHBOR_KEEPSAKE_REWARDS,
  PERSONAL_ITEM_MAP,
  addItemToInventory,
  applyItemGrants,
  canCraftRecipe,
  consumeItemFromInventory,
  getFirstSipableItem,
  getGiftReactionTier,
  getItemCount,
} from './inventory';
import {
  COPPERWHEEL_BENCH_MINUTES,
  COPPERWHEEL_DOOR_DEFAULT_FACING,
  COPPERWHEEL_DOOR_SPAWN,
  COPPERWHEEL_NIGHTSTAND_MINUTES,
  COPPERWHEEL_NOTES_MINUTES,
  COPPERWHEEL_PORCH_EXIT_FACING,
  COPPERWHEEL_PORCH_EXIT_POS,
  COPPERWHEEL_TEA_ITEM_ID,
  COPPERWHEEL_TEA_MINUTES,
  createInitialCopperwheelState,
  getProjectForDay,
} from './copperwheel';
import { DAY_END_MINUTE, EVENING_SLIPPED_NOTE, isDoneToday, spendMinutes } from './time';
import { describeCommunityNoticeboard } from './community';
import { COMMUNITY_PROJECTS, getNextCommunityStageLabel } from './communityProjects';
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
  BakeryInteractableId,
  NookInteractableId,
  CopperwheelInteractableId,
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

import {
  acceptInvitation,
  declineInvitation,
  expireInvitationsAt,
  isHostAvailableForActivity,
  isInvitationLive,
  offerInvitation,
  reconcileInvitedInteriorEntry,
} from './invitations';
import {
  NOOK_CHAIR_STATION_ID,
  clearOccupant,
  isStationOccupied,
  setOccupant,
} from './occupancy';
import {
  completeSharedActivity,
  getSharedActivityDef,
} from './activities';

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
    | 'enter_bakery'
    | 'exit_bakery'
    | 'enter_nook'
    | 'exit_nook'
    | 'enter_copperwheel'
    | 'exit_copperwheel'
    | 'greenhouse_planting_panel'
    | 'greenhouse_harvest_panel'
    | 'garden_panel'
    | 'community_projects_panel'
    | 'share_featured_reading'
    | 'share_morning_pastry';
  memoryUnlockedTitle?: string;
  /** Explicit item-gain readout rendered as chips above the prose (everyday-life polish). */
  gainedItems?: GainedItemChip[];
  /**
   * Optional procedural subject-illustration key (dialogue/assets.ts) — the
   * dialogue sheet renders it in the same visual slot as speaker portraits.
   * Attached by App at the interaction boundary; never persisted.
   */
  subjectImageKey?: string;
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

  // Shared-activity dialogue completion delegates exclusively to completeSharedActivity()
  // so smalltalk caps are never read/mutated and completion remains single-source & idempotent.
  if (choice.completeSharedActivityId) {
    const phaseNow = getTimePhase(world.minuteOfDay);
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
        lastSeenPhase: phaseNow,
        chosenChoiceIds: chosenIds,
      };
      nextLastTopic[residentId] = session.topicId;
    }

    const res = completeSharedActivity(world, choice.completeSharedActivityId);
    const finalWorld: WorldState = res.ok
      ? {
          ...res.world,
          topicHistory: nextTopicHistory,
          lastTopicByResident: nextLastTopic,
          residents: {
            ...res.world.residents,
            [residentId]: {
              ...res.world.residents[residentId],
              met: true,
              talkedToday: true,
              lastDialogueId: choice.nextNodeId,
            },
          },
        }
      : {
          ...world,
          topicHistory: nextTopicHistory,
          lastTopicByResident: nextLastTopic,
        };
    const nextAffinity =
      finalWorld.playerRelations?.[residentId]?.affinity ?? currentRes.trust * 20;
    return {
      nextWorld: finalWorld,
      nextSession: {
        ...session,
        tier: getRelationshipTier(nextAffinity),
        currentNodeId: choice.nextNodeId,
        emotion: finalWorld.npcRuntime?.[residentId]?.emotion ?? session.emotion,
        recentToast: res.toast,
        milestonePulseSeq: res.ok
          ? (session.milestonePulseSeq ?? 0) + 1
          : session.milestonePulseSeq,
        milestoneLabel: res.ok ? 'Shared moment saved!' : undefined,
      },
      memoryUnlockedTitle: res.memoryUnlockedTitle,
    };
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

  let nextWorld: WorldState = {
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

  let invitationToast: string | undefined;
  if (choice.offerInvitation) {
    const offerRes = offerInvitation(
      nextWorld,
      choice.offerInvitation.hostId ?? residentId,
      choice.offerInvitation.activityId,
    );
    if (offerRes.ok) {
      nextWorld = offerRes.world;
    }
  }
  if (choice.acceptInvitation) {
    const accRes = acceptInvitation(nextWorld);
    if (accRes.ok) {
      nextWorld = accRes.world;
      // D6 (doc 05 §4/:901 fix): derive the venue from the host's homeName so
      // the accept toast is venue-true for every host (LR3-87). Nora's string
      // is byte-identical (homeName === 'Linden Book Nook'); Clara's names
      // Hearth & Crumb Bakery instead of lying about a book-nook meeting.
      const activeNow = nextWorld.invitations?.active ?? null;
      const toastHostId = activeNow?.hostId ?? residentId;
      invitationToast = `Invitation accepted — meet ${RESIDENTS[toastHostId].name} inside ${RESIDENTS[toastHostId].homeName ?? 'their home'}.`;
    } else if (accRes.reason === 'invitation_expired') {
      const expRes = expireInvitationsAt(nextWorld, nextWorld.day, nextWorld.minuteOfDay);
      nextWorld = expRes.world;
      invitationToast = expRes.toast;
    }
  }
  if (choice.declineInvitation) {
    const decRes = declineInvitation(nextWorld);
    if (decRes.ok) {
      nextWorld = decRes.world;
      invitationToast = 'Declined warmly for today.';
    }
  }

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
      : invitationToast ?? giftToast ?? tierToast,
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
    // Stand-up relocation uses the seat's OWN interior grid (with a deterministic radial
    // recovery fallback) — the historic cottage-only check left bakery/copperwheel
    // sitters standing inside the chair collision volume with zero free directions.
    const standPos = seat ? resolveSeatStandPos(seat) : null;
    return {
      nextWorld: {
        ...world,
        playerPosture: 'standing',
        playerSeatId: null,
        playerPos: standPos ?? { ...world.playerPos },
      },
      sat: false,
      toast: seat ? `Stood up from ${seat.label}.` : 'Stood up.',
    };
  }

  const seat = resolveAnySeatById(seatId);
  if (!seat) return { nextWorld: world, sat: false };
  // QA-03 (cross-venue sit teleport, categorical fix): a seat belongs to exactly
  // one location grid — indoor seats to their interior, outdoor seats to the
  // overworld. Sitting TELEPORTS the player to the seat's LOCAL coordinates, so
  // a seat from another location must be rejected BEFORE the G-3 range check:
  // its 3.0 m metric is meaningless across coordinate spaces (a nook-local
  // playerPos can sit "within 3 m" of a bakery-local seatPos). Probe P5d repro:
  // from nook_interior, toggling 'bakery_seat_cafe_west' used to teleport
  // playerPos to the bakery-local chair (0.73, 1.45) while playerLocation
  // stayed 'nook_interior' — a cross-grid ghost state. Rejection is silent
  // (same style as G-3): the venue-scoped selector never offers this target,
  // so the reducer guard is defense-in-depth for stale/captured targets.
  if (seatLocation(seat) !== world.playerLocation) {
    return { nextWorld: world, sat: false };
  }
  // Overhaul G-3 (defense-in-depth): sitting TELEPORTS the player, so the
  // reducer re-validates range — a stale/captured target can no longer
  // teleport-sit from across the map. Selector range 2.35 + arrival slack;
  // 3.0 keeps every legitimate flow safe while blocking distant ghosts.
  if (distance2D(world.playerPos, seat.seatPos) > 3.0) {
    return { nextWorld: world, sat: false };
  }
  if (
    seat.id === 'nook_seat_armchair' &&
    isStationOccupied(world, 'nook_interior', NOOK_CHAIR_STATION_ID)
  ) {
    return {
      nextWorld: world,
      sat: false,
      toast: 'Nora is keeping the reading armchair for your shared book session.',
    };
  }
  // LR3-24 (doc 05 §6.4): mirror of the nook suppression — the café chair is
  // refused with a Clara-voiced line while she holds it for the session.
  if (
    seat.id === BAKERY_CAFE_STATION_ID &&
    isStationOccupied(world, 'bakery_interior', BAKERY_CAFE_STATION_ID)
  ) {
    return {
      nextWorld: world,
      sat: false,
      toast: 'Clara is keeping the café corner for your shared pastry.',
    };
  }
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
 * at any indoor seat — the cottage oak stools (Pass 5), the Hearth & Crumb café chair
 * (Build 7), the Linden reading armchair (Build 8), and Copperwheel's window armchair
 * (Build 9). Consumes the item once, spends a few in-game minutes, and records a
 * first-time Pocket Journal memory per drink. Pure reducer — no UI scheduling.
 * (Build 9 fix: the ritual previously hard-gated to cottage_interior, so the Build 7/8
 * indoor seats silently refused the sip their seated prompt advertised.)
 */
export function sipBeverageAtTableAction(
  world: WorldState,
  requestedItemId?: PersonalItemId,
): SipBeverageResult {
  if (world.playerPosture !== 'sitting') {
    return { ok: false, nextWorld: world, title: '', body: '' };
  }
  // Overhaul C-5: the sip ritual works on any seat — outdoor benches included.
  // A brewed drink travels in the satchel; seated sipping is seated sipping.
  const seat = resolveAnySeatById(world.playerSeatId);
  if (!seat) {
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
          summary: `I settled into ${seat.label.toLowerCase()} with a warm ${sip.def.label.toLowerCase()} and let the room be still for a few minutes.`,
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
    title: `Tea at the ${seat.label}`,
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

  if (propId === 'bakery_door') {
    return {
      nextWorld: world,
      title: 'Hearth & Crumb Bakery Door',
      body: 'Warm flour-scented air drifts under the cedar door. Clara’s brick bake oven, service counter, and a quiet café table wait inside.',
      actionLabel: 'Step Inside',
      actionType: 'enter_bakery',
    };
  }

  if (propId === 'nook_door') {
    return {
      nextWorld: world,
      title: 'Linden Book Nook Door',
      body: 'Paper-and-lamp-oil hush drifts under the sage door. Nora’s bookshelf wall, lending desk, reading armchair, and a warm tea tray wait inside.',
      actionLabel: 'Step Inside',
      actionType: 'enter_nook',
    };
  }

  if (propId === 'copperwheel_door') {
    return {
      nextWorld: world,
      title: 'Copperwheel Cottage Door',
      body: 'A warm brass-and-oakwood smell drifts under Arthur’s workshop door. The clockmaker’s bench, mended-pieces shelf, copper kettle, and a deep window armchair wait inside.',
      actionLabel: 'Step Inside',
      actionType: 'enter_copperwheel',
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
    // GA-4 honesty: one grant path — chips reflect only what truly entered the satchel.
    const bonusLavender = world.day % 2 === 0;
    const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [
      { itemId: 'chamomile_blossom', amount: 1 },
      ...(bonusLavender ? [{ itemId: 'lavender_sprig' as const, amount: 1 }] : []),
    ]);
    const spend = spendMinutes(world, 12);
    return {
      nextWorld: {
        ...world,
        minuteOfDay: spend.minuteOfDay,
        inventory: invRes.inventory,
        discoveredItemIds: invRes.discoveredItemIds,
        dailyActivities: { ...da, cottagePlanterTendedToday: true },
      },
      title: 'Porch Herb & Chamomile Box',
      body: bonusLavender
        ? `You brushed morning soil aside and clipped fresh Chamomile Blossoms alongside Sweet Lavender for your satchel (+12m).${spend.eveningSlippedAway ? ` ${EVENING_SLIPPED_NOTE}` : ''}`
        : `Warm sunlight scents the sill as you gather a handful of Chamomile Blossoms for your tea kettle or table vase (+12m).${spend.eveningSlippedAway ? ` ${EVENING_SLIPPED_NOTE}` : ''}`,
      gainedItems: invRes.gainedItems,
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
    // GA-2: the one-time seed sachet — lavender's only legitimate acquisition path.
    // GA-4 honesty: one grant path — chips reflect only what truly entered the satchel.
    const sf = world.sideFlags ?? {};
    const foundLavenderSeeds = !sf.foundLavenderSeeds;
    const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [
      { itemId: 'lemon_thyme', amount: 1 },
      { itemId: 'lavender_sprig', amount: 1 },
      ...(foundLavenderSeeds ? [{ itemId: 'lavender_seeds' as const, amount: 1 }] : []),
    ]);
    const spend = spendMinutes(world, 15);
    return {
      nextWorld: {
        ...world,
        minuteOfDay: spend.minuteOfDay,
        inventory: invRes.inventory,
        discoveredItemIds: invRes.discoveredItemIds,
        dailyActivities: { ...da, greenhousePlantersTendedToday: true },
        sideFlags: foundLavenderSeeds ? { ...sf, foundLavenderSeeds: true } : sf,
      },
      title: 'Sunbeam Herb Planters',
      body: foundLavenderSeeds
        ? 'Mina left snipping shears out by the warm glasshouse trays. Gathered Lemon Thyme Sprig and Sweet Lavender — and found a folded paper sachet of Lavender Seeds tucked between the pots, clearly saved for a neighbor (+15m).'
        : 'Mina left snipping shears out by the warm glasshouse trays. Gathered Lemon Thyme Sprig and Sweet Lavender (+15m).',
      gainedItems: invRes.gainedItems,
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
    const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [
      { itemId: 'crabapple', amount: 2 },
      { itemId: 'wild_honey', amount: 1 },
    ]);
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
    const spend = spendMinutes(world, 20);
    return {
      nextWorld: {
        ...world,
        minuteOfDay: spend.minuteOfDay,
        inventory: invRes.inventory,
        discoveredItemIds: invRes.discoveredItemIds,
        dailyActivities: { ...da, orchardHarvestedToday: true },
        memories: nextMemories,
      },
      title: 'Fern Hollow Harvest Crates',
      body: 'Dappled shade smells of warm apples and clover. Gathered 2 Orchard Crabapples and 1 Orchard Honeycomb into your satchel (+20m).',
      memoryUnlockedTitle: hasMem ? undefined : 'Sunlit Boughs at Fern Hollow',
      gainedItems: invRes.gainedItems,
    };
  }

  // The Wild Hollows (Build 10) — exploration interactions -------------------

  if (propId === 'old_stone_well') {
    const sf = world.sideFlags ?? {};
    const phase = getTimePhase(world.minuteOfDay);
    if (!sf.foundFoxgloveSeeds) {
      const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [
        { itemId: 'foxglove_seeds', amount: 1 },
      ]);
      const memId = 'mem_old_well_seeds';
      const hasMem = world.memories.some((m) => m.id === memId);
      const nextMemories = hasMem
        ? world.memories
        : [
            {
              id: memId,
              day: world.day,
              phase,
              title: 'Seeds of the Forgotten Garden',
              summary:
                'Wedged between the old well\u2019s mossy coping stones lay a mouse-nibbled packet of foxglove seeds — planted by hands this village has long forgotten.',
            },
            ...world.memories,
          ];
      const wellSpend = spendMinutes(world, 8);
      return {
        nextWorld: {
          ...world,
          minuteOfDay: wellSpend.minuteOfDay,
          inventory: invRes.inventory,
          discoveredItemIds: invRes.discoveredItemIds,
          sideFlags: { ...sf, foundFoxgloveSeeds: true },
          memories: nextMemories,
        },
        title: 'Old Stone Well',
        body:
          'Peering in, you count silent ripples below and catch a paper corner in the stonework — a mouse-nibbled seed packet, foxgloves from a garden remembered by no one. You pocket the seeds (+8m). Maybe Mina\u2019s greenhouse could wake them.',
        memoryUnlockedTitle: hasMem ? undefined : 'Seeds of the Forgotten Garden',
        gainedItems: invRes.gainedItems,
      };
    }
    const composed = composeEnvironmentState(world);
    const season = composed.season.season;
    const pebbles = Number(sf.wellPebblesCount ?? 0) + 1;
    const echoLine =
      season === 'winter'
        ? 'A held breath of cold rises back from the dark. The hollow swallows your pebble without an echo.'
        : season === 'autumn'
        ? 'A dry leaf spirals down beside your pebble. The splash comes back small and twice as far away.'
        : 'Your pebble falls, and the hollow answers with one bright ripple of sound, like the well clearing its throat.';
    return {
      nextWorld: {
        ...world,
        minuteOfDay: Math.min(DAY_END_MINUTE, world.minuteOfDay + 4),
        sideFlags: { ...sf, wellPebblesCount: pebbles },
      },
      title: 'Old Stone Well',
      body: `${echoLine} You listen to ${pebbles === 1 ? 'one little splash' : `${pebbles} little splashes`} and wander on (+4m).`,
    };
  }

  if (propId === 'rise_vista') {
    const sf = world.sideFlags ?? {};
    const composed = composeEnvironmentState(world);
    const season = composed.season.season;
    const effWeather = composed.weather.effective;
    const phase = composed.timeOfDay.phase;
    const vistaLine =
      season === 'winter'
        ? 'Snow pools on every rooftop below and the frozen pond glints like a polished mirror.'
        : effWeather === 'misty_morning'
        ? 'The valley below sleeps under silver mist — only the greenhouse roof and the gazebo spire shoulder through.'
        : effWeather === 'light_rain'
        ? 'Rain silvers the pond and beads on the plaza cobbles; the whole valley smells of wet stone and chimney smoke.'
        : phase === 'golden' || phase === 'dusk'
        ? 'Lantern light kindles across the plaza while long shadows pool behind cottage and woodshop alike.'
        : season === 'autumn'
        ? 'The orchard burns copper and gold below; crabapples dot the grass like scattered beads.'
        : 'The pond, the plaza, the gazebo spire, every rooftop and lane — the whole valley reads like a painted map.';
    const memId = 'mem_rise_vista';
    const hasMem = world.memories.some((m) => m.id === memId);
    const nextMemories = hasMem
      ? world.memories
      : [
          {
            id: memId,
            day: world.day,
            phase: getTimePhase(world.minuteOfDay),
            title: 'The Whole Valley From the Rise',
            summary:
              'From the cedar lookout deck on Foxglove Rise I could pick out every place I have come to love — and spot the wild paths still waiting beyond them.',
          },
          ...world.memories,
        ];
    return {
      nextWorld: {
        ...world,
        minuteOfDay: Math.min(DAY_END_MINUTE, world.minuteOfDay + 6),
        memories: nextMemories,
      },
      title: 'Foxglove Rise Panorama',
      body: `${vistaLine} You take the wide view in for a long, unhurried moment (+6m).`,
      memoryUnlockedTitle: hasMem ? undefined : 'The Whole Valley From the Rise',
    };
  }

  if (propId === 'marigold_bank') {
    const sf = world.sideFlags ?? {};
    const phase = getTimePhase(world.minuteOfDay);
    const composed = composeEnvironmentState(world);
    if (Number(sf.posyPickedDay ?? -1) === world.day) {
      return {
        nextWorld: world,
        title: 'Wildflower Bank',
        body:
          'You already tied today\u2019s little nosegay. The rest of the blooms sway on, saving themselves for tomorrow\u2019s passer-by.',
      };
    }
    const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [
      { itemId: 'meadow_posy', amount: 1 },
    ]);
    const memId = 'mem_meadow_posy';
    const hasMem = world.memories.some((m) => m.id === memId);
    const nextMemories = hasMem
      ? world.memories
      : [
          {
            id: memId,
            day: world.day,
            phase,
            title: 'A Posy From the Lane',
            summary:
              'Tied a nosegay of marigold, cornflower and sweet alyssum from the wildflower bank behind the greenhouse.',
          },
          ...world.memories,
        ];
    const posies = Number(sf.meadowPosiesPicked ?? 0) + 1;
    const posySpend = spendMinutes(world, 10);
    return {
      nextWorld: {
        ...world,
        minuteOfDay: posySpend.minuteOfDay,
        inventory: invRes.inventory,
        discoveredItemIds: invRes.discoveredItemIds,
        sideFlags: { ...sf, posyPickedDay: world.day, meadowPosiesPicked: posies },
        memories: nextMemories,
      },
      title: 'Wildflower Bank',
      body: `Marigolds, cornflowers and sweet alyssum crowd the bank. You tie a small nosegay while ${composed.season.season === 'winter' ? 'frost-crisped' : 'bees drowse'} nearby (+10m).`,
      memoryUnlockedTitle: hasMem ? undefined : 'A Posy From the Lane',
      gainedItems: invRes.gainedItems,
    };
  }

  if (propId === 'wild_bee_log') {
    const sf = world.sideFlags ?? {};
    const composed = composeEnvironmentState(world);
    const season = composed.season.season;
    const effWeather = composed.weather.effective;
    const memId = 'mem_bee_log';
    const hasMem = world.memories.some((m) => m.id === memId);
    const phase = getTimePhase(world.minuteOfDay);
    const logLine =
      season === 'winter'
        ? 'The mossy log sleeps under a dusting of snow. Somewhere inside, the wild colony hums low and warm, keeping its winter cluster.'
        : effWeather === 'light_rain'
        ? 'Rain beads on the log\u2019s mossy cap. The bees stay dry within, and the log hums a half-step quieter.'
        : 'Drillings long ago turned this fallen log into a wild hive; foragers zip the clover edge like small ribbed stars, heavy with pollen.';
    const nextMemories = hasMem
      ? world.memories
      : [
          {
            id: memId,
            day: world.day,
            phase,
            title: 'The Wild Hive Log',
            summary:
              'Found the mossy bee log along the clover trail east of the orchard — a wild colony\u2019s front door, older than any skep in the village.',
          },
          ...world.memories,
        ];
    return {
      nextWorld: {
        ...world,
        minuteOfDay: Math.min(DAY_END_MINUTE, world.minuteOfDay + 5),
        memories: nextMemories,
      },
      title: 'Wild Bee Log',
      body: `${logLine} You keep a respectful distance and let them work (+5m).`,
      memoryUnlockedTitle: hasMem ? undefined : 'The Wild Hive Log',
    };
  }

  // WP-4 (Workstream E): the Sorrel Hollow garden bed — the first community project.
  // Three unhurried tending visits persistently transform the hollow; stage state
  // rides sideFlags (sanitizer-safe, zero schema bump) and the registry owns the copy
  // contract. The completed garden is visible world-side via the environment composer.
  if (propId === 'sorrel_garden_bed') {
    const sf = world.sideFlags ?? {};
    const project = COMMUNITY_PROJECTS.find((p) => p.id === 'sorrel_garden')!;
    const stage = Math.min(project.stageCount, Math.floor(Number(sf[project.stageSideFlag] ?? 0)));
    const phase = getTimePhase(world.minuteOfDay);
    const composed = composeEnvironmentState(world);
    const season = composed.season.season;

    if (stage >= project.stageCount) {
      const bloomLine =
        season === 'winter'
          ? 'Frost-crusted seed heads rattle softly over the tilled beds — the garden sleeps, but the garden is here now.'
          : 'Foxglove bells sway between the marigold crowns and the old stone well hums with bees. The forgotten garden is forgotten no more.';
      return {
        nextWorld: world,
        title: 'The Sorrel Hollow Garden',
        body: `${bloomLine} You straighten a crooked marker stone and admire what a few quiet afternoons grew.`,
      };
    }

    const nextStage = stage + 1;
    const stageLine =
      nextStage === 1
        ? season === 'winter'
          ? 'You pry the frost-hardened brambles loose and turn the first dark ribbons of soil. The old bed frames were waiting under the tangle all along.'
          : 'You pry the stubborn brambles loose and turn the first dark ribbons of soil. The old bed frames were waiting under the tangle all along.'
        : nextStage === 2
        ? 'Foxglove seedlings and rows of marigold starts go into the dark soil — the same seeds the old well once slipped into your pocket.'
        : season === 'winter'
        ? 'Winter mulch goes down over the beds to tuck the seedlings in; come spring the hollow will ring with bells and color.'
        : 'The first foxglove bells open between the marigold crowns. Somewhere behind you, a bee already found the way in.';

    const done = nextStage >= project.stageCount;
    const mem = project.completionMemory;
    const hasMem = world.memories.some((m) => m.id === mem.id);
    const nextMemories = done && !hasMem
      ? [
          {
            id: mem.id,
            day: world.day,
            phase,
            title: mem.title,
            summary: mem.summary,
          },
          ...world.memories,
        ]
      : world.memories;
    const stageLabel = getNextCommunityStageLabel('sorrel_garden', stage);

    return {
      nextWorld: {
        ...world,
        minuteOfDay: Math.min(DAY_END_MINUTE, world.minuteOfDay + 8),
        sideFlags: { ...sf, [project.stageSideFlag]: nextStage },
        memories: nextMemories,
      },
      title: 'The Sorrel Hollow Garden',
      body: `${stageLine} ${done ? 'The hollow feels less forgotten now.' : `Today: ${stageLabel}.`} (+8m)`,
      memoryUnlockedTitle: done && !hasMem ? mem.title : undefined,
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
    const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [
      { itemId: foundId, amount: 1 },
    ]);
    const pondSpend = spendMinutes(world, 15);
    return {
      nextWorld: {
        ...world,
        minuteOfDay: pondSpend.minuteOfDay,
        inventory: invRes.inventory,
        discoveredItemIds: invRes.discoveredItemIds,
        dailyActivities: { ...da, pondCombedToday: true },
      },
      title: 'Mirror Pond Driftwood Nook',
      body: `While listening to water lap against the driftwood bank, you spotted ${foundDef.label} nestled beside the reeds and tucked it into your satchel (+15m).`,
      gainedItems: invRes.gainedItems,
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

  // plaza_noticeboard (or fallback) — Everyday Gameplay GA-1: the noticeboard
  // now lists live community shelves and opens the contribution panel.
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
    notes.push(...describeCommunityNoticeboard(world));
    return {
      nextWorld: world,
      title: 'Neighborhood Noticeboard',
      body: notes.join('  '),
      actionLabel: 'Check the Community Shelf',
      actionType: 'community_projects_panel',
    };
  }

  if (propId === 'willow_jetty' || propId === 'west_brook_bank') {
    // Stage 3 (+v1.1): Willow Jetty & West Brook Bank -- one quiet cast a day
    // across both quiet waters (shared day gate). src/game/fishing.ts owns the
    // full contract (guards, grants, memories); this branch is pure dispatch
    // and writes nothing itself. The prop id doubles as the FISHING_SPOTS key.
    return performFishingAction(world, propId);
  }

  // Gardening Expansion — outdoor garden bed interactables.
  if (isGardenBedProp(propId)) {
    return interactWithGardenBed(world, propId);
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

// Overhaul G-12: session-scoped interaction cooldowns (reset on reload by
// design — they exist to stop the per-click spam loop, not to persist).
const WISH_COOLDOWN_MS = 30_000;
let lastFountainWishAt = 0;
let lastStoneSkipAt = 0;

export function performFountainWishAction(world: WorldState): {
  nextWorld: WorldState;
  toast: string;
  memoryUnlockedTitle?: string;
} {
  // Overhaul G-12: session-level spam cooldown — every wish used to increment
  // counters and write a unique-id witness memory until the daily prune.
  if (Date.now() - lastFountainWishAt < WISH_COOLDOWN_MS) {
    return {
      nextWorld: world,
      toast: 'The water is still settling. Give it a moment.',
    };
  }
  lastFountainWishAt = Date.now();
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
  const witnesses = collectWitnessesForPosition(world, FOUNTAIN_CENTER, LOCAL_WITNESS_RADIUS);
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
  // Overhaul G-12: same session-level spam cooldown as fountain wishes.
  if (Date.now() - lastStoneSkipAt < WISH_COOLDOWN_MS) {
    return {
      nextWorld: world,
      toast: 'The pond is still rippling. Wait for a calm stretch.',
      skipsThisThrow: 0,
    };
  }
  lastStoneSkipAt = Date.now();
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
  const witnesses = collectWitnessesForPosition(world, POND_CENTER, LOCAL_WITNESS_RADIUS);
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
    const almanacSpend = cottage.almanacReadToday ? { nextWorld: world } : spendMinutes(world, 10);
    return {
      nextWorld: {
        ...almanacSpend.nextWorld,
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
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [
    { itemId: 'chamomile_blossom', amount: 1 },
  ]);
  const sillSpend = spendMinutes(world, 10);
  return {
    nextWorld: {
      ...world,
      minuteOfDay: sillSpend.minuteOfDay,
      inventory: invRes.inventory,
      discoveredItemIds: invRes.discoveredItemIds,
      dailyActivities: { ...da, cottagePlanterTendedToday: true },
    },
    title: 'Sunlit Sill Planter',
    body: 'Clipped fresh Chamomile Blossoms from the warm wooden sill box and tucked them into your satchel (+10m).',
    gainedItems: invRes.gainedItems,
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
  // GA-2 environment connection: on rain days the rain chain carries the water —
  // watering costs no minutes (the weather does the walking; the care still counts).
  const rainDay = world.weather === 'light_rain';
  const waterSpend = rainDay ? { nextWorld: world, minuteOfDay: world.minuteOfDay, eveningSlippedAway: false } : spendMinutes(world, GREENHOUSE_WATER_MINUTES);
  const nextWorld: WorldState = {
    ...waterSpend.nextWorld,
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
    body: rainDay
      ? 'Rain drums softly on the glass roof and the rain chain does the carrying — every thirsty pot drank its fill without a single trip of the can. Tonight they will grow a little stronger.'
      : `You tipped the copper watering can along the shelf until every thirsty pot drank its fill (+${GREENHOUSE_WATER_MINUTES}m). Tonight they will grow a little stronger.`,
  };
}

export function plantSeedAtPlotAction(
  world: WorldState,
  seedItemId: PersonalItemId,
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
                waterStreak: 0,
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

  // GA-2: steady care is rewarded — a lush harvest when the pot was watered at
  // least LUSH_WATER_STREAK_MIN nights in a row (deterministic, no RNG, no grind:
  // missing a day simply waits instead of punishing).
  const lush = isLushStreak(plot.waterStreak ?? 0);
  const yieldCount = crop.harvestCount + (lush ? 1 : 0);

  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [
    { itemId: crop.cropItemId, amount: yieldCount },
    { itemId: crop.seedItemId, amount: 1 },
  ]);

  const harvestSpend = spendMinutes(world, GREENHOUSE_HARVEST_MINUTES);
  const nextMin = harvestSpend.minuteOfDay;
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
            ? { cropId: null, plantedDay: 0, nightsGrown: 0, stage: 0 as const, wateredToday: false, waterStreak: 0 }
            : p,
        ),
      },
      sideFlags: {
        ...(world.sideFlags ?? {}),
        greenhouseHarvested: true,
      },
      memories: nextMemories,
    },
    toast: lush
      ? `Harvested ${cropDef.label} ×${yieldCount} — especially lush, thanks to your steady care (+${GREENHOUSE_HARVEST_MINUTES}m). Kept one seed fold for the next sowing.`
      : `Harvested ${cropDef.label} ×${yieldCount} and kept one seed fold for the next sowing (+${GREENHOUSE_HARVEST_MINUTES}m).`,
    memoryUnlockedTitle: hasMem ? undefined : 'First Glasshouse Harvest',
    gainedItems: invRes.gainedItems,
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

// ---------------------------------------------------------------------------
// Hearth & Crumb Bakery interior stations (M3 Build 7, WorldState v8)
// ---------------------------------------------------------------------------

function getBakeryStateSafe(world: WorldState) {
  return world.bakeryState ?? createInitialBakeryState();
}

// ── Gardening Expansion — outdoor garden reducers ────────────────────────────

const GARDEN_PLANT_MINUTES = 10;
const GARDEN_WATER_MINUTES = 8;
const GARDEN_HARVEST_MINUTES = 12;

/** All garden bed prop ids mapped to their garden id (derived from the GARDENS registry). */
const GARDEN_PROP_TO_ID: Record<string, string> = GARDENS.reduce(
  (acc, g) => { acc[g.anchorPropId] = g.id; return acc; },
  {} as Record<string, string>,
);

/** Is this prop id a garden bed? */
export function isGardenBedProp(propId: string): boolean {
  return propId in GARDEN_PROP_TO_ID;
}

/** Resolve a garden bed prop id to its garden id. */
export function gardenIdForProp(propId: string): string | null {
  return GARDEN_PROP_TO_ID[propId] ?? null;
}

/**
 * Interact with an outdoor garden bed — opens the garden panel (planting /
 * harvesting / watering interface). Mirrors the greenhouse panel routing but
 * for exterior garden beds.
 */
export function interactWithGardenBed(world: WorldState, propId: string): PropInteractionResult {
  const gardenId = gardenIdForProp(propId);
  if (!gardenId) {
    return { nextWorld: world, title: 'Garden Bed', body: 'This garden bed is not yet ready.' };
  }
  const def = getGardenDef(gardenId);
  if (!def) {
    return { nextWorld: world, title: 'Garden Bed', body: 'This garden bed is not yet ready.' };
  }
  // DEFECT-4 fix: use read-only getGardenState; don't mutate on interaction.
  const state = getGardenState(world, gardenId);
  if (!state) {
    // No state yet — show the "empty garden" introduction without mutating.
    return {
      nextWorld: world,
      title: def.label,
      body: `${def.blurb} ${def.plotCount} empty ${def.plotCount > 1 ? 'plots' : 'plot'} wait${def.plotCount > 1 ? '' : 's'} for seeds.`,
      actionLabel: 'Tend Garden',
      actionType: 'garden_panel',
      subjectImageKey: 'planter_box',
    };
  }
  const summary = summarizeGarden(state);
  const readyPlots = summary.readyPlots;
  const growingPlots = summary.growingPlots;
  const emptyPlots = summary.emptyPlots;
  const thirstyPlots = summary.thirstyPlots;
  let body: string;
  if (emptyPlots > 0 && growingPlots === 0 && readyPlots === 0) {
    body = `${def.blurb} ${emptyPlots} ${emptyPlots > 1 ? 'empty plots' : 'empty plot'} wait${emptyPlots > 1 ? '' : 's'} for seeds.`;
  } else if (readyPlots > 0) {
    body = `${def.blurb} ${readyPlots} plot${readyPlots > 1 ? 's are' : ' is'} ready to harvest${growingPlots > 0 ? `, and ${growingPlots} ${growingPlots > 1 ? 'are' : 'is'} still growing` : ''}.`;
  } else if (thirstyPlots > 0) {
    body = `${def.blurb} ${growingPlots} ${growingPlots > 1 ? 'plots are' : 'plot is'} growing — ${thirstyPlots} ${thirstyPlots > 1 ? 'need' : 'needs'} watering.`;
  } else {
    body = `${def.blurb} ${growingPlots} ${growingPlots > 1 ? 'plots are' : 'plot is'} growing steadily.`;
  }
  return {
    nextWorld: world,
    title: def.label,
    body,
    actionLabel: readyPlots > 0 ? 'Harvest & Tend' : 'Tend Garden',
    actionType: 'garden_panel',
    subjectImageKey: 'planter_box',
  };
}

/**
 * Plant a seed in an outdoor garden plot. Validates garden existence, plot
 * occupancy, crop compatibility, seed ownership, and inventory. Consumes the
 * seed and sets the plot to stage 0 with wateredToday=true (sowing-night
 * watering included, same as greenhouse).
 */
export function plantInGardenAction(
  world: WorldState,
  gardenId: string,
  seedItemId: PersonalItemId,
  plotIndex: number,
): { ok: boolean; nextWorld: WorldState; toast: string; memoryUnlockedTitle?: string } {
  const def = getGardenDef(gardenId);
  if (!def) {
    return { ok: false, nextWorld: world, toast: 'That garden does not exist.' };
  }
  // Ensure exterior location (outdoor beds are exterior props, not interiors).
  if (world.playerLocation !== 'exterior') {
    return { ok: false, nextWorld: world, toast: 'Step outside to tend the garden beds.' };
  }
  // DEFECT-4 fix: validate BEFORE lazy-init so failed actions don't mutate input.
  const crop = getGreenhouseCropBySeed(seedItemId);
  if (!crop) {
    return { ok: false, nextWorld: world, toast: 'That pocket holds no sowable seeds.' };
  }
  // Check crop compatibility with this garden.
  if (def.allowedCropIds && !def.allowedCropIds.includes(crop.id)) {
    return { ok: false, nextWorld: world, toast: `${crop.label} does not suit this garden bed.` };
  }
  if (getItemCount(world.inventory, seedItemId) < 1) {
    return { ok: false, nextWorld: world, toast: 'No seeds of that kind left in your satchel.' };
  }
  // DEFECT-15 fix: validate plotIndex against def.plotCount BEFORE lazy-init
  // so failed actions don't mutate world.gardens.
  if (plotIndex < 0 || plotIndex >= def.plotCount) {
    return { ok: false, nextWorld: world, toast: 'That plot is not in this garden.' };
  }
  // All validation passed — now safe to lazy-init garden state.
  const state = getOrCreateGardenState(world, gardenId);
  if (!state) {
    return { ok: false, nextWorld: world, toast: 'That garden is not yet ready.' };
  }
  if (plotIndex >= state.plots.length) {
    return { ok: false, nextWorld: world, toast: 'That plot is not in this garden.' };
  }
  const plot = state.plots[plotIndex];
  if (plot.cropId) {
    return { ok: false, nextWorld: world, toast: 'That plot is already growing something.' };
  }
  const consumed = consumeItemFromInventory(world.inventory, seedItemId, 1);
  if (!consumed.ok) {
    return { ok: false, nextWorld: world, toast: 'No seeds of that kind left in your satchel.' };
  }
  const nextMin = Math.min(DAY_END_MINUTE, world.minuteOfDay + GARDEN_PLANT_MINUTES);
  const seedLabel = PERSONAL_ITEM_MAP[seedItemId].label;
  // Use the plot primitive from gardens.ts.
  const newPlot = { ...plot };
  sowPlotInPlace(newPlot, crop.id, world.day);
  return {
    ok: true,
    nextWorld: {
      ...world,
      minuteOfDay: nextMin,
      inventory: consumed.inventory,
      gardens: {
        ...world.gardens,
        [gardenId]: {
          ...state,
          totalPlanted: state.totalPlanted + 1,
          lastTendedDay: world.day,
          plots: state.plots.map((p, idx) => (idx === plotIndex ? newPlot : p)),
        },
      },
    },
    toast: `Sowed ${seedLabel} in ${def.label}, plot ${plotIndex + 1} (+${GARDEN_PLANT_MINUTES}m). Water it daily until it ripens.`,
  };
}

/**
 * Water all thirsty growing plots in an outdoor garden. Idempotent per day;
 * rain days cost no minutes. Same lifecycle as greenhouse watering.
 */
export function waterGardenAction(world: WorldState, gardenId: string): PropInteractionResult {
  const def = getGardenDef(gardenId);
  if (!def) {
    return { nextWorld: world, title: 'Garden', body: 'That garden does not exist.' };
  }
  if (world.playerLocation !== 'exterior') {
    return { nextWorld: world, title: def.label, body: 'Step outside to water the garden beds.' };
  }
  // DEFECT-4 fix: use read-only getGardenState first; only create if needed.
  let state = getGardenState(world, gardenId);
  if (!state) {
    // No state = no plots = nothing to water. Return info without mutating.
    return {
      nextWorld: world,
      title: def.label,
      body: 'The soil is bare and waiting. Plant a seed to begin.',
    };
  }
  const thirsty = state.plots.filter((p) => p.cropId && p.stage < 3 && !p.wateredToday);
  if (thirsty.length === 0) {
    const anyGrowing = state.plots.some((p) => p.cropId);
    return {
      nextWorld: world,
      title: def.label,
      body: anyGrowing
        ? 'Every growing plot is already watered for the day — the soil sits dark and content.'
        : 'The soil is bare and waiting. Plant a seed to begin.',
    };
  }
  // Now safe to create the state (validated — thirsty plots exist).
  state = getOrCreateGardenState(world, gardenId) ?? state;
  const rainDay = world.weather === 'light_rain';
  const waterSpend = rainDay
    ? { nextWorld: world, minuteOfDay: world.minuteOfDay, eveningSlippedAway: false }
    : spendMinutes(world, GARDEN_WATER_MINUTES);
  return {
    nextWorld: {
      ...waterSpend.nextWorld,
      gardens: {
        ...world.gardens,
        [gardenId]: {
          ...state,
          lastTendedDay: world.day,
          plots: state.plots.map((p) =>
            p.cropId && p.stage < 3 ? { ...p, wateredToday: true } : p,
          ),
        },
      },
    },
    title: def.label,
    body: rainDay
      ? `The rain chain carried cool water to every thirsty plot — the garden drinks deeply (+0m on a rainy day).`
      : `You tipped the watering can along the beds until every thirsty plot drank its fill (+${GARDEN_WATER_MINUTES}m). Tonight they will grow a little stronger.${waterSpend.eveningSlippedAway ? ` ${EVENING_SLIPPED_NOTE}` : ''}`,
  };
}

/**
 * Harvest a mature plot from an outdoor garden. Grants crop items + a seed
 * return (same sustainable loop as greenhouse). Resets the plot to empty.
 */
export function harvestFromGardenAction(
  world: WorldState,
  gardenId: string,
  plotIndex: number,
): {
  ok: boolean;
  nextWorld: WorldState;
  toast: string;
  memoryUnlockedTitle?: string;
  gainedItems?: GainedItemChip[];
} {
  const def = getGardenDef(gardenId);
  if (!def) {
    return { ok: false, nextWorld: world, toast: 'That garden does not exist.' };
  }
  if (world.playerLocation !== 'exterior') {
    return { ok: false, nextWorld: world, toast: 'Step outside to harvest the garden beds.' };
  }
  // DEFECT-4 fix: use read-only getGardenState; no mutation on failure paths.
  const state = getGardenState(world, gardenId);
  if (!state) {
    return { ok: false, nextWorld: world, toast: 'That garden has nothing growing yet.' };
  }
  if (plotIndex < 0 || plotIndex >= state.plots.length) {
    return { ok: false, nextWorld: world, toast: 'That plot is not in this garden.' };
  }
  const plot = state.plots[plotIndex];
  if (!plot.cropId || plot.stage < 3) {
    return { ok: false, nextWorld: world, toast: 'That plot is still growing — it needs a few more good days.' };
  }
  const crop = GREENHOUSE_CROPS.find((c) => c.id === plot.cropId);
  if (!crop) {
    return { ok: false, nextWorld: world, toast: 'That plot holds an unfamiliar seedling.' };
  }
  const lush = isLushStreak(plot.waterStreak ?? 0);
  const yieldCount = crop.harvestCount + (lush ? 1 : 0);
  const invRes = applyItemGrants(world.inventory, world.discoveredItemIds, [
    { itemId: crop.cropItemId, amount: yieldCount },
    { itemId: crop.seedItemId, amount: 1 },
  ]);
  const harvestSpend = spendMinutes(world, GARDEN_HARVEST_MINUTES);
  const cropDef = PERSONAL_ITEM_MAP[crop.cropItemId];
  // Use the plot primitive.
  const newPlot = { ...plot };
  harvestPlotInPlace(newPlot, crop.harvestCount, lush);
  return {
    ok: true,
    nextWorld: {
      ...world,
      minuteOfDay: harvestSpend.minuteOfDay,
      inventory: invRes.inventory,
      discoveredItemIds: invRes.discoveredItemIds,
      gardens: {
        ...world.gardens,
        [gardenId]: {
          ...state,
          totalHarvests: state.totalHarvests + 1,
          lastTendedDay: world.day,
          plots: state.plots.map((p, idx) => (idx === plotIndex ? newPlot : p)),
        },
      },
    },
    toast: lush
      ? `Harvested ${cropDef.label} ×${yieldCount} from ${def.label} — especially lush, thanks to your steady care (+${GARDEN_HARVEST_MINUTES}m). Kept one seed fold.`
      : `Harvested ${cropDef.label} ×${yieldCount} from ${def.label} and kept one seed fold (+${GARDEN_HARVEST_MINUTES}m).`,
    gainedItems: invRes.gainedItems,
  };
}

function addBakeryMemory(
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

export function enterBakeryAction(world: WorldState): { nextWorld: WorldState; toast: string } {
  if (world.playerLocation === 'bakery_interior') {
    return { nextWorld: world, toast: '' };
  }
  let working = world;
  if (working.playerHeldItem && working.worldProps?.[working.playerHeldItem]) {
    working = placeWorldPropAction(working).nextWorld;
  }
  const safeExteriorPos = isPointWalkable(working.playerPos.x, working.playerPos.z, 0.48)
    ? { ...working.playerPos }
    : { ...BAKERY_PORCH_EXIT_POS };

  // F-ENTER-1 (doc 05 §5.3): reconcile invitation expiry + occupancy claim on
  // room entry through the SHARED helper (nook byte-identical pattern; LR3-13).
  const reconciled = reconcileInvitedInteriorEntry(working, 'bakery_interior');
  working = reconciled.world;

  let toast = 'Stepped inside Hearth & Crumb Bakery.';
  if (reconciled.arrivalToast) {
    toast = `Stepped inside Hearth & Crumb Bakery — ${reconciled.arrivalToast}`;
  } else if (reconciled.expiryToast) {
    toast = `Stepped inside Hearth & Crumb Bakery. ${reconciled.expiryToast}`;
  }

  return {
    nextWorld: {
      ...working,
      playerLocation: 'bakery_interior',
      exteriorPlayerPos: safeExteriorPos,
      exteriorPlayerFacing: working.playerFacing,
      playerPos: { ...BAKERY_DOOR_SPAWN },
      playerFacing: BAKERY_DOOR_DEFAULT_FACING,
      playerPosture: 'standing',
      playerSeatId: null,
    },
    toast,
  };
}

export function exitBakeryAction(world: WorldState): { nextWorld: WorldState; toast: string } {
  if (world.playerLocation !== 'bakery_interior') {
    return { nextWorld: world, toast: '' };
  }
  // LR-3 (doc 05 §5.3): release the café-corner claim on exit, mirroring
  // exitNookAction. The location-guarded clear is a no-op when the occupant
  // belongs to another venue (malformed states stay safe). The invite itself
  // stays accepted+live — re-entry re-places the occupant idempotently (LR3-21).
  const cleared = clearOccupant(world, 'bakery_interior');
  const exPos = cleared.exteriorPlayerPos ?? BAKERY_PORCH_EXIT_POS;
  const safePos = isPointWalkable(exPos.x, exPos.z, 0.48) ? { ...exPos } : { ...PLAYER_SPAWN };
  return {
    nextWorld: {
      ...cleared,
      playerLocation: 'exterior',
      playerPos: safePos,
      playerFacing: cleared.exteriorPlayerFacing ?? PLAYER_DEFAULT_FACING,
      playerPosture: 'standing',
      playerSeatId: null,
      activeActivity: null,
    },
    toast: 'Stepped out beside Hearth & Crumb Bakery.',
  };
}

export function interactWithBakeryProp(
  world: WorldState,
  bakeryPropId: BakeryInteractableId,
): PropInteractionResult {
  if (bakeryPropId === 'bakery_door') {
    const exited = exitBakeryAction(world);
    return {
      nextWorld: exited.nextWorld,
      title: 'Bakery Porch Door',
      body: 'Warm flour-scented air follows you out onto the bakery porch.',
      actionType: 'exit_bakery',
    };
  }

  if (bakeryPropId === 'bakery_oven') {
    return checkMorningBakeAction(world);
  }

  if (bakeryPropId === 'bakery_counter') {
    return shareMorningLoafAction(world);
  }

  if (bakeryPropId === 'bakery_prep') {
    return helpKneadDoughAction(world);
  }

  // LR-3 café-corner card anchor (doc 05 §6.3; pattern: interactWithNookProp
  // nook_chair branch): when the station is claimed by a live accepted pastry
  // invite, the card offers the shared session; otherwise it is flavor.
  if (bakeryPropId === 'bakery_cafe_table') {
    const active = world.invitations?.active;
    if (
      isStationOccupied(world, 'bakery_interior', BAKERY_CAFE_STATION_ID) &&
      active?.status === 'accepted' &&
      active.activityId === 'share_morning_pastry' &&
      isInvitationLive(active, world.day, world.minuteOfDay)
    ) {
      const bake = getBakeForDay(world.day);
      return {
        nextWorld: world,
        title: BAKERY_CAFE_TABLE_CARD_TITLE,
        body: `Clara is holding today’s ${bake.label.toLowerCase()} at the corner with your chair saved across from her. Settle in and keep the slow morning together?`,
        actionLabel: BAKERY_CAFE_TABLE_CARD_LABEL,
        actionType: 'share_morning_pastry',
      };
    }
    return {
      nextWorld: world,
      title: BAKERY_CAFE_TABLE_FLAVOR_TITLE,
      body: BAKERY_CAFE_TABLE_FLAVOR_BODY,
    };
  }

  // bakery_notes
  return readBakeryNotesAction(world);
}

/**
 * LR-3 S3 station exclusivity guard (doc 05 §6.4): while Clara holds the café
 * corner for a live shared-pastry session, the same-day-stamp bakery rituals
 * refuse with a visible card and ZERO mutation (doc 13:91 co-fire hazard;
 * doc 15 §3.2 item 1). Mirror of browseBookshelfAction's refusal shape.
 */
function isBakerySessionClaimingStation(world: WorldState): boolean {
  return (
    isStationOccupied(world, 'bakery_interior', BAKERY_CAFE_STATION_ID) ||
    world.activeActivity?.activityId === 'share_morning_pastry'
  );
}

/** Deterministic daily reveal at the brick dome oven — once per day, +8m. */
export function checkMorningBakeAction(world: WorldState): PropInteractionResult {
  if (isBakerySessionClaimingStation(world)) {
    return {
      nextWorld: world,
      title: 'Brick Dome Bake Oven',
      body: 'Clara is keeping the café corner warm for your shared morning pastry — the oven reveal can wait until the slow morning is done.',
    };
  }
  const bk = getBakeryStateSafe(world);
  const bake = getBakeForDay(world.day);
  const alreadyChecked = bk.bakeCheckedDay === world.day;

  const ovenLead =
    world.season === 'winter'
      ? 'Frost ferns the kitchen window while the old brick dome holds its heat like a patient friend.'
      : 'Morning light falls across the hearthstone while the brick dome breathes gentle warmth into the room.';

  if (alreadyChecked) {
    return {
      nextWorld: world,
      title: 'Brick Dome Bake Oven',
      body: `Today’s bake: ${bake.label}. ${bake.blurb} ${ovenLead}`,
    };
  }

  const nextMin = Math.min(DAY_END_MINUTE, world.minuteOfDay + BAKERY_CHECK_MINUTES);
  const { memories: nextMemories, unlocked } = addBakeryMemory(
    { ...world, minuteOfDay: nextMin },
    'mem_bakery_first_bake',
    'The Morning Bake Reveal',
    'Peeked into Clara’s brick dome oven at Hearth & Crumb — the first look at whatever warm thing the day would be about.',
  );

  return {
    nextWorld: {
      ...world,
      minuteOfDay: nextMin,
      bakeryState: { ...bk, bakeCheckedDay: world.day },
      memories: nextMemories,
    },
    title: 'Brick Dome Bake Oven',
    body: `Today’s bake: ${bake.label}. ${bake.blurb} (+${BAKERY_CHECK_MINUTES}m)`,
    memoryUnlockedTitle: unlocked ? 'The Morning Bake Reveal' : undefined,
  };
}

/**
 * Help Clara knead at the flour-dusted prep table — once per day, +12m.
 * A kneaded morning doubles that day's counter share (Clara splits the batch).
 */
export function helpKneadDoughAction(world: WorldState): PropInteractionResult {
  if (isBakerySessionClaimingStation(world)) {
    return {
      nextWorld: world,
      title: 'Flour-Dusted Prep Table',
      body: 'Clara’s hands are at the café corner today, not the troughs — the dough keeps while you share the morning pastry together.',
    };
  }
  const bk = getBakeryStateSafe(world);
  const alreadyKneaded = bk.kneadedDay === world.day;
  const bake = getBakeForDay(world.day);

  if (alreadyKneaded) {
    return {
      nextWorld: world,
      title: 'Flour-Dusted Prep Table',
      body:
        bake.id === 'oven_rest'
          ? 'The dough troughs are already scraped clean and resting under linen — tomorrow’s batch waits in the cool pantry.'
          : 'The morning’s dough has been folded, turned, and tucked under linen to proof. Clara slides a thimble of honey across the table for the helper.',
    };
  }

  const nextMin = Math.min(DAY_END_MINUTE, world.minuteOfDay + BAKERY_KNEAD_MINUTES);
  const { memories: nextMemories, unlocked } = addBakeryMemory(
    { ...world, minuteOfDay: nextMin },
    'mem_bakery_first_knead',
    'Flour on My Sleeves',
    'Helped Clara knead the morning dough at Hearth & Crumb — warm oven air, soft shoulders, and flour that got everywhere happily.',
  );

  return {
    nextWorld: {
      ...world,
      minuteOfDay: nextMin,
      bakeryState: {
        ...bk,
        kneadedDay: world.day,
        kneadingSessions: bk.kneadingSessions + 1,
      },
      memories: nextMemories,
    },
    title: 'Flour-Dusted Prep Table',
    body: `You spent a slow stretch folding and turning Clara’s ${bake.id === 'oven_rest' ? 'tomorrow’s' : bake.label.toLowerCase()} dough while the oven hummed (+${BAKERY_KNEAD_MINUTES}m).${bake.shareItemId ? ' Clara smiles — she’ll split today’s batch with you at the counter.' : ''}`,
    memoryUnlockedTitle: unlocked ? 'Flour on My Sleeves' : undefined,
  };
}

/**
 * Take the morning bake share at the counter — once per day, +6m. Nothing to take on
 * oven-rest days. Helping knead first doubles the share (the batch is split).
 */
export function shareMorningLoafAction(world: WorldState): PropInteractionResult {
  if (isBakerySessionClaimingStation(world)) {
    return {
      nextWorld: world,
      title: 'Service Counter & Loaf Shelf',
      body: 'The counter share waits — today’s bake is already spoken for at the café corner, where Clara saved you the seat across from her.',
    };
  }
  const bk = getBakeryStateSafe(world);
  const bake = getBakeForDay(world.day);

  if (!bake.shareItemId) {
    return {
      nextWorld: world,
      title: 'Service Counter & Loaf Shelf',
      body: 'The loaf shelf is swept clean today — Clara rests the old dome on day four. She leaves a pot of honey butter out anyway, for whoever wanders in.',
    };
  }

  const alreadyShared = bk.loafSharedDay === world.day;
  if (alreadyShared) {
    return {
      nextWorld: world,
      title: 'Service Counter & Loaf Shelf',
      body: `Today’s ${PERSONAL_ITEM_MAP[bake.shareItemId].label.toLowerCase()} is already wrapped in your satchel. Clara waves — “come back tomorrow, the dome’s already talking about it.”`,
    };
  }

  const kneaded = bk.kneadedDay === world.day;
  const shareCount = kneaded ? 2 : 1;
  const invRes = addItemToInventory(
    world.inventory,
    world.discoveredItemIds,
    bake.shareItemId,
    shareCount,
  );
  const nextMin = Math.min(DAY_END_MINUTE, world.minuteOfDay + BAKERY_SHARE_MINUTES);
  const { memories: nextMemories, unlocked } = addBakeryMemory(
    { ...world, minuteOfDay: nextMin },
    'mem_bakery_first_loaf',
    'A Warm Loaf, Offered',
    'Clara set aside the morning bake for me at Hearth & Crumb — warm paper wrapping, butter-gold crust, and a neighbor’s “see you tomorrow.”',
  );

  const shareDef = PERSONAL_ITEM_MAP[bake.shareItemId];
  const gainedItems: GainedItemChip[] = [{ itemId: bake.shareItemId, count: shareCount }];
  return {
    nextWorld: {
      ...world,
      minuteOfDay: nextMin,
      inventory: invRes.inventory,
      discoveredItemIds: invRes.discoveredItemIds,
      bakeryState: {
        ...bk,
        loafSharedDay: world.day,
        loavesShared: bk.loavesShared + 1,
      },
      memories: nextMemories,
    },
    title: 'Service Counter & Loaf Shelf',
    body: `Clara wraps today’s ${shareDef.label.toLowerCase()} in butter paper${kneaded ? ' and splits the batch you kneaded — two, warm side to warm side' : ''} and slides it across the counter with a nod (+${BAKERY_SHARE_MINUTES}m).`,
    memoryUnlockedTitle: unlocked ? 'A Warm Loaf, Offered' : undefined,
    gainedItems,
  };
}

/** Clara's recipe notes on the east shelf — one-time starter loaf + seasonal rereads, +8m. */
export function readBakeryNotesAction(world: WorldState): PropInteractionResult {
  const bk = getBakeryStateSafe(world);

  if (bk.starterNotesDay > 0) {
    const reread =
      world.season === 'winter'
        ? '“Feed the dome even when it rests — embers remember.” Clara’s winter page smells of cinnamon and woodsmoke.'
        : world.season === 'summer'
        ? '“Cool the stone with the west window open; summer dough rises fast and bright.”'
        : world.season === 'autumn'
        ? '“Crabapple weeks — glaze thick, oven one notch lower, patience doubled.”'
        : '“First warm weeks — split and fold gently; the dough wakes as fast as the primroses.”';
    return {
      nextWorld: world,
      title: 'Clara’s Recipe Notes Shelf',
      body: `${reread} The margins are full of small floury fingerprints.`,
    };
  }

  const invRes = addItemToInventory(world.inventory, world.discoveredItemIds, 'herb_loaf', 1);
  const nextMin = Math.min(DAY_END_MINUTE, world.minuteOfDay + BAKERY_NOTES_MINUTES);
  const { memories: nextMemories, unlocked } = addBakeryMemory(
    { ...world, minuteOfDay: nextMin },
    'mem_bakery_notes',
    'Clara’s Kitchen Margins',
    'Read the flour-fingered recipe notes on Clara’s bakery shelf — she left a starter herb loaf tucked beside them “for the first curious neighbor.”',
  );

  return {
    nextWorld: {
      ...world,
      minuteOfDay: nextMin,
      inventory: invRes.inventory,
      discoveredItemIds: invRes.discoveredItemIds,
      bakeryState: {
        ...bk,
        notesReadDay: world.day,
        starterNotesDay: world.day,
      },
      memories: nextMemories,
    },
    title: 'Clara’s Recipe Notes Shelf',
    body: `Small oilcloth-bound notebooks, margins dusted with flour. “Warm hands make soft bread — take this one for the road.” A starter Herb & Honey Loaf is tucked beside the shelf (+${BAKERY_NOTES_MINUTES}m).`,
    memoryUnlockedTitle: unlocked ? 'Clara’s Kitchen Margins' : undefined,
    gainedItems: [{ itemId: 'herb_loaf', count: 1 }],
  };
}

// ---------------------------------------------------------------------------
// Linden Book Nook interior stations (M3 Build 8, WorldState v9)
// ---------------------------------------------------------------------------

function getNookStateSafe(world: WorldState) {
  return world.nookState ?? createInitialNookState();
}

function addNookMemory(
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

export function enterNookAction(world: WorldState): { nextWorld: WorldState; toast: string } {
  if (world.playerLocation === 'nook_interior') {
    return { nextWorld: world, toast: '' };
  }
  let working = world;
  if (working.playerHeldItem && working.worldProps?.[working.playerHeldItem]) {
    working = placeWorldPropAction(working).nextWorld;
  }
  const safeExteriorPos = isPointWalkable(working.playerPos.x, working.playerPos.z, 0.48)
    ? { ...working.playerPos }
    : { ...NOOK_PORCH_EXIT_POS };

  // F-ENTER-1 (doc 05 §5.3): the enter block is now the SHARED reconciliation
  // helper — observable behavior byte-identical to the historic inline block
  // (pinned unmodified by the LR2/LRTL suites). Nora's arrival line comes from
  // her def verbatim ("... looks up from the reading chair.").
  const reconciled = reconcileInvitedInteriorEntry(working, 'nook_interior');
  working = reconciled.world;

  let toast = 'Stepped inside Linden Book Nook.';
  if (reconciled.arrivalToast) {
    toast = `Stepped inside Linden Book Nook — ${reconciled.arrivalToast}`;
  } else if (reconciled.expiryToast) {
    toast = `Stepped inside Linden Book Nook. ${reconciled.expiryToast}`;
  }

  return {
    nextWorld: {
      ...working,
      playerLocation: 'nook_interior',
      exteriorPlayerPos: safeExteriorPos,
      exteriorPlayerFacing: working.playerFacing,
      playerPos: { ...NOOK_DOOR_SPAWN },
      playerFacing: NOOK_DOOR_DEFAULT_FACING,
      playerPosture: 'standing',
      playerSeatId: null,
    },
    toast,
  };
}

export function exitNookAction(world: WorldState): { nextWorld: WorldState; toast: string } {
  if (world.playerLocation !== 'nook_interior') {
    return { nextWorld: world, toast: '' };
  }
  const cleared = clearOccupant(world, 'nook_interior');
  const exPos = cleared.exteriorPlayerPos ?? NOOK_PORCH_EXIT_POS;
  const safePos = isPointWalkable(exPos.x, exPos.z, 0.48) ? { ...exPos } : { ...PLAYER_SPAWN };
  return {
    nextWorld: {
      ...cleared,
      playerLocation: 'exterior',
      playerPos: safePos,
      playerFacing: cleared.exteriorPlayerFacing ?? PLAYER_DEFAULT_FACING,
      playerPosture: 'standing',
      playerSeatId: null,
      activeActivity: null,
    },
    toast: 'Stepped out beside Linden Book Nook.',
  };
}

export function interactWithNookProp(
  world: WorldState,
  nookPropId: NookInteractableId,
): PropInteractionResult {
  if (nookPropId === 'nook_door') {
    const exited = exitNookAction(world);
    return {
      nextWorld: exited.nextWorld,
      title: 'Book Nook Door',
      body: 'Paper-and-lamp-oil hush follows you out beside the Linden Book Nook.',
      actionType: 'exit_nook',
    };
  }

  if (nookPropId === 'nook_chair') {
    const active = world.invitations?.active;
    if (
      isStationOccupied(world, 'nook_interior', NOOK_CHAIR_STATION_ID) &&
      active?.status === 'accepted' &&
      active.activityId === 'share_featured_reading' &&
      isInvitationLive(active, world.day, world.minuteOfDay)
    ) {
      const book = getFeaturedBookForDay(world.day);
      return {
        nextWorld: world,
        title: 'Reading Armchair — Shared Reading',
        body: `Nora is holding today’s featured copy of ${book.title} by the lamp. Settle in together for your shared reading session?`,
        actionLabel: 'Share Featured Reading',
        actionType: 'share_featured_reading',
      };
    }
    return {
      nextWorld: world,
      title: 'Reading Armchair',
      body: 'A deep lamp-lit armchair beside Nora’s tea console.',
    };
  }

  if (nookPropId === 'nook_shelf') {
    return browseBookshelfAction(world);
  }

  if (nookPropId === 'nook_desk') {
    return readLendingNotesAction(world);
  }

  // nook_tea
  return pourReaderCupAction(world);
}

/**
 * Browse the shelf's featured book (deterministic day cycle) — once per day, +12m.
 * Each book saves its own one-time memory the first time it is settled into.
 */
export function browseBookshelfAction(world: WorldState): PropInteractionResult {
  // Station exclusivity (LR2-06): solo shelf reading cannot run concurrently with
  // Nora holding the reading armchair for an active shared reading session.
  if (
    isStationOccupied(world, 'nook_interior', NOOK_CHAIR_STATION_ID) ||
    world.activeActivity?.activityId === 'share_featured_reading'
  ) {
    return {
      nextWorld: world,
      title: 'Linden Bookshelf Wall',
      body: 'Nora already has today’s featured book open in the reading armchair — speak with her or share the reading session first.',
    };
  }

  const nk = getNookStateSafe(world);
  const book = getFeaturedBookForDay(world.day);
  const alreadyBrowsed = nk.shelfBrowsedDay === world.day;
  const readBefore = world.memories.some((m) => m.id === book.memoryId);

  const shelfLead =
    world.season === 'winter'
      ? 'Frost ferns the window while the shelf holds its warm paper-and-cedar smell.'
      : 'Evening light falls in long stripes across the shelf spines.';

  if (alreadyBrowsed) {
    return {
      nextWorld: world,
      title: 'Linden Bookshelf Wall',
      body: `Today’s featured book is ${book.title}. ${book.blurb} ${shelfLead}`,
    };
  }

  const nextMin = Math.min(DAY_END_MINUTE, world.minuteOfDay + NOOK_BROWSE_MINUTES);
  const { memories: afterBookMemory, unlocked: bookUnlocked } = readBefore
    ? { memories: world.memories, unlocked: false }
    : addNookMemory(
        { ...world, minuteOfDay: nextMin },
        book.memoryId,
        book.memoryTitle,
        book.memorySummary,
      );

  return {
    nextWorld: {
      ...world,
      minuteOfDay: nextMin,
      nookState: {
        ...nk,
        shelfBrowsedDay: world.day,
        booksRead: readBefore ? nk.booksRead : Math.min(4, nk.booksRead + 1),
      },
      memories: afterBookMemory,
    },
    title: 'Linden Bookshelf Wall',
    body: `Today’s featured book is ${book.title}. ${book.blurb} You tuck into the reading chair with it (+${NOOK_BROWSE_MINUTES}m).`,
    memoryUnlockedTitle: bookUnlocked ? book.memoryTitle : undefined,
  };
}

/**
 * Pour a reader's cup at the tea tray — once per day, +6m. Nora keeps the kettle warm
 * for readers; the cup joins your satchel for the reading chair ritual.
 */
export function pourReaderCupAction(world: WorldState): PropInteractionResult {
  const nk = getNookStateSafe(world);
  const alreadyPoured = nk.teaSharedDay === world.day;
  if (alreadyPoured) {
    return {
      nextWorld: world,
      title: 'Reader’s Tea Tray',
      body: 'Your reader’s cup is already poured and waiting in the satchel. Nora nods — “the chair by the window is free.”',
    };
  }

  const invRes = addItemToInventory(world.inventory, world.discoveredItemIds, NOOK_TEA_ITEM_ID, 1);
  const nextMin = Math.min(DAY_END_MINUTE, world.minuteOfDay + NOOK_TEA_MINUTES);
  const { memories: nextMemories, unlocked } = addNookMemory(
    { ...world, minuteOfDay: nextMin },
    'mem_nook_first_tea',
    'A Reader’s Cup',
    'Nora poured a warm chamomile-pear cup at the book nook tea tray — “readers think better holding something warm.”',
  );

  return {
    nextWorld: {
      ...world,
      minuteOfDay: nextMin,
      inventory: invRes.inventory,
      discoveredItemIds: invRes.discoveredItemIds,
      nookState: {
        ...nk,
        teaSharedDay: world.day,
        teasShared: nk.teasShared + 1,
      },
      memories: nextMemories,
    },
    title: 'Reader’s Tea Tray',
    body: `You tip the little kettle over Nora’s stoneware cup — chamomile and pear, warm enough to hold all chapter long (+${NOOK_TEA_MINUTES}m).`,
    memoryUnlockedTitle: unlocked ? 'A Reader’s Cup' : undefined,
    gainedItems: [{ itemId: NOOK_TEA_ITEM_ID, count: 1 }],
  };
}

/** Nora's lending notes at the desk — one-time starter tea + seasonal rereads, +8m. */
export function readLendingNotesAction(world: WorldState): PropInteractionResult {
  const nk = getNookStateSafe(world);

  if (nk.starterTeaDay > 0) {
    const reread =
      world.season === 'winter'
        ? '“Winter readers get the good chair and the whole afternoon.” Nora’s winter page is pinned with a snowdrop.'
        : world.season === 'summer'
        ? '“Prop the door on hot days — the lane likes to listen in.”'
        : world.season === 'autumn'
        ? '“Rainy weeks are for rereading. Bring the book back whenever, or keep it till spring.”'
        : '“New shelves every spring — if a book hums at you, take it home for a week.”';
    return {
      nextWorld: world,
      title: 'Nora’s Lending Desk',
      body: `${reread} The lending ledger’s margins are full of tiny tea rings.`,
    };
  }

  const invRes = addItemToInventory(world.inventory, world.discoveredItemIds, NOOK_TEA_ITEM_ID, 1);
  const nextMin = Math.min(DAY_END_MINUTE, world.minuteOfDay + NOOK_NOTES_MINUTES);
  const { memories: nextMemories, unlocked } = addNookMemory(
    { ...world, minuteOfDay: nextMin },
    'mem_nook_notes',
    'The Lending Ledger',
    'Read Nora’s lending notes at the Linden Book Nook desk — she poured a first cup of chamomile-pear tea “for every new reader.”',
  );

  return {
    nextWorld: {
      ...world,
      minuteOfDay: nextMin,
      inventory: invRes.inventory,
      discoveredItemIds: invRes.discoveredItemIds,
      nookState: {
        ...nk,
        notesReadDay: world.day,
        starterTeaDay: world.day,
      },
      memories: nextMemories,
    },
    title: 'Nora’s Lending Desk',
    body: `An oilcloth ledger of who borrowed what, margins dusted with tea rings. “Welcome, reader — take this warm cup for the chair” (+${NOOK_NOTES_MINUTES}m).`,
    memoryUnlockedTitle: unlocked ? 'The Lending Ledger' : undefined,
    gainedItems: [{ itemId: NOOK_TEA_ITEM_ID, count: 1 }],
  };
}

// ---------------------------------------------------------------------------
// Copperwheel Cottage interior stations (M3 Build 9, WorldState v10)
// ---------------------------------------------------------------------------

function getCopperwheelStateSafe(world: WorldState) {
  return world.copperwheelState ?? createInitialCopperwheelState();
}

function addCopperwheelMemory(
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

export function enterCopperwheelAction(world: WorldState): { nextWorld: WorldState; toast: string } {
  if (world.playerLocation === 'copperwheel_interior') {
    return { nextWorld: world, toast: '' };
  }
  let working = world;
  if (working.playerHeldItem && working.worldProps?.[working.playerHeldItem]) {
    working = placeWorldPropAction(working).nextWorld;
  }
  const safeExteriorPos = isPointWalkable(working.playerPos.x, working.playerPos.z, 0.48)
    ? { ...working.playerPos }
    : { ...COPPERWHEEL_PORCH_EXIT_POS };
  return {
    nextWorld: {
      ...working,
      playerLocation: 'copperwheel_interior',
      exteriorPlayerPos: safeExteriorPos,
      exteriorPlayerFacing: working.playerFacing,
      playerPos: { ...COPPERWHEEL_DOOR_SPAWN },
      playerFacing: COPPERWHEEL_DOOR_DEFAULT_FACING,
      playerPosture: 'standing',
      playerSeatId: null,
    },
    toast: 'Stepped inside Copperwheel Cottage.',
  };
}

export function exitCopperwheelAction(world: WorldState): { nextWorld: WorldState; toast: string } {
  if (world.playerLocation !== 'copperwheel_interior') {
    return { nextWorld: world, toast: '' };
  }
  const exPos = world.exteriorPlayerPos ?? COPPERWHEEL_PORCH_EXIT_POS;
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
    toast: 'Stepped out beside Copperwheel Cottage.',
  };
}

export function interactWithCopperwheelProp(
  world: WorldState,
  copperwheelPropId: CopperwheelInteractableId,
): PropInteractionResult {
  if (copperwheelPropId === 'cw_door') {
    const exited = exitCopperwheelAction(world);
    return {
      nextWorld: exited.nextWorld,
      title: 'Copperwheel Cottage Door',
      body: 'The regulator’s quiet tick follows you out onto the sunlit porch.',
      actionType: 'exit_copperwheel',
    };
  }

  if (copperwheelPropId === 'cw_bench') {
    return checkWorkbenchProjectAction(world);
  }

  if (copperwheelPropId === 'cw_stove') {
    return pourKettleCupAction(world);
  }

  if (copperwheelPropId === 'cw_shelf') {
    return readMendingLedgerAction(world);
  }

  // cw_bed
  return peekNightstandAction(world);
}

/**
 * Check the day's bench project and lend a hand with the fine work — once per day,
 * +10m on working days (winding session counted), +8m when the bench rests. Each
 * project saves its own one-time memory the first time it is admired.
 */
export function checkWorkbenchProjectAction(world: WorldState): PropInteractionResult {
  const cws = getCopperwheelStateSafe(world);
  const project = getProjectForDay(world.day);
  const alreadyChecked = cws.benchCheckedDay === world.day;
  const admiredBefore = world.memories.some((m) => m.id === project.memoryId);

  const benchLead =
    world.season === 'winter'
      ? 'Frost feathers the tall window while the bench lamp makes a small amber island of the felt.'
      : 'Window light falls in long brass-colored stripes across the workbench felt.';

  if (alreadyChecked) {
    return {
      nextWorld: world,
      title: 'Clockmaker’s Workbench',
      body:
        project.id === 'bench_rest'
          ? `The felt stays rolled today — the tools sleep in their oiled drawer. ${benchLead}`
          : `Today’s project: ${project.label}. ${project.blurb} The loupe waits on its hook for tomorrow’s steady hour. ${benchLead}`,
    };
  }

  const isRestDay = project.id === 'bench_rest';
  const nextMin = Math.min(
    DAY_END_MINUTE,
    world.minuteOfDay + (isRestDay ? 8 : COPPERWHEEL_BENCH_MINUTES),
  );
  const { memories: afterProjectMemory, unlocked } = admiredBefore
    ? { memories: world.memories, unlocked: false }
    : addCopperwheelMemory(
        { ...world, minuteOfDay: nextMin },
        project.memoryId,
        project.memoryTitle,
        project.memorySummary,
      );

  return {
    nextWorld: {
      ...world,
      minuteOfDay: nextMin,
      copperwheelState: {
        ...cws,
        benchCheckedDay: world.day,
        helpedDay: isRestDay ? cws.helpedDay : world.day,
        windingSessions: isRestDay ? cws.windingSessions : cws.windingSessions + 1,
        projectsAdmired: admiredBefore
          ? cws.projectsAdmired
          : Math.min(4, cws.projectsAdmired + 1),
      },
      memories: afterProjectMemory,
    },
    title: 'Clockmaker’s Workbench',
    body: isRestDay
      ? `The felt is rolled and the tools sleep in their oiled drawer — Arthur rests the bench on day four. Only the regulator’s tick and the kettle’s whisper keep the room company (+8m). ${benchLead}`
      : `Today’s project: ${project.label}. ${project.blurb} You spend a slow stretch ${project.fineWork} while the regulator keeps count (+${COPPERWHEEL_BENCH_MINUTES}m).`,
    memoryUnlockedTitle: unlocked ? project.memoryTitle : undefined,
  };
}

/**
 * Pour a chamomile cup at the copper kettle — once per day, +6m. Arthur keeps the
 * kettle warm for visitors; the cup joins your satchel for the armchair ritual.
 */
export function pourKettleCupAction(world: WorldState): PropInteractionResult {
  const cws = getCopperwheelStateSafe(world);
  const alreadyPoured = cws.teaSharedDay === world.day;
  if (alreadyPoured) {
    return {
      nextWorld: world,
      title: 'Copper Kettle Stove',
      body: 'Your chamomile cup is already poured and warming the satchel. The kettle keeps its low brass hum, patient as ever.',
    };
  }

  const invRes = addItemToInventory(
    world.inventory,
    world.discoveredItemIds,
    COPPERWHEEL_TEA_ITEM_ID,
    1,
  );
  const nextMin = Math.min(DAY_END_MINUTE, world.minuteOfDay + COPPERWHEEL_TEA_MINUTES);
  const { memories: nextMemories, unlocked } = addCopperwheelMemory(
    { ...world, minuteOfDay: nextMin },
    'mem_cw_first_tea',
    'A Cup at the Copper Kettle',
    'Poured a warm chamomile cup from Arthur’s copper kettle — his favorite thing after escapements, the little brass card by the stove says so.',
  );

  return {
    nextWorld: {
      ...world,
      minuteOfDay: nextMin,
      inventory: invRes.inventory,
      discoveredItemIds: invRes.discoveredItemIds,
      copperwheelState: {
        ...cws,
        teaSharedDay: world.day,
        teasShared: cws.teasShared + 1,
      },
      memories: nextMemories,
    },
    title: 'Copper Kettle Stove',
    body: `You tip the little copper kettle over a stoneware cup — chamomile, warm enough to hold all afternoon (+${COPPERWHEEL_TEA_MINUTES}m). A brass-edged card by the stove reads: “for visitors — take a cup, wind nothing, touch the loupe.”`,
    memoryUnlockedTitle: unlocked ? 'A Cup at the Copper Kettle' : undefined,
    gainedItems: [{ itemId: COPPERWHEEL_TEA_ITEM_ID, count: 1 }],
  };
}

/** Arthur's mending ledger on the shelf — one-time starter tea + seasonal rereads, +8m. */
export function readMendingLedgerAction(world: WorldState): PropInteractionResult {
  const cws = getCopperwheelStateSafe(world);

  if (cws.starterTeaDay > 0) {
    const reread =
      world.season === 'winter'
        ? '“Winter mends slow and sing true — cold brass lies about its fit.”'
        : world.season === 'summer'
        ? '“Oiled everything twice this week; the heat makes the clockworks sleepy.”'
        : world.season === 'autumn'
        ? '“Drafts are hard on pendulums. Wedge the case door before the wind turns.”'
        : '“Spring cleaning the drawers — if something hums, it wants a new mainspring.”';
    return {
      nextWorld: world,
      title: 'Mended Pieces Shelf',
      body: `${reread} The ledger’s margins hold tiny gear sketches and one pressed four-leaf clover, flattened under the sixth entry.`,
    };
  }

  const invRes = addItemToInventory(
    world.inventory,
    world.discoveredItemIds,
    COPPERWHEEL_TEA_ITEM_ID,
    1,
  );
  const nextMin = Math.min(DAY_END_MINUTE, world.minuteOfDay + COPPERWHEEL_NOTES_MINUTES);
  const { memories: nextMemories, unlocked } = addCopperwheelMemory(
    { ...world, minuteOfDay: nextMin },
    'mem_cw_notes',
    'The Mending Ledger',
    'Read Arthur’s mending ledger at Copperwheel Cottage — every fixed clock has a line, and a note by the shelf offers new visitors a warm cup for the armchair.',
  );

  return {
    nextWorld: {
      ...world,
      minuteOfDay: nextMin,
      inventory: invRes.inventory,
      discoveredItemIds: invRes.discoveredItemIds,
      copperwheelState: {
        ...cws,
        notesReadDay: world.day,
        starterTeaDay: world.day,
      },
      memories: nextMemories,
    },
    title: 'Mended Pieces Shelf',
    body: `A cloth-bound ledger of every clock that came back to ticking — entries in careful pencil, successes and stubborn failures alike. “First visit? Take a warm cup to the armchair” (+${COPPERWHEEL_NOTES_MINUTES}m).`,
    memoryUnlockedTitle: unlocked ? 'The Mending Ledger' : undefined,
    gainedItems: [{ itemId: COPPERWHEEL_TEA_ITEM_ID, count: 1 }],
  };
}

/** Peek at the nightstand's regulator watch — cottage-style inspect, +4m, one-time memory. */
export function peekNightstandAction(world: WorldState): PropInteractionResult {
  const nextMin = Math.min(DAY_END_MINUTE, world.minuteOfDay + COPPERWHEEL_NIGHTSTAND_MINUTES);
  const { memories: nextMemories, unlocked } = addCopperwheelMemory(
    { ...world, minuteOfDay: nextMin },
    'mem_cw_nightstand',
    'The Regulator’s Watch',
    'Peeked at the nightstand by Arthur’s bed — a railmen’s regulator watch, stopped at a quarter past four, polished every single day anyway.',
  );

  const detail =
    world.season === 'winter'
      ? 'A knitted cover keeps the quilt’s corner warm; the watch rides on top, gleaming.'
      : 'The quilt is folded to hospital corners, and a small framed photo of a young repair crew leans against the lamp.';

  return {
    nextWorld: {
      ...world,
      minuteOfDay: nextMin,
      memories: nextMemories,
    },
    title: 'Arthur’s Nightstand',
    body: `A railmen’s regulator watch rests on the nightstand, stopped at a quarter past four — it came home that way, and Arthur keeps it polished every morning anyway. ${detail} (+${COPPERWHEEL_NIGHTSTAND_MINUTES}m).`,
    memoryUnlockedTitle: unlocked ? 'The Regulator’s Watch' : undefined,
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

  const addedRes = applyItemGrants(
    nextInv,
    world.discoveredItemIds,
    [{ itemId: recipe.outputItemId, amount: recipe.outputCount }],
  );
  const outDef = PERSONAL_ITEM_MAP[recipe.outputItemId];
  const cottage = world.cottageState ?? createInitialCottageState();
  const da = world.dailyActivities ?? createInitialDailyActivities();
  const spend = spendMinutes(world, recipe.minutesRequired);
  const nextMin = spend.minuteOfDay;
  const phase = getTimePhase(nextMin);
  const overflowNote =
    addedRes.overflowIds.length > 0
      ? ' Your satchel was already full of that treat, so the extras stayed on the hearthstone for later.'
      : '';

  // GA-4 coherence repair: brewing chamomile tea at the hearth finally agrees with
  // the dialogue-side quest gate (flags.brewedChamomileTea was dialogue-only before).
  const nextFlags: WorldState['flags'] =
    recipe.id === 'recipe_chamomile_tea' && !world.flags.brewedChamomileTea
      ? { ...world.flags, brewedChamomileTea: true }
      : world.flags;

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
      flags: nextFlags,
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
    toast: `Prepared ${outDef.label} at the hearth (+${recipe.minutesRequired}m)!${overflowNote}`,
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
