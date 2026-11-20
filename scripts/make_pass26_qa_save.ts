/**
 * Pass 26 QA save: a winter afternoon world with the three face-detail
 * residents (Barnaby, Rowan, Mina) pinned at their afternoon identity slots so
 * close-up screenshots can verify their beards / hat flower render live.
 *
 * The pinned residents keep their slots for ~2-5 sim minutes after load
 * (staggered activityUntilMinute), then resume autonomous activity — which
 * starts them walking near the player exactly when the dust-poof shots run.
 *
 * Usage: npx tsx scripts/make_pass26_qa_save.ts > /tmp/pass26_base.json
 */
import { createFreshWorldState, serializeWorldState } from '../src/game/storage';

const world = createFreshWorldState();
world.day = 31; // winter (days 31-40)
world.season = 'winter';
world.weather = 'sunlit';
world.minuteOfDay = 780; // 1:00 PM — afternoon phase

const slots = {
  barnaby: { x: 2.9, z: 3.2, facing: -2.1, anim: 'admire' as const, holdUntil: 785 },
  rowan: { x: -2.3, z: -15.4, facing: 3.05, anim: 'interact' as const, holdUntil: 784 },
  mina: { x: -8.8, z: 6.2, facing: -2.2, anim: 'admire' as const, holdUntil: 783 },
};

for (const [id, slot] of Object.entries(slots)) {
  const rt = world.npcRuntime[id as keyof typeof world.npcRuntime];
  rt.position = { x: slot.x, z: slot.z };
  rt.targetPos = { x: slot.x, z: slot.z };
  rt.targetFacing = slot.facing;
  rt.facing = slot.facing;
  rt.waypoints = [];
  rt.currentSpeed = 0;
  rt.animState = slot.anim;
  rt.stuckSeconds = 0;
  rt.activityUntilMinute = slot.holdUntil;
  rt.goalCommittedUntilMinute = slot.holdUntil;
}

// Everyone on the lane already knows the wanderer (prompts work immediately).
for (const id of Object.keys(world.residents) as Array<keyof typeof world.residents>) {
  world.residents[id].met = true;
}

world.playerLocation = 'exterior';
world.playerPos = { x: 3.9, z: 4.1 };
world.playerFacing = Math.atan2(2.9 - 3.9, 3.2 - 4.1); // face Barnaby at the fountain valve
world.exteriorPlayerPos = { ...world.playerPos };
world.exteriorPlayerFacing = world.playerFacing;

console.log(serializeWorldState(world));
