/**
 * Dialogue content module: COMMUNITY_ECHO_TOPICS (Community Projects social
 * afterlife, branch `feat/community-social-consequences`).
 *
 * Three stage-aware reactions to Community Projects (community.ts GA-1),
 * closing the loop between the contribution reducer's witness/participant
 * memory writes and the everyday conversational layer. The contribution
 * reducer already stamps the `shared_community` tag on BOTH firsthand witness
 * memories (neighbors within LOCAL_WITNESS_RADIUS when an item lands in the
 * basket) and thanksFrom participant memories (the completion burst, bound to
 * the `community_<projectId>_complete` player_help world event). Those two
 * memory populations + the completion event are exactly what these topics
 * gate on — no new world state, no new condition types, no engine changes.
 *
 * Why this exists: before this module, a neighbor who watched the player
 * drop wild_honey into the orchard basket had a `shared_community` memory of
 * that moment, but the everyday conversational layer never surfaced it. Once
 * the player walked away from the basket, the contribution had no
 * conversational afterlife. These three topics give it one — and they reuse
 * the proven reflections.ts / celebrations.ts pattern (`requiresNpcMemory`
 * with `unmentionedOnly`, `markMemoryTagsMentioned` on the choice) so the
 * SF-4 context boost (+5 inside the `event_reaction` band) and the engine's
 * existing history rotation apply with zero wiring changes.
 *
 * Stage coverage (the smallest elegant extension — one topic per stage the
 * reducer actually records):
 *
 *   1. `everyday_community_basket_echo`        — IN-PROGRESS stage. A
 *      witness neighbor (memory `sourceKind: 'witness'`) recalls seeing the
 *      player chip an item into the basket. Gates on `requiresNpcMemory`
 *      with the `shared_community` tag, so it also collects the SF-4 R1
 *      context boost (priority 14 + boost 5 = 19, decisively above
 *      `event_gift_thanks` at 18 when both an unmentioned shared_community
 *      memory and an unmentioned player_gift memory coexist — same ordering
 *      discipline as `everyday_shared_visit_echo`).
 *
 *   2. `everyday_community_completion_celebration` — COMPLETED stage, hosted
 *      by a thanksFrom participant. Uses `requiresWitnessedEvent` (the
 *      knowledge-scoped sibling of `requiresRecentEventKind/Tag`) bound to
 *      `kinds: ['player_help']` + `tagPrefix: 'community_'` so it fires
 *      ONLY for neighbors who actually appear in the completion event's
 *      actors list AND hold a participant memory bound to that event id —
 *      never for omniscient bystanders. The paired `requiresNpcMemory`
 *      clause keeps it in the SF-4 boost family (priority 20 + boost 5 =
 *      25, so completion beats the in-progress echo when a neighbor holds
 *      both memory kinds, which is the right precedence: completion is the
 *      bigger moment).
 *
 *   3. `everyday_community_project_pride`       — COMPLETED stage, broader
 *      neighborhood reflection. Gates on `requiresRecentEventTag` (prefix
 *      `community_`, ≤6 days). The engine's D2 knowledge gate naturally
 *      scopes this to neighbors who are actors in the completion event OR
 *      hold a memory bound to it — i.e. witnesses + thanksFrom, not
 *      omniscient strangers. Authored at priority 10 (no `requiresNpcMemory`
 *      clause ⇒ no SF-4 boost) so it sits BELOW the two echo topics and
 *      fires on the SECOND or later conversation, after the immediate echo
 *      has marked its `shared_community` memory mentioned and dropped out
 *      of selection. This is the "lingering neighborhood pride" beat — the
 *      afterlife of the afterlife.
 *
 * Surfacing contract: the engine's `surfacedMemoryEventIds` block owns the
 * mention flip for `everyday_shared_visit_echo` specifically; for these
 * topics the mention flip rides on `markMemoryTagsMentioned: ['shared_community']`
 * on each choice — the belt-and-suspenders path used by every other
 * event-reaction topic (celebrations.ts, epilogues.ts). `everyday_community_project_pride`
 * intentionally omits the tag-flip choice side-effect: it does not claim the
 * speaker witnessed the contribution, so it must not retire the witness
 * memory another neighbor could still echo.
 *
 * Ordering contract: appended at the END of the DIALOGUE_TOPICS aggregate
 * (see ./index.ts), strictly after `REFLECTION_TOPICS`. New topics must be
 * added to the append-only tail and the golden snapshot regenerated with
 * written justification — never reordered. The SF4-07 milestone pin
 * (`everyday_shared_visit_echo` at the tail) migrates to this module's last
 * topic; see `dialogueContext.test.ts` SF4-07 for the migrated pin.
 */
import { DialogueTopic } from '../../types';
import { findSpeakerMemory, makeSimpleTopic } from '../../dialogueEngine';
import { getCommunityProjectDef } from '../../community';

/** Shared-community memory tag authored by `contributeToCommunityProject`. */
const COMMUNITY_MEMORY_TAG = 'shared_community';
/** Summary-tag prefix authored by the completion burst in `community.ts`. */
const COMMUNITY_EVENT_TAG_PREFIX = 'community_';
/** Window (days) the echo family stays audible, mirroring SHARED_ECHO_WINDOW_DAYS. */
const COMMUNITY_ECHO_WINDOW_DAYS = 6;

/**
 * Reads the `projectId` field the contribution reducer tucks into the memory
 * detail (NpcMemoryDetail is a closed shape, so community.ts writes the key
 * via a record spread — see community.ts ~line 496). Falls back gracefully.
 */
function projectIdFromMemoryDetail(detail: unknown): string | undefined {
  if (!detail || typeof detail !== 'object') return undefined;
  const raw = (detail as Record<string, unknown>).projectId;
  return typeof raw === 'string' ? raw : undefined;
}

export const COMMUNITY_ECHO_TOPICS: readonly DialogueTopic[] = [
  // ================= STAGE 1: IN-PROGRESS — witness basket echo =================
  makeSimpleTopic(
    'everyday_community_basket_echo',
    'any',
    'event_reaction',
    // 14 (mirroring `everyday_shared_visit_echo`): with the SF-4 R1 boost
    // (max +5) the echo reaches 19, decisively above `event_gift_thanks` (18)
    // when BOTH unmentioned memories coexist — the scarcer shared-community
    // experience echoes first. Still deeply below the band ceiling
    // (event_reaction 68 + authored winners).
    14,
    {
      requiresNpcMemory: {
        tags: [COMMUNITY_MEMORY_TAG],
        unmentionedOnly: true,
        maxDaysOld: COMMUNITY_ECHO_WINDOW_DAYS,
        subjectPlayer: true,
      },
      notSeenToday: true,
    },
    {
      moodLabel: 'Warm',
      buildText: (resId, world) => {
        const mem = findSpeakerMemory(resId, world, {
          tags: [COMMUNITY_MEMORY_TAG],
          unmentionedOnly: true,
          maxDaysOld: COMMUNITY_ECHO_WINDOW_DAYS,
          subjectPlayer: true,
        });
        if (!mem) {
          // Defensive: condition gated, so this branch only fires if the
          // memory raced to "mentioned" between select and build — stay
          // graceful and let the player move on.
          return `Something about the cobbles felt warmer today — neighbors quietly chipping in, the way this lane always has.`;
        }
        const projectId = projectIdFromMemoryDetail(mem.detail);
        const def = projectId ? getCommunityProjectDef(projectId) : null;
        const place = mem.detail?.placeName ?? def?.venueLabel ?? 'the contribution basket';
        // A witness memory (sourceKind === 'witness') describes the
        // in-progress contribution moment. If `findSpeakerMemory` happened
        // to return a participant memory (only possible when this topic
        // lost the priority race to the completion celebration but the
        // engine still called build — e.g. history penalty edge cases),
        // gracefully acknowledge the completed project instead of
        // claiming a witness moment the speaker never had.
        if (mem.sourceKind === 'witness') {
          const projectNoun = def?.title ? def.title.toLowerCase() : 'the community basket';
          return `I saw you slip something into ${projectNoun} at ${place} earlier — neighbors quietly chipping in is exactly how this lane gets its glow.`;
        }
        const projectTitle = def?.title ?? 'the community basket';
        return `${projectTitle} filled up nicely — every neighbor who dropped something in made it possible.`;
      },
      choices: [
        {
          id: 'ev_community_basket_warm',
          label: 'Just doing my part alongside everyone else.',
          tone: 'warm',
          nextNodeId: 'ev_community_basket_end',
          trustDelta: 1,
          setEmotion: 'happy',
          markMemoryTagsMentioned: [COMMUNITY_MEMORY_TAG],
        },
      ],
      endings: {
        ev_community_basket_end: {
          moodLabel: 'Warm',
          text: `Little baskets like that — they’re how a lane becomes a neighborhood.`,
        },
      },
    },
  ),

  // ================= STAGE 2: COMPLETED — thanksFrom celebration =================
  makeSimpleTopic(
    'everyday_community_completion_celebration',
    'any',
    'event_reaction',
    // 20 (above the gift-thanks ceiling of 18 unboosted): the participant
    // memory and the SF-4 R1 boost (max +5) bring this to 25 — completion
    // outranks the in-progress basket echo (19) when a neighbor holds both
    // memory kinds. Completion is the bigger moment; precedence follows.
    20,
    {
      // Knowledge-scoped gate: the speaker must actually appear in the
      // completion event's actors list AND hold a memory bound to that
      // event id. Witnesses whose only memory is the per-contribution
      // witness event (different eventId) are filtered out — only
      // thanksFrom participants (and any neighbor who both witnessed AND
      // was thanked, holding both memories) reach this branch.
      requiresWitnessedEvent: {
        kinds: ['player_help'],
        tagPrefix: COMMUNITY_EVENT_TAG_PREFIX,
        maxDaysAgo: COMMUNITY_ECHO_WINDOW_DAYS,
      },
      requiresNpcMemory: {
        tags: [COMMUNITY_MEMORY_TAG],
        unmentionedOnly: true,
        maxDaysOld: COMMUNITY_ECHO_WINDOW_DAYS,
        subjectPlayer: true,
      },
      notSeenToday: true,
    },
    {
      moodLabel: 'Bright',
      buildText: (resId, world) => {
        const mem = findSpeakerMemory(resId, world, {
          tags: [COMMUNITY_MEMORY_TAG],
          unmentionedOnly: true,
          maxDaysOld: COMMUNITY_ECHO_WINDOW_DAYS,
          subjectPlayer: true,
        });
        const projectId = projectIdFromMemoryDetail(mem?.detail);
        const def = projectId ? getCommunityProjectDef(projectId) : null;
        const projectTitle = def?.title ?? 'the community project';
        const place = mem?.detail?.placeName ?? def?.venueLabel ?? 'the lane';
        if (mem && mem.sourceKind === 'participant') {
          return `The ${projectTitle} is finished — thanks in no small part to you. Walking past ${place} tonight, I could feel the whole neighborhood in it.`;
        }
        // Defensive fallback (participant memory lost the findSpeakerMemory
        // race to a fresher witness memory): still celebrate completion
        // without claiming the participant's "thanks" voice.
        return `The ${projectTitle} came together — every neighbor who chipped in made ${place} a little more ours.`;
      },
      choices: [
        {
          id: 'ev_community_completion_warm',
          label: 'It felt good to chip in alongside everyone.',
          tone: 'warm',
          nextNodeId: 'ev_community_completion_end',
          trustDelta: 1,
          reliabilityDelta: 4,
          setEmotion: 'happy',
          markMemoryTagsMentioned: [COMMUNITY_MEMORY_TAG],
        },
      ],
      endings: {
        ev_community_completion_end: {
          moodLabel: 'Grateful',
          text: `That’s the lane at its best — neighbors building something together and then walking past it, glowing.`,
        },
      },
    },
  ),

  // ================= STAGE 2 (BROADER): lingering neighborhood pride =================
  makeSimpleTopic(
    'everyday_community_project_pride',
    'any',
    'event_reaction',
    // 10 (no `requiresNpcMemory` clause ⇒ no SF-4 boost): sits below the
    // echo topics so it fires on the SECOND or later conversation, after
    // the immediate echo has marked its shared_community memory mentioned
    // and dropped out of selection. `requiresRecentEventTag` carries the
    // engine's D2 knowledge gate (actor OR memory) — naturally scoped to
    // witnesses + thanksFrom + memory-holders, never omniscient strangers.
    10,
    {
      requiresRecentEventTag: {
        tagPrefix: COMMUNITY_EVENT_TAG_PREFIX,
        maxDaysAgo: COMMUNITY_ECHO_WINDOW_DAYS,
      },
      notSeenToday: true,
      maxSeenCount: 2,
    },
    {
      moodLabel: 'Reflective',
      buildText: (_resId, world) => {
        // Find the freshest community completion event the engine's D2
        // gate just authorized this speaker to reference. The condition
        // already proved one exists; build mirrors the same scan so the
        // text reflects the exact project the speaker knows about.
        const event = (world.worldEvents ?? [])
          .filter(
            (ev) =>
              ev.kind === 'player_help' &&
              ev.summaryTag.startsWith(COMMUNITY_EVENT_TAG_PREFIX) &&
              world.day - ev.day <= COMMUNITY_ECHO_WINDOW_DAYS,
          )
          .sort((a, b) => b.day - a.day)[0];
        const summary = event?.summary ?? 'the neighborhood finished a project together';
        return `${summary.charAt(0).toUpperCase()}${summary.slice(1)} — walks like that are why I settled on Willow Step Lane in the first place.`;
      },
      choices: [
        {
          id: 'ev_community_pride_warm',
          label: 'It really did take all of us.',
          tone: 'warm',
          nextNodeId: 'ev_community_pride_end',
          trustDelta: 1,
          setEmotion: 'happy',
          // Intentionally NO markMemoryTagsMentioned: this topic does not
          // claim the speaker witnessed the contribution, so it must not
          // retire a witness/participant memory another conversation
          // (or another neighbor) could still surface.
        },
      ],
      endings: {
        ev_community_pride_end: {
          moodLabel: 'Warm',
          text: `Moments like that are the lane’s real architecture — the rest is just cobblestones and eaves.`,
        },
      },
    },
  ),
];
