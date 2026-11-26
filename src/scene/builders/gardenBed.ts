import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MaterialPalette, STORYBOOK_PALETTE } from '../materials';
import { addStaticContactShadow } from '../contactShadows';
import { GreenhousePlotState, SeasonType } from '../../game/types';

/**
 * Outdoor Garden Bed Rig (Gardening Expansion — WS-C).
 *
 * Reusable Three.js scene builder for outdoor raised garden beds. Mirrors the
 * "Premium Handcrafted Storybook Diorama" art direction and follows the
 * Sunbeam Greenhouse interior rig pattern: per-plot stage sub-groups toggled
 * by visibility writes, two pre-instantiated soil materials swapped on
 * `plot.wateredToday`, and a gentle ambient sway on visible blooms.
 *
 * The rig is the outdoor twin of `greenhouseInterior.ts`'s plot shelf — same
 * stage vocabulary (0 empty/seeded · 1 sprout · 2 leafy · 3 bloom), same soil
 * material swap, same bloom sway phase constants — but laid out across a
 * cedar raised-bed frame instead of terracotta pots on a shelf. Geometry is
 * merged (`mergeGeometries`, same as orchard/wilds) so each plot's stage
 * sub-group is ONE mesh, keeping draw calls minimal.
 *
 * Draw-call budget per bed: 1 (merged cedar frame) + N (per-plot soil, 1..4)
 * + up to N (one merged stage mesh per visible plot) + 0 (contact shadow
 * amortised into the scene-wide instanced batch) ≈ 6 typical, ≤ 9 worst case.
 *
 * The rig works for ANY `GardenBedSpec` — no hardcoded positions. All layout
 * is derived from `width` / `depth` / `plotCount`.
 */

export interface GardenBedSpec {
  /** World-space X position of the bed centre. */
  x: number;
  /** World-space Z position of the bed centre. */
  z: number;
  /** Yaw rotation around Y (radians). Optional, defaults to 0. */
  yaw?: number;
  /** Bed footprint width along X (metres). Clamped to ≥ 0.6. */
  width: number;
  /** Bed footprint depth along Z (metres). Clamped to ≥ 0.6. */
  depth: number;
  /** Plot count, clamped to 1..4. */
  plotCount: number;
}

export interface GardenBedRig {
  group: THREE.Group;
  /**
   * Per-frame reactive update — zero allocations.
   *
   * @param plots   Index-aligned with the spec's plotCount; missing/extra entries tolerated.
   * @param season  Current season; 'winter' forces all stage groups hidden (dormant).
   * @param elapsed Seconds since scene start; drives the bloom sway phase.
   */
  update(plots: GreenhousePlotState[], season: SeasonType, elapsed: number): void;
  /** Removes the group from its parent and disposes owned geometries. */
  dispose(): void;
}

// ----- Frame & soil constants (metres) -----
const BOARD_THICKNESS = 0.12;
const BOARD_HEIGHT = 0.18;
const SOIL_HEIGHT = 0.1;
/** Soil centre Y; top sits at 0.17 (just below frame top 0.18). */
const SOIL_Y = 0.12;
/** Stage group origin Y; embedded in soil so plants emerge from the surface. */
const STAGE_BASE_Y = 0.13;
/** Per-plot soil inset from its cell edge (small gap reads as a soil row). */
const SOIL_MARGIN = 0.04;

export function buildGardenBedRig(
  palette: MaterialPalette,
  shadowTex: THREE.Texture,
  spec: GardenBedSpec,
): GardenBedRig {
  const plotCount = Math.max(1, Math.min(4, Math.floor(spec.plotCount)));
  const width = Math.max(0.6, spec.width);
  const depth = Math.max(0.6, spec.depth);

  const group = new THREE.Group();
  group.position.set(spec.x, 0, spec.z);
  if (spec.yaw) group.rotation.y = spec.yaw;

  const ownedGeos: THREE.BufferGeometry[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    ownedGeos.push(g);
    return g;
  };

  // ----- Shared palette materials (scene-owned; rig does NOT dispose these) -----
  const cedarMat = palette.standard(
    STORYBOOK_PALETTE.cedarDark,
    0.74,
    0.04,
    { mapSet: 'timber-dark' },
  );
  // Two pre-instantiated soil materials; swapped per plot in update().
  const soilDryMat = palette.standard('#7A5B42', 0.95, 0.0);
  const soilWetMat = palette.standard('#4E3A2C', 0.94, 0.0);

  const sproutMat = palette.standard(
    STORYBOOK_PALETTE.foliageSun,
    0.78,
    0.0,
    { mapSet: 'foliage' },
  );
  const leafyMat = palette.standard(
    STORYBOOK_PALETTE.foliageMid,
    0.8,
    0.0,
    { mapSet: 'foliage' },
  );
  // Single generic bloom material — petalMarigold reads as marigold, chamomile,
  // sage, lavender, etc. at diorama camera distance. Subtle emissive for the
  // storybook "warm glow" without breaking palette authority.
  const bloomMat = palette.get('garden_bed_bloom_marigold', {
    color: STORYBOOK_PALETTE.petalMarigold,
    emissive: '#F2C66A',
    emissiveIntensity: 0.12,
    roughness: 0.6,
    metalness: 0.0,
  });

  // ---------------------------------------------------------------------
  // 1. Cedar frame — 4 boards merged into 1 mesh
  // ---------------------------------------------------------------------
  // Long boards (Z-aligned) at x = ±(W/2 - T/2), span the full depth.
  // Cross boards (X-aligned) at z = ±(D/2 - T/2), span the full width.
  // Corners overlap by T² — same lapped join real raised beds use.
  const halfW = width / 2;
  const halfD = depth / 2;
  const longX = halfW - BOARD_THICKNESS / 2;
  const crossZ = halfD - BOARD_THICKNESS / 2;

  const frameGeos: THREE.BufferGeometry[] = [];
  for (const [bx, bz, bw, bd] of [
    [-longX, 0, BOARD_THICKNESS, depth],
    [longX, 0, BOARD_THICKNESS, depth],
    [0, -crossZ, width, BOARD_THICKNESS],
    [0, crossZ, width, BOARD_THICKNESS],
  ] as const) {
    const board = new THREE.BoxGeometry(bw, BOARD_HEIGHT, bd);
    board.translate(bx, BOARD_HEIGHT / 2, bz);
    frameGeos.push(board);
  }
  const frameMesh = new THREE.Mesh(
    trackGeo(mergeGeometries(frameGeos, false) ?? frameGeos[0]),
    cedarMat,
  );
  frameMesh.castShadow = true;
  frameMesh.receiveShadow = true;
  group.add(frameMesh);

  // ---------------------------------------------------------------------
  // 2. Plot layout inside the frame interior
  // ---------------------------------------------------------------------
  // Cells tile the interior (W - 2T) × (D - 2T) so soil segments never poke
  // under the cedar boards. Grid picks the longer interior axis for rows of 2/3.
  const interiorW = width - 2 * BOARD_THICKNESS;
  const interiorD = depth - 2 * BOARD_THICKNESS;

  let cols: number;
  let rows: number;
  if (plotCount <= 1) {
    cols = 1; rows = 1;
  } else if (plotCount === 2) {
    cols = 2; rows = 1;
  } else if (plotCount === 3) {
    if (interiorW >= interiorD) { cols = 3; rows = 1; }
    else { cols = 1; rows = 3; }
  } else {
    cols = 2; rows = 2;
  }

  const cellW = interiorW / cols;
  const cellD = interiorD / rows;
  const plotPositions: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < plotCount; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    plotPositions.push({
      x: -interiorW / 2 + cellW * (c + 0.5),
      z: -interiorD / 2 + cellD * (r + 0.5),
    });
  }

  // ---------------------------------------------------------------------
  // 3. Per-plot soil segments (material swap in update)
  // ---------------------------------------------------------------------
  // One shared geometry, one mesh per plot — material swapped per plot so
  // each watered plot reads dark independently.
  const soilSegW = cellW - SOIL_MARGIN * 2;
  const soilSegD = cellD - SOIL_MARGIN * 2;
  const soilGeo = trackGeo(new THREE.BoxGeometry(soilSegW, SOIL_HEIGHT, soilSegD));
  const soilMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < plotCount; i++) {
    const soil = new THREE.Mesh(soilGeo, soilDryMat);
    soil.position.set(plotPositions[i].x, SOIL_Y, plotPositions[i].z);
    soil.receiveShadow = true;
    group.add(soil);
    soilMeshes.push(soil);
  }

  // ---------------------------------------------------------------------
  // 4. Per-plot stage groups (sprout · leafy · bloom)
  // ---------------------------------------------------------------------
  // Each stage sub-group is ONE merged mesh — visibility toggles in update()
  // are pure writes (zero allocations). Bloom carries the ambient sway.
  const plotStages: Array<{
    sprout: THREE.Group;
    leafy: THREE.Group;
    bloom: THREE.Group;
  }> = [];

  for (let i = 0; i < plotCount; i++) {
    const pos = plotPositions[i];
    const plotOrigin = new THREE.Group();
    plotOrigin.position.set(pos.x, 0, pos.z);

    // --- Stage 1 sprout: 2 squashed-sphere cotyledons + thin cylinder stem ---
    const sprout = new THREE.Group();
    const sproutGeos: THREE.BufferGeometry[] = [];
    {
      const leafL = new THREE.SphereGeometry(0.06, 6, 5);
      leafL.scale(1.0, 0.5, 0.7);
      leafL.translate(-0.05, 0.05, 0);
      sproutGeos.push(leafL);
      const leafR = new THREE.SphereGeometry(0.06, 6, 5);
      leafR.scale(1.0, 0.5, 0.7);
      leafR.translate(0.05, 0.05, 0);
      sproutGeos.push(leafR);
      const stem = new THREE.CylinderGeometry(0.012, 0.014, 0.1, 5);
      stem.translate(0, 0.05, 0);
      sproutGeos.push(stem);
    }
    const sproutMesh = new THREE.Mesh(
      trackGeo(mergeGeometries(sproutGeos, false) ?? sproutGeos[0]),
      sproutMat,
    );
    sproutMesh.castShadow = true;
    sprout.add(sproutMesh);
    sprout.position.y = STAGE_BASE_Y;
    sprout.visible = false;
    plotOrigin.add(sprout);

    // --- Stage 2 leafy: 3-4 squashed-sphere clumps (foliageMid) ---
    const leafy = new THREE.Group();
    const leafyGeos: THREE.BufferGeometry[] = [];
    const clumpLayout: Array<[number, number, number, number]> = [
      [-0.06, 0.04, 0.02, 0.85],
      [0.06, 0.04, -0.03, 0.78],
      [0.0, 0.04, 0.06, 0.72],
      [0.02, 0.04, -0.04, 0.66],
    ];
    for (const [cx, cy, cz, s] of clumpLayout) {
      const clump = new THREE.SphereGeometry(0.1, 7, 6);
      clump.scale(s, s * 0.8, s);
      clump.translate(cx, cy, cz);
      leafyGeos.push(clump);
    }
    const leafyMesh = new THREE.Mesh(
      trackGeo(mergeGeometries(leafyGeos, false) ?? leafyGeos[0]),
      leafyMat,
    );
    leafyMesh.castShadow = true;
    leafy.add(leafyMesh);
    leafy.position.y = STAGE_BASE_Y;
    leafy.visible = false;
    plotOrigin.add(leafy);

    // --- Stage 3 bloom: squashed base + radial stems with marigold buds ---
    // ONE merged mesh, ONE material (petalMarigold). Generic — reads as any
    // current crop (marigold/chamomile/sage/lavender) at diorama distance.
    // No raw unmodified spheres: base squashed (1, 0.65, 1), buds (1, 0.85, 1).
    const bloom = new THREE.Group();
    const bloomGeos: THREE.BufferGeometry[] = [];
    {
      const base = new THREE.SphereGeometry(0.11, 7, 6);
      base.scale(1, 0.65, 1);
      base.translate(0, 0.06, 0);
      bloomGeos.push(base);

      const BUD_COUNT = 5;
      const STEM_HEIGHT = 0.14;
      const STEM_RADIAL = 0.07; // stem base offset from plot centre
      const TILT = 0.18; // outward tilt (radians); small-angle for clean bud placement
      for (let b = 0; b < BUD_COUNT; b++) {
        const ang = (b / BUD_COUNT) * Math.PI * 2;
        const sx = Math.cos(ang) * STEM_RADIAL;
        const sz = Math.sin(ang) * STEM_RADIAL;
        const stem = new THREE.CylinderGeometry(0.012, 0.012, STEM_HEIGHT, 5);
        // Tilt outward (away from plot centre): rotateZ for X-axis tilt,
        // rotateX for Z-axis tilt. Order matters; small angles keep it clean.
        stem.rotateZ(Math.cos(ang) * TILT);
        stem.rotateX(Math.sin(ang) * -TILT);
        stem.translate(sx, 0.06 + STEM_HEIGHT / 2, sz);
        bloomGeos.push(stem);

        // Bud at the (small-angle approximated) top of the tilted stem.
        const bud = new THREE.SphereGeometry(0.05, 6, 5);
        bud.scale(1, 0.85, 1);
        const topX = sx + Math.cos(ang) * TILT * STEM_HEIGHT * 0.5;
        const topZ = sz + Math.sin(ang) * -TILT * STEM_HEIGHT * 0.5;
        bud.translate(topX, 0.06 + STEM_HEIGHT, topZ);
        bloomGeos.push(bud);
      }
    }
    const bloomMesh = new THREE.Mesh(
      trackGeo(mergeGeometries(bloomGeos, false) ?? bloomGeos[0]),
      bloomMat,
    );
    bloomMesh.castShadow = true;
    bloom.add(bloomMesh);
    bloom.position.y = STAGE_BASE_Y;
    bloom.visible = false;
    plotOrigin.add(bloom);

    plotStages.push({ sprout, leafy, bloom });
    group.add(plotOrigin);
  }

  // ---------------------------------------------------------------------
  // 5. Contact shadow — one per bed, registered with the scene batch
  // ---------------------------------------------------------------------
  addStaticContactShadow(group, shadowTex, width + 0.2, depth + 0.2, 0.5, 0.018);

  // ---------------------------------------------------------------------
  // Reactive update — zero per-frame allocation, idle sway + stage visibility
  // ---------------------------------------------------------------------
  function update(plots: GreenhousePlotState[], season: SeasonType, elapsed: number): void {
    const isWinter = season === 'winter';
    for (let i = 0; i < plotCount; i++) {
      const plot = plots?.[i];
      const stages = plotStages[i];
      const soil = soilMeshes[i];

      const hasCrop = !!plot?.cropId;
      const rawStage = hasCrop ? (plot?.stage ?? 0) : 0;
      // Winter dormancy: hide every stage group regardless of plot state.
      const visibleStage = isWinter ? -1 : rawStage;

      // Visibility toggle — pure writes, no allocations.
      stages.sprout.visible = visibleStage === 1;
      stages.leafy.visible = visibleStage === 2;
      stages.bloom.visible = visibleStage === 3;

      // Gentle bloom sway (matches Sunbeam greenhouse interior rig).
      if (stages.bloom.visible) {
        stages.bloom.rotation.z = Math.sin(elapsed * 1.3 + i * 1.7) * 0.035;
        stages.bloom.rotation.x = Math.cos(elapsed * 1.1 + i) * 0.025;
      }

      // Soil material swap — watered plots read darker & richer.
      if (soil) {
        soil.material = plot?.wateredToday === true ? soilWetMat : soilDryMat;
      }
    }
  }

  function dispose(): void {
    group.removeFromParent();
    for (const g of ownedGeos) g.dispose();
    // Palette-shared materials (cedarMat, soilDry/Wet, foliage mats, bloomMat)
    // are scene-owned — intentionally left undisposed; MaterialPalette owns them.
  }

  return { group, update, dispose };
}
