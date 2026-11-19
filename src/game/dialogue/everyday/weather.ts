/**
 * Dialogue content module: WEATHER_SEASON_TOPICS.
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
import { RESIDENTS } from '../../residents';

export const WEATHER_SEASON_TOPICS: readonly DialogueTopic[] = [
  // ================= WEATHER & SEASON TOPICS =================
  makeSimpleTopic(
    'weather_rain_reflection',
    'any',
    'weather_season',
    7,
    { weathers: ['light_rain'], notSeenToday: true },
    {
      moodLabel: 'Cozy',
      buildText: (id) =>
        RESIDENTS[id].traits.rainBehavior === 'umbrella_stroll'
          ? `Listen to soft raindrops tapping against cedar leaves—best weather in town for spotting shimmering cobbles!`
          : `Rain smells so clean off the bakery awnings. No shame ducking under the eaves for a warm chat.`,
      choices: [
        {
          id: 'rain_cozy_yes',
          label: 'Rainy days make the porch lanterns glow twice as warm.',
          tone: 'warm',
          nextNodeId: 'rain_yes_end',
          trustDelta: 1,
          setEmotion: 'relaxed',
        },
      ],
      endings: {
        rain_yes_end: {
          moodLabel: 'Peaceful',
          text: `Wait till twilight hits the puddles—looks like liquid amber out here.`,
        },
      },
    },
  ),

  makeSimpleTopic(
    'weather_misty_breezy_note',
    'any',
    'weather_season',
    4,
    { weathers: ['misty_morning', 'breezy'], notSeenToday: true },
    {
      moodLabel: 'Observant',
      buildText: (_id, w) =>
        w.weather === 'misty_morning'
          ? `Cool pond mist is curling right across the flagstones this morning—makes the cottages look like storybook cutouts.`
          : `Hear that crisp breeze tuning the maple leaves? Feels like an invitation to wander down to Mirror Pond.`,
      choices: [
        {
          id: 'weather_mb_reply',
          label: 'Makes every familiar bench feel brand new.',
          tone: 'curious',
          nextNodeId: 'weather_mb_end',
          trustDelta: 1,
          setEmotion: 'curious',
        },
      ],
      endings: {
        weather_mb_end: {
          moodLabel: 'Cheerful',
          text: `Right? Half the magic here is just noticing how the sky changes.`,
        },
      },
    },
  ),
];
