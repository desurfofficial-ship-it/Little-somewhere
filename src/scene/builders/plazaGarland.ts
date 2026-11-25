// src/scene/builders/plazaGarland.ts
// Stage 2: Plaza Garlands progressive visual rig.
// Extracted from NeighborhoodCanvas.tsx for testability (H1/H2 Gate 2 closure).
// 3 prebuilt sub-groups (twine / partial blooms / full garland) toggled by
// setGarlandStage — follows the WildsRig.setGardenStage pattern exactly.
import * as THREE from 'three';
import type { MaterialPalette } from '../materials';

export interface PlazaGarlandRig {
  readonly group: THREE.Group;
  setGarlandStage(stage: number): void;
}

export function buildPlazaGarlandRig(palette: MaterialPalette): PlazaGarlandRig {
  const garlandSageMat = palette.standard('#5E8062', 0.82, 0.0);
  const garlandMarigoldMat = palette.standard('#E5A93C', 0.5, 0.0);
  const garlandChamomileMat = palette.standard('#F0E6C8', 0.6, 0.0);
  const garlandLavenderMat = palette.standard('#9B7FB8', 0.55, 0.0);
  const garlandY = 3.15;
  const garlandZ = -5.2;
  const group = new THREE.Group();
  group.name = 'plazaGarlandRig';
  const garlandTwine = new THREE.Group();
  garlandTwine.name = 'garlandTwine';
  const garlandPartial = new THREE.Group();
  garlandPartial.name = 'garlandPartial';
  const garlandFull = new THREE.Group();
  garlandFull.name = 'garlandFull';
  for (let i = 0; i < 12; i++) {
    const t = i / 11;
    const fx = THREE.MathUtils.lerp(-5.8, 5.8, t);
    const sag = Math.sin(t * Math.PI) * 0.35;
    const seg = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4, 3), garlandSageMat);
    seg.position.set(fx, garlandY - sag, garlandZ);
    garlandTwine.add(seg);
  }
  for (let i = 0; i < 3; i++) {
    const t = (i + 1) / 4;
    const fx = THREE.MathUtils.lerp(-5.8, 5.8, t);
    const sag = Math.sin(t * Math.PI) * 0.35;
    const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), garlandMarigoldMat);
    bloom.position.set(fx, garlandY - sag + 0.07, garlandZ);
    garlandPartial.add(bloom);
  }
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const fx = THREE.MathUtils.lerp(-5.8, 5.8, t);
    const sag = Math.sin(t * Math.PI) * 0.35;
    const bloomMat = i % 3 === 0 ? garlandMarigoldMat : i % 3 === 1 ? garlandChamomileMat : garlandLavenderMat;
    const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), bloomMat);
    bloom.position.set(fx, garlandY - sag + 0.09, garlandZ);
    garlandFull.add(bloom);
  }
  garlandTwine.visible = false;
  garlandPartial.visible = false;
  garlandFull.visible = false;
  group.add(garlandTwine, garlandPartial, garlandFull);
  return {
    group,
    setGarlandStage(stage: number): void {
      garlandTwine.visible = stage >= 1;
      garlandPartial.visible = stage >= 2;
      garlandFull.visible = stage >= 3;
    },
  };
}
