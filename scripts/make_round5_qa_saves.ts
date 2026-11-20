/**
 * Round-5 everyday-life QA helper: five purpose-built WorldState saves that
 * exercise the Pass 16-18 visuals:
 *   hearth-autumn  — veteran interior, autumn afternoon  (herb-drying rack)
 *   hearth-winter  — veteran interior, winter afternoon  (hearth sock + garland)
 *   hearth-spring  — veteran interior, spring morning    (blossom jug baseline)
 *   dusk-lit       — exterior dusk, hearth lit           (warm windows + smoke)
 *   dusk-cold      — exterior dusk, hearth cold          (dark home, no smoke)
 *   dusk-kettle    — exterior dusk, lit + kettle warm    (brightest windows)
 * Run: npx tsx scripts/make_round5_qa_saves.ts /tmp/r5
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createFreshWorldState, serializeWorldState } from '../src/game/storage';
import type { WorldState } from '../src/game/types';

const outDir = process.argv[2] ?? '/tmp/r5';
mkdirSync(outDir, { recursive: true });

function veteranBase(location: 'cottage_interior' | 'exterior'): WorldState {
  const world = createFreshWorldState();
  world.playerLocation = location;
  world.exteriorPlayerPos = { x: -9.8, z: 10.0 };
  world.playerPos = location === 'cottage_interior' ? { x: 0.4, z: -0.6 } : { x: -9.8, z: 10.0 };
  world.playerFacing = Math.PI * 0.35;
  world.day = 9;
  world.cottageState = {
    placedFlowerId: 'chamomile_blossom',
    displayedKeepsakeIds: ['willow_zine_copy', 'pond_watercolor_card', 'cedar_music_box'],
    hearthLit: true,
    kettleWarmUntilMinute: 0,
    almanacReadToday: false,
    cottageRestCount: 6,
  };
  world.greenhouseState = { ...world.greenhouseState, totalPlanted: 4, totalHarvests: 2 };
  world.bakeryState = { ...world.bakeryState, kneadingSessions: 2, loavesShared: 1 };
  world.nookState = { ...world.nookState, booksRead: 2, teasShared: 1 };
  world.memories = [
    { id: 'mem_orchard_harvest', day: 4, phase: 'afternoon', title: 't', summary: 's' },
    { id: 'mem_teatable_chamomile_pear_tea', day: 9, phase: 'morning', title: 't2', summary: 's2' },
  ];
  return world;
}

const saves: Record<string, WorldState> = {
  // 1-3: interiors across seasons (day offsets put the calendar in season)
  'hearth-autumn': (() => {
    const w = veteranBase('cottage_interior');
    w.day = 25; // autumn
    w.minuteOfDay = 900; // afternoon
    w.weather = 'sunlit';
    return w;
  })(),
  'hearth-winter': (() => {
    const w = veteranBase('cottage_interior');
    w.day = 35; // winter
    w.minuteOfDay = 900;
    w.weather = 'sunlit';
    return w;
  })(),
  'hearth-spring': (() => {
    const w = veteranBase('cottage_interior');
    w.day = 5; // spring
    w.minuteOfDay = 540; // morning
    w.weather = 'sunlit';
    return w;
  })(),
  // 4-6: dusk exteriors across hearth states
  'dusk-lit': (() => {
    const w = veteranBase('exterior');
    w.day = 5;
    w.minuteOfDay = 1180; // dusk
    w.weather = 'sunlit';
    w.cottageState.hearthLit = true;
    w.cottageState.kettleWarmUntilMinute = 0;
    return w;
  })(),
  'dusk-cold': (() => {
    const w = veteranBase('exterior');
    w.day = 5;
    w.minuteOfDay = 1180;
    w.weather = 'sunlit';
    w.cottageState.hearthLit = false;
    w.cottageState.kettleWarmUntilMinute = 0;
    return w;
  })(),
  'dusk-kettle': (() => {
    const w = veteranBase('exterior');
    w.day = 5;
    w.minuteOfDay = 1180;
    w.weather = 'sunlit';
    w.cottageState.hearthLit = true;
    w.cottageState.kettleWarmUntilMinute = 1210; // warm past dusk end
    return w;
  })(),
  // 7: summer porch (marigold pot + lavender wreath accent)
  'porch-summer': (() => {
    const w = veteranBase('exterior');
    w.day = 15; // summer
    w.minuteOfDay = 820; // afternoon
    w.weather = 'sunlit';
    return w;
  })(),
};

for (const [name, world] of Object.entries(saves)) {
  writeFileSync(`${outDir}/${name}.json`, serializeWorldState(world));
  console.log(`wrote ${outDir}/${name}.json`);
}
