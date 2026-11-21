/**
 * Integration QA saves (Build-10/LR recovery): deterministic staged payloads
 * for the browser gameplay verification (docs/architecture/build10-lr-recovery/
 * 09-gameplay-verification-report.md).
 *
 * Usage: npx tsx scripts/make_integration_qa_saves.ts <out-dir>
 * Writes <out-dir>/{disc,mina,nora_talk,nora_visit,nora_drift}.json — each is a full
 * serialized WorldState ready for localStorage injection.
 *
 * Staging rules mirror the landed unit fixtures (build10-recovery.test.ts
 * suppressCompetingTopics; occupancy.test.ts stageFriendlyMorningWorld):
 * every precondition is flipped through its ordinary-play resolution, and the
 * Nora invitation is created through the PRODUCTION offer/accept reducers.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createFreshWorldState, serializeWorldState } from '../src/game/storage';
import { offerInvitation, acceptInvitation } from '../src/game/invitations';
import { enterNookAction } from '../src/game/actions';
import { DIALOGUE_TOPICS } from '../src/game/dialogue/index';
import { getTopicHistoryKey } from '../src/game/dialogueEngine';

const outDir = process.argv[2] ?? '/tmp/integration_qa_saves';
mkdirSync(outDir, { recursive: true });

function friendlyMorningBase(minuteOfDay: number) {
  const world = createFreshWorldState();
  world.day = 2;
  world.minuteOfDay = minuteOfDay;
  world.residents.nora = { ...world.residents.nora, met: true, trust: 3 };
  world.playerRelations.nora = {
    ...world.playerRelations.nora,
    affinity: 60,
    reliability: 30,
    negativeCount: 0,
  };
  world.flags = { ...world.flags, foundPostcard: true };
  return world;
}

// ── G1: discovery — player parked on WALKABLE ground inside Marigold Lane ──
// (the Sorrel Hollow zone center itself is non-walkable — see doc 09 §H-7 —
// so the load sanitizer would reset a save parked there to spawn).
const disc = friendlyMorningBase(540);
disc.playerPos = { x: 20.3, z: 5.5 };
disc.exteriorPlayerPos = { ...disc.playerPos };
writeFileSync(join(outDir, 'disc.json'), serializeWorldState(disc));

// ── G2: D-02 — Sorrel discovered; every competing Mina topic spent same-day ──
// (mirrors suppressCompetingTopics so the restored check-in is the selected
// topic on the FIRST dialogue open through the real UI).
const mina = friendlyMorningBase(540);
mina.residents.mina = { ...mina.residents.mina, met: true };
mina.sideFlags = { ...mina.sideFlags, explored_sorrel_hollow: true };
mina.playerPos = { x: 8.6, z: 1.4 };
mina.exteriorPlayerPos = { ...mina.playerPos };
for (const t of DIALOGUE_TOPICS) {
  if (t.residentId !== 'any' && t.residentId !== 'mina') continue;
  if (t.id === 'daily_mina_foxglove') continue;
  const key = getTopicHistoryKey(t, 'mina');
  mina.topicHistory[key] = {
    seenCount: 1,
    lastSeenDay: mina.day,
    lastSeenPhase: 'morning',
    chosenChoiceIds: [],
  };
  const cond = (t.condition ?? {}) as {
    requiresStoryline?: { id?: string };
    sideFlagsFalse?: string[];
    flagsFalse?: string[];
  };
  if (cond.requiresStoryline?.id) {
    mina.storylines[cond.requiresStoryline.id] = {
      id: cond.requiresStoryline.id,
      stage: 9,
      status: 'completed',
    };
  }
  for (const k of cond.sideFlagsFalse ?? []) mina.sideFlags[k] = true;
  for (const k of cond.flagsFalse ?? []) (mina.flags as Record<string, boolean>)[k] = true;
}
delete mina.lastTopicByResident.mina;
writeFileSync(join(outDir, 'mina.json'), serializeWorldState(mina));

// Facing helper: worldMap convention fx = sin(a), fz = cos(a); aim from the
// player position at a target so selectBestInteractiveTarget's facing penalty
// resolves ties the way a player aiming at the door/Nora would.
function faceAt(world: ReturnType<typeof friendlyMorningBase>, tx: number, tz: number) {
  const dx = tx - world.playerPos.x;
  const dz = tz - world.playerPos.z;
  world.playerFacing = Math.atan2(dx, dz);
  world.exteriorPlayerFacing = world.playerFacing;
}

// ── G3: Nora talk staging — parked north of Nora, FACING her, door behind ──
const talk = friendlyMorningBase(540);
talk.playerPos = { x: -10.2, z: -0.1 };
talk.exteriorPlayerPos = { ...talk.playerPos };
faceAt(talk, -10.8, -0.6);
writeFileSync(join(outDir, 'nora_talk.json'), serializeWorldState(talk));

// ── G4: Nook entry staging — offer→accept through production reducers, then
// the player parks WALKABLE south of the door (-11.8, -1.0) FACING it, making
// the door the nearest interactive target ("Step Inside [E]").
const visit = friendlyMorningBase(540);
visit.playerPos = { x: -11.75, z: -2.75 };
visit.exteriorPlayerPos = { ...visit.playerPos };
const offered = offerInvitation(visit, 'nora', 'share_featured_reading');
if (!offered.ok) throw new Error(`G4 precondition failed: offer ${offered.reason}`);
const accepted = acceptInvitation(offered.world);
if (!accepted.ok) throw new Error(`G4 precondition failed: accept ${accepted.reason}`);
const visitWorld = accepted.world as typeof visit;
visitWorld.playerPos = { x: -11.75, z: -2.75 };
visitWorld.exteriorPlayerPos = { ...visitWorld.playerPos };
faceAt(visitWorld, -11.8, -1.0);
// The chalk_bundle world prop rests 1.2 m from the parking spot and its
// carryable target (bias -0.08) beats the door (+0.05). Stage the natural
// player state — already carrying it — so the door is the interactive target;
// enterNookAction places held props automatically on entry.
visitWorld.playerHeldItem = 'chalk_bundle';
visitWorld.worldProps = {
  ...visitWorld.worldProps,
  chalk_bundle: { ...visitWorld.worldProps.chalk_bundle, holder: 'player' as const },
};
// Ambient-life staging (ordinary state, no invitation surfaces touched):
// Sora — whose tea-cart slot is adjacent to Nora's morning slot — is already
// chatting with Clara, so the fresh world's zero cooldowns cannot pair
// sora+nora on the first ticks and pull the host away before entry. Without
// this, the enter-time backstop correctly refuses (verified live: that IS the
// G5 path) but the happy-path occupancy triple cannot be captured.
visitWorld.activeEncounters = [
  {
    id: 'enc_qa_sora_clara',
    participants: ['sora', 'clara'],
    topicTag: 'morning_chat',
    summary: 'Sora & Clara: Morning catch-up',
    spots: [
      { x: -9, z: 0 },
      { x: -8, z: 0 },
    ],
    startedMinute: 500,
    endsMinute: 600,
  },
];
// Mirror what the production encounter-forming code sets on the runtime, or
// the tick's formation guard (socialPartnerId === null) immediately re-pairs
// sora with nora on the first tick.
visitWorld.npcRuntime = {
  ...visitWorld.npcRuntime,
  sora: { ...visitWorld.npcRuntime.sora, socialPartnerId: 'clara', position: { x: -9, z: 0 } },
  clara: { ...visitWorld.npcRuntime.clara, socialPartnerId: 'sora', position: { x: -8, z: 0 } },
};
writeFileSync(join(outDir, 'nora_visit.json'), serializeWorldState(visitWorld));

// ── G5: schedule-drift backstop — same accepted invite, clock at 700
// (afternoon: Nora's static slot is West Bench, beyond the home radius).
// Entering through the real door must refuse visibly (host_unavailable).
const drift = friendlyMorningBase(700);
drift.playerPos = { x: -11.75, z: -2.75 };
drift.exteriorPlayerPos = { ...drift.playerPos };
const offeredDrift = offerInvitation({ ...drift, minuteOfDay: 540 }, 'nora', 'share_featured_reading');
if (!offeredDrift.ok) throw new Error(`G5 precondition failed: offer ${offeredDrift.reason}`);
const acceptedDrift = acceptInvitation(offeredDrift.world);
if (!acceptedDrift.ok) throw new Error(`G5 precondition failed: accept ${acceptedDrift.reason}`);
// Clamp the clock forward after accept, exactly like the +2h button would.
const driftedWorld = { ...(acceptedDrift.world as typeof drift), minuteOfDay: 700 };
driftedWorld.playerPos = { x: -11.75, z: -2.75 };
driftedWorld.exteriorPlayerPos = { ...driftedWorld.playerPos };
faceAt(driftedWorld, -11.8, -1.0);
driftedWorld.playerHeldItem = 'chalk_bundle';
driftedWorld.worldProps = {
  ...driftedWorld.worldProps,
  chalk_bundle: { ...driftedWorld.worldProps.chalk_bundle, holder: 'player' as const },
};
writeFileSync(join(outDir, 'nora_drift.json'), serializeWorldState(driftedWorld));

console.log(`wrote 5 QA saves to ${outDir}`);
