import { getTimePhase } from './residents';
import { distance2D } from './worldMap';
import { WorldState } from './types';

/**
 * The Wild Hollows — exploration discovery registry (Build 10).
 *
 * The world rewards curiosity: when the player (outdoors) first wanders into one of
 * these wild destination zones, the discovery is recorded in `world.sideFlags`
 * (save-safe without migration — `sanitizeSideFlags` preserves arbitrary keys) and a
 * one-time Pocket Journal memory row is appended. The check is a pure, deterministic,
 * in-place sim step — same discipline as encounters and greetings.
 *
 * Interconnection: Sorrel Hollow's old stone well grants the foxglove seeds that feed
 * the fourth greenhouse crop; Marigold Lane is Mina's evening walk; the Bee Line is
 * Rowan's wild-hive check; Foxglove Rise crowns the south-east knoll.
 */
export interface ExplorationDiscovery {
  id: string;
  name: string;
  sideFlag: string;
  memoryId: string;
  memoryTitle: string;
  memorySummary: string;
  x: number;
  z: number;
  radius: number;
}

export const EXPLORATION_DISCOVERIES: readonly ExplorationDiscovery[] = [
  {
    id: 'marigold_lane',
    name: 'Marigold Lane',
    sideFlag: 'explored_marigold_lane',
    memoryId: 'mem_explored_marigold_lane',
    memoryTitle: 'A Lane All My Own',
    memorySummary:
      'Behind the greenhouse I found a petal-bright wildflower lane winding south through the meadow — marigolds, cornflowers and foxglove leaves everywhere the eye falls.',
    x: 20.3,
    z: 5.5,
    radius: 5.2,
  },
  {
    id: 'foxglove_rise',
    name: 'Foxglove Rise',
    sideFlag: 'explored_foxglove_rise',
    memoryId: 'mem_explored_foxglove_rise',
    memoryTitle: 'The Whole World From the Rise',
    memorySummary:
      'A terraced knoll at the meadow\u2019s south-east edge, crowned with a little cedar lookout deck. From up there the whole valley reads like a painted map: pond, plaza, orchard and all.',
    x: 21.6,
    z: 18.5,
    radius: 5.4,
  },
  {
    id: 'sorrel_hollow',
    name: 'Sorrel Hollow',
    sideFlag: 'explored_sorrel_hollow',
    memoryId: 'mem_explored_sorrel_hollow',
    memoryTitle: 'The Forgotten Garden',
    memorySummary:
      'A birch-shaded clearing far past the pond where an old stone well still stands among wild sorrel. Someone tended this garden long before the square had a name.',
    x: -20.4,
    z: 18.3,
    radius: 5.2,
  },
  {
    id: 'bee_line',
    name: 'The Bee Line',
    sideFlag: 'explored_bee_line',
    memoryId: 'mem_explored_bee_line',
    memoryTitle: 'A Hum in the Clover',
    memorySummary:
      'East of the orchard a clover trail runs toward the Copperwheel meadows, past a mossy wild bee log. The whole path hums on warm afternoons.',
    x: 10.4,
    z: -18.8,
    radius: 5.0,
  },
];

const EXPLORATION_FLAG_KEYS = new Set(EXPLORATION_DISCOVERIES.map((d) => d.sideFlag));

/**
 * Returns the first exploration discovery the given outdoor position newly satisfies,
 * or `null` when nothing is new (already discovered or outside every zone).
 */
export function findNewExplorationDiscovery(
  world: WorldState,
  x: number,
  z: number,
): ExplorationDiscovery | null {
  const flags = world.sideFlags ?? {};
  for (const d of EXPLORATION_DISCOVERIES) {
    if (flags[d.sideFlag]) continue;
    if (distance2D({ x, z }, { x: d.x, z: d.z }) <= d.radius) {
      return d;
    }
  }
  return null;
}

/**
 * In-place, deterministic discovery step shared by the simulation tick.
 * Only meaningful outdoors — callers pass the exterior player position.
 * Returns the granted discovery (for toasts/tests) or `null`.
 */
export function discoverExplorationInPlace(
  world: WorldState,
  x: number,
  z: number,
): ExplorationDiscovery | null {
  const d = findNewExplorationDiscovery(world, x, z);
  if (!d) return null;

  world.sideFlags = { ...(world.sideFlags ?? {}), [d.sideFlag]: true };

  if (!world.memories.some((m) => m.id === d.memoryId)) {
    world.memories = [
      {
        id: d.memoryId,
        day: world.day,
        phase: getTimePhase(world.minuteOfDay),
        title: d.memoryTitle,
        summary: d.memorySummary,
      },
      ...world.memories,
    ];
  }
  return d;
}

/** True when every wild destination has been found — used by journal summaries. */
export function countExploredDiscoveries(world: WorldState): number {
  const flags = world.sideFlags ?? {};
  let n = 0;
  for (const key of EXPLORATION_FLAG_KEYS) {
    if (flags[key]) n += 1;
  }
  return n;
}
