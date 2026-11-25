import * as THREE from 'three';
import { buildMirrorPondAndBridge } from '../src/scene/builders/vegetation';
import { MaterialPalette } from '../src/scene/materials';
const palette = new MaterialPalette();
const dummyTex = new THREE.Texture();
const rig = buildMirrorPondAndBridge(palette, dummyTex);
rig.group.updateMatrixWorld(true);
// find bridge group
const bridge = rig.group.children.find((c) => c.name === '' && c.position.x === -2.9) 
  ?? rig.group.children.filter((c) => (c as THREE.Group).isGroup).pop()!;
console.log('bridge children:', bridge.children.map((c) => c.name || c.type));
for (const obj of bridge.children) {
  const box = new THREE.Box3().setFromObject(obj);
  const centerX = (box.min.x + box.max.x) * 0.5;
  console.log(`${obj.name || obj.type}: x ${box.min.x.toFixed(3)}..${box.max.x.toFixed(3)} y ${box.min.y.toFixed(3)}..${box.max.y.toFixed(3)} centerX ${centerX.toFixed(4)} west?${centerX < -2.9 && box.max.y > 0.7} east?${centerX > -2.9 && box.min.x > -2.5 && box.max.y > 0.7}`);
}
