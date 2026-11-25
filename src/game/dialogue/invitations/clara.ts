import { DialogueTopic } from '../../types';
import { makeBranchingTopic } from '../../dialogueEngine';
import { getBakeForDay } from '../../bakery';

/**
 * Clara's invitation quartet (LR-3, doc 05 §8; pattern: nora.ts).
 *
 * Four topics, same shapes and flag wiring as Nora's set:
 *   1. Indoors inside Hearth & Crumb during an accepted live pastry visit —
 *      completion choice (delegates to completeSharedActivity, the single
 *      transaction owner) + "look around first" branch that completes nothing.
 *   2. Offered invitation still awaiting response (re-ask after closing early).
 *   3. Fresh morning offer from Clara when eligible outdoors — the topic only
 *      surfaces while `canOfferInvitation` passes, which includes the D10
 *      `offerPhases: ['morning']` gate (LR3-02/50): the offer topic is
 *      structurally silent in the afternoon/golden/dusk.
 *   4. Reminder while the invite is accepted and the player is still outdoors.
 */

export const CLARA_INVITATION_TOPICS: readonly DialogueTopic[] = [
  // 1. Indoors inside Hearth & Crumb Bakery during an accepted live pastry visit
  makeBranchingTopic(
    'inv_clara_indoor_pastry',
    'clara',
    'invitation',
    40,
    {
      requiresActiveInvitation: {
        hostId: 'clara',
        activityId: 'share_morning_pastry',
        status: 'accepted',
        requireLive: true,
        requireIndoors: true,
      },
    },
    (_id, world) => {
      const bake = getBakeForDay(world.day);
      return {
        nodes: {
          root: {
            moodLabel: 'Warm',
            text: `You found the corner! I set today’s ${bake.label.toLowerCase()} on the café table and saved you the chair across from me — split it while the oven’s still humming?`,
            choices: [
              {
                id: 'lr_clara_complete_pastry',
                label: `Share the ${bake.label.toLowerCase()} with Clara`,
                tone: 'warm',
                nextNodeId: 'pastry_done',
                completeSharedActivityId: 'share_morning_pastry',
              },
              {
                id: 'lr_clara_look_first',
                label: 'Give me a moment — let me look around the bakery first.',
                tone: 'gentle',
                nextNodeId: 'wait_end',
              },
            ],
          },
          pastry_done: {
            moodLabel: 'Delighted',
            text: `A pastry always cracks louder when someone else hears it too. Thank you for keeping the slow morning with me — come back any day the dome is talking.`,
          },
          wait_end: {
            moodLabel: 'Peaceful',
            text: `Take your time — your seat’s not going anywhere, and neither is the warm tray.`,
          },
        },
      };
    },
  ),

  // 2. Offered invitation still awaiting response (if player closed before choosing)
  makeBranchingTopic(
    'inv_clara_pending_offer',
    'clara',
    'invitation',
    10,
    {
      requiresActiveInvitation: {
        hostId: 'clara',
        activityId: 'share_morning_pastry',
        status: 'offered',
        requireLive: true,
      },
    },
    (_id, world) => {
      const bake = getBakeForDay(world.day);
      return {
        nodes: {
          root: {
            moodLabel: 'Hopeful',
            text: `So — still up for splitting the ${bake.label.toLowerCase()} at the café corner before the oven rests?`,
            choices: [
              {
                id: 'lr_clara_pending_accept',
                label: 'Yes — save my seat at the café corner.',
                tone: 'warm',
                nextNodeId: 'accepted_end',
                acceptInvitation: true,
              },
              {
                id: 'lr_clara_pending_decline',
                label: 'Maybe another morning — I have errands along the lane.',
                tone: 'gentle',
                nextNodeId: 'declined_end',
                declineInvitation: true,
              },
            ],
          },
          accepted_end: {
            moodLabel: 'Delighted',
            text: `Wonderful! Step through the bakery door whenever you’re ready — I’ll keep the corner warm.`,
          },
          declined_end: {
            moodLabel: 'Understanding',
            text: `No trouble at all — the dome bakes again tomorrow, and the corner seat keeps.`,
          },
        },
      };
    },
  ),

  // 3. Fresh morning offer from Clara when eligible outdoors
  makeBranchingTopic(
    'inv_clara_offer_pastry',
    'clara',
    'invitation',
    8,
    {
      requiresMet: true,
      requiresInvitationEligible: {
        hostId: 'clara',
        activityId: 'share_morning_pastry',
      },
    },
    (_id, world) => {
      const bake = getBakeForDay(world.day);
      return {
        nodes: {
          root: {
            moodLabel: 'Warm',
            text: `The dome just finished today’s ${bake.label.toLowerCase()} and I always bake one extra “for whoever wanders in.” Would you like to split it with me at the café corner while the morning’s still slow?`,
            choices: [
              {
                id: 'lr_clara_offer_yes',
                label: 'I’d love that — save me the seat across from you.',
                tone: 'warm',
                nextNodeId: 'offer_accepted',
                offerInvitation: { hostId: 'clara', activityId: 'share_morning_pastry' },
                acceptInvitation: true,
              },
              {
                id: 'lr_clara_offer_no',
                label: 'Another morning, perhaps — thank you for asking, Clara.',
                tone: 'gentle',
                nextNodeId: 'offer_declined',
                offerInvitation: { hostId: 'clara', activityId: 'share_morning_pastry' },
                declineInvitation: true,
              },
            ],
          },
          offer_accepted: {
            moodLabel: 'Delighted',
            text: `Then I’ll head in and put the kettle on. Step through the Hearth & Crumb door and we’ll keep the morning slow together.`,
          },
          offer_declined: {
            moodLabel: 'Gentle',
            text: `Of course — the extra loaf finds someone else, and the corner keeps for another day.`,
          },
        },
      };
    },
  ),

  // 4. Reminder while invite is accepted outdoors before entering the bakery
  makeBranchingTopic(
    'inv_clara_accepted_reminder',
    'clara',
    'invitation',
    6,
    {
      requiresActiveInvitation: {
        hostId: 'clara',
        activityId: 'share_morning_pastry',
        status: 'accepted',
        requireLive: true,
      },
    },
    (_id, world) => {
      const bake = getBakeForDay(world.day);
      return {
        nodes: {
          root: {
            moodLabel: 'Warm',
            text: `The ${bake.label.toLowerCase()}’s waiting at the café corner inside Hearth & Crumb whenever you step through the door.`,
            choices: [
              {
                id: 'lr_clara_reminder_ok',
                label: 'I’ll head into the bakery now.',
                tone: 'warm',
                nextNodeId: 'reminder_end',
              },
            ],
          },
          reminder_end: {
            moodLabel: 'Bright',
            text: `See you at the café corner — I’ll keep your seat warm!`,
          },
        },
      };
    },
  ),
];
