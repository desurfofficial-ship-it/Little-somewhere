import { NEXT_DAY_WAKE_MINUTE, getSeasonForDay } from './time';
import { rollWeatherForDay } from './environment';
import { PLAYER_DEFAULT_FACING, PLAYER_SPAWN } from './worldMap';
import {
  MigrationResult,
  createDefaultWorldState,
  migrateWorldState,
  sanitizeWorldState,
} from './migrations';
import { createInitialNpcRuntime } from './simulation';
import { WorldState } from './types';

export const STORAGE_KEY = 'little_somewhere_world_v1';
export const STORAGE_BACKUP_KEY = 'little_somewhere_world_v1_backup';

export function createFreshWorldState(): WorldState {
  return createDefaultWorldState();
}

export function serializeWorldState(state: WorldState): string {
  return JSON.stringify(sanitizeWorldState(state));
}

export function deserializeWorldState(rawJson: string): MigrationResult {
  try {
    const parsed: unknown = JSON.parse(rawJson);
    return migrateWorldState(parsed);
  } catch {
    return {
      state: createDefaultWorldState(),
      migratedFromVersion: null,
      warnings: ['corrupt JSON payload; created fresh WorldState v2'],
    };
  }
}

export function loadWorldState(): WorldState {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createDefaultWorldState();
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultWorldState();
    const res = deserializeWorldState(raw);
    if (res.migratedFromVersion === 1) {
      try {
        window.localStorage.setItem(STORAGE_BACKUP_KEY, raw);
        window.localStorage.setItem(STORAGE_KEY, serializeWorldState(res.state));
      } catch {
        // Ignore quota errors on backup/upgrade write
      }
    }
    return res.state;
  } catch {
    return createDefaultWorldState();
  }
}

export function saveWorldState(state: WorldState): { ok: boolean; error?: string } {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ok: false, error: 'localStorage unavailable' };
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'storage write failed',
    };
  }
}

export function resetWorldState(): WorldState {
  const fresh = createDefaultWorldState();
  saveWorldState(fresh);
  return fresh;
}

export function advanceToNextDay(state: WorldState): WorldState {
  const nextResidents = { ...state.residents };
  for (const key of Object.keys(nextResidents) as Array<keyof typeof nextResidents>) {
    nextResidents[key] = {
      ...nextResidents[key],
      talkedToday: false,
    };
  }

  const nextPlayerRelations = { ...state.playerRelations };
  for (const key of Object.keys(nextPlayerRelations) as Array<keyof typeof nextPlayerRelations>) {
    nextPlayerRelations[key] = {
      ...nextPlayerRelations[key],
      dailyAffinityGained: 0,
      moodUntilMinute: 0,
    };
  }

  const nextDay = state.day + 1;
  return {
    ...state,
    day: nextDay,
    minuteOfDay: NEXT_DAY_WAKE_MINUTE, // 8:00 AM
    season: getSeasonForDay(nextDay).season,
    weather: rollWeatherForDay(state.simSeed, nextDay),
    playerPos: { ...PLAYER_SPAWN },
    playerFacing: PLAYER_DEFAULT_FACING,
    residents: nextResidents,
    playerRelations: nextPlayerRelations,
    npcRuntime: createInitialNpcRuntime(NEXT_DAY_WAKE_MINUTE, state.flags.claraArthurReconciled),
    activeEncounters: [],
    mailboxUnread: true,
  };
}
