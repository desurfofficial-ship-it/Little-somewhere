import * as THREE from 'three';
import { MaterialPalette } from '../../src/scene/materials';
import { buildWildHollows } from '../../src/scene/builders/wilds';
const palette = new MaterialPalette();
const rig = buildWildHollows(palette, new THREE.Texture(), true);
rig.group.updateMatrixWorld(true);
const tmp = new THREE.Box3();
for (const child of rig.group.children) {
  tmp.setFromObject(child);
  if (tmp.min.y < -0.05) {
    const c = tmp.getCenter(new THREE.Vector3());
    console.log('BELOW:', child.type, 'min.y', tmp.min.y.toFixed(3), 'center', c.x.toFixed(1), c.y.toFixed(1), c.z.toFixed(1));
  }
}
