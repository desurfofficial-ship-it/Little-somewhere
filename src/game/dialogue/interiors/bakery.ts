/**
 * Dialogue content module: BAKERY_TOPICS.
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
import { getBakeForDay } from '../../bakery';

export const BAKERY_TOPICS: readonly DialogueTopic[] = [
  // Milestone 3 Build 7 — Hearth & Crumb Bakery visitable interior (Clara).
  // Knowledge boundary: Clara may reference the state of her own bakery (the bake she
  // pulls, the kneading help she watched, the share she handed over at her own counter),
  // never anything that happens only inside the cottage or greenhouse.
  makeBranchingTopic(
    'side_clara_bakery_kitchen',
    'clara',
    'personal_story',
    16,
    { requiresMet: true, sideFlagsFalse: ['bakeryVisited'] },
    (_id, world) => {
      const winter = world.season === 'winter';
      return {
        nodes: {
          root: {
            moodLabel: 'Proud',
            text: winter
              ? `The old brick dome holds winter out better than any coat I own. You know, neighbors keep walking past my door and only ever smelling it — would you like to come inside Hearth & Crumb sometime? There’s a prep table with your name on the flour.`
              : `Everyone knows the smell of my sourdough, but hardly anyone has stood where it’s made. Come inside Hearth & Crumb sometime — check the dome, help me knead, take a warm loaf home. The door’s never locked when the chimney’s talking.`,
            choices: [
              {
                id: 'clara_bakery_visit_yes',
                label: 'I’d love to see where the warm loaves are born.',
                tone: 'warm',
                nextNodeId: 'clara_bakery_visit_end',
                trustDelta: 1,
                reliabilityDelta: 5,
                setEmotion: 'happy',
                setSideFlags: { bakeryVisited: true },
                recordNpcMemories: [
                  {
                    target: 'clara',
                    id: 'ev_bakery_kitchen_opened',
                    tag: 'bakery_kitchen_opened',
                    category: 'social_impression',
                    valence: 'warm',
                    importance: 3,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['clara'],
                  },
                ],
              },
              {
                id: 'clara_bakery_visit_secret',
                label: 'What’s the trick to a good crust?',
                tone: 'curious',
                nextNodeId: 'clara_bakery_secret_end',
                trustDelta: 1,
                setEmotion: 'happy',
                setSideFlags: { bakeryVisited: true },
                recordNpcMemories: [
                  {
                    target: 'clara',
                    id: 'ev_bakery_kitchen_opened',
                    tag: 'bakery_kitchen_opened',
                    category: 'social_impression',
                    valence: 'warm',
                    importance: 3,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['clara'],
                  },
                ],
              },
            ],
          },
          clara_bakery_visit_end: {
            moodLabel: 'Delighted',
            text: `Then it’s settled! Step through the porch door whenever the awning’s up. First thing you do is lift the dome lid — a baker who doesn’t look isn’t a baker, she’s just a watcher.`,
          },
          clara_bakery_secret_end: {
            moodLabel: 'Bright',
            text: `Steam, patience, and never poking the crust before it’s ready to sing. Come peek in the dome and I’ll show you what “ready” sounds like — my recipe notes live on the east shelf, fingerprints and all.`,
          },
        },
      };
    },
  ),

  makeBranchingTopic(
    'daily_clara_bakery_checkin',
    'clara',
    'daily_slice',
    15,
    { requiresMet: true, sideFlagsTrue: ['bakeryVisited'], notSeenToday: true },
    (_id, world) => {
      const bk = world.bakeryState;
      const kneadedToday = bk ? bk.kneadedDay === world.day : false;
      const sharedToday = bk ? bk.loafSharedDay === world.day : false;
      const bake = getBakeForDay(world.day);
      const rootText = kneadedToday
        ? `You still fold dough like you mean it — that batch turned out twice as kind for your help. Anything good waiting in your satchel today?`
        : sharedToday
        ? `Did the ${bake.shareItemId ? bake.label.toLowerCase() : 'honey butter'} treat you well? Tomorrow the dome wants to try something new — I can feel it in the embers.`
        : bake.id === 'oven_rest'
        ? `I’m letting the old dome rest its bones today — embers only. Come by tomorrow; the sunflower sourdough has been whispering to me all afternoon.`
        : `Today’s ${bake.label.toLowerCase()} came out singing! There’s a share with your name on it at the counter, if you haven’t already sneaked past it.`;
      return {
        nodes: {
          root: {
            moodLabel: kneadedToday ? 'Warm' : bake.id === 'oven_rest' ? 'Cozy' : 'Cheerful',
            text: rootText,
            choices: [
              {
                id: 'clara_bakery_checkin_thanks',
                label: 'Your kitchen has become part of my mornings.',
                tone: 'warm',
                nextNodeId: 'clara_bakery_checkin_end',
                trustDelta: 1,
                setEmotion: 'happy',
                recordNpcMemories: [
                  {
                    target: 'clara',
                    id: 'ev_bakery_ritual_tended',
                    tag: 'bakery_ritual_tended',
                    category: 'interaction',
                    valence: 'warm',
                    importance: 2,
                    retention: 'ephemeral',
                    subjectPlayer: true,
                    subjectResidents: ['clara'],
                  },
                ],
              },
            ],
          },
          clara_bakery_checkin_end: {
            moodLabel: 'Gentle',
            text: `A bakery is only half bread, you know. The other half is knowing somebody will walk in hungry for it.`,
          },
        },
      };
    },
  ),
];
