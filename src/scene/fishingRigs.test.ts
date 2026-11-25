/**
 * Fishing bank rigs — structural placement contract (Stage 3 fishing v1.1).
 *
 * Test id → spec map:
 *   RIG-01 both rigs build with exactly 5 meshes (3 planks + creel + rod)
 *   RIG-02 jetty rig reproduces the v1 absolute coordinates byte-for-byte
 *          (visual regression lock on the extracted builder)
 *   RIG-03 brook rig lands on the culvert-mouth lawn: planks step east from
 *          x -5.10 to -4.00 at z 13.45, rod/creel clear of the rail band
 *   RIG-04 both rigs share the SAME two material instances (0 new programs)
 *   RIG-05 rig meshes never occupy a water/blocked walkability cell
 *          (bank props are stand-adjacent dressing, not obstacles)
 *   RIG-06 rig names follow the worldMap prop id + '_rig' convention and each
 *          placement matches a live PROP_INTERACTABLES row (anchor drift lock)
 *
 * Run: npm test (tsx --test src/game/*.test.ts src/scene/*.test.ts)
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import * as THREE from 'three';

import { buildFishingBankRig, FISHING_BANK_RIG_PLACEMENTS } from './fishingRigs';
import { PROP_INTERACTABLES, isPointWalkable } from '../game/worldMap';

const woodMat = new THREE.MeshStandardMaterial({ color: '#8A6844', roughness: 0.88 });
const wickerMat = new THREE.MeshStandardMaterial({ color: '#A8845A', roughness: 0.92 });

const jetty = buildFishingBankRig(FISHING_BANK_RIG_PLACEMENTS[0], woodMat, wickerMat);
const brook = buildFishingBankRig(FISHING_BANK_RIG_PLACEMENTS[1], woodMat, wickerMat);

function meshWorldPositions(rig: THREE.Group): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  rig.children.forEach((child) => {
    if (child instanceof THREE.Mesh) {
      out.push(child.position.clone());
    }
  });
  return out;
}

describe('fishing bank rigs (Stage 3 v1.1)', () => {
  it('RIG-01 both rigs build with exactly 5 meshes and the rig name convention', () => {
    for (const rig of [jetty, brook]) {
      const meshes = rig.children.filter((c) => c instanceof THREE.Mesh);
      assert.equal(meshes.length, 5, `${rig.name}: 3 planks + creel + rod`);
      assert.equal(rig.children.length, 5, `${rig.name}: no extra helpers`);
    }
    assert.equal(jetty.name, 'willow_jetty_rig');
    assert.equal(brook.name, 'west_brook_bank_rig');
  });

  it('RIG-02 jetty rig reproduces the v1 absolute coordinates byte-for-byte', () => {
    const pos = meshWorldPositions(jetty);
    // Planks (children 0..2): x -0.35, z 16.95 + i*0.55
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs(pos[i].x - -0.35) < 1e-9, `plank ${i} x pinned`);
      assert.ok(Math.abs(pos[i].z - (16.95 + i * 0.55)) < 1e-9, `plank ${i} z pinned`);
      assert.ok(Math.abs(pos[i].y - (0.1 + i * 0.004)) < 1e-9, `plank ${i} y pinned`);
    }
    // Creel (child 3)
    assert.ok(Math.abs(pos[3].x - -1.05) < 1e-9, 'creel x pinned');
    assert.ok(Math.abs(pos[3].z - 17.85) < 1e-9, 'creel z pinned');
    // Rod (child 4)
    assert.ok(Math.abs(pos[4].x - -0.62) < 1e-9, 'rod x pinned');
    assert.ok(Math.abs(pos[4].z - 17.75) < 1e-9, 'rod z pinned');
  });

  it('RIG-03 brook rig sits on the west bank clear of the bridge shadow', () => {
    const pos = meshWorldPositions(brook);
    // Planks at z 13.45 stepping WESTWARD from x -4.90 to -6.00 (rotY +PI/2):
    // the bank corner stays outside the bridge's rail band and its visual
    // shadow, so the rig reads from the default camera, the deck and the lawn.
    const plankXs = [0, 1, 2].map((i) => pos[i].x).sort((a, b) => a - b);
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs(plankXs[i] - (-6.0 + i * 0.55)) < 1e-9, `plank ${i} x = ${-6.0 + i * 0.55}`);
      assert.ok(Math.abs(pos[i].z - 13.45) < 1e-9, `plank ${i} z = 13.45`);
    }
    // Creel rests at (-5.10, 14.15); rod leans over the bank at (-5.20, 13.72).
    assert.ok(Math.abs(pos[3].x - -5.1) < 1e-9, 'creel x');
    assert.ok(Math.abs(pos[3].z - 14.15) < 1e-9, 'creel z');
    assert.ok(Math.abs(pos[4].x - -5.2) < 1e-9, 'rod x');
    assert.ok(Math.abs(pos[4].z - 13.72) < 1e-9, 'rod z');
    // Nothing crosses into the rail band (x -3.7..-3.58) or the water (x >= -3.58).
    for (const p of pos) {
      assert.ok(p.x < -3.7, `mesh at x ${p.x.toFixed(2)} stays west of the rail band`);
      assert.ok(p.x > -6.6, `mesh at x ${p.x.toFixed(2)} stays east of the hollow-oak canopy`);
    }
  });

  it('RIG-04 both rigs share the same two material instances', () => {
    const mats = new Set<string>();
    for (const rig of [jetty, brook]) {
      for (const child of rig.children) {
        if (child instanceof THREE.Mesh) {
          const m = child.material as THREE.MeshStandardMaterial;
          assert.ok(m === woodMat || m === wickerMat, 'only the two shared materials are used');
          mats.add(m.uuid);
        }
      }
    }
    assert.equal(mats.size, 2, 'exactly two shared materials across both rigs');
  });

  it('RIG-05 rig meshes never occupy a blocked walkability cell', () => {
    for (const rig of [jetty, brook]) {
      for (const p of meshWorldPositions(rig)) {
        assert.equal(
          isPointWalkable(p.x, p.z, 0.0),
          true,
          `${rig.name} mesh at (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) sits on walkable ground`,
        );
      }
    }
  });

  it('RIG-06 placements match live worldMap prop rows (anchor drift lock)', () => {
    assert.equal(FISHING_BANK_RIG_PLACEMENTS.length, 2, 'v1.1 ships exactly two bank rigs');
    for (const placement of FISHING_BANK_RIG_PLACEMENTS) {
      const propId = placement.name.replace(/_rig$/, '');
      const row = PROP_INTERACTABLES.find((p) => p.id === propId);
      assert.ok(row, `${propId} has a worldMap row`);
      assert.equal(row.x, placement.x, `${propId} anchor x matches the rig placement`);
      assert.equal(row.z, placement.z, `${propId} anchor z matches the rig placement`);
    }
  });
});
