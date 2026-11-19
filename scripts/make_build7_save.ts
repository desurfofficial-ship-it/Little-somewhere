/**
 * Milestone 3 Build 7 QA save generator: creates a WorldState v8 save parked at the
 * Hearth & Crumb Bakery door (or inside it, with Clara met) for headless QA.
 *
 * Usage: npx tsx scripts/make_build7_save.ts inside|door > /tmp/build7_save.json
 */
import { createFreshWorldState, serializeWorldState } from '../src/game/storage';
import { BAKERY_PORCH_EXIT_POS } from '../src/game/bakery';

const mode = process.argv[2] ?? 'door';

const world = createFreshWorldState();
world.day = 1; // Sunflower Sourdough day (bake → herb_loaf share)
world.minuteOfDay = 540; // 9:00 AM — the morning bake is fresh

// Ensure Clara is met so her dialogue topics can be exercised, and mark the
// kitchen invitation accepted so the daily check-in is selectable too.
world.residents.clara.met = true;
world.residents.clara.trust = 2;

if (mode === 'inside') {
  world.playerLocation = 'bakery_interior';
  world.playerPos = { x: 0, z: 1.5 };
  world.playerFacing = Math.PI;
  world.exteriorPlayerPos = { ...BAKERY_PORCH_EXIT_POS };
  world.exteriorPlayerFacing = Math.PI;
  world.sideFlags = { ...world.sideFlags, bakeryVisited: true };
} else {
  world.playerLocation = 'exterior';
  world.playerPos = { x: -12.4, z: -6.9 };
  world.playerFacing = Math.PI; // facing north toward the warm doorway
  world.exteriorPlayerPos = { x: -12.4, z: -6.9 };
  world.exteriorPlayerFacing = Math.PI;
}

console.log(serializeWorldState(world));
