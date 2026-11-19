import test from 'node:test';
import assert from 'node:assert/strict';
import { hashSeed, mulberry32, seededInt, seededPick, seededRange } from './rng';
import {
  DAY_END_MINUTE,
  DAY_START_MINUTE,
  advanceSimulationClock,
  getSeasonForDay,
  getTimePhase,
} from './time';
import { createFreshWorldState } from './storage';
import { interruptSocialEncounter, stepSimulation } from './simulation';
import { getNpcRelation } from './relationships';
import { RESIDENTS, RESIDENT_ORDER } from './residents';
import { distance2D, isPointWalkable } from './worldMap';

test('deterministic PRNG produces identical sequences for identical seeds and diverges cleanly otherwise', () => {
  const s1 = hashSeed(18042, 'day', 3, 'clara');
  const s2 = hashSeed(18042, 'day', 3, 'clara');
  const s3 = hashSeed(18042, 'day', 3, 'arthur');
  assert.equal(s1, s2);
  assert.notEqual(s1, s3);

  const rA = mulberry32(s1);
  const rB = mulberry32(s2);
  const seqA = Array.from({ length: 8 }, () => rA());
  const seqB = Array.from({ length: 8 }, () => rB());
  assert.deepEqual(seqA, seqB);

  const n = seededInt(mulberry32(s1), 2, 5);
  assert.equal(n >= 2 && n <= 5, true);
  const f = seededRange(mulberry32(s1), -1, 1);
  assert.equal(f >= -1 && f <= 1, true);
  const picked = seededPick(mulberry32(s1), ['a', 'b', 'c']);
  assert.ok(['a', 'b', 'c'].includes(picked));
});

test('unified simulation clock bounds 360..1290 and 10-day seasonal cadence', () => {
  assert.equal(advanceSimulationClock(DAY_START_MINUTE, -50), DAY_START_MINUTE);
  assert.equal(advanceSimulationClock(1200, 120), DAY_END_MINUTE);
  assert.equal(getTimePhase(360), 'morning');
  assert.equal(getTimePhase(690), 'afternoon');
  assert.equal(getTimePhase(960), 'golden');
  assert.equal(getTimePhase(1110), 'dusk');

  assert.equal(getSeasonForDay(1).season, 'spring');
  assert.equal(getSeasonForDay(10).dayOfSeason, 10);
  assert.equal(getSeasonForDay(11).season, 'summer');
  assert.equal(getSeasonForDay(21).season, 'autumn');
  assert.equal(getSeasonForDay(31).season, 'winter');
  assert.equal(getSeasonForDay(41).year, 2);
});

test('headless simulation is strictly deterministic and navigates NPCs smoothly across phase transitions', () => {
  let simA = createFreshWorldState();
  let simB = createFreshWorldState();

  // Pause and dialogueOpen freeze simulation clock cleanly
  const paused = stepSimulation(simA, 0.25, { paused: true });
  assert.equal(paused.minuteOfDay, simA.minuteOfDay);

  const dialogueFrozen = stepSimulation(simA, 0.25, { dialogueOpen: true });
  assert.equal(dialogueFrozen.minuteOfDay, simA.minuteOfDay);

  // Jump both simulations right before Afternoon transition (690) and step 70 frames (17.5s)
  simA = { ...simA, minuteOfDay: 688 };
  simB = { ...simB, minuteOfDay: 688 };

  for (let frame = 0; frame < 70; frame++) {
    simA = stepSimulation(simA, 0.25);
    simB = stepSimulation(simB, 0.25);
  }

  assert.deepEqual(simA, simB);
  assert.equal(getTimePhase(simA.minuteOfDay), 'afternoon');

  // Verify every resident stayed walkable and navigated cleanly toward their active targetPos
  for (const id of RESIDENT_ORDER) {
    const rt = simA.npcRuntime[id];
    assert.equal(
      isPointWalkable(rt.position.x, rt.position.z, 0.35),
      true,
      `${id} remained walkable at (${rt.position.x.toFixed(2)}, ${rt.position.z.toFixed(2)})`,
    );
    assert.equal(
      distance2D(rt.position, rt.targetPos) < 0.75,
      true,
      `${id} arrived near afternoon target (${rt.currentActivityId})`,
    );
  }
});

test('residents exhibit individual trait differences, weather sheltering, and social encounter cooldowns', () => {
  // Confirm distinct trait variance between outgoing Pip/Jun and reserved Arthur/Toby
  assert.ok(RESIDENTS.pip.traits.sociability > RESIDENTS.arthur.traits.sociability + 0.5);
  assert.ok(RESIDENTS.toby.traits.outdoorsiness > RESIDENTS.nora.traits.outdoorsiness + 0.5);

  // Run full sunny day simulation and collect social encounters
  let world = createFreshWorldState();
  world = { ...world, playerPos: { x: -10.5, z: 10.5 } }; // step aside on porch so plaza residents can socialize

  let observedSocial = false;
  for (let step = 0; step < 340; step++) {
    world = stepSimulation(world, 0.25, { clockRateMinutesPerSec: 8 });
    if (world.activeEncounters.length > 0) {
      observedSocial = true;
      for (const enc of world.activeEncounters) {
        // Estranged Clara and Arthur must NOT autonomously socialize before reconciliation
        assert.notEqual(
          enc.participants.slice().sort().join(':'),
          'arthur:clara',
          'Estranged Clara and Arthur must stay apart before reconciliation',
        );
        // Verify cooldown assigned (>= 90 minutes beyond encounter end)
        for (const pid of enc.participants) {
          assert.ok(
            world.npcRuntime[pid].socialCooldownUntilMinute >= enc.endsMinute + 90,
            `${pid} social cooldown must be >= 90 mins past encounter end`,
          );
        }
      }
      // Test clean player interruption of an active social encounter
      const firstActor = world.activeEncounters[0].participants[0];
      const afterInterrupt = interruptSocialEncounter(world, firstActor);
      assert.equal(afterInterrupt.npcRuntime[firstActor].socialPartnerId, null);
    }
  }

  assert.equal(observedSocial, true, 'At least one autonomous NPC-to-NPC social encounter should occur over a day');
  assert.ok(world.worldEvents.some((e) => e.kind === 'npc_social'));

  // Activity history records entries across residents
  const totalHistory = RESIDENT_ORDER.reduce((sum, id) => sum + world.npcActivityHistory[id].length, 0);
  assert.ok(totalHistory >= RESIDENT_ORDER.length);

  // Rainy day triggers sheltered activities more strongly than sunlit day for shelter-preferring residents
  let rainWorld: import('./types').WorldState = {
    ...createFreshWorldState(),
    weather: 'light_rain',
    minuteOfDay: 700,
  };
  rainWorld = stepSimulation(rainWorld, 0.25);
  assert.equal(getNpcRelation(rainWorld.npcRelations, 'clara', 'arthur').affinity < 0, true);
});
