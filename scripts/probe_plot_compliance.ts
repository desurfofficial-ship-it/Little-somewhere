/**
 * Phase B+C plot-compliance probe (per-mesh): finds SOLID 3D geometry (non-flat,
 * non-decal) that crosses a building's BOX_OBSTACLES plot, where the player could
 * clip through it. Flat contact-shadow planes (walk-over decals) and low threshold
 * steps (intentional walk-over ground) are excluded, matching the audit's §10.1 gate.
 */
import * as THREE from 'three';
import { MaterialPalette } from '../src/scene/materials';
import {
  buildStorybookBakery,
  buildStorybookBookNook,
  buildStorybookArthurWorkshop,
  buildStorybookBarnabyWoodshop,
  buildStorybookGreenhouse,
} from '../src/scene/builders/buildings';

const palette = new MaterialPalette();
const dummyTex = new THREE.Texture();
const ctx = {
  palette,
  shadowTex: dummyTex,
  terracottaRoofTex: dummyTex,
  sageRoofTex: dummyTex,
  slateRoofTex: dummyTex,
  windowMaterials: [],
  lanternMaterials: [],
  flowerGroups: [],
};

const plots: Record<string, { minX: number; maxX: number; minZ: number; maxZ: number }> = {
  bakery: { minX: -16.4, maxX: -8.4, minZ: -14.2, maxZ: -7.4 },
  book_nook: { minX: -19.2, maxX: -12.4, minZ: -4.2, maxZ: 2.2 },
  workshop_arthur: { minX: 9.4, maxX: 16.8, minZ: -14.8, maxZ: -8.2 },
  workshop_barnaby: { minX: 9.0, maxX: 15.8, minZ: 9.8, maxZ: 16.2 },
  greenhouse: { minX: 10.8, maxX: 17.8, minZ: -1.8, maxZ: 5.2 },
};

const builders: Array<[string, () => THREE.Group]> = [
  ['bakery', () => buildStorybookBakery(ctx)],
  ['book_nook', () => buildStorybookBookNook(ctx)],
  ['workshop_arthur', () => buildStorybookArthurWorkshop(ctx)],
  ['workshop_barnaby', () => buildStorybookBarnabyWoodshop(ctx)],
  ['greenhouse', () => buildStorybookGreenhouse(ctx)],
];

let violations = 0;
for (const [plotId, make] of builders) {
  const group = make();
  group.updateMatrixWorld(true);
  const plot = plots[plotId];
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const geo = obj.geometry as THREE.BufferGeometry;
    if (geo.type === 'PlaneGeometry') return; // contact-shadow decal
    const meshBox = new THREE.Box3().setFromObject(obj);
    const height = meshBox.max.y - meshBox.min.y;
    if (height < 0.12) return; // threshold step / ground deco
    const over: string[] = [];
    if (meshBox.min.x < plot.minX - 0.02) over.push(`minX ${meshBox.min.x.toFixed(2)}`);
    if (meshBox.max.x > plot.maxX + 0.02) over.push(`maxX ${meshBox.max.x.toFixed(2)}`);
    if (meshBox.min.z < plot.minZ - 0.02) over.push(`minZ ${meshBox.min.z.toFixed(2)}`);
    if (meshBox.max.z > plot.maxZ + 0.02) over.push(`maxZ ${meshBox.max.z.toFixed(2)}`);
    if (over.length) {
      violations++;
      const p = obj.position;
      console.log(`VIOLATION ${plotId}: ${geo.type} at local (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}) h=${height.toFixed(2)} -> ${over.join(', ')}`);
    }
  });
  console.log(`scanned ${plotId}`);
}
console.log(violations === 0 ? 'NO SOLID-PROP PLOT VIOLATIONS' : `${violations} solid-prop violations`);
palette.disposeAll();
