import * as THREE from 'three';
import { SeasonType } from '../../game/types';

/**
 * porchSeasonLife.ts — Pass 26: "Doorways of the Lane".
 *
 * The Willow Step Cottage porch has kept the seasons since R5 Pass 18; the
 * bakery and book nook porches (and every shared exterior dressing they
 * anchor) still read identically in every season. This module is the small
 * shared contract for those porch dressings: each builder constructs four
 * hidden, named season groups inside its existing footprint and attaches the
 * rig as `group.userData.porchSeasonLife`; the canvas applies the calendar
 * with `applyPorchSeason` once per outdoor frame — four scalar visibility
 * writes per porch, zero allocation, deterministic.
 *
 * BUILD 02 note: Copperwheel Cottage's porch IS wired (canvas `applyPorchSeason`
 * on the copperwheel porch group) — the earlier "intentionally NOT wired"
 * docstring contradicted the code and was corrected by BUILD 03 (audit A7).
 */

export interface PorchSeasonLife {
  /** Named `*_porch_spring` group — spring dressing, hidden by default. */
  spring: THREE.Group;
  summer: THREE.Group;
  autumn: THREE.Group;
  winter: THREE.Group;
}

/** Four hidden season groups with stable names, ready for the builder to fill. */
export function createPorchSeasonLife(prefix: string): PorchSeasonLife {
  const spring = new THREE.Group();
  spring.name = `${prefix}_porch_spring`;
  spring.visible = false;
  const summer = new THREE.Group();
  summer.name = `${prefix}_porch_summer`;
  summer.visible = false;
  const autumn = new THREE.Group();
  autumn.name = `${prefix}_porch_autumn`;
  autumn.visible = false;
  const winter = new THREE.Group();
  winter.name = `${prefix}_porch_winter`;
  winter.visible = false;
  return { spring, summer, autumn, winter };
}

/** Attach the season rig to a porch dressing group under the shared key. */
export function attachPorchSeasonLife(group: THREE.Group, life: PorchSeasonLife): void {
  group.add(life.spring, life.summer, life.autumn, life.winter);
  group.userData.porchSeasonLife = life;
}

/**
 * Calendar gate — exactly one season group visible at a time. Scalar visibility
 * writes only; pure with respect to everything else; same inputs → same state.
 */
export function applyPorchSeason(life: PorchSeasonLife, season: SeasonType): void {
  life.spring.visible = season === 'spring';
  life.summer.visible = season === 'summer';
  life.autumn.visible = season === 'autumn';
  life.winter.visible = season === 'winter';
}

/** Read the rig a builder attached, for canvas wiring and tests. */
export function readPorchSeasonLife(group: THREE.Group): PorchSeasonLife | undefined {
  return group.userData.porchSeasonLife as PorchSeasonLife | undefined;
}
