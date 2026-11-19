/**
 * Dialogue content module: ORCHARD_EPILOGUE_TOPICS.
 *
 * Extracted verbatim from narrative.ts (Dialogue Modularization,
 * 2026-11). Topic ids, priorities, conditions, node graphs, text and
 * dynamic builders are byte-identical to the original inline array.
 * Selection/evaluation logic lives in ../dialogueEngine — this file is
 * content-only. Ordering contract: see ./index.ts (src/game/dialogue/).
 */
import {
  DialogueTopic,
} from '../../types';
import { findSpeakerMemory, makeSimpleTopic } from '../../dialogueEngine';
import { RESIDENTS } from '../../residents';

export const ORCHARD_EPILOGUE_TOPICS: readonly DialogueTopic[] = [
  // ================= ORCHARD GATHERING EPILOGUE (ARC 6 tail) =================
  makeSimpleTopic(
    'storyline_epilogue_orchard',
    'any',
    'event_reaction',
    8,
    {
      requiresStoryline: { id: 'side_orchard_gathering', status: ['completed'] },
      requiresNpcMemory: {
        tags: ['orchard_gathering_hosted'],
        unmentionedOnly: true,
      },
      notSeenToday: true,
    },
    {
      moodLabel: 'Warm',
      buildText: (id, world) => {
        const mem =
          findSpeakerMemory(id, world, {
            tags: ['orchard_gathering_hosted'],
            unmentionedOnly: true,
          }) ??
          findSpeakerMemory(id, world, { tags: ['orchard_gathering_hosted'] });
        const outcome = world.storylines?.side_orchard_gathering?.outcome ?? 'spiced_tart_table';
        if (mem && mem.provenance === 'firsthand') {
          return outcome === 'blossom_honey_picnic'
            ? `Drinking wild-honey chamomile beneath those glowing orchard lanterns makes every afternoon feel twice as long.`
            : `Nothing beats watching marigold lanterns warm up over spiced crabapple tarts in Fern Hollow Orchard.`;
        }
        const fromName = mem?.fromResidentId ? RESIDENTS[mem.fromResidentId]?.name : undefined;
        const lead = fromName
          ? `${fromName} told me Rowan, Clara, and Mina strung lanterns above a tasting table in Fern Hollow Orchard`
          : `Folks up the north lane keep talking about Rowan’s new orchard tasting table`;
        if (mem?.distortionFlavor === 'exaggerated') {
          return `${lead}—the way it’s told, half of Willow Step Lane smelled honey tarts clear from the square!`;
        }
        if (mem?.distortionFlavor === 'uncertain') {
          return `${lead}, though I haven’t wandered past the stone gate yet to see whether they’re pouring tea or baking tarts.`;
        }
        return `${lead}—I ought to stroll past the bee skep this afternoon for a taste.`;
      },
      choices: [
        {
          id: 'epilogue_orchard_warm',
          label: 'There’s always a stool open beneath the crabapple boughs.',
          tone: 'warm',
          nextNodeId: 'ep_orchard_end',
          trustDelta: 1,
          setEmotion: 'happy',
          markMemoryTagsMentioned: ['orchard_gathering_hosted'],
        },
      ],
      endings: {
        ep_orchard_end: {
          moodLabel: 'Content',
          text: `Save me a corner near the honey crock next time petals start drifting!`,
        },
      },
    },
  ),
];
