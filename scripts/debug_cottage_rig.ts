/**
 * Debug dump: builds the cottage interior rig, applies the dusk save world,
 * and prints every keepsake/flower/proxy's world position, visibility and
 * world-space bounding box to locate missing/occluded props.
 * Run: npx tsx scripts/debug_cottage_rig.ts
 */
import * as THREE from 'three';
import { MaterialPalette } from '../src/scene/materials';
import { buildWillowCottageInterior } from '../src/scene/builders/cottageInterior';
import { createFreshWorldState } from '../src/game/storage';

const palette = new MaterialPalette();
const rig = buildWillowCottageInterior(palette, new THREE.Texture());

const world = createFreshWorldState();
world.minuteOfDay = 1120;
world.cottageState = {
  placedFlowerId: 'lavender_sprig',
  displayedKeepsakeIds: ['willow_zine_copy', 'brass_pocket_bell', 'pond_watercolor_card'],
  hearthLit: true,
  kettleWarmUntilMinute: 1200,
  almanacReadToday: false,
  cottageRestCount: 2,
};
rig.update(world, 'dusk', 2.5);

rig.group.updateMatrixWorld(true);
const dump = (name: string, obj: THREE.Object3D): void => {
  const box = new THREE.Box3().setFromObject(obj);
  const wp = new THREE.Vector3();
  obj.getWorldPosition(wp);
  console.log(
    `${name.padEnd(26)} visible=${String(obj.visible).padEnd(5)} world=(${wp.x.toFixed(2)}, ${wp.y.toFixed(2)}, ${wp.z.toFixed(2)}) box=[${box.min.x.toFixed(2)},${box.min.y.toFixed(2)},${box.min.z.toFixed(2)} .. ${box.max.x.toFixed(2)},${box.max.y.toFixed(2)},${box.max.z.toFixed(2)}]`,
  );
};

for (const id of Object.keys(rig.shelfKeepsakeMeshes)) {
  dump(`keepsake:${id}`, rig.shelfKeepsakeMeshes[id]);
}
for (const id of Object.keys(rig.vaseFlowers) as Array<keyof typeof rig.vaseFlowers>) {
  dump(`flower:${id}`, rig.vaseFlowers[id]);
}
dump('vaseEmptyGroup', rig.vaseEmptyGroup);
console.log('steam puffs visible:', rig.kettleSteamPuffs.map((p) => p.visible).join(','));
console.log('lamp emissiveIntensity:', rig.almanacLampMat.emissiveIntensity.toFixed(3));

const sceneBox = new THREE.Box3().setFromObject(rig.group);
console.log('group bounds:', JSON.stringify(sceneBox.min), JSON.stringify(sceneBox.max));

rig.dispose();
palette.disposeAll();
