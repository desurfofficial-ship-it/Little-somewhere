/**
 * Dialogue content module: REFLECTION_TOPICS (Social Foundation SF-4).
 *
 * Memory-callback reflections: everyday topics that let a resident bring up
 * a LIVED EXPERIENCE they still remember — not a story flag, not omniscient
 * world knowledge — gated strictly on the speaker's own player-facing
 * memory ledger (`requiresNpcMemory` with `unmentionedOnly`), exactly the
 * proven epilogue/celebration pattern (events/celebrations.ts,
 * events/epilogues.ts).
 *
 * Why this exists: shared-visit memories were previously only surfaced
 * inside the visit itself. Once the player left, the experience had no
 * everyday conversational afterlife. This module gives it one.
 *
 * Surfacing contract: the engine's `surfacedMemoryEventIds` block owns the
 * mention flip for this topic id (see dialogueEngine.ts, chosenId ===
 * 'everyday_shared_visit_echo'); the choice additionally carries
 * `markMemoryTagsMentioned` as the belt-and-suspenders path used by all
 * event-reaction topics.
 *
 * Ordering contract: appended at the END of the DIALOGUE_TOPICS aggregate
 * (see ./index.ts). New topics must be added to the append-only tail and the
 * golden snapshot regenerated with written justification — never reordered.
 */
import { DialogueTopic } from '../../types';
import { findSpeakerMemory, makeSimpleTopic } from '../../dialogueEngine';

export const REFLECTION_TOPICS: readonly DialogueTopic[] = [
  makeSimpleTopic(
    'everyday_shared_visit_echo',
    'any',
    'event_reaction',
    // 14 (not 12): with the SF-4 context boost (max +5) the echo reaches 19,
    // decisively above event_gift_thanks' 18 when BOTH unmentioned memories
    // coexist — the scarcer shared-visit experience echoes first. Still
    // deeply below the band ceiling (event_reaction 68 + authored winners).
    14,
    {
      requiresNpcMemory: {
        tags: ['shared_featured_reading'],
        unmentionedOnly: true,
        maxDaysOld: 6,
      },
      notSeenToday: true,
    },
    {
      moodLabel: 'Fond',
      buildText: (resId, world) => {
        const mem = findSpeakerMemory(resId, world, {
          tags: ['shared_featured_reading'],
          unmentionedOnly: true,
          maxDaysOld: 6,
        });
        const place = mem?.detail?.placeName ?? 'that quiet spot of theirs';
        return `I keep thinking about the little while we spent together at ${place}. Pages and quiet company — we should do that again sometime.`;
      },
      choices: [
        {
          id: 'ev_shared_visit_echo_warm',
          label: 'It meant a lot to me too.',
          tone: 'warm',
          nextNodeId: 'ev_shared_visit_echo_end',
          trustDelta: 1,
          setEmotion: 'happy',
          markMemoryTagsMentioned: ['shared_featured_reading'],
        },
      ],
      endings: {
        ev_shared_visit_echo_end: {
          moodLabel: 'Warm',
          text: 'Quiet company is its own kind of wonderful, isn’t it?',
        },
      },
    },
  ),
];
