import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEARTH_RECIPES,
  MAX_ITEM_STACK,
  NEIGHBOR_KEEPSAKE_REWARDS,
  PERSONAL_ITEMS,
  PERSONAL_ITEM_MAP,
  RECIPE_ACTIVITY_STEPS,
  RESIDENT_GIFT_PREFS,
  addItemToInventory,
  canCraftRecipe,
  consumeItemFromInventory,
  createStarterInventory,
  getGiftReactionTier,
  getItemCount,
  getOwnedGiftableItems,
  getOwnedKeepsakeItems,
  getFirstSipableItem,
  getOwnedVaseFlowerItems,
  getRecipeActivitySteps,
  getTotalItemCount,
} from './inventory';
import { RESIDENT_ORDER } from './residents';
import { PersonalItemId } from './types';

test('personal item catalog, starter inventory, and stack clamping enforce invariants', () => {
  assert.equal(PERSONAL_ITEMS.length, 38); // 25 baseline + 5 Willow Jetty pond catches (Stage 3) + 3 SC-B community-project keepsakes + 1 Photography framed-photo keepsake (Stage 3 Cont.) + 4 Gardening Expansion crops (marigold + sage seeds/harvests)
  const uniqueIds = new Set(PERSONAL_ITEMS.map((item) => item.id));
  assert.equal(uniqueIds.size, PERSONAL_ITEMS.length);

  const starter = createStarterInventory();
  assert.equal(getItemCount(starter, 'chamomile_blossom'), 1);
  assert.equal(getItemCount(starter, 'lemon_thyme'), 1);
  assert.equal(getTotalItemCount(starter), 2);

  // Adding clamps safely at MAX_ITEM_STACK and records discoveredItemIds without duplicates
  const addedOnce = addItemToInventory(starter, ['chamomile_blossom'], 'crabapple', 25);
  assert.equal(getItemCount(addedOnce.inventory, 'crabapple'), MAX_ITEM_STACK);
  assert.equal(addedOnce.added, MAX_ITEM_STACK);
  assert.ok(addedOnce.discoveredItemIds.includes('crabapple'));

  const addedMore = addItemToInventory(addedOnce.inventory, addedOnce.discoveredItemIds, 'crabapple', 5);
  assert.equal(addedMore.added, 0);
  assert.equal(getItemCount(addedMore.inventory, 'crabapple'), MAX_ITEM_STACK);
  assert.equal(
    addedMore.discoveredItemIds.filter((id) => id === 'crabapple').length,
    1,
  );

  // Consuming cleans up zero-count keys and fails cleanly if insufficient
  const failConsume = consumeItemFromInventory(starter, 'wild_honey', 1);
  assert.equal(failConsume.ok, false);
  const okConsume = consumeItemFromInventory(starter, 'chamomile_blossom', 1);
  assert.equal(okConsume.ok, true);
  assert.equal(okConsume.inventory.chamomile_blossom, undefined);
  assert.equal(getItemCount(okConsume.inventory, 'chamomile_blossom'), 0);
});

test('hearth recipes, gift preferences, keepsake rewards, and category filters validate cleanly', () => {
  assert.equal(HEARTH_RECIPES.length, 5);
  for (const recipe of HEARTH_RECIPES) {
    assert.ok(PERSONAL_ITEM_MAP[recipe.outputItemId], `Missing output ${recipe.outputItemId}`);
    for (const ing of recipe.ingredients) {
      assert.ok(PERSONAL_ITEM_MAP[ing.itemId], `Missing ingredient ${ing.itemId}`);
    }
  }

  const starter = createStarterInventory();
  const teaRecipe = HEARTH_RECIPES.find((r) => r.id === 'recipe_chamomile_tea')!;
  const loafRecipe = HEARTH_RECIPES.find((r) => r.id === 'recipe_herb_loaf')!;
  assert.equal(canCraftRecipe(starter, teaRecipe), true);
  assert.equal(canCraftRecipe(starter, loafRecipe), false);

  // Every resident has loved & liked preferences referencing valid personal items
  for (const rid of RESIDENT_ORDER) {
    const prefs = RESIDENT_GIFT_PREFS[rid];
    assert.ok(prefs && prefs.loved.length >= 3);
    assert.ok(prefs.liked.length >= 3);
    for (const id of [...prefs.loved, ...prefs.liked]) {
      assert.ok(PERSONAL_ITEM_MAP[id], `Invalid item ${id} for ${rid}`);
      assert.equal(PERSONAL_ITEM_MAP[id].giftable, true);
    }
  }

  // Gift reaction tiers respect loved, liked, baked fallback, and neutral
  assert.equal(getGiftReactionTier('arthur', 'chamomile_pear_tea'), 'loved');
  assert.equal(getGiftReactionTier('arthur', 'crabapple_tart'), 'liked');
  assert.equal(getGiftReactionTier('toby', 'herb_loaf'), 'liked'); // baked_treat fallback
  assert.equal(getGiftReactionTier('pip', 'lemon_thyme'), 'neutral');

  // Keepsake rewards map to displayable keepsake items
  assert.equal(NEIGHBOR_KEEPSAKE_REWARDS.length, 5);
  for (const reward of NEIGHBOR_KEEPSAKE_REWARDS) {
    const def = PERSONAL_ITEM_MAP[reward.itemId];
    assert.equal(def.category, 'keepsake');
    assert.equal(def.homeDisplayable, 'shelf');
    assert.equal(def.giftable, false);
  }

  // Filter helpers distinguish giftables, vase blooms, and keepsakes
  const mixedInv: Partial<Record<PersonalItemId, number>> = {
    chamomile_blossom: 1,
    lemon_thyme: 1,
    willow_zine_copy: 1,
    crabapple_tart: 2,
  };
  const giftables = getOwnedGiftableItems(mixedInv).map((x) => x.def.id);
  assert.ok(giftables.includes('chamomile_blossom'));
  assert.ok(giftables.includes('crabapple_tart'));
  assert.ok(!giftables.includes('willow_zine_copy'));

  const vaseFlowers = getOwnedVaseFlowerItems(mixedInv).map((x) => x.def.id);
  assert.deepEqual(vaseFlowers, ['chamomile_blossom']);

  const keepsakes = getOwnedKeepsakeItems(mixedInv).map((d) => d.id);
  assert.deepEqual(keepsakes, ['willow_zine_copy']);
});

test('hearth activity steps cover every recipe with three sensory stages', () => {
  for (const recipe of HEARTH_RECIPES) {
    const steps = getRecipeActivitySteps(recipe.id);
    assert.equal(steps.length, 3, `Recipe ${recipe.id} needs 3 activity steps`);
    for (const step of steps) {
      assert.ok(step.length >= 10, `Step text for ${recipe.id} is descriptive`);
      assert.ok(step.endsWith('…'), `Step text for ${recipe.id} trails with an ellipsis`);
    }
    assert.ok(RECIPE_ACTIVITY_STEPS[recipe.id], `Missing staged steps for ${recipe.id}`);
  }
  // Unknown recipe ids still receive a graceful fallback so the modal never blanks
  assert.equal(getRecipeActivitySteps('recipe_unknown').length, 3);
});

test('Pass 15: the kettle offers a second sipable ritual — lavender chamomile tea', () => {
  const def = PERSONAL_ITEM_MAP['lavender_chamomile_tea'];
  assert.ok(def, 'Lavender chamomile tea item def exists');
  assert.equal(def.sipable, true, 'The new tea is sipable at the oak table');
  assert.equal(def.giftable, true, 'The new tea can still be shared with a neighbor');

  // Its recipe brews from lavender + chamomile and has a unique id
  const recipe = HEARTH_RECIPES.find((r) => r.id === 'recipe_lavender_tea');
  assert.ok(recipe, 'Lavender tea recipe exists at the hearth');
  assert.equal(recipe.outputItemId, 'lavender_chamomile_tea');
  const ids = new Set(HEARTH_RECIPES.map((r) => r.id));
  assert.equal(ids.size, HEARTH_RECIPES.length, 'Recipe ids stay unique');
  assert.deepEqual(
    recipe.ingredients.map((i) => i.itemId),
    ['lavender_sprig', 'chamomile_blossom'],
  );

  // The first-sipable helper derives from defs: both teas resolve, oldest def first
  const both: Partial<Record<PersonalItemId, number>> = {
    chamomile_pear_tea: 1,
    lavender_chamomile_tea: 1,
  };
  assert.equal(getFirstSipableItem(both)?.itemId, 'chamomile_pear_tea');
  assert.equal(getFirstSipableItem({ lavender_chamomile_tea: 1 })?.itemId, 'lavender_chamomile_tea');

  // With two teas in the world, the tea-table ritual can now record a second memory
  const recipeIds = HEARTH_RECIPES.map((r) => r.outputItemId);
  const sipableDefs = PERSONAL_ITEMS.filter((i) => i.sipable).map((i) => i.id);
  for (const sipableId of sipableDefs) {
    assert.ok(
      recipeIds.includes(sipableId),
      `Sipable drink ${sipableId} must be brewable at the hearth`,
    );
  }
  assert.ok(sipableDefs.length >= 2, 'The tea table offers more than one quiet cup');
});
