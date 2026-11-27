/**
 * Recipe Discovery System — adversarial battery.
 *
 *   RD-01  undiscovered recipe is refused by cookRecipeAction
 *   RD-02  discovered recipe can be cooked
 *   RD-03  first cook writes a recipe-specific journal memory
 *   RD-04  second cook does NOT duplicate the first-cook memory
 *   RD-05  hearthCookedCount bumps on every cook
 *   RD-06  kitchen everyday practice includes hearth cooking count
 *   RD-07  cottage_window_box marks chamomile_blossom discovered
 *   RD-08  orchard_harvest marks crabapple + wild_honey discovered
 *   RD-09  lavender_shortbread requires BOTH lavender + crabapple discovered
 *   RD-10  sideFlags persistence — discovery survives save/load round-trip
 *   RD-11  input purity — cookRecipeAction does not mutate input world
 *   RD-12  UI filtering — isRecipeDiscovered returns correct booleans
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreshWorldState, serializeWorldState, deserializeWorldState } from './storage';
import {
  HEARTH_RECIPES,
  isRecipeDiscovered,
  isRecipeFirstCooked,
  markIngredientDiscovered,
  ingredientDiscoveredKey,
  recipeFirstCookedKey,
} from './inventory';
import { cookRecipeAction, interactWithProp } from './actions';
import { deriveEverydayPracticeProfile } from './everyday';
import type { WorldState, PersonalItemId } from './types';

function stageExterior(overrides: Partial<WorldState> = {}): WorldState {
  const world = createFreshWorldState();
  world.playerPos = { x: -10.1, z: 12.1 }; // near cottage window box
  world.playerLocation = 'exterior';
  return Object.assign(world, overrides);
}

const CHAMOMILE_TEA = HEARTH_RECIPES.find((r) => r.id === 'recipe_chamomile_tea')!;
const HERB_LOAF = HEARTH_RECIPES.find((r) => r.id === 'recipe_herb_loaf')!;
const LAVENDER_SHORTBREAD = HEARTH_RECIPES.find((r) => r.id === 'recipe_lavender_shortbread')!;

test('RD-01: undiscovered recipe is refused by cookRecipeAction', () => {
  const world = stageExterior({ inventory: { chamomile_blossom: 1 } });
  // No sideFlags → recipe not discovered.
  const res = cookRecipeAction(world, CHAMOMILE_TEA.id);
  assert.equal(res.ok, false, 'undiscovered recipe refused');
  assert.equal(res.nextWorld, world, 'refusal returns input world unchanged');
  assert.ok(res.toast.includes('discover'), 'toast hints at discovery');
});

test('RD-02: discovered recipe can be cooked', () => {
  const world = stageExterior({
    inventory: { chamomile_blossom: 1 },
    sideFlags: { [ingredientDiscoveredKey('chamomile_blossom')]: true },
  });
  const res = cookRecipeAction(world, CHAMOMILE_TEA.id);
  assert.equal(res.ok, true, 'discovered recipe cookable');
  assert.notEqual(res.nextWorld, world, 'cook advances the world');
});

test('RD-03: first cook writes a recipe-specific journal memory', () => {
  const world = stageExterior({
    inventory: { chamomile_blossom: 1 },
    sideFlags: { [ingredientDiscoveredKey('chamomile_blossom')]: true },
  });
  const res = cookRecipeAction(world, CHAMOMILE_TEA.id);
  const mem = res.nextWorld.memories.find((m) => m.id === `mem_recipe_first_${CHAMOMILE_TEA.id}`);
  assert.ok(mem, 'first-cook memory written');
  assert.equal(mem!.title, CHAMOMILE_TEA.firstCookTitle);
  assert.ok(res.memoryUnlockedTitle, 'memoryUnlockedTitle set on first cook');
});

test('RD-04: second cook does NOT duplicate the first-cook memory', () => {
  const world = stageExterior({
    inventory: { chamomile_blossom: 2 },
    sideFlags: {
      [ingredientDiscoveredKey('chamomile_blossom')]: true,
      [recipeFirstCookedKey(CHAMOMILE_TEA.id)]: true,
    },
    memories: [
      { id: `mem_recipe_first_${CHAMOMILE_TEA.id}`, day: 1, phase: 'morning', title: CHAMOMILE_TEA.firstCookTitle!, summary: CHAMOMILE_TEA.firstCookSummary! },
      { id: 'mem_cottage_hearth', day: 1, phase: 'morning', title: 'First Hearth Bake at Willow Step', summary: 'x' },
    ],
  });
  const res = cookRecipeAction(world, CHAMOMILE_TEA.id);
  const memCount = res.nextWorld.memories.filter((m) => m.id === `mem_recipe_first_${CHAMOMILE_TEA.id}`).length;
  assert.equal(memCount, 1, 'no duplicate first-cook memory');
  assert.equal(res.memoryUnlockedTitle, undefined, 'no title on repeat cook');
});

test('RD-05: hearthCookedCount bumps on every cook', () => {
  const world = stageExterior({
    inventory: { chamomile_blossom: 1 },
    sideFlags: { [ingredientDiscoveredKey('chamomile_blossom')]: true },
  });
  const res = cookRecipeAction(world, CHAMOMILE_TEA.id);
  assert.equal(res.nextWorld.sideFlags.hearthCookedCount, 1, 'hearthCookedCount = 1 after first cook');
});

test('RD-06: kitchen everyday practice includes hearth cooking count', () => {
  const world = stageExterior({
    inventory: { chamomile_blossom: 1 },
    sideFlags: { [ingredientDiscoveredKey('chamomile_blossom')]: true },
  });
  const before = deriveEverydayPracticeProfile(world);
  const kitchenBefore = before.practices.find((p) => p.id === 'kitchen')!;
  const res = cookRecipeAction(world, CHAMOMILE_TEA.id);
  const after = deriveEverydayPracticeProfile(res.nextWorld);
  const kitchenAfter = after.practices.find((p) => p.id === 'kitchen')!;
  assert.ok(kitchenAfter.count > kitchenBefore.count, 'kitchen count increased after hearth cooking');
});

test('RD-07: cottage_window_box marks chamomile_blossom discovered', () => {
  const world = stageExterior();
  const res = interactWithProp(world, 'cottage_window_box');
  assert.ok(
    isIngredientDiscovered(res.nextWorld.sideFlags, 'chamomile_blossom'),
    'chamomile_blossom marked discovered after tending window box',
  );
  // Recipe should now be discovered.
  assert.ok(
    isRecipeDiscovered(res.nextWorld.sideFlags, CHAMOMILE_TEA),
    'chamomile tea recipe discovered after tending window box',
  );
});

function isIngredientDiscovered(
  sideFlags: Record<string, boolean | number | string> | undefined,
  itemId: PersonalItemId,
): boolean {
  return Boolean(sideFlags?.[ingredientDiscoveredKey(itemId)]);
}

test('RD-08: orchard_harvest marks crabapple + wild_honey discovered', () => {
  const world = stageExterior();
  world.playerPos = { x: -4.2, z: -19.2 }; // near orchard
  const res = interactWithProp(world, 'orchard_harvest');
  assert.ok(
    isIngredientDiscovered(res.nextWorld.sideFlags, 'crabapple'),
    'crabapple marked discovered after orchard harvest',
  );
  assert.ok(
    isIngredientDiscovered(res.nextWorld.sideFlags, 'wild_honey'),
    'wild_honey marked discovered after orchard harvest',
  );
  // herb_loaf requires wild_honey → should be discovered.
  assert.ok(
    isRecipeDiscovered(res.nextWorld.sideFlags, HERB_LOAF),
    'herb loaf recipe discovered after orchard harvest',
  );
});

test('RD-09: lavender_shortbread requires BOTH lavender + crabapple discovered', () => {
  const world = stageExterior({
    inventory: { lavender_sprig: 1, crabapple: 1 },
  });
  // Only lavender discovered → shortbread NOT discovered.
  let sf = markIngredientDiscovered({}, 'lavender_sprig');
  assert.equal(
    isRecipeDiscovered(sf, LAVENDER_SHORTBREAD),
    false,
    'shortbread not discovered with only lavender',
  );
  // Both discovered → shortbread discovered.
  sf = markIngredientDiscovered(sf, 'crabapple');
  assert.equal(
    isRecipeDiscovered(sf, LAVENDER_SHORTBREAD),
    true,
    'shortbread discovered with both lavender + crabapple',
  );
});

test('RD-10: sideFlags persistence — discovery survives save/load round-trip', () => {
  const world = stageExterior({
    inventory: { chamomile_blossom: 1 },
    sideFlags: {
      [ingredientDiscoveredKey('chamomile_blossom')]: true,
      [recipeFirstCookedKey(CHAMOMILE_TEA.id)]: true,
      hearthCookedCount: 3,
    },
  });
  const json = serializeWorldState(world);
  const loaded = deserializeWorldState(json).state;
  assert.ok(
    isIngredientDiscovered(loaded.sideFlags, 'chamomile_blossom'),
    'ingredient discovery survives round-trip',
  );
  assert.ok(
    isRecipeFirstCooked(loaded.sideFlags, CHAMOMILE_TEA.id),
    'recipe first-cooked flag survives round-trip',
  );
  assert.equal(loaded.sideFlags.hearthCookedCount, 3, 'hearthCookedCount survives round-trip');
});

test('RD-11: input purity — cookRecipeAction does not mutate input world', () => {
  const world = stageExterior({
    inventory: { chamomile_blossom: 1 },
    sideFlags: { [ingredientDiscoveredKey('chamomile_blossom')]: true },
  });
  const before = JSON.stringify(world);
  cookRecipeAction(world, CHAMOMILE_TEA.id);
  assert.equal(JSON.stringify(world), before, 'input world not mutated');
});

test('RD-12: isRecipeDiscovered returns correct booleans for all recipes', () => {
  const empty: Record<string, boolean | number | string> = {};
  for (const recipe of HEARTH_RECIPES) {
    assert.equal(
      isRecipeDiscovered(empty, recipe),
      false,
      `${recipe.id} not discovered with empty sideFlags`,
    );
  }
  // Discover all ingredients.
  let sf = markIngredientDiscovered({}, 'chamomile_blossom');
  sf = markIngredientDiscovered(sf, 'lavender_sprig');
  sf = markIngredientDiscovered(sf, 'crabapple');
  sf = markIngredientDiscovered(sf, 'wild_honey');
  for (const recipe of HEARTH_RECIPES) {
    assert.equal(
      isRecipeDiscovered(sf, recipe),
      true,
      `${recipe.id} discovered with all ingredients`,
    );
  }
});
