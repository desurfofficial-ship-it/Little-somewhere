import test from 'node:test';
import assert from 'node:assert/strict';
import { createFreshWorldState, advanceToNextDay } from './storage';
import {
  buildResidentDialogue,
  computeEnvironmentState,
  getResidentAvailableQuestCue,
  isChoiceAvailable,
} from './narrative';
import { applyDialogueChoice, interactWithProp } from './actions';
import {
  PLAYER_SPAWN,
  getLandmarkAt,
  isPointWalkable,
  resolveMovement,
} from './worldMap';
import {
  RESIDENT_ORDER,
  formatClock,
  getResidentScheduleSlot,
  getTimePhase,
} from './residents';

test('player spawn sits on an open walkable lane with clear sightline', () => {
  assert.equal(isPointWalkable(PLAYER_SPAWN.x, PLAYER_SPAWN.z), true);
  assert.equal(isPointWalkable(PLAYER_SPAWN.x + 1.0, PLAYER_SPAWN.z), true);
  assert.equal(isPointWalkable(PLAYER_SPAWN.x - 0.5, PLAYER_SPAWN.z), true);
  const landmark = getLandmarkAt(PLAYER_SPAWN);
  assert.equal(landmark.id, 'home');
});

test('collision prevents walking into buildings or fountain while allowing axis sliding', () => {
  // Inside player cottage should be blocked
  assert.equal(isPointWalkable(-14, 10), false);
  // Inside pond water should be blocked
  assert.equal(isPointWalkable(2, 14), false);
  // Sliding along cottage wall works on clear axis
  const slid = resolveMovement({ x: -10.0, z: 10.0 }, { x: -11.5, z: 9.0 });
  assert.equal(slid.x, -10.0);
  assert.equal(slid.z, 9.0);
});

test('all registered residents have valid walkable schedule slots across all 4 time phases', () => {
  assert.ok(RESIDENT_ORDER.length >= 1, 'RESIDENT_ORDER must register at least one resident');
  assert.equal(new Set(RESIDENT_ORDER).size, RESIDENT_ORDER.length, 'RESIDENT_ORDER IDs must be unique');
  const phases = ['morning', 'afternoon', 'golden', 'dusk'] as const;
  for (const id of RESIDENT_ORDER) {
    for (const phase of phases) {
      const slot = getResidentScheduleSlot(id, phase, false);
      assert.equal(
        isPointWalkable(slot.target.x, slot.target.z, 0.35),
        true,
        `${id} ${phase} target (${slot.target.x}, ${slot.target.z}) must be walkable`,
      );
    }
  }
});

test('time phases and clock formatting match day progression', () => {
  assert.equal(getTimePhase(480), 'morning');
  assert.equal(getTimePhase(780), 'afternoon');
  assert.equal(getTimePhase(1020), 'golden');
  assert.equal(getTimePhase(1170), 'dusk');
  assert.equal(formatClock(495), '8:15 AM');
  assert.equal(formatClock(785), '1:05 PM');
});

test('branching storyline progresses from Pip mystery to restored bell and environmental transformation', () => {
  let world = createFreshWorldState();

  // Initially environment is quiet & unrestored
  let env = computeEnvironmentState(world.flags);
  assert.equal(env.bellGleaming, false);
  assert.equal(env.ivyCleared, false);
  assert.equal(env.fountainFlowing, false);
  assert.equal(env.plantersBloomed, 0);

  // 1. Talk to Pip to learn the bell mystery
  const pipSession = buildResidentDialogue('pip', world, 'morning');
  const pipChoice = pipSession.nodes.root.choices[0];
  world = applyDialogueChoice(world, pipSession, pipChoice).nextWorld;
  assert.equal(world.flags.heardBellMystery, true);
  assert.equal(world.residents.pip.trust, 1);

  // 2. Talk to Barnaby to borrow ladder (clears gazebo ivy) & fix fountain
  const barnabySession = buildResidentDialogue('barnaby', world, 'morning');
  const ladderChoice = barnabySession.nodes.root.choices.find((c) => c.id === 'barnaby_ladder');
  assert.ok(ladderChoice && isChoiceAvailable(ladderChoice, world.flags, world.residents.barnaby.trust));
  world = applyDialogueChoice(world, barnabySession, ladderChoice).nextWorld;
  assert.equal(world.flags.clearedGazeboIvy, true);

  const barnabySession2 = buildResidentDialogue('barnaby', world, 'morning');
  const valveChoice = barnabySession2.nodes.root.choices.find((c) => c.id === 'barnaby_fountain');
  assert.ok(valveChoice);
  world = applyDialogueChoice(world, barnabySession2, valveChoice).nextWorld;
  assert.equal(world.flags.repairedFountain, true);

  // 3. Find brass clapper via Toby or Hollow Oak
  const oakRes = interactWithProp(world, 'hollow_oak');
  world = oakRes.nextWorld;
  assert.equal(world.flags.foundBrassClapper, true);

  // 4. Plant moon petals with Mina
  const minaSession = buildResidentDialogue('mina', world, 'morning');
  const plantChoice = minaSession.nodes.root.choices.find((c) => c.id === 'mina_plant');
  assert.ok(plantChoice);
  world = applyDialogueChoice(world, minaSession, plantChoice).nextWorld;

  // 5. Arthur restores the bell once ivy is cleared and clapper is found
  assert.equal(getResidentAvailableQuestCue('arthur', world), 'ready');
  const arthurSession = buildResidentDialogue('arthur', world, 'morning');
  const restoreChoice = arthurSession.nodes.root.choices.find((c) => c.id === 'arthur_restore_bell');
  assert.ok(restoreChoice);
  world = applyDialogueChoice(world, arthurSession, restoreChoice).nextWorld;

  env = computeEnvironmentState(world.flags);
  assert.equal(env.bellGleaming, true);
  assert.equal(env.ivyCleared, true);
  assert.equal(env.fountainFlowing, true);
  assert.equal(env.festoonLanterns, true);
  assert.equal(env.reconciledTogether, true);
  assert.equal(env.plantersBloomed, 3);

  // Clara & Arthur now share Golden Hour together at the gazebo steps
  const claraGolden = getResidentScheduleSlot('clara', 'golden', env.reconciledTogether);
  const arthurGolden = getResidentScheduleSlot('arthur', 'golden', env.reconciledTogether);
  assert.equal(claraGolden.placeName, 'Gazebo Steps');
  assert.equal(arthurGolden.placeName, 'Gazebo Steps');

  // Ringing the restored bell increments bellRungCount
  const bellRes = interactWithProp(world, 'gazebo_bell');
  assert.equal(bellRes.actionType, 'ring_bell');
  assert.equal(bellRes.nextWorld.bellRungCount, 1);

  // Advancing to next day preserves flags & memories while resetting talkedToday
  const day2 = advanceToNextDay(bellRes.nextWorld);
  assert.equal(day2.day, 2);
  assert.equal(day2.flags.bellRestored, true);
  assert.equal(day2.residents.arthur.talkedToday, false);
  assert.equal(day2.memories.length, world.memories.length);
});
