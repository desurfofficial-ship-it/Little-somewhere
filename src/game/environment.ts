import { computeEnvironmentState } from './narrative';
import { hashSeed, mulberry32 } from './rng';
import { DAY_END_MINUTE, DAY_START_MINUTE, getSeasonForDay, getTimePhase } from './time';
import {
  EnvironmentalState,
  SeasonType,
  TimePhase,
  WeatherType,
  WorldState,
} from './types';

export interface TimeOfDayState {
  phase: TimePhase;
  tNorm: number; // 0..1 across sunlit day -> dusk
  sunElevation: number; // radians above horizon
  sunAzimuth: number;
  lanternScheduleActive: boolean;
  cozyLateNightHint: boolean;
}

export interface WeatherState {
  current: WeatherType;
  effective: WeatherType; // misty_morning lifts cleanly into sunlit after 10:30 AM
  tomorrowForecast: WeatherType;
  intensity: number; // 0..1
  puddlesActive: boolean;
}

export interface SeasonState {
  season: SeasonType;
  dayOfSeason: number;
  year: number;
  seasonLabel: string;
  meadowTintHex: string;
  groveBaseTintHex: string;
  groveTopTintHex: string;
}

export interface NpcEnvironmentTouches {
  claraPastryBasketVisible: boolean;
  minaGreenhouseStage: number; // 1..3
  noticeboardFlyerCount: number; // 1..3
  arthurEarlyPorchLamp: boolean;
}

export interface ComposedEnvironmentState {
  revision: number;
  timeOfDay: TimeOfDayState;
  weather: WeatherState;
  season: SeasonState;
  playerChanges: EnvironmentalState;
  npcTouches: NpcEnvironmentTouches;
}

const SEASON_VISUAL_PALETTES: Record<
  SeasonType,
  {
    label: string;
    meadowTintHex: string;
    groveBaseTintHex: string;
    groveTopTintHex: string;
  }
> = {
  spring: {
    label: 'Spring',
    meadowTintHex: '#FFFFFF',
    groveBaseTintHex: '#FFFFFF',
    groveTopTintHex: '#FFFFFF',
  },
  summer: {
    label: 'Summer',
    meadowTintHex: '#F3F7DE',
    groveBaseTintHex: '#ECFAEA',
    groveTopTintHex: '#FFF6D8',
  },
  autumn: {
    label: 'Autumn',
    meadowTintHex: '#EAE0B8',
    groveBaseTintHex: '#E8B878',
    groveTopTintHex: '#E5975E',
  },
  winter: {
    label: 'Winter',
    meadowTintHex: '#DCEAE8',
    groveBaseTintHex: '#CEE0DE',
    groveTopTintHex: '#EAEFF2',
  },
};

export function getWeatherLabel(weather: WeatherType): string {
  switch (weather) {
    case 'sunlit':
      return 'Sunlit';
    case 'breezy':
      return 'Breezy';
    case 'misty_morning':
      return 'Misty Morning';
    case 'light_rain':
      return 'Light Rain';
  }
}

export function getSeasonLabel(season: SeasonType): string {
  return SEASON_VISUAL_PALETTES[season].label;
}

/**
 * Deterministic daily weather roll.
 * Day 1 is always 'sunlit' to preserve the signature sunlit storybook onboarding & title vista.
 */
export function rollWeatherForDay(simSeed: number, day: number): WeatherType {
  if (day <= 1) return 'sunlit';
  const rng = mulberry32(hashSeed(simSeed, day, 'weather_v1'));
  const roll = rng();
  if (roll < 0.46) return 'sunlit';
  if (roll < 0.70) return 'breezy';
  if (roll < 0.84) return 'misty_morning';
  return 'light_rain';
}

/**
 * Pure 5-Layer Environment Composer (Time of Day, Weather, Seasons, Player Changes, NPC Touches).
 * Computes a deterministic revision stamp so the Three.js renderer only touches GPU/scene props on change.
 */
export function composeEnvironmentState(
  world: Pick<
    WorldState,
    'day' | 'minuteOfDay' | 'simSeed' | 'season' | 'weather' | 'flags' | 'worldEvents'
  > &
    Partial<Pick<WorldState, 'sideFlags'>>,
): ComposedEnvironmentState {
  const phase = getTimePhase(world.minuteOfDay);
  const clampedMin = Math.max(DAY_START_MINUTE, Math.min(DAY_END_MINUTE, world.minuteOfDay));
  const tNorm = Math.max(0, Math.min(1, (clampedMin - 420) / 870));

  // Layer 1: Time of Day curves
  const sunElevation = Math.max(0.18, Math.sin(tNorm * Math.PI) * 1.12);
  const sunAzimuth = 0.5 + tNorm * 1.9;
  const cozyLateNightHint = clampedMin >= 1260;

  // Layer 2: Weather + Mist Morning Clearing (>= 10:30 AM / 630m)
  const rawWeather = world.weather ?? 'sunlit';
  const mistActive = rawWeather === 'misty_morning' && clampedMin < 630;
  const effectiveWeather: WeatherType =
    rawWeather === 'misty_morning' && !mistActive ? 'sunlit' : rawWeather;
  const weatherIntensity =
    effectiveWeather === 'light_rain'
      ? 0.75
      : effectiveWeather === 'misty_morning'
      ? Math.max(0, (630 - clampedMin) / 180)
      : effectiveWeather === 'breezy'
      ? 0.55
      : 0.0;
  const yesterdayWeather = world.day > 1 ? rollWeatherForDay(world.simSeed, world.day - 1) : 'sunlit';
  const puddlesActive =
    effectiveWeather === 'light_rain' ||
    (yesterdayWeather === 'light_rain' && clampedMin < 600);
  const tomorrowForecast = rollWeatherForDay(world.simSeed, world.day + 1);

  const lanternScheduleActive =
    phase === 'dusk' ||
    clampedMin >= 1095 ||
    effectiveWeather === 'light_rain' ||
    effectiveWeather === 'misty_morning' ||
    world.flags.lanternsLit;

  // Layer 3: Season State
  const derivedSeason = world.season ?? getSeasonForDay(world.day).season;
  const seasonMeta = getSeasonForDay(world.day);
  const seasonPalette = SEASON_VISUAL_PALETTES[derivedSeason];

  // Layer 4: Player-Driven StoryFlags & Diorama Changes
  const playerChanges = computeEnvironmentState(world.flags, world.sideFlags);

  // Layer 5: NPC-Driven Daily Environmental Touches
  const claraPastryBasketVisible =
    phase === 'morning' ||
    (phase === 'afternoon' && (effectiveWeather === 'sunlit' || world.flags.claraArthurReconciled));
  const minaGreenhouseStage = Math.min(
    3,
    1 + (world.flags.plantedMoonPetals ? 1 : 0) + (world.flags.repairedFountain ? 1 : 0),
  );
  const noticeboardFlyerCount = Math.min(
    3,
    1 +
      (world.flags.heardBellMystery ? 1 : 0) +
      (world.flags.bellRestored || (world.worldEvents?.length ?? 0) > 0 ? 1 : 0),
  );
  const arthurEarlyPorchLamp =
    effectiveWeather === 'light_rain' || phase === 'golden' || phase === 'dusk';

  // Deterministic static revision (changes only when season, weather state, flags, or NPC touches shift)
  const staticFlagsMask =
    (playerChanges.plantersBloomed << 0) |
    ((playerChanges.fountainFlowing ? 1 : 0) << 2) |
    ((playerChanges.ivyCleared ? 1 : 0) << 3) |
    ((playerChanges.bellGleaming ? 1 : 0) << 4) |
    ((playerChanges.festoonLanterns ? 1 : 0) << 5) |
    ((playerChanges.bakeryTablesOpen ? 1 : 0) << 6) |
    ((playerChanges.reconciledTogether ? 1 : 0) << 7) |
    ((playerChanges.noticeboardUpdated ? 1 : 0) << 8) |
    ((world.flags.foundBrassClapper ? 1 : 0) << 9) |
    ((claraPastryBasketVisible ? 1 : 0) << 10) |
    ((minaGreenhouseStage & 3) << 11) |
    ((noticeboardFlyerCount & 3) << 13) |
    ((arthurEarlyPorchLamp ? 1 : 0) << 15) |
    ((lanternScheduleActive ? 1 : 0) << 16);

  const weatherIdx =
    effectiveWeather === 'sunlit'
      ? 0
      : effectiveWeather === 'breezy'
      ? 1
      : effectiveWeather === 'misty_morning'
      ? 2
      : 3;
  const seasonIdx =
    derivedSeason === 'spring'
      ? 0
      : derivedSeason === 'summer'
      ? 1
      : derivedSeason === 'autumn'
      ? 2
      : 3;

  const orchardOutcomeCode =
    playerChanges.orchardGatheringOutcome === 'spiced_tart_table'
      ? 1
      : playerChanges.orchardGatheringOutcome === 'blossom_honey_picnic'
      ? 2
      : 0;

  const revision =
    (world.day & 1023) * 8388608 +
    orchardOutcomeCode * 2097152 +
    (seasonIdx << 19) +
    (weatherIdx << 17) +
    staticFlagsMask;

  return {
    revision,
    timeOfDay: {
      phase,
      tNorm,
      sunElevation,
      sunAzimuth,
      lanternScheduleActive,
      cozyLateNightHint,
    },
    weather: {
      current: rawWeather,
      effective: effectiveWeather,
      tomorrowForecast,
      intensity: weatherIntensity,
      puddlesActive,
    },
    season: {
      season: derivedSeason,
      dayOfSeason: seasonMeta.dayOfSeason,
      year: seasonMeta.year,
      seasonLabel: seasonPalette.label,
      meadowTintHex: seasonPalette.meadowTintHex,
      groveBaseTintHex: seasonPalette.groveBaseTintHex,
      groveTopTintHex: seasonPalette.groveTopTintHex,
    },
    playerChanges,
    npcTouches: {
      claraPastryBasketVisible,
      minaGreenhouseStage,
      noticeboardFlyerCount,
      arthurEarlyPorchLamp,
    },
  };
}
