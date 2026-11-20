/**
 * Milestone 3 Build 9 QA save generator: creates a WorldState v10 save parked at the
 * Copperwheel Cottage south door (or inside it, with Arthur met + the workshop invited)
 * for headless QA.
 *
 * Usage: npx tsx scripts/make_build9_save.ts inside|door > /tmp/build9_save.json
 */
import { createFreshWorldState, serializeWorldState } from '../src/game/storage';
import { COPPERWHEEL_PORCH_EXIT_POS } from '../src/game/copperwheel';

const mode = process.argv[2] ?? 'door';

const world = createFreshWorldState();
world.day = 1; // The Orchard Pendulum day
world.minuteOfDay = 540; // 9:00 AM — lamp-lit morning

world.residents.arthur.met = true;
world.residents.arthur.trust = 2;

if (mode === 'inside') {
  world.playerLocation = 'copperwheel_interior';
  world.playerPos = { x: 1.0, z: 1.75 };
  world.playerFacing = Math.PI;
  world.exteriorPlayerPos = { ...COPPERWHEEL_PORCH_EXIT_POS };
  world.exteriorPlayerFacing = Math.PI;
  world.sideFlags = { ...world.sideFlags, copperwheelVisited: true };
} else {
  world.playerLocation = 'exterior';
  world.playerPos = { x: 12.5, z: -7.4 };
  world.playerFacing = Math.PI * 0.5; // facing south toward the workshop door
  world.exteriorPlayerPos = { x: 12.5, z: -7.4 };
  world.exteriorPlayerFacing = Math.PI * 0.5;
}

console.log(serializeWorldState(world));
