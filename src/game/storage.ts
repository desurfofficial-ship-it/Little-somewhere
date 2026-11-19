import { createInitialResidentsProgress } from './residents';
import { createInitialStoryFlags } from './narrative';
import { PLAYER_DEFAULT_FACING, PLAYER_SPAWN } from './worldMap';
import { WorldState } from './types';

const STORAGE_KEY = 'little_somewhere_world_v1';

export function createFreshWorldState(): WorldState {
  return {
    day: 1,
    minuteOfDay: 495, // 8:15 AM sunlit morning
    playerPos: { ...PLAYER_SPAWN },
    playerFacing: PLAYER_DEFAULT_FACING,
    residents: createInitialResidentsProgress(),
    flags: createInitialStoryFlags(),
    memories: [
      {
        id: 'mem_arrival',
        day: 1,
        phase: 'morning',
        title: 'Moving Into Willow Step Cottage',
        summary: 'Morning sunlight spilled across the cobblestone lane as I stepped onto my new porch.',
      },
    ],
    mailboxUnread: true,
    dailyLettersRead: [],
    bellRungCount: 0,
  };
}

export function loadWorldState(): WorldState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createFreshWorldState();
    const parsed = JSON.parse(raw) as Partial<WorldState>;
    if (!parsed || typeof parsed.day !== 'number' || !parsed.residents || !parsed.flags) {
      return createFreshWorldState();
    }
    const fresh = createFreshWorldState();
    return {
      ...fresh,
      ...parsed,
      playerPos: parsed.playerPos ?? fresh.playerPos,
      residents: { ...fresh.residents, ...parsed.residents },
      flags: { ...fresh.flags, ...parsed.flags },
      memories: Array.isArray(parsed.memories) && parsed.memories.length > 0 ? parsed.memories : fresh.memories,
      dailyLettersRead: Array.isArray(parsed.dailyLettersRead) ? parsed.dailyLettersRead : [],
    };
  } catch {
    return createFreshWorldState();
  }
}

export function saveWorldState(state: WorldState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function resetWorldState(): WorldState {
  const fresh = createFreshWorldState();
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

  return {
    ...state,
    day: state.day + 1,
    minuteOfDay: 480, // 8:00 AM
    playerPos: { ...PLAYER_SPAWN },
    playerFacing: PLAYER_DEFAULT_FACING,
    residents: nextResidents,
    mailboxUnread: true,
  };
}
