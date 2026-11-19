/**
 * Dialogue content module: BOOK_NOOK_TOPICS.
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
import { getFeaturedBookForDay } from '../../bookNook';

export const BOOK_NOOK_TOPICS: readonly DialogueTopic[] = [
  // Milestone 3 Build 8 — Linden Book Nook visitable interior (Nora).
  // Knowledge boundary: Nora may reference the state of her own nook (the book she saw
  // you browsing, the tea she poured), never anything that happens only in other rooms.
  makeBranchingTopic(
    'side_nora_reading_corner',
    'nora',
    'personal_story',
    16,
    { requiresMet: true, sideFlagsFalse: ['nookVisited'] },
    (_id, world) => {
      const winter = world.season === 'winter';
      return {
        nodes: {
          root: {
            moodLabel: 'Thoughtful',
            text: winter
              ? `Winter is the honest reading season — nothing outside competes with a good page. There’s a lamp-lit corner inside the Book Nook with your name on it, you know. The armchair counts as furniture, the tea counts as fuel.`
              : `People think a book nook is quiet, but it’s really just another way of talking. Come inside sometime — the shelf turns over one featured book a day, the armchair is deep, and my kettle never really cools.`,
            choices: [
              {
                id: 'nora_nook_visit_yes',
                label: 'I’ll come settle in with a book.',
                tone: 'warm',
                nextNodeId: 'nora_nook_visit_end',
                trustDelta: 1,
                reliabilityDelta: 5,
                setEmotion: 'happy',
                setSideFlags: { nookVisited: true },
                recordNpcMemories: [
                  {
                    target: 'nora',
                    id: 'ev_nook_corner_opened',
                    tag: 'nook_corner_opened',
                    category: 'social_impression',
                    valence: 'warm',
                    importance: 3,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['nora'],
                  },
                ],
              },
              {
                id: 'nora_nook_visit_what',
                label: 'What do you keep on the shelf?',
                tone: 'curious',
                nextNodeId: 'nora_nook_shelf_end',
                trustDelta: 1,
                setEmotion: 'happy',
                setSideFlags: { nookVisited: true },
                recordNpcMemories: [
                  {
                    target: 'nora',
                    id: 'ev_nook_corner_opened',
                    tag: 'nook_corner_opened',
                    category: 'social_impression',
                    valence: 'warm',
                    importance: 3,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['nora'],
                  },
                ],
              },
            ],
          },
          nora_nook_visit_end: {
            moodLabel: 'Delighted',
            text: `Then come through the sage door whenever. First rule of the nook: the book finds you, you don’t find it. The shelf rotates one featured title a day — it has opinions.`,
          },
          nora_nook_shelf_end: {
            moodLabel: 'Bright',
            text: `Lane stories, mostly — gazebo letters, pond sketches, a whole year of Clara’s ovens. My lending ledger knows who reads what, and its tea rings tell me which chapters mattered.`,
          },
        },
      };
    },
  ),

  makeBranchingTopic(
    'daily_nora_nook_checkin',
    'nora',
    'daily_slice',
    15,
    { requiresMet: true, sideFlagsTrue: ['nookVisited'], notSeenToday: true },
    (_id, world) => {
      const nk = world.nookState;
      const browsedToday = nk ? nk.shelfBrowsedDay === world.day : false;
      const teaToday = nk ? nk.teaSharedDay === world.day : false;
      const book = getFeaturedBookForDay(world.day);
      const rootText = browsedToday
        ? `You found ${book.title} today — a good one. That chair goes soft for everyone who reads in it, you know. I’ve watched it happen for years.`
        : teaToday
        ? `The reader’s cup suits you. The kettle stays warm all day — the shelf keeps its own counsel until you’re ready for it.`
        : `Today the shelf is humming about ${book.title}. It comes around every few days — patient as ivy, my shelf.`;
      return {
        nodes: {
          root: {
            moodLabel: browsedToday ? 'Warm' : 'Gentle',
            text: rootText,
            choices: [
              {
                id: 'nora_nook_checkin_thanks',
                label: 'The nook has become part of my walks.',
                tone: 'warm',
                nextNodeId: 'nora_nook_checkin_end',
                trustDelta: 1,
                setEmotion: 'happy',
                recordNpcMemories: [
                  {
                    target: 'nora',
                    id: 'ev_nook_ritual_tended',
                    tag: 'nook_ritual_tended',
                    category: 'interaction',
                    valence: 'warm',
                    importance: 2,
                    retention: 'ephemeral',
                    subjectPlayer: true,
                    subjectResidents: ['nora'],
                  },
                ],
              },
            ],
          },
          nora_nook_checkin_end: {
            moodLabel: 'Thoughtful',
            text: `A lending library is just a neighborhood that talks in its sleep. I keep the lamp on so the stories stay awake too.`,
          },
        },
      };
    },
  ),
];
