/**
 * Wild Hollows QA save (Build 10): a fresh spring afternoon world with all
 * neighbors met, used as the base payload for the wilds QA script. Positions
 * are overwritten per-shot by scripts/qa_wilds.sh.
 *
 * Usage: npx tsx scripts/make_wilds_qa_save.ts > /tmp/wilds_base.json
 */
import { createFreshWorldState, serializeWorldState } from '../src/game/storage';

const world = createFreshWorldState();
world.day = 2; // spring
world.season = 'spring';
world.weather = 'sunlit';
world.minuteOfDay = 780; // 1:00 PM — afternoon

for (const id of Object.keys(world.residents) as Array<keyof typeof world.residents>) {
  world.residents[id].met = true;
}

world.playerLocation = 'exterior';
world.playerPos = { x: 0, z: 4.5 };
world.playerFacing = Math.PI;
world.exteriorPlayerPos = { ...world.playerPos };
world.exteriorPlayerFacing = world.playerFacing;

console.log(serializeWorldState(world));
