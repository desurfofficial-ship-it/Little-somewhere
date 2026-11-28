import { DialogueTopic } from '../../types';
import { makeBranchingTopic } from '../../dialogueEngine';
import { getProjectForDay } from '../../copperwheel';

/**
 * Arthur's invitation quartet (LR-5, doc 24 §2.2 & doc 26 §2).
 *
 * Mirrors Nora's and Clara's four-topic pattern with Arthur's quiet clockmaker
 * voice and two settled gates:
 *   - `D-5A`: Fresh offer requires `sideFlagsTrue: ['copperwheelVisited']` so
 *     the Copperwheel workshop introduction (`side_arthur_workshop_bench`)
 *     naturally precedes private workbench invitations.
 *   - `D-5B`: `offerPhases: ['morning', 'dusk']` enforces eligibility outdoors
 *     only when Arthur is genuinely at his yard/porch rather than the Gazebo.
 */
export const ARTHUR_INVITATION_TOPICS: readonly DialogueTopic[] = [
  // 1. Indoors inside Copperwheel Cottage during an accepted live workbench visit
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
      const isRest = project.id === 'bench_rest';
      return {
        nodes: {
          root: {
            moodLabel: 'Warm',
            text: isRest
              ? 'You came in! Even with the felt rolled for rest day, I set the brass loupe out and made elbow room by the lamp. Want to spend a quiet hour at the bench and listen to the regulator?'
              : `You found the bench! I cleared space beside ${project.label.toLowerCase()} and set the brass loupe where the light falls cleanest. Ready to share a steady hour over the escapement?`,
            choices: [
              {
                id: 'lr_arthur_complete_workbench',
                label: 'Share a workbench hour with Arthur',
                tone: 'warm',
                nextNodeId: 'workbench_done',
                completeSharedActivityId: 'share_workbench_hour',
              },
              {
                id: 'lr_arthur_look_first',
                label: 'Give me a moment — let me look around Copperwheel first.',
                tone: 'gentle',
                nextNodeId: 'wait_end',
              },
            ],
          },
          workbench_done: {
            moodLabel: 'Quietly pleased',
            text: isRest
              ? 'That’s half of watchmaking nobody writes down — knowing when to leave the mainspring alone and simply listen to what runs true. Thank you for keeping the quiet hour with me.'
              : 'Look how steady the beat settled once your hand quit hurrying the oil pinion. Oil before force, always. You’ve got a watchmaker’s patience in you.',
          },
          wait_end: {
            moodLabel: 'Peaceful',
            text: 'No hurry at all — the loupe keeps where I laid it, and the kettle hums for nobody in particular.',
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
    (_id, world) => {
      const project = getProjectForDay(world.day);
      const isRest = project.id === 'bench_rest';
      return {
        nodes: {
          root: {
            moodLabel: 'Hopeful',
            text: isRest
              ? 'Were you still up for spending a quiet workbench hour inside Copperwheel while the lamp is lit?'
              : `So — still up for stepping inside Copperwheel to look over ${project.label.toLowerCase()} beside the bench lamp?`,
            choices: [
              {
                id: 'lr_arthur_pending_accept',
                label: 'Yes — meet me by the workbench inside Copperwheel.',
                tone: 'warm',
                nextNodeId: 'accepted_end',
                acceptInvitation: true,
              },
              {
                id: 'lr_arthur_pending_decline',
                label: 'Another hour — I have errands along Willow Lane.',
                tone: 'gentle',
                nextNodeId: 'declined_end',
                declineInvitation: true,
              },
            ],
          },
          accepted_end: {
            moodLabel: 'Quietly pleased',
            text: 'Good. Step through the Copperwheel door when you’re ready — I’ll clear elbow room by the felt.',
          },
          declined_end: {
            moodLabel: 'Understanding',
            text: 'No harm done. Clocks and neighbors keep better when nobody forces the spring.',
          },
        },
      };
    },
  ),

  // 3. Fresh morning or dusk offer from Arthur when eligible outdoors (D-5A, D-5B)
  makeBranchingTopic(
    'inv_arthur_offer_workbench',
    'arthur',
    'invitation',
    8,
    {
      requiresMet: true,
      sideFlagsTrue: ['copperwheelVisited'],
      requiresInvitationEligible: {
        hostId: 'arthur',
        activityId: 'share_workbench_hour',
      },
    },
    (_id, world) => {
      const project = getProjectForDay(world.day);
      const isRest = project.id === 'bench_rest';
      return {
        nodes: {
          root: {
            moodLabel: 'Warm',
            text: isRest
              ? 'Even on a rest day, the bench lamp makes good company. Would you care to step inside Copperwheel for a quiet hour beside the regulator?'
              : `I have ${project.label.toLowerCase()} laid out on the felt inside Copperwheel. Would you like to come in for a steady workbench hour and hear how an escapement breathes?`,
            choices: [
              {
                id: 'lr_arthur_offer_yes',
                label: 'I’d like that — let’s share a workbench hour inside.',
                tone: 'warm',
                nextNodeId: 'offer_accepted',
                offerInvitation: { hostId: 'arthur', activityId: 'share_workbench_hour' },
                acceptInvitation: true,
              },
              {
                id: 'lr_arthur_offer_no',
                label: 'Another day, Arthur — thank you for asking.',
                tone: 'gentle',
                nextNodeId: 'offer_declined',
                offerInvitation: { hostId: 'arthur', activityId: 'share_workbench_hour' },
                declineInvitation: true,
              },
            ],
          },
          offer_accepted: {
            moodLabel: 'Quietly pleased',
            text: 'Then I’ll step inside and turn the bench lamp up. Come through Copperwheel Cottage’s south door whenever you’re ready.',
          },
          offer_declined: {
            moodLabel: 'Gentle',
            text: 'Of course — take the lane at your own pace. The morning and dusk hours come back around.',
          },
        },
      };
    },
  ),

  // 4. Reminder while invite is accepted outdoors before entering Copperwheel Cottage
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
    (_id, world) => {
      const project = getProjectForDay(world.day);
      const isRest = project.id === 'bench_rest';
      return {
        nodes: {
          root: {
            moodLabel: 'Warm',
            text: isRest
              ? 'The bench lamp is warm inside Copperwheel Cottage whenever you step through the south door.'
              : `${project.label} and the brass loupe are waiting inside Copperwheel Cottage whenever you step through the door.`,
            choices: [
              {
                id: 'lr_arthur_reminder_ok',
                label: 'I’ll head into Copperwheel now.',
                tone: 'warm',
                nextNodeId: 'reminder_end',
              },
            ],
          },
          reminder_end: {
            moodLabel: 'Gentle',
            text: 'Take your time — I’ll keep elbow room cleared by the felt.',
          },
        },
      };
    },
  ),
];
