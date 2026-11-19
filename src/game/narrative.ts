import {
  DialogueChoice,
  DialogueNode,
  DialogueSession,
  EnvironmentalState,
  ResidentId,
  StoryFlags,
  TimePhase,
  WorldState,
} from './types';
import { RESIDENTS } from './residents';

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

export function isChoiceAvailable(
  choice: DialogueChoice,
  flags: StoryFlags,
  trust: number,
): boolean {
  if (choice.requiresFlag && !flags[choice.requiresFlag]) return false;
  if (choice.requiresFalseFlag && flags[choice.requiresFalseFlag]) return false;
  if (choice.minTrust !== undefined && trust < choice.minTrust) return false;
  return true;
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

export function buildResidentDialogue(
  id: ResidentId,
  world: WorldState,
  phase: TimePhase,
): DialogueSession {
  const def = RESIDENTS[id];
  const progress = world.residents[id];
  const f = world.flags;
  const nodes: Record<string, DialogueNode> = {};

  const phaseGreeting =
    phase === 'morning'
      ? 'Morning air feels crisp today.'
      : phase === 'afternoon'
      ? 'The afternoon sun makes the cobbles warm.'
      : phase === 'golden'
      ? 'This golden light always slows the lane down.'
      : 'Lantern dusk is my favorite hour here.';

  // Build customized, branching storylines per resident
  if (id === 'pip') {
    if (!f.heardBellMystery) {
      nodes['root'] = {
        id: 'root',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Curious',
        text: `Hey, new neighbor! ${phaseGreeting} Have you noticed the big brass bell up in the gazebo? Clara says it used to ring every evening, until she and Mr. Arthur stopped speaking three autumns ago.`,
        choices: [
          {
            id: 'pip_promise',
            label: 'Want to help me figure out how to make it ring again?',
            tone: 'warm',
            nextNodeId: 'pip_excited',
            trustDelta: 1,
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
            setFlags: { heardBellMystery: true },
            unlockMemory: {
              id: 'mem_bell_mystery',
              title: 'The Silent Gazebo Bell',
              summary: 'Pip showed me chalk star-maps near the fountain and whispered about the silent gazebo bell.',
              residentId: 'pip',
            },
          },
        ],
      };
      nodes['pip_excited'] = {
        id: 'pip_excited',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Eager',
        text: `Really?! Look closely at the gazebo—Mina says thick ivy grew over the beam, and Toby saw something shiny by the hollow oak! Maybe ask Nora at the Book Nook first—she remembers everything.`,
        choices: [],
        isEnd: true,
      };
      nodes['pip_drawing'] = {
        id: 'pip_drawing',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Bright',
        text: `A constellation map to the gazebo bell! Clara promised cinnamon buns to anyone who hears it chime again. Try talking to Nora at the Book Nook or Toby by the pond—they both saw clues.`,
        choices: [],
        isEnd: true,
      };
    } else if (f.bellRestored) {
      nodes['root'] = {
        id: 'root',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Delighted',
        text: `Did you hear that?! The brass bell echoed all the way to Mirror Pond! Even the carp jumped!`,
        choices: [
          {
            id: 'pip_celebrate',
            label: 'It sounded even sweeter with everyone listening.',
            tone: 'warm',
            nextNodeId: 'pip_end',
            trustDelta: 1,
          },
        ],
      };
      nodes['pip_end'] = {
        id: 'pip_end',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Joyful',
        text: `Clara saved two extra cinnamon buns on the bakery windowsill—one for you and one for Mr. Arthur!`,
        choices: [],
        isEnd: true,
      };
    } else {
      nodes['root'] = {
        id: 'root',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Hopeful',
        text: `${phaseGreeting} Have you checked the hollow oak by Mirror Pond yet, or asked Barnaby about his tall cedar ladder?`,
        choices: [
          {
            id: 'pip_skip',
            label: 'Practice skipping a pebble on Mirror Pond with me later!',
            tone: 'warm',
            nextNodeId: 'pip_stone',
            trustDelta: 1,
          },
        ],
      };
      nodes['pip_stone'] = {
        id: 'pip_stone',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Cheerful',
        text: `Deal! My record is four skips without splashing a single lilypad.`,
        choices: [],
        isEnd: true,
      };
    }
    return { residentId: id, currentNodeId: 'root', nodes };
  }

  if (id === 'nora') {
    if (!f.foundPostcard) {
      nodes['root'] = {
        id: 'root',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Thoughtful',
        text: `Ah, welcome to Linden Book Nook. ${phaseGreeting} People here carry their stories quietly, like pressed leaves between pages.`,
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
      };
      nodes['nora_story'] = {
        id: 'nora_story',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Reflective',
        text: `I do. It wasn’t anger that silenced it—just two proud friends grieving a stormy harvest. Wait—inside this almanac is an unmailed postcard Arthur’s sister sent from the coast, and Jun forgot to deliver it.`,
        choices: [
          {
            id: 'nora_take_card',
            label: 'Let me take the postcard to Jun so it reaches Arthur properly.',
            tone: 'practical',
            nextNodeId: 'nora_given',
            trustDelta: 1,
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
          },
        ],
      };
      nodes['nora_given'] = {
        id: 'nora_given',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Warm',
        text: `Jun keeps his mail satchel slung tight, though he’s terribly shy about admitting a mistake. Hand this to him gently.`,
        choices: [],
        isEnd: true,
      };
      nodes['nora_ribbon'] = {
        id: 'nora_ribbon',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Fond',
        text: `Silk marigold, saved for the evening the bell chimes again. Take this postcard to Jun too—time moves faster when neighbors share small truths.`,
        choices: [],
        isEnd: true,
      };
      nodes['nora_almanac'] = {
        id: 'nora_almanac',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Amused',
        text: `Our town almanac! Three years ago, Arthur oiled every clock in town except the gazebo spire. If you ask around, Pip knows more than he lets on.`,
        choices: [],
        isEnd: true,
      };
    } else {
      nodes['root'] = {
        id: 'root',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: f.claraArthurReconciled ? 'Serene' : 'Attentive',
        text: f.claraArthurReconciled
          ? `The marigold ribbon is tied to the gazebo rail now. Notice how much brighter the square feels?`
          : `Every quiet lane needs someone willing to listen without rushing. You have a knack for that.`,
        choices: [
          {
            id: 'nora_tea_chat',
            label: 'How do you keep hope during quiet seasons?',
            tone: 'gentle',
            nextNodeId: 'nora_wisdom',
            trustDelta: 1,
          },
        ],
      };
      nodes['nora_wisdom'] = {
        id: 'nora_wisdom',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Warm',
        text: `By leaving the porch light on even when nobody is walking down the lane yet.`,
        choices: [],
        isEnd: true,
      };
    }
    return { residentId: id, currentNodeId: 'root', nodes };
  }

  if (id === 'jun') {
    if (f.foundPostcard && !f.deliveredPostcard) {
      nodes['root'] = {
        id: 'root',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Flustered',
        text: `Whoa—is that the coastal postcard with the lighthouse stamp?! I swore it slipped out of my satchel last autumn!`,
        choices: [
          {
            id: 'jun_reassure',
            label: 'It stayed safe in Nora’s almanac. Let’s deliver it to Arthur together.',
            tone: 'warm',
            nextNodeId: 'jun_relieved',
            trustDelta: 1,
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
            setFlags: { deliveredPostcard: true },
          },
        ],
      };
      nodes['jun_relieved'] = {
        id: 'jun_relieved',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Grateful',
        text: `Thank you! I’ll slip it right into Arthur’s brass box—if you visit him with kindness, I bet he’ll finally open up about the gazebo bell.`,
        choices: [],
        isEnd: true,
      };
    } else {
      nodes['root'] = {
        id: 'root',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Cheerful',
        text: `${phaseGreeting} I’ve already walked the cobblestone loop twice today. Have you checked your own Willow Mailbox lately?`,
        choices: [
          {
            id: 'jun_gossip',
            label: 'Who seems most in need of company today?',
            tone: 'curious',
            nextNodeId: 'jun_hint',
            trustDelta: 1,
          },
          {
            id: 'jun_lanterns',
            label: 'Think we should light the plaza festoon lanterns tonight?',
            tone: 'warm',
            nextNodeId: 'jun_lantern_yes',
            setFlags: { lanternsLit: true },
            trustDelta: 1,
          },
        ],
      };
      nodes['jun_hint'] = {
        id: 'jun_hint',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Observant',
        text: `Arthur lingers near the gazebo at sunset pretending to adjust his pocket watch, and Clara always bakes one extra loaf she leaves wrapped in linen.`,
        choices: [],
        isEnd: true,
      };
      nodes['jun_lantern_yes'] = {
        id: 'jun_lantern_yes',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Bright',
        text: `Oh, I’ve been waiting for someone to say that! I’ll switch on the warm string lanterns along the plaza eaves.`,
        choices: [],
        isEnd: true,
      };
    }
    return { residentId: id, currentNodeId: 'root', nodes };
  }

  if (id === 'mina') {
    nodes['root'] = {
      id: 'root',
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: f.plantedMoonPetals ? 'Radiant' : 'Gentle',
      text: !f.plantedMoonPetals
        ? `${phaseGreeting} My moon-petal seedlings finally sprouted in the greenhouse! They bloom happiest when neighbors look out for one another.`
        : `Look at those window boxes along the lane—your kindness gave the soil real spring energy.`,
      choices: [
        {
          id: 'mina_plant',
          label: 'Let’s plant moon-petals in the plaza window boxes!',
          tone: 'warm',
          nextNodeId: 'mina_planted',
          requiresFalseFlag: 'plantedMoonPetals',
          trustDelta: 1,
          setFlags: { plantedMoonPetals: true },
          unlockMemory: {
            id: 'mem_moon_petals',
            title: 'Moon-Petals on the Sill',
            summary: 'Mina and I tucked fresh moon-petal seedlings into the neighborhood planter boxes.',
            residentId: 'mina',
          },
        },
        {
          id: 'mina_ivy',
          label: 'Know anything about the ivy tangled on the gazebo?',
          tone: 'curious',
          nextNodeId: 'mina_ivy_tip',
          requiresFlag: 'heardBellMystery',
          trustDelta: 1,
        },
        {
          id: 'mina_tea',
          label: 'Do you grow chamomile for Sora’s tea cart?',
          tone: 'curious',
          nextNodeId: 'mina_chamomile',
          trustDelta: 1,
        },
      ],
    };
    nodes['mina_planted'] = {
      id: 'mina_planted',
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: 'Joyful',
      text: `Done! Watch the cottage planters around the square—warm apricot and lavender blossoms are already waking up.`,
      choices: [],
      isEnd: true,
    };
    nodes['mina_ivy_tip'] = {
      id: 'mina_ivy_tip',
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: 'Helpful',
      text: `It’s gentle creeping ivy—no need to hack it down! Barnaby has a tall cedar ladder in Pinecone Woodshop if we want to weave it neatly aside.`,
      choices: [],
      isEnd: true,
    };
    nodes['mina_chamomile'] = {
      id: 'mina_chamomile',
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: 'Warm',
      text: `Every morning! Sora dries the blossoms by her tea cart—one cup of that could soften even Arthur’s stubborn heart.`,
      choices: [],
      isEnd: true,
    };
    return { residentId: id, currentNodeId: 'root', nodes };
  }

  if (id === 'barnaby') {
    nodes['root'] = {
      id: 'root',
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: f.borrowedBarnabyLadder ? 'Sturdy' : 'Gruff-Warm',
      text: !f.borrowedBarnabyLadder
        ? `${phaseGreeting} Cedar joints don’t creak if you respect the grain. Say, you’re the new arrival at Willow Step Cottage, aren’t you?`
        : `The gazebo rafters are sound as oak, neighbor. Give that fountain valve a turn too if you pass the plaza.`,
      choices: [
        {
          id: 'barnaby_ladder',
          label: 'Could I borrow your cedar ladder to clear the gazebo ivy?',
          tone: 'practical',
          nextNodeId: 'barnaby_lend',
          requiresFlag: 'heardBellMystery',
          requiresFalseFlag: 'borrowedBarnabyLadder',
          trustDelta: 1,
          setFlags: { borrowedBarnabyLadder: true, clearedGazeboIvy: true },
          unlockMemory: {
            id: 'mem_gazebo_cleared',
            title: 'Sunlit Rafters',
            summary: 'Barnaby lent his cedar ladder and we gently cleared the creeping ivy off the gazebo bell beam.',
            residentId: 'barnaby',
          },
        },
        {
          id: 'barnaby_fountain',
          label: 'Do you know why the plaza stone fountain stopped running?',
          tone: 'curious',
          nextNodeId: 'barnaby_valve',
          requiresFalseFlag: 'repairedFountain',
          trustDelta: 1,
          setFlags: { repairedFountain: true },
          unlockMemory: {
            id: 'mem_fountain_fixed',
            title: 'Water in the Plaza',
            summary: 'With Barnaby’s brass wrench tip, the mossy stone fountain in the center square flows once more.',
            residentId: 'barnaby',
          },
        },
        {
          id: 'barnaby_craft',
          label: 'Tell me about building the cottage porches here.',
          tone: 'warm',
          nextNodeId: 'barnaby_pride',
          trustDelta: 1,
        },
      ],
    };
    nodes['barnaby_lend'] = {
      id: 'barnaby_lend',
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: 'Pleased',
      text: `Hah! I was hoping someone would ask. Let’s haul it up right now—there, the ivy is tucked along the posts and the brass bell frame is clear in the sun again.`,
      choices: [],
      isEnd: true,
    };
    nodes['barnaby_valve'] = {
      id: 'barnaby_valve',
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: 'Helpful',
      text: `Just an autumn leaf caught in the brass intake! Let me tap it loose for you—listen, water’s already bubbling back into the plaza basin.`,
      choices: [],
      isEnd: true,
    };
    nodes['barnaby_pride'] = {
      id: 'barnaby_pride',
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: 'Fond',
      text: `Every porch in Little Somewhere faces the lane so folks see each other pass by. Even when folks get quiet, they’re still under the same sky.`,
      choices: [],
      isEnd: true,
    };
    return { residentId: id, currentNodeId: 'root', nodes };
  }

  if (id === 'sora') {
    nodes['root'] = {
      id: 'root',
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: f.brewedChamomileTea ? 'Melodic' : 'Dreamy',
      text: `${phaseGreeting} Whenever I tune my violin here, I hear a gap in the neighborhood’s chord—like a warm brass chime waiting to answer.`,
      choices: [
        {
          id: 'sora_tea',
          label: 'Could you steep two cups of chamomile-pear tea for Arthur and Clara?',
          tone: 'warm',
          nextNodeId: 'sora_brewed',
          requiresFalseFlag: 'brewedChamomileTea',
          trustDelta: 1,
          setFlags: { brewedChamomileTea: true },
          unlockMemory: {
            id: 'mem_chamomile_tea',
            title: 'Chamomile-Pear Flask',
            summary: 'Sora brewed a warm flask of chamomile-pear tea meant to soften old silences.',
            residentId: 'sora',
          },
        },
        {
          id: 'sora_song',
          label: 'Play a little piece while we watch the plaza.',
          tone: 'gentle',
          nextNodeId: 'sora_play',
          trustDelta: 1,
        },
      ],
    };
    nodes['sora_brewed'] = {
      id: 'sora_brewed',
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: 'Warm',
      text: `Of course. Honey, roasted pear, and Mina’s chamomile. Take a flask to Arthur—sometimes warm tea speaks faster than an apology.`,
      choices: [],
      isEnd: true,
    };
    nodes['sora_play'] = {
      id: 'sora_play',
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: 'Peaceful',
      text: `Close your eyes for a beat. Even before the bell rings, the wind through the cedar eaves keeps steady time.`,
      choices: [],
      isEnd: true,
    };
    return { residentId: id, currentNodeId: 'root', nodes };
  }

  if (id === 'toby') {
    nodes['root'] = {
      id: 'root',
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: f.foundBrassClapper ? 'Relieved' : 'Shy',
      text: !f.foundBrassClapper
        ? `${phaseGreeting} Um… don’t tell Mr. Arthur I told you, but I saw a shiny brass bell-clapper wrapped in blue cloth inside the Hollow Oak root by Mirror Pond.`
        : `I drew the gazebo with the bell shining in my sketchbook. Looks way nicer without all the gloom.`,
      choices: [
        {
          id: 'toby_clapper',
          label: 'Let’s rescue the brass clapper from the hollow oak together.',
          tone: 'practical',
          nextNodeId: 'toby_found',
          requiresFalseFlag: 'foundBrassClapper',
          trustDelta: 1,
          setFlags: { foundBrassClapper: true },
          unlockMemory: {
            id: 'mem_brass_clapper',
            title: 'The Hidden Brass Clapper',
            summary: 'Toby showed me where the gazebo bell’s brass clapper lay wrapped in blue linen inside the hollow oak.',
            residentId: 'toby',
          },
        },
        {
          id: 'toby_sketch',
          label: 'Can I peek at what you’re sketching?',
          tone: 'curious',
          nextNodeId: 'toby_art',
          trustDelta: 1,
        },
      ],
    };
    nodes['toby_found'] = {
      id: 'toby_found',
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: 'Proud',
      text: `Got it! Still polished and warm! Only Arthur knows the pin-lock to fit it back inside the gazebo bell—he won’t be mad if you bring it gently.`,
      choices: [],
      isEnd: true,
    };
    nodes['toby_art'] = {
      id: 'toby_art',
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: 'Shy-Warm',
      text: `Mostly the stray marmalade cat and how shadows stretch across the cobbles at four o’clock. You can sit on the bridge wall anytime if you want to watch.`,
      choices: [],
      isEnd: true,
    };
    return { residentId: id, currentNodeId: 'root', nodes };
  }

  if (id === 'clara') {
    const canMediate =
      (f.deliveredPostcard || f.brewedChamomileTea || f.foundBrassClapper) && !f.claraArthurReconciled;

    if (f.claraArthurReconciled) {
      nodes['root'] = {
        id: 'root',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Radiant',
        text: `Look at those café tables out in the sun again! Arthur even fixed the bakery’s wall clock while the loaves were rising.`,
        choices: [
          {
            id: 'clara_hug',
            label: 'The whole lane feels lighter with you two talking again.',
            tone: 'warm',
            nextNodeId: 'clara_peace',
            trustDelta: 1,
          },
        ],
      };
      nodes['clara_peace'] = {
        id: 'clara_peace',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Grateful',
        text: `We forgot that pride tastes bitter compared to warm bread shared on the square. Thank you for nudging two stubborn neighbors home.`,
        choices: [],
        isEnd: true,
      };
    } else {
      nodes['root'] = {
        id: 'root',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Wistful',
        text: `${phaseGreeting} I keep baking one loaf too many every afternoon, out of habit. Arthur used to come by when the crust crackled—before the storm that cracked the gazebo bell beam.`,
        choices: [
          {
            id: 'clara_listen',
            label: 'What really happened between you and Arthur?',
            tone: 'gentle',
            nextNodeId: 'clara_story',
            trustDelta: 1,
          },
          ...(canMediate
            ? [
                {
                  id: 'clara_bridge_baking',
                  label: 'Invite Arthur to share warm sourdough by the fountain instead of apologizing.',
                  tone: 'warm' as const,
                  nextNodeId: 'clara_agrees',
                  trustDelta: 1,
                  setFlags: {
                    mediationStyle: 'shared_baking' as const,
                    claraArthurReconciled: true,
                    lanternsLit: true,
                  },
                  unlockMemory: {
                    id: 'mem_reconciliation_bread',
                    title: 'A Warm Loaf Bridge',
                    summary: 'Clara agreed to set out sunny bakery tables and share warm sourdough with Arthur without keeping score.',
                    residentId: 'clara' as ResidentId,
                  },
                },
                {
                  id: 'clara_bridge_truth',
                  label: 'Tell her Arthur never threw away the bell—he kept the clapper safe.',
                  tone: 'gentle' as const,
                  nextNodeId: 'clara_truth',
                  requiresFlag: 'foundBrassClapper' as keyof StoryFlags,
                  trustDelta: 1,
                  setFlags: {
                    mediationStyle: 'gentle_truth' as const,
                    claraArthurReconciled: true,
                    lanternsLit: true,
                  },
                  unlockMemory: {
                    id: 'mem_reconciliation_truth',
                    title: 'Kept Safe in Blue Linen',
                    summary: 'Hearing that Arthur safeguarded the brass clapper softened Clara’s long silence.',
                    residentId: 'clara' as ResidentId,
                  },
                },
              ]
            : []),
        ],
      };
      nodes['clara_story'] = {
        id: 'clara_story',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Reflective',
        text: `I snapped that he cared more about brass gears than bruised neighbors, and he quietly took the bell down the next morning. Truth is, I missed the sound more than I could admit.`,
        choices: [],
        isEnd: true,
      };
      nodes['clara_agrees'] = {
        id: 'clara_agrees',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Moved',
        text: `No grand speeches… just warm sourdough and open tables in the sun. Alright. Tell Arthur I’ll meet him by the gazebo at Golden Hour.`,
        choices: [],
        isEnd: true,
      };
      nodes['clara_truth'] = {
        id: 'clara_truth',
        speakerName: def.name,
        speakerRole: def.role,
        moodLabel: 'Softened',
        text: `Wrapped in blue linen? That stubborn old clockmaker… he never stopped caring about this town. I’ll walk over to the gazebo this evening and hear him out.`,
        choices: [],
        isEnd: true,
      };
    }
    return { residentId: id, currentNodeId: 'root', nodes };
  }

  // Arthur
  const readyToRestore = f.foundBrassClapper && f.clearedGazeboIvy && !f.bellRestored;
  if (f.bellRestored) {
    nodes['root'] = {
      id: 'root',
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: 'At Peace',
      text: `${phaseGreeting} Hear how steady the bell’s echo sits against the hills? Clara even brought rosemary butter to the workshop.`,
      choices: [
        {
          id: 'arthur_ring_note',
          label: 'You built something that brings everyone together.',
          tone: 'warm',
          nextNodeId: 'arthur_peace',
          trustDelta: 1,
        },
      ],
    };
    nodes['arthur_peace'] = {
      id: 'arthur_peace',
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: 'Warm',
      text: `I only wound the spring, neighbor. You reminded the whole lane why it mattered.`,
      choices: [],
      isEnd: true,
    };
  } else {
    nodes['root'] = {
      id: 'root',
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: 'Guarded',
      text: `${phaseGreeting} Forgive the clutter—old brass gears take patience, and I’ve been out of practice with visitors.`,
      choices: [
        ...(f.deliveredPostcard
          ? [
              {
                id: 'arthur_postcard',
                label: 'Jun and I found your sister’s coastal postcard.',
                tone: 'warm' as const,
                nextNodeId: 'arthur_softens',
                trustDelta: 1,
              },
            ]
          : []),
        ...(f.brewedChamomileTea
          ? [
              {
                id: 'arthur_tea',
                label: 'Sora sent over warm chamomile-pear tea for you.',
                tone: 'gentle' as const,
                nextNodeId: 'arthur_softens',
                trustDelta: 1,
              },
            ]
          : []),
        ...(readyToRestore
          ? [
              {
                id: 'arthur_restore_bell',
                label: 'The ivy is cleared and we found the brass clapper—let’s hang it!',
                tone: 'practical' as const,
                nextNodeId: 'arthur_restores',
                trustDelta: 2,
                setFlags: {
                  bellRestored: true,
                  claraArthurReconciled: true,
                  lanternsLit: true,
                  mediationStyle:
                    f.mediationStyle === 'none' ? ('festival_ring' as const) : f.mediationStyle,
                },
                unlockMemory: {
                  id: 'mem_bell_restored',
                  title: 'First Chime in Three Autumns',
                  summary: 'Arthur climbed Barnaby’s cedar ladder and fitted the brass clapper back inside the Gazebo Bell, filling Little Somewhere with golden sound.',
                  residentId: 'arthur' as ResidentId,
                },
              },
            ]
          : []),
        {
          id: 'arthur_smalltalk',
          label: 'What makes a good town chime, Arthur?',
          tone: 'curious',
          nextNodeId: 'arthur_craft',
          trustDelta: progress.met ? 0 : 1,
        },
      ],
    };
    nodes['arthur_softens'] = {
      id: 'arthur_softens',
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: 'Touched',
      text: `My word… I thought everyone preferred silence to my tinkering. If someone clears the ivy off the gazebo and finds the clapper I hid by the pond, I’d gladly hang it again.`,
      choices: [],
      isEnd: true,
    };
    nodes['arthur_restores'] = {
      id: 'arthur_restores',
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: 'Moved',
      text: `You cleared the rafters and kept the clapper safe… Come on then, let’s fit the brass pin together. Walk up to the Gazebo anytime and give the bell rope a pull!`,
      choices: [],
      isEnd: true,
    };
    nodes['arthur_craft'] = {
      id: 'arthur_craft',
      speakerName: def.name,
      speakerRole: def.role,
      moodLabel: 'Thoughtful',
      text: `A warm alloy—never shrill. Something that tells folks supper’s nearly ready and nobody has to hurry alone.`,
      choices: [],
      isEnd: true,
    };
  }

  return { residentId: id, currentNodeId: 'root', nodes };
}
