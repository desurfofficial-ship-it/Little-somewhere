/**
 * Milestone 3 Build 8 QA save generator: creates a WorldState v9 save parked at the
 * Linden Book Nook door (or inside it, with Nora met + the corner invited) for headless QA.
 *
 * Usage: npx tsx scripts/make_build8_save.ts inside|door > /tmp/build8_save.json
 */
import { createFreshWorldState, serializeWorldState } from '../src/game/storage';
import { NOOK_PORCH_EXIT_POS } from '../src/game/bookNook';

const mode = process.argv[2] ?? 'door';

const world = createFreshWorldState();
world.day = 1; // The Ivy Letters day
world.minuteOfDay = 540; // 9:00 AM — lamp-lit morning

world.residents.nora.met = true;
world.residents.nora.trust = 2;

if (mode === 'inside') {
  world.playerLocation = 'nook_interior';
  world.playerPos = { x: 1.5, z: 0.0 };
  world.playerFacing = -Math.PI / 2;
  world.exteriorPlayerPos = { ...NOOK_PORCH_EXIT_POS };
  world.exteriorPlayerFacing = Math.PI * 0.5;
  world.sideFlags = { ...world.sideFlags, nookVisited: true };
} else {
  world.playerLocation = 'exterior';
  world.playerPos = { x: -11.8, z: -1.0 };
  world.playerFacing = -Math.PI / 2; // facing west toward the sage door
  world.exteriorPlayerPos = { x: -11.8, z: -1.0 };
  world.exteriorPlayerFacing = -Math.PI / 2;
}

console.log(serializeWorldState(world));
