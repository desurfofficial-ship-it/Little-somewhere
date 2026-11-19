/**
 * Generates a valid WorldState v5 save JSON for deterministic headless QA of
 * Build 4 (10th resident + orchard micro-life): player parked at the orchard
 * gate on a breezy morning so butterflies, bees and sway hooks are all live,
 * and Rowan stands his morning schedule anchor in the south rows.
 * Run: npx tsx scripts/make_build4_save.ts > /tmp/build4_save.json
 */
import { createFreshWorldState, serializeWorldState } from '../src/game/storage';

const world = createFreshWorldState();
// Player stands just south of the orchard gate, facing the arch (north = -z)
world.playerPos = { x: -2.4, z: -12.6 };
world.playerFacing = Math.PI; // face north into the orchard
world.day = 2;
world.minuteOfDay = 540; // 9:00 AM — morning phase
world.weather = 'breezy'; // windStrength 1.0: max sway, butterflies + bees active
console.log(serializeWorldState(world));
