import {
  computeEnvironmentState,
  isChoiceAvailable,
} from './narrative';
import {
  composeEnvironmentState,
  getWeatherLabel,
} from './environment';
import {
  adjustNpcRelationPair,
  emotionToMood,
  pushWorldEventInPlace,
  reconcileClaraAndArthurRelation,
  recordPlayerTalkAffinity,
} from './relationships';
import { RESIDENTS, getTimePhase } from './residents';
import { advanceToNextDay } from './storage';
import { isSeatOccupiedByNpc } from './playerController';
import { getSeatById, isPointWalkable, resolveMovement } from './worldMap';
import {
  CarryableItemId,
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
    : sf;

  const trustGain = choice.trustDelta ?? 0;
  const isGift = Boolean(choice.deliverHeldItem);
  const isStoryMilestone = Boolean(
    choice.isStoryMilestone || choice.setFlags || choice.setSideFlags || choice.unlockMemory || trustGain >= 2,
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

  const nextEvents = [...(world.worldEvents ?? [])];
  if (choice.setFlags || choice.setSideFlags || isGift) {
    const flagSummary = memoryUnlockedTitle
      ? `${RESIDENTS[residentId].name}: ${memoryUnlockedTitle}`
      : isGift
      ? `Shared ${world.worldProps?.[choice.deliverHeldItem!]?.label ?? 'a keepsake'} with ${RESIDENTS[residentId].name}.`
      : `Shared a meaningful step with ${RESIDENTS[residentId].name}.`;
    pushWorldEventInPlace(nextEvents, {
      id: `story_${world.day}_${choice.id}`,
      day: world.day,
      phase,
      minuteOfDay: Math.round(world.minuteOfDay),
      kind: isGift ? 'player_help' : 'story_flag',
      actors: [residentId],
      summary: flagSummary,
      summaryTag: choice.id,
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
    flags: nextFlags,
    memories: nextMemories,
  };

  const giftToast = isGift
    ? `Shared ${world.worldProps?.[choice.deliverHeldItem!]?.label ?? 'item'} with ${RESIDENTS[residentId].name}!`
    : undefined;

  const nextSession: DialogueSession = {
    ...session,
    currentNodeId: choice.nextNodeId,
    emotion: nextNpcRuntime?.[residentId]?.emotion ?? session.emotion,
    recentToast: memoryUnlockedTitle ? `Memory saved: ${memoryUnlockedTitle}` : giftToast,
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
  const phase = getTimePhase(world.minuteOfDay);

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

  const res = applyDialogueChoice(world, syntheticSession, syntheticChoice);
  // Keep direct delivery compatible with non-quest progress expectations
  const nextWorld = {
    ...res.nextWorld,
    lastTopicByResident: world.lastTopicByResident,
  };
  pushWorldEventInPlace(nextWorld.worldEvents, {
    id: `help_${world.day}_${heldId}_${residentId}`,
    day: world.day,
    phase,
    minuteOfDay: Math.round(world.minuteOfDay),
    kind: 'player_help',
    actors: [residentId],
    summary: `Brought ${prop.label} to ${RESIDENTS[residentId].name}.`,
    summaryTag: `deliver_${heldId}`,
  });

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
    return {
      nextWorld: world,
      title: 'Willow Step Cottage Porch',
      body: `Day ${world.day} is winding softly down outside. Rest inside until tomorrow morning? All neighbor friendships, memories, and neighborhood changes will stay just as you shaped them.`,
      actionLabel: 'Rest Until Morning',
      actionType: 'rest_next_day',
    };
  }

  if (propId === 'gazebo_bell') {
    if (env.bellGleaming) {
      const nextEvents = [...(world.worldEvents ?? [])];
      const phase = getTimePhase(world.minuteOfDay);
      pushWorldEventInPlace(nextEvents, {
        id: `bell_${world.day}_${world.bellRungCount + 1}`,
        day: world.day,
        phase,
        minuteOfDay: Math.round(world.minuteOfDay),
        kind: 'bell_ring',
        actors: ['clara', 'arthur', 'pip'],
        summary: 'The restored brass Gazebo Bell rang softly across Little Somewhere.',
        summaryTag: 'gazebo_bell_chime',
      });
      return {
        nextWorld: { ...world, bellRungCount: world.bellRungCount + 1, worldEvents: nextEvents },
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
      return {
        nextWorld: world,
        title: 'Hollow Oak Root',
        body: 'Only warm dry moss and a scrap of blue ribbon remain inside the root hollow where Toby spotted the bell clapper.',
      };
    }
    if (world.flags.heardBellMystery) {
      return {
        nextWorld: {
          ...world,
          flags: { ...world.flags, foundBrassClapper: true },
        },
        title: 'A Glint in the Hollow Oak!',
        body: 'Tucked neatly inside a fold of blue linen lies the gazebo bell’s polished brass clapper! Arthur at Copperwheel Cottage will know how to pin it back in place.',
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
  return {
    nextWorld: {
      ...world,
      sideFlags: {
        ...(world.sideFlags ?? {}),
        fountainWishesCount: nextCount,
      },
      memories: nextMemories,
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
  return {
    nextWorld: {
      ...world,
      sideFlags: {
        ...(world.sideFlags ?? {}),
        pondPebblesSkipped: nextCount,
      },
      memories: nextMemories,
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
