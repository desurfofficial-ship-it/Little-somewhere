/**
 * Generates a valid WorldState v6 save JSON for deterministic headless QA of
 * the Willow Step Cottage interior build: player inside the cottage at dusk
 * with lavender in the table vase, three keepsakes displayed on the shelf,
 * and the hearth kettle still warm so steam puffs are live.
 * Run: npx tsx scripts/make_cottage_save.ts > /tmp/cottage_save.json
 */
import { createFreshWorldState, serializeWorldState } from '../src/game/storage';

const world = createFreshWorldState();
world.playerLocation = 'cottage_interior';
world.exteriorPlayerPos = { x: -9.8, z: 10.0 };
world.playerPos = { x: 0.4, z: -0.6 };
world.playerFacing = Math.PI * 0.35;
world.day = 3;
world.minuteOfDay = 1120; // dusk
world.weather = 'breezy';
world.cottageState = {
  placedFlowerId: 'lavender_sprig',
  displayedKeepsakeIds: ['willow_zine_copy', 'brass_pocket_bell', 'pond_watercolor_card'],
  hearthLit: true,
  kettleWarmUntilMinute: 1200,
  almanacReadToday: false,
  cottageRestCount: 2,
};
world.inventory = {
  ...world.inventory,
  lavender_sprig: 1,
  willow_zine_copy: 1,
  brass_pocket_bell: 1,
};
world.discoveredItemIds = [...world.discoveredItemIds, 'lavender_sprig', 'willow_zine_copy', 'brass_pocket_bell'];
console.log(serializeWorldState(world));
