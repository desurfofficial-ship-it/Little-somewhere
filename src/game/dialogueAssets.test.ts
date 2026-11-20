import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PORTRAIT_KEYS,
  SUBJECT_IMAGE_KEYS,
  buildResidentPortraitRecipe,
  resolvePortrait,
  resolveSubjectImage,
  subjectKeyForBakeryProp,
  subjectKeyForCopperwheelProp,
  subjectKeyForCottageProp,
  subjectKeyForGreenhouseProp,
  subjectKeyForNookProp,
  subjectKeyForPropId,
} from './dialogue/assets';
import { RESIDENTS } from './residents';
import type { ResidentId } from './types';

const ALL_RESIDENTS: ResidentId[] = [
  'clara',
  'arthur',
  'mina',
  'jun',
  'barnaby',
  'sora',
  'toby',
  'nora',
  'pip',
  'rowan',
];

test('default portrait keys exist for all 10 residents and resolve to procedural recipes', () => {
  assert.equal(ALL_RESIDENTS.length, 10);
  for (const id of ALL_RESIDENTS) {
    const key = DEFAULT_PORTRAIT_KEYS[id];
    assert.match(key, /^portrait_default_/);
    const desc = resolvePortrait(key, id);
    assert.equal(desc.kind, 'procedural');
    assert.ok(desc.kind === 'procedural');
    // Colors come from the resident definitions — portraits match the world cast
    assert.equal(desc.coatColor, RESIDENTS[id].appearance.coatColor);
    assert.equal(desc.hairColor, RESIDENTS[id].appearance.hairColor);
    assert.equal(desc.skinColor, RESIDENTS[id].appearance.skinColor);
    assert.equal(desc.accentColor, RESIDENTS[id].appearance.accentColor);
    assert.equal(desc.hatStyle, RESIDENTS[id].appearance.hatStyle);
  }
});

test('portrait recipes are visually distinct across the cast', () => {
  const recipes = ALL_RESIDENTS.map((id) => JSON.stringify(buildResidentPortraitRecipe(id)));
  assert.equal(new Set(recipes).size, 10, 'every resident portrait recipe is unique');
});

test('absent portrait key falls back to the session resident default (backward compatible)', () => {
  for (const id of ALL_RESIDENTS) {
    const desc = resolvePortrait(undefined, id);
    assert.equal(desc.kind, 'procedural');
    assert.ok(desc.kind === 'procedural' && desc.residentId === id);
    assert.equal(
      JSON.stringify(desc),
      JSON.stringify(resolvePortrait(DEFAULT_PORTRAIT_KEYS[id], id)),
    );
  }
});

test('unknown portrait keys never throw and stay paintable', () => {
  const desc = resolvePortrait('portrait_totally_unknown', 'nora');
  assert.equal(desc.kind, 'procedural');
  assert.ok(desc.kind === 'procedural' && desc.residentId === 'nora');
});

test('portrait_initial resolves the legacy coat-color initial treatment', () => {
  const desc = resolvePortrait('portrait_initial', 'clara');
  assert.equal(desc.kind, 'initial');
  assert.ok(desc.kind === 'initial');
  assert.equal(desc.initial, 'C');
  assert.equal(desc.color, RESIDENTS.clara.appearance.coatColor);
});

test('subject image keys resolve to procedural recipes with the authored scene', () => {
  for (const scene of Object.keys(SUBJECT_IMAGE_KEYS) as Array<keyof typeof SUBJECT_IMAGE_KEYS>) {
    const desc = resolveSubjectImage(SUBJECT_IMAGE_KEYS[scene]);
    assert.equal(desc.kind, 'procedural', `subject key ${SUBJECT_IMAGE_KEYS[scene]} must resolve`);
    assert.ok(desc.kind === 'procedural' && desc.subject === scene);
    assert.ok(desc.backdrop.startsWith('#'));
  }
});

test('unknown or absent subject keys resolve to the neutral fallback', () => {
  assert.equal(resolveSubjectImage(undefined).kind, 'fallback');
  assert.equal(resolveSubjectImage('subject_nonexistent').kind, 'fallback');
});

test('every world prop maps to a resolvable subject key', () => {
  const propIds = [
    'player_door',
    'player_mailbox',
    'gazebo_bell',
    'fountain_plaza',
    'hollow_oak',
    'plaza_noticeboard',
    'mirror_pond',
    'cottage_window_box',
    'greenhouse_planters',
    'orchard_harvest',
    'orchard_skep',
    'pond_driftwood',
    'greenhouse_door',
    'bakery_door',
    'nook_door',
    'copperwheel_door',
  ] as const;
  for (const propId of propIds) {
    const desc = resolveSubjectImage(subjectKeyForPropId(propId));
    assert.equal(desc.kind, 'procedural', `${propId} must map to a paintable subject`);
  }
});

test('every interior station id maps to a resolvable subject key', () => {
  const cottageIds = [
    'interior_door',
    'cottage_bed',
    'cottage_hearth',
    'cottage_table',
    'cottage_shelf',
    'cottage_desk',
    'cottage_planter',
  ] as const;
  const greenhouseIds = ['greenhouse_door', 'greenhouse_potting', 'greenhouse_shelf', 'greenhouse_water', 'greenhouse_table'] as const;
  const bakeryIds = ['bakery_door', 'bakery_oven', 'bakery_counter', 'bakery_prep', 'bakery_notes', 'bakery_table'] as const;
  const nookIds = ['nook_door', 'nook_shelf', 'nook_desk', 'nook_tea', 'nook_chair'] as const;
  const cwIds = ['cw_door', 'cw_bench', 'cw_stove', 'cw_shelf', 'cw_bed', 'cw_chair'] as const;

  for (const id of cottageIds) assert.equal(resolveSubjectImage(subjectKeyForCottageProp(id)).kind, 'procedural');
  for (const id of greenhouseIds) assert.equal(resolveSubjectImage(subjectKeyForGreenhouseProp(id)).kind, 'procedural');
  for (const id of bakeryIds) assert.equal(resolveSubjectImage(subjectKeyForBakeryProp(id)).kind, 'procedural');
  for (const id of nookIds) assert.equal(resolveSubjectImage(subjectKeyForNookProp(id)).kind, 'procedural');
  for (const id of cwIds) assert.equal(resolveSubjectImage(subjectKeyForCopperwheelProp(id)).kind, 'procedural');
});

test('resolvers are pure: identical inputs produce identical descriptors', () => {
  const a = JSON.stringify(resolvePortrait('portrait_default_jun', 'jun'));
  const b = JSON.stringify(resolvePortrait('portrait_default_jun', 'jun'));
  assert.equal(a, b);
  const c = JSON.stringify(resolveSubjectImage('subject_hearth'));
  const d = JSON.stringify(resolveSubjectImage('subject_hearth'));
  assert.equal(c, d);
});
