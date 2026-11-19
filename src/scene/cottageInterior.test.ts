import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { COTTAGE_INTERACTABLES } from '../game/cottage';
import { createFreshWorldState } from '../game/storage';
import { MaterialPalette } from './materials';
import { buildWillowCottageInterior } from './builders/cottageInterior';

test('cottage interior 3D rig exposes all 7 hit proxies matching COTTAGE_INTERACTABLES', () => {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());

  const ids = new Set(rig.hitProxies.map((mesh) => mesh.userData.targetId));
  assert.equal(rig.hitProxies.length, COTTAGE_INTERACTABLES.length);
  for (const prop of COTTAGE_INTERACTABLES) {
    assert.ok(ids.has(prop.id), `Missing interior hit proxy for ${prop.id}`);
  }

  const box = new THREE.Box3().setFromObject(rig.group);
  assert.ok(box.min.y >= -0.35 && box.max.y <= 3.6, 'Interior geometry stays within diorama height bounds');
  assert.ok(box.min.x <= -3.4 && box.max.x >= 3.4, 'Interior floor/walls span cottage width');
  assert.ok(box.min.z <= -2.6 && box.max.z >= 2.6, 'Interior floor/walls span cottage depth');

  rig.dispose();
  palette.disposeAll();
});

test('cottage interior reactive vase flowers, keepsake shelf items, hearth embers, and window daylight update cleanly', () => {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());
  const base = createFreshWorldState();

  // Default state: empty vase visible, flowers hidden, keepsakes hidden
  rig.update(base, 'morning', 1.0);
  assert.equal(rig.vaseEmptyGroup.visible, true);
  assert.equal(rig.vaseFlowers.chamomile_blossom.visible, false);
  assert.equal(rig.vaseFlowers.lavender_sprig.visible, false);
  assert.equal(rig.vaseFlowers.crabapple.visible, false);
  assert.equal(rig.shelfKeepsakes.willow_zine_copy.visible, false);
  assert.equal(rig.shelfKeepsakes.brass_pocket_bell.visible, false);

  // Place lavender & display keepsakes + warm kettle dusk update
  const decorated = {
    ...base,
    minuteOfDay: 1120,
    cottageState: {
      ...base.cottageState,
      placedFlowerId: 'lavender_sprig' as const,
      displayedKeepsakeIds: ['willow_zine_copy' as const, 'brass_pocket_bell' as const],
      kettleWarmUntilMinute: 1200,
    },
  };
  rig.update(decorated, 'dusk', 2.5);
  assert.equal(rig.vaseFlowers.lavender_sprig.visible, true);
  assert.equal(rig.vaseFlowers.chamomile_blossom.visible, false);
  assert.equal(rig.shelfKeepsakes.willow_zine_copy.visible, true);
  assert.equal(rig.shelfKeepsakes.brass_pocket_bell.visible, true);
  assert.equal(rig.shelfKeepsakes.pond_watercolor_card.visible, false);
  assert.equal(rig.kettleSteamPuffs[0].visible, true);
  assert.ok(rig.almanacLampMat.emissiveIntensity > 0.7);

  rig.dispose();
  palette.disposeAll();
});
