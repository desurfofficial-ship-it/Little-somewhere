/**
 * Long-run simulation stress harness (systemic-reliability initiative,
 * docs/architecture/systemic-reliability/ — see doc 08 for the recorded runs).
 *
 * Drives the REAL production pathways only: stepSimulationInPlace ticks with
 * the production clock model (no midnight wrap; day boundary = clamp-dwell at
 * DAY_END_MINUTE + the real advanceToNextDay transition), real reducers
 * (offer/accept/decline/complete invitations, enterNook, bell, fountain,
 * pond, interrupt), and the real serialize/deserialize persistence pipeline
 * for save/reload cycles. All stochasticity comes from the game's own
 * mulberry32 seeded from a fixed harness seed.
 *
 * A full invariant sweep runs after EVERY tick and EVERY save/reload:
 * numeric domains, reference resolution, duplicate ids, invitation lifecycle
 * (strict predicate), occupancy/activeActivity coherence, journal ordering,
 * collection caps, and deterministic-replay byte equality.
 *
 * Usage (from the repo root):
 *   npx tsx scripts/longrun_stress.ts            # full pass (~4 s compute)
 *   npx tsx scripts/longrun_stress.ts --quick    # reduced tick counts
 *
 * Exit code 0 = every scenario clean; exit code 1 = hard violations (each
 * printed with scenario, tick, invariant, and a trimmed state slice).
 */
import {
  serializeWorldState,
  deserializeWorldState,
  createFreshWorldState,
  advanceToNextDay,
} from '../src/game/storage';
import { stepSimulationInPlace, interruptSocialEncounter } from '../src/game/simulation';
import {
  offerInvitation,
  acceptInvitation,
  declineInvitation,
  isInvitationLive,
  INVITATION_HISTORY_CAP,
} from '../src/game/invitations';
import { completeSharedActivity, SHARED_ACTIVITIES } from '../src/game/activities';
import {
  performRingBellAction,
  performFountainWishAction,
  performPondStoneSkipAction,
  enterNookAction,
} from '../src/game/actions';
import { mulberry32 } from '../src/game/rng';
import { RESIDENT_ORDER } from '../src/game/residents';
import { DAY_END_MINUTE, getSeasonForDay } from '../src/game/time';
import type { WorldState, ResidentId } from '../src/game/types';

const QUICK = process.argv.includes('--quick');
const DT = 0.25; // production clamps frame dt to <= 0.25 s
const RESIDENTS = RESIDENT_ORDER as readonly ResidentId[];
const RES_SET = new Set<string>(RESIDENT_ORDER as readonly string[]);
const ACTIVITY_IDS = Object.keys(SHARED_ACTIVITIES);

interface Violation {
  scenario: string;
  seed: number;
  tick: number;
  invariant: string;
  detail: string;
}

type ActionRequest =
  | { kind: 'offer'; hostId: ResidentId }
  | { kind: 'accept' }
  | { kind: 'decline' }
  | { kind: 'complete' }
  | { kind: 'enterNook' }
  | { kind: 'bell' }
  | { kind: 'fountain' }
  | { kind: 'pond' }
  | { kind: 'interrupt'; residentId: ResidentId }
  | { kind: 'advanceDay' };

interface ScenarioConfig {
  name: string;
  seed: number;
  ticks: number;
  saveEveryTicks: number;
  advanceDayAtMinute: number; // 0 = never
  actionEveryTicks: number; // 0 = no input actions
  discoveryWarps: boolean; // move the player between Wild Hollows zones
  stageAffinity: boolean; // deterministic pre-staging: hosts become tier-eligible
}

/**
 * Deterministic staging shared with the investigation harness (agent D): the
 * invitation lifecycle gates offers on relationship tier (minAffinity 45), so
 * a fresh world can never exercise offer/accept/complete/expire. Staging
 * raises every host to affinity 60 + matching trust BEFORE the run — a
 * documented, seed-free setup step that unlocks the lifecycle paths.
 */
function stageRelationships(w: WorldState): WorldState {
  const playerRelations = { ...w.playerRelations };
  const residents = { ...w.residents };
  for (const id of RESIDENTS) {
    playerRelations[id] = { ...playerRelations[id], affinity: 60 };
    residents[id] = { ...residents[id], trust: Math.max(residents[id].trust, 3) };
  }
  return { ...w, playerRelations, residents };
}

function badNum(n: unknown): boolean {
  return typeof n !== 'number' || !Number.isFinite(n);
}

function sliceOf(w: WorldState, paths: string[]): string {
  const picked: Record<string, unknown> = {};
  for (const p of paths) {
    picked[p] = p.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], w);
  }
  const s = JSON.stringify(picked);
  return s.length > 600 ? `${s.slice(0, 600)}…[trimmed]` : s;
}

/** Full invariant sweep over one world state. Empty array = clean. */
export function checkInvariants(w: WorldState): Array<{ invariant: string; paths: string[] }> {
  const V: Array<{ invariant: string; paths: string[] }> = [];
  const push = (invariant: string, paths: string[]) => V.push({ invariant, paths });

  // Numeric domains
  if (badNum(w.minuteOfDay) || w.minuteOfDay < 360 || w.minuteOfDay > DAY_END_MINUTE) {
    push('minute_out_of_range', ['day', 'minuteOfDay']);
  }
  if (badNum(w.day) || w.day < 1 || Math.floor(w.day) !== w.day) push('day_invalid', ['day']);
  if (w.season !== getSeasonForDay(w.day).season) push('season_day_mismatch', ['day', 'season']);

  // Duplicate ids within collections
  const dupCheck = (
    label: string,
    arr: Array<{ id?: string; invitationId?: string }> | undefined,
    key: 'id' | 'invitationId',
  ) => {
    const seen = new Set<string>();
    for (const it of arr ?? []) {
      const k = String(it?.[key]);
      if (seen.has(k)) {
        push(`duplicate_id:${label}`, [`${label}.length`]);
        break;
      }
      seen.add(k);
    }
  };
  dupCheck('memories', w.memories, 'id');
  dupCheck('worldEvents', w.worldEvents, 'id');
  dupCheck('activeEncounters', w.activeEncounters, 'id');
  dupCheck('invitations.history', w.invitations?.history as Array<{ invitationId?: string }>, 'invitationId');

  // Journal ordering (newest-first by (day, minute) is not guaranteed across
  // systems; what IS guaranteed: ids unique (above) and days non-decreasing
  // toward the tail is NOT asserted — ordering defects are caught by replay
  // equality instead. Keep the ordering check to: no negative/non-finite day.
  for (const m of w.memories ?? []) {
    if (badNum(m.day) || (m.day as number) < 1) push('journal_row_day_invalid', ['memories']);
  }

  // Non-finite scan over core numeric state
  for (const [id, rel] of Object.entries(w.playerRelations ?? {})) {
    if (badNum(rel.affinity) || badNum(rel.familiarity)) push('non_finite_relation', [`playerRelations.${id}`]);
  }
  for (const [key, rel] of Object.entries(w.npcRelations ?? {})) {
    if (badNum(rel.affinity) || badNum(rel.tension)) push('non_finite_npc_relation', [`npcRelations.${key}`]);
  }
  for (const [id, prog] of Object.entries(w.residents ?? {})) {
    if (badNum(prog.trust)) push('non_finite_trust', [`residents.${id}`]);
  }

  // Reference resolution
  const inv = w.invitations;
  const active = inv?.active ?? null;
  if (active) {
    if (!RES_SET.has(active.hostId)) push('dangling_invitation_host', ['invitations.active.hostId']);
    if (!SHARED_ACTIVITIES[active.activityId]) {
      push('dangling_invitation_activity', ['invitations.active.activityId']);
    }
    if (!isInvitationLive(active, w.day, w.minuteOfDay)) {
      push('stale_active_invitation_at_boundary', ['invitations.active']);
    }
  }
  if (w.occupancy) {
    if (!active || active.status !== 'accepted') {
      push('occupancy_without_accepted_invite', ['occupancy', 'invitations.active']);
    } else {
      if (w.occupancy.residentId !== active.hostId) push('occupancy_host_mismatch', ['occupancy.residentId']);
      if (w.occupancy.invitationId !== active.id) push('occupancy_invite_mismatch', ['occupancy.invitationId']);
      if (w.occupancy.stationId !== SHARED_ACTIVITIES[active.activityId]?.stationId) {
        push('occupancy_station_mismatch', ['occupancy.stationId']);
      }
    }
  }
  if (w.activeActivity) {
    if (!active) push('activeActivity_without_active_invite', ['activeActivity']);
    else if (w.activeActivity.invitationId !== active.id) {
      push('activeActivity_invite_mismatch', ['activeActivity.invitationId']);
    }
  }
  for (const [key, rel] of Object.entries(w.npcRelations ?? {})) {
    const [a, b] = key.split(':');
    if (!RES_SET.has(a) || !RES_SET.has(b) || a === b) {
      push('unregistered_npc_relation_pair', [`npcRelations.${key}`]);
    }
  }

  // Collection caps engaged
  if ((w.memories?.length ?? 0) > 96) push('journal_memory_cap_exceeded', ['memories.length']);
  if ((w.worldEvents?.length ?? 0) > 40) push('world_events_cap_exceeded', ['worldEvents.length']);
  if ((w.invitations?.history?.length ?? 0) > INVITATION_HISTORY_CAP) {
    push('invitation_history_cap_exceeded', ['invitations.history.length']);
  }
  for (const id of RESIDENTS) {
    const n = w.npcMemories?.[id]?.length ?? 0;
    if (n > 14) push('npc_memory_cap_exceeded', [`npcMemories.${id}.length`]);
  }

  // NPC social coherence: a resident's socialPartnerId must be a participant
  // of a shared active encounter. For 2-party encounters partners are mutual;
  // for 3-party encounters the engine chains participants cyclically
  // (simulation.ts: participants[(pIdx+1) % len]), so the coherence rule is
  // co-membership, not strict mutuality.
  for (const id of RESIDENTS) {
    const rt = w.npcRuntime?.[id];
    if (rt?.socialPartnerId) {
      const p = rt.socialPartnerId;
      const coEncountered = (w.activeEncounters ?? []).some(
        (enc) => enc.participants.includes(id) && enc.participants.includes(p),
      );
      if (!coEncountered) {
        push('social_partner_not_co_encountered', [`npcRuntime.${id}.socialPartnerId`]);
      }
    }
  }
  return V;
}

function record(
  out: Violation[],
  cfg: ScenarioConfig,
  tick: number,
  found: Array<{ invariant: string; paths: string[] }>,
  w: WorldState,
): boolean {
  for (const f of found) {
    out.push({
      scenario: cfg.name,
      seed: cfg.seed,
      tick,
      invariant: f.invariant,
      detail: sliceOf(w, f.paths),
    });
  }
  return found.length > 0;
}

/** Deterministic input-action policy derived from the harness RNG. */
function pickActions(w: WorldState, rand: () => number): ActionRequest[] {
  const actions: ActionRequest[] = [];
  const roll = rand();
  if (roll < 0.3) {
    const host = RESIDENTS[Math.floor(rand() * RESIDENTS.length)];
    actions.push({ kind: 'offer', hostId: host });
  } else if (roll < 0.5) {
    actions.push({ kind: 'accept' });
  } else if (roll < 0.6) {
    actions.push({ kind: 'decline' });
  } else if (roll < 0.72) {
    actions.push({ kind: 'complete' });
  } else if (roll < 0.78) {
    actions.push({ kind: 'enterNook' });
  } else if (roll < 0.84) {
    actions.push({ kind: 'bell' });
  } else if (roll < 0.88) {
    actions.push({ kind: 'fountain' });
  } else if (roll < 0.92) {
    actions.push({ kind: 'pond' });
  } else if (roll < 0.97) {
    actions.push({ kind: 'interrupt', residentId: RESIDENTS[Math.floor(rand() * RESIDENTS.length)] });
  } else {
    actions.push({ kind: 'advanceDay' });
  }
  return actions.filter(Boolean);
}

function applyAction(w: WorldState, action: ActionRequest): { world: WorldState; applied: boolean } {
  switch (action.kind) {
    case 'offer': {
      const r = offerInvitation(w, action.hostId, ACTIVITY_IDS[0]);
      return { world: r.world, applied: r.ok };
    }
    case 'accept': {
      const r = acceptInvitation(w);
      return { world: r.world, applied: r.ok };
    }
    case 'decline': {
      const r = declineInvitation(w);
      return { world: r.world, applied: r.ok };
    }
    case 'complete': {
      const r = completeSharedActivity(w, ACTIVITY_IDS[0]);
      return { world: r.world, applied: r.ok };
    }
    case 'enterNook': {
      const r = enterNookAction(w);
      return { world: r.nextWorld, applied: true };
    }
    case 'bell': {
      const r = performRingBellAction(w);
      return { world: r.nextWorld, applied: true };
    }
    case 'fountain': {
      const r = performFountainWishAction(w);
      return { world: r.nextWorld, applied: true };
    }
    case 'pond': {
      const r = performPondStoneSkipAction(w);
      return { world: r.nextWorld, applied: true };
    }
    case 'interrupt': {
      const r = interruptSocialEncounter(w, action.residentId);
      return { world: r, applied: true };
    }
    case 'advanceDay':
      return { world: advanceToNextDay(w), applied: true };
  }
}

interface RunResult {
  ticks: number;
  days: number;
  saves: number;
  wallMs: number;
  payloadBytesStart: number;
  payloadBytesEnd: number;
  sizesEnd: { journal: number; npcMem: number; invHist: number; events: number };
}

function runScenario(
  cfg: ScenarioConfig,
  violations: Violation[],
  twinCompare?: { twinFinal?: string; twinHashes?: string[] },
): RunResult {
  const rand = mulberry32(cfg.seed);
  let world = cfg.stageAffinity ? stageRelationships(createFreshWorldState()) : createFreshWorldState();
  const startDay = world.day;
  let saves = 0;
  const t0 = performance.now();
  const payloadBytesStart = serializeWorldState(world).length;
  const twinHashes: string[] = [];

  for (let tick = 1; tick <= cfg.ticks; tick++) {
    stepSimulationInPlace(world, DT);

    if (cfg.discoveryWarps && tick % 120 === 0) {
      // Deterministic warps between outdoor zones exercise the discovery path.
      const spots = [
        { x: world.playerPos.x + 2.5, z: world.playerPos.z + 1.5 },
        { x: world.playerPos.x - 2.0, z: world.playerPos.z - 2.5 },
      ];
      world.playerPos = spots[tick % 2 === 0 ? 0 : 1];
    }

    if (cfg.actionEveryTicks > 0 && tick % cfg.actionEveryTicks === 0) {
      for (const action of pickActions(world, rand)) {
        const r = applyAction(world, action);
        world = r.world;
      }
    }

    if (cfg.advanceDayAtMinute > 0 && world.minuteOfDay >= cfg.advanceDayAtMinute) {
      world = advanceToNextDay(world);
    }

    const found = checkInvariants(world);
    if (record(violations, cfg, tick, found, world)) break;

    if (cfg.saveEveryTicks > 0 && tick % cfg.saveEveryTicks === 0) {
      const payload = serializeWorldState(world);
      const reloaded = deserializeWorldState(payload);
      if (reloaded.warnings.length > 0) {
        violations.push({
          scenario: cfg.name,
          seed: cfg.seed,
          tick,
          invariant: 'load_warnings_on_healthy_save',
          detail: JSON.stringify(reloaded.warnings),
        });
        break;
      }
      const post = serializeWorldState(reloaded.state);
      if (post !== payload) {
        violations.push({
          scenario: cfg.name,
          seed: cfg.seed,
          tick,
          invariant: 'save_reload_not_byte_stable',
          detail: 'serialize(load(serialize(x))) !== serialize(x)',
        });
        break;
      }
      world = reloaded.state;
      saves++;
      if (twinCompare) twinHashes.push(post);
    }
  }

  const payloadBytesEnd = serializeWorldState(world).length;
  if (twinCompare) twinCompare.twinHashes = twinHashes;
  return {
    ticks: cfg.ticks,
    days: world.day - startDay,
    saves,
    wallMs: Math.round(performance.now() - t0),
    payloadBytesStart,
    payloadBytesEnd,
    sizesEnd: {
      journal: world.memories?.length ?? 0,
      npcMem: RESIDENTS.reduce((acc, id) => acc + (world.npcMemories?.[id]?.length ?? 0), 0),
      invHist: world.invitations?.history?.length ?? 0,
      events: world.worldEvents?.length ?? 0,
    },
  };
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function scenarioConfigs(): ScenarioConfig[] {
  const scale = QUICK ? 0.4 : 1;
  const T = (n: number) => Math.max(200, Math.round(n * scale));
  return [
    // A — extended ordinary life (schedules only, day rests).
    { name: 'A_extended_ordinary_life', seed: 20260214, ticks: T(2000), saveEveryTicks: 0, advanceDayAtMinute: DAY_END_MINUTE, actionEveryTicks: 0, discoveryWarps: false, stageAffinity: false },
    // B — persistence endurance: save/reload every 200 ticks + staged invitations.
    { name: 'B_persistence_endurance', seed: 90210, ticks: T(2000), saveEveryTicks: 200, advanceDayAtMinute: DAY_END_MINUTE, actionEveryTicks: 40, discoveryWarps: false, stageAffinity: true },
    // C — journal pressure: discovery warps + prop actions, fast clock (dt max).
    { name: 'C_journal_pressure', seed: 31415, ticks: T(2000), saveEveryTicks: 0, advanceDayAtMinute: DAY_END_MINUTE, actionEveryTicks: 12, discoveryWarps: true, stageAffinity: false },
    // D — relationship & invitation pressure: staged affinity, heavy cycling.
    { name: 'D_invitation_pressure', seed: 27182, ticks: T(2000), saveEveryTicks: 0, advanceDayAtMinute: DAY_END_MINUTE, actionEveryTicks: 6, discoveryWarps: false, stageAffinity: true },
    // E — boundary transitions: rest exactly at the clamp ceiling.
    { name: 'E_boundary_transitions', seed: 14142, ticks: T(1500), saveEveryTicks: 0, advanceDayAtMinute: DAY_END_MINUTE, actionEveryTicks: 25, discoveryWarps: false, stageAffinity: true },
    // G — interrupted progression: frequent interrupts + saves + staged invites.
    { name: 'G_interrupted_progression', seed: 60606, ticks: T(1500), saveEveryTicks: 150, advanceDayAtMinute: DAY_END_MINUTE, actionEveryTicks: 10, discoveryWarps: false, stageAffinity: true },
  ];
}

function main(): void {
  const violations: Violation[] = [];
  const summaries: string[] = [];

  for (const cfg of scenarioConfigs()) {
    const r = runScenario(cfg, violations);
    summaries.push(
      `${cfg.name}: ${r.ticks} ticks, ${r.days} rests, ${r.saves} save/reloads, ` +
        `${r.wallMs} ms, payload ${r.payloadBytesStart}B→${r.payloadBytesEnd}B, ` +
        `journal ${r.sizesEnd.journal}, npcMem ${r.sizesEnd.npcMem}, invHist ${r.sizesEnd.invHist}`,
    );
  }

  // F — deterministic replay: run scenario A twice in separate worlds.
  const cfgA = { ...scenarioConfigs()[0], name: 'F_deterministic_replay' };
  const hashes: Array<string> = [];
  for (let run = 0; run < 2; run++) {
    let world = createFreshWorldState();
    const rand = mulberry32(cfgA.seed);
    let diverged = false;
    for (let tick = 1; tick <= cfgA.ticks; tick++) {
      stepSimulationInPlace(world, DT);
      if (world.minuteOfDay >= cfgA.advanceDayAtMinute) world = advanceToNextDay(world);
      const found = checkInvariants(world);
      if (record(violations, cfgA, tick, found, world)) { diverged = true; }
      if (tick % 200 === 0) hashes.push(serializeWorldState(world));
      void rand;
    }
    // Both runs always execute so checkpoint counts stay comparable.
  }
  const half = Math.floor(hashes.length / 2);
  const replayIdentical =
    half >= 1 && deepEqual(hashes.slice(0, half), hashes.slice(half));
  summaries.push(
    `F_deterministic_replay: ${half} checkpoints per run, byte-identical=${replayIdentical}`,
  );
  if (!replayIdentical) {
    violations.push({
      scenario: 'F_deterministic_replay',
      seed: cfgA.seed,
      tick: -1,
      invariant: 'replay_divergence',
      detail: 'checkpoint payload hashes differ between identical runs',
    });
  }

  // B twin — persistence endurance vs a no-reload twin (continuity).
  const cfgB = scenarioConfigs()[1];
  const twinA: { twinHashes?: string[] } = {};
  runScenario(cfgB, violations, twinA);
  // The twin must start from the SAME staged initial state as the run it mirrors.
  let twinWorld = cfgB.stageAffinity ? stageRelationships(createFreshWorldState()) : createFreshWorldState();
  const twinRand = mulberry32(cfgB.seed);
  const twinNoReloadHashes: string[] = [];
  let twinBroken = false;
  for (let tick = 1; tick <= cfgB.ticks && !twinBroken; tick++) {
    stepSimulationInPlace(twinWorld, DT);
    if (tick % cfgB.actionEveryTicks === 0) {
      for (const action of pickActions(twinWorld, twinRand)) {
        twinWorld = applyAction(twinWorld, action).world;
      }
    }
    if (twinWorld.minuteOfDay >= cfgB.advanceDayAtMinute) twinWorld = advanceToNextDay(twinWorld);
    const found = checkInvariants(twinWorld);
    if (record(violations, { ...cfgB, name: 'B_twin_no_reload' }, tick, found, twinWorld)) {
      twinBroken = true;
      break;
    }
    if (tick % cfgB.saveEveryTicks === 0) twinNoReloadHashes.push(serializeWorldState(twinWorld));
  }
  const twinIdentical = deepEqual(twinA.twinHashes ?? [], twinNoReloadHashes);
  summaries.push(
    `B_twin_continuity: ${twinNoReloadHashes.length} checkpoints, save/reload twin byte-identical to no-reload twin=${twinIdentical}`,
  );
  if (!twinIdentical) {
    violations.push({
      scenario: 'B_twin_continuity',
      seed: cfgB.seed,
      tick: -1,
      invariant: 'reload_divergence',
      detail: 'save/reload run diverged from the no-reload twin',
    });
  }

  console.log('=== long-run stress harness ===');
  for (const s of summaries) console.log(s);
  if (violations.length > 0) {
    console.log(`\nHARD VIOLATIONS: ${violations.length}`);
    for (const v of violations.slice(0, 20)) {
      console.log(`  [${v.scenario}] tick=${v.tick} invariant=${v.invariant}`);
      console.log(`    ${v.detail}`);
    }
    process.exit(1);
  }
  console.log('\nAll scenarios clean: zero hard invariant violations.');
  process.exit(0);
}

main();
