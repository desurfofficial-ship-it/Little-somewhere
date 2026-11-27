// src/game/stage3-baseline.test.ts
// Agent G (S3-G) — Independent Adversarial QA baseline for LITTLE SOMEWHERE Stage 3.
//
// Purpose: lock the integrity of every shipped Community Projects Stage 2 system
// before any Stage 3 work touches the repo. Stage 3 PRs MUST NOT regress any
// assertion in this file. Read-only audit; writes tests only — production code
// is untouched.
//
// Coverage map (mirrors the S3-G mission brief):
//   §1 Community Projects integrity          (registry + stage derivation + D-1 fix)
//   §2 Keepsake rewards integrity            (PERSONAL_ITEMS catalog + grant/idempotency)
//   §3 Dialogue integrity                    (3 echo topics + golden snapshot + tag)
//   §4 Scene rig integrity                   (3 builder files + renderer wiring + H1 fix)
//   §5 Persistence integrity                 (JSON round-trip + deterministic stage)
//
// Each section is independent and may be run in isolation; the file relies only
// on exported contracts of the production modules under test.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';

import {
  COMMUNITY_PROJECTS,
  contributeToCommunityProject,
  getCommunityProjectDef,
  getCommunityShelfStage,
  isCommunityProjectComplete,
} from './community';
import { composeEnvironmentState } from './environment';
import { createFreshWorldState, deserializeWorldState, serializeWorldState } from './storage';
import {
  PERSONAL_ITEMS,
  PERSONAL_ITEM_MAP,
  VALID_PERSONAL_ITEM_IDS,
  getItemCount,
  getOwnedKeepsakeItems,
} from './inventory';
import { DIALOGUE_TOPICS } from './dialogue';
import { EnvironmentVisualController } from '../scene/environmentRenderer';
import type { EnvironmentRendererDeps } from '../scene/environmentRenderer';
import type { CommunityProjectsState, PersonalItemId, WorldState } from './types';

// ---------------------------------------------------------------------------
// Catalog constants — the exact shipped ids the baseline pins.
// ---------------------------------------------------------------------------

const PROJECT_IDS = ['marigold_garland', 'orchard_lanterns', 'pond_mosaic'] as const;

const KEEPSAKE_BY_PROJECT: Record<string, PersonalItemId> = {
  marigold_garland: 'pressed_garland_bloom' as PersonalItemId,
  orchard_lanterns: 'orchard_lantern_charm' as PersonalItemId,
  pond_mosaic: 'pond_mosaic_shard' as PersonalItemId,
};

const ECHO_TOPIC_IDS = [
  'everyday_community_basket_echo',
  'everyday_community_completion_celebration',
  'everyday_community_project_pride',
] as const;

// ===========================================================================
// §1 — Community Projects integrity
// ===========================================================================

test('S3-G §1.1: all 3 community projects have valid definitions in COMMUNITY_PROJECTS', () => {
  assert.equal(COMMUNITY_PROJECTS.length, 3, 'exactly three community projects shipped');
  for (const id of PROJECT_IDS) {
    const def = getCommunityProjectDef(id);
    assert.ok(def, `${id} resolves via getCommunityProjectDef`);
    assert.ok(def!.title.length > 0, `${id} carries a non-empty title`);
    assert.ok(def!.blurb.length > 0, `${id} carries a non-empty blurb`);
    assert.ok(def!.venueLabel.length > 0, `${id} carries a venue label`);
    assert.ok(def!.accepts.length >= 2, `${id} accepts at least 2 item kinds`);
    assert.ok(def!.thanksFrom.length >= 2, `${id} declares ≥2 thanksFrom neighbors`);
    assert.ok(def!.memoryId.startsWith('mem_community_'), `${id} memoryId convention`);
    assert.ok(def!.worldFlag.length > 0, `${id} declares a completion sideFlag`);
    assert.ok(def!.keepsakeRewardItemId, `${id} declares a keepsakeRewardItemId`);
  }
});

test('S3-G §1.2: getCommunityShelfStage applies the H2 threshold policy across all 3 projects', () => {
  // H2 policy: 0 → stage 0; first contribution ≥1 → stage 1;
  // ≥ ceil(totalGoal/2) → stage 2; ≥ totalGoal → stage 3 (= stageCount);
  // completedDay > 0 → stageCount regardless of contributed.
  type ProjectFix = {
    id: string;
    totalGoal: number;
    halfway: number;
    /** One contribution tuple that lands EXACTLY at halfway (stage 2 boundary). */
    halfwayContrib: Record<string, number>;
    /** One contribution tuple that lands EXACTLY at goal (stage 3 boundary). */
    goalContrib: Record<string, number>;
    /** The first accepted item id (used to stage the ≥1 → stage 1 boundary). */
    firstItem: string;
  };
  const fixtures: ProjectFix[] = [
    {
      id: 'marigold_garland',
      totalGoal: 8,
      halfway: 4,
      halfwayContrib: { meadow_posy: 3, chamomile_blossom: 1 },
      goalContrib: { meadow_posy: 3, chamomile_blossom: 3, lavender_sprig: 2 },
      firstItem: 'meadow_posy',
    },
    {
      id: 'orchard_lanterns',
      totalGoal: 6,
      halfway: 3,
      halfwayContrib: { crabapple: 3 },
      goalContrib: { crabapple: 4, wild_honey: 2 },
      firstItem: 'crabapple',
    },
    {
      id: 'pond_mosaic',
      totalGoal: 6,
      halfway: 3,
      halfwayContrib: { smooth_river_glass: 2, pressed_fern: 1 },
      goalContrib: {
        smooth_river_glass: 2,
        pressed_fern: 2,
        heron_feather: 1,
        cedar_shaving_rose: 1,
      },
      firstItem: 'smooth_river_glass',
    },
  ];

  for (const f of fixtures) {
    const shelf = (contributed: Record<string, number>, completedDay = 0) => ({
      communityProjects: {
        [f.id]: { contributed, completedDay },
      } as CommunityProjectsState,
    });

    // 0 → stage 0
    assert.equal(
      getCommunityShelfStage(shelf({}), f.id, 3),
      0,
      `${f.id}: zero contributions → stage 0`,
    );
    // 1 → stage 1 (first contribution)
    assert.equal(
      getCommunityShelfStage(shelf({ [f.firstItem]: 1 }), f.id, 3),
      1,
      `${f.id}: first contribution → stage 1`,
    );
    // ceil(totalGoal/2) → stage 2 (exactly halfway)
    assert.equal(
      getCommunityShelfStage(shelf(f.halfwayContrib), f.id, 3),
      2,
      `${f.id}: at halfway (${f.halfway}) → stage 2`,
    );
    // totalGoal → stage 3 (goal reached)
    assert.equal(
      getCommunityShelfStage(shelf(f.goalContrib), f.id, 3),
      3,
      `${f.id}: at goal (${f.totalGoal}) → stage 3`,
    );
    // completedDay > 0 + zero contributed → stage 3 (completion idempotency)
    assert.equal(
      getCommunityShelfStage(shelf({}, 5), f.id, 3),
      3,
      `${f.id}: completedDay>0 with zero contributed → stage 3`,
    );
  }
});

test('S3-G §1.3: D-1 fix holds — NaN contributed yields stage 0, not stage 1', () => {
  // The D-1 defect (community-adversarial.test.ts AD-4): a NaN-tainted
  // contributed value previously propagated through Math.min/Math.floor and
  // landed on the final `return 1` branch, silently reporting stage 1 for
  // corrupted data. The commit 9c7f62e message claims "D-1 FIXED: routed
  // through getCommunityProjectProgress (one-line change)".
  //
  // This baseline asserts the fix's promised contract: NaN contributed →
  // stage 0 (treat as no valid contribution). If this assertion fails at
  // baseline, the D-1 fix did NOT actually hold — flag as a critical finding.
  const shelf = {
    communityProjects: {
      marigold_garland: { contributed: { meadow_posy: NaN }, completedDay: 0 },
    } as CommunityProjectsState,
  };
  const stage = getCommunityShelfStage(shelf, 'marigold_garland', 3);
  assert.equal(
    stage,
    0,
    `D-1 fix must hold: NaN contributed should yield stage 0 (treat as no valid contribution); observed stage ${stage}`,
  );
});

test('S3-G §1.4: cross-project independence — contributing to one project does not affect others', () => {
  // Stage one item short of completion for each project; contribute to ONE
  // project; verify the other two remain at stage 0 with no progress slice.
  const world0 = createFreshWorldState();
  // Pre-seed marigold + pond at stage 0 (no contributions) and orchard at
  // stage 1 via one crabapple contributed.
  const world: WorldState = {
    ...world0,
    inventory: { ...world0.inventory, crabapple: 5 },
  };

  const res = contributeToCommunityProject(world, 'orchard_lanterns', 'crabapple', 1);
  assert.equal(res.ok, true, 'contribution succeeds');
  assert.equal(res.completedNow, false, 'one crabapple does not complete orchard');

  // Orchard reached stage 1 (1 of 6 contributed, halfway=3).
  assert.equal(getCommunityShelfStage(res.world, 'orchard_lanterns', 3), 1);
  // Marigold + pond remain untouched at stage 0 with no progress slice.
  assert.equal(getCommunityShelfStage(res.world, 'marigold_garland', 3), 0);
  assert.equal(getCommunityShelfStage(res.world, 'pond_mosaic', 3), 0);
  assert.equal(res.world.communityProjects?.['marigold_garland'], undefined,
    'marigold shelf absent in resulting state');
  assert.equal(res.world.communityProjects?.['pond_mosaic'], undefined,
    'pond shelf absent in resulting state');
});

test('S3-G §1.5: completion idempotency — completedDay > 0 always yields stageCount', () => {
  for (const id of PROJECT_IDS) {
    // Zero contributed but completed → stageCount (full visual state).
    const zeroContrib = {
      communityProjects: { [id]: { contributed: {}, completedDay: 1 } } as CommunityProjectsState,
    };
    assert.equal(
      getCommunityShelfStage(zeroContrib, id, 3),
      3,
      `${id}: completedDay>0 with zero contributed → stage 3`,
    );

    // Partial contributed + completed → stageCount (completion overrides partial).
    const partial = {
      communityProjects: {
        [id]: { contributed: { crabapple: 1 }, completedDay: 7 },
      } as CommunityProjectsState,
    };
    assert.equal(
      getCommunityShelfStage(partial, id, 3),
      3,
      `${id}: completedDay>0 with partial contributed → stage 3`,
    );

    // Over-contributed + completed → stageCount (never exceeds stageCount).
    const over = {
      communityProjects: {
        [id]: { contributed: { crabapple: 99 }, completedDay: 3 },
      } as CommunityProjectsState,
    };
    assert.equal(
      getCommunityShelfStage(over, id, 3),
      3,
      `${id}: completedDay>0 with over-contributed → stage 3 (never exceeds stageCount)`,
    );

    // isCommunityProjectComplete agrees.
    assert.equal(isCommunityProjectComplete(zeroContrib, id), true, `${id}: isCommunityProjectComplete true`);
  }

  // Custom stageCount: completedDay>0 yields that stageCount exactly.
  const custom = {
    communityProjects: {
      marigold_garland: { contributed: {}, completedDay: 5 },
    } as CommunityProjectsState,
  };
  assert.equal(getCommunityShelfStage(custom, 'marigold_garland', 5), 5);
  assert.equal(getCommunityShelfStage(custom, 'marigold_garland', 2), 2);
});

// ===========================================================================
// §2 — Keepsake rewards integrity
// ===========================================================================

test('S3-G §2.1: all 3 keepsakes exist in PERSONAL_ITEMS with the correct category/giftable/homeDisplayable', () => {
  for (const projectId of PROJECT_IDS) {
    const keepsakeId = KEEPSAKE_BY_PROJECT[projectId];
    // Registry-side: VALID_PERSONAL_ITEM_IDS includes it.
    assert.ok(
      VALID_PERSONAL_ITEM_IDS.has(keepsakeId),
      `${projectId}'s keepsake ${keepsakeId} is in VALID_PERSONAL_ITEM_IDS`,
    );
    // Lookup-side: PERSONAL_ITEM_MAP resolves it.
    const def = PERSONAL_ITEM_MAP[keepsakeId];
    assert.ok(def, `${keepsakeId} resolves via PERSONAL_ITEM_MAP`);
    assert.equal(def.category, 'keepsake', `${keepsakeId} category is 'keepsake'`);
    assert.equal(def.giftable, false, `${keepsakeId} is non-giftable (earned memento, never traded)`);
    assert.equal(def.homeDisplayable, 'shelf', `${keepsakeId} is shelf-displayable (oak cottage shelf)`);
    // PERSONAL_ITEMS array contains the def by identity (anti-fraud backstop).
    assert.ok(
      PERSONAL_ITEMS.some((p) => p.id === keepsakeId),
      `${keepsakeId} is in the PERSONAL_ITEMS array`,
    );
  }
});

test('S3-G §2.2: the 3 keepsake ids are distinct (no project shares a reward)', () => {
  const ids = PROJECT_IDS.map((p) => KEEPSAKE_BY_PROJECT[p]);
  assert.equal(new Set(ids).size, ids.length, 'keepsake ids are unique per project');
});

test('S3-G §2.3: each COMMUNITY_PROJECTS row rewards the correct keepsake per project', () => {
  for (const projectId of PROJECT_IDS) {
    const def = getCommunityProjectDef(projectId);
    assert.ok(def, `${projectId} def exists`);
    assert.equal(
      def!.keepsakeRewardItemId,
      KEEPSAKE_BY_PROJECT[projectId],
      `${projectId} rewards the expected keepsake`,
    );
  }
});

test('S3-G §2.4: completion burst grants the correct keepsake per project', () => {
  // Stage each project one item short of completion, then contribute the final
  // item. The completion burst must grant exactly one copy of that project's
  // keepsake into the satchel and add it to discoveredItemIds.
  function stageOneItemShort(projectId: string): { world: WorldState; finalItemId: PersonalItemId } {
    const def = getCommunityProjectDef(projectId)!;
    const [finalAccept, ...rest] = def.accepts;
    const contributed: Record<string, number> = {};
    for (const a of rest) contributed[a.itemId] = a.goal;
    contributed[finalAccept.itemId] = finalAccept.goal - 1;
    let world = createFreshWorldState();
    world = {
      ...world,
      inventory: { ...world.inventory, [finalAccept.itemId]: 1 },
      communityProjects: {
        ...world.communityProjects,
        [projectId]: { contributed, completedDay: 0 },
      },
    };
    return { world, finalItemId: finalAccept.itemId };
  }

  for (const projectId of PROJECT_IDS) {
    const { world, finalItemId } = stageOneItemShort(projectId);
    const keepsakeId = KEEPSAKE_BY_PROJECT[projectId];
    assert.equal(getItemCount(world.inventory, keepsakeId), 0, `${projectId}: keepsake absent before completion`);

    const res = contributeToCommunityProject(world, projectId, finalItemId, 1);
    assert.equal(res.ok, true, `${projectId}: final contribution succeeds`);
    assert.equal(res.completedNow, true, `${projectId}: final contribution completes the project`);

    assert.equal(
      getItemCount(res.world.inventory, keepsakeId),
      1,
      `${projectId}: ${keepsakeId} granted exactly once`,
    );
    assert.ok(
      res.world.discoveredItemIds.includes(keepsakeId),
      `${projectId}: ${keepsakeId} added to discoveredItemIds`,
    );

    // Input world must not have been mutated by the reducer.
    assert.equal(
      getItemCount(world.inventory, keepsakeId),
      0,
      `${projectId}: input world inventory unchanged`,
    );

    // Granted keepsake appears in the cottage-shelf filter (homeDisplayable: 'shelf').
    const shelfItems = getOwnedKeepsakeItems(res.world.inventory);
    const found = shelfItems.find((d) => d.id === keepsakeId);
    assert.ok(found, `${projectId}: ${keepsakeId} appears in getOwnedKeepsakeItems`);
    assert.equal(found!.homeDisplayable, 'shelf');
  }
});

test('S3-G §2.5: idempotency — pre-seeding the keepsake before completion does NOT double-grant', () => {
  // Hostile precondition: the player already owns the keepsake (hand-edited or
  // pre-seeded save) but the project is still open. The completion burst's
  // `getItemCount === 0` guard must refuse to grant a second copy.
  function stageOneItemShort(projectId: string): { world: WorldState; finalItemId: PersonalItemId } {
    const def = getCommunityProjectDef(projectId)!;
    const [finalAccept, ...rest] = def.accepts;
    const contributed: Record<string, number> = {};
    for (const a of rest) contributed[a.itemId] = a.goal;
    contributed[finalAccept.itemId] = finalAccept.goal - 1;
    let world = createFreshWorldState();
    world = {
      ...world,
      inventory: { ...world.inventory, [finalAccept.itemId]: 1 },
      communityProjects: {
        ...world.communityProjects,
        [projectId]: { contributed, completedDay: 0 },
      },
    };
    return { world, finalItemId: finalAccept.itemId };
  }

  for (const projectId of PROJECT_IDS) {
    const { world, finalItemId } = stageOneItemShort(projectId);
    const keepsakeId = KEEPSAKE_BY_PROJECT[projectId];
    // Pre-seed the keepsake.
    const preSeeded: WorldState = {
      ...world,
      inventory: { ...world.inventory, [keepsakeId]: 1 },
      discoveredItemIds: [...new Set([...world.discoveredItemIds, keepsakeId])],
    };
    assert.equal(
      getItemCount(preSeeded.inventory, keepsakeId),
      1,
      `${projectId}: precondition — keepsake already owned`,
    );

    const res = contributeToCommunityProject(preSeeded, projectId, finalItemId, 1);
    assert.equal(res.ok, true, `${projectId}: final contribution still succeeds`);
    assert.equal(res.completedNow, true, `${projectId}: project still completes`);
    assert.equal(
      getItemCount(res.world.inventory, keepsakeId),
      1,
      `${projectId}: idempotent guard refuses to grant a second copy of ${keepsakeId}`,
    );
  }
});

// ===========================================================================
// §3 — Dialogue integrity
// ===========================================================================

test('S3-G §3.1: the 3 community echo topics exist in the golden snapshot', () => {
  const goldenPath = new URL('../../scripts/dialogue-topics-golden.json', import.meta.url);
  const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as {
    count: number;
    topics: Array<{ id: string; residentId: string; category: string; priority: number }>;
  };
  assert.equal(golden.count, golden.topics.length, 'golden internally consistent');

  for (const id of ECHO_TOPIC_IDS) {
    const g = golden.topics.find((t) => t.id === id);
    assert.ok(g, `${id} present in golden snapshot`);
    assert.equal(g!.residentId, 'any', `${id} is resident-agnostic`);
    assert.equal(g!.category, 'event_reaction', `${id} sits in the event_reaction band`);
  }
});

test('S3-G §3.2: shared_community tag is correctly written (not "n") on both witness and participant memories', () => {
  // The SC-A audit brief flagged a suspected bug: community.ts comments
  // reference `shared_community` but the audit claimed the actual `tag:` value
  // written was `'n'`. This baseline pins the truth: the reducer writes the
  // literal string 'shared_community' on BOTH witness and participant memories.
  function withSatchel(world: WorldState, items: Partial<Record<PersonalItemId, number>>): WorldState {
    return { ...world, inventory: { ...world.inventory, ...items } };
  }
  function withWitnessNearby(world: WorldState, id: string, distance = 1.2): WorldState {
    return {
      ...world,
      npcRuntime: {
        ...world.npcRuntime,
        [id]: {
          ...world.npcRuntime[id as keyof typeof world.npcRuntime],
          position: { x: world.playerPos.x + distance, z: world.playerPos.z },
        },
      },
    };
  }

  // Witness memory — partial contribution.
  let world1 = createFreshWorldState();
  world1 = withSatchel(world1, { meadow_posy: 2 });
  world1 = withWitnessNearby(world1, 'pip');
  const partial = contributeToCommunityProject(world1, 'marigold_garland', 'meadow_posy', 1);
  const witnessMem = partial.world.npcMemories.pip.find(
    (m) => m.eventId.startsWith('community_marigold_garland_d'),
  );
  assert.ok(witnessMem, 'witness memory recorded');
  assert.equal(
    witnessMem!.tag,
    'shared_community',
    `witness memory tag is the literal 'shared_community' (not 'n')`,
  );
  assert.equal(witnessMem!.sourceKind, 'witness');

  // Participant memory — completion burst.
  let world2 = createFreshWorldState();
  world2 = withSatchel(world2, { wild_honey: 1 });
  world2 = withWitnessNearby(world2, 'pip');
  world2 = {
    ...world2,
    communityProjects: {
      ...world2.communityProjects,
      orchard_lanterns: { contributed: { crabapple: 4, wild_honey: 1 }, completedDay: 0 },
    },
  };
  const completed = contributeToCommunityProject(world2, 'orchard_lanterns', 'wild_honey', 1);
  const participantMem = completed.world.npcMemories.rowan.find(
    (m) => m.eventId === `community_orchard_lanterns_complete_d${world2.day}`,
  );
  assert.ok(participantMem, 'participant memory recorded for thanksFrom Rowan');
  assert.equal(
    participantMem!.tag,
    'shared_community',
    `participant memory tag is the literal 'shared_community' (not 'n')`,
  );
  assert.equal(participantMem!.sourceKind, 'participant');

  // The completion event's summaryTag uses the documented prefix.
  const completionEvent = completed.world.worldEvents.find(
    (e) => e.summaryTag === 'community_orchard_lanterns_complete',
  );
  assert.ok(completionEvent, 'completion event recorded');
  assert.equal(completionEvent!.kind, 'player_help');
});

test('S3-G §3.3: dialogue registry count matches the golden snapshot', () => {
  const goldenPath = new URL('../../scripts/dialogue-topics-golden.json', import.meta.url);
  const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as {
    count: number;
    topics: Array<{ id: string }>;
  };
  assert.equal(
    DIALOGUE_TOPICS.length,
    golden.count,
    `registry count matches golden: registry=${DIALOGUE_TOPICS.length} golden=${golden.count}`,
  );
  assert.equal(golden.count, golden.topics.length, 'golden internally consistent');
  // Stage 3 Photography (`PHOTO_ECHO_TOPICS`, 2 topics) sits right after
  // `COMMUNITY_ECHO_TOPICS` (3 topics), and LR-4 `TEACHING_TOPICS` (1 topic)
  // occupies the append-only tail (`slice(-1)`). Verify exact contiguous order.
  const tailTeaching = DIALOGUE_TOPICS.slice(-1).map((t) => t.id);
  assert.deepEqual(
    tailTeaching,
    ['teaching_nora_featured_reading'],
    'LR-4 teaching topic occupies the append-only tail',
  );
  const tailPhoto = DIALOGUE_TOPICS.slice(-3, -1).map((t) => t.id);
  assert.deepEqual(
    tailPhoto,
    ['everyday_photo_witness_echo', 'everyday_photo_noticer'],
    'photo echo topics remain contiguous immediately before the LR-4 teaching tail',
  );
  const tailCommunity = DIALOGUE_TOPICS.slice(-6, -3).map((t) => t.id);
  assert.deepEqual(
    tailCommunity,
    [...ECHO_TOPIC_IDS],
    'community echo topics remain contiguous immediately before the photo echoes',
  );
});

// ===========================================================================
// §4 — Scene rig integrity
// ===========================================================================

test('S3-G §4.1: all 3 builder files exist and export the expected interface', async () => {
  // Dynamic imports verify the builder modules resolve and export the expected
  // rig factory + interface. The interface contract is: each rig exposes a
  // `group: THREE.Group` and a `set<Name>Stage(stage: number): void` method.
  const plazaGarlandMod = await import('../scene/builders/plazaGarland');
  const orchardLanternsMod = await import('../scene/builders/orchardLanterns');
  const pondMosaicMod = await import('../scene/builders/pondMosaic');

  assert.ok(plazaGarlandMod.buildPlazaGarlandRig, 'plazaGarland.ts exports buildPlazaGarlandRig');
  assert.ok(orchardLanternsMod.buildOrchardLanternsRig, 'orchardLanterns.ts exports buildOrchardLanternsRig');
  assert.ok(pondMosaicMod.buildPondMosaicRig, 'pondMosaic.ts exports buildPondMosaicRig');

  // Build a minimal palette to construct each rig and verify the interface.
  const standard = (color: string, roughness = 0.8, metalness = 0.0): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const palette = {
    standard,
    get: (_key: string, opts: THREE.MeshStandardMaterialParameters) =>
      new THREE.MeshStandardMaterial(opts),
  };

  const garland = plazaGarlandMod.buildPlazaGarlandRig(palette as any);
  assert.ok(garland.group instanceof THREE.Group, 'PlazaGarlandRig.group is a THREE.Group');
  assert.equal(typeof garland.setGarlandStage, 'function', 'PlazaGarlandRig exposes setGarlandStage');

  const lanterns = orchardLanternsMod.buildOrchardLanternsRig(palette as any);
  assert.ok(lanterns.group instanceof THREE.Group, 'OrchardLanternsRig.group is a THREE.Group');
  assert.equal(typeof lanterns.setLanternStage, 'function', 'OrchardLanternsRig exposes setLanternStage');

  const mosaic = pondMosaicMod.buildPondMosaicRig(palette as any);
  assert.ok(mosaic.group instanceof THREE.Group, 'PondMosaicRig.group is a THREE.Group');
  assert.equal(typeof mosaic.setMosaicStage, 'function', 'PondMosaicRig exposes setMosaicStage');

  // setStage is idempotent across 0/1/2/3 and never throws.
  for (const stage of [0, 1, 2, 3]) {
    garland.setGarlandStage(stage);
    lanterns.setLanternStage(stage);
    mosaic.setMosaicStage(stage);
  }
});

test('S3-G §4.2: EnvironmentRendererDeps includes all 3 rigs as optional fields', () => {
  // Compile-time contract: the EnvironmentRendererDeps interface must declare
  // garlandRig, orchardRig2 (note: orchardRig2, NOT orchardRig — the latter is
  // the crown-sway orchard rig), and pondMosaicRig as optional rig fields.
  // We verify this structurally by constructing a deps object that exercises
  // each field name.
  const deps: EnvironmentRendererDeps = {
    garlandRig: { setGarlandStage: () => {} },
    orchardRig2: { setLanternStage: () => {} },
    pondMosaicRig: { setMosaicStage: () => {} },
  } as unknown as EnvironmentRendererDeps;
  assert.equal(typeof deps.garlandRig?.setGarlandStage, 'function');
  assert.equal(typeof deps.orchardRig2?.setLanternStage, 'function');
  assert.equal(typeof deps.pondMosaicRig?.setMosaicStage, 'function');
});

test('S3-G §4.3: renderer calls to the 3 rigs are OUTSIDE the wildsRig guard (H1 fix)', () => {
  // H1 fix: the three community rig calls live OUTSIDE the
  // `if (this.deps.wildsRig) { ... }` block so they continue to drive their
  // rigs even when wildsRig is absent (Build 10 / non-wilds scenes).
  //
  // Strategy: stage a world where every project sits at a non-zero stage,
  // construct a minimal deps WITHOUT wildsRig, and confirm each rig's
  // setStage callback receives the expected stage.
  const garlandCalls: number[] = [];
  const lanternCalls: number[] = [];
  const mosaicCalls: number[] = [];

  function mockRig(sink: number[]): { setStage: (s: number) => void } {
    return { setStage: (s) => sink.push(s) };
  }

  function buildMinimalDeps(overrides: Partial<EnvironmentRendererDeps>): EnvironmentRendererDeps {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#DCEBF2');
    const groundMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF' });
    const groveBaseMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF' });
    const groveTopMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF' });
    const hemiLight = new THREE.HemisphereLight('#B5D7EB', '#7A664E', 0.54);
    const sunLight = new THREE.DirectionalLight('#FFF1D0', 1.52);
    const windowMat = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.22 });
    const lanternMat = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.15 });
    const protoLanternMat = new THREE.MeshStandardMaterial({ emissiveIntensity: 0.22 });

    return {
      scene,
      groundMat,
      groveRig: { group: new THREE.Group(), crownBaseMat: groveBaseMat, crownTopMat: groveTopMat },
      hemiLight,
      sunLight,
      windowMaterials: [windowMat],
      lanternMat,
      prototypeLanternMats: [protoLanternMat],
      flowerGroups: [new THREE.Group(), new THREE.Group(), new THREE.Group()],
      gazeboRig: {
        group: new THREE.Group(),
        bellPivot: new THREE.Group(),
        bellMesh: new THREE.Mesh(),
        clapperMesh: new THREE.Mesh(),
        ivyGroup: new THREE.Group(),
        ribbonMesh: new THREE.Mesh(),
      },
      fountainRig: { group: new THREE.Group(), waterMesh: new THREE.Mesh(), spoutParticles: new THREE.Group() },
      bakeryTablesGroup: new THREE.Group(),
      festoonGroup: new THREE.Group(),
      noticeboardRig: { group: new THREE.Group(), flyers: [new THREE.Mesh(), new THREE.Mesh(), new THREE.Mesh()] },
      oakGlint: new THREE.Mesh(),
      mbFlag: new THREE.Mesh(),
      bellSwingVelRef: { current: 0 },
      isSoftwareGl: true,
      ...overrides,
    };
  }

  const deps = buildMinimalDeps({
    garlandRig: { setGarlandStage: mockRig(garlandCalls).setStage },
    orchardRig2: { setLanternStage: mockRig(lanternCalls).setStage },
    pondMosaicRig: { setMosaicStage: mockRig(mosaicCalls).setStage },
  });
  assert.equal(deps.wildsRig, undefined, 'wildsRig must be absent for the H1 test');

  const controller = new EnvironmentVisualController(deps);

  const fresh = createFreshWorldState();
  const world: WorldState = {
    ...fresh,
    communityProjects: {
      marigold_garland: { contributed: { meadow_posy: 3, chamomile_blossom: 3, lavender_sprig: 2 }, completedDay: 0 }, // stage 3
      orchard_lanterns: { contributed: { crabapple: 3 }, completedDay: 0 }, // stage 2
      pond_mosaic: { contributed: { smooth_river_glass: 1 }, completedDay: 0 }, // stage 1
    } as CommunityProjectsState,
  };
  const composed = composeEnvironmentState(world);
  controller.update(composed, world, { x: 0, z: 0 }, 0, 0);

  assert.ok(
    garlandCalls.includes(3),
    `garland rig must receive stage 3 (no wildsRig present); calls=${garlandCalls.join(',')}`,
  );
  assert.ok(
    lanternCalls.includes(2),
    `lantern rig must receive stage 2 (no wildsRig present); calls=${lanternCalls.join(',')}`,
  );
  assert.ok(
    mosaicCalls.includes(1),
    `mosaic rig must receive stage 1 (no wildsRig present); calls=${mosaicCalls.join(',')}`,
  );
});

// ===========================================================================
// §5 — Persistence integrity
// ===========================================================================

test('S3-G §5.1: community projects state survives a JSON round-trip', () => {
  const fresh = createFreshWorldState();
  const world: WorldState = {
    ...fresh,
    communityProjects: {
      marigold_garland: { contributed: { meadow_posy: 3, chamomile_blossom: 1 }, completedDay: 0 }, // stage 2
      orchard_lanterns: { contributed: { crabapple: 4, wild_honey: 2 }, completedDay: 7 }, // completed
      pond_mosaic: { contributed: { smooth_river_glass: 1 }, completedDay: 0 }, // stage 1
    },
  };

  const json = serializeWorldState(world);
  const reloaded = deserializeWorldState(json).state;

  assert.equal(reloaded.schemaVersion, world.schemaVersion, 'schema version preserved');
  // Every project survived.
  for (const id of PROJECT_IDS) {
    const orig = world.communityProjects[id];
    const rt = reloaded.communityProjects[id];
    assert.ok(rt, `${id}: progress slice survives round-trip`);
    assert.equal(rt!.completedDay, orig.completedDay, `${id}: completedDay preserved`);
    assert.deepEqual(
      rt!.contributed,
      orig.contributed,
      `${id}: contributed map preserved`,
    );
  }
});

test('S3-G §5.2: keepsake items survive a JSON round-trip', () => {
  // Grant all three keepsakes by seeding the inventory directly, then verify
  // each survives serialize → deserialize with count and discovery intact.
  const fresh = createFreshWorldState();
  const keepsakeIds = PROJECT_IDS.map((p) => KEEPSAKE_BY_PROJECT[p]);
  const world: WorldState = {
    ...fresh,
    inventory: { ...fresh.inventory, ...Object.fromEntries(keepsakeIds.map((k) => [k, 1])) },
    discoveredItemIds: [...new Set([...fresh.discoveredItemIds, ...keepsakeIds])],
  };

  for (const k of keepsakeIds) {
    assert.equal(getItemCount(world.inventory, k), 1, `precondition: ${k} present`);
  }

  const json = serializeWorldState(world);
  const reloaded = deserializeWorldState(json).state;

  for (const k of keepsakeIds) {
    assert.equal(
      getItemCount(reloaded.inventory, k),
      1,
      `${k} count survives save/load`,
    );
    assert.ok(
      reloaded.discoveredItemIds.includes(k),
      `${k} stays in discoveredItemIds after save/load`,
    );
  }
});

test('S3-G §5.3: stage derivation is deterministic after a JSON round-trip', () => {
  const fresh = createFreshWorldState();
  const world: WorldState = {
    ...fresh,
    communityProjects: {
      marigold_garland: { contributed: { meadow_posy: 3, chamomile_blossom: 1 }, completedDay: 0 }, // stage 2
      orchard_lanterns: { contributed: { crabapple: 4, wild_honey: 2 }, completedDay: 7 }, // stage 3 (completed)
      pond_mosaic: { contributed: { smooth_river_glass: 1 }, completedDay: 0 }, // stage 1
    },
  };

  const stagesBefore = PROJECT_IDS.map((id) => getCommunityShelfStage(world, id, 3));

  // Round-trip through the real serializer (sanitizer + JSON).
  const reloaded = deserializeWorldState(serializeWorldState(world)).state;

  const stagesAfter = PROJECT_IDS.map((id) => getCommunityShelfStage(reloaded, id, 3));

  // Stages must be identical before and after the round-trip.
  assert.deepEqual(
    stagesAfter,
    stagesBefore,
    `stage derivation must be deterministic across save/load: before=${stagesBefore.join(',')} after=${stagesAfter.join(',')}`,
  );

  // And the expected absolute stages (regression safety net).
  assert.deepEqual(stagesAfter, [2, 3, 1]);

  // Composed worldEchoes must also agree (revision + echo fields stable).
  const composedBefore = composeEnvironmentState(world);
  const composedAfter = composeEnvironmentState(reloaded);
  assert.equal(
    composedAfter.revision,
    composedBefore.revision,
    'composed revision deterministic across save/load',
  );
  assert.equal(composedAfter.worldEchoes.marigoldGarlandStage, 2);
  assert.equal(composedAfter.worldEchoes.orchardLanternsStage, 3);
  assert.equal(composedAfter.worldEchoes.pondMosaicStage, 1);
});
