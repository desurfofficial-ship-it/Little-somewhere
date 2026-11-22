/**
 * Everyday Gameplay GA-1 — Community Projects (WorldState v12).
 *
 * Registry-first contribution shelves for shared town endeavors, mirroring the
 * `SHARED_ACTIVITIES` pattern: adding a project = adding a def; the noticeboard,
 * panel, journal, and practice profile pick it up automatically.
 *
 * Design constitution (GAME_DESIGN §12.2): contributions come from the pocket
 * inventory, participation is always optional, there are **no deadlines and no
 * expiry** (zero-FOMO), and completion leaves a reward that remains permanently
 * visible in town via `sideFlags[worldFlag]` — the same Bell precedent the World
 * team's environmental implementation already consumes.
 *
 * Interaction contract:
 * - This module NEVER writes `invitations` / `occupancy` / `activeActivity`
 *   (single-writer law). It is a sibling system, not a shared-activity host.
 * - Player-legible refusal reasons are machine strings rendered through
 *   `COMMUNITY_REASON_LABELS` (added alongside the transactional reducer).
 * - Spec of record: docs/architecture/everyday-gameplay/00-improvement-plan.md §GA-1.
 */

import {
  CommunityProjectProgress,
  CommunityProjectsState,
  PersonalItemId,
  ResidentId,
  WorldState,
} from './types';
import {
  PERSONAL_ITEM_MAP,
  VALID_PERSONAL_ITEM_IDS,
  consumeItemFromInventory,
  getItemCount,
} from './inventory';
import {
  LOCAL_WITNESS_RADIUS,
  cloneNpcMemories,
  collectWitnessesForPosition,
  createNpcMemoryEntry,
  recordNpcMemoryInPlace,
} from './memories';
import { pushWorldEventInPlace } from './relationships';
import { getTimePhase } from './residents';
import { applySharedActivityAffinity } from './activities';

export interface CommunityProjectContributionDef {
  itemId: PersonalItemId;
  goal: number;
}

export interface CommunityProjectDef {
  id: string;
  title: string;
  blurb: string;
  /** Display-only venue label; the World team owns the actual scene placement. */
  venueLabel: string;
  /** Any-of contribution goals — each item carries its own needed count. */
  accepts: readonly CommunityProjectContributionDef[];
  /** Neighbors who pitch in their thanks when the project is completed. */
  thanksFrom: readonly ResidentId[];
  memoryId: string;
  memoryTitle: string;
  memorySummary: string;
  /** `sideFlags` key set on completion (World team consumes for the visible town reward). */
  worldFlag: string;
}

/** Hard cap for any single contributed total — well above every authored goal. */
export const MAX_CONTRIBUTED_PER_ITEM = 40;

export const COMMUNITY_PROJECTS: readonly CommunityProjectDef[] = [
  {
    id: 'marigold_garland',
    title: 'Marigold Garland for the Plaza',
    blurb:
      'A long garland of wild blooms to string between the plaza lamps before the next golden evening. Every blossom from the meadows and window boxes helps.',
    venueLabel: 'Village Plaza',
    accepts: [
      { itemId: 'meadow_posy', goal: 3 },
      { itemId: 'chamomile_blossom', goal: 3 },
      { itemId: 'lavender_sprig', goal: 2 },
    ],
    thanksFrom: ['pip', 'clara'],
    memoryId: 'mem_community_marigold_garland',
    memoryTitle: 'A Garland Across the Plaza',
    memorySummary:
      'Neighbors gathered at the noticeboard basket while I tucked wild blooms into the plaza garland — by golden hour it hung glowing between the lamps.',
    worldFlag: 'communityGarlandComplete',
  },
  {
    id: 'orchard_lanterns',
    title: 'Orchard Lantern Preparations',
    blurb:
      'Fern Hollow’s tasting table needs lantern oil of the sweetest kind: crabapples and honeycomb set aside for the glowing jars before the next gathering.',
    venueLabel: 'Fern Hollow Orchard',
    accepts: [
      { itemId: 'crabapple', goal: 4 },
      { itemId: 'wild_honey', goal: 2 },
    ],
    thanksFrom: ['rowan', 'jun'],
    memoryId: 'mem_community_orchard_lanterns',
    memoryTitle: 'Lanterns Waiting in the Orchard',
    memorySummary:
      'I set crabapples and honeycomb aside in the orchard contribution basket — the tasting-table lanterns will glow warm thanks to a whole neighborhood’s pockets.',
    worldFlag: 'communityOrchardLanternsComplete',
  },
  {
    id: 'pond_mosaic',
    title: 'Mirror Pond Mosaic',
    blurb:
      'Toby is pressing river glass, feathers, and ferns into the pond steps, one small treasure at a time. Field finds from the driftwood nook are perfect.',
    venueLabel: 'Mirror Pond',
    accepts: [
      { itemId: 'smooth_river_glass', goal: 2 },
      { itemId: 'pressed_fern', goal: 2 },
      { itemId: 'heron_feather', goal: 1 },
      { itemId: 'cedar_shaving_rose', goal: 1 },
    ],
    thanksFrom: ['toby', 'sora'],
    memoryId: 'mem_community_pond_mosaic',
    memoryTitle: 'The Mosaic on the Pond Steps',
    memorySummary:
      'Field finds from my wanderings are now pressed into the Mirror Pond steps for good — a mosaic of river glass and ferns that catches the light at dusk.',
    worldFlag: 'communityPondMosaicComplete',
  },
];

const COMMUNITY_PROJECT_MAP: Record<string, CommunityProjectDef> = COMMUNITY_PROJECTS.reduce(
  (acc, def) => {
    acc[def.id] = def;
    return acc;
  },
  {} as Record<string, CommunityProjectDef>,
);

export function getCommunityProjectDef(projectId: string): CommunityProjectDef | null {
  return COMMUNITY_PROJECT_MAP[projectId] ?? null;
}

export function createInitialCommunityProjectsState(): CommunityProjectsState {
  return {};
}

/** Progress for a project that has never seen a contribution (fresh shelf). */
export function createEmptyProjectProgress(): CommunityProjectProgress {
  return { contributed: {}, completedDay: 0 };
}

export function getCommunityProjectProgress(
  world: { communityProjects?: CommunityProjectsState },
  projectId: string,
): CommunityProjectProgress {
  const raw = world.communityProjects?.[projectId];
  if (!raw || typeof raw !== 'object') {
    return createEmptyProjectProgress();
  }
  return {
    contributed: { ...(raw.contributed ?? {}) },
    completedDay: typeof raw.completedDay === 'number' && Number.isFinite(raw.completedDay)
      ? Math.max(0, Math.floor(raw.completedDay))
      : 0,
  };
}

export function isCommunityProjectComplete(
  world: { communityProjects?: CommunityProjectsState },
  projectId: string,
): boolean {
  return getCommunityProjectProgress(world, projectId).completedDay > 0;
}

/**
 * Save-integrity sanitizer (same contract as every other slice): accept only
 * known projects, only accepted item ids, honest integer counts. Never throws.
 */
export function sanitizeCommunityProjectsState(
  raw: unknown,
  warnings: string[],
): CommunityProjectsState {
  const safe: CommunityProjectsState = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    if (raw !== undefined && raw !== null) {
      warnings.push('communityProjects reset — malformed shelf data');
    }
    return safe;
  }
  for (const [projectId, rawProgress] of Object.entries(raw as Record<string, unknown>)) {
    const def = COMMUNITY_PROJECT_MAP[projectId];
    if (!def) {
      warnings.push(`communityProjects dropped unknown project id: ${projectId}`);
      continue;
    }
    if (!rawProgress || typeof rawProgress !== 'object' || Array.isArray(rawProgress)) {
      warnings.push(`communityProjects repaired malformed progress for ${projectId}`);
      safe[projectId] = createEmptyProjectProgress();
      continue;
    }
    const candidate = rawProgress as Partial<CommunityProjectProgress>;
    const acceptedIds = new Set(def.accepts.map((a) => a.itemId));
    const contributed: Partial<Record<PersonalItemId, number>> = {};
    const rawContributed = candidate.contributed;
    if (rawContributed && typeof rawContributed === 'object' && !Array.isArray(rawContributed)) {
      for (const [itemId, count] of Object.entries(rawContributed as Record<string, unknown>)) {
        if (!acceptedIds.has(itemId as PersonalItemId)) {
          warnings.push(`communityProjects dropped non-accepted item ${itemId} from ${projectId}`);
          continue;
        }
        const safeCount =
          typeof count === 'number' && Number.isFinite(count) && count > 0
            ? Math.min(MAX_CONTRIBUTED_PER_ITEM, Math.floor(count))
            : 0;
        if (safeCount > 0) {
          contributed[itemId as PersonalItemId] = safeCount;
        }
      }
    } else if (rawContributed !== undefined && rawContributed !== null) {
      warnings.push(`communityProjects repaired contributed map for ${projectId}`);
    }
    const completedDay =
      typeof candidate.completedDay === 'number' && Number.isFinite(candidate.completedDay)
        ? Math.max(0, Math.floor(candidate.completedDay))
        : 0;
    safe[projectId] = { contributed, completedDay };
  }
  return safe;
}

// ---------------------------------------------------------------------------
// View models (pure derivation — UI and noticeboard consume, never persist)
// ---------------------------------------------------------------------------

export interface CommunityProjectItemView {
  itemId: PersonalItemId;
  label: string;
  contributed: number;
  goal: number;
  met: boolean;
}

export interface CommunityProjectView {
  id: string;
  title: string;
  blurb: string;
  venueLabel: string;
  items: CommunityProjectItemView[];
  totalContributed: number;
  totalGoal: number;
  completed: boolean;
  completedDay: number;
}

export function getCommunityProjectView(
  world: { communityProjects?: CommunityProjectsState; day?: number },
  projectId: string,
): CommunityProjectView | null {
  const def = getCommunityProjectDef(projectId);
  if (!def) return null;
  const progress = getCommunityProjectProgress(world, projectId);
  const items: CommunityProjectItemView[] = def.accepts.map((a) => {
    const contributed = Math.min(a.goal, progress.contributed[a.itemId] ?? 0);
    return {
      itemId: a.itemId,
      label: PERSONAL_ITEM_MAP[a.itemId]?.label ?? a.itemId,
      contributed,
      goal: a.goal,
      met: contributed >= a.goal,
    };
  });
  const totalGoal = def.accepts.reduce((sum, a) => sum + a.goal, 0);
  const totalContributed = items.reduce((sum, item) => sum + item.contributed, 0);
  return {
    id: def.id,
    title: def.title,
    blurb: def.blurb,
    venueLabel: def.venueLabel,
    items,
    totalContributed,
    totalGoal,
    completed: progress.completedDay > 0,
    completedDay: progress.completedDay,
  };
}

export function getCommunityProjectsView(
  world: { communityProjects?: CommunityProjectsState; day?: number },
): CommunityProjectView[] {
  return COMMUNITY_PROJECTS.map((def) => getCommunityProjectView(world, def.id)).filter(
    (v): v is CommunityProjectView => v !== null,
  );
}

/** True when every authored goal is satisfied (pre-completion state). */
export function areCommunityGoalsMet(
  world: { communityProjects?: CommunityProjectsState },
  projectId: string,
): boolean {
  const def = getCommunityProjectDef(projectId);
  if (!def) return false;
  const progress = getCommunityProjectProgress(world, projectId);
  return def.accepts.every((a) => (progress.contributed[a.itemId] ?? 0) >= a.goal);
}

/** Noticeboard bullet lines for live community shelves (plaza_noticeboard prose). */
export function describeCommunityNoticeboard(
  world: { communityProjects?: CommunityProjectsState },
): string[] {
  const lines: string[] = [];
  for (const def of COMMUNITY_PROJECTS) {
    const progress = getCommunityProjectProgress(world, def.id);
    if (progress.completedDay > 0) {
      lines.push(`• Community Shelf: ${def.title} — finished, and beautiful!`);
      continue;
    }
    const view = getCommunityProjectView(world, def.id);
    if (!view) continue;
    const missing = view.totalGoal - view.totalContributed;
    lines.push(
      `• Community Shelf: ${def.title} (${def.venueLabel}) — ${view.totalContributed} of ${view.totalGoal} gathered, ${missing} to go. Leave finds in the basket!`,
    );
  }
  return lines;
}

/** Total contributions across all projects (consumed by the everyday practice profile). */
export function countCommunityContributions(
  world: { communityProjects?: CommunityProjectsState },
): number {
  const state = world.communityProjects ?? {};
  let total = 0;
  for (const projectId of Object.keys(state)) {
    if (!COMMUNITY_PROJECT_MAP[projectId]) continue;
    const contributed = state[projectId]?.contributed ?? {};
    for (const itemId of Object.keys(contributed) as PersonalItemId[]) {
      const def = COMMUNITY_PROJECT_MAP[projectId];
      if (!def) continue;
      const accepted = def.accepts.find((a) => a.itemId === itemId);
      if (!accepted) continue;
      total += Math.min(accepted.goal, contributed[itemId] ?? 0);
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// GA-1 (Workstream E) — transactional contribution reducer.
//
// Mirrors `completeSharedActivity` discipline (activities.ts): guarded refusal
// reasons that return the input world reference UNCHANGED (identity-equality),
// exactly one inventory consumption through the central API, witness + gratitude
// NPC memories via the shared memory writers, an idempotent completion burst,
// and zero writes onto `invitations` / `occupancy` / `activeActivity`
// (single-writer law — this module is a sibling system, not a shared-activity host).
// ---------------------------------------------------------------------------

export type CommunityContributionReason =
  | 'unknown_project'
  | 'invalid_amount'
  | 'unknown_item'
  | 'item_not_accepted'
  | 'project_completed'
  | 'goal_already_met'
  | 'nothing_to_contribute';

/** Player-legible refusal prose — the App renders these; reducers never toast on refusals. */
export const COMMUNITY_REASON_LABELS: Record<CommunityContributionReason, string> = {
  unknown_project: 'That community shelf is not on the noticeboard.',
  invalid_amount: 'That is not something the basket can hold.',
  unknown_item: 'That item does not belong on this shelf.',
  item_not_accepted: 'This project is collecting something else right now.',
  project_completed: 'This community project is already finished — come admire it instead!',
  goal_already_met: 'The neighborhood has gathered all it needs of that already.',
  nothing_to_contribute: 'You do not have that in your satchel just yet.',
};

export interface ContributeToCommunityProjectResult {
  ok: boolean;
  world: WorldState;
  reason?: CommunityContributionReason;
  toast?: string;
  memoryUnlockedTitle?: string;
  completedNow?: boolean;
}

/**
 * Single transactional owner for contributing pocket items to a community shelf
 * (GA-1; spec of record docs/architecture/everyday-gameplay/00-improvement-plan.md §GA-1).
 *
 * Guards fire in contract order, each returning `{ ok:false, world, reason }`
 * with the world reference untouched and NO toast (the App renders the machine
 * reason through `COMMUNITY_REASON_LABELS`). On success the contribution is
 * clamped to the remaining goal, consumed via `consumeItemFromInventory`, and
 * neighbors within `LOCAL_WITNESS_RADIUS` record a firsthand NPC memory under
 * the `shared_community` tag (SF-4's dialogueContext picks `shared_`-prefixed
 * tags up for the +5 conversation echo with zero engine changes). The
 * transaction that meets the final authored goal simultaneously fires the
 * completion burst: journal memory (idempotent on `def.memoryId`), one
 * `player_help` world event, thanks-from NPC memories, gratitude affinity via
 * `applySharedActivityAffinity` (+4/+1, cap-exempt shared-activity discipline),
 * and the permanent `sideFlags[def.worldFlag]` the World team consumes for the
 * visible town reward — so a goals-met-but-still-open state can never arise
 * silently from this reducer.
 */
export function contributeToCommunityProject(
  world: WorldState,
  projectId: string,
  itemId: PersonalItemId,
  amount = 1,
): ContributeToCommunityProjectResult {
  const def = getCommunityProjectDef(projectId);
  if (!def) {
    return { ok: false, world, reason: 'unknown_project' };
  }
  if (!Number.isFinite(amount) || amount < 1) {
    return { ok: false, world, reason: 'invalid_amount' };
  }
  if (!VALID_PERSONAL_ITEM_IDS.has(itemId)) {
    return { ok: false, world, reason: 'unknown_item' };
  }
  const goalDef = def.accepts.find((a) => a.itemId === itemId);
  if (!goalDef) {
    return { ok: false, world, reason: 'item_not_accepted' };
  }
  const progress = getCommunityProjectProgress(world, projectId);
  if (progress.completedDay > 0) {
    return { ok: false, world, reason: 'project_completed' };
  }
  const prevContributed = progress.contributed[itemId] ?? 0;
  if (prevContributed >= goalDef.goal) {
    return { ok: false, world, reason: 'goal_already_met' };
  }
  const available = getItemCount(world.inventory, itemId);
  if (available < 1) {
    return { ok: false, world, reason: 'nothing_to_contribute' };
  }

  // Baskets hold whole items: floor fractional requests so the recorded total
  // always matches what actually left the satchel (consumeItemFromInventory
  // floors too). Integer requests behave exactly as authored.
  const requestedAmount = Math.max(1, Math.floor(amount));
  const actualAmount = Math.min(requestedAmount, available, goalDef.goal - prevContributed);

  const consumed = consumeItemFromInventory(world.inventory, itemId, actualAmount);
  if (!consumed.ok) {
    return { ok: false, world, reason: 'nothing_to_contribute' };
  }

  const contributedNow = Math.min(goalDef.goal, prevContributed + actualAmount);
  const nextContributed: Partial<Record<PersonalItemId, number>> = {
    ...progress.contributed,
    [itemId]: contributedNow,
  };
  const completedNow = def.accepts.every(
    (a) => (nextContributed[a.itemId] ?? 0) >= a.goal,
  );

  const roundedMinute = Math.round(world.minuteOfDay);
  const phase = getTimePhase(world.minuteOfDay);
  const witnessEventId = `community_${projectId}_d${world.day}_m${roundedMinute}`;
  const completionEventId = `community_${projectId}_complete_d${world.day}`;
  // `projectId` rides in the memory detail for dialogue/telemetry consumers;
  // built as a record (not an inline literal into the typed param) so the extra
  // key survives createNpcMemoryEntry's detail spread without fighting the
  // closed NpcMemoryDetail shape.
  const communityDetail = { placeName: def.venueLabel, projectId: def.id };

  // Living-world interconnection: neighbors within LOCAL_WITNESS_RADIUS hold a
  // firsthand witness memory of the contribution moment.
  const witnesses = collectWitnessesForPosition(world, world.playerPos, LOCAL_WITNESS_RADIUS);
  const nextNpcMemories = cloneNpcMemories(world.npcMemories);
  for (const witnessId of witnesses) {
    recordNpcMemoryInPlace(
      nextNpcMemories,
      witnessId,
      createNpcMemoryEntry({
        id: witnessEventId,
        eventId: witnessEventId,
        tag: 'shared_community',
        category: 'event',
        subjectPlayer: true,
        subjectResidents: [witnessId],
        provenance: 'firsthand',
        sourceKind: 'witness',
        createdDay: world.day,
        createdMinute: roundedMinute,
        importance: 3,
        retention: 'durable',
        valence: 'warm',
        emotionalWeight: 66,
        detail: communityDetail,
      }),
      world.day,
    );
  }

  // Journal memory is idempotent on def.memoryId (pre-seeded saves never duplicate).
  let nextMemories = world.memories;
  let memoryUnlockedTitle: string | undefined;
  if (completedNow && !world.memories.some((m) => m.id === def.memoryId)) {
    nextMemories = [
      {
        id: def.memoryId,
        day: world.day,
        phase,
        title: def.memoryTitle,
        summary: def.memorySummary,
      },
      ...world.memories,
    ];
    memoryUnlockedTitle = def.memoryTitle;
  }

  const nextEvents = completedNow ? [...(world.worldEvents ?? [])] : world.worldEvents;
  if (completedNow) {
    pushWorldEventInPlace(nextEvents, {
      id: completionEventId,
      day: world.day,
      phase,
      minuteOfDay: roundedMinute,
      kind: 'player_help',
      actors: Array.from(new Set<ResidentId>([...witnesses, ...def.thanksFrom])),
      summary: `The neighborhood finished the ${def.title} together.`,
      summaryTag: `community_${projectId}_complete`,
    });
    for (const rid of def.thanksFrom) {
      recordNpcMemoryInPlace(
        nextNpcMemories,
        rid,
        createNpcMemoryEntry({
          id: completionEventId,
          eventId: completionEventId,
          tag: 'shared_community',
          category: 'event',
          subjectPlayer: true,
          subjectResidents: [rid],
          provenance: 'firsthand',
          sourceKind: 'participant',
          createdDay: world.day,
          createdMinute: roundedMinute,
          importance: 4,
          retention: 'durable',
          valence: 'warm',
          emotionalWeight: 80,
          detail: communityDetail,
        }),
        world.day,
      );
    }
  }

  let nextWorld: WorldState = {
    ...world,
    inventory: consumed.inventory,
    communityProjects: {
      ...(world.communityProjects ?? {}),
      [projectId]: {
        contributed: nextContributed,
        completedDay: completedNow ? world.day : 0,
      },
    },
    npcMemories: nextNpcMemories,
    memories: nextMemories,
    ...(completedNow ? { worldEvents: nextEvents } : {}),
  };

  if (completedNow) {
    // Gratitude chain (+4 affinity / +1 reliability per thanker) — completely
    // outside recordPlayerTalkAffinity's smalltalk cap (shared-activity
    // discipline; dailyAffinityGained stays untouched).
    for (const rid of def.thanksFrom) {
      nextWorld = applySharedActivityAffinity(nextWorld, rid, 4, 1).nextWorld;
    }
    nextWorld = {
      ...nextWorld,
      sideFlags: { ...(world.sideFlags ?? {}), [def.worldFlag]: true },
    };
  }

  const itemLabel = PERSONAL_ITEM_MAP[itemId]?.label ?? itemId;
  return {
    ok: true,
    world: nextWorld,
    toast: completedNow
      ? `${def.title} — finished together, thanks to every neighbor who chipped in!`
      : `Tucked ${
          actualAmount > 1 ? `${actualAmount} ${itemLabel}` : itemLabel
        } into the ${def.venueLabel} basket — the shelf shows ${contributedNow}/${goalDef.goal} now.`,
    ...(memoryUnlockedTitle !== undefined ? { memoryUnlockedTitle } : {}),
    completedNow,
  };
}
