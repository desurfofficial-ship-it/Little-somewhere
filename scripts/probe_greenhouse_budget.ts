/**
 * Phase A draw-call / triangle budget probe (audit §10.4).
 * Builds the rebuilt Sunbeam Greenhouse exterior + doorway + interior rig in node
 * (no GL needed for scene-graph stats) and reports mesh counts and triangles.
 */
import * as THREE from 'three';
import { MaterialPalette } from '../src/scene/materials';
import { buildStorybookGreenhouse } from '../src/scene/builders/buildings';
import { buildSunbeamGreenhouseDoorway, buildSunbeamGreenhouseInterior } from '../src/scene/builders/greenhouseInterior';

const palette = new MaterialPalette();
const dummyTex = new THREE.Texture();

const gh = buildStorybookGreenhouse({
  palette,
  shadowTex: dummyTex,
  terracottaRoofTex: dummyTex,
  sageRoofTex: dummyTex,
  slateRoofTex: dummyTex,
  windowMaterials: [],
  lanternMaterials: [],
  flowerGroups: [],
});

let meshes = 0;
let tris = 0;
gh.traverse((o) => {
  if (o instanceof THREE.Mesh) {
    meshes += 1;
    const g = o.geometry as THREE.BufferGeometry;
    const pos = g.getAttribute('position');
    tris += pos ? pos.count / 3 : 0;
  }
});
console.log(`greenhouse exterior: meshes=${meshes} tris=${Math.round(tris)}`);

const doorway = buildSunbeamGreenhouseDoorway(palette, dummyTex);
let dMeshes = 0;
doorway.traverse((o) => { if (o instanceof THREE.Mesh) dMeshes += 1; });
console.log(`doorway dressing: meshes=${dMeshes}`);

const interior = buildSunbeamGreenhouseInterior(palette, dummyTex, { isSoftwareGl: true });
let iMeshes = 0;
let iTris = 0;
interior.group.traverse((o) => {
  if (o instanceof THREE.Mesh) {
    iMeshes += 1;
    const pos = (o.geometry as THREE.BufferGeometry).getAttribute('position');
    iTris += pos ? pos.count / 3 : 0;
  }
});
console.log(`greenhouse interior: meshes=${iMeshes} tris=${Math.round(iTris)}`);

interior.dispose();
palette.disposeAll();
