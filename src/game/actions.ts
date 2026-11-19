import {
  computeEnvironmentState,
  isChoiceAvailable,
} from './narrative';
import { getTimePhase } from './residents';
import { advanceToNextDay } from './storage';
import {
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
  actionType?: 'rest_next_day' | 'ring_bell';
}

export function applyDialogueChoice(
  world: WorldState,
  session: DialogueSession,
  choice: DialogueChoice,
): { nextWorld: WorldState; nextSession: DialogueSession; memoryUnlockedTitle?: string } {
  const residentId: ResidentId = session.residentId;
  const currentRes = world.residents[residentId];
  if (!isChoiceAvailable(choice, world.flags, currentRes.trust)) {
    return { nextWorld: world, nextSession: session };
  }

  const nextFlags = choice.setFlags
    ? { ...world.flags, ...choice.setFlags }
    : world.flags;

  const trustGain = choice.trustDelta ?? 0;
  const nextTrust = Math.max(0, Math.min(5, currentRes.trust + trustGain));

  const nextMood =
    nextFlags.claraArthurReconciled && (residentId === 'clara' || residentId === 'arthur')
      ? 'joyful'
      : nextTrust >= 3
      ? 'warm'
      : currentRes.mood;

  const nextResidents = {
    ...world.residents,
    [residentId]: {
      ...currentRes,
      met: true,
      talkedToday: true,
      trust: nextTrust,
      mood: nextMood,
      lastDialogueId: choice.nextNodeId,
    },
  };

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
          phase: getTimePhase(world.minuteOfDay),
        },
        ...world.memories,
      ];
    }
  }

  const nextWorld: WorldState = {
    ...world,
    residents: nextResidents,
    flags: nextFlags,
    memories: nextMemories,
  };

  const nextSession: DialogueSession = {
    ...session,
    currentNodeId: choice.nextNodeId,
    recentToast: memoryUnlockedTitle ? `Memory saved: ${memoryUnlockedTitle}` : undefined,
  };

  return { nextWorld, nextSession, memoryUnlockedTitle };
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
    body: 'Take your time wandering the cobblestones. Meet your neighbors across morning, afternoon, golden hour, and dusk—and check in at your porch door whenever you are ready for tomorrow.',
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
      return {
        nextWorld: { ...world, bellRungCount: world.bellRungCount + 1 },
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
      return {
        nextWorld: world,
        title: 'Sunlit Stone Fountain',
        body: 'Clear spring water arcs softly over the mossy stone basin, cooling the entire plaza while neighbors pass.',
      };
    }
    return {
      nextWorld: world,
      title: 'Dry Mossy Fountain',
      body: 'Autumn leaves clog the central bronze spout. Barnaby over at Pinecone Woodshop probably knows how to clear the valve.',
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
  const notes: string[] = [
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

export function performNextDayRest(world: WorldState): WorldState {
  return advanceToNextDay(world);
}
