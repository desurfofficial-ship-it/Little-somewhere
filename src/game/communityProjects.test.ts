import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMUNITY_PROJECTS,
  getCommunityProjectStage,
  getNextCommunityStageLabel,
  isCommunityProjectComplete,
} from './communityProjects';
import { composeEnvironmentState } from './environment';
import { interactWithProp } from './actions';
import { createFreshWorldState } from './storage';

// ---------------------------------------------------------------------------
// WP-4 (world-environment initiative, Workstream E): community projects world-side
// foundation — pure registry, sideFlags-borne state, zero schema bump.
// ---------------------------------------------------------------------------

test('WP-4: sorrel garden stage derives purely from sideFlags and caps at stageCount', () => {
  const fresh = createFreshWorldState();
  assert.equal(getCommunityProjectStage(fresh, 'sorrel_garden'), 0);
  assert.equal(isCommunityProjectComplete(fresh, 'sorrel_garden'), false);
  assert.equal(getCommunityProjectStage(fresh, 'unknown_project'), 0);

  const stage1 = { ...fresh, sideFlags: { project_sorrel_garden_stage: 1 } };
  assert.equal(getCommunityProjectStage(stage1, 'sorrel_garden'), 1);
  const stage99 = { ...fresh, sideFlags: { project_sorrel_garden_stage: 99 } };
  assert.equal(getCommunityProjectStage(stage99, 'sorrel_garden'), 3, 'stage caps at registry stageCount');
  assert.equal(isCommunityProjectComplete(stage99, 'sorrel_garden'), true);

  // Corrupt/negative values fail closed to the untouched stage.
  const corrupt = { ...fresh, sideFlags: { project_sorrel_garden_stage: -2 } };
  assert.equal(getCommunityProjectStage(corrupt, 'sorrel_garden'), 0);
});

test('WP-4: the composer carries the garden stage and reacts on its revision', () => {
  const fresh = createFreshWorldState();
  const untouched = composeEnvironmentState(fresh);
  assert.equal(untouched.worldEchoes.sorrelGardenStage, 0);

  const tilled = composeEnvironmentState({
    ...fresh,
    sideFlags: { project_sorrel_garden_stage: 1 },
  });
  assert.equal(tilled.worldEchoes.sorrelGardenStage, 1);
  assert.notEqual(tilled.revision, untouched.revision, 'garden stage changes must re-run the static render block');

  const blooming = composeEnvironmentState({
    ...fresh,
    sideFlags: { project_sorrel_garden_stage: 3 },
  });
  assert.equal(blooming.worldEchoes.sorrelGardenStage, 3);
  assert.notEqual(blooming.revision, tilled.revision);
});

test('WP-4: registry stays internally coherent (labels, memory, worldChange)', () => {
  for (const project of COMMUNITY_PROJECTS) {
    assert.equal(project.stageLabels.length, project.stageCount, `${project.id} labels cover all stages`);
    assert.ok(project.stageCount >= 1, `${project.id} has at least one contribution stage`);
    assert.ok(project.worldChange.visualId.length > 0, `${project.id} declares its visual anchor`);
    for (let s = 0; s < project.stageCount; s++) {
      assert.ok(getNextCommunityStageLabel(project.id, s), `${project.id} stage ${s + 1} has a label`);
    }
    assert.equal(getNextCommunityStageLabel(project.id, project.stageCount), null, 'complete projects have no next label');
    assert.ok(project.completionMemory.id.startsWith('mem_'), `${project.id} completion memory id convention`);
  }
});

test('WP-4: tending the garden bed advances stages, journals the completion, and stays sideFlags-borne', () => {
  let world = createFreshWorldState();
  world.sideFlags = { ...world.sideFlags, explored_sorrel_hollow: true };

  // Stage 0 -> 1: tilling
  const r1 = interactWithProp(world, 'sorrel_garden_bed');
  world = r1.nextWorld;
  assert.equal(Number(world.sideFlags?.project_sorrel_garden_stage), 1);
  assert.ok(r1.title.includes('Sorrel Hollow Garden'));
  assert.equal(r1.memoryUnlockedTitle, undefined);
  assert.equal(world.minuteOfDay > 0, true, 'tending costs a little time');

  // Stage 1 -> 2: sowing
  const r2 = interactWithProp(world, 'sorrel_garden_bed');
  world = r2.nextWorld;
  assert.equal(Number(world.sideFlags?.project_sorrel_garden_stage), 2);
  assert.equal(r2.memoryUnlockedTitle, undefined);

  // Stage 2 -> 3: bloom + completion memory
  const r3 = interactWithProp(world, 'sorrel_garden_bed');
  world = r3.nextWorld;
  assert.equal(Number(world.sideFlags?.project_sorrel_garden_stage), 3);
  assert.equal(r3.memoryUnlockedTitle, 'The Garden Remembers');
  assert.ok(world.memories.some((m) => m.id === 'mem_sorrel_garden_bloom'));
  assert.equal(isCommunityProjectComplete(world, 'sorrel_garden'), true);

  // Completed garden: flavor-only, no state mutation, no memory duplication.
  const memoriesBefore = world.memories.length;
  const r4 = interactWithProp(world, 'sorrel_garden_bed');
  assert.equal(r4.nextWorld, world, 'completed project interactions are pure flavor');
  assert.equal(r4.nextWorld.memories.length, memoriesBefore);
});
