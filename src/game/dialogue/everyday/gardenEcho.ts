/**
 * Garden Dialogue Echo Topics — Resident Garden social afterlife.
 *
 * Two stage-aware reactions to resident garden tending, mirroring the
 * community echo + photo echo pattern. The `tendResidentGardenInPlace`
 * reducer stamps `'garden'` tag witness memories (neighbors who saw the
 * resident tending). These topics surface those memories in conversation.
 *
 * Tag is `'garden'` (not `'shared_garden'`) — no SF-4 boost, keeping
 * garden echoes gentle and below the community band.
 */
import { DialogueTopic } from '../../types';
import { findSpeakerMemory, makeSimpleTopic } from '../../dialogueEngine';

const GARDEN_MEMORY_TAG = 'garden';
const GARDEN_ECHO_WINDOW_DAYS = 4;

export const GARDEN_ECHO_TOPICS: readonly DialogueTopic[] = [
  makeSimpleTopic(
    'everyday_garden_witness_echo',
    'any',
    'event_reaction',
    10,
    {
      requiresNpcMemory: {
        tags: [GARDEN_MEMORY_TAG],
        unmentionedOnly: true,
        maxDaysOld: GARDEN_ECHO_WINDOW_DAYS,
      },
      notSeenToday: true,
    },
    {
      moodLabel: 'Warm',
      buildText: (resId, world) => {
        const mem = findSpeakerMemory(resId, world, {
          tags: [GARDEN_MEMORY_TAG],
          unmentionedOnly: true,
          maxDaysOld: GARDEN_ECHO_WINDOW_DAYS,
        });
        if (!mem) {
          return `Someone was out tending their garden earlier — the neighborhood is looking greener these days.`;
        }
        const place = mem.detail?.placeName ?? 'their garden';
        const gardener = mem.subjectResidents?.[0] ?? 'a neighbor';
        return `I saw ${gardener} out tending ${place} earlier — it's nice seeing the gardens come alive, isn't it?`;
      },
      choices: [
        {
          id: 'ev_garden_witness_warm',
          label: 'The neighborhood is looking greener already.',
          tone: 'warm',
          nextNodeId: 'ev_garden_witness_end',
          trustDelta: 1,
          setEmotion: 'happy',
          markMemoryTagsMentioned: [GARDEN_MEMORY_TAG],
        },
      ],
      endings: {
        ev_garden_witness_end: {
          moodLabel: 'Warm',
          text: `Little by little, the gardens make the lane feel more like somewhere people actually live.`,
        },
      },
    },
  ),
  makeSimpleTopic(
    'everyday_garden_noticer',
    'any',
    'event_reaction',
    6,
    {
      requiresNpcMemory: {
        tags: [GARDEN_MEMORY_TAG],
        unmentionedOnly: false,
        maxDaysOld: GARDEN_ECHO_WINDOW_DAYS,
      },
      notSeenToday: true,
      maxSeenCount: 2,
    },
    {
      moodLabel: 'Warm',
      buildText: () => {
        return `The gardens around the lane have been looking well-tended lately — someone's been taking care of them.`;
      },
      choices: [
        {
          id: 'ev_garden_noticer_warm',
          label: `It's nice seeing the neighborhood bloom.`,
          tone: 'warm',
          nextNodeId: 'ev_garden_noticer_end',
          trustDelta: 1,
          setEmotion: 'happy',
        },
      ],
      endings: {
        ev_garden_noticer_end: {
          moodLabel: 'Warm',
          text: `A garden tended is a small promise kept — the lane notices.`,
        },
      },
    },
  ),
];
