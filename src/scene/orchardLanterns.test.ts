// src/scene/orchardLanterns.test.ts — Stage 2 scene-builder test for Orchard Lanterns rig.
import test from 'node:test';
import assert from 'node:assert';
import { MaterialPalette } from './materials';
import { buildOrchardLanternsRig } from './builders/orchardLanterns';

function findChild(group: { children: { name: string }[] }, name: string) {
  const child = group.children.find((c) => c.name === name);
  assert.ok(child, `expected child "${name}"`);
  return child as unknown as { visible: boolean };
}

test('Orchard Lanterns: stage 0 — all hidden', () => {
  const rig = buildOrchardLanternsRig(new MaterialPalette());
  const s = findChild(rig.group, 'lanternShells');
  const p = findChild(rig.group, 'lanternPartialGlow');
  const f = findChild(rig.group, 'lanternFullGlow');
  rig.setLanternStage(0);
  assert.equal(s.visible, false); assert.equal(p.visible, false); assert.equal(f.visible, false);
});
test('Orchard Lanterns: stage 1 — shells only', () => {
  const rig = buildOrchardLanternsRig(new MaterialPalette());
  rig.setLanternStage(1);
  assert.equal(findChild(rig.group, 'lanternShells').visible, true);
  assert.equal(findChild(rig.group, 'lanternPartialGlow').visible, false);
  assert.equal(findChild(rig.group, 'lanternFullGlow').visible, false);
});
test('Orchard Lanterns: stage 2 — shells + partial glow', () => {
  const rig = buildOrchardLanternsRig(new MaterialPalette());
  rig.setLanternStage(2);
  assert.equal(findChild(rig.group, 'lanternShells').visible, true);
  assert.equal(findChild(rig.group, 'lanternPartialGlow').visible, true);
  assert.equal(findChild(rig.group, 'lanternFullGlow').visible, false);
});
test('Orchard Lanterns: stage 3 — all visible', () => {
  const rig = buildOrchardLanternsRig(new MaterialPalette());
  rig.setLanternStage(3);
  assert.equal(findChild(rig.group, 'lanternShells').visible, true);
  assert.equal(findChild(rig.group, 'lanternPartialGlow').visible, true);
  assert.equal(findChild(rig.group, 'lanternFullGlow').visible, true);
});
test('Orchard Lanterns: idempotent', () => {
  const rig = buildOrchardLanternsRig(new MaterialPalette());
  rig.setLanternStage(2); rig.setLanternStage(2); rig.setLanternStage(2);
  assert.equal(findChild(rig.group, 'lanternShells').visible, true);
});
test('Orchard Lanterns: out-of-range', () => {
  const rig = buildOrchardLanternsRig(new MaterialPalette());
  rig.setLanternStage(-1);
  assert.equal(findChild(rig.group, 'lanternFullGlow').visible, false);
  rig.setLanternStage(99);
  assert.equal(findChild(rig.group, 'lanternFullGlow').visible, true);
});
test('Orchard Lanterns: initial state — all hidden', () => {
  const rig = buildOrchardLanternsRig(new MaterialPalette());
  assert.equal(findChild(rig.group, 'lanternShells').visible, false);
  assert.equal(findChild(rig.group, 'lanternPartialGlow').visible, false);
  assert.equal(findChild(rig.group, 'lanternFullGlow').visible, false);
});
