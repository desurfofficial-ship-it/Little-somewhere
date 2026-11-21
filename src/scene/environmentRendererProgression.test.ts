/**
 * BUILD 03 — renderer integration tests for the progression signals
 * (environmentRenderer.ts changes):
 * - the static block re-runs when the progression revision changes (5.1/5.2/5.4
 *   toggles actually flip)
 * - within-season drift (5.3): dayOfSeason 1 is byte-equal to the season anchor
 *   (fresh-save parity, review C1); later days depart toward the authored targets;
 *   the drift write lands AFTER the season-block write on season-change frames
 *   (review M1 ordering)
 * - noticeboard glint (5.6a): the newest visible flyer's pin glints; the glint
 *   MOVES when the flyer count changes; zero when the board has no news
 * - late warm windows (5.6b): windowMaterials gain +0.2 at minute >= 1260
 *   (cozyLateNightHint) and track the phase per-frame; willowWindowMaterials are
 *   never touched by this path
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { EnvironmentVisualController } from './environmentRenderer';
import { composeEnvironmentState } from '../game/environment';
import { createFreshWorldState } from '../game/storage';
import { buildProgressionPresentation } from './progressionPresentation';
import { MaterialPalette } from './materials';
import { CANOPY_DRIFT_TARGETS } from '../game/progressionVisuals';
import type { WorldState } from '../game/types';

interface Fixture {
  controller: EnvironmentVisualController;
  groveBase: THREE.MeshStandardMaterial;
  groveTop: THREE.MeshStandardMaterial;
  wildsBase: THREE.MeshStandardMaterial;
  windowMats: THREE.MeshStandardMaterial[];
  willowWindowMats: THREE.MeshStandardMaterial[];
  flyers: THREE.Mesh[];
  progressionApplyCount: () => number;
}

function createFixture(): Fixture {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#DCEBF2');
  scene.fog = new THREE.Fog('#DCEBF2', 42, 86);
  const groveBase = new THREE.MeshStandardMaterial({ color: '#FFFFFF' });
  const groveTop = new THREE.MeshStandardMaterial({ color: '#FFFFFF' });
  const wildsBase = new THREE.MeshStandardMaterial({ color: '#FFFFFF' });
  const windowMats = [new THREE.MeshStandardMaterial({ color: '#FFFFFF' })];
  const willowWindowMats = [new THREE.MeshStandardMaterial({ color: '#FFFFFF' })];
  const flyers: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const flyer = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.38, 0.025));
    const pin = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 6, 6),
      new THREE.MeshStandardMaterial({ color: '#D7A041', roughness: 0.24, metalness: 0.85 }),
    );
    flyer.add(pin);
    flyers.push(flyer);
  }
  let applyCount = 0;
  const palette = new MaterialPalette();
  const progressionRigs = buildProgressionPresentation({ palette, shadowTex: new THREE.Texture(), isSoftwareGl: true });
  const originalApply = progressionRigs.apply.bind(progressionRigs);
  progressionRigs.apply = (s) => {
    applyCount++;
    originalApply(s);
  };
  const controller = new EnvironmentVisualController({
    scene,
    groundMat: new THREE.MeshStandardMaterial({ color: '#FFFFFF' }),
    cobbleMat: new THREE.MeshStandardMaterial({ color: '#FFFFFF' }),
    groveRig: { group: new THREE.Group(), crownBaseMat: groveBase, crownTopMat: groveTop },
    hemiLight: new THREE.HemisphereLight('#B5D7EB', '#7A664E', 0.54),
    sunLight: new THREE.DirectionalLight('#FFF1D0', 1.52),
    windowMaterials: windowMats,
    willowWindowMaterials: willowWindowMats,
    lanternMat: new THREE.MeshStandardMaterial(),
    prototypeLanternMats: [],
    flowerGroups: [],
    gazeboRig: {
      group: new THREE.Group(),
      bellPivot: new THREE.Group(),
      bellMesh: new THREE.Mesh(),
      clapperMesh: new THREE.Mesh(),
      ivyGroup: new THREE.Group(),
      ribbonMesh: new THREE.Mesh(),
    },
    fountainRig: { group: new THREE.Group(), waterMesh: new THREE.Mesh(), spoutParticles: new THREE.Group() },
    bakeryTablesGroup: new THREE.Group(),
    festoonGroup: new THREE.Group(),
    noticeboardRig: { group: new THREE.Group(), flyers },
    oakGlint: new THREE.Mesh(),
    mbFlag: new THREE.Mesh(),
    bellSwingVelRef: { current: 0 },
    isSoftwareGl: true,
    progressionRigs,
  });
  return {
    controller,
    groveBase,
    groveTop,
    wildsBase,
    windowMats,
    willowWindowMats,
    flyers,
    progressionApplyCount: () => applyCount,
  };
}

function worldAt(overrides: Partial<WorldState>): WorldState {
  const base = createFreshWorldState();
  return { ...base, weather: 'sunlit' as const, ...overrides };
}

function updateAt(f: Fixture, world: WorldState): void {
  const composed = composeEnvironmentState(world);
  f.controller.update(composed, world, { x: 0, z: 0 }, 0, 0.016);
}

test('progression revision change re-runs the static block and flips prop rigs', () => {
  const f = createFixture();
  const world = worldAt({ day: 3, season: 'spring' });
  updateAt(f, world);
  const before = f.progressionApplyCount();
  assert.ok(before >= 1, 'static block ran for the initial frame');
  // complete the zine storyline: progression revision changes without any other signal
  world.sideFlags = { ...world.sideFlags, pipZinePrinted: true };
  updateAt(f, world);
  assert.equal(f.progressionApplyCount(), before + 1, 'progression gate re-ran the static block');
  updateAt(f, world);
  assert.equal(f.progressionApplyCount(), before + 1, 'no re-run without a revision change');
});

test('season drift: dayOfSeason 1 is byte-equal to the anchor; day 10 departs toward the target', () => {
  const f = createFixture();
  // summer dayOfSeason 1 = day 11; summer dayOfSeason 10 = day 20
  updateAt(f, worldAt({ day: 11, season: 'summer', minuteOfDay: 540 }));
  const anchorBase = f.groveBase.color.getHexString();
  assert.equal(anchorBase, 'ecfaea', 'day 11 renders the exact summer anchor (parity)');
  assert.equal(f.groveTop.color.getHexString(), 'fff6d8');
  updateAt(f, worldAt({ day: 20, season: 'summer', minuteOfDay: 540 }));
  const target = new THREE.Color(CANOPY_DRIFT_TARGETS.summer.base);
  const drifted = f.groveBase.color.clone();
  const gap = Math.abs(drifted.r - target.r) + Math.abs(drifted.g - target.g) + Math.abs(drifted.b - target.b);
  assert.ok(gap < 0.02, `day 20 drifted to the target (gap ${gap.toFixed(4)})`);
  assert.notEqual(f.groveBase.color.getHexString(), anchorBase);
  // winter never drifts
  updateAt(f, worldAt({ day: 40, season: 'winter', minuteOfDay: 540 }));
  assert.equal(f.groveBase.color.getHexString(), 'cee0de', 'winter stays its hushed anchor');
});

test('drift ordering: a season change + drifted day renders the drifted value, not the anchor', () => {
  const f = createFixture();
  updateAt(f, worldAt({ day: 11, season: 'summer', minuteOfDay: 540 }));
  // jump straight to autumn dayOfSeason 10 (season change AND drift on one frame)
  updateAt(f, worldAt({ day: 30, season: 'autumn', minuteOfDay: 540 }));
  const target = new THREE.Color(CANOPY_DRIFT_TARGETS.autumn.base);
  const gap =
    Math.abs(f.groveBase.color.r - target.r) +
    Math.abs(f.groveBase.color.g - target.g) +
    Math.abs(f.groveBase.color.b - target.b);
  assert.ok(gap < 0.02, `season change + drift composes (gap ${gap.toFixed(4)})`);
});

test('noticeboard glint marks the newest visible flyer and moves with the count', () => {
  const f = createFixture();
  const world = worldAt({ day: 3, season: 'spring' });
  world.flags = { ...world.flags, heardBellMystery: true }; // board has news
  const pinAt = (i: number) => (f.flyers[i].children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;

  updateAt(f, world);
  const count1 = composeEnvironmentState(world).npcTouches.noticeboardFlyerCount;
  assert.ok(count1 >= 1);
  const newest1 = count1 - 1;
  for (let i = 0; i < 3; i++) {
    assert.equal(pinAt(i).emissiveIntensity, i === newest1 ? 0.9 : 0, `flyer ${i} vs newest ${newest1}`);
  }

  // the count grows (bell restored): the glint MOVES to the new newest flyer
  world.flags = { ...world.flags, heardBellMystery: true, bellRestored: true };
  updateAt(f, world);
  const count2 = composeEnvironmentState(world).npcTouches.noticeboardFlyerCount;
  assert.equal(count2, 3);
  assert.equal(pinAt(count2 - 1).emissiveIntensity, 0.9);
  assert.equal(pinAt(count2 - 2).emissiveIntensity, 0);

  // board without news: no glint anywhere
  const quiet = worldAt({ day: 3, season: 'spring' });
  updateAt(f, quiet);
  for (let i = 0; i < 3; i++) {
    assert.equal(pinAt(i).emissiveIntensity, 0, 'glint clears when the board has no news');
  }
});

test('late warm windows: +0.2 step at 21:00+ on windowMaterials only', () => {
  const f = createFixture();
  updateAt(f, worldAt({ day: 3, season: 'spring', minuteOfDay: 1245 })); // 20:45 dusk
  const duskGlow = f.windowMats[0].emissiveIntensity;
  assert.ok(Math.abs(duskGlow - 2.1) < 1e-6, `dusk base glow 2.1 (got ${duskGlow})`);
  const willowBefore = f.willowWindowMats[0].emissiveIntensity; // hearth-truth value
  updateAt(f, worldAt({ day: 3, season: 'spring', minuteOfDay: 1275 })); // 21:15
  const lateGlow = f.windowMats[0].emissiveIntensity;
  assert.ok(Math.abs(lateGlow - 2.3) < 1e-6, `late step applied (got ${lateGlow})`);
  // willow windows keep their hearth-truth ownership — untouched by the hint step
  assert.equal(f.willowWindowMats[0].emissiveIntensity, willowBefore);
});
