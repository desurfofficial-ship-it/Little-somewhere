import * as THREE from 'three';

/**
 * models.ts — shared Three.js rig type contracts.
 *
 * R-06 hygiene note (2026-11-19): the deprecated "boxy template era" builders
 * (`buildClayCottage`, `buildGreenhouse`, `buildStoneFountain` and their
 * `CottageOptions`/`makeMat` helpers, ~370 lines of dead code reachable only from
 * a legacy equivalence test) were removed per the comprehensive visual audit
 * (docs/audits/09-comprehensive-asset-visual-audit.md, item R-06). All production
 * assets are built by the `src/scene/builders/*` and `src/scene/prototypes/*`
 * storybook factories; this module now only declares the rig interfaces those
 * factories return and the environment renderer consumes.
 */

export interface GazeboRig {
  group: THREE.Group;
  bellPivot: THREE.Group;
  bellMesh: THREE.Mesh;
  clapperMesh: THREE.Mesh;
  ivyGroup: THREE.Group;
  ribbonMesh: THREE.Mesh;
}

export interface FountainRig {
  group: THREE.Group;
  waterMesh: THREE.Mesh;
  spoutParticles: THREE.Group;
  clogDebrisGroup?: THREE.Group;
  submergedCoinsGroup?: THREE.Group;
  cascadeGroup?: THREE.Group;
  splashRings?: THREE.Mesh[];
  waterMat?: THREE.MeshStandardMaterial;
  streamMat?: THREE.MeshStandardMaterial;
}

export interface KoiFishRig {
  group: THREE.Group;
  tailPivot: THREE.Group;
  centerX: number;
  centerZ: number;
  radiusX: number;
  radiusZ: number;
  speed: number;
  phaseOffset: number;
}

export interface MirrorPondRig {
  group: THREE.Group;
  waterMesh: THREE.Mesh;
  waterMat: THREE.MeshStandardMaterial;
  koiFishes: KoiFishRig[];
  lilyPadGroups: THREE.Group[];
  lilyBlooms: THREE.Mesh[];
  reedStalks: THREE.Group[];
  dragonflies: THREE.Group[];
  sailboat: THREE.Group;
}

export interface CharacterRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  torsoPivot?: THREE.Group;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  headGroup: THREE.Group;
  leftEyelid?: THREE.Mesh;
  rightEyelid?: THREE.Mesh;
  leftBrow?: THREE.Mesh;
  rightBrow?: THREE.Mesh;
  carrySocket?: THREE.Group;
  ringMesh: THREE.Mesh;
  questPip: THREE.Mesh;
  /** Player-only: knit-scarf tail pivot at the collar front — gets speed/wind sway. */
  scarfPivot?: THREE.Group;
  /** Player-only: the traveller satchel group (strap + hip pouch) for adorning/detail passes. */
  satchelGroup?: THREE.Group;
  /** Universal (Pass 20): emotion-driven smile arc under the nose — every character reads mood. */
  mouthSmile?: THREE.Mesh;
  /** Universal (Pass 20): small "o" ring shown for the surprised emotion. */
  mouthO?: THREE.Mesh;
  /**
   * Build 01 (Doc 04 §4): hand-anchored attach point on the right mitten — props
   * with a visible grip narrative parent here so carried items ride the hand.
   */
  handAnchor?: THREE.Group;
  /**
   * Build 01 (Doc 04 §4.4): carry pose variant — 'cradle' (two-arm tray, the
   * historical pose) or 'side' (one bent arm; book/sketchbook carriers). Set at
   * build time from the signature prop; the driver picks the pose when carrying.
   */
  carryPose?: 'cradle' | 'side';
  /**
   * Build 01 (Doc 04 §3): baked posture lean (radians, torso pitch). Applied by
   * animateCharacterRig every frame before damping — archetype massing's "welcoming
   * lean forward" without fighting the animation driver.
   */
  postureLeanX?: number;
  /** NPC hanging-cloth accessory pivot (shawl/scarf tail) — sways with stride & rest breath. */
  swayTail?: THREE.Group;
  /** Base height scale of bodyGroup — enables squash-&-stretch without losing proportions. */
  heightScale?: number;
  /**
   * Winter knit system: per-rig CLONED knitwear materials (coat + scarf/shawl +
   * winter collar) so the season tint can shift colors without mutating the shared
   * palette cache. Base colors live in `knitBaseColors` (same order).
   */
  knitMaterials?: THREE.MeshStandardMaterial[];
  /** Authoring colors for `knitMaterials`, restored outside winter. */
  knitBaseColors?: string[];
  /** Hand-knit neck warmer shown only during winter (tinted from the coat color). */
  winterKnitCollar?: THREE.Group;
}
