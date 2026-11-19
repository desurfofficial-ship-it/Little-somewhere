/**
 * Dialogue content module: MUSIC_STAND_ARC_TOPICS.
 *
 * Extracted verbatim from narrative.ts (Dialogue Modularization,
 * 2026-11). Topic ids, priorities, conditions, node graphs, text and
 * dynamic builders are byte-identical to the original inline array.
 * Selection/evaluation logic lives in ../dialogueEngine — this file is
 * content-only. Ordering contract: see ./index.ts (src/game/dialogue/).
 */
import {
  DialogueChoice, DialogueTopic,
} from '../../types';
import { DeclarativeNodeSpec, makeBranchingTopic, makeSimpleTopic } from '../../dialogueEngine';

export const MUSIC_STAND_ARC_TOPICS: readonly DialogueTopic[] = [
  // 3. Cedar Music Stand (Sora -> Toby -> Barnaby)
  makeSimpleTopic(
    'side_sora_stand_1',
    'sora',
    'personal_story',
    14,
    {
      requiresStoryline: { id: 'side_pond_stand', status: ['available'], maxStage: 0 },
      sideFlagsFalse: ['pondStandStarted'],
      minTrust: 1,
      notSeenToday: true,
    },
    {
      moodLabel: 'Dreamy',
      buildText: () =>
        `When I play near Mirror Pond, my sheet music tries to sail into the reeds whenever an afternoon breeze kicks up. A tiny notched cedar stand would save every etude.`,
      choices: [
        {
          id: 'sora_ask_barnaby',
          label: 'I bet Barnaby has cedar offcuts at Pinecone Woodshop—I’ll ask him!',
          tone: 'practical',
          nextNodeId: 'end_stand1',
          trustDelta: 1,
          reliabilityDelta: 7,
          isStoryMilestone: true,
          setEmotion: 'happy',
          setSideFlags: { pondStandStarted: true },
          advanceStoryline: {
            id: 'side_pond_stand',
            setStage: 1,
            setStatus: 'active',
            note: 'Sora asked for a wind-steady cedar music stand beside Mirror Pond.',
          },
          adjustNpcRelations: [
            { a: 'barnaby', b: 'sora', deltaAffinity: 4, deltaTension: 0, tag: 'stand_planned' },
          ],
          recordNpcMemories: [
            {
              target: 'speaker',
              id: 'ev_pond_stand_start',
              tag: 'pond_stand_requested',
              category: 'interaction',
              valence: 'warm',
              importance: 3,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['sora', 'barnaby'],
            },
          ],
        },
      ],
      endings: {
        end_stand1: {
          moodLabel: 'Hopeful',
          text: `Would he really? Toby sketches right beside the pier too—he knows exactly which way the pond gusts blow.`,
        },
      },
    },
  ),
  makeSimpleTopic(
    'side_toby_stand_sketch',
    'toby',
    'personal_story',
    19,
    {
      requiresStoryline: { id: 'side_pond_stand', status: ['active'], minStage: 1, maxStage: 1 },
      notSeenToday: true,
    },
    {
      moodLabel: 'Helpful',
      buildText: () =>
        `Wait—you’re helping Barnaby build Sora’s pond music stand? Down on the pier, afternoon gusts always sweep left off the reeds, or we could sketch a treble motif for the lip.`,
      choices: [
        {
          id: 'toby_sketch_oak_brace',
          label: 'Sketch the wind direction so Barnaby weights the stand with storm-braced oak.',
          tone: 'practical',
          nextNodeId: 'toby_brace_end',
          trustDelta: 1,
          reliabilityDelta: 7,
          isStoryMilestone: true,
          setEmotion: 'happy',
          advanceStoryline: {
            id: 'side_pond_stand',
            setStage: 2,
            setStatus: 'active',
            setOutcome: 'weatherproof_oak',
            note: 'Toby mapped Mirror Pond gusts for a weighted oak music stand.',
          },
          adjustNpcRelations: [
            { a: 'sora', b: 'toby', deltaAffinity: 6, deltaTension: 0, tag: 'pond_sketch' },
          ],
          recordNpcMemories: [
            {
              target: 'speaker',
              id: 'ev_toby_stand_sketch',
              tag: 'pond_stand_wind_sketch',
              category: 'interaction',
              valence: 'warm',
              importance: 3,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['toby', 'sora'],
            },
          ],
        },
        {
          id: 'toby_sketch_clef_motif',
          label: 'Draw a curved treble-clef lip pattern for Barnaby to carve in cedar.',
          tone: 'warm',
          nextNodeId: 'toby_clef_end',
          trustDelta: 1,
          reliabilityDelta: 6,
          isStoryMilestone: true,
          setEmotion: 'happy',
          advanceStoryline: {
            id: 'side_pond_stand',
            setStage: 2,
            setStatus: 'active',
            setOutcome: 'carved_clef',
            note: 'Toby drew a treble-clef carving template for Sora’s stand.',
          },
          adjustNpcRelations: [
            { a: 'barnaby', b: 'toby', deltaAffinity: 5, deltaTension: 0, tag: 'clef_sketch' },
          ],
          recordNpcMemories: [
            {
              target: 'speaker',
              id: 'ev_toby_stand_clef',
              tag: 'pond_stand_clef_sketch',
              category: 'interaction',
              valence: 'warm',
              importance: 3,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['toby', 'barnaby'],
            },
          ],
        },
      ],
      endings: {
        toby_brace_end: {
          moodLabel: 'Pleased',
          text: `Measured the breeze-angle twice! Barnaby will know how wide to plane that oak footplate.`,
        },
        toby_clef_end: {
          moodLabel: 'Shy-Warm',
          text: `Tried keeping the scrollwork simple enough for his chisel—Sora’s going to smile when she sees it.`,
        },
      },
    },
  ),
  makeBranchingTopic(
    'side_barnaby_stand_2',
    'barnaby',
    'personal_story',
    17,
    {
      requiresStoryline: { id: 'side_pond_stand', status: ['active'], minStage: 1, maxStage: 2 },
      sideFlagsFalse: ['pondStandBuilt'],
      notSeenToday: true,
    },
    (_id, world): { nodes: Record<string, DeclarativeNodeSpec> } => {
      const prog = world.storylines?.side_pond_stand;
      const outcome =
        prog?.outcome === 'weatherproof_oak' ? 'weatherproof_oak' : 'carved_clef';
      const rootText =
        prog?.stage === 2 && outcome === 'weatherproof_oak'
          ? `With Toby’s pond wind angle, a weighted oak footplate and two brass thumbscrews will anchor Sora’s sheet music through autumn gusts.`
          : `Sheet-music stand for Sora’s violin, eh? Give me two brass thumbscrews and a heartwood cedar plank—it’ll stand sturdy through autumn gusts.`;

      const choices: DialogueChoice[] = [
        {
          id: 'barnaby_carve_stand',
          label:
            prog?.stage === 2 && outcome === 'weatherproof_oak'
              ? 'Plane the weighted oak footplate so pond gusts never tip a sheet!'
              : 'Carve a little treble clef along the lip—she’ll treasure it.',
          tone: 'warm',
          nextNodeId: 'end_stand2',
          trustDelta: 1,
          reliabilityDelta: 10,
          isStoryMilestone: true,
          setEmotion: 'happy',
          setSideFlags: { pondStandBuilt: true, pondStandStyle: outcome },
          advanceStoryline: {
            id: 'side_pond_stand',
            setStage: 3,
            setStatus: 'completed',
            setOutcome: outcome,
            note: `Completed Sora’s music stand (${outcome}).`,
          },
          adjustNpcRelations: [
            { a: 'barnaby', b: 'sora', deltaAffinity: 8, deltaTension: 0, tag: 'pond_stand_built' },
          ],
          recordNpcMemories: [
            {
              target: 'speaker',
              id: 'ev_pond_stand_built',
              tag: 'pond_stand_built',
              category: 'event',
              valence: 'warm',
              importance: 4,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['barnaby', 'sora'],
            },
            {
              target: 'sora',
              id: 'ev_pond_stand_built',
              tag: 'pond_stand_built',
              category: 'event',
              valence: 'warm',
              importance: 4,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['barnaby', 'sora'],
            },
          ],
          unlockMemory: {
            id: 'mem_side_music_stand',
            title: 'Cedar Music Stand',
            summary:
              outcome === 'weatherproof_oak'
                ? 'Following Toby’s wind sketch, Barnaby built a weighted oak music stand so Sora can play beside Mirror Pond in any breeze.'
                : 'Barnaby planed a wind-proof cedar music stand so Sora can play comfortably beside Mirror Pond.',
            residentId: 'barnaby',
          },
        },
      ];

      if ((prog?.stage ?? 1) < 2) {
        choices.push({
          id: 'barnaby_build_storm_stand',
          label: 'Weight the base with oiled oak first so pond breezes never tip it.',
          tone: 'practical',
          nextNodeId: 'end_storm_stand',
          trustDelta: 1,
          reliabilityDelta: 10,
          isStoryMilestone: true,
          setEmotion: 'happy',
          setSideFlags: { pondStandBuilt: true, pondStandStyle: 'weatherproof_oak' },
          advanceStoryline: {
            id: 'side_pond_stand',
            setStage: 3,
            setStatus: 'completed',
            setOutcome: 'weatherproof_oak',
            note: 'Weighted Sora’s pond music stand with oiled oak.',
          },
          adjustNpcRelations: [
            { a: 'barnaby', b: 'sora', deltaAffinity: 8, deltaTension: 0, tag: 'pond_stand_built' },
          ],
          recordNpcMemories: [
            {
              target: 'speaker',
              id: 'ev_pond_stand_built',
              tag: 'pond_stand_built',
              category: 'event',
              valence: 'warm',
              importance: 4,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['barnaby', 'sora'],
            },
          ],
          unlockMemory: {
            id: 'mem_side_music_stand',
            title: 'Cedar Music Stand',
            summary:
              'Barnaby weighted a sturdy oiled-oak music stand so Sora can play beside Mirror Pond without losing pages to the wind.',
            residentId: 'barnaby',
          },
        });
      }

      return {
        nodes: {
          root: {
            moodLabel: 'Pleased',
            text: rootText,
            choices,
          },
          end_stand2: {
            moodLabel: 'Proud',
            text: `Done and rubbed with beeswax. Wait till you hear how violin wood sings beside cedar.`,
          },
          end_storm_stand: {
            moodLabel: 'Sturdy',
            text: `Mortised oak footplate won’t budge in a coastal gale! Wait till she plays by the reeds tomorrow.`,
          },
        },
      };
    },
  ),
];
