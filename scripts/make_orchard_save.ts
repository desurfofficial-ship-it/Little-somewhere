/**
 * Generates a valid WorldState v3 save JSON with the player placed at the
 * Fern Hollow Orchard gate, for deterministic headless QA of the new district.
 * Run: npx tsx scripts/make_orchard_save.ts
 */
import { createFreshWorldState, serializeWorldState } from '../src/game/storage';

const world = createFreshWorldState();
// Player stands just south of the orchard gate, facing the arch (north = -z)
world.playerPos = { x: -2.4, z: -12.6 };
world.day = 2;
console.log(serializeWorldState(world));
