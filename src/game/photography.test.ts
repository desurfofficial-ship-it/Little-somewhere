/**
 * Photography — adversarial battery (Workstream B matrix, Stage 3 Continuation).
 *
 * Test id → spec map:
 *   PHOTO-01 valid capture & completion (counter bumps, day stamps, witness memory written)
 *   PHOTO-02 first-ever capture grants the framed_photo_keepsake (idempotent)
 *   PHOTO-03 repeat subject — no duplicate journal row, no re-grant, counter still bumps
 *   PHOTO-04 unknown subject id fails closed (unchanged world)
 *   PHOTO-05 interior location guard
 *   PHOTO-06 active-activity guard (no dual claim)
 *   PHOTO-07 no day-gate — four captures on the same day all resolve
 *   PHOTO-08 corruption guard on sideFlags.photoCount (NaN / string / negative)
 *   PHOTO-09 save/load round-trip preserves counters, day stamp, keepsake, memories
 *   PHOTO-10 capture dirties the save revision (autosave notices the click)
 *   PHOTO-11 input purity — the input world is never mutated
 *   PHOTO-12 field-scoped regression (occupancy / activeActivity / invitations untouched)
 *   PHOTO-13 no wall-clock imports (Date.now / performance.now / Math.random regression lock)
 *   PHOTO-14 witness NPC memory written once per capture with deterministic event ids
 *   PHOTO-15 memoryUnlockedTitle only on true first-of-subject
 *   PHOTO-16 cross-subject independence (one subject's first doesn't suppress another's)
 *   PHOTO-17 keepsake idempotency (pre-seeded keepsake → no second grant)
 *   PHOTO-18 registry integrity (unique ids, 13 subjects, all categories valid)
 *
 * Run: npx tsx --test src/game/photography.test.ts
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  PHOTO_SUBJECTS,
  PHOTO_COUNT_KEY,
  PHOTO_LAST_DAY_KEY,
  FRAMED_PHOTO_KEEPSAKE_ID,
  performPhotoAction,
  getPhotoSubjectDef,
} from './photography';
import {
  createFreshWorldState,
  serializeWorldState,
  deserializeWorldState,
  computeWorldSaveRevision,
} from './storage';
import { PERSONAL_ITEM_MAP, getItemCount } from './inventory';
import { LOCAL_WITNESS_RADIUS } from './memories';
import { PROP_INTERACTABLES } from './worldMap';
import type { WorldState } from './types';

const MIRROR_POND = getPhotoSubjectDef('mirror_pond')!;
const GAZEBO_BELL = getPhotoSubjectDef('gazebo_bell')!;

/**
 * Stage the player outdoors beside Mirror Pond (the canonical photo subject
 * for the valid-capture tests). Mirrors fishing.test.ts `stageAtJetty` shape.
 */
function stageOutdoors(overrides: Partial<WorldState> = {}): WorldState {
  const world = createFreshWorldState();
  world.playerPos = { x: MIRROR_POND.anchorX, z: MIRROR_POND.anchorZ };
  world.playerLocation = 'exterior';
  return Object.assign(world, overrides);
}

describe('photography — Stage 3 Continuation (Workstream B)', () => {
  it('PHOTO-01 valid capture bumps the counter, stamps the day, and writes the witness memory', () => {
    const world = stageOutdoors();
    // Stage Clara within LOCAL_WITNESS_RADIUS so she witnesses the click.
    world.npcRuntime.clara.position = { x: world.playerPos.x + 1, z: world.playerPos.z };
    world.npcRuntime.clara.targetPos = { x: world.playerPos.x + 1, z: world.playerPos.z };

    const res = performPhotoAction(world, 'mirror_pond');

    assert.equal(res.title, 'Camera');
    assert.notEqual(res.nextWorld, world, 'capture path returns a new world');
    assert.equal(res.subjectId, 'mirror_pond');
    assert.equal(res.nextWorld.sideFlags[PHOTO_COUNT_KEY], 1);
    assert.equal(res.nextWorld.sideFlags[PHOTO_LAST_DAY_KEY], world.day);
    assert.equal(
      res.nextWorld.memories.some((m) => m.id === 'mem_photo_first_mirror_pond'),
      true,
      'first-of-subject journal row written',
    );
    // Witness memory: exactly one 'photo' tag on Clara, firsthand, eventId scheme pinned.
    const claraPhotoMems = (res.nextWorld.npcMemories.clara ?? []).filter((m) => m.tag === 'photo');
    assert.equal(claraPhotoMems.length, 1, 'exactly one witness memory for the capture');
    assert.equal(claraPhotoMems[0].eventId, `ev_photo_${world.day}_1`);
    assert.equal(claraPhotoMems[0].provenance, 'firsthand');
    assert.equal(claraPhotoMems[0].sourceKind, 'witness');
    assert.equal(claraPhotoMems[0].valence, 'warm');
    assert.equal(claraPhotoMems[0].emotionalWeight, 48);
    assert.equal(claraPhotoMems[0].detail?.placeName, MIRROR_POND.name);
  });

  it('PHOTO-02 first-ever capture grants the framed_photo_keepsake (idempotent guard)', () => {
    const world = stageOutdoors();
    assert.equal(getItemCount(world.inventory, FRAMED_PHOTO_KEEPSAKE_ID), 0, 'fresh satchel has no keepsake');

    const res = performPhotoAction(world, 'mirror_pond');

    assert.equal(
      getItemCount(res.nextWorld.inventory, FRAMED_PHOTO_KEEPSAKE_ID),
      1,
      'first-ever capture grants exactly one keepsake',
    );
    assert.ok(res.gainedItems && res.gainedItems.length === 1, 'gainedItems chip lists the keepsake');
    assert.equal(res.gainedItems![0].itemId, FRAMED_PHOTO_KEEPSAKE_ID);
    assert.equal(res.gainedItems![0].count, 1);
    assert.ok(
      res.nextWorld.discoveredItemIds.includes(FRAMED_PHOTO_KEEPSAKE_ID),
      'keepsake added to discovered ids',
    );
    assert.ok(
      PERSONAL_ITEM_MAP[FRAMED_PHOTO_KEEPSAKE_ID].category === 'keepsake',
      'granted item is in the keepsake category',
    );
  });

  it('PHOTO-03 repeat subject — no duplicate journal row, no re-grant, counter still bumps', () => {
    let world = stageOutdoors();
    const first = performPhotoAction(world, 'mirror_pond');
    assert.ok(first.memoryUnlockedTitle, 'first capture unlocks the journal title');

    // Second capture, same subject, same day (no day-gate).
    const second = performPhotoAction(first.nextWorld, 'mirror_pond');
    assert.equal(second.memoryUnlockedTitle, undefined, 'no unlock on repeat subject');
    assert.equal(
      second.nextWorld.memories.filter((m) => m.id === 'mem_photo_first_mirror_pond').length,
      1,
      'exactly one first-of-subject journal row',
    );
    assert.equal(second.nextWorld.sideFlags[PHOTO_COUNT_KEY], 2, 'counter still bumps');
    assert.equal(
      getItemCount(second.nextWorld.inventory, FRAMED_PHOTO_KEEPSAKE_ID),
      1,
      'keepsake not re-granted',
    );
    assert.equal(second.gainedItems, undefined, 'no gainedItems chip on repeat');
  });

  it('PHOTO-04 unknown subject id fails closed (unchanged world)', () => {
    const world = stageOutdoors();
    const before = JSON.stringify(world);
    const res = performPhotoAction(world, 'not_a_real_subject');
    assert.equal(res.nextWorld, world, 'unchanged world reference');
    assert.equal(JSON.stringify(world), before, 'input untouched');
    assert.equal(res.gainedItems, undefined);
    assert.equal(res.memoryUnlockedTitle, undefined);
    assert.equal(res.nextWorld.sideFlags[PHOTO_COUNT_KEY], undefined, 'no counter written');
    assert.equal(res.nextWorld.sideFlags[PHOTO_LAST_DAY_KEY], undefined, 'no day stamp');
  });

  it('PHOTO-05 interior location guard', () => {
    const world = stageOutdoors();
    world.playerLocation = 'cottage_interior';
    const res = performPhotoAction(world, 'mirror_pond');
    assert.equal(res.nextWorld, world, 'unchanged world reference');
    assert.equal(res.gainedItems, undefined);
    assert.equal(res.nextWorld.sideFlags[PHOTO_COUNT_KEY], undefined, 'no counter written indoors');
  });

  it('PHOTO-06 active-activity guard — no dual activity claim', () => {
    const world = stageOutdoors();
    world.activeActivity = {
      activityId: 'share_featured_reading',
      invitationId: 'inv_test',
    } as unknown as WorldState['activeActivity'];
    const before = JSON.stringify(world);
    const res = performPhotoAction(world, 'mirror_pond');
    assert.equal(res.nextWorld, world, 'unchanged world reference');
    assert.equal(JSON.stringify(world), before, 'input untouched');
    assert.equal(res.gainedItems, undefined);
    assert.equal(res.nextWorld.sideFlags[PHOTO_COUNT_KEY], undefined, 'no counter written');
  });

  it('PHOTO-07 no day-gate — four captures on the same day all resolve', () => {
    // Stage four distinct subjects at distinct anchors so each capture is a true
    // first-of-subject (mirrors pond_mosaic, willow_jetty, west_brook_bank,
    // and gazebo_bell — all reachable on the same outdoor day).
    let world = stageOutdoors();
    world.playerPos = { x: MIRROR_POND.anchorX, z: MIRROR_POND.anchorZ };
    const captures: Array<{ id: string; title?: string }> = [];

    const pondRes = performPhotoAction(world, 'mirror_pond');
    captures.push({ id: 'mirror_pond', title: pondRes.memoryUnlockedTitle });
    world = pondRes.nextWorld;

    // Move to willow_jetty and capture.
    world.playerPos = { x: -0.8, z: 17.6 };
    const jettyRes = performPhotoAction(world, 'willow_jetty');
    captures.push({ id: 'willow_jetty', title: jettyRes.memoryUnlockedTitle });
    world = jettyRes.nextWorld;

    // Move to west_brook_bank and capture.
    world.playerPos = { x: -4.45, z: 13.9 };
    const brookRes = performPhotoAction(world, 'west_brook_bank');
    captures.push({ id: 'west_brook_bank', title: brookRes.memoryUnlockedTitle });
    world = brookRes.nextWorld;

    // Move to gazebo_bell and capture.
    world.playerPos = { x: 0, z: -6.8 };
    const bellRes = performPhotoAction(world, 'gazebo_bell');
    captures.push({ id: 'gazebo_bell', title: bellRes.memoryUnlockedTitle });

    assert.equal(
      bellRes.nextWorld.sideFlags[PHOTO_COUNT_KEY],
      4,
      'all four captures resolved on the same day',
    );
    assert.equal(
      bellRes.nextWorld.sideFlags[PHOTO_LAST_DAY_KEY],
      world.day,
      'day stamp unchanged across same-day captures',
    );
    // Every capture was a true first-of-subject → every title unlocked.
    assert.ok(captures.every((c) => c.title), 'each first-of-subject unlocks its journal title');
    // First-ever keepsake was granted exactly once (on the first capture).
    assert.equal(getItemCount(bellRes.nextWorld.inventory, FRAMED_PHOTO_KEEPSAKE_ID), 1);
  });

  it('PHOTO-08 corruption guard — non-finite sideFlags.photoCount never propagates NaN', () => {
    const asString = stageOutdoors({ sideFlags: { [PHOTO_COUNT_KEY]: 'corrupt' } });
    const resStr = performPhotoAction(asString, 'mirror_pond');
    const strVal = resStr.nextWorld.sideFlags[PHOTO_COUNT_KEY];
    assert.equal(strVal, 1, 'string garbage reads as 0 then increments to 1');
    assert.equal(typeof strVal, 'number');
    assert.ok(Number.isFinite(strVal));

    const asNaN = stageOutdoors({ sideFlags: { [PHOTO_COUNT_KEY]: Number.NaN } });
    const resNaN = performPhotoAction(asNaN, 'mirror_pond');
    assert.ok(
      Number.isFinite(resNaN.nextWorld.sideFlags[PHOTO_COUNT_KEY] as number),
      'NaN counter reads as 0 then increments to a finite 1',
    );

    const asNeg = stageOutdoors({ sideFlags: { [PHOTO_COUNT_KEY]: -7 } });
    const resNeg = performPhotoAction(asNeg, 'mirror_pond');
    assert.equal(resNeg.nextWorld.sideFlags[PHOTO_COUNT_KEY], 1, 'negative counter reads as 0');
  });

  it('PHOTO-09 save/load round-trip preserves counters, day stamp, keepsake, and memories', () => {
    const world = stageOutdoors();
    const res = performPhotoAction(world, 'mirror_pond');
    const json = serializeWorldState(res.nextWorld);
    const loaded = deserializeWorldState(json);
    assert.equal(loaded.state.sideFlags[PHOTO_COUNT_KEY], 1);
    assert.equal(loaded.state.sideFlags[PHOTO_LAST_DAY_KEY], world.day);
    assert.equal(getItemCount(loaded.state.inventory, FRAMED_PHOTO_KEEPSAKE_ID), 1);
    assert.deepEqual(
      loaded.state.memories.map((m) => m.id),
      res.nextWorld.memories.map((m) => m.id),
      'journal rows survive the sanitizer',
    );
  });

  it('PHOTO-10 capture dirties the save revision (autosave notices the click)', () => {
    const world = stageOutdoors();
    const before = computeWorldSaveRevision(world);
    const res = performPhotoAction(world, 'mirror_pond');
    const after = computeWorldSaveRevision(res.nextWorld);
    assert.notEqual(before, after, 'a capture must change the save fingerprint');
  });

  it('PHOTO-11 input purity — the input world is never mutated', () => {
    const world = stageOutdoors();
    const before = JSON.stringify(world);
    performPhotoAction(world, 'mirror_pond');
    assert.equal(JSON.stringify(world), before, 'the reducer does not mutate its input');
  });

  it('PHOTO-12 field-scoped regression — occupancy, active activity and invitations untouched', () => {
    const world = stageOutdoors();
    const res = performPhotoAction(world, 'mirror_pond');
    assert.equal(res.nextWorld.occupancy, world.occupancy, 'occupancy untouched');
    assert.equal(res.nextWorld.activeActivity, world.activeActivity, 'activeActivity untouched');
    assert.equal(res.nextWorld.invitations, world.invitations, 'invitations untouched');
  });

  it('PHOTO-13 regression lock — the photography module never reads the wall clock', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'photography.ts'), 'utf-8');
    assert.ok(!src.includes('Date.now'), 'no Date.now (QA finding F1 class)');
    assert.ok(!src.includes('performance.now'), 'no performance.now');
    assert.ok(!src.includes('Math.random'), 'no Math.random — photography is deterministic');
  });

  it('PHOTO-14 witness NPC memory written once per capture with deterministic event ids', () => {
    const world = stageOutdoors();
    // Stage Clara within LOCAL_WITNESS_RADIUS.
    world.npcRuntime.clara.position = { x: world.playerPos.x + 1, z: world.playerPos.z };
    world.npcRuntime.clara.targetPos = { x: world.playerPos.x + 1, z: world.playerPos.z };
    // Stage Mina far away (beyond the radius) so she does NOT witness.
    world.npcRuntime.mina.position = { x: world.playerPos.x + 40, z: world.playerPos.z + 40 };
    world.npcRuntime.mina.targetPos = { x: world.playerPos.x + 40, z: world.playerPos.z + 40 };

    const res = performPhotoAction(world, 'mirror_pond');
    const claraMems = (res.nextWorld.npcMemories.clara ?? []).filter((m) => m.tag === 'photo');
    const minaMems = (res.nextWorld.npcMemories.mina ?? []).filter((m) => m.tag === 'photo');
    assert.equal(claraMems.length, 1, 'Clara (nearby) holds exactly one witness memory');
    assert.equal(minaMems.length, 0, 'Mina (far away) holds no witness memory');
    assert.equal(claraMems[0].eventId, `ev_photo_${world.day}_1`);

    // Second capture (different subject, same day): a fresh eventId (index increments).
    const world2 = res.nextWorld;
    world2.playerPos = { x: GAZEBO_BELL.anchorX, z: GAZEBO_BELL.anchorZ };
    // Move Clara to stay near the new subject so she witnesses again.
    world2.npcRuntime.clara.position = { x: world2.playerPos.x + 1, z: world2.playerPos.z };
    world2.npcRuntime.clara.targetPos = { x: world2.playerPos.x + 1, z: world2.playerPos.z };

    const res2 = performPhotoAction(world2, 'gazebo_bell');
    const claraMems2 = (res2.nextWorld.npcMemories.clara ?? []).filter((m) => m.tag === 'photo');
    // recordNpcMemoryInPlace prepends via unshift → most-recent capture is index 0.
    assert.equal(claraMems2.length, 2, 'Clara now holds two witness memories');
    assert.equal(claraMems2[0].eventId, `ev_photo_${world2.day}_2`, 'most-recent is index 0');
    assert.equal(claraMems2[1].eventId, `ev_photo_${world.day}_1`, 'older is index 1');
    const eventIds = new Set(claraMems2.map((m) => m.eventId));
    assert.equal(claraMems2.length, eventIds.size, 'event ids are unique per capture');
  });

  it('PHOTO-15 memoryUnlockedTitle only fires on a true first-of-subject', () => {
    const world = stageOutdoors();
    const first = performPhotoAction(world, 'mirror_pond');
    assert.ok(first.memoryUnlockedTitle, 'first capture unlocks the title');
    assert.ok(first.nextWorld.memories.some((m) => m.title === first.memoryUnlockedTitle));

    // Pre-seed the mirror_pond memory: no unlock, no new row, capture still lands.
    const seeded = stageOutdoors();
    seeded.memories = [
      {
        id: 'mem_photo_first_mirror_pond',
        day: 1,
        phase: 'morning',
        title: 'Seeded Mirror Pond',
        summary: 'Pre-seeded for the dedupe test.',
      },
    ];
    const res = performPhotoAction(seeded, 'mirror_pond');
    assert.equal(res.memoryUnlockedTitle, undefined, 'no unlock when the memory pre-exists');
    assert.equal(res.nextWorld.memories.length, seeded.memories.length, 'no row appended');
    assert.equal(res.nextWorld.sideFlags[PHOTO_COUNT_KEY], 1, 'capture still counts');
  });

  it('PHOTO-16 cross-subject independence — one subject\'s first doesn\'t suppress another\'s', () => {
    let world = stageOutdoors();
    // Capture mirror_pond first.
    world.playerPos = { x: MIRROR_POND.anchorX, z: MIRROR_POND.anchorZ };
    const pondRes = performPhotoAction(world, 'mirror_pond');
    assert.equal(pondRes.memoryUnlockedTitle, MIRROR_POND.memoryTitle);

    // Now move to gazebo_bell and capture: it's a fresh subject → its own unlock.
    const world2 = pondRes.nextWorld;
    world2.playerPos = { x: GAZEBO_BELL.anchorX, z: GAZEBO_BELL.anchorZ };
    const bellRes = performPhotoAction(world2, 'gazebo_bell');
    assert.equal(
      bellRes.memoryUnlockedTitle,
      GAZEBO_BELL.memoryTitle,
      'a different subject unlocks its own title',
    );
    assert.equal(
      bellRes.nextWorld.memories.some((m) => m.id === 'mem_photo_first_gazebo_bell'),
      true,
      'gazebo_bell first-of-subject row written independently',
    );
    assert.equal(
      bellRes.nextWorld.memories.some((m) => m.id === 'mem_photo_first_mirror_pond'),
      true,
      'mirror_pond first-of-subject row still present',
    );
  });

  it('PHOTO-17 keepsake idempotency — a pre-seeded keepsake is never re-granted', () => {
    const world = stageOutdoors();
    // Pre-seed the keepsake in the satchel (as if a debug grant or save edit placed it).
    world.inventory = { ...world.inventory, [FRAMED_PHOTO_KEEPSAKE_ID]: 1 };
    // photoCount is still 0 (first-ever capture) — the grant guard must check
    // getItemCount, not just prevCount === 0.
    const res = performPhotoAction(world, 'mirror_pond');
    assert.equal(
      getItemCount(res.nextWorld.inventory, FRAMED_PHOTO_KEEPSAKE_ID),
      1,
      'pre-seeded keepsake stays at 1 (no duplication)',
    );
    assert.equal(res.gainedItems, undefined, 'no gainedItems chip when the keepsake already exists');
    // The capture still counted and the journal row still unlocked.
    assert.equal(res.nextWorld.sideFlags[PHOTO_COUNT_KEY], 1);
    assert.ok(res.memoryUnlockedTitle, 'first-of-subject unlock is independent of the keepsake grant');
  });

  it('PHOTO-18 registry integrity — unique ids, 13 subjects, all categories valid, anchors match worldMap', () => {
    const ids = PHOTO_SUBJECTS.map((s) => s.id);
    const unique = new Set(ids);
    assert.equal(unique.size, ids.length, 'subject ids are unique');
    assert.ok(
      PHOTO_SUBJECTS.length >= 10 && PHOTO_SUBJECTS.length <= 24,
      `registry holds 10–24 subjects (got ${PHOTO_SUBJECTS.length})`,
    );
    assert.equal(PHOTO_SUBJECTS.length, 13, 'Stage 3 Continuation ships exactly 13 subjects');

    const validCategories = new Set(['landmark', 'community', 'water', 'scenery']);
    for (const subject of PHOTO_SUBJECTS) {
      assert.ok(validCategories.has(subject.category), `${subject.id} has a valid category`);
      assert.ok(
        subject.frameRadius >= 12 && subject.frameRadius <= 16,
        `${subject.id} frameRadius is in the 12–16 range`,
      );
      assert.ok(subject.memoryTitle.length > 0, `${subject.id} has a memoryTitle`);
      assert.ok(subject.memorySummary.length > 0, `${subject.id} has a memorySummary`);
    }

    // Anchors mirror worldMap.PROP_INTERACTABLES positions where the ids match.
    for (const subject of PHOTO_SUBJECTS) {
      const row = PROP_INTERACTABLES.find((p) => p.id === subject.id);
      if (row) {
        assert.equal(
          row.x,
          subject.anchorX,
          `${subject.id} anchorX matches the worldMap PROP_INTERACTABLES row`,
        );
        assert.equal(
          row.z,
          subject.anchorZ,
          `${subject.id} anchorZ matches the worldMap PROP_INTERACTABLES row`,
        );
      }
    }
  });

  it('PHOTO-19: community-project photo subjects are gated on project completion (D-3/D-4 fix)', () => {
    const world = stageOutdoors();
    // Fresh world: no community project is complete → the 3 community subjects
    // (plaza_garlands, orchard_lanterns, pond_mosaic) must be refused.
    const refused = performPhotoAction(world, 'plaza_garlands');
    assert.equal(refused.nextWorld, world, 'plaza_garlands refused when project incomplete');
    assert.equal(refused.memoryUnlockedTitle, undefined, 'no memory granted');
    // The refusal body explains the project isn't finished.
    assert.ok(refused.body.includes('isn'), 'refusal prose explains the project is not finished');

    // Complete the marigold_garland project via the completion sideFlag.
    const completed: WorldState = {
      ...world,
      sideFlags: { ...world.sideFlags, communityGarlandComplete: true },
    };
    const granted = performPhotoAction(completed, 'plaza_garlands');
    assert.notEqual(granted.nextWorld, completed, 'plaza_garlands granted when project complete');
    assert.ok(granted.memoryUnlockedTitle, 'memory granted on first capture after completion');

    // A non-community subject (mirror_pond) is NOT gated — it captures regardless.
    const ungated = performPhotoAction(world, 'mirror_pond');
    assert.notEqual(ungated.nextWorld, world, 'non-community subject captures without a sideFlag gate');
  });
});
