/**
 * Dialogue content module: TEACHING_TOPICS (Living Relationships — LR-4).
 *
 * Authoritative content gated on `requiresTeachingKnown`, giving shared-visit
 * teaching quiet conversational resonance without skill-tree UI, XP, or grind.
 *
 * Selection & anti-starvation notes:
 *   - Nora's `teaching_nora_featured_reading` sits in `event_reaction` at
 *     priority 20 (score 68 + 20 = 88) using singular `requiresNpcMemory.tag`
 *     (`'shared_featured_reading'`), so `dialogueContext.computeContextBoosts`
 *     assigns 0 boost (doc 23 §1) while still beating SF-4's generic
 *     `everyday_shared_visit_echo` (max score 68 + 14 + 5 = 87) immediately
 *     after the reading visit so the generic echo cannot consume
 *     `unmentionedOnly` first.
 *   - Yields cleanly to higher-authority topics (`quest_milestone` 100+, active
 *     `invitation` 92..126, `event_bell_celebration` 92, and
 *     `side_nora_reading_corner` 92 when `!nookVisited`).
 *   - Once spoken (`maxSeenCount: 1`), marks `shared_featured_reading`
 *     mentioned and retires cleanly without nagging.
 *
 * Ordering contract: appended strictly at the END of DIALOGUE_TOPICS
 * (see ../index.ts). Golden snapshot regenerated with written justification.
 */
import type { DialogueTopic } from '../../types';
import { getFeaturedBookForDay } from '../../bookNook';
import { makeBranchingTopic } from '../../dialogueEngine';

export const TEACHING_TOPICS: readonly DialogueTopic[] = [
  makeBranchingTopic(
    'teaching_nora_featured_reading',
    'nora',
    'event_reaction',
    20,
    {
      requiresMet: true,
      requiresTeachingKnown: ['nora_featured_reading'],
      requiresNpcMemory: {
        tag: 'shared_featured_reading',
        unmentionedOnly: true,
        maxDaysOld: 6,
      },
      notSeenToday: true,
      maxSeenCount: 1,
    },
    (_id, world) => {
      const book = getFeaturedBookForDay(world.day);
      return {
        nodes: {
          root: {
            moodLabel: 'Fond',
            text: `I keep thinking about the pencil marks you noticed in ${book.title} — that quiet habit of pausing on the half-hidden sentence between chapters. You’ve got a real reader’s ear for what the lane leaves between the lines.`,
            choices: [
              {
                id: 'lr4_nora_margins_warm',
                label: 'Reading beside someone else makes every quiet line clearer.',
                tone: 'warm',
                nextNodeId: 'teaching_warm_end',
                trustDelta: 1,
                setEmotion: 'happy',
                markMemoryTagsMentioned: ['shared_featured_reading'],
              },
              {
                id: 'lr4_nora_margins_curious',
                label: 'Who left the oldest margin notes on that shelf?',
                tone: 'curious',
                nextNodeId: 'teaching_curious_end',
                trustDelta: 1,
                setEmotion: 'curious',
                markMemoryTagsMentioned: ['shared_featured_reading'],
              },
            ],
          },
          teaching_warm_end: {
            moodLabel: 'Warm',
            text: `That’s the whole secret of the Book Nook, honestly — noticing together slows a week down better than any clock.`,
          },
          teaching_curious_end: {
            moodLabel: 'Reflective',
            text: `Half of them are Barnaby’s dry jokes from twenty winters back, and the other half are recipes Mina pressed into flower margins. Keep an eye out next time you read.`,
          },
        },
      };
    },
  ),
];
