import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { NOOK_INTERACTABLES, NOOK_SEAT_SPOTS } from '../game/bookNook';
import { createFreshWorldState } from '../game/storage';
import { MaterialPalette } from './materials';
import { buildLindenBookNookInterior } from './builders/bookNookInterior';
import type { SeasonType, WorldState } from '../game/types';

function worldInSeason(base: WorldState, season: SeasonType): WorldState {
  const day = season === 'spring' ? 2 : season === 'summer' ? 15 : season === 'autumn' ? 25 : 31;
  return { ...base, day, season };
}

const SEASONS: SeasonType[] = ['spring', 'summer', 'autumn', 'winter'];

test('nook seasons: exactly one seasonal dressing group is visible per season, all hidden by default', () => {
  const palette = new MaterialPalette();
  const rig = buildLindenBookNookInterior(palette, new THREE.Texture(), { isSoftwareGl: true });
  const base = createFreshWorldState();

  for (const season of SEASONS) {
    assert.equal(rig.seasonLife[season].visible, false, `${season} starts hidden`);
  }
  for (const season of SEASONS) {
    rig.update(worldInSeason(base, season), 'morning', 1.0);
    for (const s of SEASONS) {
      assert.equal(rig.seasonLife[s].visible, s === season, `${s} visibility in ${season}`);
    }
  }

  rig.dispose();
  palette.disposeAll();
});

test('nook winter: arm blanket hugs the east arm clear of the sit position, frost + door swag placed in-bounds', () => {
  const palette = new MaterialPalette();
  const rig = buildLindenBookNookInterior(palette, new THREE.Texture(), { isSoftwareGl: true });
  const base = createFreshWorldState();
  rig.update(worldInSeason(base, 'winter'), 'morning', 1.0);

  const winter = rig.seasonLife.winter;
  assert.ok(winter.visible);
  for (const name of ['winter_arm_blanket', 'winter_window_frost', 'winter_door_swag']) {
    assert.ok(winter.children.find((c) => c.name === name), `missing winter piece: ${name}`);
  }

  // Blanket drapes the armchair's east arm (world x ≈ -0.46) without entering
  // the sit volume: distance from the seat center to the blanket box > 0.3
  const blanket = winter.children.find((c) => c.name === 'winter_arm_blanket')!;
  const blanketBox = new THREE.Box3().setFromObject(blanket);
  const seat = NOOK_SEAT_SPOTS[0].seatPos;
  assert.ok(blanketBox.min.x > seat.x + 0.3, `blanket stays off the sit spot (min.x ${blanketBox.min.x.toFixed(2)})`);
  assert.ok(blanketBox.min.y > 0.45 && blanketBox.max.y < 0.95, 'blanket reads at arm height');

  // Frost stays on the west window plane; swag stays above the east door beam
  const frostBox = new THREE.Box3().setFromObject(winter.children.find((c) => c.name === 'winter_window_frost')!);
  assert.ok(frostBox.min.x > -2.55 && frostBox.max.x < -2.4, 'frost hugs the west window');
  const swagBox = new THREE.Box3().setFromObject(winter.children.find((c) => c.name === 'winter_door_swag')!);
  assert.ok(swagBox.min.x > 2.3 && swagBox.max.x < 2.55, 'swag hugs the east door beam');
  assert.ok(swagBox.min.y > 1.9 && swagBox.max.y < 2.45, 'swag rides the header beam, bell clear of the door top');

  rig.dispose();
  palette.disposeAll();
});

test('nook seasonal pieces never intrude into station focus walk-ups', () => {
  const palette = new MaterialPalette();
  const rig = buildLindenBookNookInterior(palette, new THREE.Texture(), { isSoftwareGl: true });
  const base = createFreshWorldState();

  for (const season of SEASONS) {
    rig.update(worldInSeason(base, season), 'morning', 1.0);
    // Check each named piece separately: pieces resting at y ≥ 0.8 live on
    // furniture tops / wall / ceiling planes and cannot block a walk-up.
    for (const piece of rig.seasonLife[season].children) {
      const box = new THREE.Box3().setFromObject(piece);
      if (box.min.y > 0.8) continue;
      for (const prop of NOOK_INTERACTABLES) {
        const dx = Math.max(box.min.x - prop.focusX, prop.focusX - box.max.x, 0);
        const dz = Math.max(box.min.z - prop.focusZ, prop.focusZ - box.max.z, 0);
        const dist = Math.hypot(dx, dz);
        assert.ok(
          dist > 0.4,
          `${season}/${piece.name} intrudes near ${prop.id}: clearance ${dist.toFixed(2)}`,
        );
      }
    }
  }

  rig.dispose();
  palette.disposeAll();
});

test('nook season round-trip: signature pieces exist and exactly one group shows across a full year', () => {
  const palette = new MaterialPalette();
  const rig = buildLindenBookNookInterior(palette, new THREE.Texture(), { isSoftwareGl: true });
  const base = createFreshWorldState();

  const expectedPiece = {
    spring: 'spring_sill_bud',
    summer: 'summer_shelf_sunflower',
    autumn: 'autumn_beam_garland',
    winter: 'winter_arm_blanket',
  } as const;
  for (const season of SEASONS) {
    rig.update(worldInSeason(base, season), 'morning', 1.0);
    const piece = rig.seasonLife[season].children.find((c) => c.name === expectedPiece[season]);
    assert.ok(piece, `missing ${season} signature piece: ${expectedPiece[season]}`);
  }

  const year: SeasonType[] = ['winter', 'spring', 'summer', 'autumn', 'winter', 'spring'];
  for (const season of year) {
    rig.update(worldInSeason(base, season), 'golden', 2.0);
    const on = SEASONS.filter((s) => rig.seasonLife[s].visible);
    assert.deepEqual(on, [season], `exactly ${season} visible mid-round-trip`);
  }

  rig.dispose();
  palette.disposeAll();
});
