/**
 * Dialogue content module: ORCHARD_ARC_TOPICS.
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
import { makeBranchingTopic, makeSimpleTopic, phaseGreet } from '../../dialogueEngine';

export const ORCHARD_ARC_TOPICS: readonly DialogueTopic[] = [
  // ================= ARC 6: FERN HOLLOW ORCHARD GATHERING =================
  // Rowan -> Clara (Spiced Crabapple Tart) OR Mina (Chamomile-Honey Picnic) -> Rowan
  makeBranchingTopic(
    'side_rowan_orchard_1',
    'rowan',
    'personal_story',
    8,
    {
      requiresStoryline: { id: 'side_orchard_gathering', status: ['available'], maxStage: 0 },
      notSeenToday: true,
    },
    (_id, _world, phase) => ({
      nodes: {
        root: {
          moodLabel: 'Warm',
          text: `${phaseGreet(phase)} Walked beneath the crabapple rows yet? Harvest baskets are brimming and the straw bee skep is singing—yet north of the stone gate stays too quiet for neighbors to linger. I’d love to set up an open Tasting Table beneath the east boughs.`,
          choices: [
            {
              id: 'rowan_orchard_start',
              label: 'Let’s ask Clara or Mina what pairs best with your orchard harvest!',
              tone: 'warm',
              nextNodeId: 'rowan_orchard_plan_end',
              trustDelta: 1,
              reliabilityDelta: 6,
              isStoryMilestone: true,
              setEmotion: 'happy',
              setSideFlags: { orchardGatheringStarted: true },
              advanceStoryline: {
                id: 'side_orchard_gathering',
                setStage: 1,
                setStatus: 'active',
                note: 'Rowan wants to host a shared afternoon Tasting Table at Fern Hollow Orchard.',
              },
              recordNpcMemories: [
                {
                  target: 'rowan',
                  id: 'ev_orchard_gathering_started',
                  tag: 'orchard_gathering_started',
                  category: 'interaction',
                  valence: 'warm',
                  importance: 3,
                  retention: 'durable',
                  subjectPlayer: true,
                  subjectResidents: ['rowan'],
                },
              ],
            },
            {
              id: 'rowan_orchard_skep_ask',
              label: 'How are the honeybees holding up near the skep this week?',
              tone: 'curious',
              nextNodeId: 'rowan_orchard_skep_info',
              trustDelta: 1,
            },
          ],
        },
        rowan_orchard_skep_info: {
          moodLabel: 'Gentle',
          text: `Steady and golden! Clover by the cedar stool keeps the hive calm, and spare wild comb waits beside the harvest crates. Now we just need either Clara’s warm tart crust or Mina’s chamomile-honey blend to bring folks north of the gate.`,
          choices: [
            {
              id: 'rowan_orchard_start_after_bees',
              label: 'Count me in—I’ll check in with Clara and Mina.',
              tone: 'warm',
              nextNodeId: 'rowan_orchard_plan_end',
              trustDelta: 1,
              reliabilityDelta: 6,
              isStoryMilestone: true,
              setEmotion: 'happy',
              setSideFlags: { orchardGatheringStarted: true },
              advanceStoryline: {
                id: 'side_orchard_gathering',
                setStage: 1,
                setStatus: 'active',
                note: 'Rowan wants to host a shared afternoon Tasting Table at Fern Hollow Orchard.',
              },
              recordNpcMemories: [
                {
                  target: 'rowan',
                  id: 'ev_orchard_gathering_started',
                  tag: 'orchard_gathering_started',
                  category: 'interaction',
                  valence: 'warm',
                  importance: 3,
                  retention: 'durable',
                  subjectPlayer: true,
                  subjectResidents: ['rowan'],
                },
              ],
            },
          ],
        },
        rowan_orchard_plan_end: {
          moodLabel: 'Hopeful',
          text: `Wonderful! Chat with Clara if spiced crabapple tarts sound right for the square, or Mina if a floral chamomile-honey picnic fits the trees better—then come tell me and I’ll haul out the cedar table.`,
        },
      },
    }),
  ),

  makeSimpleTopic(
    'side_clara_orchard_tart',
    'clara',
    'personal_story',
    16,
    {
      requiresStoryline: { id: 'side_orchard_gathering', status: ['active'], minStage: 1, maxStage: 1 },
      notSeenToday: true,
    },
    {
      moodLabel: 'Eager',
      buildText: () =>
        `Rowan’s thinking of opening a Fern Hollow Tasting Table? Oh, those crisp green-blush crabapples practically beg for buttered crust, cinnamon, and a drizzle of skep honey right over warm stoneware!`,
      choices: [
        {
          id: 'clara_orchard_tart_choice',
          label: 'Spiced crabapple tarts under the boughs—let’s tell Rowan!',
          tone: 'warm',
          nextNodeId: 'clara_orchard_tart_end',
          trustDelta: 1,
          reliabilityDelta: 6,
          isStoryMilestone: true,
          setEmotion: 'excited',
          setSideFlags: { orchardGatheringOutcome: 'spiced_tart_table' },
          advanceStoryline: {
            id: 'side_orchard_gathering',
            setStage: 2,
            setStatus: 'active',
            setOutcome: 'spiced_tart_table',
            note: 'Clara prepared warm spiced crabapple tarts for the Fern Hollow tasting table.',
          },
          adjustNpcRelations: [
            { a: 'rowan', b: 'clara', deltaAffinity: 10, deltaTension: -4, tag: 'orchard_tart' },
          ],
          recordNpcMemories: [
            {
              target: 'speaker',
              id: 'ev_orchard_tart_planned',
              tag: 'orchard_tart_planned',
              category: 'interaction',
              valence: 'warm',
              importance: 3,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['clara', 'rowan'],
            },
          ],
        },
      ],
      endings: {
        clara_orchard_tart_end: {
          moodLabel: 'Delighted',
          text: `Give me twenty minutes at the hearth and two stoneware platters—let Rowan know I’m bringing warm spiced crabapple tarts up through the gate!`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'side_mina_orchard_tea',
    'mina',
    'personal_story',
    16,
    {
      requiresStoryline: { id: 'side_orchard_gathering', status: ['active'], minStage: 1, maxStage: 1 },
      notSeenToday: true,
    },
    {
      moodLabel: 'Bright',
      buildText: () =>
        `A gathering beneath Rowan’s crabapple boughs? Imagine afternoon light dripping through the blossoms while we pour wild skep honey into warm chamomile tea and scatter clover sprigs along the runner!`,
      choices: [
        {
          id: 'mina_orchard_picnic_choice',
          label: 'A chamomile-honey picnic in the shade—let’s bring that to Rowan!',
          tone: 'warm',
          nextNodeId: 'mina_orchard_picnic_end',
          trustDelta: 1,
          reliabilityDelta: 6,
          isStoryMilestone: true,
          setEmotion: 'excited',
          setSideFlags: { orchardGatheringOutcome: 'blossom_honey_picnic' },
          advanceStoryline: {
            id: 'side_orchard_gathering',
            setStage: 2,
            setStatus: 'active',
            setOutcome: 'blossom_honey_picnic',
            note: 'Mina steeped wild skep honey & chamomile blooms for the orchard picnic.',
          },
          adjustNpcRelations: [
            { a: 'rowan', b: 'mina', deltaAffinity: 10, deltaTension: -4, tag: 'orchard_picnic' },
          ],
          recordNpcMemories: [
            {
              target: 'speaker',
              id: 'ev_orchard_picnic_planned',
              tag: 'orchard_picnic_planned',
              category: 'interaction',
              valence: 'warm',
              importance: 3,
              retention: 'durable',
              subjectPlayer: true,
              subjectResidents: ['mina', 'rowan'],
            },
          ],
        },
      ],
      endings: {
        mina_orchard_picnic_end: {
          moodLabel: 'Radiant',
          text: `Let Rowan know I’m packing the stoneware teapot, clover honey jar, and porcelain cups—the east clearing will smell like sweet summer air!`,
        },
      },
    },
  ),

  makeBranchingTopic(
    'side_rowan_orchard_2_host',
    'rowan',
    'personal_story',
    17,
    {
      requiresStoryline: { id: 'side_orchard_gathering', status: ['active'], minStage: 2, maxStage: 2 },
    },
    (_id, world) => {
      const outcome =
        world.storylines?.side_orchard_gathering?.outcome === 'blossom_honey_picnic'
          ? 'blossom_honey_picnic'
          : 'spiced_tart_table';
      const isPicnic = outcome === 'blossom_honey_picnic';
      return {
        nodes: {
          root: {
            moodLabel: 'Grateful',
            text: isPicnic
              ? `Mina dropped off fresh chamomile stems and four glazed teacups! Cedar trestle table and marigold lantern twine are all staged beneath the east boughs—ready to open the Fern Hollow Picnic?`
              : `Clara sent up warm spiced crabapple tarts on stoneware platters—the cinnamon smell alone woke half the orchard! Marigold lanterns are knotted overhead—ready to open the Fern Hollow Tasting Table?`,
            choices: [
              {
                id: 'rowan_orchard_host_finish',
                label: 'Hang the lanterns and open the Fern Hollow Tasting Table!',
                tone: 'warm',
                nextNodeId: 'rowan_orchard_complete_end',
                trustDelta: 2,
                reliabilityDelta: 10,
                isStoryMilestone: true,
                setEmotion: 'excited',
                setSideFlags: {
                  orchardGatheringComplete: true,
                  orchardGatheringOutcome: outcome,
                },
                advanceStoryline: {
                  id: 'side_orchard_gathering',
                  setStage: 3,
                  setStatus: 'completed',
                  setOutcome: outcome,
                  note: isPicnic
                    ? 'Opened the Chamomile-Honey Picnic under marigold lanterns at Fern Hollow Orchard.'
                    : 'Opened the Spiced Crabapple Tart Table under marigold lanterns at Fern Hollow Orchard.',
                },
                adjustNpcRelations: [
                  { a: 'rowan', b: 'clara', deltaAffinity: 12, deltaTension: -6, tag: 'orchard_gathering' },
                  { a: 'rowan', b: 'mina', deltaAffinity: 12, deltaTension: -6, tag: 'orchard_gathering' },
                  { a: 'clara', b: 'mina', deltaAffinity: 8, deltaTension: -4, tag: 'orchard_gathering' },
                ],
                grantPersonalItem: {
                  itemId: isPicnic ? 'chamomile_pear_tea' : 'crabapple_tart',
                  count: 1,
                },
                recordNpcMemories: [
                  {
                    target: 'rowan',
                    id: 'ev_orchard_gathering_hosted',
                    tag: 'orchard_gathering_hosted',
                    category: 'town_lore',
                    valence: 'warm',
                    importance: 5,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['rowan', 'clara', 'mina'],
                  },
                  {
                    target: 'clara',
                    id: 'ev_orchard_gathering_hosted',
                    tag: 'orchard_gathering_hosted',
                    category: 'town_lore',
                    valence: 'warm',
                    importance: 5,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['rowan', 'clara', 'mina'],
                  },
                  {
                    target: 'mina',
                    id: 'ev_orchard_gathering_hosted',
                    tag: 'orchard_gathering_hosted',
                    category: 'town_lore',
                    valence: 'warm',
                    importance: 5,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['rowan', 'clara', 'mina'],
                  },
                ],
                unlockMemory: {
                  id: 'mem_side_orchard_gathering',
                  title: 'Lanterns Over Fern Hollow',
                  summary: isPicnic
                    ? 'Helped Rowan, Clara, and Mina open the Chamomile-Honey Picnic beneath swaying marigold lanterns in Fern Hollow Orchard.'
                    : 'Helped Rowan, Clara, and Mina open the Spiced Crabapple Tart Table beneath swaying marigold lanterns in Fern Hollow Orchard.',
                  residentId: 'rowan',
                },
              },
            ],
          },
          rowan_orchard_complete_end: {
            moodLabel: 'Beaming',
            text: isPicnic
              ? `Look at that golden light across the teacups! Here’s a warm flask of Chamomile-Pear Tea for your satchel—Clara, Mina, and Pip are sure to linger here every afternoon now.`
              : `Look at those glazed crabapple tarts shining beneath the lanterns! Here’s a warm Spiced Crabapple Tart for your satchel—neighbors are bound to make this table their favorite afternoon stop.`,
          },
        },
      };
    },
  ),
];
