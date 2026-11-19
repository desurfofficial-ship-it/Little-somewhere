/**
 * Dialogue content module: HERB_HEARTH_ARC_TOPICS.
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

export const HERB_HEARTH_ARC_TOPICS: readonly DialogueTopic[] = [
  // 2. Seasonal Herb & Hearth (Mina -> Sora -> Clara)
  makeSimpleTopic(
    'side_mina_herbloaf_1',
    'mina',
    'personal_story',
    14,
    {
      requiresStoryline: { id: 'side_herb_loaf', status: ['available'], maxStage: 0 },
      sideFlagsFalse: ['herbLoafStarted'],
      minTrust: 1,
      notSeenToday: true,
    },
    {
      moodLabel: 'Curious',
      buildText: () =>
        `I grafted sweet lemon-thyme onto my sunniest rosemary bush—if Clara tests a sprig in tomorrow’s sourdough, the whole square might smell like honeyed summer.`,
      choices: [
        {
          id: 'mina_herb_pass',
          label: 'I’ll tell Clara to save room in the Hearth & Crumb oven!',
          tone: 'warm',
          nextNodeId: 'end_herb',
          trustDelta: 1,
          reliabilityDelta: 6,
          isStoryMilestone: true,
          setEmotion: 'happy',
          setSideFlags: { herbLoafStarted: true },
          advanceStoryline: {
            id: 'side_herb_loaf',
            setStage: 1,
            setStatus: 'active',
            note: 'Mina snipped lemon-thyme sprigs for Clara’s stone oven.',
          },
          adjustNpcRelations: [
            { a: 'clara', b: 'mina', deltaAffinity: 4, deltaTension: 0, tag: 'herb_harvest' },
          ],
          recordNpcMemories: [
            {
              target: 'speaker',
              id: 'ev_herb_loaf_started',
              tag: 'herb_harvest',
              category: 'interaction',
              valence: 'warm',
              importance: 3,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['mina', 'clara'],
            },
          ],
        },
      ],
      endings: {
        end_herb: {
          moodLabel: 'Grateful',
          text: `Oh, wonderful! Sora might even have a tea pairing idea if you pass her cart on the way to Clara’s oven.`,
        },
      },
    },
  ),
  makeSimpleTopic(
    'side_sora_herbloaf_tasting',
    'sora',
    'personal_story',
    19,
    {
      requiresStoryline: { id: 'side_herb_loaf', status: ['active'], minStage: 1, maxStage: 1 },
      notSeenToday: true,
    },
    {
      moodLabel: 'Thoughtful',
      buildText: () =>
        `Lemon-thyme rising inside Clara’s sourdough crust? Should we serve warm slices along the sunlit fountain benches, or pack a quiet tea basket for Mina’s greenhouse porch?`,
      choices: [
        {
          id: 'sora_plan_plaza_table',
          label: 'Set warm slices across the fountain benches for the whole square.',
          tone: 'warm',
          nextNodeId: 'sora_plaza_end',
          trustDelta: 1,
          reliabilityDelta: 6,
          isStoryMilestone: true,
          setEmotion: 'happy',
          advanceStoryline: {
            id: 'side_herb_loaf',
            setStage: 2,
            setStatus: 'active',
            setOutcome: 'plaza_table',
            note: 'Sora planned a sunlit fountain sharing board for the herb loaf.',
          },
          adjustNpcRelations: [
            { a: 'clara', b: 'sora', deltaAffinity: 5, deltaTension: 0, tag: 'loaf_pairing' },
          ],
          recordNpcMemories: [
            {
              target: 'speaker',
              id: 'ev_loaf_plan_plaza',
              tag: 'loaf_pairing_plaza',
              category: 'interaction',
              valence: 'warm',
              importance: 3,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['sora', 'clara'],
            },
          ],
        },
        {
          id: 'sora_plan_tea_basket',
          label: 'Steep chamomile-pear tea and pack a porch basket for Mina’s greenhouse.',
          tone: 'gentle',
          nextNodeId: 'sora_basket_end',
          trustDelta: 1,
          reliabilityDelta: 7,
          isStoryMilestone: true,
          setEmotion: 'relaxed',
          advanceStoryline: {
            id: 'side_herb_loaf',
            setStage: 2,
            setStatus: 'active',
            setOutcome: 'tea_basket',
            note: 'Sora matched Mina’s herb loaf with a chamomile-pear tea basket.',
          },
          adjustNpcRelations: [
            { a: 'mina', b: 'sora', deltaAffinity: 6, deltaTension: 0, tag: 'tea_basket' },
          ],
          recordNpcMemories: [
            {
              target: 'speaker',
              id: 'ev_loaf_plan_basket',
              tag: 'loaf_pairing_basket',
              category: 'interaction',
              valence: 'warm',
              importance: 3,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['sora', 'mina'],
            },
          ],
        },
      ],
      endings: {
        sora_plaza_end: {
          moodLabel: 'Bright',
          text: `Warm crust under open sunlight—let Clara know as soon as her oven bell chimes.`,
        },
        sora_basket_end: {
          moodLabel: 'Warm',
          text: `I’ll wrap the kettle cloth right now—tell Clara to save two fresh heels for Mina’s greenhouse steps.`,
        },
      },
    },
  ),
  makeBranchingTopic(
    'side_clara_herbloaf_2',
    'clara',
    'personal_story',
    17,
    {
      requiresStoryline: { id: 'side_herb_loaf', status: ['active'], minStage: 1, maxStage: 2 },
      sideFlagsFalse: ['herbLoafShared'],
      notSeenToday: true,
    },
    (_id, world): { nodes: Record<string, DeclarativeNodeSpec> } => {
      const prog = world.storylines?.side_herb_loaf;
      const outcome = prog?.outcome === 'tea_basket' ? 'tea_basket' : 'plaza_table';

      const rootText =
        prog?.stage === 2 && outcome === 'tea_basket'
          ? `Mina’s lemon-thyme sprig crackled like gold inside the dough, and Sora sent chamomile-pear tea over! Ready to pack the warm greenhouse basket?`
          : `Mina’s lemon-thyme sprig crackled like gold inside the dough! Pull off a warm heel before it cools—should we share loaves on the plaza benches?`;

      const choices: DialogueChoice[] = [
        {
          id: 'clara_share_herb_loaf',
          label:
            prog?.stage === 2 && outcome === 'tea_basket'
              ? 'Pack the warm loaves and tea basket for Mina’s greenhouse porch!'
              : 'Yes—let’s leave warm slices out for everyone passing the fountain.',
          tone: 'warm',
          nextNodeId: 'end_share',
          trustDelta: 1,
          reliabilityDelta: 10,
          isStoryMilestone: true,
          setEmotion: 'happy',
          setSideFlags: { herbLoafShared: true, herbLoafStyle: outcome },
          advanceStoryline: {
            id: 'side_herb_loaf',
            setStage: 3,
            setStatus: 'completed',
            setOutcome: outcome,
            note: `Shared Mina’s lemon-thyme loaves (${outcome}).`,
          },
          adjustNpcRelations: [
            { a: 'clara', b: 'mina', deltaAffinity: 8, deltaTension: 0, tag: 'herb_loaf_shared' },
            ...(outcome === 'tea_basket'
              ? [{ a: 'clara' as const, b: 'sora' as const, deltaAffinity: 5, deltaTension: 0, tag: 'tea_basket' }]
              : []),
          ],
          recordNpcMemories: [
            {
              target: 'speaker',
              id: 'ev_herb_loaf_shared',
              tag: 'herb_loaf_shared',
              category: 'event',
              valence: 'warm',
              importance: 4,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['clara', 'mina'],
            },
            {
              target: 'mina',
              id: 'ev_herb_loaf_shared',
              tag: 'herb_loaf_shared',
              category: 'event',
              valence: 'warm',
              importance: 4,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['clara', 'mina'],
            },
          ],
          unlockMemory: {
            id: 'mem_side_herb_loaf',
            title: 'Lemon-Thyme Sourdough',
            summary:
              outcome === 'tea_basket'
                ? 'Paired Mina’s greenhouse herbs, Sora’s chamomile-pear tea, and Clara’s warm sourdough in a porch basket.'
                : 'Paired Mina’s greenhouse herbs with Clara’s sourdough for a fragrant neighborhood tasting.',
            residentId: 'clara',
          },
        },
      ];

      if ((prog?.stage ?? 1) < 2) {
        choices.push({
          id: 'clara_pack_tea_basket',
          label: 'Let’s pair a warm loaf with tea for Mina’s greenhouse porch instead.',
          tone: 'gentle',
          nextNodeId: 'end_basket',
          trustDelta: 1,
          reliabilityDelta: 10,
          isStoryMilestone: true,
          setEmotion: 'happy',
          setSideFlags: { herbLoafShared: true, herbLoafStyle: 'tea_basket' },
          advanceStoryline: {
            id: 'side_herb_loaf',
            setStage: 3,
            setStatus: 'completed',
            setOutcome: 'tea_basket',
            note: 'Delivered warm herb loaves to Mina’s greenhouse porch.',
          },
          adjustNpcRelations: [
            { a: 'clara', b: 'mina', deltaAffinity: 8, deltaTension: 0, tag: 'tea_basket' },
          ],
          recordNpcMemories: [
            {
              target: 'speaker',
              id: 'ev_herb_loaf_shared',
              tag: 'herb_loaf_shared',
              category: 'event',
              valence: 'warm',
              importance: 4,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['clara', 'mina'],
            },
          ],
          unlockMemory: {
            id: 'mem_side_herb_loaf',
            title: 'Lemon-Thyme Sourdough',
            summary:
              'Carried Clara’s warm lemon-thyme sourdough straight to Mina’s greenhouse porch.',
            residentId: 'clara',
          },
        });
      }

      return {
        nodes: {
          root: {
            moodLabel: 'Warm',
            text: rootText,
            choices,
          },
          end_share: {
            moodLabel: 'Delighted',
            text:
              outcome === 'tea_basket'
                ? `Mina’s eyes will light right up smelling warm sourdough beside Sora’s chamomile tea!`
                : `Look at Pip’s nose following the scent from halfway across the bridge already!`,
          },
          end_basket: {
            moodLabel: 'Fond',
            text: `Wrapped in clean checkered linen—Mina never takes a break unless someone brings lunch to her potting table!`,
          },
        },
      };
    },
  ),
];
