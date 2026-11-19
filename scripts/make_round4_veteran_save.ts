/**
 * Round-4 everyday-life QA helper: a "veteran" WorldState save in which every
 * neighboring daily story has already been lived — orchard gathering completed,
 * greenhouse harvests taken, bakery kneads/loaves shared, nook books read,
 * tea-table moments recorded — while the player sits inside Willow Step Cottage
 * in the morning. Used to verify how (or whether) the home reflects the player's
 * history before/after Round-4 memento passes.
 * Run: npx tsx scripts/make_round4_veteran_save.ts > /tmp/round4_veteran_save.json
 */
import { createFreshWorldState, serializeWorldState } from '../src/game/storage';

const world = createFreshWorldState();

world.playerLocation = 'cottage_interior';
world.exteriorPlayerPos = { x: -9.8, z: 10.0 };
world.playerPos = { x: 0.4, z: -0.6 };
world.playerFacing = Math.PI * 0.35;
world.day = 9;
world.minuteOfDay = 540; // morning
world.weather = 'sunlit';
world.season = 'spring';

world.cottageState = {
  placedFlowerId: 'chamomile_blossom',
  displayedKeepsakeIds: ['willow_zine_copy', 'pond_watercolor_card', 'cedar_music_box'],
  hearthLit: true,
  kettleWarmUntilMinute: 620,
  almanacReadToday: false,
  cottageRestCount: 6,
};

// Greenhouse: two harvest cycles lived through with Mina
world.greenhouseState = {
  ...world.greenhouseState,
  noteReadDay: 3,
  totalPlanted: 4,
  totalHarvests: 2,
};

// Bakery: two kneading mornings with Clara, one loaf shared home
world.bakeryState = {
  ...world.bakeryState,
  bakeCheckedDay: 8,
  kneadedDay: 8,
  loafSharedDay: 7,
  notesReadDay: 3,
  starterNotesDay: 3,
  kneadingSessions: 2,
  loavesShared: 1,
};

// Book Nook: two books settled into, one reader's cup
world.nookState = {
  ...world.nookState,
  shelfBrowsedDay: 9,
  teaSharedDay: 6,
  notesReadDay: 3,
  starterTeaDay: 3,
  booksRead: 2,
  teasShared: 1,
};

// Orchard gathering storyline fully completed
world.storylines = {
  ...world.storylines,
  side_orchard_gathering: {
    id: 'side_orchard_gathering',
    stage: 3,
    status: 'completed',
    completedDay: 6,
    startedDay: 2,
    updatedDay: 6,
  },
};

// Pocket Journal memories matching the lived story (unique ids, as the reducers write them)
const memory = (id: string, day: number, phase: 'morning' | 'afternoon' | 'golden' | 'dusk', title: string, summary: string) => ({
  id,
  day,
  phase,
  title,
  summary,
});
world.memories = [
  memory('mem_orchard_harvest', 4, 'afternoon', 'Orchard harvest', 'Gathered crabapples beneath the boughs.'),
  memory('mem_greenhouse_first_harvest', 5, 'morning', 'First greenhouse harvest', 'Mina showed you how the pots give back.'),
  memory('mem_bakery_first_knead', 6, 'morning', 'Kneading with Clara', 'Warm dough, warm kitchen.'),
  memory('mem_bakery_first_loaf', 7, 'golden', 'A loaf to take home', 'The crust sang when it cooled.'),
  memory('mem_nook_first_tea', 8, 'afternoon', "Nora's reader's cup", 'A quiet page and a warmer cup.'),
  memory('mem_teatable_chamomile_pear_tea', 9, 'morning', 'Tea at the Oak Table', 'A quiet warm chamomile tea moment.'),
];

world.inventory = {
  ...world.inventory,
  chamomile_blossom: 2,
  chamomile_pear_tea: 1,
  lavender_sprig: 1,
  crabapple: 3,
  wild_honey: 1,
  herb_loaf: 1,
};

process.stdout.write(serializeWorldState(world));
