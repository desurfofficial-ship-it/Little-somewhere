import {
  CharacterEmotion,
  DialogueChoice,
  DialogueNode,
  DialogueSession,
  EnvironmentalState,
  JournalMemory,
  ResidentId,
  SeasonType,
  StoryFlags,
  TimePhase,
  WeatherType,
  WorldState,
} from './types';
import { RESIDENTS } from './residents';
import {
  isChoiceAvailable,
  selectDialogueSession,
} from './dialogueEngine';
import { DIALOGUE_TOPICS } from './dialogue';
import { computeContextBoosts } from './dialogueContext';

export { isChoiceAvailable };

export function createInitialStoryFlags(): StoryFlags {
  return {
    heardBellMystery: false,
    foundPostcard: false,
    deliveredPostcard: false,
    brewedChamomileTea: false,
    borrowedBarnabyLadder: false,
    clearedGazeboIvy: false,
    foundBrassClapper: false,
    repairedFountain: false,
    plantedMoonPetals: false,
    mediationStyle: 'none',
    bellRestored: false,
    claraArthurReconciled: false,
    lanternsLit: false,
  };
}

export function computeEnvironmentState(
  flags: StoryFlags,
  sideFlags?: Record<string, boolean | number | string>,
): EnvironmentalState {
  let planters = 0;
  if (flags.plantedMoonPetals) planters += 1;
  if (flags.repairedFountain) planters += 1;
  if (flags.claraArthurReconciled) planters += 1;

  const orchardGatheringOutcome: EnvironmentalState['orchardGatheringOutcome'] =
    sideFlags?.orchardGatheringComplete
      ? sideFlags.orchardGatheringOutcome === 'blossom_honey_picnic'
        ? 'blossom_honey_picnic'
        : 'spiced_tart_table'
      : 'none';

  return {
    plantersBloomed: planters,
    fountainFlowing: flags.repairedFountain,
    ivyCleared: flags.clearedGazeboIvy,
    bellGleaming: flags.bellRestored,
    // WP-2 (audit-1d): 'festival_ring' — the plaza's lantern-festival mediation — now
    // crowns the square with the festoon string itself, giving the mediation style a
    // world-visible signature instead of rendering identically to 'gentle_truth'.
    // 'gentle_truth' stays intentionally quiet (a private truth needs no set dressing).
    festoonLanterns:
      flags.lanternsLit || flags.bellRestored || flags.mediationStyle === 'festival_ring',
    bakeryTablesOpen: flags.claraArthurReconciled || flags.mediationStyle === 'shared_baking',
    reconciledTogether: flags.claraArthurReconciled,
    noticeboardUpdated:
      flags.heardBellMystery || flags.bellRestored || Boolean(sideFlags?.orchardGatheringComplete),
    orchardGatheringOutcome,
  };
}

export function getResidentAvailableQuestCue(
  id: ResidentId,
  world: WorldState,
): 'story' | 'ready' | 'none' {
  const f = world.flags;
  if (id === 'pip' && !f.heardBellMystery) return 'story';
  if (id === 'nora' && f.heardBellMystery && !f.foundPostcard) return 'story';
  if (id === 'jun' && f.foundPostcard && !f.deliveredPostcard) return 'ready';
  if (id === 'sora' && f.heardBellMystery && !f.brewedChamomileTea) return 'story';
  if (id === 'barnaby' && f.heardBellMystery && !f.borrowedBarnabyLadder) return 'story';
  if (id === 'toby' && f.heardBellMystery && !f.foundBrassClapper) return 'ready';
  if (id === 'mina' && !f.plantedMoonPetals) return 'story';
  if (id === 'arthur' && (f.deliveredPostcard || f.brewedChamomileTea || f.foundBrassClapper) && !f.bellRestored) {
    return 'ready';
  }
  if (id === 'clara' && f.heardBellMystery && !f.claraArthurReconciled) return 'story';

  const orchardProg = world.storylines?.side_orchard_gathering;
  if (orchardProg?.status !== 'completed' && !world.sideFlags?.orchardGatheringComplete) {
    const stage = orchardProg?.stage ?? 0;
    if (id === 'rowan') {
      if (stage === 0) return 'story';
      if (stage === 2) return 'ready';
    }
    if (stage === 1 && (id === 'clara' || id === 'mina')) {
      return 'story';
    }
  }
  return 'none';
}

interface ConcurrentMilestoneDef {
  residentId: ResidentId;
  when: (f: StoryFlags) => boolean;
  choice: {
    id: string;
    label: string;
    tone: DialogueChoice['tone'];
    nextNodeId: string;
    requiresFlag?: keyof StoryFlags;
    requiresFalseFlag?: keyof StoryFlags;
    trustDelta: number;
    setEmotion: CharacterEmotion;
    buildFlags: (f: StoryFlags) => Partial<StoryFlags>;
    unlockMemory: Omit<JournalMemory, 'day' | 'phase'>;
  };
  endNode: {
    id: string;
    moodLabel: string;
    text: string;
  };
}

const CONCURRENT_QUEST_MILESTONES: readonly ConcurrentMilestoneDef[] = [
  {
    residentId: 'barnaby',
    when: (f) => f.heardBellMystery && !f.borrowedBarnabyLadder,
    choice: {
      id: 'barnaby_ladder',
      label: 'Could I borrow your cedar ladder to clear the gazebo ivy?',
      tone: 'practical',
      nextNodeId: 'barnaby_lend',
      requiresFlag: 'heardBellMystery',
      requiresFalseFlag: 'borrowedBarnabyLadder',
      trustDelta: 1,
      setEmotion: 'happy',
      buildFlags: () => ({ borrowedBarnabyLadder: true, clearedGazeboIvy: true }),
      unlockMemory: {
        id: 'mem_gazebo_cleared',
        title: 'Sunlit Rafters',
        summary: 'Barnaby lent his cedar ladder and we gently cleared the creeping ivy off the gazebo bell beam.',
        residentId: 'barnaby',
      },
    },
    endNode: {
      id: 'barnaby_lend',
      moodLabel: 'Pleased',
      text: 'Hah! I was hoping someone would ask. Let’s haul it up right now—there, the ivy is tucked along the posts and the brass bell frame is clear in the sun again.',
    },
  },
  {
    residentId: 'barnaby',
    when: (f) => !f.repairedFountain,
    choice: {
      id: 'barnaby_fountain',
      label: 'Do you know why the plaza stone fountain stopped running?',
      tone: 'curious',
      nextNodeId: 'barnaby_valve',
      requiresFalseFlag: 'repairedFountain',
      trustDelta: 1,
      setEmotion: 'happy',
      buildFlags: () => ({ repairedFountain: true }),
      unlockMemory: {
        id: 'mem_fountain_fixed',
        title: 'Water in the Plaza',
        summary: 'With Barnaby’s brass wrench tip, the mossy stone fountain in the center square flows once more.',
        residentId: 'barnaby',
      },
    },
    endNode: {
      id: 'barnaby_valve',
      moodLabel: 'Helpful',
      text: 'Just an autumn leaf caught in the brass intake! Let me tap it loose for you—listen, water’s already bubbling back into the plaza basin.',
    },
  },
  {
    residentId: 'mina',
    when: (f) => !f.plantedMoonPetals,
    choice: {
      id: 'mina_plant',
      label: 'Let’s plant moon-petals in the plaza window boxes!',
      tone: 'warm',
      nextNodeId: 'mina_planted',
      requiresFalseFlag: 'plantedMoonPetals',
      trustDelta: 1,
      setEmotion: 'excited',
      buildFlags: () => ({ plantedMoonPetals: true }),
      unlockMemory: {
        id: 'mem_moon_petals',
        title: 'Moon-Petals on the Sill',
        summary: 'Mina and I tucked fresh moon-petal seedlings into the neighborhood planter boxes.',
        residentId: 'mina',
      },
    },
    endNode: {
      id: 'mina_planted',
      moodLabel: 'Joyful',
      text: 'Done! Watch the cottage planters around the square—warm apricot and lavender blossoms are already waking up.',
    },
  },
  {
    residentId: 'sora',
    when: (f) => !f.brewedChamomileTea,
    choice: {
      id: 'sora_tea',
      label: 'Could you steep two cups of chamomile-pear tea for Arthur and Clara?',
      tone: 'warm',
      nextNodeId: 'sora_brewed',
      requiresFalseFlag: 'brewedChamomileTea',
      trustDelta: 1,
      setEmotion: 'happy',
      buildFlags: () => ({ brewedChamomileTea: true }),
      unlockMemory: {
        id: 'mem_chamomile_tea',
        title: 'Chamomile-Pear Flask',
        summary: 'Sora brewed a warm flask of chamomile-pear tea meant to soften old silences.',
        residentId: 'sora',
      },
    },
    endNode: {
      id: 'sora_brewed',
      moodLabel: 'Warm',
      text: 'Of course. Honey, roasted pear, and Mina’s chamomile. Take a flask to Arthur—sometimes warm tea speaks faster than an apology.',
    },
  },
  {
    residentId: 'toby',
    when: (f) => !f.foundBrassClapper,
    choice: {
      id: 'toby_clapper',
      label: 'Let’s rescue the brass clapper from the hollow oak together.',
      tone: 'practical',
      nextNodeId: 'toby_found',
      requiresFlag: 'heardBellMystery',
      requiresFalseFlag: 'foundBrassClapper',
      trustDelta: 1,
      setEmotion: 'happy',
      buildFlags: () => ({ foundBrassClapper: true }),
      unlockMemory: {
        id: 'mem_brass_clapper',
        title: 'The Hidden Brass Clapper',
        summary: 'Toby showed me where the gazebo bell’s brass clapper lay wrapped in blue linen inside the hollow oak.',
        residentId: 'toby',
      },
    },
    endNode: {
      id: 'toby_found',
      moodLabel: 'Proud',
      text: 'Got it! Still polished and warm! Only Arthur knows the pin-lock to fit it back inside the gazebo bell—he won’t be mad if you bring it gently.',
    },
  },
  {
    residentId: 'clara',
    when: (f) => !f.claraArthurReconciled && (f.deliveredPostcard || f.brewedChamomileTea || f.foundBrassClapper),
    choice: {
      id: 'clara_bridge_baking',
      label: 'Invite Arthur to share warm sourdough by the fountain instead of apologizing.',
      tone: 'warm',
      nextNodeId: 'clara_agrees',
      trustDelta: 1,
      setEmotion: 'happy',
      buildFlags: () => ({ mediationStyle: 'shared_baking', claraArthurReconciled: true, lanternsLit: true }),
      unlockMemory: {
        id: 'mem_reconciliation_bread',
        title: 'A Warm Loaf Bridge',
        summary: 'Clara agreed to set out sunny bakery tables and share warm sourdough with Arthur without keeping score.',
        residentId: 'clara',
      },
    },
    endNode: {
      id: 'clara_agrees',
      moodLabel: 'Moved',
      text: 'No grand speeches… just warm sourdough and open tables in the sun. Alright. Tell Arthur I’ll meet him by the gazebo at Golden Hour.',
    },
  },
  {
    residentId: 'clara',
    when: (f) =>
      !f.claraArthurReconciled &&
      (f.deliveredPostcard || f.brewedChamomileTea || f.foundBrassClapper) &&
      f.foundBrassClapper,
    choice: {
      id: 'clara_bridge_truth',
      label: 'Tell her Arthur never threw away the bell—he kept the clapper safe.',
      tone: 'gentle',
      nextNodeId: 'clara_truth',
      requiresFlag: 'foundBrassClapper',
      trustDelta: 1,
      setEmotion: 'happy',
      buildFlags: () => ({ mediationStyle: 'gentle_truth', claraArthurReconciled: true, lanternsLit: true }),
      unlockMemory: {
        id: 'mem_reconciliation_truth',
        title: 'Kept Safe in Blue Linen',
        summary: 'Hearing that Arthur safeguarded the brass clapper softened Clara’s long silence.',
        residentId: 'clara',
      },
    },
    endNode: {
      id: 'clara_truth',
      moodLabel: 'Softened',
      text: 'Wrapped in blue linen? That stubborn old clockmaker… he never stopped caring about this town. I’ll walk over to the gazebo this evening and hear him out.',
    },
  },
  {
    residentId: 'arthur',
    when: (f) => !f.bellRestored && f.foundBrassClapper && f.clearedGazeboIvy,
    choice: {
      id: 'arthur_restore_bell',
      label: 'The ivy is cleared and we found the brass clapper—let’s hang it!',
      tone: 'practical',
      nextNodeId: 'arthur_restores',
      trustDelta: 2,
      setEmotion: 'happy',
      buildFlags: (f) => ({
        bellRestored: true,
        claraArthurReconciled: true,
        lanternsLit: true,
        mediationStyle: f.mediationStyle === 'none' ? 'festival_ring' : f.mediationStyle,
      }),
      unlockMemory: {
        id: 'mem_bell_restored',
        title: 'First Chime in Three Autumns',
        summary: 'Arthur climbed Barnaby’s cedar ladder and fitted the brass clapper back inside the Gazebo Bell, filling Little Somewhere with golden sound.',
        residentId: 'arthur',
      },
    },
    endNode: {
      id: 'arthur_restores',
      moodLabel: 'Moved',
      text: 'You cleared the rafters and kept the clapper safe… Come on then, let’s fit the brass pin together. Walk up to the Gazebo anytime and give the bell rope a pull!',
    },
  },
];

/**
 * Injects pending main-quest milestone options so ambient topics never lock story progression.
 */
function buildConcurrentQuestChoices(
  id: ResidentId,
  world: WorldState,
): { choices: DialogueChoice[]; extraNodes: Record<string, DialogueNode> } {
  const f = world.flags;
  const def = RESIDENTS[id];
  const choices: DialogueChoice[] = [];
  const extraNodes: Record<string, DialogueNode> = {};

  for (const m of CONCURRENT_QUEST_MILESTONES) {
    if (m.residentId !== id || !m.when(f)) continue;
    choices.push({
      id: m.choice.id,
      label: m.choice.label,
      tone: m.choice.tone,
      nextNodeId: m.choice.nextNodeId,
      requiresFlag: m.choice.requiresFlag,
      requiresFalseFlag: m.choice.requiresFalseFlag,
      trustDelta: m.choice.trustDelta,
      isStoryMilestone: true,
      setEmotion: m.choice.setEmotion,
      setFlags: m.choice.buildFlags(f),
      unlockMemory: m.choice.unlockMemory,
    });
    extraNodes[m.endNode.id] = {
      id: m.endNode.id,
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: m.endNode.moodLabel,
      text: m.endNode.text,
      choices: [],
      isEnd: true,
    };
  }

  return { choices, extraNodes };
}


/**
 * Dialogue Modularization (2026-11): the DIALOGUE_TOPICS content array was
 * extracted verbatim into src/game/dialogue/ (quest/, personal/, events/,
 * interiors/, everyday/ modules aggregated by dialogue/index.ts).
 * narrative.ts remains the compatibility layer: it re-exports the aggregated
 * array unchanged and retains the environment helpers, quest-cue machinery
 * and resident dialogue wrapper. All existing imports from './narrative'
 * keep working with identical behavior.
 */
export { DIALOGUE_TOPICS };

export function buildResidentDialogue(
  id: ResidentId,
  world: WorldState,
  phase: TimePhase,
): DialogueSession {
  // Social Foundation SF-4: the single production composition point computes
  // the additive context boosts (relationship/memory-aware tie-breaks inside
  // category bands) and forwards them to the engine. Condition gating,
  // priorities, penalties and rotation remain owned by selectDialogueSession.
  const contextBoosts = computeContextBoosts(world, id, phase, DIALOGUE_TOPICS);
  return selectDialogueSession(
    id,
    world,
    phase,
    DIALOGUE_TOPICS,
    buildConcurrentQuestChoices,
    contextBoosts,
  );
}

/**
 * Pass 12 (Everyday Life polish round 3, EL-20): the morning wake beat names the
 * world the player wakes into. Pure — reads only the freshly rolled next-day weather
 * and season, so the daily reset acknowledges the scene it just built.
 */
export function buildMorningWakeLine(weather: WeatherType, season: SeasonType): string {
  const base = (() => {
    switch (weather) {
      case 'light_rain':
        return 'Soft rain patters on the cottage glass as the kettle room wakes.';
      case 'misty_morning':
        return 'Pale mist wraps the lane while the cottage slowly brightens.';
      case 'breezy':
        return 'A soft breeze stirs the linen curtains — the lane hums with moving leaves.';
      case 'sunlit':
        return 'Clean morning sun spills warm across the quilt.';
    }
  })();
  if (season === 'winter') {
    return `${base} Frost feathers the window corners.`;
  }
  return base;
}
