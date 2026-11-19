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
});
