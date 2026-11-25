// src/scene/plazaGarland.test.ts — Stage 2 scene-builder test for Plaza Garlands rig.
import test from 'node:test';
import assert from 'node:assert';
import { MaterialPalette } from './materials';
import { buildPlazaGarlandRig } from './builders/plazaGarland';

function findChild(group: { children: { name: string }[] }, name: string) {
  const child = group.children.find((c) => c.name === name);
  assert.ok(child, `expected child "${name}"`);
  return child as unknown as { visible: boolean };
}

test('Plaza Garlands: stage 0 — all hidden', () => {
  const rig = buildPlazaGarlandRig(new MaterialPalette());
  const t = findChild(rig.group, 'garlandTwine');
  const p = findChild(rig.group, 'garlandPartial');
  const f = findChild(rig.group, 'garlandFull');
  rig.setGarlandStage(0);
  assert.equal(t.visible, false); assert.equal(p.visible, false); assert.equal(f.visible, false);
});
test('Plaza Garlands: stage 1 — twine only', () => {
  const rig = buildPlazaGarlandRig(new MaterialPalette());
  rig.setGarlandStage(1);
  assert.equal(findChild(rig.group, 'garlandTwine').visible, true);
  assert.equal(findChild(rig.group, 'garlandPartial').visible, false);
  assert.equal(findChild(rig.group, 'garlandFull').visible, false);
});
test('Plaza Garlands: stage 2 — twine + partial', () => {
  const rig = buildPlazaGarlandRig(new MaterialPalette());
  rig.setGarlandStage(2);
  assert.equal(findChild(rig.group, 'garlandTwine').visible, true);
  assert.equal(findChild(rig.group, 'garlandPartial').visible, true);
  assert.equal(findChild(rig.group, 'garlandFull').visible, false);
});
test('Plaza Garlands: stage 3 — all visible', () => {
  const rig = buildPlazaGarlandRig(new MaterialPalette());
  rig.setGarlandStage(3);
  assert.equal(findChild(rig.group, 'garlandTwine').visible, true);
  assert.equal(findChild(rig.group, 'garlandPartial').visible, true);
  assert.equal(findChild(rig.group, 'garlandFull').visible, true);
});
test('Plaza Garlands: idempotent', () => {
  const rig = buildPlazaGarlandRig(new MaterialPalette());
  rig.setGarlandStage(2); rig.setGarlandStage(2); rig.setGarlandStage(2);
  assert.equal(findChild(rig.group, 'garlandTwine').visible, true);
});
test('Plaza Garlands: out-of-range', () => {
  const rig = buildPlazaGarlandRig(new MaterialPalette());
  rig.setGarlandStage(-1);
  assert.equal(findChild(rig.group, 'garlandFull').visible, false);
  rig.setGarlandStage(99);
  assert.equal(findChild(rig.group, 'garlandFull').visible, true);
});
test('Plaza Garlands: initial state — all hidden', () => {
  const rig = buildPlazaGarlandRig(new MaterialPalette());
  assert.equal(findChild(rig.group, 'garlandTwine').visible, false);
  assert.equal(findChild(rig.group, 'garlandPartial').visible, false);
  assert.equal(findChild(rig.group, 'garlandFull').visible, false);
});
