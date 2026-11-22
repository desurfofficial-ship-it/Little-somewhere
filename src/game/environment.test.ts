import assert from 'node:assert/strict';
import test from 'node:test';
import {
  composeEnvironmentState,
  getSeasonLabel,
  getWeatherLabel,
  rollWeatherForDay,
} from './environment';
import { advanceToNextDay, createFreshWorldState } from './storage';

test('Day 1 is always sunlit and deterministic daily weather roll stays consistent', () => {
  const fresh = createFreshWorldState();
  assert.equal(fresh.weather, 'sunlit');
  assert.equal(rollWeatherForDay(fresh.simSeed, 1), 'sunlit');

  const rollA = rollWeatherForDay(fresh.simSeed, 4);
  const rollB = rollWeatherForDay(fresh.simSeed, 4);
  assert.equal(rollA, rollB);
  assert.ok(['sunlit', 'breezy', 'misty_morning', 'light_rain'].includes(rollA));
});

test('misty_morning lifts cleanly into sunlit after 10:30 AM and puddles clear appropriately', () => {
  const base = createFreshWorldState();
  const mistyWorld = {
    ...base,
    day: 3,
    weather: 'misty_morning' as const,
    minuteOfDay: 495, // 8:15 AM
  };

  const earlyComposed = composeEnvironmentState(mistyWorld);
  assert.equal(earlyComposed.weather.effective, 'misty_morning');
  assert.ok(earlyComposed.weather.intensity > 0);
  assert.equal(earlyComposed.timeOfDay.lanternScheduleActive, true);

  const lateComposed = composeEnvironmentState({
    ...mistyWorld,
    minuteOfDay: 645, // 10:45 AM
  });
  assert.equal(lateComposed.weather.effective, 'sunlit');
  assert.equal(lateComposed.weather.intensity, 0);
});

test('seasons advance every 10 in-game days and advanceToNextDay rolls next weather deterministically', () => {
  let state = createFreshWorldState();
  for (let d = 1; d <= 10; d++) {
    const c = composeEnvironmentState(state);
    assert.equal(c.season.season, 'spring');
    assert.equal(c.season.dayOfSeason, d);
    state = advanceToNextDay(state);
  }
  assert.equal(state.day, 11);
  assert.equal(state.season, 'summer');
  const summerComp = composeEnvironmentState(state);
  assert.equal(getSeasonLabel(summerComp.season.season), 'Summer');
  assert.equal(summerComp.season.dayOfSeason, 1);
  assert.equal(state.weather, rollWeatherForDay(state.simSeed, 11));
});

test('five-layer composition increments revision when flags or NPC touches evolve', () => {
  const base = createFreshWorldState();
  const c1 = composeEnvironmentState(base);
  assert.equal(c1.npcTouches.noticeboardFlyerCount, 1);
  assert.equal(c1.npcTouches.claraPastryBasketVisible, true); // morning

  const withMystery = {
    ...base,
    flags: { ...base.flags, heardBellMystery: true, bellRestored: true },
  };
  const c2 = composeEnvironmentState(withMystery);
  assert.notEqual(c2.revision, c1.revision);
  assert.equal(c2.npcTouches.noticeboardFlyerCount, 3);
  assert.equal(c2.playerChanges.bellGleaming, true);
  assert.ok(getWeatherLabel(c2.weather.tomorrowForecast).length > 0);

  const lateNight = composeEnvironmentState({
    ...withMystery,
    minuteOfDay: 1265,
  });
  assert.equal(lateNight.timeOfDay.cozyLateNightHint, true);

  const tartOrchard = composeEnvironmentState({
    ...withMystery,
    sideFlags: {
      ...withMystery.sideFlags,
      orchardGatheringComplete: true,
      orchardGatheringOutcome: 'spiced_tart_table',
    },
  });
  const picnicOrchard = composeEnvironmentState({
    ...withMystery,
    sideFlags: {
      ...withMystery.sideFlags,
      orchardGatheringComplete: true,
      orchardGatheringOutcome: 'blossom_honey_picnic',
    },
  });
  assert.equal(tartOrchard.playerChanges.orchardGatheringOutcome, 'spiced_tart_table');
  assert.equal(picnicOrchard.playerChanges.orchardGatheringOutcome, 'blossom_honey_picnic');
  assert.notEqual(tartOrchard.revision, c2.revision);
  assert.notEqual(picnicOrchard.revision, tartOrchard.revision);
});

// ---------------------------------------------------------------------------
// WP-3 (world-environment initiative, audit-1d): counter→visual world echoes.
// ---------------------------------------------------------------------------

test('WP-3: well pebble stack and posy bank echoes derive purely and bump the revision', () => {
  const fresh = createFreshWorldState();

  // Baseline: empty echoes.
  const base = composeEnvironmentState(fresh);
  assert.equal(base.worldEchoes.wellPebbleStack, 0);
  assert.equal(base.worldEchoes.posyBankPickedToday, false);

  // Pebbles: count grows, caps at 5, and each change bumps the static revision
  // so the render block reacts on the commit frame.
  const p1 = composeEnvironmentState({ ...fresh, sideFlags: { wellPebblesCount: 3 } });
  assert.equal(p1.worldEchoes.wellPebbleStack, 3);
  assert.notEqual(p1.revision, base.revision);
  const p2 = composeEnvironmentState({ ...fresh, sideFlags: { wellPebblesCount: 9 } });
  assert.equal(p2.worldEchoes.wellPebbleStack, 5, 'pebble stack caps at 5');
  assert.notEqual(p2.revision, p1.revision);

  // Posy: picked today -> stub shows; yesterday (or any other day) -> fresh bank.
  const pickedToday = composeEnvironmentState({
    ...fresh,
    sideFlags: { posyPickedDay: fresh.day, meadowPosiesPicked: 1 },
  });
  assert.equal(pickedToday.worldEchoes.posyBankPickedToday, true);
  assert.notEqual(pickedToday.revision, base.revision);
  const pickedYesterday = composeEnvironmentState({
    ...fresh,
    sideFlags: { posyPickedDay: fresh.day - 1, meadowPosiesPicked: 1 },
  });
  assert.equal(pickedYesterday.worldEchoes.posyBankPickedToday, false);
  assert.equal(pickedYesterday.revision, base.revision, 'stale pick days must not move the revision');

  // Day rollover regrows the bank automatically (the stub is day-keyed): same
  // sideFlags composed on the next morning resolve fresh.
  const regrown = composeEnvironmentState({
    ...fresh,
    day: fresh.day + 1,
    sideFlags: { posyPickedDay: fresh.day, meadowPosiesPicked: 1 },
  });
  assert.equal(regrown.worldEchoes.posyBankPickedToday, false);
});
