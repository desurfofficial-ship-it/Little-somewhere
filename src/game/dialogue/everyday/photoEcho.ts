/**
 * Dialogue content module: PHOTO_ECHO_TOPICS (Photography social afterlife,
 * Stage 3 Continuation Workstream B).
 *
 * Two stage-aware reactions to photography.ts captures, closing the loop
 * between the capture reducer's witness memory writes and the everyday
 * conversational layer. The reducer stamps the `photo` tag on firsthand
 * witness memories (residents within LOCAL_WITNESS_RADIUS when the shutter
 * clicks); that memory population is exactly what these topics gate on —
 * no new world state, no new condition types, no engine changes.
 *
 * Why this exists: before this module, a neighbor who watched the player
 * raise the camera at Mirror Pond had a `photo` memory of that moment, but
 * the everyday conversational layer never surfaced it. Once the player
 * walked away from the subject, the capture had no conversational afterlife.
 * These two topics give it one — and they reuse the proven communityEcho.ts
 * pattern (`requiresNpcMemory` with `unmentionedOnly`, `markMemoryTagsMentioned`
 * on the choice) so the SF-4 context boost (NO boost here — the tag is
 * `'photo'`, not `'shared_photo'`, so the boost predicate does not match)
 * and the engine's existing history rotation apply with zero wiring changes.
 *
 * Tag choice rationale: the reducer writes tag `'photo'` (NOT `'shared_photo'`).
 * `computeContextBoosts` only boosts topics whose `requiresNpcMemory.tags`
 * start with the `shared_` prefix — so these topics receive ZERO SF-4 R1 boost.
 * They stay gentle: authored priorities 12 and 8, well below the community
 * echo family (14/20 + boost) and the gift-thanks ceiling (18). Photography
 * is the softest everyday circuit — its echoes are quiet on purpose.
 *
 * Stage coverage (the smallest elegant extension — two topics for the two
 * stages the reducer actually records):
 *
 *   1. `everyday_photo_witness_echo` — a witness neighbor (memory
 *      `sourceKind: 'witness'`) recalls seeing the player raise the camera
 *      at a particular subject. Gates on `requiresNpcMemory` with the `photo`
 *      tag + `unmentionedOnly: true` so each witness memory surfaces exactly
 *      once across the whole neighborhood (the mention flip retires it).
 *      Authored at priority 12 (no boost — stays below `event_gift_thanks`
 *      at 18 and the community basket echo at 19). Build text references
 *      `mem.detail?.placeName` (the subject's name the reducer tucks into
 *      the memory detail) and includes the witness-voice phrase 'saw you'.
 *
 *   2. `everyday_photo_noticer` — broader neighborhood reflection. Gates on
 *      `requiresNpcMemory` with `unmentionedOnly: false` (so it can fire
 *      AFTER Topic 1 has marked the witness memory mentioned) + `maxSeenCount: 2`
 *      so it surfaces at most twice per save (the lingering 'you've been
 *      noticing things' beat — the afterlife of the afterlife). Authored at
 *      priority 8 (below Topic 1 so Topic 1 wins when both conditions pass).
 *      No `markMemoryTagsMentioned`: Topic 2 does not claim the speaker
 *      witnessed the specific capture, so it must not retire a witness
 *      memory another neighbor could still echo.
 *
 * Surfacing contract: the mention flip rides on `markMemoryTagsMentioned:
 * ['photo']` on Topic 1's choice — the belt-and-suspenders path used by every
 * other event-reaction topic (celebrations.ts, epilogues.ts, communityEcho.ts).
 * `everyday_photo_noticer` intentionally omits the tag-flip choice
 * side-effect (same discipline as `everyday_community_project_pride`): it
 * does not claim the speaker witnessed the capture, so it must not retire the
 * witness memory another neighbor could still surface.
 *
 * Ordering contract: appended at the END of the DIALOGUE_TOPICS aggregate
 * (see ./index.ts), strictly after `COMMUNITY_ECHO_TOPICS`. New topics must
 * be added to the append-only tail and the golden snapshot regenerated with
 * written justification — never reordered. The SF4-07 milestone pin
 * (formerly `everyday_community_project_pride`) migrates to this module's
 * last topic (`everyday_photo_noticer`); see `dialogueContext.test.ts`
 * SF4-07 and `community-dialogue.test.ts` SC-A-06 for the migrated pins.
 */
import { DialogueTopic } from '../../types';
import { findSpeakerMemory, makeSimpleTopic } from '../../dialogueEngine';

/** Photography witness memory tag authored by `performPhotoAction`. */
const PHOTO_MEMORY_TAG = 'photo';
/** Window (days) the echo family stays audible, mirroring COMMUNITY_ECHO_WINDOW_DAYS. */
const PHOTO_ECHO_WINDOW_DAYS = 6;

export const PHOTO_ECHO_TOPICS: readonly DialogueTopic[] = [
  // ================= STAGE 1: witness echo — a neighbor saw you frame the shot =================
  makeSimpleTopic(
    'everyday_photo_witness_echo',
    'any',
    'event_reaction',
    // 12 (no SF-4 R1 boost — tag is 'photo', not 'shared_photo'): sits below
    // the community basket echo (14 + boost 5 = 19) and gift-thanks (18) so
    // photography stays the softest everyday circuit. The capture moment is
    // gentle on purpose; its echo is too.
    12,
    {
      requiresNpcMemory: {
        tags: [PHOTO_MEMORY_TAG],
        unmentionedOnly: true,
        maxDaysOld: PHOTO_ECHO_WINDOW_DAYS,
        subjectPlayer: true,
      },
      notSeenToday: true,
    },
    {
      moodLabel: 'Warm',
      buildText: (resId, world) => {
        const mem = findSpeakerMemory(resId, world, {
          tags: [PHOTO_MEMORY_TAG],
          unmentionedOnly: true,
          maxDaysOld: PHOTO_ECHO_WINDOW_DAYS,
          subjectPlayer: true,
        });
        if (!mem) {
          // Defensive: condition gated, so this branch only fires if the
          // memory raced to "mentioned" between select and build — stay
          // graceful and let the player move on.
          return `Something about the way you've been carrying that camera — the lane feels more noticed lately.`;
        }
        const place = mem.detail?.placeName ?? 'the lane';
        return `I saw you frame a photograph of ${place} earlier — it's nice, the way you've been noticing the small things that make this neighborhood itself.`;
      },
      choices: [
        {
          id: 'ev_photo_witness_warm',
          label: 'Just trying to keep the small things.',
          tone: 'warm',
          nextNodeId: 'ev_photo_witness_end',
          trustDelta: 1,
          setEmotion: 'happy',
          markMemoryTagsMentioned: [PHOTO_MEMORY_TAG],
        },
      ],
      endings: {
        ev_photo_witness_end: {
          moodLabel: 'Warm',
          text: `Keep at it — those small frames add up. The lane notices back.`,
        },
      },
    },
  ),

  // ================= STAGE 2: broader — the noticer of small things =================
  makeSimpleTopic(
    'everyday_photo_noticer',
    'any',
    'event_reaction',
    // 8 (no `requiresNpcMemory` boost and `unmentionedOnly: false`): sits
    // below Topic 1 so it fires on the SECOND or later conversation, after
    // the witness echo has marked its `photo` memory mentioned and dropped
    // out of selection. `maxSeenCount: 2` keeps the lingering beat from
    // repeating every conversation — twice per save is the right amount of
    // 'you've been noticing things' reflection.
    8,
    {
      requiresNpcMemory: {
        tags: [PHOTO_MEMORY_TAG],
        unmentionedOnly: false,
        maxDaysOld: PHOTO_ECHO_WINDOW_DAYS,
        subjectPlayer: true,
      },
      notSeenToday: true,
      maxSeenCount: 2,
    },
    {
      moodLabel: 'Reflective',
      buildText: (_resId, _world) => {
        // Topic 2 does not reference a specific capture (it can fire after
        // the witness memory is mentioned, so the specific moment is no
        // longer retrievable). Speak to the pattern instead — the player's
        // growing habit of noticing.
        return `You've been carrying that camera around the lane a lot lately — it's nice, having a neighbor who keeps an eye on the small views the rest of us walk right past.`;
      },
      choices: [
        {
          id: 'ev_photo_noticer_warm',
          label: 'The lane keeps giving me reasons to.',
          tone: 'warm',
          nextNodeId: 'ev_photo_noticer_end',
          trustDelta: 1,
          setEmotion: 'happy',
          // Intentionally NO markMemoryTagsMentioned: this topic does not
          // claim the speaker witnessed a specific capture, so it must not
          // retire a witness memory another conversation (or another
          // neighbor) could still surface.
        },
      ],
      endings: {
        ev_photo_noticer_end: {
          moodLabel: 'Warm',
          text: `Keep noticing — those frames become the lane's memory, one quiet click at a time.`,
        },
      },
    },
  ),
];
