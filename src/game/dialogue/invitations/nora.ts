import { DialogueTopic } from '../../types';
import { makeBranchingTopic } from '../../dialogueEngine';
import { getFeaturedBookForDay } from '../../bookNook';

export const NORA_INVITATION_TOPICS: readonly DialogueTopic[] = [
  // 1. Indoors inside Linden Book Nook during an accepted live reading visit — highest priority
  makeBranchingTopic(
    'inv_nora_indoor_reading',
    'nora',
    'invitation',
    40,
    {
      requiresActiveInvitation: {
        hostId: 'nora',
        activityId: 'share_featured_reading',
        status: 'accepted',
        requireLive: true,
        requireIndoors: true,
      },
    },
    (_id, world) => {
      const book = getFeaturedBookForDay(world.day);
      return {
        nodes: {
          root: {
            moodLabel: 'Warm',
            text: `You made it! I saved ${book.title} open beside the lamp—there’s plenty of room by the reading armchair if you’d like to read a chapter together now.`,
            choices: [
              {
                id: 'lr_nora_complete_reading',
                label: `Read ${book.title} together`,
                tone: 'warm',
                nextNodeId: 'reading_done',
                completeSharedActivityId: 'share_featured_reading',
              },
              {
                id: 'lr_nora_browse_first',
                label: 'Give me a moment to look around first.',
                tone: 'gentle',
                nextNodeId: 'wait_end',
              },
            ],
          },
          reading_done: {
            moodLabel: 'Delighted',
            text: `Funny how a book reads differently when someone else notices the quiet lines you almost skipped. Thank you for sitting with ${book.title} today—come back anytime the lamp is lit.`,
          },
          wait_end: {
            moodLabel: 'Peaceful',
            text: `Take your time—I’ll keep the bookmark right where we left off.`,
          },
        },
      };
    },
  ),

  // 2. Offered invitation still awaiting response (if player closed before choosing)
  makeBranchingTopic(
    'inv_nora_pending_offer',
    'nora',
    'invitation',
    10,
    {
      requiresActiveInvitation: {
        hostId: 'nora',
        activityId: 'share_featured_reading',
        status: 'offered',
        requireLive: true,
      },
    },
    (_id, world) => {
      const book = getFeaturedBookForDay(world.day);
      return {
        nodes: {
          root: {
            moodLabel: 'Hopeful',
            text: `Did you want to join me inside Linden Book Nook for a quiet read of ${book.title} before the hour turns?`,
            choices: [
              {
                id: 'lr_nora_pending_accept',
                label: 'Yes—let’s meet inside the Book Nook.',
                tone: 'warm',
                nextNodeId: 'accepted_end',
                acceptInvitation: true,
              },
              {
                id: 'lr_nora_pending_decline',
                label: 'Maybe another day—I have errands along the lane.',
                tone: 'gentle',
                nextNodeId: 'declined_end',
                declineInvitation: true,
              },
            ],
          },
          accepted_end: {
            moodLabel: 'Delighted',
            text: `Wonderful! Step through the sage door of Linden Book Nook whenever you’re ready—I’ll pull up ${book.title} beside the lamp.`,
          },
          declined_end: {
            moodLabel: 'Understanding',
            text: `No trouble at all—the shelf will still be here another day.`,
          },
        },
      };
    },
  ),

  // 3. Fresh invitation offer from Nora when eligible outdoors
  makeBranchingTopic(
    'inv_nora_offer_reading',
    'nora',
    'invitation',
    8,
    {
      requiresMet: true,
      requiresInvitationEligible: {
        hostId: 'nora',
        activityId: 'share_featured_reading',
      },
    },
    (_id, world) => {
      const book = getFeaturedBookForDay(world.day);
      return {
        nodes: {
          root: {
            moodLabel: 'Warm',
            text: `I set ${book.title} aside on the reading table earlier. Would you like to join me inside Linden Book Nook for a quiet shared read while I’m near home?`,
            choices: [
              {
                id: 'lr_nora_offer_yes',
                label: 'I’d love that—I’ll meet you inside.',
                tone: 'warm',
                nextNodeId: 'offer_accepted',
                offerInvitation: { hostId: 'nora', activityId: 'share_featured_reading' },
                acceptInvitation: true,
              },
              {
                id: 'lr_nora_offer_no',
                label: 'Another day—thank you for asking, Nora.',
                tone: 'gentle',
                nextNodeId: 'offer_declined',
                offerInvitation: { hostId: 'nora', activityId: 'share_featured_reading' },
                declineInvitation: true,
              },
            ],
          },
          offer_accepted: {
            moodLabel: 'Delighted',
            text: `Then I’ll head inside right ahead of you. Step through the sage door of Linden Book Nook and we’ll read ${book.title} together.`,
          },
          offer_declined: {
            moodLabel: 'Gentle',
            text: `Of course—the lane has plenty of its own stories today. Catch me another morning or evening.`,
          },
        },
      };
    },
  ),

  // 4. Reminder while invite is accepted outdoors before entering the Nook
  makeBranchingTopic(
    'inv_nora_accepted_reminder',
    'nora',
    'invitation',
    6,
    {
      requiresActiveInvitation: {
        hostId: 'nora',
        activityId: 'share_featured_reading',
        status: 'accepted',
        requireLive: true,
      },
    },
    (_id, world) => {
      const book = getFeaturedBookForDay(world.day);
      return {
        nodes: {
          root: {
            moodLabel: 'Warm',
            text: `Our shared reading of ${book.title} is ready inside Linden Book Nook whenever you step through the sage door.`,
            choices: [
              {
                id: 'lr_nora_reminder_ok',
                label: 'I’ll head into the Book Nook now.',
                tone: 'warm',
                nextNodeId: 'reminder_end',
              },
            ],
          },
          reminder_end: {
            moodLabel: 'Bright',
            text: `See you by the reading armchair!`,
          },
        },
      };
    },
  ),
];
