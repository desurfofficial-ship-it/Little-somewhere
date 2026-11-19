/**
 * Dialogue content module: LANTERN_ARC_TOPICS.
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
import { findSpeakerMemory, makeBranchingTopic } from '../../dialogueEngine';
import { RESIDENTS } from '../../residents';
import { getNpcRelation, getRelationshipTier } from '../../relationships';

export const LANTERN_ARC_TOPICS: readonly DialogueTopic[] = [
  // ================= ARC 5: INTERCONNECTED MULTI-STAGE CONFLICT =================
  // Lanterns Over Mirror Pond (Toby -> Barnaby [1-day cooldown] -> Nora)
  makeBranchingTopic(
    'conflict_lanterns_1_spark',
    'toby',
    'conflict_reconciliation',
    7,
    {
      flagsTrue: ['lanternsLit'],
      requiresStoryline: { id: 'conflict_plaza_lanterns', status: ['available'], maxStage: 0 },
      notSeenToday: true,
    },
    () => ({
      nodes: {
        root: {
          moodLabel: 'Troubled',
          text: `Now that the plaza bulbs are glowing, Barnaby bolted two bright work-lanterns straight down Mirror Pond’s pier too… I know he wants safe footing, yet the glare chased every dusk firefly out of the reeds.`,
          choices: [
            {
              id: 'lanterns_hear_toby_gentle',
              label: 'You shouldn’t have to lose firefly dusk—let’s ask Barnaby about gentler shades.',
              tone: 'gentle',
              nextNodeId: 'toby_gentle_end',
              trustDelta: 1,
              reliabilityDelta: 6,
              isStoryMilestone: true,
              setEmotion: 'curious',
              advanceStoryline: {
                id: 'conflict_plaza_lanterns',
                setStage: 1,
                setStatus: 'active',
                note: 'Heard Toby’s worry that bright pier lamps drown out Mirror Pond’s dusk fireflies.',
              },
              adjustNpcRelations: [
                { a: 'barnaby', b: 'toby', deltaAffinity: -2, deltaTension: 6, tag: 'pier_lanterns' },
                { a: 'nora', b: 'toby', deltaAffinity: 4, deltaTension: 0, tag: 'firefly_watch' },
              ],
              recordNpcMemories: [
                {
                  target: 'speaker',
                  id: 'ev_lantern_debate_toby',
                  tag: 'lantern_debate',
                  category: 'interaction',
                  valence: 'neutral',
                  importance: 4,
                  retention: 'durable',
                  subjectPlayer: true,
                  subjectResidents: ['toby', 'barnaby'],
                },
              ],
            },
            {
              id: 'lanterns_side_barnaby_blunt',
              label: 'Fireflies don’t keep folks from slipping on wet pier planks, Toby.',
              tone: 'blunt',
              nextNodeId: 'toby_blunt_end',
              trustDelta: -1,
              isNegative: true,
              setEmotion: 'sad',
              advanceStoryline: {
                id: 'conflict_plaza_lanterns',
                setStage: 1,
                setStatus: 'active',
                note: 'Sided sharply with pier brightness over Toby’s firefly sketches.',
              },
              adjustNpcRelations: [
                { a: 'barnaby', b: 'toby', deltaAffinity: -8, deltaTension: 16, tag: 'pier_lanterns_heated' },
                { a: 'barnaby', b: 'nora', deltaAffinity: -5, deltaTension: 10, tag: 'pier_lanterns_heated' },
              ],
              recordNpcMemories: [
                {
                  target: 'speaker',
                  id: 'ev_lantern_debate_blunt',
                  tag: 'lantern_debate_blunt',
                  category: 'friction',
                  valence: 'tense',
                  importance: 4,
                  retention: 'durable',
                  subjectPlayer: true,
                  subjectResidents: ['toby', 'barnaby'],
                },
              ],
            },
          ],
        },
        toby_gentle_end: {
          moodLabel: 'Relieved',
          text: `Thanks for actually hearing me out… Barnaby works out of kindness, he just doesn’t see how harsh bare bulbs look against the pond.`,
        },
        toby_blunt_end: {
          moodLabel: 'Withdrawn',
          text: `Right… safety first. Maybe go talk to Barnaby if you’re already certain.`,
        },
      },
    }),
  ),

  makeBranchingTopic(
    'conflict_lanterns_2_barnaby',
    'barnaby',
    'conflict_reconciliation',
    7,
    {
      requiresStoryline: { id: 'conflict_plaza_lanterns', status: ['active'], minStage: 1, maxStage: 1 },
      notSeenToday: true,
    },
    (_id, world) => {
      const heardDebate = findSpeakerMemory('barnaby', world, {
        tags: ['lantern_debate', 'lantern_debate_blunt'],
      });
      const tobyTension = getNpcRelation(world.npcRelations ?? {}, 'barnaby', 'toby').tension;
      const fromName = heardDebate?.fromResidentId
        ? RESIDENTS[heardDebate.fromResidentId]?.name
        : undefined;

      const rootText = heardDebate
        ? `${fromName ? `${fromName} already told me` : 'Heard word'} folks are grumbling about my new pier lanterns${tobyTension >= 15 ? '—looks like tempers spiked over by the bridge' : ''}. I only hung bright bulbs so nobody twists an ankle at dusk.`
        : `Mounted those tall pier lamps nice and sturdy over Mirror Pond—wait, you mean Toby and Nora think they’re too bright for the fireflies? Nobody mentioned a word to me yet.`;

      return {
        nodes: {
          root: {
            moodLabel: tobyTension >= 15 ? 'Gruff' : 'Surprised',
            text: rootText,
            choices: [
              {
                id: 'lanterns_suggest_hooded_brass',
                label: 'Try downward brass hoods tonight—bright planks, calm dark pond water.',
                tone: 'practical',
                nextNodeId: 'barnaby_hood_end',
                trustDelta: 1,
                reliabilityDelta: 8,
                isStoryMilestone: true,
                setEmotion: 'curious',
                advanceStoryline: {
                  id: 'conflict_plaza_lanterns',
                  setStage: 2,
                  setStatus: 'active',
                  setOutcome: 'bridge_compromise',
                  cooldownDays: 1,
                  note: 'Barnaby agreed to test downward brass lantern hoods overnight.',
                },
                adjustNpcRelations: [
                  { a: 'barnaby', b: 'toby', deltaAffinity: 6, deltaTension: -6, tag: 'hood_trial' },
                  { a: 'barnaby', b: 'nora', deltaAffinity: 4, deltaTension: -4, tag: 'hood_trial' },
                ],
                recordNpcMemories: [
                  {
                    target: 'speaker',
                    id: 'ev_lantern_trial_hood',
                    tag: 'lantern_trial_compromise',
                    category: 'interaction',
                    valence: 'warm',
                    importance: 4,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['barnaby', 'toby', 'nora'],
                  },
                ],
              },
              {
                id: 'lanterns_suggest_cool_off',
                label: 'Switch off the pier bulbs tonight so tempers cool down until tomorrow.',
                tone: 'gentle',
                nextNodeId: 'barnaby_space_end',
                trustDelta: 1,
                reliabilityDelta: 6,
                isStoryMilestone: true,
                setEmotion: 'relaxed',
                advanceStoryline: {
                  id: 'conflict_plaza_lanterns',
                  setStage: 2,
                  setStatus: 'active',
                  setOutcome: 'gentle_space',
                  cooldownDays: 1,
                  note: 'Everyone paused pier lighting for one quiet night to cool feelings.',
                },
                adjustNpcRelations: [
                  { a: 'barnaby', b: 'toby', deltaAffinity: 4, deltaTension: -8, tag: 'cooling_night' },
                ],
                recordNpcMemories: [
                  {
                    target: 'speaker',
                    id: 'ev_lantern_trial_space',
                    tag: 'lantern_trial_space',
                    category: 'interaction',
                    valence: 'warm',
                    importance: 4,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['barnaby', 'toby', 'nora'],
                  },
                ],
              },
              {
                id: 'lanterns_push_bright_pier',
                label: 'Keep every pier bulb blazing full strength—the rest of town will get used to it.',
                tone: 'blunt',
                nextNodeId: 'barnaby_heated_end',
                trustDelta: -1,
                isNegative: true,
                setEmotion: 'frustrated',
                advanceStoryline: {
                  id: 'conflict_plaza_lanterns',
                  setStage: 2,
                  setStatus: 'active',
                  setOutcome: 'bridge_compromise',
                  cooldownDays: 1,
                  note: 'Full-glare lamps stayed lit overnight, sharpening pond-side friction.',
                },
                adjustNpcRelations: [
                  { a: 'barnaby', b: 'toby', deltaAffinity: -6, deltaTension: 12, tag: 'bright_pier_glare' },
                  { a: 'barnaby', b: 'nora', deltaAffinity: -5, deltaTension: 10, tag: 'bright_pier_glare' },
                ],
                recordNpcMemories: [
                  {
                    target: 'speaker',
                    id: 'ev_lantern_trial_heated',
                    tag: 'lantern_trial_heated',
                    category: 'friction',
                    valence: 'tense',
                    importance: 4,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['barnaby', 'toby', 'nora'],
                  },
                ],
              },
            ],
          },
          barnaby_hood_end: {
            moodLabel: 'Thoughtful',
            text: `Downward brass hoods… hmm, directs light straight onto the wet boards while leaving the water dark! Give me tonight to test how it settles—check with Nora tomorrow.`,
          },
          barnaby_space_end: {
            moodLabel: 'Steady',
            text: `Fair call. Never hammer wood—or settle a neighbor tiff—while shoulders are tense. Ask Nora tomorrow once morning settles.`,
          },
          barnaby_heated_end: {
            moodLabel: 'Stubborn',
            text: `Hmph. Well, they’re staying bolted tonight at least. Nora will probably have an earful for both of us tomorrow.`,
          },
        },
      };
    },
  ),

  makeBranchingTopic(
    'conflict_lanterns_3_resolve',
    'nora',
    'conflict_reconciliation',
    19,
    {
      requiresStoryline: {
        id: 'conflict_plaza_lanterns',
        status: ['active'],
        minStage: 2,
        maxStage: 2,
        requireCooldownCleared: true,
      },
    },
    (_id, world) => {
      const noraMem = findSpeakerMemory('nora', world, {
        tags: [
          'lantern_debate',
          'lantern_debate_blunt',
          'lantern_trial_compromise',
          'lantern_trial_space',
          'lantern_trial_heated',
        ],
      });
      const btRel = getNpcRelation(world.npcRelations ?? {}, 'barnaby', 'toby');
      const noraRel = world.playerRelations?.nora;
      const noraAffinity = noraRel?.affinity ?? world.residents.nora.trust * 20;
      const noraTier = getRelationshipTier(noraAffinity);
      const fromText = noraMem?.fromResidentId
        ? `After hearing from ${RESIDENTS[noraMem.fromResidentId].name} about how dusk felt over Mirror Pond`
        : `Standing on the bridge after last night’s lantern trial`;

      const tensionSummary =
        btRel.tension >= 18
          ? `Toby and Barnaby are still walking wide circles around one another this morning, so we need a clean settlement.`
          : `Everyone cooled down nicely overnight—now we just decide what stays on Mirror Pond permanently.`;

      return {
        nodes: {
          root: {
            moodLabel: btRel.tension >= 18 ? 'Earnest' : 'Reflective',
            text: `${fromText}, ${tensionSummary}`,
            choices: [
              {
                id: 'lanterns_resolve_compromise',
                label: 'Anchor Barnaby’s downward brass hoods so planks glow and water stays dark.',
                tone: 'practical',
                nextNodeId: 'resolve_comp_end',
                trustDelta: 1,
                reliabilityDelta: 10,
                isStoryMilestone: true,
                setEmotion: 'happy',
                setSideFlags: {
                  lanternConflictResolved: true,
                  lanternConflictOutcome: 'bridge_compromise',
                },
                advanceStoryline: {
                  id: 'conflict_plaza_lanterns',
                  setStage: 3,
                  setStatus: 'completed',
                  setOutcome: 'bridge_compromise',
                  note: 'Settled on downward brass hoods balancing footing safety and firefly water.',
                },
                adjustNpcRelations: [
                  { a: 'barnaby', b: 'toby', deltaAffinity: 12, deltaTension: -16, tag: 'hood_compromise' },
                  { a: 'barnaby', b: 'nora', deltaAffinity: 8, deltaTension: -10, tag: 'hood_compromise' },
                ],
                recordNpcMemories: [
                  {
                    target: 'nora',
                    id: 'ev_lanterns_resolved_compromise',
                    tag: 'lanterns_resolved_compromise',
                    category: 'town_lore',
                    valence: 'warm',
                    importance: 4,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['barnaby', 'toby', 'nora'],
                  },
                  {
                    target: 'barnaby',
                    id: 'ev_lanterns_resolved_compromise',
                    tag: 'lanterns_resolved_compromise',
                    category: 'town_lore',
                    valence: 'warm',
                    importance: 4,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['barnaby', 'toby', 'nora'],
                  },
                  {
                    target: 'toby',
                    id: 'ev_lanterns_resolved_compromise',
                    tag: 'lanterns_resolved_compromise',
                    category: 'town_lore',
                    valence: 'warm',
                    importance: 4,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['barnaby', 'toby', 'nora'],
                  },
                ],
                unlockMemory: {
                  id: 'mem_side_lantern_compromise',
                  title: 'Hooded Brass by Mirror Pond',
                  summary:
                    'Barnaby, Toby, and Nora settled on warm downward-hooded lanterns that light the pier planks while keeping the reeds quiet for fireflies.',
                  residentId: 'nora',
                },
              },
              {
                id: 'lanterns_resolve_gentle_space',
                label: 'Leave the pier unlit for fireflies and place guide lamps at the bridgehead only.',
                tone: 'gentle',
                nextNodeId: 'resolve_space_end',
                trustDelta: 1,
                reliabilityDelta: 8,
                isStoryMilestone: true,
                setEmotion: 'relaxed',
                setSideFlags: {
                  lanternConflictResolved: true,
                  lanternConflictOutcome: 'gentle_space',
                },
                advanceStoryline: {
                  id: 'conflict_plaza_lanterns',
                  setStage: 3,
                  setStatus: 'completed',
                  setOutcome: 'gentle_space',
                  note: 'Kept guide lanterns at the bridgehead so Mirror Pond stays calm at dusk.',
                },
                adjustNpcRelations: [
                  { a: 'barnaby', b: 'toby', deltaAffinity: 8, deltaTension: -12, tag: 'bridgehead_sanctuary' },
                  { a: 'barnaby', b: 'nora', deltaAffinity: 6, deltaTension: -8, tag: 'bridgehead_sanctuary' },
                ],
                recordNpcMemories: [
                  {
                    target: 'nora',
                    id: 'ev_lanterns_resolved_space',
                    tag: 'lanterns_resolved_space',
                    category: 'town_lore',
                    valence: 'warm',
                    importance: 4,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['barnaby', 'toby', 'nora'],
                  },
                  {
                    target: 'barnaby',
                    id: 'ev_lanterns_resolved_space',
                    tag: 'lanterns_resolved_space',
                    category: 'town_lore',
                    valence: 'warm',
                    importance: 4,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['barnaby', 'toby', 'nora'],
                  },
                  {
                    target: 'toby',
                    id: 'ev_lanterns_resolved_space',
                    tag: 'lanterns_resolved_space',
                    category: 'town_lore',
                    valence: 'warm',
                    importance: 4,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['barnaby', 'toby', 'nora'],
                  },
                ],
                unlockMemory: {
                  id: 'mem_side_lantern_compromise',
                  title: 'Bridgehead Dusk Lanterns',
                  summary:
                    'Neighbors agreed to keep guide lanterns anchored at the cedar bridgehead so Mirror Pond stays dark and calm for evening sketches.',
                  residentId: 'nora',
                },
              },
              {
                id: 'lanterns_resolve_public_harmony',
                label: 'Gather Barnaby, Toby & Sora for a shared dusk candle-and-violin walk.',
                tone: 'warm',
                nextNodeId: 'resolve_harmony_end',
                minTier: 'friendly',
                requiresCondition: { minTrust: 2, minReliability: 30 },
                trustDelta: 2,
                reliabilityDelta: 12,
                isStoryMilestone: true,
                setEmotion: 'excited',
                setSideFlags: {
                  lanternConflictResolved: true,
                  lanternConflictOutcome: 'public_harmony',
                },
                advanceStoryline: {
                  id: 'conflict_plaza_lanterns',
                  setStage: 3,
                  setStatus: 'completed',
                  setOutcome: 'public_harmony',
                  note: 'United Barnaby, Toby, Nora & Sora with a shared evening candle walk.',
                },
                adjustNpcRelations: [
                  { a: 'barnaby', b: 'toby', deltaAffinity: 18, deltaTension: -24, tag: 'dusk_candle_walk' },
                  { a: 'barnaby', b: 'nora', deltaAffinity: 14, deltaTension: -16, tag: 'dusk_candle_walk' },
                  { a: 'nora', b: 'sora', deltaAffinity: 10, deltaTension: -6, tag: 'dusk_candle_walk' },
                  { a: 'barnaby', b: 'sora', deltaAffinity: 10, deltaTension: -6, tag: 'dusk_candle_walk' },
                ],
                recordNpcMemories: [
                  {
                    target: 'nora',
                    id: 'ev_lanterns_resolved_harmony',
                    tag: 'lanterns_resolved_harmony',
                    category: 'town_lore',
                    valence: 'warm',
                    importance: 5,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['nora', 'barnaby', 'toby', 'sora'],
                  },
                  {
                    target: 'barnaby',
                    id: 'ev_lanterns_resolved_harmony',
                    tag: 'lanterns_resolved_harmony',
                    category: 'town_lore',
                    valence: 'warm',
                    importance: 5,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['nora', 'barnaby', 'toby', 'sora'],
                  },
                  {
                    target: 'toby',
                    id: 'ev_lanterns_resolved_harmony',
                    tag: 'lanterns_resolved_harmony',
                    category: 'town_lore',
                    valence: 'warm',
                    importance: 5,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['nora', 'barnaby', 'toby', 'sora'],
                  },
                  {
                    target: 'sora',
                    id: 'ev_lanterns_resolved_harmony',
                    tag: 'lanterns_resolved_harmony',
                    category: 'town_lore',
                    valence: 'warm',
                    importance: 5,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['nora', 'barnaby', 'toby', 'sora'],
                  },
                ],
                unlockMemory: {
                  id: 'mem_side_lantern_compromise',
                  title: 'Mirror Pond Candle Walk',
                  summary:
                    'With Nora’s steady diplomacy, Barnaby, Toby, and Sora turned the pier dispute into an unhurried evening lantern-and-violin stroll.',
                  residentId: 'nora',
                },
              },
            ],
          },
          resolve_comp_end: {
            moodLabel: 'At Peace',
            text: `Smart and fair. Barnaby’s brass hoods already threw amber ovals along the planks while three fireflies blinked right back in the reeds.`,
          },
          resolve_space_end: {
            moodLabel: 'Serene',
            text: `Quiet agreement suits Mirror Pond. Barnaby moved the posts cleanly to the bridgehead without a grumble.`,
          },
          resolve_harmony_end: {
            moodLabel: 'Moved',
            text:
              noraTier === 'kindred' || noraTier === 'close'
                ? `Only someone neighbors truly trust could turn an argument into Sora playing under handheld paper candles. Thank you, friend.`
                : `Sora played a slow waltz by the bridgehead while Toby and Barnaby carried paper candles side by side. The whole bank felt warmer.`,
          },
        },
      };
    },
  ),
];
