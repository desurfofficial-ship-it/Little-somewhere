// src/game/community-stage.test.ts — Stage 2 independent stage-derivation tests.
import test from 'node:test';
import assert from 'node:assert';
import { getCommunityShelfStage } from './community';
import type { CommunityProjectsState } from './types';

function worldWith(projectId: string, contributed: Record<string, number>, completedDay = 0) {
  return { communityProjects: { [projectId]: { contributed, completedDay } } as CommunityProjectsState };
}

// marigold_garland (goal 8): thresholds 0, 1, 4, 8
test('marigold: 0 → stage 0', () => { assert.equal(getCommunityShelfStage(worldWith('marigold_garland', {}), 'marigold_garland', 3), 0); });
test('marigold: 1 → stage 1 (first contribution)', () => { assert.equal(getCommunityShelfStage(worldWith('marigold_garland', { meadow_posy: 1 }), 'marigold_garland', 3), 1); });
test('marigold: 3 → stage 1 (below halfway 4)', () => { assert.equal(getCommunityShelfStage(worldWith('marigold_garland', { meadow_posy: 3 }), 'marigold_garland', 3), 1); });
test('marigold: 4 → stage 2 (halfway)', () => { assert.equal(getCommunityShelfStage(worldWith('marigold_garland', { meadow_posy: 3, chamomile_blossom: 1 }), 'marigold_garland', 3), 2); });
test('marigold: 7 → stage 2', () => { assert.equal(getCommunityShelfStage(worldWith('marigold_garland', { meadow_posy: 3, chamomile_blossom: 3, lavender_sprig: 1 }), 'marigold_garland', 3), 2); });
test('marigold: 8 → stage 3', () => { assert.equal(getCommunityShelfStage(worldWith('marigold_garland', { meadow_posy: 3, chamomile_blossom: 3, lavender_sprig: 2 }), 'marigold_garland', 3), 3); });
test('marigold: completedDay > 0 → stage 3', () => { assert.equal(getCommunityShelfStage(worldWith('marigold_garland', { meadow_posy: 1 }, 5), 'marigold_garland', 3), 3); });
test('marigold: completedDay > 0, zero contributed → stage 3', () => { assert.equal(getCommunityShelfStage(worldWith('marigold_garland', {}, 5), 'marigold_garland', 3), 3); });

// orchard_lanterns (goal 6): thresholds 0, 1, 3, 6
test('orchard: 0 → stage 0', () => { assert.equal(getCommunityShelfStage(worldWith('orchard_lanterns', {}), 'orchard_lanterns', 3), 0); });
test('orchard: 1 → stage 1', () => { assert.equal(getCommunityShelfStage(worldWith('orchard_lanterns', { crabapple: 1 }), 'orchard_lanterns', 3), 1); });
test('orchard: 2 → stage 1 (below halfway 3)', () => { assert.equal(getCommunityShelfStage(worldWith('orchard_lanterns', { crabapple: 2 }), 'orchard_lanterns', 3), 1); });
test('orchard: 3 → stage 2 (halfway)', () => { assert.equal(getCommunityShelfStage(worldWith('orchard_lanterns', { crabapple: 3 }), 'orchard_lanterns', 3), 2); });
test('orchard: 5 → stage 2', () => { assert.equal(getCommunityShelfStage(worldWith('orchard_lanterns', { crabapple: 4, wild_honey: 1 }), 'orchard_lanterns', 3), 2); });
test('orchard: 6 → stage 3', () => { assert.equal(getCommunityShelfStage(worldWith('orchard_lanterns', { crabapple: 4, wild_honey: 2 }), 'orchard_lanterns', 3), 3); });

// pond_mosaic (goal 6): thresholds 0, 1, 3, 6
test('pond: 0 → stage 0', () => { assert.equal(getCommunityShelfStage(worldWith('pond_mosaic', {}), 'pond_mosaic', 3), 0); });
test('pond: 1 → stage 1', () => { assert.equal(getCommunityShelfStage(worldWith('pond_mosaic', { smooth_river_glass: 1 }), 'pond_mosaic', 3), 1); });
test('pond: 3 → stage 2', () => { assert.equal(getCommunityShelfStage(worldWith('pond_mosaic', { smooth_river_glass: 2, pressed_fern: 1 }), 'pond_mosaic', 3), 2); });
test('pond: 6 → stage 3', () => { assert.equal(getCommunityShelfStage(worldWith('pond_mosaic', { smooth_river_glass: 2, pressed_fern: 2, heron_feather: 1, cedar_shaving_rose: 1 }), 'pond_mosaic', 3), 3); });

// edge cases
test('invalid project ID → stage 0', () => { assert.equal(getCommunityShelfStage(worldWith('marigold_garland', {}), 'nonexistent', 3), 0); });
test('missing communityProjects → stage 0', () => { assert.equal(getCommunityShelfStage({} as { communityProjects?: CommunityProjectsState }, 'marigold_garland', 3), 0); });
test('over-contribution clamp', () => { assert.equal(getCommunityShelfStage(worldWith('marigold_garland', { meadow_posy: 99 }), 'marigold_garland', 3), 1); });
test('deterministic across 10 calls', () => {
  const w = worldWith('marigold_garland', { meadow_posy: 3, chamomile_blossom: 1 });
  const r = Array.from({ length: 10 }, () => getCommunityShelfStage(w, 'marigold_garland', 3));
  assert.ok(r.every((x) => x === r[0])); assert.equal(r[0], 2);
});
test('save/reload round-trip', () => {
  const w1 = worldWith('marigold_garland', { meadow_posy: 3, chamomile_blossom: 1 });
  const w2 = JSON.parse(JSON.stringify(w1));
  assert.equal(getCommunityShelfStage(w2, 'marigold_garland', 3), getCommunityShelfStage(w1, 'marigold_garland', 3));
});
