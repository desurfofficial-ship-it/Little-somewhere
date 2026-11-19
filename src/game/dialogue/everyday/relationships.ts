/**
 * Dialogue content module: RELATIONSHIP_TOPICS.
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
import { makeSimpleTopic } from '../../dialogueEngine';
import { RESIDENTS } from '../../residents';

export const RELATIONSHIP_TOPICS: readonly DialogueTopic[] = [
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
];
