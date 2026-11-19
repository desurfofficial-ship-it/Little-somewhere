import { SeasonType, TimePhase } from './types';

export const DAY_START_MINUTE = 360; // 6:00 AM
export const NEXT_DAY_WAKE_MINUTE = 480; // 8:00 AM
export const DEFAULT_START_MINUTE = 495; // 8:15 AM
export const DAY_END_MINUTE = 1290; // 9:30 PM
export const DAYS_PER_SEASON = 10;

export const SEASON_ORDER: readonly SeasonType[] = ['spring', 'summer', 'autumn', 'winter'];

export function clampMinuteOfDay(minute: number): number {
  if (!Number.isFinite(minute)) return DEFAULT_START_MINUTE;
  return Math.max(DAY_START_MINUTE, Math.min(DAY_END_MINUTE, minute));
}

export function getTimePhase(minuteOfDay: number): TimePhase {
  if (minuteOfDay < 690) return 'morning'; // 6:00 AM - 11:30 AM
  if (minuteOfDay < 960) return 'afternoon'; // 11:30 AM - 4:00 PM
  if (minuteOfDay < 1110) return 'golden'; // 4:00 PM - 6:30 PM
  return 'dusk'; // 6:30 PM - 9:30 PM
}

export function formatClock(minuteOfDay: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.round(minuteOfDay)));
  const hours24 = Math.floor(clamped / 60);
  const mins = clamped % 60;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${mins.toString().padStart(2, '0')} ${suffix}`;
}

export function advanceSimulationClock(minuteOfDay: number, deltaMinutes: number): number {
  return clampMinuteOfDay(minuteOfDay + deltaMinutes);
}

export function getSeasonForDay(day: number): {
  season: SeasonType;
  dayOfSeason: number;
  year: number;
} {
  const safeDay = Number.isFinite(day) && day >= 1 ? Math.floor(day) : 1;
  const zeroIndexed = safeDay - 1;
  const seasonIdx = Math.floor(zeroIndexed / DAYS_PER_SEASON) % SEASON_ORDER.length;
  const dayOfSeason = (zeroIndexed % DAYS_PER_SEASON) + 1;
  const year = Math.floor(zeroIndexed / (DAYS_PER_SEASON * SEASON_ORDER.length)) + 1;
  return {
    season: SEASON_ORDER[seasonIdx],
    dayOfSeason,
    year,
  };
}
