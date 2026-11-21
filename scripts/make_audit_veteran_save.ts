/**
 * Visual Identity Evolution — Build 01 veteran-save generator (Doc 08 Phase 0.3).
 *
 * A "veteran" WorldState in which the neighborhood has been genuinely lived in:
 * bell restored, Clara & Arthur reconciled, festoon lanterns earned, orchard
 * gathering completed, greenhouse/bakery/nook/copperwheel visits recorded, a
 * memento shelf full, and warm relationships across the cast. It drives the
 * Phase-0 capture harness (scripts/qa_visual_baseline.sh) so every validation
 * frame shows the game at real progression, and doubles as the veteran-save
 * loading check (brief §2.4): if this save fails to boot with 0 console errors
 * and all ten residents present, Phase 0 fails.
 *
 * The save deliberately leaves the player OUTSIDE at the plaza in golden hour,
 * which is the V6 hero framing; the harness re-positions the player per target
 * on top of this base (same injection pattern as scripts/qa_pass26.sh).
 *
 * Usage: npx tsx scripts/make_audit_veteran_save.ts > /tmp/audit_veteran.json
 */
import { createFreshWorldState, serializeWorldState } from '../src/game/storage';

const world = createFreshWorldState();

// Golden hour on a late-summer day: the plaza hero light the validation set
// (Doc 09 V6) evaluates materials and lighting under.
world.day = 13;
world.season = 'summer';
world.weather = 'sunlit';
world.minuteOfDay = 1080; // 6:00 PM — golden phase

// The neighborhood's stories have been lived (identity-frozen flags only —
// these are existing, schema-stable fields; nothing new is invented here).
world.flags = {
  ...world.flags,
  bellRestored: true,
  claraArthurReconciled: true,
  lanternsLit: true,
  foundBrassClapper: true,
  repairedFountain: true,
  plantedMoonPetals: true,
  clearedGazeboIvy: true,
};

// Everyone on the lane knows the wanderer.
for (const id of Object.keys(world.residents) as Array<keyof typeof world.residents>) {
  world.residents[id].met = true;
}

// Visitable interiors have all been visited and progressed.
world.cottageState = {
  placedFlowerId: 'chamomile_blossom',
  displayedKeepsakeIds: ['willow_zine_copy', 'pond_watercolor_card', 'cedar_music_box'],
  hearthLit: true,
  kettleWarmUntilMinute: 1110,
  almanacReadToday: false,
  cottageRestCount: 9,
};
world.greenhouseState = { ...world.greenhouseState, noteReadDay: 3, totalPlanted: 6, totalHarvests: 3 };
world.bakeryState = {
  ...world.bakeryState,
  bakeCheckedDay: 12,
  kneadedDay: 12,
  loafSharedDay: 11,
  notesReadDay: 4,
  starterNotesDay: 4,
  kneadingSessions: 4,
  loavesShared: 2,
};
world.nookState = {
  ...world.nookState,
  shelfBrowsedDay: 12,
  teaSharedDay: 10,
  notesReadDay: 4,
  starterTeaDay: 4,
  booksRead: 3,
  teasShared: 2,
};

// Orchard gathering storyline completed.
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

// A pocket journal that shows a lived-in world.
const memory = (
  id: string,
  day: number,
  phase: 'morning' | 'afternoon' | 'golden' | 'dusk',
  title: string,
  summary: string,
) => ({ id, day, phase, title, summary });
world.memories = [
  memory('mem_bell_restored', 3, 'afternoon', 'The bell rings again', 'Brass clapper, oak yoke, the whole square listening.'),
  memory('mem_orchard_harvest', 4, 'afternoon', 'Orchard harvest', 'Gathered crabapples beneath the boughs.'),
  memory('mem_greenhouse_first_harvest', 5, 'morning', 'First greenhouse harvest', 'Mina showed you how the pots give back.'),
  memory('mem_bakery_first_knead', 6, 'morning', 'Kneading with Clara', 'Warm dough, warm kitchen.'),
  memory('mem_bakery_first_loaf', 7, 'golden', 'A loaf to take home', 'The crust sang when it cooled.'),
  memory('mem_nook_first_tea', 8, 'afternoon', "Nora's reader's cup", 'A quiet page and a warmer cup.'),
  memory('mem_teatable_chamomile_pear_tea', 9, 'morning', 'Tea at the Oak Table', 'A quiet warm chamomile tea moment.'),
  memory('mem_reconciled_together', 11, 'golden', 'Two clocks, one workshop', 'Clara and Arthur closed the shutter dispute together.'),
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

// Player at the plaza fountain, the golden-hour hero spot, facing the fountain.
world.playerLocation = 'exterior';
world.playerPos = { x: 2.0, z: 4.6 };
world.playerFacing = -2.1;
world.exteriorPlayerPos = { ...world.playerPos };
world.exteriorPlayerFacing = world.playerFacing;
world.mailboxUnread = false;

process.stdout.write(serializeWorldState(world));
