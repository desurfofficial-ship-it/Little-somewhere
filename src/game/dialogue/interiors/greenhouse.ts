/**
 * Dialogue content module: GREENHOUSE_TOPICS.
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
import { makeBranchingTopic } from '../../dialogueEngine';

export const GREENHOUSE_TOPICS: readonly DialogueTopic[] = [
  // Milestone 3 Build 6 — Sunbeam Greenhouse shared growing corner (Mina).
  // Knowledge boundary: Mina may reference the state of her own greenhouse (pots she can
  // see during her daily tending), never anything that happens only inside the cottage.
  makeBranchingTopic(
    'side_mina_greenhouse_corner',
    'mina',
    'personal_story',
    16,
    { requiresMet: true, sideFlagsFalse: ['greenhousePlanted'] },
    (_id, world) => {
      const winter = world.season === 'winter';
      return {
        nodes: {
          root: {
            moodLabel: 'Hopeful',
            text: winter
              ? `My glasshouse keeps the frost out all winter, you know. There’s a corner by the west shelf with four empty terracotta pots—any neighbor is welcome to sow something there and let it rest till spring. Have you peeked inside yet?`
              : `There’s a sunny corner by my west shelf with four empty terracotta pots sitting in the light. I keep it open for neighbors—sow something, water it at the rain barrel, and it grows a little every night. Have you peeked inside Sunbeam Greenhouse yet?`,
            choices: [
              {
                id: 'mina_greenhouse_corner_yes',
                label: 'I’ll step inside and read your planting notes.',
                tone: 'warm',
                nextNodeId: 'mina_greenhouse_corner_end',
                trustDelta: 1,
                reliabilityDelta: 5,
                setEmotion: 'happy',
                recordNpcMemories: [
                  {
                    target: 'mina',
                    id: 'ev_greenhouse_corner_shared',
                    tag: 'greenhouse_corner_shared',
                    category: 'social_impression',
                    valence: 'warm',
                    importance: 3,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['mina'],
                  },
                ],
              },
              {
                id: 'mina_greenhouse_corner_curious',
                label: 'What grows best in a glasshouse?',
                tone: 'curious',
                nextNodeId: 'mina_greenhouse_tip_end',
                trustDelta: 1,
                setEmotion: 'happy',
                recordNpcMemories: [
                  {
                    target: 'mina',
                    id: 'ev_greenhouse_corner_shared',
                    tag: 'greenhouse_corner_shared',
                    category: 'social_impression',
                    valence: 'warm',
                    importance: 3,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['mina'],
                  },
                ],
              },
            ],
          },
          mina_greenhouse_corner_end: {
            moodLabel: 'Delighted',
            text: `Do! My planting notes sit right on the oak worktable with a little starter packet beside them. Water each pot once a day—what is watered grows, and what waits simply waits.`,
          },
          mina_greenhouse_tip_end: {
            moodLabel: 'Bright',
            text: `Chamomile and lavender are quick and generous—two gentle nights of watering. Lemon thyme takes three but sings loudest in warm bread. And nothing ever dies of patience in my glasshouse, I promise.`,
          },
        },
      };
    },
  ),

  makeBranchingTopic(
    'daily_mina_greenhouse_checkin',
    'mina',
    'daily_slice',
    15,
    { requiresMet: true, sideFlagsTrue: ['greenhousePlanted'], notSeenToday: true },
    (_id, world) => {
      const gh = world.greenhouseState;
      const plots = gh?.plots ?? [];
      const ready = plots.filter((p) => p.stage >= 3 && p.cropId).length;
      const thirsty = plots.filter((p) => p.cropId && p.stage < 3 && !p.wateredToday).length;
      const winter = world.season === 'winter';
      const rootText = ready > 0
        ? `I peeked past your corner this morning—something on the shared shelf is ready! Snip it gently and it will keep growing back toward the next sowing.`
        : thirsty > 0
        ? `Your pots on the shared shelf look thirsty today. The rain barrel hook has the copper can waiting whenever you pass through.`
        : winter
        ? `The glasshouse holds the frost out beautifully, doesn’t it? Your pots are resting safe until spring—patience is just winter’s kind of watering.`
        : `Your corner pots look bright and well-watered—whatever you sowed is settling in nicely. Give them a few sunny nights.`;
      return {
        nodes: {
          root: {
            moodLabel: ready > 0 ? 'Excited' : winter ? 'Cozy' : 'Warm',
            text: rootText,
            choices: [
              {
                id: 'mina_greenhouse_checkin_thanks',
                label: 'Thank you for sharing the corner with me.',
                tone: 'warm',
                nextNodeId: 'mina_greenhouse_checkin_end',
                trustDelta: 1,
                setEmotion: 'happy',
                recordNpcMemories: [
                  {
                    target: 'mina',
                    id: 'ev_greenhouse_corner_tended',
                    tag: 'greenhouse_corner_tended',
                    category: 'interaction',
                    valence: 'warm',
                    importance: 2,
                    retention: 'ephemeral',
                    subjectPlayer: true,
                    subjectResidents: ['mina'],
                  },
                ],
              },
            ],
          },
          mina_greenhouse_checkin_end: {
            moodLabel: 'Gentle',
            text: `Growing things for neighbors is half the joy of keeping a glasshouse. The other half is smelling lemon thyme on somebody’s warm bread!`,
          },
        },
      };
    },
  ),
];
