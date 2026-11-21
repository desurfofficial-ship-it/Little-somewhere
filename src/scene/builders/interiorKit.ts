import * as THREE from 'three';
import { MaterialPalette } from '../materials';

/**
 * interiorKit.ts — BUILD 02 (Doc 05 §4.2.3): the interior recipe kit.
 *
 * The five cutaway interiors each hand-inlined their copper kettles, so the
 * same four-part recipe existed in three slightly drifted copies. This module
 * is the parameterized home for that recipe: ONE builder, per-room identity
 * through explicit opts (never hidden globals). The lid is LATHE-CROWNED for
 * every room (Doc 05 §4.2.2 "kettle lids lathe-crowned") — the curved-surface
 * program rides the kit for free.
 *
 * Deliberate scope (brief §13: abstraction only where it reduces complexity):
 * the teacups stay per-room (cottage's cup is reactive/state-bound, the nook's
 * pairs with the honey pot, Copperwheel's answers its own glaze palette), and
 * doors keep their per-room panel motifs — those motifs ARE the story whisper,
 * and centralizing them would distribute identity away. The steam-puff pools
 * are already minimal shared-geometry loops; wrapping them in a kit would add
 * indirection without removing duplication.
 */

export type CopperKettleStyle = 'hearth-sphere' | 'petite' | 'stove-cylinder';

export interface CopperKettleOpts {
  /** Per-room massing (Doc 05 §4.2.3 identity deltas). */
  style: CopperKettleStyle;
  /** Copperwheel's stove kettle carries the emissive glow knob (existing behavior). */
  glowKnob?: boolean;
  /** The glow knob's material — Copperwheel passes its tracked animated material. */
  glowKnobMat?: THREE.MeshStandardMaterial;
  /** Spout side: +1 = +x (default), −1 = −x (Copperwheel's stove corner). */
  spoutSide?: 1 | -1;
  /** Material overrides (defaults: shared copper + brass). */
  bodyMat?: THREE.MeshStandardMaterial;
  trimMat?: THREE.MeshStandardMaterial;
}

export interface CopperKettleRig {
  group: THREE.Group;
  /** Named parts so identity tests can keep asserting (additive names). */
  body: THREE.Mesh;
  lid: THREE.Mesh;
  spout: THREE.Mesh;
  handle: THREE.Mesh;
  glowKnob?: THREE.Mesh;
}

/**
 * The shared copper kettle: lathe-crowned lid, squashed-sphere or cylinder
 * body per room, tapered spout, iron bail handle. Returns a group pivoted at
 * the body's center so callers position it exactly where the old inline
 * meshes sat (same footprint, same mesh count ±0).
 */
export function buildCopperKettle(
  palette: MaterialPalette,
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T,
  opts: CopperKettleOpts,
): CopperKettleRig {
  const group = new THREE.Group();
  const bodyMat = opts.bodyMat ?? palette.standard('#C56B45', 0.28, 0.78);
  const trimMat = opts.trimMat ?? palette.standard('#D7A041', 0.25, 0.86, { envMapIntensity: 1.0 });

  let body: THREE.Mesh;
  let bodyTopY: number;
  let bodyTopR: number;
  let spoutTilt: number;

  if (opts.style === 'hearth-sphere') {
    // Cottage hearth: squashed sphere kettle, r 0.17 (the original recipe).
    body = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.17, 12, 10)), bodyMat);
    body.scale.set(1.0, 0.82, 1.0);
    bodyTopY = 0.14;
    bodyTopR = 0.09;
    spoutTilt = -0.8;
  } else if (opts.style === 'petite') {
    // Nook console: petite sphere kettle, r 0.13.
    body = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.13, 9, 7)), bodyMat);
    bodyTopY = 0.12;
    bodyTopR = 0.06;
    spoutTilt = -0.8;
  } else {
    // Copperwheel stove: cylinder-body kettle r 0.16→0.19, h 0.24.
    body = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.16, 0.19, 0.24, 12)), bodyMat);
    bodyTopY = 0.16;
    bodyTopR = 0.14;
    spoutTilt = -0.75;
  }
  body.castShadow = true;
  body.name = 'kettle_body';
  group.add(body);

  // Lathe-crowned lid (Doc 05 §4.2.2): a soft dome profile replaces the flat
  // cylinder slab — the smoothest catchlight on the pot (T4 glaze read).
  const lidProfile = [
    new THREE.Vector2(0.0, bodyTopY + 0.055),
    new THREE.Vector2(bodyTopR * 0.45, bodyTopY + 0.045),
    new THREE.Vector2(bodyTopR * 0.8, bodyTopY + 0.02),
    new THREE.Vector2(bodyTopR, bodyTopY - 0.008),
    new THREE.Vector2(bodyTopR + 0.02, bodyTopY - 0.02),
  ];
  const lid = new THREE.Mesh(trackGeo(new THREE.LatheGeometry(lidProfile, 10)), opts.glowKnob ? bodyMat : trimMat);
  lid.name = 'kettle_lid';
  group.add(lid);

  const spout = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.02, 0.032, 0.17, 7)), bodyMat);
  spout.name = 'kettle_spout';
  const side = opts.spoutSide ?? 1;
  spout.position.set(side * (bodyTopR + 0.09), bodyTopY + 0.02, 0);
  spout.rotation.z = -side * 0.8;
  group.add(spout);

  const handle = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(bodyTopR + 0.05, 0.015, 6, 12, Math.PI)), palette.standard('#3E3C3E', 0.45, 0.65));
  handle.name = 'kettle_handle';
  handle.position.y = bodyTopY - 0.02;
  group.add(handle);

  if (opts.glowKnob) {
    // Copperwheel's kettle knob glows when the stove is warm — its tracked
    // material is animated by the rig's update() (phase curves).
    const knob = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.035, 8, 6)),
      opts.glowKnobMat ??
      palette.get('kit_glow_knob', {
        color: '#E8843C',
        roughness: 0.5,
        metalness: 0.0,
        emissive: '#FF9A3C',
        emissiveIntensity: 0.6,
      }),
    );
    knob.name = 'kettle_glow_knob';
    knob.position.y = bodyTopY + 0.075;
    group.add(knob);
    return { group, body, lid, spout, handle, glowKnob: knob };
  }

  return { group, body, lid, spout, handle };
}
