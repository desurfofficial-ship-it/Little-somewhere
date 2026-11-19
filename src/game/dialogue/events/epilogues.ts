/**
 * Dialogue content module: STORYLINE_EPILOGUE_TOPICS.
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

export const STORYLINE_EPILOGUE_TOPICS: readonly DialogueTopic[] = [
  // ================= KNOWLEDGE-GATED STORYLINE EPILOGUE REACTIONS =================
  makeSimpleTopic(
    'storyline_epilogue_lanterns',
    'any',
    'event_reaction',
    9,
    {
      requiresStoryline: { id: 'conflict_plaza_lanterns', status: ['completed'] },
      requiresNpcMemory: {
        tags: ['lanterns_resolved_compromise', 'lanterns_resolved_space', 'lanterns_resolved_harmony'],
        unmentionedOnly: true,
      },
      notSeenToday: true,
    },
    {
      moodLabel: 'Warm',
      buildText: (id, world) => {
        const mem =
          findSpeakerMemory(id, world, {
            tags: ['lanterns_resolved_compromise', 'lanterns_resolved_space', 'lanterns_resolved_harmony'],
            unmentionedOnly: true,
          }) ??
          findSpeakerMemory(id, world, {
            tags: ['lanterns_resolved_compromise', 'lanterns_resolved_space', 'lanterns_resolved_harmony'],
          });
        const outcome = world.storylines?.conflict_plaza_lanterns?.outcome ?? 'bridge_compromise';
        if (mem && mem.provenance === 'firsthand') {
          if (outcome === 'public_harmony' || mem.tag === 'lanterns_resolved_harmony') {
            return `Still smiling over that evening candle walk beside Mirror Pond—nobody keeps score when violin notes drift across the water.`;
          }
          if (outcome === 'gentle_space' || mem.tag === 'lanterns_resolved_space') {
            return `Anchoring the lamps back at the bridgehead kept both our footing steady and the fireflies right over the reeds.`;
          }
          return `Those downward brass hoods along the pier turned out cleaner than I’d hoped—warm path underfoot, quiet water beside it.`;
        }
        const fromName = mem?.fromResidentId ? RESIDENTS[mem.fromResidentId]?.name : undefined;
        const lead = fromName
          ? `${fromName} told me you helped settle the Mirror Pond lantern argument`
          : `Word along the cobbles is Mirror Pond’s lantern dispute ended warmly`;
        if (mem?.distortionFlavor === 'exaggerated') {
          return `${lead}—the way it’s told, half the neighborhood marched down with brass lanterns!`;
        }
        if (mem?.distortionFlavor === 'uncertain') {
          return `${lead}, though I wasn’t near the pier to see whether the lamps stayed hooded or moved.`;
        }
        return `${lead}—nice knowing the pond stays gentle at dusk.`;
      },
      choices: [
        {
          id: 'epilogue_lanterns_warm',
          label: 'Everyone just needed room to be heard by the water.',
          tone: 'warm',
          nextNodeId: 'ep_lan_end',
          trustDelta: 1,
          setEmotion: 'happy',
          markMemoryTagsMentioned: [
            'lanterns_resolved_compromise',
            'lanterns_resolved_space',
            'lanterns_resolved_harmony',
          ],
        },
      ],
      endings: {
        ep_lan_end: {
          moodLabel: 'Peaceful',
          text: `Willow Step Lane shines softest when neighbors choose care over noise.`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'storyline_epilogue_zine',
    'any',
    'event_reaction',
    8,
    {
      requiresStoryline: { id: 'side_pip_zine', status: ['completed'] },
      requiresNpcMemory: {
        tags: ['zine_published'],
        unmentionedOnly: true,
      },
      notSeenToday: true,
    },
    {
      moodLabel: 'Fond',
      buildText: (id, world) => {
        const mem =
          findSpeakerMemory(id, world, { tags: ['zine_published'], unmentionedOnly: true }) ??
          findSpeakerMemory(id, world, { tags: ['zine_published'] });
        const outcome = world.storylines?.side_pip_zine?.outcome;
        if (mem && mem.provenance === 'firsthand') {
          return outcome === 'art_edition'
            ? `Every time I flip past Toby’s koi spread in Issue #1, I grin—Pip hasn’t stopped smiling all week!`
            : outcome === 'kitchen_edition'
            ? `Issue #1 still smells faintly of Clara’s bakery parchment! Best pocket zine on Willow Step Lane.`
            : `Seeing Issue #1 stitched right there on the Linden counter makes the whole square feel storied.`;
        }
        const fromName = mem?.fromResidentId ? RESIDENTS[mem.fromResidentId]?.name : undefined;
        const lead = fromName
          ? `${fromName} mentioned Pip and Nora finally bound Issue #1 of the Willow Lane Zine`
          : `I heard folks talking about Pip and Nora’s new pocket zine down at Linden Book Nook`;
        if (mem?.distortionFlavor === 'exaggerated') {
          return `${lead}—supposedly folk queued around the fountain for a look!`;
        }
        return `${lead}—I’ll have to borrow a copy next time I pass Nora’s desk.`;
      },
      choices: [
        {
          id: 'epilogue_zine_warm',
          label: 'Pip already has chalk notes started for Issue #2!',
          tone: 'warm',
          nextNodeId: 'ep_zine_end',
          trustDelta: 1,
          setEmotion: 'happy',
          markMemoryTagsMentioned: ['zine_published'],
        },
      ],
      endings: {
        ep_zine_end: {
          moodLabel: 'Smiling',
          text: `Save me a margin note before Issue #2 goes to twine!`,
        },
      },
    },
  ),
];
