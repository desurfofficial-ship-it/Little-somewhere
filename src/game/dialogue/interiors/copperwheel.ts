/**
 * Dialogue content module: COPPERWHEEL_TOPICS.
 *
 * Extracted verbatim from narrative.ts (Milestone 3 Build 9, Copperwheel
 * Cottage; rebased onto the Dialogue Modularization module layout,
 * 2026-11). Topic ids, priorities, conditions, node graphs, text and
 * dynamic builders are byte-identical to the original inline array.
 * Selection/evaluation logic lives in ../dialogueEngine — this file is
 * content-only. Ordering contract: see ./index.ts (src/game/dialogue/).
 */
import {
  DialogueTopic,
} from '../../types';
import { makeBranchingTopic } from '../../dialogueEngine';
import { getProjectForDay } from '../../copperwheel';

export const COPPERWHEEL_TOPICS: readonly DialogueTopic[] = [

  // Milestone 3 Build 9 — Copperwheel Cottage visitable interior (Arthur).
  // Knowledge boundary: Arthur may reference the state of his own workshop (the project he
  // left on the bench, the kettle someone used, the ledger at his shelf), never anything
  // that happens only in other rooms.
  makeBranchingTopic(
    'side_arthur_workshop_bench',
    'arthur',
    'personal_story',
    16,
    { requiresMet: true, sideFlagsFalse: ['copperwheelVisited'] },
    (_id, world) => {
      const winter = world.season === 'winter';
      const bellRestored = world.flags.bellRestored;
      return {
        nodes: {
          root: {
            moodLabel: 'Careful',
            text: winter
              ? `Winter is honest work for a clockmaker — cold brass either fits or it doesn’t. You know, folks walk past my door and only ever hear the tick. Would you like to come inside Copperwheel sometime? The bench gets a visitor’s chair these days.`
              : bellRestored
              ? `Since the bell came back to the gazebo, I’ve kept the bench clear for visitors — there’s tea in the copper kettle and one small mend waiting on the felt. Come inside Copperwheel sometime and watch the escapements breathe.`
              : `Most neighbors only know my windows by the lamplight. But there’s a bench inside Copperwheel with one small mend waiting on the felt, and the kettle’s usually warm. Come by sometime — mind the loupe, it’s older than both of us.`,
            choices: [
              {
                id: 'arthur_workshop_visit_yes',
                label: 'I’d love to watch a clock come back to ticking.',
                tone: 'warm',
                nextNodeId: 'arthur_workshop_visit_end',
                trustDelta: 1,
                reliabilityDelta: 5,
                setEmotion: 'happy',
                setSideFlags: { copperwheelVisited: true },
                recordNpcMemories: [
                  {
                    target: 'arthur',
                    id: 'ev_workshop_opened',
                    tag: 'workshop_opened',
                    category: 'social_impression',
                    valence: 'warm',
                    importance: 3,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['arthur'],
                  },
                ],
              },
              {
                id: 'arthur_workshop_visit_how',
                label: 'What makes a clock tick steady?',
                tone: 'curious',
                nextNodeId: 'arthur_workshop_secret_end',
                trustDelta: 1,
                setEmotion: 'happy',
                setSideFlags: { copperwheelVisited: true },
                recordNpcMemories: [
                  {
                    target: 'arthur',
                    id: 'ev_workshop_opened',
                    tag: 'workshop_opened',
                    category: 'social_impression',
                    valence: 'warm',
                    importance: 3,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['arthur'],
                  },
                ],
              },
            ],
          },
          arthur_workshop_visit_end: {
            moodLabel: 'Quietly pleased',
            text: `Then come through the south door whenever the porch lamp is lit. First rule of the bench: oil before force, and never wind somebody else’s watch without asking. The kettle handles itself.`,
          },
          arthur_workshop_secret_end: {
            moodLabel: 'Bright',
            text: `Patience, mostly — an escapement only wants one breath of oil and a steady hand. Come peek at the bench and I’ll show you what “steady” sounds like; my mending ledger lives on the shelf, gear sketches and all.`,
          },
        },
      };
    },
  ),

  makeBranchingTopic(
    'daily_arthur_workshop_checkin',
    'arthur',
    'daily_slice',
    15,
    { requiresMet: true, sideFlagsTrue: ['copperwheelVisited'], notSeenToday: true },
    (_id, world) => {
      const cw = world.copperwheelState;
      const checkedToday = cw ? cw.benchCheckedDay === world.day : false;
      const teaToday = cw ? cw.teaSharedDay === world.day : false;
      const helpedToday = cw ? cw.helpedDay === world.day : false;
      const project = getProjectForDay(world.day);
      const rootText = helpedToday
        ? `Your hands held steadier than you let on — the ${project.label.toLowerCase()} is back to singing because of it. Come sit in the armchair whenever.`
        : checkedToday
        ? project.id === 'bench_rest'
        ? `You caught the bench on its rest day. Even escapements take a slow morning — the kettle doesn’t, though. Help yourself.`
        : `Did the ${project.label.toLowerCase()} treat you well? The comb teeth hum differently to everyone who listens. Tomorrow the felt wants something new.`
        : teaToday
        ? `The kettle knows a kind hand — thank you. The bench keeps one project on the felt a day, patient as pendulums.`
        : `Today the bench is humming about ${project.id === 'bench_rest' ? 'nothing at all — it’s resting' : `the ${project.label.toLowerCase()}`}. It comes around every few days, steady as anything.`;
      return {
        nodes: {
          root: {
            moodLabel: helpedToday ? 'Warm' : 'Gentle',
            text: rootText,
            choices: [
              {
                id: 'arthur_workshop_checkin_thanks',
                label: 'Your workshop has become part of my walks.',
                tone: 'warm',
                nextNodeId: 'arthur_workshop_checkin_end',
                trustDelta: 1,
                setEmotion: 'happy',
                recordNpcMemories: [
                  {
                    target: 'arthur',
                    id: 'ev_workshop_ritual_tended',
                    tag: 'workshop_ritual_tended',
                    category: 'interaction',
                    valence: 'warm',
                    importance: 2,
                    retention: 'ephemeral',
                    subjectPlayer: true,
                    subjectResidents: ['arthur'],
                  },
                ],
              },
            ],
          },
          arthur_workshop_checkin_end: {
            moodLabel: 'Thoughtful',
            text: `A workshop is only half clocks, you know. The other half is knowing somebody will knock just to listen.`,
          },
        },
      };
    },
  ),
];
