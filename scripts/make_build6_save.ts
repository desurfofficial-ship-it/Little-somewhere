/**
 * Milestone 3 Build 6 QA save generator: creates a WorldState v7 save parked at the
 * Sunbeam Greenhouse door (or inside it, with seeds in the satchel) for headless QA.
 *
 * Usage: npx tsx scripts/make_build6_save.ts inside|door > /tmp/build6_save.json
 */
import { createFreshWorldState, serializeWorldState } from '../src/game/storage';
import { GREENHOUSE_PORCH_EXIT_POS } from '../src/game/greenhouse';

const mode = process.argv[2] ?? 'door';

const world = createFreshWorldState();
world.day = 3;
world.minuteOfDay = 900; // 3:00 PM afternoon

// Ensure Mina is met so her dialogue can be exercised, and give a friendly affinity bump
world.residents.mina.met = true;
world.residents.mina.trust = 2;

if (mode === 'inside') {
  world.playerLocation = 'greenhouse_interior';
  world.playerPos = { x: 2.3, z: -0.4 };
  world.playerFacing = -Math.PI / 2;
  world.exteriorPlayerPos = { ...GREENHOUSE_PORCH_EXIT_POS };
  world.exteriorPlayerFacing = Math.PI * 0.5;
  world.inventory.chamomile_seeds = 2;
  world.inventory.lavender_seeds = 1;
  world.discoveredItemIds = [...(world.discoveredItemIds ?? []), 'chamomile_seeds', 'lavender_seeds'];
} else {
  world.playerLocation = 'exterior';
  world.playerPos = { x: 9.35, z: 3.2 };
  world.playerFacing = Math.PI * 0.5;
  world.exteriorPlayerPos = { x: 9.35, z: 3.2 };
  world.exteriorPlayerFacing = Math.PI * 0.5;
  world.inventory.chamomile_seeds = 2;
  world.discoveredItemIds = [...(world.discoveredItemIds ?? []), 'chamomile_seeds'];
}

console.log(serializeWorldState(world));
