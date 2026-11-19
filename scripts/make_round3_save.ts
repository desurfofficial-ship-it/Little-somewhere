/**
 * Generates a valid WorldState v6 save for Round-3 everyday-life polish QA:
 * player inside the cottage at dusk in LIGHT RAIN, autumn, hearth lit with a
 * brewed tea in the satchel so the full sit & sip ritual is exercisable.
 * Run: npx tsx scripts/make_round3_save.ts > /tmp/round3_save.json
 */
import { createFreshWorldState, serializeWorldState } from '../src/game/storage';

const world = createFreshWorldState();
world.playerLocation = 'cottage_interior';
world.exteriorPlayerPos = { x: -9.8, z: 10.0 };
world.playerPos = { x: 0.4, z: -0.6 };
world.playerFacing = Math.PI * 0.35;
world.day = 6;
world.minuteOfDay = 1120; // dusk
world.weather = 'light_rain';
world.season = 'autumn';
world.cottageState = {
  placedFlowerId: 'chamomile_blossom',
  displayedKeepsakeIds: ['brass_pocket_bell', 'woven_herb_wreath'],
  hearthLit: true,
  kettleWarmUntilMinute: 1200,
  almanacReadToday: false,
  cottageRestCount: 2,
};
world.inventory = {
  ...world.inventory,
  chamomile_pear_tea: 1,
  crabapple: 3,
};
world.discoveredItemIds = [...world.discoveredItemIds, 'chamomile_pear_tea', 'crabapple'];
console.log(serializeWorldState(world));
