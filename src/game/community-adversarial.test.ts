// src/game/community-adversarial.test.ts
// Agent D (SC-D) — Independent adversarial QA audit of the Stage 2 Community
// Projects system. Read-only audit; this file writes tests only.
//
// Audit surface:
//   1. Cross-project independence        (community.ts getCommunityShelfStage)
//   2. Echo bit collision                (environment.ts revision mask bits 0-11)
//   3. Renderer independence             (environmentRenderer.ts H1 fix: rigs
//      outside the wildsRig guard)
//   4. Corrupted data                    (NaN, negative completedDay, unknown ids)
//   5. Over-contribution clamp           (99 of one item must not inflate stage)
//   6. Determinism                       (same state → same stage, 10 calls)
//   7. Save/reload round-trip            (JSON.parse(JSON.stringify) preserves stage)
//   8. Completion idempotency            (completedDay > 0 → stageCount regardless)
//   9. Threshold boundaries              (0→0, 1→1, ceil(goal/2)→2, goal→3)

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { composeEnvironmentState } from './environment';
import { createFreshWorldState } from './storage';
import {
  COMMUNITY_PROJECTS,
  contributeToCommunityProject,
  getCommunityShelfStage,
  sanitizeCommunityProjectsState,
} from './community';
import { getCommunityProjectStage } from './communityProjects';
import type { CommunityProjectsState, WorldState } from './types';
import { EnvironmentVisualController } from '../scene/environmentRenderer';
import type { EnvironmentRendererDeps } from '../scene/environmentRenderer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ShelfWorld = Pick<WorldState, 'communityProjects'>;

function shelfWorld(
  projectId: string,
  contributed: Record<string, number>,
  completedDay = 0,
): ShelfWorld {
  return {
    communityProjects: {
      [projectId]: { contributed, completedDay },
    } as CommunityProjectsState,
  };
}

/** Merge two shelf worlds so multiple projects coexist in one state. */
function mergeShelves(...shelves: ShelfWorld[]): ShelfWorld {
  const communityProjects: CommunityProjectsState = {};
  for (const s of shelves) {
    Object.assign(communityProjects, s.communityProjects);
  }
  return { communityProjects };
}

// ---------------------------------------------------------------------------
// 1. Cross-project independence — contributing to A doesn't affect B's stage
// ---------------------------------------------------------------------------

test('AD-1 cross-project independence: marigold contributions do not affect orchard/pond stages', () => {
  const world = mergeShelves(
    shelfWorld('marigold_garland', { meadow_posy: 3, chamomile_blossom: 1 }), // stage 2
    shelfWorld('orchard_lanterns', {}), // stage 0
    shelfWorld('pond_mosaic', {}), // stage 0
  );

  assert.equal(getCommunityShelfStage(world, 'marigold_garland', 3), 2);
  assert.equal(getCommunityShelfStage(world, 'orchard_lanterns', 3), 0);
  assert.equal(getCommunityShelfStage(world, 'pond_mosaic', 3), 0);
});

test('AD-1 cross-project independence: each project tracks its own contributions independently', () => {
  const world = mergeShelves(
    shelfWorld('marigold_garland', { meadow_posy: 1 }), // stage 1
    shelfWorld('orchard_lanterns', { crabapple: 4, wild_honey: 2 }), // stage 3 (complete)
    shelfWorld('pond_mosaic', { smooth_river_glass: 2, pressed_fern: 1 }), // stage 2
  );

  assert.equal(getCommunityShelfStage(world, 'marigold_garland', 3), 1);
  assert.equal(getCommunityShelfStage(world, 'orchard_lanterns', 3), 3);
  assert.equal(getCommunityShelfStage(world, 'pond_mosaic', 3), 2);
});

test('AD-1 cross-project independence: contributing to orchard via reducer leaves marigold untouched', () => {
  let world = createFreshWorldState();
  world = {
    ...world,
    inventory: { ...world.inventory, crabapple: 5 },
  };

  // Contribute one crabapple to orchard_lanterns.
  const result = contributeToCommunityProject(world, 'orchard_lanterns', 'crabapple', 1);
  assert.equal(result.ok, true);

  // Orchard should now be at stage 1 (1 of 6 contributed).
  assert.equal(getCommunityShelfStage(result.world, 'orchard_lanterns', 3), 1);
  // Marigold and pond must remain untouched at stage 0.
  assert.equal(getCommunityShelfStage(result.world, 'marigold_garland', 3), 0);
  assert.equal(getCommunityShelfStage(result.world, 'pond_mosaic', 3), 0);
  // The marigold shelf must not exist in the resulting state at all.
  assert.equal(result.world.communityProjects?.['marigold_garland'], undefined);
});

// ---------------------------------------------------------------------------
// 2. Echo bit collision — all 6 echo fields coexist without revision collision
//    Bits: 0-2 pebble · 3 posy · 4-5 sorrel · 6-7 marigold · 8-9 orchard · 10-11 pond
// ---------------------------------------------------------------------------

function composeWith(overrides: Partial<WorldState>): ReturnType<typeof composeEnvironmentState> {
  const base = createFreshWorldState();
  return composeEnvironmentState({ ...base, ...overrides });
}

test('AD-2 echo bit collision: each echo field maps independently to worldEchoes', () => {
  // Set ALL six echo fields to distinct non-zero values simultaneously.
  const composed = composeWith({
    sideFlags: {
      wellPebblesCount: 5, // bits 0-2
      posyPickedDay: 1, // bit 3 (matches world.day=1)
      project_sorrel_garden_stage: 2, // bits 4-5
    },
    communityProjects: {
      marigold_garland: { contributed: { meadow_posy: 3, chamomile_blossom: 3, lavender_sprig: 2 }, completedDay: 0 }, // stage 3 → bits 6-7
      orchard_lanterns: { contributed: { crabapple: 3 }, completedDay: 0 }, // stage 2 → bits 8-9
      pond_mosaic: { contributed: { smooth_river_glass: 1 }, completedDay: 0 }, // stage 1 → bits 10-11
    } as CommunityProjectsState,
  });

  // Every echo field must be preserved exactly — no cross-contamination.
  assert.equal(composed.worldEchoes.wellPebbleStack, 5);
  assert.equal(composed.worldEchoes.posyBankPickedToday, true);
  assert.equal(composed.worldEchoes.sorrelGardenStage, 2);
  assert.equal(composed.worldEchoes.marigoldGarlandStage, 3);
  assert.equal(composed.worldEchoes.orchardLanternsStage, 2);
  assert.equal(composed.worldEchoes.pondMosaicStage, 1);
});

test('AD-2 echo bit collision: revision deltas are additive (no bit overlap)', () => {
  // Base state: all echoes at 0.
  const base = composeWith({});

  // State with ONLY marigold at stage 3 (bits 6-7 = 11).
  const r1 = composeWith({
    communityProjects: {
      marigold_garland: { contributed: { meadow_posy: 3, chamomile_blossom: 3, lavender_sprig: 2 }, completedDay: 0 },
    } as CommunityProjectsState,
  });

  // State with ONLY orchard at stage 3 (bits 8-9 = 11).
  const r2 = composeWith({
    communityProjects: {
      orchard_lanterns: { contributed: { crabapple: 4, wild_honey: 2 }, completedDay: 0 },
    } as CommunityProjectsState,
  });

  // State with ONLY pond at stage 3 (bits 10-11 = 11).
  const r3 = composeWith({
    communityProjects: {
      pond_mosaic: { contributed: { smooth_river_glass: 2, pressed_fern: 2, heron_feather: 1, cedar_shaving_rose: 1 }, completedDay: 0 },
    } as CommunityProjectsState,
  });

  // State with all three at stage 3 simultaneously.
  const rAll = composeWith({
    communityProjects: {
      marigold_garland: { contributed: { meadow_posy: 3, chamomile_blossom: 3, lavender_sprig: 2 }, completedDay: 0 },
      orchard_lanterns: { contributed: { crabapple: 4, wild_honey: 2 }, completedDay: 0 },
      pond_mosaic: { contributed: { smooth_river_glass: 2, pressed_fern: 2, heron_feather: 1, cedar_shaving_rose: 1 }, completedDay: 0 },
    } as CommunityProjectsState,
  });

  const d1 = r1.revision - base.revision;
  const d2 = r2.revision - base.revision;
  const d3 = r3.revision - base.revision;
  const dAll = rAll.revision - base.revision;

  // If bits don't collide, the combined delta equals the sum of individual deltas.
  // marigold stage 3 → bits 6-7 → 3 << 6 = 192
  // orchard stage 3  → bits 8-9 → 3 << 8 = 768
  // pond stage 3     → bits 10-11 → 3 << 10 = 3072
  // Each multiplied by 2^33 (8589934592).
  assert.equal(d1, 192 * 8589934592, 'marigold stage 3 delta = 3<<6 * 2^33');
  assert.equal(d2, 768 * 8589934592, 'orchard stage 3 delta = 3<<8 * 2^33');
  assert.equal(d3, 3072 * 8589934592, 'pond stage 3 delta = 3<<10 * 2^33');
  assert.equal(dAll, d1 + d2 + d3, 'combined delta = sum of individual deltas (no bit collision)');
});

test('AD-2 echo bit collision: pond stage 3 does not bleed into bits 0-9', () => {
  const base = composeWith({});
  const pondOnly = composeWith({
    communityProjects: {
      pond_mosaic: { contributed: { smooth_river_glass: 2, pressed_fern: 2, heron_feather: 1, cedar_shaving_rose: 1 }, completedDay: 0 },
    } as CommunityProjectsState,
  });

  const delta = pondOnly.revision - base.revision;
  // pond stage 3 → bits 10-11 → 3 << 10 = 3072, scaled by 2^33.
  assert.equal(delta, 3072 * 8589934592);
  // Bits 0-9 must be zero in the delta: (delta / 2^33) & 0x3FF must equal 3072 & 0x3FF = 0.
  const echoMask = Number(delta / 8589934592);
  assert.equal(echoMask & 0x3FF, 0, 'low 10 bits (pebble/posy/sorrel/marigold/orchard) untouched by pond');
  assert.equal(echoMask & 0xC00, 0xC00, 'bits 10-11 set to 11 (pond stage 3)');
});

// ---------------------------------------------------------------------------
// 3. Renderer independence — garlandRig updates without wildsRig (H1 fix)
// ---------------------------------------------------------------------------

/** Minimal mock rig that records every setStage call. */
function mockRig(name: string): { calls: number[]; setStage: (s: number) => void } {
  const calls: number[] = [];
  return {
    calls,
    setStage: (s: number) => { calls.push(s); },
  };
}

/** Build a minimal but valid EnvironmentRendererDeps fixture without wildsRig. */
function buildMinimalDeps(overrides: Partial<EnvironmentRendererDeps> = {}): EnvironmentRendererDeps {
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

test('AD-3 renderer independence (H1 fix): garland/lantern/mosaic rigs update WITHOUT wildsRig present', () => {
  const garland = mockRig('garland');
  const lantern = mockRig('lantern');
  const mosaic = mockRig('mosaic');

  // NO wildsRig in deps — the H1 fix must keep the three rigs working.
  const deps = buildMinimalDeps({
    garlandRig: { setGarlandStage: garland.setStage },
    orchardRig2: { setLanternStage: lantern.setStage },
    pondMosaicRig: { setMosaicStage: mosaic.setStage },
  });
  assert.equal(deps.wildsRig, undefined, 'wildsRig must be absent for this test');

  const controller = new EnvironmentVisualController(deps);

  const world = createFreshWorldState();
  // Drive all three community stages to non-zero values.
  const worldWith = {
    ...world,
    communityProjects: {
      marigold_garland: { contributed: { meadow_posy: 3, chamomile_blossom: 3, lavender_sprig: 2 }, completedDay: 0 }, // stage 3
      orchard_lanterns: { contributed: { crabapple: 3 }, completedDay: 0 }, // stage 2
      pond_mosaic: { contributed: { smooth_river_glass: 1 }, completedDay: 0 }, // stage 1
    } as CommunityProjectsState,
  };

  const composed = composeEnvironmentState(worldWith);
  controller.update(composed, worldWith, { x: 0, z: 0 }, 0, 0);

  // Each rig must have received its stage despite wildsRig being absent.
  assert.ok(garland.calls.includes(3), `garland rig must receive stage 3, got calls=${garland.calls.join(',')}`);
  assert.ok(lantern.calls.includes(2), `lantern rig must receive stage 2, got calls=${lantern.calls.join(',')}`);
  assert.ok(mosaic.calls.includes(1), `mosaic rig must receive stage 1, got calls=${mosaic.calls.join(',')}`);
});

test('AD-3 renderer independence: rigs receive stage 0 when communityProjects absent (no crash without wildsRig)', () => {
  const garland = mockRig('garland');
  const lantern = mockRig('lantern');
  const mosaic = mockRig('mosaic');

  const deps = buildMinimalDeps({
    garlandRig: { setGarlandStage: garland.setStage },
    orchardRig2: { setLanternStage: lantern.setStage },
    pondMosaicRig: { setMosaicStage: mosaic.setStage },
  });
  const controller = new EnvironmentVisualController(deps);

  const world = createFreshWorldState();
  const composed = composeEnvironmentState(world);
  controller.update(composed, world, { x: 0, z: 0 }, 0, 0);

  assert.ok(garland.calls.includes(0));
  assert.ok(lantern.calls.includes(0));
  assert.ok(mosaic.calls.includes(0));
});

test('AD-3 renderer independence: rigs still receive stages WITH wildsRig present (no regression)', () => {
  const garland = mockRig('garland');
  const lantern = mockRig('lantern');
  const mosaic = mockRig('mosaic');
  const wildsCalls: string[] = [];

  const deps = buildMinimalDeps({
    garlandRig: { setGarlandStage: garland.setStage },
    orchardRig2: { setLanternStage: lantern.setStage },
    pondMosaicRig: { setMosaicStage: mosaic.setStage },
    // Minimal mock wildsRig satisfying the structural interface used by the renderer.
    wildsRig: {
      moundMat: new THREE.MeshStandardMaterial({ color: '#FFFFFF' }),
      crownBaseMat: new THREE.MeshStandardMaterial({ color: '#FFFFFF' }),
      crownTopMat: new THREE.MeshStandardMaterial({ color: '#FFFFFF' }),
      baseColors: { mound: new THREE.Color('#FFFFFF'), crownBase: new THREE.Color('#FFFFFF'), crownTop: new THREE.Color('#FFFFFF') },
      setWellPebbleStack: (n: number) => { wildsCalls.push(`pebble:${n}`); },
      setPosyBankPickedToday: (b: boolean) => { wildsCalls.push(`posy:${b}`); },
      setGardenStage: (s: number) => { wildsCalls.push(`garden:${s}`); },
    } as unknown as EnvironmentRendererDeps['wildsRig'],
  });
  const controller = new EnvironmentVisualController(deps);

  const world = createFreshWorldState();
  const worldWith = {
    ...world,
    communityProjects: {
      marigold_garland: { contributed: { meadow_posy: 3, chamomile_blossom: 3, lavender_sprig: 2 }, completedDay: 0 },
    } as CommunityProjectsState,
  };
  const composed = composeEnvironmentState(worldWith);
  controller.update(composed, worldWith, { x: 0, z: 0 }, 0, 0);

  assert.ok(garland.calls.includes(3), 'garland rig must still receive stage 3 with wildsRig present');
  assert.ok(wildsCalls.some((c) => c.startsWith('garden:')), 'wildsRig garden stage also called');
});

// ---------------------------------------------------------------------------
// 4. Corrupted data — NaN contributed, negative completedDay, unknown project IDs
// ---------------------------------------------------------------------------

test('AD-4 corrupted data: NaN contributed count should NOT silently produce stage 1', () => {
  // A NaN-tainted contributed value is adversarial corruption. The honest answer
  // is stage 0 (treat as no valid contribution) — but getCommunityShelfStage does
  // NOT sanitize the contributed sub-map, so NaN propagates through Math.min/Math.floor
  // into the threshold comparisons, all of which return false against NaN, landing
  // on the final `return 1` branch. This silently reports stage 1 for corrupted data.
  const world = shelfWorld('marigold_garland', { meadow_posy: NaN });

  const stage = getCommunityShelfStage(world, 'marigold_garland', 3);

  // Document the defect: NaN currently yields stage 1 (silent under-report of corruption).
  // If this ever returns 0, the defect has been fixed — update this assertion.
  assert.equal(stage, 0, 'D-1 fix: NaN contributed now yields stage 0 via sanitized accessor');
});

test('AD-4 corrupted data: NaN completedDay silently falls through to contribution math', () => {
  // getCommunityShelfStage reads progress.completedDay directly without the
  // Number.isFinite / Math.max(0,...) sanitization that getCommunityProjectProgress applies.
  // NaN > 0 is false, so it falls through to the contribution branch.
  const world = shelfWorld('marigold_garland', { meadow_posy: 3, chamomile_blossom: 3, lavender_sprig: 2 }, NaN);

  const stage = getCommunityShelfStage(world, 'marigold_garland', 3);

  // If completedDay were NaN, the honest answer is stage 3 (treat as completed) or 0
  // (treat as corrupted). Currently it falls through to contribution math → stage 3
  // because contributed totals reach goal. This masks the corruption.
  assert.equal(stage, 3, 'NaN completedDay falls through to contribution math (contributed=8 → stage 3)');
});

test('AD-4 corrupted data: negative completedDay treated as not-completed (falls through)', () => {
  // Negative completedDay is invalid. getCommunityShelfStage's `> 0` check excludes it,
  // falling through to contribution math. This is arguably safe but inconsistent with
  // getCommunityProjectProgress which clamps to 0.
  const world = shelfWorld('marigold_garland', { meadow_posy: 1 }, -5);

  const stage = getCommunityShelfStage(world, 'marigold_garland', 3);
  // contributed=1 → stage 1 (contribution math runs despite invalid completedDay).
  assert.equal(stage, 1);
});

test('AD-4 corrupted data: unknown project ID returns stage 0', () => {
  const world = shelfWorld('marigold_garland', { meadow_posy: 3 });
  assert.equal(getCommunityShelfStage(world, 'totally_fake_project', 3), 0);
});

test('AD-4 corrupted data: non-accepted item id in contributed is ignored by stage derivation', () => {
  // An unknown item id in contributed must not inflate the total.
  const world = shelfWorld('marigold_garland', { meadow_posy: 1, fake_item: 99 });
  // Only meadow_posy=1 counts (fake_item is not in accepts list, so the reducer skips it).
  assert.equal(getCommunityShelfStage(world, 'marigold_garland', 3), 1);
});

test('AD-4 corrupted data: sanitizer drops NaN contributed and clamps negative completedDay', () => {
  // The save-time sanitizer IS robust — it drops NaN counts and clamps negative completedDay.
  // This test confirms the sanitizer's contract (contrast with getCommunityShelfStage which bypasses it).
  const warnings: string[] = [];
  const sanitized = sanitizeCommunityProjectsState(
    {
      marigold_garland: { contributed: { meadow_posy: NaN, chamomile_blossom: -3, lavender_sprig: 2 }, completedDay: -5 },
    },
    warnings,
  );

  assert.deepEqual(sanitized.marigold_garland, { contributed: { lavender_sprig: 2 }, completedDay: 0 });
  // The sanitized state must now produce stage 1 (only lavender_sprig=2 counts toward goal 8).
  assert.equal(getCommunityShelfStage({ communityProjects: sanitized }, 'marigold_garland', 3), 1);
});

test('AD-4 corrupted data: unknown project id in raw state is dropped by sanitizer', () => {
  const warnings: string[] = [];
  const sanitized = sanitizeCommunityProjectsState(
    {
      fake_project: { contributed: { meadow_posy: 5 }, completedDay: 3 },
      marigold_garland: { contributed: { meadow_posy: 1 }, completedDay: 0 },
    },
    warnings,
  );

  assert.equal(sanitized['fake_project'], undefined);
  assert.equal(sanitized['marigold_garland']?.contributed?.meadow_posy, 1);
  assert.ok(warnings.some((w) => w.includes('fake_project')));
});

// ---------------------------------------------------------------------------
// 5. Over-contribution — 99 of one item must not inflate stage beyond goal share
// ---------------------------------------------------------------------------

test('AD-5 over-contribution: 99 of one item clamps to its goal, does not inflate total', () => {
  // marigold_garland: meadow_posy goal=3, total goal=8. Contributing 99 posies
  // should clamp to 3 (Math.min(a.goal, ...)), yielding total=3 → stage 1 (< ceil(8/2)=4).
  const world = shelfWorld('marigold_garland', { meadow_posy: 99 });
  assert.equal(getCommunityShelfStage(world, 'marigold_garland', 3), 1);
});

test('AD-5 over-contribution: 99 of every accepted item still yields stage 3 (not beyond)', () => {
  const world = shelfWorld('marigold_garland', {
    meadow_posy: 99,
    chamomile_blossom: 99,
    lavender_sprig: 99,
  });
  assert.equal(getCommunityShelfStage(world, 'marigold_garland', 3), 3);
  // Stage must never exceed stageCount even with massive over-contribution.
  assert.ok(getCommunityShelfStage(world, 'marigold_garland', 3) <= 3);
});

test('AD-5 over-contribution: 99 of one item to orchard does not complete the project', () => {
  // orchard_lanterns: crabapple goal=4, wild_honey goal=2, total=6.
  // 99 crabapples clamps to 4 → total=4 → stage 2 (< 6, but ≥ ceil(6/2)=3).
  // The project is NOT complete because wild_honey is still 0.
  const world = shelfWorld('orchard_lanterns', { crabapple: 99 });
  assert.equal(getCommunityShelfStage(world, 'orchard_lanterns', 3), 2);
});

// ---------------------------------------------------------------------------
// 6. Determinism — same state produces same stage across 10 calls
// ---------------------------------------------------------------------------

test('AD-6 determinism: same state yields identical stage across 10 consecutive calls', () => {
  const world = mergeShelves(
    shelfWorld('marigold_garland', { meadow_posy: 3, chamomile_blossom: 1 }), // stage 2
    shelfWorld('orchard_lanterns', { crabapple: 1 }), // stage 1
    shelfWorld('pond_mosaic', { smooth_river_glass: 2, pressed_fern: 2, heron_feather: 1, cedar_shaving_rose: 1 }), // stage 3
  );

  const results = Array.from({ length: 10 }, () => [
    getCommunityShelfStage(world, 'marigold_garland', 3),
    getCommunityShelfStage(world, 'orchard_lanterns', 3),
    getCommunityShelfStage(world, 'pond_mosaic', 3),
  ]);

  const first = results[0];
  assert.deepEqual(first, [2, 1, 3]);
  for (const r of results) {
    assert.deepEqual(r, first, 'every call must return the same stage tuple');
  }
});

test('AD-6 determinism: composed revision is stable across 10 calls', () => {
  const world = createFreshWorldState();
  const worldWith = {
    ...world,
    communityProjects: {
      marigold_garland: { contributed: { meadow_posy: 3, chamomile_blossom: 1 }, completedDay: 0 },
    } as CommunityProjectsState,
  };
  const revisions = Array.from({ length: 10 }, () => composeEnvironmentState(worldWith).revision);
  for (const r of revisions) {
    assert.equal(r, revisions[0], 'revision must be identical across 10 calls');
  }
});

// ---------------------------------------------------------------------------
// 7. Save/reload — JSON round-trip preserves stage
// ---------------------------------------------------------------------------

test('AD-7 save/reload: JSON.parse(JSON.stringify) preserves stage for all 3 projects', () => {
  const original = mergeShelves(
    shelfWorld('marigold_garland', { meadow_posy: 3, chamomile_blossom: 1 }), // stage 2
    shelfWorld('orchard_lanterns', { crabapple: 4, wild_honey: 2 }, 7), // completed → stage 3
    shelfWorld('pond_mosaic', { smooth_river_glass: 1 }), // stage 1
  );

  const reloaded = JSON.parse(JSON.stringify(original)) as ShelfWorld;

  assert.equal(getCommunityShelfStage(reloaded, 'marigold_garland', 3), 2);
  assert.equal(getCommunityShelfStage(reloaded, 'orchard_lanterns', 3), 3);
  assert.equal(getCommunityShelfStage(reloaded, 'pond_mosaic', 3), 1);
});

test('AD-7 save/reload: sanitized-then-serialized state preserves stage', () => {
  // Simulate the real save/load path: sanitize → JSON → parse → stage.
  const warnings: string[] = [];
  const sanitized = sanitizeCommunityProjectsState(
    {
      marigold_garland: { contributed: { meadow_posy: 3, chamomile_blossom: 3, lavender_sprig: 2 }, completedDay: 0 },
      pond_mosaic: { contributed: { smooth_river_glass: 2, pressed_fern: 1 }, completedDay: 0 },
    },
    warnings,
  );
  const reloaded = JSON.parse(JSON.stringify({ communityProjects: sanitized })) as ShelfWorld;

  assert.equal(getCommunityShelfStage(reloaded, 'marigold_garland', 3), 3);
  assert.equal(getCommunityShelfStage(reloaded, 'pond_mosaic', 3), 2);
});

// ---------------------------------------------------------------------------
// 8. Completion idempotency — completedDay > 0 → stageCount regardless of contributed
// ---------------------------------------------------------------------------

test('AD-8 completion idempotency: completedDay>0 with ZERO contributed → stage 3', () => {
  const world = shelfWorld('marigold_garland', {}, 5);
  assert.equal(getCommunityShelfStage(world, 'marigold_garland', 3), 3);
});

test('AD-8 completion idempotency: completedDay>0 with partial contributed → stage 3', () => {
  const world = shelfWorld('marigold_garland', { meadow_posy: 1 }, 5);
  assert.equal(getCommunityShelfStage(world, 'marigold_garland', 3), 3);
});

test('AD-8 completion idempotency: completedDay>0 with over-contributed → stage 3', () => {
  const world = shelfWorld('marigold_garland', { meadow_posy: 99 }, 5);
  assert.equal(getCommunityShelfStage(world, 'marigold_garland', 3), 3);
});

test('AD-8 completion idempotency: completedDay=1 (minimal positive) → stage 3', () => {
  for (const pid of ['marigold_garland', 'orchard_lanterns', 'pond_mosaic']) {
    const world = shelfWorld(pid, {}, 1);
    assert.equal(getCommunityShelfStage(world, pid, 3), 3, `${pid} completedDay=1 → stage 3`);
  }
});

test('AD-8 completion idempotency: completedDay respects custom stageCount', () => {
  const world = shelfWorld('marigold_garland', {}, 5);
  assert.equal(getCommunityShelfStage(world, 'marigold_garland', 5), 5);
  assert.equal(getCommunityShelfStage(world, 'marigold_garland', 2), 2);
});

// ---------------------------------------------------------------------------
// 9. Threshold boundaries — exact boundary values for each project
//   Stage 0: totalContributed == 0
//   Stage 1: 1 ≤ totalContributed < ceil(totalGoal/2)
//   Stage 2: ceil(totalGoal/2) ≤ totalContributed < totalGoal
//   Stage 3: totalContributed ≥ totalGoal OR completedDay > 0
// ---------------------------------------------------------------------------

test('AD-9 threshold boundaries: marigold_garland (totalGoal=8, halfway=4)', () => {
  const w = shelfWorld('marigold_garland', {});
  // 0 → stage 0
  assert.equal(getCommunityShelfStage(w, 'marigold_garland', 3), 0);
  // 1 → stage 1 (first contribution)
  assert.equal(
    getCommunityShelfStage(shelfWorld('marigold_garland', { meadow_posy: 1 }), 'marigold_garland', 3),
    1,
  );
  // ceil(8/2)=4 → stage 2 (exactly halfway)
  assert.equal(
    getCommunityShelfStage(shelfWorld('marigold_garland', { meadow_posy: 3, chamomile_blossom: 1 }), 'marigold_garland', 3),
    2,
  );
  // 7 (just below goal) → stage 2
  assert.equal(
    getCommunityShelfStage(shelfWorld('marigold_garland', { meadow_posy: 3, chamomile_blossom: 3, lavender_sprig: 1 }), 'marigold_garland', 3),
    2,
  );
  // 8 → stage 3 (goal reached)
  assert.equal(
    getCommunityShelfStage(shelfWorld('marigold_garland', { meadow_posy: 3, chamomile_blossom: 3, lavender_sprig: 2 }), 'marigold_garland', 3),
    3,
  );
});

test('AD-9 threshold boundaries: orchard_lanterns (totalGoal=6, halfway=3)', () => {
  // 0 → stage 0
  assert.equal(getCommunityShelfStage(shelfWorld('orchard_lanterns', {}), 'orchard_lanterns', 3), 0);
  // 1 → stage 1
  assert.equal(
    getCommunityShelfStage(shelfWorld('orchard_lanterns', { crabapple: 1 }), 'orchard_lanterns', 3),
    1,
  );
  // ceil(6/2)=3 → stage 2 (exactly halfway)
  assert.equal(
    getCommunityShelfStage(shelfWorld('orchard_lanterns', { crabapple: 3 }), 'orchard_lanterns', 3),
    2,
  );
  // 5 (just below goal) → stage 2
  assert.equal(
    getCommunityShelfStage(shelfWorld('orchard_lanterns', { crabapple: 4, wild_honey: 1 }), 'orchard_lanterns', 3),
    2,
  );
  // 6 → stage 3
  assert.equal(
    getCommunityShelfStage(shelfWorld('orchard_lanterns', { crabapple: 4, wild_honey: 2 }), 'orchard_lanterns', 3),
    3,
  );
});

test('AD-9 threshold boundaries: pond_mosaic (totalGoal=6, halfway=3)', () => {
  // 0 → stage 0
  assert.equal(getCommunityShelfStage(shelfWorld('pond_mosaic', {}), 'pond_mosaic', 3), 0);
  // 1 → stage 1
  assert.equal(
    getCommunityShelfStage(shelfWorld('pond_mosaic', { smooth_river_glass: 1 }), 'pond_mosaic', 3),
    1,
  );
  // ceil(6/2)=3 → stage 2
  assert.equal(
    getCommunityShelfStage(shelfWorld('pond_mosaic', { smooth_river_glass: 2, pressed_fern: 1 }), 'pond_mosaic', 3),
    2,
  );
  // 5 (just below goal) → stage 2
  assert.equal(
    getCommunityShelfStage(shelfWorld('pond_mosaic', { smooth_river_glass: 2, pressed_fern: 2, heron_feather: 1 }), 'pond_mosaic', 3),
    2,
  );
  // 6 → stage 3
  assert.equal(
    getCommunityShelfStage(shelfWorld('pond_mosaic', { smooth_river_glass: 2, pressed_fern: 2, heron_feather: 1, cedar_shaving_rose: 1 }), 'pond_mosaic', 3),
    3,
  );
});

test('AD-9 threshold boundaries: one-below-halfway and one-above-halfway are distinct stages', () => {
  // marigold: halfway=4. 3→stage1, 4→stage2.
  assert.equal(
    getCommunityShelfStage(shelfWorld('marigold_garland', { meadow_posy: 3 }), 'marigold_garland', 3),
    1,
    '3 (below halfway 4) → stage 1',
  );
  assert.equal(
    getCommunityShelfStage(shelfWorld('marigold_garland', { meadow_posy: 3, chamomile_blossom: 1 }), 'marigold_garland', 3),
    2,
    '4 (at halfway) → stage 2',
  );
});

test('AD-9 threshold boundaries: sorrel_garden stageCount=3 coexists with community stages', () => {
  // Cross-check: the sorrel_garden project (sideFlags-borne, separate module) also
  // uses a 0..3 stage scale. Setting it must not collide with community stage derivation.
  const world: ShelfWorld = {
    communityProjects: {
      marigold_garland: { contributed: { meadow_posy: 1 }, completedDay: 0 },
    } as CommunityProjectsState,
  };
  const sideFlagsWorld = { sideFlags: { project_sorrel_garden_stage: 2 } };

  assert.equal(getCommunityShelfStage(world, 'marigold_garland', 3), 1);
  assert.equal(getCommunityProjectStage(sideFlagsWorld, 'sorrel_garden'), 2);
});
