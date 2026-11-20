/**
 * Dialogue content module: WILDS_TOPICS.
 *
 * Build 10 — The Wild Hollows. Two knowledge-bounded check-ins unlocked by
 * exploration: Mina on the foxglove seeds from Sorrel Hollow's old well (she may
 * reference the greenhouse pots she tends herself), and Rowan on the wild hive log
 * along the Bee Line (his orchard-keeper beat). Selection/evaluation logic lives in
 * ../dialogueEngine — this file is content-only. Ordering contract: see ./index.ts.
 */
import { DialogueTopic } from '../../types';
import { makeBranchingTopic } from '../../dialogueEngine';

export const WILDS_TOPICS: readonly DialogueTopic[] = [
  makeBranchingTopic(
    'daily_mina_foxglove',
    'mina',
    'daily_slice',
    14,
    { requiresMet: true, sideFlagsTrue: ['explored_sorrel_hollow'], notSeenToday: true },
    (_id, world) => {
      const gh = world.greenhouseState;
      const foxgloveGrowing = (gh?.plots ?? []).some((p) => p.cropId === 'foxglove');
      const foxgloveReady = (gh?.plots ?? []).some((p) => p.cropId === 'foxglove' && p.stage >= 3);
      const hasSeeds = (world.inventory?.foxglove_seeds ?? 0) > 0;
      const hasBloom = (world.inventory?.foxglove_bloom ?? 0) > 0;
      const rootText = foxgloveReady
        ? `Your foxglove on the shared shelf has opened its first spotted bells! I pressed my nose right up to the glass this morning. Snip a spire when you like — wild foxglove in a village garden, can you imagine?`
        : foxgloveGrowing
        ? `The foxglove you sowed from those old well seeds is settling in beautifully on the shared shelf. Slow grower, that one — but the hollow's garden clearly taught it patience.`
        : hasSeeds
        ? `You found foxglove seeds in the old well at Sorrel Hollow? Oh, bring them to the greenhouse straight away — there's room on the shared corner shelf, and seeds that waited that long deserve warm soil.`
        : hasBloom
        ? `That foxglove spire you're carrying — speckled bells, dusty-rose? That's the wild strain, the kind that used to grow by the old well. Keep it somewhere dry and it'll last ages on your shelf.`
        : `So you've wandered down to the old well in Sorrel Hollow? I've always wondered who planted the garden that once kept it. If the stonework is still sound, the seeds of whatever grew there might still be waiting too.`;
      return {
        nodes: {
          root: {
            moodLabel: foxgloveReady ? 'Delighted' : 'Bright',
            text: rootText,
            choices: [
              {
                id: 'mina_foxglove_thanks',
                label: 'I’ll bring the hollow’s garden back to life, one pot at a time.',
                tone: 'warm',
                nextNodeId: 'mina_foxglove_end',
                trustDelta: 1,
                reliabilityDelta: 4,
                setEmotion: 'happy',
                recordNpcMemories: [
                  {
                    target: 'mina',
                    id: 'ev_foxglove_story_shared',
                    tag: 'foxglove_story_shared',
                    category: 'social_impression',
                    valence: 'warm',
                    importance: 3,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['mina'],
                  },
                ],
              },
              {
                id: 'mina_foxglove_why_query',
                label: 'Do you know who tended that garden before the square had a name?',
                tone: 'curious',
                nextNodeId: 'mina_foxglove_history_end',
                trustDelta: 1,
              },
            ],
          },
          mina_foxglove_end: {
            moodLabel: 'Gentle',
            text: `One pot at a time is exactly right. That's how every garden in this valley began — somebody planted a single seed because it seemed like a kind thing to do.`,
          },
          mina_foxglove_history_end: {
            moodLabel: 'Wistful',
            text: `Nobody living, I think. Old wells don't wear out — they just outlast the houses around them. Whatever foxgloves come up from those seeds, they'll be the first new thing that garden has grown in a very long while.`,
          },
        },
      };
    },
  ),

  makeBranchingTopic(
    'daily_rowan_beeline_checkin',
    'rowan',
    'daily_slice',
    14,
    { requiresMet: true, sideFlagsTrue: ['explored_bee_line'], notSeenToday: true },
    (_id, world) => {
      const winter = world.season === 'winter';
      const rootText = winter
        ? `You found the old hive log out along the clover trail? Wild colonies pick their own lodgings, and that log's been tenanted longer than the orchard gate's stood. Come first frost I keep my distance — they seal the door with propolis and hum themselves warm till spring.`
        : `You found the wild hive log! Village skeps give us comb and honey, but log hives keep their own counsel — we take from them only what they offer. That colony out east has pollinated my crabapples for years without ever being asked.`;
      return {
        nodes: {
          root: {
            moodLabel: 'Warm',
            text: rootText,
            choices: [
              {
                id: 'rowan_beeline_thanks',
                label: 'I’ll leave the log hive to its own quiet work, then.',
                tone: 'warm',
                nextNodeId: 'rowan_beeline_end',
                trustDelta: 1,
                reliabilityDelta: 4,
                setEmotion: 'happy',
                recordNpcMemories: [
                  {
                    target: 'rowan',
                    id: 'ev_beeline_respect_shared',
                    tag: 'beeline_respect_shared',
                    category: 'social_impression',
                    valence: 'warm',
                    importance: 2,
                    retention: 'durable',
                    subjectPlayer: true,
                    subjectResidents: ['rowan'],
                  },
                ],
              },
            ],
          },
          rowan_beeline_end: {
            moodLabel: 'Gentle',
            text: `That's the whole trick of keeping bees — half the work is knowing when to simply walk softly past. Clover trail's the pleasant way there, too. Mind the wet grass at morning.`,
          },
        },
      };
    },
  ),
];
