/**
 * Dialogue content module: FISHING_ECHO_TOPICS (Fishing social afterlife,
 * Everyday Activity Social Integration).
 *
 * Two stage-aware reactions to fishing.ts catches, closing the loop between
 * the fishing reducer's witness memory writes and the everyday conversational
 * layer. The reducer stamps the `fishing` tag on firsthand witness memories
 * (residents within LOCAL_WITNESS_RADIUS when a catch is landed); that memory
 * population is exactly what these topics gate on — no new world state, no
 * new condition types, no engine changes.
 *
 * Pattern mirrors photoEcho.ts and gardenEcho.ts. Tag is `'fishing'` (not
 * `'shared_fishing'`) → no SF-4 R1 context boost → these topics stay gentle
 * below the community band.
 *
 * Stage coverage:
 *   1. `everyday_fishing_witness_echo` — a witness neighbor recalls seeing
 *      the player land a catch at a particular spot. Gates on
 *      `requiresNpcMemory` with `unmentionedOnly: true` so each witness
 *      memory surfaces exactly once. Authored at priority 10.
 *
 *   2. `everyday_fishing_noticer` — broader neighborhood reflection. Gates
 *      on `requiresNpcMemory` with `unmentionedOnly: false` + `maxSeenCount: 2`
 *      so the lingering beat surfaces at most twice per save. Authored at
 *      priority 6.
 */
import { DialogueTopic } from '../../types';
import { findSpeakerMemory, makeSimpleTopic } from '../../dialogueEngine';

/** Fishing witness memory tag authored by `performFishingAction`. */
const FISHING_MEMORY_TAG = 'fishing';
/** Window (days) the echo family stays audible. */
const FISHING_ECHO_WINDOW_DAYS = 4;

export const FISHING_ECHO_TOPICS: readonly DialogueTopic[] = [
  // ================= STAGE 1: witness echo — a neighbor saw you land the catch =================
  makeSimpleTopic(
    'everyday_fishing_witness_echo',
    'any',
    'event_reaction',
    10,
    {
      requiresNpcMemory: {
        tags: [FISHING_MEMORY_TAG],
        unmentionedOnly: true,
        maxDaysOld: FISHING_ECHO_WINDOW_DAYS,
        subjectPlayer: true,
      },
      notSeenToday: true,
    },
    {
      moodLabel: 'Warm',
      buildText: (resId, world) => {
        const mem = findSpeakerMemory(resId, world, {
          tags: [FISHING_MEMORY_TAG],
          unmentionedOnly: true,
          maxDaysOld: FISHING_ECHO_WINDOW_DAYS,
          subjectPlayer: true,
        });
        if (!mem) {
          return `Someone was down by the water with a line earlier — the brook's been busy these days.`;
        }
        const place = mem.detail?.placeName ?? 'the water';
        return `I saw you down at ${place} with a fishing line earlier — caught anything good? The water's been lively lately.`;
      },
      choices: [
        {
          id: 'ev_fishing_witness_warm',
          label: `The water's been kind today.`,
          tone: 'warm',
          nextNodeId: 'ev_fishing_witness_end',
          trustDelta: 1,
          setEmotion: 'happy',
          markMemoryTagsMentioned: [FISHING_MEMORY_TAG],
        },
      ],
      endings: {
        ev_fishing_witness_end: {
          moodLabel: 'Warm',
          text: `There's something about the quiet of the water — it's its own kind of neighborhood, isn't it?`,
        },
      },
    },
  ),

  // ================= STAGE 2: broader — the noticer of the water =================
  makeSimpleTopic(
    'everyday_fishing_noticer',
    'any',
    'event_reaction',
    6,
    {
      requiresNpcMemory: {
        tags: [FISHING_MEMORY_TAG],
        unmentionedOnly: false,
        maxDaysOld: FISHING_ECHO_WINDOW_DAYS,
        subjectPlayer: true,
      },
      notSeenToday: true,
      maxSeenCount: 2,
    },
    {
      moodLabel: 'Reflective',
      buildText: () => {
        return `You've been spending time down by the water lately — it's nice, having a neighbor who knows the quiet spots where the brook meets the lane.`;
      },
      choices: [
        {
          id: 'ev_fishing_noticer_warm',
          label: `The water's been good company.`,
          tone: 'warm',
          nextNodeId: 'ev_fishing_noticer_end',
          trustDelta: 1,
          setEmotion: 'happy',
        },
      ],
      endings: {
        ev_fishing_noticer_end: {
          moodLabel: 'Warm',
          text: `Keep an eye on the water — it changes every day, if you know how to look.`,
        },
      },
    },
  ),
];
