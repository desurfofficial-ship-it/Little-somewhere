/**
 * Dialogue sheet QA save (Priorities 2-3): fresh morning world parked right beside
 * Clara at the Fountain Plaza so the interaction prompt surfaces immediately.
 *
 * Usage: npx tsx scripts/make_dialogue_qa_save.ts > /tmp/dialogue_qa_save.json
 */
import { createFreshWorldState, serializeWorldState } from '../src/game/storage';

const world = createFreshWorldState();
world.day = 2;
world.minuteOfDay = 420; // 7:00 AM — morning phase (Clara at the fountain plaza)
world.residents.clara.met = true;
world.residents.clara.trust = 2;
// Clara's morning slot target is (-3.2, 0.4); park the player just south-west of her.
world.playerLocation = 'exterior';
world.playerPos = { x: -3.2, z: 1.6 };
world.playerFacing = Math.PI; // facing north toward Clara
world.exteriorPlayerPos = { ...world.playerPos };
world.exteriorPlayerFacing = world.playerFacing;

console.log(serializeWorldState(world));
