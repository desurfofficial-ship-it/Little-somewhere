/**
 * Dialogue content module: BELL_QUEST_TOPICS.
 *
 * Extracted verbatim from narrative.ts (Dialogue Modularization,
 * 2026-11). Topic ids, priorities, conditions, node graphs, text and
 * dynamic builders are byte-identical to the original inline array.
 * Selection/evaluation logic lives in ../dialogueEngine — this file is
 * content-only. Ordering contract: see ./index.ts (src/game/dialogue/).
 */
import {
  DialogueTopic,
} from '../../types';
import { makeBranchingTopic, phaseGreet, resolveRelationshipGreeting } from '../../dialogueEngine';

export const BELL_QUEST_TOPICS: readonly DialogueTopic[] = [
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
              unlockMemory: {
                id: 'mem_postcard_sent',
                title: 'Delayed Delivery',
                summary:
                  'Suggested Jun tuck a fresh welcome note beside Arthur’s recovered coastal postcard.',
                residentId: 'jun',
              },
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
];
