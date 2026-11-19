/**
 * Dialogue content module: GOSSIP_TOPICS.
 *
 * Extracted verbatim from narrative.ts (Dialogue Modularization,
 * 2026-11). Topic ids, priorities, conditions, node graphs, text and
 * dynamic builders are byte-identical to the original inline array.
 * Selection/evaluation logic lives in ../dialogueEngine — this file is
 * content-only. Ordering contract: see ./index.ts (src/game/dialogue/).
 */
import {
  DialogueTopic, ResidentId,
} from '../../types';
import { DeclarativeNodeSpec, makeBranchingTopic, makeSimpleTopic, selectThirdPartyGossipSubject } from '../../dialogueEngine';
import { RESIDENTS } from '../../residents';

export const GOSSIP_TOPICS: readonly DialogueTopic[] = [
  // ================= NPC GOSSIP TOPICS =================
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
      const fromName = subject?.fromResidentId ? RESIDENTS[subject.fromResidentId]?.name : undefined;
      const sourcePrefix =
        subject?.provenance === 'firsthand'
          ? 'From what I saw myself'
          : fromName
          ? `Heard from ${fromName}`
          : 'Word along the cobbles is';
      const distortionNote =
        subject?.provenance === 'rumor' && subject.distorted
          ? subject.distortionFlavor === 'exaggerated'
            ? '—though you know how stories swell along the lane—'
            : subject.distortionFlavor === 'uncertain'
            ? '—assuming I remembered it straight—'
            : subject.distortionFlavor === 'softened'
            ? '—or at least gently put—'
            : subject.distortionFlavor === 'misattributed_motive'
            ? '—not sure what sparked it, only that folks took notice—'
            : ''
          : '';

      if (subject?.guarded) {
        return {
          nodes: {
            root: {
              moodLabel: 'Gentle',
              text: `${sourcePrefix}${distortionNote || ', '}things felt a little tense between you and ${target.name} recently. Folktalk fades fast here—a gentle check-in near ${target.homeName} goes a long way.`,
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
              text: `${sourcePrefix}${distortionNote || ', '}you and ${target.name} have become real kindred friends—${target.name} lights right up talking about you over ${favoriteSnippet}!`,
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
              text: `${sourcePrefix}${distortionNote || ', '}${target.name} has been smiling down near ${target.homeName} lately—having a close friend like you around really steadied their week.`,
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
              text: `${fromName ? `${fromName} mentioned` : `${target.name} must have crossed paths with you—`}${distortionNote || ' '}sounds like you and ${target.name} have grown into easy friends! Nothing puts ${target.name} in a better mood than ${favoriteSnippet}.`,
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
              text: `${sourcePrefix}${distortionNote || ', '}you and ${target.name} have been trading more than quick waves lately—ask ${target.name} about ${favoriteSnippet} if you visit ${target.homeName}.`,
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
            text: `${sourcePrefix}${distortionNote || ', '}you crossed paths with ${target.name}, though you two are still mostly strangers—swing by ${target.homeName} when you’ve got a spare minute, especially if ${favoriteSnippet} catches your eye.`,
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
];
