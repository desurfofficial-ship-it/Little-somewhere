import {
  CharacterEmotion,
  DialogueChoice,
  DialogueNode,
  DialogueSession,
  DialogueTopic,
  EnvironmentalState,
  JournalMemory,
  ResidentId,
  StoryFlags,
  TimePhase,
  WorldState,
} from './types';
import { RESIDENTS } from './residents';
import {
  type DeclarativeNodeSpec,
  isChoiceAvailable,
  makeBranchingTopic,
  makeSimpleTopic,
  phaseGreet,
  resolveRelationshipGreeting,
  selectDialogueSession,
  selectThirdPartyGossipSubject,
} from './dialogueEngine';

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

export function computeEnvironmentState(flags: StoryFlags): EnvironmentalState {
  let planters = 0;
  if (flags.plantedMoonPetals) planters += 1;
  if (flags.repairedFountain) planters += 1;
  if (flags.claraArthurReconciled) planters += 1;

  return {
    plantersBloomed: planters,
    fountainFlowing: flags.repairedFountain,
    ivyCleared: flags.clearedGazeboIvy,
    bellGleaming: flags.bellRestored,
    festoonLanterns: flags.lanternsLit || flags.bellRestored,
    bakeryTablesOpen: flags.claraArthurReconciled || flags.mediationStyle === 'shared_baking',
    reconciledTogether: flags.claraArthurReconciled,
    noticeboardUpdated: flags.heardBellMystery || flags.bellRestored,
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

export const DIALOGUE_TOPICS: readonly DialogueTopic[] = [
  // ================= MAIN QUEST MILESTONES =================
  makeBranchingTopic(
    'quest_pip_intro',
    'pip',
    'quest_milestone',
    50,
    { flagsFalse: ['heardBellMystery'] },
    (_id, _w, phase) => ({
      nodes: {
        root: {
          moodLabel: 'Curious',
          text: `Hey, new neighbor! ${phaseGreet(phase)} Have you noticed the big brass bell up in the gazebo? Clara says it used to ring every evening, until she and Mr. Arthur stopped speaking three autumns ago.`,
          choices: [
            {
              id: 'pip_promise',
              label: 'Want to help me figure out how to make it ring again?',
              tone: 'warm',
              nextNodeId: 'pip_excited',
              trustDelta: 1,
              isStoryMilestone: true,
              setEmotion: 'excited',
              setFlags: { heardBellMystery: true },
              unlockMemory: {
                id: 'mem_bell_mystery',
                title: 'The Silent Gazebo Bell',
                summary: 'Pip told me the neighborhood bell has been quiet for three autumns since Clara and Arthur drifted apart.',
                residentId: 'pip',
              },
            },
            {
              id: 'pip_chalk',
              label: 'What are you drawing on the flagstones?',
              tone: 'curious',
              nextNodeId: 'pip_drawing',
              trustDelta: 1,
              isStoryMilestone: true,
              setEmotion: 'happy',
              setFlags: { heardBellMystery: true },
              unlockMemory: {
                id: 'mem_bell_mystery',
                title: 'The Silent Gazebo Bell',
                summary: 'Pip showed me chalk star-maps near the fountain and whispered about the silent gazebo bell.',
                residentId: 'pip',
              },
            },
          ],
        },
        pip_excited: {
          moodLabel: 'Eager',
          text: `Really?! Look closely at the gazebo—Mina says thick ivy grew over the beam, and Toby saw something shiny by the hollow oak! Maybe ask Nora at the Book Nook first—she remembers everything.`,
        },
        pip_drawing: {
          moodLabel: 'Bright',
          text: `A constellation map to the gazebo bell! Clara promised cinnamon buns to anyone who hears it chime again. Try talking to Nora at the Book Nook or Toby by the pond—they both saw clues.`,
        },
      },
    }),
  ),

  makeBranchingTopic(
    'quest_nora_postcard',
    'nora',
    'quest_milestone',
    45,
    { flagsFalse: ['foundPostcard'] },
    (_id, _w, phase) => ({
      nodes: {
        root: {
          moodLabel: 'Thoughtful',
          text: `Ah, welcome to Linden Book Nook. ${phaseGreet(phase)} People here carry their stories quietly, like pressed leaves between pages.`,
          choices: [
            {
              id: 'nora_bell',
              label: 'Pip said you remember when the gazebo bell last rang.',
              tone: 'curious',
              nextNodeId: 'nora_story',
              requiresFlag: 'heardBellMystery',
              trustDelta: 1,
            },
            {
              id: 'nora_books',
              label: 'What are you reading today, Nora?',
              tone: 'warm',
              nextNodeId: 'nora_almanac',
              trustDelta: 1,
            },
          ],
        },
        nora_story: {
          moodLabel: 'Reflective',
          text: `I do. It wasn’t anger that silenced it—just two proud friends grieving a stormy harvest. Wait—inside this almanac is an unmailed postcard Arthur’s sister sent from the coast, and Jun forgot to deliver it.`,
          choices: [
            {
              id: 'nora_take_card',
              label: 'Let me take the postcard to Jun so it reaches Arthur properly.',
              tone: 'practical',
              nextNodeId: 'nora_given',
              trustDelta: 1,
              isStoryMilestone: true,
              setEmotion: 'happy',
              setFlags: { foundPostcard: true },
              unlockMemory: {
                id: 'mem_lost_postcard',
                title: 'A Pressed Postcard',
                summary: 'Nora found an old coastal postcard meant for Arthur tucked inside her bookshop almanac.',
                residentId: 'nora',
              },
            },
            {
              id: 'nora_read_together',
              label: 'Tell me about the festival ribbon you keep.',
              tone: 'gentle',
              nextNodeId: 'nora_ribbon',
              setFlags: { foundPostcard: true },
              trustDelta: 1,
              isStoryMilestone: true,
              setEmotion: 'relaxed',
              unlockMemory: {
                id: 'mem_lost_postcard',
                title: 'A Pressed Postcard',
                summary: 'Nora found an old coastal postcard meant for Arthur tucked inside her bookshop almanac.',
                residentId: 'nora',
              },
            },
          ],
        },
        nora_given: {
          moodLabel: 'Warm',
          text: `Jun keeps his mail satchel slung tight, though he’s terribly shy about admitting a mistake. Hand this to him gently.`,
        },
        nora_ribbon: {
          moodLabel: 'Fond',
          text: `Silk marigold, saved for the evening the bell chimes again. Take this postcard to Jun too—time moves faster when neighbors share small truths.`,
        },
        nora_almanac: {
          moodLabel: 'Amused',
          text: `Our town almanac! Three years ago, Arthur oiled every clock in town except the gazebo spire. If you ask around, Pip knows more than he lets on.`,
        },
      },
    }),
  ),

  makeBranchingTopic(
    'quest_jun_postcard',
    'jun',
    'quest_milestone',
    48,
    { flagsTrue: ['foundPostcard'], flagsFalse: ['deliveredPostcard'] },
    () => ({
      nodes: {
        root: {
          moodLabel: 'Flustered',
          text: `Whoa—is that the coastal postcard with the lighthouse stamp?! I swore it slipped out of my satchel last autumn!`,
          choices: [
            {
              id: 'jun_reassure',
              label: 'It stayed safe in Nora’s almanac. Let’s deliver it to Arthur together.',
              tone: 'warm',
              nextNodeId: 'jun_relieved',
              trustDelta: 1,
              isStoryMilestone: true,
              setEmotion: 'happy',
              setFlags: { deliveredPostcard: true },
              unlockMemory: {
                id: 'mem_postcard_sent',
                title: 'Delayed Delivery',
                summary: 'Jun and I recovered Arthur’s missing coastal postcard and readied it for his bench.',
                residentId: 'jun',
              },
            },
            {
              id: 'jun_advice',
              label: 'Why not leave a fresh note alongside it so Arthur feels welcome?',
              tone: 'gentle',
              nextNodeId: 'jun_relieved',
              trustDelta: 1,
              isStoryMilestone: true,
              setEmotion: 'happy',
              setFlags: { deliveredPostcard: true },
            },
            {
              id: 'jun_scold_blunt',
              label: 'You really need to keep better track of your mailbags, Jun.',
              tone: 'blunt',
              nextNodeId: 'jun_blunt_end',
              trustDelta: -1,
              isNegative: true,
              setEmotion: 'embarrassed',
            },
          ],
        },
        jun_relieved: {
          moodLabel: 'Grateful',
          text: `Thank you! I’ll slip it right into Arthur’s brass box—if you visit him with kindness, I bet he’ll finally open up about the gazebo bell.`,
        },
        jun_blunt_end: {
          moodLabel: 'Bashful',
          text: `Fair enough… I’ll double-check every strap tonight. Come back when you want to deliver it together cleanly.`,
        },
      },
    }),
  ),

  makeBranchingTopic(
    'quest_arthur_bell',
    'arthur',
    'quest_milestone',
    44,
    { flagsFalse: ['bellRestored'] },
    (id, world, phase) => ({
      nodes: {
        root: {
          moodLabel: 'Guarded',
          text: `${resolveRelationshipGreeting(id, world, phase)} Forgive the clutter—old brass gears take patience, and I’ve been out of practice with visitors.`,
          choices: [
            {
              id: 'arthur_postcard',
              label: 'Jun and I found your sister’s coastal postcard.',
              tone: 'warm',
              nextNodeId: 'arthur_softens',
              requiresFlag: 'deliveredPostcard',
              trustDelta: 1,
              setEmotion: 'surprised',
            },
            {
              id: 'arthur_tea',
              label: 'Sora sent over warm chamomile-pear tea for you.',
              tone: 'gentle',
              nextNodeId: 'arthur_softens',
              requiresFlag: 'brewedChamomileTea',
              trustDelta: 1,
              setEmotion: 'relaxed',
            },
            {
              id: 'arthur_smalltalk',
              label: 'What makes a good town chime, Arthur?',
              tone: 'curious',
              nextNodeId: 'arthur_craft',
              trustDelta: world.residents.arthur.met ? 0 : 1,
            },
          ],
        },
        arthur_softens: {
          moodLabel: 'Touched',
          text: `My word… I thought everyone preferred silence to my tinkering. If someone clears the ivy off the gazebo and finds the clapper I hid by the pond, I’d gladly hang it again.`,
        },
        arthur_craft: {
          moodLabel: 'Thoughtful',
          text: `A warm alloy—never shrill. Something that tells folks supper’s nearly ready and nobody has to hurry alone.`,
        },
      },
    }),
  ),

  makeBranchingTopic(
    'quest_clara_rift',
    'clara',
    'quest_milestone',
    40,
    { flagsFalse: ['claraArthurReconciled'], maxSeenCount: 2 },
    (id, world, phase) => ({
      nodes: {
        root: {
          moodLabel: 'Wistful',
          text: `${resolveRelationshipGreeting(id, world, phase)} I keep baking one loaf too many every afternoon, out of habit. Arthur used to come by when the crust crackled—before the storm that cracked the gazebo bell beam.`,
          choices: [
            {
              id: 'clara_listen',
              label: 'What really happened between you and Arthur?',
              tone: 'gentle',
              nextNodeId: 'clara_story',
              trustDelta: 1,
              setEmotion: 'sad',
            },
            {
              id: 'clara_blunt_nudge',
              label: 'Seems silly staying mad over an old bell after three years.',
              tone: 'blunt',
              nextNodeId: 'clara_stung',
              requiresCondition: {
                flagsFalse: ['deliveredPostcard', 'brewedChamomileTea', 'foundBrassClapper'],
              },
              trustDelta: -1,
              isNegative: true,
              setEmotion: 'frustrated',
            },
          ],
        },
        clara_story: {
          moodLabel: 'Reflective',
          text: `I snapped that he cared more about brass gears than bruised neighbors, and he quietly took the bell down the next morning. Truth is, I missed the sound more than I could admit.`,
        },
        clara_stung: {
          moodLabel: 'Guarded',
          text: `Easy to say when you didn’t stand in the rain listening to nothing at dusk. Let’s talk loaves instead of old bruises for now.`,
        },
      },
    }),
  ),

  // ================= GENERALIZED CONFLICT MEDIATION =================
  makeSimpleTopic(
    'conflict_arthur_clara_tension',
    'arthur',
    'conflict_reconciliation',
    12,
    { minNpcTension: { a: 'arthur', b: 'clara', min: 35 }, flagsFalse: ['claraArthurReconciled'], notSeenToday: true },
    {
      moodLabel: 'Quiet',
      buildText: () =>
        `Clara’s rosemary bread still smells clear across the square… I just never knew how to knock after so long.`,
      choices: [
        {
          id: 'arthur_ease_pride',
          label: 'You don’t need a speech—just bring a warm tea cup next time you pass.',
          tone: 'gentle',
          nextNodeId: 'ease_end',
          trustDelta: 1,
          reliabilityDelta: 6,
          setEmotion: 'relaxed',
          adjustNpcTension: { a: 'arthur', b: 'clara', deltaAffinity: 10, deltaTension: -15, tag: 'kind_bridge' },
        },
        {
          id: 'arthur_brush_off',
          label: 'Maybe she prefers the bakery quiet without brass ticking anyway.',
          tone: 'blunt',
          nextNodeId: 'stiff_end',
          trustDelta: -1,
          isNegative: true,
          setEmotion: 'frustrated',
          adjustNpcTension: { a: 'arthur', b: 'clara', deltaAffinity: -4, deltaTension: 6 },
        },
      ],
      endings: {
        ease_end: {
          moodLabel: 'Relieved',
          text: `A quiet cup… perhaps even I can manage that much.`,
        },
        stiff_end: {
          moodLabel: 'Withdrawn',
          text: `Hmmph. Perhaps you’re right. Best keep to my own bench.`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'conflict_barnaby_arthur_rafters',
    'barnaby',
    'conflict_reconciliation',
    6,
    { flagsTrue: ['borrowedBarnabyLadder'], flagsFalse: ['bellRestored'], maxNpcAffinity: { a: 'arthur', b: 'barnaby', max: 62 }, notSeenToday: true },
    {
      moodLabel: 'Gruff',
      buildText: () =>
        `Arthur insists on riveting brass brackets onto my oak gazebo beams! Good mortise-and-tenon joinery never needed brass screws showing.`,
      choices: [
        {
          id: 'barnaby_bridge_craft',
          label: 'Cedar joinery and Arthur’s warm brass actually complement each other cleanly.',
          tone: 'warm',
          nextNodeId: 'craft_warm_end',
          trustDelta: 1,
          reliabilityDelta: 6,
          setEmotion: 'relaxed',
          adjustNpcTension: { a: 'arthur', b: 'barnaby', deltaAffinity: 12, deltaTension: -8, tag: 'shared_craft' },
        },
        {
          id: 'barnaby_stew_blunt',
          label: 'Old brass clockmakers never listen to carpenters anyway.',
          tone: 'blunt',
          nextNodeId: 'craft_blunt_end',
          trustDelta: -1,
          isNegative: true,
          setEmotion: 'frustrated',
          adjustNpcTension: { a: 'arthur', b: 'barnaby', deltaAffinity: -4, deltaTension: 7 },
        },
      ],
      endings: {
        craft_warm_end: {
          moodLabel: 'Charmed',
          text: `Hmph… suppose his brass stays bright against cedar grain. I’ll save him a bench seat later.`,
        },
        craft_blunt_end: {
          moodLabel: 'Brusque',
          text: `Don’t stir pot-fires needlessly, kid. Arthur’s alright—just stubborn as oak knots.`,
        },
      },
    },
  ),

  // ================= 4 PERSONAL SIDE STORYLINES =================
  // 1. Nora & Pip's Chalk Zine
  makeSimpleTopic(
    'side_pip_zine_1',
    'pip',
    'personal_story',
    15,
    { sideFlagsFalse: ['pipZineStarted'], minTrust: 1, notSeenToday: true },
    {
      moodLabel: 'Excited',
      buildText: () =>
        `I’ve been sketching every stray marmalade cat paw-print onto notebook scraps—Miss Nora says if I collect three stories, she’ll bind them into a Willow Lane Zine!`,
      choices: [
        {
          id: 'pip_zine_start_choice',
          label: 'Count me in! What else should go in the first Willow Lane Zine?',
          tone: 'warm',
          nextNodeId: 'end_yes',
          trustDelta: 1,
          reliabilityDelta: 8,
          isStoryMilestone: true,
          setEmotion: 'excited',
          setSideFlags: { pipZineStarted: true },
        },
      ],
      endings: {
        end_yes: {
          moodLabel: 'Beaming',
          text: `Really?! Tell Miss Nora I picked her favorite marigold leaf for the cover!`,
        },
      },
    },
  ),
  makeSimpleTopic(
    'side_nora_zine_2',
    'nora',
    'personal_story',
    18,
    { sideFlagsTrue: ['pipZineStarted'], sideFlagsFalse: ['pipZinePrinted'], notSeenToday: true },
    {
      moodLabel: 'Amused',
      buildText: () =>
        `Pip arrived with six chalk drawings of the fountain carp and a dandelion bookmark. If you think the lane’s ready for a pocket edition, I’ve stitched the spine.`,
      choices: [
        {
          id: 'nora_print_zine',
          label: 'Let’s place Issue #1 on the Linden Book Nook counter!',
          tone: 'warm',
          nextNodeId: 'end_print',
          trustDelta: 1,
          reliabilityDelta: 10,
          isStoryMilestone: true,
          setEmotion: 'happy',
          setSideFlags: { pipZinePrinted: true },
          unlockMemory: {
            id: 'mem_side_chalk_zine',
            title: 'Willow Lane Zine, Issue #1',
            summary: 'Helped Pip and Nora stitch together the neighborhood’s first pocket storybook zine.',
            residentId: 'nora',
          },
        },
      ],
      endings: {
        end_print: {
          moodLabel: 'Proud',
          text: `Every little lane deserves its own chronicler—thank you for cheering Pip on.`,
        },
      },
    },
  ),

  // 2. Mina & Clara's Herb Loaf
  makeSimpleTopic(
    'side_mina_herbloaf_1',
    'mina',
    'personal_story',
    14,
    { sideFlagsFalse: ['herbLoafStarted'], minTrust: 1, notSeenToday: true },
    {
      moodLabel: 'Curious',
      buildText: () =>
        `I grafted sweet lemon-thyme onto my sunniest rosemary bush—if Clara tests a sprig in tomorrow’s sourdough, the whole square might smell like honeyed summer.`,
      choices: [
        {
          id: 'mina_herb_pass',
          label: 'I’ll tell Clara to save room in the Hearth & Crumb oven!',
          tone: 'warm',
          nextNodeId: 'end_herb',
          trustDelta: 1,
          reliabilityDelta: 6,
          isStoryMilestone: true,
          setEmotion: 'happy',
          setSideFlags: { herbLoafStarted: true },
        },
      ],
      endings: {
        end_herb: {
          moodLabel: 'Grateful',
          text: `Oh, wonderful! Wait until you taste it fresh from the hearth.`,
        },
      },
    },
  ),
  makeSimpleTopic(
    'side_clara_herbloaf_2',
    'clara',
    'personal_story',
    17,
    { sideFlagsTrue: ['herbLoafStarted'], sideFlagsFalse: ['herbLoafShared'], notSeenToday: true },
    {
      moodLabel: 'Warm',
      buildText: () =>
        `Mina’s lemon-thyme sprig crackled like gold inside the dough! Pull off a warm heel before it cools—should we share loaves on the plaza benches?`,
      choices: [
        {
          id: 'clara_share_herb_loaf',
          label: 'Yes—let’s leave warm slices out for everyone passing the fountain.',
          tone: 'warm',
          nextNodeId: 'end_share',
          trustDelta: 1,
          reliabilityDelta: 10,
          isStoryMilestone: true,
          setEmotion: 'happy',
          setSideFlags: { herbLoafShared: true },
          unlockMemory: {
            id: 'mem_side_herb_loaf',
            title: 'Lemon-Thyme Sourdough',
            summary: 'Paired Mina’s greenhouse herbs with Clara’s sourdough for a fragrant neighborhood tasting.',
            residentId: 'clara',
          },
        },
      ],
      endings: {
        end_share: {
          moodLabel: 'Delighted',
          text: `Look at Pip’s nose following the scent from halfway across the bridge already!`,
        },
      },
    },
  ),

  // 3. Barnaby & Sora's Pond Acoustic Stand
  makeSimpleTopic(
    'side_sora_stand_1',
    'sora',
    'personal_story',
    14,
    { sideFlagsFalse: ['pondStandStarted'], minTrust: 1, notSeenToday: true },
    {
      moodLabel: 'Dreamy',
      buildText: () =>
        `When I play near Mirror Pond, my sheet music tries to sail into the reeds whenever an afternoon breeze kicks up. A tiny notched cedar stand would save every etude.`,
      choices: [
        {
          id: 'sora_ask_barnaby',
          label: 'I bet Barnaby has cedar offcuts at Pinecone Woodshop—I’ll ask him!',
          tone: 'practical',
          nextNodeId: 'end_stand1',
          trustDelta: 1,
          reliabilityDelta: 7,
          isStoryMilestone: true,
          setEmotion: 'happy',
          setSideFlags: { pondStandStarted: true },
        },
      ],
      endings: {
        end_stand1: {
          moodLabel: 'Hopeful',
          text: `Would he really? Tell him even crooked cedar curls smell sweeter than damp pages.`,
        },
      },
    },
  ),
  makeSimpleTopic(
    'side_barnaby_stand_2',
    'barnaby',
    'personal_story',
    17,
    { sideFlagsTrue: ['pondStandStarted'], sideFlagsFalse: ['pondStandBuilt'], notSeenToday: true },
    {
      moodLabel: 'Pleased',
      buildText: () =>
        `Sheet-music stand for Sora’s violin, eh? Give me two brass thumbscrews and a heartwood cedar plank—it’ll stand sturdy through autumn gusts.`,
      choices: [
        {
          id: 'barnaby_carve_stand',
          label: 'Carve a little treble clef along the lip—she’ll treasure it.',
          tone: 'warm',
          nextNodeId: 'end_stand2',
          trustDelta: 1,
          reliabilityDelta: 10,
          isStoryMilestone: true,
          setEmotion: 'happy',
          setSideFlags: { pondStandBuilt: true },
          unlockMemory: {
            id: 'mem_side_music_stand',
            title: 'Cedar Music Stand',
            summary: 'Barnaby planed a wind-proof cedar music stand so Sora can play comfortably beside Mirror Pond.',
            residentId: 'barnaby',
          },
        },
      ],
      endings: {
        end_stand2: {
          moodLabel: 'Proud',
          text: `Done and rubbed with beeswax. Wait till you hear how violin wood sings beside cedar.`,
        },
      },
    },
  ),

  // 4. Arthur & Jun's Brass Pocket Watch
  makeSimpleTopic(
    'side_jun_watch_1',
    'jun',
    'personal_story',
    13,
    { sideFlagsFalse: ['watchTuneStarted'], flagsTrue: ['deliveredPostcard'], notSeenToday: true },
    {
      moodLabel: 'Curious',
      buildText: () =>
        `Ever since my route expanded past Mirror Pond, my old brass pocket watch loses four minutes every misty morning—makes me rush the mailbox loop.`,
      choices: [
        {
          id: 'jun_watch_arthur',
          label: 'Arthur could balance that escapement in two minutes—want me to ask?',
          tone: 'warm',
          nextNodeId: 'end_w1',
          trustDelta: 1,
          reliabilityDelta: 6,
          isStoryMilestone: true,
          setEmotion: 'happy',
          setSideFlags: { watchTuneStarted: true },
        },
      ],
      endings: {
        end_w1: {
          moodLabel: 'Relieved',
          text: `Would you? I hate arriving at your cottage porch late!`,
        },
      },
    },
  ),
  makeSimpleTopic(
    'side_arthur_watch_2',
    'arthur',
    'personal_story',
    16,
    { sideFlagsTrue: ['watchTuneStarted'], sideFlagsFalse: ['watchTuneFinished'], notSeenToday: true },
    {
      moodLabel: 'Focused',
      buildText: () =>
        `Jun’s mail watch? Aye, morning mist stiffens the mainspring oil. Hand it over—a drop of watchmaker’s oil and half a turn on the balance screw will keep him right to the chime.`,
      choices: [
        {
          id: 'arthur_fix_watch',
          label: 'Listen how clean that tick sounds already—thank you, Arthur.',
          tone: 'warm',
          nextNodeId: 'end_w2',
          trustDelta: 1,
          reliabilityDelta: 10,
          isStoryMilestone: true,
          setEmotion: 'happy',
          setSideFlags: { watchTuneFinished: true },
          unlockMemory: {
            id: 'mem_side_jun_watch',
            title: 'True on the Route',
            summary: 'Arthur calibrated Jun’s courier pocket watch so the morning post never drifts behind schedule.',
            residentId: 'arthur',
          },
        },
      ],
      endings: {
        end_w2: {
          moodLabel: 'Warm',
          text: `A town runs gentler when its letter carrier trusts the hour.`,
        },
      },
    },
  ),

  // ================= EVENT & GOSSIP TOPICS =================
  makeSimpleTopic(
    'event_bell_celebration',
    'any',
    'event_reaction',
    10,
    { requiresRecentEventKind: { kind: 'bell_ring', maxDaysAgo: 2 }, notSeenToday: true },
    {
      moodLabel: 'Bright',
      buildText: (id) =>
        `Did you hear the brass bell echo past the cedar eaves, ${RESIDENTS[id].traits.temperament === 'spirited' ? 'neighbor' : 'friend'}? Even the sparrows settled down to listen.`,
      choices: [
        {
          id: 'ev_bell_warm',
          label: 'Every corner of Willow Lane seemed to pause for a second.',
          tone: 'warm',
          nextNodeId: 'ev_bell_end',
          trustDelta: 1,
          setEmotion: 'happy',
        },
      ],
      endings: {
        ev_bell_end: {
          moodLabel: 'At Peace',
          text: `That’s what good bells are for—reminding folks they aren’t walking alone.`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'event_fountain_repair',
    'any',
    'event_reaction',
    8,
    { flagsTrue: ['repairedFountain'], notSeenToday: true, maxSeenCount: 1 },
    {
      moodLabel: 'Refreshing',
      buildText: () =>
        `Listen to the plaza fountain pouring cleanly again—cool mist makes the entire square feel alive!`,
      choices: [
        {
          id: 'ev_fountain_cheer',
          label: 'Barnaby knew right where the autumn leaf clogged the intake.',
          tone: 'warm',
          nextNodeId: 'ev_fountain_end',
          trustDelta: 1,
          setEmotion: 'happy',
        },
      ],
      endings: {
        ev_fountain_end: {
          moodLabel: 'Warm',
          text: `Nothing beats running water beside warm sunlit cobblestones.`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'event_gift_thanks',
    'any',
    'event_reaction',
    9,
    { requiresRecentEventKind: { kind: 'player_help', maxDaysAgo: 1 }, notSeenToday: true },
    {
      moodLabel: 'Appreciative',
      buildText: (id) =>
        `Word travels fast along Willow Step Lane—folks noticed you carrying helpful bundles across the square ${RESIDENTS[id].traits.temperament === 'whimsical' ? 'like a true lane sprite!' : 'for your neighbors.'}`,
      choices: [
        {
          id: 'ev_help_reply',
          label: 'Happy to lend a hand whenever someone needs one.',
          tone: 'warm',
          nextNodeId: 'ev_help_end',
          trustDelta: 1,
          reliabilityDelta: 4,
          setEmotion: 'happy',
        },
      ],
      endings: {
        ev_help_end: {
          moodLabel: 'Warm',
          text: `Little acts like that stitch a whole neighborhood together.`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'gossip_clara_mina_loaves',
    'clara',
    'npc_gossip',
    5,
    { minNpcAffinity: { a: 'clara', b: 'mina', min: 55 }, notSeenToday: true },
    {
      moodLabel: 'Fond',
      buildText: () =>
        `Mina dropped off fresh rosemary sprigs wrapped in damp linen before sunrise. I swear her greenhouse herbs make my sourdough crust sing louder.`,
      choices: [
        {
          id: 'gossip_cm_warm',
          label: 'You two make a great neighborhood team.',
          tone: 'warm',
          nextNodeId: 'gossip_cm_end',
          trustDelta: 1,
          setEmotion: 'happy',
        },
      ],
      endings: {
        gossip_cm_end: {
          moodLabel: 'Smiling',
          text: `Good ingredients are half of baking—good friends are the other half.`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'gossip_pip_toby_pond',
    'toby',
    'npc_gossip',
    5,
    { minNpcAffinity: { a: 'pip', b: 'toby', min: 45 }, notSeenToday: true },
    {
      moodLabel: 'Amused',
      buildText: () =>
        `Pip tried teaching me how to skip flat river pebbles without startling the carp. Mostly we just made big rings in my reflection sketches.`,
      choices: [
        {
          id: 'gossip_pt_curious',
          label: 'Ripples make for lively watercolors, though.',
          tone: 'curious',
          nextNodeId: 'gossip_pt_end',
          trustDelta: 1,
          setEmotion: 'happy',
        },
      ],
      endings: {
        gossip_pt_end: {
          moodLabel: 'Shy-Warm',
          text: `Heh… yeah. Way less lonely sketching with Pip humming beside me.`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'gossip_jun_clara_bond',
    'jun',
    'npc_gossip',
    4,
    { playerRelationWith: { residentId: 'clara', minTier: 'friendly' }, notSeenToday: true },
    {
      moodLabel: 'Cheery',
      buildText: () =>
        `Wait till you pass Hearth & Crumb—Clara keeps wrapping an extra honey-glazed twist in waxed paper whenever she hears you’re on the lane!`,
      choices: [
        {
          id: 'gossip_jc_warm',
          label: 'Clara’s kindness makes every morning brighter.',
          tone: 'warm',
          nextNodeId: 'gossip_jc_end',
          trustDelta: 1,
          reliabilityDelta: 2,
          setEmotion: 'happy',
        },
      ],
      endings: {
        gossip_jc_end: {
          moodLabel: 'Warm',
          text: `You earned every crumb of it—neighbors notice when someone genuinely shows up.`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'gossip_sora_mina_bond',
    'sora',
    'npc_gossip',
    4,
    { playerRelationWith: { residentId: 'mina', minTier: 'friendly' }, notSeenToday: true },
    {
      moodLabel: 'Fond',
      buildText: () =>
        `Mina tucked two extra sprigs of lemon verbena into my tea basket this morning—she says her greenhouse blooms twice as cheerfully whenever you visit.`,
      choices: [
        {
          id: 'gossip_sm_warm',
          label: 'Talking leaves with Mina is the calmest part of my week.',
          tone: 'gentle',
          nextNodeId: 'gossip_sm_end',
          trustDelta: 1,
          reliabilityDelta: 2,
          setEmotion: 'relaxed',
        },
      ],
      endings: {
        gossip_sm_end: {
          moodLabel: 'Peaceful',
          text: `She hears sincerity quicker than anybody in town, you know.`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'gossip_nora_arthur_bond',
    'nora',
    'npc_gossip',
    4,
    { playerRelationWith: { residentId: 'arthur', minTier: 'close' }, notSeenToday: true },
    {
      moodLabel: 'Touched',
      buildText: () =>
        `I walked past Copperwheel Cottage earlier and heard Arthur humming while polishing a spare brass mug—he hasn’t set out a second cup since before you won his trust.`,
      choices: [
        {
          id: 'gossip_na_warm',
          label: 'Arthur deserves quiet company after keeping everything to himself.',
          tone: 'gentle',
          nextNodeId: 'gossip_na_end',
          trustDelta: 1,
          reliabilityDelta: 3,
          setEmotion: 'happy',
        },
      ],
      endings: {
        gossip_na_end: {
          moodLabel: 'Smiling',
          text: `Takes patience to earn a clockmaker’s friendship, and you did it cleanly.`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'gossip_barnaby_pip_acquaintance',
    'barnaby',
    'npc_gossip',
    4,
    {
      playerRelationWith: { residentId: 'pip', minTier: 'acquaintance', maxTier: 'friendly' },
      notSeenToday: true,
    },
    {
      moodLabel: 'Hearty',
      buildText: () =>
        `Pip hopped right up to my sawhorse earlier bragging that the two of you are getting properly acquainted! That youngster lights up the whole plaza.`,
      choices: [
        {
          id: 'gossip_bp_warm',
          label: 'Pip knows every secret shortcut in Little Somewhere.',
          tone: 'warm',
          nextNodeId: 'gossip_bp_end',
          trustDelta: 1,
          setEmotion: 'happy',
        },
      ],
      endings: {
        gossip_bp_end: {
          moodLabel: 'Fond',
          text: `Haha, half of them he invents on the spot—keep listening closely!`,
        },
      },
    },
  ),

  makeBranchingTopic(
    'gossip_third_party_relation',
    'any',
    'npc_gossip',
    3,
    { requiresThirdPartyGossip: true, notSeenToday: true },
    (id, world): { nodes: Record<string, DeclarativeNodeSpec> } => {
      const subject = selectThirdPartyGossipSubject(id, world);
      const targetId: ResidentId = subject?.targetId ?? (id === 'clara' ? 'mina' : 'clara');
      const target = RESIDENTS[targetId];
      const favoriteSnippet = target.favoriteThing.split(',')[0].toLowerCase();

      if (subject?.guarded) {
        return {
          nodes: {
            root: {
              moodLabel: 'Gentle',
              text: `Word along the cobbles is that things felt a little tense between you and ${target.name} recently. Folktalk fades fast here—a gentle check-in near ${target.homeName} goes a long way.`,
              choices: [
                {
                  id: 'gossip_tp_mend',
                  label: `Thanks for saying so—I’ll check in softly on ${target.name} soon.`,
                  tone: 'gentle',
                  nextNodeId: 'gossip_tp_end',
                  trustDelta: 1,
                  reliabilityDelta: 3,
                  setEmotion: 'relaxed',
                },
                {
                  id: 'gossip_tp_space',
                  label: 'Giving them a quiet beat first before talking again.',
                  tone: 'curious',
                  nextNodeId: 'gossip_tp_care_end',
                  trustDelta: 0,
                  reliabilityDelta: 2,
                },
              ],
            },
            gossip_tp_end: {
              moodLabel: 'Warm',
              text: `That’s the spirit of Willow Step Lane—nobody holds a storm cloud forever when someone reaches back gently.`,
            },
            gossip_tp_care_end: {
              moodLabel: 'Thoughtful',
              text: `Patience helps too. Whenever you’re ready, ${target.name} still notices kindness.`,
            },
          },
        };
      }

      if (subject?.tier === 'kindred') {
        return {
          nodes: {
            root: {
              moodLabel: 'Delighted',
              text: `Everyone on the lane can see how kindred you and ${target.name} have become—${target.name} lights right up talking about you over ${favoriteSnippet}!`,
              choices: [
                {
                  id: 'gossip_tp_kindred_warm',
                  label: `${target.name} has felt like family almost from day one.`,
                  tone: 'warm',
                  nextNodeId: 'gossip_tp_end',
                  trustDelta: 1,
                  reliabilityDelta: 3,
                  setEmotion: 'happy',
                },
              ],
            },
            gossip_tp_end: {
              moodLabel: 'Smiling',
              text: `Friendships like that anchor the whole neighborhood through every season.`,
            },
          },
        };
      }

      if (subject?.tier === 'close') {
        return {
          nodes: {
            root: {
              moodLabel: 'Warm',
              text: `I caught ${target.name} smiling down near ${target.homeName} earlier—sounds like having a close friend like you around really steadied their week.`,
              choices: [
                {
                  id: 'gossip_tp_close_warm',
                  label: `Always glad spending an unhurried afternoon with ${target.name}.`,
                  tone: 'warm',
                  nextNodeId: 'gossip_tp_end',
                  trustDelta: 1,
                  reliabilityDelta: 2,
                  setEmotion: 'happy',
                },
              ],
            },
            gossip_tp_end: {
              moodLabel: 'Pleased',
              text: `You’ve got a real knack for making folks feel heard.`,
            },
          },
        };
      }

      if (subject?.tier === 'friendly') {
        return {
          nodes: {
            root: {
              moodLabel: 'Cheerful',
              text: `${target.name} mentioned bumping into you lately! Seems like you two have grown into easy friends—nothing puts ${target.name} in a better mood than ${favoriteSnippet}.`,
              choices: [
                {
                  id: 'gossip_tp_friend_warm',
                  label: `Good tip—I’ll keep ${favoriteSnippet} in mind next time!`,
                  tone: 'curious',
                  nextNodeId: 'gossip_tp_end',
                  trustDelta: 1,
                  setEmotion: 'happy',
                },
              ],
            },
            gossip_tp_end: {
              moodLabel: 'Bright',
              text: `Just watch how quickly a little thoughtfulness earns a porch chair around here.`,
            },
          },
        };
      }

      if (subject?.tier === 'acquaintance') {
        return {
          nodes: {
            root: {
              moodLabel: 'Observant',
              text: `Saw you and ${target.name} trading more than quick waves lately—you’re warming right up to each other! Ask ${target.name} about ${favoriteSnippet} if you visit ${target.homeName}.`,
              choices: [
                {
                  id: 'gossip_tp_acq_warm',
                  label: `Still getting to know ${target.name}—thanks for the hint.`,
                  tone: 'curious',
                  nextNodeId: 'gossip_tp_end',
                  trustDelta: 1,
                  setEmotion: 'happy',
                },
              ],
            },
            gossip_tp_end: {
              moodLabel: 'Friendly',
              text: `Give it a few mornings—every acquaintance here turns into story-sharing soon enough.`,
            },
          },
        };
      }

      return {
        nodes: {
          root: {
            moodLabel: 'Neighborly',
            text: `I noticed you said hello to ${target.name}, though you two are still mostly strangers—swing by ${target.homeName} when you’ve got a spare minute, especially if ${favoriteSnippet} catches your eye.`,
            choices: [
              {
                id: 'gossip_tp_stranger_warm',
                label: `I’ll make sure to stop by and chat longer with ${target.name}.`,
                tone: 'warm',
                nextNodeId: 'gossip_tp_end',
                trustDelta: 1,
                setEmotion: 'happy',
              },
            ],
          },
          gossip_tp_end: {
            moodLabel: 'Welcoming',
            text: `Everyone starts with a short hello on Willow Lane!`,
          },
        },
      };
    },
  ),

  // ================= EMOTION & RELATIONSHIP TIER TOPICS =================
  makeSimpleTopic(
    'tier_acquaintance_warmup',
    'any',
    'relationship_tier',
    7,
    { minTier: 'acquaintance', maxTier: 'acquaintance', talkedCountMin: 2, notSeenToday: true },
    {
      moodLabel: 'Warming Up',
      buildText: (id) =>
        `I’m glad we’ve started trading more than passing waves—${RESIDENTS[id].homeName} always feels friendlier once folks learn each other’s rhythms.`,
      choices: [
        {
          id: 'tier_acq_warm',
          label: 'Still learning the lane, though I’m glad we’re neighbors.',
          tone: 'warm',
          nextNodeId: 'tier_acq_end',
          trustDelta: 1,
          reliabilityDelta: 3,
          setEmotion: 'happy',
        },
      ],
      endings: {
        tier_acq_end: {
          moodLabel: 'Friendly',
          text: `Give the cobbles a week—you’ll know every porch light by heart soon enough.`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'tier_friendly_confide',
    'any',
    'relationship_tier',
    7,
    { minTier: 'friendly', maxTier: 'friendly', notSeenToday: true },
    {
      moodLabel: 'Welcoming',
      buildText: (id) => {
        const favorite = RESIDENTS[id].favoriteThing.split(',')[0].toLowerCase();
        return `You know, neighbor, since we’ve gotten properly acquainted—whenever you’re near ${RESIDENTS[id].homeName}, don’t hesitate to linger a spell over ${favorite}.`;
      },
      choices: [
        {
          id: 'tier_friend_warm',
          label: 'Always makes the afternoon feel twice as bright stopping by.',
          tone: 'warm',
          nextNodeId: 'tier_friend_end',
          trustDelta: 1,
          reliabilityDelta: 4,
          setEmotion: 'happy',
        },
      ],
      endings: {
        tier_friend_end: {
          moodLabel: 'Pleased',
          text: `Good! Neighborly chats are the quiet heartbeat of Willow Lane.`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'tier_close_kindred_bond',
    'any',
    'relationship_tier',
    8,
    { minAffinity: 60, maxTier: 'close', notSeenToday: true },
    {
      moodLabel: 'Warm',
      buildText: (id) =>
        `Honestly, ${RESIDENTS[id].id === 'arthur' ? 'neighbor' : 'friend'}, Willow Lane felt smaller before you moved into that mossy cottage. Now even errands feel like visiting home.`,
      choices: [
        {
          id: 'tier_close_warm',
          label: 'Having neighbors like you made moving here effortless.',
          tone: 'warm',
          nextNodeId: 'tier_close_end',
          trustDelta: 1,
          reliabilityDelta: 4,
          setEmotion: 'happy',
        },
      ],
      endings: {
        tier_close_end: {
          moodLabel: 'Joyful',
          text: `My door and porch bench are always open whenever you want company.`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'tier_kindred_promise',
    'any',
    'relationship_tier',
    9,
    { minTier: 'kindred', notSeenToday: true },
    {
      moodLabel: 'Kindred',
      buildText: (id) =>
        `I was just thinking—there are few souls on Willow Lane I trust with the quiet truth of a long week the way I trust you, ${RESIDENTS[id].traits.temperament === 'spirited' ? 'my friend' : 'dear friend'}.`,
      choices: [
        {
          id: 'tier_kindred_warm',
          label: 'Same goes—this lane wouldn’t feel like home without you.',
          tone: 'warm',
          nextNodeId: 'tier_kindred_end',
          trustDelta: 1,
          reliabilityDelta: 5,
          setEmotion: 'happy',
        },
      ],
      endings: {
        tier_kindred_end: {
          moodLabel: 'Radiant',
          text: `Whenever the dusk lanterns flicker on, know you’ve always got a seat waiting with me.`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'emotion_guarded_tension',
    'any',
    'emotion_reaction',
    7,
    { emotions: ['frustrated', 'angry'], notSeenToday: true },
    {
      moodLabel: 'Guarded',
      buildText: () =>
        `I’m still a bit bristled from earlier, to be honest. I’d rather we take things easy before jumping back into busy talk.`,
      choices: [
        {
          id: 'em_guarded_gentle',
          label: 'Understood—no rush at all. I’m here when the air feels lighter.',
          tone: 'gentle',
          nextNodeId: 'em_guarded_soft',
          trustDelta: 0,
          reliabilityDelta: 6,
          setEmotion: 'relaxed',
        },
      ],
      endings: {
        em_guarded_soft: {
          moodLabel: 'Softened',
          text: `Thanks for giving me a quiet beat, neighbor. That honestly helps.`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'emotion_tired_check',
    'any',
    'emotion_reaction',
    6,
    { emotions: ['tired'], notSeenToday: true },
    {
      moodLabel: 'Tired',
      buildText: () =>
        `Phew… my boots feel a little heavy after today’s loop. Think I’ll catch a cedar bench in the shade soon.`,
      choices: [
        {
          id: 'em_tired_kind',
          label: 'Take a slow breather—the lane isn’t going anywhere.',
          tone: 'gentle',
          nextNodeId: 'em_tired_yes',
          trustDelta: 1,
          setEmotion: 'relaxed',
        },
        {
          id: 'em_tired_blunt',
          label: 'Seems like everyone slows down early around here.',
          tone: 'blunt',
          nextNodeId: 'em_tired_no',
          trustDelta: -1,
          isNegative: true,
          setEmotion: 'frustrated',
        },
      ],
      endings: {
        em_tired_yes: {
          moodLabel: 'Grateful',
          text: `Just hearing you say that lifts half the weight off my shoulders.`,
        },
        em_tired_no: {
          moodLabel: 'Weary',
          text: `Not all of us hurry just to look busy, neighbor.`,
        },
      },
    },
  ),

  // ================= WEATHER & SEASON TOPICS =================
  makeSimpleTopic(
    'weather_rain_reflection',
    'any',
    'weather_season',
    7,
    { weathers: ['light_rain'], notSeenToday: true },
    {
      moodLabel: 'Cozy',
      buildText: (id) =>
        RESIDENTS[id].traits.rainBehavior === 'umbrella_stroll'
          ? `Listen to soft raindrops tapping against cedar leaves—best weather in town for spotting shimmering cobbles!`
          : `Rain smells so clean off the bakery awnings. No shame ducking under the eaves for a warm chat.`,
      choices: [
        {
          id: 'rain_cozy_yes',
          label: 'Rainy days make the porch lanterns glow twice as warm.',
          tone: 'warm',
          nextNodeId: 'rain_yes_end',
          trustDelta: 1,
          setEmotion: 'relaxed',
        },
      ],
      endings: {
        rain_yes_end: {
          moodLabel: 'Peaceful',
          text: `Wait till twilight hits the puddles—looks like liquid amber out here.`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'weather_misty_breezy_note',
    'any',
    'weather_season',
    4,
    { weathers: ['misty_morning', 'breezy'], notSeenToday: true },
    {
      moodLabel: 'Observant',
      buildText: (_id, w) =>
        w.weather === 'misty_morning'
          ? `Cool pond mist is curling right across the flagstones this morning—makes the cottages look like storybook cutouts.`
          : `Hear that crisp breeze tuning the maple leaves? Feels like an invitation to wander down to Mirror Pond.`,
      choices: [
        {
          id: 'weather_mb_reply',
          label: 'Makes every familiar bench feel brand new.',
          tone: 'curious',
          nextNodeId: 'weather_mb_end',
          trustDelta: 1,
          setEmotion: 'curious',
        },
      ],
      endings: {
        weather_mb_end: {
          moodLabel: 'Cheerful',
          text: `Right? Half the magic here is just noticing how the sky changes.`,
        },
      },
    },
  ),

  // ================= RESIDENT DAILY SLICE POOL (MULTIPLE UNIQUE CHATS PER RESIDENT) =================
  // Clara
  makeSimpleTopic('daily_clara_crust', 'clara', 'daily_slice', 2, {}, {
    moodLabel: 'Warm',
    buildText: (id, w, p) => `${resolveRelationshipGreeting(id, w, p)} First score on a sourdough boule makes the whole porch smell like toasted hazelnuts.`,
    choices: [
      { id: 'clara_d1', label: 'Any secret to getting that crisp blistered crust?', tone: 'curious', nextNodeId: 'd1_e', trustDelta: 1, setEmotion: 'happy' },
    ],
    endings: { d1_e: { moodLabel: 'Cheerful', text: `Steam in the first ten minutes, patience in the last twenty!` } },
  }),
  makeSimpleTopic('daily_clara_tables', 'clara', 'daily_slice', 2, {}, {
    moodLabel: 'Radiant',
    buildText: (_id, w) => w.flags.claraArthurReconciled
      ? `Arthur even fixed the bakery’s wall clock while the loaves were rising! Never thought the square could taste this bright again.`
      : `I still set an extra napkin on the café counter out of sheer habit.`,
    choices: [
      { id: 'clara_hug', label: 'The whole lane feels lighter with warm bread in the square.', tone: 'warm', nextNodeId: 'd2_e', trustDelta: 1, setEmotion: 'happy' },
    ],
    endings: { d2_e: { moodLabel: 'Grateful', text: `Bread is better when benches nearby have friends sitting on them.` } },
  }),

  // Arthur
  makeSimpleTopic('daily_arthur_springs', 'arthur', 'daily_slice', 2, {}, {
    moodLabel: 'Thoughtful',
    buildText: (id, w, p) => `${resolveRelationshipGreeting(id, w, p)} Brass escapements keep honest time if you never force a stiff gear.`,
    choices: [
      { id: 'arthur_d1', label: 'Sounds a lot like mending friendships too.', tone: 'gentle', nextNodeId: 'a1_e', trustDelta: 1, setEmotion: 'relaxed' },
    ],
    endings: { a1_e: { moodLabel: 'Warm', text: `Hah… perhaps you know more clockwork than you let on.` } },
  }),
  makeSimpleTopic('daily_arthur_peace', 'arthur', 'daily_slice', 3, { flagsTrue: ['bellRestored'] }, {
    moodLabel: 'At Peace',
    buildText: (id, w, p) => `${resolveRelationshipGreeting(id, w, p)} Hear how steady the bell’s echo sits against the hills? Clara even brought rosemary butter to the workshop.`,
    choices: [
      { id: 'arthur_ring_note', label: 'You built something that brings everyone together.', tone: 'warm', nextNodeId: 'a2_e', trustDelta: 1, setEmotion: 'happy' },
    ],
    endings: { a2_e: { moodLabel: 'Warm', text: `I only wound the spring, neighbor. You reminded the whole lane why it mattered.` } },
  }),

  // Mina
  makeSimpleTopic('daily_mina_soil', 'mina', 'daily_slice', 2, {}, {
    moodLabel: 'Gentle',
    buildText: (id, w, p) => `${resolveRelationshipGreeting(id, w, p)} Rain-soaked terracotta and morning sun—plants never rush, yet they always arrive right on season.`,
    choices: [
      { id: 'mina_d1', label: 'Which blooms love the fountain mist best?', tone: 'curious', nextNodeId: 'm1_e', trustDelta: 1, setEmotion: 'curious' },
    ],
    endings: { m1_e: { moodLabel: 'Bright', text: `Sweet ferns and pale bluebell sprigs—they practically lean toward the splash.` } },
  }),
  makeSimpleTopic('daily_mina_chamomile', 'mina', 'daily_slice', 2, {}, {
    moodLabel: 'Warm',
    buildText: () => `I bundle spare chamomile blossoms every Tuesday for Sora’s tea cart so the steam smells like warm summer meadows.`,
    choices: [
      { id: 'mina_tea', label: 'Do you grow herbs for anyone else along the lane?', tone: 'curious', nextNodeId: 'm2_e', trustDelta: 1, setEmotion: 'happy' },
    ],
    endings: { m2_e: { moodLabel: 'Warm', text: `Rosemary for Clara, pressed lavender for Nora’s bookmarks—a little leaf for everyone!` } },
  }),

  // Jun
  makeSimpleTopic('daily_jun_route', 'jun', 'daily_slice', 2, {}, {
    moodLabel: 'Cheerful',
    buildText: (id, w, p) => `${resolveRelationshipGreeting(id, w, p)} I’ve already walked the cobblestone loop twice today. Checked your Willow Mailbox lately?`,
    choices: [
      { id: 'jun_gossip', label: 'Who seems most in need of company today?', tone: 'curious', nextNodeId: 'j1_e', trustDelta: 1, setEmotion: 'happy' },
      { id: 'jun_lanterns', label: 'Think we should light the plaza festoon lanterns tonight?', tone: 'warm', nextNodeId: 'j2_e', setFlags: { lanternsLit: true }, trustDelta: 1, isStoryMilestone: true },
    ],
    endings: {
      j1_e: { moodLabel: 'Observant', text: `Arthur lingers near the gazebo at sunset pretending to adjust his watch, and Clara leaves one extra loaf wrapped in linen.` },
      j2_e: { moodLabel: 'Bright', text: `Oh, I’ve been waiting for someone to say that! I’ll switch on the warm string lanterns along the plaza eaves.` },
    },
  }),
  makeSimpleTopic('daily_jun_stamps', 'jun', 'daily_slice', 2, {}, {
    moodLabel: 'Upbeat',
    buildText: () => `My favorite stamp in the ledger has two tiny swallows over a copper weathervane—folks always smile when that envelope shows up.`,
    choices: [
      { id: 'jun_d2', label: 'Sounds like carrying good news never gets old.', tone: 'warm', nextNodeId: 'j3_e', trustDelta: 1, setEmotion: 'happy' },
    ],
    endings: { j3_e: { moodLabel: 'Cheerful', text: `Not once! Even bills look gentler when delivered with a wave.` } },
  }),

  // Barnaby
  makeSimpleTopic('daily_barnaby_craft', 'barnaby', 'daily_slice', 2, {}, {
    moodLabel: 'Sturdy',
    buildText: (id, w, p) => `${resolveRelationshipGreeting(id, w, p)} Cedar joints don’t creak if you respect the grain. Say, you’re settling into Willow Step Cottage nicely.`,
    choices: [
      { id: 'barnaby_craft', label: 'Tell me about building the cottage porches here.', tone: 'warm', nextNodeId: 'b1_e', trustDelta: 1, setEmotion: 'happy' },
    ],
    endings: { b1_e: { moodLabel: 'Fond', text: `Every porch faces the lane so folks see each other pass by. Even when folks get quiet, they’re still under the same sky.` } },
  }),
  makeSimpleTopic('daily_barnaby_benches', 'barnaby', 'daily_slice', 2, {}, {
    moodLabel: 'Relaxed',
    buildText: () => `Planed four cedar plaza benches three springs ago—sit down on any of them whenever your boots start aching!`,
    choices: [
      { id: 'barnaby_d2', label: 'Your joinery holds up through every season cleanly.', tone: 'warm', nextNodeId: 'b2_e', trustDelta: 1, setEmotion: 'relaxed' },
      // Preserved across both Barnaby daily topics so anti-repeat rotation never drops barnaby_craft (DUP-02).
      { id: 'barnaby_craft', label: 'Tell me about building the cottage porches here.', tone: 'warm', nextNodeId: 'b2_e', trustDelta: 1, setEmotion: 'happy' },
    ],
    endings: { b2_e: { moodLabel: 'Proud', text: `Hah! Heartwood cedar and oak pegs—built to outlast three generations of storytellers.` } },
  }),

  // Sora
  makeSimpleTopic('daily_sora_chord', 'sora', 'daily_slice', 2, {}, {
    moodLabel: 'Dreamy',
    buildText: (id, w, p) => `${resolveRelationshipGreeting(id, w, p)} Whenever I tune my violin here, I listen to how stone and pond water carry the harmonics.`,
    choices: [
      { id: 'sora_song', label: 'Play a little piece while we watch the plaza.', tone: 'gentle', nextNodeId: 's1_e', trustDelta: 1, setEmotion: 'relaxed' },
    ],
    endings: { s1_e: { moodLabel: 'Peaceful', text: `Close your eyes for a beat. Even the breeze through the cedar eaves keeps steady time.` } },
  }),
  makeSimpleTopic('daily_sora_tea', 'sora', 'daily_slice', 2, {}, {
    moodLabel: 'Warm',
    buildText: () => `Steeping roasted pear with chamomile takes twice as long as black tea, yet nobody ever wishes it hurried.`,
    choices: [
      { id: 'sora_d2', label: 'Which bench catches the sweetest evening echo?', tone: 'curious', nextNodeId: 's2_e', trustDelta: 1, setEmotion: 'curious' },
    ],
    endings: { s2_e: { moodLabel: 'Serene', text: `The South Mirror Pond bench—notes skim right across the lilypads cleanly.` } },
  }),

  // Toby
  makeSimpleTopic('daily_toby_sketch', 'toby', 'daily_slice', 2, {}, {
    moodLabel: 'Shy',
    buildText: (id, w, p) => `${resolveRelationshipGreeting(id, w, p)} Look how long afternoon shadows stretch across the bridge planks around golden hour.`,
    choices: [
      { id: 'toby_sketch', label: 'Can I peek at what you’re sketching?', tone: 'curious', nextNodeId: 't1_e', trustDelta: 1, setEmotion: 'happy' },
    ],
    endings: { t1_e: { moodLabel: 'Shy-Warm', text: `Mostly the stray marmalade cat and ripples under the wooden bridge. Sit beside me anytime.` } },
  }),
  makeSimpleTopic('daily_toby_charcoal', 'toby', 'daily_slice', 2, {}, {
    moodLabel: 'Curious',
    buildText: () => `Soft willow charcoal smudges everywhere on my sleeves, yet nothing captures wet cobblestones quite as gently.`,
    choices: [
      { id: 'toby_d2', label: 'If I spot stray pastel chalks I’ll drop them by!', tone: 'warm', nextNodeId: 't2_e', trustDelta: 1, setEmotion: 'excited' },
    ],
    endings: { t2_e: { moodLabel: 'Grateful', text: `Whoa—really?! Pale amber chalk would make lantern halos glow off the page!` } },
  }),

  // Nora
  makeSimpleTopic('daily_nora_lanterns', 'nora', 'daily_slice', 2, { flagsTrue: ['foundPostcard'] }, {
    moodLabel: 'Attentive',
    buildText: (_id, w) => w.flags.claraArthurReconciled
      ? `The marigold ribbon is tied to the gazebo rail now. Notice how much brighter the square feels?`
      : `Every quiet lane needs someone willing to listen without rushing. You have a knack for that.`,
    choices: [
      { id: 'nora_tea_chat', label: 'How do you keep hope during quiet seasons?', tone: 'gentle', nextNodeId: 'n1_e', trustDelta: 1, setEmotion: 'relaxed' },
    ],
    endings: { n1_e: { moodLabel: 'Warm', text: `By leaving the porch light on even when nobody is walking down the lane yet.` } },
  }),
  makeSimpleTopic('daily_nora_margins', 'nora', 'daily_slice', 2, {}, {
    moodLabel: 'Wry',
    buildText: () => `Folks donate old paperbacks with bus tickets and pressed clovers tucked inside—like reading two stories at once.`,
    choices: [
      { id: 'nora_d2', label: 'Which shelf should a newcomer browse first?', tone: 'curious', nextNodeId: 'n2_e', trustDelta: 1, setEmotion: 'happy' },
    ],
    endings: { n2_e: { moodLabel: 'Fond', text: `Bottom oak shelf by the window—nothing but cozy maps and autumn recipes.` } },
  }),

  // Pip
  makeSimpleTopic('daily_pip_carp', 'pip', 'daily_slice', 2, { flagsTrue: ['heardBellMystery'] }, {
    moodLabel: 'Hopeful',
    buildText: (id, w, p) => w.flags.bellRestored
      ? `Did you hear that?! The brass bell echoed all the way to Mirror Pond! Even the carp jumped!`
      : `${resolveRelationshipGreeting(id, w, p)} Have you checked the hollow oak by Mirror Pond yet, or asked Barnaby about his tall cedar ladder?`,
    choices: [
      { id: 'pip_skip', label: 'Practice skipping a pebble on Mirror Pond with me later!', tone: 'warm', nextNodeId: 'p1_e', trustDelta: 1, setEmotion: 'excited' },
    ],
    endings: { p1_e: { moodLabel: 'Cheerful', text: `Deal! My record is four skips without splashing a single lilypad.` } },
  }),
  makeSimpleTopic('daily_pip_cinnamon', 'pip', 'daily_slice', 2, { flagsTrue: ['heardBellMystery'] }, {
    moodLabel: 'Eager',
    buildText: () => `Clara lets me eat cinnamon loaf heels on the bakery stoop whenever I sweep pine needles off the boardwalk!`,
    choices: [
      { id: 'pip_d2', label: 'Trade chalk star drawings for warm cinnamon buns?', tone: 'curious', nextNodeId: 'p2_e', trustDelta: 1, setEmotion: 'happy' },
    ],
    endings: { p2_e: { moodLabel: 'Beaming', text: `Best trade deal in Willow Lane history!` } },
  }),
];

export function buildResidentDialogue(
  id: ResidentId,
  world: WorldState,
  phase: TimePhase,
): DialogueSession {
  return selectDialogueSession(id, world, phase, DIALOGUE_TOPICS, buildConcurrentQuestChoices);
}
