/**
 * Dialogue content module: EVENT_CELEBRATION_TOPICS.
 *
 * Extracted verbatim from narrative.ts (Dialogue Modularization,
 * 2026-11). Topic ids, priorities, conditions, node graphs, text and
 * dynamic builders are byte-identical to the original inline array.
 * Selection/evaluation logic lives in ../dialogueEngine — this file is
 * content-only. Ordering contract: see ./index.ts (src/game/dialogue/).
 */
import {
  DialogueTopic, PersonalItemId,
} from '../../types';
import { findSpeakerMemory, makeSimpleTopic } from '../../dialogueEngine';
import { PERSONAL_ITEM_MAP } from '../../inventory';
import { RESIDENTS } from '../../residents';

export const EVENT_CELEBRATION_TOPICS: readonly DialogueTopic[] = [
  // ================= EVENT CELEBRATION & GIFT-THANKS TOPICS =================
  makeSimpleTopic(
    'event_bell_celebration',
    'any',
    'event_reaction',
    10,
    {
      requiresNpcMemory: {
        tags: ['bell_ring', 'bell_chime', 'bell_restored'],
        unmentionedOnly: true,
        maxDaysOld: 2,
      },
      notSeenToday: true,
    },
    {
      moodLabel: 'Bright',
      buildText: (id, world) => {
        const mem =
          findSpeakerMemory(id, world, {
            tags: ['bell_ring', 'bell_chime', 'bell_restored'],
            unmentionedOnly: true,
            maxDaysOld: 2,
          }) ??
          findSpeakerMemory(id, world, {
            tags: ['bell_ring', 'bell_chime', 'bell_restored'],
            maxDaysOld: 2,
          });
        const listenerTag = RESIDENTS[id].traits.temperament === 'spirited' ? 'neighbor' : 'friend';
        if (mem && mem.provenance !== 'firsthand') {
          const fromName = mem.fromResidentId ? RESIDENTS[mem.fromResidentId]?.name : undefined;
          const lead = fromName
            ? `${fromName} was just telling me how the restored brass bell chimed over the square`
            : `Word around the cobbles is the restored brass bell echoed past the cedar eaves`;
          if (mem.distortionFlavor === 'exaggerated') {
            return `${lead}—the way it’s told, you could practically hear it clear down to Mirror Pond! Even the sparrows settled down to listen.`;
          }
          if (mem.distortionFlavor === 'uncertain') {
            return `${lead}, though I wasn’t standing close enough to catch who pulled the rope, ${listenerTag}.`;
          }
          return `${lead}, ${listenerTag}—made the whole lane pause for a heartbeat.`;
        }
        if (mem?.detail?.acousticOnly || mem?.tag === 'bell_chime') {
          return `I heard that clear brass bell chime roll right over the rooftops from where I was working, ${listenerTag}! Even the sparrows settled down to listen.`;
        }
        return `Did you hear the brass bell echo right beneath the cedar eaves, ${listenerTag}? Seeing it swing over the square made every sparrow hush to listen.`;
      },
      choices: [
        {
          id: 'ev_bell_warm',
          label: 'Every corner of Willow Lane seemed to pause for a second.',
          tone: 'warm',
          nextNodeId: 'ev_bell_end',
          trustDelta: 1,
          setEmotion: 'happy',
          markMemoryTagsMentioned: ['bell_ring', 'bell_chime', 'bell_restored'],
        },
      ],
      endings: {
        ev_bell_end: {
          moodLabel: 'At Peace',
          text: `That’s what good bells are for—reminding folks they aren’t walking alone.`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'event_fountain_repair',
    'any',
    'event_reaction',
    8,
    {
      requiresNpcMemory: {
        tags: ['fountain_fixed'],
        unmentionedOnly: true,
      },
      notSeenToday: true,
      maxSeenCount: 1,
    },
    {
      moodLabel: 'Refreshing',
      buildText: (id, world) => {
        const mem =
          findSpeakerMemory(id, world, {
            tags: ['fountain_fixed'],
            unmentionedOnly: true,
          }) ?? findSpeakerMemory(id, world, { tags: ['fountain_fixed'] });
        if (mem && mem.provenance !== 'firsthand') {
          const fromName = mem.fromResidentId ? RESIDENTS[mem.fromResidentId]?.name : undefined;
          const prefix = fromName
            ? `${fromName} told me the old plaza fountain is pouring clear spring water again`
            : `I heard word that the plaza fountain is pouring cleanly again`;
          if (mem.distortionFlavor === 'exaggerated') {
            return `${prefix}—supposedly spraying bright enough to cool half the lane!`;
          }
          if (mem.distortionFlavor === 'uncertain') {
            return `${prefix}, though I haven’t wandered over to see the basin myself yet.`;
          }
          return `${prefix}—I can’t wait to pass the square and hear it!`;
        }
        return `Listen to the plaza fountain pouring cleanly again—cool mist makes the entire square feel alive!`;
      },
      choices: [
        {
          id: 'ev_fountain_cheer',
          label: 'Barnaby knew right where the autumn leaf clogged the intake.',
          tone: 'warm',
          nextNodeId: 'ev_fountain_end',
          trustDelta: 1,
          setEmotion: 'happy',
          markMemoryTagsMentioned: ['fountain_fixed'],
        },
      ],
      endings: {
        ev_fountain_end: {
          moodLabel: 'Warm',
          text: `Nothing beats running water beside warm sunlit cobblestones.`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'event_gift_thanks',
    'any',
    'event_reaction',
    18,
    {
      requiresNpcMemory: {
        tags: ['player_gift', 'player_help_observed'],
        unmentionedOnly: true,
        maxDaysOld: 2,
      },
      notSeenToday: true,
    },
    {
      moodLabel: 'Appreciative',
      buildText: (id, world) => {
        const mem =
          findSpeakerMemory(id, world, {
            tags: ['player_gift', 'player_help_observed'],
            unmentionedOnly: true,
            maxDaysOld: 2,
          }) ??
          findSpeakerMemory(id, world, {
            tags: ['player_gift', 'player_help_observed'],
            maxDaysOld: 2,
          });
        const recipientId = mem?.subjectResidents[0];
        const recipientName = recipientId ? RESIDENTS[recipientId]?.name : undefined;
        const personalLabel = mem?.detail?.personalItemId
          ? PERSONAL_ITEM_MAP[mem.detail.personalItemId as PersonalItemId]?.label
          : undefined;
        const itemText =
          personalLabel ??
          (mem?.detail?.itemId ? mem.detail.itemId.replace(/_/g, ' ') : 'thoughtful bundle');

        if (mem && mem.tag === 'player_gift' && mem.provenance === 'firsthand') {
          return `Still thinking about that ${itemText} you carried right over to me—${RESIDENTS[id].traits.temperament === 'whimsical' ? 'you’re a real lane sprite!' : 'that kind of thoughtfulness sticks with a neighbor.'}`;
        }
        if (mem && mem.provenance === 'firsthand') {
          return `I saw you carrying that ${itemText} across the square${recipientName ? ` for ${recipientName}` : ''} earlier—neighbors notice steady kindness like that.`;
        }
        const fromName = mem?.fromResidentId ? RESIDENTS[mem.fromResidentId]?.name : undefined;
        const sourceLead = fromName ? `${fromName} mentioned` : 'Folks mentioned';
        if (mem?.distortionFlavor === 'exaggerated') {
          return `${sourceLead} you’ve been hauling armfuls of favors clear up and down Willow Step Lane${recipientName ? `—especially for ${recipientName}` : ''}!`;
        }
        if (mem?.distortionFlavor === 'uncertain') {
          return `${sourceLead} you’d dropped something thoughtful by ${recipientName ? `${recipientName}’s porch` : 'the lane'}, though the details got tumbled on the way.`;
        }
        return `${sourceLead} how kindly you helped ${recipientName ?? 'your neighbors'} with ${recipientName ? `a ${itemText}` : 'helpful bundles'} across the square.`;
      },
      choices: [
        {
          id: 'ev_help_reply',
          label: 'Happy to lend a hand whenever someone needs one.',
          tone: 'warm',
          nextNodeId: 'ev_help_end',
          trustDelta: 1,
          reliabilityDelta: 4,
          setEmotion: 'happy',
          markMemoryTagsMentioned: ['player_gift', 'player_help_observed'],
        },
      ],
      endings: {
        ev_help_end: {
          moodLabel: 'Warm',
          text: `Little acts like that stitch a whole neighborhood together.`,
        },
      },
    },
  ),
];
