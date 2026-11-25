import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { COTTAGE_INTERACTABLES, COTTAGE_SEAT_SPOTS } from '../game/cottage';
import { createFreshWorldState } from '../game/storage';
import { PersonalItemId } from '../game/types';
import { MaterialPalette } from './materials';
import { buildWillowCottageInterior } from './builders/cottageInterior';
import { applyShellCutaway, AUTHORED_YAW, collectShellSides } from './roomFraming';

test('cottage interior 3D rig exposes all 7 cottage hit proxies + 2 indoor seat proxies', () => {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());

  const cottageProxies = rig.hitProxies.filter(
    (mesh) => mesh.userData.targetKind === 'cottage_prop',
  );
  const seatProxies = rig.hitProxies.filter((mesh) => mesh.userData.targetKind === 'seat');
  assert.equal(cottageProxies.length, COTTAGE_INTERACTABLES.length);
  assert.equal(seatProxies.length, COTTAGE_SEAT_SPOTS.length);
  const ids = new Set(cottageProxies.map((mesh) => mesh.userData.targetId));
  for (const prop of COTTAGE_INTERACTABLES) {
    assert.ok(ids.has(prop.id), `Missing interior hit proxy for ${prop.id}`);
  }
  const seatIds = new Set(seatProxies.map((mesh) => mesh.userData.targetId));
  for (const seat of COTTAGE_SEAT_SPOTS) {
    assert.ok(seatIds.has(seat.id), `Missing indoor seat proxy for ${seat.id}`);
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
  assert.equal(rig.shelfKeepsakeMeshes.willow_zine_copy.visible, false);
  assert.equal(rig.shelfKeepsakeMeshes.brass_pocket_bell.visible, false);
  // Stage 3 Continuation: the three community keepsakes + framed photo exist and
  // default hidden, like every shelf keepsake.
  assert.equal(rig.shelfKeepsakeMeshes.pressed_garland_bloom.visible, false);
  assert.equal(rig.shelfKeepsakeMeshes.orchard_lantern_charm.visible, false);
  assert.equal(rig.shelfKeepsakeMeshes.pond_mosaic_shard.visible, false);
  assert.equal(rig.shelfKeepsakeMeshes.framed_photo_keepsake.visible, false);

  // Place lavender & display keepsakes + warm kettle dusk update
  const decorated = {
    ...base,
    minuteOfDay: 1120,
    cottageState: {
      ...base.cottageState,
      placedFlowerId: 'lavender_sprig' as const,
      displayedKeepsakeIds: ['willow_zine_copy' as const, 'brass_pocket_bell' as const, 'pressed_garland_bloom' as PersonalItemId],
      kettleWarmUntilMinute: 1200,
    },
  };
  rig.update(decorated, 'dusk', 2.5);
  assert.equal(rig.vaseFlowers.lavender_sprig.visible, true);
  assert.equal(rig.vaseFlowers.chamomile_blossom.visible, false);
  assert.equal(rig.shelfKeepsakeMeshes.willow_zine_copy.visible, true);
  assert.equal(rig.shelfKeepsakeMeshes.brass_pocket_bell.visible, true);
  assert.equal(rig.shelfKeepsakeMeshes.pond_watercolor_card.visible, false);
  // Stage 3 Continuation: the displayed community keepsake shows; the others stay hidden.
  assert.equal(rig.shelfKeepsakeMeshes.pressed_garland_bloom.visible, true);
  assert.equal(rig.shelfKeepsakeMeshes.orchard_lantern_charm.visible, false);
  assert.equal(rig.shelfKeepsakeMeshes.pond_mosaic_shard.visible, false);
  assert.equal(rig.shelfKeepsakeMeshes.framed_photo_keepsake.visible, false);
  assert.equal(rig.kettleSteamPuffs[0].visible, true);
  assert.ok(rig.almanacLampMat.emissiveIntensity > 0.7);

  rig.dispose();
  palette.disposeAll();
});

test('cottage interior atmosphere layer: hearth light responds to hearthLit, motes stay finite and bounded', () => {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());
  const base = createFreshWorldState();

  // Walk the rig graph to find the atmosphere pieces
  let hearthLight: THREE.PointLight | null = null;
  let motes: THREE.Points | null = null;
  let shaft: THREE.Mesh | null = null;
  rig.group.traverse((obj) => {
    if (obj instanceof THREE.PointLight && !hearthLight) hearthLight = obj;
    if (obj instanceof THREE.Points && !motes) motes = obj;
    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshBasicMaterial) {
      const mat = obj.material as THREE.MeshBasicMaterial;
      if (mat.blending === THREE.AdditiveBlending && (obj.geometry as THREE.PlaneGeometry).type === 'PlaneGeometry' && !shaft) {
        shaft = obj;
      }
    }
  });

  assert.ok(hearthLight, 'Interior rig carries a hearth point light');
  assert.ok(motes, 'Interior rig carries a dust-mote Points cloud');
  assert.ok(shaft, 'Interior rig carries a window daylight shaft');

  // Lit hearth at dusk: strong warm light; unlit hearth: light off
  const litWorld = { ...base, minuteOfDay: 1120 };
  rig.update(litWorld, 'dusk', 1.2);
  const litIntensity = (hearthLight as THREE.PointLight).intensity;
  assert.ok(litIntensity > 2.0, `Dusk hearth light should be strong, got ${litIntensity.toFixed(2)}`);

  const unlitWorld = {
    ...litWorld,
    cottageState: { ...base.cottageState, hearthLit: false },
  };
  rig.update(unlitWorld, 'dusk', 1.2);
  assert.equal((hearthLight as THREE.PointLight).intensity, 0);

  // Morning shaft is clearly brighter than dusk shaft
  rig.update({ ...base, minuteOfDay: 540 }, 'morning', 3.0);
  const shaftMat = (shaft as THREE.Mesh).material as THREE.MeshBasicMaterial;
  const morningOpacity = shaftMat.opacity;
  rig.update({ ...base, minuteOfDay: 1140 }, 'dusk', 3.0);
  const duskOpacity = shaftMat.opacity;
  assert.ok(morningOpacity > duskOpacity * 2, 'Morning shaft reads much stronger than dusk');

  // 240 simulated seconds of updates keep mote positions finite & inside the room
  const moteGeo = (motes as THREE.Points).geometry;
  const arr = moteGeo.attributes.position.array as Float32Array;
  for (let t = 0; t < 240; t++) {
    rig.update(base, 'morning', t * 0.1 + 10);
    for (let i = 0; i < arr.length; i += 3) {
      assert.ok(Number.isFinite(arr[i]) && Number.isFinite(arr[i + 1]) && Number.isFinite(arr[i + 2]));
      assert.ok(arr[i] > -3.7 && arr[i] < -1.3, `Mote x out of band: ${arr[i]}`);
      assert.ok(arr[i + 1] > 0.1 && arr[i + 1] < 2.2, `Mote y out of band: ${arr[i + 1]}`);
      assert.ok(arr[i + 2] > -0.8 && arr[i + 2] < 0.8, `Mote z out of band: ${arr[i + 2]}`);
    }
  }

  rig.dispose();
  palette.disposeAll();
});

test('cottage interior lived-in dressing exists without inflating the diorama bounds', () => {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());

  // Count meshes by name-tagged expectations via a simple heuristic: total mesh count
  // must have grown well past the pre-polish baseline while staying performant.
  let meshCount = 0;
  let stoolSeats = 0;
  rig.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      meshCount++;
      const geo = obj.geometry;
      if (geo instanceof THREE.CylinderGeometry && obj.position.y > 0.35 && obj.position.y < 0.5) {
        stoolSeats++;
      }
    }
  });

  assert.ok(stoolSeats >= 2, 'Two dining stools tuck against the oak table');
  assert.ok(meshCount > 90, `Interior dressing grew the mesh count (got ${meshCount})`);

  // The whole dressed diorama still fits the diorama envelope
  const box = new THREE.Box3().setFromObject(rig.group);
  assert.ok(box.min.y >= -0.35 && box.max.y <= 3.6, `Bounds y: ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}`);

  rig.dispose();
  palette.disposeAll();
});

test('R5 Pass 16: the hearth wall keeps the seasons — rack, sock, jug and herb bundle rotate with the calendar', () => {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());
  const base = createFreshWorldState();

  // Spring: first blossom branch in a jug; no summer/autumn/winter hearth dressing
  rig.update({ ...base, season: 'spring' }, 'morning', 1.0);
  assert.equal(rig.seasonLife.hearthSpring.visible, true, 'Spring puts a blossom branch on the mantel');
  assert.equal(rig.seasonLife.hearthSummer.visible, false);
  assert.equal(rig.seasonLife.hearthAutumn.visible, false);
  assert.equal(rig.seasonLife.hearthWinter.visible, false);

  // Summer: fresh herb bundle on the flue peg
  rig.update({ ...base, season: 'summer' }, 'afternoon', 1.0);
  assert.equal(rig.seasonLife.hearthSummer.visible, true, 'Summer hangs a fresh herb bundle');
  assert.equal(rig.seasonLife.hearthSpring.visible, false);
  assert.equal(rig.seasonLife.hearthAutumn.visible, false);
  assert.equal(rig.seasonLife.hearthWinter.visible, false);

  // Autumn: the herb-drying rack owns the chimney breast
  rig.update({ ...base, season: 'autumn' }, 'afternoon', 1.0);
  assert.equal(rig.seasonLife.hearthAutumn.visible, true, 'Autumn raises the herb-drying rack');
  assert.equal(rig.seasonLife.hearthSpring.visible, false);
  assert.equal(rig.seasonLife.hearthSummer.visible, false);
  assert.equal(rig.seasonLife.hearthWinter.visible, false);
  rig.group.updateMatrixWorld(true);
  const rackBox = new THREE.Box3().setFromObject(rig.seasonLife.hearthAutumn);
  assert.ok(
    rackBox.min.x > -3.2 && rackBox.max.x < -2.0,
    `Autumn rack sits on the flue face (x ${rackBox.min.x.toFixed(2)}..${rackBox.max.x.toFixed(2)})`,
  );
  assert.ok(rackBox.min.y > 1.55, 'Rack hangs clear of the mantel surface');

  // Winter: knitted hearth sock + evergreen garland replace the rack
  rig.update({ ...base, season: 'winter' }, 'afternoon', 1.0);
  assert.equal(rig.seasonLife.hearthWinter.visible, true, 'Winter dresses the mantel with a hearth sock');
  assert.equal(rig.seasonLife.hearthSpring.visible, false);
  assert.equal(rig.seasonLife.hearthSummer.visible, false);
  assert.equal(rig.seasonLife.hearthAutumn.visible, false);
  const sockBox = new THREE.Box3().setFromObject(rig.seasonLife.hearthWinter);
  assert.ok(
    sockBox.min.y > 1.2 && sockBox.max.y < 1.75,
    `Sock hangs from the mantel edge (y ${sockBox.min.y.toFixed(2)}..${sockBox.max.y.toFixed(2)})`,
  );
  assert.ok(sockBox.max.x < -1.3, 'Sock stays on the chimney mantel zone');

  // The seasonal hearth dressing never inflates the diorama envelope
  const box = new THREE.Box3().setFromObject(rig.group);
  assert.ok(box.min.y >= -0.35 && box.max.y <= 3.6, `Bounds y: ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}`);

  rig.dispose();
  palette.disposeAll();
});

test('cottage interior tea-table moment: reactive teacup appears only while seated at a cottage seat', () => {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());
  const base = createFreshWorldState();

  const teacup = rig.group.getObjectByName('teacupGroup');
  assert.ok(teacup, 'Reactive teacup group exists on the oak table');

  // Standing indoors: teacup hidden
  rig.update(base, 'morning', 1.0);
  assert.equal(teacup.visible, false);

  // Seated at a cottage seat: teacup + steam wisps appear, steam stays bounded
  const seated = {
    ...base,
    playerLocation: 'cottage_interior' as const,
    playerPosture: 'sitting' as const,
    playerSeatId: 'cottage_seat_table_west',
  };
  for (let t = 0; t < 120; t++) {
    rig.update(seated, 'afternoon', t * 0.1 + 2);
    assert.equal(teacup.visible, true);
    for (const child of teacup.children) {
      if (child instanceof THREE.Mesh && child.geometry instanceof THREE.SphereGeometry) {
        assert.ok(child.position.y > 0.05 && child.position.y < 0.5, `Steam wisp bounded: ${child.position.y}`);
        assert.ok(Number.isFinite(child.position.x) && Number.isFinite(child.position.y));
      }
    }
  }

  // Seated outdoors (bench) or on an unknown seat: teacup stays hidden
  rig.update(
    { ...seated, playerSeatId: 'seat_east_plaza' },
    'afternoon',
    3,
  );
  assert.equal(teacup.visible, false);

  rig.dispose();
  palette.disposeAll();
});

test('cottage interior hearth-wall life: mantel candle glows at dusk and the rig carries entry dressing', () => {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());
  const base = createFreshWorldState();

  // Find the mantel flame material via a flame-tagged emissive mesh near the chimney
  let flameMesh: THREE.Mesh | null = null;
  rig.group.traverse((obj) => {
    if (
      obj instanceof THREE.Mesh &&
      obj.material instanceof THREE.MeshStandardMaterial &&
      (obj.material as THREE.MeshStandardMaterial).emissive.getHexString() === 'ffb050' &&
      !flameMesh
    ) {
      flameMesh = obj;
    }
  });
  assert.ok(flameMesh, 'Mantel candle flame exists');
  const flameMat = (flameMesh as THREE.Mesh).material as THREE.MeshStandardMaterial;

  rig.update({ ...base, minuteOfDay: 1120 }, 'dusk', 1.2);
  const duskIntensity = flameMat.emissiveIntensity;
  assert.ok(duskIntensity > 1.2, `Candle flame glows at dusk, got ${duskIntensity.toFixed(2)}`);
  rig.update(base, 'morning', 1.2);
  assert.ok(flameMat.emissiveIntensity < 0.5, 'Candle flame dims by day');

  // Entry dressing: garden boots + straw hat exist in the door/east-corner region
  let bootMeshes = 0;
  let hatMeshes = 0;
  rig.group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const p = obj.position;
      if (p.x > 2.9 && p.x < 3.4 && p.z > -0.7 && p.z < 0.2 && p.y < 0.25) bootMeshes++;
      if (p.x > 2.3 && p.x < 3.0 && p.z < -2.55 && p.y > 1.25 && p.y < 1.55) hatMeshes++;
    }
  });
  assert.ok(bootMeshes >= 4, `Garden boots dress the door recess (got ${bootMeshes})`);
  assert.ok(hatMeshes >= 2, `Straw hat hangs by the wall pegs (got ${hatMeshes})`);

  rig.dispose();
  palette.disposeAll();
});

test('Pass 8: shelf clock hands track the in-game minuteOfDay', () => {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());
  const base = createFreshWorldState();

  // 18:00 (1080) -> hour hand exactly 6 o'clock (half turn), minute hand upright
  rig.update({ ...base, minuteOfDay: 1080 }, 'dusk', 0.0);
  const hourRot1800 = rig.clockHands.hour.rotation.z;
  const minuteRot1800 = rig.clockHands.minute.rotation.z;
  assert.ok(
    Math.abs(hourRot1800 - (-Math.PI)) < 0.01,
    `Hour hand at 18:00 reads a half turn, got ${hourRot1800.toFixed(3)}`,
  );
  assert.ok(
    Math.abs(minuteRot1800) < 0.01,
    `Minute hand at 18:00 sits upright, got ${minuteRot1800.toFixed(3)}`,
  );

  // 8:20 (500) -> minute hand one third around the face
  rig.update({ ...base, minuteOfDay: 500 }, 'morning', 0.0);
  const minuteRot0820 = rig.clockHands.minute.rotation.z;
  assert.ok(
    Math.abs(minuteRot0820 - (-(Math.PI * 2) / 3)) < 0.01,
    `Minute hand at 8:20 reads 20 minutes, got ${minuteRot0820.toFixed(3)}`,
  );

  rig.dispose();
  palette.disposeAll();
});

test('Pass 8: rain reaches the room — streaks, wet glass, dimmed pane, suppressed shaft, hushed motes', () => {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());
  const base = createFreshWorldState();

  const sunlit = { ...base, minuteOfDay: 500, weather: 'sunlit' as const };
  const rain = { ...base, minuteOfDay: 500, weather: 'light_rain' as const };

  rig.update(sunlit, 'morning', 0.4);
  assert.equal(rig.rainStreaks.visible, false, 'Streak group hidden in sunlit weather');
  const sunlitGlass = rig.wetGlassVeilMat.opacity;
  assert.equal(sunlitGlass, 0, 'Glass veil fully clear in sunlit weather');
  const sunlitShaft = rig.windowShaftMat.opacity;

  rig.update(rain, 'morning', 0.4);
  assert.equal(rig.rainStreaks.visible, true, 'Streak group visible in light rain');
  assert.ok(
    rig.rainStreaks.children.length >= 8,
    `Rain streaks dress the west window (got ${rig.rainStreaks.children.length})`,
  );
  const streak = rig.rainStreaks.children[0];
  assert.ok(
    streak.position.y > 0.9 && streak.position.y < 2.1,
    'Streaks fall within the glass span',
  );
  assert.ok(rig.wetGlassVeilMat.opacity > 0.1, 'Wet-glass veil fogs the pane in rain');
  const rainShaft = rig.windowShaftMat.opacity;
  assert.ok(
    rainShaft < sunlitShaft * 0.5,
    `Morning sun shaft suppressed in rain (${rainShaft.toFixed(3)} vs ${sunlitShaft.toFixed(3)})`,
  );
  assert.ok(rig.moteMaterial.opacity < 0.2, 'Dust motes hush during rain');

  // Mist fogs the glass too, but without falling streaks
  rig.update({ ...base, minuteOfDay: 500, weather: 'misty_morning' as const }, 'morning', 0.4);
  assert.equal(rig.rainStreaks.visible, false, 'No falling streaks in mist');
  assert.ok(rig.wetGlassVeilMat.opacity > 0, 'Mist still fogs the glass softly');

  rig.dispose();
  palette.disposeAll();
});

test('Pass 8: breezy days sway the curtains; winter feathers the sill with frost', () => {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());
  const base = createFreshWorldState();

  rig.update({ ...base, minuteOfDay: 600, weather: 'sunlit' as const }, 'afternoon', 2.0);
  const restRotN = rig.curtainPanels.north.rotation.z;
  assert.ok(
    Math.abs(restRotN - 0.02) < 0.005,
    `Curtains rest at their dressed tilt in sunlit weather, got ${restRotN.toFixed(4)}`,
  );

  rig.update({ ...base, minuteOfDay: 600, weather: 'breezy' as const }, 'afternoon', 1.2);
  const breezyRotN = rig.curtainPanels.north.rotation.z;
  assert.ok(
    Math.abs(breezyRotN - 0.02) > 0.004,
    'Curtains sway away from rest in a breeze',
  );

  rig.update({ ...base, minuteOfDay: 600, season: 'winter' as const }, 'afternoon', 0.5);
  assert.equal(rig.frostDressing.visible, true, 'Winter frost dressing appears in winter');
  assert.ok(rig.frostDressing.children.length >= 4, 'Frost covers sill and glass corners');

  rig.update({ ...base, minuteOfDay: 600, season: 'spring' as const }, 'afternoon', 0.5);
  assert.equal(rig.frostDressing.visible, false, 'Frost stays hidden outside winter');

  rig.dispose();
  palette.disposeAll();
});

test('Pass 13: the home remembers — mementos stay hidden in a fresh world', () => {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());
  const base = createFreshWorldState();

  rig.update(base, 'morning', 1.0);
  assert.equal(rig.homeMementos.greenhouseCutting.visible, false, 'No greenhouse cutting before a harvest');
  assert.equal(rig.homeMementos.orchardHoney.visible, false, 'No orchard honey before the harvest memory');
  assert.equal(rig.homeMementos.bakeryCard.visible, false, 'No bakery card before kneading with Clara');
  assert.equal(rig.homeMementos.nookBook.visible, false, 'No borrowed book before reading at the nook');
  assert.equal(rig.homeMementos.teaCaddy.visible, false, 'No tea tin before a tea-table moment');

  rig.dispose();
  palette.disposeAll();
});

test('Pass 13: the home remembers — lived progress reveals each memento at its home surface', () => {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());
  const base = createFreshWorldState();

  const lived = {
    ...base,
    greenhouseState: { ...base.greenhouseState, totalHarvests: 2 },
    bakeryState: { ...base.bakeryState, kneadingSessions: 2 },
    nookState: { ...base.nookState, booksRead: 2 },
    memories: [
      { id: 'mem_orchard_harvest', day: 4, phase: 'afternoon' as const, title: 't', summary: 's' },
      { id: 'mem_teatable_chamomile_pear_tea', day: 9, phase: 'morning' as const, title: 't2', summary: 's2' },
    ],
  };

  rig.update(lived, 'morning', 1.0);
  const m = rig.homeMementos;
  assert.equal(m.greenhouseCutting.visible, true, 'A cutting from the greenhouse reaches the sill');
  assert.equal(m.orchardHoney.visible, true, 'Orchard honey crock appears on the sideboard');
  assert.equal(m.bakeryCard.visible, true, "Clara's recipe card leans on the mantel");
  assert.equal(m.nookBook.visible, true, "Nora's borrowed book rests on the quilt");
  assert.equal(m.teaCaddy.visible, true, 'Everyday tea tin joins the oak table');

  // Each memento lives inside its host furniture footprint (world coordinates),
  // so nothing new protrudes into the walk band.
  const inBox = (obj: THREE.Object3D, x0: number, x1: number, z0: number, z1: number, label: string) => {
    const p = new THREE.Vector3();
    obj.getWorldPosition(p);
    assert.ok(
      p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1,
      `${label} out of footprint: (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`,
    );
  };
  inBox(m.greenhouseCutting, -3.6, -3.3, 0.55, 0.9, 'Greenhouse cutting (west sill end)');
  inBox(m.orchardHoney, 0.25, 2.35, -2.68, -1.88, 'Orchard honey (sideboard)');
  inBox(m.bakeryCard, -3.45, -0.95, -2.68, -1.68, 'Bakery card (hearth mantel)');
  inBox(m.nookBook, -3.42, -1.55, 0.85, 2.55, "Nook book (bed quilt)");
  inBox(m.teaCaddy, -0.45, 0.95, 0.35, 1.65, 'Tea caddy (oak table)');

  // The diorama envelope still holds with all mementos visible
  const box = new THREE.Box3().setFromObject(rig.group);
  assert.ok(box.min.y >= -0.35 && box.max.y <= 3.6, `Bounds y: ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}`);

  // Signals are derived, not sticky: back to a fresh world everything hides again
  rig.update(base, 'morning', 2.0);
  for (const key of Object.keys(m) as Array<keyof typeof m>) {
    assert.equal(m[key].visible, false, `${key} hides again when the world has not lived it`);
  }

  rig.dispose();
  palette.disposeAll();
});

test('Pass 14: seasons of home — sill posy, swag accent, floor scatter and glass tint follow the season', () => {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());
  const base = createFreshWorldState();
  const glass = rig.group.getObjectByName('westWindowGlass') as THREE.Mesh;
  assert.ok(glass, 'West window glass is name-tagged for observation');
  const glassMat = glass.material as THREE.MeshStandardMaterial;

  // Spring: chamomile posy on the sill, petals by the window, blossom swag accent
  rig.update({ ...base, season: 'spring' }, 'morning', 1.0);
  assert.equal(rig.seasonLife.posySpring.visible, true, 'Spring posy fills the sill bottle');
  assert.equal(rig.seasonLife.posySummer.visible, false);
  assert.equal(rig.seasonLife.posyAutumn.visible, false);
  assert.equal(rig.seasonLife.springPetals.visible, true, 'Spring petals drift in by the window');
  assert.equal(rig.seasonLife.autumnLeaves.visible, false);
  assert.equal(rig.seasonLife.doorSwag.visible, true, 'The lintel swag hangs in every season');
  const springAccent = rig.seasonLife.doorSwagAccentMat.color.getHexString();
  const springGlass = glassMat.emissive.getHexString();

  // Summer: lavender posy, lavender swag accent, no petals or leaves
  rig.update({ ...base, season: 'summer' }, 'afternoon', 1.0);
  assert.equal(rig.seasonLife.posySummer.visible, true, 'Summer lavender fills the sill bottle');
  assert.equal(rig.seasonLife.springPetals.visible, false);
  const summerAccent = rig.seasonLife.doorSwagAccentMat.color.getHexString();
  assert.notEqual(summerAccent, springAccent, 'Swag accent swaps with the season');

  // Autumn: marigold/red leaf posy, leaves by the door, warm accent
  rig.update({ ...base, season: 'autumn' }, 'afternoon', 1.0);
  assert.equal(rig.seasonLife.posyAutumn.visible, true, 'Autumn leaf posy fills the sill bottle');
  assert.equal(rig.seasonLife.autumnLeaves.visible, true, 'Fallen leaves gather by the door');
  assert.equal(rig.seasonLife.springPetals.visible, false);
  const autumnAccent = rig.seasonLife.doorSwagAccentMat.color.getHexString();
  assert.notEqual(autumnAccent, summerAccent);

  // Winter: frost owns the sill (no posy), brass bell accent, cool glass tint
  rig.update({ ...base, season: 'winter' }, 'afternoon', 1.0);
  assert.equal(rig.seasonLife.posySpring.visible, false, 'Winter hides the sill posies');
  assert.equal(rig.seasonLife.posySummer.visible, false);
  assert.equal(rig.seasonLife.posyAutumn.visible, false);
  assert.equal(rig.seasonLife.springPetals.visible, false);
  assert.equal(rig.seasonLife.autumnLeaves.visible, false);
  const winterAccent = rig.seasonLife.doorSwagAccentMat.color.getHexString();
  assert.notEqual(winterAccent, autumnAccent, 'Winter swag carries a distinct bell accent');
  const winterGlass = glassMat.emissive.getHexString();
  assert.notEqual(winterGlass, springGlass, 'Winter glass tints cool vs spring warmth');

  // The dressed seasons never inflate the diorama envelope
  const box = new THREE.Box3().setFromObject(rig.group);
  assert.ok(box.min.y >= -0.35 && box.max.y <= 3.6, `Bounds y: ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}`);

  rig.dispose();
  palette.disposeAll();
});

test('QA-FINAL D-1: wall-mounted dressing hides with its wall (no floating props)', () => {
  const palette = new MaterialPalette();
  const rig = buildWillowCottageInterior(palette, new THREE.Texture());
  const shells = collectShellSides(rig.group);
  assert.ok(shells.length > 20, `cottage shell coverage: ${shells.length}`);

  // The QA-FINAL finding: static wall-mounted dressing (coat pegs + hat,
  // botanical prints, wall clock, curtains, scarf peg, herb bundle, pendant
  // lantern) must be tagged so the yaw-aware cutaway hides it WITH the wall.
  // Locked by counting tagged N/W coverage — the dressing pushed the tagged
  // count from ~21 (assembly only) well past 30.
  const north = shells.filter((s) => s.side === 'N' && s.full);
  const west = shells.filter((s) => s.side === 'W' && s.full);
  assert.ok(north.length >= 10, `north full-wall coverage: ${north.length}`);
  assert.ok(west.length >= 10, `west full-wall coverage: ${west.length}`);

  // Hidden-wall behavior: rotating the camera to the N side hides the north
  // assembly INCLUDING its mounted dressing (spot-check the clock + pendant).
  const findByNamePosition = (y: number, z: number) =>
    shells.find((s) => Math.abs(s.mesh.position.y - y) < 0.3 && Math.abs(s.mesh.position.z - z) < 0.3);
  const clock = findByNamePosition(2.26, -2.6);
  assert.ok(clock && clock.side === 'N' && clock.full, 'clock is tagged N full');
  applyShellCutaway(shells, Math.PI);
  assert.ok(!clock.mesh.visible, 'clock hides with the north wall');
  const westWall = west.find((s) => s.mesh.position.y > 1 && Math.abs(s.mesh.position.x - -3.59) < 0.05);
  assert.ok(westWall, 'west wall shell present');
  assert.ok(westWall.mesh.visible, 'west wall stays visible at north yaw');
  applyShellCutaway(shells, AUTHORED_YAW);
  assert.ok(clock.mesh.visible, 'restored at the authored angle');
});
