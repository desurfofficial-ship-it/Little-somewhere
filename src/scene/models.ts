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
  /** Base height scale of bodyGroup — enables squash-&-stretch without losing proportions. */
  heightScale?: number;
}
