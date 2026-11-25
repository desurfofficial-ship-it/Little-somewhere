// src/scene/builders/pondMosaic.ts
// Stage 2: Pond Mosaic progressive visual rig.
// Extracted from NeighborhoodCanvas.tsx for testability (H1/H2 Gate 2 closure).
// 3 prebuilt sub-groups (river-glass tesserae / fern tiles / feather + cedar rose)
// toggled by setMosaicStage — follows the PlazaGarlandRig.setGarlandStage pattern
// exactly. Tesserae sit PROUD of the limestone shore step beside Mirror Pond
// (pier step top at world y=0.16) so each tile has real thickness and never
// fights the step for the same z-plane.
import * as THREE from 'three';
import type { MaterialPalette } from '../materials';

export interface PondMosaicRig {
  readonly group: THREE.Group;
  setMosaicStage(stage: number): void;
}

export function buildPondMosaicRig(palette: MaterialPalette): PondMosaicRig {
  // Mirror Pond pier shore step — pierGroup at (0.62, 0, 1.84) + step at (0, 0.08, 0.44)
  // → step world center (0.62, 0.08, 2.28); BoxGeometry 1.36×0.16×0.46 means the
  // top surface lives at y=0.16. Every tessera below sits at y≥0.170 with real
  // thickness so it reads as a laid-on mosaic, not a coplanar decal.
  const mosaicX = 0.62;
  const mosaicZ = 2.28;

  const riverGlassMat = palette.standard('#BFE3EF', 0.22, 0.0);
  const fernTileMat = palette.standard('#5E8062', 0.82, 0.0);
  const featherCurveMat = palette.standard('#E8E0D0', 0.6, 0.0);
  const cedarRoseMat = palette.standard('#C86446', 0.6, 0.0);

  const group = new THREE.Group();
  group.name = 'pondMosaicRig';

  const mosaicFirst = new THREE.Group();
  mosaicFirst.name = 'mosaicFirst';
  const mosaicPartial = new THREE.Group();
  mosaicPartial.name = 'mosaicPartial';
  const mosaicFull = new THREE.Group();
  mosaicFull.name = 'mosaicFull';

  // Stage 1 — three river-glass tesserae laid along the step's long axis.
  // BoxGeometry 0.14 × 0.03 × 0.14, y=0.175 (sits 0.015 proud of the step top).
  const glassSpots: Array<[number, number]> = [
    [mosaicX - 0.12, mosaicZ - 0.08],
    [mosaicX + 0.04, mosaicZ + 0.02],
    [mosaicX - 0.08, mosaicZ + 0.10],
  ];
  for (const [gx, gz] of glassSpots) {
    const tessera = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.14), riverGlassMat);
    tessera.position.set(gx, 0.175, gz);
    tessera.rotation.y = Math.PI * 0.13;
    mosaicFirst.add(tessera);
  }

  // Stage 2 — three fern tiles, lower and slightly wider, slipped between the glass.
  // BoxGeometry 0.16 × 0.022 × 0.12, y=0.171 (0.011 proud of step top).
  const fernSpots: Array<[number, number]> = [
    [mosaicX + 0.12, mosaicZ - 0.10],
    [mosaicX - 0.04, mosaicZ + 0.00],
    [mosaicX + 0.08, mosaicZ + 0.12],
  ];
  for (const [fx, fz] of fernSpots) {
    const tile = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.022, 0.12), fernTileMat);
    tile.position.set(fx, 0.171, fz);
    tile.rotation.y = Math.PI * 0.22;
    mosaicPartial.add(tile);
  }

  // Stage 3 — two feather curves and two cedar rose clusters crowning the mosaic.
  // Feather curves: BoxGeometry 0.22 × 0.02 × 0.07, y=0.170.
  // Cedar rose clusters: IcosahedronGeometry 0.08 with scale.y=0.45 (squashed
  // into a rosette), y=0.178 — the highest tessera, reading as a laid bloom.
  const featherSpots: Array<[number, number, number]> = [
    [mosaicX - 0.14, 0.170, mosaicZ + 0.02],
    [mosaicX + 0.16, 0.170, mosaicZ - 0.03],
  ];
  for (const [fx, fy, fz] of featherSpots) {
    const curve = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.07), featherCurveMat);
    curve.position.set(fx, fy, fz);
    curve.rotation.y = Math.PI * 0.08;
    mosaicFull.add(curve);
  }

  const roseSpots: Array<[number, number]> = [
    [mosaicX, mosaicZ - 0.10],
    [mosaicX, mosaicZ + 0.14],
  ];
  for (const [rx, rz] of roseSpots) {
    const rose = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), cedarRoseMat);
    rose.position.set(rx, 0.178, rz);
    rose.scale.y = 0.45;
    rose.rotation.y = Math.PI * 0.31;
    mosaicFull.add(rose);
  }

  mosaicFirst.visible = false;
  mosaicPartial.visible = false;
  mosaicFull.visible = false;
  group.add(mosaicFirst, mosaicPartial, mosaicFull);
  return {
    group,
    setMosaicStage(stage: number): void {
      mosaicFirst.visible = stage >= 1;
      mosaicPartial.visible = stage >= 2;
      mosaicFull.visible = stage >= 3;
    },
  };
}
