/**
 * Adversarial shelf QA — Stage 3 Continuation (Agent E).
 *
 * Independent verification of the cottage keepsake display system after the
 * shelf architecture evolution to a unified `shelfKeepsakeMeshes` map. Tests
 * actual scene structure and geometry, not source-string assertions.
 *
 * Coverage matrix:
 *   SK-01..09  each of the 9 keepsake meshes exists and defaults hidden
 *   SK-10      displaying a keepsake makes only its mesh visible
 *   SK-11      toggle off hides the mesh
 *   SK-12      re-toggle restores visibility
 *   SK-13      all 9 can be addressed without collision (distinct meshes)
 *   SK-14      the 3 community keepsakes + framed photo toggle via the real action
 *   SK-15      the 5-slot cap is enforced for the new keepsakes too
 *   SK-16      persistence — serialize/deserialize preserves displayedKeepsakeIds
 *   SK-17      corruption — unknown ids in displayedKeepsakeIds don't crash the renderer
 *   SK-18      mesh integrity — every keepsake group has real children (not empty)
 *   SK-19      position sanity — every keepsake sits within the shelf bounds
 *   SK-20      regression — the 5 original keepsakes still work
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildWillowCottageInterior } from './builders/cottageInterior';
import { MaterialPalette } from './materials';
import { createFreshWorldState, serializeWorldState, deserializeWorldState } from '../game/storage';
import { toggleDisplayedKeepsakeAction } from '../game/actions';
import { getOwnedKeepsakeItems, PERSONAL_ITEM_MAP } from '../game/inventory';
import type { PersonalItemId, WorldState } from '../game/types';

const ALL_KEEPSAKE_IDS = [
  'willow_zine_copy',
  'brass_pocket_bell',
  'pond_watercolor_card',
  'woven_herb_wreath',
  'cedar_music_box',
  'pressed_garland_bloom',
  'orchard_lantern_charm',
  'pond_mosaic_shard',
  'framed_photo_keepsake',
] as const;

function buildRig() {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());
  return { rig, palette };
}

test('SK-01..09: every keepsake mesh exists in the unified map and defaults hidden', () => {
  const { rig, palette } = buildRig();
  const world = createFreshWorldState();
  rig.update(world, 'morning', 1.0);
  for (const id of ALL_KEEPSAKE_IDS) {
    const mesh = rig.shelfKeepsakeMeshes[id];
    assert.ok(mesh instanceof THREE.Group, `${id} has a Group in shelfKeepsakeMeshes`);
    assert.equal(mesh.visible, false, `${id} defaults hidden on a fresh world`);
  }
  rig.dispose();
  palette.disposeAll();
});

test('SK-10: displaying a single keepsake makes only its mesh visible', () => {
  const { rig, palette } = buildRig();
  const base = createFreshWorldState();
  const world: WorldState = {
    ...base,
    cottageState: {
      ...base.cottageState,
      displayedKeepsakeIds: ['orchard_lantern_charm' as PersonalItemId],
    },
  };
  rig.update(world, 'morning', 1.0);
  assert.equal(rig.shelfKeepsakeMeshes.orchard_lantern_charm.visible, true, 'displayed keepsake visible');
  for (const id of ALL_KEEPSAKE_IDS) {
    if (id === 'orchard_lantern_charm') continue;
    assert.equal(rig.shelfKeepsakeMeshes[id].visible, false, `${id} stays hidden when not displayed`);
  }
  rig.dispose();
  palette.disposeAll();
});

test('SK-11/12: toggle off then re-toggle restores visibility', () => {
  const { rig, palette } = buildRig();
  const base = createFreshWorldState();
  // Display pond_mosaic_shard.
  const on: WorldState = {
    ...base,
    cottageState: { ...base.cottageState, displayedKeepsakeIds: ['pond_mosaic_shard' as PersonalItemId] },
  };
  rig.update(on, 'morning', 1.0);
  assert.equal(rig.shelfKeepsakeMeshes.pond_mosaic_shard.visible, true, 'on');
  // Toggle off.
  const off: WorldState = {
    ...on,
    cottageState: { ...on.cottageState, displayedKeepsakeIds: [] },
  };
  rig.update(off, 'morning', 1.0);
  assert.equal(rig.shelfKeepsakeMeshes.pond_mosaic_shard.visible, false, 'off');
  // Re-toggle on.
  rig.update(on, 'morning', 1.0);
  assert.equal(rig.shelfKeepsakeMeshes.pond_mosaic_shard.visible, true, 're-on');
  rig.dispose();
  palette.disposeAll();
});

test('SK-13: every keepsake maps to a DISTINCT mesh (no aliasing)', () => {
  const { rig, palette } = buildRig();
  const meshes = ALL_KEEPSAKE_IDS.map((id) => rig.shelfKeepsakeMeshes[id]);
  const unique = new Set(meshes);
  assert.equal(unique.size, ALL_KEEPSAKE_IDS.length, '9 keepsakes → 9 distinct Group objects');
  rig.dispose();
  palette.disposeAll();
});

test('SK-14: the 3 community keepsakes + framed photo toggle via the real action', () => {
  const { rig, palette } = buildRig();
  let world = createFreshWorldState();
  // Grant the 4 new keepsakes to the satchel so the toggle action accepts them.
  world = {
    ...world,
    inventory: {
      ...world.inventory,
      ['pressed_garland_bloom' as PersonalItemId]: 1,
      ['orchard_lantern_charm' as PersonalItemId]: 1,
      ['pond_mosaic_shard' as PersonalItemId]: 1,
      ['framed_photo_keepsake' as PersonalItemId]: 1,
    },
    discoveredItemIds: [
      ...world.discoveredItemIds,
      'pressed_garland_bloom' as PersonalItemId,
      'orchard_lantern_charm' as PersonalItemId,
      'pond_mosaic_shard' as PersonalItemId,
      'framed_photo_keepsake' as PersonalItemId,
    ],
  };
  for (const id of ['pressed_garland_bloom', 'orchard_lantern_charm', 'pond_mosaic_shard', 'framed_photo_keepsake'] as const) {
    const res = toggleDisplayedKeepsakeAction(world, id as PersonalItemId);
    assert.equal(res.ok, true, `${id} toggle accepted`);
    world = res.nextWorld;
  }
  rig.update(world, 'morning', 1.0);
  assert.equal(rig.shelfKeepsakeMeshes.pressed_garland_bloom.visible, true);
  assert.equal(rig.shelfKeepsakeMeshes.orchard_lantern_charm.visible, true);
  assert.equal(rig.shelfKeepsakeMeshes.pond_mosaic_shard.visible, true);
  assert.equal(rig.shelfKeepsakeMeshes.framed_photo_keepsake.visible, true);
  // They appear in getOwnedKeepsakeItems (the shelf panel filter).
  const owned = getOwnedKeepsakeItems(world.inventory);
  const ownedIds = owned.map((k) => k.id);
  assert.ok(ownedIds.includes('pressed_garland_bloom' as PersonalItemId));
  assert.ok(ownedIds.includes('orchard_lantern_charm' as PersonalItemId));
  assert.ok(ownedIds.includes('pond_mosaic_shard' as PersonalItemId));
  assert.ok(ownedIds.includes('framed_photo_keepsake' as PersonalItemId));
  rig.dispose();
  palette.disposeAll();
});

test('SK-15: the 5-slot cap is enforced for the new keepsakes too', () => {
  let world = createFreshWorldState();
  // Grant + display 5 keepsakes (mix of original + new).
  world = {
    ...world,
    inventory: {
      ...world.inventory,
      willow_zine_copy: 1,
      brass_pocket_bell: 1,
      pond_watercolor_card: 1,
      woven_herb_wreath: 1,
      cedar_music_box: 1,
      ['pressed_garland_bloom' as PersonalItemId]: 1,
      ['orchard_lantern_charm' as PersonalItemId]: 1,
    },
    discoveredItemIds: [
      ...world.discoveredItemIds,
      'willow_zine_copy',
      'brass_pocket_bell',
      'pond_watercolor_card',
      'woven_herb_wreath',
      'cedar_music_box',
      'pressed_garland_bloom' as PersonalItemId,
      'orchard_lantern_charm' as PersonalItemId,
    ],
  };
  // Display 5.
  for (const id of ['willow_zine_copy', 'brass_pocket_bell', 'pond_watercolor_card', 'woven_herb_wreath', 'cedar_music_box'] as const) {
    world = toggleDisplayedKeepsakeAction(world, id as PersonalItemId).nextWorld;
  }
  assert.equal(world.cottageState.displayedKeepsakeIds.length, 5, 'shelf holds 5');
  // Attempting a 6th (a new community keepsake) is refused.
  const refused = toggleDisplayedKeepsakeAction(world, 'pressed_garland_bloom' as PersonalItemId);
  assert.equal(refused.ok, false, '6th keepsake refused');
  assert.equal(refused.nextWorld, world, 'refusal returns the input world unchanged');
  assert.equal(world.cottageState.displayedKeepsakeIds.length, 5, 'cap not breached');
});

test('SK-16: persistence — serialize/deserialize preserves displayedKeepsakeIds incl. new keepsakes', () => {
  const { rig, palette } = buildRig();
  const base = createFreshWorldState();
  // The sanitizer requires ownership (inventory[id] > 0) for a displayed keepsake
  // to survive load — grant the three items so they pass the ownership gate.
  const world: WorldState = {
    ...base,
    inventory: {
      ...base.inventory,
      willow_zine_copy: 1,
      ['pressed_garland_bloom' as PersonalItemId]: 1,
      ['framed_photo_keepsake' as PersonalItemId]: 1,
    },
    cottageState: {
      ...base.cottageState,
      displayedKeepsakeIds: [
        'willow_zine_copy',
        'pressed_garland_bloom' as PersonalItemId,
        'framed_photo_keepsake' as PersonalItemId,
      ],
    },
  };
  const json = serializeWorldState(world);
  const loaded = deserializeWorldState(json).state;
  assert.deepEqual(
    [...loaded.cottageState.displayedKeepsakeIds],
    ['willow_zine_copy', 'pressed_garland_bloom', 'framed_photo_keepsake'],
    'displayed keepsakes survive round-trip (ownership gate satisfied)',
  );
  rig.update(loaded, 'morning', 1.0);
  assert.equal(rig.shelfKeepsakeMeshes.willow_zine_copy.visible, true);
  assert.equal(rig.shelfKeepsakeMeshes.pressed_garland_bloom.visible, true);
  assert.equal(rig.shelfKeepsakeMeshes.framed_photo_keepsake.visible, true);
  rig.dispose();
  palette.disposeAll();
});

test('SK-17: corruption — unknown ids in displayedKeepsakeIds do not crash the renderer', () => {
  const { rig, palette } = buildRig();
  const base = createFreshWorldState();
  const world: WorldState = {
    ...base,
    cottageState: {
      ...base.cottageState,
      // An unknown id + a valid one + garbage.
      displayedKeepsakeIds: [
        'definitely_not_a_keepsake',
        'orchard_lantern_charm',
        '',
      ] as unknown as PersonalItemId[],
    },
  };
  // Must not throw.
  assert.doesNotThrow(() => rig.update(world, 'morning', 1.0));
  // The valid one shows; unknown ids are silently no-ops (no mesh to show).
  assert.equal(rig.shelfKeepsakeMeshes.orchard_lantern_charm.visible, true);
  assert.equal(rig.shelfKeepsakeMeshes.pond_mosaic_shard.visible, false);
  rig.dispose();
  palette.disposeAll();
});

test('SK-18: mesh integrity — every keepsake group has real children (not empty)', () => {
  const { rig, palette } = buildRig();
  for (const id of ALL_KEEPSAKE_IDS) {
    const mesh = rig.shelfKeepsakeMeshes[id];
    assert.ok(mesh.children.length >= 2, `${id} mesh has >= 2 child objects (not empty)`);
    // Every child is a real THREE object with a geometry (Mesh) — no placeholders.
    const meshes = mesh.children.filter((c) => c instanceof THREE.Mesh);
    assert.ok(meshes.length >= 1, `${id} has at least one Mesh child`);
  }
  rig.dispose();
  palette.disposeAll();
});

test('SK-19: position sanity — every keepsake sits within the shelf bounds', () => {
  const { rig, palette } = buildRig();
  // The shelf group is at (1.3, 0, -2.3). Keepsake groups are children of
  // shelfGroup, so their local positions should be within the sideboard /
  // upper-shelf footprint: |x| <= ~1.0, y in [0.8, 1.85], |z| <= ~0.4.
  for (const id of ALL_KEEPSAKE_IDS) {
    const mesh = rig.shelfKeepsakeMeshes[id];
    const p = mesh.position;
    assert.ok(Math.abs(p.x) <= 1.05, `${id} x within shelf bounds (got ${p.x})`);
    assert.ok(p.y >= 0.8 && p.y <= 1.9, `${id} y on shelf surface (got ${p.y})`);
    assert.ok(Math.abs(p.z) <= 0.5, `${id} z within shelf depth (got ${p.z})`);
  }
  rig.dispose();
  palette.disposeAll();
});

test('SK-20: regression — the 5 original keepsakes still toggle and render', () => {
  const { rig, palette } = buildRig();
  const base = createFreshWorldState();
  const originals = ['willow_zine_copy', 'brass_pocket_bell', 'pond_watercolor_card', 'woven_herb_wreath', 'cedar_music_box'] as const;
  const world: WorldState = {
    ...base,
    cottageState: {
      ...base.cottageState,
      displayedKeepsakeIds: [...originals] as unknown as PersonalItemId[],
    },
  };
  rig.update(world, 'morning', 1.0);
  for (const id of originals) {
    assert.equal(rig.shelfKeepsakeMeshes[id].visible, true, `${id} still displays`);
  }
  // The 4 new ones stay hidden.
  assert.equal(rig.shelfKeepsakeMeshes.pressed_garland_bloom.visible, false);
  assert.equal(rig.shelfKeepsakeMeshes.orchard_lantern_charm.visible, false);
  assert.equal(rig.shelfKeepsakeMeshes.pond_mosaic_shard.visible, false);
  assert.equal(rig.shelfKeepsakeMeshes.framed_photo_keepsake.visible, false);
  rig.dispose();
  palette.disposeAll();
});
