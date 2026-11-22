import { SeasonType, TimePhase, WorldState } from './types';

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

// Everyday Gameplay GA-0 — canonical minute-spend and day-stamp helpers.
// These replace the scattered `Math.min(DAY_END_MINUTE, minuteOfDay + N)` literals
// so every everyday activity spends time through one clamp (and can tell the
// player, gently, when the evening slipped away).

export interface MinuteSpendResult {
  nextWorld: WorldState;
  /** The clamped minute-of-day after spending. */
  minuteOfDay: number;
  /** True when the requested spend reached past day's end and was gently clamped. */
  eveningSlippedAway: boolean;
}

export function spendMinutes(world: WorldState, minutes: number): MinuteSpendResult {
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
  const requested = world.minuteOfDay + safeMinutes;
  const clamped = clampMinuteOfDay(requested);
  return {
    nextWorld: { ...world, minuteOfDay: clamped },
    minuteOfDay: clamped,
    eveningSlippedAway: safeMinutes > 0 && clamped < requested,
  };
}

/** True when a `*Day` day-stamp refers to today (the once-per-day gating idiom). */
export function isDoneToday(stamp: number, day: number): boolean {
  return Number.isFinite(stamp) && Number.isFinite(day) && stamp === day;
}

/** Player-legible note appended to activity prose when a spend was clamped at day's end. */
export const EVENING_SLIPPED_NOTE = 'The evening slipped away faster than expected.';
