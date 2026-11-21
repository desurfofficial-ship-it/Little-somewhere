/**
 * BUILD 03 — cottage interior progression tiers (Doc 07 §5.5/§5.3c):
 * - fresh save: every tier group + the sill-posy growth group hidden (parity)
 * - counter thresholds flip the correct tiers (booksRead 2/4, harvests 3, kneads 5)
 * - sill posies: hidden days 1-2, stems at 3, full at 7, bare in winter
 * - tier groups ride the existing memento groups (no new surfaces, no save impact)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { MaterialPalette } from './materials';
import { buildWillowCottageInterior } from './builders/cottageInterior';
import { createFreshWorldState } from '../game/storage';
import type { WorldState } from '../game/types';

function buildRig() {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());
  return { palette, rig };
}

function worldAt(overrides: Partial<WorldState>): WorldState {
  const base = createFreshWorldState();
  return { ...base, ...overrides };
}

test('cottage progression tiers: fresh save keeps every new group hidden (parity)', () => {
  const { palette, rig } = buildRig();
  const tiers = rig.progressionTiers;
  rig.update(worldAt({ day: 2, season: 'spring' }), 'morning', 0);
  assert.equal(tiers.bookTier2.visible, false);
  assert.equal(tiers.bookTier3.visible, false);
  assert.equal(tiers.honeyDipperTier.visible, false);
  assert.equal(tiers.recipeCard2.visible, false);
  assert.equal(tiers.posyGrowth.visible, false, 'posy growth hidden on days 1-2 (stage 0)');
  assert.equal(tiers.posyGrowthFull.visible, false);
  rig.dispose();
  palette.disposeAll();
});

test('cottage progression tiers: reachable counters flip the correct tiers', () => {
  const { palette, rig } = buildRig();
  const tiers = rig.progressionTiers;
  const world = worldAt({ day: 5, season: 'spring' });
  rig.update(world, 'morning', 0);
  assert.equal(tiers.bookTier2.visible, false, 'booksRead 0 → tier 1 only');

  world.nookState = { ...world.nookState, booksRead: 2 };
  rig.update(world, 'morning', 0);
  assert.equal(tiers.bookTier2.visible, true, 'booksRead 2 → 2nd book');
  assert.equal(tiers.bookTier3.visible, false);

  world.nookState = { ...world.nookState, booksRead: 4 };
  world.greenhouseState = { ...world.greenhouseState, totalHarvests: 3 };
  world.bakeryState = { ...world.bakeryState, kneadingSessions: 5 };
  rig.update(world, 'morning', 0);
  assert.equal(tiers.bookTier3.visible, true, 'booksRead 4 → 3rd book (reachable cap)');
  assert.equal(tiers.honeyDipperTier.visible, true, 'harvests 3 → dipper');
  assert.equal(tiers.recipeCard2.visible, true, 'kneads 5 → 2nd card');
  rig.dispose();
  palette.disposeAll();
});

test('cottage sill posies: stems at day 3, full at day 7, bare in winter', () => {
  const { palette, rig } = buildRig();
  const tiers = rig.progressionTiers;
  rig.update(worldAt({ day: 3, season: 'spring' }), 'morning', 0);
  assert.equal(tiers.posyGrowth.visible, true, 'day 3: growth vase appears');
  assert.equal(tiers.posyGrowthFull.visible, false, 'day 3: few stems only');
  rig.update(worldAt({ day: 7, season: 'spring' }), 'morning', 0);
  assert.equal(tiers.posyGrowthFull.visible, true, 'day 7: full posy');
  rig.update(worldAt({ day: 9, season: 'winter' }), 'morning', 0);
  assert.equal(tiers.posyGrowth.visible, false, 'winter: bare (identity)');
  rig.dispose();
  palette.disposeAll();
});
