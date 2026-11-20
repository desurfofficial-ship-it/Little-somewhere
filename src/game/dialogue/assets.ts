import { RESIDENTS } from '../residents';
import type {
  BakeryInteractableId,
  CottageInteractableId,
  CopperwheelInteractableId,
  GreenhouseInteractableId,
  NookInteractableId,
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
  // rituals
  | 'teacup';

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
