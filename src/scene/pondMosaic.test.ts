// src/scene/pondMosaic.test.ts — Stage 2 scene-builder test for Pond Mosaic rig.
import test from 'node:test';
import assert from 'node:assert';
import { MaterialPalette } from './materials';
import { buildPondMosaicRig } from './builders/pondMosaic';

function findChild(group: { children: { name: string }[] }, name: string) {
  const child = group.children.find((c) => c.name === name);
  assert.ok(child, `expected child "${name}"`);
  return child as unknown as {
    visible: boolean;
    children: Array<{ position: { y: number }; name?: string }>;
  };
}

test('Pond Mosaic: stage 0 — all hidden', () => {
  const rig = buildPondMosaicRig(new MaterialPalette());
  const f = findChild(rig.group, 'mosaicFirst');
  const p = findChild(rig.group, 'mosaicPartial');
  const l = findChild(rig.group, 'mosaicFull');
  rig.setMosaicStage(0);
  assert.equal(f.visible, false); assert.equal(p.visible, false); assert.equal(l.visible, false);
});
test('Pond Mosaic: stage 1 — mosaicFirst only', () => {
  const rig = buildPondMosaicRig(new MaterialPalette());
  rig.setMosaicStage(1);
  assert.equal(findChild(rig.group, 'mosaicFirst').visible, true);
  assert.equal(findChild(rig.group, 'mosaicPartial').visible, false);
  assert.equal(findChild(rig.group, 'mosaicFull').visible, false);
});
test('Pond Mosaic: stage 2 — mosaicFirst + mosaicPartial', () => {
  const rig = buildPondMosaicRig(new MaterialPalette());
  rig.setMosaicStage(2);
  assert.equal(findChild(rig.group, 'mosaicFirst').visible, true);
  assert.equal(findChild(rig.group, 'mosaicPartial').visible, true);
  assert.equal(findChild(rig.group, 'mosaicFull').visible, false);
});
test('Pond Mosaic: stage 3 — all visible', () => {
  const rig = buildPondMosaicRig(new MaterialPalette());
  rig.setMosaicStage(3);
  assert.equal(findChild(rig.group, 'mosaicFirst').visible, true);
  assert.equal(findChild(rig.group, 'mosaicPartial').visible, true);
  assert.equal(findChild(rig.group, 'mosaicFull').visible, true);
});
test('Pond Mosaic: idempotent', () => {
  const rig = buildPondMosaicRig(new MaterialPalette());
  rig.setMosaicStage(2); rig.setMosaicStage(2); rig.setMosaicStage(2);
  assert.equal(findChild(rig.group, 'mosaicFirst').visible, true);
  assert.equal(findChild(rig.group, 'mosaicFull').visible, false);
});
test('Pond Mosaic: out-of-range (-1 / 99)', () => {
  const rig = buildPondMosaicRig(new MaterialPalette());
  rig.setMosaicStage(-1);
  assert.equal(findChild(rig.group, 'mosaicFirst').visible, false);
  assert.equal(findChild(rig.group, 'mosaicFull').visible, false);
  rig.setMosaicStage(99);
  assert.equal(findChild(rig.group, 'mosaicFirst').visible, true);
  assert.equal(findChild(rig.group, 'mosaicFull').visible, true);
});
test('Pond Mosaic: initial state — all hidden', () => {
  const rig = buildPondMosaicRig(new MaterialPalette());
  assert.equal(findChild(rig.group, 'mosaicFirst').visible, false);
  assert.equal(findChild(rig.group, 'mosaicPartial').visible, false);
  assert.equal(findChild(rig.group, 'mosaicFull').visible, false);
});
test('Pond Mosaic: parent group name', () => {
  const rig = buildPondMosaicRig(new MaterialPalette());
  assert.equal(rig.group.name, 'pondMosaicRig');
});
test('Pond Mosaic: mesh count ≤ 12 per sub-group', () => {
  const rig = buildPondMosaicRig(new MaterialPalette());
  for (const name of ['mosaicFirst', 'mosaicPartial', 'mosaicFull']) {
    const sg = findChild(rig.group, name);
    assert.ok(sg.children.length <= 12, `${name} has ${sg.children.length} meshes, expected ≤ 12`);
  }
});
test('Pond Mosaic: tile y-position in [0.16, 0.20]', () => {
  const rig = buildPondMosaicRig(new MaterialPalette());
  for (const name of ['mosaicFirst', 'mosaicPartial', 'mosaicFull']) {
    const sg = findChild(rig.group, name);
    for (const mesh of sg.children) {
      const y = mesh.position.y;
      assert.ok(y >= 0.16 && y <= 0.20, `${name} tile y=${y} out of [0.16, 0.20]`);
    }
  }
});
