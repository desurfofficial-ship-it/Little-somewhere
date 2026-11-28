import { DialogueTopic } from '../../types';
import { makeBranchingTopic } from '../../dialogueEngine';
import { getProjectForDay } from '../../copperwheel';

/**
 * Arthur's invitation quartet (LR-5, doc 24 §2.1 L5-S5; pattern: nora.ts /
 * clara.ts).
 *
 * Four topics, same shapes and flag wiring as Nora's and Clara's sets:
 *   1. Indoors inside Copperwheel Cottage during an accepted live workbench
 *      visit — completion choice (delegates to completeSharedActivity, the
 *      single transaction owner) + "look around first" branch that completes
 *      nothing.
 *   2. Offered invitation still awaiting response (re-ask after closing
 *      early). Declined copy stays interval-accurate (per-host spacing is
 *      day+2 — the B-07 copy-class rule; never promises "tomorrow").
 *   3. Fresh offer from Arthur when eligible outdoors — the topic only
 *      surfaces while `canOfferInvitation` passes, which includes the D-5A
 *      `requiresSideFlag: 'copperwheelVisited'` story gate (structurally
 *      silent before the player has ever stepped inside his workshop) and
 *      the D-5B `offerPhases: ['morning', 'dusk']` gate (structurally silent
 *      in the afternoon/golden).
 *   4. Reminder while the invite is accepted and the player is still
 *      outdoors.
 *
 * Text may reference the day's bench project (`getProjectForDay`); the
 * bench-rest day is handled explicitly so the copy never advertises work
 * that the rolled felt is not doing.
 */

export const ARTHUR_INVITATION_TOPICS: readonly DialogueTopic[] = [
  // 1. Indoors inside Copperwheel Cottage during an accepted live visit
  makeBranchingTopic(
    'inv_arthur_indoor_workbench',
    'arthur',
    'invitation',
    40,
    {
      requiresActiveInvitation: {
        hostId: 'arthur',
        activityId: 'share_workbench_hour',
        status: 'accepted',
        requireLive: true,
        requireIndoors: true,
      },
    },
    (_id, world) => {
      const project = getProjectForDay(world.day);
      const rootText =
        project.id === 'bench_rest'
          ? 'You came. The bench is resting today — felt rolled, tools asleep — so the hour is ours to spend on tea, tick-talk, and whatever the regulator feels like showing us.'
          : `You made it. Pull up the stool — today the bench holds ${project.label.toLowerCase()}, and an extra pair of steady eyes keeps my hands honest.`;
      return {
        nodes: {
          root: {
            moodLabel: 'Warm',
            text: rootText,
            choices: [
              {
                id: 'lr_arthur_complete_workbench',
                label: 'Sit the workbench hour with Arthur',
                tone: 'warm',
                nextNodeId: 'workbench_done',
                completeSharedActivityId: 'share_workbench_hour',
              },
              {
                id: 'lr_arthur_look_first',
                label: 'Give me a moment — let me look around the workshop first.',
                tone: 'gentle',
                nextNodeId: 'wait_end',
              },
            ],
          },
          workbench_done: {
            moodLabel: 'Delighted',
            text: 'An hour goes by like a slow gear when it’s shared. Thank you for sitting with me — the bench keeps better time with company.',
          },
          wait_end: {
            moodLabel: 'Peaceful',
            text: 'Take your time — the regulator will still be ticking when you’re ready.',
          },
        },
      };
    },
  ),

  // 2. Offered invitation still awaiting response (if player closed before choosing)
  makeBranchingTopic(
    'inv_arthur_pending_offer',
    'arthur',
    'invitation',
    10,
    {
      requiresActiveInvitation: {
        hostId: 'arthur',
        activityId: 'share_workbench_hour',
        status: 'offered',
        requireLive: true,
      },
    },
    () => {
      return {
        nodes: {
          root: {
            moodLabel: 'Hopeful',
            text: 'Still up for the workbench hour? The kettle’s warm and the bench keeps its own time.',
            choices: [
              {
                id: 'lr_arthur_pending_accept',
                label: 'Yes — save me the stool at the bench.',
                tone: 'warm',
                nextNodeId: 'accepted_end',
                acceptInvitation: true,
              },
              {
                id: 'lr_arthur_pending_decline',
                label: 'Maybe another day — I have errands along the lane.',
                tone: 'gentle',
                nextNodeId: 'declined_end',
                declineInvitation: true,
              },
            ],
          },
          accepted_end: {
            moodLabel: 'Delighted',
            text: 'Good. Step through the workshop door whenever you’re ready — I’ll keep the lamp lit at the bench.',
          },
          declined_end: {
            moodLabel: 'Understanding',
            text: 'No trouble at all — the bench keeps its rhythm, and there’s an hour in it for you a few days on.',
          },
        },
      };
    },
  ),

  // 3. Fresh offer from Arthur when eligible outdoors
  makeBranchingTopic(
    'inv_arthur_offer_workbench',
    'arthur',
    'invitation',
    8,
    {
      requiresMet: true,
      requiresInvitationEligible: {
        hostId: 'arthur',
        activityId: 'share_workbench_hour',
      },
    },
    () => {
      return {
        nodes: {
          root: {
            moodLabel: 'Warm',
            text: 'I keep one workbench hour free most mornings and evenings — hands like mine do steadier work with a quiet eye beside them. Would you like to sit the hour with me at the bench?',
            choices: [
              {
                id: 'lr_arthur_offer_yes',
                label: 'I’d like that — save me the stool.',
                tone: 'warm',
                nextNodeId: 'offer_accepted',
                offerInvitation: { hostId: 'arthur', activityId: 'share_workbench_hour' },
                acceptInvitation: true,
              },
              {
                id: 'lr_arthur_offer_no',
                label: 'Another day, perhaps — thank you for asking, Arthur.',
                tone: 'gentle',
                nextNodeId: 'offer_declined',
                offerInvitation: { hostId: 'arthur', activityId: 'share_workbench_hour' },
                declineInvitation: true,
              },
            ],
          },
          offer_accepted: {
            moodLabel: 'Delighted',
            text: 'Then I’ll set out the second stool. Step inside Copperwheel Cottage and we’ll let the hour run at bench speed.',
          },
          offer_declined: {
            moodLabel: 'Gentle',
            text: 'Of course — the invitation keeps. The bench will be here, ticking along, whenever the hour suits you.',
          },
        },
      };
    },
  ),

  // 4. Reminder while invite is accepted outdoors before entering the cottage
  makeBranchingTopic(
    'inv_arthur_accepted_reminder',
    'arthur',
    'invitation',
    6,
    {
      requiresActiveInvitation: {
        hostId: 'arthur',
        activityId: 'share_workbench_hour',
        status: 'accepted',
        requireLive: true,
      },
    },
    () => {
      return {
        nodes: {
          root: {
            moodLabel: 'Warm',
            text: 'The workbench hour’s waiting inside Copperwheel Cottage whenever you step through the door.',
            choices: [
              {
                id: 'lr_arthur_reminder_ok',
                label: 'I’ll head into the workshop now.',
                tone: 'warm',
                nextNodeId: 'reminder_end',
              },
            ],
          },
          reminder_end: {
            moodLabel: 'Bright',
            text: 'See you at the bench — I’ll keep the lamp turned low and the kettle warm.',
          },
        },
      };
    },
  ),
];
