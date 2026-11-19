/**
 * Dialogue content module: EVERYDAY_HOME_TOPICS.
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
import { makeSimpleTopic } from '../../dialogueEngine';
import { PERSONAL_ITEM_MAP } from '../../inventory';

export const EVERYDAY_HOME_TOPICS: readonly DialogueTopic[] = [
  // ================= MILESTONE 2C — EVERYDAY HOME & HEARTH TOPICS =================
  makeSimpleTopic(
    'everyday_cottage_hearth',
    'any',
    'daily_slice',
    4,
    {
      notSeenToday: true,
      requiresNpcMemory: { tag: 'player_gift', maxDaysOld: 4 },
    },
    {
      moodLabel: 'Grateful',
      buildText: (id, w) => {
        const mem = w.npcMemories?.[id]?.find(
          (m) => m.tag === 'player_gift' && (m.detail?.personalItemId || m.detail?.itemId),
        );
        const personalLabel = mem?.detail?.personalItemId
          ? PERSONAL_ITEM_MAP[mem.detail.personalItemId as PersonalItemId]?.label
          : undefined;
        const itemLabel =
          personalLabel ??
          (mem?.detail?.itemId ? mem.detail.itemId.replace(/_/g, ' ') : 'your thoughtful gift');
        return id === 'clara'
          ? `That ${itemLabel} you brought by still sits right near the warming rack—it made my whole afternoon!`
          : `I still smile thinking of the ${itemLabel} you brought over earlier. Neighbors like you make Willow Lane feel lived-in.`;
      },
      choices: [
        {
          id: 'ev_gift_warm',
          label: 'Willow Step Cottage always has room for sharing.',
          tone: 'warm',
          nextNodeId: 'ev_gift_warm_end',
          trustDelta: 1,
          setEmotion: 'happy',
          markMemoryTagsMentioned: ['player_gift'],
        },
        {
          id: 'ev_gift_curious',
          label: 'Let me know what else you enjoy from the orchard or hearth.',
          tone: 'curious',
          nextNodeId: 'ev_gift_curious_end',
          trustDelta: 1,
          setEmotion: 'relaxed',
          markMemoryTagsMentioned: ['player_gift'],
        },
      ],
      endings: {
        ev_gift_warm_end: {
          moodLabel: 'Warm',
          text: `Anytime your kettle starts whistling, my doorstep’s never far away.`,
        },
        ev_gift_curious_end: {
          moodLabel: 'Fond',
          text: `Fresh blossoms, warm loaves, smooth river glass—little things gathered with care mean the most.`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'everyday_hearth_aroma',
    'clara',
    'daily_slice',
    4,
    { notSeenToday: true, talkedCountMin: 1 },
    {
      moodLabel: 'Warm',
      buildText: (_id, w) =>
        (w.dailyActivities?.bakedCountToday ?? 0) > 0
          ? `Wait a second—smell that gingered honey & chamomile crust! Have you been baking in Willow Step Cottage today?`
          : `Your cottage stone hearth holds heat wonderfully once you get the copper kettle humming. Try tossing a fresh herb loaf or crabapple tart in sometime!`,
      choices: [
        {
          id: 'ev_clara_hearth_tip',
          label: 'Do you have a favorite pairing for afternoon cottage tea?',
          tone: 'curious',
          nextNodeId: 'ev_clara_hearth_end',
          trustDelta: 1,
          setEmotion: 'happy',
        },
      ],
      endings: {
        ev_clara_hearth_end: {
          moodLabel: 'Cheerful',
          text: `Fern Hollow crabapples glazed with wild honey—or sweet lavender shortbread when golden hour hits the window sill!`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'everyday_orchard_gathering',
    'mina',
    'daily_slice',
    4,
    { notSeenToday: true, talkedCountMin: 1 },
    {
      moodLabel: 'Bright',
      buildText: (_id, w) =>
        w.dailyActivities?.orchardHarvestedToday || w.dailyActivities?.greenhousePlantersTendedToday
          ? `Fresh soil on your cuffs! Glad to see you clipping lemon thyme and checking Fern Hollow’s crates today.`
          : `Look inside the herb trays beside Sunbeam Greenhouse or wander north to Fern Hollow Orchard—every day brings fresh blooms and honeycomb.`,
      choices: [
        {
          id: 'ev_mina_vase',
          label: 'I’m setting fresh blooms in my cottage table vase too.',
          tone: 'warm',
          nextNodeId: 'ev_mina_vase_end',
          trustDelta: 1,
          setEmotion: 'happy',
        },
      ],
      endings: {
        ev_mina_vase_end: {
          moodLabel: 'Gentle',
          text: `Nothing wakes up a quiet room faster than chamomile or lavender catching sunlight in stoneware!`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'everyday_cottage_keepsakes',
    'nora',
    'daily_slice',
    4,
    { notSeenToday: true, talkedCountMin: 1 },
    {
      moodLabel: 'Thoughtful',
      buildText: (_id, w) => {
        const count = w.cottageState?.displayedKeepsakeIds?.length ?? 0;
        return count > 0
          ? `Heard your oak shelf at Willow Step Cottage already holds ${count === 1 ? 'a cherished neighborhood keepsake' : `${count} neighborhood keepsakes`}—small things anchor a home fast.`
          : `An empty cottage shelf fills up gently if you keep writing, trading small gifts, and noticing little finds along Mirror Pond.`;
      },
      choices: [
        {
          id: 'ev_nora_almanac',
          label: 'Been reading the seasonal almanac by the south window.',
          tone: 'warm',
          nextNodeId: 'ev_nora_almanac_end',
          trustDelta: 1,
          setEmotion: 'relaxed',
        },
      ],
      endings: {
        ev_nora_almanac_end: {
          moodLabel: 'Warm',
          text: `Keep turning a page every morning—the seasons tell half the neighborhood’s best secrets.`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'everyday_home_kettle_steam',
    'mina',
    'daily_slice',
    4,
    { notSeenToday: true, talkedCountMin: 1 },
    {
      moodLabel: 'Delighted',
      buildText: (_id, w) => {
        const kettleWarm =
          (w.cottageState?.kettleWarmUntilMinute ?? 0) > 0 &&
          w.minuteOfDay <= (w.cottageState?.kettleWarmUntilMinute ?? 0);
        if (kettleWarm) {
          return `I passed your gate a while ago and your kitchen window was all fogged with steam—don’t tell me the kettle isn’t humming at Willow Step Cottage right now!`;
        }
        if (w.cottageState?.placedFlowerId) {
          return `Your cottage window caught the light this morning—something fresh is standing in the oak table vase, isn’t there? The whole sill smells green.`;
        }
        return `A quiet cottage warms up fast once the kettle does. Steam on the glass, a bloom in the vase—those are the telltales of a home settling in.`;
      },
      choices: [
        {
          id: 'ev_mina_steam_warm',
          label: 'Come by for a warm cup when the rain settles, then.',
          tone: 'warm',
          nextNodeId: 'ev_mina_steam_warm_end',
          trustDelta: 1,
          setEmotion: 'happy',
        },
        {
          id: 'ev_mina_steam_curious',
          label: 'What telltale signs do neighbors look for most?',
          tone: 'curious',
          nextNodeId: 'ev_mina_steam_curious_end',
          trustDelta: 1,
          setEmotion: 'relaxed',
        },
      ],
      endings: {
        ev_mina_steam_warm_end: {
          moodLabel: 'Gentle',
          text: `I’ll bring a sprig of lemon thyme for the vase—tea tastes brighter when the table has something growing in it.`,
        },
        ev_mina_steam_curious_end: {
          moodLabel: 'Thoughtful',
          text: `Window steam means somebody’s home. A tended vase means they’re staying. Both together—that’s a cottage the lane leans on.`,
        },
      },
    },
  ),
];
