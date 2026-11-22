import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MaterialPalette, STORYBOOK_PALETTE } from './materials';
import { buildStorybookBench, buildStorybookFountain, STORYBOOK_FOUNTAIN_SPEC } from './builders/landmarks';
import { CIRCLE_OBSTACLES, isPointWalkable } from '../game/worldMap';

/**
 * WORLD-QUALITY OVERHAUL (Doc 04 §5) — plaza fountain rebuild locks.
 *
 * The fountain was rebuilt from the octagonal 24-seg build into a fully circular
 * two-tier cream-stone fountain matching the approved reference. These tests pin:
 *   1. the FountainRig contract consumed by NeighborhoodCanvas/environmentRenderer,
 *   2. the narrative state groups (dry clog debris / submerged coins / cascades),
 *   3. the per-material merged masonry budget (draw-call consolidation),
 *   4. the physical footprint against the fountain_basin collision circle and the
 *      measured player reach at the walkable rim (2.95 from center),
 *   5. the pale-blue reference water material + shared uniform system,
 *   6. the decorative stone ring around the apron.
 */

function makeRig() {
  const palette = new MaterialPalette();
  const dummyTex = new THREE.Texture();
  const rig = buildStorybookFountain(palette, dummyTex);
  return { palette, dummyTex, rig };
}

function halfWidth(obj: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(obj);
  return (box.max.x - box.min.x) * 0.5;
}

test('plaza fountain rebuild keeps the full FountainRig contract at the plaza anchor', () => {
  const { palette, dummyTex, rig } = makeRig();

  // Rig contract consumed by environmentRenderer + NeighborhoodCanvas
  assert.ok(rig.group instanceof THREE.Group);
  assert.ok(rig.waterMesh instanceof THREE.Mesh);
  assert.ok(rig.spoutParticles instanceof THREE.Group);
  assert.ok(rig.clogDebrisGroup instanceof THREE.Group);
  assert.ok(rig.submergedCoinsGroup instanceof THREE.Group);
  assert.ok(rig.cascadeGroup instanceof THREE.Group);
  assert.ok((rig.splashRings?.length ?? 0) >= 5);
  assert.ok(rig.waterMat instanceof THREE.MeshStandardMaterial);
  assert.ok(rig.streamMat instanceof THREE.MeshStandardMaterial);

  // Scene anchor: true basin center (0, 0, 1.5) — matches FOUNTAIN_CENTER worldMap
  // anchor, fountain_basin collision circle, and the NC raycast proxy.
  assert.deepEqual(
    [rig.group.position.x, rig.group.position.y, rig.group.position.z],
    [0, 0, 1.5],
  );

  // Water: basin disc is the contract mesh (CircleGeometry, pale water at y 0.62
  // above the weathered floor at 0.505), with tier discs as children.
  assert.ok(rig.waterMesh.geometry instanceof THREE.CircleGeometry);
  assert.equal(rig.waterMesh.geometry.parameters.radius, 2.2);
  assert.equal(rig.waterMesh.position.y, STORYBOOK_FOUNTAIN_SPEC.waterY);
  assert.ok(
    rig.waterMesh.position.y > 0.505 + 0.08,
    'water disc must sit cleanly above the dry stone bed',
  );
  const tierDiscs = rig.waterMesh.children.filter(
    (c): c is THREE.Mesh =>
      c instanceof THREE.Mesh && c.geometry instanceof THREE.CircleGeometry,
  );
  assert.equal(tierDiscs.length, 2, 'lower bowl + upper tier water discs ride as children');

  // Shared water shader uniform system (onBeforeCompile, waterShaders.ts)
  const uniforms = rig.waterMat?.userData.waterUniforms as Record<string, { value: unknown }>;
  assert.ok(uniforms, 'waterMat must expose the waterUniforms userData handle');
  for (const key of [
    'uTime',
    'uRain',
    'uWinter',
    'uWind',
    'uDusk',
    'uSplashPos',
    'uSplashAge',
  ]) {
    assert.ok(key in uniforms, `waterMat uniforms missing ${key}`);
  }
  const streamUniforms = rig.streamMat?.userData.waterUniforms as Record<string, { value: unknown }>;
  assert.ok(streamUniforms, 'streamMat must expose the waterUniforms userData handle');

  palette.disposeAll();
  dummyTex.dispose();
});

test('narrative states: clog debris dry-only, submerged coins & cascades flowing-only', () => {
  const { palette, dummyTex, rig } = makeRig();

  // Fresh (unrepaired) world defaults — environmentRenderer toggles from these.
  assert.equal(rig.clogDebrisGroup!.visible, true, 'clog debris visible while dry');
  assert.equal(rig.submergedCoinsGroup!.visible, false, 'coins hidden until repaired');
  assert.equal(rig.cascadeGroup!.visible, false, 'cascades hidden until repaired');
  assert.equal(rig.spoutParticles.visible, false, 'droplets hidden until repaired');
  assert.equal(rig.waterMesh.visible, false, 'water hidden until repaired');

  // Clog contents: merged autumn leaves + twig; coins: pebbles + copper/gold coins.
  assert.ok(rig.clogDebrisGroup!.children.length >= 2);
  assert.ok(rig.submergedCoinsGroup!.children.length >= 3);
  assert.ok(
    rig.clogDebrisGroup!.children.some((c) => c.name === 'fountain_clog_leaves'),
    'clog leaves are merged into one mesh',
  );

  palette.disposeAll();
  dummyTex.dispose();
});

test('droplets: 28 ballistic sprites, 8 crown then 20 basin, shared geometry/material', () => {
  const { palette, dummyTex, rig } = makeRig();

  const drops = rig.spoutParticles.children;
  assert.equal(drops.length, STORYBOOK_FOUNTAIN_SPEC.dropletCount);
  assert.equal(drops.length, 28);

  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  let crown = 0;
  let basin = 0;
  for (const [i, drop] of drops.entries()) {
    assert.ok(drop instanceof THREE.Mesh, `child ${i} must be a Mesh sprite`);
    assert.equal(typeof drop.userData.phase, 'number', `child ${i} carries a phase`);
    assert.ok(
      drop.userData.kind === 'crown' || drop.userData.kind === 'basin',
      `child ${i} carries a ballistic kind`,
    );
    if (drop.userData.kind === 'crown') crown += 1;
    else basin += 1;
    geos.add((drop as THREE.Mesh).geometry);
    mats.add((drop as THREE.Mesh).material as THREE.Material);
  }
  assert.equal(crown, STORYBOOK_FOUNTAIN_SPEC.crownDroplets);
  assert.equal(basin, STORYBOOK_FOUNTAIN_SPEC.basinDroplets);
  // Kind layout is the envRenderer contract: children 0-7 crown, 8+ basin.
  assert.equal(drops[0].userData.kind, 'crown');
  assert.equal(drops[7].userData.kind, 'crown');
  assert.equal(drops[8].userData.kind, 'basin');
  assert.equal(geos.size, 1, 'droplets share one sphere geometry');
  assert.equal(mats.size, 1, 'droplets share one material');

  palette.disposeAll();
  dummyTex.dispose();
});

test('static masonry is merged per material and fully circular (32-seg)', () => {
  const { palette, dummyTex, rig } = makeRig();
  rig.group.updateMatrixWorld(true);

  // Masonry meshes at the group root: apron steps (pinned standalone Cylinder),
  // basin lathe (pinned standalone Lathe), coping (pinned standalone Torus), and
  // the pedestal lathe. Budget per Doc 04 §5 consolidation pass.
  const masonry = rig.group.children.filter(
    (c): c is THREE.Mesh =>
      c instanceof THREE.Mesh &&
      (c.geometry instanceof THREE.CylinderGeometry ||
        c.geometry instanceof THREE.LatheGeometry ||
        c.geometry instanceof THREE.TorusGeometry),
  );
  assert.ok(
    masonry.length <= STORYBOOK_FOUNTAIN_SPEC.masonryMeshBudget,
    `masonry mesh count ${masonry.length} must stay within the merged budget`,
  );
  assert.equal(masonry.length, 5, 'apron×2 + basin lathe + pedestal lathe + coping');

  // Fully circular construction: every round masonry part is a 32-seg revolve
  // (no octagonal 8-seg aprons/corbels from the old build).
  for (const mesh of masonry) {
    if (mesh.geometry instanceof THREE.CylinderGeometry) {
      assert.equal(mesh.geometry.parameters.radialSegments, 32);
    } else if (mesh.geometry instanceof THREE.LatheGeometry) {
      assert.equal(mesh.geometry.parameters.segments, 32);
    } else if (mesh.geometry instanceof THREE.TorusGeometry) {
      assert.equal(mesh.geometry.parameters.tubularSegments, 48);
      assert.equal(mesh.geometry.parameters.radialSegments, 16);
    }
  }

  // The named merged meshes exist with shared materials (BufferGeometryUtils).
  for (const name of [
    'fountain_basin_lathe',
    'fountain_pedestal_lathe',
    'fountain_brass_merged',
    'fountain_bronze_merged',
    'fountain_moss_waterline',
    'fountain_moss_coping',
    'fountain_stone_ring_grey',
    'fountain_stone_ring_moss',
  ]) {
    const mesh = rig.group.children.find(
      (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.name === name,
    );
    assert.ok(mesh, `expected merged/standalone mesh '${name}' at the group root`);
    assert.ok((mesh as THREE.Mesh).geometry instanceof THREE.BufferGeometry);
  }

  // Cascades: one merged stream mesh (6 jets + 6 weir arcs + 2 plumes) on streamMat.
  const streams = rig.cascadeGroup!.children[0] as THREE.Mesh;
  assert.equal(rig.cascadeGroup!.children.length, 1);
  assert.equal(streams.name, 'fountain_streams_merged');
  assert.equal(streams.userData.streamCount, 14);
  assert.equal(streams.material, rig.streamMat);
  const streamBox = new THREE.Box3().setFromObject(streams);
  assert.ok(
    streamBox.max.y > 3.0 && streamBox.max.y < 3.2,
    `crown plume apex should arc to ~3.08 (got ${streamBox.max.y.toFixed(3)})`,
  );

  palette.disposeAll();
  dummyTex.dispose();
});

test('footprint matches the fountain_basin collision circle and keeps player rim clearance', () => {
  const { palette, dummyTex, rig } = makeRig();
  rig.group.updateMatrixWorld(true);

  const obstacle = CIRCLE_OBSTACLES.find((o) => o.id === 'fountain_basin')!;
  assert.equal(obstacle.x, 0);
  assert.equal(obstacle.z, 1.5);
  assert.equal(obstacle.radius, 2.46);

  // Water-holding body (basin lathe + bullnose coping) stays inside the collision
  // circle with a small tolerance.
  const basin = rig.group.children.find(
    (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.name === 'fountain_basin_lathe',
  )!;
  const coping = rig.group.children.find(
    (c): c is THREE.Mesh =>
      c instanceof THREE.Mesh && c.geometry instanceof THREE.TorusGeometry,
  )!;
  const basinRadius = halfWidth(basin);
  const copingRadius = halfWidth(coping);
  assert.ok(
    basinRadius <= obstacle.radius + 0.02,
    `basin outer r ${basinRadius.toFixed(3)} must track the collision circle r ${obstacle.radius}`,
  );
  assert.ok(
    copingRadius <= obstacle.radius + 0.02,
    `coping outer r ${copingRadius.toFixed(3)} must track the collision circle r ${obstacle.radius}`,
  );

  // Measured player reach toward the fountain center when standing at the
  // walkable rim (2.95, isPointWalkable boundary) in idle & interact poses
  // (environmentRenderer.test.ts clearance rig): body 2.4650, boots 2.7278.
  const PLAYER_BODY_REACH_AT_RIM = 2.465;
  const PLAYER_BOOT_REACH_AT_RIM = 2.7278;
  const apron = rig.group.children.find(
    (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.geometry instanceof THREE.CylinderGeometry,
  )!;
  const apronRadius = halfWidth(apron);
  assert.ok(
    copingRadius + 0.05 < PLAYER_BODY_REACH_AT_RIM,
    `coping ${copingRadius.toFixed(3)} must clear the player body reach (${PLAYER_BODY_REACH_AT_RIM})`,
  );
  assert.ok(
    apronRadius + 0.05 < PLAYER_BOOT_REACH_AT_RIM,
    `apron ${apronRadius.toFixed(3)} must clear the player boot reach (${PLAYER_BOOT_REACH_AT_RIM})`,
  );
  // The rim walk boundary itself is untouched (player.test.ts pins 2.93/2.96).
  assert.equal(isPointWalkable(2.93, 1.5, 0.48), false);
  assert.equal(isPointWalkable(0, 1.5 + 2.96, 0.48), true);

  // Spec ↔ geometry agreement.
  assert.ok(Math.abs(apronRadius - STORYBOOK_FOUNTAIN_SPEC.apronOuterRadius) <= 0.01);
  assert.ok(Math.abs(copingRadius - STORYBOOK_FOUNTAIN_SPEC.copingOuterRadius) <= 0.01);

  palette.disposeAll();
  dummyTex.dispose();
});

test('water material is the pale-blue reference family with tuned translucency', () => {
  const { palette, dummyTex, rig } = makeRig();

  assert.equal(
    rig.waterMat!.color.getHexString(),
    new THREE.Color(STORYBOOK_FOUNTAIN_SPEC.waterColorHex).getHexString(),
  );
  assert.ok(rig.waterMat!.transparent, 'basin water reads as translucent pale blue');
  assert.equal(rig.waterMat!.opacity, 0.88);
  assert.ok(rig.streamMat!.transparent, 'stream ribbons read as aerated foam');

  // Splash ripple rings keep the per-ring phase contract for the renderer.
  assert.equal(rig.splashRings!.length, 5);
  for (const [i, ring] of rig.splashRings!.entries()) {
    assert.equal(typeof ring.userData.phaseOffset, 'number');
    assert.equal(ring.userData.phaseOffset, i * 0.23);
    assert.ok(ring.material instanceof THREE.MeshBasicMaterial);
  }

  palette.disposeAll();
  dummyTex.dispose();
});

test('decorative stone ring: 10 rounded moss/grey stones around the apron', () => {
  const { palette, dummyTex, rig } = makeRig();
  rig.group.updateMatrixWorld(true);

  const grey = rig.group.children.find(
    (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.name === 'fountain_stone_ring_grey',
  );
  const mossy = rig.group.children.find(
    (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.name === 'fountain_stone_ring_moss',
  );
  assert.ok(grey && mossy, 'stone ring merges into grey + moss meshes');
  const total =
    (grey!.userData.stoneRingCount ?? 0) + (mossy!.userData.stoneRingCount ?? 0);
  assert.equal(total, STORYBOOK_FOUNTAIN_SPEC.stoneRingCount);
  assert.ok(total >= 8 && total <= 10, 'reference shows a sparse 8-10 stone ring');

  // Radial extent measured per-vertex (a box-corner hypot overestimates a ring).
  const radial = (mesh: THREE.Mesh): { min: number; max: number } => {
    const pos = (mesh.geometry as THREE.BufferGeometry).getAttribute('position');
    let min = Infinity;
    let max = -Infinity;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos as THREE.BufferAttribute, i);
      const r = Math.hypot(v.x, v.z);
      min = Math.min(min, r);
      max = Math.max(max, r);
    }
    return { min, max };
  };
  const greyR = radial(grey!);
  const mossR = radial(mossy!);
  const innerR = Math.min(greyR.min, mossR.min);
  const outerR = Math.max(greyR.max, mossR.max);
  assert.ok(innerR >= 2.55, `stones must hug the apron edge (inner ${innerR.toFixed(3)})`);
  assert.ok(outerR <= 3.05, `stones must hug the base (outer ${outerR.toFixed(3)})`);
  // Squashed, partially sunk: ring tops stay low against the cobblestone ground.
  const ringBox = new THREE.Box3();
  ringBox.union(new THREE.Box3().setFromObject(grey!));
  ringBox.union(new THREE.Box3().setFromObject(mossy!));
  assert.ok(ringBox.max.y <= 0.25, `stone tops must stay low (max y ${ringBox.max.y.toFixed(3)})`);

  palette.disposeAll();
  dummyTex.dispose();
});

test('spouts, weirs and crown plume counts match the reference two-tier layout', () => {
  const { palette, dummyTex, rig } = makeRig();

  // Brass merged mesh carries 6 spout nozzles + 6 collars + finial + valve wheel.
  const brass = rig.group.children.find(
    (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.name === 'fountain_brass_merged',
  )!;
  assert.ok(brass, 'brass parts merged into one mesh');
  const bronze = rig.group.children.find(
    (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.name === 'fountain_bronze_merged',
  )!;
  assert.ok(bronze, 'bronze parts merged into one mesh');

  // Spec coherence with the worldMap interaction metrics: the weir-arc landing
  // radius must match the wish-splash point (r ≈ 1.18-1.22 from center).
  assert.ok(
    Math.abs(STORYBOOK_FOUNTAIN_SPEC.weirLandingRadius - 1.2) <= 0.05,
    'weir arcs land where the shader splash centers, droplets and wish ripple meet (r ≈ 1.2)',
  );
  assert.equal(STORYBOOK_FOUNTAIN_SPEC.spoutCount, 6);
  assert.equal(STORYBOOK_FOUNTAIN_SPEC.weirCount, 6);
  assert.equal(STORYBOOK_FOUNTAIN_SPEC.plumeCount, 2);
  assert.equal(STORYBOOK_FOUNTAIN_SPEC.finialTipY, 2.86);

  // Cream limestone family only (palette registry, no new texture families).
  const limestoneFamily = new Set([
    new THREE.Color(STORYBOOK_PALETTE.limestone).getHexString(),
    new THREE.Color(STORYBOOK_PALETTE.limestoneCurb).getHexString(),
    new THREE.Color(STORYBOOK_PALETTE.fieldstoneDark).getHexString(),
  ]);
  const basin = rig.group.children.find(
    (c): c is THREE.Mesh => c instanceof THREE.Mesh && c.name === 'fountain_basin_lathe',
  )!;
  assert.ok(
    limestoneFamily.has((basin.material as THREE.MeshStandardMaterial).color.getHexString()),
    'basin reads as warm cream/beige stone',
  );

  palette.disposeAll();
  dummyTex.dispose();
});

/**
 * FURN-1 — bench v2 quality pass (curved cedar side frames, mint/sage
 * upholstery, radiused backrest, brass bolts). The seat contract consumed by
 * NeighborhoodCanvas / environmentRenderer / build02Exterior is locked; the
 * visual construction around it was rebuilt in place.
 */
test('FURN-1 bench v2: locked seat contract, v2 part inventory, ≤14 draw calls, hidden winter cushions', () => {
  const palette = new MaterialPalette();
  const dummyTex = new THREE.Texture();
  const bench = buildStorybookBench(palette, dummyTex);
  bench.updateMatrixWorld(true);

  // Regression-locked seat contract (identical values, untouched rotation code)
  assert.equal(Number(bench.userData.seatTopY), 0.365, 'seatTopY contract');
  assert.equal(Number(bench.userData.backrestFrontZ), -0.262, 'backrestFrontZ contract');

  // Slat inventory: 4 crowned seat slats sharing ONE extruded geometry, still
  // direct children of the bench group (build02 mirroring contract intact).
  const slats = bench.children.filter(
    (o): o is THREE.Mesh => o instanceof THREE.Mesh && o.geometry instanceof THREE.ExtrudeGeometry,
  );
  assert.equal(slats.length, 4, 'four crowned seat slats');
  assert.ok(slats.every((m) => m.geometry === slats[0].geometry), 'slat geometry is shared');
  const slatBox = new THREE.Box3().setFromObject(slats[0]);
  assert.ok(
    slatBox.max.y > 0.365 && slatBox.max.y < 0.39,
    `softer crown peaks just over the seat line, got ${slatBox.max.y.toFixed(3)}`,
  );

  // v2 part inventory: merged cedar frames, merged dark cedar caps+posts+top
  // rail, sage arm pads, mint fabric seat pad, merged backrest slats, brass bolts.
  const named = (name: string): THREE.Mesh | undefined =>
    bench.children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh && c.name === name);
  for (const part of [
    'bench_cedar_frames',
    'bench_cedar_dark_merged',
    'bench_arm_pads',
    'bench_seat_pad',
    'bench_backrest_slats',
    'bench_brass_bolts',
  ]) {
    assert.ok(named(part), `bench v2 part present: ${part}`);
  }

  // The seat pad is mint upholstery fabric and sits ON the slats in all seasons
  // (never gated to winter): visible by default and colored upholsteryMint.
  const pad = named('bench_seat_pad')!;
  assert.equal(pad.visible, true, 'seat pad ships visible (all-season)');
  const mintHex = new THREE.Color(STORYBOOK_PALETTE.upholsteryMint).getHexString();
  assert.equal((pad.material as THREE.MeshStandardMaterial).color.getHexString(), mintHex);
  const padBox = new THREE.Box3().setFromObject(pad);
  assert.ok(
    padBox.min.y >= slatBox.max.y - 0.01 && padBox.max.y < 0.46,
    `pad rests on the crowned slats (y ${padBox.min.y.toFixed(3)}..${padBox.max.y.toFixed(3)})`,
  );

  // Radiused backrest slats keep their front face behind the locked contract plane.
  const backBox = new THREE.Box3().setFromObject(named('bench_backrest_slats')!);
  assert.ok(
    backBox.min.z <= Number(bench.userData.backrestFrontZ),
    `backrest front face ${backBox.min.z.toFixed(3)} stays behind backrestFrontZ`,
  );

  // Draw-call budget: every renderable mesh (own + ancestor visibility),
  // contact-shadow quad included, must stay ≤ 14 per bench.
  let drawn = 0;
  bench.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (let a: THREE.Object3D | null = m; a; a = a.parent) {
      if (!a.visible) return;
    }
    drawn += 1;
  });
  assert.ok(drawn <= 14, `bench v2 draws ≤14 calls by default, got ${drawn}`);

  // Winter cushion group: present, ≥2 knit cushions, hidden by default, rides
  // OVER the pad (top above the pad's top line).
  const cushions = bench.userData.winterCushions as THREE.Group;
  assert.ok(cushions instanceof THREE.Group, 'winterCushions group present');
  assert.ok(cushions.children.length >= 2, 'two knit winter cushions');
  assert.equal(cushions.visible, false, 'winter cushions ship hidden');
  const cushionBox = new THREE.Box3().setFromObject(cushions);
  assert.ok(cushionBox.max.y > padBox.max.y - 0.01, 'winter cushions sit over the seat pad');

  palette.disposeAll();
  dummyTex.dispose();
});
