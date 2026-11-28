/**
 * Photography — neighborhood noticing practice (Stage 3 Continuation, Workstream B).
 *
 * Design contract (docs/architecture/stage3-everyday-activities/05-photography-design.md):
 * - Currency-free, anti-grind, no-fail: the player carries a camera (always available
 *   outdoors) and captures *named subjects* they have walked near. No daily quota,
 *   no rarity scoring, no quality grading, nothing missable-forever — only the
 *   noticing itself is rewarded. Capturing the same subject again is allowed and
 *   quietly pleasant (a fresh witness memory may still land; the first-of-subject
 *   journal row is deduped by id).
 * - Zero time cost (no `spendMinutes`): a photograph is a moment held, not minutes
 *   spent. No day-gate either: the camera never rests. This is the softest
 *   everyday circuit — quiet on purpose, never a chore.
 * - Zero schema bump (D7 registry policy): all persistence rides EXISTING WorldState
 *   containers — `sideFlags` counters (sanctioned free-extension container,
 *   preserved by `sanitizeSideFlags`), `world.memories` journal rows (dedupe by id,
 *   cap 96 at load), the single satchel via `addItemToInventory` (idempotent, guard
 *   `getItemCount === 0`), and `npcMemories` (witness writes, same discipline as
 *   pond stone-skips and fishing catches).
 * - Deterministic: zero RNG of any kind and zero wall-clock reads (no
 *   pseudo-random source, no real-time clock, no high-resolution timer). The
 *   reducer is pure and headless, fully `tsx --test`'able per AGENTS.md layer
 *   boundaries. Replaying the same save reproduces the same journal rows, the
 *   same keepsake grant, and the same witness event ids.
 * - Interconnection (Workstream B patterns P1/P2/P4): the first-ever capture grants
 *   `framed_photo_keepsake` (displayable on the cottage shelf via the existing
 *   `toggleDisplayedKeepsakeAction`); first-of-subject unlocks a journal row that
 *   the Pocket Journal Memories tab renders automatically; captures within witness
 *   radius write firsthand NPC memories (tag `'photo'`, valence `'warm'`) that feed
 *   the PHOTO_ECHO_TOPICS conversational afterlife (see dialogue/everyday/photoEcho.ts).
 *
 * This module is pure and headless (zero DOM/three imports) — fully testable via
 * `tsx --test` per AGENTS.md layer boundaries. Scene presentation for the panel
 * surface lives in components/PhotoPanel.tsx (React); the reducer never reads the
 * DOM. Anchors mirror worldMap.PROP_INTERACTABLES positions; the panel filters
 * subjects by Euclidean distance to the player against `frameRadius`.
 */

import {
  LOCAL_WITNESS_RADIUS,
  cloneNpcMemories,
  collectWitnessesForPosition,
  createNpcMemoryEntry,
  recordNpcMemoryInPlace,
} from './memories';
import { addItemToInventory, getItemCount } from './inventory';
import { getTimePhase } from './residents';
import type { JournalMemory, PersonalItemId, WorldState } from './types';

// --- subject registry ------------------------------------------------------------------

export type PhotoSubjectCategory = 'landmark' | 'community' | 'water' | 'scenery';

export interface PhotoSubjectDef {
  id: string;
  name: string;
  category: PhotoSubjectCategory;
  /** Anchor position (mirrors a worldMap PROP_INTERACTABLES row). */
  anchorX: number;
  anchorZ: number;
  /** Max distance from the anchor at which the subject is framable. */
  frameRadius: number;
  /** First-of-subject journal row title. */
  memoryTitle: string;
  /** First-of-subject journal row summary. */
  memorySummary: string;
  /**
   * Optional sideFlags key that must be `true` for the subject to be capturable.
   * Used by community-project subjects (plaza_garlands, orchard_lanterns,
   * pond_mosaic) so a photo of the completed garlands/lanterns/mosaic is only
   * granted when the project is actually complete (D-3 fix) — and gives the
   * community `worldFlag` completion sideFlags a real consumer (D-4 fix).
   */
  requiresSideFlag?: string;
}

/**
 * The neighborhood's curated frameable subjects (13): one registry, four
 * categories. Anchors mirror `worldMap.PROP_INTERACTABLES` positions exactly so
 * the panel's distance check lines up with the scene rig. Two of these
 * (`plaza_garlands`, `orchard_lanterns`) reuse a community-project venue as
 * their anchor — the project itself is the subject once it's completed, and the
 * `frameRadius` is generous enough that standing near the venue is enough.
 */
export const PHOTO_SUBJECTS: readonly PhotoSubjectDef[] = [
  {
    id: 'gazebo_bell',
    name: 'Gazebo Bell Spire',
    category: 'landmark',
    anchorX: 0,
    anchorZ: -6.8,
    frameRadius: 14,
    memoryTitle: 'The Bell Spire at First Light',
    memorySummary:
      'Framed the old gazebo bell against the morning mist — its brass crown catching the first of the day, the lane still quiet beneath it.',
  },
  {
    id: 'mirror_pond',
    name: 'Mirror Pond Bank',
    category: 'water',
    anchorX: 1.8,
    anchorZ: 10.6,
    frameRadius: 16,
    memoryTitle: 'Stillness at Mirror Pond',
    memorySummary:
      'Caught the pond holding its breath — cedar bridge, lily pads, and the willow jetty all doubled on the surface in one quiet exposure.',
  },
  {
    id: 'hollow_oak',
    name: 'Hollow Oak Root',
    category: 'landmark',
    anchorX: -6.2,
    anchorZ: 14.0,
    frameRadius: 13,
    memoryTitle: 'The Hollow Oak',
    memorySummary: `Framed the hollow oak's great split trunk — ferns at its base, the pond's edge behind it, the neighborhood's oldest patient neighbor.`,
  },
  {
    id: 'rise_vista',
    name: 'Foxglove Rise Panorama',
    category: 'scenery',
    anchorX: 22,
    anchorZ: 19.3,
    frameRadius: 15,
    memoryTitle: 'The Rise Over Willow Lane',
    memorySummary:
      'Hiked up to Foxglove Rise with the camera — the whole lane laid out below in soft afternoon light, the brook a silver thread through it.',
  },
  {
    id: 'old_stone_well',
    name: 'Old Stone Well',
    category: 'landmark',
    anchorX: -20.2,
    anchorZ: 18.3,
    frameRadius: 12,
    memoryTitle: 'The Old Stone Well',
    memorySummary: `Photographed the old stone well at the lane's west edge — its mouth green with moss, the windlass still wound with fraying rope.`,
  },
  {
    id: 'plaza_noticeboard',
    name: 'Neighborhood Noticeboard',
    category: 'community',
    anchorX: 4.4,
    anchorZ: -2.2,
    frameRadius: 14,
    memoryTitle: 'The Plaza Noticeboard',
    memorySummary: `Caught the plaza noticeboard in full bloom — pinned handbills and chalk sketches layered over each other, the neighborhood's paper heartbeat.`,
  },
  {
    id: 'plaza_garlands',
    name: 'Plaza Garlands',
    category: 'community',
    anchorX: 4.4,
    anchorZ: -2.2,
    frameRadius: 14,
    memoryTitle: 'Garlands Across the Plaza',
    memorySummary:
      'Framed the marigold garlands strung across the plaza — the warm string the neighborhood hung together, glowing between the lampposts.',
    requiresSideFlag: 'communityGarlandComplete',
  },
  {
    id: 'orchard_lanterns',
    name: 'Orchard Lanterns',
    category: 'community',
    anchorX: -4.2,
    anchorZ: -19.2,
    frameRadius: 15,
    memoryTitle: `Orchard Lantern Light`,
    memorySummary:
      'Caught the orchard tasting-table lanterns at dusk — crabapple jars lit from within, the lanterns the neighbors hung glowing warm between the boughs.',
    requiresSideFlag: 'communityOrchardLanternsComplete',
  },
  {
    id: 'pond_mosaic',
    name: 'Mirror Pond Mosaic',
    category: 'community',
    anchorX: 5.95,
    anchorZ: 13.8,
    frameRadius: 12,
    memoryTitle: 'The Pond Mosaic Steps',
    memorySummary: `Photographed the new mosaic steps at Mirror Pond — river glass and fern pressed into ceramic, the neighborhood's hands in the tile.`,
    requiresSideFlag: 'communityPondMosaicComplete',
  },
  {
    id: 'willow_jetty',
    name: 'Willow Jetty',
    category: 'water',
    anchorX: -0.8,
    anchorZ: 17.6,
    frameRadius: 13,
    memoryTitle: 'The Willow Jetty',
    memorySummary: `Framed the willow jetty stretching out over Mirror Pond — its boards silver with weather, the willow's trailing shade dappling the planks.`,
  },
  {
    id: 'west_brook_bank',
    name: 'West Brook Bank',
    category: 'water',
    // Slice W1 lockstep: follows the relocated fishing stand on the stream's
    // north bank (worldMap PROP_INTERACTABLES row is the authority).
    anchorX: -5.5,
    anchorZ: 12.35,
    frameRadius: 12,
    memoryTitle: 'The Brook at the Culvert',
    memorySummary:
      'Caught the west brook where it slips under the cedar bridge — clear water curling past the wing wall, ferns leaning in from both banks.',
  },
  {
    id: 'marigold_bank',
    name: 'Wildflower Bank',
    category: 'scenery',
    anchorX: 20.3,
    anchorZ: 3.3,
    frameRadius: 14,
    memoryTitle: 'The Marigold Bank',
    memorySummary:
      'Framed the wildflower bank on the lane\'s east shoulder — marigold, cornflower, and sweet alyssum all leaning into the light together.',
  },
  {
    id: 'orchard_skep',
    name: 'Orchard Bee Skep',
    category: 'scenery',
    anchorX: 3.9,
    anchorZ: -16.3,
    frameRadius: 12,
    memoryTitle: 'The Orchard Bee Skep',
    memorySummary:
      'Photographed the orchard bee skep in the afternoon hum — woven willow and a soft cloud of bees drifting over the crabapple boughs.',
  },
];

/** Lookup helper for the panel and tests. */
export function getPhotoSubjectDef(id: string): PhotoSubjectDef | undefined {
  return PHOTO_SUBJECTS.find((s) => s.id === id);
}

// --- sideFlags keys (the sanctioned zero-migration persistence channel) ---------------

export const PHOTO_COUNT_KEY = 'photoCount';
export const PHOTO_LAST_DAY_KEY = 'photoLastDay';

/** Keepsake granted on the first-ever capture (SC-B cast idiom, idempotent). */
export const FRAMED_PHOTO_KEEPSAKE_ID = 'framed_photo_keepsake' as PersonalItemId;

/**
 * NaN/corruption-safe counter read (QA F2 class, same discipline as fishing):
 * bare `Number(sideFlags[key])` can inject NaN into world state. Invalid or
 * non-finite values read as 0; the reducer only ever writes finite integers.
 */
export function readCounter(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0
    ? Math.min(Math.floor(raw), Number.MAX_SAFE_INTEGER)
    : 0;
}

// --- resolution -----------------------------------------------------------------------

export interface PhotoActionResult {
  /** Structurally compatible with actions.ts `PropInteractionResult`. */
  nextWorld: WorldState;
  title: string;
  body: string;
  memoryUnlockedTitle?: string;
  gainedItems?: { itemId: PersonalItemId; count: number }[];
  subjectId?: string;
  subjectImageKey?: string;
}

/**
 * Capture one neighborhood photograph.
 *
 * Pure: never mutates the input world. Guards mirror the interior reducers
 * (QA F6): known subject (fail-closed), exterior only, no active activity.
 * No day-gate, no RNG, zero time cost — anti-grind by design.
 *
 * `subjectId` resolves a PHOTO_SUBJECTS row; unknown ids fail closed with the
 * unchanged world. The reducer writes:
 *   - `mem_photo_first_<subjectId>` journal memory (dedup by id; first-of-subject
 *     only — `memoryUnlockedTitle` is returned exactly once per subject).
 *   - `framed_photo_keepsake` satchel item (first-ever capture only; guarded by
 *     `getItemCount === 0` so re-captures never duplicate it).
 *   - `sideFlags.photoCount` (bumped) and `sideFlags.photoLastDay = world.day`
 *     (the everyday `deriveTouchedToday` reads this stamp).
 *   - One firsthand witness NPC memory per resident within
 *     `LOCAL_WITNESS_RADIUS` of the player's position (tag `'photo'`, eventId
 *     `ev_photo_<day>_<nextPhotoCount>`, detail.placeName = subject.name).
 */
export function performPhotoAction(
  world: WorldState,
  subjectId: string,
): PhotoActionResult {
  const subject = getPhotoSubjectDef(subjectId);
  if (!subject) {
    // Fail closed (defense-in-depth): an unknown subject never resolves a capture.
    return {
      nextWorld: world,
      title: 'Camera',
      body: `That isn't one of the neighborhood's framed subjects — the camera holds its lens cap.`,
      subjectId,
    };
  }

  const title = 'Camera';

  // D-3/D-4 fix: community-project photo subjects are only capturable when the
  // project is complete (the garlands aren't strung / lanterns aren't lit /
  // mosaic isn't laid until then). The `requiresSideFlag` field gives the
  // community `worldFlag` completion sideFlags a real consumer (D-4).
  if (subject.requiresSideFlag && world.sideFlags[subject.requiresSideFlag] !== true) {
    return {
      nextWorld: world,
      title,
      body: `${subject.name} isn’t finished yet — the neighborhood hasn’t completed it. Come back when it’s done and frame it then.`,
      subjectId,
    };
  }

  // Guard 1 — exterior only (the camera is a personal tool carried outdoors).
  if (world.playerLocation !== 'exterior') {
    return {
      nextWorld: world,
      title,
      body: 'The camera prefers daylight — step outside and frame the subject again.',
      subjectId,
    };
  }

  // Guard 2 — one unhurried thing at a time (no dual-activity claim; occupancy
  // and active invitations are never touched by this module).
  if (world.activeActivity) {
    return {
      nextWorld: world,
      title,
      body: 'Something else already holds this hour — finish it, then the camera will wait for you.',
      subjectId,
    };
  }

  const sideFlags = { ...(world.sideFlags ?? {}) };
  const prevCount = readCounter(sideFlags[PHOTO_COUNT_KEY]);
  const nextCount = prevCount + 1;

  // First-of-subject journal row — the Pocket Journal Memories tab renders it
  // automatically. Dedupe by id; append-only, cap enforced by the sanitizer.
  const memId = `mem_photo_first_${subject.id}`;
  const hasMemory = world.memories.some((m) => m.id === memId);
  let memoryUnlockedTitle: string | undefined;
  const nextMemories: JournalMemory[] = hasMemory
    ? world.memories
    : [
        {
          id: memId,
          day: world.day,
          phase: getTimePhase(world.minuteOfDay),
          title: subject.memoryTitle,
          summary: subject.memorySummary,
        },
        ...world.memories,
      ];
  if (!hasMemory) {
    memoryUnlockedTitle = subject.memoryTitle;
  }

  // First-ever capture: grant the framed-photo keepsake (idempotent — if the
  // satchel somehow already holds one, never duplicate it). The keepsake is
  // displayable on the cottage shelf via the existing toggleDisplayedKeepsakeAction.
  let nextInventory = world.inventory;
  let nextDiscoveredItemIds = world.discoveredItemIds;
  let gainedItems: { itemId: PersonalItemId; count: number }[] | undefined;
  if (prevCount === 0 && getItemCount(world.inventory, FRAMED_PHOTO_KEEPSAKE_ID) === 0) {
    const grantRes = addItemToInventory(
      world.inventory,
      world.discoveredItemIds,
      FRAMED_PHOTO_KEEPSAKE_ID,
      1,
    );
    nextInventory = grantRes.inventory;
    nextDiscoveredItemIds = grantRes.discoveredItemIds;
    if (grantRes.added > 0) {
      gainedItems = [{ itemId: FRAMED_PHOTO_KEEPSAKE_ID, count: grantRes.added }];
    }
  }

  const nextSideFlags: Record<string, boolean | number | string> = {
    ...sideFlags,
    [PHOTO_COUNT_KEY]: nextCount,
    [PHOTO_LAST_DAY_KEY]: world.day,
  };

  // Witness memories — same discipline as pond stone-skips and fishing catches:
  // nearby residents remember seeing you raise the camera. Tag `'photo'` (NOT
  // `'shared_photo'`) → no SF-4 R1 context boost → the echo family stays gentle
  // below the community band. Witness scan uses the player's position, not the
  // subject anchor, so a subject at the edge of frameRadius still writes a
  // memory only for residents standing near the photographer.
  const nextNpcMemories = cloneNpcMemories(world.npcMemories);
  const witnesses = collectWitnessesForPosition(
    world,
    world.playerPos,
    LOCAL_WITNESS_RADIUS,
  );
  const photoEvId = `ev_photo_${world.day}_${nextCount}`;
  const roundedMinute = Math.round(world.minuteOfDay);
  for (const wid of witnesses) {
    recordNpcMemoryInPlace(
      nextNpcMemories,
      wid,
      createNpcMemoryEntry({
        id: photoEvId,
        eventId: photoEvId,
        tag: 'photo',
        category: 'event',
        subjectPlayer: true,
        subjectResidents: [wid],
        provenance: 'firsthand',
        sourceKind: 'witness',
        createdDay: world.day,
        createdMinute: roundedMinute,
        importance: 2,
        retention: 'ephemeral',
        valence: 'warm',
        emotionalWeight: 48,
        detail: { placeName: subject.name },
      }),
      world.day,
    );
  }

  const body = hasMemory
    ? `Captured ${subject.name} again — another frame of a familiar view, kept quietly alongside the first.`
    : `Framed ${subject.name} — the shutter clicks once and the moment is yours to keep.${
        gainedItems && gainedItems.length > 0
          ? ' (Your first photograph — a small wooden frame is now on your shelf.)'
          : ''
      }`;

  return {
    nextWorld: {
      ...world,
      inventory: nextInventory,
      discoveredItemIds: nextDiscoveredItemIds,
      sideFlags: nextSideFlags,
      memories: nextMemories,
      npcMemories: nextNpcMemories,
    },
    title,
    body,
    memoryUnlockedTitle,
    gainedItems,
    subjectId,
    subjectImageKey: `subject_${subject.id}`,
  };
}
