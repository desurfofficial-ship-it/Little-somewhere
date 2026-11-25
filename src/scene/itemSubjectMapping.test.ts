import test from 'node:test';
import assert from 'node:assert/strict';
import { PERSONAL_ITEMS } from '../game/inventory';
import { SUBJECT_IMAGE_KEYS, subjectForItem } from '../game/dialogue/assets';

/**
 * BUILD 04 (Doc 03 §9.3): every satchel item maps to a paintable subject scene
 * through the SAME SubjectCanvas painter — no item falls back to the yarn ball,
 * and every parametric item scene is registered.
 */
test('BUILD 04: all satchel items map to registered, tinted subject scenes', () => {
  assert.equal(PERSONAL_ITEMS.length, 34, 'the catalog holds exactly 34 items (25 baseline + 5 pond catches + 3 SC-B community-project keepsakes + 1 Photography framed-photo keepsake)');
  for (const item of PERSONAL_ITEMS) {
    const desc = subjectForItem(item.id);
    assert.equal(desc.kind, 'procedural', `${item.id} resolves a procedural subject`);
    if (desc.kind === 'procedural') {
      assert.ok(SUBJECT_IMAGE_KEYS[desc.subject], `${item.id} scene is registered`);
    }
  }
  // Distinct items get distinct art: the seed pouches differ by tone, but the
  // core goods (honey / tart / bell / zine ...) each own their scene.
  const scenes = new Set(
    PERSONAL_ITEMS.map((item) => {
      const desc = subjectForItem(item.id);
      return desc.kind === 'procedural' ? desc.subject : 'fallback';
    }),
  );
  assert.ok(scenes.size >= 14, `item art covers the catalog (${scenes.size} distinct scenes)`);
});
