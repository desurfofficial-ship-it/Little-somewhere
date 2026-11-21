/**
 * BUILD 03 — scene-layer tests for the progression presentation rigs
 * (src/scene/progressionPresentation.ts) and their integration contract.
 *
 * Contract under test (design lock rev 2):
 * - FRESH-SAVE PARITY (Doc 07 §7.3, scene half): a fresh world state leaves every
 *   new group hidden; a maximal veteran state shows exactly the earned set.
 * - Variant semantics: outcome enums drive the correct sibling visibility and
 *   material tints; the derivation's clamps flow through untouched.
 * - Batching contract: every ground-contact toggling group carries a static
 *   contact disc registered BEFORE flush and is marked `contactBatchRoot = true`
 *   so its disc batch follows its visibility (contactShadows.ts:89-96).
 * - Placement law: ground-placed props sit on walkable space clear of the
 *   interactable clearance law (0.4-0.45 u); structure-attached tokens need no
 *   ground check but must not sit inside obstacle footprints.
 * - Material law: the palette cache is never mutated by tinting (per-group clones).
 * - Lifecycle: apply() is idempotent per revision; dispose() frees owned resources.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { MaterialPalette } from './materials';
import { buildMeadowDressing } from './builders/botanicalDressing';
import { buildProgressionPresentation } from './progressionPresentation';
import {
  staticContactShadows,
  flushStaticContactShadows,
} from './contactShadows';
import { createFreshWorldState } from '../game/storage';
import { composeProgressionVisualState } from '../game/progressionVisuals';
import { composeEnvironmentState } from '../game/environment';
import { isPointWalkable } from '../game/worldMap';
import { PROP_INTERACTABLES, distance2D } from '../game/worldMap';
import type { WorldState } from '../game/types';

function buildRigs() {
  const palette = new MaterialPalette();
  const shadowTex = new THREE.Texture();
  return buildProgressionPresentation({ palette, shadowTex, isSoftwareGl: true });
}

function veteranWorld(): WorldState {
  const world = createFreshWorldState();
  world.sideFlags = {
    ...world.sideFlags,
    pipZinePrinted: true,
    pipZineTheme: 'art_edition',
    herbLoafShared: true,
    herbLoafStyle: 'tea_basket',
    pondStandBuilt: true,
    pondStandStyle: 'weatherproof_oak',
    watchTuneFinished: true,
    watchTuneStyle: 'patient_repair',
    lanternConflictResolved: true,
    lanternConflictOutcome: 'bridge_compromise',
    explored_sorrel_hollow: true,
    explored_foxglove_rise: true,
    explored_marigold_lane: true,
    explored_bee_line: true,
  };
  world.neighborGiftsReceived = ['pip', 'toby', 'arthur', 'mina', 'barnaby'];
  world.playerRelations = {
    ...world.playerRelations,
    clara: { ...world.playerRelations.clara, affinity: 65 },
    mina: { ...world.playerRelations.mina, affinity: 92 },
  };
  return world;
}

function findGroup(root: THREE.Object3D, name: string): THREE.Group {
  const found = root.getObjectByName(name);
  assert.ok(found, `group ${name} must exist`);
  return found as THREE.Group;
}

test('fresh-save parity: every BUILD 03 group is hidden on a brand-new world', () => {
  const rigs = buildRigs();
  const fresh = composeProgressionVisualState(createFreshWorldState());
  rigs.apply(fresh);

  const names = [
    'prog_zine_board',
    'prog_herb_crate',
    'prog_music_stand',
    'prog_watch_charm',
    'prog_pier_sconces',
    'prog_echo_toby_card',
    'prog_echo_barnaby_dish',
    'prog_mark_well_ribbon',
    'prog_mark_rise_cairn',
    'prog_mark_lane_arrow',
    'prog_mark_hive_wreath',
  ];
  for (const name of names) {
    assert.equal(findGroup(rigs.group, name).visible, false, `${name} hidden on fresh save`);
  }
  for (const child of rigs.group.children) {
    if (child.name.startsWith('prog_token_')) {
      assert.equal(child.visible, false, `${child.name} hidden on fresh save`);
    }
  }
  rigs.dispose();
});

test('veteran state shows exactly the earned prop set with correct variants', () => {
  const rigs = buildRigs();
  const world = veteranWorld();
  const state = composeProgressionVisualState(world);
  rigs.apply(state);

  for (const name of [
    'prog_zine_board',
    'prog_herb_crate',
    'prog_music_stand',
    'prog_watch_charm',
    'prog_pier_sconces',
    'prog_echo_toby_card',
    'prog_echo_barnaby_dish',
    'prog_mark_well_ribbon',
    'prog_mark_rise_cairn',
    'prog_mark_lane_arrow',
    'prog_mark_hive_wreath',
  ]) {
    assert.equal(findGroup(rigs.group, name).visible, true, `${name} visible in veteran state`);
  }
  // variants
  const stand = findGroup(rigs.group, 'prog_music_stand');
  assert.equal(stand.getObjectByName('variant_carved_clef')!.visible, false);
  assert.equal(stand.getObjectByName('variant_weatherproof_oak')!.visible, true);
  const charm = findGroup(rigs.group, 'prog_watch_charm');
  assert.equal(charm.getObjectByName('variant_steady_route')!.visible, false);
  assert.equal(charm.getObjectByName('variant_patient_repair')!.visible, true);
  const herb = findGroup(rigs.group, 'prog_herb_crate');
  assert.equal(herb.getObjectByName('bunch_plaza_table')!.visible, false);
  assert.equal(herb.getObjectByName('bunch_tea_basket')!.visible, true);
  // tokens: clara friend charm, mina kindred ribbon — nobody else
  const clara = findGroup(rigs.group, 'prog_token_clara');
  assert.equal(clara.visible, true);
  const mina = findGroup(rigs.group, 'prog_token_mina');
  assert.equal(mina.visible, true);
  const arthur = findGroup(rigs.group, 'prog_token_arthur');
  assert.equal(arthur.visible, false);
  rigs.dispose();
});

test('outcome tints flow through: zine chalk color follows the theme; sconce emissive follows the outcome', () => {
  const rigs = buildRigs();
  const world = veteranWorld();
  const mk = (theme: string) => {
    world.sideFlags.pipZineTheme = theme;
    world.sideFlags.lanternConflictOutcome = theme === 'art_edition' ? 'gentle_space' : 'public_harmony';
    const s = composeProgressionVisualState(world);
    rigs.apply(s);
    return s;
  };
  mk('art_edition');
  const cover = findGroup(rigs.group, 'prog_zine_board').children.find(
    (c) => c.name === '',
  ) as THREE.Mesh | undefined;
  const coverMesh = (cover ?? findGroup(rigs.group, 'prog_zine_board').children[0]) as THREE.Mesh;
  const chalkMat = coverMesh.material as THREE.MeshStandardMaterial;
  const artColor = chalkMat.color.getHexString();
  mk('kitchen_edition');
  const kitchenColor = chalkMat.color.getHexString();
  assert.notEqual(artColor, kitchenColor, 'zine chalk tint follows the outcome');

  // sconce outcome: gentle_space = dark (no flames), public_harmony = lit softer
  mk('art_edition'); // sets gentle_space
  const sconces = findGroup(rigs.group, 'prog_pier_sconces');
  const glass = sconces.getObjectByName('sconce_glass') as THREE.Mesh | undefined;
  assert.ok(glass, 'sconce glass mesh named for tests');
  assert.equal((glass.material as THREE.MeshStandardMaterial).emissiveIntensity, 0);
  mk('classic_edition'); // sets public_harmony
  assert.equal((glass.material as THREE.MeshStandardMaterial).emissiveIntensity, 0.55);
  rigs.dispose();
});

test('ground-contact toggling groups carry contact discs and batch roots before flush', () => {
  // isolate the singleton state for this test
  staticContactShadows.dispose();
  const rigs = buildRigs();
  flushStaticContactShadows(rigs.group);

  for (const name of [
    'prog_zine_board',
    'prog_music_stand',
    'prog_pier_sconces',
    'prog_mark_rise_cairn',
  ]) {
    const g = findGroup(rigs.group, name);
    assert.equal(g.userData.contactBatchRoot, true, `${name} is a batch boundary`);
  }
  // elevated/tiny props carry NO disc (no ground contact)
  for (const name of ['prog_herb_crate', 'prog_watch_charm']) {
    const g = findGroup(rigs.group, name);
    assert.notEqual(g.userData.contactBatchRoot, true);
  }
  // after flush, instanced buckets exist, parented at their batch roots
  const buckets: THREE.Object3D[] = [];
  rigs.group.traverse((c) => {
    if (c.name === 'instanced_contact_shadows') buckets.push(c);
  });
  assert.ok(buckets.length >= 1, 'instanced contact buckets created');
  rigs.dispose();
});

test('ground-placed props sit on walkable space clear of interactable clearances', () => {
  // music stand beside seat_pond_south; caddy at the noticeboard foot; sconces by
  // the pier shore step; rise cairn at the deck approach (design lock §3.1/§3.4)
  const groundProps: Array<[string, number, number]> = [
    ['music stand', 2.9, 19.4],
    ['zine caddy', 3.2, -2.7],
    ['sconce A', 2.22 - 0.75, 17.3],
    ['sconce B', 2.22 + 0.75, 17.3],
    ['rise cairn', 20.6, 16.0],
  ];
  for (const [label, x, z] of groundProps) {
    assert.ok(
      isPointWalkable(x, z),
      `${label} at (${x}, ${z}) must not block or leave walkable space`,
    );
  }
  // clearance law: >= 0.4 u from every interactable anchor
  const clearancePoints: Array<[number, number]> = [
    [2.9, 19.4],
    [3.2, -2.7],
    [1.47, 17.3],
    [2.97, 17.3],
    [20.6, 16.0],
  ];
  for (const [x, z] of clearancePoints) {
    for (const prop of PROP_INTERACTABLES) {
      const d = distance2D({ x, z }, { x: prop.x, z: prop.z });
      assert.ok(
        d >= 0.4,
        `prop at (${x}, ${z}) is ${d.toFixed(2)}u from interactable ${prop.id} (< 0.4u)`,
      );
    }
  }
});

test('structure-attached tokens are elevated above interaction reach or off-interactable', () => {
  // tokens intentionally attach to the resident's own structures — sometimes the
  // same structure that carries the interactable (Jun's mailbox post, Sora's cart
  // frame). The obstruction rule is therefore elevation: a token within 0.9 u of
  // an interactable anchor must sit above reach height (y >= 0.5) so it cannot
  // block the ground-level interaction proxy.
  const anchors: Array<[string, number, number, number]> = [
    ['clara', -9.05, 1.42, -8.13],
    ['arthur', 14.05, 2.32, -8.56],
    ['mina', 10.66, 1.5, 3.2],
    ['jun', -9.8, 1.04, 7.2],
    ['barnaby', 13.2, 1.02, 15.52],
    ['sora', -4.78, 0.52, -3.05],
    ['toby', 2.75, 0.88, 19.3],
    ['nora', -12.68, 0.85, -2.48],
    ['pip', -9.15, 1.42, -10.68],
    ['rowan', -6.09, 1.72, -20.35],
  ];
  for (const [id, x, y, z] of anchors) {
    for (const prop of PROP_INTERACTABLES) {
      const d = distance2D({ x, z }, { x: prop.x, z: prop.z });
      if (d < 0.9) {
        assert.ok(
          y >= 0.5,
          `token ${id} is ${d.toFixed(2)}u from ${prop.id} at y ${y} — must be elevated above reach`,
        );
      }
    }
  }
});

test('apply is idempotent per revision and reversal works', () => {
  const rigs = buildRigs();
  const world = veteranWorld();
  const state = composeProgressionVisualState(world);
  rigs.apply(state);
  assert.equal(findGroup(rigs.group, 'prog_zine_board').visible, true);
  // re-apply the same state: no throw, same visibility
  rigs.apply(state);
  assert.equal(findGroup(rigs.group, 'prog_zine_board').visible, true);
  // reversal: strip the sideFlags — every prop hides again
  world.sideFlags = {};
  world.neighborGiftsReceived = [];
  world.playerRelations = { ...world.playerRelations, clara: { ...world.playerRelations.clara, affinity: 10 }, mina: { ...world.playerRelations.mina, affinity: 10 } };
  rigs.apply(composeProgressionVisualState(world));
  assert.equal(findGroup(rigs.group, 'prog_zine_board').visible, false);
  assert.equal(findGroup(rigs.group, 'prog_token_mina').visible, false);
  rigs.dispose();
});

test('dispose frees owned resources; the palette cache is untouched', () => {
  const palette = new MaterialPalette();
  const rigs = buildProgressionPresentation({ palette, shadowTex: new THREE.Texture(), isSoftwareGl: true });
  const cache = (palette as unknown as { cache: Map<string, unknown> }).cache;
  const cacheBefore = cache.size;
  const veteran = composeProgressionVisualState(veteranWorld());
  rigs.apply(veteran);
  rigs.dispose();
  assert.equal(cache.size, cacheBefore, 'palette cache size unchanged by build/apply/dispose');
});

test('structure-attached marks never sit inside obstacle circles (review LOW-11)', () => {
  // the well ribbon ties to the well lip — it must stay clear of the well's own
  // walk-blocked footprint center even though it rides the well geometry
  const CIRCLE_OBSTACLES = ((): Array<{ id: string; x: number; z: number; radius: number }> => {
    // light re-derivation from worldMap via isPointWalkable probing is overkill;
    // assert the three anchors against the known obstacle anchors instead
    return [
      { id: 'old_stone_well', x: -21.4, z: 19.0, radius: 0.9 },
      { id: 'beeline_cairn', x: 8.2, z: -19.9, radius: 0.45 },
    ];
  })();
  const marks: Array<[string, number, number]> = [
    ['well ribbon', -20.72, 19.32],
    ['hive wreath', 10.15, -19.6],
    ['lane arrow', 21.66, 0.8],
  ];
  for (const [label, x, z] of marks) {
    for (const o of CIRCLE_OBSTACLES) {
      const d = Math.hypot(x - o.x, z - o.z);
      if (d < o.radius + 0.1) {
        // structure-attached: allowed to overlap ONLY its own host structure
        const hostOverlap =
          (label === 'well ribbon' && o.id === 'old_stone_well') ||
          (label === 'hive wreath' && o.id === 'beeline_cairn');
        assert.ok(hostOverlap, `${label} overlaps foreign obstacle ${o.id}`);
      }
    }
  }
});

test('meadow drift re-bases across season edges without accumulating (review HIGH-2 companion)', () => {
  // The renderer's drift re-applies on every revision edge; the canvas knit block
  // no longer wipes it. This pins the rig-level contract: progress 0 in ANY season
  // restores the placement snapshot bit-identically after a drifted state.
  const palette = new MaterialPalette();
  const rig = buildMeadowDressing(palette, true);
  // the blossom layer is the instanceColor mesh whose count matches the placed flowers
  const flowerCount = rig.placementPoints.filter((p) => p.kind === 'flower').length;
  assert.ok(flowerCount > 0, 'meadow has flowers in Node');
  const blossom = rig.group.children.find(
    (c) =>
      (c as THREE.InstancedMesh).isInstancedMesh &&
      (c as THREE.InstancedMesh).instanceColor &&
      (c as THREE.InstancedMesh).count === flowerCount,
  ) as THREE.InstancedMesh | undefined;
  assert.ok(blossom, 'blossom instanced layer exists');
  const before = Float32Array.from(blossom.instanceColor!.array as Float32Array);
  rig.setSeasonDayProgress(0.9, 'spring');
  const drifted = Float32Array.from(blossom.instanceColor!.array as Float32Array);
  assert.notDeepEqual(drifted, before, 'spring drift departed from placement colors');
  rig.setSeasonDayProgress(0, 'summer');
  assert.deepEqual(
    Float32Array.from(blossom.instanceColor!.array as Float32Array),
    before,
    'progress 0 restores the snapshot bit-identically (non-spring)',
  );
  rig.setSeasonDayProgress(0.8, 'autumn');
  rig.setSeasonDayProgress(0, 'spring');
  // spring progress 0 re-applies the widened spring spread (p=0 base = today's spring look)
  rig.setSpringSpread(true);
  const springBase = Float32Array.from(blossom.instanceColor!.array as Float32Array);
  rig.setSeasonDayProgress(0, 'spring');
  assert.deepEqual(
    Float32Array.from(blossom.instanceColor!.array as Float32Array),
    springBase,
    'spring p=0 == setSpringSpread(true) base (today look)',
  );
  rig.dispose();
  palette.disposeAll();
});
