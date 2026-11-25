import { RESIDENTS } from '../residents';
import type {
  BakeryInteractableId,
  CottageInteractableId,
  CopperwheelInteractableId,
  GreenhouseInteractableId,
  NookInteractableId,
  PersonalItemId,
  PropInteractableId,
  ResidentId,
} from '../types';

/**
 * Dialogue visual identity assets (Priority 2, docs/research §08).
 *
 * PURE module — no DOM, no Three.js, no React. Everything here returns inert
 * *descriptors* (recipes); the UI layer paints them (see
 * `src/components/DialogueVisuals.tsx`). All visuals are procedural: zero
 * external assets, fully backward compatible — when a node carries no
 * `portraitKey`, the session resident's default portrait recipe applies, and
 * the legacy coat-color initial remains available as an explicit fallback.
 *
 * Keys are plain strings so content modules can adopt them gradually:
 *  - portrait keys:    `portrait_default_<residentId>` | `portrait_initial`
 *  - subject keys:     `subject_<scene>`
 */

// ---------------------------------------------------------------------------
// Portrait descriptors
// ---------------------------------------------------------------------------

export type KnitPattern = 'stripes' | 'braids' | 'dots' | 'chevrons' | 'cables' | 'plain';
export type PortraitExpression = 'smile' | 'soft' | 'thoughtful';
export type PortraitMotif =
  | 'none'
  | 'satchel'
  | 'watering_can'
  | 'violin'
  | 'sketchbook'
  | 'book'
  | 'loaf'
  | 'fruit_basket';

export interface PortraitRecipe {
  kind: 'procedural';
  residentId: ResidentId;
  /** Soft linen wash behind the figure (derived from the coat color). */
  backdrop: string;
  coatColor: string;
  hairColor: string;
  skinColor: string;
  accentColor: string;
  hatStyle: 'none' | 'beret' | 'cap' | 'straw' | 'hood' | 'bun';
  /** Yarn-stitch motif suggesting each neighbor's knitwear. */
  knitPattern: KnitPattern;
  expression: PortraitExpression;
  /** Small identity glyph rendered as a corner badge (matches the world prop). */
  motif: PortraitMotif;
}

/** Legacy fallback — the original coat-color initial treatment, unchanged. */
export interface PortraitInitialFallback {
  kind: 'initial';
  initial: string;
  color: string;
}

export type PortraitDescriptor = PortraitRecipe | PortraitInitialFallback;

/** Per-resident knit flavor — pattern + resting expression only; colors come from `RESIDENTS`. */
const RESIDENT_KNIT_FLAVOR: Record<ResidentId, { knitPattern: KnitPattern; expression: PortraitExpression }> = {
  clara: { knitPattern: 'chevrons', expression: 'smile' },
  arthur: { knitPattern: 'cables', expression: 'thoughtful' },
  mina: { knitPattern: 'dots', expression: 'soft' },
  jun: { knitPattern: 'stripes', expression: 'smile' },
  barnaby: { knitPattern: 'braids', expression: 'soft' },
  sora: { knitPattern: 'braids', expression: 'thoughtful' },
  toby: { knitPattern: 'dots', expression: 'smile' },
  nora: { knitPattern: 'cables', expression: 'soft' },
  pip: { knitPattern: 'stripes', expression: 'smile' },
  rowan: { knitPattern: 'chevrons', expression: 'soft' },
};

/** Authoritative default portrait keys — one per resident, all procedural. */
export const DEFAULT_PORTRAIT_KEYS: Record<ResidentId, string> = {
  clara: 'portrait_default_clara',
  arthur: 'portrait_default_arthur',
  mina: 'portrait_default_mina',
  jun: 'portrait_default_jun',
  barnaby: 'portrait_default_barnaby',
  sora: 'portrait_default_sora',
  toby: 'portrait_default_toby',
  nora: 'portrait_default_nora',
  pip: 'portrait_default_pip',
  rowan: 'portrait_default_rowan',
};

/** Pure hex mix (no DOM): t = 0 → a, t = 1 → b. */
function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255;
  const ag = (pa >> 8) & 255;
  const ab = pa & 255;
  const br = (pb >> 16) & 255;
  const bg = (pb >> 8) & 255;
  const bb = pb & 255;
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  const r = mix(ar, br);
  const g = mix(ag, bg);
  const bl = mix(ab, bb);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

const PORTRAIT_BACKDROP_CREAM = '#FAF5EC';

/** Builds the default knit-portrait recipe for a resident (pure; derives from appearance). */
export function buildResidentPortraitRecipe(residentId: ResidentId): PortraitRecipe {
  const flavor = RESIDENT_KNIT_FLAVOR[residentId];
  const appearance = RESIDENTS[residentId].appearance;
  const motif = appearance.propType as PortraitMotif;
  return {
    kind: 'procedural',
    residentId,
    backdrop: mixHex(appearance.coatColor, PORTRAIT_BACKDROP_CREAM, 0.78),
    coatColor: appearance.coatColor,
    hairColor: appearance.hairColor,
    skinColor: appearance.skinColor,
    accentColor: appearance.accentColor,
    hatStyle: appearance.hatStyle,
    knitPattern: flavor.knitPattern,
    expression: flavor.expression,
    motif: motif ?? 'none',
  };
}

/**
 * Resolves a node's `portraitKey` into a paintable descriptor.
 * - `undefined` (the overwhelmingly common case today) → the session resident's
 *   default procedural knit portrait.
 * - `portrait_default_<id>` → that resident's default portrait (lets a node show
 *   a different speaker than the session owner, e.g. quoted letters).
 * - `portrait_initial` → the legacy coat-color initial treatment.
 * - Unknown keys never throw: they fall back to the session resident's portrait.
 */
export function resolvePortrait(
  key: string | undefined,
  residentId: ResidentId,
): PortraitDescriptor {
  if (key === 'portrait_initial') {
    const def = RESIDENTS[residentId];
    return {
      kind: 'initial',
      initial: def.name.charAt(0),
      color: def.appearance.coatColor,
    };
  }
  if (key && key.startsWith('portrait_default_')) {
    const target = key.slice('portrait_default_'.length) as ResidentId;
    if (target in RESIDENT_KNIT_FLAVOR) {
      return buildResidentPortraitRecipe(target);
    }
  }
  return buildResidentPortraitRecipe(residentId);
}

// ---------------------------------------------------------------------------
// Subject (object / environment) descriptors
// ---------------------------------------------------------------------------

export type SubjectScene =
  // cottage
  | 'oak_table'
  | 'hearth'
  | 'flower_vase'
  | 'book_shelf'
  | 'writing_desk'
  | 'planter_box'
  | 'bed_quilt'
  | 'doorway'
  // greenhouse
  | 'potting_bench'
  | 'watering_can'
  | 'seed_shelf'
  | 'greenhouse_table'
  // bakery
  | 'bakery_oven'
  | 'bakery_counter'
  | 'prep_table'
  | 'notes_shelf'
  | 'cafe_table'
  | 'loaf'
  // book nook
  | 'reading_chair'
  | 'tea_console'
  // copperwheel
  | 'workbench'
  | 'kettle_stove'
  | 'brass_shelf'
  // outdoors
  | 'fountain'
  | 'noticeboard'
  | 'hollow_oak'
  | 'mirror_pond'
  | 'window_box'
  | 'orchard_basket'
  | 'bee_skep'
  | 'driftwood'
  | 'gazebo_bell'
  | 'mailbox'
  // the wild hollows (Build 10)
  | 'stone_well'
  | 'wildflower'
  | 'bee_log'
  // rituals
  | 'teacup'
  // satchel item thumbnails (BUILD 04, Doc 03 §9.3 — the SAME SubjectCanvas
  // painter, tinted scenes; no new systems). Parametric scenes take their
  // personality from the recipe's primary/accent tones.
  | 'item_sprig'
  | 'item_seeds'
  | 'item_honey_jar'
  | 'item_tart'
  | 'item_shortbread'
  | 'item_river_glass'
  | 'item_feather'
  | 'item_fern'
  | 'item_cedar_rose'
  | 'item_zine'
  | 'item_bell'
  | 'item_watercolor_card'
  | 'item_wreath'
  | 'item_music_box'
  // Stage 3 (Willow Jetty fishing): pond catches use the parametric fish scene.
  | 'item_fish';

export interface SubjectRecipe {
  kind: 'procedural';
  subject: SubjectScene;
  /** Linen backdrop tint for the illustration card. */
  backdrop: string;
  /** Wood / material tones the painter may rely on. */
  wood: string;
  primary: string;
  accent: string;
}

export interface SubjectFallback {
  kind: 'fallback';
}

export type SubjectDescriptor = SubjectRecipe | SubjectFallback;

const SUBJECT_BACKDROP = '#F1E8D9';
const SUBJECT_WOOD = '#A8805B';
const SUBJECT_PRIMARY = '#5E8062';
const SUBJECT_ACCENT = '#C86446';

/**
 * Registry of authored subject keys. Content modules and prop interactions
 * reference these; `resolveSubjectImage` always returns something paintable.
 */
export const SUBJECT_IMAGE_KEYS: Record<SubjectScene, string> = {
  oak_table: 'subject_oak_table',
  hearth: 'subject_hearth',
  flower_vase: 'subject_flower_vase',
  book_shelf: 'subject_book_shelf',
  writing_desk: 'subject_writing_desk',
  planter_box: 'subject_planter_box',
  bed_quilt: 'subject_bed_quilt',
  doorway: 'subject_doorway',
  potting_bench: 'subject_potting_bench',
  watering_can: 'subject_watering_can',
  seed_shelf: 'subject_seed_shelf',
  greenhouse_table: 'subject_greenhouse_table',
  bakery_oven: 'subject_bakery_oven',
  bakery_counter: 'subject_bakery_counter',
  prep_table: 'subject_prep_table',
  notes_shelf: 'subject_notes_shelf',
  cafe_table: 'subject_cafe_table',
  loaf: 'subject_loaf',
  reading_chair: 'subject_reading_chair',
  tea_console: 'subject_tea_console',
  workbench: 'subject_workbench',
  kettle_stove: 'subject_kettle_stove',
  brass_shelf: 'subject_brass_shelf',
  fountain: 'subject_fountain',
  noticeboard: 'subject_noticeboard',
  hollow_oak: 'subject_hollow_oak',
  mirror_pond: 'subject_mirror_pond',
  window_box: 'subject_window_box',
  orchard_basket: 'subject_orchard_basket',
  bee_skep: 'subject_bee_skep',
  driftwood: 'subject_driftwood',
  gazebo_bell: 'subject_gazebo_bell',
  mailbox: 'subject_mailbox',
  teacup: 'subject_teacup',
  stone_well: 'subject_stone_well',
  wildflower: 'subject_wildflower',
  bee_log: 'subject_bee_log',
  item_sprig: 'subject_item_sprig',
  item_seeds: 'subject_item_seeds',
  item_honey_jar: 'subject_item_honey_jar',
  item_tart: 'subject_item_tart',
  item_shortbread: 'subject_item_shortbread',
  item_river_glass: 'subject_item_river_glass',
  item_feather: 'subject_item_feather',
  item_fern: 'subject_item_fern',
  item_cedar_rose: 'subject_item_cedar_rose',
  item_zine: 'subject_item_zine',
  item_bell: 'subject_item_bell',
  item_watercolor_card: 'subject_item_watercolor_card',
  item_wreath: 'subject_item_wreath',
  item_music_box: 'subject_item_music_box',
  item_fish: 'subject_item_fish',
};

/** World-prop interactions → their subject key (Priority 2 task 5 wiring). */
export function subjectKeyForPropId(propId: PropInteractableId): string {
  switch (propId) {
    case 'player_door':
      return SUBJECT_IMAGE_KEYS.doorway;
    case 'player_mailbox':
      return SUBJECT_IMAGE_KEYS.mailbox;
    case 'gazebo_bell':
      return SUBJECT_IMAGE_KEYS.gazebo_bell;
    case 'fountain_plaza':
      return SUBJECT_IMAGE_KEYS.fountain;
    case 'hollow_oak':
      return SUBJECT_IMAGE_KEYS.hollow_oak;
    case 'plaza_noticeboard':
      return SUBJECT_IMAGE_KEYS.noticeboard;
    case 'willow_jetty':
      // The jetty card borrows the pond vista (same shore, one quiet cast).
      return SUBJECT_IMAGE_KEYS.mirror_pond;
    case 'west_brook_bank':
      // The brook card borrows the pond vista too (one watershed, one quiet cast).
      return SUBJECT_IMAGE_KEYS.mirror_pond;
    case 'mirror_pond':
      return SUBJECT_IMAGE_KEYS.mirror_pond;
    case 'cottage_window_box':
      return SUBJECT_IMAGE_KEYS.window_box;
    case 'greenhouse_planters':
      return SUBJECT_IMAGE_KEYS.planter_box;
    case 'orchard_harvest':
      return SUBJECT_IMAGE_KEYS.orchard_basket;
    case 'orchard_skep':
      return SUBJECT_IMAGE_KEYS.bee_skep;
    case 'pond_driftwood':
      return SUBJECT_IMAGE_KEYS.driftwood;
    case 'greenhouse_door':
    case 'bakery_door':
    case 'nook_door':
    case 'copperwheel_door':
      return SUBJECT_IMAGE_KEYS.doorway;
    case 'old_stone_well':
      return SUBJECT_IMAGE_KEYS.stone_well;
    case 'rise_vista':
    case 'marigold_bank':
      return SUBJECT_IMAGE_KEYS.wildflower;
    case 'wild_bee_log':
      return SUBJECT_IMAGE_KEYS.bee_log;
    case 'sorrel_garden_bed':
      return SUBJECT_IMAGE_KEYS.wildflower;
  }
}

export function subjectKeyForCottageProp(id: CottageInteractableId): string | undefined {
  switch (id) {
    case 'cottage_bed':
      return SUBJECT_IMAGE_KEYS.bed_quilt;
    case 'cottage_hearth':
      return SUBJECT_IMAGE_KEYS.hearth;
    case 'cottage_table':
      return SUBJECT_IMAGE_KEYS.oak_table;
    case 'cottage_shelf':
      return SUBJECT_IMAGE_KEYS.book_shelf;
    case 'cottage_desk':
      return SUBJECT_IMAGE_KEYS.writing_desk;
    case 'cottage_planter':
      return SUBJECT_IMAGE_KEYS.planter_box;
    case 'interior_door':
      return SUBJECT_IMAGE_KEYS.doorway;
  }
}

export function subjectKeyForGreenhouseProp(id: GreenhouseInteractableId): string | undefined {
  switch (id) {
    case 'greenhouse_potting':
      return SUBJECT_IMAGE_KEYS.potting_bench;
    case 'greenhouse_shelf':
      return SUBJECT_IMAGE_KEYS.seed_shelf;
    case 'greenhouse_water':
      return SUBJECT_IMAGE_KEYS.watering_can;
    case 'greenhouse_table':
      return SUBJECT_IMAGE_KEYS.greenhouse_table;
    case 'greenhouse_door':
      return SUBJECT_IMAGE_KEYS.doorway;
  }
}

export function subjectKeyForBakeryProp(id: BakeryInteractableId): string | undefined {
  switch (id) {
    case 'bakery_oven':
      return SUBJECT_IMAGE_KEYS.bakery_oven;
    case 'bakery_counter':
      return SUBJECT_IMAGE_KEYS.bakery_counter;
    case 'bakery_prep':
      return SUBJECT_IMAGE_KEYS.prep_table;
    case 'bakery_notes':
      return SUBJECT_IMAGE_KEYS.notes_shelf;
    case 'bakery_table':
      return SUBJECT_IMAGE_KEYS.cafe_table;
    case 'bakery_door':
      return SUBJECT_IMAGE_KEYS.doorway;
  }
}

export function subjectKeyForNookProp(id: NookInteractableId): string | undefined {
  switch (id) {
    case 'nook_shelf':
      return SUBJECT_IMAGE_KEYS.book_shelf;
    case 'nook_desk':
      return SUBJECT_IMAGE_KEYS.writing_desk;
    case 'nook_tea':
      return SUBJECT_IMAGE_KEYS.tea_console;
    case 'nook_chair':
      return SUBJECT_IMAGE_KEYS.reading_chair;
    case 'nook_door':
      return SUBJECT_IMAGE_KEYS.doorway;
  }
}

export function subjectKeyForCopperwheelProp(id: CopperwheelInteractableId): string | undefined {
  switch (id) {
    case 'cw_bench':
      return SUBJECT_IMAGE_KEYS.workbench;
    case 'cw_stove':
      return SUBJECT_IMAGE_KEYS.kettle_stove;
    case 'cw_shelf':
      return SUBJECT_IMAGE_KEYS.brass_shelf;
    case 'cw_bed':
      return SUBJECT_IMAGE_KEYS.bed_quilt;
    case 'cw_chair':
      return SUBJECT_IMAGE_KEYS.reading_chair;
    case 'cw_door':
      return SUBJECT_IMAGE_KEYS.doorway;
  }
}

/**
 * Resolves a subject image key into a paintable descriptor.
 * Unknown / undefined keys yield the neutral `{ kind: 'fallback' }` motif so the
 * UI can render a quiet yarn-ball placeholder instead of nothing.
 */
export function resolveSubjectImage(key: string | undefined): SubjectDescriptor {
  for (const scene of Object.keys(SUBJECT_IMAGE_KEYS) as SubjectScene[]) {
    if (key === SUBJECT_IMAGE_KEYS[scene]) {
      return {
        kind: 'procedural',
        subject: scene,
        backdrop: SUBJECT_BACKDROP,
        wood: SUBJECT_WOOD,
        primary: SUBJECT_PRIMARY,
        accent: SUBJECT_ACCENT,
      };
    }
  }
  return { kind: 'fallback' };
}

// ---------------------------------------------------------------------------
// BUILD 04 (Doc 03 §9.3): satchel item thumbnails — the 25-item catalog gets
// tinted canvas thumbnails by reusing the SAME SubjectCanvas painter. Pure
// data: each item maps to an existing (or new parametric) subject scene with
// item-specific tones. No new systems; unknown ids fall back to the yarn ball.
// ---------------------------------------------------------------------------

const ITEM_BACKDROP = '#FBF3E4';

interface ItemSubjectSpec {
  subject: SubjectScene;
  primary: string;
  accent?: string;
}

const ITEM_SUBJECT_SPECS: Record<PersonalItemId, ItemSubjectSpec> = {
  crabapple: { subject: 'item_sprig', primary: '#C86446', accent: '#5E8062' },
  lemon_thyme: { subject: 'item_sprig', primary: '#E5C96B', accent: '#7B9F5C' },
  chamomile_blossom: { subject: 'item_sprig', primary: '#FAF5EC', accent: '#E5A93C' },
  lavender_sprig: { subject: 'item_sprig', primary: '#9B8BC4', accent: '#5E8062' },
  wild_honey: { subject: 'item_honey_jar', primary: '#E5A93C', accent: '#B45539' },
  chamomile_seeds: { subject: 'item_seeds', primary: '#E5A93C', accent: '#7B9F5C' },
  lavender_seeds: { subject: 'item_seeds', primary: '#9B8BC4', accent: '#7B9F5C' },
  thyme_seeds: { subject: 'item_seeds', primary: '#5E8062', accent: '#E5A93C' },
  foxglove_seeds: { subject: 'item_seeds', primary: '#C96E93', accent: '#7B9F5C' },
  foxglove_bloom: { subject: 'item_sprig', primary: '#C96E93', accent: '#5E8062' },
  meadow_posy: { subject: 'item_sprig', primary: '#C86446', accent: '#E5A93C' },
  // Stage 3 (Willow Jetty fishing): pond catches, tinted per species.
  silver_dace: { subject: 'item_fish', primary: '#B8C6CC', accent: '#5E8062' },
  sun_perch: { subject: 'item_fish', primary: '#E5A93C', accent: '#C86446' },
  rain_trout: { subject: 'item_fish', primary: '#6E8C7B', accent: '#E5A93C' },
  mirror_carp: { subject: 'item_fish', primary: '#C99A5B', accent: '#E5A93C' },
  ice_perch: { subject: 'item_fish', primary: '#B8D4DC', accent: '#5E8062' },
  chamomile_pear_tea: { subject: 'teacup', primary: '#E5A93C', accent: '#5E8062' },
  lavender_chamomile_tea: { subject: 'teacup', primary: '#9B8BC4', accent: '#E5A93C' },
  herb_loaf: { subject: 'loaf', primary: '#C99A5B', accent: '#7B9F5C' },
  crabapple_tart: { subject: 'item_tart', primary: '#C86446', accent: '#E5C96B' },
  lavender_shortbread: { subject: 'item_shortbread', primary: '#E5C96B', accent: '#9B8BC4' },
  smooth_river_glass: { subject: 'item_river_glass', primary: '#7FB5C4', accent: '#FAF5EC' },
  heron_feather: { subject: 'item_feather', primary: '#B8C6CF', accent: '#5E8062' },
  pressed_fern: { subject: 'item_fern', primary: '#5E8062', accent: '#7B9F5C' },
  cedar_shaving_rose: { subject: 'item_cedar_rose', primary: '#A8805B', accent: '#8F6A3C' },
  willow_zine_copy: { subject: 'item_zine', primary: '#5E8062', accent: '#C86446' },
  brass_pocket_bell: { subject: 'item_bell', primary: '#C9A253', accent: '#8C7D6F' },
  pond_watercolor_card: { subject: 'item_watercolor_card', primary: '#7FB5C4', accent: '#C86446' },
  woven_herb_wreath: { subject: 'item_wreath', primary: '#5E8062', accent: '#E5A93C' },
  cedar_music_box: { subject: 'item_music_box', primary: '#A8805B', accent: '#C9A253' },
};

/** Resolves a satchel item id into its paintable subject thumbnail descriptor. */
export function subjectForItem(itemId: PersonalItemId): SubjectDescriptor {
  const spec = ITEM_SUBJECT_SPECS[itemId];
  if (!spec) return { kind: 'fallback' };
  return {
    kind: 'procedural',
    subject: spec.subject,
    backdrop: ITEM_BACKDROP,
    wood: SUBJECT_WOOD,
    primary: spec.primary,
    accent: spec.accent ?? SUBJECT_ACCENT,
  };
}
