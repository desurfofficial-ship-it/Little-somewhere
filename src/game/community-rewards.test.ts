/**
 * SC-B — Community Project keepsake rewards acceptance tests.
 *
 * Spec of record: Agent B mission (rewards/keepsakes audit + impl). Each of the
 * three Community Projects (Plaza Garlands, Orchard Lanterns, Pond Mosaic) grants
 * a unique, non-giftable, shelf-displayable `keepsake` PersonalItem into the
 * player's satchel the moment its final goal is met — once per project, never
 * duplicated, and durable through save/load.
 *
 * These tests sit alongside `community.test.ts` (CP-01..CP-14) and focus
 * exclusively on the keepsake grant: completion → grant, idempotency,
 * persistence, project independence, and the cottage-shelf display contract.
 * The transactional reducer's broader refusal/witness/gratitude discipline is
 * already covered by the CP suite and is NOT re-asserted here.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createFreshWorldState,
  serializeWorldState,
  deserializeWorldState,
  advanceToNextDay,
} from './storage';
import {
  COMMUNITY_PROJECTS,
  CommunityProjectDef,
  contributeToCommunityProject,
  getCommunityProjectDef,
} from './community';
import {
  PERSONAL_ITEM_MAP,
  VALID_PERSONAL_ITEM_IDS,
  getOwnedKeepsakeItems,
  getItemCount,
} from './inventory';
import { toggleDisplayedKeepsakeAction } from './actions';
import { PersonalItemId, WorldState } from './types';

// ---------------------------------------------------------------------------
// Catalog contract — every authored Community Project carries a keepsake reward
// whose item def exists, is a keepsake, is non-giftable, and is shelf-displayable.
// ---------------------------------------------------------------------------

const EXPECTED_KEEPSAKES: Record<string, PersonalItemId> = {
  marigold_garland: 'pressed_garland_bloom' as PersonalItemId,
  orchard_lanterns: 'orchard_lantern_charm' as PersonalItemId,
  pond_mosaic: 'pond_mosaic_shard' as PersonalItemId,
};

test('SCB-CAT-01: every Community Project carries a keepsakeRewardItemId that resolves to a valid keepsake def', () => {
  assert.equal(COMMUNITY_PROJECTS.length, 3, 'three authored community projects');
  for (const def of COMMUNITY_PROJECTS) {
    assert.ok(
      def.keepsakeRewardItemId,
      `${def.id} carries a keepsakeRewardItemId`,
    );
    const expected = EXPECTED_KEEPSAKES[def.id];
    assert.equal(
      def.keepsakeRewardItemId,
      expected,
      `${def.id} rewards the expected keepsake`,
    );
    assert.ok(
      VALID_PERSONAL_ITEM_IDS.has(def.keepsakeRewardItemId),
      `${def.id} keepsake id is in VALID_PERSONAL_ITEM_IDS (runtime registry)`,
    );
    const itemDef = PERSONAL_ITEM_MAP[def.keepsakeRewardItemId];
    assert.ok(itemDef, `${def.id} keepsake resolves via PERSONAL_ITEM_MAP`);
    assert.equal(itemDef.category, 'keepsake', `${def.id} keepsake category`);
    assert.equal(
      itemDef.giftable,
      false,
      `${def.id} keepsake is non-giftable (earned memento, never traded)`,
    );
    assert.equal(
      itemDef.homeDisplayable,
      'shelf',
      `${def.id} keepsake is displayable on the cottage oak shelf`,
    );
  }
});

test('SCB-CAT-02: the three community keepsakes are distinct ids (no project shares a reward)', () => {
  const ids = COMMUNITY_PROJECTS.map((d) => d.keepsakeRewardItemId);
  assert.equal(new Set(ids).size, ids.length, 'keepsake ids are unique per project');
});

// ---------------------------------------------------------------------------
// Staged-world helpers (house style: built up from createFreshWorldState)
// ---------------------------------------------------------------------------

function withSatchel(
  world: WorldState,
  items: Partial<Record<PersonalItemId, number>>,
): WorldState {
  return { ...world, inventory: { ...world.inventory, ...items } };
}

interface StagedProject {
  world: WorldState;
  def: CommunityProjectDef;
  /** The item the goal-meeting contribution will tuck in. */
  finalItemId: PersonalItemId;
}

/**
 * Stage a world where `projectId` is exactly one contribution away from
 * completion, with that one item in the satchel. Mirrors the
 * `stageNearlyCompleteOrchard` pattern from community.test.ts but is
 * parameterized across all three projects.
 */
function stageOneItemShort(projectId: string): StagedProject {
  const def = getCommunityProjectDef(projectId);
  assert.ok(def, `${projectId} def exists in COMMUNITY_PROJECTS`);

  // Pick the first accepted item as the "last one needed" — pre-fill every
  // other accepted item to its goal, and pre-fill the first item to goal-1.
  const [finalAccept, ...rest] = def.accepts;
  const contributed: Record<string, number> = {};
  for (const a of rest) contributed[a.itemId] = a.goal;
  contributed[finalAccept.itemId] = finalAccept.goal - 1;

  let world = createFreshWorldState();
  world = withSatchel(world, { [finalAccept.itemId]: 1 } as Partial<Record<PersonalItemId, number>>);
  world = {
    ...world,
    communityProjects: {
      ...world.communityProjects,
      [projectId]: { contributed, completedDay: 0 },
    },
  };
  return { world, def: def!, finalItemId: finalAccept.itemId };
}

// ---------------------------------------------------------------------------
// Completion grants the keepsake — one test per project, plus a joint assertion
// that the keepsake is discoverable via the shelf-displayable keepsake filter.
// ---------------------------------------------------------------------------

test('SCB-GRANT-01: marigold_garland completion grants Pressed Garland Bloom', () => {
  const { world, def, finalItemId } = stageOneItemShort('marigold_garland');
  const keepsakeId = EXPECTED_KEEPSAKES.marigold_garland;
  assert.equal(getItemCount(world.inventory, keepsakeId), 0, 'keepsake absent before completion');

  const res = contributeToCommunityProject(world, 'marigold_garland', finalItemId, 1);
  assert.equal(res.ok, true);
  assert.equal(res.completedNow, true, 'final contribution completes the project');

  assert.equal(
    getItemCount(res.world.inventory, keepsakeId),
    1,
    'Pressed Garland Bloom granted exactly once',
  );
  assert.ok(
    res.world.discoveredItemIds.includes(keepsakeId),
    'keepsake added to discoveredItemIds (journal/catalog discovery)',
  );
  assert.match(res.toast ?? '', /Pressed Garland Bloom/);
  assert.match(res.toast ?? '', /finished together/);
  // Input world untouched
  assert.equal(getItemCount(world.inventory, keepsakeId), 0);
  assert.ok(def);
});

test('SCB-GRANT-02: orchard_lanterns completion grants Orchard Lantern Charm', () => {
  const { world, finalItemId } = stageOneItemShort('orchard_lanterns');
  const keepsakeId = EXPECTED_KEEPSAKES.orchard_lanterns;
  assert.equal(getItemCount(world.inventory, keepsakeId), 0);

  const res = contributeToCommunityProject(world, 'orchard_lanterns', finalItemId, 1);
  assert.equal(res.ok, true);
  assert.equal(res.completedNow, true);
  assert.equal(getItemCount(res.world.inventory, keepsakeId), 1, 'Orchard Lantern Charm granted');
  assert.ok(res.world.discoveredItemIds.includes(keepsakeId));
  assert.match(res.toast ?? '', /Orchard Lantern Charm/);
});

test('SCB-GRANT-03: pond_mosaic completion grants Pond Mosaic Shard', () => {
  const { world, finalItemId } = stageOneItemShort('pond_mosaic');
  const keepsakeId = EXPECTED_KEEPSAKES.pond_mosaic;
  assert.equal(getItemCount(world.inventory, keepsakeId), 0);

  const res = contributeToCommunityProject(world, 'pond_mosaic', finalItemId, 1);
  assert.equal(res.ok, true);
  assert.equal(res.completedNow, true);
  assert.equal(getItemCount(res.world.inventory, keepsakeId), 1, 'Pond Mosaic Shard granted');
  assert.ok(res.world.discoveredItemIds.includes(keepsakeId));
  assert.match(res.toast ?? '', /Pond Mosaic Shard/);
});

test('SCB-GRANT-04: granted keepsake appears in getOwnedKeepsakeItems (cottage-shelf filter)', () => {
  const { world, finalItemId } = stageOneItemShort('marigold_garland');
  const keepsakeId = EXPECTED_KEEPSAKES.marigold_garland;
  const before = getOwnedKeepsakeItems(world.inventory);
  assert.ok(!before.some((d) => d.id === keepsakeId), 'keepsake absent from shelf filter pre-completion');

  const res = contributeToCommunityProject(world, 'marigold_garland', finalItemId, 1);
  const after = getOwnedKeepsakeItems(res.world.inventory);
  const found = after.find((d) => d.id === keepsakeId);
  assert.ok(found, 'granted keepsake appears in getOwnedKeepsakeItems');
  assert.equal(found.homeDisplayable, 'shelf');
});

// ---------------------------------------------------------------------------
// Idempotency — the grant never duplicates, even under hostile pre-seeding.
// ---------------------------------------------------------------------------

test('SCB-IDEM-01: second contribution after completion is refused (project_completed); keepsake count stays 1', () => {
  const { world, finalItemId } = stageOneItemShort('orchard_lanterns');
  const keepsakeId = EXPECTED_KEEPSAKES.orchard_lanterns;

  const done = contributeToCommunityProject(world, 'orchard_lanterns', finalItemId, 1);
  assert.equal(done.completedNow, true);
  assert.equal(getItemCount(done.world.inventory, keepsakeId), 1);

  // Stage a second contribution: the project is complete (completedDay > 0),
  // so contributeToCommunityProject must refuse with `project_completed` and
  // return the SAME world reference. The reducer never enters the burst again.
  const retryWorld = withSatchel(done.world, { crabapple: 3 });
  const res = contributeToCommunityProject(retryWorld, 'orchard_lanterns', 'crabapple', 1);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'project_completed');
  assert.equal(res.world, retryWorld, 'refusal returns the input world reference unchanged');
  assert.equal(
    getItemCount(res.world.inventory, keepsakeId),
    1,
    'keepsake count unchanged after refused retry',
  );
});

test('SCB-IDEM-02: pre-seeding the keepsake in the satchel before completion does NOT double-grant', () => {
  // Hostile precondition: the player already owns the keepsake (e.g. from a
  // pre-seeded or hand-edited save) but the project is still open. The
  // completion burst's `getItemCount === 0` guard must refuse to grant a copy.
  const { world, finalItemId } = stageOneItemShort('marigold_garland');
  const keepsakeId = EXPECTED_KEEPSAKES.marigold_garland;
  const preSeeded = withSatchel(world, { [keepsakeId]: 1 } as Partial<Record<PersonalItemId, number>>);
  assert.equal(getItemCount(preSeeded.inventory, keepsakeId), 1, 'precondition: keepsake already owned');

  const res = contributeToCommunityProject(preSeeded, 'marigold_garland', finalItemId, 1);
  assert.equal(res.ok, true);
  assert.equal(res.completedNow, true, 'project still completes');
  assert.equal(
    getItemCount(res.world.inventory, keepsakeId),
    1,
    'idempotent guard refuses to grant a second copy',
  );
});

// ---------------------------------------------------------------------------
// Persistence — the granted keepsake survives save/load and the day roll.
// ---------------------------------------------------------------------------

test('SCB-PERSIST-01: granted keepsake survives serialize → deserialize round-trip', () => {
  const { world, finalItemId } = stageOneItemShort('pond_mosaic');
  const keepsakeId = EXPECTED_KEEPSAKES.pond_mosaic;
  const res = contributeToCommunityProject(world, 'pond_mosaic', finalItemId, 1);
  assert.equal(getItemCount(res.world.inventory, keepsakeId), 1);

  const roundTrip = deserializeWorldState(serializeWorldState(res.world));
  assert.equal(roundTrip.state.schemaVersion, res.world.schemaVersion, 'schema version preserved');
  assert.equal(
    getItemCount(roundTrip.state.inventory, keepsakeId),
    1,
    'keepsake count survives save/load',
  );
  assert.ok(
    roundTrip.state.discoveredItemIds.includes(keepsakeId),
    'keepsake stays in discoveredItemIds after save/load',
  );
  assert.equal(
    roundTrip.state.communityProjects.pond_mosaic?.completedDay,
    res.world.communityProjects.pond_mosaic?.completedDay,
    'completion day survives save/load',
  );
});

test('SCB-PERSIST-02: granted keepsake survives advanceToNextDay', () => {
  const { world, finalItemId } = stageOneItemShort('orchard_lanterns');
  const keepsakeId = EXPECTED_KEEPSAKES.orchard_lanterns;
  const res = contributeToCommunityProject(world, 'orchard_lanterns', finalItemId, 1);
  assert.equal(getItemCount(res.world.inventory, keepsakeId), 1);

  const nextDay = advanceToNextDay(res.world);
  assert.equal(nextDay.day, res.world.day + 1, 'day advanced');
  assert.equal(
    getItemCount(nextDay.inventory, keepsakeId),
    1,
    'keepsake still held after the day roll',
  );
  assert.ok(nextDay.discoveredItemIds.includes(keepsakeId));
});

test('SCB-PERSIST-03: keepsake stays valid through a serialize → load → re-serialize cycle', () => {
  const { world, finalItemId } = stageOneItemShort('marigold_garland');
  const keepsakeId = EXPECTED_KEEPSAKES.marigold_garland;
  const res = contributeToCommunityProject(world, 'marigold_garland', finalItemId, 1);
  const first = serializeWorldState(res.world);
  const loaded = deserializeWorldState(first).state;
  const second = serializeWorldState(loaded);
  assert.equal(first, second, 'save is byte-stable across load/resave (no drift)');
  assert.equal(getItemCount(loaded.inventory, keepsakeId), 1);
});

// ---------------------------------------------------------------------------
// Project independence — completing one project grants ONLY that project's
// keepsake; the other two projects' keepsakes stay absent.
// ---------------------------------------------------------------------------

test('SCB-INDEP-01: completing orchard_lanterns grants ONLY the orchard charm, not the garland bloom or pond shard', () => {
  const { world, finalItemId } = stageOneItemShort('orchard_lanterns');
  const orchardId = EXPECTED_KEEPSAKES.orchard_lanterns;
  const garlandId = EXPECTED_KEEPSAKES.marigold_garland;
  const pondId = EXPECTED_KEEPSAKES.pond_mosaic;

  const res = contributeToCommunityProject(world, 'orchard_lanterns', finalItemId, 1);
  assert.equal(getItemCount(res.world.inventory, orchardId), 1);
  assert.equal(getItemCount(res.world.inventory, garlandId), 0, 'garland keepsake not granted');
  assert.equal(getItemCount(res.world.inventory, pondId), 0, 'pond keepsake not granted');
});

test('SCB-INDEP-02: completing all three projects (one after another) grants all three keepsakes exactly once', () => {
  // Complete marigold_garland
  const stageA = stageOneItemShort('marigold_garland');
  const resA = contributeToCommunityProject(stageA.world, 'marigold_garland', stageA.finalItemId, 1);
  assert.equal(resA.completedNow, true);

  // Complete orchard_lanterns on top of resA's world (independent slices)
  const stageB = stageOneItemShort('orchard_lanterns');
  // Carry forward A's inventory + completion so we can verify independence
  const worldB: WorldState = {
    ...stageB.world,
    inventory: { ...stageB.world.inventory, ...resA.world.inventory },
    discoveredItemIds: [...new Set([...stageB.world.discoveredItemIds, ...resA.world.discoveredItemIds])],
    communityProjects: {
      ...stageB.world.communityProjects,
      ...resA.world.communityProjects,
    },
  };
  const resB = contributeToCommunityProject(worldB, 'orchard_lanterns', stageB.finalItemId, 1);
  assert.equal(resB.completedNow, true);

  // Complete pond_mosaic on top of B
  const stageC = stageOneItemShort('pond_mosaic');
  const worldC: WorldState = {
    ...stageC.world,
    inventory: { ...stageC.world.inventory, ...resB.world.inventory },
    discoveredItemIds: [...new Set([...stageC.world.discoveredItemIds, ...resB.world.discoveredItemIds])],
    communityProjects: {
      ...stageC.world.communityProjects,
      ...resB.world.communityProjects,
    },
  };
  const resC = contributeToCommunityProject(worldC, 'pond_mosaic', stageC.finalItemId, 1);
  assert.equal(resC.completedNow, true);

  // All three keepsakes present, each exactly once
  assert.equal(getItemCount(resC.world.inventory, EXPECTED_KEEPSAKES.marigold_garland), 1);
  assert.equal(getItemCount(resC.world.inventory, EXPECTED_KEEPSAKES.orchard_lanterns), 1);
  assert.equal(getItemCount(resC.world.inventory, EXPECTED_KEEPSAKES.pond_mosaic), 1);
});

// ---------------------------------------------------------------------------
// Cottage shelf integration — the granted keepsake can be displayed via the
// existing `toggleDisplayedKeepsakeAction` (5-slot oak shelf contract).
// ---------------------------------------------------------------------------

test('SCB-SHELF-01: granted community keepsake can be toggled onto the oak shelf', () => {
  const { world, finalItemId } = stageOneItemShort('marigold_garland');
  const keepsakeId = EXPECTED_KEEPSAKES.marigold_garland;

  const res = contributeToCommunityProject(world, 'marigold_garland', finalItemId, 1);
  assert.equal(getItemCount(res.world.inventory, keepsakeId), 1);

  const toggle = toggleDisplayedKeepsakeAction(res.world, keepsakeId);
  assert.equal(toggle.ok, true, 'keepsake can be placed on the shelf');
  assert.equal(toggle.nextWorld.cottageState.displayedKeepsakeIds.includes(keepsakeId), true);
  assert.match(toggle.toast, /Set .* onto your sunlit oak keepsake shelf/);

  // Toggle off again — the shelf empties cleanly
  const toggleOff = toggleDisplayedKeepsakeAction(toggle.nextWorld, keepsakeId);
  assert.equal(toggleOff.ok, true);
  assert.equal(
    toggleOff.nextWorld.cottageState.displayedKeepsakeIds.includes(keepsakeId),
    false,
    'keepsake removed from shelf on second toggle',
  );
});

test('SCB-SHELF-02: community keepsake counts toward the 5-slot shelf cap', () => {
  const { world, finalItemId } = stageOneItemShort('pond_mosaic');
  const keepsakeId = EXPECTED_KEEPSAKES.pond_mosaic;
  const res = contributeToCommunityProject(world, 'pond_mosaic', finalItemId, 1);

  // Pre-fill the shelf with 5 existing keepsakes so the cap is hit
  const otherKeepsakes: PersonalItemId[] = [
    'willow_zine_copy',
    'brass_pocket_bell',
    'pond_watercolor_card',
    'woven_herb_wreath',
    'cedar_music_box',
  ];
  let preFilled = {
    ...res.world,
    inventory: { ...res.world.inventory, ...Object.fromEntries(otherKeepsakes.map((k) => [k, 1])) },
    cottageState: {
      ...res.world.cottageState,
      displayedKeepsakeIds: [...otherKeepsakes],
    },
  };

  const toggle = toggleDisplayedKeepsakeAction(preFilled, keepsakeId);
  assert.equal(toggle.ok, false, 'shelf at cap (5) refuses the new keepsake');
  assert.match(toggle.toast, /already holds 5 keepsakes/);
});
