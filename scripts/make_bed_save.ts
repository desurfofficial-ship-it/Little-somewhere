/**
 * WorldState v6 save for headless QA of the bed-rest veil + morning interior:
 * player beside the quilt bed at dusk, kettle warm, decor placed.
 * Run: npx tsx scripts/make_bed_save.ts > /tmp/bed_save.json
 */
import { createFreshWorldState, serializeWorldState } from '../src/game/storage';

const world = createFreshWorldState();
world.playerLocation = 'cottage_interior';
world.exteriorPlayerPos = { x: -9.8, z: 10.0 };
world.playerPos = { x: -1.0, z: 0.4 };
world.playerFacing = Math.PI * 0.75;
world.day = 3;
world.minuteOfDay = 1145;
world.weather = 'breezy';
world.cottageState = {
  placedFlowerId: 'chamomile_blossom',
  displayedKeepsakeIds: ['pond_watercolor_card', 'cedar_music_box'],
  hearthLit: true,
  kettleWarmUntilMinute: 1240,
  almanacReadToday: false,
  cottageRestCount: 2,
};
console.log(serializeWorldState(world));
