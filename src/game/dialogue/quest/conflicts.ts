/**
 * Dialogue content module: CONFLICT_MEDIATION_TOPICS.
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
import { makeSimpleTopic } from '../../dialogueEngine';

export const CONFLICT_MEDIATION_TOPICS: readonly DialogueTopic[] = [
  // ================= GENERALIZED CONFLICT MEDIATION =================
  makeSimpleTopic(
    'conflict_arthur_clara_tension',
    'arthur',
    'conflict_reconciliation',
    12,
    { minNpcTension: { a: 'arthur', b: 'clara', min: 35 }, flagsFalse: ['claraArthurReconciled'], notSeenToday: true },
    {
      moodLabel: 'Quiet',
      buildText: () =>
        `Clara’s rosemary bread still smells clear across the square… I just never knew how to knock after so long.`,
      choices: [
        {
          id: 'arthur_ease_pride',
          label: 'You don’t need a speech—just bring a warm tea cup next time you pass.',
          tone: 'gentle',
          nextNodeId: 'ease_end',
          trustDelta: 1,
          reliabilityDelta: 6,
          setEmotion: 'relaxed',
          adjustNpcTension: { a: 'arthur', b: 'clara', deltaAffinity: 10, deltaTension: -15, tag: 'kind_bridge' },
        },
        {
          id: 'arthur_brush_off',
          label: 'Maybe she prefers the bakery quiet without brass ticking anyway.',
          tone: 'blunt',
          nextNodeId: 'stiff_end',
          trustDelta: -1,
          isNegative: true,
          setEmotion: 'frustrated',
          adjustNpcTension: { a: 'arthur', b: 'clara', deltaAffinity: -4, deltaTension: 6 },
        },
      ],
      endings: {
        ease_end: {
          moodLabel: 'Relieved',
          text: `A quiet cup… perhaps even I can manage that much.`,
        },
        stiff_end: {
          moodLabel: 'Withdrawn',
          text: `Hmmph. Perhaps you’re right. Best keep to my own bench.`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'conflict_barnaby_arthur_rafters',
    'barnaby',
    'conflict_reconciliation',
    6,
    { flagsTrue: ['borrowedBarnabyLadder'], flagsFalse: ['bellRestored'], maxNpcAffinity: { a: 'arthur', b: 'barnaby', max: 62 }, notSeenToday: true },
    {
      moodLabel: 'Gruff',
      buildText: () =>
        `Arthur insists on riveting brass brackets onto my oak gazebo beams! Good mortise-and-tenon joinery never needed brass screws showing.`,
      choices: [
        {
          id: 'barnaby_bridge_craft',
          label: 'Cedar joinery and Arthur’s warm brass actually complement each other cleanly.',
          tone: 'warm',
          nextNodeId: 'craft_warm_end',
          trustDelta: 1,
          reliabilityDelta: 6,
          setEmotion: 'relaxed',
          adjustNpcTension: { a: 'arthur', b: 'barnaby', deltaAffinity: 12, deltaTension: -8, tag: 'shared_craft' },
        },
        {
          id: 'barnaby_stew_blunt',
          label: 'Old brass clockmakers never listen to carpenters anyway.',
          tone: 'blunt',
          nextNodeId: 'craft_blunt_end',
          trustDelta: -1,
          isNegative: true,
          setEmotion: 'frustrated',
          adjustNpcTension: { a: 'arthur', b: 'barnaby', deltaAffinity: -4, deltaTension: 7 },
        },
      ],
      endings: {
        craft_warm_end: {
          moodLabel: 'Charmed',
          text: `Hmph… suppose his brass stays bright against cedar grain. I’ll save him a bench seat later.`,
        },
        craft_blunt_end: {
          moodLabel: 'Brusque',
          text: `Don’t stir pot-fires needlessly, kid. Arthur’s alright—just stubborn as oak knots.`,
        },
      },
    },
  ),
];
