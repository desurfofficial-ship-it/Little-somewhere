import { WorldState } from './types';

/**
 * Community Projects — world-side registry (Workstream E, world-environment
 * initiative).
 *
 * GAME_DESIGN §12.2 names persistent environmental transformation as the
 * post-bell milestone. This module is the WORLD-SIDE half of that contract:
 * a pure, deterministic registry of projects whose completed state visibly
 * transforms a world anchor, plus the derived stage reader the environment
 * composer and renderer consume. Contribution/cadence gameplay (multi-resident
 * rosters, noticeboard flyers) stays with the Gameplay team; everything here is
 * sideFlags-borne — zero schema bump, sanitizer-safe (`sanitizeSideFlags`
 * preserves arbitrary keys), mirroring the `side_orchard_gathering` slice
 * (storyline → setSideFlags → derive → renderer → resident routine → journal).
 *
 * Registry shape deliberately mirrors STORYLINES / EXPLORATION_DISCOVERIES:
 * declarative rows, no branching logic, additive-only growth.
 */

export interface CommunityProjectDef {
  id: string;
  name: string;
  locationName: string;
  /** Where the completed project is visible (must match a scene builder anchor). */
  anchor: string;
  /** sideFlag key holding the numeric stage (0 = untouched … stageCount = complete). */
  stageSideFlag: string;
  /** Number of community contributions needed (each visit advances one stage). */
  stageCount: number;
  /** Per-completed-stage journal-facing label (index 0 = stage 1 done, …). */
  stageLabels: readonly string[];
  /** The persistent world transformation the finished project grants. */
  worldChange: {
    visualId: string;
    description: string;
  };
  /** One-time journal memory row written when the project completes. */
  completionMemory: {
    id: string;
    title: string;
    summary: string;
  };
}

export const COMMUNITY_PROJECTS: readonly CommunityProjectDef[] = [
  {
    id: 'sorrel_garden',
    name: 'The Sorrel Hollow Garden',
    locationName: 'Sorrel Hollow',
    anchor: 'sorrel_hollow',
    stageSideFlag: 'project_sorrel_garden_stage',
    stageCount: 3,
    stageLabels: [
      'brambles cleared and the old beds tilled',
      'foxglove seedlings and marigold starts in the ground',
      'the forgotten garden blooming again',
    ],
    worldChange: {
      visualId: 'sorrel_garden_bed',
      description:
        'The Sorrel Hollow garden beds bloom with foxglove and marigold — a visible, persistent transformation of the hollow.',
    },
    completionMemory: {
      id: 'mem_sorrel_garden_bloom',
      title: 'The Garden Remembers',
      summary:
        'With a few unhurried afternoons of tending, Sorrel Hollow\u2019s forgotten garden came back to life — foxglove bells and marigolds where the brambles used to be. The hollow feels less forgotten now.',
    },
  },
] as const;

/** Resolves a project's current stage from world sideFlags (0 when untouched). */
export function getCommunityProjectStage(
  world: Pick<WorldState, 'sideFlags'>,
  projectId: string,
): number {
  const def = COMMUNITY_PROJECTS.find((p) => p.id === projectId);
  if (!def) return 0;
  const raw = Number(world.sideFlags?.[def.stageSideFlag] ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(def.stageCount, Math.floor(raw));
}

/** True when every registered contribution stage of the project is complete. */
export function isCommunityProjectComplete(
  world: Pick<WorldState, 'sideFlags'>,
  projectId: string,
): boolean {
  const def = COMMUNITY_PROJECTS.find((p) => p.id === projectId);
  if (!def) return false;
  return getCommunityProjectStage(world, projectId) >= def.stageCount;
}

/**
 * The next stage label to journal for a project (null when already complete or
 * unknown) — shared by the interact reducer so copy lives with the registry.
 */
export function getNextCommunityStageLabel(projectId: string, stage: number): string | null {
  const def = COMMUNITY_PROJECTS.find((p) => p.id === projectId);
  if (!def || stage >= def.stageCount) return null;
  return def.stageLabels[stage] ?? null;
}
