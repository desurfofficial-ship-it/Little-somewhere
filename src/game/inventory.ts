import {
  GiftReactionTier,
  PersonalItemCategory,
  PersonalItemDef,
  PersonalItemId,
  RecipeDef,
  ResidentId,
} from './types';

export const MAX_ITEM_STACK = 20;

export const PERSONAL_ITEM_CATEGORY_LABELS: Record<PersonalItemCategory, string> = {
  flora_ingredient: 'Flora & Harvest',
  baked_treat: 'Baked & Brewed',
  field_find: 'Field Finds',
  keepsake: 'Keepsakes',
};

export const PERSONAL_ITEMS: readonly PersonalItemDef[] = [
  // Flora & Harvest
  {
    id: 'crabapple',
    label: 'Orchard Crabapple',
    category: 'flora_ingredient',
    description: 'Crisp ruby crabapple gathered beneath Fern Hollow’s sunlit boughs.',
    homeDisplayable: 'vase',
    giftable: true,
  },
  {
    id: 'lemon_thyme',
    label: 'Lemon Thyme Sprig',
    category: 'flora_ingredient',
    description: 'Sun-warmed kitchen herb clipped beside Sunbeam Greenhouse.',
    giftable: true,
  },
  {
    id: 'chamomile_blossom',
    label: 'Chamomile Blossoms',
    category: 'flora_ingredient',
    description: 'Honey-scented white petals from your cottage window box.',
    homeDisplayable: 'vase',
    giftable: true,
  },
  {
    id: 'lavender_sprig',
    label: 'Sweet Lavender',
    category: 'flora_ingredient',
    description: 'Fragrant violet stalks tied neatly with linen thread.',
    homeDisplayable: 'vase',
    giftable: true,
  },
  {
    id: 'wild_honey',
    label: 'Orchard Honeycomb',
    category: 'flora_ingredient',
    description: 'Golden raw comb shared from the quiet bee skep at Fern Hollow.',
    giftable: true,
  },

  // Baked & Brewed at Cottage Hearth
  {
    id: 'chamomile_pear_tea',
    label: 'Warm Chamomile Tea',
    category: 'baked_treat',
    description: 'Steeped floral chamomile and honey poured warm from your kettle.',
    giftable: true,
  },
  {
    id: 'herb_loaf',
    label: 'Herb & Honey Loaf',
    category: 'baked_treat',
    description: 'Crusty hearth bread folded with lemon thyme and orchard honey.',
    giftable: true,
  },
  {
    id: 'crabapple_tart',
    label: 'Rustic Crabapple Tart',
    category: 'baked_treat',
    description: 'Flaky golden tartlet glazed with spiced Fern Hollow crabapple.',
    giftable: true,
  },
  {
    id: 'lavender_shortbread',
    label: 'Lavender Biscuits',
    category: 'baked_treat',
    description: 'Crisp butter shortbread flecked with fragrant sweet lavender.',
    giftable: true,
  },

  // Field Finds
  {
    id: 'smooth_river_glass',
    label: 'Amber Pond Glass',
    category: 'field_find',
    description: 'Water-tumbled amber and seafoam glass along Mirror Pond’s reed bank.',
    giftable: true,
  },
  {
    id: 'heron_feather',
    label: 'Silver Heron Feather',
    category: 'field_find',
    description: 'Soft slate-cream quill drifted calmly ashore beside the reeds.',
    giftable: true,
  },
  {
    id: 'pressed_fern',
    label: 'Pressed Fern Frond',
    category: 'field_find',
    description: 'Delicate woodland frond pressed flat for bookmarks and frames.',
    giftable: true,
  },
  {
    id: 'cedar_shaving_rose',
    label: 'Curled Cedar Rose',
    category: 'field_find',
    description: 'Fragrant wood-shaving blossom spiraled beneath Barnaby’s outdoor plane.',
    giftable: true,
  },

  // Keepsakes (displayable on Cottage Shelf, non-consumable gifts or earned mementos)
  {
    id: 'willow_zine_copy',
    label: 'Willow Lane Zine #1',
    category: 'keepsake',
    description: 'Hand-stitched neighborhood booklet with chalk drawings and lane stories.',
    homeDisplayable: 'shelf',
    giftable: false,
  },
  {
    id: 'brass_pocket_bell',
    label: 'Miniature Brass Chime',
    category: 'keepsake',
    description: 'A palm-sized turned brass bell from Arthur’s watchmaker bench.',
    homeDisplayable: 'shelf',
    giftable: false,
  },
  {
    id: 'pond_watercolor_card',
    label: 'Mirror Pond Watercolor',
    category: 'keepsake',
    description: 'Toby’s small ink-and-wash study of carp beneath the cedar bridge.',
    homeDisplayable: 'shelf',
    giftable: false,
  },
  {
    id: 'woven_herb_wreath',
    label: 'Woven Herb Wreath',
    category: 'keepsake',
    description: 'Dried chamomile, rosemary, and lavender braided cleanly by Mina & Clara.',
    homeDisplayable: 'shelf',
    giftable: false,
  },
  {
    id: 'cedar_music_box',
    label: 'Cedar Keepsake Dish',
    category: 'keepsake',
    description: 'Beeswax-rubbed heartwood cedar dish planed and signed by Barnaby.',
    homeDisplayable: 'shelf',
    giftable: false,
  },
];

export const PERSONAL_ITEM_MAP: Record<PersonalItemId, PersonalItemDef> = PERSONAL_ITEMS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<PersonalItemId, PersonalItemDef>,
);

export const VALID_PERSONAL_ITEM_IDS = new Set<PersonalItemId>(
  PERSONAL_ITEMS.map((item) => item.id),
);

export const HEARTH_RECIPES: readonly RecipeDef[] = [
  {
    id: 'recipe_chamomile_tea',
    outputItemId: 'chamomile_pear_tea',
    outputCount: 1,
    label: 'Brew Chamomile Honey Tea',
    description: 'Steep fresh chamomile blossoms in your copper kettle (+15m).',
    minutesRequired: 15,
    ingredients: [{ itemId: 'chamomile_blossom', count: 1 }],
  },
  {
    id: 'recipe_herb_loaf',
    outputItemId: 'herb_loaf',
    outputCount: 1,
    label: 'Bake Herb & Honey Loaf',
    description: 'Knead lemon thyme and wild honey into a warm hearth boule (+25m).',
    minutesRequired: 25,
    ingredients: [
      { itemId: 'lemon_thyme', count: 1 },
      { itemId: 'wild_honey', count: 1 },
    ],
  },
  {
    id: 'recipe_crabapple_tart',
    outputItemId: 'crabapple_tart',
    outputCount: 1,
    label: 'Bake Rustic Crabapple Tart',
    description: 'Glaze sliced orchard crabapples with honey in crisp pastry (+25m).',
    minutesRequired: 25,
    ingredients: [
      { itemId: 'crabapple', count: 1 },
      { itemId: 'wild_honey', count: 1 },
    ],
  },
  {
    id: 'recipe_lavender_shortbread',
    outputItemId: 'lavender_shortbread',
    outputCount: 1,
    label: 'Bake Lavender Butter Biscuits',
    description: 'Fold dried lavender and crisp orchard apple glaze into biscuit dough (+20m).',
    minutesRequired: 20,
    ingredients: [
      { itemId: 'lavender_sprig', count: 1 },
      { itemId: 'crabapple', count: 1 },
    ],
  },
];

export const RESIDENT_GIFT_PREFS: Record<
  ResidentId,
  { loved: readonly PersonalItemId[]; liked: readonly PersonalItemId[] }
> = {
  clara: {
    loved: ['crabapple', 'wild_honey', 'chamomile_pear_tea'],
    liked: ['lemon_thyme', 'lavender_sprig', 'herb_loaf', 'crabapple_tart'],
  },
  arthur: {
    loved: ['chamomile_pear_tea', 'herb_loaf', 'pressed_fern'],
    liked: ['crabapple_tart', 'cedar_shaving_rose', 'chamomile_blossom'],
  },
  mina: {
    loved: ['chamomile_blossom', 'lavender_sprig', 'pressed_fern'],
    liked: ['lemon_thyme', 'wild_honey', 'chamomile_pear_tea', 'crabapple'],
  },
  jun: {
    loved: ['lavender_shortbread', 'crabapple_tart', 'smooth_river_glass'],
    liked: ['chamomile_pear_tea', 'herb_loaf', 'crabapple'],
  },
  barnaby: {
    loved: ['herb_loaf', 'cedar_shaving_rose', 'crabapple_tart'],
    liked: ['wild_honey', 'crabapple', 'chamomile_pear_tea'],
  },
  sora: {
    loved: ['chamomile_pear_tea', 'heron_feather', 'lavender_shortbread'],
    liked: ['lavender_sprig', 'pressed_fern', 'chamomile_blossom'],
  },
  toby: {
    loved: ['smooth_river_glass', 'heron_feather', 'pressed_fern'],
    liked: ['lavender_shortbread', 'crabapple', 'cedar_shaving_rose'],
  },
  nora: {
    loved: ['pressed_fern', 'chamomile_pear_tea', 'lavender_shortbread'],
    liked: ['lavender_sprig', 'smooth_river_glass', 'crabapple_tart'],
  },
  pip: {
    loved: ['crabapple_tart', 'wild_honey', 'smooth_river_glass'],
    liked: ['lavender_shortbread', 'crabapple', 'heron_feather'],
  },
};

export interface NeighborKeepsakeReward {
  residentId: ResidentId;
  itemId: PersonalItemId;
  minAffinity: number;
  note: string;
}

export const NEIGHBOR_KEEPSAKE_REWARDS: readonly NeighborKeepsakeReward[] = [
  {
    residentId: 'pip',
    itemId: 'willow_zine_copy',
    minAffinity: 35,
    note: 'Pip tucked an extra hand-stitched Willow Lane Zine into your satchel to keep on your shelf.',
  },
  {
    residentId: 'toby',
    itemId: 'pond_watercolor_card',
    minAffinity: 40,
    note: 'Toby painted a pocket-sized carp watercolor from Mirror Pond especially for your cottage wall.',
  },
  {
    residentId: 'arthur',
    itemId: 'brass_pocket_bell',
    minAffinity: 45,
    note: 'Arthur turned a tiny brass chime at his lathe so your cottage shelf catches a warm ring.',
  },
  {
    residentId: 'mina',
    itemId: 'woven_herb_wreath',
    minAffinity: 40,
    note: 'Mina braided dried chamomile and rosemary into a small fragrant wreath for Willow Step Cottage.',
  },
  {
    residentId: 'barnaby',
    itemId: 'cedar_music_box',
    minAffinity: 45,
    note: 'Barnaby planed a beeswax-rubbed cedar keepsake dish for your cottage shelf.',
  },
];

export function createStarterInventory(): Partial<Record<PersonalItemId, number>> {
  return {
    chamomile_blossom: 1,
    lemon_thyme: 1,
  };
}

export function getItemCount(
  inventory: Partial<Record<PersonalItemId, number>> | undefined,
  itemId: PersonalItemId,
): number {
  const val = inventory?.[itemId];
  return typeof val === 'number' && Number.isFinite(val) && val > 0 ? Math.floor(val) : 0;
}

export function getTotalItemCount(
  inventory: Partial<Record<PersonalItemId, number>> | undefined,
): number {
  if (!inventory) return 0;
  let total = 0;
  for (const key of Object.keys(inventory) as PersonalItemId[]) {
    total += getItemCount(inventory, key);
  }
  return total;
}

export function addItemToInventory(
  inventory: Partial<Record<PersonalItemId, number>> | undefined,
  discoveredItemIds: readonly PersonalItemId[] | undefined,
  itemId: PersonalItemId,
  amount = 1,
): {
  inventory: Partial<Record<PersonalItemId, number>>;
  discoveredItemIds: PersonalItemId[];
  added: number;
} {
  const safeInv: Partial<Record<PersonalItemId, number>> = { ...(inventory ?? {}) };
  const safeDiscovered: PersonalItemId[] = [...(discoveredItemIds ?? [])];
  if (!VALID_PERSONAL_ITEM_IDS.has(itemId) || amount <= 0) {
    return { inventory: safeInv, discoveredItemIds: safeDiscovered, added: 0 };
  }
  const prev = getItemCount(safeInv, itemId);
  const clamped = Math.min(MAX_ITEM_STACK, prev + Math.floor(amount));
  const added = clamped - prev;
  if (clamped > 0) {
    safeInv[itemId] = clamped;
  }
  if (!safeDiscovered.includes(itemId)) {
    safeDiscovered.push(itemId);
  }
  return { inventory: safeInv, discoveredItemIds: safeDiscovered, added };
}

export function consumeItemFromInventory(
  inventory: Partial<Record<PersonalItemId, number>> | undefined,
  itemId: PersonalItemId,
  amount = 1,
): {
  ok: boolean;
  inventory: Partial<Record<PersonalItemId, number>>;
} {
  const safeInv: Partial<Record<PersonalItemId, number>> = { ...(inventory ?? {}) };
  const need = Math.max(1, Math.floor(amount));
  const have = getItemCount(safeInv, itemId);
  if (have < need) {
    return { ok: false, inventory: safeInv };
  }
  const rem = have - need;
  if (rem <= 0) {
    delete safeInv[itemId];
  } else {
    safeInv[itemId] = rem;
  }
  return { ok: true, inventory: safeInv };
}

export function canCraftRecipe(
  inventory: Partial<Record<PersonalItemId, number>> | undefined,
  recipe: RecipeDef,
): boolean {
  return recipe.ingredients.every(
    (ing) => getItemCount(inventory, ing.itemId) >= ing.count,
  );
}

export function getGiftReactionTier(
  residentId: ResidentId,
  itemId: PersonalItemId,
): GiftReactionTier {
  const def = PERSONAL_ITEM_MAP[itemId];
  const prefs = RESIDENT_GIFT_PREFS[residentId];
  if (prefs) {
    if (prefs.loved.includes(itemId)) return 'loved';
    if (prefs.liked.includes(itemId)) return 'liked';
  }
  if (def?.category === 'baked_treat') return 'liked';
  return 'neutral';
}

export function getOwnedGiftableItems(
  inventory: Partial<Record<PersonalItemId, number>> | undefined,
): Array<{ def: PersonalItemDef; count: number }> {
  const out: Array<{ def: PersonalItemDef; count: number }> = [];
  for (const def of PERSONAL_ITEMS) {
    if (!def.giftable) continue;
    const count = getItemCount(inventory, def.id);
    if (count > 0) {
      out.push({ def, count });
    }
  }
  return out;
}

export function getOwnedVaseFlowerItems(
  inventory: Partial<Record<PersonalItemId, number>> | undefined,
): Array<{ def: PersonalItemDef; count: number }> {
  const out: Array<{ def: PersonalItemDef; count: number }> = [];
  for (const def of PERSONAL_ITEMS) {
    if (def.homeDisplayable !== 'vase') continue;
    const count = getItemCount(inventory, def.id);
    if (count > 0) {
      out.push({ def, count });
    }
  }
  return out;
}

export function getOwnedKeepsakeItems(
  inventory: Partial<Record<PersonalItemId, number>> | undefined,
): PersonalItemDef[] {
  const out: PersonalItemDef[] = [];
  for (const def of PERSONAL_ITEMS) {
    if (def.homeDisplayable !== 'shelf') continue;
    if (getItemCount(inventory, def.id) > 0) {
      out.push(def);
    }
  }
  return out;
}
