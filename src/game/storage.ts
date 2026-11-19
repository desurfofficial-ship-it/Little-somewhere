import { NEXT_DAY_WAKE_MINUTE, getSeasonForDay } from './time';
import { rollWeatherForDay } from './environment';
import { PLAYER_DEFAULT_FACING, PLAYER_SPAWN } from './worldMap';
import {
  CURRENT_SCHEMA_VERSION,
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
      warnings: ['corrupt JSON payload; created fresh WorldState v3'],
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
    if (res.migratedFromVersion !== null && res.migratedFromVersion < CURRENT_SCHEMA_VERSION) {
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

function mixHash(h: number, str: string): number {
  let out = h >>> 0;
  for (let i = 0; i < str.length; i++) {
    out ^= str.charCodeAt(i);
    out = Math.imul(out, 16777619) >>> 0;
  }
  out ^= 0xff;
  return Math.imul(out, 16777619) >>> 0;
}

function mixNum(h: number, n: number): number {
  let out = h >>> 0;
  const val = Number.isFinite(n) ? Math.trunc(n) : 0;
  out ^= val & 0xff;
  out = Math.imul(out, 16777619) >>> 0;
  out ^= (val >>> 8) & 0xff;
  out = Math.imul(out, 16777619) >>> 0;
  out ^= (val >>> 16) & 0xff;
  out = Math.imul(out, 16777619) >>> 0;
  out ^= (val >>> 24) & 0xff;
  return Math.imul(out, 16777619) >>> 0;
}

/**
 * Fast, allocation-free persistence revision fingerprint covering all meaningful persisted WorldState fields
 * while ignoring ephemeral animation jitter (walkPhase, stuckSeconds, currentSpeed).
 */
export function computeWorldSaveRevision(state: WorldState): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  const pushStr = (s: string) => {
    h1 = mixHash(h1, s);
    h2 = mixHash(h2 ^ 0xa5, s);
  };
  const pushNum = (n: number) => {
    h1 = mixNum(h1, n);
    h2 = mixNum(h2 ^ 0x5a, n);
  };
  const pushBool = (b: boolean) => pushNum(b ? 1 : 0);

  pushNum(state.schemaVersion);
  pushNum(state.simSeed);
  pushStr(state.regionId);
  pushNum(state.day);
  pushNum(Math.floor(state.minuteOfDay));
  pushStr(state.season);
  pushStr(state.weather);
  pushNum(Math.round(state.playerPos.x * 20));
  pushNum(Math.round(state.playerPos.z * 20));
  pushNum(Math.round(state.playerFacing * 20));
  pushStr(state.playerPosture ?? 'standing');
  pushStr(state.playerSeatId ?? '');
  pushStr(state.playerHeldItem ?? '');
  pushBool(state.mailboxUnread);
  pushNum(state.bellRungCount);

  const letters = state.dailyLettersRead ?? [];
  pushNum(letters.length);
  for (let i = 0; i < letters.length; i++) pushNum(letters[i]);

  const f = state.flags;
  pushBool(f.heardBellMystery);
  pushBool(f.foundPostcard);
  pushBool(f.deliveredPostcard);
  pushBool(f.brewedChamomileTea);
  pushBool(f.borrowedBarnabyLadder);
  pushBool(f.clearedGazeboIvy);
  pushBool(f.foundBrassClapper);
  pushBool(f.repairedFountain);
  pushBool(f.plantedMoonPetals);
  pushStr(f.mediationStyle);
  pushBool(f.bellRestored);
  pushBool(f.claraArthurReconciled);
  pushBool(f.lanternsLit);

  const sideKeys = Object.keys(state.sideFlags ?? {}).sort();
  pushNum(sideKeys.length);
  for (let i = 0; i < sideKeys.length; i++) {
    const sk = sideKeys[i];
    pushStr(sk);
    pushStr(String(state.sideFlags[sk]));
  }

  const propKeys = Object.keys(state.worldProps ?? {}).sort();
  pushNum(propKeys.length);
  for (let i = 0; i < propKeys.length; i++) {
    const p = state.worldProps[propKeys[i] as keyof WorldState['worldProps']];
    if (p) {
      pushStr(p.id);
      pushStr(p.holder);
      pushNum(Math.round(p.pos.x * 20));
      pushNum(Math.round(p.pos.z * 20));
    }
  }

  const topicKeys = Object.keys(state.topicHistory ?? {}).sort();
  pushNum(topicKeys.length);
  for (let i = 0; i < topicKeys.length; i++) {
    const tk = topicKeys[i];
    const th = state.topicHistory[tk];
    pushStr(tk);
    pushNum(th.seenCount);
    pushNum(th.lastSeenDay);
  }

  pushNum(state.memories.length);
  for (let i = 0; i < state.memories.length; i++) {
    pushStr(state.memories[i].id);
  }

  const residentKeys = Object.keys(state.residents).sort();
  pushNum(residentKeys.length);
  for (let i = 0; i < residentKeys.length; i++) {
    const id = residentKeys[i] as keyof WorldState['residents'];
    const prog = state.residents[id];
    pushStr(id);
    if (prog) {
      pushNum(prog.trust);
      pushBool(prog.met);
      pushBool(prog.talkedToday);
      pushStr(prog.mood);
      pushStr(prog.lastDialogueId ?? '');
    }
    const rel = state.playerRelations?.[id];
    if (rel) {
      pushNum(rel.affinity);
      pushNum(rel.familiarity);
      pushNum(rel.dailyAffinityGained);
      pushNum(rel.talkedCount);
      pushNum(rel.lastTalkDay ?? -1);
      pushStr(rel.lastTalkPhase ?? '');
      pushStr(rel.mood);
      pushNum(Math.round(rel.moodUntilMinute));
      pushNum(rel.reliability ?? 25);
      pushNum(rel.negativeCount ?? 0);
      pushNum(rel.favorsCompleted ?? 0);
      pushNum(rel.giftsGiven ?? 0);
      pushStr(rel.lastEmotion ?? '');
    }
    const rt = state.npcRuntime?.[id];
    if (rt) {
      pushNum(Math.round(rt.position.x * 20));
      pushNum(Math.round(rt.position.z * 20));
      pushNum(Math.round(rt.targetPos.x * 20));
      pushNum(Math.round(rt.targetPos.z * 20));
      pushStr(rt.animState);
      pushStr(rt.currentActivityId);
      pushStr(rt.socialPartnerId ?? '');
      pushStr(rt.emotion ?? '');
      pushStr(rt.posture ?? 'standing');
      pushStr(rt.reservedSeatId ?? '');
      pushNum(rt.waypoints.length);
      pushNum(Math.round(rt.activityUntilMinute));
      pushNum(Math.round(rt.socialCooldownUntilMinute));
    }
    const hist = state.npcActivityHistory?.[id];
    if (hist) {
      pushNum(hist.length);
      if (hist.length > 0) {
        pushNum(hist[0].day);
        pushNum(hist[0].minuteOfDay);
        pushStr(hist[0].activityId);
      }
    }
  }

  const npcRelKeys = Object.keys(state.npcRelations ?? {}).sort();
  pushNum(npcRelKeys.length);
  for (let i = 0; i < npcRelKeys.length; i++) {
    const k = npcRelKeys[i];
    const r = state.npcRelations[k];
    pushStr(k);
    pushNum(r.affinity);
    pushNum(r.tension);
    pushNum(r.lastInteractionDay ?? -1);
    pushNum(r.sharedTags.length);
    for (let t = 0; t < r.sharedTags.length; t++) pushStr(r.sharedTags[t]);
  }

  const encs = state.activeEncounters ?? [];
  pushNum(encs.length);
  for (let i = 0; i < encs.length; i++) {
    pushStr(encs[i].id);
    pushNum(Math.round(encs[i].endsMinute));
  }

  const events = state.worldEvents ?? [];
  pushNum(events.length);
  for (let i = 0; i < events.length; i++) {
    pushStr(events[i].id);
  }

  return `${h1.toString(36)}-${h2.toString(36)}`;
}

export function saveWorldState(state: WorldState): { ok: boolean; error?: string } {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ok: false, error: 'localStorage unavailable' };
    }
    window.localStorage.setItem(STORAGE_KEY, serializeWorldState(state));
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
    playerPosture: 'standing',
    playerSeatId: null,
    residents: nextResidents,
    playerRelations: nextPlayerRelations,
    npcRuntime: createInitialNpcRuntime(NEXT_DAY_WAKE_MINUTE, state.flags.claraArthurReconciled),
    activeEncounters: [],
    mailboxUnread: true,
  };
}
