import { NEXT_DAY_WAKE_MINUTE, getSeasonForDay } from './time';
import { rollWeatherForDay } from './environment';
import { PLAYER_DEFAULT_FACING, PLAYER_SPAWN, isPointWalkable } from './worldMap';
import {
  CURRENT_SCHEMA_VERSION,
  MigrationResult,
  createDefaultWorldState,
  migrateWorldState,
  sanitizeWorldState,
} from './migrations';
import {
  cloneNpcMemories,
  pruneExpiredNpcMemoriesInPlace,
} from './memories';
import { createInitialNpcRuntime } from './simulation';
import {
  COTTAGE_WAKE_FACING,
  COTTAGE_WAKE_SPAWN,
  createInitialCottageState,
  createInitialDailyActivities,
} from './cottage';
import {
  GREENHOUSE_PORCH_EXIT_FACING,
  GREENHOUSE_PORCH_EXIT_POS,
  advanceGreenhouseNightlyGrowthInPlace,
  createInitialGreenhouseState,
} from './greenhouse';
import { BAKERY_PORCH_EXIT_FACING, BAKERY_PORCH_EXIT_POS, createInitialBakeryState } from './bakery';
import { NOOK_PORCH_EXIT_FACING, NOOK_PORCH_EXIT_POS, createInitialNookState } from './bookNook';
import {
  COPPERWHEEL_PORCH_EXIT_FACING,
  COPPERWHEEL_PORCH_EXIT_POS,
  createInitialCopperwheelState,
} from './copperwheel';
import { reconcileLivingRelationshipsOnDayAdvance } from './invitations';
import { driftNpcPerceptionsInPlace, reconcileSocialGroupsInPlace, cloneNpcPerceptions } from './perceptions';
import { WorldState } from './types';
import { JOURNAL_READ_STORAGE_KEY } from './journal';

export const STORAGE_KEY = 'little_somewhere_world_v1';
export const STORAGE_BACKUP_KEY = 'little_somewhere_world_v1_backup';

export function createFreshWorldState(): WorldState {
  return createDefaultWorldState();
}

export function serializeWorldState(state: WorldState, warnings?: string[]): string {
  // AR-5 (systemic-reliability doc 09): the save path runs the same sanitizer
  // as the load path, but its repair decisions were constructed and discarded.
  // An explicit sink collects them; without one they surface on console.warn
  // with the same classified prefix as the load path (doc 03 §7).
  const saveWarnings: string[] = [];
  const json = JSON.stringify(sanitizeWorldState(state, saveWarnings));
  if (saveWarnings.length > 0) {
    if (warnings) {
      warnings.push(...saveWarnings);
    } else {
      for (const w of saveWarnings) {
        console.warn(`[little-somewhere save] ${w}`);
      }
    }
  }
  return json;
}

export function deserializeWorldState(rawJson: string): MigrationResult {
  try {
    const parsed: unknown = JSON.parse(rawJson);
    // Overhaul G-2: a save written by a NEWER runtime must never be silently
    // downgraded (the sanitizer used to strip unknown fields and autosave then
    // persisted the stripped v11 over the newer save — permanent data loss).
    // Refuse the load; loadWorldState preserves the raw payload untouched.
    // (Integrated union: the payload field is `schemaVersion` — the overhaul
    // draft read a nonexistent `version` key; refusal is structural here so a
    // future payload never enters the migration machinery at all.)
    const futureVersion =
      typeof parsed === 'object' && parsed !== null &&
      typeof (parsed as { schemaVersion?: unknown }).schemaVersion === 'number'
        ? (parsed as { schemaVersion: number }).schemaVersion
        : null;
    if (futureVersion !== null && futureVersion > CURRENT_SCHEMA_VERSION) {
      return {
        state: createDefaultWorldState(),
        migratedFromVersion: futureVersion,
        warnings: [
          `save version ${futureVersion} is newer than runtime ${CURRENT_SCHEMA_VERSION}; load refused, original save preserved`,
        ],
      };
    }
    return migrateWorldState(parsed);
  } catch {
    return {
      state: createDefaultWorldState(),
      migratedFromVersion: null,
      warnings: [`corrupt JSON payload; created fresh WorldState v${CURRENT_SCHEMA_VERSION}`],
    };
  }
}

/**
 * Overhaul G-2: set when a future-schema save was detected at load time.
 * While flagged, autosave must not write the main key — the raw newer save
 * stays intact under STORAGE_KEY for the newer runtime.
 */
let futureSchemaSaveDetected = false;

export function isFutureSchemaSaveDetected(): boolean {
  return futureSchemaSaveDetected;
}

export function loadWorldState(): WorldState {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createDefaultWorldState();
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultWorldState();
    const res = deserializeWorldState(raw);
    // Surface every load-path decision on the console: repairs, normalizations,
    // drops and rejections are observable without any gameplay UI dependency
    // (systemic-reliability doc 03 §7).
    if (res.warnings.length > 0) {
      for (const w of res.warnings) {
        console.warn(`[little-somewhere save] ${w}`);
      }
    }
    const legacy =
      res.migratedFromVersion !== null && res.migratedFromVersion < CURRENT_SCHEMA_VERSION;
    const future =
      res.migratedFromVersion !== null && res.migratedFromVersion > CURRENT_SCHEMA_VERSION;
    if (future) {
      // Overhaul G-2: a newer runtime's save stays parked untouched; the game
      // runs on a fresh state this session and autosave is blocked (see
      // saveWorldState) so the payload is never downgraded-overwritten.
      futureSchemaSaveDetected = true;
    }
    if (legacy || future || res.warnings.length > 0) {
      try {
        // Tombstone the raw payload BEFORE any rewrite so a repair that later
        // proves wrong is recoverable (systemic-reliability doc 03 §2).
        window.localStorage.setItem(STORAGE_BACKUP_KEY, raw);
        if (!future) {
          // Version upgrades and same-version self-heals re-persist the
          // sanitized state; future-version payloads are never rewritten
          // (the runtime view is degraded, the stored payload stays intact).
          window.localStorage.setItem(STORAGE_KEY, serializeWorldState(res.state));
        }
      } catch {
        // Ignore quota errors on backup/upgrade write
      }
    }
    if (future) {
      // Overhaul G-2: refuse the future payload — fresh runtime view this
      // session; the stored newer-version payload remains intact for its own
      // runtime (tombstoned above for recoverability).
      return createDefaultWorldState();
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

  const storylineKeys = Object.keys(state.storylines ?? {}).sort();
  pushNum(storylineKeys.length);
  for (let i = 0; i < storylineKeys.length; i++) {
    const stKey = storylineKeys[i];
    const st = state.storylines[stKey];
    pushStr(stKey);
    if (st) {
      pushNum(st.stage);
      pushStr(st.status);
      pushStr(st.outcome ?? '');
      pushNum(st.startedDay ?? -1);
      pushNum(st.updatedDay ?? -1);
      pushNum(st.completedDay ?? -1);
      pushNum(st.cooldownUntilDay ?? -1);
      const notes = st.notes ?? [];
      pushNum(notes.length);
      for (let nIdx = 0; nIdx < notes.length; nIdx++) {
        pushStr(notes[nIdx]);
      }
    }
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
    const nmems = state.npcMemories?.[id];
    pushNum(nmems ? nmems.length : 0);
    if (nmems) {
      for (let mIdx = 0; mIdx < nmems.length; mIdx++) {
        const nm = nmems[mIdx];
        pushStr(nm.id);
        pushStr(nm.eventId);
        pushStr(nm.provenance);
        pushNum(nm.confidence);
        pushNum(nm.hopCount);
        pushNum(nm.learnedDay);
        pushBool(nm.mentionedToPlayer);
        pushNum(nm.sharedCount);
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
    pushNum(r.lastGossipDay ?? -1);
    pushNum(Math.round(r.lastGossipMinute ?? -1));
    pushStr(r.lastGossipEventId ?? '');
    pushNum(r.sharedTags.length);
    for (let t = 0; t < r.sharedTags.length; t++) pushStr(r.sharedTags[t]);
    // C3: track familiarity/encounterCount so the fingerprint reflects the
    // actual persisted relation state (HANDOVER §20). Encounter count drives
    // no behavior today but is persisted; familiarity gates the confidant tier.
    pushNum(r.familiarity ?? -1);
    pushNum(r.encounterCount ?? -1);
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

  // Milestone 2C v6 fields
  pushStr(state.playerLocation ?? 'exterior');
  pushNum(Math.round((state.exteriorPlayerPos?.x ?? state.playerPos.x) * 20));
  pushNum(Math.round((state.exteriorPlayerPos?.z ?? state.playerPos.z) * 20));
  pushNum(Math.round((state.exteriorPlayerFacing ?? state.playerFacing) * 20));

  const invKeys = Object.keys(state.inventory ?? {}).sort();
  pushNum(invKeys.length);
  for (let i = 0; i < invKeys.length; i++) {
    const ik = invKeys[i] as keyof WorldState['inventory'];
    pushStr(ik);
    pushNum(state.inventory?.[ik] ?? 0);
  }

  const disc = state.discoveredItemIds ?? [];
  pushNum(disc.length);
  for (let i = 0; i < disc.length; i++) pushStr(disc[i]);

  const cs = state.cottageState;
  if (cs) {
    pushStr(cs.placedFlowerId ?? '');
    pushBool(cs.hearthLit);
    pushNum(Math.round(cs.kettleWarmUntilMinute));
    pushBool(cs.almanacReadToday);
    pushNum(cs.cottageRestCount);
    pushNum(cs.displayedKeepsakeIds.length);
    for (let i = 0; i < cs.displayedKeepsakeIds.length; i++) {
      pushStr(cs.displayedKeepsakeIds[i]);
    }
  }

  const da = state.dailyActivities;
  if (da) {
    pushBool(da.cottagePlanterTendedToday);
    pushBool(da.greenhousePlantersTendedToday);
    pushBool(da.orchardHarvestedToday);
    pushBool(da.pondCombedToday);
    pushNum(da.bakedCountToday);
    pushNum(da.giftedResidentsToday.length);
    for (let i = 0; i < da.giftedResidentsToday.length; i++) {
      pushStr(da.giftedResidentsToday[i]);
    }
  }

  const ng = state.neighborGiftsReceived ?? [];
  pushNum(ng.length);
  for (let i = 0; i < ng.length; i++) pushStr(ng[i]);

  // Milestone 3 Build 6 — Sunbeam Greenhouse shared growing corner (WorldState v7)
  const gh = state.greenhouseState;
  if (gh) {
    pushNum(gh.noteReadDay);
    pushNum(gh.totalHarvests);
    pushNum(gh.totalPlanted);
    pushNum(gh.plots.length);
    for (let i = 0; i < gh.plots.length; i++) {
      const plot = gh.plots[i];
      pushStr(plot.cropId ?? '');
      pushNum(plot.plantedDay);
      pushNum(plot.nightsGrown);
      pushNum(plot.stage);
      pushBool(plot.wateredToday);
      // Everyday Gameplay GA-2 — per-plot care streak participates in the save fingerprint.
      pushNum(plot.waterStreak ?? 0);
    }
  }

  // Milestone 3 Build 7 — Hearth & Crumb Bakery visitable interior (WorldState v8)
  const bk = state.bakeryState;
  if (bk) {
    pushNum(bk.bakeCheckedDay);
    pushNum(bk.kneadedDay);
    pushNum(bk.loafSharedDay);
    pushNum(bk.notesReadDay);
    pushNum(bk.starterNotesDay);
    pushNum(bk.kneadingSessions);
    pushNum(bk.loavesShared);
  }

  // Milestone 3 Build 8 — Linden Book Nook visitable interior (WorldState v9)
  const nk = state.nookState;
  if (nk) {
    pushNum(nk.shelfBrowsedDay);
    pushNum(nk.teaSharedDay);
    pushNum(nk.notesReadDay);
    pushNum(nk.starterTeaDay);
    pushNum(nk.booksRead);
    pushNum(nk.teasShared);
  }

  // Milestone 3 Build 9 — Copperwheel Cottage visitable interior (WorldState v10)
  const cws = state.copperwheelState;
  if (cws) {
    pushNum(cws.benchCheckedDay);
    pushNum(cws.helpedDay);
    pushNum(cws.teaSharedDay);
    pushNum(cws.notesReadDay);
    pushNum(cws.starterTeaDay);
    pushNum(cws.projectsAdmired);
    pushNum(cws.windingSessions);
    pushNum(cws.teasShared);
  }

  // Living Relationships (LR-1 / LR-2 — WorldState v11)
  const invState = state.invitations;
  if (invState) {
    const aInv = invState.active;
    if (aInv) {
      pushStr(aInv.id);
      pushStr(aInv.status);
      pushStr(aInv.hostId);
      pushStr(aInv.activityId);
      pushNum(aInv.offeredDay);
      pushNum(aInv.expiresDay);
      pushNum(aInv.windowStartMinute);
      pushNum(aInv.windowEndMinute);
    } else {
      pushStr('none');
    }
    pushNum(invState.history.length);
    for (let i = 0; i < invState.history.length; i++) {
      const h = invState.history[i];
      pushStr(h.invitationId);
      pushStr(h.outcome);
      pushNum(h.day);
    }
    const offerKeys = Object.keys(invState.lastOfferDayByHost ?? {}).sort();
    pushNum(offerKeys.length);
    for (let i = 0; i < offerKeys.length; i++) {
      const ok = offerKeys[i] as keyof typeof invState.lastOfferDayByHost;
      pushStr(ok);
      pushNum(invState.lastOfferDayByHost[ok] ?? 0);
    }
  }
  const occ = state.occupancy;
  if (occ) {
    pushStr(occ.residentId);
    pushStr(occ.location);
    pushStr(occ.stationId);
    pushStr(occ.invitationId);
  }
  const teachKnown = state.teaching?.known ?? [];
  pushNum(teachKnown.length);
  for (let i = 0; i < teachKnown.length; i++) pushStr(teachKnown[i]);
  if (state.activeActivity) {
    pushStr(state.activeActivity.activityId);
    pushStr(state.activeActivity.invitationId);
  }

  // Everyday Gameplay GA-1 — Community Projects (WorldState v12)
  const cp = state.communityProjects ?? {};
  const cpKeys = Object.keys(cp).sort();
  pushNum(cpKeys.length);
  for (let i = 0; i < cpKeys.length; i++) {
    const proj = cp[cpKeys[i]];
    pushStr(cpKeys[i]);
    pushNum(proj?.completedDay ?? 0);
    const contrib = proj?.contributed ?? {};
    const contribKeys = Object.keys(contrib).sort();
    pushNum(contribKeys.length);
    for (let j = 0; j < contribKeys.length; j++) {
      pushStr(contribKeys[j]);
      pushNum(contrib[contribKeys[j] as keyof typeof contrib] ?? 0);
    }
  }

  // NPC Intelligence Evolution — S4/S6: track directional perception overlay
  // and social groups so the dirty-save fingerprint reflects them.
  const perceptions = state.npcPerceptions ?? {};
  const perceiverKeys = Object.keys(perceptions).sort();
  pushNum(perceiverKeys.length);
  for (let i = 0; i < perceiverKeys.length; i++) {
    const perceiver = perceiverKeys[i];
    const inner = perceptions[perceiver as keyof typeof perceptions] ?? {};
    const targetKeys = Object.keys(inner).sort();
    pushStr(perceiver);
    pushNum(targetKeys.length);
    for (let j = 0; j < targetKeys.length; j++) {
      const p = inner[targetKeys[j] as keyof typeof inner];
      pushStr(targetKeys[j]);
      pushNum(p?.affinityDelta ?? 0);
      pushNum(p?.tensionDelta ?? 0);
      pushNum(p?.lastShiftDay ?? -1);
    }
  }
  const groups = state.npcSocialGroups ?? [];
  pushNum(groups.length);
  for (let i = 0; i < groups.length; i++) {
    pushStr(groups[i].id);
    pushNum(groups[i].members.length);
    for (let j = 0; j < groups[i].members.length; j++) {
      pushStr(groups[i].members[j].residentId);
      pushNum(Math.round(groups[i].members[j].cohesion * 100));
    }
  }

  return `${h1.toString(36)}-${h2.toString(36)}`;
}

export function saveWorldState(state: WorldState): { ok: boolean; error?: string } {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ok: false, error: 'localStorage unavailable' };
    }
    // Overhaul G-2: while a future-schema save is parked under the main key,
    // never overwrite it with downgraded runtime state.
    if (futureSchemaSaveDetected) {
      return { ok: false, error: 'future-schema save preserved; autosave skipped' };
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
  // A deliberate reset clears the future-schema guard — the user is choosing
  // to overwrite whatever is parked under the main key.
  futureSchemaSaveDetected = false;
  const fresh = createDefaultWorldState();
  saveWorldState(fresh);
  // UI/UX program (WP5): the Pocket Journal's read-state cache (owned by
  // journal.ts) is derived UI state keyed to the CURRENT world — resetting the
  // world must restart its "New" markers, or a fresh Day 1 opens pre-read.
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(JOURNAL_READ_STORAGE_KEY);
  }
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

  const nextWorldProps = { ...state.worldProps };
  for (const key of Object.keys(nextWorldProps) as Array<keyof typeof nextWorldProps>) {
    const p = nextWorldProps[key];
    if (p && p.holder !== 'player' && p.holder !== 'world') {
      nextWorldProps[key] = {
        ...p,
        holder: 'world',
        pos: { x: p.homePos.x, z: p.homePos.z },
      };
    }
  }

  const nextDay = state.day + 1;
  const nextNpcMemories = cloneNpcMemories(state.npcMemories);
  pruneExpiredNpcMemoriesInPlace(nextNpcMemories, nextDay);
  const nextSeason = getSeasonForDay(nextDay).season;
  const wokeInsideCottage = state.playerLocation === 'cottage_interior';
  const wokeInsideGreenhouse = state.playerLocation === 'greenhouse_interior';
  const wokeInsideBakery = state.playerLocation === 'bakery_interior';
  const wokeInsideNook = state.playerLocation === 'nook_interior';
  const wokeInsideCopperwheel = state.playerLocation === 'copperwheel_interior';
  const prevCottage = state.cottageState ?? createInitialCottageState();
  const prevGreenhouse = state.greenhouseState ?? createInitialGreenhouseState();
  const prevBakery = state.bakeryState ?? createInitialBakeryState();
  const prevNook = state.nookState ?? createInitialNookState();
  const prevCopperwheel = state.copperwheelState ?? createInitialCopperwheelState();

  // Sunbeam Greenhouse nightly growth (M3 Build 6): watered pots advance one stage-step;
  // unwatered pots simply wait, and winter freezes all growth until spring. Nothing withers.
  const nextGreenhouseState = advanceGreenhouseNightlyGrowthInPlace(
    {
      ...prevGreenhouse,
      plots: prevGreenhouse.plots.map((p) => ({ ...p })),
    },
    nextSeason,
  );

  const greenhouseExitPos =
    state.exteriorPlayerPos ?? GREENHOUSE_PORCH_EXIT_POS;
  const safeGreenhouseExit = isPointWalkable(greenhouseExitPos.x, greenhouseExitPos.z, 0.48)
    ? greenhouseExitPos
    : { ...GREENHOUSE_PORCH_EXIT_POS };

  // M3 Build 7: waking inside the bakery steps the neighbor back out onto the warm porch
  // (the bakery has no bed — the cottage quilt remains the one true rest spot).
  const bakeryExitPos = state.exteriorPlayerPos ?? BAKERY_PORCH_EXIT_POS;
  const safeBakeryExit = isPointWalkable(bakeryExitPos.x, bakeryExitPos.z, 0.48)
    ? bakeryExitPos
    : { ...BAKERY_PORCH_EXIT_POS };

  // M3 Build 8: same for the book nook — waking there lands on the east porch.
  const nookExitPos = state.exteriorPlayerPos ?? NOOK_PORCH_EXIT_POS;
  const safeNookExit = isPointWalkable(nookExitPos.x, nookExitPos.z, 0.48)
    ? nookExitPos
    : { ...NOOK_PORCH_EXIT_POS };

  // M3 Build 9: same for Copperwheel Cottage — waking there lands on the south porch.
  const copperwheelExitPos = state.exteriorPlayerPos ?? COPPERWHEEL_PORCH_EXIT_POS;
  const safeCopperwheelExit = isPointWalkable(copperwheelExitPos.x, copperwheelExitPos.z, 0.48)
    ? copperwheelExitPos
    : { ...COPPERWHEEL_PORCH_EXIT_POS };

  const rolled: WorldState = {
    ...state,
    day: nextDay,
    minuteOfDay: NEXT_DAY_WAKE_MINUTE, // 8:00 AM
    season: nextSeason,
    weather: rollWeatherForDay(state.simSeed, nextDay),
    playerLocation: wokeInsideCottage ? 'cottage_interior' : 'exterior',
    playerPos: wokeInsideCottage
      ? { ...COTTAGE_WAKE_SPAWN }
      : wokeInsideGreenhouse
      ? safeGreenhouseExit
      : wokeInsideBakery
      ? safeBakeryExit
      : wokeInsideNook
      ? safeNookExit
      : wokeInsideCopperwheel
      ? safeCopperwheelExit
      : { ...PLAYER_SPAWN },
    playerFacing: wokeInsideCottage
      ? COTTAGE_WAKE_FACING
      : wokeInsideGreenhouse
      ? GREENHOUSE_PORCH_EXIT_FACING
      : wokeInsideBakery
      ? BAKERY_PORCH_EXIT_FACING
      : wokeInsideNook
      ? NOOK_PORCH_EXIT_FACING
      : wokeInsideCopperwheel
      ? COPPERWHEEL_PORCH_EXIT_FACING
      : PLAYER_DEFAULT_FACING,
    exteriorPlayerPos: wokeInsideGreenhouse
      ? safeGreenhouseExit
      : wokeInsideBakery
      ? safeBakeryExit
      : wokeInsideNook
      ? safeNookExit
      : wokeInsideCopperwheel
      ? safeCopperwheelExit
      : { ...PLAYER_SPAWN },
    exteriorPlayerFacing: wokeInsideGreenhouse
      ? GREENHOUSE_PORCH_EXIT_FACING
      : wokeInsideBakery
      ? BAKERY_PORCH_EXIT_FACING
      : wokeInsideNook
      ? NOOK_PORCH_EXIT_FACING
      : wokeInsideCopperwheel
      ? COPPERWHEEL_PORCH_EXIT_FACING
      : PLAYER_DEFAULT_FACING,
    playerPosture: 'standing',
    // Overhaul G-13: held props are day-scoped — nobody wakes up still
    // carrying yesterday's pail across the location reset.
    playerHeldItem: null,
    playerSeatId: null,
    worldProps: nextWorldProps,
    residents: nextResidents,
    playerRelations: nextPlayerRelations,
    npcMemories: nextNpcMemories,
    npcRuntime: createInitialNpcRuntime(NEXT_DAY_WAKE_MINUTE, state.flags.claraArthurReconciled),
    activeEncounters: [],
    mailboxUnread: true,
    cottageState: {
      ...prevCottage,
      almanacReadToday: false,
      kettleWarmUntilMinute: 0,
      cottageRestCount: prevCottage.cottageRestCount + (wokeInsideCottage ? 1 : 0),
    },
    dailyActivities: createInitialDailyActivities(),
    greenhouseState: nextGreenhouseState,
    bakeryState: prevBakery,
    nookState: prevNook,
    copperwheelState: prevCopperwheel,
    // F1 fix: clone npcPerceptions so driftNpcPerceptionsInPlace does NOT mutate
    // the caller's input state. The bilateral npcRelations and npcMemories are
    // already cloned above; the perception overlay must be too.
    npcPerceptions: cloneNpcPerceptions(state.npcPerceptions),
  };

  const reconciled = reconcileLivingRelationshipsOnDayAdvance(rolled);
  // S5/S6: drift directional perceptions toward neutrality after 7 days of no
  // shift, and re-derive emergent social groups for the new day. Both are
  // idempotent and operate only on the optional overlay/group fields.
  driftNpcPerceptionsInPlace(reconciled, nextDay);
  reconcileSocialGroupsInPlace(reconciled);
  return reconciled;
}
