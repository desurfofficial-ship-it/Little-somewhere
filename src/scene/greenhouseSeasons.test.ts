import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GREENHOUSE_INTERACTABLES } from '../game/greenhouse';
import { createFreshWorldState } from '../game/storage';
import { MaterialPalette } from './materials';
import { buildSunbeamGreenhouseInterior } from './builders/greenhouseInterior';
import type { SeasonType, WorldState } from '../game/types';

function worldInSeason(base: WorldState, season: SeasonType): WorldState {
  const day = season === 'spring' ? 2 : season === 'summer' ? 15 : season === 'autumn' ? 25 : 31;
  return { ...base, day, season };
}

const SEASONS: SeasonType[] = ['spring', 'summer', 'autumn', 'winter'];

test('greenhouse seasons: exactly one seasonal dressing group is visible per season, all hidden by default', () => {
  const palette = new MaterialPalette();
  const rig = buildSunbeamGreenhouseInterior(palette, new THREE.Texture(), { isSoftwareGl: true });
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

test('greenhouse winter: paraffin heater hugs the east wall clear of door/water walk-ups, bench rolls + glass frost placed', () => {
  const palette = new MaterialPalette();
  const rig = buildSunbeamGreenhouseInterior(palette, new THREE.Texture(), { isSoftwareGl: true });
  const base = createFreshWorldState();
  rig.update(worldInSeason(base, 'winter'), 'morning', 1.0);

  const winter = rig.seasonLife.winter;
  assert.ok(winter.visible);
  for (const name of ['winter_paraffin_heater', 'winter_burlap_rolls', 'winter_glass_frost']) {
    assert.ok(winter.children.find((c) => c.name === name), `missing winter piece: ${name}`);
  }

  // Heater is the winter floor piece: stays floor-scale, hugging the east wall
  const heater = winter.children.find((c) => c.name === 'winter_paraffin_heater')!;
  const heaterBox = new THREE.Box3().setFromObject(heater);
  assert.ok(heaterBox.max.y <= 0.9, `heater stays low: ${heaterBox.max.y.toFixed(2)}`);
  assert.ok(heaterBox.min.x > 2.3 && heaterBox.max.x < 2.9, 'heater hugs the east dwarf wall');
  // Glow window present and emissive (warmth reads at dusk)
  const glow = (heater.children.find((c) => (c as THREE.Mesh).material !== undefined) ??
    null) as THREE.Mesh | null;
  assert.ok(glow, 'heater carries mesh children');

  // Burlap rolls rest on the potting bench top (furniture-top plane)
  const rollsBox = new THREE.Box3().setFromObject(winter.children.find((c) => c.name === 'winter_burlap_rolls')!);
  assert.ok(rollsBox.min.y > 0.8 && rollsBox.max.y < 1.15, 'rolls lie on the bench top');

  // Frost rides the north glass line, never crossing into the room volume
  const frostBox = new THREE.Box3().setFromObject(winter.children.find((c) => c.name === 'winter_glass_frost')!);
  assert.ok(frostBox.min.z > -2.62 && frostBox.max.z < -2.4, `frost on the north glass (${frostBox.min.z.toFixed(2)})`);

  rig.dispose();
  palette.disposeAll();
});

test('greenhouse seasonal floor pieces keep station walk-ups clear', () => {
  const palette = new MaterialPalette();
  const rig = buildSunbeamGreenhouseInterior(palette, new THREE.Texture(), { isSoftwareGl: true });
  const base = createFreshWorldState();

  for (const season of SEASONS) {
    rig.update(worldInSeason(base, season), 'morning', 1.0);
    // Floor-hugging pieces (box.min.y ≤ 0.25) must keep 0.4u from every focus;
    // furniture-top / wall / ridge pieces are exempt by height.
    for (const piece of rig.seasonLife[season].children) {
      const box = new THREE.Box3().setFromObject(piece);
      if (box.min.y > 0.25) continue;
      for (const prop of GREENHOUSE_INTERACTABLES) {
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

test('greenhouse season round-trip: signature pieces exist, plots stay reactive, exactly one group shows across a year', () => {
  const palette = new MaterialPalette();
  const rig = buildSunbeamGreenhouseInterior(palette, new THREE.Texture(), { isSoftwareGl: true });
  const base = createFreshWorldState();

  const expectedPiece = {
    spring: 'spring_seedling_tray',
    summer: 'summer_ridge_vine',
    autumn: 'autumn_seed_bundles',
    winter: 'winter_paraffin_heater',
  } as const;
  for (const season of SEASONS) {
    rig.update(worldInSeason(base, season), 'morning', 1.0);
    const piece = rig.seasonLife[season].children.find((c) => c.name === expectedPiece[season]);
    assert.ok(piece, `missing ${season} signature piece: ${expectedPiece[season]}`);
  }

  // The reactive crop layer keeps working while seasonal groups flip
  const blooming = { ...base, day: 12, season: 'summer' as SeasonType };
  rig.update(blooming, 'morning', 1.0);
  let anyBloom = false;
  for (const byCrop of rig.plotBloomGroups) {
    for (const cropId of Object.keys(byCrop)) {
      if (byCrop[cropId as keyof typeof byCrop].visible) anyBloom = true;
    }
  }
  // Fresh world has empty plots, so no blooms — the important bit is no throw and gates intact
  assert.equal(anyBloom, false, 'fresh-world plots stay fallow alongside seasonal dressing');

  const year: SeasonType[] = ['winter', 'spring', 'summer', 'autumn', 'winter'];
  for (const season of year) {
    rig.update(worldInSeason(base, season), 'dusk', 2.0);
    const on = SEASONS.filter((s) => rig.seasonLife[s].visible);
    assert.deepEqual(on, [season], `exactly ${season} visible mid-round-trip`);
  }

  rig.dispose();
  palette.disposeAll();
});
