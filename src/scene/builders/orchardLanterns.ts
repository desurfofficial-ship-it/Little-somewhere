// src/scene/builders/orchardLanterns.ts
// Stage 2: Orchard Lanterns progressive visual rig.
// Extracted from NeighborhoodCanvas.tsx for testability (H1/H2 Gate 2 closure).
// 3 prebuilt sub-groups (shells / partial glow / full glow) toggled by
// setLanternStage — follows the PlazaGarlandRig.setGarlandStage pattern exactly.
// Lanterns hang from west-side orchard trees (x: -9 to -3.6, z: -16 to -17.5),
// deliberately away from the tasting table so they read as story lanterns.
import * as THREE from 'three';
import type { MaterialPalette } from '../materials';

export interface OrchardLanternsRig {
  readonly group: THREE.Group;
  setLanternStage(stage: number): void;
}

// 5 lantern anchor points across the west orchard row. y sits at the lower
// canopy where branches would carry a hook cord; each lantern drops ~0.4m.
const LANTERN_ANCHORS: ReadonlyArray<{ x: number; y: number; z: number }> = [
  { x: -9.0, y: 2.4, z: -16.0 },
  { x: -7.4, y: 2.35, z: -16.4 },
  { x: -6.3, y: 2.45, z: -16.9 },
  { x: -5.1, y: 2.3, z: -17.2 },
  { x: -3.6, y: 2.4, z: -17.5 },
];

export function buildOrchardLanternsRig(palette: MaterialPalette): OrchardLanternsRig {
  // Dark iron shells — unlit at stage 1. Slightly rough so the metal reads
  // as forged rather than polished, settling the lantern into tree shadow.
  const lanternShellMat = palette.standard('#3E3B39', 0.65, 0.6);
  // Lit marigold bulb — emissive #E5A93C, intensity 1.6 (warm story glow).
  const lanternGlowMat = palette.get('orchard-lantern-glow', {
    color: '#E5A93C',
    roughness: 0.45,
    metalness: 0.0,
    emissive: '#E5A93C',
    emissiveIntensity: 1.6,
  });

  const group = new THREE.Group();
  group.name = 'orchardLanternsRig';

  // Stage 1 — dark iron shells (hook cord + cap + bulb), unlit.
  const lanternShells = new THREE.Group();
  lanternShells.name = 'lanternShells';
  // Stage 2 — first 3 lanterns lit (marigold glow bulbs overlaying shells).
  const lanternPartialGlow = new THREE.Group();
  lanternPartialGlow.name = 'lanternPartialGlow';
  // Stage 3 — all 5 lanterns lit.
  const lanternFullGlow = new THREE.Group();
  lanternFullGlow.name = 'lanternFullGlow';

  for (let i = 0; i < LANTERN_ANCHORS.length; i++) {
    const a = LANTERN_ANCHORS[i];
    // Hook cord: thin vertical cylinder from anchor down to the cap.
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6),
      lanternShellMat,
    );
    cord.position.set(a.x, a.y - 0.21, a.z);
    lanternShells.add(cord);
    // Cap: small downward cone capping the lantern top.
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.12, 8),
      lanternShellMat,
    );
    cap.position.set(a.x, a.y - 0.42, a.z);
    cap.rotation.x = Math.PI; // point downward over the bulb
    lanternShells.add(cap);
    // Bulb shell (dark, unlit) — sits under the cap.
    const bulbShell = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 10, 8),
      lanternShellMat,
    );
    bulbShell.position.set(a.x, a.y - 0.55, a.z);
    lanternShells.add(bulbShell);

    // Lit glow bulb overlay — same sphere geometry, emissive marigold.
    const glowBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.078, 10, 8),
      lanternGlowMat,
    );
    glowBulb.position.set(a.x, a.y - 0.55, a.z);
    // First 3 lanterns light at stage 2; all 5 light at stage 3.
    if (i < 3) {
      lanternPartialGlow.add(glowBulb);
    } else {
      lanternFullGlow.add(glowBulb);
    }
  }

  // Mesh budget check: shells = 5 lanterns × 3 meshes = 15 (≤15 ✓).
  // Partial glow = 3 meshes, full glow = 2 meshes (both ≤15 ✓).
  lanternShells.visible = false;
  lanternPartialGlow.visible = false;
  lanternFullGlow.visible = false;
  group.add(lanternShells, lanternPartialGlow, lanternFullGlow);

  return {
    group,
    setLanternStage(stage: number): void {
      lanternShells.visible = stage >= 1;
      lanternPartialGlow.visible = stage >= 2;
      lanternFullGlow.visible = stage >= 3;
    },
  };
}
